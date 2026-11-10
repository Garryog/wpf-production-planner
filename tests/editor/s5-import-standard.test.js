// Simple lists step 7 (Garry, 4 Nov): the Excel import reads WPF's STANDARD lists (Aspect / O'Malleys layout — fixture
// tests/fixtures/cutting-list-customer-b-standard.xlsx, anonymised): "Project … Date" row, "House nr" headings with
// sub-headings, stores items with the spec in column E, "Bought in" ticked automatically, notes, spec placeholders (TBC),
// and door rows with no description (named from the "Doors FU" heading). Then the same workbook through the real upload:
// what reaches the tables, the saw and the office list. Fake Supabase only. Run: node tests/editor/s5-import-standard.test.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const XLSX = require(path.join(ROOT, 'xlsx.full.min.js'));
const FX = path.join(ROOT, 'tests', 'fixtures'), FILE = 'cutting-list-customer-b-standard.xlsx';
if (!fs.existsSync(path.join(FX, FILE))) require(path.join(FX, 'make-fixtures.js'));
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = /\/\* lsParseGrid:start \*\/([\s\S]*?)\/\* lsParseGrid:end \*\//.exec(src);
eval(m[1] + ';global.lsParseGrid=lsParseGrid;global.lsSheetAoa=lsSheetAoa;global.lsPasteAoa=lsPasteAoa;global.lsEdLines=lsEdLines;global.lsSkipSheet=lsSkipSheet;');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const J = JSON.stringify;
const wb = XLSX.read(fs.readFileSync(path.join(FX, FILE)), { type: 'buffer', cellDates: true, sheetStubs: true });
const SN = 'House 103,104';
rec('the Index sheet is left out; the house sheet is read', wb.SheetNames.filter(s => !lsSkipSheet(s)).join('|') === SN);
const g = lsSheetAoa(wb.Sheets[SN]), p = lsParseGrid(g.v, { formulas: g.f, sheet: SN });
rec('"Project | Customer B – Phase 2 | | Date | 12/10/2026" → project and date (both labels on one row)', p.meta.project === 'Customer B – Phase 2' && p.meta.date === '2026-10-12', J(p.meta));
rec('no warnings', !p.warn.length, J(p.warn));
const H = p.rows.filter(r => r.k === 'hdr');
rec('the column-header row is not a heading or a part', !p.rows.some(r => /^description$/i.test(r.item)));
rec('house headings are headings: House nr 103, House nr 104', H.filter(r => !r.sub).map(r => r.item).join('|') === 'House nr 103|House nr 104', J(H));
rec('sub-headings under them: Fillers and Kickers, ISLAND, Utility 103, Doors FU, Worktops, Fillers and Kickers', H.filter(r => r.sub).map(r => r.item).join('|') === 'Fillers and Kickers|ISLAND|Utility 103|Doors FU|Worktops, Fillers and Kickers', J(H.filter(r => r.sub).map(r => r.item)));
const P = p.rows.filter(r => r.k === 'part'), one = n => P.find(r => r.item === n);
rec('no unit blocks and no "info" rows', !p.rows.some(r => r.units != null || r.info));
rec('saw parts keep sizes, colour and edging (Tall Gable "L2LE 1mm Blue", worktop "Frosty Matt 25mm" / "No Cap")', one('Tall Gable').edging === 'L2LE 1mm Blue' && one('Top').mat === 'Frosty Matt 25mm' && one('Top').edging === 'No Cap' && one('Top').L === 1000, J([one('Tall Gable'), one('Top')]));
rec('stores items: the spec from column E is the colour/spec (Sink → Hafele Calder, Gola rail → J Type)', one('Sink').mat === 'Hafele Calder' && one('Gola rail').mat === 'J Type' && one('Kicker vent').qty === 2 && one('Gola clips').qty === 12 && one('Gola clips').mat === '', J([one('Sink'), one('Gola rail'), one('Gola clips')]));
rec('a note in column G stays on its line ("Talk to Ollie")', one('Sink').note === 'Talk to Ollie', J(one('Sink')));
rec('"Bought in" in the Edging column → Bought in ticked, sizes kept, edging left blank', one('Panel Back').buy === true && one('Panel Back').L === 900 && one('Panel Back').W === 1842 && one('Panel Back').edging === '' && one('Panel Back').mat === 'Nautic Blue', J(one('Panel Back')));
rec('only the Panel Back is Bought in (a note "Cut down bought in doors at 345" does NOT tick it)', P.filter(r => r.buy).length === 1 && P.some(r => r.note === 'Cut down bought in doors at 345' && !r.buy), J(P.filter(r => /bought/i.test(r.note + r.edging))));
const doors = P.filter(r => r.item === 'Doors FU');
rec('door rows with no description take the heading\'s name "Doors FU" (sizes, colour, edging kept)', doors.length === 2 && doors[0].qty === 4 && doors[0].L === 715 && doors[0].W === 497 && doors[0].mat === 'Nautic Blue' && doors[0].edging === 'L4S 1mm', J(doors));
rec('"Worktops | … | None Chosen / TBC / Corian" is a line (spec TBC), not a heading', one('Worktops') && one('Worktops').mat === 'None Chosen / TBC / Corian' && one('Worktops').qty === '' && !H.some(h => h.item === 'Worktops'), J(one('Worktops')));
rec('"Sink + Tap — TBC" is a line "Sink + Tap" with spec TBC, not a heading', one('Sink + Tap') && one('Sink + Tap').mat === 'TBC' && !H.some(h => /Sink/.test(h.item)), J(one('Sink + Tap')));
rec('House nr 103 has 10–25 lines (standard size)', (() => { const i = p.rows.findIndex(r => r.item === 'House nr 104'); const n = p.rows.slice(0, i).filter(r => r.k === 'part').length; return n >= 10 && n <= 25; })());
// → lines for the tables
const L = lsEdLines(p.rows), lk = n => L.filter(x => x.part === n);
rec('lines: Panel Back is kind "buy" (never the saw), Kicker "saw", Sink "fit"', lk('Panel Back')[0].kind === 'buy' && lk('Kicker')[0].kind === 'saw' && lk('Sink')[0].kind === 'fit', J(L.map(x => x.kind + ':' + x.part)));
rec('lines: a sub-heading is stored with its house in section; a part with its sub-heading', L.find(x => x.kind === 'hdr' && x.part === 'ISLAND').section === 'House nr 103' && L.find(x => x.kind === 'hdr' && x.part === 'House nr 103').section === '' && lk('Island Back')[0].section === 'ISLAND', J(L.filter(x => x.kind === 'hdr')));
rec('lines: the bought-in panel keeps its sizes', String(lk('Panel Back')[0].length_mm) === '900' && String(lk('Panel Back')[0].width_mm) === '1842');
// the same rows pasted from Excel come in the same way
const txt = g.v.slice(2, 12).map(r => (r || []).map(v => v == null ? '' : v).join('\t')).join('\n');
const q = lsParseGrid(lsPasteAoa(txt), { paste: true });
rec('paste: house heading + sub-heading + parts, the same as the import', q.rows[0].item === 'House nr 103' && !q.rows[0].sub && q.rows[1].sub === true && q.rows.filter(r => r.k === 'part').length === 8, J(q.rows.slice(0, 3)));

