// Tester round 7 (18 Nov) — attack on "driver per van per day" (Garry 17 Nov, answer 5A; settings.vanDrv).
// Two PCs, the old screen (origin/main), removing the last driver, a driver deleted from Staff, odd names, failed saves,
// the driver's phone remembering yesterday's van, 60-day tidy, roles, phone 360 px. Fake Supabase only (tests/seq/fixs.js);
// the old screen is read with `git show origin/main:index.html` (read-only). Run: node tests/list-window/attack7-vandrv.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, sleep, rec, closeAll, asks } = L;
const THU = '2026-10-22', FRI = '2026-10-23';
const SEL = (v, d) => 'select[data-ddrv="' + v + '|' + d + '"]';
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 80 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(400); };
const srvDrv = S => JSON.stringify(((S.row.settings || {}).vanDrv) || {});
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    const r = X.v2Row();
    r.settings.staff = [{ id: 's1', n: 'Pat', r: ['driver'] }, { id: 's2', n: 'Mick', r: ['driver'] }, { id: 's3', n: "Seán O'Grady 🚚 <b>x</b>", r: ['driver'] }];
    const job = (wo, veh, day, x) => H.order(Object.assign({ wo, customer: 'K', unit: wo.slice(-1), title: 'HOUSE ' + wo, dueDate: FRI, origDueDate: FRI, delv: true, delVeh: veh, delDay: day, delWk: '2026-10-19' }, x || {}));
    r.orders.push(job('WO-V1', 'VOLVO', 'Thu'), job('WO-V2', 'VOLVO', 'Fri'), job('WO-V3', 'ARTIC', 'Fri'));
    S = X.makeServer(r);
    const a = await X.dev(browser, S, 'prod'), pa = a.page; await asks(pa);
    const b = await X.dev(browser, S, 'prod'), pb = b.page; await asks(pb);
    const deliv = async (p, role) => { await p.evaluate(rl => { ROLE = rl || 'prod'; prodTab = 'deliv'; tab = 'd'; render(); }, role); await sleep(400); };
    const reload = async p => { await p.evaluate(async () => { await loadDB(); render(); }); await sleep(500); };
    await deliv(pa); await deliv(pb);

    // ---------- R. removing the LAST driver while another PC is open ----------
    await pa.selectOption(SEL('VOLVO', THU), 'Pat'); await wait(pa); await sleep(1500);
    await reload(pb); await deliv(pb);
    rec('R0 set-up: PC A puts Pat on the Volvo Thu; PC B sees him', await pb.evaluate(() => vanDrv('VOLVO', '2026-10-22')) === 'Pat', srvDrv(S));
    await pa.selectOption(SEL('VOLVO', THU), ''); await wait(pa); await sleep(1500);
    rec('R1: PC A takes Pat off (the only driver set) → gone from the database', !/Pat/.test(srvDrv(S)), srvDrv(S));
    await reload(pb); await deliv(pb);
    const rb = await pb.evaluate(() => vanDrv('VOLVO', '2026-10-22'));
    rec('[MEDIUM if it fails] R2: PC B refreshes → Pat is gone on PC B too', rb === '', 'PC B still shows: ' + rb);
    await pb.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-V3'); o.notes = 'B note'; sched(); await saveDB(); }); await wait(pb); await sleep(1500);
    rec('[HIGH if it fails] R3: PC B then saves something else → Pat does NOT come back on the Volvo in the database', !/Pat/.test(srvDrv(S)), srvDrv(S));
    const c = await X.dev(browser, S, 'driver'), pc = c.page;
    await pc.evaluate(() => { ls.set('wpfDrvName', 'Pat'); ls.set('wpfDrvVeh', ''); ls.set('wpfDrvDay', 'Thu|2026-10-19'); ROLE = 'driver'; renderDriver(document.getElementById('app')); }); await sleep(400);
    const rc = await pc.evaluate(() => ({ veh: (document.getElementById('drv-veh') || {}).value, b: (document.getElementById('drv-asg') || {}).textContent || '' }));
    rec('[HIGH if it fails] R4: Pat\'s phone opened afterwards is NOT told "You\'re on the Volvo"', !/You're on/.test(rc.b) && rc.veh !== 'VOLVO', JSON.stringify(rc));
    await c.close();
    // R5: the same, but PC B ADDS a driver on another van while PC A (not refreshed) takes Pat off
    await pa.evaluate(async () => { DB.vanDrv = { 'VOLVO|2026-10-22': 'Pat' }; sched(); await saveDB(); }); await wait(pa); await sleep(800);
    await reload(pa); await reload(pb); await deliv(pa); await deliv(pb);
    rec('R5 set-up: both PCs show Pat on the Volvo Thu and nothing else', await pa.evaluate(() => JSON.stringify(DB.vanDrv)) === '{"VOLVO|2026-10-22":"Pat"}' && await pb.evaluate(() => vanDrv('VOLVO', '2026-10-22')) === 'Pat', srvDrv(S));
    await pb.selectOption(SEL('ARTIC', THU), 'Mick'); await wait(pb); await sleep(1500);
    await pa.selectOption(SEL('VOLVO', THU), ''); await wait(pa); await sleep(1500);
    const r5 = S.row.settings.vanDrv || {};
    rec('[HIGH if it fails] R5: PC B puts Mick on the Artic; PC A then takes Pat off the Volvo → Pat stays OFF and Mick stays on', !r5['VOLVO|' + THU] && r5['ARTIC|' + THU] === 'Mick', JSON.stringify(r5) + ' · PC A now shows Volvo: ' + await pa.evaluate(() => vanDrv('VOLVO', '2026-10-22')));
    // control: the same with ANOTHER driver still set on PC A (so its save carries vanDrv) — expected to work
    await pa.evaluate(async () => { DB.vanDrv = { 'VOLVO|2026-10-22': 'Pat', 'VOLVO|2026-10-23': 'Mick' }; sched(); await saveDB(); }); await wait(pa); await sleep(800);
    await reload(pa); await reload(pb); await deliv(pa); await deliv(pb);
    await pb.selectOption(SEL('ARTIC', THU), 'Mick'); await wait(pb); await sleep(1500);
    await pa.selectOption(SEL('VOLVO', THU), ''); await wait(pa); await sleep(1500);
    const r6 = S.row.settings.vanDrv || {};
    rec('R6 (control): same as R5 but PC A still has another driver set → Pat stays off', !r6['VOLVO|' + THU] && r6['ARTIC|' + THU] === 'Mick', JSON.stringify(r6));
    // clean slate for the next parts
    await wait(pa); await wait(pb); await pa.evaluate(() => { DB.vanDrv = {}; }); await pb.evaluate(() => { DB.vanDrv = {}; }); S.row.settings.vanDrv = {};
    await reload(pa); await reload(pb); await deliv(pa); await deliv(pb);

    // ---------- T. two PCs at once ----------
    // T1: same van, same day, two different drivers, neither PC refreshed
    await pa.selectOption(SEL('VOLVO', THU), 'Pat'); await pb.selectOption(SEL('VOLVO', THU), 'Mick'); await wait(pa); await wait(pb); await sleep(2000);
    await reload(pa); await reload(pb);
    const t1 = { db: (S.row.settings.vanDrv || {})['VOLVO|' + THU], a: await pa.evaluate(() => vanDrv('VOLVO', '2026-10-22')), b: await pb.evaluate(() => vanDrv('VOLVO', '2026-10-22')) };
    rec('T1: two PCs put Pat / Mick on the same Volvo Thu at the same time → one driver in the database and both PCs agree after refresh', !!t1.db && t1.a === t1.db && t1.b === t1.db, JSON.stringify(t1));
    // T2: Pat put on TWO vans the same day from two PCs (neither sees the other's yet) → nobody asked
    await wait(pa); await wait(pb); await pa.evaluate(() => { DB.vanDrv = {}; }); await pb.evaluate(() => { DB.vanDrv = {}; }); S.row.settings.vanDrv = {}; await deliv(pa); await deliv(pb);
    await pa.evaluate(() => { window.__asked = []; }); await pb.evaluate(() => { window.__asked = []; });
    await pa.selectOption(SEL('VOLVO', FRI), 'Pat'); await sleep(100); await pb.selectOption(SEL('ARTIC', FRI), 'Pat'); await wait(pa); await wait(pb); await sleep(2000);
    const vd = S.row.settings.vanDrv || {}, askedT2 = (await pa.evaluate(() => window.__asked.slice())).concat(await pb.evaluate(() => window.__asked.slice()));
    rec('(info, LOW) T2: Pat put on the Volvo AND the Artic Fri from two PCs at once → somebody is told he is on two vans', !(vd['VOLVO|' + FRI] === 'Pat' && vd['ARTIC|' + FRI] === 'Pat') || askedT2.length > 0 || await pa.evaluate(() => { loadDB(); return /two vans|already on/i.test(document.body.innerText); }), JSON.stringify([vd, askedT2]));
    await wait(pa); await wait(pb); await pa.evaluate(() => { DB.vanDrv = {}; }); await pb.evaluate(() => { DB.vanDrv = {}; }); S.row.settings.vanDrv = {};

    // ---------- P. the driver's phone remembers yesterday's van ----------
    // office: Pat on the Volvo Thu, on the ARTIC Fri; nobody set on the Volvo Fri
    await deliv(pa); await pa.selectOption(SEL('VOLVO', THU), 'Pat'); await wait(pa); await pa.selectOption(SEL('ARTIC', FRI), 'Pat'); await wait(pa); await sleep(1200);
    const d = await X.dev(browser, S, 'driver'), pd = d.page;
    await pd.evaluate(() => { ls.set('wpfDrvName', 'Pat'); ls.set('wpfDrvVeh', ''); ls.set('wpfDrvDay', 'Thu|2026-10-19'); ROLE = 'driver'; renderDriver(document.getElementById('app')); }); await sleep(400);
    rec('P0 set-up: Pat\'s phone on Thu → the Volvo is picked for him', await pd.evaluate(() => (document.getElementById('drv-veh') || {}).value) === 'VOLVO');
    // Friday: he changes the Day box (as he would next morning)
    await pd.evaluate(() => { const s = document.getElementById('drv-day'); s.value = 'Fri|2026-10-19'; s.dispatchEvent(new Event('change')); }); await sleep(500);
    const p1 = await pd.evaluate(() => ({ veh: (document.getElementById('drv-veh') || {}).value, asg: (document.getElementById('drv-asg') || {}).textContent || '', run: document.body.innerText.includes('WO-V2') }));
    rec('[MEDIUM if it fails] P1: Pat\'s phone, Friday (office put him on the ARTIC; nobody on the Volvo Fri) → the Artic is picked, or he is told "you are on the Artic"', p1.veh === 'ARTIC' || /Artic/i.test(p1.asg), JSON.stringify(p1));
    // reopen the phone on Friday (fresh render) — same thing
    await pd.evaluate(() => { ls.set('wpfDrvDay', 'Fri|2026-10-19'); renderDriver(document.getElementById('app')); }); await sleep(300);
    const p2 = await pd.evaluate(() => ({ veh: (document.getElementById('drv-veh') || {}).value, asg: (document.getElementById('drv-asg') || {}).textContent || '' }));
    rec('[MEDIUM if it fails] P2: …reopened on Friday: still shows the Volvo run with no word about the Artic', p2.veh === 'ARTIC' || /Artic/i.test(p2.asg), JSON.stringify(p2));
    await d.close();

    // ---------- D. a driver deleted from Staff after being set; odd names ----------
    await pa.evaluate(async () => { DB.staff = DB.staff.filter(s => s.n !== 'Pat'); sched(); await saveDB(); }); await wait(pa); await deliv(pa);
    const d1 = await pa.evaluate(s => { const e = document.querySelector(s); return e ? { v: e.value, opts: [...e.options].map(o => o.text) } : null; }, SEL('VOLVO', THU));
    rec('D1: Pat deleted from Staff → the Volvo Thu box still shows Pat (not silently blank) and can be cleared', d1 && d1.v === 'Pat' && d1.opts.includes('👤 driver…'), JSON.stringify(d1));
    const d1b = await pa.evaluate(s => { const e = document.querySelector(s); return e ? [...e.options].map(o => o.text) : null; }, SEL('ARTIC', THU));
    const stf = JSON.stringify([(S.row.settings.staff || []).map(x => x.n), await pa.evaluate(() => staff().map(x => x.n))]);
    rec('D2: …and he is no longer offered on other days', d1b && !d1b.includes('Pat'), JSON.stringify(d1b) + ' staff db/screen ' + stf);
    const ODD = "Seán O'Grady 🚚 <b>x</b>";
    await pa.selectOption(SEL('VOLVO', FRI), { label: ODD }); await wait(pa); await sleep(1200);
    rec('D3: a driver named with an apostrophe, accent, emoji and <b> is stored exactly', (S.row.settings.vanDrv || {})['VOLVO|' + FRI] === ODD, srvDrv(S));
    await deliv(pa, 'prod');
    const d4 = await pa.evaluate(() => ({ b: document.querySelectorAll('.ddrv-w b').length, txt: [...document.querySelectorAll('select.ddrv')].map(e => e.value) }));
    rec('D4: Deliveries shows the name as text in the box (no bold tag made from the name)', d4.b === 0 && d4.txt.includes("Seán O'Grady 🚚 <b>x</b>"), JSON.stringify(d4));
    await pa.evaluate(() => openListEditor(null, 'WO-V2')); await sleep(1200);
    const d5 = await pa.evaluate(() => { const e = document.getElementById('me-delmsg') || document.getElementById('me-delro'); return e ? { t: e.textContent, b: e.querySelectorAll('b').length, h: e.innerHTML } : null; });
    rec('D5: list window delivery line shows "— driver Seán O\'Grady 🚚 <b>x</b>" as text', d5 && d5.t.includes('driver ' + ODD) && !/<b>x<\/b>/.test(d5.h), JSON.stringify(d5));
    await closeAll(pa);

    // ---------- F. a save that fails ----------
    await deliv(pa);
    S.failSaves = true;
    await pa.selectOption(SEL('ARTIC', THU), 'Mick'); await sleep(3500);
    const f1 = await pa.evaluate(() => ({ failed: !!DB.saveFailed, txt: /not saved|save failed|retry|offline/i.test(document.body.innerText) }));
    rec('F1: database refuses the save → the person is told on screen (not just a toast that says Mick is set)', f1.txt, JSON.stringify(f1));
    S.failSaves = false;
    await pa.evaluate(async () => { try { await saveDB(); } catch (e) {} }); await wait(pa); await sleep(1500);
    rec('F2: database back → Mick on the Artic Thu lands', (S.row.settings.vanDrv || {})['ARTIC|' + THU] === 'Mick', srvDrv(S));

    // ---------- O. the old screen (origin/main) saves the settings ----------
    const html = A.gitShow('origin/main');
    if (!html) rec('old code readable with git show origin/main', false);
    else {
      const before = srvDrv(S);
      const old = await A.openOld(browser, S, html);
      await old.page.evaluate(async () => { try { await loadDB(); render(); } catch (e) {} }); await sleep(800);
      await old.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-V1'); o.notes = 'old screen note'; try { sched(); } catch (e) {} await saveDB(); await new Promise(r => setTimeout(r, 1500)); });
      rec('O0 set-up: the old screen\'s save landed', (S.row.orders.find(x => x.wo === 'WO-V1') || {}).notes === 'old screen note');
      rec('[MEDIUM if it fails] O1: the old screen\'s settings save keeps settings.vanDrv in the database', srvDrv(S) === before, before + ' → ' + srvDrv(S));
      const e = await X.dev(browser, S, 'prod'), pe = e.page; await deliv(pe);
      const fresh = await pe.evaluate(() => vanDrv('ARTIC', '2026-10-22'));
      rec('[MEDIUM if it fails] O2: a PC opened after the old screen\'s save still shows Mick on the Artic Thu', fresh === 'Mick', 'shows "' + fresh + '"');
      await e.close(); await old.close();
      rec('no page errors on the old screen', !(S.oldErrors || []).length, (S.oldErrors || []).join(' | ').slice(0, 200));
    }

    // ---------- G. 60-day tidy ----------
    const g = await pa.evaluate(() => { vanDrvSet('VOLVO', '2026-08-10', 'Pat'); const a1 = vanDrv('VOLVO', '2026-08-10'); vanDrvSet('VOLVO', '2026-08-25', 'Pat'); return [a1, vanDrv('VOLVO', '2026-08-25'), vanDrv('ARTIC', '2026-10-22')]; });
    rec('(info, LOW — function level) G1: a driver set for a date more than 60 days back is dropped at once (the toast still says he is set)', g[0] === 'Pat', JSON.stringify(g));
    rec('G2: 57 days back is kept, and today\'s entries are not touched by the tidy', g[1] === 'Pat' && g[2] === 'Mick', JSON.stringify(g));

    // ---------- W. roles ----------
    // the PIN for each screen is put on this PC first, so the screen really draws (without it the role picker shows and the check is empty)
    for (const role of ['pm', 'design', 'dash', 'floor', 'saw', 'stores']) {
      const w = await pa.evaluate(rl => { localStorage.setItem('wpfPin_' + rl, pins()[rl] || '9000'); ROLE = rl; prodTab = 'deliv'; tab = 'd'; render(); return { ok: roleOk(rl), n: document.querySelectorAll('select[data-ddrv]').length, picker: !!document.querySelector('.role-pick, #role-pick, .rp-ovl') || /Factory Floor Screen/.test(document.getElementById('app').innerText) }; }, role); await sleep(200);
      rec('W: ' + role + ' screen really drawn — no driver box anywhere on it', w.ok && w.n === 0, JSON.stringify(w));
    }
    await pa.evaluate(() => { localStorage.setItem('wpfPin_pm', pins().pm || '9000'); ROLE = 'pm'; render(); }); await sleep(300);
    const wpm = await pa.evaluate(() => /driver/i.test(document.getElementById('app').innerText));
    rec('(info) W: the PM screen shows who drives a van (code comment: "everyone sees it") — it does not; only office / Production Manager see the Deliveries page (the Deliveries page, where the driver is shown, is office / Production Manager only)', wpm, String(wpm));
    // ---------- M. phone 360 ----------
    await pa.setViewportSize({ width: 360, height: 640 }); await deliv(pa, 'prod');
    const m = await pa.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView(); const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width), sw: document.documentElement.scrollWidth }; }, SEL('VOLVO', THU));
    rec('M1: phone 360 px — the driver box is on screen, no sideways scroll', m && m.l >= 0 && m.r <= 360 && m.sw <= 362, JSON.stringify(m));
    rec('(info, LOW) M2: phone 360 px — the driver box is at least 28 px tall (finger-sized) and 60 px wide', m && m.h >= 28 && m.w >= 60, JSON.stringify(m));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
