// Stage 3 C0: the fake database's rules (db3.js mirrors the SQL in SUPABASE_CHANGES.md 2026-11-02). No browser, no network.
// Run: node tests/stage3/db3-rules.test.js
const D = require('./db3.js');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
function seed() {
  const d = D.makeDb();
  D.insert(d, 'projects', { id: 'P1', name: 'Aderrig' });
  D.insert(d, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' });
  D.insert(d, 'lists', { id: 'L1', project_id: 'P1', name: 'House 1', wos: ['WO-1'], n_saw: 3, n_fit: 1 });
  [['saw', 'Side'], ['saw', 'Side'], ['saw', 'Top'], ['fit', 'Hinge']].forEach(([k, p], i) => D.insert(d, 'list_lines', { id: 'L1:' + (i + 1), list_id: 'L1', seq: i + 1, kind: k, part: p, qty: '2', material: 'MFC White' }));
  return d;
}
const L = (d, id) => D.find(d, 'list_lines', id);
let cid = 0; const C = o => Object.assign({ cid: 'c' + (++cid), rev: 1 }, o);

// apply_line_changes
{
  const d = seed();
  let r = D.applyLineChanges(d, [C({ id: 'L1:1', status: 'cut' })], 'Sean');
  rec('cut a saw line → ok, status cut, version 2, by Sean', r[0].ok && L(d, 'L1:1').status === 'cut' && r[0].v === 2 && r[0].by === 'Sean');
  rec('identical line L1:2 untouched', L(d, 'L1:2').status === 'todo' && L(d, 'L1:2').version === 1);
  rec('first accepted change locks the list (build note f)', D.find(d, 'lists', 'L1').locked === true);
  rec('event written with the cid', d.t.list_events.filter(e => e.line_id === 'L1:1').length === 1);
  r = D.applyLineChanges(d, [C({ id: 'L1:1', status: 'waiting' })], 'Phone');
  rec('done wins: N/A on a cut line refused (why done), stays cut', !r[0].ok && r[0].why === 'done' && L(d, 'L1:1').status === 'cut', JSON.stringify(r[0]));
  r = D.applyLineChanges(d, [C({ id: 'L1:2', status: 'waiting' })], 'Phone');
  const v2 = L(d, 'L1:2').version;
  r = D.applyLineChanges(d, [C({ id: 'L1:2', status: 'cut' })], 'PC');
  rec('cut on a waiting line → cut (got-out wins over N/A)', r[0].ok && L(d, 'L1:2').status === 'cut' && L(d, 'L1:2').version === v2 + 1);
  r = D.applyLineChanges(d, [C({ id: 'L1:1', status: 'cut' })], 'Other');
  rec('cut an already-cut line → ok, no change, keeps first person', r[0].ok && L(d, 'L1:1').status_by === 'Sean' && L(d, 'L1:1').version === 2);
  r = D.applyLineChanges(d, [C({ id: 'L1:4', status: 'cut' })], 'X');
  rec('cut on a fittings line refused (wrong-kind)', !r[0].ok && r[0].why === 'wrong-kind');
  r = D.applyLineChanges(d, [C({ id: 'L1:4', status: 'got-out' })], 'Stores');
  rec('got-out on a fittings line ok', r[0].ok && L(d, 'L1:4').status === 'got-out');
  r = D.applyLineChanges(d, [C({ id: 'nope', status: 'cut' })], 'X');
  rec('missing line → why missing', !r[0].ok && r[0].why === 'missing');
}
// stale untick
{
  const d = seed();
  D.applyLineChanges(d, [C({ id: 'L1:1', status: 'cut' })], 'A'); // v2
  const seenByA = L(d, 'L1:1').version;
  D.applyLineChanges(d, [C({ id: 'L1:1', status: 'todo', v: seenByA })], 'B'); // v3
  D.applyLineChanges(d, [C({ id: 'L1:1', status: 'cut' })], 'B'); // v4
  const r = D.applyLineChanges(d, [C({ id: 'L1:1', status: 'todo', v: seenByA })], 'A');
  rec('stale untick refused (why stale), line stays cut by B', !r[0].ok && r[0].why === 'stale' && L(d, 'L1:1').status === 'cut' && r[0].by === 'B', JSON.stringify(r[0]));
  const r2 = D.applyLineChanges(d, [C({ id: 'L1:1', status: 'todo', v: L(d, 'L1:1').version })], 'A');
  rec('untick with the current version → ok, todo', r2[0].ok && L(d, 'L1:1').status === 'todo');
  rec('untick with no version → refused', !D.applyLineChanges(d, [C({ id: 'L1:2', status: 'todo' })], 'A')[0].ok);
}
// release, na
{
  const d = seed();
  D.applyLineChanges(d, [C({ id: 'L1:1', status: 'waiting' })], 'Saw');
  let r = D.applyLineChanges(d, [C({ id: 'L1:1', act: 'release' })], 'Stores');
  rec('release a waiting line → todo with released_at/by', r[0].ok && L(d, 'L1:1').status === 'todo' && !!L(d, 'L1:1').released_at && L(d, 'L1:1').released_by === 'Stores');
  r = D.applyLineChanges(d, [C({ id: 'L1:1', status: 'cut' })], 'Saw');
  rec('cutting a released line keeps released_at (MATERIAL IN history)', r[0].ok && !!L(d, 'L1:1').released_at);
  r = D.applyLineChanges(d, [C({ id: 'L1:1', act: 'release' })], 'Stale');
  rec('stale release on a cut line → ok but nothing changes (never reopens work)', r[0].ok && L(d, 'L1:1').status === 'cut');
  r = D.applyLineChanges(d, [C({ id: 'L1:2', act: 'release' })], 'X');
  rec('release on a todo line → refused not-waiting', !r[0].ok && r[0].why === 'not-waiting');
  r = D.applyLineChanges(d, [C({ id: 'L1:2', status: 'na' })], 'PM');
  rec('office marks not needed (na) from todo', r[0].ok && L(d, 'L1:2').status === 'na');
  r = D.applyLineChanges(d, [C({ id: 'L1:2', status: 'cut' })], 'Saw');
  rec('cut on a not-needed line refused', !r[0].ok && r[0].why === 'not-needed');
  r = D.applyLineChanges(d, [C({ id: 'L1:1', status: 'na' })], 'PM');
  rec('na on a cut line refused', !r[0].ok && r[0].why === 'done');
}
// duplicate resend (reply lost)
{
  const d = seed();
  const ch = [C({ id: 'L1:1', status: 'cut' }), C({ id: 'L1:2', status: 'cut' })];
  D.applyLineChanges(d, ch, 'Saw');
  const r = D.applyLineChanges(d, ch, 'Saw');
  rec('same changes resent (same cids) → ok:dup, applied once, one event each', r.every(x => x.ok && x.dup) && d.t.list_events.length === 2 && L(d, 'L1:1').version === 2, d.t.list_events.length);
  const ch2 = C({ id: 'L1:1', status: 'todo', v: 2 });
  D.applyLineChanges(d, [ch2], 'Saw'); D.applyLineChanges(d, [C({ id: 'L1:1', status: 'cut' })], 'Saw');
  const r2 = D.applyLineChanges(d, [ch2], 'Saw');
  rec('a resent untick does not undo a later tick', r2[0].dup && L(d, 'L1:1').status === 'cut');
}
// changed_rev refusal + removed
{
  const d = seed();
  D.update(d, 'list_lines', L(d, 'L1:3'), { changed_rev: 2 });
  let r = D.applyLineChanges(d, [C({ id: 'L1:3', status: 'cut', rev: 1 })], 'Saw');
  rec('tick from a screen showing rev 1 on a line changed in rev 2 → refused (changed)', !r[0].ok && r[0].why === 'changed' && L(d, 'L1:3').status === 'todo');
  r = D.applyLineChanges(d, [C({ id: 'L1:3', status: 'cut', rev: 2 })], 'Saw');
  rec('same tick from a screen showing rev 2 → ok', r[0].ok);
  D.update(d, 'list_lines', L(d, 'L1:2'), { removed_rev: 2 });
  r = D.applyLineChanges(d, [C({ id: 'L1:2', status: 'cut', rev: 2 })], 'Saw');
  rec('tick on a removed line refused', !r[0].ok && r[0].why === 'removed');
}
// list_attach
{
  const d = seed();
  const a = D.listAttach(d, 'L1', 'WO-2', true, 'Office A');
  const b = D.listAttach(d, 'L1', 'WO-3', true, 'Office B'); // second person, no stale copy can wipe WO-2
  rec('two attaches → both work orders kept', b.wos.join() === 'WO-1,WO-2,WO-3', b.wos.join());
  D.listAttach(d, 'L1', 'WO-2', true, 'Office A');
  rec('attaching again adds no duplicate, no extra event', D.find(d, 'lists', 'L1').wos.length === 3 && d.t.list_events.filter(e => e.act === 'attach').length === 2);
  D.listAttach(d, 'L1', 'WO-1', false, 'Office A');
  rec('detach removes only that WO and logs it', D.find(d, 'lists', 'L1').wos.join() === 'WO-2,WO-3' && /WO-1 taken off/.test(JSON.stringify(D.find(d, 'lists', 'L1').log)));
  rec('missing list → error', throws(() => D.listAttach(d, 'nope', 'W', true, 'x'), /missing/));
}
// list_set_done
{
  const d = seed();
  let r = D.listSetDone(d, 'L1', 'saw', true, 'Sean');
  rec('saw sign-off sets saw_done_at/by and a history line written by the database', !!r.saw_done_at && r.saw_done_by === 'Sean' && r.log.some(x => x.what === 'Cut complete'));
  r = D.listSetDone(d, 'L1', 'saw', false, 'Office', 'drawing changed');
  rec('send back clears it, logs "was done … by Sean" with the reason', !r.saw_done_at && r.log.some(x => /Sent back for re-cutting \(was done .* by Sean\)/.test(x.what) && x.why === 'drawing changed'));
  r = D.listSetDone(d, 'L1', 'no_fit', true, 'Office');
  rec('no_fit flag + log', r.no_fit === true && r.log.some(x => x.what === 'No fittings ticked'));
  rec('bad mode refused', throws(() => D.listSetDone(d, 'L1', 'bogus', true, 'x')));
  const n0 = D.find(d, 'lists', 'L1').log.length;
  D.listSetDone(d, 'L1', 'fit', true, 'Mary', null, 'k1'); D.listSetDone(d, 'L1', 'fit', true, 'Mary', null, 'k1');
  rec('sign-off resent with the same client id: one history line, one event', D.find(d, 'lists', 'L1').log.length === n0 + 1 && d.t.list_events.filter(e => e.cid === 'k1').length === 1);
  D.listAttach(d, 'L1', 'WO-7', true, 'O', 'k2'); D.listAttach(d, 'L1', 'WO-7', false, 'O', 'k3'); D.listAttach(d, 'L1', 'WO-7', true, 'O', 'k2');
  rec('attach resent after a later detach does not re-attach (same client id)', !D.find(d, 'lists', 'L1').wos.includes('WO-7'));
  r = D.listSetDone(d, 'L1', 'archive', true, 'Office');
  rec('archive mode: archived, history "Archived", nothing deleted', r.archived === true && r.log.some(x => x.what === 'Archived') && !!D.find(d, 'lists', 'L1'));
}
// save_list_revision
{
  const d = seed();
  const lines0 = d.t.list_lines.map(x => ({ id: x.id, seq: x.seq, kind: x.kind, part: x.part, qty: x.qty, material: x.material }));
  rec('stale version → error "stale"', throws(() => D.saveListRevision(d, { id: 'L1' }, lines0, 99, 'O', 'x'), /stale/));
  rec('no expected version on an existing list → stale', throws(() => D.saveListRevision(d, { id: 'L1' }, lines0, null, 'O', 'x'), /stale/));
  // unlocked list: edit in place, same rev
  let v = D.find(d, 'lists', 'L1').version;
  let out = D.saveListRevision(d, { id: 'L1', name: 'House 1A' }, lines0, v, 'O', null);
  rec('unlocked edit: rev stays 1, name changed, no revision copy', out.list.rev === 1 && out.list.name === 'House 1A' && d.t.list_revisions.length === 0);
  // lock it with a tick, then revise: change 1, add 1, remove 1 (already cut)
  D.applyLineChanges(d, [C({ id: 'L1:1', status: 'cut' }), C({ id: 'L1:3', status: 'cut' })], 'Saw');
  v = D.find(d, 'lists', 'L1').version;
  const lines1 = [
    { id: 'L1:1', seq: 1, kind: 'saw', part: 'Side', qty: '2', material: 'MFC White' },               // unchanged, cut
    { id: 'L1:2', seq: 2, kind: 'saw', part: 'Side', qty: '3', material: 'MFC White', reset: true }, // changed
    { id: 'L1:4', seq: 4, kind: 'fit', part: 'Hinge', qty: '2', material: 'MFC White' },
    { id: 'L1:5', seq: 5, kind: 'saw', part: 'Shelf', qty: '1', material: 'MFC White' },             // added
  ];                                                                                                  // L1:3 removed (was cut)
  // a tick lands mid-edit on the unchanged line L1:4 — must survive
  D.applyLineChanges(d, [C({ id: 'L1:4', status: 'got-out' })], 'Stores');
  rec('a tick on an already-locked list does not move the list version (the editor\'s save is not stale)', D.find(d, 'lists', 'L1').version === v);
  out = D.saveListRevision(d, { id: 'L1' }, lines1, v, 'PM', 'drawing changed');
  rec('locked list → rev 2 and the old lines kept in list_revisions', out.list.rev === 2 && d.t.list_revisions.length === 1 && d.t.list_revisions[0].rev === 1 && d.t.list_revisions[0].lines.length === 4);
  rec('unchanged cut line keeps its tick', L(d, 'L1:1').status === 'cut');
  rec('changed line → todo, changed_rev 2', L(d, 'L1:2').status === 'todo' && L(d, 'L1:2').changed_rev === 2);
  rec('mid-edit tick on an unchanged line survives (status never written without reset)', L(d, 'L1:4').status === 'got-out');
  rec('added line → added_rev 2', L(d, 'L1:5').added_rev === 2 && L(d, 'L1:5').status === 'todo');
  rec('removed line → removed_rev 2, still there, still cut (keep aside)', L(d, 'L1:3').removed_rev === 2 && L(d, 'L1:3').status === 'cut');
  rec('counts n_saw/n_fit from live lines', out.list.n_saw === 3 && out.list.n_fit === 1, out.list.n_saw + '/' + out.list.n_fit);
  rec('history: Revision 2 with reason', out.list.log.some(x => x.what === 'Revision 2' && x.why === 'drawing changed'));
  // new list
  out = D.saveListRevision(d, { id: 'L9', name: 'New', project_id: 'P1', wos: ['WO-9'] }, [{ id: 'L9:1', seq: 1, kind: 'saw', part: 'X', qty: '1' }], null, 'O', null);
  rec('new list created with its lines (rev 1, added_rev 1)', out.list.rev === 1 && out.list.wos[0] === 'WO-9' && L(d, 'L9:1').added_rev === 1);
  rec('a new list with an id that exists → stale (never overwrites)', throws(() => D.saveListRevision(d, { id: 'L9' }, [], null, 'O', null), /stale/));
  rec('a line id belonging to another list is refused, nothing written', throws(() => D.saveListRevision(d, { id: 'L9' }, [{ id: 'L1:1', kind: 'saw' }], D.find(d, 'lists', 'L9').version, 'O', null)) && L(d, 'L1:1').list_id === 'L1');
  // template edits always revise
  D.update(d, 'lists', D.find(d, 'lists', 'L9'), { is_template: true });
  out = D.saveListRevision(d, { id: 'L9' }, [{ id: 'L9:1', seq: 1, kind: 'saw', part: 'X', qty: '2', reset: true }], D.find(d, 'lists', 'L9').version, 'PM', 'type B change');
  rec('template save → rev +1 every time', out.list.rev === 2 && d.t.list_revisions.some(x => x.list_id === 'L9' && x.rev === 1));
}
// snags_to_list + trigger
{
  const d = seed();
  D.insert(d, 'projects', { id: 'P2', name: 'Crown' });
  ['S1', 'S2', 'S3'].forEach((id, i) => D.insert(d, 'snags', { id, project_id: i < 2 ? 'P1' : 'P2', raised_by: 'PM', kind: i === 1 ? 'fit' : 'saw', item: 'Door ' + i, material_id: i === 0 ? 'M1' : null, material_text: i === 2 ? 'Oak veneer' : null, where_text: 'Apt ' + (i + 1), qty: 2, raised_at: '2026-11-0' + (i + 1) + 'T09:00:00Z' }));
  const out = D.snagsToList(d, ['S1', 'S2', 'S3'], '2026-11-10', 'Prod');
  rec('two projects → two snag lists', out.length === 2);
  const l1 = d.t.lists.find(l => l.project_id === 'P1' && l.list_type === 'snag');
  rec('list: type snag, deliver_by set, name "Snags Aderrig 10 Nov", counts', l1 && l1.deliver_by === '2026-11-10' && l1.name === 'Snags Aderrig 10 Nov' && l1.n_saw === 1 && l1.n_fit === 1, l1 && l1.name);
  const s1 = D.find(d, 'snags', 'S1'), ln = L(d, s1.list_line_id);
  rec('snag on-list with list_id/list_line_id; line has snag_id, project material name, where in the note', s1.status === 'on-list' && s1.list_id === l1.id && ln.snag_id === 'S1' && ln.material === 'MFC White' && /Apt 1/.test(ln.note));
  const s3 = D.find(d, 'snags', 'S3');
  rec('free-typed material → material_other flag', L(d, s3.list_line_id).material_other === true && L(d, s3.list_line_id).material === 'Oak veneer');
  rec('second transfer of the same snags refused, no second list', throws(() => D.snagsToList(d, ['S1'], '2026-11-10', 'Prod2'), /not raised/) && d.t.lists.filter(l => l.list_type === 'snag').length === 2);
  D.insert(d, 'snags', { id: 'S4', project_id: 'P1', raised_by: 'PM', kind: 'saw', item: 'X' });
  rec('mixed batch with one already transferred → whole transfer refused, S4 stays raised', throws(() => D.snagsToList(d, ['S4', 'S2'], '2026-11-10', 'P')) && D.find(d, 'snags', 'S4').status === 'raised');
  D.applyLineChanges(d, [C({ id: s1.list_line_id, status: 'cut', rev: 1 })], 'Saw');
  rec('trigger: cutting the snag line moves the snag to cut', D.find(d, 'snags', 'S1').status === 'cut' && D.find(d, 'snags', 'S1').status_by === 'Saw');
  const s2 = D.find(d, 'snags', 'S2');
  D.applyLineChanges(d, [C({ id: s2.list_line_id, status: 'waiting', rev: 1 })], 'Stores');
  rec('trigger: parking a snag line does not move the snag', D.find(d, 'snags', 'S2').status === 'on-list');
  D.applyLineChanges(d, [C({ id: s2.list_line_id, status: 'got-out', rev: 1 })], 'Stores');
  rec('trigger: got-out moves the fittings snag to cut', D.find(d, 'snags', 'S2').status === 'cut');
}
// checks + no delete
{
  const d = seed();
  rec('bad status rejected by the check', throws(() => D.update(d, 'list_lines', L(d, 'L1:1'), { status: 'done' })) && L(d, 'L1:1').status === 'todo');
  rec('snag list type allowed, bogus type refused', !throws(() => D.insert(d, 'lists', { id: 'X1', name: 'x', list_type: 'snag' })) && throws(() => D.insert(d, 'lists', { id: 'X2', name: 'x', list_type: 'bogus' })));
  rec('project names unique ignoring case', throws(() => D.insert(d, 'projects', { id: 'P9', name: 'ADERRIG' })));
  rec('every update bumps version and updated_at', (() => { const l = D.find(d, 'lists', 'L1'), v = l.version; D.update(d, 'lists', l, { name: 'x' }); return l.version === v + 1; })());
}
console.log(res.filter(x => !x).length + ' failed of ' + res.length);
