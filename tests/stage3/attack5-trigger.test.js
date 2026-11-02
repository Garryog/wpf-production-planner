// ATTACK 5 — keep-switch trigger (1c426f4): restoring backups of every kind in every switch state, old tabs, stale new-code
// tabs, and Migrate → Switch back → Migrate again (v1 → migrating → v2 must still be allowed). Fake Supabase only.
// Run: node tests/stage3/attack5-trigger.test.js
const A = require('./atk.js');
const { F, H, rec, k } = A;
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
const idle = p => p.evaluate(async () => { for (let i = 0; i < 80 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const pin = p => p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; });
// what a person pasting a backup back does (SQL editor / table editor update of the planner row) — the trigger still runs
const restore = (t, payload) => t.page.evaluate(async p => { const r = await fetch(SUPA_URL + '/production_planner?id=eq.main', { method: 'PATCH', headers: { ...SUPA_HDR, Prefer: 'return=representation' }, body: JSON.stringify({ orders: p.orders, nid: p.nid, settings: p.settings }) }); return r.status; }, payload);
const raw = (t, ls) => t.page.evaluate(async ls => { const s = fullSettings(); s.listStore = ls; const r = await fetch(SUPA_URL + '/production_planner?id=eq.main', { method: 'PATCH', headers: SUPA_HDR, body: JSON.stringify({ settings: s }) }); return r.status; }, ls);
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(v1Row());
  const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
  const m1 = await off.page.evaluate(async () => (await lsMigrate('Garry')).ok); await idle(off.page);
  const pre = S.backups.find(b => /pre-lists-v2/.test(b.reason || ''));
  rec('G0 migrate ok, pre-lists-v2 backup has no switch in it', m1 && S.row.settings.listStore === 'v2' && pre && !('listStore' in pre.payload.settings), 'ls=' + S.row.settings.listStore + ' backup keys has listStore=' + (pre && 'listStore' in pre.payload.settings));
  // the daily / "before X" safety backup taken while on the new lists
  await off.page.evaluate(async () => { await backupNow('daily'); });
  const daily = S.backups[S.backups.length - 1];
  rec('G1 a daily backup taken on the new lists carries listStore=' + JSON.stringify(daily.payload.settings.listStore) + ' (informational)', true);
  // G2: restore pre-lists-v2 and the daily backup while on 'v2' → stays 'v2'
  await restore(off, pre.payload); const g2a = S.row.settings.listStore;
  await restore(off, daily.payload); const g2b = S.row.settings.listStore;
  rec('G2 restoring the pre-lists-v2 or the daily backup while on v2 leaves the switch on v2', g2a === 'v2' && g2b === 'v2', g2a + '/' + g2b);
  // G3: raw saves that try to move v2 anywhere but 'switching' are kept on v2
  const g3 = []; for (const v of ['v1', 'migrating', '', null]) { await raw(off, v); g3.push(JSON.stringify(v) + '→' + S.row.settings.listStore); }
  rec('G3 raw saves of v1 / migrating / "" / null over v2 are refused (kept v2)', g3.every(x => /→v2$/.test(x)), g3.join(' '));
  // a stale new-code tab, loaded on v2 now
  const stale = await F.open(browser, S, { now: F.NOW, role: 'office' });
  // G4: Switch back → v1; then the floor ticks Top the old way
  await off.page.evaluate(async () => { await loadDB(); }); await pin(off.page);
  const sb = await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } }); await idle(off.page);
  rec('G4 switch back → v1', !sb.err && S.row.settings.listStore === 'v1', JSON.stringify(sb) + ' ls=' + S.row.settings.listStore);
  // G5: the stale new-code tab (still believes v2) edits an order note and saves
  await stale.page.evaluate(async () => { DB.orders[0].notes = 'stale tab note'; clearTimeout(saveT); await saveDB(); }); await idle(stale.page);
  rec('G5 a stale new-code tab saving after the switch back does not turn the new lists back on', S.row.settings.listStore === 'v1', 'ls=' + S.row.settings.listStore);
  // G6: restore the DAILY backup (taken on v2) after the switch back — runbook rollback note 3 says a restore can't move the switch
  const before6 = S.row.settings.listStore;
  await restore(off, daily.payload); const g6 = S.row.settings.listStore;
  rec('G6 after Switch back, restoring a daily backup taken while on the new lists must not switch the floor back onto the (now stale) tables',
    g6 === 'v1', 'before=' + before6 + ' after restore=' + g6 + ' (backupNow("daily") stores fullSettings() incl. listStore; keep-switch only guards a stored "v2")');
  // put it back to v1 for the rest (via a raw save, allowed from v2 only via switching — so go through Finish)
  if (S.row.settings.listStore !== 'v1') { S.row.settings.listStore = 'v1'; S.row.settings.listStoreAt = new Date().toISOString(); }
  // G7: the floor ticks Top on the old lists, then Migrate AGAIN (v1 → migrating → v2 must work; tables already hold L1)
  await off.page.evaluate(async () => { await loadDB(); const l = DB.lists.find(z => z.id === 'L1'); const r = lsOldRows(l).find(x => /top/i.test(x.item)); setRowTick(l, v1Key(r), 'saw', 'Aine', true); clearTimeout(saveT); await saveDB(); });
  await idle(off.page);
  const m2 = await off.page.evaluate(async () => { try { const r = await lsMigrate('Garry'); return { ok: r.ok, bad: r.check && r.check.bad }; } catch (e) { return { err: e.message }; } });
  await idle(off.page);
  const live = S.db.t.list_lines.filter(x => x.list_id === 'L1' && x.removed_rev == null);
  const top = live.find(x => x.part === 'Top');
  rec('G7 Migrate again after a switch back: allowed (v1 → v2), no duplicate lines, the Top tick made on the old lists is in the tables',
    m2.ok && S.row.settings.listStore === 'v2' && live.length === 4 && top && top.status === 'cut', JSON.stringify(m2) + ' ls=' + S.row.settings.listStore + ' live=' + live.length + ' Top=' + (top && top.status));
  // G8: an old-code tab (origin/main) saving while v2 and while 'switching'
  const OLD = A.gitShow('origin/main');
  if (OLD && S.row.settings.listStore === 'v2') {
    const old = await A.openOld(browser, S, OLD);
    await old.page.evaluate(async () => { await loadDB(); DB.orders[0].notes = 'old tab'; await saveDB(); await new Promise(r => setTimeout(r, 300)); });
    rec('G8 old-code tab saving on v2: switch kept', S.row.settings.listStore === 'v2', S.row.settings.listStore);
    await old.close();
  }
  rec('G9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  await off.close(); await stale.close();
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
