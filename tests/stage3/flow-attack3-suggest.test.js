// Tester attack 3 on the amber/green suggestion rules after 932c2e9 (extra words = amber; builder-only heading links when the
// builder has one project). More realistic Cienapps titles. A wrong GREEN is the dangerous one ("Confirm all green" makes the
// list with nobody looking). Pure function, no browser, no Supabase.
// Run: node tests/stage3/flow-attack3-suggest.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = /\/\* suggestTpl:start \*\/([\s\S]*?)\/\* suggestTpl:end \*\//.exec(src);
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
if (!m) { rec('suggestTpl block found', false); console.log('1 failed of 1'); process.exit(1); }
const { suggestTpl, projForCust } = new Function(m[1] + '\nreturn {suggestTpl, projForCust};')();
const J = x => JSON.stringify(x && { level: x.level, tid: x.tid, pid: x.pid, why: x.why });
const P = [
  { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes', cien_names: [] },
  { id: 'P2', name: 'Seven Mills', customer: 'Glenveagh', cien_names: [] },
];
const T = [
  { id: 'T2', pid: 'P1', name: 'Type B kitchen', typeName: 'Type B 3-bed', ltype: 'kitchen' },
  { id: 'T3', pid: 'P1', name: 'Type B wardrobes', typeName: '', ltype: 'room' },
  { id: 'T4', pid: 'P1', name: 'Type C kitchen', typeName: '', ltype: 'kitchen' },
];
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2';
const s = (title, cust, t, p) => suggestTpl({ wo: 'WO-1', title, customer: cust || CH }, t || T, p || P);
const green = (r, tid) => r && r.level === 'strong' && r.tid === tid;
const notGreen = r => !r || r.level !== 'strong';
let r;
// ---- must NOT be green (the job is not simply "the Type B kitchen for this house")
const NOT = [
  ['HOUSE 14 TYPE B KITCHEN - REPLACEMENT DOORS', 'only replacement doors, not the whole kitchen'],
  ['HOUSE 14 TYPE B KITCHEN (SNAG)', 'a snag job'],
  ['HOUSE 14 TYPE B KITCHEN - ISLAND ONLY', 'island only'],
  ['HOUSE 14 TYPE B KITCHEN HANDED', 'handed (mirror) version — cut sizes differ'],
  ['HOUSE 14 TYPE B KITCHEN - MIRROR IMAGE', 'mirror image'],
  ['HOUSE 14 TYPE B KITCHEN - PHASE 3', 'title says PHASE 3, heading is Phase 2'],
  ['HOUSE 14 TYPE B2 KITCHEN', 'type B2 is not type B'],
  ['HOUSES 14-16 TYPE B KITCHEN', 'three houses on one WO'],
  ['HOUSE 14 TYPE B KITCHEN X2', 'two kitchens'],
  ['HOUSE 14 TYPE B KITCHEN - SECOND KITCHEN', 'a second kitchen in the house'],
  ['HOUSE 14 TYPE B KITCHEN - 2 UNITS', 'only two units of the kitchen'],
  ['HOUSE 14 TYPE B KITCHEN - CREDIT', 'a credit note WO'],
];
NOT.forEach(([t, why], i) => { r = s(t); rec('N' + (i + 1) + ' "' + t + '" (' + why + ') is not green', notGreen(r), J(r)); });
// ---- real plain matches that must stay GREEN (house-type / floor words only)
const YES = [
  ['APT 14 FIRST FLOOR TYPE B KITCHEN', 'T2'],
  ['HOUSE 14 TYPE B KITCHEN - SEMI DETACHED', 'T2'],
  ['NO 14 TYPE B KITCHEN END TERRACE', 'T2'],
  ['HOUSE 14 TYPE B KITCHEN + UTILITY', 'T2'],
  ['HOUSE 14 - CHERRYWOOD - TYPE B KITCHEN', 'T2'],
  ['House 14, Type B, Kitchen.', 'T2'],
  ['HOUSE 14 TYPE B WARDROBES', 'T3'],
];
YES.forEach(([t, tid], i) => { r = s(t); rec('G' + (i + 1) + ' "' + t + '" → GREEN ' + tid, green(r, tid), J(r)); });
// ---- builder-only headings (Garry answer 6)
const P3 = P.concat([{ id: 'P3', name: 'Adamstown Phase 1', customer: 'Cairn Homes', cien_names: [] }]);
rec('B1 "CAIRN HOMES LTD" heading, builder has one project → links to it', (projForCust('CAIRN HOMES LTD', P) || {}).id === 'P1', JSON.stringify(projForCust('CAIRN HOMES LTD', P)));
rec('B2 "CAIRN HOMES LTD" heading, builder has TWO projects → no link (never guessed)', !projForCust('CAIRN HOMES LTD', P3), JSON.stringify(projForCust('CAIRN HOMES LTD', P3)));
rec('B3 "CAIRN HOMES - ADAMSTOWN" (a site the builder has no project for) → no link to Cherrywood', !projForCust('CAIRN HOMES - ADAMSTOWN', P), JSON.stringify(projForCust('CAIRN HOMES - ADAMSTOWN', P)));
rec('B4 "CAIRN" alone → links only if exactly one Cairn project', (projForCust('CAIRN', P) || {}).id === 'P1' && !projForCust('CAIRN', P3), JSON.stringify([projForCust('CAIRN', P), projForCust('CAIRN', P3)]));
rec('B5 "HOMES LTD" (only company words) → no link', !projForCust('HOMES LTD', P), JSON.stringify(projForCust('HOMES LTD', P)));
console.log(fail + ' failed of ' + (pass + fail));
process.exit(fail ? 1 : 0);
