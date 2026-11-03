// ATTACK: revisions — identical re-upload, two offices at once, typed-list lost update, removed-line ticks, diffLines edge
// cases. Fake Supabase only. Run: node tests/stage3/attack-revision.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const L = F.line;
const xlsx = (p, sheets) => p.evaluate(sheets => { const wb = XLSX.utils.book_new(); Object.keys(sheets).forEach(n => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheets[n]), n)); return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }); }, sheets);
const upload = async (p, name, sheets) => {
  const b64 = await xlsx(p, sheets);
  await p.evaluate(() => { showTab('l'); document.getElementById('toast').textContent = ''; });
  await p.setInputFiles('#lst-file', { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(b64, 'base64') });
  for (let i = 0; i < 60; i++) { await F.sleep(100); await p.evaluate(() => { const b = document.getElementById('ip-ok'); if (b) b.click(); }); /* editor step 2: the import preview comes first */ const t = await p.evaluate(() => document.getElementById('toast').textContent); if (/imported|Could not/.test(t)) return t; const m = await p.evaluate(() => (document.getElementById('lst-upmsg') || {}).textContent || ''); if (/Could not|No usable/.test(m)) return m; }
  return 'timeout';
};
const H7 = [['Aderrig', null, null, null, null, null], ['Item', 'Qty', 'Length', 'Width', 'Material', 'Edging'],
  ['Side', 2, 720, 560, 'MFC White', '1mm ABS'], ['Top', 1, 1200, 560, 'MFC White', ''], ['Back', 1, 700, 600, 'MFC White', '']];
