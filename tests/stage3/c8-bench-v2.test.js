// Stage 3 C8: Plan B "What must NOT change", checked with the lists switch ON (v2): board readiness colours, the saw
// seeing tomorrow's lists, the sheets panel, WAITING / Release all, combined table, labels, Print today, released work
// after sign-off. Fake Supabase only. Run: node tests/stage3/c8-bench-v2.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const L = F.line;
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row(); // NOW Wed 21 Oct; WO-1 and WO-2 deliver Thu 22 (cut by today)
  row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', unit: '3', dueDate: '2026-10-23', origDueDate: '2026-10-23' })); // cut by tomorrow
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: [['saw', 'Side', '4', 2400, 600, 'MFC White', '1mm', ''], ['saw', 'Top', '4', 2400, 600, 'mfc white ', '', ''], ['saw', 'Back', '1', 900, 700, 'Oak', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum', '', '']] });
  F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'], lines: [['saw', 'Side', '4', 2400, 600, 'MFC White', '1mm', ''], ['saw', 'Shelf', '2x2', 560, 500, 'MFC White', '', '']] });
  F.seedList(S, 'L3', { name: 'House 3', wos: ['WO-3'], lines: [['saw', 'Gable', '2', 900, 560, 'MFC White', '', '']] });
  const saw = await F.dev(browser, S, 'saw');
  const off = await F.dev(browser, S, 'office');
  // sheets panel
  const sn = await saw.page.evaluate(() => { const t = todayLocal(); return sheetNeed(lists(), '', t, { cutSince: t }); });
  const mw = sn.mats.find(m => m.mat.toLowerCase() === 'mfc white');
  rec('sheets: MFC White grouped ignoring case/spaces, 3 lines × 5.76 m² = 17.28 m² → 4 sheets; "2x2" not counted', mw && mw.lines === 3 && mw.m2 === 17.28 && mw.sheets === 4 && sn.badQty === 1, JSON.stringify(sn));
  const panel = await saw.page.evaluate(() => (document.querySelector('.wl') || document.body).innerText);
  rec('sheets panel on the Saw TO DO screen', /MFC White/.test(panel) && /sheet/i.test(panel), panel.slice(0, 160));
  rec('the saw sees today\'s houses and tomorrow\'s on "Work ahead"', /House 1/.test(panel) && /House 2/.test(panel) && /1 list due on later days/.test(panel), panel.slice(0, 300));
  // readiness colours (board)
  const rd = () => off.page.evaluate(() => ['WO-1', 'WO-2', 'WO-3'].map(w => woReady(w).lvl).join());
  rec('board: every job red (not cut) at the start', (await rd()) === 'red,red,red', await rd());
  // N/A → WAITING → amber; held line out of the sheets
  await F.tapRow(saw.page, 'data-rna', 'L1:3'); await F.send(saw.page);
  const sn2 = await saw.page.evaluate(() => { const t = todayLocal(); return sheetNeed(lists(), '', t, { cutSince: t }).mats.map(m => m.mat).join(); });
  rec('N/A parks the Oak line: WAITING, out of the sheets panel', L(S, 'L1:3').status === 'waiting' && !/Oak/.test(sn2), sn2);
  // cut the rest of House 1 → amber (part waiting) on the board
  await saw.page.evaluate(() => { document.querySelector('[data-wldone="L1"]').click(); }); await F.send(saw.page);
  await off.page.evaluate(async () => { await lsPoll(); });
  rec('House 1 cut complete with a line waiting → board amber, "Saw waiting on material"', (await rd()).split(',')[0] === 'amber' && (await off.page.evaluate(() => woReady('WO-1').why.join())) .includes('waiting'), await rd());
  // combined table + labels + print today
  const cmb = await saw.page.evaluate(() => combineLists(lists().filter(l => ['L1', 'L2'].includes(l.id)), 'saw').map(r => r.item + ':' + r.qty + (r.bad ? '+bad' : '')).join(','));
  rec('combined table: cut lines and the waiting line left out; "2x2" shown as not added', cmb === 'Side:4,Shelf:0+bad', cmb);
  await saw.page.evaluate(() => { window.__opened = []; printLabels([lists().find(l => l.id === 'L2')], 'saw'); printWorkList('saw', 1); });
  const pr = await saw.page.evaluate(() => window.__opened.join('\n'));
  const prt = await saw.page.evaluate(() => window.__opened[window.__opened.length - 1]);
  rec('labels print for each line of House 2; Print today has House 2, not the signed-off House 1', /lb-item">Side/.test(pr) && /lb-item">Shelf/.test(pr) && /House 2/.test(prt) && !/House 1/.test(prt), prt.length);
  // material arrives: Release all → back on the saw as MATERIAL IN, list reopened for that line only
  await saw.page.evaluate(() => { wlShowHold = true; render(); document.querySelector('[data-relg]').click(); }); await F.send(saw.page);
  const q = await saw.page.evaluate(() => { wlShowHold = false; render(); return document.body.innerText; });
  rec('Release all: the Oak line is back as "MATERIAL HAS ARRIVED" on the signed-off House 1', L(S, 'L1:3').status === 'todo' && !!L(S, 'L1:3').released_at && /MATERIAL HAS ARRIVED/.test(q), q.slice(0, 200));
  const tk = await saw.page.evaluate(() => tickableRows(lists().find(l => l.id === 'L1'), 'saw').map(r => r.item).join());
  rec('only the released line is tickable on House 1', tk === 'Back', tk);
  await F.tapRow(saw.page, 'data-rt', 'L1:3'); await F.send(saw.page);
  await off.page.evaluate(async () => { await lsPoll(); });
  rec('ticking it finishes the saw side again → board green for the saw side (fittings still open → amber)', L(S, 'L1:3').status === 'cut' && (await off.page.evaluate(() => woReady('WO-1').saw)) === 'done', await off.page.evaluate(() => JSON.stringify(woReady('WO-1'))));
  // stores picks → green
  const st = await F.dev(browser, S, 'stores');
  await st.page.evaluate(() => { document.querySelector('[data-wldone="L1"]').click(); }); await F.send(st.page);
  await off.page.evaluate(async () => { await lsPoll(); });
  rec('stores picks House 1 → board green', (await rd()).split(',')[0] === 'green', await rd());
  // re-cut with a reason
  await off.page.evaluate(() => { sendBack(lists().find(l => l.id === 'L1'), 'saw'); }); await F.send(off.page);
  await saw.page.evaluate(async () => { await lsPoll(); render(); });
  rec('re-cut with a reason: House 1 back on the saw queue, reason in its history', !D.find(S.db, 'lists', 'L1').saw_done_at && (await saw.page.evaluate(() => !!document.querySelector('[data-wldone="L1"]'))) && D.find(S.db, 'lists', 'L1').log.some(x => /re-cutting/.test(x.what) && x.why === 'Tester'));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await saw.close(); await off.close(); await st.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
