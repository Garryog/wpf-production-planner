// FINAL Tester round, file B (14 Nov): two PCs at once and an OLD screen (origin/main = the Deliveries weeks + Shipped steps
// version that is LIVE today, before the list window) left open — on the merged code.
// Fake Supabase only; main is read with git show (read-only). Run: node tests/list-window/final-a-two-pcs-old.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const PROC = '5. WORK ORDER PROCESSED';
const o = (wo, floor, unit, title, due, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor, unit, title, dueDate: due, origDueDate: due, step: PROC, cienStep: PROC }, x || {}));
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(500); };
const LINES = [['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', 'scribe'], ['saw', 'Shelf', '4', 500, 500, 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']];
(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(o('WO-N1', 'N', '1', 'N1 KITCHEN', '2026-10-23'), o('WO-N2', 'N', '2', 'N2 KITCHEN', '2026-10-23'), o('WO-N3', 'N', '3', 'N3 KITCHEN', '2026-10-23'), o('WO-N4', 'N', '4', 'N4 KITCHEN', '2026-10-23'), o('WO-N5', 'N', '5', 'N5 KITCHEN', '2026-10-23'), o('WO-N6', 'N', '6', 'N6 KITCHEN', '2026-10-23'));
    const S = X.makeServer(r, { lines: LINES });
    const html = A.gitShow('origin/main') || A.gitShow('main');
    const a = await X.dev(browser, S, 'design'), pa = a.page; await asks(pa);
    const b = await X.dev(browser, S, 'design'), pb = b.page; await asks(pb);
    const reload = async p => { await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(600); };
    const idx = async (p, item) => (await rows(p)).findIndex(x => x.item === item);
    const line = (id, part) => linesOf(S, id).find(x => x.part === part) || {};

    // ---------- T1. both PCs open the SAME new job; one saves, then the other ----------
    await pa.evaluate(() => openListEditor(null, 'WO-N1')); await pb.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-N1'); }); await sleep(1300);
    await fillSaw(pa, 0, 'A-part', '2', '720', '560', 'MFC White'); await fillSaw(pb, 0, 'B-part', '5', '700', '500', 'MFC White');
    await save(pa, 2300); const da = await donep(pa);
    await pb.evaluate(() => { window.__confirm = false; }); await save(pb, 2300);
    const db1 = await donep(pb), askB = await pb.evaluate(() => window.__asked.slice()), eB = await err(pb);
    rec('T1: PC A saves first → Saved ✓; PC B (a moment later) is ASKED "already has a cutting list"; Cancel → not saved, no Saved ✓, told in words', !!da && askB.some(m => /ALREADY HAS/.test(m)) && !db1 && /NOT saved/.test(eB) && liveFor(S, 'WO-N1').length === 1, JSON.stringify([da && da.h, askB.map(m => m.slice(0, 60)), db1 && db1.h, eB]));
    rec('T1: …PC B\'s typed row is still on its screen', (await rows(pb)).some(x => x.item === 'B-part' && x.qty === '5'));
    rec('T1: …the one list is PC A\'s, untouched', linesOf(S, liveFor(S, 'WO-N1')[0].id).map(x => x.part).join() === 'A-part');
    await pb.evaluate(() => { window.__confirm = true; }); await closeAll(pa); await closeAll(pb);

    // ---------- T2. both PCs edit the SAME saved list, different rows ----------
    await reload(pa); await reload(pb);
    await pa.evaluate(() => openListEditor('L1')); await pb.evaluate(() => openListEditor('L1')); await sleep(1300);
    await setv(pa, (await idx(pa, 'Top')) + '|qty', '3'); await save(pa, 2300); await wait(pa);
    const ra = await donep(pa); await closeAll(pa);
    await setv(pb, (await idx(pb, 'Hinge')) + '|qty', '10'); await save(pb, 2500); await wait(pb);
    const rb = await donep(pb), eb = await err(pb);
    rec('T2 set-up: PC A changed Top 1 → 3 and saved', !!ra && String(line('L1', 'Top').qty) === '3', JSON.stringify([ra && ra.h, line('L1', 'Top').qty]));
    rec('[HIGH if it fails] T2: PC B (window opened BEFORE A\'s save) changes Hinge 8 → 10 and saves → A\'s Top = 3 is NOT put back to 1 (or B is told and nothing is saved)', String(line('L1', 'Top').qty) === '3' || (!rb && eb.length > 0), JSON.stringify([rb && rb.h, eb, line('L1', 'Top').qty, line('L1', 'Hinge').qty]));
    rec('T2: …and B\'s own change is saved (Hinge = 10) or B is told it was not', String(line('L1', 'Hinge').qty) === '10' || (!rb && eb.length > 0), JSON.stringify([rb && rb.h, eb, line('L1', 'Hinge').qty]));
    await closeAll(pb);

    // ---------- T3. A deletes a row while B (stale) edits that row's note ----------
    await reload(pa); await reload(pb);
    await pa.evaluate(() => openListEditor('L1')); await pb.evaluate(() => openListEditor('L1')); await sleep(1300);
    const iS = await idx(pa, 'Shelf');
    await pa.evaluate(i => { const b = document.querySelector('.me-ed [data-mrx="' + i + '"]'); if (b) b.click(); }, iS); await sleep(300);
    const gone = !(await rows(pa)).some(x => x.item === 'Shelf'); await save(pa, 2300); await wait(pa); await closeAll(pa);
    await setv(pb, (await idx(pb, 'Shelf')) + '|note', 'B wants this'); await save(pb, 2500); await wait(pb);
    const r3 = await donep(pb), e3 = await err(pb), sh = linesOf(S, 'L1').filter(x => x.part === 'Shelf');
    rec('T3 set-up: PC A deleted the Shelf row and saved', gone && true, String(gone));
    rec('(info) T3: PC B then saves a note on the row A deleted → ' + (sh.length ? 'the Shelf row is BACK on the list (B\'s older copy wins; A is not told)' : r3 ? 'the row stays deleted and B sees "Saved ✓" (B\'s note is dropped; B is not told)' : 'B is told: ' + e3), sh.length <= 1 && (!!r3 || e3.length > 0), JSON.stringify([r3 && r3.h, e3, sh.length]));
    rec('T3: …never two Shelf rows, the other rows are all still there once each', sh.length <= 1 && ['Side', 'Top', 'Hinge'].every(n => linesOf(S, 'L1').filter(x => x.part === n).length === 1), JSON.stringify(linesOf(S, 'L1').map(x => x.part)));
    await closeAll(pb);

    // ---------- T4. a project material is renamed on PC A while PC B's window is open ----------
    await reload(pa); await reload(pb);
    await pb.evaluate(() => openListEditor(null, 'WO-N2')); await sleep(1300);
    await fillSaw(pb, 0, 'Door', '2', '715', '396', 'MFC White');
    const nm0 = S.db.t.project_materials.length;
    // PC A: the real Materials window
    await pa.evaluate(() => lsMaterialsDlg('P1')); await sleep(700);
    const ren = await pa.evaluate(async () => { const ov = [...document.querySelectorAll('.pod-ovl')].pop(); const inp = [...ov.querySelectorAll('input')].find(i => i.value === 'MFC White'); if (!inp) return 'no box: ' + [...ov.querySelectorAll('input')].map(i => i.value).join(','); inp.value = '18mm MFC White'; inp.dispatchEvent(new Event('input')); inp.dispatchEvent(new Event('change'));
      const tr = inp.closest('tr') || inp.closest('[data-mid]') || inp.parentElement.parentElement; const sv = [...tr.querySelectorAll('button')].find(b => /save/i.test(b.textContent)); if (!sv) return 'no save: ' + tr.innerText.slice(0, 80); sv.click(); await new Promise(r => setTimeout(r, 1200)); return 'ok'; });
    const m1 = S.db.t.project_materials.find(m => m.id === 'M1') || {};
    rec('T4 set-up: PC A renamed "MFC White" → "18mm MFC White" in the Materials window (old name kept as an other spelling)', m1.name === '18mm MFC White' && (m1.aliases || []).includes('MFC White'), ren + ' ' + JSON.stringify([m1.name, m1.aliases]));
    await closeAll(pa);
    await save(pb, 2600); await wait(pb);
    const d4 = await donep(pb), l4 = liveFor(S, 'WO-N2')[0], ln4 = l4 ? linesOf(S, l4.id)[0] : {};
    rec('T4: PC B (window open since before the rename) saves → Saved ✓, the row is stored under the NEW name, not flagged "not on the project list"', !!d4 && ln4.material === '18mm MFC White' && !ln4.material_other, JSON.stringify([d4 && d4.h, await err(pb), ln4.material, ln4.material_other]));
    rec('T4: …no second material was made for the old name', S.db.t.project_materials.length === nm0 && S.db.t.project_materials.filter(m => /mfc white/i.test(m.name)).length === 1, JSON.stringify(S.db.t.project_materials.map(m => m.name)));
    await closeAll(pb);
    // Manager point 1: lists nobody re-saved keep the old name → saw's "Sheets needed" must count ONE board, not two
    const sw = await X.dev(browser, S, 'saw'), ps = sw.page; await sleep(700);
    const sn = await ps.evaluate(() => { const r = sheetNeed(lists().filter(l => !l.tpl && !l.archived), '', ''); return { mats: r.mats.map(m => m.mat + ':' + m.lines), html: (document.querySelector('.sn-box') || {}).innerText || '' }; });
    const white = sn.mats.filter(m => /mfc white/i.test(m));
    rec('[MEDIUM] T5 (Manager point 1): after the rename, the saw\'s "Sheets needed" shows ONE board for "MFC White" / "18mm MFC White" (lists not re-saved still carry the old name) — sheetNeed()', white.length === 1, JSON.stringify(sn.mats));
    const names = await ps.evaluate(() => { const out = {}; lists().filter(l => !l.tpl && !l.archived).forEach(l => { out[l.id] = [...new Set(lsView(l.id, true).rows.filter(r => r.k === 'saw').map(r => r.mat))]; }); return out; });
    rec('[LOW] T5b: the saw\'s own rows of the list nobody re-saved (L1) show the CURRENT name "18mm MFC White" (it shows the old name until the list is saved again)', (names.L1 || []).every(m => m === '18mm MFC White'), JSON.stringify(names));
    await sw.close();
    // Manager point 3: a save that only re-labels the name must not log a material change nobody made
    await reload(pb); const rev0 = S.db.t.list_revisions.length, l1r = (S.db.t.lists.find(l => l.id === 'L1') || {}).rev;
    await pb.evaluate(() => { window.__prompted = []; window.__prompt = 'note only'; openListEditor('L1'); }); await sleep(1300);
    await setv(pb, (await idx(pb, 'Hinge')) + '|note', 'soft close'); await save(pb, 2600); await wait(pb);
    const d6 = await donep(pb); const revs = S.db.t.list_revisions.slice(rev0), l1 = S.db.t.lists.find(l => l.id === 'L1');
    const lg = JSON.stringify((l1.log || []).slice(-2)) + JSON.stringify(revs).slice(0, 600);
    rec('T6 (Manager point 3): note-only edit after the rename → saved; Side / Top now stored as "18mm MFC White"', !!d6 && line('L1', 'Side').material === '18mm MFC White' && line('L1', 'Top').material === '18mm MFC White', JSON.stringify([d6 && d6.h, await err(pb), line('L1', 'Side').material]));
    await closeAll(pb); await reload(pb);
    const hist = await pb.evaluate(() => { try { const l = lsList('L1'); return JSON.stringify((l.log || []).slice(-3)).slice(0, 500); } catch (e) { return 'ERR ' + e.message; } });
    const chg = await pb.evaluate(async () => { try { const rv = await lsGet('list_revisions?select=*&list_id=eq.L1&order=rev.asc'); return JSON.stringify(rv.slice(-1)).slice(0, 900); } catch (e) { return 'ERR ' + e.message; } });
    rec('(info) T6: what the history keeps for that save (should name the note, not "material changed" on Side / Top)', !/MFC White.*→|material/i.test(hist), hist + ' || ' + chg);

    // ---------- T7. the job is shipped by hand on PC A (Shipped steps release) while PC B's window is open ----------
    await reload(pa); await reload(pb);
    await pb.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-N3'); }); await sleep(1300);
    await fillSaw(pb, 0, 'Late-part', '1', '600', '300', '18mm MFC White');
    await pa.evaluate(() => { window.__confirm = true; stepShipHand(DB.orders.find(x => x.wo === 'WO-N3'), '9. JOB SHIPPED'); const x = DB.orders.find(x => x.wo === 'WO-N4'); x.delv = true; x.delVeh = 'v1'; x.delDay = 'Thu'; x.notes = 'A note'; sched(); }); await pa.evaluate(async () => { await saveDB(); }); await wait(pa);
    rec('T7 set-up: PC A shipped WO-N3 by hand and ticked WO-N4 for delivery; both in the database', !!(S.row.orders.find(x => x.wo === 'WO-N3') || {}).shippedAt && (S.row.orders.find(x => x.wo === 'WO-N4') || {}).delv === true);
    // the lists poll runs on PC B with the window open: typed rows must stay
    await pb.evaluate(async () => { try { await lsPoll(); } catch (e) {} }); await sleep(500);
    rec('T7: the lists refresh on PC B does not close the window or clear the typed row', (await rows(pb)).some(x => x.item === 'Late-part') && await ed(pb));
    await save(pb, 2800); await wait(pb);
    const d7 = await donep(pb), e7 = await err(pb), a7 = await pb.evaluate(() => window.__asked.slice());
    rec('T7: PC B saves its list for the job that was shipped meanwhile → saved (work not lost) or told in words — never silence', (!!d7 && liveFor(S, 'WO-N3').length === 1) || e7.length > 0, JSON.stringify([d7 && d7.h, e7, a7.map(m => m.slice(0, 60))]));
    const n3 = S.row.orders.find(x => x.wo === 'WO-N3') || {}, n4 = S.row.orders.find(x => x.wo === 'WO-N4') || {};
    rec('[CRITICAL if it fails] T7: PC B\'s plan save after its list save does NOT un-ship WO-N3 or undo PC A\'s delivery tick / note (stale plan on B)', !!n3.shippedAt && n3.step === '9. JOB SHIPPED' && n4.delv === true && n4.notes === 'A note', JSON.stringify([n3.step, !!n3.shippedAt, n4.delv, n4.notes]));
    await closeAll(pb);

    // ---------- T8. the OLD screen (live today) ----------
    if (!html) rec('old code readable with git show origin/main', false);
    else {
      // a list made in the NEW window on a P-number, with list name, floor / unit / title, edging 2, bought in, a unit block
      await reload(pb);
      await pb.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, '', 'P1'); }); await sleep(900);
      await setid(pb, 'me-jf', 'Q'); await setid(pb, 'me-ju', '9'); await setid(pb, 'me-jt', 'Q9 KITCHEN — O\'Grady'); await click(pb, 'me-find'); await sleep(600);
      await pb.evaluate(() => { const x = document.getElementById('me-jmkp') || document.getElementById('me-jnone'); if (x) x.click(); }); await sleep(600);
      await setid(pb, 'me-pdue', '2026-12-10'); await setid(pb, 'me-pval', '1500'); await setid(pb, 'me-phrs', '6'); await setid(pb, 'me-name', 'Q9 — kitchen list');
      await fillSaw(pb, 0, 'Q-side', '2', '720', '560', '18mm MFC White'); await setv(pb, '0|edging', 'L2LE 1mm'); await setv(pb, '0|edging2', 'Cap Left'); await setv(pb, '0|note', 'grain up');
      await click(pb, 'me-addsaw'); await sleep(200); await fillSaw(pb, 1, 'Q-top', '1', '1200', '560', '18mm MFC White'); await setv(pb, '1|edging2', 'Cap Right');
      await save(pb, 3000); await wait(pb); const d8 = await donep(pb); await closeAll(pb);
      const pw = (S.row.orders.find(x => /^P-\d+$/.test(x.wo)) || {}).wo || '', pl = liveFor(S, pw)[0];
      rec('O set-up: new-window list on a P-number saved', !!d8 && !!pl, JSON.stringify([d8 && d8.h, pw]));
      const before = pl ? JSON.parse(JSON.stringify({ l: S.db.t.lists.find(l => l.id === pl.id), ln: linesOf(S, pl.id), job: S.row.orders.find(x => x.wo === pw) })) : {};
      const old = await A.openOld(browser, S, html);
      await old.page.evaluate(async () => { try { await loadDB(); if (typeof lsReset === 'function') lsReset(); if (typeof lsLoad === 'function') await lsLoad(); render(); } catch (e) {} }); await sleep(1200);
      const isOld = await old.page.evaluate(() => ({ v2: typeof V2 === 'function' && V2(), hasNew: typeof keyFind === 'function', ship: typeof stepShipHand === 'function' }));
      rec('O set-up: the old screen is the LIVE version (Shipped steps in, list window not)', isOld.v2 && isOld.ship && !isOld.hasNew, JSON.stringify(isOld));
      // O1: plan save from the old screen
      await old.page.evaluate(async () => { const x = DB.orders.find(x => x.wo === 'WO-N5'); x.notes = 'old screen note'; try { sched(); } catch (e) {} await saveDB(); await new Promise(r => setTimeout(r, 1500)); });
      const pj = S.row.orders.find(x => x.wo === pw) || {};
      rec('O1: old screen saves the plan → the P-number job is still there with its Floor, Unit, Title and project', pj.floor === before.job.floor && pj.unit === before.job.unit && pj.title === before.job.title && pj.pid === before.job.pid && pj.step === before.job.step, JSON.stringify(pj).slice(0, 300));
      rec('O1: …the old screen\'s own edit landed too', (S.row.orders.find(x => x.wo === 'WO-N5') || {}).notes === 'old screen note');
      // O2: the old screen edits the new window's list and saves
      const oe = await old.page.evaluate(async id => { try { window.prompt = () => 'old tab edit'; openListEditor(id); await new Promise(r => setTimeout(r, 1500)); const q = s => document.querySelector('.me-ed [data-mr="' + s + '"]'); if (!q('0|qty')) return 'no editor / rows: ' + ((document.querySelector('.me-ed') || {}).innerText || '').slice(0, 200);
        const got = { name: (document.getElementById('me-name') || {}).value, wo: (document.getElementById('me-wo') || {}).value, item: q('0|item').value, e2: q('0|edging2') ? q('0|edging2').value : '(no Edging 2 box)', note: q('0|note').value };
        const e = q('0|qty'); e.value = '6'; e.dispatchEvent(new Event('input')); document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 3000)); return JSON.stringify([got, (document.getElementById('me-err') || {}).textContent || '', !!document.querySelector('.me-dov')]); } catch (e) { return 'ERR ' + e.message; } }, pl.id);
      const al = S.db.t.lists.find(l => l.id === pl.id), aln = linesOf(S, pl.id), s0 = aln.find(x => x.part === 'Q-side') || {}, s1 = aln.find(x => x.part === 'Q-top') || {};
      rec('O2 set-up: the old screen opened the list and saved Q-side qty 2 → 6', String(s0.qty) === '6', oe);
      rec('[HIGH if it fails] O2: after the old screen\'s save the list keeps its name and its P-number', al.name === before.l.name && JSON.stringify(al.wos) === JSON.stringify(before.l.wos) && !al.archived, JSON.stringify([al.name, al.wos, al.archived]));
      rec('[HIGH if it fails] O2: …Edging 2 (Cap Left / Cap Right — the HANDING) survives the old screen\'s save on both rows', s0.edging2 === 'Cap Left' && s1.edging2 === 'Cap Right', JSON.stringify(aln.map(x => [x.part, x.edging, x.edging2, x.note])));
      rec('O2: …Edging 1, note, sizes and material of both rows are as they were', s0.edging === 'L2LE 1mm' && s0.note === 'grain up' && s0.material === '18mm MFC White' && +s1.length_mm === 1200 && aln.length === before.ln.length, JSON.stringify(aln.map(x => [x.part, x.edging, x.note, x.material, x.length_mm])));
      const pj2 = S.row.orders.find(x => x.wo === pw) || {};
      rec('O2: …and the P-number job still has Floor / Unit / Title', pj2.floor === 'Q' && pj2.unit === '9' && pj2.title === before.job.title, JSON.stringify([pj2.floor, pj2.unit, pj2.title]));
      // O3: the new screen after the old screen's save: opens cleanly, shows name / job
      await reload(pb); await pb.evaluate(id => openListEditor(id), pl.id); await sleep(1300);
      const j8 = await job(pb), nm8 = await pb.evaluate(() => document.getElementById('me-name').value), r8 = await rows(pb);
      rec('O3: the new window opens that list afterwards: P-number in the title bar, list name, 2 rows', j8.hwo === pw && nm8 === 'Q9 — kitchen list' && r8.filter(x => x.item).length === 2, JSON.stringify([j8.hwo, nm8, r8.map(x => x.item)]));
      await closeAll(pb);
      // O4: the old screen makes a new list for a job from its own window
      const om = await old.page.evaluate(async () => { try { openListEditor(null, 'WO-N6'); await new Promise(r => setTimeout(r, 1200)); const q = s => document.querySelector('.me-ed [data-mr="' + s + '"]'); const set = (k, v) => { const e = q(k); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); };
        const nm = (document.getElementById('me-name') || {}).value; set('0|item', 'Old-side'); set('0|qty', '2'); set('0|L', '720'); set('0|W', '560'); set('0|mat', '18mm MFC White'); document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2800)); return JSON.stringify([nm, (document.getElementById('me-err') || {}).textContent || '']); } catch (e) { return 'ERR ' + e.message; } });
      const l6 = liveFor(S, 'WO-N6');
      rec('O4: a list made on the OLD screen for WO-N6 is saved once', l6.length === 1, om);
      await reload(pb); await pb.evaluate(id => openListEditor(id), (l6[0] || {}).id); await sleep(1300);
      const j9 = await job(pb), r9 = await rows(pb);
      rec('O4: …and the NEW window opens it: WO-N6 in the title bar, Floor N · Unit 6 shown, the row there', j9.hwo === 'WO-N6' && /N/.test(j9.info) && /6/.test(j9.info) && r9.some(x => x.item === 'Old-side'), JSON.stringify([j9.hwo, j9.info, r9.map(x => x.item)]));
      await setv(pb, '0|qty', '3'); await pb.evaluate(() => { window.__prompt = 'qty'; }); await save(pb, 2600); const d9 = await donep(pb);
      rec('O4: …a change saved from the new window lands on the same list (no second list)', !!d9 && liveFor(S, 'WO-N6').length === 1 && String(linesOf(S, l6[0].id)[0].qty) === '3', JSON.stringify([d9 && d9.h, await err(pb)]));
      await closeAll(pb);
      rec('no page errors on the old screen', !(S.oldErrors || []).length, (S.oldErrors || []).join(' | ').slice(0, 300));
    }
    rec('no page errors on the new screens', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
