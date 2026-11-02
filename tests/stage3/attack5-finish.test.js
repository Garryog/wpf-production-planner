// ATTACK 5 — 'Finish switch back' (57e1f3a) with ticks held on THREE devices (saw 1, saw 2, stores), in different
// reconnect orders, one device offline right through, conflicting taps on the same line, and all three reconnecting at
// the same moment as / right after the Finish. Fake Supabase only (srv3.js). Run: node tests/stage3/attack5-finish.test.js
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
const ticked = S => Object.keys((S.row.settings.listRow || {}).L1 || {}).map(x => x.split('|')[1]).sort();
const held = S => Object.keys((S.row.settings.listHold || {}).L1 || {}).map(x => x.split('|')[1]).sort();
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const pin = p => p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; });
async function migrated(browser) {
  const S = F.makeServer(v1Row());
  const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
  if (!(await off.page.evaluate(async () => (await lsMigrate('Garry')).ok))) throw new Error('migration failed');
  await idle(off.page);
  return { S, off };
}
async function strandSwitching(S, off) {
  await off.page.route(PP, async route => {
    const b = route.request().method() === 'PATCH' ? JSON.parse(route.request().postData() || '{}') : null;
    if (b && b.settings && b.settings.listStore === 'switching') S.hold3 = new Promise(() => {});
    return route.fallback();
  });
  await pin(off.page);
  off.page.evaluate(() => lsSwitchBack('Garry')).catch(() => {});
  for (let i = 0; i < 100 && !S.hold3; i++) await F.sleep(50);
  await F.sleep(300); await off.close(); S.hold3 = null;
}
// a device with its own signal switch (on top of the fake server's routes)
async function device(browser, S, role, name) {
  const t = await F.dev(browser, S, role); t.off = false;
  await t.page.evaluate(n => localStorage.setItem('wpfOpName', n), name);
  await t.page.route('**/*', r => (t.off && r.request().url().includes('supabase.co')) ? r.abort('internetdisconnected') : r.fallback());
  return t;
}
async function reconnect(t) {
  t.off = false;
  await t.page.evaluate(async () => { LQ.swTries = 0; window.dispatchEvent(new Event('online')); await lqSend(); await new Promise(r => setTimeout(r, 300)); await lqSend(); });
  await idle(t.page);
}
async function finish(browser, S) {
  const o = await F.open(browser, S, { now: F.NOW, role: 'office' }); await pin(o.page);
  const r = await o.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
  await idle(o.page); return { o, r };
}
const qs = ts => Promise.all(ts.map(t => t.page.evaluate(() => JSON.parse(localStorage.getItem('wpfLineQ') || '[]').length)));
(async () => {
  const browser = await H.chromium.launch();
  // ---- F1: three devices tick during 'switching' (with signal), Finish, then reconnect in each of three orders
  for (const order of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
    const { S, off } = await migrated(browser);
    const d = [await device(browser, S, 'saw', 'Aine'), await device(browser, S, 'saw', 'Brian'), await device(browser, S, 'stores', 'Ciara')];
    await strandSwitching(S, off);
    await F.tapRow(d[0].page, 'data-rt', 'L1:1'); await F.tapRow(d[1].page, 'data-rt', 'L1:3'); await F.tapRow(d[2].page, 'data-rt', 'L1:4');
    for (const t of d) await t.page.evaluate(async () => { await lqSend(); });
    for (const t of d) t.off = true; // all three lose signal before the Finish
    const { o, r } = await finish(browser, S);
    for (const i of order) await reconnect(d[i]);
    const q = await qs(d);
    rec('F1/' + order.join('') + ' Finish, then reconnect in order ' + order.join(',') + ': Side, Top, Hinge all in the old lists, every queue empty',
      !r.err && S.row.settings.listStore === 'v1' && JSON.stringify(ticked(S)) === JSON.stringify(['hinge', 'side', 'top']) && q.every(n => n === 0),
      'finish=' + JSON.stringify(r) + ' ls=' + S.row.settings.listStore + ' old ticks=' + ticked(S) + ' queues=' + q);
    rec('F1/' + order.join('') + ' no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    for (const t of [...d, o]) await t.close();
  }
  // ---- F2: saw 1 OFFLINE since v2 (tick never reached the tables), saw 2 ticks during 'switching', stores offline right
  //          through the Finish. Reconnect stores, saw 1, saw 2.
  {
    const { S, off } = await migrated(browser);
    const d = [await device(browser, S, 'saw', 'Aine'), await device(browser, S, 'saw', 'Brian'), await device(browser, S, 'stores', 'Ciara')];
    d[0].off = true; await F.tapRow(d[0].page, 'data-rt', 'L1:1'); await d[0].page.evaluate(async () => { await lqSend(); });
    await strandSwitching(S, off);
    await F.tapRow(d[1].page, 'data-rt', 'L1:3'); await d[1].page.evaluate(async () => { await lqSend(); });
    d[2].off = true; await F.tapRow(d[2].page, 'data-rt', 'L1:4'); await d[2].page.evaluate(async () => { await lqSend(); });
    const { o, r } = await finish(browser, S);
    for (const i of [2, 0, 1]) await reconnect(d[i]);
    const q = await qs(d);
    rec('F2 v2-era offline tick + switching ticks + device offline through Finish: all three land in the old lists', !r.err && JSON.stringify(ticked(S)) === JSON.stringify(['hinge', 'side', 'top']) && q.every(n => n === 0),
      'finish=' + JSON.stringify(r) + ' old ticks=' + ticked(S) + ' queues=' + q + ' table L1:1=' + L(S, 'L1:1').status);
    for (const t of [...d, o]) await t.close();
  }
  // ---- F3: all three reconnect at the SAME moment, while the Finish is still running
  {
    const { S, off } = await migrated(browser);
    const d = [await device(browser, S, 'saw', 'Aine'), await device(browser, S, 'saw', 'Brian'), await device(browser, S, 'stores', 'Ciara')];
    await strandSwitching(S, off);
    for (const t of d) t.off = true;
    await F.tapRow(d[0].page, 'data-rt', 'L1:1'); await F.tapRow(d[1].page, 'data-rt', 'L1:3'); await F.tapRow(d[1].page, 'data-rt', 'L1:2'); await F.tapRow(d[2].page, 'data-rt', 'L1:4');
    const o = await F.open(browser, S, { now: F.NOW, role: 'office' }); await pin(o.page);
    const fin = o.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    await F.sleep(30);
    await Promise.all(d.map(t => reconnect(t)));
    const r = await fin; await idle(o.page);
    for (const t of d) await reconnect(t); // the normal 10 s retry
    const q = await qs(d);
    rec('F3 three devices reconnect together during the Finish: Side, Back, Top, Hinge all kept (no lost tick in the concurrent saves)',
      !r.err && S.row.settings.listStore === 'v1' && JSON.stringify(ticked(S)) === JSON.stringify(['back', 'hinge', 'side', 'top']) && q.every(n => n === 0),
      'finish=' + JSON.stringify(r) + ' old ticks=' + ticked(S) + ' queues=' + q);
    rec('F3 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    for (const t of [...d, o]) await t.close();
  }
  // ---- F4: conflicting taps held on two devices: Aine parks Back (waiting), Brian ticks Back cut — both orders.
  //          Done wins over waiting (the tables' rule) → Back ticked, not held, either way.
  for (const first of [0, 1]) {
    const { S, off } = await migrated(browser);
    const d = [await device(browser, S, 'saw', 'Aine'), await device(browser, S, 'saw', 'Brian')];
    await strandSwitching(S, off);
    const park = 'lqLine waiting';
    // park via the same queue call the N/A button uses
    await d[0].page.evaluate(() => lqLine('L1:2', 'waiting', 'Aine'));
    await F.tapRow(d[1].page, 'data-rt', 'L1:2');
    for (const t of d) { await t.page.evaluate(async () => { await lqSend(); }); t.off = true; }
    const { o, r } = await finish(browser, S);
    await reconnect(d[first]); await reconnect(d[1 - first]);
    rec('F4/' + (first ? 'tick-first' : 'park-first') + ' park + tick of Back held on two devices: Back ends ticked and not held',
      !r.err && ticked(S).includes('back') && !held(S).includes('back'), 'old ticks=' + ticked(S) + ' held=' + held(S) + ' park helper=' + park);
    for (const t of [...d, o]) await t.close();
  }
  // ---- F5: Top was CUT in the tables before the switch back; during 'switching' Brian unticks it (held). After Finish
  //          the untick must apply (todo). Meanwhile Aine re-ticks a DIFFERENT line. And a second Finish press is harmless.
  {
    const { S, off } = await migrated(browser);
    const d = [await device(browser, S, 'saw', 'Aine'), await device(browser, S, 'saw', 'Brian')];
    await F.tapRow(d[1].page, 'data-rt', 'L1:3'); await d[1].page.evaluate(async () => { await lqSend(); });
    const pre = L(S, 'L1:3').status;
    await strandSwitching(S, off);
    await d[1].page.evaluate(async () => { await lsPoll(); render(); });
    await F.tapRow(d[1].page, 'data-rt', 'L1:3'); await F.tapRow(d[0].page, 'data-rt', 'L1:1');
    for (const t of d) { await t.page.evaluate(async () => { await lqSend(); }); t.off = true; }
    const { o, r } = await finish(browser, S);
    const r2 = await o.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    const mid = ticked(S);
    await reconnect(d[1]); await reconnect(d[0]);
    rec('F5 Top cut before the switch back is in the rebuilt lists; Brian\'s held untick then clears it; Aine\'s Side lands',
      pre === 'cut' && mid.includes('top') && !ticked(S).includes('top') && ticked(S).includes('side'), 'pre=' + pre + ' after finish=' + mid + ' final=' + ticked(S));
    rec('F5b a second Finish press after it finished reports done, changes nothing', !r.err && r2 && r2.already === true, JSON.stringify(r2));
    for (const t of [...d, o]) await t.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
