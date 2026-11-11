// Manager issue 2 (11 Nov 2026, Job A after attack5): the date-history tidy (dueHistTidy, 5d70da8) must also work for a job that
// HAS a delivery date — a move then writes a due line AND a delivery line, so a stale screen's identical repeat is not straight
// after the first one. And a genuine back-and-forth (12 → 19, 19 → 12, 12 → 19) must all be kept, with and without a delivery date.
// Stubbed Supabase only (tests/harness.js + tests/stage1/srv.js). Run: node tests/dates/a5-histdedup.test.js
const H = require('../harness');
const { makeServer, open: openS } = require('../stage1/srv');
const res = [];
const rec = (n, ok, d) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 700) : '')); };
const NOW = '2026-11-10T10:00:00Z'; // Tue 10 Nov 2026, Wk 46
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
const HELP = `(()=>{
  window.W=ms=>new Promise(r=>setTimeout(r,ms));
  window.__g=w=>DB.orders.find(o=>o.wo===w);
  window.__why=async k=>{const b=document.querySelector('.pod-ovl [data-why="'+(k||'Customer delay')+'"]');if(b)b.click();await W(100);return !!b;};
  window.__closeAll=()=>document.querySelectorAll('.pod-ovl').forEach(o=>o.remove());
  window.__h=w=>(__g(w).dueHist||[]).map(h=>(h.f||'due')+' '+(h.from||'-')+'>'+(h.to||'-')+':'+(h.why||''));
})()`;
const prep = async t => { await t.page.evaluate(HELP); return t.page; };

