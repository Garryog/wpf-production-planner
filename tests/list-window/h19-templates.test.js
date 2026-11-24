// Hotfix 19 Nov 2026 (Garry, live): "the edit button for the cutting lists templates is gone. i need that button" and
// "i need the last features i had for creating templates". Since the list window went live (18 Nov) the Office screen had no
// ✎ Edit / Archive on a template, no 📐 Save as template (Lists rows or the list window), no ＋ New template and no
// ⧉ Copy from another project. This file checks each is back and WORKS on the Office screen (PIN typed when asked, as before),
// on the Drawing office and Production Manager screens (no PIN), and that the data-safety guards still hold:
// a template's rows are loaded before the window shows them, a save that takes away most rows is asked first, and a wrong /
// remembered PIN still opens nothing. Fake Supabase only.   Run: node tests/list-window/h19-templates.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, ed, asks, setid, setv, fillSaw, save, rows, linesOf } = L;
const FD = require('../stores-docket/fixd.js');
const tpls = S => S.db.t.lists.filter(l => l.is_template && !l.archived);
const TL = [['hdr', '900 Base', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Shelf', '1', 864, 540, 'MFC White', '', ''],
  ['saw', 'Back', '1', 864, 700, 'MFC White', '', ''], ['fit', 'Hinge', '4', null, null, 'Blum hinge', '', '']];
// show the Cutting Lists page on project P1's templates
const tplPage = p => p.evaluate(async () => { try { if (ROLE === 'prod') { prodTab = 'lists'; render(); } else showTab('l'); } catch (e) {} await new Promise(r => setTimeout(r, 300)); lpfSet('P1'); LH.kind = 'tpl'; LH.q = ''; LH.state = ''; render(); await new Promise(r => setTimeout(r, 300)); });
const has = (p, sel) => p.evaluate(sel => { const b = document.querySelector(sel); return !!b && b.getBoundingClientRect().width > 0; }, sel);
const clickSel = (p, sel) => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) return 'no ' + sel; b.click(); return 'ok'; }, sel);
// every PIN question is answered with `pin` (null = Cancel); every other prompt ("what changed") with a reason
const answer = (p, pin) => p.evaluate(pin => { window.__prompted = []; window.__prompt = m => /PIN/.test(m) ? pin : 'h19 change'; window.__confirm = true; }, pin);
const pinAsks = p => p.evaluate(() => window.__prompted.filter(m => /PIN/.test(m)).length);
const top = p => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    for (const role of ['office', 'design', 'prod']) {
      const pinScreen = role === 'office'; // the Office screen is asked for the PIN at the click; the other two are not
      const S = X.makeServer(X.v2Row());
      X.F3.seedList(S, 'T1', { wos: [], name: 'Type B', lines: TL, list: { is_template: true, type_name: 'Type B', list_type: 'kitchen', project_id: 'P1' } });
      const t = await X.dev(browser, S, role), p = t.page; await asks(p);
      await p.evaluate(async () => { localStorage.removeItem('wpfEditPin'); lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
      const PIN = await p.evaluate(() => pins()), good = role === 'office' ? PIN.admin : null;
      const R = role + ': ';

      // ---- 1. the buttons are on the page again
      await tplPage(p);
      rec(R + 'template row shows ✎ Edit', await has(p, '[data-lhedit="T1"]'));
      rec(R + 'template row shows Archive', await has(p, '[data-lharc="T1"]'));
      rec(R + 'template row shows 📐 Save as template', await has(p, '[data-lhastpl="T1"]'));
      rec(R + 'Templates view shows ＋ New template', await has(p, '#lh-newtpl'));
      rec(R + 'Templates view shows ⧉ Copy from another project', await has(p, '#lh-copy'));
      const rowL1 = await p.evaluate(async () => { LH.kind = 'live'; render(); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector('[data-lhastpl="L1"]'); return !!b; });
      rec(R + 'a live list row shows 📐 Save as template', rowL1);

      // ---- 2. ✎ Edit a template: wrong PIN → nothing; good PIN → opens WITH its rows; change one row → saved as the next revision
      await tplPage(p);
      if (pinScreen) {
        await answer(p, '0000'); await clickSel(p, '[data-lhedit="T1"]'); await sleep(1500);
        rec(R + '✎ Edit with a WRONG PIN → asked, nothing opens', (await pinAsks(p)) === 1 && !(await ed(p)));
        await closeAll(p);
        await p.evaluate(P => localStorage.setItem('wpfEditPin', P.admin), PIN); await answer(p, null);
        await clickSel(p, '[data-lhedit="T1"]'); await sleep(1500);
        rec(R + '✎ Edit with the Admin PIN only REMEMBERED on the PC → still asked; Cancel opens nothing (Garry Q12 rule kept)', (await pinAsks(p)) === 1 && !(await ed(p)));
        await p.evaluate(() => localStorage.removeItem('wpfEditPin')); await closeAll(p);
      }
      const rev0 = +(S.db.t.lists.find(l => l.id === 'T1').rev || 1);
      await answer(p, good); await clickSel(p, '[data-lhedit="T1"]'); await sleep(1800);
      const rs = await rows(p);
      rec(R + '✎ Edit opens the template window ' + (pinScreen ? '(PIN asked once)' : '(no PIN asked)') + ' with all ' + TL.length + ' rows loaded',
        (await ed(p)) && rs.length === TL.length && (await pinAsks(p)) === (pinScreen ? 1 : 0), JSON.stringify({ rows: rs.length, asked: await pinAsks(p) }));
      const si = rs.findIndex(r => r.item === 'Shelf');
      await setv(p, si + '|qty', '3'); await save(p, 2200); await closeAll(p);
      const shelf = linesOf(S, 'T1').find(x => x.part === 'Shelf'), tNow = S.db.t.lists.find(l => l.id === 'T1');
      rec(R + 'edited template saved: Shelf qty 3, every row still there, revision went up', shelf && String(shelf.qty) === '3' && linesOf(S, 'T1').length === TL.length && +tNow.rev > rev0,
        JSON.stringify({ qty: shelf && shelf.qty, rows: linesOf(S, 'T1').length, rev: tNow.rev }));

      // ---- 3. data safety kept: a template save that takes away most rows is asked first; Cancel saves nothing
      const before = JSON.stringify(linesOf(S, 'T1').map(x => [x.part, x.qty]));
      await answer(p, good); await clickSel(p, '[data-lhedit="T1"]'); await sleep(1800);
      for (let i = 0; i < 4; i++) await p.evaluate(() => { const b = document.querySelector('.me-ed [data-mrx]'); if (b) b.click(); });
      const left = (await rows(p)).length;
      await p.evaluate(() => { window.__asked = []; window.__confirm = m => !/TAKES AWAY/.test(m); });
      await save(p, 2200);
      const askedShrink = await p.evaluate(() => window.__asked.some(m => /TAKES AWAY/.test(m)));
      rec(R + 'template edit that takes rows away → "This save TAKES AWAY …" asked; Cancel → template unchanged',
        left < TL.length && askedShrink && JSON.stringify(linesOf(S, 'T1').map(x => [x.part, x.qty])) === before, JSON.stringify({ left, askedShrink }));
      await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

      // ---- 4. ＋ New template from the Lists page → a new template in the database
      await tplPage(p);
      const n0 = tpls(S).length;
      await answer(p, good); await clickSel(p, '#lh-newtpl'); await sleep(900);
      const opened = await ed(p);
      if (opened) { await setid(p, 'me-name', 'H19 ' + role); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await save(p, 2000); }
      await closeAll(p);
      const made = tpls(S).find(l => l.name === 'H19 ' + role);
      rec(R + '＋ New template → window opens' + (pinScreen ? ' after the PIN' : '') + ', Save makes the template in project P1 with its row',
        opened && tpls(S).length === n0 + 1 && made && made.project_id === 'P1' && linesOf(S, made.id).some(x => x.part === 'Side'), JSON.stringify({ opened, made: made && made.name }));

      // ---- 5. 📐 Save as template from a live list row (L1) → the dialog → a new template from its rows
      await p.evaluate(async () => { LH.kind = 'live'; render(); await new Promise(r => setTimeout(r, 200)); });
      await answer(p, good); await clickSel(p, '[data-lhastpl="L1"]'); await sleep(1200);
      const dlg = await p.evaluate(() => !!document.getElementById('at-ok'));
      if (dlg) { await p.evaluate(n => { const e = document.getElementById('at-name'); e.value = n; (e.oninput || (() => {}))({ target: e }); e.dispatchEvent(new Event('input')); document.getElementById('at-ok').click(); }, 'From L1 ' + role); await sleep(2000); }
      const fromL1 = tpls(S).find(l => (l.type_name || l.name) === 'From L1 ' + role || l.name === 'From L1 ' + role);
      rec(R + 'Lists row 📐 Save as template → dialog → template saved with the list\'s rows (ticks not copied)', dlg && fromL1 && ['Tap', 'Hinge', 'Side', 'Worktop'].every(n => linesOf(S, fromL1.id).some(x => x.part === n)) && linesOf(S, fromL1.id).every(x => !x.status || x.status === 'todo'),
        JSON.stringify({ dlg, made: fromL1 && fromL1.name, n: fromL1 && linesOf(S, fromL1.id).length, top: (await top(p)).slice(0, 120) }));
      await closeAll(p);

      // ---- 6. 📐 Save as template from the list window (a new list for WO-3, rows not yet saved)
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
      const btn = await has(p, '#me-astpl');
      await fillSaw(p, 0, 'Window row', '1', '500', '300', 'MFC White');
      await answer(p, good); await clickSel(p, '#me-astpl'); await sleep(1200);
      const dlg2 = await p.evaluate(() => !!document.getElementById('at-ok'));
      if (dlg2) { await p.evaluate(n => { const e = document.getElementById('at-name'); e.value = n; (e.oninput || (() => {}))({ target: e }); e.dispatchEvent(new Event('input')); document.getElementById('at-ok').click(); }, 'From window ' + role); await sleep(2000); }
      const fromW = tpls(S).find(l => l.name === 'From window ' + role || l.type_name === 'From window ' + role);
      rec(R + 'list window shows 📐 Save as template; it saves the unsaved rows as a template', btn && dlg2 && fromW && linesOf(S, fromW.id).some(x => x.part === 'Window row'), JSON.stringify({ btn, dlg2, made: fromW && fromW.name }));
      await closeAll(p);

      // ---- 7. ⧉ Copy from another project opens (PIN on the Office screen) — and a wrong PIN opens nothing
      await tplPage(p);
      if (pinScreen) { await answer(p, '0000'); await clickSel(p, '#lh-copy'); await sleep(500);
        rec(R + '⧉ Copy from another project with a wrong PIN → nothing opens', !(await p.evaluate(() => document.querySelectorAll('.pod-ovl').length))); await closeAll(p); }
      await answer(p, good); await clickSel(p, '#lh-copy'); await sleep(700);
      rec(R + '⧉ Copy from another project opens its window', (await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)) > 0, (await top(p)).slice(0, 120));
      await closeAll(p);

      // ---- 8. Archive a template (confirm asked; nothing deleted)
      await tplPage(p);
      await answer(p, good); await p.evaluate(() => { window.__asked = []; }); const arcBtn = await clickSel(p, '[data-lharc="T1"]'); for (let i = 0; i < 30 && !S.db.t.lists.find(l => l.id === 'T1').archived; i++) await sleep(200);
      const T1 = S.db.t.lists.find(l => l.id === 'T1');
      rec(R + 'Archive on a template → asked first, archived, its rows kept', T1 && T1.archived && (await p.evaluate(() => window.__asked.some(m => /Archive/.test(m)))) && linesOf(S, 'T1').length === TL.length, JSON.stringify({ arcBtn, archived: T1 && T1.archived, asked: await p.evaluate(() => window.__asked), pr: await p.evaluate(() => window.__prompted) }));

      rec(R + 'no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.ctx.close().catch(() => {});
    }
    // the shop floor still never sees template buttons
    const S = X.makeServer(X.v2Row()); const t = await X.dev(browser, S, 'saw');
    rec('saw screen: lsTplBtnOk() is false (shop floor never had template buttons)', (await t.page.evaluate(() => lsTplBtnOk())) === false);
    await t.ctx.close().catch(() => {});
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
