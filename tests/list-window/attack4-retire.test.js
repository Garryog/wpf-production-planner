// Tester attack ROUND 4 (13 Nov) on bug fix M3 — retiring a material (Active unticked) or switching it Sheet <-> Fitting says
// how many lists / templates use it and asks first. Attacks: the counts (done lists counted, archived not, templates, other
// spellings and odd case/spaces, removed lines not counted, more than 1,000 lines); Cancel saves nothing AND keeps the typing;
// the count query failing; retire then un-retire; a material retired on another PC while a list using it is open.
// Fake Supabase only. Run: node tests/list-window/attack4-retire.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err } = L;
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const val = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o && o.querySelector(sel); return e ? (e.type === 'checkbox' ? e.checked : e.value) : null; }, sel);
const asked = p => p.evaluate(() => { const a = (window.__asked || []).join('\n---\n'); window.__asked = []; return a; });
const mmsg = p => p.evaluate(() => (document.getElementById('mt-msg') || {}).textContent || '');
const mat = (S, id) => S.db.t.project_materials.find(m => m.id === id);
const setKind = (p, id, k) => p.evaluate(({ id, k }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-mtk="' + id + '"]').value = k; }, { id, k });
const box = (p, item) => p.evaluate(item => { const tr = [...document.querySelectorAll('.me-ed [data-row]')].find(t => { const e = t.querySelector('[data-mr$="|item"]'); return e && e.value === item; });
  const s = tr && tr.querySelector('[data-mr$="|mat"]'); return s ? { v: s.value, txt: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : '' } : null; }, item);
const S_LINE = (m, extra) => ['saw', 'Side', '2', 720, 560, m, '', '', extra];

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M1'), { aliases: ['W/W'] });
    X.F3.seedList(S, 'L2', { wos: ['WO-5'], name: 'Done (shipped)', lines: [S_LINE('MFC White', { status: 'cut' })] });         // done: counted
    X.F3.seedList(S, 'L3', { wos: ['WO-2'], name: 'Archived', list: { archived: true }, lines: [S_LINE('MFC White')] });          // archived: not counted
    X.F3.seedList(S, 'L4', { wos: ['WO-3'], name: 'Alias', lines: [S_LINE('w/w')] });                                             // other spelling, other case
    X.F3.seedList(S, 'L5', { wos: ['WO-4'], name: 'Removed', lines: [S_LINE('MFC White', { removed_rev: 1 }), ['fit', 'Tap', '1', null, null, 'Chrome', '', '']] }); // only a removed line: not counted
    X.F3.seedList(S, 'L6', { wos: ['WO-6'], name: 'Spaces', lines: [S_LINE('  mfc   WHITE ')] });                                  // odd spaces
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });       // template: counted
    X.F3.seedList(S, 'T2', { wos: [], name: 'Type 3 (archived)', list: { is_template: true, type_name: 'Type 3', archived: true } }); // archived template: not counted
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__asked = []; lsMaterialsDlg('P1'); }); await sleep(400);

    // ---- T1. counts ----
    await p.evaluate(() => { window.__confirm = false; });
    await type(p, '[data-mtv="M1"]', false); await type(p, '[data-mta="M1"]', 'W/W, WW2');
    await press(p, '[data-mts="M1"]'); await sleep(1500);
    let q = await asked(p);
    rec('T1: retiring MFC White asks', /Retire "MFC White"\?/.test(q), q);
    rec('T1: count = 4 lists (L1, done L2, alias L4, spaces L6) and 1 template — archived and removed-only not counted', /used on 4 lists and 1 template/.test(q), q);
    // ---- T2. Cancel saves nothing and keeps the typing ----
    rec('T2: Cancel → nothing saved', mat(S, 'M1').active !== false && JSON.stringify(mat(S, 'M1').aliases) === '["W/W"]', JSON.stringify(mat(S, 'M1')));
    rec('T2: Cancel → the window still shows what I typed (unticked, WW2)', (await val(p, '[data-mtv="M1"]')) === false && (await val(p, '[data-mta="M1"]')) === 'W/W, WW2');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await press(p, '#pod-x'); await sleep(200);
    rec('T2: … and Close still warns about it', /Close without saving/.test(await asked(p)));

    // ---- T3. the count query fails ----
    await p.route('**/list_lines?*', r => r.request().method() === 'GET' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }) : r.fallback());
    await p.evaluate(() => { window.__confirm = false; });
    await press(p, '[data-mts="M1"]'); await sleep(1500);
    q = await asked(p);
    rec('T3: count query fails → still asks, saying it could not check', /Retire "MFC White"\?/.test(q) && /could not check/.test(q), q);
    rec('T3: … Cancel → nothing saved', mat(S, 'M1').active !== false);
    await p.unroute('**/list_lines?*');

    // ---- T4. Sheet → Fitting together with retire: one question, OK saves both; then un-retire asks nothing ----
    await p.evaluate(() => { window.__confirm = true; });
    await press(p, '[data-mts="M1"]'); await sleep(1500);
    q = await asked(p);
    rec('T4: OK → retired', mat(S, 'M1').active === false && (mat(S, 'M1').aliases || []).includes('WW2'), JSON.stringify(mat(S, 'M1')));
    await type(p, '[data-mtv="M1"]', true); await press(p, '[data-mts="M1"]'); await sleep(1500);
    q = await asked(p);
    rec('T4: un-retire asks nothing and saves', q === '' && mat(S, 'M1').active === true, JSON.stringify([q, mat(S, 'M1').active]));
    await setKind(p, 'M1', 'other'); await type(p, '[data-mtv="M1"]', false);
    await p.evaluate(() => { window.__confirm = false; });
    await press(p, '[data-mts="M1"]'); await sleep(1500);
    q = await asked(p);
    rec('T4: retire + Sheet→Fitting at once → asked once', (q.match(/OK = save the change/g) || []).length === 1, q);
    rec('(low) T4: … the question mentions BOTH the retire and the switch to Fitting', /Retire/.test(q) && /Fitting/.test(q), q);
    rec('T4: Cancel → still a sheet, still active', mat(S, 'M1').kind === 'sheet' && mat(S, 'M1').active === true);
    await p.evaluate(() => { window.__confirm = true; window.__asked = []; }); await press(p, '#pod-x'); await sleep(200);
    await closeAll(p);

    // ---- T5. retired on another PC while a list using it is open here ----
    const S2 = X.makeServer(X.v2Row(), { lines: [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass', status: 'cut', status_by: 'Saw' }],
      ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }]] });
    D.update(S2.db, 'lists', D.find(S2.db, 'lists', 'L1'), { locked: true, rev: 1 });
    const a = await X.dev(browser, S2, 'design'), pa = a.page; await asks(pa);
    const b = await X.dev(browser, S2, 'design'), pb = b.page; await asks(pb);
    await pa.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__confirm = true; openListEditor('L1'); }); await sleep(900);
    await pb.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__confirm = true; lsMaterialsDlg('P1'); }); await sleep(400);
    await type(pb, '[data-mtv="M1"]', false); await type(pb, '[data-mtv="M2"]', false);
    await press(pb, '[data-mts="M1"]'); await sleep(1500); await press(pb, '[data-mts="M2"]'); await sleep(1500);
    rec('T5 set-up: PC B retired MFC White and Blum hinge', mat(S2, 'M1').active === false && mat(S2, 'M2').active === false, await mmsg(pb));
    await pa.evaluate(async () => { await lsPoll(); }); await sleep(300); // PC A's poll brings the retire in (the list window stays open)
    const ra = await rows(pa); await setv(pa, ra.findIndex(r => r.item === 'Top') + '|qty', '2'); await sleep(200);
    await pa.evaluate(() => { window.__asked = []; window.__confirm = true; }); await save(pa, 2500);
    const ls5 = linesOf(S2, 'L1'), sd = ls5.find(x => x.part === 'Side'), tp = ls5.find(x => x.part === 'Top'), hg = ls5.find(x => x.part === 'Hinge');
    rec('T5: PC A\'s save works (Top ×2)', tp && tp.qty === '2', await err(pa));
    rec('T5: Side keeps "MFC White" and its cut tick', sd && sd.material === 'MFC White' && sd.status === 'cut', JSON.stringify(sd && [sd.material, sd.status]));
    rec('T5: Hinge keeps "Blum hinge"', hg && hg.material === 'Blum hinge', JSON.stringify(hg));
    rec('T5: PC A was not asked anything odd', !/replaces it/.test(await pa.evaluate(() => window.__asked.join('|'))), await pa.evaluate(() => window.__asked.join('|')));
    await closeAll(pa);
    await pa.evaluate(() => openListEditor('L1')); await sleep(900);
    const bs = await box(pa, 'Side'), bh = await box(pa, 'Hinge');
    rec('T5: on reopening, Side still shows "MFC White", flagged ⚠ not on the project list', bs && bs.v === 'MFC White' && /⚠.*not on the project list/.test(bs.txt), JSON.stringify(bs));
    rec('T5: on reopening, Hinge still shows "Blum hinge", flagged', bh && bh.v === 'Blum hinge' && /⚠/.test(bh.txt), JSON.stringify(bh));
    const v0 = D.find(S2.db, 'lists', 'L1').version, r0 = D.find(S2.db, 'lists', 'L1').rev;
    await save(pa, 2000);
    rec('(info) T5: Save with no change after the retire writes nothing (no new Rev for the saw)', D.find(S2.db, 'lists', 'L1').version === v0, JSON.stringify([v0, D.find(S2.db, 'lists', 'L1').version, r0, D.find(S2.db, 'lists', 'L1').rev, await err(pa)]));
    await a.close(); await b.close();

    // ---- T6. more than 1,000 lines on the project (Supabase answers 1,000 rows at most per request) ----
    const S3 = X.makeServer(X.v2Row());
    for (let i = 0; i < 25; i++) X.F3.seedList(S3, 'B' + i, { wos: [], name: 'Big ' + i, list: { is_template: true, type_name: 'Big ' + i },
      lines: Array.from({ length: 45 }, (_, j) => ['saw', 'P' + j, '1', 500, 300, i === 24 && j === 44 ? 'Oak veneer' : 'MFC White', '', '']) });
    D.insert(S3.db, 'project_materials', { id: 'M9', project_id: 'P1', name: 'Oak veneer', kind: 'sheet' });
    const c = await X.dev(browser, S3, 'design'), pc = c.page; await asks(pc);
    await pc.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__asked = []; window.__confirm = false; lsMaterialsDlg('P1'); }); await sleep(500);
    await type(pc, '[data-mtv="M9"]', false); await press(pc, '[data-mts="M9"]'); await sleep(2500);
    q = await asked(pc);
    rec('T6: a material used only on the LAST of 1,125 template lines is still found (1 template)', /used on 1 template/.test(q), q);
    await c.close();
    rec('no page errors', ![S, S2, S3].some(s => (s.errors || []).length), JSON.stringify([S.errors, S2.errors, S3.errors]));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
