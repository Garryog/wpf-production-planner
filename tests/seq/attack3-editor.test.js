// Tester attack round 3 (Job B part 3, L1 / L3 / L4a / L1b): the cutting-list window's Floor / Unit / Title boxes, "Find the
// Cienapps WO", the P-number last resort, the purple chip, and lsParseGrid's Floor / Unit / WO cells. Fake Supabase only
// (tests/seq/srvs.js — never the network). Garry's rule: never a second record for one house; never guess.
// Run: node tests/seq/attack3-editor.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { jb: !!q('#me-jb'), ok: (q('#me-jbok') || {}).innerText || '', msg: (q('#me-jbm') || {}).innerText || '', wo: (q('#me-wo') || {}).value, pw: !!q('#me-ptitle'),
    picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick), err: (q('#me-err') || {}).textContent || '', open: !!q('#me-save') }; });
const fill = (p, f, u, t, wo) => p.evaluate(({ f, u, t, wo }) => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); };
  s('me-jf', f); s('me-ju', u); if (t != null) s('me-jt', t); if (wo != null) s('me-jwo', wo); }, { f, u, t, wo });
const click = async (p, id) => { await p.evaluate(id => document.getElementById(id).click(), id); await sleep(150); };
const asks = p => p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return window.__confirm !== undefined ? window.__confirm : true; }; });
const asked = p => p.evaluate(() => window.__asked || []);
const saveP = async (p, name, pw) => { await p.evaluate(({ name, pw }) => { const ov = document.querySelector('.me-ed'), s = (sel, v) => { const e = ov.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input')); };
  s('[data-mr="0|item"]', 'Tap'); s('[data-mr="0|qty"]', '2'); s('#me-name', name); Object.entries(pw || {}).forEach(([k, v]) => s('#me-p' + k, v)); if (!ov.querySelector('#me-pdue').value) s('#me-pdue', '2026-12-10');
  ov.querySelector('#me-save').click(); }, { name, pw }); await sleep(800); };
const pjobs = p => p.evaluate(() => DB.orders.filter(o => /^P-\d+$/.test(o.wo)).map(o => ({ wo: o.wo, floor: o.floor, unit: o.unit, title: o.title })));
const closeEd = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const addJob = (p, o) => p.evaluate(o => DB.orders.push(Object.assign({ customer: 'Aderrig Homes', dueDate: '2026-12-01', origDueDate: '2026-12-01', step: '1. NEW', hours: 1, value: 0, plannedWeek: '' }, o)), o);
const newEd = async p => { await closeEd(p); await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(200); };
// the P-number panel for floor / unit / title, the boxes' lookup found nothing first
const toP = async (p, f, u, t) => { await fill(p, f, u, t); await click(p, 'me-find'); const s = await st(p); if (!s.pw) await p.evaluate(() => { const b = document.getElementById('me-jmkp') || document.getElementById('me-jnone') || document.getElementById('me-new'); if (b) b.click(); }); await sleep(150); };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer();
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await asks(p);

    // ===== 1. the Save re-check reads the KIND from the title (seqKind): real Cienapps kitchen titles say "3 BED"
    await newEd(p);
    await toP(p, 'T09', '41', 'HOUSE TYPE B');
    rec('setup: P-number panel open for T09 / 41', (await st(p)).pw);
    await addJob(p, { wo: 'WO-41', floor: 'T09', unit: '41', title: 'UNIT 41 TYPE B 3 BED SEMI - KITCHEN' }); // Cienapps' kitchen arrives meanwhile
    await p.evaluate(() => { window.__confirm = false; });
    await saveP(p, 'House 41 kitchen');
    let pj = (await pjobs(p)).filter(x => x.unit === '41');
    rec('[HIGH] kitchen WO-41 "UNIT 41 TYPE B 3 BED SEMI - KITCHEN" arrived while the window was open: Save refuses the kitchen P-number', !pj.length, 'made ' + JSON.stringify(pj) + ' — seqKind reads "3 BED" as robes, so the re-check looks for a robes job');
    await closeEd(p);

    await newEd(p); await p.evaluate(() => { window.__confirm = true; });
    await toP(p, 'T09', '42', 'HOUSE TYPE B KITCHEN');
    await addJob(p, { wo: 'WO-42', floor: 'T09', unit: '42', title: 'HOUSE TYPE B KITCHEN & UTILITY' });
    await p.evaluate(() => { window.__confirm = false; });
    await saveP(p, 'House 42 kitchen');
    pj = (await pjobs(p)).filter(x => x.unit === '42');
    rec('[HIGH] WO-42 "KITCHEN & UTILITY" arrived meanwhile: a kitchen P-number for T09 / 42 is refused (or at least asked)', !pj.length || (await asked(p)).some(m => /WO-42/.test(m)), 'made ' + JSON.stringify(pj) + ' with no question — seqKind = utility');
    await closeEd(p);

    // ===== 2. the key in the editor: basement "-1" and placeholder "TBC" must never be filled by themselves
    await addJob(p, { wo: 'WO-60', floor: '-1', unit: '7', title: 'BASEMENT APT 7' });
    await newEd(p); await fill(p, '1', '7'); await click(p, 'me-find');
    let s = await st(p);
    rec('[HIGH] typed Floor 1 / Unit 7: the basement job WO-60 (floor "-1") is NOT filled in as "Matched"', !/Matched WO-60/.test(s.ok), s.ok);
    await addJob(p, { wo: 'WO-61', floor: 'T09', unit: 'TBC', title: 'HOUSE TYPE A' });
    await newEd(p); await fill(p, 'T09', 'TBC'); await click(p, 'me-find');
    s = await st(p);
    rec('[HIGH] typed Floor T09 / Unit TBC: WO-61 (unit "TBC") is NOT filled in by itself', !/Matched WO-61/.test(s.ok), s.ok);

    // ===== 3. a WO typed by hand: another project, or another house than the boxes say
    await newEd(p); await fill(p, '', '', '', 'WO-6'); await click(p, 'me-find'); // WO-6 is Lucan (P2); the window is on Aderrig (P1)
    s = await st(p);
    const pidNow = await p.evaluate(() => { const ov = document.querySelector('.me-ed'); const sel = ov && ov.querySelector('#me-proj,#me-pid,select[id*="proj"]'); return sel ? sel.value : ''; });
    rec('[MEDIUM] WO-6 (project Lucan) typed in an Aderrig list: warned / refused, not silently matched', !/Matched WO-6/.test(s.ok) || /Lucan|another project|other project/i.test(s.ok + s.msg + (await asked(p)).join(' ')), JSON.stringify({ ok: s.ok, pid: pidNow }));
    await newEd(p); await fill(p, 'T09', '40', '', 'WO-3'); await click(p, 'me-find'); // WO-3 is T09 / 13
    s = await st(p);
    rec('[MEDIUM] boxes say T09 / 40 but the typed WO-3 is T09 / 13: warned, not silently matched', !/Matched WO-3/.test(s.ok) || /13|not the same|differ/i.test((await asked(p)).join(' ')), s.ok);
    await closeEd(p);

    // ===== 4. "Not this one", then search again: never filled by itself again
    await addJob(p, { wo: 'WO-70', floor: 'T09', unit: '70', title: 'HOUSE TYPE Z' });
    await newEd(p); await fill(p, 'T09', '70'); await click(p, 'me-find');
    rec('T09 / 70 → Matched WO-70', /Matched WO-70/.test((await st(p)).ok));
    await click(p, 'me-jnot'); await click(p, 'me-find');
    s = await st(p);
    rec('Not this one, then Find again: offered in a pick list, not filled', !s.ok && s.picks.includes('WO-70'), JSON.stringify(s));
    await fill(p, 'T9', 'Apt 070'); await click(p, 'me-find');
    rec('…typed another way (T9 / Apt 070): still not filled by itself', !(await st(p)).ok, (await st(p)).ok);
    // unit blur (leaving the Unit box) runs the search
    await newEd(p);
    await p.evaluate(() => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }; s('me-jf', 'T09'); const u = document.getElementById('me-ju'); u.focus(); s('me-ju', '70'); document.getElementById('me-jt').focus(); });
    await sleep(300);
    rec('Unit box left (Tab to Title): searched, WO-70 matched', /Matched WO-70/.test((await st(p)).ok), (await st(p)).msg);
    await closeEd(p);

    // ===== 5. reply lost while saving a new list on a NEW P-number, Save pressed again: one P-number, one list
    await newEd(p); await p.evaluate(() => { window.__confirm = true; });
    await toP(p, 'T09', '80', 'HOUSE TYPE R');
    const before = (await pjobs(p)).length;
    S.dropReply = 1;
    await saveP(p, 'House 80');
    await sleep(800);
    s = await st(p);
    if (s.open) { await p.evaluate(() => document.querySelector('.me-ed #me-save').click()); await sleep(1000); }
    pj = (await pjobs(p)).filter(x => x.unit === '80');
    const l80 = S.db.t.lists.filter(l => l.name === 'House 80');
    rec('reply lost on a new list with a new P-number, Save again: ONE P-number, ONE list', pj.length === 1 && l80.length === 1 && (pj[0] && l80[0].wos + '' === pj[0].wo), JSON.stringify({ pj, lists: l80.map(l => l.wos), before }));
    await closeEd(p);

    // ===== 6. purple chip text is never stored
    await sleep(2500); // let the planner save
    const dump = JSON.stringify(S.row) + JSON.stringify(S.db.t);
    rec('"not from Cienapps" is never stored (planner record + every list / docket table)', !/not from Cienapps/.test(dump));
    await t.close();

    // ===== 7. two PCs make a P-number for the SAME house at the same moment
    const S2 = X.makeServer();
    const a = await X.dev(browser, S2, 'office'), b = await X.dev(browser, S2, 'office');
    for (const q of [a.page, b.page]) { await asks(q); await newEd(q); await toP(q, 'T09', '90', 'HOUSE TYPE K'); }
    await Promise.all([saveP(a.page, 'House 90 A'), saveP(b.page, 'House 90 B')]);
    await sleep(3000);
    for (const q of [a.page, b.page]) await q.evaluate(async () => { if (typeof saveDB === 'function') await saveDB(); });
    await sleep(2000);
    const both = (S2.row.orders || []).filter(o => /^P-\d+$/.test(o.wo) && o.unit === '90').map(o => o.wo);
    rec('[HIGH] two PCs, the same house (T09 / 90): ONE P-job in the planner, never two', both.length === 1, JSON.stringify(both) + ' — lists: ' + JSON.stringify(S2.db.t.lists.filter(l => /House 90/.test(l.name)).map(l => l.name + '→' + l.wos)));
    const l90 = S2.db.t.lists.filter(l => /House 90/.test(l.name) && !l.archived);
    const byWo = {}; l90.forEach(l => (l.wos || []).forEach(w => { byWo[w] = (byWo[w] || 0) + 1; }));
    rec('[HIGH] two PCs, the same house: never two LIVE cutting lists on one work order (the saw would cut it twice)', Object.values(byWo).every(n => n <= 1), JSON.stringify(byWo));
    rec('[HIGH] two PCs: a renumbered P-number keeps its cutting list (no P-job left with no list while its list sits on the other P)', both.every(w => l90.some(l => (l.wos || []).includes(w))), JSON.stringify({ both, lists: l90.map(l => l.name + '→' + l.wos) }));
    await a.close(); await b.close();

    // ===== 7b. two PCs make P-numbers for two DIFFERENT houses at the same moment: each list must stay on its own house's job
    const S5 = X.makeServer();
    const a5 = await X.dev(browser, S5, 'office'), b5 = await X.dev(browser, S5, 'office');
    await asks(a5.page); await asks(b5.page);
    await newEd(a5.page); await toP(a5.page, 'T09', '91', 'HOUSE TYPE K');
    await newEd(b5.page); await toP(b5.page, 'T09', '92', 'HOUSE TYPE M');
    await Promise.all([saveP(a5.page, 'House 91'), saveP(b5.page, 'House 92')]);
    await sleep(3000);
    for (const q of [a5.page, b5.page]) await q.evaluate(async () => { if (typeof saveDB === 'function') await saveDB(); });
    await sleep(2000);
    const jobs5 = (S5.row.orders || []).filter(o => /^P-\d+$/.test(o.wo)).map(o => ({ wo: o.wo, unit: o.unit }));
    const tag = n => ((S5.db.t.lists.find(l => l.name === n) || {}).wos || []).join();
    const unitOf = w => (jobs5.find(j => j.wo === w) || {}).unit;
    rec('[CRITICAL] two PCs, two houses (T09 / 91 and T09 / 92), P-numbers made at the same moment: each list is on its OWN house\'s job', unitOf(tag('House 91')) === '91' && unitOf(tag('House 92')) === '92',
      JSON.stringify({ jobs: jobs5, 'House 91': tag('House 91'), 'House 92': tag('House 92') }));
    await a5.close(); await b5.close();

    // ===== 8. phone (360 px): the job boxes fit
    const S3 = X.makeServer();
    const ph = await X.dev(browser, S3, 'office', { viewport: { width: 360, height: 740 } });
    await newEd(ph.page);
    const fit = await ph.page.evaluate(() => { const b = document.querySelector('#me-jb'); if (!b) return { none: true }; const r = b.getBoundingClientRect();
      const ins = [...b.querySelectorAll('input,button')].map(e => e.getBoundingClientRect()).filter(x => x.right > window.innerWidth + 1 || x.left < -1).length;
      return { right: r.right, w: window.innerWidth, out: ins, sw: document.documentElement.scrollWidth }; });
    rec('360 px phone: the Floor / Unit / Title / WO boxes and the Find button fit on the screen', !fit.none && fit.out === 0 && fit.right <= fit.w + 1 && fit.sw <= fit.w + 1, JSON.stringify(fit));
    await ph.close();

    // ===== 9. lsParseGrid: "Unit" / "Floor" / "WO" labels next to real parts
    const S4 = X.makeServer();
    const g = await X.dev(browser, S4, 'office'); const gp = g.page;
    const parse = aoa => gp.evaluate(aoa => { const r = lsParseGrid(aoa, {}); return { meta: r.meta, rows: r.rows.filter(x => x.k === 'part').map(x => x.item + '×' + x.qty) }; }, aoa);
    let r = await parse([['Project', 'Aderrig'], ['Floor', 'T09', 'Unit', '12', 'WO', 'WO-3'], ['Description', 'Qty', 'Length', 'Width', 'Material'], ['Side', 2, 720, 560, 'MFC White'], ['Unit', 2], ['Hinge', 8]]);
    rec('[MEDIUM] a Stores row "Unit | 2" in the parts is kept as a part', r.rows.includes('Unit×2'), JSON.stringify(r));
    rec('[HIGH] …and it does not change the job\'s Unit (12) — a wrong Unit finds the WRONG house\'s WO', r.meta.unit === '12', 'meta.unit = ' + r.meta.unit);
    r = await parse([['Project', 'Aderrig'], ['Floor', 'T09', 'Unit', '12'], ['Description', 'Qty', 'Length', 'Width', 'Material'], ['Side', 2, 720, 560, 'MFC White'], ['Floor', 1], ['Unit', 1, 720, 600, 'MFC']]);
    rec('[MEDIUM] a Stores row "Floor | 1" (e.g. floor tiles / floor plate) is kept as a part, meta floor stays T09', r.rows.includes('Floor×1') && r.meta.floor === 'T09', JSON.stringify(r));
    rec('a sized part called "Unit" (1 × 720 × 600) is still a part', r.rows.includes('Unit×1'), JSON.stringify(r));
    r = await parse([['Project:', 'Aderrig'], ['Title:', 'House 1'], ['Date:', '12/10/2026'], ['Carcass colour', 'White'], ['Door colour', 'Oak'], ['Nr of units', 2], ['Description', 'Qty', 'Length', 'Width', 'Material'], ['Side', 2, 720, 560, 'MFC White']]);
    rec('old template still reads (project, title, date, colours; no floor / unit / wo)', r.meta.project === 'Aderrig' && r.meta.title === 'House 1' && r.meta.date === '2026-10-12' && r.meta.carcass === 'White' && r.meta.door === 'Oak' && !r.meta.floor && !r.meta.unit && !r.meta.wo && r.rows.length === 1, JSON.stringify(r));
    r = await parse([['Floor:', 'Ground floor'], ['Unit:', 'Apt 7'], ['Works order no.', 'WO-3']]);
    rec('labels with colons / "Works order no." read', r.meta.floor === 'Ground floor' && r.meta.unit === 'Apt 7' && r.meta.wo === 'WO-3', JSON.stringify(r.meta));
    await g.close();

    // ===== 10. lists switched OFF: the old window, no job boxes, no lookups
    const S0 = X.makeServer(X.v1Row());
    const o0 = await X.dev(browser, S0, 'office');
    const off = await o0.page.evaluate(() => { try { openListEditor(null, '', 'P1'); } catch (e) { return 'err ' + e.message; } return { jb: !!document.querySelector('#me-jb'), find: !!document.querySelector('#me-find') }; });
    rec('switch off: no Floor / Unit / Title boxes, no Find button', off && !off.jb && !off.find, JSON.stringify(off));
    rec('no page errors', !(S.errors || []).length && !(S2.errors || []).length && !(S0.errors || []).length, JSON.stringify([S.errors, S2.errors, S0.errors]).slice(0, 400));
    await o0.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
