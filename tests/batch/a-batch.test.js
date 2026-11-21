// Part A (Garry 20 Nov): the saw's ⚡ BATCH tab — a READ-ONLY helper table, lists switched ON. Fake Supabase only.
// Run: node tests/batch/a-batch.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const sleep = F.sleep;
const view = p => p.evaluate(() => { const w = document.querySelector('.wl'); return w ? w.innerText.replace(/\s+/g, ' ') : ''; });
const clickSel = (p, sel) => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) return 'no ' + sel; b.click(); return 'ok'; }, sel);
const addB = (p, id) => clickSel(p, '[data-wlsel="' + id + '"]');
const tab = p => p.evaluate(() => { const b = document.getElementById('wl-tab-batch'); return b ? b.textContent.trim() : null; });
const batch = p => p.evaluate(() => ({
  boards: [...document.querySelectorAll('.sb-board')].map(b => ({ h: b.querySelector('.sb-bh').innerText.replace(/\s+/g, ' '),
    rows: [...b.querySelectorAll('.sb-row')].map(r => ({ t: r.innerText.replace(/\s+/g, ' '), done: r.classList.contains('sb-done'),
      chips: [...r.querySelectorAll('.sb-chip')].map(c => ({ t: c.innerText.replace(/\s+/g, ' '), cut: c.classList.contains('sb-cut'), chk: c.classList.contains('sb-chk'), id: c.dataset.sbgo })) })) })),
  top: (document.querySelector('.sb-top') || {}).innerText || '', ticks: document.querySelectorAll('.wl [data-rt],.wl [data-rna],.sb-board input').length,
  houses: [...document.querySelectorAll('.sb-hl')].map(h => h.innerText.replace(/\s+/g, ' ')), notes: [...document.querySelectorAll('.sb-nl')].map(x => x.innerText) }));
