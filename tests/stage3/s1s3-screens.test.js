// Stage 3 S1–S3: Design office role, Production Manager strip, Projects + Materials screens, Lists home, and the saw's
// "Waiting for a list" strip — all only with the switch on. Fake Supabase only. Run: node tests/stage3/s1s3-screens.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const txt = p => p.evaluate(() => document.body.innerText);
function fixture(on) {
  const row = F.v2Row(on ? {} : { listStore: undefined, listStoreAt: undefined });
  if (!on) { delete row.settings.listStore; delete row.settings.listStoreAt; }
  row.orders.push(H.order({ wo: 'WO-4', customer: 'Crown Builders', unit: '4', dueDate: '2026-10-26', origDueDate: '2026-10-26' }));
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'] });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { customer: 'Aderrig Homes', list_owner: 'Ciara (design)' });
  F.seedList(S, 'L2', { name: 'Kitchen type B', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed' } });
  F.seedList(S, 'L3', { name: 'House 3 revised', wos: [], list: { rev: 2, locked: true } });
  F.seedList(S, 'L5', { name: 'Old house', wos: [], list: { archived: true } });
  return S;
}
(async () => {
  const browser = await H.chromium.launch();
  // ---- switch off: nothing new shows, nothing is fetched
  {
    const S = fixture(false);
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const a = await off.page.evaluate(() => { rolePicker(); const d = !!document.querySelector('[data-role="design"]'); document.getElementById('rovl').className = 'rovl hide'; showTab('s'); const pin = !!document.getElementById('s-pin-design'); showTab('l'); return { d, pin, lh: !!document.getElementById('lh'), lib: !!document.getElementById('lst-filter') }; });
    const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    const st = await saw.page.evaluate(() => !!document.getElementById('wait-list'));
    rec('switch off: no Design office button, no Design PIN, old Lists library, no saw strip, no calls to the new tables', !a.d && !a.pin && !a.lh && a.lib && !st && F.newTableCalls(S).length === 0, JSON.stringify(a) + ' ' + F.newTableCalls(S).join());
    await off.close(); await saw.close();
  }
  const S = fixture(true);
  // ---- Design office role
  const des = await F.dev(browser, S, 'office');
  const r1 = await des.page.evaluate(() => { rolePicker(); return !!document.querySelector('[data-role="design"]'); });
  await des.page.evaluate(async () => { document.getElementById('rovl').className = 'rovl hide'; localStorage.setItem('wpfPin_design', '8888'); setRole('design'); await new Promise(r => setTimeout(r, 200)); });
  const t1 = await txt(des.page);
  rec('Design office: on the role picker (switch on), PIN 8888 by default, opens straight onto Lists', r1 && (await des.page.evaluate(() => roleOk('design'))) && /Design office/.test(t1) && /House 1/.test(t1) && !!(await des.page.evaluate(() => document.getElementById('lh'))), t1.slice(0, 200));
  rec('Design office polls lists every 10 s', (await des.page.evaluate(() => LST.ms)) === 10000);
  // ---- Lists home: search and filters
  const names = () => des.page.evaluate(() => [...document.querySelectorAll('[data-lhrow]')].map(r => r.dataset.lhrow).join());
  rec('Lists home: live lists grouped by project, templates and archived hidden by default', (await names()) === 'L1,L3', await names());
  const set = (id, v) => des.page.evaluate(({ id, v }) => { const e = document.getElementById(id); e.value = v; (e.oninput || e.onchange)(); }, { id, v });
  await set('lh-q', 'wo-1'); rec('search by work order', (await names()) === 'L1', await names());
  await set('lh-q', 'aderrig homes'); rec('search by customer', (await names()) === 'L1', await names());
  await set('lh-q', ''); await set('lh-kind', 'tpl'); rec('filter: templates only', (await names()) === 'L2', await names());
  await set('lh-q', 'type b'); rec('search by type name on templates', (await names()) === 'L2');
  await set('lh-q', ''); await set('lh-kind', 'all'); await set('lh-type', 'kitchen'); rec('filter: type kitchen', (await names()) === 'L2');
  await set('lh-type', ''); await set('lh-kind', 'live'); await set('lh-rev', 'revised'); rec('filter: revised', (await names()) === 'L3', await names());
  await set('lh-rev', ''); await set('lh-state', 'archived'); rec('filter: archived', (await names()) === 'L5', await names());
  await set('lh-state', 'live'); rec('filter: live (with the saw: locked, or cut-by today / next working day — L1 is cut by today)', (await names()) === 'L1,L3', await names());
  await des.page.evaluate(() => document.getElementById('lh-x').click());
  rec('clear filters', (await names()) === 'L1,L3');
  const hdr = await des.page.evaluate(() => ['data-lhtpl', 'data-lhmat', 'data-lhnew', 'data-lhimp'].every(a => document.querySelector('[' + a + '="P1"]')));
  rec('project header has Templates / Materials / + New list / Import Excel', hdr);
  await des.page.evaluate(() => document.querySelector('[data-lhtpl="P1"]').click());
  rec('Templates button shows this project\'s templates', (await names()) === 'L2');
  await des.page.evaluate(() => document.getElementById('lh-x').click());
  // escaping
  D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { name: '<img src=x onerror=window.__x=1>' });
  await des.page.evaluate(async () => { await lsPoll(); render(); });
  rec('list names are escaped on Lists home', !(await des.page.evaluate(() => window.__x)) && /&lt;img/.test(await des.page.evaluate(() => document.getElementById('lh').innerHTML)));
  // ---- Projects (design office edits without a PIN prompt)
  await des.page.evaluate(() => { window.__asked = 0; window.prompt = () => { window.__asked++; return null; }; lsProjectsDlg(); const o = document.querySelector('.pod-ovl'); o.querySelector('#pj-new-n').value = 'Kilmurry'; o.querySelector('#pj-new-c').value = 'Kilmurry Ltd'; o.querySelector('#pj-add').click(); });
  await F.sleep(300);
  const kp = S.db.t.projects.find(p => p.name === 'Kilmurry');
  rec('Projects: Design office adds a project with no PIN prompt', kp && kp.customer === 'Kilmurry Ltd' && (await des.page.evaluate(() => window.__asked)) === 0);
  await des.page.evaluate(() => { const o = document.querySelector('.pod-ovl'); o.querySelector('#pj-new-n').value = 'ADERRIG '; o.querySelector('#pj-add').click(); });
  await F.sleep(200);
  rec('Projects: a duplicate name (any case/spacing) is refused', /already a project/.test(await des.page.evaluate(() => document.querySelector('#pj-msg').textContent)) && S.db.t.projects.length === 2);
  await des.page.evaluate(id => { const o = document.querySelector('.pod-ovl'); o.querySelector('[data-pjn="' + id + '"]').value = 'Kilmurry Phase 2'; o.querySelector('[data-pja="' + id + '"]').checked = false; o.querySelector('[data-pjs="' + id + '"]').click(); }, kp.id);
  await F.sleep(300);
  rec('Projects: rename + set inactive (never deleted)', D.find(S.db, 'projects', kp.id).name === 'Kilmurry Phase 2' && D.find(S.db, 'projects', kp.id).active === false && !S.deletes3);
  D.update(S.db, 'projects', D.find(S.db, 'projects', kp.id), { customer: 'Changed elsewhere' });
  await des.page.evaluate(id => { const o = document.querySelector('.pod-ovl'); o.querySelector('[data-pjn="' + id + '"]').value = 'Stale name'; o.querySelector('[data-pjs="' + id + '"]').click(); }, kp.id);
  await F.sleep(300);
  rec('Projects: a save over another PC\'s change is refused and reloaded', D.find(S.db, 'projects', kp.id).name === 'Kilmurry Phase 2' && /another screen/.test(await des.page.evaluate(() => document.querySelector('#pj-msg') ? document.querySelector('#pj-msg').textContent : '')), await des.page.evaluate(() => document.querySelector('#pj-msg') && document.querySelector('#pj-msg').textContent));
  await des.page.evaluate(() => document.querySelector('.pod-ovl').remove());
  // ---- Materials
  await des.page.evaluate(() => { lsMaterialsDlg('P1'); const o = document.querySelector('.pod-ovl'); o.querySelector('#mt-new-n').value = '18mm Oak veneer'; o.querySelector('#mt-add').click(); });
  await F.sleep(300);
  const oak = S.db.t.project_materials.find(m => m.name === '18mm Oak veneer');
  await des.page.evaluate(id => { const o = document.querySelector('.pod-ovl'); o.querySelector('[data-mta="' + id + '"]').value = 'Oak, oak veneer 18'; o.querySelector('[data-mts="' + id + '"]').click(); }, oak.id);
  await F.sleep(300);
  rec('Materials: add a sheet material and its other spellings', oak && oak.kind === 'sheet' && D.find(S.db, 'project_materials', oak.id).aliases.join('|') === 'Oak|oak veneer 18');
  await des.page.evaluate(() => { const o = document.querySelector('.pod-ovl'); o.querySelector('#mt-new-n').value = 'mfc white'; o.querySelector('#mt-add').click(); });
  await F.sleep(200);
  rec('Materials: duplicate name refused', /already on this project/.test(await des.page.evaluate(() => document.querySelector('#mt-msg').textContent)));
  await des.page.evaluate(id => { const o = document.querySelector('.pod-ovl'); o.querySelector('[data-mtv="' + id + '"]').checked = false; o.querySelector('[data-mts="' + id + '"]').click(); }, oak.id);
  await F.sleep(300);
  rec('Materials: retire (inactive) — kept, and no longer offered', D.find(S.db, 'project_materials', oak.id).active === false && !(await des.page.evaluate(() => knownMaterials().includes('18mm Oak veneer'))));
  await des.page.evaluate(() => document.querySelector('.pod-ovl').remove());
  // ---- Office: edit needs a Prod / Design / Admin PIN once per device
  const off = await F.dev(browser, S, 'office');
  await off.page.evaluate(async () => { showTab('l'); await new Promise(r => setTimeout(r, 100)); });
  rec('office Lists tab: the library is Lists home (with the needed panel kept above)', !!(await off.page.evaluate(() => document.getElementById('lh'))) && /Cutting lists needed/.test(await txt(off.page)));
  await off.page.evaluate(() => { window.prompt = () => '2468'; lsMaterialsDlg('P1'); const o = document.querySelector('.pod-ovl'); o.querySelector('#mt-new-n').value = 'Grey Gloss'; o.querySelector('#mt-add').click(); });
  await F.sleep(300);
  rec('office: the Office PIN can\'t edit materials', !S.db.t.project_materials.some(m => m.name === 'Grey Gloss'));
  await off.page.evaluate(() => { window.__asked = 0; window.prompt = () => { window.__asked++; return '7777'; }; const o = document.querySelector('.pod-ovl'); o.querySelector('#mt-add').click(); });
  await F.sleep(300);
  await off.page.evaluate(() => { const o = document.querySelector('.pod-ovl'); o.querySelector('#mt-new-n').value = 'Black Gloss'; o.querySelector('#mt-add').click(); });
  await F.sleep(300);
  rec('office: the Production Manager PIN once, then remembered on this device', S.db.t.project_materials.some(m => m.name === 'Grey Gloss') && S.db.t.project_materials.some(m => m.name === 'Black Gloss') && (await off.page.evaluate(() => window.__asked)) === 1);
  await off.page.evaluate(() => document.querySelector('.pod-ovl').remove());
  // ---- Production Manager strip
  const pr = await F.dev(browser, S, 'prod');
  const s1 = await pr.page.evaluate(() => [...document.querySelectorAll('[data-prodtab]')].map(b => b.textContent).join('|'));
  await pr.page.evaluate(() => document.querySelector('[data-prodtab="lists"]').click());
  rec('Production Manager: Today | Lists | Snags strip; Lists shows Lists home', /Today\|.*Lists\|.*Snags/.test(s1) && !!(await pr.page.evaluate(() => document.getElementById('lh'))), s1);
  await pr.page.evaluate(() => document.querySelector('[data-prodtab="today"]').click());
  rec('Production Manager: Today is today\'s screen', /what needs you today/.test(await txt(pr.page)));
  // ---- Waiting for a list on the saw
  const saw = await F.dev(browser, S, 'saw');
  const w = await saw.page.evaluate(() => { const e = document.getElementById('wait-list'); return e ? { t: e.innerText, rows: [...e.querySelectorAll('[data-waitwo]')].map(r => r.dataset.waitwo + ':' + (r.style.background ? 'red' : '')) } : null; });
  rec('saw strip: jobs with no list, above the sheets panel', w && w.rows.join() === 'WO-2:red,WO-4:' && (await saw.page.evaluate(() => { const a = document.getElementById('wait-list'), b = document.body.innerText.indexOf('Sheets need'); return document.body.innerText.indexOf('WAITING FOR A LIST') < b; })), JSON.stringify(w && w.rows));
  rec('saw strip: WO-2 cut by today (21 Oct), list due by Tue 20 Oct — overdue red; owner from the project', /WO-2[\s\S]*OVERDUE · cut by 21 Oct[\s\S]*list due by 20 Oct[\s\S]*owner Ciara \(design\)/.test(w.t), w.t);
  rec('saw strip: WO-4 (delivers Mon 26) cut by Sun 25, list due by Fri 23 (the working day before); owner defaults to Production Manager', /WO-4[\s\S]*cut by 25 Oct[\s\S]*list due by 23 Oct[\s\S]*owner Production Manager/.test(w.t), w.t);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await des.close(); await off.close(); await pr.close(); await saw.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
