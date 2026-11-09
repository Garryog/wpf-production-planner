// Project details P1 (Coder): the spec sheet — hidden before the SQL, the checklist, saving, sign-off rules, the red chip on
// the cutting-list window, the saw / stores cards and the printed sheets. Fake Supabase only. Run: node tests/project-details/p1-spec.test.js
const X = require('./fixp.js');
const { H, D, DP, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  // ---- before the SQL: nothing shows, nothing breaks
  const S0 = X.makeServer(null, { noSpec: true });
  const o0 = await X.dev(browser, S0, 'office');
  await o0.page.evaluate(() => showTab('l')); await sleep(400);
  const r0 = await o0.page.evaluate(() => ({ st: SPECP.st, btn: !!document.getElementById('lh-spec'), chip: !!document.querySelector('.spec-chip'), mats: !!document.getElementById('lh-mats') }));
  rec('before the SQL: spec hidden quietly (no button, no chip), Materials button there', r0.st === 'missing' && !r0.btn && !r0.chip && r0.mats, JSON.stringify(r0));
  const n0 = S0.log.filter(x => /project_spec_items/.test(x)).length;
  await o0.page.evaluate(async () => { await lsPoll(); await lsPoll(); }); await sleep(200);
  rec('before the SQL: asked once per page load only', S0.log.filter(x => /project_spec_items/.test(x)).length === n0, n0 + ' → ' + S0.log.filter(x => /project_spec_items/.test(x)).length);
  rec('before the SQL: no page errors', !(S0.errors || []).length, JSON.stringify(S0.errors));
  await o0.close();

  // ---- with the SQL
  const S = X.makeServer();
  X.spec(S, 'SP-1', 'Hinges', 'Hettich Stock');
  const pm = await X.dev(browser, S, 'pm');
  rec('spec table found', await pm.page.evaluate(() => SPECP.st === 'ok'));
  const open = await pm.page.evaluate(() => specOpen('P1'));
  rec('a new sheet: every item except Other Information is open (21 kitchen items)', open.length === 21 && !open.includes('Other Information'), open.length + ' ' + open.slice(0, 3));
  // PM Projects tab
  await pm.page.evaluate(() => { pmTab = 'projects'; render(); }); await sleep(200);
  const pj = await pm.page.evaluate(() => ({ t: document.getElementById('pjh') && document.getElementById('pjh').innerText, chip: !!document.querySelector('#pjh .spec-chip'), btn: !!document.querySelector('#pjh [data-specopen="P1"].spec-btn'), mat: !!document.querySelector('[data-pjhm="P1"]') }));
  rec('PM Projects tab: project with red chip, Details and Materials buttons', /Aderrig/.test(pj.t) && pj.chip && pj.btn && pj.mat, JSON.stringify(pj));
  await pm.page.evaluate(() => document.querySelector('#pjh .spec-btn').click()); await sleep(300);
  const d1 = await pm.page.evaluate(() => ({ rows: document.querySelectorAll('.spec-tbl tr.spec-r').length, txt: document.getElementById('sp-body').innerText }));
  rec('Project details window: 22 items, 0 of 21 signed off', d1.rows === 22 && /0 of 21 signed off/.test(d1.txt), d1.rows + ' ' + d1.txt.slice(0, 120));
  // material item: a drop-down of the project's materials
  const matOpts = await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Carcass Material'); return [...document.querySelector('[data-spv="' + i + '"]').options].map(o => o.value); });
  rec('Carcass Material is a drop-down of the project\'s sheet materials + TBC + Add new', matOpts.includes('MFC White') && matOpts.includes('TBC') && matOpts.includes('__add'), matOpts.join('|'));
  const edgOpts = await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Carcass Edging'); return [...document.querySelector('[data-spv="' + i + '"]').options].map(o => o.value); });
  rec('Carcass Edging is a drop-down of the edging codes', edgOpts.includes('L1LE 1mm') && edgOpts.includes('__other'), edgOpts.join('|'));
  // pick a material → saved as proposed with material_id
  await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Carcass Material'); const s = document.querySelector('[data-spv="' + i + '"]'); s.value = 'MFC White'; s.onchange(); }); await sleep(400);
  let cm = S.db.t.project_spec_items.find(r => r.item === 'Carcass Material');
  rec('material saved: proposed, linked to the material', cm && cm.status === 'proposed' && cm.material_id === 'M1' && cm.value === 'MFC White', JSON.stringify(cm));
  // sign it off
  await pm.page.evaluate(() => { window.__who = ''; sessionStorage.setItem('wpfWho', 'Mary PM'); const i = specItems('P1').findIndex(e => e.item === 'Carcass Material'); document.querySelector('[data-sps="' + i + '"]').click(); }); await sleep(400);
  cm = S.db.t.project_spec_items.find(r => r.item === 'Carcass Material');
  rec('signed off with who and when', cm.status === 'signed-off' && cm.signed_by === 'Mary PM' && !!cm.signed_at, JSON.stringify(cm));
  rec('window shows 1 of 21 signed off', await pm.page.evaluate(() => /1 of 21 signed off/.test(document.getElementById('sp-body').innerText)));
  // TBC: typed text item → not specified, no sign-off button
  await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Handles'); const s = document.querySelector('[data-spv="' + i + '"]'); s.value = 'tbc'; s.onchange(); }); await sleep(400);
  const hd = S.db.t.project_spec_items.find(r => r.item === 'Handles');
  rec('"tbc" typed = not specified', hd && hd.status === 'not-specified', JSON.stringify(hd));
  rec('no Sign off button on a TBC item', await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Handles'); return !document.querySelector('[data-sps="' + i + '"]'); }));
  // changing a signed-off value → asks, drops to proposed
  await pm.page.evaluate(() => { window.confirm = () => true; const i = specItems('P1').findIndex(e => e.item === 'Carcass Material'); const s = document.querySelector('[data-spv="' + i + '"]'); s.value = 'TBC'; s.onchange(); }); await sleep(400);
  cm = S.db.t.project_spec_items.find(r => r.item === 'Carcass Material');
  rec('signed-off value changed to TBC: not specified, signer cleared', cm.status === 'not-specified' && cm.signed_by == null, JSON.stringify(cm));
  // stale: another PC changes Hinges meanwhile
  const h0 = S.db.t.project_spec_items.find(r => r.item === 'Hinges'); DP.update(S.db, h0, { value: 'Blum', updated_by: 'PC2' });
  await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Hinges'); const s = document.querySelector('[data-spv="' + i + '"]'); s.value = 'Grass'; s.onchange(); }); await sleep(500);
  const h1 = S.db.t.project_spec_items.find(r => r.item === 'Hinges');
  const m1 = await pm.page.evaluate(() => document.getElementById('sp-msg').textContent);
  rec('two PCs: the stale save is refused, the other PC\'s value kept and shown', h1.value === 'Blum' && /another screen/.test(m1), h1.value + ' / ' + m1);
  rec('the window now shows Blum', await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Hinges'); return document.querySelector('[data-spv="' + i + '"]').value === 'Blum'; }));
  // two PCs creating the same item at once
  DP.insert(S.db, { id: 'SP-X', project_id: 'P1', item: 'Sink Type', value: 'Franke', updated_by: 'PC2' });
  await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Sink Type'); const s = document.querySelector('[data-spv="' + i + '"]'); s.value = 'Blanco'; s.onchange(); }); await sleep(500);
  rec('two PCs add the same item: one row, the first value kept, told', S.db.t.project_spec_items.filter(r => r.item === 'Sink Type').length === 1 && S.db.t.project_spec_items.find(r => r.item === 'Sink Type').value === 'Franke' && /another screen/.test(await pm.page.evaluate(() => document.getElementById('sp-msg').textContent)));
  // extra item
  await pm.page.evaluate(() => { document.getElementById('sp-new').value = 'Splashback'; document.getElementById('sp-add').click(); }); await sleep(400);
  rec('extra item added', S.db.t.project_spec_items.some(r => r.item === 'Splashback' && r.is_extra));
  // history
  await pm.page.evaluate(() => { const i = specItems('P1').findIndex(e => e.item === 'Carcass Material'); document.querySelector('[data-sph="' + i + '"]').click(); }); await sleep(400);
  const hist = await pm.page.evaluate(() => document.getElementById('sp-hist').innerText);
  rec('History shows who, sign-off and the change', /Mary PM/.test(hist) && /Signed off/.test(hist) && /TBC/.test(hist), hist.slice(0, 300));
  await pm.page.evaluate(() => document.getElementById('pod-x').click()); await sleep(200);

  // ---- chip: cutting-list window, saw card, stores card, print
  const of = await X.dev(browser, S, 'office');
  await of.page.evaluate(() => { showTab('l'); }); await sleep(300);
  rec('Lists page: Projects, Materials and Project details buttons in plain view', await of.page.evaluate(() => !!document.getElementById('lh-projs') && !!document.getElementById('lh-mats') && !!document.getElementById('lh-spec')));
  rec('Lists page: project header shows the chip and Details x/21', await of.page.evaluate(() => !!document.querySelector('.lh-grp .spec-chip') && /Details \d+\/\d+/.test(document.querySelector('.lh-grp .spec-btn').textContent)));
  await of.page.evaluate(() => document.querySelector('[data-lhedit="L1"]').click()); await sleep(500);
  const ed = await of.page.evaluate(() => ({ chip: (document.querySelector('.me-ed .spec-chip') || {}).textContent || '', spec: !!document.getElementById('me-spec'), mats: !!document.getElementById('me-mats') }));
  rec('cutting-list window: red SPEC NOT SIGNED OFF chip, ✎ Project details and Materials beside the project', /SPEC NOT SIGNED OFF: .+\+\d+/.test(ed.chip) && ed.spec && ed.mats, JSON.stringify(ed));
  await of.page.evaluate(() => document.getElementById('me-spec').click()); await sleep(300);
  rec('✎ Project details opens the sheet over the list window', await of.page.evaluate(() => !!document.getElementById('sp-body') && !!document.querySelector('.me-ed')));
  await of.close();
  const saw = await X.dev(browser, S, 'saw');
  const sc = await saw.page.evaluate(() => ({ chip: [...document.querySelectorAll('.wl-card .spec-chip')].map(e => e.textContent), inputs: 0 }));
  rec('saw card: red chip', sc.chip.length >= 1 && /SPEC NOT SIGNED OFF/.test(sc.chip[0]), JSON.stringify(sc));
  await saw.page.evaluate(() => document.querySelector('.wl-card .spec-chip').click()); await sleep(300);
  rec('saw: the sheet opens read-only (no boxes, no buttons)', await saw.page.evaluate(() => !!document.getElementById('sp-body') && !document.querySelector('#sp-body [data-spv]') && !document.querySelector('#sp-body [data-sps]') && !document.getElementById('sp-add')));
  await saw.page.evaluate(() => document.getElementById('pod-x').click()); await sleep(200);
  await X.catchPrint(saw.page);
  await saw.page.evaluate(() => printWorkList('saw', 3)); await sleep(200);
  const pr = (await X.printed(saw.page))[0] || '';
  rec('printed saw sheet: red banner and the Project details block', /SPEC NOT SIGNED OFF/.test(pr) && /PROJECT DETAILS — Aderrig/.test(pr) && /Carcass Material/.test(pr), pr.length);
  await saw.close();
  const st = await X.dev(browser, S, 'stores');
  rec('stores card: red chip', await st.page.evaluate(() => [...document.querySelectorAll('.wl-card .spec-chip')].length >= 1));
  await st.close();
  // all signed off → chip gone
  const items = await (await X.dev(browser, S, 'design')).page.evaluate(() => specItems('P1').map(e => e.item));
  items.forEach((it, i) => { if (/^other info/i.test(it)) return; const r = S.db.t.project_spec_items.find(x => x.item.toLowerCase() === it.toLowerCase()); if (r) DP.update(S.db, r, { value: r.value && !/tbc/i.test(r.value) ? r.value : 'X', status: 'signed-off', signed_by: 'T', updated_by: 'T' }); else DP.insert(S.db, { id: 'SPA' + i, project_id: 'P1', item: it, value: 'Y', status: 'signed-off', signed_by: 'T' }); });
  const sw2 = await X.dev(browser, S, 'saw');
  rec('everything signed off: no chip on the saw', await sw2.page.evaluate(() => !document.querySelector('.spec-chip') && specOpen('P1').length === 0));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
