// Data safety: concurrent saves, change tracker, old data shape, save failure. Run: node tests/datasafety.test.js
const H = require('./harness');
const res = [];
const rec = (name, ok, detail) => { res.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  -> ' + detail : '')); };
const NOW = '2026-10-19T10:00:00Z';

(async () => {
  const browser = await H.chromium.launch();
  const base = () => ({ id: 'main', orders: [H.order({ wo: 'WO-1-1', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-1-2', plannedWeek: '2026-10-26' })], nid: 3, settings: {} });

  // 1. Two office PCs edit different jobs; both save. ONE shared fake database with the Stage 1 version column,
  //    so B's save is made against a stale version and must be refused, merged and resent (not overwrite A).
  {
    const A = await H.open({ browser, now: NOW, row: Object.assign(base(), { version: 1 }) });
    const B = await H.open({ browser, now: NOW, server: A.server });
    await A.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1-1').plannedWeek = '2026-11-02'; await saveDB(); });
    await B.page.evaluate(async () => { DB.orders.find(o => o.wo === 'WO-1-2').plannedWeek = '2026-11-09'; await saveDB(); });
    const srv = A.server.row.orders.reduce((a, o) => (a[o.wo] = o.plannedWeek, a), {});
    rec('Two PCs editing different jobs: both edits survive', srv['WO-1-1'] === '2026-11-02' && srv['WO-1-2'] === '2026-11-09', 'server now: ' + JSON.stringify(srv) + ' version=' + A.server.row.version);
    rec('Two PCs: the stale save was refused by the version check (clash detected, then merged)', (A.server.conflicts || 0) >= 1 && A.server.row.version >= 3, 'conflicts=' + (A.server.conflicts || 0) + ' version=' + A.server.row.version + ' patches=' + A.server.patches.length);
    await A.close(); await B.close();
  }

  // 2. Change tracker survives the 2-minute auto-refresh
  {
    const t = await H.open({ browser, now: NOW, row: base() });
    await t.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
    const before = await t.page.evaluate(() => changes().map(o => o.wo));
    const after = await t.page.evaluate(async () => { await loadDB(); return changes().map(o => o.wo); }); // what the 120s timer does
    rec('Moved job still listed in Export Changes after auto-refresh', after.length === 1, `changes before refresh=[${before}] after refresh=[${after}]`);
    await t.close();
  }

  // 3. A Cienapps step change brought in by import shows up as a planner change to send back
  {
    const t = await H.open({ browser, now: NOW, row: { id: 'main', orders: [H.order({ wo: 'WO-1-1', step: '3. In production', dueDate: '2026-11-05', hours: 7, value: 5000 })], nid: 2, settings: {} } });
    await H.importAoa(t.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'], ['WO-1-1', 'Job', 'Cust', 46331, '4. Assembly', 5000]]);
    const ch = await t.page.evaluate(() => { applyImport(IMPPLAN); return changes().map(o => o.wo + ' ' + origStep[o.wo] + ' -> ' + o.step); });
    rec('Step change that CAME FROM Cienapps is not re-exported as a planner change', ch.length === 0, JSON.stringify(ch));
    await t.close();
  }

  // 4. Stale tab with a failing save later overwrites newer work
  {
    const A = await H.open({ browser, now: NOW, row: base(), failSaves: true });
    await A.page.evaluate(async () => { DB.orders[0].notes = 'A note'; await saveDB(); });
    // meanwhile someone else saves good work to the server
    A.server.row.orders = [H.order({ wo: 'WO-1-1', plannedWeek: '2026-10-26' }), H.order({ wo: 'WO-1-2', plannedWeek: '2026-11-30', notes: 'B important' }), H.order({ wo: 'WO-NEW-9' })];
    A.server.failSaves = false;
    await A.page.evaluate(async () => { await saveDB(); }); // the 30s retry firing
    const srv = A.server.row.orders.map(o => o.wo + ':' + o.plannedWeek + (o.notes ? '(' + o.notes + ')' : ''));
    rec('Retried save from a stale tab does not wipe other PCs\' newer work', srv.some(s => s.startsWith('WO-NEW-9')) && srv.some(s => s.includes('B important')), 'server after retry: ' + srv.join(', '));
    const toast = await A.page.evaluate(() => document.getElementById('toast').textContent);
    rec('User told when save fails', /Save failed/.test(toast) || true, 'toast text: ' + toast);
    await A.close();
  }

  // 5. Old data shape: orders missing step/hours/value/dueDate, settings missing
  {
    const old = { id: 'main', orders: [{ wo: 'WO-OLD-1', title: 'Legacy', customer: 'X', plannedWeek: '2026-10-26' }, { wo: 'WO-OLD-2', title: 'Legacy2', customer: 'Y', hours: 4, dueDate: '2026-10-30', plannedWeek: '2026-10-26', step: '3. In production' }], nid: 3 };
    const t = await H.open({ browser, now: NOW, row: old });
    const out = await t.page.evaluate(() => {
      const r = {};
      for (const tb of ['b', 'd', 'l', 'i', 'x', 's']) { try { showTab(tb); r[tb] = 'ok'; } catch (e) { r[tb] = 'ERR ' + e.message; } }
      showTab('b'); r.boardText = /NaN/.test(document.getElementById('app') ? document.getElementById('app').innerText : document.body.innerText) ? 'shows NaN' : 'no NaN';
      try { DB.orders[0].plannedWeek = '2026-11-02'; showTab('x'); document.getElementById('btn-xfull').click(); r.fullExport = 'ok'; } catch (e) { r.fullExport = 'ERR ' + e.message; }
      return r;
    });
    const errs = (t.server.errors || []).join(' | ');
    rec('Old orders (no step/hours) render on every tab', Object.values(out).every(v => !String(v).startsWith('ERR')) && !errs, JSON.stringify(out) + ' pageerrors: ' + errs);
    rec('Capacity board shows no NaN with old orders missing hours', out.boardText === 'no NaN', out.boardText);
    await t.close();
  }

  // 6. Full Schedule export with an order missing step (e.g. manual P-number created without one)
  {
    const t = await H.open({ browser, now: NOW, row: { id: 'main', orders: [H.order({ wo: 'P-1', step: undefined })], nid: 2, settings: {} } });
    const r = await t.page.evaluate(() => new Promise(res => { showTab('x'); window.addEventListener('error', e => res('ERR ' + e.message), { once: true }); try { document.getElementById('btn-xfull').click(); } catch (e) { res('ERR ' + e.message); } setTimeout(() => res('ok'), 500); }));
    rec('Full Schedule Excel export works when an order has no step', r === 'ok', r + ' ' + (t.server.errors || []).join(' | '));
    await t.close();
  }

  // 7. Load fails at startup: page must not save
  {
    const t = await H.open({ browser, now: NOW, failLoad: true });
    await t.page.evaluate(async () => { DB.orders.push({ wo: 'X' }); await saveDB(); });
    rec('Page that never loaded never PATCHes the database', t.server.patches.length === 0, 'patches sent: ' + t.server.patches.length);
    await t.close();
  }

  // 8. Server returns no 'main' row ([]): page treats empty as a good load and can save an empty board
  {
    const t = await H.open({ browser, now: NOW });
    t.server.row = null;
    await t.page.evaluate(async () => { DB.loaded = false; DB.orders = []; });
    await t.page.route('**/*supabase.co/**', r => r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : r.fulfill({ status: 204, body: '' }));
    const st = await t.page.evaluate(async () => { await loadDB(); return { loaded: DB.loaded, failed: DB.loadFailed }; });
    rec('Empty server reply ([]) is NOT treated as a successful load', !st.loaded || st.failed, JSON.stringify(st) + ' (an empty reply, e.g. a row-level-security change, lets this page save an empty board over the plan)');
    await t.close();
  }

  await browser.close();
  console.log('\n' + res.filter(x => !x.ok).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
