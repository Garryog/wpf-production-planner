// Hotfix 17 Nov, saving audit: (1) a failed row fetch never leaves a list "loaded" with no rows; (2) a save that takes away
// most / all of a list's rows asks first, and Cancel saves nothing. Fake Supabase only. Run: node tests/hotfix/h17-save-guards.test.js
const F = require('../stage3/fix3.js');
const { sleep } = F;
const results = []; const rec = (n, ok, d) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const M = 'MFC White';
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).length;
(async () => {
  const browser = await F.H.chromium.launch(); let S;
  try {
    S = F.makeServer(F.v2Row());
    const L4 = [['hdr', 'Worktops', null, null, null, null, '', ''], ['saw', 'Worktop', '1', 3600, 600, M, '', ''], ['saw', 'Worktop', '1', 1600, 600, M, '', ''], ['fit', 'Tap', '1', null, null, 'Tap A', '', '']];
    F.seedList(S, 'TPL', { wos: [], name: 'T2 LH', list: { is_template: true, type_name: 'T2 LH', list_type: 'kitchen' }, lines: L4 });
    F.seedList(S, 'TP2', { wos: [], name: 'T3 LH', list: { is_template: true, type_name: 'T3 LH', list_type: 'kitchen' }, lines: L4 });
    const t = await F.dev(browser, S, 'design'), p = t.page;
    // 1. the row fetch fails once
    await p.evaluate(async () => { lsReset(); await lsLoad(); window.__failLines = 1; const f0 = window.fetch; window.fetch = function (u, o) { if (window.__failLines && /list_lines\?select=\*&list_id=eq\.TPL/.test(String(u))) { window.__failLines = 0; return Promise.reject(new TypeError('Failed to fetch')); } return f0.apply(this, arguments); }; });
    await p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; openListEditor('TPL'); }); await sleep(1500);
    const a = await p.evaluate(() => ({ full: LST.full.has('TPL'), ed: !!document.querySelector('.me-ed') }));
    rec('1a the row fetch fails → the list is NOT marked loaded and no empty window opens', !a.full && !a.ed, JSON.stringify(a));
    await p.evaluate(() => openListEditor('TPL')); await sleep(1500);
    const rows = await p.evaluate(() => [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].map(e => e.value).filter(Boolean));
    rec('1b pressed again (connection back) → it opens WITH its rows', rows.includes('Tap'), JSON.stringify(rows));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // 2. a save that removes most rows asks; Cancel → nothing saved
    const before = live(S, 'TP2');
    const r2 = await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return !/TAKES AWAY/.test(m); };
      if (!LST.full.has('TP2')) await lsReloadList('TP2'); const cur = lsList('TP2');
      try { await lsSaveList({ id: 'TP2', name: 'T3 LH', project_id: 'P1', is_template: true, list_type: 'kitchen', type_name: 'T3 LH', wos: [] }, [{ kind: 'saw', part: 'Shelf', qty: '1', length_mm: 500, width_mm: 300, material: 'MFC White' }], 'Op', 'test'); return { ok: true, asked: window.__asked }; }
      catch (e) { return { ok: false, msg: e.message, asked: window.__asked }; } });
    rec('2a a save leaving 1 new row in place of the 4 → asked "This save TAKES AWAY 4 of the 4 rows"', r2.asked.some(m => /TAKES AWAY 4 of the 4/.test(m)), JSON.stringify(r2));
    rec('2b Cancel → "Not saved", and the database still has all ' + before + ' rows', !r2.ok && /Not saved/.test(r2.msg) && live(S, 'TP2') === before, JSON.stringify([r2.msg, live(S, 'TP2')]));
    const r3 = await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; };
      try { await lsSaveList({ id: 'TP2', name: 'T3 LH', project_id: 'P1', is_template: true, list_type: 'kitchen', type_name: 'T3 LH', wos: [] }, [{ kind: 'saw', part: 'Shelf', qty: '1', length_mm: 500, width_mm: 300, material: 'MFC White' }], 'Op', 'test'); return { ok: true, asked: window.__asked }; }
      catch (e) { return { ok: false, msg: e.message, asked: window.__asked }; } });
    rec('2c OK → saved as asked (the person meant it)', r3.ok && live(S, 'TP2') === 1, JSON.stringify([r3, live(S, 'TP2')]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = results.filter(x => !x).length; console.log(f + ' failed of ' + results.length); process.exit(f ? 1 : 0);
})();
