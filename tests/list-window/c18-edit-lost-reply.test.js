// Coder 18 Nov — saving audit 17 Nov, item 1 (High): an EDIT whose reply is lost (the database took it, the network dropped the
// answer) gets the same "did it reach the database?" check a new list has: never "Not saved" for a save that landed, never a
// second copy of the new rows or a second Rev when Save is pressed again. Item 3 (app side): the empty-save guard flag
// (p_empty_ok) is sent only after "This save TAKES AWAY ALL …" → OK; works before the 18 Nov SQL (resent without it) and after
// (a save leaving no rows that nobody confirmed is refused by the database and explained). Fake Supabase only.
// Run: node tests/list-window/c18-edit-lost-reply.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, asks, setv, click, err, rows, linesOf } = L;
const F3 = X.F3;
const state = p => p.evaluate(() => ({ open: !!document.querySelector('.me-ed'), panel: !!document.querySelector('.me-dov'), err: (document.getElementById('me-err') || {}).textContent || '',
  toasts: (window.__toasts || []).slice(), sDis: (document.getElementById('me-save') || {}).disabled }));
const recToasts = p => p.evaluate(() => { window.__toasts = []; if (!window.__tw) { window.__tw = 1; const T = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return T.apply(this, arguments); }; } });
const open = async (p, id) => { await closeAll(p); await p.evaluate(id => { window.__toasts = []; window.__asked = []; openListEditor(id); }, id); await sleep(1200); };
const rowIx = async (p, item) => (await rows(p)).findIndex(r => r.item === item);
// add a saw row at the end of the list
const addRow = async (p, item, qty, Lm, W) => {
  const last = (await rows(p)).length - 1;
  await p.evaluate(i => { const e = document.querySelector('.me-ed [data-mr="' + i + '|item"]'); if (e) e.focus(); }, last);
  await click(p, 'me-addsaw'); await sleep(250);
  const i = last + 1;
  for (const [f, v] of [['item', item], ['qty', qty], ['L', Lm], ['W', W], ['mat', 'MFC White']]) await setv(p, i + '|' + f, v);
  await sleep(150); return i;
};
const listRow = (S, id) => S.db.t.lists.find(l => l.id === id);
const parts = (S, id) => linesOf(S, id).map(x => x.part);
const count = (S, id, part) => linesOf(S, id).filter(x => x.part === part).length;
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision');
// in the page: the NEXT save_list_revision call goes through (it lands), then "another screen" runs `then` against the database,
// and only then is the reply lost. mode 'nosend' = it never reaches the database (fails before sending).
const loseNext = (p, mode, then) => p.evaluate(({ mode, then }) => {
  const f0 = window.__f0 || (window.__f0 = window.fetch);
  window.fetch = async function (u, o) {
    if (!/\/rpc\/save_list_revision/.test(String(u))) return f0.apply(this, arguments);
    window.fetch = f0; // once
    if (mode === 'nosend') throw new TypeError('Failed to fetch');
    const r = await f0.apply(this, arguments), out = await r.json();
    if (then) { const L = out.list, ls = out.lines.filter(x => x.removed_rev == null).map(x => ({ ...x }));
      (new Function('ls', then))(ls);
      await f0(SUPA_URL + '/rpc/save_list_revision', { method: 'POST', headers: SUPA_HDR, body: JSON.stringify({ p_list: { id: L.id }, p_lines: ls, p_expect: L.version, p_by: 'Other PC', p_reason: 'other screen' }) }); }
    throw new TypeError('Failed to fetch');
  };
}, { mode, then: then || '' });
// the check after a lost reply can't reach the database once: the first GET of that list AFTER the save was sent fails
const failNextListGet = (p, id) => p.evaluate(id => {
  const f0 = window.__f0 || (window.__f0 = window.fetch), prev = window.fetch; let armed = false;
  window.fetch = function (u, o) {
    if (/\/rpc\/save_list_revision/.test(String(u))) armed = true;
    else if (armed && (!o || !o.method || o.method === 'GET') && String(u).includes('lists?select=*&id=eq.' + id)) { window.fetch = prev; return Promise.reject(new TypeError('Failed to fetch')); }
    return prev.apply(this, arguments); };
}, id);

