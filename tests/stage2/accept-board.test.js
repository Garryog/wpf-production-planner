// Stage 2 acceptance checks 18–24 and 27, plus the Shipped tab on a phone (Chrome width).
// Stubbed Supabase only (tests/harness.js, tests/stage1/tsrv.js).
// Run: node tests/stage2/accept-board.test.js
const H = require('../harness');
const { makeServer, device } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
const NOW = '2026-10-19T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  let t;

  // AC18 old orders render on every tab (incl. Shipped) with no NaN; full export works without a step
  {
    const old = { id: 'main', orders: [{ wo: 'WO-OLD-1', title: 'Legacy', customer: 'X', plannedWeek: '2026-10-26' }, { wo: 'WO-OLD-2', customer: 'Y', hours: 4, dueDate: '2026-10-30', plannedWeek: '2026-10-26', step: '3. In production' }, { wo: 'WO-OLD-3', plannedWeek: '', shippedAt: '2026-10-01T10:00:00Z' }], nid: 3 };
    t = await H.open({ browser, now: NOW, row: old });
    const out = await t.page.evaluate(() => {
      const r = {};
      for (const tb of ['b', 'd', 'h', 'l', 'i', 'x', 's']) { try { showTab(tb); r[tb] = /NaN|undefined/.test(document.getElementById('app').innerText) ? 'shows NaN/undefined' : 'ok'; } catch (e) { r[tb] = 'ERR ' + e.message; } }
      showTab('b'); srch = 'leg'; render(); r.search = document.querySelectorAll('tr[data-wo]').length; srch = ''; render();
      let rows; const o = XLSX.writeFile; XLSX.writeFile = wb => { rows = XLSX.utils.sheet_to_json(wb.Sheets['Full Schedule'], { header: 1 }); };
      try { showTab('x'); document.getElementById('btn-xfull').click(); r.fullExport = rows ? 'ok' : 'no file'; r.hdr = rows[0].slice(-2).join('|'); } catch (e) { r.fullExport = 'ERR ' + e.message; } finally { XLSX.writeFile = o; }
      return r;
    });
    const errs = (t.server.errors || []).join(' | ');
    rec('AC18 old orders render on every tab (incl. Shipped) with no NaN/undefined', ['b', 'd', 'h', 'l', 'i', 'x', 's'].every(k => out[k] === 'ok') && !errs, JSON.stringify(out) + ' ' + errs);
    rec('AC18 board search works with a missing title', out.search === 1, 'rows=' + out.search);
    rec('AC18 Full Schedule export works without a step; new columns only at the end', out.fullExport === 'ok' && out.hdr === 'Shipped At|Sheets (Cienapps)', JSON.stringify(out));
    await t.close();
  }

  // AC19 8 different Mondays across the March clock change
  t = await H.open({ browser, now: '2027-03-08T10:00:00Z' });
  const w = await t.page.evaluate(() => get8Wks());
  rec('AC19 8 different Mondays across the March clock change', new Set(w).size === 8 && w.every(k => new Date(k + 'T00:00:00Z').getUTCDay() === 1) && w[3] === '2027-03-29', w.join(' '));
  await t.close();

  // AC20 Week Summary shows the week's own capacity
  t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 2, settings: { weekCaps: { '2026-10-19': 100 }, wcap: 350 }, orders: [H.order({ wo: 'WO-1-1', plannedWeek: '2026-10-19', hours: 90 })] } });
  const e20 = await t.page.evaluate(() => { showTab('x'); let c; const o = XLSX.writeFile; XLSX.writeFile = wb => { c = XLSX.utils.sheet_to_json(wb.Sheets['Week Summary'], { header: 1 }); }; document.getElementById('btn-xfull').click(); XLSX.writeFile = o; return c[1]; });
  rec('AC20 Week Summary shows 100h capacity (90%)', e20 && e20[4] === 100 && e20[5] === '90%', JSON.stringify(e20));
  await t.close();

  // AC21 shipped → Shipped tab, still there after re-import, searchable, Bring back works; off the week totals; Deliveries keeps it
  {
    const orders = [H.order({ wo: 'WO-5-1', title: 'Kitchen 12', plannedWeek: '2026-10-19', hours: 30, delv: true, delVeh: 'IVECO', delDay: 'Tue' }), H.order({ wo: 'WO-5-2', title: 'Kitchen 14', plannedWeek: '2026-10-19', hours: 10 })];
    t = await H.open({ browser, now: NOW, row: { id: 'main', orders, nid: 3, settings: {} } });
    const file = [HDR, ['WO-5-1', 'Kitchen 12', 'Cust', 46331, '9. JOB SHIPPED', 4000], ['WO-5-2', 'Kitchen 14', 'Cust', 46331, '3. In production', 4000]];
    let r = await H.importAoa(t.page, file);
    const a = await t.page.evaluate(() => { applyImport(IMPPLAN); showTab('b'); const board = [...document.querySelectorAll('tr[data-wo]')].map(x => x.dataset.wo); showTab('d'); const del = document.getElementById('app').innerText.includes('WO-5-1'); showTab('h'); const sh = document.getElementById('app').innerText; return { board, hrs: wkHrs('2026-10-19'), cnt: wkCnt('2026-10-19'), del, sh: sh.includes('WO-5-1') && !sh.includes('WO-5-2'), n: DB.orders.length }; });
    rec('AC21 shipped job leaves the board and week totals, appears on Shipped, stays on Deliveries', a.board.join() === 'WO-5-2' && a.hrs === 10 && a.cnt === 1 && a.sh && a.del && a.n === 2 && /Moving to the Shipped tab/.test(r.iprev), JSON.stringify(a));
    r = await H.importAoa(t.page, file);
    const b = await t.page.evaluate(() => { applyImport(IMPPLAN); return { n: DB.orders.length, sh: DB.orders.filter(isShipped).map(o => o.wo).join() }; });
    rec('AC21 still on Shipped after re-import (nothing removed, no duplicate)', b.n === 2 && b.sh === 'WO-5-1' && r.plan.shipped.length === 0, JSON.stringify(b));
    const s = await t.page.evaluate(() => { showTab('h'); const q = document.getElementById('sh-q'); q.value = 'kitchen 12'; q.oninput.call(q); const hit = document.querySelectorAll('.sh-card').length; const q2 = document.getElementById('sh-q'); q2.value = 'nothing-like-this'; q2.oninput.call(q2); const miss = document.querySelectorAll('.sh-card').length; shSrch = ''; render(); return { hit, miss }; });
    rec('AC21 Shipped tab is searchable', s.hit === 1 && s.miss === 0, JSON.stringify(s));
    const c = await t.page.evaluate(() => { showTab('h'); document.querySelector('[data-shc="WO-5-1"]').click(); const o = DB.orders.find(x => x.wo === 'WO-5-1'); const done = !!o.completeAt && o.completeBy === 'Tester'; const hidden = !document.querySelector('[data-shc="WO-5-1"]') && !document.getElementById('app').innerText.includes('WO-5-1'); document.getElementById('sh-done').click(); const shown = document.getElementById('app').innerText.includes('Installation complete'); return { done, hidden, shown }; });
    rec('AC21 "Installation complete" stamps who/when, hides it, "show completed" shows it', c.done && c.hidden && c.shown, JSON.stringify(c));
    const d = await t.page.evaluate(() => { showTab('h'); document.querySelector('[data-shb="WO-5-1"]').click(); showTab('b'); const o = DB.orders.find(x => x.wo === 'WO-5-1'); return { onBoard: !!document.querySelector('tr[data-wo="WO-5-1"]'), shipBack: !!o.shipBack, hrs: wkHrs('2026-10-19') }; });
    rec('AC21 "Bring back to board" puts it back on the board and the totals', d.onBoard && d.shipBack && d.hrs === 40, JSON.stringify(d));
    r = await H.importAoa(t.page, file);
    const e = await t.page.evaluate(() => { applyImport(IMPPLAN); return isShipped(DB.orders.find(x => x.wo === 'WO-5-1')); });
    rec('AC21 a brought-back job is not re-shipped by the same Cienapps status', e === false && r.plan.shipped.length === 0, 'shipped again=' + e);
    r = await H.importAoa(t.page, [HDR, ['WO-5-1', 'Kitchen 12', 'Cust', 46331, '9. Invoiced', 4000]]);
    rec('…but is shipped again when Cienapps moves on (invoiced)', r.plan.shipped.length === 1, JSON.stringify(r.plan.shipped));
    await t.close();
  }

  // AC21b a shipped job with waiting lines comes back into view on the board (needsAttention), still out of the totals
  {
    const ROWS = [{ k: 'saw', item: 'Side', qty: 2, L: 2400, W: 600, mat: 'MFC', note: '' }];
    const row = { id: 'main', nid: 3, orders: [H.order({ wo: 'WO-6-1', plannedWeek: '2026-10-19', hours: 12, shippedAt: '2026-10-18T10:00:00Z' })], settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'P', saw: 1, fit: 0, wos: ['WO-6-1'], up: NOW }], listWBs: { W1: { project: 'P', sheets: { H1: ROWS } } } } };
    t = await H.open({ browser, now: NOW, row });
    const x = await t.page.evaluate(() => { showTab('b'); const before = !!document.querySelector('tr[data-wo="WO-6-1"]'); const l = lists()[0]; holdRows(l, [rowKey(listRows(l)[0])], 'saw', 'T'); render(); const row = document.querySelector('tr[data-wo="WO-6-1"]'); return { before, after: !!row, badge: row && /1 waiting/.test(row.innerText), hrs: wkHrs('2026-10-19'), attn: needsAttention(DB.orders[0]) }; });
    rec('needsAttention: a shipped job with a waiting line is back in view on the board, not in the totals', !x.before && x.after && x.badge && x.hrs === 0 && x.attn, JSON.stringify(x));
    await t.close();
  }

  // AC22 WO-S on the board survives the import, untouched
  t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 2, settings: {}, orders: [H.order({ wo: 'WO-S-12', title: 'Snag doors', value: 100, step: '3. In production' })] } });
  await H.importAoa(t.page, [HDR, ['WO-S-12', 'Other title', 'C', 46331, '9. JOB SHIPPED', 999], ['WO-1-1', 'x', 'y', 46331, '3. In production', 1000]]);
  const s22 = await t.page.evaluate(() => { const before = JSON.stringify(DB.orders.find(o => o.wo === 'WO-S-12')); applyImport(IMPPLAN); const o = DB.orders.find(x => x.wo === 'WO-S-12'); return { same: JSON.stringify(o) === before, n: DB.orders.length }; });
  rec('AC22 a WO-S on the board survives the import unchanged', s22.same && s22.n === 2, JSON.stringify(s22));
  await t.close();

  // AC23 planner step ahead stays and shows in Export Changes; AC24 a Cienapps step behind is ignored
  t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 3, orders: [H.order({ wo: 'WO-1-1', step: '4. Assembly' }), H.order({ wo: 'WO-1-2', step: 'Assembly complete' })], settings: { exportBase: { wk: { 'WO-1-1': '2026-10-26', 'WO-1-2': '2026-10-26' }, st: { 'WO-1-1': '3. In production', 'WO-1-2': 'Assembly complete' } } } } });
  const r23 = await H.importAoa(t.page, [HDR, ['WO-1-1', 'Job', 'Cust', 46331, '3. In production', 4000], ['WO-1-2', 'Job', 'Cust', 46331, 'In production', 4000]]);
  const s23 = await t.page.evaluate(() => { applyImport(IMPPLAN); return { steps: DB.orders.map(o => o.step), ch: changes().map(o => o.wo) }; });
  rec('AC23 planner step ahead of Cienapps stays and shows in Export Changes', s23.steps[0] === '4. Assembly' && s23.ch.includes('WO-1-1') && /planner is ahead/.test(r23.iprev), JSON.stringify(s23));
  rec('AC24 a Cienapps step behind the planner is ignored (named ladder)', s23.steps[1] === 'Assembly complete' && !s23.ch.includes('WO-1-2'), JSON.stringify(s23));
  await t.close();

  // Due-date Differs: Take is default, Keep remembered (dueKeep) and not asked again
  t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 3, settings: {}, orders: [H.order({ wo: 'WO-1-1', dueDate: '2026-11-05' }), H.order({ wo: 'WO-1-2', dueDate: '2026-11-05' })] } });
  await H.importAoa(t.page, [HDR, ['WO-1-1', 'Job', 'Cust', '12/11/2026', '3. In production', 4000], ['WO-1-2', 'Job', 'Cust', '12/11/2026', '3. In production', 4000]]);
  const k = await t.page.evaluate(async () => { document.querySelector('[data-dk="WO-1-2"][value="keep"]').checked = true; await document.getElementById('imp-apply').onclick(); return DB.orders.map(o => o.wo + ':' + o.dueDate + ':' + (o.dueKeep || '')); });
  const r2 = await H.importAoa(t.page, [HDR, ['WO-1-1', 'Job', 'Cust', '12/11/2026', '3. In production', 4000], ['WO-1-2', 'Job', 'Cust', '12/11/2026', '3. In production', 4000]]);
  rec('Differs: Take (default) uses the Cienapps date; Keep keeps ours and remembers it', k.join() === 'WO-1-1:2026-11-12:,WO-1-2:2026-11-05:2026-11-12', k.join());
  rec('Differs: a kept date is not asked again on the next import', r2.plan && r2.plan.updates.length === 0, r2.plan && r2.plan.updates.map(u => u.wo).join());
  const ka = await t.page.evaluate(async () => { IMPPLAN = null; return 1; });
  await H.importAoa(t.page, [HDR, ['WO-1-1', 'Job', 'Cust', '19/11/2026', '3. In production', 4000], ['WO-1-2', 'Job', 'Cust', '19/11/2026', '3. In production', 4000]]);
  const kall = await t.page.evaluate(async () => { document.getElementById('dk-keep').click(); await document.getElementById('imp-apply').onclick(); return DB.orders.map(o => o.dueDate).join(); });
  rec('Differs: "Keep all" keeps every planner date', kall === '2026-11-12,2026-11-05', kall);
  await t.close();

  // AC27 (replaces stage1 t5): an import marking a job shipped while another PC moved it — never removed, never duplicated
  {
    const base = { id: 'main', version: 1, orders: [H.order({ wo: 'WO-1', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-2', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-3', plannedWeek: '2026-10-26' })], nid: 5, settings: { exportBase: { wk: { 'WO-1': '2026-10-26', 'WO-2': '2026-10-26', 'WO-3': '2026-10-26' }, st: { 'WO-1': '3. In production', 'WO-2': '3. In production', 'WO-3': '3. In production' } } } };
    const S = makeServer(base); const A = await device(browser, S, { name: 'A' }), B = await device(browser, S, { name: 'B' });
    await A.page.evaluate(() => { showTab('i'); IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-3', step: '9. JOB SHIPPED', value: 4000, dueDate: '2026-11-02' }]), 'file'); });
    await B.page.evaluate(async () => { DB.orders[2].plannedWeek = '2026-11-16'; await saveDB(); }); // B moves it while A's preview is open
    await A.page.evaluate(async () => { applyImport(IMPPLAN); IMPPLAN = null; await saveDB(); });
    await A.page.evaluate(() => loadDB()); await B.page.evaluate(() => loadDB());
    const o = S.row.orders.filter(x => x.wo === 'WO-3');
    rec('AC27 shipped job is never removed: one copy, shipped, and B\'s move is kept', o.length === 1 && !!o[0].shippedAt && o[0].plannedWeek === '2026-11-16' && o[0].step === '9. JOB SHIPPED', JSON.stringify(o.map(x => [x.plannedWeek, x.step, !!x.shippedAt])));
    const ca = await A.page.evaluate(() => changes().map(o => o.wo).join()), cb = await B.page.evaluate(() => changes().map(o => o.wo).join());
    rec('AC27 the step change is not exported; B\'s week move is (on both PCs)', ca === 'WO-3' && cb === 'WO-3', 'A=' + ca + ' B=' + cb);
    rec('AC27 old-style plan.removals is ignored — no import can delete a job', await A.page.evaluate(() => { applyImport({ removals: [{ wo: 'WO-1', reason: 'shipped' }], updates: [], newOrders: [], counts: {} }); return DB.orders.some(o => o.wo === 'WO-1'); }));
    rec('AC27 no page errors on either PC', !A.dev.errors.length && !B.dev.errors.length, A.dev.errors.concat(B.dev.errors).join(' | '));
    await A.close(); await B.close();
  }

  // Phone (Chrome, 390px): Shipped tab usable — no sideways scroll, big buttons, hostile text escaped
  {
    const evil = '<img src=x onerror="(window.__xss=window.__xss||[]).push(1)">';
    t = await H.open({ browser, now: NOW, viewport: { width: 390, height: 844 }, row: { id: 'main', nid: 3, settings: {}, orders: [H.order({ wo: 'WO-7-1', title: 'Very long kitchen title for apartment block C floor 3 ' + evil, customer: evil, shippedAt: '2026-10-18T10:00:00Z', adds: { 'WO-7-1A': { value: 10 } } })] } });
    const p = await t.page.evaluate(() => { showTab('h'); const b = document.querySelector('[data-shc]').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bh: Math.round(b.height), cards: document.querySelectorAll('.sh-card').length, xss: (window.__xss || []).length, tabVis: !!document.getElementById('t-h').offsetParent }; });
    rec('Phone: Shipped tab fits a 390px screen with 44px buttons', p.sw <= p.cw && p.bh >= 44 && p.cards === 1 && p.tabVis, JSON.stringify(p));
    rec('Phone: hostile text on the Shipped tab does not run', p.xss === 0, JSON.stringify(p));
    await t.close();
  }

  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
