// Tester attack ROUND 4 (16 Nov) on "a template / Excel sheet / old list brought into a list where nothing is typed REPLACES the
// blank standard layout; if anything is typed, rows are added" (blankAll in openListEditor2). Edge cases: only a heading note,
// only a "Bought in" tick, only a material, only an edging, a heading RENAMED, a units heading added and filled in, typed then
// Undo, replaced then Undo, the same Excel twice, and whether "Close without saving?" agrees with what the import treats as typed.
// Fake Supabase only. Run: node tests/list-window/attack4-blank-replace.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks, setv, rows } = L;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = aoa => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'House 22'); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const BOOK = xlsx([COLS, ['Base side', 2, 720, 560, 'MFC White', '', '', ''], ['Base back', 1, 700, 500, 'MFC White', '', '', ''], ['Shelf', 3, 560, 500, 'MFC White', '', '', '']]);
const feed = async (p, name) => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } });
  await p.setInputFiles('#me-xlfile', { name: name || 'house22.xlsx', mimeType: 'application/octet-stream', buffer: BOOK }); await sleep(1200);
  await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && !o.querySelector('.me-ed') && [...o.querySelectorAll('button')].find(b => /^(Use|Bring in|Add|Import|OK)/i.test(b.textContent.trim())); if (b) b.click(); }); await sleep(800); };
const insTpl = async (p, tid) => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
  await p.evaluate(tid => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && o.querySelector('[data-itt="' + tid + '"]'); if (b) b.click(); }, tid); await sleep(900); };
const useOld = async (p, id) => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-findold').click(); }); await sleep(700);
  return p.evaluate(id => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && o.querySelector('[data-foc="' + id + '"]'); if (!b) return false; b.click(); return true; }, id).then(async r => { await sleep(900); return r; }); };
