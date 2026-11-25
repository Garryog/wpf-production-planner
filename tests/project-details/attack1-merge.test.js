// Tester attack 1 (Project details): job-info overrides (o.pov) vs old-code tabs, two PCs merging, imports racing edits,
// customer change moving a job. Fake Supabase only. Run: node tests/project-details/attack1-merge.test.js
const X = require('./fixp.js');
const A = require('../stage3/atk.js');
const { H, rec, sleep } = X;
const job = (S, wo) => JSON.parse(JSON.stringify((S.row.orders || []).find(x => x.wo === wo) || null));
const ev = (t, fn, a) => t.page.evaluate(fn, a);
const flush = t => ev(t, async () => { await saveDB(); await new Promise(r => setTimeout(r, 300)); if (saveT) await saveDB(); });
(async () => {
  const browser = await H.chromium.launch();
  const oldHtml = A.gitShow('origin/feature/list-excel-template');

  // ---- 1. old-code tab opened BEFORE the override, then edits the same job and saves (merge)
  {
    const S = X.makeServer();
    const old = await A.openOld(browser, S, oldHtml);
    const nw = await X.dev(browser, S, 'office');
    await ev(nw, () => { const o = DB.orders.find(x => x.wo === 'WO-1'); jobInfoSet(o, 'title', 'NEW TITLE'); jobInfoSet(o, 'unit', '12A'); });
    await flush(nw);
    rec('1a new tab saved override', job(S, 'WO-1').title === 'NEW TITLE' && !!(job(S, 'WO-1').pov || {}).title, JSON.stringify(job(S, 'WO-1').pov));
    // old tab: an unrelated edit to WO-1 (notes) without refreshing first
    await ev(old, () => { const o = DB.orders.find(x => x.wo === 'WO-1'); o.notes = 'old tab note'; sched(); });
    await ev(old, async () => { await saveDB(); });
    await sleep(500);
    const j = job(S, 'WO-1');
    rec('1b old tab saving the same job keeps the planner title and pov', j.title === 'NEW TITLE' && j.unit === '12A' && j.pov && j.pov.title && j.pov.unit && j.notes === 'old tab note', JSON.stringify({ t: j.title, u: j.unit, pov: j.pov, n: j.notes }));
    // old tab runs a Cienapps import carrying Cienapps' (old) title
    const r = await ev(old, () => { try { const p = analyzeImport(prepImport([{ wo: 'WO-1', title: 'HOUSE WO-1 TYPE B', unit: '12', customer: 'Aderrig Homes', step: '3. In production', dueDate: '2026-10-22' }]), 'file'); applyImport(p); sched(); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
    await ev(old, async () => { await saveDB(); }); await sleep(400);
    const j2 = job(S, 'WO-1');
    rec('1c an OLD tab importing Cienapps\' old title keeps the planner value (expected to fail: old code knows nothing of pov)', j2.title === 'NEW TITLE', r + ' title=' + j2.title + ' pov=' + JSON.stringify(j2.pov));
    // what the new tab now shows on Export Changes
    await ev(nw, () => loadDB()); await sleep(300);
    const pl = await ev(nw, () => povList().map(x => x.o.wo + ':' + x.k + ' cien=' + x.cien + ' now=' + x.now));
    rec('1d after the old-tab import no meaningless "Cienapps says X / planner X" row on Export Changes', !pl.some(s => { const m = /cien=(.*) now=(.*)/.exec(s); return m && m[1] === m[2]; }), JSON.stringify(pl));
    await old.close(); await nw.close();
  }

  // ---- 2. two PCs override different fields of the same job at once
  {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'pm');
    await ev(a, () => jobInfoSet(DB.orders.find(x => x.wo === 'WO-1'), 'title', 'TITLE BY A'));
    await ev(b, () => jobInfoSet(DB.orders.find(x => x.wo === 'WO-1'), 'floor', '2nd'));
    await flush(a); await flush(b); await sleep(300); await ev(a, () => loadDB()); await sleep(300);
    const j = job(S, 'WO-1');
    rec('2a both overrides kept (title from A, floor from B) with both pov entries', j.title === 'TITLE BY A' && j.floor === '2nd' && j.pov && j.pov.title && j.pov.floor, JSON.stringify({ t: j.title, f: j.floor, pov: j.pov }));
    // both override the SAME field differently: one wins, the other is noted; pov must still agree with the title
    await ev(a, () => jobInfoSet(DB.orders.find(x => x.wo === 'WO-1'), 'unit', 'U-A'));
    await ev(b, () => jobInfoSet(DB.orders.find(x => x.wo === 'WO-1'), 'unit', 'U-B'));
    await flush(a); await flush(b); await sleep(300);
    const j2 = job(S, 'WO-1');
    rec('2b same field on two PCs: one value wins, pov.unit.cien still Cienapps\' 12', ['U-A', 'U-B'].includes(j2.unit) && j2.pov && j2.pov.unit && j2.pov.unit.cien === '12', JSON.stringify({ u: j2.unit, pov: j2.pov }));
    // A undoes the title override while B (not refreshed) changes the title again → merged result must be consistent
    await ev(a, () => loadDB()); await ev(b, () => loadDB()); await sleep(300);
    await ev(a, () => { const o = DB.orders.find(x => x.wo === 'WO-1'); jobInfoSet(o, 'title', o.pov.title.cien); });
    await ev(b, () => jobInfoSet(DB.orders.find(x => x.wo === 'WO-1'), 'customer', 'Aderrig Homes Ltd'));
    await flush(a); await flush(b); await sleep(300);
    const j3 = job(S, 'WO-1');
    const stale = j3.pov && j3.pov.title && j3.pov.title.cien === j3.title;
    rec('2c undo on A + other-field override on B: no stale pov.title left equal to the title', !stale, JSON.stringify({ t: j3.title, pov: j3.pov }));
    // B undoes the only override while A adds another — A's override must survive
    await ev(a, () => loadDB()); await ev(b, () => loadDB()); await sleep(300);
    const s0 = await ev(a, () => JSON.stringify(DB.orders.find(x => x.wo === 'WO-2').pov || null));
    await ev(a, () => jobInfoSet(DB.orders.find(x => x.wo === 'WO-2'), 'title', 'W2 A'));
    await flush(a);
    await ev(b, () => jobInfoSet(DB.orders.find(x => x.wo === 'WO-2'), 'unit', '99'));
    await ev(b, () => { const o = DB.orders.find(x => x.wo === 'WO-2'); jobInfoSet(o, 'unit', o.pov.unit.cien); });
    await flush(b); await sleep(300);
    const w2 = job(S, 'WO-2');
    rec('2d B adds+undoes its own override (pov deleted) while A added one: A\'s override and pov survive', w2.title === 'W2 A' && w2.pov && w2.pov.title, s0 + ' → ' + JSON.stringify({ t: w2.title, pov: w2.pov }));
    await a.close(); await b.close();
  }

  // ---- 3. imports: preview, then planner edit, then Apply; P-numbers; legacy f/u
  {
    const S = X.makeServer();
    const o = await X.dev(browser, S, 'office');
    const r = await ev(o, () => {
      const p = analyzeImport(prepImport([{ wo: 'WO-1', title: 'CIEN NEW TITLE', unit: '12', customer: 'Aderrig Homes', step: '3. In production', dueDate: '2026-10-22' }]), 'file');
      jobInfoSet(DB.orders.find(x => x.wo === 'WO-1'), 'title', 'PLANNER TITLE'); // edit between preview and Apply
      applyImport(p); const j = DB.orders.find(x => x.wo === 'WO-1');
      return { t: j.title, pov: j.pov, log: (j.log || []).slice(-3).map(l => l.what) };
    });
    rec('3a preview → planner edit → Apply: planner title kept, Cienapps\' new value remembered', r.t === 'PLANNER TITLE' && r.pov && r.pov.title && r.pov.title.cien === 'CIEN NEW TITLE', JSON.stringify(r));
    rec('3b ...and the job history does not claim the import changed the title', !r.log.some(w => /Cienapps import: .*title: .*→ CIEN NEW TITLE/.test(w)), JSON.stringify(r.log));
    // preview made while the override exists, then ↺ undo, then Apply: the new Cienapps value must land
    const r2 = await ev(o, () => {
      const p = analyzeImport(prepImport([{ wo: 'WO-1', title: 'CIEN TITLE V3', unit: '12', customer: 'Aderrig Homes', step: '3. In production', dueDate: '2026-10-22' }]), 'file');
      const j = DB.orders.find(x => x.wo === 'WO-1'); jobInfoSet(j, 'title', j.pov.title.cien); // ↺ back to Cienapps value (CIEN NEW TITLE)
      applyImport(p); return { t: j.title, pov: j.pov || null };
    });
    rec('3c preview → ↺ undo → Apply: the job ends with Cienapps\' latest title', r2.t === 'CIEN TITLE V3', JSON.stringify(r2));
    // Cienapps catches up with a trailing space / different case
    const r3 = await ev(o, () => {
      const j = DB.orders.find(x => x.wo === 'WO-1'); jobInfoSet(j, 'floor', '1st');
      const p = analyzeImport(prepImport([{ wo: 'WO-1', floor: ' 1st ', step: '3. In production', dueDate: '2026-10-22' }]), 'file'); applyImport(p);
      return { f: j.floor, pov: j.pov || null, n: povList().length };
    });
    rec('3d Cienapps catches up with " 1st " (spaces): override clears', !(r3.pov && r3.pov.floor), JSON.stringify(r3));
    // legacy fields: job with only o.f / o.u
    const r4 = await ev(o, () => {
      const j = DB.orders.find(x => x.wo === 'WO-2'); delete j.floor; delete j.unit; j.f = 'GF'; j.u = '7';
      jobInfoSet(j, 'floor', '3rd'); jobInfoSet(j, 'unit', '');
      const a = { floor: j.floor, f: j.f, unit: j.unit, u: j.u, pov: JSON.parse(JSON.stringify(j.pov || null)), shown: fuF(j) + '/' + fuU(j) };
      const p = analyzeImport(prepImport([{ wo: 'WO-2', floor: 'GF', unit: '7', step: '3. In production', dueDate: '2026-10-22' }]), 'file'); applyImport(p);
      return { a, after: { floor: j.floor, f: j.f, unit: j.unit, u: j.u, shown: fuF(j) + '/' + fuU(j), pov: j.pov || null } };
    });
    rec('3e legacy o.f/o.u: floor override kept through import', r4.after.shown.startsWith('3rd/') && r4.a.pov && r4.a.pov.floor && r4.a.pov.floor.cien === 'GF', JSON.stringify(r4));
    rec('3f legacy o.u: a BLANKED unit stays blank (fuU falls back to o.u when unit is "")', r4.a.shown === '3rd/', JSON.stringify(r4.a));
    // P-number job: edited directly, never listed
    const r5 = await ev(o, () => {
      const p = { wo: 'P-1001', title: 'Planner job', customer: 'Aderrig Homes', floor: '', unit: '', step: '', plannedWeek: '', hours: 1, log: [] };
      DB.orders.push(p); jobInfoSet(p, 'title', 'Planner job 2'); jobInfoSet(p, 'customer', 'Other Cust');
      return { pov: p.pov || null, list: povList().filter(x => x.o.wo === 'P-1001').length, t: p.title };
    });
    rec('3g P-number: edited directly, no pov, never on Export Changes', !r5.pov && r5.list === 0 && r5.t === 'Planner job 2', JSON.stringify(r5));
    // customer change: blank customer has no confirm and orphans the job
    const r6 = await ev(o, () => { window.__c = 0; window.confirm = () => { window.__c++; return true; }; showTab('l'); return 1; });
    await sleep(300);
    await ev(o, () => document.querySelector('[data-lhedit="L1"]').click()); await sleep(500);
    const r7 = await ev(o, () => { const i = document.querySelector('[data-woe="customer"]'); i.value = '   '; i.onchange(); const j = DB.orders.find(x => x.wo === 'WO-1'); return { c: j.customer, asked: window.__c, pid: specPidOfWO(j) }; });
    rec('3h blanking the Customer asks first (it takes the job out of its project)', r7.asked > 0 || r7.c !== '', JSON.stringify(r7));
    const r8 = await ev(o, () => { const j = DB.orders.find(x => x.wo === 'WO-1'); jobInfoSet(j, 'customer', 'Somebody Else Ltd'); const l = lsCache().all.find(x => x.id === 'L1'); return { pid: specPidOfWO(j), listPid: l && l.pid, chipFor: l && l.pid }; });
    rec('3i customer moved to an unknown customer: the list still sits on the old project (info)', true, JSON.stringify(r8));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await o.close();
  }
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
