// Tester round 9 (3 Nov 2026): attack 076212e — after a lost reply the save check keeps looking for up to ~5 s while
// the signal is out; saves and the 2-min refresh wait meanwhile. Does that wait ever lose or badly delay a tick?
// Taps during the wait, tab closed during the wait, two lost replies in a row, a refresh due during the wait, reads that
// are slow but succeed at ~4.9 s, and the office changing the same line during the wait.
// Fake Supabase only (tsrv.js + an extra route on top). Run: node tests/stage1/t12-checkwait.test.js
const { H, makeServer, device, attach, sleep } = require('./tsrv');
process.on('unhandledRejection', () => {});
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const base = () => ({ id: 'main', version: 1, nid: 50, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], settings: { listRow: { L: { keep: { m: 'saw', by: 'T' } } }, weekCaps: {} } });
const ticks = S => Object.keys(((S.row.settings || {}).listRow || {}).L || {}).sort().join(',');
const TICK = k => `(()=>{DB.listRow=DB.listRow||{};DB.listRow.L=DB.listRow.L||{};DB.listRow.L[${JSON.stringify(k)}]={m:'saw',by:'Saw'};if(typeof schedSave==='function')schedSave();})()`;
const UNTICK = k => `(()=>{if(DB.listRow&&DB.listRow.L)delete DB.listRow.L[${JSON.stringify(k)}];})()`;
const idle = p => p.waitForFunction(() => !SAVING, null, { timeout: 40000, polling: 30 }).catch(() => {});
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); }).catch(e => 'ERR ' + e.message);
const kick = p => p.evaluate(() => { clearTimeout(saveT); saveDB(); }).catch(() => {}); // start a save, don't wait
const st = p => p.evaluate(() => ({ failed: !!DB.saveFailed, unsure: UNSURE.length, ver: VER, saving: !!SAVING, again: !!SAVE_AGAIN }));
async function flush(p) { for (let i = 0; i < 4; i++) { await idle(p); await save(p); } await idle(p); }
function apply(S, url, body) {
  const v = url.match(/version=eq\.(\d+)/);
  if (v && +v[1] !== S.row.version) { S.conflicts++; return 'conflict'; }
  const before = S.row.version; Object.assign(S.row, JSON.parse(JSON.stringify(body))); S.row.version = before + 1; S.okSaves++; return 'ok';
}
// D.m.once: {land:true|false, out:ms} the next PATCH: reply lost (lands if land), then no signal for `out` ms
// D.m.slowGet: ms added to every GET; D.m.lostN: the next N PATCHes all lose their reply (each lands)
async function rig(page, S, m) {
  await page.route(u => /supabase\.co/.test(String(u)), async route => {
    const q = route.request();
    if (m.outUntil && Date.now() < m.outUntil) return route.abort('internetdisconnected');
    if (/production_planner/.test(q.url()) && q.method() === 'PATCH') {
      const body = JSON.parse(q.postData() || '{}'), url = q.url();
      if (m.once) { const o = m.once; m.once = null; if (o.land) S.r1 = apply(S, url, body); m.outUntil = Date.now() + (o.out || 0); (m.log = m.log || []).push('lost:' + (o.land ? S.r1 : 'not sent')); return route.abort('connectionreset'); }
      if (m.lostN > 0) { m.lostN--; const r = apply(S, url, body); (m.log = m.log || []).push('lostN:' + r); return route.abort('connectionreset'); }
    }
    if (/production_planner/.test(q.url()) && q.method() === 'GET' && m.slowGet) await sleep(m.slowGet);
    return route.fallback();
  });
}
async function pair(browser) {
  const S = makeServer(base());
  const saw = await device(browser, S, { name: 'saw' }, { role: 'saw' }), off = await device(browser, S, { name: 'office' }, { role: 'office' });
  saw.m = {}; off.m = {}; await rig(saw.page, S, saw.m); await rig(off.page, S, off.m);
  return { S, saw, off };
}
(async () => {
  const browser = await H.chromium.launch();

  // D1 taps during the wait: tick Side (lands, reply lost, signal out 3 s); during the wait tick Top and untick Side
  for (const land of [true, false]) {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { land, out: 3000 };
    await saw.page.evaluate(TICK('side')); kick(saw.page);
    await sleep(800); await saw.page.evaluate(TICK('top')); kick(saw.page);
    await sleep(700); await saw.page.evaluate(UNTICK('side')); kick(saw.page);
    const during = await st(saw.page);
    const t0 = Date.now(); for (let i = 0; i < 100 && ticks(S) !== 'keep,top'; i++) { await sleep(100); if (!(await st(saw.page)).saving) kick(saw.page); }
    const ms = Date.now() - t0 + 1500;
    await flush(saw.page);
    rec('D1/' + (land ? 'landed' : 'not-landed') + ' taps during the 3-s wait (tick Top, untick Side) all reach the database: keep,top', ticks(S) === 'keep,top', 'final=' + ticks(S) + ' during=' + JSON.stringify(during) + ' log=' + saw.m.log);
    info('D1/' + (land ? 'landed' : 'not-landed') + ' Top reached the database about', ms + ' ms after it was tapped (signal out 3 s)');
    await saw.close(); await off.close();
  }
  // D2 tab closed during the wait (signal still out), reopened after signal is back
  for (const land of [true, false]) {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { land, out: 4000 };
    await saw.page.evaluate(TICK('side')); kick(saw.page);
    await sleep(700); await saw.page.evaluate(TICK('top')); await saw.page.evaluate(() => { if (typeof writePend === 'function') writePend(); }); kick(saw.page);
    await sleep(300);
    const warn = await saw.page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    await saw.page.close({ runBeforeUnload: false }); await sleep(3500);
    const p = await saw.ctx.newPage(); saw.m.outUntil = 0; await rig(p, S, saw.m); await attach(p, S, saw.dev);
    await p.goto('https://wpf.test/?view=saw').catch(() => {});
    await p.waitForFunction(() => typeof loadDB === 'function' && DB.loaded, null, { timeout: 15000 }).catch(() => {});
    await sleep(1500); await flush(p);
    rec('D2/' + (land ? 'landed' : 'not-landed') + ' tab closed during the wait, reopened: Side and Top both in the database', ticks(S) === 'keep,side,top', 'final=' + ticks(S) + ' log=' + saw.m.log);
    rec('D2b/' + (land ? 'landed' : 'not-landed') + ' closing the tab during the wait asks "leave page?" (a save is still being checked)', warn, 'beforeunload prevented=' + warn);
    await p.close(); await off.close(); await saw.ctx.close();
  }
  // D3 two lost replies in a row (both land), signal fine: no duplicate, nothing lost, how long?
  {
    const { S, saw, off } = await pair(browser);
    saw.m.lostN = 2;
    const t0 = Date.now();
    await saw.page.evaluate(TICK('side')); await save(saw.page); await idle(saw.page);
    await saw.page.evaluate(TICK('top')); await save(saw.page); await idle(saw.page);
    const ms = Date.now() - t0, s1 = await st(saw.page);
    await off.page.evaluate(async () => { await loadDB(); delete DB.listRow.L.side; clearTimeout(saveT); await saveDB(); }); await idle(off.page);
    await saw.page.evaluate(() => { DB.weekCaps.z = 1; }); await flush(saw.page);
    rec('D3 two lost replies in a row (both landed): both confirmed, office untick later stays', ticks(S) === 'keep,top' && !s1.failed && !s1.unsure, 'final=' + ticks(S) + ' ' + JSON.stringify(s1) + ' ' + ms + ' ms log=' + saw.m.log);
  }
  // D3b lost reply, NOT landed, re-send also loses its reply (lands) while signal flickers
  {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { land: false, out: 0 }; saw.m.lostN = 1;
    const t0 = Date.now(); await saw.page.evaluate(TICK('side')); await save(saw.page); await idle(saw.page); const ms = Date.now() - t0;
    const s1 = await st(saw.page);
    rec('D3b first send never landed, the re-send landed but its reply was lost too: confirmed, tick in the database once', ticks(S) === 'keep,side' && !s1.failed && !s1.unsure, 'final=' + ticks(S) + ' ' + JSON.stringify(s1) + ' ' + ms + ' ms log=' + saw.m.log);
    await saw.close(); await off.close();
  }
  // D4 refresh due during the wait: loadDB called while the check runs; the office's change to another line arrives
  {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { land: true, out: 2500 };
    await saw.page.evaluate(TICK('side')); kick(saw.page); await sleep(300);
    await off.page.evaluate(async () => { await loadDB(); DB.orders[1].notes = 'office note'; clearTimeout(saveT); await saveDB(); }); await idle(off.page);
    const r = await saw.page.evaluate(async () => { try { await loadDB(); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
    await sleep(3000); await flush(saw.page);
    await saw.page.evaluate(async () => { await loadDB(); });
    const seen = await saw.page.evaluate(() => DB.orders[1].notes);
    rec('D4 refresh while the check waits: no error, Side kept, the office note (saved during the wait) kept and shown', r === 'ok' && ticks(S) === 'keep,side' && S.row.orders[1].notes === 'office note' && seen === 'office note', 'refresh=' + r + ' final=' + ticks(S) + ' db note=' + S.row.orders[1].notes + ' shown=' + seen);
    await saw.close(); await off.close();
  }
  // D5 reads slow but succeeding at ~4.9 s each
  {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { land: true, out: 0 }; saw.m.slowGet = 4900;
    const t0 = Date.now(); await saw.page.evaluate(TICK('side')); await save(saw.page); await idle(saw.page); const ms = Date.now() - t0;
    saw.m.slowGet = 0; const s1 = await st(saw.page);
    rec('D5 check reads take 4.9 s: landed save confirmed (no false failure)', !s1.failed && !s1.unsure && ticks(S) === 'keep,side', JSON.stringify(s1) + ' took ' + ms + ' ms');
    info('D5 save blocked for', ms + ' ms');
    await saw.close(); await off.close();
  }
  {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { land: false, out: 0 }; saw.m.slowGet = 4900;
    const t0 = Date.now(); await saw.page.evaluate(TICK('side')); await save(saw.page); await idle(saw.page); const ms = Date.now() - t0;
    saw.m.slowGet = 0; await flush(saw.page);
    rec('D5b check reads take 4.9 s, first send never landed: tick still reaches the database', ticks(S) === 'keep,side', 'final=' + ticks(S) + ' took ' + ms + ' ms');
    info('D5b save blocked for', ms + ' ms');
    await saw.close(); await off.close();
  }
  // D6 the office unticks Side DURING the outage (before the check could read): residual window?
  for (const out of [1500, 4000, 8000]) {
    const { S, saw, off } = await pair(browser);
    saw.m.once = { land: true, out };
    await saw.page.evaluate(TICK('side')); kick(saw.page); await sleep(Math.min(800, out / 2));
    await off.page.evaluate(async () => { await loadDB(); delete DB.listRow.L.side; clearTimeout(saveT); await saveDB(); }); await idle(off.page);
    await sleep(out + 500); await flush(saw.page);
    rec('D6/' + out + 'ms office unticks Side while the saw has no signal (' + out + ' ms) right after its lost reply: office untick stays', ticks(S) === 'keep', 'final=' + ticks(S));
    await saw.close(); await off.close();
  }
  await browser.close(); console.log(fail + ' failed of ' + (pass + fail));
})().catch(e => { console.error(e); process.exit(1); });
