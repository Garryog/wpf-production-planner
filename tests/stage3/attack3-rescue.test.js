// ATTACK 3 — rescue by mig_sig fingerprint (83bbec1): lists migrated twice, old-tab clocks fast AND slow, a rescued tick
// unticked and then a fresh device, an untick in V2 of a line the migration copied as ticked.
// Old tabs are emulated by writing their save straight into the fake planner record (what an old-code tab's save does).
// Fake Supabase only (srv3.js). Run: node tests/stage3/attack3-rescue.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const L = F.line;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' };
const BACK = { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' };
const TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'MFC White', note: '' };
const HINGE = { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum hinge', note: '' };
const iso = ms => new Date(Date.parse(F.NOW) + ms).toISOString();
function v1Row(listRow) {
  return { id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 3, fit: 1, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, BACK, TOP, HINGE] } } }, listRow: listRow || {}, listHold: {}, listDone: {}, holdLog: [] } };
}
const idle = p => p.evaluate(async () => { for (let i = 0; i < 60 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const key = (r) => [r.k, r.item, r.L == null ? '' : r.L, r.W == null ? '' : r.W, r.mat, r.note].join('|').toLowerCase();
// old-code tab saves a tick (its own clock): straight into the stored record, version bumped
function oldTabTick(S, row, at, by) { const s = S.row.settings; s.listRow = s.listRow || {}; s.listRow.L1 = Object.assign({}, s.listRow.L1, { [row]: { m: 'saw', at, by } }); S.row.version++; }
async function vkey(p, item) { return p.evaluate(item => { const l = DB.lists.find(z => z.id === 'L1') || {}; const r = lsOldRows(l).find(z => z.item === item); return r ? v1Key(r) : null; }, item); }
async function untick(p, id) { await p.evaluate(async id => { await lsPoll(); lqLine(id, 'todo'); await lqSend(); }, id); }
async function fresh(browser, S, role) { const t = await F.dev(browser, S, role || 'saw'); await t.page.evaluate(async () => { await new Promise(r => setTimeout(r, 400)); await loadDB(); lsRescue(); await new Promise(r => setTimeout(r, 400)); await lqSend(); }); await F.sleep(300); await t.page.evaluate(async () => { lsRescue(); await lqSend(); }); return t; }
(async () => {
  const browser = await H.chromium.launch();
  // ---------- K1: migrated twice. Unticks done in V2 after the SECOND migration must not be undone by any device's rescue
  {
    const S = F.makeServer(v1Row());
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await off.page.evaluate(async () => { await lsMigrate('Garry'); }); await idle(off.page);
    const saw = await F.dev(browser, S, 'saw');
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.send(saw.page); // Side cut in V2
    const back = await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } }); await idle(off.page);
    // in V1: Back ticked by the office
    await off.page.evaluate(async () => { await loadDB(); const l = DB.lists.find(z => z.id === 'L1'); const r = lsOldRows(l).find(z => z.item === 'Back'); setRowTick(l, v1Key(r), 'saw', 'Garry', true); clearTimeout(saveT); await saveDB(); });
    const re = await off.page.evaluate(async () => { await loadDB(); try { const r = await lsMigrate('Garry'); return { ok: r.ok }; } catch (e) { return { err: e.message }; } }); await idle(off.page);
    rec('K1 second migration copies Side (V2 tick) and Back (V1 tick)', !back.err && re.ok && L(S, 'L1:1').status === 'cut' && L(S, 'L1:2').status === 'cut', 'back=' + JSON.stringify(back) + ' re=' + JSON.stringify(re) + ' ' + ['L1:1', 'L1:2'].map(i => L(S, i).status + '/' + L(S, i).mig_sig));
    const saw2 = await F.dev(browser, S, 'saw');
    await untick(saw2.page, 'L1:1'); await untick(saw2.page, 'L1:2');
    const t1 = [L(S, 'L1:1').status, L(S, 'L1:2').status].join();
    const f = await fresh(browser, S); await saw.page.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); lsRescue(); await lqSend(); });
    rec('K1b after unticking Side + Back in V2, fresh and old devices do not tick them back (fingerprints from the 2nd migration)',
      t1 === 'todo,todo' && L(S, 'L1:1').status === 'todo' && L(S, 'L1:2').status === 'todo', 'after untick=' + t1 + ' now=' + L(S, 'L1:1').status + ',' + L(S, 'L1:2').status);
    // old tab with a clock 3 DAYS slow ticks Top after the second migration
    const kTop = await vkey(off.page, 'Top');
    oldTabTick(S, kTop, iso(-3 * 86400000), 'OldTabSlow');
    const f2 = await fresh(browser, S);
    rec('K2 old tab with a clock 3 days slow ticks Top after the 2nd migration: rescued into the tables', L(S, 'L1:3').status === 'cut', 'Top=' + L(S, 'L1:3').status + ' mig_sig=' + L(S, 'L1:3').mig_sig);
    // the saw unticks the rescued Top (mis-tap); a brand-new device (empty wpfRescued) must not tick it back
    await untick(saw2.page, 'L1:3');
    const u3 = L(S, 'L1:3').status;
    const f3 = await fresh(browser, S, 'stores');
    rec('K3 a rescued tick that was then unticked is not re-ticked by a new device (database applies the rescue once)', u3 === 'todo' && L(S, 'L1:3').status === 'todo', 'after untick=' + u3 + ' now=' + L(S, 'L1:3').status);
    for (const t of [off, saw, saw2, f, f2, f3]) await t.close();
  }
  // ---------- K4: old tab clock FAST (2 h ahead) ticked Top before the migration; the saw unticks it in V2
  {
    const kTop = key(TOP);
    const S = F.makeServer(v1Row({ L1: { [kTop]: { m: 'saw', at: iso(2 * 3600000), by: 'FastTab' } } }));
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await off.page.evaluate(async () => { await lsMigrate('Garry'); }); await idle(off.page);
    const copied = L(S, 'L1:3').status;
    const saw = await F.dev(browser, S, 'saw');
    await untick(saw.page, 'L1:3');
    const u = L(S, 'L1:3').status;
    const f = await fresh(browser, S);
    rec('K4 fast-clock tick copied by the migration, unticked in V2: no device ticks it back', copied === 'cut' && u === 'todo' && L(S, 'L1:3').status === 'todo', 'copied=' + copied + ' untick=' + u + ' now=' + L(S, 'L1:3').status);
    // the fast tab then ticks Side AFTER the switch (its clock says the future)
    oldTabTick(S, key(SIDE), iso(3 * 3600000), 'FastTab');
    const f2 = await fresh(browser, S);
    rec('K4b fast-clock tick after the switch is rescued', L(S, 'L1:1').status === 'cut', L(S, 'L1:1').status);
    // a stale old tab re-saves the PRE-migration entry for Top with a different by/at (its 3-way merge resends an older copy)
    oldTabTick(S, kTop, iso(-5 * 86400000), 'StaleTab');
    const f3 = await fresh(browser, S, 'stores');
    rec('K5 (info) an old tab re-writing an OLDER copy of a tick the saw has since unticked: is Top ticked back?', true, 'Top=' + L(S, 'L1:3').status + (L(S, 'L1:3').status === 'cut' ? ' — yes: any difference from the fingerprint counts as new, even an older timestamp' : ''));
    for (const t of [off, saw, f, f2, f3]) await t.close();
  }
  rec('no page errors', true);
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
