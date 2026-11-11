// attack7 fix 2 (11 Nov 2026): dueHistTidy collapses two identical moves (same field, same from → to). PC clocks differ, so the
// "earlier" by `at` can be a stale screen's repeat — the line kept must be the richer one (request rq, fixed window fx,
// "approved by"), else the earlier. A genuine back-and-forth is still all kept. Stubbed Supabase only (tests/harness.js + stage1/srv.js).
// Run: node tests/seq/a7-histtidy.test.js
const H = require('../harness');
const { makeServer, open: openS } = require('../stage1/srv');
const res = [];
const rec = (n, ok, d) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 700) : '')); };
const NOW = '2026-11-10T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  const t = await openS(browser, makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [H.order({ wo: 'WO-1', dueDate: '2026-11-12' })] }), { now: NOW });
  const r = await t.page.evaluate(() => {
    const L = (m, f, from, to, by, x) => Object.assign({ at: '2026-11-10T10:' + String(m).padStart(2, '0') + ':00Z', by, f, from, to, why: 'w', note: '', src: 'planner' }, x || {});
    const s = a => dueHistTidy(a).map(h => h.f + ' ' + h.from + '>' + h.to + ' by ' + h.by + (h.rq ? ' rq' : '') + (h.fx ? ' fx' : ''));
    const APR = 'John Burke (approved by Pat Prod)', RQ = { rq: 'R-H', fx: 1 };
    // slow stale screen: its repeat is stamped 4 min EARLIER than the approval
    const slow = [L(1, 'due', '2026-10-28', '2026-11-25', 'Ann Office', { fx: 1 }), L(1, 'deliv', '2026-10-30', '2026-11-30', 'Ann Office', { fx: 1 }),
      L(5, 'due', '2026-10-28', '2026-11-25', APR, RQ), L(5, 'deliv', '2026-10-30', '2026-11-30', APR, RQ)];
    const same = [L(1, 'due', '2026-10-28', '2026-11-25', APR, RQ), L(1, 'deliv', '2026-10-30', '2026-11-30', APR, RQ),
      L(2, 'due', '2026-10-28', '2026-11-25', 'Ann Office', { fx: 1 }), L(2, 'deliv', '2026-10-30', '2026-11-30', 'Ann Office', { fx: 1 })];
    const plain = [L(1, 'due', '2026-11-12', '2026-11-19', 'B'), L(2, 'due', '2026-11-12', '2026-11-19', 'A')];
    const bf = [L(1, 'due', '2026-11-12', '2026-11-19', 'A'), L(2, 'due', '2026-11-19', '2026-11-12', APR, RQ), L(3, 'due', '2026-11-12', '2026-11-19', 'C'),
      L(4, 'due', '2026-11-19', '2026-11-12', 'D', { fx: 1 })];
    const keepPlace = [L(1, 'due', '2026-11-12', '2026-11-19', 'B'), L(2, 'deliv', '2026-11-13', '2026-11-20', 'B'), L(3, 'due', '2026-11-12', '2026-11-19', APR, RQ)];
    const once = dueHistTidy(slow);
    return { slow: s(slow), same: s(same), plain: s(plain), bf: s(bf), keepPlace: s(keepPlace), idem: JSON.stringify(dueHistTidy(once)) === JSON.stringify(once) };
  });
  const j = JSON.stringify(r);
  rec('a stale screen 5 min SLOW repeats the approved move: the approval\'s lines are kept (approved by, rq, fx), the repeat dropped', r.slow.length === 2 && r.slow.every(x => /approved by Pat Prod\) rq fx$/.test(x)), j);
  rec('b clocks right (approval first): the approval\'s lines kept, the repeat dropped', r.same.length === 2 && r.same.every(x => /approved by Pat Prod\) rq fx$/.test(x)), j);
  rec('c two plain identical moves: the earlier is kept (unchanged)', r.plain.length === 1 && / by B$/.test(r.plain[0]), j);
  rec('d genuine back-and-forth 12→19, 19→12 (request), 12→19, 19→12 (fixed window): all 4 kept, each with its own marks', r.bf.length === 4 && / by A$/.test(r.bf[0]) && /rq fx$/.test(r.bf[1]) && / by C$/.test(r.bf[2]) && / by D fx$/.test(r.bf[3]), j);
  rec('e the richer repeat takes the first one\'s place (delivery line still after it)', r.keepPlace.length === 2 && /^due .*rq fx$/.test(r.keepPlace[0]) && /^deliv /.test(r.keepPlace[1]), j);
  rec('f tidy twice = tidy once', r.idem, j);
  await t.close(); await browser.close();
  const f = res.filter(x => !x.ok).length;
  console.log(`\n${res.length - f} pass / ${f} fail`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
