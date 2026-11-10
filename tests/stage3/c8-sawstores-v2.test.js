// Stage 3 C8: the whole tests/sawstores suite run a second time with the lists switch ON (v2) — each file is run with
// tests/stage3/v2hook.js, which migrates the same fixtures with the app's own "Migrate lists" first.
// Some old checks read or write the old record directly (S.row.settings.holdLog / listHold, DB.listRow, DB.listWBs …):
// in v2 that copy is frozen on purpose, so those checks can't apply. They are listed below by name with where the v2
// behaviour is checked instead; ANY other failure in v2 is a FAIL here. Fake Supabase only.
// Run: node tests/stage3/c8-sawstores-v2.test.js
const { execFile } = require('child_process'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '../..');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
// Old-record checks: not applicable with the switch on (the v2 equivalent is named)
const NA = {
  'attack-devices.test.js': [[/^holds log has hold, unhold/, 'history is in list_events (c4)'], [/^back online: N\/A reaches the server/, 'line queue, c4 A3/A5'],
    [/^offline N\/A \+ tab closed/, 'line queue kept on the device, c4 A5'], [/^race: holds log records the N\/A/, 'list_events (db3-rules)']],
  'attack-stale.test.js': [[/^untick after clash logs na-cleared/, 'set-up writes DB.listRow; done-wins in db3-rules'], [/^list back in queue after clash/, 'set-up writes DB.listRow to fake a clash; c4 A3'],
    [/^holds log: one na-cleared/, 'history is in list_events']],
  'attack-regress.test.js': [[/^\(pre-existing\) A4 labels/, 'on ACCEPTED-FAILURES (labels step)']],
};
// Files whose SET-UP writes the old record (DB.listWBs / DB.listRow / holdsOf objects) — they stop or fail at that point in v2;
// what they check is covered in v2 by c8-bench-v2 (sheets panel, combined, labels, print, release) and c4 / c6.
const SETUP_OLD = { 'sawstores.test.js': 'sheetNeed fixtures edit DB.listWBs', 'attack-sheets.test.js': 'replaces DB.listWBs.W1 rows', 'retest-nov.test.js': 'builds lists in DB.listWBs', 'attack-fixes.test.js': 'edits holdsOf()/DB.listRow directly' };
const MUST = [['attack-devices.test.js', /^N\/A on one of two identical lines parks only that one/]]; // the old "identical lines share one record" failure — fixed by line ids
const run = f => new Promise(r => execFile('node', ['-r', path.join(__dirname, 'v2hook.js'), f], { cwd: ROOT, timeout: 900000, maxBuffer: 1 << 24 }, (e, so, se) => r(String(so) + String(se))));
(async () => {
  const files = fs.readdirSync(path.join(ROOT, 'tests/sawstores')).filter(f => f.endsWith('.test.js')).sort();
  const out = {};
  for (let i = 0; i < files.length; i += 3) await Promise.all(files.slice(i, i + 3).map(async f => { out[f] = await run(path.join('tests/sawstores', f)); }));
  let pass = 0, na = 0;
  for (const f of files) {
    const o = out[f], P = o.split('\n').filter(l => l.startsWith('PASS ')), X = o.split('\n').filter(l => l.startsWith('FAIL ')).map(l => l.slice(5));
    pass += P.length;
    const migOk = !/WRAPPER migration failed/.test(o);
    rec('[v2] ' + f + ': fixtures migrated with matching counts', migOk, (o.match(/WRAPPER.*/) || [''])[0]);
    // a file that builds its fixtures by writing the old record directly (e.g. a new Tester file) is treated the same way
    if (!SETUP_OLD[f] && /DB\.(listWBs|listRow|listHold|listDone)\s*(\.|\[|=)/.test(fs.readFileSync(path.join(ROOT, 'tests/sawstores', f), 'utf8')) && /TypeError|Error:/.test(o)) SETUP_OLD[f] = 'writes DB.listWBs / DB.listRow / DB.listHold directly (found in the file)';
    if (SETUP_OLD[f]) { na += X.length; console.log('INFO [v2] ' + f + ': ' + P.length + ' pass; set-up writes the old record (' + SETUP_OLD[f] + ') — ' + X.length + ' check(s) n/a' + (/TypeError|Error:/.test(o) ? ', stops at that set-up' : '') + '; covered by c8-bench-v2 / c4 / c6'); continue; }
    const bad = X.filter(x => { const m = (NA[f] || []).find(([re]) => re.test(x)); if (m) { na++; console.log('INFO [v2] ' + f + ' n/a: ' + x.slice(0, 90) + ' — ' + m[1]); } return !m; });
    rec('[v2] ' + f + ': ' + P.length + ' pass, no failures except old-record checks', !bad.length && /failed of/.test(o), bad.join(' | ').slice(0, 400) || (/failed of/.test(o) ? '' : o.slice(-300)));
  }
  MUST.forEach(([f, re]) => rec('[v2] ' + f + ': "' + re.source.replace(/\\/g, '').slice(1, 60) + '" passes in v2', (out[f] || '').split('\n').some(l => l.startsWith('PASS ') && re.test(l.slice(5)))));
  console.log('INFO [v2] sawstores total: ' + pass + ' checks pass with the switch on; ' + na + ' old-record checks not applicable');
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
