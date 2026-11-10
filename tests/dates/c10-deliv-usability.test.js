// Deliveries usability D1–D4 + DD1 (plan addendum, 10 Nov 2026 evening): acceptance checks 1–12.
// Quick due-date edit on the cards, week moves (→ Wk N / Move to week… / Move ticked / drag onto a tab), the week bar,
// the one due-date tag (dueTag) on cards / board / In store, cards that never overlap, group totals. Stubbed Supabase only.
// Run: node tests/dates/c10-deliv-usability.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));

  // ---------- E. the week-move engine (wkMoveTo / moveDates {toWk}) — checks 2, 3, 4 ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-E1'), O('WO-E2', { dueDate: '2026-11-04', origDueDate: '2026-11-04' }), O('WO-E3', { delivDate: '2026-11-16' }), O('WO-E4', { dueDate: '', origDueDate: '' }),
      O('WO-E5', { dueDate: '2026-11-12', step: '6. CUT' }), O('WO-E6', { dueDate: '2026-11-13' }),
    ] } });
    const E = await t.page.evaluate(async () => {
      const f = (due, deliv, W) => wkMoveTo({ dueDate: due, delivDate: deliv }, W);
      const out = {};
      out.a = f('2026-11-12', '', '2026-11-16'); out.ov = f('2026-11-04', '', '2026-11-16'); out.dv = f('2026-11-12', '2026-11-16', '2026-11-23');
      out.x1 = f('2026-12-18', '', '2026-12-21'); out.x2 = f('2026-12-21', '', '2026-12-28'); out.x3 = f('2026-12-31', '', '2027-01-04');
      out.nod = f('', '', '2026-11-16'); out.thisWkPast = f('2026-11-09', '', '2026-11-09'); out.past = f('2026-11-04', '', '2026-11-02');
      out.wed = f('2026-11-20', '', '2026-11-09');
      const g = w => DB.orders.find(o => o.wo === w);
      moveDates(['WO-E3'], { toWk: '2026-11-23' }, { why: 'Site not ready' }, 'Tester', {}).apply(); // its anchor (delivery 16 Nov) is in Wk 47
      const r = moveDates(['WO-E1', 'WO-E2', 'WO-E4', 'WO-E5'], { toWk: '2026-11-16' }, { why: 'Customer delay' }, 'Tester', { src: 'group' }).apply();
      out.res = { moved: r.moved, kept: r.weeksKept, sk: r.skipped };
      out.o = ['WO-E1', 'WO-E2', 'WO-E3', 'WO-E4', 'WO-E5'].map(w => ({ wo: w, due: g(w).dueDate, dv: g(w).delivDate || '', wk: g(w).plannedWeek, h: (g(w).dueHist || []).length, keep: g(w).dueKeep || '', mv: !!g(w).dueMv }));
      const r2 = moveDates(['WO-E6'], { toWk: '2026-11-09' }, { why: 'Production' }, 'Tester', {}).rows[0];
      out.same = r2.skipped;
      return out;
    });
    rec('2: → Next week keeps the weekday: Thu 12 Nov → Thu 19 Nov', E.a.due === '2026-11-19' && !E.a.err, JSON.stringify(E.a));
    rec('2: overdue Wed 4 Nov on This week → Next week (Wk 47) = Wed 18 Nov (whole weeks from its own week)', E.ov.due === '2026-11-18', JSON.stringify(E.ov));
    rec('2: with a delivery date both move by the same weeks (gap kept): due 12→19 Nov, delivery 16→23 Nov', E.dv.due === '2026-11-19' && E.dv.deliv === '2026-11-23', JSON.stringify(E.dv));
    rec('3: Fri 18 Dec +1 → Thu 24 Dec (Christmas Fri → the working day before)', E.x1.due === '2026-12-24', JSON.stringify(E.x1));
    rec('3: Mon 21 Dec +1 → Tue 29 Dec, Wk 53 (Mon 28 Dec bank holiday → the day after)', E.x2.due === '2026-12-29', JSON.stringify(E.x2));
    rec('3: Thu 31 Dec +1 → Thu 7 Jan 2027', E.x3.due === '2027-01-07', JSON.stringify(E.x3));
    rec('4: no due date (Cienapps job) → last working day of the week (Fri 20 Nov)', E.nod.due === '2026-11-20', JSON.stringify(E.nod));
    rec('earlier than today in this week → today (Tue 10 Nov)', E.thisWkPast.due === '2026-11-10', JSON.stringify(E.thisWkPast));
    rec('a week already gone → "No working days left in Wk 45 — pick Next week" (nothing moves)', /No working days left in Wk 45 — pick Next week/.test(E.past.err), JSON.stringify(E.past));
    rec('moving back to this week keeps the weekday (Fri 20 → Fri 13 Nov)', E.wed.due === '2026-11-13', JSON.stringify(E.wed));
    const o = k => E.o.find(x => x.wo === k);
    rec('moveDates {toWk}: due moved, history + Cienapps "keep" date written, build week follows', o('WO-E1').due === '2026-11-19' && o('WO-E1').h === 1 && o('WO-E1').keep === '2026-11-12' && o('WO-E1').wk === '2026-11-16', JSON.stringify(o('WO-E1')));
    rec('moveDates {toWk}: delivery-date job to Wk 48 — anchored on delivery (16 → 23 Nov), due 12 → 19 Nov', o('WO-E3').due === '2026-11-19' && o('WO-E3').dv === '2026-11-23' && o('WO-E3').h === 2, JSON.stringify(o('WO-E3')));
    rec('moveDates {toWk}: no-date job gets Fri 20 Nov', o('WO-E4').due === '2026-11-20', JSON.stringify(o('WO-E4')));
    rec('5: cut job — due moved, build week kept, "due moved — check week"', o('WO-E5').due === '2026-11-19' && o('WO-E5').wk === '2026-11-09' && o('WO-E5').mv && E.res.kept === 1, JSON.stringify(o('WO-E5')));
    rec('same week again = skipped ("already due …")', /already due/.test(E.same || ''), E.same);
    rec('no page errors (E)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  {
    const t = await H.open({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [] } });
    const E = await t.page.evaluate(() => wkMoveTo({ dueDate: '2026-10-19' }, '2026-10-26'));
    rec('3: October bank holiday — Mon 19 Oct +1 → Tue 27 Oct (Mon 26 Oct is a bank holiday)', E.due === '2026-10-27', JSON.stringify(E));
    await t.close();
  }

  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
