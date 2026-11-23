// FINAL Tester round, file G (14 Nov): the Manager's point 4 — two PCs in the 🧱 Project materials window, and a material
// retired on one PC while the other has it on rows in the list window. Fake Supabase only.
// Run: node tests/list-window/final-a-materials-2pc.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const mat = (S, id) => S.db.t.project_materials.find(m => m.id === id) || {};
// the Materials window: set a row's name / active, press its Save
const mrow = (p, id, f) => p.evaluate(async ({ id, f }) => { const ov = [...document.querySelectorAll('.pod-ovl')].filter(o => o.querySelector('#mt-body')).pop(); if (!ov) return 'no window';
  const n = ov.querySelector('[data-mtn="' + id + '"]'), v = ov.querySelector('[data-mtv="' + id + '"]'), k = ov.querySelector('[data-mtk="' + id + '"]'), a = ov.querySelector('[data-mta="' + id + '"]'), s = ov.querySelector('[data-mts="' + id + '"]');
  if (!n || !s) return 'no row ' + id;
  if (f.name != null) { n.value = f.name; n.dispatchEvent(new Event('input')); n.dispatchEvent(new Event('change')); }
  if (f.alias != null && a) { a.value = f.alias; a.dispatchEvent(new Event('input')); a.dispatchEvent(new Event('change')); }
  if (f.active != null && v) { v.checked = f.active; v.dispatchEvent(new Event('change')); }
  if (f.kind != null && k) { k.value = f.kind; k.dispatchEvent(new Event('change')); }
  s.click(); await new Promise(r => setTimeout(r, 1400));
  const ov2 = [...document.querySelectorAll('.pod-ovl')].filter(o => o.querySelector('#mt-body')).pop();
  return 'ok | ' + ((ov2 && ov2.querySelector('#mt-msg') || {}).textContent || '') + ' | name box now: ' + ((ov2 && ov2.querySelector('[data-mtn="' + id + '"]') || {}).value); }, { id, f });
