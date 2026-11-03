// Editor step 1: lsParseGrid — the one reader for WPF's cutting-list sheets (Excel import and paste). Pure: runs in node
// on the code cut out of index.html, against the anonymised fixtures built from the real workbooks.
// Run: node tests/editor/e1-parsegrid.test.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const XLSX = require(path.join(ROOT, 'xlsx.full.min.js'));
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = /\/\* lsParseGrid:start \*\/([\s\S]*?)\/\* lsParseGrid:end \*\//.exec(src);
eval(m[1] + ';global.lsParseGrid=lsParseGrid;global.lsSheetAoa=lsSheetAoa;global.lsPasteAoa=lsPasteAoa;global.lsSkipSheet=lsSkipSheet;');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const FX = path.join(ROOT, 'tests', 'fixtures');
if (!fs.existsSync(path.join(FX, 'cutting-list-customer-a.xlsx'))) require(path.join(FX, 'make-fixtures.js'));
const book = f => XLSX.read(fs.readFileSync(path.join(FX, f)), { type: 'buffer', cellDates: true, sheetStubs: true });
const parse = (wb, sn) => { const g = lsSheetAoa(wb.Sheets[sn]); return lsParseGrid(g.v, { formulas: g.f, sheet: sn }); };
const brief = rows => rows.map(r => r.k === 'hdr' ? (r.info ? 'i:' : 'h:') + r.item + (r.units != null ? '×' + r.units : '') : [r.item, r.qty, r.total == null ? '' : '=' + r.total, r.L, r.W, r.mat, r.edging].join('|'));

// ---- the house workbook (Customer A, one sheet per group of houses)
for (const f of ['cutting-list-customer-a.xlsx', 'cutting-list-customer-a-nocache.xlsx']) {
  const wb = book(f), tag = f.includes('nocache') ? ' (no cached values)' : '';
  const used = wb.SheetNames.filter(s => !lsSkipSheet(s));
  rec('skips Blank, Index, Stock and Door Stock' + tag, used.join('|') === 'Road 1 No 1,2,3|Road 2 No 4,5', used.join('|'));
  const p = parse(wb, 'Road 1 No 1,2,3'), b = brief(p.rows);
  rec('header rows read as Project / Date, not as headings' + tag, p.meta.project === 'Customer A' && p.meta.date === '2020-10-03' && !b.some(x => /^h:(Project|Title|Date)/.test(x)), JSON.stringify(p.meta) + ' ' + b.slice(0, 3));
  rec('"#VALUE!" title is ignored' + tag, p.meta.title === '');
  rec('unit headings carry the number of units' + tag, b.filter(x => x.includes('×')).join(',') === 'h:450 Robe fully shelved×2,h:500 Single Rail + 2 shelves×2,h:1000 Double Rail×3', b.filter(x => x.includes('×')).join(','));
  rec('"total nr of units" rows are not lines' + tag, !p.rows.some(r => /total nr/i.test(r.item + r.note)));
  rec('formula quantities give the per-unit quantity and the total' + tag, b[1] === 'Side panel|2|=4|2380|570|W/W|L1LE 1mm' && b[3] === 'Shelves|5|=10|414|525|W/W|L1LE 1mm' && b.includes('Shelves|3|=9|964|570|W/W|L1LE 1mm'), b.slice(0, 5).join(' ; '));
  rec('colours copied down by formula (=E6) are read' + tag, p.rows.filter(r => r.k === 'part').every(r => r.mat));
  rec('per-house extras: headings then plain-number parts (not per unit)' + tag, b.includes('h:Fillers & Kickers') && b.includes('h:Road 1 No 1') && b.includes('Kicker|7||2440|125|W/W|L1LE 1mm') && b.includes('Backs|2||2250|900|WHB|'), b.slice(15).join(' ; '));
  rec('trailing spaces trimmed ("Filler  ")' + tag, b.includes('Filler|2||2440|240|W/W|L1LE 1mm'));
  rec('no warnings on a clean sheet' + tag, !p.warn.length, p.warn.join(' | '));
  rec('number of rows: 3 unit headings + 12 unit parts + 3 headings + 10 extras' + tag, p.rows.length === 28, p.rows.length);
}
// cached and uncached read the same
{ const a = brief(parse(book('cutting-list-customer-a.xlsx'), 'Road 1 No 1,2,3').rows), b = brief(parse(book('cutting-list-customer-a-nocache.xlsx'), 'Road 1 No 1,2,3').rows);
  rec('a workbook saved without cached values reads exactly the same', JSON.stringify(a) === JSON.stringify(b)); }

