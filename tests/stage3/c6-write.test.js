// Stage 3 C6: with the switch on, Excel upload, re-upload (diffLines + save_list_revision) and typed lists write to the
// lists tables; the planner record does not grow (acceptance 13). Fake Supabase only. Run: node tests/stage3/c6-write.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const L = F.line;
const xlsx = (p, sheets) => p.evaluate(sheets => { const wb = XLSX.utils.book_new(); Object.keys(sheets).forEach(n => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets[n]), n)); return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }); }, sheets);
const upload = async (p, name, sheets) => {
  const b64 = await xlsx(p, sheets);
  await p.evaluate(() => { showTab('l'); });
  await p.setInputFiles('#lst-file', { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(b64, 'base64') });
  for (let i = 0; i < 40; i++) { await F.sleep(100); const t = await p.evaluate(() => document.getElementById('toast').textContent); if (/imported|Could not/.test(t)) return t; const m = await p.evaluate(() => (document.getElementById('lst-upmsg') || {}).textContent || ''); if (/Could not|No usable/.test(m)) return m; }
  return 'timeout';
};
const HOUSE7 = [['Aderrig', null, null, null, null, null], ['Item', 'Qty', 'Length', 'Width', 'Material', 'Edging'], ['BASE UNITS'],
  ['Side', 2, 720, 560, 'MFC White', '1mm ABS'], ['Side', 2, 720, 560, 'MFC White', '1mm ABS'], ['Top', 1, 1200, 560, 'Oak Mystery', ''], ['Hinge', 8, null, null, 'Blum', 'soft close']];
