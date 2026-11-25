// The claim rule in the fake database (tests/seq/dbs.js) — the same scenario pg-check.sql runs on the real SQL (Job B part 3,
// step 2): keys come from the planner's own B0 functions; an upload line claims a row with the same line key, else (no WO) a
// "Start the sequence" row in the same house of the same kind; same file twice adds 0; two identical lines kept; "0" ≠ "G".
// (Round 2) an island line only claims an island row; a line with no product / name is not added twice. No browser. Run: node tests/seq/b0-claim.test.js
const D3 = require('../stage3/db3.js'), DS = require('./dbs.js');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const d = D3.makeDb(); DS.ensure(d); d.listStore = 'v2';
D3.insert(d, 'projects', { id: 'QP3', name: 'Q Claim' });
const ins = rows => DS.RPC.seq_insert(d, { p_project: 'QP3', p_rows: rows, p_after: null, p_by: 'John Burke' });
const st = (id, wo, f, u, t) => ({ id, wo, floor: f, unit: u, descr: t, kind: 'kitchen', src: 'start', match_how: 'start' });
let j = ins([st('QC1', 'QWO-1', 'T09', '12', 'HOUSE TYPE B'), st('QC2', 'QWO-2', 'G', '5', 'HOUSE TYPE A'), st('QC3', 'QWO-3', 'T09', '12', 'HOUSE TYPE B KITCHEN 2')]);
rec('Start rows: all 3 added (two kitchens in one house both kept)', j.added.length === 3, JSON.stringify(j));
const qc1 = D3.find(d, 'project_seq', 'QC1');
rec('Start row: no line key, house key T-9|12', qc1.line_key === null && qc1.house_key === 'T-9|12', JSON.stringify([qc1.line_key, qc1.house_key]));
const U = (id, f, u, p, n, kind, no) => ({ id, floor: f, unit: u, product: p, name: n, kind, line_no: no });
const file = p => [U(p + '1', 'Block T9', 'Apt 012', 'K8', 'HOUSE TYPE B', 'kitchen', 1), U(p + '2', 'T09', '12', 'K2', 'HOUSE TYPE B UTILITY', 'utility', 2),
  U(p + '3', 'T09', '12', 'K9', 'HOUSE TYPE B ISLAND', 'kitchen', 3), U(p + '4', 'T09', '12', 'K7', 'HOUSE TYPE B EXTRA', 'kitchen', 4),
  U(p + '5', '0', '5', 'K1', 'HOUSE TYPE A', 'kitchen', 5), U(p + '6', 'T09', '12', 'W2', 'BED 2', 'robes', 6), U(p + '7', 'T09', '12', 'W2', 'BED 2', 'robes', 7)];
j = ins(file('QU'));
rec('upload: kitchen line claims Start row QC1 (by house), an ISLAND line never claims a kitchen row (round 2) so EXTRA claims QC3, the rest added; "0"/5 is not "G"/5', JSON.stringify(j.added) === '["QU2","QU3","QU5","QU6","QU7"]'
  && j.skipped.map(s => s.existing_id + ':' + s.by).join() === 'QC1:house,QC3:house', JSON.stringify(j));
j = ins(file('QV'));
rec('same file again: 0 added, 7 skipped', j.added.length === 0 && j.skipped.length === 7, JSON.stringify(j));
rec('8 live rows in the project', DS.liveOf(d, 'QP3').length === 8);
j = DS.RPC.seq_insert(d, { p_project: 'QP3', p_rows: [{ id: 'QW1', wo: 'QWO-9', floor: 'G', unit: '5', product: 'K1', name: 'HOUSE TYPE A', kind: 'kitchen' }], p_by: 'Import' });
rec('a line WITH a WO never claims a Start row by house', JSON.stringify(j.added) === '["QW1"]', JSON.stringify(j));
j = ins([{ id: 'QN1', floor: 'T09', unit: '50', kind: 'kitchen', descr: 'KITCHEN', line_no: 1 }]); const j2 = ins([{ id: 'QN2', floor: 'T09', unit: '50', kind: 'kitchen', descr: 'KITCHEN', line_no: 1 }]);
rec('a line with no product / name: added once, the same file again adds 0', j.added.length === 1 && j2.added.length === 0, JSON.stringify([j, j2]));
j = ins([{ id: 'QI0', wo: 'QWO-I', floor: 'T09', unit: '60', descr: 'HOUSE TYPE B ISLAND', kind: 'kitchen', src: 'start', match_how: 'start' }]);
j = ins([{ id: 'QI1', floor: 'T09', unit: '60', product: 'K9', name: 'HOUSE TYPE B ISLAND', kind: 'kitchen', line_no: 1 }]);
rec('an island line claims an island Start row', j.added.length === 0 && j.skipped[0].existing_id === 'QI0', JSON.stringify(j));
const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
