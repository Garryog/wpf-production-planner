// PM sequence step 9 (B7): change requests inside the fixed window. Today = Wed 21 Oct 2026; window = 14 days (to Wed 4 Nov).
// A PM's change to a fixed job sends ONE open request (date or move) with a reason; the Production Manager approves (claim
// first — a second Production Manager at the same moment is told "already approved by X — nothing done"; the change is then
// made on TODAY's data and 'applied' written) or refuses (reason required). The answer goes to the PM who asked until Seen.
// Overlap refused in plain words; Withdraw; the office / Production Manager changing a fixed job directly write a 'direct'
// row; scorecard "Late changes"; "Approved — not applied yet [Apply now]" after 2 min; nothing shows before the SQL or with
// the lists switch off. Fake Supabase only. Run: node tests/seq/s11-requests.test.js
const X = require('./fixs.js');
const { H, D, DS, rec, sleep } = X;
const reqs = S => S.db.t.seq_requests;
const job = (S, wo) => S.row.orders.find(o => o.wo === wo);
const pj = (p, wo) => p.evaluate(wo => JSON.parse(JSON.stringify(DB.orders.find(o => o.wo === wo))), wo);
const toast = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const closeDlg = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const reload = async p => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(300); }; // planner record + list store, as the polls would
const asWho = (p, n) => p.evaluate(n => sessionStorage.setItem('wpfWho', n), n);
const askPick = (p, why) => p.evaluate(why => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (!o) return 'no dialog'; const t = o.innerText; const b = o.querySelector('[data-why="' + why + '"]'); if (!b) return 'no reason ' + why + ': ' + t; b.click(); return t; }, why);
function row() {
  const r = X.v2Row();
  r.orders.push(H.order({ wo: 'WO-7', customer: 'Aderrig Homes', floor: 'T09', unit: '16', title: 'HOUSE TYPE F', dueDate: '2026-10-28', origDueDate: '2026-10-28', plannedWeek: '2026-10-26' }));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  // ---------- before the SQL / switch off: nothing of it shows
  for (const [lbl, S0] of [['before the SQL', (() => { const s = X.makeServer(row(), { noSeq: true }); return s; })()], ['lists switch OFF', X.makeServer((() => { const r = row(); delete r.settings.listStore; delete r.settings.listStoreAt; return r; })())]]) {
    const pr = await X.dev(browser, S0, 'prod');
    const t = await pr.page.evaluate(() => ({ tab: !!document.querySelector('[data-prodtab="req"]'), ban: !!document.querySelector('.sr-ban'), txt: document.body.innerText }));
    rec(lbl + ': Production Manager — no ✋ Requests tab, no banner, no "Late changes" column', !t.tab && !t.ban && !/change request|Late changes/i.test(t.txt), JSON.stringify([t.tab, t.ban, (t.txt.match(/.{0,40}(change request|Late changes).{0,40}/i) || [])[0]]));
    const pm = await X.dev(browser, S0, 'pm', { me: { pm: 'John Burke' } });
    const u = await pm.page.evaluate(() => ({ seq: !!document.querySelector('[data-pmtab="seq"]'), ans: !!document.querySelector('#seq-ans'), txt: document.body.innerText }));
    rec(lbl + ': PM — no Sequence tab, no answers strip', !u.seq && !u.ans && !/change request/i.test(u.txt), JSON.stringify(u.seq));
    rec(lbl + ': no request ever sent to the database', !S0.log.some(x => /^(POST|PATCH) \/seq_requests/.test(x)), S0.log.filter(x => /seq_requests/.test(x)).join(' '));
    rec(lbl + ': no page errors', !(S0.errors || []).length, JSON.stringify(S0.errors));
    await pr.close(); await pm.close();
  }

  // ---------- the main set-up. P1 has two PMs (John + Mary). Rows: QA WO-3 (free), QB WO-4 (build 20 Nov, free),
  // QC WO-1 (fixed, due 22 Oct), QD WO-2 (fixed), QE WO-7 (fixed, 28 Oct), QW waiting row.
  const S = X.makeServer(row());
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke', 'Mary Kelly'] });
  X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' }); X.seqRow(S, 'QB', 'P1', { wo: 'WO-4', floor: 'T09', unit: '13' });
  X.seqRow(S, 'QC', 'P1', { wo: 'WO-1', floor: 'GF', unit: '12' }); X.seqRow(S, 'QD', 'P1', { wo: 'WO-2', floor: '1', unit: '14' });
  X.seqRow(S, 'QE', 'P1', { wo: 'WO-7', floor: 'T09', unit: '16' }); X.seqRow(S, 'QW', 'P1', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE TYPE E' });
  const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
  await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);

  // 1. date request on a fixed job (WO-1 → required 1 Dec)
  await X.dtOpen(pm.page, '[data-seqdate="QC"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-12-01' }); let pv = await X.dtWhy(pm.page, 'Customer delay', 'site 3 weeks late');
  const btn = await pm.page.evaluate(() => document.querySelector('#sd-ok').textContent);
  rec('PM, fixed job: preview says ONE change request goes to the Production Manager; button "✋ Send the request"', /ONE change request/.test(pv.prev) && /WO-1/.test(pv.prev) && pv.ok && /Send the request/.test(btn), pv.prev + ' | ' + btn);
  await X.dtSave(pm.page);
  let r1 = reqs(S).find(q => q.seq_ids.includes('QC'));
  rec('one open DATE request in the database: QC / WO-1, asked by John Burke, reason + note, change per WO-1 1 Dec', !!r1 && reqs(S).length === 1 && r1.status === 'open' && r1.kind === 'date' && r1.asked_by === 'John Burke' && r1.why === 'Customer delay' && r1.note === 'site 3 weeks late' && JSON.stringify(r1.wos) === '["WO-1"]' && r1.change.per['WO-1'].deliv === '2026-12-01', JSON.stringify(r1));
  const res1 = await pm.page.evaluate(() => ([...document.querySelectorAll('.seq-res')].pop() || {}).innerText || '');
  rec('result: "✋ Change request sent … nothing changes until he approves"', /Change request sent to the Production Manager for WO-1/.test(res1) && /until he approves/.test(res1), res1);
  await closeDlg(pm.page); await sleep(1500);
  rec('WO-1 NOT changed (screen and planner record)', (await pj(pm.page, 'WO-1')).dueDate === '2026-10-22' && job(S, 'WO-1').dueDate === '2026-10-22' && !job(S, 'WO-1').delivDate);
  await pm.page.evaluate(() => render()); await sleep(200);
  const rq = await pm.page.evaluate(() => { const e = document.querySelector('tr[data-seqr="QC"] .seq-rq'); return e ? { t: e.innerText, w: !!e.querySelector('[data-seqrqw]') } : null; });
  rec('the row shows "✋ request sent — … · reason · John Burke [Withdraw]"', !!rq && /request sent/.test(rq.t) && /1 Dec/.test(rq.t) && /Customer delay/.test(rq.t) && rq.w, JSON.stringify(rq));

  // 2. overlap on this screen: the same job again → told, not asked twice
  await X.dtOpen(pm.page, '[data-seqdate="QC"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-12-08' }); pv = await X.dtWhy(pm.page, 'Customer delay');
  rec('overlap: the same job again → "Already waiting for the Production Manager", Save off', /Already waiting for the Production Manager/.test(pv.prev) && !pv.ok, pv.prev);
  await closeDlg(pm.page);
  await pm.page.evaluate(() => document.querySelector('[data-seqdn="QC"]').click()); await sleep(300);
  rec('overlap: moving that job → "Already waiting … withdraw that request first", nothing sent', /Already waiting for the Production Manager/.test(await toast(pm.page)) && reqs(S).length === 1 && !(S.rpcCalls || []).some(c => c.fn === 'seq_move'), await toast(pm.page));
  await closeDlg(pm.page);

  // 3. day 14 / 15 (WO-4 build 20 Nov): required 9 Nov → build 4 Nov (day 14) = request; 10 Nov → build 5 Nov (day 15) = free
  await X.dtOpen(pm.page, '[data-seqdate="QB"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-11-09' }); pv = await X.dtWhy(pm.page, 'Production');
  rec('day 14: build 4 Nov is inside the window → a request', /ONE change request/.test(pv.prev), pv.prev);
  await X.dtFill(pm.page, { 'sd-date': '2026-11-10' }); pv = await pm.page.evaluate(() => ({ prev: document.querySelector('#sd-prev').innerText, b: document.querySelector('#sd-ok').textContent }));
  rec('day 15: build 5 Nov is free → no request, "✓ Save dates"', !/change request|Production Manager/.test(pv.prev) && /Save dates/.test(pv.b), JSON.stringify(pv));
  // 4. another PC (Mary) asked about QB a moment ago — this screen doesn't know yet: the DATABASE refuses the overlap
  DS.reqInsert(S.db, { id: 'R-MARY', project_id: 'P1', kind: 'date', seq_ids: ['QB'], wos: ['WO-4'], change: { per: { 'WO-4': { deliv: '2026-11-06', due: '2026-11-03' } } }, preview: { rows: [{ wo: 'WO-4', from: '2026-11-20', to: '2026-11-03', dFrom: '2026-11-25', dTo: '2026-11-06' }] }, why: 'Site not ready', asked_by: 'Mary Kelly' });
  await X.dtFill(pm.page, { 'sd-date': '2026-11-09' }); await X.dtWhy(pm.page, 'Production'); await X.dtSave(pm.page);
  const res2 = await pm.page.evaluate(() => ([...document.querySelectorAll('.seq-res')].pop() || {}).innerText || '');
  rec('overlap from another PC: "Request NOT sent — one of these jobs already has a change request waiting …" (plain words)', /Request NOT sent — one of these jobs already has a change request waiting/.test(res2) && reqs(S).filter(q => q.seq_ids.includes('QB')).length === 1, res2);
  rec('… and WO-4 not changed', job(S, 'WO-4').dueDate === '2026-11-20' && (await pj(pm.page, 'WO-4')).dueDate === '2026-11-20');
  await closeDlg(pm.page);

  // 5. move request: ▼ on QD (fixed WO-2) → "Ask the Production Manager?" → reason → ONE open MOVE request, nothing moved
  await reload(pm.page); await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(200);
  const ordBefore = X.order(S, 'P1').join();
  await pm.page.evaluate(() => document.querySelector('[data-seqdn="QD"]').click()); await sleep(300);
  const ask = await askPick(pm.page, 'Production'); await sleep(700);
  const r2 = reqs(S).find(q => q.kind === 'move');
  rec('move: asked "Ask the Production Manager?" → ONE open MOVE request (QD after QE), seq_move NOT called', /Ask the Production Manager\?/.test(ask) && !!r2 && r2.status === 'open' && r2.seq_ids.includes('QD') && r2.change.after === 'QE' && X.order(S, 'P1').join() === ordBefore && !(S.rpcCalls || []).some(c => c.fn === 'seq_move'), JSON.stringify(r2) + ' ' + ask.slice(0, 200));
  rec('move: told "✋ Change request sent"', /Change request sent/.test(await toast(pm.page)), await toast(pm.page));

  // 6. a PM of ANOTHER project: Mary only on P2 → can't withdraw P1's requests (no button; the function refuses)
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  const ma = await X.dev(browser, S, 'pm', { me: { pm: 'Mary Kelly' } });
  await ma.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(300);
  const mx = await ma.page.evaluate(() => { const n = document.querySelectorAll('[data-seqrqw]').length; seqReqWithdraw('R-MARY'); return { n, t: (document.getElementById('toast') || {}).textContent }; });
  rec('PM of another project: no Withdraw buttons, and withdrawing is refused ("Only the project\'s PM…")', mx.n === 0 && /Only the project's PM/.test(mx.t) && D.find(S.db, 'seq_requests', 'R-MARY').status === 'open', JSON.stringify(mx));
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke', 'Mary Kelly'] });
  await ma.close();

  // 7. withdraw (John, a PM of the project, takes Mary's QB request back)
  await reload(pm.page); await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(200);
  await pm.page.evaluate(() => document.querySelector('tr[data-seqr="QB"] [data-seqrqw]').click()); await sleep(600);
  const rm = D.find(S.db, 'seq_requests', 'R-MARY');
  rec('Withdraw: status withdrawn, by John Burke, the row no longer says "request sent"', rm.status === 'withdrawn' && rm.decided_by === 'John Burke' && await pm.page.evaluate(() => !document.querySelector('tr[data-seqr="QB"] .seq-rq')), JSON.stringify([rm.status, rm.decided_by]));
  rec('Withdraw told on screen', /withdrawn/i.test(await toast(pm.page)), await toast(pm.page));

  // 8. a date request on WO-7 (for the refusal) and one on ... — then the Production Manager screens
  await X.dtOpen(pm.page, '[data-seqdate="QE"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-11-20' }); await X.dtWhy(pm.page, 'Materials'); await X.dtSave(pm.page); await closeDlg(pm.page);
  const r4 = reqs(S).find(q => q.status === 'open' && q.seq_ids.includes('QE'));
  rec('second date request (WO-7) sent', !!r4, JSON.stringify(reqs(S).map(q => [q.id, q.status, q.seq_ids])));

  const pa = await X.dev(browser, S, 'prod'); await asWho(pa.page, 'Pat Prod'); await reload(pa.page);
  const ban = await pa.page.evaluate(() => { const b = document.querySelector('.sr-ban'); return b ? b.innerText : null; });
  rec('Production Manager Today: banner "✋ 3 change requests waiting — tap to answer"', /3 change requests waiting/.test(ban || ''), ban);
  const tab = await pa.page.evaluate(() => { const b = document.querySelector('[data-prodtab="req"]'); return b ? b.textContent : null; });
  rec('tab "✋ Requests (3)"', tab === '✋ Requests (3)', tab);
  await pa.page.evaluate(() => document.querySelector('.sr-ban').click()); await sleep(300);
  const cards = await pa.page.evaluate(() => [...document.querySelectorAll('#sr-pg .sr-card:not(.sr-dec)')].map(c => ({ id: c.dataset.srcard, t: c.innerText, ok: !!c.querySelector('[data-srok]'), no: !!c.querySelector('[data-srno]') })));
  const c1 = cards.find(c => c.id === r1.id);
  rec('Requests page: 3 waiting cards (the withdrawn one is under "decided"), each with ✓ Approve and ✗ Refuse; date card shows what, why and "If you approve now"', cards.length === 3 && cards.every(c => c.ok && c.no) && /WO-1/.test(c1.t) && /1 Dec/.test(c1.t) && /Customer delay — site 3 weeks late/.test(c1.t) && /If you approve now/.test(c1.t) && /John Burke/.test(c1.t), JSON.stringify(cards.map(c => [c.id, c.ok, c.no, c.t.slice(0, 400)])));
  const pb = await X.dev(browser, S, 'prod'); await asWho(pb.page, 'Sean Prod'); await reload(pb.page);
  await pb.page.evaluate(() => { prodTab = 'req'; render(); }); await sleep(300);

  // 9. two Production Managers approve R1 at the same moment
  const [ta, tb] = await Promise.all([pa.page, pb.page].map(p => p.evaluate(async id => { document.querySelector('[data-srok="' + id + '"]').click(); await new Promise(r => setTimeout(r, 1200)); return (document.getElementById('toast') || {}).textContent; }, r1.id)));
  r1 = D.find(S.db, 'seq_requests', r1.id);
  const winner = r1.decided_by, loserT = winner === 'Pat Prod' ? tb : ta;
  rec('two at once: approved ONCE (by one of them), applied recorded', r1.status === 'approved' && ['Pat Prod', 'Sean Prod'].includes(winner) && !!r1.applied && !!r1.applied_at, JSON.stringify([r1.status, winner, r1.applied]));
  rec('the other is told "Already approved by <winner> — nothing done"', new RegExp('Already approved by ' + winner + ' — nothing done').test(loserT), JSON.stringify([ta, tb]));
  await sleep(1600);
  const w1 = job(S, 'WO-1');
  rec('approve applied the change with the date rules: WO-1 required 1 Dec, build 3 working days before (26 Nov)', w1.delivDate === '2026-12-01' && w1.dueDate === '2026-11-26', JSON.stringify([w1.delivDate, w1.dueDate]));
  const hist = (w1.dueHist || []).filter(h => h.rq === r1.id);
  rec('history: entries carry the request (rq), src pmseq, fixed window, by "John Burke (approved by …)", only ONE application', hist.length >= 1 && hist.length <= 2 && new Set(hist.map(h => h.f || h.field || h.k || JSON.stringify(Object.keys(h)))).size === hist.length && hist.every(h => h.src === 'pmseq' && h.fx === 1 && h.by === 'John Burke (approved by ' + winner + ')'), JSON.stringify(w1.dueHist));

  // 10. refuse needs a reason (R4, WO-7)
  await pa.page.evaluate(() => render()); await sleep(200);
  await pa.page.evaluate(id => document.querySelector('[data-srno="' + id + '"]').click(), r4.id); await sleep(200);
  const dis = await pa.page.evaluate(() => document.querySelector('#sr-no-ok').disabled);
  const nr = await pa.page.evaluate(async id => { await seqDecide(id, 'refused', '   ', 'Pat Prod'); return (document.getElementById('toast') || {}).textContent; }, r4.id);
  rec('refuse: the button is off until a reason is typed; a blank reason is refused, nothing written', dis && /A reason is needed to refuse/.test(nr) && D.find(S.db, 'seq_requests', r4.id).status === 'open', JSON.stringify([dis, nr]));
  await pa.page.evaluate(() => { const t = document.querySelector('#sr-ans'); t.value = 'Saw is full that week <b>sorry</b>'; t.oninput(); document.querySelector('#sr-no-ok').click(); }); await sleep(700);
  const q4 = D.find(S.db, 'seq_requests', r4.id);
  rec('refused with the reason: status refused, answer kept, WO-7 not changed', q4.status === 'refused' && q4.answer === 'Saw is full that week <b>sorry</b>' && q4.decided_by === 'Pat Prod' && job(S, 'WO-7').dueDate === '2026-10-28', JSON.stringify([q4.status, q4.answer]));

  // 11. approve the MOVE request (R2): seq_move called, QD now after QE
  await pa.page.evaluate(() => render()); await sleep(200);
  await pa.page.evaluate(id => document.querySelector('[data-srok="' + id + '"]').click(), r2.id); await sleep(1200);
  const q2 = D.find(S.db, 'seq_requests', r2.id), o2 = X.order(S, 'P1');
  rec('approve a move: QD moved after QE through seq_move, applied recorded', q2.status === 'approved' && !!q2.applied && q2.applied.ok === true && o2.indexOf('QD') === o2.indexOf('QE') + 1, JSON.stringify([q2.status, q2.applied, o2]));
  rec('move history says who asked and who approved', S.db.t.project_events.some(e => e.entity_id === 'QD' && e.act === 'move' && e.by === 'John Burke (approved by Pat Prod)'), JSON.stringify(S.db.t.project_events.filter(e => e.entity_id === 'QD').map(e => [e.act, e.by])));

  // 12. the answer goes to the PM who asked (John), not to Mary (the project's other PM); gone after ✓ Seen
  await reload(pm.page); await pm.page.evaluate(() => { pmTab = ''; render(); }); await sleep(200);
  const an = await pm.page.evaluate(() => [...document.querySelectorAll('#seq-ans [data-seqans]')].map(e => e.innerText));
  rec('John sees his answers: 2 approved + 1 refused with the reason (escaped, shown as text)', an.length === 3 && an.filter(t => /APPROVED/.test(t)).length === 2 && an.some(t => /REFUSED by Pat Prod/.test(t) && /Saw is full that week <b>sorry<\/b>/.test(t)), JSON.stringify(an));
  rec('… the "<b>" in the answer is not made into HTML', await pm.page.evaluate(() => !document.querySelector('#seq-ans b b, #seq-ans span b')));
  const mk = await X.dev(browser, S, 'pm', { me: { pm: 'Mary Kelly' } });
  rec('Mary (the other PM of the project) does not get John\'s answers', await mk.page.evaluate(() => !document.querySelector('#seq-ans')));
  await mk.close();
  await pm.page.evaluate(id => document.querySelector('[data-seqseen="' + id + '"]').click(), r4.id); await sleep(600);
  rec('✓ Seen: seen_at written, that answer gone, the other two still shown', !!D.find(S.db, 'seq_requests', r4.id).seen_at && await pm.page.evaluate(() => document.querySelectorAll('#seq-ans [data-seqans]').length) === 2);

  // 13. approve AFTER THE JOB MOVED: John asks for WO-7 (required 30 Nov); the office then moves WO-7 directly (a 'direct' row)
  await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(200);
  await X.dtOpen(pm.page, '[data-seqdate="QE"]'); await sleep(200);
  await X.dtFill(pm.page, { 'sd-date': '2026-11-30' }); await X.dtWhy(pm.page, 'Site not ready'); await X.dtSave(pm.page); await closeDlg(pm.page);
  const r5 = reqs(S).find(q => q.status === 'open' && q.seq_ids.includes('QE'));
  await sleep(1500);
  const of = await X.dev(browser, S, 'office');
  await of.page.evaluate(() => seqOpen('P1')); await sleep(500);
  await X.dtOpen(of.page, '.seq-ovl [data-seqdate="QE"]'); await sleep(200);
  await X.dtFill(of.page, { 'sd-date': '2026-10-30' }); pv = await X.dtWhy(of.page, 'Production');
  rec('office on a fixed job: changed directly ("changed by … logged")', pv.ok && /fixed window — changed by/.test(pv.prev), pv.prev);
  await X.dtSave(of.page); await sleep(1600);
  const dr = reqs(S).filter(q => q.status === 'direct');
  rec('Manager condition 5: the office\'s direct change wrote ONE \'direct\' row (date, WO-7, reason, by Op)', dr.length === 1 && dr[0].kind === 'date' && JSON.stringify(dr[0].wos) === '["WO-7"]' && dr[0].why === 'Production' && dr[0].asked_by === 'Op', JSON.stringify(dr));
  rec('WO-7 moved by the office: required 30 Oct, build 27 Oct', job(S, 'WO-7').delivDate === '2026-10-30' && job(S, 'WO-7').dueDate === '2026-10-27', JSON.stringify([job(S, 'WO-7').delivDate, job(S, 'WO-7').dueDate]));
  // the office moves a fixed row in the order too → a 'direct' move row
  await closeDlg(of.page); await of.page.evaluate(() => seqOpen('P1')); await sleep(500);
  await of.page.evaluate(() => document.querySelector('.seq-ovl [data-sequp="QE"]').click()); await sleep(300);
  await askPick(of.page, 'Production'); await sleep(900);
  const dm = reqs(S).filter(q => q.status === 'direct' && q.kind === 'move');
  rec('office moving a fixed row up (reason asked) → moved + ONE \'direct\' move row', dm.length === 1 && dm[0].seq_ids.includes('QE') && dm[0].why === 'Production', JSON.stringify(dm) + ' ' + X.order(S, 'P1'));
  await of.close();
  await reload(pa.page); await pa.page.evaluate(() => { prodTab = 'req'; render(); }); await sleep(300);
  const c5 = await pa.page.evaluate(id => (document.querySelector('[data-srcard="' + id + '"]') || {}).innerText || 'none', r5.id);
  rec('Production Manager sees "⚠ changed since asked: WO-7 is now build 27 Oct · delivery 30 Oct"', /changed since asked: WO-7 is now build 27 Oct · delivery 30 Oct/.test(c5), c5);
  await pa.page.evaluate(id => document.querySelector('[data-srok="' + id + '"]').click(), r5.id); await sleep(1700);
  rec('approve after the move: the asked-for date is applied on TODAY\'s data (required 30 Nov, build 25 Nov)', job(S, 'WO-7').delivDate === '2026-11-30' && job(S, 'WO-7').dueDate === '2026-11-25' && D.find(S.db, 'seq_requests', r5.id).status === 'approved', JSON.stringify([job(S, 'WO-7').delivDate, job(S, 'WO-7').dueDate]));

  // 14. claimed but not applied (that screen died): after 2 min "Approved — not applied yet [Apply now]"
  DS.reqInsert(S.db, { id: 'R-STUCK', project_id: 'P1', kind: 'date', seq_ids: ['QA'], wos: ['WO-3'], change: { per: { 'WO-3': { deliv: '2026-12-11', due: '2026-12-08' } } }, preview: { rows: [{ wo: 'WO-3', from: '2026-12-03', to: '2026-12-08', dFrom: '', dTo: '2026-12-11' }] }, why: 'Customer delay', asked_by: 'John Burke' });
  DS.reqUpdate(S.db, D.find(S.db, 'seq_requests', 'R-STUCK'), { status: 'approved', decided_by: 'Sean Prod' });
  const browserNow = await pa.page.evaluate(() => Date.now());
  D.find(S.db, 'seq_requests', 'R-STUCK').decided_at = new Date(browserNow - 60000).toISOString();
  await reload(pa.page); await pa.page.evaluate(() => { prodTab = 'req'; render(); }); await sleep(200);
  const st1 = await pa.page.evaluate(() => (document.querySelector('[data-srcard="R-STUCK"]') || {}).innerText || 'none');
  rec('1 minute after the claim: "being applied…", no Apply now yet', /being applied/.test(st1) && await pa.page.evaluate(() => !document.querySelector('[data-srapply]')), st1);
  D.find(S.db, 'seq_requests', 'R-STUCK').decided_at = new Date(browserNow - 180000).toISOString();
  await reload(pa.page); await pa.page.evaluate(() => { prodTab = 'req'; render(); }); await sleep(200);
  const st2 = await pa.page.evaluate(() => ({ t: (document.querySelector('[data-srcard="R-STUCK"]') || {}).innerText || 'none', b: (document.querySelector('.sr-ban') || {}).innerText }));
  rec('after 2 minutes: "Approved — not applied yet [Apply now]"', /Approved — not applied yet/.test(st2.t) && await pa.page.evaluate(() => !!document.querySelector('[data-srapply="R-STUCK"]')), st2.t);
  await pa.page.evaluate(() => document.querySelector('[data-srapply="R-STUCK"]').click()); await sleep(1700);
  rec('Apply now: WO-3 changed (required 11 Dec, build 8 Dec), applied recorded', job(S, 'WO-3').delivDate === '2026-12-11' && job(S, 'WO-3').dueDate === '2026-12-08' && !!D.find(S.db, 'seq_requests', 'R-STUCK').applied, JSON.stringify([job(S, 'WO-3').delivDate, job(S, 'WO-3').dueDate]));
  const again = await pa.page.evaluate(async () => { const n = DB.orders.find(o => o.wo === 'WO-3').dueHist.length; await seqDecide('R-STUCK', 'approved', '', 'Pat Prod'); return [n, DB.orders.find(o => o.wo === 'WO-3').dueHist.length, (document.getElementById('toast') || {}).textContent]; });
  rec('approving an already-approved request does nothing ("Already approved by Sean Prod — nothing done")', again[0] === again[1] && /Already approved by Sean Prod — nothing done/.test(again[2]), JSON.stringify(again));

  // 15. scorecard "Late changes" (this week, by the day asked). The fake database stamps real time: put the asks on 21 Oct.
  reqs(S).forEach(q => { q.asked_at = '2026-10-21T09:00:00.000Z'; });
  await reload(pa.page); await pa.page.evaluate(() => { prodTab = 'today'; render(); }); await sleep(300);
  const sc = await pa.page.evaluate(() => { const t = document.querySelector('.sc-tbl'); if (!t) return null; const h = [...t.querySelectorAll('thead th')].map(x => x.textContent); const i = h.indexOf('Late changes'); return { i, v: i >= 0 ? t.querySelector('tbody tr').children[i].textContent : null }; });
  const all = reqs(S), dn = all.filter(q => q.status === 'direct').length, rr = all.filter(q => !['direct', 'withdrawn'].includes(q.status));
  const exp = rr.length + ' (' + [rr.filter(q => q.status === 'approved').length + '✓', rr.filter(q => q.status === 'refused').length + '✗'].join(' ') + ') + ' + dn + ' direct';
  rec('scorecard "Late changes" this week = ' + exp + ' (withdrawn not counted)', !!sc && sc.v === exp && exp === '5 (4✓ 1✗) + 2 direct', JSON.stringify(sc) + ' expected ' + exp);
  rec('banner gone when nothing is waiting', await pa.page.evaluate(() => !document.querySelector('.sr-ban')));
  const dec = await pa.page.evaluate(async () => { prodTab = 'req'; render(); await new Promise(r => setTimeout(r, 200)); return [...document.querySelectorAll('#sr-pg .sr-card.sr-dec')].length; });
  rec('Requests page lists the decided ones below ("Last N decided"), nothing waiting', dec === reqs(S).length && await pa.page.evaluate(() => /Nothing waiting/.test(document.getElementById('sr-pg').innerText) && /Last \d+ decided/.test(document.getElementById('sr-pg').innerText)), dec);

  // 16. phone 360 px: Requests page and the PM answers fit, buttons ≥ 44 px
  DS.reqInsert(S.db, { id: 'R-PH', project_id: 'P1', kind: 'date', seq_ids: ['QD'], wos: ['WO-2'], change: { per: { 'WO-2': { deliv: '2026-12-15', due: '2026-12-10' } } }, preview: { rows: [{ wo: 'WO-2', from: '2026-10-22', to: '2026-12-10', dFrom: '', dTo: '2026-12-15' }] }, why: 'AVeryLongReasonWithNoSpacesAtAllToCheckWrappingOnAPhoneScreen'.repeat(2), asked_by: 'John Burke' });
  const ph = await X.dev(browser, S, 'prod', { viewport: { width: 360, height: 740 } });
  await ph.page.evaluate(() => { prodTab = 'req'; render(); }); await sleep(300);
  const sp = await X.noScroll(ph.page);
  const bh = await ph.page.evaluate(() => [...document.querySelectorAll('[data-srok],[data-srno],[data-prodtab]')].map(b => Math.round(b.getBoundingClientRect().height)));
  rec('phone 360 px, Requests: no sideways scroll; Approve / Refuse / tabs ≥ 44 px tall', sp.sw <= sp.cw + 1 && bh.length >= 3 && bh.every(h => h >= 44), JSON.stringify([sp, bh]));
  await ph.close();
  const pp = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
  const sp2 = await X.noScroll(pp.page);
  const sh = await pp.page.evaluate(() => [...document.querySelectorAll('[data-seqseen]')].map(b => Math.round(b.getBoundingClientRect().height)));
  await pp.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
  const sp3 = await X.noScroll(pp.page);
  const wh = await pp.page.evaluate(() => [...document.querySelectorAll('[data-seqrqw]')].map(b => Math.round(b.getBoundingClientRect().height)));
  rec('phone 360 px, PM: answers strip and sequence with "request sent" fit; ✓ Seen / Withdraw ≥ 44 px', sp2.sw <= sp2.cw + 1 && sp3.sw <= sp3.cw + 1 && sh.length >= 1 && sh.every(h => h >= 44) && wh.length >= 1 && wh.every(h => h >= 44), JSON.stringify([sp2, sh, sp3, wh]));
  await pp.close();

  await pa.close(); await pb.close(); await pm.close();
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
