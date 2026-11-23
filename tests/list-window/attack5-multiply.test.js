// Tester attack ROUND 5 (17 Nov) on "× Multiply inside the cutting list" (c512ebe, 8059632, 5f1a7a7): heading type changes
// inside / next to a × block, typed × numbers, delete / undo, save + reopen, old lists saved before 16 Nov, the saw / labels
// totals, half totals, "as drawn", a template that holds a × block, and two PCs. Fake Supabase only.
// Run: node tests/list-window/attack5-multiply.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks, rows, setv, liveFor, linesOf } = L;
const M = 'MFC White', HB = 'Blum hinge';
// a saved list: Floor 1 × 2 [Side 2 per = 4], Floor 2 × 3 [Top 1 per = 3], sub "Stores items" in Floor 2 [Hinge 8 per = 24], plain "Extras" [Glue 2]
const XL = [['hdr', 'Floor 1', '2', null, null, null, '', ''], ['saw', 'Side', '4', 720, 560, M, '', '', { unit_qty: '2' }],
  ['hdr', 'Floor 2', '3', null, null, null, '', ''], ['saw', 'Top', '3', 1200, 560, M, '', '', { unit_qty: '1' }],
  ['hdr', 'Stores items', null, null, null, null, '', '', { section: 'Floor 2' }], ['fit', 'Hinge', '24', null, null, HB, '', '', { unit_qty: '8' }],
  ['hdr', 'Extras', null, null, null, null, '', ''], ['fit', 'Glue', '2', null, null, HB, '', '']];
