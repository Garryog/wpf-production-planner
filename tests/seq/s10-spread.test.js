// PM sequence B11b spread: ticked rows (or from here down) grouped into houses (same floor + unit — every row of a house gets
// the house date) in sequence order, from a start date at a pace, weekends and Irish bank holidays skipped; preview table
// first. "2 houses per week" from Tue 22 Dec 2026 must never land on 25–28 Dec. 360 px. Fake Supabase only.
// Run: node tests/seq/s10-spread.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const tick = (p, id) => p.evaluate(id => { const b = document.querySelector('[data-seqtick="' + id + '"]'); b.checked = !b.checked; b.onchange(); }, id);
const tk = (p, k) => p.evaluate(k => document.querySelector('[data-seqtk="' + k + '"]').click(), k);
const req = (S, id) => X.D.find(S.db, 'project_seq', id).req_date;
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  [['H1a', '1', 'K8', 'HOUSE'], ['H1b', '1', 'W2', 'BED 2'], ['H2', '2', 'K8', 'HOUSE'], ['H3', '3', 'K8', 'HOUSE'], ['H4', '4', 'K8', 'HOUSE']]
    .forEach(([id, u, p, n]) => X.seqRow(S, id, 'P1', { floor: 'T20', unit: u, product: p, name: n }));
  X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' });
  const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
  await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  await tick(pm.page, 'H1a'); await tk(pm.page, 'down');
  await X.dtOpen(pm.page, '[data-seqtool="spread"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-start': '2026-12-22', 'sd-pace': 'nweek', 'sd-pn': '2' });
  const tb = await pm.page.evaluate(() => [...document.querySelectorAll('.seq-sptbl tr')].slice(1).map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
  rec('preview table: 5 houses (T20 1 has 2 rows), 2 per week: 22, 22, 29, 29 Dec, 5 Jan', tb.length === 5 && /T20 1 2 Tue,? 22 Dec/.test(tb[0]) && /22 Dec/.test(tb[1]) && /29 Dec/.test(tb[2]) && /29 Dec/.test(tb[3]) && /5 Jan/.test(tb[4]), JSON.stringify(tb));
  let pv = await X.dtWhy(pm.page, 'Site not ready');
  rec('nothing lands on 25–28 Dec', !/2[5-8] Dec/.test(tb.join(' ')) && pv.ok, pv.prev);
  await X.dtSave(pm.page);
  const got = ['H1a', 'H1b', 'H2', 'H3', 'H4'].map(id => req(S, id));
  rec('saved: both rows of house 1 on 22 Dec, then 22, 29, 29 Dec', JSON.stringify(got) === JSON.stringify(['2026-12-22', '2026-12-22', '2026-12-22', '2026-12-29', '2026-12-29']), JSON.stringify(got));
  const o = await pm.page.evaluate(() => { const o = DB.orders.find(o => o.wo === 'WO-3'); return [o.delivDate, o.dueDate]; });
  rec('the job (5th house): delivery Tue 5 Jan 2027, build Wed 30 Dec (1 Jan skipped)', o[0] === '2027-01-05' && o[1] === '2026-12-30', JSON.stringify(o));
  await pm.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // 1 house per working day
  await pm.page.evaluate(() => render());
  await X.dtOpen(pm.page, '[data-seqtool="spread"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-start': '2026-12-22', 'sd-pace': 'wday' }); await X.dtWhy(pm.page, 'Site not ready');
  const tb2 = await pm.page.evaluate(() => [...document.querySelectorAll('.seq-sptbl tr')].slice(1).map(tr => tr.cells[2].innerText));
  rec('1 house per working day from 22 Dec: 22, 23, 24, 29, 30 Dec', /22 Dec/.test(tb2[0]) && /23 Dec/.test(tb2[1]) && /24 Dec/.test(tb2[2]) && /29 Dec/.test(tb2[3]) && /30 Dec/.test(tb2[4]), JSON.stringify(tb2));
  // every Friday: 25 Dec and 1 Jan are holidays → next working day
  await X.dtFill(pm.page, { 'sd-pace': 'dow', 'sd-dow': '5' });
  const tb3 = await pm.page.evaluate(() => [...document.querySelectorAll('.seq-sptbl tr')].slice(1).map(tr => tr.cells[2].innerText));
  rec('every Friday from 22 Dec: 25 Dec → Tue 29 Dec, 1 Jan → Mon 4 Jan, then 8, 15, 22 Jan', /29 Dec/.test(tb3[0]) && /4 Jan/.test(tb3[1]) && /8 Jan/.test(tb3[2]) && /15 Jan/.test(tb3[3]) && /22 Jan/.test(tb3[4]), JSON.stringify(tb3));
  await X.dtFill(pm.page, { 'sd-pace': 'nweek', 'sd-pn': '0' });
  rec('bad pace (0 per week): nothing to save, plain message', await pm.page.evaluate(() => document.querySelector('#sd-ok').disabled && /houses per week/.test(document.querySelector('#sd-prev').innerText)));
  await X.dtFill(pm.page, { 'sd-start': '' });
  rec('no start date: nothing to save', await pm.page.evaluate(() => document.querySelector('#sd-ok').disabled));
  await pm.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // a spread into the fixed window: the PM's job rows are listed for the Production Manager, waiting rows still change
  await pm.page.evaluate(() => render());
  await X.dtOpen(pm.page, '[data-seqtool="spread"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-start': '2026-10-27', 'sd-pace': 'wday' }); pv = await X.dtWhy(pm.page, 'Production');
  rec('spread starting inside the window: the job needs the Production Manager, waiting rows still change', /WO-3/.test(pv.prev) && /Production Manager/.test(pv.prev) && pv.ok, pv.prev);
  await pm.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await pm.close();
  // phone 360 px
  const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
  await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  await tick(ph.page, 'H1a'); await tk(ph.page, 'down');
  await X.dtOpen(ph.page, '[data-seqtool="spread"]'); await sleep(200);
  await X.dtFill(ph.page, { 'sd-start': '2026-12-22', 'sd-pace': 'nweek', 'sd-pn': '2' }); await X.dtWhy(ph.page, 'Site not ready');
  const sc = await X.noScroll(ph.page);
  rec('phone 360 px: spread dialog with its preview table fits', sc.sw <= sc.cw + 1, JSON.stringify(sc));
  await ph.close();
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
