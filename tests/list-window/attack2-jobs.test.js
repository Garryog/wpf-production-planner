// Tester attack ROUND 2 (list window, 12 Nov): the release's job scenarios end to end, through the REAL Cienapps import
// (doImport → applyImport → save), where round 1 only pushed orders into the fake database.
//  A. customer renamed in Cienapps AND a new WO for it in the same import → same project, no second project, old lists attached
//  B. the same unit number in different blocks — opened FROM the job; no false "already has a list" / same-house warnings
//  C. two jobs with blank floor AND unit on one project — never treated as "the same house"
//  D. P-number made, then the Cienapps import brings the real WO (no auto-merge in this release): nothing lost or damaged,
//     the page says a Cienapps WO now exists; a P-number in ANOTHER block is not flagged
// Fake Supabase only. Run: node tests/list-window/attack2-jobs.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const HDR = ['WO # ', 'Title', 'Customer ', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor ', 'Unit'];
const SER = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse('1899-12-30T00:00:00Z')) / 864e5);
const projs = S => S.db.t.projects.map(x => x.name);
const waitSave = p => p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); });
const doImp = async (p, rowsAoa) => {
  const r = await H.importAoa(p, [HDR].concat(rowsAoa));
  const ap = await p.evaluate(async () => { if (!IMPPLAN) return 'no plan'; applyImport(IMPPLAN); try { sched && sched(); } catch (e) {} await saveDB(); return 'ok'; });
  await sleep(800); await waitSave(p);
  await p.evaluate(async () => { lsReset(); await lsLoad(); }); await sleep(300);
  return { plan: r.plan, ap, prev: r.iprev };
};
const flagTxt = p => p.evaluate(async () => { showTab('l'); await new Promise(r => setTimeout(r, 500)); return [...document.querySelectorAll('.p-flag')].map(x => x.innerText.replace(/\s+/g, ' ')); });
function row() {
  const r = X.v2Row(), o = (wo, floor, unit, title, c) => H.order({ wo, customer: c || 'Aderrig Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30' });
  r.orders.push(o('WO-S1', 'Block A', '12', 'APT 12 KITCHEN'), o('WO-S2', 'Block B', '12', 'APT 12 KITCHEN'), o('WO-S3', '1', '12', 'APT 12 KITCHEN'),
    o('WO-B3', '', '', 'MISC PANELS'), o('WO-B4', '', '', 'MISC PANELS 2'), o('WO-B5', '', '', 'HOUSE 5 KITCHEN'), o('WO-B6', '', '', 'HOUSE 5 KITCHEN'));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    const P0 = projs(S).slice(), L1 = snap(S, 'L1');

    // ===== A. customer renamed + a NEW WO for the renamed customer, one real import =====
    let im = await doImp(p, [
      ['WO-3', 'HOUSE TYPE C', 'ADERRIG HOMES LIMITED', SER('2026-12-03'), '3. In production', 5000, '', 'T09', '13'],
      ['WO-9', 'HOUSE TYPE E', 'ADERRIG HOMES LIMITED', SER('2026-12-17'), '3. In production', 6000, '', 'T09', '15'],
      ['WO-10', 'HOUSE TYPE F', 'Aderrig Homes Ltd (Phase 2)', SER('2026-12-18'), '3. In production', 6000, '', 'T10', '1']]);
    const w9 = S.row.orders.find(o => o.wo === 'WO-9'), w3 = S.row.orders.find(o => o.wo === 'WO-3');
    rec('A set-up: the import ran; WO-3 now says "ADERRIG HOMES LIMITED", WO-9 + WO-10 are in the plan', im.ap === 'ok' && w9 && w3 && w3.customer === 'ADERRIG HOMES LIMITED', JSON.stringify([im.ap, w3 && w3.customer, !!w9, im.prev.slice(0, 120)]));
    rec('A: the import itself made no project and changed no list (L1 on WO-1 byte-identical)', JSON.stringify(projs(S)) === JSON.stringify(P0) && snap(S, 'L1') === L1, JSON.stringify(projs(S)));
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-9'); }); await sleep(1500);
    let j = await job(p);
    rec('A: new list from WO-9 (renamed customer) → project Aderrig, NO second project', j.pid === 'P1' && projs(S).length === P0.length, JSON.stringify([j.pid, j.pjro, j.pm, projs(S)]));
    await setv(p, '0|item', 'Side'); await setv(p, '0|qty', '2'); await save(p, 2000);
    const l9 = liveFor(S, 'WO-9');
    rec('A: …saved on WO-9 under project Aderrig', l9.length === 1 && l9[0].project_id === 'P1', JSON.stringify([l9.map(l => l.project_id), await err(p)]));
    await closeAll(p);
    rec('A: the list made BEFORE the rename (L1, WO-1, Aderrig) is still attached and untouched', snap(S, 'L1') === L1);
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-3'); }); await sleep(1500);
    j = await job(p);
    rec('A: new list from WO-3 (existing job, customer renamed in the import) → project Aderrig', j.pid === 'P1' && projs(S).length === P0.length, JSON.stringify([j.pid, j.pm, projs(S)]));
    await closeAll(p);
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-10'); }); await sleep(1500);
    j = await job(p);
    rec('A: WO-10 "Aderrig Homes Ltd (Phase 2)" → never a SILENT second project (linked to Aderrig, or the person is asked)', projs(S).length === P0.length && (j.pid === 'P1' || /Is this project|Aderrig/.test(j.pm)), JSON.stringify([j.pid, j.pm.replace(/\s+/g, ' ').slice(0, 200), projs(S)]));
    await closeAll(p);
    // the Lists page "Change job" for Aderrig still holds all three WOs
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(600);
    const dd = await p.evaluate(() => [...document.getElementById('me-wo').options].map(o => o.value));
    rec('A: Aderrig\'s work-order drop-down after the import holds WO-3 and WO-9 (renamed spelling)', dd.includes('WO-3') && dd.includes('WO-9'), JSON.stringify(dd));
    await closeAll(p);

    // ===== B. same unit number, different blocks — opened FROM the job =====
    await p.evaluate(() => openListEditor(null, 'WO-S1')); await sleep(900);
    await setv(p, '0|item', 'Block A side'); await setv(p, '0|qty', '1'); await save(p, 1800); await closeAll(p);
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-S2'); }); await sleep(1200);
    j = await job(p);
    const askB = await p.evaluate(() => window.__asked.slice());
    rec('B: WO-S2 (Block B · 12) opened while Block A · 12 has a list → title bar WO-S2, NO "already has a list" / "same house" question or warning', j.hwo === 'WO-S2' && !askB.length && !/WO-S1|same house|already has/i.test(j.info + j.title + j.err), JSON.stringify([j.hwo, askB, (j.info + ' ' + j.err).slice(0, 200)]));
    await setv(p, '0|item', 'Block B side'); await setv(p, '0|qty', '1'); await save(p, 1800);
    rec('B: …saved on WO-S2; Block A\'s list still only on WO-S1 (never moved / merged)', liveFor(S, 'WO-S2').length === 1 && liveFor(S, 'WO-S1').length === 1 && liveFor(S, 'WO-S1')[0].id !== liveFor(S, 'WO-S2')[0].id && linesOf(S, liveFor(S, 'WO-S1')[0].id)[0].part === 'Block A side', JSON.stringify([liveFor(S, 'WO-S1').map(l => l.id), liveFor(S, 'WO-S2').map(l => l.id)]));
    await closeAll(p);
    let fl = await flagTxt(p);
    rec('B: Cutting Lists page — no "⚠ 2 lists" tag for WO-S1 / WO-S2 (different blocks)', await p.evaluate(() => ![...document.querySelectorAll('.lh-two')].some(x => /WO-S/.test(x.textContent))));

    // ===== C. two jobs with blank floor AND blank unit =====
    await p.evaluate(() => openListEditor(null, 'WO-B3')); await sleep(900);
    await setv(p, '0|item', 'Misc'); await setv(p, '0|qty', '1'); await save(p, 1800); await closeAll(p);
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-B4'); }); await sleep(1200);
    j = await job(p); const askC = await p.evaluate(() => window.__asked.slice());
    rec('C: WO-B4 (blank floor + unit) while WO-B3 (also blank) has a list → no "same house" / "already has a list" question', !askC.length && !/WO-B3/.test(j.info + j.err + j.title), JSON.stringify([askC, j.info.slice(0, 150)]));
    await closeAll(p);
    // blank floor + unit, the SAME title "HOUSE 5 KITCHEN" (read from the title → unsure at most)
    await p.evaluate(() => openListEditor(null, 'WO-B5')); await sleep(900);
    await setv(p, '0|item', 'H5'); await setv(p, '0|qty', '1'); await save(p, 1800); await closeAll(p);
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-B6'); }); await sleep(1200);
    j = await job(p);
    await setv(p, '0|item', 'H5 again'); await setv(p, '0|qty', '1'); await save(p, 1800);
    rec('C: WO-B6 with the same title "HOUSE 5 KITCHEN" as WO-B5 and blank floor/unit → its own list is saved on WO-B6 (not moved onto WO-B5)', liveFor(S, 'WO-B6').length === 1 && liveFor(S, 'WO-B5').length === 1, JSON.stringify([liveFor(S, 'WO-B6').length, liveFor(S, 'WO-B5').length, await err(p)]));
    await closeAll(p);

    // ===== D. P-number, then the real import brings the WO =====
    const mkP = async (f, u, title) => { await closeAll(p); await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(600);
      await setid(p, 'me-jf', f); await setid(p, 'me-ju', u); await setid(p, 'me-jt', title); await click(p, 'me-find'); await sleep(500); await p.evaluate(() => { const b = document.getElementById('me-jmkp') || document.getElementById('me-jnone'); if (b) b.click(); }); await sleep(500); await p.evaluate(() => { const b = document.getElementById('me-jmkp'); if (b) b.click(); }); await sleep(400);
      await setid(p, 'me-pdue', '2026-12-10'); await setv(p, '0|item', 'Tap ' + f); await setv(p, '0|qty', '1'); await save(p, 2500); await closeAll(p); await waitSave(p); await sleep(600); };
    const pBefore = S.row.orders.filter(o => /^P-\d+$/.test(o.wo)).map(o => o.wo);
    await mkP('T30', '77', 'HOUSE 77 KITCHEN');
    await mkP('Block C', '12', 'APT 12 KITCHEN');
    const ps = S.row.orders.filter(o => /^P-\d+$/.test(o.wo) && !pBefore.includes(o.wo));
    const P77 = ps.find(o => o.floor === 'T30'), PC = ps.find(o => o.floor === 'Block C');
    rec('D set-up: two P-numbers made (T30 · 77 and Block C · 12), each with its list', !!P77 && !!PC && liveFor(S, P77.wo).length === 1 && liveFor(S, PC.wo).length === 1, JSON.stringify(ps.map(o => o.wo + ' ' + o.floor + '/' + o.unit)));
    const pjob0 = P77 && JSON.stringify(S.row.orders.find(o => o.wo === P77.wo)), pl0 = P77 && snap(S, liveFor(S, P77.wo)[0].id), pc0 = PC && snap(S, liveFor(S, PC.wo)[0].id);
    im = await doImp(p, [['WO-777', 'HOUSE 77 KITCHEN', 'Aderrig Homes', SER('2026-12-10'), '3. In production', 7000, '', ' T30 ', '077'],
      ['WO-S9', 'APT 12 KITCHEN', 'Aderrig Homes', SER('2026-12-10'), '3. In production', 7000, '', 'Block D', '12']]);
    const P77a = P77 && S.row.orders.find(o => o.wo === P77.wo);
    rec('D: after the import the P-number JOB ' + (P77 && P77.wo) + ' is still in the plan, unchanged apart from nothing', !!P77a && JSON.stringify(P77a) === pjob0, JSON.stringify([P77a && P77a.wo, P77a && Object.keys(P77a).filter(k => JSON.stringify(P77a[k]) !== JSON.stringify(JSON.parse(pjob0)[k]))]));
    rec('D: …its list is still live on it and byte-for-byte unchanged', !!P77 && liveFor(S, P77.wo).length === 1 && snap(S, liveFor(S, P77.wo)[0].id) === pl0);
    rec('D: …WO-777 imported with Floor T30 / Unit 077 (trailing-space "Floor " header read)', (o => o && /T30/.test(o.floor) && /77/.test(o.unit))(S.row.orders.find(o => o.wo === 'WO-777')), JSON.stringify(S.row.orders.find(o => o.wo === 'WO-777')));
    fl = await flagTxt(p);
    rec('D: Cutting Lists page says "A Cienapps WO now exists for the house of ' + (P77 && P77.wo) + ': WO-777"', fl.some(x => P77 && x.includes(P77.wo) && /WO-777/.test(x) && /Cienapps WO now exists/.test(x)), JSON.stringify(fl));
    rec('D: the Block C P-number is NOT flagged by WO-S9 (Block D · 12) — different block', !fl.some(x => PC && x.includes(PC.wo)), JSON.stringify(fl));
    rec('D: the Block C P-number\'s list untouched', !!PC && snap(S, liveFor(S, PC.wo)[0].id) === pc0);
    // the same file imported again: nothing doubles, the P-job still there
    im = await doImp(p, [['WO-777', 'HOUSE 77 KITCHEN', 'Aderrig Homes', SER('2026-12-10'), '3. In production', 7000, '', ' T30 ', '077']]);
    rec('D: the same import again → one WO-777, the P-number job and its list still there', S.row.orders.filter(o => o.wo === 'WO-777').length === 1 && !!S.row.orders.find(o => P77 && o.wo === P77.wo) && liveFor(S, P77.wo).length === 1);
    // the P-number list opened and saved after the WO exists: stays on the P-number (no silent move), nothing lost
    await p.evaluate(P => { const l = lsCache().all.find(l => !l.tpl && !l.archived && (l.wos || []).includes(P)); openListEditor(l.id); }, P77.wo); await sleep(1000);
    await setv(p, '0|note', 'edited after import'); await save(p, 2000);
    const pl = liveFor(S, P77.wo);
    rec('D: …edited + saved: still on ' + P77.wo + ', rows kept, the note saved', pl.length === 1 && linesOf(S, pl[0].id).some(x => x.note === 'edited after import'), JSON.stringify([pl.map(l => l.wos), await err(p)]));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
