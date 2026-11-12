// B0 matching key (Job B part 3, step 1): the one rule for "the same house" — project + floor + unit — gives the answers in
// tests/seq/b0-pairs.json (the SAME file pg-check.sql checks the database against), in node AND inside the loaded app.
// Run: node tests/seq/b0-key.test.js
const fs = require('fs'), path = require('path');
const B = require('./b0lib.js');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'b0-pairs.json'), 'utf8'));
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const side = (K, s) => K.keyOf(s.p, s.floor, s.unit, s.title || '');
// everything the fixture asks, computed with one set of functions (node or the page) → plain JSON to compare
function answers(K, FX) {
  return {
    pairs: FX.pairs.map(c => { const a = K.keyOf(c.a.p, c.a.floor, c.a.unit, c.a.title || ''), b = K.keyOf(c.b.p, c.b.floor, c.b.unit, c.b.title || '');
      const m1 = K.keyMatch(a, b), m2 = K.keyMatch(b, a);
      return { n: c.n, r: m1.r, r2: m2.r, why: m1.why, hk: [K.keyHouseStr(c.a.floor, c.a.unit), K.keyHouseStr(c.b.floor, c.b.unit)] }; }),
    lines: FX.lines.map(l => ({ n: l.n, lk: K.keyLineStr(l.f, l.u, l.p, l.name) })),
  };
}
const N = answers(B, FX);
FX.pairs.forEach((c, i) => {
  const g = N.pairs[i];
  rec('pair ' + c.n + ' ' + c.what + ': ' + c.r, g.r === c.r && g.r2 === c.r, JSON.stringify(g));
  rec('pair ' + c.n + ' house keys ' + JSON.stringify(c.hk), JSON.stringify(g.hk) === JSON.stringify(c.hk), JSON.stringify(g.hk));
  // what SQL can check must hold: within one project, a pair that is not "same" never shares a house key, and a "same" pair
  // with both parts present always does
  if (!c.jsOnly) {
    if (c.r !== 'same') rec('pair ' + c.n + ': not same → never the same non-null house key', g.hk[0] == null || g.hk[0] !== g.hk[1], JSON.stringify(g.hk));
    else rec('pair ' + c.n + ': same → the same house key', g.hk[0] != null && g.hk[0] === g.hk[1], JSON.stringify(g.hk));
  }
});
FX.lines.forEach((l, i) => rec('line ' + l.n + ' ' + l.what + ' → ' + JSON.stringify(l.lk), N.lines[i].lk === l.lk, JSON.stringify(N.lines[i].lk)));
// the parts on their own
rec('keyTxt: NFKC, zero-width out, punctuation → one space, upper', B.keyTxt(' ｔ​09 -- apt. 7 ') === 'T09 APT 7', B.keyTxt(' ｔ​09 -- apt. 7 '));
rec('keyTxt: accents → base letters, ß → SS, other letters → spaces (Postgres does the same)', B.keyTxt('Ré-sidence ß Ωx') === 'RE SIDENCE SS X', B.keyTxt('Ré-sidence ß Ωx'));
rec('keyTxtD: a dot between digits kept, others gone; # is not kept', B.keyTxtD('Apt. 2.05 #3 1.2.3') === 'APT 2.05 3 1.2.3', B.keyTxtD('Apt. 2.05 #3 1.2.3'));
rec('keyTitleBits: NO 2 BED APARTMENT 12 → 12; UNIT 2 OF 4 APT 9 → 9; APT 2.05 → 2.05', B.keyTitleBits('NO 2 BED APARTMENT 12').unit === '12' && B.keyTitleBits('UNIT 2 OF 4 APT 9').unit === '9' && B.keyTitleBits('APT 2.05 TYPE A 2 BED KITCHEN').unit === '2.05');
rec('keyCode: T 09 = T09 = T9; lone 0 kept; 12-14', B.keyCode('T 09') === 'T-9' && B.keyCode('t9') === 'T-9' && B.keyCode('0') === '0' && B.keyCode('A00') === 'A-0' && B.keyCode('12-14') === '12-14');
rec('keyCode of nothing is blank', B.keyCode('') === '' && B.keyCode(null) === '' && B.keyCode(' - ') === '');
const fl = s => { const f = B.keyFloor(s); return f.t + ':' + f.k + (f.lvl != null && f.t === 'amb' ? '/' + f.lvl : ''); };
rec('keyFloor kinds', JSON.stringify(['GF', 'G', 'L1', 'Block G', 'Basement', 'T09', '', 'third floor', 'Level 02', '000'].map(fl)) === JSON.stringify(['lvl:0', 'amb:G/0', 'amb:L-1/1', 'code:G', 'lvl:-1', 'code:T-9', ':', 'lvl:3', 'lvl:2', 'lvl:0']), JSON.stringify(['GF', 'G', 'L1', 'Block G', 'Basement', 'T09', '', 'third floor', 'Level 02', '000'].map(fl)));
rec('keyUnit: prefixes off (also glued), zeros off, letters kept', JSON.stringify(['Apt 7', 'APT07', 'No.7', 'Unit No 007', '7 a', 'House 12B', 'Pos 3', 'T09', '0', ''].map(B.keyUnit)) === JSON.stringify(['7', '7', '7', '7', '7A', '12B', '3', 'T-9', '0', '']));
rec('keyUnit: a word starting NO is not the NO prefix (NORTH 7)', B.keyUnit('NORTH 7') === 'NORTH-7', B.keyUnit('NORTH 7'));
const tb = t => JSON.stringify(B.keyTitleBits(t));
rec('keyTitleBits: BLOCK T09 APT 12 HOUSE TYPE B', tb('BLOCK T09 APT 12 HOUSE TYPE B') === '{"floor":"BLOCK T09","unit":"12"}', tb('BLOCK T09 APT 12 HOUSE TYPE B'));
rec('keyTitleBits: HOUSE TYPE B is not a unit; nothing found', tb('HOUSE TYPE B KITCHEN') === '{"floor":"","unit":""}', tb('HOUSE TYPE B KITCHEN'));
rec('keyTitleBits: GROUND FLOOR UNIT 3 / 1ST FLOOR APT4 / GF NO 7', tb('Ground floor unit 3') === '{"floor":"0","unit":"3"}' && tb('1st floor apt4') === '{"floor":"1ST","unit":"4"}' && tb('GF No 7') === '{"floor":"0","unit":"7"}', [tb('Ground floor unit 3'), tb('1st floor apt4'), tb('GF No 7')].join(' '));
rec('keyTitleBits: TYPE 3 skipped (a house type number is not a unit)', tb('HOUSE TYPE 3 PLOT 9') === '{"floor":"","unit":"9"}', tb('HOUSE TYPE 3 PLOT 9'));
rec('title values only fill a BLANK floor / unit (own values win)', (k => k.f.k === 'T-10' && k.u === '5' && !k.src.f && !k.src.u)(B.keyOf('P1', 'T10', '5', 'BLOCK T09 APT 12')));
// keyProj / jobKey with the app's helpers stubbed
const K2 = B.load({ lsProjForCust: c => /aderrig/i.test(c) ? { id: 'P1' } : null, fuF: o => String(o.floor || o.f || '').trim(), fuU: o => String(o.unit || o.u || '').trim() });
rec('keyProj: own pid first, then customer → project, else unknown', K2.keyProj({ pid: 'P9', customer: 'Aderrig Homes' }) === 'P9' && K2.keyProj({ customer: 'Aderrig Homes' }) === 'P1' && K2.keyProj({ customer: 'Nobody' }) === '' && K2.keyProj(null) === '');
rec('jobKey: planner values (fuF/fuU, old f/u rows too), title only for blanks', (k => k.p === 'P1' && k.f.k === 'T-9' && k.u === '12' && k.src.u === 'title')(K2.jobKey({ customer: 'Aderrig Homes', f: 'T09', title: 'APT 12' })));
rec('seqRowKey: project_id, floor, unit — never a title', (k => k.p === 'P1' && k.f.k === 'T-9' && k.u === '' && !k.src.u)(K2.seqRowKey({ project_id: 'P1', floor: 'T09', unit: '', name: 'APT 12' })));
rec('keyMatch is symmetric over the whole fixture', N.pairs.every(g => g.r === g.r2));
// 1,200 awkward strings (tests/seq/b0-fuzz.json — pg-check.sql checks the database against the same file)
{ const FZ = JSON.parse(fs.readFileSync(path.join(__dirname, 'b0-fuzz.json'), 'utf8'));
  const bad = FZ.filter(x => B.keyFloorStr(B.keyFloor(x.s)) !== x.f || B.keyUnit(x.s) !== x.u || B.keyTxt(x.s) !== x.t || B.keyCode(x.s) !== x.c);
  rec('fuzz: ' + FZ.length + ' awkward strings still give the stored keys', FZ.length >= 1000 && !bad.length, JSON.stringify(bad.slice(0, 3))); }

