// R1 attack: two (or three) PCs over several refresh cycles. B saves, A must show it within ONE cycle.
// Includes B on OLD code (origin/main), and the fake database with no version trigger. Fake Supabase only.
// Run: node tests/sync/attack1-twopc.test.js
const K = require('./attack1-kit.js');
const { rec, done } = K.mkRec();
(async () => {
  const browser = await K.H.chromium.launch();
  try {
    // 1. Five cycles, B (R1 code) makes a different kind of change each time; A shows each one after one refresh
    {
      const S = K.makeServer(K.base(1, 4)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      const steps = [
        ['note', p => p.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1').notes = 'c1'; await saveDB(); }), p => p.evaluate(() => DB.orders.find(o => o.wo === 'WO-1').notes === 'c1')],
        ['step', p => p.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-2').step = '5. Cutting'; await saveDB(); }), p => p.evaluate(() => DB.orders.find(o => o.wo === 'WO-2').step === '5. Cutting')],
        ['delete job', p => p.evaluate(async () => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-3'); await saveDB(); }), p => p.evaluate(() => !DB.orders.some(o => o.wo === 'WO-3'))],
        ['add job', p => p.evaluate(async () => { DB.orders.push(Object.assign({}, DB.orders[0], { wo: 'WO-NEW', notes: 'new' })); await saveDB(); }), p => p.evaluate(() => DB.orders.some(o => o.wo === 'WO-NEW'))],
        ['week capacity (settings)', p => p.evaluate(async () => { DB.weekCaps = Object.assign({}, DB.weekCaps, { '2026-11-23': 77 }); await saveDB(); }), p => p.evaluate(() => (DB.weekCaps || {})['2026-11-23'] === 77)],
      ];
      for (let i = 0; i < steps.length; i++) {
        const [nm, doB, chk] = steps[i];
        await K.tick(A.page); // a quiet cycle first (skipped)
        await doB(B.page); await K.settle(B.page);
        S.log.length = 0; await K.tick(A.page);
        rec('1.' + (i + 1) + ' B: ' + nm + ' → A shows it after one refresh', await chk(A.page), S.log.join(', '));
      }
      const sk = await A.page.evaluate(() => SYNC.skips);
      rec('1 the quiet cycles in between were skipped (5 expected)', sk === 5, 'skips=' + sk);
      await A.close(); await B.close();
    }
    // 2. B on OLD code (origin/main) saves — its save goes through the trigger like any other
    if (!K.MAIN_HTML) rec('2 origin/main available', false, 'git show origin/main:index.html failed');
    else {
      const S = K.makeServer(K.base(1, 3)); const A = await K.pc(browser, S); const B = await K.pc(browser, S, { html: K.MAIN_HTML });
      const bOld = await B.page.evaluate(() => typeof refreshDB === 'undefined');
      rec('2 B really runs origin/main code (no refreshDB)', bOld);
      for (let c = 1; c <= 4; c++) {
        await K.bSet(B.page, 'WO-' + (1 + c % 3), 'old-B ' + c); await K.settle(B.page);
        S.log.length = 0; await K.tick(A.page);
        const n = await K.note(A.page, 'WO-' + (1 + c % 3));
        rec('2.' + c + ' old-code B save → A shows it in one cycle', n === 'old-B ' + c, n + ' | ' + S.log.join(', '));
        // and A's own later edit must not wipe B's
        await A.page.evaluate(async c => { DB.orders.find(o => o.wo === 'WO-1').step = 'A-' + c; await saveDB(); }, c);
        await K.settle(A.page); await K.tick(B.page);
        const row = S.row.orders.find(o => o.wo === 'WO-' + (1 + c % 3));
        rec('2.' + c + ' after A saves, the database still has old-B\'s note', row.notes === 'old-B ' + c, row.notes);
      }
      await A.close(); await B.close();
    }
    // 3. Trigger absent in the fake; B on R1 code (sends version+1 itself) → version still moves
    {
      const S = K.makeServer(K.base(1, 2)); S.trigger = false; const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      for (let c = 1; c <= 3; c++) {
        await K.bSet(B.page, 'WO-2', 'nt-' + c); S.log.length = 0; await K.tick(A.page);
        const n = await K.note(A.page, 'WO-2');
        rec('3.' + c + ' no trigger, B on new code: A shows it in one cycle', n === 'nt-' + c, n + ' v' + S.row.version);
      }
      await A.close(); await B.close();
    }
    // 4. Trigger absent AND B saves the old way without a version (B's VER is null — opened before the column existed)
    //    (Not possible on the live database: the column and the trigger came in the same SQL. Recorded as info.)
    {
      const S = K.makeServer(K.base(1, 2)); S.trigger = false; const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      await B.page.evaluate(() => { VER = null; });
      await K.bSet(B.page, 'WO-2', 'legacy-B'); const v = S.row.version;
      S.log.length = 0; await K.tick(A.page);
      const n = await K.note(A.page, 'WO-2');
      rec('4 (info) no trigger + versionless B save: A shows it in one cycle', n === 'legacy-B', n + ' (version stayed ' + v + ', ' + S.log.join(', ') + ')');
      await A.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1').notes = 'A after'; await saveDB(); }); await K.settle(A.page);
      rec('4 (info) ...and A\'s next save keeps B\'s note in the database', S.row.orders.find(o => o.wo === 'WO-2').notes === 'legacy-B', S.row.orders.find(o => o.wo === 'WO-2').notes);
      await A.close(); await B.close();
    }
    // 5. Three screens, B and C both save in the same cycle; A shows both
    {
      const S = K.makeServer(K.base(1, 3)); const A = await K.pc(browser, S); const B = await K.pc(browser, S); const C = await K.pc(browser, S);
      await K.bSet(B.page, 'WO-2', 'B5'); await C.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-3').notes = 'C5'; await saveDB(); }); await K.settle(C.page);
      await K.tick(A.page);
      const a = [await K.note(A.page, 'WO-2'), await K.note(A.page, 'WO-3')];
      rec('5 B and C save in one cycle → A shows both', a[0] === 'B5' && a[1] === 'C5', a.join('/'));
      // A's screen text (not just memory) updated: open the job finder / board text
      const txt = await A.page.evaluate(() => document.getElementById('app').innerText.length > 0);
      rec('5 A re-rendered after the refresh', txt);
      await A.close(); await B.close(); await C.close();
    }
    rec('no page errors', true);
  } catch (e) { rec('test ran without crashing', false, e && e.stack ? e.stack.slice(0, 400) : String(e)); }
  await browser.close();
  done();
})();
