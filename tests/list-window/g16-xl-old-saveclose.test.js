// Garry, 16 Nov 2026: (1) "these top lines need to be removed when importing a spreadsheet" — the blank standard headings and
// rows go when an Excel sheet, an old list or a template comes into a list where nothing has been typed yet;
// (2) "also need a save and close button". Fake Supabase only. Run: node tests/list-window/g16-xl-old-saveclose.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks, setv, rows, donep, liveFor } = L;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = aoa => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'House 22'); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const BOOK = xlsx([COLS, ['Base side', 2, 720, 560, 'MFC White', '', '', ''], ['Base back', 1, 700, 500, 'MFC White', '', '', ''], ['Shelf', 3, 560, 500, 'MFC White', '', '', '']]);
const feed = async p => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } });
  await p.setInputFiles('#me-xlfile', { name: 'house22.xlsx', mimeType: 'application/octet-stream', buffer: BOOK }); await sleep(1200);
  await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && [...o.querySelectorAll('button')].find(b => /^(Use|Bring in|Add|Import|OK)/i.test(b.textContent.trim()) && !o.querySelector('.me-ed')); if (b) b.click(); }); await sleep(800); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'LOLD', { wos: [], name: 'Old house 9' });
    const oldN = S.db.t.list_lines.filter(x => x.list_id === 'LOLD' && x.removed_rev == null).length;
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // 1. Excel into the blank standard layout
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const r0 = await rows(p);
    await feed(p);
    const r1 = await rows(p);
    rec('set-up: the blank standard layout has ' + r0.length + ' rows (headings + empty rows)', r0.length > 3 && r0.filter(r => !r.hdr).every(r => !r.item));
    rec('Excel sheet into the blank layout → ONLY the sheet\'s 3 rows (the blank headings and rows are gone)', r1.length === 3 && r1.every(r => !r.hdr && r.item), JSON.stringify(r1.map(r => r.item)));
    await closeAll(p);
    // 1b. Excel after something was typed → added, typed row kept
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const i = (await rows(p)).findIndex(r => !r.hdr); await setv(p, i + '|item', 'Typed first'); await setv(p, i + '|qty', '1'); await sleep(200);
    const n1 = (await rows(p)).length; await feed(p); const r1b = await rows(p);
    rec('something typed first → the sheet is ADDED and the typed row stays', r1b.length === n1 + 3 && r1b.some(r => r.item === 'Typed first'), JSON.stringify([r1b.length, n1]));
    await closeAll(p);
    // 2. An old list into the blank layout
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-findold').click(); }); await sleep(700);
    const used = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && o.querySelector('[data-foc="LOLD"]'); if (!b) return false; b.click(); return true; }); await sleep(900);
    const r2 = await rows(p);
    rec('an old list into the blank layout → only the old list\'s rows (' + oldN + ')', used && r2.length === oldN, JSON.stringify([used, r2.length, oldN]));
    await closeAll(p);
    // 3. ✓ Save & close
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const btns = await p.evaluate(() => [...document.querySelectorAll('.me-ed .me-foot button')].map(b => b.id + ':' + b.textContent.trim()));
    rec('the window has "Save list → Saw & Stores" and "✓ Save & close"', btns.some(b => /^me-save:Save list/.test(b)) && btns.some(b => /^me-saveclose:✓ Save & close/.test(b)), JSON.stringify(btns));
    const j = (await rows(p)).findIndex(r => !r.hdr);
    for (const [f, v] of [['item', 'Base side'], ['qty', '2'], ['L', '720'], ['W', '560'], ['mat', 'MFC White']]) await setv(p, j + '|' + f, v);
    await p.click('#me-saveclose'); await sleep(2500);
    const after = await p.evaluate(() => ({ open: !!document.querySelector('.me-ed'), panel: !!document.querySelector('.me-dov'), toast: [...document.querySelectorAll('#toast,.toast')].map(x => x.textContent).join(' | ') }));
    rec('✓ Save & close: ONE press saves the list and the window is gone (no finish panel)', liveFor(S, 'WO-3').length === 1 && !after.open && !after.panel, JSON.stringify([liveFor(S, 'WO-3').length, after]));
    rec('…and it says "Saved ✓ — list is with the Saw & Stores"', /Saved ✓ — list is with the Saw & Stores/.test(after.toast), after.toast);
    // 4. plain Save still shows the finish panel (after a Save & close that was refused)
    await p.evaluate(() => lsNewStd('WO-4')); await sleep(900);
    const k = (await rows(p)).findIndex(r => !r.hdr); await setv(p, k + '|item', 'No qty'); await sleep(150);
    await p.click('#me-saveclose'); await sleep(900);
    const ref = await p.evaluate(() => ({ open: !!document.querySelector('.me-ed'), err: (document.getElementById('me-err') || {}).textContent || '' }));
    rec('Save & close refused (a row with no quantity) → the window stays open and says why', ref.open && ref.err.length > 0 && !liveFor(S, 'WO-4').length, JSON.stringify(ref));
    await setv(p, k + '|qty', '1'); await setv(p, k + '|L', '500'); await setv(p, k + '|W', '400'); await setv(p, k + '|mat', 'MFC White'); await sleep(150);
    await p.click('#me-save'); await sleep(2500);
    const dn = await donep(p);
    rec('then the plain Save → the "Saved ✓" panel as before (not closed by the earlier Save & close)', !!dn && /Saved ✓/.test(dn.h), JSON.stringify(dn && dn.h));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
