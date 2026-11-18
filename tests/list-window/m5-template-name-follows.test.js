// M5 (Garry 14 Nov, answer A): a template has a name and a "Type name". In the template editor, when the Template name is
// changed and the Type name was the same as the OLD name (trimmed, any case), the Type name follows the new name. A Type name
// typed differently on purpose stays. A template whose names already disagree is not touched unless someone edits it — and
// even then its Type name stays (it was not the same as the name). Fake Supabase only.
// Run: node tests/list-window/m5-template-name-follows.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, save, err } = L;
const tpl = (S, id) => S.db.t.lists.find(l => l.id === id);
const box = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return e ? e.value : null; }, id);
const typeIn = (p, id, v) => p.evaluate(({ id, v }) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }, { id, v });
const setOnly = (p, id, v) => p.evaluate(({ id, v }) => { document.getElementById(id).value = v; }, { id, v }); // no input event (e.g. autofill)
const edit = async (p, id) => { await closeAll(p); await p.evaluate(id => { window.__asked = []; openListEditor(id); }, id); await sleep(900); };
const touchRow = async p => { const r = await rows(p), i = r.findIndex(x => x.item === 'Hinge'); await setv(p, i + '|qty', String(10 + Math.floor(Math.random() * 80))); await sleep(150); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const seed = (id, name, type) => X.F3.seedList(S, id, { wos: [], name, list: { is_template: true, type_name: type, list_type: 'house' } });
    seed('T1', 'Type 2', 'Type 2'); seed('T2', 'Kitchen A', 'Type A'); seed('T3', '4C', '4B'); seed('T4', 'Type 5', ' type 5 '); seed('T5', 'Type 6', 'Type 6'); seed('T6', 'Type 7', 'Type 7');
    const t3before = JSON.stringify(tpl(S, 'T3'));
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
    rec('opening the planner changes no template (no background write)', JSON.stringify(tpl(S, 'T3')) === t3before);

    // 1. names the same → Type name follows as the name is typed, and is saved
    await edit(p, 'T1');
    rec('set-up: the template editor shows Template name and Type name "Type 2"', (await box(p, 'me-name')) === 'Type 2' && (await box(p, 'me-tname')) === 'Type 2');
    await typeIn(p, 'me-name', 'Type 2B');
    rec('1. Type name follows on screen as the name is typed', (await box(p, 'me-tname')) === 'Type 2B', await box(p, 'me-tname'));
    await save(p, 1800);
    rec('1. saved row: name "Type 2B" and type name "Type 2B"', tpl(S, 'T1').name === 'Type 2B' && tpl(S, 'T1').type_name === 'Type 2B', JSON.stringify([tpl(S, 'T1').name, tpl(S, 'T1').type_name, await err(p)]));

    // 2. the same, but the name box changed with no typing event (autofill / paste quirk) — the SAVE still follows
    await edit(p, 'T5');
    await setOnly(p, 'me-name', 'Type 6B');
    await save(p, 1800);
    rec('2. name changed without the Type box ever touched, Save pressed → both saved "Type 6B"', tpl(S, 'T5').name === 'Type 6B' && tpl(S, 'T5').type_name === 'Type 6B', JSON.stringify([tpl(S, 'T5').name, tpl(S, 'T5').type_name, await err(p)]));

    // 3. names different on purpose → Type name stays
    await edit(p, 'T2');
    await typeIn(p, 'me-name', 'Kitchen A2');
    rec('3. Type name typed differently on purpose stays on screen ("Type A")', (await box(p, 'me-tname')) === 'Type A');
    await save(p, 1800);
    rec('3. saved row: name "Kitchen A2", type name still "Type A"', tpl(S, 'T2').name === 'Kitchen A2' && tpl(S, 'T2').type_name === 'Type A', JSON.stringify([tpl(S, 'T2').name, tpl(S, 'T2').type_name]));

    // 4. the person changes the Type name first, then the name → their Type name stays
    await edit(p, 'T6');
    await typeIn(p, 'me-tname', 'Type 7 3-bed'); await typeIn(p, 'me-name', 'Type 7 (new)');
    await save(p, 1800);
    rec('4. Type name typed first, then the name changed → the typed Type name is saved', tpl(S, 'T6').name === 'Type 7 (new)' && tpl(S, 'T6').type_name === 'Type 7 3-bed', JSON.stringify([tpl(S, 'T6').name, tpl(S, 'T6').type_name]));

    // 5. an already-disagreeing template (live case: "4C" with type "4B")
    rec('5. "4C" / "4B" is unchanged until someone edits it', JSON.stringify(tpl(S, 'T3')) === t3before);
    await edit(p, 'T3');
    await touchRow(p); await save(p, 1800);
    rec('5. edited (a row changed, name not) → type name still "4B"', tpl(S, 'T3').name === '4C' && tpl(S, 'T3').type_name === '4B', JSON.stringify([tpl(S, 'T3').name, tpl(S, 'T3').type_name]));
    await edit(p, 'T3');
    await typeIn(p, 'me-name', '4D');
    rec('5. its name changed → the Type name "4B" does not follow (it was not the same as the name)', (await box(p, 'me-tname')) === '4B');
    await closeAll(p);

    // 6. trimmed, any case: " type 5 " counts as the same as "Type 5"
    await edit(p, 'T4');
    await typeIn(p, 'me-name', 'Type 5A');
    rec('6. Type name " type 5 " (spaces / case) counts as the same → follows', (await box(p, 'me-tname')) === 'Type 5A', await box(p, 'me-tname'));
    await closeAll(p);

    // 7. phone width: the same rule
    await p.setViewportSize({ width: 360, height: 640 }); await sleep(250);
    await edit(p, 'T1');
    await typeIn(p, 'me-name', 'Type 2C');
    rec('7. phone (360 px): Type name follows', (await box(p, 'me-tname')) === 'Type 2C');
    await save(p, 1800);
    rec('7. phone: saved row has both names "Type 2C"', tpl(S, 'T1').name === 'Type 2C' && tpl(S, 'T1').type_name === 'Type 2C', JSON.stringify([tpl(S, 'T1').name, tpl(S, 'T1').type_name, await err(p)]));
    await closeAll(p);

    // 8. a list (not a template) is not affected
    const lname0 = tpl(S, 'L1').type_name;
    await edit(p, 'L1');
    const tb0 = await box(p, 'me-tname');
    await typeIn(p, 'me-tname', 'House 1'); await typeIn(p, 'me-name', 'House 1 renamed');
    rec('8. a cutting list (not a template): its Type name never follows a rename (the rule is for templates only)', (await box(p, 'me-tname')) === 'House 1', JSON.stringify([tb0, await box(p, 'me-tname')]));
    await closeAll(p);
    rec('8. … nothing saved for the list', tpl(S, 'L1').type_name === lname0);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
