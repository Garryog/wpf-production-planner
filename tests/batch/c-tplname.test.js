// Part C (Garry 20 Nov): one name per template — the template NAME wins; the hidden "Type name" is no longer shown or used.
// Live case: Emmet Road "4C" with a hidden type name "4B". Fake Supabase only.
// Run: node tests/batch/c-tplname.test.js
const L = require('../list-window/lw.js');
const { X, sleep, rec, closeAll, asks, setv, rows, save, err } = L;
const tpl = (S, id) => S.db.t.lists.find(l => l.id === id);
const box = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return e ? e.value : null; }, id);
const typeIn = (p, id, v) => p.evaluate(({ id, v }) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }, { id, v });
const edit = async (p, id) => { await closeAll(p); await p.evaluate(id => { window.__asked = []; openListEditor(id); }, id); await sleep(900); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const seed = (id, name, type) => X.F3.seedList(S, id, { wos: [], name, list: { is_template: true, type_name: type, list_type: 'house' } });
    seed('T3', '4C', '4B'); seed('T1', 'Type 2', 'Type 2');
    const t3before = JSON.stringify(tpl(S, 'T3'));
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    rec('opening the planner rewrites no template', JSON.stringify(tpl(S, 'T3')) === t3before);
    const h = await p.evaluate(() => ({ n: tplName(lsList('T3')), byC: (lsTplByName('P1', '4C') || {}).id || null, byB: (lsTplByName('P1', '4B') || {}).id || null,
      list: tplName(lsList('L1')), nul: tplName(null), cmp: lsTemplatesFor('P1').map(tplName) }));
    rec('tplName("4C"/"4B") = "4C"', h.n === '4C', JSON.stringify(h));
    rec('found by its name "4C"; the old type name "4B" no longer finds it', h.byC === 'T3' && h.byB === null, JSON.stringify(h));
    rec('tplName(null) is empty, a live list keeps its own name', h.nul === '' && h.list === 'House 1', JSON.stringify(h));
    // Lists page: templates show 4C, never 4B
    const pg = await p.evaluate(() => { showTab('l'); LH.kind = 'tpl'; render(); return document.body.innerText; });
    rec('Lists page shows "4C" and never "4B"', /TEMPLATE/.test(pg) && /4C/.test(pg) && !/\b4B\b/.test(pg), pg.replace(/\s+/g, ' ').slice(0, 300));
    // editor: no Type name box on a template; name saved as type_name
    await edit(p, 'T3');
    rec('template editor: no Type name box', (await box(p, 'me-tname')) === null && (await box(p, 'me-name')) === '4C');
    const r = await rows(p), i = r.findIndex(x => x.item === 'Hinge'); await setv(p, i + '|qty', '9'); await sleep(150);
    await save(p, 1800);
    rec('saved template: name "4C", type_name now "4C"', tpl(S, 'T3').name === '4C' && tpl(S, 'T3').type_name === '4C', JSON.stringify([tpl(S, 'T3').name, tpl(S, 'T3').type_name, await err(p)]));
    await edit(p, 'T1');
    await typeIn(p, 'me-name', 'Type 2B');
    await save(p, 1800);
    rec('renamed template: type_name follows the name', tpl(S, 'T1').name === 'Type 2B' && tpl(S, 'T1').type_name === 'Type 2B', JSON.stringify([tpl(S, 'T1').name, tpl(S, 'T1').type_name, await err(p)]));
    await closeAll(p);
    await edit(p, 'L1');
    rec('a live list still has its Type name box (list editing unchanged)', (await box(p, 'me-tname')) !== null);
    await closeAll(p);
    // phone
    await p.setViewportSize({ width: 360, height: 640 }); await sleep(250);
    await edit(p, 'T3');
    rec('phone 360: template editor has no Type name box', (await box(p, 'me-tname')) === null);
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
