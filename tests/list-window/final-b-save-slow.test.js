// FINAL Tester round (14 Nov), area 2 — Manager point 2: every list Save now reads the project's materials first
// (lsSaveManual → lsMatFresh). The fake server answers that read slowly (3 s), with an error, cut off, or not at all.
// Does Save still work, is the person told, can a double press / Ctrl+S make two lists, is "Saved ✓" ever shown when the
// save did not happen, what happens to what is typed or closed during the wait?
// Fake Supabase only. Run: node tests/list-window/final-b-save-slow.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, liveFor, donep, err, click, fillSaw } = L;
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision').length;
// on top of the fake server: the materials read of ONE project (lsMatFresh) can be slowed / failed. S.mat = {delay, mode}
async function slowMats(t, S) {
  await t.page.route('**/*', async route => { const req = route.request(), u = req.url();
    if (!(req.method() === 'GET' && /\/project_materials\?/.test(u) && /project_id=eq\./.test(u)) || !S.mat) return route.fallback();
    S.matReads = (S.matReads || 0) + 1; const m = S.mat;
    if (m.delay) await sleep(m.delay);
    if (m.mode === 'hang') { await (S.matHang = S.matHang || new Promise(r => { S.matRelease = r; })); return route.fallback().catch(() => {}); }
    if (m.mode === '503') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }).catch(() => {});
    if (m.mode === 'abort') return route.abort('internetdisconnected').catch(() => {});
    return route.fallback().catch(() => {});
  });
}
const firstRow = async p => (await rows(p)).findIndex(r => !r.hdr);
const state = p => p.evaluate(() => { const sb = document.getElementById('me-save'); return { open: !!document.querySelector('.me-ed'), dis: sb ? sb.disabled : null, err: (document.getElementById('me-err') || {}).textContent || '', done: !!document.querySelector('.me-dov'), doneTxt: (document.querySelector('.me-dov') || {}).innerText || '' }; });
const newFromJob = async (p, wo) => { await closeAll(p); await p.evaluate(wo => { window.__confirm = true; window.__asked = []; openListEditor(null, wo); }, wo); await sleep(1000); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const LINES = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass' }], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }]];
    const mk = async role => { const S = X.makeServer(X.v2Row(), { lines: LINES }); const t = await X.dev(browser, S, role || 'design'); await asks(t.page); await slowMats(t, S); await t.page.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); }); return { S, t, p: t.page }; };

    // ---- A. new list from a job, materials read takes 3 s ----
    { const { S, p } = await mk();
      await newFromJob(p, 'WO-3'); const i = await firstRow(p);
      await fillSaw(p, i, 'Gable', '2', '720', '560', 'MFC White'); await sleep(200);
      S.mat = { delay: 3000 }; const s0 = saves(S), t0 = Date.now();
      await click(p, 'me-save'); await sleep(700);
      const mid = await state(p);
      rec('A1 slow materials read: 0.7 s after Save the person is told something is happening ("Saving…" / "Checking…")', /Saving|Checking/.test(mid.err), JSON.stringify(mid));
      rec('A2 … Save is switched off while it waits (no second press)', mid.dis === true, JSON.stringify(mid));
      rec('A3 … "Saved ✓" is NOT on screen before the list is in the database', !mid.done && liveFor(S, 'WO-3').length === 0, JSON.stringify([mid.done, liveFor(S, 'WO-3').length]));
      // hammer it: Save again, Ctrl+S, Enter on Save — all during the wait
      await p.evaluate(() => { const sb = document.getElementById('me-save'); sb.click(); sb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); sb.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); sb.click();
        const e = document.querySelector('.me-ed [data-mr$="|item"]'); if (e) { e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); } document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); });
      await sleep(600);
      await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); const sb = document.getElementById('me-save'); if (sb) sb.click(); });
      let st; for (let k = 0; k < 40; k++) { st = await state(p); if (st.done || (!st.dis && !/Saving|Checking/.test(st.err))) break; await sleep(250); }
      const took = Date.now() - t0; await sleep(1500);
      rec('A4 the save lands once the read answers (about 3 s)', liveFor(S, 'WO-3').length >= 1 && took < 9000, JSON.stringify({ took, st }));
      rec('[HIGH] A5 Save pressed 4 times + Ctrl+S 3 times during the wait → ONE list on WO-3', liveFor(S, 'WO-3').length === 1, JSON.stringify(liveFor(S, 'WO-3').map(l => l.id)));
      rec('[MEDIUM] A6 … and ONE save sent to the database (not one per press)', saves(S) - s0 === 1, String(saves(S) - s0));
      rec('A7 "Saved ✓ — list is with the Saw & Stores" shown after it landed', st.done && /Saved/.test(st.doneTxt), JSON.stringify(st));
      rec('A8 the saved rows are right (Gable ×2, 720 × 560, MFC White)', (l => l && linesOf(S, l.id).some(x => x.part === 'Gable' && x.qty === '2' && +x.length_mm === 720 && x.material === 'MFC White'))(liveFor(S, 'WO-3')[0]));
      rec('A: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await closeAll(p); S.mat = null; }

    // ---- B. the read FAILS (503) and is CUT OFF (abort): Save still works; a rename made on another PC meanwhile ----
    for (const mode of ['503', 'abort']) { const { S, p } = await mk();
      D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'L1:2'), { status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' }); // line 2 = saw Side MFC White
      await p.evaluate(async () => { lsReset(); await lsLoad(); });
      await p.evaluate(() => openListEditor('L1')); await sleep(900);
      const r = await rows(p), hi = r.findIndex(x => x.item === 'Hinge');
      await setv(p, hi + '|qty', '9'); await sleep(200);
      S.mat = { mode }; await click(p, 'me-save'); await sleep(2500);
      const st = await state(p), hq = linesOf(S, 'L1').find(x => x.part === 'Hinge').qty;
      rec('B1 [' + mode + '] materials read fails → the list is still saved (Hinge 9)', hq === '9', JSON.stringify([hq, st.err]));
      rec('B2 [' + mode + '] "Saved ✓" / closed only because it really saved', (st.done || !st.open) === (hq === '9'), JSON.stringify(st));
      rec('B3 [' + mode + '] the cut tick on Side is still there', (linesOf(S, 'L1').find(x => x.part === 'Side') || {}).status === 'cut');
      rec('B: no page errors [' + mode + ']', !(S.errors || []).length, JSON.stringify(S.errors)); await closeAll(p); S.mat = null; }

    // ---- C. the read fails AND another PC renamed the board since this PC loaded: is the tick lost / line shown CHANGED? ----
    { const { S, p } = await mk();
      D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { locked: true, rev: 1 });
      D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'L1:2'), { status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' });
      await p.evaluate(async () => { lsReset(); await lsLoad(); });
      await p.evaluate(() => openListEditor('L1')); await sleep(900);
      // other PC: renames the board, then re-saves the list so the stored line carries the NEW name
      D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M1'), { name: '18mm MFC White', aliases: ['MFC White'] });
      const r = await rows(p), hi = r.findIndex(x => x.item === 'Hinge');
      await setv(p, hi + '|qty', '9'); await sleep(200);
      S.mat = { mode: '503' }; await click(p, 'me-save'); await sleep(2500);
      const side = linesOf(S, 'L1').find(x => x.part === 'Side'), l = D.find(S.db, 'lists', 'L1'), st = await state(p);
      rec('C1 saved (Hinge 9) although the materials could not be read', linesOf(S, 'L1').find(x => x.part === 'Hinge').qty === '9', st.err);
      rec('[MEDIUM] C2 materials read failed + a rename this PC has not seen: the cut tick on Side is kept', side && side.status === 'cut', JSON.stringify(side && [side.material, side.status, side.changed_rev, l.rev]));
      rec('(info) C3 … the line is stored under the name this PC knew ("' + (side && side.material) + '") — the next save with a working read fixes it', true);
      await closeAll(p); S.mat = null; }

    // ---- D. the read never answers (10 s): what does the person see, can they get out, does a late answer save twice? ----
    { const { S, p } = await mk();
      await newFromJob(p, 'WO-3'); const i = await firstRow(p);
      await fillSaw(p, i, 'Gable', '2', '720', '560', 'MFC White'); await sleep(200);
      S.mat = { mode: 'hang' }; await click(p, 'me-save'); await sleep(10000);
      const st = await state(p);
      rec('D1 materials read hangs 10 s: "Saved ✓" is NOT shown and nothing is in the database', !st.done && liveFor(S, 'WO-3').length === 0, JSON.stringify(st));
      rec('(info) [LOW] D2 … after 10 s the person is told more than a bare "Saving…" (e.g. "slow connection — still trying") or can press Save again', !(st.dis === true && /^Saving…$/.test(st.err.trim())), JSON.stringify(st));
      // ✕ Close while it hangs: asks (rows not saved)?
      await p.evaluate(() => { window.__asked = []; window.__confirm = false; const x = document.querySelector('.me-ed #me-x,.me-ed [data-mex],.me-tb button'); if (x) x.click(); }); await sleep(400);
      const asked = await p.evaluate(() => window.__asked.join(' | ')), still = (await state(p)).open;
      // (Coder, fix round 14 Nov — item 8b) re-pointed: ✕ while the save is on its way no longer asks "Close without saving?" — the window stays and says "Still saving — wait a moment".
      const err3 = (await state(p)).err;
      rec('D3 ✕ Close while the save is hanging never throws the rows away: the window stays and says "Still saving" (or it asks first)', still && (/Still saving/i.test(err3) || /without saving|not saved|unsaved/i.test(asked)), JSON.stringify([still, err3, asked.slice(0, 200)]));
      await p.evaluate(() => { window.__confirm = true; });
      S.matRelease && S.matRelease(); await sleep(3000);
      const st2 = await state(p);
      rec('D4 when the read finally answers the list saves ONCE', liveFor(S, 'WO-3').length === 1 && (st2.done || /Saved/.test(st2.err)), JSON.stringify([liveFor(S, 'WO-3').length, st2]));
      rec('D: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await closeAll(p); S.mat = null; S.matHang = null; }

    // ---- E. typed DURING the wait: is it in the save, or lost behind "Saved ✓"? ----
    { const { S, p } = await mk();
      await newFromJob(p, 'WO-3'); const i = await firstRow(p);
      await fillSaw(p, i, 'Gable', '2', '720', '560', 'MFC White'); await sleep(200);
      S.mat = { delay: 3000 }; await click(p, 'me-save'); await sleep(800);
      const editable = await p.evaluate(i => { const e = document.querySelector('.me-ed [data-mr="' + i + '|qty"]'); return e ? !e.disabled && !e.readOnly : null; }, i);
      await setv(p, i + '|qty', '7'); await sleep(4500);
      const st = await state(p), l = liveFor(S, 'WO-3')[0], q = l && (linesOf(S, l.id).find(x => x.part === 'Gable') || {}).qty;
      rec('E0 the list saved', !!l, JSON.stringify(st));
      rec('[MEDIUM] E1 a quantity changed to 7 while "Saving…" was on screen is either IN the saved list or the person is not told "Saved ✓" (never silently dropped)', q === '7' || !st.done, JSON.stringify({ editableDuringSave: editable, savedQty: q, done: st.done, txt: st.doneTxt.slice(0, 80) }));
      await closeAll(p); S.mat = null; }

    // ---- F. the read is slow, then the SAVE itself fails: no "Saved ✓", rows kept, Save usable again ----
    { const { S, p } = await mk();
      await newFromJob(p, 'WO-3'); const i = await firstRow(p);
      await fillSaw(p, i, 'Gable', '2', '720', '560', 'MFC White'); await sleep(200);
      S.mat = { delay: 1500 }; S.fail3 = true; await click(p, 'me-save'); await sleep(5000);
      const st = await state(p), rr = await rows(p);
      rec('F1 save fails after the slow read: NO "Saved ✓", nothing in the database', !st.done && liveFor(S, 'WO-3').length === 0, JSON.stringify(st));
      rec('F2 … the person is told "Not saved" and the rows are still on screen', /Not saved|May have saved|failed/i.test(st.err) && rr.some(x => x.item === 'Gable'), st.err);
      rec('F3 … Save can be pressed again', st.dis === false, JSON.stringify(st));
      S.fail3 = false; S.mat = null; await click(p, 'me-save'); await sleep(2500);
      rec('F4 pressing Save again (connection back) saves ONE list', liveFor(S, 'WO-3').length === 1, String(liveFor(S, 'WO-3').length));
      rec('F: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await closeAll(p); }

    // ---- G. template Save and phone-width Save go through the same read ----
    { const { S, p } = await mk();
      X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });
      await p.evaluate(async () => { lsReset(); await lsLoad(); window.__prompt = 'tidy'; openListEditor('T1'); }); await sleep(900);
      const r = await rows(p), hi = r.findIndex(x => x.item === 'Hinge'); await setv(p, hi + '|qty', '6'); await sleep(200);
      S.mat = { delay: 3000 }; const s0 = saves(S); await click(p, 'me-save'); await sleep(600); await click(p, 'me-save'); await sleep(5000);
      rec('G1 template: slow read, Save pressed twice → ONE new template revision', saves(S) - s0 === 1 && linesOf(S, 'T1').find(x => x.part === 'Hinge').qty === '6', JSON.stringify([saves(S) - s0, await err(p)]));
      rec('G: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await closeAll(p); S.mat = null; }

    // ---- H. the wait is used to break the rules: quantity wiped during "Saving…"; ✕ Close → "close without saving" during the wait ----
    { const { S, p } = await mk();
      await newFromJob(p, 'WO-3'); const i = await firstRow(p);
      await fillSaw(p, i, 'Gable', '2', '720', '560', 'MFC White'); await sleep(200);
      S.mat = { delay: 3000 }; await click(p, 'me-save'); await sleep(800);
      await setv(p, i + '|qty', ''); await sleep(4500);
      const st = await state(p), l = liveFor(S, 'WO-3')[0], g = l && linesOf(S, l.id).find(x => x.part === 'Gable');
      rec('[MEDIUM] H1 quantity wiped while "Saving…" is on screen: a saw row with NO quantity never reaches the saw (Save normally refuses it)', !l || (g && String(g.qty || '').trim() !== ''), JSON.stringify({ saved: !!l, qty: g && g.qty, st }));
      await closeAll(p); S.mat = null; }
    { const { S, p } = await mk();
      await newFromJob(p, 'WO-3'); const i = await firstRow(p);
      await fillSaw(p, i, 'Gable', '2', '720', '560', 'MFC White'); await sleep(200);
      S.mat = { delay: 3000 }; await click(p, 'me-save'); await sleep(800);
      await p.evaluate(() => { window.__asked = []; window.__confirm = true; const x = document.querySelector('.me-ed #me-x,.me-ed [data-mex],.me-tb button'); if (x) x.click(); }); await sleep(400);
      const asked = await p.evaluate(() => window.__asked.join(' | ')), open1 = (await state(p)).open;
      await sleep(4500);
      const st = await state(p), n = liveFor(S, 'WO-3').length, toast = await L.toasts(p);
      // (Coder, fix round 14 Nov — item 8b) this check used to expect the OLD behaviour (✕ asked "Close without saving?" and closed the window mid-save).
      // The rule is now: ✕ while "Saving…" does NOT close and asks nothing — it says "Still saving — wait a moment".
      rec('H2 ✕ during the wait: the window stays open, no "Close without saving?" is asked, the save goes on', open1 && !/without saving/i.test(asked), JSON.stringify([open1, asked.slice(0, 80)]));
      rec('[MEDIUM] H3 the person chose "close without saving — what you typed is lost": either nothing is saved, or they are told it WAS saved (panel / toast)', n === 0 || st.done || /saved/i.test(toast), JSON.stringify({ listsOnWO3: n, done: st.done, toast: toast.slice(0, 200) }));
      await closeAll(p); S.mat = null; }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
