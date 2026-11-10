// Tester attack round 4 (Job B part 3, Coder round 2): the matching key and seqKind on new awkward values. Pure node.
//   - never "same" when a careful person would say unsure / different (HIGH)
//   - seqKind / seqKinds on real-looking titles (the P-number Save check and "Start the sequence" use them)
// JS = SQL for all of these: tests/seq/attack4-jsvssql.test.js. Run: node tests/seq/attack4-key.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const B = require('./b0lib.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const M = (a, b) => B.keyMatch(B.keyOf('P1', a[0], a[1], ''), B.keyOf('P1', b[0], b[1], '')).r;
const hk = a => B.keyHouseStr(a[0], a[1]);
// [what, a, b, careful]  careful: same | different | not-same | not-different
const PAIRS = [
  ['em dash "—1" (basement) vs "1"', ['—1', '7'], ['1', '7'], 'not-same'],
  ['hyphen U+2010 "‐1" vs "1"', ['‐1', '7'], ['1', '7'], 'not-same', 'MEDIUM'],
  ['non-breaking hyphen U+2011 "‑1" vs "1"', ['‑1', '7'], ['1', '7'], 'not-same', 'MEDIUM'],
  ['figure dash U+2012 "‒1" vs "1"', ['‒1', '7'], ['1', '7'], 'not-same', 'LOW'],
  ['full-width minus "－1" vs "-1"', ['－1', '7'], ['-1', '7'], 'same'],
  ['"Level -1" vs "Basement"', ['Level -1', '7'], ['Basement', '7'], 'not-different'],
  ['"-1" vs "-01"', ['-1', '7'], ['-01', '7'], 'same'],
  ['"Floor -1" vs "Floor 1"', ['Floor -1', '7'], ['Floor 1', '7'], 'different'],
  ['"Block -1" vs "Block 1"', ['Block -1', '7'], ['Block 1', '7'], 'not-same', 'MEDIUM'],
  ['"B1" vs "-1"', ['B1', '7'], ['-1', '7'], 'not-same'],
  ['unit "T.B.C." both sides', ['T09', 'T.B.C.'], ['T09', 'T.B.C.'], 'not-same'],
  ['unit "XX" both sides (placeholder)', ['T09', 'XX'], ['T09', 'XX'], 'not-same', 'MEDIUM'],
  ['unit "TBC 2" vs "TBC 2"', ['T09', 'TBC 2'], ['T09', 'TBC 2'], 'not-same', 'MEDIUM'],
  ['unit "?" vs "7"', ['T09', '?'], ['T09', '7'], 'not-same'],
  ['unit "To be confirmed" both', ['T09', 'To be confirmed'], ['T09', 'To be confirmed'], 'not-same'],
  ['unit "Not known" both', ['T09', 'Not known'], ['T09', 'Not known'], 'not-same'],
  ['floor "N.A." both', ['N.A.', '7'], ['N.A.', '7'], 'not-same'],
  ['floor "Block TBC" both', ['Block TBC', '7'], ['Block TBC', '7'], 'not-same'],
  ['accent outside the list "Block AŁ" vs "Block AŒ"', ['Block AŁ', '7'], ['Block AŒ', '7'], 'not-same', 'LOW'],
  ['"Block Æ" vs "Block Ø"', ['Block Æ', '7'], ['Block Ø', '7'], 'not-same'],
  ['fada "Áras 1" vs "Aras 1"', ['Áras 1', '7'], ['Aras 1', '7'], 'same'],
  ['combining accent "E\\u0301" vs "É"', ['Block É', '7'], ['Block É', '7'], 'same'],
  ['superscript "7²" vs "7-2"', ['T09', '7²'], ['T09', '7-2'], 'not-same', 'LOW'],
  ['superscript "7²" vs "7/2"', ['T09', '7²'], ['T09', '7/2'], 'not-same', 'LOW'],
  ['unit "2.05" vs "2.5"', ['T09', '2.05'], ['T09', '2.5'], 'not-same'],
  ['unit "2.05" vs "205"', ['T09', '2.05'], ['T09', '205'], 'not-same'],
  ['unit "2.05" vs "2-05"', ['T09', '2.05'], ['T09', '2-05'], 'not-same'],
  ['unit "2.05" vs "02.05"', ['T09', '2.05'], ['T09', '02.05'], 'same'],
  ['unit "7.1" vs "7"', ['T09', '7.1'], ['T09', '7'], 'not-same'],
  ['unit "7 (Type B)" vs "7 (Type C)"', ['T09', '7 (Type B)'], ['T09', '7 (Type C)'], 'not-different'],
  ['unit "7 (B)" vs "7"', ['T09', '7 (B)'], ['T09', '7'], 'not-same'],
  ['unit "7B" vs "7 (Type B)"', ['T09', '7B'], ['T09', '7 (Type B)'], 'not-same'],
  ['"A Block" vs "B Block"', ['A Block', '7'], ['B Block', '7'], 'different'],
  ['"Ground Block" vs "0"', ['Ground Block', '7'], ['0', '7'], 'not-same'],
  ['"Block" + level "1" in unit: unit "1-7" vs "7"', ['Block A', '1-7'], ['Block A', '7'], 'not-same'],
];
for (const [what, a, b, c, sev] of PAIRS) {
  const r = M(a, b), r2 = M(b, a), k = [hk(a), hk(b)];
  if (r !== r2) rec('keyMatch symmetric: ' + what, false, r + ' / ' + r2);
  if (c === 'same' || c === 'different') rec('[' + (c === 'different' ? 'HIGH' : 'MEDIUM') + '] ' + what + ' → ' + c, r === c, 'keyMatch says ' + r + ' (keys ' + k.join(' / ') + ')');
  else if (c === 'not-same') rec('[' + (sev || 'HIGH') + '] ' + what + ' → never "same"', r !== 'same', 'keyMatch says same (keys ' + k.join(' / ') + ')');
  else rec('[MEDIUM] ' + what + ' → not "different"', r !== 'different', 'keyMatch says different (keys ' + k.join(' / ') + ')');
  if (c !== 'same' && c !== 'not-different') rec('not same → database keys differ: ' + what, !(k[0] && k[0] === k[1]), 'both ' + k[0]);
}

