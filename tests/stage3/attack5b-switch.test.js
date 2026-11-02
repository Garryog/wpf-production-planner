// ATTACK 5 — the round-4 'Finish switch back' / backup fixes, attacked: Finish interrupted twice, a lost reply on the
// 'v1' save while a saw folds its held ticks, "Stay on the new lists" pressed on a stale Settings page after another PC
// finished, two PCs pressing Finish at once, and pasting back a daily backup after a switch back. Fake Supabase only.
// Run: node tests/stage3/attack5-switch.test.js
const A = require('./atk.js');
const { F, H, rec, k } = A;
const L = F.line;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' };
const BACK = { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' };
const TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'MFC White', note: '' };
const HINGE = { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum hinge', note: '' };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
function v1Row() {
  return { id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 3, fit: 1, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, BACK, TOP, HINGE] } } }, listRow: {}, listHold: {}, listDone: {}, holdLog: [] } };
}
const idle = p => p.evaluate(async () => { for (let i = 0; i < 60 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const oldNames = S => Object.keys((S.row.settings.listRow || {}).L1 || {}).map(x => x.split('|')[1]).sort();
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const pin = p => p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; });
const fin = p => p.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
async function migrated(browser) {
  const S = F.makeServer(v1Row());
  const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
  const r = await off.page.evaluate(async () => (await lsMigrate('Garry')).ok);
  if (!r) throw new Error('migration failed');
  await idle(off.page);
  return { S, off };
}
// the office PC "dies" the moment it sends a planner save carrying listStore === want (the save never arrives)
async function dieOn(browser, S, off, want, run) {
  let hit = false;
  await off.page.route(PP, async route => {
    const b = route.request().method() === 'PATCH' ? JSON.parse(route.request().postData() || '{}') : null;
    if (b && b.settings && b.settings.listStore === want) { hit = true; return; } // never answered, never lands
    return route.fallback();
  });
  await pin(off.page);
  off.page.evaluate(run).catch(() => {});
  for (let i = 0; i < 120 && !hit; i++) await F.sleep(50);
  await F.sleep(200); await off.close();
  return hit;
}
// leave the record on 'switching' (as attack4-states): the 'switching' save lands, then the PC dies (new tables never answer it)
async function strand(browser, S, off) {
  await off.page.route(PP, async route => {
    const b = route.request().method() === 'PATCH' ? JSON.parse(route.request().postData() || '{}') : null;
    if (b && b.settings && b.settings.listStore === 'switching') S.hold3 = new Promise(() => {});
    return route.fallback();
  });
  await pin(off.page);
  off.page.evaluate(() => lsSwitchBack('Garry')).catch(() => {});
  for (let i = 0; i < 100 && !S.hold3; i++) await F.sleep(50);
  await F.sleep(300); await off.close(); S.hold3 = null;
  if (S.row.settings.listStore !== 'switching') throw new Error('strand failed: ' + S.row.settings.listStore);
}
// the saw catches up: lqSend (folds when 'v1', sends when 'v2'), twice
const sawCatchUp = p => p.evaluate(async () => { LQ.swTries = 0; await lqSend(); await new Promise(r => setTimeout(r, 300)); await lqSend(); });
// where is the Side tick now, in whichever store the record ends on?
const sideState = S => S.row.settings.listStore === 'v2' || S.row.settings.listStore === 'switching' ? 'tables:' + L(S, 'L1:1').status : 'old:' + (oldNames(S).includes('side') ? 'cut' : 'todo');
(async () => {
  const browser = await H.chromium.launch();
  // ===== F1: Finish switch back interrupted TWICE (PC dies while saving 'v1'), then a third Finish =====
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await strand(browser, S, off);
    const taps = [await F.tapRow(saw.page, 'data-rt', 'L1:1'), await F.tapRow(saw.page, 'data-rt', 'L1:3')]; await saw.page.evaluate(async () => { await lqSend(); });
    const heldQ = await F.qlen(saw.page); info('F1 taps', JSON.stringify(taps) + ' tables=' + ['L1:1', 'L1:3'].map(i => L(S, i).status) + ' ls=' + S.row.settings.listStore);
    const o2 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const d2 = await dieOn(browser, S, o2, 'v1', () => lsSwitchBack('Garry'));
    const after2 = S.row.settings.listStore;
    const o3 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const d3 = await dieOn(browser, S, o3, 'v1', () => lsSwitchBack('Garry'));
    const after3 = S.row.settings.listStore;
    rec('F1a two interrupted Finishes leave the record on "switching" (not v1, not half v2) and the saw still holds its 2 ticks',
      d2 && d3 && after2 === 'switching' && after3 === 'switching' && heldQ === 2 && (await F.qlen(saw.page)) === 2, JSON.stringify({ d2, d3, after2, after3, heldQ }));
    const o4 = await F.open(browser, S, { now: F.NOW, role: 'office' }); await pin(o4.page);
    const r4 = await fin(o4.page); await idle(o4.page);
    await sawCatchUp(saw.page); await idle(saw.page);
    rec('F1b third Finish completes; both held saw ticks land in the old lists; saw queue empty',
      !r4.err && S.row.settings.listStore === 'v1' && oldNames(S).includes('side') && oldNames(S).includes('top') && (await F.qlen(saw.page)) === 0,
      JSON.stringify(r4) + ' ls=' + S.row.settings.listStore + ' old=' + oldNames(S) + ' q=' + (await F.qlen(saw.page)));
    rec('F1c no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await o4.close();
  }
  // ===== F2: Finish — the 'v1' save LANDS but its reply is lost; in that gap the saw folds its held tick into the old lists =====
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await strand(browser, S, off);
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await saw.page.evaluate(async () => { await lqSend(); });
    const o2 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    let gate = null;
    await o2.page.route(PP, async route => {
      const req = route.request();
      if (req.method() === 'PATCH') { const b = JSON.parse(req.postData() || '{}');
        if (b.settings && b.settings.listStore === 'v1' && !S.lost) { S.lost = 1; Object.assign(S.row, b); S.row.version = (+S.row.version || 1) + 1;
          gate = sawCatchUp(saw.page).then(() => idle(saw.page)); await gate; return route.abort('connectionreset'); } }
      return route.fallback();
    });
    await pin(o2.page);
    const r = await fin(o2.page); await idle(o2.page);
    await o2.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); await idle(o2.page);
    const mid = S.row.settings.listStore;
    // every screen settles: saw and a fresh office reload, rescue, send
    await saw.page.evaluate(async () => { await loadDB(); if (V2()) { lsReset(); await lsLoad(); lsRescue(); await new Promise(r => setTimeout(r, 400)); } await lqSend(); });
    const o3 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await o3.page.evaluate(async () => { if (V2()) { lsReset(); await lsLoad(); lsRescue(); await new Promise(r => setTimeout(r, 400)); await lqSend(); } });
    await idle(saw.page); await idle(o3.page);
    rec('F2 lost reply on the Finish "v1" save while the saw folded its held Side tick: the tick is still there in the store the floor ends on',
      /cut$/.test(sideState(S)), 'finish=' + JSON.stringify(r) + ' record after=' + mid + ' → ' + S.row.settings.listStore + ' Side=' + sideState(S) + ' (tables L1:1=' + L(S, 'L1:1').status + ', old=' + oldNames(S) + ')');
    rec('F2b the office is not told "nothing changed / stays on new lists" while the record actually says v1 (or the other way round)',
      !(r.err && S.row.settings.listStore === 'v1') && !(!r.err && S.row.settings.listStore !== 'v1'), 'finish=' + JSON.stringify(r) + ' record=' + S.row.settings.listStore);
    await saw.close(); await o3.close();
  }
  // ===== F3: Settings open on two PCs during 'switching'. PC A presses Finish (done, saw folds its tick). PC B, still showing
  // the old panel, then presses "Stay on the new lists" =====
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await strand(browser, S, off);
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await saw.page.evaluate(async () => { await lqSend(); });
    const pa = await F.open(browser, S, { now: F.NOW, role: 'office' }), pb = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const pbLs0 = await pb.page.evaluate(() => DB.listStore);
    await pin(pa.page); const ra = await fin(pa.page); await idle(pa.page);
    await sawCatchUp(saw.page); await idle(saw.page);
    const afterA = S.row.settings.listStore, oldA = oldNames(S);
    // a tick made on the old lists AFTER the switch back (Back)
    await saw.page.evaluate(async key => { await loadDB(); const l = DB.lists.find(z => z.id === 'L1'); setRowTick(l, key, 'saw', 'Aine', true); clearTimeout(saveT); await saveDB(); }, k(BACK));
    await idle(saw.page);
    await pin(pb.page);
    const pbLs = await pb.page.evaluate(() => { const ls0 = DB.listStore; document.body.insertAdjacentHTML('beforeend', '<div id="tst">' + lsPanelHTML() + '</div>'); lsBindPanel(); const b = document.getElementById('ls-stay'); if (b) b.click(); return ls0 + (b ? ':clicked' : ':no-stay-button'); });
    await F.sleep(800); await idle(pb.page);
    const end = S.row.settings.listStore;
    const sawV = await saw.page.evaluate(async () => { await loadDB(); if (V2()) { lsReset(); await lsLoad(); lsRescue(); await new Promise(r => setTimeout(r, 400)); await lqSend(); lsReset(); await lsLoad(); } render(); return { v2: V2(), txt: document.body.innerText.slice(0, 3000) }; });
    const tables = ['L1:1', 'L1:2'].map(i => L(S, i).status);
    rec('F3 "Stay on the new lists" pressed on a stale Settings page AFTER another PC finished the switch back does not flip the floor onto tables missing the old-list ticks',
      end === 'v1' || (tables[0] === 'cut' && tables[1] === 'cut'),
      JSON.stringify({ pbLs0, pbLs, ra, afterA, oldA, end, tables, sawV2: sawV.v2 }) + ' (lsBindPanel ls-stay: sets DB.listStore="v2" and saves without re-reading the record)');
    await saw.close(); await pa.close(); await pb.close();
  }
  // ===== F4: two PCs press Finish at the same moment =====
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await strand(browser, S, off);
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await saw.page.evaluate(async () => { await lqSend(); });
    const pa = await F.open(browser, S, { now: F.NOW, role: 'office' }), pb = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await pin(pa.page); await pin(pb.page);
    const [ra, rb] = await Promise.all([fin(pa.page), fin(pb.page)]); await idle(pa.page); await idle(pb.page);
    await sawCatchUp(saw.page); await idle(saw.page);
    await Promise.all([idle(pa.page), idle(pb.page)]);
    await F.sleep(300);
    rec('F4 two PCs Finish at once: record v1, saw Side tick in the old lists, no "could not" errors',
      S.row.settings.listStore === 'v1' && oldNames(S).includes('side') && !ra.err && !rb.err, JSON.stringify({ ra, rb, ls: S.row.settings.listStore, old: oldNames(S) }));
    rec('F4b no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await pa.close(); await pb.close();
  }
  // ===== B5: after a switch back, the daily backup taken while the lists were on v2 is pasted back =====
  {
    const { S, off } = await migrated(browser);
    // the daily backup on a v2 day
    const bak = await off.page.evaluate(async () => { await loadDB(); return fullSettings(); });
    await pin(off.page); const r = await fin(off.page); await idle(off.page);
    const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    await saw.page.evaluate(async key => { await loadDB(); const l = DB.lists.find(z => z.id === 'L1'); setRowTick(l, key, 'saw', 'Aine', true); clearTimeout(saveT); await saveDB(); }, k(TOP));
    await idle(saw.page);
    const before = S.row.settings.listStore;
    // "restore": the backup's settings written back to the planner record (same request a SQL/table-editor paste makes)
    const st = await off.page.evaluate(async s => { const r = await fetch(SUPA_URL + '/production_planner?id=eq.main', { method: 'PATCH', headers: { ...SUPA_WHDR, 'Prefer': 'return=representation' }, body: JSON.stringify({ settings: s }) }); return r.status; }, bak);
    const v = await saw.page.evaluate(async () => { await loadDB(); lsReset(); if (V2()) await lsLoad(); return { v2: V2(), ls: DB.listStore }; });
    rec('B5 (Low) pasting back a daily backup from the v2 days after a switch back does not silently put the floor back on the tables (Top cut since the switch back would vanish)',
      !v.v2, JSON.stringify({ r, before, patch: st, after: S.row.settings.listStore, saw: v, topInTables: L(S, 'L1:3').status }) + ' (keep-switch trigger only guards o.listStore="v2"; daily backupNow keeps listStore)');
    await saw.close(); await off.close();
  }
  // ===== P: the Settings panel text while 'switching' =====
  {
    const { S, off } = await migrated(browser);
    await strand(browser, S, off);
    const o2 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const t = await o2.page.evaluate(() => lsPanelHTML().replace(/<[^>]+>/g, ' '));
    rec('P1 (Low) the "did not finish" panel does not tell the office the floor can\'t tick (since round 4 the floor CAN tick: ticks are held on each device)', !/can't tick|can\\'t tick/.test(t), t.replace(/\s+/g, ' ').slice(0, 220));
    await o2.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
