// Tester attack ROUND 3b (list window, 13 Nov): re-attack of the Coder's round-3 fixes —
//  1. the block rule (pBlkMeet inside pSameHouseAll): odd ways of writing a block, the "Block 2 / Block 12" prefix trap, a block
//     on ONE job only, none on either; the Lists tab count against the "Cutting lists to issue" panel;
//  3. (M4) the list window opened from a Cienapps WO whose house already has a list under a P-number.
// Fake Supabase only. Run: node tests/list-window/attack3b-block-punder.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, rows, liveFor } = L;
const PROC = '5. WORK ORDER PROCESSED';
const o = (wo, floor, unit, title, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(600); };
// [P-number job's title, Cienapps job's title, one house?, severity when it fails] — # is the unit number
const SC = [
  ['BLOCK B APT # KITCHEN', 'Blk B Apt # Kitchen', true, 'HIGH'],
  ['block b apt # kitchen', 'BLOCK  B APT # KITCHEN', true, 'HIGH'],
  ['Block-B Apt # Kitchen', 'BLOCK B APT # KITCHEN', true, 'HIGH'],
  ['Block B, Apt # Kitchen', 'BLOCK B APT # KITCHEN', true, 'HIGH'],
  ['B Block Apt # Kitchen', 'BLOCK B APT # KITCHEN', true, 'MEDIUM'],
  ['Apt # Kitchen (Block B)', 'BLOCK B APT # KITCHEN', true, 'HIGH'],
  ['Block 2 Apt # Kitchen', 'BLOCK 02 APT # KITCHEN', true, 'LOW'],
  ['BLOCK B APT # KITCHEN', 'APT # KITCHEN', true, 'HIGH'],
  ['APT # KITCHEN', 'BLOCK B APT # KITCHEN', true, 'HIGH'],
  ['APT # KITCHEN', 'Apt # Kitchen', true, 'HIGH'],
  ['Apartment Block Apt # Kitchen', 'BLOCK A APT # KITCHEN', true, 'LOW'],
  ['BLOCK A APT # KITCHEN', 'BLOCK B APT # KITCHEN', false, 'HIGH'],
  ['B Block Apt # Kitchen', 'BLOCK A APT # KITCHEN', false, 'MEDIUM'],
  ['Block 2 Apt # Kitchen', 'Block 12 Apt # Kitchen', false, 'HIGH'],
  ['Block 1 Apt # Kitchen', 'Block 10 Apt # Kitchen', false, 'HIGH'],
  ['Blk. B Apt # Kitchen', 'BLOCK A APT # KITCHEN', false, 'MEDIUM'],
  ['Apt # Kitchen (Block B)', 'Block A - Apt # Kitchen', false, 'MEDIUM'],
  ['BLOCK: B APT # KITCHEN', 'BLOCK A APT # KITCHEN', false, 'MEDIUM'],
  ['Block B Type A Apt # Kitchen', 'Block A Type B Apt # Kitchen', false, 'MEDIUM'],
  ['BLOCK B1 APT # KITCHEN', 'BLOCK B APT # KITCHEN', false, 'LOW'],
];

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r0 = X.v2Row();
    SC.forEach((s, i) => { const u = String(101 + i); r0.orders.push(o('P-' + (2001 + i), '1', u, s[0].replace('#', u), { step: '' }), o('WO-S' + (101 + i), '1', u, s[1].replace('#', u))); });
    r0.orders.push(o('P-3001', '8', '80', 'APT 80 KITCHEN', { step: '' }), o('WO-C80', '8', '80', 'APT 80 KITCHEN'), o('WO-C80U', '8', '80', 'APT 80 UTILITY'),
      o('P-3002', '1', '12', 'BLOCK B APT 12 KITCHEN', { step: '' }), o('WO-TA', '1', '12', 'BLOCK A APT 12 KITCHEN'),
      o('P-3003', '6', '60', 'APT 60 KITCHEN', { step: '' }), o('WO-C60', '6', '60', 'APT 60 KITCHEN'));
    const S = X.makeServer(r0);
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    SC.forEach((s, i) => X.F3.seedList(S, 'LS' + i, { wos: ['P-' + (2001 + i)], name: 'P list ' + i, list: { project_id: 'PK' } }));
    X.F3.seedList(S, 'LP80', { wos: ['P-3001'], name: 'Apt 80', list: { project_id: 'PK' } });
    X.F3.seedList(S, 'LP12', { wos: ['P-3002'], name: 'Block B apt 12', list: { project_id: 'PK' } });
    X.F3.seedList(S, 'LP60', { wos: ['P-3003'], name: 'Apt 60', list: { project_id: 'PK', archived: true } });
    const t = await X.dev(browser, S, 'design'), p = t.page, kb = p.keyboard; await asks(p);
    const reload = async () => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(1300); };
    await reload();
    const v = await p.evaluate(() => ({ rows: ltiRows().map(r => r.o.wo), txt: ((document.getElementById('lti') || {}).innerText || '').replace(/\s+/g, ' '),
      dom: [...document.querySelectorAll('#lti [data-ltirow]')].map(x => x.dataset.ltirow), cnt: (document.getElementById('listcnt') || {}).textContent, wc: lsWaitCheckLists().length, need: listsNeeded().length }));
    rec('B0 set-up: the "Cutting lists to issue" panel is on the Drawing office screen with rows', v.rows.length > 0 && v.txt.length > 0, JSON.stringify([v.rows.length, v.need]));

    // ---------- 1. the block rule, title by title ----------
    for (let i = 0; i < SC.length; i++) { const [pt, ct, same, sev] = SC[i], u = String(101 + i), pw = 'P-' + (2001 + i), cw = 'WO-S' + (101 + i);
      const r = await p.evaluate(({ u, pt, ct, pw, cw }) => ({ blk: [keyBlk(pt), keyBlk(ct)], under: pListUnder(DB.orders.find(x => x.wo === cw)),
        // someone makes a NEW P-number for this floor + unit with the P title while only the Cienapps job is there: is the Cienapps job found ("use it")?
        dup: pSameHouseAll({ wo: '(new)', pid: 'PK', floor: '1', unit: u, title: pt }, DB.orders.filter(x => x.wo === cw)).map(x => x.wo) }), { u, pt: pt.replace('#', u), ct: ct.replace('#', u), pw, cw });
      const asked = v.rows.includes(cw);
      if (same) {
        rec('[' + sev + '] B1 same house: P-number "' + pt + '" / Cienapps "' + ct + '" → the Cienapps WO is NOT asked for a second list (it is under ' + pw + ')', !asked && r.under === pw, JSON.stringify([r.blk, 'asked ' + asked, r.under]));
        rec('[' + sev + '] B1 …and a new P-number typed with that title for the same floor + unit finds the Cienapps job (never two jobs for one unit)', r.dup.includes(cw), JSON.stringify([r.blk, r.dup]));
      } else {
        rec('[' + sev + '] B2 different blocks: P-number "' + pt + '" / Cienapps "' + ct + '" → the Cienapps WO IS still asked for its own list', asked && !r.under, JSON.stringify([r.blk, 'asked ' + asked, r.under]));
        rec('[' + sev + '] B2 …and a new P-number with that title is NOT sent to the other block\'s WO', !r.dup.includes(cw), JSON.stringify([r.blk, r.dup]));
      } }

    // ---------- the Lists tab count = the panel (the tab bar is on the OFFICE screen only) ----------
    rec('B3: the rows drawn in the Drawing office panel are the panel\'s jobs (up to the first 40)', v.dom.length === Math.min(40, v.rows.length), JSON.stringify([v.dom.length, v.rows.length]));
    const t2 = await X.dev(browser, S, 'office'), q = t2.page; await sleep(900);
    const cnt = async () => { await q.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(1200);
      return q.evaluate(() => { const e = document.getElementById('listcnt'); return { cnt: e.textContent, shown: e.offsetParent !== null, rows: ltiRows().map(r => r.o.wo), wc: lsWaitCheckLists().length, raw: listsNeeded().length }; }); };
    let w = await cnt(); const base = w.rows.length;
    rec('B3: Office screen: the Lists tab count (' + w.cnt + ') = the panel\'s jobs (' + w.rows.length + ') + lists waiting to be checked (' + w.wc + '); jobs under a P-number are not counted', w.shown && +w.cnt === w.rows.length + w.wc && w.raw > w.rows.length, JSON.stringify([w.cnt, w.rows.length, w.wc, w.raw]));
    S.db.t.lists.find(l => l.id === 'LS0').archived = true; w = await cnt();
    rec('B4: a P-number\'s list archived → its Cienapps WO is asked again AND the tab count goes up with it', w.rows.includes('WO-S101') && +w.cnt === w.rows.length + w.wc && w.rows.length === base + 1, JSON.stringify([w.cnt, w.rows.length, base]));
    S.db.t.lists.find(l => l.id === 'LS0').archived = false;
    S.row.orders.find(x => x.wo === 'P-2010').shippedAt = '2026-10-20T10:00:00Z'; w = await cnt(); // SC[9]: none / none
    rec('(info) B5: the P-job SHIPPED (its list still live) → Cienapps WO-S110 for the same house: ' + (w.rows.includes('WO-S110') ? 'asked for a list again' : 'still crossed off'), true, '');
    rec('B5: …count and panel still agree', +w.cnt === w.rows.length + w.wc, JSON.stringify([w.cnt, w.rows.length, w.wc]));
    delete S.row.orders.find(x => x.wo === 'P-2010').shippedAt; w = await cnt();
    // the count straight after an import-style change on the office PC, no reload: a P-list saved from this very page
    await t2.ctx.close().catch(() => {}); await reload();

    // ---------- 3. (M4) the window opened from a Cienapps WO whose house has a P-number list ----------
    const openWo = async wo => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; window.__confirm = true; openListEditor(null, wo); }, wo); await sleep(1200); };
    const note = () => p.evaluate(() => { const e = document.querySelector('.me-ed #me-punder'); if (!e) return null; const r = e.getBoundingClientRect(); return { txt: e.innerText, seen: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight }; });
    await openWo('WO-C80'); let n = await note();
    rec('M4-1: window opened from WO-C80 (house has a list under P-3001) → the notice names P-3001 and is on the screen', !!n && /P-3001/.test(n.txt) && n.seen, JSON.stringify(n));
    await fillSaw(p, 0, 'Door', '1', '700', '400', 'MFC White');
    const nl = S.db.t.lists.length;
    await p.evaluate(() => { window.__asked = []; window.__confirm = m => !/ALREADY HAS a cutting list, under/.test(m); }); await save(p, 2200); await wait(p);
    let a = await p.evaluate(() => window.__asked), e = await err(p);
    rec('M4-2: Save → the "ALREADY HAS a cutting list, under P-3001" question is asked, once', a.filter(m => /ALREADY HAS a cutting list, under P-3001/.test(m)).length === 1, JSON.stringify(a.map(m => m.slice(0, 60))));
    rec('M4-2: Cancel → NOTHING saved (no list on WO-C80, no new list at all), the window stays with its rows and says so', S.db.t.lists.length === nl && liveFor(S, 'WO-C80').length === 0 && !(await donep(p)) && /NOT saved/.test(e) && (await rows(p))[0].item === 'Door', JSON.stringify([S.db.t.lists.length - nl, e]));
    await p.evaluate(() => { window.__asked = []; }); await save(p, 2200); await wait(p); a = await p.evaluate(() => window.__asked);
    rec('M4-3: Save again after Cancel → asked AGAIN (a Cancel is not remembered as a yes); still nothing saved', a.some(m => /under P-3001/.test(m)) && liveFor(S, 'WO-C80').length === 0, JSON.stringify(a.map(m => m.slice(0, 50))));
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await save(p, 2500); await wait(p);
    rec('M4-4: OK → saved ONCE on WO-C80', liveFor(S, 'WO-C80').length === 1 && !!(await donep(p)), JSON.stringify([liveFor(S, 'WO-C80').length, await err(p)]));
    S.db.t.lists.filter(l => (l.wos || []).includes('WO-C80')).forEach(l => { l.archived = true; }); await reload();
    // another KIND for the same house
    await openWo('WO-C80U'); n = await note();
    rec('M4-5: the UTILITY WO for that house (P-3001 is the kitchen) → no notice', !n, JSON.stringify(n));
    // another block
    await openWo('WO-TA'); n = await note();
    rec('M4-6: WO-TA "BLOCK A APT 12" (the P-number list is BLOCK B APT 12) → no notice', !n, JSON.stringify(n));
    await fillSaw(p, 0, 'Door', '1', '700', '400', 'MFC White'); await p.evaluate(() => { window.__asked = []; }); await save(p, 2500); await wait(p); a = await p.evaluate(() => window.__asked);
    rec('M4-6: …and Save asks nothing about a P-number; saved on WO-TA', !a.some(m => /under P-/.test(m)) && liveFor(S, 'WO-TA').length === 1, JSON.stringify(a.map(m => m.slice(0, 50))));
    // archived P-list
    await openWo('WO-C60'); n = await note();
    rec('M4-7: WO-C60 (P-3003\'s list is ARCHIVED) → no notice', !n, JSON.stringify(n));
    await fillSaw(p, 0, 'Door', '1', '700', '400', 'MFC White'); await p.evaluate(() => { window.__asked = []; }); await save(p, 2500); await wait(p); a = await p.evaluate(() => window.__asked);
    rec('M4-7: …Save asks nothing about P-3003; saved on WO-C60', !a.some(m => /under P-/.test(m)) && liveFor(S, 'WO-C60').length === 1, JSON.stringify(a.map(m => m.slice(0, 50))));
    // the everyday route: blank window, Floor + Unit typed, the WO is looked up
    await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, '', 'PK'); }); await sleep(900);
    await p.click('#me-jf'); await kb.type('8'); await kb.press('Tab'); await kb.type('80'); await kb.press('Tab'); await kb.type('APT 80 KITCHEN'); await kb.press('Tab'); await sleep(700);
    if (await p.evaluate(() => !!document.querySelector('.me-ed [data-jpick="WO-C80"]'))) { await p.click('.me-ed [data-jpick="WO-C80"]'); await sleep(600); } // P-3001 and the utility WO are offered too: pick the kitchen WO
    const got = await p.evaluate(() => (document.querySelector('.me-ed #me-wo') || {}).value || (document.querySelector('.me-ed #me-hwo') || {}).innerText || ''); n = await note();
    rec('M4-8 set-up: Floor 8 · Unit 80 · Title typed → WO-C80 looked up (filled in or picked from the offers)', /WO-C80$/.test(got.trim()), got);
    rec('[MEDIUM] M4-8: …the same notice (list already under P-3001) shows when the WO was FOUND / picked by floor + unit — the everyday way in', !!n && /P-3001/.test(n.txt), JSON.stringify(n));
    await fillSaw(p, 0, 'Door', '1', '700', '400', 'MFC White');
    await p.evaluate(() => { window.__asked = []; window.__confirm = m => !/ALREADY HAS a cutting list, under/.test(m); }); await save(p, 2200); await wait(p); a = await p.evaluate(() => window.__asked);
    rec('[MEDIUM] M4-8: …and Save asks the P-3001 question; Cancel saves nothing', a.some(m => /under P-3001/.test(m)) && liveFor(S, 'WO-C80').length === 0, JSON.stringify([a.map(m => m.slice(0, 50)), liveFor(S, 'WO-C80').length]));
    // Start from… a template / old list on that WO: is the question still asked?
    await openWo('WO-C80'); await fillSaw(p, 0, 'Door', '1', '700', '400', 'MFC White');
    const viaWoSel = await p.evaluate(() => { const w = document.querySelector('.me-ed #me-wo'); return w ? w.value : ''; });
    rec('(info) M4-9: window opened from WO-C80: work order box = ' + viaWoSel, true, '');
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
