// Stage 3 S4: the list editor with the switch on (project picker, type, edging, saw material only from the project's
// sheet materials, fittings "Other…" flagged) and Excel material matching that remembers aliases. Switch off: the old
// editor is unchanged. Fake Supabase only. Run: node tests/stage3/s4-editor.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  // ---- switch off: today's editor
  {
    const row = F.v2Row(); delete row.settings.listStore; delete row.settings.listStoreAt;
    const S = F.makeServer(row);
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const a = await off.page.evaluate(() => { openListEditor(null, 'WO-1'); const o = document.querySelector('.pod-ovl'); return { proj: !!o.querySelector('#me-proj'), pid: !!o.querySelector('#me-pid'), dl: !!o.querySelector('#me-mats'), mat: o.querySelector('[data-mr="0|mat"]').tagName, ph: o.querySelector('[data-mr="0|note"]').placeholder }; });
    rec('switch off: the editor is today\'s (typed project, material with suggestions, "Edging / note")', a.proj && !a.pid && a.dl && a.mat === 'INPUT' && a.ph === 'Edging / note' && F.newTableCalls(S).length === 0, JSON.stringify(a));
    await off.close();
  }
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: [['saw', 'Side', '2', 720, 560, 'Mystery board', '1mm', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''], ['fit', 'Tap', '1', null, null, 'Quooker', '', '']] });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { customer: 'Aderrig Homes' });
  D.insert(S.db, 'projects', { id: 'P2', name: 'Crown' }); D.insert(S.db, 'project_materials', { id: 'M9', project_id: 'P2', name: 'Birch ply', kind: 'sheet' });
  F.seedList(S, 'T1', { name: 'Type B', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed' } });
  const off = await F.dev(browser, S, 'office');
  await off.page.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : 'Tester'; });
  // new list from WO-1: project from the WO's customer
  const a = await off.page.evaluate(() => { openListEditor(null, 'WO-1'); const o = document.querySelector('.pod-ovl'), m = o.querySelector('[data-mr="0|mat"]');
    return { pid: o.querySelector('#me-pid').value, tag: m.tagName, opts: [...m.options].map(x => x.value).join('|'), dl: !!o.querySelector('datalist'), type: o.querySelector('#me-type').value }; });
  rec('new list: project picked from the WO customer; saw material is a dropdown of the project\'s sheet materials only (no typing)', a.pid === 'P1' && a.tag === 'SELECT' && a.opts === '|MFC White' && !a.dl && a.type === 'house', JSON.stringify(a));
  const b = await off.page.evaluate(() => { const o = document.querySelector('.pod-ovl'), p = o.querySelector('#me-pid'); p.value = 'P2'; p.onchange({ target: p }); return [...o.querySelector('[data-mr="0|mat"]').options].map(x => x.value).join('|'); });
  rec('changing the project changes the materials offered', b === '|Birch ply', b);
  // validation, fittings Other…
  const c = await off.page.evaluate(() => { const o = document.querySelector('.pod-ovl'), p = o.querySelector('#me-pid'); p.value = 'P1'; p.onchange({ target: p });
    const s = (k, v) => { const e = o.querySelector('[data-mr="' + k + '"]'); e.value = v; (e.oninput || e.onchange)(); };
    s('0|item', 'Gable'); s('0|qty', '2'); s('0|L', '900'); s('0|W', '560'); s('0|edging', '1mm');
    o.querySelector('#me-save').click(); return o.querySelector('#me-err').textContent; });
  rec('a saw row with no material is refused', /material for every saw row/.test(c), c);
  const d = await off.page.evaluate(() => { const o = document.querySelector('.pod-ovl');
    const s = (k, v) => { const e = o.querySelector('[data-mr="' + k + '"]'); e.value = v; (e.oninput || e.onchange)(); };
    s('0|mat', 'MFC White'); o.querySelector('#me-addfit').click(); o.querySelector('#me-addfit').click();
    s('1|item', 'Hinge'); s('1|qty', '8'); s('1|fsel', 'Blum hinge');
    s('2|item', 'Sink'); s('2|qty', '1'); s('2|fsel', '__other');
    const flagged = !!o.querySelector('tr[data-flag="1"] [data-mr="2|mat"]');
    o.querySelector('#me-save').click(); const e1 = o.querySelector('#me-err').textContent;
    s('2|mat', 'Franke 1.5 bowl'); o.querySelector('#me-type').value = 'kitchen'; o.querySelector('#me-tname').value = 'Type A';
    o.querySelector('#me-save').click(); return { flagged, e1 }; });
  rec('fittings: project fittings to pick from, or "Other…" typed with an amber flag; Other… needs the spec', d.flagged && /spec for every "Other/.test(d.e1), JSON.stringify(d));
  await F.sleep(600);
  const nl = S.db.t.lists.find(l => l.name === 'House 1' && l.id !== 'L1') || S.db.t.lists.find(l => l.id !== 'L1' && l.id !== 'T1');
  const lns = nl ? S.db.t.list_lines.filter(x => x.list_id === nl.id).sort((x, y) => x.seq - y.seq) : [];
  rec('saved: project P1, type kitchen "Type A", edging kept, Blum hinge not flagged, "Other…" sink flagged', nl && nl.project_id === 'P1' && nl.list_type === 'kitchen' && nl.type_name === 'Type A' && lns[0].material === 'MFC White' && lns[0].edging === '1mm' && lns[1].material_other === false && lns[2].material === 'Franke 1.5 bowl' && lns[2].material_other === true, JSON.stringify(lns.map(x => [x.material, x.material_other])));
  // editing an existing list: a board not on the project list is kept and shown flagged; a typed fitting shows as Other…
  const e = await off.page.evaluate(() => { openListEditor('L1'); const o = document.querySelector('.pod-ovl'), m = o.querySelector('[data-mr="0|mat"]');
    return { sel: m.value, txt: m.options[m.selectedIndex].text, fit: o.querySelector('[data-mr="2|fsel"]').value, fitTxt: o.querySelector('[data-mr="2|mat"]') && o.querySelector('[data-mr="2|mat"]').value, hinge: o.querySelector('[data-mr="1|fsel"]').value }; });
  rec('editing: a board not on the list stays, marked ⚠; a spec not on the list shows as Other… with its text', e.sel === 'Mystery board' && /⚠ Mystery board/.test(e.txt) && e.fit === '__other' && e.fitTxt === 'Quooker' && e.hinge === 'Blum hinge', JSON.stringify(e));
  await off.page.evaluate(() => { document.querySelector('#me-save').click(); });
  await F.sleep(600);
  rec('saving the edit keeps it, flagged', F.line(S, 'L1:1').material === 'Mystery board' && F.line(S, 'L1:3').material_other === true && F.line(S, 'L1:2').material_other === false);
  // templates open in the editor without a work order
  const t = await off.page.evaluate(() => { openListEditor('T1'); const o = document.querySelector('.pod-ovl'); const r = { wo: !!o.querySelector('#me-wo'), title: o.innerText.includes('template'), type: o.querySelector('#me-type').value, tn: o.querySelector('#me-tname').value }; o.remove(); return r; });
  rec('a template opens with its type and no work order', !t.wo && t.title && t.type === 'kitchen' && t.tn === 'Type B 3-bed', JSON.stringify(t));
  // ---- Excel material matching
  const b64 = await off.page.evaluate(() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Aderrig'], ['Side', 2, 720, 560, 'MFC Wht', ''], ['Top', 1, 1200, 560, 'Oak X', ''], ['Back', 1, 700, 600, 'Ply 18', ''], ['Hinge', 8, null, null, 'Blum', '']]), 'House 8'); return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }); });
  const up = async name => { await off.page.evaluate(() => { showTab('l'); document.getElementById('toast').textContent = ''; }); await off.page.setInputFiles('#lst-file', { name: 'Aderrig.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(b64, 'base64') }); };
  await up();
  for (let i = 0; i < 30 && !(await off.page.evaluate(() => !!document.getElementById('mm-ok'))); i++) await F.sleep(100);
  const names = await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl tbody b')].map(b => b.textContent).join('|'));
  rec('upload: the three board names not on the project list are shown for matching (fittings are not)', names === 'MFC Wht|Oak X|Ply 18', names);
  await off.page.evaluate(() => { const s = (i, v) => { document.querySelector('[data-mm="' + i + '"]').value = v; }; s(0, 'M1'); s(2, '__add'); document.getElementById('mm-ok').click(); });
  for (let i = 0; i < 30 && !/imported/.test(await off.page.evaluate(() => document.getElementById('toast').textContent)); i++) await F.sleep(100);
  const l8 = S.db.t.lists.find(l => l.name === 'House 8'), l8l = l8 ? S.db.t.list_lines.filter(x => x.list_id === l8.id).sort((x, y) => x.seq - y.seq) : [];
  rec('matched name saved as the project material, remembered as an alias', l8l[0] && l8l[0].material === 'MFC White' && !l8l[0].material_other && D.find(S.db, 'project_materials', 'M1').aliases.includes('MFC Wht'), JSON.stringify(l8l.map(x => [x.material, x.material_other])));
  rec('"Add" puts the new board on the project list (not flagged); "keep as typed" is saved flagged', S.db.t.project_materials.some(m => m.project_id === 'P1' && m.name === 'Ply 18' && m.kind === 'sheet') && l8l[2].material_other === false && l8l[1].material === 'Oak X' && l8l[1].material_other === true);
  await up();
  for (let i = 0; i < 30 && !(await off.page.evaluate(() => !!document.getElementById('mm-ok') || /imported/.test(document.getElementById('toast').textContent))); i++) await F.sleep(100);
  const second = await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl tbody b')].map(b => b.textContent).join('|'));
  rec('next upload: only the name left as typed is asked about again (the alias is remembered)', second === 'Oak X', second);
  await off.page.evaluate(() => { const b = document.getElementById('mm-ok'); if (b) b.click(); });
  await F.sleep(500);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await off.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
