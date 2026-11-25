// Tester attack round 4: JS = SQL, worked out LIVE (no recorded strings). The planner's keyHouseStr / keyLineStr against the
// database's seq_house_key / seq_line_key for every floor x unit of an awkward list (basement dashes, placeholders, accents
// inside and outside the fixed list, superscripts, dotted units, "(Type B)", "A Block", ...), plus the attack3 / attack4 pairs.
// Needs a THROWAWAY local Postgres set up like tests/seq/pg-check.sql (never the live project). Skips when A3_PG is not set.
//   A3_PG="psql -h /var/lib/postgresql/wpfpg -p 5499 -U postgres -d attack4" node tests/seq/attack4-jsvssql.test.js
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const B = require('./b0lib.js');
const PG = process.env.A3_PG;
if (!PG) { console.log('SKIP attack4-jsvssql: A3_PG not set (needs a throwaway Postgres)'); process.exit(0); }
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 600) : '')); };
const FL = ['-1', '−1', '–1', '—1', '‐1', '‑1', '－1', 'Level -1', 'Floor -01', 'Block -1', '- 1', '-0', 'Basement', 'B1', 'T09', 't9 ', 'Block T09',
  'A Block', 'Block A', 'Ground Block', 'TBC', 'T.B.C.', 'N/A', 'N.A.', 'Block TBC', 'Block', 'FLOOR', 'Áras 1', 'Aras 1', 'Block É', 'Block É', 'Block AŁ', 'Block Æ',
  'Straße 1', 'Ｔ０９', 'ﬁrst', 'G', 'GF', 'Ground Floor', 'L1', 'Floor 1 Block A', 'Block A Floor 1', 'Lower ground', '0', '00', '', ' ', '?', 'XX', '1²', '¹1',
  'İ1', 'K1', 'Ⅻ', '①', 'Twelfth', '1st', 'Level 1', 'BLK9', '00000000000000000000000000001', 'É', 'ß', 'Ø1', 'Œuvre', 'Ğ', 'ǅ1'];
const UN = ['7', 'Apt 7', 'APT07', '7A', '7 a', '7 (Type B)', '7 (Type C)', '7 (B)', '7B', '2.05', '02.05', '2.5', '205', '2-05', '12.0', '12.00', '12', 'TBC', 'T.B.C.', 'TBC 2',
  'N/A', 'XX', 'Not known', 'To be confirmed', '?', '-', 'Apt', 'House', 'No', 'Unit 7-8', '7²', '7-2', '7/2', '⑦', 'Ⅶ', '7.1', 'Apt. 7, 2nd floor', '1-7', 'NO 2 BED',
  '00000000000000000000000000012', '7​A', '7 A', 'Ｎｏ．７', 'É7', 'Øst 7', 'ß7', '7 (Type ß)', '7 (type b', '(Type B) 7', '7 TYPE B', '.5', '5.', '1.2.3', '1..2'];
const PR = [['K8', 'HOUSE TYPE B'], ['', ''], [' ', '-'], ['Kitchen ß', 'Straße É'], ['K8', '7²'], ['W2', 'BED 2 (Type B)'], ['K8', '2.05']];
const cases = [];
for (const f of FL) for (const u of UN) cases.push({ f, u, hk: B.keyHouseStr(f, u) });
for (const f of ['T09', '-1', 'TBC']) for (const u of ['7', '2.05', '7 (Type B)']) for (const [p, n] of PR) cases.push({ f, u, p, n, lk: B.keyLineStr(f, u, p, n) });
const tmp = path.join(require('os').tmpdir(), 'attack4-jsvssql-' + process.pid + '.json');
fs.writeFileSync(tmp, JSON.stringify(cases));
const sql = `\\set fx \`cat ${tmp}\`
select json_agg(json_build_array(c->>'f',c->>'u',c->>'hk',seq_house_key(c->>'f',c->>'u'))) from jsonb_array_elements(:'fx'::jsonb) c where c ? 'hk' and seq_house_key(c->>'f',c->>'u') is distinct from c->>'hk';
select json_agg(json_build_array(c->>'f',c->>'u',c->>'p',c->>'n',c->>'lk',seq_line_key(c->>'f',c->>'u',c->>'p',c->>'n'))) from jsonb_array_elements(:'fx'::jsonb) c where c ? 'lk' and seq_line_key(c->>'f',c->>'u',c->>'p',c->>'n') is distinct from c->>'lk';
select count(*) from jsonb_array_elements(:'fx'::jsonb);`;
const [cmd, ...args] = PG.split(' ');
const r = spawnSync(cmd, [...args, '-At', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
fs.unlinkSync(tmp);
if (r.status) { console.error(r.stderr); process.exit(1); }
const [hkBad, lkBad, n] = r.stdout.replace(/\n$/, '').split('\n');
rec('the database saw every case (' + cases.length + ')', +n === cases.length, n);
rec('JS = SQL house keys on ' + cases.filter(c => 'hk' in c).length + ' floor x unit cases', !hkBad, hkBad);
rec('JS = SQL line keys on ' + cases.filter(c => 'lk' in c).length + ' cases', !lkBad, lkBad);
const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
