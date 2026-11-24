// Tester attack 2 (list window, 12 Nov evening): Excel through the new window ("Start from… → An Excel file…") and the whole
// phone flow at 360 px (Drawing office: open from a job → fill rows → Save → Saved ✓ → Close).
// Fake Supabase only. Run: node tests/list-window/attack2-excel-phone.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const feed = async (p, name, buf) => { await p.setInputFiles('#me-xlfile', { name, mimeType: 'application/octet-stream', buffer: buf }); await sleep(1200); };
const inView = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, ok: r.top >= 0 && r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && r.width > 0 }; }, sel);
const sideScroll = p => p.evaluate(() => { const o = document.querySelector('.pod-ovl'); return { doc: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ov: o ? o.scrollWidth - o.clientWidth : 0 }; });

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ===================== Excel through the window =====================
    const S = X.makeServer(X.v2Row());
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    // headers with spaces / odd case; then a sheet whose Width column comes BEFORE Length; then Qty first; € / comma quantities
    const imp = async (aoa) => { await closeAll(p); await p.evaluate(() => { window.__confirm = true; openListEditor(null, 'WO-3'); }); await sleep(1000); await feed(p, 'x.xlsx', xlsx({ 'Sheet1': aoa })); return { rs: await rows(p), e: await err(p) }; };
    let r1 = await imp([['DESCRIPTION ', ' qty', 'LENGTH ', 'width', 'Material ', 'Edging 1', 'Edging 2', 'note'], ['Side', 2, 720, 560, 'MFC White'], [], ['', '', ''], ['TOTAL', 2, '', '', '']]);
    rec('headers with trailing spaces / odd case: "Side" qty 2, L 720, W 560; blank rows and the TOTAL row left out', r1.rs.length === 1 && r1.rs[0].item === 'Side' && r1.rs[0].qty === '2' && r1.rs[0].L === '720' && r1.rs[0].W === '560', JSON.stringify(r1));
    const nm = await p.evaluate(() => document.getElementById('me-name').value);
    rec('[LOW] list name is NOT pre-filled with the sheet\'s name "Sheet1" after an Excel import (Garry: list name not pre-filled; blank = WO number)', !/^Sheet1$/i.test(nm), JSON.stringify(nm));
    r1 = await imp([['Description', 'Qty', 'Width', 'Length', 'Material'], ['Side', 2, 560, 720, 'MFC White']]);
    rec('[already on main] a sheet with WIDTH before LENGTH (headers say so): Side lands as L 720 × W 560 — or the person is warned', (r1.rs[0] && r1.rs[0].L === '720' && r1.rs[0].W === '560') || /width|length|column/i.test(r1.e), JSON.stringify(r1));
    r1 = await imp([['Qty', 'Description', 'Length', 'Width', 'Material'], [2, 'Side', 720, 560, 'MFC White']]);
    rec('[already on main] a sheet with QTY first: Side keeps its description and qty 2 — or the person is warned', (r1.rs.some(r => r.item === 'Side' && r.qty === '2')) || /column|header/i.test(r1.e), JSON.stringify(r1));
    r1 = await imp([['Description', 'Qty', 'Length', 'Width', 'Material'], ['Side', '€2', 720, 560, 'MFC White'], ['Shelf', '1,5', 500, 300, 'MFC White']]);
    await save(p, 2000);
    const e2 = await err(p), d2 = await donep(p);
    rec('quantities "€2" / "1,5" are never saved silently as something else — the person is told', !d2 && e2.length > 0, JSON.stringify([r1.rs.map(r => r.item + ':' + r.qty), e2, d2 && d2.h]));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // the sheet's own Floor / Unit / WO cells say ANOTHER house than the job the window was opened from
    await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(1000);
    const other = xlsx({ 'House 14': [['Project', 'Aderrig'], ['WO', 'WO-5'], ['Floor', 'T09'], ['Unit', '14'], [], COLS, ['Side', 2, 720, 560, 'MFC White'], ['Shelf', 3, 500, 300, 'MFC White']] });
    await p.evaluate(() => { window.__asked = []; });
    await feed(p, 'house-14.xlsx', other);
    const said = await p.evaluate(() => ({ asked: window.__asked.slice(), err: (document.getElementById('me-err') || {}).textContent, toast: [...document.querySelectorAll('.toast,#toast')].map(x => x.innerText).join(' ') }));
    rs = await rows(p); const j = await job(p);
    rec('(info) Excel whose WO / Floor / Unit cells say WO-5 · T09 · 14, imported into the window opened for WO-3 (T09 · 13)', true, JSON.stringify([rs.length, j.hwo, said]));
    rec('[wrong house] the sheet says WO-5 / Unit 14 but the window is WO-3 / Unit 13 → the person is WARNED before it is saved onto WO-3', /WO-5|Unit 14|another house|different/i.test(said.asked.join(' ') + said.err + said.toast), JSON.stringify(said));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // 2,000 rows
    const big = [COLS]; for (let i = 0; i < 2000; i++) big.push(['Part ' + i, 1 + (i % 5), 300 + i % 900, 200 + i % 400, 'MFC White']);
    await p.evaluate(() => openListEditor(null, 'WO-4')); await sleep(1000);
    const t0 = Date.now(); await feed(p, 'big.xlsx', xlsx({ Big: big })); await p.waitForFunction(() => document.querySelectorAll('.me-ed [data-row]').length > 100, null, { timeout: 60000 }).catch(() => {});
    const n = (await rows(p)).length, ms = Date.now() - t0;
    rec('2,000-row workbook → 2,000 rows in the window in under 20 s (' + ms + ' ms)', n === 2000 && ms < 20000, String(n));
    const t1 = Date.now(); await save(p, 4000); await p.waitForFunction(() => !!document.querySelector('.me-dov') || /Not saved/.test((document.getElementById('me-err') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
    const l4 = liveFor(S, 'WO-4');
    rec('…Save → one list with 2,000 rows (' + (Date.now() - t1) + ' ms)', l4.length === 1 && linesOf(S, l4[0].id).length === 2000, JSON.stringify([l4.length, l4[0] && linesOf(S, l4[0].id).length, await err(p)]));
    await closeAll(p);
    rec('excel: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();

    // ===================== Phone 360: the whole flow =====================
    const r2 = X.v2Row(); Object.assign(r2.orders.find(o => o.wo === 'WO-3'), { step: '5. WORK ORDER PROCESSED', dueDate: '2026-10-28', origDueDate: '2026-10-28' }); // processed, due next week → in "Cutting lists to issue"
    const S2 = X.makeServer(r2);
    const t2 = await X.dev(browser, S2, 'design', { viewport: { width: 360, height: 740 } }), q = t2.page; await asks(q);
    await sleep(800);
    // from the job: the Drawing office "Cutting lists to issue" row (or any job button that opens the window)
    const opener = await q.evaluate(() => { const b = document.querySelector('[data-ltistd="WO-3"]'); if (!b) return null; b.scrollIntoView(); const r = b.getBoundingClientRect(); return { txt: b.innerText, h: r.height, l: r.left, r: r.right, attr: [...b.attributes].map(a => a.name + '=' + a.value).join(' ') }; });
    rec('phone 360: the Drawing office screen has a button to start a list from a job, inside the screen and ≥ 36 px', !!opener && opener.l >= 0 && opener.r <= 360 && opener.h >= 36, JSON.stringify(opener));
    if (opener) await q.evaluate(() => document.querySelector('[data-ltistd="WO-3"]').click()); await sleep(1500);
    if (!(await ed(q))) { await q.evaluate(() => openListEditor(null, 'WO-3')); await sleep(1200); }
    let x = await inView(q, '#me-x0');
    rec('phone 360: window open — ✕ Close on screen at the TOP RIGHT', !!x && x.ok && x.r >= 300 && x.t < 120, JSON.stringify(x));
    let sw = await sideScroll(q);
    rec('phone 360: no sideways scroll on opening', sw.doc <= 362 && sw.ov <= 2, JSON.stringify(sw));
    // fill three rows with the on-screen controls
    const lay = await rows(q);
    rec('(info) phone 360: rows the window opened with (standard layout from the Drawing office row)', true, JSON.stringify(lay.map(r => (r.hdr ? 'H:' : '') + r.item)));
    const parts = () => rows(q).then(rs => rs.map((r, i) => r.hdr ? -1 : i).filter(i => i >= 0));
    let pi = await parts(); if (!pi.length) { await click(q, 'me-addsaw'); await sleep(250); pi = await parts(); }
    await fillSaw(q, pi[0], 'Side', '2', '720', '560', 'MFC White');
    await click(q, 'me-addsaw'); await sleep(250); pi = await parts(); await fillSaw(q, pi[pi.length - 1], 'Shelf', '3', '500', '300', 'MFC White');
    await click(q, 'me-addsaw'); await sleep(250); pi = await parts(); await setv(q, pi[pi.length - 1] + '|item', 'Hinge'); await setv(q, pi[pi.length - 1] + '|qty', '8');
    sw = await sideScroll(q);
    rec('phone 360: three rows typed — still no sideways scroll', sw.doc <= 362 && sw.ov <= 2, JSON.stringify(sw));
    // every row input is on screen sideways
    const offs = await q.evaluate(() => [...document.querySelectorAll('.me-ed input, .me-ed select, .me-ed button')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.getAttribute('data-mr') || e.innerText.slice(0, 12), l: Math.round(r.left), r: Math.round(r.right) }; }).filter(o => o.l < -1 || o.r > innerWidth + 1));
    rec('phone 360: every box / button of the window is inside the screen sideways', !offs.length, JSON.stringify(offs.slice(0, 8)));
    // Save reachable: scroll to it, it is in view and big; ✕ still visible after scrolling down
    await q.evaluate(() => { const b = document.getElementById('me-save'); b.scrollIntoView({ block: 'center' }); }); await sleep(300);
    const sv = await inView(q, '#me-save'); x = await inView(q, '#me-x0');
    rec('phone 360: Save scrolled to — on screen, ≥ 44 px tall', !!sv && sv.ok && sv.h >= 44, JSON.stringify(sv));
    rec('phone 360: …✕ Close still on screen at the top right after scrolling down', !!x && x.ok && x.r >= 300, JSON.stringify(x));
    // keyboard up on a phone: a shorter screen (on-screen keyboard takes half)
    await q.setViewportSize({ width: 360, height: 400 }); await sleep(300);
    x = await inView(q, '#me-x0');
    rec('phone 360 with the on-screen keyboard up (400 px tall): ✕ Close still reachable at the top', !!x && x.ok, JSON.stringify(x));
    await q.setViewportSize({ width: 360, height: 740 }); await sleep(300);
    await q.evaluate(() => { window.__confirm = true; document.getElementById('me-save').click(); }); await sleep(2500);
    const dn = await donep(q);
    rec('phone 360: Save → "Saved ✓ — list is with the Saw & Stores", one list on WO-3 with the 3 typed rows', !!dn && /Saved ✓/.test(dn.h) && liveFor(S2, 'WO-3').length === 1 && ['Side', 'Shelf', 'Hinge'].every(n => linesOf(S2, liveFor(S2, 'WO-3')[0].id).some(x => x.part === n)), JSON.stringify([dn && dn.h, await err(q)]));
    const dc = await inView(q, '#me-dclose');
    rec('phone 360: Saved panel — Close on screen, ≥ 44 px', !!dc && dc.ok && dc.h >= 44, JSON.stringify(dc));
    sw = await sideScroll(q);
    rec('phone 360: Saved panel — no sideways scroll', sw.doc <= 362, JSON.stringify(sw));
    await click(q, 'me-dclose'); await sleep(400);
    rec('phone 360: Close → nothing left open, back on the Drawing office screen', !(await q.evaluate(() => document.querySelectorAll('.pod-ovl').length)) && /Drawing office/.test(await q.evaluate(() => document.body.innerText)));
    // the list now shows as made on that screen
    rec('phone 360: WO-3 no longer listed in "Cutting lists to issue"', !/WO-3\b/.test(await q.evaluate(() => (document.getElementById('lti') || {}).innerText || '')));
    rec('phone: no page errors', !(S2.errors || []).length, JSON.stringify(S2.errors));
    await t2.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
