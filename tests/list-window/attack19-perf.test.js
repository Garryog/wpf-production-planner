// Tester attack (19 Nov) h19: render time with 600 jobs (each with a list, a step) on Saw, Stores, PM board, Capacity Board,
// Lists page and Deliveries. Prints ms per render(); compare against the same file run on the pre-h19 index.html.
// Fails only if a screen takes over 1500 ms per render. Fake Supabase only.
// Run: node tests/list-window/attack19-perf.test.js
const L = require('./lw.js');
const { X, sleep, rec, finish } = L;
const N = +(process.env.N || 600);
const STEPS = ['4. READY FOR PRODUCTION', '5. WORK ORDER PROCESSED', '6. JOB CUT COMPLETE', '7. ASSEMBLY COMPLETE'];

(async () => {
  const browser = await X.H.chromium.launch();
  const out = {};
  try {
    const r = X.v2Row({ listChk: true });
    for (let i = 0; i < N; i++) r.orders.push(X.H.order({ wo: 'WO-' + (1000 + i), customer: 'Aderrig Homes', floor: 'T' + (i % 20), unit: String(i), title: 'HOUSE ' + i, dueDate: '2026-10-2' + (i % 9), origDueDate: '2026-10-2' + (i % 9), step: STEPS[i % 4], delv: i % 3 === 0 }));
    const S = X.makeServer(r);
    for (let i = 0; i < N; i++) if (i % 2 === 0) X.F3.seedList(S, 'PL' + i, { name: 'List ' + i, wos: ['WO-' + (1000 + i)], list: { check_req: true, checked_at: i % 4 === 0 ? '2026-10-20T08:00:00.000Z' : null, checked_by: 'Ann', sent_at: '2026-10-20T08:00:00.000Z' } });
    const time = async (page, setup, label) => {
      await page.evaluate(setup); await sleep(300);
      const ms = await page.evaluate(() => { render(); const t0 = performance.now(); for (let k = 0; k < 5; k++) render(); return (performance.now() - t0) / 5; });
      out[label] = Math.round(ms); console.log('TIME ' + label + ' ' + Math.round(ms) + ' ms');
      rec(label + ' renders under 1500 ms with ' + N + ' jobs', ms < 1500, Math.round(ms) + ' ms');
    };
    for (const role of ['saw', 'stores', 'pm', 'office']) {
      const t = await X.dev(browser, S, role, { viewport: { width: 1400, height: 900 } }), p = t.page;
      await p.evaluate(() => { window.confirm = () => true; window.prompt = () => 'Op'; });
      if (role === 'office') {
        await time(p, () => { showTab('b'); }, 'office Capacity Board');
        await time(p, () => { showTab('l'); }, 'office Lists page');
        await time(p, () => { showTab('d'); }, 'office Deliveries');
      } else await time(p, () => {}, role + ' screen');
      await p.close().catch(() => {});
    }
  } catch (e) { rec('test ran without crashing', false, e.stack); }
  console.log('RESULT ' + JSON.stringify(out));
  await browser.close(); finish();
})();
