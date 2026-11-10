// Garry 9 Nov (go-live 10 Nov): "clear the long list and start with jobs ticked for delivery". Settings switch
// "Only jobs ticked for delivery need a list": the to-issue list, counts and warnings only ask for lists for 🚚 jobs; nothing
// is marked or deleted; switching off brings the rest back; it is saved and survives a reload. Fake Supabase only.
const F = require('./fix3.js'); const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const J = JSON.stringify;
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row();
  row.orders.push(H.order({ wo: 'WO-30', customer: 'Aderrig Homes', step: '5. WORK ORDER PROCESSED', dueDate: '2026-12-10' }));
  row.orders.push(H.order({ wo: 'WO-31', customer: 'Aderrig Homes', step: '7. ASSEMBLY COMPLETE', dueDate: '2026-12-11', delv: true }));
  const S = F.makeServer(row); F.seedList(S, 'L1', { wos: ['WO-1'] });
  const t = await F.dev(browser, S, 'office'); const p = t.page;
  await p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; setWho('Ann'); });
  const need = () => p.evaluate(() => listsNeeded().map(o => o.wo).sort());
  const before = await need();
  rec('switch off (default): processed jobs without a list are asked for (WO-30 and WO-31 both)', before.includes('WO-30') && before.includes('WO-31'), J(before));
  const flag = await p.evaluate(async () => { showTab('s'); await new Promise(r => setTimeout(r, 100)); const c = document.getElementById('ls-delonly'); if (!c) return 'none'; c.checked = true; c.onchange(); await new Promise(r => setTimeout(r, 1500)); return DB.listDelOnly; });
  rec('Settings: "Only jobs ticked for delivery need a list" (Admin PIN) turns it on', flag === true, J(flag));
  const after = await need();
  rec('on: only jobs ticked for delivery are asked for (WO-31 stays, WO-30 is left out)', after.includes('WO-31') && !after.includes('WO-30') && after.every(w => (row.orders.find(o => o.wo === w) || {}).delv), J(after));
  rec('nothing is marked "No list needed" on the left-out jobs', await p.evaluate(() => !lsNA(DB.orders.find(o => o.wo === 'WO-30'))));
  await F.sleep(800);
  await p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
  rec('the planner record holds settings.listDelOnly = true', S.row.settings.listDelOnly === true, J(S.row.settings.listDelOnly));
  const t2 = await F.dev(browser, S, 'office');
  rec('saved: a fresh screen has the switch on and the same short list', await t2.page.evaluate(() => DB.listDelOnly === true && !listsNeeded().some(o => o.wo === 'WO-30')));
  await t2.close();
  await p.evaluate(async () => { const c = document.getElementById('ls-delonly'); c.checked = false; c.onchange(); await new Promise(r => setTimeout(r, 300)); });
  const back = await need();
  rec('switching it off brings WO-30 back', back.includes('WO-30'), J(back));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await t.close(); await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
