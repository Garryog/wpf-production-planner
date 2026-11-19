// R1 (plan growth-archive, option a — Garry 19 Nov): before the 2-minute refresh the screen asks only for the record's
// version number; the full record is downloaded only when it changed, when this screen has work to merge, when the
// version can't be read, or at least every 10 minutes. Fake Supabase only (tests/stage1/srv.js) — never the live database.
// Run: node tests/sync/r1-version-check.test.js
const { H, makeServer, attach, open } = require('../stage1/srv.js');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = (v = 1) => ({ id: 'main', ...(v === null ? {} : { version: v }), orders: [H.order({ wo: 'WO-1', notes: '' }), H.order({ wo: 'WO-2' })], nid: 5, settings: {} });
// Like PostgREST: "select=version" answers only that column (the shared fake returns the whole row for every GET).
async function realVer(t, S, mode) {
  await t.page.route(/production_planner\?id=eq\.main&select=version/, route => {
    S.log.push('GET ?select=version');
    if (S.verMode === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' });
    if (S.verMode === 'abort') return route.abort('internetdisconnected');
    if (S.verMode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (!S.versioned) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"42703","message":"column production_planner.version does not exist"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ version: S.row.version }]) });
  });
}
// Fire the real 2-minute refresh callback once (captured from startAutoRefresh), and wait for it to finish.
async function tick(page) {
  return page.evaluate(async () => {
    const si = window.setInterval; let fn = null;
    window.setInterval = (f, ms) => { if (ms === 120000) fn = f; return si(() => {}, 1e9); };
    try { startAutoRefresh(); } finally { window.setInterval = si; }
    clearInterval(viewTimer);
    const r0 = window.refreshDB; let done;
    const p = new Promise(r => done = r);
    window.refreshDB = function () { const q = r0.apply(this, arguments); q.then(done, done); return q; };
    try { fn(); await p; } finally { window.refreshDB = r0; }
    await new Promise(r => setTimeout(r, 50));
  });
}
const fullGets = S => S.log.filter(l => /^GET \/production_planner\?id=eq\.main$/.test(l)).length;
const verGets = S => S.log.filter(l => l === 'GET ?select=version').length;
// Open a screen and let its start-up save (the one-off Export Changes baseline) finish, so it starts calm.
async function pc(browser, S) {
  const t = await open(browser, S); await realVer(t, S); await t.page.evaluate(() => clearInterval(viewTimer));
  await t.page.evaluate(async () => { for (let i = 0; i < 60 && (saveT || SAVING); i++) await new Promise(r => setTimeout(r, 100)); if (saveT) await saveDB(); });
  return t;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    // 1. nothing changed → only the tiny request
    {
      const S = makeServer(base()); const A = await pc(browser, S);
      S.log.length = 0;
      await tick(A.page);
      const sk = await A.page.evaluate(() => SYNC.skips);
      rec('1 nothing changed: only the version request, no full download', verGets(S) === 1 && fullGets(S) === 0, S.log.join(', '));
      rec('1 counted as skipped', sk === 1, 'skips=' + sk);
      const sz = await A.page.evaluate(async () => (await (await fetch(SUPA_URL + '/production_planner?id=eq.main&select=version', { headers: SUPA_HDR })).text()).length);
      rec('1 the quick reply is under 1 KB', sz < 1024, sz + ' bytes');
      S.log.length = 0; await tick(A.page); await tick(A.page);
      rec('1 three quiet refreshes in a row: still no full download', fullGets(S) === 0 && verGets(S) === 2, S.log.join(', '));
      await A.close();
    }
    // 2. PC B saves → PC A picks it up on its next refresh
    {
      const S = makeServer(base()); const A = await pc(browser, S); const B = await pc(browser, S);
      const v0 = S.row.version;
      await B.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-2').notes = 'from B'; await saveDB(); });
      rec('2 B saved (version moved on)', S.row.version === v0 + 1, 'v' + v0 + ' → v' + S.row.version);
      S.log.length = 0;
      await tick(A.page);
      const a = await A.page.evaluate(() => ({ n: DB.orders.find(o => o.wo === 'WO-2').notes, v: VER, txt: document.getElementById('app').innerText.includes('WO-2') }));
      rec('2 A asked for the version, then downloaded the full record', verGets(S) === 1 && fullGets(S) === 1, S.log.join(', '));
      rec('2 A shows B\'s change after one refresh', a.n === 'from B' && a.v === v0 + 1, JSON.stringify(a));
      S.log.length = 0; await tick(A.page);
      rec('2 next refresh with nothing new is skipped again', fullGets(S) === 0 && verGets(S) === 1, S.log.join(', '));
      // A's own save: the number it saved is what it holds → its next refresh is skipped too
      await A.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1').notes = 'from A'; await saveDB(); });
      S.log.length = 0; await tick(A.page);
      rec('2 after A\'s own save the refresh is skipped (A holds that version)', fullGets(S) === 0 && S.row.version === v0 + 2, S.log.join(', ') + ' v' + S.row.version);
      S.log.length = 0; await tick(B.page);
      const b = await B.page.evaluate(() => DB.orders.find(o => o.wo === 'WO-1').notes);
      rec('2 B picks up A\'s save on its next refresh', fullGets(S) === 1 && b === 'from A', S.log.join(', ') + ' / ' + b);
      await A.close(); await B.close();
    }
    // 3. unsaved local work → full load + merge still happens
    {
      const S = makeServer(base()); const A = await pc(browser, S); const B = await pc(browser, S);
      await A.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').notes = 'A typing'; }); // not saved yet (no save queued)
      S.log.length = 0; await tick(A.page);
      rec('3 unsaved work, nothing new in the database: still a full load (no shortcut)', fullGets(S) >= 1 && verGets(S) === 0, S.log.join(', '));
      await sleep(1600); // the merge queued a save
      await A.page.evaluate(async () => { if (saveT) await saveDB(); for (let i = 0; i < 50 && SAVING; i++) await new Promise(r => setTimeout(r, 100)); });
      rec('3 A\'s unsaved note reached the database', S.row.orders.find(o => o.wo === 'WO-1').notes === 'A typing', S.row.orders.find(o => o.wo === 'WO-1').notes);
      await B.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-2').notes = 'B saved'; await saveDB(); });
      await A.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').step = '5. Cutting'; });
      S.log.length = 0; await tick(A.page);
      const a = await A.page.evaluate(() => ({ s: DB.orders.find(o => o.wo === 'WO-1').step, n: DB.orders.find(o => o.wo === 'WO-2').notes }));
      rec('3 unsaved work + B saved: full load and merge keep both', fullGets(S) >= 1 && a.s === '5. Cutting' && a.n === 'B saved', JSON.stringify(a) + ' ' + S.log.join(', '));
      await sleep(1600);
      await A.page.evaluate(async () => { if (saveT) await saveDB(); for (let i = 0; i < 50 && SAVING; i++) await new Promise(r => setTimeout(r, 100)); });
      const row = S.row.orders;
      rec('3 merged result saved: A\'s step and B\'s note both in the database', row.find(o => o.wo === 'WO-1').step === '5. Cutting' && row.find(o => o.wo === 'WO-2').notes === 'B saved', row.find(o => o.wo === 'WO-1').step + ' / ' + row.find(o => o.wo === 'WO-2').notes);
      // a save that may have landed without a reply (UNSURE) also forces the full load
      await A.page.evaluate(() => { UNSURE.push(snap()); });
      S.log.length = 0; await tick(A.page);
      rec('3 an unconfirmed save on this screen: full load, not skipped', fullGets(S) >= 1, S.log.join(', '));
      await A.close(); await B.close();
    }
    // 4. VER null (Stage 1 SQL not installed) → full load as before, no version request
    {
      const S = makeServer(base(null), { versioned: false }); const A = await pc(browser, S);
      const v = await A.page.evaluate(() => VER);
      S.log.length = 0; await tick(A.page); await tick(A.page);
      rec('4 legacy record (no version column): VER is null', v === null, String(v));
      rec('4 legacy: every refresh is a full load, no version request', fullGets(S) === 2 && verGets(S) === 0, S.log.join(', '));
      await A.close();
    }
    // 5. version request fails / comes back empty → full load
    for (const mode of ['fail', 'abort', 'empty']) {
      const S = makeServer(base()); const A = await pc(browser, S);
      S.verMode = mode; S.log.length = 0; await tick(A.page);
      const st = await A.page.evaluate(() => ({ ok: DB.lastLoadOk, lf: DB.loadFailed }));
      rec('5 version request ' + mode + ': full load instead', verGets(S) === 1 && fullGets(S) === 1 && st.ok && !st.lf, S.log.join(', ') + ' ' + JSON.stringify(st));
      // and if the full load also fails, the screen keeps what it has (as before)
      if (mode === 'abort') {
        S.offline = true; S.log.length = 0; await tick(A.page);
        const s2 = await A.page.evaluate(() => ({ loaded: DB.loaded, lf: DB.loadFailed, n: DB.orders.length }));
        rec('5 no signal at all: screen keeps its jobs, not marked never-loaded', s2.loaded && !s2.lf && s2.n === 2, JSON.stringify(s2));
        S.offline = false; S.verMode = null; S.log.length = 0; await tick(A.page);
        rec('5 signal back: the refresh after a failed load is a full load', fullGets(S) === 1, S.log.join(', '));
      }
      await A.close();
    }
    // 6. 10-minute safety net
    {
      const S = makeServer(base()); const A = await pc(browser, S);
      await A.page.evaluate(() => { SYNC.lastFull = Date.now() - 9 * 60000; });
      S.log.length = 0; await tick(A.page);
      rec('6 9 minutes since the last full load, nothing changed: skipped', fullGets(S) === 0, S.log.join(', '));
      await A.page.evaluate(() => { SYNC.lastFull = Date.now() - 10 * 60000 - 1000; });
      S.log.length = 0; await tick(A.page);
      rec('6 10 minutes since the last full load: full load even though nothing changed', fullGets(S) === 1, S.log.join(', '));
      S.log.length = 0; await tick(A.page);
      rec('6 the clock restarts after it', fullGets(S) === 0 && verGets(S) === 1, S.log.join(', '));
      // the version moved without the content changing (another screen saved the same plan): treated as changed
      S.row.version++; S.log.length = 0; await tick(A.page);
      const v = await A.page.evaluate(() => VER);
      rec('6 version moved on: full load and the screen takes the new number', fullGets(S) === 1 && v === S.row.version, 'VER ' + v);
      await A.close();
    }
    // 7. Settings → Sync speed line
    {
      const S = makeServer(base()); const A = await pc(browser, S);
      await A.page.evaluate(async () => { DB.orders[0].notes = 'x'; await saveDB(); });
      await tick(A.page); await tick(A.page);
      const t = await A.page.evaluate(() => { tab = 's'; render(); const e = document.getElementById('set-sync'); return e ? e.innerText : ''; });
      rec('7 Settings shows "Sync speed"', /Sync speed/.test(t), t.slice(0, 60));
      rec('7 last save with size and seconds', /Last save:\s*[\d.]+ KB in [\d.]+ s \(at \d\d:\d\d\)/.test(t), (t.match(/Last save:[^\n]*/) || [''])[0]);
      rec('7 last full load with size and seconds', /Last full load:\s*[\d.]+ KB in [\d.]+ s \(at \d\d:\d\d\)/.test(t), (t.match(/Last full load:[^\n]*/) || [''])[0]);
      rec('7 last quick check in seconds', /Last quick check:\s*[\d.]+ s \(at \d\d:\d\d\)/.test(t), (t.match(/Last quick check:[^\n]*/) || [''])[0]);
      rec('7 skipped-today count (2)', /Today:\s*2 refreshes were skipped because nothing had changed/.test(t), (t.match(/Today:[^\n]*/) || [''])[0]);
      const t2 = await (async () => { const S2 = makeServer(base()); const P = await pc(browser, S2); const x = await P.page.evaluate(() => { SYNC.save = null; SYNC.check = null; tab = 's'; render(); return document.getElementById('set-sync').innerText; }); await P.close(); return x; })();
      rec('7 a fresh screen says "none yet" instead of blanks', /Last save:\s*none yet on this screen/.test(t2) && /Last quick check:\s*none yet/.test(t2), (t2.match(/Last save:[^\n]*/) || [''])[0]);
      rec('7 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 200));
      await A.close();
    }
  } catch (e) { rec('test ran without crashing', false, e && e.stack ? e.stack.slice(0, 300) : String(e)); }
  await browser.close();
  const f = res.filter(x => !x).length;
  console.log((f ? 'FAILED ' : 'ALL PASSED ') + (res.length - f) + '/' + res.length);
  process.exit(f ? 1 : 0);
})();
