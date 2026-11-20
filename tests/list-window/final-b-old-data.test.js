// FINAL Tester round (14 Nov), area 7 — OLD saved data that has none of the new fields, opened and saved through the new
// list window: a job with no floor / unit / title, a list with no name / type / history, lines with no section / per-unit /
// second edging / flags, materials with no "also called" list, a project with no customer spellings, a template with no
// Type name. Nothing lost, nothing invented. Plus: a Stores row whose free-text spec happens to equal another material's
// "also called" spelling (the rename rule must not re-label it).
// Fake Supabase only. Run: node tests/list-window/final-b-old-data.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err, job } = L;
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision').length;
const bare = (S, t, id, keep) => { const r = S.db.t[t].find(x => x.id === id); Object.keys(r).forEach(k => { if (!keep.includes(k)) delete r[k]; }); return r; };
const content = x => [x.id, x.kind, x.part, x.qty == null ? null : String(x.qty), x.length_mm == null ? null : +x.length_mm, x.width_mm == null ? null : +x.width_mm, x.material || null, x.edging || null, x.edging2 || null, x.note || null, x.section || null, x.unit_qty || null, x.status || null, x.status_by || null, x.removed_rev == null ? null : x.removed_rev];
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const row = X.v2Row();
    // an old job: no floor / unit / title / ref keys at all
    const o1 = row.orders.find(o => o.wo === 'WO-1'); ['floor', 'unit', 'title', 'ref', 'colour', 'salesRep', 'orderNo'].forEach(k => delete o1[k]);
    const S = X.makeServer(row, { lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { status: 'cut', status_by: 'Saw', status_at: '2026-10-20T08:00:00.000Z' }], ['saw', 'Top', 1, '1200', '560', 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''], ['fit', 'Handle', '4', null, null, 'White', '', ''], ['buy', 'Worktop', '1', 3000, 600, 'Oak', '', ''], ['fit', 'Tap', '1', null, null, 'Chrome mixer', '', '']] });
    // strip everything "new" from the stored rows (as rows written by the first version would be)
    // (the database's own column defaults always fill list_type / source / is_template, so those stay; everything optional goes)
    bare(S, 'lists', 'L1', ['id', 'name', 'project_id', 'wos', 'version', 'rev', 'created_at', 'updated_at', 'n_saw', 'n_fit', 'archived', 'is_template', 'list_type', 'source', 'no_cut', 'no_fit']); // no type_name, no log, no template link, no check fields
    S.db.t.list_lines.filter(x => x.list_id === 'L1').forEach(x => bare(S, 'list_lines', x.id, ['id', 'list_id', 'seq', 'kind', 'part', 'qty', 'length_mm', 'width_mm', 'material', 'edging', 'note', 'status', 'status_by', 'status_at', 'version', 'updated_at']));
    S.db.t.project_materials.forEach(m => bare(S, 'project_materials', m.id, ['id', 'project_id', 'name', 'kind', 'version']));                                    // no aliases, no active, no sort
    D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Oak veneer', kind: 'sheet', aliases: ['Oak', 'White'] });                           // "also called" spellings that collide with free-text specs
    bare(S, 'projects', 'P1', ['id', 'name', 'version']);                                                                                                        // no customer, no cien_names, no list_owner
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true } }); bare(S, 'lists', 'T1', ['id', 'name', 'project_id', 'wos', 'version', 'rev', 'created_at', 'updated_at', 'n_saw', 'n_fit', 'is_template', 'list_type', 'source', 'no_cut', 'no_fit']); // template: no type_name / list_type
    const before = JSON.stringify(linesOf(S, 'L1').map(content)), job0 = JSON.stringify(S.row.orders.find(o => o.wo === 'WO-1')), l0 = JSON.parse(JSON.stringify(D.find(S.db, 'lists', 'L1')));
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    rec('1 the planner opens on the old data with no page error', !(S.errors || []).length, JSON.stringify(S.errors));
    rec('1a opening rewrites nothing', JSON.stringify(linesOf(S, 'L1').map(content)) === before && saves(S) === 0);
    const pg = await p.evaluate(() => { showTab && 0; render(); return document.getElementById('app').innerText; });
    rec('1b the Cutting Lists page shows no "undefined" / "null" / "NaN"', !/undefined|null|NaN/.test(pg), (pg.match(/.{30}(undefined|null|NaN).{30}/) || [''])[0]);

    // ---- 2. the old list in the new window ----
    await p.evaluate(() => { window.__asked = []; openListEditor('L1'); }); await sleep(1000);
    const jb = await job(p), r0 = await rows(p);
    const boxes = await p.evaluate(() => { const v = id => { const e = document.getElementById(id); return e ? e.value : null; }; return { name: v('me-name'), tname: v('me-tname'), floor: v('me-pfloor'), unit: v('me-punit'), title: v('me-ptitle'), text: (document.querySelector('.me-ed') || {}).innerText || '' }; });
    rec('2a the window opens with the list\'s 6 rows, in order, no extra blank headings or rows put in', JSON.stringify(r0.map(r => r.item)) === JSON.stringify(['Side', 'Top', 'Hinge', 'Handle', 'Worktop', 'Tap']), JSON.stringify(r0.map(r => r.item)));
    rec('2b title bar shows the work order WO-1; nothing reads "undefined" / "null" / "NaN"', /WO-1/.test(jb.title) && !/undefined|null|NaN/.test(boxes.text), JSON.stringify([jb.title.slice(0, 80), (boxes.text.match(/.{20}(undefined|null|NaN).{20}/) || [''])[0]]));
    rec('2c List name box shows the list\'s own name "House 1"; the Type name box is empty (it has none)', boxes.name === 'House 1' && (boxes.tname === '' || boxes.tname === null), JSON.stringify([boxes.name, boxes.tname]));
    rec('2d sizes typed as text on the old row ("1200" × "560") show as 1200 × 560, qty 1', (r => r && String(r.L) === '1200' && String(r.W) === '560' && String(r.qty) === '1')(r0.find(r => r.item === 'Top')), JSON.stringify(r0.find(r => r.item === 'Top')));
    const mb = await p.evaluate(() => [...document.querySelectorAll('.me-ed [data-row]')].map(tr => { const s = tr.querySelector('[data-mr$="|mat"]'); return s ? s.value : null; }));
    rec('[MEDIUM] 2e the Stores row "Handle — White" still SHOWS "White" (not re-labelled "Oak veneer" because a board is also called "White")', mb[r0.findIndex(r => r.item === 'Handle')] === 'White', JSON.stringify(mb));
    // close untouched: no question
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(300);
    rec('2f Esc on the untouched old list closes without "Close without saving?"', !(await L.ed(p)) && (await p.evaluate(() => window.__asked.join('|'))) === '', await p.evaluate(() => window.__asked.join('|')));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
    // Save with no change
    await p.evaluate(() => openListEditor('L1')); await sleep(900); await save(p, 2000);
    rec('[MEDIUM] 2g Save with nothing changed writes nothing (no new revision, no row re-labelled)', saves(S) === 0 && JSON.stringify(linesOf(S, 'L1').map(content)) === before, JSON.stringify([saves(S), await err(p)]));
    await closeAll(p);

    // ---- 3. ONE real change (Hinge 8 → 9), Save ----
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    const r3 = await rows(p); await setv(p, r3.findIndex(r => r.item === 'Hinge') + '|qty', '9'); await sleep(200); await save(p, 2400);
    const e3 = await err(p), after = linesOf(S, 'L1'), l1 = D.find(S.db, 'lists', 'L1');
    rec('3a the change is saved (Hinge 9)' + (e3 ? ' — message: ' + e3 : ''), (after.find(x => x.part === 'Hinge') || {}).qty === '9', e3);
    const by = part => after.find(x => x.part === part) || {};
    rec('3b nothing lost: still 6 lines, same ids, same order', JSON.stringify(after.sort((a, b) => a.seq - b.seq).map(x => x.id)) === JSON.stringify(['L1:1', 'L1:2', 'L1:3', 'L1:4', 'L1:5', 'L1:6']), JSON.stringify(after.map(x => [x.id, x.seq, x.part])));
    rec('3c Side keeps its cut tick (who and when)', by('Side').status === 'cut' && by('Side').status_by === 'Saw' && by('Side').status_at === '2026-10-20T08:00:00.000Z', JSON.stringify([by('Side').status, by('Side').status_by, by('Side').status_at]));
    rec('3d sizes and quantities of the untouched rows are the same numbers', +by('Top').length_mm === 1200 && +by('Top').width_mm === 560 && String(by('Top').qty) === '1' && +by('Worktop').length_mm === 3000 && by('Side').edging === '1mm ABS', JSON.stringify([by('Top'), by('Worktop')].map(x => [x.qty, x.length_mm, x.width_mm])));
    rec('3e nothing invented on the lines: no section, no per-unit quantity, no second edging appeared', after.every(x => !x.section && !x.unit_qty && !x.edging2), JSON.stringify(after.map(x => [x.part, x.section, x.unit_qty, x.edging2])));
    rec('[MEDIUM] 3f the Stores row "Handle" still says "White" in the database (a Stores spec is free text — not re-labelled to the board "Oak veneer")', by('Handle').material === 'White', by('Handle').material);
    rec('[MEDIUM] 3g the bought-in "Worktop — Oak" still says "Oak" (not re-labelled "Oak veneer")', by('Worktop').material === 'Oak', by('Worktop').material);
    rec('3h "Tap — Chrome mixer" (not on the materials list) is unchanged', by('Tap').material === 'Chrome mixer', by('Tap').material);
    rec('3i list name and type unchanged by the save', l1.name === 'House 1' && l1.list_type === l0.list_type, JSON.stringify([l1.name, l1.list_type, l1.type_name]));
    rec('3j the list is still on WO-1, same project, not archived, no Type name made up', JSON.stringify(l1.wos) === '["WO-1"]' && l1.project_id === 'P1' && !l1.archived && !l1.type_name, JSON.stringify([l1.wos, l1.project_id, l1.archived, l1.type_name]));
    await sleep(1800);
    const job1 = S.row.orders.find(o => o.wo === 'WO-1');
    rec('3k the JOB is untouched: no floor / unit / title written onto it, due date and step the same', ['floor', 'unit', 'title'].every(k => !job1[k]) && job1.dueDate === JSON.parse(job0).dueDate && job1.step === JSON.parse(job0).step, JSON.stringify([job1.floor, job1.unit, job1.title, job1.dueDate, job1.step]));
    const mats = S.db.t.project_materials;
    rec('3l the materials are untouched (no "also called" added, none retired, none added)', mats.length === 3 && mats.filter(m => m.id !== 'M3').every(m => !('aliases' in m) || !(m.aliases || []).length) && mats.every(m => m.active !== false), JSON.stringify(mats.map(m => [m.name, m.aliases, m.active])));
    const pj = D.find(S.db, 'projects', 'P1');
    rec('3m the project is untouched (no customer spelling invented)', pj.name === 'Aderrig' && !(pj.cien_names || []).length && !pj.customer, JSON.stringify([pj.name, pj.customer, pj.cien_names]));
    await closeAll(p);

    // ---- 4. old template with no Type name: a row changed, saved ----
    await p.evaluate(async () => { lsReset(); await lsLoad(); window.__prompt = 'tidy'; openListEditor('T1'); }); await sleep(900);
    const r4 = await rows(p), tn4 = await p.evaluate(() => (document.getElementById('me-tname') || {}).value);
    await setv(p, r4.findIndex(r => r.item === 'Hinge') + '|qty', '6'); await sleep(200); await save(p, 2200);
    const t1 = D.find(S.db, 'lists', 'T1');
    // (updated 20 Nov 2026, Garry: one name per template) a template has no Type name box; a template save writes type_name = name
    rec('4a old template opens (no Type name box on a template) and saves a changed row', tn4 == null && (linesOf(S, 'T1').find(x => x.part === 'Hinge') || {}).qty === '6', JSON.stringify([tn4, await err(p)]));
    rec('4b its name is still "Type 2", still a template, and its one name is saved as the type name too', t1.name === 'Type 2' && t1.is_template === true && t1.type_name === 'Type 2', JSON.stringify([t1.name, t1.is_template, t1.type_name]));
    await closeAll(p);

    // ---- 5. the saw still sees the old list right ----
    const sw = await X.dev(browser, S, 'saw'), ps = sw.page;
    const sawRows = await ps.evaluate(async () => { lsReset(); await lsLoad(); await lsReloadList('L1'); const l = lsList('L1'); return { name: l && l.name, rows: listRows(l).map(r => [r.k, r.item, r.qty, r.L, r.W, r.mat]), ticked: Object.keys(rowTicks('L1')) }; });
    rec('5 the saw sees Side ×2 720 × 560 (ticked) and Top ×1 1200 × 560', JSON.stringify(sawRows.rows.filter(r => r[0] === 'saw').map(r => r.map(String))) === JSON.stringify([['saw', 'Side', '2', '720', '560', 'MFC White'], ['saw', 'Top', '1', '1200', '560', 'MFC White']]) && sawRows.ticked.includes('L1:1'), JSON.stringify(sawRows));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
