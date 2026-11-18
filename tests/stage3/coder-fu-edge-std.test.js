// Coder checks for Garry's 4 Nov requests (switch ON, fake Supabase only):
//  1. Floor and Unit kept apart: saw card chips, Lists home columns, delivery board chip, office board columns, search on both.
//  2. Two edging columns: Edging 1 + Edging 2 in the editor, saved as edging / edging2, shown "L1LE 1mm / L4S 2mm" on the saw;
//     Excel column G that reads like an edging code → Edging 2 (else the note, as before); a column headed "Edging 2".
//  3. "New list – standard layout": house heading from the WO's unit + Fillers and Kickers / Worktops / Stores items, 2 empty
//     rows each; the Colour drop-down lists only that project's materials + "+ Add new material…".
// Screenshots (1400 and 360 wide) go to $SHOTS when it is set. Run: node tests/stage3/coder-fu-edge-std.test.js
const F = require('./fix3.js');
const { H, D } = F;
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 600))); };
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row();
  Object.assign(row.orders[0], { floor: '1', unit: '22', title: 'HOUSE 22 TYPE B', delv: true, delVeh: 'VOLVO', delDay: 'Thu' });
  Object.assign(row.orders[1], { floor: '0', unit: '7' });
  // WO-3: processed, no list, no template → "Cutting lists to issue" row with the standard-layout button
  row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', floor: '2', unit: '31', step: '5. WORK ORDER PROCESSED', dueDate: '2026-10-28', origDueDate: '2026-10-28' }));
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { name: '22', wos: ['WO-1'], lines: [
    ['hdr', 'House 22', null, null, null, null, '', ''],
    ['saw', 'Gable', '2', 720, 560, 'MFC White', 'L1LE 1mm', 'scribe', { edging2: 'L4S 2mm', section: 'House 22' }],
    ['saw', 'Kicker', '1', 2400, 150, 'MFC White', 'L4S 1mm', '', { section: 'House 22' }]] });
  // another project's material — must never show in Aderrig's drop-down
  D.insert(S.db, 'projects', { id: 'P2', name: 'Other site' }); D.insert(S.db, 'project_materials', { id: 'MX', project_id: 'P2', name: 'Oak Other Site', kind: 'sheet' });

  // ---- 1. saw card
  const saw = await F.dev(browser, S, 'saw', { viewport: { width: 1400, height: 900 } });
  const card = await saw.page.evaluate(() => { const c = document.querySelector('.wl-card'); if (!c) return null;
    return { chips: [...c.querySelectorAll('.wl-h .lst-chip')].map(x => x.textContent.trim()), fl: !!c.querySelector('.fu-fl'), un: !!c.querySelector('.fu-un'), txt: c.innerText }; });
  rec('saw card: WO, Floor and Unit are three separate chips ("WO-1", "Floor 1", "Unit 22")', card && card.chips.join('|') === 'WO-1|Floor 1|Unit 22', JSON.stringify(card && card.chips));
  rec('saw card: the two edgings show together "L1LE 1mm / L4S 2mm" (then the note)', card && /L1LE 1mm \/ L4S 2mm · scribe/.test(card.txt), card && card.txt.slice(0, 400));
  rec('saw card: a line with one edging shows just that edging', card && /L4S 1mm/.test(card.txt) && !/L4S 1mm \//.test(card.txt));
  if (SHOTS) { await saw.page.screenshot({ path: SHOTS + '/saw-card-1400.png' }); await saw.page.setViewportSize({ width: 360, height: 800 }); await saw.page.evaluate(() => render()); await saw.page.waitForTimeout(200); await saw.page.screenshot({ path: SHOTS + '/saw-card-360.png', fullPage: false }); }
  await saw.close();

  // ---- office: board, Lists home, delivery board, editor, standard layout
  const off = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } });
  const p = off.page;
  const board = await p.evaluate(() => { showTab('b'); const th = [...document.querySelectorAll('.wo-table th')].map(x => x.textContent.trim());
    const tr = [...document.querySelectorAll('.wo-table tbody tr')].find(r => /WO-1\b/.test(r.textContent)); const fi = th.indexOf('Floor'), ui = th.indexOf('Unit');
    return { fi, ui, f: tr && tr.children[fi] ? tr.children[fi].textContent.trim() : null, u: tr && tr.children[ui] ? tr.children[ui].textContent.trim() : null }; });
  rec('office board: separate Floor and Unit columns ("1" and "22")', board.fi >= 0 && board.ui === board.fi + 1 && board.f === '1' && board.u === '22', JSON.stringify(board));
  if (SHOTS) { await p.evaluate(() => { const r = [...document.querySelectorAll('.wo-table tbody tr')].find(r => /WO-1\b/.test(r.textContent)); if (r) r.scrollIntoView({ block: 'center' }); }); await p.screenshot({ path: SHOTS + '/board-row-1400.png' }); }
  const lh = await p.evaluate(() => { showTab('l'); const th = [...document.querySelector('[data-lhrow="L1"]').closest('table').querySelectorAll('th')].map(x => x.textContent.trim()); const r = document.querySelector('[data-lhrow="L1"]');
    return { th, cells: r ? [...r.children].map(x => x.textContent.trim()) : null, std: !!document.getElementById('lh-new') && !document.getElementById('lh-std') && !!document.getElementById('lh-blank') }; });
  const fi = lh.th.indexOf('Floor');
  rec('Lists home: its own Floor and Unit columns (1 / 22)', fi > 0 && lh.th[fi + 1] === 'Unit' && lh.cells && lh.cells[fi] === '1' && lh.cells[fi + 1] === '22', JSON.stringify(lh));
  const srch = await p.evaluate(() => { const r = {}; for (const q of ['22', 'WO-1']) { LH.q = q; render(); r[q] = !!document.querySelector('[data-lhrow="L1"]'); } LH.q = ''; render(); return r; });
  rec('Lists home search still finds the list by unit and by WO', srch['22'] && srch['WO-1'], JSON.stringify(srch));
  const dl = await p.evaluate(() => { showTab('d'); const ch = [...document.querySelectorAll('.dchip')].find(c => /WO-1(?!\d)/.test(c.textContent)); return ch ? { fl: (ch.querySelector('.fu-fl') || {}).textContent, un: (ch.querySelector('.fu-un') || {}).textContent } : null; });
  rec('delivery board chip: "Floor 1" and "Unit 22" are separate badges', dl && dl.fl === 'Floor 1' && dl.un === 'Unit 22', JSON.stringify(dl));
  const ds = await p.evaluate(() => { const i = document.getElementById('dsrch'); const vis = q => { i.value = q; i.oninput && i.oninput.call(i); const ch = [...document.querySelectorAll('.dchip')].find(c => /WO-1(?!\d)/.test(c.textContent)); return ch ? ch.style.display !== 'none' && !ch.hidden : false; }; return { u: vis('22'), f: vis('VOLVO') || true }; });
  rec('delivery board filter still matches the unit', ds.u, JSON.stringify(ds));

  // ---- 2. edging: editor columns, save edging2
  const ed = await p.evaluate(async () => { showTab('l'); openListEditor2('L1'); await new Promise(r => setTimeout(r, 100));
    const th = [...document.querySelectorAll('.me-grid th')].map(x => x.textContent.trim());
    const e1 = document.querySelector('[data-mr="2|edging"]'), e2 = document.querySelector('[data-mr="2|edging2"]');
    const g1 = document.querySelector('[data-mr="1|edging2"]');
    return { th, e1: e1 && e1.value, e2: e2 && e2.value, list: e2 && e2.tagName, g1: g1 && g1.value, opts: e2 ? [...e2.options].map(o => o.value) : [] }; });
  rec('editor: columns "Edging 1" and "Edging 2" side by side', ed.th.indexOf('Edging 2') === ed.th.indexOf('Edging 1') + 1 && ed.th.indexOf('Edging 1') > 0, JSON.stringify(ed.th));
  rec('editor: Edging 2 loads the saved value and uses the same code list (drop-down + free text)', ed.g1 === 'L4S 2mm' && ed.list === 'SELECT' && ed.opts.includes('L1LE 1mm') && ed.opts.includes('L4S 2mm'), JSON.stringify(ed));
  await p.evaluate(() => { const e = document.querySelector('[data-mr="2|edging2"]'); e.value = 'L2S1LE'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(async () => { localStorage.setItem('wpfOffName', 'Ann'); document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 300)); const b = [...document.querySelectorAll('button')].find(x => /^(OK|Save|Continue)/.test(x.textContent.trim()) && x.closest('.pod-ovl') && !x.closest('.me-ed')); if (b) b.click(); await new Promise(r => setTimeout(r, 800)); });
  const k = D.find(S.db, 'list_lines', 'L1:3'), g = D.find(S.db, 'list_lines', 'L1:2');
  rec('editor save: Kicker edging2 = "L2S1LE", edging kept "L4S 1mm"; Gable keeps "L4S 2mm"', k && k.edging2 === 'L2S1LE' && k.edging === 'L4S 1mm' && g && g.edging2 === 'L4S 2mm', JSON.stringify([k && [k.edging, k.edging2], g && [g.edging, g.edging2]]));
  await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); if (o) o.remove(); });

  // ---- 2b. parse: column G
  const pg = await p.evaluate(() => {
    const a = lsParseGrid([['House 9'], ['Gable', 2, 720, 560, 'MFC White', 'L1LE 1mm', 'L4S 2mm', 'scribe'], ['Panel', 1, 700, 500, 'MFC White', 'L4S 1mm', 'Talk to Ollie'], ['Filler', 1, 700, 100, 'MFC White', '2L2S', '1mm ABS']], {});
    const b = lsParseGrid([['Description', 'Qty', 'Length', 'Width', 'Colour', 'Edging 1', 'Edging 2', 'Note'], ['Gable', 2, 720, 560, 'MFC White', 'L1LE 1mm', 'odd code', 'note here']], {});
    const c = lsParseGrid([['Sink', 1, '', '', 'Hafele Calder', 'L4S 2mm', 'x']], {});
    const p = x => x.rows.filter(r => r.k === 'part').map(r => [r.item, r.edging || '', r.edging2 || '', r.note || '']);
    return { a: p(a), b: p(b), c: p(c), looks: ['L1LE 1mm', 'L2S1LE', 'L4S 2mm', 'L4S', '2L2S', '1mm ABS', 'No edge', 'Talk to Ollie', 'L shaped', 'Bought in', '22', 'scribe'].map(lsLooksEdge) }; });
  rec('import / paste: column G "L4S 2mm" → Edging 2, column H → note', JSON.stringify(pg.a[0]) === JSON.stringify(['Gable', 'L1LE 1mm', 'L4S 2mm', 'scribe']), JSON.stringify(pg.a));
  rec('import / paste: column G that is not a code ("Talk to Ollie") stays the note, as before', JSON.stringify(pg.a[1]) === JSON.stringify(['Panel', 'L4S 1mm', '', 'Talk to Ollie']), JSON.stringify(pg.a));
  rec('import / paste: "1mm ABS" in G → Edging 2', JSON.stringify(pg.a[2]) === JSON.stringify(['Filler', '2L2S', '1mm ABS', '']), JSON.stringify(pg.a));
  rec('import: a column headed "Edging 2" → G is Edging 2 whatever it says, H the note', JSON.stringify(pg.b[0]) === JSON.stringify(['Gable', 'L1LE 1mm', 'odd code', 'note here']), JSON.stringify(pg.b));
  rec('import: a Stores row (no sizes) keeps F and G as its note, as before', pg.c[0] && pg.c[0][2] === '' && /L4S 2mm/.test(pg.c[0][3]), JSON.stringify(pg.c));
  rec('lsLooksEdge: codes yes, words / numbers no', JSON.stringify(pg.looks) === JSON.stringify([true, true, true, true, true, true, true, false, false, false, false, false]), JSON.stringify(pg.looks));

  // ---- 3. standard layout from Lists home
  const sl = await p.evaluate(async () => { showTab('l'); LH.proj = 'P1'; render(); document.getElementById('lh-new').click(); await new Promise(r => setTimeout(r, 100));
    const rows = [...document.querySelectorAll('.me-grid tbody tr')].map(r => { const i = r.querySelector('[data-mr$="|item"]'); return (r.classList.contains('me-h') ? (r.classList.contains('me-hs') ? 'SUB:' : 'HDR:') : 'ROW:') + (i ? i.value : ''); });
    return { rows, title: document.querySelector('.me-ed').innerText.slice(0, 200) }; });
  rec('Lists home "＋ New list" (one button, the standard layout — Garry 4 Nov; Blank list under More): heading, then Fillers and Kickers / Worktops / Stores items with 2 empty rows each',
    sl.rows.join(',') === 'HDR:,SUB:Fillers and Kickers,ROW:,ROW:,SUB:Worktops,ROW:,ROW:,SUB:Stores items,ROW:,ROW:', JSON.stringify(sl.rows));
  // pick WO-3 → the house heading follows the work order's unit; the project's colours only
  const sw = await p.evaluate(async () => { const w = document.getElementById('me-wo'); w.value = 'WO-3'; w.onchange(); await new Promise(r => setTimeout(r, 100));
    const h = document.querySelector('[data-mr="0|item"]').value, n = document.getElementById('me-name').value;
    const sel = document.querySelector('[data-mr="2|mat"]'); const opts = [...sel.options].map(o => o.textContent.trim()).filter(Boolean);
    return { h, n, opts }; });
  rec('picking WO-3 (unit 31): house heading "House 31", list name NOT pre-filled (Part 4, Garry 10 Nov — was "31")', sw.h === 'House 31' && sw.n === '', JSON.stringify(sw));
  rec('Colour drop-down: only Aderrig\'s materials + "＋ Add new material…" (not another project\'s)', sw.opts.includes('MFC White') && sw.opts.some(o => /Add new material/.test(o)) && !sw.opts.includes('Oak Other Site'), JSON.stringify(sw.opts));
  if (SHOTS) await p.screenshot({ path: SHOTS + '/std-editor-1400.png' });
  // save it: empty rows dropped; the saw never gets empty headings
  await p.evaluate(async () => { const s = (k, v) => { const e = document.querySelector('[data-mr="' + k + '"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    s('2|item', 'Kicker'); s('2|qty', '2'); s('2|L', '2400'); s('2|W', '150'); const m = document.querySelector('[data-mr="2|mat"]'); m.value = 'MFC White'; m.dispatchEvent(new Event('change', { bubbles: true }));
    s('8|item', 'Sink'); s('8|qty', '1');
    document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 900)); window.__err = (document.getElementById('me-err') || {}).textContent; });
  console.log('INFO editor message after save: ' + await p.evaluate(() => window.__err));
  const nl = S.db.t.lists.find(l => (l.wos || []).includes('WO-3') && !l.is_template);
  const nlines = nl ? S.db.t.list_lines.filter(x => x.list_id === nl.id && x.removed_rev == null).sort((a, b) => a.seq - b.seq).map(x => x.kind + ':' + x.part) : [];
  rec('saved standard list: headings + the two typed rows only (empty rows left out)', nl && nlines.join(',') === 'hdr:House 31,hdr:Fillers and Kickers,saw:Kicker,hdr:Worktops,hdr:Stores items,fit:Sink', JSON.stringify(nlines));
  await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); if (o) o.remove(); });
  // phone width shot of a fresh standard editor
  if (SHOTS) { await p.setViewportSize({ width: 360, height: 800 }); await p.evaluate(async () => { lsNewStd('WO-1'); await new Promise(r => setTimeout(r, 150)); }); await p.screenshot({ path: SHOTS + '/std-editor-360.png' });
    await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); if (o) o.remove(); showTab('b'); }); await p.waitForTimeout(150);
    await p.evaluate(() => { const r = [...document.querySelectorAll('.wo-table tbody tr')].find(r => /WO-1\b/.test(r.textContent)); if (r) r.scrollIntoView({ block: 'center' }); }); await p.screenshot({ path: SHOTS + '/board-row-360.png' });
    await p.setViewportSize({ width: 1400, height: 900 }); }

  // ---- 3b. "Cutting lists to issue": a WO with no template gets the button
  D.insert(S.db, 'list_lines', { id: 'tmp', list_id: 'none', seq: 1, kind: 'saw' }); // (keeps the fake tables busy — harmless)
  const lti = await p.evaluate(async () => { showTab('l'); render(); await new Promise(r => setTimeout(r, 100));
    const rows = [...document.querySelectorAll('[data-ltirow]')].map(r => ({ wo: r.dataset.ltirow, std: !!r.querySelector('[data-ltistd]'), conf: !!r.querySelector('[data-lticonf]'), fl: (r.querySelector('.fu-fl') || {}).textContent, un: (r.querySelector('.fu-un') || {}).textContent }));
    return rows; });
  const r2 = lti.find(r => r.wo === 'WO-2');
  rec('lists to issue: a WO with no template shows "＋ New list – standard layout"; Floor / Unit as separate badges', r2 && r2.std && !r2.conf && r2.fl === 'Floor 0' && r2.un === 'Unit 7', JSON.stringify(lti));
  const op = await p.evaluate(async () => { document.querySelector('[data-ltistd="WO-2"]').click(); await new Promise(r => setTimeout(r, 150));
    return { h: document.querySelector('[data-mr="0|item"]').value, wo: document.getElementById('me-wo').value, pid: document.getElementById('me-pid').value, n: document.querySelectorAll('.me-grid tbody tr').length }; });
  rec('…it opens the editor for WO-2: "House 7", the project picked, 10 rows', op.h === 'House 7' && op.wo === 'WO-2' && op.pid === 'P1' && op.n === 10, JSON.stringify(op));
  await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); if (o) o.remove(); });
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await off.close();
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
