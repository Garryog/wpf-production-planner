// Garry, 13 Nov 2026: "when i imported a template into a work order it left the blank standard headings and rows in and put the
// template at the bottom … they need to be overridden when the template comes in."
// Rule: if nothing has been typed, picked or ticked in the window, a template REPLACES the blank standard layout. If anything
// has been typed, the template is ADDED and what was typed stays. Fake Supabase only.
// Run: node tests/list-window/g13-template-replaces-blank.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks, setv, rows } = L;
const insert = async (p, tid) => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
  await p.evaluate(tid => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-itt="' + tid + '"]').click(); }, tid); await sleep(900); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });
    const tl = S.db.t.list_lines.filter(x => x.list_id === 'T1' && x.removed_rev == null).length;
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // 1. blank standard layout → template replaces it
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const r0 = await rows(p);
    rec('set-up: the standard layout is there, blank (several headings, empty rows)', r0.length > 3 && r0.some(r => r.hdr) && r0.filter(r => !r.hdr).every(r => !r.item), JSON.stringify(r0.length));
    await insert(p, 'T1');
    const r1 = await rows(p);
    rec('blank layout + template → ONLY the template rows are in the window (' + tl + ')', r1.length === tl && !r1.some(r => !r.hdr && !r.item), JSON.stringify([r1.length, tl]));
    await p.keyboard.press('Control+z'); await sleep(400);
    const r1u = await rows(p);
    rec('Undo puts the blank layout back', r1u.length === r0.length, JSON.stringify([r1u.length, r0.length]));
    await closeAll(p);
    // 2. something typed → template is added, typed row kept
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const i = (await rows(p)).findIndex(r => !r.hdr);
    await setv(p, i + '|item', 'My own part'); await setv(p, i + '|qty', '2'); await sleep(200);
    const n2 = (await rows(p)).length;
    await insert(p, 'T1');
    const r2 = await rows(p);
    rec('one row typed + template → the typed row is kept and the template is added (nothing replaced)', r2.length === n2 + tl && r2.some(r => r.item === 'My own part'), JSON.stringify([r2.length, n2, tl]));
    await closeAll(p);
    // 3. only a material picked → counts as typed
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const j = (await rows(p)).findIndex(r => !r.hdr);
    const picked = await p.evaluate(j => { const s = document.querySelector('.me-ed [data-mr="' + j + '|mat"]'); const o = [...s.options].find(x => x.value && x.value !== '__add'); if (!o) return false; s.value = o.value; s.dispatchEvent(new Event('change')); return true; }, j); await sleep(200);
    const n3 = (await rows(p)).length;
    await insert(p, 'T1');
    const r3 = await rows(p);
    rec('only a material picked + template → nothing replaced', picked && r3.length === n3 + tl, JSON.stringify([picked, r3.length, n3, tl]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