(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row(); r.orders.push(H.order({ wo: 'WO-M1', customer: 'Aderrig Homes', floor: 'M', unit: '1', title: 'M1 KITCHEN', dueDate: '2026-11-20', origDueDate: '2026-11-20' }), H.order({ wo: 'WO-M2', customer: 'Aderrig Homes', floor: 'M', unit: '2', title: 'M2 KITCHEN', dueDate: '2026-11-20', origDueDate: '2026-11-20' }));
    const S = X.makeServer(r);
    D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Oak veneer', kind: 'sheet' });
    const a = await X.dev(browser, S, 'design'), pa = a.page; await asks(pa);
    const b = await X.dev(browser, S, 'prod'), pb = b.page; await asks(pb);
    const openM = async p => { await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; lsMaterialsDlg('P1'); }); await sleep(800); };

    // ---------- G1. both PCs have the Materials window open; both rename the SAME material ----------
    await openM(pa); await openM(pb);
    const ra = await mrow(pa, 'M1', { name: 'A — 18mm MFC White' });
    const rb = await mrow(pb, 'M1', { name: 'B — MFC White 18' });
    const m1 = mat(S, 'M1'), askedB = await pb.evaluate(() => window.__asked.slice());
    rec('G1 set-up: PC A renamed "MFC White" → "A — 18mm MFC White"', /^ok/.test(ra), ra);
    rec('G1: PC B (window opened before A\'s rename) renames the same material → B is TOLD it was changed on another screen, or both names are kept as spellings — A\'s name is never silently thrown away', m1.name === 'A — 18mm MFC White' || (m1.aliases || []).includes('A — 18mm MFC White') || askedB.length > 0 || /another|changed|reload/i.test(rb), JSON.stringify([rb, m1.name, m1.aliases, askedB.map(m => m.slice(0, 90))]));
    rec('G1: …the original name "MFC White" is still one of its spellings (old lists still match)', m1.name === 'MFC White' || (m1.aliases || []).some(x => /^mfc white$/i.test(x)), JSON.stringify([m1.name, m1.aliases]));
    rec('G1: …still exactly 3 materials on the project (no twin made)', S.db.t.project_materials.filter(m => m.project_id === 'P1').length === 3, JSON.stringify(S.db.t.project_materials.map(m => m.name)));

    // ---------- G2. A retires a material; B's stale window saves ANOTHER row → the retire must stay ----------
    await openM(pa); await openM(pb);
    const r2a = await mrow(pa, 'M3', { active: false });
    rec('G2 set-up: PC A retired "Oak veneer"', mat(S, 'M3').active === false, r2a + ' ' + JSON.stringify(await pa.evaluate(() => window.__asked.map(m => m.slice(0, 80)))));
    const r2b = await mrow(pb, 'M2', { alias: 'Blum 110' });
    rec('G2: PC B (stale window) saves an "also called" on ANOTHER row → Oak veneer stays retired (B1 fix holds)', mat(S, 'M3').active === false && (mat(S, 'M2').aliases || []).includes('Blum 110'), JSON.stringify([r2b, mat(S, 'M3').active, mat(S, 'M2').aliases]));
    // B's stale window presses Save on the retired row itself without touching it
    const r2c = await mrow(pb, 'M3', {});
    const q2 = await pb.evaluate(() => window.__asked.slice());
    rec('G2: PC B presses Save on the Oak veneer row itself (its window still shows it Active, nothing changed by B) → it is NOT silently brought back', mat(S, 'M3').active === false || q2.some(m => /retired|bring|another/i.test(m)), JSON.stringify([r2c, mat(S, 'M3').active, q2.map(m => m.slice(0, 90))]));
    await closeAll(pa); await closeAll(pb);
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'M3'), { active: true });

    // ---------- G3. a material is retired on PC A while PC B has it on a row in the list window ----------
    await pa.evaluate(async () => { lsReset(); await lsLoad(); }); await pb.evaluate(async () => { lsReset(); await lsLoad(); });
    await pb.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-M1'); }); await sleep(1300);
    await fillSaw(pb, 0, 'Oak side', '2', '720', '560', 'Oak veneer');
    await openM(pa); const r3 = await mrow(pa, 'M3', { active: false }); await closeAll(pa);
    rec('G3 set-up: PC A retired "Oak veneer" while PC B has it on a row', mat(S, 'M3').active === false, r3);
    await pb.evaluate(() => { window.__confirm = false; }); await save(pb, 2600);
    let d = await donep(pb), e = await err(pb), q3 = await pb.evaluate(() => window.__asked.slice());
    rec('G3: PC B saves → never silence: saved with the row FLAGGED for the saw ("not on the project list"), or B is asked / told the material was retired', (!!d && linesOf(S, liveFor(S, 'WO-M1')[0].id)[0].material_other === true) || q3.some(m => /retired/i.test(m)) || /retired/i.test(e), JSON.stringify([d && d.h, e, q3.map(m => m.slice(0, 100)), liveFor(S, 'WO-M1').map(l => linesOf(S, l.id).map(x => [x.material, x.material_other]))]));
    rec('G3: …"Oak veneer" was not brought back without a word', mat(S, 'M3').active === false || q3.some(m => /retired|bring/i.test(m)), JSON.stringify([mat(S, 'M3').active, q3.length]));
    rec('G3: …the typed row is saved or still on screen (never lost)', (await rows(pb)).some(x => x.item === 'Oak side') || liveFor(S, 'WO-M1').length === 1);
    await pb.evaluate(() => { window.__confirm = true; }); await closeAll(pb);

    // ---------- G4. a NEW material with the same name added on both PCs at once ----------
    await pa.evaluate(async () => { lsReset(); await lsLoad(); }); await pb.evaluate(async () => { lsReset(); await lsLoad(); });
    const addNew = p => p.evaluate(async () => { window.__prompt = m => /material/i.test(m) ? 'Egger U999 Black' : 'Op'; const s = document.querySelector('.me-ed [data-mr="0|mat"]'); const op = [...s.options].find(o => /New material|Add new material/.test(o.textContent)); s.value = op.value; s.dispatchEvent(new Event('change')); });
    await pa.evaluate(() => openListEditor(null, 'WO-M2')); await pb.evaluate(() => openListEditor(null, 'WO-M2')); await sleep(1300);
    for (const p of [pa, pb]) { await setv(p, '0|item', 'Black side'); await setv(p, '0|qty', '1'); await setv(p, '0|L', '700'); await setv(p, '0|W', '500'); }
    await Promise.all([addNew(pa), addNew(pb)]); await sleep(2500);
    const blk = S.db.t.project_materials.filter(m => /egger u999 black/i.test(m.name));
    rec('G4: "＋ Add new material…" with the SAME name on two PCs at the same moment → ONE material on the project', blk.length === 1, JSON.stringify(blk.map(m => [m.id, m.name, m.active])));
    const ma = (await rows(pa))[0].mat, mb = (await rows(pb))[0].mat;
    rec('G4: …both windows have it on their row', ma === 'Egger U999 Black' && mb === 'Egger U999 Black', JSON.stringify([ma, mb, await err(pa), await err(pb)]));
    await pa.evaluate(() => { window.__confirm = true; }); await pb.evaluate(() => { window.__confirm = true; }); await closeAll(pa); await closeAll(pb);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 400));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
