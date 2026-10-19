// Week logic across year end / DST, autoSchedule edge cases, and the Changes export. Run: node tests/weeks.test.js
const H = require('./harness');
const res = [];
const rec = (name, ok, detail) => { res.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  -> ' + detail : '')); };

(async () => {
  const browser = await H.chromium.launch();
  const at = async (now, row) => H.open({ browser, now, row: row || { id: 'main', orders: [], nid: 1, settings: {} } });

  // 1. ISO week numbers around year end (2026 has 53 ISO weeks)
  let t = await at('2026-12-20T10:00:00Z');
  const wn = await t.page.evaluate(() => ['2026-12-28', '2027-01-01', '2027-01-03', '2027-01-04', '2025-12-29', '2026-01-01', '2020-12-31', '2021-01-04'].map(d => d + '=' + wkNum(d)));
  const expect = ['2026-12-28=53', '2027-01-01=53', '2027-01-03=53', '2027-01-04=1', '2025-12-29=1', '2026-01-01=1', '2020-12-31=53', '2021-01-04=1'];
  rec('wkNum matches ISO-8601 around year end', JSON.stringify(wn) === JSON.stringify(expect), wn.join(' '));
  const w8 = await t.page.evaluate(() => get8Wks());
  rec('get8Wks across year end: 8 distinct consecutive Mondays', new Set(w8).size === 8 && w8[0] === '2026-12-14' && w8[3] === '2027-01-04', w8.join(' '));
  // autoSchedule: job due 2 Jan 2027 (Sat, ISO wk53) -> week of 28 Dec
  await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date'], ['WO-1-1', 'a', 'b', '2027-01-02'], ['WO-1-2', 'a', 'b', '2027-01-04'], ['WO-1-3', 'a', 'b', '2026-12-13']]);
  const pw = await t.page.evaluate(() => { applyImport(IMPPLAN); return DB.orders.map(o => o.wo + ':' + o.plannedWeek); });
  rec('autoSchedule across year end (due 2 Jan -> wk of 28 Dec; 4 Jan -> 4 Jan; overdue -> this week)', pw.join() === 'WO-1-1:2026-12-28,WO-1-2:2027-01-04,WO-1-3:2026-12-14', pw.join(' '));
  await t.close();

  // 2. DST start (Irish clocks go forward Sun 28 Mar 2027): get8Wks run in early March
  t = await at('2027-03-08T10:00:00Z');
  const w8d = await t.page.evaluate(() => get8Wks());
  rec('get8Wks across the March clock change: 8 distinct Mondays', new Set(w8d).size === 8 && w8d.every(k => new Date(k + 'T00:00:00Z').getUTCDay() === 1), w8d.join(' '));
  await t.close();

  // 3. DST end (last Sun Oct)
  t = await at('2026-10-12T10:00:00Z');
  const w8e = await t.page.evaluate(() => get8Wks());
  rec('get8Wks across the October clock change', new Set(w8e).size === 8 && w8e.every(k => new Date(k + 'T00:00:00Z').getUTCDay() === 1), w8e.join(' '));
  await t.close();

  // 4. Just after midnight Monday in summer time — which week is "this week"?
  t = await at('2027-06-07T00:30:00+01:00'); // Monday 00:30 Irish summer time
  const cur = await t.page.evaluate(() => get8Wks()[0]);
  rec('Monday 00:30 (summer time) is in the new week', cur === '2027-06-07', 'this week = ' + cur);
  await t.close();

  // 5. Late-vs-due across DST: planned week of 22 Mar 2027 (Fri = 26 Mar), due Fri 26 Mar
  t = await at('2027-03-01T10:00:00Z');
  const late = await t.page.evaluate(() => [isLateVsDue({ plannedWeek: '2027-03-22', dueDate: '2027-03-26' }), isLateVsDue({ plannedWeek: '2027-10-25', dueDate: '2027-10-29' }), isLateVsDue({ plannedWeek: '2027-03-29', dueDate: '2027-04-02' })]);
  rec('Planned week ending on the due Friday is not "late" (incl. clock-change weeks)', late.every(x => x === false), JSON.stringify(late));
  await t.close();

  // 6. Changes export: move, group-move, step change, move back; exported Week Was/Now and Step Was/Now
  t = await at('2026-10-19T10:00:00Z', { id: 'main', nid: 4, settings: {}, orders: [H.order({ wo: 'WO-1-1', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-1-2', plannedWeek: '2026-11-02' }), H.order({ wo: 'WO-1-3', plannedWeek: '2026-10-19' })] });
  const exp = await t.page.evaluate(async () => {
    const f = w => DB.orders.find(o => o.wo === w);
    f('WO-1-1').plannedWeek = '2026-11-09';
    f('WO-1-2').step = '4. Assembly';
    f('WO-1-3').plannedWeek = '2026-11-16'; f('WO-1-3').plannedWeek = '2026-10-19'; // moved and moved back
    showTab('x');
    let captured = null;
    const orig = XLSX.writeFile; XLSX.writeFile = (wb) => { captured = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); };
    document.getElementById('btn-xchg').click();
    XLSX.writeFile = orig;
    return captured;
  });
  const rows = (exp || []).slice(1).map(r => r[0] + '|' + r[4] + '|' + r[5] + '|' + r[6] + '|' + r[7]);
  rec('Changes export lists exactly the 2 changed WOs with correct Was/Now', rows.length === 2 && /WO-1-1\|Wk 44.*\|Wk 46/.test(rows[0]) && /WO-1-2\|.*4\. Assembly/.test(rows[1]), rows.join(' || '));
  await t.close();

  // 7. Changes export after year end: Week Now label for a week-53 move
  t = await at('2026-12-20T10:00:00Z', { id: 'main', nid: 2, settings: {}, orders: [H.order({ wo: 'WO-1-1', plannedWeek: '2026-12-21' })] });
  const e7 = await t.page.evaluate(() => { DB.orders[0].plannedWeek = '2026-12-28'; showTab('x'); let c; const o = XLSX.writeFile; XLSX.writeFile = wb => { c = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); }; document.getElementById('btn-xchg').click(); XLSX.writeFile = o; return c[1]; });
  rec('Export labels week of 28 Dec 2026 as Wk 53', /Wk 53/.test(e7[5]), 'Week Now = ' + e7[5]);
  await t.close();

  // 8. Full schedule "Week Summary" uses per-week capacity overrides
  t = await at('2026-10-19T10:00:00Z', { id: 'main', nid: 2, settings: { weekCaps: { '2026-10-19': 100 }, wcap: 350 }, orders: [H.order({ wo: 'WO-1-1', plannedWeek: '2026-10-19', hours: 90 })] });
  const e8 = await t.page.evaluate(() => { showTab('x'); let c; const o = XLSX.writeFile; XLSX.writeFile = wb => { c = XLSX.utils.sheet_to_json(wb.Sheets['Week Summary'], { header: 1 }); }; document.getElementById('btn-xfull').click(); XLSX.writeFile = o; return c[1]; });
  rec('Full-schedule Week Summary uses the week\'s own capacity (100h, 90% NEAR)', e8 && e8[4] === 100, JSON.stringify(e8));
  await t.close();

  await browser.close();
  console.log('\n' + res.filter(x => !x.ok).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
