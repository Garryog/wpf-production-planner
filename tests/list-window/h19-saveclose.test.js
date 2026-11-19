// Hotfix 19 Nov (Garry, live: "save and close button not working in new cutting list window"). Not reproduced on the fake
// database, so the four places where ✓ Save & close could LOOK dead to a real person are made plain:
//  1. while a save runs, BOTH Save buttons are greyed and say "Saving… please wait"; a second press is answered by the buttons;
//     after 4 s "Still saving — the database is slow, don't close";
//  2. the "Who is making changes on this computer?" box closed (Cancel) → "Not saved — choose who you are first…" by the buttons;
//  3. a WO typed in the "WO number" box, then Save & close → that WO is used (or "WO-x not found in the planner — check the number");
//  4. a short laptop screen (1366×650): the Save bar is on screen without scrolling.
// Real mouse where it matters. Fake Supabase only. Run: node tests/list-window/h19-saveclose.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, finish, closeAll, asks, setv, rows, liveFor } = L;
const PROC = '5. WORK ORDER PROCESSED';
const ord = (wo, floor, unit, title) => H.order({ wo, customer: 'Kildare Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC });
const box = (p, id) => p.evaluate(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y);
  return { x, y, top: r.top, bottom: r.bottom, vh: innerHeight, hit: !!(t && (t === e || e.contains(t))) }; }, id);
const st = p => p.evaluate(() => { const g = id => document.getElementById(id), b = g('me-save'), c = g('me-saveclose'), m = g('me-fmsg');
  return { open: !!document.querySelector('.me-ed'), panel: !!document.querySelector('.me-dov'), err: (g('me-err') || {}).textContent || '',
    sDis: b ? b.disabled : null, cDis: c ? c.disabled : null, sTxt: b ? b.textContent : null, cTxt: c ? c.textContent : null,
    msg: m ? m.textContent : null, msgInFoot: !!(m && m.closest('.me-foot')), msgShown: !!(m && m.getClientRects().length),
    who: [...document.querySelectorAll('.pod-ovl')].some(o => /Who is making changes/.test(o.innerText)) }; });
