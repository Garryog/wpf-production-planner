// Tester attack ROUND 4 (16 Nov) on Garry's "Delivery (Production Manager)" in the list window: date + van + 🚚 Book
// (#me-deld, #me-delv, #me-delgo → placeJobs). Cancel at every question (name, "why is it moving?", bank holiday) must change
// NOTHING and the window must say so; Sunday / on hold / shipped / delivered / past dates / a job not in the planner; two PCs
// booking the same job at once; an OLD screen (origin/main) saving after the booking; the list window closed while the name
// prompt is up; booking then ✕ Close with rows not saved. Today in the fake = Wed 21 Oct 2026. Fake Supabase only.
// Run: node tests/list-window/attack4-delivery-book.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, asks, setv, fillSaw, rows } = L;
const PROC = '5. WORK ORDER PROCESSED';
const ord = (wo, floor, unit, title, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 80 && ((typeof SAVING !== 'undefined' && SAVING) || (typeof saveTimer !== 'undefined' && saveTimer)); i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(600); };
const flush = async p => { await p.evaluate(() => { try { sched(); } catch (e) {} }); await sleep(1700); await wait(p); };
const jobOf = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o ? { delv: !!o.delv, veh: o.delVeh || '', day: o.delDay || '', wk: o.delDay ? slotWk(o) : '', ovr: o.delvOverride || '', moves: (o.delMoves || []).length, why: ((o.delMoves || []).slice(-1)[0] || {}).why || '', log: (o.log || []).map(x => x.what).slice(-3) } : null; }, wo);
const rowJob = (S, wo) => { const o = S.row.orders.find(x => x.wo === wo); return o ? { delv: !!o.delv, veh: o.delVeh || '', day: o.delDay || '', wk: o.delWk || '' } : null; };
const win = p => p.evaluate(() => { const g = id => document.getElementById(id); const tops = [...document.querySelectorAll('.pod-ovl')];
  return { open: !!document.querySelector('.me-ed'), bk: !!g('me-delbk'), ro: (g('me-delro') || {}).textContent || '', msg: (g('me-delmsg') || {}).textContent || '', d: (g('me-deld') || {}).value || '', v: (g('me-delv') || {}).value || '',
    top: tops.length ? (tops[tops.length - 1].querySelector('.me-ed') ? 'list' : tops[tops.length - 1].innerText.slice(0, 90)) : 'none', n: tops.length, asked: (window.__asked || []).slice() }; });
