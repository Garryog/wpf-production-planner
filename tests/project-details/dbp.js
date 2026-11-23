// Project details fake database: project_spec_items + project_events from SUPABASE_CHANGES.md (2026-11-09 "Project details"
// block), on top of the Stores dockets fake (tests/stores-docket/dbd.js — untouched). The rules mirror the SQL triggers
// psi_rules / psi_log / lists_touch line by line (tests/project-details/pg-check.sql checks the real SQL). Never touches the network.
const DD = require('../stores-docket/dbd.js');
const D3 = require('../stage3/db3.js');
const { DbError, clone, find } = D3;
const TABLES = ['project_specs', 'project_spec_items', 'project_events'];
const now = () => new Date().toISOString();
const t = v => (v == null ? '' : String(v)).trim();
// psi_tbc(): blank, TBC, T.B.C., TBA, "to be confirmed / advised" (after NFKC, any whitespace)
const tbc = v => /^(|T\.? ?B\.? ?C\.?|T\.? ?B\.? ?A\.?|TO BE (CONFIRMED|ADVISED))$/.test(String(v == null ? '' : v).normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase());
function makeDb() { const d = DD.makeDb(); TABLES.forEach(x => { d.t[x] = []; }); d.seq.project_events = 1; return d; }
function ensure(d) { TABLES.forEach(x => { if (!d.t[x]) d.t[x] = []; }); if (!d.seq.project_events) d.seq.project_events = 1; }
const COLS = ['id', 'project_id', 'spec_id', 'item', 'sort', 'is_extra', 'value', 'material_id', 'status', 'signed_by', 'signed_at', 'note', 'version', 'updated_at', 'updated_by'];
// psi_rules (BEFORE INSERT OR UPDATE)
function rules(n, old) {
  n.value = String(n.value == null ? '' : n.value).normalize('NFKC').replace(/^\s+|\s+$/g, '') || null; n.item = String(n.item == null ? '' : n.item).normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (tbc(n.value)) n.status = 'not-specified';
  else if (old && old.status === 'signed-off' && n.status === 'signed-off' && n.value !== old.value) n.status = 'proposed';
  else if (n.status === 'not-specified') n.status = 'proposed';
  if (n.status !== 'signed-off') { n.signed_by = null; n.signed_at = null; }
  else if (!old || old.status !== 'signed-off') { n.signed_at = now(); n.signed_by = t(n.signed_by) || n.updated_by || '?'; }
  else { n.signed_at = old.signed_at; n.signed_by = old.signed_by; }
}
function check(n, d, self) {
  if (!['not-specified', 'proposed', 'signed-off'].includes(n.status)) throw new DbError('new row violates check constraint', '23514');
  if (n.status === 'signed-off' && tbc(n.value)) throw new DbError('new row violates check constraint "psi_signed_needs_value"', '23514');
  if (!n.spec_id) throw new DbError('null value in column "spec_id" of relation "project_spec_items" violates not-null constraint', '23502');
  if (!n.project_id || !find(d, 'projects', n.project_id)) throw new DbError('insert or update violates foreign key constraint', '23503');
  if (n.material_id && !find(d, 'project_materials', n.material_id)) throw new DbError('insert or update violates foreign key constraint', '23503');
  if (d.t.project_spec_items.some(x => x !== self && x.id !== n.id && x.spec_id === n.spec_id && t(x.item).toLowerCase() === t(n.item).toLowerCase()))
    throw new DbError('duplicate key value violates unique constraint "psi_uq"', '23505');
}
// psi_log (AFTER INSERT OR UPDATE) — written by the database, never by the app
function log(d, n, old) {
  if (old && n.value === old.value && n.status === old.status && n.item === old.item) return;
  const act = !old ? 'add' : n.status === 'signed-off' && old.status !== 'signed-off' ? 'sign-off' : old.status === 'signed-off' && n.status !== 'signed-off' ? 'unsign' : 'edit';
  d.t.project_events.push({ id: d.seq.project_events++, project_id: n.project_id, entity: 'spec', entity_id: n.id, act,
    old: old ? { value: old.value, status: old.status, item: old.item } : null,
    new: { value: n.value, status: n.status, item: n.item, signed_by: n.signed_by }, by: n.updated_by || '?', at: now() });
}
function insert(d, r) {
  ensure(d);
  if (r.id == null || r.id === '') throw new DbError('null value in column "id"', '23502');
  if (d.t.project_spec_items.some(x => x.id === r.id)) throw new DbError('duplicate key value violates unique constraint "project_spec_items_pkey"', '23505');
  Object.keys(r).forEach(k => { if (!COLS.includes(k)) throw new DbError('Could not find the \'' + k + '\' column of \'project_spec_items\' in the schema cache', 'PGRST204'); });
  const n = Object.assign({ sort: 0, is_extra: false, value: null, material_id: null, status: 'not-specified', signed_by: null, signed_at: null, note: null, version: 1, updated_at: now(), updated_by: null }, clone(r));
  rules(n, null); specOf(d, n); check(n, d, null);
  d.t.project_spec_items.push(n); log(d, n, null); return n;
}
function update(d, row, patch) {
  Object.keys(patch).forEach(k => { if (!COLS.includes(k)) throw new DbError('Could not find the \'' + k + '\' column of \'project_spec_items\' in the schema cache', 'PGRST204'); });
  const old = clone(row), n = Object.assign(clone(row), clone(patch));
  n.version = old.version + 1; n.updated_at = now(); // lists_touch
  n.spec_id = old.spec_id; // an item stays on its spec
  rules(n, old); specOf(d, n, old); check(n, d, row);
  Object.keys(row).forEach(k => delete row[k]); Object.assign(row, n); log(d, row, old); return row;
}
// psi_rules: an item takes its project from its spec
function specOf(d, n, old) { const s = n.spec_id ? d.t.project_specs.find(x => x.id === n.spec_id) : null; n.project_id = s ? s.project_id : null; if (n.spec_id && !s) throw new DbError('null value in column "project_id" violates not-null constraint', '23502');
  if (s && !s.active && (!old || n.value !== old.value || n.status !== old.status || n.item !== old.item)) throw new DbError('this spec is not used any more'); }
