// PM sequence step 6 (B6c): the required date on a sequence row (PC + 360 px). Today = Wed 21 Oct 2026; fixed window = 14
// days (to Wed 4 Nov). Sets the delivery date and build = delivery − 3 working days, with Job A's knock-ons (week, van,
// history, Dates to change in Cienapps, cut job keeps its week). A PM's change inside the window is NOT made (request
// request — B7, tests/seq/s11); the office changes it with fx:1. Waiting rows: version-checked req_date. Fake Supabase only.
// Run: node tests/seq/s8-row-date.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const job = (S, wo) => S.row.orders.find(o => o.wo === wo);
const pj = async (p, wo) => p.evaluate(wo => JSON.parse(JSON.stringify(DB.orders.find(o => o.wo === wo))), wo);
(async () => {
  const browser = await H.chromium.launch();
  const row = X.v2Row();
  row.orders.find(o => o.wo === 'WO-4').delVeh = 'VOLVO'; row.orders.find(o => o.wo === 'WO-4').delDay = 'Wed'; row.orders.find(o => o.wo === 'WO-4').delWk = '2026-11-23';
  const S = X.makeServer(row);
  X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' }); X.seqRow(S, 'QB', 'P1', { wo: 'WO-4', floor: 'T09', unit: '13' });
  X.seqRow(S, 'QC', 'P1', { wo: 'WO-1', floor: 'GF', unit: '12' }); X.seqRow(S, 'QW', 'P1', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE TYPE E' });
  const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
  await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  rec('PM: a 📅 on every row with a job or no WO yet', await pm.page.evaluate(() => document.querySelectorAll('[data-seqdate]').length) === 4);
  // ---- QA (WO-3, due 3 Dec, no delivery date) → required Thu 10 Dec
  await X.dtOpen(pm.page, '[data-seqdate="QA"]'); await sleep(200);
  rec('dialog opens with the current required date (build date when no delivery date)', await pm.page.evaluate(() => document.querySelector('#sd-date').value) === '2026-12-03');
  await X.dtFill(pm.page, { 'sd-date': '2026-12-10' });
  const p1 = await X.dtWhy(pm.page, 'Site not ready');
  rec('preview: required → 10 Dec, build → 7 Dec (3 working days before), week shown', /10 Dec/.test(p1.prev) && /7 Dec/.test(p1.prev) && p1.ok, p1.prev);
  await X.dtSave(pm.page);
  let o = await pj(pm.page, 'WO-3');
  rec('WO-3: delivery 10 Dec, build 7 Dec, week 7 Dec, origDueDate kept', o.delivDate === '2026-12-10' && o.dueDate === '2026-12-07' && o.plannedWeek === '2026-12-07' && o.origDueDate === '2026-12-03', JSON.stringify([o.delivDate, o.dueDate, o.plannedWeek, o.origDueDate]));
  const h = o.dueHist.slice(-2);
  rec('history: due + delivery entries, src pmseq, by John Burke, reason, not fx', h.length === 2 && h.every(x => x.src === 'pmseq' && x.by === 'John Burke' && x.why === 'Site not ready' && !x.fx), JSON.stringify(h));
  rec('Dates to change in Cienapps: due 3 Dec and "no delivery date" kept (dueKeep / delivKeep)', o.dueKeep === '2026-12-03' && o.delivKeep === '-', JSON.stringify([o.dueKeep, o.delivKeep]));
  await sleep(1600);
  rec('saved to the planner record', (job(S, 'WO-3') || {}).delivDate === '2026-12-10');
  // ---- day 14 / 15 edge on WO-4 (build 20 Nov, delivery 25 Nov, on a van) — PM
  await X.dtOpen(pm.page, '[data-seqdate="QB"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-11-09' }); let pv = await X.dtWhy(pm.page, 'Customer delay');
  rec('PM, required 9 Nov → build 4 Nov (day 14): goes to the Production Manager as a request (B7: Save = "✋ Send the request")', /sent to the Production Manager as ONE change request/.test(pv.prev) && pv.ok && await pm.page.evaluate(() => /Send the request/.test(document.querySelector('#sd-ok').textContent)), pv.prev);
  await X.dtFill(pm.page, { 'sd-date': '2026-11-10' }); pv = await pm.page.evaluate(() => ({ prev: document.querySelector('#sd-prev').innerText, ok: !document.querySelector('#sd-ok').disabled }));
  rec('PM, required 10 Nov → build 5 Nov (day 15): free, and the van booking comes off (rebook)', !/Production Manager/.test(pv.prev) && pv.ok && /off .*rebook/.test(pv.prev), pv.prev);
  await X.dtSave(pm.page);
  o = await pj(pm.page, 'WO-4');
  rec('WO-4 moved: build 5 Nov, delivery 10 Nov, taken off the van ("rebook")', o.dueDate === '2026-11-05' && o.delivDate === '2026-11-10' && !o.delDay && !!o.delRebook, JSON.stringify([o.dueDate, o.delivDate, o.delDay, !!o.delRebook]));
  // ---- PM on a fixed row (WO-1 due tomorrow): listed, NOT changed
  await X.dtOpen(pm.page, '[data-seqdate="QC"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-12-01' }); pv = await X.dtWhy(pm.page, 'Customer delay');
  rec('PM on a 🔒 fixed job: "sent to the Production Manager as ONE change request when you Save" (B7), not saved here', /ONE change request/.test(pv.prev) && /WO-1/.test(pv.prev) && pv.ok, pv.prev);
  await pm.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  rec('… WO-1 not changed', (await pj(pm.page, 'WO-1')).dueDate === '2026-10-22');
  // ---- waiting row: version-checked req_date
  await pm.page.evaluate(() => render()); await X.dtOpen(pm.page, '[data-seqdate="QW"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-11-30' }); await X.dtWhy(pm.page, 'Other', 'contractor programme rev C'); await X.dtSave(pm.page);
  const w = X.D.find(S.db, 'project_seq', 'QW');
  rec('waiting row: req_date 30 Nov with the reason, history by John Burke', w.req_date === '2026-11-30' && /contractor programme rev C/.test(w.why) && S.db.t.project_events.some(e => e.entity_id === 'QW' && e.act === 'date' && e.by === 'John Burke'), JSON.stringify([w.req_date, w.why]));
  // two PCs: another PC changes QW after this screen read it → "not saved"
  await pm.page.evaluate(async () => { await seqFresh('P1'); render(); });
  await X.dtOpen(pm.page, '[data-seqdate="QW"]'); await sleep(200);
  X.DS.seqUpdate(S.db, X.D.find(S.db, 'project_seq', 'QW'), { req_date: '2026-12-02', updated_by: 'Other PC' }, false);
  await X.dtFill(pm.page, { 'sd-date': '2026-12-14' }); await X.dtWhy(pm.page, 'Customer delay'); await X.dtSave(pm.page);
  const res2 = await pm.page.evaluate(() => (document.querySelector('.seq-res') || {}).innerText || (document.getElementById('toast') || {}).textContent);
  rec('two PCs: waiting row changed meanwhile → not saved, told; the other PC\'s date kept', X.D.find(S.db, 'project_seq', 'QW').req_date === '2026-12-02' && /Not saved/.test(res2), res2);
  await pm.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await pm.close();
  // ---- office: fixed job changed directly with a reason (fx:1); a cut job keeps its week
  const of = await X.dev(browser, S, 'office');
  await of.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-3').step = '6. JOB CUT COMPLETE'; seqOpen('P1'); }); await sleep(500);
  await X.dtOpen(of.page, '.seq-ovl [data-seqdate="QC"]'); await sleep(200);
  await X.dtFill(of.page, { 'sd-date': '2026-11-27' }); pv = await X.dtWhy(of.page, 'Production');
  rec('office on the fixed job: no request, "changed by … (logged)"', pv.ok && /fixed window — changed by Op/.test(pv.prev), pv.prev);
  await X.dtSave(of.page);
  o = await pj(of.page, 'WO-1');
  rec('WO-1: delivery 27 Nov, build 24 Nov, history fx:1', o.delivDate === '2026-11-27' && o.dueDate === '2026-11-24' && o.dueHist.slice(-1)[0].fx === 1 && o.dueHist.slice(-1)[0].src === 'pmseq', JSON.stringify(o.dueHist.slice(-1)));
  await of.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); seqOpen('P1'); }); await sleep(400);
  await X.dtOpen(of.page, '.seq-ovl [data-seqdate="QA"]'); await sleep(200);
  await X.dtFill(of.page, { 'sd-date': '2026-12-21' }); pv = await X.dtWhy(of.page, 'Customer delay');
  rec('cut job: preview says build week kept (already cut)', /already cut/.test(pv.prev), pv.prev);
  await X.dtSave(of.page);
  o = await pj(of.page, 'WO-3');
  rec('cut job: dates moved, build week kept 7 Dec, "check week" chip', o.delivDate === '2026-12-21' && o.plannedWeek === '2026-12-07' && !!o.dueMv, JSON.stringify([o.delivDate, o.plannedWeek, o.dueMv]));
  await of.close();
  // ---- 360 px phone: the dialog fits
  const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
  await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  const bt = await ph.page.evaluate(() => { const b = document.querySelector('[data-seqdate="QW"]').getBoundingClientRect(); return b.height; });
  await X.dtOpen(ph.page, '[data-seqdate="QW"]'); await sleep(200);
  const sc = await X.noScroll(ph.page);
  const fits = await ph.page.evaluate(() => { const b = document.querySelector('.seq-dtdlg .pod-in').getBoundingClientRect(); return b.left >= 0 && b.right <= 361; });
  rec('phone 360 px: 📅 tappable, date dialog fits, no sideways scroll', bt >= 36 && fits && sc.sw <= sc.cw + 1, JSON.stringify([bt, sc]));
  await ph.close();
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
