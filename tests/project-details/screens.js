// Screenshots of the new screens for Garry, made with the FAKE database (nothing live).
// Run: node tests/project-details/screens.js   → docs/screens-project-details/*.png
const path = require('path');
const X = require('./fixp.js');
const { H, D, DP, sleep } = X;
const OUT = path.join(__dirname, '../../docs/screens-project-details');
const ev = (t, f, a) => t.page.evaluate(f, a);
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  D.insert(S.db, 'project_materials', { id: 'M7', project_id: 'P1', name: '18mm MFC EG H1146 Grey Bardolino Oak', kind: 'sheet' });
  D.insert(S.db, 'project_materials', { id: 'M8', project_id: 'P1', name: 'Egger W1000 White worktop 38mm', kind: 'sheet' });
  X.sheet(S, 'SPD:P1', 'Kitchens'); X.sheet(S, 'SSR', 'Robes', 'robes');
  const k = (id, item, value, sign, extra) => { const r = X.spec(S, id, item, value, extra); if (sign) DP.update(S.db, r, { status: 'signed-off', signed_by: sign, updated_by: sign }); };
  k('K1', 'Carcass Material', '18mm MFC EG H1146 Grey Bardolino Oak', 'Mary Burke', { material_id: 'M7' });
  k('K2', 'Carcass Edging', 'L4S 1mm', 'Mary Burke'); k('K3', 'Exposed Material', 'MFC White', 'Mary Burke', { material_id: 'M1' });
  k('K4', 'Plinth on/Built in', 'Built in', 'Mary Burke'); k('K5', 'Door and Drawer Detail', 'Gola Profile', 'Mary Burke');
  k('K6', 'Hinges', 'Hettich Stock'); k('K7', 'Handles', 'TBC'); k('K8', 'Worktop Colour', 'Egger W1000 White worktop 38mm', null, { material_id: 'M8' });
  k('K9', 'Drawer Construction', 'Hettich Dowel Fix 105 (Made Doors)', 'Mary Burke'); k('K10', 'Other Information', 'Type B houses: island in Exposed Material. Utility as Robes spec.');
  k('R1', 'Carcass Material', 'MFC White', 'Mary Burke', { spec_id: 'SSR', material_id: 'M1' }); k('R2', 'Door Type (hinged/sliding)', 'Sliding', null, { spec_id: 'SSR' });
  const shot = async (t, name, sel) => { await sleep(300); const el = sel ? await t.page.$(sel) : null; await (el || t.page).screenshot({ path: path.join(OUT, name + '.png') }); console.log('made ' + name); };
  const big = { viewport: { width: 1320, height: 900 } }, phone = { viewport: { width: 360, height: 760 } };
  // 1 Project details (PM)
  const pm = await X.dev(browser, S, 'pm', big);
  await ev(pm, () => { pmTab = 'projects'; render(); }); await shot(pm, '5-pm-projects-tab');
  await ev(pm, () => lsSpecDlg('P1')); await shot(pm, '1-project-details', '.pod-in');
  await pm.close();
  // 2 list window + 3 lists page (office)
  const of = await X.dev(browser, S, 'office', big);
  await ev(of, () => showTab('l')); await shot(of, '3-cutting-lists-page');
  await ev(of, () => document.querySelector('[data-lhedit="L1"]').click()); await sleep(500);
  await ev(of, () => { const i = document.querySelector('[data-woe="title"]'); i.value = 'HOUSE 12 TYPE B (corrected)'; i.onchange(); }); await sleep(200);
  await shot(of, '2-list-window', '.pod-in');
  await ev(of, () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('x'); }); await shot(of, '6-export-changes-job-details', '#pov-panel');
  await of.close();
  // 4 saw card
  const saw = await X.dev(browser, S, 'saw', big); await shot(saw, '4-saw-card', '.wl-card'); await saw.close();
  // phone
  const ph = await X.dev(browser, S, 'pm', phone);
  await ev(ph, () => lsSpecDlg('P1')); await shot(ph, '7-phone-project-details');
  await ev(ph, () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg('P1'); }); await shot(ph, '8-phone-materials');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
