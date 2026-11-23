// Tester attack ROUND 2 (list window, 12 Nov): Esc / Tab edge cases after the step-9 fixes (Esc closes Start from… / More
// first; Tab from an EMPTY last row goes to Save), and the ✕ "Close without saving?" question — asked exactly when
// something was typed. Real key presses (Playwright keyboard). Fake Supabase only.
// Run: node tests/list-window/attack2-keys.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, ed, asks, setv, setid, click, save, donep, err, job, rows, liveFor, linesOf } = L;
const foc = p => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset && a.dataset.mr) || a.id || (a.tagName + (a.textContent ? ':' + a.textContent.trim().slice(0, 20) : '')) : ''; });
const inWin = p => p.evaluate(() => { const a = document.activeElement, o = document.querySelector('.me-ed'); return !!(a && o && o.closest('.pod-ovl').contains(a)); });
const ovls = p => p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].map(o => o.querySelector('.me-ed') ? 'LIST' : (o.innerText || '').trim().slice(0, 30)));
const asked = p => p.evaluate(() => window.__asked.length);

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type C', list: { is_template: true, type_name: 'Type C', list_type: 'kitchen' } });
    const t = await X.dev(browser, S, 'office'), p = t.page, kb = p.keyboard; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    const esc = async () => { await kb.press('Escape'); await sleep(300); };
    const open = async wo => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; window.__confirm = false; openListEditor(null, wo); }, wo); await sleep(900); };

    // ---------- Esc with a dialog opened FROM "Start from…" ----------
    await open('WO-3');
    await p.click('#me-start summary'); await sleep(200); await p.click('#me-findold'); await sleep(600);
    let o = await ovls(p);
    rec('K1 set-up: Start from… → An old list… opens the finder over the list', o.length === 2 && o[0] === 'LIST', JSON.stringify(o));
    await esc(); o = await ovls(p);
    rec('K1: Esc in the old-list finder closes the FINDER only; the list window stays, nothing asked', o.length === 1 && o[0] === 'LIST' && !(await asked(p)), JSON.stringify([o, await p.evaluate(() => window.__asked)]));
    const stillOpen = await p.evaluate(() => document.getElementById('me-start').open);
    rec('[LOW] K1: …after the finder is closed with Esc, "Start from…" is not left hanging open (else a 2nd Esc only closes that, a 3rd closes the list)', !stillOpen, 'Start from open: ' + stillOpen);
    await esc(); if (stillOpen) await esc();
    rec('K1: …then Esc (nothing typed) closes the list window with no question', !(await ed(p)) && !(await asked(p)), JSON.stringify(await ovls(p)));
    // the finder's own search box has the cursor: Esc still closes the finder, not the list
    await open('WO-3');
    await p.evaluate(() => { document.getElementById('me-start').open = true; document.getElementById('me-findold').click(); }); await sleep(600);
    await p.evaluate(() => { const q = document.getElementById('fo-q'); if (q) q.focus(); }); await kb.type('House'); await sleep(200); await esc();
    o = await ovls(p);
    rec('K1b: typing in the finder\'s search box then Esc → finder closed, list window still open, nothing asked', o.length === 1 && o[0] === 'LIST' && !(await asked(p)), JSON.stringify(o));
    // "A template…" (Which template) from Start from
    await open('WO-3');
    await p.click('#me-start summary'); await sleep(200); await p.click('#me-instpl'); await sleep(700);
    o = await ovls(p);
    const tplOpen = o.length === 2;
    rec('K2 set-up: Start from… → A template… opens the template picker (project Aderrig has "Type C")', tplOpen, JSON.stringify(o));
    await esc(); o = await ovls(p);
    rec('K2: Esc in the template picker closes the PICKER only; list window stays, rows unchanged, nothing asked', o.length === 1 && o[0] === 'LIST' && !(await asked(p)) && (await rows(p)).length === 1, JSON.stringify([o, (await rows(p)).length]));
    rec('[LOW] K2: …and Start from… is closed again (one more Esc is not needed to close a panel)', await p.evaluate(() => !document.getElementById('me-start').open));
    await p.evaluate(() => { const d = document.getElementById('me-start'); d.open = false; });
    // Esc with More open while the cursor is in a GRID cell (not in More)
    await p.evaluate(() => { document.getElementById('me-more').open = true; document.querySelector('.me-ed [data-mr="0|item"]').focus(); });
    await kb.type('Side'); await esc();
    rec('K3: More ▾ open, cursor typing in a row, Esc → More closes, NO "close without saving?", the typed row kept', await ed(p) && !(await asked(p)) && (await rows(p))[0].item === 'Side' && await p.evaluate(() => !document.getElementById('me-more').open), JSON.stringify(await p.evaluate(() => window.__asked)));
    rec('[LOW] K3: …the cursor stays in the row being typed in (Esc moved it to the More ▾ heading — the next letters typed go nowhere)', /^0\|/.test(await foc(p)), await foc(p));
    // the Saved panel then Esc
    await setv(p, '0|qty', '2'); await save(p, 1800);
    await esc();
    rec('K4: Esc on the "Saved ✓" panel closes it; the list is saved once', !(await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)) && liveFor(S, 'WO-3').length === 1);

    // ---------- Tab from the LAST row, by kind ----------
    const tabFromLast = async (label, setup, expect) => {
      await open('WO-4'); await p.evaluate(() => { window.__confirm = true; });
      await setup();
      const n0 = (await rows(p)).length;
      await p.evaluate(() => { const rs = [...document.querySelectorAll('.me-ed [data-row]')], last = rs[rs.length - 1]; const cs = [...last.querySelectorAll('[data-mr]')].filter(e => !e.disabled && e.type !== 'hidden'); cs[cs.length - 1].focus(); });
      const from = await foc(p);
      await kb.press('Tab'); await sleep(250);
      const to = await foc(p), n1 = (await rows(p)).length;
      const out = { from, to, rows: n0 + '→' + n1, saved: !!(await donep(p)) || liveFor(S, 'WO-4').length > 0 };
      rec((expect.info ? '(info) ' : '') + 'K5 Tab from the last cell when the last row is ' + label + ' → ' + expect.txt, expect.ok(out), JSON.stringify(out));
      return out;
    };
    await tabFromLast('a filled HEADING ("Carcass")', async () => { await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.type('Side'); await click(p, 'me-addhdr'); await sleep(300);
      await p.evaluate(() => { const rs = [...document.querySelectorAll('.me-ed [data-row]')]; const e = rs[rs.length - 1].querySelector('[data-mr$="|item"]'); e.focus(); }); await kb.type('Carcass'); },
      { txt: 'a new part row under it (a heading needs parts), nothing saved', ok: o => /\|item$/.test(o.to) && /→/.test(o.rows) && +o.rows.split('→')[1] === +o.rows.split('→')[0] + 1 && !o.saved });
    await tabFromLast('an EMPTY heading (＋ Heading pressed, nothing typed)', async () => { await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.type('Side'); await click(p, 'me-addhdr'); await sleep(300); },
      { info: 1, txt: 'goes on to Save like an empty part row, not another row', ok: o => o.to === 'me-save' && !o.saved });
    await tabFromLast('a UNIT BLOCK heading with units', async () => { await p.evaluate(() => { const m = document.getElementById('me-more'); if (m) m.open = true; }); await sleep(100);
      const r = await p.evaluate(() => { const c = document.querySelector('#me-units'); if (c) { c.click(); return 'toggle'; } return 'none'; });
      await sleep(200); const b = await click(p, 'me-addunit'); await sleep(300);
      await p.evaluate(() => { const rs = [...document.querySelectorAll('.me-ed [data-row]')]; const e = rs[rs.length - 1].querySelector('[data-mr$="|item"]'); if (e) e.focus(); }); await kb.type('Unit 900'); },
      { txt: 'a new part row (the parts of ONE unit), nothing saved', ok: o => /\|item$/.test(o.to) && !o.saved });
    await tabFromLast('a part row with ONLY a material filled in by itself (auto material, nothing typed)', async () => {
      await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.type('Side'); await kb.press('Tab'); await kb.type('2'); await kb.press('Tab'); await kb.type('720'); await kb.press('Tab'); await kb.type('560'); await setv(p, '0|mat', 'MFC White');
      await p.evaluate(() => document.getElementById('me-addsaw') && document.getElementById('me-addsaw').click()); await sleep(300);
      // give the new row only a material (as the carcass default / previous-row carry would)
      await p.evaluate(() => { const rs = [...document.querySelectorAll('.me-ed [data-row]')]; const e = rs[rs.length - 1].querySelector('[data-mr$="|mat"]'); if (e) { e.value = 'MFC White'; e.dispatchEvent(new Event('change')); } }); },
      { txt: 'goes on to Save (the row is empty apart from the material)', ok: o => o.to === 'me-save' && !o.saved });
    // …and that row with only a material is NOT saved as a part
    await kb.press('Enter'); await sleep(2000);
    const l4 = liveFor(S, 'WO-4');
    rec('K6: Enter on Save → saved; the row with only a material is left out (1 part saved, not 2)', l4.length === 1 && linesOf(S, l4[0].id).length === 1, JSON.stringify([l4.length, l4[0] && linesOf(S, l4[0].id).map(x => x.part + '|' + x.material), await err(p)]));
    await closeAll(p);
    // Shift+Tab back from Save
    await open('WO-2'); await p.evaluate(() => { window.__confirm = true; });
    await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.type('Back'); await p.evaluate(() => document.getElementById('me-addsaw') && document.getElementById('me-addsaw').click()); await sleep(200);
    await p.evaluate(() => { const rs = [...document.querySelectorAll('.me-ed [data-row]')]; rs[rs.length - 1].querySelector('[data-mr$="|note"]').focus(); }); await kb.press('Tab'); await sleep(200);
    const atSave = await foc(p);
    await kb.press('Shift+Tab'); await sleep(200);
    const back = await foc(p), inw = await inWin(p);
    rec('K7: Shift+Tab from Save goes back INTO the list window (not off to the page behind)', atSave === 'me-save' && inw, JSON.stringify({ atSave, back }));
    rec('(info) K7: …it lands on: ' + back + ' (best: the last row\'s Note, where Tab came from)', /\|note$/.test(back), back);
    // Tab past Save: does the focus leave the window to the page behind?
    await p.evaluate(() => document.getElementById('me-save').focus());
    const trail = []; for (let i = 0; i < 6; i++) { await kb.press('Tab'); await sleep(80); trail.push((await inWin(p)) ? await foc(p) : 'OUTSIDE:' + await foc(p)); }
    rec('(info) K8: Tab on past Save stays inside the window (the page behind is not reachable)', !trail.some(x => /^OUTSIDE/.test(x)), trail.join(' → '));
    await closeAll(p);

    // ---------- ✕ asks exactly when something was typed ----------
    const xq = async (label, act, want) => {
      await open('WO-6'); await act();
      await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(300);
      const a = await asked(p), still = await ed(p);
      rec((label.startsWith('pressing') ? '(info) ' : '') + 'K9 ✕ after ' + label + ' → ' + (want ? 'ASKS "Close without saving?" (Cancel keeps it)' : 'closes at once, no question'), want ? a === 1 && still : a === 0 && !still, JSON.stringify({ asked: a, stillOpen: still }));
      await closeAll(p);
    };
    await xq('nothing', async () => {}, false);
    await xq('typing "Side" then deleting it again', async () => { await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.type('Side'); for (let i = 0; i < 4; i++) await kb.press('Backspace'); await sleep(150); }, false);
    await xq('only a List name typed', async () => { await p.evaluate(() => document.getElementById('me-name').focus()); await kb.type('Kitchen B'); }, true);
    await xq('only the Type changed under More', async () => { await p.evaluate(() => { document.getElementById('me-more').open = true; const s = document.getElementById('me-type'); s.value = s.value === 'room' ? 'other' : 'room'; s.dispatchEvent(new Event('change')); }); }, true);
    await xq('only "No cutting" ticked under More', async () => { await p.evaluate(() => { document.getElementById('me-more').open = true; const c = [...document.querySelectorAll('.me-ed input[type=checkbox]')].find(x => /cut/i.test((x.closest('label') || {}).innerText || '')); if (c) c.click(); }); }, true);
    await xq('pressing ＋ Row (an empty row, nothing typed)', async () => { await click(p, 'me-addsaw'); await sleep(150); }, false);
    await xq('rows put in with Start from… → An old list… → Use these rows', async () => {
      await p.evaluate(() => { document.getElementById('me-start').open = true; document.getElementById('me-findold').click(); }); await sleep(600);
      await p.evaluate(() => { const c = document.getElementById('fo-all'); if (c && !c.checked) c.click(); }); await sleep(300);
      await p.evaluate(() => { const b = document.querySelector('[data-foc]'); if (b) b.click(); }); await sleep(500); }, true);
    await xq('Use these rows and then Ctrl+Z (back to nothing)', async () => {
      await p.evaluate(() => { document.getElementById('me-start').open = true; document.getElementById('me-findold').click(); }); await sleep(600);
      await p.evaluate(() => { const c = document.getElementById('fo-all'); if (c && !c.checked) c.click(); }); await sleep(300);
      await p.evaluate(() => { const b = document.querySelector('[data-foc]'); if (b) b.click(); }); await sleep(500);
      await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|item"]').focus()); await kb.press('Control+z'); await sleep(300); }, false);
    // a saved list re-opened with "Edit it again" and closed untouched
    await open('WO-6'); await p.evaluate(() => { window.__confirm = true; }); await setv(p, '0|item', 'Hinge'); await setv(p, '0|qty', '4'); await save(p, 1800);
    await p.evaluate(() => document.getElementById('me-dagain').click()); await sleep(1000);
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(300);
    rec('K9 ✕ on a list re-opened with "Edit it again" and not touched → closes at once', !(await ed(p)) && !(await asked(p)));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