// ---- seqKind / seqKinds on real-looking titles
const ctx = vm.createContext({});
const grab = name => { const i = SRC.indexOf('\nfunction ' + name + '(') + 1; const j = SRC.indexOf('\n', i); return SRC.slice(i, j); };
vm.runInContext(grab('seqKind') + '\n' + grab('seqKinds') + ';globalThis.K={seqKind,seqKinds};', ctx);
const KINDS = [
  ['W2 BED 2', 'robes'], ['UTILITY', 'utility'], ['QUARTZ', 'quartz'], ['ISLAND', 'other'], ['KITCHEN & UTILITY', 'kitchen'],
  ['2 BED APT KITCHEN', 'kitchen'], ['MASTER BED ROBES', 'robes'], ['BEDROOM 2 WARDROBE', 'robes'], ['HOUSE TYPE C UTILITY', 'utility'],
  ['UNIT 22 TYPE B 3 BED SEMI - KITCHEN', 'kitchen'], ['TYPE B 3BED', 'kitchen'], ['HOUSE 14 TYPE B 3-BED', 'kitchen'], ['TYPE A 2 BED', 'kitchen'],
  ['WARDROBES BED 1', 'robes'], ['BED 1 & BED 2 ROBES', 'robes'], ['ROBES', 'robes'], ['WARDROBE', 'robes'], ['KITCHEN ISLAND', 'kitchen'],
  ['ISLAND UNIT', 'other'], ['QUARTZ WORKTOPS KITCHEN', 'quartz'], ['HOUSE TYPE B', 'kitchen'], ['APT 2.05 TYPE A 2 BED KITCHEN', 'kitchen'],
  ['UTILITY ROOM', 'utility'], ['BEDROOM 1 & 2 WARDROBES', 'robes'], ['2 X WARDROBES', 'robes'], ['TYPE B 2 BED DUPLEX', 'kitchen'],
  ['HOUSE 14 - 3 BED TYPE B', 'kitchen'], ['3 BED SEMI', 'kitchen'], ['BED2', 'robes'], ['MASTER BEDROOM', 'robes'],
];
for (const [t, k] of KINDS) { const got = ctx.K.seqKind(t); rec('[' + (t === 'MASTER BEDROOM' ? 'MEDIUM' : 'HIGH') + '] seqKind("' + t + '") = ' + k, got === k, 'says ' + got); }
// seqKinds: every kind a title names (used so a P-number for ANY of them is refused)
const KS = [['KITCHEN & UTILITY', ['kitchen', 'utility']], ['KITCHEN AND WARDROBES', ['kitchen', 'robes']], ['KITCHEN, UTILITY & ROBES', ['kitchen', 'utility', 'robes']],
  ['UTILITY & ISLAND', ['utility', 'other']], ['QUARTZ KITCHEN', ['quartz', 'kitchen']], ['ROBES & UTILITY', ['robes', 'utility']]];
for (const [t, want] of KS) { const got = [...ctx.K.seqKinds(t)].sort(); rec('[MEDIUM] seqKinds("' + t + '") names ' + want.join(' + ') + ' (a P-number for any of them in that house is refused)', want.every(x => got.includes(x)), 'says ' + got.join(' + ')); }

const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
