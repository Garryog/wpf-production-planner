// Makes tests/seq/b0-fuzz.json: 1,200 awkward floor / unit strings (accents, minus signs, placeholders, dots, superscripts,
// zero-width, …) with the planner's keys. pg-check.sql checks the database gives the SAME strings for every one;
// b0-key.test.js checks the planner still does. Run again (node tests/seq/b0-fuzz-make.js) only when the key rule changes ON
// PURPOSE — then re-run both checks.
const fs = require('fs'), path = require('path'), B = require('./b0lib.js');
const parts = ['T09', 't9 ', 'Block', 'BLK', 'A', 'É', 'ß', '-1', '−2', 'Level', 'Floor', '1st', 'G', 'GF', 'L1', 'F01', 'Apt', 'No.', '7', '07', '2.05', '12.0', '(Type B)', 'TBC', 'N/A', '?', '²', '½', 'Ⅶ', '⑦',
  '​', ' ', '12-14', '7a', 'ISLAND', 'Basement', '0', '00', 'Unit', 'x', '.', '#', 'Ø', 'ñ', 'Ground Floor', 'A Block', '7 (type c)', 'APT07', 'ﬁrst', 'Ｔ０９', 'TBA', 'Second', '–3'];
let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const r = [];
for (let i = 0; i < 1200; i++) { let s = ''; const k = 1 + rnd(4); for (let j = 0; j < k; j++) s += (j ? (rnd(3) ? ' ' : '') : '') + parts[rnd(parts.length)]; r.push(s); }
const out = r.map(s => ({ s, f: B.keyFloorStr(B.keyFloor(s)), u: B.keyUnit(s), t: B.keyTxt(s), c: B.keyCode(s) }));
fs.writeFileSync(path.join(__dirname, 'b0-fuzz.json'), JSON.stringify(out));
console.log(out.length + ' strings written');
