// ATTACK 3 — polling pages ordered by (updated_at, id) (e4c9edf): a line changes again WHILE a multi-page poll is running,
// so rows shift between page 1 and page 2. Fake Supabase only. Run: node tests/stage3/attack3-poll.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L0', { wos: ['WO-1'] });
  for (let i = 1; i <= 15; i++) {
    const id = 'B' + String(i).padStart(2, '0');
    D.insert(S.db, 'lists', { id, project_id: 'P1', name: 'H' + i, wos: ['WO-1'], n_saw: 100, created_at: '2026-10-20T08:00:00.000Z' });
    for (let j = 1; j <= 100; j++) D.insert(S.db, 'list_lines', { id: id + ':' + String(j).padStart(3, '0'), list_id: id, seq: j, kind: 'saw', part: 'P' + j, qty: '1', length_mm: 100 + j, width_mm: 100, material: 'MFC White' });
  }
  const saw = await F.dev(browser, S, 'saw');
  const ts = new Date(Date.now() + 1000).toISOString();
  const big = S.db.t.list_lines.filter(z => z.list_id.startsWith('B'));
  big.forEach(z => { z.status = 'cut'; z.status_by = 'Other'; z.version++; z.updated_at = ts; });
  // between page 1 and page 2 another device unticks a line that was on page 1 → it moves to the end; everything after it shifts up one
  let n = 0;
  await saw.page.route(u => /\/list_lines\?.*order=updated_at/.test(String(u)) && /offset=1000/.test(String(u)), route => {
    if (!n++) { const r = big[5]; r.status = 'todo'; r.version++; r.updated_at = new Date(Date.parse(ts) + 50).toISOString(); }
    return route.fallback();
  });
  await saw.page.evaluate(async () => { await lsPoll(); });
  const c1 = await saw.page.evaluate(() => [...LST.ln.values()].filter(z => z.list_id.startsWith('B') && z.status === 'cut').length);
  await saw.page.evaluate(async () => { await lsPoll(); });
  const st2 = await saw.page.evaluate(id => ({ cut: [...LST.ln.values()].filter(z => z.list_id.startsWith('B') && z.status === 'cut').length, moved: LST.ln.get(id).status }), big[5].id);
  rec('P1 a line changed mid-poll: after the next poll (30 s overlap) the screen has all 1,499 cut + the untick', st2.cut === 1499 && st2.moved === 'todo', 'after poll 1 cut=' + c1 + ' (1 may be skipped) | after poll 2: ' + JSON.stringify(st2));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  await saw.close(); await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
