// Project details fake database: project_spec_items + project_events from SUPABASE_CHANGES.md (2026-11-09 "Project details"
// block), on top of the Stores dockets fake (tests/stores-docket/dbd.js — untouched). The rules mirror the SQL triggers
// psi_rules / psi_log / lists_touch line by line (tests/project-details/pg-check.sql checks the real SQL). Never touches the network.
const DD = require('../stores-docket/dbd.js');
const D3 = require('../stage3/db3.js');
const { DbError, clone, find } = D3;
const TABLES = ['project_spec_items', 'project_events'];
const now = () => new Date().toISOString();
const t = v => (v == null ? '' : String(v)).trim();
function makeDb() { const d = DD.makeDb(); TABLES.forEach(x => { d.t[x] = []; }); d.seq.project_events = 1; return d; }
function ensure(d) { TABLES.forEach(x => { if (!d.t[x]) d.t[x] = []; }); if (!d.seq.project_events) d.seq.project_events = 1; }
const COLS = ['id', 'project_id', 'item', 'sort', 'is_extra', 'value', 'material_id', 'status', 'signed_by', 'signed_at', 'note', 'version', 'updated_at', 'updated_by'];
// psi_rules (BEFORE INSERT OR UPDATE)
function rules(n, old) {
  n.value = t(n.value) || null; n.item = t(n.item);
  if (n.value == null || n.value.toUpperCase() === 'TBC') n.status = 'not-specified';
  else if (old && old.status === 'signed-off' && n.status === 'signed-off' && n.value !== old.value) n.status = 'proposed';
  else if (n.status === 'not-specified') n.status = 'proposed';
  if (n.status !== 'signed-off') { n.signed_by = null; n.signed_at = null; }
  else if (!old || old.status !== 'signed-off') { n.signed_at = now(); n.signed_by = t(n.signed_by) || n.updated_by || '?'; }
  else { n.signed_at = old.signed_at; n.signed_by = old.signed_by; }
}
function check(n, d, self) {
  if (!['not-specified', 'proposed', 'signed-off'].includes(n.status)) throw new DbError('new row violates check constraint', '23514');
  if (n.status === 'signed-off' && (!t(n.value) || t(n.value).toUpperCase() === 'TBC')) throw new DbError('new row violates check constraint "psi_signed_needs_value"', '23514');
  if (!n.project_id || !find(d, 'projects', n.project_id)) throw new DbError('insert or update violates foreign key constraint', '23503');
  if (n.material_id && !find(d, 'project_materials', n.material_id)) throw new DbError('insert or update violates foreign key constraint', '23503');
  if (d.t.project_spec_items.some(x => x !== self && x.id !== n.id && x.project_id === n.project_id && t(x.item).toLowerCase() === t(n.item).toLowerCase()))
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
  rules(n, null); check(n, d, null);
  d.t.project_spec_items.push(n); log(d, n, null); return n;
}
function update(d, row, patch) {
  Object.keys(patch).forEach(k => { if (!COLS.includes(k)) throw new DbError('Could not find the \'' + k + '\' column of \'project_spec_items\' in the schema cache', 'PGRST204'); });
  const old = clone(row), n = Object.assign(clone(row), clone(patch));
  n.version = old.version + 1; n.updated_at = now(); // lists_touch
  rules(n, old); check(n, d, row);
  Object.keys(row).forEach(k => delete row[k]); Object.assign(row, n); log(d, row, old); return row;
}
module.exports = { TABLES, makeDb, ensure, insert, update, rules };
