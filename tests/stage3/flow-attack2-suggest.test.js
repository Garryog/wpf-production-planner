// Tester attack 2 on the suggestion rules after 9d59c22 ("green only when certain"). Realistic Cienapps WO titles and
// customer headings: a wrong GREEN is the dangerous one ("Confirm all green" makes the list with nobody looking), but
// real matches must still be green or the office loses the time saving. Pure function, no browser, no Supabase.
// Run: node tests/stage3/flow-attack2-suggest.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = /\/\* suggestTpl:start \*\/([\s\S]*?)\/\* suggestTpl:end \*\//.exec(src);
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
if (!m) { rec('suggestTpl block found', false); console.log('1 failed of 1'); process.exit(1); }
const { suggestTpl } = new Function(m[1] + '\nreturn {suggestTpl, projForCust};')();
const J = x => JSON.stringify(x && { level: x.level, tid: x.tid, pid: x.pid, why: x.why });
const P = [
  { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes', cien_names: [] },
  { id: 'P2', name: 'Seven Mills', customer: 'Glenveagh', cien_names: [] },
];
const T = [
  { id: 'T2', pid: 'P1', name: 'Type B kitchen', typeName: 'Type B 3-bed', ltype: 'kitchen' },
  { id: 'T3', pid: 'P1', name: 'Type B wardrobes', typeName: '', ltype: 'room' },
  { id: 'T4', pid: 'P1', name: 'Type C kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'T5', pid: 'P1', name: 'Type A1 kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'G1', pid: 'P2', name: 'Type A kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'G2', pid: 'P2', name: 'Type B kitchen', typeName: '', ltype: 'kitchen' },
];
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2 ', GV = 'GLENVEAGH - SEVEN MILLS';
const s = (title, cust, t, p) => suggestTpl({ wo: 'WO-1', title, customer: cust || CH }, t || T, p || P);
const green = (r, tid) => r && r.level === 'strong' && r.tid === tid;
const notGreen = r => !r || r.level !== 'strong';
const notWrongGreen = (r, ok) => notGreen(r) || r.tid === ok;
let r;
// ---- real matches: must still be GREEN
r = s('HOUSE 14 - TYPE B KITCHEN'); rec('G1 "HOUSE 14 - TYPE B KITCHEN" with one Type B kitchen template → GREEN Type B kitchen', green(r, 'T2'), J(r));
r = s('NO. 22 TYPE C KITCHEN'); rec('G2 "NO. 22 TYPE C KITCHEN" → GREEN Type C kitchen', green(r, 'T4'), J(r));
r = s('HOUSE 3 TYPE B WARDROBES'); rec('G3 "HOUSE 3 TYPE B WARDROBES" → GREEN Type B wardrobes (not the kitchen)', green(r, 'T3'), J(r));
r = s('Hse 5 Type b Kitchen'); rec('G4 "Hse 5 Type b Kitchen" (lower case, Hse) → GREEN Type B kitchen', green(r, 'T2'), J(r));
r = s('HOUSE 14 TYPE B KITCHEN', GV); rec('G5 same title on the Glenveagh heading → GREEN the Seven Mills template (G2), never Cherrywood', green(r, 'G2'), J(r));
r = s('HOUSE 14 TYPE B KITCHEN '); rec('G6 trailing space in the title still GREEN', green(r, 'T2'), J(r));
// ---- realistic titles that must NOT be a wrong green
r = s('HOUSE 14 TYPE B KITCHEN - EXTRA UNITS'); rec('N1 "… KITCHEN - EXTRA UNITS" (a partial/extra order) is not green', notGreen(r), J(r));
r = s('HOUSE 14 TYPE B KITCHEN REMEDIAL'); rec('N2 "… KITCHEN REMEDIAL" (a remedial job) is not green', notGreen(r), J(r));
r = s('HOUSE 14 TYPE B UTILITY'); rec('N3 "TYPE B UTILITY" is not green for the Type B kitchen or wardrobes', notGreen(r), J(r));
r = s('APT 12 TYPE A KITCHEN'); rec('N4 "TYPE A KITCHEN" with only a Type A1 template on the project is not green', notWrongGreen(r, '__none'), J(r));
r = s('HOUSE 14 TYPE B KITCHEN & WARDROBES'); rec('N5 "KITCHEN & WARDROBES" (two rooms on one WO) is not green', notGreen(r), J(r));
r = s('BLOCK B APT 3 KITCHEN'); rec('N6 "BLOCK B APT 3 KITCHEN" (B is the block, no house type) is not green for Type B kitchen', notWrongGreen(r, '__none'), J(r));
r = s('BLOCK A - APT 4 TYPE C KITCHEN'); rec('N7 "BLOCK A - APT 4 TYPE C KITCHEN" is never green for a Type A template', !r || r.level !== 'strong' || r.tid === 'T4', J(r));
r = s('UNIT B4 KITCHEN'); rec('N8 "UNIT B4 KITCHEN" (unit number B4) is not green for Type B kitchen', notGreen(r), J(r));
r = s('HOUSE 14 TYPE B KITCHEN - SHOWHOUSE'); rec('N9 "… KITCHEN - SHOWHOUSE" (show house: different spec) is not green', notGreen(r), J(r));
// N10 changed 3 Nov (Coder, Garry's answer 6): a builder-only heading links AUTOMATICALLY when that builder has exactly one
// project in the planner (here Cairn Homes has only Cherrywood Phase 2) — so the normal Type B kitchen match applies.
r = s('HOUSE 14 TYPE B KITCHEN', 'CAIRN HOMES'); rec('N10 customer heading only "CAIRN HOMES", builder has ONE project → linked automatically to it (Garry, answer 6)', r && r.pid === 'P1' && notWrongGreen(r, 'T2'), J(r));
r = s('HOUSE 14 TYPE B KITCHEN', 'CAIRN HOMES', T, P.concat([{ id: 'P3', name: 'Adamstown', customer: 'Cairn Homes', cien_names: [] }]));
rec('N10b …but when the builder has TWO projects: no link, not green (never guessed)', notGreen(r) && !(r && r.pid), J(r));
r = s('HOUSE 14 TYPE B KITCHEN', 'CAIRN HOMES - CHERRYWOOD PHASE 3'); rec('N11 heading says PHASE 3 (project is Phase 2): not green', notGreen(r), J(r));
r = s('HOUSE 14 TYPE B KITCHEN (NO APPLIANCES)'); rec('N12 "(NO APPLIANCES)" — information only: amber or green both acceptable, but never another template', !r || r.level !== 'strong' || r.tid === 'T2', J(r));
r = s('HOUSE 14 TYPE D KITCHEN'); rec('N13 "TYPE D KITCHEN" (no Type D template) is not green', notGreen(r), J(r));
r = s('HOUSE 14 TYPE B 2-BED KITCHEN'); rec('N14 "TYPE B 2-BED KITCHEN" when the template is "Type B 3-bed" is not green', notGreen(r), J(r));
r = s('HOUSE 14 KITCHEN'); rec('N15 "HOUSE 14 KITCHEN" (no type) is not green', notGreen(r), J(r));
console.log(fail + ' failed of ' + (pass + fail));
