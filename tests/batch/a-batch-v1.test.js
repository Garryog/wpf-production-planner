// Part A with the lists switched OFF (old store): the saw ⚡ BATCH tab works the same. Fake Supabase only.
// Run: node tests/batch/a-batch-v1.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r = (item, qty, L, W, mat, note) => ({ k: 'saw', item, qty, L, W, mat, note: note || '' });
const row = { id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22', customer: 'C' }), H.order({ wo: 'WO-2', unit: '2', dueDate: '2026-10-22', origDueDate: '2026-10-22', customer: 'C' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 2, fit: 0, wos: ['WO-1'], up: '2026-10-20T09:00:00Z' }, { id: 'L2', wb: 'W1', sheet: 'H2', name: 'House 2', project: 'Proj', saw: 2, fit: 0, wos: ['WO-2'], up: '2026-10-20T09:00:00Z' }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: [r('Side', 2, 2400, 600, 'MFC White'), r('Top', 1, 2400, 600, 'MFC White')], H2: [r('Side', 4, 2400, 600, 'MFC White'), r('Shelf', '2x2', 500, 400, 'MFC White')] } } } } };
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = makeServer(row);
    const t = await open(browser, S, { now: '2026-10-21T09:00:00Z', role: 'saw' }), p = t.page;
    await p.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); });
    rec('lists OFF (V2() false)', !(await p.evaluate(() => V2())));
    await p.evaluate(() => ['L1', 'L2'].forEach(id => document.querySelector('[data-wlsel="' + id + '"]').click())); await sleep(100);
    rec('"＋ Add to batch" → tab "⚡ BATCH — 2 houses"', (await p.evaluate(() => (document.getElementById('wl-tab-batch') || {}).textContent)) === '⚡ BATCH — 2 houses');
    await p.evaluate(() => document.getElementById('wl-bopen').click()); await sleep(100);
    let b = await p.evaluate(() => ({ h: [...document.querySelectorAll('.sb-bh')].map(x => x.innerText).join('|'), rows: [...document.querySelectorAll('.sb-row')].map(x => x.innerText.replace(/\s+/g, ' ')), top: document.querySelector('.sb-top').innerText }));
    // 2×1.44 + 1.44 + 4×1.44 = 10.08 m² → 10.08/5.75×1.1 = 1.93 → 2 sheets
    rec('board "MFC White — 2 sheets for this batch · 2 still to cut"', /MFC White — 2 sheets for this batch · 2 still to cut/.test(b.h), b.h);
    rec('Side TOTAL 6 (House 1 ×2, House 2 ×4); Shelf "2x2" not added', b.rows.some(x => /^Side .*TOTAL\s*6 House 1 ×2 House 2 ×4/.test(x)) && b.rows.some(x => /^Shelf .*TOTAL\s*0 \+ 1 not added/.test(x)), b.rows.join(' || '));
    await p.evaluate(() => { wlShowBatch = false; render(); const k = [...document.querySelectorAll('[data-rt]')].find(x => x.dataset.rt.startsWith('L1|')); k.click(); }); await sleep(200);
    await p.evaluate(() => { wlShowBatch = true; render(); }); await sleep(100);
    b = await p.evaluate(() => ({ chips: [...document.querySelectorAll('.sb-chip')].map(c => c.innerText + (c.classList.contains('sb-cut') ? '[cut]' : '')), top: document.querySelector('.sb-top').innerText }));
    rec('a tick on House 1\'s own list shows ✓ on its share', b.chips.some(c => /House 1/.test(c) && /\[cut\]/.test(c)), b.chips.join(' | '));
    rec('nothing to tick in the batch', await p.evaluate(() => !document.querySelector('.wl [data-rt],.wl [data-rna]')));
    // storage blocked: kept in memory, says "not remembered"
    await p.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'wpfSawBatch') throw new Error('QuotaExceededError'); return o.call(this, k, v); };
      SB.read = true; SB.ids = []; SB.mem = false; wlShowBatch = false; render(); document.querySelector('[data-wlsel="L2"]').click(); wlShowBatch = true; render(); });
    const m = await p.evaluate(() => ({ ids: SB.ids.join(), txt: document.querySelector('.wl').innerText }));
    rec('storage blocked: the batch is held in memory and says "Not remembered on this device"', m.ids === 'L2' && /Not remembered on this device/.test(m.txt), m.ids + ' ' + m.txt.slice(0, 200));
    rec('the planner record never carries the batch', !S.patches.some(x => JSON.stringify(x).includes('wpfSawBatch')));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
