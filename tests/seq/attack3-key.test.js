// Tester attack round 3 (Job B part 3, steps 1-5): the B0 matching key against awkward, real-looking Cienapps values.
// Pure node (the b0key block straight out of index.html, like b0lib.js). Fixture: tests/seq/attack3-pairs.json.
//   - a pair a careful person would call "unsure" or "different" must NEVER come out "same"  (HIGH: two houses joined)
//   - a pair a careful person would call "same" or "unsure" should not come out "different" (MEDIUM: a second record is made)
//   - seqKind (kitchen / utility / robes) on real Cienapps kitchen titles — the P-number Save re-check and "Start the
//     sequence" both rely on it (HIGH when a kitchen reads as robes: the duplicate check looks at the wrong kind)
//   - keyTitleBits suggestions on titles with numbers that are not the unit
// Run: node tests/seq/attack3-key.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const B = require('./b0lib.js');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'attack3-pairs.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };

// ---- 1. the pairs
for (const p of FX.pairs) {
  const ka = B.keyOf('P1', p.a.floor, p.a.unit, ''), kb = B.keyOf('P1', p.b.floor, p.b.unit, '');
  const r = B.keyMatch(ka, kb).r, r2 = B.keyMatch(kb, ka).r;
  rec('pair ' + p.n + ' keyMatch is symmetric (' + p.what + ')', r === r2, r + ' / ' + r2);
  const hk = [B.keyHouseStr(p.a.floor, p.a.unit), B.keyHouseStr(p.b.floor, p.b.unit)];
  // the SQL file compares against these strings: they must still be what the fixture recorded
  rec('pair ' + p.n + ' house keys unchanged since the fixture (' + p.what + ')', JSON.stringify(hk) === JSON.stringify(p.hk), JSON.stringify(hk) + ' vs ' + JSON.stringify(p.hk));
  const c = p.careful;
  if (c === 'same' || c === 'different') rec('[' + (c === 'different' ? 'HIGH' : 'MEDIUM') + '] pair ' + p.n + ' ' + p.what + ' → ' + c, r === c, 'keyMatch says ' + r + ' (keys ' + hk.join(' / ') + ')');
  else if (c === 'not-same') rec('[HIGH] pair ' + p.n + ' ' + p.what + ' → never "same"', r !== 'same', 'keyMatch says same (keys ' + hk.join(' / ') + ')');
  else if (c === 'not-different') rec('[MEDIUM] pair ' + p.n + ' ' + p.what + ' → not "different" (a second record would be made)', r !== 'different', 'keyMatch says different (keys ' + hk.join(' / ') + ')');
  // the database rule: not "same" → the keys must differ (or be null)
  if (c !== 'same' && c !== 'not-different') rec('pair ' + p.n + ' not same → the database keys differ (' + p.what + ')', !(hk[0] && hk[0] === hk[1]), 'both ' + hk[0]);
}

// ---- 2. seqKind on real Cienapps titles (fixture titles from tests/stage3 + tests/project-details)
const m = /function seqKind\(t\)\{[^\n]*?\}(?=\n|function)/.exec(SRC);
rec('seqKind found in index.html', !!m);
if (m) {
  const ctx = vm.createContext({}); vm.runInContext(m[0] + ';globalThis.seqKind=seqKind;', ctx);
  for (const k of FX.kinds) {
    const got = ctx.seqKind(k.t);
    if (k.expect === 'kitchen+utility') rec('[MEDIUM] seqKind("' + k.t + '") — a kitchen AND utility job is not just "utility" (a kitchen P-number in that house passes the Save re-check)', got !== 'utility', 'seqKind says ' + got);
    else rec('[HIGH] seqKind("' + k.t + '") = ' + k.expect, got === k.expect, 'seqKind says ' + got);
  }
}

// ---- 3. title suggestions (only used when Floor / Unit are blank; never "same", but a WRONG unit turns into "different")
for (const t of FX.titles) {
  const tb = B.keyTitleBits(t.t);
  if (/\?$/.test(t.expectUnit)) rec('[LOW] keyTitleBits("' + t.t + '") gives no wrong unit (it can\'t read "2.05")', tb.unit === '' || tb.unit === '2-5' || tb.unit === '205', JSON.stringify(tb));
  else rec('[MEDIUM] keyTitleBits("' + t.t + '") unit ' + t.expectUnit, tb.unit === t.expectUnit, JSON.stringify(tb));
}
// a title-read unit that is wrong hides the real job (keyFind lists "not sure" jobs only when the unit is the same)
{
  const job = B.keyOf('P1', 'T09', '', 'NO 2 BED APARTMENT 12'), typed = B.keyOf('P1', 'T09', '12', '');
  rec('[MEDIUM] a job with blank Unit, title "NO 2 BED APARTMENT 12": typed T09 / 12 is not "different"', B.keyMatch(job, typed).r !== 'different', JSON.stringify(B.keyMatch(job, typed)));
}

const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
