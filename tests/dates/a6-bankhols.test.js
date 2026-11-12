// Release "Deliveries weeks" (12 Nov 2026): the Irish bank-holiday list holds the actual holiday days when they fall on a weekend
// (Sat 26 Dec 2026, Sat 25 / Sun 26 Dec 2027) and Mon 3 Jan 2028 (substitute for Sat 1 Jan 2028 — confirmed by Garry 12 Nov), so
// no delivery lands on St Stephen's Day. An ordinary Saturday stays a delivery day (Garry's answer B1).
// Stubbed Supabase only (tests/harness.js + tests/stage1/srv.js). Run: node tests/dates/a6-bankhols.test.js
const H = require('../harness');
const { makeServer, open: openS } = require('../stage1/srv');
const res = [];
const rec = (n, ok, d) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 700) : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const t = await openS(browser, makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [H.order({ wo: 'WO-1', dueDate: '2026-12-22', plannedWeek: '2026-12-21', step: '4. Ready', delv: true })] }), { now: '2026-11-12T10:00:00Z' });
  const r = await t.page.evaluate(() => ({
    del: ['2026-12-26', '2027-12-25', '2027-12-26', '2028-01-03', '2026-12-28', '2027-12-27', '2027-12-28'].map(d => isDelivDay(d)),
    work: ['2026-12-26', '2028-01-03', '2026-12-28'].map(d => isWorkDay(d)),
    sat: isDelivDay('2026-11-21'), sun: isDelivDay('2026-11-22'), satWork: isWorkDay('2026-11-21'),
    fit26: wkFit('2026-12-26', '2026-12-21', '2026-11-12', true).d,
    fit3: wkFit('2028-01-03', '2028-01-03', '2026-11-12', true).d,
    nwd: nextWorkDay('2027-12-31'),
  }));
  rec('1 no delivery day: Sat 26 Dec 2026, Sat 25 / Sun 26 Dec 2027, Mon 3 Jan 2028 and the weekday substitutes', r.del.every(x => x === false), JSON.stringify(r.del));
  rec('2 none of them is a working (build) day either', r.work.every(x => x === false), JSON.stringify(r.work));
  rec('3 an ordinary Saturday is a delivery day (B1), not a build day; Sunday is neither', r.sat === true && r.sun === false && r.satWork === false, JSON.stringify([r.sat, r.sun, r.satWork]));
  rec('4 a delivery moved onto Sat 26 Dec 2026 is fitted earlier in the same week (Thu 24 Dec)', r.fit26 === '2026-12-24', r.fit26);
  rec('5 a delivery moved onto Mon 3 Jan 2028 goes to Tue 4 Jan 2028', r.fit3 === '2028-01-04', r.fit3);
  rec('6 the working day after Fri 31 Dec 2027 is Tue 4 Jan 2028', r.nwd === '2028-01-04', r.nwd);
  await browser.close();
  const f = res.filter(r => !r.ok).length;
  console.log(`\n${res.length - f} pass / ${f} fail`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
