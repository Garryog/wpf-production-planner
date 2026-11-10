// ATTACK 9 (Tester, round 4): the "zombie untick" — a tick that was unticked on a phone comes back.
// 3 devices (saw, stores, office) each tick then untick a couple of list lines every iteration, all at the same
// time, with a randomly chosen save path per line:
//   refresh  : tick's save lands but the reply is lost; untick; the 2-min refresh (loadDB merge) runs before the next save
//   retry    : tick's save lands, reply lost; untick; next save fails (503); the 30-s retry sends it
//   replay   : tick's save lands, reply lost; untick; tab closed (device copy written) before saving; reopen -> pending replay
//   inflight : tick's save is still IN FLIGHT when the line is unticked and the tab is closed (phone locked / tab swiped);
//              the save lands after the tab is gone; reopen -> pending replay
//   overflow : tick's save lands, reply lost; untick; the next 5+ saves also lose their replies (bad signal); then signal back
//   random   : tick/untick with random latency, 503s, lost replies, offline and refreshes at random moments
// Every untick must survive on the server; every "keeper" tick must survive too.
// Fake Supabase only (tsrv.js) — nothing touches the network.
// Run: node tests/stage1/t9-untick.test.js [iterations=70] [seed=9]   (env PATHS=refresh,retry,... to restrict)
const { H, makeServer, device, attach, sleep } = require('./tsrv');
process.on('unhandledRejection', () => {}); // route handlers of closed tabs reject when they try to reply — expected
const ITER = +(process.argv[2] || 70);
let seed = +(process.argv[3] || 9); const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const PATHS = (process.env.PATHS || 'refresh,retry,replay,inflight,overflow,random').split(',');
const NAMES = ['saw', 'stores', 'office'];
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const ev = (D, js) => D.page.evaluate(js).catch(e => 'ERR ' + e.message.split('\n')[0]);
const TICK = k => `(()=>{DB.listRow=DB.listRow||{};DB.listRow.L=DB.listRow.L||{};DB.listRow.L[${JSON.stringify(k)}]={m:'saw',by:'T'};})()`;
const UNTICK = k => `(()=>{if(DB.listRow&&DB.listRow.L)delete DB.listRow.L[${JSON.stringify(k)}];})()`;
async function reopen(D) {
  await D.page.close({ runBeforeUnload: false }).catch(() => {});
  const p = await D.ctx.newPage(); p.on('pageerror', e => D.dev.errors.push(String(e)));
  await attach(p, D.S, D.dev);
  await p.goto('https://wpf.test/?view=' + D.role).catch(() => {});
  await p.waitForFunction(() => typeof loadDB === 'function' && DB.loaded, null, { timeout: 15000 }).catch(() => {});
  D.page = p; D.reopens++;
}
const settledFn = () => !SAVING && !DB.saveFailed && DB.loaded && same(snap(), BASE) && !UNSURE.length;
async function settle(devs) {
  devs.forEach(D => { Object.assign(D.dev, { offline: false, failRate: 0, dropReply: 0, latency: [5, 40] }); });
  for (let pass = 0; pass < 8; pass++) {
    for (const D of devs) {
      await ev(D, async () => { if (!DB.loaded) await loadDB(); for (let i = 0; i < 50 && SAVING; i++) await new Promise(r => setTimeout(r, 40)); await saveDB(); });
      await D.page.waitForFunction(() => !SAVING, null, { timeout: 10000, polling: 30 }).catch(() => {});
    }
    for (const D of devs) await ev(D, async () => { await loadDB(); });
    const ok = []; for (const D of devs) ok.push(await ev(D, settledFn));
    if (ok.every(x => x === true) && pass >= 1) return true;
  }
  return false;
}
async function scenario(D, key, path, log) {
  const L = s => log.push(D.name + ':' + key + ' ' + s);
  if (path === 'refresh' || path === 'retry' || path === 'replay' || path === 'overflow') {
    D.dev.dropReply = 1; D.dev.latency = [10, 120];
    await ev(D, TICK(key)); await ev(D, async () => { await saveDB(); }); L('tick sent, reply lost');
    D.dev.dropReply = 0;
    await sleep(rnd() * 300);
    await ev(D, UNTICK(key)); L('unticked');
    if (path === 'refresh') { await ev(D, async () => { await loadDB(); render(); }); L('refresh'); await ev(D, async () => { await saveDB(); }); }
    else if (path === 'retry') { D.dev.failRate = 1; await ev(D, async () => { await saveDB(); }); D.dev.failRate = 0; L('save 503'); await sleep(rnd() * 300); await ev(D, async () => { await saveDB(); }); L('retry'); }
    else if (path === 'replay') { await ev(D, () => writePend()); L('tab closed'); await reopen(D); L('reopened'); }
    else { // overflow: 5-7 more saves whose replies are lost (they hit a moved version, so they don't land)
      D.dev.dropReply = 1; const n = 5 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) { await ev(D, async () => { DB.weekCaps = DB.weekCaps || {}; DB.weekCaps['__n'] = (DB.weekCaps['__n'] || 0) + 1; await saveDB(); }); }
      D.dev.dropReply = 0; L(n + ' more lost-reply saves'); await ev(D, async () => { await saveDB(); }); L('signal back, saved');
    }
  } else if (path === 'inflight') {
    D.dev.latency = [500, 700];
    await ev(D, `(()=>{${TICK(key)};saveDB();})()`); L('tick save in flight');
    await sleep(80 + rnd() * 500);
    await ev(D, `(()=>{${UNTICK(key)};sched();writePend();})()`); L('unticked, tab closed');
    await reopen(D); L('reopened'); D.dev.latency = [10, 120];
  } else { // random
    const w = () => { D.dev.latency = [10, 50 + rnd() * 600]; D.dev.dropReply = rnd() < 0.4 ? 0.5 : 0; D.dev.failRate = rnd() < 0.3 ? 0.5 : 0; D.dev.offline = rnd() < 0.15; };
    w(); await ev(D, `(()=>{${TICK(key)};sched();})()`); L('tick (sched)');
    if (rnd() < 0.5) { await ev(D, async () => { await saveDB(); }); L('save'); }
    await sleep(rnd() * 1500); w();
    await ev(D, `(()=>{${UNTICK(key)};sched();})()`); L('untick (sched)');
    const r = rnd();
    if (r < 0.3) { await ev(D, async () => { await loadDB(); render(); }); L('refresh'); }
    else if (r < 0.5) { await ev(D, () => writePend()); await reopen(D); L('reopen'); }
    await sleep(rnd() * 1500); w();
    if (rnd() < 0.5) { await ev(D, async () => { await loadDB(); }); L('refresh2'); }
    D.dev.offline = false; D.dev.dropReply = 0; D.dev.failRate = 0;
  }
}

