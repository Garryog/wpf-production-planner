// Dates & deliveries (Job A) step 14: A3 poster, Excel export and run sheets for the OPEN TAB's week ("Wk N" in the
// title and file name, that week's dated notes, nothing from other weeks), the offline snapshot's this-week grid, and the
// Full Schedule Excel's new "Orig due" / "Moved ×" columns. Clock Mon 21 Dec 2026 (Wk 52 → 53). Stubbed Supabase only.
// Run: node tests/dates/c7-prints.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-12-23', origDueDate: '2026-12-23', plannedWeek: '2026-12-21', step: '8. PALLETED', delv: true, customer: 'CAIRN', title: 'House ' + wo }, x));
  const row = { id: 'main', nid: 9, settings: { delNotes: { '2026-12-22': 'wk52 tue note', '2026-12-29': 'wk53 <b>tue</b> note' } }, orders: [
    O('WO-52', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-12-21' }),
    O('WO-53', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-12-28', dueDate: '2026-12-30', origDueDate: '2026-12-23', dueHist: [{ at: '2026-12-20T10:00:00Z', by: 'Ann', f: 'due', from: '2026-12-23', to: '2026-12-30', why: 'Customer delay', src: 'planner' }] }),
    O('WO-53A', { delVeh: 'ARTIC', delDay: 'Wed', delWk: '2026-12-28', title: '<img src=x onerror=window.__x=1>' }),
    O('WO-P53', { dueDate: '2026-12-31' }),   // to plan in Wk 53
    O('WO-P52', { dueDate: '2026-12-22' }),   // to plan in Wk 52
  ] };
  const t = await H.open({ browser, now: '2026-12-21T10:00:00Z', row });
  const R = await t.page.evaluate(async () => {
    const out = {};
    showTab('d'); await new Promise(r => setTimeout(r, 150));
    document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 100));
    window.__opened = [];
    document.getElementById('btn-delprint').click(); out.poster = window.__opened.slice(-1)[0] || '';
    window.__opened = [];
    document.getElementById('btn-runsheets').click(); out.runs = window.__opened.slice(-1)[0] || '';
    let files = []; const wf = XLSX.writeFile;
    XLSX.writeFile = (wb, n) => files.push({ n, sheets: wb.SheetNames, cal: XLSX.utils.sheet_to_json(wb.Sheets.Calendar, { header: 1 }), by: XLSX.utils.sheet_to_json(wb.Sheets['By Day'], { header: 1 }) });
    document.getElementById('btn-delexp').click();
    XLSX.writeFile = wf; out.exp = files[0];
    // This week tab → its own week
    document.querySelector('[data-deltab="0"]').click(); await new Promise(r => setTimeout(r, 100));
    window.__opened = []; document.getElementById('btn-delprint').click(); out.poster0 = window.__opened.slice(-1)[0] || '';
    // Full Schedule
    let full; XLSX.writeFile = wb => { full = XLSX.utils.sheet_to_json(wb.Sheets['Full Schedule'], { header: 1 }); };
    showTab('x'); document.getElementById('btn-xfull').click(); XLSX.writeFile = wf;
    out.fullH = full[0]; out.full53 = full.find(r => r[0] === 'WO-53'); out.full52 = full.find(r => r[0] === 'WO-52');
    out.x = window.__x === 1;
    return out;
  });
  rec('poster: the open tab\'s week — "Wk 53" in the title, Mon 28 Dec dates, only Wk 53 jobs', /<title>WPF Delivery Plan — Wk 53 \(28 Dec\)<\/title>/.test(R.poster) && /Week 53/.test(R.poster) && /WO-53</.test(R.poster) && /WO-53A/.test(R.poster) && !/WO-52</.test(R.poster) && /28 DEC/.test(R.poster), (R.poster.match(/<title>[^<]*<\/title>/) || [''])[0]);
  rec('poster: that week\'s notes (escaped), not the other week\'s', /wk53 &lt;b>tue&lt;\/b> note/.test(R.poster) && !/wk52 tue note/.test(R.poster), '');
  rec('poster escapes job text', !/<img src=x/.test(R.poster) && !R.x, '');
  rec('This week tab prints Wk 52 only', /Wk 52/.test(R.poster0) && /WO-52</.test(R.poster0) && !/WO-53</.test(R.poster0), (R.poster0.match(/<title>[^<]*<\/title>/) || [''])[0]);
  rec('run sheets: Wk 53 in the title, Tue 29 Dec, that day\'s note, no Wk 52 job', /<title>WPF Run Sheets — Wk 53/.test(R.runs) && /Tuesday 29 Dec 2026/.test(R.runs) && /NOTE: wk53 &lt;b>tue&lt;\/b> note/.test(R.runs) && !/WO-52</.test(R.runs), (R.runs.match(/<title>[^<]*<\/title>/) || [''])[0]);
  rec('export: file "WPF_Deliveries_Wk53_2026-12-28.xlsx", Calendar headed Wk 53 with dated days', R.exp && R.exp.n === 'WPF_Deliveries_Wk53_2026-12-28.xlsx' && /^Wk 53/.test(R.exp.cal[0][0]) && R.exp.cal[1][2] === 'Tue 29 Dec', R.exp && JSON.stringify([R.exp.n, R.exp.cal[0], R.exp.cal[1]]));
  const byWos = R.exp ? R.exp.by.slice(1).map(r => r[2] + '@' + r[0]).sort() : [];
  rec('export: only Wk 53 bookings + jobs to plan in Wk 53', byWos.join() === ['WO-53@Tue 2026-12-29', 'WO-53A@Wed 2026-12-30', 'WO-P53@UNPLANNED'].join(), byWos.join(' | '));
  const iO = R.fullH.indexOf('Orig due'), iM = R.fullH.indexOf('Moved ×');
  rec('Full Schedule: "Orig due" and "Moved ×" added at the end', iO === R.fullH.length - 2 && iM === R.fullH.length - 1 && R.full53[iO] === '2026-12-23' && R.full53[iM] === 1 && (R.full52[iM] === undefined || R.full52[iM] === ''), JSON.stringify([R.fullH.slice(-4), R.full53 && R.full53.slice(-4)]));
  rec('Full Schedule: delivery day shows its date', R.full53[R.fullH.indexOf('Delivery Day')] === 'Tue 2026-12-29', R.full53[R.fullH.indexOf('Delivery Day')]);
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
