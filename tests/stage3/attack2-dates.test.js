// ATTACK 2 — date-based lock and the saw's "Waiting for a list" strip around weekends, bank holidays and Christmas.
// The app's own rule (cutTodayEnd): a cut-by date on a weekend / bank holiday is cut the working day BEFORE it. The lock
// ("cut-by today or the next working day") and "list due by" (the working day before cut-by, "so the saw sees it a day
// ahead") should follow the day the saw really cuts. Fake Supabase only. Run: node tests/stage3/attack2-dates.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
async function at(browser, now, dues) {
  const row = F.v2Row(); row.orders = dues.map(([wo, due]) => H.order({ wo, customer: 'Aderrig Homes', dueDate: due, origDueDate: due }));
  const S = F.makeServer(row);
  dues.forEach(([wo, due, withList]) => { if (withList) F.seedList(S, 'L' + wo, { wos: [wo] }); });
  const t = await F.dev(browser, S, 'saw', { now });
  await t.page.evaluate(() => { sawWaitOpen = true; render(); }); // 3 Nov flow: the amber "waiting for a list" line opens on a tap
  return { S, t };
}
const info = (p, wos) => p.evaluate(wos => wos.map(w => {
  const l = lists().find(x => (x.wos || []).includes(w)), row = document.querySelector('[data-waitwo="' + w + '"]');
  return { wo: w, today: todayLocal(), cutBy: listDeadline({ wos: [w] }), sawCutsToday: dueToday({ wos: [w] }, todayLocal()), locked: l ? lsLocked(l) : null,
    strip: row ? row.innerText.replace(/\s+/g, ' ') : null, late: row ? row.style.background !== '' : null, onSawToday: l ? !!document.querySelector('[data-wldone="' + l.id + '"]') : null };
}), wos);
(async () => {
  const browser = await H.chromium.launch();
  // Thursday 29 Oct 2026. WO-MON delivers Monday 2 Nov → cut-by Sunday → the saw cuts it FRIDAY 30 Oct.
  {
    const { t } = await at(browser, '2026-10-29T09:00:00Z', [['MON', '2026-11-02', true], ['MON2', '2026-11-02', false], ['TUE', '2026-11-03', true]]);
    const [mon, mon2, tue] = await info(t.page, ['MON', 'MON2', 'TUE']);
    rec('L1 Thu: a Tuesday-delivery list (cut Mon) is NOT locked yet (2 working days away)', tue.locked === false, JSON.stringify(tue));
    rec('L2 Thu: a Monday-delivery list is cut by the saw TOMORROW (Fri) → it should be locked today (cut day = next working day)', mon.locked === true, JSON.stringify(mon));
    rec('W1 Thu: Monday-delivery job with no list — "list due by" should be Thu 29 Oct (the working day before the saw cuts on Fri)', !!mon2.strip && /list due by 29 Oct 26/.test(mon2.strip), JSON.stringify(mon2));
    await t.close();
  }
  // Friday 23 Oct 2026, Monday 26 Oct is a bank holiday. WO-TUE delivers Tue 27 → cut-by Mon 26 (holiday) → the saw cuts it TODAY.
  {
    const { t } = await at(browser, '2026-10-23T09:00:00Z', [['TUE', '2026-10-27', true], ['TUE2', '2026-10-27', false], ['WED', '2026-10-28', true], ['THU', '2026-10-29', true]]);
    const [tue, tue2, wed, thu] = await info(t.page, ['TUE', 'TUE2', 'WED', 'THU']);
    rec('B1 Fri before bank-holiday Mon: Tuesday-delivery list is on today\'s saw queue and locked', tue.sawCutsToday && tue.onSawToday && tue.locked === true, JSON.stringify(tue));
    rec('B2 Fri: Wednesday-delivery list (cut Tue, the next working day) is locked', wed.locked === true, JSON.stringify(wed));
    rec('B3 Fri: Thursday-delivery list (cut Wed) is not locked', thu.locked === false, JSON.stringify(thu));
    rec('B4 Fri: Tuesday-delivery job with no list must be cut TODAY → strip should show it OVERDUE (list was due Thu 22 Oct)', !!tue2.strip && tue2.late === true && /OVERDUE/.test(tue2.strip), JSON.stringify(tue2));
    await t.close();
  }
  // Christmas: Thursday 24 Dec 2026; 25 + 28 Dec are bank holidays. Delivery Tue 29 Dec → cut-by Mon 28 (holiday) → cut on 24 Dec.
  {
    const { t } = await at(browser, '2026-12-23T09:00:00Z', [['XM', '2026-12-29', false], ['XL', '2026-12-29', true]]);
    const [xm, xl] = await info(t.page, ['XM', 'XL']);
    rec('C1 Wed 23 Dec: the 29 Dec job (no list) is cut tomorrow 24 Dec → it must be on the strip today, list due by 23 Dec (5-day lead is counted in calendar days over Christmas)', !!xm.strip && /list due by 23 Dec 26/.test(xm.strip), JSON.stringify(xm));
    rec('C2 Wed 23 Dec: a 29 Dec list is cut tomorrow → locked today', xl.locked === true, JSON.stringify(xl));
    await t.close();
  }
  // Year end: Thu 31 Dec 2026 → next working day Mon 4 Jan 2027 (1 Jan holiday). Delivery Tue 5 Jan → cut Mon 4 Jan.
  {
    const { t } = await at(browser, '2026-12-31T09:00:00Z', [['NY', '2027-01-05', true], ['NY2', '2027-01-05', false]]);
    const [ny, ny2] = await info(t.page, ['NY', 'NY2']);
    rec('Y1 Thu 31 Dec: a 5 Jan 2027 list (cut Mon 4 Jan = next working day) is locked across the year end', ny.locked === true, JSON.stringify(ny));
    rec('Y2 Thu 31 Dec: 5 Jan job with no list — list due by Thu 31 Dec', !!ny2.strip && /list due by 31 Dec 26/.test(ny2.strip), JSON.stringify(ny2));
    await t.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
