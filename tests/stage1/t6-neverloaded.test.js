// ATTACK 6: a tab that opens with NO signal and never loads the plan (phone reopened in a dead spot).
// Real-world question: can a floor user still see/tick anything there that is then silently lost?
// Also: does such a tab keep (not wipe) unsaved ticks left on the device from last time, and send them
// once signal returns via the normal 2-minute refresh? And what does the office see in the same state?
// Run: node tests/stage1/t6-neverloaded.test.js
const { H, makeServer, attach, device, sleep } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1', delv: true, delVeh: 'v1', delDay: 'Mon' }), H.order({ wo: 'WO-2' })], nid: 5, settings: { listRow: { L: {} } } });
async function openOffline(browser, S, role, ctx) {
  const dev = { name: role + '-off', offline: true };
  ctx = ctx || await browser.newContext({ viewport: { width: 380, height: 800 }, timezoneId: 'Europe/Dublin' });
  await ctx.addInitScript(({ role }) => {
    if (!localStorage.getItem('wpfRole')) { localStorage.setItem('wpfRole', role); localStorage.setItem('wpfPin_' + role, '9000'); localStorage.setItem('wpfPin_office', '2468'); localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); }
    sessionStorage.setItem('wpfWho', 'T'); window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'T';
  }, { role });
  const page = await ctx.newPage(); dev.errors = []; page.on('pageerror', e => dev.errors.push(String(e)));
  await attach(page, S, dev);
  await page.goto('https://wpf.test/?view=' + role);
  await page.waitForFunction(() => typeof loadDB === 'function'); await sleep(1200);
  return { ctx, page, dev };
}
const info = (n, d) => console.log('INFO ' + n + '  -> ' + d);
const controls = p => p.evaluate(() => { const a = document.getElementById('app'); return [...a.querySelectorAll('button,input,select,textarea,[onclick],[contenteditable="true"],label')].filter(e => e.offsetParent !== null).map(e => (e.tagName + ':' + (e.textContent || e.value || '').trim()).slice(0, 40)); });
(async () => {
  const browser = await H.chromium.launch();
  // 1. every floor role, never loaded: nothing to tick, clear message
  for (const role of ['saw', 'stores', 'driver', 'pm', 'floor', 'dash', 'prod']) {
    const S = makeServer(base());
    const T = await openOffline(browser, S, role);
    const st = await T.page.evaluate(() => ({ lf: DB.loadFailed, loaded: DB.loaded, txt: document.getElementById('app').innerText }));
    const c = await controls(T.page);
    rec(role + ': never-loaded screen blocks every control', st.lf && !st.loaded && c.length === 0, c.join(', ') || 'none');
    rec(role + ': says plainly it cannot reach the database', /Can't reach the planner database/.test(st.txt) && /no data/i.test(st.txt), st.txt.slice(0, 80));
    // a direct save attempt from this screen must not write anything
    const p0 = S.patches; T.dev.offline = false;
    await T.page.evaluate(async () => { await saveDB(); });
    rec(role + ': never-loaded screen never saves (even when signal returns before refresh)', S.patches === p0, (S.patches - p0) + ' PATCH');
    // signal back -> the 2-minute refresh loads and shows the real view
    await T.page.evaluate(async () => { await loadDB(); render(); });
    const after = await T.page.evaluate(() => ({ loaded: DB.loaded, lf: DB.loadFailed, blocked: /Can't reach the planner database/.test(document.getElementById('app').innerText) }));
    rec(role + ': recovers on the next refresh once signal returns', after.loaded && !after.lf && !after.blocked, JSON.stringify(after));
    if (T.dev.errors.length) rec(role + ': no page errors', false, T.dev.errors[0]);
    await T.ctx.close();
  }
  // 2. ticks made offline on a loaded phone, tab closed, reopened still offline (never loads), then signal returns
  for (const role of ['saw', 'stores', 'driver']) {
    const S = makeServer(base());
    const A = await device(browser, S, { name: role }, { role });
    A.dev.offline = true;
    await A.page.evaluate(async role => {
      if (role === 'driver') { DB.orders[0].delDone = true; } else { for (let i = 0; i < 5; i++) DB.listRow.L['off' + i] = { m: role === 'saw' ? 'saw' : 'fit', by: 'T' }; }
      sched(); await saveDB(); writePend();
    }, role);
    const ctx = A.ctx; await A.page.close({ runBeforeUnload: false });
    const R = await openOffline(browser, S, role, ctx);
    const kept = await R.page.evaluate(() => localStorage.getItem('wpfPending'));
    rec(role + ': reopened offline (never loaded) keeps last session\'s unsaved ticks on the device', !!kept && /off0|delDone/.test(kept), kept ? kept.length + ' bytes' : 'GONE');
    const txt = await R.page.evaluate(() => document.body.innerText);
    info(role + ': [Low] blocked screen mentions the unsent ticks are held on this phone', /kept|unsaved|not saved/i.test(txt) ? 'yes' : 'no mention — only "can\'t reach the database"');
    R.dev.offline = false;
    await R.page.evaluate(async () => { await loadDB(); render(); }); await sleep(2500);
    await R.page.evaluate(async () => { if (saveT) await saveDB(); });
    const ok = role === 'driver' ? S.row.orders[0].delDone === true : [0, 1, 2, 3, 4].every(i => S.row.settings.listRow.L['off' + i]);
    rec(role + ': those ticks reach the database after signal returns', ok, JSON.stringify(role === 'driver' ? S.row.orders[0].delDone : Object.keys(S.row.settings.listRow.L)));
    await ctx.close();
  }
  // 3. office never loaded: the board renders (empty) under a red banner. Are edits made there lost?
  {
    const S = makeServer(base());
    const T = await openOffline(browser, S, 'office');
    const st = await T.page.evaluate(() => ({ banner: /Nothing you do here will be saved/.test(document.body.innerText), ctl: document.querySelectorAll('#app button,#app input').length }));
    rec('office never-loaded: red banner "Nothing you do here will be saved"', st.banner, JSON.stringify(st));
    await T.page.evaluate(async () => { DB.orders.push({ wo: 'WO-OFF', title: 'typed while offline', hours: 3, value: 100, plannedWeek: '', log: [] }); sched(); await saveDB(); });
    T.dev.offline = false; await T.page.evaluate(async () => { await loadDB(); render(); });
    const p = S.row.orders.some(o => o.wo === 'WO-OFF');
    info('office never-loaded: edits made under the banner on recovery', p ? 'saved' : 'discarded (user was warned by banner)');
    rec('office never-loaded: real plan untouched', S.row.orders.length === 2 && S.patches === 0, S.row.orders.length + ' jobs, ' + S.patches + ' PATCH');
    await T.ctx.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
