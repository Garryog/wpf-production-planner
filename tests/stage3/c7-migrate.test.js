// Stage 3 C7: Migrate lists (backup first, idempotent, count check read back from the database), switch back (old
// format rebuilt from the tables incl. lists made since), rescue of old-tab ticks. Plan B acceptance 1 and 11.
// Fake Supabase only. Run: node tests/stage3/c7-migrate.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = F.NOW;
const SIDE = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '1mm ABS' };
const k = r => [r.k, String(r.item || '').trim(), r.L, r.W, String(r.mat || '').trim(), String(r.note || '').trim()].join('|').toLowerCase();
const ROWS1 = [{ k: 'hdr', item: 'BASE UNITS', note: '' }, SIDE, { ...SIDE }, { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'Oak', note: '' }, { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum', note: 'soft close' }, { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' }];
const ROWS2 = [{ k: 'saw', item: 'Gable', qty: 2, L: 900, W: 560, mat: 'MFC White', note: '' }, { k: 'saw', item: 'Shelf', qty: 3, L: 560, W: 500, mat: 'MFC White', note: '' }];
const ROWS3 = [{ k: 'fit', item: 'Handle', qty: 4, mat: 'Hafele', note: '' }];
function v1Row() {
  return { id: 'main', version: 1, nid: 5,
    orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-2', customer: 'Crown Builders', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: {
      lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 4, fit: 1, wos: ['WO-1'], up: '2026-10-01T08:00:00Z', log: [{ at: '2026-10-01T08:00:00Z', by: 'O', what: 'x' }] },
        { id: 'L2', wb: 'MW2', sheet: 'Unit 2', name: 'Unit 2', project: 'Manual lists', saw: 2, fit: 0, wos: ['WO-2'], up: '2026-10-02T08:00:00Z', manual: true, noFit: true },
        { id: 'L3', wb: 'W3', sheet: 'Spare', name: 'Spare', project: '', saw: 0, fit: 1, wos: [], up: '2026-10-03T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': ROWS1 } }, MW2: { project: 'Manual lists', sheets: { 'Unit 2': ROWS2 }, manual: true }, W3: { project: '', sheets: { Spare: ROWS3 } } },
      listRow: { L1: { [k(SIDE)]: { m: 'saw', at: '2026-10-20T09:00:00Z', by: 'Sean' }, [k(ROWS1[4])]: { m: 'fit', at: '2026-10-20T10:00:00Z', by: 'Mary' } }, L2: { [k(ROWS2[0])]: { m: 'saw', at: '2026-10-19T09:00:00Z', by: 'Sean' }, [k(ROWS2[1])]: { m: 'saw', at: '2026-10-19T09:05:00Z', by: 'Sean' } } },
      listHold: { L1: { [k(ROWS1[3])]: { m: 'saw', st: 'hold', at: '2026-10-20T11:00:00Z', by: 'Sean', item: 'Top', mat: 'Oak', qty: 1, L: 1200, W: 560 }, [k(SIDE)]: { m: 'saw', st: 'hold', at: '2026-10-20T08:00:00Z', by: 'Phone', item: 'Side' } },
        L2: { [k(ROWS2[1])]: { m: 'saw', st: 'rel', at: '2026-10-18T09:00:00Z', by: 'Sean', relAt: '2026-10-18T15:00:00Z', relBy: 'Stores' } } },
      listDone: { L2: { saw: { at: '2026-10-19T09:06:00Z', by: 'Sean' } } },
      holdLog: [{ at: '2026-10-20T11:00:00Z', act: 'hold', list: 'House 1', proj: 'Aderrig', n: 1, m: 'saw', by: 'Sean' }, { at: '2026-10-18T15:00:00Z', act: 'release', list: 'Unit 2', proj: 'Manual lists', n: 1, m: '', by: 'Stores' }] } };
}
const adminPrompt = p => p.evaluate(() => { window.prompt = (m, d) => /Admin PIN/.test(m) ? '9000' : 'Tester'; });
async function migrateUI(p) {
  await p.evaluate(() => { window.LSMIG = null; showTab('s'); });
  await adminPrompt(p);
  await p.evaluate(() => document.getElementById('ls-mig').click());
  for (let i = 0; i < 60; i++) { await F.sleep(100); const r = await p.evaluate(() => window.LSMIG); if (r) return r; }
  return { timeout: true };
}
const cnt = S => ({ p: S.db.t.projects.length, l: S.db.t.lists.length, ln: S.db.t.list_lines.length, ev: S.db.t.list_events.length });
(async () => {
  const browser = await H.chromium.launch();
  // ---- the switch is off: Settings shows the button and makes no calls to the new tables
  const S = F.makeServer(v1Row());
  const off = await F.open(browser, S, { now: NOW, role: 'office' });
  let downloads = 0; off.page.on('download', () => downloads++);
  await off.page.evaluate(() => showTab('s'));
  rec('switch off: Settings shows "Migrate lists", nothing fetched from the new tables', (await off.page.evaluate(() => !!document.getElementById('ls-mig'))) && F.newTableCalls(S).length === 0, F.newTableCalls(S).join());
  // ---- a count mismatch blocks the switch
  S.onPost = (t, rows) => t === 'list_lines' ? rows.filter(r => r.id !== 'L1:4') : rows; // one line lost on the way in
  const bad = await migrateUI(off.page);
  S.onPost = null;
  const msg = await off.page.evaluate(() => document.getElementById('ls-msg').innerText);
  rec('count mismatch: NOT switched over (switch back to \'v1\'), the report names the list', bad.ok === false && bad.check.bad.length === 1 && bad.check.bad[0].id === 'L1' && S.row.settings.listStore === 'v1' /* 'migrating' undone */ && !(await off.page.evaluate(() => V2())) && /Counts did not match/.test(msg) && /House 1/.test(msg), JSON.stringify(bad.check && bad.check.bad) + ' ' + msg.slice(0, 120));
  rec('a backup was taken (pre-lists-v2) and downloaded before anything was copied', S.backups.some(b => /pre-lists-v2/.test(b.reason)) && downloads >= 1, S.backups.map(b => b.reason).join() + ' dl=' + downloads);
  // ---- migrate for real
  const r = await migrateUI(off.page);
  const L = id => D.find(S.db, 'list_lines', id), LI = id => D.find(S.db, 'lists', id);
  rec('migrate: counts match, switch set to v2 with listStoreAt, saved in the planner record', r.ok === true && r.check.bad.length === 0 && S.row.settings.listStore === 'v2' && !!S.row.settings.listStoreAt && (await off.page.evaluate(() => V2())), JSON.stringify(r.check || r));
  const pn = S.db.t.projects.map(p => p.name).sort().join();
  rec('projects from the names in use; "Manual lists" → the WO customer; blank and no WO → Unassigned', pn === 'Aderrig,Crown Builders,Unassigned' && LI('L2').project_id === S.db.t.projects.find(p => p.name === 'Crown Builders').id, pn);
  rec('lists keep their ids, tags, flags, sign-offs, history; manual stays manual', LI('L1').wos.join() === 'WO-1' && LI('L2').no_fit === true && LI('L2').saw_done_by === 'Sean' && LI('L2').source === 'manual' && LI('L1').source === 'migrated' && LI('L1').log.length === 1);
  rec('lines get fixed ids listId:seq; header kept; column F → Edging; section from the heading', L('L1:1').kind === 'hdr' && L('L1:2').edging === '1mm ABS' && L('L1:2').section === 'BASE UNITS' && L('L1:5').note === 'soft close' && S.db.t.list_lines.length === 9);
  rec('statuses: ticked → cut / got-out (both identical lines, as the old screens showed); ticked + parked → cut; parked → waiting; released → todo with released_at', L('L1:2').status === 'cut' && L('L1:3').status === 'cut' && L('L1:4').status === 'waiting' && L('L1:5').status === 'got-out' && L('L1:6').status === 'todo' && L('L2:2').status === 'cut' && L('L2:2').released_by === 'Stores', JSON.stringify(['L1:2', 'L1:3', 'L1:4', 'L1:5', 'L1:6', 'L2:2'].map(id => L(id).status)));
  rec('old waiting history copied into list_events, matched to the list', S.db.t.list_events.filter(e => /old waiting history/.test(e.note || '')).length === 2 && S.db.t.list_events.some(e => e.list_id === 'L1' && e.act === 'old-hold'));
  const v = await off.page.evaluate(() => ({ n: lists().length, t: rowTicked('L1', 'L1:2'), h: heldRow(lists().find(l => l.id === 'L1'), 'L1:4') }));
  rec('after the switch the screens read the tables', v.n === 3 && v.t && v.h, JSON.stringify(v));
  // ---- acceptance 1: running it twice adds no duplicates
  const c1 = cnt(S);
  const r2 = await off.page.evaluate(async () => { DB.listStore = ''; const x = await lsMigrate('Tester'); return { ok: x.ok, bad: x.check.bad.length }; });
  const c2 = cnt(S);
  rec('A1: a second run gives the same result — no duplicate projects, lists, lines or history', r2.ok && c2.p === c1.p && c2.l === c1.l && c2.ln === c1.ln && c2.ev === c1.ev, JSON.stringify([c1, c2]));
  rec('planner record list data untouched by the migration (frozen copy)', JSON.stringify(S.row.settings.lists) === JSON.stringify(v1Row().settings.lists) && JSON.stringify(S.row.settings.listRow) === JSON.stringify(v1Row().settings.listRow));
  // ---- rescue: a tab still on the OLD code ticks / parks after the switch
  const at = new Date(Date.parse(S.row.settings.listStoreAt) + 60000).toISOString();
  S.row.settings.listRow.L1[k(ROWS1[5])] = { m: 'saw', at, by: 'OldTab' }; // Back
  S.row.settings.listHold.L1[k(SIDE)] = { m: 'saw', st: 'hold', at, by: 'OldTab', item: 'Side' }; // parking a line already cut → done wins
  S.row.settings.listRow.L3 = { [k(ROWS3[0])]: { m: 'fit', at: '2026-10-01T00:00:00Z', by: 'Ancient' } }; // a slow tab's clock: time before the switch, but not in the migrated copy
  S.row.version++;
  const saw = await F.dev(browser, S, 'saw');
  await saw.page.evaluate(async () => { await new Promise(r => setTimeout(r, 200)); await lqSend(); });
  rec('rescue: an old tab\'s tick newer than the switch reaches the tables (Back cut by OldTab)', L('L1:6').status === 'cut' && L('L1:6').status_by === 'OldTab', L('L1:6').status);
  rec('rescue: the old tab parking a cut line doesn\'t undo it, and no message is shown', L('L1:2').status === 'cut' && !(await saw.page.evaluate(() => LQ.msgs.length)));
  rec('rescue: a tick the migration never saw is rescued even when its time says before the switch (a slow clock) — fingerprint, not clock', L('L3:1').status === 'got-out', L('L3:1').status);
  // a second screen finds the same old ticks: applied once only
  const ev0 = S.db.t.list_events.filter(e => /^rescue:/.test(e.cid || '')).length;
  const saw2 = await F.dev(browser, S, 'saw'); await saw2.page.evaluate(async () => { lsRescue(); await lqSend(); });
  await F.tapRow(saw.page, 'data-rt', 'L1:6'); await F.send(saw.page); // someone unticks it in v2 …
  await saw2.page.evaluate(async () => { await lsPoll(); await lqSend(); }); // … and a rescue on another screen must not bring the tick back
  rec('rescue is sent once across screens and never re-ticks a line unticked since', S.db.t.list_events.filter(e => /^rescue:/.test(e.cid || '')).length === ev0 && L('L1:6').status === 'todo', ev0 + ' ' + L('L1:6').status);
  // ---- more v2 work before switching back: a tick, a park, a release, a new list
  await F.tapRow(saw.page, 'data-rt', 'L2:1'); // untick Gable
  await F.tapRow(saw.page, 'data-rna', 'L1:6'); await F.send(saw.page);
  await off.page.evaluate(async () => { await lsPoll(); openListEditor(null, 'WO-1'); const ov = document.querySelector('.pod-ovl'); const s = (k2, v2) => { const e = ov.querySelector('[data-mr="' + k2 + '"]'); if (e.tagName === 'SELECT' && ![...e.options].some(o => o.value === v2)) e.add(new Option(v2, v2)); /* an edging code not in the drop-down = the user's "Other…" (9 Nov) */ e.value = v2; e.oninput(); }; s('0|item', 'Plinth'); s('0|qty', '2'); s('0|L', '2400'); s('0|W', '150'); s('0|mat', 'MFC White'); s('0|edging', '1mm'); ov.querySelector('#me-name').value = 'House 1 extras'; ov.querySelector('#me-save').click(); });
  await F.sleep(600);
  const nl = S.db.t.lists.find(l => l.name === 'House 1 extras');
  D.applyLineChanges(S.db, [{ id: nl.id + ':1', status: 'cut', cid: 'z', rev: 1 }], 'Sean');
  // ---- acceptance 11: switch back gives the same ticks and holds as the tables
  await off.page.evaluate(async () => { window.LSBACK = null; await lsPoll(); showTab('s'); });
  await adminPrompt(off.page);
  await off.page.evaluate(() => document.getElementById('ls-back').click());
  for (let i = 0; i < 60 && !(await off.page.evaluate(() => window.LSBACK)); i++) await F.sleep(100);
  const back = await off.page.evaluate(() => window.LSBACK);
  rec("switch back: listStore 'v1' saved, all 4 lists rebuilt (incl. the one made since)", back && back.lists === 4 && S.row.settings.listStore === 'v1' && S.row.settings.lists.length === 4 && S.row.settings.lists.some(l => l.name === 'House 1 extras'), JSON.stringify(back));
  const ck = await off.page.evaluate(async () => { const c = await lsCountCheck(); return { bad: c.bad, v2: V2() }; });
  rec('A11: every list\'s lines, done and waiting match the tables exactly (count check both ways)', !ck.v2 && ck.bad.length === 0, JSON.stringify(ck.bad));
  const per = await off.page.evaluate(() => lists().map(l => listRows(l).filter(r => r.k !== 'hdr').map(r => (rowTicked(l.id, rowKey(r)) ? 'D' : heldRow(l, rowKey(r)) ? 'W' : '-')).join('')).join(' '));
  const tbl = ['L1', 'L2', 'L3', nl.id].map(id => S.db.t.list_lines.filter(x => x.list_id === id && x.kind !== 'hdr' && x.removed_rev == null).sort((a, b) => a.seq - b.seq).map(x => ['cut', 'got-out'].includes(x.status) ? 'D' : x.status === 'waiting' ? 'W' : '-').join('')).join(' ');
  rec('A11: line by line, the old screens show the same ticks and waiting as the tables', per === tbl, per + ' vs ' + tbl);
  const rel = await off.page.evaluate(() => (holdsOf('L2')[Object.keys(holdsOf('L2'))[0]] || {}).st);
  rec('A11: sign-offs, flags and tags come back too', S.row.settings.listDone.L2 && S.row.settings.listDone.L2.saw && S.row.settings.lists.find(l => l.id === 'L2').noFit === true && S.row.settings.lists.find(l => l.id === 'L1').wos.join() === 'WO-1', JSON.stringify(S.row.settings.listDone));
  const sawv1 = await F.open(browser, S, { now: NOW, role: 'saw' });
  const s1 = await sawv1.page.evaluate(() => ({ v2: V2(), n: lists().length, rt: document.querySelectorAll('[data-rt]').length }));
  rec('after switching back a fresh saw screen runs the old way on the rebuilt lists', !s1.v2 && s1.n === 4 && s1.rt > 0, JSON.stringify(s1));
  // ---- migrate again after switching back: same lines, nothing duplicated, nothing lost
  const c3 = cnt(S);
  const r3 = await off.page.evaluate(async () => { const x = await lsMigrate('Tester'); return { ok: x.ok, bad: x.check.bad }; });
  rec('migrate again after switching back: counts match, no duplicate lines (line ids carried through)', r3.ok && cnt(S).ln === c3.ln && cnt(S).l === c3.l, JSON.stringify([r3, c3, cnt(S)]));
  rec('nothing was ever deleted (no DELETE on the new tables)', !S.deletes3);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await off.close(); await saw.close(); await saw2.close(); await sawv1.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