(async () => {
  const browser = await H.chromium.launch();
  {
    const row = F.v2Row(); row.orders.push(H.order({ wo: 'WO-7', unit: '7', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-9', unit: '9', customer: 'Aderrig Homes', dueDate: '2026-10-23', origDueDate: '2026-10-23' }));
    const S = F.makeServer(row); F.seedList(S, 'L1'); // project P1 'Aderrig' with sheet material 'MFC White'
    const off = await F.dev(browser, S, 'office');
    await off.page.evaluate(async () => { if (saveT) { clearTimeout(saveT); await saveDB(); } });
    const set0 = JSON.stringify(S.row.settings);
    // ---- first upload
    const t = await upload(off.page, 'Aderrig.xlsx', { 'House 7': HOUSE7 });
    const l7 = S.db.t.lists.find(l => l.name === 'House 7');
    const ls7 = l7 ? S.db.t.list_lines.filter(x => x.list_id === l7.id).sort((a, b) => a.seq - b.seq) : [];
    rec('upload: one list in the lists table, in project Aderrig, auto-tagged WO-7 (unit 7)', l7 && l7.project_id === 'P1' && l7.wos.join() === 'WO-7' && l7.source === 'excel' && /1 lists imported/.test(t), t + ' ' + JSON.stringify(l7 && l7.wos));
    rec('upload: header + 4 lines, ids listId:1…, section from the heading, n_saw 3 / n_fit 1', ls7.length === 5 && ls7[0].kind === 'hdr' && ls7[1].id === l7.id + ':2' && ls7[1].section === 'BASE UNITS' && l7.n_saw === 3 && l7.n_fit === 1, JSON.stringify(ls7.map(x => x.kind + ':' + x.part + ':' + x.section)));
    rec('upload: column F is Edging on saw lines; on a fittings line it is the note', ls7[1].edging === '1mm ABS' && !ls7[1].note && ls7[4].note === 'soft close' && !ls7[4].edging);
    rec('upload: a sheet material not on the project list is saved but flagged; listed material is not', ls7[3].material === 'Oak Mystery' && ls7[3].material_other === true && ls7[1].material_other === false && /1 line use a material not on the project list/.test(t), t);
    const scr = await off.page.evaluate(() => { const l = lists().find(x => x.name === 'House 7'); return { rows: listRows(l).length, on: document.body.innerText.includes('House 7') }; });
    rec('upload: shows on the Lists tab straight away', scr.on && scr.rows === 5, JSON.stringify(scr));
    // saw ticks two lines (one of the identical pair), list locks
    D.applyLineChanges(S.db, [{ id: l7.id + ':2', status: 'cut', cid: 'a', rev: 1 }, { id: l7.id + ':4', status: 'cut', cid: 'b', rev: 1 }], 'Sean');
    // ---- corrected workbook re-uploaded: Top 1→2, second Side removed, Shelf added
    const H2 = HOUSE7.filter((r, i) => i !== 4).map(r => r[0] === 'Top' ? ['Top', 2, 1200, 560, 'Oak Mystery', ''] : r).concat([['Shelf', 3, 560, 500, 'MFC White', '']]);
    await off.page.evaluate(async () => { await lsPoll(); });
    const t2 = await upload(off.page, 'Aderrig.xlsx', { 'House 7': H2 });
    const a = D.find(S.db, 'lists', l7.id), ln = id => L(S, l7.id + ':' + id);
    rec('re-upload: same list (same id, tags kept), now rev 2 because the saw had started', S.db.t.lists.filter(l => l.name === 'House 7').length === 1 && a.rev === 2 && a.wos.join() === 'WO-7' && /1 replaced/.test(t2) && /1 new revision/.test(t2), t2 + ' rev ' + a.rev);
    rec('re-upload: the cut Side keeps its tick; the removed twin is marked removed; Top reset as CHANGED; Shelf added', ln(2).status === 'cut' && ln(3).removed_rev === 2 && ln(4).status === 'todo' && ln(4).changed_rev === 2 && S.db.t.list_lines.some(x => x.list_id === l7.id && x.part === 'Shelf' && x.added_rev === 2), JSON.stringify([ln(2).status, ln(3).removed_rev, ln(4).status, ln(4).changed_rev]));
    rec('re-upload: the old version is kept in list_revisions with the reason', S.db.t.list_revisions.some(r => r.list_id === l7.id && r.rev === 1 && /Workbook re-uploaded/.test(r.reason)));
    // ---- stale: another PC changed the list after this screen loaded it → reload and compare again
    D.listAttach(S.db, l7.id, 'WO-9', true, 'Office B'); // version moves on, this screen doesn't know
    const H3 = H2.concat([['Back', 1, 700, 600, 'MFC White', '']]);
    const t3 = await upload(off.page, 'Aderrig.xlsx', { 'House 7': H3 });
    rec('re-upload while another PC changed the list ("stale"): reloaded, compared again, saved; WO-9 kept', /imported/.test(t3) && S.db.t.list_lines.some(x => x.list_id === l7.id && x.part === 'Back') && D.find(S.db, 'lists', l7.id).wos.join() === 'WO-7,WO-9' && L(S, l7.id + ':2').status === 'cut', t3);
    // ---- typed list through the editor
    await off.page.evaluate(() => { openListEditor(null, 'WO-1'); });
    await off.page.evaluate(() => {
      const ov = document.querySelector('.pod-ovl');
      const set = (k, v) => { const e = ov.querySelector('[data-mr="' + k + '"]'); e.value = v; e.oninput(); };
      set('0|item', 'Gable'); set('0|qty', '2'); set('0|L', '900'); set('0|W', '560'); set('0|mat', 'MFC White'); set('0|edging', '2mm PVC'); set('0|note', 'grain up');
      ov.querySelector('#me-name').value = 'House 1 typed';
      ov.querySelector('#me-save').click();
    });
    await F.sleep(600);
    const tl = S.db.t.lists.find(l => l.name === 'House 1 typed'), tln = tl && S.db.t.list_lines.find(x => x.list_id === tl.id);
    const proj = tl && D.find(S.db, 'projects', tl.project_id);
    rec('typed list: saved to the tables (manual, tagged WO-1), editor closed', tl && tl.source === 'manual' && tl.wos.join() === 'WO-1' && !(await off.page.evaluate(() => !!document.querySelector('.pod-ovl'))), JSON.stringify(tl && { s: tl.source, w: tl.wos }));
    rec('typed list: edging and note kept apart; project from the WO customer', tln && tln.edging === '2mm PVC' && tln.note === 'grain up' && proj && proj.name === 'Aderrig Homes', JSON.stringify([tln && tln.edging, tln && tln.note, proj && proj.name]));
    // edit before the saw starts: same rev, same line id
    await off.page.evaluate(async () => { await lsPoll(); const l = lists().find(x => x.name === 'House 1 typed'); openListEditor(l.id); const ov = document.querySelector('.pod-ovl'); const e = ov.querySelector('[data-mr="0|qty"]'); e.value = '3'; e.oninput(); ov.querySelector('#me-save').click(); });
    await F.sleep(600);
    rec('typed list edited before the saw started: rev stays 1, same line id, qty 3', D.find(S.db, 'lists', tl.id).rev === 1 && L(S, tl.id + ':1').qty === '3');
    // edit after a tick: asks why, makes rev 2, the tick on an unchanged line is kept
    await off.page.evaluate(async () => { const l = lists().find(x => x.name === 'House 1 typed'); openListEditor(l.id); const ov = document.querySelector('.pod-ovl'); ov.querySelector('#me-addfit').click(); });
    D.applyLineChanges(S.db, [{ id: tl.id + ':1', status: 'cut', cid: 'c', rev: 1 }], 'Sean');
    await off.page.evaluate(async () => { await lsPoll(); const ov = document.querySelector('.pod-ovl'); const s = (k, v) => { const e = ov.querySelector('[data-mr="' + k + '"]'); e.value = v; e.oninput(); }; s('1|item', 'Handle'); s('1|qty', '4'); ov.querySelector('#me-save').click(); });
    await F.sleep(600);
    rec('typed list edited after a tick: rev 2 with the reason, tick kept, fittings line added', D.find(S.db, 'lists', tl.id).rev === 2 && L(S, tl.id + ':1').status === 'cut' && S.db.t.list_lines.some(x => x.list_id === tl.id && x.part === 'Handle' && x.added_rev === 2) && S.db.t.list_revisions.some(r => r.list_id === tl.id && r.reason === 'Tester'), JSON.stringify(D.find(S.db, 'lists', tl.id).log.map(x => x.what)));
    // a typed list for WO-9 is superseded by the workbook sheet for unit 9 — same id, ticks kept, becomes an Excel list
    await off.page.evaluate(() => { openListEditor(null, 'WO-9'); const ov = document.querySelector('.pod-ovl'); const s = (k, v) => { const e = ov.querySelector('[data-mr="' + k + '"]'); e.value = v; e.oninput(); }; s('0|item', 'Side'); s('0|qty', '2'); s('0|L', '720'); s('0|W', '560'); s('0|mat', 'MFC White'); s('0|edging', '1mm ABS'); ov.querySelector('#me-name').value = 'Typed 9'; ov.querySelector('#me-proj').value = 'Aderrig'; ov.querySelector('#me-save').click(); });
    await F.sleep(600);
    const m9 = S.db.t.lists.find(l => l.name === 'Typed 9');
    D.applyLineChanges(S.db, [{ id: m9.id + ':1', status: 'cut', cid: 'd', rev: 1 }], 'Sean');
    await off.page.evaluate(async () => { await lsPoll(); });
    const t9 = await upload(off.page, 'Aderrig.xlsx', { 'House 9': [['Aderrig'], ['Side', 2, 720, 560, 'MFC White', '1mm ABS'], ['Top', 1, 1200, 560, 'MFC White', '']] });
    const m9b = D.find(S.db, 'lists', m9.id);
    rec('typed list superseded by its workbook: same id, renamed, Excel source, tick kept, one list for WO-9', m9b.name === 'House 9' && m9b.source === 'excel' && L(S, m9.id + ':1').status === 'cut' && S.db.t.lists.filter(l => !l.archived && l.wos.includes('WO-9') && l.id !== l7.id).length === 1, t9 + ' ' + JSON.stringify({ n: m9b.name, s: m9b.source }));
    // ---- acceptance 13: the planner record does not grow
    await off.page.evaluate(async () => { if (saveT) { clearTimeout(saveT); } await saveDB(); });
    const set1 = JSON.stringify(S.row.settings);
    rec('A13: planner record settings unchanged after uploads, re-uploads and typed lists (lists frozen)', set1 === set0, set0.length + ' → ' + set1.length);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await off.close();
  }
  // ---- save fails (database down): editor stays open, message, retry does not make a second P-number
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office');
    S.fail3 = true;
    await off.page.evaluate(() => { openListEditor(null, ''); const ov = document.querySelector('.pod-ovl'); ov.querySelector('#me-new').click(); });
    await off.page.evaluate(() => { const ov = document.querySelector('.pod-ovl'); const s = (k, v) => { const e = ov.querySelector('[data-mr="' + k + '"]'); e.value = v; e.oninput(); }; s('0|item', 'A'); s('0|qty', '1'); s('0|L', '100'); s('0|mat', 'MFC White');
      ov.querySelector('#me-name').value = 'New job'; ov.querySelector('#me-proj').value = 'Aderrig'; ov.querySelector('#me-ptitle').value = 'Snag job'; ov.querySelector('#me-pdue').value = '2026-10-30'; ov.querySelector('#me-save').click(); });
    await F.sleep(500);
    const e1 = await off.page.evaluate(() => ({ open: !!document.querySelector('.pod-ovl'), err: (document.getElementById('me-err') || {}).textContent, p: DB.orders.filter(o => /^P-/.test(o.wo)).map(o => o.wo) }));
    S.fail3 = false;
    await off.page.evaluate(() => { document.querySelector('#me-save').click(); });
    await F.sleep(600);
    const e2 = await off.page.evaluate(() => ({ open: !!document.querySelector('.pod-ovl'), p: DB.orders.filter(o => /^P-/.test(o.wo)).map(o => o.wo) }));
    const nl = S.db.t.lists.find(l => l.name === 'New job');
    rec('database down: editor stays open with "Not saved"', e1.open && /Not saved/.test(e1.err) && e1.p.length === 1, JSON.stringify(e1));
    rec('retry saves it, tagged to the SAME P-number (no second one made)', !e2.open && e2.p.length === 1 && nl && nl.wos.join() === e1.p[0], JSON.stringify([e2, nl && nl.wos]));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await off.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
