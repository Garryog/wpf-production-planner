// Tester attack ROUND 4 (13 Nov) on bug fix M4 ("＋ Add new material…" with an existing fitting's name on a sized row) plus
// regressions around M1–M4: odd case / spaces / an other spelling of a fitting on a sized row; a board on a Stores row; a
// retired fitting on a Stores row; saw / stores screens cannot change materials; the lists feature switched OFF; the old
// screen (code before M1) and the new one on the same project after a rename.
// Fake Supabase only. Run: node tests/list-window/attack4-addmat-roles.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err, toasts } = L;
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const idx = async (p, item) => (await rows(p)).findIndex(r => r.item === item);
const clearToast = p => p.evaluate(() => document.querySelectorAll('.toast,#toast').forEach(t => { t.textContent = ''; }));
const mat = (S, id) => S.db.t.project_materials.find(m => m.id === id);

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    D.update(S.db, 'project_materials', mat(S, 'M2'), { aliases: ['BH-35'] });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    const n0 = S.db.t.project_materials.length;
    await p.evaluate(() => openListEditor('L1')); await sleep(900);

    // ---- F1. fitting name with odd case + spaces on a sized row ----
    let i = await idx(p, 'Side'); await clearToast(p);
    await p.evaluate(() => { window.__prompt = '   BLUM    hinge  '; });
    await setv(p, i + '|mat', '__add'); await sleep(900);
    let tt = await toasts(p), r = (await rows(p))[i];
    rec('F1: "  BLUM  hinge " on a sized row → "is a fitting" message, row keeps MFC White', /is a fitting/.test(tt) && r.mat === 'MFC White', JSON.stringify([tt, r.mat]));
    // ---- F2. an other spelling of a fitting on a sized row ----
    await clearToast(p); await p.evaluate(() => { window.__prompt = 'bh-35'; });
    await setv(p, i + '|mat', '__add'); await sleep(900);
    tt = await toasts(p); r = (await rows(p))[i];
    rec('F2: a fitting\'s other spelling on a sized row → message names the fitting, row unchanged', /"Blum hinge" is a fitting/.test(tt) && r.mat === 'MFC White', JSON.stringify([tt, r.mat]));
    // ---- F3. a sized row with NO material yet + a fitting name → box stays empty, no row of junk ----
    i = await idx(p, 'Side');
    await setv(p, i + '|mat', ''); await sleep(200);
    await clearToast(p); await p.evaluate(() => { window.__prompt = 'Blum hinge'; });
    await setv(p, i + '|mat', '__add'); await sleep(900);
    r = (await rows(p))[i];
    rec('F3: empty sized row + a fitting name → message, box left empty (not "__add", not the fitting)', r.mat === '' && /is a fitting/.test(await toasts(p)), JSON.stringify(r));
    await setv(p, i + '|mat', 'MFC White'); await sleep(200);
    // ---- F4. a BOARD name on a Stores row → picked ----
    i = await idx(p, 'Tap'); await clearToast(p);
    await p.evaluate(() => { window.__prompt = 'mfc white '; });
    await setv(p, i + '|mat', '__add'); await sleep(900);
    r = (await rows(p))[i];
    rec('F4: a board name on a Stores row is picked ("MFC White")', r.mat === 'MFC White', JSON.stringify([r, await toasts(p)]));
    rec('F1–F4: nothing added or changed in the materials table', S.db.t.project_materials.length === n0 && mat(S, 'M2').kind === 'other' && mat(S, 'M2').active !== false);
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---- F5. a RETIRED fitting typed on a Stores row: what happens? ----
    D.update(S.db, 'project_materials', mat(S, 'M2'), { active: false });
    await p.evaluate(async () => { lsReset(); await lsLoad(); window.__asked = []; openListEditor('L1'); }); await sleep(900);
    i = await idx(p, 'Tap'); await clearToast(p);
    await p.evaluate(() => { window.__prompt = 'Blum hinge'; window.__asked = []; });
    await setv(p, i + '|mat', '__add'); await sleep(1200);
    r = (await rows(p))[i];
    const asked5 = await p.evaluate(() => window.__asked.join('|'));
    rec('F5 set-up: the retired fitting is picked on the Stores row', r.mat === 'Blum hinge', JSON.stringify(r));
    rec('(info) F5: … the retired fitting is brought back (Active) by typing its name in a list — no question, no count of where it is used', mat(S, 'M2').active === false || asked5 !== '', JSON.stringify([mat(S, 'M2').active, asked5]));
    await closeAll(p);
    D.update(S.db, 'project_materials', mat(S, 'M2'), { active: true });

    // ---- F6. saw / stores screens cannot change materials (and are not asked about "unsaved" typing they could never save) ----
    for (const role of ['saw', 'stores']) {
      const s = await X.dev(browser, S, role), ps = s.page; await asks(ps);
      await ps.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__asked = []; window.__confirm = true; });
      const ok = await ps.evaluate(() => { try { lsMaterialsDlg('P1'); return 'ok'; } catch (e) { return e.message; } }); await sleep(400);
      const v1 = mat(S, 'M1').version, m0 = S.db.t.project_materials.length;
      await type(ps, '[data-mtn="M1"]', 'Hacked'); await type(ps, '[data-mtv="M1"]', false);
      await press(ps, '[data-mts="M1"]'); await sleep(1200);
      await type(ps, '#mt-new-n', 'Hacked 2'); await press(ps, '#mt-add'); await sleep(1200);
      const q = await ps.evaluate(() => window.__asked.join('|'));
      rec('F6 ' + role + ': Materials Save / ＋ Add write nothing', mat(S, 'M1').version === v1 && mat(S, 'M1').name === 'MFC White' && S.db.t.project_materials.length === m0, ok);
      rec('F6 ' + role + ': no "Retire …? used on N lists" question shown to a screen that cannot save it', !/Retire/.test(q), q);
      await s.close();
    }
    // PM: allowed before (MAT_ED) — still allowed
    const pm = await X.dev(browser, S, 'pm'), pp = pm.page; await asks(pp);
    await pp.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__confirm = true; lsMaterialsDlg('P1'); }); await sleep(400);
    await type(pp, '[data-mta="M1"]', 'PMW'); await press(pp, '[data-mts="M1"]'); await sleep(1200);
    rec('F6 pm: the PM can still edit materials (as before M1–M4)', (mat(S, 'M1').aliases || []).includes('PMW'), JSON.stringify(mat(S, 'M1').aliases));
    await pm.close();

    // ---- F7. the lists feature switched OFF ----
    const So = X.makeServer(X.v1Row());
    const o = await X.dev(browser, So, 'office'), po = o.page;
    await po.evaluate(() => { try { showTab('l'); } catch (e) {} render(); }); await sleep(500);
    const off = await po.evaluate(() => ({ v2: typeof V2 === 'function' ? V2() : null, mats: document.querySelectorAll('[data-lhmat],[data-pjm],#me-mats').length }));
    const calls = (So.log || []).filter(x => /project_materials|list_lines\?select=list_id/.test(x));
    rec('F7: switched OFF → no Materials buttons on screen and no materials / usage queries', off.v2 === false && off.mats === 0 && calls.length === 0, JSON.stringify([off, calls.slice(0, 3)]));
    await o.close();

    // ---- F8. old screen (code before M1) + new screen on the same project, after a rename ----
    const html = A.gitShow('a3aa102^');
    if (!html) rec('(info) F8: old code not readable with git show — skipped', true);
    else {
      const S8 = X.makeServer(X.v2Row(), { lines: [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass', status: 'cut', status_by: 'Saw' }],
        ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }]] });
      D.update(S8.db, 'lists', D.find(S8.db, 'lists', 'L1'), { locked: true, rev: 1 });
      const old = await A.openOld(browser, S8, html);
      await old.page.evaluate(async () => { localStorage.setItem('wpfPin_design', '9000'); setRole('design'); lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.confirm = () => true; openListEditor('L1'); });
      await sleep(900);
      const nw = await X.dev(browser, S8, 'design'), pn = nw.page; await asks(pn);
      // new screen: rename, then save the list with Top ×3
      await pn.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__confirm = true; lsMaterialsDlg('P1'); }); await sleep(400);
      await type(pn, '[data-mtn="M1"]', '18mm MFC White'); await press(pn, '[data-mts="M1"]'); await sleep(1200); await closeAll(pn);
      await pn.evaluate(async () => { lsReset(); await lsLoad(); openListEditor('L1'); }); await sleep(900);
      await setv(pn, (await idx(pn, 'Top')) + '|qty', '3'); await sleep(200); await save(pn, 2000); await closeAll(pn);
      // old screen (opened before): Hinge 9, save
      await setv(old.page, (await idx(old.page, 'Hinge')) + '|qty', '9'); await sleep(200); await save(old.page, 2500);
      const l8 = linesOf(S8, 'L1'), sd = l8.find(x => x.part === 'Side'), tp = l8.find(x => x.part === 'Top'), hg = l8.find(x => x.part === 'Hinge');
      rec('F8: old screen\'s Hinge ×9 saved', hg && hg.qty === '9', await err(old.page));
      rec('F8: new screen\'s Top ×3 kept', tp && tp.qty === '3', JSON.stringify(tp && [tp.qty, tp.material]));
      rec('F8: Side keeps its cut tick', sd && sd.status === 'cut', JSON.stringify(sd && [sd.status, sd.material, sd.changed_rev]));
      // the old screen opens it again: the current name is shown plainly (exact match), no warning on any row
      await old.page.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsReset(); await lsLoad(); openListEditor('L1'); }); await sleep(900);
      const warn = await old.page.evaluate(() => [...document.querySelectorAll('.me-ed [data-mr$="|mat"]')].filter(s => /not on the project list/.test((s.options[s.selectedIndex] || {}).textContent || '')).length);
      rec('(info) F8: old screen reopening the list shows ' + warn + ' row(s) as "not on the project list"', true);
      await old.close(); await nw.close();
      if ((S8.errors || []).length) rec('no page errors (F8 new screen)', false, JSON.stringify(S8.errors));
    }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
