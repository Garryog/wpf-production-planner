// Bug M4 (Garry's bug check, 13 Nov): "＋ Add new material…" typed with the name of an existing FITTING on a row that has a
// length or width said "already on the project list — picked" but the box stayed empty. Now it says plainly that it is a
// fitting and can't go on a row with sizes, and the row keeps the material it had. On a Stores row (no sizes) it is picked.
// Fake Supabase only. Run: node tests/list-window/m4-add-fitting-on-sized-row.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, toasts } = L;
const idx = async (p, item) => (await rows(p)).findIndex(r => r.item === item);
const clearToast = p => p.evaluate(() => document.querySelectorAll('.toast,#toast').forEach(t => { t.textContent = ''; }));
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    const nMat = S.db.t.project_materials.length;
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    // 1. a saw row (sizes) + "Add new material" with the name of a fitting
    let i = await idx(p, 'Side');
    await clearToast(p);
    await p.evaluate(() => { window.__prompt = 'blum HINGE'; });
    await setv(p, i + '|mat', '__add'); await sleep(900);
    let tt = await toasts(p), r = (await rows(p))[i];
    rec('fitting typed on a row with sizes → says it is a fitting and can\'t go on that row', /is a fitting/.test(tt) && /length or width/.test(tt), tt);
    rec('… it does NOT say "already on the project list — picked"', !/already on the project list/.test(tt), tt);
    rec('… the row keeps its material (MFC White), the box is not left empty', r && r.mat === 'MFC White', JSON.stringify(r));
    rec('… no material added or changed in the database', S.db.t.project_materials.length === nMat && S.db.t.project_materials.find(m => m.id === 'M2').kind === 'other');
    // 2. a Stores row (no sizes): the fitting is picked
    i = await idx(p, 'Tap');
    await clearToast(p);
    await setv(p, i + '|mat', '__add'); await sleep(900);
    tt = await toasts(p); r = (await rows(p))[i];
    rec('the same fitting on a Stores row (no sizes) is picked', r && r.mat === 'Blum hinge' && /already on the project list — picked/.test(tt), JSON.stringify([r, tt]));
    // 3. a sheet typed on a saw row is still picked as before
    i = await idx(p, 'Side');
    await p.evaluate(() => { window.__prompt = 'mfc white'; });
    await setv(p, i + '|mat', '__add'); await sleep(900);
    r = (await rows(p))[i];
    rec('a board typed on a saw row is still picked', r && r.mat === 'MFC White', JSON.stringify(r));
    await closeAll(p);
    // 4. a RETIRED fitting typed on a saw row: not brought back, same plain message
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M2'), { active: false });
    await p.evaluate(async () => { lsReset(); await lsLoad(); openListEditor('L1'); }); await sleep(900);
    i = await idx(p, 'Side');
    await clearToast(p);
    await p.evaluate(() => { window.__prompt = 'Blum hinge'; });
    await setv(p, i + '|mat', '__add'); await sleep(1200);
    tt = await toasts(p); r = (await rows(p))[i];
    rec('a retired fitting typed on a saw row: plain message, not brought back, row unchanged', /is a fitting/.test(tt) && S.db.t.project_materials.find(m => m.id === 'M2').active === false && r && r.mat === 'MFC White', JSON.stringify([tt, r]));
    // 5. (Tester round 4 B3) the retired fitting typed on a Stores row: asked first; Cancel leaves it retired and the row unchanged
    i = await idx(p, 'Tap');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
    await setv(p, i + '|mat', '__add'); await sleep(1200);
    let q5 = await p.evaluate(() => window.__asked.join('|')); r = (await rows(p))[i];
    rec('a retired fitting on a Stores row: asked "bring it back?" first', /was retired/.test(q5) && /Bring it back/.test(q5), q5);
    rec('… Cancel: stays retired, the row keeps its material', S.db.t.project_materials.find(m => m.id === 'M2').active === false && r && r.mat === 'Chrome mixer', JSON.stringify(r));
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; });
    await setv(p, i + '|mat', '__add'); await sleep(1200);
    r = (await rows(p))[i];
    rec('… OK: brought back and picked', S.db.t.project_materials.find(m => m.id === 'M2').active === true && r && r.mat === 'Blum hinge', JSON.stringify(r));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