// project_specs: pspec_rules + lists_touch + the unique name per project
const SCOLS = ['id', 'project_id', 'name', 'spec_type', 'sort', 'active', 'version', 'updated_at', 'updated_by'];
const sname = v => String(v == null ? '' : v).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
function specCheck(d, n, self) {
  if (!n.name) throw new DbError('a spec needs a name');
  if (!['kitchens', 'robes', 'schools'].includes(n.spec_type)) throw new DbError('new row violates check constraint', '23514');
  if (!n.project_id || !find(d, 'projects', n.project_id)) throw new DbError('insert or update violates foreign key constraint', '23503');
  if (d.t.project_specs.some(x => x !== self && x.id !== n.id && x.project_id === n.project_id && sname(x.name).toLowerCase() === n.name.toLowerCase())) throw new DbError('duplicate key value violates unique constraint "pspec_uq"', '23505');
}
function insertSpec(d, r) {
  ensure(d);
  if (r.id == null || r.id === '') throw new DbError('null value in column "id"', '23502');
  Object.keys(r).forEach(k => { if (!SCOLS.includes(k)) throw new DbError('Could not find the \'' + k + '\' column of \'project_specs\' in the schema cache', 'PGRST204'); });
  if (d.t.project_specs.some(x => x.id === r.id)) throw new DbError('duplicate key value violates unique constraint "project_specs_pkey"', '23505');
  const n = Object.assign({ spec_type: 'kitchens', sort: 0, active: true, version: 1, updated_at: now(), updated_by: null }, clone(r));
  n.name = sname(n.name); specCheck(d, n, null); d.t.project_specs.push(n); slog(d, n, null); return n;
}
function updateSpec(d, row, patch) {
  Object.keys(patch).forEach(k => { if (!SCOLS.includes(k)) throw new DbError('Could not find the \'' + k + '\' column of \'project_specs\' in the schema cache', 'PGRST204'); });
  const n = Object.assign(clone(row), clone(patch)); n.name = sname(n.name);
  if (n.project_id !== row.project_id) throw new DbError('a spec stays on its project');
  if (row.active && !n.active && !d.t.project_specs.some(x => x !== row && x.project_id === row.project_id && x.active)) throw new DbError('a project keeps at least one spec');
  n.version = row.version + 1; n.updated_at = now(); specCheck(d, n, row);
  const old = clone(row); Object.keys(row).forEach(k => delete row[k]); Object.assign(row, n); slog(d, row, old); return row;
}
// pspec_log (AFTER INSERT OR UPDATE on project_specs)
function slog(d, n, old) {
  if (old && n.name === old.name && n.active === old.active && n.spec_type === old.spec_type) return;
  d.t.project_events.push({ id: d.seq.project_events++, project_id: n.project_id, entity: 'spec-sheet', entity_id: n.id, act: !old ? 'add' : old.active && !n.active ? 'retire' : n.active && !old.active ? 'bring-back' : 'rename',
    old: old ? { name: old.name, active: old.active, spec_type: old.spec_type } : null, new: { name: n.name, active: n.active, spec_type: n.spec_type }, by: n.updated_by || '?', at: now() });
}
module.exports = { TABLES, makeDb, ensure, insert, update, rules, insertSpec, updateSpec };
