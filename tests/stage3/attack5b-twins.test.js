// ATTACK 5 — the round-4 twin fix (editor rows carry their line id; diffLines pairs by id first), attacked: an Excel
// re-upload between an office opening the editor and saving; overtyping a CUT row into a different part on a list the saw
// already has (does the saw still get "REMOVED — already cut, keep aside"?); a duplicated row that carries the same id.
// Fake Supabase only. Run: node tests/stage3/attack5-twins.test.js
const A = require('./atk.js');
const { F, H, rec } = A;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const desc = (S, id) => live(S, id).map(x => x.id + ':' + x.part + '×' + x.qty + ':' + x.status).join(', ');
async function save(t, rows, who, conf, name) {
  return t.page.evaluate(async ({ rows, who, conf, name }) => {
    window.__c = []; window.confirm = m => { window.__c.push(m); return conf; }; window.prompt = () => 'site measure';
    try { await lsSaveManual({ wo: 'WO-1', name: name || 'House L1', project: 'Aderrig', rows }, who, lsList('L1')); return { ok: true, asked: window.__c }; }
    catch (e) { return { ok: false, err: e.message, asked: window.__c }; }
  }, { rows, who, conf, name });
}
(async () => {
  const browser = await H.chromium.launch();
  // ===== TW1: Dee opens the editor; Fay re-uploads the workbook (Side twins now qty 2 + 3, Top gone); Dee deletes the todo twin and saves =====
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'excel' } });
    const saw = await F.dev(browser, S, 'saw'); await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.send(saw.page); // Side #1 CUT
    const dee = await F.dev(browser, S, 'office'), fay = await F.dev(browser, S, 'office');
    const rd = await dee.page.evaluate(() => lsEditRows('L1'));
    const up = await fay.page.evaluate(async () => {
      const wb = { project: 'Aderrig', sheets: { 'House L1': [
        { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '1mm ABS' }, { k: 'saw', item: 'Side', qty: 3, L: 720, W: 560, mat: 'MFC White', note: '1mm ABS' },
        { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum hinge', note: '' }] } };
      try { return await lsImportWB(wb, [{ sheet: 'House L1' }], 'House.xlsx', 'Fay', { pid: 'P1' }); } catch (e) { return { err: e.message }; } });
    const afterFay = desc(S, 'L1');
    const i2 = rd.findIndex(r => r.lid === 'L1:2'); rd.splice(i2, 1);
    const d = await save(dee, rd, 'Dee', true);
    const sides = live(S, 'L1').filter(x => x.part === 'Side');
    rec('TW1 Excel re-upload between open and save; Dee removes the todo twin: the CUT Side stays cut, no line duplicated, Top stays gone (Fay removed it)',
      sides.some(x => x.id === 'L1:1' && x.status === 'cut') && !live(S, 'L1').some(x => x.part === 'Top') && sides.length <= 2,
      'fay=' + JSON.stringify(up) + ' afterFay=[' + afterFay + '] dee=' + JSON.stringify(d).slice(0, 300) + ' final=[' + desc(S, 'L1') + ']');
    await saw.close(); await dee.close(); await fay.close();
  }
  // ===== TW2: list with the saw (locked). Office overtypes the CUT Side row into "Shelf 800×300" (reuses the row) =====
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual', locked: true, sent_at: '2026-10-20T09:00:00Z' } });
    const saw = await F.dev(browser, S, 'saw'); await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.send(saw.page);
    const o = await F.dev(browser, S, 'office');
    const rows = await o.page.evaluate(() => lsEditRows('L1'));
    Object.assign(rows[0], { item: 'Shelf', L: 800, W: 300 });
    const r = await save(o, rows, 'Dee', true);
    await saw.page.evaluate(async () => { lsReset(); await lsLoad(); render(); });
    const v = await saw.page.evaluate(() => { const i = lsRevInfo('L1', 'saw'); return { rev: i.rev, aside: i.aside.map(x => x.part), changed: i.changed, added: i.added, removed: i.removed, txt: (document.body.innerText.match(/REMOVED — part already cut, keep aside/g) || []).length }; });
    rec('TW2 (Medium) a CUT Side overtyped into "Shelf" on a list the saw has: the saw is told the cut Sides are spare ("REMOVED — part already cut, keep aside")',
      v.aside.includes('Side') || v.txt > 0, JSON.stringify(r).slice(0, 120) + ' saw sees ' + JSON.stringify(v) + ' lines=[' + desc(S, 'L1') + '] (diffLines step 0 pairs by id → CHANGED/reset, so the cut Side never counts as removed)');
    await saw.close(); await o.close();
  }
  // ===== TW3: a row duplicated in the editor keeps the same line id (as if copied); then the ORIGINAL is deleted =====
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    const saw = await F.dev(browser, S, 'saw'); await F.tapRow(saw.page, 'data-rt', 'L1:3'); await F.send(saw.page); // Top CUT
    const o = await F.dev(browser, S, 'office');
    const rows = await o.page.evaluate(() => lsEditRows('L1'));
    const top = rows.findIndex(r => r.lid === 'L1:3');
    const copy = Object.assign({}, rows[top], { qty: '5' }); rows.push(copy); // a second "Top" row that still says it is L1:3
    const r = await save(o, rows, 'Dee', true);
    const tops = live(S, 'L1').filter(x => x.part === 'Top').map(x => x.id + '×' + x.qty + ':' + x.status);
    rec('TW3 a copied row carrying the same line id: the original keeps its tick, the copy is a NEW line (not paired with a twin, nothing lost)',
      tops.length === 2 && tops.some(t => /^L1:3×1:cut$/.test(t)) && tops.some(t => /×5:todo$/.test(t)), JSON.stringify(r).slice(0, 120) + ' tops=' + JSON.stringify(tops));
    rec('TW9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await o.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
