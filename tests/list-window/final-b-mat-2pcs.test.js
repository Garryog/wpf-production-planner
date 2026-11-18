// FINAL Tester round (14 Nov), area 4a — re-attack of the round-4 fixes B1–B5 and M1–M4 in the Materials window:
// two PCs on the SAME row at the same moment (rename vs retire vs Sheet↔Fitting), the loser's second try, typing kept
// across a refused save, Close asking only when something is unsaved, ＋ Add of one name on two PCs at once,
// "was retired — bring it back?" (other spelling, Cancel, OK), a fitting put on a row that gets sizes afterwards.
// Fake Supabase only. Run: node tests/list-window/final-b-mat-2pcs.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks, setv, rows, linesOf, save, err } = L;
const top = 'const o=[...document.querySelectorAll(".pod-ovl")].pop();';
const type = (p, sel, v) => p.evaluate(({ sel, v }) => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' || e.type === 'checkbox' ? 'change' : 'input', { bubbles: true })); return 'ok'; }, { sel, v });
const press = (p, sel) => p.evaluate(sel => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector(sel); if (!e) return 'no ' + sel; e.click(); return 'ok'; }, sel);
const mmsg = p => p.evaluate(() => (document.getElementById('mt-msg') || {}).textContent || '');
const mrow = (p, id) => p.evaluate(id => { const q = s => document.querySelector('[' + s + '="' + id + '"]'); return q('data-mtn') ? { name: q('data-mtn').value, kind: q('data-mtk').value, al: q('data-mta').value, act: q('data-mtv').checked } : null; }, id);
const mat = (S, id) => S.db.t.project_materials.find(m => m.id === id);
const reload = p => p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); window.__asked = []; window.__confirm = true; });
const openM = async p => { await p.evaluate(() => lsMaterialsDlg('P1')); await sleep(400); };
const isOpen = p => p.evaluate(() => !!document.getElementById('mt-body'));
const xClose = p => p.evaluate(() => { window.__asked = []; const o = [...document.querySelectorAll('.pod-ovl')].pop(); const x = o && o.querySelector('#pod-x'); if (x) x.click(); else if (o) o.dispatchEvent(new MouseEvent('click', { bubbles: true })); return window.__asked.join(' | '); });
const LINES = [['hdr', 'Carcass', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', '', { section: 'Carcass' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', { section: 'Carcass' }]];
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const two = async () => { const S = X.makeServer(X.v2Row(), { lines: LINES });
      D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Oak veneer', kind: 'sheet' });
      const a = await X.dev(browser, S, 'design'), b = await X.dev(browser, S, 'prod'); await asks(a.page); await asks(b.page); await reload(a.page); await reload(b.page); return { S, pa: a.page, pb: b.page, a, b }; };
    const gate = S => { let rel; S.hold3 = new Promise(r => { rel = r; }); return () => { S.hold3 = null; rel(); }; };

    // ---- W1. the SAME row at the SAME moment: A renames, B retires ----
    { const { S, pa, pb, a, b } = await two();
      await openM(pa); await openM(pb);
      await type(pa, '[data-mtn="M1"]', 'Board A'); await type(pb, '[data-mtv="M1"]', false);
      const go = gate(S); await press(pa, '[data-mts="M1"]'); await press(pb, '[data-mts="M1"]'); await sleep(500); go(); await sleep(2500);
      const m = mat(S, 'M1'), ma = await mmsg(pa), mb = await mmsg(pb);
      const aWon = m.name === 'Board A', bWon = m.active === false;
      rec('W1 exactly ONE of the two same-moment saves landed (rename OR retire, not a mix written blind)', aWon !== bWon, JSON.stringify(m));
      const loser = aWon ? pb : pa, lmsg = aWon ? mb : ma;
      rec('W1 the loser is told "Not saved — changed on another screen"', /Not saved/.test(lmsg) && /another screen/.test(lmsg), JSON.stringify([ma, mb]));
      const lr = await mrow(loser, 'M1');
      rec('[HIGH] W1 the loser\'s row now shows the WINNER\'s change (' + (aWon ? 'name "Board A"' : 'Active unticked') + ')', aWon ? lr.name === 'Board A' : lr.act === false, JSON.stringify(lr));
      // the loser does their change again on the redrawn row
      if (aWon) await type(pb, '[data-mtv="M1"]', false); else await type(pa, '[data-mtn="M1"]', 'Board A');
      await press(loser, '[data-mts="M1"]'); await sleep(1800);
      const m2 = mat(S, 'M1');
      rec('[HIGH] W1 after the loser\'s second try BOTH changes stand: named "Board A" AND retired', m2.name === 'Board A' && m2.active === false, JSON.stringify([m2.name, m2.active, await mmsg(loser)]));
      rec('W1 the old name "MFC White" is kept as an other spelling', (m2.aliases || []).some(x => /^mfc white$/i.test(x)), JSON.stringify(m2.aliases));
      rec('W1: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await a.close(); await b.close(); }

    // ---- W2. A switches Sheet → Fitting and saves; B (window open since before) had typed a rename on that row + on another row ----
    { const { S, pa, pb, a, b } = await two();
      await openM(pa); await openM(pb);
      await type(pb, '[data-mtn="M1"]', '18mm MFC White'); await type(pb, '[data-mta="M3"]', 'Oak, OAK VNR'); await type(pb, '#mt-new-n', 'Walnut');
      await type(pa, '[data-mtk="M1"]', 'other'); await press(pa, '[data-mts="M1"]'); await sleep(1500);
      rec('W2 set-up: A switched MFC White to Fitting (asked first — it is used on a list)', mat(S, 'M1').kind === 'other' && /Change "MFC White" from Sheet/.test(await pa.evaluate(() => window.__asked.join('|'))), JSON.stringify(mat(S, 'M1')));
      await press(pb, '[data-mts="M1"]'); await sleep(1800);
      const m = mat(S, 'M1'), msg = await mmsg(pb), rb = await mrow(pb, 'M1');
      rec('[HIGH] W2 B\'s Save of the stale row does NOT put the board back to Sheet', m.kind === 'other', JSON.stringify(m));
      rec('W2 B is told it was not saved', /Not saved/.test(msg), msg);
      rec('W2 B\'s row now shows it as a Fitting', rb.kind === 'other', JSON.stringify(rb));
      rec('[MEDIUM] W2 B\'s typing on the OTHER row and the half-typed new material are still there', (await mrow(pb, 'M3')).al === 'Oak, OAK VNR' && (await pb.evaluate(() => document.getElementById('mt-new-n').value)) === 'Walnut', JSON.stringify([await mrow(pb, 'M3'), await pb.evaluate(() => document.getElementById('mt-new-n').value)]));
      rec('(info) [LOW] W2 the name B had typed on the refused row is kept in the box so it need not be typed again', rb.name === '18mm MFC White', JSON.stringify(rb));
      // B closes: asks (M3 + new material unsaved)
      await pb.evaluate(() => { window.__confirm = false; }); const q = await xClose(pb);
      rec('W2 Close asks, naming what is unsaved (Oak veneer, the new material Walnut)', /Close without saving/.test(q) && /Oak veneer/.test(q) && /Walnut/.test(q) && (await isOpen(pb)), q.slice(0, 200));
      rec('W2: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await a.close(); await b.close(); }

    // ---- W3. Close asks ONLY when something is unsaved ----
    { const { S, pa, a, b } = await two();
      await openM(pa); await pa.evaluate(() => { window.__confirm = false; });
      let q = await xClose(pa);
      rec('W3 nothing typed → Close closes at once, no question', q === '' && !(await isOpen(pa)), q);
      await openM(pa); await pa.evaluate(() => { window.__confirm = false; });
      await type(pa, '[data-mtn="M1"]', 'Something'); await type(pa, '[data-mtn="M1"]', 'MFC White'); await type(pa, '[data-mtk="M3"]', 'other'); await type(pa, '[data-mtk="M3"]', 'sheet'); await type(pa, '#mt-new-n', '   ');
      q = await xClose(pa);
      rec('W3 typed and put back exactly as it was (name, kind) + only spaces in the new box → no question', q === '' && !(await isOpen(pa)), q);
      await openM(pa); await pa.evaluate(() => { window.__confirm = false; });
      await type(pa, '[data-mta="M2"]', 'Blum 110'); q = await xClose(pa);
      rec('W3 only an "also called" typed → Close asks', /Close without saving/.test(q) && /Blum hinge/.test(q) && (await isOpen(pa)), q.slice(0, 160));
      await press(pa, '[data-mts="M2"]'); await sleep(1300); q = await xClose(pa);
      rec('W3 after that row is saved → Close closes with no question', q === '' && !(await isOpen(pa)) && (mat(S, 'M2').aliases || []).includes('Blum 110'), JSON.stringify([q, mat(S, 'M2').aliases]));
      // blank name
      await openM(pa); await type(pa, '[data-mtn="M3"]', '   '); await press(pa, '[data-mts="M3"]'); await sleep(600);
      rec('W3 a name wiped to spaces is refused ("needs a name"), nothing written', /needs a name/.test(await mmsg(pa)) && mat(S, 'M3').name === 'Oak veneer', await mmsg(pa));
      await closeAll(pa);
      rec('W3: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await a.close(); await b.close(); }

    // ---- W4. ＋ Add the SAME new name on two PCs at the same moment ----
    { const { S, pa, pb, a, b } = await two();
      await openM(pa); await openM(pb);
      await type(pa, '#mt-new-n', 'Zeta Board'); await type(pb, '#mt-new-n', 'zeta  board');
      const go = gate(S); await press(pa, '#mt-add'); await press(pb, '#mt-add'); await sleep(500); go(); await sleep(2500);
      const z = S.db.t.project_materials.filter(m => /^zeta\s+board$/i.test(m.name));
      rec('[MEDIUM] W4 the same new material added on two PCs in the same second ends up ONCE on the project list', z.length === 1, JSON.stringify([z.map(m => [m.id, m.name]), await mmsg(pa), await mmsg(pb)]));
      rec('W4: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await a.close(); await b.close(); }

    // ---- W5. "was retired — bring it back?" ----
    { const { S, pa, a, b } = await two();
      D.update(S.db, 'project_materials', mat(S, 'M3'), { active: false, aliases: ['Oak VNR'] });
      await reload(pa);
      await pa.evaluate(() => openListEditor('L1')); await sleep(900);
      const r = await rows(pa), si = r.findIndex(x => x.item === 'Side');
      const add = async (name, yes) => { await pa.evaluate(({ name, yes }) => { window.__asked = []; window.__prompted = []; window.__prompt = name; window.__confirm = yes; }, { name, yes }); await setv(pa, si + '|mat', '__add'); await sleep(1500); return pa.evaluate(() => window.__asked.join(' | ')); };
      let q = await add('oak  vnr', false);
      rec('W5 a retired material typed by its OTHER spelling in another case asks "was retired — bring it back?"', /was retired/.test(q) && /Oak veneer/.test(q), q.slice(0, 200));
      rec('W5 Cancel → still retired, the row keeps MFC White', mat(S, 'M3').active === false && (await rows(pa))[si].mat === 'MFC White', JSON.stringify([mat(S, 'M3').active, (await rows(pa))[si].mat]));
      q = await add('Oak veneer', true);
      rec('W5 OK → brought back (Active) and picked on the row under its real name', mat(S, 'M3').active !== false && (await rows(pa))[si].mat === 'Oak veneer', JSON.stringify([mat(S, 'M3').active, (await rows(pa))[si].mat, q.slice(0, 80)]));
      // a retired FITTING typed on the sized row: says it is a fitting, is NOT brought back
      D.update(S.db, 'project_materials', mat(S, 'M2'), { active: false }); await pa.evaluate(async () => { await lsMatFresh('P1'); });
      q = await add('blum hinge', true);
      rec('W5 a retired FITTING typed on a row with sizes: not brought back, row unchanged', mat(S, 'M2').active === false && (await rows(pa))[si].mat === 'Oak veneer', JSON.stringify([mat(S, 'M2').active, (await rows(pa))[si].mat, q.slice(0, 80), await L.toasts(pa)]));
      await closeAll(pa);
      rec('W5: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await a.close(); await b.close(); }

    // ---- W6. M4 the other way round: a fitting is picked on a row with NO sizes, THEN a length and width are typed ----
    { const { S, pa, a, b } = await two();
      await pa.evaluate(() => openListEditor('L1')); await sleep(900);
      const r = await rows(pa), hi = r.findIndex(x => x.item === 'Hinge');
      await setv(pa, hi + '|L', '300'); await sleep(150); await setv(pa, hi + '|W', '200'); await sleep(300);
      const box = await pa.evaluate(i => { const s = document.querySelector('.me-ed [data-mr="' + i + '|mat"]'); return s ? { v: s.value, txt: s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : '', amber: !!s.getAttribute('style') } : null; }, hi);
      await save(pa, 2200);
      const h = linesOf(S, 'L1').find(x => x.part === 'Hinge'), e = await err(pa);
      rec('(info) W6 fitting row given a length and width: what the window shows / saves', true, JSON.stringify({ box, saved: h && [h.kind, h.length_mm, h.width_mm, h.material, h.material_other], err: e }));
      rec('[MEDIUM] W6 a fitting on a row that now goes to the SAW is either refused or flagged (⚠ on screen, or "not on the project list" for the saw) — never a clean board row', !h || h.kind !== 'saw' || h.material_other === true || /fitting|⚠/.test(box.txt + e), JSON.stringify({ box, kind: h && h.kind, flagged: h && h.material_other, err: e }));
      await closeAll(pa);
      rec('W6: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await a.close(); await b.close(); }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
