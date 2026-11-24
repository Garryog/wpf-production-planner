// Tester attack (list window, 12 Nov): OLD saved data and an OLD screen left open.
//  1. lists saved before this layout (odd / missing fields) open in the new window and save again without losing anything;
//  2. a screen still running the PREVIOUS version (the commit before the new layout, and what is on main) is left open while the
//     new window saves a list (and a P-number job) — then the old screen saves the plan. Is the list / the job still there?
// Fake Supabase only; old code is read with "git show" (read-only). Run: node tests/list-window/attack1-oldscreen.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ================= 1. old saved data =================
    {
      const S = X.makeServer(X.v2Row());
      const ins = (id, list, lines) => { D.insert(S.db, 'lists', Object.assign({ id, project_id: 'P1', name: 'Old ' + id, wos: ['WO-3'], n_saw: 1, n_fit: 0, created_at: '2026-10-01T08:00:00.000Z' }, list));
        lines.forEach((x, i) => D.insert(S.db, 'list_lines', Object.assign({ id: id + ':' + (i + 1), list_id: id, seq: i + 1 }, x))); };
      // the oldest shape: no type, no edging2, quantity as a number, null note / material, a section instead of headings
      ins('O1', { wos: ['WO-3'], type_name: null, source: 'migrated' }, [{ kind: 'saw', part: 'Side', qty: 2, length_mm: 720, width_mm: 560, material: 'MFC White', edging: '1mm ABS', note: null, section: 'Carcass' }, { kind: 'fit', part: 'Hinge', qty: 8, length_mm: null, width_mm: null, material: null, edging: null, note: null }]);
      // a list whose project was set inactive, whose WO is no longer in the planner, with a bought-in row and a unit block
      D.insert(S.db, 'projects', { id: 'P5', name: 'Closed site', customer: 'Closed Ltd', cien_names: ['Closed Ltd'], active: false });
      ins('O2', { project_id: 'P5', wos: ['WO-GONE'], name: 'Gone job' }, [{ kind: 'hdr', part: 'Robe 900', qty: '2' }, { kind: 'saw', part: 'Shelf', qty: '4', unit_qty: '2', length_mm: 860, width_mm: 500, material: 'Odd Oak' }, { kind: 'buy', part: 'Fridge', qty: '1' }]);
      // two work orders on one list (the old "+ WO"), and a list with wos null
      ins('O3', { wos: ['WO-3', 'WO-4'], name: 'Two WOs' }, [{ kind: 'saw', part: 'Top', qty: '1', length_mm: 1200, width_mm: 560, material: 'MFC White' }]);
      ins('O4', { wos: [], name: 'No work order', source: 'excel' }, [{ kind: 'fit', part: 'Tap', qty: '1' }]);
      const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
      for (const [id, what, wo] of [['O1', 'oldest shape (no type, numbers, nulls, a section)', 'WO-3'], ['O2', 'inactive project + WO no longer in the planner + unit block + bought-in', 'WO-GONE'], ['O3', 'TWO work orders on one list', 'WO-3'], ['O4', 'no work order (from an Excel upload)', null]]) {
        const before = snap(S, id), nl = linesOf(S, id).length;
        await p.evaluate(id => openListEditor(id), id); await sleep(900);
        const j = await job(p), rs = await rows(p);
        rec(id + ' ' + what + ': opens in the new window with all its rows (' + nl + ')', j.open && rs.length === nl, JSON.stringify([j.title.replace(/\n/g, ' '), rs.map(r => r.item + ':' + r.qty)]));
        rec(id + ': title bar WO = ' + JSON.stringify(wo) + (wo ? ' and the folded picker holds the same' : ' → the pickers are shown'), wo ? j.hwo === wo && j.wo === wo : !j.hwo && j.woHidden === false, JSON.stringify([j.hwo, j.wo, j.woHidden]));
        // close untouched: no question, nothing written
        await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(300);
        rec(id + ': opened and closed untouched → no "Close without saving?", nothing changed in the database', !(await ed(p)) && !(await p.evaluate(() => window.__asked.length)) && snap(S, id) === before, JSON.stringify(await p.evaluate(() => window.__asked)));
        await closeAll(p); await p.evaluate(() => { window.__confirm = true; window.__prompt = 'tidy'; });
        // change one note and Save: everything else stays as it was
        await p.evaluate(id => openListEditor(id), id); await sleep(900);
        const li = rs.findIndex(r => !r.hdr);
        await setv(p, li + '|note', 'touched'); await save(p, 2500);
        const dn = await donep(p), l = S.db.t.lists.find(x => x.id === id), ls = linesOf(S, id);
        const b = JSON.parse(before);
        rec(id + ': one note changed + Save → saved; same work orders (' + JSON.stringify(b[0].wos) + '), same project, same number of rows', !!dn && JSON.stringify(l.wos || null) === JSON.stringify(b[0].wos || null) && l.project_id === b[0].project_id && ls.length === nl, JSON.stringify([dn && dn.h, l.wos, l.project_id, ls.length, await err(p)]));
        const same = b[1].filter(x => x.removed_rev == null).every(o => { const n = ls.find(x => x.id === o.id); return n && n.part === o.part && String(n.qty) === String(o.qty) && n.kind === o.kind && (n.material || null) === (o.material || null) && (n.length_mm || null) === (o.length_mm || null); });
        rec(id + ': …every row keeps its line id, kind, description, quantity, size and material', same, JSON.stringify(ls.map(x => [x.id, x.kind, x.part, x.qty, x.material].join('|'))));
        await closeAll(p);
      }
      // an old "saving…" note left on the device by the previous layout (fewer fields)
      await p.evaluate(() => { const k = Object.keys(localStorage).find(k => /pend/i.test(k)); window.__pk = k || null; });
      await p.evaluate(() => { try { lsPendSet({ id: 'LOLDPEND', wo: 'WO-6', name: 'Half saved', rows: [{ k: 'saw', item: 'Old-shape row', qty: 1, L: 500, W: 300, mat: 'MFC White', note: '' }], state: 'not' }); } catch (e) { window.__pe = String(e); } });
      await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, 'WO-6'); }); await sleep(900);
      const pe = await p.evaluate(() => ({ asked: window.__asked.slice(), ed: !!document.querySelector('.me-ed'), err: window.__pe || '' }));
      const pr = pe.ed ? await rows(p) : [];
      rec('a "was being saved" note from before (old row shape k:"saw", numbers): offered again, opens with its row, WO-6 in the title bar', pe.asked.some(m => /You were saving/.test(m)) && pe.ed && pr.some(r => r.item === 'Old-shape row') && (await job(p)).hwo === 'WO-6', JSON.stringify([pe, pr]));
      await closeAll(p);
      rec('old data: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // ================= 2. an old screen left open =================
    for (const [label, ref] of [['the version just before this layout (HEAD~1)', 'HEAD~1'], ['main', 'main']]) {
      const html = A.gitShow(ref);
      if (!html) { rec('old screen (' + label + '): old code could be read with git show', false, ref); continue; }
      const S = X.makeServer(X.v2Row());
      const old = await A.openOld(browser, S, html);
      const v2old = await old.page.evaluate(async () => { try { if (typeof lsLoad === 'function') { if (typeof lsReset === 'function') lsReset(); await lsLoad(); } } catch (e) {} return { v2: typeof V2 === 'function' ? V2() : null, n: DB.orders.length }; });
      const nw = await X.dev(browser, S, 'office'), p = nw.page; await asks(p);
      // the NEW window saves a list for WO-3 and a P-number job with a list
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
      await fillSaw(p, 0, 'New window row', '2', '720', '560', 'MFC White'); await save(p, 2000);
      await closeAll(p);
      await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(500);
      await setid(p, 'me-jf', 'T40'); await setid(p, 'me-ju', '9'); await setid(p, 'me-jt', 'HOUSE 9'); await click(p, 'me-find'); await sleep(400); await click(p, 'me-jmkp'); await sleep(400);
      await setid(p, 'me-pdue', '2026-12-10'); await setv(p, '0|item', 'Tap'); await setv(p, '0|qty', '1'); await save(p, 2500); await closeAll(p);
      await p.evaluate(async () => { for (let i = 0; i < 40 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(1200);
      const pjob = S.row.orders.find(o => /^P-\d+$/.test(o.wo));
      const id3 = (liveFor(S, 'WO-3')[0] || {}).id, s3 = id3 ? snap(S, id3) : '';
      rec(label + ': set-up — the new window saved a list on WO-3 and a P-number job (' + (pjob && pjob.wo) + ') with its list', !!id3 && !!pjob && liveFor(S, pjob.wo).length === 1, JSON.stringify([id3, pjob && pjob.wo, v2old]));
      // the OLD screen (open since before) changes a note on another job and saves the plan
      const sv = await old.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-2'); o.notes = 'typed on the old screen'; try { if (typeof sched === 'function') sched(); } catch (e) {} await saveDB(); await new Promise(r => setTimeout(r, 1500)); return { failed: !!DB.saveFailed, n: DB.orders.length, hasP: DB.orders.some(x => /^P-\d+$/.test(x.wo)) }; });
      await sleep(800);
      rec(label + ': the old screen\'s save went through and its note is in the plan', (S.row.orders.find(o => o.wo === 'WO-2') || {}).notes === 'typed on the old screen', JSON.stringify(sv));
      rec(label + ': the list saved from the new window is still there, unchanged (WO-3)', !!id3 && snap(S, id3) === s3 && liveFor(S, 'WO-3').length === 1);
      rec(label + ': the P-number JOB made by the new window is still in the plan after the old screen saved', !!pjob && S.row.orders.some(o => o.wo === pjob.wo), JSON.stringify(S.row.orders.map(o => o.wo)));
      rec(label + ': …and its list is still live on it', !!pjob && liveFor(S, pjob.wo).length === 1);
      rec(label + ': the cutting lists are still switched ON after the old screen saved (listStore v2)', S.row.settings.listStore === 'v2', S.row.settings.listStore);
      // the old screen opens the list the new window made, changes a quantity and saves it → the new screen opens it again
      const oe = await old.page.evaluate(async id => { try { if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } openListEditor(id); await new Promise(r => setTimeout(r, 900)); const e = document.querySelector('.me-ed [data-mr="0|qty"]'); if (!e) return 'old screen could not open the list'; e.value = '5'; e.dispatchEvent(new Event('input')); document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2000)); return 'ok ' + ((document.getElementById('me-err') || {}).textContent || ''); } catch (e) { return 'error ' + e.message; } }, id3);
      const q = id3 && linesOf(S, id3).find(x => x.part === 'New window row');
      rec(label + ': the OLD screen can open the new window\'s list, change the quantity to 5 and save it', /^ok/.test(oe) && q && String(q.qty) === '5', JSON.stringify([oe, q && q.qty]));
      await p.evaluate(async id => { lsReset(); await lsLoad(); openListEditor(id); }, id3); await sleep(900);
      const j = await job(p), rs = await rows(p);
      rec(label + ': …and the new window opens it again afterwards: WO-3 in the title bar, the row with qty ' + (q ? q.qty : '?'), j.hwo === 'WO-3' && rs.some(r => r.item === 'New window row' && r.qty === String(q ? q.qty : '')), JSON.stringify([j.hwo, rs]));
      await closeAll(p);
      rec(label + ': no page errors on the new screen', !(S.errors || []).length, JSON.stringify(S.errors));
      rec(label + ': no page errors on the old screen', !(S.oldErrors || []).length, JSON.stringify(S.oldErrors));
      await old.close(); await nw.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
