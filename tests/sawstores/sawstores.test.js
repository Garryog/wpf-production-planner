// Saw/Stores simplify (steps 1–3): sheetNeed maths, N/A box, openHold, two-device clash. Stubbed Supabase only.
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-21T09:00:00Z'; // Wednesday
const ROWS = [
  { k: 'hdr', item: 'Kitchen', note: '' },
  { k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Top', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: 'ABS' },
  { k: 'saw', item: 'Shelf', qty: 2, L: 800, W: '', mat: 'MFC White', note: '' },
  { k: 'fit', item: 'Hinge', qty: 10, mat: 'Blum', note: '' },
];
const row = (due = '2026-10-22') => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: due, origDueDate: due })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 3, fit: 1, wos: ['WO-1'], up: NOW }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: ROWS } } } } });
const keys = 'listRows(lists()[0]).filter(r=>r.k!=="hdr").map(rowKey)';
const click = (page, attr, i) => page.evaluate(({ attr, i }) => { const k = listRows(lists()[0]).filter(r => r.k !== 'hdr').map(rowKey)[i]; const b = [...document.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr) === 'L1|' + k); if (!b) return 'missing'; b.click(); return b.disabled ? 'disabled' : 'ok'; }, { attr, i });
(async () => {
  const browser = await H.chromium.launch();
  { // ---- sheetNeed unit tests
    const S = makeServer(row());
    const A = await open(browser, S, { now: NOW });
    const r = await A.page.evaluate(() => { const t = todayLocal(); return sheetNeed(lists(), '', t, { cutSince: t }); });
    const w = r.mats.find(m => m.mat === 'MFC White') || {};
    rec('2 lines 2400×600 ×4 → 11.52 m² → 3 sheets', w.m2 === 11.52 && w.sheets === 3, JSON.stringify(r));
    rec('missing width → 1 line not counted', r.noSize === 1);
    const r2 = await A.page.evaluate(k => { const l = lists()[0]; holdRows(l, [k], 'saw', 'T'); const t = todayLocal(); const o = sheetNeed(lists(), '', t, { cutSince: t }); delete DB.listHold; return o; }, await A.page.evaluate(keys + '[0]'));
    rec('held line excluded (5.76 m² → 2 sheets)', r2.mats[0].m2 === 5.76 && r2.mats[0].sheets === 2, JSON.stringify(r2.mats));
    const r3 = await A.page.evaluate(() => { const l = lists()[0], k = listRows(l).filter(r => r.k === 'saw').map(rowKey); setRowTick(l, k[0], 'saw', 'T', true); const t = todayLocal(); const a = sheetNeed(lists(), '', t, { cutSince: t }).mats[0].m2; DB.listRow.L1[k[0]].at = '2026-10-19T10:00:00Z'; const b = sheetNeed(lists(), '', t, { cutSince: t }).mats[0].m2; delete DB.listRow; return { a, b }; });
    rec('line cut today still counts; cut on an earlier day does not', r3.a === 11.52 && r3.b === 5.76, JSON.stringify(r3));
    const r4 = await A.page.evaluate(() => { const rows = DB.listWBs.W1.sheets.H1; const save = JSON.stringify(rows); rows.push({ k: 'saw', item: 'X', qty: 1, L: 2.4, W: 600, mat: '' }); rows.push({ k: 'saw', item: 'Y', qty: 1, L: 1000, W: 500, mat: 'mfc white' }); const t = todayLocal(); const o = sheetNeed(lists(), '', t, { cutSince: t }); DB.listWBs.W1.sheets.H1 = JSON.parse(save); return o; });
    const nm = r4.mats.find(m => m.mat === '(no material)') || {};
    rec('no material → "(no material)" + dim < 10 flags check units', nm.check === true && nm.lines === 1, JSON.stringify(r4.mats));
    rec('material grouped ignoring case', r4.mats.filter(m => /mfc white/i.test(m.mat)).length === 1 && r4.mats.find(m => m.mat === 'MFC White').m2 === 12.02, JSON.stringify(r4.mats));
    const wd = await A.page.evaluate(() => [nextWorkDay('2026-10-30'), nextWorkDay('2026-10-31'), nextWorkDay('2026-11-01'), nextWorkDay('2026-10-21'), nextWorkDay('2026-10-23'), nextWorkDay('2026-12-24'), nextWorkDay('2026-12-31')]);
    rec('next working day: Fri→Mon, Sat→Mon, Sun→Mon, Wed→Thu; bank hols: Fri 23 Oct→Tue 27, Xmas Eve→Tue 29 Dec, 31 Dec→Mon 4 Jan', wd.join() === '2026-11-02,2026-11-02,2026-11-02,2026-10-22,2026-10-27,2026-12-29,2027-01-04', wd.join());
    const r5 = await A.page.evaluate(() => sheetNeed(lists(), '2026-10-22', '2026-10-30').lines);
    rec('outside the date range → nothing', r5 === 0);
    await A.close();
  }
  { // ---- Friday 30 Oct: Monday-delivery work (cut-by Sun) is today's; Tuesday-delivery (cut-by Mon) is next working day
    const r = row('2026-11-02'); r.orders.push(H.order({ wo: 'WO-2', dueDate: '2026-11-03', origDueDate: '2026-11-03' }));
    r.settings.lists.push({ id: 'L2', wb: 'W1', sheet: 'H1', name: 'House 2', project: 'Proj', saw: 3, fit: 1, wos: ['WO-2'], up: NOW });
    const S = makeServer(r);
    const A = await open(browser, S, { now: '2026-10-30T09:00:00Z', role: 'saw' });
    const box = () => A.page.evaluate(() => [...document.querySelectorAll('.sn-box')].map(b => b.innerText.replace(/\s+/g, ' ')));
    const b = await box();
    rec('Friday: today = Mon-delivery house (3 sheets), next working day Mon 2 Nov = Tue-delivery house (3 sheets)', /today/.test(b[0]) && /3 sheets MFC White 11\.52/.test(b[0]) && /Mon, 2 Nov/.test(b[1]) && /3 sheets MFC White 11\.52/.test(b[1]), JSON.stringify(b));
    rec('panel shows on Saw TO DO with warnings', /Sheets needed — today/.test(b[0]) && /1 line not counted — no size/.test(b[0]), b[0]);
    await A.page.evaluate(() => { localStorage.setItem('wpfPin_stores', '9000'); setRole('stores'); });
    rec('no panel on Stores', !/Sheets needed/.test(await A.page.evaluate(() => document.getElementById('app').innerText)));
    await A.close();
  }
  { // ---- Bank holiday: Fri 23 Oct, job delivers Tue 27 (cut-by Mon 26 = bank holiday) → shows under today
    const S = makeServer(row('2026-10-27'));
    const A = await open(browser, S, { now: '2026-10-23T09:00:00Z', role: 'saw' });
    const b = await A.page.evaluate(() => [...document.querySelectorAll('.sn-box')].map(b => b.innerText.replace(/\s+/g, ' ')));
    rec('bank-holiday Monday cut-by → today on Friday; next working day is Tue 27', /3 sheets/.test(b[0]) && /Tue, 27 Oct/.test(b[1]) && /Nothing to cut/.test(b[1]), JSON.stringify(b));
    await A.close();
  }
  { // ---- N/A box + tick exclusivity + openHold (Saw) and N/A on Stores
    const S = makeServer(row());
    const A = await open(browser, S, { now: NOW, role: 'saw' });
    await A.page.evaluate(() => localStorage.removeItem('wpfOpName')); // first time on this device → asks for a name (prompt stub = 'Tester')
    rec('N/A box on each saw line', await A.page.evaluate(() => document.querySelectorAll('[data-rna]').length) === 3);
    rec('N/A tap', (await click(A.page, 'data-rna', 0)) === 'ok');
    let st = await A.page.evaluate(k => ({ held: heldRow(lists()[0], k), by: holdsOf('L1')[k] && holdsOf('L1')[k].by, log: DB.holdLog.slice(-1)[0], tick: [...document.querySelectorAll('[data-rt]')].some(b => b.dataset.rt === 'L1|' + k), name: localStorage.getItem('wpfOpName'), waiting: document.getElementById('wl-tab-hold').innerText }), await A.page.evaluate(keys + '[0]'));
    rec('N/A parks line in WAITING, asks name once, logged, tick hidden', st.held && st.by === 'Tester' && st.log.act === 'hold' && st.log.n === 1 && !st.tick && st.name === 'Tester' && /WAITING — 1/.test(st.waiting), JSON.stringify(st));
    await A.page.evaluate(() => { window.prompt = () => { window.__asked = 1; return 'X'; }; });
    await click(A.page, 'data-rna', 0);
    st = await A.page.evaluate(k => ({ held: heldRow(lists()[0], k), log: DB.holdLog.slice(-1)[0], asked: !!window.__asked, tick: [...document.querySelectorAll('[data-rt]')].some(b => b.dataset.rt === 'L1|' + k) }), await A.page.evaluate(keys + '[0]'));
    rec('tap again undoes (logged, no name prompt), tick back', !st.held && st.log.act === 'unhold' && st.log.by === 'Tester' && !st.asked && st.tick, JSON.stringify(st));
    await click(A.page, 'data-rt', 1);
    rec('ticked line: N/A greyed and does nothing', (await click(A.page, 'data-rna', 1)) === 'disabled' && await A.page.evaluate(k => !holdsOf('L1')[k] && rowTicked('L1', k), await A.page.evaluate(keys + '[1]')));
    await A.page.evaluate(() => document.querySelector('[data-wlhold="L1"]').click());
    const pop = await A.page.evaluate(() => [...document.querySelectorAll('[data-hk]')].map(c => c.dataset.hk));
    const ks = await A.page.evaluate(keys);
    rec('"Material not in" pop-up excludes ticked line', pop.length === 2 && !pop.includes(ks[1]) && pop.includes(ks[0]), JSON.stringify(pop));
    await A.page.evaluate(() => document.querySelector('.pod-ovl').remove());
    // setRowTick clears a hold (e.g. batch / other path)
    const cl = await A.page.evaluate(k => { const l = lists()[0]; holdRows(l, [k], 'saw', 'T'); setRowTick(l, k, 'saw', 'T', true); return { h: !!holdsOf('L1')[k], log: DB.holdLog.slice(-1)[0].act }; }, ks[2]);
    rec('ticking a line clears its hold (logged)', !cl.h && cl.log === 'cut', JSON.stringify(cl));
    await A.page.evaluate(() => { localStorage.setItem('wpfPin_stores', '9000'); setRole('stores'); });
    rec('N/A box on Stores lines', await A.page.evaluate(() => document.querySelectorAll('[data-rna]').length) === 1 && (await click(A.page, 'data-rna', 3)) === 'ok' && await A.page.evaluate(k => heldRow(lists()[0], k), ks[3]));
    rec('no page errors', !(S.errors || []).length && !(A.server.errors || []).length, JSON.stringify(A.server.errors || []));
    await A.close();
  }
  { // ---- two devices: A ticks (got out) while B taps N/A on the same line → done, not waiting
    const S = makeServer(row());
    const A = await open(browser, S, { now: NOW, role: 'saw' }), B = await open(browser, S, { now: NOW, role: 'saw' });
    for (const t of [A, B]) await t.page.evaluate(() => localStorage.setItem('wpfOpName', 'Op'));
    await A.page.evaluate(() => render()); await B.page.evaluate(() => render());
    await click(A.page, 'data-rt', 0); await A.page.evaluate(async () => { await saveDB(); });
    await click(B.page, 'data-rna', 0); await B.page.evaluate(async () => { await saveDB(); });
    await A.page.evaluate(async () => { await loadDB(); render(); });
    const k = await A.page.evaluate(keys + '[0]');
    const both = !!(S.row.settings.listRow && S.row.settings.listRow.L1 && S.row.settings.listRow.L1[k]) && !!(S.row.settings.listHold && S.row.settings.listHold.L1 && S.row.settings.listHold.L1[k]);
    for (const [n, t] of [['A', A], ['B', B]]) {
      if (n === 'B') await B.page.evaluate(async () => { await loadDB(); render(); });
      const o = await t.page.evaluate(k => ({ held: heldRow(lists()[0], k), waitN: allHolds(['saw'], 'hold').length, side: sideState(lists()[0], 'saw'), tab: document.getElementById('wl-tab-hold').innerText, ticked: rowTicked('L1', k), struck: !![...document.querySelectorAll('[data-rt]')].find(b => b.dataset.rt === 'L1|' + k && b.closest('tr').classList.contains('wl-rdone')) }), k);
      rec('clash on ' + n + ': got-out wins → done, not waiting' + (both ? ' (server holds both tick + hold)' : ''), !o.held && o.waitN === 0 && o.side === 'open' && /WAITING — 0/.test(o.tab) && o.ticked && o.struck, JSON.stringify(o));
    }
    await A.close(); await B.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
