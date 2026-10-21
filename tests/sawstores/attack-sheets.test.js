// Tester attack: "Sheets needed" panel with messy Cienapps-style lists, hand-checked maths, date edges, speed.
// Stubbed Supabase only (tests/stage1/srv.js). Run: node tests/sawstores/attack-sheets.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = (rows, due, extra = {}) => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: due, origDueDate: due })],
  settings: Object.assign({ lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: rows.filter(r => r.k === 'saw').length, fit: 0, wos: ['WO-1'], up: '2026-10-20T09:00:00Z' }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: rows } } } }, extra) });
const need = (page, from, to) => page.evaluate(({ from, to }) => { const t = todayLocal(); return sheetNeed(lists(), from === null ? '' : from, to || t, { cutSince: t }); }, { from, to });

(async () => {
  const browser = await H.chromium.launch();
  // ---------- 1. Real xlsx through the app's own parser (parseListWorkbook) — messy cells ----------
  {
    const S = makeServer(base([{ k: 'saw', item: 'x', qty: 1, L: 1, W: 1, mat: 'a' }], '2026-10-22'));
    const A = await open(browser, S, { now: '2026-10-21T09:00:00Z' });
    const parsed = await A.page.evaluate(() => {
      const aoa = [
        ['Proj X', null, null, null, null, null],
        ['Item', 'Qty', 'Length', 'Width', 'Material', 'Note'],
        ['Side mm-suffix', 2, '2400mm', '600mm', 'MFC White', ''],       // text with units
        ['Side metres', 2, 2.4, 0.6, 'MFC White', ''],                   // metres
        ['Size in one cell', 2, '2400 x 600', null, 'MFC White', ''],    // both dims in one cell
        ['Blank qty', null, 2400, 600, 'MFC White', ''],                  // qty forgotten
        ['Qty 4 off', '4 off', 2400, 600, 'MFC White', ''],
        ['Trailing spaces', 1, 2400, 600, '  mfc white   ', ''],
        ['Thousands comma', 1, '1,200', 600, 'MFC White', ''],          // text "1,200"
        ['Qty 2x2', '2x2', 1000, 500, 'MFC White', ''],                  // means 4
        ['cm by mistake', 1, 240, 60, 'MFC White', ''],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'H1');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      return parseListWorkbook(new Uint8Array(buf)).wb.sheets.H1;
    });
    const by = n => parsed.find(r => r.item === n) || {};
    console.log('parsed:', JSON.stringify(parsed.map(r => [r.k, r.item, r.qty, r.L, r.W, r.mat])));
    rec('blank qty line is NOT silently turned into a section header (would vanish from sheet count with no warning)', by('Blank qty').k === 'saw', 'k=' + by('Blank qty').k);
    rec('"2x2" qty not silently read as 2', by('Qty 2x2').qty !== 2, 'qty=' + by('Qty 2x2').qty);
    // run sheetNeed on exactly what the parser produced
    await A.page.evaluate(rows => { DB.listWBs.W1.sheets.H1 = rows; lists()[0].saw = rows.filter(r => r.k === 'saw').length; }, parsed);
    const r = await need(A.page, null);
    console.log('need:', JSON.stringify(r));
    const w = r.mats.find(m => m.mat.toLowerCase() === 'mfc white') || {};
    rec('trailing spaces / case → one material group', r.mats.filter(m => m.mat.toLowerCase().trim() === 'mfc white').length === 1, JSON.stringify(r.mats.map(m => m.mat)));
    rec('"2400 x 600" in one cell → warned (no size), not counted', r.noSize >= 1);
    rec('metres / "1,200" text → check-units warning shown', w.check === true);
    rec('blank-qty line is warned about ("no quantity") rather than vanishing', r.noQty >= 1, 'noQty=' + r.noQty);
    await A.close();
  }
  // ---------- 2. Hand-checked maths (3 cases) ----------
  {
    const rows = [
      { k: 'saw', item: 'a', qty: 3, L: 2000, W: 500, mat: 'Oak' },   // 3.00 m²
      { k: 'saw', item: 'b', qty: 1, L: 2760, W: 1830, mat: 'Oak ' }, // 5.0508 m² → total 8.0508 → /5.75*1.1 = 1.5401 → 2
      { k: 'saw', item: 'c', qty: 10, L: 575, W: 1000, mat: 'Grey' }, // 5.75 m² → 1.1 → 2 (exactly 1 board +10% = 2)
      { k: 'saw', item: 'd', qty: 50, L: 1150, W: 500, mat: 'Ply' },  // 28.75 m² → 5*1.1 = 5.5 → 6
      { k: 'saw', item: 'e', qty: 1, L: 5000, W: 5750 / 5.5 * 1, mat: 'Edge' }, // 5.2272.. m² → 1.0000 → 1 (boundary)
    ];
    const S = makeServer(base(rows, '2026-10-21'));
    const A = await open(browser, S, { now: '2026-10-21T09:00:00Z' });
    const r = await need(A.page, null);
    const g = n => r.mats.find(m => m.mat.trim().toLowerCase() === n) || {};
    rec('hand: Oak 3.00+5.05=8.05 m² → 2 sheets', g('oak').m2 === 8.05 && g('oak').sheets === 2, JSON.stringify(g('oak')));
    rec('hand: Grey exactly 5.75 m² → 1.1 boards → 2 sheets', g('grey').sheets === 2, JSON.stringify(g('grey')));
    rec('hand: Ply 28.75 m² → 5.5 → 6 sheets', g('ply').sheets === 6, JSON.stringify(g('ply')));
    rec('hand: exactly 1.000 board after +10% → 1 sheet (no float creep to 2)', g('edge').sheets === 1, JSON.stringify(g('edge')));
    // float-creep scan: area such that m2/5.75*1.1 is an exact integer n — must give n, not n+1
    const creep = await A.page.evaluate(() => { const bad = []; for (let n = 1; n <= 200; n++) { const m2 = n * 5.75 / 1.1; const s = Math.ceil(m2 / SHEET_M2 * (1 + SHEET_WASTE) - 1e-9); if (s !== n) bad.push(n + '→' + s); } return bad; });
    rec('no float creep for exact multiples 1..200', !creep.length, creep.join(','));
    await A.close();
  }
  // ---------- 3. Holds, ticks, overdue, done lists ----------
  {
    const rows = [
      { k: 'saw', item: 'a', qty: 1, L: 2875, W: 2000, mat: 'M' }, // 5.75
      { k: 'saw', item: 'b', qty: 1, L: 2875, W: 2000, mat: 'M', note: 'held' },
    ];
    const r0 = base(rows, '2026-10-10'); // overdue by 10 days
    const S = makeServer(r0);
    const A = await open(browser, S, { now: '2026-10-21T09:00:00Z', role: 'saw' });
    const o = await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); const t = todayLocal(); const a = sheetNeed(lists(), '', t, { cutSince: t }).mats[0].m2;
      holdRows(l, [k[1]], 'saw', 'T'); const b = sheetNeed(lists(), '', t, { cutSince: t }).mats[0].m2;
      releaseHolds([{ l, k: k[1] }], 'T'); const c = sheetNeed(lists(), '', t, { cutSince: t }).mats[0].m2;
      return { a, b, c }; });
    rec('overdue list counted in today; held line excluded; released line back in', o.a === 11.5 && o.b === 5.75 && o.c === 11.5, JSON.stringify(o));
    // list signed off yesterday, one row released today → only that row counts
    const o2 = await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); DB.listDone = { L1: { saw: { at: '2026-10-20T10:00:00Z', by: 'x' } } }; const t = todayLocal(); return sheetNeed(lists(), '', t, { cutSince: t }).mats.map(m => m.m2); });
    rec('signed-off yesterday + 1 released row → only the released row counts', JSON.stringify(o2) === '[5.75]', JSON.stringify(o2));
    // N/A then whole-row tick on same line (clash data) → counts as cut-today
    const o3 = await A.page.evaluate(() => { DB.listDone = {}; DB.listHold = {}; const l = lists()[0], k = listRows(l).map(rowKey); holdRows(l, [k[0]], 'saw', 'B'); DB.listRow = { L1: { [k[0]]: { m: 'saw', at: '2026-10-19T10:00:00Z', by: 'A' } } }; DB.listHold.L1[k[0]].st = 'hold'; const t = todayLocal(); return sheetNeed(lists(), '', t, { cutSince: t }).mats.map(m => m.m2); });
    rec('ticked-earlier + stale hold (clash) → not counted', JSON.stringify(o3) === '[5.75]', JSON.stringify(o3));
    // the panel ignores the customer filter — informational
    await A.close();
  }
  // ---------- 4. Dates: Fri→Mon, Saturday, bank holiday, year end ----------
  {
    const S = makeServer(base([{ k: 'saw', item: 'a', qty: 1, L: 1000, W: 1000, mat: 'M' }], '2026-10-27'));
    const A = await open(browser, S, { now: '2026-10-23T09:00:00Z' });
    const d = await A.page.evaluate(() => ({ fri: nextWorkDay('2026-10-23'), sat: nextWorkDay('2026-10-24'), ye: nextWorkDay('2026-12-31'), bh: nextWorkDay('2026-10-23'), xmas: nextWorkDay('2026-12-24'), dst: addDayISO('2026-10-24', 1) + ',' + addDayISO('2026-03-28', 1) }));
    rec('year end Thu 31 Dec → Fri 1 Jan', d.ye === '2027-01-01', d.ye);
    rec('DST weekend addDayISO stays on calendar days', d.dst === '2026-10-25,2026-03-29', d.dst);
    rec('Bank holiday Mon 26 Oct 2026 (Oct BH) skipped: Fri → Tue 27', d.bh === '2026-10-27', 'got ' + d.bh + ' — app has no bank-holiday list');
    rec('Christmas Eve Thu → next working day not Christmas Day', d.xmas !== '2026-12-25', 'got ' + d.xmas);
    // Panel on Friday: list cut-by Mon 26 (delivers Tue 27). On a bank-holiday weekend this work actually needs doing TODAY (Fri).
    const p = await A.page.evaluate(() => { const t = todayLocal(), nx = nextWorkDay(t); return { today: sheetNeed(lists(), '', t, { cutSince: t }).lines, next: sheetNeed(lists(), addDayISO(t, 1), nx, { cutSince: t }).lines }; });
    console.log('Fri 23 Oct panel (list cut-by Mon 26 = bank holiday):', JSON.stringify(p));
    await A.close();
  }
  // ---------- 5. Speed: 500-line list ×4 houses ----------
  {
    const rows = []; for (let i = 0; i < 500; i++) rows.push({ k: 'saw', item: 'P' + i, qty: 1 + (i % 4), L: 300 + i, W: 200 + (i % 300), mat: ['MFC White', 'mfc white ', 'Oak', 'Grey'][i % 4], note: '' });
    const r0 = base(rows, '2026-10-22'); for (let j = 2; j <= 4; j++) { r0.orders.push(H.order({ wo: 'WO-' + j, dueDate: '2026-10-22', origDueDate: '2026-10-22' })); r0.settings.lists.push({ id: 'L' + j, wb: 'W1', sheet: 'H1', name: 'House ' + j, project: 'Proj', saw: 500, fit: 0, wos: ['WO-' + j], up: '2026-10-20T09:00:00Z' }); }
    const S = makeServer(r0);
    const A = await open(browser, S, { now: '2026-10-21T09:00:00Z', role: 'saw' });
    const t = await A.page.evaluate(() => { let t0 = performance.now(); for (let i = 0; i < 10; i++) sheetNeedHTML(); const sn = (performance.now() - t0) / 10; t0 = performance.now(); render(); const rn = performance.now() - t0; const mats = sheetNeed(lists(), '', todayLocal(), { cutSince: todayLocal() }).mats; return { sn, rn, mats: mats.map(m => m.mat + ':' + m.m2 + ':' + m.sheets) }; });
    rec('2000 lines: sheet panel < 50 ms', t.sn < 50, JSON.stringify(t));
    rec('2000 lines: full Saw render < 1500 ms', t.rn < 1500, t.rn.toFixed(0) + ' ms');
    rec('2000 lines: MFC White merged across case/spaces (3 materials)', t.mats.length === 3, JSON.stringify(t.mats));
    await A.close();
  }
  // ---------- 6. HTML injection in material names on the panel ----------
  {
    const S = makeServer(base([{ k: 'saw', item: 'a', qty: 1, L: 1000, W: 1000, mat: '<img src=x onerror="window.__x=1">O\'Grady 🪵' }], '2026-10-21'));
    const A = await open(browser, S, { now: '2026-10-21T09:00:00Z', role: 'saw' });
    const o = await A.page.evaluate(() => ({ x: !!window.__x, txt: (document.querySelector('.sn-box') || {}).innerText || '' }));
    rec('material name escaped on panel', !o.x && /O'Grady/.test(o.txt), o.txt.slice(0, 120));
    await A.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
