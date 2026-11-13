// Tester attack ROUND 4 (13 Nov) on bug fix M1 — the project Materials window keeps unsaved typing across redraws.
// Attacks: another PC renames / retires a row while this window is open (stale screen values must NOT be taken as typing);
// a save that fails (server error / offline); two rows typed to one name; a row renamed to another material's old name;
// Close → Cancel → Save; Esc from the list window; names with quotes, <script>, & and very long names; phone 360 px.
// Fake Supabase only. Run: node tests/list-window/attack4-mat-window.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks } = L;
const top = 'const o=[...document.querySelectorAll(".pod-ovl")].pop();';
const val = (p, sel) => p.evaluate(({ sel, top }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o && o.querySelector(sel); return e ? (e.type === 'checkbox' ? e.checked : e.value) : null; }, { sel, top });
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('input')); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const isOpen = p => p.evaluate(() => !!document.querySelector('#mt-body'));
const mmsg = p => p.evaluate(() => (document.getElementById('mt-msg') || {}).textContent || '');
const asked = p => p.evaluate(() => { const a = (window.__asked || []).join('\n---\n'); window.__asked = []; return a; });
const mat = (S, id) => S.db.t.project_materials.find(m => m.id === id);
const fresh = p => p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__asked = []; window.__confirm = false; });

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    D.insert(S.db, 'project_materials', { id: 'M5', project_id: 'P1', name: 'Spare board', kind: 'sheet' });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);

    // ---- A1. another PC renames row M2 while this window is open; I save row M1 ----
    await fresh(p); await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400);
    D.update(S.db, 'project_materials', mat(S, 'M2'), { name: 'Blum hinge 110', aliases: ['Blum hinge'] }); // other PC's rename (version bumps)
    await type(p, '[data-mta="M1"]', 'W/W'); await press(p, '[data-mts="M1"]'); await sleep(1200);
    rec('A1 set-up: my row M1 saved', (mat(S, 'M1').aliases || []).includes('W/W'));
    const a1 = await val(p, '[data-mtn="M2"]');
    rec('[HIGH] A1: after my Save, row M2 shows the OTHER PC\'s new name "Blum hinge 110" (not the stale old name, which I never typed)', a1 === 'Blum hinge 110', a1);
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await press(p, '#pod-x'); await sleep(200);
    const q1 = await asked(p);
    rec('[HIGH] A1: Close does not claim M2 has unsaved typing (I typed nothing on M2)', !/Blum/.test(q1), q1);
    // the trap: the person presses Save on M2 (e.g. to add a spelling) — would it put the old name back over the other PC's rename?
    if (await isOpen(p)) {
      await type(p, '[data-mta="M2"]', (await val(p, '[data-mta="M2"]')) + (/(^|, )BH$/.test(await val(p, '[data-mta="M2"]')) ? '' : ', BH'));
      await press(p, '[data-mts="M2"]'); await sleep(1200);
      rec('[HIGH] A1: adding a spelling on M2 does NOT undo the other PC\'s rename (name stays "Blum hinge 110")', mat(S, 'M2').name === 'Blum hinge 110', JSON.stringify([mat(S, 'M2').name, mat(S, 'M2').aliases]));
    }
    await closeAll(p);

    // ---- A2. another PC retires a row while open; I save a different row ----
    await fresh(p); await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400);
    D.update(S.db, 'project_materials', mat(S, 'M5'), { active: false });
    await type(p, '[data-mta="M1"]', 'W/W, WW'); await press(p, '[data-mts="M1"]'); await sleep(1200);
    const a2 = await val(p, '[data-mtv="M5"]');
    rec('[HIGH] A2: after my Save, the row another PC retired shows Active UNticked (the stale tick is not "my typing")', a2 === false, String(a2));
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await press(p, '#pod-x'); await sleep(200);
    const q2 = await asked(p);
    rec('[MEDIUM] A2: Close does not list "Spare board" as unsaved', !/Spare board/.test(q2), q2);
    await closeAll(p);
    D.update(S.db, 'project_materials', mat(S, 'M5'), { active: true });

    // ---- A3. a save that FAILS: server error, then offline ----
    await fresh(p); await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400);
    await type(p, '[data-mtn="M1"]', 'MFC White X'); await type(p, '[data-mta="M5"]', 'SB'); await type(p, '#mt-new-n', 'Oak veneer');
    const pf = S.db.t.project_materials.length;
    await p.route('**/project_materials?id=eq.*', r => r.request().method() === 'PATCH' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }) : r.fallback());
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    rec('A3: server error → "Not saved" message', /Not saved/.test(await mmsg(p)), await mmsg(p));
    rec('A3: server error → typing on the saved row kept', (await val(p, '[data-mtn="M1"]')) === 'MFC White X', await val(p, '[data-mtn="M1"]'));
    rec('A3: server error → typing on the other row + new-material row kept', (await val(p, '[data-mta="M5"]')) === 'SB' && (await val(p, '#mt-new-n')) === 'Oak veneer');
    rec('A3: nothing written', mat(S, 'M1').name === 'MFC White' && S.db.t.project_materials.length === pf);
    await p.unroute('**/project_materials?id=eq.*');
    S.offline3 = true;
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    rec('A3: offline → a message is shown', (await mmsg(p)).length > 0, await mmsg(p));
    rec('A3: offline → all typing kept', (await val(p, '[data-mtn="M1"]')) === 'MFC White X' && (await val(p, '[data-mta="M5"]')) === 'SB' && (await val(p, '#mt-new-n')) === 'Oak veneer');
    await press(p, '#mt-add'); await sleep(1200);
    rec('A3: offline ＋ Add → message, new-material typing kept', (await mmsg(p)).length > 0 && (await val(p, '#mt-new-n')) === 'Oak veneer', await mmsg(p));
    S.offline3 = false;
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    rec('A3: back online → Save works, other rows still hold typing', mat(S, 'M1').name === 'MFC White X' && (await val(p, '[data-mta="M5"]')) === 'SB' && (await val(p, '#mt-new-n')) === 'Oak veneer');
    // a failed ＋ Add on the server (not a clash)
    await p.route('**/project_materials', r => r.request().method() === 'POST' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }) : r.fallback());
    await press(p, '#mt-add'); await sleep(1200);
    rec('A3: server error on ＋ Add → message, new-material typing kept', /Not added/.test(await mmsg(p)) && (await val(p, '#mt-new-n')) === 'Oak veneer', await mmsg(p));
    await p.unroute('**/project_materials');
    await closeAll(p);
    D.update(S.db, 'project_materials', mat(S, 'M1'), { name: 'MFC White', aliases: [] });

    // ---- A4. two rows typed to the same name; a row renamed to another material's OLD name ----
    await fresh(p); await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400);
    await type(p, '[data-mtn="M1"]', 'Board 18'); await type(p, '[data-mtn="M5"]', 'board  18 ');
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    await press(p, '[data-mts="M5"]'); await sleep(1200);
    rec('A4: second row typed to the same name (other case / spaces) is refused', mat(S, 'M5').name === 'Spare board' && /already used/.test(await mmsg(p)), JSON.stringify([mat(S, 'M5').name, await mmsg(p)]));
    rec('A4: … and its typing is kept so it can be fixed', (await val(p, '[data-mtn="M5"]')) === 'board  18 ');
    // M1 was "MFC White", now "Board 18" with "MFC White" kept as other spelling. Rename M5 to "MFC White" → must be refused.
    await type(p, '[data-mtn="M5"]', 'mfc white');
    await press(p, '[data-mts="M5"]'); await sleep(1200);
    rec('A4: a row renamed to ANOTHER material\'s old name is refused', mat(S, 'M5').name === 'Spare board', JSON.stringify([mat(S, 'M5').name, await mmsg(p)]));
    await type(p, '[data-mtn="M5"]', 'Spare board'); await type(p, '[data-mta="M5"]', 'MFC WHITE');
    await press(p, '[data-mts="M5"]'); await sleep(1200);
    rec('A4: another material\'s old name typed as an "also called" is refused', !(mat(S, 'M5').aliases || []).some(a => /mfc white/i.test(a)), JSON.stringify(mat(S, 'M5').aliases));
    await type(p, '[data-mta="M5"]', '');
    // rename M1 back to its old name: aliases must not end up holding its own name twice / break
    await type(p, '[data-mtn="M1"]', 'MFC White');
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    const m1 = mat(S, 'M1');
    rec('A4: renaming back to the old name is saved', m1.name === 'MFC White', JSON.stringify(m1));
    rec('(low) A4: … the "also called" box does not list the material\'s own name', !(m1.aliases || []).some(a => a.toLowerCase() === 'mfc white'), JSON.stringify(m1.aliases));

    // ---- A5. Close → Cancel → Save works ----
    await type(p, '[data-mta="M5"]', 'SpB');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await press(p, '#pod-x'); await sleep(200);
    rec('A5: Close with typing asks', /Close without saving/.test(await asked(p)) && await isOpen(p));
    await press(p, '[data-mts="M5"]'); await sleep(1200);
    rec('A5: after Cancel, Save on that row saves it', (mat(S, 'M5').aliases || []).includes('SpB'));
    await p.evaluate(() => { window.__asked = []; }); await press(p, '#pod-x'); await sleep(200);
    rec('A5: then Close closes without asking', !(await isOpen(p)) && (await asked(p)) === '');

    // ---- A6. Esc from the list window with typing in the Materials window over it ----
    await fresh(p);
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    await p.evaluate(() => document.getElementById('me-mats').click()); await sleep(500);
    rec('A6 set-up: the Materials window is open over the list window', await isOpen(p) && await p.evaluate(() => !!document.querySelector('.me-ed')));
    await type(p, '[data-mta="M2"]', 'hinge X');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(300);
    const q6 = await asked(p);
    rec('A6: Esc with typing asks first', /Close without saving/.test(q6), q6);
    rec('A6: Cancel → the Materials window and the list window both stay, typing kept', await isOpen(p) && await p.evaluate(() => !!document.querySelector('.me-ed')) && (await val(p, '[data-mta="M2"]')) === 'hinge X');
    await p.evaluate(() => { window.__confirm = true; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(300);
    rec('A6: OK → only the Materials window closes, the list window stays', !(await isOpen(p)) && await p.evaluate(() => !!document.querySelector('.me-ed')));
    await closeAll(p);

    // ---- A7. names with quotes, <script>, & and a very long name ----
    await fresh(p); await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400);
    const evil = '18mm "O\'Grady" <img src=x onerror="window.__xss=1"> & <script>window.__xss=2</script>';
    const long = 'Very long board name '.repeat(15).trim();
    await type(p, '#mt-new-n', evil); await press(p, '#mt-add'); await sleep(1200);
    await type(p, '#mt-new-n', long); await press(p, '#mt-add'); await sleep(1200);
    rec('A7: both odd names added exactly as typed', S.db.t.project_materials.some(m => m.name === evil) && S.db.t.project_materials.some(m => m.name === long));
    // half-type another odd name, then save a row → the redraw must put it back exactly
    await type(p, '#mt-new-n', '"><b>x</b>&amp;'); await type(p, '[data-mta="M5"]', 'a"b<c>&d');
    await press(p, '[data-mts="M1"]'); await sleep(1200);
    rec('A7: after a redraw the half-typed odd text is back exactly (escaped, not run)', (await val(p, '#mt-new-n')) === '"><b>x</b>&amp;' && (await val(p, '[data-mta="M5"]')) === 'a"b<c>&d', JSON.stringify([await val(p, '#mt-new-n'), await val(p, '[data-mta="M5"]')]));
    const evilId = S.db.t.project_materials.find(m => m.name === evil).id;
    rec('A7: the odd name shows in its row exactly', (await val(p, '[data-mtn="' + evilId + '"]')) === evil);
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await press(p, '#pod-x'); await sleep(200);
    await p.evaluate(() => openListEditor('L1')); await sleep(900);
    const opt = await p.evaluate(ev => [...document.querySelectorAll('.me-ed [data-mr$="|mat"] option')].some(o => o.value === ev), evil);
    rec('A7: the odd name is offered in the list window\'s material box as typed', opt);
    rec('A7: no script ran anywhere', (await p.evaluate(() => window.__xss)) === undefined);
    await closeAll(p);

    // ---- A8. phone 360 px: the Materials window fits, Save and Close reachable ----
    const ph = await X.dev(browser, S, 'design', { viewport: { width: 360, height: 740 } }), pp = ph.page; await asks(pp);
    await pp.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg('P1'); }); await sleep(500);
    const lay = await pp.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(), inn = o.querySelector('.pod-in'), r = inn.getBoundingClientRect();
      const btn = s => { const e = o.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) }; };
      return { docW: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, inL: Math.round(r.left), inR: Math.round(r.right), save: btn('[data-mts="M1"]'), add: btn('#mt-add'), name: btn('[data-mtn="M1"]'), x: btn('#pod-x') }; });
    rec('A8: phone — the page itself does not scroll sideways', lay.docW <= lay.cw + 1, JSON.stringify(lay));
    rec('(low) A8: phone — the row Save / ＋ Add buttons sit inside the screen (no sideways scrolling inside the window)', lay.save && lay.save.r <= 360 && lay.add && lay.add.r <= 360, JSON.stringify(lay));
    rec('(low) A8: phone — the Name box is at least 80 px wide', lay.name && lay.name.w >= 80, JSON.stringify(lay.name));
    await ph.close();
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
