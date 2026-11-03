// Tester (attack7, 3 Nov): a tick whose save LANDED but whose reply was lost, then ANOTHER screen (the office) unticks
// it, then the first screen saves again (its 30-s retry, or any later edit). Does the first screen's retry put the tick
// back? t9 only covers the untick being made on the SAME screen. Switch OFF (plain planner record, no new lists).
// Fake Supabase only (tsrv.js). Run: node tests/stage1/t10-cross-untick.test.js   (OLD=1 also runs it on main = live today)
const { H, makeServer, device, sleep, OLD_HTML } = require('./tsrv');
process.on('unhandledRejection', () => {});
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const base = () => ({ id: 'main', version: 1, nid: 50, orders: [H.order({ wo: 'WO-1' })], settings: { listRow: { L: { keep: { m: 'saw', by: 'T' } } }, weekCaps: {} } });
const ticks = S => Object.keys(((S.row.settings || {}).listRow || {}).L || {}).sort().join(',');
const TICK = `(()=>{DB.listRow=DB.listRow||{};DB.listRow.L=DB.listRow.L||{};DB.listRow.L.side={m:'saw',by:'Saw'};})()`;
const UNTICK = `(()=>{if(DB.listRow&&DB.listRow.L)delete DB.listRow.L.side;})()`;
const quiet = p => p.waitForFunction(() => !SAVING, null, { timeout: 10000, polling: 30 }).catch(() => {});
(async () => {
  const browser = await H.chromium.launch();
  const variants = [['retry', 'saw\'s next save is its 30-s retry'], ['edit', 'saw edits something else and saves'], ['refresh', 'saw refreshes (2-min poll) then saves']];
  for (const old of process.env.OLD && OLD_HTML ? [false, true] : [false]) for (const [how, txt] of variants) {
    const S = makeServer(base());
    const saw = await device(browser, S, { name: 'saw', old }, { role: 'saw' }), off = await device(browser, S, { name: 'office', old }, { role: 'office' });
    saw.dev.dropReply = 1;
    await saw.page.evaluate(TICK); await saw.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); await quiet(saw.page);
    saw.dev.dropReply = 0;
    const landed = ticks(S);
    await off.page.evaluate(async () => { await loadDB(); }); await off.page.evaluate(UNTICK);
    await off.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); await quiet(off.page);
    const afterOffice = ticks(S);
    if (how === 'edit') await saw.page.evaluate(() => { DB.weekCaps = DB.weekCaps || {}; DB.weekCaps.x = 1; });
    if (how === 'refresh') await saw.page.evaluate(async () => { await loadDB(); });
    await saw.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); await quiet(saw.page);
    await off.page.evaluate(async () => { await loadDB(); });
    rec((old ? '[main] ' : '') + 'T10 ' + how + ': saw tick landed (reply lost), office unticks, ' + txt + ' -> office untick stays',
      landed === 'keep,side' && afterOffice === 'keep' && ticks(S) === 'keep', 'landed=' + landed + ' afterOffice=' + afterOffice + ' final=' + ticks(S));
    await saw.close(); await off.close();
  }
  await browser.close(); console.log(fail + ' failed of ' + (pass + fail));
})().catch(e => { console.error(e); process.exit(1); });
