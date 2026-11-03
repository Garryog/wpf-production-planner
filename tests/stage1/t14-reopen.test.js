// Tester round 11 (3 Nov 2026): attack the round-10 fixes — 78a5147 (reopen after a crash mid-save: a landed attempt's
// save tag is the merge base; pushPlan writes the device copy right after each send) and aaaa7a1 (warning box 36x36 buttons).
// Fake Supabase only (tsrv.js + a per-PATCH rig). Run: node tests/stage1/t14-reopen.test.js
const { H, makeServer, device, attach, sleep } = require('./tsrv');
const path = require('path');
process.on('unhandledRejection', () => {});
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 600) : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const base = () => ({ id: 'main', version: 1, nid: 50, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], settings: { listRow: { L: { keep: { m: 'saw', by: 'T' } } }, weekCaps: {} } });
const ticks = S => Object.keys(((S.row.settings || {}).listRow || {}).L || {}).sort().join(',');
const TICK = k => `(()=>{DB.listRow=DB.listRow||{};DB.listRow.L=DB.listRow.L||{};DB.listRow.L[${JSON.stringify(k)}]={m:'saw',by:'Saw'};})()`;
const UNTICK = k => `(()=>{if(DB.listRow&&DB.listRow.L)delete DB.listRow.L[${JSON.stringify(k)}];})()`;
const idle = p => p.waitForFunction(() => !SAVING, null, { timeout: 40000, polling: 30 }).catch(() => {});
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); }).catch(e => 'ERR ' + e.message);
const kick = p => p.evaluate(() => { clearTimeout(saveT); saveDB(); }).catch(() => {});
const st = p => p.evaluate(() => ({ failed: !!DB.saveFailed, pendFail: !!DB.pendFail, unsure: UNSURE.length, ver: VER, L: Object.keys((DB.listRow || {}).L || {}).sort().join(','), n1: (DB.orders.find(o => o.wo === 'WO-1') || {}).notes || '' }));
async function flush(p) { for (let i = 0; i < 4; i++) { await idle(p); await save(p); } await idle(p); }
async function waitFor(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); } return false; }
function apply(S, url, body, who) {
  const v = url.match(/version=eq\.(\d+)/);
  if (v && +v[1] !== S.row.version) { S.conflicts++; (S.trace = S.trace || []).push(who + ' refused(v' + v[1] + ' db' + S.row.version + ')'); return 'conflict'; }
  const before = S.row.version; Object.assign(S.row, JSON.parse(JSON.stringify(body))); S.row.version = before + 1; S.okSaves++;
  (S.trace = S.trace || []).push(who + ' v' + S.row.version + '[' + ticks(S) + ']');
  return 'ok';
}
// m.plan: {lost:true, at:ms} reply lost, request lands `at` ms later (never if <0); {at:ms} held then applied normally
async function rig(page, S, m, who) {
  await page.route(u => /supabase\.co/.test(String(u)), async route => {
    const q = route.request();
    if (/production_planner/.test(q.url()) && q.method() === 'PATCH') {
      const body = JSON.parse(q.postData() || '{}'), url = q.url();
      const b = m.plan && m.plan.length ? m.plan.shift() : null;
      const tag = ((body.settings || {}).saveIds || []).slice(-1)[0];
      (m.sent = m.sent || []).push('eq' + (url.match(/version=eq\.(\d+)/) || [])[1] + ':' + tag + (b ? (b.lost ? ':lost@' + b.at : ':held@' + b.at) : ''));
      if (b && b.lost) {
        if (b.at >= 0) { m.pending = (m.pending || 0) + 1; setTimeout(() => { m.pending--; apply(S, url, body, who + '(late)'); }, b.at); }
        return route.abort('connectionreset');
      }
      if (b && b.at) await sleep(b.at);
      const r = apply(S, url, body, who);
      if (r === 'conflict') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ version: S.row.version }]) });
    }
    return route.fallback();
  });
}
async function pair(browser, role = 'saw') {
  const S = makeServer(base());
  const saw = await device(browser, S, { name: 'saw' }, { role }), off = await device(browser, S, { name: 'office' }, { role: 'office' });
  saw.m = {}; off.m = {}; await rig(saw.page, S, saw.m, 'saw'); await rig(off.page, S, off.m, 'office');
  await flush(off.page); await flush(saw.page);
  return { S, saw, off };
}
const officeUntick = async (off, k) => off.page.evaluate(async k => { await loadDB(); if (DB.listRow && DB.listRow.L) delete DB.listRow.L[k]; clearTimeout(saveT); await saveDB(); }, k);
async function newTab(d, S, who) { // another tab in the same browser profile (shares the device copy, own sessionStorage)
  const p = await d.ctx.newPage(); p.on('pageerror', e => (d.dev.errors = d.dev.errors || []).push(String(e)));
  await attach(p, S, d.dev); const m = {}; await rig(p, S, m, who);
  await p.goto('https://wpf.test/?view=saw').catch(() => {});
  await p.waitForFunction(() => typeof loadDB === 'function' && DB.loaded, null, { timeout: 15000 }).catch(() => {});
  return { p, m };
}
async function reopen(d, S, who) { const t = await newTab(d, S, who); await sleep(1200); await flush(t.p); await sleep(300); await t.p.evaluate(async () => { await loadDB(); }); await flush(t.p); return t; }

