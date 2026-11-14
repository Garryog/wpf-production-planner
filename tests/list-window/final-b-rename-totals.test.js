// FINAL Tester round (14 Nov), area 1 — Manager point 1: after a project material is RENAMED, lists nobody has re-saved still
// store the OLD name. Does the bench see ONE board under TWO names? Three lists use "MFC White"; it is renamed to
// "18mm MFC White" in the Materials window; only ONE list is saved again. Then: Sheets needed (sheetNeed / sheetNeedHTML),
// the combined cutting table (combineLists), the printed saw sheet (printWorkList), the waiting-on-material book
// (holdBookHTML + "ARRIVED — RELEASE ALL"), and for a renamed FITTING the combined fittings table and the stores sheet.
// Fake Supabase only. Run: node tests/list-window/final-b-rename-totals.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err } = L;
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const mmsg = p => p.evaluate(() => (document.getElementById('mt-msg') || {}).textContent || '');
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); render(); });
const rename = async (p, id, name) => { await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400); await type(p, '[data-mtn="' + id + '"]', name); await press(p, '[data-mts="' + id + '"]'); await sleep(1200); const m = await mmsg(p); await closeAll(p); return m; };
const LINES = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass' }],
  ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }]];
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const row = X.v2Row();
    row.orders.push(X.H.order({ wo: 'WO-9', customer: 'Aderrig Homes', floor: 'GF', unit: '19', title: 'HOUSE 9', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
    const S = X.makeServer(row, { lines: LINES });
    X.F3.seedList(S, 'L2', { wos: ['WO-2'], name: 'House 2', lines: LINES });
    X.F3.seedList(S, 'L3', { wos: ['WO-9'], name: 'House 9', lines: LINES });
    ['L1', 'L2', 'L3'].forEach(id => D.update(S.db, 'lists', D.find(S.db, 'lists', id), { locked: true, rev: 1 }));
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p); await reload(p);
    const sw = await X.dev(browser, S, 'saw'), ps = sw.page; await reload(ps);
    const need = pg => pg.evaluate(() => { const r = sheetNeed(workLists(), '', cutTodayEnd(todayLocal()), { cutSince: todayLocal() }); return { mats: r.mats, sheets: r.sheets, lines: r.lines, html: (() => { const d = document.createElement('div'); d.innerHTML = sheetNeedHTML(); return d.innerText; })() }; });
    const n0 = await need(ps);
    rec('set-up: before the rename the saw\'s "Sheets needed" has ONE board line for 3 houses (6 saw lines)', n0.mats.length === 1 && n0.lines === 6, JSON.stringify(n0.mats));

    // ---- the rename (board) + a renamed fitting, then ONE list re-saved ----
    rec('set-up: MFC White → 18mm MFC White saved in the Materials window', (await rename(p, 'M1', '18mm MFC White')) === '' && D.find(S.db, 'project_materials', 'M1').name === '18mm MFC White');
    await reload(p);
    rec('set-up: Blum hinge → Blum 110 hinge saved', (await rename(p, 'M2', 'Blum 110 hinge')) === '' && D.find(S.db, 'project_materials', 'M2').name === 'Blum 110 hinge');
    await reload(p);
    await p.evaluate(() => openListEditor('L2')); await sleep(900);
    const r = await rows(p), tp = r.findIndex(x => x.item === 'Top');
    await setv(p, tp + '|note', 'scribe'); await sleep(200); await save(p, 2200);
    rec('set-up: House 2 saved again → its lines are stored under the NEW names', linesOf(S, 'L2').filter(x => x.kind === 'saw').every(x => x.material === '18mm MFC White') && linesOf(S, 'L2').find(x => x.kind === 'fit').material === 'Blum 110 hinge', JSON.stringify([await err(p), linesOf(S, 'L2').map(x => x.material)]));
    rec('set-up: House 1 and House 9 (not saved again) still store the OLD names', ['L1', 'L3'].every(id => linesOf(S, id).filter(x => x.kind === 'saw').every(x => x.material === 'MFC White')));
    await closeAll(p);

    // ---- A. Sheets needed on the saw screen ----
    await reload(ps);
    const n1 = await need(ps);
    rec('[HIGH] A1 Sheets needed (sheetNeed): ONE board line for the one board (old + new name counted together)', n1.mats.length === 1, JSON.stringify(n1.mats));
    rec('[HIGH] A2 Sheets needed: the total number of sheets is the same as before the rename (' + n0.sheets + ')', n1.sheets === n0.sheets, JSON.stringify({ before: n0.sheets, after: n1.sheets, mats: n1.mats }));
    rec('[HIGH] A3 Sheets needed panel (sheetNeedHTML) does not show the old name "MFC White" as its own line', !/sheets?\s*MFC White/.test(n1.html.replace(/18mm MFC White/g, 'NEW')), n1.html.replace(/\s+/g, ' ').slice(0, 260));
    // same on the Production Manager / office screens (same function)
    const n1d = await (async () => { await reload(p); return need(p); })();
    rec('[HIGH] A4 the same on the PC that did the rename (it knows both names)', n1d.mats.length === 1, JSON.stringify(n1d.mats));

    // ---- B. Combined cutting table (3 houses ticked) ----
    const comb = await ps.evaluate(() => combineLists(workLists().filter(l => ['L1', 'L2', 'L3'].includes(l.id)), 'saw').map(g => ({ item: g.item, mat: g.mat, note: g.note, qty: g.qty, per: Object.keys(g.per).length })));
    const sides = comb.filter(g => g.item === 'Side');
    rec('[HIGH] B1 Combined cutting table (combineLists): "Side 720 × 560" for 3 houses is ONE row of 6', sides.length === 1 && sides[0].qty === 6, JSON.stringify(sides));
    const combF = await ps.evaluate(() => combineLists(workLists().filter(l => ['L1', 'L2', 'L3'].includes(l.id)), 'fit').map(g => ({ item: g.item, mat: g.mat, qty: g.qty })));
    rec('[MEDIUM] B2 Combined fittings table: the renamed fitting "Hinge" for 3 houses is ONE row of 24', combF.filter(g => g.item === 'Hinge').length === 1 && combF.filter(g => g.item === 'Hinge')[0].qty === 24, JSON.stringify(combF));

    // ---- C. Printed saw sheet / stores sheet ----
    const printOf = async (pg, mode) => pg.evaluate(mode => { window.__pr = []; window.open = () => { const w = { html: '', document: { write(h) { w.html += h; }, close() {} }, focus() {}, print() {}, close() {} }; window.__pr.push(w); return w; }; printWorkList(mode, 1); const d = document.createElement('div'); d.innerHTML = (window.__pr[0] || { html: '' }).html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ''); return [...d.querySelectorAll('.blk')].map(b => ({ h: (b.querySelector('.hs') || {}).textContent, mats: [...new Set([...b.querySelectorAll('tbody tr:not(.sec)')].map(tr => tr.children[mode === 'saw' ? 5 : 3].textContent))] })); }, mode);
    const pr = await printOf(ps, 'saw'), prNames = [...new Set(pr.flatMap(b => b.mats))];
    rec('C0 the printed saw sheet has the 3 houses', pr.length === 3, JSON.stringify(pr));
    rec('[HIGH] C1 printed saw sheet (printWorkList): every house prints the board under ONE name', prNames.length === 1, JSON.stringify(pr));
    const prf = await printOf(ps, 'fit'), prfNames = [...new Set(prf.flatMap(b => b.mats))];
    rec('[MEDIUM] C2 printed stores sheet: the renamed fitting prints under ONE name', prfNames.length === 1, JSON.stringify(prf));
    // the on-screen bench table
    const scr = await ps.evaluate(() => ['L1', 'L2', 'L3'].map(id => { const d = document.createElement('div'); d.innerHTML = listTableHTML(lsList(id), 'saw'); return [...new Set(listRows(lsList(id)).filter(r => r.k === 'saw').map(r => r.mat))]; }));
    rec('[HIGH] C3 on-screen saw table (listRows / lsView): the 3 houses show the board under ONE name', new Set(scr.flat()).size === 1, JSON.stringify(scr));

    // ---- D. Waiting on material: one delivery of the board releases every job ----
    ['L1:3', 'L2:3', 'L3:3'].forEach(id => { const ln = S.db.t.list_lines.find(x => x.list_id === id.split(':')[0] && x.part === 'Top' && x.removed_rev == null); D.update(S.db, 'list_lines', ln, { status: 'waiting', status_at: '2026-10-21T08:30:00.000Z', status_by: 'Saw' }); });
    await reload(ps);
    const hb = await ps.evaluate(() => { const d = document.createElement('div'); d.innerHTML = holdBookHTML(['saw']); return [...d.querySelectorAll('.hold-grp')].map(g => ({ h: g.querySelector('.hold-gh span').textContent, n: g.querySelectorAll('.wl-drow').length, btn: g.querySelector('[data-relg]').dataset.relg })); });
    rec('D0 three "Top" rows are waiting on material', hb.reduce((s, g) => s + g.n, 0) === 3, JSON.stringify(hb));
    rec('[HIGH] D1 Waiting-on-material book (holdBookHTML): ONE group for the one board, so "ARRIVED — RELEASE ALL" releases all 3 houses', hb.length === 1 && hb[0].n === 3, JSON.stringify(hb));
    // the sheets panel leaves waiting rows out — and the totals after
    const n2 = await need(ps);
    rec('[HIGH] D2 Sheets needed with rows waiting: still ONE board line', n2.mats.length === 1, JSON.stringify(n2.mats));

    // ---- E. Stores dockets: the lines offered for a docket ----
    const dk = await ps.evaluate(() => typeof dkProjLines === 'function' ? [...new Set(dkProjLines('P1').filter(o => o.x.part === 'Hinge').map(o => o.x.material))] : null);
    rec('[MEDIUM] E1 Stores docket lines (dkProjLines): the renamed fitting is offered under ONE name for the 3 houses', dk && dk.length === 1, JSON.stringify(dk));

    // ---- F. control: after the other two lists ARE saved again everything is one name (so the cure is "save again") ----
    for (const id of ['L1', 'L3']) { await reload(p); await p.evaluate(id => openListEditor(id), id); await sleep(900); const rr = await rows(p), i = rr.findIndex(x => x.item === 'Side'); await setv(p, i + '|note', 'x'); await sleep(150); await save(p, 2200); await closeAll(p); }
    await reload(ps);
    const n3 = await need(ps);
    rec('F1 (control) once every list is saved again the saw sees ONE board line', n3.mats.length === 1, JSON.stringify(n3.mats));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
