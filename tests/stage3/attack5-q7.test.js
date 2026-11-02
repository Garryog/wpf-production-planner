// ATTACK 5 — attack-queue Q7/Q7b under load: a tablet holding unsent ticks through a Switch back. When the check fails,
// are the ticks LOST or only late? Each run is classified: on time / late (arrive after the fold's save settles or the next
// refresh) / LOST (not in the record and not in the device queue or device copy). Plus: the fold's planner save slow,
// failing, and the tab closed before the retry. Fake Supabase only. Run: node tests/stage3/attack5-q7.test.js [reps]
const A = require('./atk.js');
const { F, S3, H, rec } = A;
const L = F.line;
const REPS = +(process.argv[2] || 5);
const old = S => Object.keys((S.row.settings.listRow || {}).L1 || {}).length;
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const idle = p => p.evaluate(async () => { for (let i = 0; i < 100 && (SAVING || saveT || LQ.folding); i++) { if (saveT && !SAVING) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const devState = p => p.evaluate(() => ({ v2: V2(), q: lqRead().length, pend: !!localStorage.getItem('wpfPending'), saving: !!SAVING, saveT: !!saveT, folding: !!LQ.folding, failed: !!DB.saveFailed, err: LQ.err }));
async function q7(browser, opt = {}) {
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
  const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
  S.offline = true;
  for (const id of ['L1:1', 'L1:3']) await F.tapRow(saw.page, 'data-rt', id);
  await saw.page.evaluate(async () => { await lqSend(); });
  S.offline = false;
  const back = await off.page.evaluate(async () => { for (let i = 0; i < 50 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
  if (opt.slow) await saw.page.route(PP, async r => { if (r.request().method() === 'PATCH') await F.sleep(opt.slow); return r.fallback(); });
  if (opt.fail) S.failSaves = true;
  // exactly what Q7 does
  await saw.page.evaluate(async () => { await loadDB(); window.dispatchEvent(new Event('online')); await new Promise(r => setTimeout(r, 300)); await lqSend(); });
  const now = { old: old(S), dev: await devState(saw.page) };
  return { S, off, saw, back, now };
}
(async () => {
  const browser = await H.chromium.launch();
  const tally = { onTime: 0, late: 0, refresh: 0, lost: 0, details: [] };
  for (let i = 0; i < REPS; i++) {
    const { S, off, saw, back, now } = await q7(browser);
    if (now.old >= 2 && now.dev.q === 0) tally.onTime++;
    else {
      await idle(saw.page); const a = old(S);
      if (a >= 2) { tally.late++; tally.details.push('late: at check old=' + now.old + ' dev=' + JSON.stringify(now.dev)); }
      else {
        await saw.page.evaluate(async () => { await loadDB(); await lqSend(); }); await idle(saw.page); // next 30 s refresh
        if (old(S) >= 2) { tally.refresh++; tally.details.push('after refresh: at check ' + JSON.stringify(now)); }
        else { tally.lost++; tally.details.push('LOST: ' + JSON.stringify(now) + ' after=' + JSON.stringify(await devState(saw.page)) + ' back=' + JSON.stringify(back) + ' old=' + old(S)); }
      }
    }
    await off.close(); await saw.close();
  }
  rec('P1 Q7 ×' + REPS + ': no run loses a tick (on time ' + tally.onTime + ', late ' + tally.late + ', after next refresh ' + tally.refresh + ', LOST ' + tally.lost + ')', tally.lost === 0, tally.details.join(' || ').slice(0, 900));
  rec('P1b Q7 ×' + REPS + ': ticks in the record by the time Q7 checks (the original test\'s expectation)', tally.late + tally.refresh + tally.lost === 0, tally.details.slice(0, 3).join(' || ').slice(0, 600));
  { // P2: the fold's planner save is slow (bad signal): the ticks are off the device queue — are they safe on the device?
    const { S, off, saw, now } = await q7(browser, { slow: 3000 });
    rec('P2 fold save in flight: ticks are in the record or still held on the device (queue or device copy)', now.old >= 2 || now.dev.q > 0 || now.dev.pend, JSON.stringify(now));
    await idle(saw.page);
    rec('P2b after the slow save lands: both ticks in the old lists', old(S) >= 2, 'old=' + old(S) + ' ' + JSON.stringify(await devState(saw.page)));
    await off.close(); await saw.close();
  }
  { // P3: the fold's planner save FAILS (500) and the operator closes the tab before the retry. Reopen with signal back.
    const { S, off, saw, now } = await q7(browser, { fail: true });
    const st = await devState(saw.page);
    const page = await saw.ctx.newPage(); await saw.page.close();
    S.failSaves = false;
    const n = { ...saw, page }; page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
    await S3.attach(n, S);
    await page.goto('https://wpf.test/?view=office');
    await page.waitForFunction(() => typeof analyzeImport === 'function'); await F.sleep(1500);
    await page.evaluate(async () => { localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); await loadDB(); await lqSend(); });
    await idle(page); await F.sleep(500); await idle(page);
    rec('P3 fold save failed, tab closed, reopened: both ticks reach the old lists (not lost)', old(S) >= 2, 'before close=' + JSON.stringify(st) + ' at check=' + JSON.stringify(now) + ' → old ticks after reopen=' + old(S));
    await off.close(); await page.close();
  }
  { // P4: the fold's planner save never gets through (signal drops again mid-save) and the tablet's tab is closed / battery dies
    //     while it is still "saving". Reopen with signal back: are the ticks anywhere?
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
    S.offline = true;
    for (const id of ['L1:1', 'L1:3']) await F.tapRow(saw.page, 'data-rt', id);
    await saw.page.evaluate(async () => { await lqSend(); });
    S.offline = false;
    await off.page.evaluate(async () => { for (let i = 0; i < 50 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } return lsSwitchBack('Garry'); });
    await saw.page.route(PP, r => r.request().method() === 'PATCH' ? new Promise(() => {}) : r.fallback()); // the save never arrives
    saw.page.evaluate(async () => { await loadDB(); await lqSend(); }).catch(() => {});
    await F.sleep(1500);
    const st = await devState(saw.page);
    const page = await saw.ctx.newPage(); await saw.page.close({ runBeforeUnload: false });
    const n = { ...saw, page }; page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
    await S3.attach(n, S);
    await page.goto('https://wpf.test/?view=office');
    await page.waitForFunction(() => typeof analyzeImport === 'function'); await F.sleep(1500);
    await page.evaluate(async () => { localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); await loadDB(); await lqSend(); });
    await idle(page); await F.sleep(500); await idle(page);
    const after = await devState(page);
    rec('P4 fold save in flight when the tablet tab dies (save never arrived): ticks still reach the old lists after reopen', old(S) >= 2,
      'while saving=' + JSON.stringify(st) + ' → after reopen old ticks=' + old(S) + ' device=' + JSON.stringify(after) + ' (lqFoldV1 takes them off wpfLineQ before saveDB lands and writes no device copy first)');
    await off.close(); await page.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