const board = (b, name) => b.boards.find(x => x.h.toLowerCase().startsWith(name.toLowerCase())) || { h: '', rows: [] };
const rowOf = (bd, item) => bd.rows.find(r => r.t.startsWith(item)) || { chips: [], t: '' };
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = F.v2Row(); // NOW Wed 21 Oct; WO-1 / WO-2 cut by today (Aderrig Homes)
    row.orders.push(H.order({ wo: 'WO-3', customer: 'Lucan Homes', unit: '3', floor: 'GF', dueDate: '2026-10-22', origDueDate: '2026-10-22' }),
      H.order({ wo: 'WO-4', customer: 'Aderrig Homes', unit: '9', dueDate: '2026-10-29', origDueDate: '2026-10-29' })); // WO-4: a later day
    const S = F.makeServer(row);
    F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: [['saw', 'Side', '2', 2400, 600, 'MFC White', '1mm ABS', ''], ['saw', 'Top', '1', 2400, 600, 'MFC White', '', ''], ['saw', 'Back', '1', 900, 700, 'Oak', '', ''], ['saw', 'Shelf', '2x2', 560, 500, 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']] });
    F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'], lines: [['saw', 'Side', '4', 2400, 600, 'mfc  white', '1mm ABS', ''], ['saw', 'Gable', '2', 2400, 600, 'MFC White', '', '']] });
    D.insert(S.db, 'projects', { id: 'P2', name: 'Lucan', customer: 'Lucan Homes' });
    F.seedList(S, 'L3', { name: 'House 3', wos: ['WO-3'], list: { project_id: 'P2' }, lines: [['saw', 'Side', '2', 2400, 600, 'MFC White', '1mm ABS', ''], ['saw', 'Back', '1', 900, 700, 'Oak', '', '']] });
    F.seedList(S, 'L4', { name: 'House 1', wos: ['WO-4'], lines: [['saw', 'Plinth', '3', 2400, 150, 'MFC White', '', '']] }); // same name as L1, a later day
    const saw = await F.dev(browser, S, 'saw'), p = saw.page;
    const panel0 = await p.evaluate(() => sheetNeedHTML());
    let v = await view(p);
    rec('A1 each saw card says "＋ Add to batch"; no BATCH tab while the batch is empty', (await p.evaluate(() => [...document.querySelectorAll('[data-wlsel]')].map(b => b.textContent).join('|'))) === '＋ Add to batch|＋ Add to batch|＋ Add to batch' && (await tab(p)) === null, v.slice(0, 200));
    for (const id of ['L1', 'L2', 'L3']) await addB(p, id);
    v = await view(p);
    rec('A1 bar "3 houses ticked → ⚡ Open batch" with Labels for selected and ✕ Clear', /3 houses ticked →/.test(v) && /⚡ Open batch/.test(v) && /Labels for selected/.test(v) && /✕ Clear/.test(v), v.slice(0, 500));
    rec('A1 tab "⚡ BATCH — 3 houses"', (await tab(p)) === '⚡ BATCH — 3 houses', await tab(p));
    rec('A1 the card button now says "✓ In batch"', (await p.evaluate(() => document.querySelector('[data-wlsel="L1"]').textContent)) === '✓ In batch');
    const st = await p.evaluate(() => JSON.parse(localStorage.getItem('wpfSawBatch') || 'null'));
    rec('A1 remembered on this device only: browser storage wpfSawBatch', st && st.ids.join() === 'L1,L2,L3', JSON.stringify(st));
    rec('A1 nothing about the batch in the planner record', !JSON.stringify(S.row).includes('wpfSawBatch') && !JSON.stringify(S.row).includes('sawBatch'));
    await clickSel(p, '#wl-bopen'); await sleep(150);
    let b = await batch(p);
    const mw = board(b, 'MFC White'), oak = board(b, 'Oak');
    // hand check: MFC White = 2×1.44 + 1×1.44 + 4×1.44 + 2×1.44 + 2×1.44 = 15.84 m² → 15.84/5.75×1.1 = 3.03 → 4 sheets; Oak 2×0.63 = 1.26 → 1
    rec('A2 grouped by board: "MFC White — 4 sheets for this batch · 4 still to cut"', /— 4 sheets for this batch · 4 still to cut/.test(mw.h), mw.h);
    rec('A2 "Oak — 1 sheet for this batch · 1 still to cut"', /— 1 sheet for this batch · 1 still to cut/.test(oak.h), oak.h);
    rec('A2 "mfc  white" (case / spaces) is the same board', b.boards.length === 2, b.boards.map(x => x.h).join(' | '));
    const side = rowOf(mw, 'Side');
    // (Manager 21 Nov) chips name the physical unit — Floor / Unit, else the WO — with the list name small after it; project first
    rec('A2 Side: TOTAL 8 with one chip per house, project first (batch spans 2 projects), unit / WO then list name', /TOTAL\s*8/.test(side.t) && side.chips.map(c => c.t).join('|') === 'Aderrig — WO-1 House 1 ×2|Aderrig — Unit 2 House 2 ×4|Lucan — Floor GF Unit 3 House 3 ×2', JSON.stringify(side));
    const shelf = rowOf(mw, 'Shelf');
    rec('A6 "2x2" shown red "check quantity", never in a total', /TOTAL\s*0/.test(shelf.t) && /not added — check quantity/.test(shelf.t) && shelf.chips[0] && shelf.chips[0].chk, JSON.stringify(shelf));
    rec('A2 top line "3 houses · 2 projects · 0 of 13 pieces cut"', /3 houses · 2 projects · 0 of 13 pieces cut/.test(b.top), b.top);
    rec('A2 read-only: nothing to tick in the batch view', b.ticks === 0, b.ticks);
    rec('A2 "Houses in this batch": WO, floor/unit, "cut 0 of 4", Open list, Labels', b.houses.length === 3 && /WO-1/.test(b.houses[0]) && /cut 0 of 4/.test(b.houses[0]) && /Open list/.test(b.houses[0]) && /Labels/.test(b.houses[0]) && /Floor GF/.test(b.houses[2]), b.houses.join(' || '));
    // A3 tick on a house's own card → the batch shows that share ✓
    await clickSel(p, '#wl-tab-todo'); await sleep(100);
    await F.tapRow(p, 'data-rt', 'L2:1'); await F.send(p);
    await clickSel(p, '#wl-tab-batch'); await sleep(100);
    b = await batch(p);
    const side2 = rowOf(board(b, 'MFC White'), 'Side');
    rec('A3 a line ticked on House 2\'s own list → its share shows ✓, struck through', side2.chips[1] && side2.chips[1].cut && /^✓/.test(side2.chips[1].t) && !side2.chips[0].cut, JSON.stringify(side2.chips));
    rec('A3 board "2 still to cut" (10.08 m² left → 2 sheets), pieces "4 of 13"', /4 sheets for this batch · 2 still to cut/.test(board(b, 'MFC White').h) && /4 of 13 pieces cut/.test(b.top), board(b, 'MFC White').h + ' / ' + b.top);
    // another device ticks House 1's Top → shows after the poll; a fully cut row goes to the bottom of its board
    const saw2 = await F.dev(browser, S, 'saw');
    await F.tapRow(saw2.page, 'data-rt', 'L1:2'); await F.send(saw2.page);
    await p.evaluate(async () => { await lsPoll(); render(); }); await sleep(100);
    b = await batch(p);
    const rs = board(b, 'MFC White').rows;
    rec('A3 other device\'s tick shows (after the poll); the fully cut Top row is at the bottom, struck through', rs[rs.length - 1].t.startsWith('Top') && rs[rs.length - 1].done, rs.map(r => r.t.split(' ')[0] + (r.done ? '✓' : '')).join(','));
    // A5 N/A a line: out of the batch, in WAITING; after Release it's back
    await clickSel(p, '#wl-tab-todo'); await sleep(100);
    await F.tapRow(p, 'data-rna', 'L1:3'); await F.send(p);
    await clickSel(p, '#wl-tab-batch'); await sleep(100);
    b = await batch(p);
    rec('A5 N/A on House 1\'s Back: not in the batch (Oak now House 3 only)', rowOf(board(b, 'Oak'), 'Back').chips.map(c => c.t).join() === 'Lucan — Floor GF Unit 3 House 3 ×1' && /⏸ 1 waiting/.test(b.houses[0]), JSON.stringify(board(b, 'Oak')) + b.houses[0]);
    rec('A5 … it shows in ⏸ WAITING as today', /WAITING — 1/.test(await view(p)));
    await p.evaluate(() => { wlShowBatch = false; wlShowHold = true; render(); document.querySelector('[data-relg]').click(); }); await F.send(p);
    await p.evaluate(() => { wlShowHold = false; wlShowBatch = true; render(); }); await sleep(100);
    b = await batch(p);
    rec('A5 after Release it is back in the batch', rowOf(board(b, 'Oak'), 'Back').chips.length === 2, JSON.stringify(board(b, 'Oak')));
    // A4 a house that is cut complete leaves by itself; the last-line auto-finish still works
    await clickSel(p, '#wl-tab-todo'); await sleep(100);
    await F.tapRow(p, 'data-rt', 'L2:2'); await F.send(p); await sleep(100);
    v = await view(p);
    rec('A4 last line ticked on House 2 → it finishes by itself as before (✓ DONE has it)', !!(await p.evaluate(() => listDone('L2').saw)) && /DONE — 1/.test(v), v.slice(0, 300));
    rec('A4 House 2 left the batch with a one-line note', (await tab(p)) === '⚡ BATCH — 2 houses' && /Unit 2 \("House 2"\) left the batch — cut complete/.test(v), (await tab(p)) + ' ' + v.slice(0, 300));
    rec('A4 storage follows', (await p.evaluate(() => localStorage.getItem('wpfSawBatch'))).includes('"L1","L3"'));
    // A8 Open list: two houses with the same name, one on a later day; a Customer filter on
    await p.evaluate(() => { wlShowUpcoming = true; render(); }); await addB(p, 'L4'); await p.evaluate(() => { wlShowUpcoming = false; wlCust = 'Aderrig Homes'; wlShowBatch = true; render(); }); await sleep(100);
    b = await batch(p);
    rec('A8 two lists called "House 1": told apart by their unit (WO-1 / Unit 9), the list name after it', b.houses.some(h => /^Aderrig — WO-1 House 1 /.test(h)) && b.houses.some(h => /^Aderrig — Unit 9 House 1 /.test(h)), b.houses.join(' || '));
    const go = async id => { await p.evaluate(id => [...document.querySelectorAll('.sb-hl [data-sbgo]')].find(x => x.dataset.sbgo === id).click(), id); await sleep(250);
      return p.evaluate(id => { const c = [...document.querySelectorAll('[data-wlcard]')].find(e => e.dataset.wlcard === id); if (!c) return { found: false, tab: (document.querySelector('.wl-tabs .on') || {}).id };
        const r = c.getBoundingClientRect(); return { found: true, flash: c.classList.contains('wl-flash'), inView: r.top < innerHeight && r.bottom > 0, tab: (document.querySelector('.wl-tabs .on') || {}).id, name: c.querySelector('.wn').textContent, wo: c.innerText.includes('WO-4') }; }, id); };
    let g = await go('L4');
    rec('A8 Open list on the later-day "House 1" (WO-4) → its card on TO DO, in view, highlighted', g.found && g.flash && g.inView && g.tab === 'wl-tab-todo' && g.wo, JSON.stringify(g));
    await p.evaluate(() => { wlShowBatch = true; wlCust = 'Aderrig Homes'; wlShowUpcoming = false; render(); }); await sleep(100);
    g = await go('L3');
    rec('A8 Open list on Lucan\'s House 3 while the filter is Aderrig → the filter is lifted and the card shown', g.found && g.inView, JSON.stringify(g));
    // chip tap goes to the house too
    await p.evaluate(() => { wlShowBatch = true; render(); }); await sleep(100);
    const c1 = await p.evaluate(() => { const c = [...document.querySelectorAll('.sb-chip')].find(x => x.dataset.sbgo === 'L1'); c.click(); const k = [...document.querySelectorAll('[data-wlcard]')].find(e => e.dataset.wlcard === 'L1'); return !!k && k.classList.contains('wl-flash'); });
    rec('A2 tapping a house chip goes to that house\'s own list', c1);
    // A3 close and reopen: the same batch
    const ids0 = await p.evaluate(() => SB.ids.join());
    await p.reload(); await p.waitForFunction(() => typeof render === 'function'); await sleep(300);
    await p.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); lsReset(); await lsLoad(); render(); }); await sleep(300);
    rec('A3 page closed and opened again: the same batch (from this device\'s storage)', (await tab(p)) === '⚡ BATCH — 3 houses' && (await p.evaluate(() => SB.ids.join())) === ids0, (await tab(p)) + ' ' + ids0);
    // A7 replaced / archived mid-batch → drops out with the note
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L3'), { archived: true });
    await p.evaluate(async () => { lsReset(); await lsLoad(); render(); }); await sleep(200);
    v = await view(p);
    rec('A7 an archived list drops out with the note', /Floor GF Unit 3 \("House 3"\) left the batch — list archived/.test(v) && (await tab(p)) === '⚡ BATCH — 2 houses', v.slice(0, 300));
    // A7 new Rev mid-batch: a changed line goes back to uncut (the line engine) — check Side on L1 after its line is replaced
    // escaping
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L4'), { name: '<img src=x onerror=window.__x=1>' });
    await p.evaluate(async () => { lsReset(); await lsLoad(); wlShowBatch = true; render(); }); await sleep(200);
    rec('A escaping: a list name with HTML is shown as text in the batch', await p.evaluate(() => !window.__x && !document.querySelector('.sb-board img,.sb-hs img') && /<img/.test(document.querySelector('.sb-hs').innerText)));
    // 360 px
    await p.setViewportSize({ width: 360, height: 740 }); await sleep(200);
    const sw = await p.evaluate(() => { const over = []; document.querySelectorAll('.wl *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1) over.push(e.className + ':' + Math.round(r.right)); }); return { sw: document.documentElement.scrollWidth, vw: innerWidth, over: over.slice(0, 4) }; });
    rec('A9 360 px: batch view has no sideways scroll', sw.sw <= sw.vw && !sw.over.length, JSON.stringify(sw));
    await p.evaluate(() => { wlShowBatch = false; render(); }); await sleep(100);
    const sw2 = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
    rec('A9 360 px: TO DO with the batch bar has no sideways scroll', sw2.sw <= sw2.vw, JSON.stringify(sw2));
    await p.setViewportSize({ width: 1400, height: 900 });
    // sheets panel figures unchanged by the batch
    rec('A9 the sheets panel is the same as before the batch existed', (await p.evaluate(() => sheetNeedHTML())) !== null && (await p.evaluate(() => JSON.stringify(sheetNeed(lists(), '', todayLocal(), { cutSince: todayLocal() })))) === (await p.evaluate(() => { const t = todayLocal(); SB.ids.splice(0); const r = JSON.stringify(sheetNeed(lists(), '', t, { cutSince: t })); return r; })));
    rec('A9 sheets panel HTML at start was drawn (sanity)', /Sheets needed/.test(panel0));
    // ✕ Empty batch: nothing on the lists changes
    for (const id of ['L1']) await addB(p, id);
    const before = JSON.stringify(S.db.t.list_lines);
    await p.evaluate(() => { wlShowBatch = true; render(); document.getElementById('sb-empty').click(); }); await sleep(150);
    rec('✕ Empty batch: batch gone, back on TO DO, no line changed', (await tab(p)) === null && JSON.stringify(S.db.t.list_lines) === before && (await p.evaluate(() => localStorage.getItem('wpfSawBatch'))) === null);
    // Stores page unchanged: old tick box + combined table
    const st1 = await F.dev(browser, S, 'stores'), q = st1.page;
    const sv = await q.evaluate(() => { const b = [...document.querySelectorAll('[data-wlsel]')]; b.slice(0, 2).forEach(x => x.click()); return { txt: b.map(x => x.textContent).join('|'), comb: !!document.getElementById('wl-comb'), batch: !!document.getElementById('wl-tab-batch'), card: !!document.querySelector('[data-wlcard]') }; });
    rec('A9 Stores page unchanged: plain tick box, "⚡ Combined fittings table", no BATCH tab', !/batch/i.test(sv.txt) && sv.comb && !sv.batch && !sv.card, JSON.stringify(sv));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
