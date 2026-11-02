// ATTACK 4 — the new in-between switch states: 'migrating' left behind by an interrupted Migrate, 'switching' left behind
// by an interrupted Switch back (for "hours"), old-code tabs saving in both states, the Finish switch back / Stay on the
// new lists choices, and a lost reply on the 'switching' / 'migrating' save. Fake Supabase only (srv3.js).
// Run: node tests/stage3/attack4-states.test.js
const A = require('./atk.js');
const { F, H, D, rec, k } = A;
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
const oldNames = S => Object.keys((S.row.settings.listRow || {}).L1 || {}).map(x => x.split('|')[1]);
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const pin = p => p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; });
async function migrated(browser) {
  const S = F.makeServer(v1Row());
  const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
  const r = await off.page.evaluate(async () => (await lsMigrate('Garry')).ok);
  if (!r) throw new Error('migration failed');
  await idle(off.page);
  return { S, off };
}
// an old-code tab ticks a row the old way and saves
async function oldTick(old, row, at) {
  return old.page.evaluate(async ({ key, at }) => {
    await loadDB(); DB.listRow = DB.listRow || {}; DB.listRow.L1 = DB.listRow.L1 || {}; DB.listRow.L1[key] = { m: 'saw', at, by: 'OldTab' };
    await saveDB(); await new Promise(r => setTimeout(r, 200)); return { failed: !!DB.saveFailed };
  }, { key: k(row), at });
}
// leave the record on 'switching': the office's switch back "dies" right after it saved 'switching' (tab closed / PC off)
async function strandSwitching(browser, S, off) {
  await off.page.route(PP, async route => {
    const b = route.request().method() === 'PATCH' ? JSON.parse(route.request().postData() || '{}') : null;
    if (b && b.settings && b.settings.listStore === 'switching') S.hold3 = new Promise(() => {}); // new tables never answer this tab again
    return route.fallback();
  });
  await pin(off.page);
  off.page.evaluate(() => lsSwitchBack('Garry')).catch(() => {});
  for (let i = 0; i < 100 && !S.hold3; i++) await F.sleep(50);
  await F.sleep(300);
  await off.close(); S.hold3 = null;
}
(async () => {
  const browser = await H.chromium.launch();
  const OLD = A.gitShow('origin/main');
  // ================= M: Migrate interrupted after it saved 'migrating' (lines half copied), floor carries on =================
  {
    const S = F.makeServer(v1Row());
    const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    // the migrating PC dies while copying the lines
    S.onPost = (t, b) => { if (t === 'list_lines') { S.hold3 = new Promise(() => {}); } return b; };
    off.page.evaluate(() => lsMigrate('Garry')).catch(() => {});
    for (let i = 0; i < 100 && !S.hold3; i++) await F.sleep(50);
    await F.sleep(300); await off.close(); S.hold3 = null; S.onPost = null;
    rec('M1 interrupted Migrate leaves the record on "migrating" (the case under test)', S.row.settings.listStore === 'migrating', S.row.settings.listStore);
    // saw (already open, loaded at v1) refreshes: still on the old lists, ticks the old way
    const s1 = await saw.page.evaluate(async () => { await loadDB(); render(); return { v2: V2(), ls: DB.listStore, rows: document.querySelectorAll('[data-rt]').length, txt: document.body.innerText.slice(0, 4000) }; });
    rec('M2 saw screen during "migrating": old lists, not the half-copied tables', !s1.v2 && /Side|Top/.test(s1.txt), JSON.stringify({ v2: s1.v2, ls: s1.ls }));
    const tk = await saw.page.evaluate(async key => { const l = DB.lists.find(z => z.id === 'L1'); setRowTick(l, key, 'saw', 'Aine', true); clearTimeout(saveT); await saveDB(); return { failed: !!DB.saveFailed }; }, k(SIDE));
    rec('M3 a saw tick during "migrating" is saved in the planner record and the switch stays "migrating"', !tk.failed && oldNames(S).includes('side') && S.row.settings.listStore === 'migrating', JSON.stringify(tk) + ' old=' + oldNames(S) + ' ls=' + S.row.settings.listStore);
    // a fresh saw opened during "migrating"
    const fresh = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    const fv = await fresh.page.evaluate(async () => ({ v2: V2(), n: lists().length, err: (document.getElementById('savebar') || {}).hidden }));
    rec('M4 a screen opened during "migrating" works on the old lists', !fv.v2 && fv.n === 1, JSON.stringify(fv));
    // an old-code tab also ticks while it is "migrating"
    let ot = null;
    if (OLD) { const old = await A.openOld(browser, S, OLD); ot = await oldTick(old, BACK, new Date().toISOString()); await old.close(); }
    rec('M5 old-code tab saving during "migrating": switch stays "migrating", its tick kept', !OLD || (S.row.settings.listStore === 'migrating' && oldNames(S).includes('back')), JSON.stringify(ot) + ' ls=' + S.row.settings.listStore + ' old=' + oldNames(S));
    // new-code tabs (one loaded before the migration started, one during it) save order edits meanwhile
    await saw.page.evaluate(async () => { await new Promise(r => setTimeout(r, 1500)); DB.orders[0].notes = 'n0'; clearTimeout(saveT); await saveDB(); });
    await fresh.page.evaluate(async () => { await loadDB(); DB.orders[0].notes = 'n1'; clearTimeout(saveT); await saveDB(); });
    rec('M6 new-code tabs saving order edits during "migrating" leave the switch on "migrating"', S.row.settings.listStore === 'migrating', 'record now=' + S.row.settings.listStore);
    // re-run Migrate: asks, then copies Side + Back ticks
    const off2 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const asked = await off2.page.evaluate(async () => { let q = ''; window.confirm = m => { q += m; return true; }; const r = await lsMigrate('Garry'); return { ok: r.ok, q }; });
    await idle(off2.page);
    rec('M7 re-running Migrate after it was left on "migrating" warns, then completes; Side and Back ticks in the tables', asked.ok && /did not finish/.test(asked.q) && L(S, 'L1:1').status === 'cut' && L(S, 'L1:2').status === 'cut' && L(S, 'L1:3').status === 'todo' && S.row.settings.listStore === 'v2',
      JSON.stringify({ ok: asked.ok, asked: /did not finish/.test(asked.q) }) + ' ' + ['L1:1', 'L1:2', 'L1:3'].map(i => L(S, i).status) + ' ls=' + S.row.settings.listStore);
    const live = S.db.t.list_lines.filter(x => x.removed_rev == null).length;
    rec('M8 no duplicate lines after the second run', live === 4, 'live lines=' + live);
    rec('M9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await fresh.close(); await off2.close();
  }
  // ================= W: 'switching' left behind (no old tab): saw ticks queue, floor told, Finish switch back =================
  {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await strandSwitching(browser, S, off);
    rec('W1 interrupted Switch back leaves "switching"', S.row.settings.listStore === 'switching', S.row.settings.listStore);
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.tapRow(saw.page, 'data-rt', 'L1:3');
    await saw.page.evaluate(async () => { await lqSend(); });
    const n0 = S.log.length; await F.sleep(6000); const calls = S.log.slice(n0).filter(x => /production_planner/.test(x)).length;
    const st = await saw.page.evaluate(() => ({ q: LQ.q.length, stored: JSON.parse(localStorage.getItem('wpfLineQ') || '[]').length, err: LQ.err, bar: (document.getElementById('savebar') || {}).hidden === false ? document.getElementById('savebar').textContent : '(hidden)', ticked: [...document.querySelectorAll('[data-rt].on, [data-rt][aria-pressed="true"]')].length }));
    rec('W2 saw ticks during "switching" are queued on the device (and in storage), not in the tables', st.q === 2 && st.stored === 2 && L(S, 'L1:1').status === 'todo' && L(S, 'L1:3').status === 'todo', JSON.stringify(st));
    rec('W3 the floor is told why (bar visible)', st.bar !== '(hidden)', st.bar);
    rec('W3b the floor message says the lists are being switched back, not "waiting for signal" (the saw HAS signal)', !/waiting for signal/i.test(st.bar) || /switch/i.test(st.bar), st.bar);
    rec('W4 retries are not hammering the database (≤ 30 switch checks in 6 s)', calls <= 30, calls + ' planner calls in 6 s');
    // "hours later": fast-forward the retry counter; it keeps trying at the slow rate
    await saw.page.evaluate(() => { LQ.swTries = 500; });
    await saw.page.evaluate(async () => { await lqSend(); });
    const keep = await saw.page.evaluate(() => ({ q: LQ.q.length, t: !!LQ.t, iv: !!LQ.iv }));
    rec('W5 after many retries the ticks are still kept and a retry is still scheduled', keep.q === 2 && (keep.t || keep.iv), JSON.stringify(keep));
    // office opens Settings: warning + Finish / Stay
    const off2 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const html = await off2.page.evaluate(() => lsPanelHTML());
    rec('W6 Settings shows "did not finish" with Finish switch back and Stay on the new lists', /did not finish/.test(html) && /Finish switch back/.test(html) && /Stay on the new lists/.test(html), html.replace(/<[^>]+>/g, ' ').slice(0, 200));
    await pin(off2.page);
    const fin = await off2.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    await idle(off2.page);
    rec('W7 Finish switch back completes → record "v1", lists rebuilt', !fin.err && S.row.settings.listStore === 'v1', JSON.stringify(fin) + ' ls=' + S.row.settings.listStore);
    await saw.page.evaluate(async () => { LQ.swTries = 0; await lqSend(); await new Promise(r => setTimeout(r, 300)); await lqSend(); }); await idle(saw.page);
    const names = oldNames(S), q2 = await F.qlen(saw.page);
    rec('W8 the saw\'s 2 ticks made during "switching" land in the old lists after Finish; queue empty', names.includes('side') && names.includes('top') && q2 === 0, 'old=' + names + ' queue=' + q2);
    rec('W9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await off2.close();
  }
  // ================= X: 'switching' + an old-code tab ticking meanwhile, then Finish switch back =================
  for (const choice of ['finish', 'stay']) {
    const { S, off } = await migrated(browser);
    const saw = await F.dev(browser, S, 'saw');
    await strandSwitching(browser, S, off);
    let ot = { skipped: true };
    if (OLD) { const old = await A.openOld(browser, S, OLD); ot = await oldTick(old, BACK, new Date(Date.now() + 60000).toISOString()); await old.close(); }
    rec('X1/' + choice + ' old-code tab saving during "switching" keeps the switch on "switching"', S.row.settings.listStore === 'switching', JSON.stringify(ot) + ' ls=' + S.row.settings.listStore);
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await saw.page.evaluate(async () => { await lqSend(); });
    const off2 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await pin(off2.page);
    if (choice === 'finish') {
      const fin = await off2.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message, q: LQ.q.length }; } });
      await idle(off2.page);
      rec('X2/finish Finish switch back works even though an old-code tab ticked while it was "switching"', !fin.err && S.row.settings.listStore === 'v1',
        JSON.stringify(fin) + ' ls=' + S.row.settings.listStore + ' (lsSwitchBack: lsRescue() queues the old tab tick, lqSend can\'t send it while "switching", then "still has N unsent" is thrown)');
      // second attempt (what Garry would do after "get a signal and try again")
      const fin2 = await off2.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message, q: LQ.q.length }; } });
      await idle(off2.page);
      rec('X3/finish a second Finish attempt works', !fin2.err && S.row.settings.listStore === 'v1', JSON.stringify(fin2) + ' ls=' + S.row.settings.listStore);
      if (S.row.settings.listStore === 'v1') {
        await saw.page.evaluate(async () => { LQ.swTries = 0; await lqSend(); await new Promise(r => setTimeout(r, 300)); await lqSend(); }); await idle(saw.page);
        await off2.page.evaluate(async () => { await lqSend(); }); await idle(off2.page);
        rec('X4/finish after Finish: saw Side and old-tab Back both in the old lists', oldNames(S).includes('side') && oldNames(S).includes('back'), 'old=' + oldNames(S));
      }
    } else {
      const html = await off2.page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="tst">' + lsPanelHTML() + '</div>'); lsBindPanel(); document.getElementById('ls-stay').click(); return 1; });
      await F.sleep(800); await idle(off2.page);
      rec('X2/stay "Stay on the new lists" puts the record back on "v2"', S.row.settings.listStore === 'v2', 'ls=' + S.row.settings.listStore);
      await saw.page.evaluate(async () => { LQ.swTries = 0; await lqSend(); }); await idle(saw.page);
      await off2.page.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); lsRescue(); await new Promise(r => setTimeout(r, 300)); await lqSend(); }); await idle(off2.page);
      rec('X3/stay saw Side (queued) and old-tab Back (rescued) both reach the tables', L(S, 'L1:1').status === 'cut' && L(S, 'L1:2').status === 'cut', ['L1:1', 'L1:2'].map(i => L(S, i).status).join());
      const sb = await off2.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
      rec('X4/stay a normal Switch back afterwards works', !sb.err && S.row.settings.listStore === 'v1', JSON.stringify(sb));
    }
    rec('X5/' + choice + ' no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await off2.close();
  }
  // ================= XP: no old tab during 'switching' — but an old-tab tick from the v2 period was rescued and later unticked
  // in the tables; Garry presses Finish on a PC that never rescued it (fresh browser) =================
  if (OLD) {
    const { S, off } = await migrated(browser);
    const old = await A.openOld(browser, S, OLD); await oldTick(old, BACK, new Date(Date.now() + 60000).toISOString()); await old.close();
    const saw = await F.dev(browser, S, 'saw');
    await saw.page.evaluate(async () => { await loadDB(); lsRescue(); await new Promise(r => setTimeout(r, 300)); await lqSend(); }); await A.F.sleep(300);
    const resc = L(S, 'L1:2').status;
    // the office unticks Back on the new lists (a mistaken tick)
    await F.tapRow(saw.page, 'data-rt', 'L1:2'); await saw.page.evaluate(async () => { await lqSend(); });
    const unt = L(S, 'L1:2').status;
    await strandSwitching(browser, S, off);
    const off2 = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await pin(off2.page);
    const fin = await off2.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message, q: LQ.q.length, cids: LQ.q.map(e => e.cid.slice(0, 7)) }; } });
    await idle(off2.page);
    rec('XP Finish switch back on a fresh office PC works when an old-tab tick was rescued then unticked weeks ago (no old tab open now)', !fin.err && S.row.settings.listStore === 'v1',
      'Back rescued=' + resc + ' then unticked=' + unt + ' finish=' + JSON.stringify(fin) + ' ls=' + S.row.settings.listStore);
    await saw.close(); await off2.close();
  }
  // ================= Y: the 'switching' save LANDS but its reply is lost — the office is told "nothing changed" =================
  {
    const { S, off } = await migrated(browser);
    await off.page.route(PP, async route => {
      const req = route.request();
      if (req.method() === 'PATCH') { const b = JSON.parse(req.postData() || '{}'); if (b.settings && b.settings.listStore === 'switching' && !S.lost) { S.lost = 1; Object.assign(S.row, b); S.row.version = (+S.row.version || 1) + 1; return route.abort('connectionreset'); } }
      return route.fallback();
    });
    await pin(off.page);
    const r = await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    const after1 = S.row.settings.listStore;
    await off.page.evaluate(async () => { await new Promise(r => setTimeout(r, 200)); clearTimeout(saveT); await saveDB(); }); await idle(off.page); // the 30 s retry, now
    const loc = await off.page.evaluate(() => ({ ls: DB.listStore, v2: V2() }));
    rec('Y1 lost reply on the "switching" save: after the retry the record is NOT left stuck on "switching" while the office was told nothing changed',
      !(r.err && /nothing changed/.test(r.err) && S.row.settings.listStore === 'switching'), 'switchback=' + JSON.stringify(r) + ' record right after=' + after1 + ' after retry=' + S.row.settings.listStore + ' screen=' + JSON.stringify(loc));
    await off.close();
  }
  // ================= Z: the 'migrating' save lands, reply lost =================
  {
    const S = F.makeServer(v1Row());
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await off.page.route(PP, async route => {
      const req = route.request();
      if (req.method() === 'PATCH') { const b = JSON.parse(req.postData() || '{}'); if (b.settings && b.settings.listStore === 'migrating' && !S.lost) { S.lost = 1; Object.assign(S.row, b); S.row.version = (+S.row.version || 1) + 1; return route.abort('connectionreset'); } }
      return route.fallback();
    });
    const r = await off.page.evaluate(async () => { try { return await lsMigrate('Garry'); } catch (e) { return { err: e.message }; } });
    await off.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); await idle(off.page);
    rec('Z1 lost reply on the "migrating" save: told "nothing changed", record ends on v1/migrating (both harmless), new tables untouched',
      !!r.err && ['v1', 'migrating'].includes(S.row.settings.listStore) && S.db.t.list_lines.length === 0, JSON.stringify(r) + ' record=' + S.row.settings.listStore + ' lines=' + S.db.t.list_lines.length);
    // the pre-migration backup: what switch value does it carry? (runbook: "restoring a backup will NOT turn the switch off")
    await off.close();
  }
  // ================= B: what the pre-lists-v2 backup carries (runbook rollback note 3) =================
  {
    const S = F.makeServer(v1Row());
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await off.page.evaluate(async () => (await lsMigrate('Garry')).ok); await idle(off.page);
    const b = S.backups.find(x => /pre-lists-v2/.test(x.reason || '')), ls = b && b.payload && b.payload.settings ? b.payload.settings.listStore : '(none)';
    rec('B1 the pre-lists-v2 backup carries no listStore that would turn the switch off if pasted back (runbook: restoring a backup will NOT turn the switch off)', !ls || ls === '(none)' || ls === 'v2',
      'backup settings.listStore=' + JSON.stringify(ls) + ' — the keep-switch trigger only keeps the stored value when the saved settings have NO listStore key, so restoring this payload sets the record to "' + ls + '" (V2() false: the floor drops back to the pre-migration lists)');
    await off.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
