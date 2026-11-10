// Tester attack 1 on the cutting-list flow: suggestTpl / projForCust with odd Cienapps titles and customer headings.
// A wrong GREEN (strong) suggestion is the dangerous one: "Confirm all green" makes the list without anyone looking.
// Pure function, no browser, no Supabase. Run: node tests/stage3/flow-attack1-suggest.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = /\/\* suggestTpl:start \*\/([\s\S]*?)\/\* suggestTpl:end \*\//.exec(src);
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
if (!m) { rec('suggestTpl block found', false); console.log('1 failed of 1'); process.exit(1); }
const { suggestTpl, projForCust } = new Function(m[1] + '\nreturn {suggestTpl, projForCust};')();
const J = x => JSON.stringify(x && { level: x.level, tid: x.tid, pid: x.pid, why: x.why });

const P = [
  { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes', cien_names: [] },
  { id: 'P4', name: 'Parkside', customer: 'Kilmurry Ltd', cien_names: [] },
  { id: 'P5', name: 'Parkside Phase 2', customer: 'Kilmurry Ltd', cien_names: [] },
  { id: 'P8', name: 'Castlefort', customer: 'Castlefort Developments', cien_names: [] }, // an older project named after the builder
  { id: 'P9', name: 'Lucan', customer: 'Castlefort Developments', cien_names: [] },
];
const T = [
  { id: 'T2', pid: 'P1', name: 'Type B kitchen', typeName: 'Type B 3-bed', ltype: 'kitchen' },
  { id: 'T3', pid: 'P1', name: 'Type B wardrobes', typeName: 'Type B robes', ltype: 'room' },
  { id: 'T4', pid: 'P1', name: 'Type C kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'T9', pid: 'P1', name: 'Type B1 kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'PK1', pid: 'P4', name: 'Type B kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'PK2', pid: 'P5', name: 'Type B kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'CF1', pid: 'P8', name: 'Type A kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'LU1', pid: 'P9', name: 'Type A kitchen', typeName: '', ltype: 'kitchen' },
];
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2 ';
const s = (title, cust, t, p) => suggestTpl({ wo: 'WO-1', title, customer: cust || CH }, t || T, p || P);
const notGreen = r => !r || r.level !== 'strong';
let r;

// ---- odd titles
r = s('HOUSE 4 TYPE B/C KITCHEN');
rec('"TYPE B/C KITCHEN" (two house types named) is never green', notGreen(r), J(r));
r = s('HOUSE 4 TYPE B-1 KITCHEN');
rec('"TYPE B-1 KITCHEN" with a Type B1 template on the project is not GREEN for the plain Type B kitchen', notGreen(r) || r.tid === 'T9', J(r));
r = s('HOUSE 4 HT-B KITCHEN');
rec('"HT-B KITCHEN" (house type written HT-B): no crash, not green for a different type', !r || r.tid !== 'T4' || notGreen(r), J(r));
r = s('HSE 2 TYPE B 2BED KITCHEN');
rec('"2BED" read as 2 bed → the 3-bed Type B kitchen is not suggested green', notGreen(r) || r.tid !== 'T2', J(r));
r = s('HSE 2 TYPE B KIT + ROBES');
rec('"TYPE B KIT + ROBES" (kitchen AND wardrobes on one WO) is not green — one template can\'t cover both', notGreen(r), J(r));
r = s('  HSE 2   TYPE B KITCHEN   ');
rec('trailing / double spaces on the title: still Type B kitchen, green', r.level === 'strong' && r.tid === 'T2', J(r));
r = s('HOUSE 4 TYPE B KITCHEN - AS TYPE C BUT HANDED');
rec('a title naming a second type later on ("… AS TYPE C") is not green', notGreen(r), J(r));

// ---- two projects that both look right
rec('"KILMURRY LTD - PARKSIDE PH2" (Phase written PH2) is NOT matched to plain "Parkside"', (projForCust('KILMURRY LTD - PARKSIDE PH2', P) || {}).id !== 'P4', JSON.stringify(projForCust('KILMURRY LTD - PARKSIDE PH2', P)));
r = s('HOUSE 3 TYPE B KITCHEN', 'KILMURRY LTD - PARKSIDE PH2');
rec('…so the Parkside (phase 1) Type B kitchen is not suggested GREEN for a Phase 2 WO', notGreen(r) || r.pid !== 'P4', J(r));
r = s('HOUSE 3 TYPE B KITCHEN', 'KILMURRY LTD - PARKSIDE PHASE 2');
rec('"PARKSIDE PHASE 2" → Phase 2 template (control)', r.pid === 'P5' && r.tid === 'PK2', J(r));

// ---- builder heading containing a project name
rec('"CASTLEFORT DEVELOPMENTS - LUCAN": the site (Lucan) is the project, not the builder-named project "Castlefort"', (projForCust('CASTLEFORT DEVELOPMENTS - LUCAN', P) || {}).id !== 'P8', JSON.stringify(projForCust('CASTLEFORT DEVELOPMENTS - LUCAN', P)));
r = s('HOUSE 9 TYPE A KITCHEN', 'CASTLEFORT DEVELOPMENTS - LUCAN');
rec('…and the Castlefort template is never suggested GREEN for a Lucan WO', notGreen(r) || r.pid !== 'P8', J(r));

// ---- a template with no room in its name ("Type B", saved as a room list) on a kitchen WO
const T2 = [{ id: 'X1', pid: 'P1', name: 'Type B', typeName: 'Type B', ltype: 'room' }];
r = s('HOUSE 9 TYPE B KITCHEN', CH, T2);
rec('only template "Type B" (a ROOM list, no room word) is not green for a KITCHEN title', notGreen(r), J(r));

console.log(fail + ' failed of ' + (pass + fail));
process.exit(fail ? 1 : 0);