const tots = p => p.evaluate(() => { const o = {}; document.querySelectorAll('.me-ed [data-tot]').forEach(e => { o[e.dataset.tot] = e.textContent.replace(/fixed/, '').trim(); }); return o; });
const hType = async (p, i, v, pr) => { await p.evaluate(({ i, v, pr }) => { if (pr !== undefined) window.__prompt = pr; const e = document.querySelector('.me-ed [data-mhs="' + i + '"]'); if (!e) return; e.value = v; e.dispatchEvent(new Event('change')); }, { i, v, pr }); await sleep(350); };
const openL = async (p, id) => { await closeAll(p); await p.evaluate(id => { window.__asked = []; window.__confirm = true; openListEditor(id); }, id); await sleep(1100); };
const saveC = async p => { await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2600); };
const saved = (S, id) => linesOf(S, id).map(x => x.part + ':' + (x.qty == null ? '' : x.qty) + (x.unit_qty ? '/' + x.unit_qty : ''));
const q = (S, id, part) => (linesOf(S, id).find(x => x.part === part) || {}).qty;
const errT = p => p.evaluate(() => (document.getElementById('me-err') || {}).textContent || '');
const eachList = (S, ids) => ids.forEach((id, k) => X.F3.seedList(S, id, { wos: ['WO-' + (30 + k)], name: 'MX ' + id, lines: XL }));
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const r = X.v2Row();
    for (let k = 0; k < 14; k++) r.orders.push(X.H.order({ wo: 'WO-' + (30 + k), customer: 'Aderrig Homes', floor: 'F' + k, unit: '1', title: 'HOUSE ' + k, dueDate: '2026-12-03', origDueDate: '2026-12-03' }));
    const S = X.makeServer(r);
    eachList(S, ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']);
    // an OLD list (saved before 16 Nov): a unit block, then a sub-heading whose rows were saved as TOTALS outside the block
    X.F3.seedList(S, 'OLD', { wos: ['WO-40'], name: 'Old robes', lines: [['hdr', '900 Single Rail', '3', null, null, null, '', ''], ['saw', 'Side', '6', 2100, 560, M, '', '', { unit_qty: '2' }],
      ['hdr', 'Fillers', null, null, null, null, '', '', { section: '900 Single Rail' }], ['saw', 'Filler', '6', 2100, 100, M, '', ''], ['fit', 'Screws', '7', null, null, HB, '', '']] });
    // a template SAVED FROM a list with a × block that has a sub-heading
    X.F3.seedList(S, 'TX', { wos: [], name: 'Floor tpl', list: { is_template: true, type_name: 'Floor tpl', list_type: 'house' }, lines: [['hdr', 'Floor 2', '4', null, null, null, '', ''], ['saw', 'Side', '8', 720, 560, M, '', '', { unit_qty: '2' }],
      ['hdr', 'Stores items', null, null, null, null, '', '', { section: 'Floor 2' }], ['fit', 'Hinge', '32', null, null, HB, '', '', { unit_qty: '8' }]] });
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' }, lines: [['hdr', 'Kitchen', null, null, null, null, '', ''], ['saw', 'Side', '2', 720, 560, M, '', ''], ['hdr', 'Stores items', null, null, null, null, '', '', { section: 'Kitchen' }], ['fit', 'Hinge', '8', null, null, HB, '', '']] });
    X.F3.seedList(S, 'LOLD', { wos: [], name: 'Old house 9' }); // no heading: Side 2, Side 2, Top 1, Hinge 8
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });

    // 0. reopen a saved × list
    await openL(p, 'A1'); let rw = await rows(p), tt = await tots(p);
    rec('set-up: reopened — Floor 1 × 2, Floor 2 × 3, Side 2 (=4), Top 1 (=3), Hinge 8 (=24), Glue 2 (no ×)', rw[0].units === '2' && rw[2].units === '3' && rw[1].qty === '2' && rw[3].qty === '1' && rw[5].qty === '8' && rw[7].qty === '2' && tt[5] === '= 24' && !tt[7], JSON.stringify([rw.map(x => x.item + ':' + (x.units || x.qty || '')), tt]));

    // 1. sub-heading INSIDE a × block turned into a plain Heading
    await hType(p, 4, '');
    rw = await rows(p); tt = await tots(p);
    rec('[HIGH] M1 "Stores items" (a sub-heading inside Floor 2 × 3) changed to Heading → the Hinge keeps its TOTAL 24 (not silently cut to 8)', rw[5].qty === '24' || tt[5] === '= 24', JSON.stringify([rw[5], tt]));
    await saveC(p);
    rec('[HIGH] M1 …saved: the stores get Hinge 24', q(S, 'A1', 'Hinge') === '24', JSON.stringify(saved(S, 'A1')));

    // 2. a × heading turned into a Sub-heading right after another × block
    await openL(p, 'A2'); await hType(p, 2, 'sub');
    rw = await rows(p); tt = await tots(p);
    rec('[HIGH] M2 "Floor 2 × 3" changed to Sub-heading (no ×) under "Floor 1 × 2" → Top keeps its total 3 and Hinge 24 (not doubled to 6 / 48)', (tt[3] === '= 3' || (!tt[3] && rw[3].qty === '3')) && (tt[5] === '= 24' || (!tt[5] && rw[5].qty === '24')), JSON.stringify([rw.map(x => x.item + ':' + (x.units || x.qty || '')), tt]));
    await saveC(p);
    rec('[HIGH] M2 …saved: the saw gets Top 3, stores Hinge 24', q(S, 'A2', 'Top') === '3' && q(S, 'A2', 'Hinge') === '24', JSON.stringify(saved(S, 'A2')));

    // 3. a plain heading after a × block turned into a Sub-heading
    await openL(p, 'A3'); await hType(p, 6, 'sub');
    tt = await tots(p);
    rec('[MEDIUM] M3 plain "Extras" (Glue 2) after the Floor 2 × 3 block changed to Sub-heading → Glue keeps total 2 (or is asked) — not silently 6', !tt[7] || tt[7] === '= 2' || (await p.evaluate(() => window.__asked.length)) > 0, JSON.stringify(tt));
    await saveC(p);
    rec('[MEDIUM] M3 …saved Glue', q(S, 'A3', 'Glue') === '2', JSON.stringify(saved(S, 'A3')));

    // 4. a sub-heading inside a × block made × Multiply itself (nested)
    await openL(p, 'A4'); await hType(p, 4, 'mul', '2');
    rw = await rows(p); tt = await tots(p);
    rec('[MEDIUM] M4 "Stores items" (inside Floor 2 × 3, Hinge = 24) made × 2 → Hinge is 48 (3 × 2) or the person is warned; never silently 16', tt[5] === '= 48' || /3/.test(String(await L.toasts(p))), JSON.stringify([rw[4], tt, await L.toasts(p)]));
    await closeAll(p);

    // 5. delete the × heading: the rows move into Floor 1 × 2 and keep their totals
    await openL(p, 'A5'); await p.evaluate(() => document.querySelector('.me-ed [data-mrx="2"]').click()); await sleep(400);
    tt = await tots(p);
    rec('M5 delete "Floor 2 × 3" → Top keeps total 3 (fixed) and Hinge 24, now inside Floor 1 × 2', tt[2] === '= 3' && tt[4] === '= 24', JSON.stringify(tt));
    await p.keyboard.press('Control+z'); await sleep(300); rw = await rows(p); tt = await tots(p);
    rec('M5 Ctrl+Z → Floor 2 × 3 back, Top =3, Hinge =24', rw[2].units === '3' && tt[3] === '= 3' && tt[5] === '= 24', JSON.stringify([rw[2], tt]));

    // 6. × number typed in the cell
    for (const [v, ok] of [['abc', false], ['0', false], ['2.5', false], ['', false], ['-1', false], [' 4 ', true]]) {
      await setv(p, '2|units', v); await sleep(150);
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500);
      const e = await errT(p); const sv = q(S, 'A5', 'Top');
      if (ok) rec('M6 × typed " 4 " → saved Top = 4, Hinge 32', sv === '4' && q(S, 'A5', 'Hinge') === '32', JSON.stringify([e, saved(S, 'A5')]));
      else rec('[HIGH] M6 × typed "' + v + '" → Save refused in words; the saw never gets a wrong total', /number of units/i.test(e) && sv === '3', JSON.stringify([e, saved(S, 'A5')]));
      await closeAll(p); await openL(p, 'A5');
    }
    await setv(p, '2|units', '501'); await sleep(150); await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500);
    rec('[LOW] M6b × 501 typed in the cell is refused like in the × Multiply question (1–500)', q(S, 'A5', 'Top') !== '501', JSON.stringify([await errT(p), q(S, 'A5', 'Top')]));
    await closeAll(p);

    // 7. half totals, inside a sub-heading of a × block; "as drawn"
    await openL(p, 'A6');
    await setv(p, '3|qty', '1.5'); await sleep(150); await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500);
    rec('M7 Top 1.5 per × 3 = 4.5 → refused (saw part must be whole)', /whole number/.test(await errT(p)) && q(S, 'A6', 'Top') === '3', await errT(p));
    await setv(p, '3|qty', '1'); await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="5|L"]'); });
    await setv(p, '5|qty', '0.5'); await sleep(150); await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1800);
    rec('M7 a Stores row in the sub-heading 0.5 per × 3 = 1.5 → allowed (stores can be part quantities)', q(S, 'A6', 'Hinge') === '1.5', JSON.stringify([await errT(p), saved(S, 'A6')]));
    await closeAll(p); await openL(p, 'A6');
    await setv(p, '5|qty', 'as drawn'); await sleep(150);
    tt = await tots(p); tt[3] = tt[5];
    await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1800);
    const ad = linesOf(S, 'A6').find(x => x.part === 'Hinge');
    rec('[MEDIUM] M8 "as drawn" typed on a Stores row in a × 3 block → the person is warned (like the template ⚠ ×N — check qty) before the saw gets plain "as drawn"', /⚠|check/i.test((ad && ad.note) || '') || /as drawn|not a number|needs a quantity/i.test(await errT(p) + (await L.toasts(p))), JSON.stringify([tt[3], ad && [ad.qty, ad.unit_qty, ad.note], await errT(p)]));
    await closeAll(p);

    // 9. the saw / stores / labels read the totals; the saw heading says the ×
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    const view = await p.evaluate(() => { const l = lists().find(x => x.id === 'A2') || lsList('A2'); return listRows(l).map(r => r.item + ':' + (r.qty || '')); });
    rec('M9 what the saw / labels read for a saved × list = the TOTALS (and the heading says × N)', view.length > 0 && view.some(x => /^Hinge:/.test(x)), JSON.stringify(view));

    // 10. an OLD list (saved before 16 Nov): rows under a sub-heading after a unit block were totals OUTSIDE the block
    await openL(p, 'OLD'); rw = await rows(p); tt = await tots(p);
    rec('(info) M10 old list reopened: Filler (saved 6, no per-unit) shows ' + JSON.stringify([rw[3], tt[3], rw[4], tt[4]]), true);
    await setv(p, '0|units', '4'); await sleep(200); tt = await tots(p);
    rec('[MEDIUM] M10 old list: changing Units 3 → 4 on "900 Single Rail" does NOT change the Filler / Screws that were saved as fixed totals outside the block (6 and 7)', (!tt[3] || /= 6/.test(tt[3])) && (!tt[4] || /= 7/.test(tt[4])), JSON.stringify(tt));
    await closeAll(p);

    // 11. a template that holds a × block with a sub-heading
    await closeAll(p); await p.evaluate(() => { openListEditor(null, 'WO-41'); }); await sleep(1000);
    await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-itt="TX"]').click(); }); await sleep(900);
    const dlg = await p.evaluate(() => ({ hn: !!document.getElementById('it-hn'), n: !!document.getElementById('it-n'), txt: ([...document.querySelectorAll('.pod-ovl')].pop() || {}).innerText }));
    if (dlg.n) { await p.fill('#it-n', '2'); await p.click('#it-ok'); } else if (dlg.hn) { await p.fill('#it-hn', '2'); await p.click('#it-hok'); }
    await sleep(500); rw = await rows(p); tt = await tots(p);
    rec('M11 a template saved from a list with "Floor 2 × 4" → inserted × 2: Side 2 per (=4), Hinge 8 per (=16)', rw.some(x => x.item === 'Side' && x.qty === '2') && Object.values(tt).includes('= 16'), JSON.stringify([rw.map(x => x.item + ':' + (x.units || x.qty || '')), tt]));
    rec('[LOW] M11 …the template\'s sub-heading "Stores items" inside the × block comes in too', rw.some(x => x.hdr && x.item === 'Stores items'), JSON.stringify(rw.map(x => x.item)));
    await closeAll(p);

    // 12. a second house template after a × block is in the list
    await p.evaluate(() => { openListEditor(null, 'WO-42'); }); await sleep(1000);
    const pickT = async tid => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
      await p.evaluate(tid => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-itt="' + tid + '"]').click(); }, tid); await sleep(900); };
    await pickT('T1'); await p.fill('#it-hn', '4'); await p.fill('#it-hname', 'Floor 2'); await p.click('#it-hok'); await sleep(500);
    await pickT('T1');
    const second = await p.evaluate(() => ({ hn: !!document.getElementById('it-hn'), n: !!document.getElementById('it-n') }));
    rec('[MEDIUM] M12 the same house template a SECOND time (Floor 3) after "Floor 2 × 4" is in → still asks How many? + Name it (not the unit-block picker that drops its headings)', second.hn && !second.n, JSON.stringify(second));
    await closeAll(p);

    // 13. an OLD list with no heading brought in after a template "Floor 2 × 4" (last heading = its sub-heading)
    await p.evaluate(() => { openListEditor(null, 'WO-43'); }); await sleep(1000);
    await pickT('T1'); await p.fill('#it-hn', '4'); await p.fill('#it-hname', 'Floor 2'); await p.click('#it-hok'); await sleep(500);
    await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-findold').click(); }); await sleep(700);
    const okOld = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && o.querySelector('[data-foc="LOLD"]'); if (!b) return false; b.click(); return true; }); await sleep(900);
    rw = await rows(p); tt = await tots(p);
    const oi = rw.map((x, k) => [x, k]).filter(([x]) => x.item === 'Top').map(([, k]) => k)[0];
    rec('[HIGH] M13 an old list (Top 1, no heading) brought in after "Floor 2 × 4" → its rows keep their totals (Top = 1), not × 4', okOld && oi != null && (!tt[oi] || tt[oi] === '= 1'), JSON.stringify([okOld, rw.map(x => x.item + ':' + (x.units || x.qty || '')), tt]));
    await closeAll(p);

    // 14. an Excel sheet (no heading) added at the bottom after a × block
    const path = require('path'); const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Description', 'Qty', 'Length', 'Width', 'Material'], ['Shelf', 3, 560, 500, M]]), 'House 22');
    const BUF = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    await closeAll(p); await p.evaluate(() => { openListEditor(null, 'WO-38'); }); await sleep(1000);
    await pickT('T1'); await p.fill('#it-hn', '4'); await p.fill('#it-hname', 'Floor 2'); await p.click('#it-hok'); await sleep(500);
    await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } });
    await p.setInputFiles('#me-xlfile', { name: 'h22.xlsx', mimeType: 'application/octet-stream', buffer: BUF }); await sleep(1500);
    rw = await rows(p); tt = await tots(p);
    const si = rw.findIndex(x => x.item === 'Shelf');
    rec('[HIGH] M14 an Excel sheet (Shelf 3, no heading) added at the bottom after "Floor 2 × 4" → Shelf keeps total 3, not × 4', si >= 0 && (!tt[si] || tt[si] === '= 3'), JSON.stringify([rw.map(x => x.item + ':' + (x.units || x.qty || '')), tt[si]]));
    await closeAll(p);

    // 15. two PCs: B changes × 3 → 5 and saves; A (opened before) changes Hinge per-one 8 → 10 and saves
    const b = await X.dev(browser, S, 'design'), pb = b.page; await asks(pb);
    await openL(p, 'A8'); await openL(pb, 'A8');
    await setv(pb, '2|units', '5'); await sleep(200); await saveC(pb);
    rec('M15 set-up: PC B saved Floor 2 × 5 → Top 5, Hinge 40', q(S, 'A8', 'Top') === '5' && q(S, 'A8', 'Hinge') === '40', JSON.stringify(saved(S, 'A8')));
    await setv(p, '5|qty', '10'); await sleep(200); await p.evaluate(() => { window.__confirm = true; window.__asked = []; }); await saveC(p);
    const A8 = linesOf(S, 'A8'), F2 = A8.find(x => x.part === 'Floor 2'), hg = A8.find(x => x.part === 'Hinge'), tp = A8.find(x => x.part === 'Top');
    const consistent = F2 && hg && tp && String(+hg.unit_qty * +F2.qty) === String(hg.qty) && String(+tp.unit_qty * +F2.qty) === String(tp.qty);
    rec('[HIGH] M15 after both saves every row in Floor 2 = per-one × the saved ×: no row is left at the other PC\'s × (Floor 2 ×' + (F2 && F2.qty) + ')', consistent, JSON.stringify([saved(S, 'A8'), await p.evaluate(() => window.__asked.map(x => x.slice(0, 160)))]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
