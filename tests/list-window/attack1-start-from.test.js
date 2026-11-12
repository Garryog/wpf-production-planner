// Tester attack (list window, 12 Nov): "Start from… ▾" — An Excel file… and An old list… (new: rows come into THIS window).
// Nothing saved until Save; the old list never changes; HTML in names never runs.
// Fake Supabase only. Run: node tests/list-window/attack1-start-from.test.js
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const XLSX = require(path.join(ROOT, 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const feed = async (p, name, buf) => { await p.setInputFiles('#me-xlfile', { name, mimeType: 'application/octet-stream', buffer: buf }); await sleep(900); };
const EVIL = '<img src=x onerror="window.__xss=(window.__xss||0)+1">', OG = "O'Grady \"Type B\" & Sons";
const dbState = S => JSON.stringify([S.db.t.lists.length, S.db.t.list_lines.length, S.db.t.lists.map(l => l.version)]);
const topOv = p => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? { txt: o.innerText, html: o.innerHTML, n: document.querySelectorAll('.pod-ovl').length } : null; });
const useBtn = (p, id) => p.evaluate(id => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && o.querySelector('[data-foc="' + id + '"]'); if (!b) return 'no Use button for ' + id; b.click(); return 'ok'; }, id);
const openOld = async p => { await p.evaluate(() => { const d = document.getElementById('me-start'); d.open = true; d.dispatchEvent(new Event('toggle')); document.getElementById('me-findold').click(); }); await sleep(600); };

