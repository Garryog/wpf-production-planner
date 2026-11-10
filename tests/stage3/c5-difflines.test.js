// Stage 3 C5: diffLines — the revision comparison (pure function, no browser). Plan B "Locking and revisions" rules:
// 1 identical (part, L, W, qty, material, edging, kind) keep id + status; 2 leftovers with the same kind+part+section pair
// in order = CHANGED (reset to todo); 3 only new = ADDED; 4 only old = REMOVED (keep aside if already cut). A note-only
// change keeps the tick but is flagged. Also acceptance check 6 end to end through the fake save_list_revision.
// Run: node tests/stage3/c5-difflines.test.js
const fs = require('fs'), path = require('path');
const D = require('./db3.js');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const m = /\/\* diffLines:start \*\/([\s\S]*?)\/\* diffLines:end \*\//.exec(src);
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
if (!m) { rec('diffLines block found in index.html', false); console.log('1 failed of 1'); process.exit(0); }
const diffLines = new Function(m[1] + '\nreturn diffLines;')();

let n = 0;
const OL = (part, o = {}) => Object.assign({ id: 'L1:' + (++n), seq: n, kind: 'saw', section: null, part, length_mm: 720, width_mm: 560, qty: '2', material: 'MFC White', edging: '1mm', note: null, status: 'todo', removed_rev: null }, o);
const NL = (part, o = {}) => Object.assign({ kind: 'saw', section: null, part, length_mm: 720, width_mm: 560, qty: '2', material: 'MFC White', edging: '1mm', note: null }, o);
const ids = a => a.map(x => x.id).join(',');
const byId = (r, id) => r.lines.find(x => x.id === id);

