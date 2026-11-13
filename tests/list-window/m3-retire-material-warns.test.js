// Bug M3 (Garry's bug check, 13 Nov): retiring a material that lists use (Active unticked), or switching it Sheet <-> Fitting,
// happened with no notice — rows using it just turned amber. Now the Materials window says "used on N lists / templates" and
// asks first; Cancel saves nothing. A row that already uses it keeps showing it (flagged). An unused material asks nothing.
// Fake Supabase only. Run: node tests/list-window/m3-retire-material-warns.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks } = L;
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const asked = p => p.evaluate(() => { const a = window.__asked.join('\n---\n'); window.__asked = []; return a; });
const mmsg = p => p.evaluate(() => (document.getElementById('mt-msg') || {}).textContent || '');
const mat = (S, id) => S.db.t.project_materials.find(m => m.id === id);
const box = (p, item) => p.evaluate(item => { const tr = [...document.querySelectorAll('.me-ed [data-row]')].find(t => { const e = t.querySelector('[data-mr$="|item"]'); return e && e.value === item; });
  const s = tr && tr.querySelector('[data-mr$="|mat"]'); return s ? { v: s.value, txt: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : '' } : null; }, item);
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });
    X.F3.seedList(S, 'L9', { wos: ['WO-2'], name: 'Old one', list: { archived: true } }); // archived: not counted
    D.insert(S.db, 'project_materials', { id: 'M5', project_id: 'P1', name: 'Spare board', kind: 'sheet' });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__asked = []; lsMaterialsDlg('P1'); });
    await sleep(400);
    // 1. Sheet -> Fitting on a material in use: asks, Cancel saves nothing
    await p.evaluate(() => { window.__confirm = false; });
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-mtk="M1"]').value = 'other'; });
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    let q = await asked(p);
    rec('Sheet → Fitting on a material in use asks first', /Change "MFC White" from Sheet \(saw\) to Fitting \/ other/.test(q), q);
    rec('… and says where it is used: 1 list and 1 template (the archived list is not counted)', /used on 1 list and 1 template/.test(q), q);
    rec('Cancel → nothing saved (still a sheet)', mat(S, 'M1').kind === 'sheet' && /Not saved/.test(await mmsg(p)), JSON.stringify([mat(S, 'M1').kind, await mmsg(p)]));
    // 2. OK saves it; a sized row using it still shows it, flagged
    await p.evaluate(() => { window.__confirm = true; });
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    q = await asked(p);
    rec('OK → saved as a fitting', mat(S, 'M1').kind === 'other' && /used on 1 list and 1 template/.test(q), JSON.stringify([mat(S, 'M1').kind, q]));
    await closeAll(p);
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    const b1 = await box(p, 'Side');
    rec('a saw row (with sizes) that uses it keeps showing "MFC White", flagged as a fitting', b1 && b1.v === 'MFC White' && /⚠/.test(b1.txt) && /fitting/.test(b1.txt), JSON.stringify(b1));
    await closeAll(p);
    // 3. retiring a material in use: asks; OK retires; the row keeps showing it, flagged
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; lsMaterialsDlg('P1'); }); await sleep(400);
    await type(p, '[data-mtv="M2"]', false);
    await press(p, '[data-mts="M2"]'); await sleep(1200);
    q = await asked(p);
    rec('retiring a material in use asks first, naming it and where it is used', /Retire "Blum hinge"\?/.test(q) && /used on 1 list and 1 template/.test(q), q);
    rec('OK → retired (never deleted)', mat(S, 'M2') && mat(S, 'M2').active === false);
    await closeAll(p);
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    const b2 = await box(p, 'Hinge');
    rec('a Stores row that uses the retired material keeps showing it, "⚠ … not on the project list"', b2 && b2.v === 'Blum hinge' && /not on the project list/.test(b2.txt), JSON.stringify(b2));
    await closeAll(p);
    // 4. retiring an unused material asks nothing
    await p.evaluate(() => { window.__asked = []; lsMaterialsDlg('P1'); }); await sleep(400);
    await type(p, '[data-mtv="M5"]', false);
    await press(p, '[data-mts="M5"]'); await sleep(1200);
    q = await asked(p);
    rec('retiring a material no list uses asks nothing and saves', q === '' && mat(S, 'M5').active === false, JSON.stringify([q, mat(S, 'M5').active]));
    // 5. a plain rename asks nothing (no retire, no kind change)
    await type(p, '[data-mtn="M5"]', 'Spare board 2');
    await press(p, '[data-mts="M5"]'); await sleep(1200);
    rec('a rename alone asks nothing', (await asked(p)) === '' && mat(S, 'M5').name === 'Spare board 2');
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
