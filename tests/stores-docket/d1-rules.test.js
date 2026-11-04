// Stores dockets D1: the rules of make_docket / docket_delivered / docket_cancel in the fake database (dbd.js mirrors
// the SQL in SUPABASE_CHANGES.md 2026-11-04; tests/stores-docket/pg-check.sql checks the same on a real Postgres).
// No browser, no network. Run: node tests/stores-docket/d1-rules.test.js
const DD = require('./dbd.js');
const D3 = DD.D3;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
function seed(at) {
  const d = DD.makeDb(); d.listStore = 'v2';
  d.clock = () => new Date(at || '2026-11-04T10:00:00Z');
  D3.insert(d, 'projects', { id: 'P1', name: 'Aderrig', customer: 'Aderrig Homes' });
  D3.insert(d, 'projects', { id: 'P2', name: 'Other' });
  D3.insert(d, 'lists', { id: 'L1', project_id: 'P1', name: 'House 1', wos: ['WO-1'] });
  D3.insert(d, 'lists', { id: 'L2', project_id: 'P2', name: 'Other', wos: ['WO-9'] });
  D3.insert(d, 'lists', { id: 'L3', project_id: 'P1', name: 'Old', wos: ['WO-2'], archived: true });
  [['fit', 'Tap', '20', 'todo'], ['fit', 'Hinge', '8', 'waiting'], ['buy', 'Worktop', '1', 'todo'], ['saw', 'Side', '2', 'todo'], ['fit', 'Handle', '2x2', 'todo'], ['fit', 'Bin', '1', 'na'], ['hdr', 'Kitchen', '', 'todo']]
    .forEach(([k, p, q, s], i) => D3.insert(d, 'list_lines', { id: 'L1:' + (i + 1), list_id: 'L1', seq: i + 1, kind: k, part: p, qty: q, status: s, material: 'Chrome' }));
  D3.insert(d, 'list_lines', { id: 'L2:1', list_id: 'L2', seq: 1, kind: 'fit', part: 'Tap', qty: '4' });
  D3.insert(d, 'list_lines', { id: 'L3:1', list_id: 'L3', seq: 1, kind: 'fit', part: 'Tap', qty: '4' });
  return d;
}
const L = (d, id) => D3.find(d, 'list_lines', id);
const mk = (d, items, extra, by) => DD.RPC.make_docket(d, { p_docket: Object.assign({ project_id: 'P1' }, extra || {}), p_items: items, p_by: by || 'Stores' });
const why = r => (r.refused || []).map(x => x.why).join(',');

