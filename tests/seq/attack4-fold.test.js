// Tester attack round 4 (Coder round 2, 641b56b): P-numbers made on two PCs at once — the renumber, the same-house FOLD-IN
// (pMineFix), the fresh database check before a P is made (pFreshDup), and the typed-WO ask. Fake Supabase only (srvs.js).
// Project rule: never delete production data; one house = one job; one live list per WO for the saw.
// Run: node tests/seq/attack4-fold.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { ok: (q('#me-jbok') || {}).innerText || '', msg: (q('#me-jbm') || {}).innerText || '', pw: !!q('#me-ptitle'), err: (q('#me-err') || {}).textContent || '', open: !!q('#me-save') }; });
const fill = (p, f, u, t, wo) => p.evaluate(({ f, u, t, wo }) => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); };
  s('me-jf', f); s('me-ju', u); if (t != null) s('me-jt', t); if (wo != null) s('me-jwo', wo); }, { f, u, t, wo });
const click = async (p, id) => { await p.evaluate(id => document.getElementById(id).click(), id); await sleep(150); };
const asks = (p, v) => p.evaluate(v => { window.__asked = []; window.__confirm = v; window.confirm = m => { window.__asked.push(m); return window.__confirm; }; }, v === undefined ? true : v);
const asked = p => p.evaluate(() => window.__asked || []);
const fillP = (p, name) => p.evaluate(name => { const ov = document.querySelector('.me-ed'), s = (sel, v) => { const e = ov.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input')); };
  s('[data-mr="0|item"]', 'Tap'); s('[data-mr="0|qty"]', '2'); s('#me-name', name); if (!ov.querySelector('#me-pdue').value) s('#me-pdue', '2026-12-10'); }, name);
const pressSave = p => p.evaluate(() => document.querySelector('.me-ed #me-save').click());
const newEd = async p => { await p.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); openListEditor(null, '', 'P1'); }); await sleep(200); };
const toP = async (p, f, u, t) => { await fill(p, f, u, t); await click(p, 'me-find'); if (!(await st(p)).pw) await p.evaluate(() => { const b = document.getElementById('me-jmkp') || document.getElementById('me-jnone') || document.getElementById('me-new'); if (b) b.click(); }); await sleep(150); };
// hold every list-table / rpc call of ONE page (the planner record still goes through): "its list hasn't landed yet"
async function holdLists(t) { let rel; const h = { p: new Promise(r => { rel = r; }), on: true, release: () => { h.on = false; rel(); } };
  await t.page.route('**/*', async route => { const u = route.request().url(); if (h.on && u.includes('supabase.co') && !u.includes('production_planner')) await h.p; return route.fallback(); }); return h; }
