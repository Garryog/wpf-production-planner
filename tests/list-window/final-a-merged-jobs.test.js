// FINAL Tester round, file A (14 Nov): the list window on the MERGED code (Deliveries weeks + Shipped steps + list window).
//  1. Work order drop-down vs the Shipped steps release: shipped by hand (9 / 10 / 11), brought back, on hold, delivered by a driver.
//  2. Find the Cienapps WO: shipped-by-hand job never offered; blank floor / unit never auto-matched.
//  3. Two units, same number, different blocks / floors: never one job, never each other's list.
//  4. P-number last resort, then the real Cienapps import arrives for that house: nothing lost, honest screen.
// Fake Supabase only. Run: node tests/list-window/final-a-merged-jobs.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const HDR = ['WO # ', 'Title', 'Customer ', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor ', 'Unit'];
const SER = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse('1899-12-30T00:00:00Z')) / 864e5);
const waitSave = p => p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); });
const doImp = async (p, rowsAoa) => {
  const r = await H.importAoa(p, [HDR].concat(rowsAoa));
  const ap = await p.evaluate(async () => { if (!IMPPLAN) return 'no plan'; applyImport(IMPPLAN); try { sched && sched(); } catch (e) {} await saveDB(); return 'ok'; });
  await sleep(800); await waitSave(p);
  await p.evaluate(async () => { lsReset(); await lsLoad(); }); await sleep(300);
  return { plan: r.plan, ap, prev: r.iprev };
};
const PROC = '5. WORK ORDER PROCESSED';
const o = (wo, floor, unit, title, due, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor, unit, title, dueDate: due, origDueDate: due, step: PROC, cienStep: PROC }, x || {}));
function row() {
  const r = X.v2Row();
  r.orders.push(
    o('WO-A1', 'K', '1', 'K1 KITCHEN', '2026-11-20'), o('WO-A2', 'K', '2', 'K2 KITCHEN', '2026-11-05'),
    o('WO-H9', 'K', '9', 'K9 KITCHEN', '2026-11-03'), o('WO-H10', 'K', '10', 'K10 KITCHEN', '2026-11-03'), o('WO-H11', 'K', '11', 'K11 KITCHEN', '2026-11-03'),
    o('WO-BB', 'K', '20', 'K20 KITCHEN', '2026-11-04'), o('WO-DRV', 'K', '30', 'K30 KITCHEN', '2026-11-03', { delv: true, delVeh: 'v1', delDay: 'Thu' }),
    o('WO-VAN', 'K', '31', 'K31 KITCHEN', '2026-11-06', { delv: true, delVeh: 'v1', delDay: 'Fri' }),
    o('WO-HOLD', 'K', '40', 'K40 KITCHEN', '2026-11-03', { step: '12. ON HOLD / DELETE', cienStep: '12. ON HOLD / DELETE', cienHold: true }),
    o('WO-IMP9', 'K', '50', 'K50 KITCHEN', '2026-11-03'),
    // same unit number in different blocks / floors
    o('WO-BA', 'Block A', '12', 'BLOCK A APT 12 KITCHEN', '2026-11-25'), o('WO-BB12', 'Block B', '12', 'BLOCK B APT 12 KITCHEN', '2026-11-26'),
    o('WO-F3', '3', '12', 'APT 12 KITCHEN', '2026-11-27'), o('WO-F4', '4', '12', 'APT 12 KITCHEN', '2026-11-28'),
    // blank floor / unit
    o('WO-NF', '', '77', 'APT 77 KITCHEN', '2026-11-29'), o('WO-NU', '7', '', 'LEVEL 7 COMMON AREA', '2026-11-29'), o('WO-NN', '', '', 'MISC PANELS', '2026-11-29'));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    const d = await X.dev(browser, S, 'design'), q = d.page; await asks(q);
    const refresh = async pg => { await pg.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(700); };
    const woOpts = async (pg, pid) => { await closeAll(pg); await pg.evaluate(pid => openListEditor(null, '', pid), pid || 'P1'); await sleep(900); const r = await pg.evaluate(() => [...document.getElementById('me-wo').options].map(o => ({ v: o.value, t: o.textContent })).filter(o => o.v)); await closeAll(pg); return r; };

    // ---------- 1. Shipped steps release meets the drop-down ----------
    const hand = async (wo, v) => { await p.evaluate(({ wo, v }) => { window.__confirm = true; stepShipHand(DB.orders.find(x => x.wo === wo), v); }, { wo, v }); await sleep(300); };
    await hand('WO-H9', '9. JOB SHIPPED'); await hand('WO-H10', '10. INSTALLED TO BE INVOICE'); await hand('WO-H11', '11. COMPLETED AND INVOICED'); await hand('WO-BB', '9. JOB SHIPPED');
    // bring WO-BB back through the real Shipped tab button
    const bb = await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 400)); const b = document.querySelector('[data-shb="WO-BB"]'); if (!b) return 'no button'; b.click(); await new Promise(r => setTimeout(r, 400)); const x = DB.orders.find(x => x.wo === 'WO-BB'); return JSON.stringify([x.step, !!x.shippedAt]); });
    rec('set-up: WO-BB shipped by hand, then "↩ Bring back to board" → back at step 5, not shipped', bb === JSON.stringify([PROC, false]), bb);
    // the driver confirms WO-DRV delivered (Deliveries release fields)
    await p.evaluate(() => { const x = DB.orders.find(x => x.wo === 'WO-DRV'); const now = nowISO(); x.delLoadedAt = now; x.delDispAt = now; x.delDelivAt = now; x.delDone = true; x.delivBy = 'Driver'; sched(); });
    // a real import ships WO-IMP9
    const im = await doImp(p, [['WO-IMP9', 'K50 KITCHEN', 'Aderrig Homes', SER('2026-11-03'), '9. JOB SHIPPED', 4000, '', 'K', '50']]);
    await p.evaluate(async () => { await saveDB(); }); await sleep(900); await waitSave(p);
    const srv = w => S.row.orders.find(x => x.wo === w) || {};
    rec('set-up: the plan in the database has H9/H10/H11/IMP9 shipped, BB back, DRV delivered', !!srv('WO-H9').shippedAt && !!srv('WO-H10').shippedAt && !!srv('WO-H11').shippedAt && !!srv('WO-IMP9').shippedAt && !srv('WO-BB').shippedAt && !!srv('WO-DRV').delDelivAt, JSON.stringify(['WO-H9', 'WO-H10', 'WO-H11', 'WO-IMP9', 'WO-BB', 'WO-DRV'].map(w => [w, srv(w).step, !!srv(w).shippedAt, !!srv(w).delDelivAt])) + ' imp=' + im.ap);
    for (const [pg, who] of [[p, 'the PC that did it'], [q, 'another PC after its refresh']]) {
      if (pg === q) await refresh(q);
      const op = await woOpts(pg), vs = op.map(x => x.v);
      rec('D1 (' + who + '): jobs set to 9 / 10 / 11 BY HAND on the Capacity Board are left out of the Work order drop-down', !vs.includes('WO-H9') && !vs.includes('WO-H10') && !vs.includes('WO-H11'), JSON.stringify(vs));
      rec('D2 (' + who + '): a job an import called 9. JOB SHIPPED is left out', !vs.includes('WO-IMP9'), JSON.stringify(vs));
      rec('D3 (' + who + '): a job brought back to the board IS offered again (it is live)', vs.includes('WO-BB'), JSON.stringify(vs));
      rec('D4 (' + who + '): a job the driver confirmed delivered is left out; one still booked on a van is offered', !vs.includes('WO-DRV') && vs.includes('WO-VAN'), JSON.stringify(vs));
      rec('D5 (' + who + '): on hold left out', !vs.includes('WO-HOLD'), JSON.stringify(vs));
      const due = op.map(x => (/due (\d+ \w+)/.exec(x.t) || [])[1]).filter(Boolean).map(s => Date.parse(s + ' 2026'));
      rec('D6 (' + who + '): earliest due first all the way down', due.length > 5 && due.every((v, i) => !i || due[i - 1] <= v), JSON.stringify(op.map(x => x.t)));
      rec('D7 (' + who + '): only this project\'s jobs (no Lucan WO-6)', !vs.includes('WO-6'), JSON.stringify(vs));
    }
    // Find the Cienapps WO never fills in a shipped / delivered job
    const find = async (pg, f, u, title) => { await closeAll(pg); await pg.evaluate(() => { window.__asked = []; openListEditor(null, '', 'P1'); }); await sleep(800); await setid(pg, 'me-jf', f); await setid(pg, 'me-ju', u); if (title) await setid(pg, 'me-jt', title); await click(pg, 'me-find'); await sleep(700);
      return pg.evaluate(() => ({ wo: (document.getElementById('me-wo') || {}).value || '', hwo: (document.getElementById('me-hwo') || {}).textContent || '', picks: [...document.querySelectorAll('.me-ed [data-jbpick], .me-ed [data-jpick], #me-jb button')].map(b => b.innerText.replace(/\s+/g, ' ')), txt: ((document.getElementById('me-jb') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 400) })); };
    let f = await find(q, 'K', '9');
    rec('F1: Floor K · Unit 9 (job shipped by hand) → not filled in, not offered', !f.wo && !/WO-H9/.test(f.txt), JSON.stringify(f));
    f = await find(q, 'K', '30');
    rec('F2: Floor K · Unit 30 (delivered by the driver) → not filled in, not offered', !f.wo && !/WO-DRV/.test(f.txt), JSON.stringify(f));
    f = await find(q, 'K', '20');
    rec('F3: Floor K · Unit 20 (brought back to the board) → found', f.wo === 'WO-BB', JSON.stringify(f));
    f = await find(q, 'K', '40');
    rec('(info) F4: Floor K · Unit 40 is ON HOLD in Cienapps → ' + (f.wo === 'WO-HOLD' ? 'filled in by itself' : /WO-HOLD/.test(f.txt) ? 'offered' : 'not offered') + ' (the drop-down leaves on-hold jobs out; keyJobs() does not)', f.wo !== 'WO-HOLD', JSON.stringify(f));

    // ---------- 2. blank floor / unit: never an automatic match ----------
    f = await find(q, '', '77');
    rec('B1: Floor blank · Unit 77 (WO-NF has unit 77, no floor) → nothing filled in by itself', !f.wo, JSON.stringify(f));
    f = await find(q, '7', '');
    rec('B2: Floor 7 · Unit blank (WO-NU has floor 7, no unit) → nothing filled in by itself', !f.wo, JSON.stringify(f));
    f = await find(q, '9', '77');
    rec('B3: Floor 9 · Unit 77 typed; the only "77" job has NO floor → not filled in by itself (offered to pick at most)', !f.wo, JSON.stringify(f));
    f = await find(q, '7', '5');
    rec('B4: Floor 7 · Unit 5 typed; WO-NU (floor 7, unit blank) → not filled in, and no P-number made without asking', !f.wo && !S.row.orders.some(x => /^P-/.test(x.wo)), JSON.stringify(f));
    // the person picks from the drop-down
    await closeAll(q); await q.evaluate(() => openListEditor(null, '', 'P1')); await sleep(800);
    await q.evaluate(() => { const b = document.getElementById('me-jobtog'); const s = document.getElementById('me-wo'); if (s.closest('[hidden]') && b) b.click(); }); await sleep(200);
    await setid(q, 'me-wo', 'WO-NN', 'change'); await sleep(600);
    let j = await job(q);
    rec('B5: job with blank floor AND unit picked from the drop-down → WO-NN shown in the title bar', j.hwo === 'WO-NN' && j.wo === 'WO-NN', JSON.stringify([j.hwo, j.wo, j.err]));
    await fillSaw(q, 0, 'Panel', '1', '600', '300', 'MFC White'); await save(q, 2300);
    let dn = await donep(q);
    rec('B5: …and it saves onto WO-NN only', !!dn && /Saved ✓/.test(dn.h) && liveFor(S, 'WO-NN').length === 1 && liveFor(S, 'WO-NU').length === 0 && liveFor(S, 'WO-NF').length === 0, JSON.stringify([dn && dn.h, await err(q)]));
    await closeAll(q);

    // ---------- 3. same unit number, different blocks / floors ----------
    f = await find(q, 'Block A', '12');
    const firstIs = (f, wo) => f.wo === wo || (!f.wo && f.picks.filter(x => /^WO-/.test(x))[0] && f.picks.filter(x => /^WO-/.test(x))[0].startsWith(wo + ' ') && /same house/.test(f.picks.filter(x => /^WO-/.test(x))[0]) && f.picks.filter(x => /same house/.test(x)).length === 1);
    rec('S1: Block A · Unit 12 → WO-BA filled in, or offered FIRST as the only "same house" (other "12" jobs only as "not sure") — never another block\'s job by itself', firstIs(f, 'WO-BA'), JSON.stringify(f));
    f = await find(q, 'Block B', '12');
    rec('S2: Block B · Unit 12 → WO-BB12 filled in or the only "same house", first', firstIs(f, 'WO-BB12'), JSON.stringify(f));
    f = await find(q, '3', '12');
    rec('S3: Floor 3 · Unit 12 → WO-F3 filled in or the only "same house", first; floor 4\'s flat 12 is not offered at all', firstIs(f, 'WO-F3') && !f.picks.some(x => /^WO-F4 /.test(x)), JSON.stringify(f));
    f = await find(q, '', '12');
    rec('S4: Unit 12 with no floor (four jobs have unit 12) → nothing chosen for the person', !f.wo, JSON.stringify(f));
    f = await find(q, 'Block C', '12');
    rec('S5: Block C · Unit 12 (no such block) → none of the four other "12" jobs is filled in', !f.wo, JSON.stringify(f));
    // list on Block A's flat; Block B's must not show it / share it
    await closeAll(q); await q.evaluate(() => openListEditor(null, 'WO-BA')); await sleep(1100);
    await setid(q, 'me-name', 'A12 list'); await fillSaw(q, 0, 'A-side', '2', '720', '560', 'MFC White'); await save(q, 2300); dn = await donep(q); await closeAll(q);
    rec('S6 set-up: list saved on WO-BA', !!dn && liveFor(S, 'WO-BA').length === 1, JSON.stringify(dn && dn.h));
    await q.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-BB12'); }); await sleep(1100);
    const rb = await rows(q); j = await job(q);
    rec('S6: opening Block B\'s flat 12 → a NEW empty list (not Block A\'s rows), title bar WO-BB12', j.hwo === 'WO-BB12' && !rb.some(r => r.item === 'A-side') && /New cutting list/.test(j.title), JSON.stringify([j.hwo, j.title, rb.map(r => r.item)]));
    await fillSaw(q, 0, 'B-side', '3', '700', '500', 'MFC White'); await save(q, 2300); dn = await donep(q);
    const askedB = await q.evaluate(() => window.__asked.slice());
    rec('S7: saving Block B\'s list → no "already has a list" question (it is a different house)', !!dn && !askedB.some(m => /ALREADY HAS/.test(m)), JSON.stringify(askedB.map(m => m.slice(0, 80))));
    const la = liveFor(S, 'WO-BA'), lb = liveFor(S, 'WO-BB12');
    rec('S7: …each flat has exactly its own list and rows', la.length === 1 && lb.length === 1 && la[0].id !== lb[0].id && linesOf(S, la[0].id).every(x => x.part === 'A-side') && linesOf(S, lb[0].id).every(x => x.part === 'B-side') && linesOf(S, la[0].id).length === 1 && linesOf(S, lb[0].id).length === 1, JSON.stringify([la.map(l => l.wos), lb.map(l => l.wos)]));
    rec('S7: …neither list is tagged with both work orders', la[0] && lb[0] && la[0].wos.length === 1 && lb[0].wos.length === 1, JSON.stringify([la[0] && la[0].wos, lb[0] && lb[0].wos]));
    await closeAll(q);
    // the saw: each job shows its own rows
    const sw = await X.dev(browser, S, 'saw'), ps = sw.page; await sleep(600);
    const sv = await ps.evaluate(() => { const v = id => { try { return lsView(id, true).rows.map(r => r.item); } catch (e) { return ['ERR ' + e.message]; } }; return lists().filter(l => !l.tpl && !l.archived && (l.wos || []).some(w => /WO-BA|WO-BB12/.test(w))).map(l => ({ wos: l.wos, name: l.name })); });
    rec('S8: the saw screen has two separate lists, one per flat', sv.length === 2 && sv.every(l => l.wos.length === 1), JSON.stringify(sv));
    await sw.close();
    // floors 3 and 4, an import of flat 12 floor 4 with a changed title must not touch floor 3's list
    await q.evaluate(() => openListEditor(null, 'WO-F3')); await sleep(1100); await fillSaw(q, 0, 'F3-side', '2', '720', '560', 'MFC White'); await save(q, 2300); await closeAll(q);
    const f3 = snap(S, (liveFor(S, 'WO-F3')[0] || {}).id);
    await doImp(p, [['WO-F4', 'APT 12 KITCHEN REV B', 'Aderrig Homes', SER('2026-11-28'), PROC, 4000, '', '4', '12'], ['WO-F5', 'APT 12 KITCHEN', 'Aderrig Homes', SER('2026-12-01'), PROC, 4000, '', '5', '12']]);
    rec('S9: an import that changes floor 4\'s flat 12 and adds floor 5\'s flat 12 leaves floor 3\'s list exactly as it was; floors 4 and 5 have no list', snap(S, (liveFor(S, 'WO-F3')[0] || {}).id) === f3 && liveFor(S, 'WO-F4').length === 0 && liveFor(S, 'WO-F5').length === 0);
    await refresh(q);
    const need = await q.evaluate(() => listsNeeded().map(x => x.wo));
    rec('S10: "Cutting lists to issue" still asks for floor 4 and floor 5 (not hidden by floor 3\'s list)', need.includes('WO-F4') && need.includes('WO-F5') && !need.includes('WO-F3'), JSON.stringify(need.filter(w => /WO-F/.test(w))));

    // ---------- 4. P-number last resort → the Cienapps import arrives ----------
    const pnums = () => S.row.orders.filter(x => /^P-\d+$/.test(x.wo)).map(x => x.wo);
    await closeAll(q); await q.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, '', 'P1'); }); await sleep(800);
    await setid(q, 'me-jf', 'M'); await setid(q, 'me-ju', '66'); await setid(q, 'me-jt', 'M66 KITCHEN'); await click(q, 'me-find'); await sleep(600);
    const none = await q.evaluate(() => ({ txt: ((document.getElementById('me-jb') || {}).innerText || '').replace(/\s+/g, ' '), mk: !!document.getElementById('me-jmkp'), nn: !!document.getElementById('me-jnone') }));
    rec('P1: Floor M · Unit 66 → "No Cienapps job found"; no P-number yet', /No Cienapps/i.test(none.txt) && pnums().length === 0, JSON.stringify(none));
    await q.evaluate(() => { const b = document.getElementById('me-jmkp') || document.getElementById('me-jnone'); if (b) b.click(); }); await sleep(600);
    const askedP = await q.evaluate(() => window.__asked.slice());
    await setid(q, 'me-pdue', '2026-12-10'); await setid(q, 'me-pval', '1500'); await setid(q, 'me-phrs', '6');
    await setid(q, 'me-name', 'M66 — my list'); await fillSaw(q, 0, 'P-side', '4', '720', '560', 'MFC White'); await setv(q, '0|note', 'keep me');
    await save(q, 3000); await waitSave(q); dn = await donep(q);
    const pw = pnums()[0] || '';
    rec('P2: after the person says so, ONE P-number is made and the list saved on it', pnums().length === 1 && !!dn && liveFor(S, pw).length === 1, JSON.stringify([pnums(), dn && dn.h, await err(q), askedP.map(m => m.slice(0, 60))]));
    rec('P2: …the Saved panel names the P-number', !!dn && dn.l.includes(pw), dn && dn.l);
    await closeAll(q);
    const pl = liveFor(S, pw)[0] || {}, psnap = snap(S, pl.id);
    const flag = await q.evaluate(async () => { LH.kind = 'live'; LH.proj = ''; LH.state = ''; const d = document.createElement('div'); d.innerHTML = lsHomeHTML(); const c = [...d.querySelectorAll('.lst-chip.p-wo')]; return { purple: c.length, txt: c.map(x => x.textContent.replace(/\s+/g, ' ')).join(' | ') }; }).catch(e => ({ err: e.message }));
    rec('P3: the Cutting Lists page shows the P-number purple, "not from Cienapps"', flag.purple > 0 && /not from Cienapps/i.test(flag.txt), JSON.stringify(flag));
    // the real import arrives with the Cienapps WO for that house
    const n0 = S.db.t.lists.length;
    const im2 = await doImp(p, [['WO-M66', 'M66 KITCHEN', 'Aderrig Homes', SER('2026-12-12'), PROC, 5200, '', 'M', '66']]);
    rec('P4: after the import, the P-number job and its list are still there, rows untouched (nothing lost)', S.row.orders.some(x => x.wo === pw) && snap(S, pl.id) === psnap && S.db.t.lists.length === n0, JSON.stringify([im2.ap, pnums()]));
    rec('P4: …the Cienapps job WO-M66 is in the plan too', S.row.orders.some(x => x.wo === 'WO-M66'));
    rec('(info, known: the P → WO merge is the NEXT release) P4b: the import preview says a P-number job / list already exists for that house (it says "1 work order newly processed with no cutting list — after Apply you\'ll be asked to issue it"; after Apply the Lists page does say "List already made under P-…")', /P-\d+/.test(im2.prev), im2.prev.replace(/\s+/g, ' ').slice(0, 300));
    await refresh(q);
    const after = await q.evaluate(pw => { LH.kind = 'live'; LH.proj = ''; LH.state = ''; const d = document.createElement('div'); d.innerHTML = lsHomeHTML(); const t = d.innerText || d.textContent; let lti = []; try { lti = ltiRows().map(r => r.o.wo); } catch (e) {} return { says: /Cienapps WO now exists/.test(t), names: new RegExp(pw).test(t), needM66: listsNeeded().map(x => x.wo).includes('WO-M66'), lti: lti.includes('WO-M66'), body: (document.getElementById('lti') || {}).innerText || '' }; }, pw);
    rec('P5: the Cutting Lists page is honest: says a Cienapps WO now exists for the P-number\'s house', after.says && after.names, JSON.stringify({ says: after.says, names: after.names }));
    rec('P6: WO-M66 is NOT asked for a second list ("List already made under ' + pw + '")', !after.lti && new RegExp('already made under ' + pw).test(after.body.replace(/\s+/g, ' ')), JSON.stringify([after.lti, after.needM66, after.body.replace(/\s+/g, ' ').slice(0, 200)]));
    // someone opens WO-M66 from the board anyway and saves: must be asked first
    await q.evaluate(() => { window.__asked = []; window.__confirm = false; openListEditor(null, 'WO-M66'); }); await sleep(1200);
    j = await job(q);
    rec('P7: opening WO-M66 says in the window that the house already has a list under the P-number', new RegExp(pw).test(await q.evaluate(() => document.querySelector('.me-ed').innerText)), (j.pm + ' ' + j.err).slice(0, 200));
    await fillSaw(q, 0, 'Dup', '1', '100', '100', 'MFC White'); await q.evaluate(() => { window.__confirm = false; }); await save(q, 2500);
    const a7 = await q.evaluate(() => window.__asked.slice()); dn = await donep(q);
    rec('P8: Save on WO-M66 asks first ("ALREADY HAS a cutting list, under ' + pw + '"); Cancel → not saved, no Saved ✓, rows kept', a7.some(m => /ALREADY HAS/.test(m) && m.includes(pw)) && !dn && liveFor(S, 'WO-M66').length === 0 && (await rows(q)).some(r => r.item === 'Dup'), JSON.stringify([a7.map(m => m.slice(0, 70)), dn && dn.h, await err(q)]));
    await q.evaluate(() => { window.__confirm = true; }); await closeAll(q);
    // the saw: the P-number list is still on its sheet with its rows and its note
    const sw2 = await X.dev(browser, S, 'saw'), ps2 = sw2.page; await sleep(600);
    const sawP = await ps2.evaluate(id => { try { return lsView(id, true).rows.map(r => [r.item, r.qty, r.note].join('/')); } catch (e) { return ['ERR ' + e.message]; } }, pl.id);
    rec('P9: the saw still has the P-number list with its row and note', sawP.some(x => /P-side\/4\/.*keep me/.test(x)), JSON.stringify(sawP));
    await sw2.close();
    // importing the same file again: still exactly one P job, one WO-M66, one list
    await doImp(p, [['WO-M66', 'M66 KITCHEN', 'Aderrig Homes', SER('2026-12-12'), PROC, 5200, '', 'M', '66']]);
    rec('P10: the same import a second time → still one P-number job, one WO-M66, the one list', pnums().length === 1 && S.row.orders.filter(x => x.wo === 'WO-M66').length === 1 && S.db.t.lists.length === n0 && snap(S, pl.id) === psnap, JSON.stringify(pnums()));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 400));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
