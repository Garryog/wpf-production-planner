// R1 attack: timing and odd states around the quick version check. Fake Supabase only.
// Typing / dialog / import review / photo upload while B saves; A's save in flight; A's save reply lost (UNSURE);
// clock jump; hidden an hour; version going DOWN (database restored); non-number versions; midnight counters.
// Run: node tests/sync/attack1-races.test.js
const K = require('./attack1-kit.js');
const { rec, done } = K.mkRec();
const both = async (S, wo, want) => { const r = S.row.orders.find(o => o.wo === wo); return r && r.notes === want; };
(async () => {
  const browser = await K.H.chromium.launch();
  try {
    // A. Blockers: A typing, a dialog, an import review, a photo upload — refresh waits; once clear, ONE refresh shows B
    for (const [nm, on, off] of [
      ['typing in a box', p => p.evaluate(() => { const i = document.createElement('input'); i.id = 'zz'; document.body.appendChild(i); i.focus(); }), p => p.evaluate(() => { document.getElementById('zz').remove(); })],
      ['a dialog open', p => p.evaluate(() => { const o = document.createElement('div'); o.className = 'pod-ovl'; o.id = 'zz'; document.body.appendChild(o); }), p => p.evaluate(() => document.getElementById('zz').remove())],
      ['import review open', p => p.evaluate(() => { IMPPLAN = { fake: 1 }; }), p => p.evaluate(() => { IMPPLAN = null; })],
      ['driver photo uploading', p => p.evaluate(() => { drvUploading = true; }), p => p.evaluate(() => { drvUploading = false; })],
    ]) {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      await on(A.page);
      await K.bSet(B.page, 'WO-2', 'B ' + nm); S.log.length = 0;
      const t1 = await K.tick(A.page);
      const n1 = await K.note(A.page, 'WO-2');
      rec('A ' + nm + ': the refresh waits (nothing downloaded, nothing applied)', !t1.ran && S.log.length === 0 && n1 === '', JSON.stringify(t1) + ' ' + S.log.join(','));
      await off(A.page); S.log.length = 0; await K.tick(A.page);
      rec('A ' + nm + ': once clear, the very next refresh shows B\'s change', await K.note(A.page, 'WO-2') === 'B ' + nm, S.log.join(', '));
      await A.close(); await B.close();
    }
    // B. A's save in flight (held) when the refresh runs; B saved just before. Nothing lost; A shows B's note after.
    {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      let rel; const hold = new Promise(r => rel = r);
      await A.page.route(/production_planner\?id=eq\.main&version=eq/, async r => { if (r.request().method() === 'PATCH' && !S.released) await hold; return r.fallback(); });
      await A.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').notes = 'A in flight'; window.__sp = saveDB(); });
      await K.sleep(150);
      await K.bSet(B.page, 'WO-2', 'B while A saves');
      const tk = K.tick(A.page);
      await K.sleep(400); S.released = true; rel(); await tk;
      await A.page.evaluate(() => window.__sp); await K.settle(A.page);
      S.log.length = 0; await K.tick(A.page);
      rec('B save in flight during the check: database keeps A\'s and B\'s notes', await both(S, 'WO-1', 'A in flight') && await both(S, 'WO-2', 'B while A saves'), JSON.stringify(S.row.orders.map(o => o.notes)));
      rec('B …and A shows B\'s note', await K.note(A.page, 'WO-2') === 'B while A saves');
      await A.close(); await B.close();
    }
    // C. A saves WHILE the version request is out (reply held), B saves too, reply says the old number
    {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      const v0 = S.row.version; let rel; S.verHold = new Promise(r => rel = r); S.verOverride = v0;
      const tk = K.tick(A.page); await K.sleep(200);
      await K.bSet(B.page, 'WO-2', 'B during check');
      await A.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1').notes = 'A during check'; await saveDB(); });
      rel(); S.verHold = null; delete S.verOverride; await tk; await K.settle(A.page);
      rec('C check out while A and B save: database keeps both', await both(S, 'WO-1', 'A during check') && await both(S, 'WO-2', 'B during check'), JSON.stringify(S.row.orders.map(o => o.notes)));
      S.log.length = 0; await K.tick(A.page);
      rec('C …A shows B\'s note by the next refresh', await K.note(A.page, 'WO-2') === 'B during check', S.log.join(', '));
      await A.close(); await B.close();
    }
    // D. A's save LANDS but the reply is lost and the database can't be reached for ~6 s (stays UNSURE); B saves after
    {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      await A.page.route(/production_planner\?id=eq\.main&version=eq/, async r => {
        if (r.request().method() !== 'PATCH' || S.lostDone) return r.fallback();
        S.lostDone = true; const body = JSON.parse(r.request().postData()); const before = S.row.version; Object.assign(S.row, body); S.row.version = before + 1;
        S.offline = true; setTimeout(() => { S.offline = false; }, 6500); return r.abort('connectionreset');
      });
      await A.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1').notes = 'A unsure'; try { await saveDB(); } catch (e) {} });
      await K.sleep(7000);
      const u = await A.page.evaluate(() => ({ unsure: UNSURE.length, sf: DB.saveFailed, saveT: !!saveT }));
      await K.bSet(B.page, 'WO-2', 'B after unsure');
      S.log.length = 0; await K.tick(A.page); await K.sleep(1500); await K.settle(A.page); await K.tick(A.page); await K.settle(A.page);
      rec('D A unsure (' + JSON.stringify(u) + '), B saves: database keeps both', await both(S, 'WO-1', 'A unsure') && await both(S, 'WO-2', 'B after unsure'), JSON.stringify(S.row.orders.map(o => o.notes)));
      rec('D …A shows B\'s note', await K.note(A.page, 'WO-2') === 'B after unsure');
      await A.close(); await B.close();
    }
    // E. Version going DOWN (whole database restored from a backup): compare with origin/main
    for (const code of ['R1', 'main']) {
      if (code === 'main' && !K.MAIN_HTML) continue;
      const S = K.makeServer(K.base(10, 2)); const o = code === 'main' ? { html: K.MAIN_HTML } : {};
      const A = await K.pc(browser, S, o);
      await K.bSet(A.page, 'WO-1', 'pre-restore A'); await K.settle(A.page);
      const vA = await A.page.evaluate(() => VER);
      S.row = JSON.parse(JSON.stringify(K.base(5, 2))); S.row.orders[1].notes = 'restored'; // restore: version 5, A holds vA
      await K.tick(A.page);
      const shows = await K.note(A.page, 'WO-2');
      rec('E ' + code + ' (info) restore to a LOWER version: A shows the restored plan after one refresh', shows === 'restored', 'A shows "' + shows + '", A VER ' + vA + ' vs db 5');
      // Now other screens save until the number catches up with A's (B opens fresh on the restored record)
      const B = await K.pc(browser, S, o);
      while (S.row.version < vA) { await K.bSet(B.page, 'WO-2', 'B after restore v' + (S.row.version + 1)); await K.settle(B.page); }
      const want = S.row.orders[1].notes;
      await K.tick(A.page, 120000);
      const a2 = await K.note(A.page, 'WO-2');
      rec('E ' + code + ' version back at A\'s number with DIFFERENT content: A shows it after one refresh', a2 === want, 'A: "' + a2 + '" db: "' + want + '" v' + S.row.version);
      await A.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1').step = '9. A edit'; await saveDB(); }); await K.settle(A.page);
      const r = S.row.orders;
      rec('E ' + code + ' …A then saves an edit: B\'s post-restore note survives', r[1].notes === want, 'db WO-2: "' + r[1].notes + '" (B wrote "' + want + '")');
      rec('E ' + code + ' …and the restore is not undone (WO-1 not back to "pre-restore A")', r[0].notes !== 'pre-restore A', 'db WO-1: "' + r[0].notes + '"');
      await A.close(); await B.close();
    }
    // F. Odd version replies (row content unchanged unless said): never skip when the record changed
    for (const [nm, val] of [['"abc"', 'abc'], ['null', null], ['0', 0], ['-1', -1], ['{}', {}], ['decimal 1.5', 1.5], ['string of the same number', 'SAME'], ['true', true], ['huge', 9007199254740993]]) {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      await K.bSet(B.page, 'WO-2', 'odd ' + nm);
      const aV = await A.page.evaluate(() => VER);
      S.verOverride = val === 'SAME' ? String(aV) : val;
      S.log.length = 0; await K.tick(A.page);
      const n = await K.note(A.page, 'WO-2'), err = await A.page.evaluate(() => document.getElementById('stxt').textContent);
      const skipped = K.fullGets(S) === 0;
      if (val === 'SAME') rec('F version reply ' + nm + ' while the record changed: (info) skipped → A misses it until the 10-min load', skipped, 'A note "' + n + '"');
      else if (val === true) rec('F version reply true (A at v' + aV + '): full load, not a skip', !skipped && n === 'odd ' + nm, S.log.join(', ') + ' note "' + n + '"');
      else rec('F version reply ' + nm + ': full load, B\'s change shown, status "' + err + '"', !skipped && n === 'odd ' + nm && /Synced/.test(err), S.log.join(', '));
      await A.close(); await B.close();
    }
    // G. Clock jumps BACK an hour after a full load: the 10-minute safety net must still come round
    {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S);
      await K.tick(A.page, 11 * 60000); // full load (lastFull now)
      await A.page.evaluate(() => { window.__off -= 3600000; });
      let fulls = 0; S.log.length = 0;
      for (let i = 0; i < 6; i++) { await K.tick(A.page); } fulls = K.fullGets(S);
      rec('G clock set back 1 h: a safety-net full load within the next 12 minutes', fulls >= 1, fulls + ' full loads in 6 cycles (12 min)');
      // and the version check still catches changes
      const B = await K.pc(browser, S); await K.bSet(B.page, 'WO-2', 'after clock'); await K.tick(A.page);
      rec('G …the version check still shows B\'s change', await K.note(A.page, 'WO-2') === 'after clock');
      await A.close(); await B.close();
    }
    // H. Tab hidden for an hour, B saved 5 times meanwhile; first refresh after → latest shown
    {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      for (let i = 1; i <= 5; i++) await K.bSet(B.page, 'WO-2', 'hidden ' + i);
      S.log.length = 0; await K.tick(A.page, 3600000);
      rec('H hidden an hour: first refresh after shows B\'s latest', await K.note(A.page, 'WO-2') === 'hidden 5', S.log.join(', '));
      await A.close(); await B.close();
    }
    // I. Midnight: the "today" counters reset; the safety net is unaffected
    {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S);
      await K.tick(A.page); await K.tick(A.page);
      const r = await A.page.evaluate(() => { SYNC.day = 'Mon Jan 01 2001'; const h = syncSpeedHTML(); return { h, s: SYNC.skips, f: SYNC.fulls }; });
      rec('I new day: counters start again at 0', r.s === 0 && r.f === 0 && /<b data-sync="skips">0<\/b>/.test(r.h), JSON.stringify({ s: r.s, f: r.f }));
      await A.close();
    }
    // J. Lists switches flipped from another PC (listChk / photoLists / listDelOnly)
    {
      const S = K.makeServer(K.base(1, 2)); const A = await K.pc(browser, S); const B = await K.pc(browser, S);
      await B.page.evaluate(async () => { DB.listChk = true; DB.photoLists = false; DB.listDelOnly = true; await saveDB(); });
      await K.tick(A.page);
      const a = await A.page.evaluate(() => ({ c: DB.listChk, p: DB.photoLists, d: DB.listDelOnly }));
      rec('J list switches set on B → A has them after one refresh', a.c === true && a.p === false && a.d === true, JSON.stringify(a));
      await B.page.evaluate(async () => { DB.listChk = false; await saveDB(); }); await K.tick(A.page);
      rec('J …and switched back off', await A.page.evaluate(() => DB.listChk) === false);
      await A.close(); await B.close();
    }
  } catch (e) { rec('test ran without crashing', false, e && e.stack ? e.stack.slice(0, 500) : String(e)); }
  await browser.close();
  done();
})();
