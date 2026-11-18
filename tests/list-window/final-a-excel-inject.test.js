// FINAL Tester round, file D (14 Nov): "Start from… → An Excel file…" through the new window, and text injection
// (<script>, <img onerror>, quotes, O'Grady, emoji) in the list name, title, floor, unit, material name and note —
// in the window, the Saved ✓ panel, Lists home, Find old list, the saw / stores screens and their printed sheets.
// Fake Supabase only. Run: node tests/list-window/final-a-excel-inject.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const EV = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">', OG = "O'Grady \"Q\" & Sons 🪚", EV2 = '"><svg onload="window.__xss=3">\'';
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const xss = p => p.evaluate(() => ({ x: window.__xss || 0, img: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === 'x').length, svg: [...document.querySelectorAll('svg[onload]')].length, scr: [...document.querySelectorAll('#app script, .pod-ovl script')].length }));
const clean = v => !v.x && !v.img && !v.svg && !v.scr;
const o = (wo, floor, unit, title, due, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor, unit, title, dueDate: due, origDueDate: due, step: '5. WORK ORDER PROCESSED' }, x || {}));

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r0 = X.v2Row();
    for (let i = 1; i <= 12; i++) r0.orders.push(o('WO-E' + i, 'E', String(i), 'E' + i + ' KITCHEN', '2026-10-23'));
    r0.orders.push(H.order({ wo: 'WO-EVIL', customer: 'Aderrig Homes', floor: EV, unit: OG, title: EV + ' ' + OG, dueDate: '2026-10-23', origDueDate: '2026-10-23', step: '5. WORK ORDER PROCESSED' }));
    const S = X.makeServer(r0);
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    const feed = async (buf, name, ms) => { await p.evaluate(() => { window.__asked = []; }); await p.setInputFiles('#me-xlfile', { name: name || 'x.xlsx', mimeType: 'application/octet-stream', buffer: buf }); await sleep(ms || 1400); };
    const open = async (wo, id) => { await closeAll(p); await p.evaluate(({ wo, id }) => { window.__asked = []; window.__confirm = true; openListEditor(id || null, wo); }, { wo, id }); await sleep(1200); };
    const items = async () => (await rows(p)).filter(r => !r.hdr && (r.item || r.qty || r.L)).map(r => [r.item, r.qty, r.L, r.W, r.mat].join('/'));
    const matDlg = async how => { const has = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].filter(o => !o.querySelector('.me-ed')).pop(); return o ? o.innerText.replace(/\s+/g, ' ').slice(0, 300) : ''; }); return has; };

    // ---------- X1. a good file, real pick through Start from… ----------
    await open('WO-E1');
    const tapS = await p.click('#me-start summary').then(() => 'ok').catch(e => 'ERR'); await sleep(200);
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.click('#me-impxl').catch(() => {})]);
    rec('X1: Start from… → "An Excel file…" opens the file picker', tapS === 'ok' && !!fc);
    if (fc) await fc.setFiles({ name: 'good.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx({ 'E1': [['Project', 'Aderrig'], ['WO', 'WO-E1'], ['Floor', 'E'], ['Unit', '1'], [], COLS, ['Side', 2, 720, 560, 'MFC White', 'L2LE 1mm', 'Cap Left', 'grain'], ['Shelf', 3, 500, 300, 'MFC White'], ['Hinge', 8, '', '', 'Blum hinge']] }) }); await sleep(1500);
    let it = await items();
    rec('X1: good file → 3 rows in the window, nothing asked, sizes / material / edging / note read', it.length === 3 && it[0] === 'Side/2/720/560/MFC White' && it[2].startsWith('Hinge/8//') && !(await p.evaluate(() => window.__asked.length)), JSON.stringify([it, await matDlg(), await err(p)]));
    const e1 = await p.evaluate(() => { const g = k => (document.querySelector('.me-ed [data-mr="' + k + '"]') || {}).value; const i = [...document.querySelectorAll('.me-ed [data-row]')].findIndex(tr => (tr.querySelector('[data-mr$="|item"]') || {}).value === 'Side'); return [g(i + '|edging'), g(i + '|edging2'), g(i + '|note')]; });
    rec('X1: …Edging 1, Edging 2 (Cap Left) and Note of the first row came across', JSON.stringify(e1) === JSON.stringify(['L2LE 1mm', 'Cap Left', 'grain']), JSON.stringify(e1));
    await save(p, 2400); let d = await donep(p);
    const l1 = liveFor(S, 'WO-E1')[0];
    rec('X1: one big Save → Saved ✓, one list on WO-E1: 2 saw rows + 1 Stores row', !!d && /Saved ✓/.test(d.h) && liveFor(S, 'WO-E1').length === 1 && l1.n_saw === 2 && l1.n_fit === 1, JSON.stringify([d && d.h, await err(p), l1 && [l1.n_saw, l1.n_fit]]));
    await closeAll(p);

    // ---------- X2. headings with trailing spaces / other case / other order of the job cells ----------
    await open('WO-E2');
    await feed(xlsx({ 'S': [['Floor ', ' E'], ['unit', '2 '], ['WO ', ' WO-E2 '], [], ['Description ', ' QTY', 'Length ', 'width', ' Material ', 'Edging 1 ', 'EDGING 2', 'note '], ['Side ', ' 2', '720 ', ' 560', ' MFC White ', '', '', ' spaced '], ['Shelf', '3', '500', '300', 'mfc  white']] }));
    it = await items();
    rec('X2: headings with trailing spaces / capitals ("Description ", " QTY", "width", " Material ") → both rows read, values trimmed, nothing asked', it.length === 2 && it[0] === 'Side/2/720/560/MFC White' && it[1] === 'Shelf/3/500/300/MFC White' && !(await p.evaluate(() => window.__asked.length)), JSON.stringify([it, await p.evaluate(() => window.__asked.map(m => m.slice(0, 120))), await matDlg(), await err(p)]));
    await save(p, 2400); d = await donep(p);
    const l2 = liveFor(S, 'WO-E2')[0], ln2 = l2 ? linesOf(S, l2.id) : [];
    rec('X2: saved: 2 saw rows, note " spaced " kept as "spaced", no row flagged "material not on the project list"', !!d && ln2.length === 2 && ln2.every(x => x.kind === 'saw' && !x.material_other) && ln2[0].note === 'spaced', JSON.stringify([d && d.h, await err(p), ln2.map(x => [x.part, x.qty, x.material, x.material_other, x.note])]));
    await closeAll(p);

    // ---------- X3. blank rows, a totals row, a second heading row ----------
    await open('WO-E3');
    await feed(xlsx({ 'S': [COLS, [], ['Side', 2, 720, 560, 'MFC White'], [], ['', '', '', '', ''], ['   ', null, null, null, null], ['Shelf', 3, 500, 300, 'MFC White'], [], [], ['Total', 5], []] }));
    it = await items(); const all3 = await rows(p);
    rec('X3: blank rows in the middle and at the end are left out (Side, Shelf, and the "Total / 5" row as typed)', it.filter(x => /^Side|^Shelf/.test(x)).length === 2 && all3.filter(r => !r.hdr && !r.item && !r.qty).length <= 1, JSON.stringify(all3.map(r => [r.hdr ? 'H' : '', r.item, r.qty].join(':'))));
    rec('(info) X3: a "Total | 5" row at the bottom of the sheet ' + (it.some(x => /^Total/.test(x)) ? 'comes in as a Stores row "Total × 5" — the person must delete it' : 'is left out'), !it.some(x => /^Total/.test(x)), JSON.stringify(it));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---------- X4. script tags / quotes in the file ----------
    await open('WO-E4');
    await feed(xlsx({ [("<b>S'h\"").slice(0, 20)]: [['Project', EV], ['Floor', EV], ['Unit', OG], [], COLS, [EV, 2, 720, 560, 'MFC White', '', '', EV2], [OG, 1, 600, 300, EV, EV2, OG, OG], ['=HYPERLINK("http://x","click")', 1, 100, 100, 'MFC White']] }));
    let v = await xss(p);
    const q4 = await p.evaluate(() => window.__asked.slice()), md4 = await matDlg();
    rec('X4: a file with <script> / <img onerror> / quotes in the job cells, descriptions, material, edging and note → nothing runs while it is read / asked about', clean(v), JSON.stringify(v));
    // answer whatever it asks (other job? unknown material?) with OK / the first choice
    for (let k = 0; k < 3; k++) { const b = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].filter(o => !o.querySelector('.me-ed')).pop(); if (!o) return ''; const bs = [...o.querySelectorAll('button')]; const ok = bs.find(b => /add|use|ok|continue|keep|save|import/i.test(b.textContent) && !/cancel/i.test(b.textContent)) || bs[0]; if (ok) { const t = ok.textContent; ok.click(); return t; } return 'none'; }); if (!b) break; await sleep(900); }
    v = await xss(p); it = await items();
    rec('X4: …rows are in the window as plain text; still nothing ran', clean(v) && it.length >= 2 && (await rows(p)).some(r => r.item === EV) && (await rows(p)).some(r => r.item === OG), JSON.stringify([v, it.map(x => x.slice(0, 40)), q4.map(m => m.slice(0, 100)), md4.slice(0, 160), await err(p)]));
    const j4 = await job(p);
    rec('X4: …the window is still on WO-E4 (the file\'s odd Floor / Unit did not move it)', j4.hwo === 'WO-E4', JSON.stringify([j4.hwo, j4.err]));
    await setid(p, 'me-name', EV + OG); await save(p, 2600); d = await donep(p); v = await xss(p);
    const l4 = liveFor(S, 'WO-E4')[0], e4 = await err(p);
    rec('X4: Save → Saved ✓ (or a plain reason); the Saved panel shows the name as text; nothing ran', clean(v) && ((!!d && d.l.includes('<script>')) || e4.length > 0), JSON.stringify([d && d.h, e4, v]));
    rec('X4: stored exactly as typed (no stripping, no double-escaping): description and list name', !!l4 && l4.name === EV + OG && linesOf(S, l4.id).some(x => x.part === EV) && linesOf(S, l4.id).some(x => x.part === OG) && !JSON.stringify(linesOf(S, l4.id)).includes('&lt;'), l4 ? JSON.stringify(linesOf(S, l4.id).map(x => [x.part, x.material, x.note])).slice(0, 400) : e4);
    await closeAll(p);

    // ---------- X5. import when rows were already typed (same job: no question) ----------
    await open('WO-E5'); await fillSaw(p, 0, 'Typed first', '1', '100', '50', 'MFC White'); await setv(p, '0|note', 'mine');
    await feed(xlsx({ 'S': [['WO', 'WO-E5'], [], COLS, ['Side', 2, 720, 560, 'MFC White'], ['Shelf', 3, 500, 300, 'MFC White']] }));
    it = await items();
    rec('X5: one row typed, then a file for the same job → typed row kept on top (with its note), 2 rows added under it, nothing asked', it.length === 3 && it[0].startsWith('Typed first/1/100/50') && it[1].startsWith('Side') && !(await p.evaluate(() => window.__asked.length)) && (await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|note"]').value)) === 'mine', JSON.stringify([it, await p.evaluate(() => window.__asked.map(m => m.slice(0, 80)))]));
    // the same file a second time → doubled? asked?
    await feed(xlsx({ 'S': [['WO', 'WO-E5'], [], COLS, ['Side', 2, 720, 560, 'MFC White'], ['Shelf', 3, 500, 300, 'MFC White']] }));
    const it2 = await items(), a5 = await p.evaluate(() => window.__asked.slice());
    rec('[LOW] X5: the SAME file picked a second time by mistake → asked first (or not doubled) — else Side and Shelf are in twice and the saw cuts double', it2.length === 3 || a5.length > 0, JSON.stringify([it2, a5.map(m => m.slice(0, 80))]));
    // ↶ Undo takes the second import out
    await p.evaluate(() => { const m = document.getElementById('me-more'); if (m) m.open = true; const u = document.getElementById('me-undo'); if (u) u.click(); }); await sleep(400);
    const it3 = await items();
    rec('X5: ↶ Undo takes the last import out again (typed row + first import stay)', it3.length === 3 && it3[0].startsWith('Typed first'), JSON.stringify(it3));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---------- X6. odd quantities and sizes ----------
    await open('WO-E6');
    await feed(xlsx({ 'S': [COLS, ['Txt qty', '2 ', '720mm', '560 mm', 'MFC White'], ['Neg', -3, 720, 560, 'MFC White'], ['Zero', 0, 720, 560, 'MFC White'], ['Dec', 1.5, 720.5, 560, 'MFC White'], ['Huge', 99999999, 720, 560, 'MFC White'], ['X2', '2x2', 720, 560, 'MFC White'], ['Comma', '1,200', '1,200', 560, 'MFC White']] }));
    const r6 = await rows(p), g6 = n => r6.find(r => r.item === n) || {};
    rec('X6: "2 " → 2, "720mm" / "560 mm" → 720 / 560', g6('Txt qty').qty === '2' && g6('Txt qty').L === '720' && g6('Txt qty').W === '560', JSON.stringify(g6('Txt qty')));
    await save(p, 2200); d = await donep(p); let e6 = await err(p);
    rec('X6: Save with a negative / zero / "2x2" quantity in the list → NOT saved, the row is named in words, no Saved ✓', !d && liveFor(S, 'WO-E6').length === 0 && /Neg|Zero|X2|quantity/i.test(e6), JSON.stringify([d && d.h, e6]));
    rec('X6: …every imported row is still on screen after the refusal', (await rows(p)).filter(r => r.item).length === 7);
    rec('[LOW] X6: a Length typed in the sheet as text "1,200" is read as 1200 (or kept for the person to see) — it is DROPPED to blank without a word; ' + '"1,200" long is read as ' + JSON.stringify(g6('Comma').L) + ', qty "1,200" as ' + JSON.stringify(g6('Comma').qty) + '; 720.5 as ' + JSON.stringify(g6('Dec').L), g6('Comma').L === '1200' || g6('Comma').L === '1,200', JSON.stringify([g6('Comma'), g6('Dec')]));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---------- X7. not an Excel file / empty sheet / headings only ----------
    await open('WO-E7'); await fillSaw(p, 0, 'Keep me', '1', '100', '50', 'MFC White');
    await feed(Buffer.from('this is not a spreadsheet <script>window.__xss=9</script>'), 'notes.xlsx');
    let e7 = await err(p), t7 = await p.evaluate(() => document.body.innerText.match(/Could not read[^\n]*|not an Excel[^\n]*|No cutting list[^\n]*|no rows[^\n]*/i));
    rec('X7: a text file named .xlsx → told in words, typed row kept, window still open, nothing ran', (e7.length > 0 || !!t7) && (await items())[0].startsWith('Keep me') && await ed(p) && clean(await xss(p)), JSON.stringify([e7, t7 && t7[0], await items()]));
    await feed(xlsx({ 'S': [COLS] }));
    e7 = await err(p); t7 = await p.evaluate(() => document.body.innerText.match(/Could not read[^\n]*|No cutting list[^\n]*|no rows[^\n]*|nothing to[^\n]*/i));
    rec('X7: a sheet with headings only → told in words (not silence), typed row kept', (e7.length > 0 || !!t7) && (await items()).length === 1, JSON.stringify([e7, t7 && t7[0], await items()]));
    await feed(Buffer.alloc(0), 'empty.xlsx');
    e7 = await err(p); t7 = await p.evaluate(() => document.body.innerText.match(/Could not read[^\n]*|No cutting list[^\n]*|no rows[^\n]*|nothing to[^\n]*/i));
    rec('X7: a 0-byte file → told in words, typed row kept, no page error', (e7.length > 0 || !!t7) && (await items()).length === 1 && !(S.errors || []).length, JSON.stringify([e7, t7 && t7[0], S.errors]));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---------- X8. 2,000 rows ----------
    await open('WO-E8'); const big = [COLS]; for (let i = 0; i < 2000; i++) big.push(['Part ' + i, 1 + i % 5, 300 + i % 900, 200 + i % 300, 'MFC White', i % 2 ? 'L2LE 1mm' : '', '', i % 7 ? '' : 'note ' + i]);
    const t0 = Date.now(); await p.setInputFiles('#me-xlfile', { name: 'big.xlsx', mimeType: 'application/octet-stream', buffer: xlsx({ S: big }) });
    await p.waitForFunction(() => document.querySelectorAll('.me-ed [data-row]').length >= 2000, null, { timeout: 30000 }).catch(() => {});
    const ms = Date.now() - t0, n8 = (await rows(p)).length;
    rec('X8: a 2,000-row file is in the window within 15 s (took ' + ms + ' ms, ' + n8 + ' rows)', n8 >= 2000 && ms < 15000, ms + ' ms');
    const t1 = Date.now(); await click(p, 'me-save'); await p.waitForFunction(() => !!document.querySelector('.me-dov') || /Not saved|needs|Pick|Give/.test((document.getElementById('me-err') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
    d = await donep(p); const ms2 = Date.now() - t1, l8 = liveFor(S, 'WO-E8')[0];
    rec('X8: Save of 2,000 rows → Saved ✓ with all 2,000 in the database within 30 s (took ' + ms2 + ' ms)', !!d && !!l8 && linesOf(S, l8.id).length === 2000 && ms2 < 30000, JSON.stringify([d && d.h, await err(p), l8 && linesOf(S, l8.id).length]));
    await closeAll(p);

    // ---------- I. typed injection: list name, title, floor, unit, material name, note ----------
    await p.evaluate(({ EV, OG }) => { window.__xss = 0; window.__asked = []; window.__confirm = true; window.__prompt = m => /material/i.test(m) ? EV + ' ' + OG : 'Op'; openListEditor(null, '', 'P1'); }, { EV, OG }); await sleep(900);
    await setid(p, 'me-jf', EV); await setid(p, 'me-ju', OG + ' 77'); await setid(p, 'me-jt', EV2 + ' ' + OG); await click(p, 'me-find'); await sleep(600);
    v = await xss(p); rec('I1: Floor / Unit / Title typed with <script>, <img onerror>, quotes, O\'Grady, emoji → look-up result drawn as text, nothing ran', clean(v), JSON.stringify(v));
    await p.evaluate(() => { const b = document.getElementById('me-jmkp') || document.getElementById('me-jnone'); if (b) b.click(); }); await sleep(600);
    await setid(p, 'me-pdue', '2026-10-23'); await setid(p, 'me-pval', '1500'); await setid(p, 'me-phrs', '6'); await setid(p, 'me-name', EV + ' ' + OG);
    await fillSaw(p, 0, EV + OG, '2', '720', '560', 'MFC White'); await setv(p, '0|note', EV2 + OG);
    // a new material with the evil name, from the row
    await click(p, 'me-addsaw'); await sleep(200); await setv(p, '1|item', 'Evil board part'); await setv(p, '1|qty', '1'); await setv(p, '1|L', '600'); await setv(p, '1|W', '400');
    const add = await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="1|mat"]'); const op = [...s.options].find(o => /New material|Add new material/.test(o.textContent)); if (!op) return 'no option'; s.value = op.value; s.dispatchEvent(new Event('change')); return 'ok'; }); await sleep(1800);
    v = await xss(p); const r1 = (await rows(p))[1] || {};
    rec('I2: "＋ Add new material…" with the evil name → on the row as text, on the project once, nothing ran', add === 'ok' && clean(v) && r1.mat === EV + ' ' + OG && S.db.t.project_materials.filter(m => m.name === EV + ' ' + OG).length === 1, JSON.stringify([add, v, r1.mat, await err(p)]));
    await click(p, 'me-addsaw'); await sleep(200); await setv(p, '2|item', 'Emoji 🪚 hinge "soft" O\'Grady'); await setv(p, '2|qty', '4'); await setv(p, '2|note', '🙂 <b>bold</b>');
    await save(p, 3200); d = await donep(p); v = await xss(p);
    const pw = (S.row.orders.find(x => /^P-\d+$/.test(x.wo)) || {}).wo || '', li = liveFor(S, pw)[0];
    rec('I3: Save → Saved ✓; the Saved panel shows the evil list name as text; nothing ran', !!d && /Saved ✓/.test(d.h) && d.l.includes('<script>') && clean(v) && !/<script|<img|<svg/.test(d.html.replace(/&lt;/g, '')), JSON.stringify([d && d.h, await err(p), v, d && d.html.slice(0, 200)]));
    const pj = S.row.orders.find(x => x.wo === pw) || {};
    rec('I3: stored as typed: job floor / unit / title, list name, description, note, material', !!li && pj.floor === EV && pj.unit === OG + ' 77' && pj.title === EV2 + ' ' + OG && li.name === EV + ' ' + OG && linesOf(S, li.id)[0].part === EV + OG && linesOf(S, li.id)[0].note === EV2 + OG && linesOf(S, li.id)[1].material === EV + ' ' + OG, JSON.stringify([pj.floor, pj.unit, pj.title, li && li.name]).slice(0, 300));
    await closeAll(p);
    // re-open, Lists home, Find old list, View, Print
    await p.evaluate(id => openListEditor(id), li.id); await sleep(1300); v = await xss(p);
    rec('I4: the list opened again in the window → nothing runs; the name box holds the exact text', clean(v) && (await p.evaluate(() => document.getElementById('me-name').value)) === EV + ' ' + OG, JSON.stringify(v));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
    await p.evaluate(async () => { showTab && 0; try { LH.kind = 'live'; LH.proj = ''; LH.state = ''; } catch (e) {} render(); await new Promise(r => setTimeout(r, 400)); }); v = await xss(p);
    rec('I5: Cutting Lists home with that list and job on it → nothing runs', clean(v), JSON.stringify(v));
    await p.evaluate(() => lsFindDlg('P1')); await sleep(600);
    for (const term of ['script', "o'grady", '🪚', '"q"', 'onerror']) { await p.evaluate(term => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const q = o.querySelector('#fo-q'); q.value = term; q.dispatchEvent(new Event('input')); }, term); await sleep(350);
      const tx = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().innerText); v = await xss(p);
      rec('I6: Find old list, search "' + term + '" → finds the list by its typed name, drawn as text, nothing runs', clean(v) && tx.includes('<script>window.__xss=1</script>'), JSON.stringify([v, tx.replace(/\s+/g, ' ').slice(0, 160)])); }
    await closeAll(p);
    await p.evaluate(id => { window.__opened = []; lsViewDlg(id); }, li.id); await sleep(700); v = await xss(p);
    rec('I7: 👁 View of the list → nothing runs', clean(v), JSON.stringify(v));
    await p.evaluate(id => { try { lsPrintList(id); } catch (e) { window.__perr = e.message; } }, li.id); await sleep(500);
    const pr = await p.evaluate(() => ({ n: window.__opened.length, h: window.__opened.slice(-1)[0] || '', e: window.__perr || '' }));
    const rawBad = h => /<script>window\.__xss|<img src=x|<svg onload/i.test(h);
    rec('I7: 🖨 Print of the list: the sheet is written, with the evil text escaped (no live <script> / <img onerror> / <svg onload> in it)', pr.n > 0 && !rawBad(pr.h) && /&lt;script/.test(pr.h) && /O(&#39;|'|&apos;)Grady/.test(pr.h), JSON.stringify([pr.n, pr.e, pr.h.length, (pr.h.match(/.{60}window\.__xss.{30}/) || [''])[0]]));
    await closeAll(p);
    // the saw and stores screens + their printed sheets
    for (const role of ['saw', 'stores']) {
      const s = await X.dev(browser, S, role), ps = s.page; await sleep(900);
      const seen = await ps.evaluate(() => document.body.innerText.includes('<script>window.__xss=1</script>') || /Emoji 🪚 hinge "soft" O'Grady/.test(document.body.innerText));
      v = await xss(ps);
      const body0 = await ps.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 600));
      rec('I8 (' + role + ' screen): the screen draws with that list / job on it; nothing runs' + (seen ? '' : ' (the evil text itself is not on the first screen here — it is on the printed sheet below)'), clean(v) && body0.length > 50, JSON.stringify([v, seen, body0.slice(0, 200)]));
      // open the list's rows the way the person does (every expandable thing on the page)
      await ps.evaluate(() => { document.querySelectorAll('[data-wlopen],[data-lopen],[data-open],details').forEach(e => { try { if (e.tagName === 'DETAILS') e.open = true; else e.click(); } catch (x) {} }); }); await sleep(600);
      v = await xss(ps); rec('I8 (' + role + ' screen): rows opened → nothing runs', clean(v), JSON.stringify(v));
      const prs = await ps.evaluate(() => { window.__opened = []; const out = []; ['wl-pr1', 'wl-pr3'].forEach(id => { const b = document.getElementById(id); if (b) { try { b.click(); } catch (e) { out.push('ERR ' + e.message); } } else out.push('no #' + id); }); return { out, h: window.__opened.slice() }; }); await sleep(400);
      const hs = await ps.evaluate(() => window.__opened.slice());
      rec('I9 (' + role + ' printed sheet): "🖨 Print today" writes a sheet that carries the evil text ESCAPED and nothing live', hs.length > 0 && hs.every(h => !rawBad(h)) && hs.some(h => /&lt;script/.test(h)), JSON.stringify([prs.out, hs.length, hs.map(h => h.length), hs.map(h => (h.match(/.{50}window\.__xss.{20}/) || [''])[0])]).slice(0, 500));
      rec('I9 (' + role + '): no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300)); S.errors = [];
      await s.close();
    }
    // the job with evil floor / unit / title opened from the board
    await p.evaluate(() => { window.__xss = 0; openListEditor(null, 'WO-EVIL'); }); await sleep(1300); v = await xss(p);
    const je = await job(p);
    rec('I10: a Cienapps job whose Floor / Unit / Title carry <script> / O\'Grady opened in the window → shown as text, WO in the title bar, nothing runs', clean(v) && je.hwo === 'WO-EVIL' && je.info.includes('<script>'), JSON.stringify([v, je.hwo, je.info.slice(0, 120)]));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 400));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
