// Tester attack7 (3 Nov 2026) — quick checks of c02ea0d: combined-list house labels ("House 1 (2)" really named,
// "constructor"/"toString"/"__proto__" houses, emoji, <script>), on screen and in the printed combined list.
// Stubbed Supabase only (tests/stage1/srv.js). Run: node tests/sawstores/attack7-labels.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 500) : '')); };
const NOW = '2026-10-21T09:00:00Z';
const mk = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 1, fit: 0, wos: ['WO-1'], up: NOW }], listWBs: { W1: { project: 'Proj', sheets: { H1: [{ k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' }] } } } } });
(async () => {
  const browser = await H.chromium.launch();
  const S = makeServer(mk());
  const A = await open(browser, S, { now: NOW, role: 'saw' });
  const errs = []; A.page.on('pageerror', e => errs.push(String(e)));
  await A.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); window.__xss = 0; render(); });
  const run = houses => A.page.evaluate(houses => {
    DB.listWBs.WQ = { sheets: {} }; DB.listRow = DB.listRow || {}; DB.listHold = DB.listHold || {};
    const ls = houses.map((h, i) => { const id = 'Q' + i; DB.listWBs.WQ.sheets['S' + i] = h.rows || [{ k: 'saw', item: 'Side', qty: h.q || 2, L: 2440, W: 600, mat: 'MFC White', note: '' }]; DB.listRow[id] = {}; DB.listHold[id] = {};
      return { id, wb: 'WQ', sheet: 'S' + i, name: h.name, project: h.project, wos: ['WO-1'], saw: 1, fit: 0 }; });
    const rows = combineLists(ls, 'saw').map(x => ({ qty: x.qty, per: Object.entries(x.per) }));
    document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    openCombined(ls, 'saw');
    const ov = document.querySelector('.pod-ovl');
    const chips = [...ov.querySelectorAll('.ph-chip')].map(c => c.textContent.trim());
    const head = [...ov.querySelectorAll('.pod-in > div:nth-child(3) > div')].map(d => d.textContent.trim());
    const scripts = ov.querySelectorAll('script,img,svg').length;
    ov.remove();
    return { rows, chips, head, scripts, xss: window.__xss };
  }, houses);
  {
    const c = await run([{ name: '__proto__', q: 1 }, { name: 'toString', q: 2 }, { name: 'constructor', q: 3 }, { name: 'hasOwnProperty', q: 4 }, { name: 'valueOf', q: 5 }]);
    const per = Object.fromEntries(c.rows[0].per);
    rec('K1 houses "__proto__", "toString", "constructor", "hasOwnProperty", "valueOf": each its own qty, total 15',
      c.rows.length === 1 && c.rows[0].qty === 15 && per.__proto__ === 1 && per.toString === 2 && per.constructor === 3 && per.hasOwnProperty === 4 && per.valueOf === 5 && c.chips.length === 5, JSON.stringify(c));
  }
  {
    const c = await run([{ name: '__proto__', q: 1 }, { name: '__proto__', q: 2 }]);
    rec('K2 two houses both called "__proto__" → "__proto__" and "__proto__ (2)", own quantities', JSON.stringify(c.rows[0].per) === JSON.stringify([['__proto__', 1], ['__proto__ (2)', 2]]), JSON.stringify(c));
  }
  {
    const c = await run([{ name: 'House 1', q: 1 }, { name: 'House 1', q: 2 }, { name: 'House 1 (2)', q: 3 }, { name: 'House 1 (2)', q: 4 }, { name: 'House 1 (2) (2)', q: 5 }]);
    const labels = c.rows[0].per.map(x => x[0]);
    rec('K3 "House 1"×2, "House 1 (2)"×2, real "House 1 (2) (2)": five different labels, every real name kept by its own list, total 15',
      new Set(labels).size === 5 && c.rows[0].qty === 15 && c.rows[0].per.find(x => x[0] === 'House 1 (2) (2)')[1] === 5 && c.rows[0].per.find(x => x[0] === 'House 1 (2)')[1] === 3 && c.head.length === 5 && new Set(c.head).size === 5, JSON.stringify({ per: c.rows[0].per, head: c.head }));
  }
  {
    const c = await run([{ name: 'House 1', q: 1 }, { name: 'House 1', q: 2 }, { name: 'House 1', q: 3 }, { name: 'House 1 (3)', q: 4 }]);
    rec('K4 three "House 1" + a real "House 1 (3)": repeats become (2) and (4), the real (3) keeps 4', JSON.stringify(c.rows[0].per) === JSON.stringify([['House 1', 1], ['House 1 (2)', 2], ['House 1 (4)', 3], ['House 1 (3)', 4]]) || (c.rows[0].per.find(x => x[0] === 'House 1 (3)') || [])[1] === 4 && new Set(c.rows[0].per.map(x => x[0])).size === 4, JSON.stringify(c.rows[0].per));
  }
  {
    const c = await run([{ name: '🏠 Casa ☘️', q: 1 }, { name: '🏠 Casa ☘️', q: 2 }, { name: "O'Grady \"Unit\" 7", q: 3 }]);
    rec('K5 emoji + quotes/apostrophe house names: shown as typed, repeat gets (2)', c.chips.some(x => x.startsWith('🏠 Casa ☘️ (2)')) && c.chips.some(x => x.startsWith("O'Grady \"Unit\" 7")) && c.rows[0].qty === 6, JSON.stringify(c.chips));
  }
  {
    const c = await run([{ name: '<script>window.__xss=1</script>', q: 1 }, { name: '<img src=x onerror="window.__xss=2">', q: 2 }, { name: '<img src=x onerror="window.__xss=2">', q: 3 }]);
    await A.page.waitForTimeout(300);
    const x = await A.page.evaluate(() => window.__xss);
    rec('K6 <script> / <img onerror> house names: no element made, nothing runs, shown as text (incl. the "(2)" repeat)', c.scripts === 0 && !x && c.chips.some(t => t.startsWith('<img src=x onerror="window.__xss=2"> (2)')) && c.head.some(t => t.startsWith('<script>')), JSON.stringify({ chips: c.chips, head: c.head, x }));
  }
  {
    const c = await run([{ name: 'House 1', q: 1 }, { name: 'House 1 ', q: 2 }, { name: 'house 1', q: 3 }]);
    const labels = c.rows[0].per.map(x => x[0]);
    const look = new Set(labels.map(s => s.trim().toLowerCase()));
    rec('K7 (Low) "House 1", "House 1 " (trailing space), "house 1": a reader can tell the three houses apart on the chips', look.size === 3, JSON.stringify({ per: c.rows[0].per, chips: c.chips }));
  }
  {
    const c = await run([{ name: '', q: 1 }, { name: undefined, q: 2 }, { name: null, q: 3 }]);
    const labels = c.rows[0].per.map(x => x[0]);
    rec('K8 (Low) lists with no name: no chip says "undefined"/"null", and the three can be told apart', !labels.some(s => /undefined|null/.test(s)) && new Set(labels.map(s => s.trim())).size === 3 && labels.every(s => s.trim()), JSON.stringify({ labels, chips: c.chips, head: c.head }));
  }
  {
    const c = await run([{ name: 'House 1', project: 'P-A', q: 1 }, { name: 'House 1', project: 'P-B', q: 2 }, { name: 'House 1', project: 'P-A', q: 3 }]);
    rec('K9 same house name in two projects: labels carry the project, the P-A repeat gets (2)', JSON.stringify(c.rows[0].per) === JSON.stringify([['P-A — House 1', 1], ['P-B — House 1', 2], ['P-A — House 1 (2)', 3]]), JSON.stringify(c.rows[0].per));
  }
  {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: 'Apartment ' + (i % 3) + ' — a very long house name that goes on and on', q: 1 }));
    const t0 = Date.now(); const c = await run(many); const ms = Date.now() - t0;
    rec('K10 40 houses, many repeats of 3 long names: 40 different labels, total 40, under 3 s', new Set(c.rows[0].per.map(x => x[0])).size === 40 && c.rows[0].qty === 40 && ms < 3000, 'ms=' + ms);
  }
  rec('K11 no page errors', !errs.length, errs.join(' | '));
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
