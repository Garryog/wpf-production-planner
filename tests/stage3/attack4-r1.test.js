// ATTACK 4 — R1 / R1b re-verified with a timeline: a saw tick made while Switch back is rebuilding, then a re-migration.
// Where is Top at each moment: saw queue, old lists (planner record), tables — right after the re-migration, 3 s later,
// and after another screen opens (its load-time rescue). Variations: re-migrate at once / after the saw folded / saw
// offline across the re-migration. Fake Supabase only. Run: node tests/stage3/attack4-r1.test.js [rounds]
const A = require('./atk.js');
const { F, H, rec } = A;
const L = F.line;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '' };
const BACK = { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' };
const TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'MFC White', note: '' };
function v1Row() {
  return { id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 3, fit: 0, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [SIDE, BACK, TOP] } } }, listRow: {}, listHold: {}, listDone: {}, holdLog: [] } };
}
const idle = p => p.evaluate(async () => { for (let i = 0; i < 60 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const SUPA = u => /supabase\.co/.test(String(u));
const oldHas = (S, n) => Object.keys((S.row.settings.listRow || {}).L1 || {}).some(x => x.split('|')[1] === n);
async function round(browser, mode, i) {
  const S = F.makeServer(v1Row());
  const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
  await off.page.evaluate(async () => (await lsMigrate('Garry')).ok); await idle(off.page);
  const saw = await F.dev(browser, S, 'saw');
  await off.page.exposeFunction('__sawTick', async () => { await F.tapRow(saw.page, 'data-rt', 'L1:3'); await saw.page.evaluate(async () => { await lqSend(); }); });
  await off.page.evaluate(() => { const r0 = lsRescue; let armed = false; window.lsRescue = function () { if (window.__sb) armed = true; return r0.apply(this, arguments); };
    const g0 = lsGetIn; window.lsGetIn = async function (t) { const r = await g0.apply(this, arguments); if (armed && t === 'list_lines') { armed = false; await window.__sawTick(); } return r; }; });
  const back = await off.page.evaluate(async () => { window.__sb = true; try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
  await idle(off.page);
  const t0 = { q: await F.qlen(saw.page), old: oldHas(S, 'top'), ls: S.row.settings.listStore };
  if (mode === 'after-fold') { for (let k = 0; k < 40 && (await F.qlen(saw.page)); k++) await F.sleep(100); await idle(saw.page); }
  if (mode === 'saw-offline') await saw.page.route(SUPA, r => r.abort('internetdisconnected'));
  const t1 = { q: await F.qlen(saw.page), old: oldHas(S, 'top') };
  const re = await off.page.evaluate(async () => { await loadDB(); try { const r = await lsMigrate('Garry'); return { ok: r.ok }; } catch (e) { return { err: e.message }; } });
  await idle(off.page);
  const now = L(S, 'L1:3').status;
  if (mode === 'saw-offline') await saw.page.unroute(SUPA);
  await saw.page.evaluate(async () => { await lqSend(); }).catch(() => {});
  await F.sleep(3000); await idle(saw.page);
  const later = L(S, 'L1:3').status, qLater = await F.qlen(saw.page);
  const fresh = await F.dev(browser, S, 'stores'); await F.sleep(800); await idle(fresh.page);
  const final = L(S, 'L1:3').status;
  const ok = !back.err && re.ok && final === 'cut';
  rec('R1b/' + mode + ' #' + i + ' Top tick survives switch back + re-migration (eventually in the tables)', ok,
    JSON.stringify({ back, t0, beforeRemig: t1, re, atOnce: now, after3s: later, qLater, afterFreshScreen: final }));
  rec('R1b/' + mode + ' #' + i + ' Top in the tables straight after the re-migration returns (what Garry sees at once)', now === 'cut' || later === 'cut', 'at once=' + now + ' after 3 s=' + later);
  await saw.close(); await fresh.close(); await off.close();
}
(async () => {
  const n = +process.argv[2] || 3;
  const browser = await H.chromium.launch();
  for (let i = 1; i <= n; i++) for (const m of ['at-once', 'after-fold', 'saw-offline']) await round(browser, m, i);
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
