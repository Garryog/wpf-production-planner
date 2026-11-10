// Coder check: a P-number clash renumbers the later job, moves its cutting-list tag and Export baseline, and tells the user.
const { H, makeServer, device } = require('./tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1' })], nid: 5, settings: { lists: [{ id: 'LA', name: 'A', wos: [] }] } });
  const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
  const mk = (p, t) => p.evaluate(async t => { window.__al = []; window.alert = m => window.__al.push(m); const wo = nextPNumber(); DB.orders.push({ wo, title: t, hours: 4, step: 'Planner WO', plannedWeek: '2026-11-16', log: [{ at: new Date().toISOString() + t, by: t, what: 'created' }] }); orig[wo] = ''; origStep[wo] = 'Planner WO'; if (t === 'B') DB.lists.push({ id: 'LB', name: 'B list', wos: [wo] }); return wo; }, t);
  await mk(A.page, 'A'); await mk(B.page, 'B');
  await A.page.evaluate(() => saveDB()); await B.page.evaluate(() => saveDB());
  const o = S.row.orders.filter(x => /^P-/.test(x.wo)).map(x => x.wo + ':' + x.title).sort().join(',');
  const lb = (S.row.settings.lists.find(l => l.id === 'LB') || {}).wos;
  const al = await B.page.evaluate(() => window.__al.join('|'));
  rec('both jobs kept, later one renumbered', o === 'P-1001:A,P-1002:B', o);
  rec('its cutting list tag moved with it', JSON.stringify(lb) === '["P-1002"]', JSON.stringify(lb));
  rec('Export baseline follows', S.row.settings.exportBase.st['P-1002'] === 'Planner WO', JSON.stringify(S.row.settings.exportBase.st));
  rec('user told', /P-1001 is now P-1002/.test(al), al.slice(0, 80));
  await A.close(); await B.close(); await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
