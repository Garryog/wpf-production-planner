// Tester attack ROUND 4 (13 Nov) on bug fix M2 — a renamed material is found by its old name, shown and saved under its
// current name, no bulk rewrite. Attacks: A → B → C then a NEW material "A"; rename while the saw has ticked lines cut (ticks
// stay, nothing "CHANGED" for the saw, no new Rev from the rename alone); a list opened and closed / saved with no change writes
// nothing and does not ask; case / spaces-only rename; two PCs on one list after a rename (one PC still has the old
// materials in memory); carcass / door default boxes and new rows copying the default; Excel import with the old name.
// Fake Supabase only. Run: node tests/list-window/attack4-rename.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err } = L;
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const mmsg = p => p.evaluate(() => (document.getElementById('mt-msg') || {}).textContent || '');
const mat = (S, id) => S.db.t.project_materials.find(m => m.id === id);
const matBox = p => p.evaluate(() => [...document.querySelectorAll('.me-ed [data-row]')].map(tr => { const s = tr.querySelector('[data-mr$="|mat"]'); return s ? { v: s.value, txt: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : '' } : null; }));
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision').length;
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__asked = []; });
const rename = async (p, id, name) => { await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400); await type(p, '[data-mtn="' + id + '"]', name); await press(p, '[data-mts="' + id + '"]'); await sleep(1200); const m = await mmsg(p); await L.closeAll(p); return m; };
// lines carry their heading's section and Tap (not a project material) is already flagged — as the editor itself saves them
const LINES = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass', status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' }],
  ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }], ['fit', 'Tap', '1', null, null, 'Chrome mixer', '', '', { section: 'Carcass', material_other: true }]];

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row(), { lines: LINES });
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L1'), { locked: true, rev: 1 }); // with the saw
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await reload(p);

    // ---- R1. A → B → C, then a NEW material "A" ----
    rec('R1 set-up: MFC White → Board B', (await rename(p, 'M1', 'Board B')) === '' && mat(S, 'M1').name === 'Board B');
    await reload(p);
    rec('R1 set-up: Board B → Board C', (await rename(p, 'M1', 'Board C')) === '' && mat(S, 'M1').name === 'Board C', JSON.stringify(mat(S, 'M1').aliases));
    rec('R1: C keeps BOTH old names (MFC White and Board B)', ['MFC White', 'Board B'].every(n => (mat(S, 'M1').aliases || []).includes(n)), JSON.stringify(mat(S, 'M1').aliases));
    await reload(p); await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400);
    const n0 = S.db.t.project_materials.length;
    await type(p, '#mt-new-n', 'MFC White'); await press(p, '#mt-add'); await sleep(1200);
    rec('R1: a NEW material named "MFC White" (an old name of C) is refused', S.db.t.project_materials.length === n0 && /already used/.test(await mmsg(p)), await mmsg(p));
    await closeAll(p);
    // the list: old-name rows show C; no rewrite of stored lines
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    const b1 = await matBox(p), r1 = await rows(p), side = r1.findIndex(r => r.item === 'Side');
    rec('R1: list row stored as "MFC White" shows "Board C"', b1[side] && b1[side].v === 'Board C' && !/⚠/.test(b1[side].txt), JSON.stringify(b1[side]));
    rec('R1: stored lines untouched by opening', linesOf(S, 'L1').filter(x => x.kind === 'saw').every(x => x.material === 'MFC White'));

    // ---- R2. opened + closed with no change: no question; Save with no change: nothing written ----
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(300);
    const q2 = await p.evaluate(() => window.__asked.join('|'));
    rec('R2: Esc on a list I did not touch does NOT ask "Close without saving?" (the renamed material is not my change)', q2 === '' && !(await p.evaluate(() => !!document.querySelector('.me-ed'))), q2);
    await closeAll(p);
    const s0 = saves(S), v0 = D.find(S.db, 'lists', 'L1').version;
    await p.evaluate(() => { window.__confirm = true; openListEditor('L1'); }); await sleep(900);
    await save(p, 2000);
    rec('R2: Save with NO change writes nothing (no new revision, list version unchanged)', saves(S) === s0 && D.find(S.db, 'lists', 'L1').version === v0, JSON.stringify([saves(S) - s0, D.find(S.db, 'lists', 'L1').version, v0, await err(p)]));
    await closeAll(p);

    // ---- R3. saw ticked + rename, then a real change elsewhere: tick stays, Side is not CHANGED for the saw ----
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    const r3 = await rows(p), hi = r3.findIndex(r => r.item === 'Hinge');
    await setv(p, hi + '|qty', '10'); await sleep(200);
    await save(p, 2000);
    const l3 = D.find(S.db, 'lists', 'L1'), sl = linesOf(S, 'L1').find(x => x.part === 'Side');
    rec('R3 set-up: the list saved (Hinge 10)', linesOf(S, 'L1').find(x => x.part === 'Hinge').qty === '10', await err(p));
    rec('R3: Side keeps its cut tick', sl.status === 'cut' && sl.status_by === 'Saw', JSON.stringify(sl));
    rec('R3: Side is not marked CHANGED for the saw on the new Rev', +sl.changed_rev !== +l3.rev, JSON.stringify([sl.changed_rev, l3.rev]));
    const info = await p.evaluate(async () => { lsReset(); await lsLoad(); await lsReloadList('L1'); return lsRevInfo('L1', 'saw'); });
    rec('R3: the saw\'s "Rev N replaces Rev N-1" banner counts 0 changed saw parts', info.changed === 0, JSON.stringify(info));
    await closeAll(p);

    // ---- R4. rename by case / spaces only ----
    await reload(p);
    const al4 = JSON.stringify(mat(S, 'M1').aliases);
    rec('R4 set-up: "Board C" → "board  c " saved', (await rename(p, 'M1', 'board  c ')) === '' && mat(S, 'M1').name === 'board  c', JSON.stringify(mat(S, 'M1')));
    rec('R4: a case / spaces-only rename adds no "other spelling"', JSON.stringify(mat(S, 'M1').aliases) === al4, JSON.stringify(mat(S, 'M1').aliases));
    await reload(p);
    const s4 = saves(S);
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    await save(p, 2000);
    rec('R4: list Save with no change after a case-only rename writes nothing', saves(S) === s4, await err(p));
    await closeAll(p);
    await reload(p); await rename(p, 'M1', 'Board C');

    // ---- R5. defaults (carcass box) and a new row copying the default ----
    await reload(p);
    await p.evaluate(() => { window.__confirm = true; openListEditor(null, 'WO-3'); }); await sleep(1000);
    const hasCarc = await p.evaluate(() => !!document.getElementById('me-carc'));
    if (hasCarc) {
      // an old name arriving as a default (e.g. from a sheet's meta / older template): set the box's state the way the importer does
      const c5 = await p.evaluate(() => { const s = document.getElementById('me-carc'); const o = [...s.options].map(x => x.value); return { o, v: s.value }; });
      rec('R5: carcass default box offers the current name only ("Board C"), not old names', c5.o.includes('Board C') && !c5.o.includes('MFC White'), JSON.stringify(c5));
    } else rec('(info) R5: no carcass default box on a new list from a job (skipped)', true);
    await closeAll(p);

    // ---- R6. Excel import / paste with the OLD name ----
    await p.evaluate(() => { window.__confirm = true; openListEditor(null, 'WO-3'); }); await sleep(1000);
    const XLSX = require(require('path').join(__dirname, '..', '..', 'xlsx.full.min.js'));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging'], ['Gable', 2, 720, 560, 'mfc white', ''], ['Base', 1, 600, 560, 'Board B', '']]), 'Sheet1');
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const imp = await p.evaluate(async b64 => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const f = new File([u8], 'old.xlsx'); const inp = document.querySelector('.me-ed input[type=file]'); if (!inp) return 'no file input';
      const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; }, b64);
    await sleep(1500);
    // a materials-matching window may appear for unknown names — the old names must NOT need matching
    const mm = await p.evaluate(() => !!document.getElementById('mm-ok'));
    if (imp === 'ok') {
      rec('R6: Excel with the material\'s OLD names asks nothing about matching materials', !mm);
      const b6 = await matBox(p), r6 = await rows(p);
      const g = r6.findIndex(r => r.item === 'Gable'), bs = r6.findIndex(r => r.item === 'Base');
      rec('R6: imported old-name rows show "Board C" with no warning', g >= 0 && bs >= 0 && b6[g].v === 'Board C' && b6[bs].v === 'Board C' && !/⚠/.test(b6[g].txt + b6[bs].txt), JSON.stringify([r6.map(r => r.item), b6]));
      if (!mm && g >= 0) { await save(p, 2200); const nl = S.db.t.lists.filter(l => (l.wos || []).includes('WO-3') && !l.archived && !l.is_template).pop();
        const ls6 = nl ? linesOf(S, nl.id) : [];
        rec('R6: saved under the current name, not flagged for the PM', ls6.length && ls6.filter(x => x.kind === 'saw').every(x => x.material === 'Board C' && !x.material_other), JSON.stringify(ls6.map(x => [x.part, x.material, x.material_other]))); }
    } else rec('(info) R6: could not find the Excel file input in the list window — skipped (' + imp + ')', true);
    await closeAll(p);

    // ---- R7. two PCs on one list after a rename; PC1 still has the OLD materials in memory ----
    // fresh fixture so ticks / revs are simple
    const S2 = X.makeServer(X.v2Row(), { lines: LINES });
    D.update(S2.db, 'lists', D.find(S2.db, 'lists', 'L1'), { locked: true, rev: 1 });
    const a = await X.dev(browser, S2, 'design'), pa = a.page; await asks(pa);
    const b = await X.dev(browser, S2, 'design'), pb = b.page; await asks(pb);
    await pa.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__confirm = true; openListEditor('L1'); }); await sleep(900);
    // PC B renames MFC White → 18mm MFC White and saves the list with Side qty 3 (Side's tick resets — a real change)
    await pb.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    await rename(pb, 'M1', '18mm MFC White');
    await pb.evaluate(async () => { lsReset(); await lsLoad(); window.__confirm = true; openListEditor('L1'); }); await sleep(900);
    let rb = await rows(pb); await setv(pb, rb.findIndex(r => r.item === 'Top') + '|qty', '3'); await sleep(200); await save(pb, 2000); await closeAll(pb);
    rec('R7 set-up: PC B saved Top ×3 under the new name', (() => { const x = linesOf(S2, 'L1').find(y => y.part === 'Top'); return x && x.qty === '3' && x.material === '18mm MFC White'; })());
    // PC A (window opened before the rename, materials in memory still old) changes the Hinge qty and saves
    let ra = await rows(pa); await setv(pa, ra.findIndex(r => r.item === 'Hinge') + '|qty', '12'); await sleep(200);
    await pa.evaluate(() => { window.__asked = []; window.__confirm = true; }); await save(pa, 2500);
    const qa = await pa.evaluate(() => window.__asked.join('\n---\n'));
    const top = linesOf(S2, 'L1').find(y => y.part === 'Top'), sd = linesOf(S2, 'L1').find(y => y.part === 'Side');
    rec('R7: PC A\'s Hinge change is saved', linesOf(S2, 'L1').find(y => y.part === 'Hinge').qty === '12', await err(pa));
    rec('R7: PC B\'s Top ×3 is kept (not put back to 1 by PC A)', top && top.qty === '3', JSON.stringify(top));
    rec('[MEDIUM] R7: PC A is not asked to overwrite anything (it only changed Hinge)', !/replaces it|overwrite|other screen/i.test(qa), qa);
    rec('R7: Side keeps its cut tick on both saves', sd && sd.status === 'cut', JSON.stringify(sd));
    await a.close(); await b.close();

    // ---- R8. a cut part's NOTE changed on PC A after PC B renamed + saved the list. A note-only change keeps the tick.
    //          Run twice: PC A's materials refreshed (the 10-60 s poll has run) and PC A's materials still old (poll not yet run). ----
    for (const stale of [false, true]) {
      const S3 = X.makeServer(X.v2Row(), { lines: LINES });
      D.update(S3.db, 'lists', D.find(S3.db, 'lists', 'L1'), { locked: true, rev: 1 });
      const c = await X.dev(browser, S3, 'design'), pc = c.page; await asks(pc);
      const d = await X.dev(browser, S3, 'design'), pd = d.page; await asks(pd);
      await pc.evaluate(async () => { clearInterval(LST.timer); lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__confirm = true; openListEditor('L1'); }); await sleep(900);
      await pd.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
      await rename(pd, 'M1', '18mm MFC White');
      await pd.evaluate(async () => { lsReset(); await lsLoad(); window.__confirm = true; openListEditor('L1'); }); await sleep(900);
      const rd = await rows(pd); await setv(pd, rd.findIndex(r => r.item === 'Top') + '|qty', '3'); await sleep(200); await save(pd, 2000); await closeAll(pd);
      if (!stale) await pc.evaluate(async () => { await lsPoll(); });
      const hasNote = await pc.evaluate(() => !!document.querySelector('.me-ed [data-mr$="|note"]'));
      const rc = await rows(pc), si = rc.findIndex(r => r.item === 'Side');
      if (hasNote) await setv(pc, si + '|note', 'drill 5mm'); else await pc.evaluate(i => { const e = document.querySelector('.me-ed [data-mr="' + i + '|edging"]'); return e; }, si);
      await sleep(200);
      await pc.evaluate(() => { window.__asked = []; window.__confirm = true; }); await save(pc, 2500);
      const q8 = await pc.evaluate(() => window.__asked.join('\n---\n')), s8 = linesOf(S3, 'L1').find(y => y.part === 'Side'), t8 = linesOf(S3, 'L1').find(y => y.part === 'Top');
      const tag = stale ? '[LOW] R8 (PC A\'s materials not yet refreshed)' : 'R8 (PC A\'s materials refreshed)';
      rec(tag + ' set-up: the note was saved', hasNote && s8 && s8.note === 'drill 5mm', JSON.stringify([hasNote, s8 && s8.note, await err(pc)]));
      rec(tag + ': a note-only change keeps Side\'s cut tick', s8 && s8.status === 'cut', JSON.stringify(s8 && [s8.status, s8.material, s8.changed_rev]));
      rec(tag + ': PC B\'s Top ×3 is kept', t8 && t8.qty === '3', JSON.stringify(t8 && [t8.qty, t8.material]));
      rec(tag + ': PC A is not asked to overwrite Side or Top', !/Side|Top/.test(q8), q8);
      if (S3.errors && S3.errors.length) rec('no page errors (R8)', false, JSON.stringify(S3.errors));
      await c.close(); await d.close();
    }
    rec('no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
