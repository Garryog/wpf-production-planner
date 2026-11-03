// Tester attack 1 on the list editor's reader (lsParseGrid / lsPasteAoa / lsEdLines) — pure, no browser.
// Odd pastes from Excel (quoted cells with a line break, merged-looking blanks, totals rows, header variants, 500 rows),
// formulas pointing at other sheets with no saved value, and quantities summed over heading lines.
// Run: node tests/editor/attack1-parse.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = /\/\* lsParseGrid:start \*\/([\s\S]*?)\/\* lsParseGrid:end \*\//.exec(src);
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 500))); };
if (!m) { rec('lsParseGrid block found', false); process.exit(1); }
const { lsParseGrid, lsPasteAoa, lsEdLines } = new Function(m[1] + '\nreturn {lsParseGrid, lsPasteAoa, lsEdLines};')();
const parts = p => p.rows.filter(r => r.k === 'part');
const J = x => JSON.stringify(x);

// ---- 1. a cell with a line break inside (Excel copies it as "Side panel\n(left)" in quotes)
let t = 'Description\tQty\tLength\tWidth\tColour\n"Side panel\n(left hand)"\t2\t720\t560\tMFC White\nTop\t1\t1200\t560\tMFC White\n';
let p = lsParseGrid(lsPasteAoa(t), { paste: true });
rec('paste: a quoted cell with a line break stays ONE part ("Side panel (left hand)" ×2), no stray heading', parts(p).length === 2 && !p.rows.some(r => r.k === 'hdr') && /Side panel/.test(parts(p)[0].item) && parts(p)[0].qty === 2, J(p.rows.map(r => [r.k, r.item, r.qty])));

// ---- 2. a quoted cell containing a tab
t = 'Shelf "A"\t2\t864\t570\tMFC White\n"Note:\tsee drawing"\t1\t500\t300\tMFC White\n';
p = lsParseGrid(lsPasteAoa(t), { paste: true });
rec('paste: a quoted cell with a tab inside does not shift the columns (qty 1, 500 × 300)', parts(p).length === 2 && parts(p)[1].qty === 1 && parts(p)[1].L === 500 && parts(p)[1].W === 300, J(parts(p)));
rec('paste: inch-mark quotes inside a description are kept (Shelf "A")', parts(p)[0].item === 'Shelf "A"', J(parts(p)[0]));

// ---- 3. merged-looking blanks: description only on the first of three rows (Excel merged cells)
t = 'Side panel\t2\t720\t560\tMFC White\n\t2\t720\t540\tMFC White\n\t2\t720\t520\tMFC White\n';
p = lsParseGrid(lsPasteAoa(t), { paste: true });
rec('paste: rows under a merged description are still parts (3 saw parts)', parts(p).length === 3 && parts(p).every(r => r.L === 720), J(p.rows));
rec('…and the blank-description rows are not given the colour as their name', parts(p).slice(1).every(r => r.item !== 'MFC White'), J(parts(p).map(r => r.item)));

// ---- 4. totals row at the bottom of a sheet
const aoa = [['Description', 'Qty', 'Length', 'Width', 'Colour'], ['Side', 2, 720, 560, 'MFC White'], ['Top', 1, 1200, 560, 'MFC White'], [null, null, null, null, null], ['Total', 3, null, null, null]];
p = lsParseGrid(aoa, { sheet: 'House 1' });
rec('a "Total 3" row at the bottom is not a Stores part', !parts(p).some(r => /^total/i.test(r.item)), J(p.rows.map(r => [r.k, r.item, r.qty])));
p = lsParseGrid([['Side', 2, 720, 560, 'MFC White'], ['TOTAL PARTS:', 3, null, null, null]], { paste: true });
rec('"TOTAL PARTS:" pasted is not a Stores part', !parts(p).some(r => /total/i.test(r.item)), J(p.rows));

// ---- 5. header variants
p = lsParseGrid([['Description:', 'Qty', 'Length', 'Width', 'Colour'], ['Side', 2, 720, 560, 'W/W']], { paste: true });
rec('header "Description:" (with a colon) is skipped, not a heading on the saw', !p.rows.some(r => r.k === 'hdr'), J(p.rows));
p = lsParseGrid([[' DESCRIPTION ', ' QTY ', ' LENGTH ', ' WIDTH ', ' COLOUR '], ['Side', 2, 720, 560, 'W/W']], { paste: true });
rec('header in capitals with spaces is skipped', !p.rows.some(r => r.k === 'hdr'), J(p.rows));
p = lsParseGrid([['Item Description', 'Qty', 'Length', 'Width', 'Colour'], ['Side', 2, 720, 560, 'W/W']], { paste: true });
rec('header "Item Description | Qty | …" is skipped', !p.rows.some(r => r.k === 'hdr'), J(p.rows));