(async () => {
  const browser = await H.chromium.launch();
  {
    const row = F.v2Row(); row.orders.push(H.order({ wo: 'WO-7', unit: '7', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
    const S = F.makeServer(row); F.seedList(S, 'L1');
    const off = await F.dev(browser, S, 'office'), off2 = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw');
    await upload(off.page, 'Aderrig.xlsx', { 'House 7': H7 });
    const l7 = S.db.t.lists.find(l => l.name === 'House 7');
    D.applyLineChanges(S.db, [{ id: l7.id + ':1', status: 'cut', cid: 'c1', rev: 1 }], 'Sean'); // saw starts → locked
    // R1: the SAME workbook uploaded again (very common) → nothing changed, so no new revision for the saw
    await off.page.evaluate(async () => { await lsPoll(); });
    const t1 = await upload(off.page, 'Aderrig.xlsx', { 'House 7': H7 });
    const r1 = D.find(S.db, 'lists', l7.id);
    rec('R1 identical re-upload of a locked list does NOT make a new revision', r1.rev === 1, 'rev now ' + r1.rev + ', revisions stored=' + S.db.t.list_revisions.length + ', toast: ' + t1);
    // R2: two offices re-upload the same corrected workbook at the same moment
    const H7b = H7.map(r => r.slice()); H7b[3][1] = 2; // Top qty 1 → 2
    await off.page.evaluate(async () => { await lsPoll(); }); await off2.page.evaluate(async () => { await lsPoll(); });
    const rev0 = D.find(S.db, 'lists', l7.id).rev;
    const [ta, tb] = await Promise.all([upload(off.page, 'Aderrig.xlsx', { 'House 7': H7b }), upload(off2.page, 'Aderrig.xlsx', { 'House 7': H7b })]);
    const r2 = D.find(S.db, 'lists', l7.id), lines2 = S.db.t.list_lines.filter(x => x.list_id === l7.id);
    rec('R2 two offices upload the same corrected workbook at once: one new revision, no duplicate lines', r2.rev === rev0 + 1 && lines2.filter(x => x.removed_rev == null).length === 3, 'rev ' + rev0 + '→' + r2.rev + ' live lines=' + lines2.filter(x => x.removed_rev == null).length + ' | ' + ta + ' | ' + tb);
    rec('R2 the cut Side keeps its tick through both saves', L(S, l7.id + ':1').status === 'cut', L(S, l7.id + ':1').status);
    // R3: tick a line removed by a newer revision (saw screen still on the old rev) → refused, saw told
    await saw.page.evaluate(async () => { await lsPoll(); render(); });
    const H7c = H7b.filter(r => r[0] !== 'Back');
    await off.page.evaluate(async () => { await lsPoll(); });
    await upload(off.page, 'Aderrig.xlsx', { 'House 7': H7c });
    const back = S.db.t.list_lines.find(x => x.list_id === l7.id && x.part === 'Back');
    const tap = await F.tapRow(saw.page, 'data-rt', back.id); await F.send(saw.page);
    const m3 = await saw.page.evaluate(() => LQ.msgs.join(' | '));
    rec('R3 tick on a line removed in a newer revision is refused and the saw is told', back.status === 'todo' && /taken off the list/.test(m3), 'tap=' + tap + ' status=' + back.status + ' msg=' + m3);
    await off.close(); await off2.close(); await saw.close();
  }
  // R4: two offices edit the same TYPED list. B adds a line and saves; A (editor opened earlier) then saves its edit.
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    const rowsA = await a.page.evaluate(() => lsEditRows('L1')); // A opens the editor
    await b.page.evaluate(async () => { const rows = lsEditRows('L1'); rows.push({ k: 'saw', item: 'Plinth', qty: 2, L: 2400, W: 150, mat: 'MFC White', edging: '', note: '' }); await lsSaveManual({ wo: 'WO-1', name: 'House L1', project: 'Aderrig', rows }, 'Bea', lsList('L1')); });
    await a.page.evaluate(async () => { await lsPoll(); }); // A's Lists tab polls every 10 s while she types
    const res = await a.page.evaluate(async rows => { rows[2].qty = 5; try { await lsSaveManual({ wo: 'WO-1', name: 'House L1', project: 'Aderrig', rows }, 'Ann', lsList('L1')); return 'saved'; } catch (e) { return 'refused: ' + e.message; } }, rowsA);
    const pl = S.db.t.list_lines.find(x => x.list_id === 'L1' && x.part === 'Plinth');
    rec('R4 typed list: A\'s save from an editor opened BEFORE B\'s save must not silently remove B\'s new line', /refused|stale/.test(res) || (pl && pl.removed_rev == null), 'A: ' + res + ' | Plinth removed_rev=' + (pl && pl.removed_rev) + ' (p_expect is the version at SAVE time, not when the editor opened)');
    await a.close(); await b.close();
  }
  // R5: diffLines edge cases (pure)
  {
    const S = F.makeServer(F.v2Row()); const pt = await F.dev(browser, S, 'office'); const p = pt.page;
    const r = await p.evaluate(() => {
      const o = (id, part, st, extra) => Object.assign({ id, seq: +id.split(':')[1], kind: 'saw', part, length_mm: 720, width_mm: 560, qty: '2', material: 'MFC White', edging: '1mm', note: null, section: 'BASE', status: st }, extra || {});
      const n = (part, extra) => Object.assign({ kind: 'saw', part, length_mm: 720, width_mm: 560, qty: '2', material: 'MFC White', edging: '1mm', note: '', section: 'BASE' }, extra || {});
      const out = {};
      // twins, the 2nd one cut; new file has ONE twin with qty changed → which keeps/reset?
      let d = diffLines([o('X:1', 'Side', 'todo'), o('X:2', 'Side', 'cut')], [n('Side', { qty: '3' })], { listId: 'X' });
      out.twinChange = { changed: d.changed, removed: d.removed, keepAside: d.keepAside };
      // a cut line whose section heading was renamed only → should keep tick (same content)
      d = diffLines([o('X:1', 'Side', 'cut')], [n('Side', { section: 'BASE UNITS' })], { listId: 'X' });
      out.sectionRename = { changed: d.changed, added: d.added, same: d.lines[0].id };
      // material spelt with different spacing/case → same line
      d = diffLines([o('X:1', 'Side', 'cut')], [n('Side', { material: ' mfc  white ' })], { listId: 'X' });
      out.matSpace = d.changed.length + d.added.length;
      // L as "720mm" text vs 720
      d = diffLines([o('X:1', 'Side', 'cut')], [n('Side', { length_mm: '720mm' })], { listId: 'X' });
      out.mmText = { lines0: d.lines[0].length_mm, changed: d.changed };
      // removed line ids re-used? old has X:1..X:3 with X:3 removed; new adds one → id must not be X:3
      d = diffLines([o('X:1', 'A', 'todo'), o('X:2', 'B', 'todo'), o('X:3', 'C', 'cut', { removed_rev: 2 })], [n('A'), n('B'), n('D')], { listId: 'X' });
      out.newId = d.added;
      return out;
    });
    rec('R5a twins (one cut) and the new file changes one qty: the CUT twin should not be the one silently reset while the untouched twin vanishes', !(r.twinChange.changed.includes('X:2') && r.twinChange.removed.includes('X:1')), JSON.stringify(r.twinChange));
    rec('R5b section heading renamed only: tick kept, nothing reported changed/added', r.sectionRename.changed.length === 0 && r.sectionRename.added.length === 0 && r.sectionRename.same === 'X:1', JSON.stringify(r.sectionRename));
    rec('R5c material case/spacing only: not a change', r.matSpace === 0, r.matSpace);
    rec('R5d length typed as "720mm" is not saved as blank', r.mmText.lines0 !== null, JSON.stringify(r.mmText));
    rec('R5e a new line never re-uses the id of a removed line', !r.newId.includes('X:3'), JSON.stringify(r.newId));
    await pt.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
