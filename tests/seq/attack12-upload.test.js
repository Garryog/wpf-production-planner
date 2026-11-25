// Tester attack 12 (B10 upload): the Cienapps UPLOAD file → preview → Save. Odd files (header on row 3 under junk, no header,
// trailing spaces, totals / note rows, "Product Code" header, CSV with BOM + commas in names, empty bytes, a cover sheet first,
// the WO export with odd headers), the same file twice, two PCs saving the same file at the same moment (two pages, one fake
// DB), a lost reply on the Start-first insert then Save again, a 300-line file against a 300-row sequence (speed), <img onerror>
// in names and the FILE NAME. Fake Supabase only. Run: node tests/seq/attack12-upload.test.js
const X = require('./fixs.js'), B = require('./b10fix.js');
const { H, D, rec, sleep } = X;
const ups = (S, pid) => X.DS.liveOf(S.db, pid);
const toastTxt = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const read = (p, aoa) => p.evaluate(f => { const r = seqReadUpload(f, 0); return { err: r.err, hdr: r.hdr, warn: r.warn, lines: r.lines.map(l => ({ n: l.line_no, f: l.floor, u: l.unit, p: l.product, nm: l.name, d: l.descr, k: l.kind, q: l.qty, w: l.warn, m: l.multi, ch: l.children.length })) }; }, aoa);
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer();
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const a = await X.dev(browser, S, 'office'), p = a.page;
    // ---------- R: reading odd files (nothing written)
    let r = await read(p, [['Aspect Athenry phase 5', '', '', 'Printed 12/11/2026'], ['Prepared by: J Burke'], B.HDR, ...B.houseB('T09', '12', 'LH')]);
    rec('R1 header on row 3 under two junk rows: 5 lines from Excel row 4', !r.err && r.hdr && r.lines.length === 5 && r.lines[0].n === 4, JSON.stringify([r.err, r.lines.length, r.lines[0] && r.lines[0].n]));
    // a totals row and a note row under the lines (Excel sheets made by hand carry these)
    r = await read(p, [B.HDR, ...B.houseB('T09', '12', 'LH'), B.pad([5, '', '', '', 'TOTAL', '', 8550]), B.pad(['', '', '', '', '', 'NOTE: deliver to site office before 10am', ''])]);
    const junk = r.lines.filter(l => /TOTAL|NOTE/.test((l.nm || '') + ' ' + (l.d || '')));
    rec('R2 a TOTAL row (Qty 5, Name "TOTAL", no floor / unit / product) is NOT read as a line to add', !junk.some(l => /TOTAL/.test(l.nm)), JSON.stringify(junk));
    rec('R2b a NOTE row (only a Description, no floor / unit / product / name) is NOT read as a line to add', !junk.some(l => /NOTE/.test(l.d || '')), JSON.stringify(junk));
    // trailing spaces in header words AND cell values, mixed case header
    r = await read(p, [['qty ', ' FLOOR', 'Unit  ', 'product', 'NAME ', 'Description  ', 'price '], [1, 'T09 ', ' 12', 'K1 ', 'HOUSE TYPE B QUARTZ ', '', 1580]]);
    rec('R3 trailing / leading spaces in header + cells: read and trimmed ("HOUSE TYPE B QUARTZ ")', !r.err && r.lines.length === 1 && r.lines[0].f === 'T09' && r.lines[0].u === '12' && r.lines[0].p === 'K1' && r.lines[0].nm === 'HOUSE TYPE B QUARTZ' && r.lines[0].k === 'quartz', JSON.stringify(r));
    // "Product Code" header (a common variant) — product must still be read or the file refused, never silently blank
    r = await read(p, [['Qty', 'Floor', 'Unit', 'Product Code', 'Name', 'Description', 'Price'], [1, 'T09', '12', 'K8', 'HOUSE TYPE B LH', 'KITCHEN TYPE 1 LH', 3950]]);
    rec('R4 header says "Product Code": the product K8 is read (not silently blank)', !r.err && r.lines.length === 1 && r.lines[0].p === 'K8', JSON.stringify(r.lines[0]));
    // the WO export with odd headers (trailing spaces, lower case) and a title row above
    r = await read(p, [['Cienapps export 12/11'], ['wo # ', 'title ', 'CUSTOMER', 'due date ', 'step', 'Floor', 'Unit'], ['WO-40', 'HOUSE TYPE Q', 'Aderrig Homes', 46359, '4. READY', 'T09', '40']]);
    rec('R5 WO export with lower-case / trailing-space headers under a title row: refused as the WO export', /work-order export/.test(r.err) && !r.lines.length, r.err);
    r = await read(p, [['Work Order No', 'Customer', 'Title', 'Floor', 'Unit', 'Qty'], ['WO-41', 'Aderrig Homes', 'HOUSE TYPE Q', 'T09', '41', 1]]);
    rec('R5b a WO export saying "Work Order No": refused', /work-order export/.test(r.err), r.err);
    // Qty 0 / blank / text
    r = await read(p, [B.HDR, B.pad([0, 'T09', '12', 'K8', 'A', '', 1]), B.pad(['', 'T09', '13', 'K8', 'B', '', 1]), B.pad(['2 ', 'T09', '14', 'K8', 'C', '', 1])]);
    rec('R6 Qty 0 warned, blank Qty not warned, text "2 " read as 2 and warned', /Qty 0/.test(r.lines[0].w.join()) && !r.lines[1].w.length && r.lines[2].q === 2 && /Qty 2/.test(r.lines[2].w.join()), JSON.stringify(r.lines.map(l => [l.q, l.w])));
    // children with no parent
    r = await read(p, [B.HDR, B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B LH', 'KITCHEN', 3950]), B.pad(['', '', '', '', '', '', '', 1, 'AA_KIT_T1', 'FITTING KIT', '', ''])]);
    rec('R7 a row with only CHILDREN cells (no parent) is not a line', r.lines.length === 1, JSON.stringify(r.lines.map(l => l.nm)));
    // "Multiple" in any case, "Various", "ALL"; "Mult." / "Multi-storey" not
    r = await read(p, [B.HDR, B.pad([1, 'multiple', '7', 'K8', 'A', '', 1]), B.pad([1, 'T09', 'Various', 'K8', 'B', '', 1]), B.pad([1, 'T09', 'all ', 'K8', 'C', '', 1]), B.pad([1, 'Multi-storey', '9', 'K8', 'D', '', 1])]);
    rec('R8 "multiple" / "Various" / "all " flagged multi; "Multi-storey" not', r.lines.map(l => !!l.m).join() === 'true,true,true,false', r.lines.map(l => l.m).join());
    // the same house written two ways must give the SAME line key (so the same file "re-typed" adds 0)
    const lk = await p.evaluate(() => [keyLineStr('T09', 'Apt 7', 'K8', 'HOUSE TYPE B LH'), keyLineStr('Block T9', '007', 'k8 ', 'house type b  lh'), keyLineStr('t09', 7, 'K8', 'HOUSE TYPE B LH ')]);
    rec('R9 "T09 / Apt 7" = "Block T9 / 007" = "t09 / 7 (number)": one line key', lk[0] && lk[0] === lk[1] && lk[1] === lk[2], JSON.stringify(lk));
    // real bytes: CSV with BOM, commas inside quoted names; an empty file; a cover sheet first
    const csv = '﻿Qty,Floor,Unit,Product,Name,Description,Price\r\n1,T09,12,K8,"HOUSE TYPE B, LH","KITCHEN TYPE 1, LH",3950\r\n1,T09,12,K1,HOUSE TYPE B QUARTZ ,,1580\r\n';
    const c1 = await p.evaluate(async t => { const r = seqUpBook(new TextEncoder().encode(t).buffer); return { err: r.err, n: r.lines.length, nm: r.lines[0] && r.lines[0].name, q: r.lines[1] && r.lines[1].name, f: r.lines[0] && r.lines[0].floor }; }, csv);
    rec('R10 CSV with a BOM and commas inside quoted names: 2 lines, "HOUSE TYPE B, LH"', !c1.err && c1.n === 2 && c1.nm === 'HOUSE TYPE B, LH' && c1.q === 'HOUSE TYPE B QUARTZ' && c1.f === 'T09', JSON.stringify(c1));
    const c2 = await p.evaluate(() => { try { return seqUpBook(new ArrayBuffer(0)).err; } catch (e) { return 'THREW ' + e.message; } });
    rec('R11 a 0-byte file: a plain message, no crash', !!c2 && !/THREW/.test(c2), c2);
    const c3 = await p.evaluate(aoa => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Aderrig phase 5 — cover'], ['Lines on the next sheet']]), 'Cover'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Upload');
      const bin = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' }); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 255; const r = seqUpBook(u8.buffer); return { err: r.err, n: r.lines.length, sh: r.sheet }; }, [B.HDR, ...B.houseC('T09', '13', 'RH')]);
    rec('R12 a cover sheet first: the Upload sheet is used (5 lines)', !c3.err && c3.n === 5 && c3.sh === 'Upload', JSON.stringify(c3));
    // two identical "W2 BED 2" lines in one house + BED 1 / BED 2 robes with different names
    const two = [B.HDR, B.pad([1, 'T09', '41', 'W2', 'HOUSE TYPE B BED 2', 'TYPE 2 ROBE 1800', 700]), B.pad([1, 'T09', '41', 'W2', 'HOUSE TYPE B BED 2', 'TYPE 2 ROBE 1800', 700]), B.pad([1, 'T09', '41', 'W1', 'HOUSE TYPE B BED 1', 'TYPE 4', 400])];
    await p.evaluate(() => seqFresh('P1'));
    const cp = await p.evaluate(f => { const r = seqReadUpload(f, 0), v = seqClaimPreview('P1', r.lines, null); return [v.add.length, v.skip.length, v.unsure.length, r.lines.map(l => l.kind).join()]; }, two);
    rec('R13 two identical "W2 BED 2" + one "BED 1" in one house (no rows yet): 3 to add, all robes', JSON.stringify(cp) === '[3,0,0,"robes,robes,robes"]', JSON.stringify(cp));
    // ---------- escaping: a FILE NAME with <img onerror> in the refusal dialog and the preview
    await a.close();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), q = pm.page;
    await q.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    await B.upload(q, [['x']], '<img src=x onerror="window.__fx=1">.xlsx');
    rec('E1 refusal dialog: a file name with <img onerror> shown as text, nothing ran', await q.evaluate(() => !document.querySelector('.squ-dlg img') && window.__fx === undefined && /<img/.test(document.querySelector('.squ-dlg').innerText)));
    await q.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    const F1 = [B.HDR, ...B.houseB('T09', '12', 'LH')];
    await B.upload(q, F1, 'a"<img src=x onerror="window.__fx=2">.xlsx');
    let v = await B.preview(q);
    rec('E2 preview: the file name with <img onerror> shown as text, nothing ran', v && await q.evaluate(() => !document.querySelector('.squ-dlg img') && window.__fx === undefined), v && v.t.slice(0, 120));
    await q.evaluate(() => { const b = document.getElementById('squ-start'); if (b) { b.checked = false; b.dispatchEvent(new Event('change')); } }); await sleep(100);
    await q.evaluate(() => document.getElementById('squ-ok').click()); await sleep(900);
    const saved = ups(S, 'P1').filter(r => r.src === 'upload');
    rec('E3 saved: 5 rows; the why keeps the file name as text', saved.length === 5 && /<img/.test(saved[0].why), JSON.stringify(saved.map(r => r.why)[0]));
    await q.evaluate(() => render()); await sleep(300);
    rec('E4 the page after Save: no <img> element, nothing ran', await q.evaluate(() => !document.querySelector('#seq-pg img, .seq-tbl img') && window.__fx === undefined));
    // ---------- the same file twice (and with trailing spaces / different case this time)
    const F1b = [B.HDR.map(h => h.toUpperCase() + ' '), ...B.houseB('t09 ', ' 12', 'LH').map(r => r.map(c => typeof c === 'string' ? c + ' ' : c))];
    await B.upload(q, F1b, 'again.xlsx');
    v = await B.preview(q);
    rec('S1 the same file again, re-typed with trailing spaces / case: Will be added (0), Skipped 5, Save disabled', v && v.add === 0 && v.skip === 5 && v.dis, JSON.stringify(v && [v.add, v.skip, v.uns]));
    await q.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // ---------- a "revised" upload: the same house + kind, the hand corrected LH → RH (a second kitchen for T09 / 12?)
    const F1c = [B.HDR, B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B RH', 'KITCHEN TYPE 1 RH', 3950])];
    await B.upload(q, F1c, 'revised.xlsx');
    v = await B.preview(q);
    rec('S2 revised file (T09 / 12 kitchen, LH → RH): flagged ❓ / not added silently as a 2nd kitchen for the same house', v && (v.uns === 1 || v.add === 0), JSON.stringify(v && [v.add, v.skip, v.uns]) + ' ' + (v && v.t.slice(0, 400)));
    await q.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();

    // ---------- two PCs press Save on the same file at the same moment (two pages, one fake database)
    const S2 = X.makeServer();
    D.update(S2.db, 'projects', D.find(S2.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.seqRow(S2, 'R0', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13', descr: 'HOUSE TYPE C', kind: 'kitchen' });
    const A = await X.dev(browser, S2, 'pm', { me: { pm: 'John Burke' } }), Bp = await X.dev(browser, S2, 'office');
    await A.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    await Bp.page.evaluate(() => seqOpen('P1')); await sleep(600);
    const F2 = [B.HDR, ...B.houseB('T09', '30', 'LH'), ...B.houseB('T09', '31', 'RH')];
    await B.upload(A.page, F2, 'phase2.xlsx'); await B.upload(Bp.page, F2, 'phase2.xlsx');
    const va = await B.preview(A.page), vb = await B.preview(Bp.page);
    rec('P1 both PCs see Will be added (10)', va.add === 10 && vb.add === 10, JSON.stringify([va.add, vb.add]));
    await Promise.all([A.page.evaluate(() => document.getElementById('squ-ok').click()), Bp.page.evaluate(() => document.getElementById('squ-ok').click())]); await sleep(1500);
    const r2 = ups(S2, 'P1').filter(r => r.src === 'upload');
    rec('P2 the database has the file ONCE (10 rows, not 20)', r2.length === 10, r2.length);
    const ta = await toastTxt(A.page), tb = await toastTxt(Bp.page);
    rec('P3 the second PC is told "another screen added some meanwhile — 10 skipped"', [ta, tb].some(t => /10 rows added/.test(t)) && [ta, tb].some(t => /0 rows added.*another screen added some meanwhile — 10 skipped/.test(t)), JSON.stringify([ta, tb]));
    await A.close(); await Bp.close();

    // ---------- a lost reply on the START-first insert, then Save again
    const S3 = X.makeServer();
    D.update(S3.db, 'projects', D.find(S3.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const C = await X.dev(browser, S3, 'pm', { me: { pm: 'John Burke' } }), c = C.page;
    await c.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    await B.upload(c, [B.HDR, ...B.houseC('T09', '13', 'RH'), ...B.houseB('T09', '50', 'LH')], 'p3.xlsx');
    v = await B.preview(c);
    rec('L1 no sequence: Start-first offered (4) and ticked', v.start && v.startOn, v.t.slice(0, 200));
    const want = v.add;
    S3.dropReplyS = 1; // the FIRST rpc (Start) lands but its answer is lost
    await c.evaluate(() => document.getElementById('squ-ok').click()); await sleep(900);
    const m1 = await c.evaluate(() => (document.getElementById('squ-msg') || {}).textContent || '');
    rec('L2 Start reply lost: window stays, "Not saved … Nothing is added twice if you press Save again"', /Not saved/.test(m1) && await c.evaluate(() => !!document.querySelector('.squ-dlg')), m1);
    const nStart = ups(S3, 'P1').filter(r => r.src === 'start').length;
    await c.evaluate(() => document.getElementById('squ-ok').click()); await sleep(1000);
    const all3 = ups(S3, 'P1');
    rec('L3 Save again: Start rows NOT made twice, upload lines added once (' + want + ')', all3.filter(r => r.src === 'start').length === nStart && all3.filter(r => r.src === 'upload').length === want, JSON.stringify([nStart, all3.filter(r => r.src === 'start').length, all3.filter(r => r.src === 'upload').length, want]));
    const wos = {}; all3.filter(r => r.wo).forEach(r => { wos[r.wo] = (wos[r.wo] || 0) + 1; });
    rec('L4 every WO on one row', Object.values(wos).every(n => n === 1), JSON.stringify(wos));
    await C.close();

    // ---------- speed: a 300-line file against a project with 300 rows
    const S4 = X.makeServer();
    D.update(S4.db, 'projects', D.find(S4.db, 'projects', 'P1'), { pms: ['John Burke'] });
    for (let i = 0; i < 300; i++) X.seqRow(S4, 'Z' + i, 'P1', { floor: 'T' + (10 + (i % 5)), unit: String(100 + i), product: 'K8', name: 'HOUSE TYPE Z', kind: 'kitchen', src: 'upload' });
    const big = [B.HDR]; for (let i = 0; i < 60; i++) big.push(...B.houseB('T2' + (i % 3), String(200 + i), i % 2 ? 'LH' : 'RH'));
    const E = await X.dev(browser, S4, 'pm', { me: { pm: 'John Burke' } }), e = E.page;
    await e.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(800);
    const t0 = Date.now();
    await B.upload(e, big, 'big.xlsx');
    await e.waitForFunction(() => !!document.querySelector('#squ-ok'), null, { timeout: 15000 });
    const dt = Date.now() - t0;
    v = await B.preview(e);
    rec('B1 300-line file / 300-row sequence: preview in under 3 s, 300 to add, list capped ("…and 100 more")', v.add === 300 && dt < 3000 && /and 100 more/.test(v.t), JSON.stringify([v.add, dt]));
    const t1 = Date.now();
    await e.evaluate(() => document.getElementById('squ-ok').click());
    await e.waitForFunction(() => !document.querySelector('.squ-dlg'), null, { timeout: 20000 });
    rec('B2 Save 300 rows: done in under 5 s, 600 rows', ups(S4, 'P1').length === 600 && Date.now() - t1 < 5000, JSON.stringify([ups(S4, 'P1').length, Date.now() - t1]));
    await E.close();
    rec('no page errors (all PCs)', ![S, S2, S3, S4].some(s => (s.errors || []).length), JSON.stringify([S, S2, S3, S4].map(s => s.errors || [])));
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
