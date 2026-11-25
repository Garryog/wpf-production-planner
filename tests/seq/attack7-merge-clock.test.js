// Tester attack 7 (11 Nov 2026) on feature/project-details-v2 after the Job A merge (de0d4dc) and B7 change requests.
//  Part 1  clock gap: the fake database stamps times with ITS clock (this Node process); the page clocks run 5 min FAST, exact
//          and 5 min SLOW. "Approved — not applied yet [Apply now]" must never show before 2 min of database time, and must show
//          by ~2 min + one refresh on every PC. Also: the scorecard week at Sunday night / Monday 00:xx with a skewed PC, and two
//          PCs with skewed clocks moving / repeating the same move (date-history tidy + merge use the PC's clock).
//  Part 2  the merge: Production Manager strip (lists ON with / without the sequence tables, lists OFF); his Deliveries page with a
//          fixed-window job (quick date, week-bar drop, Move ticked) while a sequence request is waiting; PM has no Deliveries;
//          L9 ⓘ buttons for the Production Manager on the merged card layout.
//  Part 3  date tools (bulk set / spread / push / preview / Undo) on the PM's sequence page across Irish bank holidays
//          (25 + 28 Dec 2026, 1 Jan, 17 Mar 2027), the 14 / 15-day window edge, a 360 px phone.
// Fake Supabase only (tests/seq/srvs.js on tests/harness.js — never the live one). Part 1 waits ~4.5 min of real time.
// Run: node tests/seq/attack7-merge-clock.test.js            (PARTS=1,2,3 to choose; LONG=1 waits up to 9 min for the slow PC)
const X = require('./fixs.js');
const { H, D, DS, rec, sleep } = X;
const PARTS = String(process.env.PARTS || '1,2,3').split(',');
const job = (S, wo) => S.row.orders.find(o => o.wo === wo);
const toast = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const closeDlg = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const reload = async p => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(300); };
const asWho = (p, n) => p.evaluate(n => sessionStorage.setItem('wpfWho', n), n);
const reqPage = async p => { await p.evaluate(() => { prodTab = 'req'; render(); }); await sleep(250); };
const iso = ms => new Date(ms).toISOString();
const HELP = `(()=>{window.W=ms=>new Promise(r=>setTimeout(r,ms));
  window.__why=async k=>{const b=document.querySelector('.pod-ovl [data-why="'+(k||'Customer delay')+'"]');const s=b?b.closest('.pod-in').textContent:'';if(b)b.click();await W(120);return s;};
  window.__closeAll=()=>document.querySelectorAll('.pod-ovl').forEach(o=>o.remove());
  window.__g=w=>DB.orders.find(o=>o.wo===w);
  window.__h=w=>(__g(w).dueHist||[]).map(h=>(h.f||'due')+' '+(h.from||'-')+'>'+(h.to||'-')+' by '+h.by+(h.rq?' rq':'')+(h.fx?' fx':''));})()`;
const askDate = (S, id, seq, wo, deliv, due, by) => DS.reqInsert(S.db, { id, project_id: 'P1', kind: 'date', seq_ids: [seq], wos: [wo], change: { per: { [wo]: { deliv, due } } }, preview: { rows: [{ wo, from: (job(S, wo) || {}).dueDate || '', to: due, dFrom: (job(S, wo) || {}).delivDate || '', dTo: deliv }] }, why: 'Customer delay', asked_by: by || 'John Burke' });
function baseRow(mut) {
  const r = X.v2Row();
  r.orders.push(H.order({ wo: 'WO-7', customer: 'Aderrig Homes', floor: 'T09', unit: '16', title: 'HOUSE TYPE F', dueDate: '2026-10-28', origDueDate: '2026-10-28', plannedWeek: '2026-10-26', delivDate: '2026-10-30', delv: true }));
  r.orders.push(H.order({ wo: 'WO-8', customer: 'Aderrig Homes', floor: 'T09', unit: '18', title: 'HOUSE TYPE H', dueDate: '2026-10-23', origDueDate: '2026-10-23', plannedWeek: '2026-10-19', delv: true }));
  r.orders.push(H.order({ wo: 'WO-10', customer: 'Aderrig Homes', floor: 'T09', unit: '19', title: 'HOUSE TYPE J', dueDate: '2026-10-22', origDueDate: '2026-10-22', plannedWeek: '2026-10-19', delv: true }));
  ['WO-1', 'WO-3'].forEach(w => { const o = r.orders.find(o => o.wo === w); if (o) o.delv = true; });
  if (mut) mut(r);
  return r;
}
function setup(opt = {}) {
  const S = X.makeServer(baseRow(opt.mut), opt);
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke', 'Mary Kelly'] });
  X.seqRow(S, 'QC', 'P1', { wo: 'WO-1', floor: 'GF', unit: '12' }); X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' });
  X.seqRow(S, 'QE', 'P1', { wo: 'WO-7', floor: 'T09', unit: '16' }); X.seqRow(S, 'QH', 'P1', { wo: 'WO-8', floor: 'T09', unit: '18' });
  X.seqRow(S, 'QJ', 'P1', { wo: 'WO-10', floor: 'T09', unit: '19' });
  return S;
}
const prodDev = async (browser, S, who, extra) => { const p = await X.dev(browser, S, 'prod', extra); await asWho(p.page, who); await reload(p.page); await p.page.evaluate(HELP); return p; };

