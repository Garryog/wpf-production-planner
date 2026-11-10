// Manager review (3 Nov 2026): an OLD-code tab (live main) saves the whole settings block without exportBase (the Export
// Changes baseline). New code must treat "row has no exportBase but this page holds one" as "an old tab dropped it":
// keep its own copy and write it back on the next save — never drop or reset it. Only "Mark as applied" resets it.
// The one-off migration (row has none AND page has none → build from current plan) must still work.
// Fake Supabase only. Run: node tests/stage1/t15-oldtab-exportbase.test.js
const { H, makeServer, open } = require('./srv');
const NOW = '2026-10-19T10:00:00Z';
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
const base = () => ({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1-1' }), H.order({ wo: 'WO-1-2' })], nid: 3, settings: {} });
const oldTabSave = (S, edit) => { // what a live-main tab does: whole settings without exportBase / saveIds; trigger bumps version
  const s = JSON.parse(JSON.stringify(S.row.settings)); delete s.exportBase; delete s.saveIds; S.row.settings = s;
  if (edit) edit(S.row); S.row.version++;
};
const chg = p => p.evaluate(() => changes().map(o => o.wo).join());
const settle = async p => { await p.waitForTimeout(1500); await p.waitForFunction(() => !SAVING && !saveT, null, { timeout: 20000 }).catch(() => {}); };
(async () => {
  const browser = await H.chromium.launch();
  try {
    // 1. Manager's script: idle page, old tab drops the baseline → written back; a fresh PC still sees the change
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      rec('1a one-off migration stores baseline', !!S.row.settings.exportBase);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      rec('1b change listed', (await chg(A.page)) === 'WO-1-1');
      oldTabSave(S);
      await A.page.evaluate(() => loadDB()); await settle(A.page);
      rec('1c page keeps change after old-tab save', (await chg(A.page)) === 'WO-1-1');
      const eb = S.row.settings.exportBase;
      rec('1d baseline written back to DB', !!(eb && eb.wk && eb.wk['WO-1-1'] === '2026-10-26'), JSON.stringify(eb));
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      rec('1e fresh PC sees the change', (await chg(B.page)) === 'WO-1-1', await chg(B.page));
      await A.ctx.close(); await B.ctx.close();
    }
    // 2. Page with unsaved edits (merge path) when the old tab drops it
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      oldTabSave(S, r => { r.orders[1].notes = 'old tab edit'; });
      await A.page.evaluate(() => { DB.orders[1].plannedWeek = '2026-11-09'; clearTimeout(saveT); saveT = null; });
      await A.page.evaluate(() => loadDB()); await settle(A.page);
      const eb = S.row.settings.exportBase;
      rec('2a baseline back in DB after merge save', !!(eb && eb.wk && eb.wk['WO-1-1'] === '2026-10-26' && eb.wk['WO-1-2'] === '2026-10-26'), JSON.stringify(eb));
      rec('2b both changes listed', (await chg(A.page)) === 'WO-1-1,WO-1-2', await chg(A.page));
      rec('2c old tab edit kept', S.row.orders[1].notes === 'old tab edit');
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      rec('2d fresh PC sees both changes', (await chg(B.page)) === 'WO-1-1,WO-1-2', await chg(B.page));
      await A.ctx.close(); await B.ctx.close();
    }
    // 3. Old tab saves twice in a row while the page refreshes in between — still restored, never reset
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      for (let i = 0; i < 3; i++) { oldTabSave(S); await A.page.evaluate(() => loadDB()); await settle(A.page); }
      const eb = S.row.settings.exportBase;
      rec('3a baseline intact after repeated old-tab saves', !!(eb && eb.wk && eb.wk['WO-1-1'] === '2026-10-26'), JSON.stringify(eb));
      rec('3b no extra saves when nothing dropped', await (async () => { const n = S.patches.length; await A.page.evaluate(() => loadDB()); await settle(A.page); return S.patches.length === n; })());
      await A.ctx.close();
    }
    // 4. Mark as applied still resets (and the reset survives a later old-tab save)
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      await A.page.evaluate(async () => { DB.orders.forEach(o => { orig[o.wo] = o.plannedWeek || ''; origStep[o.wo] = o.step || ''; }); await saveDB(); });
      rec('4a mark as applied clears list', (await chg(A.page)) === '');
      oldTabSave(S); await A.page.evaluate(() => loadDB()); await settle(A.page);
      const eb = S.row.settings.exportBase;
      rec('4b reset baseline written back', !!(eb && eb.wk && eb.wk['WO-1-1'] === '2026-11-02'), JSON.stringify(eb));
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      rec('4c fresh PC: list empty', (await chg(B.page)) === '');
      await A.ctx.close(); await B.ctx.close();
    }
    // 5. Migration still one-off: row and page both without a baseline → built from the plan; a second page then shares it
    {
      const S = makeServer({ ...base(), orders: [H.order({ wo: 'WO-1-1', plannedWeek: '2026-11-16' })] });
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      const eb = S.row.settings.exportBase;
      rec('5a migration builds baseline from current plan', !!(eb && eb.wk && eb.wk['WO-1-1'] === '2026-11-16'), JSON.stringify(eb));
      const n = S.patches.length;
      const B = await open(browser, S, { now: NOW }); await settle(B.page);
      rec('5b second page does not re-save it', S.patches.length === n);
      await A.ctx.close(); await B.ctx.close();
    }
    // 6. Non-office screen (saw) holding a baseline also puts it back
    {
      const S = makeServer(base());
      const A = await open(browser, S, { now: NOW }); await settle(A.page);
      await A.page.evaluate(async () => { DB.orders[0].plannedWeek = '2026-11-02'; await saveDB(); });
      const W = await open(browser, S, { now: NOW, role: 'saw' }); await settle(W.page);
      await A.ctx.close();
      oldTabSave(S); await W.page.evaluate(() => loadDB()); await settle(W.page);
      const eb = S.row.settings.exportBase;
      rec('6a saw screen restores baseline', !!(eb && eb.wk && eb.wk['WO-1-1'] === '2026-10-26'), JSON.stringify(eb));
      await W.ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