(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row());
    for (const id of ['LA', 'LB', 'LC', 'LD', 'LE', 'LF', 'LG', 'LH']) F3.seedList(S, id, { name: 'House ' + id });
    listRow(S, 'LB').locked = true; // with the saw: every save is a new Rev
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p); await recToasts(p);
    await p.evaluate(() => { window.__prompt = 'drawing changed'; });

    // ---------- A. an edit (a row added + a qty changed), the database takes it, the reply is lost ----------
    await open(p, 'LA');
    await addRow(p, 'Shelf A', '2', '500', '300'); await setv(p, (await rowIx(p, 'Top')) + '|qty', '3');
    const vA = listRow(S, 'LA').version;
    S.dropReply = 1; await click(p, 'me-save'); await sleep(3000); let s = await state(p);
    rec('A1 the edit reached the database (Shelf A once, Top qty 3, version moved on)', count(S, 'LA', 'Shelf A') === 1 && linesOf(S, 'LA').find(x => x.part === 'Top').qty === '3' && listRow(S, 'LA').version > vA, JSON.stringify(parts(S, 'LA')));
    rec('A2 the person is NOT told "Not saved" — it is reported saved, and says the reply was lost but the database has it',
      !/not saved/i.test(s.err) && s.toasts.some(m => /List updated/.test(m) && /reply was lost — checked: the database has it/.test(m)), JSON.stringify(s));
    rec('A3 the check asked the database: exactly ONE save was sent', saves(S).filter(c => c.args.p_list.id === 'LA').length === 1, saves(S).length);
    const vA2 = listRow(S, 'LA').version;
    await open(p, 'LA'); await click(p, 'me-save'); await sleep(2500);
    rec('A4 opened again and Save pressed again → still ONE Shelf A, nothing new saved', count(S, 'LA', 'Shelf A') === 1 && listRow(S, 'LA').version === vA2, JSON.stringify([parts(S, 'LA'), listRow(S, 'LA').version, vA2]));
    rec('A5 a normal save never sends the empty-save flag', saves(S).every(c => !('p_empty_ok' in c.args)), '');

    // ---------- B. a LOCKED list (with the saw): lost reply → no second Rev when Save is pressed again ----------
    await open(p, 'LB'); await addRow(p, 'Shelf B', '1', '400', '300');
    S.dropReply = 1; await click(p, 'me-save'); await sleep(3000); s = await state(p);
    rec('B1 Rev 2 made once, the new row in once, reported saved (not "Not saved")', listRow(S, 'LB').rev === 2 && count(S, 'LB', 'Shelf B') === 1 && !/not saved/i.test(s.err) && s.toasts.some(m => /the database has it/.test(m)), JSON.stringify([listRow(S, 'LB').rev, parts(S, 'LB'), s.err, s.toasts]));
    await open(p, 'LB'); await click(p, 'me-save'); await sleep(2500);
    rec('B2 Save again on the reopened list → still Rev 2, one Shelf B, one kept copy', listRow(S, 'LB').rev === 2 && count(S, 'LB', 'Shelf B') === 1 && S.db.t.list_revisions.filter(r => r.list_id === 'LB').length === 1, JSON.stringify([listRow(S, 'LB').rev, parts(S, 'LB')]));

    // ---------- C. the save never reached the database (failed before sending) ----------
    await open(p, 'LC'); await addRow(p, 'Shelf C', '1', '400', '300');
    const vC = listRow(S, 'LC').version;
    await loseNext(p, 'nosend'); await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('C1 not in the database → "Not saved — the connection failed … before the database took it", window open, rows still there',
      listRow(S, 'LC').version === vC && s.open && /^Not saved — the connection failed .*before the database took it/.test(s.err) && (await rowIx(p, 'Shelf C')) >= 0, JSON.stringify(s));
    await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('C2 Save again → saved once (one Shelf C)', count(S, 'LC', 'Shelf C') === 1 && !/not saved/i.test(s.err), JSON.stringify([parts(S, 'LC'), s.err]));

    // ---------- D. it landed, but the database could not be checked; Save pressed again (nothing changed) ----------
    await open(p, 'LD'); await addRow(p, 'Shelf D', '1', '400', '300');
    S.dropReply = 1; await failNextListGet(p, 'LD'); await click(p, 'me-save'); await sleep(3000); s = await state(p);
    rec('D1 can\'t tell → "May have saved — … could not be checked", never "Not saved", window stays open', s.open && /^May have saved/.test(s.err) && /could not be checked/.test(s.err) && !/not saved/i.test(s.err), JSON.stringify(s));
    const vD = listRow(S, 'LD').version, nD = saves(S).length;
    await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('D2 Save again (connection back) → it checks first: "the database has it", ONE Shelf D, nothing sent twice', count(S, 'LD', 'Shelf D') === 1 && listRow(S, 'LD').version === vD && saves(S).length === nD && s.toasts.some(m => /the database has it/.test(m)), JSON.stringify([parts(S, 'LD'), listRow(S, 'LD').version, vD, saves(S).length - nD, s]));

    // ---------- D3. same, but the person changed another row before pressing Save again ----------
    await open(p, 'LE'); await addRow(p, 'Shelf E', '1', '400', '300');
    S.dropReply = 1; await failNextListGet(p, 'LE'); await click(p, 'me-save'); await sleep(3000);
    await setv(p, (await rowIx(p, 'Top')) + '|qty', '5'); await sleep(200);
    const nE = saves(S).length; await click(p, 'me-save'); await sleep(3000); s = await state(p);
    const eRows = s.open ? await rows(p) : [];
    rec('D3 the earlier save HAD landed and something was changed since → told so in words, the list reopened as the database has it (one Shelf E, Top not 5), nothing sent twice',
      count(S, 'LE', 'Shelf E') === 1 && linesOf(S, 'LE').find(x => x.part === 'Top').qty === '1' && saves(S).length === nE && s.toasts.some(m => /DID reach the database/.test(m) && /NOT saved/.test(m)) && s.open && eRows.filter(r => r.item === 'Shelf E').length === 1,
      JSON.stringify([parts(S, 'LE'), s.toasts.slice(-2), eRows.map(r => r.item + ':' + r.qty)]));
    // D4. can't tell, then the person CLOSES the window and opens the list again (it shows what the database has) and edits
    F3.seedList(S, 'LM', { name: 'House LM' }); await p.evaluate(async () => { await lsLoad(); });
    await open(p, 'LM'); await addRow(p, 'Shelf M', '1', '400', '300');
    S.dropReply = 1; await failNextListGet(p, 'LM'); await click(p, 'me-save'); await sleep(3000);
    await open(p, 'LM'); await setv(p, (await rowIx(p, 'Top')) + '|qty', '9'); await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('D4 closed and opened again after "may have saved" → a plain save: Top 9 saved, one Shelf M, no "DID reach … NOT saved" message',
      count(S, 'LM', 'Shelf M') === 1 && linesOf(S, 'LM').find(x => x.part === 'Top').qty === '9' && !s.toasts.some(m => /DID reach the database/.test(m)) && !/not saved|may have/i.test(s.err),
      JSON.stringify([parts(S, 'LM'), s.err, s.toasts]));

    // ---------- E. it landed, then another screen changed a DIFFERENT row before the check ----------
    await open(p, 'LF'); await addRow(p, 'Shelf F', '1', '400', '300');
    await loseNext(p, 'land', "ls.find(x=>x.part==='Hinge').qty='10';"); await click(p, 'me-save'); await sleep(3000); s = await state(p);
    rec('E1 our change is in, theirs too → reported saved ("another screen has changed the list since"), one Shelf F',
      count(S, 'LF', 'Shelf F') === 1 && linesOf(S, 'LF').find(x => x.part === 'Hinge').qty === '10' && !/not saved/i.test(s.err) && s.toasts.some(m => /another screen has changed the list since/.test(m)), JSON.stringify([parts(S, 'LF'), s.err, s.toasts]));

    // ---------- F. it landed, then another screen changed the SAME row (can't tell) ----------
    await open(p, 'LG'); await setv(p, (await rowIx(p, 'Top')) + '|qty', '4');
    await loseNext(p, 'land', "ls.find(x=>x.part==='Top').qty='7';"); await click(p, 'me-save'); await sleep(3000); s = await state(p);
    rec('F1 can\'t tell → "May have saved — … changed since (maybe on another screen)", window open, never "Not saved"', s.open && /^May have saved/.test(s.err) && /changed since/.test(s.err), JSON.stringify(s));
    const nG = saves(S).length; await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('F2 Save pressed again → still asks the person to close and reopen; nothing sent over the other screen\'s change', saves(S).length === nG && linesOf(S, 'LG').find(x => x.part === 'Top').qty === '7' && /Close the list and open it again/.test(s.err), JSON.stringify([saves(S).length - nG, s.err]));
    await closeAll(p);

    // ---------- G. the empty-save guard flag (item 3, app side) ----------
    const wipe = id => p.evaluate(async id => { window.__asked = []; window.__confirm = true;
      try { if (!LST.full.has(id)) await lsReloadList(id); await lsSaveList({ id, name: 'House ' + id, project_id: 'P1' }, [], 'Op', 'cancelled'); return { ok: true, asked: window.__asked }; }
      catch (e) { return { ok: false, msg: e.message, asked: window.__asked }; } }, id);
    // G1 after the SQL: confirmed → the flag is sent and the database lets it through
    S.db.sql18 = 'after'; let n0 = saves(S).length, g = await wipe('LH');
    let sent = saves(S).slice(n0);
    rec('G1 after the 18 Nov SQL: "TAKES AWAY 4 of the 4" → OK → saved with p_empty_ok, the list is empty (rows marked, never deleted)',
      g.ok && g.asked.some(m => /TAKES AWAY 4 of the 4/.test(m)) && sent.length === 1 && sent[0].args.p_empty_ok === true && linesOf(S, 'LH').length === 0 && S.db.t.list_lines.filter(x => x.list_id === 'LH').length === 4, JSON.stringify([g, sent.map(c => c.args.p_empty_ok)]));
    // G2 after the SQL: this screen has the list loaded with NO rows (it opened empty) but the database has 4; the person only
    // renames it → nobody is asked (the screen sees nothing taken away), no flag → the database refuses
    F3.seedList(S, 'LI', { wos: [], name: 'House LI' });
    n0 = saves(S).length;
    g = await p.evaluate(async () => { window.__asked = []; await lsReloadList('LI'); lsLinesOf('LI').forEach(x => LST.ln.delete(x.id)); LST.gen++; // the screen thinks it has none
      try { await lsSaveList({ id: 'LI', name: 'House LI renamed', project_id: 'P1' }, [], 'Op', 'x'); return { ok: true, asked: window.__asked }; } catch (e) { return { ok: false, msg: e.message, asked: window.__asked }; } });
    rec('G2 a save leaving no rows that nobody confirmed → the database refuses; the message says why in plain words; still 4 rows',
      !g.ok && /^the database refused it: this save would take away ALL 4 rows of "House LI"\. Nothing was changed\./.test(g.msg) && linesOf(S, 'LI').length === 4 && !('p_empty_ok' in (saves(S).slice(n0)[0] || { args: {} }).args), JSON.stringify(g));
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // G3 BEFORE the SQL: the flag is unknown to the database (404) → the app sends the same save again without it → saved
    S.db.sql18 = 'before'; F3.seedList(S, 'LJ', { wos: [], name: 'House LJ' }); await p.evaluate(async () => { await lsLoad(); });
    n0 = saves(S).length; g = await wipe('LJ'); sent = saves(S).slice(n0);
    rec('G3 before the 18 Nov SQL: confirmed wipe → first try with p_empty_ok (unknown → 404, nothing ran), then the same save without it → saved',
      g.ok && sent.length === 2 && sent[0].args.p_empty_ok === true && !('p_empty_ok' in sent[1].args) && linesOf(S, 'LJ').length === 0, JSON.stringify([g, sent.map(c => c.args.p_empty_ok)]));
    // G4 before the SQL, a normal edit: one call, no flag
    F3.seedList(S, 'LK', { name: 'House LK' }); await p.evaluate(async () => { await lsLoad(); });
    await open(p, 'LK'); await setv(p, (await rowIx(p, 'Top')) + '|qty', '2'); n0 = saves(S).length; await click(p, 'me-save'); await sleep(2500);
    sent = saves(S).slice(n0);
    rec('G4 before the SQL: a normal edit is one save with no flag, and saves', sent.length === 1 && !('p_empty_ok' in sent[0].args) && linesOf(S, 'LK').find(x => x.part === 'Top').qty === '2', JSON.stringify([sent.map(c => Object.keys(c.args)), await state(p), (await rows(p)).map(r => r.item)]));
    S.db.sql18 = 'after'; await closeAll(p);
    await open(p, 'LK'); await setv(p, (await rowIx(p, 'Top')) + '|qty', '6'); n0 = saves(S).length; await click(p, 'me-save'); await sleep(2500);
    rec('G5 after the SQL: a normal edit still saves (one call, no flag)', saves(S).length === n0 + 1 && linesOf(S, 'LK').find(x => x.part === 'Top').qty === '6', '');
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  L.finish();
})();
