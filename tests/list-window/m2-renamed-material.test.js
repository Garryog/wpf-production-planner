// Bug M2 (Garry's bug check, 13 Nov): a material renamed in the project's Materials window keeps its old name as an
// "other spelling", but the list window matched by exact name only — every list and template row using the old name showed
// "⚠ … (not on the project list)". Now: the box shows the CURRENT name (no warning); when the list is next saved the line is
// saved under the current name, and a tick on that line is NOT lost (same material). Nothing is rewritten in bulk.
// Fake Supabase only. Run: node tests/list-window/m2-renamed-material.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save } = L;
const LINES = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' }],
  ['saw', 'Top', '1', 1200, 560, 'mfc  white', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']];
// one entry per row (same index as rows()); headings have no Material box
const matBox = p => p.evaluate(() => [...document.querySelectorAll('.me-ed [data-row]')].map(tr => { const s = tr.querySelector('[data-mr$="|mat"]'); return s ? { v: s.value, warn: [...s.options].some(o => /not on the project list/.test(o.textContent)), amber: !!s.getAttribute('style') } : null; }));
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row(), { lines: LINES });
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });
    // renamed on another PC: the old name is kept as an other spelling (what the Materials window's Save does)
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M1'), { name: '18mm MFC White', aliases: ['MFC White'] });
    const before = JSON.stringify(S.db.t.list_lines);
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    rec('opening the planner rewrites nothing (no bulk change of stored lists)', JSON.stringify(S.db.t.list_lines) === before);
    // a live list
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    const b1 = await matBox(p), r1 = await rows(p);
    const side = r1.findIndex(r => r.item === 'Side'), top = r1.findIndex(r => r.item === 'Top');
    rec('list: the row with the OLD name shows the current name "18mm MFC White"', b1[side] && b1[side].v === '18mm MFC White', JSON.stringify(b1));
    rec('list: … with no "not on the project list" warning and no amber', b1[side] && !b1[side].warn && !b1[side].amber, JSON.stringify(b1[side]));
    rec('list: a different case / spacing of the old name ("mfc  white") is matched too', b1[top] && b1[top].v === '18mm MFC White' && !b1[top].warn, JSON.stringify(b1[top]));
    // change something else and save: the lines go under the current name, the cut tick on Side stays
    const tap = r1.findIndex(r => r.item === 'Hinge');
    await setv(p, tap + '|qty', '9'); await sleep(200);
    await save(p, 2000);
    const ls = linesOf(S, 'L1'), sl = ls.find(x => x.part === 'Side'), tl = ls.find(x => x.part === 'Top');
    rec('saved: Side is now saved as "18mm MFC White"', sl && sl.material === '18mm MFC White', sl && sl.material);
    rec('saved: Top is now saved as "18mm MFC White"', tl && tl.material === '18mm MFC White', tl && tl.material);
    rec('saved: Side keeps its cut tick (same material, not a change for the saw)', sl && sl.status === 'cut', sl && sl.status);
    rec('saved: no line is flagged "not on the project list" for the saw', ls.filter(x => x.kind === 'saw').every(x => !x.material_other), JSON.stringify(ls.map(x => [x.part, x.material_other])));
    await closeAll(p);
    // a template
    await p.evaluate(() => openListEditor('T1')); await sleep(900);
    const b2 = await matBox(p), r2 = await rows(p);
    const s2 = r2.map((r, i) => [r, i]).filter(([r]) => r.item === 'Side').map(([, i]) => i);
    rec('template: rows with the old name show the current name, no warning', s2.length > 0 && s2.every(i => b2[i].v === '18mm MFC White' && !b2[i].warn), JSON.stringify(s2.map(i => b2[i])));
    await closeAll(p);
    rec('template not saved → its stored lines are not touched', linesOf(S, 'T1').every(x => x.kind !== 'saw' || x.material === 'MFC White'));
    // a material that is NOT on the list still warns (no false match)
    D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'T1:3'), { material: 'Oak veneer' });
    await p.evaluate(async () => { lsReset(); await lsLoad(); openListEditor('T1'); }); await sleep(900);
    const b3 = await matBox(p), r3 = await rows(p), o3 = r3.findIndex(r => r.item === 'Top');
    rec('a material that is not on the project list still shows "⚠ … not on the project list"', b3[o3] && b3[o3].warn && b3[o3].v === 'Oak veneer', JSON.stringify(b3[o3]));
    await closeAll(p);
    // pure check: diffLines treats old/current name as the same only when told (default unchanged)
    const dl = await p.evaluate(() => { const o = [{ id: 'A:1', seq: 1, kind: 'saw', part: 'Side', qty: '2', length_mm: 720, width_mm: 560, material: 'MFC White', status: 'cut' }];
      const n = [{ id: 'A:1', kind: 'saw', part: 'Side', qty: '2', length_mm: 720, width_mm: 560, material: '18mm MFC White' }];
      return [diffLines(o, n, { listId: 'A' }).changed.length, diffLines(o, n, { listId: 'A', mat: lsMatCanon('P1') }).changed.length]; });
    rec('diffLines: without the project\'s materials a new name is a change (as before); with them it is the same material', dl[0] === 1 && dl[1] === 0, JSON.stringify(dl));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
