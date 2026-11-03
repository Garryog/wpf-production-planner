// Cutting-list flow, step 1: suggestTpl(order, templates, projects) — the template the planner suggests for a newly
// processed work order (pure function, no browser). Customer = project: the project title is always part of the Cienapps
// WO customer heading (Garry, 3 Nov), so the project is found from the heading (exact name / customer / cien_names, or the
// project name inside the heading — the longest one wins). Then the template whose name best matches the WO title.
// green = strong, amber = weak (a guess, or a tie), grey = none.  Run: node tests/stage3/flow1-suggest.test.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = /\/\* suggestTpl:start \*\/([\s\S]*?)\/\* suggestTpl:end \*\//.exec(src);
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
if (!m) { rec('suggestTpl block found in index.html', false); console.log('1 failed of 1'); process.exit(0); }
const { suggestTpl, projForCust } = new Function(m[1] + '\nreturn {suggestTpl, projForCust};')();

const P = [
  { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes', cien_names: [] },
  { id: 'P2', name: 'Ballymastone', customer: 'Glenveagh Homes', cien_names: ['GLENVEAGH HOMES LTD - BALLYMASTONE PH1'] },
  { id: 'P3', name: 'Adamstown', customer: 'Cairn Homes', cien_names: [] },
  { id: 'P4', name: 'Parkside', customer: 'Kilmurry Ltd', cien_names: [] },
  { id: 'P5', name: 'Parkside Phase 2', customer: 'Kilmurry Ltd', cien_names: [] },
  { id: 'P6', name: 'Aderrig', customer: 'Aderrig Homes', cien_names: [] },
  { id: 'P7', name: 'Ely', customer: 'Ely Builders', cien_names: [] }, // short name: never matched inside a heading
];
const T = [
  { id: 'T1', pid: 'P1', name: 'Type A kitchen', typeName: 'Type A 2-bed', ltype: 'kitchen' },
  { id: 'T2', pid: 'P1', name: 'Type B kitchen', typeName: 'Type B 3-bed', ltype: 'kitchen' },
  { id: 'T3', pid: 'P1', name: 'Type B wardrobes', typeName: 'Type B robes', ltype: 'room' },
  { id: 'T4', pid: 'P1', name: 'Type C1 kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'T5', pid: 'P1', name: 'Utility', typeName: '', ltype: 'room' },
  { id: 'T6', pid: 'P2', name: 'Kitchen', typeName: 'Standard kitchen', ltype: 'kitchen' },
  { id: 'T7', pid: 'P2', name: 'Type B island kitchen', typeName: '', ltype: 'kitchen' },
  { id: 'T8', pid: 'P1', name: 'Old Type B kitchen', typeName: 'Type B 3-bed', ltype: 'kitchen', archived: true },
];
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2 ';
const s = (title, customer, tpls, projs) => suggestTpl({ wo: 'WO-2611-1', title, customer }, tpls || T, projs || P);
const lv = (r, level, tid) => r && r.level === level && (tid === undefined || r.tid === tid);
const J = r => JSON.stringify(r);

// ---- the project from the Cienapps customer heading
rec('project: heading containing the project title (caps, trailing space) → that project', (projForCust(CH, P) || {}).id === 'P1');
rec('project: exact cien_names spelling → that project', (projForCust('Glenveagh Homes Ltd - Ballymastone Ph1', P) || {}).id === 'P2');
rec('project: "Cairn Homes Properties Ltd - Adamstown (Phase 3)" → Adamstown', (projForCust('Cairn Homes Properties Ltd - Adamstown (Phase 3)', P) || {}).id === 'P3');
rec('project: "KILMURRY LTD - PARKSIDE PHASE 2" → the longer name wins (Parkside Phase 2, not Parkside)', (projForCust('KILMURRY LTD - PARKSIDE PHASE 2', P) || {}).id === 'P5');
rec('project: "KILMURRY LTD - PARKSIDE" → Parkside', (projForCust('KILMURRY LTD - PARKSIDE', P) || {}).id === 'P4');
rec('project: builder name only ("CAIRN HOMES", two Cairn projects) → none (never guessed)', projForCust('CAIRN HOMES', P) === null);
rec('project: exact customer with one project ("Aderrig Homes") → that project (as today)', (projForCust('Aderrig Homes', P) || {}).id === 'P6');
rec('project: a name only as part of another word is not a match ("PARKSIDEVIEW HOMES")', projForCust('PARKSIDEVIEW HOMES', P) === null);
rec('project: short project names (under 4 letters) are not looked for inside a heading ("BELY CONSTRUCTION - ELY ROAD")', projForCust('BELY CONSTRUCTION - ELY ROAD', P) === null);
rec('project: blank heading → none', projForCust('  ', P) === null && projForCust(null, P) === null);
rec('project: inactive projects are skipped', projForCust(CH, P.map(p => p.id === 'P1' ? { ...p, active: false } : p)) === null);

// ---- strong (green)
let r;
r = s('HOUSE 14 - TYPE B KITCHEN', CH); rec('strong: "HOUSE 14 - TYPE B KITCHEN" → Type B kitchen', lv(r, 'strong', 'T2') && r.pid === 'P1', J(r));
r = s('UNIT 22 TYPE B 3 BED SEMI - KITCHEN', CH); rec('strong: "UNIT 22 TYPE B 3 BED SEMI - KITCHEN" → Type B kitchen', lv(r, 'strong', 'T2'), J(r));
r = s('HSE 7 TYPE B WARDROBES', CH); rec('strong: "HSE 7 TYPE B WARDROBES" → Type B wardrobes (not the kitchen)', lv(r, 'strong', 'T3'), J(r));
r = s('No. 31 Type C1 - Kitchen + Utility', CH); rec('strong: "No. 31 Type C1 - Kitchen + Utility" → Type C1 kitchen', lv(r, 'strong', 'T4'), J(r));
r = s('APT 2.05 TYPE A 2 BED KITCHEN', CH); rec('strong: "APT 2.05 TYPE A 2 BED KITCHEN" → Type A kitchen', lv(r, 'strong', 'T1'), J(r));
r = s('house 3 type-b  kitchen', CH); rec('strong: lower case, hyphen and double space → still Type B kitchen', lv(r, 'strong', 'T2'), J(r));
r = s('HOUSE 3 TYPE B ISLAND KITCHEN', 'Glenveagh Homes Ltd - Ballymastone Ph1'); rec('strong: "TYPE B ISLAND KITCHEN" → Type B island kitchen (not the standard kitchen)', lv(r, 'strong', 'T7') && r.pid === 'P2', J(r));
r = s('HOUSE 12 UTILITY', CH); rec('strong: "HOUSE 12 UTILITY" → Utility (its name is in the title)', lv(r, 'strong', 'T5'), J(r));

// ---- weak (amber): a guess or a tie — never confirmed by "Confirm all green"
r = s('HOUSE 9 TYPE B', CH); rec('weak: "HOUSE 9 TYPE B" (kitchen or wardrobes?) → amber, Type B kitchen or wardrobes offered first', lv(r, 'weak') && ['T2', 'T3'].includes(r.tid) && r.alts.includes('T2') && r.alts.includes('T3'), J(r));
r = s('HOUSE 5 KITCHEN', CH); rec('weak: "HOUSE 5 KITCHEN" (no type) → amber guess among the kitchens', lv(r, 'weak') && ['T1', 'T2', 'T4'].includes(r.tid), J(r));
r = s('HOUSE 3 KITCHEN', 'Glenveagh Homes Ltd - Ballymastone Ph1'); rec('weak: "HOUSE 3 KITCHEN" on Ballymastone → the standard Kitchen, amber', lv(r, 'weak', 'T6'), J(r));
r = s('HOUSE 40 TYPE C KITCHEN', 'Glenveagh Homes Ltd - Ballymastone Ph1'); rec('weak: "TYPE C KITCHEN" — only a generic "Kitchen" template → amber, never green (the title names a type the template does not)', lv(r, 'weak', 'T6'), J(r));

// ---- none (grey)
r = s('HOUSE 40 TYPE D KITCHEN', CH); rec('none: "TYPE D KITCHEN" — no Type D, the other types never offered → grey', lv(r, 'none') && !r.tid, J(r));
r = s('TYPE B 2 BED KITCHEN', CH); rec('none: "TYPE B 2 BED" vs the Type B 3-bed template → not suggested', lv(r, 'none'), J(r));
r = s('SNAG - HOUSE 12 HINGES', CH); rec('none: a snag title → grey', lv(r, 'none'), J(r));
r = s('HOUSE 14 - TYPE B KITCHEN', 'CAIRN HOMES'); rec('none: customer heading with no project → grey, says "no project"', lv(r, 'none') && !r.pid && /project/i.test(r.why), J(r));
r = s('HOUSE 14 - TYPE B KITCHEN', 'KILMURRY LTD - PARKSIDE'); rec('none: project has no templates → grey, says so', lv(r, 'none') && r.pid === 'P4' && /template/i.test(r.why), J(r));
r = s('HOUSE 14 - TYPE B KITCHEN', CH, T.filter(t => t.id !== 'T2')); rec('archived template never suggested (T8 "Old Type B kitchen" archived)', !r || r.tid !== 'T8', J(r));
r = s('', CH); rec('none: blank title → grey', lv(r, 'none'), J(r));
r = s('ALL TYPES AND SIZES', CH); rec('none: "TYPES AND" is not read as a type code', lv(r, 'none'), J(r));
r = suggestTpl({}, T, P); rec('empty order → grey, no crash', lv(r, 'none'), J(r));
r = suggestTpl(null, null, null); rec('null everything → grey, no crash', lv(r, 'none'), J(r));

// ---- shape
r = s('HOUSE 14 - TYPE B KITCHEN', CH);
rec('result carries a plain-English reason', typeof r.why === 'string' && r.why.length > 3, r.why);
rec('alts: other templates of the project, best first, the suggestion first', Array.isArray(r.alts) && r.alts[0] === 'T2', J(r.alts));
console.log(res.filter(x => !x).length + ' failed of ' + res.length);
