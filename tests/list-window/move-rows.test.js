// Garry 13 Nov: "i would like to be able to move around line in the cutting lists" — every row of the list window has ▲ ▼.
// Fake Supabase only. Run: node tests/list-window/move-rows.test.js
const F = require('../stage3/fix3.js'); const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const J = JSON.stringify;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { wos: ['WO-1'], name: 'House 18' });
  for (const vp of [{ width: 1400, height: 900 }, { width: 380, height: 800 }]) {
    const tag = vp.width > 700 ? 'PC' : 'phone';
    const t = await F.dev(browser, S, 'office', { viewport: vp }); const p = t.page;
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.evaluate(async () => { window.confirm = () => true; window.prompt = () => 'put in cutting order'; setWho('Ann'); showTab('l'); render(); await new Promise(r => setTimeout(r, 150)); document.querySelector('[data-lhedit="L1"]').click(); await new Promise(r => setTimeout(r, 300)); });
    const items = () => p.evaluate(() => [...document.querySelectorAll('[data-mr$="|item"]')].map(i => i.value));
    const a = await items();
    rec(tag + ': the list opens with its rows, each with ▲ ▼', a.length >= 4 && await p.evaluate(n => document.querySelectorAll('[data-mup]').length === n && document.querySelectorAll('[data-mdn]').length === n, a.length), J(a));
    rec(tag + ': first row cannot go up, last cannot go down', await p.evaluate(n => document.querySelector('[data-mup="0"]').disabled && document.querySelector('[data-mdn="' + (n - 1) + '"]').disabled && !document.querySelector('[data-mdn="0"]').disabled, a.length));
    await p.evaluate(() => document.querySelector('[data-mdn="1"]').click());
    const b = await items(); const exp = a.slice(); [exp[1], exp[2]] = [exp[2], exp[1]];
    rec(tag + ': ▼ moves the row down one place', J(b) === J(exp), J(b));
    await p.evaluate(() => document.querySelector('[data-mup="2"]').click());
    rec(tag + ': ▲ moves it back up', J(await items()) === J(a));
    await p.evaluate(() => { document.querySelector('[data-mdn="1"]').click(); });
    await p.evaluate(() => { const u = document.getElementById('me-undo'); u && u.click(); });
    rec(tag + ': ↶ Undo puts it back', J(await items()) === J(a), J(await items()));
    if (tag === 'PC') {
      const box = await p.evaluate(() => { const r = document.querySelector('tr[data-row="1"]'); const x = r.querySelector('.me-x').getBoundingClientRect(), u = r.querySelector('[data-mup]').getBoundingClientRect(); return { sameLine: Math.abs(x.top - u.top) < 6, h: r.getBoundingClientRect().height }; });
      rec('PC: ▲ ▼ ✕ sit on one line, the row is not taller', box.sameLine && box.h < 60, J(box));
      await p.screenshot({ path: '/tmp/move-rows-pc.png' });
      // move, save, reopen: the order is kept
      await p.evaluate(() => document.querySelector('[data-mdn="1"]').click());
      const want = await items();
      await p.evaluate(async () => { document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2000)); });
      const saved = await p.evaluate(() => listRows(lsList('L1')).map(r => r.item));
      const dbo = S.db.t.list_lines.filter(l => l.list_id === 'L1' && l.removed_rev == null).sort((a, b) => a.seq - b.seq).map(l => l.part);
      rec('PC: the new order is saved (screen and database)', J(saved) === J(want) && J(dbo) === J(want), J({ saved, dbo, want, err: await p.evaluate(() => (document.getElementById('me-err') || {}).textContent || '') }));
    }
    rec(tag + ': no page errors', errs.length === 0, errs.join(' | '));
    await t.ctx.close ? await t.ctx.close() : await p.close();
  }
  await browser.close(); S.close && S.close();
  console.log(`\n${res.filter(Boolean).length} passed, ${res.filter(x => !x).length} failed`);
  process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
