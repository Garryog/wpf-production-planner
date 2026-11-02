// Tester re-test #2 (2 Nov 2026) of the five Saw/Stores fixes on feature/stage2-imports @ 652aa3b:
//   d3a8f00 combined list odd qty shown + warned   7f195fa combined list leaves out ticked lines
//   c5de45b waiting book groups case/space-blind     5af0656 Release can't reopen finished work
//   652aa3b per-line Release wraps on phones
// Goes beyond retest-nov.test.js, then re-confirms Garry's three rules.
// Stubbed Supabase only (tests/stage1/srv.js). Run: node tests/sawstores/retest-nov2.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const NOW = '2026-10-21T09:00:00Z';
const ROWS = [
  { k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Top', qty: 2, L: 1200, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Back', qty: 1, L: 900, W: 700, mat: 'Oak', note: '' },
  { k: 'saw', item: 'Shelf', qty: 3, L: 800, W: 300, mat: 'mfc white ', note: '' },
];
const mk = (rows, extra) => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: Object.assign({ lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: rows.filter(r => r.k === 'saw').length, fit: rows.filter(r => r.k === 'fit').length, wos: ['WO-1'], up: NOW }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: rows } } } }, extra || {}) });
const tap = (p, attr, i) => p.evaluate(({ attr, i }) => { const k = listRows(lists()[0]).map(rowKey)[i]; const b = [...document.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr) === 'L1|' + k); if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; }, { attr, i });
// Robust save: wait for any in-flight save (startup / auto-save) to land first, then save, then wait again.
// (A bare saveDB() while SAVING only sets SAVE_AGAIN and returns at once.)
const save = p => p.evaluate(async () => { const idle = () => new Promise(r => { const t = () => (SAVING ? setTimeout(t, 20) : r()); t(); }); await idle(); clearTimeout(saveT); await saveDB(); await idle(); });
const reload = p => p.evaluate(async () => { await loadDB(); render(); });
const state = (p, i) => p.evaluate(i => { const l = lists()[0], k = listRows(l).map(rowKey)[i]; return { held: heldRow(l, k), ticked: rowTicked('L1', k), raw: (holdsOf('L1')[k] || {}).st || '' }; }, i);
const dev = async (browser, S, role, o) => { const t = await open(browser, S, Object.assign({ now: NOW, role: role || 'saw' }, o || {})); await t.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); }); return t; };

