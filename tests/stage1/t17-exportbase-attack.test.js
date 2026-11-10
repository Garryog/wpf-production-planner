// Tester round 12 (3 Nov 2026): attack the Coder's fix bb2427a — new code puts the Export Changes baseline (exportBase)
// back when an old-code tab (live main) saves settings without it.
//  A  "Mark as applied" on PC-A, then an old tab saves before PC-B refreshes → does PC-B undo the reset?
//  B  old tab saves while a new screen's own save is in flight / its reply is lost
//  C  two new PCs restore at the same time → no endless save loop, version settles
//  D  baseline survives ordinary new-code saves and many refreshes (Garry's meeting-room PC)
//  E  a new-code PC OPENS (or is reloaded) while the row has no baseline (old tab dropped it, nobody restored yet)
// Fake Supabase only. Run: node tests/stage1/t17-exportbase-attack.test.js
const { H, makeServer, open } = require('./srv');
const NOW = '2026-10-19T10:00:00Z';
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: {} });
const oldTabSave = (S, edit) => { const s = JSON.parse(JSON.stringify(S.row.settings)); delete s.exportBase; delete s.saveIds; S.row.settings = s; if (edit) edit(S.row); S.row.version++; };
const chg = p => p.evaluate(() => changes().map(o => o.wo).join());
const settle = async p => { await p.waitForTimeout(1500); await p.waitForFunction(() => !SAVING && !saveT, null, { timeout: 20000 }).catch(() => {}); };
const ebWk = S => JSON.stringify(((S.row.settings || {}).exportBase || {}).wk || null);
const markApplied = p => p.evaluate(async () => { DB.orders.forEach(o => { orig[o.wo] = o.plannedWeek || ''; origStep[o.wo] = o.step || ''; }); await saveDB(); });
// hold the next PATCH from page p until release(); mode 'pass' = then send it, 'lost' = it lands but the reply never comes
function holdPatch(p, S, mode) {
  let rel; const gate = new Promise(r => rel = r); let hit = false;
  const h = async route => {
    if (route.request().method() !== 'PATCH' || !route.request().url().includes('/production_planner') || hit) return route.fallback();
    hit = true; await gate;
    if (mode === 'lost') {
      const url = route.request().url(), body = JSON.parse(route.request().postData() || '{}'); S.patches.push(body);
      const v = url.match(/version=eq\.(\d+)/); if (!v || +v[1] === S.row.version) { const b = S.row.version; Object.assign(S.row, body); S.row.version = b + 1; }
      return route.abort('failed');
    }
    return route.fallback();
  };
  return p.route('**/*', h).then(() => ({ release: () => rel(), wasHit: () => hit }));
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    // A. Mark as applied on PC-A, old tab saves, PC-B (stale baseline) refreshes first
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      rec('A0 both PCs list the change', (await chg(A.page)) === 'WO-1-1' && (await chg(B.page)) === 'WO-1-1');
      await markApplied(A.page); await settle(A.page);
      rec('A1 mark as applied stored', ebWk(S).includes('"WO-1-1":"2026-11-02"'), ebWk(S));
      oldTabSave(S);
      await B.page.evaluate(() => loadDB()); await settle(B.page); // B refreshes first, still holding the pre-reset baseline
      await A.page.evaluate(() => loadDB()); await settle(A.page);
      await B.page.evaluate(() => loadDB()); await settle(B.page);
      const C = await open(browser, S, { now: NOW }); await settle(C.page);
      rec('A2 reset survives (DB baseline = applied)', ebWk(S).includes('"WO-1-1":"2026-11-02"'), ebWk(S));
      rec('A3 PC-A list stays empty', (await chg(A.page)) === '', await chg(A.page));
      rec('A4 PC-B list empty', (await chg(B.page)) === '', await chg(B.page));
      rec('A5 fresh PC list empty', (await chg(C.page)) === '', await chg(C.page));
      for (const t of [A, B, C]) await t.ctx.close();
    }
    // A'. Same but PC-A refreshes first (restores the applied baseline) — B must then pick it up, not fight it
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      await markApplied(A.page); await settle(A.page);
      oldTabSave(S);
      await Promise.all([A.page.evaluate(() => loadDB()), B.page.evaluate(() => loadDB())]); await settle(A.page); await settle(B.page);
      await A.page.evaluate(() => loadDB()); await B.page.evaluate(() => loadDB()); await settle(A.page); await settle(B.page);
      rec("A'1 both refresh together: DB baseline = applied", ebWk(S).includes('"WO-1-1":"2026-11-02"'), ebWk(S));
      rec("A'2 both lists empty", (await chg(A.page)) === '' && (await chg(B.page)) === '', (await chg(A.page)) + ' | ' + (await chg(B.page)));
      for (const t of [A, B]) await t.ctx.close();
    }
    // B1. Old tab saves while PC-A's own save is in flight
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      const hp = await holdPatch(A.page, S, 'pass');
      await A.page.evaluate(() => { DB.orders[1].plannedWeek = '2026-11-09'; saveDB(); });
      await A.page.waitForTimeout(400);
      oldTabSave(S, r => { r.orders[0].notes = 'old tab'; });
      hp.release(); await settle(A.page);
      await A.page.evaluate(() => loadDB()); await settle(A.page);
      rec('B1a baseline back in DB', ebWk(S) === JSON.stringify({ 'WO-1-1': '2026-10-26', 'WO-1-2': '2026-10-26' }), ebWk(S));
      rec('B1b both changes listed', (await chg(A.page)) === 'WO-1-1,WO-1-2', await chg(A.page));
      rec('B1c old-tab edit kept', S.row.orders[0].notes === 'old tab');
      await A.ctx.close();
    }
    // B2. PC-A's save lands but the reply is lost, then the old tab saves over it before A checks
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      const hp = await holdPatch(A.page, S, 'lost');
      await A.page.evaluate(() => { DB.orders[1].plannedWeek = '2026-11-09'; saveDB(); });
      await A.page.waitForTimeout(400);
      // the save lands, then the old tab (which loaded before it) overwrites the row, before the reply would arrive
      const snapRow = JSON.parse(JSON.stringify(S.row));
      hp.release(); await A.page.waitForTimeout(30);
      S.row.orders = snapRow.orders; oldTabSave(S, r => { r.orders[0].notes = 'old tab'; });
      await settle(A.page); await A.page.waitForTimeout(6000); await settle(A.page);
      await A.page.evaluate(() => loadDB()); await settle(A.page);
      const eb = ((S.row.settings || {}).exportBase || {}).wk || {};
      rec('B2a baseline back in DB', eb['WO-1-1'] === '2026-10-26' && eb['WO-1-2'] === '2026-10-26', ebWk(S));
      rec('B2b PC-A lists both changes', (await chg(A.page)) === 'WO-1-1,WO-1-2', await chg(A.page));
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      rec('B2c fresh PC lists both changes', (await chg(B.page)) === 'WO-1-1,WO-1-2', await chg(B.page));
      await A.ctx.close(); await B.ctx.close();
    }
    // C. Two (and three) new PCs restore the baseline at the same moment — no loop, version settles
    {
      const S = makeServer(base());
      const P = [];
      for (let i = 0; i < 3; i++) { P.push(await open(browser, S, { now: NOW, role: i === 2 ? 'saw' : undefined })); await settle(P[i].page); }
      await P[0].page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      for (const t of P) { await t.page.evaluate(() => loadDB()); await settle(t.page); }
      oldTabSave(S);
      const v0 = S.row.version, n0 = S.patches.length;
      await Promise.all(P.map(t => t.page.evaluate(() => loadDB()))); for (const t of P) await settle(t.page);
      for (let r = 0; r < 5; r++) { await Promise.all(P.map(t => t.page.evaluate(() => loadDB()))); for (const t of P) await settle(t.page); }
      const v1 = S.row.version, n1 = S.patches.length;
      for (let r = 0; r < 3; r++) { await Promise.all(P.map(t => t.page.evaluate(() => loadDB()))); for (const t of P) await settle(t.page); }
      rec('C1 baseline restored', ebWk(S).includes('"WO-1-1":"2026-10-26"'), ebWk(S));
      rec('C2 few saves to restore (<=3 landed)', v1 - v0 <= 3, `version ${v0} -> ${v1}, patches sent ${n1 - n0}`);
      rec('C3 then quiet: no more saves on later refreshes', S.row.version === v1 && S.patches.length === n1, `v ${v1}->${S.row.version}, patches ${n1}->${S.patches.length}`);
      const L = await Promise.all(P.map(t => chg(t.page)));
      rec('C4 every screen still lists the change', L.every(x => x === 'WO-1-1'), L.join(' | '));
      for (const t of P) await t.ctx.close();
    }
    // D. Ordinary use: edits from two new PCs, saves, many refreshes, one old-tab save in the middle
    {
      const S = makeServer(base());
      S.row.orders.push(H.order({ wo: 'WO-1-3' }));
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      const ref = ebWk(S);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      for (let r = 0; r < 4; r++) {
        await B.page.evaluate(i => { DB.orders[2].notes = 'n' + i; sched(); }, r);
        await A.page.evaluate(i => { DB.orders[1].qty = (DB.orders[1].qty || 1) + 1; sched(); }, r);
        if (r === 2) oldTabSave(S);
        await Promise.all([A.page.evaluate(() => loadDB()), B.page.evaluate(() => loadDB())]);
        await settle(A.page); await settle(B.page);
      }
      await A.page.evaluate(() => loadDB()); await B.page.evaluate(() => loadDB()); await settle(A.page); await settle(B.page);
      rec('D1 baseline unchanged after ordinary saves/refreshes', ebWk(S) === ref, ref + ' vs ' + ebWk(S));
      rec('D2 both list WO-1-1 only', (await chg(A.page)) === 'WO-1-1' && (await chg(B.page)) === 'WO-1-1', (await chg(A.page)) + ' | ' + (await chg(B.page)));
      // meeting-room PC: page reloaded (fresh tab) after all that
      const M = await open(browser, S, { now: NOW }); await settle(M.page);
      rec('D3 meeting-room PC (fresh open) lists WO-1-1', (await chg(M.page)) === 'WO-1-1', await chg(M.page));
      for (const t of [A, B, M]) await t.ctx.close();
    }
    // E. Old tab drops the baseline while NO new-code screen is open (or before any refreshes); then a new PC opens.
    //    The fresh PC has no copy, so it sees "row and page both without baseline" = one-off migration → builds the
    //    baseline from the jobs as they stand now → the Export Changes list is silently emptied for everyone.
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      await A.ctx.close(); // office PC shut down for the night
      oldTabSave(S); // old-code tab (e.g. phone/meeting-room still on old version) saves
      const M = await open(browser, S, { now: NOW }); await settle(M.page);
      rec('E1 PC opened after an old-tab save still lists WO-1-1', (await chg(M.page)) === 'WO-1-1', JSON.stringify(await chg(M.page)) + ' DB baseline ' + ebWk(S));
      rec('E2 DB baseline not rebuilt from current plan', !ebWk(S).includes('"WO-1-1":"2026-11-02"'), ebWk(S));
      await M.ctx.close();
    }
    // E'. Same, but PC-A is still open and only refreshes AFTER the new PC opened and migrated
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      oldTabSave(S);
      const M = await open(browser, S, { now: NOW }); await settle(M.page);
      await A.page.evaluate(() => loadDB()); await settle(A.page);
      rec("E'1 PC-A (held the real baseline) still lists WO-1-1", (await chg(A.page)) === 'WO-1-1', JSON.stringify(await chg(A.page)) + ' DB ' + ebWk(S));
      rec("E'2 new PC lists WO-1-1", (await chg(M.page)) === 'WO-1-1', JSON.stringify(await chg(M.page)));
      for (const t of [A, M]) await t.ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
