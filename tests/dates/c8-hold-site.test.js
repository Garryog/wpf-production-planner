// Dates & deliveries phase 2, steps 20–21.
// A9 "⏳ moved out — don't cut early": a not-cut job moved out > 14 days gets it (not a cut job, not a short move); it shows
// on the saw card banner, the board chip and Lists to issue; "Move the build week" / "OK to cut" (logged); a move back
// within range clears it; group moves apply the same.
// A10 site ready: booked card within 5 working days → "⚠ site not confirmed"; tap confirms (who/when logged, for that date);
// the booking moves → "confirm again"; PM view per customer "Site ready for all"; saw / floor can't confirm.
// Clock Tue 10 Nov 2026. Stubbed Supabase only.  Run: node tests/dates/c8-hold-site.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo }, x));
  const row = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-1'), O('WO-2', { step: '6. JOB CUT COMPLETE' }), O('WO-3'), O('WO-4'), O('WO-5'), O('WO-6'),
    O('WO-S1', { delv: true, step: '8. PALLETED', delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09', customer: 'GLEN' }),   // Thu 12 Nov: 2 working days
    O('WO-S2', { delv: true, step: '8. PALLETED', delVeh: 'VOLVO', delDay: 'Fri', delWk: '2026-11-09', customer: 'GLEN' }),
    O('WO-S3', { delv: true, step: '8. PALLETED', delVeh: 'VOLVO', delDay: 'Fri', delWk: '2026-11-30', customer: 'GLEN' }),   // far off: nothing yet
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const A = await t.page.evaluate(async () => {
    const g = w => DB.orders.find(o => o.wo === w), out = {};
    const r1 = moveDates(['WO-1'], { due: '2026-12-11' }, { why: 'Customer delay' }, 'Ann'); out.flag = r1.rows[0].flags; r1.apply();
    out.h1 = g('WO-1').dueHold;
    moveDates(['WO-2'], { due: '2026-12-11' }, { why: 'Customer delay' }, 'Ann').apply(); out.h2 = g('WO-2').dueHold;   // cut
    moveDates(['WO-3'], { due: '2026-11-27' }, { why: 'Customer delay' }, 'Ann').apply(); out.h3 = g('WO-3').dueHold;   // 7 days
    moveDates(['WO-4', 'WO-5'], { shift: { n: 3, unit: 'wk' } }, { why: 'Materials' }, 'Ann', { src: 'group' }).apply(); out.hg = [g('WO-4').dueHold, g('WO-5').dueHold].map(Boolean);
    out.on = dueHoldOn(g('WO-1'));
    out.banner = movedBanner(g('WO-1'));
    showTab('b'); await new Promise(r => setTimeout(r, 200));
    out.chip = (document.querySelector('[data-dhold="WO-1"]') || {}).textContent || '';
    document.querySelector('[data-dhold="WO-1"]').click(); await new Promise(r => setTimeout(r, 80));
    out.dlg = (document.getElementById('dhold-dlg') || {}).innerText || '';
    document.getElementById('dh-ok').click(); await new Promise(r => setTimeout(r, 80));
    out.off = { on: dueHoldOn(g('WO-1')), off: g('WO-1').dueHold && g('WO-1').dueHold.off, log: g('WO-1').log.slice(-1)[0].what, chip: !!document.querySelector('[data-dhold="WO-1"]') };
    // move the build week out from the chip (WO-4 kept its week by an import Take)
    g('WO-4').plannedWeek = '2026-11-16'; render(); await new Promise(r => setTimeout(r, 120));
    document.querySelector('[data-dhold="WO-4"]').click(); await new Promise(r => setTimeout(r, 80));
    const wk = document.getElementById('dh-wk'); out.wkBtn = wk ? wk.textContent : ''; if (wk) wk.click(); await new Promise(r => setTimeout(r, 80));
    out.wk4 = g('WO-4').plannedWeek;
    // moved back within range → cleared; due date coming within range → off
    moveDates(['WO-5'], { due: '2026-11-24' }, { why: 'Customer delay' }, 'Ann').apply(); out.back = g('WO-5').dueHold;
    out.cutOff = (() => { const o = g('WO-4'); o.step = '6. JOB CUT COMPLETE'; return dueHoldOn(o); })();
    // saw screen banner
    ROLE = 'saw'; ls.set('wpfPin_saw', '9000'); g('WO-6').dueHold = { at: nowISO(), by: 'Ann', days: 21, from: '2026-11-20', to: '2026-12-11' }; g('WO-6').dueDate = '2026-12-11';
    out.sawFn = movedBanners(['WO-6']);
    ROLE = 'office'; render();
    return out;
  });
  rec('moved out 21 days, not cut: preview flag + dueHold', A.flag.includes('moved-out') && A.h1 && A.h1.days === 21 && A.h1.by === 'Ann' && A.on, JSON.stringify([A.flag, A.h1]));
  rec('a cut job and a 7-day move get no "don\'t cut early"', !A.h2 && !A.h3, JSON.stringify([A.h2, A.h3]));
  rec('group move +3 weeks applies the same', A.hg.join() === 'true,true', A.hg.join());
  rec('saw / stores banner and board chip show it', /MOVED OUT — DON'T CUT EARLY/.test(A.banner) && /don't cut early/.test(A.chip) && /DON'T CUT EARLY/.test(A.sawFn), A.chip);
  rec('"OK to cut" removes it, logged with the name', !A.off.on && A.off.off && A.off.off.by === 'Tester' && /OK to cut/.test(A.off.log) && !A.off.chip, JSON.stringify(A.off));
  rec('"Move the build week" moves it to the due week', /Move the build week to Wk 50/.test(A.wkBtn) && A.wk4 === '2026-12-07', A.wkBtn + ' → ' + A.wk4);
  rec('moved back within range clears it; cutting the job turns it off', A.back === undefined && A.cutOff === false, JSON.stringify([A.back, A.cutOff]));

  // ---- A10 site ready
  const S = await t.page.evaluate(async () => {
    const g = w => DB.orders.find(o => o.wo === w), out = {};
    showTab('d'); await new Promise(r => setTimeout(r, 150));
    const chipT = w => { const c = document.querySelector('.dchip[data-dw="' + w + '"]'); const b = c && (c.querySelector('[data-siteok]') || c.querySelector('.rdy-tag:last-of-type')); return c ? (c.querySelector('[data-siteok]') || {}).textContent || '' : 'none'; };
    out.c1 = chipT('WO-S1'); out.c2 = chipT('WO-S2');
    document.querySelector('[data-siteok="WO-S1"]').click(); await new Promise(r => setTimeout(r, 150));
    out.ok = JSON.parse(JSON.stringify(g('WO-S1').siteOk)); out.log = g('WO-S1').log.slice(-1)[0];
    out.c1b = (document.querySelector('.dchip[data-dw="WO-S1"]') || {}).textContent || '';
    // the booking moves → confirm again
    placeJobs([g('WO-S1')], 'VOLVO', 'Fri', '2026-11-09'); await new Promise(r => setTimeout(r, 100));
    const why = document.querySelector('.pod-ovl [data-why="Customer request"]'); if (why) why.click(); await new Promise(r => setTimeout(r, 100)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    out.again = chipT('WO-S1');
    document.querySelector('[data-deltab="3"]').click(); await new Promise(r => setTimeout(r, 100)); out.far = chipT('WO-S3');
    // PM: per customer
    ROLE = 'pm'; ls.set('wpfPin_pm', '9000'); render(); await new Promise(r => setTimeout(r, 100));
    const b = document.querySelector('[data-sitecust="GLEN"]'); out.pmBtn = b ? b.textContent : '';
    if (b) b.click(); await new Promise(r => setTimeout(r, 150));
    out.all = ['WO-S1', 'WO-S2', 'WO-S3'].map(w => g(w).siteOk ? g(w).siteOk.for : '');
    out.pmAfter = !!document.querySelector('[data-sitecust="GLEN"]');
    // saw can't confirm
    ROLE = 'saw'; ls.set('wpfPin_saw', '9000'); delete g('WO-S2').siteOk; const before = window.__alerts.length; siteOkDo(['WO-S2']); out.sawOk = !!g('WO-S2').siteOk;
    ROLE = 'office'; render();
    await new Promise(r => setTimeout(r, 1700));
    return out;
  });
  rec('booked within 5 working days → "⚠ site not confirmed"; far-off booking shows nothing', /site not confirmed/.test(S.c1) && /site not confirmed/.test(S.c2) && S.far === '', JSON.stringify([S.c1, S.c2, S.far]));
  rec('tap confirms: who / when / for which date, logged; card shows "✓ site ready — name"', S.ok.by === 'Tester' && S.ok.for === '2026-11-12' && !!S.ok.at && /Site ready confirmed for 12 Nov/.test(S.log.what) && /site ready — Tester/.test(S.c1b), JSON.stringify([S.ok, S.log.what]));
  rec('the booking moves → "site confirmed for 12 Nov — confirm again"', /confirmed for 12 Nov — confirm again/.test(S.again), S.again);
  rec('PM view: "Site ready for all" per customer confirms every booking (each for its own date)', /Site ready for all 3/.test(S.pmBtn) && S.all.join() === '2026-11-13,2026-11-13,2026-12-04' && !S.pmAfter, JSON.stringify([S.pmBtn, S.all]));
  rec('saw can\'t confirm a site', !S.sawOk, '');
  const sv = (t.server.row.orders || []).find(o => o.wo === 'WO-S3');
  rec('siteOk saved inside the job', sv && sv.siteOk && sv.siteOk.by === 'Tester', JSON.stringify(sv && sv.siteOk));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
