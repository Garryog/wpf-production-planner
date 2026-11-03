// Coder (3 Nov, Tester round 2 HIGH 1): the fake database's "one live list per WO" rule, mirroring lists_one_per_wo /
// lists_one_replacement in SUPABASE_CHANGES.md. Pure node, no browser. Run: node tests/stage3/coder-onelist.test.js
const D = require('./db3.js');
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const err = f => { try { f(); return null; } catch (e) { return e; } };
const d = D.makeDb();
const save = (pl, by) => D.RPC.save_list_revision(d, { p_list: pl, p_lines: [], p_expect: null, p_by: by || 'T', p_reason: 'r' });
save({ id: 'X', name: 'House 14 (Excel)', source: 'excel' });
save({ id: 'C1', name: 'House 14', wos: ['WO-1'], one_per_wo: true });
let e = err(() => D.RPC.list_attach(d, { p_list: 'X', p_wo: 'WO-1', p_on: true, p_by: 'B', p_one: true }));
rec('"Use" (p_one) on a WO that already has a live list is refused, naming that list (detail = its id, hint = the WO)', e && /one list per WO/.test(e.message) && e.detail === 'C1' && e.hint === 'WO-1', e && e.message);
rec('…and nothing changed', D.find(d, 'lists', 'X').wos.length === 0 && d.t.list_events.length === 0);
e = err(() => save({ id: 'C2', name: 'from template', wos: ['WO-2', 'WO-1'], one_per_wo: true }));
rec('a new list with one_per_wo for two WOs, one of them taken: refused, nothing made', e && e.hint === 'WO-1' && !D.find(d, 'lists', 'C2'), e && e.message);
rec('without the flag (the office deliberately adds a wardrobes list) a second list is allowed', !err(() => save({ id: 'W1', name: 'Wardrobes', wos: ['WO-1'] })));
rec('…and "+ WO" (list_attach without p_one) is allowed too', !err(() => D.RPC.list_attach(d, { p_list: 'X', p_wo: 'WO-1', p_on: true, p_by: 'B' })));
D.RPC.list_set_done(d, { p_list: 'C1', p_mode: 'archive', p_on: true, p_by: 'T' }); D.RPC.list_set_done(d, { p_list: 'W1', p_mode: 'archive', p_on: true, p_by: 'T' }); D.RPC.list_attach(d, { p_list: 'X', p_wo: 'WO-1', p_on: false, p_by: 'B' });
rec('an archived list doesn\'t count', !err(() => save({ id: 'C3', name: 'again', wos: ['WO-1'], one_per_wo: true })));
save({ id: 'T1', name: 'Template', is_template: true, wos: ['WO-5'] });
rec('a template doesn\'t count', !err(() => save({ id: 'C5', name: 'h5', wos: ['WO-5'], one_per_wo: true })));
// Make new list from this: one live replacement per old list
save({ id: 'OLD', name: 'Old', wos: ['WO-9'] });
rec('first replacement of OLD is saved, its "List created" history line names OLD', !err(() => save({ id: 'N1', name: 'New 1', wos: ['WO-9'], replaces: 'OLD' })) && D.find(d, 'lists', 'N1').log[0].replaces === 'OLD');
e = err(() => save({ id: 'N2', name: 'New 2', wos: ['WO-9'], replaces: 'OLD' }));
rec('a second replacement of OLD (another PC) is refused, naming the first', e && /already been replaced/.test(e.message) && e.detail === 'N1' && !D.find(d, 'lists', 'N2'), e && e.message);
console.log(fail + ' failed of ' + (pass + fail));
process.exit(fail ? 1 : 0);
