// Nightly server backup (SUPABASE_CHANGES.md, 23 Nov block): text checks that the database's nightly copy keeps the SAME shape
// and rules as the app's own backup (backupNow / bakSettings / tryDailyBackup in index.html). No browser, no network, no
// database — it only reads the two files. (The SQL itself is run on a throwaway Postgres by tests/sql/run-server-backup.sh.)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const md = fs.readFileSync(path.join(root, 'SUPABASE_CHANGES.md'), 'utf8');
let fails = 0;
const ok = (n, c, d) => { if (c) console.log('PASS ' + n); else { fails++; console.log('FAIL ' + n + (d ? '  ' + d : '')); } };

// the 23 Nov section and its grey boxes
const h = md.indexOf('## 2026-11-23 — Nightly server backup');
const sec = h < 0 ? '' : md.slice(h, (md.indexOf('\n## ', h + 5) + 1 || md.length + 1) - 1);
const boxes = [...sec.matchAll(/```sql\n([\s\S]*?)\n```/g)].map(m => m[1]);
ok('0 the 23 Nov block is in SUPABASE_CHANGES.md, newest at the top, with 6 grey boxes',
  h > 0 && md.indexOf('\n## ') === h - 1 && boxes.length === 6, 'found ' + boxes.length);
const job = boxes[1] || '';
const cmd = (job.match(/\$job\$([\s\S]*?)\$job\$/) || [])[1] || '';

// 1. payload shape = backupNow()
const bn = (html.match(/async function backupNow\(reason\)\{[\s\S]*?\n\}/) || [''])[0];
ok('1a backupNow() still writes payload {orders: DB.orders, nid: DB.nid, settings: bakSettings()} and orders_count = DB.orders.length',
  /payload:\{orders:DB\.orders,nid:DB\.nid,settings:bakSettings\(\)\}/.test(bn) && /const n=DB\.orders\.length/.test(bn) && /orders_count:n/.test(bn),
  'backupNow changed — update the 23 Nov SQL to the same shape');
ok('1b the nightly copy builds the same three keys from the planner record (orders, nid, settings)',
  /jsonb_build_object\('orders', p\.orders::jsonb, 'nid', p\.nid,\s*'settings',/.test(cmd));
ok('1c orders_count = jsonb_array_length(orders), copied only when orders is a list', /jsonb_array_length\(p\.orders::jsonb\)/.test(cmd) && /jsonb_typeof\(p\.orders::jsonb\) = 'array'/.test(cmd));
ok('1d only from the record id main', /from public\.production_planner p\s+where p\.id = 'main'/.test(cmd));

// 2. settings: the app leaves out exactly the lists switch; so does the nightly copy
const bs = (html.match(/function bakSettings\(\)\{[^\n]*\}/) || [''])[0];
const appDrops = [...bs.matchAll(/delete s\.(\w+);/g)].map(m => m[1]).sort();
const sqlDrops = [...((cmd.match(/p\.settings::jsonb((?:\s*-\s*'\w+')+)/) || [])[1] || '').matchAll(/'(\w+)'/g)].map(m => m[1]).sort();
ok('2a bakSettings() leaves out listStore and listStoreAt (only those)', JSON.stringify(appDrops) === '["listStore","listStoreAt"]', JSON.stringify(appDrops));
ok('2b the nightly copy leaves out the same settings keys as bakSettings()', JSON.stringify(sqlDrops) === JSON.stringify(appDrops), 'sql ' + JSON.stringify(sqlDrops));

// 3. one a day by the UTC date (the app: new Date().toISOString().slice(0,10) vs String(taken_at).slice(0,10))
const td = (html.match(/async function tryDailyBackup\(\)\{[\s\S]*?\n\}/) || [''])[0];
ok('3a the app still counts "today" by the UTC date', /new Date\(\)\.toISOString\(\)\.slice\(0,10\)/.test(td) && /String\(l\.taken_at\)\.slice\(0,10\)===today/.test(td));
ok('3b the nightly copy is skipped when any backup has today\'s UTC date',
  /not exists \(select 1 from public\.planner_backups b\s+where \(b\.taken_at at time zone 'UTC'\)::date = \(now\(\) at time zone 'UTC'\)::date\)/.test(cmd));

// 4. prune: 30 days by the database clock, like the app
ok('4a the app prunes copies older than 30 days before its new copy\'s database time', /Date\.parse\(b\.taken_at\)-30\*86400000/.test(td) && /taken_at=lt\./.test(td));
ok('4b the nightly job prunes taken_at < now() - 30 days, only when a good copy for today exists',
  /delete from public\.planner_backups\s+where taken_at < now\(\) - interval '30 days'\s+and exists/.test(cmd));
ok('4c the job deletes nothing else (one delete, from planner_backups only; never production_planner)',
  (cmd.match(/\bdelete\b/gi) || []).length === 1 && !/update\s+public\.production_planner|delete from public\.production_planner|truncate|drop /i.test(cmd));

// 5. schedule, re-run, undo
ok('5a pg_cron switched on, job "planner-nightly-backup" at 00:20 UTC, old one of that name removed first',
  /create extension if not exists pg_cron;/.test(job) && job.indexOf("select cron.unschedule(jobid) from cron.job where jobname = 'planner-nightly-backup';") >= 0
  && job.indexOf("cron.unschedule") < job.indexOf("cron.schedule('planner-nightly-backup', '20 0 * * *', $job$"));
ok('5b undo box only unschedules the job by name', (boxes[5] || '').replace(/--[^\n]*\n/g, '').trim() === "select cron.unschedule(jobid) from cron.job where jobname = 'planner-nightly-backup';");
ok('5c the block says no new table, so no GRANT lines', /No new table, so no GRANT lines are needed/.test(sec));

// 6. the reason text: the app never reads "reason" back (no in-app restore screen parses it), so "nightly · server" is safe
const reasonReads = (html.match(/\.reason\b/g) || []).length, bakReads = (html.match(/planner_backups\?[^'"`]*select=[^'"`]*reason/g) || []).length;
ok('6 the app never reads a backup\'s reason (so the new reason text cannot confuse it)', bakReads === 0 && !/b\.reason|bak\w*\.reason/.test(html), 'reads=' + bakReads + ' .reason=' + reasonReads);
ok('6b the nightly copy\'s reason is "nightly · server"', /select 'nightly · server', /.test(cmd));

console.log(fails ? 'FAILED ' + fails : 'ALL SERVER BACKUP SHAPE CHECKS PASSED');
process.exit(fails ? 1 : 0);