(async () => {
  const browser = await H.chromium.launch();
  const P = name => console.log('\n--- ' + name);

  // =================================================================================================================== PART 1
  if (PARTS.includes('1')) {
    P('1a clock gap: "Apply now" on PCs 5 min fast / exact / 5 min slow vs the database clock');
    {
      const S = setup(); askDate(S, 'R-K', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
      const pages = {};
      for (const [k, skew] of [['fast', 300000], ['exact', 0], ['slow', -300000]]) {
        const p = await X.dev(browser, S, 'prod', { now: iso(Date.now() + skew) });
        await asWho(p.page, 'Pat ' + k); await reload(p.page); await reqPage(p.page); pages[k] = p;
      }
      // the claim lands NOW on the database's clock (Sean approved on another PC, his apply died before 'applied' was written)
      DS.reqUpdate(S.db, D.find(S.db, 'seq_requests', 'R-K'), { status: 'approved', decided_by: 'Sean Prod' });
      const t0 = Date.parse(D.find(S.db, 'seq_requests', 'R-K').decided_at);
      const first = {}, early = {}, ageAt = {};
      const LIMIT = process.env.LONG ? 560000 : 275000;
      while (Date.now() - t0 < LIMIT) {
        const dbAge = Date.now() - t0;
        for (const k of Object.keys(pages)) {
          const s = await pages[k].page.evaluate(() => { const q = LST.sr.get('R-K'); return { st: !!q && seqReqStuck(q), dom: !!document.querySelector('[data-srapply="R-K"]'), age: q ? srvAge(q.decided_at) : null, ban: ((document.getElementById('sr-pg') || {}).innerText || '').slice(0, 0) }; });
          ageAt[k] = [dbAge, s.age];
          if (s.st && first[k + 'St'] == null) first[k + 'St'] = dbAge;
          if (s.dom && first[k] == null) first[k] = dbAge;
          if ((s.st || s.dom) && dbAge < 120000) early[k] = dbAge;
        }
        if (first.fast != null && first.exact != null && first.slow != null) break;
        await sleep(2000);
      }
      const sec = v => v == null ? 'never (in ' + Math.round(LIMIT / 1000) + ' s)' : Math.round(v / 1000) + ' s';
      const info = JSON.stringify({ first: Object.fromEntries(Object.entries(first).map(([k, v]) => [k, sec(v)])), early, ageAt });
      console.log('   timings (database seconds after the claim): ' + info);
      rec('1a PC 5 min FAST: "Apply now" never shown (nor counted stuck) before 2 min of database time', early.fast == null && (first.fast == null || first.fast >= 120000), info);
      rec('1a PC with the right clock: "Apply now" shows by 2 min + one refresh (≤ 4 min 10 s) without anyone tapping', first.exact != null && first.exact <= 250000, info);
      rec('1a PC 5 min FAST: "Apply now" still shows by 2 min + one refresh (≤ 4 min 10 s)', first.fast != null && first.fast <= 250000, info);
      rec('1a [Manager condition 2] PC 5 min SLOW: "Apply now" shows by ~2 min + one refresh (≤ 4 min 10 s), not 5 min later', first.slow != null && first.slow <= 250000, info);
      rec('1a PC with the right clock: the screen counts it stuck by 2 min + one 10 s poll (the button may wait for the next redraw)', first.exactSt != null && first.exactSt <= 135000, info);
      for (const k of Object.keys(pages)) await pages[k].close();
      rec('1a no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    }

    P('1b scorecard "Late changes" week at Sunday night / Monday 00:xx with a skewed PC (Irish winter time = UTC)');
    {
      const S = setup();
      askDate(S, 'R-SUN', 'QE', 'WO-7', '2026-11-30', '2026-11-25'); D.find(S.db, 'seq_requests', 'R-SUN').asked_at = '2026-11-15T23:56:00.000Z';
      askDate(S, 'R-MON', 'QC', 'WO-1', '2026-12-01', '2026-11-26'); D.find(S.db, 'seq_requests', 'R-MON').asked_at = '2026-11-16T00:01:00.000Z';
      askDate(S, 'R-M30', 'QA', 'WO-3', '2026-12-11', '2026-12-08'); D.find(S.db, 'seq_requests', 'R-M30').asked_at = '2026-11-16T00:30:00.000Z';
      const out = {};
      // database time Mon 16 Nov 00:03: the fast PC reads 00:08 (same week), the slow PC reads Sun 23:58 (last week)
      for (const [k, at] of [['fast', '2026-11-16T00:08:00Z'], ['slow', '2026-11-15T23:58:00Z'], ['m30slow', '2026-11-16T00:25:00Z']]) {
        const p = await X.dev(browser, S, 'office', { now: at });
        out[k] = await p.page.evaluate(() => ({ thisWk: thisWk(), last: seqLateChanges('2026-11-09'), cur: seqLateChanges('2026-11-16'), card: (() => { const d = document.createElement('div'); d.innerHTML = scorecardHTML(1); const tr = d.querySelector('tbody tr'); return tr ? tr.innerText.replace(/\s+/g, ' ') : ''; })() }));
        await p.close();
      }
      const j = JSON.stringify(out);
      rec('1b a request asked Sun 23:56 counts in the week of 9 Nov, Mon 00:01 and 00:30 in the week of 16 Nov — the same on a fast and a slow PC (by the database\'s asked_at)', ['fast', 'slow', 'm30slow'].every(k => out[k].last === '1 (1 waiting)' && out[k].cur === '2 (2 waiting)'), j);
      rec('1b [info] slow PC at database Mon 00:03 still reads Sunday: its "This week (so far)" row is last week for those 5 minutes', out.slow.thisWk === '2026-11-09' && out.fast.thisWk === '2026-11-16', j);
    }

    P('1c two PCs with skewed clocks: the newer move by the database\'s order should win; identical repeat keeps the approval\'s line');
    {
      // control (both clocks right) and skew (A 5 min fast, B 5 min slow): A moves WO-3 first, B (not refreshed) moves it 3 s later
      const out = {};
      for (const [k, sa, sb] of [['same', 0, 0], ['skew', 300000, -300000]]) {
        const S = setup();
        const NOWMS = Date.parse(X.NOW);
        const A = await X.dev(browser, S, 'office', { now: iso(NOWMS + sa) }), B = await X.dev(browser, S, 'office', { now: iso(NOWMS + sb) });
        await A.page.evaluate(HELP); await B.page.evaluate(HELP);
        await A.page.evaluate(async () => { moveDates(['WO-3'], { due: '2026-12-10' }, { why: 'Production' }, 'Ann A').apply(); clearTimeout(saveT); await saveDB(); });
        await sleep(3000);
        await B.page.evaluate(async () => { moveDates(['WO-3'], { due: '2026-12-17' }, { why: 'Customer delay' }, 'Bob B').apply(); clearTimeout(saveT); await saveDB(); await W(400); });
        await A.page.evaluate(async () => { await loadDB(); });
        out[k] = { db: job(S, 'WO-3').dueDate, a: await A.page.evaluate(() => __g('WO-3').dueDate), b: await B.page.evaluate(() => __g('WO-3').dueDate), toastB: await toast(B.page), h: await A.page.evaluate(() => __h('WO-3')) };
        await A.close(); await B.close();
      }
      const j = JSON.stringify(out);
      rec('1c control: both clocks right — the later move (Bob, 17 Dec) wins on both PCs', out.same.db === '2026-12-17' && out.same.a === '2026-12-17', j);
      rec('1c PC clocks 10 min apart: the move made 3 s LATER (Bob, slow PC, 17 Dec) still wins — not the earlier one from the fast PC', out.skew.db === '2026-12-17' && out.skew.a === '2026-12-17' && out.skew.b === '2026-12-17', j);
      rec('1c … whichever wins, both PCs agree and the loser is told', out.skew.a === out.skew.b && out.skew.a === out.skew.db && (out.skew.db === '2026-12-17' || /chang|kept|other|newer/i.test(out.skew.toastB)), j);
    }
    {
      // identical repeat: Pat approves R-H (WO-7 → build 25 Nov / delivery 30 Nov, a request line rq fx). A stale office screen whose
      // clock is 5 min SLOW makes the same move a minute later; the history tidy keeps the EARLIEST by the PC clocks.
      const out = {};
      for (const [k, so] of [['same', 0], ['slow', -300000]]) {
        const S = setup(); askDate(S, 'R-H', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
        const NOWMS = Date.parse(X.NOW);
        const pr = await prodDev(browser, S, 'Pat Prod', { now: iso(NOWMS) });
        const of = await X.dev(browser, S, 'office', { now: iso(NOWMS + so) }); await of.page.evaluate(HELP);
        await reqPage(pr.page);
        await pr.page.evaluate(() => { const b = document.querySelector('[data-srok="R-H"]'); if (b) b.click(); }); await sleep(2500);
        await pr.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
        await sleep(1000);
        await of.page.evaluate(async () => { moveDates(['WO-7'], { due: '2026-11-25', deliv: '2026-11-30' }, { why: 'Production' }, 'Ann Office').apply(); clearTimeout(saveT); await saveDB(); await W(400); await loadDB(); });
        out[k] = { applied: !!D.find(S.db, 'seq_requests', 'R-H').applied, h: (job(S, 'WO-7').dueHist || []).map(h => (h.f || 'due') + ' ' + h.from + '>' + h.to + ' by ' + h.by + (h.rq ? ' rq' : '') + (h.fx ? ' fx' : '')) };
        await pr.close(); await of.close();
      }
      const j = JSON.stringify(out);
      rec('1c control: identical repeat from a stale screen → the approval\'s lines kept (by Pat Prod, rq fx), repeat dropped', out.same.applied && out.same.h.filter(x => /^due /.test(x)).length === 1 && out.same.h.every(x => /Pat Prod\)? rq fx/.test(x)), j);
      rec('1c stale screen 5 min SLOW repeats the approved move: history still credits the approval (Pat Prod, request, fixed window), not the repeat', out.slow.applied && out.slow.h.filter(x => /^due /.test(x)).length === 1 && out.slow.h.every(x => /Pat Prod\)? rq fx/.test(x)), j);
    }
  }

  // =================================================================================================================== PART 2
  if (PARTS.includes('2')) {
    P('2a Production Manager strip after the merge');
    {
      const strip = p => p.evaluate(() => ({ keys: [...document.querySelectorAll('#prod-strip [data-prodtab]')].map(b => b.dataset.prodtab), txt: [...document.querySelectorAll('#prod-strip button')].filter(b => !b.hidden).map(b => b.textContent.trim()), sent: !!document.getElementById('prod-sent'), n: document.querySelectorAll('#prod-strip').length }));
      const cases = [['lists ON + sequence tables', {}, ['today', 'req', 'deliv', 'lists', 'snags']], ['lists ON, sequence SQL not run', { noSeq: true }, ['today', 'deliv', 'lists', 'snags']], ['lists OFF', { off: true }, ['today', 'deliv']]];
      for (const [lbl, o, exp] of cases) {
        const S = setup({ noSeq: o.noSeq, mut: o.off ? r => { delete r.settings.listStore; delete r.settings.listStoreAt; } : null });
        if (!o.noSeq) askDate(S, 'R-1', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
        const pr = await prodDev(browser, S, 'Pat Prod');
        await pr.page.evaluate(() => { prodTab = 'today'; render(); }); await sleep(250);
        const a = await strip(pr.page);
        await pr.page.evaluate(() => { prodTab = 'deliv'; render(); }); await sleep(250);
        const b = await strip(pr.page);
        const reqTxt = a.txt.find(t => /Requests/.test(t)) || '';
        rec('2a ' + lbl + ': strip = ' + exp.join(' · ') + (o.off ? '' : ' (+ 📦 Items sent button)') + ' on Today and on Deliveries, shown once', a.keys.join() === exp.join() && b.keys.join() === exp.join() && a.n === 1 && b.n === 1 && (o.off ? !a.sent : a.sent), JSON.stringify([a, b]));
        if (!o.noSeq && !o.off) rec('2a ' + lbl + ': the button reads "✋ Requests (1)" with one waiting', /✋ Requests \(1\)/.test(reqTxt), reqTxt);
        rec('2a ' + lbl + ': no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
        await pr.close();
      }
    }

    P('2b Production Manager Deliveries: fixed-window job moved while a PM request for it is waiting');
    {
      const S = setup(); askDate(S, 'R-W', 'QE', 'WO-7', '2026-11-30', '2026-11-25');
      const pr = await prodDev(browser, S, 'Pat Prod', { viewport: { width: 1366, height: 1000 } });
      await pr.page.evaluate(() => { prodTab = 'deliv'; render(); }); await sleep(300);
      const r = await pr.page.evaluate(async () => {
        const out = { canMove: dateCanMove(), wkbar: !!document.getElementById('del-wkbar') };
        delTab = '1'; render(); await W(150); // WO-7 is due next week (Wk 44)
        const i = document.querySelector('.dq-in[data-dq="WO-7"][data-f="due"]'); out.hasEdit = !!i;
        if (i) { i.value = '2026-10-29'; i.dispatchEvent(new Event('change')); await W(120); out.dlg = (await __why('Production')).replace(/\s+/g, ' ').slice(0, 200); __closeAll(); }
        const o = __g('WO-7'); out.due = o.dueDate; out.last = (o.dueHist || []).slice(-1)[0] || null;
        clearTimeout(saveT); await saveDB(); return out;
      });
      rec('2b he can move a fixed-window job from Deliveries (quick date: build 28 → 29 Oct), saved with his name', r.canMove && r.hasEdit && r.due === '2026-10-29' && job(S, 'WO-7').dueDate === '2026-10-29' && r.last && r.last.by === 'Pat Prod', JSON.stringify(r));
      rec('2b … his Deliveries move does NOT turn into / need a change request (only the PM\'s request stays open)', S.db.t.seq_requests.filter(q => q.status === 'open').length === 1 && S.db.t.seq_requests.length === 1, JSON.stringify(S.db.t.seq_requests.map(q => [q.id, q.status])));
      rec('2b [Manager issue 3, Garry] a Deliveries move inside the 14 days is counted in Late changes as "direct" (history marked fixed window)', S.db.t.seq_requests.some(q => q.status === 'direct') && r.last && r.last.fx === 1, JSON.stringify({ last: r.last, reqs: S.db.t.seq_requests.map(q => q.status) }));
      await reqPage(pr.page);
      const card = await pr.page.evaluate(() => (document.querySelector('[data-srcard="R-W"]') || {}).innerText || '');
      rec('2b the waiting request\'s card now warns "⚠ changed since asked" (his Deliveries move came after it)', /changed since asked/.test(card), card.replace(/\s+/g, ' ').slice(0, 300));
      let conf = '';
      await pr.page.evaluate(() => { window.__cf = ''; window.confirm = m => { window.__cf = m; return true; }; });
      await pr.page.evaluate(() => { const b = document.querySelector('[data-srok="R-W"]'); if (b) b.click(); }); await sleep(2500);
      conf = await pr.page.evaluate(() => window.__cf || '');
      rec('2b the Approve confirm repeats the "⚠ changed since asked" line before overwriting his own move', /changed since asked/.test(conf), conf.replace(/\s+/g, ' ').slice(0, 300));
      rec('2b approved: exactly what was asked is made (build 25 Nov, delivery 30 Nov), applied recorded', job(S, 'WO-7').dueDate === '2026-11-25' && job(S, 'WO-7').delivDate === '2026-11-30' && !!D.find(S.db, 'seq_requests', 'R-W').applied, JSON.stringify([job(S, 'WO-7').dueDate, job(S, 'WO-7').delivDate]));
      await closeDlg(pr.page);
      // week-bar drop (real drag) of a fixed-window card from a project with a sequence, then Move ticked incl. a fixed-window job
      await pr.page.evaluate(() => { prodTab = 'deliv'; delTab = '0'; delSel.clear(); render(); }); await sleep(300);
      const has8 = await pr.page.locator('.dchip[data-dw="WO-8"] .dchip-t').count();
      if (has8) { await pr.page.locator('.dchip[data-dw="WO-8"] .dchip-t').scrollIntoViewIfNeeded(); await pr.page.locator('.dchip[data-dw="WO-8"] .dchip-t').dragTo(pr.page.locator('#wkb-next')); await sleep(200); }
      const w8 = await pr.page.evaluate(async () => { const ov = [...document.querySelectorAll('.pod-ovl')].map(o => o.textContent.replace(/\s+/g, ' ').slice(0, 160)); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(80); await __why('Production'); __closeAll(); const o = __g('WO-8'); return { ov, due: o.dueDate, wk: o.plannedWeek, by: ((o.dueHist || []).slice(-1)[0] || {}).by }; });
      rec('2b real drag of WO-8 (fixed window, project with a sequence) onto Next ▶ → Fri 23 → Fri 30 Oct, Wk 44, by him', has8 && w8.due === '2026-10-30' && w8.wk === '2026-10-26' && w8.by === 'Pat Prod', JSON.stringify({ has8, w8 }));
      const seqOk = await pr.page.evaluate(async () => { await seqFresh('P1'); const r = [...LST.sq.values()].find(x => x.wo === 'WO-8'); return { live: !!r && !r.removed_at, wo: r && r.wo, req: r && r.req_date }; });
      rec('2b … the sequence row of WO-8 is untouched (still matched, still live)', seqOk.live && seqOk.wo === 'WO-8', JSON.stringify(seqOk));
      const mt = await pr.page.evaluate(async () => {
        delSel.clear(); ['WO-10', 'WO-1'].forEach(w => delSel.add(w)); render(); await W(80);
        const bar = ((document.querySelector('.selbar') || {}).textContent || '').replace(/\s+/g, ' ');
        const b = document.getElementById('selwk'); if (!b) return { bar, err: 'no Move ticked button' };
        b.click(); await W(80);
        const pk = document.querySelector('#wkpick-dlg [data-wkp="2026-11-09"]'); if (!pk) return { bar, err: 'no Wk 46 in picker', pick: (document.getElementById('wkpick-dlg') || {}).textContent };
        pk.click(); await W(80); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(80); await __why('Customer delay');
        const sum = ((document.getElementById('date-sum') || {}).textContent || '').replace(/\s+/g, ' '); __closeAll();
        clearTimeout(saveT); await saveDB();
        return { bar, sum: sum.slice(0, 200), d10: __g('WO-10').dueDate, d1: __g('WO-1').dueDate };
      });
      rec('2b Move ticked to week… (WO-10 + WO-1, both inside the window) → Wk 46, both moved, no request made', !mt.err && /2026-11-(09|1[0-3])/.test(mt.d10) && /2026-11-(09|1[0-3])/.test(mt.d1) && S.db.t.seq_requests.every(q => q.status !== 'open'), JSON.stringify(mt));
      rec('2b no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await pr.close();
    }

    P('2c the PM view has no way to move dates from Deliveries');
    {
      const S = setup();
      const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
      const r = await pm.page.evaluate(async () => { pmTab = ''; render(); await new Promise(r => setTimeout(r, 200));
        const a = { canMove: dateCanMove(), delivBtn: !!document.querySelector('[data-prodtab="deliv"],[data-pmtab="deliv"]'), wkbar: !!document.getElementById('del-wkbar'), dq: document.querySelectorAll('.dq-in,[data-wknext],#selwk').length };
        tab = 'd'; delTab = '0'; render(); await new Promise(r => setTimeout(r, 200));
        a.forced = { wkbar: !!document.getElementById('del-wkbar'), dq: document.querySelectorAll('.dq-in,[data-wknext],#selwk').length };
        return a; });
      rec('2c PM: dateCanMove false, no Deliveries tab, no week bar / quick date / → Wk / Move ticked — even with tab = d forced', !r.canMove && !r.delivBtn && !r.wkbar && !r.dq && !r.forced.wkbar && !r.forced.dq, JSON.stringify(r));
      await pm.close();
    }

    P('2d L9 ⓘ for the Production Manager on the merged card layout');
    {
      const S = setup();
      for (const vw of [{ width: 1366, height: 900 }, { width: 360, height: 760 }]) {
        const pr = await prodDev(browser, S, 'Pat Prod', { viewport: vw });
        await pr.page.evaluate(() => { prodTab = 'deliv'; render(); }); await sleep(300);
        const c = await pr.page.evaluate(() => ({ ok: l9Ok(), cards: [...document.querySelectorAll('.dchip')].map(c => ({ wo: c.dataset.dw, i: !!c.querySelector('[data-dinfo]'), ov: c.scrollWidth > c.clientWidth + 1 })), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        const open = async wo => pr.page.evaluate(async wo => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); const b = document.querySelector('.dchip [data-dinfo="' + wo + '"]'); if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 150)); const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (!o) return { none: true };
          const r = o.querySelector('.pod-in').getBoundingClientRect(); return { add: [...o.querySelectorAll('[data-l9add]')].map(b => b.dataset.l9add), open: [...o.querySelectorAll('[data-l9open]')].map(b => b.dataset.l9open), h: [...o.querySelectorAll('.l9-btn')].map(b => Math.round(b.getBoundingClientRect().height)), fits: r.left >= 0 && r.right <= innerWidth + 1 }; }, wo);
        const d1 = await open('WO-1'), d3 = await open('WO-3');
        const n = vw.width;
        rec('2d [' + n + '] Production Manager: l9Ok, ⓘ on the job cards (WO-1, WO-8, WO-10), nothing spills, no sideways scroll', c.ok && ['WO-1', 'WO-8', 'WO-10'].every(w => (c.cards.find(x => x.wo === w) || {}).i) && c.cards.every(x => !x.ov) && c.sw <= c.cw + 1, JSON.stringify(c));
        rec('2d [' + n + '] ⓘ WO-1 (has list L1) → [📂 Open list]; ⓘ WO-3 (none) → [＋ Add cutting list]; buttons ≥ ' + (n < 600 ? 44 : 36) + ' px; window fits', d1 && d1.open.join() === 'L1' && (!d3 || d3.add.join() === 'WO-3') && [d1, d3].filter(Boolean).every(d => d.fits && d.h.every(h => h >= (n < 600 ? 44 : 36))), JSON.stringify([d1, d3]));
        await pr.close();
      }
      rec('2d no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    }
  }

  // =================================================================================================================== PART 3
  if (PARTS.includes('3')) {
    P('3 date tools across Irish bank holidays; today Mon 14 Dec 2026 (window to Mon 28 Dec, a bank holiday)');
    const T3 = '2026-12-14T10:00:00Z';
    const mk = () => {
      const S = X.makeServer(baseRow(r => {
        const add = (wo, unit, due, deliv) => r.orders.push(H.order({ wo, customer: 'Aderrig Homes', floor: 'T30', unit, title: 'HOUSE ' + unit, dueDate: due, origDueDate: due, plannedWeek: '', delivDate: deliv }));
        add('WO-A', '1', '2026-12-28', '2026-12-31'); // build on day 14 (bank holiday) → fixed
        add('WO-B', '2', '2026-12-29', '2027-01-04'); // build day 15 → free
        add('WO-C', '3', '2027-01-05', '2027-01-08');
        add('WO-D', '4', '2027-03-15', '2027-03-18');
      }));
      D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
      X.seqRow(S, 'SA', 'P1', { wo: 'WO-A', floor: 'T30', unit: '1' }); X.seqRow(S, 'SB', 'P1', { wo: 'WO-B', floor: 'T30', unit: '2' });
      X.seqRow(S, 'SC', 'P1', { wo: 'WO-C', floor: 'T30', unit: '3' }); X.seqRow(S, 'SD', 'P1', { wo: 'WO-D', floor: 'T30', unit: '4' });
      X.seqRow(S, 'SW', 'P1', { floor: 'T30', unit: '5', product: 'K8', name: 'HOUSE 5', req_date: '2027-03-10' });
      return S;
    };
    const tick = (p, ids) => p.evaluate(ids => { document.querySelectorAll('[data-seqtick]').forEach(b => { const on = ids.includes(b.dataset.seqtick); if (b.checked !== on) { b.checked = on; b.onchange(); } }); }, ids);
    const pj = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(o => o.wo === wo); return (o.dueDate || '') + '/' + (o.delivDate || ''); }, wo);
    const S = mk();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' }, now: T3 });
    await pm.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(300);
    const lock = await pm.page.evaluate(() => ['SA', 'SB'].map(id => { const b = document.querySelector('[data-seqdate="' + id + '"]'); return b ? b.title : 'no button'; }));
    rec('3a window edge: WO-A (build Mon 28 Dec = day 14) shows fixed, WO-B (build Tue 29 Dec = day 15) is free', /fixed window/.test(lock[0]) && !/fixed window/.test(lock[1]), JSON.stringify(lock));
    // push WO-B later 1 working day: 29 Dec → 30 Dec, delivery Mon 4 Jan → Tue 5 Jan
    await tick(pm.page, ['SB']); await X.dtOpen(pm.page, '[data-seqtool="push"]'); await sleep(200);
    await X.dtFill(pm.page, { 'sd-dir': '1', 'sd-n': '1', 'sd-u': 'wd' }); let pv = await X.dtWhy(pm.page, 'Production');
    await X.dtSave(pm.page); await closeDlg(pm.page);
    rec('3b push WO-B (free, day 15) later 1 working day → build 30 Dec, delivery Tue 5 Jan; changed at once', await pj(pm.page, 'WO-B') === '2026-12-30/2027-01-05' && !S.db.t.seq_requests.length, (await pj(pm.page, 'WO-B')) + ' | ' + pv.prev);
    // pull WO-B earlier 2 working days: build 30 Dec → 29 → 24 Dec (25, 26, 27, 28 skipped) = inside → a request, nothing changed
    await pm.page.evaluate(() => render()); await tick(pm.page, ['SB']); await X.dtOpen(pm.page, '[data-seqtool="push"]'); await sleep(200);
    await X.dtFill(pm.page, { 'sd-dir': '-1', 'sd-n': '2', 'sd-u': 'wd' }); pv = await X.dtWhy(pm.page, 'Production');
    rec('3c pull WO-B earlier 2 working days (30 Dec → Thu 24 Dec, over 25–28 Dec) → preview says it needs the Production Manager', /Production Manager/.test(pv.prev) && /24 Dec/.test(pv.prev + pv.line), pv.line + ' | ' + pv.prev);
    await X.dtSave(pm.page); await closeDlg(pm.page);
    const rq = S.db.t.seq_requests.find(q => q.status === 'open');
    rec('3c … ONE request: build 24 Dec, delivery 31 Dec (5 Jan − 2 wd: 1 Jan skipped); WO-B not changed yet', !!rq && rq.change.per['WO-B'].due === '2026-12-24' && rq.change.per['WO-B'].deliv === '2026-12-31' && await pj(pm.page, 'WO-B') === '2026-12-30/2027-01-05', JSON.stringify(rq && rq.change));
    // bulk set: WO-C required Mon 4 Jan → build 29 Dec (31, 30, 29; 1 Jan skipped) = day 15, free
    await pm.page.evaluate(() => render()); await tick(pm.page, ['SC']); await X.dtOpen(pm.page, '[data-seqtool="set"]'); await sleep(200);
    await X.dtFill(pm.page, { 'sd-date': '2027-01-04' }); pv = await X.dtWhy(pm.page, 'Site not ready');
    const sug = await pm.page.evaluate(() => (document.querySelector('.seq-dtdlg #sd-sug') || {}).textContent || '');
    rec('3d set required Mon 4 Jan 2027 → "build 29 Dec" (1 Jan skipped), free → saved at once', /build .*29 Dec/.test(sug) && pv.ok, sug + ' | ' + pv.prev);
    await X.dtSave(pm.page); await closeDlg(pm.page);
    rec('3d … WO-C build 29 Dec / delivery 4 Jan', await pj(pm.page, 'WO-C') === '2026-12-29/2027-01-04', await pj(pm.page, 'WO-C'));
    // bulk set onto a bank holiday: Fri 1 Jan 2027 — warned in the dialog
    await pm.page.evaluate(() => render()); await tick(pm.page, ['SD']); await X.dtOpen(pm.page, '[data-seqtool="set"]'); await sleep(200);
    await X.dtFill(pm.page, { 'sd-date': '2027-03-17' }); pv = await X.dtWhy(pm.page, 'Site not ready');
    const sug2 = await pm.page.evaluate(() => (document.querySelector('.seq-dtdlg #sd-sug') || {}).textContent || '');
    // (rule changed by Garry 11 Nov): a Set onto a bank holiday is MOVED to the next delivery day and the preview says so
    rec('3e set required Wed 17 Mar 2027 (St Patrick\'s Day) → moved to Thu 18 Mar, said before Save (Garry 11 Nov)', /17 Mar is a bank holiday[\s\S]*moved to 18 Mar/.test(sug2), sug2 + ' | ' + pv.prev);
    await closeDlg(pm.page);
    // spread 3 houses from Tue 16 Mar 2027, 1 per working day → 16, 18, 19 Mar (17 skipped); builds 11, 12, 15 Mar
    await pm.page.evaluate(() => render()); await tick(pm.page, ['SC', 'SD', 'SW']); await X.dtOpen(pm.page, '[data-seqtool="spread"]'); await sleep(200);
    await X.dtFill(pm.page, { 'sd-start': '2027-03-16', 'sd-pace': 'wday' }); pv = await X.dtWhy(pm.page, 'Site not ready');
    const tb = await pm.page.evaluate(() => [...document.querySelectorAll('.seq-sptbl tr')].slice(1).map(tr => tr.cells[2].innerText));
    rec('3f spread 1 house per working day from Tue 16 Mar 2027 → 16, 18, 19 Mar (St Patrick\'s Day skipped)', tb.length === 3 && /16 Mar/.test(tb[0]) && /18 Mar/.test(tb[1]) && /19 Mar/.test(tb[2]), JSON.stringify(tb));
    await X.dtSave(pm.page); await closeDlg(pm.page);
    const sp = [await pj(pm.page, 'WO-C'), await pj(pm.page, 'WO-D'), D.find(S.db, 'project_seq', 'SW').req_date];
    rec('3f … saved: WO-C 11/16 Mar, WO-D 12/18 Mar (17 skipped), waiting row 19 Mar', sp[0] === '2027-03-11/2027-03-16' && sp[1] === '2027-03-12/2027-03-18' && sp[2] === '2027-03-19', JSON.stringify(sp));
    // Undo puts all three back
    await pm.page.evaluate(() => render()); await sleep(150);
    const ub = await pm.page.evaluate(() => (document.querySelector('#seq-undo') || {}).textContent || '');
    await pm.page.evaluate(() => { const b = document.querySelector('#seq-undo'); if (b) b.click(); }); await sleep(1800);
    await pm.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); await sleep(400);
    const un = [await pj(pm.page, 'WO-C'), await pj(pm.page, 'WO-D'), D.find(S.db, 'project_seq', 'SW').req_date, job(S, 'WO-C').dueDate];
    rec('3g ↶ Undo (10 min) after the spread → WO-C 29 Dec / 4 Jan, WO-D 15 / 18 Mar, waiting row 10 Mar (also in the database)', /Undo \(10 min\)/.test(ub) && un[0] === '2026-12-29/2027-01-04' && un[1] === '2027-03-15/2027-03-18' && un[2] === '2027-03-10' && un[3] === '2026-12-29', ub + ' ' + JSON.stringify(un));
    // push by weeks onto Christmas: WO-B delivery Tue 5 Jan − 2 weeks = Tue 22 Dec... and WO-A (fixed) + 1 week by the PM = asked
    await pm.page.evaluate(() => render()); await tick(pm.page, ['SA']); await X.dtOpen(pm.page, '[data-seqtool="push"]'); await sleep(200);
    await X.dtFill(pm.page, { 'sd-dir': '-1', 'sd-n': '1', 'sd-u': 'wk' }); pv = await X.dtWhy(pm.page, 'Production');
    rec('3h WO-A (fixed) earlier 1 week by the PM: build Mon 28 Dec − 1 wk = 21 Dec, delivery 31 → 24 Dec; needs the Production Manager', /Production Manager/.test(pv.prev) && /21 Dec/.test(pv.prev + pv.line), pv.line + ' | ' + pv.prev);
    await closeDlg(pm.page);
    rec('3 PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
    // a delivery booked for a Saturday (allowed on Deliveries) pushed 1 week by the sequence tool
    {
      const S2 = X.makeServer(baseRow(r => r.orders.push(H.order({ wo: 'WO-S', customer: 'Aderrig Homes', floor: 'T31', unit: '1', title: 'SAT', dueDate: '2027-01-13', origDueDate: '2027-01-13', plannedWeek: '', delivDate: '2027-01-16' }))));
      D.update(S2.db, 'projects', D.find(S2.db, 'projects', 'P1'), { pms: ['John Burke'] });
      X.seqRow(S2, 'SS', 'P1', { wo: 'WO-S', floor: 'T31', unit: '1' });
      const p2 = await X.dev(browser, S2, 'pm', { me: { pm: 'John Burke' }, now: T3 });
      await p2.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(300);
      await tick(p2.page, ['SS']); await X.dtOpen(p2.page, '[data-seqtool="push"]'); await sleep(200);
      await X.dtFill(p2.page, { 'sd-dir': '1', 'sd-n': '1', 'sd-u': 'wk' }); await X.dtWhy(p2.page, 'Production'); await X.dtSave(p2.page); await closeDlg(p2.page);
      const v = await pj(p2.page, 'WO-S');
      rec('3i [Low] a Saturday delivery (Sat 16 Jan, allowed on Deliveries) pushed 1 week stays a Saturday (Sat 23 Jan), not moved to Monday', v === '2027-01-20/2027-01-23', v);
      await p2.close();
    }
    // 360 px phone: push dialog + preview + Save reachable, Undo button big enough
    {
      const S3 = mk();
      const ph = await X.dev(browser, S3, 'pm', { me: { pm: 'John Burke' }, now: T3, viewport: { width: 360, height: 740 } });
      await ph.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(300);
      await tick(ph.page, ['SB', 'SC', 'SD', 'SW']); await X.dtOpen(ph.page, '[data-seqtool="spread"]'); await sleep(200);
      await X.dtFill(ph.page, { 'sd-start': '2026-12-22', 'sd-pace': 'nweek', 'sd-pn': '2' }); await X.dtWhy(ph.page, 'Production');
      const g = await ph.page.evaluate(() => { const o = document.querySelector('.seq-dtdlg'), b = o.querySelector('#sd-ok'), r = b.getBoundingClientRect(), t = o.querySelector('.seq-sptbl'); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ok: r.left >= 0 && r.right <= innerWidth + 1 && r.height >= 40, tblW: t ? Math.round(t.getBoundingClientRect().right) : 0, w: innerWidth, rows: t ? t.rows.length : 0 }; });
      rec('3j phone 360 px: spread over Christmas — preview table, Save in reach (≥ 40 px), no sideways scroll', g.ok && g.sw <= g.cw + 1 && g.tblW <= g.w + 1 && g.rows >= 4, JSON.stringify(g));
      const tb2 = await ph.page.evaluate(() => [...document.querySelectorAll('.seq-sptbl tr')].slice(1).map(tr => tr.cells[2].innerText).join(' '));
      rec('3j … 2 houses per week from Tue 22 Dec never lands on 25–28 Dec or 1 Jan', !/2[5-8] Dec|1 Jan/.test(tb2), tb2);
      await X.dtSave(ph.page); await closeDlg(ph.page); await ph.page.evaluate(() => render()); await sleep(200);
      const u = await ph.page.evaluate(() => { const b = document.querySelector('#seq-undo'); if (!b) return null; const r = b.getBoundingClientRect(); return { h: Math.round(r.height), in: r.left >= 0 && r.right <= innerWidth + 1 }; });
      rec('3j phone: ↶ Undo shown after Save, ≥ 40 px tall, on screen', !!u && u.h >= 40 && u.in, JSON.stringify(u));
      rec('3j phone: no page errors', !(S3.errors || []).length, JSON.stringify(S3.errors));
      await ph.close();
    }
  }

  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
