// Tester round 8 (18 Nov) — attack on commit 5330d54: an EDIT whose reply is lost (lsEditLanded: saved / not saved / "may have
// saved", then Save again) from the template editor, Save & close, "Update template", and two windows on one list; the Excel
// re-upload warning (lsTypedGoing) on lists with × blocks and headings; the empty-save flag with S.db.sql18 'before' / 'after'.
// Fake Supabase only. Run: node tests/list-window/attack8-editlost.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, asks, setv, click, rows, linesOf } = L;
const F3 = X.F3, M = 'MFC White';
const listRow = (S, id) => S.db.t.lists.find(l => l.id === id);
const count = (S, id, part) => linesOf(S, id).filter(x => x.part === part).length;
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision');
// the check after a lost reply can't reach the database once (the first GET of that list after the save was sent fails)
const failNextListGet = (p, id) => p.evaluate(id => {
  const prev = window.fetch; let armed = false;
  window.fetch = function (u, o) {
    if (/\/rpc\/save_list_revision/.test(String(u))) armed = true;
    else if (armed && (!o || !o.method || o.method === 'GET') && String(u).includes('lists?select=*&id=eq.' + id)) { window.fetch = prev; return Promise.reject(new TypeError('Failed to fetch')); }
    return prev.apply(this, arguments); };
}, id);
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row());
    for (const id of ['LA', 'LB', 'LC', 'LW1', 'LW2', 'LH']) F3.seedList(S, id, { name: 'House ' + id });
    F3.seedList(S, 'TT', { wos: [], name: 'Type T', list: { is_template: true, type_name: 'Type T', list_type: 'kitchen' } });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(() => { window.__prompt = 'drawing changed'; window.__toasts = []; const T0 = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return T0.apply(this, arguments); }; });
    await p.evaluate(async () => { await lsLoad(); });
    const st = () => p.evaluate(() => ({ open: document.querySelectorAll('.pod-ovl .me-ed').length, err: [...document.querySelectorAll('#me-err')].map(e => e.textContent).join(' | '), toasts: window.__toasts.slice(-3) }));
    const openEd = async (id, keep) => { if (!keep) await closeAll(p); const ok = await p.evaluate(async id => { window.__toasts = []; await lsReloadList(id); const e = openListEditor(id); (window.__eds = window.__eds || []).push(e); return !!e; }, id); await sleep(1300); if (!ok) throw new Error('openListEditor(' + id + ') gave no editor object'); };
    const addR = (i, item) => p.evaluate(({ i, item }) => { const e = window.__eds[window.__eds.length - 1 - i]; e.st.rows.push({ k: 'part', item, qty: '1', L: '400', W: '300', mat: 'MFC White', edging: '', edging2: '', note: '' }); e.draw(); }, { i, item });
    const press = (ix, id) => p.evaluate(({ ix, id }) => { const o = [...document.querySelectorAll('.pod-ovl')].filter(x => x.querySelector('.me-ed'))[ix]; o.querySelector('#' + id).click(); }, { ix, id });
    const qtyOf = (S, id, part) => (linesOf(S, id).find(x => x.part === part) || {}).qty;

    // ---------- A. the TEMPLATE editor, lost reply ----------
    await p.evaluate(() => { window.__eds = []; }); await openEd('TT');
    await addR(0, 'Tpl shelf'); const rA = listRow(S, 'TT').rev;
    S.dropReply = 1; await press(0, 'me-save'); await sleep(3000); let s = await st();
    rec('A1: template edit, reply lost → reported saved ("the database has it"), ONE Tpl shelf, never "Not saved"', count(S, 'TT', 'Tpl shelf') === 1 && !/not saved/i.test(s.err) && s.toasts.some(m => /the database has it/.test(m)), JSON.stringify(s));
    await press(0, 'me-save').catch(() => {}); await sleep(2500);
    await openEd('TT'); await press(0, 'me-save'); await sleep(2500);
    rec('A2: Save again (same window, then reopened) → still one Tpl shelf, one new Rev only', count(S, 'TT', 'Tpl shelf') === 1 && listRow(S, 'TT').rev <= rA + 1, JSON.stringify([count(S, 'TT', 'Tpl shelf'), rA, listRow(S, 'TT').rev]));
    await closeAll(p);

    // ---------- B. Save & close, lost reply ----------
    await openEd('LA'); await addR(0, 'SC shelf');
    S.dropReply = 1; await press(0, 'me-saveclose'); await sleep(3000); s = await st();
    rec('B1: Save & close, reply lost but it landed → window closes, told "the database has it", ONE SC shelf', s.open === 0 && count(S, 'LA', 'SC shelf') === 1 && s.toasts.some(m => /the database has it/.test(m)), JSON.stringify(s));
    await openEd('LB'); await addR(0, 'SC2 shelf');
    S.dropReply = 1; await failNextListGet(p, 'LB'); await press(0, 'me-saveclose'); await sleep(3000); s = await st();
    rec('[HIGH if it fails] B2: Save & close, reply lost AND the check fails → window STAYS OPEN with "May have saved", rows kept', s.open === 1 && /May have saved/.test(s.err) && (await rows(p)).some(r => r.item === 'SC2 shelf'), JSON.stringify(s));
    const nB = saves(S).length; await press(0, 'me-saveclose'); await sleep(3000); s = await st();
    rec('B3: Save & close again (connection back) → checks first, nothing sent twice, ONE SC2 shelf, window closes', count(S, 'LB', 'SC2 shelf') === 1 && saves(S).length === nB && s.open === 0, JSON.stringify([count(S, 'LB', 'SC2 shelf'), saves(S).length - nB, s]));
    // the save never left: Save & close must not close
    await openEd('LC'); await addR(0, 'SC3 shelf'); const vC = listRow(S, 'LC').version;
    await p.evaluate(() => { const f0 = window.fetch; window.fetch = function (u, o) { if (/\/rpc\/save_list_revision/.test(String(u))) { window.fetch = f0; return Promise.reject(new TypeError('Failed to fetch')); } return f0.apply(this, arguments); }; });
    await press(0, 'me-saveclose'); await sleep(2500); s = await st();
    rec('B4: Save & close, never reached the database → window stays open, "Not saved — the connection failed…", rows kept', s.open === 1 && /Not saved/.test(s.err) && listRow(S, 'LC').version === vC && (await rows(p)).some(r => r.item === 'SC3 shelf'), JSON.stringify(s));
    await closeAll(p);

    // ---------- C. two windows on ONE list (same PC) ----------
    await p.evaluate(() => { window.__eds = []; }); await openEd('LW1'); await openEd('LW1', true);
    rec('C0 set-up: two windows open on House LW1', (await st()).open === 2);
    // window 1 (the first opened = overlay 0): adds a row; reply lost, check fails → "may have saved"
    await addR(1, 'Win1 shelf'); S.dropReply = 1; await failNextListGet(p, 'LW1'); await press(0, 'me-save'); await sleep(3000);
    const c1 = await st();
    rec('C1: window 1 → "May have saved"', /May have saved/.test(c1.err), JSON.stringify(c1));
    // window 2 changes Top and saves
    await p.evaluate(() => { const e = window.__eds[1]; const r = e.st.rows.find(x => x.item === 'Top'); r.qty = '5'; e.draw(); }); await press(1, 'me-save'); await sleep(3000);
    const c2 = await st();
    rec('C2: window 2 saves its own change → Top 5, Win1 shelf (already in the database) still ONCE', qtyOf(S, 'LW1', 'Top') === '5' && count(S, 'LW1', 'Win1 shelf') === 1, JSON.stringify([linesOf(S, 'LW1').map(x => x.part + ':' + x.qty), c2]));
    await p.evaluate(() => document.querySelectorAll('.me-dov').forEach(x => x.remove()));
    // window 1 presses Save again
    await press(0, 'me-save'); await sleep(3000); const c3 = await st();
    rec('[HIGH if it fails] C3: window 1 presses Save again → Win1 shelf still ONCE (no second copy), Top stays 5 (window 2\'s change not undone)', count(S, 'LW1', 'Win1 shelf') === 1 && qtyOf(S, 'LW1', 'Top') === '5', JSON.stringify([linesOf(S, 'LW1').map(x => x.part + ':' + x.qty), c3]));
    await closeAll(p);

    // ---------- D. "Update template" from a house list, reply lost ----------
    const upd = async (lid, mode) => { await openEd(lid); await addR(0, 'Upd ' + mode);
      await press(0, 'me-astpl'); await sleep(600);
      await p.evaluate(() => { const n = document.getElementById('at-name'); n.value = 'Type T'; n.dispatchEvent(new Event('input')); }); await sleep(300);
      return p.evaluate(() => ({ btn: (document.getElementById('at-ok') || {}).textContent || '' })); };
    let u = await upd('LH', 'lost');
    rec('D0 set-up: Save as template offers "Update template → Rev …" for Type T', /Update template/.test(u.btn), JSON.stringify(u));
    let rT = listRow(S, 'TT').rev; S.dropReply = 1; await p.evaluate(() => document.getElementById('at-ok').click()); await sleep(3000);
    let dd = await p.evaluate(() => ({ err: (document.getElementById('at-err') || {}).innerText || '', open: !!document.getElementById('at-ok'), toasts: window.__toasts.slice(-2) }));
    rec('D1: Update template, reply lost but it landed → reported done (not "Not saved"), template Rev +1 once', !/not saved/i.test(dd.err) && listRow(S, 'TT').rev === rT + 1 && count(S, 'TT', 'Upd lost') === 1, JSON.stringify([dd, rT, listRow(S, 'TT').rev]));
    await closeAll(p);
    u = await upd('LH', 'cant'); rT = listRow(S, 'TT').rev;
    S.dropReply = 1; await failNextListGet(p, 'TT'); await p.evaluate(() => document.getElementById('at-ok').click()); await sleep(3000);
    dd = await p.evaluate(() => ({ err: (document.getElementById('at-err') || {}).innerText || '', open: !!document.getElementById('at-ok') }));
    rec('D2: Update template, reply lost and the check fails → "May have saved", never "Not saved"', /May have saved/.test(dd.err) && !/^Not saved/.test(dd.err), JSON.stringify(dd));
    const nD = saves(S).length; await p.evaluate(() => { const b = document.getElementById('at-ok'); if (b) b.click(); }); await sleep(3000);
    dd = await p.evaluate(() => ({ err: (document.getElementById('at-err') || {}).innerText || '', open: !!document.getElementById('at-ok'), toasts: window.__toasts.slice(-2) }));
    rec('(MEDIUM/LOW) D3: "Update template" pressed again (as the message says) → no second Rev, and NOT told someone else updated it on another screen', listRow(S, 'TT').rev === rT + 1 && count(S, 'TT', 'Upd cant') === 1 && !/updated this template on another screen/.test(dd.err + dd.toasts.join(' ')), JSON.stringify([dd, saves(S).length - nD, rT, listRow(S, 'TT').rev]));
    await closeAll(p);

    // ---------- E. Excel re-upload over a list with a × block and headings ----------
    const ln = (kind, part, qty, Lm, W, sec, uq) => ({ kind, section: sec || '', part, qty: qty == null ? null : String(qty), unit_qty: uq == null ? '' : String(uq), length_mm: Lm, width_mm: W, material: kind === 'hdr' ? '' : kind === 'fit' ? 'Blum hinge' : M, edging: '', edging2: '', note: '' });
    const BOOK = [ln('hdr', 'Floor 2', 4), ln('fit', 'Leg', 32, null, null, 'Floor 2', 8), ln('hdr', 'Kickers', null, null, null, 'Floor 2'), ln('saw', 'Kicker', 4, 2400, 150, 'Kickers', 1), ln('hdr', 'Worktops'), ln('saw', 'Worktop', 1, 3600, 600, 'Worktops')];
    const up = (lines, ans) => p.evaluate(async ({ lines, ans }) => { window.__asked = []; window.__confirm = ans; const out = await lsImportWB({ project: 'Aderrig', sheets: {} }, [{ sheet: 'Plot 9', lines }], 'book.xlsx', 'Op', { pid: 'P1' }); return { out, asked: window.__asked.slice() }; }, { lines, ans });
    const idOf = () => (S.db.t.lists.find(l => l.name === 'Plot 9') || {}).id;
    const appEdit = (id, fn) => p.evaluate(async ({ id, fn }) => { await lsReloadList(id); const l = LST.l.get(id); const ls = lsLinesOf(id).filter(x => x.removed_rev == null).map(x => ({ ...x }));
      (new Function('ls', fn))(ls); lsBlockTotals(ls); await lsSaveList({ id, name: l.name, project_id: l.project_id }, ls, 'Mary', 'List edited'); }, { id, fn });
    let r = await up(BOOK, true); const id = idOf();
    rec('E0 set-up: workbook with a × 4 block, a sub-heading and a heading uploaded', !!id && linesOf(S, id).length === 6, JSON.stringify(r));
    await sleep(40); r = await up(BOOK, true);
    rec('E1: the same workbook again, no app change → no question (no false alarm from the × block)', !r.asked.length, JSON.stringify(r.asked));
    await sleep(40); await appEdit(id, "ls.find(x=>x.part==='Leg').unit_qty='10';");
    r = await up(BOOK, false);
    rec('E2: Leg changed in the app to 10 per floor (× 4) → re-upload asks and names "Leg … changed back to the workbook"', r.asked.some(m => /• Leg .*changed back to the workbook/.test(m)), JSON.stringify(r.asked));
    rec('E2b: …Cancel → Leg stays 10 per floor (40)', String((linesOf(S, id).find(x => x.part === 'Leg') || {}).qty) === '40', JSON.stringify(linesOf(S, id).map(x => x.part + ':' + x.qty + '/' + x.unit_qty)));
    r = await up(BOOK, true); await sleep(40);
    await appEdit(id, "ls.find(x=>x.part==='Worktops').part='Worktops & tops';ls.filter(x=>x.section==='Worktops').forEach(x=>x.section='Worktops & tops');");
    r = await up(BOOK, true);
    rec('(LOW) E3: only a HEADING renamed in the app → re-upload names it before putting the old name back', r.asked.some(m => /Worktops & tops/.test(m)), JSON.stringify([r.asked, linesOf(S, id).filter(x => x.kind === 'hdr').map(x => x.part)]));
    await sleep(40); await appEdit(id, "ls.find(x=>x.part==='Floor 2').qty='5';");
    r = await up(BOOK, false);
    rec('E4: the number of floors changed in the app (× 4 → × 5) → re-upload asks (Leg / Kicker totals named)', r.asked.length === 1 && /Leg|Kicker|Floor 2/.test(r.asked[0]), JSON.stringify(r.asked));

    // ---------- F. the empty-save flag from the WINDOW (sql18 before / after) ----------
    const wipeWin = async (lid, ans) => { await openEd(lid); await p.evaluate(ans => { window.__asked = []; window.__confirm = ans; const e = window.__eds[window.__eds.length - 1]; e.st.rows.splice(0, e.st.rows.length); e.draw(); }, ans); await sleep(200);
      const n0 = saves(S).length; await press(0, 'me-save'); await sleep(3000); return { sent: saves(S).slice(n0).map(c => ('p_empty_ok' in c.args) ? c.args.p_empty_ok : 'none'), asked: await p.evaluate(() => window.__asked.slice()), s: await st() }; };
    for (const id2 of ['FA', 'FB', 'FC', 'FD']) F3.seedList(S, id2, { name: 'House ' + id2 }); await p.evaluate(async () => { await lsLoad(); });
    let w = await wipeWin('FA', true);
    rec('(info) F0: the list WINDOW refuses to save with every row deleted ("Add at least one row.") — the empty-save flag is reached only by Excel re-upload / code paths', !w.sent.length && /Add at least one row/.test(w.s.err), JSON.stringify(w));
    await closeAll(p);
    const upE = (sheet, lines, ans) => p.evaluate(async ({ sheet, lines, ans }) => { window.__asked = []; window.__confirm = ans; let out, e2 = '';
      try { out = await lsImportWB({ project: 'Aderrig', sheets: {} }, [{ sheet, lines }], 'b.xlsx', 'Op', { pid: 'P1' }); } catch (e) { e2 = e.message; } return { out, e2, asked: window.__asked.slice() }; }, { sheet, lines, ans });
    const ONE = [{ kind: 'saw', section: '', part: 'Side', qty: '2', length_mm: 720, width_mm: 560, material: 'MFC White', edging: '', edging2: '', note: '' }];
    const lid = nm => (S.db.t.lists.find(l => l.name === nm) || {}).id;
    for (const nm of ['Plot E1', 'Plot E2', 'Plot E3', 'Plot E4']) await upE(nm, ONE, true);
    S.db.sql18 = 'after';
    let n0 = saves(S).length; let e = await upE('Plot E1', [], false);
    rec('F1 (after): an EMPTY sheet re-uploaded over a list → asked "TAKES AWAY 1 of the 1"; Cancel → nothing sent, the row kept', saves(S).length === n0 && linesOf(S, lid('Plot E1')).length === 1 && e.asked.some(m => /TAKES AWAY 1 of the 1/.test(m)), JSON.stringify([e, saves(S).length - n0]));
    n0 = saves(S).length; e = await upE('Plot E2', [], true); let sent = saves(S).slice(n0).map(c => ('p_empty_ok' in c.args) ? c.args.p_empty_ok : 'none');
    rec('F2 (after): …OK → sent once with the flag, the list empty, no error', JSON.stringify(sent) === '[true]' && linesOf(S, lid('Plot E2')).length === 0 && !e.e2, JSON.stringify([e, sent]));
    S.db.sql18 = 'before';
    n0 = saves(S).length; e = await upE('Plot E3', [], true); sent = saves(S).slice(n0).map(c => ('p_empty_ok' in c.args) ? c.args.p_empty_ok : 'none');
    rec('F3 (before): OK → refused as unknown, sent again without the flag, list empty', JSON.stringify(sent) === '[true,"none"]' && linesOf(S, lid('Plot E3')).length === 0 && !e.e2, JSON.stringify([e, sent]));
    S.db.sql18 = 'after'; S.dropReply = 1;
    n0 = saves(S).length; e = await upE('Plot E4', [], true); S.dropReply = 0; sent = saves(S).slice(n0);
    rec('F4 (after): OK, the empty save LANDS but its reply is lost → not reported as a failure (no "could not save"), sent once, list empty', linesOf(S, lid('Plot E4')).length === 0 && sent.length === 1 && !e.e2, JSON.stringify([e, sent.length]));
    // a typed list (an app edit since the upload) wiped by an empty sheet: one question, not two
    await upE('Plot E5', ONE, true); await sleep(40);
    await p.evaluate(async id => { await lsReloadList(id); const l = LST.l.get(id); const ls = lsLinesOf(id).filter(x => x.removed_rev == null).map(x => ({ ...x })); ls[0].qty = '3'; await lsSaveList({ id, name: l.name, project_id: l.project_id }, ls, 'Mary', 'List edited'); }, lid('Plot E5'));
    n0 = saves(S).length; e = await upE('Plot E5', [], true); sent = saves(S).slice(n0).map(c => ('p_empty_ok' in c.args) ? c.args.p_empty_ok : 'none');
    rec('F5 (after): typed-in-the-app list + empty sheet → ONE question (the typed-rows one), flag sent, list empty', e.asked.length === 1 && JSON.stringify(sent) === '[true]' && linesOf(S, lid('Plot E5')).length === 0, JSON.stringify([e.asked.map(m => m.slice(0, 60)), sent, e.e2]));
    // a 3-sheet workbook: sheet 2 is empty over an existing list, Cancel on that question
    await upE('Plot G2', ONE, true);
    const g = await p.evaluate(async () => { window.__asked = []; window.__confirm = m => !/TAKES AWAY/.test(m); const one = [{ kind: 'saw', section: '', part: 'Side', qty: '2', length_mm: 720, width_mm: 560, material: 'MFC White', edging: '', edging2: '', note: '' }]; let out, e2 = '';
      try { out = await lsImportWB({ project: 'Aderrig', sheets: {} }, [{ sheet: 'Plot G1', lines: one }, { sheet: 'Plot G2', lines: [] }, { sheet: 'Plot G3', lines: one }], 'b.xlsx', 'Op', { pid: 'P1' }); } catch (e) { e2 = e.message; } window.__confirm = true; return { out, e2 }; });
    rec('(MEDIUM/LOW) F6: 3-sheet workbook, Cancel on "TAKES AWAY" for sheet 2 → sheet 2 left alone AND sheet 3 still imported (as "Cancel = this sheet is skipped" for typed rows)', !!lid('Plot G3') && linesOf(S, lid('Plot G2')).length === 1, JSON.stringify([g, !!lid('Plot G1'), !!lid('Plot G3')]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  L.finish();
})();
