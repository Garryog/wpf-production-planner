// Bug M1 (Garry's bug check, 13 Nov): the project Materials window lost typing. Pressing Save on one row redrew the window
// and threw away what was typed (not saved) on the other rows and in the new-material row; Close gave no warning.
// Now: unsaved typing survives the redraw, and Close asks first when something is not saved. Fake Supabase only.
// Run: node tests/list-window/m1-materials-keep-typing.test.js
const L = require('./lw.js');
const { X, sleep, rec, asks } = L;
const val = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o && o.querySelector(sel); return e ? (e.type === 'checkbox' ? e.checked : e.value) : null; }, sel);
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const open = p => p.evaluate(() => !!document.querySelector('#mt-body'));
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg('P1'); });
    await sleep(400);
    rec('set-up: the Materials window shows MFC White and Blum hinge', (await val(p, '[data-mtn="M1"]')) === 'MFC White' && (await val(p, '[data-mtn="M2"]')) === 'Blum hinge');
    // nothing typed: Close does not ask
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
    await press(p, '#pod-x'); await sleep(200);
    rec('nothing typed → Close closes without asking', !(await open(p)) && (await p.evaluate(() => window.__asked.length)) === 0);
    await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(300);
    // type on row 2, half-type a new material, then change row 1 and press ITS Save
    await type(p, '[data-mtn="M2"]', 'Blum soft-close hinge');
    await type(p, '[data-mta="M2"]', 'BH1');
    await type(p, '#mt-new-n', '18mm MFC Grey');
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const s = o.querySelector('#mt-new-k'); s.value = 'other'; });
    await type(p, '[data-mta="M1"]', 'W/W');
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    const m1 = S.db.t.project_materials.find(m => m.id === 'M1'), m2 = S.db.t.project_materials.find(m => m.id === 'M2');
    rec('row 1 saved (alias W/W in the database)', (m1.aliases || []).includes('W/W'), JSON.stringify(m1.aliases));
    rec('row 2 NOT saved (still "Blum hinge" in the database)', m2.name === 'Blum hinge', m2.name);
    rec('after the Save, row 2 still shows what was typed (name)', (await val(p, '[data-mtn="M2"]')) === 'Blum soft-close hinge', await val(p, '[data-mtn="M2"]'));
    rec('after the Save, row 2 still shows what was typed (other spellings)', (await val(p, '[data-mta="M2"]')) === 'BH1', await val(p, '[data-mta="M2"]'));
    rec('after the Save, the half-typed new material is still there (name and kind)', (await val(p, '#mt-new-n')) === '18mm MFC Grey' && (await val(p, '#mt-new-k')) === 'other', JSON.stringify([await val(p, '#mt-new-n'), await val(p, '#mt-new-k')]));
    rec('row 1 shows the saved value', (await val(p, '[data-mta="M1"]')) === 'W/W', await val(p, '[data-mta="M1"]'));
    // Close with unsaved typing: asks; Cancel keeps the window and the typing
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
    await press(p, '#pod-x'); await sleep(200);
    const q = await p.evaluate(() => window.__asked.join('\n'));
    rec('Close with unsaved typing asks first', /Close without saving/.test(q), q);
    rec('… and names what is not saved', /Blum hinge/.test(q) && /18mm MFC Grey/.test(q), q);
    rec('Cancel → the window stays open with the typing', (await open(p)) && (await val(p, '[data-mtn="M2"]')) === 'Blum soft-close hinge');
    // add the new material: its row empties, row 2's typing still kept
    await press(p, '#mt-add'); await sleep(1200);
    rec('＋ Add saved the new material', S.db.t.project_materials.some(m => m.name === '18mm MFC Grey' && m.kind === 'other'));
    rec('after ＋ Add, the new-material box is empty again', (await val(p, '#mt-new-n')) === '');
    rec('after ＋ Add, row 2 still shows what was typed', (await val(p, '[data-mtn="M2"]')) === 'Blum soft-close hinge');
    // undo the typing by hand → nothing unsaved → no question
    await type(p, '[data-mtn="M2"]', 'Blum hinge'); await type(p, '[data-mta="M2"]', '');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
    await press(p, '#pod-x'); await sleep(200);
    rec('typing put back as it was → Close does not ask', !(await open(p)) && (await p.evaluate(() => window.__asked.length)) === 0);
    // OK closes; the after() callback (list window redraw) still runs
    await p.evaluate(() => { window.__after = 0; lsMaterialsDlg('P1', () => window.__after++); }); await sleep(300);
    await type(p, '[data-mtn="M1"]', 'MFC White 2');
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; });
    await press(p, '#pod-x'); await sleep(200);
    rec('OK on the question closes the window without saving', !(await open(p)) && S.db.t.project_materials.find(m => m.id === 'M1').name === 'MFC White');
    rec('the list window is told the Materials window closed (after runs once)', (await p.evaluate(() => window.__after)) === 1);
    await p.evaluate(() => { window.__after = 0; window.__confirm = false; lsMaterialsDlg('P1', () => window.__after++); }); await sleep(300);
    await type(p, '[data-mtn="M1"]', 'MFC White 2');
    await press(p, '#pod-x'); await sleep(200);
    rec('Cancel on the question → after() is NOT run (the window is still open)', (await open(p)) && (await p.evaluate(() => window.__after)) === 0);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