const fill = async p => { const i = (await rows(p)).findIndex(r => !r.hdr); for (const [f, v] of [['item', 'Base side'], ['qty', '2'], ['L', '720'], ['W', '560'], ['mat', 'MFC White']]) await setv(p, i + '|' + f, v); await sleep(150); };
const press = async (p, id) => { const b = await box(p, id); if (!b) return 'no #' + id; await p.mouse.move(b.x, b.y); await p.mouse.down(); await sleep(80); await p.mouse.up(); return 'ok'; };
const open = async (p, wo, pid) => { await closeAll(p); await p.evaluate(({ wo, pid }) => { window.__confirm = true; openListEditor(null, wo, pid || ''); }, { wo, pid }); await sleep(1000); };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row(); for (let i = 1; i <= 9; i++) r.orders.push(ord('WO-K' + i, String(i), String(i * 10), 'APT ' + i + ' KITCHEN'));
    const S = X.makeServer(r); S.db.sql18 = 'before'; // live has NOT run the 18 Nov SQL
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    D.insert(S.db, 'project_materials', { id: 'MK1', project_id: 'PK', name: 'MFC White', kind: 'sheet' });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.evaluate(async () => { lsReset(); await lsLoad(); });

    // ---------- 1. a slow save: both buttons greyed and say so; a second press answered; after 4 s "database is slow" ----------
    await open(p, 'WO-K1'); await fill(p);
    S.hold3 = new Promise(res => { S.rel = () => { S.hold3 = null; res(); }; });
    await press(p, 'me-saveclose'); await sleep(500);
    let s = await st(p);
    rec('1a Save & close pressed, the database slow → BOTH Save buttons greyed', s.sDis === true && s.cDis === true, JSON.stringify([s.sDis, s.cDis]));
    rec('1a …and both say "Saving… please wait"', /Saving… please wait/.test(s.sTxt) && /Saving… please wait/.test(s.cTxt), JSON.stringify([s.sTxt, s.cTxt]));
    await press(p, 'me-saveclose'); await sleep(200); s = await st(p);
    rec('1b a second press on ✓ Save & close → a message BY THE BUTTONS (in the Save bar), on screen', s.msgInFoot && s.msgShown && /Saving… please wait/.test(s.msg), JSON.stringify([s.msg, s.msgInFoot, s.msgShown]));
    await sleep(4200); s = await st(p);
    rec('1c still no answer after 4 s → "Still saving — the database is slow, don\'t close"', /Still saving — the database is slow, don't close/.test(s.msg || ''), JSON.stringify(s.msg));
    S.rel(); await sleep(2500); s = await st(p);
    rec('1d the answer comes → ONE list on WO-K1, the window closed', liveFor(S, 'WO-K1').length === 1 && !s.open && !s.panel, JSON.stringify([liveFor(S, 'WO-K1').length, s.open, s.panel]));
    // a refused save puts the buttons back as they were
    await open(p, 'WO-K2'); await fill(p); await p.evaluate(() => { window.__confirm = false; }); // (no question is asked here — nothing to refuse)
    await setv(p, (await rows(p)).findIndex(r => !r.hdr) + '|qty', '-1'); await sleep(100);
    await press(p, 'me-saveclose'); await sleep(800); s = await st(p);
    rec('1e a save refused (negative quantity) → both buttons pressable again, their own words back', s.open && s.sDis === false && s.cDis === false && /Save & close/.test(s.cTxt) && /Save list/.test(s.sTxt) && /negative/.test(s.err), JSON.stringify(s));

    // ---------- 2. the "Who is making changes on this computer?" box cancelled ----------
    await open(p, 'WO-K3'); await fill(p);
    await p.evaluate(() => sessionStorage.removeItem('wpfWho'));
    await press(p, 'me-saveclose'); await sleep(500); s = await st(p);
    rec('2 set-up: no name chosen in this tab → the "Who is making changes" box', s.who, JSON.stringify(s));
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('#pod-x').click(); }); await sleep(300); s = await st(p);
    rec('2 Cancel on that box → "Not saved — choose who you are first, then press Save again" by the buttons, window open, nothing saved',
      s.open && s.msgInFoot && s.msgShown && /Not saved — choose who you are first, then press Save again/.test(s.msg) && !liveFor(S, 'WO-K3').length, JSON.stringify([s.msg, s.open, liveFor(S, 'WO-K3').length]));
    await press(p, 'me-saveclose'); await sleep(400);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('#pick-other').value = 'Garry'; o.querySelector('#pick-ok').click(); }); await sleep(2500); s = await st(p);
    rec('2 …then Save & close again and a name given → saved, window closed', liveFor(S, 'WO-K3').length === 1 && !s.open, JSON.stringify([liveFor(S, 'WO-K3').length, s.open]));

    // ---------- 3. a WO typed in the "WO number" box, then Save & close ----------
    const typeWo = async wo => { await open(p, '', 'PK'); const has = await p.evaluate(wo => { const e = document.getElementById('me-jwo'); if (!e) return false; e.value = wo; e.dispatchEvent(new Event('input')); return true; }, wo); await fill(p); return has; };
    const has = await typeWo('WO-K9');
    rec('3 set-up: a new list with no WO shows the "WO number" box', has);
    await press(p, 'me-saveclose'); await sleep(2500); s = await st(p);
    rec('3a WO-K9 typed in the WO number box, then Save & close → saved ON WO-K9 and the window closed (not "type the Floor and the Unit")', liveFor(S, 'WO-K9').length === 1 && !s.open, JSON.stringify([liveFor(S, 'WO-K9').length, s.open, s.err]));
    await typeWo('WO-NOPE'); await press(p, 'me-saveclose'); await sleep(1000); s = await st(p);
    rec('3b a WO that is not in the planner → "WO-NOPE not found in the planner — check the number", nothing saved', s.open && /WO-NOPE not found in the planner — check the number/.test(s.err) && !S.db.t.lists.some(l => (l.wos || []).includes('WO-NOPE')), JSON.stringify(s.err));

    // ---------- 4. a short laptop screen: the Save bar on screen without scrolling ----------
    const t2 = await X.dev(browser, S, 'design', { viewport: { width: 1366, height: 650 } }), p2 = t2.page; await asks(p2);
    await p2.evaluate(async () => { lsReset(); await lsLoad(); lsNewStd('WO-K4'); }); await sleep(1200);
    for (const id of ['me-saveclose', 'me-save']) { const b = await box(p2, id);
      rec('4 1366×650, the standard layout (a long list): ' + id + ' is on screen with no scrolling and nothing covers it', b && b.bottom <= b.vh && b.top >= 0 && b.hit, JSON.stringify(b)); }
    await p2.evaluate(() => { const g = document.querySelector('.me-ed'); g.scrollTop = 0; }); await sleep(100);
    const i2 = (await rows(p2)).findIndex(r => !r.hdr); await setv(p2, i2 + '|item', 'Side'); await setv(p2, i2 + '|qty', '1'); await setv(p2, i2 + '|L', '500'); await setv(p2, i2 + '|W', '400'); await sleep(150);
    await press(p2, 'me-saveclose'); await sleep(900);
    const e2 = await p2.evaluate(() => { const e = document.getElementById('me-err'), r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + 20, r.top + r.height / 2); return { txt: e.textContent, top: r.top, bottom: r.bottom, vh: innerHeight, hit: !!(t && (t === e || e.contains(t))) }; });
    rec('4 …a refused Save & close (no material): the red reason is on screen right above the buttons', /material/.test(e2.txt) && e2.bottom <= e2.vh && e2.hit, JSON.stringify(e2));
    rec('no page errors', !errs.length, JSON.stringify(errs.slice(0, 3)));
  } catch (e) { rec('test ran without crashing', false, e.stack); }
  await browser.close(); finish();
})();
