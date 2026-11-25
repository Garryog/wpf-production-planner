// L1b (Job B part 3, step 5): the Excel job-info block can carry Floor / Unit / WO (or Work order) cells. lsParseGrid reads
// them into meta.floor / meta.unit / meta.wo; the old template still reads the same; a part called "Unit" with a quantity and
// sizes is still a part, a lone "Unit" heading still a heading. 📥 Import from Excel in a NEW list with no WO fills the
// Floor / Unit / Title boxes and looks the WO up; the Lists import preview shows each sheet's job. Run: node tests/seq/l1b-excel-job.test.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const XLSX = require(path.join(ROOT, 'xlsx.full.min.js'));
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = /\/\* lsParseGrid:start \*\/([\s\S]*?)\/\* lsParseGrid:end \*\//.exec(src);
eval(m[1] + ';global.lsParseGrid=lsParseGrid;');
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const P = aoa => lsParseGrid(aoa, { sheet: 'S1' });
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const OLD = [['Project', 'Aderrig', null, 'Date', '12/10/2026'], ['Title', 'HOUSE TYPE B'], ['Carcass material', 'MFC White'], COLS, ['Side', 2, 720, 560, 'MFC White'], ['Tap', 1]];
let p = P(OLD);
rec('old template: Project / Title / Date / Carcass read; Floor / Unit / WO blank; 2 parts', p.meta.project === 'Aderrig' && p.meta.title === 'HOUSE TYPE B' && p.meta.date === '2026-10-12' && p.meta.carcass === 'MFC White'
  && p.meta.floor === '' && p.meta.unit === '' && p.meta.wo === '' && p.rows.filter(r => r.k === 'part').length === 2, JSON.stringify(p.meta));
p = P([['Project', 'Aderrig', null, 'Date', '12/10/2026'], ['Floor', 'T09 ', 'Unit', ' 12', 'WO', 'WO-7'], ['Title', 'HOUSE TYPE B'], COLS, ['Side', 2, 720, 560, 'MFC White']]);
rec('new layout: "Floor | T09 | Unit | 12 | WO | WO-7" read (trimmed)', p.meta.floor === 'T09' && p.meta.unit === '12' && p.meta.wo === 'WO-7' && p.meta.title === 'HOUSE TYPE B' && p.rows.filter(r => r.k === 'part').length === 1 && !p.rows.some(r => /Floor|WO-7/.test(r.item)), JSON.stringify([p.meta, p.rows.map(r => r.item)]));
p = P([['Project:', 'Aderrig', 'Floor:', 'GF'], ['Work order no.', 'WO-12'], ['Unit:', 7], COLS, ['Side', 2, 720, 560, 'MFC White']]);
rec('labels with colons / "Work order no." on their own rows; a number unit', p.meta.floor === 'GF' && p.meta.unit === '7' && p.meta.wo === 'WO-12' && p.meta.project === 'Aderrig', JSON.stringify(p.meta));
p = P([COLS, ['Unit', 2, 720, 560, 'MFC White'], ['Unit'], ['Shelf', 1, 500, 300, 'MFC White']]);
rec('a part called "Unit" (qty + sizes) stays a part; a lone "Unit" heading stays a heading; no meta', p.meta.unit === '' && p.rows[0].k === 'part' && p.rows[0].item === 'Unit' && p.rows[1].k === 'hdr' && p.rows[1].item === 'Unit', JSON.stringify([p.meta, p.rows.map(r => r.k + ':' + r.item)]));
p = P([['WO', 'WO-9', 'Floor', 'T10'], COLS, ['Side', 2, 720, 560, 'MFC White']]);
rec('"WO | WO-9 | Floor | T10" (no unit): read, unit blank', p.meta.wo === 'WO-9' && p.meta.floor === 'T10' && p.meta.unit === '', JSON.stringify(p.meta));
p = P([['Floor', 'T09', 'Unit', '12'], COLS, ['Side', 2, 720, 560, 'MFC White'], ['Unit', 2], ['Floor', 1]]);
rec('(round 2) once the parts have started, "Unit | 2" / "Floor | 1" are parts, the job stays T09 / 12', p.meta.floor === 'T09' && p.meta.unit === '12' && p.rows.filter(r => r.k === 'part').map(r => r.item).join() === 'Side,Unit,Floor', JSON.stringify([p.meta, p.rows.map(r => r.item)]));
p = P([['Nr of units', 3], COLS, ['Side', 2, 720, 560, 'MFC White']]);
rec('"Nr of units" is still the units, not the Unit', p.meta.unit === '' && p.rows.some(r => r.k === 'hdr' && r.units === 3), JSON.stringify([p.meta, p.rows]));

