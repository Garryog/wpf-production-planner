// Tester attack (20 Nov), part B: the hand guard — pure functions only (no browser), taken straight out of index.html on this
// branch AND out of origin/main (read with "git show", read-only) so every case is shown on both.
// Run: node tests/batch/attack-handguard-pure.test.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '../..');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const load = html => {
  const a = html.indexOf('function sgNorm('), b = html.indexOf('/* suggestTpl:end */');
  const tn = (html.match(/function tplName\(t\)\{.*\}/) || ['function tplName(t){return t?String(t.typeName||t.name||""):"";}'])[0];
  const has = html.includes('function typeKey(');
  return new Function(html.slice(a, b) + '\n' + tn + '\nreturn {suggestTpl' + (has ? ',typeKey,tkLbl' : '') + '};')();
};
const NEW = load(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
let OLD = null;
try { OLD = load(cp.execSync('git -C ' + ROOT + ' show origin/main:index.html', { maxBuffer: 1 << 27 }).toString()); } catch (e) { rec('origin/main code could be read with git show', false, e.message); }
const { typeKey } = NEW;
const K = (s, t) => { const k = typeKey(s, !!t); return k.code + '|' + k.hand + (k.why ? '|' + k.why : ''); };
const P = [{ id: 'P1', name: 'Aderrig', customer: 'Aderrig Homes', cien_names: ['Aderrig Homes'] }];
const T = (id, name, extra) => Object.assign({ id, pid: 'P1', name, typeName: '', tpl: true, ltype: 'kitchen', archived: false }, extra || {});
const sug = (api, title, ts) => api.suggestTpl({ customer: 'Aderrig Homes', title }, ts, P);
const green = (api, title, ts) => { const s = sug(api, title, ts); return s.level === 'strong' ? s.tid : ''; };

// ---------- 1. the LIVE hole, shown with a test on origin/main, and closed on the branch (both directions) ----------
const holes = [
  ['plain title, only "Type 1 LH"', 'HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 LH')]],
  ['plain title, only "Type 1 RH"', 'HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 RH')]],
  ['plain title, only "Type 1 H"', 'HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 H')]],
  ['plain title, only "Type 1 Handed"', 'HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 Handed')]],
  ['handed title "TYPE 1 HANDED", only plain "Type 1"', 'HOUSE 14 TYPE 1 HANDED KITCHEN', [T('a', 'Type 1')]],
  ['handed title "TYPE 1A H", only plain "Type 1A"', 'HOUSE 14 TYPE 1A H KITCHEN', [T('a', 'Type 1A')]],
];
for (const [n, title, ts] of holes) {
  if (OLD) { const o = sug(OLD, title, ts); rec('origin/main: ' + n + ' → ' + o.level + ' (shows whether the live code has this hole)', true, JSON.stringify({ level: o.level, why: o.why })); }
  rec('branch: ' + n + ' → never green', !green(NEW, title, ts), JSON.stringify(sug(NEW, title, ts)));
}
if (OLD) {
  rec('origin/main REALLY has the hole: plain "TYPE 1" goes GREEN against the only template "Type 1 LH"', green(OLD, 'HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 LH')]) === 'a', JSON.stringify(sug(OLD, 'HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 LH')])));
  // the reverse (handed title, plain template) is already amber on main: the round-4 allow-list (sgAllow) refuses an unknown title word "H"
  rec('origin/main: the reverse ("TYPE 1A H" vs only "Type 1A") is already NOT green (sgAllow: title also says "H")', !green(OLD, 'HOUSE 14 TYPE 1A H KITCHEN', [T('a', 'Type 1A')]), JSON.stringify(sug(OLD, 'HOUSE 14 TYPE 1A H KITCHEN', [T('a', 'Type 1A')])));
}

