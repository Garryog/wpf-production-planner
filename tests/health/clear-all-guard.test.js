// Health check 16 Nov 2026: "Clear All Orders" on the Capacity Board. On 12 Nov it was run and the backup reason said
// "? [office]" — nobody named, and any Office screen could wipe every order by typing DELETE.
// Now: a name is picked first (officeWho), then the Admin PIN, then type DELETE, then the safety backup, then the wipe.
// Fake Supabase only (tests/stage1/tsrv.js). Run: node tests/health/clear-all-guard.test.js
const { H, makeServer, device, sleep } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const base = () => ({ id: 'main', version: 1, nid: 5, settings: { staff: [{ n: 'Mary Office', r: ['office'] }] },
  orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' }), H.order({ wo: 'WO-3' })] });
// answers: what prompt() returns, in order (Admin PIN, then the DELETE box). who: '' = nobody named on this tab yet.
async function run(browser, { who, answers, pick }) {
  const S = makeServer(base()); const D = await device(browser, S, { name: 'A' });
  const p = D.page;
  await p.evaluate(({ who, answers }) => {
    if (who) sessionStorage.setItem('wpfWho', who); else sessionStorage.removeItem('wpfWho');
    window.__asked = []; const a = answers.slice();
    window.prompt = m => { window.__asked.push(String(m)); return a.length ? a.shift() : null; };
    window.confirm = () => true; showTab('b');
  }, { who, answers });
  await sleep(200);
  const clicked = await p.evaluate(() => { const b = document.getElementById('btn-clearall'); if (!b) return false; b.click(); return true; });
  await sleep(150);
  const picker = await p.evaluate(() => !!document.querySelector('.pod-ovl [data-pick]') || !!document.getElementById('pick-other'));
  if (pick === 'cancel') await p.evaluate(() => { const x = document.getElementById('pod-x'); if (x) x.click(); });
  else if (pick) await p.evaluate(n => { const b = document.querySelector('.pod-ovl [data-pick="' + n + '"]'); if (b) b.click(); }, pick);
  await sleep(900);
  const st = await p.evaluate(() => ({ n: DB.orders.length, asked: window.__asked }));
  return { S, D, clicked, picker, ...st };
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    // 1. wrong Admin PIN (the Office PIN) -> nothing deleted, no backup, DELETE box never shown
    let r = await run(browser, { who: 'Mary Office', answers: ['2468', 'DELETE'] });
    rec('wrong Admin PIN (Office PIN typed): nothing deleted, no backup, DELETE box not shown',
      r.clicked && r.n === 3 && r.S.backups.length === 0 && r.asked.length === 1 && /Admin PIN/.test(r.asked[0]), JSON.stringify({ n: r.n, bak: r.S.backups.length, asked: r.asked }));
    await r.D.close();
    // 2. Admin PIN box cancelled -> nothing deleted
    r = await run(browser, { who: 'Mary Office', answers: [] });
    rec('Admin PIN box cancelled: nothing deleted, no backup', r.n === 3 && r.S.backups.length === 0 && r.asked.length === 1, JSON.stringify({ n: r.n, bak: r.S.backups.length, asked: r.asked }));
    await r.D.close();
    // 3. empty Admin PIN -> nothing deleted
    r = await run(browser, { who: 'Mary Office', answers: [''] });
    rec('empty Admin PIN: nothing deleted, no backup', r.n === 3 && r.S.backups.length === 0, JSON.stringify({ n: r.n, bak: r.S.backups.length }));
    await r.D.close();
    // 4. nobody named on this tab: the name picker shows first; Cancel -> nothing deleted, no PIN asked
    r = await run(browser, { who: '', answers: ['9000', 'DELETE'], pick: 'cancel' });
    rec('no name yet: "Who is making changes" shows first; Cancel = nothing deleted, no PIN asked, no backup',
      r.picker && r.n === 3 && r.S.backups.length === 0 && r.asked.length === 0, JSON.stringify({ picker: r.picker, n: r.n, bak: r.S.backups.length, asked: r.asked }));
    await r.D.close();
    // 5. right PIN but DELETE not typed -> nothing deleted (unchanged behaviour)
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'delete'] });
    rec('right Admin PIN but "delete" (not DELETE): nothing deleted, no backup', r.n === 3 && r.S.backups.length === 0 && r.asked.length === 2 && /Type DELETE/.test(r.asked[1]), JSON.stringify({ n: r.n, bak: r.S.backups.length, asked: r.asked }));
    await r.D.close();
    // 6. name picked + right PIN + DELETE -> backup first, reason names the person, orders cleared
    r = await run(browser, { who: '', answers: ['9000', 'DELETE'], pick: 'Mary Office' });
    const b = r.S.backups[0] || {};
    rec('name picked + Admin PIN + DELETE: orders cleared', r.picker && r.n === 0, JSON.stringify({ picker: r.picker, n: r.n, asked: r.asked }));
    rec('safety backup taken with all 3 jobs in it', r.S.backups.length === 1 && b.orders_count === 3 && b.payload && b.payload.orders.length === 3, JSON.stringify({ bak: r.S.backups.length, cnt: b.orders_count }));
    rec('backup reason carries the name, not "?"', /before Clear all orders · Mary Office \[office\]/.test(b.reason || '') && !/\?/.test(b.reason || ''), b.reason);
    await sleep(1500);
    rec('the cleared plan is saved (after the backup)', Array.isArray(r.S.row.orders) && r.S.row.orders.length === 0, (r.S.row.orders || []).length);
    rec('no page errors', !r.D.dev.errors.length, r.D.dev.errors.join(' | '));
    await r.D.close();
    // 7. name already set on this tab (same as every other board edit): straight to the PIN; reason carries that name
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'DELETE'] });
    rec('name already set on this tab: no picker, PIN then DELETE, cleared, reason carries the name',
      !r.picker && r.n === 0 && /Mary Office \[office\]/.test((r.S.backups[0] || {}).reason || ''), JSON.stringify({ picker: r.picker, n: r.n, reason: (r.S.backups[0] || {}).reason }));
    await r.D.close();
    // 8. Manager condition: an already empty board -> just a message; no name, no PIN, no 0-job backup
    {
      const S = makeServer({ ...base(), orders: [] }); const D = await device(browser, S, { name: 'A' }); const p = D.page;
      await p.evaluate(() => { sessionStorage.removeItem('wpfWho'); window.__asked = []; window.prompt = m => { window.__asked.push(String(m)); return m.startsWith('Admin') ? '9000' : 'DELETE'; }; showTab('b'); });
      await sleep(200);
      await p.evaluate(() => document.getElementById('btn-clearall').click());
      await sleep(600);
      const o = await p.evaluate(() => ({ asked: window.__asked, picker: !!document.getElementById('pick-other'), toast: (document.getElementById('toast') || {}).textContent || '' }));
      rec('empty board: "Nothing to clear — the board is already empty"; no name picker, no PIN, no backup',
        !o.picker && o.asked.length === 0 && S.backups.length === 0 && /Nothing to clear — the board is already empty/.test(o.toast), JSON.stringify({ ...o, bak: S.backups.length }));
      await D.close();
    }
  } finally { await browser.close(); }
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
