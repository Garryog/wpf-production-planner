// Tester attack 1 on the Excel cutting-list import (switch ON, fake Supabase only):
//  - totals saved = totals in the Excel file (cached values) for every house sheet
//  - the same file imported twice → no duplicate lists, no new revision
//  - a variant workbook: sheet names with odd case / trailing spaces ("Blank ", "INDEX", "stock"), a units cell that is a
//    formula to ANOTHER sheet with no saved value → quantities can't be worked out: the person must be told
//  - heading lines never add to the totals (sheet calculator, combined list)
// Run: node tests/editor/attack1-import.test.js
const path = require('path'), fs = require('fs');
const F = require('../stage3/fix3.js');
const { H, D } = F;
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const FX = path.join(__dirname, '..', 'fixtures');
if (!fs.existsSync(path.join(FX, 'cutting-list-customer-a.xlsx'))) require(path.join(FX, 'make-fixtures.js'));
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 600))); };
const waitFor = async (p, fn, ms = 5000) => { for (let i = 0; i < ms / 100; i++) { if (await p.evaluate(fn)) return true; await F.sleep(100); } return false; };

// the Excel totals: for each sheet, sum of column B (cached value) over rows with a numeric length AND width
function excelTotals(file) {
  const wb = XLSX.read(fs.readFileSync(path.join(FX, file))), out = {};
  wb.SheetNames.forEach(sn => { if (/^(blank|index|stock|door stock)$/i.test(sn.trim())) return; const ws = wb.Sheets[sn], rg = XLSX.utils.decode_range(ws['!ref']); let s = 0;
    for (let r = rg.s.r; r <= rg.e.r; r++) { const g = c => ws[XLSX.utils.encode_cell({ r, c })]; const L = g(2), W = g(3), Q = g(1);
      if (L && W && typeof L.v === 'number' && typeof W.v === 'number' && Q && typeof Q.v === 'number') s += Q.v; }
    out[sn.trim()] = s; });
  return out;
}
// variant workbook built here: odd sheet names, units cell = formula to another sheet with no cached value
function variant() {
  const wb = XLSX.utils.book_new();
  const ws = (rows) => XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws([['Site', 'Road'], ['Site A', 'Road 3']]), 'INDEX');
  XLSX.utils.book_append_sheet(wb, ws([['900 Single Rail'], [null, 1, 'total nr of units'], ['Side Panel', 2, 2380, 570, 'W/W', 'L1LE 1mm']]), 'Blank ');
  XLSX.utils.book_append_sheet(wb, ws([['Board', 'Qty', 'Length', 'Width', 'Colour'], ['W/W 18mm', 40, 2440, 1220, 'W/W']]), 'stock');
  const s = ws([['Project', 'Customer A'], ['Description', 'Qty', 'Length', 'Width', 'Colour', 'Edging'], ['900 Single Rail'], [null, null, 'total nr of units'], ['Side Panel', null, 2380, 570, 'W/W', 'L1LE 1mm'], ['Shelves', null, 864, 570, 'W/W', 'L1LE 1mm']]);
  s['B4'] = { t: 'n', f: 'INDEX!C2' };      // units from another sheet, no saved value
  s['B5'] = { t: 'n', f: '$B$4*2' };        // per-unit formulas, no saved values
  s['B6'] = { t: 'n', f: '$B$4*3' };
  XLSX.utils.book_append_sheet(wb, s, 'Road 3 No 7');
  const file = path.join(FX, 'attack1-variant-nocache.xlsx');
  fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  return file;
}
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  ['W/W', 'WHB', 'W/W Vinyl'].forEach((n, i) => D.insert(S.db, 'project_materials', { id: 'MX' + i, project_id: 'P1', name: n, kind: 'sheet' }));
  const o = await F.dev(browser, S, 'office');
  await o.page.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : 'Tester'; window.confirm = () => true; });
  const upload = async (file) => {
    await o.page.evaluate(() => { showTab('l'); lhImpPid = 'P1'; });
    const sel = await o.page.evaluate(() => document.getElementById('lh-file') ? '#lh-file' : '#lst-file');
    await o.page.setInputFiles(sel, path.isAbsolute(file) ? file : path.join(FX, file));
    return waitFor(o.page, () => !!document.getElementById('ip-ok'));
  };
  const save = async () => {
    await o.page.evaluate(() => { document.getElementById('toast').textContent = ''; document.getElementById('ip-ok').click(); });
    await waitFor(o.page, () => /imported|nothing changed|no change/i.test(document.getElementById('toast').textContent) || !!document.getElementById('mm-ok'));
    if (await o.page.evaluate(() => !!document.getElementById('mm-ok'))) { await o.page.evaluate(() => document.getElementById('mm-ok').click()); await waitFor(o.page, () => /imported/.test(document.getElementById('toast').textContent)); }
    await F.sleep(300);
  };
  const sawTotal = name => { const l = S.db.t.lists.find(x => x.name === name && !x.archived); return l ? S.db.t.list_lines.filter(x => x.list_id === l.id && x.kind === 'saw' && x.removed_rev == null).reduce((s, x) => s + (+x.qty || 0), 0) : null; };

  // ---- totals = Excel
  for (const file of ['cutting-list-customer-a.xlsx', 'cutting-list-customer-a-nocache.xlsx']) {
    const before = S.db.t.lists.length;
    await upload(file); await save();
    const ex = excelTotals('cutting-list-customer-a.xlsx'); // the cached workbook holds Excel's own numbers
    const got = Object.fromEntries(Object.keys(ex).map(k => [k, sawTotal(k)]));
    rec(file + ': saw totals saved = Excel totals for every house sheet', Object.keys(ex).every(k => got[k] === ex[k]), JSON.stringify({ ex, got }));
    if (file.includes('nocache')) {
      const dup = ['Road 1 No 1,2,3', 'Road 2 No 4,5'].map(n => S.db.t.lists.filter(x => x.name === n && !x.archived).length);
      rec('same workbook imported twice (with and without saved values): one list per sheet, no duplicates', dup.every(n => n === 1) && S.db.t.lists.length === before, JSON.stringify({ dup, before, after: S.db.t.lists.length }));
      const revs = ['Road 1 No 1,2,3', 'Road 2 No 4,5'].map(n => (S.db.t.lists.find(x => x.name === n) || {}).rev);
      rec('…and no new revision for the saw (nothing changed)', revs.every(r => r === 1), JSON.stringify(revs));
    }
  }
  rec('Blank / Index / Stock / Door Stock never became lists', !S.db.t.lists.some(x => /^(blank|index|stock|door stock)$/i.test(String(x.name).trim())));

  // ---- heading lines never counted: sheet calculator + combined list on the imported list
  const calc = await o.page.evaluate(() => { const l = lists().find(x => x.name === 'Road 2 No 4,5'); const sn = sheetNeed([l], '', '9999-12-31'); const cb = combineLists([l], 'saw'); return { lines: sn.lines, noQty: sn.noQty, noSize: sn.noSize, cbHdr: cb.filter(r => /units|Kickers|Road 2/.test(r.item)).length, rows: listRows(l).length }; });
  rec('sheet calculator / combined list: heading and unit-heading lines are never counted as parts', calc.noQty === 0 && calc.noSize === 0 && calc.cbHdr === 0 && calc.lines > 0, JSON.stringify(calc));

  // ---- variant: odd sheet names, units from another sheet with no saved value
  const vf = variant();
  await upload(vf);
  const pv = await o.page.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return { sheets: [...ov.querySelectorAll('[data-ips]')].map(c => c.closest('label').textContent.trim()), txt: ov.innerText }; });
  rec('variant: "Blank ", "INDEX", "stock" left out (case and trailing spaces ignored)', pv.sheets.length === 1 && /Road 3 No 7/.test(pv.sheets[0]) && /Left out/.test(pv.txt), JSON.stringify(pv.sheets) + ' / ' + (pv.txt.match(/Left out.*/) || [''])[0]);
  rec('variant: units / quantities from a formula to another sheet with no saved value → the preview WARNS (quantity could not be read)', /⚠/.test(pv.txt) && /(quantit|units?).*(could not|can.t|no value|check)/i.test(pv.txt), pv.txt.slice(0, 700));
  await save();
  const vl = S.db.t.lists.find(x => x.name === 'Road 3 No 7'), vln = vl ? S.db.t.list_lines.filter(x => x.list_id === vl.id).map(x => [x.kind, x.part, x.qty]) : [];
  rec('variant: no saw line saved with a BLANK quantity without the person being told', !vln.some(x => x[0] === 'saw' && (x[2] == null || x[2] === '')) || /⚠/.test(pv.txt), JSON.stringify(vln));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
