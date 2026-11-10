// ATTACK 5 — the round-4 material name / alias clash fix (matKey + pm_no_clash trigger), attacked with unicode: NBSP,
// accents typed two ways, full-width letters, tabs, zero-width space; and the Excel "match to a material" screen
// (lsMatchDlg) driven through its real buttons, incl. "remembered next time" for a spelling that differs only in spaces.
// NOTE: db3.js mirrors pm_key() in JS, so this cannot prove what real Postgres regex '\s' matches. Fake Supabase only.
// Run: node tests/stage3/attack5-mats.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
  D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Lamé Oak', kind: 'sheet' });
  D.insert(S.db, 'project_materials', { id: 'M4', project_id: 'P1', name: 'Old Oak', kind: 'sheet', aliases: ['Oak 18'], active: false });
  const pr = await F.dev(browser, S, 'prod');
  const open = () => pr.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsMaterialsDlg('P1'); });
  const add = async name => { await open(); return pr.page.evaluate(async name => { document.getElementById('mt-new-n').value = name; document.getElementById('mt-add').click(); await new Promise(r => setTimeout(r, 600)); return (document.getElementById('mt-msg') || {}).textContent || ''; }, name); };
  const mk = s => String(s).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const n = () => S.db.t.project_materials.filter(m => m.project_id === 'P1').length;
  const cases = [
    ['MFC White', 'NBSP between words', true],
    ['MFC White\t', 'trailing tab', true],
    ['ＭＦＣ White', 'full-width MFC', true],
    ['Lamé Oak', 'accent typed as e + combining mark (NFD)', true],
    ['LAMÉ OAK', 'accent, upper case', true],
    ['MFC​White', 'zero-width space inside (looks like "MFCWhite")', false],
    ['MFC White', 'em space', true],
  ];
  for (const [name, why, mustRefuse] of cases) {
    const before = n(); const m = await add(name); const added = n() > before;
    if (mustRefuse) rec('MA ' + why + ': "' + JSON.stringify(name) + '" refused as a duplicate', !added, m || '(no message) materials=' + n());
    else info('MA ' + why + ': ' + JSON.stringify(name), added ? 'ADDED as a separate material (key "' + mk(name) + '") — looks identical on screen to "MFCWhite"' : 'refused: ' + m);
  }
  // ---- the Excel match screen, through its buttons ----
  const runMatch = (names, picks) => pr.page.evaluate(async ({ names, picks }) => {
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    window.__toasts = []; const t0 = window.toast; window.toast = m => { window.__toasts.push(m); };
    let res = 'pending'; lsMatchDlg(names, 'P1', r => { res = r; });
    picks.forEach((v, i) => { const s = document.querySelector('[data-mm="' + i + '"]'); s.value = v; });
    document.getElementById('mm-ok').click();
    for (let i = 0; i < 40 && res === 'pending'; i++) await new Promise(r => setTimeout(r, 100));
    window.toast = t0; const open = !!document.querySelector('#mm-ok'); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    return { res, toasts: window.__toasts, open };
  }, { names, picks });
  // two new spellings for the same new board, both "Add" in one go
  let r = await runMatch(['Grey Gloss 18', 'grey  gloss 18'], ['__add', '__add']);
  const greys = S.db.t.project_materials.filter(m => m.project_id === 'P1' && /grey/i.test(m.name)).length;
  rec('MM1 two spellings of one new board both set to "Add": one material, upload goes ahead', greys === 1 && r.res && typeof r.res === 'object', JSON.stringify(r) + ' greys=' + greys);
  // two different spellings mapped to the SAME existing material in one go (each becomes an alias)
  r = await runMatch(['White MFC', 'W/MFC'], ['M1', 'M1']);
  const m1 = D.find(S.db, 'project_materials', 'M1');
  rec('MM2 two new spellings both matched to MFC White in one go: both remembered as other spellings, upload goes ahead', (m1.aliases || []).includes('White MFC') && (m1.aliases || []).includes('W/MFC') && r.res && typeof r.res === 'object', JSON.stringify(r) + ' aliases=' + JSON.stringify(m1.aliases));
  // a spelling that is the other spelling of a RETIRED material, matched to M1 → the screen says "pick that one" — can they?
  r = await runMatch(['oak 18'], ['M1']);
  const opts = await pr.page.evaluate(() => { lsMatchDlg(['oak 18'], 'P1', () => {}); const o = [...document.querySelectorAll('[data-mm="0"] option')].map(x => x.textContent); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); return o; });
  rec('MM3 (Low) "oak 18" (other spelling of the retired Old Oak) matched to MFC White: told to pick Old Oak — and Old Oak is in the list to pick',
    opts.some(x => /Old Oak/.test(x)), 'told=' + JSON.stringify(r.toasts) + ' dropdown=' + JSON.stringify(opts));
  // "the match is remembered next time": a workbook spelling that differs from MFC White only by a double space / NBSP
  const unk = await pr.page.evaluate(() => { lsReset(); return lsLoad().then(() => { const wb = { sheets: { A: [{ k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC  White', note: '' }, { k: 'saw', item: 'Top', qty: 1, L: 900, W: 560, mat: 'MFC White', note: '' }] } }; return lsUnknownMats(wb, [{ sheet: 'A' }], 'P1'); }); });
  rec('MM4 (Low) a workbook saying "MFC  White" (double space) or "MFC<NBSP>White" is recognised as MFC White — not asked about on every upload',
    unk.length === 0, 'asked about: ' + JSON.stringify(unk) + ' (lsMatSet / lsUnknownMats / lsFlagMats compare trim().toLowerCase(), not matKey(); matching it to MFC White writes no alias because matKey says it is the same, so it is asked again next upload)');
  const flag = await pr.page.evaluate(() => { const ls = [{ kind: 'saw', material: 'MFC  White' }, { kind: 'saw', material: 'MFC White' }]; lsFlagMats(ls, 'P1'); return ls.map(x => x.material_other); });
  rec('MM5 (Low) typed list line "MFC  White" is not flagged "not on the project list"', flag.every(x => !x), JSON.stringify(flag));
  rec('M9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  await pr.close(); await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