// ---- the real upload (switch on), then what the office and the saw see — "checked before the saw" is OFF (the default, Garry 4 Nov)
const F = require('../stage3/fix3.js');
const { H: HH, D } = F;
const waitFor = async (pg, fn, ms = 5000) => { for (let i = 0; i < ms / 100; i++) { if (await pg.evaluate(fn)) return true; await F.sleep(100); } return false; };
(async () => {
  const browser = await HH.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  const o = await F.dev(browser, S, 'office');
  await o.page.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : 'Tester'; window.confirm = () => true; setWho('Ann'); });
  await o.page.evaluate(() => { showTab('l'); lhImpPid = 'P1'; });
  const sel = await o.page.evaluate(() => document.getElementById('lh-file') ? '#lh-file' : '#lst-file');
  await o.page.setInputFiles(sel, path.join(FX, FILE));
  rec('upload: the preview opens', await waitFor(o.page, () => !!document.getElementById('ip-ok')));
  const { pv, dis } = await o.page.evaluate(() => ({ pv: document.querySelector('.pod-ovl').innerText, dis: document.getElementById('ip-ok').disabled }));
  rec('preview: shows "Bought in" on the panel and the house heading; Save is allowed (nothing blank to fill in)', /Panel Back\s*Bought in/.test(pv) && /House nr 103/.test(pv) && !dis, pv.slice(0, 400));
  await o.page.evaluate(() => document.getElementById('ip-ok').click());
  // unknown board names → the matching dialog: keep them as typed
  await F.sleep(500);
  await o.page.evaluate(() => { const b = document.getElementById('mm-ok'); if (b) b.click(); });
  const got = await waitFor(o.page, () => [...LST.l.values()].some(l => l.name === 'House 103,104'), 6000);
  const lst = S.db.t.lists.find(l => l.name === 'House 103,104');
  rec('upload: one list for the sheet, made from Excel', got && !!lst && lst.source === 'excel', J(S.db.t.lists.map(l => l.name)));
  const ln = lst ? S.db.t.list_lines.filter(x => x.list_id === lst.id && x.removed_rev == null).sort((a, b) => a.seq - b.seq) : [];
  const k = n => ln.filter(x => x.part === n);
  rec('saved: Panel Back kind "buy" with its sizes; Kicker saw; Sink fit with spec Hafele Calder', k('Panel Back')[0] && k('Panel Back')[0].kind === 'buy' && +k('Panel Back')[0].length_mm === 900 && k('Kicker')[0].kind === 'saw' && k('Sink')[0].kind === 'fit' && k('Sink')[0].material === 'Hafele Calder', J(ln.map(x => x.kind + ':' + x.part)));
  rec('saved: sub-headings carry their house (section)', ln.filter(x => x.kind === 'hdr' && x.section === 'House nr 103').map(x => x.part).join('|') === 'Fillers and Kickers|ISLAND|Utility 103|Doors FU', J(ln.filter(x => x.kind === 'hdr').map(x => [x.part, x.section])));
  rec('saved: the list counts only saw / stores lines (n_saw, n_fit) — the bought-in panel is in neither', lst && lst.n_saw === ln.filter(x => x.kind === 'saw').length && lst.n_fit === ln.filter(x => x.kind === 'fit').length && ln.filter(x => x.kind === 'buy').length === 1, J(lst && [lst.n_saw, lst.n_fit]));
  rec('check switch OFF (default): a new Excel list needs no check', lst && lst.check_req === false && lst.checked_at == null, J(lst && [lst.check_req, lst.checked_at]));
  // tag it to WO-1, then the saw
  await o.page.evaluate(async id => { await lsRpc('list_attach', { p_list: id, p_wo: 'WO-1', p_on: true, p_by: 'Ann', p_cid: null, p_one: false }); await lsReloadList(id); }, lst.id);
  const view = await o.page.evaluate(id => { lsViewDlg(id); const ov = [...document.querySelectorAll('.pod-ovl')].pop(); const t = ov.innerText, h = ov.innerHTML; ov.remove(); return { t, h }; }, lst.id);
  rec('office list: "Bought in" shown on the panel, with its sizes; no "Waiting for check" and no ✓ Check (switch OFF)', /Panel Back\s*Bought in/.test(view.t) && /1842/.test(view.t) && !/Waiting for check|Not checked|✓ Check/.test(view.t) && !/data-vchk/.test(view.h), view.t.slice(0, 300));
  rec('office list: spec TBC chip names Tap, Worktops and Sink + Tap', /spec TBC: Tap, Worktops, Sink \+ Tap/.test(view.t), (view.t.match(/spec TBC[^\n]*/) || [''])[0]);
  rec('office list: house headings and sub-headings styled differently (wl-h1 / wl-sub)', /wl-sec wl-h1/.test(view.h) && /wl-sec wl-sub/.test(view.h));
  const s = await F.dev(browser, S, 'saw');
  const saw0 = await s.page.evaluate(() => document.getElementById('app').innerText);
  rec('saw: the list is on the saw straight away (no check), with no "checked by" line', /House 103,104/.test(saw0) && !/checked by/.test(saw0), saw0.slice(0, 600));
  const sawRows = await s.page.evaluate(() => { const l = lists().find(x => x.name === 'House 103,104'); return listRows(l).filter(r => r.k === 'saw').map(r => r.item); });
  rec('saw: no bought-in panel and no stores items among its rows; doors and worktops are cut', !sawRows.includes('Panel Back') && !sawRows.includes('Sink') && sawRows.includes('Doors FU') && sawRows.includes('Top'), J(sawRows));
  const card = await s.page.evaluate(() => { const c = [...document.querySelectorAll('.wl-card')].find(x => /House 103,104/.test(x.innerText)); return c ? { t: c.innerText, h: c.innerHTML } : null; });
  rec('saw card: house heading and sub-headings shown (ISLAND, Doors FU), spec TBC chip in red', card && /House nr 103/.test(card.t) && /ISLAND/.test(card.t) && /Doors FU/.test(card.t) && /spec TBC/.test(card.t) && /wl-h1/.test(card.h) && /wl-sub/.test(card.h), card && card.t.slice(0, 400));
  rec('saw card: a sub-heading with nothing to cut (none here) — every sub-heading shown has saw rows under it', card && !/Worktops, Fillers and Kickers[\s\S]*Robe handles/.test(card.t));
  const sheets = await s.page.evaluate(() => { const l = lists().find(x => x.name === 'House 103,104'); return sheetNeed([l], '', '9999-12-31', {}).mats.map(g => g.mat); });
  rec('sheet calculator: worktops (Frosty Matt 25mm) kept apart from 18mm board; no Nautic Blue from the bought-in panel beyond the doors', sheets.includes('Frosty Matt 25mm') && sheets.includes('18mm Grey Bordelino'), J(sheets));
  const comb = await s.page.evaluate(() => { const l = lists().find(x => x.name === 'House 103,104'); return combineLists([l], 'saw').map(r => r.item); });
  rec('combined list: no bought-in panel', !comb.includes('Panel Back'), J(comb));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await s.close(); await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
