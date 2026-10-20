// ATTACK 4: mixed fleet (a tab still running the OLD main-branch code), SQL-not-run fallback,
// device storage full/throwing, two tabs on one device, a refresh that overlaps a save, retry storms.
// Run: node tests/stage1/t4-fleet-offline.test.js
const { H, makeServer, device, attach, OLD_HTML, sleep } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], nid: 5, settings: { listRow: { L: { a: { m: 'saw' } } } } });
(async () => {
  const browser = await H.chromium.launch();
  if (OLD_HTML) for (const trigger of [false, true]) { // old-code tab still open on the stores PC after deploy
    const S = makeServer(base(), { trigger });
    const OLD = await device(browser, S, { name: 'old', old: true }, { role: 'office' });
    const NEW = await device(browser, S, { name: 'new' });
    await OLD.page.evaluate(async () => { DB.orders[0].notes = 'typed on old tab'; await saveDB(); });
    await NEW.page.evaluate(async () => { DB.orders[1].plannedWeek = '2026-11-09'; await saveDB(); });
    const n = S.row.orders[0].notes, w = S.row.orders[1].plannedWeek;
    rec('mixed fleet' + (trigger ? ' WITH a version-bump trigger' : ' (SQL as written)') + ': old-tab edit not overwritten by new tab', n === 'typed on old tab' && w === '2026-11-09', JSON.stringify({ oldEdit: n, newEdit: w, version: S.row.version }));
    await OLD.close(); await NEW.close();
  }
  { // SQL not run: two new-code PCs = old last-write-wins, and nothing tells the office
    const r = base(); delete r.version; const S = makeServer(r, { versioned: false });
    const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await A.page.evaluate(async () => { DB.orders[0].notes = 'A'; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[1].notes = 'B'; await saveDB(); });
    rec('fallback mode (SQL not run): both edits kept', S.row.orders[0].notes === 'A' && S.row.orders[1].notes === 'B', JSON.stringify(S.row.orders.map(o => o.notes)));
    const vis = await A.page.evaluate(() => document.body.innerText.match(/version|clash protection|SQL/i));
    rec('fallback mode is visible to the office (not only console)', !!vis, vis ? vis[0] : 'console warning only');
    await A.close(); await B.close();
  }
  { // device storage full: offline edits can't be kept, but the bar still promises they are
    const S = makeServer(base());
    const A = await device(browser, S, { name: 'A' }, { role: 'saw' });
    A.dev.offline = true;
    await A.page.evaluate(async () => { const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'wpfPending') throw new DOMException('QuotaExceededError', 'QuotaExceededError'); return si.call(this, k, v); }; for (let i = 0; i < 20; i++) DB.listRow.L['t' + i] = { m: 'saw' }; sched(); await saveDB(); });
    const st = await A.page.evaluate(() => ({ bar: document.getElementById('savebar').hidden ? '' : document.getElementById('savebar').textContent, pend: localStorage.getItem('wpfPending') }));
    rec('storage full: user is NOT told "kept on this device" when it is not', !(st.bar && /kept on this device/.test(st.bar) && !st.pend), 'bar="' + st.bar.slice(0, 70) + '" pend=' + (st.pend ? 'yes' : 'null'));
    await A.close();
  }
  { // 20 ticks offline, close tab, reopen days later after the office changed things
    const S = makeServer(base());
    const A = await device(browser, S, { name: 'A' }, { role: 'saw' }), O = await device(browser, S, { name: 'O' });
    A.dev.offline = true;
    await A.page.evaluate(async () => { for (let i = 0; i < 20; i++) DB.listRow.L['t' + i] = { m: 'saw' }; DB.orders[0].notes = 'saw note'; sched(); await saveDB(); writePend(); });
    await A.page.close({ runBeforeUnload: false });
    await O.page.evaluate(async () => { DB.orders[0].notes = 'office note'; DB.orders[1].plannedWeek = '2026-12-07'; DB.listRow.L.z = { m: 'stores' }; DB.orders.push(Object.assign(JSON.parse(JSON.stringify(DB.orders[0])), { wo: 'WO-3', notes: '' })); await saveDB(); });
    A.dev.offline = false;
    const p = await A.ctx.newPage(); await attach(p, S, A.dev); await p.goto('https://wpf.test/?view=saw');
    await p.waitForFunction(() => typeof loadDB === 'function' && DB.loaded); await p.waitForTimeout(2000);
    const L = Object.keys(S.row.settings.listRow.L);
    rec('reopen: 20 offline ticks + office changes all present', L.length === 22 && S.row.orders.length === 3 && S.row.orders[1].plannedWeek === '2026-12-07', L.length + ' ticks, ' + S.row.orders.length + ' jobs');
    rec('reopen: older offline note loses to newer office note (by design)', S.row.orders[0].notes === 'office note', S.row.orders[0].notes);
    const pend = await p.evaluate(() => localStorage.getItem('wpfPending'));
    rec('reopen: device copy cleared after send', pend === null, pend ? 'still there' : 'cleared');
    await O.close(); await A.close();
  }
  { // two tabs on the same office PC: tab 2 saving cleanly wipes tab 1's device copy
    const S = makeServer(base());
    const T1 = await device(browser, S, { name: 'T1' });
    const dev2 = { name: 'T2' }; const p2 = await T1.ctx.newPage(); await attach(p2, S, dev2); await p2.goto('https://wpf.test/?view=office'); await p2.waitForFunction(() => typeof loadDB === 'function' && DB.loaded);
    T1.dev.offline = true;
    await T1.page.evaluate(async () => { DB.orders[0].notes = 'tab one unsaved'; sched(); await saveDB(); });
    const had = await T1.page.evaluate(() => !!localStorage.getItem('wpfPending'));
    await p2.evaluate(async () => { DB.orders[1].notes = 'tab two'; await saveDB(); });
    const still = await p2.evaluate(() => localStorage.getItem('wpfPending'));
    rec('two tabs, one device: tab 2 does not wipe tab 1\'s kept changes', !had || (!!still && /tab one unsaved/.test(still)), 'tab1 kept=' + had + ' after tab2 save=' + (still ? 'present' : 'GONE'));
    await T1.close();
  }
  { // a 2-minute refresh whose reply arrives after this screen's own save landed
    const S = makeServer(base());
    const A = await device(browser, S, { name: 'A' });
    A.dev.getDelay = 600;
    const out = await A.page.evaluate(async () => {
      const lp = loadDB(); await new Promise(r => setTimeout(r, 50));
      orig['WO-1'] = 'X'; // stand-in for any just-saved change (e.g. Mark as applied)
      DB.orders[0].notes = 'just saved'; const sp = saveDB(); await sp; await lp;
      return { notes: DB.orders[0].notes, ver: VER };
    });
    rec('refresh reply arriving after own save does not roll the screen back', out.notes === 'just saved', JSON.stringify(out) + ' server v' + S.row.version + ' notes=' + S.row.orders[0].notes);
    await A.close();
  }
  { // retry storm: server version moves on every request (busy fleet) — bounded attempts, no spin
    const S = makeServer(base()); const A = await device(browser, S, { name: 'A' });
    const t0 = S.patches; S.storm = true;
    const orig = S.row; const iv = setInterval(() => { S.row.version++; }, 5);
    await A.page.evaluate(async () => { DB.orders[0].notes = 'storm'; await saveDB(); });
    clearInterval(iv);
    const st = await A.page.evaluate(() => ({ failed: !!DB.saveFailed, bar: !document.getElementById('savebar').hidden }));
    rec('retry storm: attempts bounded and user told', S.patches - t0 <= 6 && st.failed && st.bar, (S.patches - t0) + ' PATCHes, ' + JSON.stringify(st));
    await A.close();
  }
  { // huge payload: 2,500 jobs with logs — save + merge still work
    const big = base(); big.orders = []; for (let i = 0; i < 2500; i++) big.orders.push(H.order({ wo: 'WO-' + i, log: Array.from({ length: 20 }, (_, j) => ({ at: '2026-10-01', by: 'x', what: 'edit ' + j })) }));
    const S = makeServer(big); const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    const t = Date.now();
    await A.page.evaluate(async () => { DB.orders[5].notes = 'A'; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders[2000].notes = 'B'; await saveDB(); });
    const ms = Date.now() - t;
    rec('2,500 jobs: concurrent saves merge, under 10s', S.row.orders[5].notes === 'A' && S.row.orders[2000].notes === 'B' && ms < 10000, ms + 'ms, payload ' + Math.round(JSON.stringify(S.row).length / 1024) + 'KB');
    await A.close(); await B.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
