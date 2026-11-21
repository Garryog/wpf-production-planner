// Tester round 2 (21 Nov), hand guard FUZZ — pure functions only (no browser). suggestTpl from this branch and from origin/main
// (read with "git show", read-only) side by side, over tens of thousands of title × template name × old type name combinations
// built from type codes, hands in every spelling, bed counts, rooms and noise words. For every combination we KNOW the real code /
// hand / beds / room of both sides (we built them), so:
//   (1) green ⇒ same code AND same hand AND no bed / room contradiction (old type name included)
//   (2) green on the branch ⇒ green on main too (or listed)
//   (3) how often noise words ("LEFT ELEVATION", "OPP SIDE", "L H BYRNE"…) cost a green that the same title without them gets
// Run: node tests/batch/attack2-fuzz.test.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '../..');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 700) : '')); };
const load = html => {
  const a = html.indexOf('function sgNorm('), b = html.indexOf('/* suggestTpl:end */');
  const tn = (html.match(/function tplName\(t\)\{.*\}/) || ['function tplName(t){return t?String(t.typeName||t.name||""):"";}'])[0];
  return new Function(html.slice(a, b) + '\n' + tn + '\nreturn {suggestTpl};')();
};
const NEW = load(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
const OLD = load(cp.execSync('git -C ' + ROOT + ' show origin/main:index.html', { maxBuffer: 1 << 27 }).toString());
const P = [{ id: 'P1', name: 'Aderrig', customer: 'Aderrig Homes', cien_names: ['Aderrig Homes'] }];
const green = (api, title, ts) => { const s = api.suggestTpl({ customer: 'Aderrig Homes', title }, ts, P); return s.level === 'strong' ? s.tid : ''; };
// hands: [spelling, real hand]. KNOWN = spellings Garry / the Coder listed; ODD = real-world spellings nobody listed (a hand all the same)
const H_TITLE = [['', ''], [' H', 'H'], ['H', 'H'], [' HAND', 'H'], [' HANDED', 'H'], [' MIRROR', 'H'], [' OPP', 'H'], [' LH', 'LH'], ['LH', 'LH'], [' L/H', 'LH'], [' L.H.', 'LH'], [' L-H', 'LH'], [' L H', 'LH'], [' LHS', 'LH'], [' LEFT', 'LH'], [' LEFT HANDED', 'LH'], [' RH', 'RH'], [' R/H', 'RH'], [' R.H.', 'RH'], [' RIGHT HAND', 'RH'], [' RHS', 'RH']];
const H_ODD = [[' LHD', 'LH'], [' RHD', 'RH'], [' REVERSE', 'H'], [' REVERSED', 'H'], [' FLIPPED', 'H'], [' HND', 'H'], [' (L)', 'LH'], [' (R)', 'RH'], [' L/HAND', 'LH'], [' LFT', 'LH']];
const H_TPL = [['', ''], [' H', 'H'], [' Handed', 'H'], [' Mirrored', 'H'], [' Opp', 'H'], [' LH', 'LH'], [' L/H', 'LH'], [' L.H.', 'LH'], [' L-H', 'LH'], [' LHS', 'LH'], [' Left', 'LH'], [' Left Hand', 'LH'], [' RH', 'RH'], [' R.H.', 'RH'], [' Right', 'RH'], [' RHS', 'RH']];
const CODES = ['1', '1A', 'B', 'C2', '4C'];
const BEDS = [['', ''], [' 2 BED', '2'], [' 3 BED', '3']];
const ROOMS = [[' KITCHEN', 'kitchen'], ['', ''], [' WARDROBES', 'wardrobe']];
const NOISE = ['', ' BLOCK H', ' LEFT ELEVATION', ' OPP SIDE', ' RIGHT OF WAY', ' L H BYRNE', ' FLOOR L', ' BLOCK L H2'];
const OLDTN = [['', null], ['=', null], ['Type <c> LH', { hand: 'LH' }], ['Type <c> 3 bed', { beds: '3' }], ['Type <c> wardrobes', { room: 'wardrobe' }], ['Type 9', { code: '9' }]];
const T = (name, typeName) => ({ id: 't', pid: 'P1', name, typeName: typeName || '', tpl: true, ltype: 'kitchen', archived: false });
let n = 0, nG = 0, bad = [], promo = [], badOdd = [], noiseCost = {}, noiseBase = 0, noiseN = {};
const realBad = (tc, th, tb, tr, gc, gh, gb, gr, ot) => {
  const why = [];
  if (tc !== gc) why.push('code'); if (th !== gh) why.push('hand');
  const beds = [gb, ot && ot.beds].filter(Boolean); if (tb && beds.some(b => b !== tb)) why.push('beds');
  const rooms = ['kitchen', ot && ot.room].filter(Boolean); if (tr && rooms.some(r => r !== tr && !(tr === 'kitchen' && r === 'kitchen'))) why.push('room');
  if (ot && ot.hand && ot.hand !== th) why.push('old type name hand'); // an old type name naming ANOTHER code is Garry's Emmet Road case (4C / 4B): the name wins, so that is not a contradiction
  return why;
};
for (const tc of CODES) for (const [ths, th] of H_TITLE.concat(H_ODD)) for (const [tbs, tb] of BEDS) for (const [trs, tr] of ROOMS)
  for (const gc of [tc, tc === '1' ? '1A' : '1']) for (const [ghs, gh] of H_TPL) for (const [gbs, gb] of [['', ''], [' 3 bed', '3']]) for (const [otn, ot] of OLDTN) {
    if (gc !== tc && (gbs || otn)) continue; // other code: one sample per hand is enough
    const title = 'HOUSE 14 TYPE ' + tc + ths + tbs + trs, name = 'Type ' + gc + ghs + gbs;
    const tn = otn === '' ? '' : otn === '=' ? name : otn.replace('<c>', gc);
    const ts = [T(name, tn)];
    const g = green(NEW, title, ts); n++;
    if (g) { nG++;
      const why = realBad(tc, th, tb, tr, gc, gh, gb, '', ot && (ot.code ? { code: ot.code } : ot));
      if (why.length) (H_ODD.some(x => x[0] === ths) ? badOdd : bad).push(title + ' ⟷ "' + name + '"' + (tn && tn !== name ? ' (old type "' + tn + '")' : '') + ' [' + why.join('+') + ']');
      if (!green(OLD, title, ts)) promo.push(title + ' ⟷ "' + name + '"' + (tn && tn !== name ? ' (old type "' + tn + '")' : ''));
      // noise cost: the same title with each noise word
      if (!tbs && trs === ' KITCHEN' && !otn) { noiseBase++; for (const nz of NOISE.slice(1)) { noiseN[nz] = (noiseN[nz] || 0) + 1; if (!green(NEW, title.replace(' KITCHEN', nz + ' KITCHEN'), ts)) noiseCost[nz] = (noiseCost[nz] || 0) + 1; } }
    }
  }
console.log('INFO combinations tried: ' + n + ', green on the branch: ' + nG);
rec('sanity: the fuzz produced greens to judge', nG > 100, nG);
rec('(1) known spellings: green ⇒ same code, same hand, no bed / room contradiction (old type name included) — ' + bad.length + ' wrong greens', !bad.length, bad.slice(0, 12).join(' | '));
rec('(1b) spellings nobody listed (LHD, REVERSE, FLIPPED, HND, (L), L/HAND, LFT): a title with one of them is never green on a template of another hand — ' + badOdd.length + ' wrong greens', !badOdd.length, badOdd.slice(0, 12).join(' | '));
rec('(2) green on the branch ⇒ green on main too — ' + promo.length + ' new greens', !promo.length, promo.slice(0, 12).join(' | '));
// template-side odd spellings: a template written with an unlisted hand word, plain title
const T_ODD = [' LHD', ' RHD', ' Reverse', ' Reversed', ' Flipped', ' (L)', ' (R)', ' L/Hand', ' Lft', ' Handing', ' Mir'];
const tOdd = [];
for (const tc of CODES) for (const s of T_ODD) if (green(NEW, 'HOUSE 14 TYPE ' + tc + ' KITCHEN', [T('Type ' + tc + s)])) tOdd.push('"Type ' + tc + s + '"');
const tOddMain = tOdd.filter(x => green(OLD, 'HOUSE 14 TYPE ' + /Type (\w+)/.exec(x)[1] + ' KITCHEN', [T(x.slice(1, -1))])).length;
console.log('INFO (1c) of those, also green on origin/main: ' + tOddMain + '/' + tOdd.length);
rec('(1c) a template named with an unlisted hand word ("Type 1 LHD", "Reversed", "Flipped", "(L)"…) is never green on a plain title — ' + tOdd.length + ' wrong greens', !tOdd.length, tOdd.join(', '));
// two templates of the same code (plain + one handed) — the plain title must only ever go to the plain one
const two = [];
for (const tc of CODES) for (const [ghs, gh] of H_TPL.slice(1)) for (const [ths, th] of H_TITLE) {
  const ts = [Object.assign(T('Type ' + tc), { id: 'p' }), Object.assign(T('Type ' + tc + ghs), { id: 'h' })];
  const g = green(NEW, 'HOUSE 14 TYPE ' + tc + ths + ' KITCHEN', ts);
  if (g && (g === 'p' ? '' : gh) !== th) two.push('TYPE ' + tc + ths + ' → ' + (g === 'p' ? 'Type ' + tc : 'Type ' + tc + ghs));
}
rec('(1d) project with "Type X" + "Type X <hand>": a title only ever goes green on its own hand — ' + two.length + ' wrong', !two.length, two.slice(0, 12).join(' | '));
// (3) noise words: over-reading as a hand only costs a green. Measured as: main green, branch NOT green, for the same title + template.
// The noise words are made "known" to the old allow-list by putting them in the project's Cienapps names (as a site name would be).
const PN = [{ id: 'P1', name: 'Aderrig', customer: 'Aderrig Homes', cien_names: ['Aderrig Homes', 'ELEVATION SIDE ROAD WAY BYRNE FLOOR BLOCK OPP LEFT RIGHT'] }];
const gP = (api, title, ts) => api.suggestTpl({ customer: 'Aderrig Homes', title }, ts, PN).level === 'strong';
const cost = {}, base = {};
for (const tc of CODES) for (const [ths] of H_TITLE) for (const [ghs] of H_TPL) for (const nz of NOISE.slice(1)) {
  const ts = [T('Type ' + tc + ghs)], t0 = 'HOUSE 14 TYPE ' + tc + ths + ' KITCHEN', t1 = 'HOUSE 14' + nz + ' TYPE ' + tc + ths + ' KITCHEN', t2 = t0 + nz;
  for (const t of [t1, t2]) { if (!gP(OLD, t, ts)) continue; base[nz] = (base[nz] || 0) + 1; if (!gP(NEW, t, ts)) (cost[nz] = cost[nz] || []).push(t + ' ⟷ Type ' + tc + ghs); }
}
const nz = NOISE.slice(1).map(k => k.trim() + ' ' + ((cost[k] || []).length) + '/' + (base[k] || 0)).join(' · ');
console.log('INFO (3) noise words: green on main but NOT on the branch (cost / main greens): ' + nz);
for (const k of NOISE.slice(1)) if ((cost[k] || []).length) console.log('INFO   e.g. ' + cost[k].slice(0, 3).join(' | '));
rec('(3) "BLOCK H" before TYPE never costs a green the old code gave', !(cost[' BLOCK H'] || []).filter(t => /BLOCK H TYPE/.test(t)).length, (cost[' BLOCK H'] || []).slice(0, 4).join(' | '));
rec('(3) info: what the other noise words cost (safe direction — a person confirms singly)', true, nz);
// real-looking titles: what reads as a hand where there is none
const real = ['BLK A SF KITCHEN 31 TYPE 1', 'HOUSE 12 TYPE B KITCHEN LEFT ELEVATION', 'APT 4 FLOOR L TYPE 2 KITCHEN', 'TYPE 3 KITCHEN OPP SIDE OF ROAD', 'HOUSE 7 RIGHT OF WAY TYPE C KITCHEN', 'J L H BYRNE TYPE 2 KITCHEN', 'BLOCK L H2 TYPE 1A KITCHEN', 'HOUSE 9 TYPE A KITCHEN (LEFT)', 'TYPE 2 KITCHEN LEFT OVER UNITS'];
console.log('INFO real-looking titles vs their plain template: ' + real.map(t => { const c = /TYPE (\w+)/.exec(t)[1]; return t + ' → ' + (green(NEW, t, [T('Type ' + c)]) ? 'green' : 'amber') + (green(OLD, t, [T('Type ' + c)]) ? ' (main green)' : ' (main amber)'); }).join(' | '));
const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
