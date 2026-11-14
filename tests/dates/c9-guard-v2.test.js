// Old-screen guard v2 (PENDING SQL in SUPABASE_CHANGES.md): this code writes settings.appRel = 2 on every save, and when
// the database refuses a save as out of date (P0001 "This planner screen is out of date - refresh the page") the screen
// says so plainly — refresh the page, changes kept on this device — instead of only "Save failed".
// Fake Supabase only (the guard SQL itself is checked on a throwaway Postgres: tests/dates/pg-guard-v2.sql).
// Run: node tests/dates/c9-guard-v2.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', version: 5, nid: 2, settings: { wcap: 350 }, orders: [H.order({ wo: 'WO-1' })] } });
  // a normal save carries the marker
  await t.page.evaluate(async () => { DB.orders[0].notes = 'first'; await saveDB(); });
  const sent = t.server.patches.slice(-1)[0] || {};
  rec('every save carries settings.appRel = 2', sent.settings && sent.settings.appRel === 2 && t.server.row.settings.appRel === 2, JSON.stringify(sent.settings && sent.settings.appRel));
  // the database refuses the next save (as guard v2 / the 3 Nov guard does)
  await t.page.route('**/rest/v1/production_planner**', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"P0001","details":null,"hint":null,"message":"This planner screen is out of date - refresh the page"}' })
    : route.fallback());
  const r = await t.page.evaluate(async () => { DB.orders[0].notes = 'second'; await saveDB(); await new Promise(r => setTimeout(r, 100));
    return { failed: !!DB.saveFailed, toast: (document.getElementById('toast') || {}).textContent || '', bar: !(document.getElementById('savebar') || {}).hidden, pend: !!localStorage.getItem('wpfPend') || Object.keys(localStorage).some(k => /pend/i.test(k)) }; });
  rec('refused save: the screen says it is out of date and to refresh the page', r.failed && /out of date/.test(r.toast) && /Refresh the page/.test(r.toast) && /kept on this device/.test(r.toast), r.toast.slice(0, 200));
  rec('refused save: the red "not saved" bar shows and the change is kept on this device', r.bar && r.pend, JSON.stringify(r));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
