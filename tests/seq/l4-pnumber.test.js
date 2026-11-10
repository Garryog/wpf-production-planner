// L4a (Job B part 3, step 4): a P-number only as the last resort. No WO found → plain message + [Make a P-number instead…],
// made only after a confirm; ＋ New P-number looks first; the lookup runs again on Save (a job that arrived meanwhile is
// used instead); a second P-number for the same house + kind is refused ("P-1001 already exists — use it"); new P-jobs keep
// their project (pid); P-numbers show purple "not from Cienapps" on list surfaces (lists home, Find old list, saw / stores,
// prints, dockets) — never with the lists switched off. Fake Supabase only. Run: node tests/seq/l4-pnumber.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { jb: !!q('#me-jb'), ok: (q('#me-jbok') || {}).innerText || '', msg: (q('#me-jbm') || {}).innerText || '', wo: (q('#me-wo') || {}).value, pw: !!q('#me-ptitle'), mkp: !!q('#me-jmkp'), none: !!q('#me-jnone'),
    picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick), err: (q('#me-err') || {}).textContent || '', open: !!q('#me-save') }; });
const fill = (p, f, u, t) => p.evaluate(({ f, u, t }) => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); };
  s('me-jf', f); s('me-ju', u); if (t != null) s('me-jt', t); }, { f, u, t });
