// ATTACK 16: an old-code tab (today's live `main`) left open after go-live saves the WHOLE record without a version check.
// Does it wipe what a new-code screen saved after the old tab loaded? And does the proposed "old-tab guard" trigger
// (docs/PROPOSAL-old-tab-guard.md, simulated by S.guardOld in tsrv.js) stop it without upsetting new-code saves?
// Run: node tests/stage1/t16-oldtab-overwrite.test.js
const { H, makeServer, device, OLD_HTML, sleep } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' }), H.order({ wo: 'WO-3' })], nid: 5, settings: {} });
(async () => {
  if (!OLD_HTML) { console.log('INFO no main branch to compare against'); return; }
  const browser = await H.chromium.launch();
  for (const guard of [false, true]) {
    const tag = guard ? 'WITH proposed guard' : 'SQL as written today';
    const S = makeServer(base()); S.guardOld = guard;
    const OLD = await device(browser, S, { name: 'old', old: true }, { role: 'office' }); // left open from before go-live
    const NEW = await device(browser, S, { name: 'new' }, { role: 'office' });
    await NEW.page.evaluate(async () => { DB.orders[0].notes = 'new-tab note'; await saveDB(); });
    await OLD.page.evaluate(async () => { DB.orders[1].notes = 'old-tab note'; await saveDB(); });
    const afterOld = S.row.orders[0].notes;
    await NEW.page.evaluate(async () => { await loadDB(); DB.orders[2].notes = 'second new-tab note'; await saveDB(); });
    await sleep(300);
    const fin = S.row.orders.map(o => o.notes || '');
    const oldUi = await OLD.page.evaluate(() => (document.getElementById('stxt') || {}).textContent || '');
    if (!guard) {
      info(tag + ': straight after the old tab saves, the new tab\'s note in the database', JSON.stringify(afterOld));
      rec(tag + ': new-tab note survives an old-tab save (expected to FAIL today - this is the go-live risk)', fin[0] === 'new-tab note', JSON.stringify(fin));
    } else {
      rec(tag + ': new-tab note survives an old-tab save', fin[0] === 'new-tab note', JSON.stringify(fin));
      rec(tag + ': old tab is refused and shows "Save failed" (it never overwrites)', S.guarded >= 1 && /fail/i.test(oldUi), 'refused=' + S.guarded + ' old tab says "' + oldUi + '"');
      rec(tag + ': later new-tab saves go through normally', fin[2] === 'second new-tab note', JSON.stringify(fin));
      // new-code conflict path (two new screens) still works under the guard
      const NEW2 = await device(browser, S, { name: 'new2' }, { role: 'office' });
      await NEW.page.evaluate(() => { DB.orders[0].plannedWeek = '2026-11-16'; });
      await NEW2.page.evaluate(async () => { DB.orders[2].plannedWeek = '2026-11-23'; await saveDB(); });
      await NEW.page.evaluate(async () => { await saveDB(); });
      await sleep(300);
      rec(tag + ': two new screens saving over each other still merge (no refusal)', S.row.orders[0].plannedWeek === '2026-11-16' && S.row.orders[2].plannedWeek === '2026-11-23' && S.guarded === 1, JSON.stringify({ w0: S.row.orders[0].plannedWeek, w2: S.row.orders[2].plannedWeek, refused: S.guarded, conflicts: S.conflicts }));
      const errs = [...NEW.dev.errors, ...NEW2.dev.errors];
      rec(tag + ': no script errors on new screens', errs.length === 0, errs.join(' | ').slice(0, 200));
      await NEW2.close();
    }
    await OLD.close(); await NEW.close();
  }
  await browser.close();
  console.log((res.filter(x => !x).length) + ' failed of ' + res.length);
})();
