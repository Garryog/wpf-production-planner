// Tester attack7 (3 Nov 2026) — quick checks of 6e1aec3: the "Release all" refusal message names the refused lines.
// 1, 5, 6, 7, 20 refused lines; odd names (emoji, <script>, quotes, very long); how the message fits a 380 px phone.
// Fake Supabase only (srv3.js). Run: node tests/stage3/attack7-relmsg.test.js
const A = require('./atk.js');
const { F, rec } = A;
(async () => {
  const browser = await F.H.chromium.launch();
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
  const P = await F.dev(browser, S, 'office', { viewport: { width: 380, height: 760 } });
  // names given as code strings so they run in the page
  const run = (n, nameSrc) => P.page.evaluate(({ n, nameSrc }) => {
    const name = nameSrc ? eval(nameSrc) : (i => 'Part ' + (i + 1)); const bad = [];
    for (let i = 0; i < n; i++) { const id = 'ZZ:' + i; LST.ln.set(id, { id, list_id: 'L1', part: name(i), material: 'MFC White' }); bad.push({ id, ok: false, why: i % 2 ? 'not-waiting' : 'stale', status: i % 2 ? 'todo' : 'cut', by: 'Dee', at: '2026-10-21T09:00:00Z' }); }
    return lqWhyAll(bad);
  }, { n, nameSrc });
  const named = (m, n) => Array.from({ length: n }, (_, i) => m.includes('"Part ' + (i + 1) + '"')).filter(Boolean).length;
  { const m = await run(1); rec('M1 one refused line: named in full, no "+ more"', named(m, 1) === 1 && !/more/.test(m), m); }
  { const m = await run(5); rec('M5 five refused: all five named', named(m, 5) === 5 && !/other line/.test(m), m); }
  { const m = await run(6); rec('M6 six refused: all six named (first in full + 5)', named(m, 6) === 6 && !/other line/.test(m), m); }
  { const m = await run(7); rec('M7 seven refused: six named + "and 1 other line" (singular)', named(m, 7) === 6 && /and 1 other line\)/.test(m), m); }
  { const m = await run(20); rec('M20 twenty refused: six named + "and 14 other lines", says +19 more', named(m, 20) === 6 && /\+19 more/.test(m) && /and 14 other lines\)/.test(m), m); }
  { const m = await run(3, "i => ['🪵 Side ☘️', '<script>window.__x=1</script>', \"O'Grady \\\"top\\\"\"][i]");
    rec('M-odd emoji / <script> / quotes in part names: named as typed', /🪵 Side ☘️/.test(m) && /<script>/.test(m) && /O'Grady "top"/.test(m), m); }
  { // the message goes to the toast (textContent, so no HTML runs) — and on a 380 px phone does it fit?
    const m = await run(6, "i => 'Carcass side panel left hand ' + (i + 1)");
    const r = await P.page.evaluate(m => { window.__x = 0; lqSay(m); const t = document.getElementById('toast'); const b = t.getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right), vw: innerWidth, html: t.innerHTML.includes('<script'), x: window.__x }; }, m);
    rec('M-phone (Medium) six long names on a 380 px phone: the whole message is on screen (toast is one line, nowrap)', r.left >= 0 && r.right <= r.vw, JSON.stringify(r) + ' len=' + m.length);
    const s = await P.page.evaluate(m => { lqSay(m); return new Promise(res => setTimeout(() => { const t = document.getElementById('toast'); res({ shown: t.classList.contains('show') }); }, 3000)); }, m);
    rec('M-time (Medium) a 400-character message is still showing 3 s later (toast hides after 2.5 s)', s.shown, JSON.stringify(s) + ' len=' + m.length);
    const x = await P.page.evaluate(() => { lqSay('<img src=x onerror="window.__x=2">'); return new Promise(r => setTimeout(() => r(window.__x), 300)); });
    rec('M-xss a refusal message with HTML in a part name runs nothing', !x, 'x=' + x);
  }
  await P.close(); await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
