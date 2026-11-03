// ATTACK 7 — Q2 zombie tick after a Switch back (Coder commit 1b7189a: held fold changes remember what was sent and the
// database version; on a retry, if the database moved past that version and the line differs, the other screen wins).
// Also adopts the Coder's X1-X3 checks. Fake Supabase only (srv3.js) — nothing reaches the live project.
// Run: node tests/stage3/attack7-q2.test.js   (about 4 minutes; Y2 waits for the app's own timers)
// Y1/Y1c/Y1e and Y5 fail for the same root cause as tests/stage1/t10-cross-untick (Stage 1 merge, not 1b7189a).
const A = require('./atk.js');
const { F, S3, H, rec } = A;
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const oldKeys = S => Object.keys((S.row.settings.listRow || {}).L1 || {});
const has = (S, part) => oldKeys(S).some(k => k.split('|')[1] === part);
const tickBy = (S, part) => { const t = (S.row.settings.listRow || {}).L1 || {}; const k = Object.keys(t).find(k => k.split('|')[1] === part); return k ? t[k].by : null; };
const idle = p => p.evaluate(async () => { for (let i = 0; i < 120 && (SAVING || saveT || LQ.folding); i++) { if (saveT && !SAVING) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const devState = p => p.evaluate(() => ({ v2: V2(), q: lqRead().length, pend: !!localStorage.getItem('wpfPending'), saving: !!SAVING, failed: !!DB.saveFailed, ok: DB.lastLoadOk, err: LQ.err, msgs: LQ.msgs.slice() }));
const pin = p => p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; });
async function settle(p) { for (let i = 0; i < 50 && await p.evaluate(() => !!(SAVING || saveT)); i++) await idle(p); }
const old = S => 'old=' + oldKeys(S).map(k => k.split('|')[1]);
async function held(browser, ids = ['L1:1', 'L1:3']) {
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
  const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
  S.offline = true;
  for (const id of ids) await F.tapRow(saw.page, 'data-rt', id);
  await saw.page.evaluate(async () => { await lqSend(); });
  S.offline = false;
  await settle(off.page); await pin(off.page);
  const back = await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
  await settle(off.page);
  return { S, off, saw, back };
}
async function newTab(saw, S, closeOld) {
  const page = await saw.ctx.newPage(); if (closeOld) await saw.page.close({ runBeforeUnload: false });
  page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await S3.attach({ ...saw, page }, S);
  await page.goto('https://wpf.test/?view=office');
  await page.waitForFunction(() => typeof analyzeImport === 'function'); await F.sleep(1500);
  return page;
}
const asSaw = async page => { await page.evaluate(async () => { localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); await loadDB(); await lqSend(); }); await idle(page); await F.sleep(500); await idle(page); };
// The fold's save of the held ticks goes out and NO reply comes back. apply=true: it reached the database (landed);
// apply=false: it never got there. how: 'connectionreset' (reply lost) or 'internetdisconnected' (signal dropped).
async function lose(saw, S, apply = true, how = 'connectionreset', page) {
  const p = page || saw.page; let lost = 0;
  await p.route(PP, async r => { const q = r.request();
    if (q.method() === 'PATCH' && !lost) { const b = JSON.parse(q.postData() || '{}'); if (b.settings && b.settings.listRow && b.settings.listRow.L1) { lost = 1; if (apply) { Object.assign(S.row, b); S.row.version = (+S.row.version || 1) + 1; } return r.abort(how); } }
    return r.fallback(); });
  p.evaluate(async () => { await loadDB(); await lqSend(); }).catch(() => {});
  for (let i = 0; i < 60 && !lost; i++) await F.sleep(100); await F.sleep(300);
  return lost;
}
const officeUntick = (off, lid = 'L1:1', on = false, by = 'Dee') => off.page.evaluate(async ({ lid, on, by }) => { await loadDB(); const l = DB.lists.find(x => x.id === 'L1'); const r = lsOldRows(l).find(x => x.lid === lid); if (!r) return 'no row'; setRowTick(l, v1Key(r), 'saw', by, on); clearTimeout(saveT); await saveDB(); return 'ok'; }, { lid, on, by });
const officeNote = (off, n) => off.page.evaluate(async n => { await loadDB(); DB.orders[0].notes = n; clearTimeout(saveT); await saveDB(); }, n);