(async () => {
  const browser = await H.chromium.launch();
  const errs = [];

  // =============== 1. Combined list (d3a8f00 + 7f195fa) ===============
  {
    const S = makeServer(mk(ROWS)); const A = await dev(browser, S);
    const c = await A.page.evaluate(() => {
      const r = (qty, item) => ({ k: 'saw', item: item || 'Side', L: 2400, W: 600, mat: 'MFC White', note: '', qty });
      const run = (a, b, ticksB) => {
        DB.listWBs.WQ = { sheets: { A: a, B: b } };
        const la = { id: 'QA', wb: 'WQ', sheet: 'A', name: 'H-A', wos: ['WO-1'], saw: a.length }, lb = { id: 'QB', wb: 'WQ', sheet: 'B', name: 'H-B', wos: ['WO-1'], saw: b.length };
        DB.listRow = DB.listRow || {}; DB.listRow.QA = {}; DB.listRow.QB = {}; DB.listHold = DB.listHold || {}; DB.listHold.QA = {}; DB.listHold.QB = {};
        (ticksB || []).forEach(i => DB.listRow.QB[rowKey(b[i])] = { m: 'saw', at: new Date().toISOString(), by: 'x' });
        return combineLists([la, lb], 'saw').map(x => ({ item: x.item, qty: x.qty, bad: x.bad, per: x.per }));
      };
      const o = {};
      for (const q of ['2 x 2', '2x2', '', '0', '-2', '1.5', 2.5, null, undefined, '3 off', '½', 'NaN', '1e2', '+3', '0x10', ' ']) o[JSON.stringify(q === undefined ? 'undef' : q)] = run([r(q)], [r(4)]);
      o.good = run([r(' 3 ')], [r('04')]);
      o.numStr = run([r(4)], [r('4')]);
      o.bothBad = run([r('2x2')], [r('')]);
      o.goodThenBadSameHouse = run([r(2), r('2x2', 'Side')], [r(4)]); // can't happen with identical keys, but test the per-chip concat anyway
      o.huge = run([r('999999999999')], [r(1)]);
      o.inj = run([r('<img src=x onerror=window.__pwn=1>')], [r(1)]);
      return o;
    });
    const bads = Object.entries(c).filter(([k]) => k.startsWith('"') || k === 'null' || k === '2.5');
    // every odd value must: not be added (qty === 4 from H-B only), be counted in bad, and be shown as typed on H-A
    const badOK = bads.map(([k, v]) => { const x = v[0]; return { k, ok: x.qty === 4 && x.bad === 1 && typeof x.per['H-A'] === 'string' && x.per['H-B'] === 4, x }; });
    rec('C1 every odd qty ("2 x 2", "", "0", "-2", "1.5", 2.5, null, "3 off", "½", "+3", " ", ...) is left out of the total, counted as "not added", shown as typed', badOK.every(x => x.ok), JSON.stringify(badOK.filter(x => !x.ok)));
    rec('C1 qty "0" shown as "0" (not "no qty"), blank shown as "no qty"', c['"0"'][0].per['H-A'] === '0' && c['""'][0].per['H-A'] === 'no qty' && c['" "'][0].per['H-A'] === 'no qty', JSON.stringify([c['"0"'][0].per, c['""'][0].per]));
    rec('C1 " 3 " and "04" count as 3 and 4 (total 7)', c.good[0].qty === 7 && c.good[0].bad === 0, JSON.stringify(c.good));
    rec('C1 number 4 and text "4" on two houses = 8', c.numStr[0].qty === 8, JSON.stringify(c.numStr));
    rec('C1 both houses odd -> total 0 with 2 not added', c.bothBad[0].qty === 0 && c.bothBad[0].bad === 2, JSON.stringify(c.bothBad));
    info('C1 qty "999999999999" accepted as a number', JSON.stringify(c.huge));
    // Rendered panel: warning text, chips, HTML injection
    const ui = await A.page.evaluate(() => {
      DB.listWBs.WQ = { sheets: { A: [{ k: 'saw', item: 'Side', L: 2400, W: 600, mat: 'MFC White', qty: '2 x 2' }, { k: 'saw', item: 'Top', L: 1200, W: 600, mat: 'MFC White', qty: '<img src=x onerror=window.__pwn=1>' }],
        B: [{ k: 'saw', item: 'Side', L: 2400, W: 600, mat: 'MFC White', qty: 4 }, { k: 'saw', item: 'Top', L: 1200, W: 600, mat: 'MFC White', qty: 2 }] } };
      const la = { id: 'QA', wb: 'WQ', sheet: 'A', name: 'H-A', wos: ['WO-1'], saw: 2 }, lb = { id: 'QB', wb: 'WQ', sheet: 'B', name: 'H-B', wos: ['WO-1'], saw: 2 };
      DB.listRow.QA = {}; DB.listRow.QB = {};
      openCombined([la, lb], 'saw');
      const ov = document.querySelector('.pod-ovl'); const t = ov ? ov.innerText : '';
      const chips = ov ? [...ov.querySelectorAll('.ph-chip')].map(x => x.innerText) : [];
      window.__opened = []; const lb2 = ov && ov.querySelector('#cmb-lbl'); if (lb2) lb2.click();
      const lab = window.__opened.slice(-1)[0] || '';
      if (ov) ov.remove();
      return { warn: (t.match(/\+ \d+ not added — check quantity/g) || []).length, chips, injected: !!document.querySelector('.pod-ovl img') || window.__pwn === 1, leftOut: /Lines already ticked cut are left out/.test(t), labHasImg: /<img src=x/.test(lab) };
    });
    await A.page.waitForTimeout(100);
    rec('C1 panel shows "+ 1 not added — check quantity" on both odd rows', ui.warn === 2, JSON.stringify(ui));
    rec('C1 panel chip shows "H-A ×2 x 2 ⚠ check quantity"', ui.chips.some(x => /H-A ×2 x 2/.test(x) && /check quantity/.test(x)), JSON.stringify(ui.chips));
    rec('C1 qty containing <img onerror> is escaped in panel and labels (no HTML injection)', !ui.injected && !ui.labHasImg && !(await A.page.evaluate(() => window.__pwn === 1)), JSON.stringify(ui));
    rec('C1 panel says ticked lines are left out', ui.leftOut);

    // 7f195fa: ticked excluded; unticked comes back; ticked+held (two-screen clash) excluded; released+ticked excluded
    const t = await A.page.evaluate(() => {
      const a = [{ k: 'saw', item: 'Side', L: 2400, W: 600, mat: 'MFC White', qty: 4 }, { k: 'saw', item: 'Top', L: 1200, W: 600, mat: 'MFC White', qty: 2 }];
      DB.listWBs.WT = { sheets: { A: a, B: JSON.parse(JSON.stringify(a)) } };
      const la = { id: 'TA', wb: 'WT', sheet: 'A', name: 'H-A', wos: ['WO-1'], saw: 2 }, lb = { id: 'TB', wb: 'WT', sheet: 'B', name: 'H-B', wos: ['WO-1'], saw: 2 };
      const kS = rowKey(a[0]), kT = rowKey(a[1]); DB.listRow.TA = {}; DB.listRow.TB = {}; DB.listHold.TA = {}; DB.listHold.TB = {};
      const tot = () => combineLists([la, lb], 'saw').map(x => x.item + ':' + x.qty).sort().join(',');
      const o = {};
      o.none = tot();
      DB.listRow.TA[kS] = { m: 'saw', at: new Date().toISOString(), by: 'x' }; o.tickA = tot();
      delete DB.listRow.TA[kS]; o.untick = tot();
      DB.listRow.TB[kT] = { m: 'saw', at: new Date().toISOString(), by: 'x' }; DB.listHold.TB[kT] = { m: 'saw', st: 'hold', at: new Date().toISOString() }; o.clash = tot();
      DB.listHold.TB[kT].st = 'rel'; o.relTicked = tot();
      delete DB.listRow.TB[kT]; o.relOpen = tot();
      DB.listRow.TA[kS] = { m: 'saw', at: new Date().toISOString(), by: 'x' }; DB.listRow.TA[kT] = { m: 'saw', at: new Date().toISOString(), by: 'x' };
      DB.listRow.TB[kS] = { m: 'saw', at: new Date().toISOString(), by: 'x' }; DB.listRow.TB[kT] = { m: 'saw', at: new Date().toISOString(), by: 'x' }; o.allCut = tot();
      return o;
    });
    rec('C2 nothing ticked: Side 8, Top 4', t.none === 'Side:8,Top:4', t.none);
    rec('C2 H-A Side ticked: Side 4; untick brings it back to 8', t.tickA === 'Side:4,Top:4' && t.untick === 'Side:8,Top:4', JSON.stringify(t));
    rec('C2 line both ticked + held (two-screen clash = done) is left out', t.clash === 'Side:8,Top:2', t.clash);
    rec('C2 released line already ticked is left out; released + not ticked is counted', t.relTicked === 'Side:8,Top:2' && t.relOpen === 'Side:8,Top:4', JSON.stringify(t));
    rec('C2 every line cut -> empty combined list (no 0-qty rows)', t.allCut === '', JSON.stringify(t.allCut));
    // Two houses with the same name in the same project (e.g. two workbooks both have "House 1"): per-house split must not merge them
    const dup = await A.page.evaluate(() => {
      const a = [{ k: 'saw', item: 'Side', L: 2400, W: 600, mat: 'MFC White', qty: 4 }];
      DB.listWBs.WD = { sheets: { A: a, B: [{ ...a[0], qty: 2 }] } };
      const la = { id: 'DA', wb: 'WD', sheet: 'A', name: 'House 1', project: 'Proj', wos: ['WO-1'], saw: 1 }, lb = { id: 'DB2', wb: 'WD', sheet: 'B', name: 'House 1', project: 'Proj', wos: ['WO-1'], saw: 1 };
      return combineLists([la, lb], 'saw').map(x => ({ qty: x.qty, per: x.per }));
    });
    rec('C3 [Low: total right, per-house split shows "House 1 ×6" not ×4 + ×2; labels print per house so still correct] two selected houses with the same name keep separate per-house quantities', Object.keys(dup[0].per).length === 2, JSON.stringify(dup));
    // C4: combined list key uses trim()+lowercase only, not matKey(): odd spacing / NBSP / NFD accent split one part into separate rows
    const mk4 = await A.page.evaluate(() => {
      const mats = ['MFC White', 'MFC  White', 'MFC\u00a0White', 'Lame\u0301 Oak', 'Lam\u00e9 Oak'];
      const sh = {}; mats.forEach((m, i) => { sh['S' + i] = [{ k: 'saw', item: 'Side', L: 2400, W: 600, mat: m, qty: 2 }]; });
      DB.listWBs.WM = { sheets: sh };
      const ls = mats.map((m, i) => ({ id: 'M' + i, wb: 'WM', sheet: 'S' + i, name: 'H' + i, wos: ['WO-1'], saw: 1 }));
      ls.forEach(l => { DB.listRow[l.id] = {}; DB.listHold[l.id] = {}; });
      return combineLists(ls, 'saw').map(x => JSON.stringify(x.mat) + ':' + x.qty);
    });
    rec('C4 combined list merges "MFC  White"/NBSP with "MFC White" and NFD/NFC "Lamé Oak" (matKey) -> 2 rows', mk4.length === 2, JSON.stringify(mk4));
    errs.push(...(S.errors || []));
    await A.close();
  }

  // =============== 2. Release (5af0656) ===============
  // 2a. List whose other lines are waiting: release one material -> only that line back; tick -> closed but still amber; release the other -> back
  {
    const rows = [ROWS[0], ROWS[1], ROWS[2]]; // Side MFC, Top MFC, Back Oak
    const S = makeServer(mk(rows)); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 0); await tap(A.page, 'data-rna', 2); await tap(A.page, 'data-rt', 1); // Side + Back waiting, Top cut
    const s0 = await A.page.evaluate(() => ({ done: !!listDone('L1').saw, side: sideState(lists()[0], 'saw'), onQ: !!document.querySelector('.wl-card:not(.cdone)') }));
    rec('R2a two lines waiting + last line ticked -> list signed off, side "hold", off the to-do queue', s0.done && s0.side === 'hold' && !s0.onQ, JSON.stringify(s0));
    await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); releaseHolds([{ l, k: k[0] }], 'Op'); render(); });
    const s1 = await A.page.evaluate(() => { const l = lists()[0]; return { side: sideState(l, 'saw'), relOpen: relOpen(l, 'saw'), tickable: tickableRows(l, 'saw').map(r => r.item), card: (document.querySelector('.wl-card:not(.cdone)') || {}).innerText || '' }; });
    rec('R2a release MFC: list back on queue as MATERIAL HAS ARRIVED with only Side tickable; Oak still waiting', s1.relOpen && /MATERIAL HAS ARRIVED/.test(s1.card) && JSON.stringify(s1.tickable) === '["Side"]' && s1.side === 'hold', JSON.stringify({ ...s1, card: s1.card.slice(0, 160) }));
    await tap(A.page, 'data-rt', 0);
    const s2 = await A.page.evaluate(() => { const l = lists()[0]; return { side: sideState(l, 'saw'), relOpen: relOpen(l, 'saw'), onQ: !!document.querySelector('.wl-card:not(.cdone)'), r: woReady('WO-1').lvl }; });
    rec('R2a tick released Side -> off queue again, WO still amber (Oak waiting)', !s2.relOpen && !s2.onQ && s2.side === 'hold' && s2.r === 'amber', JSON.stringify(s2));
    await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); releaseHolds([{ l, k: k[2] }], 'Op'); render(); });
    const s3 = await A.page.evaluate(() => { const l = lists()[0]; return { tickable: tickableRows(l, 'saw').map(r => r.item), onQ: !!document.querySelector('.wl-card:not(.cdone)') }; });
    rec('R2a release Oak -> back on queue with only Back tickable (Side not re-offered)', s3.onQ && JSON.stringify(s3.tickable) === '["Back"]', JSON.stringify(s3));
    await tap(A.page, 'data-rt', 2);
    const s4 = await A.page.evaluate(() => ({ side: sideState(lists()[0], 'saw'), r: woReady('WO-1').saw }));
    rec('R2a tick Back -> saw side done', s4.side === 'done', JSON.stringify(s4));
    // Release on a ticked line (stale per-line button): only clears the hold
    await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); DB.listHold.L1[k[1]] = { m: 'saw', st: 'hold', at: nowISO(), item: 'Top' }; releaseHolds([{ l, k: k[1] }], 'Op'); render(); });
    const s5 = await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); return { raw: holdsOf('L1')[k[1]] || null, side: sideState(l, 'saw') }; });
    rec('R2b Release on a line already ticked clears the hold only (no "rel", list stays done)', !s5.raw && s5.side === 'done', JSON.stringify(s5));
    errs.push(...(S.errors || []));
    await A.close();
  }
  // 2c. Two screens releasing the same material at the same moment
  {
    const S = makeServer(mk(ROWS)); const A = await dev(browser, S);
    for (const i of [0, 1, 3]) await tap(A.page, 'data-rna', i); await save(A.page);
    const P = await dev(browser, S, 'prod'), Q = await dev(browser, S, 'prod');
    const clickRel = p => p.evaluate(() => { const b = [...document.querySelectorAll('[data-relg]')].find(b => /mfc white/i.test(b.dataset.relg)); if (!b) return 'missing'; b.click(); return 'ok'; });
    const c1 = await clickRel(P.page), c2 = await clickRel(Q.page);
    await Promise.all([save(P.page), save(Q.page)]); await save(P.page); await save(Q.page);
    await reload(A.page); await reload(P.page); await reload(Q.page);
    const st = [await state(A.page, 0), await state(A.page, 1), await state(A.page, 3)];
    const log = ((S.row.settings || {}).holdLog || []).filter(x => x.act === 'release');
    rec('R2c two Production screens Release all MFC White at once -> all 3 lines released, none lost/stuck', c1 === 'ok' && c2 === 'ok' && st.every(s => s.raw === 'rel' && !s.held), JSON.stringify(st));
    info('R2c release log entries after double release', JSON.stringify(log.map(x => x.n + ' by ' + x.by)));
    const vis = await A.page.evaluate(() => ({ doNow: (document.body.innerText.match(/MATERIAL IN — DO NOW/g) || []).length, wait: allHolds(['saw'], 'hold').length }));
    rec('R2c saw sees 3 MATERIAL IN — DO NOW, 0 waiting', vis.doNow === 3 && vis.wait === 0, JSON.stringify(vis));
    await A.close(); await P.close(); await Q.close();
  }
  // 2d. Release all MFC White on Production while the saw (stale) N/As ANOTHER MFC White line -> the new one must stay waiting
  {
    const S = makeServer(mk(ROWS)); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 0); await save(A.page);
    const P = await dev(browser, S, 'prod');
    await tap(A.page, 'data-rna', 1); // A: Top MFC White now N/A too (P doesn't know)
    await P.page.evaluate(() => [...document.querySelectorAll('[data-relg]')].find(b => /mfc white/i.test(b.dataset.relg)).click());
    await Promise.all([save(A.page), save(P.page)]); await save(A.page); await save(P.page);
    await reload(A.page); await reload(P.page);
    const s0 = await state(A.page, 0), s1 = await state(A.page, 1), p1 = await state(P.page, 1);
    rec('R2d Production Release all lands together with a new N/A from the saw -> Side released, new Top N/A still waiting on both screens', s0.raw === 'rel' && s1.held && p1.held, JSON.stringify({ s0, s1, p1 }));
    await A.close(); await P.close();
  }
  // 2e. Release and tick of the same line at the same moment (Production releases, saw found the board and cut it)
  {
    const rows = ROWS.slice(0, 3); // Side, Top, Back
    const S = makeServer(mk(rows)); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 1); await tap(A.page, 'data-rt', 0); await save(A.page); // Top waiting, Side cut, Back still open
    const P = await dev(browser, S, 'prod');
    const taps = [await tap(A.page, 'data-rna', 1), await tap(A.page, 'data-rt', 1), await tap(A.page, 'data-rt', 2)]; // saw: un-N/A Top, cut Top + Back -> list done
    await P.page.evaluate(() => document.querySelector('[data-relg]').click());
    await Promise.all([save(A.page), save(P.page)]); await save(A.page); await save(P.page);
    await reload(A.page); await reload(P.page);
    const q = await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey)[1];
      const todo = document.querySelector('.wl-card:not(.cdone)'); wlShowDone = true; render(); const doneTxt = document.body.innerText; wlShowDone = false; render();
      window.__opened = []; printWorkList('saw', 1); const pr = window.__opened.slice(-1)[0] || '';
      return { raw: (holdsOf('L1')[k] || {}).st || '', ticked: rowTicked('L1', k), side: sideState(l, 'saw'), onQueue: !!todo, doneShowsDoNow: /MATERIAL IN — DO NOW/.test(doneTxt), printed: /House 1/.test(pr), relCount: listHoldRows(l, 'saw', 'rel').length }; });
    rec('R2e simultaneous Release + cut: Top stays cut, list stays done, not back on queue, not in Print today', taps.every(x => x === 'ok') && q.ticked && q.side === 'done' && !q.onQueue && !q.printed, JSON.stringify({ taps, q }));
    rec('R2e finished line is not labelled "MATERIAL IN — DO NOW" on the Done tab', !q.doneShowsDoNow, JSON.stringify(q));
    const pv = await P.page.evaluate(() => allHolds(['saw'], 'hold').length);
    rec('R2e Production view: nothing waiting', pv === 0, String(pv));
    await A.close(); await P.close();
  }

  // =============== 3. Grouping (c5de45b) ===============
  {
    const MATS = ['MFC White', 'MFC  White', 'MFC White', '\tMFC White\t', 'mfc white ', 'MFC WHITE'];
    const rows = MATS.map((m, i) => ({ k: 'saw', item: 'P' + i, qty: 1, L: 2400, W: 600, mat: m, note: '' }));
    rows.push({ k: 'saw', item: 'Q', qty: 1, L: 800, W: 600, mat: `O'Grady "18mm" <b>Oak</b> & Co`, note: '' });
    rows.push({ k: 'saw', item: 'R', qty: 1, L: 800, W: 600, mat: '', note: '' });
    rows.push({ k: 'saw', item: 'R2', qty: 1, L: 700, W: 600, mat: '   ', note: '' });
    const S = makeServer(mk(rows)); const A = await dev(browser, S);
    for (let i = 0; i < rows.length; i++) await tap(A.page, 'data-rna', i);
    await save(A.page);
    const P = await dev(browser, S, 'prod');
    const g = await P.page.evaluate(() => ({ groups: [...document.querySelectorAll('[data-relg]')].map(b => b.dataset.relg), html: /<b>Oak<\/b>/.test(document.body.innerText), bold: !!document.querySelector('.hold-gh b') }));
    const mfcGroups = g.groups.filter(x => /mfc/i.test(x));
    rec('G1 "MFC White" / "mfc white " / "\\tMFC White\\t" / "MFC WHITE" -> one group', true && g.groups.filter(x => /^mfc white$/i.test(x)).length === 1, JSON.stringify(g.groups));
    rec('G1 "MFC  White" (double inner space) grouped with "MFC White"', mfcGroups.length <= 2 && !mfcGroups.some(x => /MFC  White/.test(x)), JSON.stringify(mfcGroups));
    rec('G1 "MFC\\u00a0White" (Excel non-breaking space) grouped with "MFC White"', mfcGroups.length === 1, JSON.stringify(mfcGroups));
    rec('G1 blank and spaces-only material -> one "(material not named)" group', g.groups.filter(x => x === '(material not named)').length === 1, JSON.stringify(g.groups));
    rec('G1 material with quotes/apostrophe/<b> shown as text, not HTML', g.html && !g.bold, JSON.stringify(g));
    // Release the apostrophe/quote group
    await P.page.evaluate(() => [...document.querySelectorAll('[data-relg]')].find(b => /O'Grady/.test(b.dataset.relg)).click());
    await P.page.waitForTimeout(50);
    const q = await P.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); return (holdsOf('L1')[k[6]] || {}).st; });
    rec('G2 Release all on material O\'Grady "18mm" <b>Oak</b> & Co works', q === 'rel', q);
    // Release the MFC group -> how many of the 6 MFC spellings go
    await P.page.evaluate(() => [...document.querySelectorAll('[data-relg]')].find(b => /^mfc white$/i.test(b.dataset.relg)).click());
    await P.page.waitForTimeout(50);
    const rel = await P.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey); return k.slice(0, 6).map(x => (holdsOf('L1')[x] || {}).st); });
    rec('G2 Release all "MFC White" releases every spelling of the same board (6/6)', rel.every(x => x === 'rel'), JSON.stringify(rel));
    // Consistency: sheets panel and combined list group the same way as the waiting book
    const cons = await P.page.evaluate(m => { const rows = m.map((x, i) => ({ k: 'saw', item: 'P', qty: 1, L: 2400, W: 600, mat: x })); DB.listWBs.WG = { sheets: { S: rows } };
      const l = { id: 'GG', wb: 'WG', sheet: 'S', name: 'G', wos: ['WO-1'], saw: rows.length }; return { sheets: sheetNeed([l], '', '').mats.map(x => x.mat), comb: combineLists([l], 'saw').map(x => x.mat) }; }, MATS);
    info('G3 sheets panel groups for the 6 spellings', JSON.stringify(cons.sheets));
    info('G3 combined list groups for the 6 spellings', JSON.stringify(cons.comb));
    errs.push(...(S.errors || []));
    await A.close(); await P.close();
  }
  // Fittings group (Stores): same item different case/space -> one group
  {
    const rows = [{ k: 'fit', item: 'Hinge 110', qty: 10, mat: 'Blum', note: '' }, { k: 'fit', item: 'hinge 110 ', qty: 4, mat: 'Blum', note: 'x' }];
    const S = makeServer(mk(rows)); const A = await dev(browser, S, 'stores');
    await tap(A.page, 'data-rna', 0); await tap(A.page, 'data-rna', 1); await save(A.page);
    const P = await dev(browser, S, 'prod');
    const g = await P.page.evaluate(() => [...document.querySelectorAll('[data-relg]')].map(b => b.dataset.relg));
    rec('G4 Stores: "Hinge 110" and "hinge 110 " -> one fittings group', g.length === 1, JSON.stringify(g));
    await A.close(); await P.close();
  }

  // =============== 4. Phones 320 / 360 (652aa3b) ===============
  const LONG = 'EGGER_H1145_ST10_NATURAL_BARDOLINO_OAK_18MM_MFC_2800x2070_CUSTOMER_SUPPLIED';
  const LONGSP = 'Egger H1145 ST10 Natural Bardolino Oak 18mm MFC customer supplied board';
  const phoneRows = [
    { k: 'saw', item: 'Side panel left hand tall housing ' + LONG, qty: 2, L: 2400, W: 600, mat: LONG, note: 'ABS 2mm 4 sides ' + LONGSP },
    { k: 'saw', item: 'Top', qty: 1, L: 900, W: 600, mat: LONGSP, note: '' },
    { k: 'saw', item: 'Back', qty: 1, L: 900, W: 600, mat: 'Oak', note: '' },
    { k: 'fit', item: 'Hinge ' + LONG, qty: 10, mat: LONGSP, note: '' },
    { k: 'fit', item: 'Handle', qty: 4, mat: 'Brushed steel', note: '' },
  ];
  {
    const S0 = mk(phoneRows); S0.settings.lists[0].name = 'BLOCK_C_APT_12B_LEVEL3_KITCHEN1'; // list names come from Excel sheet names: max 31 chars, often no spaces S0.orders[0].customer = 'O\'Grady Construction & Sons Ltd — Ballymun Regeneration Phase 3';
    const S = makeServer(S0);
    const A = await dev(browser, S, 'saw'); await tap(A.page, 'data-rna', 0); await tap(A.page, 'data-rna', 1); await save(A.page); await A.close();
    const B = await dev(browser, S, 'stores'); await tap(B.page, 'data-rna', 3); await save(B.page); await B.close();
    for (const w of [320, 360]) {
      for (const [role, view] of [['saw', 'todo'], ['saw', 'hold'], ['stores', 'todo'], ['stores', 'hold'], ['prod', '']]) {
        const t = await dev(browser, S, role, { viewport: { width: w, height: 760 } });
        const m = await t.page.evaluate(({ view, w }) => {
          if (view === 'hold') { wlShowHold = true; render(); }
          const de = document.documentElement;
          const offs = [...document.querySelectorAll('button, [data-rt], [data-rna], [data-rel1], [data-relg], input, select')].filter(b => b.offsetParent !== null && !b.closest('.rovl')).map(b => ({ t: (b.innerText || b.dataset.rt || '').slice(0, 24), r: Math.round(b.getBoundingClientRect().right), l: Math.round(b.getBoundingClientRect().left) })).filter(x => x.r > w + 1 || x.l < -1);
          return { sw: de.scrollWidth, bw: document.body.scrollWidth, cw: de.clientWidth, offs: offs.slice(0, 6), nOff: offs.length };
        }, { view, w });
        rec(`P ${w}px ${role}${view ? ' ' + view : ''}: no sideways scroll and every button on screen`, m.sw <= m.cw + 1 && m.nOff === 0, JSON.stringify(m));
        await t.close();
      }
    }
  }

  // Longer-than-sheet-name list name (if a list is ever renamed / imported with a long unspaced name): INFO only
  {
    const S0 = mk(phoneRows); S0.settings.lists[0].name = 'Apartment_12B_Block_C_Level_3_Kitchen_and_Utility_Revision_4';
    const S = makeServer(S0); const A = await dev(browser, S, 'saw', { viewport: { width: 360, height: 760 } });
    await tap(A.page, 'data-rna', 0);
    const m = await A.page.evaluate(() => { wlShowHold = true; render(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    info('P 360px saw WAITING tab with a 61-char unspaced list name: page width', JSON.stringify(m));
    await A.close();
  }

  // =============== 5. Sheet calculator edge cases (rule 2) ===============
  {
    const S = makeServer(mk(ROWS)); const A = await dev(browser, S);
    const r = await A.page.evaluate(() => {
      const L = { id: 'X', wb: 'WX', sheet: 'S', name: 'X', wos: ['WO-1'], saw: 1 };
      const run = rows => { DB.listWBs.WX = { sheets: { S: rows } }; return sheetNeed([L], '', ''); };
      const s = (L, W, qty, mat) => ({ k: 'saw', item: 'p', L, W, qty, mat: mat === undefined ? 'M' : mat });
      const o = {};
      o.zero = run([s(0, 600, 4), s(2400, 0, 4), s(0, 0, 1), s('0', '0', 1)]);
      o.blank = run([s('', '', 1), s(null, null, 1), s(undefined, undefined, 1), s(' ', ' ', 1)]);
      o.text = run([s('abc', 600, 1), s(2400, 'tbc', 1)]);
      // exact multiples of 5.75 m2 -> integer maths: ceil(k*11/10)
      o.mult = []; for (let k = 1; k <= 200; k++) { const r = run([s(5750, 1000, k)]); if (r.sheets !== Math.ceil(k * 11 / 10)) o.mult.push(k + ':' + r.sheets + '!=' + Math.ceil(k * 11 / 10)); }
      // same area built from many small lines (float sum)
      o.sum = []; for (let k = 1; k <= 60; k++) { const rows = []; for (let i = 0; i < k * 10; i++) rows.push(s(575, 1000, 1)); const r = run(rows); if (r.sheets !== Math.ceil(k * 11 / 10)) o.sum.push(k + ':' + r.sheets); }
      // Garry's worked example: 23 m2 -> 4 -> 4.4 -> 5
      o.ex23 = run([s(2300, 1000, 10)]).sheets;
      // per-material rounding, total = sum of per-material
      o.two = run([s(1000, 1000, 1, 'A'), s(1000, 1000, 1, 'B')]);
      o.panel = (() => { DB.listWBs.WX = { sheets: { S: [] } }; return sheetNeedBox('today', '', sheetNeed([L], '', '')); })();
      o.panelBad = (() => { DB.listWBs.WX = { sheets: { S: [s(0, 0, 1), s(2400, 600, '2x2'), s(2400, 600, '')] } }; return sheetNeedBox('today', '', sheetNeed([L], '', '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); })();
      o.consts = { m2: SHEET_M2, waste: SHEET_WASTE };
      return o;
    });
    rec('S constants are 5.75 m2 and 10%', r.consts.m2 === 5.75 && Math.abs(r.consts.waste - 0.1) < 1e-12, JSON.stringify(r.consts));
    rec('S 0 mm length/width (and "0") -> "no size", not counted, no crash', r.zero.noSize === 4 && r.zero.lines === 0 && r.zero.sheets === 0, JSON.stringify(r.zero));
    rec('S blank / null / spaces L and W -> "no size", 0 sheets', r.blank.noSize === 4 && r.blank.sheets === 0, JSON.stringify(r.blank));
    rec('S text sizes ("abc", "tbc") -> "no size"', r.text.noSize === 2 && r.text.sheets === 0, JSON.stringify(r.text));
    rec('S k x 5.75 m2 for k=1..200 -> exactly ceil(k x 1.1) sheets (no float round-up)', r.mult.length === 0, JSON.stringify(r.mult.slice(0, 10)));
    rec('S same areas built from many 0.575 m2 lines -> same answer (float sum safe)', r.sum.length === 0, JSON.stringify(r.sum.slice(0, 10)));
    rec('S worked example 23 m2 -> 5 sheets', r.ex23 === 5, String(r.ex23));
    rec('S 1 m2 of A + 1 m2 of B -> 1 + 1 = 2 sheets (rounded per material)', r.two.sheets === 2 && r.two.mats.length === 2, JSON.stringify(r.two));
    rec('S empty -> panel says "Nothing to cut"', /Nothing to cut/.test(r.panel));
    rec('S panel lists the not-counted lines (no size / no quantity / check quantity)', /1 line not counted — no size/.test(r.panelBad) && /1 line not counted — no quantity/.test(r.panelBad) && /1 line not counted — check quantity/.test(r.panelBad), r.panelBad);
    await A.close();
  }

  // =============== 6. Garry's three rules — re-confirm ===============
  {
    const S = makeServer(mk(ROWS)); const A = await dev(browser, S);
    await A.page.evaluate(() => { localStorage.removeItem('wpfOpName'); window.__prompts = 0; window.prompt = () => { window.__prompts++; return 'X'; }; render(); });
    const t = await tap(A.page, 'data-rna', 2);
    const r1 = await A.page.evaluate(() => ({ prompts: window.__prompts, ovl: !!document.querySelector('.pod-ovl'), held: heldRow(lists()[0], listRows(lists()[0]).map(rowKey)[2]), txt: /WAITING ON MATERIAL/.test(document.body.innerText), alerts: window.__alerts.length }));
    info('Rule 1 name prompt on first N/A of the shift (no saved name)', JSON.stringify(r1));
    rec('RULE 1: one tap on N/A -> line WAITING, no reason asked', t === 'ok' && r1.held && r1.txt && !r1.ovl, JSON.stringify(r1));
    await save(A.page);
    const P = await dev(browser, S, 'prod');
    const pv = await P.page.evaluate(() => /Oak — 1 row waiting/.test(document.body.innerText));
    await P.page.evaluate(() => document.querySelector('[data-relg]').click()); await save(P.page); await reload(A.page);
    const back = await A.page.evaluate(() => /MATERIAL IN — DO NOW/.test(document.body.innerText));
    rec('RULE 1: shows on Production view; Release all -> MATERIAL IN — DO NOW on the saw', pv && back, JSON.stringify({ pv, back }));
    const r2 = await A.page.evaluate(() => { const L = { id: 'X', wb: 'WX', sheet: 'S', name: 'X', wos: ['WO-1'], saw: 1 }; DB.listWBs.WX = { sheets: { S: [{ k: 'saw', item: 'p', L: 2440, W: 1220, qty: 7, mat: 'M' }] } }; return sheetNeed([L], '', '').sheets; });
    rec('RULE 2: 7 x 2440x1220 (20.84 m2) -> ceil(20.84/5.75*1.1)=4 sheets', r2 === Math.ceil(2.44 * 1.22 * 7 / 5.75 * 1.1), String(r2));
    // Rule 3: one screen + two devices simultaneous
    const one = await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).map(rowKey)[0]; const t = [...document.querySelectorAll('[data-rt]')].find(b => b.dataset.rt === 'L1|' + k), n = [...document.querySelectorAll('[data-rna]')].find(b => b.dataset.rna === 'L1|' + k); t.click(); n.click(); return { ticked: rowTicked('L1', k), held: heldRow(l, k) }; });
    rec('RULE 3 one screen: tick then stale N/A -> never both', !(one.ticked && one.held), JSON.stringify(one));
    await A.close(); await P.close();
    const S2 = makeServer(mk(ROWS)); const X = await dev(browser, S2), Y = await dev(browser, S2);
    await tap(X.page, 'data-rt', 1); await tap(Y.page, 'data-rna', 1);
    await Promise.all([save(X.page), save(Y.page)]); await save(X.page); await save(Y.page); await reload(X.page); await reload(Y.page);
    const x = await state(X.page, 1), y = await state(Y.page, 1);
    rec('RULE 3 two devices at once: both agree, never both got-out and waiting', x.ticked === y.ticked && x.held === y.held && !(x.ticked && x.held), JSON.stringify({ x, y }));
    await X.close(); await Y.close();
  }

  // =============== 7. attack-stale scenario 1 with robust saves (flake probe) ===============
  for (let n = 0; n < 4; n++) {
    const S = makeServer(mk(ROWS.slice(0, 3))); const A = await dev(browser, S), B = await dev(browser, S);
    await tap(B.page, 'data-rna', 0); await save(B.page);
    await tap(A.page, 'data-rt', 0); await save(A.page);
    await reload(A.page); await reload(B.page);
    await tap(A.page, 'data-rt', 0); await save(A.page);
    await tap(B.page, 'data-rna', 2); await save(B.page);
    await reload(A.page); await reload(B.page);
    const a = await state(A.page, 0), b = await state(B.page, 0), a2 = await state(A.page, 2);
    rec('T stale-screen merge (attack-stale #1, robust saves) run ' + (n + 1) + ': row 0 not resurrected, row 2 waiting', !a.held && !b.held && !a.ticked && !b.ticked && a2.held, JSON.stringify({ a, b, a2 }));
    await A.close(); await B.close();
  }

  rec('no page errors in any scenario', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} passed, ${f} failed`); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
