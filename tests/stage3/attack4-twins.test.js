// ATTACK 4 — identical twin lines in the office editor: which twin does a removal / edit hit? (follow-up to E4v5)
// Fake Supabase only. Run: node tests/stage3/attack4-twins.test.js
const A = require('./atk.js');
const { F, H, rec } = A;
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
async function save(t, rows, who, conf) {
  return t.page.evaluate(async ({ rows, who, conf }) => {
    window.__c = []; window.confirm = m => { window.__c.push(m); return conf; };
    try { await lsSaveManual({ wo: 'WO-1', name: 'House L1', project: 'Aderrig', rows }, who, lsList('L1')); return { ok: true, asked: window.__c }; }
    catch (e) { return { ok: false, err: e.message, asked: window.__c }; }
  }, { rows, who, conf });
}
(async () => {
  const browser = await H.chromium.launch();
  for (const rm of [0, 1]) {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    const saw = await F.dev(browser, S, 'saw'); await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.send(saw.page); // Side #1 is CUT
    const o = await F.dev(browser, S, 'office');
    const rows = await o.page.evaluate(() => lsEditRows('L1'));
    const lid = rows[rm].lid;
    rows.splice(rm, 1); const r = await save(o, rows, 'Dee', true);
    const sides = live(S, 'L1').filter(x => x.part === 'Side').map(x => x.id + ':' + x.status);
    rec('T' + rm + ' office deletes editor row ' + rm + ' (' + lid + ', ' + (rm === 0 ? 'the CUT twin' : 'the todo twin') + '): that exact line goes, the other keeps its status',
      sides.length === 1 && sides[0] !== lid + ':' + (rm === 0 ? 'cut' : 'todo') && !sides[0].startsWith(lid + ':'), JSON.stringify(sides) + ' save=' + JSON.stringify(r).slice(0, 150));
    await saw.close(); await o.close();
  }
  { // E4v5 with ticks: Dee deletes Side #1 (row 0); Fay (opened earlier) edits Side #2 qty → expect one Side, qty 4
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    const ra = await a.page.evaluate(() => lsEditRows('L1')), rb = await b.page.evaluate(() => lsEditRows('L1'));
    ra.splice(0, 1); await save(a, ra, 'Dee', true);
    const afterDee = live(S, 'L1').filter(x => x.part === 'Side').map(x => x.id);
    rb[1].qty = 4; const f = await save(b, rb, 'Fay', true);
    const sides = live(S, 'L1').filter(x => x.part === 'Side').map(x => x.id + '×' + x.qty);
    rec('T2 Dee deletes Side #1, then Fay edits Side #2 to qty 4: one Side ×4, Fay not asked', sides.length === 1 && /×4$/.test(sides[0]) && !f.asked.length,
      'after Dee=' + JSON.stringify(afterDee) + ' final=' + JSON.stringify(sides) + ' asked=' + JSON.stringify(f.asked).slice(0, 260));
    await a.close(); await b.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
