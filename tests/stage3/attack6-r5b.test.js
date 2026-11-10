// ATTACK 6 — round 5b fixes, attacked: (1) diffLines step 0 now pairs a row by its id only while kind+part are unchanged
// (a cut Side overtyped into Shelf = removed Side kept aside + new Shelf); (2) Release all checks the wait the screen saw
// (sa = status_at, ra = released_at) instead of the line version; (3) the line queue retries a 40P01 / 40001 reply;
// (4) the Excel match screen offers retired materials and brings one back when picked.
// Fake Supabase only (srv3.js / db3.js) — nothing reaches the live project. Run: node tests/stage3/attack6-r5b.test.js
const fs = require('fs'), path = require('path');
const A = require('./atk.js');
const { F, H, D, rec } = A;
const L = F.line;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + String(d).slice(0, 400) : ''));
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const dm = /\/\* diffLines:start \*\/([\s\S]*?)\/\* diffLines:end \*\//.exec(src);
const diffLines = new Function(dm[1] + '\nreturn diffLines;')();

// ---------- 1. diffLines (pure) ----------
let n = 0;
const OL = (part, o = {}) => Object.assign({ id: 'L1:' + (++n), seq: n, kind: 'saw', section: null, part, length_mm: 720, width_mm: 560, qty: '2', material: 'MFC White', edging: '1mm', note: null, status: 'todo', removed_rev: null }, o);
const NL = (o) => ({ kind: o.kind, section: o.section, part: o.part, length_mm: o.length_mm, width_mm: o.width_mm, qty: o.qty, material: o.material, edging: o.edging, note: o.note, id: o.id });
const by = (r, id) => r.lines.find(x => x.id === id);
const S1 = r => JSON.stringify({ ids: r.lines.map(x => x.id + (x.reset ? '*' : '')), ch: r.changed, add: r.added, rem: r.removed, aside: r.keepAside, note: r.noteOnly });
function base() { n = 0; return [OL('Side', { status: 'cut' }), OL('Side'), OL('Top', { length_mm: 1200, status: 'cut' }), OL('Back', { section: 'Unit A', status: 'cut' })]; }
{
  const old = base(), nw = old.map(NL); Object.assign(nw[0], { part: 'Shelf', length_mm: 800, width_mm: 300 });
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D1 cut Side (with id) overtyped into Shelf: Side removed + keep aside, Shelf is a NEW line, others untouched',
    r.removed.join() === 'L1:1' && r.keepAside.join() === 'L1:1' && r.added.length === 1 && r.lines[0].id !== 'L1:1' && !r.changed.length && by(r, 'L1:2') && !by(r, 'L1:2').reset, S1(r));
}
{
  const old = base(), nw = old.map(NL); nw[3].section = 'Unit B'; [nw[0], nw[3]] = [nw[3], nw[0]];
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D2 section-only move of a cut row (+ moved up the list): same id, tick kept, not CHANGED, nothing removed',
    by(r, 'L1:4') && !by(r, 'L1:4').reset && by(r, 'L1:4').section === 'Unit B' && !r.changed.length && !r.removed.length && !r.added.length, S1(r));
}
{
  const old = base(), nw = old.map(NL); nw[2].qty = '3';
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D3 quantity change on a cut row: same id, reset, CHANGED (not removed/added)', r.changed.join() === 'L1:3' && by(r, 'L1:3').reset && !r.removed.length && !r.added.length, S1(r));
}
{
  const old = base(), nw = old.map(NL); nw[0].part = 'Gable';
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D4 twins: the CUT twin overtyped: the todo twin keeps its own id (still todo), cut one kept aside, Gable added',
    r.keepAside.join() === 'L1:1' && by(r, 'L1:2') && !by(r, 'L1:2').reset && r.lines[1].id === 'L1:2' && r.added.length === 1, S1(r));
}
{
  const old = base(), nw = old.map(NL); nw[1].part = 'Gable';
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D5 twins: the TODO twin overtyped: cut twin keeps id + tick, todo twin removed (no keep aside), Gable added',
    r.lines[0].id === 'L1:1' && !r.lines[0].reset && r.removed.join() === 'L1:2' && !r.keepAside.length && r.added.length === 1, S1(r));
}
{
  const old = base(), nw = old.map(NL); nw[0].note = 'grain up'; nw[2].part = '  TOP ';
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D6 note-only on a cut row + case/space-only rename "  TOP ": ticks kept (noteOnly / same), nothing removed',
    r.noteOnly.join() === 'L1:1' && !r.removed.length && !r.changed.length && r.lines[2].id === 'L1:3', S1(r));
}
{
  const old = base(), nw = old.map(NL); nw[0].kind = 'fit';
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D7 cut saw Side changed to a fitting: saw line removed + keep aside, fitting added', r.keepAside.join() === 'L1:1' && r.added.length === 1, S1(r));
}
{ // overtype both rows into each other (swap): each tick follows the part it belongs to
  const old = base(), nw = old.map(NL); const a = nw[0], c = nw[2];
  nw[0] = Object.assign({}, c, { id: a.id }); nw[2] = Object.assign({}, a, { id: c.id });
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D8 Side and Top rows overtyped into each other: no false keep-aside, both cut ticks stay with their parts',
    !r.removed.length && !r.changed.length && r.lines[0].id === 'L1:3' && r.lines[2].id === 'L1:1', S1(r));
}
{ // cut Side overtyped into Shelf AND a new (id-less) Side row added below with a different qty
  const old = base(), nw = old.map(NL); nw[0].part = 'Shelf'; nw.push(Object.assign(NL(old[0]), { id: undefined, qty: '5' }));
  const r = diffLines(old, nw, { listId: 'L1' });
  info('D9 cut Side → Shelf plus a new Side ×5 row (no id) added', S1(r) + ' (the new Side row takes over the cut Side as CHANGED — reset to todo, no keep aside)');
}
{ // overtyped row + a copied row still carrying the same id
  const old = base(), nw = old.map(NL); nw[0].part = 'Shelf'; nw.push(Object.assign({}, NL(old[0])));
  const r = diffLines(old, nw, { listId: 'L1' });
  rec('D10 cut Side overtyped to Shelf, and a copy of the original Side row (same id) at the bottom: the copy keeps L1:1 + tick, Shelf new',
    r.lines[4].id === 'L1:1' && !r.lines[4].reset && r.lines[0].id !== 'L1:1' && !r.removed.length, S1(r));
}

