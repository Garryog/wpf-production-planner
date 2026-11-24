// FINAL-2 Tester round (15 Nov) — attack on 55de4dd / 0734612 / 963ed3e / 5a2c13e / 8731ac1:
// rows (and things that are NOT rows: the name, "no cutting", the work order) changed while "Saving…" is showing; ✕ / Esc / grey
// area during the save; the save FAILS late; double tap; the 20-second "close anyway"; Save while "Is this project …? Yes / No"
// is unanswered; and "Save with nothing changed writes nothing" — a REAL change on such an old list must still save.
// The fake database answers the save (save_list_revision) slowly or with an error. Fake Supabase only.
// Run: node tests/list-window/final2-save-race.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, setid, rows, linesOf, liveFor, donep, err, click, fillSaw } = L;
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision').length;
// S.sv = {delay, mode:'500'|'abort'} — applied to the save call only
async function slowSave(t, S) {
  await t.page.route('**/rpc/save_list_revision*', async route => { const m = S.sv; if (!m) return route.fallback();
    S.svSeen = (S.svSeen || 0) + 1;
    if (m.delay) await sleep(m.delay);
    if (m.mode === '500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"the database is busy"}' }).catch(() => {});
    if (m.mode === 'abort') return route.abort('internetdisconnected').catch(() => {});
    return route.fallback().catch(() => {}); });
}
const state = p => p.evaluate(() => { const sb = document.getElementById('me-save'); return { open: !!document.querySelector('.me-ed'), n: document.querySelectorAll('.pod-ovl .me-ed').length, dis: sb ? sb.disabled : null, err: (document.getElementById('me-err') || {}).textContent || '', done: !!document.querySelector('.me-dov'), doneTxt: ((document.querySelector('.me-dov') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 160),
  toast: [...document.querySelectorAll('.toast,#toast,.toasts *')].map(x => x.innerText).join(' | ').slice(0, 400), asked: (window.__asked || []).slice() }; });
const waitDone = async (p, ms) => { let st; for (let k = 0; k < (ms || 9000) / 250; k++) { st = await state(p); if (st.done || !st.open || (!st.dis && !/Saving|Checking|Still saving/.test(st.err))) break; await sleep(250); } await sleep(700); return state(p); };
const LINES = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass' }], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }]];
const idx = async (p, item) => (await rows(p)).findIndex(x => x.item === item);
const q = (S, id, part) => (linesOf(S, id).find(x => x.part === part) || {}).qty;
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const mk = async (role, lines) => { const S = X.makeServer(X.v2Row(), { lines: lines || LINES }); const t = await X.dev(browser, S, role || 'design'); await asks(t.page); await slowSave(t, S); await t.page.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); }); return { S, t, p: t.page }; };
    const openL1 = async p => { await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor('L1'); }); await sleep(900); };

    // ---- A. a ROW changed while "Saving…" (3 s) ----
    { const { S, t, p } = await mk();
      await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '9'); await sleep(150);
      S.sv = { delay: 3000 }; const s0 = saves(S);
      await click(p, 'me-save'); await sleep(900);
      const mid = await state(p);
      rec('A0 0.9 s after Save: "Saving…" showing, Save switched off', /Saving/.test(mid.err) && mid.dis === true, JSON.stringify(mid));
      await setv(p, (await idx(p, 'Side')) + '|qty', '5'); // typed during the save
      const end = await waitDone(p);
      rec('A1 the save landed with what was on screen when Save was pressed (Hinge 9), not the later change (Side stays 2)', q(S, 'L1', 'Hinge') === '9' && q(S, 'L1', 'Side') === '2', JSON.stringify([q(S, 'L1', 'Hinge'), q(S, 'L1', 'Side')]));
      rec('[HIGH] A2 the person is TOLD the change made while saving was NOT saved — never a plain "Saved ✓"', /NOT saved/.test(end.toast) && !end.done, JSON.stringify(end));
      const r = await rows(p);
      rec('[MEDIUM] A3 the saved list is open again (ONE window) showing what was saved (Side 2, Hinge 9)', end.n === 1 && (r.find(x => x.item === 'Side') || {}).qty === '2' && (r.find(x => x.item === 'Hinge') || {}).qty === '9', JSON.stringify([end.n, r.map(x => [x.item, x.qty])]));
      // they make the change again and save: it lands, one more revision only
      S.sv = null; const rv = D.find(S.db, 'lists', 'L1').rev;
      await setv(p, (await idx(p, 'Side')) + '|qty', '5'); await sleep(150); await click(p, 'me-save'); const e2 = await waitDone(p);
      rec('A4 the change made again and saved: Side 5 in the database, "Saved ✓" shown', q(S, 'L1', 'Side') === '5' && e2.done, JSON.stringify([q(S, 'L1', 'Side'), e2]));
      rec('A5 two saves sent in all (no hidden extra save)', saves(S) - s0 === 2, String(saves(S) - s0));
      rec('A: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ---- B. things that are NOT rows changed while "Saving…": the NAME, a row ADDED, a row put BACK ----
    { const { S, t, p } = await mk();
      await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '9'); await sleep(150);
      S.sv = { delay: 2500 }; await click(p, 'me-save'); await sleep(800);
      await setid(p, 'me-name', 'House 1 REV B'); // the list name typed during the save
      const end = await waitDone(p), nm = D.find(S.db, 'lists', 'L1').name;
      rec('(already on live) [MEDIUM] B1 the list NAME retyped while "Saving…": either it is saved, or the person is told it was not — never "Saved ✓" with the new name silently dropped', nm === 'House 1 REV B' || /NOT saved/.test(end.toast) || !end.done, JSON.stringify({ savedName: nm, end }));
      await closeAll(p); S.sv = null;
      // typed 5 then back to 2 during the save → nothing differs → normal Saved ✓
      await p.evaluate(async () => { lsReset(); await lsLoad(); }); await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '10'); await sleep(150);
      S.sv = { delay: 2500 }; await click(p, 'me-save'); await sleep(700);
      const si = await idx(p, 'Side'); await setv(p, si + '|qty', '5'); await sleep(100); await setv(p, si + '|qty', '2');
      const e2 = await waitDone(p);
      rec('[LOW] B2 a box changed and put BACK during the save: plain "Saved ✓" (no false alarm — nothing was lost)', e2.done && !/NOT saved/.test(e2.toast) && q(S, 'L1', 'Hinge') === '10', JSON.stringify(e2));
      await closeAll(p); S.sv = null;
      // a row ADDED (＋ Add row / Enter on the last row) during the save
      await p.evaluate(async () => { lsReset(); await lsLoad(); }); await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '11'); await sleep(150);
      S.sv = { delay: 2500 }; await click(p, 'me-save'); await sleep(700);
      const n0r = (await rows(p)).length;
      const added = await p.evaluate(() => { const b = document.getElementById('me-addsaw'); if (!b || b.disabled) return 'no add button'; b.click(); return 'ok'; }); await sleep(250);
      const rr = await rows(p), ni = rr.findIndex(x => !x.hdr && !x.item); if (rr.length > n0r && ni >= 0) await fillSaw(p, ni, 'Late plinth', '1', '2400', '150', 'MFC White');
      rec('B3 set-up: ＋ Row pressed during the save added a row on screen', added === 'ok' && rr.length === n0r + 1 && ni >= 0, JSON.stringify([added, n0r, rr.length, ni]));
      const e3 = await waitDone(p), has = linesOf(S, 'L1').some(x => x.part === 'Late plinth');
      rec('[HIGH] B3 a row ADDED and filled while "Saving…": it is saved, or the person is told it was not (' + added + ')', has || /NOT saved/.test(e3.toast), JSON.stringify({ has, e3 }));
      rec('B: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ---- C. ✕, Esc, the grey area and a second Save during the wait; then the save FAILS late ----
    { const { S, t, p } = await mk();
      await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '9'); await sleep(150);
      S.sv = { delay: 3500, mode: '500' }; const s0 = saves(S), seen0 = S.svSeen || 0;
      await p.evaluate(() => { const b = document.getElementById('me-save'); b.click(); b.click(); }); await sleep(600); // double tap
      await p.evaluate(() => { window.__asked = []; document.getElementById('me-x0').click(); }); await sleep(200);
      const c1 = await state(p);
      rec('[HIGH] C1 ✕ pressed while saving: the window does NOT close, nothing is asked, it says to wait', c1.open && !c1.asked.length && /Still saving/.test(c1.err), JSON.stringify(c1));
      await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(200);
      const c2 = await state(p);
      rec('[HIGH] C2 Esc while saving: the window does NOT close', c2.open && !c2.asked.length, JSON.stringify(c2));
      await p.evaluate(() => { const o = document.querySelector('.me-ed').closest('.pod-ovl'); o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); o.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await sleep(200);
      rec('C3 a click on the grey area while saving: the window does NOT close', (await state(p)).open);
      await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); const b = document.getElementById('me-save'); b.click(); }); // Ctrl+S + another Save
      const end = await waitDone(p);
      rec('[HIGH] C4 the save FAILED after 3.5 s: "Not saved" is shown IN the window (the "Still saving" line does not hide it), no "Saved ✓"', end.open && !end.done && /Not saved/.test(end.err), JSON.stringify(end));
      rec('C5 … Save is switched back on and the typed value (Hinge 9) is still in its box', end.dis === false && ((await rows(p)).find(x => x.item === 'Hinge') || {}).qty === '9', JSON.stringify(end));
      rec('[MEDIUM] C6 double tap + Ctrl+S + Save during the wait: ONE save was sent', (S.svSeen || 0) - seen0 === 1, String((S.svSeen || 0) - seen0));
      rec('C7 nothing reached the database (Hinge still 8)', q(S, 'L1', 'Hinge') === '8');
      // now ✕ works again and asks about the unsaved change
      await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(200);
      const c8 = await state(p);
      rec('C8 after the failure ✕ works again: asks "Close without saving?" (answered Cancel → stays)', c8.open && /Close without saving/.test(c8.asked.join('|')), JSON.stringify(c8.asked));
      await p.evaluate(() => { window.__confirm = true; });
      S.sv = null; await click(p, 'me-save'); const e2 = await waitDone(p);
      rec('C9 Save pressed again once the database is back: Hinge 9 saved, "Saved ✓"', q(S, 'L1', 'Hinge') === '9' && e2.done, JSON.stringify([q(S, 'L1', 'Hinge'), e2]));
      rec('C: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ---- D. a row changed during the wait AND the save fails: nothing is thrown away ----
    { const { S, t, p } = await mk();
      await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '9'); await sleep(150);
      S.sv = { delay: 2000, mode: 'abort' }; await click(p, 'me-save'); await sleep(600);
      await setv(p, (await idx(p, 'Side')) + '|qty', '5');
      const end = await waitDone(p), r = await rows(p);
      rec('[HIGH] D1 changed during the wait + the connection drops: window still open with BOTH changes on screen (Hinge 9, Side 5), told "Not saved"', end.open && !end.done && /Not saved/.test(end.err + end.toast) && (r.find(x => x.item === 'Hinge') || {}).qty === '9' && (r.find(x => x.item === 'Side') || {}).qty === '5', JSON.stringify([end, r.map(x => [x.item, x.qty])]));
      S.sv = null; await click(p, 'me-save'); const e2 = await waitDone(p);
      rec('[HIGH] D2 Save again: BOTH changes are saved', q(S, 'L1', 'Hinge') === '9' && q(S, 'L1', 'Side') === '5' && e2.done, JSON.stringify([q(S, 'L1', 'Hinge'), q(S, 'L1', 'Side'), e2]));
      rec('D: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ---- E. a NEW list: row changed during the wait → ONE list, reopened; and the 20-second "close anyway" ----
    { const { S, t, p } = await mk();
      await closeAll(p); await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-3'); }); await sleep(1000);
      const i = (await rows(p)).findIndex(r => !r.hdr); await fillSaw(p, i, 'Gable', '2', '720', '560', 'MFC White'); await sleep(200);
      S.sv = { delay: 2500 }; await click(p, 'me-save'); await sleep(1200);
      const mid = await state(p);
      await setv(p, i + '|qty', '7');
      const end = await waitDone(p), l = liveFor(S, 'WO-3');
      rec('[HIGH] E1 new list, quantity changed during the save: ONE list on WO-3 holding what was checked (Gable 2), person told the change was not saved', l.length === 1 && q(S, l[0].id, 'Gable') === '2' && /NOT saved/.test(end.toast), JSON.stringify({ mid: mid.err, n: l.length, q: l[0] && q(S, l[0].id, 'Gable'), end }));
      const r = await rows(p);
      rec('E2 … the saved list is open again (Gable 2); making the change and saving does NOT make a second list', end.n === 1 && (r.find(x => x.item === 'Gable') || {}).qty === '2', JSON.stringify(r.map(x => [x.item, x.qty])));
      S.sv = null; await setv(p, (await idx(p, 'Gable')) + '|qty', '7'); await sleep(150); await p.evaluate(() => { window.__prompt = 'qty'; }); await click(p, 'me-save'); await waitDone(p);
      const l2 = liveFor(S, 'WO-3');
      rec('[HIGH] E3 … ONE list on WO-3 with Gable 7', l2.length === 1 && q(S, l2[0].id, 'Gable') === '7', JSON.stringify(l2.map(x => [x.id, q(S, x.id, 'Gable')])));
      await closeAll(p);
      // 20 seconds with no answer: ✕ asks; OK closes; the late answer must not throw or show a dead "Saved ✓" window
      await p.evaluate(async () => { lsReset(); await lsLoad(); }); await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '12'); await sleep(150);
      S.sv = { delay: 3000 }; await click(p, 'me-save'); await sleep(600);
      await p.evaluate(() => { const r = Date.now.bind(Date); const n0 = r(); window.__realNow = r; Date.now = () => r() + 21000; window.__asked = []; window.__confirm = true; document.getElementById('me-x0').click(); }); await sleep(300);
      const c = await state(p);
      rec('E4 no answer for over 20 s: ✕ ASKS "Still saving … Close anyway? The list may or may not have been saved" and OK closes', !c.open && /may or may not have been saved/.test(c.asked.join('|')), JSON.stringify(c));
      await p.evaluate(() => { Date.now = window.__realNow; }); await sleep(3500);
      const late = await state(p);
      rec('[MEDIUM] E5 the save then lands: the database has Hinge 12, the person is told on the page (toast), no dead window pops up, no error', q(S, 'L1', 'Hinge') === '12' && /updated|saved/i.test(late.toast) && !late.done, JSON.stringify(late));
      rec('E: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ---- F. the 20-second close, then the save FAILS: the person must still be told ----
    { const { S, t, p } = await mk();
      await openL1(p); await setv(p, (await idx(p, 'Hinge')) + '|qty', '12'); await sleep(150);
      S.sv = { delay: 2500, mode: '500' }; await click(p, 'me-save'); await sleep(600);
      await p.evaluate(() => { const r = Date.now.bind(Date); window.__realNow = r; Date.now = () => r() + 21000; window.__confirm = true; document.getElementById('me-x0').click(); }); await sleep(300);
      await p.evaluate(() => { Date.now = window.__realNow; }); await sleep(3200);
      const late = await state(p);
      rec('[HIGH] F1 closed after 20 s, THEN the save fails: "Not saved" is shown on the page (a late failure is never silent)', !late.open && /Not saved/.test(late.toast), JSON.stringify(late));
      rec('F: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ---- G. 8731ac1: an old list whose Stores row carries the "spec not on the project list" mark differently ----
    { const OLD = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass' }], ['saw', 'Odd board', '1', 600, 300, 'Walnut veneer', '', '', { section: 'Carcass', material_other: false }],
        ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass', material_other: true }], ['fit', 'Leg', '4', null, null, 'Some old spec', '', '', { section: 'Carcass', material_other: true }]];
      const { S, t, p } = await mk('design', OLD);
      const L1 = () => D.find(S.db, 'lists', 'L1');
      // (1) nothing changed
      await openL1(p); const amber0 = await p.evaluate(() => [...document.querySelectorAll('.me-ed select[data-mr$="|mat"]')].filter(s => /Not on the project/.test(s.title || '')).map(s => s.closest('[data-row]').querySelector('[data-mr$="|item"]').value));
      rec('G0 the editor flags the board that is not on the project list ("Odd board") in amber', amber0.includes('Odd board'), JSON.stringify(amber0));
      const s0 = saves(S), rev0 = L1().rev || 1; await p.evaluate(() => { window.__prompt = 'why'; }); await click(p, 'me-save'); await waitDone(p);
      rec('(info) G1 Save with nothing changed on this old list: saves sent / revision', true, JSON.stringify({ sent: saves(S) - s0, rev: [rev0, L1().rev || 1], flagOdd: (linesOf(S, 'L1').find(x => x.part === 'Odd board') || {}).material_other }));
      await closeAll(p);
      // (2) a NOTE only
      for (const [what, fn, chk] of [
        ['a NOTE only on a Stores row', async () => setv(p, (await idx(p, 'Leg')) + '|note', 'black'), () => (linesOf(S, 'L1').find(x => x.part === 'Leg') || {}).note === 'black'],
        ['a QUANTITY on a Stores row (8 → 9)', async () => setv(p, (await idx(p, 'Hinge')) + '|qty', '9'), () => q(S, 'L1', 'Hinge') === '9'],
        ['a NOTE only on a saw row', async () => setv(p, (await idx(p, 'Side')) + '|note', 'grain'), () => /grain/.test((linesOf(S, 'L1').find(x => x.part === 'Side') || {}).note || '')],
        ['a board PICKED from the project list on the flagged row (Walnut veneer → MFC White)', async () => setv(p, (await idx(p, 'Odd board')) + '|mat', 'MFC White'), () => { const x = linesOf(S, 'L1').find(y => y.part === 'Odd board') || {}; return x.material === 'MFC White' && !x.material_other; }],
        ['a Stores spec PICKED from the list (Some old spec → Blum hinge)', async () => setv(p, (await idx(p, 'Leg')) + '|mat', 'Blum hinge'), () => (linesOf(S, 'L1').find(x => x.part === 'Leg') || {}).material === 'Blum hinge'],
      ]) { await p.evaluate(async () => { lsReset(); await lsLoad(); }); await openL1(p); const r = await fn(); await sleep(200); const n0 = saves(S); await click(p, 'me-save'); const e = await waitDone(p);
        rec('[HIGH] G2 a REAL change on that old list — ' + what + ' — is saved (' + r + ')', chk() && saves(S) - n0 === 1 && e.done, JSON.stringify({ sent: saves(S) - n0, err: e.err, done: e.done, lines: linesOf(S, 'L1').map(x => [x.part, x.qty, x.material, x.note, x.material_other]) }).slice(0, 600)); await closeAll(p); }
      // (3) a tick from the saw on that list reaches the database and survives a nothing-changed Save
      D.update(S.db, 'list_lines', linesOf(S, 'L1').find(x => x.part === 'Side'), { status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' });
      await p.evaluate(async () => { lsReset(); await lsLoad(); }); await openL1(p); const n1 = saves(S); await click(p, 'me-save'); await waitDone(p);
      rec('G3 Save with nothing changed after a saw tick: the tick is still there', (linesOf(S, 'L1').find(x => x.part === 'Side') || {}).status === 'cut', JSON.stringify([saves(S) - n1, linesOf(S, 'L1').map(x => [x.part, x.status])]));
      await closeAll(p);
      // (4) the saw sees the changes; the flagged row still shows its ⚠
      const sw = await X.dev(browser, S, 'saw'), ps = sw.page; await ps.evaluate(async () => { lsReset(); await lsLoad(); render(); });
      const seen = await ps.evaluate(() => listRows(lsList('L1')).map(r => [r.item, r.qty, r.mat, r.note]));
      rec('[HIGH] G4 the saw / stores screen has the saved changes (Hinge 9, Leg "black", Odd board on MFC White)', seen.some(r => r[0] === 'Hinge' && String(r[1]) === '9') && seen.some(r => r[0] === 'Leg' && /black/.test(r[3] || '')) && seen.some(r => r[0] === 'Odd board' && r[2] === 'MFC White'), JSON.stringify(seen));
      await sw.close();
      rec('G: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ---- H. 8731ac1 the other way: a saw row not on the project list stored WITHOUT its flag (old data) — the ⚠ must not be lost ----
    { const OLD = [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Odd board', '1', 600, 300, 'Walnut veneer', '', '', { material_other: false }]];
      const { S, t, p } = await mk('design', OLD);
      await openL1(p); const amber = await p.evaluate(() => [...document.querySelectorAll('.me-ed select[data-mr$="|mat"]')].filter(s => /Not on the project/.test(s.title || '')).length);
      rec('[MEDIUM] H1 old list, board "Walnut veneer" not on the project list and never flagged in the database: the editor still shows the row in amber (⚠)', amber === 1, String(amber));
      await setv(p, (await idx(p, 'Side')) + '|qty', '3'); await sleep(150); await p.evaluate(() => { window.__prompt = 'x'; }); await click(p, 'me-save'); await waitDone(p);
      const o = linesOf(S, 'L1').find(x => x.part === 'Odd board') || {};
      rec('[MEDIUM] H2 after a real change is saved the odd board is stored flagged for the Production Manager (material_other = true)', o.material_other === true && q(S, 'L1', 'Side') === '3', JSON.stringify(linesOf(S, 'L1').map(x => [x.part, x.qty, x.material, x.material_other])));
      rec('H: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