{ // part quantities: 10 of 20, then 10 more; 11 refused
  const d = seed();
  let r = mk(d, [{ line_id: 'L1:1', qty: '10', wo: 'WO-1', floor: 'GF', unit: '1', title: 'House 1' }]);
  rec('first docket of 2026 is D26-0001', r.ok && r.docket_no === 'D26-0001', JSON.stringify(r));
  rec('10 of 20 sent: the line is NOT got out yet', L(d, 'L1:1').status === 'todo');
  const it = d.t.stores_docket_items[0];
  rec('docket item keeps its own copy: WO, Floor, Unit separate, title, item, qty 10, spec', it.wo === 'WO-1' && it.floor === 'GF' && it.unit === '1' && it.title === 'House 1' && it.item === 'Tap' && it.qty === 10 && it.spec === 'Chrome', JSON.stringify(it));
  rec('docket keeps project name and customer from the project', d.t.stores_dockets[0].project_name === 'Aderrig' && d.t.stores_dockets[0].customer === 'Aderrig Homes');
  r = mk(d, [{ line_id: 'L1:1', qty: '11' }]);
  rec('11 more refused: only 10 left (too-many, left 10, names D26-0001)', !r.ok && why(r) === 'too-many' && r.refused[0].left === 10 && r.refused[0].dockets === 'D26-0001', JSON.stringify(r));
  rec('a refused docket writes nothing (no docket, no number used)', d.t.stores_dockets.length === 1 && d.t.stores_docket_items.length === 1);
  r = mk(d, [{ line_id: 'L1:1', qty: '10' }]);
  rec('10 more: OK, D26-0002', r.ok && r.docket_no === 'D26-0002');
  rec('full 20 sent: the line is got out, by the sender', L(d, 'L1:1').status === 'got-out' && L(d, 'L1:1').status_by === 'Stores');
  rec('a "docket" event is written per line, with the docket number and "10 of 20"', d.t.list_events.some(e => e.line_id === 'L1:1' && e.act === 'docket' && e.note === 'D26-0002 · 10 of 20' && e.to_status === 'got-out'));
  rec('the list is locked once a line goes out', D3.find(d, 'lists', 'L1').locked === true);
  r = mk(d, [{ line_id: 'L1:1', qty: '1' }]);
  rec('a got-out line is refused (says which dockets)', !r.ok && why(r) === 'got-out' && r.refused[0].dockets === 'D26-0001, D26-0002', JSON.stringify(r));
  // cancel frees the quantity
  const d2 = d.t.stores_dockets.find(x => x.docket_no === 'D26-0002');
  rec('cancel needs a reason', throws(() => DD.RPC.docket_cancel(d, { p_id: d2.id, p_why: ' ', p_by: 'Stores', p_left: false }), /reason/));
  r = DD.RPC.docket_cancel(d, { p_id: d2.id, p_why: 'Wrong taps', p_by: 'Stores', p_left: false });
  const k2 = () => d.t.stores_dockets.find(x => x.id === d2.id); // a refused call puts the whole database back (a fresh copy)
  rec('cancel: docket kept, marked cancelled with the reason and who', r.ok && k2().status === 'cancelled' && k2().cancel_why === 'Wrong taps' && k2().cancelled_by === 'Stores' && d.t.stores_dockets.length === 2);
  rec('cancel: its items no longer count; the line goes back to to-pick', d.t.stores_docket_items.filter(i => i.docket_id === d2.id).every(i => !i.active) && L(d, 'L1:1').status === 'todo');
  r = mk(d, [{ line_id: 'L1:1', qty: '11' }]);
  rec('after cancel: 11 still refused (10 left), 10 OK', !r.ok && r.refused[0].left === 10 && mk(d, [{ line_id: 'L1:1', qty: '10' }]).ok);
  rec('cancelled numbers are never reused (next is D26-0003)', d.t.stores_dockets.map(x => x.docket_no).join() === 'D26-0001,D26-0002,D26-0003');
  rec('cancel twice: no change, says already (dup)', DD.RPC.docket_cancel(d, { p_id: d2.id, p_why: 'again', p_by: 'X', p_left: false }).dup === true && k2().cancel_why === 'Wrong taps');
}
{ // cancel asks "Did these items leave stores?" (Garry, 4 Nov) — p_left
  const d = seed();
  mk(d, [{ line_id: 'L1:1', qty: '20' }]); mk(d, [{ line_id: 'L1:3', qty: '1' }]);
  const a = d.t.stores_dockets[0], b = d.t.stores_dockets[1];
  rec('cancel without saying whether the items left: refused', throws(() => DD.RPC.docket_cancel(d, { p_id: a.id, p_why: 'x', p_by: 'S' }), /left stores/) && d.t.stores_dockets[0].status === 'made');
  let r = DD.RPC.docket_cancel(d, { p_id: a.id, p_why: 'Wrong paperwork', p_by: 'Stores', p_left: true });
  const ka = () => d.t.stores_dockets.find(x => x.id === a.id);
  rec('Yes, they left: docket CANCELLED (cancel_left true), the taps stay got out', r.ok && r.left === true && ka().status === 'cancelled' && ka().cancel_left === true && L(d, 'L1:1').status === 'got-out');
  rec('Yes: its items still count as sent — the same taps can\'t go on another docket', d.t.stores_docket_items.filter(i => i.docket_id === a.id).every(i => i.active) && !mk(d, [{ line_id: 'L1:1', qty: '1' }]).ok);
  rec('Yes: the history says "items left stores"', d.t.list_events.some(e => e.line_id === 'L1:1' && e.act === 'docket-cancel' && e.from_status === 'got-out' && e.to_status === 'got-out' && /items left stores/.test(e.note)));
  r = DD.RPC.docket_cancel(d, { p_id: b.id, p_why: 'Not sent', p_by: 'Stores', p_left: false });
  rec('No, still in stores: items free again (bought-in worktop can be sent again)', r.ok && r.left === false && d.t.stores_dockets.find(x => x.id === b.id).cancel_left === false && mk(d, [{ line_id: 'L1:3', qty: '1' }]).ok);
  rec('cancelling again (either answer) changes nothing', DD.RPC.docket_cancel(d, { p_id: a.id, p_why: 'y', p_by: 'S', p_left: false }).dup === true && ka().cancel_left === true && L(d, 'L1:1').status === 'got-out');
}
{ // refusals and kinds
  const d = seed();
  rec('waiting line refused ("release first")', why(mk(d, [{ line_id: 'L1:2', qty: '8' }])) === 'waiting');
  D3.applyLineChanges(d, [{ id: 'L1:2', act: 'release', cid: 'r1' }], 'Stores');
  rec('after Release: the same line can go', mk(d, [{ line_id: 'L1:2', qty: '8' }]).ok && L(d, 'L1:2').status === 'got-out');
  rec('saw line refused (wrong-kind)', why(mk(d, [{ line_id: 'L1:4', qty: '1' }])) === 'wrong-kind');
  rec('heading refused (wrong-kind)', why(mk(d, [{ line_id: 'L1:7', qty: '1' }])) === 'wrong-kind');
  rec('not-needed line refused', why(mk(d, [{ line_id: 'L1:6', qty: '1' }])) === 'not-needed');
  rec('a line from another project refused', why(mk(d, [{ line_id: 'L2:1', qty: '1' }])) === 'other-project');
  rec('a line on an archived list refused', why(mk(d, [{ line_id: 'L3:1', qty: '1' }])) === 'not-live');
  rec('qty 0 / blank / words refused (bad-qty)', ['0', '', 'ten'].every(q => why(mk(d, [{ line_id: 'L1:3', qty: q }])) === 'bad-qty'));
  rec('unknown line refused (missing)', why(mk(d, [{ line_id: 'nope', qty: '1' }])) === 'missing');
  rec('the same line twice on one docket: error', throws(() => mk(d, [{ line_id: 'L1:3', qty: '1' }, { line_id: 'L1:3', qty: '1' }]), /twice/));
  rec('one bad line refuses the whole docket (the good one is not sent)', !mk(d, [{ line_id: 'L1:3', qty: '1' }, { line_id: 'L1:4', qty: '1' }]).ok && !d.t.stores_docket_items.some(i => i.line_id === 'L1:3'));
  let r = mk(d, [{ line_id: 'L1:3', qty: '1' }, { line_id: 'L1:5', qty: '1' }]);
  rec('bought-in line goes out but keeps its status (the docket is its record)', r.ok && L(d, 'L1:3').status === 'todo');
  rec('"2x2" line goes as a whole line, text kept, and is got out', L(d, 'L1:5').status === 'got-out' && d.t.stores_docket_items.find(i => i.line_id === 'L1:5').qty_text === '2x2');
  rec('bought-in line fully sent: refused next time (sent)', why(mk(d, [{ line_id: 'L1:3', qty: '1' }])) === 'sent');
  rec('needs a name for who sent it', throws(() => mk(d, [{ item: 'x', qty: '1' }], {}, ' '), /who/));
  rec('needs at least one item', throws(() => mk(d, []), /at least one/));
  rec('a free item needs its item text and qty', why(mk(d, [{ item: '', qty: '1' }])) === 'no-item' && why(mk(d, [{ item: 'Spare', qty: '' }])) === 'no-qty');
}
{ // resend after a lost reply; switch off
  const d = seed();
  const a = mk(d, [{ line_id: 'L1:1', qty: '5' }], { cid: 'tap-1' }), b = mk(d, [{ line_id: 'L1:1', qty: '5' }], { cid: 'tap-1' });
  rec('the same tap resent (lost reply): the same docket, nothing doubled', a.ok && b.dup && b.docket_no === a.docket_no && d.t.stores_docket_items.length === 1);
  d.listStore = 'v1';
  rec('switch OFF: a docket with list lines is refused (switched off)', throws(() => mk(d, [{ line_id: 'L1:3', qty: '1' }]), /switched off/));
  const r = DD.RPC.make_docket(d, { p_docket: { project_name: 'Cherrywood', customer: 'Cairn' }, p_items: [{ item: 'Spare hinges', qty: '6', wo: 'WO-5', floor: '1', unit: '12' }], p_by: 'Stores' });
  rec('switch OFF: a free-typed docket works (project by name, no project id)', r.ok && d.t.stores_dockets.find(x => x.id === r.id).project_id === null && d.t.stores_dockets.find(x => x.id === r.id).project_name === 'Cherrywood');
  rec('a docket needs a project', throws(() => DD.RPC.make_docket(d, { p_docket: {}, p_items: [{ item: 'x', qty: '1' }], p_by: 'S' }), /project/));
  rec('switch OFF: cancelling a free-typed docket works', DD.RPC.docket_cancel(d, { p_id: r.id, p_why: 'test', p_by: 'S', p_left: false }).ok);
}
{ // delivered
  const d = seed();
  const a = mk(d, [{ item: 'Spare', qty: '2' }]), b = mk(d, [{ item: 'Spare', qty: '2' }]);
  rec('delivered needs who received it', throws(() => DD.RPC.docket_delivered(d, { p_id: a.id, p_received_by: '', p_by: 'S' }), /received/));
  let r = DD.RPC.docket_delivered(d, { p_id: a.id, p_received_by: 'Joe Site', p_received_at: '2026-11-05', p_signature_name: 'J Site', p_by: 'Office' });
  const k = d.t.stores_dockets.find(x => x.id === a.id);
  rec('delivered: received by, date, signed name, who marked it', r.ok && k.status === 'delivered' && k.received_by === 'Joe Site' && k.received_at === '2026-11-05' && k.signature_name === 'J Site' && k.delivered_by === 'Office');
  rec('a delivered docket can\'t be cancelled', DD.RPC.docket_cancel(d, { p_id: a.id, p_why: 'x', p_by: 'S', p_left: false }).why === 'delivered' && k.status === 'delivered');
  DD.RPC.docket_cancel(d, { p_id: b.id, p_why: 'x', p_by: 'S', p_left: false });
  rec('a cancelled docket can\'t be marked delivered', DD.RPC.docket_delivered(d, { p_id: b.id, p_received_by: 'Joe', p_by: 'S' }).why === 'cancelled');
}
{ // numbering by year (Irish time)
  const d = seed('2026-12-31T23:30:00Z');
  rec('31 Dec 23:30 (Irish time) is still 2026', mk(d, [{ item: 'x', qty: '1' }]).docket_no === 'D26-0001');
  d.clock = () => new Date('2027-01-01T00:30:00Z');
  rec('first docket of 2027 is D27-0001', mk(d, [{ item: 'x', qty: '1' }]).docket_no === 'D27-0001');
  rec('then D27-0002', mk(d, [{ item: 'x', qty: '1' }]).docket_no === 'D27-0002');
}
const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