const click = async (p, id) => { await p.evaluate(id => document.getElementById(id).click(), id); await sleep(150); };
const asks = p => p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return window.__confirm !== undefined ? window.__confirm : true; }; });
const asked = p => p.evaluate(() => window.__asked || []);
// one Stores row + the list name + the P-number's due date, then Save
const saveP = async (p, name, pw) => { await p.evaluate(({ name, pw }) => { const ov = document.querySelector('.me-ed'), s = (sel, v) => { const e = ov.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input')); };
  s('[data-mr="0|item"]', 'Tap'); s('[data-mr="0|qty"]', '2'); s('#me-name', name); Object.entries(pw || {}).forEach(([k, v]) => s('#me-p' + k, v)); if (!ov.querySelector('#me-pdue').value) s('#me-pdue', '2026-12-10');
  ov.querySelector('#me-save').click(); }, { name, pw }); await sleep(700); };
const pjobs = p => p.evaluate(() => DB.orders.filter(o => /^P-\d+$/.test(o.wo)).map(o => ({ wo: o.wo, pid: o.pid || '', floor: o.floor, unit: o.unit, title: o.title })));
const closeEd = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer();
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await asks(p);
    // ---- none found → plain message + Make a P-number instead… (confirm first)
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await fill(p, 'T09', '40', 'HOUSE TYPE Q'); await click(p, 'me-find');
    let s = await st(p);
    rec('T09 / 40: "No Cienapps work order found" + [Make a P-number instead…]', /No Cienapps work order found for Floor T09 · Unit 40 on Aderrig/.test(s.msg) && s.mkp && !s.pw, JSON.stringify(s));
    await p.evaluate(() => { window.__confirm = false; }); await click(p, 'me-jmkp');
    s = await st(p);
    rec('Cancel on the confirm: no P-number panel', !s.pw && /No Cienapps work order was found for Floor T09 · Unit 40[\s\S]*Make a new planner P-number instead\?/.test((await asked(p)).pop()), JSON.stringify(s));
    await p.evaluate(() => { window.__confirm = true; }); await click(p, 'me-jmkp');
    s = await st(p);
    rec('OK: the P-number panel, Floor / Unit / Title from the boxes', s.pw && await p.evaluate(() => document.getElementById('me-pfloor').value === 'T09' && document.getElementById('me-punit').value === '40' && document.getElementById('me-ptitle').value === 'HOUSE TYPE Q'), JSON.stringify(s));
    await saveP(p, 'House 40');
    let pj = await pjobs(p);
    rec('saved: P-1001 made, with the project (pid P1), floor T09, unit 40', pj.length === 1 && pj[0].wo === 'P-1001' && pj[0].pid === 'P1' && pj[0].floor === 'T09' && pj[0].unit === '40' && !(await st(p)).open, JSON.stringify(pj));
    rec('the list is tagged P-1001', (S.db.t.lists.find(l => l.name === 'House 40') || {}).wos + '' === 'P-1001');

    // ---- ＋ New P-number looks first: a house with jobs → pick list, no P panel, no confirm
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await p.evaluate(() => { window.__asked = []; });
    await fill(p, 'T09', '13'); await click(p, 'me-new');
    s = await st(p);
    rec('＋ New P-number on T09 / 13: no P-number — "already has work orders … pick one", WO-3 / WO-4 offered', !s.pw && JSON.stringify(s.picks) === '["WO-3","WO-4"]' && /already has work orders that could be this house/.test(s.msg) && !(await asked(p)).length, JSON.stringify(s));
    await click(p, 'me-jnone');
    rec('None of these → confirm → P-number panel', (await st(p)).pw && /You picked none of the work orders found for Floor T09 · Unit 13/.test((await asked(p)).pop()));
    // the same house + kind on Save: WO-3 is HOUSE TYPE C (kitchen) → refused, offered
    await p.evaluate(() => { window.__confirm = false; });
    await saveP(p, 'House 13 extra', { title: 'HOUSE TYPE C' });
    s = await st(p); pj = await pjobs(p);
    rec('Save a kitchen P-number for T09 / 13: refused — "WO-3 from Cienapps is in the planner … use it"', s.open && /Not saved — WO-3 from Cienapps is in the planner for Floor T09 · Unit 13 \(kitchen\) — use it/.test(s.err) && pj.length === 1, JSON.stringify([s.err, pj]));
    await p.evaluate(() => { window.__confirm = true; }); await p.evaluate(() => document.querySelector('.me-ed #me-save').click()); await sleep(300);
    s = await st(p);
    rec('…OK = use WO-3 for this list (no P-number made)', s.wo === 'WO-3' && !s.pw && /Matched WO-3/.test(s.ok) && (await pjobs(p)).length === 1, JSON.stringify(s));
    await closeEd(p);

    // ---- a second P-number for the same house + kind is refused
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await fill(p, 'Block T9', 'Apt 040'); await click(p, 'me-find');
    s = await st(p);
    rec('Block T9 / Apt 040 finds P-1001 (P-jobs are planner jobs too); it has a list → "Open it instead?"', /P-1001 already has a cutting list: "House 40"/.test((await asked(p)).pop() || ''), JSON.stringify(s));
    await closeEd(p);
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await p.evaluate(() => { window.__confirm = true; }); await click(p, 'me-new'); // boxes blank: no lookup possible — asked, warned
    rec('＋ New P-number with blank boxes: the confirm warns it can\'t be matched later', /No Floor and Unit typed/.test((await asked(p)).pop()) && (await st(p)).pw);
    await p.evaluate(() => { window.__confirm = false; });
    await saveP(p, 'House 40 again', { title: 'HOUSE TYPE Q', floor: 'Block T9', unit: 'Apt 040' });
    s = await st(p); pj = await pjobs(p);
    rec('second kitchen P-number for the same house: refused "P-1001 already exists for … — use it"', /Not saved — P-1001 already exists for Floor Block T9 · Unit Apt 040 \(kitchen\) — use it/.test(s.err) && pj.length === 1, JSON.stringify([s.err, pj]));
    // another kind in the same house is fine (utility)
    await p.evaluate(() => { window.__confirm = true; });
    await saveP(p, 'House 40 utility', { title: 'HOUSE TYPE Q UTILITY', floor: 'T09', unit: '40' });
    pj = await pjobs(p);
    rec('a UTILITY P-number in the same house is allowed (P-1002, pid P1)', pj.length === 2 && pj[1].wo === 'P-1002' && pj[1].pid === 'P1', JSON.stringify(pj));

    // ---- the lookup runs again on Save: a Cienapps job that arrived while the window was open is used instead
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await fill(p, 'T09', '41', 'HOUSE TYPE R'); await click(p, 'me-find'); await click(p, 'me-jmkp');
    await p.evaluate(() => { DB.orders.push({ wo: 'WO-50', customer: 'Aderrig Homes', floor: 'T9', unit: '041', title: 'HOUSE TYPE R', dueDate: '2026-12-01', origDueDate: '2026-12-01', step: '1. NEW', hours: 1, value: 0, plannedWeek: '' }); window.__confirm = false; });
    await saveP(p, 'House 41');
    s = await st(p);
    rec('WO-50 arrived meanwhile (T9 / 041): Save refused, "WO-50 from Cienapps … use it", no P-number', /WO-50 from Cienapps is in the planner/.test(s.err) && (await pjobs(p)).length === 2, s.err);
    // a "not sure" job (G vs 0) on Save → asked, Cancel = nothing made
    await closeEd(p);
    await p.evaluate(() => { DB.orders.push({ wo: 'WO-51', customer: 'Aderrig Homes', floor: 'G', unit: '9', title: 'HOUSE TYPE S', dueDate: '2026-12-01', origDueDate: '2026-12-01', step: '1. NEW', hours: 1, value: 0, plannedWeek: '' }); });
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    await p.evaluate(() => { window.__confirm = true; }); await click(p, 'me-new');
    await p.evaluate(() => { window.__confirm = false; });
    await saveP(p, 'House 9', { title: 'HOUSE TYPE S', floor: '0', unit: '9' });
    rec('Save with a "not sure" job (WO-51 on floor G vs 0): asked "might be the same house", Cancel = nothing made', /might be the same house[\s\S]*WO-51/.test((await asked(p)).pop()) && (await pjobs(p)).length === 2);
    await closeEd(p);

    // ---- purple "not from Cienapps" on list surfaces
    await p.evaluate(() => { showTab('l'); render(); }); await sleep(300);
    const home = await p.evaluate(() => [...document.querySelectorAll('.lst-chip')].filter(c => /P-1001|WO-1\b/.test(c.textContent)).map(c => c.className + '|' + c.textContent.trim()));
    rec('lists home: P-1001 purple "P-1001 · not from Cienapps"; WO-1 plain', home.some(x => x === 'lst-chip p-wo|P-1001 · not from Cienapps') && home.some(x => x === 'lst-chip|WO-1'), JSON.stringify(home));
    await p.evaluate(() => lsFindDlg('P1')); await sleep(200);
    rec('Find old list: P-1001 purple', await p.evaluate(() => [...document.querySelectorAll('#fo-body .lst-chip.p-wo')].some(c => /P-1001 · not from Cienapps/.test(c.textContent))));
    await closeEd(p);
    rec('prints / dockets text: "P-1001 (not from Cienapps), WO-1"', await p.evaluate(() => woPTxt('P-1001, WO-1') === 'P-1001 (not from Cienapps), WO-1' && woPTxt('') === ''));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
    // the saw sees the chip too (a list on P-1001 that the saw has)
    X.F3.seedList(S, 'LP', { wos: ['P-1001'], name: 'House 40 saw' });
    { const w1 = S.row.orders.find(o => o.wo === 'WO-1'), pp = S.row.orders.find(o => o.wo === 'P-1001'); pp.dueDate = w1.dueDate; pp.plannedWeek = w1.plannedWeek; } // in this week's saw work
    const sw = await X.dev(browser, S, 'saw');
    const saw = await sw.page.evaluate(() => [...document.querySelectorAll('.lst-chip')].map(c => c.className + '|' + c.textContent.trim()));
    rec('saw screen: P-1001 purple "P-1001 · not from Cienapps"', saw.some(x => x === 'lst-chip p-wo|P-1001 · not from Cienapps'), JSON.stringify(saw).slice(0, 300));
    await sw.close();
    // ---- lists switched off: nothing purple
    const S0 = X.makeServer(X.v1Row());
    const o0 = await X.dev(browser, S0, 'office');
    rec('switch off: a P-number is plain (woIsP false, no p-wo chip)', await o0.page.evaluate(() => !woIsP('P-1001') && woChip('P-1001') === '<span class="lst-chip">P-1001</span>' && woPTxt('P-1001') === 'P-1001'));
    await o0.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