const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(H.order({ wo: 'WO-7', customer: 'Aderrig Homes', floor: 'Block T09', unit: 'Apt 022', title: 'HOUSE TYPE B', dueDate: '2026-12-01', origDueDate: '2026-12-01' }));
    const S = X.makeServer(r);
    const t = await X.dev(browser, S, 'office'), pg = t.page;
    await pg.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await pg.setInputFiles('#me-xlfile', { name: 'house.xlsx', mimeType: 'application/octet-stream', buffer: xlsx({ 'House 22': [['Project', 'Aderrig'], ['Floor', 'T9', 'Unit', '22'], ['Title', 'HOUSE TYPE B <b>x</b>'], COLS, ['Side', 2, 720, 560, 'MFC White']] }) });
    await sleep(600);
    const s = await pg.evaluate(() => ({ wo: document.getElementById('me-wo').value, ok: (document.getElementById('me-jbok') || {}).innerText || '', rows: document.querySelectorAll('.me-ed [data-row]').length }));
    rec('editor import: Floor T9 / Unit 22 from the sheet → WO-7 looked up and filled; rows imported', s.wo === 'WO-7' && /Matched WO-7/.test(s.ok) && s.rows >= 1, JSON.stringify(s));
    await pg.evaluate(() => document.getElementById('me-jnot').click()); await sleep(150);
    rec('…and the boxes hold what the sheet said (title too)', await pg.evaluate(() => document.getElementById('me-jf').value === 'T9' && document.getElementById('me-ju').value === '22' && document.getElementById('me-jt').value === 'HOUSE TYPE B <b>x</b>'));
    await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // an old-template sheet into a new list: no boxes filled, no search
    await pg.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await pg.setInputFiles('#me-xlfile', { name: 'old.xlsx', mimeType: 'application/octet-stream', buffer: xlsx({ Old: OLD }) }); await sleep(600);
    rec('old template into a new list: rows in, boxes empty, nothing looked up', await pg.evaluate(() => !document.getElementById('me-wo').value && document.getElementById('me-jf').value === '' && document.querySelectorAll('.me-ed [data-row]').length >= 2));
    await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // Lists import preview: each sheet shows its job (escaped)
    await pg.evaluate(() => { showTab('l'); render(); }); await sleep(300);
    const sel = await pg.evaluate(() => document.getElementById('lh-file') ? '#lh-file' : '#lst-file');
    await pg.setInputFiles(sel, { name: 'two.xlsx', mimeType: 'application/octet-stream', buffer: xlsx({ 'House 22': [['Project', 'Aderrig'], ['Floor', 'T9', 'Unit', '22', 'WO', 'WO-7'], COLS, ['Side', 2, 720, 560, 'MFC White']], 'House 23': [['Project', 'Aderrig'], ['Floor', '<img src=x onerror="window.__x=1">'], COLS, ['Side', 2, 720, 560, 'MFC White']] }) });
    await sleep(800);
    const pv = await pg.evaluate(() => [...document.querySelectorAll('.imp-sh summary')].map(s => s.innerText));
    rec('Lists import preview: "House 22 · Floor T9 · Unit 22 · WO-7"', pv.some(x => /House 22 · Floor T9 · Unit 22 · WO-7/.test(x)), JSON.stringify(pv));
    rec('…escaped (no element made, nothing ran)', await pg.evaluate(() => window.__x === undefined && !document.querySelector('.imp-sh summary img')) && pv.some(x => /<img/.test(x)), JSON.stringify(pv));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
