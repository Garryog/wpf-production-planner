// Tester attack 9 (11 Nov 2026) on feature/project-details-v2 (0632203) — S1 (steps 9/10/11 by hand on the Capacity Board),
// S2 (Shipped tab Project / PM filters, PM 📦 Shipped tab) and the Part 1 spec carry-over (several specs, retire races) + a quick
// check that the sequence / requests screens still work next to it.
//  T1  hand-set 9, then Cienapps catches up at 9: the hand marker and the Export Changes line go; hand 10 vs import 9 holds;
//      Bring back to board puts the hours back in the week total; a stale second PC edits the job after it was shipped by hand.
//  T2  S2: a PM with no project assigned (PM filter defaults to him); a remembered PM filter for someone no longer listed; 360 px.
//  T3  specs: two PCs retire the two specs at the same moment; red chip with three specs; sequence + requests pages still open.
// Findings: [HIGH] / [MEDIUM] / [LOW] in the check name, steps / expected / actual in the comment. Fake Supabase only.
// Run: node tests/seq/attack9-ship-spec.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
const flush = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = async p => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(300); };
const pick = (p, wo, v) => p.evaluate(({ wo, v }) => { window.confirm = () => true; const s = document.querySelector('[data-stepsel="' + wo + '"]'); if (!s) return 'no select'; s.value = v; s.onchange(); return 'ok'; }, { wo, v });
const job = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o && { step: o.step, sh: !!o.shippedAt, hand: o.stepHand || null, wk: o.plannedWeek, chg: changes().some(c => c.wo === wo) }; }, wo);

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ============================================================================================================ T1
    console.log('\n--- T1 S1 steps by hand');
    {
      const row = X.v2Row();
      const g = w => row.orders.find(o => o.wo === w);
      Object.assign(g('WO-3'), { step: '8. PALLETED', plannedWeek: '2026-11-23', hours: 10, value: 5000 });
      Object.assign(g('WO-6'), { step: '8. PALLETED', plannedWeek: '2026-11-23', hours: 6, value: 3000 });
      const S = X.makeServer(row);
      const a = await X.dev(browser, S, 'office'), p = a.page;
      const b = await X.dev(browser, S, 'office'); // a second PC, opened now, not refreshed later
      await p.evaluate(() => showTab('b')); await sleep(200);
      const h0 = await p.evaluate(() => wkHrs('2026-11-23'));
      await pick(p, 'WO-3', '9. JOB SHIPPED'); await sleep(200);
      await H.importAoa(p, [HDR, ['WO-3', 'HOUSE TYPE C', 'Aderrig Homes', 46359, '9. JOB SHIPPED', 5000]]); await p.evaluate(() => applyImport(IMPPLAN)); await sleep(300);
      let j = await job(p, 'WO-3');
      rec('T1a hand-set 9, then Cienapps at 9 too: still shipped, the "(set by hand)" marker cleared, off Export Changes', j.step === '9. JOB SHIPPED' && j.sh && !j.hand && !j.chg, JSON.stringify(j));
      await p.evaluate(() => showTab('b')); await sleep(150);
      await pick(p, 'WO-6', '10. INSTALLED TO BE INVOICE'); await sleep(200);
      await H.importAoa(p, [HDR, ['WO-6', 'TYPE A KITCHEN', 'Lucan Homes', 46359, '9. JOB SHIPPED', 3000]]); await p.evaluate(() => applyImport(IMPPLAN)); await sleep(300);
      j = await job(p, 'WO-6');
      rec('T1b hand-set 10, Cienapps at 9: the planner\'s 10 holds (steps only move forward) and stays on Export Changes', j.step === '10. INSTALLED TO BE INVOICE' && j.sh && j.chg, JSON.stringify(j));
      const h1 = await p.evaluate(() => wkHrs('2026-11-23'));
      rec('T1c both off the week total (16 h less)', h0 - h1 === 16, h0 + ' → ' + h1);
      await flush(p);
      // the stale PC B still shows WO-6 at 8 on its board, and changes its week there (a drag on the board = plannedWeek)
      const be = await b.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-6'); const was = o.step; o.plannedWeek = '2026-11-30'; logEdit(o, 'Week moved', 'Bob'); sched(); clearTimeout(saveT); await saveDB(); return was; });
      await sleep(500); await reload(p);
      j = await job(p, 'WO-6');
      // [MEDIUM if it fails] Steps: PC A sets WO-6 to 10 by hand; PC B (not refreshed, WO-6 still at 8 on its board) moves its week and saves.
      // Expected: WO-6 stays shipped / at 10 (B only changed the week). Actual if it fails: B's old copy puts it back on the board.
      rec('T1d a stale PC moves the week of a job just set to 10 by hand: it stays shipped at 10', be === '8. PALLETED' && j.step === '10. INSTALLED TO BE INVOICE' && j.sh, JSON.stringify({ be, j }));
      // Bring back to board → hours back
      await p.evaluate(() => showTab('h')); await sleep(200);
      const bb = await p.evaluate(() => { const btn = [...document.querySelectorAll('button')].find(x => /Bring back to board/.test(x.textContent) && (x.closest('.sh-card') || {}).innerText && /WO-3/.test(x.closest('.sh-card').innerText)); if (!btn) return 'no button'; window.confirm = () => true; window.prompt = () => 'Wrong job'; btn.click(); return 'ok'; });
      await sleep(400);
      j = await job(p, 'WO-3'); const h2 = await p.evaluate(() => wkHrs('2026-11-23'));
      // WO-3 was set to 9 by hand but Cienapps then said 9 too (T1a cleared the hand marker): Bring back has no "step before" to go to
      rec('T1e [info] Bring back to board on WO-3 (9 confirmed by Cienapps): what happens', true, JSON.stringify({ bb, j, h2 }));
      rec('T1 no job removed, no page errors', (await p.evaluate(() => DB.orders.length)) === row.orders.length && !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close(); await b.close();
    }

    // ============================================================================================================ T2
    console.log('\n--- T2 S2 filters');
    {
      const staff = X.STAFF.concat([{ id: 'S9', n: 'Pat New', r: ['pm'] }]);
      const row = X.v2Row({ staff });
      const sh = '2026-10-19T10:00:00Z';
      row.orders.find(o => o.wo === 'WO-6').shippedAt = sh; row.orders.find(o => o.wo === 'WO-3').shippedAt = sh;
      const S = X.makeServer(row);
      D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
      // P2 has NO PM
      const shown = p => p.evaluate(() => [...document.querySelectorAll('.sh-card .wo-num')].map(e => e.textContent).sort());
      const t = await X.dev(browser, S, 'pm', { me: { pm: 'Pat New' }, viewport: { width: 360, height: 740 } }), p = t.page;
      await p.evaluate(() => { localStorage.removeItem('wpfShPM'); localStorage.removeItem('wpfShProj'); const b = document.querySelector('[data-pmtab="ship"]'); if (b) b.click(); }); await sleep(300);
      const s = await shown(p), sel = await p.evaluate(() => { const e = document.getElementById('sh-pm'); return e ? e.value + ' / ' + (e.options[e.selectedIndex] || {}).textContent : 'no PM filter'; });
      const body = await p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' ').slice(0, 400));
      // [LOW] Steps: a PM with no project assigned yet (Pat New) opens 📦 Shipped on his phone. The page even says "No projects assigned to
      // you yet — showing all", and elsewhere a PM with no projects sees everything (pmFilterOn). Expected: every shipped job (WO-3, WO-6).
      // Actual: the PM filter starts on "PM: Pat New", so the list is EMPTY right under "showing all".
      rec('T2a [LOW] PM with no project assigned: the Shipped tab shows every shipped job (as "showing all" says), not an empty list filtered to him', s.length >= 2, JSON.stringify({ s, sel, body }));
      // a remembered filter for a PM who is no longer on the list
      await p.evaluate(() => { localStorage.setItem('wpfShPM', 'Old Gone PM'); render(); }); await sleep(300);
      const s2 = await shown(p), sel2 = await p.evaluate(() => { const e = document.getElementById('sh-pm'); return e ? { v: e.value, t: (e.options[e.selectedIndex] || {}).textContent } : null; });
      // [LOW] Expected: the drop-down shows what is applied (either "Old Gone PM" or it falls back to all and shows the jobs). Actual if it
      // fails: the drop-down shows "all" while the list is filtered to a name that is not there → empty, no way to see why.
      rec('T2b [LOW] remembered PM filter for a name no longer listed: the drop-down and the list agree', sel2 && ((sel2.v === 'Old Gone PM') || (s2.length >= 2)), JSON.stringify({ s2, sel2 }));
      const ns = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      rec('T2c 360 px: no sideways scroll on the PM Shipped tab', ns.sw <= ns.cw + 1, JSON.stringify(ns));
      // project with no PM: "none assigned" picks it
      await p.evaluate(() => { localStorage.setItem('wpfShPM', '*'); render(); }); await sleep(200);
      const opts = await p.evaluate(() => [...(document.getElementById('sh-pm') || { options: [] }).options].map(o => o.value));
      const noneV = opts.find(v => /none|^-$|^$/.test(v));
      if (noneV !== undefined) { await p.evaluate(v => { const e = document.getElementById('sh-pm'); e.value = v; e.onchange(); }, noneV); await sleep(200); }
      const s3 = await shown(p);
      rec('T2d PM filter "none assigned": Lucan (no PM) job WO-6 shows, Aderrig\'s WO-3 does not', noneV !== undefined && s3.includes('WO-6') && !s3.includes('WO-3'), JSON.stringify({ opts, s3 }));
      rec('T2 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await t.close();
    }

    // ============================================================================================================ T3
    console.log('\n--- T3 specs + sequence / requests next to the carry-over');
    {
      const S = X.makeServer();
      D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
      const DP = X.DP;
      // three specs on P1 (inserted as another PC would)
      const add = (id, name, type) => S.db.t.project_specs.push({ id, project_id: 'P1', name, spec_type: type, sort: S.db.t.project_specs.length + 1, active: true, version: 1, updated_at: '2026-10-20T08:00:00Z', updated_by: 'Seed' });
      add('SPK', 'Kitchens', 'kitchens'); add('SPR', 'Robes', 'robes'); add('SPU', 'Utility', 'kitchens');
      X.seqRow(S, 'QA', 'P1', { wo: 'WO-3', floor: 'T09', unit: '13' });
      const a = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), b = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
      const chip = await a.page.evaluate(() => { const o = specOpen('P1'); return { n: o.length, specs: [...new Set(o.map(x => x.split(':')[0]))].sort() }; });
      rec('T3a red chip with three specs counts all three (spec name in front)', chip.specs.join() === 'Kitchens,Robes,Utility', JSON.stringify(chip));
      // two PCs retire two different specs, then a third retire from A leaves one → the last can't go
      const ret = async (p, name) => p.evaluate(async name => { window.confirm = () => true; window.prompt = () => 'John Burke'; lsSpecDlg('P1'); await new Promise(r => setTimeout(r, 300));
        const t = [...document.querySelectorAll('[data-sptab]')].find(x => x.textContent.trim().startsWith(name)); if (!t) return 'no tab ' + name; t.click(); await new Promise(r => setTimeout(r, 150));
        const r = document.getElementById('sp-ret'); if (!r) return 'no button'; r.click(); await new Promise(r => setTimeout(r, 800)); const m = (document.getElementById('sp-msg') || {}).textContent || ''; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); return 'ok ' + m; }, name);
      // both PCs open the dialog showing three specs, retire Robes (A) and Utility (B) at once — 1 left, allowed
      const [ra, rb] = await Promise.all([ret(a.page, 'Robes'), ret(b.page, 'Utility')]);
      // now both still think 2 are in use: A retires Kitchens while B retires … Kitchens too (last one)
      const [rc, rd] = await Promise.all([ret(a.page, 'Kitchens'), ret(b.page, 'Kitchens')]);
      const act = S.db.t.project_specs.filter(s => s.active !== false).map(s => s.name);
      rec('T3b two PCs retiring specs at the same moment never leave a project with no spec in use', act.length >= 1, JSON.stringify({ act, ra, rb, rc, rd }));
      rec('T3c … and the PC that was refused is told in plain words ("keeps at least one spec")', act.length !== 1 || [rc, rd].some(x => /at least one spec/.test(x)), JSON.stringify({ rc, rd }));
      // the sequence + requests pages still work next to the spec code
      await a.page.evaluate(() => { pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); await sleep(300);
      const sq = await a.page.evaluate(() => ({ rows: document.querySelectorAll('[data-seqtick]').length, chip: !!document.querySelector('#app') }));
      rec('T3d PM sequence page still opens with its rows next to the spec carry-over', sq.rows === 1, JSON.stringify(sq));
      const pr = await X.dev(browser, S, 'prod');
      const rq = await pr.page.evaluate(async () => { prodTab = 'req'; render(); await new Promise(r => setTimeout(r, 300)); return { req: !!document.querySelector('[data-prodtab="req"]'), txt: (document.getElementById('app').innerText || '').slice(0, 120) }; });
      rec('T3e Production Manager ✋ Requests tab still opens', rq.req && /Requests|request/i.test(rq.txt), JSON.stringify(rq));
      rec('T3 no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
      await a.close(); await b.close(); await pr.close();
    }
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
