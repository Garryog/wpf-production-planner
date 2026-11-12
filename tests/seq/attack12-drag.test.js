// Tester attack 12 — re-check of B9 Manager issue 1 (cde4bde / 1998b36): a REAL Playwright mouse drag in Johnny's
// Pre-production pool. Asserts (not just logs) that the redraw guard PREV.drag stays armed mid-drag after Chrome's
// pointercancel, that a merge redraw / live poll mid-drag is held off, that the drop lands, and that the guard still lets go:
// on dragend (drop, or let go outside the pool), on Escape, after 30 s, when the page is hidden. Fake Supabase only.
// Run: node tests/seq/attack12-drag.test.js
const { X, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
const startDrag = async (p, key) => {
  const bb = await p.locator('#pre-pool tr[data-prer="' + key + '"] td.seq-hd').boundingBox();
  await p.mouse.move(bb.x + 5, bb.y + 5); await p.mouse.down();
  await p.mouse.move(bb.x + 40, bb.y + 60, { steps: 8 }); await sleep(200);
};
const state = p => p.evaluate(() => ({ drag: PREV.drag, on: preDragOn(), ev: (window._ev || []).slice() }));
(async () => {
  const browser = await H.chromium.launch();
  const S = makePool();
  const a = await pre(browser, S), p = a.page;
  await p.evaluate(() => { window._ev = []; ['dragstart', 'pointercancel', 'dragend', 'drop'].forEach(t => document.addEventListener(t, () => window._ev.push(t), true)); });
  // ---- 1: mid-drag armed, redraws held off
  await startDrag(p, 'W:WO-10');
  let m = await state(p);
  rec('D1 real mouse drag: dragstart fired and the guard is ARMED mid-drag (PREV.drag = W:WO-10)', m.ev.includes('dragstart') && m.drag === 'W:WO-10' && m.on, JSON.stringify(m));
  rec('D1b Chrome fired pointercancel at drag start (the case the fix is for) — guard still armed', !m.ev.includes('pointercancel') || (m.drag === 'W:WO-10' && m.on), JSON.stringify(m.ev));
  const held = await p.evaluate(async () => { const el = document.getElementById('pre-pool'); el.dataset.mark = '1'; mergedRender(); try { if (typeof lsPoll === 'function') await lsPoll(); } catch (e) {} await new Promise(r => setTimeout(r, 300));
    return { kept: !!document.querySelector('#pre-pool[data-mark="1"]'), drag: PREV.drag }; });
  rec('D2 a merge redraw AND a live poll mid-drag do not redraw the pool (same element kept), guard still armed', held.kept && held.drag === 'W:WO-10', JSON.stringify(held));
  const tb = await p.locator('#pre-pool tr[data-prer]').first().boundingBox();
  await p.mouse.move(tb.x + 60, tb.y + tb.height / 2, { steps: 10 }); await p.mouse.up(); await sleep(900);
  m = await state(p); let r = await pool(p);
  rec('D3 drop on the top row lands: WO-10 first, seq_pre pre_key written; guard off after the drop', r[0].wo === 'WO-10' && S.db.t.seq_pre.some(x => x.seq_id === 'Q10' && x.pre_key != null) && m.drag === '' && !m.on, JSON.stringify(m) + ' ' + wos(r));
  // ---- 2: Escape mid-drag
  await p.evaluate(() => { window._ev = []; });
  const n0 = S.db.t.seq_pre.length, v0 = JSON.stringify(S.db.t.seq_pre.map(x => [x.seq_id, x.pre_key]));
  await startDrag(p, 'W:WO-12');
  const armed = await state(p);
  await p.keyboard.press('Escape'); await sleep(400);
  m = await state(p);
  rec('D4 Escape mid-drag: guard was armed, then lets go (PREV.drag empty)', armed.drag === 'W:WO-12' && m.drag === '' && !m.on, JSON.stringify([armed.drag, m]));
  await p.mouse.up(); await sleep(600);
  rec('D4b …and nothing was written by the cancelled drag', S.db.t.seq_pre.length === n0 && JSON.stringify(S.db.t.seq_pre.map(x => [x.seq_id, x.pre_key])) === v0, JSON.stringify(S.db.t.seq_pre.map(x => [x.seq_id, x.pre_key])));
  // ---- 3: let go outside the pool (dragend, no drop)
  await startDrag(p, 'W:WO-12');
  const arm2 = await state(p);
  await p.mouse.move(5, 5, { steps: 6 }); await p.mouse.up(); await sleep(600);
  m = await state(p);
  rec('D5 let go outside the pool: dragend lets the guard go, nothing written', arm2.drag === 'W:WO-12' && m.drag === '' && !m.on && JSON.stringify(S.db.t.seq_pre.map(x => [x.seq_id, x.pre_key])) === v0, JSON.stringify([arm2.drag, m]));
  // ---- 4: 30 s
  await startDrag(p, 'W:WO-12');
  const arm3 = await state(p);
  const exp = await p.evaluate(async () => { PREV.dragAt = Date.now() - 31000; const on = preDragOn(); const el = document.getElementById('pre-pool'); el.dataset.mark = '2'; mergedRender(); await new Promise(r => setTimeout(r, 300));
    return { on, drag: PREV.drag, redrawn: !document.querySelector('#pre-pool[data-mark="2"]') }; });
  rec('D6 a drag older than 30 s: guard lets go by itself and the next redraw happens', arm3.drag === 'W:WO-12' && !exp.on && exp.drag === '' && exp.redrawn, JSON.stringify([arm3.drag, exp]));
  await p.mouse.up(); await sleep(500);
  // ---- 5: page hidden mid-drag
  await startDrag(p, 'W:WO-12');
  const arm4 = await state(p);
  const hid = await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); const d = PREV.drag; delete document.hidden; return d; });
  rec('D7 the page hidden mid-drag (phone locks / tab switch): guard lets go', arm4.drag === 'W:WO-12' && hid === '', JSON.stringify([arm4.drag, hid]));
  await p.mouse.up(); await sleep(500);
  // ---- 6: a second real drag after all that still works
  await startDrag(p, 'W:WO-1');
  const arm5 = await state(p);
  const t2 = await p.locator('#pre-pool tr[data-prer]').first().boundingBox();
  await p.mouse.move(t2.x + 60, t2.y + t2.height / 2, { steps: 10 }); await p.mouse.up(); await sleep(900);
  r = await pool(p);
  rec('D8 another real drag afterwards: armed mid-drag, WO-1 lands on top', arm5.drag === 'W:WO-1' && r[0].wo === 'WO-1', JSON.stringify(arm5) + ' ' + wos(r));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await a.close(); await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
