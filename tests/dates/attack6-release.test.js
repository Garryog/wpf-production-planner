// Tester attack round 6 (12 Nov 2026): the "Deliveries weeks" release branch (release/deliveries-weeks, 3adb928) =
// today's live code (origin/main) + the Cutting Lists project filter (PR #2) + Job A (dates & deliveries) + the bank-holiday fix.
//   A. the two hand-merged spots: lists-to-issue row (project tag + "moved out" badge) and the lists-needed table
//      (Project column + week-aware van label), filter on / off, 1280 and 360 px
//   B. the three Tester-owned tests the Coder edited — is each edit as narrow as it says?
//   C. an OLD screen (origin/main = what is live today) left open while a new screen moves dates, books vans, closes a week
//   D. two new PCs
//   E. lists switch OFF — which screens differ from origin/main
//   F. week edges in Irish time, 26 Dec 2026, 3 Jan 2028
//   G. a fresh database: "Clear All Orders" on the live code + a new import, then the new code (Garry is doing this today)
//   H. the catch-up button cut-off
//   I. Export Changes after a date move
// Fake Supabase only (tests/harness.js network guard + tests/stage1/srv.js + tests/stage3/srv3.js). Never the live project.
// Run: node tests/dates/attack6-release.test.js
const path = require('path');
const { execSync } = require('child_process');
const L = require('./attack1-lib');
const { H, makeServer, open, openOld, oldHtml, save, reload, w } = L;
const X = require('../lists-filter/fixl.js');
const { F } = X;
const ROOT = path.resolve(__dirname, '../..');
const res = [], notes = [];
const rec = (n, ok, d) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 900) : '')); };
// KNOWN = a risk already written down (docs/ACCEPTED-FAILURES.md, go-live checklist step 9: "close every screen"). Printed, never counted as a fail here.
const known = (n, still, d) => console.log('KNOWN ' + (still ? '(still true) ' : '(NOT seen this run) ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : ''));
const info = (n, d) => { notes.push(n); console.log('INFO ' + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 900) : '')); };
const j = JSON.stringify;
const LIVE = 'origin/main';
const NOW = '2026-11-12T10:00:00Z'; // Thu 12 Nov 2026, Wk 46 (Mon 9 Nov)
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-13', origDueDate: '2026-11-13', plannedWeek: '2026-11-09', step: '8. PALLETED', delv: true, customer: 'CAIRN', title: 'House ' + wo, value: 1000 }, x));
const git = cmd => { try { return execSync('git ' + cmd, { cwd: ROOT, maxBuffer: 64 << 20 }).toString(); } catch (e) { return ''; } };
const setPrompt = (p, v) => p.evaluate(v => { window.prompt = () => v; }, v);

