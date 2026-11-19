// R1 attack: every screen role, and the bytes actually downloaded over 30 minutes idle with a ~630 KB record
// (R1 vs origin/main). Fake Supabase only. Run: node tests/sync/attack1-roles-bytes.test.js
const K = require('./attack1-kit.js');
const { rec, done } = K.mkRec();
const KB = b => Math.round(b / 1024) + ' KB';
(async () => {
  const browser = await K.H.chromium.launch();
  try {
    // 1. Every role: quiet refreshes are skipped, B's save is shown after one refresh, nothing saved by a quiet refresh
    for (const role of ['office', 'floor', 'driver', 'saw', 'stores', 'dash', 'pm', 'prod', 'design']) {
      const S = K.makeServer(K.base(1, 3)); const B = await K.pc(browser, S); const A = await K.pc(browser, S, { role }); // B first: its office start-up save lands before A loads
      const r0 = await A.page.evaluate(() => ROLE);
      S.log.length = 0; S.patches.length = 0;
      for (let i = 0; i < 3; i++) await K.tick(A.page);
      const calm = await A.page.evaluate(() => ({ calm: syncCalm(), skips: SYNC.skips }));
      rec('1 ' + role + ': 3 quiet refreshes → no full download, no save', r0 === role && K.fullGets(S) === 0 && S.patches.length === 0, 'ROLE ' + r0 + ' ' + JSON.stringify(calm) + ' ' + S.log.join(', '));
      await K.bSet(B.page, 'WO-2', 'for ' + role);
      await K.tick(A.page);
      rec('1 ' + role + ': B\'s save shown after one refresh', await K.note(A.page, 'WO-2') === 'for ' + role);
      await A.close(); await B.close();
    }
    // 2. Bytes over 30 minutes idle (15 refreshes), ~630 KB record — R1 vs main
    const out = {};
    for (const code of ['R1', 'main']) {
      if (code === 'main' && !K.MAIN_HTML) continue;
      const S = K.makeServer(K.bigRow(1)); const A = await K.pc(browser, S, code === 'main' ? { html: K.MAIN_HTML } : {});
      // between refreshes a real screen sits idle for 2 minutes and the browser tidies its memory; back-to-back test
      // refreshes don't give it that time, so tidy explicitly (without this the test tab runs out of memory — test artifact)
      const cdp = await A.ctx.newCDPSession(A.page); await cdp.send('HeapProfiler.enable'); const gc = () => cdp.send('HeapProfiler.collectGarbage');
      S.bytes = 0; S.log.length = 0;
      for (let i = 0; i < 15; i++) { await K.tick(A.page); await gc(); }
      out[code] = { bytes: S.bytes, fulls: K.fullGets(S), checks: K.verGets(S), size: JSON.stringify([S.row]).length };
      // 2b. with B saving every 6 minutes for 30 minutes (5 saves)
      const B = await K.pc(browser, S); S.bytes = 0; S.log.length = 0; const bb = [];
      for (let i = 0; i < 15; i++) { if (i % 3 === 2) { await K.bSet(B.page, 'WO-1000', 'busy ' + i); bb.push(i); } await K.tick(A.page); await gc(); }
      out[code].busy = { bytes: S.bytes, fulls: K.fullGets(S) };
      out[code].last = await K.note(A.page, 'WO-1000');
      await A.close(); await B.close();
    }
    console.log('BYTES ' + JSON.stringify(out));
    if (out.R1) {
      rec('2 R1 idle 30 min: record ' + KB(out.R1.size) + ', downloaded ' + KB(out.R1.bytes) + ' (' + out.R1.fulls + ' full, ' + out.R1.checks + ' checks)' + (out.main ? ' vs main ' + KB(out.main.bytes) + ' (' + out.main.fulls + ' full)' : ''), out.R1.fulls <= 3 && (!out.main || out.R1.bytes < out.main.bytes / 4));
      rec('2 R1 B saving every 6 min: ' + KB(out.R1.busy.bytes) + ' (' + out.R1.busy.fulls + ' full)' + (out.main ? ' vs main ' + KB(out.main.busy.bytes) : '') + '; A has B\'s last note', out.R1.last === 'busy 14' && out.R1.busy.fulls <= 7);
    }
  } catch (e) { rec('test ran without crashing', false, e && e.stack ? e.stack.slice(0, 500) : String(e)); }
  await browser.close();
  done();
})();
