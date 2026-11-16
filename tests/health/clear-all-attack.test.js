// Tester attack, health check 16 Nov 2026: "Clear All Orders" guard (name -> Admin PIN -> type DELETE -> backup -> wipe).
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
    // A. Office-PIN-only user: device has wpfPin_office set; types Office PIN, a blank-padded Office PIN, a role PIN
    for (const pin of ['2468', ' 2468 ', '7777', '90000', '900']) {
      r = await run(browser, { who: 'Mary Office', answers: [pin, 'DELETE', 'DELETE'] });
      rec('A wrong Admin PIN ' + J(pin) + ': nothing deleted, lists untouched, no backup, DELETE box never shown', untouched(r) && r.asked.length === 1 && r.toasts.some(t => /Wrong Admin PIN/.test(t)), J({ n: r.n, bak: r.S.backups.length, asked: r.asked.length, toasts: r.toasts }));
      await r.D.close();
    }
    // A2. Admin PIN changed in Settings: the factory 9000 must NOT work any more; the new one must
    r = await run(browser, { who: 'Mary Office', settings: { pins: { admin: '1357', office: '2468' } }, answers: ['9000', 'DELETE'] });
    rec('A2 Admin PIN changed to 1357: old default 9000 refused', untouched(r) && r.asked.length === 1, J({ n: r.n, asked: r.asked.length }));
    await r.D.close();
    r = await run(browser, { who: 'Mary Office', settings: { pins: { admin: '1357', office: '2468' } }, answers: [' 1357 ', 'DELETE'] });
    rec('A2 Admin PIN changed to 1357: " 1357 " (spaces) accepted and clears', r.n === 0 && r.S.backups.length === 1, J({ n: r.n, bak: r.S.backups.length }));
    await r.D.close();

    // B. Cancel at every step
    r = await run(browser, { who: '', answers: ['9000', 'DELETE'], pick: 'bg' });
    rec('B1 name picker closed by tapping outside: nothing deleted, no PIN asked, overlay gone', r.picker && untouched(r) && r.asked.length === 0 && r.ovl === 0, J({ n: r.n, asked: r.asked.length, ovl: r.ovl }));
    await r.D.close();
    r = await run(browser, { who: '', answers: ['9000', 'DELETE'], pick: { other: '   ' } });
    rec('B2 name picker with blank "Someone else" + OK: stays open, nothing deleted, no PIN asked', r.picker && untouched(r) && r.asked.length === 0 && r.ovl === 1, J({ n: r.n, asked: r.asked.length, ovl: r.ovl }));
    await r.D.close();
    r = await run(browser, { who: 'Mary Office', answers: [] });
    rec('B3 Admin PIN box cancelled: nothing deleted, lists untouched, no "wrong PIN" nag', untouched(r) && !r.toasts.some(t => /Wrong/.test(t)), J({ n: r.n, toasts: r.toasts }));
    await r.D.close();
    r = await run(browser, { who: 'Mary Office', answers: ['9000'] /* DELETE box -> null (Cancel) */ });
    rec('B4 DELETE box cancelled: nothing deleted, lists untouched, no backup, no "must type DELETE" toast', untouched(r) && r.asked.length === 2 && !r.toasts.some(t => /must type/.test(t)), J({ n: r.n, toasts: r.toasts }));
    await r.D.close();
    for (const t of ['DELETE ', ' DELETE', 'Delete', '']) {
      r = await run(browser, { who: 'Mary Office', answers: ['9000', t] });
      rec('B5 DELETE box answered ' + J(t) + ': nothing deleted', untouched(r), J({ n: r.n }));
      await r.D.close();
    }
    // C. Backup fails
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'DELETE'], noBak: true, conf: false });
    rec('C1 backup fails + "go ahead without backup?" = Cancel: nothing deleted, lists untouched', r.n === 3 && r.wos === r.before.wos && r.lq === 0 && r.conf.some(m => /FAILED/.test(m)), J({ n: r.n, conf: r.conf.map(m => m.slice(0, 60)) }));
    await sleep(1500); rec('C1 server still has the 3 jobs', (r.S.row.orders || []).length === 3, (r.S.row.orders || []).length);
    await r.D.close();
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'DELETE'], noBak: true, conf: true });
    rec('C2 backup fails + person says go ahead: cleared (person decides, as before)', r.n === 0, J({ n: r.n }));
    await r.D.close();

    // D. Name on the backup reason
    r = await run(browser, { who: '', answers: ['9000', 'DELETE'], pick: { other: "  O'Grady <b>x</b> 😀  " } });
    const reason = (r.S.backups[0] || {}).reason || '';
    rec('D1 typed name (spaces, apostrophe, HTML, emoji) is trimmed and on the backup reason as text', r.n === 0 && reason.endsWith("O'Grady <b>x</b> 😀 [office]"), reason);
    rec('D1 toast names the person', r.toasts.some(t => t === "All orders cleared by O'Grady <b>x</b> 😀"), J(r.toasts));
    rec('D1 no HTML injected into the page from the name', await r.p.evaluate(() => !document.querySelector('#toast b, .pod-ovl b')), '');
    await r.D.close();
    r = await run(browser, { who: '', answers: ['9000', 'DELETE'], pick: "Garry O'Grady" });
    rec("D2 picker button with an apostrophe (Garry O'Grady) works and is on the reason", r.n === 0 && /Garry O'Grady \[office\]$/.test((r.S.backups[0] || {}).reason || ''), (r.S.backups[0] || {}).reason);
    await r.D.close();
    r = await run(browser, { who: '', answers: ['9000', 'DELETE'], pick: 'Mary Office', blockSS: true });
    rec('D3 browser blocks tab storage (sessionStorage): the picked name still reaches the backup reason', r.n === 0 && /Mary Office/.test((r.S.backups[0] || {}).reason || ''), (r.S.backups[0] || {}).reason);
    await r.D.close();

    // E. Pressing twice
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'DELETE', '9000', 'DELETE'], clicks: 2 });
    rec('E1 double-click (dialogs answered both times): ends with 0 jobs, no page errors', r.n === 0 && !r.D.dev.errors.length, J({ n: r.n, err: r.D.dev.errors }));
    rec('E1 double-click: at most one safety backup with jobs in it, none with 0 jobs', r.S.backups.every(b => b.orders_count === 3), J(r.S.backups.map(b => b.orders_count)));
    await r.D.close();
    // second press while the backup is still on its way (slow line)
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'DELETE', '9000', 'DELETE'], slowBak: 1500, wait: 4000,
      mid: async p => { await sleep(300); await p.evaluate(() => document.getElementById('btn-clearall') && document.getElementById('btn-clearall').click()); } });
    rec('E2 pressed again while the first backup is in flight: 0 jobs at the end, every backup taken holds all 3 jobs', r.n === 0 && r.S.backups.length >= 1 && r.S.backups.every(b => b.orders_count === 3), J({ n: r.n, baks: r.S.backups.map(b => b.orders_count), asked: r.asked.length }));
    await r.D.close();
    // pressing again after a successful clear
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'DELETE', '9000', 'DELETE'], wait: 1500,
      mid: async p => { await sleep(1200); await p.evaluate(() => document.getElementById('btn-clearall').click()); } });
    rec('E3 info: pressing Clear All again on an empty board takes another (0-job) backup', true, J(r.S.backups.map(b => b.orders_count)));
    await r.D.close();

    // F. Other board edits that use the name still work
    r = await run(browser, { who: 'Mary Office', answers: [], clicks: 0 });
    const f = await r.p.evaluate(async () => {
      const sel = document.querySelector('[data-wsel="WO-1"]'); if (!sel) return { none: true };
      const opt = [...sel.options].find(o => o.value && o.value !== sel.value); sel.value = opt.value; sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 200)); const o = DB.orders.find(x => x.wo === 'WO-1'); return { wk: o.plannedWeek, want: opt.value, log: (o.log || []).slice(-1)[0] };
    });
    rec('F1 build-week change still stamped with the tab name', !f.none && f.wk === f.want && f.log && f.log.by === 'Mary Office', J(f));
    await r.D.close();
    r = await run(browser, { who: '', answers: [], clicks: 0 });
    const f2 = await r.p.evaluate(async () => {
      const sel = document.querySelector('[data-wsel="WO-2"]'); const opt = [...sel.options].find(o => o.value && o.value !== sel.value); sel.value = opt.value; sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 100)); const b = [...document.querySelectorAll('.pod-ovl [data-pick]')].find(b => b.dataset.pick === 'Mary Office'); b && b.click();
      await new Promise(r => setTimeout(r, 200)); const o = DB.orders.find(x => x.wo === 'WO-2'); return { wk: o.plannedWeek, want: opt.value, log: (o.log || []).slice(-1)[0], who: whoNow() };
    });
    rec('F2 no name yet: build-week change asks the name, then saves with it', f2.wk === f2.want && f2.log && f2.log.by === 'Mary Office' && f2.who === 'Mary Office', J(f2));
    // then Clear All on the same tab goes straight to the PIN (name remembered)
    await r.p.evaluate(() => { const a = ['9000', 'DELETE']; window.__asked = []; window.prompt = m => { window.__asked.push(m); return a.shift() || null; }; document.getElementById('btn-clearall').click(); });
    await sleep(1000);
    const f3 = await r.p.evaluate(() => ({ n: DB.orders.length, ovl: document.querySelectorAll('.pod-ovl').length }));
    rec('F3 name given for an earlier edit is reused by Clear All (no second picker) and on the reason', f3.n === 0 && f3.ovl === 0 && /Mary Office \[office\]$/.test((r.S.backups[0] || {}).reason || ''), J({ ...f3, reason: (r.S.backups[0] || {}).reason }));
    await r.D.close();

    // G. V1 lists: WO links emptied after a successful clear (unchanged behaviour); kept on cancel (covered above)
    r = await run(browser, { who: 'Mary Office', answers: ['9000', 'DELETE'], wait: 2000 });
    rec('G1 V1 lists: WO links cleared after the wipe', r.n === 0 && r.wos === '[[]]', r.wos);
    rec('G1 V1 lists: the list itself is kept (saved to server)', ((r.S.row.settings || {}).lists || []).length === 1 && J(r.S.row.settings.lists[0].wos) === '[]', J((r.S.row.settings || {}).lists));
    rec('G1 export baseline emptied (no stale Week/Step Was rows after clear)', await r.p.evaluate(() => !Object.keys(orig).length && !Object.keys(origStep).length), '');
    await r.D.close();
  } finally { await browser.close(); }
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
