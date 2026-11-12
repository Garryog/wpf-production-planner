// Tester attack (list window, 12 Nov): the "old-school" user with NO MOUSE — open from the job, type rows with Tab / Enter,
// Save, Close. Real key presses (Playwright keyboard). And what Esc does at each point.
// Fake Supabase only. Run: node tests/list-window/attack1-keyboard.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, save, donep, err, job, rows, liveFor, linesOf } = L;
const foc = p => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset && a.dataset.mr) || a.id || a.tagName : ''; });

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const t = await X.dev(browser, S, 'office'), p = t.page, kb = p.keyboard;
    await asks(p);
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); openListEditor(null, 'WO-3'); }); await sleep(900);
    let f = await foc(p);
    rec('window opened from the job: the cursor is already in the first Description box (type straight away, no click)', f === '0|item', 'focus is on: ' + f);
    if (f !== '0|item') { // how many Tabs from the top of the window to the first row?
      await p.evaluate(() => { const x = document.getElementById('me-x0'); x.focus(); });
      let n = 0; for (; n < 25; n++) { await kb.press('Tab'); if ((await foc(p)) === '0|item') break; }
      rec('…with the keyboard only: Tab from ✕ Close reaches the first Description box (' + (n + 1) + ' Tab presses)', (await foc(p)) === '0|item' && n < 8, 'presses: ' + (n + 1) + ', now on ' + await foc(p));
      if ((await foc(p)) !== '0|item') await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus());
    }
    // row 1: Description Tab Qty Tab L Tab W Tab Material(letter) Tab Tab Tab Note Tab → new row
    await kb.type('Side'); await kb.press('Tab'); await kb.type('2'); await kb.press('Tab'); await kb.type('720'); await kb.press('Tab'); await kb.type('560'); await kb.press('Tab');
    rec('Tab ×4 walks Description → Qty → Length → Width → Material', (await foc(p)) === '0|mat', await foc(p));
    await kb.type('M'); await sleep(300); // a letter picks the first material starting with it ("MFC White")
    let r = await rows(p);
    rec('Material picked from the keyboard (letter "M" → MFC White) — and the cursor is still in the Material box afterwards', r[0].mat === 'MFC White' && (await foc(p)) === '0|mat', JSON.stringify([r[0].mat, await foc(p)]));
    if ((await foc(p)) !== '0|mat') await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|mat"]').focus());
    await kb.press('Tab'); await kb.press('Tab'); await kb.press('Tab');
    rec('Tab ×3 → Edging 1 → Edging 2 → Note', (await foc(p)) === '0|note', await foc(p));
    await kb.type('grain'); await kb.press('Tab'); await sleep(300);
    rec('Tab at the end of the last row → a NEW row, cursor in its Description', (await foc(p)) === '1|item' && (await rows(p)).length === 2, await foc(p));
    await kb.type('Hinge'); await kb.press('Tab'); await kb.type('8'); await kb.press('Enter'); await sleep(300);
    rec('Enter on the last row → a new row below, cursor in the same column (Qty)', (await foc(p)) === '2|qty' && (await rows(p)).length === 3, await foc(p));
    r = await rows(p);
    rec('everything typed is in the boxes (Side 2 720 560 MFC White · Hinge 8)', r[0].item === 'Side' && r[0].qty === '2' && r[0].L === '720' && r[0].W === '560' && r[1].item === 'Hinge' && r[1].qty === '8', JSON.stringify(r));
    rec('a Stores row (Hinge, no size) typed under a saw row does not silently keep the board colour', !r[1].mat || r[1].mat === '', JSON.stringify(r[1]));
    // now: get to Save WITHOUT the mouse
    let reached = false, seen = [];
    for (let i = 0; i < 40; i++) { await kb.press('Tab'); const x = await foc(p); seen.push(x); if (x === 'me-save') { reached = true; break; } }
    const nrows = (await rows(p)).length;
    rec('keyboard only: Tab from the grid gets to the big Save button (pressed Tab 40 times)', reached, 'focus went: ' + seen.slice(0, 12).join(' → ') + ' … rows now ' + nrows);
    rec('…Tab does not just keep adding empty rows for ever (rows after 40 Tabs: ' + nrows + ')', nrows <= 4, String(nrows));
    let saved = false;
    for (const combo of ['Control+s', 'Control+Enter']) {
      if (await donep(p)) break;
      await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="0|item"]'); if (e) e.focus(); });
      await kb.press(combo); await sleep(1500);
      if (await donep(p)) { saved = true; rec('keyboard only: ' + combo + ' saves the list', true); }
    }
    if (!reached && !saved) rec('keyboard only: there is SOME way to Save without the mouse (Tab to Save, Ctrl+S or Ctrl+Enter)', false, 'none of them reached Save; the Help line under "?" lists no key for Save');
    // Shift+Tab out of the top of the grid
    if (!(await donep(p))) {
      await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus());
      await kb.press('Shift+Tab'); await sleep(150);
      rec('keyboard only: Shift+Tab from the first box leaves the grid upwards (to Start from… / the name)', (await foc(p)) !== '0|item', await foc(p));
      // finish with the mouse stand-in so the rest can be checked
      await p.evaluate(() => { const b = document.getElementById('me-save'); b.focus(); }); await kb.press('Enter'); await sleep(1800);
    }
    let dn = await donep(p);
    const l3 = liveFor(S, 'WO-3');
    rec('Save (Enter on the focused Save button) → "Saved ✓", ONE list on WO-3 with 2 rows — the empty rows Tab/Enter made are left out', dn && l3.length === 1 && linesOf(S, l3[0].id).length === 2, JSON.stringify([dn && dn.l, l3[0] && linesOf(S, l3[0].id).map(x => x.part), await err(p)]));
    rec('Saved panel: the cursor is on [Close]', (await foc(p)) === 'me-dclose', await foc(p));
    await kb.press('Enter'); await sleep(300);
    rec('Enter → the panel closes; nothing left open', !(await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)));

    // ---------------- Esc ----------------
    const esc = async () => { await kb.press('Escape'); await sleep(250); };
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; openListEditor(null, 'WO-4'); }); await sleep(800);
    await esc();
    rec('Esc with nothing typed → closes, no question', !(await ed(p)) && !(await p.evaluate(() => window.__asked.length)));
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-4'); }); await sleep(800);
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.type('Side'); await esc();
    rec('Esc after typing → "Close without saving?"; answering Cancel keeps the window AND the typed row', await ed(p) && (await rows(p))[0].item === 'Side' && (await p.evaluate(() => window.__asked.length)) === 1, JSON.stringify(await p.evaluate(() => window.__asked)));
    rec('…the cursor is still in the box it was in (carry on typing)', (await foc(p)) === '0|item', await foc(p));
    // Esc with the "Start from…" panel open
    await p.evaluate(() => { window.__asked = []; const d = document.getElementById('me-start'); d.querySelector('summary').focus(); }); await kb.press('Enter'); await sleep(300);
    const op = await p.evaluate(() => document.getElementById('me-start').open);
    await esc();
    const a1 = await p.evaluate(() => ({ asked: window.__asked.length, open: (document.getElementById('me-start') || {}).open, ed: !!document.querySelector('.me-ed') }));
    rec('"Start from…" opened with Enter (' + op + '); Esc there closes the little panel — it does not ask to close the whole list', op && a1.ed && a1.asked === 0 && a1.open === false, JSON.stringify(a1));
    // Esc with "More" open
    await p.evaluate(() => { window.__asked = []; const s = document.getElementById('me-start'); if (s) s.open = false; const d = document.getElementById('me-more'); d.open = true; d.querySelector('#me-type').focus(); });
    await esc();
    const a2 = await p.evaluate(() => ({ asked: window.__asked.length, open: (document.getElementById('me-more') || {}).open, ed: !!document.querySelector('.me-ed') }));
    rec('Esc with "More ▾" open (cursor in Type) closes the More panel — it does not ask to close the whole list', a2.ed && a2.asked === 0 && a2.open === false, JSON.stringify(a2));
    // Esc → OK really closes and nothing is saved
    await p.evaluate(() => { window.__confirm = true; const d = document.getElementById('me-more'); if (d) d.open = false; document.querySelector('.me-ed [data-mr="0|item"]').focus(); }); await esc();
    rec('Esc → OK → window closed, nothing saved for WO-4', !(await ed(p)) && liveFor(S, 'WO-4').length === 0);
    // keys in the grid: Ctrl+Z after Ctrl+Delete, arrow keys, Insert
    await p.evaluate(() => { openListEditor(null, 'WO-4'); }); await sleep(800);
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus());
    await kb.type('One'); await kb.press('Enter'); await kb.type('Two'); await kb.press('Enter'); await kb.type('Three');
    await kb.press('ArrowUp'); await kb.press('Control+Delete'); await sleep(200);
    r = await rows(p);
    rec('Ctrl+Delete on the middle row removes that row only', r.length === 2 && r[0].item === 'One' && r[1].item === 'Three', JSON.stringify(r.map(x => x.item)));
    await kb.press('Control+z'); await sleep(200);
    r = await rows(p);
    rec('Ctrl+Z brings it back', r.length === 3 && r[1].item === 'Two', JSON.stringify(r.map(x => x.item)));
    // Enter inside the List name box must not save / close / lose anything
    await p.evaluate(() => { const n = document.getElementById('me-name'); n.focus(); }); await kb.type('Kitchen B'); await kb.press('Enter'); await sleep(400);
    rec('Enter in the List name box: nothing closes, nothing saved, rows kept', await ed(p) && (await rows(p)).length === 3 && liveFor(S, 'WO-4').length === 0 && !(await donep(p)));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
