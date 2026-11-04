// Builds the cutting-list workbooks the editor/import tests use, modelled on WPF's real sheets (SharePoint "Jobs Ready
// for Production", read 3 Nov 2026) — same layout, formulas and cached values, ANONYMISED (customer → "Customer A",
// road names → "Road 1/2"). Run: node tests/fixtures/make-fixtures.js  (writes the .xlsx files next to this script)
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const OUT = __dirname;

// a cell: plain value, or {f:'formula', v:cached} (v undefined = no cached value)
function sheet(rows, noCache) {
  const ws = {}; let maxC = 0;
  rows.forEach((row, r) => (row || []).forEach((x, c) => {
    if (x == null) return;
    const a = XLSX.utils.encode_cell({ r, c }); maxC = Math.max(maxC, c);
    if (typeof x === 'object' && !(x instanceof Date) && 'f' in x) {
      const cell = { f: x.f };
      if (x.err) { cell.t = 'e'; cell.v = 0x0F; cell.w = '#VALUE!'; }
      else if (!noCache && x.v !== undefined) { cell.v = x.v; cell.t = typeof x.v === 'number' ? 'n' : x.v instanceof Date ? 'd' : 's'; }
      else { cell.t = typeof x.v === 'string' ? 's' : 'n'; }
      if (noCache && !x.err) delete cell.v;
      ws[a] = cell;
    } else if (x instanceof Date) ws[a] = { t: 'd', v: x };
    else ws[a] = { t: typeof x === 'number' ? 'n' : 's', v: x };
  }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: Math.max(5, maxC) } });
  return ws;
}
const TITLE = { f: 'MID(CELL("filename",A1),FIND("]",CELL("filename",A1))+1,255)', err: true };
// one unit block: heading, "N | total nr of units", parts [desc, perUnit, L, W, colour, edging]; formulas =$B$<n>*k
function block(rows, name, n, parts) {
  rows.push([name]);
  rows.push([null, n, 'total nr of units']);
  const ur = rows.length; // 1-based row of the units cell
  parts.forEach((p, i) => {
    const colour = i === 0 ? p[4] : { f: 'E' + (rows.length), v: p[4] }; // colour copied down (=E6)
    rows.push([p[0], { f: '$B$' + ur + '*' + p[1], v: n * p[1] }, p[2], p[3], colour, p[5]]);
  });
}
function houseSheet(project, houses) {
  const rows = [['Project', project], ['Title', TITLE], ['Date', new Date(Date.UTC(2020, 9, 3))]];
  block(rows, '450 Robe fully shelved', 2, [['Side panel', 2, 2380, 570, 'W/W', 'L1LE 1mm'], ['Shelves', 3, 414, 570, 'W/W', 'L1LE 1mm'], ['Shelves', 5, 414, 525, 'W/W', 'L1LE 1mm'], ['Batten', 1, 414, 70, 'W/W', 'L1LE 1mm']]);
  block(rows, '500 Single Rail + 2 shelves', 2, [['Side Panel', 2, 2380, 570, 'W/W', 'L1LE 1mm'], ['Shelves', 3, 464, 570, 'W/W', 'L1LE 1mm'], ['Shelves', 1, 464, 525, 'W/W', 'L1LE 1mm'], ['Shelves', 1, 464, 350, 'W/W', 'L1LE 1mm'], ['Batten', 1, 464, 70, 'W/W', 'L1LE 1mm']]);
  block(rows, '1000 Double Rail', 3, [['Side Panel', 2, 2380, 570, 'W/W', 'L1LE 1mm'], ['Shelves', 3, 964, 570, 'W/W', 'L1LE 1mm'], ['Batten', 1, 964, 70, 'W/W', 'L1LE 1mm']]);
  rows.push(['Fillers & Kickers']);
  houses.forEach(h => { rows.push([h.name]); h.parts.forEach(p => rows.push(p)); });
  return rows;
}
const R1 = [{ name: 'Road 1 No 1', parts: [['Kicker', 7, 2440, 125, 'W/W', 'L1LE 1mm'], ['Filler  ', 2, 2440, 240, 'W/W', 'L1LE 1mm'], ['Gable', 2, 2380, 600, 'W/W', 'L4S 1mm'], ['Backs', 2, 2250, 900, 'WHB', null], ['Backs', 1, 2250, 450, 'WHB', null], ['Top Cornice', 3, 2250, 140, 'W/W Vinyl', 'L1LE 1mm']] },
  { name: 'Road 1 No 3', parts: [['Kicker', 5, 2440, 125, 'W/W', 'L1LE 1mm'], ['Gable', 1, 2380, 600, 'W/W', 'L4S 1mm'], ['Backs', 2, 2250, 1000, 'WHB', null], ['Top Cornice', 2, 2250, 140, 'W/W Vinyl', 'L1LE 1mm']] }];
