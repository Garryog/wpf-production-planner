// ATTACK 4 (Manager's ask) — tests/sawstores/retest-nov2.test.js checks ported to the lists switch ON (v2): combined
// quantities (odd qty, ticked/waiting/released lines left out, same-name houses, material spellings, HTML in qty),
// Release all (two screens at once, stale Production screen vs a new N/A, Release + cut at the same moment),
// 320/360 px phones, and the sheets panel calculator. Lists are seeded straight into the fake tables (srv3.js / fix3.js)
// — retest-nov2 itself can't run under v2hook.js (its set-up writes DB.listWBs). Fake Supabase only.
// Run: node tests/stage3/attack4-v2bench.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const L = F.line;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const ensureP = S => { if (!D.find(S.db, 'projects', 'P1')) { D.insert(S.db, 'projects', { id: 'P1', name: 'Proj' }); D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' }); } };
// one list straight into the tables: lines = [kind, part, qty, L, W, material, status?, extra?]
function seed(S, id, name, lines, wos) {
  ensureP(S);
  D.insert(S.db, 'lists', { id, project_id: 'P1', name, wos: wos || ['WO-1'], n_saw: lines.filter(x => x[0] === 'saw').length, n_fit: lines.filter(x => x[0] === 'fit').length, created_at: '2026-10-20T08:00:00.000Z' });
  lines.forEach((x, i) => D.insert(S.db, 'list_lines', Object.assign({ id: id + ':' + (i + 1), list_id: id, seq: i + 1, kind: x[0], part: x[1], qty: x[2], length_mm: x[3], width_mm: x[4], material: x[5], status: x[6] || 'todo' }, x[7] || {})));
}
const row = () => { const r = F.v2Row(); r.settings.lists = []; r.settings.listWBs = {}; return r; };
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); render(); });
const relg = (p, re) => p.evaluate(src => { const b = [...document.querySelectorAll('[data-relg]')].find(b => new RegExp(src, 'i').test(b.dataset.relg)); if (!b) return 'missing'; b.click(); return 'ok'; }, re);
(async () => {
  const browser = await H.chromium.launch();
  // =============== 1. Combined quantities ===============
  {
    const S = F.makeServer(row());
    const ODD = ['2 x 2', '2x2', '', '0', '-2', '1.5', '2.5', null, '3 off', '½', 'NaN', '1e2', '+3', '0x10', ' '];
    ODD.forEach((q, i) => { seed(S, 'QA' + i, 'H-A', [['saw', 'Side', q, 2400, 600, 'MFC White']]); seed(S, 'QB' + i, 'H-B', [['saw', 'Side', '4', 2400, 600, 'MFC White']]); });
    seed(S, 'GA', 'H-A', [['saw', 'Side', ' 3 ', 2400, 600, 'MFC White']]); seed(S, 'GB', 'H-B', [['saw', 'Side', '04', 2400, 600, 'MFC White']]);
    seed(S, 'BA', 'H-A', [['saw', 'Side', '2x2', 2400, 600, 'MFC White']]); seed(S, 'BB', 'H-B', [['saw', 'Side', '', 2400, 600, 'MFC White']]);
    seed(S, 'IA', 'H-A', [['saw', 'Side', '2 x 2', 2400, 600, 'MFC White'], ['saw', 'Top', '<img src=x onerror=window.__pwn=1>', 1200, 600, 'MFC White']]);
    seed(S, 'IB', 'H-B', [['saw', 'Side', '4', 2400, 600, 'MFC White'], ['saw', 'Top', '2', 1200, 600, 'MFC White']]);
    const saw = await F.dev(browser, S, 'saw');
    const c = await saw.page.evaluate(n => {
      const g = ids => lists().filter(l => ids.includes(l.id));
      const run = ids => combineLists(g(ids), 'saw').map(x => ({ item: x.item, qty: x.qty, bad: x.bad, per: x.per }));
      const o = { odd: [] }; for (let i = 0; i < n; i++) o.odd.push(run(['QA' + i, 'QB' + i]));
      o.good = run(['GA', 'GB']); o.bothBad = run(['BA', 'BB']);
      return o;
    }, ODD.length);
    const badOK = c.odd.map((v, i) => { const x = v[0] || {}; return { q: ODD[i], ok: x.qty === 4 && x.bad === 1 && typeof (x.per || {})['H-A'] === 'string' && (x.per || {})['H-B'] === 4, x }; });
    rec('C1 [v2] every odd qty text is left out of the total, counted as "not added", shown as typed', badOK.every(x => x.ok), JSON.stringify(badOK.filter(x => !x.ok)).slice(0, 400));
    const z = c.odd[ODD.indexOf('0')][0] || {}, bl = c.odd[ODD.indexOf('')][0] || {}, sp = c.odd[ODD.indexOf(' ')][0] || {};
    rec('C1 [v2] qty "0" shown as "0", blank and " " shown as "no qty"', (z.per || {})['H-A'] === '0' && (bl.per || {})['H-A'] === 'no qty' && (sp.per || {})['H-A'] === 'no qty', JSON.stringify([z.per, bl.per, sp.per]));
    rec('C1 [v2] " 3 " and "04" count as 3 and 4 (total 7)', c.good[0] && c.good[0].qty === 7 && c.good[0].bad === 0, JSON.stringify(c.good));
    rec('C1 [v2] both houses odd → total 0, 2 not added', c.bothBad[0] && c.bothBad[0].qty === 0 && c.bothBad[0].bad === 2, JSON.stringify(c.bothBad));
    const ui = await saw.page.evaluate(() => {
      openCombined(lists().filter(l => ['IA', 'IB'].includes(l.id)), 'saw');
      const ov = document.querySelector('.pod-ovl'); const t = ov ? ov.innerText : '';
      const chips = ov ? [...ov.querySelectorAll('.ph-chip')].map(x => x.innerText) : [];
      window.__opened = []; const lb2 = ov && ov.querySelector('#cmb-lbl'); if (lb2) lb2.click();
      const lab = (window.__opened || []).slice(-1)[0] || ''; if (ov) ov.remove();
      return { warn: (t.match(/\+ \d+ not added — check quantity/g) || []).length, chips, injected: !!document.querySelector('.pod-ovl img') || window.__pwn === 1, leftOut: /Lines already ticked cut are left out/.test(t), labHasImg: /<img src=x/.test(lab) };
    });
    await F.sleep(100);
    rec('C1 [v2] panel shows "+ 1 not added — check quantity" on both odd rows', ui.warn === 2, JSON.stringify(ui));
    rec('C1 [v2] chip "H-A ×2 x 2 ⚠ check quantity"', ui.chips.some(x => /H-A ×2 x 2/.test(x) && /check quantity/.test(x)), JSON.stringify(ui.chips));
    rec('C1 [v2] qty with <img onerror> escaped in panel and labels', !ui.injected && !ui.labHasImg && !(await saw.page.evaluate(() => window.__pwn === 1)), JSON.stringify(ui));
    rec('C1 [v2] panel says ticked lines are left out', ui.leftOut, JSON.stringify(ui));
    rec('C9 no page errors (combined)', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close();
  }
  // C2: ticked / waiting / released lines, via the line statuses in the tables
  {
    const S = F.makeServer(row());
    seed(S, 'TA', 'H-A', [['saw', 'Side', '4', 2400, 600, 'MFC White'], ['saw', 'Top', '2', 1200, 600, 'MFC White']]);
    seed(S, 'TB', 'H-B', [['saw', 'Side', '4', 2400, 600, 'MFC White'], ['saw', 'Top', '2', 1200, 600, 'MFC White']]);
    const saw = await F.dev(browser, S, 'saw');
    const tot = () => saw.page.evaluate(() => combineLists(lists().filter(l => ['TA', 'TB'].includes(l.id)), 'saw').map(x => x.item + ':' + x.qty).sort().join(','));
    const set = async (id, patch) => { D.update(S.db, 'list_lines', L(S, id), patch); await reload(saw.page); };
    const o = {};
    o.none = await tot();
    await F.tapRow(saw.page, 'data-rt', 'TA:1'); await F.send(saw.page); o.tickA = await tot();
    await F.tapRow(saw.page, 'data-rt', 'TA:1'); await F.send(saw.page); o.untick = await tot();
    await F.tapRow(saw.page, 'data-rna', 'TB:2'); await F.send(saw.page); o.waiting = await tot();
    await set('TB:2', { status: 'cut', released_at: '2026-10-21T08:00:00Z', released_by: 'PM' }); o.relTicked = await tot();
    await set('TB:2', { status: 'todo' }); o.relOpen = await tot();
    for (const id of ['TA:1', 'TA:2', 'TB:1', 'TB:2']) D.update(S.db, 'list_lines', L(S, id), { status: 'cut' }); await reload(saw.page); o.allCut = await tot();
    for (const id of ['TA:1', 'TA:2', 'TB:1', 'TB:2']) D.update(S.db, 'list_lines', L(S, id), { status: 'na' }); await reload(saw.page); o.allNa = await tot();
    rec('C2 [v2] nothing ticked: Side 8, Top 4', o.none === 'Side:8,Top:4', o.none);
    rec('C2 [v2] H-A Side ticked → Side 4; untick → back to 8', o.tickA === 'Side:4,Top:4' && o.untick === 'Side:8,Top:4', JSON.stringify(o));
    rec('C2 [v2] a WAITING line is left out', o.waiting === 'Side:8,Top:2', o.waiting);
    rec('C2 [v2] released + cut left out; released + not cut counted', o.relTicked === 'Side:8,Top:2' && o.relOpen === 'Side:8,Top:4', JSON.stringify(o));
    rec('C2 [v2] every line cut → empty combined list', o.allCut === '', JSON.stringify(o.allCut));
    rec('C2 [v2] every line "not needed" (na) → empty combined list', o.allNa === '', JSON.stringify(o.allNa));
    await saw.close();
  }
  // C3 / C4: same-name houses; material spellings
  {
    const S = F.makeServer(row());
    seed(S, 'DA', 'House 1', [['saw', 'Side', '4', 2400, 600, 'MFC White']]); seed(S, 'DB', 'House 1', [['saw', 'Side', '2', 2400, 600, 'MFC White']]);
    const mats = ['MFC White', 'MFC  White', 'MFC White', 'Lamé Oak', 'Lamé Oak'];
    mats.forEach((m, i) => seed(S, 'MM' + i, 'H' + i, [['saw', 'Side', '2', 2400, 600, m]]));
    const saw = await F.dev(browser, S, 'saw');
    const r = await saw.page.evaluate(() => ({ dup: combineLists(lists().filter(l => ['DA', 'DB'].includes(l.id)), 'saw').map(x => ({ qty: x.qty, per: x.per })),
      mk: combineLists(lists().filter(l => /^MM/.test(l.id)), 'saw').map(x => JSON.stringify(x.mat) + ':' + x.qty),
      sheets: sheetNeed(lists().filter(l => /^MM/.test(l.id)), '', '').mats.map(x => x.mat) }));
    rec('C3 [v2] (Low, known in v1) two selected houses with the same name keep separate per-house quantities', r.dup[0] && Object.keys(r.dup[0].per).length === 2, JSON.stringify(r.dup));
    rec('C4 [v2] combined list merges "MFC  White"/NBSP with "MFC White" and NFD/NFC "Lamé Oak" → 2 rows', r.mk.length === 2, JSON.stringify(r.mk));
    info('C4 [v2] sheets panel groups for the same 5 spellings', JSON.stringify(r.sheets));
    await saw.close();
  }
  // =============== 2. Release all ===============
  const ROWS = [['saw', 'Side', '4', 2400, 600, 'MFC White'], ['saw', 'Top', '2', 1200, 600, 'MFC White'], ['saw', 'Back', '1', 900, 700, 'Oak'], ['saw', 'Shelf', '3', 800, 300, 'mfc white ']];
  { // R2c two Production screens Release all MFC White at once
    const S = F.makeServer(row()); seed(S, 'L1', 'House 1', ROWS);
    const saw = await F.dev(browser, S, 'saw');
    for (const id of ['L1:1', 'L1:2', 'L1:4']) await F.tapRow(saw.page, 'data-rna', id); await F.send(saw.page);
    const P = await F.dev(browser, S, 'prod'), Q = await F.dev(browser, S, 'prod');
    const c1 = await relg(P.page, '^mfc white$'), c2 = await relg(Q.page, '^mfc white$');
    await Promise.all([F.send(P.page), F.send(Q.page)]); await F.sleep(300); await F.send(P.page); await F.send(Q.page);
    const st = ['L1:1', 'L1:2', 'L1:4'].map(id => L(S, id).status + (L(S, id).released_at ? '+rel' : ''));
    rec('R2c [v2] two Production screens Release all MFC White at once → all 3 released, none stuck', c1 === 'ok' && c2 === 'ok' && st.every(s => s === 'todo+rel'), JSON.stringify({ c1, c2, st }));
    const msgs = await Q.page.evaluate(() => LQ.msgs.slice());
    info('R2c [v2] what the second screen was told', JSON.stringify(msgs));
    await reload(saw.page);
    const vis = await saw.page.evaluate(() => ({ doNow: (document.body.innerText.match(/MATERIAL IN — DO NOW/g) || []).length, wait: allHolds(['saw'], 'hold').length }));
    rec('R2c [v2] saw sees 3 MATERIAL IN — DO NOW, 0 waiting', vis.doNow === 3 && vis.wait === 0, JSON.stringify(vis));
    await saw.close(); await P.close(); await Q.close();
  }
  { // R2d stale Production screen Release all while the saw N/As ANOTHER MFC White line
    const S = F.makeServer(row()); seed(S, 'L1', 'House 1', ROWS);
    const saw = await F.dev(browser, S, 'saw');
    await F.tapRow(saw.page, 'data-rna', 'L1:1'); await F.send(saw.page);
    const P = await F.dev(browser, S, 'prod');
    await P.page.evaluate(() => { clearInterval(LST.timer); LST.timer = null; }); // P doesn't poll: stale
    await F.tapRow(saw.page, 'data-rna', 'L1:2'); await F.send(saw.page); // Top waiting now (P doesn't know)
    const c = await relg(P.page, '^mfc white$'); await F.send(P.page);
    await reload(saw.page); await reload(P.page);
    rec('R2d [v2] stale Production Release all + a new N/A from the saw → Side released, the new Top N/A still WAITING', c === 'ok' && L(S, 'L1:1').status === 'todo' && !!L(S, 'L1:1').released_at && L(S, 'L1:2').status === 'waiting',
      JSON.stringify({ c, side: L(S, 'L1:1').status, top: L(S, 'L1:2').status }));
    const pv = await P.page.evaluate(() => allHolds(['saw'], 'hold').length);
    rec('R2d [v2] Production view after refresh shows Top still waiting', pv === 1, String(pv));
    // a Release all QUEUED offline on another Production screen arrives after: release (online) + the saw N/As the line again
    await F.tapRow(saw.page, 'data-rna', 'L1:4'); await F.send(saw.page); // Shelf waiting
    const P2 = await F.dev(browser, S, 'prod'); await P2.page.evaluate(() => { clearInterval(LST.timer); LST.timer = null; });
    S.offline3 = true; const c2 = await relg(P2.page, '^mfc white$'); await P2.page.evaluate(async () => { await lqSend(); }); S.offline3 = false; // queued on P2
    await reload(P.page); await relg(P.page, '^mfc white$'); await F.send(P.page); // released online
    const mid = L(S, 'L1:4').status + (L(S, 'L1:4').released_at ? '+rel' : '');
    await reload(saw.page); const tn = await F.tapRow(saw.page, 'data-rna', 'L1:4'); await F.send(saw.page); // board ran out again: N/A
    const before = L(S, 'L1:4').status;
    await P2.page.evaluate(async () => { await lqSend(); }); // the old Release all arrives late
    rec('R2d2 [v2] an offline Production Release all that arrives late does not release a line N/A\'d again since', before === 'waiting' && L(S, 'L1:4').status === 'waiting',
      JSON.stringify({ c2, mid, tn, before, after: L(S, 'L1:4').status, p2msgs: await P2.page.evaluate(() => LQ.msgs.slice(-2)) }) + ' events=' + S.db.t.list_events.filter(e => e.line_id === 'L1:4').map(e => e.act + '>' + e.to_status).join(','));
    await saw.close(); await P.close(); await P2.close();
  }
  { // R2e Release and cut of the same line at the same moment
    const S = F.makeServer(row()); seed(S, 'L1', 'House 1', ROWS.slice(0, 3));
    const saw = await F.dev(browser, S, 'saw');
    await F.tapRow(saw.page, 'data-rna', 'L1:2'); await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.send(saw.page); // Top waiting, Side cut
    const P = await F.dev(browser, S, 'prod');
    S.hold3 = new Promise(r => setTimeout(r, 400));
    const taps = [await F.tapRow(saw.page, 'data-rna', 'L1:2'), await F.tapRow(saw.page, 'data-rt', 'L1:2'), await F.tapRow(saw.page, 'data-rt', 'L1:3')];
    await relg(P.page, '.');
    await Promise.all([F.send(saw.page), F.send(P.page)]); S.hold3 = null; await F.send(saw.page); await F.send(P.page);
    await reload(saw.page); await reload(P.page);
    const q = await saw.page.evaluate(() => { const l = lists().find(x => x.id === 'L1'); const todo = document.querySelector('.wl-card:not(.cdone)');
      wlShowDone = true; render(); const doneTxt = document.body.innerText; wlShowDone = false; render();
      window.__opened = []; printWorkList('saw', 1); const pr = (window.__opened || []).slice(-1)[0] || '';
      return { side: sideState(l, 'saw'), onQueue: !!todo, doneShowsDoNow: /MATERIAL IN — DO NOW/.test(doneTxt), printed: /House 1/.test(pr) }; });
    rec('R2e [v2] simultaneous Release + cut: Top stays cut, list done, off the queue, not in Print today', taps.every(x => x === 'ok') && L(S, 'L1:2').status === 'cut' && q.side === 'done' && !q.onQueue && !q.printed, JSON.stringify({ taps, top: L(S, 'L1:2').status, q }));
    rec('R2e [v2] finished line not labelled "MATERIAL IN — DO NOW" on Done', !q.doneShowsDoNow, JSON.stringify(q));
    rec('R2e [v2] Production view: nothing waiting', (await P.page.evaluate(() => allHolds(['saw'], 'hold').length)) === 0);
    rec('R9 no page errors (release)', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await P.close();
  }
  // =============== 3. Phones 320 / 360 ===============
  {
    const LONG = 'EGGER_H1145_ST10_NATURAL_BARDOLINO_OAK_18MM_MFC_2800x2070_CUSTOMER_SUPPLIED';
    const LONGSP = 'Egger H1145 ST10 Natural Bardolino Oak 18mm MFC customer supplied board';
    const S = F.makeServer(row());
    seed(S, 'L1', 'BLOCK_C_APT_12B_LEVEL3_KITCHEN1', [['saw', 'Side panel left hand tall housing ' + LONG, '2', 2400, 600, LONG, 'waiting', { note: 'ABS 2mm 4 sides ' + LONGSP, edging: LONGSP }],
      ['saw', 'Top', '1', 900, 600, LONGSP, 'waiting'], ['saw', 'Back', '1', 900, 600, 'Oak'], ['fit', 'Hinge ' + LONG, '10', null, null, LONGSP, 'waiting'], ['fit', 'Handle', '4', null, null, 'Brushed steel']]);
    for (const w of [320, 360]) for (const [role, view] of [['saw', 'todo'], ['saw', 'hold'], ['stores', 'todo'], ['stores', 'hold'], ['prod', ''], ['office', 'lists']]) {
      const t = await F.dev(browser, S, role, { viewport: { width: w, height: 760 } });
      const m = await t.page.evaluate(({ view, w }) => {
        if (view === 'hold') { wlShowHold = true; render(); }
        if (view === 'lists' && typeof setView === 'function') { try { setView('lists'); } catch (e) {} }
        const de = document.documentElement;
        const offs = [...document.querySelectorAll('button, [data-rt], [data-rna], [data-rel1], [data-relg], input, select')].filter(b => b.offsetParent !== null && !b.closest('.rovl')).map(b => ({ t: (b.innerText || '').slice(0, 24), r: Math.round(b.getBoundingClientRect().right), l: Math.round(b.getBoundingClientRect().left) })).filter(x => x.r > w + 1 || x.l < -1);
        return { sw: de.scrollWidth, cw: de.clientWidth, offs: offs.slice(0, 5), nOff: offs.length };
      }, { view, w });
      const strict = role !== 'office';
      if (strict) rec(`P [v2] ${w}px ${role} ${view}: no sideways scroll, every button on screen`, m.sw <= m.cw + 1 && m.nOff === 0, JSON.stringify(m));
      else info(`P [v2] ${w}px office board (not a phone view)`, JSON.stringify(m));
      await t.close();
    }
  }
  { // INFO (as in v1): a 61-char unspaced list name on the WAITING tab
    const S = F.makeServer(row());
    seed(S, 'L2', 'Apartment_12B_Block_C_Level_3_Kitchen_and_Utility_Revision_4', [['saw', 'Gable', '2', 900, 560, 'MFC White', 'waiting'], ['saw', 'Plinth', '1', 2400, 150, 'MFC White']]);
    const t = await F.dev(browser, S, 'saw', { viewport: { width: 360, height: 760 } });
    const m = await t.page.evaluate(() => { wlShowHold = true; render(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    info('P [v2] 360px saw WAITING tab with a 61-char unspaced list name: page width', JSON.stringify(m));
    await t.close();
  }
  // =============== 4. Sheets panel ===============
  {
    const S = F.makeServer(row());
    seed(S, 'X', 'X', [['saw', 'p', '1', 5750, 1000, 'M']]);
    seed(S, 'Z', 'Z', [['saw', 'p', '4', 0, 600, 'M'], ['saw', 'p', '4', 2400, 0, 'M'], ['saw', 'p', '1', 0, 0, 'M'], ['saw', 'p', '1', null, null, 'M']]);
    seed(S, 'T2', 'T2', [['saw', 'p', '1', 1000, 1000, 'A'], ['saw', 'p', '1', 1000, 1000, 'B']]);
    seed(S, 'E', 'E', [['fit', 'Hinge', '4', null, null, 'Blum']]);
    seed(S, 'PB', 'PB', [['saw', 'p', '1', 0, 0, 'M'], ['saw', 'p', '2x2', 2400, 600, 'M'], ['saw', 'p', '', 2400, 600, 'M']]);
    seed(S, 'W', 'W', [['saw', 'p', '10', 2300, 1000, 'M']]);
    seed(S, 'NB', 'NB', [['saw', 'a', '1', 5750, 1000, 'MFC White'], ['saw', 'b', '1', 5750, 1000, 'MFC White'], ['saw', 'c', '1', 5750, 1000, ' mfc  white ']]);
    const saw = await F.dev(browser, S, 'saw');
    const r = await saw.page.evaluate(() => {
      const g = id => lists().filter(l => l.id === id), o = {};
      o.mult = []; for (let k = 1; k <= 200; k++) { lsPut('list_lines', [{ ...LST.ln.get('X:1'), qty: String(k), version: 1000 + k }]); const r = sheetNeed(g('X'), '', ''); if (r.sheets !== Math.ceil(k * 11 / 10)) o.mult.push(k + ':' + r.sheets); }
      o.zero = sheetNeed(g('Z'), '', ''); o.two = sheetNeed(g('T2'), '', ''); o.ex23 = sheetNeed(g('W'), '', '').sheets;
      o.panel = sheetNeedBox('today', '', sheetNeed(g('E'), '', '')).replace(/<[^>]+>/g, ' ');
      o.panelBad = sheetNeedBox('today', '', sheetNeed(g('PB'), '', '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      o.nb = sheetNeed(g('NB'), '', '').mats.map(m => m.mat + ':' + m.sheets);
      return o;
    });
    rec('S [v2] k × 5.75 m² for k=1..200 → exactly ceil(k × 1.1) sheets', r.mult.length === 0, JSON.stringify(r.mult.slice(0, 10)));
    rec('S [v2] 0 / null sizes → "no size", 0 sheets, no crash', r.zero.noSize === 4 && r.zero.sheets === 0, JSON.stringify(r.zero));
    rec('S [v2] 23 m² → 5 sheets', r.ex23 === 5, String(r.ex23));
    rec('S [v2] 1 m² of A + 1 m² of B → 2 sheets (rounded per material)', r.two.sheets === 2 && r.two.mats.length === 2, JSON.stringify(r.two));
    rec('S [v2] no saw lines → panel says "Nothing to cut"', /Nothing to cut/.test(r.panel), r.panel.slice(0, 120));
    rec('S [v2] panel lists the not-counted lines (no size / no quantity / check quantity)', /1 line not counted — no size/.test(r.panelBad) && /1 line not counted — no quantity/.test(r.panelBad) && /1 line not counted — check quantity/.test(r.panelBad), r.panelBad);
    rec('S [v2] "MFC White" / NBSP / " mfc  white " → one material, 3 × 5.75 m² → 4 sheets', r.nb.length === 1 && /:4$/.test(r.nb[0]), JSON.stringify(r.nb));
    rec('S9 no page errors (sheets)', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
