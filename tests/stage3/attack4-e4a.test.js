// ATTACK 4 — re-verify E4 (office edit merge: a line another office removed stays removed) and A2/A3 (material alias
// clashes) with variations. Fake Supabase only (srv3.js). Run: node tests/stage3/attack4-e4a.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const desc = S => live(S, 'L1').map(x => x.part + '×' + x.qty + (x.note ? '(' + x.note + ')' : '')).join(',');
async function save(t, rows, who, conf) {
  return t.page.evaluate(async ({ rows, who, conf }) => {
    window.__c = []; window.confirm = m => { window.__c.push(m); return conf; };
    try { await lsSaveManual({ wo: 'WO-1', name: 'House L1', project: 'Aderrig', rows }, who, lsList('L1')); return { ok: true, asked: window.__c }; }
    catch (e) { return { ok: false, err: e.message, asked: window.__c }; }
  }, { rows, who, conf });
}
async function offices(browser, n) {
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
  const o = []; for (let i = 0; i < n; i++) o.push(await F.dev(browser, S, 'office'));
  const rows = []; for (const t of o) rows.push(await t.page.evaluate(() => lsEditRows('L1')));
  return { S, o, rows };
}
(async () => {
  const browser = await H.chromium.launch();
  // rows: 0 Side, 1 Side (twin), 2 Top, 3 Hinge
  { // E4v1: Dee removes the twin; Fay edits the note of the SAME twin she still has → a real clash: must be asked
    const { S, o, rows } = await offices(browser, 2);
    rows[0].splice(1, 1); await save(o[0], rows[0], 'Dee', true);
    rows[1][1].note = 'twin note'; const f = await save(o[1], rows[1], 'Fay', false);
    rec('E4v1 Fay edits the very Side twin Dee removed: she is asked (Cancel → stays removed)', f.asked.length >= 1 && (desc(S).match(/Side/g) || []).length === 1, 'asked=' + f.asked.length + ' now=' + desc(S) + ' ' + (f.err || ''));
    for (const t of o) await t.close();
  }
  { // E4v2: Dee removes Top (not a twin); Fay changes Hinge qty → Top stays removed, not asked
    const { S, o, rows } = await offices(browser, 2);
    rows[0].splice(2, 1); await save(o[0], rows[0], 'Dee', true);
    rows[1][3].qty = 9; const f = await save(o[1], rows[1], 'Fay', true);
    rec('E4v2 Dee removed Top, Fay only changed Hinge: Top stays removed, Hinge 9, Fay not asked', f.ok && !/Top/.test(desc(S)) && /Hinge×9/.test(desc(S)) && !f.asked.length, desc(S) + ' asked=' + f.asked.length);
    for (const t of o) await t.close();
  }
  { // E4v3: Dee removes BOTH Sides; Fay only adds a Shelf → Sides stay removed, Shelf added, not asked
    const { S, o, rows } = await offices(browser, 2);
    rows[0].splice(0, 2); await save(o[0], rows[0], 'Dee', true);
    rows[1].push({ k: 'saw', item: 'Shelf', qty: 2, L: 500, W: 300, mat: 'MFC White', edging: '', note: '' }); const f = await save(o[1], rows[1], 'Fay', true);
    rec('E4v3 both Sides removed elsewhere; Fay adds a Shelf: no Side comes back, Shelf there, not asked', f.ok && !/Side/.test(desc(S)) && /Shelf/.test(desc(S)) && !f.asked.length, desc(S) + ' asked=' + f.asked.length);
    for (const t of o) await t.close();
  }
  { // E4v4: Dee removes the twin; Fay REMOVES the same twin too → one Side, nobody asked, no error
    const { S, o, rows } = await offices(browser, 2);
    rows[0].splice(1, 1); await save(o[0], rows[0], 'Dee', true);
    rows[1].splice(1, 1); const f = await save(o[1], rows[1], 'Fay', true);
    rec('E4v4 both remove the same Side twin: one Side left, Fay not asked', f.ok && (desc(S).match(/Side/g) || []).length === 1 && !f.asked.length, desc(S) + ' asked=' + f.asked.length + ' ' + (f.err || ''));
    for (const t of o) await t.close();
  }
  { // E4v5: Dee removes the FIRST Side; Fay edits the SECOND Side's qty → first stays removed, second has new qty
    const { S, o, rows } = await offices(browser, 2);
    rows[0].splice(0, 1); await save(o[0], rows[0], 'Dee', true);
    rows[1][1].qty = 4; const f = await save(o[1], rows[1], 'Fay', true);
    const sides = live(S, 'L1').filter(x => x.part === 'Side').map(x => x.id + '×' + x.qty);
    rec('E4v5 Dee removes Side #1, Fay edits Side #2 qty: one Side (#2, qty 4), not asked', f.ok && sides.length === 1 && sides[0] === 'L1:2×4' && !f.asked.length, JSON.stringify(sides) + ' asked=' + f.asked.length);
    for (const t of o) await t.close();
  }
  { // E4v6: the saw ticked the twin before Dee removed it — Fay edits an unrelated line; ticked-then-removed twin stays removed
    const { S, o, rows } = await offices(browser, 2);
    const saw = await F.dev(browser, S, 'saw'); await F.tapRow(saw.page, 'data-rt', 'L1:2'); await F.send(saw.page);
    rows[0].splice(1, 1); const d = await save(o[0], rows[0], 'Dee', true);
    rows[1][2].note = 'scribe both ends'; const f = await save(o[1], rows[1], 'Fay', true);
    rec('E4v6 (info) twin was CUT then removed by Dee; Fay edits Top note: twin stays removed', true, 'dee=' + JSON.stringify(d).slice(0, 120) + ' now=' + desc(S) + ' asked=' + f.asked.length);
    rec('E4v6 Fay\'s save did not bring back the removed twin', (desc(S).match(/Side/g) || []).length === (d.ok ? 1 : 2), desc(S));
    await saw.close(); for (const t of o) await t.close();
  }
  // ---------------- A2 / A3 variations ----------------
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
  D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Egger W980', kind: 'sheet', aliases: ['White board'] });
  D.insert(S.db, 'project_materials', { id: 'M4', project_id: 'P1', name: 'Old Oak', kind: 'sheet', aliases: ['Oak 18'], active: false });
  D.insert(S.db, 'projects', { id: 'P2', name: 'Other site' }); D.insert(S.db, 'project_materials', { id: 'M9', project_id: 'P2', name: 'Shared Grey', kind: 'sheet' });
  const pr = await F.dev(browser, S, 'prod');
  const open = () => pr.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsMaterialsDlg('P1'); });
  const ren = async (id, name, aliases) => { await open(); return pr.page.evaluate(async ({ id, name, aliases }) => {
    const n = document.querySelector('[data-mtn="' + id + '"]'); if (name != null) n.value = name; if (aliases != null) document.querySelector('[data-mta="' + id + '"]').value = aliases;
    document.querySelector('[data-mts="' + id + '"]').click(); await new Promise(r => setTimeout(r, 500)); return (document.getElementById('mt-msg') || {}).textContent || ''; }, { id, name, aliases }); };
  const add = async name => { await open(); return pr.page.evaluate(async name => { document.getElementById('mt-new-n').value = name; document.getElementById('mt-add').click(); await new Promise(r => setTimeout(r, 500)); return (document.getElementById('mt-msg') || {}).textContent || ''; }, name); };
  const answering = n => S.db.t.project_materials.filter(m => m.project_id === 'P1' && [m.name, ...(m.aliases || [])].some(x => String(x).trim().toLowerCase() === n.toLowerCase())).map(m => m.id);
  await ren('M1', 'MFC White 18mm');
  let m = await add('  mfc WHITE  ');
  rec('A2v1 add "  mfc WHITE  " (case + spaces) when "MFC White" is an alias of M1 → refused', answering('MFC White').length === 1, m + ' → ' + answering('MFC White'));
  m = await add('MFC  White');
  rec('A2v2 (info) add "MFC  White" (double space) — dup check does not collapse inner spaces', true, m + ' → materials now: ' + S.db.t.project_materials.filter(x => x.project_id === 'P1').map(x => x.name).join(' / '));
  m = await add('oak 18');
  rec('A2v3 add "oak 18" (alias of a RETIRED material) → refused, so re-activating Old Oak can\'t make two', answering('Oak 18').length === 1, m + ' → ' + answering('Oak 18'));
  m = await add('Shared Grey');
  rec('A2v4 a name used on ANOTHER project is fine here', answering('Shared Grey').length === 1 && /P1/.test(JSON.stringify(S.db.t.project_materials.filter(x => x.name === 'Shared Grey').map(x => x.project_id))), m);
  m = await ren('M1', 'WHITE BOARD');
  rec('A3v1 rename M1 to "WHITE BOARD" (another material\'s alias, different case) → refused', D.find(S.db, 'project_materials', 'M1').name !== 'WHITE BOARD', m + ' M1=' + D.find(S.db, 'project_materials', 'M1').name);
  m = await ren('M3', null, 'White board, mfc white 18MM');
  rec('A3v2 add another material\'s NAME as an alias of M3 → refused', !(D.find(S.db, 'project_materials', 'M3').aliases || []).some(a => /18mm/i.test(a)), m + ' M3 aliases=' + JSON.stringify(D.find(S.db, 'project_materials', 'M3').aliases));
  m = await ren('M3', null, 'White board, Old Oak');
  rec('A3v3 add a RETIRED material\'s name as an alias → refused', !(D.find(S.db, 'project_materials', 'M3').aliases || []).includes('Old Oak'), m);
  m = await ren('M1', 'MFC White');
  const r1 = D.find(S.db, 'project_materials', 'M1');
  rec('A3v4 rename M1 back to its own old spelling "MFC White" is allowed and keeps "MFC White 18mm" as an alias', r1.name === 'MFC White' && (r1.aliases || []).includes('MFC White 18mm'), m + ' ' + JSON.stringify(r1));
  // stale screen: a second PM screen with an old copy of the materials adds a name that the first just made an alias
  const pr2 = await F.dev(browser, S, 'prod');
  await ren('M3', null, 'White board, Snow');
  const m2 = await pr2.page.evaluate(async () => { lsMaterialsDlg('P1'); document.getElementById('mt-new-n').value = 'Snow'; document.getElementById('mt-add').click(); await new Promise(r => setTimeout(r, 500)); return (document.getElementById('mt-msg') || {}).textContent || ''; });
  rec('A3v5 (Low) a second screen with an older copy adds "Snow" just made an alias elsewhere → refused', answering('Snow').length === 1, m2 + ' → ' + answering('Snow') + ' (dup() checks this screen\'s cached materials only; no database rule on aliases)');
  // import-time "remember as alias" path (lsMatchDlg) — maps an unknown spelling onto M1 where the spelling is a RETIRED material's alias
  const viaMatch = await pr.page.evaluate(async () => { try { const mm = LST.m.get('M1'); await lsWrite('project_materials', mm, { aliases: [...new Set([...(mm.aliases || []), 'Oak 18'])] }); return 'written directly (same call lsMatchDlg makes)'; } catch (e) { return e.message; } });
  rec('A3v6 (info) the Excel "match to a material" path adds aliases without the clash check (lsMatchDlg → lsWrite)', true, viaMatch + ' → now answering "Oak 18": ' + answering('Oak 18'));
  rec('A9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  await pr.close(); await pr2.close();
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
