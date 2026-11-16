// FINAL Tester round, file F (14 Nov), merged code:
//  C. Customer renamed in Cienapps (spelled differently / renamed outright) through a REAL import: project found or
//     "Is this project …?" asked; never a second project made silently; never a list moved to another project.
//  S. Simplicity against the wireframe with real clicks and real typing: Cutting Lists page (with main's "All projects ▾"
//     picker) → the job's row → fill rows → ONE big Save → "Saved ✓ — list is with the Saw & Stores" → Close → the saw has it.
// Fake Supabase only. Run: node tests/list-window/final-a-customer-simple.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const HDR = ['WO # ', 'Title', 'Customer ', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor ', 'Unit'];
const SER = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse('1899-12-30T00:00:00Z')) / 864e5);
const PROC = '5. WORK ORDER PROCESSED';
const waitSave = p => p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); });
const doImp = async (p, rowsAoa) => {
  const r = await H.importAoa(p, [HDR].concat(rowsAoa));
  const ap = await p.evaluate(async () => { if (!IMPPLAN) return 'no plan'; applyImport(IMPPLAN); try { sched && sched(); } catch (e) {} await saveDB(); return 'ok'; });
  await sleep(800); await waitSave(p);
  await p.evaluate(async () => { lsReset(); await lsLoad(); }); await sleep(300);
  return { plan: r.plan, ap, prev: r.iprev };
};
const o = (wo, c, floor, unit, title, due, x) => H.order(Object.assign({ wo, customer: c, floor, unit, title, dueDate: due, origDueDate: due, step: PROC, cienStep: PROC }, x || {}));
const projs = S => S.db.t.projects.map(x => x.name);
const where = S => JSON.stringify(S.db.t.lists.map(l => [l.id, l.project_id, (l.wos || []).join()]).sort());

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(o('WO-C1', 'Aderrig Homes', 'C', '1', 'C1 KITCHEN', '2026-11-20'), o('WO-C2', 'Aderrig Homes', 'C', '2', 'C2 KITCHEN', '2026-11-21'), o('WO-C3', 'Aderrig Homes', 'C', '3', 'C3 KITCHEN', '2026-11-22'), o('WO-C4', 'Aderrig Homes', 'C', '4', 'C4 KITCHEN', '2026-11-23'),
      o('WO-C5', 'Aderrig Homes', 'C', '5', 'C5 KITCHEN', '2026-11-24'), o('WO-C6', 'Aderrig Homes', 'C', '6', 'C6 KITCHEN', '2026-11-24'), o('WO-C7', 'Aderrig Homes', 'C', '7', 'C7 KITCHEN', '2026-11-24'), o('WO-S7', 'Aderrig Homes', 'S', '7', 'S7 KITCHEN', '2026-11-24'), o('WO-U1', 'Lucan Homes', 'U', '1', 'U1 KITCHEN', '2026-11-25'), o('WO-U2', 'Lucan Homes', 'U', '2', 'U2 KITCHEN', '2026-11-12'));
    const S = X.makeServer(r);
    X.F3.seedList(S, 'LC1', { wos: ['WO-C1'], name: 'C1 list' });
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    const d = await X.dev(browser, S, 'design'), q = d.page; await asks(q);
    const refresh = async pg => { await pg.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); render(); }); await sleep(700); };
    const openWo = async (pg, wo) => { await closeAll(pg); await pg.evaluate(wo => { window.__asked = []; window.__prompted = []; window.__confirm = true; openListEditor(null, wo); }, wo); await sleep(1700); return job(pg); };
    const P0 = projs(S).slice(), W0 = where(S);
    const imp = (wo, c, floor, unit, title, due) => [wo, title, c, SER(due), PROC, 4000, '', floor, unit];

    // ---------- C1. spelled differently (same company) ----------
    let im = await doImp(p, [imp('WO-C2', 'ADERRIG  HOMES LTD.', 'C', '2', 'C2 KITCHEN', '2026-11-21'), imp('WO-C3', 'Aderrig Homes Limited t/a Aderrig', 'C', '3', 'C3 KITCHEN', '2026-11-22'), imp('WO-C4', 'Aderrig Homes (Dublin)', 'C', '4', 'C4 KITCHEN', '2026-11-23')]);
    rec('C1 set-up: the import ran and changed the three customers', im.ap === 'ok' && S.row.orders.find(x => x.wo === 'WO-C2').customer === 'ADERRIG  HOMES LTD.' && S.row.orders.find(x => x.wo === 'WO-C4').customer === 'Aderrig Homes (Dublin)', im.ap);
    rec('C1: the import itself made no project and moved no list', JSON.stringify(projs(S)) === JSON.stringify(P0) && where(S) === W0, JSON.stringify(projs(S)));
    await refresh(q);
    for (const [wo, c] of [['WO-C2', 'ADERRIG  HOMES LTD.'], ['WO-C3', 'Aderrig Homes Limited t/a Aderrig'], ['WO-C4', 'Aderrig Homes (Dublin)']]) {
      const j = await openWo(q, wo), asked = /Is this project/.test(j.pm);
      rec('C1: ' + wo + ' "' + c + '" → project Aderrig found' + (asked ? ' — ASKED "Is this project Aderrig?"' : ' by itself') + '; no second project, no project picker', (j.pid === 'P1' || asked) && projs(S).length === P0.length && !/Pick the project/.test(j.err), JSON.stringify([j.pid, j.pm, projs(S)]));
      if (asked) { await q.evaluate(() => document.getElementById('me-pyes').click()); await sleep(1800); const j2 = await job(q); rec('C1: …Yes → ' + wo + ' is on Aderrig, still no second project', j2.pid === 'P1' && projs(S).length === P0.length, JSON.stringify([j2.pid, j2.pm])); }
      await fillSaw(q, 0, 'Side ' + wo, '2', '720', '560', 'MFC White'); await save(q, 2400);
      const dn = await donep(q), l = liveFor(S, wo)[0];
      rec('C1: …Save → Saved ✓, the list is filed under Aderrig (P1)', !!dn && !!l && l.project_id === 'P1', JSON.stringify([dn && dn.h, await err(q), l && l.project_id]));
      await closeAll(q);
    }

    // ---------- C2. "No" to the question: a new project only because the person said so ----------
    im = await doImp(p, [imp('WO-C5', 'Aderrig Park Developments', 'C', '5', 'C5 KITCHEN', '2026-11-24')]); await refresh(q);
    let j = await openWo(q, 'WO-C5'); const n0 = projs(S).length;
    rec('C2: "Aderrig Park Developments" → asked "Is this project Aderrig?"; nothing made yet', /Is this project/.test(j.pm) && projs(S).length === P0.length, JSON.stringify([j.pid, j.pm]));
    // Save pressed BEFORE answering the question
    await fillSaw(q, 0, 'Side C5', '2', '720', '560', 'MFC White'); await save(q, 2200);
    let dn = await donep(q), e = await err(q);
    rec('C2: Save pressed before answering → not saved, no project made, told to answer (rows stay)', !dn && projs(S).length === n0 && liveFor(S, 'WO-C5').length === 0 && e.length > 0 && (await rows(q)).some(x => x.item === 'Side C5'), JSON.stringify([dn && dn.h, e, projs(S)]));
    rec('[LOW, wording] C2: …the message points at the question on screen ("Is this project Aderrig? Yes / No") — it says "Pick the project — or ＋ New project… at the bottom of the list", but the project list is folded away and the question is what needs answering', /Is this project|answer|Yes|No/.test(e) && !/at the bottom of the list/.test(e), e);
    await q.evaluate(() => { const b = document.getElementById('me-pno'); if (b) b.click(); }); await sleep(2000);
    j = await job(q);
    rec('C2: "No — a new project" → ONE new project "Aderrig Park Developments", the window is on it, the typed row is still there', projs(S).length === n0 + 1 && projs(S).includes('Aderrig Park Developments') && j.pid && j.pid !== 'P1' && (await rows(q)).some(x => x.item === 'Side C5'), JSON.stringify([j.pid, j.pm, projs(S), (await rows(q)).map(x => x.item)]));
    await q.evaluate(() => { window.__prompt = m => /material/i.test(m) ? 'MFC White' : 'Op'; });
    const m0 = (await rows(q))[0].mat;
    rec('(info) C2: the row\'s material after the project changed to the new (empty) project: "' + m0 + '"', true, m0);
    await closeAll(q);
    rec('C2: no list was moved by any of this', S.db.t.lists.filter(l => ['L1', 'LC1'].includes(l.id)).every(l => l.project_id === 'P1'));

    // ---------- C3. renamed OUTRIGHT (nothing in common) for jobs of a project that has lists ----------
    const before = snap(S, 'LC1'), nP = projs(S).length;
    im = await doImp(p, [imp('WO-C1', 'Glenveagh Living Ltd', 'C', '1', 'C1 KITCHEN', '2026-11-20'), imp('WO-C6', 'Glenveagh Living Ltd', 'C', '6', 'C6 KITCHEN', '2026-11-24'), imp('WO-C7', 'Glenveagh Living Ltd', 'C', '7', 'C7 KITCHEN', '2026-11-24')]); await refresh(q);
    rec('C3: customer of WO-C1 (which HAS a list under Aderrig) renamed outright to "Glenveagh Living Ltd" by the import → its list is untouched, still under Aderrig, no project made by the import', snap(S, 'LC1') === before && projs(S).length === nP, JSON.stringify(projs(S)));
    // the saved list opens under its own project
    await closeAll(q); await q.evaluate(() => { window.__asked = []; openListEditor('LC1'); }); await sleep(1500);
    j = await job(q);
    rec('C3: opening that saved list → still project Aderrig, WO-C1 in the title bar, no question, no new project', j.pid === 'P1' && j.hwo === 'WO-C1' && projs(S).length === nP && !/Is this project/.test(j.pm), JSON.stringify([j.pid, j.hwo, j.pm]));
    await setv(q, '0|qty', '6'); await q.evaluate(() => { window.__prompt = 'qty'; }); await save(q, 2500); dn = await donep(q);
    rec('C3: …edit + Save → saved on the same list, same project (never moved to a "Glenveagh" project)', !!dn && (S.db.t.lists.find(l => l.id === 'LC1') || {}).project_id === 'P1' && projs(S).length === nP, JSON.stringify([dn && dn.h, await err(q), projs(S)]));
    await closeAll(q);
    // a NEW list for a sister job of the renamed customer
    j = await openWo(q, 'WO-C6'); const made = projs(S).length - nP, asked6 = /Is this project|Which project|pick/i.test(j.pm);
    rec('(info, decided: "customer with no project yet → project made from the customer") C3: a NEW list for WO-C6, customer renamed outright → ' + (made ? 'a project "Glenveagh Living Ltd" is made by itself (' + j.pm + ') — WO-C1\'s list stays under Aderrig, so ONE development is now under TWO projects and nobody was asked' : asked6 ? 'the person is asked' : 'no project made'), !made || asked6, JSON.stringify([j.pid, j.pm, projs(S)]));
    const told = await q.evaluate(() => document.querySelector('.me-ed').innerText);
    rec('C3: …the window shows the WO in the title bar and the customer the new project was made from (a project named exactly like the customer is not repeated on a "Project" line)', j.hwo === 'WO-C6' && /Customer\s*Glenveagh Living Ltd/.test(told), JSON.stringify([j.hwo, j.pjro, j.pm, told.replace(/\s+/g, ' ').slice(0, 260)]));
    await closeAll(q);
    j = await openWo(q, 'WO-C7');
    rec('C3: the next job of that customer (WO-C7) uses the SAME project as WO-C6 — never a third', projs(S).length === nP + (made ? 1 : 0) && projs(S).filter(n => /glenveagh/i.test(n)).length <= 1, JSON.stringify([j.pid, projs(S)]));
    await closeAll(q);
    rec('C3: all earlier lists are still under the project they were saved in', S.db.t.lists.filter(l => ['L1', 'LC1'].includes(l.id)).every(l => l.project_id === 'P1') && liveFor(S, 'WO-C2')[0].project_id === 'P1', where(S));

    // ---------- C4. a customer that now contains TWO projects' names ----------
    im = await doImp(p, [imp('WO-U1', 'Lucan Aderrig Homes JV', 'U', '1', 'U1 KITCHEN', '2026-11-25')]); await refresh(q);
    const nP4 = projs(S).length; j = await openWo(q, 'WO-U1');
    rec('C4: customer "Lucan Aderrig Homes JV" (two projects fit) → never linked by itself to one of them and no project made silently: the person chooses', projs(S).length === nP4 && (!j.pid || /Is this project|Which|pick|choose|more than one/i.test(j.pm)), JSON.stringify([j.pid, j.pm, projs(S)]));
    await closeAll(q);

    // ---------- S. simplicity, real clicks ----------
    await refresh(q);
    await q.evaluate(() => { try { lpfSet(''); } catch (e) {} render(); }); await sleep(500);
    const page = await q.evaluate(() => ({ newBtn: !!document.getElementById('lh-new'), find: !!document.getElementById('lh-find'), proj: !!document.getElementById('lh-proj'), impTop: [...document.querySelectorAll('#app button')].filter(b => /Import Excel/.test(b.textContent) && b.getClientRects().length).length, lti: !!document.getElementById('lti') }));
    rec('S1: Cutting Lists page: ＋ New list, 🔍 Find old list, ONE project picker ("All projects ▾"), the "Cutting lists to issue" panel', page.newBtn && page.find && page.proj && page.lti && (await q.evaluate(() => document.querySelectorAll('#lh-proj').length)) === 1, JSON.stringify(page));
    const impB = await q.evaluate(() => [...document.querySelectorAll('#app button')].filter(b => /Import Excel/.test(b.textContent) && b.getClientRects().length).map(b => (b.id || 'data-' + Object.keys(b.dataset).join()) + ' "' + b.textContent.trim() + '"'));
    rec('[MEDIUM — Garry\'s answer A, 13 Nov, not built] S1b: NO "📥 Import Excel" on the Cutting Lists page (plan: "moves into the window\'s Start from…"; Garry: "only in the window") — the top-bar button #lh-imp (and an "Import Excel" button on each project heading) are still there for the Drawing office and the office — lsHomeHTML()', impB.length === 0, JSON.stringify(impB));
    // the picker on Lucan: the panel follows; then a job is opened from it
    const p2 = (S.db.t.projects.find(x => x.name === 'Lucan') || {}).id;
    await q.selectOption('#lh-proj', p2).catch(() => {}); await sleep(600);
    const ltiL = await q.evaluate(() => [...document.querySelectorAll('[data-ltirow]')].map(x => x.dataset.ltirow));
    rec('S2: project picker on Lucan → "Cutting lists to issue" shows only Lucan jobs', ltiL.length > 0 && ltiL.every(w => /^WO-(6|U)/.test(w)), JSON.stringify(ltiL));
    // search for an Aderrig job while the picker is on Lucan
    const hasQ = await q.evaluate(() => { const i = document.querySelector('#lti input[type=search], #lti-q, #lti input'); return i ? i.id || 'input' : ''; });
    // with the picker on Lucan, a job of ANOTHER project opened directly → its own project
    j = await openWo(q, 'WO-S7');
    rec('S3: the page picker is on Lucan; an Aderrig job\'s list opened → the window is on Aderrig (the picker never overrides the WO\'s customer)', j.pid === 'P1', JSON.stringify([j.pid, j.pm]));
    await closeAll(q);
    // ＋ New list with the picker on Lucan → Lucan preset, only Lucan's WOs, earliest due first
    const c1 = await q.click('#lh-new', { timeout: 3000 }).then(() => 'ok').catch(e2 => 'CANNOT ' + String(e2.message).split('\n')[0]); await sleep(1000);
    j = await job(q);
    const opts = await q.evaluate(() => [...document.getElementById('me-wo').options].map(x => ({ v: x.value, t: x.textContent })).filter(x => x.v));
    rec('S4: ＋ New list (picker on Lucan) → project Lucan already chosen; Work order ▾ lists only Lucan jobs, earliest due first (WO-U2 12 Nov before WO-6 10 Dec), nobody asked to pick a project', c1 === 'ok' && j.pid === p2 && opts.length >= 2 && opts.every(x => /^WO-(6|U)/.test(x.v)) && opts.findIndex(x => x.v === 'WO-U2') < opts.findIndex(x => x.v === 'WO-6') && !/Pick the project/.test(j.err), JSON.stringify([c1, j.pid, opts.map(x => x.t)]));
    rec('S4: …no WO yet, so the title bar shows no WO; ✕ Close closes at once (nothing typed)', !j.hwo && (await q.click('#me-x0').then(() => 'ok').catch(() => 'no')) === 'ok' && !(await ed(q)) && !(await q.evaluate(() => window.__asked.length)), JSON.stringify([j.hwo, await q.evaluate(() => window.__asked)]));
    // from the job's row on the panel: one path
    await q.selectOption('#lh-proj', '').catch(() => {}); await sleep(600);
    await q.evaluate(() => { const i = document.querySelector('#lti-q') || document.querySelector('#lti input'); if (i) { i.value = 'WO-S7'; i.dispatchEvent(new Event('input')); } }); await sleep(600);
    const rowBtn = await q.evaluate(() => { const r2 = document.querySelector('[data-ltirow="WO-S7"]'); return r2 ? [...r2.querySelectorAll('button')].map(b => b.textContent.trim()) : null; });
    rec('S5: the job WO-S7 is found on the panel by typing its number; its row offers ONE way to start a typed list', !!rowBtn && rowBtn.filter(b => /New list/.test(b)).length === 1, JSON.stringify(rowBtn));
    await q.evaluate(() => { window.__asked = []; window.__prompted = []; });
    const c2 = await q.click('[data-ltirow="WO-S7"] [data-ltistd]', { timeout: 3000 }).then(() => 'ok').catch(e2 => 'CANNOT ' + String(e2.message).split('\n')[0]); await sleep(1600);
    j = await job(q);
    const first = await q.evaluate(() => ({ name: document.getElementById('me-name').value, ph: [...document.querySelectorAll('.me-ed [data-mr$="|qty"]')].map(x => x.placeholder).filter((v, i, a) => a.indexOf(v) === i), nBtn: [...document.querySelectorAll('.me-ed button, .me-ed summary')].filter(b => b.getClientRects().length && !b.closest('[data-row]') && !b.closest('details:not([open]) > :not(summary)')).map(b => b.textContent.trim().slice(0, 22)), focus: (document.activeElement && (document.activeElement.dataset.mr || document.activeElement.id)) || '' }));
    rec('S6: one click on the row → the window: WO-S7 in the title bar, due badge, Floor S · Unit 7 · title shown, project as text, NO project question, nothing asked', c2 === 'ok' && j.hwo === 'WO-S7' && /Due/.test(j.due || '') && /S7 KITCHEN/.test(j.info) && j.pidHidden && !(await q.evaluate(() => window.__asked.length + window.__prompted.length)), JSON.stringify([c2, j.hwo, j.due, j.info, j.pm]));
    rec('S6: …list name EMPTY (not "7", not the WO); every empty Qty box shows "Qty"', first.name === '' && first.ph.length === 1 && first.ph[0] === 'Qty', JSON.stringify([first.name, first.ph]));
    rec('(info, Garry: "don\'t know" on fewer buttons) S6: buttons outside the rows: ' + first.nBtn.length + ' — ' + first.nBtn.join(' · '), first.nBtn.length <= 10, JSON.stringify(first.nBtn));
    // real typing in the first empty part row
    const fi = await q.evaluate(() => { const rs = [...document.querySelectorAll('.me-ed [data-row]')]; for (const tr of rs) { const i = tr.querySelector('[data-mr$="|item"]'), qy = tr.querySelector('[data-mr$="|qty"]'); if (i && qy) return i.dataset.mr.split('|')[0]; } return ''; });
    await q.click('.me-ed [data-mr="' + fi + '|item"]'); await q.keyboard.type('Base side'); await q.keyboard.press('Tab'); await q.keyboard.type('2'); await q.keyboard.press('Tab'); await q.keyboard.type('720'); await q.keyboard.press('Tab'); await q.keyboard.type('560'); await q.keyboard.press('Tab');
    await q.selectOption('.me-ed [data-mr="' + fi + '|mat"]', 'MFC White').catch(() => {}); await sleep(300);
    rec('S7: typed with the keyboard (Tab from box to box) + material picked → the row holds Base side / 2 / 720 / 560 / MFC White', JSON.stringify((await rows(q))[+fi]).includes('"item":"Base side","qty":"2","L":"720","W":"560","mat":"MFC White"'), JSON.stringify((await rows(q))[+fi]));
    rec('S7: the WO number is still in view after typing', (await q.evaluate(() => { const e2 = document.getElementById('me-hwo'), r2 = e2.getBoundingClientRect(); return r2.top >= 0 && r2.bottom <= innerHeight && e2.textContent; })) === 'WO-S7');
    const saves = await q.evaluate(() => [...document.querySelectorAll('.me-ed button')].filter(b => /save/i.test(b.textContent) && b.getClientRects().length).map(b => b.textContent.trim()));
    rec('S8: the list has "Save list → Saw & Stores" and ONE "✓ Save & close" (Garry 16 Nov); "Save as template" is the Drawing office\'s extra', saves.filter(b => !/template/i.test(b)).length === 2 && saves.filter(b => /Save & close/.test(b)).length === 1, JSON.stringify(saves));
    const c3 = await q.click('#me-save', { timeout: 3000 }).then(() => 'ok').catch(e2 => 'CANNOT'); await sleep(2600);
    dn = await donep(q);
    rec('S9: ONE press of Save (standard layout\'s empty headings / rows are simply left out) → "Saved ✓ — list is with the Saw & Stores", nothing asked', c3 === 'ok' && !!dn && dn.h === 'Saved ✓ — list is with the Saw & Stores' && !(await q.evaluate(() => window.__asked.length)), JSON.stringify([dn && dn.h, await err(q), await q.evaluate(() => window.__asked.map(m => m.slice(0, 80)))]));
    const lc7 = liveFor(S, 'WO-S7')[0];
    rec('S9: …the list is named after the WO (name left blank), on WO-S7, with the one saw row', !!lc7 && lc7.name === 'WO-S7' && linesOf(S, lc7.id).filter(x => x.kind === 'saw').length === 1, JSON.stringify(lc7 && [lc7.name, linesOf(S, lc7.id).map(x => [x.kind, x.part])]));
    const c4 = await q.click('#me-dclose', { timeout: 3000 }).then(() => 'ok').catch(() => 'CANNOT'); await sleep(500);
    rec('S10: Close on the Saved panel → back on the Cutting Lists page, no window left, WO-S7 no longer waiting for a list', c4 === 'ok' && !(await q.evaluate(() => !!document.querySelector('.pod-ovl'))) && !(await q.evaluate(() => listsNeeded().map(x => x.wo))).includes('WO-S7'));
    const sw = await X.dev(browser, S, 'saw'), ps = sw.page; await sleep(800);
    const sawHas = await ps.evaluate(id => { try { return lsView(id, true).rows.filter(r2 => r2.k === 'saw').map(r2 => r2.item + ' ' + r2.qty); } catch (e2) { return ['ERR ' + e2.message]; } }, lc7 && lc7.id);
    rec('S11: the saw has it: "Base side 2"', sawHas.join() === 'Base side 2', JSON.stringify(sawHas));
    await sw.close();
    // open it again → ✕ with nothing changed closes at once; outside click does nothing
    await q.evaluate(id => { window.__asked = []; openListEditor(id); }, lc7.id); await sleep(1300);
    await q.mouse.click(5, 300); await sleep(300);
    rec('S12: clicking outside the window does nothing (still open)', await ed(q));
    await q.click('#me-x0'); await sleep(300);
    rec('S12: ✕ Close with nothing changed → closes at once, no question', !(await ed(q)) && !(await q.evaluate(() => window.__asked.length)), JSON.stringify(await q.evaluate(() => window.__asked)));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 400));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
