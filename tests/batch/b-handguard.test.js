// Part B (Garry 20 Nov): the hand guard in "✓ Confirm all green" (suggestTpl) + typeKey. Pure functions are taken straight
// out of index.html (no browser); the single ✓ Confirm question is checked in the app on the fake Supabase.
// Run: node tests/batch/b-handguard.test.js
const fs = require('fs'), path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const a = HTML.indexOf('function sgNorm('), b = HTML.indexOf('/* suggestTpl:end */');
const tn = HTML.match(/function tplName\(t\)\{.*\}/)[0];
const api = new Function(HTML.slice(a, b) + '\n' + tn + '\nreturn {typeKey,suggestTpl,tkLbl};')();
const { typeKey, suggestTpl } = api;
const K = (s, t) => { const k = typeKey(s, !!t); return k.code + '|' + k.hand + (k.why ? '|' + k.why : ''); };
const eq = (n, got, want) => rec(n + ' → ' + want, got === want, got);
// titles
eq('"BLK A SF KITCHEN 31 TYPE 1 HANDED"', K('BLK A SF KITCHEN 31 TYPE 1 HANDED'), '1|H');
eq('"TYPE 1A"', K('HOUSE 14 TYPE 1A KITCHEN'), '1A|');
eq('"TYPE 1A H"', K('HOUSE 14 TYPE 1A H KITCHEN'), '1A|H');
eq('"TYPE 1AH"', K('HOUSE 14 TYPE 1AH KITCHEN'), '1A|H');
eq('"TYPE 1A-H"', K('HOUSE 14 TYPE 1A-H KITCHEN'), '1A|H');
eq('"TYPE 1A HAND"', K('TYPE 1A HAND'), '1A|H');
eq('"TYPE 2 LH"', K('TYPE 2 LH KITCHEN'), '2|LH');
eq('"TYPE 2 L/H"', K('TYPE 2 L/H'), '2|LH');
eq('"TYPE 2LH"', K('TYPE 2LH'), '2|LH');
eq('"TYPE 2 LEFT HANDED"', K('TYPE 2 LEFT HANDED'), '2|LH');
eq('"TYPE 2 RIGHT HAND"', K('TYPE 2 RIGHT HAND'), '2|RH');
eq('"TYPE 2 R/H"', K('TYPE 2 R/H'), '2|RH');
eq('"TYPE B-1"', K('TYPE B-1 KITCHEN'), 'B1|');
eq('"HOUSE 14 TYPE C" (HOUSE is not a hand)', K('HOUSE 14 TYPE C'), 'C|');
eq('"BLOCK H TYPE 2" (BLOCK H is not a hand)', K('BLOCK H TYPE 2 KITCHEN'), '2|');
eq('"4H BLOCK TYPE 2"', K('4H BLOCK TYPE 2'), '2|');
eq('"HANDED" before TYPE', K('HANDED HOUSE 14 TYPE 2'), '2||hand unclear');
eq('"LH" at the end, not straight after the type', K('TYPE 2 KITCHEN LH'), '2||hand unclear');
eq('two different hands', K('TYPE 2 H LH'), '2|H|hand unclear');
eq('no TYPE', K('ADERRIG BLOCK C1.2 _1ST_FL APT_31 PART V KITCHENS'), '||no TYPE in the title');
eq('"TYPE 1 HANDED" spelled "handed" lower case', K('type 1 handed'), '1|H');
// templates
eq('template "1A H"', K('1A H', 1), '1A|H');
eq('template "1A"', K('1A', 1), '1A|');
eq('template "T2" = TYPE 2', K('T2', 1), '2|');
eq('template "T2 LH"', K('T2 LH', 1), '2|LH');
eq('template "Type 1 Handed"', K('Type 1 Handed', 1), '1|H');
eq('template "Kitchen A"', K('Kitchen A', 1), 'A|');
eq('template "3 bed 4C"', K('3 bed 4C', 1), '4C|');
eq('template "Island kitchen" doesn\'t read as a type', K('Island kitchen', 1), "||name doesn't read as a type");
// suggestTpl
const P = [{ id: 'P1', name: 'Aderrig', customer: 'Aderrig Homes', cien_names: ['Aderrig Homes'] }];
const T = (id, name, extra) => Object.assign({ id, pid: 'P1', name, typeName: '', tpl: true, ltype: 'kitchen', archived: false }, extra || {});
const S = (title, ts) => suggestTpl({ customer: 'Aderrig Homes', title }, ts, P);
let s = S('HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 LH')]);
rec('LIVE HOLE: plain "TYPE 1" is never green against the only template "Type 1 LH"', s.level !== 'strong', JSON.stringify(s));
s = S('HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1 Handed')]);
rec('plain "TYPE 1" vs "Type 1 Handed" → not green', s.level !== 'strong', JSON.stringify(s));
s = S('HOUSE 14 TYPE 1 HANDED KITCHEN', [T('a', 'Type 1')]);
rec('"TYPE 1 HANDED" vs plain "Type 1" → not green', s.level !== 'strong', JSON.stringify(s));
s = S('HOUSE 14 TYPE 1 HANDED KITCHEN', [T('a', 'Type 1 Handed')]);
rec('"TYPE 1 HANDED" vs "Type 1 Handed" → still green', s.level === 'strong', JSON.stringify(s));
s = S('HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1')]);
rec('"TYPE 1" vs "Type 1" → still green', s.level === 'strong' && s.tid === 'a', JSON.stringify(s));
s = S('HOUSE 14 TYPE 1 KITCHEN', [T('a', 'Type 1'), T('b', 'Type 1 LH'), T('c', 'Type 1 RH')]);
rec('plain "TYPE 1" where 1 LH / 1 RH exist → amber "hand not known — confirm singly"', s.level === 'weak' && /hand not known/.test(s.why), JSON.stringify(s));
s = S('HOUSE 14 TYPE 2 KITCHEN', [T('a', 'Type 1'), T('b', 'Type 1 LH'), T('c', 'Type 2')]);
rec('… another type in the same project is not affected (TYPE 2 green)', s.level === 'strong' && s.tid === 'c', JSON.stringify(s));
s = S('BLOCK H HOUSE 14 TYPE 2 KITCHEN', [T('c', 'Type 2')]);
rec('"BLOCK H" never reads as a hand (no hand reason given)', !/hand/.test(s.why), JSON.stringify(s));
s = S('HANDED HOUSE 14 TYPE 2 KITCHEN', [T('c', 'Type 2 Handed'), T('d', 'Type 2')]);
rec('"HANDED" before TYPE → never green', s.level !== 'strong', JSON.stringify(s));
s = S('HOUSE 14 TYPE 2 KITCHEN', [T('c', 'Type 2', { typeName: 'Type 2 LH' })]);
rec('the old hidden type name is not used (plain "Type 2" name, type name "2 LH") → green', s.level === 'strong', JSON.stringify(s));
// mixed hands never share a template: every combination
const hands = ['', ' H', ' LH', ' RH'];
let bad = [];
for (const th of hands) for (const gh of hands) { const r = S('HOUSE 14 TYPE 1A' + th + ' KITCHEN', [T('x', 'Type 1A' + gh)]); if (th !== gh && r.level === 'strong') bad.push(th + '/' + gh); }
rec('no title hand ever goes green with a template of another hand (16 pairs)', !bad.length, bad.join(','));

