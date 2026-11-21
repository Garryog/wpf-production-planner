// Tester round 3 (21 Nov): the amber best guess for handed units (commit dd59934). Pure functions only, branch and origin/main side by
// side. For every title (code × hand spelling × beds) and every project template set (that code in several hands and spellings,
// plus decoys), when an exact-hand template that fits exists:
//   - the suggestion IS that template (or one of them), never a template of another hand
//   - a handed title is never green; nothing is green that main did not make green
// Run: node tests/batch/attack3-fuzz.test.js   (the round-2 fuzz, attack2-fuzz.test.js, still covers green ⇒ same code/hand/beds/room)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '../..');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 700) : '')); };
const load = html => { const a = html.indexOf('function sgNorm('), b = html.indexOf('/* suggestTpl:end */');
  const tn = (html.match(/function tplName\(t\)\{.*\}/) || ['function tplName(t){return t?String(t.typeName||t.name||""):"";}'])[0];
  return new Function(html.slice(a, b) + '\n' + tn + '\nreturn {suggestTpl};')(); };
const NEW = load(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
const OLD = load(cp.execSync('git -C ' + ROOT + ' show origin/main:index.html', { maxBuffer: 1 << 27 }).toString());
const P = [{ id: 'P1', name: 'Aderrig', customer: 'Aderrig Homes', cien_names: ['Aderrig Homes'] }];
const sug = (api, title, ts) => api.suggestTpl({ customer: 'Aderrig Homes', title }, ts, P);
const TH = { '': [''], H: [' H', 'H', ' HAND', ' HANDED', ' MIRROR', ' MIRRORED', ' OPP', ' OPPOSITE'], LH: [' LH', 'LH', ' L/H', ' L.H.', ' L-H', ' L H', ' LHS', ' LEFT', ' LEFT HAND', ' LEFT HANDED'], RH: [' RH', ' R/H', ' R.H.', ' RHS', ' RIGHT', ' RIGHT HANDED'] };
const GH = { '': [''], H: [' H', ' Handed', ' Mirrored', ' Opp'], LH: [' LH', ' L/H', ' L.H.', ' Left Hand', ' LHS'], RH: [' RH', ' R.H.', ' Right', ' RHS'] };
const CODES = ['1', '1A', 'B', 'C2'];
const HANDS = ['', 'H', 'LH', 'RH'];
let n = 0, nEx = 0, wrong = [], notExact = [], greenHanded = [], promo = [], seed = 7;
const rnd = k => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; };
for (const tc of CODES) for (const th of HANDS) for (const ts of TH[th]) for (const [tbs, tb] of [['', ''], [' 2 BED', '2'], [' 3 BED', '3']]) {
  const title = 'HOUSE 14 TYPE ' + tc + ts + tbs + ' KITCHEN';
  // 12 random template sets of that code: each hand present or not, a random spelling, a random bed count; plus a decoy of another code
  for (let k = 0; k < 12; k++) {
    const set = [];
    HANDS.forEach(h => { if (h === th || rnd(2)) { const sp = GH[h][rnd(GH[h].length)], bd = ['', ' 2 bed', ' 3 bed'][rnd(3)]; set.push({ id: 'T' + (h || 'P') + set.length, pid: 'P1', name: 'Type ' + tc + sp + bd, typeName: '', tpl: true, ltype: 'kitchen', archived: false, _h: h, _b: bd.trim().slice(0, 1) }); } });
    set.push({ id: 'Tdecoy', pid: 'P1', name: 'Type ' + (tc === '1' ? '2' : '1') + GH[th][0], typeName: '', tpl: true, ltype: 'kitchen', archived: false, _h: 'x', _b: '' });
    if (rnd(2)) set.reverse();
    const s = sug(NEW, title, set); n++;
    const exact = set.filter(t => t._h === th && (!t._b || !tb || t._b === tb));
    const pick = set.find(t => t.id === s.tid);
    if (s.level === 'strong' && th) greenHanded.push(title + ' → ' + (pick && pick.name));
    if (s.level === 'strong' && sug(OLD, title, set).level !== 'strong') promo.push(title + ' → ' + (pick && pick.name));
    if (!exact.length) continue;
    nEx++;
    if (pick && pick._h !== th) wrong.push(title + ' → "' + pick.name + '" though ' + exact.map(t => '"' + t.name + '"').join('/') + ' exists [' + s.level + ': ' + s.why + ']');
    else if (!pick || !exact.includes(pick)) notExact.push(title + ' → ' + (pick ? '"' + pick.name + '"' : 'no suggestion') + ' though ' + exact.map(t => '"' + t.name + '"').join('/') + ' exists [' + s.level + ': ' + s.why + ']');
  }
}
{ const g = {}; notExact.forEach(x => { const k = /TYPE (\S+)/.exec(x)[1]; g[k] = (g[k] || 0) + 1; }); console.log('INFO not-exact cases by title type token: ' + JSON.stringify(g)); }
console.log('INFO ' + n + ' title × template-set cases; ' + nEx + ' with a fitting exact-hand template');
rec('when an exact-hand template that fits exists, a template of ANOTHER hand is never suggested — ' + wrong.length + ' cases', !wrong.length, wrong.slice(0, 8).join(' | '));
rec('… and the suggestion is the exact-hand template (not nothing, not another) — ' + notExact.length + ' cases', !notExact.length, notExact.slice(0, 8).join(' | '));
rec('a handed title (any spelling) is never green — ' + greenHanded.length, !greenHanded.length, greenHanded.slice(0, 6).join(' | '));
rec('nothing is green on the branch that origin/main did not make green — ' + promo.length, !promo.length, promo.slice(0, 6).join(' | '));
// the plain title: never a handed template suggested when the plain one exists and fits
const plainBad = [];
for (const tc of CODES) for (const gh of ['H', 'LH', 'RH']) for (const sp of GH[gh]) {
  const set = [{ id: 'Tp', pid: 'P1', name: 'Type ' + tc, typeName: '', tpl: true, ltype: 'kitchen', archived: false }, { id: 'Th', pid: 'P1', name: 'Type ' + tc + sp + ' kitchen island', typeName: '', tpl: true, ltype: 'kitchen', archived: false }];
  const s = sug(NEW, 'HOUSE 14 TYPE ' + tc + ' KITCHEN ISLAND', set); if (s.tid === 'Th') plainBad.push('TYPE ' + tc + ' KITCHEN ISLAND → "Type ' + tc + sp + ' kitchen island" [' + s.level + ']');
}
rec('plain title that shares extra words with a HANDED template ("ISLAND") still suggests the plain one — ' + plainBad.length, !plainBad.length, plainBad.slice(0, 6).join(' | '));
const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
