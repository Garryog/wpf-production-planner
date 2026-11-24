// FINAL-2 Tester round (15 Nov) — attack on 1df02bb / 3553aee / e616c65: "a renamed material shows as ONE board under its
// current name everywhere". What did the read-time re-labelling BREAK? Renamed twice; renamed back; renamed and the OLD name
// given to a NEW board; the other spelling taken away; two projects with one spelling; a Stores row whose text is a board's
// name; a fitting and a board with the same name; a screen that never reloaded (cache); the saw PC by poll; the editor on a
// list never re-saved; ticks; "already cut on old list"; lists switched OFF.
// Fake Supabase only. Run: node tests/list-window/final2-rename.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err } = L;
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const mmsg = p => p.evaluate(() => (document.getElementById('mt-msg') || {}).textContent || '');
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); render(); });
// rename WITHOUT reloading the page's data afterwards (what a person does)
const rename = async (p, pid, id, name, al) => { await p.evaluate(pid => lsMaterialsDlg(pid), pid); await sleep(400); await type(p, '[data-mtn="' + id + '"]', name); if (al !== undefined) await type(p, '[data-mta="' + id + '"]', al); await press(p, '[data-mts="' + id + '"]'); await sleep(1200); const m = await mmsg(p); await closeAll(p); return m; };
const addMat = async (p, pid, name, kind) => { await p.evaluate(pid => lsMaterialsDlg(pid), pid); await sleep(400); await type(p, '#mt-new-n', name); await p.evaluate(k => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('#mt-new-k').value = k; }, kind || 'sheet'); await press(p, '#mt-add'); await sleep(1200); const m = await mmsg(p); await closeAll(p); return m; };
const need = pg => pg.evaluate(() => { const r = sheetNeed(workLists(), '', '2099-12-31', {}); return { mats: r.mats.map(m => m.mat || m.name || m), sheets: r.sheets, lines: r.lines, raw: r.mats }; });
const shown = (pg, id, kind) => pg.evaluate(({ id, kind }) => [...new Set(listRows(lsList(id)).filter(r => kind === 'fit' ? (r.k === 'fit' || r.k === 'buy') : r.k === 'saw').map(r => r.mat))], { id, kind });
const mat = (S, id) => D.find(S.db, 'project_materials', id);
const LINES = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass' }],
  ['saw', 'Top', '1', 1200, 560, 'MFC White', '', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }]];
