// Dates & deliveries (Job A): two PCs. (1) Office A moves a date (job comes off the van) while the driver's phone B loads
// it → loaded is never pulled: the van and the load both survive, the date move survives. (2) Two PCs move the same date
// → the later save's date wins, BOTH moves are kept in the history. (3) Old saved data with none of the new fields loads,
// renders board / deliveries / export, and a move works on it. Stubbed Supabase only (tests/stage1/srv.js).
// Run: node tests/dates/c4-two-pcs.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-11-10T10:00:00Z';
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = p => p.evaluate(async () => { await loadDB(); });
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '8. PALLETED' }, x));
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [O('WO-1', { delv: true, delVeh: 'VOLVO', delDay: 'Thu' }), O('WO-2', { step: '3. In production' }), O('WO-3', { delv: true, delVeh: 'DAF', delDay: 'Fri' })] });
    // (Tester round 2, 10 Nov — rule changed in 286afae: both-PC date moves merge as one unit and the NEWER move wins, not the later save.
    //  B's clock runs 2 minutes ahead so Bob's move is genuinely the newer one, whichever page saves last.)
    const A = await open(browser, S, { now: NOW }), B = await open(browser, S, { now: '2026-11-10T10:02:00Z' });
    await A.page.evaluate(() => { moveDates(['WO-1'], { due: '2026-11-27' }, { why: 'Site not ready' }, 'Ann').apply(); });
    await B.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); o.delLoadedAt = new Date().toISOString(); o.ldBy = 'Driver'; sched(); });
    await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); return o.delDay; });
    await save(A.page); await save(B.page); await reload(A.page); await reload(B.page);
    const r = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); return { due: o.dueDate, veh: o.delVeh, day: o.delDay, loaded: !!o.delLoadedAt, hist: (o.dueHist || []).length }; });
    const db = S.row.orders.find(o => o.wo === 'WO-1');
    rec('move-vs-load: loaded job keeps its van and day, the date move survives', r.due === '2026-11-27' && r.veh === 'VOLVO' && r.day === 'Thu' && r.loaded && r.hist === 1 && db.delDay === 'Thu' && !!db.delLoadedAt, JSON.stringify(r));
    // (1b) same, the other save order: the load lands first
    await A.page.evaluate(() => { moveDates(['WO-3'], { due: '2026-11-27' }, { why: 'Site not ready' }, 'Ann').apply(); });
    await B.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3'); o.delLoadedAt = new Date().toISOString(); o.ldBy = 'Driver'; sched(); });
    await save(B.page); await save(A.page); await reload(A.page); await reload(B.page);
    const r1b = await B.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3'); return { due: o.dueDate, veh: o.delVeh, day: o.delDay, loaded: !!o.delLoadedAt }; });
    rec('move-vs-load, load saved first: still on the van, loaded, date moved', r1b.due === '2026-11-27' && r1b.veh === 'DAF' && r1b.day === 'Fri' && r1b.loaded, JSON.stringify(r1b));
    // (2) two PCs move WO-2
    await A.page.evaluate(() => { moveDates(['WO-2'], { due: '2026-11-24' }, { why: 'Production' }, 'Ann').apply(); });
    await B.page.evaluate(() => { moveDates(['WO-2'], { due: '2026-11-26' }, { why: 'Materials' }, 'Bob').apply(); });
    await save(B.page); await new Promise(r => setTimeout(r, 30)); await save(A.page); await reload(A.page); // Ann's OLDER move saves last
    const r2 = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-2'); return { due: o.dueDate, wk: o.plannedWeek, keep: o.dueKeep, hist: (o.dueHist || []).map(h => h.by + ':' + h.to).sort(), last: ((o.dueHist || []).slice(-1)[0] || {}).by }; });
    rec('both move the same date: the newer move (Bob) wins as a unit even though Ann saved last; both moves kept in history, newest last', r2.due === '2026-11-26' && r2.wk === '2026-11-23' && r2.last === 'Bob' && r2.keep === '2026-11-20' && JSON.stringify(r2.hist) === '["Ann:2026-11-24","Bob:2026-11-26"]', JSON.stringify(r2));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await B.close();
  }
  {
    // (3) old saved data: none of the new fields, odd values
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { delNotes: { Mon: 'x' } }, orders: [
      { wo: 'WO-9', title: 'Old', customer: 'C', hours: 3, dueDate: '2026-11-20', step: '3. In production', plannedWeek: '2026-11-16', delv: true, delVeh: 'DAF', delDay: 'Tue' },
      { wo: 'WO-10', title: 'No date', customer: 'C', hours: 3, step: '3. In production' },
      { wo: 'WO-11', title: 'Junk', customer: 'C', hours: 3, dueDate: '2026-11-20', dueHist: null, dueMv: null, delRebook: null }] });
    const A = await open(browser, S, { now: NOW });
    const r = await A.page.evaluate(async () => {
      const out = {};
      for (const tb of ['b', 'd', 'x']) { showTab(tb); await new Promise(r => setTimeout(r, 120)); out[tb] = document.getElementById('app').innerText.length > 50; }
      out.mv = moveDates(['WO-9', 'WO-10', 'WO-11'], { shift: { n: 1, unit: 'wk' } }, { why: 'Production' }, 'Ann', { src: 'group' }).apply();
      const g = w => DB.orders.find(o => o.wo === w);
      out.d9 = g('WO-9').dueDate; out.k9 = g('WO-9').dueKeep; out.o9 = g('WO-9').origDueDate; out.day9 = g('WO-9').delDay; out.h11 = (g('WO-11').dueHist || []).length;
      showTab('b'); await new Promise(r => setTimeout(r, 120)); out.chips = document.querySelectorAll('[data-duehist]').length;
      return out;
    });
    rec('old saved data loads and renders board / deliveries / export', r.b && r.d && r.x, JSON.stringify(r));
    rec('a move works on old data (orig + keep filled, van pulled, missing date skipped)', r.d9 === '2026-11-27' && r.k9 === '2026-11-20' && r.o9 === '2026-11-20' && !r.day9 && r.h11 === 1 && r.mv.moved === 2 && r.mv.skipped.length === 1 && r.chips === 2, JSON.stringify(r));
    rec('no page errors (old data)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
