// Tester attack ROUND 3 (list window, 13 Nov): two PCs at once and an OLD screen (origin/main) left open — only the parts the
// late 12 Nov run touched: the "Is this project …? Yes" answer from two PCs, "List already made under P-…" on a stale PC and on
// the old screen, a list archived on one PC while the other saves a NEW revision. Fake Supabase only.
// Run: node tests/list-window/attack3-two-pcs-old.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const PROC = '5. WORK ORDER PROCESSED';
const o = (wo, c, floor, unit, title, x) => H.order(Object.assign({ wo, customer: c, floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(600); };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(o('WO-L1', 'Aderrig Living', 'R', '1', 'R1 KITCHEN'), o('WO-L2', 'Aderrig Park Homes', 'R', '2', 'R2 KITCHEN'), o('WO-L3', 'Aderrig Living', 'R', '3', 'R3 KITCHEN'), o('WO-L4', 'Aderrig Park Homes', 'R', '4', 'R4 KITCHEN'),
      o('P-1001', 'Aderrig Homes', 'T40', '7', 'HOUSE 7 KITCHEN', { step: '' }));
    const S = X.makeServer(r);
    X.F3.seedList(S, 'LP', { wos: ['P-1001'], name: 'House 7' });
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type C', list: { is_template: true, type_name: 'Type C', list_type: 'kitchen' } });
    const html = A.gitShow('origin/main') || A.gitShow('main');
    const old = html ? await A.openOld(browser, S, html) : null;
    if (old) await old.page.evaluate(async () => { try { if (typeof lsReset === 'function') lsReset(); if (typeof lsLoad === 'function') await lsLoad(); render(); } catch (e) {} });
    const a = await X.dev(browser, S, 'design'), pa = a.page; await asks(pa);
    const b = await X.dev(browser, S, 'design'), pb = b.page; await asks(pb);
    const openWo = async (p, wo) => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; window.__confirm = true; openListEditor(null, wo); }, wo); await sleep(1800); return job(p); };
    const names = () => (S.db.t.projects.find(x => x.id === 'P1') || {}).cien_names || [];
    const n0 = S.db.t.projects.length;

    // ---------- 1. both PCs answer "Is this project Aderrig? Yes" for two different new customer names ----------
    const ja = await openWo(pa, 'WO-L1'), jb = await openWo(pb, 'WO-L2');
    rec('T1 set-up: both PCs are asked "Is this project \'Aderrig\'?" (customers "Aderrig Living" / "Aderrig Park Homes")', /Is this project/.test(ja.pm) && /Is this project/.test(jb.pm), JSON.stringify([ja.pm, jb.pm]));
    await Promise.all([pa.evaluate(() => document.getElementById('me-pyes').click()), pb.evaluate(() => document.getElementById('me-pyes').click())]); await sleep(2500);
    const j1 = await job(pa), j2 = await job(pb);
    rec('T1: both Yes at the same moment → no new project, PC A is on Aderrig, nothing lost', j1.pid === 'P1' && S.db.t.projects.length === n0 && names().includes('Aderrig Homes') && names().includes('Aderrig Living'), JSON.stringify([j1.pid, S.db.t.projects.length - n0, names()]));
    rec('[LOW] T1: …PC B (a split second later) is on Aderrig too, or is told so in words that fit ("Project \'Aderrig Park Homes\' could not be set up…" is said — but it answered YES to Aderrig; nothing was to be set up)', j2.pid === 'P1' || (!/could not be set up/.test(j2.pm) && j2.pm.length > 0), JSON.stringify([j2.pid, j2.pm]));
    // PC B does what the message says: tries again, with no refresh
    if (j2.pid !== 'P1') { const again = await pb.evaluate(() => { const y = document.getElementById('me-pyes'), r = document.getElementById('me-pretry'); if (y) { y.click(); return 'yes'; } if (r) { r.click(); return 'retry'; } return 'no button'; }); await sleep(2200);
      let j5 = await job(pb); if (j5.pid !== 'P1') { j5 = await openWo(pb, 'WO-L2'); if (/Is this project/.test(j5.pm)) { await pb.evaluate(() => document.getElementById('me-pyes').click()); await sleep(2200); j5 = await job(pb); } }
      rec('[MEDIUM] T1b: PC B tries again (same window, else the job opened again → Yes) with NO page refresh → linked to Aderrig this time', j5.pid === 'P1', JSON.stringify([again, j5.pid, j5.pm])); }
    rec('T1c: both names end up remembered for Aderrig, no second project', names().includes('Aderrig Living') && names().includes('Aderrig Park Homes') && names().includes('Aderrig Homes') && S.db.t.projects.length === n0, JSON.stringify(names()));
    await closeAll(pa); await closeAll(pb);
    await pa.evaluate(async () => { lsReset(); await lsLoad(); }); const j3 = await openWo(pa, 'WO-L3');
    rec('T2: after a refresh the next "Aderrig Living" job links to Aderrig by itself', j3.pid === 'P1' && !/Is this project/.test(j3.pm), JSON.stringify([j3.pid, j3.pm]));
    const j4 = await openWo(pb, 'WO-L4'); // PC B has NOT refreshed its projects since its own answer
    rec('T2: PC B (no refresh) opens the next "Aderrig Park Homes" job → Aderrig, not asked again, no second project', j4.pid === 'P1' && !/Is this project/.test(j4.pm) && S.db.t.projects.length === n0, JSON.stringify([j4.pid, j4.pm, S.db.t.projects.length - n0]));
    await closeAll(pa); await closeAll(pb);

    // ---------- 2. the Cienapps WO for the P-number's house arrives; one PC is stale ----------
    S.row.orders.push(o('WO-C7', 'Aderrig Homes', 'T40', '7', 'HOUSE 7 KITCHEN'));
    await pa.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(1300);
    const va = await pa.evaluate(() => ({ rows: ltiRows().map(r => r.o.wo), txt: ((document.getElementById('lti') || {}).innerText || '').replace(/\s+/g, ' ') }));
    rec('P1: PC A (refreshed): WO-C7 is not asked for a list — "List already made under P-1001"', !va.rows.includes('WO-C7') && /List already made under P-1001/.test(va.txt), JSON.stringify(va.rows));
    // PC B archives the P-number's list; PC A (not refreshed) still says "already made"
    S.db.t.lists.find(l => l.id === 'LP').archived = true;
    await pa.evaluate(() => { try { render(); } catch (e) {} }); await sleep(400);
    const stale = await pa.evaluate(() => ltiRows().map(r => r.o.wo));
    rec('(info) P2: the P-number\'s list is archived on PC B; PC A before its next refresh ' + (stale.includes('WO-C7') ? 'already asks for WO-C7' : 'still hides WO-C7 (as expected until it refreshes)'), true, JSON.stringify(stale));
    await pa.evaluate(async () => { lsReset(); await lsLoad(); render(); }); await sleep(1200);
    const fresh = await pa.evaluate(() => ltiRows().map(r => r.o.wo));
    rec('P2: …after PC A refreshes its lists, WO-C7 IS asked for a list again', fresh.includes('WO-C7'), JSON.stringify(fresh));
    S.db.t.lists.find(l => l.id === 'LP').archived = false;
    await pa.evaluate(async () => { lsReset(); await lsLoad(); render(); }); await sleep(900);

    // ---------- 3. the OLD screen (what is live today) left open ----------
    if (!old) rec('old code readable with git show origin/main', false);
    else {
      await old.page.evaluate(async () => { try { await loadDB(); if (typeof lsReset === 'function') lsReset(); if (typeof lsLoad === 'function') await lsLoad(); render(); } catch (e) {} }); await sleep(1200);
      const ov = await old.page.evaluate(() => { try { return { v2: typeof V2 === 'function' && V2(), need: listsNeeded().map(x => x.wo), has: typeof pListUnder === 'function' }; } catch (e) { return { err: e.message }; } });
      rec('(info) O1: the OLD screen ' + ((ov.need || []).includes('WO-C7') ? 'STILL ASKS' : 'does not ask') + ' for a cutting list for WO-C7 (it knows nothing of "already made under P-1001") — every screen must be reloaded on go-live day', true, JSON.stringify(ov));
      // the old screen makes that second list (✓ Confirm with a template would do the same): what does the NEW screen say?
      const made = await old.page.evaluate(async () => { try { openListEditor(null, 'WO-C7'); await new Promise(r => setTimeout(r, 900)); const q = s => document.querySelector('.me-ed [data-mr="' + s + '"]'); const set = (k, v) => { const e = q(k); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); };
        set('0|item', 'Side'); set('0|qty', '2'); set('0|L', '720'); set('0|W', '560'); set('0|mat', 'MFC White'); document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2500)); return (document.getElementById('me-err') || {}).textContent || 'saved?'; } catch (e) { return 'ERR ' + e.message; } });
      const two = liveFor(S, 'WO-C7').length === 1 && liveFor(S, 'P-1001').length === 1;
      rec('O2 set-up: the old screen saved a list on WO-C7 (the house now has two live lists: P-1001 and WO-C7)', two, made);
      await pa.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(1300);
      const flag = await pa.evaluate(() => { let lh = ''; try { LH.kind = 'live'; LH.proj = ''; LH.state = ''; lh = lsHomeHTML(); } catch (e) { lh = 'ERR ' + e.message; } const d = document.createElement('div'); d.innerHTML = lh; const t = d.innerText || d.textContent || '';
        return { twoTag: /2 lists/.test(t), cien: /Cienapps WO now exists/.test(t + document.body.innerText), line: ((t + ' ' + document.body.innerText).match(/[^\n.]*Cienapps WO now exists[^\n.]*/) || [''])[0].slice(0, 160) }; });
      rec('(info) O2: the NEW screen then WARNS that one house has two live cutting lists (P-1001 and WO-C7) — the "⚠ 2 lists" tag only counts lists on the SAME work order; it only says "A Cienapps WO now exists for the house of P-1001"', flag.twoTag || /two|both|2 /.test(flag.line), JSON.stringify(flag));
      // the old screen and templates: the old code still lets the Production Manager PIN edit a template (until reload)
      const ot = await old.page.evaluate(async () => { try { window.prompt = () => '7777'; localStorage.removeItem('wpfEditPin'); openListEditor('T1'); await new Promise(r => setTimeout(r, 900)); const open = !!document.querySelector('.me-ed'); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); return open; } catch (e) { return 'ERR ' + e.message; } });
      rec('(info) O3: the OLD screen with the Production Manager PIN ' + (ot === true ? 'STILL OPENS a template for editing' : 'does not open a template') + ' (the Drawing office / Admin only rule is in the new code only — old screens must be reloaded)', true, String(ot));
      // a plan save from the old screen keeps the P-number job and the new project links
      const sv = await old.page.evaluate(async () => { const x = DB.orders.find(x => x.wo === 'WO-2'); x.notes = 'old screen note r3'; try { sched(); } catch (e) {} await saveDB(); await new Promise(r => setTimeout(r, 1500)); return true; });
      await sleep(500);
      rec('O4: after the old screen saves the plan, the P-number job P-1001 and WO-C7 are both still in the plan', S.row.orders.some(x => x.wo === 'P-1001') && S.row.orders.some(x => x.wo === 'WO-C7') && (S.row.orders.find(x => x.wo === 'WO-2') || {}).notes === 'old screen note r3');
      rec('O4: …and Aderrig\'s remembered customer names are untouched', names().includes('Aderrig Living'), JSON.stringify(names()));
    }
    rec('no page errors on the new screens', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
