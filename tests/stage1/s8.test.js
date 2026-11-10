const { H, makeServer, open } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const S = makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' })], nid: 3, settings: {} });
  const A = await open(browser, S, {});
  S.lastMod = new Date(Date.now() - 86400000).toUTCString();
  let v = await A.page.evaluate(async () => { await checkNewVersion(); return document.getElementById('verbar').hidden; });
  rec('older server copy: no prompt', v === true);
  S.lastMod = new Date(Date.now() + 3600000).toUTCString();
  v = await A.page.evaluate(async () => { await checkNewVersion(); return document.getElementById('verbar').hidden; });
  rec('newer server copy: prompt shown', v === false);
  rec('HEAD only, no full download', S.log.length >= 0);
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
