// Coder 18 Nov (Manager condition 3): a "yes, take those rows away" answer — and the empty-save flag p_empty_ok — count only for
// the rows they were given for. When a save is retried because another PC changed the list meanwhile ("stale"), and the rows it
// would now take away are a different set, it asks AGAIN; Cancel saves nothing. Same for an Excel re-upload over a list typed in
// the app. Fake Supabase only. Run: node tests/list-window/c18-retry-reask.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, asks, linesOf } = L;
const F3 = X.F3;
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision');
const M = 'MFC White';
const ln = (part, qty, Lm, W) => ({ kind: 'saw', section: '', part, qty: String(qty), length_mm: Lm, width_mm: W, material: M, edging: '', edging2: '', note: '' });
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row()); S.db.sql18 = 'after';
    for (const id of ['RA', 'RB', 'RC']) F3.seedList(S, id, { wos: [], name: 'House ' + id });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    // the NEXT save of list `id` meets another PC's change first: `fn(S, list)` runs on the database, then the save goes in (→ stale)
    let pending = null;
    await p.route('**/rpc/save_list_revision', route => { try { const a = JSON.parse(route.request().postData() || '{}');
      if (pending && a.p_list && a.p_list.id === pending.id) { const f = pending.fn; pending = null; f(S, S.db.t.lists.find(l => l.id === a.p_list.id)); } } catch (e) {} return route.fallback(); });
    const otherAdds = (part) => (S2, l) => { D.insert(S2.db, 'list_lines', { id: l.id + ':' + part, list_id: l.id, seq: 50, kind: 'saw', part, qty: '1', length_mm: 300, width_mm: 200, material: M }); D.update(S2.db, 'lists', l, { updated_by: 'Other PC' }); };
    const otherRenames = (S2, l) => { D.update(S2.db, 'lists', l, { name: l.name + ' (renamed)' }); };
    const wipe = (id, answers) => p.evaluate(async ({ id, answers }) => { window.__asked = []; let k = 0; window.__confirm = m => { const a = answers[Math.min(k, answers.length - 1)]; k++; return a; };
      try { await lsReloadList(id); await lsSaveList({ id, project_id: 'P1' }, [], 'Op', 'cancelled'); return { ok: true, asked: window.__asked }; }
      catch (e) { return { ok: false, msg: e.message, asked: window.__asked }; } finally { window.__confirm = true; } }, { id, answers });

    // 1. OK to "4 of the 4"; another PC adds a 5th row meanwhile → asked again "5 of the 5"; Cancel → nothing saved
    pending = { id: 'RA', fn: otherAdds('Other PC shelf') }; let n0 = saves(S).length;
    let r = await wipe('RA', [true, false]);
    rec('1a asked twice: "TAKES AWAY 4 of the 4", then (after the other PC\'s row) "TAKES AWAY 5 of the 5"', r.asked.length === 2 && /4 of the 4/.test(r.asked[0]) && /5 of the 5/.test(r.asked[1]), JSON.stringify(r.asked.map(m => m.slice(0, 50))));
    rec('1b Cancel on the second question → "Not saved", the list keeps all 5 rows', !r.ok && /Not saved/.test(r.msg) && linesOf(S, 'RA').length === 5, JSON.stringify([r.msg, linesOf(S, 'RA').length]));
    rec('1c only the first (refused as stale) save was sent — nothing after the Cancel', saves(S).length - n0 === 1, String(saves(S).length - n0));
    // 2. same, OK both times → saved, with p_empty_ok on the save that went through
    pending = { id: 'RB', fn: otherAdds('Other PC shelf') }; n0 = saves(S).length;
    r = await wipe('RB', [true, true]); let sent = saves(S).slice(n0);
    rec('2 OK to both → saved empty; the flag rides on the second save, which was asked for 5 of the 5', r.ok && r.asked.length === 2 && linesOf(S, 'RB').length === 0 && sent.length === 2 && sent[1].args.p_empty_ok === true, JSON.stringify([r, sent.map(c => c.args.p_empty_ok)]));
    // 3. the other PC only renamed the list (same rows) → the first OK still stands: asked once
    pending = { id: 'RC', fn: otherRenames }; n0 = saves(S).length;
    r = await wipe('RC', [true]); sent = saves(S).slice(n0);
    rec('3 retry with the SAME rows to take away (the other PC only renamed it) → asked once, saved', r.ok && r.asked.length === 1 && linesOf(S, 'RC').length === 0 && sent.length === 2 && sent[1].args.p_empty_ok === true, JSON.stringify([r, sent.length]));

    // 4. Excel re-upload over a list typed in the app: OK to the typed-rows question; another PC adds a row meanwhile → the
    //    "TAKES AWAY" question is asked for the new set; Cancel → this sheet is skipped, nothing changed
    const up = (lines, answers) => p.evaluate(async ({ lines, answers }) => { window.__asked = []; let k = 0; window.__confirm = m => { const a = answers[Math.min(k, answers.length - 1)]; k++; return a; };
      try { const out = await lsImportWB({ project: 'Aderrig', sheets: {} }, [{ sheet: 'Plot R1', lines }], 'book.xlsx', 'Op', { pid: 'P1' }); return { out, asked: window.__asked }; } finally { window.__confirm = true; } }, { lines, answers });
    const BOOK = [ln('Side', 2, 720, 560), ln('Top', 1, 1200, 560), ln('Back', 1, 700, 500)];
    await up(BOOK, [true]); const lid = (S.db.t.lists.find(l => l.name === 'Plot R1') || {}).id;
    await sleep(40);
    await p.evaluate(async id => { await lsReloadList(id); const l = LST.l.get(id); const ls = lsLinesOf(id).filter(x => x.removed_rev == null).map(x => ({ ...x }));
      ls.push({ kind: 'saw', section: '', part: 'Shelf typed', qty: '3', length_mm: 500, width_mm: 300, material: 'MFC White' }); await lsSaveList({ id, name: l.name, project_id: l.project_id }, ls, 'Mary', 'List edited'); }, lid);
    pending = { id: lid, fn: otherAdds('Bracket') }; n0 = saves(S).length;
    r = await up([ln('Side', 2, 720, 560)], [true, false]);
    rec('4a re-upload: the typed-rows question (OK), then — after the other PC\'s row — "TAKES AWAY 4 of the 5" asked', r.asked.length === 2 && /typed in the app/.test(r.asked[0]) && /TAKES AWAY 4 of the 5/.test(r.asked[1]), JSON.stringify(r.asked.map(m => m.slice(0, 60))));
    rec('4b Cancel → the sheet is skipped and the list keeps its 5 rows (Bracket and the typed Shelf included)', (r.out.kept || []).includes('Plot R1') && linesOf(S, lid).length === 5 && linesOf(S, lid).some(x => x.part === 'Shelf typed'), JSON.stringify([r.out, linesOf(S, lid).map(x => x.part)]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  L.finish();
})();
