// Tester re-test #3 (2 Nov 2026) of the two combined-list fixes on feature/stage2-imports:
//   a8b2fef combined list groups with matKey (spaces / NBSP / case / composed accents; sizes "2440 " and "2440MM")
//   122c3c0 two houses with the same name keep their own split ("House 1", "House 1 (2)"), incl. a list really NAMED "House 1 (2)"
// Stubbed Supabase only (tests/stage1/srv.js). Run: node tests/sawstores/retest-nov3.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const NOW = '2026-10-21T09:00:00Z';
const ROWS = [{ k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' }];
const mk = rows => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 1, fit: 0, wos: ['WO-1'], up: NOW }], listWBs: { W1: { project: 'Proj', sheets: { H1: rows } } } } });

(async () => {
  const browser = await H.chromium.launch();
  const S = makeServer(mk(ROWS));
  const A = await open(browser, S, { now: NOW, role: 'saw' });
  await A.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); });
  // run(houses): houses = [{name, project?, rows:[...]}] → combineLists output (+ the rendered chips)
  const run = (houses, mode) => A.page.evaluate(({ houses, mode }) => {
    DB.listWBs.WQ = { sheets: {} }; DB.listRow = DB.listRow || {}; DB.listHold = DB.listHold || {};
    const ls = houses.map((h, i) => { const id = 'Q' + i; DB.listWBs.WQ.sheets['S' + i] = h.rows; DB.listRow[id] = {}; DB.listHold[id] = {};
      return { id, wb: 'WQ', sheet: 'S' + i, name: h.name, project: h.project, wos: ['WO-1'], saw: h.rows.length, fit: 0 }; });
    const rows = combineLists(ls, mode || 'saw').map(x => ({ item: x.item, L: x.L, W: x.W, mat: x.mat, note: x.note, qty: x.qty, bad: x.bad, per: x.per }));
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    openCombined(ls, mode || 'saw');
    const ov = document.querySelector('.pod-ovl');
    const chips = [...ov.querySelectorAll('.ph-chip')].map(c => c.textContent.trim());
    const head = [...ov.querySelectorAll('.pod-in > div:nth-child(3) > div')].map(d => d.textContent.trim());
    ov.remove();
    return { rows, chips, head };
  }, { houses, mode });
  const r = (o = {}) => Object.assign({ k: 'saw', item: 'Side', qty: 2, L: 2440, W: 600, mat: 'MFC White', note: '' }, o);

  // ===== a8b2fef: grouping =====
  {
    const c = await run([{ name: 'H-A', rows: [r({ mat: 'MFC  White' })] }, { name: 'H-B', rows: [r({ mat: 'mfc white ' })] }, { name: 'H-C', rows: [r({ mat: 'MFC White' })] }, { name: 'H-D', rows: [r({ mat: '\tMFC White\n' })] }]);
    rec('G1 "MFC  White" / "mfc white " / NBSP / tab+newline → one row of 8, first spelling shown', c.rows.length === 1 && c.rows[0].qty === 8 && c.rows[0].mat === 'MFC  White', JSON.stringify(c.rows));
  }
  {
    const c = await run([{ name: 'H-A', rows: [r({ mat: 'Lamé Oak' })] }, { name: 'H-B', rows: [r({ mat: 'Lamé Oak' })] }, { name: 'H-C', rows: [r({ mat: 'LAMÉ OAK' })] }]);
    rec('G2 "Lamé Oak" composed / decomposed / upper-case → one row of 6', c.rows.length === 1 && c.rows[0].qty === 6, JSON.stringify(c.rows.map(x => [x.mat, x.qty])));
  }
  {
    const c = await run([{ name: 'H-A', rows: [r({ L: 2440 })] }, { name: 'H-B', rows: [r({ L: '2440 ' })] }, { name: 'H-C', rows: [r({ L: '2440' })] }, { name: 'H-D', rows: [r({ L: ' 2440 ' })] }]);
    rec('G3 size 2440 (number) / "2440 " / "2440" / NBSP-padded → one row of 8', c.rows.length === 1 && c.rows[0].qty === 8, JSON.stringify(c.rows.map(x => [x.L, x.qty])));
  }
  {
    const c = await run([{ name: 'H-A', rows: [r({ L: 2440 })] }, { name: 'H-B', rows: [r({ L: '2440MM' })] }, { name: 'H-C', rows: [r({ L: '2440 mm' })] }, { name: 'H-D', rows: [r({ L: '2440.0' })] }, { name: 'H-E', rows: [r({ L: '2,440' })] }]);
    // These are what the sheet literally says. Grouping them is a choice for Garry; what matters is the total is never WRONG:
    // each separate row must carry its own houses only, and the grand total must still be 10.
    const tot = c.rows.reduce((a, x) => a + x.qty, 0);
    info('G4 2440 vs "2440MM" / "2440 mm" / "2440.0" / "2,440" give ' + c.rows.length + ' rows', JSON.stringify(c.rows.map(x => [x.L, x.qty, Object.keys(x.per).join('+')])));
    rec('G4 sizes written with units/decimals/commas: nothing lost or double-counted (sum of rows = 10)', tot === 10, 'sum=' + tot);
    rec('G4b "2440MM" and 2440 are the same board size: shown as ONE row (otherwise the saw sees two lines of the same part)', c.rows.length === 1, c.rows.length + ' rows: ' + c.rows.map(x => JSON.stringify(x.L)).join(' / '));
  }
  {
    const c = await run([{ name: 'H-A', rows: [r({ mat: 'MFC White' })] }, { name: 'H-B', rows: [r({ mat: 'MFC Whité' })] }, { name: 'H-C', rows: [r({ mat: 'MFC Wh1te' })] }]);
    rec('G5 genuinely different spellings (accent added, digit 1) are NOT merged (no false grouping)', c.rows.length === 3, c.rows.length + ' rows');
  }
  {
    const c = await run([{ name: 'H-A', rows: [r({ note: '1mm ABS' })] }, { name: 'H-B', rows: [r({ note: '1MM  abs' })] }, { name: 'H-C', rows: [r({ note: '2mm ABS' })] }, { name: 'H-D', rows: [r({ item: 'side ' })] }, { name: 'H-E', rows: [r({ item: 'Side', note: '' })] }]);
    const byNote = c.rows.map(x => [x.item, x.note, x.qty]);
    rec('G6 edging "1mm ABS"/"1MM  abs" merge (4), "2mm ABS" stays apart (2), "side "/"Side" with no note merge (4)', c.rows.length === 3 && c.rows.some(x => /1mm/i.test(x.note) && x.qty === 4) && c.rows.some(x => /2mm/.test(x.note) && x.qty === 2) && c.rows.some(x => !x.note && x.qty === 4), JSON.stringify(byNote));
  }
  {
    const c = await run([{ name: 'H-A', rows: [r({ mat: null })] }, { name: 'H-B', rows: [r({ mat: '' })] }, { name: 'H-C', rows: [r({ mat: undefined })] }, { name: 'H-D', rows: [r({ mat: 'null' })] }]);
    info('G7 material null / "" / undefined / the text "null"', JSON.stringify(c.rows.map(x => [x.mat, x.qty])));
    rec('G7 the word "null" typed as a material is not merged with an empty material', c.rows.some(x => x.mat === 'null' && x.qty === 2), JSON.stringify(c.rows.map(x => [x.mat, x.qty])));
  }
  {
    const c = await run([{ name: 'H-A', rows: [r({ mat: '<img src=x onerror=window.__pwn=1>' })] }, { name: '<b>House</b> O\'Grady "1" 😀', rows: [r({ mat: '<img src=x onerror=window.__pwn=1> ' })] }]);
    const pwn = await A.page.evaluate(() => !!window.__pwn);
    rec('G8 HTML in material / house name: grouped, nothing runs, chip shows the name as text', c.rows.length === 1 && !pwn && c.chips.some(t => t.startsWith('<b>House</b> O\'Grady "1" 😀')), JSON.stringify(c.chips) + ' pwn=' + pwn);
  }
  // ===== 122c3c0: same-named houses =====
  {
    const c = await run([{ name: 'House 1', rows: [r({ qty: 4 })] }, { name: 'House 1', rows: [r({ qty: 2 })] }]);
    rec('N1 two "House 1" lists: chips "House 1 ×4" and "House 1 (2) ×2", total 6', c.rows[0].qty === 6 && c.rows[0].per['House 1'] === 4 && c.rows[0].per['House 1 (2)'] === 2, JSON.stringify(c.rows[0].per));
  }
  {
    const c = await run([{ name: 'House 1', rows: [r({ qty: 4 })] }, { name: 'House 1', rows: [r({ qty: 2 })] }, { name: 'House 1 (2)', rows: [r({ qty: 1 })] }]);
    const per = c.rows[0].per, labels = Object.keys(per);
    rec('N2 "House 1", "House 1", and a list really called "House 1 (2)": three separate chips, quantities not merged, total 7', c.rows[0].qty === 7 && labels.length === 3 && Object.values(per).sort().join() === '1,2,4', JSON.stringify(per));
    // which chip is the REAL "House 1 (2)"? The saw operator reads chip names against the labels on the parts.
    const realIsLabelled = per['House 1 (2)'] === 1;
    rec('N2b the chip that reads "House 1 (2)" is the list actually NAMED "House 1 (2)" (not the second "House 1")', realIsLabelled, JSON.stringify(per) + ' — the second "House 1" took the label "House 1 (2)", so the real "House 1 (2)" list shows as "' + labels.find(l => per[l] === 1) + '"');
    rec('N2c the houses box at the top shows the same labels as the chips (so "(2)" can be told apart)', c.head.some(t => /House 1 \(2\)/.test(t)) && c.head.length === 3 && new Set(c.head.map(t => t.split(' · ')[0])).size === 3, JSON.stringify(c.head));
  }
  {
    const c = await run([{ name: 'House 1 (2)', rows: [r({ qty: 1 })] }, { name: 'House 1', rows: [r({ qty: 4 })] }, { name: 'House 1', rows: [r({ qty: 2 })] }]);
    const per = c.rows[0].per;
    rec('N3 real "House 1 (2)" listed first: still three chips, its own qty under its own name', c.rows[0].qty === 7 && Object.keys(per).length === 3 && per['House 1 (2)'] === 1, JSON.stringify(per));
  }
  {
    const c = await run([{ name: 'House 1', rows: [r({ qty: 4 })] }, { name: 'House 1 ', rows: [r({ qty: 2 })] }, { name: 'house 1', rows: [r({ qty: 1 })] }]);
    const per = c.rows[0].per;
    info('N4 "House 1" / "House 1 " / "house 1"', JSON.stringify(per));
    rec('N4 near-identical names keep their own quantities (three entries, total 7)', c.rows[0].qty === 7 && Object.keys(per).length === 3, JSON.stringify(per));
  }
  {
    const c = await run([{ name: 'House 1', project: 'Aderrig', rows: [r({ qty: 4 })] }, { name: 'House 1', project: 'Aderrig', rows: [r({ qty: 2 })] }, { name: 'House 1', project: 'Clonee', rows: [r({ qty: 1 })] }]);
    const per = c.rows[0].per;
    rec('N5 two projects, same house names: "Aderrig — House 1", "Aderrig — House 1 (2)", "Clonee — House 1"', per['Aderrig — House 1'] === 4 && per['Aderrig — House 1 (2)'] === 2 && per['Clonee — House 1'] === 1, JSON.stringify(per));
  }
  {
    const c = await run([{ name: 'House 1', rows: [r({ qty: '2x2' })] }, { name: 'House 1', rows: [r({ qty: 3 })] }]);
    const per = c.rows[0].per;
    rec('N6 odd qty on the first "House 1" stays on that house only (red "2x2"), the second shows ×3', per['House 1'] === '2x2' && per['House 1 (2)'] === 3 && c.rows[0].qty === 3 && c.rows[0].bad === 1, JSON.stringify(per));
  }
  {
    const houses = Array.from({ length: 12 }, (_, i) => ({ name: 'House 1', rows: [r({ qty: i + 1 })] }));
    const c = await run(houses);
    const per = c.rows[0].per;
    rec('N7 twelve lists all named "House 1": 12 chips, total 78, labels (2)…(12)', c.rows[0].qty === 78 && Object.keys(per).length === 12 && per['House 1 (12)'] === 12, Object.keys(per).join(', '));
  }
  {
    const c = await run([{ name: 'constructor', rows: [r({ qty: 2 })] }, { name: 'toString', rows: [r({ qty: 3 })] }, { name: '__proto__', rows: [r({ qty: 4 })] }]);
    const okChips = c.chips.length === 3 && c.chips.some(t => /^constructor ×2/.test(t)) && c.chips.some(t => /^toString ×3/.test(t)) && c.chips.some(t => /^__proto__ ×4/.test(t));
    rec('N8 house names that are JavaScript words ("constructor", "toString", "__proto__") show their own quantities', okChips && c.rows[0].qty === 9, JSON.stringify(c.chips));
  }
  {
    const c = await run([{ name: 'House 1', rows: [{ k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum  hinge', note: '' }] }, { name: 'House 1', rows: [{ k: 'fit', item: 'hinge', qty: 4, mat: 'blum hinge', note: '' }] }], 'fit');
    rec('N9 fittings list: same-named houses + spacing → one Hinge row of 12 split 8 / 4', c.rows.length === 1 && c.rows[0].qty === 12 && c.rows[0].per['House 1'] === 8 && c.rows[0].per['House 1 (2)'] === 4, JSON.stringify(c.rows));
  }
  // labels printed from the combined list: do same-named houses come out distinguishable?
  {
    const out = await A.page.evaluate(() => {
      DB.listWBs.WP = { sheets: { a: [{ k: 'saw', item: 'Side', qty: 1, L: 2440, W: 600, mat: 'MFC White', note: '' }], b: [{ k: 'saw', item: 'Side', qty: 1, L: 2440, W: 600, mat: 'MFC White', note: '' }] } };
      const ls = [{ id: 'P0', wb: 'WP', sheet: 'a', name: 'House 1', wos: ['WO-1'], saw: 1 }, { id: 'P1', wb: 'WP', sheet: 'b', name: 'House 1', wos: ['WO-1'], saw: 1 }];
      DB.listRow.P0 = {}; DB.listRow.P1 = {}; DB.listHold.P0 = {}; DB.listHold.P1 = {};
      let html = ''; const wo = window.open; window.open = () => ({ document: { write(h) { html += h; }, close() {} }, focus() {}, print() {}, close() {} });
      try { printLabels(ls, 'saw'); } catch (e) { html = 'ERR ' + e.message; } window.open = wo; return html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 600);
    });
    info('N10 location labels printed for two lists both called "House 1"', out);
  }
  await A.close(); await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
