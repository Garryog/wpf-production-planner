// s26 (Garry 26 Nov: "This device's storage for the planner is full" — another tool's photos, 9.86 MB, on the same web address).
// When the browser's small store (localStorage) is full or blocked, the planner keeps its safety copy of unsaved changes in the
// large store (IndexedDB) instead; on reopening, the copy is recovered and sent. Nothing of the other tool is touched.
// Fake Supabase only. Run: node tests/stage1/s26-big-store.test.js
const { H, makeServer, open, reopen } = require('./srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mk = () => makeServer({ id: 'main', version: 1, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], nid: 3, settings: {} });
const idb = p => p.evaluate(() => PIDB.all().then(o => Object.keys(o).filter(k => k !== '_read')));
const state = p => p.evaluate(() => ({ big: pendBig, fail: !!DB.pendFail, why: DB.pendWhy || '', bar: (document.getElementById('save-bar') || document.querySelector('.save-bar,#sbar,#savebar') || {}).innerText || '', ls: Object.keys(localStorage).filter(k => k.indexOf('wpfPending') === 0).length }));
const blockLS = p => p.evaluate(() => { const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).indexOf('wpfPending') === 0) throw new DOMException('full', 'QuotaExceededError'); return si.call(this, k, v); }; });
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1. small store refuses → kept in the large store, no warning
    const S = mk(); const A = await open(browser, S, {}); S.offline = true;
    await blockLS(A.page);
    await A.page.evaluate(async () => { DB.orders[0].notes = 'kept in the big store'; await saveDB(); }); await sleep(600);
    let st = await state(A.page), ids = await idb(A.page);
    rec('small store full → the copy is in the large store (one record for this tab), nothing in the small one', st.big && ids.length === 1 && st.ls === 0, JSON.stringify([st, ids]));
    rec('…and the planner does NOT say it could not keep a copy', !st.fail && !/could NOT keep/.test(await A.page.evaluate(() => document.body.innerText)), JSON.stringify(st));
    const txt = await A.page.evaluate(() => { showTab && 0; return typeof devStoreHTML === 'function' ? devStoreHTML() : ''; });
    rec('Settings → Storage says the safety copy is in the large store', /large store instead/.test(txt));
    // a second change replaces the record (still one)
    await A.page.evaluate(async () => { DB.orders[1].notes = 'second change'; await saveDB(); }); await sleep(500);
    ids = await idb(A.page); rec('a second unsaved change: still ONE record for this tab', ids.length === 1, ids.join());
    // ---------- 2. tab closed while offline → reopened: recovered from the large store and sent
    await A.page.close(); S.offline = false;
    const B = await reopen(A, S); await B.page.waitForTimeout(3000);
    const o = S.row.orders;
    rec('reopened: both changes recovered from the large store and saved to the database', o.find(x => x.wo === 'WO-1').notes === 'kept in the big store' && o.find(x => x.wo === 'WO-2').notes === 'second change', JSON.stringify(o.map(x => x.notes)));
    await sleep(800); ids = await idb(B.page); st = await state(B.page);
    rec('…and once saved the large store is empty again (no copy left behind), nothing unsaved', ids.length === 0 && !st.fail, JSON.stringify([ids, st]));
    await A.close();
    // ---------- 3. normal computer: the small store is used, the large one stays empty
    const S3 = mk(); const C = await open(browser, S3, {}); S3.offline = true;
    await C.page.evaluate(async () => { DB.orders[0].notes = 'normal'; await saveDB(); }); await sleep(400);
    st = await state(C.page); ids = await idb(C.page);
    rec('normal computer: copy in the small store as before, large store not used', st.ls === 1 && !st.big && ids.length === 0 && !st.fail, JSON.stringify([st, ids]));
    // ---------- 4. the small store fills up LATER (real quota, another tool's items) — the copy moves to the large store; the other tool's items are untouched
    const n = await C.page.evaluate(() => { let i = 0; const chunk = 'x'.repeat(400000); try { for (; i < 200; i++) localStorage.setItem('ph:other' + i, chunk); } catch (e) { } try { for (let j = 0; j < 400; j++) localStorage.setItem('ph:pad' + j, 'y'.repeat(2000)); } catch (e) { } try { for (let j = 0; j < 400; j++) localStorage.setItem('ph:tiny' + j, 'z'.repeat(40)); } catch (e) { } return Object.keys(localStorage).filter(k => k.indexOf('ph:') === 0).length; });
    await C.page.evaluate(async () => { for (let i = 0; i < 30; i++) DB.orders[0]['f' + i] = 'value ' + i + ' '.repeat(50); DB.orders[0].notes = 'after it filled up'; await saveDB(); }); await sleep(700);
    st = await state(C.page); ids = await idb(C.page);
    const n2 = await C.page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('ph:') === 0).length);
    rec('small store really full (' + n + ' items of another tool): the copy is in the large store, no warning', st.big && ids.length === 1 && !st.fail, JSON.stringify([st, ids]));
    rec('…the other tool\'s items are all still there (nothing deleted)', n2 === n && n > 5, n + ' → ' + n2);
    rec('…and no older copy of this tab is left in the small store to be recovered instead', st.ls === 0, String(st.ls));
    await C.page.close(); S3.offline = false;
    const D = await reopen(C, S3); await D.page.waitForTimeout(3000);
    rec('reopened with the small store still full: the change is recovered and saved', S3.row.orders.find(x => x.wo === 'WO-1').notes === 'after it filled up', S3.row.orders.find(x => x.wo === 'WO-1').notes);
    await C.close();
    // ---------- 5. BOTH stores refuse → the honest warning, as before
    const S5 = mk(); const E = await open(browser, S5, {}); S5.offline = true;
    await blockLS(E.page);
    await E.page.evaluate(async () => { PIDB.db = Promise.resolve(null); DB.orders[0].notes = 'x'; await saveDB(); }); await sleep(600);
    st = await state(E.page);
    rec('both stores refuse: the planner says it could NOT keep a copy (as before)', st.fail && /could NOT keep|storage for the planner is full/.test(await E.page.evaluate(() => document.body.innerText)), JSON.stringify(st));
    await E.close();
    // ---------- 6. a tab has an OLD copy in the small store and a NEWER one in the large store → the newer one is recovered
    const S6 = mk(); const F = await open(browser, S6, {}); S6.offline = true;
    await F.page.evaluate(async () => { DB.orders[0].notes = 'older'; await saveDB(); }); await sleep(300);
    await F.page.evaluate(async () => { const k = Object.keys(localStorage).find(k => k.indexOf('wpfPending:') === 0), old = JSON.parse(localStorage.getItem(k)); const nw = JSON.parse(JSON.stringify(old)); nw.at = old.at + 5000; nw.d.forEach(e => { if (e.m && e.m.notes === 'older') e.m.notes = 'newer'; }); await PIDB.put(k.slice('wpfPending:'.length), nw); });
    await F.page.close(); S6.offline = false;
    const G = await reopen(F, S6); await G.page.waitForTimeout(3000);
    rec('older copy in the small store + newer in the large store → the newer one wins', S6.row.orders.find(x => x.wo === 'WO-1').notes === 'newer', S6.row.orders.find(x => x.wo === 'WO-1').notes);
    await F.close();
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
