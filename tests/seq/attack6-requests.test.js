// Tester attack 6 on B7 change requests (14-day fixed window). Today = Wed 21 Oct 2026 (window to Wed 4 Nov; the clocks go
// back Sun 25 Oct and Mon 26 Oct is the October bank holiday). Fake Supabase only (tests/seq/srvs.js) — never the live one.
// Each part starts from a fresh fake database. Run: node tests/seq/attack6-requests.test.js
const X = require('./fixs.js');
const { H, D, DS, SS, rec, sleep } = X;
const reqs = S => S.db.t.seq_requests;
const job = (S, wo) => S.row.orders.find(o => o.wo === wo);
const toast = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const closeDlg = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const reload = async p => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(300); };
const asWho = (p, n) => p.evaluate(n => sessionStorage.setItem('wpfWho', n), n);
const reqPage = async p => { await p.evaluate(() => { prodTab = 'req'; render(); }); await sleep(250); };
const askDate = (S, id, seq, wo, deliv, due, by, extra) => DS.reqInsert(S.db, Object.assign({ id, project_id: 'P1', kind: 'date', seq_ids: [seq], wos: [wo], change: { per: { [wo]: { deliv, due } } }, preview: { rows: [{ wo, from: (job(S, wo) || {}).dueDate || '', to: due, dFrom: (job(S, wo) || {}).delivDate || '', dTo: deliv }] }, why: 'Customer delay', asked_by: by || 'John Burke' }, extra || {}));
const approve = async (p, id, wait) => { const r = await p.evaluate(id => { const b = document.querySelector('[data-srok="' + id + '"]'); if (!b) return 'no button'; b.click(); return 'ok'; }, id); await sleep(wait || 1800); return r; };
function row() {
  const r = X.v2Row();
  r.orders.push(H.order({ wo: 'WO-7', customer: 'Aderrig Homes', floor: 'T09', unit: '16', title: 'HOUSE TYPE F', dueDate: '2026-10-28', origDueDate: '2026-10-28', plannedWeek: '2026-10-26' }));
  r.orders.push(H.order({ wo: 'WO-9', customer: 'Aderrig Homes', floor: 'T09', unit: '17', title: 'HOUSE TYPE G', dueDate: '2026-11-05', origDueDate: '2026-11-05', plannedWeek: '' }));
  return r;
}
function setup(mut) {
  const r = row(); if (mut) mut(r);
  const S = X.makeServer(r);
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke', 'Mary Kelly'] });
  X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' }); X.seqRow(S, 'QB', 'P1', { wo: 'WO-4', floor: 'T09', unit: '13' });
  X.seqRow(S, 'QC', 'P1', { wo: 'WO-1', floor: 'GF', unit: '12' }); X.seqRow(S, 'QD', 'P1', { wo: 'WO-2', floor: '1', unit: '14' });
  X.seqRow(S, 'QE', 'P1', { wo: 'WO-7', floor: 'T09', unit: '16' }); X.seqRow(S, 'QW', 'P1', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE TYPE E', req_date: '2026-11-30' });
  X.seqRow(S, 'QG', 'P1', { wo: 'WO-9', floor: 'T09', unit: '17' });
  return S;
}
const prodDev = async (browser, S, who, extra) => { const p = await X.dev(browser, S, 'prod', extra); await asWho(p.page, who); await reload(p.page); return p; };
const pmDev = async (browser, S, who, extra) => { const p = await X.dev(browser, S, 'pm', Object.assign({ me: { pm: who } }, extra || {})); await p.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(250); return p; };

(async () => {
  const browser = await H.chromium.launch();
  const P = name => console.log('\n--- ' + name);

  // ===== 1. escaping: <img onerror> in reason, note, names, answer, project name, WO text on every card and banner
  P('1 escaping');
  {
    const S = setup(); const evil = n => '<img src=x onerror="window.__xss=(window.__xss||[]).concat(' + n + ')">';
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { name: 'Aderrig ' + evil(1) + " O'Grady \"Ph2\"" });
    askDate(S, 'R-X1', 'QC', 'WO-1', '2026-12-01', '2026-11-26', 'John Burke', { why: 'Other ' + evil(2), note: evil(3) + " it's 🏗" });
    DS.reqInsert(S.db, { id: 'R-X2', project_id: 'P1', kind: 'move', seq_ids: ['QD'], wos: ['WO-2' + evil(4)], change: { ids: ['QD'], after: 'QE', to: 5 }, preview: { line: 'WO-2 ' + evil(5) + ' from #4 to #5' }, why: evil(6), asked_by: "Pat O'Grady " + evil(7) });
    askDate(S, 'R-X3', 'QE', 'WO-7', '2026-11-20', '2026-11-17', 'John Burke');
    DS.reqUpdate(S.db, D.find(S.db, 'seq_requests', 'R-X3'), { status: 'refused', decided_by: 'Sean ' + evil(8), answer: evil(9) + ' "no" — it\'s full' });
    DS.reqInsert(S.db, { id: 'R-X4', project_id: 'P1', kind: 'date', seq_ids: ['QA'], wos: ['WO-3'], change: { per: {} }, preview: { rows: [{ wo: 'WO-3' + evil(10), from: '', to: '2026-12-08', dFrom: '', dTo: '2026-12-11' }] }, why: evil(11), asked_by: 'Op ' + evil(12), status: 'direct' });
    const pr = await prodDev(browser, S, 'Pat Prod');
    await pr.page.evaluate(() => { prodTab = 'today'; render(); }); await sleep(300);
    await reqPage(pr.page);
    await pr.page.evaluate(() => { const b = document.querySelector('[data-srno="R-X1"]'); if (b) b.click(); }); await sleep(200);
    const pm = await pmDev(browser, S, 'John Burke');
    await pm.page.evaluate(() => { pmTab = ''; render(); }); await sleep(300);
    const r = [];
    for (const [lbl, p] of [['Production Manager', pr.page], ['PM', pm.page]]) {
      const x = await p.evaluate(() => ({ xss: window.__xss || null, imgs: document.querySelectorAll('img[onerror], img[src="x"]').length }));
      r.push(lbl + JSON.stringify(x));
      rec('escaping (' + lbl + '): no <img onerror> made into HTML, nothing ran', !x.xss && !x.imgs, JSON.stringify(x));
    }
    const shown = await pr.page.evaluate(() => (document.getElementById('sr-pg') || {}).innerText || '');
    rec("escaping: the text shows as typed (O'Grady, quotes, emoji, the <img …> text)", /O'Grady/.test(shown) && /<img src=x onerror=/.test(shown) && /🏗/.test(shown), shown.slice(0, 300));
    await pr.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); pmTab = 'seq'; });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    const x2 = await pm.page.evaluate(() => ({ xss: window.__xss || null, imgs: document.querySelectorAll('img[onerror], img[src="x"]').length, rq: !!document.querySelector('tr[data-seqr="QC"] .seq-rq') }));
    rec('escaping (PM sequence row "request sent"): nothing made into HTML', x2.rq && !x2.xss && !x2.imgs, JSON.stringify(x2));
    rec('escaping: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pr.close(); await pm.close();
  }

  // ===== 2. offline / no reply / slow planner reload while approving
  P('2 offline approve');
  {
    const S = setup(); askDate(S, 'R-O', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    // 2a fully offline (sequence tables unreachable)
    S.offlineS = true;
    await approve(pr.page, 'R-O', 1500);
    let t = await toast(pr.page);
    rec('2a offline: told "No answer … nothing done", request still open, WO-7 not changed', /No answer from the database — nothing done/.test(t) && D.find(S.db, 'seq_requests', 'R-O').status === 'open' && job(S, 'WO-7').dueDate === '2026-10-28', t);
    S.offlineS = false; await reload(pr.page); await reqPage(pr.page);
    // 2b the claim LANDS but the reply is lost → the screen re-reads, sees it is its own claim and goes on
    let drop = true;
    await pr.page.route('**/*', async route => {
      const q = route.request(); if (!(drop && q.method() === 'PATCH' && /\/seq_requests\?/.test(q.url()))) return route.fallback();
      const b = JSON.parse(q.postData() || '{}'); if (b.status !== 'approved') return route.fallback();
      drop = false; DS.reqUpdate(S.db, D.find(S.db, 'seq_requests', 'R-O'), b); return route.abort('connectionreset');
    });
    await approve(pr.page, 'R-O', 2500);
    let q = D.find(S.db, 'seq_requests', 'R-O');
    rec('2b claim landed, reply lost: the change is still made (WO-7 required 30 Nov, build 25 Nov) and applied recorded', q.status === 'approved' && !!q.applied && job(S, 'WO-7').delivDate === '2026-11-30' && job(S, 'WO-7').dueDate === '2026-11-25', JSON.stringify([q.status, !!q.applied, job(S, 'WO-7').delivDate, job(S, 'WO-7').dueDate, await toast(pr.page)]));
    await pr.close();
  }
  {
    // 2c planner reload fails (slow / down) after the claim → "not applied yet", nothing changed, then Apply now works
    const S = setup(); askDate(S, 'R-L', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    let down = true; // the planner record can't be read (slow / down); the sequence tables still answer
    await pr.page.route('**/*', route => { const q = route.request(); if (down && q.method() === 'GET' && /\/production_planner\?/.test(q.url())) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }); return route.fallback(); });
    await approve(pr.page, 'R-L', 2500);
    const t = await toast(pr.page), q = D.find(S.db, 'seq_requests', 'R-L'), loc = await pr.page.evaluate(() => DB.orders.find(o => o.wo === 'WO-7').dueDate);
    rec('2c planner reload fails: "Approved — not applied yet", WO-7 unchanged on screen and in the database', /not applied yet/.test(t) && q.status === 'approved' && !q.applied && job(S, 'WO-7').dueDate === '2026-10-28' && loc === '2026-10-28', JSON.stringify([t, q.status, q.applied, loc]));
    down = false;
    await pr.page.evaluate(() => { const q = LST.sr.get('R-L'); q.decided_at = new Date(Date.now() - 180000).toISOString(); }); await reqPage(pr.page);
    const hasApply = await pr.page.evaluate(() => !!document.querySelector('[data-srapply="R-L"]'));
    await pr.page.evaluate(() => { const b = document.querySelector('[data-srapply="R-L"]'); if (b) b.click(); }); await sleep(2500);
    rec('2c … after 2 min "Apply now" → made (WO-7 30 Nov / 25 Nov), applied recorded', hasApply && job(S, 'WO-7').delivDate === '2026-11-30' && !!D.find(S.db, 'seq_requests', 'R-L').applied, JSON.stringify([hasApply, job(S, 'WO-7').delivDate]));
    await pr.close();
  }
  {
    // 2d planner SAVE fails after the change is made: request says applied — is the user told, and does the change land later?
    const S = setup(); askDate(S, 'R-F', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    S.failSaves = true;
    await approve(pr.page, 'R-F', 4000);
    const st = await pr.page.evaluate(() => ({ s: (document.getElementById('stxt') || {}).textContent || '', f: !!DB.saveFailed, t: (document.getElementById('toast') || {}).textContent }));
    rec('2d save failing: the screen says the save failed (not "Saved")', st.f || /fail|not saved|offline|retry/i.test(st.s + ' ' + st.t), JSON.stringify(st));
    S.failSaves = false;
    await pr.page.evaluate(async () => { await saveDB(); }); await sleep(1500);
    rec('2d … once saving works again the approved change reaches the planner record (not lost)', job(S, 'WO-7').delivDate === '2026-11-30' && job(S, 'WO-7').dueDate === '2026-11-25', JSON.stringify([job(S, 'WO-7').delivDate, job(S, 'WO-7').dueDate]));
    await pr.close();
  }

  // ===== 3. two Production Managers: one approves, one refuses at the same moment; PM withdraws while Prod approves
  P('3 races');
  {
    const S = setup(); askDate(S, 'R-A', 'QE', 'WO-7', '2026-11-30', '2026-11-25'); askDate(S, 'R-B', 'QC', 'WO-1', '2026-12-01', '2026-11-26');
    const pa = await prodDev(browser, S, 'Pat Prod'), pb = await prodDev(browser, S, 'Sean Prod'); await reqPage(pa.page); await reqPage(pb.page);
    const [ta, tb] = await Promise.all([
      pa.page.evaluate(async () => { await seqDecide('R-A', 'approved', '', 'Pat Prod'); await new Promise(r => setTimeout(r, 1500)); return (document.getElementById('toast') || {}).textContent; }),
      pb.page.evaluate(async () => { await seqDecide('R-A', 'refused', 'saw full', 'Sean Prod'); await new Promise(r => setTimeout(r, 1500)); return (document.getElementById('toast') || {}).textContent; })]);
    await sleep(1500);
    const q = D.find(S.db, 'seq_requests', 'R-A'), moved = job(S, 'WO-7').dueDate !== '2026-10-28';
    rec('3a approve vs refuse at once: one answer only, the job matches it (moved only if approved)', (q.status === 'approved' && moved) || (q.status === 'refused' && !moved), JSON.stringify([q.status, q.decided_by, job(S, 'WO-7').dueDate, ta, tb]));
    rec('3a … the loser is told who answered — nothing done', /Already (approved|refused) by (Pat|Sean) Prod — nothing done/.test(q.decided_by === 'Pat Prod' ? tb : ta), JSON.stringify([ta, tb]));
    const pm = await pmDev(browser, S, 'Mary Kelly'); await reload(pm.page); await pm.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(200);
    const [tw, tp] = await Promise.all([
      pm.page.evaluate(async () => { const q = LST.sr.get('R-B'); await seqReqPatch(q, { status: 'withdrawn', decided_by: 'Mary Kelly' }, 'open').catch(e => null); await new Promise(r => setTimeout(r, 300)); return LST.sr.get('R-B').status; }),
      pa.page.evaluate(async () => { await seqDecide('R-B', 'approved', '', 'Pat Prod'); await new Promise(r => setTimeout(r, 1500)); return (document.getElementById('toast') || {}).textContent; })]);
    await sleep(1500);
    const q2 = D.find(S.db, 'seq_requests', 'R-B'), m2 = job(S, 'WO-1').dueDate !== '2026-10-22';
    rec('3b withdraw vs approve at once: one wins, the job matches it', (q2.status === 'approved' && m2) || (q2.status === 'withdrawn' && !m2), JSON.stringify([q2.status, job(S, 'WO-1').dueDate, tw, tp]));
    rec('3 races: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pa.close(); await pb.close(); await pm.close();
  }

  // ===== 4. approve after the job was put on a van (must come off, "rebook") and after it was cut (week kept, flagged)
  P('4 van / cut');
  {
    const S = setup(); askDate(S, 'R-V', 'QE', 'WO-7', '2026-11-30', '2026-11-25'); askDate(S, 'R-C', 'QC', 'WO-1', '2026-12-01', '2026-11-26');
    // after the asks, another PC books WO-7 on a van and marks WO-1 cut
    Object.assign(job(S, 'WO-7'), { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-10-26', delv: true });
    const w1wk = job(S, 'WO-1').plannedWeek; job(S, 'WO-1').step = '6. JOB CUT COMPLETE'; S.row.version = (+S.row.version || 1) + 1;
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    const card = await pr.page.evaluate(() => (document.querySelector('[data-srcard="R-V"]') || {}).innerText || '');
    rec('4 card warns before approving: "If you approve now: … off its van"', /off (its|their) van|come[s]? off/i.test(card), card);
    await approve(pr.page, 'R-V', 2500);
    const dl = await pr.page.evaluate(() => ([...document.querySelectorAll('.seq-res')].pop() || {}).innerText || (document.getElementById('toast') || {}).textContent);
    const w7 = job(S, 'WO-7');
    rec('4 van: approved → WO-7 off the van, "rebook" said, dates made', !w7.delVeh && !w7.delDay && w7.delivDate === '2026-11-30' && /rebook/i.test(dl), JSON.stringify([w7.delVeh, w7.delDay, w7.delivDate, dl]));
    await closeDlg(pr.page); await reqPage(pr.page);
    await approve(pr.page, 'R-C', 2500);
    const dc = await pr.page.evaluate(() => ([...document.querySelectorAll('.seq-res')].pop() || {}).innerText || (document.getElementById('toast') || {}).textContent);
    const w1 = job(S, 'WO-1');
    rec('4 cut: approved → dates made, build week KEPT, "already cut — check it" said', w1.delivDate === '2026-12-01' && w1.plannedWeek === w1wk && /cut/i.test(dc), JSON.stringify([w1.delivDate, w1.plannedWeek, w1wk, dc]));
    const pm = await pmDev(browser, S, 'John Burke'); await pm.page.evaluate(() => { pmTab = ''; render(); }); await sleep(300);
    const an = await pm.page.evaluate(() => [...document.querySelectorAll('#seq-ans [data-seqans]')].map(e => e.innerText).join(' | '));
    rec('4 the PM who asked is told the job came off its van / is already cut (not just "APPROVED")', /van|rebook/i.test(an) && /cut/i.test(an), an);
    await pr.close(); await pm.close();
  }

  // ===== 5. approved but NOT made (job shipped / rows removed / anchor gone) — what does the PM hear?
  P('5 approved but not made');
  {
    const S = setup(); askDate(S, 'R-S', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    DS.reqInsert(S.db, { id: 'R-M', project_id: 'P1', kind: 'move', seq_ids: ['QD'], wos: ['WO-2'], change: { ids: ['QD'], after: 'QE', to: 5 }, preview: { line: 'WO-2 from #4 to #5', from: 4, to: 5 }, why: 'Production', asked_by: 'John Burke' });
    DS.reqInsert(S.db, { id: 'R-N', project_id: 'P1', kind: 'move', seq_ids: ['QC'], wos: ['WO-1'], change: { ids: ['QC'], after: 'QG', to: 7 }, preview: { line: 'WO-1 from #3 to #7', from: 3, to: 7 }, why: 'Production', asked_by: 'John Burke' });
    job(S, 'WO-7').shippedAt = '2026-10-21T08:00:00Z'; S.row.version = (+S.row.version || 1) + 1;
    DS.RPC.seq_remove(S.db, { p_id: 'QD', p_by: 'Office', p_why: 'cancelled' });   // the moved row is gone
    DS.RPC.seq_remove(S.db, { p_id: 'QG', p_by: 'Office', p_why: 'cancelled' });   // R-N's anchor is gone
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    const cards = await pr.page.evaluate(() => ['R-S', 'R-M'].map(id => (document.querySelector('[data-srcard="' + id + '"]') || {}).innerText || ''));
    rec('5 cards warn before approving (WO-7 shipped → not changed; WO-2 no longer in the sequence)', /shipped|not changed/i.test(cards[0]) && /no longer/i.test(cards[1]), JSON.stringify(cards));
    await approve(pr.page, 'R-S', 2500); await closeDlg(pr.page); await reqPage(pr.page);
    await approve(pr.page, 'R-M', 2000); await reqPage(pr.page);
    await approve(pr.page, 'R-N', 2000);
    const o = X.order(S, 'P1');
    rec('5 anchor gone: WO-1 goes to the same position number asked (#' + 'last) and nothing breaks', D.find(S.db, 'seq_requests', 'R-N').applied && D.find(S.db, 'seq_requests', 'R-N').applied.ok === true && o[o.length - 1] === 'QC', JSON.stringify([o, D.find(S.db, 'seq_requests', 'R-N').applied]));
    const pm = await pmDev(browser, S, 'John Burke'); await pm.page.evaluate(() => { pmTab = ''; render(); }); await sleep(300);
    const an = await pm.page.evaluate(() => [...document.querySelectorAll('#seq-ans [data-seqans]')].map(e => ({ id: e.dataset.seqans, t: e.innerText })));
    const aS = (an.find(a => a.id === 'R-S') || {}).t || '', aM = (an.find(a => a.id === 'R-M') || {}).t || '';
    rec('5 [PM told] approved-but-shipped: the PM\'s answer says WO-7 was NOT changed', /not changed|nothing changed|not made|shipped/i.test(aS), aS);
    rec('5 [PM told] approved move of a removed row: the PM\'s answer says it was NOT moved', /not moved|nothing moved|no longer/i.test(aM), aM);
    await pr.close(); await pm.close();
  }

  // ===== 6. a stale "Apply now" on a second screen must not re-apply over a later change
  P('6 stale Apply now');
  {
    const S = setup(); askDate(S, 'R-T', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    const pa = await prodDev(browser, S, 'Pat Prod'), pb = await prodDev(browser, S, 'Sean Prod'); await reqPage(pa.page);
    await approve(pa.page, 'R-T', 2500);
    rec('6 Pat approved and applied', !!D.find(S.db, 'seq_requests', 'R-T').applied && job(S, 'WO-7').delivDate === '2026-11-30');
    // the office then moves WO-7 again (another PC); Sean's screen still holds the request as "approved, not applied", 3 min old
    Object.assign(job(S, 'WO-7'), { delivDate: '2026-12-04', dueDate: '2026-12-01' }); S.row.version = (+S.row.version || 1) + 1;
    await pb.page.evaluate(() => { const q = LST.sr.get('R-T'); q.status = 'approved'; q.decided_by = 'Pat Prod'; q.applied = null; q.applied_at = null; q.decided_at = new Date(Date.now() - 180000).toISOString(); }); await reqPage(pb.page);
    const has = await pb.page.evaluate(() => !!document.querySelector('[data-srapply="R-T"]'));
    await pb.page.evaluate(() => { const b = document.querySelector('[data-srapply="R-T"]'); if (b) b.click(); }); await sleep(2500);
    rec('6 [stale screen] "Apply now" on an already-applied request does NOT put WO-7 back over the office\'s later change', has && job(S, 'WO-7').delivDate === '2026-12-04' && job(S, 'WO-7').dueDate === '2026-12-01', JSON.stringify([has, job(S, 'WO-7').delivDate, job(S, 'WO-7').dueDate, await toast(pb.page)]));
    await pa.close(); await pb.close();
  }

  // ===== 7. clock skew: a PC whose clock is 5 minutes AHEAD of the database
  P('7 clock skew');
  {
    const S = setup(); askDate(S, 'R-K', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    DS.reqUpdate(S.db, D.find(S.db, 'seq_requests', 'R-K'), { status: 'approved', decided_by: 'Sean Prod' });
    const pa = await prodDev(browser, S, 'Pat Prod');
    // "now" in the database = the moment of the claim; this PC's clock reads 5 min later
    const st = await pa.page.evaluate(() => { const q = LST.sr.get('R-K'); const dbNow = SRV_T == null ? Date.now() : SRV_T + performance.now(); /*attack7 fix 1: the database's clock*/ q.decided_at = new Date(dbNow - 20000).toISOString(); const a = seqReqStuck(q); q.decided_at = new Date(dbNow - 20000 - 300000).toISOString(); return [a, seqReqStuck(q)]; });
    rec('7 [info] a claim 20 s old is not "stuck"; on a PC 5 min fast the same claim already shows "Apply now" (uses this PC\'s clock vs the database time)', st[0] === false, JSON.stringify(st));
    // scorecard week: asked Mon 19 Oct 00:30 Irish summer time (= Sun 23:30 UTC) and Sun 25 Oct 23:30 (after the clocks went back)
    reqs(S).forEach(q => { q.asked_at = '2026-10-18T23:30:00.000Z'; });
    askDate(S, 'R-K2', 'QC', 'WO-1', '2026-12-01', '2026-11-26'); D.find(S.db, 'seq_requests', 'R-K2').asked_at = '2026-10-25T23:30:00.000Z';
    askDate(S, 'R-K3', 'QA', 'WO-3', '2026-12-11', '2026-12-08'); D.find(S.db, 'seq_requests', 'R-K3').asked_at = '2026-10-18T22:30:00.000Z'; // Sun 18 Oct 23:30 IST = last week
    await reload(pa.page);
    const lc = await pa.page.evaluate(() => [seqLateChanges('2026-10-19'), seqLateChanges('2026-10-26'), seqLateChanges('2026-10-12')]);
    rec('7 scorecard week by Irish local time: Mon 00:30 summer time = this week; Sun 25 Oct 23:30 after the clock change = this week (not next); Sun 23:30 summer = last week', lc[0] === '2 (1✓ 1 waiting)' && lc[1] === '—' && lc[2] === '1 (1 waiting)', JSON.stringify(lc));
    await pa.close();
  }

  // ===== 8. mixed free + fixed bulk push (free change now, fixed asked), approve, then the PM's Undo
  P('8 mixed bulk push + Undo');
  {
    const S = setup();
    const pm = await pmDev(browser, S, 'John Burke');
    await pm.page.evaluate(() => { ['QB', 'QC', 'QW'].forEach(id => seqTicks('P1').add(id)); render(); }); await sleep(250);
    await X.dtOpen(pm.page, '[data-seqtool="push"]'); await sleep(250);
    await X.dtFill(pm.page, { 'sd-dir': '1', 'sd-n': '1', 'sd-u': 'wk' });
    const pv = await X.dtWhy(pm.page, 'Customer delay');
    const btn = await pm.page.evaluate(() => document.querySelector('#sd-ok').textContent);
    rec('8 preview: free rows change now, the fixed one is asked — "Save dates + send request"', /Save dates \+ send request/.test(btn) && /ONE change request/.test(pv.prev) && /WO-1/.test(pv.prev), btn + ' | ' + pv.prev);
    await X.dtSave(pm.page); await sleep(800); await closeDlg(pm.page);
    const r = reqs(S).find(q => q.status === 'open');
    rec('8 WO-4 +1 week now (27 Nov / deliv 2 Dec), waiting row +1 week (7 Dec), WO-1 NOT changed, ONE request for WO-1 only', job(S, 'WO-4').dueDate === '2026-11-27' && job(S, 'WO-4').delivDate === '2026-12-02' && D.find(S.db, 'project_seq', 'QW').req_date === '2026-12-07' && job(S, 'WO-1').dueDate === '2026-10-22' && !!r && JSON.stringify(r.wos) === '["WO-1"]' && r.change.per['WO-1'].due === '2026-10-29', JSON.stringify([job(S, 'WO-4').dueDate, job(S, 'WO-4').delivDate, D.find(S.db, 'project_seq', 'QW').req_date, job(S, 'WO-1').dueDate, r && r.change]));
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    await approve(pr.page, r.id, 2500);
    rec('8 approved: WO-1 build 29 Oct', job(S, 'WO-1').dueDate === '2026-10-29', job(S, 'WO-1').dueDate);
    await reload(pm.page); await pm.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(250);
    const ub = await pm.page.evaluate(() => !!document.querySelector('#seq-undo'));
    await pm.page.evaluate(() => { const b = document.querySelector('#seq-undo'); if (b) b.click(); }); await sleep(1800);
    await pm.page.evaluate(async () => { await saveDB(); }); await sleep(800);
    rec('8 PM Undo after the approval: WO-4 and the waiting row put back, the APPROVED WO-1 date left alone', ub && job(S, 'WO-4').dueDate === '2026-11-20' && D.find(S.db, 'project_seq', 'QW').req_date === '2026-11-30' && job(S, 'WO-1').dueDate === '2026-10-29', JSON.stringify([ub, job(S, 'WO-4').dueDate, D.find(S.db, 'project_seq', 'QW').req_date, job(S, 'WO-1').dueDate]));
    rec('8 no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close(); await pr.close();
  }
  {
    // 8b Undo must not change a job that is now inside the window without asking: the PM pulls WO-9 (build 5 Nov, day 15)
    // to... nothing in the window is reachable by a free change, so check Undo of the Production Manager's direct change is counted
    const S = setup();
    const pr = await prodDev(browser, S, 'Pat Prod');
    await pr.page.evaluate(() => seqOpen('P1')); await sleep(500);
    await X.dtOpen(pr.page, '.seq-ovl [data-seqdate="QE"]'); await sleep(200);
    await X.dtFill(pr.page, { 'sd-date': '2026-11-30' }); await X.dtWhy(pr.page, 'Production'); await X.dtSave(pr.page); await sleep(800); await closeDlg(pr.page);
    const d1 = reqs(S).filter(q => q.status === 'direct').length;
    await pr.page.evaluate(() => seqOpen('P1')); await sleep(500);
    await pr.page.evaluate(() => { const b = document.querySelector('#seq-undo'); if (b) b.click(); }); await sleep(1500);
    await pr.page.evaluate(async () => { await saveDB(); }); await sleep(600);
    const d2 = reqs(S).filter(q => q.status === 'direct').length;
    rec('8b Production Manager Undo of a fixed-window change (WO-7 back to 28 Oct) is itself counted as a direct change', job(S, 'WO-7').dueDate === '2026-10-28' && d1 === 1 && d2 === 2, JSON.stringify([job(S, 'WO-7').dueDate, d1, d2]));
    await pr.close();
  }

  // ===== 9. window edges across the clock change + bank holiday; waiting row never fixed
  P('9 window edges');
  {
    const S = setup();
    const pm = await pmDev(browser, S, 'John Burke');
    const prevOf = async (sel, d) => { await X.dtOpen(pm.page, sel); await sleep(200); await X.dtFill(pm.page, { 'sd-date': d }); const pv = await X.dtWhy(pm.page, 'Production'); await closeDlg(pm.page); return pv.prev; };
    let pv = await prevOf('[data-seqdate="QG"]', '2026-11-06'); // WO-9 build 5 Nov (day 15) → required 6 Nov → build 3 Nov (day 13) = INTO the window
    rec('9a moving a free job INTO the window (build 5 Nov → 3 Nov) = a request', /ONE change request/.test(pv), pv);
    pv = await prevOf('[data-seqdate="QG"]', '2026-11-11'); // build 6 Nov
    rec('9b free → later (build 6 Nov) = no request', !/change request/.test(pv), pv);
    pv = await prevOf('[data-seqdate="QE"]', '2026-10-29'); // WO-7 fixed; build = 29 Oct − 3 working days, skipping Mon 26 Oct bank holiday = Fri 23 Oct
    rec('9c across the bank holiday: required Thu 29 Oct → build Fri 23 Oct (Mon 26 Oct skipped), a request', /ONE change request/.test(pv) && /23 Oct/.test(pv), pv);
    pv = await prevOf('[data-seqdate="QW"]', '2026-10-23'); // waiting row (no WO) dated 2 days out
    rec('9d waiting row (no WO) dated inside the 14 days: changed directly, never a request', !/change request|Production Manager/.test(pv) && /23 Oct/.test(pv), pv);
    // Settings: fixed window 7 days → WO-7 (build 28 Oct = day 7) fixed, WO-9 ... ; 30 days → WO-4 (20 Nov, day 30) fixed
    await pm.page.evaluate(() => { DB.seqFixedDays = 7; }); const f7 = await pm.page.evaluate(() => [seqNum('seqFixedDays'), seqFixedAt(DB.orders.find(o => o.wo === 'WO-7')), seqFixedAt(DB.orders.find(o => o.wo === 'WO-9'))]);
    rec('9e [info] Settings "fixed days" = 7: WO-7 (day 7) fixed, WO-9 (day 15) free', f7[1] === true && f7[2] === false, JSON.stringify(f7));
    await pm.close();
  }

  // ===== 10. two PMs of one project ask overlapping jobs at the same moment; a PM of ANOTHER project
  P('10 two PMs / other project');
  {
    const S = setup();
    const a = await pmDev(browser, S, 'John Burke'), b = await pmDev(browser, S, 'Mary Kelly');
    const mk = (p, ids, wos, by) => p.evaluate(({ ids, wos, by }) => seqReqMake('P1', 'date', { ids, wos, change: { per: Object.fromEntries(wos.map(w => [w, { deliv: '2026-12-01', due: '2026-11-26' }])) }, preview: { rows: [] }, why: 'Customer delay', by }), { ids, wos, by });
    const [ra, rb] = await Promise.all([mk(a.page, ['QC', 'QD'], ['WO-1', 'WO-2'], 'John Burke'), mk(b.page, ['QD', 'QE'], ['WO-2', 'WO-7'], 'Mary Kelly')]);
    const open = reqs(S).filter(q => q.status === 'open');
    rec('10a overlapping asks at the same moment: exactly ONE open request holds WO-2; the other PM is told in plain words', open.filter(q => q.seq_ids.includes('QD')).length === 1 && [ra, rb].filter(r => r.ok).length === 1 && /already has a change request waiting/.test(String((ra.ok ? rb : ra).err)), JSON.stringify([ra.ok, ra.err, rb.ok, rb.err]));
    await a.close(); await b.close();
    // Mary taken off P1: can she ask, withdraw or see John's answer?
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    askDate(S, 'R-J', 'QG', 'WO-9', '2026-11-06', '2026-11-03'); DS.reqUpdate(S.db, D.find(S.db, 'seq_requests', 'R-J'), { status: 'refused', decided_by: 'Pat Prod', answer: 'no' });
    const m = await pmDev(browser, S, 'Mary Kelly');
    const x = await m.page.evaluate(() => { const before = document.querySelectorAll('.pod-ovl').length; seqDateDlg('P1', ['QE'], 'set', null); const t1 = (document.getElementById('toast') || {}).textContent; const dlg = document.querySelectorAll('.seq-dtdlg').length; seqMoveReq('P1', 'QE', { up: true }, null); const t2 = (document.getElementById('toast') || {}).textContent; return { t1, dlg, t2, ans: !!document.querySelector('#seq-ans'), w: document.querySelectorAll('[data-seqrqw]').length }; });
    rec('10b PM of another project: no date tool, no move, no Withdraw, no one else\'s answers', x.dlg === 0 && /Read-only/.test(x.t1) && /Read-only/.test(x.t2) && !x.ans && x.w === 0, JSON.stringify(x));
    const n0 = reqs(S).length;
    const y = await m.page.evaluate(async () => { const r = await seqReqMake('P1', 'date', { ids: ['QA'], wos: ['WO-3'], change: { per: { 'WO-3': { deliv: '2026-10-30', due: '2026-10-27' } } }, preview: { rows: [] }, why: 'Production', by: 'Mary Kelly' }); return r; });
    rec('10c [info, LOW] seqReqMake called by a PM of ANOTHER project is NOT refused — only the buttons are hidden (the database has no per-project check until Stage 4 logins)', y.ok === true && reqs(S).length === n0 + 1, JSON.stringify(y).slice(0, 120));
    await m.close();
  }

  // ===== 11. lists switch turned OFF after requests exist; 360 px phone with many cards and long names
  P('11 switch off / phone');
  {
    const S = setup();
    for (let i = 0; i < 25; i++) { const id = 'QX' + i; X.seqRow(S, id, 'P1', { floor: 'T' + i, unit: String(i), name: 'H' }); DS.reqInsert(S.db, { id: 'R-P' + i, project_id: 'P1', kind: 'date', seq_ids: [id], wos: ['WO-LONGNAME-' + 'X'.repeat(40) + i], change: { per: {} }, preview: { rows: [{ wo: 'WO-LONG-' + 'Y'.repeat(60) + i, from: '2026-10-22', to: '2026-12-10', dFrom: '', dTo: '2026-12-15' }] }, why: 'Customer delay', note: 'N'.repeat(190), asked_by: 'Bartholomew Fitzgerald-O\'Shaughnessy' }); }
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { name: 'Aderrig Phase Two Residential Development Block ' + 'Z'.repeat(50) });
    const ph = await X.dev(browser, S, 'prod', { viewport: { width: 360, height: 740 } }); await reqPage(ph.page);
    const sp = await X.noScroll(ph.page), n = await ph.page.evaluate(() => document.querySelectorAll('#sr-pg .sr-card').length);
    const bh = await ph.page.evaluate(() => [...document.querySelectorAll('[data-srok],[data-srno]')].map(b => Math.round(b.getBoundingClientRect().height)));
    rec('11a phone 360 px, 25 cards with long names: no sideways scroll, all cards, buttons ≥ 44 px', sp.sw <= sp.cw + 1 && n >= 25 && bh.every(h => h >= 44), JSON.stringify([sp, n, Math.min(...bh)]));
    await ph.close();
    delete S.row.settings.listStore; delete S.row.settings.listStoreAt; S.row.version = (+S.row.version || 1) + 1;
    const pr = await X.dev(browser, S, 'prod'); await pr.page.evaluate(() => { prodTab = 'today'; render(); }); await sleep(300);
    const t = await pr.page.evaluate(() => ({ tab: !!document.querySelector('[data-prodtab="req"]'), ban: !!document.querySelector('.sr-ban'), txt: /change request|Late changes/i.test(document.body.innerText) }));
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    const u = await pm.page.evaluate(() => ({ seq: !!document.querySelector('[data-pmtab="seq"]'), ans: !!document.querySelector('#seq-ans') }));
    rec('11b switch OFF with 25 requests waiting: nothing of it shows (Production Manager or PM), no page errors', !t.tab && !t.ban && !t.txt && !u.seq && !u.ans && !(S.errors || []).length, JSON.stringify([t, u, S.errors]));
    await pr.close(); await pm.close();
  }

  // ===== 12. an old screen (version before requests) editing a fixed job: it changes it directly, no request, no 'direct' row
  P('12 old screen');
  {
    const S = setup(); askDate(S, 'R-OLD', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    const pm = await pmDev(browser, S, 'John Burke');
    // the old code's path: moveDates with no frozenDays / requestOnly (what every pre-B7 date tool called)
    await pm.page.evaluate(async () => { moveDates(['WO-7'], { per: { 'WO-7': { deliv: '2026-11-06', due: '2026-11-03' } } }, { why: 'Production' }, 'John Burke', { src: 'pmseq' }).apply(); await saveDB(); }); await sleep(800);
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    const c = await pr.page.evaluate(() => (document.querySelector('[data-srcard="R-OLD"]') || {}).innerText || '');
    rec('12 [info] old screen moved the fixed WO-7 straight through (no request, no direct row); the open request card then warns "changed since asked"', job(S, 'WO-7').dueDate === '2026-11-03' && /changed since asked/.test(c), JSON.stringify([job(S, 'WO-7').dueDate, c.slice(0, 200)]));
    await pm.close(); await pr.close();
  }

  // ===== 13. the Production Manager approves while his own edit is still unsaved (inside the 1.2 s save wait)
  P('13 unsaved edit + approve');
  {
    const S = setup(); askDate(S, 'R-U', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
    const pr = await prodDev(browser, S, 'Pat Prod'); await reqPage(pr.page);
    await pr.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-3').notes = "Pat's note — keep"; sched(); });
    await approve(pr.page, 'R-U', 3500);
    await pr.page.evaluate(async () => { await saveDB(); }); await sleep(800);
    rec('13 approving reloads the planner but keeps the Production Manager\'s unsaved note; the approved change lands too', job(S, 'WO-3').notes === "Pat's note — keep" && job(S, 'WO-7').delivDate === '2026-11-30', JSON.stringify([job(S, 'WO-3').notes, job(S, 'WO-7').delivDate]));
    await pr.close();
  }

  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
