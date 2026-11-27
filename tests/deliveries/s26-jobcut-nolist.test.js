// s26 (Garry 26 Nov): (1) a job at 6 JOB CUT COMPLETE is auto-ticked for delivery — when it gets there in an import, when it is
// set there by hand, and (at the next import) when it was ALREADY there; a hand-untick is respected; "in store" stays 7 / 8.
// (2) every live job without a list is in "lists to issue" and shows the "no list" note on the Capacity Board, whatever its step.
// Fake Supabase only. Run: node tests/deliveries/s26-jobcut-nolist.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 300) : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference'];
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '3. IN PRODUCTION', customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
const row = (wo, step, due) => [wo, 'House ' + wo, 'ASPECT', due || '2026-11-19', step, 1000, ''];
(async () => {
  const browser = await H.chromium.launch();
  try {
    const orders = [O('WO-1'), O('WO-2', { step: '6. JOB CUT COMPLETE' }), O('WO-3', { step: '6. JOB CUT COMPLETE', delvOverride: '6. JOB CUT COMPLETE' }), O('WO-4', { step: '6. JOB CUT COMPLETE', dueDate: '2026-09-10', origDueDate: '2026-09-10' }), O('WO-5', { step: '7. ASSEMBLY COMPLETE' }), O('WO-6', { step: '5. WORK ORDER PROCESSED' })];
    const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row: { id: 'main', orders, nid: 9, settings: {} } }); const p = t.page;
    const r = await H.importAoa(p, [HDR, row('WO-1', '6. JOB CUT COMPLETE'), row('WO-2', '6. JOB CUT COMPLETE'), row('WO-3', '6. JOB CUT COMPLETE'), row('WO-4', '6. JOB CUT COMPLETE', '2026-09-10'), row('WO-5', '7. ASSEMBLY COMPLETE'), row('WO-6', '5. WORK ORDER PROCESSED'), row('WO-7', '6. JOB CUT COMPLETE')]);
    const at = (r.plan && r.plan.autoTag) || [];
    rec('import preview: auto-tagged = moved to Job Cut (WO-1), already there (WO-2), already at 7 (WO-5), new at Job Cut (WO-7)', ['WO-1', 'WO-2', 'WO-5', 'WO-7'].every(w => at.includes(w)), at.join());
    rec('…not the one un-ticked by hand (WO-3), not the old one due before 1 Nov (WO-4), not step 5 (WO-6)', !at.includes('WO-3') && !at.includes('WO-4') && !at.includes('WO-6'), at.join());
    const a = await p.evaluate(() => { applyImport(IMPPLAN); const g = w => DB.orders.find(o => o.wo === w) || {}; return { d: ['WO-1', 'WO-2', 'WO-3', 'WO-4', 'WO-5', 'WO-6', 'WO-7'].map(w => w + ':' + (g(w).delv ? 1 : 0)).join(' '), store: ['WO-1', 'WO-2', 'WO-5'].map(w => w + ':' + (g(w).storeAt ? 1 : 0)).join(' '), log: (g('WO-2').log || []).map(x => x.what).join(' | ') }; });
    rec('after Apply: ticked for delivery exactly those four', a.d === 'WO-1:1 WO-2:1 WO-3:0 WO-4:0 WO-5:1 WO-6:0 WO-7:1', a.d);
    rec('"in store" is still 7 / 8 only (a Job Cut job is not stamped as in store)', /WO-1:0 WO-2:0/.test(a.store), a.store);
    rec('the job\'s history says why (already at Job Cut)', /auto-tagged for delivery \(already at/i.test(a.log), a.log);
    // the same file again: nothing more is tagged
    const r2 = await H.importAoa(p, [HDR, row('WO-1', '6. JOB CUT COMPLETE'), row('WO-2', '6. JOB CUT COMPLETE'), row('WO-3', '6. JOB CUT COMPLETE')]);
    rec('the same file again: nothing auto-tagged twice', !((r2.plan && r2.plan.autoTag) || []).length, JSON.stringify(r2.plan && r2.plan.autoTag));
    // by hand: step set to Job Cut on the board
    const h = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-6'); o.step = '6. JOB CUT COMPLETE'; const tg = delvAuto(o, 'Ann'); return [tg, !!o.delv]; });
    rec('step set to Job Cut by hand → ticked for delivery', h[0] === true && h[1] === true, JSON.stringify(h));
    // un-ticked by hand at Job Cut → stays un-ticked on the next import
    const u = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); o.delv = false; delvMark(o); return o.delvOverride; });
    const r3 = await H.importAoa(p, [HDR, row('WO-1', '6. JOB CUT COMPLETE')]);
    rec('un-ticked by hand at Job Cut → the next import leaves it un-ticked', !!u && !((r3.plan && r3.plan.autoTag) || []).includes('WO-1'), u + ' / ' + JSON.stringify(r3.plan && r3.plan.autoTag));
    await t.close();
    // ---------- (2) lists to issue + the board note, lists ON
    const L = require('../list-window/lw.js'); const { X, sleep } = L;
    const ord = (wo, step, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor: '1', unit: wo.slice(-1), title: 'HOUSE ' + wo, dueDate: '2027-03-12', origDueDate: '2027-03-12', step }, x || {}));
    const rr = X.v2Row(); rr.orders.push(ord('WO-N1', '1. DRAWING'), ord('WO-N2', '3. IN PRODUCTION'), ord('WO-N3', '5. WORK ORDER PROCESSED'), ord('WO-N4', '3. IN PRODUCTION'), ord('WO-N5', '2. SITE MEASURE', { listNA: { k: 'none', by: 'Mary', at: '2026-10-01T09:00:00Z' } }), ord('WO-N6', '9. SHIPPED'));
    const S = X.makeServer(rr); X.F3.seedList(S, 'LN4', { wos: ['WO-N4'], name: 'House 4' });
    const t2 = await X.dev(browser, S, 'office'), q = t2.page;
    await q.evaluate(async () => { lsReset(); await lsLoad(); ROLE = 'office'; tab = 'b'; render(); }); await sleep(600);
    const need = await q.evaluate(() => listsNeeded().map(o => o.wo).filter(w => /^WO-N/.test(w)).sort().join());
    rec('lists to issue: every live job without a list, whatever its step and however far off its due date (N1 drawing, N2, N3)', need === 'WO-N1,WO-N2,WO-N3', need);
    rec('…not the one with a list (N4), not "no list needed" (N5), not shipped (N6)', !/N4|N5|N6/.test(need), need);
    const chips = await q.evaluate(() => { const has = w => { const tr = document.querySelector('tr[data-wo="' + w + '"]'); return tr ? !!tr.querySelector('.ls-nochip') : null; }; return ['WO-N1', 'WO-N2', 'WO-N3', 'WO-N4', 'WO-N5'].map(w => w + ':' + has(w)).join(' '); });
    rec('Capacity Board: the "no list" note on N1, N2, N3 — not on N4 (has a list) or N5 (no list needed)', chips === 'WO-N1:true WO-N2:true WO-N3:true WO-N4:false WO-N5:false', chips);
    const late = await q.evaluate(() => document.querySelectorAll('tr[data-wo="WO-N1"] .ls-nochip.late').length);
    rec('a job due months away is not shown as LATE', late === 0, String(late));
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
