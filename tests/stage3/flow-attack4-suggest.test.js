// Tester attack 4 on the amber/green suggestion rules after 6e000c1 (counts, more than one house, phases).
// A wrong GREEN is the dangerous one: "Confirm all green" makes the list with nobody looking. A wrong AMBER only costs a click.
// Pure function, no browser, no Supabase. Run: node tests/stage3/flow-attack4-suggest.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = /\/\* suggestTpl:start \*\/([\s\S]*?)\/\* suggestTpl:end \*\//.exec(src);
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
if (!m) { rec('suggestTpl block found', false); console.log('1 failed of 1'); process.exit(1); }
const { suggestTpl } = new Function(m[1] + '\nreturn {suggestTpl, projForCust};')();
const J = x => JSON.stringify(x && { level: x.level, tid: x.tid, why: x.why });
const P = [{ id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes', cien_names: [] }];
const TK = [ // a project with kitchen templates only
  { id: 'T2', pid: 'P1', name: 'Type B kitchen', typeName: 'Type B 3-bed', ltype: 'kitchen' },
  { id: 'T4', pid: 'P1', name: 'Type C kitchen', typeName: '', ltype: 'kitchen' }];
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2';
const s = (title, t) => suggestTpl({ wo: 'WO-1', title, customer: CH }, t || TK, P);
const green = r => r && r.level === 'strong' && r.tid === 'T2';
// ---- must NOT be green: the WO is more (or other) than one Type B kitchen for one house
[
  ['HOUSE 14 & HOUSE 15 TYPE B KITCHEN', 'two houses ("&" with HOUSE repeated)'],
  ['HOUSE 14 TYPE B KITCHEN & HOUSE 15', 'two houses, second one at the end'],
  ['HOUSE 14 TYPE B KITCHEN + HOUSE 15', 'two houses joined with +'],
  ['HOUSE 14 TYPE B KITCHEN AND 15', 'two houses joined with AND'],
  ['HOUSE 14 TYPE B KITCHEN / 15', 'two houses joined with /'],
  ['HOUSE 14 TYPE B KITCHEN 1 OF 2', 'part 1 of a split order'],
  ['HOUSE 14 TYPE B KITCHEN - PHASE 2B', 'phase 2B is not the heading\'s Phase 2'],
  ['HOUSE 14 TYPE B KITCHEN P3', 'P3 = phase 3, heading is Phase 2'],
  ['HOUSE 14 TYPE B KITCHENS', 'plural — more than one kitchen'],
].forEach(([t, why], i) => { const r = s(t); rec('N' + (i + 1) + ' "' + t + '" (' + why + ') is not green', !green(r), J(r)); });
// ---- real plain titles that must stay GREEN (only house number, house type, bed count, floor, the heading's own phase)
[
  'HOUSE 14 - 3 BED TYPE B',
  'HOUSE 14 - 3 BED TYPE B KITCHEN',
  'HOUSE 14 TYPE B KITCHEN PH2',
  'HOUSE 14 TYPE B KITCHEN PHASE 2',
  'HOUSE 14 TYPE B KITCHEN (PHASE 2)',
  'HOUSE 14 TYPE B KITCHEN PH.2',
  'HOUSE 14 TYPE B 3-BED KITCHEN',
  'HOUSE 2 TYPE B KITCHEN',
  'HOUSE 14 TYPE B KITCHEN 2ND FLOOR',
  'HOUSE 14 TYPE B KITCHEN 2 STOREY',
].forEach((t, i) => { const r = s(t); rec('G' + (i + 1) + ' "' + t + '" stays GREEN', green(r), J(r)); });
// ---- false ambers worth knowing (safe direction — costs a click, not a wrong list)
[
  ['APT 2.14 TYPE B KITCHEN', 'apartment numbered 2.14 (floor.unit) read as "how many"'],
  ['HOUSE 14 TYPE B KITCHEN PHASE TWO', 'phase written as a word'],
].forEach(([t, why], i) => { const r = s(t); rec('A' + (i + 1) + ' "' + t + '" (' + why + ') stays green [low]', green(r), J(r)); });
console.log(fail + ' failed of ' + (pass + fail));
process.exit(fail ? 1 : 0);
