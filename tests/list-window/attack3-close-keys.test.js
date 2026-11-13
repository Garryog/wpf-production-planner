// Tester attack ROUND 3 (list window, 13 Nov): step 11 — ONE Close, the "Close without saving?" question after the change that
// ignores empty rows, Tab / Shift+Tab around Save and the focus trap. Real key presses. Fake Supabase only.
// Run: node tests/list-window/attack3-close-keys.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, ed, asks, setv, setid, click, save, donep, rows, liveFor } = L;
const foc = p => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset && a.dataset.mr) || a.id || (a.tagName + ':' + (a.textContent || '').trim().slice(0, 20)) : ''; });
const asked = p => p.evaluate(() => window.__asked.filter(m => /Close without saving/.test(m)).length);
// where the focus is: inside the top window? on something a person can see?
const where = p => p.evaluate(() => { const a = document.activeElement, os = [...document.querySelectorAll('.pod-ovl')], top = os[os.length - 1];
  const vis = !!a && a !== document.body && a.getClientRects().length > 0 && a.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }) && !a.closest('[hidden]');
  return { in: !!(a && top && top.contains(a)), vis, body: a === document.body, id: a ? a.id || (a.dataset && a.dataset.mr) || a.tagName : '' }; });

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const t = await X.dev(browser, S, 'office'), p = t.page, kb = p.keyboard; await asks(p);
    const open = async (wo, id) => { await closeAll(p); await p.evaluate(({ wo, id }) => { window.__asked = []; window.__confirm = false; openListEditor(id || null, wo); }, { wo, id }); await sleep(1100); };
    const x = async () => { await click(p, 'me-x0'); await sleep(300); };

    // ---------- 1. ONE Close ----------
    await open('WO-3');
    let c = await p.evaluate(() => { const o = document.querySelector('.me-ed').closest('.pod-ovl'); return { x0: !!o.querySelector('#me-x0'), podx: !!o.querySelector('#pod-x'),
      closes: [...o.querySelectorAll('button')].filter(b => /close/i.test(b.textContent) && b.getClientRects().length).map(b => b.textContent.trim()) }; });
    rec('C1: the window has exactly ONE Close button (✕ Close, top right); no bottom Close', c.x0 && !c.podx && c.closes.length === 1, JSON.stringify(c));
    await x();
    rec('C2: ✕ with nothing typed → closes, nothing asked', !(await ed(p)) && !(await asked(p)));
    await open('WO-3'); await click(p, 'me-addsaw'); await sleep(250); await click(p, 'me-addsaw'); await sleep(250); await x();
    rec('C3: ＋ Row twice, nothing typed, ✕ → closes, nothing asked', !(await ed(p)) && !(await asked(p)), 'asked ' + await asked(p));
    await open('WO-3'); await setv(p, '0|item', 'Side'); await click(p, 'me-addsaw'); await sleep(250); await x();
    rec('C4: something real typed, THEN a blank ＋ Row, ✕ → STILL asks (window stays on Cancel)', await ed(p) && (await asked(p)) === 1, 'asked ' + await asked(p));
    await setv(p, '0|item', ''); await x();
    rec('C5: …the typed word taken out again, ✕ → nothing left to lose: closes without asking', !(await ed(p)) && (await asked(p)) === 1, 'asked ' + await asked(p));
    // only a NOTE / only an edging typed in a new row
    for (const f of ['note', 'edging', 'qty']) { await open('WO-3');
      if (f === 'edging') await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|edging"]'); const o = [...s.options].find(o => o.value && !/^__/.test(o.value)); s.value = o ? o.value : ''; s.dispatchEvent(new Event('change')); });
      else await setv(p, '0|' + f, f === 'qty' ? '4' : 'ABS white'); await sleep(200); await x();
      rec('C6: only "' + f + '" typed in a row, ✕ → asks', await ed(p) && (await asked(p)) === 1, 'asked ' + await asked(p)); }
    // only a MATERIAL picked / only Bought in ticked: lsEmptyRow() does not look at them
    await open('WO-3');
    const mat = await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); if (!s) return 'no mat box'; const o = [...s.options].find(o => o.value && !/^__/.test(o.value)); if (!o) return 'no material'; s.value = o.value; s.dispatchEvent(new Event('change')); return o.value; });
    await sleep(300); await x();
    rec('[LOW] C7: only a MATERIAL picked in a new row (' + mat + '), ✕ → asks before the pick is thrown away (sig() drops rows lsEmptyRow() calls empty; it ignores mat / Bought in)', await ed(p) && (await asked(p)) === 1, 'asked ' + await asked(p) + ' open ' + await ed(p));
    await open('WO-3');
    const buy = await p.evaluate(() => { const b = document.querySelector('.me-ed [data-row] input[type=checkbox]'); if (!b) return 'no tick box'; b.click(); return (b.dataset.mb || b.dataset.mr || b.id || b.title || 'ticked').slice(0, 40); });
    await sleep(300); await x();
    rec('(info) C7b: only a row tick box (' + buy + ') ticked, ✕ → asks', buy === 'no tick box' || (await ed(p) && (await asked(p)) === 1), 'asked ' + await asked(p));

    // ---------- a SAVED list ----------
    const n0 = L.linesOf(S, 'L1').length;
    await open('', 'L1');
    rec('C8 set-up: saved list L1 opens with its rows', (await rows(p)).length >= 2, (await rows(p)).length + ' rows, ' + n0 + ' lines');
    await x();
    rec('C8: saved list, nothing changed, ✕ → no question', !(await ed(p)) && !(await asked(p)));
    await open('', 'L1'); await click(p, 'me-addsaw'); await sleep(250); await x();
    rec('C9: saved list + ＋ Row (it copies the material of the row above), nothing typed, ✕ → no question', !(await ed(p)) && !(await asked(p)), 'asked ' + await asked(p));
    await open('', 'L1'); await p.evaluate(() => document.querySelector('.me-ed [data-mrx]').click()); await sleep(300); await x();
    rec('C10: saved list, a ROW DELETED, ✕ → asks', await ed(p) && (await asked(p)) === 1, 'asked ' + await asked(p));
    await open('', 'L1'); await p.evaluate(() => document.querySelector('.me-ed [data-mrx]').click()); await sleep(300); await click(p, 'me-addsaw'); await sleep(250); await x();
    rec('C11: saved list, a row deleted then a blank ＋ Row (same number of rows as before), ✕ → asks', await ed(p) && (await asked(p)) === 1, 'asked ' + await asked(p));
    await open('', 'L1'); await p.evaluate(() => document.querySelector('.me-ed [data-mrx]').click()); await sleep(300); await kb.press('Escape'); await sleep(300);
    rec('C12: saved list, a row deleted, Esc → asks (same as ✕)', await ed(p) && (await asked(p)) === 1, 'asked ' + await asked(p));
    // two rows swapped by retyping (same set of rows, other order) is a change
    await open('', 'L1'); const r0 = await rows(p); const pi = r0.map((r, i) => r.hdr ? -1 : i).filter(i => i >= 0);
    if (pi.length >= 2) { await setv(p, pi[0] + '|item', r0[pi[1]].item + ' x'); await x();
      rec('C13: saved list, one description changed, ✕ → asks', await ed(p) && (await asked(p)) === 1); }
    await open('', 'L1'); await click(p, 'me-addhdr'); await sleep(300); await x();
    rec('(info) C14: saved list + ＋ Heading with nothing typed, ✕ → no question (an empty heading is nothing to lose, like an empty row)', !(await ed(p)) && !(await asked(p)), 'asked ' + await asked(p));
    rec('C15: nothing above changed the saved list in the database', L.linesOf(S, 'L1').length === n0);

    // ---------- 2. Tab / Shift+Tab around Save ----------
    await open('WO-4'); await p.evaluate(() => { window.__confirm = true; });
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.type('Side');
    await click(p, 'me-addsaw'); await sleep(250); await click(p, 'me-addsaw'); await sleep(250); // rows 1 and 2 empty
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="2|note"]').focus());
    await kb.press('Tab'); await sleep(200);
    rec('T1: Tab from the empty LAST row → big Save', (await foc(p)) === 'me-save', await foc(p));
    await kb.press('Shift+Tab'); await sleep(200);
    rec('T2: Shift+Tab from Save → back to the cell Tab came from (2|note)', (await foc(p)) === '2|note', await foc(p));
    // the person clicks into ANOTHER row, then reaches Save with the mouse-less route again
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|qty"]').focus()); await sleep(100);
    await p.evaluate(() => document.getElementById('me-save').focus()); await kb.press('Shift+Tab'); await sleep(200);
    const back = await foc(p);
    rec('(info) T3: cursor was last in row 1 (0|qty), Save focused another way, Shift+Tab → goes to ' + back + ' (a row, in the window)', /\|/.test(back), back);
    // the row Tab came from is DELETED while the focus is on Save → falls back to the last row, never nowhere
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="2|note"]').focus()); await kb.press('Tab'); await sleep(150);
    await p.evaluate(() => { const b = document.querySelectorAll('.me-ed [data-mrx]'); b[b.length - 1].click(); }); await sleep(300);
    await p.evaluate(() => document.getElementById('me-save').focus()); await kb.press('Shift+Tab'); await sleep(200);
    let w = await where(p);
    rec('T4: the row Tab came from deleted, Shift+Tab from Save → still lands on a visible cell in the window', w.in && w.vis && !w.body, JSON.stringify(w));
    // Tab past Save wraps; go right round the window twice — never the page behind, never a hidden thing
    await p.evaluate(() => document.getElementById('me-save').focus()); await kb.press('Tab'); await sleep(150);
    w = await where(p); const first = await foc(p);
    rec('T5: Tab past Save → stays in the window on something visible (' + first + ')', w.in && w.vis, JSON.stringify(w));
    await kb.press('Shift+Tab'); await sleep(150);
    rec('T6: Shift+Tab from the first thing in the window → the big Save (round the other way)', (await foc(p)) === 'me-save', await foc(p));
    let bad = [], seen = new Set(), n = 0;
    await p.evaluate(() => document.getElementById('me-x0').focus());
    for (let i = 0; i < 120; i++) { await kb.press('Tab'); n = (await rows(p)).length; w = await where(p); seen.add(w.id); if (!w.in || !w.vis) bad.push(i + ':' + JSON.stringify(w)); if (n > 12) break; }
    rec('T7: 120 Tabs from ✕ Close: the focus is always in the window and on something visible', !bad.length, bad.slice(0, 3).join(' '));
    rec('(info) T7b: …and Tab reaches the big Save without making more than a handful of rows', seen.has('me-save') && n <= 12, 'rows ' + n + ' · ' + [...seen].slice(0, 40).join(','));
    // anything a person can Tab onto that the trap's own list does not know (Tab from it would jump to the top)
    const unk = await p.evaluate(() => { const o = document.querySelector('.me-ed').closest('.pod-ovl'), sel = 'button,input,select,textarea,summary,a[href]';
      return [...o.querySelectorAll('*')].filter(e => e.tabIndex >= 0 && e.getClientRects().length && !e.matches(sel)).map(e => e.tagName + '#' + e.id + '.' + e.className).slice(0, 6); });
    rec('T8: nothing in the window can take the focus that the wrap-round list does not know about', !unk.length, unk.join(' '));
    // Shift+Tab from the very first cell of the grid: must go somewhere (the boxes above), not be swallowed
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.press('Shift+Tab'); await sleep(200);
    rec('[LOW] T9: Shift+Tab from the first cell of the first row goes back to the boxes above (it is swallowed — the keyboard can never leave the grid upwards)', (await foc(p)) !== '0|item', await foc(p));

    // ---------- 3. the trap with something open on top ----------
    await p.click('#me-start summary'); await sleep(200); await p.click('#me-findold'); await sleep(700);
    bad = [];
    for (let i = 0; i < 25; i++) { await kb.press('Tab'); w = await where(p); if (!w.in || !w.vis) bad.push(i + ':' + w.id); }
    rec('[LOW] F1: old-list finder open over the window: 25 Tabs stay inside the FINDER (not the list window under it, not the page behind)', !bad.length, bad.slice(0, 5).join(' '));
    const under = await p.evaluate(() => { const a = document.activeElement, lw = document.querySelector('.me-ed'); return !!(a && lw && lw.contains(a)); });
    rec('F1b: …and the focus is never pulled back into the list window UNDER the finder', !under);
    await kb.press('Escape'); await sleep(300);
    rec('F2: Esc closes the finder only; the list window is still there with its typed row', await ed(p) && (await rows(p))[0].item === 'Side');
    // More ▾ open: Tab walks into the panel's switches, all visible
    await p.evaluate(() => { document.getElementById('me-more').open = true; document.querySelector('#me-more summary').focus(); });
    bad = []; for (let i = 0; i < 6; i++) { await kb.press('Tab'); w = await where(p); if (!w.in || !w.vis) bad.push(i + ':' + w.id); }
    rec('F3: More ▾ open: Tab goes through its switches, always visible and in the window', !bad.length, bad.join(' '));
    await p.evaluate(() => { document.getElementById('me-more').open = false; });

    // ---------- 4. the Saved ✓ panel ----------
    await setv(p, '0|qty', '2'); await setv(p, '0|L', '720'); await setv(p, '0|W', '560');
    await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); const o = [...s.options].find(o => o.value && !/^__/.test(o.value)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change')); } }); await sleep(300);
    await save(p, 2200);
    const d = await donep(p);
    rec('S1: Save → "Saved ✓ — list is with the Saw & Stores"', !!d && /Saved ✓/.test(d.h) && liveFor(S, 'WO-4').length === 1, d ? d.h : await L.err(p));
    c = await p.evaluate(() => { const o = document.querySelector('.me-dov'); return o ? { btns: [...o.querySelectorAll('button')].map(b => b.textContent.trim()), foc: document.activeElement.id } : null; });
    rec('S2: the Saved panel has its own Close (focused) and Edit it again — and no ✕ / second Close', !!c && c.btns.filter(b => /close/i.test(b)).length === 1 && c.foc === 'me-dclose', JSON.stringify(c));
    bad = []; for (let i = 0; i < 5; i++) { await kb.press('Tab'); w = await where(p); if (!w.in) bad.push(i + ':' + w.id); }
    rec('[LOW] S3: on the Saved ✓ panel Tab stays on its two buttons (the wrap-round is switched off there: Tab goes to the page behind)', !bad.length, bad.join(' '));
    await p.evaluate(() => document.getElementById('me-dclose').focus()); await kb.press('Enter'); await sleep(300);
    rec('S4: Enter on Close shuts the panel; one list saved', !(await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)) && liveFor(S, 'WO-4').length === 1);
    await t.ctx.close().catch(() => {});
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