// 1. identical → nothing changes
{
  n = 0; const old = [OL('Side'), OL('Top', { status: 'cut' }), OL('Hinge', { kind: 'fit', length_mm: null, width_mm: null, qty: '8' })];
  const r = diffLines(old, [NL('Side'), NL('Top'), NL('Hinge', { kind: 'fit', length_mm: null, width_mm: null, qty: '8' })], { listId: 'L1' });
  rec('1 identical list: all ids kept, nothing reset/added/removed', ids(r.lines) === 'L1:1,L1:2,L1:3' && !r.changed.length && !r.added.length && !r.removed.length && r.lines.every(x => !x.reset), JSON.stringify(r.summary));
  rec('1 seq follows the new order', r.lines.map(x => x.seq).join() === '1,2,3');
}
// 2. one quantity changed → changed (same id, reset)
{
  n = 0; const old = [OL('Side', { status: 'cut' }), OL('Top', { status: 'cut' })];
  const r = diffLines(old, [NL('Side'), NL('Top', { qty: '3' })], { listId: 'L1' });
  rec('2 qty changed: paired by kind+part+section, same id, reset, flagged CHANGED', ids(r.lines) === 'L1:1,L1:2' && byId(r, 'L1:2').reset === true && !byId(r, 'L1:1').reset && r.changed.join() === 'L1:2', JSON.stringify(r.lines));
}
// 3. note-only change keeps the tick, flagged
{
  n = 0; const old = [OL('Side', { status: 'cut', note: 'grain up' })];
  const r = diffLines(old, [NL('Side', { note: 'grain across' })], { listId: 'L1' });
  rec('3 note only: same id, NOT reset (tick kept), flagged noteOnly', ids(r.lines) === 'L1:1' && !byId(r, 'L1:1').reset && r.noteOnly.join() === 'L1:1' && !r.changed.length && byId(r, 'L1:1').note === 'grain across', JSON.stringify(r));
}
// 4. renamed part → removed + added
{
  n = 0; const old = [OL('Side', { status: 'cut' })];
  const r = diffLines(old, [NL('End panel')], { listId: 'L1' });
  rec('4 renamed part: old removed (kept aside — already cut), new added with a new id', r.removed.join() === 'L1:1' && r.keepAside.join() === 'L1:1' && r.added.length === 1 && r.added[0] === 'L1:2' && r.lines.length === 1, JSON.stringify(r));
}
// 5. same part, different section, changed size → not paired
{
  n = 0; const old = [OL('Shelf', { section: 'KITCHEN' })];
  const r = diffLines(old, [NL('Shelf', { section: 'UTILITY', length_mm: 900 })], { listId: 'L1' });
  rec('5 same part in a different section with a new size: removed + added, never paired', r.removed.join() === 'L1:1' && r.added.length === 1 && !r.changed.length, JSON.stringify(r.summary));
  n = 0; const old2 = [OL('Shelf', { section: 'KITCHEN', status: 'cut' })];
  const r2 = diffLines(old2, [NL('Shelf', { section: 'UTILITY' })], { listId: 'L1' });
  rec('5b identical line moved to another section keeps its id and tick (rule 1 ignores section)', ids(r2.lines) === 'L1:1' && !byId(r2, 'L1:1').reset && byId(r2, 'L1:1').section === 'UTILITY', JSON.stringify(r2.lines));
}
// 6. kind differs → never paired
{
  n = 0; const old = [OL('Gola rail', { kind: 'saw' })];
  const r = diffLines(old, [NL('Gola rail', { kind: 'fit', length_mm: null, width_mm: null })], { listId: 'L1' });
  rec('6 same name, saw ↔ fittings: removed + added', r.removed.length === 1 && r.added.length === 1 && !r.changed.length);
}
// 7. two identical lines: one taken out → the uncut one goes, the cut one stays
{
  n = 0; const old = [OL('Side'), OL('Side', { status: 'cut' })];
  const r = diffLines(old, [NL('Side')], { listId: 'L1' });
  rec('7 two identical lines, one removed: the CUT one is kept, the uncut one removed (no keep-aside)', ids(r.lines) === 'L1:2' && r.removed.join() === 'L1:1' && !r.keepAside.length, JSON.stringify(r));
  n = 0; const o2 = [OL('Side', { status: 'cut' }), OL('Side')];
  const r2 = diffLines(o2, [NL('Side'), NL('Side')], { listId: 'L1' });
  rec('7b two identical lines, both kept: each keeps its own id and status', ids(r2.lines) === 'L1:1,L1:2' && r2.lines.every(x => !x.reset));
}
// 8. duplicates changed → paired in order
{
  n = 0; const old = [OL('Side', { status: 'cut' }), OL('Side')];
  const r = diffLines(old, [NL('Side', { qty: '3' }), NL('Side', { qty: '3' })], { listId: 'L1' });
  rec('8 two identical lines both changed: paired in order, both reset', ids(r.lines) === 'L1:1,L1:2' && r.lines.every(x => x.reset) && r.changed.join() === 'L1:1,L1:2', JSON.stringify(r.lines.map(x => x.id + ':' + x.reset)));
  n = 0; const o3 = [OL('Side', { qty: '2' }), OL('Side', { qty: '4' })];
  const r3 = diffLines(o3, [NL('Side', { qty: '4' }), NL('Side', { qty: '5' })], { listId: 'L1' });
  rec('8b exact matches first, then leftovers pair: qty 4 keeps L1:2, qty 2→5 is L1:1 changed', byId(r3, 'L1:2') && !byId(r3, 'L1:2').reset && byId(r3, 'L1:1').reset && byId(r3, 'L1:1').qty === '5' && r3.lines[0].id === 'L1:2', JSON.stringify(r3.lines));
}
// 9. formatting noise is not a change
{
  n = 0; const old = [OL('Side', { length_mm: 720, qty: '2', material: 'MFC White', edging: '1mm' })];
  const r = diffLines(old, [NL(' side ', { length_mm: '720.0', qty: 2, material: 'mfc white ', edging: '1MM' })], { listId: 'L1' });
  rec('9 spacing, case and 720 vs "720.0" are not changes', ids(r.lines) === 'L1:1' && !r.changed.length && !r.added.length, JSON.stringify(r.summary));
  const r2 = diffLines([OL('Side', { qty: '2x2' })], [NL('Side', { qty: '4' })], { listId: 'L1' });
  rec('9b "2x2" → "4" is a change (never guessed)', r2.changed.length === 1);
}
// 10. lines removed in an earlier revision are history: ignored, and their ids are never reused
{
  n = 0; const old = [OL('Side'), OL('Back', { removed_rev: 2 }), OL('Top')];
  const r = diffLines(old, [NL('Side'), NL('Top'), NL('Back'), NL('Shelf')], { listId: 'L1' });
  rec('10 a previously removed line is not brought back by matching; new ids continue after the highest seq', !r.lines.some(x => x.id === 'L1:2') && r.added.join() === 'L1:4,L1:5' && !r.removed.length, JSON.stringify(r.added));
}
// 11. headers
{
  n = 0; const old = [OL('KITCHEN', { kind: 'hdr', length_mm: null, width_mm: null, qty: null, material: null, edging: null })];
  const r = diffLines(old, [NL('KITCHEN', { kind: 'hdr', length_mm: null, width_mm: null, qty: null, material: null, edging: null })], { listId: 'L1' });
  rec('11 header rows match like any line', ids(r.lines) === 'L1:1' && !r.changed.length);
}
// 12. empty → everything added / everything removed; never mutates its input
{
  n = 0; const old = [OL('Side', { status: 'cut' }), OL('Top')]; const snap = JSON.stringify(old); const nw = [NL('X')]; const ns = JSON.stringify(nw);
  const r = diffLines(old, [], { listId: 'L1' }); const r2 = diffLines([], nw, { listId: 'L9' });
  rec('12 all lines taken out: both removed, the cut one kept aside', r.removed.join() === 'L1:1,L1:2' && r.keepAside.join() === 'L1:1' && !r.lines.length);
  rec('12b new list: all added with ids listId:1…', ids(r2.lines) === 'L9:1' && r2.added.join() === 'L9:1');
  diffLines(old, nw, { listId: 'L1' });
  rec('12c pure: inputs never changed', JSON.stringify(old) === snap && JSON.stringify(nw) === ns);
  rec('12d summary text "REV n — 2 changed, 1 added, 1 removed" style counts', (() => { const s = diffLines([OL('A'), OL('B'), OL('C')], [NL('A', { qty: '9' }), NL('B', { qty: '9' }), NL('D')], { listId: 'L1' }).summary; return s.changed === 2 && s.added === 1 && s.removed === 1; })());
}
// 13. Acceptance check 6 through the fake save_list_revision: change 1, add 1, remove 1 already cut
{
  const d = D.makeDb();
  D.insert(d, 'lists', { id: 'L1', name: 'House 1', wos: ['WO-1'] });
  const base = [['Side', '2'], ['Top', '1'], ['Back', '1'], ['Shelf', '3']];
  base.forEach(([p, q], i) => D.insert(d, 'list_lines', { id: 'L1:' + (i + 1), list_id: 'L1', seq: i + 1, kind: 'saw', part: p, qty: q, length_mm: 720, width_mm: 560, material: 'MFC White', edging: '1mm' }));
  D.applyLineChanges(d, [{ id: 'L1:1', status: 'cut', cid: 'a', rev: 1 }, { id: 'L1:2', status: 'cut', cid: 'b', rev: 1 }, { id: 'L1:3', status: 'cut', cid: 'c', rev: 1 }], 'Saw'); // locks the list
  const old = d.t.list_lines.filter(x => x.list_id === 'L1');
  const edited = [NL('Side', { qty: '2' }), NL('Top', { qty: '2' }), NL('Shelf', { qty: '3' }), NL('Plinth', { qty: '1' })]; // Top changed, Back (cut) removed, Plinth added
  const r = diffLines(old, edited, { listId: 'L1' });
  const out = D.saveListRevision(d, { id: 'L1' }, r.lines, D.find(d, 'lists', 'L1').version, 'PM', 'drawing changed');
  const L = id => D.find(d, 'list_lines', id);
  rec('A6: rev 2, old copy kept', out.list.rev === 2 && d.t.list_revisions.length === 1);
  rec('A6: unchanged cut line keeps its tick', L('L1:1').status === 'cut' && !L('L1:1').changed_rev);
  rec('A6: changed line resets to todo with CHANGED (changed_rev 2)', L('L1:2').status === 'todo' && L('L1:2').changed_rev === 2 && r.changed.join() === 'L1:2');
  rec('A6: removed line kept, marked removed, still cut → keep aside', L('L1:3').removed_rev === 2 && L('L1:3').status === 'cut' && r.keepAside.join() === 'L1:3');
  rec('A6: added line is new (added_rev 2), id after the highest seq', L('L1:5') && L('L1:5').added_rev === 2 && r.added.join() === 'L1:5');
  rec('A6: summary 1 changed, 1 added, 1 removed', r.summary.changed === 1 && r.summary.added === 1 && r.summary.removed === 1, JSON.stringify(r.summary));
}
console.log(res.filter(x => !x).length + ' failed of ' + res.length);
