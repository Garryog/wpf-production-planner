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
  // ---------- 1b. Fix 3 (0887782) re-check: every warning reaches the panel the saw/stores actually see ----------
  {
    const rows = [
      { k: 'saw', item: 'ok', qty: 1, L: 2000, W: 500, mat: 'Oak' },
      { k: 'saw', item: 'blank qty', qty: '', L: 2000, W: 500, mat: 'Oak' },
      { k: 'saw', item: '2x2', qty: '2x2', L: 2000, W: 500, mat: 'Oak' },
      { k: 'saw', item: 'half', qty: 1.5, L: 2000, W: 500, mat: 'Oak' },
      { k: 'saw', item: 'zero', qty: 0, L: 2000, W: 500, mat: 'Oak' },
      { k: 'saw', item: 'neg', qty: -2, L: 2000, W: 500, mat: 'Oak' },
      { k: 'saw', item: 'cm', qty: 1, L: 240, W: 60, mat: 'Grey' },
      { k: 'saw', item: 'long', qty: 1, L: 3050, W: 600, mat: 'Ash' },
      { k: 'saw', item: 'exact', qty: 1, L: 3000, W: 100, mat: 'Elm' },
    ];
    const S = makeServer(base(rows, '2026-10-22'));
    const A = await open(browser, S, { now: '2026-10-21T09:00:00Z', role: 'saw' });
    const o = await A.page.evaluate(() => { const t = todayLocal(); const r = sheetNeed(lists(), '', t, { cutSince: t }); const box = document.querySelector('.sn-box'); return { r, txt: box ? box.innerText.replace(/\s+/g, ' ') : '' }; });
    console.log('warnings panel:', o.txt);
    const g = n => o.r.mats.find(m => m.mat === n) || {};
    rec('blank qty → "1 line not counted — no quantity" on the panel', o.r.noQty === 1 && /1 line not counted — no quantity/.test(o.txt), 'noQty=' + o.r.noQty);
    rec('"2x2", 1.5, 0, -2 → "4 lines not counted — check quantity" on the panel', o.r.badQty === 4 && /4 lines not counted — check quantity/.test(o.txt), 'badQty=' + o.r.badQty);
    rec('cm sizes (240 × 60) → material flagged "check units"', g('Grey').check === true && /Grey ⚠ check units/.test(o.txt), JSON.stringify(g('Grey')));
    rec('> 3000 mm (3050) → material flagged "check units"', g('Ash').check === true, JSON.stringify(g('Ash')));
    rec('exactly 3000 × 100 → NOT flagged (limits inclusive)', g('Elm').check === false, JSON.stringify(g('Elm')));
    rec('good Oak line still counted alone (0.5 m² → 1 sheet), not flagged', g('Oak').m2 === 1 && g('Oak').sheets === 1 && !g('Oak').check, JSON.stringify(g('Oak')));
    const q = await A.page.evaluate(() => [...document.querySelectorAll('.wl-tbl td.num')].map(td => td.textContent).filter(x => /x|^$/.test(x)).slice(0, 4));
    rec('bench table shows the "2x2" qty as typed (not 2, not blank)', q.includes('2x2'), JSON.stringify(q));
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
  // ---------- 4. Dates — rule (Garry, 21 Oct): a cut-by date on a weekend / bank holiday counts under the WORKING DAY BEFORE it.
  //            Cut-by = delivery − 1 calendar day. Irish bank holidays 2026-27 (IE_BANK_HOLS). 1 Jan is a bank holiday.
  {
    const S = makeServer(base([{ k: 'saw', item: 'a', qty: 1, L: 1000, W: 1000, mat: 'M' }], '2026-10-27'));
    const A = await open(browser, S, { now: '2026-10-23T09:00:00Z' });
    const d = await A.page.evaluate(() => ({ fri: nextWorkDay('2026-10-30'), sat: nextWorkDay('2026-10-24'), ye: nextWorkDay('2026-12-31'), bh: nextWorkDay('2026-10-23'), xmas: nextWorkDay('2026-12-24'),
      pat: nextWorkDay('2027-03-16'), easter: nextWorkDay('2027-03-26'), ye27: nextWorkDay('2027-12-24'), dst: addDayISO('2026-10-24', 1) + ',' + addDayISO('2026-03-28', 1) }));
    rec('Fri 30 Oct → Mon 2 Nov', d.fri === '2026-11-02', d.fri);
    rec('year end Thu 31 Dec 2026 → Mon 4 Jan 2027 (1 Jan bank holiday, then weekend)', d.ye === '2027-01-04', d.ye);
    rec('DST weekend addDayISO stays on calendar days', d.dst === '2026-10-25,2026-03-29', d.dst);
    rec('Bank holiday Mon 26 Oct 2026 skipped: Fri 23 → Tue 27', d.bh === '2026-10-27', d.bh);
    rec('Christmas Eve Thu 24 Dec 2026 → Tue 29 Dec (25 Fri, 28 Mon substitute for St Stephen\'s)', d.xmas === '2026-12-29', d.xmas);
    rec('St Patrick\'s Wed 17 Mar 2027 skipped: Tue 16 → Thu 18', d.pat === '2027-03-18', d.pat);
    rec('Easter Monday 29 Mar 2027 skipped: Fri 26 → Tue 30', d.easter === '2027-03-30', d.easter);
    rec('Christmas 2027 (Sat/Sun → Mon 27 + Tue 28 off): Fri 24 Dec → Wed 29', d.ye27 === '2027-12-29', d.ye27);
    await A.close();
  }
  {
    // One list per delivery date, each with its own material name (= the delivery date) so we can see which box it lands in.
    const panel = async (now, dues) => {
      const r0 = { id: 'main', version: 1, nid: 5, orders: [], settings: { lists: [], listWBs: { W1: { project: 'P', sheets: {} } } } };
      dues.forEach((due, i) => {
        r0.orders.push(H.order({ wo: 'WO-' + i, dueDate: due, origDueDate: due }));
        r0.settings.listWBs.W1.sheets['S' + i] = [{ k: 'saw', item: 'p', qty: 1, L: 2875, W: 2000, mat: 'D' + due }];
        r0.settings.lists.push({ id: 'L' + i, wb: 'W1', sheet: 'S' + i, name: 'H' + i, project: 'P', saw: 1, fit: 0, wos: ['WO-' + i], up: '2026-10-01T09:00:00Z' });
      });
      const S = makeServer(r0);
      const A = await open(browser, S, { now, role: 'saw' });
      const o = await A.page.evaluate(() => {
        const box = el => [...el.querySelectorAll('.sn-m')].map(x => x.textContent.replace(/^D/, '').trim()).sort().join(',');
        const div = document.createElement('div'); div.innerHTML = sheetNeedHTML(); const b = div.querySelectorAll('.sn-box');
        // the bench queue + Print today must agree with the panel (same rule, one screen)
        const q = workListFor('saw', 1).map(l => DB.orders.find(o => o.wo === l.wos[0]).dueDate).sort().join(',');
        return { today: box(b[0]), next: box(b[1]), sub: [...b].map(x => x.querySelector('.sn-h').textContent.replace(/\s+/g, ' ')), queue: q };
      });
      await A.close(); return o;
    };
    // Fri 23 Oct 2026 (Mon 26 bank holiday). Deliveries Mon 26 (cut-by Sun), Tue 27 (cut-by BH Mon), Wed 28, Thu 29, overdue Thu 22.
    let p = await panel('2026-10-23T09:00:00Z', ['2026-10-22', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
    console.log('Fri 23 Oct:', JSON.stringify(p));
    rec('Fri 23 Oct (BH weekend): today = overdue + Mon 26 + Tue 27 deliveries', p.today === '2026-10-22,2026-10-26,2026-10-27', p.today);
    rec('Fri 23 Oct: next working day = Tue 27, holds Wed 28 delivery only', p.next === '2026-10-28' && /Tue, 27 Oct/.test(p.sub[1]), JSON.stringify(p));
    rec('Fri 23 Oct: subtitle says today includes cut-by to Mon 26 (not a working day)', /Mon, 26 Oct/.test(p.sub[0]), p.sub[0]);
    // Ordinary Friday 30 Oct: Mon 2 Nov delivery (cut-by Sun) is today's; Tue 3 is Mon's.
    p = await panel('2026-10-30T09:00:00Z', ['2026-10-31', '2026-11-02', '2026-11-03', '2026-11-04']);
    console.log('Fri 30 Oct:', JSON.stringify(p));
    rec('Fri 30 Oct: today = Sat 31 + Mon 2 Nov deliveries', p.today === '2026-10-31,2026-11-02', p.today);
    rec('Fri 30 Oct: next (Mon 2 Nov) = Tue 3 delivery', p.next === '2026-11-03', p.next);
    // Thu 24 Dec 2026: off Fri 25, Sat, Sun, Mon 28. Deliveries up to Tue 29 (cut-by Mon 28) are today's.
    p = await panel('2026-12-24T09:00:00Z', ['2026-12-25', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31']);
    console.log('Thu 24 Dec:', JSON.stringify(p));
    rec('Thu 24 Dec: today = deliveries 25, 28, 29 Dec (cut-by 24..28)', p.today === '2026-12-25,2026-12-28,2026-12-29', p.today);
    rec('Thu 24 Dec: next (Tue 29) = Wed 30 delivery only', p.next === '2026-12-30' && /Tue, 29 Dec/.test(p.sub[1]), JSON.stringify(p));
    // Thu 31 Dec 2026 → year end. Deliveries 1–4 Jan (cut-by 31 Dec..3 Jan) are today's; 5 Jan is Mon 4 Jan's.
    p = await panel('2026-12-31T09:00:00Z', ['2027-01-01', '2027-01-04', '2027-01-05', '2027-01-06']);
    console.log('Thu 31 Dec:', JSON.stringify(p));
    rec('Thu 31 Dec: today = 1 Jan + Mon 4 Jan deliveries', p.today === '2027-01-01,2027-01-04', p.today);
    rec('Thu 31 Dec: next working day = Mon 4 Jan 2027, holds Tue 5 Jan delivery', p.next === '2027-01-05' && /Mon, 4 Jan/.test(p.sub[1]), JSON.stringify(p));
    // Someone opens the Saw screen on Saturday 24 Oct: today runs to Mon 26 (BH); next = Tue 27.
    p = await panel('2026-10-24T09:00:00Z', ['2026-10-26', '2026-10-27', '2026-10-28']);
    rec('Sat 24 Oct (weekend use): today = Mon 26 + Tue 27, next Tue 27 = Wed 28', p.today === '2026-10-26,2026-10-27' && p.next === '2026-10-28', JSON.stringify(p));
    // Consistency: the saw queue / "Print today" must show the same houses the panel counts as today.
    p = await panel('2026-10-30T09:00:00Z', ['2026-10-30', '2026-11-02']);
    rec('Fri 30 Oct: "Print today" / bench queue includes the Mon 2 Nov house the sheets panel counts as today', p.queue === p.today, 'panel today=' + p.today + ' | print/queue=' + p.queue);
    p = await panel('2026-10-23T09:00:00Z', ['2026-10-23', '2026-10-27']);
    rec('Fri 23 Oct: "Print today" / bench queue includes the Tue 27 house (cut-by BH Mon) the panel counts as today', p.queue === p.today, 'panel today=' + p.today + ' | print/queue=' + p.queue);
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
