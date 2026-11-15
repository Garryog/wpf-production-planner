// FINAL-2 Tester round (15 Nov) — attack on e09978b (Excel sizes / quantities typed as TEXT: "1,200" = 1200) and ee2623f
// ("the same file picked a second time by mistake is asked about first").
// Numbers as text: "1,200" "1.200" "1 200" "1200mm" "1,5" "-1,200" "1,000,000" "720,560" "1,200 off" …  — is anything now read
// as a WRONG number where before it was refused? Same file twice: Cancel leaves the list exactly as it was; a different file
// with the same name; after Undo; after deleting some / all of its rows; a second sheet of the same file; after Save + reopen;
// does the marker reach the database; <script>, quotes, O'Grady, emoji in the file name and sheet name of the new question.
// Fake Supabase only. Run: node tests/list-window/final2-excel.test.js
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const XLSX = require(path.join(ROOT, 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, click, fillSaw, save, donep, err, rows, liveFor, linesOf } = L;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const feed = async (p, name, buf) => { await p.setInputFiles('#me-xlfile', { name, mimeType: 'application/octet-stream', buffer: buf }); await sleep(900); };
const asked = p => p.evaluate(() => (window.__asked || []).slice());
const full = p => p.evaluate(() => JSON.stringify([...document.querySelectorAll('.me-ed [data-row]')].map(tr => [...tr.querySelectorAll('[data-mr]')].map(e => e.type === 'checkbox' ? e.checked : e.value))));
const undo = async p => { await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="0|item"]'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); }); await sleep(300); };
const delRow = async (p, i) => { await p.evaluate(i => { const b = document.querySelector('.me-ed [data-mrx="' + i + '"]'); if (b) b.click(); }, i); await sleep(200); };
const pickSheet = async (p, name) => { const r = await p.evaluate(name => { const b = [...document.querySelectorAll('[data-ixs]')].find(x => x.textContent.trim().startsWith(name)); if (!b) return 'no sheet button ' + name; b.click(); return 'ok'; }, name); await sleep(500); return r; };
const EVIL = '<img src=x onerror="window.__xss=(window.__xss||0)+1">', OG = "O'Grady \"Type B\" & Sons 🪚";
function row() { const r = X.v2Row(); for (let i = 20; i < 34; i++) r.orders.push(H.order({ wo: 'WO-' + i, customer: 'Aderrig Homes', floor: 'T20', unit: String(i), title: 'HOUSE ' + i, dueDate: '2026-11-30', origDueDate: '2026-11-30' })); return r; }
const A = { 'Kitchen': [COLS, ['Side', 2, 720, 560, 'MFC White'], ['Shelf', 4, 500, 300, 'MFC White'], ['Hinge', 8]] };
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    const open = async wo => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; window.__confirm = true; openListEditor(null, wo); }, wo); await sleep(800); };

    // ================= 1. numbers typed as text =================
    const CASES = [ // [label, qty cell, length cell, width cell, expect {qty,L,W} or null = "must not be read as a size silently"]
      ['"1,200" long', '2', '1,200', '560', { qty: '2', L: '1200', W: '560' }],
      ['"1,200.5" long', '2', '1,200.5', '560', { qty: '2', L: '1200.5', W: '560' }],
      ['"1200mm" × "560 mm"', '2', '1200mm', '560 mm', { qty: '2', L: '1200', W: '560' }],
      ['"2,400mm" long', '1', '2,400mm', '600', { qty: '1', L: '2400', W: '600' }],
      ['quantity "1,200"', '1,200', '100', '50', { qty: '1200', L: '100', W: '50' }],
      ['quantity "1,200 off"', '1,200 off', '100', '50', { qty: '1200', L: '100', W: '50' }],
      [' spaces round " 1,200 "', '2', ' 1,200 ', ' 560 ', { qty: '2', L: '1200', W: '560' }],
      ['"1,000,000" long (huge)', '1', '1,000,000', '560', { qty: '1', L: '1000000', W: '560' }],
    ];
    const ODD = [ // what does the person get? never a silently WRONG size
      ['"1.200" long (European thousands)', '2', '1.200', '560'], ['"1 200" long (space thousands)', '2', '1 200', '560'], ['"1,5" long (decimal comma)', '2', '1,5', '560'],
      ['"-1,200" long (negative)', '2', '-1,200', '560'], ['"720,560" in Length, Width empty (both sizes in one cell)', '2', '720,560', ''], ['"12,00" long', '2', '12,00', '560'],
      ['"1,2000" long', '2', '1,2000', '560'], ['quantity "2,5"', '2,5', '720', '560'], ['quantity "1,200.5"', '1,200.5', '720', '560'], ['quantity "-1,200"', '-1,200', '720', '560'], ['"1,200" × "1,200" qty "1,000"', '1,000', '1,200', '1,200'],
    ];
    const aoa = [COLS].concat(CASES.map((c, i) => ['Case' + i, c[1], c[2], c[3], 'MFC White']), ODD.map((c, i) => ['Odd' + i, c[1], c[2], c[3], 'MFC White']));
    await open('WO-20'); await feed(p, 'text-numbers.xlsx', xlsx({ 'Kitchen': aoa }));
    let rs = await rows(p); const said = await p.evaluate(() => (document.querySelector('.me-ed') || document.body).innerText.match(/Imported[^\n]*/g));
    CASES.forEach((c, i) => { const r = rs.find(x => x.item === 'Case' + i) || {};
      rec('[MEDIUM] 1.' + (i + 1) + ' Excel text ' + c[0] + ' → qty ' + c[4].qty + ', ' + c[4].L + ' × ' + c[4].W, String(r.qty) === c[4].qty && String(r.L) === c[4].L && String(r.W) === c[4].W, JSON.stringify(r)); });
    ODD.forEach((c, i) => { const r = rs.find(x => x.item === 'Odd' + i);
      rec('(info) 1.odd ' + c[0] + ' → the window shows', true, r ? JSON.stringify({ qty: r.qty, L: r.L, W: r.W }) : 'ROW NOT BROUGHT IN'); });
    const g = i => rs.find(x => x.item === 'Odd' + i) || {};
    rec('[MEDIUM] 1.a "720,560" typed in ONE cell (length,width) is NOT read as a board 720,560 mm long', String(g(4).L) !== '720560', JSON.stringify(g(4)));
    rec('[LOW] 1.c quantity "2,5" (decimal comma) is not silently read as 2', String(g(7).qty) !== '2', JSON.stringify(g(7)));
    rec('(info) 1.d what the window said after the import', true, JSON.stringify(said));
    // Save: what blocks?
    await save(p, 2200); const e1 = await err(p), d1 = await donep(p);
    rec('(info) 1.e Save with those odd rows still in: ' + (d1 ? 'SAVED' : 'refused'), true, (e1 || (d1 && d1.l) || '').slice(0, 260));
    if (d1) { const l = liveFor(S, 'WO-20')[0], bad = linesOf(S, l.id).filter(x => (+x.length_mm < 0) || (+x.width_mm < 0) || +x.length_mm > 100000);
      rec('[HIGH] 1.f nothing saved to the saw with a negative or absurd length (over 100 m)', bad.length === 0, JSON.stringify(bad.map(x => [x.part, x.qty, x.length_mm, x.width_mm]))); }
    else rec('1.f Save refused while a size is negative / absurd', /negative|size|length|width|quantity|Qty|whole/i.test(e1), e1);
    await closeAll(p);

    // 1.g the three risky text sizes on their own (nothing else to refuse the Save): does a wrong board reach the saw?
    await open('WO-30'); await feed(p, 'risky.xlsx', xlsx({ 'Kitchen': [COLS, ['Both in one cell', 2, '720,560', '', 'MFC White'], ['Negative', 2, '-1,200', 560, 'MFC White'], ['Huge', 1, '1,000,000', 560, 'MFC White']] }));
    await save(p, 2400); { const e = await err(p), d = await donep(p), l = liveFor(S, 'WO-30')[0], ln = l ? linesOf(S, l.id).map(x => [x.part, x.kind, x.qty, x.length_mm, x.width_mm]) : [];
      rec('[MEDIUM] 1.g "720,560" typed in one Length cell: NOT saved to the saw as a board 720,560 mm long (refused, flagged, or left for the person to fix)', !ln.some(x => +x[3] === 720560), JSON.stringify({ saved: !!d, err: e, lines: ln }));
      rec('[MEDIUM] 1.h a text length "-1,200": NOT saved to the saw as -1200 mm', !ln.some(x => +x[3] < 0), JSON.stringify({ saved: !!d, err: e, lines: ln })); }
    await closeAll(p);

    // ================= 2. the same file a second time =================
    await open('WO-21'); await feed(p, 'house.xlsx', xlsx(A));
    rec('2.0 first import: 3 rows, nothing asked', (await rows(p)).length === 3 && !(await asked(p)).length, JSON.stringify(await asked(p)));
    const before = await full(p);
    await p.evaluate(() => { window.__confirm = false; window.__asked = []; }); await feed(p, 'house.xlsx', xlsx(A));
    let q = await asked(p);
    rec('[HIGH] 2.1 same file + sheet again: ASKED "already in this list … Add them a second time?" naming the sheet and the file', q.length === 1 && /already in this list/.test(q[0]) && /Kitchen/.test(q[0]) && /house\.xlsx/.test(q[0]), JSON.stringify(q));
    rec('[HIGH] 2.2 answer Cancel: the list is EXACTLY as it was (every box of every row)', (await full(p)) === before, JSON.stringify((await rows(p)).map(r => r.item)));
    rec('(info) [LOW] 2.2b … and the window says something after Cancel (not a silent nothing)', /\S/.test(await err(p)) || true, JSON.stringify(await err(p)));
    await undo(p);
    rec('2.3 after Cancel, ONE Ctrl+Z undoes the FIRST import (Cancel left no phantom step behind)', (await rows(p)).filter(r => r.item).length === 0, JSON.stringify((await rows(p)).map(r => r.item)));
    // after Undo: the same file is NOT asked about (its rows are gone)
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await feed(p, 'house.xlsx', xlsx(A));
    rec('[MEDIUM] 2.4 same file after Undo (its rows are gone): NOT asked, rows come in', !(await asked(p)).length && (await rows(p)).length === 3, JSON.stringify([await asked(p), (await rows(p)).map(r => r.item)]));
    // delete SOME rows → still asked; delete ALL its rows → not asked
    await delRow(p, 2); await delRow(p, 1);
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await feed(p, 'house.xlsx', xlsx(A));
    rec('2.5 two of its three rows deleted, same file again: still asked (one row from it is still here); Cancel keeps the 1 row', (await asked(p)).length === 1 && (await rows(p)).filter(r => r.item).length === 1, JSON.stringify([await asked(p), (await rows(p)).map(r => r.item)]));
    await fillSaw(p, 0, 'Retyped by hand', '1', '600', '400', 'MFC White'); await sleep(150);
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await feed(p, 'house.xlsx', xlsx(A));
    q = await asked(p);
    rec('(info) [LOW] 2.6 the one row left from the file was retyped completely by hand; same file again → asked (the row still counts as "from that file")', true, JSON.stringify({ asked: q.length, rows: (await rows(p)).map(r => r.item) }));
    await closeAll(p);
    // every row of it deleted
    await open('WO-22'); await fillSaw(p, 0, 'Typed first', '1', '600', '400', 'MFC White'); await feed(p, 'house.xlsx', xlsx(A));
    await delRow(p, 3); await delRow(p, 2); await delRow(p, 1);
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await feed(p, 'house.xlsx', xlsx(A));
    rec('[MEDIUM] 2.7 ALL of its rows deleted by hand, same file again: NOT asked, rows come in under the typed row', !(await asked(p)).length && (await rows(p)).length === 4, JSON.stringify([await asked(p), (await rows(p)).map(r => r.item)]));
    // a DIFFERENT file with the same name
    const B = { 'Kitchen': [COLS, ['Plinth', 1, 2400, 150, 'MFC White']] };
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await feed(p, 'house.xlsx', xlsx(B));
    q = await asked(p);
    rec('(info) [LOW] 2.8 a DIFFERENT file that happens to have the same file name and sheet name ("house.xlsx" / "Kitchen"): asked "already in this list" although its rows are NOT (the question goes by the names only); OK brings them in', (await rows(p)).some(r => r.item === 'Plinth'), JSON.stringify({ asked: q.map(x => x.slice(0, 80)), rows: (await rows(p)).map(r => r.item) }));
    // the same file under another NAME (a copy) → not asked: info
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await feed(p, 'house (1).xlsx', xlsx(A));
    rec('(info) [LOW] 2.9 the SAME sheet from a copy of the file with another name ("house (1).xlsx"): asked?', true, JSON.stringify({ asked: (await asked(p)).length, rows: (await rows(p)).length }));
    await closeAll(p); await p.evaluate(() => { window.__confirm = true; });

    // ================= 3. two sheets in one file =================
    const TWO = { 'House A': [COLS, ['A side', 2, 720, 560, 'MFC White']], 'House B': [COLS, ['B side', 2, 720, 560, 'MFC White']] };
    await open('WO-23'); await feed(p, 'two.xlsx', xlsx(TWO)); const k1 = await pickSheet(p, 'House A');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await feed(p, 'two.xlsx', xlsx(TWO)); const k2 = await pickSheet(p, 'House B');
    rec('[MEDIUM] 3.1 the SECOND sheet of the same file: NOT asked (it is not in the list yet), its rows come in (' + k1 + ', ' + k2 + ')', !(await asked(p)).length && JSON.stringify((await rows(p)).map(r => r.item)) === '["A side","B side"]', JSON.stringify([await asked(p), (await rows(p)).map(r => r.item)]));
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await feed(p, 'two.xlsx', xlsx(TWO)); await pickSheet(p, 'House A');
    q = await asked(p);
    rec('[HIGH] 3.2 the FIRST sheet picked again: asked, naming "House A"; Cancel leaves the 2 rows', q.length === 1 && /House A/.test(q[0]) && (await rows(p)).length === 2, JSON.stringify([q, (await rows(p)).map(r => r.item)]));
    // Save, then is the marker in the database? then reopen and import again
    await p.evaluate(() => { window.__confirm = true; }); await save(p, 2200);
    const l23 = liveFor(S, 'WO-23')[0];
    const sent = JSON.stringify(S.rpcCalls.filter(c => c.fn === 'save_list_revision').slice(-1)[0].args);
    rec('[MEDIUM] 3.3 Save: the "came from this file" marker is NOT sent to the database (no _xl, no file name in the saved lines)', !!l23 && !/_xl/.test(sent) && !/two\.xlsx/.test(sent) && !/_xl|two\.xlsx/.test(JSON.stringify(linesOf(S, l23.id))), sent.slice(0, 200));
    await closeAll(p); await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await p.evaluate(id => { window.__asked = []; window.__confirm = false; window.__prompt = 'x'; openListEditor(id); }, l23.id); await sleep(900);
    await feed(p, 'two.xlsx', xlsx(TWO)); await pickSheet(p, 'House A');
    q = await asked(p);
    rec('(info, ask Garry) [LOW] 3.4 the list was SAVED and opened again; the same file + sheet is imported once more: is it asked about? (the marker is only kept while the window is open)', q.some(x => /already in this list/.test(x)), JSON.stringify({ asked: q.map(x => x.slice(0, 60)), rows: (await rows(p)).map(r => r.item) }));
    await closeAll(p); await p.evaluate(() => { window.__confirm = true; });

    // ================= 4. nasty names in the new question =================
    const sn = ('Hse ' + OG + ' <b>x</b>').replace(/[\\/?*\[\]:]/g, '').slice(0, 30);
    const N = { [sn]: [COLS, ['Side', 2, 720, 560, 'MFC White']] };
    await open('WO-24'); await feed(p, EVIL + ' ' + OG + '.xlsx', xlsx(N));
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; window.__xss = 0; }); await feed(p, EVIL + ' ' + OG + '.xlsx', xlsx(N));
    q = await asked(p);
    const inj = await p.evaluate(() => ({ xss: window.__xss || 0, img: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === 'x').length, b: document.querySelectorAll('.me-ed b').length && [...document.querySelectorAll('.me-ed b')].some(x => x.textContent === 'x') }));
    rec('[HIGH] 4.1 file name with <img onerror>, O\'Grady, quotes, & and an emoji; sheet name with <b>: the question shows them as plain text, complete, and nothing runs', q.length === 1 && q[0].includes(EVIL) && q[0].includes("O'Grady") && q[0].includes('🪚') && !inj.xss && !inj.img && !inj.b, JSON.stringify([q, inj]));
    rec('4.2 Cancel: 1 row still', (await rows(p)).length === 1);
    // a file with NO name (some phones) and a sheet called "undefined"
    await closeAll(p); await open('WO-25'); await feed(p, '.xlsx', xlsx({ 'undefined': [COLS, ['Side', 2, 720, 560, 'MFC White']] }));
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await feed(p, '.xlsx', xlsx({ 'undefined': [COLS, ['Side', 2, 720, 560, 'MFC White']] }));
    q = await asked(p);
    rec('4.3 a file called just ".xlsx" with a sheet called "undefined": still asked the second time, rows not doubled', q.length === 1 && (await rows(p)).length === 1, JSON.stringify([q, (await rows(p)).length]));
    await closeAll(p); await p.evaluate(() => { window.__confirm = true; });

    // ================= 5. the question and the OTHER Excel question together; typed rows =================
    // the file says another WO than the window: two questions in a row the second time — Cancel on either leaves the list alone
    const W = { 'Kitchen': [['Work order', 'WO-33'], COLS, ['Side', 2, 720, 560, 'MFC White']] };
    await open('WO-26'); await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await feed(p, 'other-wo.xlsx', xlsx(W));
    const q1 = await asked(p), n1 = (await rows(p)).filter(r => r.item).length;
    await p.evaluate(() => { window.__asked = []; let n = 0; window.__confirm = m => /already in this list/.test(m) ? false : true; }); const b5 = await full(p); await feed(p, 'other-wo.xlsx', xlsx(W));
    const q2 = await asked(p);
    rec('5.1 a file for another WO, imported twice: second time, "already in this list" answered Cancel → list exactly as it was', (await full(p)) === b5 && q2.some(x => /already in this list/.test(x)), JSON.stringify({ first: q1.map(x => x.slice(0, 50)), second: q2.map(x => x.slice(0, 50)), n1 }));
    rec('(info) [LOW] 5.2 … questions asked the second time, in order (ideally "already in this list" comes FIRST — no point asking about the WO of rows that will not be added)', true, JSON.stringify(q2.map(x => x.slice(0, 40))));
    await closeAll(p); await p.evaluate(() => { window.__confirm = true; });
    // phone width: the same question works (it is the browser's own box) and the rows are not doubled
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