// ---- the school sheet (one sheet per unit type, carcass / door colour, room breakdown)
for (const f of ['cutting-list-school.xlsx', 'cutting-list-school-nocache.xlsx']) {
  const wb = book(f), tag = f.includes('nocache') ? ' (no cached values)' : '';
  rec('school: the INDEX sheet is skipped' + tag, wb.SheetNames.filter(s => !lsSkipSheet(s)).join('|') === '1200 Wall Units');
  const p = parse(wb, '1200 Wall Units'), b = brief(p.rows);
  rec('school: carcass and door colour read from the header' + tag, p.meta.carcass === 'UD96' && p.meta.door === 'BERMUDA', JSON.stringify(p.meta));
  rec('school: "Nr of units 59" makes one unit block named after the sheet' + tag, b[0] === 'h:1200 Wall Units×59', b[0]);
  rec('school: the "Description | Nr | Dimension…" header row is skipped' + tag, !b.some(x => /Description/.test(x)));
  rec('school: =2*B6 → 2 per unit, 118 in total' + tag, b[1] === 'Side panel|2|=118|600|380|UD96|L2S1LE' && b.includes('Doors|2|=118|600|595|BERMUDA|L4S 2mm') && b.includes('Backs|1|=59|1164|563|UD96|No edge'), b.slice(1, 7).join(' ; '));
  rec('school: the room breakdown is marked "not a part" (info), never a Stores line' + tag, b.slice(-3).join(',') === 'i:Science Lab 1,i:Library FF11,i:Staff Room' && p.rows.filter(r => r.k === 'part').length === 6, b.slice(-3).join(','));
}

// ---- paste (text from Excel: no formulas) and odd cases
{
  const wb = book('cutting-list-customer-a.xlsx'), ws = wb.Sheets['Road 1 No 1,2,3'];
  const tsv = XLSX.utils.sheet_to_csv(ws, { FS: '\t', blankrows: false }).split('\n').slice(3).join('\n'); // from the first unit heading
  const p = lsParseGrid(lsPasteAoa(tsv), { paste: true }), b = brief(p.rows);
  rec('paste: unit blocks found and per-unit = total ÷ units', b[0] === 'h:450 Robe fully shelved×2' && b[1] === 'Side panel|2|=4|2380|570|W/W|L1LE 1mm' && b.includes('Shelves|3|=9|964|570|W/W|L1LE 1mm'), b.slice(0, 3).join(' ; '));
  const q = lsParseGrid(lsPasteAoa('Description\tQty\tLength\tWidth\tColour\tEdging\nGable\t2\t2380\t600\tW/W\tL4S 1mm\nHinge\t8\nTop shelf\t\t900\t560\tW/W\n'), { paste: true });
  rec('paste: header row skipped; a row with no size is a Stores part; size with no qty kept as a part', brief(q.rows).join(';') === 'Gable|2||2380|600|W/W|L4S 1mm;Hinge|8|||||;Top shelf|||900|560|W/W|', brief(q.rows).join(';'));
  const r = lsParseGrid([['Cabinet'], [null, 2, 'total nr of units'], ['Side', 3, 700, 560, 'W/W']], { paste: true });
  rec('a total that is not a whole number per unit is kept and warned about', r.rows[1].qty === 1.5 && r.rows[1].total === 3 && /isn't a whole number/.test(r.warn[0] || ''), JSON.stringify(r));
  const s = lsParseGrid([['Kitchen 1'], ['Side', '2x2', 700, 560, 'W/W']], { paste: true });
  rec('"2x2" is kept as typed, never guessed', s.rows[1].qty === '2x2');
  const h = lsParseGrid([['Hinge', 8, null, null, 'Blum', 'soft close', 'top drawer']], { paste: true });
  rec('decision 4: on a Stores part column F is a note, not edging', h.rows[0].edging === '' && h.rows[0].note === 'soft close · top drawer', JSON.stringify(h.rows));
  const t = lsParseGrid([['Aderrig', null, null, null, null, new Date(Date.UTC(2026, 9, 1))], ['Side', 2, 720, 560, 'MFC White', '1mm']]);
  rec('the old layout (project name alone in A1) still gives the project', t.meta.project === 'Aderrig' && t.meta.date === '2026-10-01' && brief(t.rows).join(';') === 'Side|2||720|560|MFC White|1mm', JSON.stringify(t));
  const u = lsParseGrid([['Aderrig'], ['Side', 2, 720, 560, 'MFC White']], { paste: true });
  rec('paste: a text-only first row is a heading, not a project', u.meta.project === '' && brief(u.rows)[0] === 'h:Aderrig');
  const v = lsParseGrid([['Side', '#VALUE!', 700, 560, '#REF!']], { paste: true });
  rec('error values (#VALUE!, #REF!) are treated as blank', v.rows.length === 1 && v.rows[0].qty === '' && v.rows[0].mat === '', JSON.stringify(v.rows));
  const w = lsParseGrid([['Project', 'X'], ['Unit A'], [null, 3, 'total nr of units'], ['Side', null, 700, 560, 'W/W'], ['Unit B'], ['Gable', 2, 2380, 600, 'W/W']], { formulas: [[], [], [], [null, '$B$3*2']] });
  rec('no cached value and a formula → per-unit from the formula, total = units × per-unit; a new heading ends the block', w.rows[0].units === 3 && w.rows[1].qty === 2 && w.rows[1].total === 6 && w.rows[3].qty === 2 && w.rows[3].total == null, JSON.stringify(w.rows));
  rec('lsPasteAoa: Excel quotes and CRLF', JSON.stringify(lsPasteAoa('"a ""b"""\t2\r\nc\t\r\n')) === JSON.stringify([['a "b"', '2'], ['c', null]]));
}
const pass = res.filter(Boolean).length;
console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
process.exit(res.length - pass ? 1 : 0);
