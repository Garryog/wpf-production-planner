// Simple lists step 2 (Garry, 4 Nov, item 5): "spec TBC" flags. ONE pure function, lsTbc(lines), cut out of index.html
// between /* lsTbc:start */ and /* lsTbc:end */. A line whose description or colour/spec says "TBC", "None chosen" or
// "To be confirmed" — or a worktop / sink / tap line with NO colour/spec — is flagged. It never blocks anything.
// Run: node tests/editor/s2-tbc.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const m = /\/\* lsTbc:start \*\/([\s\S]*?)\/\* lsTbc:end \*\//.exec(src);
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
if (!m) { rec('lsTbc is in index.html between its markers', false); console.log('\n0 passed, 1 failed'); process.exit(1); }
eval(m[1] + ';global.lsTbc=lsTbc;');
// database lines (kind, part, material, section) and screen rows (k, item, mat) both work
const ln = (kind, part, material, extra) => Object.assign({ kind, part, material }, extra || {});
const rw = (k, item, mat, extra) => Object.assign({ k, item, mat }, extra || {});
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let r;
r = lsTbc([ln('saw', 'Worktops', 'None Chosen / TBC / Corian')]);
rec('"None Chosen / TBC / Corian" in the colour → "Worktops"', eq(r, ['Worktops']), JSON.stringify(r));
r = lsTbc([ln('fit', 'Sink + Tap', 'TBC')]);
rec('"Sink + Tap — TBC" → "Sink + Tap"', eq(r, ['Sink + Tap']), JSON.stringify(r));
r = lsTbc([ln('fit', 'Extractor', 'To be confirmed')]);
rec('"To be confirmed" is flagged', eq(r, ['Extractor']), JSON.stringify(r));
r = lsTbc([ln('saw', 'Filler', 'tbc')]);
rec('any case ("tbc")', eq(r, ['Filler']), JSON.stringify(r));
r = lsTbc([ln('saw', 'Gable', 'T.B.C.')]);
rec('"T.B.C." with dots', eq(r, ['Gable']), JSON.stringify(r));
r = lsTbc([ln('saw', 'Top', '', { length_mm: 3000, width_mm: 600 })]);
rec('a worktop ("Top") with NO colour/spec is flagged', eq(r, ['Top']), JSON.stringify(r));
r = lsTbc([ln('fit', 'Sink', ''), ln('fit', 'Tap', null), ln('saw', 'Worktop', '  ')]);
rec('sink / tap / worktop with a blank spec are flagged', eq(r, ['Sink', 'Tap', 'Worktop']), JSON.stringify(r));
r = lsTbc([ln('saw', 'Top', 'Frosty Matt 25mm'), ln('fit', 'Sink', 'Hafele Calder'), ln('fit', 'Tap', 'Franke chrome')]);
rec('worktop / sink / tap WITH a spec are not flagged', eq(r, []), JSON.stringify(r));
r = lsTbc([ln('saw', 'Top Cornice', ''), ln('saw', 'Kicker', ''), ln('fit', 'Kicker vent', ''), ln('saw', 'Tall Gable', '')]);
rec('other lines with a blank colour are NOT flagged (Top Cornice, Kicker, Kicker vent, Tall Gable)', eq(r, []), JSON.stringify(r));
r = lsTbc([ln('saw', 'Batten', 'MFC White', { note: 'Talk to Ollie' }), ln('saw', 'Stable door', 'MFC White'), ln('saw', 'Tablet shelf', 'W/W')]);
rec('no false alarms: "Talk to Ollie", "Stable", "Tablet" (TBC only as a word)', eq(r, []), JSON.stringify(r));
r = lsTbc([ln('hdr', 'Worktops TBC', ''), ln('saw', 'Filler', 'W/W')]);
rec('headings are never flagged themselves', eq(r, []), JSON.stringify(r));
r = lsTbc([ln('hdr', 'House nr 103', ''), ln('hdr', 'Worktops', '', { section: 'House nr 103' }), ln('saw', 'TBC', 'TBC', { section: 'Worktops' })]);
rec('a line whose description is itself "TBC" is named by its heading', eq(r, ['Worktops']), JSON.stringify(r));
r = lsTbc([ln('saw', '', 'None chosen')]);
rec('no description and no heading → "line 1"', eq(r, ['line 1']), JSON.stringify(r));
r = lsTbc([ln('saw', 'Worktops', 'TBC'), ln('saw', 'Worktops', 'None chosen'), ln('fit', 'Sink', '')]);
rec('each name once, in list order', eq(r, ['Worktops', 'Sink']), JSON.stringify(r));
r = lsTbc([rw('saw', 'Worktops', 'TBC'), rw('fit', 'Tap', '')]);
rec('screen rows (k / item / mat) work the same', eq(r, ['Worktops', 'Tap']), JSON.stringify(r));
r = lsTbc([rw('part', 'Sink', 'TBC'), rw('part', 'Filler', 'W/W')]);
rec('editor rows (k "part") work the same', eq(r, ['Sink']), JSON.stringify(r));
r = lsTbc([ln('buy', 'Panel Back', 'TBC')]);
rec('a bought-in line with a TBC colour is flagged too', eq(r, ['Panel Back']), JSON.stringify(r));
r = lsTbc([ln('saw', 'Worktops', 'TBC', { removed_rev: 2 }), ln('fit', 'Sink', 'TBC', { status: 'na' })]);
rec('removed and not-needed lines are not flagged', eq(r, []), JSON.stringify(r));
r = lsTbc(null);
rec('nothing → nothing', eq(r, []));
r = lsTbc([ln('saw', 'Worktop <b>x</b>', 'TBC')]);
rec('names come back as typed (the caller escapes them)', eq(r, ['Worktop <b>x</b>']));
const pass = res.filter(Boolean).length;
console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
process.exit(res.length - pass ? 1 : 0);
