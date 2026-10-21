// Tester attack: regressions around the N/A box — board readiness, list Undo, combined table, print today, labels,
// "cutting list needed" flags. Stubbed Supabase only. Run: node tests/sawstores/attack-regress.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-21T09:00:00Z';
const ROWS = [
  { k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Top', qty: 2, L: 1200, W: 600, mat: 'MFC White', note: '' },
  { k: 'fit', item: 'Hinge', qty: 10, mat: 'Blum', note: '' },
];
const row = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-2', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-9', dueDate: '2026-10-23', origDueDate: '2026-10-23' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 2, fit: 1, wos: ['WO-1'], up: NOW }, { id: 'L2', wb: 'W1', sheet: 'H1', name: 'House 2', project: 'Proj', saw: 2, fit: 1, wos: ['WO-2'], up: NOW }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: ROWS } } } } });
const tap = (p, attr, id, i) => p.evaluate(({ attr, id, i }) => { const k = listRows(lists()[0]).map(rowKey)[i]; const b = [...document.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr) === id + '|' + k); if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; }, { attr, id, i });
(async () => {
  const browser = await H.chromium.launch();
  const S = makeServer(row());
  const A = await open(browser, S, { now: NOW, role: 'saw' });
  await A.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); });
  const rd = () => A.page.evaluate(() => ({ w1: woReady('WO-1').lvl + '/' + woReady('WO-1').saw, need: listsNeeded().map(o => o.wo).join(',') }));
  rec('start: WO-1 red (saw open), WO-9 flagged as needing a list', (await rd()).w1 === 'red/open' && /WO-9/.test((await rd()).need), JSON.stringify(await rd()));
  await tap(A.page, 'data-rna', 'L1', 0);
  rec('N/A one line → WO-1 saw side "hold" (amber on board)', (await rd()).w1 === 'amber/hold', JSON.stringify(await rd()));
  // Print today: held line printed as WAITING, others normal
  const pr = await A.page.evaluate(() => { window.__opened = []; printWorkList('saw', 1); return window.__opened.slice(-1)[0] || ''; });
  rec('Print today shows the N/A line as WAITING ON MATERIAL', /WAITING ON MATERIAL<\/b> — Side/.test(pr), (pr.match(/WAITING ON MATERIAL[^<]*<\/b>[^<]*/g) || []).join(' | '));
  await tap(A.page, 'data-rt', 'L1', 1);
  const st = await A.page.evaluate(() => ({ done: !!listDone('L1').saw, r: woReady('WO-1') }));
  rec('tick the other line → list auto-done, still amber because of waiting line', st.done && st.r.lvl === 'amber' && st.r.saw === 'hold', JSON.stringify(st));
  // combined table excludes the N/A line
  const cmb = await A.page.evaluate(() => combineLists(lists(), 'saw').map(r => r.item + ':' + r.qty).join(','));
  rec('combined table leaves out the N/A line for House 1', cmb.split(',').sort().join() === 'Side:4,Top:4', cmb);
  // Labels: does an N/A (not cut) line still get a label?
  const lb = await A.page.evaluate(() => { window.__opened = []; printLabels([lists()[0]], 'saw'); const h = window.__opened.slice(-1)[0] || ''; return (h.match(/class="lb-item">([^<]*)/g) || []).join('|'); });
  rec('(pre-existing) A4 labels: no location label printed for a line that is waiting (not cut)', !/>Side$|>Side\|/.test(lb), lb);
  // list Undo ("Put this list back in the queue") after a two-screen clash leaves a stale hold
  await A.page.evaluate(() => { const l = lists()[1], k = listRows(l).map(rowKey)[0]; holdRows(l, [k], 'saw', 'B-old'); DB.listRow = DB.listRow || {}; DB.listRow.L2 = { [k]: { m: 'saw', at: new Date().toISOString(), by: 'A' } }; markListDone(['L2'], 'saw', 'A'); render(); });
  const before = await A.page.evaluate(() => ({ s: sideState(lists()[1], 'saw'), w: allHolds(['saw'], 'hold').length }));
  await A.page.evaluate(() => { window.__open = 0; wlShowDone = true; render(); const b = document.querySelector('[data-wlundo="L2"]'); if (b) b.click(); wlShowDone = false; render(); });
  const after = await A.page.evaluate(() => ({ s: sideState(lists()[1], 'saw'), w: allHolds(['saw'], 'hold').length, by: (allHolds(['saw'], 'hold').find(x => x.l.id === 'L2') || { v: {} }).v.by }));
  rec('list Undo after a clash does NOT resurrect the stale N/A as WAITING', after.w === before.w, JSON.stringify({ before, after }));
  rec('no page errors', !(A.server.errors || []).length && !(S.errors || []).length, JSON.stringify(A.server.errors || S.errors || []));
  await A.close(); await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
