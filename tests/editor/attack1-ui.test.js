// Tester attack 1 on the list editor screen (browser, fake Supabase only):
//  - a 500-row paste from Excel: how long it takes, the redraw after, and saving it
//  - keyboard focus after deleting the LAST row / the ONLY row, and after "＋ Row"
//  - a Units change while a tick lands (editor open): refused at save, the typed work stays on screen
//  - 360 px Chrome: cards with long descriptions / colours / "already cut on old list" notes
// Run: node tests/editor/attack1-ui.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 500))); };
const set = (k, v) => `(()=>{const e=document.querySelector('.pod-ovl [data-mr="${k}"]');e.value=${JSON.stringify(v)};(e.tagName==='SELECT'?e.onchange:e.oninput)();})()`;
const paste = (pg, mr, text) => pg.evaluate(({ mr, text }) => { const e = document.querySelector('.pod-ovl [data-mr="' + mr + '"]'); e.focus(); const dt = new DataTransfer(); dt.setData('text/plain', text);
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); e.dispatchEvent(ev); return ev.defaultPrevented; }, { mr, text });
const key = (pg, mr, k, mods) => pg.evaluate(({ mr, k, mods }) => { const e = document.querySelector('.pod-ovl [data-mr="' + mr + '"]'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, mods || {}))); }, { mr, k, mods });
const focus = pg => pg.evaluate(() => { const a = document.activeElement; return a && a.dataset && a.dataset.mr ? a.dataset.mr : (a ? a.tagName + '#' + a.id : 'none'); });
const wait = async (fn, ms = 8000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: [['hdr', '900 Single Rail', '3', null, null, null, '', '', {}], ['saw', 'Side panel', '6', 2380, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '2' }], ['saw', 'Shelf', '3', 864, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '1' }]] });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why/.test(m) ? 'site measure' : 'Tester'; window.confirm = () => true; });

  // ---- 500-row paste
  let big = 'Description\tQty\tLength\tWidth\tColour\tEdging\n'; let exp = 0;
  for (let i = 0; i < 500; i++) { if (i % 50 === 0) big += 'Room ' + (i / 50 + 1) + '\n'; const q = i % 5 + 1; exp += q; big += '"Part ' + i + '"\t' + q + '\t' + (300 + i) + '\t' + (200 + i % 100) + '\tMFC White\tL1LE 1mm\n'; }
  await pg.evaluate(() => openListEditor(null, 'WO-2'));
  const t0 = Date.now(); await paste(pg, '0|item', big); const ms = Date.now() - t0;
  const n = await pg.evaluate(() => document.querySelectorAll('.pod-ovl [data-mr$="|item"]').length);
  rec('500-row paste (quoted descriptions): 510 rows on screen in under 3 s', n >= 510 && ms < 3000, JSON.stringify({ n, ms }));
  const t1 = Date.now(); await pg.evaluate(set('5|qty', '9')); const ms2 = Date.now() - t1;
  rec('typing in a 510-row list stays quick (one cell change under 300 ms)', ms2 < 300, ms2 + ' ms');
  const it0 = await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="1|item"]').value);
  rec('quoted descriptions lose their quotes (Part 0, not "Part 0")', it0 === 'Part 0', it0);
  await pg.evaluate(() => { document.querySelector('#me-name').value = 'Big paste'; document.getElementById('me-save').click(); });
  await wait(() => S.db.t.lists.some(l => l.name === 'Big paste'), 15000);
  const bl = S.db.t.lists.find(l => l.name === 'Big paste'), bln = bl ? S.db.t.list_lines.filter(x => x.list_id === bl.id) : [];
  const sum = bln.filter(x => x.kind === 'saw').reduce((s, x) => s + (+x.qty || 0), 0);
  rec('500-row list saved: 500 saw lines + 10 headings, total quantity = pasted total (Part 4 changed 5 → 9)', bln.filter(x => x.kind === 'saw').length === 500 && bln.filter(x => x.kind === 'hdr').length === 10 && sum === exp - 5 + 9, JSON.stringify({ saw: bln.filter(x => x.kind === 'saw').length, hdr: bln.filter(x => x.kind === 'hdr').length, sum, exp: exp - 5 + 9 }));

  // ---- focus after deleting the last row / the only row / ＋ Row
  await pg.evaluate(() => openListEditor(null, 'WO-2'));
  await pg.evaluate(set('0|item', 'A')); await key(pg, '0|note', 'Enter'); await pg.evaluate(set('1|item', 'B')); await key(pg, '1|note', 'Enter'); await pg.evaluate(set('2|item', 'C'));
  await key(pg, '2|qty', 'Delete', { ctrlKey: true });
  const f1 = await focus(pg);
  rec('Ctrl+Delete on the LAST row: the cursor goes to the row above (same column), not lost', f1 === '1|qty', f1);
  await key(pg, '1|qty', 'Delete', { ctrlKey: true }); await key(pg, '0|qty', 'Delete', { ctrlKey: true });
  const f2 = await pg.evaluate(() => ({ f: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.mr : null, rows: document.querySelectorAll('.pod-ovl [data-mr$="|item"]').length }));
  rec('Ctrl+Delete on the ONLY row: an empty row is left with the cursor in it (the grid never goes empty)', f2.rows >= 1 && /^0\|/.test(f2.f || ''), JSON.stringify(f2));
  await pg.evaluate(() => document.querySelector('.pod-ovl').remove());

  // ---- Units change while a tick lands (editor open): refused, the typing stays
  await pg.evaluate(async () => { await lsPoll(); openListEditor('L1'); });
  await pg.evaluate(set('0|units', '4')); await pg.evaluate(set('2|note', 'typed while the saw was cutting'));
  D.applyLineChanges(S.db, [{ id: 'L1:2', status: 'cut', cid: 'c9', rev: D.find(S.db, 'lists', 'L1').rev }], 'Sean');
  await pg.evaluate(() => document.getElementById('me-save').click());
  await wait(async () => /Saw has started|Not saved/.test(await pg.evaluate(() => (document.getElementById('me-err') || {}).textContent || '')));
  const r = await pg.evaluate(() => ({ err: (document.getElementById('me-err') || {}).textContent || '', open: !!document.querySelector('.pod-ovl'), note: (document.querySelector('.pod-ovl [data-mr="2|note"]') || {}).value, copy: !!document.querySelector('.pod-ovl [data-mecopy]') }));
  rec('Units changed, then a tick lands before Save: refused with "Saw has started", editor stays open with the typing', /Saw has started/.test(r.err) && r.open && r.note === 'typed while the saw was cutting' && D.find(S.db, 'list_lines', 'L1:1').qty === '3', JSON.stringify(r));
  rec('…and the person is offered "Make new list from this" right there (the Units box now locked)', r.copy && await pg.evaluate(() => { const u = document.querySelector('.pod-ovl [data-mr="0|units"]'); return !!u && u.disabled; }), JSON.stringify(r));
  await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); if (ov) ov.remove(); });
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close();

  // ---- 360 px: long names in cards + "already cut on old list" note
  {
    const S2 = F.makeServer(F.v2Row());
    const longD = 'Side panel left hand with scribe allowance to suit uneven wall and cut-out for pipework at 150mm from floor';
    const longC = 'Egger H3303 ST10 Natural Hamilton Oak Feelwood 18mm double sided';
    F.seedList(S2, 'LO', { name: 'House 9', wos: ['WO-2'], lines: [['hdr', '1200 Double Rail with drawers and pull-out trouser rack and shoe shelves', '3', null, null, null, '', '', {}], ['saw', longD, '6', 2380, 570, longC, 'L1LE 1mm', 'NOTEWITHOUTANYSPACESATALLTHATGOESONANDONANDON', { section: 'x', unit_qty: '2' }]] });
    D.update(S2.db, 'list_lines', D.find(S2.db, 'list_lines', 'LO:2'), { status: 'cut', status_by: 'Sean', status_at: '2026-10-21T08:00:00Z' });
    D.insert(S2.db, 'project_materials', { id: 'ML', project_id: 'P1', name: longC, kind: 'sheet' });
    const ph = await F.dev(browser, S2, 'office', { viewport: { width: 360, height: 780 } }), pp = ph.page;
    await pp.evaluate(() => { window.prompt = () => 'Tester'; window.confirm = () => true; });
    await pp.evaluate(async () => { await lsPoll(); openListEditor('LO'); const b = document.querySelector('.pod-ovl [data-mecopy]'); if (b) b.click(); await new Promise(r => setTimeout(r, 400)); });
    const w = await pp.evaluate(() => { const ov = document.querySelector('.pod-ovl'), pin = ov.querySelector('.pod-in');
      return { over: pin.scrollWidth - pin.clientWidth, doc: document.documentElement.scrollWidth - 360, note: !!ov.querySelector('.pc-b'), wide: [...ov.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > 361).slice(0, 3).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)) }; });
    rec('360 px editor cards with long description / colour / note and the "already cut on old list" badge: nothing off the side', w.over <= 1 && w.doc <= 1, JSON.stringify(w));
    rec('360 px: the "already cut on old list" note is shown on the phone card', w.note, JSON.stringify(w));
    await ph.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
