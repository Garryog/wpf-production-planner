// Editor step 8: paste from Excel. Rows (tabs + new lines) pasted with the cursor in Description go through lsParseGrid:
// header row skipped, text-only rows → headings, "N total nr of units" → Units, per-unit = total ÷ Units; a summary is
// shown and Ctrl+Z undoes it. A narrow block pasted into another column fills cells from the cursor. A single value is a
// normal paste. Fake Supabase only. Run: node tests/editor/e8-paste.test.js
const F = require('../stage3/fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const paste = (pg, mr, text) => pg.evaluate(({ mr, text }) => { const e = document.querySelector('.pod-ovl [data-mr="' + mr + '"]'); e.focus(); const dt = new DataTransfer(); dt.setData('text/plain', text);
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); document.getElementById('toast').textContent = ''; e.dispatchEvent(ev); return ev.defaultPrevented; }, { mr, text });
const grid = pg => pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return [...ov.querySelectorAll('.me-grid tbody tr')].map(tr => {
  const v = f => { const e = tr.querySelector('[data-mr$="|' + f + '"]'); return e ? e.value : null; };
  return tr.classList.contains('me-h') ? 'h:' + v('item') + (v('units') != null ? '×' + v('units') : '') : [v('item'), v('qty'), v('L'), v('W'), v('mat'), v('edging')].join('|'); }); });
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.prompt = () => 'Tester'; window.confirm = () => true; openListEditor(null, 'WO-1'); });
  // WPF's layout, copied straight from the sheet (cached values = totals)
  const sheet = ['Description\tQty\tLength\tWidth\tColour\tEdging', '450 Robe fully shelved', '\t2\ttotal nr of units', 'Side panel\t4\t2380\t570\tMFC White\tL1LE 1mm', 'Shelves\t6\t414\t570\tMFC White\tL1LE 1mm',
    'Fillers & Kickers', 'Kicker\t7\t2440\t125\tW/W\tL1LE 1mm', 'Hinge\t8'].join('\r\n') + '\r\n';
  const pv = await paste(pg, '0|item', sheet);
  const g1 = await grid(pg);
  rec('rows pasted into Description: read like the import (header row skipped, unit block, heading, parts)', pv && g1.join(';') === 'h:450 Robe fully shelved×2;Side panel|2|2380|570|MFC White|L1LE 1mm;Shelves|3|414|570|MFC White|L1LE 1mm;h:Fillers & Kickers;Kicker|7|2440|125|W/W|L1LE 1mm;Hinge|8||||', g1.join(';'));
  const tot = await pg.evaluate(() => document.querySelector('[data-tot="1"]').textContent);
  rec('the per-unit quantity is total ÷ Units (4 ÷ 2 = 2) and the total shows beside it', tot === '= 4', tot);
  const t1 = await pg.evaluate(() => document.getElementById('toast').textContent);
  rec('a summary says what was pasted and that Ctrl+Z undoes it', /Pasted 4 rows, 1 unit block, 1 heading \(the column-header row was skipped\)/.test(t1) && /Ctrl\+Z undoes it/.test(t1), t1);
  const amber = await pg.evaluate(() => /fff4d6/.test(document.querySelector('.pod-ovl [data-mr="4|mat"]').getAttribute('style') || ''));
  rec('a pasted colour that is not on the project list shows amber (flagged)', amber);
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="0|item"]').focus()); await pg.keyboard.press('Control+z');
  const g2 = await grid(pg);
  rec('Ctrl+Z undoes the whole paste', g2.length === 1 && g2[0] === '|||||', g2.join(';'));
  // parts pasted INTO an existing unit block (no heading in the paste): per-unit = total ÷ the block's Units
  await pg.evaluate(() => { document.getElementById('me-addunit').click(); });
  await pg.evaluate(() => { const s = (k, v) => { const e = document.querySelector('.pod-ovl [data-mr="' + k + '"]'); e.value = v; e.oninput(); }; s('1|item', 'Unit A'); s('1|units', '3'); });
  await paste(pg, '2|item', 'Side\t6\t700\t560\tMFC White\nShelf\t7\t600\t560\tMFC White\n');
  const g3 = await grid(pg), t3 = await pg.evaluate(() => document.getElementById('toast').textContent);
  rec('parts pasted into a unit block of 3: Side 6 → 2 per unit; Shelf 7 can\'t be split, kept and flagged in the summary', g3[2] === 'Side|2|700|560|MFC White|' && g3[3] === 'Shelf|7|600|560|MFC White|' && /1 quantity could not be split per unit/.test(t3), g3.join(';') + ' / ' + t3);
  // a column of lengths pasted into Length fills down, adding rows at the bottom
  await paste(pg, '2|L', '710\n720\n730\n');
  const g4 = await grid(pg);
  rec('a column pasted into Length fills the cells down from the cursor and adds rows when needed', g4[2].split('|')[2] === '710' && g4[3].split('|')[2] === '720' && g4[4].split('|')[2] === '730' && g4.length === 5, g4.join(';'));
  // two columns pasted into Length fill Length and Width
  await paste(pg, '2|L', '800\t500\n');
  const g5 = await grid(pg);
  rec('two columns pasted into Length fill Length and Width', g5[2].split('|')[2] === '800' && g5[2].split('|')[3] === '500', g5[2]);
  // a single value is the normal paste (not intercepted)
  const single = await paste(pg, '2|note', 'grain up');
  rec('a single value is pasted the normal way', single === false);
  // nothing usable
  await paste(pg, '0|item', '\t\n\t\n');
  const t6 = await pg.evaluate(() => document.getElementById('toast').textContent);
  rec('a paste with no parts says so', /Nothing to paste/.test(t6), t6);
  // on a phone there is no paste handling (the browser's own)
  await pg.setViewportSize({ width: 360, height: 780 });
  await pg.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); openListEditor(null, 'WO-1'); });
  const ph = await paste(pg, '0|item', 'Side\t2\t700\t560\n');
  rec('phone: paste is left to the browser (no grid paste)', ph === false);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