function row() {
  const r = X.v2Row();
  for (let i = 20; i < 34; i++) r.orders.push(H.order({ wo: 'WO-' + i, customer: 'Aderrig Homes', floor: 'T20', unit: String(i), title: 'HOUSE ' + i, dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  r.orders.push(H.order({ wo: 'WO-X1', customer: EVIL + ' Homes', floor: EVIL, unit: OG, title: EVIL + ' ' + OG, dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  r.orders.push(H.order({ wo: 'WO-NOCUST', customer: '', floor: '1', unit: '1', title: 'NO CUSTOMER', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    // old lists: a plain one, a unit-block (robe) one, one of ANOTHER project with its own materials, one with HTML everywhere, an archived one, an empty one
    X.F3.seedList(S, 'OLD1', { wos: ['WO-20'], name: 'Old house 20' });
    X.F3.seedList(S, 'OLDU', { wos: ['WO-21'], name: 'Robes block', lines: [['hdr', '900 Single Rail', '3'], ['saw', 'Side', '6', 1900, 560, 'MFC White', '', '', { unit_qty: '2' }], ['saw', 'Shelf', '9', 860, 500, 'MFC White', '', '', { unit_qty: '3' }], ['fit', 'Rail', '3', null, null, 'Blum hinge', '', '', { unit_qty: '1' }]] });
    D.insert(S.db, 'project_materials', { id: 'M9', project_id: 'P2', name: 'Lucan Oak', kind: 'sheet' });
    X.F3.seedList(S, 'OLDP2', { wos: ['WO-6'], name: 'Lucan type A', list: { project_id: 'P2' }, lines: [['saw', 'Lucan side', '2', 720, 560, 'Lucan Oak', '', ''], ['fit', 'Lucan handle', '4', null, null, 'Brass knob', '', '']] });
    X.F3.seedList(S, 'OLDX', { wos: ['WO-22'], name: EVIL + ' ' + OG, list: { type_name: EVIL }, lines: [['hdr', EVIL + ' heading', ''], ['saw', EVIL + ' ' + OG, '2', 720, 560, EVIL + ' board', OG, EVIL + ' note']] });
    X.F3.seedList(S, 'OLDA', { wos: ['WO-23'], name: 'Archived old one', list: { archived: true } });
    X.F3.seedList(S, 'OLDE', { wos: ['WO-24'], name: 'Empty old one', lines: [] });
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await asks(p);

    // =========================== An Excel file… ===========================
    await p.evaluate(() => openListEditor(null, 'WO-25')); await sleep(800);
    let st = await p.evaluate(() => { const d = document.getElementById('me-start'); return { det: !!d, open: d && d.open, ids: d ? [...d.querySelectorAll('button')].map(b => b.id) : [], sum: d ? d.querySelector('summary').innerText : '' }; });
    rec('"Start from… ▾" is ONE closed drop-down holding exactly: a template, an Excel file, an old list', st.det && !st.open && JSON.stringify(st.ids) === '["me-instpl","me-impxl","me-findold"]' && /Start from/.test(st.sum), JSON.stringify(st));
    let db0 = dbState(S);
    await feed(p, 'house.xlsx', xlsx({ 'House 25': [COLS, ['Side', 2, 720, 560, 'MFC White', 'L2LE 1mm', '', 'grain'], ['Shelf', 4, 500, 300, 'MFC White'], ['Hinge', 8]] }));
    let rs = await rows(p);
    rec('Excel (new window from a job): 3 rows land in the window (the one empty row is replaced)', rs.length === 3 && rs[0].item === 'Side' && rs[0].qty === '2' && rs[0].L === '720' && rs[2].item === 'Hinge', JSON.stringify(rs));
    rec('Excel: NOTHING saved until Save (database untouched)', dbState(S) === db0 && liveFor(S, 'WO-25').length === 0);
    let j = await job(p);
    rec('Excel: the job is still WO-25 in the title bar and the pickers stay folded away', j.hwo === 'WO-25' && j.woHidden && j.tog, JSON.stringify([j.hwo, j.woHidden, j.tog]));
    // second import: rows already there → added at the bottom, never replacing
    await feed(p, 'second.xlsx', xlsx({ 'Extra': [COLS, ['Kicker', 1, 2400, 150, 'MFC White'], ['Filler', 2, 720, 100, 'MFC White']] }));
    rs = await rows(p);
    rec('Excel: a SECOND import adds its rows under the first (5 rows, first three kept in order)', rs.length === 5 && rs[0].item === 'Side' && rs[3].item === 'Kicker' && rs[4].item === 'Filler', JSON.stringify(rs.map(r => r.item)));
    // the SAME file again (pressed twice)
    await feed(p, 'second.xlsx', xlsx({ 'Extra': [COLS, ['Kicker', 1, 2400, 150, 'MFC White'], ['Filler', 2, 720, 100, 'MFC White']] }));
    rs = await rows(p);
    const said = await p.evaluate(() => document.body.innerText.match(/Imported[^\n]*/g));
    rec('Excel: the SAME file imported again → the person is told rows were ADDED (7 rows now; "added at the bottom")', rs.length === 7 && (said || []).some(x => /added at the bottom/.test(x)), JSON.stringify([rs.length, said]));
    // Ctrl+Z takes the last import away
    await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="0|item"]'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); }); await sleep(300);
    rs = await rows(p);
    rec('Excel: Ctrl+Z undoes the last import only (back to 5 rows)', rs.length === 5, JSON.stringify(rs.map(r => r.item)));
    await save(p, 2000);
    let dn = await donep(p), l25 = liveFor(S, 'WO-25');
    rec('Excel: Save → ONE list on WO-25 with the 5 rows (4 saw + 1 Stores)', dn && l25.length === 1 && linesOf(S, l25[0].id).length === 5 && /4 saw rows · 1 Stores row · WO-25/.test(dn.l), JSON.stringify([dn && dn.l, await err(p)]));
    await closeAll(p);

    // import when rows are already TYPED
    await p.evaluate(() => openListEditor(null, 'WO-26')); await sleep(800);
    await fillSaw(p, 0, 'Typed first', '1', '600', '400', 'MFC White');
    await feed(p, 'house.xlsx', xlsx({ 'House 26': [COLS, ['Side', 2, 720, 560, 'MFC White']] }));
    rs = await rows(p);
    rec('Excel with a row already typed: the typed row is KEPT, the sheet\'s rows go under it', rs.length === 2 && rs[0].item === 'Typed first' && rs[1].item === 'Side', JSON.stringify(rs.map(r => r.item)));
    // a workbook with two house sheets → asked which; closing the question leaves the rows alone
    await feed(p, 'two.xlsx', xlsx({ 'House A': [COLS, ['A side', 2, 720, 560, 'MFC White']], 'House B': [COLS, ['B side', 2, 720, 560, 'MFC White']] }));
    let ov = await topOv(p);
    rec('Excel with two sheets: "Which sheet?" asked, nothing added yet', /Which sheet/.test(ov.txt) && (await p.evaluate(() => document.querySelectorAll('.me-ed [data-row]').length)) === 2, ov.txt.slice(0, 120));
    await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await sleep(300);
    rec('…Esc closes only the question; the list window and its 2 rows stay', await ed(p) && (await rows(p)).length === 2 && !/Which sheet/.test((await topOv(p)).txt));
    // not an Excel file / an empty workbook / a sheet with HTML in names
    await feed(p, 'notes.xlsx', Buffer.from('hello, not excel'));
    let e1 = await err(p);
    rec('Excel: a file that is not a workbook → plain message, rows untouched', (await rows(p)).length === 2 && /Could not read|No cutting list found/.test(e1), e1);
    await feed(p, EVIL + '.xlsx', xlsx({ [("Hse " + OG).replace(/[\\/?*\[\]:]/g, '').slice(0, 28)]: [COLS, [EVIL + ' part', 1, 500, 300, EVIL + ' board', OG, '', EVIL]] }));
    rs = await rows(p);
    const inj = await p.evaluate(() => ({ xss: window.__xss || 0, img: document.querySelectorAll('.pod-ovl img, .toast img, #toast img').length, anyImg: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === 'x').length }));
    rec('Excel with <img onerror> in the file name, description, material and note: lands as TEXT, nothing runs', rs.length === 3 && rs[2].item === EVIL + ' part' && !inj.xss && !inj.anyImg, JSON.stringify([rs.map(r => r.item), inj]));
    await closeAll(p); await p.evaluate(() => { window.__confirm = true; });

    // =========================== An old list… ===========================
    await p.evaluate(() => openListEditor(null, 'WO-27')); await sleep(800);
    await fillSaw(p, 0, 'Typed before', '1', '600', '400', 'MFC White');
    const s1 = snap(S, 'OLD1'); db0 = dbState(S);
    await openOld(p);
    ov = await topOv(p);
    rec('An old list…: the finder opens OVER the list window (2 windows), says "Use these rows"', ov.n === 2 && /Find an old list/.test(ov.txt) && /Use these rows/.test(ov.txt) && !/Copy to new list/.test(ov.txt.replace(/Use these rows puts[^\n]*/, '')), ov.txt.slice(0, 200));
    rec('…it lists this project\'s old lists (archived included), not another project\'s', /Old house 20/.test(ov.txt) && /Archived old one/.test(ov.txt) && !/Lucan type A/.test(ov.txt), ov.txt.replace(/\s+/g, ' ').slice(200, 600));
    // close the finder three ways: the typed row stays, the window stays
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('#pod-x').click(); }); await sleep(300);
    rec('finder closed with its Close button → list window still there with the typed row, nothing asked', await ed(p) && (await rows(p))[0].item === 'Typed before' && (await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)) === 1 && !(await p.evaluate(() => window.__asked.length)), JSON.stringify(await p.evaluate(() => window.__asked)));
    await openOld(p);
    await p.evaluate(() => { window.__confirm = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(300);
    let n = await p.evaluate(() => ({ n: document.querySelectorAll('.pod-ovl').length, ed: !!document.querySelector('.me-ed'), asked: window.__asked.slice() }));
    rec('finder closed with Esc → only the finder closes; the list window is not asked about and keeps its row', n.n === 1 && n.ed && !n.asked.length && (await rows(p))[0].item === 'Typed before', JSON.stringify(n));
    await p.evaluate(() => { window.__confirm = true; });
    await closeAll(p); await p.evaluate(() => openListEditor(null, 'WO-27')); await sleep(800); await fillSaw(p, 0, 'Typed before', '1', '600', '400', 'MFC White');
    await openOld(p);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await sleep(300);
    rec('finder closed by clicking the grey area → the list window keeps its row', await ed(p) && (await rows(p))[0].item === 'Typed before');
    if ((await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)) < 2) await openOld(p);
    // View inside the finder, then Use
    let u = await useBtn(p, 'OLD1'); await sleep(900);
    rs = await rows(p);
    rec('"Use these rows" on "Old house 20": its rows come into THIS window UNDER the typed row; finder closed; window still WO-27', u === 'ok' && await ed(p) && rs[0].item === 'Typed before' && rs.length === 1 + linesOf(S, 'OLD1').length && (await job(p)).hwo === 'WO-27' && (await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)) === 1, JSON.stringify([u, rs.map(r => r.item), (await job(p)).hwo]));
    rec('…the old list is UNCHANGED in the database and nothing is saved yet', snap(S, 'OLD1') === s1 && dbState(S) === db0);
    rec('…"Start from…" is closed again after use', !(await p.evaluate(() => document.getElementById('me-start').open)));
    // pressed twice: the same old list again
    await openOld(p); u = await useBtn(p, 'OLD1'); await sleep(900);
    rs = await rows(p);
    const tw = await p.evaluate(() => document.body.innerText.match(/Added \d+ rows? from[^\n]*/g));
    rec('[LOW] "Use these rows" pressed a SECOND time for the same old list → rows are in twice (' + rs.length + ') — the person is warned they are already in', rs.length === 1 + linesOf(S, 'OLD1').length || /already|twice|again/i.test((tw || []).join(' ')), JSON.stringify([rs.length, tw]));
    // Ctrl+Z
    await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="0|item"]'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); }); await sleep(300);
    rec('…Ctrl+Z takes the second copy away again', (await rows(p)).length === 1 + linesOf(S, 'OLD1').length, String((await rows(p)).length));
    await save(p, 2000);
    dn = await donep(p); const l27 = liveFor(S, 'WO-27');
    rec('Save → ONE new list on WO-27 with typed + old rows; old list still exactly as it was, still live on WO-20', dn && l27.length === 1 && l27[0].id !== 'OLD1' && linesOf(S, l27[0].id).length === 1 + linesOf(S, 'OLD1').length && snap(S, 'OLD1') === s1 && liveFor(S, 'WO-20').some(l => l.id === 'OLD1'), JSON.stringify([dn && dn.l, await err(p)]));
    const ids = new Set(linesOf(S, 'OLD1').map(x => x.id));
    rec('…the new list\'s lines have their OWN ids (not the old list\'s line ids — ticks can never cross over)', l27[0] && linesOf(S, l27[0].id).every(x => !ids.has(x.id)), JSON.stringify(l27[0] && linesOf(S, l27[0].id).map(x => x.id)));
    rec('…the new list is not marked as REPLACING the old one (the old list is not archived)', !S.db.t.lists.find(l => l.id === 'OLD1').archived && !(l27[0].log || []).some(e => e && e.replaces));
    await closeAll(p);

    // ticks on the old list must not come across
    D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'OLD1:1'), { status: 'cut', done_by: 'Saw', done_at: '2026-10-20T10:00:00Z' });
    await p.evaluate(async () => { lsReset(); await lsLoad(); openListEditor(null, 'WO-28'); }); await sleep(900);
    await openOld(p); await useBtn(p, 'OLD1'); await sleep(900); await save(p, 2000);
    const l28 = liveFor(S, 'WO-28');
    rec('old list with a row already CUT → used rows arrive unticked on the new list', l28.length === 1 && linesOf(S, l28[0].id).every(x => !x.status || x.status === 'open' || x.status === 'todo'), JSON.stringify(l28[0] && linesOf(S, l28[0].id).map(x => x.part + ':' + x.status)));
    await closeAll(p);

    // unit-block list
    await p.evaluate(() => openListEditor(null, 'WO-29')); await sleep(800);
    await openOld(p); u = await useBtn(p, 'OLDU'); await sleep(900);
    rs = await rows(p);
    rec('a UNIT-BLOCK old list (robes ×3): the unit heading with Units 3 and the per-unit quantities (2, 3, 1) come across', u === 'ok' && rs[0].hdr && rs[0].units === '3' && rs[1].qty === '2' && rs[2].qty === '3' && rs[3].qty === '1', JSON.stringify(rs));
    await save(p, 2000);
    const l29 = liveFor(S, 'WO-29');
    rec('…Save → totals to cut are 6 / 9 / 3 (per unit × 3), as on the old list', l29.length === 1 && JSON.stringify(linesOf(S, l29[0].id).filter(x => x.kind !== 'hdr').map(x => String(x.qty))) === '["6","9","3"]', JSON.stringify([l29[0] && linesOf(S, l29[0].id).map(x => x.kind + ':' + x.part + ':' + x.qty + ':' + x.unit_qty), await err(p)]));
    await closeAll(p);
    // unit-block rows used UNDER an existing unit block of 2
    await p.evaluate(() => openListEditor(null, 'WO-30')); await sleep(800);
    await openOld(p); await useBtn(p, 'OLDU'); await sleep(900);
    await openOld(p); await useBtn(p, 'OLD1'); await sleep(900); // plain rows now land under the "900 Single Rail × 3" block
    rs = await rows(p);
    const plain = linesOf(S, 'OLD1').filter(x => x.kind !== 'hdr');
    await save(p, 2000);
    const l30 = liveFor(S, 'WO-30');
    const got = l30[0] ? linesOf(S, l30[0].id).filter(x => plain.some(q => q.part === x.part && q.kind === x.kind)).map(x => x.part + ':' + x.qty) : [];
    const want = plain.map(x => x.part + ':' + x.qty);
    rec('PLAIN old list used UNDER a ×3 unit block: its quantities are not silently multiplied by 3 (old totals ' + JSON.stringify(want) + ')', !!(await donep(p)) ? (g => want.every(w => { const i = g.indexOf(w); if (i < 0) return false; g.splice(i, 1); return true; }))(got.slice()) /* (12 Nov) every old-list row keeps its own quantity; the unit block's own "Side" is not one of them */ : /unit|whole|fixed/i.test(await err(p)), JSON.stringify({ got, err: await err(p), rows: rs.map(r => r.item + ':' + r.qty) }));
    await closeAll(p);

    // a list of ANOTHER project
    await p.evaluate(() => openListEditor(null, 'WO-31')); await sleep(800);
    await openOld(p);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const c = o.querySelector('#fo-all'); c.checked = true; c.dispatchEvent(new Event('change')); }); await sleep(300);
    ov = await topOv(p);
    rec('"All projects" ticked → the Lucan list shows too', /Lucan type A/.test(ov.txt));
    u = await useBtn(p, 'OLDP2'); await sleep(900);
    const mats = await p.evaluate(() => [...document.querySelectorAll('.me-ed select[data-mr$="|mat"]')].map(s => ({ v: s.value, flagged: /not on the project/.test(s.title || '') || /⚠/.test(s.selectedOptions[0] ? s.selectedOptions[0].textContent : ''), amber: /fff4d6|255, 244, 214/.test(s.getAttribute('style') || '') })));
    j = await job(p);
    rec('a list of ANOTHER project (Lucan) used on an Aderrig job: rows arrive, "Lucan Oak" is FLAGGED (amber, "not on the project list")', u === 'ok' && mats.length === 2 && mats[0].v === 'Lucan Oak' && mats[0].flagged && mats[0].amber, JSON.stringify(mats));
    rec('…the window is still WO-31 / project Aderrig (the old list\'s project did not take over)', j.hwo === 'WO-31' && j.pid === 'P1', JSON.stringify([j.hwo, j.pid]));
    const pm0 = S.db.t.project_materials.length;
    await save(p, 2000);
    const l31 = liveFor(S, 'WO-31');
    rec('…Save → saved on Aderrig; "Lucan Oak" is NOT silently added to Aderrig\'s materials; the saw row is flagged for the Production Manager', l31.length === 1 && l31[0].project_id === 'P1' && S.db.t.project_materials.length === pm0 && linesOf(S, l31[0].id).some(x => x.material === 'Lucan Oak' && x.material_other === true), JSON.stringify([l31[0] && linesOf(S, l31[0].id).map(x => JSON.stringify(x)).join(' ').slice(0, 500), await err(p)]));
    await closeAll(p);

    // with NO project (new list from the Lists page, nothing picked)
    await p.evaluate(() => openListEditor(null, '', '')); await sleep(700);
    await openOld(p);
    ov = await topOv(p);
    rec('no project picked: the finder still opens and searches EVERY project (no "All projects" box needed)', ov.n === 2 && /Old house 20/.test(ov.txt) && /Lucan type A/.test(ov.txt), ov.txt.replace(/\s+/g, ' ').slice(0, 200));
    u = await useBtn(p, 'OLD1'); await sleep(900);
    rs = await rows(p); j = await job(p);
    rec('…Use → rows arrive; the project is still not picked (said plainly on Save, rows kept)', u === 'ok' && rs.length === linesOf(S, 'OLD1').length && !j.pid, JSON.stringify([rs.length, j.pid]));
    await save(p, 1200);
    rec('…Save with no project → "Pick the project…", nothing saved, rows still there', /Pick the project/.test(await err(p)) && (await rows(p)).length === linesOf(S, 'OLD1').length && !(await donep(p)), await err(p));
    await closeAll(p);
    // a WO with no customer (so no project) from the job
    await p.evaluate(() => openListEditor(null, 'WO-NOCUST')); await sleep(900);
    await openOld(p); u = await useBtn(p, 'OLD1'); await sleep(900);
    rec('WO with no customer in Cienapps (no project yet): An old list… still works, rows arrive', u === 'ok' && (await rows(p)).length === linesOf(S, 'OLD1').length, u);
    await closeAll(p);

    // empty old list, archived old list
    await p.evaluate(() => openListEditor(null, 'WO-32')); await sleep(800);
    await openOld(p); u = await useBtn(p, 'OLDE'); await sleep(900);
    ov = await topOv(p);
    rec('an old list with NO rows → said plainly, finder stays open, window untouched', u === 'ok' && ov.n === 2 && /has no rows to use/.test(await p.evaluate(() => document.body.innerText)), JSON.stringify([u, ov.n]));
    u = await useBtn(p, 'OLDA'); await sleep(900);
    rec('an ARCHIVED old list can be used (rows arrive); it stays archived', u === 'ok' && (await rows(p)).length === linesOf(S, 'OLDA').length && S.db.t.lists.find(l => l.id === 'OLDA').archived === true, JSON.stringify([u, (await rows(p)).length]));
    await closeAll(p);

    // =========================== HTML / quotes / O'Grady everywhere ===========================
    await p.evaluate(() => { window.__xss = 0; openListEditor(null, 'WO-X1'); }); await sleep(1800);
    j = await job(p);
    const madeP = S.db.t.projects.find(x => /Homes$/.test(x.name) && /img/.test(x.name));
    rec('WO whose customer / floor / unit / title carry <img onerror> + O\'Grady "quotes": window opens, project made with the exact name, nothing runs', j.open && !!madeP && !(await p.evaluate(() => window.__xss)), JSON.stringify([j.pm, madeP && madeP.name]));
    await openOld(p);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const c = o.querySelector('#fo-all'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } }); await sleep(300);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const q = o.querySelector('#fo-q'); q.value = '<img'; q.dispatchEvent(new Event('input')); }); await sleep(400);
    ov = await topOv(p);
    rec('finder: searching "<img" finds the list named with HTML; the name shows as text', /<img src=x onerror=/.test(ov.txt) && /O'Grady "Type B" & Sons/.test(ov.txt), ov.txt.replace(/\s+/g, ' ').slice(0, 300));
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const q = o.querySelector('#fo-q'); q.value = 'zz"><img src=x onerror=window.__xss=9>'; q.dispatchEvent(new Event('input')); }); await sleep(400);
    ov = await topOv(p);
    rec('finder: HTML typed in the search box is shown back as text ("No list matches …")', /No list matches "zz"><img src=x onerror=window.__xss=9>"/.test(ov.txt), ov.txt.replace(/\s+/g, ' ').slice(150, 420));
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const q = o.querySelector('#fo-q'); q.value = "O'Grady"; q.dispatchEvent(new Event('input')); }); await sleep(400);
    // View inside the finder
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o.querySelector('[data-fov="OLDX"]'); if (b) b.click(); }); await sleep(700);
    ov = await topOv(p);
    rec('finder → View of the HTML-named list: opens over it (3 windows), shown as text', ov.n === 3 && /<img src=x onerror=/.test(ov.txt), JSON.stringify([ov.n, ov.txt.slice(0, 120)]));
    await p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await sleep(300);
    n = await p.evaluate(() => document.querySelectorAll('.pod-ovl').length);
    rec('…Esc closes the View only (finder + list window stay)', n === 2 && await ed(p), String(n));
    if (n > 2) { await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().remove()); }
    u = await useBtn(p, 'OLDX'); await sleep(900);
    rs = await rows(p);
    rec('Use the HTML-named list: heading, description, material and note arrive as text in the boxes', u === 'ok' && rs.some(r => r.item === EVIL + ' ' + OG) && rs.some(r => r.hdr && r.item === EVIL + ' heading'), JSON.stringify(rs.map(r => r.item)));
    await setid(p, 'me-name', EVIL + ' ' + OG);
    await save(p, 2500);
    dn = await donep(p);
    const xs = await p.evaluate(() => ({ xss: window.__xss || 0, imgs: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === 'x').length, all: document.body.innerText.includes('<img src=x onerror=') }));
    rec('Save → "Saved ✓" panel shows the list name as text (' + (dn ? dn.l.slice(0, 60) : 'no panel: ' + await err(p)) + ')', dn && dn.l.includes(EVIL + ' ' + OG) && !/<img/i.test(dn.html.replace(/&lt;img/g, '')), dn ? dn.html.slice(0, 300) : '');
    rec('…in the whole run NO injected <img> element exists and no onerror ran (window, finder, View, toasts, Saved panel)', !xs.xss && !xs.imgs, JSON.stringify(xs));
    await click(p, 'me-dagain'); await sleep(900);
    const ti = await p.evaluate(() => ({ xss: window.__xss || 0, imgs: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === 'x').length, name: (document.getElementById('me-name') || {}).value, info: (document.getElementById('me-woinfo') || {}).innerText }));
    rec('"Edit it again": name, floor / unit / title boxes show the text exactly; nothing runs', ti.name === EVIL + ' ' + OG && /O'Grady "Type B" & Sons/.test(ti.info || '') && !ti.xss && !ti.imgs, JSON.stringify(ti));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
