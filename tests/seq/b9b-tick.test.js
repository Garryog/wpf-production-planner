// B9b (Coder): Johnny ticks Processed (seq_pre, stamped by the database), un-ticks with a reason, refused when Cienapps says 5+;
// Export Changes lists the ticks Cienapps doesn't show yet (+ Excel "Processed" sheet); woProgrammed knows a tick; two PCs.
// Fake Supabase only. Run: node tests/seq/b9b-tick.test.js
const { X, makePool, pre, pool } = require('./b9fix.js');
const { H, rec, sleep } = X;
const toasts = p => p.evaluate(() => { window.__t = []; const T = window.toast; window.toast = (m, s) => { window.__t.push(String(m)); try { T(m, s); } catch (e) {} }; });
const lastToast = p => p.evaluate(() => (window.__t || []).slice(-1)[0] || '');
(async () => {
  const browser = await H.chromium.launch();
  const S = makePool();
  const a = await pre(browser, S), b = await pre(browser, S);
  await toasts(a.page); await toasts(b.page);
  let r = await pool(a.page);
  const btns = await a.page.evaluate(() => [...document.querySelectorAll('[data-pretick]')].map(x => x.dataset.pretick));
  rec('tick buttons only on rows with a sequence row and a WO (WO-1, WO-12, WO-10) — not the waiting row, not WO-2 / WO-17', JSON.stringify(btns.sort()) === JSON.stringify(['W:WO-1', 'W:WO-10', 'W:WO-12']), JSON.stringify(btns));
  // tick WO-12
  await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-12"]').click()); await sleep(600);
  const sp = S.db.t.seq_pre.find(x => x.seq_id === 'Q12');
  rec('tick → one seq_pre row: processed, by Johnny, src tick, stamped, wo WO-12', sp && sp.processed && sp.processed_by === 'Johnny' && sp.processed_src === 'tick' && !!sp.processed_at && sp.wo === 'WO-12', JSON.stringify(sp));
  rec('database history: "processed" by Johnny', S.db.t.project_events.some(e => e.entity === 'pre' && e.act === 'processed' && e.entity_id === 'Q12' && e.by === 'Johnny'));
  r = await pool(a.page);
  rec('WO-12 leaves the Not processed list; toast says set step 5 in Cienapps', !r.some(x => x.wo === 'WO-12') && /5\. WORK ORDER PROCESSED/.test(await lastToast(a.page)), JSON.stringify(r.map(x => x.wo)));
  rec('no project_seq / rpc / planner-record writes from a tick', !S.log.some(x => /^(POST|PATCH) \/(project_seq|rpc)/.test(x)));
  // woProgrammed
  const wp = await a.page.evaluate(() => { const o = w => DB.orders.find(x => x.wo === w); const r1 = woProgrammed(o('WO-12')), r2 = woProgrammed(o('WO-10')), r3 = woProgrammed(o('WO-16')); const s = o('WO-12').step; o('WO-12').step = '6. CUT'; const r4 = woProgrammed(o('WO-12')); o('WO-12').step = s; return [r1, r2, r3, r4]; });
  rec('woProgrammed: ticked WO-12 true; unticked WO-10 false; step 5 WO-16 true; ticked but step 6 false', JSON.stringify(wp) === '[true,false,true,false]', JSON.stringify(wp));
  // Export Changes on an office screen
  const o = await X.dev(browser, S, 'office', { now: '2026-11-11T10:00:00Z' });
  await o.page.evaluate(() => showTab('x')); await sleep(300);
  const ex = await o.page.evaluate(() => { const e = document.getElementById('pre-exp'); return e ? e.innerText : ''; });
  rec('Export Changes: "⚙ Processed by pre-production … (1)" with WO-12, step now, Johnny', /Processed by pre-production — set 5\. WORK ORDER PROCESSED in Cienapps \(1\)/.test(ex) && /WO-12/.test(ex) && /In production/.test(ex) && /Johnny/.test(ex), ex.slice(0, 400));
  await o.page.evaluate(() => { DB.orders.find(x => x.wo === 'WO-11').plannedWeek = '2026-11-30'; render(); }); await sleep(200); // a week change, so Download Changes Excel is there
  const sheets = await o.page.evaluate(() => { const got = []; const W = XLSX.writeFile; XLSX.writeFile = (wb, n) => got.push({ n, s: wb.SheetNames.slice(), p: wb.Sheets.Processed ? XLSX.utils.sheet_to_json(wb.Sheets.Processed, { header: 1 }) : null });
    const b1 = document.getElementById('btn-xpre'); if (b1) b1.click(); const b2 = document.getElementById('btn-xchg') || document.getElementById('btn-xchg2'); if (b2) b2.click(); XLSX.writeFile = W; return got; });
  rec('Download Processed Excel: sheet "Processed" with WO-12 / Johnny', sheets[0] && sheets[0].s.join() === 'Processed' && JSON.stringify(sheets[0].p).includes('WO-12') && JSON.stringify(sheets[0].p).includes('Johnny'), JSON.stringify(sheets).slice(0, 400));
  rec('Changes Excel gets a "Processed" sheet', !!sheets[1] && sheets[1].s.includes('Processed') && sheets[1].s.includes('Changes'), JSON.stringify(sheets.map(x => x.s)));
  // an import brings step 5 → line gone
  await o.page.evaluate(() => { DB.orders.find(x => x.wo === 'WO-12').step = '5. WORK ORDER PROCESSED'; render(); }); await sleep(200);
  rec('Cienapps at step 5 → the line drops off (panel gone)', await o.page.evaluate(() => !document.getElementById('pre-exp')));
  await o.page.evaluate(() => { DB.orders.find(x => x.wo === 'WO-12').step = '3. In production'; render(); });
  await o.close();
  // un-tick with a reason
  await a.page.evaluate(() => document.querySelector('[data-preproc="done"]').click()); await sleep(200);
  await a.page.evaluate(() => document.querySelector('[data-preuntick="W:WO-12"]').click()); await sleep(200);
  const why = await a.page.evaluate(() => [...document.querySelectorAll('.pod-ovl [data-why]')].map(x => x.dataset.why));
  rec('un-tick asks why: Ticked by mistake / Files need redoing / Other', JSON.stringify(why) === '["Ticked by mistake","Files need redoing","Other"]', JSON.stringify(why));
  await a.page.evaluate(() => document.querySelector('.pod-ovl [data-why="Files need redoing"]').click()); await sleep(600);
  const sp2 = S.db.t.seq_pre.find(x => x.seq_id === 'Q12');
  rec('un-tick: processed false, stamps cleared, note = the reason', sp2 && !sp2.processed && !sp2.processed_at && !sp2.processed_by && sp2.note === 'Files need redoing', JSON.stringify(sp2));
  rec('database history: "unprocessed"', S.db.t.project_events.some(e => e.entity === 'pre' && e.act === 'unprocessed' && e.entity_id === 'Q12'));
  // refused at Cienapps 5+
  await a.page.evaluate(async () => { DB.orders.find(x => x.wo === 'WO-10').step = '5. WORK ORDER PROCESSED'; render(); }); await sleep(200);
  const n0 = S.db.t.seq_pre.length;
  await a.page.evaluate(() => preUntick('W:WO-10')); await sleep(200);
  rec('un-tick refused at Cienapps step 5: "Cienapps says processed — change it there", nothing written, no ↺ button', /Cienapps says processed/.test(await lastToast(a.page)) && S.db.t.seq_pre.length === n0 && await a.page.evaluate(() => !document.querySelector('[data-preuntick="W:WO-10"]')));
  await a.page.evaluate(async () => { DB.orders.find(x => x.wo === 'WO-10').step = '3. In production'; render(); });
  // waiting row / no sequence row can't be ticked (by code either)
  await a.page.evaluate(() => { preTick('R:W1'); preTick('W:WO-2'); }); await sleep(400);
  rec('waiting row and no-sequence job: not ticked (nothing written)', !S.db.t.seq_pre.some(x => x.seq_id === 'W1') && S.db.t.seq_pre.length === n0);
  // two PCs tick the same row (WO-1): one row, the second is told and reloaded
  await b.page.evaluate(async () => { await lsPoll(); render(); }); await sleep(200);
  await a.page.evaluate(() => document.querySelector('[data-preproc="not"]').click()); await sleep(200);
  await b.page.evaluate(() => { PREV.proc = 'not'; render(); }); await sleep(200);
  await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-1"]').click()); await sleep(600);
  const hadB = await b.page.evaluate(() => !!document.querySelector('[data-pretick="W:WO-1"]'));
  await b.page.evaluate(() => document.querySelector('[data-pretick="W:WO-1"]').click()); await sleep(800);
  rec('two PCs tick WO-1: ONE database row, ONE "processed" history line', hadB && S.db.t.seq_pre.filter(x => x.seq_id === 'Q1').length === 1 && S.db.t.project_events.filter(e => e.entity === 'pre' && e.entity_id === 'Q1' && e.act === 'processed').length === 1);
  rec('second PC told "changed on another screen" and now shows it processed', /changed on another screen/.test(await lastToast(b.page)) && await b.page.evaluate(() => !document.querySelector('[data-pretick="W:WO-1"]') && !!(LST.sp.get('Q1') || {}).processed), await lastToast(b.page));
  // stale un-tick: B un-ticks after A changed the row → version clash
  await a.page.evaluate(() => { PREV.proc = 'all'; render(); }); await b.page.evaluate(() => { PREV.proc = 'all'; render(); }); await sleep(200);
  await a.page.evaluate(() => { document.querySelector('[data-preuntick="W:WO-1"]').click(); document.querySelector('.pod-ovl [data-why="Ticked by mistake"]').click(); }); await sleep(600);
  await b.page.evaluate(() => { document.querySelector('[data-preuntick="W:WO-1"]').click(); document.querySelector('.pod-ovl [data-why="Files need redoing"]').click(); }); await sleep(800);
  const q1 = S.db.t.seq_pre.find(x => x.seq_id === 'Q1');
  rec('stale un-tick on PC 2: version check refuses it, the first reason kept, PC 2 told', q1 && !q1.processed && q1.note === 'Ticked by mistake' && /changed on another screen/.test(await lastToast(b.page)), JSON.stringify(q1));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await a.close(); await b.close();
  // read-only for others: an office screen in the pool can't tick (no buttons)
  const S2 = makePool();
  const of = await pre(browser, S2);
  const sw = await of.page.evaluate(() => { const a = !!document.querySelector('[data-pretick]'); DB.listStore = 'switching'; render(); return { a, pool: !!document.getElementById('pre-pool'), b: !!document.querySelector('[data-pretick]'), txt: document.getElementById('app').innerText.slice(0, 200) }; });
  rec('switch "switching" (database takes no changes): pool shown, no tick buttons', sw.a && sw.pool && !sw.b, JSON.stringify(sw));
  await of.close();
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
