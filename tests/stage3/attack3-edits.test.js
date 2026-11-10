// ATTACK 3 — office edit merge (542aeff, lsEditMerge): several offices with the same list open, saving one after another.
// Fake Supabase only (srv3.js). Run: node tests/stage3/attack3-edits.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const desc = S => live(S, 'L1').map(x => x.part + '×' + x.qty + (x.note ? '(' + x.note + ')' : '')).join(',');
async function save(t, rows, who, conf) {
  return t.page.evaluate(async ({ rows, who, conf }) => {
    window.__c = []; window.confirm = m => { window.__c.push(m); return conf; };
    try { await lsSaveManual({ wo: 'WO-1', name: 'House L1', project: 'Aderrig', rows }, who, lsList('L1')); return { ok: true, asked: window.__c }; }
    catch (e) { return { ok: false, err: e.message, asked: window.__c }; }
  }, { rows, who, conf });
}
(async () => {
  const browser = await H.chromium.launch();
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    const o = []; for (let i = 0; i < 6; i++) o.push(await F.dev(browser, S, 'office'));
    const rows = []; for (const t of o) rows.push(await t.page.evaluate(() => lsEditRows('L1'))); // all six open the editor now
    // rows: 0 Side, 1 Side (twin), 2 Top, 3 Hinge
    rows[0][2].qty = 3; const a = await save(o[0], rows[0], 'Ann', true);
    rows[1][3].qty = 10; const b = await save(o[1], rows[1], 'Bea', true);
    rows[2].push({ k: 'saw', item: 'Shelf', qty: 2, L: 500, W: 300, mat: 'MFC White', edging: '', note: '' }); const c = await save(o[2], rows[2], 'Cal', true);
    const s3 = desc(S);
    rec('E1 three offices, three different lines: Top=3 (Ann), Hinge=10 (Bea), Shelf added (Cal), nobody asked',
      a.ok && b.ok && c.ok && /Top×3/.test(s3) && /Hinge×10/.test(s3) && /Shelf×2/.test(s3) && !a.asked.length && !b.asked.length && !c.asked.length,
      s3 + ' | asked: ' + [a, b, c].map(x => x.asked.length + (x.err || '')).join(','));
    // Dee removes one of the Side twins (nobody else touched the Sides)
    rows[3].splice(1, 1); const d = await save(o[3], rows[3], 'Dee', true);
    const s4 = desc(S);
    rec('E2 fourth office removes one Side twin: Top 3, Hinge 10, Shelf all kept, one Side left, nobody asked',
      d.ok && !d.asked.length && /Top×3/.test(s4) && /Hinge×10/.test(s4) && /Shelf/.test(s4) && (s4.match(/Side/g) || []).length === 1, s4 + ' asked=' + d.asked.length);
    // Eve changed Top too (to 5) — a real clash: she is asked; she cancels → nothing changes
    rows[4][2].qty = 5; const e = await save(o[4], rows[4], 'Eve', false);
    rec('E3 fifth office changed Top as well: asked, Cancel → nothing saved', !e.ok && e.asked.length === 1 && desc(S) === s4, JSON.stringify(e).slice(0, 300) + ' now=' + desc(S));
    // Fay only adds a note to Hinge. Others meanwhile REMOVED a Side twin she never touched.
    rows[5][0].note = 'left hand'; const f = await save(o[5], rows[5], 'Fay', true);
    const s6 = desc(S);
    rec('E4 sixth office only edits the FIRST Side\'s note (a line nobody else changed): the Side twin Dee removed stays removed (she never touched it) and she is not asked to overwrite',
      f.ok && (s6.match(/Side/g) || []).length === 1 && !f.asked.length, 'now=' + s6 + ' | asked=' + JSON.stringify(f.asked).slice(0, 300) + ' (lsEditMerge: a line THEY removed that you did not touch is pushed to "over" — OK puts it back, Cancel loses your edit)');
    rec('E4b her note was saved and Ann/Bea/Cal changes still there', /Side×2\(left hand\)/.test(s6) && /Hinge×10/.test(s6) && /Top×3/.test(s6) && /Shelf/.test(s6), s6);
    for (const t of o) await t.close();
  }
  // ---------- E5: two offices both ADD the same new line (same content) — one line or two?
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    const ra = await a.page.evaluate(() => lsEditRows('L1')), rb = await b.page.evaluate(() => lsEditRows('L1'));
    const PL = { k: 'saw', item: 'Plinth', qty: 2, L: 2400, W: 150, mat: 'MFC White', edging: '', note: '' };
    ra.push(PL); rb.push(PL);
    await save(a, ra, 'Ann', true); const r = await save(b, rb, 'Bea', true);
    const n = live(S, 'L1').filter(x => x.part === 'Plinth').length;
    rec('E5 (info) both offices add the identical Plinth line: how many end up on the list', true, 'Plinth lines=' + n + ' (2 = doubled, the saw cuts 4) asked=' + r.asked.length);
    await a.close(); await b.close();
  }
  // ---------- E6: office A edits while the saw ticks Top; A did not touch Top → tick kept
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    const a = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
    const ra = await a.page.evaluate(() => lsEditRows('L1'));
    await F.tapRow(saw.page, 'data-rt', 'L1:3'); await F.send(saw.page);
    ra[3].qty = 12; const r = await save(a, ra, 'Ann', true);
    rec('E6 office edits Hinge while the saw ticks Top: Top keeps its tick, Hinge 12, not asked', r.ok && F.line(S, 'L1:3').status === 'cut' && F.line(S, 'L1:3').removed_rev == null && /Hinge×12/.test(desc(S)) && !r.asked.length, desc(S) + ' Top=' + F.line(S, 'L1:3').status + ' asked=' + r.asked.length);
    await a.close(); await saw.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
