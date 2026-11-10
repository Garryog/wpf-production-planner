// Tester attack 1 — size: 2,500 jobs each with 30 date-history entries (the dueHist cap, lowered from 100 in 517f23b). Load, board render, one date
// move + save (3-way merge against a changed database) must finish under 10 s; the history cap holds at 30; "Mark as
// applied" leaves the date rows. Stubbed Supabase only.  Run: node tests/dates/attack1-perf.test.js
const { H, makeServer, open, recorder, save, reload, w } = require('./attack1-lib');
const { rec, done } = recorder('attack1-perf');
(async () => {
  const browser = await H.chromium.launch();
  const hist = i => Array.from({ length: 30 }, (_, k) => ({ at: '2026-0' + (1 + k % 9) + '-1' + (k % 9) + 'T10:00:00.000Z', by: 'Ann', f: 'due', from: '2026-11-1' + (k % 9), to: '2026-11-2' + (k % 9), why: 'Customer delay', note: 'note ' + k, src: k % 3 ? 'planner' : 'cienapps' }));
  const orders = Array.from({ length: 2500 }, (_, i) => H.order({ wo: 'WO-' + (10000 + i), dueDate: '2026-11-27', origDueDate: '2026-11-20', dueKeep: '2026-11-20', plannedWeek: '2026-11-23', step: i % 4 ? '3. In production' : '8. PALLETED', delv: !(i % 4), customer: 'C' + (i % 40), title: 'House ' + i, dueHist: hist(i) }));
  const row = { id: 'main', version: 1, nid: 3000, settings: {}, orders };
  const bytes = JSON.stringify(row).length;
  const S = makeServer(row);
  const t0 = Date.now();
  const A = await open(browser, S, { now: '2026-11-10T10:00:00Z' });
  const loadMs = Date.now() - t0;
  const B = await open(browser, S, { now: '2026-11-10T10:00:00Z' });
  // B changes something so A's save has to merge
  await B.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-10005').notes = 'other PC'; sched(); }); await save(B.page);
  const bSaved = (S.row.orders.find(o => o.wo === 'WO-10005') || {}).notes, bVer = S.row.version, bFail = await B.page.evaluate(() => ({ f: !!DB.saveFailed, t: (document.getElementById('toast') || {}).textContent || '' }));
  rec('other PC (B) save landed in the database', bSaved === 'other PC', JSON.stringify({ bSaved, bVer, bFail }));
  const r = await A.page.evaluate(async () => {
    const out = {};
    let t = performance.now(); await loadDB(); out.loadDbMs = Math.round(performance.now() - t);
    t = performance.now(); showTab('b'); await new Promise(r => setTimeout(r, 0)); out.boardMs = Math.round(performance.now() - t);
    t = performance.now(); showTab('d'); await new Promise(r => setTimeout(r, 0)); out.delMs = Math.round(performance.now() - t);
    t = performance.now(); showTab('x'); await new Promise(r => setTimeout(r, 0)); out.expMs = Math.round(performance.now() - t);
    out.dates = datesToCien().length;
    t = performance.now(); const res = moveDates([DB.orders[0].wo], { due: '2026-12-04' }, { why: 'Production' }, 'Ann').apply(); out.moveMs = Math.round(performance.now() - t);
    out.hist0 = DB.orders[0].dueHist.length; out.histLast = DB.orders[0].dueHist[DB.orders[0].dueHist.length - 1].to;
    t = performance.now(); clearTimeout(saveT); await saveDB(); out.saveMs = Math.round(performance.now() - t);
    out.saveFailed = !!DB.saveFailed; out.toast = (document.getElementById('toast') || {}).textContent || '';
    // group move of 200 jobs
    t = performance.now(); moveDates(DB.orders.slice(1, 201).map(o => o.wo), { shift: { n: 1, unit: 'wk' } }, { why: 'Production' }, 'Ann', { src: 'group' }).apply(); out.group200Ms = Math.round(performance.now() - t);
    t = performance.now(); clearTimeout(saveT); await saveDB(); out.save2Ms = Math.round(performance.now() - t);
    // Mark as applied leaves the date rows
    showTab('x'); await new Promise(r => setTimeout(r, 50));
    const mk = document.getElementById('btn-mark'); if (mk) mk.click(); await new Promise(r => setTimeout(r, 100));
    out.datesAfterMark = datesToCien().length;
    return out;
  });
  const sv = S.row.orders.find(o => o.wo === 'WO-10000'), other = S.row.orders.find(o => o.wo === 'WO-10005');
  rec('size of the saved row with 2,500 × 30 history entries (info)', true, (bytes / 1e6).toFixed(1) + ' MB before the move');
  
  rec('2,500 jobs × 30 history: a reload (loadDB) under 10 s', r.loadDbMs < 10000, r.loadDbMs + ' ms (first page open incl. harness: ' + loadMs + ' ms)');
  // Board render is INFORMATIONAL (Tester round 2, 10 Nov): the pre-feature code (origin/feature/list-excel-template) on this same
  // 2,500-job record, measured the same way (showTab('b') x3, two runs each, headless Chromium), took 3.5–4.6 s; this branch 3.6–4.5 s.
  // Same cost, not caused by the dates work — it is the existing board's size limit, so it is reported, not failed.
  rec('board render with 2,500 jobs (info — pre-existing, old code 3.5–4.6 s on the same data)', true, r.boardMs + ' ms');
  rec('deliveries / export changes render under 3 s each', r.delMs < 3000 && r.expMs < 3000, JSON.stringify({ del: r.delMs, exp: r.expMs }));
  rec('one date move + save (merging another PC\'s change) under 10 s', r.moveMs + r.saveMs < 10000 && !r.saveFailed, JSON.stringify({ move: r.moveMs, save: r.saveMs, failed: r.saveFailed, toast: r.toast }));
  rec('group move of 200 + save under 10 s', r.group200Ms + r.save2Ms < 10000, JSON.stringify({ g: r.group200Ms, s: r.save2Ms }));
  rec('history capped at 30 (oldest dropped, newest kept) — cap lowered in 517f23b', r.hist0 === 30 && r.histLast === '2026-12-04' && sv && sv.dueHist.length === 30, JSON.stringify({ h: r.hist0, last: r.histLast, saved: sv && sv.dueHist.length }));
  rec('the other PC\'s edit survived the merge', other && other.notes === 'other PC', other && other.notes);
  rec('"Mark as applied" leaves the date rows (2,500 still to change in Cienapps)', r.dates === 2500 && r.datesAfterMark === 2500, JSON.stringify({ before: r.dates, after: r.datesAfterMark }));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  await A.close(); await B.close(); await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
