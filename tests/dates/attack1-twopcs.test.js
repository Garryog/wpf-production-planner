// Tester attack 1 — two PCs at once on the dates / deliveries work. Shared in-memory fake Supabase (tests/stage1/srv.js).
// A: office closes Wk 46 while the driver's phone loads / delivers / books in it (both save orders).
// B: both PCs type a note on the same date.  C: one moves a due date while the other re-books / books the job.
// D: both move the same job's date (history from both kept; build week must match the date that won).
// Run: node tests/dates/attack1-twopcs.test.js
const { H, makeServer, open, recorder, save, reload, w } = require('./attack1-lib');
const { rec, done } = recorder('attack1-twopcs');
const W = '2026-11-09', WN = '2026-11-16';
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-13', origDueDate: '2026-11-13', plannedWeek: W, step: '8. PALLETED', delv: true, customer: 'CAIRN', title: 'House ' + wo }, x));
  const closeRow = () => ({ id: 'main', version: 1, nid: 9, settings: {}, orders: [
    O('J1', { delVeh: 'VOLVO', delDay: 'Fri', delWk: W }),
    O('J2', { delVeh: 'VOLVO', delDay: 'Thu', delWk: W, delLoadedAt: '2026-11-12T07:00:00Z', ldBy: 'Dan' }),
    O('J3', { delVeh: 'DAF', delDay: 'Wed', delWk: W, delLoadedAt: '2026-11-11T07:00:00Z', delDelivAt: '2026-11-11T12:00:00Z', delDone: true, delivBy: 'Dan' }),
    O('J4'),
    O('J7', { delVeh: 'DAF', delDay: 'Tue', delWk: WN }),
  ] });
  const driverWork = p => p.evaluate(() => {
    const g = w => DB.orders.find(o => o.wo === w), at = new Date().toISOString();
    g('J1').delLoadedAt = at; g('J1').ldBy = 'Dan';                                     // loads J1
    g('J2').delDelivAt = at; g('J2').delDone = true; g('J2').delivBy = 'Dan';           // delivers J2
    g('J4').delVeh = 'DAF'; g('J4').delDay = 'Sat'; g('J4').delWk = '2026-11-09';        // books J4 into Wk 46 Sat
    sched();
  });
  const closeIt = p => p.evaluate(async () => { closeWeek('2026-11-09'); await new Promise(r => setTimeout(r, 900)); });
  const state = p => p.evaluate(() => { const g = w => DB.orders.find(o => o.wo === w); const pk = o => ({ veh: o.delVeh || '', day: o.delDay || '', wk: o.delWk || '', ld: !!o.delLoadedAt, dv: !!(o.delDelivAt || o.delDone), rb: o.delRebook ? o.delRebook.why : '' });
    const ks = Object.keys(DB.delArchive || {}).sort(), a = ks.length ? DB.delArchive[ks[ks.length - 1]] : null;
    return { J1: pk(g('J1')), J2: pk(g('J2')), J3: pk(g('J3')), J4: pk(g('J4')), J7: pk(g('J7')), arch: a ? a.jobs.map(j => j.wo + (j.vAt ? ':D' : ':-')).sort() : [], log2: (g('J2').log || []).map(l => l.what).filter(x => /Not delivered/.test(x)) }; });

  // A1: driver saves first, then the office (stale screen) closes the week
  for (const order of ['driver-first', 'office-first']) {
    const S = makeServer(closeRow());
    const A = await open(browser, S, { now: '2026-11-13T15:00:00Z' }), B = await open(browser, S, { now: '2026-11-13T15:00:00Z' });
    if (order === 'driver-first') { await driverWork(B.page); await save(B.page); await closeIt(A.page); await save(A.page); }
    else { await closeIt(A.page); await save(A.page); await driverWork(B.page); await save(B.page); }
    await reload(A.page);
    const r = await state(A.page);
    rec(`close week vs driver (${order}): J1 loaded by the driver stays on its van, loaded`, r.J1.ld && r.J1.day === 'Fri' && r.J1.veh === 'VOLVO', JSON.stringify(r.J1));
    rec(`close week vs driver (${order}): J2 delivered by the driver is delivered, not "not delivered — rebook"`, r.J2.dv && !r.J2.rb, JSON.stringify(r.J2));
    rec(`close week vs driver (${order}): J4 booked into Wk 46 Sat by the other PC is not lost`, (r.J4.day === 'Sat' && r.J4.wk === W) || /rebook|Not delivered/i.test(r.J4.rb), JSON.stringify(r.J4));
    rec(`close week vs driver (${order}): next week's J7 untouched`, r.J7.day === 'Tue' && r.J7.wk === WN, JSON.stringify(r.J7));
    if (order === 'driver-first') {
      rec('close week vs driver (driver-first): Past weeks archive shows J2 as delivered (driver confirmed it before the close)', r.arch.includes('J2:D'), JSON.stringify(r.arch));
      rec('close week vs driver (driver-first): J2 history does not say "Not delivered in Wk 46" for a job that was delivered', !r.log2.length, JSON.stringify(r.log2));
    }
    rec(`no page errors (${order})`, !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await B.close();
  }

  // B: both PCs type a note on the same date
  {
    const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('J1')] });
    const A = await open(browser, S, { now: '2026-11-10T10:00:00Z' }), B = await open(browser, S, { now: '2026-11-10T10:00:00Z' });
    const type = (p, v) => p.evaluate(async v => { showTab('d'); await new Promise(r => setTimeout(r, 120)); const n = document.querySelector('.dnote[data-dnote="2026-11-12"]'); n.value = v; n.dispatchEvent(new Event('input')); }, v);
    await type(A.page, 'A: crane at 8am'); await type(B.page, 'B: ring site first');
    await save(A.page); await save(B.page); await reload(A.page);
    const n = await A.page.evaluate(() => DB.delNotes['2026-11-12']);
    rec('both type a note on Thu 12 Nov: neither note is lost (or the loser is told)', /crane/.test(n) && /ring site/.test(n), JSON.stringify(n) + ' — the other PC\'s note is gone with no message');
    await A.close(); await B.close();
  }

  // C1: A moves J5's due date (it comes off next week's van) while B moves J5's booking to another day next week
  for (const order of ['move-first', 'rebook-first']) {
    const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('J5', { dueDate: '2026-11-18', plannedWeek: WN, delVeh: 'VOLVO', delDay: 'Tue', delWk: WN })] });
    const A = await open(browser, S, { now: '2026-11-10T10:00:00Z' }), B = await open(browser, S, { now: '2026-11-10T10:00:00Z' });
    const mv = () => A.page.evaluate(() => moveDates(['J5'], { due: '2026-12-02' }, { why: 'Site not ready' }, 'Ann').apply());
    const bk = () => B.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'J5'); (o.delMoves = o.delMoves || []).push({ at: new Date().toISOString(), by: 'Bob', why: 'Customer request', from: 'VOLVO|Tue|2026-11-16', to: 'DAF|Wed|2026-11-16' }); o.delVeh = 'DAF'; o.delDay = 'Wed'; o.delWk = '2026-11-16'; sched(); });
    if (order === 'move-first') { await mv(); await save(A.page); await bk(); await save(B.page); } else { await bk(); await save(B.page); await mv(); await save(A.page); }
    await reload(A.page); await reload(B.page);
    const r = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'J5'); return { due: o.dueDate, veh: o.delVeh || '', day: o.delDay || '', wk: o.delWk || '', slotWk: slotWk(o), rb: !!o.delRebook, missed: missedJobs().some(x => x.wo === 'J5') }; });
    const consistent = (r.day && r.wk && !r.rb) || (!r.day && r.rb);
    rec(`date move vs re-book on another PC (${order}): job ends either booked WITH its week, or in the pool flagged rebook — never half of each`, consistent && r.due === '2026-12-02', JSON.stringify(r));
    rec(`date move vs re-book (${order}): a booking that survives stays in Wk 47, not jumped to this week`, !r.day || r.slotWk === WN, JSON.stringify(r));
    await A.close(); await B.close();
  }
  // C2: J6 in the pool. A moves its date two weeks later; B books it on next week's van. Both kept.
  {
    const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('J6', { dueDate: '2026-11-18', plannedWeek: WN })] });
    const A = await open(browser, S, { now: '2026-11-10T10:00:00Z' }), B = await open(browser, S, { now: '2026-11-10T10:00:00Z' });
    await A.page.evaluate(() => moveDates(['J6'], { due: '2026-12-02' }, { why: 'Customer delay' }, 'Ann').apply());
    await B.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 100));
      document.querySelector('.dchip[data-dw="J6"]').click(); await new Promise(r => setTimeout(r, 50));
      document.querySelector('[data-place="VOLVO|Wed|2026-11-16"]').click(); await new Promise(r => setTimeout(r, 120)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); });
    await save(A.page); await save(B.page); await reload(A.page);
    const r = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'J6'); return { due: o.dueDate, wk: o.plannedWeek, day: o.delDay, delWk: o.delWk, hist: (o.dueHist || []).length, flagged: !!(o.dueMv || o.delRebook) }; });
    rec('date move vs booking (pool job): both survive (due 2 Dec, booked Wed 18 Nov)', r.due === '2026-12-02' && r.day === 'Wed' && r.delWk === WN && r.hist === 1, JSON.stringify(r));
    // (J6 is built — step 8 — so the build week is kept and the 'due moved — check week' chip shows; that is the plan's rule)
    rec('date move vs booking: the cut job carries the "due moved — check week" chip', r.flagged, JSON.stringify(r));
    await A.close(); await B.close();
  }

  // D: both move the same job's date. B moves it to 4 Dec (build week → Wk 49), A moves it a day earlier (same week). B saves first.
  {
    const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('J8', { dueDate: '2026-11-20', plannedWeek: WN, step: '3. In production', delv: false })] });
    const A = await open(browser, S, { now: '2026-11-10T10:00:00Z' }), B = await open(browser, S, { now: '2026-11-10T10:00:00Z' });
    await B.page.evaluate(() => moveDates(['J8'], { due: '2026-12-04' }, { why: 'Materials' }, 'Bob').apply()); await save(B.page);
    await A.page.evaluate(() => moveDates(['J8'], { due: '2026-11-19' }, { why: 'Production' }, 'Ann').apply()); await save(A.page);
    await reload(B.page);
    const r = await B.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'J8'); return { due: o.dueDate, wk: o.plannedWeek, dueWk: dueWeekFor(o.dueDate), hist: (o.dueHist || []).map(h => h.by + ':' + h.to).sort(), keep: o.dueKeep, last: (o.dueHist || []).slice(-1)[0] }; });
    rec('both move the same date: both history entries kept', JSON.stringify(r.hist) === '["Ann:2026-11-19","Bob:2026-12-04"]', JSON.stringify(r.hist));
    rec('both move the same date: build week matches the date that won (not Wk 49 with a 19 Nov due date)', r.wk === r.dueWk, JSON.stringify(r));
    rec('both move the same date: the last history entry is the date that won ("moved to" matches the board)', r.last && r.last.to === r.due, JSON.stringify(r.last) + ' due=' + r.due);
    await A.close(); await B.close();
  }
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