// ---- the same answers from the functions inside the loaded app (fake Supabase, no network)
(async () => {
  const X = require('../listwin/fixl.js');
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer();
    const t = await X.dev(browser, S, 'office');
    const inApp = await t.page.evaluate(({ src, FX }) => { const answers = new Function('return ' + src)(); return answers(window, FX); }, { src: answers.toString(), FX });
    rec('in the app: every pair and line gives the same answer as node', JSON.stringify(inApp) === JSON.stringify(N), JSON.stringify(inApp).slice(0, 300));
    const app = await t.page.evaluate(() => ({ p1: keyProj({ customer: 'Aderrig Homes' }), p2: keyProj({ customer: 'Lucan Homes' }), none: keyProj({ customer: 'Somebody Else Ltd' }),
      own: keyProj({ pid: 'P2', customer: 'Aderrig Homes' }), wo3: (k => [k.p, k.f.k, k.u].join('/'))(jobKey(DB.orders.find(o => o.wo === 'WO-3'))), rk: typeof rowKey === 'function' && rowKey({ k: 'saw', item: 'A' }) }));
    rec('in the app: keyProj uses the project links (Aderrig → P1, Lucan → P2, unknown → blank, own pid first)', app.p1 === 'P1' && app.p2 === 'P2' && app.none === '' && app.own === 'P2', JSON.stringify(app));
    rec('in the app: jobKey(WO-3) = P1 / T-9 / 13', app.wo3 === 'P1/T-9/13', app.wo3);
    rec('in the app: the saw/stores rowKey is untouched', app.rk === 'saw|a||||', JSON.stringify(app.rk));
    rec('in the app: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } finally { await browser.close(); }
  const f = res.filter(x => !x).length; console.log('\n' + (res.length - f) + ' passed, ' + f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
