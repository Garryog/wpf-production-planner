// Coder 18 Nov — saving audit 17 Nov, item 2 (Medium): re-uploading an Excel workbook over a list that was changed IN THE APP
// since its last upload names every typed row that would go (taken away / changed back) and asks; Cancel leaves the list as it
// is. No question when nothing typed goes (a plain re-upload, a tick only, a typed row the workbook now has too). Fake Supabase only.
// Run: node tests/list-window/c18-reupload-typed.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, asks, linesOf } = L;
const M = 'MFC White';
const ln = (part, qty, Lm, W, kind) => ({ kind: kind || 'saw', section: '', part, qty: String(qty), length_mm: Lm, width_mm: W, material: kind === 'fit' ? 'Blum hinge' : M, edging: '', edging2: '', note: '' });
const BOOK = [ln('Side', 2, 720, 560), ln('Top', 1, 1200, 560), ln('Hinge', 8, null, null, 'fit')];
const parts = (S, id) => linesOf(S, id).map(x => x.part + (x.length_mm ? ' ' + x.length_mm : '')).sort().join(', ');
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'SEED', { wos: [], name: 'seed (makes project P1)' });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    const up = (sheet, lines, ans) => p.evaluate(async ({ sheet, lines, ans }) => { window.__asked = []; window.__confirm = ans;
      const out = await lsImportWB({ project: 'Aderrig', sheets: {} }, [{ sheet, lines }], 'book.xlsx', 'Op', { pid: 'P1' }); return { out, asked: window.__asked }; }, { sheet, lines, ans });
    const idOf = name => (S.db.t.lists.find(l => l.name === name) || {}).id;
    const appEdit = (id, lines) => p.evaluate(async ({ id, lines }) => { await lsReloadList(id); const l = LST.l.get(id); await lsSaveList({ id, name: l.name, project_id: l.project_id }, lines, 'Mary', 'List edited'); }, { id, lines });

    // 1. first upload → a list from Excel; re-upload of the same book → no question
    let r = await up('Plot 77', BOOK, true); const id = idOf('Plot 77');
    rec('1a first upload makes the list (no question)', !!id && !r.asked.length && linesOf(S, id).length === 3, JSON.stringify(r));
    await sleep(30); r = await up('Plot 77', BOOK, true);
    rec('1b re-upload with no app change since → no question', !r.asked.length, JSON.stringify(r.asked));

    // 2. changed in the app: a typed row added and Top's length changed → re-upload asks, naming both
    await sleep(30);
    await appEdit(id, [ln('Side', 2, 720, 560), ln('Top', 1, 1000, 560), ln('Hinge', 8, null, null, 'fit'), ln('Shelf typed', 3, 500, 300)]);
    const before = parts(S, id), v0 = S.db.t.lists.find(l => l.id === id).version;
    r = await up('Plot 77', BOOK, false);
    const q = r.asked.join('\n');
    rec('2a re-upload asks, naming the typed rows: "Shelf typed 500×300 ×3 — MFC White — taken away" and "Top 1000×560 ×1 … — changed back to the workbook"',
      /changed in the app after its last Excel upload \(by Mary/.test(q) && /• Shelf typed 500×300 ×3 — MFC White — taken away/.test(q) && /• Top 1000×560 ×1 — MFC White — changed back to the workbook/.test(q) && !/• Side/.test(q) && !/• Hinge/.test(q), q);
    rec('2b Cancel → the list is left exactly as it is, and the sheet is reported as left alone', parts(S, id) === before && S.db.t.lists.find(l => l.id === id).version === v0 && (r.out.kept || []).includes('Plot 77') && r.out.n === 0, JSON.stringify([parts(S, id), r.out]));
    r = await up('Plot 77', BOOK, true);
    rec('2c OK → uploaded: the workbook\'s rows only (Shelf typed gone, Top 1200), asked ONCE (not twice)', parts(S, id) === 'Hinge, Side 720, Top 1200' && r.asked.length === 1, JSON.stringify([parts(S, id), r.asked.length]));
    rec('2d nothing deleted (the typed row is marked removed)', S.db.t.list_lines.some(x => x.list_id === id && x.part === 'Shelf typed' && x.removed_rev != null), '');

    // 3. after that upload, a tick only → no question
    await sleep(30);
    await p.evaluate(async id => { const x = lsLinesOf(id).find(y => y.part === 'Side' && y.removed_rev == null); await lsRpc('apply_line_changes', { p_changes: [{ id: x.id, status: 'cut', rev: 1 }], p_by: 'Saw' }); await lsReloadList(id); }, id);
    r = await up('Plot 77', BOOK, true);
    rec('3 only a tick since the upload → no question', !r.asked.length, JSON.stringify(r.asked));

    // 4. a typed row the new workbook ALSO has → nothing typed goes → no question
    await sleep(30);
    const live = await p.evaluate(id => lsLinesOf(id).filter(x => x.removed_rev == null).map(x => ({ id: x.id, kind: x.kind, section: x.section, part: x.part, qty: x.qty, length_mm: x.length_mm, width_mm: x.width_mm, material: x.material, edging: x.edging, edging2: x.edging2, note: x.note })), id);
    await appEdit(id, live.concat([ln('Plinth', 1, 2400, 150)]));
    r = await up('Plot 77', BOOK.concat([ln('Plinth', 1, 2400, 150)]), true);
    rec('4 the workbook now has the typed row too → no question, Plinth kept once', !r.asked.length && linesOf(S, id).filter(x => x.part === 'Plinth').length === 1, JSON.stringify([r.asked, parts(S, id)]));

    // 5. a list that was typed (never uploaded) is left to the usual flow — no new question from this check
    X.F3.seedList(S, 'TYP', { wos: [], name: 'Plot 78', list: { source: 'manual' } });
    await p.evaluate(async () => { await lsLoad(); });
    r = await up('Plot 78', BOOK, true);
    rec('5 a typed list (never uploaded): no "changed in the app after its last Excel upload" question', !r.asked.some(m => /after its last Excel upload/.test(m)), JSON.stringify(r.asked));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  L.finish();
})();