(async () => {
  const browser = await H.chromium.launch();
  const haveLive = !!oldHtml(LIVE);
  if (!haveLive) rec('origin/main:index.html can be read (needed for every old-screen check)', false);

  // =====================================================================================================================
  // A. The two hand-merged spots on the Cutting Lists page (lists switch ON)
  // =====================================================================================================================
  for (const vw of [1280, 360]) {
    const tag = ' [' + vw + ' px]';
    const S = X.server();
    const t = await F.dev(browser, S, 'office', { now: NOW, viewport: { width: vw, height: 800 } }), p = t.page;
    const a = await p.evaluate(async () => {
      const W = ms => new Promise(r => setTimeout(r, ms));
      setWho('Ann');
      const g = w => DB.orders.find(o => o.wo === w);
      // 1410: not cut, moved out 5 weeks → "moved out — don't cut early"
      const r1 = moveDates(['WO-26-1410'], { due: '2026-12-23' }, { why: 'Customer delay' }, 'Ann').apply();
      // 1411: on a van NEXT week; 2302: a booking from before week tabs (day, no week); 3106: on a van in 3 weeks
      g('WO-26-1411').delv = true; g('WO-26-2302').delv = true; g('WO-26-3106').delv = true;
      placeJobs([g('WO-26-1411')], 'VOLVO', 'Tue', '2026-11-16'); await W(60); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      placeJobs([g('WO-26-3106')], 'VOLVO', 'Fri', '2026-11-30'); await W(60); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      Object.assign(g('WO-26-2302'), { delVeh: 'VOLVO', delDay: 'Wed' });
      showTab('l'); lstAttachOpen = 'x'; render(); await W(120);
      const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
      const inView = e => { if (!e) return false; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.left >= -1 && r.right <= innerWidth + 1; };
      const lti = w => { const e = document.querySelector('[data-ltirow="' + w + '"]'); if (!e) return null; const tg = e.querySelector('[data-lpfp]'), bs = [...e.querySelectorAll('.lti-b')];
        const mo = bs.find(b => /moved out/.test(b.textContent)), van = bs.find(b => /🚚/.test(b.textContent));
        const top = e.querySelector('.lti-top'), tr = top.getBoundingClientRect(); const spill = [...top.children].filter(c => { const r = c.getBoundingClientRect(); return r.width && (r.right > tr.right + 1 || r.left < tr.left - 1); }).map(c => c.className);
        return { tag: txt(tg), tagSeen: inView(tg), mo: txt(mo), moSeen: inView(mo), van: txt(van), vanSeen: van ? inView(van) : null, spill, order: [...top.children].map(c => /lpf-p/.test(c.className) ? 'TAG' : /moved out/.test(c.textContent) ? 'MOVED' : /🚚/.test(c.textContent) ? 'VAN' : /due/.test(c.textContent) ? 'DUE' : '').filter(Boolean).join('>') }; };
      const need = w => { const e = document.querySelector('[data-nrow="' + w + '"]'); if (!e) return null; const tds = [...e.querySelectorAll('td')]; return { proj: txt(tds[4]), tag: !!tds[4].querySelector('[data-lpfp]'), why: txt(tds[6]), th: [...e.closest('table').querySelectorAll('th')].map(txt).join('|') }; };
      const out = { moved: r1.moved, hold: dueHoldOn(g('WO-26-1410')), all: { r1410: lti('WO-26-1410'), r1411: lti('WO-26-1411'), n1411: need('WO-26-1411'), n2302: need('WO-26-2302'), n3106: need('WO-26-3106'), n1410: need('WO-26-1410') }, side: document.documentElement.scrollWidth - innerWidth };
      const pick = async v => { const s = document.getElementById('lh-proj'); s.value = v; s.onchange(); await W(80); };
      await pick('P1'); out.p1 = { r1410: lti('WO-26-1410'), r1411: lti('WO-26-1411'), n1411: need('WO-26-1411'), other: !!document.querySelector('[data-ltirow="WO-26-2302"]'), side: document.documentElement.scrollWidth - innerWidth };
      await pick('P2'); out.p2 = { r1410: !!document.querySelector('[data-ltirow="WO-26-1410"]'), n2302: need('WO-26-2302'), page: txt(document.getElementById('app')).slice(0, 0) };
      out.p2warn = txt(document.getElementById('lpf-warn') || document.querySelector('[id^="lpf-w"]')) || (txt(document.getElementById('app')).match(/[^.]*hidden[^.]*\./i) || [''])[0];
      await pick('');
      return out;
    });
    const r = a.all.r1410 || {};
    rec('A1' + tag + ' a job moved out 6 weeks (not cut) is flagged "moved out — don\'t cut early"', a.moved === 1 && a.hold, j([a.moved, a.hold]));
    rec('A2' + tag + ' All projects: its lists-to-issue row shows BOTH the project tag (ELLIOTTS ADERRIG 4) and the "moved out" badge, both in view', /ELLIOTTS ADERRIG 4/.test(r.tag) && r.tagSeen && /moved out — don't cut early/.test(r.mo) && r.moSeen, j(r));
    rec('A3' + tag + ' nothing in that row\'s top line spills outside the row; the page does not scroll sideways', r.spill && !r.spill.length && a.side <= 1, j({ spill: r.spill, side: a.side }));
    rec('A4' + tag + ' filter on its own project: tag and badge still both there and in view', a.p1.r1410 && /ELLIOTTS/.test(a.p1.r1410.tag) && a.p1.r1410.tagSeen && /moved out/.test(a.p1.r1410.mo) && a.p1.r1410.moSeen && !a.p1.other && a.p1.side <= 1, j(a.p1));
    rec('A5' + tag + ' filter on another project: the moved-out row is hidden (not half-shown)', a.p2.r1410 === false, j(a.p2));
    const v = a.all.r1411 || {};
    rec('A6' + tag + ' a job on a van NEXT week: red 🚚 badge names the date (Tue 17 Nov), with the project tag, in view', /Tue 17 Nov/.test(v.van) && v.vanSeen && /ELLIOTTS/.test(v.tag) && v.tagSeen, j(v));
    rec('A7' + tag + ' lists-needed table: heading "Project / customer"; next week\'s booking reads "On delivery board (… Tue 17 Nov)" with its project', a.all.n1411 && /Project \/ customer/.test(a.all.n1411.th) && /On delivery board \(.*Tue 17 Nov\)/.test(a.all.n1411.why) && a.all.n1411.tag && /ELLIOTTS ADERRIG 4/.test(a.all.n1411.proj), j(a.all.n1411));
    rec('A8' + tag + ' … a booking 3 weeks out names its own date (Fri 4 Dec), a booking from before week tabs names this week\'s day (Wed 11 Nov)', a.all.n3106 && /Fri 4 Dec/.test(a.all.n3106.why) && a.all.n2302 && /Wed 11 Nov/.test(a.all.n2302.why), j([a.all.n3106, a.all.n2302]));
    rec('A9' + tag + ' … and with the filter on, the van label and project are the same text as with it off', a.p1.n1411 && a.all.n1411 && a.p1.n1411.why === a.all.n1411.why && a.p1.n1411.proj === a.all.n1411.proj && a.p2.n2302 && a.p2.n2302.why === a.all.n2302.why, j([a.p1.n1411, a.p2.n2302]));
    rec('A' + tag + ' no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // B. The three Tester-owned tests the Coder edited (commit 3adb928) — narrow enough?
  // =====================================================================================================================
  {
    const d = git('show 3adb928 --numstat --format= -- tests/');
    const lines = d.trim().split('\n').map(x => x.split('\t'));
    rec('B1 commit 3adb928 touches exactly three test files, 12 lines added / 3 removed in all', lines.length === 3 && lines.map(x => x[2]).sort().join() === 'tests/dates/attack5-carryover.test.js,tests/lists-filter/attack1-filter.test.js,tests/sawstores/retest-nov.test.js', d.replace(/\n/g, ' ; '));
    // (1) sawstores/retest-nov: only '2028-01-03' added to the expected list — and the app list really has it, nothing else new in 2028
    const holMain = (oldHtml(LIVE).match(/'2028-\d\d-\d\d'/g) || []).join(), holNow = (require('fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/const IE_BANK_HOLS=\[[^\]]*\]/) || [''])[0].match(/'2028-\d\d-\d\d'/g).join();
    const sd = git('show 3adb928 -- tests/sawstores/retest-nov.test.js');
    const rm = (sd.match(/^-\s+const want = \[(.*)\];/m) || [])[1] || '', ad = (sd.match(/^\+\s+const want = \[(.*)\];/m) || [])[1] || '';
    rec('B2 sawstores/retest-nov: the only change is 3 Jan 2028 added to the expected 2028 list (Garry confirmed 12 Nov)', ad.replace("'2028-01-03', ", '') === rm && rm.length > 50, j({ rm, ad }));
    rec('B2b … and the app\'s 2028 list is exactly that expected list', holNow === ad.replace(/ /g, ''), holNow + ' vs ' + ad);
    // (2) lists-filter/attack1 check 11 baseline: falls back to origin/main once main has the week bar
    const src = require('fs').readFileSync(path.join(ROOT, 'tests/lists-filter/attack1-filter.test.js'), 'utf8');
    rec('B3 lists-filter/attack1: the ba6ecd8 baseline is used ONLY while this branch has the week bar and origin/main has not; otherwise origin/main', /const MAIN = HEAD_A && MAIN0 && !\/id="del-wkbar"\/\.test\(MAIN0\) \? \(A\.gitShow\('ba6ecd8'\) \|\| MAIN0\) : MAIN0;/.test(src));
    rec('B3b … MAIN is used by the comparison checks only (no other check reads it)', (src.match(/\bMAIN\b/g) || []).length <= 8, 'uses of MAIN: ' + (src.match(/\bMAIN\b/g) || []).length + ' — lines: ' + src.split('\n').map((l, i) => /\bMAIN\b/.test(l) ? i + 1 : 0).filter(Boolean).join());
    rec('B3c … ba6ecd8 is a real commit, an ancestor of this branch, has the week bar and no Project filter', /id="del-wkbar"/.test(oldHtml('ba6ecd8')) && !/function lpfSec\(/.test(oldHtml('ba6ecd8')) && git('merge-base --is-ancestor ba6ecd8 HEAD && echo yes').trim() === 'yes');
    // (3) attack5 B8 [lists ON] leaves out 'design' — is the drawing-office screen REALLY only different by the filter?
    //     Compare it with the filter branch tip (3b7d8c4 = PR #2) on Job-A-free data: any difference there is Job A leaking in.
  }
  const ROLES = ['pm', 'dash', 'design', 'saw', 'stores', 'driver', 'floor', 'prod'];
  const TABS = ['b', 'd', 'h', 'l', 'i', 'x', 's'];
  // screen text of every role and every office tab for one version of the code, on the same fake data
  const grab = async (html, row, opts = {}) => {
    const t = await H.open({ browser, now: opts.now || NOW, row, viewport: { width: 1366, height: 900 } });
    await t.page.unroute('**/*');
    await t.page.route('**/*', route => { const u = route.request().url(), m = route.request().method();
      if (u.startsWith('https://wpf.test/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html || require('fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8') });
      if (u.includes('xlsx.full.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: require('fs').readFileSync(path.join(ROOT, 'xlsx.full.min.js'), 'utf8') });
      if (u.includes('supabase.co')) { if (m === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('id=eq.main') ? [row] : []) }); return route.fulfill({ status: 204, body: '' }); }
      return route.fulfill({ status: 404, body: '' }); });
    const errs = []; t.page.on('pageerror', e => errs.push(String(e)));
    await t.page.reload(); await t.page.waitForFunction(() => typeof analyzeImport === 'function'); await t.page.waitForTimeout(400);
    const out = await t.page.evaluate(async ({ roles, tabs }) => { const W = ms => new Promise(r => setTimeout(r, ms)); const o = {};
      const T = () => document.getElementById('app').innerText.replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'hh:mm').replace(/📦 Items sent/g, '').replace(/\s+/g, ' ').trim();
      for (const tb of tabs) { showTab(tb); await W(120); o['office:' + tb] = T(); }
      showTab('b');
      for (const r of roles) { ls.set('wpfPin_' + r, pins()[r]); ROLE = r; render(); await W(120); o[r] = T(); }
      ROLE = 'office'; render(); return o; }, { roles: ROLES, tabs: TABS });
    out.__errs = errs;
    await t.close(); return out;
  };
  const firstDiff = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return 'at ' + i + ': LIVE "…' + a.slice(Math.max(0, i - 40), i + 110) + '" NEW "…' + b.slice(Math.max(0, i - 40), i + 110) + '"'; };
  {
    const row = () => ({ id: 'main', nid: 9, settings: { listStore: 'v2', listStoreAt: '2026-10-20T08:00:00Z' }, orders: [O('WO-R1'), O('WO-R2', { step: '6. CUT' }), O('WO-R3', { delVeh: 'VOLVO', delDay: 'Wed', step: '8. PALLETED' })] });
    const pr2 = oldHtml('3b7d8c4');
    if (!pr2) rec('B4 the Project filter branch tip 3b7d8c4 can be read', false);
    else {
      const a = await grab(pr2, row()), b = await grab(null, row());
      // the one intended Job A change on that screen: the red van badge now carries its date ("🚚 Volvo Wed" → "🚚 Volvo Wed 11 Nov")
      const nd = s => s.replace(/(🚚 \S+ (?:Mon|Tue|Wed|Thu|Fri|Sat)) \d{1,2} [A-Z][a-z]{2}/g, '$1');
      rec('B4 attack5 B8 edit: with lists ON the drawing-office screen differs from the PR #2 (Project filter) screen ONLY by the date on the van badge ("🚚 Volvo Wed 11 Nov") — so leaving it out of B8 hides no other Job A change', a.design !== b.design && nd(a.design) === nd(b.design), firstDiff(nd(a.design), nd(b.design)));
      const src5 = require('fs').readFileSync(path.join(ROOT, 'tests/dates/attack5-carryover.test.js'), 'utf8');
      rec('B4b … the skip is only for the drawing office, only with lists ON, only when the filter code exists', /const lpf = listsOn && \/function lpfSec\\\(\/\.test\(/.test(src5) && /!\(lpf && r === 'design'\)/.test(src5));
      const also = ROLES.filter(r => r !== 'design' && r !== 'prod' && a[r] !== b[r]);
      info('B4c lists ON, PR #2 → release: other role screens that changed (Job A)', also.length ? also.map(r => r + ' ' + firstDiff(a[r], b[r])).join(' || ') : 'none');
    }
  }

  // =====================================================================================================================
  // E. Lists switch OFF: every screen, live (origin/main) vs this release, same data with no Job A fields
  // =====================================================================================================================
  if (haveLive) {
    const row = () => ({ id: 'main', nid: 9, settings: {}, orders: [O('WO-R1'), O('WO-R2', { step: '6. CUT', delv: false }), O('WO-R3', { delVeh: 'VOLVO', delDay: 'Wed', step: '8. PALLETED' }),
      O('WO-R4', { step: '3. In production', delv: false, dueDate: '2026-11-27', origDueDate: '2026-11-27', plannedWeek: '2026-11-23' })] });
    const a = await grab(oldHtml(LIVE), row()), b = await grab(null, row());
    const keys = TABS.map(t => 'office:' + t).concat(ROLES);
    const diff = keys.filter(k => a[k] !== b[k]), same = keys.filter(k => a[k] === b[k]);
    diff.forEach(k => info('E lists OFF — "' + k + '" differs from live', firstDiff(a[k], b[k])));
    info('E lists OFF — screens identical to live', same.join(', '));
    // Intended with lists OFF (plan "What changes"): Capacity Board (tap a due date), Deliveries (week tabs), Export Changes
    // ("Dates to change in Cienapps"), Settings (Delivery dates 3 / 5 / 14), Production Manager (🚚 Deliveries), driver + floor (dated).
    // Also intended: PM screen ("site not confirmed" / Site ready for all), management wording ("planned for a day already gone"),
    // and on the Cutting Lists page ONE label: "On delivery board (Wed)" → "(Volvo Wed 11 Nov)" (the hand-merged line).
    const intended = ['office:b', 'office:d', 'office:x', 'office:s', 'office:l', 'prod', 'driver', 'floor', 'pm', 'dash'];
    const nl = s => s.replace(/On delivery board \([^)]*\)/g, 'On delivery board (…)');
    rec('E1 lists OFF: Deliveries week tabs DO apply (week bar + tabs on the Deliveries page) — the release is not behind the lists switch', /Wk 46/.test(b['office:d']) && /Next week · Wk 47/.test(b['office:d']) && !/Next week · Wk 47/.test(a['office:d']), b['office:d'].slice(0, 200));
    rec('E2 lists OFF: the Import page, History, saw, stores and drawing-office screens are word for word the live ones', ['office:i', 'office:h', 'saw', 'stores', 'design'].every(k => a[k] === b[k]), ['office:i', 'office:h', 'saw', 'stores', 'design'].filter(k => a[k] !== b[k]).map(k => k + ' ' + firstDiff(a[k], b[k])).join(' || '));
    rec('E2b lists OFF: the Cutting Lists page differs from live ONLY in the "On delivery board (…)" label, which now names the van and date; no Project filter, no project tags', a['office:l'] !== b['office:l'] && nl(a['office:l']) === nl(b['office:l']) && /On delivery board \(Volvo Wed 11 Nov\)/.test(b['office:l']) && !/🏗/.test(b['office:l']), firstDiff(nl(a['office:l']), nl(b['office:l'])));
    rec('E3 lists OFF: every screen that differs from live is one the plan says changes (Board, Deliveries, Cutting Lists label, Export Changes, Settings, PM, management, Production Manager, driver, floor)', diff.every(k => intended.includes(k)) && diff.length === intended.length, 'differs: ' + diff.join(', '));
    rec('E3b lists OFF: with bookings made before go-live, the office Deliveries page asks the one-time "which week" question; the Production Manager\'s does not', /1 booking from before the week tabs/.test(b['office:d']), b['office:d'].slice(300, 520));
    rec('E4 no page errors on any screen, live or release', !a.__errs.length && !b.__errs.length, j([a.__errs, b.__errs]));
    global.__E = { diff, same };
  }

  // =====================================================================================================================
  // C. An OLD screen (origin/main — today's live code) left open after go-live
  // =====================================================================================================================
  if (haveLive) {
    const hist = [{ at: '2026-11-05T10:00:00Z', by: 'Ann', f: 'due', from: '2026-11-06', to: '2026-11-13', why: 'Site not ready', note: '', src: 'planner' }];
    const row = () => ({ id: 'main', version: 1, nid: 9, settings: { delNotes: { Tue: 'old tue note' } }, orders: [
      O('WO-1', { step: '3. In production', delv: false, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16' }),   // new screen moves its due date
      O('WO-2', { step: '3. In production', delv: false, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16' }),   // moved out 6 weeks → don't cut early
      O('WO-3'),                                                            // new screen books it NEXT week
      O('WO-4', { delVeh: 'DAF', delDay: 'Fri' }),                          // booking from before week tabs
      O('WO-5', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-02', dueDate: '2026-11-03', origDueDate: '2026-11-03', plannedWeek: '2026-11-02' }), // last week, not delivered → Close week
      O('WO-6', { step: '3. In production', delv: false }),                 // the old screen edits this one
      O('WO-7'),                                                            // the old screen books this one
    ] });
    const newWork = p => p.evaluate(async () => {
      const W = ms => new Promise(r => setTimeout(r, ms)); const g = w => DB.orders.find(o => o.wo === w);
      setWho('Ann');
      moveDates(['WO-1'], { due: '2026-11-27' }, { why: 'Customer delay', note: 'floors late' }, 'Ann').apply();
      moveDates(['WO-2'], { due: '2026-12-30' }, { why: 'Site not ready' }, 'Ann').apply();
      showTab('d'); await W(100);
      placeJobs([g('WO-3')], 'VOLVO', 'Thu', '2026-11-16'); await W(80); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      setLegacyWk(thisWk(), 'Ann');
      delNoteSet('2026-11-19', 'next thu — crane booked');
      g('WO-3').siteOk = { at: nowISO(), by: 'Ann', for: slotDate(g('WO-3')) };
      DB.delivLead = 4; DB.siteDays = 6; DB.earlyDays = 10;
      delTab = '-1'; render(); await W(80);
      const b = document.getElementById('btn-delreset'); if (b) b.click(); await W(900);
      sched(); clearTimeout(saveT); await saveDB();
      return { closeBtn: !!b };
    });
    const state = S => { const g = w => S.row.orders.find(o => o.wo === w) || {}, s = S.row.settings || {};
      return { due1: g('WO-1').dueDate, keep1: g('WO-1').dueKeep || '', hist1: (g('WO-1').dueHist || []).length, wk1: g('WO-1').plannedWeek, hold2: !!g('WO-2').dueHold, due2: g('WO-2').dueDate,
        b3: [g('WO-3').delVeh || '', g('WO-3').delDay || '', g('WO-3').delWk || ''].join('|'), site3: !!(g('WO-3').siteOk), b4: [g('WO-4').delVeh || '', g('WO-4').delDay || '', g('WO-4').delWk || ''].join('|'),
        rb5: !!g('WO-5').delRebook, day5: g('WO-5').delDay || '', arch: Object.values(s.delArchive || {}).map(a => a.w + ':' + (a.jobs || []).length).join(),
        leg: s.delLegacyWk || '', legAt: !!s.delLegacyAt, lead: [s.delivLead, s.siteDays, s.earlyDays].join('/'), note: (s.delNotes || {})['2026-11-19'] || '', noteTue: (s.delNotes || {})['2026-11-10'] || (s.delNotes || {}).Tue || '', appRel: s.appRel,
        n6: g('WO-6').notes || '', n: S.row.orders.length }; };

    // C1 the old screen was open all along (stale copy), then saves one unrelated note
    {
      const S = makeServer(row());
      const OL = await openOld(browser, S, { now: NOW, ref: LIVE });
      const N = await open(browser, S, { now: NOW });
      const nw = await newWork(N.page);
      const before = state(S);
      rec('C0 set-up on the new screen landed in the fake database (date move, moved-out, next-week van, legacy answer, dated note, site ready, 4/6/10, last week closed)', before.due1 === '2026-11-27' && before.keep1 === '2026-11-20' && before.hold2 && before.b3 === 'VOLVO|Thu|2026-11-16' && before.leg === '2026-11-09' && before.lead === '4/6/10' && before.note && before.rb5 && !before.day5 && /2026-11-02:1/.test(before.arch) && nw.closeBtn, j(before));
      await OL.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-6'); o.notes = 'old screen note'; sched(); });
      await save(OL.page);
      const after = state(S);
      const lost = Object.keys(before).filter(k => j(before[k]) !== j(after[k]) && k !== 'n6');
      info('C1 stale OLD screen saves one note — what changed in the database besides the note', lost.length ? lost.map(k => k + ': ' + j(before[k]) + ' → ' + j(after[k])).join(' ; ') : 'nothing');
      rec('C1a stale old screen save: the old screen\'s own note is saved', after.n6 === 'old screen note', after.n6);
      rec('C1b … due-date moves, their history and the Cienapps date to change are kept (WO-1 27 Nov, history 1, Cienapps has 20 Nov)', after.due1 === '2026-11-27' && after.keep1 === '2026-11-20' && after.hist1 === 1 && after.wk1 === before.wk1, j(after));
      rec('C1c … "moved out — don\'t cut early" is kept', after.hold2 && after.due2 === '2026-12-30', j(after));
      rec('C1d … next week\'s van booking keeps its week; site-ready kept', after.b3 === 'VOLVO|Thu|2026-11-16' && after.site3, j(after));
      rec('C1e … the closed week stays closed (WO-5 still "rebook", still archived)', after.rb5 && !after.day5 && after.arch === before.arch, j(after));
      rec('C1f … the dated day note for next week is kept', after.note === 'next thu — crane booked', j(after.note));
      known('C1h a stale old screen\'s save drops the answer to the one-time old-bookings question (asked again on the next PC opened) — ACCEPTED-FAILURES "delLegacyWk"', !after.leg, j([after.leg, after.legAt]));
      // what does the old screen SHOW its user for next week's booking?
      const ov = await OL.page.evaluate(async () => { await loadDB(); showTab('d'); await new Promise(r => setTimeout(r, 150));
        const c = [...document.querySelectorAll('.dchip')].find(c => c.dataset.dw === 'WO-3'), cell = c && c.closest('[data-cell]');
        return { cell: cell ? cell.dataset.cell : '', head: (document.getElementById('app').innerText.match(/Delivery Board[^\n]*/) || [''])[0] }; });
      info('C1i the old screen shows next week\'s Thursday booking (WO-3, Thu 19 Nov) on its one and only week grid', j(ov));
      known('C1i an old office screen shows a van booked for NEXT week (Thu 19 Nov) on its only grid, as if it were this Thursday — checklist step 9', /Thu/.test(ov.cell), j(ov));
      // a brand-new PC opened now: does it see everything?
      const N2 = await open(browser, S, { now: NOW });
      const n2 = await N2.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); return { ask: !!document.getElementById('del-legacy'), lead: [delivLead(), siteDays(), earlyDays()].join('/'), dates: datesToCien().map(o => o.wo).join() }; });
      known('C1j a PC opened after the old save is asked the old-bookings question again', n2.ask, j(n2));
      rec('C1j a PC opened after the old save: "Dates to change in Cienapps" still lists WO-1 and WO-2', n2.dates === 'WO-1,WO-2', j(n2));
      rec('C1k a PC opened after the old save still has the Settings → Delivery dates numbers that were saved (4 / 6 / 10), not the defaults', n2.lead === '4/6/10', n2.lead);
      rec('C1 no page errors on the new screens', !(S.errors || []).filter(e => !/^OLD:/.test(e)).length, (S.errors || []).join(' | '));
      await N.close(); await N2.close(); await OL.close();
    }
    // C2 the old screen WORKS on Deliveries: moves next week's booking to another day, books a pool job, then Clear Week
    {
      const S = makeServer(row());
      const N = await open(browser, S, { now: NOW });
      await newWork(N.page);
      const OL = await openOld(browser, S, { now: NOW, ref: LIVE });
      const o1 = await OL.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms));
        showTab('d'); await W(120);
        placeJobs([findDel('WO-3')], 'VOLVO', 'Fri'); await W(120);
        const ov = [...document.querySelectorAll('.pod-ovl')].map(o => o.textContent.replace(/\s+/g, ' ').slice(0, 160));
        const why = document.querySelector('.pod-ovl [data-why]'); if (why) why.click(); await W(120); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
        placeJobs([findDel('WO-7')], 'DAF', 'Thu'); await W(120); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
        return { ov, btn: (document.getElementById('btn-delreset') || {}).textContent || '' }; });
      await save(OL.page); await reload(N.page);
      const r = await N.page.evaluate(() => { const g = w => DB.orders.find(o => o.wo === w); return { w3: [g('WO-3').delVeh, g('WO-3').delDay, g('WO-3').delWk || '', slotDate(g('WO-3'))].join('|'), site3: (siteState(g('WO-3')) || {}).k || '', w7: [g('WO-7').delVeh, g('WO-7').delDay, g('WO-7').delWk || '', slotDate(g('WO-7'))].join('|') }; });
      info('C2a the old screen moved WO-3 (new screen: Thu 19 Nov) to "Fri" and booked WO-7 on "Thu"', j({ o1, r }));
      rec('C2a old screen moves a NEXT-week booking to Friday: the old-screen user sees and means THIS Friday (13 Nov) — the new screens must not show it on Fri 20 Nov', /2026-11-13$/.test(r.w3), r.w3);
      rec('C2b old screen books a pool job on "Thu": new screens show it this week (Thu 12 Nov)', /2026-11-12$/.test(r.w7), r.w7);
      rec('C2c … and the site-ready tick given for Thu 19 Nov is not shown as ready for the new day', r.site3 !== 'ok', r.site3);
      // Clear Week on the old screen
      const cw = await OL.page.evaluate(async () => { const b = document.getElementById('btn-delreset'); const t = b ? b.textContent.replace(/\s+/g, ' ').trim() : ''; if (b) b.click(); await new Promise(r => setTimeout(r, 900)); return t; });
      await save(OL.page); await reload(N.page);
      const c = await N.page.evaluate(() => { const g = w => DB.orders.find(o => o.wo === w); return { btn: '', w3: [g('WO-3').delVeh || '', g('WO-3').delDay || '', g('WO-3').delWk || ''].join('|'), w3delv: !!g('WO-3').delv, w4: [g('WO-4').delVeh || '', g('WO-4').delDay || ''].join('|'), note: (DB.delNotes || {})['2026-11-19'] || '', nArch: Object.keys(DB.delArchive || {}).length }; });
      c.btn = cw;
      info('C2d the old screen\'s "' + cw + '" button', j(c));
      known('C2d the old screen\'s "Clear Week — Start Fresh" clears NEXT week\'s van booking too and takes the job off the delivery board (archived first) — ACCEPTED-FAILURES', !c.w3.split('|')[1] && !c.w3delv, j(c));
      known('C2e … and wipes next week\'s dated day note — ACCEPTED-FAILURES', !c.note, j(c.note));
      rec('C2f … but nothing is deleted: every job is still on the planner and the cleared bookings are in 📚 Past weeks', S.row.orders.length === 7 && c.nArch >= 2, j([S.row.orders.length, c.nArch]));
      await N.close(); await OL.close();
    }
    // C3 the old screen runs a Cienapps IMPORT (file still has the old due date) after the new screen moved the date
    {
      const S = makeServer(row());
      const N = await open(browser, S, { now: NOW });
      await newWork(N.page);
      const OL = await openOld(browser, S, { now: NOW, ref: LIVE });
      const HDR = ['WO # ', 'Title ', 'Customer ', 'Due Date ', 'Step ', 'Sub-Total '];
      const aoa = [HDR].concat(S.row.orders.map(o => [o.wo, o.title, o.customer, L.XD(o.wo === 'WO-1' || o.wo === 'WO-2' ? '2026-11-20' : o.origDueDate), o.step, 1000]));
      let imp = null, ierr = '';
      try { imp = await H.importAoa(OL.page, aoa); await OL.page.evaluate(async () => { const b = document.getElementById('imp-apply'); if (b) await b.onclick(); }); await w(300); await save(OL.page); } catch (e) { ierr = String(e).slice(0, 200); }
      await reload(N.page);
      const r = await N.page.evaluate(() => { const g = w => DB.orders.find(o => o.wo === w); return { due1: g('WO-1').dueDate, keep1: g('WO-1').dueKeep || '', hist1: (g('WO-1').dueHist || []).length, wk1: g('WO-1').plannedWeek, due2: g('WO-2').dueDate, hold2: dueHoldOn(g('WO-2')), list: datesToCien().map(o => o.wo).join() }; });
      info('C3 old screen imports a Cienapps file that still has the OLD due dates (20 Nov) for WO-1 / WO-2', j({ r, ierr, prev: imp && imp.iprev.replace(/\s+/g, ' ').slice(0, 200) }));
      rec('C3a old-screen import with Cienapps\'s old date: the planner\'s moved due date (WO-1 → 27 Nov) is kept', r.due1 === '2026-11-27', j(r));
      rec('C3b … and WO-2 (moved out to 30 Dec, "don\'t cut early") keeps its date', r.due2 === '2026-12-30', j(r));
      rec('C3c … whatever the date is now, "Dates to change in Cienapps" does not list a job whose date matches Cienapps again, and lists every job that does not', (r.due1 === '2026-11-20') === !/WO-1/.test(r.list), j(r));
      await N.close(); await OL.close();
    }
    // C4 the old screen is a driver's phone: marks the next-week job delivered
    {
      const S = makeServer(row());
      const N = await open(browser, S, { now: NOW });
      await newWork(N.page);
      const OL = await openOld(browser, S, { now: NOW, ref: LIVE });
      const d = await OL.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); ls.set('wpfPin_driver', pins().driver); ROLE = 'driver'; render(); await W(200);
        const v = document.getElementById('drv-veh'); if (v) { v.value = 'VOLVO'; v.dispatchEvent(new Event('change')); if (v.onchange) v.onchange(); } await W(200);
        const t = document.getElementById('app').innerText.replace(/\s+/g, ' '); ROLE = 'office'; render(); return { picked: !!v, has3: /WO-3/.test(t), txt: t.slice(0, 400) }; });
      known('C4 an old-version DRIVER phone on Thu 12 Nov lists the job booked for Thu 19 Nov (next week) in today\'s run — checklist step 9', d.picked && d.has3, j(d));
      await N.close(); await OL.close();
    }
  }

  // =====================================================================================================================
  // D. Two new PCs
  // =====================================================================================================================
  {
    const row = { id: 'main', version: 1, nid: 9, settings: { delNotes: { Tue: 'old tue note', Fri: 'old fri note' } }, orders: [
      O('WO-1', { delVeh: 'VOLVO', delDay: 'Tue' }), O('WO-2', { delVeh: 'DAF', delDay: 'Fri' }), O('WO-3'),
      O('WO-5', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09' }) ] };
    const S = makeServer(row);
    const A = await open(browser, S, { now: NOW }), B = await open(browser, S, { now: NOW });
    // D1 both answer the one-time question differently
    await A.page.evaluate(() => { setWho('Ann'); setLegacyWk(thisWk(), 'Ann'); });
    await B.page.evaluate(() => { setWho('Bob'); setLegacyWk(wkPlus(thisWk(), 1), 'Bob'); });
    await save(A.page); await save(B.page); await reload(A.page); await reload(B.page);
    const st = p => p.evaluate(() => ({ leg: DB.delLegacyWk, w1: slotDate(DB.orders.find(o => o.wo === 'WO-1')), notes: j_(DB.delNotes) }));
    await A.page.evaluate(() => { window.j_ = JSON.stringify; }); await B.page.evaluate(() => { window.j_ = JSON.stringify; });
    const a = await st(A.page), b = await st(B.page);
    rec('D1 two PCs answer the old-bookings question differently ("This week" / "Next week"): after both save, both PCs show the same week (no split view)', a.leg === b.leg && a.w1 === b.w1, j([a, b]));
    const nk = Object.keys(JSON.parse(a.notes));
    rec('D1b … and each old day note ends up on ONE date only (not copied into both weeks), none lost', a.notes === b.notes && nk.filter(k => /^\d{4}/.test(k)).length === 2 && !nk.includes('Tue') && !nk.includes('Fri'), a.notes);
    // D2 PC A closes this week while PC B (not refreshed) moves a booked job of that week to next week
    await B.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const r = moveDates(['WO-5'], { toWk: '2026-11-16' }, { why: 'Site not ready' }, 'Bob', { src: 'planner' }).apply(); window.__mv = r.moved; sched(); });
    await A.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); showTab('d'); delTab = '0'; render(); await W(80); const b = document.getElementById('btn-delreset'); if (b) b.click(); await W(1000); clearTimeout(saveT); await saveDB(); });
    await save(B.page); await reload(A.page); await reload(B.page);
    const q = p => p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-5'); return { n: DB.orders.filter(x => x.wo === 'WO-5').length, due: o.dueDate, day: o.delDay || '', wk: o.delWk || '', rb: o.delRebook ? o.delRebook.why || 'rebook' : '', hist: (o.dueHist || []).length, arch: Object.values(DB.delArchive || {}).map(a => a.w + ':' + a.jobs.map(x => x.wo).join('+')).join() }; });
    const qa = await q(A.page), qb = await q(B.page);
    info('D2 PC A closes Wk 46 while PC B moves WO-5 (booked Thu 12 Nov) to Wk 47', j(qa));
    rec('D2 close week on one PC + date move on another: the job is there once, both PCs agree, it is not on a van in a closed week, and the date move with its history survived', qa.n === 1 && j(qa) === j(qb) && qa.due === '2026-11-20' && qa.hist === 1 && !(qa.day && (qa.wk || '2026-11-09') === '2026-11-09'), j([qa, qb]));
    rec('D no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await B.close();
  }

  // =====================================================================================================================
  // F. Week edges (Irish time), St Stephen's Day 2026, 3 Jan 2028
  // =====================================================================================================================
  {
    const edge = async (now, label, wantWk, wantSlots) => {
      const row = { id: 'main', nid: 9, settings: {}, orders: [O('WO-1'), O('WO-2', { delVeh: 'VOLVO', delDay: 'Mon', delWk: wantWk })] };
      const t = await H.open({ browser, now, row });
      const r = await t.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150));
        return { wk: thisWk(), board: get8Wks()[0], today: todayLocal(), lbl: document.getElementById('wkb-lbl').textContent.replace(/\s+/g, ' ').trim(), cur: (document.querySelector('.del-tab.cur') || {}).textContent, slots: floorSlots().map(s => s.d + ' ' + s.date).join(), grid: [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw).join() }; });
      rec('F ' + label + ': this week = ' + wantWk + ' on Deliveries AND on the Capacity Board; the "this week" tab is that week; a Monday booking of that week is on the grid', r.wk === wantWk && r.board === wantWk && /this week/.test(r.lbl) && r.grid === 'WO-2' && (!wantSlots || r.slots === wantSlots), j(r));
      rec('F ' + label + ': no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
      await t.close();
    };
    await edge('2026-11-14T23:30:00Z', 'Sat 14 Nov 23:30', '2026-11-09', 'Sat 2026-11-14,Mon 2026-11-16');
    await edge('2026-11-15T12:00:00Z', 'Sun 15 Nov noon', '2026-11-09', 'Mon 2026-11-16,Tue 2026-11-17');
    await edge('2026-11-15T23:59:00Z', 'Sun 15 Nov 23:59', '2026-11-09', 'Mon 2026-11-16,Tue 2026-11-17');
    await edge('2026-11-16T00:30:00Z', 'Mon 16 Nov 00:30 (go-live day)', '2026-11-16', 'Mon 2026-11-16,Tue 2026-11-17');
    await edge('2026-07-05T23:30:00Z', 'Mon 6 Jul 00:30 summer time (23:30 UTC Sunday)', '2026-07-06', 'Mon 2026-07-06,Tue 2026-07-07');
    await edge('2026-10-25T00:30:00Z', 'Sun 25 Oct 01:30 (clocks go back tonight)', '2026-10-19', 'Mon 2026-10-26,Tue 2026-10-27');
    await edge('2027-01-03T23:30:00Z', 'Sun 3 Jan 2027 23:30', '2026-12-28', 'Mon 2027-01-04,Tue 2027-01-05');
    await edge('2028-01-03T09:00:00Z', 'Mon 3 Jan 2028 (bank holiday)', '2028-01-03', null);

    // Christmas week 2026 — Mon 21 Dec
    const row = { id: 'main', nid: 9, settings: {}, orders: ['A', 'B', 'C', 'D', 'E'].map(x => O('WO-' + x, { dueDate: '2026-12-23', origDueDate: '2026-12-23', plannedWeek: '2026-12-21' })) };
    const t = await H.open({ browser, now: '2026-12-21T10:00:00Z', row });
    const x = await t.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const asks = []; window.confirm = m => { asks.push(String(m).slice(0, 90)); return true; };
      setWho('Ann'); showTab('d'); await W(120);
      const tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      const head = [...document.querySelectorAll('.del-grid .dhead,.del-grid th,.del-grid [data-dayh]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(s => /Fri|Sat/.test(s));
      const g = w => DB.orders.find(o => o.wo === w); const out = { tabs, head };
      const book = async (wo, d, wk) => { const n = asks.length; placeJobs([g(wo)], 'VOLVO', d, wk); await W(60); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); return { asked: asks.length > n ? asks[asks.length - 1] : '', on: slotDate(g(wo)) }; };
      out.fri25 = await book('WO-A', 'Fri', '2026-12-21'); out.sat26 = await book('WO-B', 'Sat', '2026-12-21'); out.mon28 = await book('WO-C', 'Mon', '2026-12-28'); out.sat19 = await book('WO-D', 'Sat', '2026-12-28');
      out.isDel = ['2026-12-25', '2026-12-26', '2026-12-28', '2027-01-01', '2027-01-02'].map(isDelivDay);
      render(); await W(80);
      const cell = [...document.querySelectorAll('.del-grid [data-cell]')].find(c => /\|Sat$|Sat/.test(c.dataset.cell) && c.querySelector('[data-dw="WO-B"]'));
      out.satCard = cell ? cell.textContent.replace(/\s+/g, ' ').slice(0, 200) : '';
      out.satHead = (document.getElementById('app').innerText.match(/Sat[^\n]{0,40}26 Dec[^\n]{0,60}/) || [''])[0];
      // week move: a Saturday-due job of this week → would land on Sat 26 Dec? (engine) — and Wk 53
      out.wk53 = wkNum('2026-12-28') + '/' + wkNum('2027-01-04');
      return out; });
    info('F Christmas week 2026: tabs ' + j(x.tabs), j(x));
    rec('F Christmas 2026: tabs run Wk 52 · 21 Dec → Wk 53 · 28 Dec → Wk 1 · 4 Jan', /Wk 52 · 21 Dec/.test(x.tabs[0]) && /Wk 53 · 28 Dec/.test(x.tabs[1]) && /Wk 1 · 4 Jan/.test(x.tabs[2]), j(x.tabs));
    rec('F booking a van on Fri 25 Dec 2026 (Christmas Day) asks "bank holiday — book anyway?"', /bank holiday/.test(x.fri25.asked), j(x.fri25));
    rec('F booking a van on Mon 28 Dec 2026 (bank holiday in lieu) asks first', /bank holiday/.test(x.mon28.asked), j(x.mon28));
    rec('F booking a van on Sat 26 Dec 2026 (St Stephen\'s Day — in the bank-holiday list, "no delivery day") asks first too', /bank holiday/.test(x.sat26.asked), j({ sat26: x.sat26, isDelivDay_25_26_28_1Jan_2Jan: x.isDel }));
    rec('F an ordinary Saturday (2 Jan 2027) books with no question and no flag (B1)', !x.sat19.asked && x.sat19.on === '2027-01-02', j(x.sat19));
    await t.close();
    // New Year 2028
    const row2 = { id: 'main', nid: 9, settings: {}, orders: ['A', 'B'].map(x => O('WO-' + x, { dueDate: '2028-01-05', origDueDate: '2028-01-05', plannedWeek: '2028-01-03' })) };
    const t2 = await H.open({ browser, now: '2027-12-29T10:00:00Z', row: row2 });
    const y = await t2.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const asks = []; window.confirm = m => { asks.push(String(m).slice(0, 90)); return true; };
      setWho('Ann'); showTab('d'); await W(120); const g = w => DB.orders.find(o => o.wo === w);
      const tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      placeJobs([g('WO-A')], 'VOLVO', 'Mon', '2028-01-03'); await W(60); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      return { tabs, asked: asks.join(' | '), on: slotDate(g('WO-A')), mvTo: wkFit('2028-01-03', '2028-01-03', '2027-12-29', true).d, stale: typeof bankHolsStale === 'function' ? bankHolsStale() : null }; });
    rec('F New Year 2028: on Wed 29 Dec 2027 the next-week tab is Wk 1 · 3 Jan; booking Mon 3 Jan 2028 asks "bank holiday"; a delivery week-moved onto 3 Jan 2028 is fitted on Tue 4 Jan', /Wk 52 · 27 Dec/.test(y.tabs[0]) && /Wk 1 · 3 Jan/.test(y.tabs[1]) && /bank holiday/.test(y.asked) && y.mvTo === '2028-01-04', j(y));
    await t2.close();
  }

  // =====================================================================================================================
  // G. A fresh database: "Clear All Orders" + a new import on TODAY'S LIVE code, then the release opens it
  // =====================================================================================================================
  if (haveLive) {
    const HDR = ['WO # ', 'Title ', 'Customer ', 'Due Date ', 'Step ', 'Sub-Total '];
    const aoa = [HDR,
      ['WO-N1', 'House 1', 'CAIRN', L.XD('2026-11-20'), '3. In production', 4000], ['WO-N2', 'House 2', 'CAIRN', L.XD('2026-11-13'), '8. PALLETED', 4000],
      ['WO-N3', 'House 3', 'CAIRN', L.XD('2026-10-15'), '7. ASSEMBLY COMPLETE', 4000], ['WO-N4', 'House 4', 'ELLIOTTS', L.XD('2026-12-18'), '5. WORK ORDER PROCESSED', 4000],
      ['WO-N5', 'House 5', 'ELLIOTTS', '', '8. PALLETED', 4000]];
    for (const leftovers of [false, true]) {
      const tag = leftovers ? ' [a hand-added job still on a van + old day notes left behind]' : ' [nothing left behind]';
      const row = { id: 'main', version: 1, nid: 9, settings: Object.assign({}, leftovers ? { delNotes: { Tue: 'crane on site' }, delx: [{ wo: 'M-1', title: 'Worktop collect', customer: 'WALK-IN', manual: true, delv: true, value: 0, delVeh: 'DAF', delDay: 'Fri' }] } : {}),
        orders: [O('WO-OLD1', { delVeh: 'VOLVO', delDay: 'Tue' }), O('WO-OLD2', { delVeh: 'VOLVO', delDay: 'Wed' }), O('WO-OLD3')] };
      const S = makeServer(row);
      const OL = await openOld(browser, S, { now: NOW, ref: LIVE });
      await setPrompt(OL.page, 'DELETE');
      await OL.page.evaluate(async () => { showTab('b'); await new Promise(r => setTimeout(r, 120)); const b = document.getElementById('btn-clearall'); if (b) await b.onclick(); await new Promise(r => setTimeout(r, 400)); });
      await save(OL.page);
      const cleared = S.row.orders.length;
      await setPrompt(OL.page, 'Tester');
      await H.importAoa(OL.page, aoa);
      await OL.page.evaluate(async () => { const b = document.getElementById('imp-apply'); if (b) await b.onclick(); }); await w(300);
      await save(OL.page);
      rec('G0' + tag + ' set-up on the live code: Clear All Orders emptied the plan, a safety backup was taken, the new import brought 5 jobs', cleared === 0 && S.backups.length >= 1 && S.row.orders.length === 5, j({ cleared, bk: S.backups.length, n: S.row.orders.length }));
      await OL.close();
      // go-live: the release opens that database
      const N = await open(browser, S, { now: '2026-11-16T09:00:00Z' });
      const r = await N.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); setWho('Ann'); showTab('d'); await W(150);
        const T = () => document.getElementById('app').innerText.replace(/\s+/g, ' ');
        const out = { ask: !!document.getElementById('del-legacy'), askTxt: (document.getElementById('del-legacy') || {}).textContent || '', wkh: document.getElementById('del-wkh').textContent, close: !!document.getElementById('btn-delreset'), catchup: (document.getElementById('btn-deltag') || {}).textContent || '',
          pool: [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw).join(), grid: [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw + '@' + c.closest('[data-cell]').dataset.cell).join(), tabs: [...document.querySelectorAll('[data-deltab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
          note: delNoteGet('2026-11-17'), leg: DB.delLegacyWk || '', tagged: DB.orders.filter(o => o.delv).map(o => o.wo).join(), miss: typeof missedJobs === 'function' ? missedJobs().map(o => o.wo).join() : '' };
        // every page opens
        const errs = []; for (const tb of ['b', 'h', 'l', 'i', 'x', 's', 'd']) { try { showTab(tb); await W(80); } catch (e) { errs.push(tb + ':' + e); } }
        out.dates = datesToCien().length; out.errs = errs;
        // answer the question if it is there — must change nothing but the answer
        const before = JSON.stringify(DB.orders);
        const b = document.querySelector('[data-legwk="0"]'); if (b) { b.click(); await W(150); }
        out.sameOrders = before === JSON.stringify(DB.orders); out.askAfter = !!document.getElementById('del-legacy'); out.legAfter = DB.delLegacyWk || ''; out.noteAfter = JSON.stringify(DB.delNotes || {});
        out.m1 = (DB.delx || []).map(o => o.wo + ':' + (o.delDay || '') + ':' + slotDate(o)).join();
        // book a van now and next week → both carry their week, question never comes for them
        const g = w => DB.orders.find(o => o.wo === w);
        placeJobs([g('WO-N2')], 'VOLVO', 'Tue', thisWk()); await W(60); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
        out.n2 = [g('WO-N2').delDay, g('WO-N2').delWk].join('|'); render(); await W(80); out.askAfterBook = !!document.getElementById('del-legacy');
        return out; });
      info('G' + tag + ' the release opens the fresh database on Mon 16 Nov', j(r));
      rec('G1' + tag + ' Deliveries opens on Wk 47 (16 Nov) with the week tabs, no errors, every other page opens', /Wk 47/.test(r.wkh) && !r.errs.length && !(S.errors || []).length, j([r.wkh, r.errs, S.errors]));
      if (!leftovers) rec('G2' + tag + ' the one-time "which week are the old bookings" question does NOT appear (there are none)', !r.ask, r.askTxt);
      else rec('G2' + tag + ' the question appears only for the 1 hand-added job that survived Clear All Orders, and answering it changes no work order', r.ask && /^⚠ 1 booking /.test(r.askTxt.trim()) && r.sameOrders && !r.askAfter && r.legAfter === '2026-11-16', j([r.askTxt.slice(0, 80), r.sameOrders, r.askAfter, r.legAfter]));
      rec('G3' + tag + (leftovers ? ' Close week is offered only because of the hand-added job;' : ' no "Close week" button (nothing booked),') + ' nothing shown as missed, "Dates to change in Cienapps" empty', r.close === leftovers && !r.miss && r.dates === 0, j([r.close, r.miss, r.dates]));
      rec('G4' + tag + ' imported jobs at 7 / 8 are in the pool; a new booking carries its week and never triggers the question', r.n2 === 'Tue|2026-11-16' && !r.askAfterBook, j([r.tagged, r.pool, r.n2, r.askAfterBook]));
      if (leftovers) {
        rec('G5' + tag + ' the old "Tue" day note left behind by the live code is shown once on Tue 17 Nov, then filed under that date by the answer (not carried into every following week)', r.note === 'crane on site' && /"2026-11-17":"crane on site"/.test(r.noteAfter) && !/"Tue"/.test(r.noteAfter), j([r.note, r.noteAfter]));
      }
      await N.close();
      if (!leftovers) {
        // nobody answers (no question was shown) — does an old day-name note roll forward for ever?
        const S2 = makeServer({ id: 'main', version: 1, nid: 9, settings: { delNotes: { Tue: 'crane on site' } }, orders: [O('WO-N2')] });
        const outs = [];
        for (const now of ['2026-11-16T09:00:00Z', '2026-11-23T09:00:00Z', '2026-12-07T09:00:00Z']) { const P = await open(browser, S2, { now }); outs.push(await P.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 120)); return { ask: !!document.getElementById('del-legacy'), tue: delNoteGet(addDayISO(thisWk(), 1)) }; })); await P.close(); }
        info('G6 an old day note ("Tue: crane on site") with NO old bookings: shown on Tuesday of Wk 47 / 48 / 50', j(outs));
        rec('G6 an old day-name note with no old bookings does not reappear on every following week\'s Tuesday', !(outs[1].tue && outs[2].tue), j(outs));
      }
    }
    // G7 brand-new empty database on the release
    const S = makeServer({ id: 'main', version: 1, nid: 1, settings: {}, orders: [] });
    const N = await open(browser, S, { now: '2026-11-16T09:00:00Z' });
    const e = await N.page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const o = {}; for (const tb of ['d', 'b', 'x', 'l', 's']) { showTab(tb); await W(80); o[tb] = document.getElementById('app').innerText.length; }
      showTab('d'); await W(80); o.ask = !!document.getElementById('del-legacy'); o.btns = ['btn-delreset', 'btn-deltag'].filter(i => document.getElementById(i)).join(); return o; });
    rec('G7 an empty plan on the release: every page opens, no question, no Close week / catch-up button, no errors', !e.ask && !e.btns && !(S.errors || []).length && e.d > 100, j([e, S.errors]));
    await N.close();
  }

  // =====================================================================================================================
  // H. The catch-up button cut-off
  // =====================================================================================================================
  {
    const J = (wo, due, x) => H.order(Object.assign({ wo, dueDate: due, origDueDate: due, plannedWeek: '', step: '7. ASSEMBLY COMPLETE', delv: false, customer: 'CAIRN', title: 'House ' + wo }, x));
    const mk = () => ({ id: 'main', nid: 9, settings: {}, orders: [J('WO-OCT31', '2026-10-31'), J('WO-NOV1', '2026-11-01'), J('WO-DEC', '2026-12-01', { step: '8. PALLETED' }), J('WO-NODATE', ''), J('WO-SEP', '2026-09-01'),
      J('WO-SHIP', '2026-11-20', { shippedAt: '2026-11-10T10:00:00Z' }), J('WO-CUT', '2026-11-20', { step: '6. CUT' }), J('WO-TAGGED', '2026-11-20', { delv: true })] });
    const run = async (typed, role) => {
      const t = await H.open({ browser, now: NOW, row: mk() });
      const r = await t.page.evaluate(async ({ typed, role }) => { const W = ms => new Promise(r => setTimeout(r, ms)); setWho('Ann');
        if (role) { ls.set('wpfPin_' + role, pins()[role]); ROLE = role; if (role === 'prod' && typeof prodTab !== 'undefined') prodTab = 'deliv'; render(); await W(100); } else { showTab('d'); await W(120); }
        const b = document.getElementById('btn-deltag'); const out = { btn: b ? b.textContent.replace(/\s+/g, ' ').trim() : '', wkbar: !!document.getElementById('del-wkbar') };
        const asks = []; window.prompt = (m, d) => { asks.push(d); return typed; }; window.confirm = m => { asks.push(String(m)); return true; };
        if (b) { b.click(); await W(200); }
        out.asks = asks; out.tagged = DB.orders.filter(o => o.delv).map(o => o.wo).sort().join(); out.toast = (document.getElementById('toast') || {}).textContent || ''; return out; }, { typed, role });
      await t.close(); return r;
    };
    const d = await run('2026-11-01');
    rec('H1 button says "… due from 1 Nov 26 for delivery (2)"; default cut-off offered is 2026-11-01', /due from 1 Nov 26 for delivery \(2\)/.test(d.btn) && d.asks[0] === '2026-11-01', j([d.btn, d.asks[0]]));
    rec('H2 cut-off 1 Nov: due 1 Nov and 1 Dec are tagged; 31 Oct, 1 Sep, no-date, shipped and step-6 jobs are not; the confirm says how many older are left', d.tagged === 'WO-DEC,WO-NOV1,WO-TAGGED' && /3 older jobs at 7\/8 are left alone/.test(d.asks[1] || ''), j([d.tagged, (d.asks[1] || '').slice(0, 200)]));
    const e = await run('2026-10-31');
    rec('H3 typing an earlier cut-off (31 Oct) brings in the 31 Oct job as well, still not the no-date job', e.tagged === 'WO-DEC,WO-NOV1,WO-OCT31,WO-TAGGED', e.tagged);
    const f = await run('1/11/2026');
    rec('H4 a date typed the Irish way (1/11/2026) tags nothing and says how to type it', f.tagged === 'WO-TAGGED' && /YYYY-MM-DD/.test(f.toast), j([f.tagged, f.toast]));
    const g = await run(' 2026-11-02 ');
    rec('H5 spaces round the date are ignored; cut-off 2 Nov leaves the 1 Nov job out', g.tagged === 'WO-DEC,WO-TAGGED', g.tagged);
    const h = await run('2026-13-45');
    rec('H6 an impossible date (2026-13-45) is refused, not silently used as a cut-off', h.tagged === 'WO-TAGGED' && /YYYY-MM-DD|not a date|Nothing/i.test(h.toast), j([h.tagged, h.toast]));
    const pm = await run('2026-11-01', 'prod');
    info('H7 Production Manager on his 🚚 Deliveries page: catch-up button', j(pm));
    rec('H7 the Production Manager\'s Deliveries page (A1: the full page) has the week bar; the one-off catch-up button stays office-only', pm.wkbar && !pm.btn, j(pm));
  }

  // =====================================================================================================================
  // I. Export Changes after a date move
  // =====================================================================================================================
  {
    const P = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo, value: 4000 }, x));
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [P('WO-1'), P('WO-2'), P('WO-3', { delv: true, step: '8. PALLETED', delVeh: 'VOLVO', delDay: 'Fri', delWk: '2026-11-16' }), P('WO-4'), P('P-0007', { title: 'Pre-production job' })] });
    const t = await open(browser, S, { now: NOW }), p = t.page;
    const r = await p.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); setWho('Ann'); const out = {};
      XLSX.writeFile = (wb, name) => { window.__wb = { names: wb.SheetNames, dates: XLSX.utils.sheet_to_json(wb.Sheets.Dates || {}, { header: 1 }), chg: XLSX.utils.sheet_to_json(wb.Sheets.Changes || {}, { header: 1 }) }; };
      moveDates(['WO-1'], { due: '2026-11-27' }, { why: 'Other: <img src=x onerror="window.__xss=1">', note: 'O\'Grady said "later"' }, 'Ann').apply();
      moveDates(['WO-2', 'WO-3', 'P-0007'], { toWk: '2026-11-23' }, { why: 'Site not ready' }, 'Ann', { src: 'group' }).apply();
      moveDates(['WO-4'], { due: '2026-11-27' }, { why: 'Production' }, 'Ann').apply(); moveDates(['WO-4'], { due: '2026-11-20' }, { why: 'Production' }, 'Ann').apply(); // there and back
      showTab('x'); await W(150);
      const el = document.getElementById('exp-dates'); out.txt = el ? el.innerText.replace(/\s+/g, ' ') : ''; out.img = el ? el.querySelectorAll('img').length : -1; out.xss = !!window.__xss;
      out.rows = datesToCienRows().map(d => d.o.wo + ':' + d.f + ':' + d.has + '>' + d.to).join();
      out.g = ['WO-1', 'WO-2', 'WO-3', 'WO-4', 'P-0007'].map(w => { const o = DB.orders.find(x => x.wo === w); return w + ' due ' + o.dueDate + ' wk ' + o.plannedWeek + ' van ' + (o.delDay || '-') + (o.delRebook ? ' rebook' : ''); }).join(' ; ');
      const b = document.getElementById('btn-xchg2'); if (b) { b.click(); await W(150); } out.wb = window.__wb || null;
      const m = document.getElementById('btn-mark'); if (m) { m.click(); await W(150); } out.afterMark = datesToCienRows().map(d => d.o.wo).join();
      return out; });
    info('I Export Changes after date moves', j(r));
    rec('I1 "Dates to change in Cienapps" lists WO-1 (20→27 Nov), WO-2 and WO-3 (20→27 Nov, week move); not WO-4 (moved and moved back), not the pre-production P- job', r.rows === 'WO-1:due:2026-11-20>2026-11-27,WO-2:due:2026-11-20>2026-11-27,WO-3:due:2026-11-20>2026-11-27', r.rows);
    rec('I2 a reason with HTML and quotes is shown as text (no image element, no script run)', r.img === 0 && !r.xss && /O'Grady said "later"/.test(r.txt), r.txt.slice(0, 300));
    rec('I3 the Changes Excel has a Dates sheet with exactly those 3 jobs (Cienapps has 2026-11-20 → change to 2026-11-27)', r.wb && r.wb.names.includes('Dates') && r.wb.dates.length === 4 && r.wb.dates.slice(1).every(x => x[5] === '2026-11-20' && x[6] === '2026-11-27'), j(r.wb && r.wb.dates));
    const chgWos = r.wb ? r.wb.chg.slice(1).map(x => String(x[0])) : [];
    const chg = r.wb ? r.wb.chg.slice(1) : [];
    rec('I4 the same Excel\'s Changes sheet has the build-week change (Wk 47 → Wk 48) with the NEW due date for the jobs whose week moved (WO-1, WO-2); WO-3 (built, week kept) is not there', ['WO-1', 'WO-2'].every(w => chg.some(x => x[0] === w && /Wk 47/.test(x[4]) && /Wk 48/.test(x[5]) && x[9] === '2026-11-27')) && !chgWos.includes('WO-3'), j(r.wb && r.wb.chg.slice(0, 6)));
    rec('I5 "Mark as applied" leaves the date rows (they go only when an import shows Cienapps has the date)', r.afterMark === 'WO-1,WO-2,WO-3', r.afterMark);
    rec('I6 the week move took the booked job off its van and marked it "rebook"', /WO-3 due 2026-11-27 wk [^;]* van - rebook/.test(r.g), r.g);
    await save(p);
    // the row that was saved: no new top-level key
    const keys = Object.keys(S.patches[S.patches.length - 1] || {}).sort().join();
    rec('I7 the save sends only the columns that exist today (orders, settings, nid, version / updated_by) — no new top-level key', keys.split(',').every(k => ['orders', 'settings', 'nid', 'version', 'updated_by', 'updated_at'].includes(k)), keys);
    rec('I no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  }

  await browser.close();
  const f = res.filter(x => !x.ok);
  console.log('\nattack6-release: ' + (res.length - f.length) + ' passed, ' + f.length + ' failed' + (f.length ? '\nFAILED:\n - ' + f.map(x => x.n).join('\n - ') : ''));
  process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
