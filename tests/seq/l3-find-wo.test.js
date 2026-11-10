// L1 + L3 (Job B part 3, step 3): a new cutting list with no WO gets Floor | Unit | Title boxes and "🔎 Find the Cienapps WO"
// (also when the Unit box is left). The planner's LIVE jobs are looked up by project + floor + unit with the B0 key: one
// certain → filled, green "Matched …" [Not this one]; several / not sure → a short pick list; blank floor or unit → no search;
// a WO that already has a live list → "Open it instead?"; a WO typed by hand must exist. Lists switched off: as today.
// Fake Supabase only. Run: node tests/seq/l3-find-wo.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
function row() {
  const r = X.v2Row();
  r.orders.push(
    H.order({ wo: 'WO-7', customer: 'Aderrig Homes', floor: 'Block T09', unit: 'Apt 022', title: 'HOUSE TYPE B', dueDate: '2026-12-01', origDueDate: '2026-12-01' }),
    H.order({ wo: 'WO-8', customer: 'Aderrig Homes', floor: 'G', unit: '5', title: 'HOUSE TYPE A', dueDate: '2026-12-01', origDueDate: '2026-12-01' }),
    H.order({ wo: 'WO-9', customer: 'Aderrig Homes', floor: 'L1', unit: '7', title: 'APT TYPE 2', dueDate: '2026-12-01', origDueDate: '2026-12-01' }),
    H.order({ wo: 'WO-10', customer: 'Aderrig Homes', floor: '1', unit: '7', title: 'APT TYPE 3', dueDate: '2026-12-01', origDueDate: '2026-12-01' }),
    H.order({ wo: 'WO-11', customer: 'Nobody Ltd', floor: 'T20', unit: '3', title: 'SOMEONE ELSE', dueDate: '2026-12-01', origDueDate: '2026-12-01' }),
    H.order({ wo: 'WO-13', customer: 'Aderrig Homes', floor: 'T09', unit: '16', title: 'SHIPPED', dueDate: '2026-10-01', origDueDate: '2026-10-01', shippedAt: '2026-10-10T10:00:00Z' }),
    H.order({ wo: 'WO-12', customer: 'Aderrig Homes', floor: 'T09', unit: '15', title: 'DELIVERED', dueDate: '2026-10-01', origDueDate: '2026-10-01', delDone: true }));
  r.orders.find(o => o.wo === 'WO-4').title = 'HOUSE TYPE C UTILITY <img src=x onerror="window.__x=1">';
  return r;
}
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { jb: !!q('#me-jb'), ok: (q('#me-jbok') || {}).innerText || '', msg: (q('#me-jbm') || {}).innerText || '', wo: (q('#me-wo') || {}).value, name: (q('#me-name') || {}).value,
    picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick), img: !!document.querySelector('.me-ed #me-jbm img'), open: !!document.querySelector('.me-ed') }; });
const fill = (p, f, u, wo) => p.evaluate(({ f, u, wo }) => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); };
  s('me-jf', f); s('me-ju', u); if (wo != null) s('me-jwo', wo); }, { f, u, wo });
