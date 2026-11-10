// ATTACK: a tab left open on OLD code (live main, or Stage 2) keeps saving after "Migrate lists".
// Does the switch survive? Do fresh screens stay on v2? Are the old tab's ticks rescued? Fake Supabase only.
// Run: node tests/stage3/attack-oldtab.test.js
const A = require('./atk.js');
const { F, H, D, rec, k } = A;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '1mm ABS' };
const BACK = { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' };
function v1Row() {
  return { id: 'main', version: 1, nid: 5,
    orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 2, fit: 0, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, BACK] } } }, listRow: {}, listHold: {}, listDone: {}, holdLog: [] } };
}
async function run(browser, label, html) {
  if (!html) { rec(label + ': old code available', false, 'git show failed'); return; }
  const S = F.makeServer(v1Row());
  const old = await A.openOld(browser, S, html);
  const nw = await F.open(browser, S, { now: F.NOW, role: 'office' });
  const r = await nw.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok }; });
  rec(label + ': migration ok, switch saved', r.ok && S.row.settings.listStore === 'v2', JSON.stringify(r));
  const at = new Date(Date.now() + 120000).toISOString();
  // the old tab ticks "Back" the old way and saves
  const sv = await old.page.evaluate(async ({ key, at }) => {
    DB.listRow = DB.listRow || {}; DB.listRow.L1 = DB.listRow.L1 || {}; DB.listRow.L1[key] = { m: 'saw', at, by: 'OldTab' };
    if (typeof markDirty === 'function') try { markDirty(); } catch (e) {}
    await saveDB(); await new Promise(r => setTimeout(r, 300)); return { failed: !!DB.saveFailed };
  }, { key: k(BACK), at });
  rec(label + ': after the old tab saves, the planner record still has listStore=v2', S.row.settings.listStore === 'v2', 'listStore now=' + JSON.stringify(S.row.settings.listStore) + ' save=' + JSON.stringify(sv));
  const fresh = await F.open(browser, S, { now: F.NOW, role: 'saw' });
  const fv = await fresh.page.evaluate(async () => { await new Promise(r => setTimeout(r, 300)); return { v2: V2(), n: lists().length }; });
  rec(label + ': a screen opened after the old tab saved is still on the new lists (v2)', fv.v2, JSON.stringify(fv));
  // the already-open v2 tab saves something: does it put the switch back, or follow the record?
  await nw.page.evaluate(async () => { await loadDB(); DB.orders[0].notes = 'x'; await saveDB(); });
  rec(label + ': already-open v2 tab and record agree after its next save', S.row.settings.listStore === (await nw.page.evaluate(() => DB.listStore)), 'record=' + S.row.settings.listStore + ' tab=' + (await nw.page.evaluate(() => DB.listStore)));
  // rescue: if the switch survived, the old tab's tick should reach the tables
  await fresh.page.evaluate(async () => { if (V2()) { lsRescue(); await lqSend(); } });
  const ln = D.find(S.db, 'list_lines', 'L1:2');
  rec(label + ': old tab tick on Back rescued into the tables', ln && ln.status === 'cut', ln && ln.status);
  await old.close(); await nw.close(); await fresh.close();
}
(async () => {
  const browser = await H.chromium.launch();
  await run(browser, 'live main code', A.gitShow('origin/main'));
  await run(browser, 'Stage 2 code', A.gitShow('origin/feature/stage2-imports'));
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
