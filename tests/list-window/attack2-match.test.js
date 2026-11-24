// Tester attack 2 (list window, 12 Nov evening): which JOB / PROJECT a list lands on.
//  1. same unit number in different blocks where the block is only in the WO TITLE (Cienapps floor = level) — never auto-matched
//  2. a WO with blank floor / unit, opened from the job and found from the Lists page
//  3. a P-number, then the REAL Cienapps import (Import Work Orders tab) brings the WO for that house
//  4. customer renamed / a different company with the same "core" word — one project per customer, a "contains" fit asked
//  5. a new P-number: typed due date / value / hours survive picking a material
// Fake Supabase only. Run: node tests/list-window/attack2-match.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { ok: (q('#me-jbok') || {}).innerText || '', msg: (q('#me-jbm') || {}).innerText || '', wo: (q('#me-wo') || {}).value || '', hwo: (q('#me-hwo') || {}).innerText || '', mkp: !!q('#me-jmkp'),
    picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick + (/same house/.test(b.innerText) ? ':same' : ':unsure')) }; });
const find = async (p, pid, f, u, t) => { await closeAll(p); await p.evaluate(pid => openListEditor(null, '', pid), pid); await sleep(600); await setid(p, 'me-jf', f); await setid(p, 'me-ju', u); if (t) await setid(p, 'me-jt', t); await click(p, 'me-find'); await sleep(600); return st(p); };
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(800); };

