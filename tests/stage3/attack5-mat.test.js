// ATTACK 5 — material clash rule (88c7a83, 9f11818, DB trigger pm_no_clash): two screens adding / renaming at once, a
// race the screen check can't see, and the Excel "materials not on the list" path matching another material's alias.
// Fake Supabase only. Run: node tests/stage3/attack5-mat.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const mats = S => S.db.t.project_materials.filter(m => m.project_id === 'P1').map(m => m.name + (m.aliases && m.aliases.length ? '[' + m.aliases.join('/') + ']' : '')).sort().join(', ');
function setup() {
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
  D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Oak Veneer', kind: 'sheet', aliases: ['MFC Oak'] });
  return S;
}
async function office(browser, S) {
  const t = await F.dev(browser, S, 'office');
  await t.page.evaluate(() => { window.__t = []; toast = m => window.__t.push(String(m)); window.prompt = () => '9000'; window.confirm = () => true; });
  return t;
}
const delayPost = (t, ms) => t.page.route(u => /project_materials/.test(String(u)), async r => { if (['POST', 'PATCH'].includes(r.request().method())) await F.sleep(ms); return r.fallback(); });
async function addMat(t, name) {
  return t.page.evaluate(async name => {
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    lsMaterialsDlg('P1'); await new Promise(r => setTimeout(r, 100));
    document.querySelector('#mt-new-n').value = name; document.querySelector('#mt-add').click();
    await new Promise(r => setTimeout(r, 1500));
    return { msg: (document.querySelector('#mt-msg') || {}).textContent || '', toasts: window.__t.slice(-3) };
  }, name);
}
// the Excel path: names in the workbook that are not on the list, each set to a choice ('' keep, material id, '__add')
async function matchDlg(t, names, picks) {
  return t.page.evaluate(async ({ names, picks }) => {
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); window.__t = [];
    let res = 'not closed'; lsMatchDlg(names, 'P1', m => { res = m; });
    picks.forEach((v, i) => { document.querySelector('[data-mm="' + i + '"]').value = v; });
    document.querySelector('#mm-ok').click();
    await new Promise(r => setTimeout(r, 1500));
    return { res, toasts: window.__t.slice(), open: !!document.querySelector('[data-mm]') };
  }, { names, picks });
}
(async () => {
  const browser = await H.chromium.launch();
  { // K1: Ann adds "MFC  White " (case / spaces), "mfc oak" (another material's alias) — both refused
    const S = setup(); const a = await office(browser, S);
    const r1 = await addMat(a, 'mfc  WHITE '); const r2 = await addMat(a, 'mfc oak');
    rec('K1 adding a name that is an existing name (spaces/case) or another material\'s alias is refused', /already/.test(r1.msg) && /already/.test(r2.msg) && S.db.t.project_materials.length === 3, r1.msg + ' | ' + r2.msg + ' | ' + mats(S));
    await a.close();
  }
  { // K2: two screens, Ann's add is slow on the wire; Bob adds the same board meanwhile — the database refuses the second
    const S = setup(); const a = await office(browser, S), b = await office(browser, S);
    await delayPost(a, 800);
    const pa = addMat(a, 'MFC Grey'); await F.sleep(250);
    const rb = await addMat(b, 'mfc grey'); const ra = await pa;
    const n = S.db.t.project_materials.filter(m => /grey/i.test(m.name)).length;
    rec('K2 two screens add the same board at once: exactly one added, the other told', n === 1 && (/already|used/.test(ra.msg + ra.toasts.join()) || /already|used/.test(rb.msg + rb.toasts.join())), 'n=' + n + ' Ann=' + JSON.stringify(ra) + ' Bob=' + JSON.stringify(rb));
    await a.close(); await b.close();
  }
  { // K3: Bob gives MFC White the other spelling "W/MFC" while Ann (screen open before) adds "w/mfc" as a new material
    const S = setup(); const a = await office(browser, S), b = await office(browser, S);
    await b.page.evaluate(async () => { const m = LST.m.get('M1'); await lsWrite('project_materials', m, { aliases: ['W/MFC'] }); });
    const ra = await addMat(a, 'w/mfc');
    rec('K3 a stale screen adding a name that another screen just made an alias is refused', /already/.test(ra.msg) && !S.db.t.project_materials.some(m => m.name === 'w/mfc'), ra.msg + ' | ' + mats(S));
    await a.close(); await b.close();
  }
  { // K4: Excel path — workbook says "MFC  Oak" (double space): it is Oak Veneer's other spelling
    const S = setup(); const a = await office(browser, S);
    const unk = await a.page.evaluate(() => lsUnknownMats({ sheets: { S1: [{ k: 'saw', item: 'Side', mat: 'MFC  Oak' }, { k: 'saw', item: 'Top', mat: 'mfc white' }, { k: 'saw', item: 'Back', mat: 'MFC White' }] } }, [{ sheet: 'S1' }], 'P1'));
    rec('K4a names that only differ by spaces from a material or alias are NOT asked about in the Excel match screen (same rule as the clash check)', unk.length === 0, 'asked about: ' + JSON.stringify(unk) + ' (lsUnknownMats/lsMatSet compare trim+lowercase only; lsMatClash uses matKey)');
    // "Add" picked for "MFC  Oak" → must map to Oak Veneer, not add a clash
    const r = await matchDlg(a, ['MFC  Oak'], ['__add']);
    rec('K4b Excel "Add" for a name that is another material\'s alias maps to that material, nothing added', r.res && r.res['mfc  oak'] === 'Oak Veneer' && S.db.t.project_materials.length === 3, JSON.stringify(r) + ' | ' + mats(S));
    // matched to MFC White instead → refused (it is Oak Veneer's spelling); dialog stays open
    const r2 = await matchDlg(a, ['MFC  Oak'], ['M1']);
    rec('K4c Excel match of "MFC  Oak" to MFC White is refused (it is Oak Veneer\'s spelling), dialog stays open, no alias written', r2.res === 'not closed' && r2.open && /Oak Veneer/.test(r2.toasts.join()) && !(S.db.t.project_materials.find(m => m.id === 'M1').aliases || []).length,
      JSON.stringify(r2) + ' | ' + mats(S));
    await a.close();
  }
  { // K5: two names in one dialog: "MFC Grey" → Add (written), "MFC Oak" → MFC White (refused). Fix the second and save again.
    const S = setup(); const a = await office(browser, S);
    const r1 = await matchDlg(a, ['MFC Grey', 'MFC Oak '], ['__add', 'M1']);
    const after1 = mats(S);
    const r2 = await a.page.evaluate(async () => { document.querySelector('[data-mm="1"]').value = 'M3'; document.querySelector('#mm-ok').click(); await new Promise(r => setTimeout(r, 1500)); return { open: !!document.querySelector('[data-mm]'), toasts: window.__t.slice() }; });
    const greys = S.db.t.project_materials.filter(m => /grey/i.test(m.name)).length;
    rec('K5 refused mid-way then corrected: one MFC Grey (no duplicate / error on the second press), dialog closes', greys === 1 && !r2.open, 'after first press: ' + after1 + ' | second: ' + JSON.stringify(r2) + ' | ' + mats(S));
    await a.close();
  }
  { // K6: Excel match on a stale screen: Bob just gave MFC White the spelling "MFC Walnut"; Ann matches "MFC Walnut" to Oak Veneer
    const S = setup(); const a = await office(browser, S), b = await office(browser, S);
    await b.page.evaluate(async () => { await lsWrite('project_materials', LST.m.get('M1'), { aliases: ['MFC Walnut'] }); });
    const r = await matchDlg(a, ['MFC Walnut'], ['M3']);
    rec('K6 stale Excel match screen: the fresh check refuses an alias another screen just gave a different material', r.res === 'not closed' && /MFC White/.test(r.toasts.join()) && (S.db.t.project_materials.find(m => m.id === 'M3').aliases || []).length === 1, JSON.stringify(r) + ' | ' + mats(S));
    await a.close(); await b.close();
  }
  { // K7: race in the Excel path: Ann's alias write is slow; Bob gives the same spelling to another material meanwhile → DB refuses Ann's
    const S = setup(); const a = await office(browser, S), b = await office(browser, S);
    await delayPost(a, 800);
    const pa = matchDlg(a, ['Oak Ven'], ['M3']); await F.sleep(300);
    await b.page.evaluate(async () => { await lsMatFresh('P1'); await lsWrite('project_materials', LST.m.get('M1'), { aliases: ['oak  ven'] }); });
    const r = await pa;
    const owners = S.db.t.project_materials.filter(m => (m.aliases || []).some(x => /oak\s+ven/i.test(x))).map(m => m.id);
    rec('K7 two screens give the same spelling to different materials at once: only one gets it, Ann is told, dialog stays', owners.length === 1 && (r.res === 'not closed' || owners[0] === 'M3'), 'owners=' + owners + ' Ann=' + JSON.stringify(r));
    await a.close(); await b.close();
  }
  { // K8: rename on two screens: Ann renames Oak Veneer → "Oak" while Bob renames MFC White → "oak " (stale)
    const S = setup(); const a = await office(browser, S), b = await office(browser, S);
    const ren = (t, id, name) => t.page.evaluate(async ({ id, name }) => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsMaterialsDlg('P1'); await new Promise(r => setTimeout(r, 100));
      document.querySelector('[data-mtn="' + id + '"]').value = name; document.querySelector('[data-mts="' + id + '"]').click(); await new Promise(r => setTimeout(r, 1500)); return (document.querySelector('#mt-msg') || {}).textContent || ''; }, { id, name });
    await a.page.evaluate(() => 0); const ma = await ren(a, 'M3', 'Oak'); const mb = await ren(b, 'M1', 'oak ');
    const names = S.db.t.project_materials.filter(m => /^oak\s*$/i.test(m.name)).length;
    rec('K8 two screens rename two materials to the same name: one wins, the other is told', names === 1 && /already/.test(mb), 'a=' + ma + ' b=' + mb + ' | ' + mats(S));
    // and the renamed Oak Veneer kept its old name as a spelling, so "MFC White" can't be renamed to "Oak Veneer" either
    const mc = await ren(b, 'M1', 'Oak Veneer');
    rec('K8b a material can\'t take another material\'s OLD name (kept as its other spelling after a rename)', /already/.test(mc), mc + ' | ' + mats(S));
    await a.close(); await b.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
