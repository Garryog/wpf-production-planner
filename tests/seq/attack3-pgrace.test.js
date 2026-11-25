// Tester attack round 3: two PCs load the same Cienapps upload file AT THE SAME MOMENT (two real database sessions).
// Needs a THROWAWAY local Postgres set up like tests/seq/pg-check.sql (never the live project). Skips when A3_PG is not set.
//   A3_PG="psql -h /var/lib/postgresql/wpfpg -p 5499 -U postgres -d attack3" node tests/seq/attack3-pgrace.test.js
// Session A runs seq_insert inside a transaction and waits 1.5 s before committing; session B starts the same file 0.3 s
// later. The advisory lock in seq_insert must make B wait and then add nothing.
const { spawn } = require('child_process');
const PG = process.env.A3_PG;
if (!PG) { console.log('SKIP attack3-pgrace: A3_PG not set (needs a throwaway Postgres)'); process.exit(0); }
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const run = sql => new Promise((ok, no) => { const [cmd, ...args] = PG.split(' ');
  const p = spawn(cmd, [...args, '-At', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d); p.on('close', c => c ? no(new Error(err)) : ok(out.trim())); p.stdin.end(sql); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = Date.now().toString(36), PID = 'RACE' + T;
const file = pfx => JSON.stringify([1, 2, 3].map(i => ({ id: pfx + T + i, floor: 'T09', unit: String(70 + (i > 2 ? 1 : 0)), product: i === 3 ? 'K8' : 'W2', name: i === 3 ? 'HOUSE TYPE B' : 'BED 2', kind: i === 3 ? 'kitchen' : 'robes', line_no: i })));
(async () => {
  await run(`update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1';
    update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
    insert into projects(id,name) values('${PID}','Race ${T}') on conflict do nothing;
    set role anon; select seq_insert('${PID}','[{"id":"S${T}","wo":"RWO-${T}","floor":"Block T9","unit":"Apt 071","descr":"HOUSE TYPE B","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'Seed');`);
  const a = run(`set role anon; begin; select seq_insert('${PID}','${file('A')}'::jsonb,null,'PC A'); select pg_sleep(1.5); commit;`);
  await sleep(300);
  const t0 = Date.now();
  const b = run(`set role anon; select seq_insert('${PID}','${file('B')}'::jsonb,null,'PC B');`);
  const [ra, rb] = await Promise.all([a, b]); const waited = Date.now() - t0;
  const ja = JSON.parse(ra.split('\n').find(l => l.startsWith('{'))), jb = JSON.parse(rb.split('\n').find(l => l.startsWith('{')));
  rec('PC A: the two identical robes lines added (2), the kitchen line claims the Start row', ja.added.length === 2 && ja.skipped.length === 1, ra);
  rec('PC B waited for PC A (advisory lock)', waited > 900, waited + ' ms');
  rec('PC B (same file at the same moment) adds nothing', jb.added.length === 0 && jb.skipped.length === 3, rb);
  const n = await run(`select count(*) from project_seq where project_id='${PID}' and state<>'removed';`);
  rec('3 live rows in the sequence (Start row + 2 robes), never 5', n === '3', n);
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
