// ATTACK 6 — round-5 fixes, variations beyond attack5:
//   6abcd00 fold keeps ticks until the save is confirmed   2165095 no backup carries the switch + strict switch moves
//   89b5c5d reload when the last refresh was skipped        c7997bd matKey in the Excel material checks
//   b51076d an edited row never takes another twin's id
// Fake Supabase only (srv3.js). Run: node tests/stage3/attack6-round5.test.js
const A = require('./atk.js');
const { F, S3, H, rec } = A;
const L = F.line;
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const oldKeys = S => Object.keys((S.row.settings.listRow || {}).L1 || {});
const has = (S, part) => oldKeys(S).some(k => k.split('|')[1] === part);
const idle = p => p.evaluate(async () => { for (let i = 0; i < 120 && (SAVING || saveT || LQ.folding); i++) { if (saveT && !SAVING) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const devState = p => p.evaluate(() => ({ v2: V2(), q: lqRead().length, pend: !!localStorage.getItem('wpfPending'), saving: !!SAVING, failed: !!DB.saveFailed, ok: DB.lastLoadOk, err: LQ.err }));
const pin = p => p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; });
async function settle(p) { for (let i = 0; i < 50 && await p.evaluate(() => !!(SAVING || saveT)); i++) await idle(p); }
// v2 from the start (tables seeded), saw holds Side (L1:1) + Top (L1:3) offline, office does a Switch back.
async function held(browser, ids = ['L1:1', 'L1:3']) {
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
  const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
  S.offline = true;
  for (const id of ids) await F.tapRow(saw.page, 'data-rt', id);
  await saw.page.evaluate(async () => { await lqSend(); });
  S.offline = false;
  await settle(off.page); await pin(off.page);
  const back = await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
  await settle(off.page);
  return { S, off, saw, back };
}
async function reopen(saw, S) {
  const page = await saw.ctx.newPage(); await saw.page.close({ runBeforeUnload: false });
  page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await S3.attach({ ...saw, page }, S);
  await page.goto('https://wpf.test/?view=office');
  await page.waitForFunction(() => typeof analyzeImport === 'function'); await F.sleep(1500);
  return page;
}
const asSaw = async page => { await page.evaluate(async () => { localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); await loadDB(); await lqSend(); }); await idle(page); await F.sleep(500); await idle(page); };
(async () => {
  const browser = await H.chromium.launch();

  // ===== 6abcd00 — fold keeps the queue until the save is confirmed =====
  { // Q1: the fold's save runs into a version clash (office saved a note meanwhile). Both the ticks and the note must survive.
    const { S, off, saw, back } = await held(browser);
    let delayed = 0;
    await saw.page.route(PP, async r => { if (r.request().method() === 'PATCH' && !delayed) { delayed = 1; await F.sleep(1500); } return r.fallback(); });
    const go = saw.page.evaluate(async () => { await loadDB(); await lqSend(); });
    await F.sleep(400);
    await off.page.evaluate(async () => { await loadDB(); DB.orders[0].notes = 'office note during fold'; clearTimeout(saveT); await saveDB(); }); await settle(off.page);
    await go; await idle(saw.page); await saw.page.evaluate(async () => { await loadDB(); await lqSend(); }); await idle(saw.page);
    const st = await devState(saw.page);
    rec('Q1 fold save clashes with an office save: Side + Top in the old lists AND the office note kept, queue empty', !back.err && has(S, 'side') && has(S, 'top') && S.row.orders[0].notes === 'office note during fold' && st.q === 0,
      'old=' + oldKeys(S).map(k => k.split('|')[1]) + ' note=' + S.row.orders[0].notes + ' dev=' + JSON.stringify(st));
    await off.close(); await saw.close();
  }
  { // Q2: the fold's save LANDS but the reply is lost; the tablet dies; the office then UNTICKS Side in the old lists;
    //     the tablet reopens. "Placing them again is harmless" — is it? Side must stay unticked (the office's later word).
    const { S, off, saw } = await held(browser);
    let lost = 0;
    await saw.page.route(PP, async r => {
      const q = r.request();
      if (q.method() === 'PATCH' && !lost) { const b = JSON.parse(q.postData() || '{}'); if (b.settings && b.settings.listRow && b.settings.listRow.L1) { lost = 1; Object.assign(S.row, b); S.row.version = (+S.row.version || 1) + 1; return r.abort('connectionreset'); } }
      return r.fallback();
    });
    saw.page.evaluate(async () => { await loadDB(); await lqSend(); }).catch(() => {});
    for (let i = 0; i < 60 && !lost; i++) await F.sleep(100);
    await F.sleep(300);
    const landed = has(S, 'side') && has(S, 'top');
    const st0 = await devState(saw.page);
    // the office unticks Side (it was a mistake), on the switched-back old lists
    const un = await off.page.evaluate(async () => { await loadDB(); const l = DB.lists.find(x => x.id === 'L1'); const r = lsOldRows(l).find(x => x.lid === 'L1:1'); if (!r) return 'no row'; setRowTick(l, v1Key(r), 'saw', 'Dee', false); clearTimeout(saveT); await saveDB(); return 'ok'; });
    await settle(off.page);
    const afterUntick = has(S, 'side');
    const page = await reopen(saw, S); await asSaw(page);
    const st = await devState(page);
    rec('Q2a (setup) the lost-reply fold save did land both ticks; device still held them', landed && (st0.q > 0 || st0.pend), 'landed=' + landed + ' dev=' + JSON.stringify(st0));
    rec('Q2 office unticks Side after the fold landed; the tablet reopens and re-places its held queue: Side stays UNticked (no zombie tick)', un === 'ok' && !afterUntick && !has(S, 'side') && has(S, 'top'),
      'untick=' + un + ' side after untick=' + afterUntick + ' → after reopen old=' + oldKeys(S).map(k => k.split('|')[1]) + ' dev=' + JSON.stringify(st));
    await off.close(); await page.close();
  }
  { // Q3: queue holds tick Side → untick Side → tick Top; the first fold save fails (500); the retry must end Side unticked, Top ticked
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
    S.offline = true;
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.sleep(200); await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.sleep(200); await F.tapRow(saw.page, 'data-rt', 'L1:3');
    const ql = await saw.page.evaluate(async () => { await lqSend(); return lqRead().map(e => e.id + ':' + e.status).join(','); });
    S.offline = false; await settle(off.page); await pin(off.page);
    await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } }); await settle(off.page);
    S.failSaves = true;
    await saw.page.evaluate(async () => { await loadDB(); await lqSend(); });
    const mid = await devState(saw.page);
    S.failSaves = false;
    await saw.page.evaluate(async () => { await loadDB(); await lqSend(); }); await idle(saw.page);
    rec('Q3 tick→untick→tick queue, first fold save fails, retry: Side unticked, Top ticked, queue empty', !has(S, 'side') && has(S, 'top') && (await devState(saw.page)).q === 0,
      'queue was ' + ql + ' mid=' + JSON.stringify(mid) + ' old=' + oldKeys(S).map(k => k.split('|')[1]));
    rec('Q3b while the save is failing the screen says so', /could not be saved|kept on this device/.test(mid.err || ''), JSON.stringify(mid.err));
    await off.close(); await saw.close();
  }

  // ===== 2165095 — no backup carries the switch; strict switch moves =====
  { // B1: daily backup on v2 / during switching / on v1, and the downloaded file: none carry listStore or listStoreAt
    const { S, off, saw } = await held(browser, []);
    const r = await off.page.evaluate(async () => {
      const out = {}; const dl = () => { let blob = null; const u = URL.createObjectURL; URL.createObjectURL = b => { blob = b; return 'blob:x'; }; const a0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {}; try { ROLE = 'office'; tab = 's'; render(); } catch (e) {} const b = document.getElementById('btn-backup'); if (b) b.click(); URL.createObjectURL = u; HTMLAnchorElement.prototype.click = a0; return blob; };
      out.inMem = Object.keys(bakSettings()).filter(k => /listStore/.test(k));
      const blob = dl(); out.dl = blob ? Object.keys(JSON.parse(await blob.text()).settings).filter(k => /listStore/.test(k)) : 'no download button found';
      return out;
    });
    await off.page.evaluate(async () => { await backupNow('daily'); });
    const bk = S.backups[S.backups.length - 1];
    rec('B1 after a switch back (v1): bakSettings, the daily database copy and the downloaded file carry no listStore/listStoreAt',
      !r.inMem.length && !Object.keys(bk.payload.settings).some(k => /listStore/.test(k)) && Array.isArray(r.dl) && !r.dl.length, JSON.stringify(r) + ' daily keys=' + Object.keys(bk.payload.settings).filter(k => /listStore/.test(k)));
    await off.close(); await saw.close();
  }
  { // B2: a stale office tab loaded on v2 saves an order note WHILE a Switch back is running ('switching'). The trigger allows
    //     switching→v2, so if that tab sends its own 'v2' the switch back is undone half-way. Then Finish must still end on v1.
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office'), stale = await F.dev(browser, S, 'office');
    let gate = null, release;
    await off.page.route(PP, async r => { const b = r.request().method() === 'PATCH' ? JSON.parse(r.request().postData() || '{}') : null;
      if (b && b.settings && b.settings.listStore === 'v1' && !gate) { gate = new Promise(res => release = res); await gate; } return r.fallback(); });
    await settle(off.page); await pin(off.page);
    const sb = off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    for (let i = 0; i < 100 && !gate; i++) await F.sleep(50);
    const during = S.row.settings.listStore;
    await stale.page.evaluate(async () => { DB.orders[0].notes = 'stale v2 tab note'; clearTimeout(saveT); await saveDB(); }); await settle(stale.page);
    const afterStale = S.row.settings.listStore;
    release && release(); const r = await sb; await settle(off.page);
    rec('B2 a stale v2 tab saving during the switch back does not move the switch (stays "switching"), and the switch back ends on v1',
      during === 'switching' && afterStale === 'switching' && S.row.settings.listStore === 'v1' && !r.err && S.row.orders[0].notes === 'stale v2 tab note',
      'during=' + during + ' after stale save=' + afterStale + ' final=' + S.row.settings.listStore + ' sb=' + JSON.stringify(r) + ' note=' + S.row.orders[0].notes);
    await off.close(); await stale.close();
  }
  { // B3: after a switch back (record 'v1'), a tab loaded then saves WHILE a re-migration is running ('migrating'). The trigger
    //     allows migrating→v1; if the tab sends its 'v1' the migration's final 'v2' is then refused (v1→v2 not allowed).
    const { S, off, saw } = await held(browser, []);
    const stale = await F.dev(browser, S, 'office');
    let gate = null, release;
    await off.page.route(PP, async r => { const b = r.request().method() === 'PATCH' ? JSON.parse(r.request().postData() || '{}') : null;
      if (b && b.settings && b.settings.listStore === 'v2' && !gate) { gate = new Promise(res => release = res); await gate; } return r.fallback(); });
    const mg = off.page.evaluate(async () => { await loadDB(); try { const r = await lsMigrate('Garry'); return { ok: r.ok }; } catch (e) { return { err: e.message }; } });
    for (let i = 0; i < 200 && !gate; i++) await F.sleep(50);
    const during = S.row.settings.listStore;
    await stale.page.evaluate(async () => { DB.orders[0].notes = 'stale v1 tab note'; clearTimeout(saveT); await saveDB(); }); await settle(stale.page);
    const afterStale = S.row.settings.listStore;
    release && release(); const r = await mg; await settle(off.page);
    const offSays = await off.page.evaluate(() => DB.listStore);
    rec('B3 a stale v1 tab saving during a re-migration does not move the switch; migration ends with the record on v2 and the office screen agreeing',
      during === 'migrating' && afterStale === 'migrating' && S.row.settings.listStore === 'v2' && offSays === 'v2' && r.ok,
      'during=' + during + ' after stale save=' + afterStale + ' final record=' + S.row.settings.listStore + ' office screen=' + offSays + ' migrate=' + JSON.stringify(r));
    await off.close(); await saw.close(); await stale.close();
  }

  // ===== 89b5c5d — reload when the last refresh was skipped =====
  for (const hang of [3000, 13000]) { // the saw's own planner save is stuck for 3 s / 13 s (longer than the 10 s wait) when the switch-back is noticed
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
    S.offline = true;
    for (const id of ['L1:1', 'L1:3']) await F.tapRow(saw.page, 'data-rt', id);
    await saw.page.evaluate(async () => { await lqSend(); });
    S.offline = false; await settle(off.page); await pin(off.page);
    await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } }); await settle(off.page);
    let once = 0;
    await saw.page.route(PP, async r => { if (r.request().method() === 'PATCH' && !once) { once = 1; await F.sleep(hang); } return r.fallback(); });
    // a planner save is running (e.g. the operator's name change) when the 30 s refresh and the queue send come round
    await saw.page.evaluate(() => { DB.orders[0].notes = 'saw-side edit'; clearTimeout(saveT); saveDB(); });
    await F.sleep(200);
    await saw.page.evaluate(async () => { await loadDB(); window.dispatchEvent(new Event('online')); await lqSend(); });
    const at = { side: has(S, 'side'), top: has(S, 'top'), dev: await devState(saw.page) };
    // the app's own retries only (lqKick ≤ 10 s): wait up to 25 s
    let t = 0; for (; t < 250 && !(has(S, 'side') && has(S, 'top') && (await devState(saw.page)).q === 0); t++) await F.sleep(100);
    rec('R' + hang + ' saw save stuck ' + hang / 1000 + ' s while the switch back is noticed: both ticks reach the old lists by the app\'s own retry (' + (t / 10).toFixed(1) + ' s after)', has(S, 'side') && has(S, 'top'),
      'at send=' + JSON.stringify(at) + ' final old=' + oldKeys(S).map(k => k.split('|')[1]) + ' dev=' + JSON.stringify(await devState(saw.page)));
    rec('R' + hang + 'b the saw\'s own order note is kept', S.row.orders[0].notes === 'saw-side edit', S.row.orders[0].notes);
    await off.close(); await saw.close();
  }
  { // R3: the reload itself fails twice (500 on GET), then works — ticks still go in, never folded into a stale copy
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
    S.offline = true; await F.tapRow(saw.page, 'data-rt', 'L1:1'); await saw.page.evaluate(async () => { await lqSend(); }); S.offline = false;
    await settle(off.page); await pin(off.page);
    await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } }); await settle(off.page);
    let fails = 0;
    await saw.page.route(PP, r => (r.request().method() === 'GET' && fails < 2) ? (fails++, r.fulfill({ status: 500, body: '{}' })) : r.fallback());
    await saw.page.evaluate(async () => { await lqSend(); });
    const mid = await devState(saw.page);
    let t = 0; for (; t < 250 && !has(S, 'side'); t++) await F.sleep(100);
    rec('R3 reload after the switch back fails twice: tick kept on the device meanwhile, lands by the app\'s own retry', (mid.q > 0 || has(S, 'side')) && has(S, 'side'), 'mid=' + JSON.stringify(mid) + ' after ' + (t / 10) + ' s side=' + has(S, 'side'));
    await off.close(); await saw.close();
  }
  { // W4 (attack3 R1, other order): a tick held by the saw through the switch back, then a re-migration BEFORE the saw retries.
    //     The saw's next retry (now on v2 again) must still put the tick in the tables.
    const { S, off, saw } = await held(browser, ['L1:3']);
    const re = await off.page.evaluate(async () => { await loadDB(); try { const r = await lsMigrate('Garry'); return { ok: r.ok }; } catch (e) { return { err: e.message }; } });
    await settle(off.page);
    const before = L(S, 'L1:3') && L(S, 'L1:3').status;
    await saw.page.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); window.dispatchEvent(new Event('online')); await lqSend(); await new Promise(r => setTimeout(r, 400)); await lqSend(); });
    await idle(saw.page);
    let t = 0; for (; t < 150 && L(S, 'L1:3').status !== 'cut'; t++) await F.sleep(100);
    const top = Object.values(S.db.t.list_lines).filter(x => x.list_id === 'L1' && x.part === 'Top' && x.removed_rev == null);
    rec('W4 tick held through switch back, re-migrated before the saw retried: Top ends cut in the tables, queue empty', re.ok && top.length === 1 && top[0].status === 'cut' && (await devState(saw.page)).q === 0,
      're=' + JSON.stringify(re) + ' before=' + before + ' Top lines=' + top.map(x => x.id + ':' + x.status) + ' dev=' + JSON.stringify(await devState(saw.page)));
    await off.close(); await saw.close();
  }

  // ===== c7997bd — matKey in the Excel material checks =====
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    A.D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Oak Veneer', kind: 'sheet', aliases: ['MFC Oak'] });
    const o = await F.dev(browser, S, 'office');
    const r = await o.page.evaluate(async () => {
      await lsLoad();
      const mats = ['MFC White', ' mfc  white ', 'MFC White', 'MFC\tWHITE', 'ＭＦＣ White', 'mfc oak', 'MFC  OAK', 'MFC-White', 'MFC White 18mm', 'Oak  veneer'];
      const wb = { sheets: { S: mats.map((m, i) => ({ k: 'saw', item: 'P' + i, qty: 1, L: 100, W: 100, mat: m, note: '' })) } };
      const unk = lsUnknownMats(wb, [{ sheet: 'S' }], 'P1');
      const lines = mats.map(m => ({ kind: 'saw', material: m }));
      lsFlagMats(lines, 'P1');
      return { unk, flagged: lines.filter(l => l.material_other).map(l => l.material) };
    });
    rec('M1 spacing / NBSP / tab / case / full-width letters of a material or alias are not asked about; "MFC-White", "MFC White 18mm" are', JSON.stringify(r.unk.sort()) === JSON.stringify(['MFC White 18mm', 'MFC-White'].sort()), JSON.stringify(r.unk));
    rec('M2 the same names are not flagged "not on list" when saved; the two real unknowns are', JSON.stringify(r.flagged.sort()) === JSON.stringify(['MFC White 18mm', 'MFC-White'].sort()), JSON.stringify(r.flagged));
    await o.close();
  }

  // ===== b51076d — twins never take another's id (diffLines direct) =====
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const o = await F.dev(browser, S, 'office');
    const r = await o.page.evaluate(() => {
      const side = (id, st, rm) => ({ id, list_id: 'L1', seq: +id.split(':')[1], kind: 'saw', part: 'Side', length_mm: 720, width_mm: 560, qty: '2', material: 'MFC White', edging: null, note: null, status: st, removed_rev: rm == null ? null : rm });
      const old = [side('L1:1', 'todo'), side('L1:2', 'cut', 3), side('L1:3', 'todo'), side('L1:4', 'cut')];
      const row = (id, o = {}) => Object.assign({ id, kind: 'saw', part: 'Side', length_mm: 720, width_mm: 560, qty: '2', material: 'MFC White' }, o);
      const ids = d => d.lines.map(l => l.id).join(',');
      const out = {};
      // a: editor still shows removed L1:2 (unchanged) next to the other three → L1:2's row is NEW, the others keep their ids
      out.a = diffLines(old, [row('L1:1'), row('L1:2'), row('L1:3'), row('L1:4')], { listId: 'L1' });
      // b: same but the user deleted L1:4 in the editor → L1:2's row must not take L1:4 (cut) — L1:4 is removed (kept aside)
      out.b = diffLines(old, [row('L1:1'), row('L1:2'), row('L1:3')], { listId: 'L1' });
      // c: a row naming an id this list never had (pasted from another list) while L1:3 is not in the editor
      out.c = diffLines(old, [row('L1:1'), row('L7:9'), row('L1:4')], { listId: 'L1' });
      // d: two rows naming the same id (copy of a row) — the second must not grab twin L1:3 or L1:4
      out.d = diffLines(old, [row('L1:1'), row('L1:1'), row('L1:4')], { listId: 'L1' });
      // e: removed id, CHANGED qty
      out.e = diffLines(old, [row('L1:1'), row('L1:2', { qty: '5' }), row('L1:3'), row('L1:4')], { listId: 'L1' });
      return Object.fromEntries(Object.entries(out).map(([k, d]) => [k, { ids: ids(d), added: d.added, removed: d.removed, keepAside: d.keepAside, changed: d.changed }]));
    });
    rec('T1 removed twin shown unchanged in a stale editor comes back as a NEW id; L1:1/3/4 keep theirs', r.a.ids === 'L1:1,L1:5,L1:3,L1:4' && r.a.added.join() === 'L1:5', JSON.stringify(r.a));
    rec('T2 ... and with cut twin L1:4 deleted in the editor: L1:2\'s row is new, L1:4 removed and kept aside (not inherited)', r.b.ids === 'L1:1,L1:5,L1:3' && r.b.removed.join() === 'L1:4' && r.b.keepAside.join() === 'L1:4', JSON.stringify(r.b));
    rec('T3 a row naming an id the list never had does not take twin L1:3 (L1:3 was not in the editor → removed)', !/L1:3/.test(r.c.ids) && r.c.removed.includes('L1:3'), JSON.stringify(r.c));
    rec('T4 two rows naming the same id: the copy does not take another twin\'s id (L1:3 removed, copy new)', r.d.ids.split(',')[1] !== 'L1:3' && r.d.removed.includes('L1:3'), JSON.stringify(r.d));
    rec('T5 removed twin put back with a changed qty: new id, no other line marked changed', r.e.ids === 'L1:1,L1:5,L1:3,L1:4' && !r.e.changed.length, JSON.stringify(r.e));
    await o.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
