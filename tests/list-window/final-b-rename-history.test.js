// FINAL Tester round (14 Nov), area 3 — Manager point 3: when a Save only RE-LABELS a material (a rename is picked up), does
// the list's history / the saw's "what changed" / the cut ticks show a change nobody made, or lose ticks?
// Twins (one cut, one not), a note-only edit on the renamed row, a REAL material change on a renamed row (must still be
// CHANGED), a renamed fitting with a got-out tick, a unit block, and the "already cut on old list" hint on a list made
// with "Make new list from this" after the rename.
// Fake Supabase only. Run: node tests/list-window/final-b-rename-history.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err } = L;
const CUT = { status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' };
const LINES = [['hdr', 'Carcass', ''],
  ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass', ...CUT }],           // :2 cut
  ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass' }],                    // :3 its twin, NOT cut
  ['saw', 'Top', '1', 1200, 560, 'mfc  white', '', 'scribe', { section: 'Carcass', ...CUT }],            // :4 cut, old name in another spelling
  ['saw', 'Shelf', '3', 500, 300, 'MFC White', '', '', { section: 'Carcass', ...CUT }],                  // :5 cut
  ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass', status: 'got-out', status_by: 'Stores', status_at: '2026-10-21T08:10:00.000Z' }], // :6
  ['fit', 'Handle', '4', null, null, 'Bar', '', '', { section: 'Carcass', material_other: false }]];     // :7
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
const ln = (S, id) => S.db.t.list_lines.find(x => x.id === id);
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row(), { lines: LINES });
    D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Oak veneer', kind: 'sheet' });
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { locked: true, rev: 1 });
    // renamed on another PC (what the Materials window stores): board and fitting
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M1'), { name: '18mm MFC White', aliases: ['MFC White'] });
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M2'), { name: 'Blum 110 hinge', aliases: ['Blum hinge'] });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p); await reload(p);
    const sw = await X.dev(browser, S, 'saw'), ps = sw.page;
    const ev0 = (S.db.t.list_events || []).length, rv0 = (S.db.t.list_revisions || []).length;

    // ---- 1. a save that changes ONE other row (Handle 4 → 5): everything else is only re-labelled ----
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    let r = await rows(p); const hd = r.findIndex(x => x.item === 'Handle');
    await setv(p, hd + '|qty', '5'); await sleep(200); await save(p, 2200);
    const l1 = D.find(S.db, 'lists', 'L1');
    rec('1 set-up: saved as Rev 2 (Handle 5)', +l1.rev === 2 && ln(S, 'L1:7').qty === '5', JSON.stringify([l1.rev, await err(p)]));
    rec('1a the four board rows are now stored under the current name', ['L1:2', 'L1:3', 'L1:4', 'L1:5'].every(id => ln(S, id).material === '18mm MFC White'), JSON.stringify(['L1:2', 'L1:3', 'L1:4', 'L1:5'].map(id => ln(S, id).material)));
    rec('[HIGH] 1b cut ticks kept on Side (:2), Top (:4), Shelf (:5) — with who and when', ['L1:2', 'L1:4', 'L1:5'].every(id => ln(S, id).status === 'cut' && ln(S, id).status_by === 'Saw' && ln(S, id).status_at === CUT.status_at), JSON.stringify(['L1:2', 'L1:4', 'L1:5'].map(id => [ln(S, id).status, ln(S, id).status_by])));
    rec('[HIGH] 1c the un-cut twin Side (:3) did NOT pick up its twin\'s tick, and the cut one did not lose it', ln(S, 'L1:3').status !== 'cut' && ln(S, 'L1:2').status === 'cut', JSON.stringify([ln(S, 'L1:2').status, ln(S, 'L1:3').status]));
    rec('[HIGH] 1d the renamed fitting Hinge keeps its "got out" tick', ln(S, 'L1:6').status === 'got-out' && ln(S, 'L1:6').material === 'Blum 110 hinge', JSON.stringify([ln(S, 'L1:6').status, ln(S, 'L1:6').material]));
    rec('[MEDIUM] 1e no re-labelled row is marked changed on Rev 2 (changed_rev)', ['L1:2', 'L1:3', 'L1:4', 'L1:5', 'L1:6'].every(id => +ln(S, id).changed_rev !== 2), JSON.stringify(['L1:2', 'L1:3', 'L1:4', 'L1:5', 'L1:6'].map(id => ln(S, id).changed_rev)));
    await reload(ps);
    const sawInfo = await ps.evaluate(async () => { await lsReloadList('L1'); return { saw: lsRevInfo('L1', 'saw'), fit: lsRevInfo('L1', 'fit'), badges: ['L1:2', 'L1:3', 'L1:4', 'L1:5', 'L1:6'].map(id => lsLineBadge(id).replace(/<[^>]+>/g, '').trim()), banner: (() => { const d = document.createElement('div'); d.innerHTML = lsRevBanner(lsList('L1'), 'saw'); return d.innerText; })() }; });
    rec('[MEDIUM] 1f the saw is told "0 changed" for the saw rows on Rev 2', sawInfo.saw.changed === 0 && sawInfo.saw.added === 0 && sawInfo.saw.removed === 0, JSON.stringify(sawInfo.saw));
    rec('[MEDIUM] 1g Stores is told exactly 1 changed (Handle), not the re-labelled Hinge', sawInfo.fit.changed === 1, JSON.stringify(sawInfo.fit));
    rec('[MEDIUM] 1h no red "CHANGED" badge on any re-labelled row', sawInfo.badges.every(b => b === ''), JSON.stringify(sawInfo.badges));
    // history
    const log = (l1.log || []).slice(-1)[0] || {}, evs = (S.db.t.list_events || []).slice(ev0);
    rec('1i list history: ONE new entry "Revision 2"', (l1.log || []).filter(e => e.what === 'Revision 2').length === 1, JSON.stringify((l1.log || []).map(e => e.what)));
    rec('[LOW] 1j list history entry does not claim a material was changed', !/material|MFC|renam/i.test(JSON.stringify(log)), JSON.stringify(log));
    rec('(info) 1k events written for this save', true, JSON.stringify(evs.map(e => [e.act || e.what, e.line_id || e.entity_id || ''])).slice(0, 280));
    const rv = (S.db.t.list_revisions || []).slice(rv0).find(x => x.list_id === 'L1');
    rec('1l the kept copy of Rev 1 (History → View) still shows what Rev 1 really said (old name) — history is not rewritten', !rv || !Array.isArray(rv.lines) || rv.lines.filter(x => x.kind === 'saw').every(x => matKeyish(x.material) === 'mfc white'), rv ? JSON.stringify((rv.lines || []).map(x => x.material)) : 'no revision copy in the fake');
    await closeAll(p);

    // ---- 2. note-only edit ON a renamed, cut row: tick kept, flagged as a note change only ----
    await reload(p); await p.evaluate(() => openListEditor('L1')); await sleep(900);
    r = await rows(p); const sh = r.findIndex(x => x.item === 'Shelf');
    await setv(p, sh + '|note', 'lip front'); await sleep(200); await save(p, 2200);
    rec('2 note typed on the cut Shelf: saved, cut tick kept', ln(S, 'L1:5').note === 'lip front' && ln(S, 'L1:5').status === 'cut', JSON.stringify([ln(S, 'L1:5').note, ln(S, 'L1:5').status, await err(p)]));
    await closeAll(p);

    // ---- 3. a REAL material change on a renamed row must still be a change (tick reset, CHANGED for the saw) ----
    await reload(p); await p.evaluate(() => openListEditor('L1')); await sleep(900);
    r = await rows(p); const tp = r.findIndex(x => x.item === 'Top');
    const opts = await p.evaluate(i => [...document.querySelector('.me-ed [data-mr="' + i + '|mat"]').options].map(o => o.value), tp);
    await setv(p, tp + '|mat', 'Oak veneer'); await sleep(200); await save(p, 2200);
    const l3 = D.find(S.db, 'lists', 'L1');
    rec('3 set-up: Top changed to Oak veneer', ln(S, 'L1:4').material === 'Oak veneer', JSON.stringify([opts, await err(p)]));
    rec('[HIGH] 3a a REAL board change is NOT hidden by the rename rule: Top loses its cut tick and is CHANGED on Rev ' + l3.rev, ln(S, 'L1:4').status !== 'cut' && +ln(S, 'L1:4').changed_rev === +l3.rev, JSON.stringify([ln(S, 'L1:4').status, ln(S, 'L1:4').changed_rev, l3.rev]));
    rec('3b … and the other cut rows keep their ticks', ln(S, 'L1:2').status === 'cut' && ln(S, 'L1:5').status === 'cut');
    await closeAll(p);

    // ---- 4. renamed again (B → C) with the list now stored under B: same again, nothing reset ----
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M1'), { name: 'Egger W980 18mm', aliases: ['MFC White', '18mm MFC White'] });
    await reload(p); await p.evaluate(() => openListEditor('L1')); await sleep(900);
    r = await rows(p); const hd4 = r.findIndex(x => x.item === 'Handle');
    await setv(p, hd4 + '|qty', '6'); await sleep(200); await save(p, 2200);
    rec('4 second rename: rows stored under the newest name, ticks kept, none marked changed', ['L1:2', 'L1:5'].every(id => ln(S, id).material === 'Egger W980 18mm' && ln(S, id).status === 'cut' && +ln(S, id).changed_rev !== +D.find(S.db, 'lists', 'L1').rev), JSON.stringify(['L1:2', 'L1:5'].map(id => [ln(S, id).material, ln(S, id).status, ln(S, id).changed_rev])));
    await closeAll(p);

    // ---- 5. unit block: 3 units × 2 per unit, renamed board, a real change elsewhere — totals unchanged ----
    X.F3.seedList(S, 'L5', { wos: ['WO-2'], name: 'Wardrobes', lines: [['hdr', '900 Single Rail', '3', null, null, '', '', ''], ['saw', 'Side', '6', 2000, 560, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '2', ...CUT }], ['saw', 'Shelf', '3', 860, 560, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '1' }]], list: { locked: true, rev: 1 } });
    await reload(p); await p.evaluate(() => openListEditor('L5')); await sleep(900);
    r = await rows(p); const s5 = r.findIndex(x => x.item === 'Shelf');
    await setv(p, s5 + '|note', 'x'); await sleep(200); await save(p, 2200);
    const a5 = ln(S, 'L5:2');
    rec('5 unit block: Side stays 6 in total (2 per unit × 3), keeps its tick, stored under the current name', a5.qty === '6' && a5.unit_qty === '2' && a5.status === 'cut' && a5.material === 'Egger W980 18mm', JSON.stringify([a5.qty, a5.unit_qty, a5.status, a5.material, await err(p)]));
    await closeAll(p);

    // ---- 6. "already cut on old list" after a rename: the replacement list is stored under the NEW name, the old list
    //         (archived, never re-saved) under the OLD one. The saw must still be told the part was cut. ----
    const S6 = X.makeServer(X.v2Row(), { lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', '', CUT], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '']] });
    D.update(S6.db, 'lists', D.find(S6.db, 'lists', 'L1'), { locked: true, rev: 1, archived: true });
    const mkNew = (id, mat) => X.F3.seedList(S6, id, { wos: ['WO-1'], name: 'House 1 (new) ' + id, lines: [['saw', 'Side', '2', 720, 560, mat, '', ''], ['saw', 'Top', '1', 1200, 560, mat, '', '']], list: { locked: true, log: [{ at: '2026-10-21T08:30:00Z', by: 'Ann', what: 'List created', why: 'Made with "Make new list from this" from "House 1" — replaces list L1', replaces: 'L1' }] } });
    mkNew('LC', 'MFC White'); // control: made BEFORE the rename (same name on both)
    const c6 = await X.dev(browser, S6, 'saw'); const pc = c6.page;
    const badge = async (pg, id) => { await pg.evaluate(async () => { lsReset(); await lsLoad(); await lsReloadList('L1').catch(() => {}); }); await pg.evaluate(id => lsPrevCutBadge(id), id); await sleep(700); return pg.evaluate(id => lsPrevCutBadge(id).replace(/<[^>]+>/g, ''), id); };
    const bc = await badge(pc, 'LC:1');
    rec('6 control (no rename): the saw sees "already cut on old list (2)" on the replacement\'s Side', /already cut on old list \(2\)/.test(bc), bc);
    D.update(S6.db, 'project_materials', D.find(S6.db, 'project_materials', 'M1'), { name: '18mm MFC White', aliases: ['MFC White'] });
    D.update(S6.db, 'lists', D.find(S6.db, 'lists', 'LC'), { archived: true });
    mkNew('LN', '18mm MFC White'); // made AFTER the rename: the list window saves every row under the current name
    const bn = await badge(pc, 'LN:1');
    rec('[HIGH] 6a after a rename the saw STILL sees "already cut on old list (2)" on the replacement list (lsPrevCutMap / lsCutKey compare raw names)', /already cut on old list \(2\)/.test(bn), JSON.stringify(bn));

    rec('no page errors', !(S.errors || []).length && !(S6.errors || []).length, JSON.stringify([S.errors, S6.errors]));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
function matKeyish(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