// ---------- browser parts ----------
const ensureP = S => { if (!D.find(S.db, 'projects', 'P1')) { D.insert(S.db, 'projects', { id: 'P1', name: 'Proj' }); D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' }); } };
function seed(S, id, lines, extra = {}) {
  ensureP(S);
  D.insert(S.db, 'lists', { id, project_id: 'P1', name: 'House 1', wos: ['WO-1'], n_saw: lines.length, n_fit: 0, created_at: '2026-10-20T08:00:00.000Z', source: 'manual' });
  lines.forEach((x, i) => D.insert(S.db, 'list_lines', Object.assign({ id: id + ':' + (i + 1), list_id: id, seq: i + 1, kind: x[0], part: x[1], qty: x[2], length_mm: x[3], width_mm: x[4], material: x[5], status: 'todo' }, extra[i + 1] || {})));
}
const row = () => { const r = F.v2Row(); r.settings.lists = []; r.settings.listWBs = {}; return r; };
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); render(); });
const relg = (p, re) => p.evaluate(src => { const b = [...document.querySelectorAll('[data-relg]')].find(b => new RegExp(src, 'i').test(b.dataset.relg)); if (!b) return 'missing'; b.click(); return 'ok'; }, re);
const freeze = p => p.evaluate(() => { clearInterval(LST.timer); LST.timer = null; });
const st = (S, id) => L(S, id).status + (L(S, id).released_at ? '+rel' : '');
const msgs = p => p.evaluate(() => LQ.msgs.slice());
const evs = (S, id) => (S.db.t.list_events || []).filter(e => e.line_id === id || e.list_line_id === id).length;
const ROWS = [['saw', 'Side', '4', 2400, 600, 'MFC White'], ['saw', 'Top', '2', 1200, 600, 'MFC White'], ['saw', 'Shelf', '3', 800, 300, 'MFC White']];
// µs: real Postgres keeps 6 decimals. Turn every ms timestamp the fake writes into a µs one, and check releases strictly.
const us = v => (typeof v === 'string' && /\.\d{3}Z$/.test(v)) ? v.replace(/Z$/, '789+00:00') : v;
const usKey = v => { if (v == null) return null; const m = /^(.*?)(?:\.(\d+))?(Z|[+-]\d\d:?\d\d)$/.exec(v); if (!m) return v; return Date.parse(m[1] + (m[3] === 'Z' ? 'Z' : m[3])) + '.' + String(m[2] || '').padEnd(6, '0'); };
function microDb(S) {
  const orig = D.RPC.apply_line_changes; S.strictBad = [];
  D.RPC.apply_line_changes = (d, args) => {
    (args.p_changes || []).forEach(c => { if (c.act === 'release' && 'sa' in c) { const l = D.find(d, 'list_lines', c.id); if (l && l.status === 'waiting' && (usKey(l.status_at) !== usKey(c.sa) || ('ra' in c && usKey(l.released_at) !== usKey(c.ra)))) S.strictBad.push({ id: c.id, db: [l.status_at, l.released_at], sent: [c.sa, c.ra], fakeSays: Date.parse(l.status_at) === Date.parse(c.sa) ? 'same' : 'differs' }); } });
    const out = orig(d, args);
    d.t.list_lines.forEach(l => { l.status_at = us(l.status_at); l.released_at = us(l.released_at); });
    (Array.isArray(out) ? out : []).forEach(x => { x.at = us(x.at); x.rel = us(x.rel); });
    return out;
  };
  return () => { D.RPC.apply_line_changes = orig; };
}
async function rpcRoute(t, fn, replies) { // the next replies[] calls to /rpc/fn get these canned answers, then the fake database
  const q = replies.slice(); t.hits = 0;
  await t.page.route('**/rest/v1/rpc/' + fn, route => { if (!q.length) return route.fallback(); const [s, b] = q.shift(); t.hits++; return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) }); });
}