function row() {
  const r = X.v2Row(), o = (wo, floor, unit, title, c, x) => H.order(Object.assign({ wo, customer: c || 'Aderrig Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30' }, x || {}));
  r.orders.push(
    // Block only in the TITLE; Cienapps floor = the level. Block B's WO for apt 12 floor 1 is NOT in Cienapps yet.
    o('WO-TA', '1', '12', 'BLOCK A APT 12 KITCHEN', 'Kildare Homes'),
    o('WO-TB2', '2', '12', 'BLOCK B APT 12 KITCHEN', 'Kildare Homes'),
    // levels written differently
    o('WO-LG', 'Ground', '3', 'HOUSE 3', 'Kildare Homes'), o('WO-L1', 'First Floor', '4', 'APT 4', 'Kildare Homes'),
    o('WO-BLK2', 'Block 2', '6', 'APT 6', 'Kildare Homes'),
    // blank floor / unit
    o('WO-BL', '', '', 'MISC PANELS BLANK', 'Kildare Homes'), o('WO-BU', 'T20', '', 'COMMON AREA', 'Kildare Homes'),
    // rename / company words
    o('WO-RN1', 'R', '1', 'R1', 'Lucan Developments Ltd'), o('WO-RN2', 'R', '2', 'R2', 'Aderrig Park Homes'), o('WO-RN3', 'R', '3', 'R3', 'Aderrig Park Homes'),
    o('WO-RN4', 'R', '4', 'R4', 'The Aderrig Group'), o('WO-RN5', 'R', '5', 'R5', 'Aderrig Homes & Co. Ireland'));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);

    // ================= 1. same unit number, block only in the title =================
    let s = await find(p, 'PK', '1', '12', 'BLOCK B APT 12 KITCHEN');
    rec('[block in the title] Floor 1 · Unit 12 typed with Title "BLOCK B APT 12" → NOT auto-filled with WO-TA (BLOCK A APT 12)', s.wo !== 'WO-TA', JSON.stringify(s));
    rec('(info) …what the window offered for it', true, JSON.stringify(s));
    s = await find(p, 'PK', '1', '12', '');
    rec('(info) Floor 1 · Unit 12, title left empty → auto-filled with ' + (s.wo || 'nothing') + ' (only WO-TA has floor 1 + unit 12; its title says BLOCK A)', true, JSON.stringify(s));
    s = await find(p, 'PK', 'Block B', '12', '');
    rec('Floor "Block B" · Unit 12 → never WO-TA (floor 1, title BLOCK A) or WO-TB2 (floor 2) by itself', s.wo !== 'WO-TA' && s.wo !== 'WO-TB2', JSON.stringify(s));
    s = await find(p, 'PK', 'G', '3', '');
    rec('Floor "G" · Unit 3 vs WO-LG "Ground" · 3 → not filled by itself ("G" may be a block)', s.wo !== 'WO-LG', JSON.stringify(s));
    s = await find(p, 'PK', '1st', '4', '');
    rec('Floor "1st" · Unit 4 vs WO-L1 "First Floor" · 4 → same house (filled or offered as same)', s.wo === 'WO-L1' || s.picks.includes('WO-L1:same'), JSON.stringify(s));
    s = await find(p, 'PK', '2', '6', '');
    rec('Floor "2" (a level) · Unit 6 vs WO-BLK2 "Block 2" · 6 → never filled by itself', s.wo !== 'WO-BLK2', JSON.stringify(s));
    await closeAll(p);

    // ================= 2. WO with blank floor / unit =================
    await p.evaluate(() => openListEditor(null, 'WO-BL')); await sleep(1200);
    let j = await job(p);
    rec('blank floor + unit WO opened from the job: window opens on WO-BL, project Kildare, no "undefined" / "Floor  ·" text', j.hwo === 'WO-BL' && j.pid === 'PK' && !/undefined|null|Fl\s+·|Floor\s+·|Unit\s+·/.test(j.title + ' ' + j.info), JSON.stringify([j.hwo, j.pid, j.title.replace(/\n/g, ' '), j.info.replace(/\n/g, ' ')]));
    await fillSaw(p, 0, 'Panel', '1', '600', '500', ''); await save(p, 2200);
    rec('…typed + Saved → one list on WO-BL', !!(await donep(p)) && liveFor(S, 'WO-BL').length === 1, await err(p));
    await closeAll(p);
    s = await find(p, 'PK', 'T20', '9', '');
    rec('Floor T20 · Unit 9 typed: WO-BU (T20, BLANK unit) is not filled in or offered as this house', s.wo !== 'WO-BU' && !s.picks.some(x => /WO-BU/.test(x)), JSON.stringify(s));
    s = await find(p, 'PK', '', '', '');
    rec('Floor and Unit both blank → no search, nothing filled (never WO-BL by itself)', !s.wo, JSON.stringify(s));
    await closeAll(p);

    // ================= 5. P-number: due / value / hours survive picking a material =================
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(700);
    await setid(p, 'me-jf', 'T31'); await setid(p, 'me-ju', '8'); await setid(p, 'me-jt', 'HOUSE 8 KITCHEN'); await click(p, 'me-find'); await sleep(500); await click(p, 'me-jmkp'); await sleep(500);
    await setid(p, 'me-pdue', '2026-12-10'); await setid(p, 'me-pval', '4321'); await setid(p, 'me-phrs', '9');
    await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White');
    const pw = await p.evaluate(() => ({ due: (document.getElementById('me-pdue') || {}).value, val: (document.getElementById('me-pval') || {}).value, hrs: (document.getElementById('me-phrs') || {}).value }));
    rec('new P-number: due date, value and hours typed, then a row\'s material picked → all three still filled in', pw.due === '2026-12-10' && pw.val === '4321' && pw.hrs === '9', JSON.stringify(pw));
    await setid(p, 'me-pdue', '2026-12-10'); await setid(p, 'me-pval', '4321'); await setid(p, 'me-phrs', '9');
    await click(p, 'me-addsaw'); await sleep(300);
    const pw2 = await p.evaluate(() => ({ due: (document.getElementById('me-pdue') || {}).value, val: (document.getElementById('me-pval') || {}).value, hrs: (document.getElementById('me-phrs') || {}).value }));
    rec('…typed again, then ＋ Row → still filled in', pw2.due === '2026-12-10' && pw2.val === '4321' && pw2.hrs === '9', JSON.stringify(pw2));
    await setid(p, 'me-pdue', '2026-12-10'); await setid(p, 'me-pval', '4321'); await setid(p, 'me-phrs', '9');
    await save(p, 2500); await wait(p);
    const pj = S.row.orders.find(o => /^P-\d+$/.test(o.wo) && o.floor === 'T31');
    rec('…saved: the P-number job has value 4321 and 9 hours (not an estimate)', !!pj && +pj.value === 4321 && +pj.hours === 9 && !pj.hoursEstimated, JSON.stringify(pj && { wo: pj.wo, value: pj.value, hours: pj.hours, est: pj.hoursEstimated, err: '' }) + ' ' + await err(p));
    await closeAll(p);

    // ================= 3. P-number, then the REAL Cienapps import brings the WO for that house =================
    const P = pj ? pj.wo : 'P-?';
    const o2 = await X.dev(browser, S, 'office'), q = o2.page; await asks(q);
    const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor', 'Unit'];
    const imp = await H.importAoa(q, [HDR, ['WO-2611-8', 'HOUSE 8 KITCHEN', 'Aderrig Homes', 46366, '5. WORK ORDER PROCESSED', 4321, '2611-8-0-1', 'T31', '8']]);
    rec('(info) Cienapps import preview for the house that already has ' + P, true, imp.iprev.replace(/\s+/g, ' ').slice(0, 400));
    rec('import preview TELLS the office that WO-2611-8 is the house of ' + P + ' (T31 · 8), which already has a cutting list', new RegExp(P).test(imp.iprev) || /same house|P-number/i.test(imp.iprev), imp.iprev.replace(/\s+/g, ' ').slice(0, 300));
    const ap = await q.evaluate(async () => { try { applyImport(IMPPLAN); sched && sched(); await saveDB(); return 'ok ' + DB.orders.filter(o => o.wo === 'WO-2611-8').map(o => o.floor + '/' + o.unit).join(); } catch (e) { return e.message; } }); await wait(q);
    rec('import applied (WO-2611-8 with Floor T31 · Unit 8 is in the plan); the P-number job is still there', /^ok T31\/8/.test(ap) && S.row.orders.some(o => o.wo === P), ap);
    await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(1500);
    const dtxt = await p.evaluate(() => (document.getElementById('lti') || {}).innerText || '');
    rec('Drawing office "Cutting lists to issue" does NOT ask for a list for WO-2611-8 (its house already has one on ' + P + ')', !/WO-2611-8/.test(dtxt), dtxt.replace(/\s+/g, ' ').slice(0, 300));
    const ptxt = await p.evaluate(() => document.body.innerText);
    rec('…the Drawing office sees "A Cienapps WO now exists for the house of ' + P + '"', /Cienapps WO now exists/.test(ptxt), (ptxt.match(/[^\n]*Cienapps WO now exists[^\n]*/) || [''])[0]);
    await o2.close();

    // ================= 4. customer renamed / same core word =================
    const projs = () => S.db.t.projects.map(x => x.id + ':' + x.name);
    const openWo = async wo => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; openListEditor(null, wo); }, wo); await sleep(1800); return job(p); };
    const n0 = S.db.t.projects.length;
    const lucan0 = JSON.stringify(S.db.t.projects.find(x => x.id === 'P2').cien_names);
    j = await openWo('WO-RN1');
    rec('[never assume] "Lucan Developments Ltd" (another company?) is NOT linked to the "Lucan" project (Lucan Homes) without asking', !(j.pid === 'P2' && !/Is this project/.test(j.pm)), JSON.stringify([j.pid, j.pm, projs()]));
    rec('…and "Lucan Developments Ltd" is not added to Lucan\'s Cienapps names behind the person\'s back', JSON.stringify(S.db.t.projects.find(x => x.id === 'P2').cien_names) === lucan0, JSON.stringify(S.db.t.projects.find(x => x.id === 'P2').cien_names));
    j = await openWo('WO-RN4');
    rec('(info) "The Aderrig Group" →', true, JSON.stringify([j.pid, j.pm]));
    j = await openWo('WO-RN5');
    rec('(info) "Aderrig Homes & Co. Ireland" →', true, JSON.stringify([j.pid, j.pm]));
    const ad0 = JSON.stringify(S.db.t.projects.find(x => x.id === 'P1').cien_names);
    j = await openWo('WO-RN2');
    rec('"Aderrig Park Homes" (contains "Aderrig") → ASKED "Is this project Aderrig?", no project picked yet', !j.pid && /Is this project 'Aderrig'/.test(j.pm), JSON.stringify([j.pid, j.pm]));
    rec('…nothing written while the question is on screen (no new project, Aderrig\'s names unchanged)', S.db.t.projects.length === n0 + 0 + (S.db.t.projects.length - n0) && JSON.stringify(S.db.t.projects.find(x => x.id === 'P1').cien_names) === ad0, JSON.stringify([projs(), S.db.t.projects.find(x => x.id === 'P1').cien_names]));
    // close with nothing typed while asked → no question, nothing made
    await p.evaluate(() => { window.__asked = []; document.getElementById('me-x0').click(); }); await sleep(400);
    rec('…✕ Close while asked, nothing typed → closes at once, nothing made', !(await ed(p)) && !(await p.evaluate(() => window.__asked.length)), JSON.stringify(await p.evaluate(() => window.__asked)));
    j = await openWo('WO-RN2');
    await click(p, 'me-pno'); await sleep(1800);
    j = await job(p);
    const np = S.db.t.projects.find(x => /Aderrig Park/.test(x.name));
    rec('"No — make a new project" → project "Aderrig Park Homes" made and used', !!np && j.pid === np.id, JSON.stringify([j.pid, j.pm, projs()]));
    await closeAll(p);
    const n1 = S.db.t.projects.length;
    j = await openWo('WO-RN3');
    rec('a second WO of "Aderrig Park Homes" → uses that project with NO question (one project per customer)', np && j.pid === np.id && !/Is this project/.test(j.pm) && S.db.t.projects.length === n1, JSON.stringify([j.pid, j.pm]));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
