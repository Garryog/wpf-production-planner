// Tester attack (list window, 12 Nov): the JOB a list belongs to.
// Blank floor / unit; the same unit number in different blocks / floors (never matched to each other silently);
// a P-number made and then Cienapps brings the real WO for the same house; the customer renamed in Cienapps.
// Fake Supabase only. Run: node tests/list-window/attack1-jobs.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { ok: (q('#me-jbok') || {}).innerText || '', msg: (q('#me-jbm') || {}).innerText || '', wo: (q('#me-wo') || {}).value || '', hwo: (q('#me-hwo') || {}).innerText || '', pw: !!q('#me-ptitle'), mkp: !!q('#me-jmkp'),
    picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick + (/same house/.test(b.innerText) ? ':same' : ':unsure')), err: (q('#me-err') || {}).textContent || '' }; });
const find = async (p, f, u) => { await closeAll(p); await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(500); await setid(p, 'me-jf', f); await setid(p, 'me-ju', u); await click(p, 'me-find'); await sleep(500); return st(p); };
const projs = S => S.db.t.projects.map(x => x.name + (x.active === false ? ' (inactive)' : ''));

function row() {
  const r = X.v2Row(), o = (wo, floor, unit, title, c) => H.order({ wo, customer: c || 'Aderrig Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30' });
  r.orders.push(o('WO-B1', '', '5', 'HOUSE 5'), o('WO-B2', 'T11', '', 'T11 COMMON AREA'), o('WO-B3', '', '', 'MISC PANELS'),
    o('WO-S1', 'Block A', '12', 'APT 12 KITCHEN'), o('WO-S2', 'Block B', '12', 'APT 12 KITCHEN'), o('WO-S3', '1', '12', 'APT 12 KITCHEN'), o('WO-S4', '2', '12', 'APT 12 KITCHEN'),
    o('WO-S5', 'Block A', '12', 'APT 12 KITCHEN', 'Lucan Homes'), // the same floor + unit on ANOTHER project
    o('WO-R1', 'R', '1', 'RENAME 1'), o('WO-R2', 'R', '2', 'RENAME 2'), o('WO-R3', 'R', '3', 'RENAME 3'), o('WO-R4', 'R', '4', 'RENAME 4'), o('WO-R5', 'R', '5', 'RENAME 5'));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await asks(p);

    // ============ 1. the same unit number in different blocks / floors ============
    let s = await find(p, 'Block A', '12');
    rec('Floor "Block A" · Unit 12 (12 also exists in Block B, floor 1, floor 2 and on another project) → WO-S1 filled in, or offered as the ONLY "same house" (the other unit 12s "not sure" at most) — never another one by itself', s.wo === 'WO-S1' || (!s.wo && s.picks.includes('WO-S1:same') && s.picks.filter(x => /:same$/.test(x)).length === 1), JSON.stringify([s.wo, s.picks]));
    rec('(info, simplicity) …it is filled in BY ITSELF when exactly one job has that floor + unit (here the person must pick from ' + s.picks.length + ')', s.wo === 'WO-S1', JSON.stringify(s.picks));
    s = await find(p, 'block  b', ' 012 ');
    rec('Floor "block  b" · Unit " 012 " → WO-S2 filled in or the only "same house" (never Block A\'s 12)', s.wo === 'WO-S2' || (!s.wo && s.picks.includes('WO-S2:same') && s.picks.filter(x => /:same$/.test(x)).length === 1), JSON.stringify([s.wo, s.picks]));
    s = await find(p, 'Block C', '12');
    rec('Floor "Block C" · Unit 12 (no such job) → NOTHING filled in by itself; none of the other blocks\' unit 12 taken silently', !s.wo && !s.hwo, JSON.stringify(s));
    rec('…and if other blocks\' unit 12 are offered at all they are marked "not sure", never "same house"', s.picks.every(x => /:unsure$/.test(x)), JSON.stringify(s.picks));
    s = await find(p, '', '12');
    rec('Floor blank · Unit 12 → no search, nothing filled, said plainly (four unit 12s exist)', !s.wo && /Floor and the Unit \(both\)|both needed|No search/.test(s.msg), JSON.stringify(s));
    s = await find(p, '1', '12');
    rec('Floor "1" · Unit 12 → WO-S3 (floor 1), not floor 2 / a block', s.wo === 'WO-S3' || (!s.wo && s.picks.some(x => x === 'WO-S3:same') && !s.picks.some(x => /:same$/.test(x) && !/WO-S3/.test(x))), JSON.stringify(s));
    s = await find(p, '12', '1');
    rec('Floor and Unit typed the wrong way round (Floor 12 · Unit 1) → nothing filled by itself', !s.wo, JSON.stringify(s));
    s = await find(p, 'A', '12');
    rec('Floor "A" · Unit 12 (short for Block A?) → never Block B / floor 1 / floor 2 by itself', !s.wo || s.wo === 'WO-S1', JSON.stringify(s));
    // the WO typed by hand for the OTHER block: told, asked
    await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = false; openListEditor(null, '', 'P1'); }); await sleep(500);
    await setid(p, 'me-jf', 'Block A'); await setid(p, 'me-ju', '12'); await setid(p, 'me-jwo', 'WO-S2'); await click(p, 'me-find'); await sleep(400);
    s = await st(p);
    rec('boxes say Block A · 12 but WO-S2 (Block B · 12) typed by hand → asked "the boxes say …"; Cancel → not used', !s.wo && (await p.evaluate(() => window.__asked.some(m => /the boxes say/.test(m)))), JSON.stringify([s, await p.evaluate(() => window.__asked)]));
    await p.evaluate(() => { window.__confirm = true; });
    // same floor + unit on ANOTHER project is never offered
    s = await find(p, 'Block A', '12');
    rec('the Lucan job with the same Floor + Unit (WO-S5) is never matched or offered on an Aderrig list', s.wo !== 'WO-S5' && !s.picks.some(x => /WO-S5/.test(x)), JSON.stringify([s.wo, s.picks]));

    // ============ 2. blank floor / blank unit on the Cienapps job ============
    s = await find(p, 'T11', '5');
    rec('Floor T11 · Unit 5 typed; Cienapps has WO-B1 with a BLANK floor and unit 5 → not filled by itself (offered as "not sure" at most)', !s.wo && !s.picks.some(x => /:same$/.test(x)), JSON.stringify(s));
    rec('…WO-B2 (floor T11, BLANK unit) is not offered as this house', !s.picks.some(x => /WO-B2/.test(x)), JSON.stringify(s.picks));
    for (const wo of ['WO-B1', 'WO-B2', 'WO-B3']) {
      await closeAll(p); await p.evaluate(wo => openListEditor(null, wo), wo); await sleep(800);
      const j = await job(p);
      await setv(p, '0|item', 'Hinge ' + wo); await setv(p, '0|qty', '2'); await save(p, 1800);
      const dn = await donep(p);
      rec(wo + ' (blank floor and/or unit) opened FROM THE JOB: title bar has the WO + due, pickers folded, Save works → one list', j.hwo === wo && !!j.due && j.woHidden && !!dn && liveFor(S, wo).length === 1, JSON.stringify([j.hwo, j.due, j.woHidden, dn && dn.h, await err(p)]));
    }
    await closeAll(p);
    // the WO drop-down line for a job with no floor / unit
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(500);
    const ol = await p.evaluate(() => [...document.getElementById('me-wo').options].filter(o => /^WO-B/.test(o.value)).map(o => o.textContent));
    rec('WO drop-down: jobs with blank floor / unit show without "Fl  ·" / "Unit  ·" gaps or "undefined"', ol.length === 3 && ol.every(x => !/undefined|null|Fl\s+·|Unit\s+·|·\s+·/.test(x)), JSON.stringify(ol));
    await closeAll(p);

    // ============ 3. a P-number made, then Cienapps brings the real WO for the same house ============
    s = await find(p, 'T30', '77');
    rec('P-number: Floor T30 · Unit 77 → "No Cienapps work order found" + [Make a P-number instead…]', !s.wo && s.mkp && /No Cienapps work order found/.test(s.msg), JSON.stringify(s));
    await setid(p, 'me-jt', 'HOUSE 77 KITCHEN'); await click(p, 'me-jmkp'); await sleep(400);
    await setid(p, 'me-pdue', '2026-12-10'); await setv(p, '0|item', 'Tap'); await setv(p, '0|qty', '1'); await save(p, 2500);
    let dn = await donep(p);
    const pj = S.row.orders.filter(o => /^P-\d+$/.test(o.wo));
    rec('P-number made after the confirm, list saved on it (title bar of the saved panel shows the P-number)', pj.length === 1 && dn && new RegExp(pj[0].wo).test(dn.l) && liveFor(S, pj[0].wo).length === 1, JSON.stringify([pj.map(o => o.wo + ' ' + o.floor + '/' + o.unit), dn && dn.l, await err(p)]));
    await closeAll(p);
    const P = pj[0] ? pj[0].wo : 'P-?';
    // the Cienapps import (run on another PC) brings WO-777 for Aderrig · T30 · 77
    await p.evaluate(async () => { for (let i = 0; i < 30 && (typeof SAVING !== 'undefined' && SAVING); i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(800);
    S.row.orders.push(H.order({ wo: 'WO-777', customer: 'Aderrig Homes', floor: 'T30', unit: '77', title: 'HOUSE 77 KITCHEN', dueDate: '2026-12-10', origDueDate: '2026-12-10' })); S.row.version = (S.row.version || 1) + 1;
    await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); showTab('l'); }); await sleep(1200);
    const after = { jobs: S.row.orders.filter(o => o.floor === 'T30' && o.unit === '77').map(o => o.wo), onP: liveFor(S, P).length, on777: liveFor(S, 'WO-777').length };
    const page = await p.evaluate(() => document.body.innerText);
    rec('after the import: the list is NOT duplicated — still exactly one live list for that house', after.onP + after.on777 === 1, JSON.stringify(after));
    rec('[not on this branch — L4b] the list moved onto WO-777 and the P-number job was merged away by itself', after.jobs.length === 1 && after.on777 === 1, JSON.stringify(after));
    rec('…until then it is FLAGGED on the Cutting Lists page ("A Cienapps WO now exists for the house of ' + P + ': WO-777")', new RegExp('A Cienapps WO now exists for the house of\\s*' + P).test(page.replace(/ · not from Cienapps/g, '')) && /WO-777/.test(page), (page.match(/[^\n]*Cienapps WO now exists[^\n]*/) || [''])[0]);
    // open the P-number's list: does the window say so too?
    await p.evaluate(P => { const l = lsCache().all.find(l => !l.tpl && !l.archived && (l.wos || []).includes(P)); openListEditor(l.id); }, P); await sleep(900);
    const wtxt = await p.evaluate(() => document.querySelector('.me-ed').innerText);
    rec('…and the P-number\'s own list WINDOW says a Cienapps WO now exists for this house (WO-777)', /WO-777/.test(wtxt), wtxt.replace(/\s+/g, ' ').slice(0, 220));
    await closeAll(p);
    // the person now starts a NEW list from the Cienapps job WO-777 (the delivery card / lists-needed route): a second list for the same house?
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-777'); }); await sleep(900);
    const w7 = await p.evaluate(() => ({ txt: document.querySelector('.me-ed') ? document.querySelector('.me-ed').innerText : '', asked: window.__asked.slice() }));
    rec('a NEW list started from WO-777 while ' + P + ' already has this house\'s list → the window WARNS that ' + P + ' has a list for the same house', new RegExp(P).test(w7.txt) || w7.asked.some(m => new RegExp(P).test(m)), JSON.stringify({ asked: w7.asked, txt: w7.txt.replace(/\s+/g, ' ').slice(0, 160) }));
    if (await ed(p)) { await setv(p, '0|item', 'Tap'); await setv(p, '0|qty', '1'); await save(p, 2000); }
    rec('…typed and Saved → the house (T30 · 77) still has ONE live list, not one on ' + P + ' and one on WO-777', liveFor(S, P).length + liveFor(S, 'WO-777').length === 1, JSON.stringify({ onP: liveFor(S, P).length, on777: liveFor(S, 'WO-777').length, done: (await donep(p) || {}).h, err: await err(p) }));
    await closeAll(p);
    // a second P-number for the same house is refused
    s = await find(p, 'T30', '77');
    rec('typing Floor T30 · Unit 77 again now finds the jobs that exist (no third job offered blindly)', !!s.wo || s.picks.length > 0, JSON.stringify(s));
    await closeAll(p);

    // ============ 4. the customer renamed in Cienapps after the project exists ============
    const before = projs(S).slice();
    const rename = async (wo, c) => { S.row.orders.find(o => o.wo === wo).customer = c; S.row.version = (S.row.version || 1) + 1; await p.evaluate(async () => { await loadDB(); }); await sleep(400);
      await closeAll(p); await p.evaluate(wo => { window.__asked = []; openListEditor(null, wo); }, wo); await sleep(1500); const j = await job(p); await closeAll(p); return j; };
    let j = await rename('WO-R1', 'ADERRIG HOMES LTD.');
    rec('customer "Aderrig Homes" → "ADERRIG HOMES LTD." in Cienapps: still project Aderrig, NO second project', j.pid === 'P1' && projs(S).length === before.length, JSON.stringify([j.pid, j.pm, projs(S)]));
    j = await rename('WO-R2', 'Aderrig  Homes Limited ');
    rec('→ "Aderrig  Homes Limited " (spaces, Limited): still project Aderrig, no second project', j.pid === 'P1' && projs(S).length === before.length, JSON.stringify([j.pid, j.pm, projs(S)]));
    j = await rename('WO-R3', 'Aderrig Homes (Phase 2)');
    const n3 = projs(S).length;
    rec('→ "Aderrig Homes (Phase 2)": NOT a silent second project — the person is asked "Is this project Aderrig?" (or it is linked)', n3 === before.length && (j.pid === 'P1' || /Is this project 'Aderrig'/.test(j.pm)), JSON.stringify([j.pid, j.pm, projs(S)]));
    j = await rename('WO-R4', 'Aderig Homes'); // a typo fixed the other way round
    const n4 = projs(S).length;
    rec('→ "Aderig Homes" (one letter different — a typo corrected in Cienapps): NOT a silent second project', n4 === n3, JSON.stringify([j.pid, j.pm, projs(S)]));
    j = await rename('WO-R5', 'Glenveagh Living');
    const made = S.db.t.projects.find(x => x.name === 'Glenveagh Living');
    rec('→ a completely new name "Glenveagh Living": a new project is made (customer = project) AND the person is told ("set up from the WO\'s customer")', !!made && j.pid === made.id && /from the WO's customer/.test(j.pm), JSON.stringify([j.pid, j.pm]));
    // the existing list of a renamed customer's job keeps its project and still opens showing both
    X.F3.seedList(S, 'LR', { wos: ['WO-R5'], name: 'Made before the rename' });
    await p.evaluate(async () => { lsReset(); await lsLoad(); openListEditor('LR'); }); await sleep(900);
    j = await job(p);
    rec('a list made BEFORE the rename (project Aderrig, WO-R5 now "Glenveagh Living"): opens on its WO, shows Project "Aderrig" beside customer "Glenveagh Living"', j.hwo === 'WO-R5' && j.pid === 'P1' && j.pjro === 'Aderrig' && /Glenveagh Living/.test(j.info), JSON.stringify([j.hwo, j.pid, j.pjro, j.info.replace(/\n/g, ' ')]));
    await setv(p, '0|note', 'x'); await save(p, 2000);
    const lr = S.db.t.lists.find(l => l.id === 'LR');
    rec('…edited + Saved → stays on project Aderrig and WO-R5 (not moved to the new project behind the folded pickers)', lr.project_id === 'P1' && JSON.stringify(lr.wos) === '["WO-R5"]', JSON.stringify([lr.project_id, lr.wos, await err(p)]));
    await closeAll(p);
    // "Change job" on Aderrig after the renames: do the renamed jobs still show for Aderrig?
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(500);
    const dd = await p.evaluate(() => [...document.getElementById('me-wo').options].map(o => o.value).filter(v => /^WO-R/.test(v)));
    rec('(info) Aderrig\'s WO drop-down after the renames holds ' + JSON.stringify(dd) + ' — WO-R1 / R2 (same customer, other spelling) must still be there', dd.includes('WO-R1') && dd.includes('WO-R2'), JSON.stringify(dd));
    await closeAll(p);
    rec('projects at the end: ' + JSON.stringify(projs(S)), true);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