const liveOn = (S, wo) => S.db.t.lists.filter(l => !l.archived && !l.is_template && (l.wos || []).includes(wo)).map(l => l.name);
const P = (o, x) => Object.assign({ customer: 'Aderrig Homes', pid: 'P1', floor: 'T09', dueDate: '2026-12-10', origDueDate: '2026-12-10', step: 'Planner WO', hours: 4, value: 0, plannedWeek: '', notes: '', log: [{ at: '2026-10-21T09:00:00Z', by: 'Op', what: 'Work order created with a typed cutting list' }] }, o, x || {});

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ===== 1. same house on two PCs; the OTHER screen's list has not reached the database when the fold-in runs
    {
      const S = X.makeServer();
      const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'office');
      await asks(a.page); await asks(b.page);
      await newEd(a.page); await toP(a.page, 'T09', '95', 'HOUSE TYPE K'); await fillP(a.page, 'House 95 A');
      await newEd(b.page); await toP(b.page, 'T09', '95', 'HOUSE TYPE K'); await fillP(b.page, 'House 95 B');
      const hb = await holdLists(b);
      await pressSave(b.page); await sleep(600);                // B: fresh check passes, P-1001 made, its list save is stuck
      await pressSave(a.page); await sleep(300);                // A: fresh check passes too (B's job isn't in the database yet), A's P-1001 + list land
      await b.page.evaluate(async () => { await saveDB(); });   // B's planner record lands first (any save: the 45 s sync, another edit)
      await sleep(5000);                                        // A's save merges: renumber → fold-in
      hb.release(); await sleep(3000);
      await a.page.evaluate(async () => { await saveDB(); }); await b.page.evaluate(async () => { await saveDB(); }); await sleep(1500);
      const jobs = (S.row.orders || []).filter(o => o.unit === '95').map(o => o.wo);
      const lists = S.db.t.lists.filter(l => /House 95/.test(l.name)).map(l => l.name + '→' + l.wos + (l.archived ? ' (archived)' : ''));
      rec('[HIGH] other screen\'s list still on its way during the fold-in: never two LIVE lists on one WO', jobs.every(w => liveOn(S, w).length <= 1), JSON.stringify({ jobs, lists }));
      rec('…one job for the house', jobs.length === 1, JSON.stringify(jobs));
      await a.close(); await b.close();
    }

    // ===== 2. the fold-in confirm CANCELLED (the other list is there): both kept, each list on its own job, nothing lost
    {
      const S = X.makeServer();
      const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'office');
      await asks(a.page, true); await asks(b.page, true);
      await newEd(a.page); await toP(a.page, 'T09', '96', 'HOUSE TYPE K'); await fillP(a.page, 'House 96 A');
      await newEd(b.page); await toP(b.page, 'T09', '96', 'HOUSE TYPE K'); await fillP(b.page, 'House 96 B');
      await a.page.evaluate(() => { window.__confirm = false; }); await b.page.evaluate(() => { window.__confirm = false; });
      await Promise.all([pressSave(a.page), pressSave(b.page)]);
      await sleep(6000);
      for (const q of [a.page, b.page]) await q.evaluate(async () => { await saveDB(); }); await sleep(2000);
      const jobs = (S.row.orders || []).filter(o => o.unit === '96').map(o => ({ wo: o.wo, log: (o.log || []).map(x => x.what).join(' | ') }));
      const tags = S.db.t.lists.filter(l => /House 96/.test(l.name)).map(l => ({ n: l.name, wos: l.wos, arch: !!l.archived }));
      const asks2 = (await asked(a.page)).concat(await asked(b.page));
      rec('fold-in Cancel: nothing archived, every list on a job that exists, never two live lists on one WO',
        tags.every(t => !t.arch && t.wos.length === 1 && jobs.some(j => j.wo === t.wos[0])) && jobs.every(j => liveOn(S, j.wo).length <= 1), JSON.stringify({ jobs, tags, asked: asks2.map(m => m.slice(0, 80)) }));
      await a.close(); await b.close();
    }

    // ===== 3. reload between the renumber and the list being moved: the list must still follow its job after the reload
    {
      const row = X.v2Row(); row.orders.push(P({ wo: 'P-1001', unit: '91', title: 'HOUSE TYPE K' }), P({ wo: 'P-1002', unit: '92', title: 'HOUSE TYPE M',
        log: [{ at: '2026-10-21T09:00:00Z', by: 'Op', what: 'Work order created with a typed cutting list' }, { at: '2026-10-21T09:00:05Z', by: '(auto-merge)', what: 'Renumbered P-1001 → P-1002 — another screen created P-1001 at the same moment' }] }));
      const S = X.makeServer(row);
      X.F3.seedList(S, 'LB91', { wos: ['P-1001'], name: 'House 91 (other PC)' });
      X.F3.seedList(S, 'LA92', { wos: ['P-1001'], name: 'House 92 (mine)' }); // my list: still on the old number when the page was reloaded
      const a = await X.dev(browser, S, 'office');
      await a.page.evaluate(() => { localStorage.setItem('wpfPMine', JSON.stringify({ 'P-1001': { lists: ['LA92'], at: Date.now(), to: 'P-1002' } })); });
      await a.page.reload(); await a.page.waitForFunction(() => typeof analyzeImport === 'function'); await sleep(6000);
      const tag = (S.db.t.lists.find(l => l.id === 'LA92') || {}).wos;
      rec('[HIGH] reloaded after the renumber, before my list moved: my list (house 92) ends up on P-1002, not on the other house\'s P-1001', JSON.stringify(tag) === '["P-1002"]', 'House 92 list is on ' + JSON.stringify(tag) + ' — pMineFix is not run at start-up');
      await a.close();
    }

    // ===== 4. the fold-in REMOVES our P-job. It must never remove a job with history, dates, a van booking, or lists / lines
    //          another PC has put on it. (The PMINE note lives 3 days; the fold-in runs whenever it next gets the chance.)
    const foldCase = async (label, extra, otherList, dupJob) => {
      const row = X.v2Row(); row.orders.push(dupJob || P({ wo: 'P-1001', unit: '93', title: 'HOUSE TYPE K' }),
        P({ wo: 'P-1002', unit: '93', title: 'HOUSE TYPE K' }, extra));
      const S = X.makeServer(row);
      X.F3.seedList(S, 'LA93', { wos: ['P-1001'], name: 'House 93 (mine)' });
      if (otherList) X.F3.seedList(S, 'LO93', { wos: ['P-1002'], name: 'House 93 extra (other PC)' });
      const a = await X.dev(browser, S, 'office'); await asks(a.page, true);
      await a.page.evaluate(async () => { PMINE['P-1001'] = { lists: ['LA93'], at: Date.now(), to: 'P-1002' }; pMineSave(); await pMineFix(); });
      await sleep(1500); await a.page.evaluate(async () => { await saveDB(); }); await sleep(1500);
      const kept = (S.row.orders || []).find(o => o.wo === 'P-1002');
      rec(label, !!kept, kept ? 'kept' : 'P-1002 REMOVED from the planner record — ' + JSON.stringify(extra || {}).slice(0, 160) + (otherList ? ' · list "House 93 extra (other PC)" left on ' + JSON.stringify((S.db.t.lists.find(l => l.id === 'LO93') || {}).wos) + ' (a job that no longer exists)' : ''));
      await a.close();
    };
    await foldCase('[CRITICAL] fold-in never removes a P-job booked on a van (delivery booking)', { delv: true, delVeh: 'Van 1', delDay: '2026-11-05', delWk: '2026-11-02' });
    await foldCase('[CRITICAL] fold-in never removes a P-job whose dates / week were set since (history in its log)', { plannedWeek: '2026-11-09', dueDate: '2026-11-20', log: [{ at: '2026-10-21T09:00:00Z', by: 'Op', what: 'Work order created with a typed cutting list' }, { at: '2026-10-22T10:00:00Z', by: 'Mary', what: 'Week moved 2026-11-02 → 2026-11-09' }, { at: '2026-10-22T10:01:00Z', by: 'Mary', what: 'Notes: customer wants it early' }], notes: 'customer wants it early' });
    await foldCase('[CRITICAL] fold-in never removes a P-job another PC has put its own cutting list (with lines) on', {}, true);
    await foldCase('[HIGH] fold-in never removes a P-job just because a CIENAPPS WO for the same house arrived (that is the L4b merge, with its rules)', { plannedWeek: '2026-11-09' }, false,
      { wo: 'WO-93', customer: 'Aderrig Homes', floor: 'T09', unit: '93', title: 'HOUSE TYPE K KITCHEN', dueDate: '2026-12-01', origDueDate: '2026-12-01', step: '1. NEW', hours: 1, value: 0, plannedWeek: '' });

    // ===== 5. the fresh database check while OFFLINE: P-number still made — is the person told the check could not be made?
    {
      const S = X.makeServer();
      const a = await X.dev(browser, S, 'office'); await asks(a.page, true);
      await newEd(a.page); await toP(a.page, 'T09', '97', 'HOUSE TYPE K'); await fillP(a.page, 'House 97');
      S.offline = true; await pressSave(a.page); await sleep(1500);
      const s = await st(a.page), pj = await a.page.evaluate(() => DB.orders.filter(o => o.unit === '97').map(o => o.wo));
      rec('[LOW] offline: the person is told the planner could not check the database for this house', /(house|P-number|work order)[^.]*(could not|couldn.t|not) (be )?check|check[^.]*(house|work order)[^.]*(could not|failed|offline)/i.test(s.err + ' ' + (await asked(a.page)).join(' ')), JSON.stringify({ err: s.err, pj }));
      S.offline = false;
      // another PC makes this house's job meanwhile; this PC presses Save again once online
      S.row.orders.push(P({ wo: 'P-1050', unit: '97', title: 'HOUSE TYPE K' })); S.row.version = (+S.row.version || 1) + 1;
      if ((await st(a.page)).open) { await pressSave(a.page); await sleep(2000); }
      await a.page.evaluate(async () => { await saveDB(); }); await sleep(4000);
      const jobs = (S.row.orders || []).filter(o => o.unit === '97').map(o => o.wo);
      rec('[MEDIUM] back online, Save again after another PC made the house\'s job: still ONE job for the house (the database check runs again)', jobs.length === 1, JSON.stringify({ jobs, lists: S.db.t.lists.filter(l => l.name === 'House 97').map(l => l.wos) }));
      await a.close();
    }

    // ===== 6. typed WO: asked when it is another project / another house; Cancel = not used; OK = used
    {
      const S = X.makeServer();
      const a = await X.dev(browser, S, 'office'); await asks(a.page, false);
      await newEd(a.page); await fill(a.page, '', '', '', 'WO-6'); await click(a.page, 'me-find');
      let s = await st(a.page);
      rec('typed WO-6 (Lucan) in an Aderrig list, Cancel: not used, message says why', !s.ok && /WO-6 not used/.test(s.msg) && /Lucan/.test((await asked(a.page)).pop() || ''), JSON.stringify(s));
      await a.page.evaluate(() => { window.__confirm = true; }); await click(a.page, 'me-find');
      s = await st(a.page);
      rec('…OK: used, and the list stays on the project the person picked? (project shown)', /Matched WO-6/.test(s.ok), s.ok);
      await newEd(a.page); await a.page.evaluate(() => { window.__confirm = false; window.__asked = []; });
      await fill(a.page, 'T9', 'Apt 013', '', 'WO-3'); await click(a.page, 'me-find'); // the same house typed another way: no question
      rec('typed WO-3 with boxes T9 / Apt 013 (the same house): no question, matched', /Matched WO-3/.test((await st(a.page)).ok) && !(await asked(a.page)).length, JSON.stringify(await asked(a.page)));
      await newEd(a.page); await a.page.evaluate(() => { window.__confirm = false; window.__asked = []; });
      await fill(a.page, 'G', '13', '', 'WO-3'); await click(a.page, 'me-find'); // "G" vs T09: different floor
      rec('typed WO-3 with boxes G / 13: asked (floor differs)', (await asked(a.page)).length === 1 && !(await st(a.page)).ok, JSON.stringify(await asked(a.page)));
      await newEd(a.page); await a.page.evaluate(() => { window.__confirm = false; window.__asked = []; });
      await fill(a.page, 'T09', '', '', 'WO-3'); await click(a.page, 'me-find'); // unit blank: can't tell — no question needed
      rec('typed WO-3 with Unit blank: matched without a question (nothing to disagree with)', /Matched WO-3/.test((await st(a.page)).ok), JSON.stringify(await asked(a.page)));
      await a.page.evaluate(() => DB.orders.push({ wo: 'WO-99', customer: 'Nobody Ltd', floor: 'T09', unit: '13', title: 'HOUSE TYPE C', dueDate: '2026-12-01', origDueDate: '2026-12-01', step: '1. NEW', hours: 1, value: 0, plannedWeek: '' }));
      await newEd(a.page); await a.page.evaluate(() => { window.__confirm = false; window.__asked = []; });
      await fill(a.page, '', '', '', 'WO-99'); await click(a.page, 'me-find');
      rec('typed WO-99 whose customer is linked to no project: asked', /not linked to any project/.test((await asked(a.page)).join(' ')), JSON.stringify(await asked(a.page)));
      rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await a.close();
    }
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
