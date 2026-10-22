// Stage 2 step 2: header row anywhere in the sheet, totals rows skipped, sheets column recognised. Stubbed Supabase only.
// Run: node tests/stage2/header.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference'];
(async () => {
  const browser = await H.chromium.launch();
  const fresh = () => H.open({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', orders: [], nid: 5, settings: {} } });
  let t = await fresh();
  const u = await t.page.evaluate(() => {
    const pre = Array.from({ length: 40 }, (_, i) => ['Report line ' + i]);
    const m = h => { const x = mapFromHeader(h); return x.sheets; };
    return {
      row: findHeaderRow([...pre, ['WO #', 'Title', 'Customer', 'Due Date'], ['WO-1-1', 'a', 'b', 46331]]),
      none: findHeaderRow([['WO-1-1', 'a'], ['WO-1-2', 'b']]),
      sheets: [m(['WO #', 'Due Date', 'No of Sheets ']), m(['WO #', 'Due Date', 'BOARDS']), m(['WO #', 'Due Date', 'Sheet qty (est)']), m(['WO #', 'Due Date', 'Board m2']), m(['WO #', 'Due Date', 'Title'])],
      tot: ['Total', 'TOTAL ', 'Grand total', 'Total WO-1-1', 'Sub-total 12', 'WO-2604-1', '1234', 'wo-77-a1'].map(isTotalsWo)
    };
  });
  rec('AC13 header found on row 41 (whole sheet scanned)', u.row === 40, 'row=' + u.row);
  rec('headerless sheet still returns -1 (column guessing)', u.none === -1, 'row=' + u.none);
  rec('AC26 sheets header: "No of Sheets ", "BOARDS", any header containing sheet/board', JSON.stringify(u.sheets) === JSON.stringify([2, 2, 2, 2, -1]), JSON.stringify(u.sheets));
  rec('AC2 totals WOs recognised; real WOs are not', JSON.stringify(u.tot) === JSON.stringify([true, true, true, true, true, false, false, false]), JSON.stringify(u.tot));
  let r = await H.importAoa(t.page, [...Array.from({ length: 12 }, (_, i) => ['Report line ' + i]), HDR, ['WO-2604-1', 'K', 'C', 46331, '3. In production', 5000, ''], ['Total', '', '', '', '', 5000, '']], { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }] });
  rec('AC13 header on row 13 found through the real import', !!r.plan && !r.pend, r.pend ? 'fell back to mapping screen' : '');
  rec('AC2 totals row not imported', r.plan && r.plan.newOrders.length === 1 && r.plan.newOrders[0].wo === 'WO-2604-1', r.plan && r.plan.newOrders.map(o => o.wo).join());
  await t.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