const std = async (p, wo) => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; window.__confirm = true; lsNewStd(wo); }, wo || 'WO-3'); await sleep(900); return rows(p); };
const askClose = p => p.evaluate(() => { window.__asked = []; window.__confirm = false; const x = document.getElementById('me-x0'); if (x) x.click(); const a = window.__asked.slice(); window.__confirm = true; return a.length > 0; });
const undo = async p => { const b = await p.evaluate(() => { const u = document.getElementById('me-undo'); if (u) { u.click(); return true; } return false; }); if (!b) { await p.focus('.me-ed [data-mr$="|item"]'); await p.keyboard.press('Control+z'); } await sleep(300); };
const allRows = p => p.evaluate(() => [...document.querySelectorAll('.me-ed [data-row]')].map(tr => { const q = f => { const e = tr.querySelector('[data-mr$="|' + f + '"]'); return e ? e.value : undefined; }; const b = tr.querySelector('[data-mbuy]'); return { hdr: /me-h|me-ch/.test(tr.className), item: q('item'), note: q('note'), units: q('units'), edging: q('edging'), mat: q('mat'), buy: b ? b.checked : undefined }; }));

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });
    X.F3.seedList(S, 'LOLD', { wos: [], name: 'Old house 9' });
    const tl = S.db.t.list_lines.filter(x => x.list_id === 'T1' && x.removed_rev == null).length;
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    const r0 = await std(p); const N0 = r0.length;
    rec('set-up: blank standard layout of ' + N0 + ' rows', N0 > 3);

    // ---------- 1. only a HEADING NOTE typed ----------
    for (const [how, fn] of [['an Excel sheet', q => feed(q)], ['a template', q => insTpl(q, 'T1')], ['an old list', q => useOld(q, 'LOLD')]]) {
      await std(p); const h = (await allRows(p)).findIndex(x => x.hdr);
      await setv(p, h + '|note', 'Customer wants soft-close everywhere'); await sleep(150);
      await fn(p); const a = await allRows(p);
      rec((how === 'an Excel sheet' ? '[MEDIUM] ' : '') + 'B1 only a NOTE typed on a heading, then ' + how + ' → the note is KEPT (rows added, not replaced)', a.some(x => x.note === 'Customer wants soft-close everywhere'), JSON.stringify([a.length, N0]));
    }
    // ---------- 2. only a "Bought in" tick ----------
    await std(p); { const i = (await allRows(p)).findIndex(x => !x.hdr && x.buy !== undefined);
      const ok = await p.evaluate(i => { const b = document.querySelector('.me-ed [data-mbuy="' + i + '"]'); if (!b) return false; b.checked = true; b.dispatchEvent(new Event('change')); return true; }, i); await sleep(200);
      const before = (await allRows(p)).length; await feed(p); const a = await allRows(p);
      rec('[MEDIUM] B2 only a "Bought in" box ticked, then an Excel sheet → the tick is kept, the sheet ADDED', ok && a.length === before + 3 && a.some(x => x.buy === true), JSON.stringify([ok, a.length, before])); }
    // ---------- 3. only an edging typed / only a material picked ----------
    await std(p); { const i = (await allRows(p)).findIndex(x => !x.hdr); await setv(p, i + '|edging', '1mm ABS'); await sleep(150);
      const before = (await allRows(p)).length; await feed(p); const a = await allRows(p);
      rec('B3 only an EDGING typed, then an Excel sheet → kept, added', a.length === before + 3 && a.some(x => x.edging === '1mm ABS'), JSON.stringify([a.length, before])); }
    await std(p); { const i = (await allRows(p)).findIndex(x => !x.hdr); await setv(p, i + '|mat', 'MFC White'); await sleep(150);
      const before = (await allRows(p)).length; await feed(p); const a = await allRows(p);
      rec('[LOW] B4 only a MATERIAL picked on an empty row, then an Excel sheet → kept, added', a.length === before + 3, JSON.stringify([a.length, before])); }
    // ---------- 4. a heading RENAMED ----------
    await std(p); { const a0 = await allRows(p); const h = a0.findIndex((x, k) => x.hdr && k > 0);
      await setv(p, h + '|item', 'Kickers — check on site first'); await sleep(150);
      const asks1 = await askClose(p);
      const a = (await feed(p), await allRows(p));
      rec('(info) B5 a heading renamed counts as "typed" for ✕ Close ("Close without saving?" ' + (asks1 ? 'IS' : 'is NOT') + ' asked)', true);
      rec('[LOW] B5 a standard heading RENAMED ("Kickers — check on site first"), then an Excel sheet → the renamed heading is kept (✕ Close treats it as typed, the import must too)', a.some(x => x.item === 'Kickers — check on site first'), JSON.stringify(a.map(x => x.item).slice(0, 8))); }
    // ---------- 5. a units heading added and filled ----------
    await std(p); { await p.evaluate(() => { const d = document.getElementById('me-more'); if (d) d.open = true; const b = document.getElementById('me-addunit'); if (b) b.click(); }); await sleep(400);
      const a0 = await allRows(p); const h = a0.map((x, k) => [x, k]).filter(([x]) => x.hdr && x.units !== undefined).map(([, k]) => k).pop();
      if (h == null) rec('B6 set-up: "＋ Unit block" adds a heading with a Units box', false, JSON.stringify(a0.slice(-3)));
      else {
        await setv(p, h + '|item', 'Type B kitchens'); await setv(p, h + '|units', '4'); await sleep(150);
        const asks2 = await askClose(p);
        await feed(p); const a = await allRows(p);
        rec('[MEDIUM] B6 a unit block added and filled ("Type B kitchens" × 4 units), nothing else, then an Excel sheet → the unit block is kept', a.some(x => x.item === 'Type B kitchens' && x.units === '4'), JSON.stringify([asks2, a.map(x => x.item + (x.units ? '×' + x.units : '')).slice(0, 10)]));
      } }
    // B5t / B6t: the same two with a TEMPLATE (blankAll) instead of Excel
    await std(p); { const a0 = await allRows(p); const h = a0.findIndex((x, k) => x.hdr && k > 0);
      await setv(p, h + '|item', 'Kickers — check on site first'); await sleep(150); await insTpl(p, 'T1'); const a = await allRows(p);
      rec('[LOW] B5t a standard heading RENAMED, then a TEMPLATE → the renamed heading is kept', a.some(x => x.item === 'Kickers — check on site first'), JSON.stringify(a.map(x => x.item).slice(0, 6))); }
    await std(p); { await p.evaluate(() => { const d = document.getElementById('me-more'); if (d) d.open = true; const b = document.getElementById('me-addunit'); if (b) b.click(); }); await sleep(400);
      const a0 = await allRows(p); const h = a0.map((x, k) => [x, k]).filter(([x]) => x.hdr && x.units !== undefined).map(([, k]) => k).pop();
      if (h != null) { await setv(p, h + '|item', 'Type B kitchens'); await setv(p, h + '|units', '4'); await sleep(150); await useOld(p, 'LOLD'); const a = await allRows(p);
        rec('[MEDIUM] B6o a unit block filled in ("Type B kitchens" × 4), then AN OLD LIST → the unit block is kept', a.some(x => x.item === 'Type B kitchens' && x.units === '4'), JSON.stringify(a.map(x => x.item + (x.units ? '×' + x.units : '')).slice(0, 8))); } }
    // ---------- 6. typed, then Undo back to blank → replaced; replaced, then Undo → blank back ----------
    await std(p); { const i = (await allRows(p)).findIndex(x => !x.hdr); await setv(p, i + '|item', 'Typo'); await sleep(150);
      await undo(p);
      const blank = (await allRows(p)).every(x => x.hdr || !x.item);
      await feed(p); const a = await allRows(p);
      rec('B7 typed one word, ↶ Undo (blank again), then an Excel sheet → replaced: only the 3 sheet rows', blank && a.length === 3, JSON.stringify([blank, a.length]));
      await undo(p); const u = await allRows(p);
      rec('B8 …↶ Undo once → the blank standard layout is back exactly (' + N0 + ' rows, nothing typed)', u.length === N0 && u.every(x => x.hdr || !x.item), JSON.stringify(u.length));
      rec('B8 …and ✕ Close does not ask (nothing typed)', !(await askClose(p))); }
    await std(p); { const i = (await allRows(p)).findIndex(x => !x.hdr); await setv(p, i + '|item', 'Keep me'); await setv(p, i + '|qty', '1'); await sleep(150);
      const n = (await allRows(p)).length; await feed(p); await undo(p); const a = await allRows(p);
      rec('B9 typed a row, an Excel sheet ADDED, ↶ Undo → the sheet rows go, the typed row stays', a.length === n && a.some(x => x.item === 'Keep me') && !a.some(x => x.item === 'Shelf'), JSON.stringify([a.length, n])); }
    // ---------- 7. the same Excel twice into the blank layout ----------
    await std(p); { await feed(p); const a1 = (await allRows(p)).length; await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await feed(p, 'house22.xlsx'); const a2 = await allRows(p); const asked = await p.evaluate(() => window.__asked.slice());
      rec('B10 the same Excel file brought in twice: replaced the first time (3 rows), the second time ASKED about before it is added again', a1 === 3 && (asked.length > 0 || a2.length === 3), JSON.stringify([a1, a2.length, asked.map(x => x.slice(0, 60))])); }
    // ---------- 8. whitespace only ----------
    await std(p); { const i = (await allRows(p)).findIndex(x => !x.hdr); await setv(p, i + '|item', '   '); await sleep(150);
      await feed(p); const a = await allRows(p);
      rec('B11 only spaces typed in a Description → still "nothing typed": replaced by the sheet (3 rows)', a.length === 3, String(a.length)); }
    // ---------- 9. an EXISTING saved list is never wiped ----------
    X.F3.seedList(S, 'LX', { wos: ['WO-4'], name: 'Saved list' }); await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await closeAll(p); await p.evaluate(() => openListEditor('LX')); await sleep(1000);
    { const n = (await allRows(p)).length; await feed(p); const a = await allRows(p);
      rec('B12 a SAVED list opened, then an Excel sheet → added under its rows, nothing replaced', a.length === n + 3, JSON.stringify([a.length, n])); }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
