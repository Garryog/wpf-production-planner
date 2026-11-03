// ATTACK 3 — the switch-back refusal path (lists_switch_on + lqSwitchNow / lqSwitchedOff): ticks that land in the tables
// while the switch back is rebuilding the old lists, the planner read failing just after the switch read, the switch read
// itself failing, 3 offline devices reconnecting at the same moment, and a device that only comes back after a re-migration.
// Fake Supabase only (srv3.js). Run: node tests/stage3/attack3-switch.test.js
const A = require('./atk.js');
const { F, S3, H, D, rec } = A;
const L = F.line;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' };
const BACK = { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' };
const TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'MFC White', note: '' };
const HINGE = { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum hinge', note: '' };
function v1Row() {
  return { id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 3, fit: 1, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, BACK, TOP, HINGE] } } }, listRow: {}, listHold: {}, listDone: {}, holdLog: [] } };
}
const idle = p => p.evaluate(async () => { for (let i = 0; i < 60 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const oldNames = S => Object.keys((S.row.settings.listRow || {}).L1 || {}).map(k => k.split('|')[1]);
async function migrated(browser) {
  const S = F.makeServer(v1Row());
  const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
  const r = await off.page.evaluate(async () => { const r = await lsMigrate('Garry'); return r.ok; });
  if (!r) throw new Error('migration failed');
  await idle(off.page);
  return { S, off };
}
const SWR = u => /production_planner.*select=ls/.test(String(u)), FULLR = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u)), SUPA = u => /supabase\.co/.test(String(u));
const sw = p => p.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
(async () => {
  const browser = await H.chromium.launch();
  // ---------- R1: a saw tick that lands WHILE the switch back is reading the tables (switch still 'v2', so the database accepts it)
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await saw.page.evaluate(() => localStorage.setItem('wpfOpName', 'Aine'));
    // hook: as soon as the switch back has read the lines (after its own rescue + send), the saw ticks Top and it is sent
    await off.page.exposeFunction('__sawTick', async () => { await F.tapRow(saw.page, 'data-rt', 'L1:3'); await saw.page.evaluate(async () => { await lqSend(); }); });
    await off.page.evaluate(() => { const r0 = lsRescue; let armed = false; window.lsRescue = function () { if (window.__sb) armed = true; return r0.apply(this, arguments); };
      const g0 = lsGetIn; window.lsGetIn = async function (t) { const r = await g0.apply(this, arguments); if (armed && t === 'list_lines') { armed = false; await window.__sawTick(); } return r; }; });
    const back = await off.page.evaluate(async () => { window.__sb = true; try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    await idle(off.page);
    const tbl = L(S, 'L1:3').status, names = oldNames(S), q = await saw.page.evaluate(() => LQ.q.length);
    rec('R1 a tick sent while Switch back is rebuilding (after it read the lines, before it saved v1) is not lost: it is in the old lists or still queued',
      !back.err && (names.includes('top') || q > 0), 'switchback=' + JSON.stringify(back) + ' Top in tables=' + tbl + ' Top in old lists=' + names.includes('top') + ' saw queue=' + q + ' (lsSwitchBack: reads lines, then saves v1 — RPCs are still accepted in between)');
    // R1 leaves the tick in the saw's queue; the app retries by itself (lqKick, at most ~10 s). A re-migration a few
    // seconds later — the realistic order — must find it in the old lists. Wait (up to 15 s) for the saw's OWN retry,
    // no help from the test, then re-migrate. (The other order — re-migrating before the retry — is attack6 W4.)
    let drained = false;
    for (let i = 0; i < 150 && !drained; i++) { await F.sleep(100); drained = (await saw.page.evaluate(() => LQ.q.length + JSON.parse(localStorage.getItem('wpfLineQ') || '[]').length)) === 0; }
    const inOld = oldNames(S).includes('top');
    rec('R1a within 15 s the saw\'s own retry puts the held Top tick into the old lists and empties its queue', drained && inOld, 'queue empty=' + drained + ' Top in old lists=' + inOld);
    // and what a re-migration later does to it
    // R1b (rewritten 3 Nov, Tester): no fixed waits — wait until the saw's save has really finished (nothing saving, no
    // save timer, no fold running, nothing unconfirmed) and the database has Top, then until the office has no save of
    // its own in flight, then re-migrate and wait for the migration to finish.
    let sawDone = false;
    for (let i = 0; i < 300 && !sawDone; i++) { sawDone = await saw.page.evaluate(() => !SAVING && !saveT && !LQ.folding && !UNSURE.length && !DB.saveFailed) && oldNames(S).includes('top'); if (!sawDone) await F.sleep(100); }
    await idle(off.page);
    const re = await off.page.evaluate(async () => { for (let i = 0; i < 300 && (SAVING || saveT); i++) await new Promise(r => setTimeout(r, 100)); await loadDB(); try { const r = await lsMigrate('Garry'); return { ok: r.ok }; } catch (e) { return { err: e.message }; } });
    await idle(off.page);
    for (let i = 0; i < 100 && L(S, 'L1:3').status !== 'cut'; i++) await F.sleep(100);
    rec('R1b after a later re-migration the tick is still there (re-migration copies the old lists over the tables)', L(S, 'L1:3').status === 'cut', 'saw save finished=' + sawDone + ' re-migrate=' + JSON.stringify(re) + ' Top=' + L(S, 'L1:3').status);
    await saw.close(); await off.close();
  }
  // ---------- R2: device reconnects after a switch back; the switch read works but the planner refresh straight after fails
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    S.offline = true;
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.tapRow(saw.page, 'data-rt', 'L1:2');
    await saw.page.evaluate(async () => { await lqSend(); });
    S.offline = false;
    const back = await sw(off.page); await idle(off.page);
    let fullFails = 0;
    await saw.page.route(FULLR, route => { if (route.request().method() === 'GET' && fullFails < 3) { fullFails++; return route.abort('connectionreset'); } return route.fallback(); });
    await saw.page.evaluate(async () => { await lqSend(); });
    await F.sleep(300);
    const st = await saw.page.evaluate(() => ({ v2: V2(), q: LQ.q.length, toast: (document.getElementById('toast') || {}).textContent }));
    await saw.page.unroute(FULLR);
    await saw.page.evaluate(async () => { await loadDB(); await lqSend(); }); await idle(saw.page);
    const names = oldNames(S);
    rec('R2 switch read OK but the planner refresh fails: the 2 queued ticks are not thrown away (folded later or kept queued)',
      !back.err && names.includes('side') && names.includes('back'), 'after failed refresh: ' + JSON.stringify(st) + ' | old ticks now=' + JSON.stringify(names) + ' tables=' + ['L1:1', 'L1:2'].map(id => L(S, id).status) + ' (lqSwitchedOff → lqFoldV1 on the stale frozen copy: lines have no ids there → counted "lost", queue cleared)');
    const wb = S.row.settings.listWBs || {}, rows = Object.values(wb).flatMap(w => Object.values(w.sheets || {}).flat());
    rec('R2b the reconnecting device did not overwrite the rebuilt old lists with its stale frozen copy', rows.length && rows.every(r => r.lid), 'rows=' + rows.length + ' with ids=' + rows.filter(r => r.lid).length);
    await saw.close(); await off.close();
  }
  // ---------- R3: the switch read itself fails (planner record unreachable, new tables reachable)
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await saw.page.route(SWR, route => route.fulfill({ status: 503, body: '{}' }));
    await F.tapRow(saw.page, 'data-rt', 'L1:1');
    await saw.page.evaluate(async () => { await lqSend(); });
    const st = await saw.page.evaluate(() => ({ q: LQ.q.length, err: LQ.err, iv: !!LQ.iv, bar: (document.getElementById('savebar') || document.body).innerText.match(/unsent|not saved|waiting|signal|could not/i) }));
    rec('R3 switch read fails: tick stays queued, error recorded, retry timer running', st.q === 1 && /switch/.test(st.err) && st.iv && L(S, 'L1:1').status === 'todo', JSON.stringify(st));
    await saw.page.unroute(SWR);
    await saw.page.evaluate(async () => { await lqSend(); });
    rec('R3b once the switch read works again the tick goes in', L(S, 'L1:1').status === 'cut' && (await F.qlen(saw.page)) === 0, L(S, 'L1:1').status);
    // the switch read returning an EMPTY answer (e.g. row-level security hides the record) must not be treated as "switched off"
    await saw.page.route(SWR, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await F.tapRow(saw.page, 'data-rt', 'L1:2'); await saw.page.evaluate(async () => { await lqSend(); });
    const e2 = await saw.page.evaluate(() => ({ v2: V2(), q: LQ.q.length }));
    rec('R3c switch read returns [] → still V2, tick kept queued (not folded into the old lists)', e2.v2 && e2.q === 1 && S.row.settings.listStore === 'v2', JSON.stringify(e2));
    // a switch read that returns null for listStore (key missing) while the record really is v2 — PostgREST ->> on missing = null
    await saw.page.unroute(SWR);
    await saw.page.route(SWR, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ls: 'v2' }]) }));
    await saw.page.evaluate(async () => { await lqSend(); });
    rec('R3d real PostgREST reply shape [{ls:"v2"}] is understood', L(S, 'L1:2').status === 'cut', L(S, 'L1:2').status);
    await saw.close(); await off.close();
  }
  // ---------- R4: switch back with 3 offline devices that all reconnect at the SAME moment (parallel sends + folds)
  {
    const { S, off } = await migrated(browser);
    const d = [await F.dev(browser, S, 'saw'), await F.dev(browser, S, 'saw'), await F.dev(browser, S, 'stores')];
    for (const [i, t] of d.entries()) await t.page.evaluate(n => localStorage.setItem('wpfOpName', n), ['Aine', 'Brian', 'Cara'][i]);
    S.offline = true;
    await F.tapRow(d[0].page, 'data-rt', 'L1:1'); await F.tapRow(d[1].page, 'data-rt', 'L1:3'); await F.tapRow(d[2].page, 'data-rt', 'L1:4');
    for (const t of d) await t.page.evaluate(async () => { await lqSend(); });
    S.offline = false;
    const back = await sw(off.page); await idle(off.page);
    await Promise.all(d.map(t => t.page.evaluate(async () => { window.dispatchEvent(new Event('online')); await new Promise(r => setTimeout(r, 50)); await lqSend(); })));
    for (const t of d) await idle(t.page);
    await F.sleep(500); for (const t of d) await idle(t.page);
    const names = oldNames(S), qs = await Promise.all(d.map(t => t.page.evaluate(() => LQ.q.length)));
    rec('R4 3 devices reconnect at the same moment after a switch back: Side, Top and Hinge all in the old lists, queues empty',
      !back.err && ['side', 'top', 'hinge'].every(n => names.includes(n)) && qs.every(n => n === 0), 'old=' + JSON.stringify(names) + ' queues=' + qs + ' store=' + S.row.settings.listStore);
    // the office then unticks Top in the old lists; a 4th device (never online since the switch back) must not re-tick it
    await off.page.evaluate(async () => { await loadDB(); const l = DB.lists.find(z => z.id === 'L1'); const r = lsOldRows(l).find(z => z.item === 'Top'); setRowTick(l, v1Key(r), 'saw', 'Garry', false); clearTimeout(saveT); await saveDB(); });
    rec('R4b office untick of Top in the old lists saved', !oldNames(S).includes('top'), JSON.stringify(oldNames(S)));
    for (const t of d) await t.close(); await off.close();
  }
  // ---------- R5: device offline through switch back AND re-migration; comes back when the switch is v2 again
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    const other = await F.dev(browser, S, 'saw');
    S3.attach; // noop
    // only 'saw' is offline: block its traffic page-side
    await saw.page.route(SUPA, route => route.abort('internetdisconnected'));
    await F.tapRow(saw.page, 'data-rt', 'L1:2'); // Back
    await saw.page.evaluate(async () => { await lqSend(); });
    const back = await sw(off.page); await idle(off.page);
    // in the old lists meanwhile: someone ticks Side
    await off.page.evaluate(async () => { const l = DB.lists.find(z => z.id === 'L1'); const r = lsOldRows(l).find(z => z.item === 'Side'); setRowTick(l, v1Key(r), 'saw', 'Garry', true); clearTimeout(saveT); await saveDB(); });
    const re = await off.page.evaluate(async () => { await loadDB(); try { const r = await lsMigrate('Garry'); return { ok: r.ok }; } catch (e) { return { err: e.message }; } });
    await idle(off.page);
    await saw.page.unroute(SUPA);
    await saw.page.evaluate(async () => { await lqSend(); await new Promise(r => setTimeout(r, 300)); await lqSend(); });
    await idle(saw.page);
    rec('R5 offline through switch back + re-migration: Back reaches the tables, Side (old-lists tick) survives',
      !back.err && !!re.ok && L(S, 'L1:2').status === 'cut' && L(S, 'L1:1').status === 'cut' && S.row.settings.listStore === 'v2',
      're=' + JSON.stringify(re) + ' Side=' + L(S, 'L1:1').status + ' Back=' + L(S, 'L1:2').status + ' store=' + S.row.settings.listStore + ' queue=' + await F.qlen(saw.page));
    // the other device that was online all along: after a refresh it must not show a ghost state, nor re-send anything
    await other.page.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); });
    rec('R5b no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await other.close(); await off.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
