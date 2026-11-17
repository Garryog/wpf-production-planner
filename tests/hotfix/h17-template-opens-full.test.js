// Hotfix 17 Nov (Garry: "all these are now empty"): a TEMPLATE / archived list's rows are not loaded when the page starts.
// ✎ Edit and View must load them first — never show an empty list. Fake Supabase only.
// Run: node tests/hotfix/h17-template-opens-full.test.js
const F = require('../stage3/fix3.js');
const { sleep } = F;
const X = { H: F.H, makeServer: F.makeServer, v2Row: F.v2Row, dev: F.dev, F3: { seedList: F.seedList } };
const results = []; const rec = (n, ok, d) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const M = 'MFC White';
(async () => {
  const browser = await X.H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'TPL', { wos: [], name: 'T2 LH', list: { is_template: true, type_name: 'T2 LH', list_type: 'kitchen' },
      lines: [['hdr', 'Worktops', null, null, null, null, '', ''], ['saw', 'Worktop', '1', 3600, 600, M, '', ''], ['saw', 'Worktop', '1', 1600, 600, M, '', ''], ['fit', 'Tap', '1', null, null, 'Tap A', '', '']] });
    X.F3.seedList(S, 'ARC', { wos: [], name: 'Old house', list: { archived: true }, lines: [['saw', 'Side', '2', 720, 560, M, '', '']] });
    const t = await X.dev(browser, S, 'design'), p = t.page;
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    const loaded = await p.evaluate(() => LST.full.has('TPL'));
    rec('set-up: the template\'s rows are NOT loaded at start (as on the live site)', !loaded, String(loaded));
    await p.evaluate(() => openListEditor('TPL')); await sleep(1500);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].map(e => e.value).filter(Boolean));
    rec('✎ Edit on a template not loaded yet → the window shows its rows', rows.includes('Worktop') && rows.includes('Tap'), JSON.stringify(rows));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await p.evaluate(() => lsViewDlg('ARC')); await sleep(1500);
    const v = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });
    rec('View on an archived list not loaded yet → its rows show', /Side/.test(v), v.slice(0, 160));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await p.evaluate(() => lsViewDlg('TPL')); await sleep(1500);
    const v2 = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });
    rec('View on a template not loaded yet → its rows show', /Worktop/.test(v2) && /Tap/.test(v2), v2.slice(0, 160));
    rec('database untouched: the template still has its 4 rows', S.db.t.list_lines.filter(x => x.list_id === 'TPL' && x.removed_rev == null).length === 4);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = results.filter(x => !x).length; console.log(f + ' failed of ' + results.length); process.exit(f ? 1 : 0);
})();