// Part 1 — deterministic single-cause repros (each one isolates ONE save path)
async function deterministic(browser) {
  const base = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1' })], settings: { listRow: { L: {} }, weekCaps: {} } });
  const has = S => !!S.row.settings.listRow.L.K;
  for (const p of ['refresh merge', 'retry (clash merge in pushPlan)', 'pending replay on reopen', 'refresh merge, no other screen saved (control)']) {
    const S = makeServer(base());
    const A = await device(browser, S, { name: 'A' }, { role: 'saw' }), B = await device(browser, S, { name: 'B' }, { role: 'stores' });
    A.dev.dropReply = 1; await A.page.evaluate(async () => { DB.listRow.L.K = { m: 'saw' }; await saveDB(); }); A.dev.dropReply = 0; // tick lands, reply lost
    if (!p.includes('control')) await B.page.evaluate(async () => { await loadDB(); DB.listRow.L.OTHER = { m: 'stores' }; await saveDB(); }); // stores ticks a different line
    await A.page.evaluate(() => { delete DB.listRow.L.K; }); // saw unticks (mis-tap)
    if (p.startsWith('refresh')) { await A.page.evaluate(async () => { await loadDB(); }); await A.page.evaluate(async () => { await saveDB(); }); }
    if (p.startsWith('retry')) await A.page.evaluate(async () => { await saveDB(); });
    if (p.startsWith('pending')) { await A.page.evaluate(() => writePend()); A.page = await (async () => { await A.page.close(); const pg = await A.ctx.newPage(); await attach(pg, S, A.dev); await pg.goto('https://wpf.test/?view=saw'); await pg.waitForFunction(() => typeof DB !== 'undefined' && DB.loaded); return pg; })(); await sleep(2000); await A.page.evaluate(async () => { await saveDB(); }); }
    await sleep(800);
    rec('DET ' + p + ': untick after a lost-reply tick survives', !has(S), 'server ticks: ' + Object.keys(S.row.settings.listRow.L).join(',') + ' (OTHER must stay: ' + !!(p.includes('control') || S.row.settings.listRow.L.OTHER) + ')');
    await A.ctx.close(); await B.close();
  }
  { // UNSURE keeps only the last 5 unconfirmed saves
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A' }, { role: 'saw' });
    A.dev.dropReply = 1; await A.page.evaluate(async () => { DB.listRow.L.K = { m: 'saw' }; await saveDB(); });
    await A.page.evaluate(() => { delete DB.listRow.L.K; });
    for (let i = 0; i < 5; i++) await A.page.evaluate(async (i) => { DB.weekCaps.n = i; await saveDB(); }, i); // 5 more saves, replies lost (bad signal)
    A.dev.dropReply = 0; await A.page.evaluate(async () => { await saveDB(); }); await sleep(500);
    rec('DET untick survives 5 further lost-reply saves (UNSURE holds only 5)', !has(S), 'server ticks: ' + Object.keys(S.row.settings.listRow.L).join(',')); await A.close();
  }
  { // tab closed while the tick's save is still in flight
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A', latency: [600, 600] }, { role: 'saw' });
    await A.page.evaluate(() => { DB.listRow.L.K = { m: 'saw' }; saveDB(); }); await sleep(100);
    await A.page.evaluate(() => { delete DB.listRow.L.K; sched(); writePend(); }); await A.page.close({ runBeforeUnload: false });
    await sleep(800); const landed = has(S);
    const pg = await A.ctx.newPage(); A.dev.latency = [5, 5]; await attach(pg, S, A.dev); await pg.goto('https://wpf.test/?view=saw'); await pg.waitForFunction(() => typeof DB !== 'undefined' && DB.loaded); await sleep(2000);
    rec('DET untick survives closing the tab while the tick save is in flight', !has(S), 'tick landed after close=' + landed + ', server ticks: ' + Object.keys(S.row.settings.listRow.L).join(',') + ', reopened screen shows K=' + await pg.evaluate(() => !!DB.listRow.L.K)); await A.ctx.close();
  }
}
(async () => {
  const browser = await H.chromium.launch();
  if (!process.env.SOAKONLY) await deterministic(browser);
  if (ITER <= 0) { await browser.close(); console.log(res.filter(x => !x).length + ' failed of ' + res.length); return; }
  const S = makeServer({ id: 'main', version: 1, nid: 50, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], settings: { listRow: { L: { keep0: { m: 'saw', by: 'T' } } }, weekCaps: {} } });
  const devs = [];
  for (const n of NAMES) { const dev = { name: n, latency: [10, 120] }; const D = await device(browser, S, dev, { role: n }); Object.assign(D, { name: n, role: n, S, reopens: 0 }); devs.push(D); }
  const zombies = [], lostKeep = [], byPath = {}; let unsettled = 0, skippedOps = 0;
  const t0 = Date.now();
  for (let it = 0; it < ITER; it++) {
    const log = [], plan = [];
    const h0 = (S.hist || []).length;
    await Promise.all(devs.map(async (D, di) => {
      for (let j = 0; j < 2; j++) { // a few lines per device per iteration
        const key = D.name + '-' + it + '-' + j, path = PATHS[Math.floor(rnd() * PATHS.length)];
        if ((await ev(D, () => !DB.loaded || !!DB.loadFailed)) !== false) { D.dev.offline = false; await ev(D, async () => { await loadDB(); }); log.push(D.name + ':' + key + ' skipped (tab never loaded)'); skippedOps++; continue; }
        plan.push([key, path]); byPath[path] = (byPath[path] || 0) + 1;
        await scenario(D, key, path, log);
      }
      if (rnd() < 0.3) { const k = 'keep-' + D.name + '-' + it; const r = await ev(D, `(()=>{if(!DB.loaded||DB.loadFailed)return 'blocked';const s={saving:SAVING,failed:!!DB.saveFailed,unsure:UNSURE.length};${TICK(k)};sched();return JSON.stringify(s);})()`); log.push(D.name + ':' + k + ' keeper ticked ' + r); if (r !== 'blocked') plan.push([k, 'keeper']); } // a never-loaded tab shows only the blocking screen (t6) — no one can tick there
    }));
    if (!(await settle(devs))) unsettled++;
    const ticks = Object.keys(((S.row.settings || {}).listRow || {}).L || {});
    for (const [k, path] of plan) {
      if (path === 'keeper') {
        if (!ticks.includes(k)) {
          lostKeep.push(k); const tl = []; let st = false;
          (S.hist || []).slice(h0).forEach(x => { const has = x.ticks.includes(k); if (has !== st) { tl.push((has ? '+' : '-') + ' by ' + x.who + ' v' + x.v); st = has; } });
          const dn = k.split('-')[1];
          console.log('  LOST KEEPER it' + it + ' ' + k + '\n    server: ' + (tl.join(' | ') || 'never reached the server') + '\n    that device this iteration: ' + log.filter(l => l.startsWith(dn + ':')).join(' ; '));
        }
        continue;
      }
      if (ticks.includes(k)) {
        const tl = []; let st = false;
        (S.hist || []).slice(h0).forEach(x => { const has = x.ticks.includes(k); if (has !== st) { tl.push((has ? '+' : '-') + ' by ' + x.who + ' v' + x.v); st = has; } });
        zombies.push({ it, k, path, server: tl.join(' | '), device: log.filter(l => l.includes(':' + k + ' ')).join(' ; ') });
        await ev(devs[0], UNTICK(k)); await settle(devs); // clean up so later iterations aren't confused
      }
    }
    if (!ticks.includes('keep0')) lostKeep.push('keep0@' + it);
    if ((it + 1) % 10 === 0) console.log('  .. iteration ' + (it + 1) + '/' + ITER + ' zombies so far ' + zombies.length + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  }
  zombies.forEach(z => console.log('  ZOMBIE it' + z.it + ' ' + z.k + ' [' + z.path + ']\n    server: ' + z.server + '\n    device: ' + z.device));
  const zp = {}; zombies.forEach(z => { zp[z.path] = (zp[z.path] || 0) + 1; });
  console.log('  untick attempts by path: ' + JSON.stringify(byPath) + '; zombies by path: ' + JSON.stringify(zp));
  rec('every untick survived (' + Object.values(byPath).reduce((a, b) => a + b, 0) + ' unticks over ' + ITER + ' iterations)', !zombies.length, zombies.length + ' came back');
  for (const p of PATHS) if (byPath[p]) rec('  path "' + p + '": no zombie', !zp[p], (zp[p] || 0) + ' of ' + byPath[p]);
  rec('every keeper tick survived', !lostKeep.length, lostKeep.slice(0, 5).join(','));
  rec('every iteration settled (all screens saved and identical)', !unsettled, unsettled + ' iterations did not settle');
  const errs = devs.flatMap(D => D.dev.errors); rec('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log('lines skipped because the tab had never loaded (blocking screen, no UI): ' + skippedOps);
  console.log('server: patches=' + S.patches + ' ok=' + S.okSaves + ' conflicts=' + S.conflicts + ' version=' + S.row.version + ' reopens=' + devs.map(D => D.reopens).join('/'));
  for (const D of devs) await D.close().catch(() => {}); await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
