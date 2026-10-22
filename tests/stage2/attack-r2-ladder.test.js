// TESTER ATTACK round 2 (Stage 2): Garry's Cienapps ladder — 12 ON HOLD (waiting lines, delivery tags, vans,
// coming back), 10/11 installed/complete, auto-tag at 7/8 (never untag), and woFinished's loose "shipped" match.
// Supabase stubbed by tests/harness.js. Run: node tests/stage2/attack-r2-ladder.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
(async () => {
  const O = (wo, x) => H.order(Object.assign({ wo, step: '5. WORK ORDER PROCESSED', plannedWeek: '2026-10-19', dueDate: '2026-10-23', hours: 6, hoursSrc: 'est', hoursEstimated: true }, x || {}));
  const t = await H.open({ now: NOW, row: { id: 'main', nid: 9, orders: [
    O('WO-100-1'),                                                                   // waiting lines on its list
    O('WO-101-1', { delv: true, delVeh: 'VOLVO', delDay: 'Tue' }),                  // tagged, on a van/day, not loaded
    O('WO-102-1', { delv: true, delVeh: 'IVECO', delDay: 'Mon', delLoadedAt: '2026-10-19T08:00:00Z' }), // loaded on a van
    O('WO-103-1', { plannedWeek: '2026-08-03' }),                                    // will come back from hold later
    O('WO-104-1', { grp: 'G1' }), O('WO-104-2', { grp: 'G1' }),                    // grouped
    O('WO-105-1'), O('WO-106-1'), O('WO-107-1'), O('WO-108-1'), O('WO-109-1'),
  ], settings: {
    lists: [{ id: 'L1', sheet: 'Unit 100', project: 'P', name: 'L1', wos: ['WO-100-1'], saw: 3, fit: 2 }, { id: 'L2', sheet: 'Unit 107', project: 'P', name: 'L2', wos: ['WO-107-1'], saw: 2, fit: 0 }],
    listHold: { L1: { 'saw|0': { st: 'hold', why: 'no board' } } }, grps: { G1: { title: 'Pair' } },
  } } });
  const ev = (fn, a) => t.page.evaluate(fn, a);
  const imp = rows => ev(rows => { const p = analyzeImport(prepImport(rows), 'file'); applyImport(p); return JSON.parse(JSON.stringify({ flagged: p.flagged, autoTag: p.autoTag, marks: p.marks, shipped: p.shipped.map(s => s.wo), diffs: p.stepDiffs })); }, rows);
  const g = w => ev(w => JSON.parse(JSON.stringify(DB.orders.find(o => o.wo === w) || null)), w);

  // ---------- 12 ON HOLD
  const am0 = await ev(() => attnMap().get('WO-100-1') || 0);
  await imp([{ wo: 'WO-100-1', step: '12. ON HOLD / DELETE' }, { wo: 'WO-101-1', step: '12. ON HOLD / DELETE' }, { wo: 'WO-102-1', step: '12. ON HOLD / DELETE' }, { wo: 'WO-103-1', step: '12. ON HOLD / DELETE' }, { wo: 'WO-104-1', step: '12. ON HOLD / DELETE' }]);
  const h = await ev(() => {
    showTab('b'); const brd = document.getElementById('app').textContent;
    showTab('h'); const sh = (document.getElementById('sh-hold') || {}).textContent || '';
    showTab('d'); const del = document.getElementById('app').textContent;
    const wk = '2026-10-19';
    return { brd100: /WO-100-1/.test(brd), sh100: /WO-100-1/.test(sh), waitShown: /waiting/i.test(sh), del101: /WO-101-1/.test(del), del102: /WO-102-1/.test(del),
      delBadge: +(document.getElementById('delcnt') || {}).textContent || 0, wkHrs: wkHrs(wk), sum: planOrders().filter(o => o.plannedWeek === wk).length,
      g104: boardOrders().filter(o => o.grp === 'G1').map(o => o.wo), shipBadge: (document.getElementById('shipcnt') || {}).textContent };
  });
  rec('12: job with waiting (N/A) lines put on hold — waiting lines still visible somewhere (board or On hold card)', am0 > 0 && (h.brd100 || h.waitShown), JSON.stringify({ am0, onBoard: h.brd100, inHoldSection: h.sh100, holdCardSaysWaiting: h.waitShown }));
  const saw = await ev(() => { DB.orders.find(o => o.wo === 'WO-100-1').dueDate = '2026-10-20'; const d = document.createElement('div'); renderWorkList(d, 'saw'); const t = d.textContent; return { L1: /Unit 100|L1/.test(t), onHoldMark: /on hold/i.test(t), txt: t.replace(/\s+/g, ' ').slice(0, 160), held: DB.orders.find(o => o.wo === 'WO-100-1').cienHold }; });
  rec('12: saw queue — cutting list for a job ON HOLD in Cienapps is not still queued for cutting without a warning', !saw.L1 || saw.onHoldMark, JSON.stringify(saw) + ' (list L1, only WO tagged is on hold, still in the saw queue, no on-hold marker)');
  rec('12: tagged-but-not-loaded job on a van/day while ON HOLD — not still planned on the Deliveries board (or at least flagged there)', !h.del101, JSON.stringify({ stillOnDeliveries: h.del101, badge: h.delBadge }));
  rec('12: job already LOADED on a van stays visible on Deliveries (driver must not lose it)', h.del102, String(h.del102));
  rec('12: week totals exclude all held jobs (6 jobs × 6h left = 36h this week)', h.wkHrs === 36, 'wkHrs=' + h.wkHrs + ' count=' + h.sum);
  rec('12: grouped pair — held member off the board, the other stays', h.g104.join() === 'WO-104-2', h.g104.join());
  // on hold → step unchanged on the job, no delivery flags lost
  const o101 = await g('WO-101-1'), o102 = await g('WO-102-1');
  rec('12: hold keeps van/day/loaded fields (nothing deleted)', o101.delVeh === 'VOLVO' && o101.delDay === 'Tue' && !!o102.delLoadedAt && o101.cienHold, JSON.stringify([o101.delVeh, o101.delDay, o102.delLoadedAt]));
  // the same 12 again → nothing changes, no new flag noise
  let r = await imp([{ wo: 'WO-103-1', step: '12. ON HOLD / DELETE' }]);
  rec('12: re-import of 12 on a held job → no update, no "back" flag', !r.flagged.some(f => /back from on hold/.test(f.why)) && (await g('WO-103-1')).cienHold, JSON.stringify(r.flagged));
  // file with no step column → stays held
  r = await imp([{ wo: 'WO-103-1', value: 5000 }]);
  rec('12: import with no step for a held job → stays on hold', (await g('WO-103-1')).cienHold === true, JSON.stringify(r.flagged));
  // back from hold to a LOWER step than its planner step
  r = await imp([{ wo: 'WO-103-1', step: '3. READY FOR UPLOAD' }]);
  const b103 = await g('WO-103-1');
  rec('12→3: back on the board, planner step 5 not moved backwards, flagged', !b103.cienHold && b103.step === '5. WORK ORDER PROCESSED' && r.flagged.some(f => /back from on hold/.test(f.why)), JSON.stringify([b103.step, b103.cienHold, r.diffs]));
  const vis103 = await ev(() => { showTab('b'); return /WO-103-1/.test(document.getElementById('app').textContent); });
  console.log('INFO  returned job in old week 3 Aug visible on the Capacity Board: ' + vis103);
  rec('12→back: job whose planned week is long past (3 Aug) comes back visibly late / needing a week (not silently in an old week)', vis103 || b103.plannedWeek !== '2026-08-03' || r.flagged.some(f => f.wo === 'WO-103-1' && /week|late|past|re-?plan/i.test(f.why)), 'plannedWeek=' + b103.plannedWeek + ' flag=' + JSON.stringify(r.flagged.map(f => f.why)));
  // new job at 12 then back: scheduled?
  await imp([{ wo: 'WO-110-1', step: '12. ON HOLD / DELETE', value: 3000, dueDate: '2026-11-06' }]);
  r = await imp([{ wo: 'WO-110-1', step: '5. WORK ORDER PROCESSED', value: 3000, dueDate: '2026-11-06' }]);
  const n110 = await g('WO-110-1');
  rec('new-at-12 then back: lands on the board (unscheduled or due week), flagged', !n110.cienHold && r.flagged.some(f => f.wo === 'WO-110-1'), JSON.stringify([n110.plannedWeek, n110.cienHold]));
  // shipped job then 12 → where is it?
  await imp([{ wo: 'WO-105-1', step: '9. JOB SHIPPED' }]);
  await imp([{ wo: 'WO-105-1', step: '12. ON HOLD / DELETE' }]);
  const s105 = await ev(() => { showTab('h'); const t = document.getElementById('app').textContent; const o = DB.orders.find(o => o.wo === 'WO-105-1'); return { inApp: (t.match(/WO-105-1/g) || []).length, held: !!o.cienHold, shipped: !!o.shippedAt }; });
  rec('9 then 12: job shows once (Shipped list) — not lost, not doubled', s105.inApp === 1, JSON.stringify(s105));

  // ---------- 10 / 11
  r = await imp([{ wo: 'WO-106-1', step: '11. COMPLETED AND INVOICED' }]);
  let o106 = await g('WO-106-1');
  rec('11 directly from 5: shipped + installed + complete', !!o106.shippedAt && !!o106.installedAt && !!o106.completeAt, JSON.stringify([o106.shippedAt, o106.installedAt, o106.completeAt]));
  // planner "Undo complete" then re-import 11 → is the undo respected?
  await ev(() => { const o = DB.orders.find(o => o.wo === 'WO-106-1'); delete o.completeAt; delete o.completeBy; });
  r = await imp([{ wo: 'WO-106-1', step: '11. COMPLETED AND INVOICED' }]);
  o106 = await g('WO-106-1');
  rec('11: planner pressed "Undo complete" — the next import of the same 11 does not silently re-complete it', !o106.completeAt, JSON.stringify({ completeAt: o106.completeAt, by: o106.completeBy, marks: r.marks }));
  // 10 then 11 later
  await imp([{ wo: 'WO-108-1', step: '10. INSTALLED TO BE INVOICE' }]);
  let o108 = await g('WO-108-1');
  const a108 = [!!o108.shippedAt, !!o108.installedAt, !!o108.completeAt];
  await imp([{ wo: 'WO-108-1', step: '11. COMPLETED AND INVOICED' }]);
  o108 = await g('WO-108-1');
  rec('10 then 11: installed, then complete', JSON.stringify(a108) === '[true,true,false]' && !!o108.completeAt, JSON.stringify([a108, !!o108.completeAt]));
  // brought back at 10 (Bring back button), Cienapps then says 11 → back to shipped AND complete
  await imp([{ wo: 'WO-113-1', step: '10. INSTALLED TO BE INVOICE', value: 100, dueDate: '2026-10-23' }]); // new at 10 → not added
  await ev(() => { DB.orders.push(Object.assign({}, DB.orders.find(o => o.wo === 'WO-108-1'), { wo: 'WO-113-1', shippedAt: undefined, completeAt: undefined, installedAt: undefined, step: '5. WORK ORDER PROCESSED', cienStep: '' })); });
  await imp([{ wo: 'WO-113-1', step: '10. INSTALLED TO BE INVOICE' }]);
  await ev(() => { showTab('h'); document.querySelector('[data-shb="WO-113-1"]').click(); });
  const bb = await g('WO-113-1');
  r = await imp([{ wo: 'WO-113-1', step: '11. COMPLETED AND INVOICED' }]);
  o108 = await g('WO-113-1');
  console.log('INFO  brought back at 10: installedAt kept=' + !!bb.installedAt + ' shipBack=' + JSON.stringify(bb.shipBack));
  rec('brought back, Cienapps moves on to 11 → Shipped + complete again', !!o108.shippedAt && !!o108.completeAt, JSON.stringify([o108.shippedAt, o108.completeAt]));

  // ---------- auto-tag 7/8
  await imp([{ wo: 'WO-109-1', step: '7. ASSEMBLY COMPLETE' }]);
  let o109 = await g('WO-109-1');
  const tag1 = [o109.delv, o109.delVeh || '', o109.delDay || '', o109.step];
  r = await imp([{ wo: 'WO-109-1', step: '5. WORK ORDER PROCESSED' }]);
  o109 = await g('WO-109-1');
  rec('7 auto-tag, then a later import says 5 → still tagged, step still 7, listed as planner ahead', tag1[0] === true && o109.delv === true && o109.step === '7. ASSEMBLY COMPLETE' && r.diffs.some(d => d.wo === 'WO-109-1'), JSON.stringify([tag1, o109.delv, o109.step]));
  // planner untags at 7 (board button clears delv/van/day), import then says 8 → re-tagged?
  await ev(() => { const o = DB.orders.find(o => o.wo === 'WO-109-1'); o.delv = false; o.delVeh = ''; o.delDay = ''; });
  r = await imp([{ wo: 'WO-109-1', step: '8. PALLETED' }]);
  o109 = await g('WO-109-1');
  console.log('INFO  planner untagged at 7, import 8 → delv=' + o109.delv + ' (re-tagged: the planner\'s untag is overridden when the step moves on)');
  // held job comes back at 7 → tagged
  await imp([{ wo: 'WO-104-1', step: '7. ASSEMBLY COMPLETE' }]);
  const o104 = await g('WO-104-1');
  rec('held job comes back at 7 → on the board AND auto-tagged', !o104.cienHold && o104.delv === true, JSON.stringify([o104.cienHold, o104.delv]));
  // auto-tag a job planned 6 weeks out — does it land on the delivery board?
  await imp([{ wo: 'WO-111-1', step: '8.PALLETED', value: 2000, dueDate: '2026-12-11' }]);
  const o111 = await g('WO-111-1');
  rec('new at 8 → tagged, scheduled to its due week', o111.delv === true && !!o111.plannedWeek, JSON.stringify([o111.delv, o111.plannedWeek]));

  // ---------- woFinished's loose match — real wrong results?
  // a) Cienapps 9 → Shipped; planner "Bring back to board" (remake): still has work → should count as live
  await imp([{ wo: 'WO-107-1', step: '9. JOB SHIPPED', dueDate: '2026-10-21' }]);
  await ev(() => { showTab('h'); document.querySelector('[data-shb="WO-107-1"]').click(); });
  const wf = await ev(() => { const o = DB.orders.find(o => o.wo === 'WO-107-1'); const l2 = lists().find(l => l.id === 'L2');
    // unlist it so "lists needed" applies
    const r = { onBoard: boardOrders().includes(o), shipped: isShipped(o), step: o.step, woFinished: woFinished(o), listFinished: listFinished(l2) };
    l2.wos = []; r.inNeeded = listsNeeded().some(x => x.wo === 'WO-107-1'); l2.wos = ['WO-107-1']; return r; });
  rec('woFinished: brought-back job (step "9. JOB SHIPPED", back on the board) — its cutting list is NOT hidden as completed', !wf.listFinished, JSON.stringify(wf));
  rec('woFinished: brought-back job due in 2 days with no list — appears in "Cutting lists needed"', wf.inNeeded, JSON.stringify(wf));
  // b) planner picks "Job shipped" from the board's step dropdown (getSteps base list) — not shipped by the ladder
  const wf2 = await ev(() => { const o = DB.orders.find(o => o.wo === 'WO-100-1'); delete o.cienHold; o.step = 'Job shipped'; const l1 = lists().find(l => l.id === 'L1');
    return { ladderShipped: stepIsShipped(o.step), onBoard: boardOrders().includes(o), inTotals: planOrders().includes(o), woFinished: woFinished(o), listFinished: listFinished(l1), dropdownHas: getSteps() }; });
  rec('woFinished vs ladder: board dropdown "Job shipped" — job stays on board/totals but its list is hidden as completed (inconsistent)', wf2.woFinished === wf2.ladderShipped || wf2.onBoard === false, JSON.stringify(wf2));
  // c) "10. INSTALLED TO BE INVOICE" vs "11." — loose match treats them differently
  const wf3 = await ev(() => [woFinished({ step: '10. INSTALLED TO BE INVOICE' }), woFinished({ step: '11. COMPLETED AND INVOICED' }), woFinished({ step: '9. JOB SHIPPED' }), woFinished({ step: 'Ready to be shipped' })]);
  rec('woFinished agrees with stepIsShipped for 9/10/11 and "Ready to be shipped"', JSON.stringify(wf3) === '[true,true,true,false]', JSON.stringify(wf3));

  // ---------- injection through the new On-hold card
  await imp([{ wo: 'WO-112-1', step: '12. ON HOLD / DELETE', value: 100, dueDate: '2026-11-06', title: '<img src=x onerror=window.__x=1>O\'Grady', customer: '"><script>window.__y=1</script>' }]);
  const inj = await ev(async () => { showTab('h'); await new Promise(r => setTimeout(r, 200)); return { x: !!window.__x, y: !!window.__y, txt: /O'Grady/.test(document.getElementById('sh-hold').textContent) }; });
  rec('On hold card: HTML in title/customer shown as text, never run', !inj.x && !inj.y && inj.txt, JSON.stringify(inj));
  // phone width: On hold section readable
  await t.page.setViewportSize({ width: 380, height: 800 });
  const ph = await ev(() => { showTab('h'); return document.documentElement.scrollWidth; });
  rec('phone 380px: Shipped/On hold tab has no sideways scroll', ph <= 382, 'scrollWidth=' + ph);
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
