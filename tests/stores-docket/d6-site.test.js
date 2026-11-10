// Stores dockets D6: a Site address on the Projects dialog — saved on the project, used as the default "deliver to" on
// a new docket (editable per docket). A save that doesn't change the address doesn't send it (so projects still save
// before the docket SQL adds the column). Fake Supabase only. Run: node tests/stores-docket/d6-site.test.js
const X = require('./fixd.js');
const { H, D } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { site_address: null });
  const pr = await X.dev(browser, S, 'prod');
  const bodies = []; pr.page.on('request', r => { if (r.method() === 'PATCH' && /\/projects\?/.test(r.url())) bodies.push(r.postData()); });
  await pr.page.evaluate(() => { document.querySelector('[data-prodtab="lists"]').click(); }); await X.sleep(300);
  await pr.page.evaluate(() => document.getElementById('lh-projs').click()); await X.sleep(200);
  rec('Projects dialog has a "Site address (dockets)" column', await pr.page.evaluate(() => /Site address \(dockets\)/i.test(document.getElementById('pj-body').innerText) && !!document.querySelector('[data-pjsa="P1"]')));
  // save without touching the address: not sent
  await pr.page.evaluate(() => document.querySelector('[data-pjs="P1"]').click()); await X.sleep(400);
  rec('save with the address unchanged: site_address not sent', bodies.length === 1 && !/site_address/.test(bodies[0]), bodies.join(' | '));
  await pr.page.evaluate(() => { document.querySelector('[data-pjsa="P1"]').value = 'Site 4, Adamstown\nLucan'; document.querySelector('[data-pjs="P1"]').click(); }); await X.sleep(400);
  rec('site address saved on the project', D.find(S.db, 'projects', 'P1').site_address === 'Site 4, Adamstown\nLucan', JSON.stringify(D.find(S.db, 'projects', 'P1')));
  await pr.page.evaluate(() => { document.getElementById('pj-new-n').value = 'Cherrywood'; document.getElementById('pj-new-sa').value = 'Cherrywood Phase 2, Co. Dublin'; document.getElementById('pj-add').click(); }); await X.sleep(400);
  rec('new project with a site address', S.db.t.projects.some(p => p.name === 'Cherrywood' && p.site_address === 'Cherrywood Phase 2, Co. Dublin'));
  // the docket default
  const st = await X.dev(browser, S, 'stores');
  await st.page.evaluate(() => document.getElementById('dk-send').click()); await X.sleep(200);
  await st.page.evaluate(() => { const s = document.getElementById('dk-proj'); s.value = 'P1'; s.onchange({ target: s }); }); await X.sleep(500);
  rec('Send to site: the address defaults to the project\'s', (await st.page.evaluate(() => document.getElementById('dk-site').value)) === 'Site 4, Adamstown\nLucan');
  await st.page.evaluate(() => { const si = document.getElementById('dk-site'); si.value = 'Gate 2, Adamstown'; si.oninput(); document.querySelector('[data-dksel="L1:3"]').click(); });
  await st.page.evaluate(() => document.getElementById('dk-make').click()); await X.sleep(700);
  rec('changed on the docket only: docket has the new address, the project keeps its own', S.db.t.stores_dockets[0].site_address === 'Gate 2, Adamstown' && D.find(S.db, 'projects', 'P1').site_address === 'Site 4, Adamstown\nLucan');
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
