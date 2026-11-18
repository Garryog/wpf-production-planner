// Tester attack ROUND 3 (list window, 13 Nov): Start from… → An Excel file — the ONE question when the file names another
// WO / Floor / Unit than the window's job; Cancel must change nothing; the list name is never filled from the sheet name.
// Only a WO, only Floor / Unit, trailing spaces, number vs text. Fake Supabase only.
// Run: node tests/list-window/attack3-excel.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const BODY = [COLS, ['Side', 2, 720, 560, 'MFC White'], ['Shelf', 3, 500, 300, 'MFC White']];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const file = (meta, name) => xlsx({ [name || 'House 14 sheet']: [...meta, [], ...BODY] });

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r0 = X.v2Row(); r0.orders.push(H.order({ wo: '26114', customer: 'Aderrig Homes', floor: 'T10', unit: '2', title: 'HOUSE 2', dueDate: '2026-12-03', origDueDate: '2026-12-03' }));
    const S = X.makeServer(r0);
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    const feed = async buf => { await p.evaluate(() => { window.__asked = []; }); await p.setInputFiles('#me-xlfile', { name: 'x.xlsx', mimeType: 'application/octet-stream', buffer: buf }); await sleep(1300); };
    const open = async (wo, id, pid) => { await closeAll(p); await p.evaluate(({ wo, id, pid }) => { window.__asked = []; window.__confirm = true; openListEditor(id || null, wo, pid); }, { wo, id, pid }); await sleep(1100); };
    const q = p => p.evaluate(() => window.__asked.filter(m => /This Excel file says/.test(m)));
    const state = p => p.evaluate(() => ({ name: (document.getElementById('me-name') || {}).value, hwo: (document.getElementById('me-hwo') || {}).textContent, carc: (document.getElementById('me-carc') || {}).value, door: (document.getElementById('me-door') || {}).value, err: (document.getElementById('me-err') || {}).textContent, start: (document.getElementById('me-start') || {}).open, units: (document.getElementById('me-units') || {}).checked }));
    const OTHER = [['Project', 'Aderrig'], ['WO', 'WO-5'], ['Floor', 'T09'], ['Unit', '14']];

    // ---------- Cancel = nothing changes ----------
    await open('WO-3'); const s0 = await state(p), r0s = JSON.stringify(await rows(p));
    await p.evaluate(() => { window.__confirm = false; }); await feed(file(OTHER));
    let a = await q(p), s1 = await state(p);
    rec('E1: file says WO-5 · T09 · 14, window is WO-3 · T09 · 13 → asked ONCE, and the question names both', a.length === 1 && /WO-5/.test(a[0]) && /Unit 14/.test(a[0]) && /WO-3/.test(a[0]) && /Unit 13/.test(a[0]), JSON.stringify(a).slice(0, 300));
    rec('E1: Cancel → rows, list name, WO, carcass / door material all exactly as before', JSON.stringify(await rows(p)) === r0s && JSON.stringify({ ...s1, start: 0, err: '' }) === JSON.stringify({ ...s0, start: 0, err: '' }), JSON.stringify([s0, s1, (await rows(p)).length]));
    await p.evaluate(() => { window.__asked = []; }); await click(p, 'me-x0'); await sleep(300);
    rec('E1: …and ✕ Close then asks nothing (Cancel left nothing behind to lose)', !(await ed(p)) && !(await p.evaluate(() => window.__asked.length)), JSON.stringify(await p.evaluate(() => window.__asked)));
    // Cancel with rows already typed
    await open('WO-3'); await fillSaw(p, 0, 'Typed by hand', '1', '100', '50', 'MFC White'); const r1 = JSON.stringify(await rows(p));
    await p.evaluate(() => { window.__confirm = false; }); await feed(file(OTHER));
    rec('E2: rows typed first, other-house file, Cancel → the typed row is untouched, nothing added', JSON.stringify(await rows(p)) === r1 && (await q(p)).length === 1, JSON.stringify(await rows(p)).slice(0, 200));
    // the same file again → asked again (never remembered as "yes")
    await feed(file(OTHER));
    rec('E2: the same file picked again → asked again (a Cancel is not remembered as OK)', (await q(p)).length === 1 && JSON.stringify(await rows(p)) === r1);
    // OK → rows in under the typed ones, job stays, name blank
    await p.evaluate(() => { window.__confirm = true; }); await feed(file(OTHER));
    let rs = await rows(p), s = await state(p);
    rec('E3: OK → the 2 rows go in UNDER the typed row; the window stays on WO-3; list name still blank (not "House 14 sheet")', rs.length === 3 && rs[0].item === 'Typed by hand' && rs[1].item === 'Side' && s.hwo === 'WO-3' && s.name === '', JSON.stringify([rs.map(r => r.item), s]));
    await save(p, 2200); let d = await donep(p);
    const l3 = liveFor(S, 'WO-3')[0];
    rec('E3: Save → ONE list, on WO-3 only (nothing on WO-5), named after the WO — never after the sheet', !!d && liveFor(S, 'WO-3').length === 1 && liveFor(S, 'WO-5').length === 0 && l3.name === 'WO-3', JSON.stringify([d && d.h, l3 && l3.name, await err(p)]));

    // ---------- a SAVED list + a file for another house, Cancel ----------
    const before = snap(S, l3.id);
    await open('', l3.id); await p.evaluate(() => { window.__confirm = false; }); await feed(file(OTHER));
    rec('E4: saved list open, other-house file, Cancel → asked once, rows unchanged', (await q(p)).length === 1 && (await rows(p)).length === 3);
    await p.evaluate(() => { window.__asked = []; }); await click(p, 'me-x0'); await sleep(300);
    rec('E4: …✕ asks nothing and the saved list in the database is byte-for-byte the same', !(await ed(p)) && !(await p.evaluate(() => window.__asked.length)) && snap(S, l3.id) === before);

    // ---------- what counts as "another job" ----------
    const ask = async (label, meta, want, sev, wo) => { await open(wo || 'WO-4'); await p.evaluate(() => { window.__confirm = false; }); await feed(file(meta)); const n = (await q(p)).length, rr = await rows(p);
      rec((sev ? sev + ' ' : '') + 'E5: window ' + (wo || 'WO-4 (T09 · 13)') + ', file with ' + label + ' → ' + (want ? 'ASKED once; Cancel adds nothing' : 'NOT asked; the rows go in'), want ? n === 1 && rr.length === 1 && !rr[0].item : n === 0 && rr.length === 2, JSON.stringify([n, rr.map(r => r.item), await err(p)])); };
    await ask('only WO = WO-4', [['WO', 'WO-4']], false);
    await ask('only WO = "wo-4 " (case, trailing space)', [['WO', 'wo-4 ']], false);
    await ask('only WO = " WO-4" with the label "WO " (trailing space on the heading)', [['WO ', ' WO-4']], false);
    await ask('only WO = WO-3 (the kitchen WO of the same house)', [['WO', 'WO-3']], true);
    await ask('only WO = WO-999 (not in the planner)', [['WO', 'WO-999']], true);
    await ask('only Floor T09 / Unit 13', [['Floor', 'T09'], ['Unit', '13']], false);
    await ask('only Floor "T09 " / Unit " 13 " (trailing spaces)', [['Floor', 'T09 '], ['Unit', ' 13 ']], false);
    await ask('only Floor T09 / Unit 13 as a NUMBER cell', [['Floor', 'T09'], ['Unit', 13]], false);
    await ask('only Floor "t09" / Unit "13" (lower case)', [['Floor', 't09'], ['Unit', '13']], false);
    await ask('only Floor T09 / Unit 14', [['Floor', 'T09'], ['Unit', '14']], true);
    await ask('only Floor T10 / Unit 13', [['Floor', 'T10'], ['Unit', '13']], true);
    await ask('only Unit 14 (no floor)', [['Unit', '14']], true, '(info)');
    await ask('only Floor T10 (no unit)', [['Floor', 'T10']], true, '(info)');
    await ask('WO = WO-4 but Floor T09 / Unit 14 (the cells disagree with each other)', [['WO', 'WO-4'], ['Floor', 'T09'], ['Unit', '14']], true);
    await ask('no WO / Floor / Unit cells at all', [['Project', 'Aderrig']], false);
    await open('WO-4'); await p.evaluate(() => { window.__confirm = false; }); await feed(file([['WO', ''], ['Floor', '  '], ['Unit', '']]));
    rec('E5: file whose WO / Floor / Unit cells are left BLANK → not asked (a blank cell is no disagreement)', (await q(p)).length === 0, JSON.stringify(await q(p)));
    rec('[LOW] E5b: …and the empty "Floor" / "Unit" label cells do not come in as junk heading rows called "Floor" and "Unit"', JSON.stringify((await rows(p)).map(r => r.item)) === '["Side","Shelf"]', JSON.stringify((await rows(p)).map(r => r.item)));
    // number vs text WO
    await ask('WO as the NUMBER 26114', [['WO', 26114]], false, '', '26114');
    await ask('WO as the text "26114 "', [['WO', '26114 ']], false, '', '26114');
    await ask('WO as the NUMBER 26115', [['WO', 26115]], true, '', '26114');
    await ask('WO "WO-26114" where the planner calls it 26114', [['WO', 'WO-26114']], false, '(info)', '26114');

    // ---------- a new list with NO job yet: the file fills the boxes, the name stays blank ----------
    await open('', null, 'P1'); await p.evaluate(() => { window.__confirm = true; }); await feed(file([['WO', 'WO-4'], ['Floor', 'T09'], ['Unit', '13']], 'Type C utility'));
    s = await state(p); rs = await rows(p);
    rec('E6: new list with no job, file names WO-4 → no question, the window takes WO-4, rows in, list name blank (not "Type C utility")', (await q(p)).length === 0 && s.hwo === 'WO-4' && rs.length === 2 && s.name === '', JSON.stringify([s, rs.length, await p.evaluate(() => window.__asked)]));
    await open('', null, 'P1'); await feed(file([['WO', 'WO-5'], ['Floor', 'T09'], ['Unit', '14']], 'Shipped house'));
    s = await state(p); const jm = await p.evaluate(() => ((document.getElementById('me-jbm') || {}).innerText || '') + ((document.getElementById('me-jbok') || {}).innerText || ''));
    rec('E7: new list, file names WO-5 which is SHIPPED → not taken as the job; said plainly; rows still in; name blank', s.hwo !== 'WO-5' && /shipped|delivered/i.test(jm) && (await rows(p)).length === 2 && s.name === '', JSON.stringify([s.hwo, jm.slice(0, 120)]));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
