// Editor step 7: the keyboard works like Excel — Tab / Shift+Tab, Enter down (a new row at the bottom), arrow keys,
// Ctrl+D fill down, Insert adds a row, Ctrl+Delete deletes a row, Ctrl+Z undoes — and the cursor stays put across
// redraws. Real key presses (Playwright). Fake Supabase only. Run: node tests/editor/e7-keyboard.test.js
const F = require('../stage3/fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  const o = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }), pg = o.page;
  const at = () => pg.evaluate(() => (document.activeElement && document.activeElement.dataset.mr) || '(none)');
  const vals = f => pg.evaluate(f => [...document.querySelectorAll('.pod-ovl [data-mr$="|' + f + '"]')].map(e => e.value), f);
  const K = async (...keys) => { for (const k of keys) await pg.keyboard.press(k); };
  await pg.evaluate(() => { openListEditor(null, 'WO-1'); document.querySelector('.pod-ovl [data-mr="0|item"]').focus(); });
  await pg.keyboard.type('Side panel'); await K('Tab'); await pg.keyboard.type('2'); await K('Tab'); await pg.keyboard.type('720'); await K('Tab'); await pg.keyboard.type('560');
  rec('Tab moves right across the row and you can type straight in', (await at()) === '0|W' && (await vals('item'))[0] === 'Side panel' && (await vals('L'))[0] === '720', await at());
  await K('Tab', 'Tab', 'Tab', 'Tab');
  rec('Tab goes on through Colour, Edging 1 and Edging 2 (two edging columns, 4 Nov) to Note', (await at()) === '0|note', await at());
  await K('Tab');
  const n1 = await pg.evaluate(() => document.querySelectorAll('.pod-ovl .me-grid tbody tr').length);
  rec('Tab from the very last cell adds a row and goes to its Description', n1 === 2 && (await at()) === '1|item', n1 + ' ' + (await at()));
  await K('Shift+Tab');
  rec('Shift+Tab goes back to the previous row\'s last cell', (await at()) === '0|note', await at());
  // Enter goes down the same column; at the bottom it adds a row
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="0|qty"]').focus());
  await K('Enter');
  rec('Enter goes down the same column', (await at()) === '1|qty', await at());
  await pg.keyboard.type('4'); await K('Enter');
  rec('Enter on the bottom row adds a new row and stays in the column', (await at()) === '2|qty' && (await vals('qty')).length === 3, (await at()) + ' ' + (await vals('qty')).length);
  await K('ArrowUp', 'ArrowUp');
  rec('Up arrow moves up the column', (await at()) === '0|qty', await at());
  await K('ArrowDown');
  rec('Down arrow moves down', (await at()) === '1|qty', await at());
  // Left/Right: inside text they move the caret; at the edge (or with the whole cell selected) they move cells
  await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="0|item"]'); e.focus(); e.setSelectionRange(3, 3); });
  await K('ArrowRight');
  rec('Right arrow in the middle of text moves the caret, not the cell', (await at()) === '0|item');
  await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="0|item"]'); e.setSelectionRange(e.value.length, e.value.length); });
  await K('ArrowRight');
  rec('Right arrow at the end of the text moves to the next cell', (await at()) === '0|qty', await at());
  await K('ArrowLeft'); // whole cell selected on arrival → moves back
  rec('Left arrow with the whole cell selected moves back a cell', (await at()) === '0|item', await at());
  // Ctrl+D copies the cell above
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="1|L"]').focus());
  await K('Control+d');
  rec('Ctrl+D copies the cell above (Length 720)', (await vals('L'))[1] === '720' && (await at()) === '1|L', JSON.stringify(await vals('L')));
  // Insert adds a row above, Ctrl+Delete deletes the current row
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="1|item"]').focus());
  await K('Insert');
  const ins = await vals('qty');
  rec('Insert adds a row at the cursor (the row moves down)', ins.length === 4 && ins[2] === '4' && (await at()) === '1|item', JSON.stringify(ins) + ' ' + (await at()));
  await K('Control+Delete');
  rec('Ctrl+Delete deletes the current row', (await vals('qty')).length === 3 && (await vals('qty'))[1] === '4', JSON.stringify(await vals('qty')));
  // Ctrl+Z undoes, step by step
  await K('Control+z');
  rec('Ctrl+Z undoes the delete', (await vals('qty')).length === 4, JSON.stringify(await vals('qty')));
  await K('Control+z');
  rec('Ctrl+Z again undoes the insert', (await vals('qty')).length === 3, JSON.stringify(await vals('qty')));
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="0|item"]').focus());
  await pg.keyboard.type(' X');
  await K('Control+z');
  rec('Ctrl+Z undoes typing in a cell', (await vals('item'))[0] === 'Side panel', (await vals('item'))[0]);
  // the cursor survives a redraw (e.g. after picking a colour in another row the grid is redrawn)
  await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="1|note"]'); e.focus(); e.value = 'grain up'; e.oninput(); e.setSelectionRange(2, 2); });
  const cur = await pg.evaluate(() => { const g = document.getElementById('me-grid'); g.scrollTop = 0; const s = document.querySelector('.pod-ovl [data-mr="2|mat"]'); s.value = 'MFC White'; s.onchange();
    const a = document.activeElement; return { mr: a.dataset.mr }; });
  rec('after a redraw the cursor is on the cell that was changed', cur.mr === '2|mat', JSON.stringify(cur));
  // a redraw while typing (e.g. "No cutting" ticked) keeps the cursor AND the caret position
  const kc = await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="1|note"]'); e.focus(); e.setSelectionRange(2, 2);
    const nc = document.getElementById('me-nocut'); nc.checked = true; nc.onchange({ target: nc }); const a = document.activeElement; return [a.dataset.mr, a.selectionStart]; });
  rec('a redraw keeps the cursor in the same cell at the same caret position', kc[0] === '1|note' && kc[1] === 2, JSON.stringify(kc));
  await pg.evaluate(() => { const nc = document.getElementById('me-nocut'); nc.checked = false; nc.onchange({ target: nc }); });
  // arrows on a Colour dropdown move between cells instead of changing the colour
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="0|mat"]').focus());
  const before = await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="0|mat"]').value);
  await K('ArrowDown');
  rec('Down arrow on a Colour box moves to the row below and leaves the colour alone', (await at()) === '1|mat' && (await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="0|mat"]').value)) === before, await at());
  // headings: Tab goes Name → Units → Note
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="2|item"]').focus(); document.getElementById('me-addunit').click(); });
  const u0 = await at(); await K('Tab'); const u1 = await at(); await K('Tab'); const u2 = await at();
  rec('on a unit heading Tab goes name → Units → Note', /^\d+\|item$/.test(u0) && u1 === u0.split('|')[0] + '|units' && u2 === u0.split('|')[0] + '|note', [u0, u1, u2].join(' → '));
  // redraw time (typing never redraws; adding / deleting rows does): a normal house list and a very big one
  const ms = await pg.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); const t = n => { const rows = []; for (let i = 0; i < n; i++) rows.push({ k: 'part', item: 'Part ' + i, qty: '2', L: 700, W: 560, mat: 'MFC White', edging: '', note: '' });
    const ed = openListEditor2(null, 'WO-1', 'P1', { rows }); const a = performance.now(); ed.draw(); document.body.offsetHeight; const d = performance.now() - a; document.querySelector('.pod-ovl').remove(); return Math.round(d); };
    return [t(60), t(400)]; });
  rec('redraw: a 60-row list under 150 ms (' + ms[0] + ' ms), a 400-row list under 800 ms (' + ms[1] + ' ms)', ms[0] < 150 && ms[1] < 800, JSON.stringify(ms));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
