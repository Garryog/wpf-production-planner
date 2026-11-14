// Shared set-up for the Cutting Lists page Project-filter tests (Garry, 11 Nov): six realistic projects in the fake
// lists tables (never the live Supabase), with lists, templates, jobs that need a list, a row waiting on material,
// a list waiting for its check, one list with NO project and one job whose customer is linked to no project.
const F = require('../stage3/fix3.js');
const { H, D } = F;
const PROJECTS = [
  ['P1', 'ELLIOTTS ADERRIG 4', 'Elliotts'], ['P2', 'CAIRN PARKSIDE PH3', 'Cairn Homes'], ['P3', 'GLENVEAGH CITYWEST', 'Glenveagh'],
  ['P4', 'DURKAN HANSFIELD', 'Durkan'], ['P5', 'TORCA OAKLANDS', 'Torca'], ['P6', 'BALLYMORE SEAMOUNT', 'Ballymore'],
];
const wo = (n, customer, unit, title, x) => H.order(Object.assign({ wo: 'WO-26-' + n, customer, unit: String(unit), title, step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', procAt: '2026-10-20' }, x || {}));
function orders() {
  return [
    wo(1410, 'ELLIOTTS ADERRIG 4', 10, 'HOUSE 10 KITCHEN TYPE 1L'), wo(1411, 'ELLIOTTS ADERRIG 4', 11, 'HOUSE 11 KITCHEN TYPE 2R'),
    wo(1412, 'ELLIOTTS ADERRIG 4', 12, 'HOUSE 12 KITCHEN TYPE 1R'), wo(1414, 'ELLIOTTS ADERRIG 4', 14, 'HOUSE 14 KITCHEN TYPE 2L'),
    wo(1416, 'ELLIOTTS ADERRIG 4', 16, 'HOUSE 16 KITCHEN TYPE 1L'),
    wo(2301, 'CAIRN PARKSIDE PH3', 1, 'APT 1 KITCHEN TYPE A'), wo(2302, 'CAIRN PARKSIDE PH3', 2, 'APT 2 KITCHEN TYPE A'), wo(2303, 'CAIRN PARKSIDE PH3', 3, 'APT 3 KITCHEN TYPE B'),
    wo(3105, 'GLENVEAGH CITYWEST', 5, 'HOUSE 5 KITCHEN'), wo(3106, 'GLENVEAGH CITYWEST', 6, 'HOUSE 6 KITCHEN'),
    wo(4007, 'DURKAN HANSFIELD', 7, 'HOUSE 7 WARDROBES'),
    wo(5020, 'TORCA OAKLANDS', 20, 'HOUSE 20 KITCHEN'),
    wo(9001, 'MURPHY ONE-OFF HOUSE', 1, 'ONE-OFF KITCHEN'), // customer linked to no project
  ];
}
// opt: { projects: extra [[id,name,customer]…], off: true (lists switch OFF), chk: false, evil: 'name for P6' }
function server(opt = {}) {
  const row = F.v2Row(Object.assign({ listChk: opt.chk !== false }, opt.settings || {})); row.orders = orders();
  if (opt.off) { delete row.settings.listStore; delete row.settings.listStoreAt; row.settings.lists.push({ id: 'OLD2', wb: 'W1', sheet: 'Old', name: 'House 12', project: 'Elliotts Aderrig', saw: 1, fit: 0, wos: ['WO-26-1412'], up: F.NOW }); }
  const S = F.makeServer(row), d = S.db;
  PROJECTS.concat(opt.projects || []).forEach(([id, name, customer]) => D.insert(d, 'projects', { id, name: id === 'P6' && opt.evil ? opt.evil : name, customer, cien_names: [name] }));
  D.insert(d, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' });
  const tpl = (id, pid, name) => F.seedList(S, id, { name, wos: [], list: { project_id: pid, is_template: true, type_name: name, source: 'template' } });
  const lst = (id, pid, name, wos, x, lines) => F.seedList(S, id, { name, wos, list: Object.assign({ project_id: pid }, x || {}), lines });
  tpl('T1L', 'P1', 'Kitchen Type 1L'); tpl('T1R', 'P1', 'Kitchen Type 1R'); tpl('T2L', 'P1', 'Kitchen Type 2L'); tpl('T2R', 'P1', 'Kitchen Type 2R');
  tpl('TCA', 'P2', 'Kitchen Type A'); tpl('TCB', 'P2', 'Kitchen Type B'); tpl('TG1', 'P3', 'Standard kitchen');
  lst('L12', 'P1', 'House 12', ['WO-26-1412'], {}, [['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { status: 'waiting', status_at: '2026-10-20T10:00:00Z', status_by: 'Saw Tom' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']]);
  lst('L14', 'P1', 'House 14', ['WO-26-1414'], { check_req: true, created_by: 'Ann' });
  lst('LC1', 'P2', 'Apt 1', ['WO-26-2301'], {}, [['saw', 'Side', '2', 720, 560, 'Oak Halifax', '', '', { status: 'waiting', status_at: '2026-10-20T11:00:00Z', status_by: 'Saw Tom' }]]);
  lst('LG5', 'P3', 'House 5', ['WO-26-3105']);
  lst('LD7', 'P4', 'House 7 wardrobes', ['WO-26-4007']);
  lst('LNP', null, 'Loose list', []);
  return S;
}
module.exports = { F, H, D, PROJECTS, orders, server };
