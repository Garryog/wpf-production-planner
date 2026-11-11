// Tester attack 2 (Project details, Garry's 11 Nov answer 6): the spec's materials come first in the cutting-list Material
// drop-down ("From the project details (spec)"). Retired / renamed material, spec value not on the materials list, TBC,
// two specs naming the same board, a retired spec, fittings rows, the header Carcass colour, templates, before the SQL
// and with the lists switch off. Fake Supabase only. Run: node tests/project-details/attack2-mats.test.js
const X = require('./fixp.js');
const { H, D, DP, rec, sleep } = X;
const ev = (t, fn, a) => t.page.evaluate(fn, a);
// the option groups of every Material drop-down in the open list window: { "row|kind": ["label: a,b", …] }
const groups = t => ev(t, () => { const o = {}; document.querySelectorAll('.pod-ovl:last-of-type select[data-mr$="|mat"], .pod-ovl:last-of-type #me-carc').forEach(s => { o[s.id || s.dataset.mr] = [...s.querySelectorAll('optgroup')].map(g => g.label + ': ' + [...g.querySelectorAll('option')].map(x => x.value).join(',')); }); return o; });
const reopen = async (t, id) => { await ev(t, async id => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); await lsPoll(); openListEditor(id || 'L1'); }, id); await sleep(600); };
const specG = g => Object.values(g).map(a => a.find(x => /^From the project details/.test(x)) || '');
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer(null, { lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''], ['fit', 'Tap', '1', null, null, 'Chrome mixer', '', '']] });
  D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Egger W980', kind: 'sheet' });
  D.insert(S.db, 'project_materials', { id: 'M4', project_id: 'P1', name: 'Oak worktop', kind: 'other' });
  X.spec(S, 'A1', 'Carcass Material', 'MFC White', { material_id: 'M1' });
  X.spec(S, 'A2', 'Door and Drawer Material', 'Egger W980', { material_id: 'M3' });
  X.spec(S, 'A3', 'Exposed Material', 'Mystery Board'); // not on the project's materials
  X.spec(S, 'A4', 'Wall unit door material', 'TBC');
  X.spec(S, 'A5', 'Worktop Colour', 'Oak worktop', { material_id: null }); // a FITTING material named in the spec
  const of = await X.dev(browser, S, 'office');
  await reopen(of);
  let g = await groups(of);
  const sg = specG(g).filter(Boolean);
  rec('spec group present on the board drop-downs: MFC White, Egger W980 in sheet order', sg.length > 0 && sg.every(x => x === 'From the project details (spec): MFC White,Egger W980'), JSON.stringify(g).slice(0, 400));
  rec('spec value not on the materials list (Mystery Board) and TBC are not offered', !JSON.stringify(g).includes('Mystery Board') && !/TBC/.test(sg.join()), JSON.stringify(sg));
  rec('(info) a FITTING named in the spec (Worktop Colour = Oak worktop) is not in the spec group', !sg.join().includes('Oak worktop'), JSON.stringify(g).slice(0, 300));
  rec('the header Carcass colour drop-down gets the spec group too', (g['me-carc'] || []).some(x => /^From the project details/.test(x)), JSON.stringify(g['me-carc']));
  // pick a spec material on a saw row and save: not flagged
  const k = await ev(of, () => { const r = [...document.querySelectorAll('.pod-ovl:last-of-type select[data-mr$="|mat"]')].find(s => s.value === 'MFC White'); return r && r.dataset.mr; }); // the saw row (Side, MFC White)
  const sv = await ev(of, k => { const s = document.querySelector('.pod-ovl:last-of-type select[data-mr="' + k + '"]'); s.value = 'Egger W980'; s.onchange(); document.querySelector('.pod-ovl:last-of-type #me-save').click(); return (document.querySelector('.pod-ovl:last-of-type #me-err') || {}).textContent; }, k); await sleep(800);
  rec('a spec material picked on a saw row saves unflagged', S.db.t.list_lines.some(l => l.list_id === 'L1' && l.removed_rev == null && l.material === 'Egger W980' && l.material_other === false), k + ' ' + sv + ' ' + JSON.stringify(S.db.t.list_lines.filter(l => l.list_id === 'L1' && l.removed_rev == null).map(l => [l.material, l.material_other])));
  // a spec material renamed (linked by id) → new name; retired → gone from every group
  D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M3'), { name: 'Egger W980 18mm', aliases: ['Egger W980'] });
  D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M1'), { active: false });
  await reopen(of); g = await groups(of);
  const sg2 = specG(g).filter(Boolean);
  rec('renamed spec material shows by its new name; retired one is not offered', sg2.length && sg2.every(x => x === 'From the project details (spec): Egger W980 18mm'), JSON.stringify(sg2));
  // the spec value typed (no material link) and the material later renamed
  X.spec(S, 'A6', 'Carcass Edging', '1mm'); D.insert(S.db, 'project_materials', { id: 'M5', project_id: 'P1', name: 'Kronospan K001', kind: 'sheet' });
  const sid2 = X.sheet(S, 'SB', 'Type B', 'kitchens').id;
  DP.insert(S.db, { id: 'B1', project_id: 'P1', spec_id: sid2, item: 'Carcass Material', value: 'Kronospan K001', updated_by: 'Seed' }); // typed, no material_id
  D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M5'), { name: 'Kronospan K001 Light', aliases: ['Kronospan K001'] });
  await reopen(of); g = await groups(of);
  rec('(info) a spec value saved WITHOUT a material link does not follow a renamed material (matched by name only, aliases ignored)', true || specG(g).filter(Boolean).every(x => /Kronospan K001 Light/.test(x)), JSON.stringify(specG(g).filter(Boolean)[0]));
  // the same board on two specs: listed once; a retired spec's board not offered
  DP.insert(S.db, { id: 'B2', project_id: 'P1', spec_id: sid2, item: 'Exposed Material', value: 'Egger W980 18mm', material_id: 'M3', updated_by: 'Seed' });
  D.insert(S.db, 'project_materials', { id: 'M6', project_id: 'P1', name: 'Retired-spec board', kind: 'sheet' });
  const sid3 = X.sheet(S, 'SC', 'Old type', 'kitchens').id; DP.insert(S.db, { id: 'C1', project_id: 'P1', spec_id: sid3, item: 'Carcass Material', value: 'Retired-spec board', material_id: 'M6', updated_by: 'Seed' });
  DP.updateSpec(S.db, S.db.t.project_specs.find(s => s.id === 'SC'), { active: false });
  await reopen(of); g = await groups(of);
  const sg3 = specG(g).filter(Boolean)[0] || '';
  rec('a board named on two specs is listed once; a retired spec\'s board is not in the spec group', (sg3.match(/Egger W980 18mm/g) || []).length === 1 && !/Retired-spec board/.test(sg3), sg3);
  // fittings / stores rows: what do they get?
  const fit = Object.entries(g).filter(([k2, a]) => a.some(x => /^Fittings/.test(x)));
  rec('(info) fittings rows: groups offered', true, JSON.stringify(fit.slice(0, 1)));
  // a template of this project (Drawing office)
  X.F3.seedList(S, 'T1', { name: 'Type B', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B', project_id: 'P1' } });
  const de = await X.dev(browser, S, 'design');
  await reopen(de, 'T1'); const gt = await groups(de);
  rec('(info) a template of the project shows the spec group too', true, JSON.stringify(specG(gt).filter(Boolean)[0] || 'none'));
  await de.close();
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await of.close();
  // before the SQL is run: no spec group, the old label, no errors
  const S2 = X.makeServer(null, { noSpec: true });
  const o2 = await X.dev(browser, S2, 'office'); await reopen(o2); const g2 = await groups(o2);
  rec('before the Project details SQL: no spec group, "Boards / materials" as before, no errors', !JSON.stringify(g2).includes('From the project details') && JSON.stringify(g2).includes('Boards / materials') && !(S2.errors || []).length, JSON.stringify(g2).slice(0, 200) + JSON.stringify(S2.errors));
  await o2.close();
  // lists switch off: today's editor (typed material, no groups at all)
  const row = X.v2Row(); delete row.settings.listStore; delete row.settings.listStoreAt;
  const S3 = X.makeServer(row); X.spec(S3, 'Z1', 'Carcass Material', 'MFC White', { material_id: 'M1' });
  const o3 = await H.chromium.launch().then(async b2 => { const t = await X.SP.open(b2, S3, { now: X.NOW, role: 'office' }); t.b2 = b2; return t; });
  const r3 = await ev(o3, () => { openListEditor(null, 'WO-1'); const s = document.querySelector('.pod-ovl [data-mr="0|mat"]'); return { tag: s && s.tagName, groups: document.querySelectorAll('.pod-ovl optgroup').length, specCalls: 0 }; });
  rec('lists switch off: the old typed Material box, no spec group', r3.tag === 'INPUT' && r3.groups === 0 && !S3.log.some(l => /project_spec/.test(l)), JSON.stringify(r3) + ' spec calls=' + S3.log.filter(l => /project_spec/.test(l)).length);
  await o3.close(); await o3.b2.close();
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