// ---------- 2. every title form the task lists ----------
const titles = [
  ['TYPE 1A H', '1A|H'], ['TYPE 1AH', '1A|H'], ['TYPE 1A-H', '1A|H'], ['TYPE 1 HANDED', '1|H'], ['TYPE 2 LH', '2|LH'], ['TYPE 2 L/H', '2|LH'],
  ['TYPE 2 LEFT HANDED', '2|LH'], ['TYPE 1LH', '1|LH'], ['TYPE B RH 3 BED', 'B|RH'], ['type 1a h', '1A|H'], ['TYPE 1A H   ', '1A|H'],
  ['HOUSE 14 TYPE 2', '2|'], ['BLOCK H TYPE 2', '2|'], ['4H BLOCK TYPE 2', '2|'], ['TYPE AH', 'AH|'], ['TYPE H', 'H|'],
];
for (const [t, want] of titles) rec('typeKey("' + t + '") → ' + want, K(t).startsWith(want) && !/hand unclear/.test(K(t)), K(t));
// ambiguous ones: never read as a plain standard unit silently
rec('"TYPE 2 H BLOCK" reads H (the hand straight after) — never plain', typeKey('TYPE 2 H BLOCK').hand === 'H', K('TYPE 2 H BLOCK'));
rec('"HOUSE 14" alone: no type', !typeKey('HOUSE 14').code, K('HOUSE 14'));
rec('"BLOCK H" alone: no type and no hand', !typeKey('BLOCK H').code && !typeKey('BLOCK H').hand, K('BLOCK H'));
rec('two TYPE words "TYPE 1 TYPE 2" → reason "two types"', typeKey('TYPE 1 TYPE 2').why === 'two types', K('TYPE 1 TYPE 2'));
rec('hand before TYPE "LH TYPE 2" → hand unclear', typeKey('LH TYPE 2').why === 'hand unclear', K('LH TYPE 2'));
rec('hand before TYPE "HANDED TYPE 2" → hand unclear', typeKey('HANDED TYPE 2').why === 'hand unclear', K('HANDED TYPE 2'));
// templates
for (const [t, want] of [['T2 LH', '2|LH'], ['Type 2 LH', '2|LH'], ['2 LH', '2|LH'], ['1A H', '1A|H'], ['Type 1A Handed', '1A|H'], ['1A', '1A|'], ['T2', '2|']])
  rec('template typeKey("' + t + '") → ' + want, K(t, 1) === want, K(t, 1));

// ---------- 3. hand spellings the reader does NOT know: a handed TEMPLATE name read as STANDARD → green on a plain title ----------
// (sgAllow already turns the TITLE amber for most of these — an unknown title word — but a template's own odd words are not checked)
const odd = ['Type 1 L.H.', 'Type 1 L-H', 'Type 1 L H', 'Type 1 R.H.', 'Type 1 LHS', 'Type 1 RHS', 'Type 1 Left', 'Type 1 Mirror', 'Type 1 Mirrored', 'Type 1 Opp Hand'];
for (const nm of odd) {
  const g = green(NEW, 'HOUSE 14 TYPE 1 KITCHEN', [T('a', nm)]);
  rec('branch: plain "TYPE 1" vs the only template "' + nm + '" (a handed template) → not green', !g, 'typeKey=' + K(nm, 1) + ' suggest=' + JSON.stringify(sug(NEW, 'HOUSE 14 TYPE 1 KITCHEN', [T('a', nm)])));
}
// and the TITLE side for the same spellings, against a plain template
for (const tt of ['TYPE 1 L.H.', 'TYPE 1 L-H', 'TYPE 1 LHS', 'TYPE 1 MIRROR', 'TYPE 1 LEFT']) {
  const g = green(NEW, 'HOUSE 14 ' + tt + ' KITCHEN', [T('a', 'Type 1')]);
  rec('branch: title "' + tt + '" vs plain "Type 1" → not green', !g, 'typeKey=' + K(tt) + ' ' + JSON.stringify(sug(NEW, 'HOUSE 14 ' + tt + ' KITCHEN', [T('a', 'Type 1')])));
}

// ---------- 4. projects with only handed, only plain, both ----------
const onlyH = [T('h', 'Type 1A H'), T('l', 'Type 1A LH')], onlyP = [T('p', 'Type 1A')], both = [T('p', 'Type 1A'), T('h', 'Type 1A H'), T('l', 'Type 1A LH'), T('r', 'Type 1A RH')];
const mat = [['TYPE 1A', { onlyH: '', onlyP: 'p', both: '' }], ['TYPE 1A H', { onlyH: 'h', onlyP: '', both: 'h' }], ['TYPE 1A LH', { onlyH: 'l', onlyP: '', both: 'l' }], ['TYPE 1A RH', { onlyH: '', onlyP: '', both: 'r' }]];
const hnd = id => ({ p: '', h: 'H', l: 'LH', r: 'RH' })[id];
const exact = [];
for (const [tt, w] of mat) for (const [pn, ts] of [['onlyH', onlyH], ['onlyP', onlyP], ['both', both]]) {
  const g = green(NEW, 'HOUSE 14 ' + tt + ' KITCHEN', ts), th = typeKey(tt).hand;
  rec('project ' + pn + ': "' + tt + '" → never green on a template of another hand', !g || hnd(g) === th, g + ' ' + sug(NEW, 'HOUSE 14 ' + tt + ' KITCHEN', ts).why);
  if (w[pn] && g !== w[pn]) exact.push(pn + ':' + tt + ' (' + sug(NEW, 'HOUSE 14 ' + tt + ' KITCHEN', ts).why + ')');
}
// usability (not safety): a unit titled with H / LH / RH is never green even against its exact-hand template — every handed unit
// is confirmed one by one. Same on origin/main (the round-4 allow-list refuses a title word shorter than 3 letters it doesn't know).
// (round 2, decided 21 Nov) a handed unit is NOT green even on its exact-hand template: it stays amber WITH a reason and is confirmed singly
const exactR = []; for (const [tt, w] of mat) for (const [pn, ts] of [['onlyH', onlyH], ['both', both]]) if (w[pn]) { const r = sug(NEW, 'HOUSE 14 ' + tt + ' KITCHEN', ts); exactR.push([pn + ':' + tt, r.level, r.why]); }
rec('decided: "TYPE 1A H" / "LH" / "RH" vs their exact-hand template → amber with a reason (confirmed singly), never green', exactR.every(([, l, why]) => l !== 'strong' && /check it|hand|title also says/.test(why)), exactR.map(x => x.join(' ')).join(' | '));
if (OLD) rec('origin/main: "TYPE 1A LH" vs exact "Type 1A LH" is also not green (so this is not new)', !green(OLD, 'HOUSE 14 TYPE 1A LH KITCHEN', [T('l', 'Type 1A LH')]), sug(OLD, 'HOUSE 14 TYPE 1A LH KITCHEN', [T('l', 'Type 1A LH')]).why);
// "both" with plain "TYPE 1A" where only an H (no LH/RH) exists next to the plain one: plain = standard → green on the plain one
rec('plain "TYPE 1A" with "1A" + "1A H" (no LH/RH) → green on "1A" (plain = standard, Garry)', green(NEW, 'HOUSE 14 TYPE 1A KITCHEN', [T('p', 'Type 1A'), T('h', 'Type 1A H')]) === 'p', sug(NEW, 'HOUSE 14 TYPE 1A KITCHEN', [T('p', 'Type 1A'), T('h', 'Type 1A H')]).why);