const R2 = [{ name: 'Road 2 No 4', parts: [['Kicker', 4, 2440, 125, 'W/W', 'L1LE 1mm'], ['Gable', 2, 2380, 600, 'W/W', 'L4S 1mm']] }];
function blankSheet() { // the customer's unit library: every unit with N = 1
  const rows = [['Project', 'Customer A'], ['Title', TITLE], ['Date', new Date(Date.UTC(2020, 9, 3))]];
  block(rows, '450 Robe fully shelved', 1, [['Side panel', 2, 2380, 570, 'W/W', 'L1LE 1mm'], ['Shelves', 3, 414, 570, 'W/W', 'L1LE 1mm']]);
  block(rows, '900 Single Rail + 2 shelves', 1, [['Side Panel', 2, 2380, 570, 'W/W', 'L1LE 1mm'], ['Shelves', 3, 864, 570, 'W/W', 'L1LE 1mm']]);
  return rows;
}
const INDEX = [['Site', 'Road', 'House', 'House', 'House'], ['Site A', 'Road 1', 1, 2, 3], ['Site A', 'Road 2', 4, 5, null]];
const STOCK = [['Board', 'Qty', 'Length', 'Width', 'Colour'], ['W/W 18mm', 40, 2440, 1220, 'W/W'], ['WHB 3mm', 25, 2440, 1220, 'WHB']];
const DSTOCK = [['Door', 'Qty', 'Height', 'Width', 'Colour'], ['Slab door', 12, 715, 497, 'W/W']];