(async () => {
  const browser = await H.chromium.launch();

  // ===== Coder's X1-X3 (adopted) =====
  { const { S, off, saw } = await held(browser); await lose(saw, S);
    await officeUntick(off); await settle(off.page);
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page); await F.sleep(1500); await idle(saw.page);
    await saw.page.evaluate(async () => { await loadDB(); await lqSend(); clearTimeout(saveT); await saveDB(); }); await idle(saw.page);
    const st = await devState(saw.page);
    rec('X1 same tab retries after office untick: Side stays unticked, Top ticked, queue empty', !has(S, 'side') && has(S, 'top') && st.q === 0, old(S) + ' ' + JSON.stringify(st));
    await off.close(); await saw.close(); }
  { const { S, off, saw } = await held(browser); await lose(saw, S);
    const page = await newTab(saw, S, true); await asSaw(page); const st = await devState(page);
    rec('X2 lost reply, no other change, reopen: Side + Top kept, queue empty', has(S, 'side') && has(S, 'top') && st.q === 0, old(S) + ' ' + JSON.stringify(st));
    await off.close(); await page.close(); }
  { const { S, off, saw } = await held(browser); await lose(saw, S);
    await officeNote(off, 'n1'); await settle(off.page);
    const page = await newTab(saw, S, true); await asSaw(page); const st = await devState(page);
    rec('X3 lost reply landed, office saves a note, reopen: Side + Top kept, note kept', has(S, 'side') && has(S, 'top') && st.q === 0 && S.row.orders[0].notes === 'n1', old(S) + ' ' + JSON.stringify(st));
    await off.close(); await page.close(); }

  // ===== Y1 a second tab on the same device (shares the device queue) =====
  { // tab A loses the reply (landed), office unticks Side, tab B (same device, opened afterwards) folds first, then tab A
    const { S, off, saw } = await held(browser); await lose(saw, S);
    await officeUntick(off); await settle(off.page);
    const b = await newTab(saw, S, false); await asSaw(b);
    await saw.page.evaluate(async () => { await loadDB(); await lqSend(); }); await idle(saw.page); await F.sleep(800); await idle(saw.page);
    const sa = await devState(saw.page), sb = await devState(b);
    rec('Y1 two tabs, tab A lost reply, office unticks Side, tab B folds then tab A: Side stays unticked, Top ticked, queue empty in both',
      !has(S, 'side') && has(S, 'top') && sa.q === 0 && sb.q === 0, old(S) + ' A=' + JSON.stringify(sa) + ' B=' + JSON.stringify(sb));
    const msgs = sa.msgs.concat(sb.msgs).join(' | ');
    // Updated 3 Nov (round 8): since c584e01 tab A confirms its save landed straight away, so the office untick is simply a
    // later change and nothing needs saying. If a tab does warn, it must be about Side (the line the office changed).
    rec('Y1b no tab warns wrongly: any "changed on another screen" warning names Side only', !/another screen/.test(msgs) || (/Side.*changed on another screen/.test(msgs) && !/"Top"/.test(msgs)), msgs);
    // ...and a later office re-tick from tab B's screen-state is not undone by tab A saving its stale copy
    await saw.page.evaluate(async () => { DB.weekCaps = DB.weekCaps || {}; DB.weekCaps.__t = 1; clearTimeout(saveT); await saveDB(); }); await idle(saw.page);
    rec('Y1c tab A saves something unrelated afterwards: Side still unticked', !has(S, 'side') && has(S, 'top'), old(S));
    await off.close(); await b.close(); await saw.close(); }
  { // both tabs fold at the very same moment, nothing lost: both ticks end up once, queue empty, no "changed elsewhere" note
    const { S, off, saw } = await held(browser);
    const b = await newTab(saw, S, false);
    await b.evaluate(() => { localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); });
    await Promise.all([saw.page.evaluate(async () => { await loadDB(); await lqSend(); }), b.evaluate(async () => { await loadDB(); await lqSend(); })]);
    await idle(saw.page); await idle(b); await F.sleep(800); await idle(saw.page); await idle(b);
    const sa = await devState(saw.page), sb = await devState(b);
    rec('Y1d two tabs fold together: Side + Top ticked, queue empty, no false "changed on another screen"',
      has(S, 'side') && has(S, 'top') && sa.q === 0 && sb.q === 0 && !/another screen/.test(sa.msgs.concat(sb.msgs).join(' ')), old(S) + ' A=' + JSON.stringify(sa) + ' B=' + JSON.stringify(sb));
    await off.close(); await b.close(); await saw.close(); }
  { // tab A lost reply (landed), tab B folds BEFORE the office untick, then office unticks, then tab A's own retry
    const { S, off, saw } = await held(browser); await lose(saw, S);
    const b = await newTab(saw, S, false); await asSaw(b);
    await officeUntick(off); await settle(off.page);
    await saw.page.evaluate(async () => { await loadDB(); await lqSend(); clearTimeout(saveT); await saveDB(); }); await idle(saw.page);
    const sa = await devState(saw.page);
    rec('Y1e tab B confirms first, office unticks, tab A retries with its old copy: Side stays unticked', !has(S, 'side') && has(S, 'top') && sa.q === 0, old(S) + ' A=' + JSON.stringify(sa));
    await off.close(); await b.close(); await saw.close(); }

  // ===== Y2 the app's own retry timers (nothing called by hand on the tablet) =====
  { const { S, off, saw } = await held(browser); await lose(saw, S);
    await officeUntick(off); await settle(off.page);
    await F.sleep(45000);
    const st = await devState(saw.page);
    rec('Y2 lost reply (landed), office unticks, tablet left alone 45 s (10 s queue retry + 30 s save retry): Side unticked, Top ticked, queue empty',
      !has(S, 'side') && has(S, 'top') && st.q === 0 && !st.failed, old(S) + ' ' + JSON.stringify(st));
    await off.close(); await saw.close(); }
  { const { S, off, saw } = await held(browser); await lose(saw, S, false);
    await F.sleep(45000);
    const st = await devState(saw.page);
    rec('Y2b save never landed, reply lost, nobody else saves, tablet left alone 45 s: Side + Top ticked, queue empty',
      has(S, 'side') && has(S, 'top') && st.q === 0 && !st.failed, old(S) + ' ' + JSON.stringify(st));
    await off.close(); await saw.close(); }

  // ===== Y3 lost reply then office notes =====
  { const { S, off, saw } = await held(browser); await lose(saw, S);
    for (let i = 0; i < 4; i++) { await officeNote(off, 'note ' + i); await settle(off.page); }
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page);
    const st = await devState(saw.page);
    rec('Y3 lost reply (landed), office saves 4 unrelated notes, same tab retries: Side + Top kept, no false warning, note kept',
      has(S, 'side') && has(S, 'top') && st.q === 0 && !/another screen/.test(st.msgs.join(' ')) && S.row.orders[0].notes === 'note 3', old(S) + ' ' + JSON.stringify(st));
    await off.close(); await saw.close(); }
  { // office unticks TOP (the other held line) and saves notes — only Top should follow the office
    const { S, off, saw } = await held(browser); await lose(saw, S);
    await officeUntick(off, 'L1:3'); await officeNote(off, 'x'); await settle(off.page);
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page);
    const st = await devState(saw.page);
    // Updated 3 Nov (round 8): with the save check the tablet knows its save landed, so no warning is needed; if one is
    // shown it must name Top (the line the office changed), never Side.
    const w = st.msgs.filter(m => /another screen/.test(m)).join(' ');
    rec('Y3b office unticks Top only: Side kept, Top unticked, any warning names Top not Side', has(S, 'side') && !has(S, 'top') && st.q === 0 && (!w || (/"Top"/.test(w) && !/"Side"/.test(w))), old(S) + ' ' + JSON.stringify(st));
    await off.close(); await saw.close(); }

  // ===== Y4 lost reply, office unticks then re-ticks =====
  { const { S, off, saw } = await held(browser); await lose(saw, S);
    await officeUntick(off); await settle(off.page); await officeUntick(off, 'L1:1', true, 'Dee2'); await settle(off.page);
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page);
    const page = await newTab(saw, S, true); await asSaw(page);
    const st = await devState(page);
    rec('Y4 office unticks then re-ticks Side: Side ticked once (office stamp kept), Top ticked, queue empty', has(S, 'side') && has(S, 'top') && st.q === 0 && tickBy(S, 'side') === 'Dee2' && oldKeys(S).filter(k => k.split('|')[1] === 'side').length === 1,
      old(S) + ' by=' + tickBy(S, 'side') + ' ' + JSON.stringify(st));
    await off.close(); await page.close(); }

  // ===== Y5 switch OFF: an ordinary saw tick/untick behaves as Stage 1 =====
  { const row = F.v2Row(); delete row.settings.listStore; delete row.settings.listStoreAt;
    const S = F.makeServer(row);
    const off = await S3.open(browser, S, { now: F.NOW, role: 'office' }), saw = await S3.open(browser, S, { now: F.NOW, role: 'saw' });
    const K = 'saw|x|1|1|m|';
    // tick, save lands, reply lost
    let lost = 0;
    await saw.page.route(PP, async r => { const q = r.request(); if (q.method() === 'PATCH' && !lost) { lost = 1; const b = JSON.parse(q.postData() || '{}'); Object.assign(S.row, b); S.row.version = (+S.row.version || 1) + 1; return r.abort('connectionreset'); } return r.fallback(); });
    await saw.page.evaluate(async K => { const l = DB.lists.find(x => x.id === 'OLD1'); setRowTick(l, K, 'saw', 'Op', true); clearTimeout(saveT); await saveDB(); }, K);
    const landed = !!((S.row.settings.listRow || {}).OLD1 || {})[K];
    await saw.page.unroute(PP);
    await off.page.evaluate(async K => { await loadDB(); const l = DB.lists.find(x => x.id === 'OLD1'); setRowTick(l, K, 'saw', 'Dee', false); clearTimeout(saveT); await saveDB(); }, K); await settle(off.page);
    await saw.page.evaluate(async () => { await loadDB(); DB.weekCaps = DB.weekCaps || {}; DB.weekCaps.__z = 1; clearTimeout(saveT); await saveDB(); }); await idle(saw.page);
    const st = await saw.page.evaluate(() => ({ q: lqRead().length, msgs: LQ.msgs.length, ls: DB.listStore || '' }));
    rec('Y5 switch OFF: tick lands with reply lost, office unticks, saw saves again: untick stays (Stage 1 rule), no list queue used',
      landed && !((S.row.settings.listRow || {}).OLD1 || {})[K] && st.q === 0 && st.msgs === 0 && !st.ls, 'landed=' + landed + ' now=' + JSON.stringify((S.row.settings.listRow || {}).OLD1) + ' ' + JSON.stringify(st));
    await saw.page.evaluate(async K => { const l = DB.lists.find(x => x.id === 'OLD1'); setRowTick(l, K, 'saw', 'Op', true); clearTimeout(saveT); await saveDB(); }, K); await idle(saw.page);
    rec('Y5b switch OFF: a plain re-tick saves normally', !!((S.row.settings.listRow || {}).OLD1 || {})[K], JSON.stringify((S.row.settings.listRow || {}).OLD1));
    await off.close(); await saw.close(); }

  // ===== Y6 the known trade-off: save never landed + no reply + other saves before the retry =====
  const trade = async (nOther, how = 'connectionreset', ownRetryFirst = false) => {
    const { S, off, saw } = await held(browser); await lose(saw, S, false, how);
    for (let i = 0; i < nOther; i++) { await officeNote(off, 'o' + i); await settle(off.page); }
    if (ownRetryFirst) await saw.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); // the planner's 30-s save retry fires before the queue retry
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page); await F.sleep(500); await idle(saw.page);
    const st = await devState(saw.page);
    const shown = await saw.page.evaluate(async () => { await new Promise(r => setTimeout(r, 3000)); const t = document.getElementById('toast'); const vis = t && t.classList.contains('show'); const tt = t ? t.textContent : ''; if (t) t.textContent = ''; const body = document.body.innerText; if (t) t.textContent = tt; return { toastStillShowing: !!vis, onScreenAfter3s: /changed on another screen/.test(body) }; });
    await off.close(); await saw.close();
    return { S, st, shown };
  };
  { const r = await trade(1);
    rec('Y6a never landed + reply lost + 1 other save: ticks placed again (kept)', has(r.S, 'side') && has(r.S, 'top') && r.st.q === 0, old(r.S) + ' ' + JSON.stringify(r.st)); }
  { const r = await trade(2);
    const dropped = !has(r.S, 'side') && !has(r.S, 'top');
    rec('Y6b (trade-off) never landed + reply lost + 2 other saves: if ticks are dropped the operator is told by name', !dropped || /"Side"/.test(r.st.msgs.join(' ')) && /"Top"/.test(r.st.msgs.join(' ')), 'dropped=' + dropped + ' ' + old(r.S) + ' ' + JSON.stringify(r.st));
    rec('Y6c (trade-off) the "changed on another screen" warning is still visible 3 s later (not just a 2.5 s toast)', !dropped || r.shown.onScreenAfter3s || r.shown.toastStillShowing, JSON.stringify(r.shown));
    console.log('INFO Y6b dropped=' + dropped); }
  { const r = await trade(2, 'internetdisconnected');
    const dropped = !has(r.S, 'side') && !has(r.S, 'top');
    rec('Y6d signal drops as the fold saves (request never left) + 2 other saves: ticks kept (they never landed)', !dropped, 'dropped=' + dropped + ' ' + old(r.S) + ' ' + JSON.stringify(r.st)); }
  { const r = await trade(1, 'connectionreset', true);
    const dropped = !has(r.S, 'side') && !has(r.S, 'top');
    rec('Y6e never landed + reply lost + only 1 other save, but the planner\'s own 30-s save retry runs before the queue retry: ticks kept', !dropped, 'dropped=' + dropped + ' ' + old(r.S) + ' ' + JSON.stringify(r.st)); }
  { // the tablet itself saving something else (operator ticks a non-held line on the old list) counts as an "other save"?
    const { S, off, saw } = await held(browser); await lose(saw, S, false);
    await officeNote(off, 'o'); await settle(off.page);
    await saw.page.evaluate(async () => { const l = DB.lists.find(x => x.id === 'L1'); const r = lsOldRows(l).find(x => x.lid === 'L1:4'); if (r) setRowTick(l, v1Key(r), 'fit', 'Op', true); clearTimeout(saveT); await saveDB(); }); await idle(saw.page);
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page);
    const st = await devState(saw.page);
    rec('Y6f never landed + reply lost + 1 office save + operator ticks another line on the tablet: held Side + Top kept', has(S, 'side') && has(S, 'top') && st.q === 0, old(S) + ' ' + JSON.stringify(st));
    await off.close(); await saw.close(); }

  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
