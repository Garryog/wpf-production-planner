// Tester attack ROUND 5 (17 Nov): a second look at the Coder's round-4 fixes (ab703d2, b384115, c55a9f0, a09f2c4) from angles the
// round-4 files didn't try: a SAVED list holding only headings (blankAll + st.hdr0), a × block in the blank layout, the Deliveries
// page's own booking (placeJobs is shared — no 5th arg there), the Deliveries page's ticked jobs while booking from the list window,
// booking the same slot again, a date months ahead, a job hidden from the Deliveries page. Today in the fake = Wed 21 Oct 2026.
// Fake Supabase only. Run: node tests/list-window/attack5-fixes.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, asks, setv, rows, linesOf } = L;
const PROC = '5. WORK ORDER PROCESSED';
const ord = (wo, unit, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor: '30', unit, title: 'HOUSE ' + unit, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Description', 'Qty', 'Length', 'Width', 'Material'], ['Shelf', 3, 560, 500, 'MFC White']]), 'House 22');
const BUF = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
const feed = async p => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } });
  await p.setInputFiles('#me-xlfile', { name: 'h22.xlsx', mimeType: 'application/octet-stream', buffer: BUF }); await sleep(1400); };
const job = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o ? { delv: !!o.delv, veh: o.delVeh || '', day: o.delDay || '', wk: o.delDay ? slotWk(o) : '', moves: (o.delMoves || []).length, log: (o.log || []).length } : null; }, wo);
const book = async (p, date, van) => { await p.evaluate(({ date, van }) => { const d = document.getElementById('me-deld'), v = document.getElementById('me-delv'); d.value = date; d.dispatchEvent(new Event('change')); v.value = van; v.dispatchEvent(new Event('change')); document.getElementById('me-delgo').click(); }, { date, van }); await sleep(700); };
const msg = p => p.evaluate(() => (document.getElementById('me-delmsg') || {}).textContent || '');
const openOn = async (p, wo) => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; window.__confirm = true; openListEditor(null, wo); }, wo); await sleep(1000); };
(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(ord('WO-D1', '1'), ord('WO-D2', '2', { delv: true }), ord('WO-D3', '3', { delv: true, delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-10-26' }), ord('WO-D4', '4'), ord('WO-D5', '5', { delv: true }));
    const S = X.makeServer(r);
    X.F3.seedList(S, 'HONLY', { wos: ['WO-6'], name: 'Headings only', lines: [['hdr', 'Kitchen', null, null, null, null, '', ''], ['hdr', 'Utility', null, null, null, null, '', '']] });
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' }, lines: [['hdr', 'Kitchen', null, null, null, null, '', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '', '']] });
    const t = await X.dev(browser, S, 'prod'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });

    // ---------- 1. a SAVED list that holds only headings ----------
    await closeAll(p); await p.evaluate(() => openListEditor('HONLY')); await sleep(1100);
    const n0 = (await rows(p)).length; await feed(p); const a = await rows(p);
    rec('[LOW] F1 a SAVED list holding only headings (Kitchen, Utility), then an Excel sheet → the saved headings are kept (a saved list is never replaced)', a.some(x => x.item === 'Kitchen') && a.some(x => x.item === 'Utility'), JSON.stringify([n0, a.map(x => x.item)]));
    await closeAll(p);

    // ---------- 2. the blank layout with a heading made × Multiply, nothing else typed ----------
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(1000);
    await p.evaluate(() => { window.__prompt = '4'; const e = document.querySelector('.me-ed [data-mhs="0"]'); e.value = 'mul'; e.dispatchEvent(new Event('change')); }); await sleep(400);
    const h0 = (await rows(p))[0];
    await feed(p); const b = await rows(p);
    rec('[MEDIUM] F2 blank layout, the first heading made × 4 (nothing else typed), then an Excel sheet → the × 4 heading is KEPT (a × counts as typed)', b.some(x => x.item === h0.item && x.units === '4'), JSON.stringify([h0, b.map(x => x.item + (x.units ? '×' + x.units : ''))]));
    await closeAll(p);

    // ---------- 3. the Deliveries page's own booking (no 5th argument) still behaves as before ----------
    await p.evaluate(() => { window.__asked = []; tab = 'deliv'; render(); }); await sleep(600);
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D2'); placeJobs([o], 'VOLVO', 'Thu', '2026-10-26'); }); await sleep(900);
    let j = await job(p, 'WO-D2');
    const ready = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return (o ? o.innerText : '') + ' | ' + [...document.querySelectorAll('.toast,#toast')].map(x => x.innerText).join(' '); });
    rec('F3 Deliveries page: placeJobs with no callback books WO-D2 Volvo Thu and still shows the readiness check / toast as before', j.veh === 'VOLVO' && j.day === 'Thu' && /ready|Cutting|scheduled/i.test(ready), JSON.stringify([j, ready.slice(0, 160)]));
    await closeAll(p);
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D2'); placeJobs([o], '', ''); }); await sleep(800);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && o.querySelector('[data-why]'); if (b) b.click(); }); await sleep(800);
    j = await job(p, 'WO-D2');
    rec('F3 Deliveries page: back to the pool (no day) still works, nothing thrown', !j.day && !j.veh, JSON.stringify([j, S.errors]));
    await closeAll(p);

    // ---------- 4. jobs ticked on the Deliveries page while the PM books from the list window ----------
    await p.evaluate(() => { delSel.clear(); delSel.add('WO-D5'); delSel.add('WO-D3'); });
    await openOn(p, 'WO-D1'); await book(p, '2026-10-29', 'VOLVO');
    j = await job(p, 'WO-D1'); const sel = await p.evaluate(() => [...delSel]);
    rec('F4 set-up: WO-D1 booked from the list window (Volvo Thu 29 Oct)', j.day === 'Thu' && j.veh === 'VOLVO', JSON.stringify([j, await msg(p)]));
    rec('[LOW] F4 …the two jobs the PM had ticked on the Deliveries page (WO-D5, WO-D3) are still ticked (booking one job from the list window doesn\'t clear them)', sel.length === 2, JSON.stringify(sel));

    // ---------- 5. the same slot again: nothing recorded, the window says so ----------
    const before = await job(p, 'WO-D1'); await book(p, '2026-10-29', 'VOLVO'); const after = await job(p, 'WO-D1'); const m5 = await msg(p);
    rec('F5 the same day + van booked again → no move recorded, no extra log line', after.moves === before.moves && after.log === before.log, JSON.stringify([before, after]));
    rec('(info) F5 …window says: ' + m5 + ' | toast: ' + (await L.toasts(p)).slice(0, 120), true);

    // ---------- 6. a date months ahead ----------
    await openOn(p, 'WO-D4'); await book(p, '2027-03-16', 'VOLVO');
    j = await job(p, 'WO-D4');
    rec('F6 a date months ahead (Tue 16 Mar 2027) → booked into THAT week (2027-03-15), not this week', j.day === 'Tue' && j.wk === '2027-03-15', JSON.stringify([j, await msg(p)]));

    // ---------- 7. a typed date that isn't a date ----------
    await openOn(p, 'WO-D5');
    await p.evaluate(() => { const d = document.getElementById('me-deld'); d.type = 'text'; }); await book(p, '29/10/2026', 'VOLVO');
    j = await job(p, 'WO-D5'); const m7 = await msg(p);
    rec('[LOW] F7 an odd date string (29/10/2026 — e.g. an old browser with no date picker) → refused in words, nothing booked', !j.day && /date|day/i.test(m7) && !/Invalid Date|Sunday/.test(m7), JSON.stringify([j, m7]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
