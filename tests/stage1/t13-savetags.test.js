// Tester round 10 (3 Nov 2026): attack the save tags (7cfaf3b, 55b7ad9, 2e7fbcb) and the 'slow' outcome (a2ab59c).
// A save request whose reply is lost and which itself reaches the database 0.3-5 s LATER (after the 0.25 s look, so the
// screen has already re-sent it). The office unticks meanwhile. Does the tick ever come back?
// Expected failures on 3 Nov code: (c) a1/a2 and (b/c) b1 (old-code tab untick + slow save that landed first → tick comes
// back) and (f) f1/f2 (tab closed during the check, its save landed, office unticked, reopen → tick comes back).
// Fake Supabase only (tsrv.js + an extra route on top). Run: node tests/stage1/t13-savetags.test.js
const { H, makeServer, device, attach, sleep } = require('./tsrv');
process.on('unhandledRejection', () => {});
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 500) : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const base = () => ({ id: 'main', version: 1, nid: 50, orders: [H.order({ wo: 'WO-1' }), H.order({ wo: 'WO-2' })], settings: { listRow: { L: { keep: { m: 'saw', by: 'T' } } }, weekCaps: {} } });
const ticks = S => Object.keys(((S.row.settings || {}).listRow || {}).L || {}).sort().join(',');
const TICK = k => `(()=>{DB.listRow=DB.listRow||{};DB.listRow.L=DB.listRow.L||{};DB.listRow.L[${JSON.stringify(k)}]={m:'saw',by:'Saw'};})()`;
const UNTICK = k => `(()=>{if(DB.listRow&&DB.listRow.L)delete DB.listRow.L[${JSON.stringify(k)}];})()`;
const idle = p => p.waitForFunction(() => !SAVING, null, { timeout: 40000, polling: 30 }).catch(() => {});
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); }).catch(e => 'ERR ' + e.message);
const kick = p => p.evaluate(() => { clearTimeout(saveT); saveDB(); }).catch(() => {});
const st = p => p.evaluate(() => ({ failed: !!DB.saveFailed, unsure: UNSURE.length, ver: VER, saving: !!SAVING, ids: (DB.saveIds || []).length, L: Object.keys((DB.listRow || {}).L || {}).sort().join(',') }));
async function flush(p) { for (let i = 0; i < 4; i++) { await idle(p); await save(p); } await idle(p); }
async function waitFor(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); } return false; }
let maxIds = 0;
function apply(S, url, body, who) {
  const v = url.match(/version=eq\.(\d+)/);
  if (v && +v[1] !== S.row.version) { S.conflicts++; (S.trace = S.trace || []).push(who + ' refused(v' + v[1] + ' db' + S.row.version + ')'); return 'conflict'; }
  const before = S.row.version; Object.assign(S.row, JSON.parse(JSON.stringify(body))); S.row.version = before + 1; S.okSaves++;
  const n = ((S.row.settings || {}).saveIds || []).length; if (n > maxIds) maxIds = n;
  (S.trace = S.trace || []).push(who + ' v' + S.row.version + '[' + ticks(S) + ']');
  return 'ok';
}
// m.plan: list of behaviours for the next PATCHes, in order:
//   {lost:true, at:ms}  reply lost at once; the request itself reaches the database `at` ms later (or never if at<0)
//   {at:ms}             request held `at` ms, then applied and its reply delivered normally
async function rig(page, S, m, who) {
  await page.route(u => /supabase\.co/.test(String(u)), async route => {
    const q = route.request();
    if (/production_planner/.test(q.url()) && q.method() === 'PATCH') {
      const body = JSON.parse(q.postData() || '{}'), url = q.url();
      const ver = (url.match(/version=eq\.(\d+)/) || [])[1];
      // every PATCH goes through here so the trace and the tag high-water mark are kept
      const b = m.plan && m.plan.length ? m.plan.shift() : null;
      const tag = ((body.settings || {}).saveIds || []).slice(-1)[0];
      (m.sent = m.sent || []).push('eq' + ver + ':' + tag + (b ? (b.lost ? ':lost@' + b.at : ':held@' + b.at) : ''));
      if (b && b.lost) {
        if (b.at >= 0) { m.pending = (m.pending || 0) + 1; setTimeout(() => { m.pending--; apply(S, url, body, who + '(late#' + m.sent.length + ')'); }, b.at); }
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
async function trio(browser, n = 2) {
  const S = makeServer(base());
  const saw = await device(browser, S, { name: 'saw' }, { role: 'saw' }), off = await device(browser, S, { name: 'office' }, { role: 'office' });
  saw.m = {}; off.m = {}; await rig(saw.page, S, saw.m, 'saw'); await rig(off.page, S, off.m, 'office');
  let third = null;
  if (n > 2) { third = await device(browser, S, { name: 'stores' }, { role: 'stores' }); third.m = {}; await rig(third.page, S, third.m, 'stores'); }
  await flush(off.page); await flush(saw.page);
  return { S, saw, off, third };
}
const officeUntick = async (off, k) => off.page.evaluate(async k => { await loadDB(); if (DB.listRow && DB.listRow.L) delete DB.listRow.L[k]; clearTimeout(saveT); await saveDB(); }, k);
// An old-code tab (today's live main): loads the row, unticks, saves the whole settings WITHOUT saveIds; trigger bumps version
function oldTabUntick(S, k) { const s = JSON.parse(JSON.stringify(S.row.settings || {})); delete s.saveIds; if (s.listRow && s.listRow.L) delete s.listRow.L[k]; S.row.settings = s; S.row.version++; (S.trace = S.trace || []).push('OLDTAB v' + S.row.version + '[' + ticks(S) + ']'); }
async function settle(S, sides) { await waitFor(() => sides.every(d => !d.m.pending), 9000); await sleep(200); }

(async () => {
  const browser = await H.chromium.launch();

  // (a) the first request is lost and lands late; the re-send lands at different times; the office unticks as soon as it sees the tick
  const A = [
    ['a1 slow lands 0.3 s, re-send held 1.5 s (slow one first)', [{ lost: true, at: 300 }, { at: 1500 }]],
    ['a2 slow lands 2 s, re-send held 3.5 s (slow one first)', [{ lost: true, at: 2000 }, { at: 3500 }]],
    ['a3 slow lands 5 s, re-send immediate (re-send first)', [{ lost: true, at: 5000 }]],
    ['a4 slow lands 1 s, re-send ALSO lost and lands 2.5 s', [{ lost: true, at: 1000 }, { lost: true, at: 2500 }]],
    ['a5 slow lands 4 s, re-send lost and lands 0.5 s later than sent', [{ lost: true, at: 4000 }, { lost: true, at: 500 }]],
    ['a6 slow lands 0.6 s, re-send lost and never arrives', [{ lost: true, at: 600 }, { lost: true, at: -1 }]],
  ];
  for (const [name, plan] of A) for (const office of ['new', 'old']) {
    const { S, saw, off } = await trio(browser);
    S.trace = [];
    saw.m.plan = plan.slice();
    await saw.page.evaluate(TICK('side')); kick(saw.page);
    const seen = await waitFor(() => ticks(S).includes('side'), 9000);
    if (office === 'new') await officeUntick(off, 'side'); else oldTabUntick(S, 'side');
    await idle(off.page); await settle(S, [saw]); await idle(saw.page);
    await saw.page.evaluate(() => { DB.weekCaps.z = 1; }); await flush(saw.page);
    await sleep(500); await saw.page.evaluate(async () => { await loadDB(); }); await flush(saw.page);
    const s = await st(saw.page);
    const tag = office === 'new' ? '(a)' : '(c)';
    rec(tag + ' ' + name + ', office=' + office + '-code untick: tick does not come back', seen && ticks(S) === 'keep' && s.L === 'keep', 'seen=' + seen + ' db=' + ticks(S) + ' sawScreen=' + s.L + ' trace=' + S.trace.join(' > ') + ' sent=' + saw.m.sent);
    rec(tag + ' ' + name + ', office=' + office + '-code: saw ends with no "Save failed" and nothing unsure', !s.failed && s.unsure === 0, JSON.stringify(s));
    await saw.close(); await off.close();
  }

  // (b) the saw taps Top between the first send and the re-send (two different tags in flight)
  const B = [
    ['b1 slow #1 lands 1 s, #2 (with Top) held 2 s', [{ lost: true, at: 1000 }, { at: 2000 }]],
    ['b2 slow #1 lands 3 s, #2 (with Top) immediate', [{ lost: true, at: 3000 }]],
    ['b3 slow #1 lands 1 s, #2 (with Top) lost, lands 2 s', [{ lost: true, at: 1000 }, { lost: true, at: 2000 }]],
    ['b4 slow #1 lands 2 s, #2 (with Top) lost, never arrives', [{ lost: true, at: 2000 }, { lost: true, at: -1 }]],
  ];
  for (const [name, plan] of B) for (const office of ['new', 'old']) {
    const { S, saw, off } = await trio(browser);
    S.trace = [];
    saw.m.plan = plan.slice();
    await saw.page.evaluate(TICK('side')); kick(saw.page);
    await sleep(120); await saw.page.evaluate(TICK('top')); // lands between the 0.05 and 0.25 s looks → re-send carries Top, new tag
    const seen = await waitFor(() => ticks(S).includes('side'), 9000);
    if (office === 'new') await officeUntick(off, 'side'); else oldTabUntick(S, 'side');
    await idle(off.page); await settle(S, [saw]); await idle(saw.page);
    await flush(saw.page); await sleep(300); await saw.page.evaluate(async () => { await loadDB(); }); await flush(saw.page);
    const s = await st(saw.page);
    const tag = office === 'new' ? '(b)' : '(b/c)';
    rec(tag + ' ' + name + ', office=' + office + '-code untick Side: database keep,top (Side stays off, Top kept)', ticks(S) === 'keep,top' && s.L === 'keep,top', 'seen=' + seen + ' db=' + ticks(S) + ' sawScreen=' + s.L + ' trace=' + S.trace.join(' > ') + ' sent=' + saw.m.sent);
    rec(tag + ' ' + name + ', office=' + office + '-code: no lasting "Save failed", nothing unsure', !s.failed && s.unsure === 0, JSON.stringify(s));
    await saw.close(); await off.close();
  }

  // (c2) the old-code tab saves something unrelated (a week cap) while the saw's slow save is unresolved — no endless "Save failed"
  {
    const { S, saw, off } = await trio(browser);
    S.trace = []; saw.m.plan = [{ lost: true, at: 1500 }, { lost: true, at: -1 }];
    await saw.page.evaluate(TICK('side')); kick(saw.page);
    await waitFor(() => ticks(S).includes('side'), 9000);
    { const s = JSON.parse(JSON.stringify(S.row.settings)); delete s.saveIds; s.weekCaps = { ...(s.weekCaps || {}), w9: 3 }; S.row.settings = s; S.row.version++; S.trace.push('OLDTAB caps v' + S.row.version); }
    await settle(S, [saw]); await idle(saw.page);
    const s1 = await st(saw.page);
    // the 30-s retry: call it now instead of waiting
    await flush(saw.page); const s2 = await st(saw.page);
    rec('(c2) old-code tab saves a week cap (tags wiped) during the check: after one retry the saw is saved, tick + week cap both kept', !s2.failed && s2.unsure === 0 && ticks(S) === 'keep,side' && (S.row.settings.weekCaps || {}).w9 === 3, 'after check=' + JSON.stringify(s1) + ' after retry=' + JSON.stringify(s2) + ' db=' + ticks(S) + ' trace=' + S.trace.join(' > '));
    await saw.close(); await off.close();
  }

  // (d) 3 screens, 60 rounds of overlapping saves with merges: saveIds stays bounded (a little over 40 allowed)
  {
    maxIds = 0;
    const { S, saw, off, third } = await trio(browser, 3);
    const devs = [saw, off, third];
    let screenMax = 0;
    for (let r = 0; r < 60; r++) {
      await Promise.all(devs.map((d, i) => d.page.evaluate(([k, on]) => { DB.listRow = DB.listRow || {}; DB.listRow.L = DB.listRow.L || {}; if (on) DB.listRow.L[k] = { m: 'saw', by: 'x' }; else delete DB.listRow.L[k]; DB.weekCaps = DB.weekCaps || {}; DB.weekCaps[k] = (DB.weekCaps[k] || 0) + 1; clearTimeout(saveT); saveDB(); }, ['k' + i + '_' + (r % 5), r % 2 === 0]).catch(() => {})));
      if (r % 7 === 3) await Promise.all(devs.map(d => d.page.evaluate(() => loadDB()).catch(() => {})));
      await sleep(40);
      if (r % 10 === 9) for (const d of devs) { await idle(d.page); const n = (await st(d.page)).ids; if (n > screenMax) screenMax = n; }
    }
    for (const d of devs) await flush(d.page);
    for (const d of devs) { const n = (await st(d.page)).ids; if (n > screenMax) screenMax = n; }
    const endIds = (S.row.settings.saveIds || []).length;
    rec('(d) 3 screens x 60 overlapping saves: saveIds in the database never above 50 (40 + a little)', maxIds <= 50 && endIds <= 50, 'max in db=' + maxIds + ' end=' + endIds + ' saves=' + S.okSaves + ' refused=' + S.conflicts);
    rec('(d) ... and on each screen never above 50', screenMax <= 50, 'max on a screen=' + screenMax);
    rec('(d) ... and every week-cap bump reached the database (60 per screen)', [0, 1, 2].every(i => [0, 1, 2, 3, 4].reduce((a, j) => a + ((S.row.settings.weekCaps || {})['k' + i + '_' + j] || 0), 0) === 60), JSON.stringify(S.row.settings.weekCaps));
    for (const d of devs) await d.close();
  }

  // (e) an empty save doesn't rewrite the record (no fresh tag, content unchanged)
  {
    const { S, saw, off } = await trio(browser);
    await saw.page.evaluate(TICK('side')); await flush(saw.page);
    const before = JSON.stringify({ o: S.row.orders, s: S.row.settings, n: S.row.nid }), v0 = S.row.version, p0 = (saw.m.sent || []).length;
    for (let i = 0; i < 5; i++) await save(saw.page);
    await idle(saw.page);
    const after = JSON.stringify({ o: S.row.orders, s: S.row.settings, n: S.row.nid });
    rec('(e) 5 empty saves: record content (incl. saveIds) unchanged', before === after, 'saveIds before=' + JSON.parse(before).s.saveIds + ' after=' + JSON.parse(after).s.saveIds);
    info('(e) empty saves still send a PATCH and bump the version', 'PATCHes sent=' + ((saw.m.sent || []).length - p0) + ' version ' + v0 + ' -> ' + S.row.version);
    // also: an office refresh-and-save with no edits
    await off.page.evaluate(async () => { await loadDB(); }); const b2 = JSON.stringify(S.row.settings); await save(off.page); await idle(off.page);
    rec('(e2) office loads then saves with no edits: settings unchanged', b2 === JSON.stringify(S.row.settings), 'before ids=' + JSON.parse(b2).saveIds + ' after=' + S.row.settings.saveIds);
    await saw.close(); await off.close();
  }

  // (f) tab closed during the check (before the 0.25 s look), its slow save lands afterwards, office unticks, saw reopens
  for (const [name, at, untick] of [['f1 lands 1 s, office unticks, reopen at 4 s', 1000, 'new'], ['f2 lands 1 s, OLD-code office unticks, reopen at 4 s', 1000, 'old'], ['f3 lands 3 s, no untick, reopen at 4 s', 3000, null], ['f4 never lands, reopen at 4 s', -1, null], ['f5 lands 6 s (AFTER the reopen), office no change', 6000, null]]) {
    const { S, saw, off } = await trio(browser);
    S.trace = []; saw.m.plan = [{ lost: true, at }];
    await saw.page.evaluate(TICK('side')); await saw.page.evaluate(() => writePend()); kick(saw.page);
    await sleep(120);
    await saw.page.close({ runBeforeUnload: false });
    if (untick) { await waitFor(() => ticks(S).includes('side'), 6000); if (untick === 'new') { await officeUntick(off, 'side'); await idle(off.page); } else oldTabUntick(S, 'side'); }
    await sleep(Math.max(0, 4000 - 1200));
    const p = await saw.ctx.newPage(); await attach(p, S, saw.dev); await rig(p, S, saw.m, 'saw2'); // rig last = asked first
    await p.goto('https://wpf.test/?view=saw').catch(() => {});
    await p.waitForFunction(() => typeof loadDB === 'function' && DB.loaded, null, { timeout: 15000 }).catch(() => {});
    await sleep(1500); await flush(p); await settle(S, [saw]); await sleep(300);
    await p.evaluate(async () => { await loadDB(); }); await flush(p);
    const s = await st(p);
    const want = untick ? 'keep' : 'keep,side';
    rec('(f) ' + name + ': database ' + want + (untick ? ' (no zombie tick)' : ' (tick not lost)'), ticks(S) === want && s.L === want, 'db=' + ticks(S) + ' screen=' + s.L + ' ' + JSON.stringify(s) + ' trace=' + S.trace.join(' > ') + ' sent=' + saw.m.sent);
    await p.close(); await off.close(); await saw.ctx.close().catch(() => {});
  }

  // (g) repeated slow replies: requests never arrive, reads work → UNSURE must not grow without bound
  {
    const { S, saw, off } = await trio(browser);
    saw.m.plan = Array.from({ length: 200 }, () => ({ lost: true, at: -1 }));
    await saw.page.evaluate(TICK('side'));
    const sizes = [];
    for (let i = 0; i < 6; i++) { await save(saw.page); await idle(saw.page); sizes.push((await st(saw.page)).unsure); }
    rec('(g1) 6 failed rounds of "slow" with no new taps: unsure list stays at 1-2', Math.max(...sizes) <= 2, 'sizes=' + sizes + ' sends=' + saw.m.sent.length);
    const sizes2 = [];
    for (let i = 0; i < 10; i++) { await saw.page.evaluate(TICK('t' + i)); await save(saw.page); await idle(saw.page); sizes2.push((await st(saw.page)).unsure); }
    info('(g2) one new tap per failed round, 10 rounds: unsure sizes', sizes2.join(','));
    rec('(g2) grows at most one entry per new tap (no copies per re-send)', sizes2[9] <= 12, 'sizes=' + sizes2);
    saw.m.plan = []; await flush(saw.page); const s = await st(saw.page);
    rec('(g3) signal back: everything saved, unsure list empty, no "Save failed"', s.unsure === 0 && !s.failed && ticks(S).split(',').length === 12, JSON.stringify(s) + ' db=' + ticks(S));
    await saw.close(); await off.close();
  }

  await browser.close(); console.log(fail + ' failed of ' + (pass + fail));
})().catch(e => { console.error(e); process.exit(1); });
