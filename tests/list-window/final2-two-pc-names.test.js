// FINAL-2 Tester round (15 Nov) — attack on 907399c + 8ce38ac ("a name you did not change is no longer put back over the
// other PC's rename") and the thing nobody covers: "no cutting" / "no fittings" / list Type sent from this window's stale copy.
// Two PCs (A opened the window first, B changes and saves, then A saves). Ordinary lists AND templates.
// Does the fix ever DROP a rename the person really typed? typed-then-typed-back, case-only, spaces-only, name cleared,
// both PCs renamed, Type name auto-follow on both PCs at once, "Change job".
// Fake Supabase only. Run: node tests/list-window/final2-two-pc-names.test.js
// (The same file runs against a copy of live to see which of these are already on live — see the report.)
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, setid, rows, save, err, linesOf } = L;
const lst = (S, id) => S.db.t.lists.find(l => l.id === id);
const box = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return e ? e.value : null; }, id);
const edit = async (p, id) => { await closeAll(p); await p.evaluate(async id => { window.__asked = []; window.__confirm = true; openListEditor(id); }, id); await sleep(900); };
const fresh = p => p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
const retype = async (p, id, text) => { await p.click('#' + id); await p.keyboard.press('Control+A'); if (text === '') await p.keyboard.press('Backspace'); else await p.keyboard.type(text, { delay: 10 }); await sleep(120); };
const touch = async (p, item, v) => { const r = await rows(p), i = r.findIndex(x => x.item === (item || 'Hinge')); return setv(p, i + '|qty', String(v || 10 + Math.floor(Math.random() * 80))); };
const told = async p => (await p.evaluate(() => (window.__asked || []).join(' | ') + ' ## ' + [...document.querySelectorAll('.toast,#toast,.toasts *')].map(x => x.innerText).join(' | '))) + ' ## ' + (await err(p));
const FIT = [['hdr', 'Fittings only', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''], ['fit', 'Leg', '4', null, null, 'Blum hinge', '', '']];
const SAWONLY = [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Hinge', '1', 100, 100, 'MFC White', '', '']];
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const row = X.v2Row(), WOS = {};
    'NA NB NC ND NE NF NG NH XF XF2 XS XT'.split(' ').forEach((id, i) => { WOS[id] = 'WO-' + (50 + i); row.orders.push(X.H.order({ wo: WOS[id], customer: 'Aderrig Homes', floor: 'T50', unit: String(50 + i), title: 'HOUSE ' + (50 + i), dueDate: '2026-12-10', origDueDate: '2026-12-10' })); });
    row.orders.push(X.H.order({ wo: 'WO-70', customer: 'Aderrig Homes', floor: 'T50', unit: '70', title: 'HOUSE 70', dueDate: '2026-12-10', origDueDate: '2026-12-10' }));
    const S = X.makeServer(row);
    const seed = (id, name, wo, extra, lines) => X.F3.seedList(S, id, Object.assign({ wos: wo ? [wo] : WOS[id] ? [WOS[id]] : [], name, list: extra || {} }, lines ? { lines } : {}));
    'A B C D E F G H'.split(' ').forEach((k, i) => seed('N' + k, 'House ' + k, null));
    seed('XF', 'Fit only', null, {}, FIT); seed('XF2', 'Fit only 2', null, {}, FIT); seed('XS', 'Saw only', null, {}, SAWONLY); seed('XT', 'Type test', null, { list_type: 'house' });
    const tseed = (id, name, type) => seed(id, name, null, Object.assign({ is_template: true, list_type: 'house' }, type === undefined ? {} : { type_name: type }));
    tseed('T1', 'Type 2', 'Type 2'); tseed('T2', 'Type 3', 'Type 3'); tseed('T3', 'Type 4', 'Type 4'); tseed('T4', 'Type 5', 'Type 5'); tseed('T5', 'Type 6', 'Type 6'); tseed('T6', 'Type 7', 'Type 7');
    const a = await X.dev(browser, S, 'design'), pa = a.page, b = await X.dev(browser, S, 'design'), pb = b.page; await asks(pa); await asks(pb);
    const both = async id => { await fresh(pa); await fresh(pb); await edit(pa, id); await edit(pb, id); };
    const done = async () => { await closeAll(pa); await closeAll(pb); };

    // ---------------- ordinary lists ----------------
    // 1. B renames, A only changes a row
    await both('NA'); await retype(pb, 'me-name', 'Plot 7'); await save(pb, 1800);
    rec('1 set-up: B renamed "House A" → "Plot 7"', lst(S, 'NA').name === 'Plot 7', JSON.stringify([lst(S, 'NA').name, await err(pb)]));
    await touch(pa, 'Hinge', 11); await save(pa, 2200);
    rec('[HIGH] 1a A (window opened before) only changed a row: B\'s name "Plot 7" is kept AND A\'s row is saved', lst(S, 'NA').name === 'Plot 7' && linesOf(S, 'NA').find(x => x.part === 'Hinge').qty === '11', JSON.stringify([lst(S, 'NA').name, linesOf(S, 'NA').find(x => x.part === 'Hinge').qty, await told(pa)]));
    await done();
    // 2. A really renames; B did not touch the name (B changed a row)
    await both('NB'); await touch(pb, 'Hinge', 12); await save(pb, 1800);
    await retype(pa, 'me-name', 'Plot 8'); await save(pa, 2200);
    rec('[HIGH] 2 A really typed a new name ("Plot 8"), B only changed a row: A\'s name IS saved and B\'s row is kept', lst(S, 'NB').name === 'Plot 8' && linesOf(S, 'NB').find(x => x.part === 'Hinge').qty === '12', JSON.stringify([lst(S, 'NB').name, linesOf(S, 'NB').find(x => x.part === 'Hinge').qty, await told(pa)]));
    await done();
    // 3. BOTH rename
    await both('NC'); await retype(pb, 'me-name', 'Plot 9 (B)'); await save(pb, 1800);
    await pa.evaluate(() => { window.__asked = []; }); await retype(pa, 'me-name', 'Plot 9 (A)'); await save(pa, 2200);
    const t3 = await told(pa);
    rec('3 both renamed: the one saved last wins ("Plot 9 (A)") — never a blank or mixed name', lst(S, 'NC').name === 'Plot 9 (A)', JSON.stringify([lst(S, 'NC').name, t3.slice(0, 200)]));
    rec('(info) [LOW] 3b … and A is TOLD the other screen had renamed it to "Plot 9 (B)"', /Plot 9 \(B\)|another screen|renamed/i.test(t3), t3.slice(0, 260));
    await done();
    // 4. A types a name and types it BACK; B renamed meanwhile → A changed nothing → B's stays; A's row saved
    await both('ND'); await retype(pb, 'me-name', 'Plot 10'); await save(pb, 1800);
    await retype(pa, 'me-name', 'Something'); await retype(pa, 'me-name', 'House D'); await touch(pa, 'Hinge', 13); await save(pa, 2200);
    rec('4 A typed a name and typed it back to what it was: B\'s "Plot 10" stays (A asked for no rename), A\'s row saved', lst(S, 'ND').name === 'Plot 10' && linesOf(S, 'ND').find(x => x.part === 'Hinge').qty === '13', JSON.stringify([lst(S, 'ND').name, await told(pa)]));
    await done();
    // 5. case-only and space-only renames typed by A (nobody else involved) must still save
    await fresh(pa); await edit(pa, 'NE'); await retype(pa, 'me-name', 'HOUSE E'); await save(pa, 2000);
    rec('[MEDIUM] 5a a capitals-only rename "House E" → "HOUSE E" IS saved (the fix must not take it for "not changed")', lst(S, 'NE').name === 'HOUSE E', JSON.stringify([lst(S, 'NE').name, await told(pa)]));
    await fresh(pa); await edit(pa, 'NE'); await retype(pa, 'me-name', 'HOUSE  E'); await save(pa, 2000);
    rec('(info) [LOW] 5b a rename that only adds a space inside ("HOUSE E" → "HOUSE  E") is saved or left — what happens', true, JSON.stringify(lst(S, 'NE').name));
    await fresh(pa); await edit(pa, 'NE'); const v5 = lst(S, 'NE').version; await retype(pa, 'me-name', lst(S, 'NE').name + '  '); await save(pa, 1800);
    rec('5c only spaces added at the END of the name: nothing is written (not a rename)', lst(S, 'NE').version === v5, JSON.stringify([lst(S, 'NE').name, v5, lst(S, 'NE').version]));
    await done();
    // 6. A CLEARS the name (blank = the WO number); B renamed meanwhile
    await both('XF2'); await retype(pb, 'me-name', 'Utility 13'); await save(pb, 1800);
    await pa.evaluate(() => { window.__asked = []; }); await retype(pa, 'me-name', ''); await touch(pa, 'Hinge', 14); await save(pa, 2200);
    const n6 = lst(S, 'XF2').name, t6 = await told(pa);
    rec('6 A wiped the name box (blank = the work order number), B had renamed it "Utility 13": the list ends as its WO number (A\'s typed choice) or "Utility 13" — never blank / "undefined" / "null"', [WOS.XF2, 'Utility 13'].includes(n6), JSON.stringify([n6, t6.slice(0, 200)]));
    await done();
    // 7. Change job on A while B renamed
    await both('NG'); await retype(pb, 'me-name', 'Plot 11'); await save(pb, 1800);
    await pa.evaluate(() => { const t = document.getElementById('me-jobtog'); if (t) t.click(); }); await sleep(300);
    const cj = await setid(pa, 'me-wo', 'WO-70'); await sleep(300); await pa.evaluate(() => { window.__asked = []; }); await save(pa, 2600);
    rec('[MEDIUM] 7 A used "Change job" (to WO-70) and never touched the name: the list moves to WO-70 and keeps B\'s name "Plot 11" (' + cj + ')', JSON.stringify(lst(S, 'NG').wos) === '["WO-70"]' && lst(S, 'NG').name === 'Plot 11', JSON.stringify([lst(S, 'NG').wos, lst(S, 'NG').name, (await told(pa)).slice(0, 240)]));
    await done();
    // 8. the fix on ONE PC: open, rename, save; "Edit it again"; rename again; save — nothing stale
    await fresh(pa); await edit(pa, 'NH'); await retype(pa, 'me-name', 'First'); await save(pa, 2000);
    await pa.evaluate(() => { const bns = [...document.querySelectorAll('.me-dov button')]; const e = bns.find(x => /Edit it again/.test(x.textContent)); if (e) e.click(); }); await sleep(900);
    await retype(pa, 'me-name', 'Second'); await save(pa, 2000);
    rec('8 one PC: renamed, saved, "Edit it again", renamed again, saved → "Second"', lst(S, 'NH').name === 'Second', JSON.stringify([lst(S, 'NH').name, await told(pa)]));
    await pa.evaluate(() => { const bns = [...document.querySelectorAll('.me-dov button')]; const e = bns.find(x => /Edit it again/.test(x.textContent)); if (e) e.click(); }); await sleep(900);
    await retype(pa, 'me-name', 'House H'); await save(pa, 2000);
    rec('[MEDIUM] 8b … then renamed BACK to its very first name "House H" in a re-opened window: saved (the first name is not remembered as "unchanged")', lst(S, 'NH').name === 'House H', JSON.stringify([lst(S, 'NH').name, await told(pa)]));
    await done();

    // ---------------- "no cutting" / "no fittings" / Type: this window's stale copy ----------------
    // 9. B ticks "no cutting" on the Lists table (a fittings-only list); A (window opened before) changes a row and saves
    await both('XF'); await closeAll(pb);
    await pb.evaluate(async () => { listSetFlag(lsList('XF'), 'noCut', true, 'Op'); await lqSend(); }); await sleep(900);
    rec('9 set-up: B ticked "no cutting" on the fittings-only list (database: no_cut = true)', lst(S, 'XF').no_cut === true, JSON.stringify(lst(S, 'XF').no_cut));
    await pa.evaluate(() => { window.__asked = []; }); await touch(pa, 'Hinge', 15); await save(pa, 2400);
    const t9 = await told(pa);
    rec('(already on live) [MEDIUM] 9a A only changed a quantity: B\'s "no cutting" tick is NOT put back to unticked (kept, or A is told / asked)', lst(S, 'XF').no_cut === true || /no cutting|another screen/i.test(t9.split('##')[0] + t9.split('##')[2]), JSON.stringify({ no_cut: lst(S, 'XF').no_cut, hinge: linesOf(S, 'XF').find(x => x.part === 'Hinge').qty, told: t9.slice(0, 200) }));
    await done();
    // 10. the other way: B UNTICKS it (the job does have cutting after all); A saves from a window that still shows it ticked
    D.update(S.db, 'lists', lst(S, 'XF'), { no_cut: true }); await both('XF'); await closeAll(pb);
    rec('10 set-up: A\'s window shows "No cutting on this job" ticked', (await pa.evaluate(() => { const e = document.getElementById('me-nocut'); return e ? e.checked : null; })) === true);
    await pb.evaluate(async () => { listSetFlag(lsList('XF'), 'noCut', false, 'Op'); await lqSend(); }); await sleep(900);
    await pa.evaluate(() => { window.__asked = []; }); await touch(pa, 'Leg', 5); await save(pa, 2400);
    const t10 = await told(pa);
    rec('(already on live) [MEDIUM] 10a B UNTICKED "no cutting" (the job needs cutting): A\'s row-only save does not tick it again', lst(S, 'XF').no_cut === false || /no cutting|another screen/i.test(t10.split('##')[0] + t10.split('##')[2]), JSON.stringify({ no_cut: lst(S, 'XF').no_cut, told: t10.slice(0, 200) }));
    await done();
    // 11. "no fittings" on a saw-only list
    await both('XS'); await closeAll(pb);
    await pb.evaluate(async () => { listSetFlag(lsList('XS'), 'noFit', true, 'Op'); await lqSend(); }); await sleep(900);
    await pa.evaluate(() => { window.__asked = []; }); await touch(pa, 'Side', 3); await pa.evaluate(() => { window.__prompt = 'x'; }); await save(pa, 2400);
    const t11 = await told(pa);
    rec('(already on live) [MEDIUM] 11 B ticked "no fittings" on a saw-only list: A\'s row-only save does not untick it', lst(S, 'XS').no_fit === true || /no fittings|another screen/i.test(t11.split('##')[0] + t11.split('##')[2]), JSON.stringify({ set: lst(S, 'XF').no_fit, no_fit: lst(S, 'XS').no_fit, told: t11.slice(0, 200) }));
    await done();
    // 12. list Type: B changes Type in the window and saves; A changes a row
    await both('XT'); const ty = await setid(pb, 'me-type', 'room'); await sleep(200); await save(pb, 1800);
    rec('12 set-up: B changed the list Type to "room" (' + ty + ')', lst(S, 'XT').list_type === 'room', JSON.stringify([lst(S, 'XT').list_type, await err(pb)]));
    await pa.evaluate(() => { window.__asked = []; }); await touch(pa, 'Hinge', 16); await save(pa, 2400);
    const t12 = await told(pa);
    rec('(already on live) [LOW] 12a A only changed a row: B\'s Type "room" is not put back to "house"', lst(S, 'XT').list_type === 'room' || /type|another screen/i.test(t12.split('##')[0] + t12.split('##')[2]), JSON.stringify({ type: lst(S, 'XT').list_type, told: t12.slice(0, 200) }));
    await done();

    // ---------------- templates ----------------
    const tsave = async (p, ms) => { await p.evaluate(() => { window.__prompt = 'Op'; }); await save(p, ms || 2000); };
    // 13. B renames (both names follow), A only changes a row (final-b N8b, proved again after 8ce38ac)
    await both('T1'); await retype(pb, 'me-name', 'Type 2 RH'); await tsave(pb);
    await touch(pa, 'Hinge', 17); await tsave(pa, 2400);
    rec('[MEDIUM] 13 template: B renamed to "Type 2 RH" (both names); A only changed a row → both names stay "Type 2 RH", A\'s row saved', lst(S, 'T1').name === 'Type 2 RH' && lst(S, 'T1').type_name === 'Type 2 RH' && linesOf(S, 'T1').find(x => x.part === 'Hinge').qty === '17', JSON.stringify([lst(S, 'T1').name, lst(S, 'T1').type_name, await told(pa)]));
    await done();
    // 14. BOTH rename the template (nobody types in the Type name box: it follows on both PCs)
    await both('T2'); await retype(pb, 'me-name', 'Type 3 RH'); await tsave(pb);
    await pa.evaluate(() => { window.__asked = []; }); await retype(pa, 'me-name', 'Type 3 LH');
    const shownTn = await box(pa, 'me-tname'); await tsave(pa, 2400);
    const t14 = await told(pa);
    rec('14 set-up: on A the Type name box followed to "Type 3 LH" before Save', shownTn === 'Type 3 LH', shownTn);
    rec('[MEDIUM] 14a both PCs renamed one template: it does NOT end with a name and a Type name that nobody typed together (name "Type 3 LH" with Type name "Type 3 RH") — or A is told', lst(S, 'T2').name === lst(S, 'T2').type_name || /Type 3 RH|another screen/i.test(t14.split('##')[0] + t14.split('##')[2]), JSON.stringify({ name: lst(S, 'T2').name, type: lst(S, 'T2').type_name, AsawBeforeSave: shownTn, told: t14.slice(0, 200) }));
    await done();
    // 15. A TYPES the Type name; B typed another → A's typed one is saved
    await both('T3'); await retype(pb, 'me-tname', 'B special'); await tsave(pb);
    await retype(pa, 'me-tname', 'A special'); await tsave(pa, 2400);
    rec('15 A typed a Type name ("A special"), B had typed "B special": A\'s typed Type name is saved, the name stays "Type 4"', lst(S, 'T3').type_name === 'A special' && lst(S, 'T3').name === 'Type 4', JSON.stringify([lst(S, 'T3').name, lst(S, 'T3').type_name]));
    await done();
    // 16. A types in the Type name box and types it BACK, then renames the template
    await fresh(pa); await edit(pa, 'T4'); await retype(pa, 'me-tname', 'oops'); await retype(pa, 'me-tname', 'Type 5'); await retype(pa, 'me-name', 'Type 5 LH');
    const tn16 = await box(pa, 'me-tname'); await tsave(pa, 2200);
    rec('(info) [LOW] 16 Type name typed and typed BACK to the same as the name, then the template renamed "Type 5 LH": does the Type name still follow?', lst(S, 'T4').type_name === 'Type 5 LH', JSON.stringify({ boxBeforeSave: tn16, name: lst(S, 'T4').name, type: lst(S, 'T4').type_name }));
    await done();
    // 17. A CLEARS the Type name on purpose; B did nothing → saved empty (not put back)
    await fresh(pa); await edit(pa, 'T5'); await retype(pa, 'me-tname', ''); await touch(pa, 'Hinge', 18); await tsave(pa, 2200);
    rec('17 A cleared the Type name on purpose: saved empty (the fix does not put the old one back)', !lst(S, 'T5').type_name, JSON.stringify([lst(S, 'T5').name, lst(S, 'T5').type_name, await told(pa)]));
    await done();
    // 18. A renames the template; B meanwhile CLEARED the Type name on purpose
    await both('T6'); await retype(pb, 'me-tname', ''); await tsave(pb);
    rec('18 set-up: B cleared the Type name', !lst(S, 'T6').type_name, JSON.stringify(lst(S, 'T6').type_name));
    await retype(pa, 'me-name', 'Type 7 LH'); await tsave(pa, 2400);
    rec('(info) [LOW] 18a A then renamed the template (Type name followed on A\'s screen): B\'s deliberate EMPTY Type name is kept, name is "Type 7 LH"', lst(S, 'T6').name === 'Type 7 LH' && !lst(S, 'T6').type_name, JSON.stringify([lst(S, 'T6').name, lst(S, 'T6').type_name]));
    await done();
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