(async () => {
  const browser = await H.chromium.launch();
  // ===== R1: offline saw parks Shelf (unsent), then on the same device releases it before any signal =====
  {
    const S = F.makeServer(row()); seed(S, 'L1', ROWS);
    const saw = await F.dev(browser, S, 'saw'); S.offline3 = true;
    const t1 = await F.tapRow(saw.page, 'data-rna', 'L1:3');
    const rel = await saw.page.evaluate(() => lqLine('L1:3', 'release', 'Op'));
    await F.send(saw.page); S.offline3 = false; await F.send(saw.page);
    const m = await msgs(saw.page);
    rec('R1 park then release, both unsent on one device: Shelf ends todo, queue empty, nothing scary shown',
      t1 === 'ok' && rel && L(S, 'L1:3').status === 'todo' && (await F.qlen(saw.page)) === 0 && !m.some(x => /changed on another screen|Not saved/.test(x)),
      JSON.stringify({ st: st(S, 'L1:3'), m, calls: S.rpcCalls.map(c => c.args.p_changes.map(x => x.act + ':' + (x.status || ''))) }));
    if (m.length) info('R1 message shown after park+release cancelled out', JSON.stringify(m));
    await saw.close();
  }
  // ===== R2: the park is IN FLIGHT (sent, reply not back) when Release is pressed on the same device =====
  for (const mode of ['in-flight', 'reply-lost']) {
    const S = F.makeServer(row()); seed(S, 'L1', ROWS);
    const undo = microDb(S);
    const saw = await F.dev(browser, S, 'saw'); await freeze(saw.page);
    await F.tapRow(saw.page, 'data-rna', 'L1:3');
    if (mode === 'in-flight') {
      let go; S.hold3 = new Promise(r => { go = r; });
      const p = F.send(saw.page); await F.sleep(300);
      await saw.page.evaluate(() => lqLine('L1:3', 'release', 'Op'));
      S.hold3 = null; go(); await p; await F.send(saw.page);
    } else {
      S.dropReply = 1; await F.send(saw.page);
      await saw.page.evaluate(() => lqLine('L1:3', 'release', 'Op'));
      await F.sleep(200); await F.send(saw.page); await F.send(saw.page);
    }
    const m = await msgs(saw.page);
    rec('R2/' + mode + ' release queued behind its own park (µs timestamps): Shelf released, no refusal, queue empty',
      st(S, 'L1:3') === 'todo+rel' && (await F.qlen(saw.page)) === 0 && !m.length && !S.strictBad.length,
      JSON.stringify({ st: st(S, 'L1:3'), m, strictBad: S.strictBad, sent: S.rpcCalls.map(c => c.args.p_changes.map(x => x.act + ':' + (x.sa || '') + '/' + (x.ra || ''))) }));
    undo(); await saw.close();
  }
  // ===== R3: stale screen. P loads (Shelf waiting); Q releases; saw parks it again; P presses Release all =====
  {
    const S = F.makeServer(row()); seed(S, 'L1', ROWS);
    const undo = microDb(S);
    const saw = await F.dev(browser, S, 'saw');
    for (const id of ['L1:1', 'L1:3']) await F.tapRow(saw.page, 'data-rna', id); await F.send(saw.page);
    const P = await F.dev(browser, S, 'prod'), Q = await F.dev(browser, S, 'prod'); await freeze(P.page);
    await relg(Q.page, '^mfc white$'); await F.send(Q.page);
    await reload(saw.page); await F.tapRow(saw.page, 'data-rna', 'L1:3'); await F.send(saw.page);
    const before = st(S, 'L1:3');
    const c = await relg(P.page, '^mfc white$'); await F.send(P.page);
    const m = await msgs(P.page);
    rec('R3 Release all from a stale screen after Shelf was released and parked again elsewhere: refused, Shelf stays WAITING, P told',
      c === 'ok' && before === 'waiting+rel' && L(S, 'L1:3').status === 'waiting' && m.length > 0 && (await F.qlen(P.page)) === 0,
      JSON.stringify({ before, after: st(S, 'L1:3'), side: st(S, 'L1:1'), m }));
    info('R3 what P is told (does it name Shelf as still waiting?)', JSON.stringify(m));
    undo(); await saw.close(); await P.close(); await Q.close();
  }
  // ===== R4: µs timestamps straight from the database (as PostgREST returns them): P releases; is the exact string sent back? =====
  {
    const S = F.makeServer(row());
    seed(S, 'L1', ROWS, { 1: { status: 'waiting', status_by: 'Op', status_at: '2026-10-21T08:59:59.123456+00:00', released_at: '2026-10-21T08:00:00.000001+00:00', released_by: 'Op' },
      2: { status: 'waiting', status_by: 'Op', status_at: '2026-10-21T08:59:59.123999+00:00' } });
    const undo = microDb(S);
    const P = await F.dev(browser, S, 'prod'); await freeze(P.page);
    await relg(P.page, '^mfc white$'); await F.send(P.page);
    const sent = S.rpcCalls.flatMap(c => c.args.p_changes.map(x => [x.id, x.sa, x.ra]));
    rec('R4 µs status_at/released_at are sent back byte-for-byte (so real Postgres "is not distinct from" matches): both released',
      !S.strictBad.length && st(S, 'L1:1') === 'todo+rel' && st(S, 'L1:2') === 'todo+rel' && sent.some(x => x[1] === '2026-10-21T08:59:59.123456+00:00'),
      JSON.stringify({ sent, strictBad: S.strictBad }));
    // ...and a re-park in the SAME millisecond (µs differ) — the fake compares ms, real Postgres compares µs
    D.update(S.db, 'list_lines', L(S, 'L1:2'), { status: 'waiting', status_at: '2026-10-21T09:10:00.500100+00:00', released_at: null });
    await reload(P.page);
    D.update(S.db, 'list_lines', L(S, 'L1:2'), { status: 'waiting', status_at: '2026-10-21T09:10:00.500900+00:00' }); // re-parked meanwhile
    S.strictBad = []; await relg(P.page, '^mfc white$'); await F.send(P.page);
    info('R4b re-park in the same ms: strict µs check flags it (= real PG refuses), fake db3 ' + (st(S, 'L1:2') === 'todo+rel' ? 'RELEASED it (ms compare — fake is looser than Postgres)' : 'refused'), JSON.stringify(S.strictBad));
    undo(); await P.close();
  }
  // ===== R5: office note edit after Production loaded → Release all still works (round-5b fix regression) =====
  {
    const S = F.makeServer(row()); seed(S, 'L1', ROWS.slice(0, 2));
    const saw = await F.dev(browser, S, 'saw');
    for (const id of ['L1:1', 'L1:2']) await F.tapRow(saw.page, 'data-rna', id); await F.send(saw.page);
    const P = await F.dev(browser, S, 'prod'); await freeze(P.page);
    const o = await F.dev(browser, S, 'office');
    await o.page.evaluate(async () => { window.confirm = () => true; window.prompt = () => 'x'; const rows = lsEditRows('L1'); rows[1].note = 'grain vertical'; rows.unshift({ k: 'saw', item: 'Plinth', qty: '1', L: 2400, W: 100, mat: 'MFC White', edging: '', note: '', sec: '' }); await lsSaveManual({ wo: 'WO-1', name: 'House 1', project: 'Proj', rows }, 'Dee', lsList('L1')); });
    await relg(P.page, '^mfc white$'); await F.send(P.page);
    rec('R5 office note + row inserted above after Production loaded: Release all releases both', st(S, 'L1:1') === 'todo+rel' && st(S, 'L1:2') === 'todo+rel', JSON.stringify({ a: [st(S, 'L1:1'), st(S, 'L1:2')], m: await msgs(P.page) }));
    await saw.close(); await P.close(); await o.close();
  }
  // ===== Q1: 40P01 deadlock (PostgREST sends HTTP 500 for class 40) on a batch of two ticks: retried, lands once =====
  for (const [code, status] of [['40P01', 500], ['40001', 409], ['40P01', 400]]) {
    const S = F.makeServer(row()); seed(S, 'L1', ROWS);
    const saw = await F.dev(browser, S, 'saw'); await freeze(saw.page);
    await rpcRoute(saw, 'apply_line_changes', [[status, { code, message: 'deadlock detected', details: null, hint: null }]]);
    for (const id of ['L1:1', 'L1:2']) await F.tapRow(saw.page, 'data-rt', id);
    await F.send(saw.page);
    const mid = { q: await F.qlen(saw.page), err: await saw.page.evaluate(() => LQ.err), m: await msgs(saw.page), st: [st(S, 'L1:1'), st(S, 'L1:2')] };
    let auto = false; for (let i = 0; i < 130 && !auto; i++) { await F.sleep(100); auto = (await F.qlen(saw.page)) === 0; } // the 10 s timer retries by itself
    const m = await msgs(saw.page);
    const landed = S.rpcCalls.filter(c => c.fn === 'apply_line_changes').length;
    rec('Q1/' + code + '/' + status + ' deadlock reply: ticks kept (no refusal), retried by itself, each line cut once',
      saw.hits === 1 && mid.q === 2 && !mid.m.length && auto && L(S, 'L1:1').status === 'cut' && L(S, 'L1:2').status === 'cut' && !m.length && landed === 1 && L(S, 'L1:1').version === 2,
      JSON.stringify({ mid, auto, m, landed, v: [L(S, 'L1:1').version, L(S, 'L1:2').version] }));
    await saw.close();
  }
  // ===== Q2: a genuine refusal (P0001 400) is still shown and dropped; a per-line refusal (removed) still shown =====
  {
    const S = F.makeServer(row()); seed(S, 'L1', ROWS);
    const saw = await F.dev(browser, S, 'saw'); await freeze(saw.page);
    await rpcRoute(saw, 'apply_line_changes', [[400, { code: 'P0001', message: 'bad change', details: null, hint: null }]]);
    await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.send(saw.page);
    const m = await msgs(saw.page);
    rec('Q2 a real refusal (P0001) is shown as "Not saved — the database refused it" and dropped (not retried forever)',
      m.some(x => /refused it/.test(x)) && (await F.qlen(saw.page)) === 0 && L(S, 'L1:1').status === 'todo', JSON.stringify({ m, q: await F.qlen(saw.page) }));
    D.update(S.db, 'list_lines', L(S, 'L1:2'), { removed_rev: 2 });
    await F.tapRow(saw.page, 'data-rt', 'L1:2'); await F.send(saw.page);
    const m2 = await msgs(saw.page);
    rec('Q2b a per-line refusal (line taken off the list) is still shown', m2.some(x => /taken off the list/.test(x)) && (await F.qlen(saw.page)) === 0, JSON.stringify(m2));
    await saw.close();
  }
  // ===== M1: match screen — retired materials offered; picking one brings it back; alias saved once =====
  {
    const S = F.makeServer(row()); ensureP(S);
    D.insert(S.db, 'project_materials', { id: 'M4', project_id: 'P1', name: 'Old Oak', kind: 'sheet', aliases: ['Oak 18'], active: false });
    D.insert(S.db, 'project_materials', { id: 'M5', project_id: 'P1', name: 'Grey Gloss', kind: 'sheet', active: false });
    const pr = await F.dev(browser, S, 'prod');
    let patches = 0;
    pr.page.on('request', r => { if (r.method() === 'PATCH' && /project_materials/.test(r.url())) patches++; });
    const run = (names, picks) => pr.page.evaluate(async ({ names, picks }) => {
      document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      window.__t = []; const t0 = window.toast; window.toast = m => window.__t.push(m);
      let res = 'pending'; lsMatchDlg(names, 'P1', r => { res = r; });
      const opts = [...document.querySelectorAll('[data-mm="0"] option')].map(o => o.value + '=' + o.textContent);
      picks.forEach((v, i) => { document.querySelector('[data-mm="' + i + '"]').value = v; });
      document.getElementById('mm-ok').click();
      for (let i = 0; i < 40 && res === 'pending'; i++) await new Promise(r => setTimeout(r, 100));
      window.toast = t0; document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      return { res, t: window.__t, opts };
    }, { names, picks });
    let r = await run(['oak 18'], ['M4']);
    const m4 = D.find(S.db, 'project_materials', 'M4');
    rec('M1 "oak 18" (an other spelling of retired Old Oak): Old Oak offered, picking it brings it back, no duplicate alias, one write',
      r.opts.some(o => /^M4=Old Oak \(retired\)/.test(o)) && m4.active !== false && JSON.stringify(m4.aliases) === '["Oak 18"]' && patches === 1 && r.res && r.res['oak 18'] === 'Old Oak',
      JSON.stringify({ r, m4: { active: m4.active, aliases: m4.aliases }, patches }));
    patches = 0;
    r = await run(['GG 18mm', 'Grey Glos'], ['M5', 'M5']);
    const m5 = D.find(S.db, 'project_materials', 'M5');
    rec('M2 two new spellings both matched to retired Grey Gloss in one go: back on the list, both remembered once each',
      m5.active !== false && JSON.stringify(m5.aliases) === '["GG 18mm","Grey Glos"]' && r.res && typeof r.res === 'object',
      JSON.stringify({ r: r.res, t: r.t, m5: { active: m5.active, aliases: m5.aliases }, patches }));
    patches = 0;
    r = await run(['GG 18mm'], ['M5']);
    rec('M3 the same spelling matched again later: no write at all (alias already there, already active)', patches === 0 && r.res && r.res['gg 18mm'] === 'Grey Gloss', JSON.stringify({ r, patches }));
    const after = await pr.page.evaluate(() => lsMats('P1', 'sheet').map(m => m.name));
    rec('M4 the brought-back materials are on the normal (active) project list on this screen', after.includes('Old Oak') && after.includes('Grey Gloss'), JSON.stringify(after));
    rec('M9 no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await pr.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
