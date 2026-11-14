// Tester attack 3 — old-screen guard v2 from the app side, with the fake Supabase applying the guard rule exactly as the
// PENDING SQL does (tests/dates/pg-guard-v2-block.sql): once the row's settings.appRel >= 2, a save whose settings carry
// no appRel (or < 2) is refused with P0001 "This planner screen is out of date - refresh the page".
// A: listDelOnly + appRel survive save / reload next to delLegacyWk / delivLead / siteDays / earlyDays; switching
//    listDelOnly on / off leaves the date settings alone.
// B: a refused save keeps the change on the device, tells the user, and lands after a refresh.
// C: a 10-Nov screen (origin/release/2026-11-10) saving before any new save is accepted; after a new screen has saved it is
//    refused and the row is untouched.  D: two new screens saving at once still merge.
// Stubbed Supabase only.  Run: node tests/dates/attack3-guard.test.js
const { H, makeServer, open, openOld, oldHtml, recorder, save, reload, w } = require('./attack1-lib');
const { reopen } = require('../stage1/srv');
const { rec, done } = recorder('attack3-guard');
const NOW = '2026-11-10T10:00:00Z', REL = 'origin/release/2026-11-10';
const P0001 = '{"code":"P0001","details":null,"hint":null,"message":"This planner screen is out of date - refresh the page"}';
// the guard rule, on top of srv's fake (Playwright runs the last route first)
async function guard(t, S) {
  await t.page.route('**/rest/v1/production_planner**', async route => {
    const req = route.request();
    if (req.method() !== 'PATCH') return route.fallback();
    const b = JSON.parse(req.postData() || '{}');
    const rel = x => { const v = x && x.appRel; return /^[0-9]{1,6}$/.test(String(v)) ? +v : 0; };
    const oldRel = rel(S.row.settings), newRel = 'settings' in b ? rel(b.settings) : oldRel;
    if (S.forceRefuse || (oldRel >= 2 && newRel < 2)) { S.refused = (S.refused || 0) + 1; S.patches.push(b); return route.fulfill({ status: 400, contentType: 'application/json', body: P0001 }); }
    return route.fallback();
  });
}
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '5. WORK ORDER PROCESSED', customer: 'CAIRN', title: 'House ' + wo }, x));
  const DS = { delLegacyWk: '2026-11-02', delLegacyAt: '2026-11-03T10:00:00Z', delivLead: 4, siteDays: 6, earlyDays: 20 };
  const pickS = s => ({ listDelOnly: s.listDelOnly, appRel: s.appRel, delLegacyWk: s.delLegacyWk, delivLead: s.delivLead, siteDays: s.siteDays, earlyDays: s.earlyDays });

  // ---- A ----
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { ...DS, listDelOnly: true }, orders: [O('WO-1'), O('WO-2', { delv: true })] });
    const A = await open(browser, S, { now: NOW }); await guard(A, S);
    await A.page.evaluate(() => { DB.orders[0].notes = 'edit'; sched(); }); await save(A.page);
    const s1 = pickS(S.row.settings);
    rec('save keeps listDelOnly, delLegacyWk, delivLead, siteDays, earlyDays and adds appRel 2', JSON.stringify(s1) === JSON.stringify({ listDelOnly: true, appRel: 2, delLegacyWk: '2026-11-02', delivLead: 4, siteDays: 6, earlyDays: 20 }), JSON.stringify(s1));
    const A2 = await open(browser, S, { now: NOW }); await guard(A2, S);
    const m = await A2.page.evaluate(() => ({ listDelOnly: DB.listDelOnly, delLegacyWk: DB.delLegacyWk, delivLead: delivLead(), siteDays: siteDays(), earlyDays: earlyDays() }));
    rec('a fresh screen loads them all back', JSON.stringify(m) === JSON.stringify({ listDelOnly: true, delLegacyWk: '2026-11-02', delivLead: 4, siteDays: 6, earlyDays: 20 }), JSON.stringify(m));
    // switch listDelOnly off then on through the Settings box on the lists screen
    // The Settings checkbox (#ls-delonly) is only drawn when the lists store is switched to v2 (needs the list tables), so the
    // test does what its change handler does after the Admin PIN: DB.listDelOnly = v; sched(); then saves.
    const flip = async () => A2.page.evaluate(async () => { const cb = document.getElementById('ls-delonly'); const v = !DB.listDelOnly; if (cb) { cb.checked = v; } DB.listDelOnly = v; sched(); clearTimeout(saveT); await saveDB(); return DB.listDelOnly; });
    const f1 = await flip(); const s2 = pickS(S.row.settings);
    const f2 = await flip(); const s3 = pickS(S.row.settings);
    rec('listDelOnly off → saved false, date settings untouched', f1 === false && s2.listDelOnly === false && s2.delivLead === 4 && s2.siteDays === 6 && s2.earlyDays === 20 && s2.delLegacyWk === '2026-11-02' && s2.appRel === 2, JSON.stringify({ f1, s2 }));
    rec('listDelOnly back on → saved true, date settings untouched', f2 === true && s3.listDelOnly === true && s3.delivLead === 4 && s3.earlyDays === 20 && s3.delLegacyWk === '2026-11-02', JSON.stringify({ f2, s3 }));
    rec('no saves refused (A)', !S.refused, S.refused);
    rec('no page errors (A)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await A2.close();
  }

  // ---- B: refused save → kept on the device → lands after a refresh ----
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { appRel: 2 }, orders: [O('WO-1')] });
    const A = await open(browser, S, { now: NOW }); await guard(A, S);
    S.forceRefuse = true;
    const r = await A.page.evaluate(async () => { DB.orders[0].notes = 'typed while refused'; clearTimeout(saveT); await saveDB(); await new Promise(r => setTimeout(r, 100));
      return { failed: !!DB.saveFailed, toast: (document.getElementById('toast') || {}).textContent || '', pend: Object.keys(localStorage).filter(k => /pend/i.test(k)).map(k => (localStorage.getItem(k) || '').includes('typed while refused')).some(Boolean) }; });
    const n0 = S.patches.length; await w(2500); const burst = S.patches.length - n0;
    rec('refused: user told "out of date — refresh the page — kept on this device"', r.failed && /out of date/.test(r.toast) && /Refresh the page/.test(r.toast) && /kept on this device/.test(r.toast), r.toast.slice(0, 200));
    rec('refused: the change is in the device copy', r.pend, JSON.stringify(r));
    rec('refused: no rapid retry loop against the database (≤ 1 save in 2.5 s)', burst <= 1, burst + ' saves');
    rec('refused: the row is untouched', !S.row.orders[0].notes, JSON.stringify(S.row.orders[0].notes));
    S.forceRefuse = false;
    const A2 = await reopen(A, S); await guard(A2, S);
    await A2.page.waitForTimeout(2500);
    await A2.page.evaluate(async () => { if (saveT) { clearTimeout(saveT); await saveDB(); } });
    const r2 = await A2.page.evaluate(() => ({ note: (DB.orders.find(o => o.wo === 'WO-1') || {}).notes, failed: !!DB.saveFailed }));
    rec('after a refresh the kept change is back on screen and saved to the database', r2.note === 'typed while refused' && S.row.orders[0].notes === 'typed while refused' && !r2.failed, JSON.stringify({ r2, row: S.row.orders[0].notes }));
    rec('no page errors (B)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A2.close(); await A.close().catch(() => {});
  }

  // ---- C: 10-Nov screen ----
  if (!oldHtml(REL)) rec(REL + ' readable from git (run git fetch)', false, '');
  else {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { wcap: 350 }, orders: [O('WO-1'), O('WO-2')] });
    const R = await openOld(browser, S, { now: NOW, ref: REL }); await guard(R, S);
    const N = await open(browser, S, { now: NOW }); await guard(N, S);
    await R.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').notes = 'old screen, before'; sched(); }); await save(R.page);
    rec('go-live order: a 10-Nov screen saving BEFORE any new-code save is accepted', S.row.orders.find(o => o.wo === 'WO-1').notes === 'old screen, before' && !S.refused, JSON.stringify({ refused: S.refused }));
    await reload(N.page);
    await N.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-2').notes = 'new screen'; sched(); }); await save(N.page);
    rec('the new screen saves (appRel 2 now in the row)', S.row.settings.appRel === 2 && S.row.orders.find(o => o.wo === 'WO-2').notes === 'new screen', JSON.stringify(S.row.settings.appRel));
    const vBefore = S.row.version, rowBefore = JSON.stringify(S.row.orders);
    await R.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').notes = 'old screen, after'; sched(); }); await save(R.page);
    const rr = await R.page.evaluate(() => ({ failed: !!DB.saveFailed, toast: (document.getElementById('toast') || {}).textContent || '', pend: Object.keys(localStorage).some(k => /pend/i.test(k) && (localStorage.getItem(k) || '').includes('old screen, after')) }));
    rec('a 10-Nov screen saving AFTER a new screen is refused; the row is untouched', S.refused >= 1 && S.row.version === vBefore && JSON.stringify(S.row.orders) === rowBefore, JSON.stringify({ refused: S.refused, v: [vBefore, S.row.version] }));
    rec('the 10-Nov screen keeps its change on the device', rr.failed && rr.pend, JSON.stringify(rr));
    rec('the 10-Nov screen tells its user to refresh (not "keep this page open")', /refresh/i.test(rr.toast) && !/Keep this page open/i.test(rr.toast), rr.toast + ' — the old code cannot recognise the guard; its user is told to keep the page open while it retries for ever');
    rec('no page errors from the new screen (C)', !(S.errors || []).filter(e => !/^OLD:/.test(e)).length, (S.errors || []).join(' | '));
    await R.close(); await N.close();
  }

  // ---- D: two new screens saving at once ----
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { appRel: 2 }, orders: [O('WO-1'), O('WO-2')] });
    const A = await open(browser, S, { now: NOW }), B = await open(browser, S, { now: NOW }); await guard(A, S); await guard(B, S);
    await A.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').notes = 'A'; moveDates(['WO-1'], { due: '2026-11-27' }, { why: 'Production' }, 'Ann').apply(); });
    await B.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-2').notes = 'B'; DB.delivLead = 5; });
    await Promise.all([save(A.page), save(B.page)]);
    await w(400); await save(A.page); await save(B.page);
    const g = wo => S.row.orders.find(o => o.wo === wo);
    rec('two new screens saving at once: both changes in the database, nothing refused', g('WO-1').notes === 'A' && g('WO-1').dueDate === '2026-11-27' && g('WO-2').notes === 'B' && S.row.settings.delivLead === 5 && !S.refused && S.row.settings.appRel === 2, JSON.stringify({ n1: g('WO-1').notes, d1: g('WO-1').dueDate, n2: g('WO-2').notes, dl: S.row.settings.delivLead, refused: S.refused }));
    rec('no page errors (D)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await B.close();
  }
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