function house(noCache) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(INDEX), 'Index');
  XLSX.utils.book_append_sheet(wb, sheet(blankSheet(), noCache), 'Blank');
  XLSX.utils.book_append_sheet(wb, sheet(houseSheet('Customer A', R1), noCache), 'Road 1 No 1,2,3');
  XLSX.utils.book_append_sheet(wb, sheet(houseSheet('Customer A', R2), noCache), 'Road 2 No 4,5');
  XLSX.utils.book_append_sheet(wb, sheet(STOCK), 'Stock');
  XLSX.utils.book_append_sheet(wb, sheet(DSTOCK), 'Door Stock');
  return wb;
}
function school(noCache) {
  const N = 59, rows = [['Project', null, { f: 'INDEX!A1', v: 'Customer A School' }], ['Title', null, TITLE], ['Date', null, { f: 'TODAY()', v: new Date(Date.UTC(2026, 10, 3)) }],
    ['Carcass colour', null, 'UD96'], ['Door colour', null, 'BERMUDA'], ['Nr of units', N], ['Description', 'Nr', 'Dimension', 'Dimension', 'Colour', 'Finish']];
  const part = (d, k, L, W, cf, cv, e) => { rows.push([d, { f: k + '*B6', v: k * N }, L, W, { f: cf, v: cv }, e]); rows.push([]); };
  part('Side panel', 2, 600, 380, 'C4', 'UD96', 'L2S1LE'); part('Shelves', 2, 1164, 380, '$C$4', 'UD96', 'L1LE');
  part('Upright', 1, 564, 60, 'C4', 'UD96', 'L1LE'); part('Loose shelf', 1, 1164, 270, 'C4', 'UD96', 'L1LE');
  part('Doors', 2, 600, 595, 'C5', 'BERMUDA', 'L4S 2mm'); part('Backs', 1, 1164, 563, 'C4', 'UD96', 'No edge');
  rows.push(['Science Lab 1', null, null, 6]); rows.push(['Library FF11', null, null, 6]); rows.push(['Staff Room ', null, null, 4]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet([['Customer A School']]), 'INDEX');
  XLSX.utils.book_append_sheet(wb, sheet(rows, noCache), '1200 Wall Units');
  return wb;
}
// (4 Nov) Standard production: modelled on "Aspect Cutting List.xlsx" / "O'Malleys - Cutting List.xlsx" (SharePoint, read
// 4 Nov 2026 — docs/CUTTING-LIST-FORMAT-REVIEW.md addendum), ANONYMISED (customer → "Customer B"). One sheet, several houses:
// a "House nr …" heading, sub-headings (Fillers and Kickers, ISLAND, Utility, Doors FU), 10–25 lines each of fillers /
// gables / kickers / worktops, stores items with the item named in column E, a bought-in panel with sizes, spec "TBC"
// placeholders, notes in column G, and door rows with no description under "Doors FU". No unit blocks.
function standardSheet() {
  const G = '18mm Grey Bordelino', rows = [['Project', "Customer B – Phase 2", null, null, 'Date', new Date(Date.UTC(2026, 9, 12))],
    ['Description', 'Qty', 'Length', 'Width', 'Colour', 'Edging', 'Note'],
    ['House nr 103'],
    ['Fillers and Kickers'],
    ['Kicker', 3, 2400, 150, G, 'L1LE 1mm'], ['Fillers', 2, 720, 100, G, 'L1L+2SE 1mm'], ['Gable', 1, 870, 625, G, 'L4S 1mm'],
    ['Tall Gable', 1, 2200, 600, G, 'L2LE 1mm Blue'], ['Head filler', 1, 1200, 60, G, 'L1LE 1mm'],
    ['Top', 1, 1000, 600, 'Frosty Matt 25mm', 'No Cap'], ['Top', 1, 3000, 600, 'Frosty Matt 25mm', 'No Cap'],
    ['Kicker vent', 2, null, null, 'Chrome'], ['Sink', 1, null, null, 'Hafele Calder', null, 'Talk to Ollie'], ['Tap', 1, null, null, 'TBC'],
    ['Extractor', 1, null, null, 'Hafele 600 Black'], ['Gola rail', 3, null, null, 'J Type'], ['Gola clips', 12],
    ['Panel Back', 1, 900, 1842, 'Nautic Blue', 'Bought in'],
    ['ISLAND'],
    ['Island Gables', 2, 870, 900, '36mm Grey Bordelino', 'L4S 2mm R'], ['Island Back', 1, 2400, 870, G, 'L2LE 1mm'],
    ['Worktops', null, null, null, 'None Chosen / TBC / Corian'],
    ['Utility 103'],
    ['Heat Pump Frame', 1, 1800, 600, '18mm MDF', 'No edge'], ['Batten', 4, 600, 70, 'Raw MDF'],
    ['Sink + Tap — TBC'],
    ['Doors FU'],
    [null, 4, 715, 497, 'Nautic Blue', 'L4S 1mm', 'Cut down bought in doors at 345'], [null, 2, 715, 297, 'Nautic Blue', 'L4S 1mm'],
    [],
    ['House nr 104'],
    ['Worktops, Fillers and Kickers'],
    ['Kicker', 3, 2400, 150, G, 'L1LE 1mm'], ['Gable', 1, 870, 628, G, 'L4S 1mm'], ['Top', 1, 2400, 600, 'Frosty Matt 25mm', 'No Cap'],
    ['Sink', 1, null, null, 'Hafele Calder', null, 'RH sink'], ['Robe handles', 6, null, null, 'Brushed steel']];
  return rows;
}
function standard() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet([['Site', 'House'], ['Phase 2', 103], ['Phase 2', 104]]), 'Index');
  XLSX.utils.book_append_sheet(wb, sheet(standardSheet()), 'House 103,104');
  return wb;
}
const files = { 'cutting-list-customer-b-standard.xlsx': standard(), 'cutting-list-customer-a.xlsx': house(false), 'cutting-list-customer-a-nocache.xlsx': house(true), 'cutting-list-school.xlsx': school(false), 'cutting-list-school-nocache.xlsx': school(true) };
Object.entries(files).forEach(([n, wb]) => { require('fs').writeFileSync(path.join(OUT, n), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true })); console.log('wrote', n); });
module.exports = { files };
