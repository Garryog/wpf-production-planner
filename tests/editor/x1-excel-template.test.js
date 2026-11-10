// Garry 9 Nov: an Excel import option and an Excel template to circulate. Checks: the template in templates/ is read
// exactly (labels "Carcass material" / "Door material", Bought in in the Note column, Example + READ ME never imported);
// "📥 Import from Excel" in the list editor fills the list (one sheet, or asks which sheet); "📥 Import Excel" on Lists home
// opens the preview; both "⬇ Excel template" links point at the file. Fake Supabase only. Run: node tests/editor/x1-excel-template.test.js
const fs = require('fs'), path = require('path');
const F = require('../stage3/fix3.js'); const { H } = F;
const ROOT = path.join(__dirname, '..', '..');
const XLSX = require(path.join(ROOT, 'xlsx.full.min.js'));
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = /\/\* lsParseGrid:start \*\/([\s\S]*?)\/\* lsParseGrid:end \*\//.exec(src);
eval(m[1] + ';global.lsParseGrid=lsParseGrid;global.lsSheetAoa=lsSheetAoa;global.lsSkipSheet=lsSkipSheet;');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const J = JSON.stringify;
const TPL = path.join(ROOT, 'templates', 'WPF-Cutting-List-Template.xlsx');
const FX1 = path.join(ROOT, 'tests', 'fixtures', 'xl-template-filled.xlsx'), FX2 = path.join(ROOT, 'tests', 'fixtures', 'xl-template-two-houses.xlsx');
// ---- the reader on the template itself
const wb = XLSX.read(fs.readFileSync(TPL), { type: 'buffer', cellDates: true, sheetStubs: true });
rec('template sheets: READ ME, House 1, Example, Edging', wb.SheetNames.join('|') === 'READ ME|House 1|Example|Edging', wb.SheetNames.join('|'));
rec('READ ME and Example are never imported; House 1 is', lsSkipSheet('READ ME') && lsSkipSheet('Example') && !lsSkipSheet('House 1') && lsSkipSheet('Read me') && lsSkipSheet('Example (2)') && lsSkipSheet('Edging'));
const ex = (() => { const g = lsSheetAoa(wb.Sheets.Example); return lsParseGrid(g.v, { formulas: g.f, sheet: 'Example' }); })();
rec('Example: project, title, date, carcass and door materials read from the yellow boxes', ex.meta.project === 'Example Homes – Phase 2' && ex.meta.title === 'House type B – 3 bed' && ex.meta.date === '2026-11-09' && ex.meta.carcass === '18mm MFC White' && ex.meta.door === '18mm MFC Bardolino Oak', J(ex.meta));
rec('Example: no warnings', !ex.warn.length, J(ex.warn));
const parts = ex.rows.filter(r => r.k === 'part'), hd = ex.rows.filter(r => r.k === 'hdr');
rec('Example: "Carcass material" is not a heading or a part', !ex.rows.some(r => /carcass/i.test(r.item)));
rec('Example: House nr 18 heading + 3 sub-headings', hd.map(r => (r.sub ? 'S:' : 'H:') + r.item).join('|') === 'H:House nr 18|S:Fillers and Kickers|S:Worktops|S:Stores items', J(hd));
rec('Example: 9 parts, 5 saw (with sizes) and 4 stores', parts.length === 9 && parts.filter(r => +r.L > 0).length === 5, J(parts));
const panel = parts.find(r => /End panel/.test(r.item));
rec('Example: Edging 1, Edging 2 and the note land in the right fields', panel && panel.edging === 'L2LE 1mm' && panel.edging2 === 'L2S1LE' && panel.note === 'Grain runs with length', J(panel));
const fr = parts.find(r => /fridge/.test(r.item));
rec('Example: "Bought in" typed in the Note column of a Stores row is ticked Bought in', fr && fr.buy === true && fr.note === '', J(fr));
rec('Example: TBC in Material is kept as the spec', parts.find(r => /Sink/.test(r.item)).mat === 'TBC');
const h1 = (() => { const g = lsSheetAoa(wb.Sheets['House 1']); return lsParseGrid(g.v, { formulas: g.f, sheet: 'House 1' }); })();
rec('House 1 (empty): headings only, no parts, no stray "Carcass material" row', !h1.rows.some(r => r.k === 'part') && h1.rows.map(r => r.item).join('|') === 'House nr 1|Fillers and Kickers|Worktops|Stores items', J(h1.rows));
// an older list with Colour labels and no Edging 2 column still reads the same way
const old = lsParseGrid([['Carcass colour', 'White'], ['Description', 'Qty', 'Length', 'Width', 'Colour', 'Edging'], ['Side', 2, 720, 560, 'White', '1mm', 'note A'], ['Hinge', 4, null, null, 'Blum', 'Bought in']], {});
rec('older layout (Colour, no Edging 2 header): note in G, Bought in from F still works', old.meta.carcass === 'White' && old.rows[0].note === 'note A' && old.rows[1].buy === true, J(old));
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { wos: ['WO-1'] });
  const t = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }); const p = t.page;
  await p.evaluate(async () => { setWho('Ann'); showTab('l'); LH.proj = 'P1'; render(); await new Promise(r => setTimeout(r, 100)); });
  const bar = await p.evaluate(() => ({ imp: !!document.getElementById('lh-imp'), href: (document.getElementById('lh-xltpl') || {}).getAttribute && document.getElementById('lh-xltpl').getAttribute('href') }));
  rec('Lists home: "📥 Import Excel" in the top bar and "⬇ Excel template" under More ▾', bar.imp && bar.href === 'templates/WPF-Cutting-List-Template.xlsx', J(bar));
  // Lists home import → preview of the two-house workbook
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.getElementById('lh-imp').click())]);
  await fc.setFiles(FX2); await F.sleep(600);
  const pv = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });
  rec('Lists home import opens the preview with both house sheets, nothing saved yet', /Import preview/.test(pv) && /House 18/.test(pv) && /House 19/.test(pv) && !/Example/.test(pv.replace(/Example Homes/g, '')), pv.slice(0, 300));
  await p.evaluate(() => { const b = document.getElementById('ip-x'); if (b) b.click(); }); await F.sleep(200);
  // editor: Import from Excel on a new standard-layout list → replaces the empty layout
  await p.evaluate(() => document.getElementById('lh-new').click()); await F.sleep(300);
  const ed = await p.evaluate(() => ({ btn: !!document.getElementById('me-impxl'), dl: !!document.querySelector('.me-ed a[download]') }));
  rec('editor: "📥 Import from Excel…" button and a template download under More ▾', ed.btn && ed.dl, J(ed));
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.getElementById('me-impxl').click())]);
  await fc2.setFiles(FX1); await F.sleep(500);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('.me-grid tbody tr')].map(r => { const i = r.querySelector('[data-mr$="|item"]'); return (r.classList.contains('me-h') ? 'H:' : 'R:') + (i ? i.value : ''); }));
  let r1 = await rows();
  rec('editor import: the empty standard layout is replaced by the sheet (4 headings + 9 rows)', r1.length === 13 && r1[0] === 'H:House nr 18' && r1.filter(x => x.startsWith('R:')).length === 9, J(r1));
  const nm = await p.evaluate(() => (document.getElementById('me-name') || {}).value);
  rec('editor import: the list name is taken from the sheet when empty', nm === 'House 18', nm);
  const fr2 = await p.evaluate(() => { const rows = [...document.querySelectorAll('.me-grid tbody tr')]; const r = rows.find(x => (x.querySelector('[data-mr$="|item"]') || {}).value === 'Integrated fridge'); const c = r && r.querySelector('input[data-mbuy]'); return c ? c.checked : null; });
  rec('editor import: the fridge row has Bought in ticked', fr2 === true, J(fr2));
  // undo
  await p.evaluate(() => { const b = document.getElementById('me-undo'); if (b) b.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })); }); await F.sleep(200);
  r1 = await rows();
  rec('Undo puts the standard layout back', r1[1] === 'H:Fillers and Kickers' && r1.length === 10, J(r1));
  // two-sheet workbook → asks which sheet; picking House 19 brings that one
  const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.getElementById('me-impxl').click())]);
  await fc3.setFiles(FX2); await F.sleep(500);
  const ask = await p.evaluate(() => [...document.querySelectorAll('[data-ixs]')].map(b => b.textContent.trim()));
  rec('two-sheet workbook: asks which sheet (House 18, House 19)', ask.length === 2 && /House 18/.test(ask[0]) && /House 19/.test(ask[1]), J(ask));
  await p.evaluate(() => document.querySelectorAll('[data-ixs]')[1].click()); await F.sleep(300);
  r1 = await rows();
  rec('picking House 19 fills the list from that sheet', r1[0] === 'H:House nr 19' && r1.length === 13, J(r1));
  // with parts already typed → added at the bottom
  const [fc4] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.getElementById('me-impxl').click())]);
  await fc4.setFiles(FX1); await F.sleep(500);
  r1 = await rows();
  rec('importing again when rows are filled adds them at the bottom (nothing lost)', r1.length === 26 && r1[0] === 'H:House nr 19' && r1[13] === 'H:House nr 18', J(r1.length));
  // a non-Excel file
  const bad = path.join(__dirname, '..', 'fixtures', 'not-excel.txt'); fs.writeFileSync(bad, 'hello');
  const [fc5] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.getElementById('me-impxl').click())]);
  await fc5.setFiles(bad); await F.sleep(400);
  const er = await p.evaluate(() => document.getElementById('me-err').textContent);
  rec('a file with no cutting list gives a plain message and changes nothing', /No cutting list found|Could not read/.test(er) && (await rows()).length === 26, er);
  fs.unlinkSync(bad);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await t.close();
  // phone width: the editor bar still fits
  const t2 = await F.dev(browser, S, 'office', { viewport: { width: 360, height: 760 } });
  const ph = await t2.page.evaluate(async () => { setWho('Ann'); showTab('l'); LH.proj = 'P1'; render(); await new Promise(r => setTimeout(r, 100)); const a = document.documentElement.scrollWidth; document.getElementById('lh-new').click(); await new Promise(r => setTimeout(r, 300)); return { home: a, ed: document.documentElement.scrollWidth, btn: !!document.getElementById('me-impxl') }; });
  rec('360 px phone: no sideways scroll on Lists home or the editor; import button present', ph.home <= 362 && ph.ed <= 362 && ph.btn, J(ph));
  await t2.close(); await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
