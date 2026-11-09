// Dates & deliveries (Job A, Garry 9 Nov): the shared date engine moveDates(jobs, change, reason, by, opts).
// One move updates dueDate / origDueDate / dueKeep / dueHist / plannedWeek; a cut job keeps its week (+ dueMv chip);
// a booked job comes off the van (delRebook); a loaded job stays and is flagged; moving back to the Cienapps date
// clears dueKeep; group +2 weeks; 25 Dec / 28 Dec 2026 are flagged with the working day before. Stubbed Supabase only.
// Run: node tests/dates/c1-engine.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production' }, x));
  const row = { id: 'main', nid: 5, settings: {}, orders: [
    O('WO-1'),
    O('WO-2', { step: '6. JOB CUT COMPLETE' }),
    O('WO-2B', { photoDone: { saw: { at: '2026-11-09T10:00:00Z', by: 'Saw' } } }),
    O('WO-3', { delv: true, delVeh: 'VOLVO', delDay: 'Thu' }),
    O('WO-4', { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delLoadedAt: '2026-11-10T08:00:00Z', ldBy: 'Driver' }),
    O('WO-5', { dueDate: '2026-11-18', origDueDate: '2026-11-18' }),
    O('WO-6', { dueDate: '2026-11-19', origDueDate: '2026-11-19' }),
    O('P-7', { step: 'Planner WO' }),
    O('WO-8', { step: '5. WORK ORDER PROCESSED' }),
    O('WO-9'), O('WO-10'), O('WO-11', { dueDate: '2026-11-30', origDueDate: '2026-11-30', plannedWeek: '2026-11-30' }),
    O('WO-12', { delv: true, delVeh: 'DAF', delDay: 'Mon', delDelivAt: '2026-11-09T15:00:00Z' })
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const r = await t.page.evaluate(async () => {
    const g = w => DB.orders.find(o => o.wo === w);
    const out = {};
    // 1. one move — not cut: week follows
    const m1 = moveDates(['WO-1'], { due: '2026-11-27' }, { why: 'Customer delay', note: 'site late' }, 'Ann', { src: 'planner' });
    out.prev1 = JSON.parse(JSON.stringify(m1.rows));
    out.before1 = g('WO-1').dueDate;
    out.res1 = m1.apply();
    const a = g('WO-1'); out.a = { due: a.dueDate, orig: a.origDueDate, keep: a.dueKeep, wk: a.plannedWeek, hist: a.dueHist, log: a.log[a.log.length - 1] };
    // 2. cut (step 6) and photo-cut jobs keep their week
    const m2 = moveDates(['WO-2', 'WO-2B'], { due: '2026-12-04' }, { why: 'Production' }, 'Ann'); out.prev2 = m2.rows; m2.apply();
    out.b = ['WO-2', 'WO-2B'].map(w => ({ due: g(w).dueDate, wk: g(w).plannedWeek, mv: g(w).dueMv }));
    // 3. booked → off the van, rebook
    const m3 = moveDates(['WO-3'], { due: '2026-11-25' }, { why: 'Site not ready' }, 'Ann'); out.prev3 = m3.rows; m3.apply();
    const c = g('WO-3'); out.c = { delv: c.delv, veh: c.delVeh, day: c.delDay, rebook: c.delRebook, moves: c.delMoves };
    // 4. loaded → stays, flagged
    const m4 = moveDates(['WO-4'], { due: '2026-11-25' }, { why: 'Site not ready' }, 'Ann'); out.prev4 = m4.rows; m4.apply();
    const d = g('WO-4'); out.d = { veh: d.delVeh, day: d.delDay, loaded: d.delLoadedAt, rebook: d.delRebook, mv: d.dueMv };
    // 5. moved back to the Cienapps date: dueKeep cleared
    moveDates(['WO-1'], { due: '2026-11-20' }, { why: 'Customer delay' }, 'Bob').apply();
    out.e = { due: g('WO-1').dueDate, keep: g('WO-1').dueKeep, n: g('WO-1').dueHist.length, wk: g('WO-1').plannedWeek, orig: g('WO-1').origDueDate };
    // 6. group +2 weeks
    const r6 = moveDates(['WO-5', 'WO-6'], { shift: { n: 2, unit: 'wk' } }, { why: 'Materials' }, 'Ann', { src: 'group' }).apply();
    out.f = { r6: { moved: r6.moved }, d5: g('WO-5').dueDate, d6: g('WO-6').dueDate, w5: g('WO-5').plannedWeek, src: g('WO-5').dueHist[0].src };
    // 7. bank holidays
    const p25 = moveDates(['WO-9'], { due: '2026-12-25' }, {}, 'x').rows[0], p28 = moveDates(['WO-9'], { due: '2026-12-28' }, {}, 'x').rows[0];
    const sat = moveDates(['WO-9'], { due: '2026-11-28' }, {}, 'x').rows[0];
    out.g = { f25: p25.flags, f28: p28.flags, w25: prevWorkDay('2026-12-25'), w28: prevWorkDay('2026-12-28'), t25: dmFlagTxt('bank-hol', p25), tsat: dmFlagTxt('bank-hol', sat), wk28: wkNum('2026-12-28'), wk28to: p28.wkTo };
    // 8. planner WO: never a dueKeep
    moveDates(['P-7'], { due: '2026-11-27' }, { why: 'Production' }, 'Ann').apply(); out.h = { keep: g('P-7').dueKeep, due: g('P-7').dueDate };
    // 9. past / beyond 8 weeks / programmed
    const pp = moveDates(['WO-10'], { due: '2026-11-02' }, {}, 'x').rows[0]; out.i = { flags: pp.flags, wk: pp.wkTo };
    const pb = moveDates(['WO-10'], { due: '2027-02-01' }, {}, 'x').rows[0]; out.j = { flags: pb.flags, wk: pb.wkTo };
    moveDates(['WO-8'], { due: '2026-12-02' }, { why: 'Production' }, 'Ann').apply(); out.k = { wk: g('WO-8').plannedWeek, mv: g('WO-8').dueMv };
    // 10. -1 working day from Mon 30 Nov → Fri 27 Nov
    moveDates(['WO-11'], { shift: { n: -1, unit: 'wd' } }, { why: 'Production' }, 'Ann').apply(); out.l = g('WO-11').dueDate;
    // 11. delivered job is skipped; same date skipped; deleted between preview and apply skipped
    out.m = moveDates(['WO-12'], { due: '2026-12-01' }, {}, 'x').rows[0].skipped;
    out.n = moveDates(['WO-9'], { due: '2026-11-20' }, {}, 'x').rows[0].skipped;
    const mz = moveDates(['WO-10'], { due: '2026-11-26' }, { why: 'x' }, 'x'); DB.orders = DB.orders.filter(o => o.wo !== 'WO-10'); out.o = mz.apply();
    // 12. old saved data with no new fields renders the board
    showTab('b'); await new Promise(r => setTimeout(r, 200));
    out.board = { chips: document.querySelectorAll('[data-duehist]').length, mv: document.querySelectorAll('[data-duemv]').length, due: document.querySelectorAll('[data-duedlg]').length };
    await new Promise(r => setTimeout(r, 1600));
    return out;
  });
  rec('preview writes nothing', r.before1 === '2026-11-20' && r.prev1[0].to === '2026-11-27' && r.prev1[0].wkTo === '2026-11-23', JSON.stringify(r.prev1));
  rec('one move: dueDate, origDueDate kept, dueKeep = Cienapps date, week follows', r.a.due === '2026-11-27' && r.a.orig === '2026-11-20' && r.a.keep === '2026-11-20' && r.a.wk === '2026-11-23', JSON.stringify(r.a));
  const h = r.a.hist && r.a.hist[0];
  rec('dueHist has who / when / old / new / reason / note / src', r.a.hist.length === 1 && h.by === 'Ann' && h.from === '2026-11-20' && h.to === '2026-11-27' && h.why === 'Customer delay' && h.note === 'site late' && h.src === 'planner' && h.f === 'due' && !!h.at, JSON.stringify(h));
  rec('job history line written with name and reason', /Due date/.test(r.a.log.what) && r.a.log.by === 'Ann' && /Customer delay/.test(r.a.log.why), JSON.stringify(r.a.log));
  rec('cut job (step 6) keeps its week + dueMv; photo-list cut too', r.b.every(x => x.due === '2026-12-04' && x.wk === '2026-11-16' && x.mv && x.mv.from === '2026-11-20') && r.prev2.every(x => x.flags.includes('cut-week-kept')), JSON.stringify(r.b));
  rec('booked job comes off the van, stays tagged, delRebook + delMoves', r.c.delv === true && !r.c.veh && !r.c.day && r.c.rebook && r.c.rebook.was === 'VOLVO|Thu' && r.c.rebook.by === 'Ann' && r.c.moves.length === 1 && r.prev3[0].vanPulled, JSON.stringify(r.c));
  rec('loaded job stays on the van, flagged', r.d.veh === 'VOLVO' && r.d.day === 'Thu' && !!r.d.loaded && !r.d.rebook && r.d.mv && r.d.mv.loaded && r.prev4[0].flags.includes('on-van-loaded'), JSON.stringify(r.d));
  rec('moved back to the Cienapps date: dueKeep cleared, history 2, original kept', r.e.due === '2026-11-20' && r.e.keep === undefined && r.e.n === 2 && r.e.orig === '2026-11-20' && r.e.wk === '2026-11-16', JSON.stringify(r.e));
  rec('group +2 weeks', r.f.r6.moved === 2 && r.f.d5 === '2026-12-02' && r.f.d6 === '2026-12-03' && r.f.w5 === '2026-11-30' && r.f.src === 'group', JSON.stringify(r.f));
  rec('25 Dec 2026 flagged, working day before = 24 Dec', r.g.f25.includes('bank-hol') && r.g.w25 === '2026-12-24' && /bank holiday/.test(r.g.t25), JSON.stringify(r.g));
  rec('28 Dec 2026 (Wk 53) flagged, working day before = 24 Dec', r.g.f28.includes('bank-hol') && r.g.w28 === '2026-12-24' && r.g.wk28 === 53 && r.g.wk28to === '2026-12-28', JSON.stringify(r.g));
  rec('a Saturday is flagged as a Saturday', /Saturday/.test(r.g.tsat), r.g.tsat);
  rec('planner WO (P-) never gets a dueKeep', r.h.due === '2026-11-27' && r.h.keep === undefined, JSON.stringify(r.h));
  rec('past date → flag + this week', r.i.flags.includes('past') && r.i.wk === '2026-11-09', JSON.stringify(r.i));
  rec('beyond 8 weeks → Unscheduled + flag', r.j.wk === '' && r.j.flags.includes('beyond-8wks'), JSON.stringify(r.j));
  rec('programmed (step 5): week follows, red chip data', r.k.wk === '2026-11-30' && r.k.mv && r.k.mv.prog, JSON.stringify(r.k));
  rec('-1 working day from Mon 30 Nov = Fri 27 Nov', r.l === '2026-11-27', r.l);
  rec('delivered job / same date are not moved', r.m === 'already delivered' && /already due/.test(r.n), r.m + ' | ' + r.n);
  rec('job deleted between preview and apply: skipped, nothing moved', r.o.moved === 0 && r.o.skipped.length === 1, JSON.stringify(r.o));
  rec('board shows moved / check chips and tappable due dates', r.board.chips > 0 && r.board.mv > 0 && r.board.due > 5, JSON.stringify(r.board));
  const last = t.server.patches[t.server.patches.length - 1];
  const sv = last && last.orders && last.orders.find(o => o.wo === 'WO-1');
  rec('saved to the database (orders only, no new top-level key)', !!sv && sv.dueHist.length === 2 && Object.keys(last).every(k => ['orders', 'settings', 'nid', 'version'].includes(k)), sv ? JSON.stringify(Object.keys(last)) : 'no patch');
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
