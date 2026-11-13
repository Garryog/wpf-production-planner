// Tester attack ROUND 3 (list window, 13 Nov): "Find the WO" now runs on leaving the TITLE box (not the Unit box) so a block
// named in the Title stops another block's job being filled in; and "List already made under P-…" for a Cienapps WO that
// arrives after a P-number list. Real typing, Tab and mouse clicks (so blur fires as on a PC). Fake Supabase only.
// Run: node tests/list-window/attack3-findwo-pnum.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor } = L;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { ok: (q('#me-jbok') || {}).innerText || '', msg: ((q('#me-jbm') || {}).innerText || '').slice(0, 160), wo: (q('#me-wo') || {}).value || '', hwo: (q('#me-hwo') || {}).innerText || '', mkp: !!q('#me-jmkp'), newp: !!q('#me-ptitle'),
    picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick + (/same house/.test(b.innerText) ? ':same' : ':unsure')), foc: (document.activeElement || {}).id || ((document.activeElement || {}).dataset || {}).mr || '' }; });
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(700); };
const PROC = '5. WORK ORDER PROCESSED';
const o = (wo, floor, unit, title, c, x) => H.order(Object.assign({ wo, customer: c || 'Kildare Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
function row() { const r = X.v2Row();
  r.orders.push(o('WO-TA', '1', '12', 'BLOCK A APT 12 KITCHEN'), o('WO-TB2', '2', '12', 'BLOCK B APT 12 KITCHEN'),
    o('WO-ONE', '5', '50', 'APT 50 KITCHEN'), o('WO-DA', '3', '7', 'BLOCK A APT 7 KITCHEN'), o('WO-DB', '3', '7', 'BLOCK B APT 7 KITCHEN'));
  return r; }

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    const t = await X.dev(browser, S, 'design'), p = t.page, kb = p.keyboard; await asks(p);
    const open = async pid => { await closeAll(p); await p.evaluate(pid => { window.__asked = []; window.__confirm = true; openListEditor(null, '', pid); }, pid || 'PK'); await sleep(800); };
    const type = async (id, v) => { await p.click('#' + id); await kb.type(v); };
    const pnums = () => S.row.orders.filter(x => /^P-\d+$/.test(x.wo)).map(x => x.wo);

    // ---------- 1. the keyboard path: Floor → Tab → Unit → Tab → Title → Tab ----------
    await open(); await type('me-jf', '1'); await kb.press('Tab'); await kb.type('12'); await kb.press('Tab'); await sleep(400);
    let s = await st(p);
    rec('W1: Tab from Unit into Title → nothing filled in yet (the look-up waits for the Title)', !s.wo && s.foc === 'me-jt', JSON.stringify(s));
    await kb.type('BLOCK B APT 12'); await kb.press('Tab'); await sleep(600); s = await st(p);
    rec('W1: …Title "BLOCK B APT 12" typed, Tab on → looked up; WO-TA (BLOCK A) is NOT filled in — it is offered as "not sure"', !s.wo && s.picks.includes('WO-TA:unsure'), JSON.stringify(s));
    rec('(info) W1: …where the cursor went after the look-up redrew the window', true, s.foc);
    // odd ways of writing the block
    for (const ttl of ['block b apt 12', 'Blk B Apt 12', 'BLOCK-B, APT 12', 'APT 12 (BLOCK B)', 'B Block apt 12', 'Block  B']) {
      await open(); await type('me-jf', '1'); await kb.press('Tab'); await kb.type('12'); await kb.press('Tab'); await kb.type(ttl); await kb.press('Tab'); await sleep(500); s = await st(p);
      rec((/^(block b apt 12|BLOCK-B, APT 12|Block  B)$/.test(ttl) ? '' : '(info) ') + 'W2: Title "' + ttl + '" (block B) → WO-TA (BLOCK A APT 12) not filled in by itself', s.wo !== 'WO-TA', JSON.stringify([s.wo, s.picks])); }
    // two jobs, same floor + unit, blocks only in the titles
    await open(); await type('me-jf', '3'); await kb.press('Tab'); await kb.type('7'); await kb.press('Tab'); await kb.type('BLOCK B APT 7'); await kb.press('Tab'); await sleep(500); s = await st(p);
    rec('W3: two jobs Floor 3 · Unit 7 (BLOCK A / BLOCK B in the titles), Title says BLOCK B → never WO-DA; WO-DB filled or offered as the same house', s.wo !== 'WO-DA' && (s.wo === 'WO-DB' || s.picks.includes('WO-DB:same')), JSON.stringify(s));
    await open(); await type('me-jf', '3'); await kb.press('Tab'); await kb.type('7'); await kb.press('Tab'); await kb.press('Tab'); await sleep(500); s = await st(p);
    rec('W3b: same two jobs, Title left EMPTY and Tabbed past → looked up, neither filled by itself, both offered', !s.wo && s.picks.length === 2, JSON.stringify(s));

    // ---------- 2. the person never goes into the Title box ----------
    await open(); await type('me-jf', '5'); await kb.press('Tab'); await kb.type('50'); await p.click('.me-ed [data-mr="0|item"]'); await sleep(600); s = await st(p);
    rec('W4: Floor 5 · Unit 50 typed, then a click straight into the first row (Title never visited) → the WO is still looked up: WO-ONE', s.wo === 'WO-ONE' || s.hwo === 'WO-ONE', JSON.stringify(s));
    rec('W4: …and the cursor is in the row that was clicked (typing goes on there)', s.foc === '0|item', s.foc);
    // rows typed FIRST, then Floor / Unit, then the big Save pressed with the mouse (blur + click together)
    await open(); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
    await type('me-jf', '5'); await kb.press('Tab'); await kb.type('50');
    const p0 = pnums().length;
    await p.click('#me-save'); await sleep(2500); await wait(p);
    let d = await donep(p), e = await err(p); s = d ? {} : await st(p);
    rec('W5: rows typed, then Floor 5 · Unit 50, then the big Save pressed straight from the Unit box → never a list with no WO, never a P-number', liveFor(S, '').length === 0 && pnums().length === p0 && !S.db.t.lists.some(l => !l.is_template && !(l.wos || []).length && l.name !== 'House 1'), JSON.stringify([d && d.h, e, pnums()]));
    rec('[MEDIUM] W5: …ONE press of Save is enough: the list is saved on WO-ONE — or the window says in words why not (first press must not be lost in the look-up\'s redraw)', (!!d && liveFor(S, 'WO-ONE').length === 1) || e.length > 0, JSON.stringify([d && d.h, e, s.wo, s.ok]));
    if (!d) { await p.click('#me-save'); await sleep(2500); await wait(p); d = await donep(p); }
    rec('W5: …a second press at the latest saves it on WO-ONE (found by floor + unit)', !!d && liveFor(S, 'WO-ONE').length === 1, JSON.stringify([d && d.h, await err(p)]));
    // the same from the TITLE box (the new place the look-up hangs on)
    S.db.t.lists.filter(l => (l.wos || []).includes('WO-ONE')).forEach(l => { l.archived = true; }); await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await open(); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
    await type('me-jf', '5'); await kb.press('Tab'); await kb.type('50'); await kb.press('Tab'); await kb.type('APT 50');
    await p.click('#me-save'); await sleep(2500); await wait(p);
    d = await donep(p); e = await err(p);
    rec('[MEDIUM] W6: Floor · Unit · Title typed, big Save pressed straight from the Title box → ONE press saves on WO-ONE or says why not', (!!d && liveFor(S, 'WO-ONE').length === 1) || e.length > 0, JSON.stringify([d && d.h, e, (await st(p)).wo]));
    rec('W6: …no list without a WO and no P-number came of it', pnums().length === p0, JSON.stringify(pnums()));

    // ---------- 3. blank floor / unit ----------
    await open(); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await type('me-jf', '5'); await kb.press('Tab'); await kb.press('Tab'); await kb.type('APT 50 KITCHEN'); await kb.press('Tab'); await sleep(500); s = await st(p);
    rec('W7: Floor typed, Unit BLANK, Title typed → no search, nothing filled in (never a guess from the title alone)', !s.wo && !s.picks.length, JSON.stringify(s));
    const nl = S.db.t.lists.length; await p.click('#me-save'); await sleep(1500); e = await err(p);
    rec('[LOW] W7: …Save → refused in plain words that name the real problem (no work order / Floor and Unit) — it says "Give the list a house / name"; nothing saved, no P-number', !(await donep(p)) && S.db.t.lists.length === nl && pnums().length === p0 && /work order|WO|Floor|Unit/i.test(e), e);
    // spaces only
    await open(); await type('me-jf', '   '); await kb.press('Tab'); await kb.type('  '); await kb.press('Tab'); await kb.press('Tab'); await sleep(400); s = await st(p);
    rec('W8: Floor and Unit of spaces only → no search, no job filled in', !s.wo && !s.picks.length, JSON.stringify(s));

    // ---------- 4. ＋ New P-number never skips the look-up ----------
    await open(); await setid(p, 'me-jf', '5'); await setid(p, 'me-ju', '50');
    await p.evaluate(() => { const b = document.getElementById('me-new'); if (b) b.click(); }); await sleep(500); s = await st(p);
    rec('W9: Floor 5 · Unit 50 typed (no look-up yet), ＋ New P-number pressed → WO-ONE is shown first; no P-number panel straight away', !s.newp && (s.picks.some(x => /WO-ONE/.test(x)) || s.wo === 'WO-ONE'), JSON.stringify(s));

    // ---------- 5. P-number list, then the Cienapps WO arrives ----------
    const mkP = async (floor, unit, title) => { await open(); await setid(p, 'me-jf', floor); await setid(p, 'me-ju', unit); await setid(p, 'me-jt', title); await click(p, 'me-find'); await sleep(500);
      if (await p.evaluate(() => !!document.getElementById('me-jmkp'))) await click(p, 'me-jmkp'); else await click(p, 'me-jnone'); await sleep(500);
      await setid(p, 'me-pdue', '2026-12-10'); await setid(p, 'me-pval', '1500'); await setid(p, 'me-phrs', '6');
      const before = pnums(); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White');
      // typed boxes survive: ＋ Row, ＋ Heading, More ▾, the ? help
      await click(p, 'me-addsaw'); await sleep(200); await click(p, 'me-addhdr'); await sleep(200); await click(p, 'me-help'); await sleep(200);
      const kept = await p.evaluate(() => ['me-ptitle', 'me-pfloor', 'me-punit', 'me-pdue', 'me-pval', 'me-phrs'].map(i => (document.getElementById(i) || {}).value));
      await p.evaluate(() => { const b = [...document.querySelectorAll('.me-ed [data-mrx]')]; b.slice(1).reverse().forEach(x => x.click()); }); await sleep(300);
      await save(p, 2500); await wait(p); const dn = await donep(p), er = dn ? '' : await err(p); await closeAll(p);
      return { kept, wo: pnums().find(w => !before.includes(w)) || '', dn: dn && dn.h, er }; };
    const a = await mkP('8', '80', 'APT 80 KITCHEN');
    rec('N1: new P-number: Title / Floor / Unit / Due / Value / Hours all still filled after ＋ Row, ＋ Heading and ?', JSON.stringify(a.kept) === JSON.stringify(['APT 80 KITCHEN', '8', '80', '2026-12-10', '1500', '6']), JSON.stringify(a.kept));
    rec('N1 set-up: the P-number list for Floor 8 · Unit 80 is saved (' + a.wo + ')', !!a.wo && liveFor(S, a.wo).length === 1, JSON.stringify(a));
    // BLOCK B's flat: Cienapps only has BLOCK A's flat with the same floor + unit numbers (WO-TA). OK to everything first:
    const b = await mkP('1', '12', 'BLOCK B APT 12 KITCHEN');
    const q2 = await p.evaluate(() => window.__asked.filter(m => /use it|Make a new P-number anyway/.test(m)).map(m => m.split('\n')[0]));
    rec('[HIGH] N2: P-number for "BLOCK B APT 12" (Floor 1 · Unit 12) while WO-TA "BLOCK A APT 12" is in the planner: after "Make a new P-number anyway? OK" the P-number IS made. (Save asks a third time — "WO-TA from Cienapps is in the planner now… No second job is made for one house" — pFreshDup()/pSameHouse() has no block rule: OK moves the list onto BLOCK A\'s WO, Cancel = "Not saved")', !!b.wo, JSON.stringify([b.wo, b.dn, b.er, q2]));
    rec('[HIGH] N2: …and BLOCK B\'s list did NOT land on WO-TA (BLOCK A\'s job)', liveFor(S, 'WO-TA').length === 0, JSON.stringify(liveFor(S, 'WO-TA').map(l => l.name)));
    // Cancel on that third question: is there any way through?
    await p.evaluate(() => { window.__confirm = m => !/No second job is made for one house/.test(m); });
    const b2 = await mkP('1', '12', 'BLOCK B APT 12 KITCHEN');
    rec('[HIGH] N2b: …answering Cancel to "use WO-TA" → the P-number for BLOCK B is made (today: "Not saved" — a dead end, block B can get no list at all until Cienapps has its WO)', !!b2.wo, JSON.stringify([b2.wo, b2.dn, b2.er]));
    await p.evaluate(() => { window.__confirm = true; });
    // for the next checks: BLOCK B's P-number job and its list, as if made before WO-TA came in
    S.db.t.lists.filter(l => (l.wos || []).includes('WO-TA')).forEach(l => { l.archived = true; });
    if (!S.row.orders.some(x => x.wo === 'P-1050')) S.row.orders.push(o('P-1050', '1', '12', 'BLOCK B APT 12 KITCHEN', 'Kildare Homes', { step: '' }));
    X.F3.seedList(S, 'LPB', { wos: ['P-1050'], name: 'Block B apt 12', list: { project_id: 'PK' } });
    b.wo = 'P-1050';
    // Cienapps brings: the kitchen WO for 8/80 · a UTILITY WO for 8/80 · the same unit on another floor
    S.row.orders.push(o('WO-C80', '8', '80', 'APT 80 KITCHEN'), o('WO-C80U', '8', '80', 'APT 80 UTILITY'), o('WO-C980', '9', '80', 'APT 80 KITCHEN'), o('WO-C80S', ' 8 ', '80 ', 'Apt 80 Kitchen '));
    const lti = async () => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(1500);
      return p.evaluate(() => ({ txt: ((document.getElementById('lti') || {}).innerText || '').replace(/\s+/g, ' '), rows: ltiRows().map(r => r.o.wo), need: listsNeeded().map(x => x.wo) })); };
    let v = await lti();
    rec('N3 set-up: the "Cutting lists to issue" panel is on the Drawing office screen', v.txt.length > 0, v.txt.slice(0, 120));
    rec('N3: WO-C80 (same house + kind as ' + a.wo + ') is NOT asked for a second list; the panel says "List already made under ' + a.wo + '"', !v.rows.includes('WO-C80') && v.txt.includes('List already made under ' + a.wo), JSON.stringify(v.rows));
    rec('N3: Floor / Unit with trailing spaces from Cienapps (" 8 " / "80 ") is the same house: WO-C80S not asked either', !v.rows.includes('WO-C80S'), JSON.stringify(v.rows));
    rec('N4: the UTILITY WO for the same house (another kind) IS still asked for its own list', v.rows.includes('WO-C80U'), JSON.stringify(v.rows));
    rec('N4: the same unit number on ANOTHER floor (9 · 80) IS still asked', v.rows.includes('WO-C980'), JSON.stringify(v.rows));
    // the block trap: the P-number list is BLOCK B's flat; WO-TA is BLOCK A's flat with the same floor + unit numbers
    rec('[HIGH] N5: WO-TA "BLOCK A APT 12" is still ASKED for its list — the P-number list is for BLOCK B APT 12 (same floor + unit numbers, other block). pListUnder() does not use the block rule that keyFind() has, so block A\'s flat is silently crossed off', v.rows.includes('WO-TA') && !new RegExp('List already made under ' + b.wo).test(v.txt), JSON.stringify([v.rows, (v.txt.match(/List already made under [^—]*/g) || [])]));
    // the P-number's list is archived → the Cienapps WO needs a list again
    S.db.t.lists.filter(l => (l.wos || []).includes(a.wo)).forEach(l => { l.archived = true; });
    v = await lti();
    rec('N6: the P-number\'s list ARCHIVED → WO-C80 is asked for a list again (nothing is hidden by a dead list)', v.rows.includes('WO-C80'), JSON.stringify(v.rows));
    S.db.t.lists.filter(l => (l.wos || []).includes(a.wo)).forEach(l => { l.archived = false; });
    // opening the list window FROM the Cienapps WO whose house has a P-number list: is the person told?
    await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(1200);
    await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, 'WO-C80'); }); await sleep(1200);
    const told = await p.evaluate(P => { const w = document.querySelector('.me-ed'); return { txt: w ? w.innerText.replace(/\s+/g, ' ') : '', asked: window.__asked.join(' | ') }; }, a.wo);
    rec('[MEDIUM] N7: list window opened from WO-C80 (＋ New list / Work order pick): it SAYS the house already has a list under ' + a.wo + ' before a second list is typed', new RegExp(a.wo).test(told.txt + told.asked), (told.txt.match(/[^.]*P-\d+[^.]*/) || [told.txt.slice(0, 160)])[0] + ' || ' + told.asked.slice(0, 120));
    await fillSaw(p, 0, 'Door', '1', '700', '400', 'MFC White'); await p.evaluate(() => { window.__asked = []; }); await save(p, 2500); await wait(p);
    const sv = await p.evaluate(() => window.__asked.join(' | ')), d7 = await donep(p);
    rec('[MEDIUM] N7b: …Save → asked / told about ' + a.wo + ' — one house must not get two live lists without a word', new RegExp(a.wo).test(sv + ((d7 || {}).l || '') + (await err(p))), JSON.stringify([sv.slice(0, 200), d7 && d7.h]));
    await closeAll(p);
    // what the SAW is told about the Cienapps WO whose list sits under the P-number
    S.db.t.lists.filter(l => (l.wos || []).includes('WO-C80')).forEach(l => { l.archived = true; });
    const oc = S.row.orders.find(x => x.wo === 'WO-C80S'); Object.assign(oc, { delv: true, delDay: '2026-10-23', delVan: 'Van 1', delivDate: '2026-10-23' });
    const t2 = await X.dev(browser, S, 'saw'), q = t2.page; await sleep(800);
    const saw = await q.evaluate(() => ({ red: ((document.getElementById('wait-red') || {}).innerText || '').replace(/\s+/g, ' '), amb: ((document.getElementById('wait-amber') || {}).innerText || '').replace(/\s+/g, ' ') }));
    rec('(info) N8: saw screen for WO-C80S (on a van, list is under ' + a.wo + '): ' + (/WO-C80S/.test(saw.red) ? 'RED "ON DELIVERY – NO CUTTING LIST" still shows it, with no word that the list is under ' + a.wo + ' — the Drawing office panel says the opposite' : 'not in the red box'), !/WO-C80S/.test(saw.red) || new RegExp(a.wo).test(saw.red), saw.red.slice(0, 220));
    await t2.ctx.close().catch(() => {});
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