const find = async p => { await p.evaluate(() => document.getElementById('me-find').click()); await sleep(150); };
const closeEd = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---- lists switched off: the old editor, no job boxes
    const S0 = X.makeServer(X.v1Row());
    const o0 = await X.dev(browser, S0, 'office');
    rec('switch off: the old editor has no Floor / Unit / Title boxes', await o0.page.evaluate(() => { openListEditor(null, ''); return !document.getElementById('me-jb') && !document.getElementById('me-jf'); }));
    await o0.close();

    const S = X.makeServer(row());
    const t = await X.dev(browser, S, 'office'), p = t.page;
    // a new list from a job: as today, no job boxes
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(150);
    let s = await st(p);
    rec('new list from a job (WO-2): no job boxes, WO set', !s.jb && s.wo === 'WO-2', JSON.stringify(s)); await closeEd(p);
    // a new list with no WO
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(150);
    s = await st(p);
    rec('new list, no WO: Floor | Unit | Title | WO number boxes and Find', s.jb && await p.evaluate(() => ['me-jf', 'me-ju', 'me-jt', 'me-jwo', 'me-find'].every(id => !!document.getElementById(id))) && /Type the Floor and the Unit/.test(s.msg), JSON.stringify(s));
    // blank unit: no search
    await p.evaluate(() => { window.__kj = 0; const k = window.keyJobs; window.keyJobs = () => { window.__kj++; return k(); }; });
    await fill(p, 'T09', ''); await find(p); s = await st(p);
    rec('blank unit: "both needed — no search was made", nothing filled, no job keys worked out', /both needed/.test(s.msg) && !s.wo && await p.evaluate(() => window.__kj === 0), JSON.stringify(s));
    // T9 / 12 → WO-7 (Block T09 / Apt 012) found when leaving the Unit box
    await fill(p, 't9', '22');
    await p.evaluate(() => { const u = document.getElementById('me-ju'); u.focus(); document.getElementById('me-jt').focus(); }); await sleep(250);
    s = await st(p);
    rec('leaving the Unit box: T9 / 22 finds WO-7 (Block T09 / Apt 022) — filled, green "Matched"', s.wo === 'WO-7' && /Matched WO-7/.test(s.ok) && /Floor Block T09/.test(s.ok) && /Unit Apt 022/.test(s.ok) && /HOUSE TYPE B/.test(s.ok) && !s.jb, JSON.stringify(s));
    rec('the job keys were worked out once for that search', await p.evaluate(() => window.__kj === 1), await p.evaluate(() => window.__kj));
    rec('list name NOT pre-filled from the job (Garry 10 Nov: a free name; blank = the WO number)', s.name === '', s.name); // was: filled with the unit "Apt 022" — changed by Part 4
    rec('B2 job-info boxes show for the matched WO', await p.evaluate(() => (document.querySelector('#me-woinfo [data-woe="floor"]') || {}).value === 'Block T09'));
    // Not this one → boxes back; Find again offers WO-7 in a list, never fills it again by itself
    await p.evaluate(() => document.getElementById('me-jnot').click()); await sleep(150);
    s = await st(p);
    rec('Not this one: WO cleared, boxes back with what was typed', !s.wo && s.jb && await p.evaluate(() => document.getElementById('me-jf').value === 't9' && document.getElementById('me-ju').value === '22'), JSON.stringify(s));
    await find(p); s = await st(p);
    rec('Find again: WO-7 offered to pick, not filled', !s.wo && JSON.stringify(s.picks) === '["WO-7"]', JSON.stringify(s));
    // T9 / 12 vs WO-1 on GF / 12: a block vs a level → not sure (never filled)
    await fill(p, 'T9', '12'); await find(p); s = await st(p);
    rec('T9 / 12 vs WO-1 (GF / 12): block vs level → offered as not sure, never filled', !s.wo && JSON.stringify(s.picks) === '["WO-1"]' && /not sure: floor T-9 or 0/.test(s.msg), JSON.stringify(s));
    // two WOs in one house → pick list; names escaped
    await fill(p, 'T09', '13'); await find(p); s = await st(p);
    rec('T09 / 13: two work orders (kitchen + utility) → pick list, both "same house"', JSON.stringify(s.picks) === '["WO-3","WO-4"]' && /2 work orders could be this house/.test(s.msg), JSON.stringify(s));
    rec('job titles escaped in the pick list', !s.img && await p.evaluate(() => window.__x === undefined) && /<img/.test(s.msg), s.msg);
    await p.evaluate(() => document.querySelector('[data-jpick="WO-4"]').click()); await sleep(150);
    s = await st(p);
    rec('picked WO-4: filled, Matched', s.wo === 'WO-4' && /Matched WO-4/.test(s.ok), JSON.stringify(s));
    await p.evaluate(() => document.getElementById('me-jnot').click()); await sleep(100);
    // G vs 0: not sure → listed with the reason
    await fill(p, '0', '5'); await find(p); s = await st(p);
    rec('0 / 5 vs a job on floor "G": not sure → offered with the reason, not filled', !s.wo && JSON.stringify(s.picks) === '["WO-8"]' && /not sure: floor/.test(s.msg), JSON.stringify(s));
    // 1 / 7: WO-10 same, WO-9 (L1) not sure → pick list, same first
    await fill(p, 'First floor', 'No. 7'); await find(p); s = await st(p);
    rec('First floor / No. 7: WO-10 (floor 1) same + WO-9 (L1) not sure → pick, never filled', !s.wo && JSON.stringify(s.picks) === '["WO-10","WO-9"]', JSON.stringify(s));
    // customer not linked to a project: not sure
    await fill(p, 'T20', '3'); await find(p); s = await st(p);
    rec('a job whose customer has no project: not sure, offered', !s.wo && JSON.stringify(s.picks) === '["WO-11"]' && /project not known/.test(s.msg), JSON.stringify(s));
    // nothing live: shipped WO-5 (T09/14) and delivered WO-12 (T09/15) are not offered
    await fill(p, 'T09', '16'); await find(p); s = await st(p);
    rec('T09 / 16: only a shipped job there → "No Cienapps work order found"', !s.wo && !s.picks.length && /No Cienapps work order found for Floor T09 · Unit 16 on Aderrig/.test(s.msg), JSON.stringify(s));
    await fill(p, 'T09', '14'); await find(p); s = await st(p);
    rec('T09 / 14 vs WO-2 (floor 1 / 14): "1 work order could be this house", not sure', JSON.stringify(s.picks) === '["WO-2"]' && /1 work order could be this house/.test(s.msg), JSON.stringify(s));
    await fill(p, 'T09', '15'); await find(p); s = await st(p);
    rec('T09 / 15: a delivered job is not offered', !s.picks.length && /No Cienapps work order found/.test(s.msg), JSON.stringify(s));
    // typed WO numbers
    await fill(p, '', '', 'WO-999'); await find(p); s = await st(p);
    rec('typed WO-999: "not in the planner", nothing filled', !s.wo && /WO-999 is not in the planner/.test(s.msg), JSON.stringify(s));
    await fill(p, '', '', 'WO-5'); await find(p); s = await st(p);
    rec('typed WO-5 (shipped): refused — needs a live job', !s.wo && /WO-5 is shipped or delivered/.test(s.msg), JSON.stringify(s));
    await fill(p, '', '', ' wo-3 '); await find(p); s = await st(p);
    rec('typed " wo-3 ": found (trimmed, any case), filled', s.wo === 'WO-3' && /Matched WO-3/.test(s.ok), JSON.stringify(s));
    await p.evaluate(() => document.getElementById('me-jnot').click()); await sleep(100);
    // (round 2) a typed WO of another project / another house: asked; Cancel = not used, said why
    await p.evaluate(() => { window.__confirm = false; });
    await fill(p, '', '', 'WO-6'); await find(p); s = await st(p);
    rec('typed WO-6 (project Lucan) in an Aderrig list: asked, Cancel → not used, "belongs to project Lucan"', !s.wo && /WO-6 not used[\s\S]*belongs to project Lucan/.test(s.msg), JSON.stringify(s));
    await fill(p, 'T09', '40', 'WO-3'); await find(p); s = await st(p);
    rec('typed WO-3 (T09 / 13) with the boxes on T09 / 40: asked, Cancel → not used', !s.wo && /WO-3 not used[\s\S]*the boxes say Floor T09 · Unit 40/.test(s.msg), JSON.stringify(s));
    await p.evaluate(() => { window.__confirm = undefined; }); await fill(p, '', '', '');
    // a WO that already has a live list → Open it instead?
    await p.evaluate(() => { window.__confirm = false; window.__asked = ''; const c = window.confirm; window.confirm = m => { window.__asked = m; return c(m); }; });
    await fill(p, 'GF', '12', ''); await find(p); s = await st(p);
    rec('GF / 12 = WO-1, which has list "House 1": asked "Open it instead?"; Cancel → not filled, said so', !s.wo && await p.evaluate(() => /WO-1 already has a cutting list: "House 1"[\s\S]*Open it instead\?/.test(window.__asked)) && /already has a live cutting list "House 1"/.test(s.msg), JSON.stringify(s));
    await p.evaluate(() => { window.__confirm = true; }); await find(p);
    rec('OK → the existing list "House 1" opens in the editor', await p.evaluate(() => document.querySelectorAll('.me-ed').length === 1 && /Edit cutting list/.test(document.querySelector('.me-ed').innerText) && document.getElementById('me-name').value === 'House 1'));
    await closeEd(p);
    // no project picked
    await p.evaluate(() => openListEditor(null, '', '')); await sleep(150);
    await fill(p, 'T09', '13'); await find(p); s = await st(p);
    rec('no project picked: "Pick the project first", no search', !s.wo && /Pick the project first/.test(s.msg), JSON.stringify(s));
    // the P-number panel starts from the boxes
    await p.evaluate(() => { document.getElementById('me-jt').value = 'HOUSE TYPE Z'; document.getElementById('me-jt').dispatchEvent(new Event('input')); document.getElementById('me-new').click(); }); await sleep(150);
    rec('＋ New P-number: its Floor / Unit / Title start from the boxes', await p.evaluate(() => document.getElementById('me-pfloor').value === 'T09' && document.getElementById('me-punit').value === '13' && document.getElementById('me-ptitle').value === 'HOUSE TYPE Z'));
    await closeEd(p);
    // Copy to new list from 🔍 Find old list
    await p.evaluate(() => lsCopyToNew('L1', 'P1')); await sleep(400);
    s = await st(p);
    rec('Copy to new list: the job boxes are there (no WO yet)', s.open && s.jb && !s.wo, JSON.stringify(s));
    await fill(p, 'Block T9', '022'); await find(p); s = await st(p);
    rec('Copy to new list: Block T9 / 022 → WO-7', s.wo === 'WO-7', JSON.stringify(s));
    // choosing a WO from the drop-down hides the boxes; choosing none brings them back
    await p.evaluate(() => { const w = document.getElementById('me-wo'); w.value = 'WO-2'; w.dispatchEvent(new Event('change')); }); await sleep(150);
    s = await st(p);
    rec('picked WO-2 from the drop-down: green Matched line gone, no boxes', s.wo === 'WO-2' && !s.ok && !s.jb, JSON.stringify(s));
    await p.evaluate(() => { const w = document.getElementById('me-wo'); w.value = ''; w.dispatchEvent(new Event('change')); }); await sleep(150);
    rec('drop-down back to none: the boxes come back', (await st(p)).jb);
    await closeEd(p);
    // editing an existing list: no boxes
    await p.evaluate(() => openListEditor('L1')); await sleep(300);
    rec('editing an existing list: no job boxes (B2 boxes as before)', !(await st(p)).jb);
    await closeEd(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
    // phone 360 px: boxes wrap, no sideways scroll
    const ph = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
    await ph.page.evaluate(() => openListEditor(null, '', 'P1')); await sleep(200);
    await fill(ph.page, 'T09', '13'); await find(ph.page);
    const sc = await ph.page.evaluate(() => { const o = document.querySelector('.me-ed'); const r = document.getElementById('me-jb').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, jr: Math.round(r.right), ow: o.scrollWidth, oc: o.clientWidth }; });
    rec('phone 360 px: the job boxes and pick list fit (no sideways scroll)', sc.sw <= sc.cw + 1 && sc.jr <= 361 && sc.ow <= sc.oc + 1, JSON.stringify(sc));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
