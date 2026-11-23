// Tester attack round 2, health check 23 Nov 2026 (after origin/main merged in). Harness copied from clear-all-attack.test.js.
// Original header: Tester attack, health check 16 Nov 2026: "Clear All Orders" guard (name -> Admin PIN -> type DELETE -> backup -> wipe).
// Goes beyond tests/health/clear-all-guard.test.js. Fake Supabase only (tests/stage1/tsrv.js) — nothing live is touched.
// Run: node tests/health/clear-all-attack.test.js
const { H, makeServer, device, sleep } = require('../stage1/tsrv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const J = JSON.stringify;
const base = (extra = {}) => ({ id: 'main', version: 1, nid: 5,
  settings: { staff: [{ n: 'Mary Office', r: ['office'] }, { n: "Garry O'Grady", r: ['admin'] }],
    lists: [{ id: 'L1', name: 'List one', wos: ['WO-1', 'WO-2'] }], ...extra },
  orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' }), H.order({ wo: 'WO-3' })] });
// who: '' = nobody named yet. answers: prompt() replies in order. conf: confirm() reply. pick: name button | 'cancel' | 'bg' | {other:'text'}
async function run(browser, o) {
  const S = makeServer(base(o.settings)); if (o.noBak) S.noBackupTable = true;
  const D = await device(browser, S, { name: 'A', latency: o.latency }); const p = D.page;
  await p.evaluate(({ who, answers, conf, blockSS }) => {
    if (who) sessionStorage.setItem('wpfWho', who); else sessionStorage.removeItem('wpfWho');
    if (blockSS) { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (this === sessionStorage) throw new Error('blocked'); return orig.call(this, k, v); }; }
    window.__asked = []; window.__conf = []; window.__toasts = []; const a = answers.slice();
    window.prompt = m => { window.__asked.push(String(m)); return a.length ? a.shift() : null; };
    window.confirm = m => { window.__conf.push(String(m)); return conf !== false; };
    const t0 = window.toast; window.toast = (m, s) => { window.__toasts.push(String(m)); return t0(m, s); };
    window.__lq0 = (typeof LQ !== 'undefined' && LQ.q) ? LQ.q.length : 0;
    showTab('b');
  }, { who: o.who || '', answers: o.answers || [], conf: o.conf, blockSS: !!o.blockSS });
  await sleep(200);
  const before = await p.evaluate(() => ({ n: DB.orders.length, wos: JSON.stringify(lists().map(l => l.wos)) }));
  if (o.slowBak) await p.evaluate(ms => { const f0 = window.fetch; window.fetch = async (u, opt) => { if (/planner_backups/.test(String(u)) && opt && opt.method === 'POST') await new Promise(r => setTimeout(r, ms)); return f0(u, opt); }; }, o.slowBak);
  await p.evaluate(n => { for (let i = 0; i < n; i++) document.getElementById('btn-clearall').click(); }, o.clicks == null ? 1 : o.clicks);
  await sleep(150);
  const picker = await p.evaluate(() => !!document.querySelector('.pod-ovl [data-pick]'));
  if (o.pick === 'cancel') await p.evaluate(() => { const x = document.getElementById('pod-x'); if (x) x.click(); });
  else if (o.pick === 'bg') await p.evaluate(() => { const ov = document.querySelector('.pod-ovl'); if (ov) ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  else if (o.pick && o.pick.other != null) await p.evaluate(t => { document.getElementById('pick-other').value = t; document.getElementById('pick-ok').click(); }, o.pick.other);
  else if (o.pick) await p.evaluate(n => { const b = [...document.querySelectorAll('.pod-ovl [data-pick]')].find(b => b.dataset.pick === n); if (b) b.click(); }, o.pick);
  if (o.mid) await o.mid(p);
  await sleep(o.wait || 1000);
  const st = await p.evaluate(() => ({ n: DB.orders.length, wos: JSON.stringify(lists().map(l => l.wos)), asked: window.__asked, conf: window.__conf, toasts: window.__toasts,
    lq: (typeof LQ !== 'undefined' && LQ.q ? LQ.q.length : 0) - window.__lq0, ovl: document.querySelectorAll('.pod-ovl').length }));
  return { S, D, p, picker, before, ...st };
}
const untouched = r => r.n === 3 && r.S.backups.length === 0 && r.wos === r.before.wos && r.lq === 0;
(async () => {
  const browser = await H.chromium.launch();
  try {
    let r;
    // H1. Another screen empties the board while this screen's name picker is open. The "Nothing to clear" rule is only
    //     checked at the click — so this screen still asks DELETE for "ALL 0 orders" and saves a 0-job safety backup
    //     (the 16 Nov rule: an empty board takes no 0-job backup). Low: nothing is lost.
    {
      const S = makeServer(base()); const D = await device(browser, S, { name: 'A' }); const p = D.page;
      await p.evaluate(() => { sessionStorage.removeItem('wpfWho'); window.__asked = []; const a = ['9000', 'DELETE'];
        window.prompt = m => { window.__asked.push(String(m)); return a.length ? a.shift() : null; }; window.confirm = () => true; showTab('b'); });
      await sleep(200);
      await p.evaluate(() => document.getElementById('btn-clearall').click());
      await sleep(150);
      const picker = await p.evaluate(() => !!document.querySelector('.pod-ovl [data-pick]'));
      // another PC cleared the board meanwhile: the fake server now holds 0 jobs, a newer version
      S.row.orders = []; S.row.version = (S.row.version || 1) + 1;
      await p.evaluate(async () => { await loadDB(); });
      const n0 = await p.evaluate(() => DB.orders.length);
      await p.evaluate(() => { const b = [...document.querySelectorAll('.pod-ovl [data-pick]')].find(b => b.dataset.pick === 'Mary Office'); if (b) b.click(); });
      await sleep(1200);
      const st = await p.evaluate(() => ({ asked: window.__asked }));
      rec('H1 (set-up) picker shown, then a refresh brought the board to 0 jobs', picker && n0 === 0, J({ picker, n0 }));
      rec('H1 board emptied by another screen while the name picker was open: no 0-job safety backup is taken',
        S.backups.every(b => b.orders_count > 0), J({ baks: S.backups.map(b => [b.orders_count, b.reason]), asked: st.asked }));
      rec('H1 ...and nobody is asked to type DELETE for "ALL 0 orders"', !st.asked.some(m => /ALL 0 orders/.test(m)), J(st.asked));
      await D.close();
    }
    // H2. Another screen ADDS jobs while the picker is open: the DELETE box must show the new count and the backup must hold them all.
    {
      const S = makeServer(base()); const D = await device(browser, S, { name: 'A' }); const p = D.page;
      await p.evaluate(() => { sessionStorage.removeItem('wpfWho'); window.__asked = []; const a = ['9000', 'DELETE'];
        window.prompt = m => { window.__asked.push(String(m)); return a.length ? a.shift() : null; }; window.confirm = () => true; showTab('b'); });
      await sleep(200);
      await p.evaluate(() => document.getElementById('btn-clearall').click());
      await sleep(150);
      S.row.orders = [...S.row.orders, H.order({ wo: 'WO-4' }), H.order({ wo: 'WO-5' })]; S.row.version = (S.row.version || 1) + 1;
      await p.evaluate(async () => { await loadDB(); });
      await p.evaluate(() => { const b = [...document.querySelectorAll('.pod-ovl [data-pick]')].find(b => b.dataset.pick === 'Mary Office'); if (b) b.click(); });
      await sleep(1500);
      const st = await p.evaluate(() => ({ asked: window.__asked, n: DB.orders.length }));
      rec('H2 jobs added by another screen during the picker: DELETE box says ALL 5 orders', st.asked.some(m => /ALL 5 orders/.test(m)), J(st.asked));
      rec('H2 ...and the safety backup holds all 5 jobs, reason carries the picked name', S.backups.length === 1 && S.backups[0].orders_count === 5 && /before Clear all orders · Mary Office \[office\]/.test(S.backups[0].reason || ''), J(S.backups.map(b => [b.orders_count, b.reason])));
      await D.close();
    }
    // H3. Name typed as only spaces in "Someone else" then a real name: reason never "?"
    r = await run(browser, { who: '', pick: { other: "  Seán O'Brien  " }, answers: ['9000', 'DELETE'], wait: 1500 });
    rec('H3 typed name with accents/apostrophe trimmed onto the backup reason', r.n === 0 && /before Clear all orders · Seán O'Brien \[office\]$/.test((r.S.backups[0] || {}).reason || ''), J(r.S.backups.map(b => b.reason)));
    await r.D.close();
    // H4. Admin PIN typed as the Office PIN on a device with the office PIN remembered: refused
    r = await run(browser, { who: 'Mary Office', answers: ['2468', 'DELETE'] });
    rec('H4 Office PIN is not the Admin PIN: nothing deleted, no backup', untouched(r), J({ n: r.n, baks: r.S.backups.length }));
    await r.D.close();
  } finally { await browser.close(); }
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
