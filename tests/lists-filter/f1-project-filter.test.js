// Cutting Lists page — Project filter + project always visible (Garry, 11 Nov). Fake Supabase only.
// Covers: the filter narrows every section (to issue, lists needed, waiting on material, lists, templates) for the Office,
// the Drawing office and the Production Manager; remembered after a reload; a remembered project that no longer exists
// falls back to All; the project on every row at 1280 and 360 px; 60 projects; a list with no project; the lists switch
// OFF is unchanged; HTML in a project name is shown as text.
// Run: node tests/lists-filter/f1-project-filter.test.js
const X = require('./fixl.js');
const { F, D } = X;
const res = []; const rec = (n, ok, d) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const j = JSON.stringify;
// what is on the page now
const snap = p => p.evaluate(() => {
  const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const tagOf = e => { const t = e.querySelector('[data-lpfp]'); return t ? txt(t).replace('🏗 ', '') : null; };
  const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && r.left >= -1 && r.right <= innerWidth + 1; };
  const rows = sel => [...document.querySelectorAll(sel)].map(e => ({ id: e.getAttribute('data-ltirow') || e.getAttribute('data-ltiwc') || e.getAttribute('data-lhrow') || e.getAttribute('data-nrow') || txt(e.querySelector('b')), proj: tagOf(e), seen: vis(e.querySelector('[data-lpfp]')) }));
  const s = document.getElementById('lh-proj');
  return { bar: !!document.getElementById('lpf'), sel: s ? s.value : null, opts: s ? [...s.options].map(o => o.textContent) : [], n: txt(document.getElementById('lpf-n')), x: !!document.getElementById('lpf-x'), of: txt(document.getElementById('lti-of')),
    issue: rows('[data-ltirow]'), wc: rows('[data-ltiwc]'), need: rows('[data-nrow]'), holds: rows('.hold-grp .wl-drow'), home: rows('[data-lhrow]'),
    grp: [...document.querySelectorAll('.lh-grp>div:first-child b')].map(txt), side: document.documentElement.scrollWidth - innerWidth, tags: document.querySelectorAll('[data-lpfp]').length };
});
const pick = (p, v) => p.evaluate(async v => { const s = document.getElementById('lh-proj'); s.value = v; s.onchange(); await new Promise(r => setTimeout(r, 60)); }, v);
const all = (a, f) => a.length > 0 && a.every(f);
const ids = a => a.map(r => r.id).sort().join();

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    // ---------- Office, 1280 px
    {
      const S = X.server();
      const t = await F.dev(browser, S, 'office', { viewport: { width: 1280, height: 900 } }), p = t.page;
      await p.evaluate(() => { setWho('Ann'); showTab('l'); lstAttachOpen = 'x'; render(); }); // 'x' keeps the "more ways to attach" table open
      let s = await snap(p);
      rec('A1 office: the Project filter is at the top of the Cutting Lists page, on "All projects"', s.bar && s.sel === '' && !s.x, j({ sel: s.sel, n: s.n }));
      rec('A2 the drop-down lists every project with something on the page A–Z with counts, then "No project", then projects with nothing yet', j(s.opts) === j(['All projects (21)', 'CAIRN PARKSIDE PH3 (5)', 'DURKAN HANSFIELD (1)', 'ELLIOTTS ADERRIG 4 (9)', 'GLENVEAGH CITYWEST (3)', 'TORCA OAKLANDS (1)', 'No project (2)', 'BALLYMORE SEAMOUNT']), j(s.opts));
      rec('A3 All projects: "14 of 14 shown" (6 lists + 8 jobs that need a list)', /^14 of 14 shown$/.test(s.n), s.n);
      rec('A4 All: every section shows every project (8 to issue, 1 waiting for check, 8 needed, 2 waiting on material, 6 lists)', s.issue.length === 8 && s.wc.length === 1 && s.need.length === 8 && s.holds.length === 2 && s.home.length === 6, j([s.issue.length, s.wc.length, s.need.length, s.holds.length, s.home.length]));
      rec('A5 All: the project is on EVERY row of every section, in view', all([...s.issue, ...s.wc, ...s.need, ...s.holds, ...s.home], r => r.proj && r.seen), j([...s.issue, ...s.wc, ...s.need, ...s.holds, ...s.home].filter(r => !r.proj || !r.seen)));
      rec('A6 a job whose customer is linked to no project, and a list with no project, say "No project"', (s.issue.find(r => r.id === 'WO-26-9001') || {}).proj === 'No project' && (s.home.find(r => r.id === 'LNP') || {}).proj === 'No project', j([s.issue.find(r => r.id === 'WO-26-9001'), s.home.find(r => r.id === 'LNP')]));

      await pick(p, 'P1'); s = await snap(p);
      const P1 = 'ELLIOTTS ADERRIG 4';
      rec('B1 pick ELLIOTTS ADERRIG 4: lists to issue shows only its 3 jobs', ids(s.issue) === 'WO-26-1410,WO-26-1411,WO-26-1416' && all(s.issue, r => r.proj === P1), j(s.issue));
      rec('B2 … waiting for check: only its list', ids(s.wc) === 'L14' && s.wc[0].proj === P1, j(s.wc));
      rec('B3 … lists needed (more ways to attach): only its 3 jobs', ids(s.need) === 'WO-26-1410,WO-26-1411,WO-26-1416' && all(s.need, r => r.proj === P1), j(s.need));
      rec('B4 … waiting on material: only its row', s.holds.length === 1 && s.holds[0].proj === P1, j(s.holds));
      rec('B5 … lists: only its 2 lists, one project group', ids(s.home) === 'L12,L14' && j(s.grp) === j([P1]), j([s.home, s.grp]));
      rec('B6 "5 of 14 shown", the project named, the to-issue heading says "of 9", and a ✕ All projects button', /Only ELLIOTTS ADERRIG 4 — 5 of 14 shown/.test(s.n) && s.x && /of 9 — only ELLIOTTS ADERRIG 4/.test(s.of), j([s.n, s.of, s.x]));
      rec('B7 "Confirm all green" only confirms the jobs on screen', await p.evaluate(() => ltiRows().every(r => r.o.customer === 'ELLIOTTS ADERRIG 4') && ltiRows().length === 3));
      rec('B8 the count on the Lists tab still counts every project', await p.evaluate(() => { updDelBadge(); return document.getElementById('listcnt').textContent; }) === '9');

      // templates
      await p.evaluate(async () => { const k = document.getElementById('lh-kind'); k.value = 'tpl'; k.onchange(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
      rec('C1 Templates + the project picked: only its 4 templates, each showing the project', ids(s.home) === 'T1L,T1R,T2L,T2R' && all(s.home, r => r.proj === P1 && r.seen), j(s.home));
      await pick(p, ''); s = await snap(p);
      rec('C2 Templates + All projects: all 7 templates, each showing its own project', s.home.length === 7 && all(s.home, r => r.proj && r.seen) && (s.home.find(r => r.id === 'TCA') || {}).proj === 'CAIRN PARKSIDE PH3', j(s.home));
      await p.evaluate(async () => { const k = document.getElementById('lh-kind'); k.value = 'live'; k.onchange(); await new Promise(r => setTimeout(r, 60)); });

      // other projects / no project / nothing yet
      await pick(p, 'P2'); s = await snap(p);
      rec('D1 CAIRN PARKSIDE PH3: 2 to issue, 2 needed, 1 on hold, 1 list', ids(s.issue) === 'WO-26-2302,WO-26-2303' && s.need.length === 2 && s.holds.length === 1 && ids(s.home) === 'LC1' && s.wc.length === 0, j(s));
      await pick(p, '~none'); s = await snap(p);
      rec('D2 "No project": the unlinked job and the loose list only', ids(s.issue) === 'WO-26-9001' && ids(s.home) === 'LNP' && s.holds.length === 0 && /Only No project — 2 of 14 shown/.test(s.n), j([s.issue, s.home, s.n]));
      await pick(p, 'P6'); s = await snap(p);
      rec('D3 a project with nothing yet: every section empty, "0 of 14 shown", its (empty) group is still there to add to', s.issue.length === 0 && s.home.length === 0 && s.holds.length === 0 && /0 of 14 shown/.test(s.n) && j(s.grp) === j(['BALLYMORE SEAMOUNT']), j([s.n, s.grp]));
      rec('D4 …and + New template / + New list use that project', await p.evaluate(() => lhPid() === 'P6'));

      // the search box, the other filters, ✕ All projects
      await pick(p, 'P1'); await p.evaluate(async () => { const q = document.getElementById('lh-q'); q.value = 'house 14'; q.oninput(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
      rec('E1 the search box works together with the project: "House 14" → 1 list, "4 of 9 shown"', ids(s.home) === 'L14' && /4 of 9 shown/.test(s.n), j([s.home, s.n]));
      await p.evaluate(async () => { const q = document.getElementById('lh-q'); q.value = ''; q.oninput(); await new Promise(r => setTimeout(r, 60)); });
      await p.evaluate(async () => { document.getElementById('lpf-x').click(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
      rec('E2 ✕ All projects: back to everything, nothing remembered', s.sel === '' && s.home.length === 6 && s.issue.length === 8 && await p.evaluate(() => (localStorage.getItem('wpfListProj') || '') === ''), j([s.sel, s.home.length]));

      // remembered after a reload — and only on the Cutting Lists page
      await pick(p, 'P3');
      rec('F1 the pick is kept on this device', await p.evaluate(() => localStorage.getItem('wpfListProj')) === 'P3');
      await p.reload(); await p.waitForFunction(() => typeof lsLoad === 'function');
      await p.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_office', '9000'); setRole('office'); setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); render(); await new Promise(r => setTimeout(r, 80)); });
      s = await snap(p);
      rec('F2 after a reload the page opens on GLENVEAGH CITYWEST again (1 to issue, 1 list)', s.sel === 'P3' && ids(s.issue) === 'WO-26-3106' && ids(s.home) === 'LG5' && s.x, j([s.sel, s.issue, s.home]));
      const imp = await p.evaluate(async () => { showTab('i'); const el = document.getElementById('iprev'); el.innerHTML = listsToIssueHTML(); const n = document.querySelectorAll('#iprev [data-ltirow]').length; showTab('b'); return { n, need: listsNeeded().length, board: document.querySelectorAll('[data-lpfp]').length }; });
      rec('F3 the filter never hides anything on other pages: the Import page panel still shows all 8 jobs', imp.n === 8 && imp.need === 8, j(imp));
      // the remembered project is gone → All projects
      await p.evaluate(async () => { localStorage.setItem('wpfListProj', 'P-GONE'); LH.proj = 'P-GONE'; showTab('l'); render(); await new Promise(r => setTimeout(r, 60)); });
      s = await snap(p);
      rec('G1 a remembered project that no longer exists falls back to All projects (and is forgotten)', s.sel === '' && s.home.length === 6 && s.issue.length === 8 && !s.x && await p.evaluate(() => (localStorage.getItem('wpfListProj') || '') === ''), j([s.sel, s.home.length, s.issue.length]));
      await pick(p, '~none'); D.find(S.db, 'lists', 'LNP').project_id = 'P4'; D.find(S.db, 'lists', 'LNP').updated_at = new Date().toISOString();
      await p.evaluate(async () => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-26-9001'); lsReset(); await lsLoad(); render(); await new Promise(r => setTimeout(r, 60)); });
      s = await snap(p);
      rec('G2 remembered "No project" when nothing is without a project any more → All projects', s.sel === '' && s.home.length === 6 && !s.opts.some(o => /^No project/.test(o)), j([s.sel, s.opts]));
      rec('A7 no page errors (office)', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // ---------- Drawing office + Production Manager (the same page), and the office at 360 px
    for (const [role, w] of [['design', 1280], ['prod', 1280], ['design', 360], ['prod', 360], ['office', 360]]) {
      const S = X.server();
      const t = await F.dev(browser, S, role, { viewport: { width: w, height: 800 } }), p = t.page;
      await p.evaluate(role => { if (role === 'prod') prodTab = 'lists'; if (role === 'office') { setWho('Ann'); showTab('l'); } LH.kind = 'all'; render(); }, role);
      let s = await snap(p); const tag = role + ' ' + w + ' px: ';
      const every = s => [...s.issue, ...s.wc, ...s.need, ...s.holds, ...s.home];
      rec(tag + 'the filter is there; All shows 8 to issue, 2 on hold, 13 lists + templates', s.bar && s.issue.length === 8 && s.holds.length === 2 && s.home.length === 13, j([s.bar, s.issue.length, s.holds.length, s.home.length]));
      rec(tag + 'the project is in plain view on every row (lists, templates, to issue, waiting for check, on hold)', all(every(s), r => r.proj && r.seen), j(every(s).filter(r => !r.proj || !r.seen)));
      rec(tag + 'no sideways scroll', s.side <= 1, String(s.side));
      await pick(p, 'P1'); s = await snap(p);
      rec(tag + 'ELLIOTTS ADERRIG 4 picked → 3 to issue, 1 waiting for check, 1 on hold, 2 lists + 4 templates, all showing the project', s.issue.length === 3 && s.wc.length === 1 && s.holds.length === 1 && ids(s.home) === 'L12,L14,T1L,T1R,T2L,T2R' && all(every(s), r => r.proj === 'ELLIOTTS ADERRIG 4' && r.seen), j([s.issue.length, s.wc.length, s.holds.length, ids(s.home)]));
      rec(tag + 'no sideways scroll with the filter on', s.side <= 1, String(s.side));
      if (role === 'office') { await p.evaluate(async () => { document.querySelector('details.lti-other').open = true; await new Promise(r => setTimeout(r, 50)); }); s = await snap(p);
        rec(tag + 'lists needed table opened: the project on every row, in view, no sideways scroll', all(s.need, r => r.proj === 'ELLIOTTS ADERRIG 4' && r.seen) && s.side <= 1, j([s.need, s.side])); }
      rec(tag + 'no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // ---------- 60 projects
    {
      const extra = []; for (let i = 1; i <= 54; i++) extra.push(['X' + i, 'SCHEME ' + String(i).padStart(2, '0') + ' ' + ['OAK', 'ASH', 'ELM'][i % 3] + ' PARK', 'Builder ' + i]);
      const S = X.server({ projects: extra });
      extra.forEach(([id], i) => { if (i % 2 === 0) F.seedList(S, 'LX' + id, { name: 'House ' + (i + 1), wos: [], list: { project_id: id } }); });
      for (const w of [1280, 360]) {
        const t = await F.dev(browser, S, 'design', { viewport: { width: w, height: 800 } }), p = t.page;
        let s = await snap(p);
        const named = s.opts.slice(1).filter(o => /\(\d+\)$/.test(o) && !/^No project/.test(o)).map(o => o.replace(/ \(\d+\)$/, ''));
        rec('H1 ' + w + ' px, 60 projects: all 60 are in the drop-down; the ones with lists are A–Z with counts', s.opts.length === 62 && named.length === 32 && j(named) === j([...named].sort((a, b) => a.localeCompare(b))), j([s.opts.length, named.length]));
        rec('H2 ' + w + ' px, 60 projects: a "type to find a project" box appears, and no sideways scroll', await p.evaluate(() => !!document.getElementById('lpf-q') && document.querySelectorAll('#lpf-dl option').length === 60) && s.side <= 1, String(s.side));
        await p.evaluate(async () => { const q = document.getElementById('lpf-q'); q.value = 'scheme 07'; q.onchange(); await new Promise(r => setTimeout(r, 60)); }); s = await snap(p);
        rec('H3 ' + w + ' px: typing "scheme 07" jumps to that project (1 list)', s.sel === 'X7' && s.home.length === 1 && s.home[0].proj === 'SCHEME 07 ASH PARK' && s.home[0].seen, j([s.sel, s.home]));
        await p.evaluate(async () => { const q = document.getElementById('lpf-q'); q.value = 'scheme'; q.onchange(); await new Promise(r => setTimeout(r, 60)); });
        rec('H4 ' + w + ' px: typing something that fits many projects changes nothing', (await snap(p)).sel === 'X7');
        const ms = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 5; i++) render(); return (performance.now() - t0) / 5; });
        rec('H5 ' + w + ' px: the page still draws quickly with 60 projects (under 400 ms)', ms < 400, Math.round(ms) + ' ms');
        await t.page.context().close();
      }
    }

    // ---------- HTML in a project name is text, never markup
    {
      const evil = '<img src=x onerror="window.__pwn=1"><b>BAD</b> & "Sons"';
      const S = X.server({ evil });
      S.row.orders.push(X.H.order({ wo: 'WO-26-6001', customer: 'BALLYMORE SEAMOUNT', unit: '1', title: 'HOUSE 1 KITCHEN', step: '5. WORK ORDER PROCESSED', dueDate: '2026-11-20', origDueDate: '2026-11-20' }));
      F.seedList(S, 'LE1', { name: 'House 9', wos: [], list: { project_id: 'P6' }, lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', '', { status: 'waiting', status_at: '2026-10-20T10:00:00Z', status_by: 'Tom' }]] });
      F.seedList(S, 'TE1', { name: 'Type <i>Z</i>', wos: [], list: { project_id: 'P6', is_template: true, type_name: 'Type <i>Z</i>' } });
      const t = await F.dev(browser, S, 'office', { viewport: { width: 1280, height: 900 } }), p = t.page;
      await p.evaluate(() => { setWho('Ann'); showTab('l'); LH.kind = 'all'; lstAttachOpen = 'x'; render(); });
      await pick(p, 'P6'); const s = await snap(p);
      const inj = await p.evaluate(() => ({ pwn: window.__pwn || 0, img: document.querySelectorAll('#app img[src="x"]').length, b: [...document.querySelectorAll('#app b')].filter(b => b.textContent === 'BAD').length, i: [...document.querySelectorAll('#app i')].filter(b => b.textContent === 'Z').length }));
      rec('I1 a project called <img onerror…><b>BAD</b> is shown as plain text in the drop-down, the count line, the heading and on every row', inj.pwn === 0 && inj.img === 0 && inj.b === 0 && inj.i === 0 && s.opts.some(o => o.startsWith(evil)) && s.n.includes(evil) && s.of.includes(evil) && all([...s.issue, ...s.need, ...s.holds, ...s.home], r => r.proj === evil), j([inj, s.n]));
      rec('I2 …and the filter still narrows to it (1 to issue, 1 on hold, 1 list + 1 template)', s.issue.length === 1 && s.holds.length === 1 && ids(s.home) === 'LE1,TE1', j([s.issue.length, s.holds.length, ids(s.home)]));
      rec('I3 no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }

    // ---------- lists switch OFF: the page is exactly as before
    {
      const S = X.server({ off: true });
      S.row.orders.push(X.H.order({ wo: 'WO-26-7001', customer: 'ELLIOTTS ADERRIG 4', unit: '30', title: 'HOUSE 30', dueDate: '2026-10-23', origDueDate: '2026-10-23' }), X.H.order({ wo: 'WO-26-7002', customer: 'SOMEONE ELSE LTD', unit: '31', title: 'HOUSE 31', dueDate: '2026-10-23', origDueDate: '2026-10-23' }));
      const t = await X.F.open(browser, S, { now: F.NOW, role: 'office', viewport: { width: 1280, height: 900 } }), p = t.page;
      await p.evaluate(() => { localStorage.setItem('wpfListProj', 'P1'); LH.proj = 'P1'; setWho('Ann'); showTab('l'); lstAttachOpen = 'x'; render(); });
      const o = await p.evaluate(() => ({ bar: !!document.getElementById('lpf'), sel: !!document.getElementById('lh-proj'), tags: document.querySelectorAll('[data-lpfp]').length, th: [...document.querySelectorAll('.lst-tbl')[0].querySelectorAll('th')].map(x => x.textContent).join('|'),
        need: document.querySelectorAll('[data-nrow]').length, needAll: listsNeeded().length, lib: !!document.getElementById('lst-filter'), cust: !!document.getElementById('lst-custf'), lti: !!document.querySelector('.lti-host'), lists: lists().length }));
      rec('J1 switch OFF: no Project filter, no project tags, the old library and its own filters are there', !o.bar && !o.sel && o.tags === 0 && o.lib && o.cust && !o.lti, j(o));
      rec('J2 switch OFF: a remembered project hides nothing — every needed job is listed, the heading still says "Customer"', o.need === o.needAll && o.need > 0 && /\|Customer\|/.test(o.th), j(o));
      rec('J3 switch OFF: no page errors', !(S.errors || []).length, j(S.errors));
      await t.page.context().close();
    }
  } catch (e) { rec('test run crashed', false, e.stack || String(e)); }
  await browser.close();
  const bad = res.filter(x => !x).length;
  console.log(`\n${res.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
