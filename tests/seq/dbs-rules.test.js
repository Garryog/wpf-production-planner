// The fake database (tests/seq/dbs.js) against the SQL rules for identical upload lines (Garry 10 Nov): two identical
// lines in one house = two rows; loading the same file again adds nothing; three identical lines add one more; a removed
// line can be restored even if the same line is there again; a WO on a live row still blocks a restore. No browser.
// Run: node tests/seq/dbs-rules.test.js
const D3 = require('../stage3/db3.js'), DS = require('./dbs.js');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 200) : '')); };
const d = D3.makeDb(); DS.ensure(d); d.listStore = 'v2';
D3.insert(d, 'projects', { id: 'QP1', name: 'A' });
const L = (id, u, p, n, x) => Object.assign({ id, floor: 'T09', unit: u, product: p, name: n }, x || {});
let j = DS.RPC.seq_insert(d, { p_project: 'QP1', p_rows: [L('Q1', '12', 'K8', 'HOUSE TYPE B'), L('Q4', '13', 'W2', 'BED 2'), L('Q5', '13', 'W2', 'BED 2')], p_by: 'J' });
rec('two identical lines: both added', j.added.length === 3 && j.skipped.length === 0, JSON.stringify(j));
j = DS.RPC.seq_insert(d, { p_project: 'QP1', p_rows: [L('Q21', '12', 'K8', 'house type b'), L('Q24', '13', 'W2', 'BED 2', { line_no: 5 }), L('Q25', '13', 'W2', 'bed 2 ', { line_no: 6 })], p_by: 'J' });
rec('same file again: 0 added, skip entries point at Q1 / Q4 / Q5', j.added.length === 0 && j.skipped.map(s => s.existing_id).join() === 'Q1,Q4,Q5' && j.skipped[2].line_no === 6 && j.skipped[2].why === 'already in the sequence', JSON.stringify(j.skipped));
j = DS.RPC.seq_insert(d, { p_project: 'QP1', p_rows: [L('Q31', '13', 'W2', 'BED 2'), L('Q32', '13', 'W2', 'BED 2'), L('Q33', '13', 'W2', 'BED 2')], p_by: 'J' });
rec('three identical lines: one more added', JSON.stringify(j.added) === '["Q33"]' && j.skipped.length === 2, JSON.stringify(j));
DS.seqInsert(d, L('Q40', '12', 'K8', 'HOUSE TYPE B', { project_id: 'QP1' }));
rec('a direct insert of the same line is allowed now', !!D3.find(d, 'project_seq', 'Q40'));
DS.RPC.seq_remove(d, { p_id: 'Q1', p_by: 'M', p_why: 'x' });
rec('restore of a line that is there again: allowed, at the bottom', DS.RPC.seq_restore(d, { p_id: 'Q1', p_by: 'M' }).ok === true && DS.liveOf(d, 'QP1').slice(-1)[0].id === 'Q1');
DS.RPC.seq_insert(d, { p_project: 'QP1', p_rows: [{ id: 'W1', wo: 'WO-9' }], p_by: 'I' }); DS.RPC.seq_remove(d, { p_id: 'W1', p_by: 'M', p_why: 'x' });
DS.RPC.seq_insert(d, { p_project: 'QP1', p_rows: [{ id: 'W2', wo: 'WO-9' }], p_by: 'I' });
const r = DS.RPC.seq_restore(d, { p_id: 'W1', p_by: 'M' });
rec('restore still refused when its WO is on a live row', r.ok === false && r.err === 'WO already in a sequence', JSON.stringify(r));
d.listStore = 'v1';
const off = ['seq_move', 'seq_insert', 'seq_match', 'seq_unmatch', 'seq_remove', 'seq_restore'].filter(f => { try { DS.RPC[f](d, { p_ids: ['Q4'], p_id: 'Q4', p_project: 'QP1', p_rows: [], p_why: 'x', p_wo: 'X' }); return true; } catch (e) { return !/switched on/.test(e.message); } });
rec('switched off: all six functions refuse', off.length === 0, off.join());
const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
