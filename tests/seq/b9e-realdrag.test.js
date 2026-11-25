// B9 (Manager issue 1, cde4bde): in real Chromium a mouse drag fires pointercancel at drag START — the pool's redraw guard must stay
// armed for the whole drag (real mouse through Playwright), let go at the end, and the drop must land. Fake Supabase only.
// Run: node tests/seq/b9e-realdrag.test.js
const { X, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  const S = makePool();
  const a = await pre(browser, S);
  await a.page.evaluate(() => { window._ev = []; ['dragstart', 'pointercancel', 'dragend'].forEach(t => document.addEventListener(t, () => window._ev.push(t), true)); });
  const src = a.page.locator('#pre-pool tr[data-prer="W:WO-10"] td.seq-hd');
  const bb = await src.boundingBox();
  await a.page.mouse.move(bb.x + 5, bb.y + 5); await a.page.mouse.down();
  await a.page.mouse.move(bb.x + 40, bb.y + 60, { steps: 8 }); await sleep(200);
  const mid = await a.page.evaluate(() => { const m = document.getElementById('pre-pool'); m.dataset.mark = '1'; mergedRender(); return { drag: PREV.drag, on: preDragOn(), kept: !!document.querySelector('#pre-pool[data-mark="1"]'), ev: window._ev.slice() }; });
  rec('real mouse drag: guard armed mid-drag (even after Chrome\'s pointercancel), a merge redraw is held off', mid.drag === 'W:WO-10' && mid.on && mid.kept && mid.ev.includes('dragstart'), JSON.stringify(mid));
  // drop on the top row
  const top = a.page.locator('#pre-pool tr[data-prer]').first(), tb = await top.boundingBox();
  await a.page.mouse.move(tb.x + 60, tb.y + tb.height / 2, { steps: 10 }); await a.page.mouse.up(); await sleep(900);
  const end = await a.page.evaluate(() => ({ drag: PREV.drag, on: preDragOn() }));
  const r = await pool(a.page);
  rec('after the drop: guard off, WO-10 moved to the top (seq_pre pre_key written)', end.drag === '' && !end.on && r[0].wo === 'WO-10' && S.db.t.seq_pre.some(x => x.seq_id === 'Q10' && x.pre_key != null), JSON.stringify(end) + ' ' + wos(r));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await a.close(); await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