// single ✓ Confirm asks when the hand differs (in the app, fake Supabase)
const L = require('../list-window/lw.js');
const { X, sleep } = L;
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const row = X.v2Row(); row.orders.forEach(o => { if (o.wo === 'WO-3') Object.assign(o, { title: 'HOUSE 13 TYPE 1A H KITCHEN', step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21' }); if (o.wo === 'WO-6') o.title = 'HOUSE 4 TYPE 1A KITCHEN'; });
    const Sv = X.makeServer(row);
    X.F3.seedList(Sv, 'T1', { wos: [], name: 'Type 1A', list: { is_template: true, type_name: 'Type 1A', list_type: 'kitchen' } });
    const t = await X.dev(browser, Sv, 'office'), p = t.page;
    await p.evaluate(async () => { lsReset(); await lsLoad(); window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return false; }; setWho('Ann'); showTab('l'); render(); });
    await sleep(400);
    const lvl = await p.evaluate(() => { const r = ltiRows().find(x => x.o.wo === 'WO-3'); return r ? r.lvl + '|' + r.tid + '|' + r.s.why : 'no row'; });
    rec('app: WO-3 "TYPE 1A H" with only template "Type 1A" → not green', /^weak\|T1/.test(lvl), lvl);
    const nGreen = await p.evaluate(() => ltiRows().filter(r => r.lvl === 'strong').map(r => r.o.wo).join(','));
    rec('app: "Confirm all green" never takes WO-3', !/WO-3/.test(nGreen), nGreen);
    const r1 = await p.evaluate(() => { const b = document.querySelector('[data-lticonf="WO-3"]'); if (!b) return 'no button'; b.click(); return window.__asked.join(' || '); });
    rec('app: single ✓ Confirm asks "Template is 1A, title says 1A H — use it anyway?"', r1 === 'Template is 1A, title says 1A H — use it anyway?', r1);
    await sleep(500);
    rec('app: answering Cancel makes no list', !Sv.db.t.lists.some(l => !l.is_template && (l.wos || []).includes('WO-3')));
    rec('no page errors', !(Sv.errors || []).length, JSON.stringify(Sv.errors));
  } catch (e) { rec('browser part ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
