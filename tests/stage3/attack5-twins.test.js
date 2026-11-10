// ATTACK 5 — editor matches by line id (6461ad3) with FOUR identical lines, two of them cut; edits from two stale editors;
// a re-save without line ids (like an Excel re-upload). Fake Supabase only. Run: node tests/stage3/attack5-twins.test.js
const A = require('./atk.js');
const { F, H, rec } = A;
const SIDE = ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''];
const LINES = [SIDE, SIDE, SIDE, SIDE, ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']];
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const sides = S => live(S, 'L1').filter(x => x.part === 'Side').map(x => x.id + ':' + x.status + '×' + x.qty).join(' ');
async function save(t, rows, who) {
  return t.page.evaluate(async ({ rows, who }) => {
    window.__c = []; window.confirm = m => { window.__c.push(m); return true; }; window.prompt = () => 'drawing changed';
    try { await lsSaveManual({ wo: 'WO-1', name: 'House L1', project: 'Aderrig', rows }, who, lsList('L1')); return { ok: true, asked: window.__c }; }
    catch (e) { return { ok: false, err: e.message, asked: window.__c }; }
  }, { rows, who });
}
async function setup(browser) {
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { lines: LINES, list: { source: 'manual' } });
  const saw = await F.dev(browser, S, 'saw');
  for (const id of ['L1:2', 'L1:4']) await F.tapRow(saw.page, 'data-rt', id);
  await F.send(saw.page); await saw.close();
  return S;
}
(async () => {
  const browser = await H.chromium.launch();
  { // W1: delete each of the four twins in turn — exactly that line goes, the others keep their status
    for (const rm of [0, 1, 2, 3]) {
      const S = await setup(browser); const o = await F.dev(browser, S, 'office');
      const rows = await o.page.evaluate(() => lsEditRows('L1')); const lid = rows[rm].lid;
      rows.splice(rm, 1); const r = await save(o, rows, 'Dee');
      const want = ['L1:1:todo×2', 'L1:2:cut×2', 'L1:3:todo×2', 'L1:4:cut×2'].filter(x => !x.startsWith(lid + ':')).join(' ');
      rec('W1/' + rm + ' 4 twins (2 cut): deleting editor row ' + rm + ' (' + lid + ') removes exactly that line', r.ok && sides(S) === want, 'got ' + sides(S) + ' want ' + want + ' ' + (r.err || ''));
      await o.close();
    }
  }
  { // W2: change qty on the 3rd twin (todo) → only L1:3 changes; cut twins untouched
    const S = await setup(browser); const o = await F.dev(browser, S, 'office');
    const rows = await o.page.evaluate(() => lsEditRows('L1')); rows[2].qty = 5; const r = await save(o, rows, 'Dee');
    rec('W2 qty change on twin 3 lands on L1:3 only', r.ok && sides(S) === 'L1:1:todo×2 L1:2:cut×2 L1:3:todo×5 L1:4:cut×2', sides(S) + ' ' + (r.err || ''));
    await o.close();
  }
  { // W3: Dee deletes twin 3; Fay (opened before) changes twin 1 qty → L1:1×4 todo, L1:2 cut, L1:4 cut; Fay not asked
    const S = await setup(browser);
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    const ra = await a.page.evaluate(() => lsEditRows('L1')), rb = await b.page.evaluate(() => lsEditRows('L1'));
    ra.splice(2, 1); await save(a, ra, 'Dee');
    rb[0].qty = 4; const f = await save(b, rb, 'Fay');
    rec('W3 Dee deletes twin 3, Fay (stale) changes twin 1: both kept, cut twins untouched, Fay not asked',
      sides(S) === 'L1:1:todo×4 L1:2:cut×2 L1:4:cut×2' && !f.asked.length, sides(S) + ' asked=' + JSON.stringify(f.asked).slice(0, 200));
    await a.close(); await b.close();
  }
  { // W4: Dee deletes twin 1; Fay (stale) changes the CUT twin 4's qty → asked? at least L1:2 stays cut, twin 1 stays gone
    const S = await setup(browser);
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    const ra = await a.page.evaluate(() => lsEditRows('L1')), rb = await b.page.evaluate(() => lsEditRows('L1'));
    ra.splice(0, 1); await save(a, ra, 'Dee');
    rb[3].qty = 3; const f = await save(b, rb, 'Fay');
    rec('W4 Dee deletes twin 1, Fay (stale) changes twin 4: L1:1 stays removed, L1:2 cut, L1:3 todo, L1:4 ×3',
      /^L1:2:cut×2 L1:3:todo×2 L1:4:\w+×3$/.test(sides(S)), sides(S) + ' asked=' + JSON.stringify(f.asked).slice(0, 200));
    await a.close(); await b.close();
  }
  { // W5: Fay's stale editor still shows twin 2 (cut) which Dee DELETED; Fay changed it → asked, and if she says OK it must not
    //     land on a different twin (L1:4, also cut)
    const S = await setup(browser);
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    const ra = await a.page.evaluate(() => lsEditRows('L1')), rb = await b.page.evaluate(() => lsEditRows('L1'));
    ra.splice(1, 1); await save(a, ra, 'Dee');
    rb[1].qty = 7; rb.splice(3, 1); // Fay also deletes twin 4 (cut) in her editor
    const f = await save(b, rb, 'Fay');
    const s = sides(S);
    rec('W5 Fay puts back (changed) a twin Dee removed and removes twin 4: no other line inherits twin 4\'s or twin 2\'s id',
      !/L1:2:/.test(s) && !/L1:4:/.test(s) && /×7/.test(s), s + ' asked=' + f.asked.length);
    await a.close(); await b.close();
  }
  { // W6: re-save WITHOUT line ids (an Excel re-upload with three Sides instead of four): both cut twins survive
    const S = await setup(browser); const o = await F.dev(browser, S, 'office');
    const rows = (await o.page.evaluate(() => lsEditRows('L1'))).map(r => { const x = { ...r }; delete x.lid; delete x.sig; delete x.opened; delete x.ids; return x; });
    rows.splice(0, 1); const r = await save(o, rows, 'Dee');
    const s = sides(S);
    rec('W6 no-id re-save with one Side fewer: the two cut twins (L1:2, L1:4) survive, one todo twin removed', r.ok && /L1:2:cut/.test(s) && /L1:4:cut/.test(s) && s.split(' ').length === 3, s + ' ' + (r.err || ''));
    await o.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
