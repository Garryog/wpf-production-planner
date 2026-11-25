// B10 step 3 (Job B part 6): "⬆ Cienapps file" on the sequence page → preview → Save. Hidden before the SQL / with the lists
// switched off / for read-only screens. Preview names the project + file + line count, offers "Start the sequence from today's
// jobs first (N)" ticked by default when there is no sequence, lists Will be added / Skipped / ❓ (Add anyway), warns Qty 2, puts
// the rows at the bottom or under row #; nothing saved before Save; Save → seq_insert (src upload, upload_id, line_no, why);
// toast uses the database's counts; a lost reply + Save again adds nothing twice; Cancel saves nothing; names escaped; 360 px.
// Fake Supabase only. Run: node tests/seq/b10c-upload-ui.test.js
const X = require('./fixs.js'), B = require('./b10fix.js');
const { H, D, rec, sleep } = X;
const toastTxt = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const ups = (S, pid) => X.DS.liveOf(S.db, pid);
(async () => {
  const browser = await H.chromium.launch();
  try {
    const FILE = [B.HDR, ...B.houseC('T09', '13', 'RH'), B.pad([2, 'T09', '20', 'K8', 'HOUSE TYPE B <img src=x onerror="window.__x=1"> LH', 'KITCHEN TYPE 1 LH', 3950]), B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B RH', 'KITCHEN TYPE 1 RH', 3950])];
    // ---- before the SQL / switch off: no button anywhere, nothing sent
    const S0 = X.makeServer(null, { noSeq: true });
    const p0 = await X.dev(browser, S0, 'office');
    rec('before the SQL: no sequence page, no ⬆ Cienapps file', await p0.page.evaluate(() => !/seq-up/.test(seqPageHTML('P1')) && !document.getElementById('seq-up')));
    await p0.close();
    const S1 = X.makeServer(X.v1Row());
    const p1 = await X.dev(browser, S1, 'office');
    rec('lists switched off: no ⬆ Cienapps file, no sequence traffic', await p1.page.evaluate(() => !/seq-up/.test(seqPageHTML('P1'))) && X.SS.seqCalls(S1).length === 0);
    await p1.close();

    // ---- with the SQL: PM John Burke's project P1, no sequence yet
    const S = X.makeServer();
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const st = await X.dev(browser, S, 'stores');
    rec('stores (look only): the page has no ⬆ Cienapps file', await st.page.evaluate(() => { seqOpen('P1'); return !!document.getElementById('seq-pg') && !document.getElementById('seq-up'); }));
    await st.close();
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), p = pm.page;
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    rec('PM on his project: ⬆ Cienapps file in the top bar', await p.evaluate(() => !!document.querySelector('.seq-top #seq-up')));
    // a refused file
    await B.upload(p, [['WO #', 'Title', 'Step'], ['WO-9', 'X', '4. READY']], 'wo-export.xlsx');
    let v = await B.preview(p);
    rec('work-order export picked: told plainly, no preview, nothing sent', v && /work-order export/.test(v.err) && v.add == null && X.SS.seqCalls(S).filter(x => /^POST \/rpc/.test(x)).length === 0, JSON.stringify(v && v.err));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // the real file
    const n0 = S.log.length;
    await B.upload(p, FILE, 'Aderrig phase 1.xlsx');
    v = await B.preview(p);
    rec('preview: project + file name + 7 lines', v && /Cienapps upload file → Aderrig/.test(v.t) && /Aderrig phase 1\.xlsx · 7 lines/.test(v.t), v && v.t.slice(0, 200));
    rec('"Start the sequence from today\'s jobs first (4)" shown and ticked', v.start && v.startOn && /first \(4\)/.test(v.t));
    rec('with Start: K8 + K2 skipped (they take WO-3 / WO-4 by house), 4 to add, "T09" / 12 is ❓ (WO-1 is floor GF / 12)', v.skip === 2 && v.add === 4 && v.uns === 1 && /Save 4 rows/.test(v.ok), JSON.stringify([v.add, v.skip, v.uns, v.ok]));
    rec('Qty 2 warned; the K8 line shows "+ 2 child items (info)"', /Qty 2 — one row; check how Cienapps makes the WOs/.test(v.t) && /\+ 2 child items \(info\)/.test(v.t));
    rec('names escaped in the preview (no element, nothing ran)', await p.evaluate(() => !document.querySelector('.squ-dlg img') && window.__x === undefined));
    rec('nothing sent before Save', S.log.slice(n0).filter(x => /^(POST|PATCH) /.test(x)).length === 0, JSON.stringify(S.log.slice(n0)));
    // untick Start → everything to add (no rows to claim); tick Add anyway → 1 more
    await p.evaluate(() => { const b = document.getElementById('squ-start'); b.checked = false; b.dispatchEvent(new Event('change')); }); await sleep(100);
    v = await B.preview(p);
    rec('Start unticked: all 7 to add, nothing skipped or ❓ (no rows yet)', v.add === 7 && v.skip == null && v.uns == null && !v.startOn, JSON.stringify([v.add, v.skip, v.uns]));
    await p.evaluate(() => { const b = document.getElementById('squ-start'); b.checked = true; b.dispatchEvent(new Event('change')); }); await sleep(100);
    await p.evaluate(() => { const b = document.querySelector('[data-squf]'); b.checked = true; b.dispatchEvent(new Event('change')); }); await sleep(100);
    v = await B.preview(p);
    rec('❓ "Add anyway" ticked: Save 5 rows', /Save 5 rows/.test(v.ok), v.ok);
    await p.evaluate(() => document.getElementById('squ-ok').click()); await sleep(900);
    const rs = ups(S, 'P1');
    rec('database: 4 start rows then 5 upload rows at the bottom, in file order', rs.length === 9 && rs.slice(0, 4).every(r => r.src === 'start') && rs.slice(4).map(r => r.line_no).join() === '4,5,6,7,8', JSON.stringify(rs.map(r => r.src + ':' + r.line_no)));
    const u = rs[4];
    rec('upload rows: waiting, src upload, one upload_id, why "Cienapps upload: Aderrig phase 1.xlsx", by John Burke', rs.slice(4).every(r => r.state === 'waiting' && r.src === 'upload' && r.upload_id === u.upload_id && r.why === 'Cienapps upload: Aderrig phase 1.xlsx' && r.created_by === 'John Burke'), JSON.stringify(u));
    let t = await toastTxt(p);
    rec('toast: "Sequence started (4) · 5 rows added — waiting for WO numbers"', /Sequence started \(4\) · 5 rows added — waiting for WO numbers/.test(t), t);
    rec('the page shows 9 rows, ⏳ no WO yet on the new ones', await p.evaluate(() => document.querySelectorAll('tr.seq-r').length === 9 && /no WO yet/.test(document.querySelectorAll('tr.seq-r')[5].innerText)));
    // the same file again: nothing to add
    await B.upload(p, FILE, 'Aderrig phase 1.xlsx');
    v = await B.preview(p);
    rec('same file again: no Start offer, Will be added (0), Save disabled, 7 skipped', !v.start && v.add === 0 && v.skip === 7 && v.dis, JSON.stringify([v.add, v.skip, v.uns, v.dis]));
    await p.evaluate(() => document.getElementById('squ-x').click()); await sleep(100);
    rec('Cancel: window closed, nothing sent', await p.evaluate(() => !document.querySelector('.squ-dlg')) && ups(S, 'P1').length === 9);
    // under row #2
    const F2 = [B.HDR, B.pad([1, 'T09', '21', 'K8', 'HOUSE TYPE B LH', 'KITCHEN TYPE 1 LH', 3950]), B.pad([1, 'T09', '21', 'K1', 'HOUSE TYPE B QUARTZ', '', 1580])];
    await B.upload(p, F2, 'two.csv');
    await p.evaluate(() => { document.querySelector('input[name="squ-pos"][value="at"]').checked = true; document.getElementById('squ-at').value = '2'; }); await sleep(50);
    await p.evaluate(() => document.getElementById('squ-ok').click()); await sleep(800);
    const r2 = ups(S, 'P1');
    rec('.csv, "under row # 2": the 2 new rows are #3 and #4, the rest below', r2.length === 11 && r2[2].line_no === 2 && r2[3].line_no === 3 && r2[2].floor === 'T09' && r2[2].unit === '21' && r2[4].src === 'start', JSON.stringify(r2.map(r => r.unit + ':' + r.line_no)));
    // another screen adds one of the lines meanwhile → the database's count in the toast
    const F3 = [B.HDR, B.pad([1, 'T09', '22', 'K8', 'HOUSE TYPE B LH', 'KITCHEN TYPE 1 LH', 3950]), B.pad([1, 'T09', '22', 'K2', 'HOUSE TYPE B UTILITY LH', '', 1920])];
    await B.upload(p, F3, 'three.xlsx');
    S.beforeRpc = (fn) => { if (fn === 'seq_insert') { S.beforeRpc = null; X.seqRow(S, 'OTHER1', 'P1', { floor: 'T09', unit: '22', product: 'K8', name: 'HOUSE TYPE B LH', src: 'upload' }); } };
    await p.evaluate(() => document.getElementById('squ-ok').click()); await sleep(800);
    t = await toastTxt(p);
    rec('another screen added one meanwhile: "1 row added … another screen added some meanwhile — 1 skipped"; no double', /1 row added — waiting for WO numbers · another screen added some meanwhile — 1 skipped/.test(t) && ups(S, 'P1').filter(r => r.unit === '22').length === 2, t);
    // a lost reply: told "not saved"; Save again adds nothing twice
    const F4 = [B.HDR, B.pad([1, 'T09', '23', 'K8', 'HOUSE TYPE B LH', 'KITCHEN TYPE 1 LH', 3950])];
    await B.upload(p, F4, 'four.xlsx');
    S.dropReplyS = 1;
    await p.evaluate(() => document.getElementById('squ-ok').click()); await sleep(800);
    const m = await p.evaluate(() => (document.getElementById('squ-msg') || {}).textContent || '');
    rec('lost reply: the window stays, "Not saved — … Nothing is added twice if you press Save again."', /Not saved/.test(m) && /Nothing is added twice/.test(m), m);
    await p.evaluate(() => document.getElementById('squ-ok').click()); await sleep(800);
    rec('Save again: still ONE row for T09 / 23 (the database had it)', ups(S, 'P1').filter(r => r.unit === '23').length === 1 && await p.evaluate(() => !document.querySelector('.squ-dlg')));
    rec('PC: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
    // ---- phone 360 px: the preview fits
    const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
    await ph.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    await B.upload(ph.page, FILE, 'Aderrig phase 1.xlsx');
    const sc = await X.noScroll(ph.page);
    const btn = await ph.page.evaluate(() => { const b = document.getElementById('squ-ok').getBoundingClientRect(), o = document.querySelector('.squ-dlg .pod-in').getBoundingClientRect(); return { h: b.height, r: b.right, w: o.right }; });
    rec('phone 360 px: preview fits, no sideways scroll, Save button ≥ 44 px', sc.sw <= sc.cw + 1 && btn.h >= 44 && btn.r <= 361, JSON.stringify([sc, btn]));
    rec('phone: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})();
