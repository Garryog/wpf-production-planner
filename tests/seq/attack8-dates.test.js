// Tester attack 8 (11 Nov 2026) on feature/project-details-v2 (f4a7719) — the B11 date batch a–c, h, i on the PM sequence page:
// bulk set, spread, push / pull, the one-line knock-on preview, 10-minute Undo, PM home nudges. Goes past s8 / s9 / s10 and
// attack7 part 3 (which already cover the basic happy paths, 25–28 Dec / 1 Jan / 17 Mar, the 14/15 edge on a build date, 360 px).
//   P1  Irish bank holidays — the list in the page vs the rules worked out here (Easter, first Mondays, last Mon Oct,
//       St Brigid's, weekend substitutes) 2026–2028; spread "every Monday" over Easter Monday; push a DELIVERY date by weeks
//       onto Christmas / St Stephen's Day; pull a Monday delivery by a week onto the October bank holiday.
//   P2  fixed-window edges: set a required date so the BUILD date is day 14 vs 15; the window rolling over at midnight
//       between the preview and Save; Settings window changed.
//   P3  jobs on a van (booked / loaded), cut jobs (step 6+ / saw ticks) — preview line, result, Undo "rebook these".
//   P4  Undo: 9:59 vs 10:01; Undo after another PC changed the same job (before and after this screen refreshed);
//       a waiting row changed elsewhere.
//   P5  PM editing another PM's project ("All projects"), nudges for his projects only.
//   P6  two PCs at once on the same waiting row / job.
//   P7  clocks changing (last Sun Oct 2026, last Sun Mar 2027), Sat / Sun week boundaries.
//   P8  phone 360 px: set dialog, result with rebook, Undo result.
// Findings are marked in the check name: [HIGH] / [MEDIUM] / [LOW] with steps, expected vs actual in the comment above it.
// Fake Supabase only (tests/seq/srvs.js on tests/harness.js — never the live one).
// Run: node tests/seq/attack8-dates.test.js            (PARTS=1,2,… to choose)
const X = require('./fixs.js');
const { H, D, DS, rec, sleep } = X;
const PARTS = String(process.env.PARTS || '1,2,3,4,5,6,7,8').split(',');
const P = n => console.log('\n--- ' + n);
const job = (S, wo) => S.row.orders.find(o => o.wo === wo);
const closeDlg = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const pj = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(o => o.wo === wo); return o ? (o.dueDate || '') + '/' + (o.delivDate || '') : 'none'; }, wo);
const tick = (p, ids) => p.evaluate(ids => { document.querySelectorAll('[data-seqtick]').forEach(b => { const on = ids.includes(b.dataset.seqtick); if (b.checked !== on) { b.checked = on; b.onchange(); } }); return document.querySelectorAll('[data-seqtick]').length; }, ids);
const resTxt = p => p.evaluate(() => ([...document.querySelectorAll('.seq-res')].pop() || {}).innerText || ('toast:' + ((document.getElementById('toast') || {}).textContent || '')));
const flush = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = async p => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(300); };
const pmSeq = async (p, pid) => { await p.evaluate(pid => { pmTab = 'seq'; SEQV.pid = pid; render(); }, pid); await sleep(300); };
// one tool, start to finish: tick, open, fill, reason, (save)
async function tool(p, ids, mode, vals, why, save, sel) {
  await p.evaluate(() => document.querySelectorAll('.pod-ovl:not(.seq-ovl)').forEach(x => x.remove()));
  await p.evaluate(() => { render(); if (document.querySelector('.seq-ovl') && SEQ_DLG.draw) SEQ_DLG.draw(); }); await sleep(120);
  await tick(p, ids); await sleep(80);
  const o = await X.dtOpen(p, (sel || '') + '[data-seqtool="' + mode + '"]'); await sleep(200);
  if (o !== 'ok') return { err: o };
  const f = await X.dtFill(p, vals); if (f !== 'ok') return { err: f };
  const pv = await X.dtWhy(p, why || 'Production');
  pv.sug = await p.evaluate(() => (document.querySelector('.seq-dtdlg #sd-sug') || {}).innerText || '');
  pv.btn = await p.evaluate(() => (document.querySelector('.seq-dtdlg #sd-ok') || {}).textContent || '');
  if (save) { await X.dtSave(p); pv.res = await resTxt(p); }
  return pv;
}
const T20 = (wo, unit, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor: 'T20', unit, title: 'HOUSE ' + unit, plannedWeek: '', delv: true }, x));
function mk(mut, opt) {
  const r = X.v2Row();
  r.orders.push(
    T20('WO-V', '1', { dueDate: '2026-11-25', origDueDate: '2026-11-25', delivDate: '2026-11-30', delVeh: 'IVECO', delDay: 'Mon', delWk: '2026-11-30' }), // on a van
    T20('WO-L', '2', { dueDate: '2026-11-25', origDueDate: '2026-11-25', delivDate: '2026-11-30', delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-11-30', delLoadedAt: '2026-10-21T08:00:00Z' }), // loaded
    T20('WO-K', '3', { dueDate: '2026-11-18', origDueDate: '2026-11-18', delivDate: '2026-11-23', plannedWeek: '2026-11-16', step: '6. CUT' }), // cut (step 6)
    T20('WO-T', '4', { dueDate: '2026-11-18', origDueDate: '2026-11-18', delivDate: '2026-11-23', plannedWeek: '2026-11-16', photoDone: { saw: { at: '2026-10-20T10:00:00Z', by: 'Saw' } } }), // saw ticked
    T20('WO-E', '5', { dueDate: '2026-11-10', origDueDate: '2026-11-10', delivDate: '2026-11-13', plannedWeek: '2026-11-09' }) // edge job (day 20)
  );
  if (mut) mut(r);
  const S = X.makeServer(r, opt);
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P2'), { pms: ['Mary Kelly'] });
  X.seqRow(S, 'QC', 'P1', { wo: 'WO-1', floor: 'GF', unit: '12' });
  X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' }); X.seqRow(S, 'QB', 'P1', { wo: 'WO-4', floor: 'T09', unit: '13' });
  X.seqRow(S, 'QV', 'P1', { wo: 'WO-V', floor: 'T20', unit: '1' }); X.seqRow(S, 'QL', 'P1', { wo: 'WO-L', floor: 'T20', unit: '2' });
  X.seqRow(S, 'QK', 'P1', { wo: 'WO-K', floor: 'T20', unit: '3' }); X.seqRow(S, 'QT', 'P1', { wo: 'WO-T', floor: 'T20', unit: '4' });
  X.seqRow(S, 'QE', 'P1', { wo: 'WO-E', floor: 'T20', unit: '5' });
  X.seqRow(S, 'QW', 'P1', { floor: 'T20', unit: '9', product: 'K8', name: 'HOUSE 9', req_date: '2026-12-01' });
  X.seqRow(S, 'Q2', 'P2', { wo: 'WO-6', floor: 'A1', unit: '4' });
  X.seqRow(S, 'Q2W', 'P2', { floor: 'A1', unit: '5', product: 'K1', name: 'TYPE B' }); // Mary's waiting row with no date
  return S;
}

(async () => {
  const browser = await H.chromium.launch();

  // ================================================================================================================ PART 1
  if (PARTS.includes('1')) {
    P('1 Irish bank holidays and the calendar maths');
    const S = mk();
    const of = await X.dev(browser, S, 'office');
    // the rules, worked out here independently
    const iso = d => d.toISOString().slice(0, 10);
    const U = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
    const dow = d => d.getUTCDay();
    const add = (d, n) => new Date(d.getTime() + n * 86400000);
    const firstMon = (y, m) => { let d = U(y, m, 1); while (dow(d) !== 1) d = add(d, 1); return d; };
    const lastMon = (y, m) => { let d = U(y, m + 1, 1); d = add(d, -1); while (dow(d) !== 1) d = add(d, -1); return d; };
    const easter = y => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return U(y, mo, da); };
    const want = [];
    for (const y of [2026, 2027, 2028]) {
      // a fixed-date holiday on a weekend → the next free weekday (as the page already does for 25 / 26 Dec)
      const taken = new Set();
      const fixed = d => { let x = d; while (dow(x) === 0 || dow(x) === 6 || taken.has(iso(x))) x = add(x, 1); taken.add(iso(x)); want.push([iso(x), iso(d) === iso(x) ? 'on the day' : 'for ' + iso(d)]); };
      fixed(U(y, 1, 1));
      const feb1 = U(y, 2, 1); want.push([iso(dow(feb1) === 5 ? feb1 : firstMon(y, 2)), "St Brigid's"]);
      fixed(U(y, 3, 17));
      want.push([iso(add(easter(y), 1)), 'Easter Monday']);
      want.push([iso(firstMon(y, 5)), 'May']); want.push([iso(firstMon(y, 6)), 'June']); want.push([iso(firstMon(y, 8)), 'August']); want.push([iso(lastMon(y, 10)), 'October']);
      fixed(U(y, 12, 25)); fixed(U(y, 12, 26));
    }
    const got = await of.page.evaluate(w => w.map(([d, why]) => [d, why, isWorkDay(d)]), want);
    const miss = got.filter(x => x[2]).map(x => x[0] + ' (' + x[1] + ')');
    // [LOW] 1a — Sat 1 Jan 2028: the list has 2028-01-01 (a Saturday, no effect) but not Mon 3 Jan 2028. Steps: spread / push a job
    // onto Mon 3 Jan 2028. Expected (same rule the page uses for 25/26 Dec at weekends): Mon 3 Jan 2028 is not a working day.
    // Actual: it is treated as a working day. Garry to confirm whether WPF closes that Monday.
    rec('1a [LOW] every Irish bank holiday 2026–2028 (Easter Mon, first Mon Feb/May/Jun/Aug, last Mon Oct, 17 Mar, 25/26 Dec, 1 Jan, weekend substitutes) is not a working day', !miss.length, 'treated as working days: ' + miss.join(', '));
    const extra = await of.page.evaluate(w => IE_BANK_HOLS.filter(d => !w.includes(d) && ![0, 6].includes(new Date(d + 'T12:00:00').getDay())), want.map(x => x[0]));
    rec('1b no weekday in the page\'s list that is not a bank holiday (Good Friday etc. are working days)', !extra.length, extra.join(', '));
    const c = await of.page.evaluate(() => ({
      // spread "every Monday" from Mon 22 Mar 2027 for 3 houses: 22 Mar, Easter Mon 29 Mar → Tue 30 Mar, 5 Apr
      dow: seqSpreadDates([1, 2, 3], '2027-03-22', 'dow', 1, 1),
      // "1 house a week" from the October bank holiday Mon 26 Oct 2026
      nweek: seqSpreadDates([1, 2], '2026-10-26', 'nweek', 1, 1),
      // "every Tuesday" from Sat 13 Mar 2027 → Tue 16, Tue 23 Mar; every Wednesday from 15 Mar 2027 → 17 Mar is St Patrick's → Thu 18 Mar
      tue: seqSpreadDates([1, 2], '2027-03-13', 'dow', 1, 2), wed: seqSpreadDates([1, 2], '2027-03-15', 'dow', 1, 3),
      // 1 per working day from Thu 24 Dec 2026: 24 Dec, 29, 30, 31 Dec, 4 Jan
      wday: seqSpreadDates([1, 2, 3, 4, 5], '2026-12-24', 'wday', 1, 1),
      // working days over the October weekend + bank holiday (and the clock change Sun 25 Oct)
      wd: dmShiftWd('2026-10-23', 1), wdBack: dmShiftWd('2026-10-27', -1),
      // a DELIVERY date by weeks (attack7 fix 4: may stay on a Saturday) — Fri 18 Dec + 1 week = Fri 25 Dec → ?
      dvXmas: seqShift('2026-12-18', 1, 'wk', 1), dvXmas2: seqShift('2026-12-19', 1, 'wk', 1),
      // Mon 2 Nov − 1 week = Mon 26 Oct (bank holiday) → ?
      dvOct: seqShift('2026-11-02', -1, 'wk', 1), buildOct: seqShift('2026-11-02', -1, 'wk'),
      isDel26: isDelivDay('2026-12-26'), isDel27Dec2027: isDelivDay('2027-12-26'),
      // move-to-week on Deliveries for the same Monday delivery (Job A's rule) for comparison
      wkMove: wkMoveTo({ dueDate: '2026-10-28', delivDate: '2026-11-02' }, '2026-10-26'),
    }));
    rec('1c spread "every Monday" over Easter Monday 2027 → 22 Mar, Tue 30 Mar, 5 Apr', c.dow.join() === '2027-03-22,2027-03-30,2027-04-05', c.dow.join());
    rec('1d spread "1 house a week" starting on the October bank holiday → Tue 27 Oct, Mon 2 Nov', c.nweek.join() === '2026-10-27,2026-11-02', c.nweek.join());
    rec('1e spread "every Tuesday" from a Saturday → Tue 16, Tue 23 Mar; "every Wednesday" over St Patrick\'s Day → Thu 18, Wed 24 Mar', c.tue.join() === '2027-03-16,2027-03-23' && c.wed.join() === '2027-03-18,2027-03-24', c.tue.join() + ' | ' + c.wed.join());
    rec('1f spread 1 per working day from Thu 24 Dec 2026 → 24, 29, 30, 31 Dec, 4 Jan', c.wday.join() === '2026-12-24,2026-12-29,2026-12-30,2026-12-31,2027-01-04', c.wday.join());
    rec('1g working days across the clock change + October bank holiday: Fri 23 Oct +1 = Tue 27 Oct, Tue 27 −1 = Fri 23', c.wd === '2026-10-27' && c.wdBack === '2026-10-23', c.wd + ' ' + c.wdBack);
    // [MEDIUM] 1h — St Stephen's Day 2026 is a Saturday. The page lists the substitute Mon 28 Dec but not Sat 26 Dec itself, and a DELIVERY
    // date may be a Saturday (attack7 fix 4) — so isDelivDay('2026-12-26') is true. Steps: PM / office pushes a job with delivery Fri 18 Dec
    // (or Sat 19 Dec) later by 1 week on the sequence page. Expected: delivery Tue 29 Dec (or at least not on St Stephen's Day).
    // Actual: delivery Sat 26 Dec 2026 — St Stephen's Day — with no warning (the 'deliv-bank-hol' flag uses the same isDelivDay).
    // Same for Sun 26 Dec 2027 → not reached (Sunday). Deliveries' week move (Job A wkFit) uses the same isDelivDay.
    rec('1h [MEDIUM] a delivery pushed 1 week onto Christmas / St Stephen\'s (Fri 18 / Sat 19 Dec 2026) never lands on Sat 26 Dec', c.dvXmas !== '2026-12-26' && c.dvXmas2 !== '2026-12-26' && !c.isDel26, JSON.stringify({ dvXmas: c.dvXmas, dvXmas2: c.dvXmas2, isDelivDay26Dec: c.isDel26 }));
    // [LOW] 1i — pull a Monday delivery (Mon 2 Nov) earlier by 1 week: Mon 26 Oct is the bank holiday → the sequence tool goes back to
    // Sat 24 Oct (the week BEFORE). Deliveries' "Move to week" for the same job and week gives Tue 27 Oct (stays in Wk 44).
    // Expected: the same day as Deliveries (Tue 27 Oct), or at least not a Saturday the PM never picked. Actual: Sat 24 Oct.
    rec('1i [LOW] delivery Mon 2 Nov pulled 1 week onto the Oct bank holiday → stays in that week like Deliveries (Tue 27 Oct), not Sat 24 Oct', c.dvOct === c.wkMove.deliv && c.buildOct === '2026-10-23', JSON.stringify({ seq: c.dvOct, deliveries: c.wkMove, buildSeq: c.buildOct }));
    // the same through the page: office pulls WO-M a week; and pushes WO-X (delivery Fri 18 Dec) a week
    await of.close();
    const S2 = mk(r => r.orders.push(T20('WO-M', '6', { dueDate: '2026-12-09', origDueDate: '2026-12-09', delivDate: '2026-12-18' })));
    X.seqRow(S2, 'QM', 'P1', { wo: 'WO-M', floor: 'T20', unit: '6' });
    const o2 = await X.dev(browser, S2, 'office');
    await o2.page.evaluate(() => seqOpen('P1')); await sleep(500);
    const pv = await tool(o2.page, ['QM'], 'push', { 'sd-dir': '1', 'sd-n': '1', 'sd-u': 'wk' }, 'Production', true, '.seq-ovl ');
    await closeDlg(o2.page);
    rec('1j [MEDIUM] office pushes WO-M (build 9 Dec, delivery Fri 18 Dec) 1 week on the sequence page → delivery is not Sat 26 Dec (St Stephen\'s)', !pv.err && /^2026-12-16\//.test(await pj(o2.page, 'WO-M')) && !/2026-12-26$/.test(await pj(o2.page, 'WO-M')), (await pj(o2.page, 'WO-M')) + ' | ' + (pv.prev || pv.err || ''));
    rec('1 no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
    await o2.close();
  }

  // ================================================================================================================ PART 2
  if (PARTS.includes('2')) {
    P('2 fixed-window edges (today Wed 21 Oct 2026, window to Wed 4 Nov)');
    const S = mk();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pmSeq(pm.page, 'P1');
    // required Mon 9 Nov → build Wed 4 Nov (day 14) → asked; required Tue 10 Nov → build Thu 5 Nov (day 15) → made at once
    let pv = await tool(pm.page, ['QE'], 'set', { 'sd-date': '2026-11-09' }, 'Site not ready');
    rec('2a required Mon 9 Nov → build Wed 4 Nov = day 14 → the preview says it goes to the Production Manager (button "✋ Send the request")', /Production Manager/.test(pv.prev) && /Send the request/.test(pv.btn) && /4 Nov/.test(pv.prev + pv.sug), pv.btn + ' | ' + pv.sug + ' | ' + pv.prev);
    pv = await tool(pm.page, ['QE'], 'set', { 'sd-date': '2026-11-10' }, 'Site not ready', true);
    rec('2b required Tue 10 Nov → build Thu 5 Nov = day 15 → changed at once, no request', (await pj(pm.page, 'WO-E')) === '2026-11-05/2026-11-10' && !S.db.t.seq_requests.length, (await pj(pm.page, 'WO-E')) + ' | ' + pv.res);
    // a waiting row is never fixed: set it to tomorrow
    pv = await tool(pm.page, ['QW'], 'set', { 'sd-date': '2026-10-22' }, 'Site not ready', true);
    rec('2c a waiting row (no WO) set to tomorrow: changed at once, never a request (Key question 8)', D.find(S.db, 'project_seq', 'QW').req_date === '2026-10-22' && !S.db.t.seq_requests.length, D.find(S.db, 'project_seq', 'QW').req_date + ' | ' + pv.res);
    // a waiting row pushed into the past by the PM ("earlier by 3 working days" from tomorrow → Fri 16 Oct)
    pv = await tool(pm.page, ['QW'], 'push', { 'sd-dir': '-1', 'sd-n': '3', 'sd-u': 'wd' }, 'Site not ready');
    // [LOW] 2d — a waiting row's date can be pulled into the past with no warning in the preview (jobs get "date is in the past").
    // Steps: tick a waiting row dated tomorrow, ⏩ Push / pull, Earlier 3 working days. Expected: a "⚠ in the past" line. Actual: none.
    rec('2d [LOW] pulling a waiting row into the past (22 Oct − 3 working days → Mon 19 Oct, today is 21 Oct) is warned in the preview', /past/i.test(pv.prev), pv.prev);
    await closeDlg(pm.page);
    // Settings: fixed window changed to 21 days on another PC → this PC's next preview uses 21
    await pm.page.evaluate(() => { DB.seqFixedDays = 21; render(); }); await sleep(100);
    pv = await tool(pm.page, ['QE'], 'set', { 'sd-date': '2026-11-12' }, 'Site not ready');
    rec('2e window set to 21 days: required Thu 12 Nov (build Mon 9 Nov = day 19) → now needs the Production Manager, says "next 21 days"', /21 days/.test(pv.prev) && /Send the request/.test(pv.btn), pv.btn + ' | ' + pv.prev);
    await closeDlg(pm.page); await pm.page.evaluate(() => { DB.seqFixedDays = 14; });
    rec('2 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();

    // the window rolls over at midnight between the preview and Save
    P('2f preview at 23:59:40, Save after midnight (day 15 becomes day 14)');
    const S2 = mk();
    const p2 = await X.dev(browser, S2, 'pm', { me: { pm: 'John Burke' }, now: '2026-10-21T22:59:40Z' }); // Wed 21 Oct 23:59:40 Irish summer time
    await pmSeq(p2.page, 'P1');
    pv = await tool(p2.page, ['QE'], 'set', { 'sd-date': '2026-11-10' }, 'Site not ready');
    const before = { btn: pv.btn, prev: pv.prev, today: await p2.page.evaluate(() => todayLocal()) };
    let today = before.today; const t0 = Date.now();
    while (today === '2026-10-21' && Date.now() - t0 < 60000) { await sleep(1000); today = await p2.page.evaluate(() => todayLocal()); }
    await X.dtSave(p2.page); const r2 = await resTxt(p2.page);
    const afterJob = await pj(p2.page, 'WO-E');
    rec('2f before midnight the preview says "Save dates" (day 15, free)', /Save dates/.test(before.btn) && !/Production Manager/.test(before.prev), JSON.stringify(before));
    rec('2f Save after midnight (today ' + today + '): build Thu 5 Nov is now day 14 → NOT made directly by the PM; one request instead', afterJob === '2026-11-10/2026-11-13' && S2.db.t.seq_requests.filter(q => q.status === 'open').length === 1, afterJob + ' | requests ' + JSON.stringify(S2.db.t.seq_requests.map(q => q.status)) + ' | ' + r2);
    rec('2f no page errors', !(S2.errors || []).length, JSON.stringify(S2.errors));
    await p2.close();
  }

  // ================================================================================================================ PART 3
  if (PARTS.includes('3')) {
    P('3 jobs on a van, loaded, cut (step 6), saw-ticked — preview line, result, history, Undo');
    const S = mk();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pmSeq(pm.page, 'P1');
    let pv = await tool(pm.page, ['QV', 'QL', 'QK', 'QT'], 'push', { 'sd-dir': '1', 'sd-n': '1', 'sd-u': 'wk' }, 'Customer delay');
    rec('3a one-line preview BEFORE Save: "4 jobs change, 1 job comes off its van, 1 already loaded — flagged, 2 already cut — flagged"', /4 jobs change/.test(pv.line) && /1 job comes off its van/.test(pv.line) && /1 already loaded/.test(pv.line) && /2 already cut/.test(pv.line), pv.line);
    rec('3b preview rows: WO-V "off IVECO … — rebook", WO-L "already loaded — stays on the van", WO-K / WO-T "already cut — build week kept"', /WO-V[\s\S]*off [\s\S]*rebook/.test(pv.prev) && /WO-L[\s\S]*already loaded/.test(pv.prev) && (pv.prev.match(/already cut/g) || []).length >= 2, pv.prev);
    await X.dtSave(pm.page); const rt = await resTxt(pm.page); await closeDlg(pm.page);
    const g = await pm.page.evaluate(() => Object.fromEntries(['WO-V', 'WO-L', 'WO-K', 'WO-T'].map(w => { const o = DB.orders.find(o => o.wo === w); return [w, { due: o.dueDate, dv: o.delivDate, wk: o.plannedWeek, veh: o.delVeh || '', reb: !!o.delRebook, mv: !!o.dueMv }]; })));
    rec('3c WO-V moved a week (2 / 7 Dec), off its van, "rebook" set', g['WO-V'].due === '2026-12-02' && g['WO-V'].dv === '2026-12-07' && !g['WO-V'].veh && g['WO-V'].reb, JSON.stringify(g['WO-V']));
    rec('3d WO-L (loaded) moved but left on VOLVO, flagged to check', g['WO-L'].due === '2026-12-02' && g['WO-L'].veh === 'VOLVO' && g['WO-L'].mv, JSON.stringify(g['WO-L']));
    rec('3e cut jobs (step 6 and saw-ticked): build date moved, planned week KEPT (Wk of 16 Nov), "check week" mark', ['WO-K', 'WO-T'].every(w => g[w].due === '2026-11-25' && g[w].wk === '2026-11-16' && g[w].mv), JSON.stringify([g['WO-K'], g['WO-T']]));
    rec('3f result says rebook WO-V and lists the cut / loaded jobs to check', /rebook/i.test(rt) && /WO-V/.test(rt) && /WO-K/.test(rt) && /WO-T/.test(rt) && /WO-L/.test(rt), rt);
    // Undo: dates back, NOT back on the van — "Rebook these"
    await pm.page.evaluate(() => render()); await sleep(100);
    await pm.page.evaluate(() => document.querySelector('#seq-undo').click()); await sleep(1500);
    const ut = await resTxt(pm.page); await closeDlg(pm.page);
    const u = await pm.page.evaluate(() => Object.fromEntries(['WO-V', 'WO-L', 'WO-K', 'WO-T'].map(w => { const o = DB.orders.find(o => o.wo === w); return [w, { due: o.dueDate, dv: o.delivDate, wk: o.plannedWeek, veh: o.delVeh || '' }]; })));
    rec('3g ↶ Undo: all four dates back (25 / 30 Nov, 18 / 23 Nov), cut jobs still in Wk of 16 Nov', u['WO-V'].due === '2026-11-25' && u['WO-V'].dv === '2026-11-30' && u['WO-K'].due === '2026-11-18' && u['WO-K'].wk === '2026-11-16' && u['WO-T'].wk === '2026-11-16', JSON.stringify(u));
    rec('3h Undo says "Rebook these" WO-V — not put back on the van; WO-L still on VOLVO', /Rebook these/.test(ut) && /WO-V/.test(ut) && !u['WO-V'].veh && u['WO-L'].veh === 'VOLVO', ut);
    await flush(pm.page);
    const hv = (job(S, 'WO-V').dueHist || []).map(h => h.f + ':' + h.from + '>' + h.to + ':' + h.src);
    rec('3i history of WO-V: the push (pmseq) and the undo (undo) both recorded, due and delivery', hv.filter(x => /pmseq/.test(x)).length === 2 && hv.filter(x => /undo/.test(x)).length === 2, JSON.stringify(hv));
    rec('3 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }

  // ================================================================================================================ PART 4
  if (PARTS.includes('4')) {
    P('4 Undo: 9:59 vs 10:01, another PC changed the same job, a waiting row changed elsewhere');
    {
      const S = mk();
      const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
      await pmSeq(pm.page, 'P1');
      await tool(pm.page, ['QA'], 'set', { 'sd-date': '2026-12-10' }, 'Site not ready', true); await closeDlg(pm.page);
      await pm.page.evaluate(() => { SEQ_UNDO.at = Date.now() - 599000; render(); }); await sleep(100);
      const b = await pm.page.evaluate(() => (document.querySelector('#seq-undo') || {}).textContent || '');
      await pm.page.evaluate(() => document.querySelector('#seq-undo').click()); await sleep(1200); await closeDlg(pm.page);
      rec('4a at 9 min 59 s: "↶ Undo (1 min)" shown and it works (WO-3 back to 3 Dec, no delivery date)', /Undo \(1 min\)/.test(b) && (await pj(pm.page, 'WO-3')) === '2026-12-03/', b + ' ' + (await pj(pm.page, 'WO-3')));
      await tool(pm.page, ['QA'], 'set', { 'sd-date': '2026-12-10' }, 'Site not ready', true); await closeDlg(pm.page);
      await pm.page.evaluate(() => render()); await sleep(100);
      await pm.page.evaluate(() => { SEQ_UNDO.at = Date.now() - 601000; }); // the button is still on the screen (no redraw since)
      await pm.page.evaluate(() => document.querySelector('#seq-undo').click()); await sleep(800);
      const t = await pm.page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
      rec('4b at 10 min 01 s: tapping the Undo still on the screen → "no longer available", nothing put back, button gone', /no longer available/.test(t) && (await pj(pm.page, 'WO-3')) === '2026-12-07/2026-12-10' && !(await pm.page.evaluate(() => !!document.querySelector('#seq-undo'))), t + ' ' + (await pj(pm.page, 'WO-3')));
      rec('4 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await pm.close();
    }
    for (const refreshed of [false, true]) {
      const tag = refreshed ? ' (after this screen refreshed)' : ' (this screen NOT refreshed yet)';
      const S = mk();
      const a = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
      await pmSeq(a.page, 'P1');
      await tool(a.page, ['QA'], 'set', { 'sd-date': '2026-12-10' }, 'Site not ready', true); await closeDlg(a.page); await flush(a.page);
      // PC B (the office) moves the same job on Deliveries' engine: delivery 17 Dec, build 14 Dec
      const b = await X.dev(browser, S, 'office');
      await b.page.evaluate(() => { moveDates(['WO-3'], { per: { 'WO-3': { deliv: '2026-12-17', due: '2026-12-14' } } }, { why: 'Customer delay' }, 'Ann Office', { src: 'planner' }).apply(); });
      await flush(b.page); await b.close();
      const mid = job(S, 'WO-3').dueDate + '/' + job(S, 'WO-3').delivDate;
      if (refreshed) await reload(a.page);
      await pmSeq(a.page, 'P1');
      const has = await a.page.evaluate(() => !!document.querySelector('#seq-undo'));
      if (has) { await a.page.evaluate(() => document.querySelector('#seq-undo').click()); await sleep(1500); }
      const ut = await resTxt(a.page); await closeDlg(a.page); await flush(a.page); await sleep(300);
      const fin = job(S, 'WO-3').dueDate + '/' + job(S, 'WO-3').delivDate;
      // [HIGH] 4c — Steps: PM sets WO-3 required 10 Dec on PC A; the office moves WO-3 to 14 / 17 Dec on PC B and it saves;
      // PC A (its 45 s refresh not come yet) taps ↶ Undo. Expected: the office's later 14 / 17 Dec is kept and A is told "changed since —
      // left as it is". (Plan Q18: "refused for a job changed since".)
      // Actual (f4a7719, NOT refreshed): Undo checks only this screen's old copy, so it puts the build date back to 3 Dec over the office's
      // 14 Dec (the save merge keeps this screen's value: toast "dueDate on WO-3 was also changed by … — kept 2026-12-03") while the
      // office's delivery 17 Dec stays → the job ends up build 3 Dec / delivery 17 Dec, a mix nobody chose. After a refresh it is right.
      // seqUndo should re-read the planner first (as approving a request already does — b7d24d8) before deciding "changed since".
      rec((tag.includes('NOT') ? '[HIGH] ' : '') + '4c Undo after another PC changed the same job' + tag + ': the other PC\'s 14 / 17 Dec is kept (in the database), Undo says "changed since"', mid === '2026-12-14/2026-12-17' && fin === '2026-12-14/2026-12-17' && /Changed since/i.test(ut), JSON.stringify({ has, mid, fin, ut }));
      rec('4c no page errors' + tag, !(S.errors || []).length, JSON.stringify(S.errors));
      await a.close();
    }
    {
      // waiting row changed elsewhere (version moved) → Undo leaves it and says so
      const S = mk();
      const a = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
      await pmSeq(a.page, 'P1');
      await tool(a.page, ['QW'], 'set', { 'sd-date': '2026-12-08' }, 'Site not ready', true); await closeDlg(a.page);
      DS.seqUpdate(S.db, D.find(S.db, 'project_seq', 'QW'), { req_date: '2026-12-15', updated_by: 'Mary Kelly' }, false); // another PC
      await a.page.evaluate(() => document.querySelector('#seq-undo') && document.querySelector('#seq-undo').click()); await sleep(1500);
      const ut = await resTxt(a.page);
      rec('4d Undo of a waiting row changed on another PC (not yet seen here): the other PC\'s 15 Dec kept, Undo says so', D.find(S.db, 'project_seq', 'QW').req_date === '2026-12-15' && /Changed since|changed on another|look again/i.test(ut), D.find(S.db, 'project_seq', 'QW').req_date + ' | ' + ut);
      rec('4d no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await a.close();
    }
  }

  // ================================================================================================================ PART 5
  if (PARTS.includes('5')) {
    P('5 a PM on another PM\'s project; nudges');
    const S = mk();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = ''; PMALL = false; render(); }); await sleep(200);
    const n1 = await pm.page.evaluate(() => (document.querySelector('.seq-nudge') || {}).innerText || '');
    rec('5a John\'s nudges cover only his project (Mary\'s waiting row with no date is not counted)', !/row with no date|rows with no date/.test(n1), n1);
    await pm.page.evaluate(() => { PMALL = true; render(); }); await sleep(200);
    const n2 = await pm.page.evaluate(() => (document.querySelector('.seq-nudge') || {}).innerText || '');
    // [LOW] 5b — with "☐ All projects" ticked (read-only view of other PMs' projects) John's nudge bar counts Mary's rows too
    // ("1 row with no date"), and tapping it opens a project he can't change. Expected: nudges are about HIS projects only.
    rec('5b [LOW] with "All projects" ticked the nudges still count only John\'s own projects', !/row with no date|rows with no date/.test(n2), n2);
    await pm.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P2'; render(); }); await sleep(300);
    const ro = await pm.page.evaluate(() => ({ ticks: document.querySelectorAll('[data-seqtick]').length, tools: document.querySelectorAll('[data-seqtool],[data-seqdate]').length, undo: !!document.querySelector('#seq-undo'), sel: (document.querySelector('#seq-proj option:checked') || {}).textContent || '' }));
    rec('5c Mary\'s project opened by John: "(read-only)", no tick boxes, no date buttons, no tools', /read-only/.test(ro.sel) && !ro.ticks && !ro.tools && !ro.undo, JSON.stringify(ro));
    const forced = await pm.page.evaluate(async () => { const n = document.querySelectorAll('.seq-dtdlg').length; seqDateDlg('P2', ['Q2'], 'set', () => {}); await new Promise(r => setTimeout(r, 200)); return { dlg: document.querySelectorAll('.seq-dtdlg').length - n, toast: (document.getElementById('toast') || {}).textContent || '' }; });
    rec('5d forcing the date tool on Mary\'s project from John\'s screen → refused "Read-only", no dialog', !forced.dlg && /Read-only/.test(forced.toast), JSON.stringify(forced));
    // Undo recorded on P1, then John switches to P2: no Undo there; back on P1 it is still there
    await pmSeq(pm.page, 'P1'); await pm.page.evaluate(() => { PMALL = true; });
    await tool(pm.page, ['QA'], 'set', { 'sd-date': '2026-12-11' }, 'Site not ready', true); await closeDlg(pm.page);
    await pmSeq(pm.page, 'P2'); const u2 = await pm.page.evaluate(() => !!document.querySelector('#seq-undo'));
    await pmSeq(pm.page, 'P1'); const u1 = await pm.page.evaluate(() => !!document.querySelector('#seq-undo'));
    rec('5e Undo only on the project it belongs to (not on Mary\'s), still there on his own', !u2 && u1, JSON.stringify({ u2, u1 }));
    // the office removes John from P1 on another PC → after the refresh his screen is read-only
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['Mary Kelly'], updated_by: 'Ann Office' });
    await reload(pm.page); await pmSeq(pm.page, 'P1');
    const lost = await pm.page.evaluate(() => ({ can: seqCanEdit('P1'), ticks: document.querySelectorAll('[data-seqtick]').length, undo: !!document.querySelector('#seq-undo') }));
    rec('5f John taken off P1 on another PC: after the refresh P1 is read-only for him (no ticks, no Undo)', !lost.can && !lost.ticks && !lost.undo, JSON.stringify(lost));
    rec('5 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }

  // ================================================================================================================ PART 6
  if (PARTS.includes('6')) {
    P('6 two PCs at once');
    const S = mk();
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke', 'Mary Kelly'] });
    const a = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    const b = await X.dev(browser, S, 'pm', { me: { pm: 'Mary Kelly' } });
    await pmSeq(a.page, 'P1'); await pmSeq(b.page, 'P1');
    // both open "set" on the same waiting row before either saves
    const pa = await tool(a.page, ['QW'], 'set', { 'sd-date': '2026-12-08' }, 'Site not ready');
    const pb = await tool(b.page, ['QW'], 'set', { 'sd-date': '2026-12-15' }, 'Customer delay');
    await X.dtSave(a.page); const ra = await resTxt(a.page);
    await X.dtSave(b.page); const rb = await resTxt(b.page);
    rec('6a same waiting row from two PCs: the first (8 Dec) is kept, the second is told "Not saved (changed on another screen)"', D.find(S.db, 'project_seq', 'QW').req_date === '2026-12-08' && /Not saved/.test(rb), D.find(S.db, 'project_seq', 'QW').req_date + ' | A: ' + ra + ' | B: ' + rb);
    await closeDlg(a.page); await closeDlg(b.page);
    // both push the same free job by 3 working days within a second
    await tool(a.page, ['QA'], 'push', { 'sd-dir': '1', 'sd-n': '3', 'sd-u': 'wd' }, 'Production');
    await tool(b.page, ['QA'], 'push', { 'sd-dir': '1', 'sd-n': '3', 'sd-u': 'wd' }, 'Production');
    await X.dtSave(a.page); await X.dtSave(b.page); await flush(a.page); await flush(b.page); await sleep(500);
    await reload(a.page); await reload(b.page);
    const fa = await pj(a.page, 'WO-3'), fb = await pj(b.page, 'WO-3'), fdb = job(S, 'WO-3').dueDate;
    const hist = (job(S, 'WO-3').dueHist || []).filter(h => h.f === 'due').map(h => h.from + '>' + h.to + ' ' + h.by);
    rec('6b same push from two PCs at once: both PCs and the database agree (build 3 → 8 Dec), history shows the move once (identical repeat tidied)', fa === fb && fdb === '2026-12-08' && /^2026-12-08/.test(fa) && hist.length === 1, JSON.stringify({ fa, fb, fdb, hist }));
    // one PC sends a request for a fixed job, the other tries the same job a moment later
    await pmSeq(a.page, 'P1'); await pmSeq(b.page, 'P1');
    await tool(a.page, ['QC'], 'push', { 'sd-dir': '1', 'sd-n': '1', 'sd-u': 'wd' }, 'Production');
    await tool(b.page, ['QC'], 'push', { 'sd-dir': '1', 'sd-n': '2', 'sd-u': 'wd' }, 'Production');
    await X.dtSave(a.page); await X.dtSave(b.page); const rb2 = await resTxt(b.page);
    rec('6c two PCs ask for the same fixed job: ONE open request; the second is told in plain words (not sent / already waiting)', S.db.t.seq_requests.filter(q => q.status === 'open').length === 1 && /NOT sent|Already waiting|already/i.test(rb2), JSON.stringify(S.db.t.seq_requests.map(q => q.status)) + ' | ' + rb2);
    rec('6 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await b.close();
  }

  // ================================================================================================================ PART 7
  if (PARTS.includes('7')) {
    P('7 clocks changing and Sat / Sun week edges (Europe/Dublin)');
    const cases = [
      // [label, NOW (UTC), expected today, a build date that must be fixed (day 14), one that must be free (day 15)]
      ['Sun 25 Oct 2026 01:30 IST (just before clocks go back)', '2026-10-25T00:30:00Z', '2026-10-25', '2026-11-08', '2026-11-09'],
      ['Sun 25 Oct 2026 23:30 GMT (after clocks went back)', '2026-10-25T23:30:00Z', '2026-10-25', '2026-11-08', '2026-11-09'],
      ['Mon 26 Oct 2026 00:30 GMT (bank holiday)', '2026-10-26T00:30:00Z', '2026-10-26', '2026-11-09', '2026-11-10'],
      ['Sat 27 Mar 2027 23:30 GMT (night before clocks go forward)', '2027-03-27T23:30:00Z', '2027-03-27', '2027-04-10', '2027-04-11'],
      ['Mon 29 Mar 2027 00:30 IST (Easter Monday, after clocks went forward)', '2027-03-28T23:30:00Z', '2027-03-29', '2027-04-12', '2027-04-13'],
      ['Sat 24 Oct 2026 12:00', '2026-10-24T11:00:00Z', '2026-10-24', '2026-11-07', '2026-11-08'],
      ['Sun 1 Nov 2026 23:59 GMT', '2026-11-01T23:59:00Z', '2026-11-01', '2026-11-15', '2026-11-16'],
    ];
    const S = mk();
    for (const [lbl, now, today, fx, fr] of cases) {
      const p = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' }, now });
      const r = await p.page.evaluate(({ fx, fr }) => ({ today: todayLocal(), fx: seqFixedAt({ dueDate: fx }), fr: seqFixedAt({ dueDate: fr }), wk: get8Wks()[0] }), { fx, fr });
      rec('7 ' + lbl + ': today ' + today + ', build ' + fx + ' fixed, ' + fr + ' free', r.today === today && r.fx && !r.fr, JSON.stringify(r));
      await p.close();
    }
    // Undo straddling the clock change: change at Sun 25 Oct 01:55 IST, Undo 10 real minutes later is refused, 9 min fine
    const p = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' }, now: '2026-10-25T00:55:00Z' });
    await pmSeq(p.page, 'P1');
    await tool(p.page, ['QW'], 'set', { 'sd-date': '2026-12-02' }, 'Site not ready', true); await closeDlg(p.page);
    const u = await p.page.evaluate(() => ({ left: Math.round(seqUndoLeft('P1') / 1000), btn: (document.querySelector('#seq-undo') || {}).textContent || '' }));
    rec('7b Undo made at 01:55 IST on the clock-change night: 10 minutes left (not 0, not 70)', u.left > 590 && u.left <= 600, JSON.stringify(u));
    // spread from a Saturday, push from a Saturday waiting date
    const sp = await p.page.evaluate(() => ({ sat: seqSpreadDates([1, 2], '2026-10-31', 'nweek', 1, 1), satW: seqSpreadDates([1, 2], '2026-10-31', 'wday', 1, 1), fwd: dmShiftWd('2026-10-31', 1), back: dmShiftWd('2026-10-31', -1), wk: seqShift('2026-10-31', 1, 'wk') }));
    rec('7c from Sat 31 Oct: spread 1/week → Mon 2 Nov, Mon 9 Nov; 1/working day → 2, 3 Nov; +1 wd = Mon 2 Nov; −1 wd = Fri 30 Oct; waiting row +1 wk = Mon 9 Nov', sp.sat.join() === '2026-11-02,2026-11-09' && sp.satW.join() === '2026-11-02,2026-11-03' && sp.fwd === '2026-11-02' && sp.back === '2026-10-30' && sp.wk === '2026-11-09', JSON.stringify(sp));
    rec('7 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await p.close();
  }

  // ================================================================================================================ PART 8
  if (PARTS.includes('8')) {
    P('8 phone 360 px');
    const S = mk();
    X.seqRow(S, 'QN', 'P1', { floor: 'T20', unit: '10', product: 'K8', name: 'HOUSE 10' }); // no date → a nudge
    const ph = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' }, viewport: { width: 360, height: 740 } });
    await pmSeq(ph.page, 'P1');
    const fit = () => ph.page.evaluate(() => { const bad = []; document.querySelectorAll('.pod-ovl .pod-in, .pod-ovl button, .pod-ovl input, .pod-ovl select').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.left < -1 || r.right > innerWidth + 1)) bad.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); }); return { bad, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    let pv = await tool(ph.page, ['QV', 'QK'], 'set', { 'sd-date': '2026-12-09' }, 'Customer delay');
    const f1 = await fit();
    const okb = await ph.page.evaluate(() => { const b = document.querySelector('.seq-dtdlg #sd-ok'); b.scrollIntoView(); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), vis: r.top >= 0 && r.bottom <= innerHeight + 1 }; });
    rec('8a set dialog at 360 px: everything inside the screen, Save reachable and ≥ 44 px, preview line shown', !f1.bad.length && f1.sw <= f1.cw + 1 && okb.h >= 44 && okb.vis && /comes off its van/.test(pv.line), JSON.stringify({ f1, okb, line: pv.line }));
    await X.dtSave(ph.page); const f2 = await fit(); const rt = await resTxt(ph.page);
    rec('8b result dialog (rebook + already cut) fits at 360 px', !f2.bad.length && f2.sw <= f2.cw + 1 && /rebook/i.test(rt), JSON.stringify(f2) + ' | ' + rt.slice(0, 200));
    await closeDlg(ph.page); await ph.page.evaluate(() => render()); await sleep(150);
    await ph.page.evaluate(() => document.querySelector('#seq-undo').click()); await sleep(1500);
    const f3 = await fit(); const ut = await resTxt(ph.page);
    rec('8c Undo result ("Rebook these") fits at 360 px', !f3.bad.length && f3.sw <= f3.cw + 1 && /Rebook these/.test(ut), JSON.stringify(f3) + ' | ' + ut.slice(0, 200));
    await closeDlg(ph.page);
    // nudge buttons on the phone home screen
    await ph.page.evaluate(() => { pmTab = ''; render(); }); await sleep(200);
    const nb = await ph.page.evaluate(() => { const b = [...document.querySelectorAll('.seq-nb')]; return { n: b.length, minH: b.length ? Math.min(...b.map(x => Math.round(x.getBoundingClientRect().height))) : 0, out: b.filter(x => x.getBoundingClientRect().right > innerWidth + 1).length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    rec('8d nudges on the phone: tappable (≥ 32 px), none off the screen, no sideways scroll', nb.n > 0 && nb.minH >= 32 && !nb.out && nb.sw <= nb.cw + 1, JSON.stringify(nb));
    rec('8 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await ph.close();
  }

  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