const mkS = () => { const row = X.v2Row(); row.orders.push(X.H.order({ wo: 'WO-9', customer: 'Aderrig Homes', floor: 'GF', unit: '19', title: 'HOUSE 9', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
  const S = X.makeServer(row, { lines: LINES }); X.F3.seedList(S, 'L2', { wos: ['WO-2'], name: 'House 2', lines: LINES }); X.F3.seedList(S, 'L3', { wos: ['WO-9'], name: 'House 9', lines: LINES });
  ['L1', 'L2', 'L3'].forEach(id => D.update(S.db, 'lists', D.find(S.db, 'lists', id), { locked: true, rev: 1 })); return S; };
const resave = async (p, id, note) => { await p.evaluate(id => openListEditor(id), id); await sleep(900); const r = await rows(p), i = r.findIndex(x => x.item === 'Top'); await setv(p, i + '|note', note); await sleep(150); await save(p, 2200); const e = await err(p); await closeAll(p); return e; };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    // ================= A. renamed TWICE, no reload in between; the saw PC only polls =================
    { const S = mkS(); const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p); await reload(p);
      const sw = await X.dev(browser, S, 'saw'), ps = sw.page; await reload(ps);
      const n0 = await need(ps);
      rec('A0 set-up: ONE board, 6 saw lines, before any rename', n0.mats.length === 1 && n0.lines === 6, JSON.stringify(n0.raw));
      rec('A0 rename 1: MFC White → 18mm MFC White', (await rename(p, 'P1', 'M1', '18mm MFC White')) === '' && mat(S, 'M1').name === '18mm MFC White', JSON.stringify(mat(S, 'M1')));
      // NO reload on the PC that did it
      const a1 = await need(p);
      rec('[HIGH] A1 the PC that renamed, WITHOUT reloading: "Sheets needed" is one board under the new name straight away (no stale copy)', a1.mats.length === 1 && /18mm MFC White/.test(JSON.stringify(a1.raw)), JSON.stringify(a1.raw));
      rec('[HIGH] A1b … and its on-screen rows of House 1 show "18mm MFC White"', JSON.stringify(await shown(p, 'L1')) === '["18mm MFC White"]', JSON.stringify(await shown(p, 'L1')));
      rec('A2 House 2 re-saved after rename 1 (stored under "18mm MFC White")', (await resave(p, 'L2', 'scribe')) === '' && linesOf(S, 'L2').filter(x => x.kind === 'saw').every(x => x.material === '18mm MFC White'), JSON.stringify(linesOf(S, 'L2').map(x => x.material)));
      rec('A2 rename 2: 18mm MFC White → 18mm Egger W980', (await rename(p, 'P1', 'M1', '18mm Egger W980')) === '' && mat(S, 'M1').name === '18mm Egger W980', JSON.stringify(mat(S, 'M1')));
      rec('A2b both old names are remembered on the material', ['mfc white', '18mm mfc white'].every(a => (mat(S, 'M1').aliases || []).map(x => String(x).toLowerCase()).includes(a)), JSON.stringify(mat(S, 'M1').aliases));
      rec('A3 House 9 re-saved after rename 2', (await resave(p, 'L3', 'x')) === '' && linesOf(S, 'L3').filter(x => x.kind === 'saw').every(x => x.material === '18mm Egger W980'), JSON.stringify(linesOf(S, 'L3').map(x => x.material)));
      const a4 = await need(p);
      rec('[HIGH] A4 renamed twice, three lists stored under THREE different names → still ONE board, same sheets as before', a4.mats.length === 1 && a4.sheets === n0.sheets && a4.lines === 6, JSON.stringify({ before: n0.sheets, now: a4.sheets, mats: a4.raw }));
      // the saw PC never reloaded: it only polls
      await ps.evaluate(async () => { await lsPoll(); }); await sleep(600);
      const a5 = await need(ps), a5s = [await shown(ps, 'L1'), await shown(ps, 'L2'), await shown(ps, 'L3')];
      rec('[HIGH] A5 the SAW PC (poll only, never reloaded): one board, named "18mm Egger W980", on all three houses', a5.mats.length === 1 && a5s.every(x => JSON.stringify(x) === '["18mm Egger W980"]'), JSON.stringify({ mats: a5.raw, rows: a5s }));
      const comb = await ps.evaluate(() => combineLists(workLists().filter(l => ['L1', 'L2', 'L3'].includes(l.id)), 'saw').filter(g => g.item === 'Side').map(g => ({ mat: g.mat, qty: g.qty })));
      rec('[HIGH] A6 combined cutting table on the saw PC: "Side" for 3 houses is ONE row of 6', comb.length === 1 && comb[0].qty === 6, JSON.stringify(comb));
      // View window + print of ONE list never re-saved
      const view = await ps.evaluate(() => { lsViewDlg('L1'); const o = [...document.querySelectorAll('.pod-ovl')].pop(); const t = o ? o.innerText : ''; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); return t; });
      rec('[MEDIUM] A7 View window of House 1 (never re-saved): shows "18mm Egger W980", not the old name', /18mm Egger W980/.test(view) && !/(^|[^m] )MFC White/.test(view.replace(/18mm MFC White/g, '')), view.replace(/\s+/g, ' ').slice(0, 200));
      // the stored lines of House 1 are untouched (read-time only)
      rec('A8 nothing stored was rewritten: House 1 still stores "MFC White"', linesOf(S, 'L1').filter(x => x.kind === 'saw').every(x => x.material === 'MFC White'));

      // ---- ticks: a line ticked cut under the OLD name; the list saved with a real change on ANOTHER row ----
      D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'L1:2'), { status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' });
      await reload(p);
      await p.evaluate(() => { window.__prompt = 'hinge count'; openListEditor('L1'); }); await sleep(900);
      const r = await rows(p), hi = r.findIndex(x => x.item === 'Hinge');
      rec('A9 the editor on House 1 shows the board under the current name in its Material box', r.filter(x => x.item === 'Side' || x.item === 'Top').every(x => x.mat === '18mm Egger W980'), JSON.stringify(r.map(x => [x.item, x.mat])));
      await setv(p, hi + '|qty', '9'); await sleep(150); await save(p, 2400);
      const l1 = linesOf(S, 'L1');
      rec('[HIGH] A10 a real change (Hinge 8 → 9) on a list never re-saved since TWO renames IS saved', (l1.find(x => x.part === 'Hinge') || {}).qty === '9', JSON.stringify([await err(p), l1.map(x => [x.part, x.qty, x.material, x.status])]));
      rec('[HIGH] A11 … and the "Side" tick made under the old name is NOT reset by that save', (l1.find(x => x.part === 'Side') || {}).status === 'cut', JSON.stringify(l1.map(x => [x.part, x.status])));
      rec('A12 … and its saw rows are now stored under the current name', l1.filter(x => x.kind === 'saw').every(x => x.material === '18mm Egger W980'), JSON.stringify(l1.map(x => x.material)));
      await closeAll(p);
      rec('A: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); await sw.close(); }

    // ================= B. renamed BACK; and the old name given to a NEW board =================
    { const S = mkS(); const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p); await reload(p);
      const n0 = await need(p);
      await rename(p, 'P1', 'M1', '18mm MFC White'); await resave(p, 'L2', 'scribe');
      const back = await rename(p, 'P1', 'M1', 'MFC White');
      rec('B1 renamed back to "MFC White": accepted', back === '' && mat(S, 'M1').name === 'MFC White', JSON.stringify([back, mat(S, 'M1')]));
      const b1 = await need(p);
      rec('[HIGH] B2 renamed and renamed BACK (one list saved in between): ONE board called "MFC White"', b1.mats.length === 1 && b1.sheets === n0.sheets && JSON.stringify(await shown(p, 'L2')) === '["MFC White"]', JSON.stringify({ mats: b1.raw, l2: await shown(p, 'L2') }));
      // now: rename away again, then try to make a NEW board with the old name
      await rename(p, 'P1', 'M1', '18mm MFC White');
      const add = await addMat(p, 'P1', 'MFC White', 'sheet');
      const dupe = S.db.t.project_materials.filter(m => m.project_id === 'P1' && String(m.name).toLowerCase() === 'mfc white');
      rec('[HIGH] B3 a NEW board called "MFC White" while that is still the old name of "18mm MFC White": refused with a reason (else every old list would silently become the NEW board)', dupe.length === 0 && /\S/.test(add), JSON.stringify({ msg: add, made: dupe.map(m => m.id) }));
      // the person takes the old spelling off "Also called", THEN adds the new board (the only way through the window)
      const al = await rename(p, 'P1', 'M1', '18mm MFC White', '');
      const gone = !(mat(S, 'M1').aliases || []).some(a => String(a).toLowerCase() === 'mfc white');
      rec('(info) B4 clearing "Also called" on the renamed board: is the old name "MFC White" really dropped?', true, JSON.stringify({ msg: al, aliases: mat(S, 'M1').aliases, gone }));
      if (gone) {
        const b4 = await need(p), s1 = await shown(p, 'L1');
        rec('(info) [MEDIUM] B5 old spelling taken off the board: lists never re-saved (House 1, House 9) now count as a SECOND board "MFC White" — is the person warned when they clear the box?', b4.mats.length === 1 || /list|still|used/i.test(al), JSON.stringify({ mats: b4.raw, house1: s1, said: al }));
        const add2 = await addMat(p, 'P1', 'MFC White', 'sheet');
        const nw = S.db.t.project_materials.find(m => m.project_id === 'P1' && m.id !== 'M1' && String(m.name).toLowerCase() === 'mfc white');
        rec('(info) B6 then a NEW board "MFC White" is added', !!nw, JSON.stringify([add2, nw && nw.id]));
        if (nw) { const s = [await shown(p, 'L1'), await shown(p, 'L2')];
          rec('B7 old lists typed "MFC White" show as "MFC White"; the list saved as "18mm MFC White" stays that — two boards, each under its own name', JSON.stringify(s) === '[["MFC White"],["18mm MFC White"]]', JSON.stringify(s)); }
      }
      rec('B: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ================= C. same text, different kind / different project =================
    { const S = mkS();
      // P1: a board "White" and a Stores row "Handle" whose spec is the word "White" (the database allows one material per name in a project, so no fitting can ALSO be called White); a Stores row whose spec text is the other board's name
      D.insert(S.db, 'project_materials', { id: 'M5', project_id: 'P1', name: 'White', kind: 'sheet' });
      // P2: its own board with the SAME spelling "MFC White", renamed there
      D.insert(S.db, 'project_materials', { id: 'M9', project_id: 'P2', name: 'Lucan Oak 18', kind: 'sheet', aliases: ['MFC White', 'Blum hinge'] });
      X.F3.seedList(S, 'LC', { wos: ['WO-3'], name: 'House C', lines: [['saw', 'Shelf', '2', 500, 300, 'White', '', ''], ['fit', 'Handle', '4', null, null, 'White', '', ''], ['fit', 'Shelf pack', '1', null, null, 'MFC White', '', ''], ['buy', 'Worktop', '1', null, null, 'MFC White', '', ''], ['saw', 'Odd', '1', 400, 300, 'Blum hinge', '', '']] });
      X.F3.seedList(S, 'LP2', { wos: ['WO-6'], name: 'Lucan A', list: { project_id: 'P2' }, lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['fit', 'Hinge', '4', null, null, 'Blum hinge', '', '']] });
      const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p); await reload(p);
      // rename the BOARD "White" → "Egger White"; rename board MFC White → 18mm MFC White; rename fitting Blum hinge → Blum 110
      const m1 = await rename(p, 'P1', 'M5', 'Egger White'), m2 = await rename(p, 'P1', 'M1', '18mm MFC White'), m3 = await rename(p, 'P1', 'M2', 'Blum 110');
      rec('C0 set-up: three renames saved', mat(S, 'M5').name === 'Egger White' && mat(S, 'M1').name === '18mm MFC White' && mat(S, 'M2').name === 'Blum 110', JSON.stringify([m1, m2, m3, mat(S, 'M5').name, mat(S, 'M1').name, mat(S, 'M2').name]));
      const all = await p.evaluate(() => listRows(lsList('LC')).map(r => [r.item, r.k, r.mat]));
      const g = n => (all.find(r => r[0] === n) || [])[2];
      rec('C1 saw row "Shelf" typed "White" → shows the board\'s new name "Egger White"', g('Shelf') === 'Egger White', JSON.stringify(all));
      rec('[HIGH] C2 Stores row "Handle" spec "White" (a handle colour) is NOT re-labelled to the board "Egger White"', g('Handle') === 'White', JSON.stringify(all));
      rec('[HIGH] C3 Stores row "Shelf pack" whose spec text is "MFC White" is NOT re-labelled to the board "18mm MFC White"', g('Shelf pack') === 'MFC White', JSON.stringify(all));
      rec('[HIGH] C4 bought-in row "Worktop" spec "MFC White" is NOT re-labelled to the board', g('Worktop') === 'MFC White', JSON.stringify(all));
      rec('[MEDIUM] C5 a SAW row whose material text is a fitting\'s old name ("Blum hinge") is NOT re-labelled to the fitting "Blum 110"', g('Odd') === 'Blum hinge', JSON.stringify(all));
      // the other project: its own alias decides, P1's rename does not leak
      const p2 = await p.evaluate(() => listRows(lsList('LP2')).map(r => [r.item, r.mat]));
      rec('[HIGH] C6 project Lucan: "MFC White" is ITS board "Lucan Oak 18" — Aderrig\'s rename to "18mm MFC White" does not leak across projects', (p2.find(r => r[0] === 'Side') || [])[1] === 'Lucan Oak 18', JSON.stringify(p2));
      rec('C7 project Lucan: a Stores row "Blum hinge" is not re-labelled to Lucan\'s BOARD (which has that spelling as an alias) nor to Aderrig\'s fitting', (p2.find(r => r[0] === 'Hinge') || [])[1] === 'Blum hinge', JSON.stringify(p2));
      // stores docket lines
      const dk = await p.evaluate(() => dkProjLines('P1').map(o => [o.x.part, o.x.material]));
      rec('[HIGH] C8 Stores docket lines: "Handle" stays "White", "Shelf pack" / "Worktop" stay "MFC White"; "Hinge" (House 1) is "Blum 110"', dk.filter(x => x[0] === 'Handle').every(x => x[1] === 'White') && dk.filter(x => /Shelf pack|Worktop/.test(x[0])).every(x => x[1] === 'MFC White') && dk.filter(x => x[0] === 'Hinge').every(x => x[1] === 'Blum 110'), JSON.stringify(dk));
      // the editor: open House C and save with a real change on one row — what is STORED for the Stores rows?
      await p.evaluate(() => openListEditor('LC')); await sleep(900);
      const er = await rows(p);
      rec('[HIGH] C9 editor on House C: the Stores rows still read "White" / "MFC White" in their spec boxes (never the board\'s new name)', (er.find(x => x.item === 'Handle') || {}).mat === 'White' && (er.find(x => x.item === 'Shelf pack') || {}).mat === 'MFC White', JSON.stringify(er.map(x => [x.item, x.mat])));
      await setv(p, er.findIndex(x => x.item === 'Shelf') + '|qty', '3'); await sleep(150); await save(p, 2400);
      const st = linesOf(S, 'LC').map(x => [x.part, x.kind, x.material]);
      const sg = n => (st.find(r => r[0] === n) || [])[2];
      rec('[HIGH] C10 saved: "Shelf" stored "Egger White"; Stores rows stored exactly as they were ("White", "MFC White", "MFC White")', sg('Shelf') === 'Egger White' && sg('Handle') === 'White' && sg('Shelf pack') === 'MFC White' && sg('Worktop') === 'MFC White', JSON.stringify([await err(p), st]));
      rec('C11 saved: the odd saw row keeps "Blum hinge"', sg('Odd') === 'Blum hinge', JSON.stringify(st));
      await closeAll(p);
      rec('C: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ================= D. "already cut on old list" across a rename made twice; retired material =================
    { const S = mkS();
      D.update(S.db, 'project_materials', mat(S, 'M1'), { name: '18mm Egger W980', aliases: ['MFC White', '18mm MFC White'] });
      // L1 (old, archived) stored "MFC White", Side ticked cut; LN replaces it, stored under the MIDDLE name
      D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'L1:2'), { status: 'cut', status_by: 'Saw', status_at: '2026-10-21T08:00:00.000Z' });
      const sw = await X.dev(browser, S, 'saw'), ps = sw.page; await reload(ps);
      const h = await ps.evaluate(async () => { await lsLines(['L1']); const a = lsPrevCutHTML('L1', 'Side', 720, 560, '18mm MFC White'), b = lsPrevCutHTML('L1', 'Side', 720, 560, '18mm Egger W980'), c = lsPrevCutHTML('L1', 'Side', 720, 560, 'Oak'), d = lsPrevCutHTML('L1', 'Top', 1200, 560, 'MFC White'); return [a, b, c, d].map(x => !!x); });
      rec('[MEDIUM] D1 "already cut on old list" hint: old list stored "MFC White" (cut), new list row under the MIDDLE name or the CURRENT name → hint shown', h[0] && h[1], JSON.stringify(h));
      rec('D2 … no hint for another board, none for a part that was not cut', !h[2] && !h[3], JSON.stringify(h));
      // retire the renamed board: its rows still show ONE name
      D.update(S.db, 'project_materials', mat(S, 'M1'), { active: false });
      await reload(ps);
      const n = await need(ps);
      rec('[MEDIUM] D3 the renamed board is then RETIRED (Active unticked): lists still show ONE board under its last name', n.mats.length === 1 && /18mm Egger W980/.test(JSON.stringify(n.raw)), JSON.stringify(n.raw));
      // a row with a material that is NOT on the project (typed) is untouched; text with HTML is untouched and inert
      const EV = '<img src=x onerror="window.__xss=1">';
      D.update(S.db, 'project_materials', mat(S, 'M2'), { name: EV + " O'Grady \"x\" 🪚", aliases: ['Blum hinge'] });
      await reload(ps);
      const html = await ps.evaluate(() => { const d = document.createElement('div'); d.innerHTML = listTableHTML(lsList('L1'), 'fit'); document.body.appendChild(d); const r = { xss: window.__xss || 0, img: d.querySelectorAll('img').length, txt: d.innerText }; d.remove(); return r; });
      rec('[HIGH] D4 a fitting renamed to a name with <img onerror>, O\'Grady, quotes and an emoji shows on the stores table as TEXT — nothing runs', !html.xss && !html.img && /O'Grady/.test(html.txt), JSON.stringify({ xss: html.xss, img: html.img, txt: html.txt.replace(/\s+/g, ' ').slice(0, 160) }));
      rec('D: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await sw.close(); }

    // ================= E. lists switched OFF (old storage): nothing of this must break the saw screen =================
    { const row = X.v1Row(); const S = X.makeServer(row, { lines: LINES });
      const sw = await X.dev(browser, S, 'saw'), ps = sw.page;
      const r = await ps.evaluate(() => { try { render(); const n = sheetNeed(workLists(), '', '2099-12-31', {}); return { ok: true, v2: V2(), mats: n.mats.length, body: document.body.innerText.length }; } catch (e) { return { ok: false, e: String(e) }; } });
      rec('[HIGH] E1 lists switched OFF: the saw screen draws and "Sheets needed" works with no error', r.ok && !r.v2 && r.body > 50 && !(S.errors || []).length, JSON.stringify([r, S.errors])); await sw.close(); }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