// ---- 6. odd quantities
p = lsParseGrid([['Side', '2 off', 720, 560, 'W/W'], ['Back', '1,000', 720, 560, 'W/W'], ['Top', -1, 720, 560, 'W/W'], ['Gable', 0, 720, 560, 'W/W'], ['Plinth', '2x2', 2400, 150, 'W/W']], { paste: true });
const q = parts(p).map(r => r.item + ':' + r.qty);
rec('"2 off" → 2; "2x2" kept as typed', q.includes('Side:2') && q.includes('Plinth:2x2'), J(q));
rec('"1,000" is not silently read as 1', !q.includes('Back:1'), J(q));
rec('a negative quantity (-1) is not taken as a part to cut without a warning', !q.includes('Top:-1') || p.warn.some(w => /Top/.test(w)), J({ q, w: p.warn }));

// ---- 7. a formula pointing at ANOTHER sheet with no saved value (Blank!B5*2)
const v = [['900 Single Rail', null, null, null, null], ['3 - total nr of units', null], ['Side panel', null, 2380, 570, 'W/W'], ['Shelves', null, 864, 570, 'W/W']];
const f = [[], [], [null, 'Blank!B5*2'], [null, "'Door Stock'!$B$5*3"]];
p = lsParseGrid(v, { formulas: f, sheet: 'Road 1' });
rec('formula to another sheet with no saved value: not read as a number from THIS sheet\'s cell', parts(p).every(r => r.qty === '' || r.qty == null || isNaN(+r.qty) || r.qty === 0 ? true : false) || parts(p).some(r => r.qty === '') , J(parts(p)));
rec('…and the person is warned that the quantity could not be read', p.warn.length >= 2 || parts(p).every(r => r.qty !== ''), J({ parts: parts(p).map(r => [r.item, r.qty, r.total]), warn: p.warn }));
// a same-sheet formula with a function: =ROUND($B$2*2,0), no saved value
p = lsParseGrid([['Unit A'], ['2 - total nr of units', null], ['Side', null, 720, 560, 'W/W']], { formulas: [[], [], [null, 'ROUND($B$2*2,0)']] });
rec('=ROUND(…) with no saved value: blank quantity is warned about, not silently saved blank', p.warn.length > 0 || parts(p)[0].qty !== '', J({ parts: parts(p), warn: p.warn }));

// ---- 8. 500 pasted rows: quick, all parts, quantities right
let big = 'Description\tQty\tLength\tWidth\tColour\tEdging\n';
for (let i = 0; i < 500; i++) big += (i % 50 === 0 ? 'Heading ' + i + '\n' : '') + 'Part ' + i + '\t' + (i % 7 + 1) + '\t' + (300 + i) + '\t' + (200 + i % 100) + '\tMFC White\tL1LE 1mm\n';
const t0 = Date.now(); p = lsParseGrid(lsPasteAoa(big), { paste: true }); const ms = Date.now() - t0;
const sumQ = parts(p).reduce((s, r) => s + (+r.qty || 0), 0); let exp = 0; for (let i = 0; i < 500; i++) exp += i % 7 + 1;
rec('500 rows + 10 headings: 500 parts, 10 headings, total qty as typed, under 300 ms', parts(p).length === 500 && p.rows.filter(r => r.k === 'hdr').length === 10 && sumQ === exp && ms < 300, J({ n: parts(p).length, sumQ, exp, ms }));

// ---- 9. lsEdLines: quantities never summed over headings; a unit heading's qty is units, not a part
const lines = lsEdLines([{ k: 'hdr', item: '900 Single Rail', units: '3' }, { k: 'part', item: 'Side', qty: '2', L: 720, W: 560, mat: 'W/W' }, { k: 'hdr', item: 'Extras' }, { k: 'part', item: 'Kicker', qty: '7', L: 2440, W: 125, mat: 'W/W' }]);
rec('lsEdLines: Side = 6 to cut (2 × 3), Kicker 7 under a plain heading is NOT multiplied', lines[1].qty === '6' && lines[3].qty === '7' && lines[3].unit_qty === '', J(lines.map(x => [x.kind, x.part, x.qty, x.unit_qty])));
const l2 = lsEdLines([{ k: 'hdr', item: 'Unit', units: '2' }, { k: 'part', item: 'Side', qty: '1.5', L: 720, W: 560, mat: 'W/W' }]);
rec('per-unit 1.5 × 2 units = 3 (no float noise)', l2[1].qty === '3', l2[1].qty);
const l3 = lsEdLines([{ k: 'hdr', item: 'Unit', units: '3' }, { k: 'part', item: 'Side', qty: '0.1', L: 720, W: 560, mat: 'W/W' }]);
rec('per-unit 0.1 × 3 = 0.3 (not 0.30000000000000004)', l3[1].qty === '0.3', l3[1].qty);

console.log(fail + ' failed of ' + (pass + fail));
process.exit(fail ? 1 : 0);