(async () => {
  const browser = await H.chromium.launch();

  // 1. dueHistTidy on its own
  {
    const t = await openS(browser, makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [O('WO-1')] }), { now: NOW });
    const r = await t.page.evaluate(() => {
      const L = (at, f, from, to, why) => ({ at: '2026-11-10T1' + at + ':00:00Z', by: 'x', f, from, to, why, note: '', src: 'planner' });
      const s = a => dueHistTidy(a).map(h => h.f + ' ' + h.from + '>' + h.to + ':' + h.why);
      return {
        rep: s([L(1, 'due', '2026-11-12', '2026-11-19', 'B'), L(1, 'deliv', '2026-11-13', '2026-11-20', 'B'), L(2, 'due', '2026-11-12', '2026-11-19', 'A'), L(2, 'deliv', '2026-11-13', '2026-11-20', 'A')]),
        repNoDel: s([L(1, 'due', '2026-11-12', '2026-11-19', 'B'), L(2, 'due', '2026-11-12', '2026-11-19', 'A')]),
        bf: s([L(1, 'due', '2026-11-12', '2026-11-19', '1'), L(2, 'due', '2026-11-19', '2026-11-12', '2'), L(3, 'due', '2026-11-12', '2026-11-19', '3')]),
        bfDel: s([L(1, 'due', '2026-11-12', '2026-11-19', '1'), L(1, 'deliv', '2026-11-13', '2026-11-20', '1'), L(2, 'due', '2026-11-19', '2026-11-12', '2'), L(2, 'deliv', '2026-11-20', '2026-11-13', '2'), L(3, 'due', '2026-11-12', '2026-11-19', '3'), L(3, 'deliv', '2026-11-13', '2026-11-20', '3')]),
        delOnly: s([L(1, 'deliv', '2026-11-13', '2026-11-20', '1'), L(2, 'due', '2026-11-12', '2026-11-19', '2'), L(3, 'deliv', '2026-11-20', '2026-11-13', '3'), L(4, 'deliv', '2026-11-13', '2026-11-20', '4')]),
      };
    });
    rec('1a tidy: identical repeat of a move WITH a delivery date (due + delivery lines twice) is kept once — the first (B)', r.rep.length === 2 && r.rep.every(x => /:B$/.test(x)), JSON.stringify(r.rep));
    rec('1b tidy: identical repeat without a delivery date is kept once (unchanged behaviour)', r.repNoDel.length === 1 && /:B$/.test(r.repNoDel[0]), JSON.stringify(r.repNoDel));
    rec('1c tidy: genuine back-and-forth 12→19, 19→12, 12→19 (no delivery date) — all 3 kept', r.bf.length === 3, JSON.stringify(r.bf));
    rec('1d tidy: genuine back-and-forth with a delivery date — all 6 lines kept', r.bfDel.length === 6, JSON.stringify(r.bfDel));
    rec('1e tidy: delivery date back-and-forth with a due move in between — all 4 kept', r.delOnly.length === 4, JSON.stringify(r.delOnly));
    await t.close();
  }

  // 2. Two PCs, real screens: B moves WO-S a week (→ Wk) and saves; A's screen is stale and does the same → Wk. WO-S HAS a delivery date.
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [O('WO-S', { delivDate: '2026-11-13' })] });
    const A = await openS(browser, S, { now: NOW, viewport: { width: 1366, height: 1400 } }), B = await openS(browser, S, { now: NOW });
    await prep(A); await prep(B);
    await A.page.evaluate(async () => { showTab('d'); await W(100); });
    await B.page.evaluate(async () => { await loadDB(); showTab('d'); await W(100); document.querySelector('[data-wknext="WO-S"]').click(); await W(80); await __why('Customer delay'); __closeAll(); clearTimeout(saveT); await saveDB(); });
    const bh = await B.page.evaluate(() => __h('WO-S'));
    const a = await A.page.evaluate(async () => { const b = document.querySelector('[data-wknext="WO-S"]'); if (!b) return 'no button'; b.click(); await W(80); await __why('Production'); __closeAll(); clearTimeout(saveT); await saveDB(); await loadDB(); return 'ok'; });
    await B.page.evaluate(async () => { await loadDB(); });
    const g = p => p.evaluate(() => { const o = __g('WO-S'); return { due: o.dueDate, del: o.delivDate, h: __h('WO-S') }; });
    const fa = await g(A.page), fb = await g(B.page);
    const due = fa.h.filter(x => /^due /.test(x)), del = fa.h.filter(x => /^deliv /.test(x));
    rec('2a stale screen, job WITH a delivery date: B\'s move had a due line and a delivery line', bh.length === 2 && bh.some(x => /^deliv /.test(x)), JSON.stringify(bh));
    rec('2b both PCs end up the same, B\'s move is in the history once (due once, delivery once), A\'s identical repeat not recorded', a === 'ok' && JSON.stringify(fa) === JSON.stringify(fb) && due.length === 1 && del.length === 1 && fa.h.every(x => /Customer delay/.test(x)) && fa.due === '2026-11-19', JSON.stringify({ a, fa, fb }));
    rec('2: no page errors', ![...(A.server.errors || []), ...(B.server.errors || [])].length, [...(A.server.errors || []), ...(B.server.errors || [])].join(' | '));
    await A.close(); await B.close();
  }

  // 3. Two PCs: B does a genuine back-and-forth (12→19, 19→12, 12→19), saving each time; A (stale) changes the job's notes and saves —
  //    the merge runs the tidy on the result. With and without a delivery date.
  for (const withDel of [false, true]) {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [O('WO-B', withDel ? { delivDate: '2026-11-13' } : {})] });
    const A = await openS(browser, S, { now: NOW }), B = await openS(browser, S, { now: NOW });
    await prep(A); await prep(B);
    await B.page.evaluate(async withDel => {
      const steps = [['2026-11-19', '2026-11-20'], ['2026-11-12', '2026-11-13'], ['2026-11-19', '2026-11-20']];
      for (const [due, deliv] of steps) { await W(15); const m = moveDates(['WO-B'], withDel ? { due, deliv } : { due }, { why: 'Customer delay' }, 'B'); m.apply(); clearTimeout(saveT); await saveDB(); await loadDB(); }
    }, withDel);
    await A.page.evaluate(async () => { __g('WO-B').notes = 'stale A note'; clearTimeout(saveT); await saveDB(); await loadDB(); });
    await B.page.evaluate(async () => { await loadDB(); });
    const g = p => p.evaluate(() => { const o = __g('WO-B'); return { due: o.dueDate, del: o.delivDate || '', notes: o.notes, h: __h('WO-B') }; });
    const fa = await g(A.page), fb = await g(B.page);
    const due = fa.h.filter(x => /^due /.test(x)).map(x => x.split(':')[0]);
    const tag = withDel ? 'WITH a delivery date' : 'no delivery date';
    rec('3' + (withDel ? 'b' : 'a') + ' genuine back-and-forth 12→19, 19→12, 12→19, ' + tag + ': all 3 due moves kept' + (withDel ? ' and all 3 delivery moves' : '') + ' after a merge with another PC',
      JSON.stringify(fa) === JSON.stringify(fb) && fa.notes === 'stale A note' && fa.due === '2026-11-19' && due.length === 3 && due[0] === 'due 2026-11-12>2026-11-19' && due[1] === 'due 2026-11-19>2026-11-12' && due[2] === 'due 2026-11-12>2026-11-19'
      && (!withDel || (fa.h.filter(x => /^deliv /.test(x)).length === 3 && fa.del === '2026-11-20')), JSON.stringify({ fa, fb }));
    rec('3' + (withDel ? 'b' : 'a') + ': no page errors', ![...(A.server.errors || []), ...(B.server.errors || [])].length, [...(A.server.errors || []), ...(B.server.errors || [])].join(' | '));
    await A.close(); await B.close();
  }

  await browser.close();
  const f = res.filter(r => !r.ok).length;
  console.log(`\n${res.length - f} pass / ${f} fail`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
