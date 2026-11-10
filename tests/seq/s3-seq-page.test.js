// PM sequence step 3 (Coder, B6a): the read-only sequence page — rows in order with WO / "no WO yet", floor, unit, name,
// required + build dates, progress chips, moved N×, 🔒 fixed — and "Start the sequence from today's jobs (N)" (seq_insert,
// every live not-shipped WO in due-date order; two PCs at once = no duplicates). PC and 360 px phone; hidden before the SQL
// and with the switch off. Fake Supabase only. Run: node tests/seq/s3-seq-page.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const assign = (S, pid, pm) => X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', pid), { pm });
(async () => {
  const browser = await H.chromium.launch();
  // ---- before the SQL / switch off: no Sequence tab, no buttons
  const S0 = X.makeServer(null, { noSeq: true });
  const p0 = await X.dev(browser, S0, 'pm', { me: { pm: 'John Burke' } });
  await p0.page.evaluate(() => { pmTab = 'projects'; render(); }); await sleep(200);
  const r0 = await p0.page.evaluate(() => ({ tab: !!document.querySelector('[data-pmtab="seq"]'), btn: !!document.querySelector('[data-seqopen]') }));
  rec('before the SQL: no 🔢 Sequence tab, no Sequence buttons', !r0.tab && !r0.btn, JSON.stringify(r0));
  await p0.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(200);
  rec('before the SQL: a stale "seq" tab falls back to Deliveries', await p0.page.evaluate(() => pmTab === '' && !document.getElementById('seq-pg')));
  rec('before the SQL: no page errors', !(S0.errors || []).length, JSON.stringify(S0.errors));
  await p0.close();
  const S1 = X.makeServer(X.v1Row());
  const o1 = await X.dev(browser, S1, 'office');
  rec('switch off: seqOpen does nothing, no sequence traffic', await o1.page.evaluate(() => { seqOpen('P1'); return !document.getElementById('seq-pg'); }) && X.SS.seqCalls(S1).length === 0);
  await o1.close();

  // ---- with the SQL
  const S = X.makeServer();
  assign(S, 'P1', 'John Burke');
  const ord = S.row.orders;
  ord.find(o => o.wo === 'WO-3').dueHist = [{ at: '2026-10-01T09:00:00Z', by: 'Op', f: 'due', from: '2026-11-26', to: '2026-12-01', why: 'Site not ready' }, { at: '2026-10-05T09:00:00Z', by: 'Op', f: 'due', from: '2026-12-01', to: '2026-12-03', why: 'Customer delay' }];
  const pc1 = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
  const pc2 = await X.dev(browser, S, 'office');
  await pc1.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  const a1 = await pc1.page.evaluate(() => ({ tab: !!document.querySelector('[data-pmtab="seq"]'), pick: [...document.querySelectorAll('#seq-proj option')].map(o => o.textContent), btn: (document.getElementById('seq-start') || {}).textContent || '', h: (document.querySelector('.seq-top') || {}).innerText || '' }));
  rec('PM Sequence tab: his project, title with PM', a1.tab && JSON.stringify(a1.pick) === '["Aderrig"]' && /Aderrig/.test(a1.h) && /PM John Burke/.test(a1.h), JSON.stringify(a1));
  rec('"Start the sequence from today\'s jobs (4)" — shipped WO-5 and other projects left out', /Start the sequence from today's jobs \(4\)/.test(a1.btn), a1.btn);
  // office opens the same project in a window: also offered Start (stale view for the race below)
  await pc2.page.evaluate(() => { showTab('l'); lsProjectsDlg(); }); await sleep(200);
  await pc2.page.evaluate(() => document.querySelector('#pj-body [data-seqopen="P1"]').click()); await sleep(400);
  rec('office: 🔢 Sequence from the Projects window opens the page in a window', await pc2.page.evaluate(() => !!document.querySelector('.seq-ovl #seq-pg') && /\(4\)/.test((document.getElementById('seq-start') || {}).textContent || '')));
  // PM starts it
  await pc1.page.evaluate(() => document.getElementById('seq-start').click()); await sleep(700);
  const call = (S.rpcCalls || []).find(c => c.fn === 'seq_insert');
  rec('seq_insert called once with 4 rows, src start / match_how start, by John Burke', call && call.args.p_rows.length === 4 && call.args.p_rows.every(r => r.src === 'start' && r.match_how === 'start') && call.args.p_by === 'John Burke' && call.args.p_project === 'P1', JSON.stringify(call && call.args).slice(0, 300));
  const wos = X.order(S, 'P1').map(id => X.D.find(S.db, 'project_seq', id).wo);
  rec('database: WO-1, WO-2, WO-4, WO-3 (due-date order), positions 1..4, matched', JSON.stringify(wos) === '["WO-1","WO-2","WO-4","WO-3"]' && S.db.t.project_seq.every(r => r.state === 'matched'), JSON.stringify(wos));
  rec('database history: 4 "add" rows by John Burke', S.db.t.project_events.filter(e => e.entity === 'seq' && e.act === 'add' && e.by === 'John Burke').length === 4);
  const pg = await pc1.page.evaluate(() => ({ start: !!document.getElementById('seq-start'), rows: [...document.querySelectorAll('.seq-tbl tr.seq-r')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()) }));
  rec('page: Start gone, 4 rows in order', !pg.start && pg.rows.length === 4 && /^1 .*WO-1/.test(pg.rows[0]) && /^4 .*WO-3/.test(pg.rows[3]), JSON.stringify(pg.rows));
  rec('WO-1 (due tomorrow) is 🔒 fixed and greyed', await pc1.page.evaluate(() => { const r = [...document.querySelectorAll('tr.seq-r')][0]; return r.classList.contains('seq-fixed') && /🔒/.test(r.innerText); }));
  rec('WO-4: required = delivery date 25 Nov, build 20 Nov, not fixed', /25 Nov/.test(pg.rows[2]) && /20 Nov/.test(pg.rows[2]) && !/🔒/.test(pg.rows[2]), pg.rows[2]);
  rec('WO-3: no delivery date → build date shown grey as required; moved 2×', await pc1.page.evaluate(() => { const r = [...document.querySelectorAll('tr.seq-r')][3]; const g = r.querySelector('td[data-l="Required"] .seq-grey'); return !!g && /3 Dec/.test(g.textContent) && /2×/.test(r.innerText); }));
  rec('progress chips: WO-1 has its list ✓, not processed / cut / delivered', await pc1.page.evaluate(() => { const t = [...document.querySelectorAll('tr.seq-r')][0].querySelector('.seq-prog').innerText; return /list ✓/.test(t) && /processed —/.test(t) && /cut —/.test(t) && /delivered —/.test(t); }));
  const pr = await pc1.page.evaluate(() => { const o = { wo: 'X', step: '7. ASSEMBLY COMPLETE', delDay: 'Tue', delVeh: 'v1' }; return seqProgress(o, null).filter(x => x[1]).map(x => x[0]); });
  rec('seqProgress: a built job on a van = processed, cut, assembled, on a van (not in store, not delivered)', JSON.stringify(pr) === '["processed","cut","assembled","on a van"]', JSON.stringify(pr));
  // the office's stale window: Start again → nothing doubled
  await pc2.page.evaluate(() => document.getElementById('seq-start').click()); await sleep(700);
  rec('office pressed Start on a stale window: nothing added twice (database skips WOs already in a sequence)', S.db.t.project_seq.length === 4 && (S.rpcCalls || []).filter(c => c.fn === 'seq_insert').length === 2);
  const t2 = await pc2.page.evaluate(() => ({ rows: document.querySelectorAll('.seq-ovl tr.seq-r').length, start: !!document.getElementById('seq-start'), toast: (document.getElementById('toast') || {}).textContent || '' }));
  rec('office window reloads: 4 rows, no Start, told "already in a sequence"', t2.rows === 4 && !t2.start && /0 work orders added.*4 already in a sequence/.test(t2.toast), JSON.stringify(t2));
  // a waiting row from another PC, with a name that tries to inject
  X.seqRow(S, 'QW1', 'P1', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE <img src=x onerror="window.__x=1"> E', req_date: '2026-10-30' });
  await pc1.page.evaluate(async () => { for (let i = 0; i < 20 && document.querySelectorAll('tr.seq-r').length < 5; i++) { await lsPoll(); await new Promise(r => setTimeout(r, 150)); } }); await sleep(100);
  const w = await pc1.page.evaluate(() => { const r = [...document.querySelectorAll('tr.seq-r')][4]; return { t: r ? r.innerText : '', x: window.__x, img: r ? !!r.querySelector('img') : null }; });
  rec('waiting row arrives on the poll: "⏳ no WO yet", "due soon — no WO number", product, date', /no WO yet/.test(w.t) && /due soon — no WO number/.test(w.t) && /K8/.test(w.t) && /30 Oct/.test(w.t), w.t);
  rec('names are escaped (no element made, nothing ran)', w.x === undefined && w.img === false && /<img/.test(w.t), JSON.stringify(w));
  // All projects: Lucan is read-only for John
  await pc1.page.evaluate(() => { PMALL = true; SEQV.pid = 'P2'; render(); }); await sleep(300);
  const ro = await pc1.page.evaluate(() => ({ t: document.getElementById('seq-pg').innerText, start: !!document.getElementById('seq-start'), opts: [...document.querySelectorAll('#seq-proj option')].map(o => o.textContent) }));
  rec('"All projects": Lucan read-only — no Start, says so', /Read-only/.test(ro.t) && !ro.start && ro.opts.includes('Lucan (read-only)'), JSON.stringify(ro));
  rec('PC: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await pc1.close(); await pc2.close();

  // ---- phone 360 px: cards, no sideways scroll
  const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
  await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  const sc = await X.noScroll(ph.page);
  const cards = await ph.page.evaluate(() => ({ head: getComputedStyle(document.querySelector('.seq-tbl thead')).display, tr: getComputedStyle(document.querySelector('.seq-tbl tr.seq-r')).display, n: document.querySelectorAll('tr.seq-r').length }));
  rec('phone 360 px: one card per row, no sideways scroll', sc.sw <= sc.cw + 1 && cards.head === 'none' && cards.tr === 'block' && cards.n === 5, JSON.stringify([sc, cards]));
  await ph.close();
  // office phone: the window fits too
  const op = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
  await op.page.evaluate(() => seqOpen('P1')); await sleep(400);
  const sc2 = await X.noScroll(op.page);
  const wd = await op.page.evaluate(() => { const b = document.querySelector('.seq-ovl .pod-in').getBoundingClientRect(); return { l: b.left, r: b.right }; });
  rec('phone 360 px: office sequence window fits the screen', sc2.sw <= sc2.cw + 1 && wd.l >= 0 && wd.r <= 361, JSON.stringify([sc2, wd]));
  await op.close();
  rec('no page errors anywhere', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
