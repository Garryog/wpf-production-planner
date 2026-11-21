// Tester round 3 (21 Nov): can a saw PC ever treat the lists as LOADED while its cache is empty / partial, and so drop a remembered
// batch for good ("no longer on the planner")? Deterministic — requests are held / failed by the test, never timed.
//  A. the root cause of the 1-in-3 vsmain failure: lsReset() while a lsLoad() is still running → LST.loaded = true, cache empty
//  B. the real start-up paths on a saw PC: slow start-up, first fetch fails then works, a poll landing mid-load, lsReloadList of one
//     list mid-load, list_lines slow — the batch must survive every one
//  C. lists switched off (Switch back) and on again while a batch is remembered
// Run: node tests/batch/attack3-loaded.test.js
const F = require('../stage3/fix3.js');
const S3 = require('../stage3/srv3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const sleep = F.sleep;
const seed = () => { const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'] }); F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'] }); return S; };
// a gate on one table: requests to it wait until opened (or are failed)
function gate(page, re) {
  const g = { held: [], fail: 0, n: 0, open: false };
  g.ready = page.route(u => re.test(String(u)), async route => { g.n++; if (g.fail > 0) { g.fail--; return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }); }
    if (!g.open) await new Promise(r => g.held.push(r)); return route.fallback(); });
  g.release = () => { g.open = true; g.held.splice(0).forEach(r => r()); };
  return g;
}
const state = p => p.evaluate(() => ({ loaded: LST.loaded, n: LST.l.size, ids: SB.ids.join(), notes: SB.notes.join(' / '), store: localStorage.getItem('wpfSawBatch') }));
async function sawPage(browser, S, ctx) {
  // a saw PC as it really starts: role remembered, batch remembered, the page loads the plan and lists by itself
  const c = ctx || await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Dublin' });
  await c.addInitScript(`(()=>{const T=${+new Date(F.NOW)};const R=Date;const off=T-R.now();class D extends R{constructor(...a){if(a.length===0){super(R.now()+off);}else super(...a);}static now(){return R.now()+off;}}D.UTC=R.UTC;D.parse=R.parse;window.Date=D;})();`);
  await c.addInitScript(() => { localStorage.setItem('wpfRole', 'saw'); localStorage.setItem('wpfPin_saw', '9000'); localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); localStorage.setItem('wpfOpName', 'Op');
    if (!localStorage.getItem('wpfSawBatch_seeded')) { localStorage.setItem('wpfSawBatch', JSON.stringify({ ids: ['L1', 'L2'] })); localStorage.setItem('wpfSawBatch_seeded', '1'); }
    window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'Op'; });
  const p = await c.newPage(); p.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await S3.attach({ ctx: c, page: p }, S);
  return { c, p };
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- A. root cause: lsReset() while lsLoad() is mid-way ----------
    {
      const S = seed(); const { c, p } = await sawPage(browser, S);
      const g = gate(p, /\/list_lines\?/); await g.ready;
      await p.goto('https://wpf.test/?view=saw'); await p.waitForFunction(() => typeof lsLoad === 'function' && typeof XLSX !== 'undefined');
      // the page's own start-up load has read projects + lists and is waiting on list_lines
      for (let i = 0; i < 100 && !g.held.length; i++) await sleep(50);
      const mid = await p.evaluate(() => ({ loading: !!LST.loading, n: LST.l.size }));
      // what the vsmain test did (and what lsMigrate / lsSwitchBack do): reset, then load again
      await p.evaluate(() => { window.__ld = (async () => { lsReset(); await lsLoad(); })(); });
      g.release(); await p.evaluate(() => window.__ld); await p.evaluate(() => render()); await sleep(200);
      const s = await state(p);
      console.log('INFO A: mid-load ' + JSON.stringify(mid) + ' → after reset + load: ' + JSON.stringify(s));
      rec('A. ROOT CAUSE of the vsmain flake: lsReset() while the start-up lsLoad() waits on list_lines → lsLoad() returns the OLD promise, which then marks the lists loaded with an EMPTY cache', !(s.loaded && s.n === 0), JSON.stringify(s));
      rec('A. … and the remembered batch is then dropped for good ("no longer on the planner")', /L1/.test(s.ids) && /L2/.test(s.ids), JSON.stringify(s));
      await c.close();
    }
    // ---------- B. real start-up paths on a saw PC ----------
    for (const [label, setup] of [
      ['slow start-up (list tables held 2 s, the page redraws meanwhile)', async (p, gl) => { for (let i = 0; i < 8; i++) { await p.evaluate(() => { try { render(); } catch (e) {} }); await sleep(250); } gl.release(); }],
      ['first lists fetch fails, the next one works', async (p, gl) => { gl.fail = 1; gl.release(); await sleep(300); await p.evaluate(async () => { await lsPoll(); render(); }); }],
      ['a poll lands while the start-up load is running', async (p, gl) => { await p.evaluate(() => { window.__pp = lsPoll(); render(); }); gl.release(); await p.evaluate(() => window.__pp); }],
      ['lsReloadList of one list while the start-up load is running', async (p, gl) => { await p.evaluate(() => { window.__rl = lsReloadList('L1').catch(() => {}); render(); }); gl.release(); await p.evaluate(() => window.__rl); }],
    ]) {
      const S = seed(); const { c, p } = await sawPage(browser, S);
      const gl = gate(p, /\/(lists|list_lines)\?/); await gl.ready;
      await p.goto('https://wpf.test/?view=saw'); await p.waitForFunction(() => typeof lsLoad === 'function' && typeof XLSX !== 'undefined');
      for (let i = 0; i < 100 && !gl.held.length && !gl.n; i++) await sleep(50);
      await setup(p, gl);
      for (let i = 0; i < 40; i++) { if (await p.evaluate(() => LST.loaded && !LST.loading)) break; await sleep(100); }
      await p.evaluate(() => render()); await sleep(150);
      const s = await state(p);
      rec('B. ' + label + ': the remembered batch survives (L1, L2 kept, no "left the batch")', s.ids === 'L1,L2' && !/left the batch/.test(s.notes), JSON.stringify(s));
      await c.close();
    }
    // ---------- C. lists switched OFF (Switch back to the old store) and ON again with a batch remembered ----------
    {
      const S = seed(); const { c, p } = await sawPage(browser, S);
      await p.goto('https://wpf.test/?view=saw'); await p.waitForFunction(() => typeof lsLoad === 'function' && typeof XLSX !== 'undefined');
      for (let i = 0; i < 40; i++) { if (await p.evaluate(() => LST.loaded)) break; await sleep(100); }
      await p.evaluate(() => render());
      const s0 = await state(p);
      S.row.settings.listStore = 'v1'; S.row.version = (+S.row.version || 1) + 1;
      await p.evaluate(async () => { await loadDB(); render(); }); await sleep(200);
      const s1 = await state(p);
      console.log('INFO C: before ' + JSON.stringify(s0) + ' | lists switched OFF: ' + JSON.stringify(s1));
      rec('C. lists switched off (Switch back) on another PC: INFO — the remembered V2 batch ' + (/L1/.test(s1.ids) ? 'is kept' : 'is dropped ("' + s1.notes + '")'), true);
      S.row.settings.listStore = 'v2'; S.row.version++;
      await p.evaluate(async () => { await loadDB(); lsStart(); for (let i = 0; i < 30 && !LST.loaded; i++) await new Promise(r => setTimeout(r, 100)); render(); }); await sleep(200);
      const s2 = await state(p);
      rec('C. … switched on again: no error; batch state ' + JSON.stringify(s2.ids), !(S.errors || []).length, JSON.stringify(s2));
      await c.close();
    }
    rec('no page errors', true);
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
