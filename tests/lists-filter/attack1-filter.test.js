// ATTACK 1 — Cutting Lists page Project filter (branch feature/lists-project-filter, Garry 11 Nov). Fake Supabase only.
// Tester: tries to break it. Never edits index.html, never touches the live database.
// Run: node tests/lists-filter/attack1-filter.test.js
// A check whose name starts with "FINDING" is a problem the Tester wants Garry / the Manager to see (it is expected to FAIL
// until the Coder deals with it or Garry accepts it).
const X = require('./fixl.js');
const A = require('../stage3/atk.js');
const { F, D, H } = X;
const res = []; const fails = [];
const rec = (n, ok, d) => { res.push(!!ok); if (!ok) fails.push(n); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 500) : '')); };
const j = JSON.stringify;
const MAIN = A.gitShow('origin/main');
const wait = (p, ms) => p.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms || 80);

const snap = p => p.evaluate(() => {
  const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const tagOf = e => { const t = e.querySelector('[data-lpfp]'); return t ? txt(t).replace('🏗 ', '') : null; };
  const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && r.left >= -1 && r.right <= innerWidth + 1; };
  const rows = sel => [...document.querySelectorAll(sel)].map(e => ({ id: e.getAttribute('data-ltirow') || e.getAttribute('data-ltiwc') || e.getAttribute('data-lhrow') || e.getAttribute('data-nrow') || txt(e.querySelector('b')), proj: tagOf(e), seen: vis(e.querySelector('[data-lpfp]')) }));
  const s = document.getElementById('lh-proj');
  return { bar: !!document.getElementById('lpf'), sel: s ? s.value : null, opts: s ? [...s.options].map(o => o.textContent) : [], vals: s ? [...s.options].map(o => o.value) : [], n: txt(document.getElementById('lpf-n')), x: !!document.getElementById('lpf-x'), of: txt(document.getElementById('lti-of')),
    allBtn: txt(document.getElementById('lti-all')), issue: rows('[data-ltirow]'), wc: rows('[data-ltiwc]'), need: rows('[data-nrow]'), holds: rows('.hold-grp .wl-drow'), home: rows('[data-lhrow]'),
    relBtns: [...document.querySelectorAll('[data-relg]')].map(b => txt(b.parentElement)), badge: txt(document.getElementById('listcnt')),
    grp: [...document.querySelectorAll('.lh-grp>div:first-child b')].map(txt), side: document.documentElement.scrollWidth - innerWidth, toast: txt(document.getElementById('toast')), lti: txt(document.getElementById('lti')) };
});
const pick = (p, v) => p.evaluate(async v => { const s = document.getElementById('lh-proj'); s.value = v; s.onchange(); await new Promise(r => setTimeout(r, 60)); }, v);
const ids = a => a.map(r => r.id).sort().join();
const all = (a, f) => a.length > 0 && a.every(f);
const office = async (browser, S, vp) => { const t = await F.dev(browser, S, 'office', { viewport: vp || { width: 1280, height: 900 } }); await t.page.evaluate(() => { setWho('Ann'); showTab('l'); render(); }); return t; };
// a page running a GIVEN index.html (HEAD or origin/main) against the fake server
async function openHtml(browser, S, html, role, vp, lsInit) {
  const t = await F.open(browser, S, { now: F.NOW, viewport: vp || { width: 1280, height: 900 } });
  await t.page.route(u => String(u).startsWith('https://wpf.test/'), route => { const m = route.request().method(), url = route.request().url(); if (m === 'HEAD' || url.includes('?v=')) return route.fulfill({ status: 200, body: '' }); return route.fulfill({ status: 200, contentType: 'text/html', body: html }); });
  await t.page.evaluate(o => { Object.entries(o || {}).forEach(([k, v]) => localStorage.setItem(k, v)); }, lsInit || {});
  await t.page.reload(); await t.page.waitForFunction(() => typeof loadDB === 'function' && typeof XLSX !== 'undefined'); await t.page.waitForTimeout(300);
  await t.page.evaluate(async role => { await loadDB(); localStorage.setItem('wpfPin_' + role, '9000'); localStorage.setItem('wpfOpName', 'Op'); setRole(role); if (typeof setWho === 'function') setWho('Ann'); if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } render(); }, role);
  return t;
}
// the page, with the bits that legitimately differ run to run taken out
const appHtml = p => p.evaluate(() => document.getElementById('app').innerHTML.replace(/\s+/g, ' '));

