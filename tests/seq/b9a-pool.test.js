// B9a (Coder): Johnny's pre-production pool, read-only — which jobs, cut-by, default order, processed from Cienapps / seq_pre,
// red / amber, material / spec / list / sheets cells, no-sequence strip; hidden before the SQL and with the switch off.
// Fake Supabase only. Run: node tests/seq/b9a-pool.test.js
const { X, NOW11, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  // ---- before the SQL / switch off: the old message, nothing written
  const S0 = makePool({ noSeq: true, noRows: true });
  const p0 = await pre(browser, S0);
  const t0 = await p0.page.evaluate(() => ({ pool: !!document.getElementById('pre-pool'), txt: document.getElementById('app').innerText }));
  rec('SQL not run: no pool, the old message', !t0.pool && /opens once the PM sequence database update is installed/.test(t0.txt), t0.txt.slice(0, 200));
  rec('SQL not run: no page errors', !(S0.errors || []).length, JSON.stringify(S0.errors));
  await p0.close();
  const S1 = makePool({ row: (() => { const r = require('./b9fix.js').poolRow(); delete r.settings.listStore; delete r.settings.listStoreAt; return r; })(), noRows: true });
  const p1 = await pre(browser, S1);
  const t1 = await p1.page.evaluate(() => ({ pool: !!document.getElementById('pre-pool'), txt: document.getElementById('app').innerText }));
  rec('switch off: no pool, the old message, no seq_pre traffic', !t1.pool && /opens once/.test(t1.txt) && !S1.log.some(x => /seq_pre/.test(x)), t1.txt.slice(0, 200));
  rec('switch off: no page errors', !(S1.errors || []).length, JSON.stringify(S1.errors));
  await p1.close();

  // ---- cut-by (acceptance 4)
  const S = makePool();
  const p = await pre(browser, S);
  await sleep(1500); const nLog = S.log.length;
  const cb = await p.page.evaluate(() => ['2026-12-08', '2026-12-12', '2027-01-01', '2027-03-24', '2026-11-18', ''].map(cncCutBy));
  rec('cncCutBy: Tue 8 Dec → Tue 1 Dec; Sat 12 Dec → Fri 4 Dec; Fri 1 Jan 2027 → Thu 24 Dec; Wed 24 Mar 2027 → Tue 16 Mar; no date → ""',
    JSON.stringify(cb) === JSON.stringify(['2026-12-01', '2026-12-04', '2026-12-24', '2027-03-16', '2026-11-11', '']), JSON.stringify(cb));

  // ---- which jobs, default order (acceptance 2, 3, 5, 9)
  const r = await pool(p.page);
  rec('pool: WO-1, WO-2, WO-12 (overdue), waiting W1 (~25 Nov), WO-17 (no project), WO-10 (2 Dec = day 21) — due-date order',
    wos(r) === 'WO-1,WO-2,WO-12,⏳ no WO yet,' + r[4].wo + ',WO-10' && /WO-17/.test(r[4].wo), wos(r));
  rec('Thu 3 Dec (WO-11) is out at 3 weeks; cut WO-13, on-hold WO-14, shipped WO-15 never listed', !/WO-11|WO-13|WO-14|WO-15/.test(wos(r)));
  rec('default order: My# = Due# on every row (WO-16, processed, is hidden: number 5 skipped)', r.every(x => x.my === x.dn) && JSON.stringify(r.map(x => x.my)) === '[1,2,3,4,6,7]', JSON.stringify(r.map(x => [x.my, x.dn])));
  rec('same due day, same project: WO-1 (PM position 3) before WO-2 (no sequence row)', r[0].wo === 'WO-1' && r[1].wo === 'WO-2');
  rec('overdue, not processed → red (row + cut-by)', /pre-red/.test(r[0].cls) && /pre-red/.test(r[2].cls), r[2].cls);
  rec('WO-10 due 2 Dec: amber (within 3 weeks), cut-by 25 Nov', /pre-amb/.test(r[5].cls) && /25 Nov/.test(r[5].cut), JSON.stringify(r[5]));
  rec('waiting row: "⏳ no WO yet", "~" due 25 Nov (30 Nov − 3 working days), cut-by ~18 Nov', /~25 Nov/.test(r[3].due) && /~18 Nov/.test(r[3].cut), JSON.stringify(r[3]));
  rec('WO-2 has no sequence row: grey "not in a PM sequence"', /not in a PM sequence/.test(r[1].flags), r[1].flags);
  rec('WO-17: "no project" tag and project cell', /no project/.test(r[4].flags) && /no project/.test(r[4].proj), JSON.stringify(r[4]));
  rec('user text escaped (title with <img onerror>): no element injected', await p.page.evaluate(() => !document.querySelector('#pre-pool img') && !window.__xss));
  const strip = await p.page.evaluate(() => [...document.querySelectorAll('.pre-strip')].map(x => x.innerText));
  rec('strip: "jobs have no PM sequence" names Aderrig (PM John Burke), Lucan, no project', strip.some(s => /have no PM sequence/.test(s) && /Aderrig \(1, PM John Burke\)/.test(s) && /no project \(1\)/.test(s) && /Lucan/.test(s)), JSON.stringify(strip));
  rec('strip: red count "3 jobs are past the CNC cut-by date"', strip.some(s => /3 jobs are past the CNC cut-by date/.test(s)), JSON.stringify(strip));
  rec('cells: WO-1 material from its saw lines (MFC White), List ✓; WO-10 sheets 14, PM John Burke', /MFC White/.test(r[0].mat) && !/spec/.test(r[0].mat) && /✓/.test(r[0].list) && r[5].sheets === '14' && /John Burke/.test(r[5].pm), JSON.stringify([r[0], r[5]]));
  rec('footer: "1 waiting row with no date not listed"', await p.page.evaluate(() => /1 waiting row with no date not listed/.test(document.querySelector('#pre-pool .seq-ft').innerText)));

  // ---- processed: Cienapps step 5 and a seq_pre tick
  await p.page.evaluate(() => document.querySelector('[data-preproc="done"]').click()); await sleep(200);
  let d = await pool(p.page);
  rec('Processed filter: WO-16 at step 5 → "✓ processed (Cienapps)", nothing written', wos(d) === 'WO-16' && /processed \(Cienapps\)/.test(d[0].proc) && !S.db.t.seq_pre.length, JSON.stringify(d));
  X.DS.preWrite(S.db, null, { seq_id: 'Q10', wo: 'WO-10', processed: true, processed_by: 'Johnny', updated_by: 'Johnny' });
  await p.page.evaluate(async () => { await lsPoll(); render(); }); await sleep(200);
  d = await pool(p.page);
  rec('a seq_pre tick (another PC) shows under Processed with who', /WO-10/.test(wos(d)) && /Processed Johnny/.test((d.find(x => x.wo === 'WO-10') || {}).proc), JSON.stringify(d));
  await p.page.evaluate(() => document.querySelector('[data-preproc="not"]').click()); await sleep(200);
  d = await pool(p.page);
  rec('Not processed (default): WO-10 and WO-16 gone', !/WO-10|WO-16/.test(wos(d)), wos(d));
  await p.page.evaluate(() => document.querySelector('[data-preproc="all"]').click()); await sleep(200);
  d = await pool(p.page);
  rec('All: 7 rows, ticked WO-10 is not amber', d.length === 7 && !/pre-amb|pre-red/.test((d.find(x => x.wo === 'WO-10') || {}).cls), wos(d));

  // ---- weeks: device pick 4 brings 3 Dec in, not amber; Settings preWks 2 acts as 3
  await p.page.evaluate(() => { localStorage.setItem('wpfPreWks', '4'); render(); }); await sleep(200);
  d = await pool(p.page);
  const w11 = d.find(x => x.wo === 'WO-11');
  rec('this device picks 4 weeks: WO-11 (3 Dec) in, not amber', !!w11 && !/pre-amb|pre-red/.test(w11.cls), JSON.stringify(w11));
  await p.page.evaluate(() => { localStorage.removeItem('wpfPreWks'); DB.preWks = 2; render(); }); await sleep(200);
  d = await pool(p.page);
  rec('Settings preWks 2 acts as 3: WO-11 out, WO-10 in', !/WO-11/.test(wos(d)) && /WO-10/.test(wos(d)) && await p.page.evaluate(() => /Due by 2 Dec \(3 wks\)/.test(document.querySelector('#pre-pool .seq-h').innerText)), wos(d));
  // ---- nothing written by looking
  rec('looking writes nothing: no project_seq / seq_pre / rpc writes; no planner save after the pool opened', !S.log.some(x => /^(POST|PATCH) \/(project_seq|seq_pre|rpc)/.test(x)) && !S.log.slice(nLog).some(x => /^(POST|PATCH)/.test(x)), JSON.stringify(S.log.slice(nLog).filter(x => !/^GET/.test(x))));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await p.close();
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