// ---------- 5. part C side effect: what the old hidden type name used to STOP ----------
// A template named "Type 2" whose hidden type name says "Type 2 3 bed": on main, a "2 BED" title was refused (bed count clash).
const t3 = [T('a', 'Type 2', { typeName: 'Type 2 3 bed' })];
if (OLD) rec('origin/main: "TYPE 2 2 BED" vs template "Type 2" (type name "Type 2 3 bed") → NOT green (bed clash read from the type name)', !green(OLD, 'HOUSE 14 TYPE 2 2 BED KITCHEN', t3), JSON.stringify(sug(OLD, 'HOUSE 14 TYPE 2 2 BED KITCHEN', t3)));
rec('branch: the same → still not green (a 3-bed list on a 2-bed house)', !green(NEW, 'HOUSE 14 TYPE 2 2 BED KITCHEN', t3), JSON.stringify(sug(NEW, 'HOUSE 14 TYPE 2 2 BED KITCHEN', t3)));
const tw = [T('a', 'Type 2', { typeName: 'Type 2 Wardrobes', ltype: 'house' })];
if (OLD) rec('origin/main: "TYPE 2 KITCHEN" vs template "Type 2" (type name "Type 2 Wardrobes") → not green', !green(OLD, 'HOUSE 14 TYPE 2 KITCHEN', tw), JSON.stringify(sug(OLD, 'HOUSE 14 TYPE 2 KITCHEN', tw)));
rec('branch: the same → still not green (a wardrobe list on a kitchen)', !green(NEW, 'HOUSE 14 TYPE 2 KITCHEN', tw), JSON.stringify(sug(NEW, 'HOUSE 14 TYPE 2 KITCHEN', tw)));
const tl = [T('a', 'Type 2', { typeName: 'Type 2 LH' })];
if (OLD) rec('origin/main: plain "TYPE 2" vs template "Type 2" (type name "Type 2 LH") → ' + sug(OLD, 'HOUSE 14 TYPE 2 KITCHEN', tl).level, true);
rec('decided (round 2): plain "TYPE 2" vs template "Type 2" whose hidden type name says "Type 2 LH" → amber, the reason names the old type name', !green(NEW, 'HOUSE 14 TYPE 2 KITCHEN', tl) && /old type name says/.test(sug(NEW, 'HOUSE 14 TYPE 2 KITCHEN', tl).why), sug(NEW, 'HOUSE 14 TYPE 2 KITCHEN', tl).why);
// a template whose name has no type but whose type name had one stops matching (safe direction — fewer greens)
const tn = [T('a', 'Kitchen layout A', { typeName: 'Type B' })];
if (OLD) rec('origin/main: "TYPE B" vs template "Kitchen layout A" (type name "Type B") → ' + sug(OLD, 'HOUSE 14 TYPE B KITCHEN', tn).level, true);
rec('branch: the same → no longer green (stops matching; safe direction)', !green(NEW, 'HOUSE 14 TYPE B KITCHEN', tn), sug(NEW, 'HOUSE 14 TYPE B KITCHEN', tn).level);

const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