(async () => {
  const browser = await H.chromium.launch();
  try {
    // =========================================================== 1. Confirm all green with a filter on
    {
      const S = X.server();
      const t = await office(browser, S), p = t.page;
      let s = await snap(p);
      const greenAll = await p.evaluate(() => ltiRows().filter(r => r.lvl === 'strong' && r.tid).map(r => r.o.wo).sort());
      rec('1a All projects: "Confirm all green (N)" counts every project', s.allBtn === '✓ Confirm all green (' + greenAll.length + ')' && greenAll.length >= 5, j([s.allBtn, greenAll]));
      await pick(p, 'P1'); s = await snap(p);
      const greenP1 = await p.evaluate(() => ltiRows().filter(r => r.lvl === 'strong' && r.tid).map(r => r.o.wo).sort());
      rec('1b ELLIOTTS picked: the button count is ONLY that project\'s green rows (3), fewer than All', s.allBtn === '✓ Confirm all green (3)' && greenP1.length === 3 && greenP1.every(w => /WO-26-14/.test(w)) && greenAll.length > 3, j([s.allBtn, greenP1]));
      rec('1c …and the page says it is only showing that project next to the button ("of 9 — only ELLIOTTS ADERRIG 4")', /of 9 — only ELLIOTTS ADERRIG 4/.test(s.of) && /Only ELLIOTTS ADERRIG 4/.test(s.n), j([s.of, s.n]));
      const before = S.db.t.lists.length;
      await p.evaluate(async () => { document.getElementById('lti-all').click(); for (let i = 0; i < 60 && (LTI.busy.size || !LTI.done.length); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 200)); });
      const made = S.db.t.lists.slice(before).map(l => (l.wos || []).join()).sort();
      s = await snap(p);
      rec('1d pressing it makes lists ONLY for the 3 jobs shown — no other project is touched', j(made) === j(['WO-26-1410', 'WO-26-1411', 'WO-26-1416']), j(made));
      rec('1e the made lists are filed under ELLIOTTS ADERRIG 4', S.db.t.lists.slice(before).every(l => l.project_id === 'P1'), j(S.db.t.lists.slice(before).map(l => l.project_id)));
      rec('1f the message says how many were made ("3 lists made")', /3 lists made/.test(s.toast), s.toast);
      rec('1g afterwards: nothing to issue for that project, and the page says so for THAT project (not "every work order has a list")', /Nothing to issue for ELLIOTTS ADERRIG 4/.test(s.lti) && !/Every processed work order has a cutting list/.test(s.lti), s.lti.slice(0, 200));
      rec('1h the tab badge still shows the other projects\' jobs (not 0)', +s.badge >= 5, s.badge);
      await pick(p, ''); s = await snap(p);
      rec('1i back to All projects: the other 5 jobs are still waiting to be issued', s.issue.length === 5 && !s.issue.some(r => /WO-26-14/.test(r.id)), j(s.issue.map(r => r.id)));
      rec('1j no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // =========================================================== 2. ARRIVED — RELEASE ALL with a filter on (same board, two projects)
    {
      const S = X.server();
      // CAIRN also has a row parked on MFC White — the same board as ELLIOTTS' row
      F.seedList(S, 'LC2', { name: 'Apt 2', wos: ['WO-26-2302'], list: { project_id: 'P2' }, lines: [['saw', 'Top', '1', 900, 560, 'MFC White', '', '', { status: 'waiting', status_at: '2026-10-20T12:00:00Z', status_by: 'Saw Tom' }]] });
      const t = await office(browser, S), p = t.page;
      let s = await snap(p);
      rec('2a All projects: MFC White group shows 2 rows waiting (ELLIOTTS + CAIRN)', s.relBtns.some(b => /MFC White — 2 rows waiting/.test(b)), j(s.relBtns));
      await pick(p, 'P1'); s = await snap(p);
      rec('2b ELLIOTTS picked: the group shows 1 row waiting', s.relBtns.length === 1 && /MFC White — 1 row waiting/.test(s.relBtns[0]) && s.holds.length === 1, j(s.relBtns));
      rec('FINDING 2c [Medium] with a filter on, "ARRIVED — RELEASE ALL" should say that rows of OTHER projects waiting on the same board are hidden and will stay parked', /other project|hidden|not shown|only ELLIOTTS/i.test(s.relBtns[0] || ''), s.relBtns[0]);
      await p.evaluate(async () => { document.querySelector('[data-relg]').click(); await new Promise(r => setTimeout(r, 300)); await lqSend(); await new Promise(r => setTimeout(r, 200)); });
      const st = id => (D.find(S.db, 'list_lines', id) || {}).status;
      s = await snap(p);
      rec('2d pressing it releases ONLY the row shown (ELLIOTTS); CAIRN\'s row on the same board stays parked', st('L12:1') !== 'waiting' && st('LC2:1') === 'waiting' && st('LC1:1') === 'waiting', j([st('L12:1'), st('LC2:1'), st('LC1:1')]));
      rec('2e the message counts what was released ("1 row released")', /1 row released/.test(s.toast), s.toast);
      rec('2f NOTE (part of finding 2c): after releasing, the "Waiting on material" panel disappears altogether while CAIRN\'s row on the same board is still parked', s.holds.length === 0 && !/Waiting on material/.test(await p.evaluate(() => document.getElementById('app').textContent)), 'holds shown: ' + s.holds.length);
      await pick(p, ''); s = await snap(p);
      rec('2g All projects again: CAIRN\'s MFC White row (and its Oak row) are still there to release', s.holds.length === 2, j(s.holds));
      rec('2h no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // =========================================================== 3. A remembered filter the next morning — are LATE jobs of other projects hidden?
    {
      const S = X.server();
      S.row.orders.push(X.H.order({ wo: 'WO-26-2399', customer: 'CAIRN PARKSIDE PH3', unit: '9', title: 'APT 9 KITCHEN TYPE A', step: '5. WORK ORDER PROCESSED', dueDate: '2026-10-22', origDueDate: '2026-10-22', plannedWeek: '2026-10-19', procAt: '2026-10-01' }));
      const t = await office(browser, S), p = t.page;
      const lateAll = await p.evaluate(() => ltiRows().filter(r => r.late).map(r => r.o.wo));
      rec('3a (set-up) a CAIRN job is LATE for its cutting list', lateAll.includes('WO-26-2399'), j(lateAll));
      await pick(p, 'P1');
      await p.reload(); await p.waitForFunction(() => typeof lsLoad === 'function');
      await p.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_office', '9000'); setRole('office'); setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); render(); await new Promise(r => setTimeout(r, 80)); });
      const s = await snap(p);
      rec('3b next morning the page opens on the remembered project, clearly marked (blue bar, "Only …", ✕ All projects)', s.sel === 'P1' && s.x && /Only ELLIOTTS ADERRIG 4/.test(s.n) && await p.evaluate(() => document.getElementById('lpf').classList.contains('lpf-on')), j([s.sel, s.n]));
      rec('3c the tab badge still counts the hidden late job', +s.badge === 10, s.badge);
      rec('FINDING 3d [Medium] a remembered filter hides another project\'s LATE list with no red warning on the page (only "of 10")', /\blate\b/i.test(s.lti) || /\blate\b/i.test(s.n), j([s.of, s.n, 'red border: ' + (await p.evaluate(() => /192, 57, 43/.test(getComputedStyle(document.getElementById('lti')).borderColor)))]));
      await t.page.context().close();
    }

    // =========================================================== 4. Remembered project is renamed / archived / deleted (by another PC)
    {
      const S = X.server();
      const t = await office(browser, S), p = t.page;
      await pick(p, 'P1');
      const touch = (id, patch) => { const r = D.find(S.db, 'projects', id); Object.assign(r, patch, { updated_at: new Date(Date.now() + 5000).toISOString(), version: (r.version || 1) + 1 }); };
      touch('P1', { name: 'ELLIOTTS ADERRIG PHASE 4 (RENAMED)' });
      await p.evaluate(async () => { await lsPoll(); render(); await new Promise(r => setTimeout(r, 60)); });
      let s = await snap(p);
      rec('4a renamed on another PC: the filter stays on the same project under its new name, same rows', s.sel === 'P1' && /Only ELLIOTTS ADERRIG PHASE 4 \(RENAMED\)/.test(s.n) && ids(s.home) === 'L12,L14' && all(s.home, r => r.proj === 'ELLIOTTS ADERRIG PHASE 4 (RENAMED)'), j([s.sel, s.n, s.home]));
      rec('4b …and its jobs still belong to it (matched through the Cienapps name, not the display name)', s.issue.length === 3, j(s.issue));
      touch('P1', { active: false });
      await p.evaluate(async () => { await lsPoll(); render(); await new Promise(r => setTimeout(r, 60)); });
      s = await snap(p);
      rec('4c archived (made inactive) on another PC: the page does not crash and the project\'s lists are still shown', s.bar && ids(s.home) === 'L12,L14' && !(S.errors || []).length, j([s.sel, s.home, S.errors]));
      const np = await p.evaluate(() => ({ noneOpt: [...document.getElementById('lh-proj').options].find(o => o.value === '~none').textContent, jobsP1: lpfJobs(listsNeeded()).length }));
      rec('FINDING 4d [Low] archived project: its 3 waiting jobs drop out of its own filter and move to "No project" (lists stay, jobs go)', s.issue.length === 3, j([s.issue.length, np]));
      // deleted while the page is open
      S.db.t.lists.filter(l => l.project_id === 'P1').forEach(l => { l.project_id = null; });
      S.db.t.projects = S.db.t.projects.filter(r => r.id !== 'P1');
      await p.evaluate(async () => { lsReset(); await lsLoad(); render(); await new Promise(r => setTimeout(r, 60)); });
      s = await snap(p);
      rec('4e project deleted: falls back to All projects, forgotten on the device, everything visible', s.sel === '' && !s.x && s.home.length === 6 && await p.evaluate(() => (localStorage.getItem('wpfListProj') || '') === ''), j([s.sel, s.home.length]));
      // garbage in the remembered value
      for (const bad of ['<img src=x onerror=window.__pwn=1>', '"><script>window.__pwn=1</script>', 'null', '   ', '~none ', 'P2 ']) {
        await p.evaluate(async bad => { localStorage.setItem('wpfListProj', bad); LH.proj = bad; render(); await new Promise(r => setTimeout(r, 40)); }, bad);
        s = await snap(p);
        if (!(s.sel === '' && s.home.length === 6 && !(await p.evaluate(() => window.__pwn)))) rec('4f rubbish remembered value ' + j(bad) + ' → All projects, nothing run', false, j([s.sel, s.home.length]));
      }
      rec('4f rubbish in the remembered value (HTML, "null", spaces) → All projects, nothing run as code', !(await p.evaluate(() => window.__pwn)) && !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // =========================================================== 5. Two PCs
    {
      const S = X.server();
      const a = await office(browser, S), b = await office(browser, S), pa = a.page, pb = b.page;
      await pick(pa, 'P1');
      let s0 = await snap(pa);
      // PC B makes a list for a CAIRN job
      await pb.evaluate(async () => { ltiConfirm(['WO-26-2302']); for (let i = 0; i < 50 && !LTI.done.length; i++) await new Promise(r => setTimeout(r, 100)); });
      rec('5a (set-up) PC B made a list for CAIRN WO-26-2302', S.db.t.lists.some(l => (l.wos || []).includes('WO-26-2302') && l.project_id === 'P2'), j(S.db.t.lists.map(l => l.id + ':' + (l.wos || []).join())));
      await pa.evaluate(async () => { await lsPoll(); await new Promise(r => setTimeout(r, 300)); });
      let s = await snap(pa);
      rec('5b PC A (filter on ELLIOTTS) after its 10-second refresh: still ELLIOTTS only, "5 of 14" unchanged (a job became a list: 14 stays 14)', s.sel === 'P1' && /5 of 14 shown/.test(s.n) && ids(s.home) === 'L12,L14', j([s.n, ids(s.home)]));
      rec('5c PC A: the tab badge and the "of 9" heading still count every project (the CAIRN job left "to issue" and its new list joined "waiting for check": 9 stays 9)', s0.badge === '9' && s.badge === '9' && /of 9 — only/.test(s.of) && await pa.evaluate(() => listsNeeded().length === 7 && lsWaitCheckLists().length === 2), j([s0.badge, s.badge, s.of]));
      // PC B adds a brand-new list with no WO for DURKAN, and a new project
      F.seedList(S, 'LNEW', { name: 'House 8 wardrobes', wos: [], list: { project_id: 'P4', updated_at: new Date(Date.now() + 9000).toISOString(), created_at: new Date(Date.now() + 9000).toISOString() } });
      D.insert(S.db, 'projects', { id: 'P7', name: 'NEW SCHEME KILCOCK', customer: 'New', cien_names: ['NEW SCHEME KILCOCK'], updated_at: new Date(Date.now() + 9000).toISOString() });
      await pa.evaluate(async () => { await lsPoll(); await new Promise(r => setTimeout(r, 300)); });
      s = await snap(pa);
      rec('5d another PC adds a list for a different project: PC A shows "5 of 15", DURKAN (2) in the drop-down, the new project listed', /5 of 15 shown/.test(s.n) && s.opts.includes('DURKAN HANSFIELD (2)') && s.opts.includes('NEW SCHEME KILCOCK') && s.sel === 'P1', j([s.n, s.opts]));
      rec('5e …and PC A\'s own rows did not change', ids(s.home) === 'L12,L14' && s.issue.length === 3, j([ids(s.home), s.issue.length]));
      // PC B's filter is its own
      rec('5f the filter is per device: PC B is still on All projects', (await snap(pb)).sel === '', '');
      // PC A confirm-all while PC B already made one of them
      await pb.evaluate(async () => { LTI.done.length = 0; ltiConfirm(['WO-26-1410']); for (let i = 0; i < 50 && !LTI.done.length; i++) await new Promise(r => setTimeout(r, 100)); });
      const n0 = S.db.t.lists.length;
      await pa.evaluate(async () => { document.getElementById('lti-all').click(); for (let i = 0; i < 80 && (LTI.busy.size || LTI.done.length < 3); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 200)); });
      const dup = S.db.t.lists.filter(l => (l.wos || []).includes('WO-26-1410') && !l.archived).length;
      rec('5g PC A "Confirm all green (3)" when PC B just made one of them: no second list for that job, 2 new lists only', dup === 1 && S.db.t.lists.length === n0 + 2, j([dup, S.db.t.lists.length - n0]));
      rec('5h no page errors on either PC', !(S.errors || []).length, j(S.errors));
      await a.page.context().close(); await b.page.context().close();
    }

    // =========================================================== 6. & < > ' " in customer / project names; a job whose customer has no project
    {
      const evil = `O'Brien & Sons <Homes> "Phase 2"`;
      const S = X.server({ projects: [['PE', evil, `O'Brien & Sons`]] });
      S.row.orders.push(X.H.order({ wo: 'WO-26-8001', customer: evil, unit: '1', title: 'HOUSE 1 KITCHEN', step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-20', origDueDate: '2026-11-20', procAt: '2026-10-20' }),
        X.H.order({ wo: 'WO-26-8002', customer: `<b>Nobody</b> & "Co" 'Ltd'`, unit: '2', title: 'HOUSE 2 <i>KITCHEN</i>', step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-20', origDueDate: '2026-11-20', procAt: '2026-10-20' }));
      F.seedList(S, 'LEV', { name: `House "1" <O'B>`, wos: [], list: { project_id: 'PE' }, lines: [['saw', 'Side', '2', 720, 560, 'MFC <White> & "Oak"', '', '', { status: 'waiting', status_at: '2026-10-20T10:00:00Z', status_by: `Tom O'Shea` }]] });
      F.seedList(S, 'TEV', { name: `Type 'A' & <B>`, wos: [], list: { project_id: 'PE', is_template: true, type_name: `Type 'A' & <B>` } });
      const t = await office(browser, S), p = t.page;
      await p.evaluate(() => { LH.kind = 'all'; lstAttachOpen = 'x'; render(); });
      let s = await snap(p);
      rec('6a the job whose customer matches no project is tagged "No project" (its raw customer name still shown as text)', (s.issue.find(r => r.id === 'WO-26-8002') || {}).proj === 'No project' && (s.need.find(r => r.id === 'WO-26-8002') || {}).proj === 'No project' && /<b>Nobody<\/b> & "Co" 'Ltd'/.test(await p.evaluate(() => document.querySelector('[data-nrow="WO-26-8002"]').textContent)), j(s.issue.find(r => r.id === 'WO-26-8002')));
      await pick(p, 'PE'); s = await snap(p);
      rec(`6b project called ${evil}: picked, name shown exactly in the drop-down, count line and heading`, s.sel === 'PE' && s.opts.some(o => o.startsWith(evil + ' (')) && s.n.includes(evil) && s.of.includes(evil), j([s.sel, s.n, s.of]));
      rec('6c …it narrows every section to that project (1 to issue, 1 needed, 1 on hold, 1 list + 1 template) and every row shows the name exactly', ids(s.issue) === 'WO-26-8001' && ids(s.need) === 'WO-26-8001' && s.holds.length === 1 && ids(s.home) === 'LEV,TEV' && all([...s.issue, ...s.need, ...s.holds, ...s.home], r => r.proj === evil && r.seen), j([s.issue, s.need, s.holds, s.home]));
      const inj = await p.evaluate(() => ({ b: [...document.querySelectorAll('#app b')].filter(x => x.textContent === 'Nobody').length, i: [...document.querySelectorAll('#app i')].filter(x => x.textContent === 'KITCHEN').length, homes: document.querySelectorAll('#app homes, #app white, #app o\\\'b').length }));
      rec('6d none of the < > text became real page elements', inj.b === 0 && inj.i === 0 && inj.homes === 0, j(inj));
      await pick(p, '~none'); s = await snap(p);
      rec('6e "No project" shows the unlinked jobs and the loose list only', ids(s.issue) === 'WO-26-8002,WO-26-9001' && ids(s.home) === 'LNP', j([ids(s.issue), ids(s.home)]));
      await p.reload(); await p.waitForFunction(() => typeof lsLoad === 'function');
      await p.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_office', '9000'); setRole('office'); setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); render(); await new Promise(r => setTimeout(r, 80)); });
      rec('6f "No project" is remembered after a reload', (await snap(p)).sel === '~none', '');
      rec('6g no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // =========================================================== 7. 300 projects (and 60) — speed against origin/main, phone width
    {
      const mk = n => { const extra = []; for (let i = 1; i <= n; i++) extra.push(['X' + i, 'SCHEME ' + String(i).padStart(3, '0') + ' ' + ['OAK', 'ASH', 'ELM', 'BIRCH'][i % 4] + ' PARK PHASE ' + (i % 5 + 1), 'Builder ' + i]); return extra; };
      for (const n of [54, 294]) {
        const build = () => { const extra = mk(n); const S = X.server({ projects: extra });
          extra.forEach(([id, name], i) => { if (i % 2 === 0) F.seedList(S, 'LX' + id, { name: 'House ' + (i + 1), wos: [], list: { project_id: id } });
            S.row.orders.push(X.H.order({ wo: 'WO-27-' + (1000 + i), customer: name, unit: String(i), title: 'HOUSE ' + i + ' KITCHEN', step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-20', origDueDate: '2026-11-20', procAt: '2026-10-20' })); });
          return S; };
        const S = build();
        const t = await office(browser, S, { width: 360, height: 800 }), p = t.page;
        let s = await snap(p);
        rec(`7a ${n + 6} projects, 360 px: every project is in the drop-down, no sideways scroll`, s.vals.filter(v => v && v !== '~none').length === n + 6 && s.side <= 1, j([s.vals.length, s.side]));
        rec(`7b ${n + 6} projects: the type-to-find box is there`, await p.evaluate(() => !!document.getElementById('lpf-q')));
        await p.evaluate(async () => { const q = document.getElementById('lpf-q'); q.value = 'scheme 007 '; q.onchange(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
        rec(`7c ${n + 6} projects: typing "scheme 007" jumps to the one project; its job and list show`, s.sel === 'X7' && all([...s.issue, ...s.home], r => /^SCHEME 007 /.test(r.proj) && r.seen) && s.issue.length === 1 && s.home.length === 1, j([s.sel, s.issue, s.home]));
        rec(`7d ${n + 6} projects, filter on, 360 px: no sideways scroll`, s.side <= 1, String(s.side));
        const ms = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 3; i++) render(); return (performance.now() - t0) / 3; });
        await p.evaluate(async () => { document.getElementById('lpf-x').click(); await new Promise(r => setTimeout(r, 60)); });
        const msAll = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 3; i++) render(); return (performance.now() - t0) / 3; });
        let msMain = null;
        if (MAIN) { const S2 = build(); const m = await openHtml(browser, S2, MAIN, 'office', { width: 360, height: 800 }); msMain = await m.page.evaluate(() => { showTab('l'); const t0 = performance.now(); for (let i = 0; i < 3; i++) render(); return (performance.now() - t0) / 3; }); await m.page.context().close(); }
        rec(`7e ${n + 6} projects + ${n} extra jobs: the page draws in under 1.5 s (All projects) and under 1.5 s (one project)`, msAll < 1500 && ms < 1500, `all ${Math.round(msAll)} ms, one project ${Math.round(ms)} ms, origin/main ${msMain == null ? '?' : Math.round(msMain)} ms`);
        rec(`7f ${n + 6} projects: not more than 3× slower than the live version (and not over 400 ms slower)`, msMain == null || msAll < Math.max(msMain * 3, msMain + 400), `all ${Math.round(msAll)} ms vs main ${msMain == null ? '?' : Math.round(msMain)} ms`);
        rec(`7g ${n + 6} projects: no page errors`, !(S.errors || []).length, j(S.errors));
        await t.page.context().close();
      }
    }

    // =========================================================== 8. 360 px with very long names — templates, lists needed, waiting on material
    {
      const long = 'BALLYMORE-SEAMOUNT-RISE-STRATEGIC-HOUSING-DEVELOPMENT-PHASE-3B-BLOCKS-A-TO-F-APARTMENTS';
      const S = X.server({ evil: long });
      S.row.orders.push(X.H.order({ wo: 'WO-26-6001', customer: 'BALLYMORE SEAMOUNT', unit: '1', title: 'HOUSE 1 KITCHEN WITH A VERY LONG TITLE THAT GOES ON AND ON', step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-20', origDueDate: '2026-11-20', procAt: '2026-10-20' }));
      F.seedList(S, 'LE1', { name: 'House-9-with-a-very-long-unbroken-name-indeed-0123456789', wos: [], list: { project_id: 'P6' }, lines: [['saw', 'Side', '2', 720, 560, 'MFC-White-Super-Matt-U11027-ST76-18mm-2800x2070', '', '', { status: 'waiting', status_at: '2026-10-20T10:00:00Z', status_by: 'Tom' }]] });
      F.seedList(S, 'TE1', { name: 'Kitchen Type Z', wos: [], list: { project_id: 'P6', is_template: true, type_name: 'Kitchen Type Z' } });
      for (const role of ['office', 'design', 'prod']) {
        const t = await F.dev(browser, S, role, { viewport: { width: 360, height: 740 } }), p = t.page;
        await p.evaluate(role => { if (role === 'prod') prodTab = 'lists'; if (role === 'office') { setWho('Ann'); showTab('l'); lstAttachOpen = 'x'; } render(); }, role);
        for (const kind of ['live', 'tpl', 'all']) for (const pf of ['', 'P6']) {
          await p.evaluate(async ({ kind, pf }) => { LH.kind = kind; lpfSet(pf); render(); await new Promise(r => setTimeout(r, 50)); }, { kind, pf });
          const s = await snap(p), rows = [...s.issue, ...s.wc, ...s.need, ...s.holds, ...s.home];
          const ok = s.side <= 1 && all(rows, r => r.proj && r.seen) && (kind === 'live' || s.home.some(r => r.id === 'TE1' && r.proj === long && r.seen));
          rec(`8 ${role} 360 px, ${kind}, ${pf ? 'long-named project picked' : 'All'}: no sideways scroll, project in view on every row (${rows.length} rows${kind !== 'live' ? ', templates too' : ''})`, ok, j({ side: s.side, bad: rows.filter(r => !r.proj || !r.seen).slice(0, 4) }));
        }
        const barW = await p.evaluate(() => { const b = document.getElementById('lpf').getBoundingClientRect(), s = document.getElementById('lh-proj').getBoundingClientRect(); return [Math.round(b.right), Math.round(s.right), innerWidth]; });
        rec(`8 ${role} 360 px: the Project bar and its drop-down fit the screen`, barW[0] <= barW[2] + 1 && barW[1] <= barW[2] + 1, j(barW));
        await t.page.context().close();
      }
      rec('8z no page errors', !(S.errors || []).length, j(S.errors));
    }

    // =========================================================== 9. Project filter + search + type + templates + revision + state together
    {
      const S = X.server();
      F.seedList(S, 'LW1', { name: 'House 16 wardrobes', wos: [], list: { project_id: 'P1', list_type: 'room', rev: 2 } });
      F.seedList(S, 'LA1', { name: 'House 3 old', wos: [], list: { project_id: 'P1', archived: true } });
      const t = await office(browser, S), p = t.page;
      const set = (o) => p.evaluate(async o => { Object.assign(LH, { q: '', type: '', kind: 'live', rev: '', state: '' }, o.lh || {}); lpfSet(o.pf || ''); render(); await new Promise(r => setTimeout(r, 50)); }, o);
      const truth = (o) => p.evaluate(o => lsCache().all.filter(l => { const lh = Object.assign({ q: '', type: '', kind: 'live', rev: '', state: '' }, o.lh || {});
        if (lh.kind === 'live' && l.tpl) return false; if (lh.kind === 'tpl' && !l.tpl) return false; if (o.pf && (l.pid || '~none') !== o.pf) return false; if (lh.type && l.ltype !== lh.type) return false;
        if (lh.rev === 'revised' && !((+l.rev || 1) > 1)) return false; const st = lsState(l); if (lh.state === 'any') {} else if (lh.state ? st !== lh.state : st === 'archived') return false;
        if (lh.q && !(l.name + ' ' + (l.wos || []).join(' ')).toLowerCase().includes(lh.q.toLowerCase())) return false; return true; }).map(l => l.id).sort().join(), o);
      const combos = [{ pf: 'P1' }, { pf: 'P1', lh: { rev: 'revised' } }, { pf: 'P1', lh: { state: 'archived' } }, { pf: 'P1', lh: { type: 'room' } }, { pf: 'P2', lh: { type: 'room', kind: 'all' } }, { pf: 'P1', lh: { state: 'any', kind: 'all' } }, { pf: 'P1', lh: { kind: 'tpl' } }, { pf: 'P2', lh: { kind: 'all', q: 'kitchen type b' } },
        { pf: 'P1', lh: { q: 'house 1' } }, { pf: '~none', lh: { kind: 'all', state: 'any' } }, { pf: 'P3', lh: { rev: 'revised' } }, { pf: 'P1', lh: { q: 'WO-26-1412' } }, { pf: '', lh: { rev: 'revised', state: 'any' } }];
      let bad = [];
      for (const c of combos) { await set(c); const s = await snap(p), want = await truth(c); const m = /(\d+) of (\d+) shown/.exec(s.n) || [];
        const pn = c.pf === '~none' ? 'No project' : c.pf ? await p.evaluate(v => lsProjName(v), c.pf) : '';
        const wrongProj = c.pf ? s.home.filter(r => r.proj !== pn) : [];
        if (ids(s.home) !== want || wrongProj.length || !(+m[1] <= +m[2]) || s.sel !== (c.pf || '')) bad.push(j([c, ids(s.home), want, s.n])); }
      rec('9a 13 mixes of project + search + type/templates + revision + state: the rows are exactly the lists that pass ALL the filters, each in the right project, and N never exceeds M', bad.length === 0, bad.join(' || '));
      await set({ pf: 'P1', lh: { q: 'zzz-nothing' } }); let s = await snap(p);
      rec('9b a search that finds nothing inside a project: "No lists match", the project group and filter stay, no error', s.sel === 'P1' && s.home.length === 0 && /No lists match/.test(await p.evaluate(() => document.getElementById('app').textContent)), j([s.sel, s.n]));
      await p.evaluate(async () => { document.getElementById('lpf-x').click(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
      rec('9c "✕ All projects" clears ONLY the project — the search text stays', s.sel === '' && await p.evaluate(() => LH.q === 'zzz-nothing' && document.getElementById('lh-q').value === 'zzz-nothing'), j([s.sel]));
      await set({ pf: 'P2', lh: { q: 'apt', rev: 'revised' } });
      await p.evaluate(async () => { document.getElementById('lh-x').click(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
      rec('9d the small "✕ Clear" clears everything including the project (and forgets it)', s.sel === '' && s.home.length === 7 && await p.evaluate(() => LH.q === '' && LH.rev === '' && (localStorage.getItem('wpfListProj') || '') === ''), j([s.sel, s.home.length]));
      // typing in the search box keeps the project and the cursor
      await set({ pf: 'P1' });
      await p.evaluate(async () => { const q = document.getElementById('lh-q'); q.focus(); q.value = 'h'; q.oninput(); await new Promise(r => setTimeout(r, 40)); const q2 = document.getElementById('lh-q'); q2.value = 'ho'; q2.oninput(); await new Promise(r => setTimeout(r, 40)); });
      s = await snap(p);
      rec('9e typing in the search box: the project stays picked and the box keeps the cursor', s.sel === 'P1' && await p.evaluate(() => document.activeElement && document.activeElement.id === 'lh-q' && document.activeElement.value === 'ho'), j([s.sel]));
      // group buttons
      await set({ pf: '' });
      await p.evaluate(async () => { document.querySelector('[data-lhtpl="P2"]').click(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
      rec('9f the "Templates" button on a project heading picks that project in the top filter and shows its templates', s.sel === 'P2' && ids(s.home) === 'TCA,TCB', j([s.sel, ids(s.home)]));
      rec('9g "N of M" with Templates showing counts templates + jobs for that project (2 templates + 2 jobs = 4)', /4 of \d+ shown/.test(s.n), s.n);
      rec('9h no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // =========================================================== 10. The filter must not leak to other pages / roles on the same device
    {
      const S = X.server();
      F.seedList(S, 'LC2', { name: 'Apt 2', wos: ['WO-26-2302'], list: { project_id: 'P2' }, lines: [['saw', 'Top', '1', 900, 560, 'MFC White', '', '', { status: 'waiting', status_at: '2026-10-20T12:00:00Z', status_by: 'Saw Tom' }]] });
      const t = await office(browser, S), p = t.page;
      await pick(p, 'P1');
      const imp = await p.evaluate(async () => { showTab('i'); const el = document.getElementById('iprev'); el.innerHTML = '<div>' + listsToIssueHTML() + '</div>'; ltiBind(); return { rows: document.querySelectorAll('#iprev [data-ltirow]').length, btn: (document.querySelector('#iprev #lti-all') || {}).textContent, of: !!document.querySelector('#iprev #lti-of'), bar: !!document.getElementById('lpf') }; });
      rec('10a Import page with ELLIOTTS remembered: the "lists to issue" panel shows all 7 jobs, Confirm all green counts all, no filter bar, no "only …"', imp.rows === 7 && /\((\d+)\)/.test(imp.btn || '') && +/\((\d+)\)/.exec(imp.btn)[1] > 3 && !imp.of && !imp.bar, j(imp));
      // the panel inside the Import page is redrawn WITHOUT a full page draw (ltiAfter) — still unfiltered?
      const imp2 = await p.evaluate(async () => { ltiAfter(); return document.querySelectorAll('#iprev [data-ltirow]').length; });
      rec('10b …and it stays unfiltered when only the panel is redrawn after a confirm', imp2 === 7, String(imp2));
      const hop = async (fn) => p.evaluate(fn);
      const dash = await hop(async () => { showTab('h'); await new Promise(r => setTimeout(r, 60)); return { holds: document.querySelectorAll('.hold-grp .wl-drow').length, tags: document.querySelectorAll('[data-lpfp]').length, allHolds: allHolds(['saw', 'fit'], 'hold').length }; });
      rec('10c office Dashboard straight after the filtered Lists page: every waiting-on-material row (3), no project tags added', dash.allHolds === 3 && (dash.holds === 3 || dash.holds === 0) && dash.tags === 0, j(dash));
      for (const role of ['saw', 'stores']) {
        const r = await p.evaluate(async role => { showTab('l'); render(); localStorage.setItem('wpfPin_' + role, '9000'); setRole(role); wlShowHold = true; render(); await new Promise(r => setTimeout(r, 60)); const o = { holds: document.querySelectorAll('.hold-grp .wl-drow').length, tags: document.querySelectorAll('[data-lpfp]').length, bar: !!document.getElementById('lpf'), want: allHolds(typeof holdModes !== 'undefined' ? holdModes : [role === 'saw' ? 'saw' : 'fit'], 'hold').length, lpfPage }; wlShowHold = false; setRole('office'); return o; }, role);
        rec(`10d ${role} waiting book on the same device (ELLIOTTS remembered, coming straight from the Lists page): shows every project's rows, no filter, no tags`, r.holds === 3 && r.tags === 0 && !r.bar && r.lpfPage === false, j(r));
      }
      // a partial redraw while a dialog is open on the Lists page must not un-filter it
      const part = await p.evaluate(async () => { setWho('Ann'); showTab('l'); render(); document.querySelectorAll('.lti-host').forEach(h => { h.innerHTML = ltiInner(); }); ltiBind(); return { rows: document.querySelectorAll('[data-ltirow]').length, sel: document.getElementById('lh-proj').value }; });
      rec('10e Lists page: redrawing only the panel keeps the filter (2 ELLIOTTS jobs + nothing else)', part.sel === 'P1' && part.rows === 3, j(part));
      rec('10f no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // =========================================================== 11. Other roles and the switch-OFF page are identical to origin/main
    if (!MAIN) rec('11 origin/main index.html could not be read (git show) — comparison NOT run', false);
    else {
      const HEADHTML = require('fs').readFileSync(require('path').join(__dirname, '../../index.html'), 'utf8');
      const LSI = { wpfListProj: 'P1' };
      const views = [['saw', null], ['stores', null], ['pm', null], ['driver', null], ['floor', null], ['dash', null], ['prod', 'today'], ['prod', 'snags'],
        ['office', 'b'], ['office', 'd'], ['office', 'h'], ['office', 'i'], ['office', 'x'], ['office', 's']];
      const diffs = [];
      for (const on of [true, false]) {
        const grab = async html => { const S = X.server(on ? {} : { off: true }); const out = {};
          let cur = null, t = null;
          for (const [role, sub] of views.concat(on ? [] : [['office', 'l'], ['design', null]])) {
            if (role !== cur) { if (t) await t.page.context().close(); t = await openHtml(browser, S, html, role, { width: 1280, height: 900 }, LSI); cur = role; }
            await t.page.evaluate(async ({ role, sub }) => { if (role === 'office') showTab(sub); if (role === 'prod') { prodTab = sub; render(); } await new Promise(r => setTimeout(r, 120)); }, { role, sub });
            out[role + (sub ? ':' + sub : '')] = await appHtml(t.page);
          }
          if (t) await t.page.context().close(); out._err = (S.errors || []).length; return out; };
        const a = await grab(HEADHTML), b = await grab(MAIN);
        const names = Object.keys(a).filter(k => k !== '_err');
        const same = names.filter(k => a[k] === b[k]), diff = names.filter(k => a[k] !== b[k]);
        diff.forEach(k => { let i = 0; while (i < a[k].length && a[k][i] === b[k][i]) i++; diffs.push((on ? 'ON ' : 'OFF ') + k + ' @' + i + ': HEAD «' + a[k].slice(Math.max(0, i - 60), i + 120) + '» MAIN «' + b[k].slice(Math.max(0, i - 60), i + 120) + '»'); });
        rec(`11 lists switch ${on ? 'ON' : 'OFF'}, ELLIOTTS remembered on the device: ${names.length} screens (${names.join(', ')}) are character-for-character the same as origin/main`, diff.length === 0 && names.every(k => a[k].length > (k === 'design' && !on ? 20 : 200)) && !a._err, diff.length ? diffs.slice(-diff.length).join(' ## ').slice(0, 900) : same.length + ' identical; errors ' + a._err + '; short: ' + names.filter(k => a[k].length <= 200).join());
      }
    }

    // =========================================================== 12. An old-version screen still open (same database, and same device)
    if (MAIN) {
      const S = X.server();
      const nw = await office(browser, S), pn = nw.page;
      await wait(pn, 2500); // let any start-up save finish first
      const log0 = S.log.filter(x => !/^GET /.test(x)).length, v0 = S.row.version, set0 = j(S.row.settings);
      await pick(pn, 'P1'); await pick(pn, '~none'); await pick(pn, 'P3');
      await pn.evaluate(async () => { document.getElementById('lpf-x').click(); await new Promise(r => setTimeout(r, 1800)); });
      await pick(pn, 'P1'); await wait(pn, 1800);
      const writes = S.log.filter(x => !/^GET /.test(x)).slice(log0);
      rec('12a picking / clearing the filter saves NOTHING to the database (no new saved fields): 0 writes, record version and settings unchanged', writes.length === 0 && S.row.version === v0 && j(S.row.settings) === set0, j(writes.slice(0, 5)) + ' ' + j(S.patches.slice(-1)).slice(0, 300));
      rec('12b the only thing kept is one value on the device (wpfListProj)', await pn.evaluate(() => localStorage.getItem('wpfListProj')) === 'P1');
      // same device, old version opened (it shares localStorage with the new one)
      const old = await openHtml(browser, S, MAIN, 'office', { width: 1280, height: 900 }, { wpfListProj: 'P1' });
      const o = await old.page.evaluate(async () => { showTab('l'); await new Promise(r => setTimeout(r, 100)); return { rows: document.querySelectorAll('[data-lhrow]').length, issue: document.querySelectorAll('[data-ltirow]').length, bar: !!document.getElementById('lpf'), oldSel: !!document.getElementById('lh-proj') }; });
      rec('12c an old-version screen with the new remembered value on the same device: works as before, shows every project (6 lists, 8 to issue)', o.rows === 6 && o.issue === 8 && !o.bar && o.oldSel, j(o));
      // old screen makes a list; new screen (filtered) picks it up
      await old.page.evaluate(async () => { ltiConfirm(['WO-26-1411']); for (let i = 0; i < 50 && !LTI.done.length; i++) await new Promise(r => setTimeout(r, 100)); });
      await pn.evaluate(async () => { await lsPoll(); await new Promise(r => setTimeout(r, 300)); });
      const s = await snap(pn);
      rec('12d a list made on the old screen appears on the new filtered screen under its project (3 lists, 2 left to issue)', s.sel === 'P1' && s.home.length === 3 && s.issue.length === 2 && all(s.home, r => r.proj === 'ELLIOTTS ADERRIG 4'), j([s.home, s.issue.length]));
      rec('12e no page errors on either screen', !(S.errors || []).length, j(S.errors));
      await nw.page.context().close(); await old.page.context().close();
    }

    // =========================================================== 13. "Clear All Orders" then a fresh import (Garry will do exactly this)
    {
      const S = X.server();
      const t = await office(browser, S), p = t.page;
      await p.evaluate(async () => { LH.kind = 'all'; render(); }); await pick(p, 'P1');
      const tplBefore = (await snap(p)).home.filter(r => /^T/.test(r.id)).map(r => r.id + '=' + r.proj).sort();
      const nLists = S.db.t.lists.length, nLines = S.db.t.list_lines.length, nProj = S.db.t.projects.length;
      await p.evaluate(async () => { window.prompt = () => 'DELETE'; showTab('b'); await new Promise(r => setTimeout(r, 80)); document.getElementById('btn-clearall').click(); for (let i = 0; i < 60 && DB.orders.length; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 400)); try { await lqSend(); } catch (e) {} await new Promise(r => setTimeout(r, 1800)); });
      rec('13a (set-up) Clear All Orders ran: 0 orders in the planner and on the fake server, a safety backup was taken first', (await p.evaluate(() => DB.orders.length)) === 0 && (S.row.orders || []).length === 0 && S.backups.length >= 1, j([(S.row.orders || []).length, S.backups.length]));
      rec('13b the lists tables are untouched: same number of lists, lines and projects (nothing deleted)', S.db.t.lists.length === nLists && S.db.t.list_lines.length === nLines && S.db.t.projects.length === nProj, j([S.db.t.lists.length, nLists, S.db.t.list_lines.length, nLines]));
      await p.evaluate(async () => { showTab('l'); await lsPoll(); render(); await new Promise(r => setTimeout(r, 100)); });
      let s = await snap(p);
      rec('13c after the clear the remembered filter is still ELLIOTTS, and its 4 templates are still listed under it, each showing the project', s.sel === 'P1' && j(s.home.filter(r => /^T/.test(r.id)).map(r => r.id + '=' + r.proj).sort()) === j(tplBefore) && tplBefore.length === 4, j([s.sel, s.home]));
      rec('13d …nothing to issue (no orders), page says so for the project, no errors', s.issue.length === 0 && /Nothing to issue for ELLIOTTS ADERRIG 4/.test(s.lti) && !(S.errors || []).length, j([s.issue.length, S.errors]));
      await pick(p, ''); s = await snap(p);
      rec('13e All projects after the clear: all 7 templates under their own projects, all 6 lists still there', s.home.filter(r => /^T/.test(r.id)).length === 7 && s.home.filter(r => !/^T/.test(r.id)).length === 6 && all(s.home, r => r.proj), j(s.home.map(r => r.id + '=' + r.proj)));
      const unlinked = S.db.t.lists.filter(l => !l.is_template && l.project_id && !(l.wos || []).length).map(l => l.id).sort();
      rec('13f NOTE (not new in this release — same code on main): Clear All Orders UNTAGS every existing list from its work order (L12, L14, LC1, LG5, LD7 now have no WO)', true, 'lists with no WO after the clear: ' + unlinked.join());
      await pick(p, 'P1');
      // fresh import of the Cienapps export (headers with trailing spaces)
      const rows = [['WO # ', 'Title ', 'Customer ', 'Due Date ', 'Step ', 'Sub-Total ', 'Unit '],
        ['WO-26-1410', 'HOUSE 10 KITCHEN TYPE 1L', 'ELLIOTTS ADERRIG 4', 46346, '5. WORK ORDER PROCESSED', 5000, '10'], ['WO-26-1412', 'HOUSE 12 KITCHEN TYPE 1R', 'ELLIOTTS ADERRIG 4', 46346, '5. WORK ORDER PROCESSED', 5000, '12'],
        ['WO-26-1420', 'HOUSE 20 KITCHEN TYPE 2R', 'ELLIOTTS ADERRIG 4 ', 46346, '5. WORK ORDER PROCESSED', 5000, '20'],
        ['WO-26-2301', 'APT 1 KITCHEN TYPE A', 'CAIRN PARKSIDE PH3', 46346, '5. WORK ORDER PROCESSED', 5000, '1'], ['WO-26-2310', 'APT 10 KITCHEN TYPE B', 'CAIRN PARKSIDE PH3', 46346, '5. WORK ORDER PROCESSED', 5000, '10'],
        ['WO-26-9100', 'ONE-OFF KITCHEN', 'BRAND NEW CUSTOMER LTD', 46346, '5. WORK ORDER PROCESSED', 5000, '1']];
      const r = await H.importAoa(p, rows);
      const applied = await p.evaluate(async () => { try { applyImport(IMPPLAN); } catch (e) { return 'ERR ' + e.message; } await new Promise(r => setTimeout(r, 500)); return DB.orders.map(o => o.wo + '|' + o.customer).sort(); });
      rec('13g (set-up) the fresh import brought 6 work orders in', Array.isArray(applied) && applied.length === 6, j(applied) + ' plan:' + j(r.pend));
      const impPanel = await p.evaluate(() => ({ rows: document.querySelectorAll('#iprev [data-ltirow]').length, need: listsNeeded().length }));
      rec('13h straight after the import, the Import page\'s "lists to issue" panel shows EVERY project\'s jobs (filter not applied there)', impPanel.rows === impPanel.need && impPanel.need >= 4, j(impPanel));
      await p.evaluate(async () => { showTab('l'); LH.kind = 'all'; render(); await new Promise(r => setTimeout(r, 100)); });
      s = await snap(p);
      const need = await p.evaluate(() => listsNeeded().map(o => o.wo).sort());
      rec('13i back on Cutting Lists: still ELLIOTTS, its imported jobs are the only ones to issue, each tagged with the project (customer with a trailing space matched too)', s.sel === 'P1' && s.issue.length >= 2 && all(s.issue, r => /^WO-26-14/.test(r.id) && r.proj === 'ELLIOTTS ADERRIG 4' && r.seen) && s.issue.some(r => r.id === 'WO-26-1420'), j([s.sel, s.issue, need]));
      const sug = await p.evaluate(() => ltiRows().map(r => r.o.wo + ':' + r.lvl + ':' + (r.tid || '')));
      rec('13j the templates are still suggested for the new jobs (House 10 → Type 1L, House 20 → Type 2R)', sug.includes('WO-26-1410:strong:T1L') && sug.includes('WO-26-1420:strong:T2R'), j(sug));
      rec('13k the 4 templates are still listed under ELLIOTTS with the filter on', ids(s.home.filter(r => /^T/.test(r.id))) === 'T1L,T1R,T2L,T2R', ids(s.home));
      await pick(p, '~none'); s = await snap(p);
      rec('13l the brand-new customer with no project is under "No project"', s.issue.some(r => r.id === 'WO-26-9100' && r.proj === 'No project'), j(s.issue));
      rec('13m NOTE for Garry (not new — same on main): after Clear + re-import, a job that ALREADY had a list (WO-26-1412 / House 12, WO-26-2301 / Apt 1) is back in "lists to issue" — confirming it would make a SECOND list', true, 'needs a list again: ' + need.filter(w => ['WO-26-1412', 'WO-26-2301'].includes(w)).join() + ' | old lists now without a WO: ' + unlinked.join());
      await p.reload(); await p.waitForFunction(() => typeof lsLoad === 'function');
      await p.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_office', '9000'); setRole('office'); setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); render(); await new Promise(r => setTimeout(r, 80)); });
      await pick(p, 'P2'); await p.reload(); await p.waitForFunction(() => typeof lsLoad === 'function');
      await p.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_office', '9000'); setRole('office'); setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); render(); await new Promise(r => setTimeout(r, 80)); });
      s = await snap(p);
      rec('13n after the import and a reload the remembered filter still works (CAIRN: its imported jobs + its list)', s.sel === 'P2' && all(s.issue, r => r.proj === 'CAIRN PARKSIDE PH3') && s.issue.length >= 1 && ids(s.home) === 'LC1', j([s.sel, s.issue, ids(s.home)]));
      rec('13o no page errors through clear + import', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }
  } catch (e) { rec('test run crashed', false, e.stack || String(e)); }
  await browser.close();
  const bad = res.filter(x => !x).length;
  console.log(`\n${res.length - bad} passed, ${bad} failed`);
  if (fails.length) console.log('FAILED:\n - ' + fails.join('\n - '));
  process.exit(bad ? 1 : 0);
})();