(async () => {
  const browser = await H.chromium.launch();

  // (A) TWO TABS on one PC, both mid-save when the PC crashes
  for (const [name, p1, p2, untick, want] of [
    ['A1 tab1 Side lands 1 s, tab2 Top never lands; office unticks Side', [{ lost: true, at: 1000 }], [{ lost: true, at: -1 }], 'side', 'keep,top'],
    ['A2 tab2 Top lands 0.5 s, tab1 Side refused (same version); office unticks Top', [{ lost: true, at: 1000 }], [{ lost: true, at: 500 }], 'top', 'keep,side'],
    ['A3 tab1 Side lands, tab2 Top never; NO office change', [{ lost: true, at: 800 }], [{ lost: true, at: -1 }], null, 'keep,side,top'],
    ['A4 neither lands; office unticks Keep meanwhile', [{ lost: true, at: -1 }], [{ lost: true, at: -1 }], 'keep', 'side,top'],
  ]) {
    const { S, saw, off } = await pair(browser);
    const t2 = await newTab(saw, S, 'saw-tab2'); await flush(t2.p); await saw.page.evaluate(async () => { await loadDB(); }); // both tabs at the same version
    S.trace = []; saw.m.plan = p1.slice(); t2.m.plan = p2.slice();
    await saw.page.evaluate(TICK('side')); await t2.p.evaluate(TICK('top'));
    kick(saw.page); kick(t2.p); await sleep(120);
    const slots = await saw.page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('wpfPending:') === 0).length + Object.keys((JSON.parse(localStorage.getItem('wpfPending') || '{}').tabs) || {}).length).catch(() => -1);
    rec('(A) ' + name + ': both tabs\' unsaved changes are in the device copy (2 slots) while both saves are out', slots === 2, 'slots=' + slots);
    await saw.page.close({ runBeforeUnload: false }); await t2.p.close({ runBeforeUnload: false });
    await waitFor(() => !saw.m.pending && !t2.m.pending, 4000);
    if (untick) { await waitFor(() => ticks(S).includes(untick), 3000); await officeUntick(off, untick); await idle(off.page); }
    const r = await reopen(saw, S, 'saw-reopen'); const s = await st(r.p);
    rec('(A) ' + name + ': database ' + want, ticks(S) === want && s.L === want, 'db=' + ticks(S) + ' screen=' + JSON.stringify(s) + ' trace=' + S.trace.join(' > '));
    await off.close(); await saw.ctx.close().catch(() => {});
  }

  // (B) a save that landed + a LATER unsaved edit on the same tab, then the tab closes during the check
  for (const [name, edit, untick, wantT, wantNote] of [
    ['B1 tick Side sent+landed, then tick Top (unsaved); office unticks Side', TICK('top'), 'side', 'keep,top', ''],
    ['B2 tick Side sent+landed, then a note on WO-1 (unsaved); office unticks Side', `DB.orders.find(o=>o.wo==='WO-1').notes='saw note'`, 'side', 'keep', 'saw note'],
    ['B3 tick Side sent+landed, then the saw itself unticks Side (unsaved); no office change', UNTICK('side'), null, 'keep', ''],
    ['B4 tick Side sent+landed, then untick Keep on the saw (unsaved); office unticks Side', UNTICK('keep'), 'side', '', ''],
    ['B5 tick Side sent+landed, then tick Top; office unticks Side AND ticks Top too', TICK('top'), 'side+top', 'keep,top', ''],
  ]) {
    const { S, saw, off } = await pair(browser);
    S.trace = []; saw.m.plan = [{ lost: true, at: 900 }];
    await saw.page.evaluate(TICK('side')); kick(saw.page);
    await sleep(40); await saw.page.evaluate(edit); await saw.page.evaluate(() => writePend()); // the edit reaches the device copy
    await sleep(60); await saw.page.close({ runBeforeUnload: false });
    await waitFor(() => !saw.m.pending, 4000);
    if (untick === 'side') { await officeUntick(off, 'side'); await idle(off.page); }
    if (untick === 'side+top') { await off.page.evaluate(async () => { await loadDB(); delete DB.listRow.L.side; DB.listRow.L.top = { m: 'saw', by: 'Office' }; clearTimeout(saveT); await saveDB(); }); await idle(off.page); }
    const r = await reopen(saw, S, 'saw-reopen'); const s = await st(r.p);
    const n1 = (S.row.orders.find(o => o.wo === 'WO-1') || {}).notes || '';
    rec('(B) ' + name + ': database [' + wantT + ']' + (wantNote ? ' + note kept' : ''), ticks(S) === wantT && s.L === wantT && n1 === wantNote, 'db=' + ticks(S) + ' note=' + JSON.stringify(n1) + ' screen=' + JSON.stringify(s) + ' trace=' + S.trace.join(' > ') + ' sent=' + saw.m.sent);
    await off.close(); await saw.ctx.close().catch(() => {});
  }

  // (C) several 'slow' re-sends before closing
  for (const [name, plan, midEdit, closeAt, untick, want] of [
    ['C1 4 sends, none arrive in time; the 1st lands at 2 s (after close); office unticks Side', [{ lost: true, at: 2000 }, { lost: true, at: -1 }, { lost: true, at: -1 }, { lost: true, at: -1 }], false, 1000, 'side', 'keep'],
    ['C2 4 sends, the LAST one lands 1.5 s later; office unticks Side', [{ lost: true, at: -1 }, { lost: true, at: -1 }, { lost: true, at: -1 }, { lost: true, at: 1500 }, { lost: true, at: -1 }], false, 1000, 'side', 'keep'],
    ['C3 Top tapped between re-sends (2 tags); the OLD tag (Side only) lands at 2.5 s; office unticks Side', [{ lost: true, at: 2500 }, { lost: true, at: -1 }, { lost: true, at: -1 }, { lost: true, at: -1 }], true, 1000, 'side', 'keep,top'],
    ['C4 Top tapped between re-sends; the NEW tag (Side+Top) lands at 1.5 s; office unticks Side', [{ lost: true, at: -1 }, { lost: true, at: 1500 }, { lost: true, at: -1 }, { lost: true, at: -1 }], true, 1000, 'side', 'keep,top'],
    ['C5 Top tapped between re-sends; nothing ever lands; no office change', Array.from({ length: 8 }, () => ({ lost: true, at: -1 })), true, 1000, null, 'keep,side,top'],
    ['C6 4 sends, the 1st lands at 6 s (AFTER the reopen); no office change', [{ lost: true, at: 6000 }, { lost: true, at: -1 }, { lost: true, at: -1 }, { lost: true, at: -1 }], false, 1000, null, 'keep,side'],
  ]) {
    const { S, saw, off } = await pair(browser);
    S.trace = []; saw.m.plan = plan.slice();
    await saw.page.evaluate(TICK('side')); kick(saw.page);
    if (midEdit) { await sleep(120); await saw.page.evaluate(TICK('top')); }
    await sleep(closeAt - (midEdit ? 120 : 0));
    const sends = (saw.m.sent || []).length;
    await saw.page.close({ runBeforeUnload: false });
    if (untick) { await waitFor(() => ticks(S).includes(untick), 6000); await officeUntick(off, untick); await idle(off.page); }
    const r = await reopen(saw, S, 'saw-reopen');
    if (saw.m.pending) { await waitFor(() => !saw.m.pending, 8000); await sleep(300); await r.p.evaluate(async () => { await loadDB(); }); await flush(r.p); }
    const s = await st(r.p);
    rec('(C) ' + name + ': database ' + want, ticks(S) === want && s.L === want && !s.failed, 'sends before close=' + sends + ' db=' + ticks(S) + ' screen=' + JSON.stringify(s) + ' trace=' + S.trace.join(' > ') + ' sent=' + saw.m.sent);
    await off.close(); await saw.ctx.close().catch(() => {});
  }

  // (C7) the landed tag has rotated out of saveIds (more than 40 other saves before the reopen, e.g. overnight)
  {
    const { S, saw, off } = await pair(browser);
    S.trace = []; saw.m.plan = [{ lost: true, at: 800 }];
    await saw.page.evaluate(TICK('side')); kick(saw.page); await sleep(120); await saw.page.close({ runBeforeUnload: false });
    await waitFor(() => ticks(S).includes('side'), 4000);
    await officeUntick(off, 'side'); await idle(off.page);
    for (let i = 0; i < 45; i++) await off.page.evaluate(async i => { DB.weekCaps['w' + i] = i + 1; clearTimeout(saveT); await saveDB(); }, i);
    const tagGone = !(S.row.settings.saveIds || []).some(t => (saw.m.sent[0] || '').includes(t));
    const r = await reopen(saw, S, 'saw-reopen'); const s = await st(r.p);
    rec('(C7) landed save, office unticks, then 45 more office saves (tag rotated out of saveIds: ' + tagGone + '), reopen: tick stays off', ticks(S) === 'keep' && s.L === 'keep', 'db=' + ticks(S) + ' screen=' + s.L + ' ids in db=' + (S.row.settings.saveIds || []).length);
    await off.close(); await saw.ctx.close().catch(() => {});
  }

  // (D) device storage full / blocked during a save
  const FULL = all => `(()=>{const si=Storage.prototype.setItem;window.__si=si;Storage.prototype.setItem=function(k,v){if(${all ? 'true' : "String(k).indexOf('wpfPending')===0"})throw new DOMException('full','QuotaExceededError');return si.call(this,k,v);};})()`;
  {
    const { S, saw, off } = await pair(browser);
    await saw.page.evaluate(FULL(false)); await saw.page.evaluate(TICK('side')); await flush(saw.page);
    const s = await st(saw.page), errs = (saw.dev.errors || []).length;
    rec('(D1) storage full during a normal save: the save still lands, no page error', ticks(S) === 'keep,side' && !s.failed && !errs, 'db=' + ticks(S) + ' ' + JSON.stringify(s) + ' errors=' + JSON.stringify(saw.dev.errors));
    // offline + storage full → bar must not promise the device copy
    saw.dev.offline = true; saw.m.plan = Array.from({ length: 30 }, () => ({ lost: true, at: -1 })); await saw.page.evaluate(TICK('top')); await save(saw.page); await idle(saw.page);
    const bar = await saw.page.evaluate(() => { const b = document.getElementById('savebar'); return b.hidden ? '' : b.textContent; });
    rec('(D2) storage full + no signal: red bar shows and says the device could NOT keep a copy', /could NOT keep/.test(bar), 'bar=' + bar.slice(0, 120));
    saw.dev.offline = false; saw.m.plan = []; await flush(saw.page);
    rec('(D3) signal back with storage still full: Top saved', ticks(S) === 'keep,side,top', 'db=' + ticks(S));
    await off.close(); await saw.close();
  }
  for (const all of [false, true]) { // storage full DURING a slow save: the reply is lost, the tab closes
    const { S, saw, off } = await pair(browser);
    S.trace = []; saw.m.plan = [{ lost: true, at: 900 }];
    await saw.page.evaluate(TICK('side')); await saw.page.evaluate(() => writePend()); // device copy written while there was room (no tag yet)
    await saw.page.evaluate(FULL(all)); kick(saw.page); await sleep(120);
    const pf = await saw.page.evaluate(() => DB.pendFail).catch(() => '?');
    await saw.page.close({ runBeforeUnload: false });
    await waitFor(() => ticks(S).includes('side'), 4000); await officeUntick(off, 'side'); await idle(off.page);
    const r = await reopen(saw, S, 'saw-reopen'); const s = await st(r.p);
    rec('(D4' + (all ? 'b all keys' : 'a pending key') + ') storage full at the send (copy without the tag), save landed, office unticked, reopen: tick stays off', ticks(S) === 'keep' && s.L === 'keep', 'pendFail at send=' + pf + ' db=' + ticks(S) + ' screen=' + s.L + ' trace=' + S.trace.join(' > '));
    await off.close(); await saw.ctx.close().catch(() => {});
  }
  { // storage full after a normal save, with another tab's slot present: this tab's stale slot can't be cleared
    const { S, saw, off } = await pair(browser);
    const t2 = await newTab(saw, S, 'tab2'); await flush(t2.p);
    t2.m.plan = Array.from({ length: 50 }, () => ({ lost: true, at: -1 })); saw.dev.offline = false;
    await t2.p.evaluate(() => { DB.weekCaps.t2 = 7; }); await t2.p.evaluate(() => writePend()); // tab2 has an unsent change in its slot
    await saw.page.evaluate(TICK('side')); await saw.page.evaluate(() => writePend()); // saw's slot: Side (before any send)
    await saw.page.evaluate(FULL(false)); await flush(saw.page); // save lands; clearing the slot fails (full)
    const slot = await saw.page.evaluate(() => { return Object.keys(localStorage).filter(k => k.indexOf('wpfPending:') === 0).length + Object.keys((JSON.parse(localStorage.getItem('wpfPending') || '{}').tabs) || {}).length; });
    await officeUntick(off, 'side'); await idle(off.page);
    await saw.page.close({ runBeforeUnload: false }); await t2.p.close({ runBeforeUnload: false });
    const r = await reopen(saw, S, 'saw-reopen'); const s = await st(r.p);
    rec('(D5) storage full after a good save leaves this tab\'s old slot (Side) behind; office unticks; reopen: tick stays off', ticks(S) === 'keep' && s.L === 'keep' && (S.row.settings.weekCaps || {}).t2 === 7, 'slots left=' + slot + ' db=' + ticks(S) + ' screen=' + s.L + ' t2cap=' + (S.row.settings.weekCaps || {}).t2);
    await off.close(); await saw.ctx.close().catch(() => {});
  }
  { // storage BLOCKED entirely (getItem throws too) — the page still loads and saves
    const S = makeServer(base());
    const ctx = await browser.newContext({ viewport: { width: 400, height: 800 } });
    await ctx.addInitScript(() => { window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'T'; try { localStorage.setItem('wpfRole', 'saw'); localStorage.setItem('wpfPin_saw', '9000'); sessionStorage.setItem('wpfWho', 'T'); } catch (e) {}
      const gi = Storage.prototype.getItem, si = Storage.prototype.setItem; Storage.prototype.getItem = function (k) { if (String(k).indexOf('wpfPending') === 0) throw new DOMException('blocked', 'SecurityError'); return gi.call(this, k); }; Storage.prototype.setItem = function (k, v) { if (String(k).indexOf('wpfPending') === 0) throw new DOMException('blocked', 'SecurityError'); return si.call(this, k, v); }; });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); await attach(p, S, { name: 'blk' });
    await p.goto('https://wpf.test/?view=saw').catch(() => {});
    const ok = await p.waitForFunction(() => typeof DB !== 'undefined' && DB.loaded, null, { timeout: 15000 }).then(() => true).catch(() => false);
    if (ok) { await p.evaluate(() => { DB.listRow = DB.listRow || {}; DB.listRow.L = DB.listRow.L || {}; DB.listRow.L.blk = { m: 'saw' }; }); await flush(p); }
    rec('(D6) device copy blocked (reads and writes throw): page loads and a tick still saves', ok && ticks(S).includes('blk') && !errs.length, 'loaded=' + ok + ' db=' + ticks(S) + ' errors=' + errs.slice(0, 3).join(' | ').slice(0, 300));
    await ctx.close();
  }

  // (E) timing: 2,500 jobs, 8 saves each with one edit — new code vs the code before 78a5147 (b7b54e3)
  {
    const OLDH = require('child_process').execSync('git -C ' + path.join(__dirname, '../..') + ' show b7b54e3:index.html', { maxBuffer: 1 << 26 }).toString();
    const big = base(); big.orders = []; for (let i = 0; i < 2500; i++) big.orders.push(H.order({ wo: 'WO-' + i, log: Array.from({ length: 20 }, (_, j) => ({ at: '2026-10-01', by: 'x', what: 'edit ' + j })) }));
    const res = {};
    for (const [lbl, html] of [['before', OLDH], ['after', null], ['before2', OLDH], ['after2', null]]) {
      const S = makeServer(big);
      const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
      await ctx.addInitScript(() => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('wpfRole', 'office'); localStorage.setItem('wpfPin_office', '2468'); localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); sessionStorage.setItem('wpfWho', 'T'); } window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'T'; });
      const p = await ctx.newPage(); await attach(p, S, { name: lbl });
      if (html) await p.route(u => String(u).startsWith('https://wpf.test/') && !String(u).includes('?v='), r => r.request().method() === 'HEAD' ? r.fulfill({ status: 200, body: '' }) : r.fulfill({ status: 200, contentType: 'text/html', body: html }));
      await p.goto('https://wpf.test/?view=office'); await p.waitForFunction(() => typeof DB !== 'undefined' && DB.loaded, null, { timeout: 30000 }).catch(() => {});
      await idle(p);
      const t = await p.evaluate(async () => { const out = []; for (let i = 0; i < 8; i++) { DB.orders[i * 300].notes = 'n' + i; clearTimeout(saveT); const t0 = performance.now(); await saveDB(); out.push(Math.round(performance.now() - t0)); }
        const t1 = performance.now(); for (let i = 0; i < 5; i++) writePend(); return { saves: out, wp: Math.round((performance.now() - t1) / 5), saved: !DB.saveFailed }; });
      res[lbl] = t; await ctx.close();
    }
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
    const b = Math.min(med(res.before.saves), med(res.before2.saves)), a = Math.min(med(res.after.saves), med(res.after2.saves));
    info('(E) 2,500 jobs: save times ms before 78a5147', JSON.stringify(res.before.saves) + ' ' + JSON.stringify(res.before2.saves));
    info('(E) 2,500 jobs: save times ms after 78a5147', JSON.stringify(res.after.saves) + ' ' + JSON.stringify(res.after2.saves) + '  one device-copy write ≈ ' + res.after.wp + ' ms');
    rec('(E) 2,500 jobs: median save not more than 50% (+150 ms) slower with the extra device-copy write', a <= b * 1.5 + 150 && res.after.saved, 'median before=' + b + ' ms, after=' + a + ' ms');
  }

  // (F) warning box on short landscape phones
  for (const vp of [{ width: 640, height: 360 }, { width: 740, height: 380 }, { width: 360, height: 640 }]) {
    const S = makeServer(base());
    const d = await device(browser, S, { name: 'box' }, { role: 'saw', viewport: vp }); const p = d.page; const tag = vp.width + 'x' + vp.height;
    await p.evaluate(() => { for (let i = 1; i <= 3; i++) toast('Warning ' + i + ': "Carcass side panel left hand ' + i + '" was changed on another screen (already cut by Dee 10:00). Showing it as it is now.', true); });
    const g = await p.evaluate(() => {
      const t = document.getElementById('toast'), R = e => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), vis: getComputedStyle(e).display !== 'none' }; };
      const x = t.querySelector('.toast-x'), up = t.querySelector('.toast-up'), dn = t.querySelector('.toast-dn');
      const hit = e => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === e; };
      return { box: R(t), x: R(x), up: R(up), dn: R(dn), scr: t.classList.contains('scr'), hx: hit(x), hu: hit(up), hd: hit(dn), vh: innerHeight };
    });
    const ov = (a, b) => a.vis && b.vis && a.t < b.b && b.t < a.b && a.l < b.r && b.l < a.r;
    rec('(F1/' + tag + ') ✕, ▲ and ▼ do not overlap and each takes its own tap', !ov(g.x, g.up) && !ov(g.up, g.dn) && !ov(g.x, g.dn) && g.hx && (!g.scr || (g.hu && g.hd)), JSON.stringify(g));
    // stepping up must reach the oldest warning
    let firstSeen = false;
    for (let i = 0; i < 15 && !firstSeen; i++) {
      const b = await p.evaluate(() => { const e = document.querySelector('#toast .toast-up'); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      firstSeen = await p.evaluate(() => { const l = document.querySelector('#toast .toast-l'); return l.scrollTop <= 1; });
      if (firstSeen || !b) break; await p.mouse.click(b.x, b.y); await sleep(30);
    }
    firstSeen = firstSeen || await p.evaluate(() => document.querySelector('#toast .toast-l').scrollTop <= 1);
    rec('(F2/' + tag + ') tapping ▲ reaches the oldest warning', firstSeen, 'scrollTop=' + await p.evaluate(() => document.querySelector('#toast .toast-l').scrollTop));
    // tap-through: a button placed under the box (not under the ✕/▲/▼ column) gets the tap
    const tt = await p.evaluate(() => { const t = document.getElementById('toast'), b = t.getBoundingClientRect(); const btn = document.createElement('button'); btn.textContent = 'under'; btn.style.cssText = `position:fixed;left:${b.left + 4}px;top:${b.top + 4}px;width:${Math.max(10, b.width - 60)}px;height:${Math.max(10, b.height - 8)}px;z-index:1`; document.body.appendChild(btn); const hit = document.elementFromPoint(b.left + 10, b.top + b.height / 2); btn.remove(); return { hitIsBtn: hit === btn, box: [Math.round(b.width), Math.round(b.height)] }; });
    rec('(F3/' + tag + ') a tap on the box body passes through to the button under it', tt.hitIsBtn, JSON.stringify(tt));
    await d.close();
  }

  await browser.close(); console.log(fail + ' failed of ' + (pass + fail));
})().catch(e => { console.error(e); process.exit(1); });
