// cf26b — the independent review of the coded work order fold (27 Nov 2026). Fake Supabase only.
// H1 the coded job's own week / due / hours / step / value are not taken, but the import screen and the job history SAY so.
// H2 an out-of-date screen that saves a folded coded job does not bring it back (never two jobs for one unit).
// M1 a coded line further on does not tag the main job for delivery.  Plus matching gaps: WO-E folds, near-miss numbers do not.
// Run: node tests/stage2/cf26b-fold-review.test.js
const L = require('../list-window/lw.js'); const { X, H, sleep, asks, liveFor } = L;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 420) : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference'];
const row = (wo, title, step, val, due) => [wo, title, 'Kildare Homes', due || '2026-12-10', step, val == null ? 3945 : val, ''];
const ord = (wo, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor: 'T09', unit: '77', title: 'PART 5 NO 77', dueDate: '2026-12-10', origDueDate: '2026-12-10', step: '5. WORK ORDER PROCESSED', value: 3945 }, x || {}));
const apply = async p => { await p.evaluate(() => { window.CODEFOLD_RUN0 = CODEFOLD_RUN; document.getElementById('imp-apply').click(); }); for (let i = 0; i < 80; i++) { const d = await p.evaluate(() => !IMPPLAN && CODEFOLD_RUN && CODEFOLD_RUN !== window.CODEFOLD_RUN0); if (d) break; await sleep(100); } return p.evaluate(async () => { try { return await CODEFOLD_RUN; } catch (e) { return String(e); } }); };
const jobs = p => p.evaluate(() => DB.orders.map(o => o.wo).sort().join());
const get = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o ? JSON.parse(JSON.stringify(o)) : null; }, wo);
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- H1 + M1: the coded job is on the board with its own week / due / hours / step, and is tagged for delivery
    const r1 = X.v2Row(); r1.orders = [
      ord('WO-5000-1', { unit: '50', step: '4. READY FOR PRODUCTION', plannedWeek: '2026-12-07', hours: 7, hoursEstimated: true }),
      ord('WO-BI-5000-1', { unit: '50', step: '7. ASSEMBLY COMPLETE', delv: true, plannedWeek: '2026-12-21', dueDate: '2026-12-23', delivDate: '2026-12-24', hours: 6, hoursSrc: 'hand', value: 777 })];
    const S1 = X.makeServer(r1); const t1 = await X.dev(browser, S1, 'office'), p = t1.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); sessionStorage.setItem('wpfWho', 'Ann'); });
    await H.importAoa(p, [HDR, row('WO-5000-1', 'NO 50', '4. READY FOR PRODUCTION'), row('WO-BI-5000-1', 'NO 50 BI', '7. ASSEMBLY COMPLETE', 777, '2026-12-23')]);
    const out = await apply(p); await sleep(800);
    const o = await get(p, 'WO-5000-1'), f = (Array.isArray(out) ? out : []).find(x => x.p === 'WO-BI-5000-1') || {};
    const note = (f.notes || []).join(' · ');
    rec('H1 folded: one job, the main job keeps its own week, due date, hours, step and value', !!o && f.ok && o.plannedWeek === '2026-12-07' && o.dueDate === '2026-12-10' && +o.hours === 7 && /^4\./.test(o.step) && o.value === 3945 && !/WO-BI-5000-1/.test(await jobs(p)), JSON.stringify(o && [o.plannedWeek, o.dueDate, o.hours, o.step, o.value]));
    rec('H1 the fold result NAMES what the coded job had and was not taken (week, due, delivery, hours, step, value)', /NOT taken/.test(note) && /week /.test(note) && /due /.test(note) && /delivery /.test(note) && /6 h typed by hand/.test(note) && /step /.test(note) && /€777/.test(note), note);
    rec('H1 …and the same words are in the main job\'s history', (o.log || []).some(x => /WO-BI-5000-1/.test(x.what) && /NOT taken/.test(x.what)), JSON.stringify((o.log || []).map(x => x.what)).slice(-300));
    const scr = await p.evaluate(() => (document.getElementById('imp-cfres') || {}).innerText || '');
    rec('H1 …and on the import screen', /NOT taken/.test(scr), scr);
    rec('M1 the main job (step 4) is NOT tagged for delivery because the coded line was further on', !!o && !o.delv, JSON.stringify(o && o.delv));
    rec('the full copy of the coded job is kept on the main job', (o.pFrom || []).some(x => x.wo === 'WO-BI-5000-1' && x.code && x.job && x.job.plannedWeek === '2026-12-21' && +x.job.hours === 6), JSON.stringify((o.pFrom || []).map(x => x.wo)));

    // ---------- H2: two PCs — B is out of date and saves the folded coded job
    const r2 = X.v2Row(); r2.orders = [ord('WO-6000-1', { unit: '60' }), ord('WO-BI-6000-1', { unit: '60', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-12-07' })];
    const S2 = X.makeServer(r2); X.F3.seedList(S2, 'LB1', { wos: ['WO-BI-6000-1'], name: 'Bought-in 60' });
    const a = (await X.dev(browser, S2, 'office')).page; await asks(a);
    const b = (await X.dev(browser, S2, 'office')).page; await asks(b);
    for (const q of [a, b]) await q.evaluate(async () => { lsReset(); await lsLoad(); sessionStorage.setItem('wpfWho', 'Ann'); });
    await H.importAoa(a, [HDR, row('WO-6000-1', 'NO 60', '5. WORK ORDER PROCESSED'), row('WO-BI-6000-1', 'NO 60 BI', '5. WORK ORDER PROCESSED')]);
    await apply(a); await sleep(3000);
    rec('H2 set-up: PC A folded the coded job (saved: one job, booking and list on the main job)', S2.row.orders.map(x => x.wo).join() === 'WO-6000-1' && liveFor(S2, 'WO-6000-1').length === 1, S2.row.orders.map(x => x.wo).join());
    await b.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-BI-6000-1'); if (o) { o.delDay = 'Fri'; logEdit(o, 'day', 'Bob'); } await saveDB(); });
    await sleep(3000);
    const sv = S2.row.orders, m = sv.find(x => x.wo === 'WO-6000-1') || {};
    rec('H2 the out-of-date screen\'s save does NOT bring WO-BI-6000-1 back — still one job for the unit', sv.map(x => x.wo).join() === 'WO-6000-1', sv.map(x => x.wo + ' ' + [x.delVeh, x.delDay].join('/')).join(' | '));
    rec('H2 one van booking, the main job\'s (Volvo Thu) — not a second one on Fri', m.delVeh === 'VOLVO' && m.delDay === 'Thu', [m.delVeh, m.delDay].join('/'));
    rec('H2 the main job\'s history says the out-of-date change was NOT kept', (m.log || []).some(x => /out-of-date screen changed WO-BI-6000-1/.test(x.what) && /NOT kept/.test(x.what)), JSON.stringify((m.log || []).map(x => x.what)).slice(-300));
    rec('H2 PC B\'s own screen drops the coded job too', !/WO-BI-6000-1/.test(await jobs(b)), await jobs(b));

    // ---------- matching: WO-E folds; near-miss numbers and look-alike prefixes do not; lower case + trailing space folds
    const r3 = X.v2Row(); r3.orders = [ord('WO-7000-10', { unit: '10' }), ord('WO-7000-2', { unit: '2' })];
    const S3 = X.makeServer(r3); const c = (await X.dev(browser, S3, 'office')).page; await asks(c);
    await c.evaluate(async () => { lsReset(); await lsLoad(); sessionStorage.setItem('wpfWho', 'Ann'); });
    const r = await H.importAoa(c, [HDR, row('WO-E-7000-10', 'NO 10 EXTRA', '3. IN PRODUCTION', 50), row('WO-BI-7000-100', 'NO 100 BI', '3. IN PRODUCTION', 60), row('WO-EX-7000-2', 'NO 2 EX', '3. IN PRODUCTION', 70), row('wo-bi-7000-2 ', 'NO 2 BI', '3. IN PRODUCTION', 80)]);
    const fd = (r.plan.folds || []).filter(x => x.code).map(x => x.wo + '>' + x.base).sort().join(), nw = (r.plan.newOrders || []).map(x => x.wo).sort().join();
    rec('WO-E- folds into its main job on the board (a file with only the coded line)', /WO-E-7000-10>WO-7000-10/.test(fd), fd);
    rec('lower case with a trailing space folds', /WO-BI-7000-2>WO-7000-2/i.test(fd), fd);
    rec('WO-BI-7000-100 is NOT folded into WO-7000-10 (its own job)', /WO-BI-7000-100/.test(nw) && !/WO-BI-7000-100>/.test(fd), nw + ' | ' + fd);
    rec('WO-EX- is not a code (its own job)', /WO-EX-7000-2/.test(nw) && !/WO-EX-7000-2>/.test(fd), nw);
    await apply(c); await sleep(500);
    const sum = await c.evaluate(() => DB.orders.reduce((s, o) => s + (+o.value || 0), 0));
    rec('value counted once: 2 main jobs + the two lines that are their own jobs', sum === 3945 * 2 + 60 + 70, sum);
  } catch (e) { rec('test ran without an error', false, e && e.stack || e); }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
  process.exit(res.some(x => !x) ? 1 : 0);
})();
