// PM sequence B11a + B11c: tick boxes with Whole house / Whole block / From here down; one date for all ticked rows; push
// / pull by working days or weeks (weekends + Irish bank holidays skipped). Mixed push over 🔒 fixed and free rows: a PM's
// free rows change, the fixed ones are listed for the Production Manager. Office does it directly. 360 px. Fake Supabase only.
// Run: node tests/seq/s9-bulk-push.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const pj = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(o => o.wo === wo); return { due: o.dueDate, deliv: o.delivDate || '', h: (o.dueHist || []).length }; }, wo);
const ticked = p => p.evaluate(() => [...document.querySelectorAll('[data-seqtick]')].filter(b => b.checked).map(b => b.dataset.seqtick).join(','));
const tick = (p, id) => p.evaluate(id => { const b = document.querySelector('[data-seqtick="' + id + '"]'); b.checked = !b.checked; b.onchange(); }, id);
const tk = (p, k) => p.evaluate(k => document.querySelector('[data-seqtk="' + k + '"]').click(), k);
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  X.seqRow(S, 'QC', 'P1', { wo: 'WO-1', floor: 'GF', unit: '12' }); X.seqRow(S, 'QD', 'P1', { wo: 'WO-2', floor: '1', unit: '14' });
  X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' }); X.seqRow(S, 'QB', 'P1', { wo: 'WO-4', floor: 'T09', unit: '13' });
  X.seqRow(S, 'QW', 'P1', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE E', req_date: '2026-11-30' }); X.seqRow(S, 'QX', 'P1', { floor: 'T09', unit: '16', product: 'K8', name: 'HOUSE F' });
  const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
  await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  // ---- tick helpers
  await tick(pm.page, 'QA'); await tk(pm.page, 'house'); await sleep(100);
  rec('Whole house: QA ticked → QA + QB (T09 13)', await ticked(pm.page) === 'QA,QB', await ticked(pm.page));
  await tk(pm.page, 'block'); await sleep(100);
  rec('Whole block: every T09 row', await ticked(pm.page) === 'QA,QB,QW,QX', await ticked(pm.page));
  await tk(pm.page, 'clear'); await tick(pm.page, 'QW'); await tk(pm.page, 'down'); await sleep(100);
  rec('From here down: QW and everything below', await ticked(pm.page) === 'QW,QX', await ticked(pm.page));
  // ---- bulk set: the house to Mon 14 Dec
  await tk(pm.page, 'clear'); await tick(pm.page, 'QA'); await tk(pm.page, 'house');
  await X.dtOpen(pm.page, '[data-seqtool="set"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-12-14' }); let pv = await X.dtWhy(pm.page, 'Site not ready');
  rec('Set date for 2 ticked rows: preview lists both, Save (2)', /WO-3/.test(pv.prev) && /WO-4/.test(pv.prev) && pv.ok, pv.prev);
  await X.dtSave(pm.page);
  const a = await pj(pm.page, 'WO-3'), b = await pj(pm.page, 'WO-4');
  rec('both jobs: delivery 14 Dec, build 9 Dec', a.deliv === '2026-12-14' && a.due === '2026-12-09' && b.deliv === '2026-12-14' && b.due === '2026-12-09', JSON.stringify([a, b]));
  // ---- mixed push by a PM: from the top down, later by 3 working days
  await tk(pm.page, 'clear'); await tick(pm.page, 'QC'); await tk(pm.page, 'down');
  await X.dtOpen(pm.page, '[data-seqtool="push"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-dir': '1', 'sd-n': '3', 'sd-u': 'wd' }); pv = await X.dtWhy(pm.page, 'Customer delay');
  rec('PM mixed push: preview says 2 need the Production Manager (WO-1, WO-2), rest changes, HOUSE F has no date', /2 need the Production Manager/.test(pv.prev) && /WO-1, WO-2/.test(pv.prev) && /no date to move from/.test(pv.prev) && pv.ok, pv.prev);
  await X.dtSave(pm.page);
  const a2 = await pj(pm.page, 'WO-3'), c1 = await pj(pm.page, 'WO-1');
  rec('free rows pushed 3 working days (build 9 → 14 Dec, delivery 14 → 17 Dec); fixed WO-1 unchanged', a2.due === '2026-12-14' && a2.deliv === '2026-12-17' && c1.due === '2026-10-22', JSON.stringify([a2, c1]));
  rec('waiting row pushed: 30 Nov → 3 Dec', X.D.find(S.db, 'project_seq', 'QW').req_date === '2026-12-03', X.D.find(S.db, 'project_seq', 'QW').req_date);
  const rt = await pm.page.evaluate(() => ([...document.querySelectorAll('.seq-res')].pop() || {}).innerText || 'none:' + (document.getElementById('toast') || {}).textContent);
  rec('result lists the jobs that need the Production Manager', /NOT changed: WO-1, WO-2/.test(rt), rt);
  await pm.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // ---- push by weeks onto Christmas: Fri 18 Dec + 1 week = Fri 25 Dec → next working day Tue 29 Dec
  X.DS.seqUpdate(S.db, X.D.find(S.db, 'project_seq', 'QX'), { req_date: '2026-12-18', updated_by: 'Seed' }, false);
  await pm.page.evaluate(async () => { await seqFresh('P1'); render(); });
  await tk(pm.page, 'clear'); await tick(pm.page, 'QX');
  await X.dtOpen(pm.page, '[data-seqtool="push"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-dir': '1', 'sd-n': '1', 'sd-u': 'wk' }); await X.dtWhy(pm.page, 'Production'); await X.dtSave(pm.page);
  rec('push 1 week onto Christmas Day → Tue 29 Dec (25, 26, 28 Dec skipped)', X.D.find(S.db, 'project_seq', 'QX').req_date === '2026-12-29', X.D.find(S.db, 'project_seq', 'QX').req_date);
  rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await pm.close();
  // ---- office: pull earlier 1 working day over fixed + free → all change, fixed ones logged fx:1
  const of = await X.dev(browser, S, 'office');
  await of.page.evaluate(() => seqOpen('P1')); await sleep(500);
  await tick(of.page, 'QC'); await tick(of.page, 'QD');
  await X.dtOpen(of.page, '.seq-ovl [data-seqtool="push"]'); await sleep(200);
  await X.dtFill(of.page, { 'sd-dir': '-1', 'sd-n': '1', 'sd-u': 'wd' }); pv = await X.dtWhy(of.page, 'Production'); await X.dtSave(of.page);
  const c2 = await of.page.evaluate(() => { const o = DB.orders.find(o => o.wo === 'WO-1'); return { due: o.dueDate, fx: o.dueHist.slice(-1)[0].fx }; });
  rec('office pulls the fixed jobs a working day earlier: changed, fx:1', c2.due === '2026-10-21' && c2.fx === 1, JSON.stringify(c2));
  await of.close();
  // ---- phone 360 px
  const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
  await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  await tick(ph.page, 'QA'); await tk(ph.page, 'house'); await sleep(200);
  const bar = await ph.page.evaluate(() => { const b = document.querySelector('.seq-tbar'); return { pos: getComputedStyle(b).position, tools: b.querySelectorAll('[data-seqtool]').length, h: b.querySelector('[data-seqtool]').getBoundingClientRect().height }; });
  const sc = await X.noScroll(ph.page);
  rec('phone 360 px: tick bar sticks to the bottom with the tools, no sideways scroll', bar.pos === 'sticky' && bar.tools >= 2 && bar.h >= 40 && sc.sw <= sc.cw + 1, JSON.stringify([bar, sc]));
  await X.dtOpen(ph.page, '[data-seqtool="push"]'); await sleep(200);
  const sc2 = await X.noScroll(ph.page);
  rec('phone: push dialog fits', sc2.sw <= sc2.cw + 1, JSON.stringify(sc2));
  await ph.close();
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
