// Hotfix 17 Nov (Garry: "in the middle of creating a template … I go back to … select a previous line … it closed everything and
// I lose what I am working on"). The list window redraws itself when a material / edging is picked; a click that starts on a cell
// and lands after the redraw reached the grey background, which closed the window without asking. Now: the grey background never
// closes the list window, and Cancel asks when something was typed. Fake Supabase only. Run: node tests/hotfix/h17-window-stays-open.test.js
const F = require('../stage3/fix3.js');
const { sleep } = F;
const results = []; const rec = (n, ok, d) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await F.H.chromium.launch(); let S;
  try {
    S = F.makeServer(F.v2Row()); F.seedList(S, 'LX', { wos: [], name: 'x' });
    const t = await F.dev(browser, S, 'design'), p = t.page;
    await p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return !!window.__ok; }; });
    const open = async () => { await p.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__ed = openListEditor(null, '', 'P1', { tpl: true }); }); await sleep(600);
      await p.evaluate(() => { const r = window.__ed.st.rows; r[0].item = 'Side'; r[0].qty = '2'; r[0].L = '720'; r[0].W = '560'; r.push({ k: 'part', item: 'Back', qty: '1', L: '700', W: '500', mat: '', edging: '', edging2: '', note: '' }); window.__ed.draw(); }); await sleep(300); };
    const isOpen = () => p.evaluate(() => !!document.querySelector('.me-ed'));
    const box = sel => p.evaluate(sel => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    // 1. press on a previous row's cell; the window redraws before the mouse is let go (as when a material picked by keyboard commits on leaving the box)
    await open();
    const b = await box('.me-ed [data-mr="0|item"]'); await p.mouse.move(b.x, b.y); await p.mouse.down();
    await p.evaluate(() => window.__ed.draw()); await p.mouse.up(); await sleep(300);
    rec('a click on an earlier row while the window redraws → the window STAYS OPEN with the rows', await isOpen() && (await p.evaluate(() => window.__ed.st.rows.length)) === 2);
    // 1b. selecting text in a cell by dragging, and letting go past the edge of the window (on the grey)
    { const c = await box('.me-ed [data-mr="1|item"]'); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x, 3, { steps: 5 }); await p.mouse.up(); await sleep(300); }
    rec('dragging to select text in a cell and letting go on the grey → the window STAYS OPEN', await isOpen());
    if (!(await isOpen())) await open();
    // 2. a click on the grey background
    await p.mouse.click(4, 4); await sleep(300);
    rec('a click on the grey background does NOT close the list window', await isOpen());
    // 3. Cancel with rows typed → asked; No → stays
    await p.evaluate(() => { window.__ok = false; window.__asked = []; (document.querySelector('.me-ed #pod-x') || document.getElementById('me-x0')).click(); }); await sleep(200);
    const a3 = await p.evaluate(() => window.__asked.slice());
    rec('Cancel with rows typed → asks "Close without saving?"; answer No → still open', /without saving/i.test(a3.join(' ')) && await isOpen(), JSON.stringify(a3));
    await p.evaluate(() => { window.__ok = true; (document.querySelector('.me-ed #pod-x') || document.getElementById('me-x0')).click(); }); await sleep(200);
    rec('…answer Yes → closed', !(await isOpen()));
    // 4. Cancel on an untouched new window → closes without asking
    await p.evaluate(() => { window.__asked = []; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); openListEditor(null, '', 'P1', { tpl: true }); }); await sleep(600);
    await p.evaluate(() => (document.querySelector('.me-ed #pod-x') || document.getElementById('me-x0')).click()); await sleep(200);
    rec('Cancel on an untouched window closes straight away (no question)', !(await isOpen()) && !(await p.evaluate(() => window.__asked.length)));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = results.filter(x => !x).length; console.log(f + ' failed of ' + results.length); process.exit(f ? 1 : 0);
})();
