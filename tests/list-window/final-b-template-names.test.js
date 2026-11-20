// FINAL Tester round (14 Nov), area 4b — attack on M5 / question 19 = A: in the template editor the Type name follows a
// rename ONLY when it was the same as the old name. Real key presses (one letter at a time), renaming twice, renaming back,
// blank names, names that differ only by case / spaces, a template with NO type name, two templates ending up with one
// name, two PCs editing one template, and "Save as template" picking the wrong one of two same-looking templates.
// UPDATED 20 Nov 2026 for Garry's new answer ("we have just one name per templates"): the template NAME is the one name — no
// Type name box on a template, every template save writes type_name = name. Checks that asserted the old 14 Nov rule (a Type
// name that follows / stays) now check the new rule; the rest (blank names, renaming back, two PCs, Save as template) are as before.
// Fake Supabase only. Run: node tests/list-window/final-b-template-names.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, save, err, linesOf } = L;
const tpl = (S, id) => S.db.t.lists.find(l => l.id === id);
const box = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return e ? e.value : null; }, id);
const typeIn = (p, id, v) => p.evaluate(({ id, v }) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }, { id, v });
const edit = async (p, id) => { await closeAll(p); await p.evaluate(id => { window.__asked = []; window.__confirm = true; openListEditor(id); }, id); await sleep(900); };
// a person: click in the box, select everything, type the new text one key at a time
const retype = async (p, id, text) => { await p.click('#' + id); await p.keyboard.press('Control+A'); await p.keyboard.type(text, { delay: 15 }); await sleep(120); };
// a person: backspace the box empty, then type
const wipeType = async (p, id, text) => { await p.click('#' + id); await p.keyboard.press('End'); const n = (await box(p, id)).length; for (let i = 0; i < n; i++) await p.keyboard.press('Backspace'); await p.keyboard.type(text, { delay: 15 }); await sleep(120); };
const saves = S => S.rpcCalls.filter(c => c.fn === 'save_list_revision').length;
const touchRow = async p => { const r = await rows(p), i = r.findIndex(x => x.item === 'Hinge'); await setv(p, i + '|qty', String(10 + Math.floor(Math.random() * 80))); await sleep(150); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const seed = (id, name, type) => X.F3.seedList(S, id, { wos: [], name, list: Object.assign({ is_template: true, list_type: 'house' }, type === undefined ? {} : { type_name: type }) });
    seed('T1', 'Type 2', 'Type 2'); seed('T2', 'Type A kitchen', 'Type A'); seed('T3', '4C', '4B'); seed('T4', '4B', '4B'); seed('T5', 'Type 6', 'Type 6');
    seed('T6', 'Type 9'); seed('T7', 'Type 8', 'TYPE  8'); seed('T8', 'Type 3', 'Type 3'); seed('T9', 'Type 1A H', 'Type 1A'); seed('T10', 'Type 20', 'Type 20'); seed('T11', 'Type 21', 'Type 21');
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });

    // ---- N1. names different ON PURPOSE; the new name, typed letter by letter, passes through the Type name ----
    await edit(p, 'T2');
    rec('N1 set-up: name "Type A kitchen" (hidden type name "Type A"), no Type name box', (await box(p, 'me-name')) === 'Type A kitchen' && (await box(p, 'me-tname')) === null);
    await retype(p, 'me-name', 'Type A (old layout)');
    await save(p, 1800);
    rec('[MEDIUM] N1 saved: name "Type A (old layout)" is the one name (type name the same)', tpl(S, 'T2').name === 'Type A (old layout)' && tpl(S, 'T2').type_name === 'Type A (old layout)', JSON.stringify([tpl(S, 'T2').name, tpl(S, 'T2').type_name, await err(p)]));
    // the live case: "4C" with type "4B", renamed to "4B handed" by typing
    await edit(p, 'T3'); await retype(p, 'me-name', '4B handed');
    rec('[MEDIUM] N1b live case "4C" / "4B": no Type name box; the name box has what was typed', (await box(p, 'me-tname')) === null && (await box(p, 'me-name')) === '4B handed', await box(p, 'me-name'));
    await closeAll(p);
    // backspacing: "Type A kitchen" → backspace down to "Type A" → on to "Type AB"
    await edit(p, 'T9');
    await p.click('#me-name'); await p.keyboard.press('End'); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await sleep(80); // "Type 1A H" → "Type 1A" (= its Type name now)
    await p.keyboard.type(' RH', { delay: 15 }); await sleep(120);
    rec('[MEDIUM] N1c handed template "Type 1A H": name edited to "Type 1A RH" by backspacing → the name box says "Type 1A RH", no Type name box', (await box(p, 'me-name')) === 'Type 1A RH' && (await box(p, 'me-tname')) === null, JSON.stringify([await box(p, 'me-name'), await box(p, 'me-tname')]));
    await closeAll(p);

    // ---- N2. renamed twice in one sitting, then saved ----
    await edit(p, 'T1'); await retype(p, 'me-name', 'Type 2B'); await retype(p, 'me-name', 'Type 2C LH');
    rec('N2 renamed twice: the name box has the last name', (await box(p, 'me-name')) === 'Type 2C LH', await box(p, 'me-name'));
    await save(p, 1800);
    rec('N2 saved: both "Type 2C LH"', tpl(S, 'T1').name === 'Type 2C LH' && tpl(S, 'T1').type_name === 'Type 2C LH', JSON.stringify([tpl(S, 'T1').name, tpl(S, 'T1').type_name]));

    // ---- N3. renamed and renamed BACK: nothing to save ----
    await edit(p, 'T5'); const s3 = saves(S), v3 = tpl(S, 'T5').version;
    await retype(p, 'me-name', 'Something else'); await retype(p, 'me-name', 'Type 6');
    rec('N3 renamed back: the name is back to "Type 6"', (await box(p, 'me-name')) === 'Type 6', await box(p, 'me-name'));
    await p.evaluate(() => { window.__confirm = false; window.__asked = []; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(300);
    rec('N3 renamed back: Esc closes without "Close without saving?"', !(await L.ed(p)) && (await p.evaluate(() => window.__asked.join('|'))) === '', await p.evaluate(() => window.__asked.join('|')));
    await p.evaluate(() => { window.__confirm = true; });
    rec('N3 nothing written', saves(S) === s3 && tpl(S, 'T5').version === v3);

    // ---- N4. blank name ----
    await edit(p, 'T5'); await wipeType(p, 'me-name', '');
    const tn4 = await box(p, 'me-tname'); await save(p, 1200);
    rec('N4 name wiped: Save refused "Give the template a name.", nothing written', /Give the template a name/.test(await err(p)) && tpl(S, 'T5').name === 'Type 6' && tpl(S, 'T5').type_name === 'Type 6', JSON.stringify([await err(p), tpl(S, 'T5').name, tpl(S, 'T5').type_name]));
    rec('(info) N4 with the name wiped the Type name box shows', true, JSON.stringify(tn4));
    await p.click('#me-name'); await p.keyboard.type('Type 6 new', { delay: 15 }); await sleep(100); await save(p, 1800);
    rec('N4 then a new name typed and saved: both names "Type 6 new"', tpl(S, 'T5').name === 'Type 6 new' && tpl(S, 'T5').type_name === 'Type 6 new', JSON.stringify([tpl(S, 'T5').name, tpl(S, 'T5').type_name, await err(p)]));
    // only spaces
    await edit(p, 'T8'); await retype(p, 'me-name', '   '); await save(p, 1200);
    rec('N4 a name of only spaces is refused, nothing written', tpl(S, 'T8').name === 'Type 3' && tpl(S, 'T8').type_name === 'Type 3', JSON.stringify([await err(p), tpl(S, 'T8').name, tpl(S, 'T8').type_name]));
    await closeAll(p);

    // ---- N5. old template with NO type name: nothing invented ----
    await edit(p, 'T6');
    rec('N5 set-up: template "Type 9" (no type name) — no Type name box', (await box(p, 'me-tname')) === null, await box(p, 'me-tname'));
    await closeAll(p);
    await edit(p, 'T6'); await wipeType(p, 'me-name', 'Type 9 new');
    await touchRow(p); await save(p, 1800);
    rec('N5 saved: the one name "Type 9 new" (type_name = name)', tpl(S, 'T6').name === 'Type 9 new' && tpl(S, 'T6').type_name === 'Type 9 new', JSON.stringify([tpl(S, 'T6').name, tpl(S, 'T6').type_name]));
    await closeAll(p);

    // ---- N6. only case / spaces differ ----
    await edit(p, 'T7'); await retype(p, 'me-name', 'Type 8 LH');
    await save(p, 1800);
    rec('N6 template with type name "TYPE  8" renamed "Type 8 LH" → both names "Type 8 LH"', tpl(S, 'T7').name === 'Type 8 LH' && tpl(S, 'T7').type_name === 'Type 8 LH', JSON.stringify([tpl(S, 'T7').name, tpl(S, 'T7').type_name]));
    await closeAll(p);
    await edit(p, 'T8'); await retype(p, 'me-name', 'TYPE 3'); await save(p, 1800);
    rec('N6 a capitals-only rename ("Type 3" → "TYPE 3") is saved on BOTH names', tpl(S, 'T8').name === 'TYPE 3' && tpl(S, 'T8').type_name === 'TYPE 3', JSON.stringify([tpl(S, 'T8').name, tpl(S, 'T8').type_name, await err(p)]));
    await closeAll(p);

    // ---- N7. a rename INTO another template's name: two templates that look the same in every picker (the "4C / 4B" problem again) ----
    await edit(p, 'T10'); await p.evaluate(() => { window.__asked = []; }); await retype(p, 'me-name', 'Type 21'); await save(p, 1800);
    const asked7 = await p.evaluate(() => window.__asked.join(' | ')), e7 = await err(p);
    const dup = S.db.t.lists.filter(l => l.is_template && !l.archived && /^type 21$/i.test(String(l.type_name || l.name)));
    rec('(info, already on live) [LOW] N7 renaming template "Type 20" to "Type 21" (a name another template already has) is refused or asked about — never two templates showing as "Type 21"', dup.length === 1 || /Type 21/.test(asked7) || /already|same name/i.test(e7), JSON.stringify({ sameLooking: dup.map(l => [l.id, l.name, l.type_name]), asked: asked7.slice(0, 120), err: e7 }));
    await closeAll(p);

    // ---- N8. two PCs on one template ----
    const S2 = X.makeServer(X.v2Row());
    X.F3.seedList(S2, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });
    X.F3.seedList(S2, 'T2', { wos: [], name: 'Type 5', list: { is_template: true, type_name: 'Type 5', list_type: 'house' } });
    const a = await X.dev(browser, S2, 'design'), pa = a.page, b = await X.dev(browser, S2, 'prod'), pb = b.page; await asks(pa); await asks(pb);
    for (const q of [pa, pb]) await q.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    // (a) (20 Nov: no Type name box) B renames the template and saves; A (opened before) renames it too → ONE name is saved, never a mix
    await edit(pa, 'T1'); await edit(pb, 'T1');
    await retype(pb, 'me-name', 'Special 3-bed'); await save(pb, 1800);
    rec('N8a set-up: B saved the name "Special 3-bed" (both names)', tpl(S2, 'T1').name === 'Special 3-bed' && tpl(S2, 'T1').type_name === 'Special 3-bed', JSON.stringify([tpl(S2, 'T1').name, tpl(S2, 'T1').type_name, await err(pb)]));
    await pa.evaluate(() => { window.__asked = []; }); await retype(pa, 'me-name', 'Type 2B'); await save(pa, 2200);
    const e8 = await err(pa);
    rec('[MEDIUM] N8a two screens renamed one template: name and type name are the same one name afterwards', tpl(S2, 'T1').name === tpl(S2, 'T1').type_name, JSON.stringify({ name: tpl(S2, 'T1').name, type: tpl(S2, 'T1').type_name, err: e8 }));
    await closeAll(pa); await closeAll(pb);
    // (b) B renames the template (both names follow) and saves; A (opened before) only changes a ROW
    for (const q of [pa, pb]) await q.evaluate(async () => { lsReset(); await lsLoad(); });
    await edit(pa, 'T2'); await edit(pb, 'T2');
    await retype(pb, 'me-name', 'Type 5 RH'); await save(pb, 1800);
    rec('N8b set-up: B renamed the template to "Type 5 RH" (both names)', tpl(S2, 'T2').name === 'Type 5 RH' && tpl(S2, 'T2').type_name === 'Type 5 RH', JSON.stringify([tpl(S2, 'T2').name, tpl(S2, 'T2').type_name]));
    await pa.evaluate(() => { window.__asked = []; }); await touchRow(pa); await save(pa, 2200);
    const b8 = await pa.evaluate(() => window.__asked.join(' | ')), eb = await err(pa);
    rec('[MEDIUM] N8b A only changed a row: B\'s rename "Type 5 RH" is not silently put back to "Type 5" (kept, or A is told / asked)', (tpl(S2, 'T2').name === 'Type 5 RH' && tpl(S2, 'T2').type_name === 'Type 5 RH') || /Type 5 RH|another screen|renamed/i.test(b8 + eb), JSON.stringify({ name: tpl(S2, 'T2').name, type: tpl(S2, 'T2').type_name, asked: b8.slice(0, 150), err: eb }));
    await closeAll(pa); await closeAll(pb);

    // ---- N9. "Save as template" with two templates that both show as "4B" (live: "4C"/"4B" and "4B"/"4B") ----
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    const c4before = JSON.stringify(linesOf(S, 'T3').map(x => [x.part, x.qty]));
    await p.evaluate(() => { window.__asked = []; lsSaveAsTpl({ id: 'L1' }); }); await sleep(900);
    await typeIn(p, 'at-name', '4B'); await sleep(400);
    const dlg = await p.evaluate(() => { const b = document.getElementById('at-body'); return b ? b.innerText : ''; });
    rec('N9 set-up: Save as template with the name "4B" offers "Update template"', /already exists/.test(dlg) && /Update template/.test(dlg), dlg.slice(0, 200));
    await p.evaluate(() => { const r = document.querySelector('[name="at-mode"][value="upd"]'); if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change')); } }); await sleep(200);
    await p.evaluate(() => document.getElementById('at-ok').click()); await sleep(2000);
    const c4after = JSON.stringify(linesOf(S, 'T3').map(x => [x.part, x.qty]));
    rec('[MEDIUM] N9 "Update template 4B" never overwrites the rows of the template NAMED "4C" (whose Type name is "4B")', c4after === c4before, JSON.stringify({ t3: [tpl(S, 'T3').name, tpl(S, 'T3').type_name, tpl(S, 'T3').rev], t4: [tpl(S, 'T4').name, tpl(S, 'T4').type_name, tpl(S, 'T4').rev], dlg: dlg.replace(/\s+/g, ' ').slice(0, 160) }));
    await closeAll(p);

    // N9b the other way round: a template NAMED "Type 30" whose Type name is "Type 31" sorts before the real "Type 31"
    seed('T30', 'Type 30', 'Type 31'); seed('T31', 'Type 31', 'Type 31');
    D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'T30:1'), { part: 'ONLY-IN-TYPE-30' });
    await p.evaluate(async () => { lsReset(); await lsLoad(); window.__asked = []; lsSaveAsTpl({ id: 'L1' }); }); await sleep(900);
    await typeIn(p, 'at-name', 'Type 31'); await sleep(400);
    await p.evaluate(() => { const r = document.querySelector('[name="at-mode"][value="upd"]'); if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change')); } }); await sleep(200);
    const dlg2 = await p.evaluate(() => (document.getElementById('at-body') || {}).innerText || '');
    await p.evaluate(() => document.getElementById('at-ok').click()); await sleep(2000);
    const t30 = linesOf(S, 'T30').map(x => x.part);
    rec('(info, already on live) [MEDIUM] N9b "Save as template" named "Type 31" → Update: the rows of the template NAMED "Type 30" (Type name "Type 31") are not replaced', t30.includes('ONLY-IN-TYPE-30'), JSON.stringify({ t30rev: tpl(S, 'T30').rev, t31rev: tpl(S, 'T31').rev, t30parts: t30.slice(0, 4), said: (dlg2.match(/A template called[^\n]*/) || [''])[0] }));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