const book = async (p, date, van) => { await p.evaluate(({ date, van }) => { const d = document.getElementById('me-deld'), v = document.getElementById('me-delv'); if (d) { d.value = date; d.dispatchEvent(new Event('change')); } if (v) { v.value = van; v.dispatchEvent(new Event('change')); } document.getElementById('me-delgo').click(); }, { date, van }); await sleep(500); };
const topCancel = p => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (!o || o.querySelector('.me-ed')) return 'no little window'; const x = o.querySelector('#pod-x'); if (!x) return 'no cancel'; x.click(); return 'ok'; });
const topReason = (p, why) => p.evaluate(why => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && [...o.querySelectorAll('[data-why]')].find(b => !why || b.dataset.why === why) ; if (!b) return 'no reason buttons'; b.click(); return b.dataset.why; }, why);
const topName = (p, n) => p.evaluate(n => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const i = o && o.querySelector('#pick-other'); if (!i) return 'no name box'; i.value = n; o.querySelector('#pick-ok').click(); return 'ok'; }, n);
const openOn = async (p, wo, id) => { await closeAll(p); await p.evaluate(({ wo, id }) => { window.__asked = []; window.__confirm = true; openListEditor(id || null, wo); }, { wo, id }); await sleep(1000); };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(
      ord('WO-BK', '20', '1', 'HOUSE 1', { delv: true, delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-10-26', delPlacedAt: '2026-10-20T09:00:00Z', delPlacedBy: 'Seed' }),
      ord('WO-BK2', '20', '2', 'HOUSE 2', { delv: true, delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-10-26', delPlacedAt: '2026-10-20T09:00:00Z', delPlacedBy: 'Seed' }),
      ord('WO-HOLD', '20', '3', 'HOUSE 3', { cienHold: true }),
      ord('P-2001', '20', '4', 'HOUSE 4', { step: 'Planner WO' }),
      ord('WO-DONE', '20', '5', 'HOUSE 5', { delv: true, delVeh: 'ARTIC', delDay: 'Mon', delWk: '2026-10-19', delDone: true, delDelivAt: '2026-10-19T15:00:00Z' }),
      ord('WO-NAME', '20', '6', 'HOUSE 6'), ord('WO-BH', '20', '7', 'HOUSE 7'), ord('WO-2PC', '20', '8', 'HOUSE 8'), ord('WO-OLD', '20', '9', 'HOUSE 9'), ord('WO-PAST', '20', '10', 'HOUSE 10'), ord('WO-ROWS', '20', '11', 'HOUSE 11'));
    r.orders.push(ord('WO-KIT', '21', '1', 'HOUSE 21 KITCHEN'), ord('WO-UTL', '21', '1', 'HOUSE 21 UTILITY'));
    const S = X.makeServer(r);
    X.F3.seedList(S, 'LGONE', { wos: ['WO-GONE'], name: 'Gone job list' });
    X.F3.seedList(S, 'L2WO', { wos: ['WO-KIT', 'WO-UTL'], name: 'House 21 kitchen + utility' });
    const t = await X.dev(browser, S, 'prod'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });

    // ---------- 1. the name is asked, Cancel ----------
    await p.evaluate(() => { try { sessionStorage.removeItem('wpfWho'); } catch (e) {} });
    await openOn(p, 'WO-NAME'); await book(p, '2026-10-27', 'VOLVO');
    let w = await win(p);
    rec('N1 set-up: no name on this screen → "Who is making changes on this computer?" over the list window', /Who is making changes/.test(w.top), JSON.stringify(w));
    await topCancel(p); await sleep(1200); w = await win(p); let j = await jobOf(p, 'WO-NAME');
    rec('[MEDIUM] N1 Cancel the name → NOTHING changed: WO-NAME is not ticked for delivery (not put on the Deliveries page) and not booked', j.delv === false && !j.day && !j.ovr, JSON.stringify(j));
    rec('[MEDIUM] N1 …and the window says it was NOT booked (not stuck on "Booking…")', w.open && !/Booking…/.test(w.msg) && /not booked|cancel/i.test(w.msg), JSON.stringify([w.msg, w.top]));
    await flush(p);
    rec('N1 …and nothing reached the database for WO-NAME after the next save', (rowJob(S, 'WO-NAME') || {}).delv !== true, JSON.stringify(rowJob(S, 'WO-NAME')));
    // Esc while the name prompt is up: closes ONLY the name prompt, the list window stays
    await book(p, '2026-10-27', 'VOLVO'); w = await win(p);
    const x0 = await p.evaluate(() => { const e = document.getElementById('me-x0'); if (!e) return 'no ✕'; const b = e.getBoundingClientRect(), h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return h === e || e.contains(h) ? 'reachable' : 'covered'; });
    rec('(info) N2 while the name prompt is up, the list window\'s ✕ Close is ' + x0, true);
    await p.keyboard.press('Escape'); await sleep(800); w = await win(p); j = await jobOf(p, 'WO-NAME');
    rec('N2 Esc with the name prompt up → the name prompt goes, the LIST window stays open, nothing booked', w.open && w.top === 'list' && !j.day, JSON.stringify([w.open, w.top, j]));
    // close the list window first (programmatically, as if Esc had reached it), then give the name
    await book(p, '2026-10-27', 'VOLVO');
    await p.evaluate(() => { const l = [...document.querySelectorAll('.pod-ovl')].find(o => o.querySelector('.me-ed')); if (l) l.remove(); }); await sleep(200);
    await topName(p, 'Garry'); await sleep(1500); j = await jobOf(p, 'WO-NAME');
    const ovl = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].map(o => o.innerText.slice(0, 60)));
    rec('N3 list window gone while the name prompt was up, then the name given → booked as asked (Volvo Tue 27 Oct) with no error', j.veh === 'VOLVO' && j.day === 'Tue' && j.wk === '2026-10-26' && !(S.errors || []).length, JSON.stringify([j, S.errors]));
    rec('(info) N3 …what is on screen afterwards', true, JSON.stringify(ovl));
    await closeAll(p);

    // ---------- 2. a job already on a van: "why is it moving?" → Cancel ----------
    await openOn(p, 'WO-BK'); w = await win(p);
    rec('M0 set-up: WO-BK shows "Booked: Volvo Tue …" with the date and van filled in', /Booked: Volvo Tue/.test(w.msg) && w.d === '2026-10-27' && w.v === 'VOLVO', JSON.stringify(w));
    await book(p, '2026-10-28', 'ARTIC'); w = await win(p);
    rec('M1 moving it to the Artic Wed 28 Oct asks why', /Why is WO-BK moving/.test(w.top), w.top);
    await topCancel(p); await sleep(1200); w = await win(p); j = await jobOf(p, 'WO-BK');
    rec('M1 Cancel the reason → nothing changed: still Volvo Tue 26-Oct week, no move recorded', j.veh === 'VOLVO' && j.day === 'Tue' && j.wk === '2026-10-26' && j.moves === 0, JSON.stringify(j));
    rec('[MEDIUM] M1 …and the window SAYS nothing changed (not "Booking…"; date and van back to Volvo Tue 27 Oct)', !/Booking…/.test(w.msg) && /Booked: Volvo Tue/.test(w.msg) && w.v === 'VOLVO' && w.d === '2026-10-27', JSON.stringify([w.msg, w.d, w.v]));
    await book(p, '2026-10-28', 'ARTIC'); const why = await topReason(p); await sleep(1500); j = await jobOf(p, 'WO-BK'); w = await win(p);
    rec('M2 with a reason → moved to Artic Wed, the move and its reason recorded', j.veh === 'ARTIC' && j.day === 'Wed' && j.moves === 1 && j.why === why, JSON.stringify([why, j]));
    rec('M2 …the window says "Booked: Artic Wed …"', /Booked: Artic Wed/.test(w.msg), JSON.stringify([w.msg, w.top]));
    rec('(info, simplicity) M2 after booking, a "Cutting & fittings check — NO LIST ISSUED" box pops up over the list the Production Manager is typing', true, JSON.stringify([w.n, w.top]));
    await closeAll(p);

    // ---------- 3. bank holiday, Sunday, on hold, shipped, delivered, past, a job not in the planner ----------
    await openOn(p, 'WO-BH'); await p.evaluate(() => { window.__confirm = false; });
    await book(p, '2026-10-26', 'VOLVO'); await sleep(800); w = await win(p); j = await jobOf(p, 'WO-BH');
    rec('B1 Mon 26 Oct (bank holiday) → asked "is a bank holiday — book anyway?"', w.asked.some(a => /bank holiday/.test(a)), JSON.stringify(w.asked));
    rec('[MEDIUM] B1 …Cancel → WO-BH NOT ticked for delivery and not booked', j.delv === false && !j.day, JSON.stringify(j));
    rec('[MEDIUM] B1 …and the window says it was not booked (not "Booking…")', !/Booking…/.test(w.msg), w.msg);
    await p.evaluate(() => { window.__confirm = true; }); await book(p, '2026-10-26', 'VOLVO'); await sleep(1500); j = await jobOf(p, 'WO-BH');
    rec('B2 …OK → booked Volvo Mon 26 Oct', j.veh === 'VOLVO' && j.day === 'Mon' && j.wk === '2026-10-26', JSON.stringify(j));
    await closeAll(p);
    await openOn(p, 'WO-HOLD'); w = await win(p);
    if (w.bk) { await book(p, '2026-10-27', 'VOLVO'); await sleep(800); w = await win(p); }
    j = await jobOf(p, 'WO-HOLD');
    rec('H1 an ON HOLD job: refused in words (or no Book at all), not ticked for delivery', (!w.bk || /on hold/i.test(w.msg)) && j.delv === false && !j.day, JSON.stringify([w.bk, w.msg, j]));
    await closeAll(p);
    await openOn(p, 'P-2001'); w = await win(p);
    if (w.bk) { await book(p, '2026-10-29', 'IVECO'); await sleep(1500); }
    j = await jobOf(p, 'P-2001');
    rec('P1 a P-number job can be booked like any job (Iveco Thu 29 Oct)', w.bk && j.veh === 'IVECO' && j.day === 'Thu', JSON.stringify([w.bk, j]));
    await closeAll(p);
    await openOn(p, 'WO-5'); w = await win(p); // WO-5 shipped 20 Oct (Cienapps)
    let shipTxt = 'no Book offered';
    if (w.bk) { await book(p, '2026-10-30', 'CRAFTER'); await sleep(1500); w = await win(p); shipTxt = w.msg; }
    j = await jobOf(p, 'WO-5');
    rec('[LOW, ask Garry] S1 a job Cienapps says is SHIPPED (WO-5, 20 Oct) is not put back on a van from the list window without a word', !j.day || /shipped/i.test(shipTxt + w.asked.join(' ')), JSON.stringify([w.bk, shipTxt, j]));
    await closeAll(p);
    await openOn(p, 'WO-DONE'); w = await win(p); let doneTxt = 'no Book offered';
    if (w.bk) { await book(p, '2026-10-30', 'CRAFTER'); await sleep(800); const tp = (await win(p)).top; if (/Why is/.test(tp)) await topReason(p); await sleep(800); w = await win(p); doneTxt = w.msg + ' | ' + tp; }
    j = await jobOf(p, 'WO-DONE'); const dd = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-DONE'); return [!!o.delDone, o.delDelivAt]; });
    rec('(info) D1 WO-DONE after that: still marked delivered = ' + dd[0] + ' (delivered at ' + dd[1] + ') but now on ' + j.veh + ' ' + j.day, true);
    rec('[MEDIUM] D1 a job already DELIVERED (Mon 19 Oct) is not re-booked from the list window (here: given a reason when asked "why is it moving?")', j.veh === 'ARTIC' && j.day === 'Mon', JSON.stringify([w.bk, doneTxt, j]));
    await closeAll(p);
    await openOn(p, 'WO-PAST'); await book(p, '2026-10-13', 'VOLVO'); await sleep(1200); w = await win(p); j = await jobOf(p, 'WO-PAST');
    rec('[LOW] D2 a date already gone (Tue 13 Oct, last week) is refused or asked about — not booked silently into the past (it would show at once as a "missed delivery")', !j.day || w.asked.some(a => /past|gone|already/i.test(a)) || /past|gone/i.test(w.msg), JSON.stringify([j, w.msg, w.asked]));
    await closeAll(p);
    await openOn(p, '', 'LGONE'); w = await win(p);
    rec('G1 a list whose WO is not in the planner (WO-GONE) opens with no delivery box and no error', w.open && !w.bk && !w.ro && !(S.errors || []).length, JSON.stringify([w, S.errors]));
    await closeAll(p);

    // a list for TWO work orders (kitchen + utility on one list)
    await openOn(p, '', 'L2WO'); w = await win(p);
    if (w.bk) { await book(p, '2026-10-29', 'SMART'); await sleep(1500); }
    const jk = (await jobOf(p, 'WO-KIT')) || {}, ju = (await jobOf(p, 'WO-UTL')) || {}; w = await win(p);
    rec('[LOW] K1 a list on TWO work orders (kitchen WO-KIT + utility WO-UTL): 🚚 Book books both — or the window says which ONE it booked', (jk.day && ju.day) || (/WO-KIT/.test(w.msg + ' ' + (await p.evaluate(() => (document.getElementById('me-delbk') || {}).innerText || ''))) && !!jk.day), JSON.stringify([jk.veh + ' ' + jk.day, ju.veh + ' ' + ju.day, w.msg]));
    await closeAll(p);

    // ---------- 4. booking, then ✕ Close ----------
    await openOn(p, 'WO-ROWS'); const i0 = (await rows(p)).findIndex(x => !x.hdr);
    await fillSaw(p, i0, 'Base side', '2', '720', '560', 'MFC White'); await sleep(150);
    await book(p, '2026-10-29', 'RENAULT'); await sleep(1500); await closeAll(p).catch(() => {}); // (closeAll would drop the list too — re-open instead)
    await openOn(p, 'WO-ROWS'); await fillSaw(p, i0, 'Base side', '2', '720', '560', 'MFC White'); await sleep(150);
    await book(p, '2026-10-30', 'RENAULT'); await sleep(800);
    if (/Why is/.test((await win(p)).top)) { await topReason(p); await sleep(1500); }
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (o && !o.querySelector('.me-ed')) { const x = o.querySelector('#pod-x'); if (x) x.click(); } }); await sleep(300);
    const kept = (await rows(p)).some(x => x.item === 'Base side');
    rec('R1 rows typed, then 🚚 Book → the typed rows are still on screen after the booking', kept, JSON.stringify(await rows(p)));
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(400); w = await win(p);
    rec('R2 …✕ Close → asks "Close without saving?" ONCE, about the list (Cancel keeps the window)', w.open && w.asked.length === 1 && /Close without saving/.test(w.asked[0]), JSON.stringify(w.asked));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
    await openOn(p, 'WO-ROWS'); await book(p, '2026-10-31', 'RENAULT'); await sleep(800); if (/Why is/.test((await win(p)).top)) { await topReason(p); await sleep(1500); }
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (o && !o.querySelector('.me-ed')) { const x = o.querySelector('#pod-x'); if (x) x.click(); } }); await sleep(300);
    await p.evaluate(() => { window.__asked = []; document.getElementById('me-x0').click(); }); await sleep(400); w = await win(p);
    rec('R3 nothing typed, only a booking made → ✕ Close closes without asking (the booking is already saved on its own)', !w.open && !w.asked.length, JSON.stringify([w.open, w.asked]));
    j = await jobOf(p, 'WO-ROWS');
    rec('R3 …and the booking stands (Renault Sat 31 Oct)', j.veh === 'RENAULT' && j.day === 'Sat', JSON.stringify(j));
    await flush(p);
    rec('R4 the bookings reach the database (WO-ROWS Renault Sat, WO-BK Artic Wed, WO-NAME Volvo Tue)', (rowJob(S, 'WO-ROWS') || {}).day === 'Sat' && (rowJob(S, 'WO-BK') || {}).veh === 'ARTIC' && (rowJob(S, 'WO-NAME') || {}).veh === 'VOLVO', JSON.stringify([rowJob(S, 'WO-ROWS'), rowJob(S, 'WO-BK'), rowJob(S, 'WO-NAME')]));

    // ---------- 5. two PCs book the same job at the same time ----------
    const t2 = await X.dev(browser, S, 'prod'), p2 = t2.page; await asks(p2);
    await p2.evaluate(async () => { lsReset(); await lsLoad(); });
    await openOn(p, 'WO-2PC'); await openOn(p2, 'WO-2PC');
    await Promise.all([book(p, '2026-10-27', 'VOLVO'), book(p2, '2026-10-28', 'ARTIC')]); await sleep(1500);
    await Promise.all([flush(p), flush(p2)]);
    await Promise.all([p.evaluate(() => loadDB()), p2.evaluate(() => loadDB())]); await sleep(1000);
    const a1 = await jobOf(p, 'WO-2PC'), b1 = await jobOf(p2, 'WO-2PC'), db1 = rowJob(S, 'WO-2PC');
    const whole = x => x && ((x.veh === 'VOLVO' && x.day === 'Tue' && x.wk === '2026-10-26') || (x.veh === 'ARTIC' && x.day === 'Wed' && x.wk === '2026-10-26'));
    rec('[HIGH] T1 both PCs book WO-2PC at once (Volvo Tue / Artic Wed) → the database holds ONE whole booking (never Volvo Wed or Artic Tue)', whole({ veh: db1.veh, day: db1.day, wk: db1.wk }), JSON.stringify(db1));
    rec('T1 …and both PCs show the same booking after their next refresh', a1.veh === b1.veh && a1.day === b1.day && a1.wk === b1.wk, JSON.stringify([a1, b1]));
    const df = S.row.orders.find(x => x.wo === 'WO-2PC') || {};
    rec('(info) T1 the "first booked" record (delFirst, used on the delivery archive / scorecard) matches the booking kept', String(df.delFirst || '') === [db1.veh, db1.day, db1.wk].join('|'), JSON.stringify([df.delFirst, df.delPlacedBy]));
    rec('(info) T1 the PC whose booking lost is not told (same as two people dragging on the Deliveries page)', true, JSON.stringify(db1));
    // already booked on both screens; one moves the VAN only, the other the DAY only
    await openOn(p, 'WO-BK2'); await openOn(p2, 'WO-BK2');
    await book(p, '2026-10-27', 'ARTIC'); await topReason(p); await book(p2, '2026-10-29', 'VOLVO'); await topReason(p2); await sleep(1500);
    await Promise.all([flush(p), flush(p2)]);
    await Promise.all([p.evaluate(() => loadDB()), p2.evaluate(() => loadDB())]); await sleep(1000);
    const db2 = rowJob(S, 'WO-BK2');
    rec('[MEDIUM] T2 WO-BK2 (Volvo Tue): PC A moves it to the ARTIC Tue, PC B at the same time to Volvo THU → ONE of the two bookings, never "Artic Thu" (a slot nobody picked)', !(db2.veh === 'ARTIC' && db2.day === 'Thu'), JSON.stringify(db2));
    await closeAll(p); await closeAll(p2);
    await t2.ctx.close().catch(() => {});

    // ---------- 6. an OLD screen (origin/main) open at the same time ----------
    const html = A.gitShow('origin/main') || A.gitShow('main');
    if (!html) rec('old code readable with git show origin/main', false);
    else {
      const old = await A.openOld(browser, S, html); await sleep(800);
      await openOn(p, 'WO-OLD'); await book(p, '2026-10-30', 'IVECO'); await sleep(1500); await flush(p);
      rec('O1 set-up: new screen booked WO-OLD (Iveco Fri 30 Oct) and saved', (rowJob(S, 'WO-OLD') || {}).veh === 'IVECO', JSON.stringify(rowJob(S, 'WO-OLD')));
      // the old screen (opened BEFORE the booking, not refreshed) changes another job and saves
      await old.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3'); if (o) { o.notes = 'old screen note'; } sched(); }); await sleep(2500); await wait(old.page);
      const dbO = rowJob(S, 'WO-OLD'), note = (S.row.orders.find(x => x.wo === 'WO-3') || {}).notes;
      rec('[HIGH] O1 the old screen saves after the booking → WO-OLD is still ticked for delivery and on the Iveco Fri 30 Oct', dbO && dbO.delv && dbO.veh === 'IVECO' && dbO.day === 'Fri' && dbO.wk === '2026-10-26', JSON.stringify([dbO, note]));
      await p.evaluate(() => loadDB()); await sleep(800);
      const jn = await jobOf(p, 'WO-OLD');
      rec('O1 …and the new screen still shows it booked after its next refresh', jn.veh === 'IVECO' && jn.day === 'Fri', JSON.stringify(jn));
      await old.close().catch(() => {});
    }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
