// Tester round 8 (3 Nov 2026): attack the save check after a lost reply (c584e01 + 4447f05, Stage 1 save path).
// After a save gets no reply the screen reads the database at +0.05 s and +0.25 s to decide landed / not landed / can't tell.
// Attacks: the write landing LATE (after the check gave up), the check read failing or slow, a signal that stays out,
// two screens losing replies at once, legacy no-version mode, and an edit made while the check is running.
// Fake Supabase only (tsrv.js + an extra route on top). Run: node tests/stage1/t11-savecheck.test.js
const { H, makeServer, device, sleep } = require('./tsrv');
process.on('unhandledRejection', () => {});
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const base = () => ({ id: 'main', version: 1, nid: 50, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], settings: { listRow: { L: { keep: { m: 'saw', by: 'T' } } }, weekCaps: {} } });
const ticks = S => Object.keys(((S.row.settings || {}).listRow || {}).L || {}).sort().join(',');
const TICK = k => `(()=>{DB.listRow=DB.listRow||{};DB.listRow.L=DB.listRow.L||{};DB.listRow.L[${JSON.stringify(k)}]={m:'saw',by:'Saw'};})()`;
const UNTICK = k => `(()=>{if(DB.listRow&&DB.listRow.L)delete DB.listRow.L[${JSON.stringify(k)}];})()`;
const quiet = p => p.waitForFunction(() => !SAVING, null, { timeout: 20000, polling: 30 }).catch(() => {});
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); }).catch(e => 'ERR ' + e.message);
const st = p => p.evaluate(() => ({ failed: !!DB.saveFailed, unsure: UNSURE.length, ver: VER, saving: !!SAVING }));
// Server-side PATCH, same rules as tsrv's applyPatch (version guard, trigger bumps the version)
function apply(S, url, body) {
  const v = url.match(/version=eq\.(\d+)/);
  if (S.versioned && v && +v[1] !== S.row.version) { S.conflicts++; return 'conflict'; }
  const before = S.row.version; Object.assign(S.row, JSON.parse(JSON.stringify(body)));
  if (S.versioned) S.row.version = before + 1; else delete S.row.version;
  S.okSaves++; return 'ok';
}
// mode per device: {late: ms}  PATCH reply lost at once, the write lands `late` ms later (an edge proxy still forwarding it)
//                  {gone: ms}  PATCH reply lost (lands now) and every request fails for `ms` ms afterwards (signal out)
//                  {slowGet: ms} the next GETs (the check reads) take `ms` ms
async function rig(D, S) {
  D.m = {};
  await D.page.route(u => /supabase\.co/.test(String(u)), async route => {
    const q = route.request(), m = D.m;
    if (m.outUntil && Date.now() < m.outUntil) return route.abort('internetdisconnected');
    if (/production_planner/.test(q.url()) && q.method() === 'PATCH' && m.once) {
      const how = m.once; m.once = null; const body = JSON.parse(q.postData() || '{}'), url = q.url();
      if (how.late != null) { setTimeout(() => { S.lateResult = apply(S, url, body); }, how.late); return route.abort('connectionreset'); }
      if (how.gone != null) { apply(S, url, body); m.outUntil = Date.now() + how.gone; return route.abort('connectionreset'); }
      if (how.never) return route.abort('connectionreset');
    }
    if (/production_planner/.test(q.url()) && q.method() === 'GET' && m.slowGet) await sleep(m.slowGet);
    return route.fallback();
  });
}
async function pair(browser, opts = {}) {
  const S = makeServer(base(), opts.server || {});
  if (opts.server && opts.server.versioned === false) delete S.row.version;
  const saw = await device(browser, S, { name: 'saw' }, { role: 'saw' }), off = await device(browser, S, { name: 'office' }, { role: 'office' });
  await rig(saw, S); await rig(off, S);
  return { S, saw, off };
}
const officeUntick = async (off, k) => { await off.page.evaluate(async () => { await loadDB(); }); await off.page.evaluate(UNTICK(k)); await save(off.page); await quiet(off.page); };
(async () => {
  const browser = await H.chromium.launch();

  // ---- C1: the write lands LATE (after the check gave up and said "not landed") ----
  for (const late of [120, 400, 1500]) {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { late };
    await saw.page.evaluate(TICK('side')); await save(saw.page); await quiet(saw.page);
    const s1 = await st(saw.page);
    await sleep(late + 300);
    // the operator unticks (it was a mistake) and the screen saves
    await saw.page.evaluate(UNTICK('side')); await save(saw.page); await quiet(saw.page);
    await sleep(300); await save(saw.page); await quiet(saw.page);
    await off.page.evaluate(async () => { await loadDB(); });
    rec('C1/' + late + 'ms write lands late after a lost reply; operator then unticks on the same screen: untick stays, keeper kept', ticks(S) === 'keep', 'final=' + ticks(S) + ' late write=' + S.lateResult + ' after first save=' + JSON.stringify(s1));
    await saw.close(); await off.close();
  }
  // ---- C1b: late write + operator unticks WHILE the check is still running (within 0.3 s) ----
  for (const late of [120, 400]) {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { late };
    await saw.page.evaluate(TICK('side'));
    const p = save(saw.page); await sleep(30);
    await saw.page.evaluate(UNTICK('side')); // tapped again straight away
    await p; await quiet(saw.page); await sleep(late + 300); await save(saw.page); await quiet(saw.page); await sleep(200); await save(saw.page); await quiet(saw.page);
    rec('C1b/' + late + 'ms tick → lost reply → untick within 30 ms → the write lands late: untick stays', ticks(S) === 'keep', 'final=' + ticks(S) + ' late write=' + S.lateResult);
    await saw.close(); await off.close();
  }
  // ---- C1c: late write + office unticks after it lands: office untick stays ----
  {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { late: 1500 };
    await saw.page.evaluate(TICK('side')); await save(saw.page); await quiet(saw.page); await sleep(1800);
    await officeUntick(off, 'side');
    const mid = ticks(S);
    await saw.page.evaluate(() => { DB.weekCaps.x = 1; }); await save(saw.page); await quiet(saw.page);
    rec('C1c write lands 1.5 s late, office unticks, saw saves something else: office untick stays, saw tick NOT lost before that', ticks(S) === 'keep' && mid === 'keep', 'mid=' + mid + ' final=' + ticks(S) + ' late write=' + S.lateResult);
    await saw.close(); await off.close();
  }
  // ---- C2: the check read fails (signal stays out after the lost reply), office unticks meanwhile ----
  for (const gone of [400, 3000]) {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { gone };
    await saw.page.evaluate(TICK('side')); await save(saw.page); await quiet(saw.page);
    const s1 = await st(saw.page);
    await officeUntick(off, 'side');
    await sleep(gone + 200);
    await save(saw.page); await quiet(saw.page); // the 30-s retry, now that signal is back
    await off.page.evaluate(async () => { await loadDB(); });
    rec('C2/' + gone + 'ms signal out for ' + gone + ' ms after a lost reply (check cannot read); office unticks; saw retries: office untick stays', ticks(S) === 'keep', 'final=' + ticks(S) + ' saw after first save=' + JSON.stringify(s1));
  }
  // ---- C3: the check read is slow (3 s) — still decides right, nothing double-saved ----
  {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { gone: 0 }; saw.m.slowGet = 3000;
    const t0 = Date.now();
    await saw.page.evaluate(TICK('side')); await save(saw.page); await quiet(saw.page);
    const ms = Date.now() - t0; saw.m.slowGet = 0;
    const s1 = await st(saw.page);
    await officeUntick(off, 'side');
    await saw.page.evaluate(() => { DB.weekCaps.y = 1; }); await save(saw.page); await quiet(saw.page);
    rec('C3 check reads take 3 s each: save confirmed (no failure shown), office untick later stays', !s1.failed && ticks(S) === 'keep', 'save took ' + ms + ' ms, after=' + JSON.stringify(s1) + ' final=' + ticks(S));
    info('C3 a lost reply with slow reads keeps the save busy for', ms + ' ms');
    await saw.close(); await off.close();
  }
  // ---- C4: two screens lose their replies at the same moment, ticking different lines ----
  for (let i = 0; i < 3; i++) {
    const S = makeServer(base());
    const a = await device(browser, S, { name: 'saw', latency: [5, 40] }, { role: 'saw' }), b = await device(browser, S, { name: 'stores', latency: [5, 40] }, { role: 'stores' });
    a.dev.dropReply = 1; b.dev.dropReply = 1;
    await a.page.evaluate(TICK('a' + i)); await b.page.evaluate(TICK('b' + i));
    await Promise.all([save(a.page), save(b.page)]); a.dev.dropReply = 0; b.dev.dropReply = 0;
    await quiet(a.page); await quiet(b.page);
    for (let k = 0; k < 3; k++) { await save(a.page); await quiet(a.page); await save(b.page); await quiet(b.page); }
    // and now each unticks its own
    await a.page.evaluate(UNTICK('a' + i)); await b.page.evaluate(UNTICK('b' + i));
    await Promise.all([save(a.page), save(b.page)]); await quiet(a.page); await quiet(b.page);
    for (let k = 0; k < 2; k++) { await save(a.page); await quiet(a.page); await save(b.page); await quiet(b.page); }
    const mid = S.hist ? S.hist.map(h => h.ticks.join('+')).join(' > ') : '';
    rec('C4/' + i + ' two screens lose replies together (both land or one does): both ticks reached the database, then both unticks stay', ticks(S) === 'keep' && S.hist.some(h => h.ticks.includes('a' + i) && h.ticks.includes('b' + i)), 'final=' + ticks(S) + ' history=' + mid);
    await a.close(); await b.close();
  }
  // ---- C5: legacy mode (Stage 1 SQL not run: no version column) — lost reply, office untick ----
  {
    const { S, saw, off } = await pair(browser, { server: { versioned: false } });
    saw.dev.dropReply = 1; await saw.page.evaluate(TICK('side')); await save(saw.page); await quiet(saw.page); saw.dev.dropReply = 0;
    const s1 = await st(saw.page), landed = ticks(S);
    await saw.page.evaluate(UNTICK('side')); await save(saw.page); await quiet(saw.page);
    rec('C5 legacy (no version column): lost reply then same-screen untick → untick stays, no page errors', landed === 'keep,side' && ticks(S) === 'keep' && !saw.dev.errors.length, 'landed=' + landed + ' final=' + ticks(S) + ' ' + JSON.stringify(s1) + ' errs=' + saw.dev.errors.join('|'));
    await saw.close(); await off.close();
  }
  // ---- C6: lost reply, write never landed, 2 office saves happen before the check's 2nd read could... (the check is fast) ----
  {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { never: 1 };
    await saw.page.evaluate(TICK('side')); await save(saw.page); await quiet(saw.page);
    const s1 = await st(saw.page);
    for (let i = 0; i < 2; i++) { await off.page.evaluate(async i => { await loadDB(); DB.weekCaps['o' + i] = 1; clearTimeout(saveT); await saveDB(); }, i); await quiet(off.page); }
    await save(saw.page); await quiet(saw.page);
    rec('C6 write never landed (reply lost), then 2 office saves: the saw tick is not dropped', ticks(S) === 'keep,side', 'final=' + ticks(S) + ' after first save=' + JSON.stringify(s1));
    await saw.close(); await off.close();
  }
  // ---- C7: a huge plan (2,500 jobs): the check's two reads + compare stay quick ----
  {
    const b = base(); b.orders = Array.from({ length: 2500 }, (_, i) => H.order({ wo: 'WO-' + i, title: 'Apartment ' + i + ' block C — kitchen' }));
    const S = makeServer(b);
    const saw = await device(browser, S, { name: 'saw' }, { role: 'saw' }); await rig(saw, S);
    saw.m.once = { gone: 0 };
    const t0 = Date.now(); await saw.page.evaluate(TICK('side')); await save(saw.page); await quiet(saw.page); const ms = Date.now() - t0;
    const s1 = await st(saw.page);
    rec('C7 2,500 jobs: lost reply decided "landed" by the check in under 3 s', !s1.failed && !s1.unsure && ms < 3000, ms + ' ms ' + JSON.stringify(s1));
    await saw.close();
  }
  await browser.close(); console.log(fail + ' failed of ' + (pass + fail));
})().catch(e => { console.error(e); process.exit(1); });
