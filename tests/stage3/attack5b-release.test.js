// ATTACK 5 — the round-4 'Release all' version check (apply_line_changes refuses a release made against an older line
// version), attacked: two OFFLINE Production screens both Release all, then the saw parks one line again before they come
// back; a release whose reply was lost then resent; an office edit (note / a row inserted above) between the Production
// screen loading and pressing Release all. Fake Supabase only (srv3.js / db3.js mirror the SQL).
// Run: node tests/stage3/attack5-release.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const L = F.line;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const ensureP = S => { if (!D.find(S.db, 'projects', 'P1')) { D.insert(S.db, 'projects', { id: 'P1', name: 'Proj' }); D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' }); } };
function seed(S, id, name, lines) {
  ensureP(S);
  D.insert(S.db, 'lists', { id, project_id: 'P1', name, wos: ['WO-1'], n_saw: lines.length, n_fit: 0, created_at: '2026-10-20T08:00:00.000Z', source: 'manual' });
  lines.forEach((x, i) => D.insert(S.db, 'list_lines', { id: id + ':' + (i + 1), list_id: id, seq: i + 1, kind: x[0], part: x[1], qty: x[2], length_mm: x[3], width_mm: x[4], material: x[5], status: 'todo' }));
}
const row = () => { const r = F.v2Row(); r.settings.lists = []; r.settings.listWBs = {}; return r; };
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); render(); });
const relg = (p, re) => p.evaluate(src => { const b = [...document.querySelectorAll('[data-relg]')].find(b => new RegExp(src, 'i').test(b.dataset.relg)); if (!b) return 'missing'; b.click(); return 'ok'; }, re);
const freeze = p => p.evaluate(() => { clearInterval(LST.timer); LST.timer = null; });
const st = (S, id) => L(S, id).status + (L(S, id).released_at ? '+rel' : '');
const ROWS = [['saw', 'Side', '4', 2400, 600, 'MFC White'], ['saw', 'Top', '2', 1200, 600, 'MFC White'], ['saw', 'Shelf', '3', 800, 300, 'MFC White']];
(async () => {
  const browser = await H.chromium.launch();
  // ===== RA1: two Production screens, both offline, both press Release all; one comes back; the saw parks Shelf again; the other comes back =====
  {
    const S = F.makeServer(row()); seed(S, 'L1', 'House 1', ROWS);
    const saw = await F.dev(browser, S, 'saw');
    for (const id of ['L1:1', 'L1:2', 'L1:3']) await F.tapRow(saw.page, 'data-rna', id); await F.send(saw.page);
    const P = await F.dev(browser, S, 'prod'), Q = await F.dev(browser, S, 'prod'); await freeze(P.page); await freeze(Q.page);
    S.offline3 = true;
    const c1 = await relg(P.page, '^mfc white$'), c2 = await relg(Q.page, '^mfc white$');
    await F.send(P.page); await F.send(Q.page);
    S.offline3 = false;
    await F.send(P.page); // P back in signal: all 3 released
    const mid = ['L1:1', 'L1:2', 'L1:3'].map(i => st(S, i));
    await reload(saw.page); const tn = await F.tapRow(saw.page, 'data-rna', 'L1:3'); await F.send(saw.page); // Shelf ran out again
    await F.send(Q.page); // Q's old Release all arrives
    const qm = await Q.page.evaluate(() => LQ.msgs.slice());
    rec('RA1 two offline Release alls; saw parks Shelf again before the second arrives: Shelf stays WAITING, Side/Top released',
      c1 === 'ok' && c2 === 'ok' && tn === 'ok' && L(S, 'L1:3').status === 'waiting' && st(S, 'L1:1') === 'todo+rel' && st(S, 'L1:2') === 'todo+rel',
      JSON.stringify({ mid, after: ['L1:1', 'L1:2', 'L1:3'].map(i => st(S, i)) }));
    rec('RA1b the second Production screen is told its release was not applied, and its queue is empty', (await F.qlen(Q.page)) === 0 && qm.length > 0, JSON.stringify(qm));
    info('RA1 what the late screen was told', JSON.stringify(qm));
    rec('RA1c no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await saw.close(); await P.close(); await Q.close();
  }
  // ===== RA2: Release all lands but the reply is lost; the screen resends: still counted once, no "changed on another screen" =====
  {
    const S = F.makeServer(row()); seed(S, 'L1', 'House 1', ROWS.slice(0, 2));
    const saw = await F.dev(browser, S, 'saw');
    for (const id of ['L1:1', 'L1:2']) await F.tapRow(saw.page, 'data-rna', id); await F.send(saw.page);
    const P = await F.dev(browser, S, 'prod'); await freeze(P.page);
    await relg(P.page, '^mfc white$');
    S.dropReply = 1; await F.send(P.page); await F.sleep(200); await F.send(P.page);
    const m = await P.page.evaluate(() => LQ.msgs.slice());
    rec('RA2 release reply lost then resent: both released, nothing left queued, no refusal message',
      st(S, 'L1:1') === 'todo+rel' && st(S, 'L1:2') === 'todo+rel' && (await F.qlen(P.page)) === 0 && !m.some(x => /Not changed|no longer/.test(x)), JSON.stringify({ st: [st(S, 'L1:1'), st(S, 'L1:2')], m }));
    await saw.close(); await P.close();
  }
  // ===== RA3: the office edits the list (note on the waiting Top) after Production loaded; Production presses Release all =====
  for (const how of ['note', 'insert-above']) {
    const S = F.makeServer(row()); seed(S, 'L1', 'House 1', ROWS.slice(0, 2));
    const saw = await F.dev(browser, S, 'saw');
    for (const id of ['L1:1', 'L1:2']) await F.tapRow(saw.page, 'data-rna', id); await F.send(saw.page);
    const P = await F.dev(browser, S, 'prod'); await freeze(P.page);
    const o = await F.dev(browser, S, 'office');
    const ed = await o.page.evaluate(async how => {
      window.confirm = () => true; window.prompt = () => 'site measure';
      const rows = lsEditRows('L1');
      if (how === 'note') rows[1].note = 'grain vertical';
      else rows.unshift({ k: 'saw', item: 'Plinth', qty: '1', L: 2400, W: 100, mat: 'Oak', edging: '', note: '', sec: '' });
      try { await lsSaveManual({ wo: 'WO-1', name: 'House 1', project: 'Proj', rows }, 'Dee', lsList('L1')); return 'ok'; } catch (e) { return e.message; }
    }, how);
    const vAfterEdit = [L(S, 'L1:1').version, L(S, 'L1:2').version, L(S, 'L1:1').status, L(S, 'L1:2').status];
    await relg(P.page, '^mfc white$'); await F.send(P.page);
    const m = await P.page.evaluate(() => LQ.msgs.slice());
    rec('RA3/' + how + ' (Low) Production Release all right after an office edit (' + how + ') — nobody re-parked anything — releases both lines',
      st(S, 'L1:1') === 'todo+rel' && st(S, 'L1:2') === 'todo+rel', JSON.stringify({ ed, vAfterEdit, after: [st(S, 'L1:1'), st(S, 'L1:2')], told: m }));
    await saw.close(); await P.close(); await o.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
