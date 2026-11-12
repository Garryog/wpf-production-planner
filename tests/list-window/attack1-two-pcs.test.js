// Tester attack (list window, simple layout, 12 Nov): TWO PCs on the same work order.
// Never two live lists for one WO; nothing lost without the person being told.
// Fake Supabase only. Run: node tests/list-window/attack1-two-pcs.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;

function row() {
  const r = X.v2Row();
  for (let i = 60; i < 72; i++) r.orders.push(H.order({ wo: 'WO-' + i, customer: 'Aderrig Homes', floor: 'T10', unit: String(i), title: 'HOUSE ' + i, dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    X.F3.seedList(S, 'LF1', { wos: ['WO-68'], name: 'Seeded 68' }); X.F3.seedList(S, 'LF2', { wos: ['WO-69'], name: 'Seeded 69' });
    const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'office');
    const pa = a.page, pb = b.page;
    await asks(pa); await asks(pb);
    let rel;

    // ---- A. both open a NEW list for WO-60, both type, both press Save at the same moment
    await pa.evaluate(() => openListEditor(null, 'WO-60')); await pb.evaluate(() => openListEditor(null, 'WO-60')); await sleep(800);
    await fillSaw(pa, 0, 'Side A', '2', '720', '560', 'MFC White'); await fillSaw(pb, 0, 'Side B', '3', '700', '500', 'MFC White');
    S.hold3 = new Promise(r => { rel = r; });
    await click(pa, 'me-save'); await click(pb, 'me-save'); await sleep(500); rel(); S.hold3 = null; await sleep(2500);
    let live = liveFor(S, 'WO-60');
    rec('A. two PCs Save a new list for WO-60 at the same moment → exactly ONE live list for WO-60', live.length === 1, JSON.stringify(live.map(l => l.id + ':' + l.name)));
    const da = await donep(pa), db = await donep(pb), ea = await err(pa), eb = await err(pb);
    const winners = [da, db].filter(Boolean).length;
    rec('A. …one PC shows "Saved ✓", the other is still open and TOLD plainly (not saved, which list has the WO)', winners === 1 && /already got a list on another PC|already has/.test(da ? eb : ea), JSON.stringify({ da: da && da.h, db: db && db.h, ea, eb }));
    const loser = da && !db ? pb : pa;
    const lr = await rows(loser);
    rec('A. …the loser\'s typed row is still in its window (nothing thrown away)', await ed(loser) && lr.some(r => /^Side [AB]$/.test(r.item)), JSON.stringify(lr));
    // the loser presses Save again (old-school: "it didn't take, press it again")
    if (await ed(loser)) await save(loser, 1800);
    live = liveFor(S, 'WO-60');
    rec('A. …the loser presses Save AGAIN → still ONE live list for WO-60', live.length === 1, JSON.stringify(live.map(l => l.id)));
    rec('A. …and it still says why (not a silent nothing)', /already got a list|already has/.test(await err(loser)), await err(loser));
    await closeAll(pa); await closeAll(pb);

    // ---- B. PC A saves while PC B has the window open (typed, not polled); B saves a minute later
    await pa.evaluate(() => openListEditor(null, 'WO-61')); await pb.evaluate(() => openListEditor(null, 'WO-61')); await sleep(800);
    await fillSaw(pb, 0, 'B first row', '1', '600', '400', 'MFC White');
    await fillSaw(pa, 0, 'A row', '2', '720', '560', 'MFC White');
    await save(pa);
    rec('B. PC A saved WO-61 first', !!(await donep(pa)) && liveFor(S, 'WO-61').length === 1);
    await save(pb, 1800);
    live = liveFor(S, 'WO-61');
    const eB = await err(pb);
    rec('B. PC B (window open since before) presses Save → refused, ONE live list', live.length === 1 && !(await donep(pb)), JSON.stringify({ n: live.length, eB }));
    rec('B. …B is told which list has the WO and that nothing was saved', /WO-61 already got a list on another PC/.test(eB) && /no second list/.test(eB), eB);
    rec('B. …B\'s row is still on screen to copy across', (await rows(pb)).some(r => r.item === 'B first row'));
    // B then polls (30 s later) — is the window still there, row kept?
    await pb.evaluate(async () => { await lsPoll(); }); await sleep(500);
    rec('B. …after the 30 s refresh B\'s window and row are still there', await ed(pb) && (await rows(pb)).some(r => r.item === 'B first row'));
    await closeAll(pa); await closeAll(pb);
    // B2. "Change job" on a NEW list: move the typed rows to another WO (WO-62) and Save → on WO-62 only
    await pb.evaluate(() => openListEditor(null, 'WO-70')); await sleep(800);
    await fillSaw(pb, 0, 'B first row', '1', '600', '400', 'MFC White');
    const tog = await click(pb, 'me-jobtog'); await sleep(300);
    await setid(pb, 'me-wo', 'WO-62'); await sleep(400);
    let jb = await job(pb);
    rec('B2. Change job → WO-62: title bar shows WO-62 and the picker holds WO-62', tog === 'ok' && jb.hwo === 'WO-62' && jb.wo === 'WO-62', JSON.stringify(jb));
    await save(pb, 1800);
    rec('B2. …Save → one live list on WO-62 with the row; nothing on WO-70', liveFor(S, 'WO-62').length === 1 && liveFor(S, 'WO-70').length === 0 && linesOf(S, liveFor(S, 'WO-62')[0].id).some(x => x.part === 'B first row'), JSON.stringify([liveFor(S, 'WO-62').length, liveFor(S, 'WO-70').length, await err(pb)]));
    await closeAll(pa); await closeAll(pb);

    // ---- C. lost reply, then Save again; then the other PC tries the same WO
    await pa.evaluate(() => openListEditor(null, 'WO-63')); await sleep(700);
    await fillSaw(pa, 0, 'Lost reply row', '2', '720', '560', 'MFC White');
    S.dropReply = 1; await save(pa, 2500);
    let e1 = await err(pa);
    rec('C. lost reply on Save: the window stays and says it was saved (or may have saved) — never "Not saved" when it landed', liveFor(S, 'WO-63').length === 1 && /Saved|May have saved/.test(e1) && !/^Not saved/.test(e1), e1);
    await setv(pa, '0|qty', '5'); await save(pa, 2000);
    live = liveFor(S, 'WO-63');
    rec('C. …Save pressed again (qty changed to 5) → still ONE list, and it has qty 5', live.length === 1 && linesOf(S, live[0].id).some(x => x.part === 'Lost reply row' && String(x.qty) === '5'), JSON.stringify([live.length, live[0] && linesOf(S, live[0].id).map(x => x.part + ' ' + x.qty), await err(pa), await donep(pa)]));
    await closeAll(pa);
    // lost reply TWICE in a row, then closed with ✕ and the job opened again
    await pa.evaluate(() => openListEditor(null, 'WO-64')); await sleep(700);
    await fillSaw(pa, 0, 'Twice lost', '2', '720', '560', 'MFC White');
    S.dropReply = 1; await save(pa, 2500); S.dropReply = 1; await save(pa, 2500);
    rec('C. reply lost twice → ONE list for WO-64', liveFor(S, 'WO-64').length === 1, await err(pa));
    await closeAll(pa);
    await pa.evaluate(() => { window.__asked = []; window.__w = openListEditor(null, 'WO-64'); }); await sleep(900);
    const reo = await pa.evaluate(() => ({ asked: window.__asked.slice(), title: (document.querySelector('.me-tb') || {}).innerText || '' }));
    rec('C. …closed and the job opened again → it does not start a blank NEW list silently (asks / opens the saved one)', reo.asked.some(m => /You were saving|already has/.test(m)) || /Edit cutting list/.test(reo.title), JSON.stringify(reo));
    await closeAll(pa);
    // PC B (never saw any of it) opens WO-64 new and saves
    await pb.evaluate(async () => { openListEditor(null, 'WO-64'); }); await sleep(700);
    if (await ed(pb)) { await fillSaw(pb, 0, 'B on 64', '1', '500', '300', 'MFC White'); await save(pb, 1800); }
    rec('C. …PC B then tries a new list for WO-64 → still ONE live list', liveFor(S, 'WO-64').length === 1, JSON.stringify([liveFor(S, 'WO-64').map(l => l.id), await err(pb)]));
    await closeAll(pb);

    // ---- D. both PCs EDIT the same existing list; A adds a row, B changes a qty; both Save
    await pa.evaluate(async () => { lsReset(); await lsLoad(); }); await pb.evaluate(async () => { lsReset(); await lsLoad(); });
    const id63 = liveFor(S, 'WO-63')[0].id;
    await pa.evaluate(id => openListEditor(id), id63); await pb.evaluate(id => openListEditor(id), id63); await sleep(900);
    rec('D. an EXISTING list opened for edit shows its WO in the title bar on both PCs', (await job(pa)).hwo === 'WO-63' && (await job(pb)).hwo === 'WO-63', JSON.stringify([(await job(pa)).hwo, (await job(pb)).hwo]));
    await click(pa, 'me-addsaw'); await sleep(200); await fillSaw(pa, 1, 'A added row', '1', '300', '200', 'MFC White');
    await setv(pb, '0|note', 'B note');
    await save(pa, 1800); await save(pb, 2200);
    const ln = linesOf(S, id63);
    const dA = await donep(pa), dB = await donep(pb), eDb = await err(pb);
    rec('D. A adds a row + B changes a note on the same list, both Save → both changes in the database, OR B is told to reopen (never silent loss)',
      (ln.some(x => x.part === 'A added row') && ln.some(x => x.note === 'B note')) || (ln.some(x => x.part === 'A added row') && !dB && /another screen|reopen|not saved/i.test(eDb)), JSON.stringify({ lines: ln.map(x => x.part + '|' + x.qty + '|' + (x.note || '')), dA: dA && dA.h, dB: dB && dB.h, eDb }));
    rec('D. …and A\'s added row was not wiped by B\'s save', ln.some(x => x.part === 'A added row'), JSON.stringify(ln.map(x => x.part)));
    await closeAll(pa); await closeAll(pb);
    // D2: both change the SAME cell
    await pa.evaluate(async () => { lsReset(); await lsLoad(); }); await pb.evaluate(async () => { lsReset(); await lsLoad(); });
    await pa.evaluate(id => openListEditor(id), id63); await pb.evaluate(id => openListEditor(id), id63); await sleep(900);
    await setv(pa, '0|qty', '7'); await setv(pb, '0|qty', '9');
    await save(pa, 1800); await pb.evaluate(() => { window.__toasts = []; const t0 = toast; toast = function (m) { window.__toasts.push(String(m)); return t0.apply(this, arguments); }; }); await save(pb, 4000);
    const q = linesOf(S, id63).find(x => x.part === 'Lost reply row');
    const dB2 = await donep(pb), eB2 = await err(pb), tB2 = await pb.evaluate(() => (window.__toasts || []).filter(m => /another screen|meanwhile/i.test(m)));
    rec('D2. both PCs change the SAME quantity (7 then 9) and Save → the second saver is TOLD the other PC changed it (not a silent overwrite)', !dB2 || tB2.length > 0 || /another screen|meanwhile/i.test(eB2), JSON.stringify({ qtyInDb: q && q.qty, dB2: dB2 && dB2.h, eB2, tB2 }));
    await closeAll(pa); await closeAll(pb);

    // ---- E. "Change job" onto a WO that got a list on the other PC meanwhile
    await pa.evaluate(async () => { lsReset(); await lsLoad(); }); await pb.evaluate(async () => { lsReset(); await lsLoad(); });
    await pa.evaluate(() => openListEditor(null, 'WO-65')); await sleep(700);
    await fillSaw(pa, 0, 'E row', '1', '500', '300', 'MFC White');
    await pb.evaluate(() => openListEditor(null, 'WO-66')); await sleep(700); await fillSaw(pb, 0, 'B 66', '1', '500', '300', 'MFC White'); await save(pb);
    await click(pa, 'me-jobtog'); await sleep(300);
    const has66 = await pa.evaluate(() => !![...document.getElementById('me-wo').options].find(o => o.value === 'WO-66'));
    await setid(pa, 'me-wo', 'WO-66'); await sleep(400); await save(pa, 1800);
    rec('E. A: Change job → WO-66 (B saved a list for it a moment ago, A has not refreshed) → Save refused, ONE list on WO-66', has66 && liveFor(S, 'WO-66').length === 1 && !(await donep(pa)), JSON.stringify([has66, liveFor(S, 'WO-66').length, await err(pa)]));
    rec('E. …A is told plainly', /WO-66 already got a list on another PC/.test(await err(pa)), await err(pa));
    rec('E. …and WO-65 got no list by accident', liveFor(S, 'WO-65').length === 0);
    await closeAll(pa); await closeAll(pb);

    // ---- F. an EXISTING list moved (Change job) onto a WO that already has a live list
    await pa.evaluate(async () => { lsReset(); await lsLoad(); });
    const id62 = 'LF1';
    await pa.evaluate(id => openListEditor(id), id62); await sleep(900);
    const j0 = await job(pa);
    await click(pa, 'me-jobtog'); await sleep(300);
    const opt66 = await pa.evaluate(() => { const o = [...document.getElementById('me-wo').options].find(o => o.value === 'WO-69'); return o ? o.textContent : null; });
    rec('F. existing list (WO-68) → Change job: WO-69 is in the drop-down marked "has a list"', /has a list/.test(opt66 || ''), opt66);
    await setid(pa, 'me-wo', 'WO-69'); await sleep(400); await setv(pa, '0|note', 'moved'); await save(pa, 2200);
    const l66 = liveFor(S, 'WO-69'), l62 = liveFor(S, 'WO-68');
    rec('F. existing list of WO-68 moved onto WO-69 (which has its own live list) and Saved → WO-69 never has TWO live lists', l66.length === 1, JSON.stringify({ wo66: l66.map(l => l.id + ':' + l.name), wo62: l62.map(l => l.id), err: await err(pa), done: await donep(pa), start: j0.hwo }));
    const dF = await donep(pa), eF = await err(pa);
    rec('F. …and the person is told what happened (refused, or said plainly) — not "Saved ✓ … WO-69" while the list is not on WO-69', !(dF && /WO-69/.test(dF.l) && !l66.some(l => l.id === id62)), JSON.stringify({ dF, eF }));
    rec('F. …the list is still on exactly one WO (not left with no WO at all)', S.db.t.lists.find(l => l.id === id62).wos.length === 1, JSON.stringify(S.db.t.lists.find(l => l.id === id62).wos));
    await closeAll(pa);

    // ---- G. A has the window open on WO-67, typed. B archives nothing, but SHIPS the job (planner) — A saves
    await pa.evaluate(() => openListEditor(null, 'WO-67')); await sleep(700);
    await fillSaw(pa, 0, 'G row', '1', '500', '300', 'MFC White');
    await pb.evaluate(async () => { await loadDB(); const o = DB.orders.find(x => x.wo === 'WO-67'); o.notes = 'changed on B'; o.dueDate = '2026-10-19'; await saveDB(); }); await sleep(800);
    await pa.evaluate(async () => { await loadDB(); }); await sleep(500);
    const jg = await job(pa);
    rec('G. B changes WO-67\'s due date; A\'s screen reloads the plan while the window is open → window still open, row kept', jg.open && (await rows(pa)).some(r => r.item === 'G row'), JSON.stringify(jg));
    await save(pa, 1800);
    rec('G. …A saves → one list on WO-67', liveFor(S, 'WO-67').length === 1 && !!(await donep(pa)), await err(pa));
    const oG = S.row.orders.find(x => x.wo === 'WO-67');
    rec('G. …and A\'s save did not put the OLD due date back over B\'s change (planner record)', oG && oG.dueDate === '2026-10-19', oG && oG.dueDate);
    await closeAll(pa);

    // ---- H. ONE PC that KNOWS the WO has a live list (no race at all): can the window still make a second one?
    await pa.evaluate(async () => { lsReset(); await lsLoad(); window.__asked = []; window.__confirm = false; }); // Cancel = "stay here / start another new list"
    const n1 = liveFor(S, 'WO-1').length; // L1 "House 1" is seeded on WO-1
    await pa.evaluate(() => openListEditor(null, 'WO-1')); await sleep(800);
    const h1 = await pa.evaluate(() => ({ open: !!document.querySelector('.me-ed'), asked: window.__asked.slice(), txt: (document.querySelector('.me-ed') || {}).innerText || '' }));
    rec('H. one PC, WO-1 already has the live list "House 1": opening a NEW list for WO-1 warns before anything is typed', h1.asked.some(m => /already has/.test(m)) || /already has (a|the) (live |cutting )?list/i.test(h1.txt) || !h1.open, JSON.stringify({ open: h1.open, asked: h1.asked }));
    if (h1.open) { await fillSaw(pa, 0, 'Second list row', '1', '500', '300', 'MFC White'); await save(pa, 1800); }
    rec('H. …typed and Saved → WO-1 still has ONE live list (' + n1 + ' before)', liveFor(S, 'WO-1').length === 1, JSON.stringify({ lists: liveFor(S, 'WO-1').map(l => l.id + ':' + l.name), err: await err(pa), done: (await donep(pa) || {}).h }));
    await closeAll(pa); await pa.evaluate(() => { window.__confirm = true; });
    // what do the Saw / Lists screens say about a WO with two live lists?
    const two = S.db.t.lists.filter(l => !l.archived && !l.is_template).flatMap(l => l.wos || []).filter((w, i, a) => a.indexOf(w) !== i);
    if (two.length) {
      await pa.evaluate(async () => { lsReset(); await lsLoad(); showTab('l'); }); await sleep(900);
      const lt = await pa.evaluate(() => document.body.innerText);
      rec('H. a WO with two live lists (' + [...new Set(two)].join(', ') + ') is FLAGGED on the Cutting Lists page', /two lists|2 lists|more than one list|second list|cut it twice|duplicate/i.test(lt), lt.replace(/\s+/g, ' ').slice(0, 200));
    }

    rec('no page errors on either PC', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await b.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
