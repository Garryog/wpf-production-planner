// Simple lists step 1 (Garry, 4 Nov): the database rules for "Bought in" lines (kind 'buy') and "Checked by" before the
// saw — in the Stage 3 SQL (SUPABASE_CHANGES.md) and mirrored in the fake database (tests/stage3/db3.js).
// No browser, no network. Run: node tests/editor/s1-sql-check-buy.test.js
const fs = require('fs'), path = require('path');
const D = require('../stage3/db3.js');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const sql = fs.readFileSync(path.join(__dirname, '../../SUPABASE_CHANGES.md'), 'utf8').split('## 2026-11-02')[1].split('## 2026-10-20')[0];
const has = (n, re) => rec('SQL: ' + n, re.test(sql));
has('list_lines kind allows buy (create table)', /check\(kind in\('saw','fit','hdr','buy'\)\)/);
has('kind check re-added on an existing table (safe to run twice)', /drop constraint if exists list_lines_kind_check;\s*alter table list_lines add constraint list_lines_kind_check check\(kind in\('saw','fit','hdr','buy'\)\)/);
['check_req boolean not null default false', 'checked_by text', 'checked_at timestamptz'].forEach(c => has('lists column ' + c, new RegExp('add column if not exists ' + c.replace(/ /g, '\\s+'))));
has("list_set_done mode 'check'", /p_mode='check'/);
has('a new list starts waiting for its check', /check_req,checked_by,checked_at,log\)/);
has('an edit clears the check', /check_req=case when isnew then check_req else true end/);
has('no new function, so no new GRANT needed (save_list_revision / list_set_done keep their grants)', /grant execute on function save_list_revision\(jsonb,jsonb,int,text,text\)/);

const d = D.makeDb(), by = 'Ann';
D.insert(d, 'projects', { id: 'P1', name: 'Aspect' });
const L = (id, kind, part, extra) => Object.assign({ id, seq: 1, kind, part, qty: '1' }, extra || {});
// a template with a bought-in line
let out = D.saveListRevision(d, { id: 'T1', name: 'Type A', project_id: 'P1', is_template: true }, [L('T1:1', 'saw', 'Kicker', { length_mm: 2400, width_mm: 150 }), Object.assign(L('T1:2', 'buy', 'Panel Back', { length_mm: 900, width_mm: 1842 }), { seq: 2 })], null, by, null);
rec("a 'buy' line is accepted and not counted as saw or stores", out.lines.some(x => x.kind === 'buy') && out.list.n_saw === 1 && out.list.n_fit === 0, JSON.stringify(out.list));
let bad = ''; try { D.insert(d, 'list_lines', { id: 'X', list_id: 'T1', seq: 9, kind: 'nope' }); } catch (e) { bad = e.code; }
rec('any other kind is still refused', bad === '23514');
rec('a new list (template too) waits for its check', out.list.check_req === true && out.list.checked_at == null);
// the saw can never tick a bought-in line
const r0 = D.applyLineChanges(d, [{ id: 'T1:2', status: 'cut', rev: 1, cid: 'c1' }], 'Saw');
rec('a bought-in line can never be ticked cut (wrong kind)', r0[0].ok === false && r0[0].why === 'wrong-kind', JSON.stringify(r0));
// check the template
D.listSetDone(d, 'T1', 'check', true, 'Des', null, 'c2');
let t = D.find(d, 'lists', 'T1');
rec('list_set_done check: who and when, with a history line', t.checked_by === 'Des' && !!t.checked_at && t.log.slice(-1)[0].what === 'Checked');
// a list confirmed from the checked template (same rev) is checked by the template's checker
out = D.saveListRevision(d, { id: 'L1', name: 'House 1', project_id: 'P1', template_id: 'T1', template_rev: 1, source: 'template', wos: ['WO-1'] }, [L('L1:1', 'saw', 'Kicker')], null, 'Bob', null);
rec('from a CHECKED template: checked by the template checker', out.list.checked_by === 'Des' && !!out.list.checked_at && out.list.log.some(e => e.what === 'Checked' && /checked by Des/.test(e.why)), JSON.stringify(out.list.log));
out = D.saveListRevision(d, { id: 'L2', name: 'House 2', project_id: 'P1', template_id: 'T1', template_rev: 2, source: 'template', wos: ['WO-2'] }, [L('L2:1', 'saw', 'Kicker')], null, 'Bob', null);
rec('a different template revision: NOT checked', out.list.checked_at == null && out.list.check_req === true);
out = D.saveListRevision(d, { id: 'L3', name: 'House 3', project_id: 'P1', template_id: 'T1', template_rev: 1, source: 'manual', wos: ['WO-3'] }, [L('L3:1', 'saw', 'Kicker')], null, 'Bob', null);
rec('typed in the editor (not a template copy): NOT checked', out.list.checked_at == null);
// an edit clears the check
D.listSetDone(d, 'L3', 'check', true, 'Des', null, 'c3');
out = D.saveListRevision(d, { id: 'L3', name: 'House 3' }, [L('L3:1', 'saw', 'Kicker', { qty: '2' })], D.find(d, 'lists', 'L3').version, 'Bob', 'more');
rec('editing a checked list clears the check', out.list.checked_at == null && out.list.checked_by == null && out.list.check_req === true);
// editing the template clears its check: new copies are not checked
out = D.saveListRevision(d, { id: 'T1', name: 'Type A' }, [L('T1:1', 'saw', 'Kicker', { qty: '3' })], D.find(d, 'lists', 'T1').version, 'Des', 'x');
rec('editing a template clears its check', out.list.checked_at == null && out.list.rev === 2);
// check taken away
D.listSetDone(d, 'L1', 'check', false, 'Des', 'wrong colour', 'c4');
t = D.find(d, 'lists', 'L1');
rec('check taken away (off)', t.checked_at == null && t.log.slice(-1)[0].what === 'Check taken away');
// lists not made by save_list_revision (migrated, snag lists) do not need a check
D.insert(d, 'lists', { id: 'M1', name: 'Migrated', project_id: 'P1', source: 'migrated' });
rec('a migrated list does not need a check (check_req false)', D.find(d, 'lists', 'M1').check_req === false);
const pass = res.filter(Boolean).length;
console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
process.exit(res.length - pass ? 1 : 0);
