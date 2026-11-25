// B9d (Coder): pool filters (PM / Project / Material), the weeks pick (this device only), the fold-out on a phone, and the 360 px pass
// (cards, no sideways scroll, buttons ≥ 36 px). Fake Supabase only. Run: node tests/seq/b9d-filters.test.js
const { X, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
const pick = (p, id, v) => p.evaluate(({ id, v }) => { const s = document.getElementById(id); if (!s) return 'no ' + id; if (![...s.options].some(o => o.value === v)) return 'no option ' + v + ' in ' + [...s.options].map(o => o.value).join('|'); s.value = v; s.dispatchEvent(new Event('change')); return 'ok'; }, { id, v });
(async () => {
  const browser = await H.chromium.launch();
  const S = makePool();
  X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P2'), { pms: ['Mary Kelly'] });
  const a = await pre(browser, S);
  await a.page.evaluate(() => { PREV.proc = 'all'; render(); }); await sleep(200);
  const all = wos(await pool(a.page));
  const opts = await a.page.evaluate(() => ({ pm: [...document.querySelectorAll('#pre-fpm option')].map(o => o.textContent), pj: [...document.querySelectorAll('#pre-fpj option')].map(o => o.textContent), mt: [...document.querySelectorAll('#pre-fmt option')].map(o => o.textContent), wk: [...document.querySelectorAll('#pre-wks option')].map(o => o.value), open: document.getElementById('pre-fd').open }));
  rec('PC: filters open; PM (John Burke, Mary Kelly, no PM), Project (Aderrig, Lucan, no project), Material (MFC White, no material), weeks 3…12',
    opts.open && opts.pm.join() === 'All,John Burke,Mary Kelly,no PM' && opts.pj.join() === 'All,Aderrig,Lucan,no project' && opts.mt.join() === 'All,MFC White,no material yet' && opts.wk.join() === '3,4,5,6,7,8,9,10,11,12', JSON.stringify(opts));
  rec('PM Mary Kelly → only Lucan\'s WO-16', await pick(a.page, 'pre-fpm', 'mary kelly') === 'ok' && wos(await pool(a.page)) === 'WO-16', wos(await pool(a.page)));
  rec('PM "no PM" → only WO-17 (no project)', await pick(a.page, 'pre-fpm', '-') === 'ok' && wos(await pool(a.page)) === 'WO-17', wos(await pool(a.page)));
  await pick(a.page, 'pre-fpm', '');
  rec('Project Aderrig → WO-1, WO-2, WO-12, W1, WO-10', await pick(a.page, 'pre-fpj', 'P1') === 'ok' && wos(await pool(a.page)) === 'WO-1,WO-2,WO-12,⏳ no WO yet,WO-10', wos(await pool(a.page)));
  rec('Material MFC White (+ Aderrig) → only WO-1', await pick(a.page, 'pre-fmt', 'mfc white') === 'ok' && wos(await pool(a.page)) === 'WO-1', wos(await pool(a.page)));
  rec('"(2 on)" shown, ✕ Clear filters brings every row back', await a.page.evaluate(() => /2 on/.test(document.querySelector('#pre-fd summary').textContent)) && await a.page.evaluate(() => { document.getElementById('pre-fclr').click(); return true; }) && (await sleep(200), wos(await pool(a.page))) === all, all);
  // ▲ with a filter on: moves among the rows shown
  await pick(a.page, 'pre-fpj', 'P1');
  await a.page.evaluate(() => document.querySelector('[data-preup="W:WO-10"]').click()); await sleep(600);
  rec('▲ with Project = Aderrig: WO-10 goes above W1 (the row shown above it)', /WO-12,WO-10,⏳ no WO yet/.test(wos(await pool(a.page))), wos(await pool(a.page)));
  await pick(a.page, 'pre-fpj', '');
  // weeks pick: this device only, never Settings
  const saves0 = S.log.filter(x => /^PATCH \/production_planner/.test(x)).length;
  rec('weeks ▾ 4 → WO-11 (3 Dec) listed; header "(4 wks)"', await pick(a.page, 'pre-wks', '4') === 'ok' && /WO-11/.test(wos(await pool(a.page))) && await a.page.evaluate(() => /\(4 wks\)/.test(document.querySelector('#pre-pool .seq-h').textContent)));
  await sleep(1600);
  rec('weeks pick kept on this device only (wpfPreWks), Settings not saved', await a.page.evaluate(() => localStorage.getItem('wpfPreWks') === '4' && DB.preWks == null) && S.log.filter(x => /^PATCH \/production_planner/.test(x)).length === saves0);
  rec('no page errors (PC)', !(S.errors || []).length, JSON.stringify(S.errors));
  await a.close();
  // ---- 360 px phone
  const ph = await pre(browser, S, { viewport: { width: 360, height: 740 } });
  const f0 = await ph.page.evaluate(() => ({ open: document.getElementById('pre-fd').open, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  rec('phone: filters folded away; no sideways scroll', !f0.open && f0.sw <= f0.cw, JSON.stringify(f0));
  await ph.page.evaluate(() => { PREV.open = true; PREV.proc = 'all'; render(); }); await sleep(200);
  const m = await ph.page.evaluate(() => {
    const big = sel => [...document.querySelectorAll(sel)].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.height), Math.round(r.width)]; });
    const tr = document.querySelector('#pre-pool tr[data-prer]');
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, card: tr && getComputedStyle(tr).display === 'block', thead: getComputedStyle(document.querySelector('.pre-tbl thead')).display,
      tick: big('[data-pretick]'), mv: big('[data-preup],[data-predn],[data-preto]'), sel: big('#pre-fd select'), drag: [...document.querySelectorAll('.pre-tbl .seq-hd')].every(x => getComputedStyle(x).display === 'none'), open: document.getElementById('pre-fd').open };
  });
  rec('phone 360 px: cards, no table header, no drag handle, no sideways scroll (filters open, All)', m.open && m.card && m.thead === 'none' && m.drag && m.sw <= m.cw, JSON.stringify(m).slice(0, 300));
  rec('phone: ✓ Processed, ▲ ▼ # Move to and the filter boxes are ≥ 36 px tall', m.tick.length && m.tick.every(([h]) => h >= 36) && m.mv.length && m.mv.every(([h]) => h >= 36) && m.sel.length === 4 && m.sel.every(([h]) => h >= 36), JSON.stringify([m.tick, m.mv, m.sel]));
  await ph.page.evaluate(() => document.querySelector('[data-pretick="W:WO-12"]').click()); await sleep(700);
  rec('phone: tick works (seq_pre row for WO-12)', S.db.t.seq_pre.some(x => x.seq_id === 'Q12' && x.processed));
  rec('no page errors (phone)', !(S.errors || []).length, JSON.stringify(S.errors));
  await ph.close();
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
