// Tester attack 2 (list window, 12 Nov evening): TWO PCs at once, and an OLD screen (today's live code, origin/main) left open.
// Goes past attack 1: the person answers CANCEL to "save a second list?", archive-while-editing, two PCs making the same new
// customer's project, two PCs making a P-number for the same house, and an old screen editing / re-saving what the new window made.
// Fake Supabase only; the old code is read with "git show origin/main:index.html" (read-only). Run: node tests/list-window/attack2-two-pcs.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;

function row() {
  const r = X.v2Row();
  for (let i = 80; i < 90; i++) r.orders.push(H.order({ wo: 'WO-' + i, customer: 'Aderrig Homes', floor: 'T12', unit: String(i), title: 'HOUSE ' + i, dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  r.orders.push(H.order({ wo: 'WO-NEWC1', customer: 'Brand New Builders', floor: '1', unit: '1', title: 'KITCHEN', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  r.orders.push(H.order({ wo: 'WO-NEWC2', customer: 'Brand New Builders', floor: '1', unit: '2', title: 'KITCHEN', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  r.settings.pMerged = [{ at: '2026-10-19T10:00:00Z', by: 'Seed', wo: 'P-0999', into: 'WO-80', why: 'seeded safety copy', job: { wo: 'P-0999', title: 'kept copy' } }];
  return r;
}
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(800); };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    const a = await X.dev(browser, S, 'design'), b = await X.dev(browser, S, 'office');
    const pa = a.page, pb = b.page; await asks(pa); await asks(pb);

    // ---- T1. A saves first; B (window open since before) presses Save and answers CANCEL to "save a second list?"
    await pa.evaluate(() => openListEditor(null, 'WO-80')); await pb.evaluate(() => openListEditor(null, 'WO-80')); await sleep(900);
    await fillSaw(pa, 0, 'A side', '2', '720', '560', 'MFC White'); await fillSaw(pb, 0, 'B side', '3', '700', '500', 'MFC White');
    await save(pa, 2000);
    await pb.evaluate(() => { window.__asked = []; window.__confirm = m => !/ALREADY HAS a cutting list/.test(m); });
    await save(pb, 2500);
    const qb = await pb.evaluate(() => window.__asked.slice());
    rec('T1. B saves after A: B is ASKED "WO-80 ALREADY HAS a cutting list … save a second?"', qb.some(m => /ALREADY HAS a cutting list/.test(m)), JSON.stringify(qb));
    rec('T1. …B answers Cancel → still ONE live list on WO-80 (A\'s)', liveFor(S, 'WO-80').length === 1 && linesOf(S, liveFor(S, 'WO-80')[0].id).some(x => x.part === 'A side'), JSON.stringify(liveFor(S, 'WO-80').map(l => l.id)));
    rec('T1. …B\'s window stays open with B\'s row, and B is told nothing was saved', await ed(pb) && (await rows(pb)).some(r => r.item === 'B side') && !(await donep(pb)) && (await err(pb)).length > 0, JSON.stringify([await err(pb), await donep(pb)]));
    rec('(info) T1. the second-list question: OK (= Enter, the browser default) is the DANGEROUS answer "yes, save a second list"', true, qb.join(' || ').slice(0, 300));
    await pb.evaluate(() => { window.__confirm = true; }); await closeAll(pa); await closeAll(pb);

    // ---- T2. A archives the list while B is editing it; B saves
    const id80 = liveFor(S, 'WO-80')[0].id;
    await pb.evaluate(async id => { lsReset(); await lsLoad(); openListEditor(id); }, id80); await sleep(1200);
    await setv(pb, '0|note', 'B note after archive');
    await pa.evaluate(async id => { lsReset(); await lsLoad(); const l = lsList(id); listArchive(l, 'A'); if (typeof lqSend === 'function') await lqSend(); }, id80); await sleep(1500);
    const arch = S.db.t.lists.find(l => l.id === id80).archived;
    await pb.evaluate(() => { window.__asked = []; }); await save(pb, 2500);
    const l80 = S.db.t.lists.find(l => l.id === id80), eb2 = await err(pb), db2 = await donep(pb);
    rec('T2. set-up: A archived the list (off the saw)', arch === true, String(arch));
    rec('T2. B saves an edit to the list A just archived → it does NOT silently come back onto the saw', l80.archived === true || (await pb.evaluate(() => window.__asked.length)) > 0, JSON.stringify({ archived: l80.archived, eb2, db2: db2 && db2.h, asked: await pb.evaluate(() => window.__asked) }));
    rec('T2. …and B is told what happened (archived on another PC), not a plain "Saved ✓ — list is with the Saw & Stores"', !(db2 && /with the Saw/.test(db2.h) && l80.archived) && (eb2.length > 0 || !!db2), JSON.stringify({ eb2, db2: db2 && db2.h, archived: l80.archived }));
    rec('(info) T2. B\'s note after A archived', true, JSON.stringify(linesOf(S, id80).map(x => x.note)));
    await closeAll(pa); await closeAll(pb);

    // ---- T3. two PCs open a list for jobs of a customer with NO project yet, at the same moment → one project
    const np0 = S.db.t.projects.length;
    await Promise.all([pa.evaluate(() => openListEditor(null, 'WO-NEWC1')), pb.evaluate(() => openListEditor(null, 'WO-NEWC2'))]); await sleep(2500);
    const ps = S.db.t.projects.filter(p => /Brand New/i.test(p.name));
    rec('T3. two PCs open lists for "Brand New Builders" (no project yet) at the same moment → exactly ONE project made', ps.length === 1 && S.db.t.projects.length === np0 + 1, JSON.stringify(S.db.t.projects.map(p => p.id + ':' + p.name)));
    const ja = await job(pa), jb = await job(pb);
    rec('T3. …both windows use that project', ps[0] && ja.pid === ps[0].id && jb.pid === ps[0].id, JSON.stringify([ja.pid, jb.pid, ja.pm, jb.pm]));
    await fillSaw(pa, 0, 'K1', '1', '600', '500', ''); await fillSaw(pb, 0, 'K2', '1', '600', '500', '');
    await save(pa, 2000); await save(pb, 2000);
    rec('T3. …both lists save onto the one project', liveFor(S, 'WO-NEWC1').length === 1 && liveFor(S, 'WO-NEWC2').length === 1 && [...liveFor(S, 'WO-NEWC1'), ...liveFor(S, 'WO-NEWC2')].every(l => ps[0] && l.project_id === ps[0].id), JSON.stringify([await err(pa), await err(pb)]));
    await closeAll(pa); await closeAll(pb);

    // ---- T4. two PCs make a P-number for the SAME house (no Cienapps WO) a moment apart
    const mkP = async (p, item) => {
      await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(700);
      await setid(p, 'me-jf', 'T77'); await setid(p, 'me-ju', '5'); await setid(p, 'me-jt', 'HOUSE 5 KITCHEN'); await click(p, 'me-find'); await sleep(500); await click(p, 'me-jmkp'); await sleep(500);
      await fillSaw(p, 0, item, '1', '600', '500', 'MFC White'); await setid(p, 'me-pdue', '2026-12-10'); // (due typed LAST: picking a material wipes it — see attack2-match)
    };
    await mkP(pa, 'PA row'); await mkP(pb, 'PB row');
    await save(pa, 2500); await wait(pa);
    await save(pb, 2500); await wait(pb);
    const pj = S.row.orders.filter(o => /^P-\d+$/.test(o.wo) && String(o.floor) === 'T77');
    const eb4 = await err(pb), db4 = await donep(pb), qa4 = await pb.evaluate(() => window.__asked.slice(-3));
    rec('T4. two PCs make a P-number for Floor T77 · Unit 5 one after the other → ONE job for that house (the second is pointed at the first)', pj.length === 1, JSON.stringify({ jobs: pj.map(o => o.wo), eb4, db4: db4 && db4.h, qa4 }));
    const lp = pj.flatMap(o => liveFor(S, o.wo));
    rec('T4. …and that house has ONE live list (or the second person was asked and chose)', lp.length === 1 || qa4.some(m => /ALREADY HAS|already exists/.test(m)), JSON.stringify(lp.map(l => l.wos[0] + ':' + l.name)));
    await closeAll(pa); await closeAll(pb);
    rec('two PCs: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await b.close();
  } catch (e) { rec('two PCs: test ran to the end', false, e.stack); }

  // =================== OLD screen (origin/main) left open ===================
  try {
    const html = A.gitShow('origin/main');
    if (!html) rec('old screen: origin/main could be read', false);
    else {
      const S = X.makeServer(row());
      const old = await A.openOld(browser, S, html);
      await old.page.evaluate(async () => { try { if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } } catch (e) {} });
      const nw = await X.dev(browser, S, 'design'), p = nw.page; await asks(p);
      // the new window makes a list with: blank name, a heading, a unit block ×2, a material NOT on the project (flagged), a Bought-in row
      await p.evaluate(() => { window.__prompt = null; openListEditor(null, 'WO-81'); }); await sleep(1000);
      await p.evaluate(() => { const b = document.getElementById('me-units'); if (b) { b.checked = true; b.dispatchEvent(new Event('change')); } }); await sleep(200);
      await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White');
      await setv(p, '0|note', 'note <b>O\'Grady</b>');
      await click(p, 'me-addsaw'); await sleep(200);
      await fillSaw(p, 1, 'Odd shelf', '1', '400', '300', 'MFC White');
      await click(p, 'me-addsaw'); await sleep(200);
      await setv(p, '2|item', 'Hob'); await setv(p, '2|qty', '1');
      await save(p, 2500);
      const dn = await donep(p), l81 = liveFor(S, 'WO-81')[0];
      rec('old screen set-up: the new window saved a list on WO-81 (blank name, 3 rows)', !!dn && !!l81, JSON.stringify([dn && dn.h, await err(p), l81 && l81.name]));
      await closeAll(p);
      if (l81) {
        const before = linesOf(S, l81.id).map(x => ({ id: x.id, kind: x.kind, part: x.part, qty: String(x.qty), mat: x.material, mo: !!x.material_other, note: x.note, uq: x.unit_qty }));
        rec('(info) what the new window stored', true, JSON.stringify([l81.name, before]));
        // the OLD screen shows it on its Lists tab without errors and edits ONE note
        const o1 = await old.page.evaluate(async id => { try { lsReset(); await lsLoad(); showTab('l'); await new Promise(r => setTimeout(r, 600)); const shown = document.body.innerText.includes('WO-81');
          openListEditor(id); await new Promise(r => setTimeout(r, 1200)); const e = document.querySelector('.me-ed [data-mr="2|note"]') || document.querySelector('.me-ed [data-mr$="|note"]'); if (!e) return { shown, err: 'no note box' };
          e.value = 'old screen note'; e.dispatchEvent(new Event('input')); document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2500));
          return { shown, msg: (document.getElementById('me-err') || {}).textContent || '', done: !!document.querySelector('.me-dov') }; } catch (x) { return { err: x.message }; } }, l81.id);
        await sleep(800);
        const after = linesOf(S, l81.id).map(x => ({ id: x.id, kind: x.kind, part: x.part, qty: String(x.qty), mat: x.material, mo: !!x.material_other, note: x.note, uq: x.unit_qty }));
        rec('old screen: shows the new window\'s list on its Cutting Lists tab', o1.shown === true, JSON.stringify(o1));
        rec('old screen: edits one note on it and saves', !o1.err && after.some(x => x.note === 'old screen note'), JSON.stringify([o1, after.map(x => x.note)]));
        const same = before.every(bf => { const af = after.find(x => x.part === bf.part && x.kind === bf.kind); return af && af.qty === bf.qty && af.mat === bf.mat && af.mo === bf.mo && String(af.uq == null ? '' : af.uq) === String(bf.uq == null ? '' : bf.uq); });
        rec('old screen: …every row keeps its kind, quantity, material, "not on the project list" flag and per-unit quantity', same && after.length === before.length, JSON.stringify(after));
        rec('old screen: …the list keeps its name and WO', (S.db.t.lists.find(l => l.id === l81.id) || {}).name === l81.name && JSON.stringify(S.db.t.lists.find(l => l.id === l81.id).wos) === '["WO-81"]');
        rec('old screen: …the note with <b>HTML</b> and O\'Grady is unchanged text', after.some(x => x.note === 'note <b>O\'Grady</b>'), JSON.stringify(after.map(x => x.note)));
        // the new window opens it again cleanly
        await p.evaluate(async id => { lsReset(); await lsLoad(); openListEditor(id); }, l81.id); await sleep(1200);
        const j = await job(p), rs = await rows(p);
        rec('new window opens it again after the old screen\'s save: WO-81 in the title bar, all rows', j.hwo === 'WO-81' && rs.filter(r => !r.hdr).length === before.filter(x => x.kind !== 'hdr').length, JSON.stringify([j.hwo, rs]));
        await closeAll(p);
      }
      // the OLD screen saves the planner record: the safety copies (settings.pMerged) and the P-number job's project must survive
      await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(700);
      await setid(p, 'me-jf', 'T88'); await setid(p, 'me-ju', '3'); await setid(p, 'me-jt', 'HOUSE 3'); await click(p, 'me-find'); await sleep(400); await click(p, 'me-jmkp'); await sleep(400);
      await fillSaw(p, 0, 'P row', '1', '600', '500', 'MFC White'); await setid(p, 'me-pdue', '2026-12-11'); await save(p, 2500); await closeAll(p); await wait(p);
      const pjob = S.row.orders.find(o => /^P-\d+$/.test(o.wo) && o.floor === 'T88');
      rec('old screen set-up: P-number job made for T88 · 3 with pid ' + (pjob && pjob.pid), !!pjob, JSON.stringify(pjob && { wo: pjob.wo, pid: pjob.pid }));
      const pm0 = JSON.stringify(S.row.settings.pMerged || null);
      const sv = await old.page.evaluate(async () => { try { await loadDB(); const o = DB.orders.find(x => x.wo === 'WO-82'); o.notes = 'old screen plan note'; if (typeof sched === 'function') sched(); await saveDB(); await new Promise(r => setTimeout(r, 2000)); return 'ok'; } catch (e) { return e.message; } });
      await sleep(800);
      rec('old screen: its plan save went through', (S.row.orders.find(o => o.wo === 'WO-82') || {}).notes === 'old screen plan note', sv);
      const pj2 = pjob && S.row.orders.find(o => o.wo === pjob.wo);
      rec('old screen saved the plan → the P-number job keeps its project link (pid) and Floor / Unit', !!pj2 && pj2.pid === pjob.pid && pj2.floor === 'T88' && String(pj2.unit) === '3', JSON.stringify(pj2 && { pid: pj2.pid, floor: pj2.floor, unit: pj2.unit }));
      rec('old screen saved the plan → the P-number safety copies (settings.pMerged — "a copy is kept") are still in the database', JSON.stringify(S.row.settings.pMerged || null) === pm0 && pm0 !== 'null', JSON.stringify({ before: pm0.slice(0, 80), after: JSON.stringify(S.row.settings.pMerged || null).slice(0, 80) }));
      // a FRESH new-version screen (a PC switched on after the old screen saved) saves: is the safety copy still anywhere?
      const fr = await X.dev(browser, S, 'office');
      await fr.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-84'); o.notes = 'fresh screen note'; sched(); await saveDB(); }); await wait(fr.page);
      rec('old screen then a FRESH new screen saves → settings.pMerged (the P-number safety copies) still in the database', JSON.stringify(S.row.settings.pMerged || null) === pm0, JSON.stringify(S.row.settings.pMerged || null).slice(0, 120));
      await fr.close();
      // the new screen saves next: does it bring pMerged back?
      await p.evaluate(async () => { await loadDB(); const o = DB.orders.find(x => x.wo === 'WO-83'); o.notes = 'new screen note'; sched(); await saveDB(); }); await wait(p);
      rec('(info) after the next NEW-screen save, settings.pMerged is', true, JSON.stringify(S.row.settings.pMerged || null).slice(0, 120));
      rec('old screen: no page errors (new screen)', !(S.errors || []).length, JSON.stringify(S.errors));
      rec('old screen: no page errors (old screen)', !(S.oldErrors || []).length, JSON.stringify(S.oldErrors));
      await old.close(); await nw.close();
    }
  } catch (e) { rec('old screen: test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
