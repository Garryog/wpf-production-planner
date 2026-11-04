// ATTACK 2 — screens: PIN gating (office vs templates / materials / projects), two offices editing the same project,
// material and list at once, copy-from with every material unmatched, free-typing a sheet material, nasty text in every
// name. Fake Supabase only. Run: node tests/stage3/attack2-screens.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const lines = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
// real Postgres has unique index pm_uq on project_materials(project_id, lower(name)) — the fake doesn't; add it here
const ins0 = D.insert;
D.insert = function (d, t, r) {
  if (t === 'project_materials' && d.t[t].some(x => x.project_id === r.project_id && String(x.name).trim().toLowerCase() === String(r.name).trim().toLowerCase())) throw new D.DbError('duplicate key value violates unique constraint "pm_uq"', '23505');
  return ins0.apply(this, arguments);
};
async function office(browser, S, pinAns) {
  const t = await F.dev(browser, S, 'office');
  await t.page.evaluate(a => { window.__p = []; window.prompt = (m, d) => { window.__p.push(m); return /PIN/.test(m) ? a : /reason|Why/.test(m) ? 'site measure' : 'Tester'; }; window.confirm = () => true; showTab('l'); }, pinAns);
  return t;
}
const pinAsked = p => p.evaluate(() => window.__p.filter(m => /PIN/.test(m)).length);
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row(); const S = F.makeServer(row);
  F.seedList(S, 'L1', { wos: ['WO-1'] });
  F.seedList(S, 'T1', { name: 'Kitchen B', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B' } });
  // ---------------- PIN gating: the office PIN must not open templates / materials / projects
  const off = await office(browser, S, '2468'); // office PIN typed at the prompt
  await off.page.evaluate(() => { lsMaterialsDlg('P1'); document.getElementById('mt-new-n').value = 'Sneaky board'; document.getElementById('mt-add').click(); });
  await F.sleep(300);
  rec('G1 office PIN cannot add a project material', !S.db.t.project_materials.some(m => m.name === 'Sneaky board') && (await pinAsked(off.page)) === 1);
  await off.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  await off.page.evaluate(() => { lsProjectsDlg(); document.querySelector('[data-pjn="P1"]').value = 'Renamed by office'; document.querySelector('[data-pjs="P1"]').click(); });
  await F.sleep(300);
  rec('G2 office PIN cannot rename a project', D.find(S.db, 'projects', 'P1').name === 'Aderrig');
  await off.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  await off.page.evaluate(() => openListEditor('T1'));
  rec('G3 office PIN cannot open a template for editing', !(await off.page.evaluate(() => !!document.querySelector('.pod-ovl'))));
  await off.page.evaluate(() => lsCopyDlg('P1'));
  rec('G4 office PIN cannot copy from another project', !(await off.page.evaluate(() => !!document.querySelector('.pod-ovl'))));
  // Archive a template from Lists home (Templates filter) — no PIN?
  const n0 = await pinAsked(off.page);
  await off.page.evaluate(() => { LH.proj = 'P1'; LH.kind = 'tpl'; render(); const b = document.querySelector('[data-lharc="T1"]'); if (b) b.click(); });
  await F.send(off.page); await F.sleep(200);
  rec('G5 office cannot archive a TEMPLATE without a Production Manager / Design / Admin PIN', !D.find(S.db, 'lists', 'T1').archived, 'archived=' + D.find(S.db, 'lists', 'T1').archived + ' PIN prompts=' + ((await pinAsked(off.page)) - n0));
  D.update(S.db, 'lists', D.find(S.db, 'lists', 'T1'), { archived: false });
  // 'Send to saw' button on a template? (should never be offered) and Excel import with a sheet named like the template
  await off.page.evaluate(async () => { await lsPoll(); LH.kind = 'tpl'; render(); });
  rec('G6 no "Send to saw" on a template', !(await off.page.evaluate(() => !!document.querySelector('[data-lhsend="T1"]'))));
  // the right PIN once, then remembered on this device; changing the Design PIN in Settings revokes it
  const off2 = await office(browser, S, '8888');
  await off2.page.evaluate(() => { lsMaterialsDlg('P1'); document.getElementById('mt-new-n').value = 'MFC Oak'; document.getElementById('mt-add').click(); });
  await F.sleep(300);
  rec('G7 Design PIN once → material added and the PIN remembered', S.db.t.project_materials.some(m => m.name === 'MFC Oak') && (await off2.page.evaluate(() => localStorage.getItem('wpfEditPin'))) === '8888');
  await off2.page.evaluate(() => { DB.pins = Object.assign({}, DB.pins, { design: '1234' }); window.__p = []; });
  const ok2 = await off2.page.evaluate(() => { window.prompt = m => { window.__p.push(m); return null; }; return lsEditOk(); });
  rec('G8 after the Design PIN is changed, the remembered old PIN no longer works', ok2 === false && (await pinAsked(off2.page)) === 1);
  await off2.page.evaluate(() => { DB.pins = Object.assign({}, DB.pins, { design: '' }); localStorage.setItem('wpfEditPin', '8888'); });
  // ---------------- two offices at once (both with the right PIN)
  const a = await office(browser, S, '7777'), b = await office(browser, S, '7777');
  // same material name added on two PCs
  await Promise.all([a, b].map(t => t.page.evaluate(() => { lsMaterialsDlg('P1'); document.getElementById('mt-new-n').value = 'Birch ply'; })));
  await a.page.evaluate(() => document.getElementById('mt-add').click()); await F.sleep(300);
  await b.page.evaluate(() => document.getElementById('mt-add').click()); await F.sleep(300);
  const bm = await b.page.evaluate(() => (document.getElementById('mt-msg') || {}).textContent);
  rec('M1 same material added on two PCs: one row, the second PC is told', S.db.t.project_materials.filter(m => m.name === 'Birch ply').length === 1 && /already used/.test(bm), bm);
  // both rename the same material
  await Promise.all([a, b].map(t => t.page.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); await lsPoll(); lsMaterialsDlg('P1'); })));
  await a.page.evaluate(() => { document.querySelector('[data-mtn="M1"]').value = 'MFC White 18mm'; document.querySelector('[data-mts="M1"]').click(); }); await F.sleep(300);
  await b.page.evaluate(() => { document.querySelector('[data-mta="M1"]').value = 'White MFC'; document.querySelector('[data-mts="M1"]').click(); }); await F.sleep(300);
  const bm2 = await b.page.evaluate(() => (document.getElementById('mt-msg') || {}).textContent);
  rec('M2 two PCs edit the same material: the second is refused and shown the new version (no silent overwrite)', D.find(S.db, 'project_materials', 'M1').name === 'MFC White 18mm' && /changed on another screen/.test(bm2), bm2);
  // both rename the same project
  await Promise.all([a, b].map(t => t.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsProjectsDlg(); })));
  await a.page.evaluate(() => { document.querySelector('[data-pjo="P1"]').value = 'Ciara'; document.querySelector('[data-pjs="P1"]').click(); }); await F.sleep(300);
  await b.page.evaluate(() => { document.querySelector('[data-pjc="P1"]').value = 'Aderrig Homes Ltd'; document.querySelector('[data-pjs="P1"]').click(); }); await F.sleep(300);
  rec('P1 two PCs edit the same project: the second is refused, the first kept', D.find(S.db, 'projects', 'P1').list_owner === 'Ciara' && D.find(S.db, 'projects', 'P1').customer !== 'Aderrig Homes Ltd');
  // rename a material to a name already used (case / spaces differ)
  await a.page.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); await lsPoll(); lsMaterialsDlg('P1'); document.querySelector('[data-mtn="M2"]').value = '  birch PLY '; document.querySelector('[data-mts="M2"]').click(); });
  await F.sleep(300);
  rec('M3 renaming a material to an existing name (other case/spaces) is refused', D.find(S.db, 'project_materials', 'M2').name === 'Blum hinge');
  // two offices edit the SAME list: A changes Top's quantity, B (opened before A saved) adds a row and saves
  await Promise.all([a, b].map(t => t.page.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); await lsPoll(); openListEditor('L1'); })));
  await a.page.evaluate(() => { const o = document.querySelector('.pod-ovl'), e = o.querySelector('[data-mr="2|qty"]'); e.value = '3'; e.oninput(); o.querySelector('#me-save').click(); });
  await F.sleep(600);
  const topA = F.line(S, 'L1:3').qty;
  await b.page.evaluate(() => { window.__conf = []; window.confirm = m => { window.__conf.push(m); return true; }; const o = document.querySelector('.pod-ovl'); o.querySelector('#me-addsaw').click(); const o2 = document.querySelector('.pod-ovl');
    const s = (k, v) => { const e = o2.querySelector('[data-mr="' + k + '"]'); e.value = v; (e.oninput || e.onchange)(); };
    s('4|item', 'Shelf'); s('4|qty', '2'); s('4|L', '500'); s('4|W', '300'); s('4|mat', 'MFC White 18mm'); o2.querySelector('#me-save').click(); });
  await F.sleep(800);
  const ls1 = lines(S, 'L1');
  rec('E1 two offices on one list: B (who never touched Top) saves after A changed Top 1→3 — Top must stay 3, Shelf added',
    topA === '3' && (ls1.find(x => x.part === 'Top') || {}).qty === '3' && ls1.some(x => x.part === 'Shelf'), 'A saved Top=' + topA + ' → after B: Top=' + (ls1.find(x => x.part === 'Top') || {}).qty + ' parts=' + ls1.map(x => x.part + '×' + x.qty).join(',') + ' | B was asked: ' + JSON.stringify(await b.page.evaluate(() => window.__conf.join(' // '))));
  // ---------------- free typing a sheet material
  const ft = await a.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); openListEditor(null, 'WO-2', 'P1'); const o = document.querySelector('.pod-ovl');
    const m = o.querySelector('[data-mr="0|mat"]'); const tag = m.tagName; m.value = 'Typed board'; const v = m.value; return { tag, v, inputs: o.querySelectorAll('input[data-mr$="|mat"]').length }; });
  rec('F1 saw row material is a dropdown; a typed value can\'t be put in it', ft.tag === 'SELECT' && ft.v === '' && ft.inputs === 0, JSON.stringify(ft));
  // switch project after picking a board from another project's list → saved but flagged
  D.insert(S.db, 'projects', { id: 'P3', name: 'Crown' }); D.insert(S.db, 'project_materials', { id: 'M30', project_id: 'P3', name: 'Oak veneer', kind: 'sheet' });
  await a.page.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); await lsPoll(); openListEditor(null, 'WO-2', 'P3'); const o = document.querySelector('.pod-ovl');
    const s = (k, v) => { const e = o.querySelector('[data-mr="' + k + '"]'); e.value = v; (e.oninput || e.onchange)(); };
    s('0|item', 'Door'); s('0|qty', '1'); s('0|L', '700'); s('0|W', '400'); s('0|mat', 'Oak veneer');
    const p = o.querySelector('#me-pid'); p.value = 'P1'; p.onchange({ target: p }); o.querySelector('#me-name').value = 'Switched'; o.querySelector('#me-save').click(); });
  await F.sleep(700);
  const sw = S.db.t.lists.find(l => l.name === 'Switched'), swl = sw ? lines(S, sw.id)[0] : null;
  rec('F2 board picked on project Crown, then project switched to Aderrig: saved FLAGGED "not on project list"', !!swl && swl.material === 'Oak veneer' && swl.material_other === true, JSON.stringify(swl && { m: swl.material, flag: swl.material_other }));
  // ---------------- copy-from with every material unmatched
  D.insert(S.db, 'projects', { id: 'P4', name: 'Empty proj' });
  F.seedList(S, 'T4', { name: 'Robe', wos: [], list: { project_id: 'P3', is_template: true, list_type: 'room', type_name: 'Robe' }, lines: [['saw', 'Side', '2', 2200, 600, 'Oak veneer', '', ''], ['saw', 'Shelf', '3', 900, 560, 'Walnut', '', ''], ['saw', 'Back', '1', 900, 2200, 'HDF 3mm', '', ''], ['fit', 'Rail', '1', null, null, 'Hanging rail', '', '']] });
  await a.page.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); await lsPoll(); lsCopyDlg('P1'); document.querySelector('[data-cpp="P3"]').click(); });
  await F.sleep(200); await a.page.evaluate(() => document.querySelector('[data-cpl="T4"]').click()); await F.sleep(500);
  const names = await a.page.evaluate(() => [...document.querySelectorAll('.pod-ovl tbody b')].map(b => b.textContent).join('|'));
  rec('K1 every board unmatched: all 3 listed for matching', names === 'Oak veneer|Walnut|HDF 3mm', names);
  // match one, add one that ALREADY exists on P1 as a fitting ('Blum hinge' style clash), add one new
  D.insert(S.db, 'project_materials', { id: 'M5', project_id: 'P1', name: 'HDF 3mm', kind: 'other' });
  await a.page.evaluate(async () => { await lsPoll(); });
  await a.page.evaluate(() => { const s = (i, v) => { document.querySelector('[data-mm="' + i + '"]').value = v; }; s(0, '__add'); s(1, 'M1'); s(2, '__add'); document.getElementById('mm-ok').click(); });
  await F.sleep(700);
  const st1 = await a.page.evaluate(() => ({ open: !!document.getElementById('mm-ok'), toast: document.getElementById('toast').textContent }));
  // try again exactly as a user would (same choices)
  await a.page.evaluate(() => { const b = document.getElementById('mm-ok'); if (b) b.click(); });
  await F.sleep(700);
  const st2 = await a.page.evaluate(() => ({ open: !!document.getElementById('mm-ok'), toast: document.getElementById('toast').textContent }));
  const cp = S.db.t.lists.find(l => l.project_id === 'P1' && l.name === 'Robe' && l.is_template);
  rec('K2 a board name that exists on this project as a FITTING can be resolved: the copy can still be completed', !!cp, '1st: ' + JSON.stringify(st1) + ' 2nd: ' + JSON.stringify(st2) + ' Oak veneer on P1=' + S.db.t.project_materials.some(m => m.project_id === 'P1' && m.name === 'Oak veneer'));
  await a.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  // destination with NO materials at all
  await a.page.evaluate(async () => { await lsPoll(); lsCopyDlg('P4'); document.querySelector('[data-cpp="P3"]').click(); });
  await F.sleep(200); await a.page.evaluate(() => document.querySelector('[data-cpl="T4"]').click()); await F.sleep(500);
  await a.page.evaluate(() => { document.querySelectorAll('[data-mm]').forEach(s => { s.value = '__add'; }); document.getElementById('mm-ok').click(); });
  await F.sleep(800);
  const cp4 = S.db.t.lists.find(l => l.project_id === 'P4' && l.is_template);
  rec('K3 copy into a project with no materials: add all → copied, boards on the new list, lines not flagged', !!cp4 && lines(S, cp4.id).filter(x => x.kind === 'saw').every(x => !x.material_other) && S.db.t.project_materials.filter(m => m.project_id === 'P4').length === 3);
  // ---------------- nasty names everywhere
  const NN = `O'Grady <img src=x onerror=window.__x=1> "Q" & 😀`;
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { name: NN + ' proj', customer: 'Aderrig Homes', list_owner: NN });
  D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M1'), { name: NN + ' board' });
  D.update(S.db, 'lists', D.find(S.db, 'lists', 'T1'), { name: NN + ' tpl', type_name: NN + ' type' });
  D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { name: NN + ' list' });
  const nasty = await a.page.evaluate(async () => {
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); await lsPoll(); LH.proj = ''; LH.kind = 'all'; render();
    const out = {}; const t = () => document.body.innerText;
    out.home = t().includes(`O'Grady <img`); lsMaterialsDlg(LST.p.has('P1') ? 'P1' : ''); out.mat = document.querySelector('[data-mtn="M1"]').value.startsWith(`O'Grady <img`);
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsProjectsDlg(); out.proj = document.querySelector('[data-pjn="P1"]').value.startsWith(`O'Grady <img`);
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); openListEditor('L1'); const sel = document.querySelector('.pod-ovl [data-mr="0|mat"]'); out.ed = !!sel && [...sel.options].some(o => o.value.startsWith(`O'Grady <img`) && o.textContent.startsWith(`O'Grady <img`)); out.edFlag = sel && sel.selectedOptions[0].textContent;
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); return { ...out, x: window.__x || 0 };
  });
  rec('H1 apostrophes / HTML / emoji in project, owner, material, template and list names: shown as text everywhere, nothing runs', nasty.x === 0 && nasty.home && nasty.mat && nasty.proj && nasty.ed, JSON.stringify(nasty));
  D.listSetDone(S.db, 'L1', 'check', true, 'Des', null, null); // (4 Nov) L1 was edited above, so the saw only has it once it is checked again
  const sw2 = await F.dev(browser, S, 'saw');
  const sx = await sw2.page.evaluate(() => ({ x: window.__x || 0, t: document.body.innerText.includes(`O'Grady <img`) }));
  rec('H2 saw screen (card + waiting strip owner) with the nasty names: text only', sx.x === 0 && sx.t, JSON.stringify(sx));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 400));
  for (const t of [off, off2, a, b, sw2]) await t.close();
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
