// Tester round 7 (18 Nov) — attack on "＋ Add to several templates" (Garry 17 Nov). Every OTHER line of a template must come
// through untouched (× blocks, sub-headings, Edging 2, bought-in, a decimal Stores qty, an old-style total in a sub-heading);
// another PC archives / renames / saves a template mid-way; the save fails / loses its reply / never answers; odd characters;
// roles really drawn; the screen switched while the dialog is open; the grey background; phone 360 px.
// Fake Supabase only. Run: node tests/list-window/attack7-tpladd.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks } = L;
const M = 'MFC White', HB = 'Blum hinge';
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const F = ['kind', 'section', 'part', 'qty', 'unit_qty', 'length_mm', 'width_mm', 'material', 'material_other', 'edging', 'edging2', 'note'];
const norm = v => v == null || v === '' ? '' : String(v);
const sig = x => F.map(k => k + '=' + norm(k === 'material_other' ? (x[k] ? 1 : '') : (k === 'length_mm' || k === 'width_mm') && x[k] != null && x[k] !== '' ? +x[k] : x[k])).join(' ');
const changed = (S, id, before) => { const now = new Map(live(S, id).map(x => [x.id, x])); return before.filter(b => !now.has(b.id) || sig(now.get(b.id)) !== sig(b)).map(b => b.part + ': ' + sig(b) + ' → ' + (now.has(b.id) ? sig(now.get(b.id)) : 'GONE')); };
(async () => {
  const browser = await X.H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row());
    const T = (id, nm, lines, pid, x) => X.F3.seedList(S, id, { wos: [], name: nm, list: Object.assign({ is_template: true, type_name: nm, list_type: 'kitchen', project_id: pid || 'P1', version: 1, rev: 1 }, x || {}), lines });
    const H_ = (n, units, sec) => ['hdr', n, units == null ? null : String(units), null, null, null, '', '', sec ? { section: sec } : {}];
    // parts carry section = the heading above them, as the app saves them
    T('TA', 'TA rich', [H_('Carcass'), ['saw', 'Side', '2', 720, 560, M, '1mm ABS', 'grain up', { edging2: 'Cap Left', section: 'Carcass' }], ['buy', 'Worktop', '1', 3000, 600, 'Oak', '', '', { section: 'Carcass' }], ['fit', 'Tap', '1', null, null, 'Chrome mixer (not on the project)', '', '', { material_other: true, section: 'Carcass' }],
      H_('Floor 2', 4), H_('Fittings', null, 'Floor 2'), ['fit', 'Leg', '32', null, null, HB, '', '', { unit_qty: '8', section: 'Fittings' }], ['fit', 'Old clip', '6', null, null, HB, '', 'saved before 16 Nov', { section: 'Fittings' }],
      H_('Glue & co'), ['fit', 'Glue', '0.5', null, null, '', '', 'litre', { section: 'Glue & co' }]]);
    T('TB', 'TB subs', [H_('Fittings'), ['fit', 'Handle', '20', null, null, HB, '', '', { section: 'Fittings' }], H_('Hinges', null, 'Fittings'), ['fit', 'Hinge', '8', null, null, HB, '', '', { section: 'Hinges' }]]);
    T('TF', 'TF ends ×', [H_('Worktops'), ['saw', 'Worktop', '1', 3600, 600, M, '', '', { section: 'Worktops' }], H_('Floor 3', 2), ['fit', 'Leg', '16', null, null, HB, '', '', { unit_qty: '8', section: 'Floor 3' }]]);
    T('TC', 'TC archived midway', [['fit', 'Tap', '1', null, null, HB, '', '']]);
    T('TD', 'TD renamed midway', [['fit', 'Tap', '1', null, null, HB, '', '']]);
    T('TE', 'TE saved midway', [['fit', 'Tap', '1', null, null, HB, '', '']]);
    // project P2: two templates, one archived → no button
    L.D.insert(S.db, 'project_materials', { id: 'M9', project_id: 'P2', name: 'MFC Grey', kind: 'sheet' });
    T('TP1', 'P2 live', [['fit', 'Tap', '1', null, null, '', '', '']], 'P2'); T('TP2', 'P2 archived', [['fit', 'Tap', '1', null, null, '', '', '']], 'P2', { archived: true });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    const ALL = ['TA', 'TB', 'TF', 'TC', 'TD', 'TE', 'TP1', 'TP2'];
    await p.evaluate(async ids => { lsReset(); await lsLoad(); for (const id of ids) await lsReloadList(id); window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); lpfSet(''); render(); }, ALL); await sleep(600);
    const lastAlert = () => p.evaluate(() => window.__alerts.slice(-1)[0] || '');
    const open = async pid => { await closeAll(p); await p.evaluate(pid => lsTplAddDlg(pid), pid || 'P1'); await sleep(300); };
    const fill = (vals, ticks) => p.evaluate(({ vals, ticks }) => { for (const k of ['ta-item', 'ta-qty', 'ta-l', 'ta-w', 'ta-head']) document.getElementById(k).value = ''; for (const [k, v] of Object.entries(vals)) { const e = document.getElementById(k); e.value = v; e.dispatchEvent(new Event('input')); } document.querySelectorAll('[data-tat]').forEach(c => { c.checked = ticks.includes(c.dataset.tat); }); window.__asked = []; }, { vals, ticks });
    const go = async ms => { await p.evaluate(() => document.getElementById('ta-go').click()); await sleep(ms || 3500); };
    const run = async (vals, ticks, ms) => { await open(); await fill(vals, ticks); await go(ms); };

    // ---------- 1. every other line comes through untouched; × blocks and sub-headings ----------
    const bA = live(S, 'TA').map(x => Object.assign({}, x)), bB = live(S, 'TB').map(x => Object.assign({}, x)), bF = live(S, 'TF').map(x => Object.assign({}, x));
    const ODD = 'Cam <b>lock</b> "O\'Grady" 🔩';
    await run({ 'ta-item': ODD, 'ta-qty': '4', 'ta-mat': HB, 'ta-head': '  fittings ' }, ['TA', 'TB']);
    const cA = changed(S, 'TA', bA), cB = changed(S, 'TB', bB); if (cA.length || cB.length) console.log('   changed lines: ' + cA.concat(cB).join('\n   '));
    const cA1 = cA.filter(x => !/^(Tap|Old clip):/.test(x));
    rec('[HIGH if it fails] U1: TA — every other line is unchanged: parts, sizes, Edging 1 + 2, notes, bought-in, × 4 block, its sub-heading, per-unit qty, a decimal Stores qty', !cA1.length, cA1.join(' || '));
    rec('(LOW) U1b: TA — a Stores row flagged "not on the project\'s materials" (material_other) keeps its flag', !cA.some(x => /^Tap:/.test(x)), cA.filter(x => /^Tap:/.test(x)).join(''));
    rec('(LOW) U1c: TA — an old (before 16 Nov) total in a × block sub-heading is not rewritten (unit_qty "" → "fixed"; same total, but a line nobody touched is changed in the new Rev)', !cA.some(x => /^Old clip:/.test(x)), cA.filter(x => /^Old clip:/.test(x)).join(''));
    rec('[HIGH if it fails] U2: TB — every line that was there before is unchanged', !cB.length, cB.join(' || '));
    const nA = live(S, 'TA').find(x => x.part === ODD), nB = live(S, 'TB').find(x => x.part === ODD);
    rec('U3: the odd item name is stored exactly in both', !!nA && !!nB, JSON.stringify([nA && nA.part, nB && nB.part]));
    rec('U4: TA — "Fittings" there is only a sub-heading INSIDE the × 4 block → the new row is NOT in the block (qty 4, not 16; no per-unit qty)', nA && String(nA.qty) === '4' && !norm(nA.unit_qty), JSON.stringify(nA && { qty: nA.qty, unit_qty: nA.unit_qty, section: nA.section }));
    const tA = live(S, 'TA').map(x => x.part + (x.kind === 'hdr' ? '[H' + (x.qty ? '×' + x.qty : '') + ']' : ''));
    rec('(info, LOW) U5: TA ends with a SECOND heading called "fittings" (as typed, small f) next to the × block\'s "Fittings" — the saw sees two Fittings headings', tA.filter(x => /^fittings\[H/i.test(x)).length === 1, JSON.stringify(tA));
    const tB = live(S, 'TB').map(x => x.part);
    rec('(info) U6: TB (top heading "Fittings" with a sub-heading "Hinges" under it) → the row goes at the end of "Fittings" INCLUDING its sub-heading, i.e. after Hinge', tB[tB.length - 1] === ODD, JSON.stringify(tB));
    // the screen after: nothing from the name is turned into HTML
    await p.evaluate(() => { lpfSet(''); render(); }); await sleep(300);
    await p.evaluate(() => { try { openListEditor('TA'); } catch (e) {} }); await sleep(1200);
    const x1 = await p.evaluate(() => ({ b: [...document.querySelectorAll('b')].filter(e => e.textContent === 'lock').length, items: [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].map(e => e.value).filter(v => /Cam/.test(v)) }));
    rec('U7: the template opened in the window shows the name as typed, no bold tag made from it', x1.b === 0 && x1.items.length === 1, JSON.stringify(x1));
    await closeAll(p);
    // TF: no heading, template ends with a × block
    await run({ 'ta-item': 'Screws', 'ta-qty': '3', 'ta-mat': HB, 'ta-head': '' }, ['TF']);
    const lf = live(S, 'TF'), sc = lf.find(x => x.part === 'Screws'), cF = changed(S, 'TF', bF);
    rec('U8: TF ends with a × 2 block, no heading typed → "Added items" heading made, Screws qty 3 (not 6), other lines untouched', sc && String(sc.qty) === '3' && !norm(sc.unit_qty) && lf.some(x => x.kind === 'hdr' && x.part === 'Added items') && !cF.length, JSON.stringify([lf.map(x => x.part + ':' + x.qty), cF]));
    // the × heading itself chosen
    await run({ 'ta-item': 'Bracket', 'ta-qty': '2', 'ta-mat': HB, 'ta-head': 'Floor 3' }, ['TF']);
    const lf2 = live(S, 'TF'), br = lf2.find(x => x.part === 'Bracket');
    rec('(info, LOW) U9: heading "Floor 3" (the × 2 block itself) chosen → Bracket qty 2 is NOT multiplied, but a second plain "Floor 3" heading is made at the end', br && String(br.qty) === '2' && lf2.filter(x => x.kind === 'hdr' && x.part === 'Floor 3').length === 1, JSON.stringify(lf2.map(x => x.part + ':' + x.qty + (x.kind === 'hdr' ? '[H]' : ''))));

    // ---------- 2. another PC changes templates while the dialog is open ----------
    const tE = () => S.db.t.lists.find(l => l.id === 'TE');
    await open(); await fill({ 'ta-item': 'Sink', 'ta-qty': '1', 'ta-mat': HB, 'ta-head': '' }, ['TC', 'TD', 'TE']);
    const tc = S.db.t.lists.find(l => l.id === 'TC'), td = S.db.t.lists.find(l => l.id === 'TD');
    L.D.update(S.db, 'lists', tc, { archived: true, version: (+tc.version || 1) + 1 });
    L.D.update(S.db, 'lists', td, { type_name: 'TD renamed', name: 'TD renamed', version: (+td.version || 1) + 1 });
    let fired = false;
    await p.route('**/rpc/save_list_revision', async route => { try { const a = JSON.parse(route.request().postData() || '{}'); if (!fired && a.p_list && a.p_list.id === 'TE') { fired = true; const e = tE();
      L.D.update(S.db, 'lists', e, { version: (+e.version || 1) + 1, rev: (+e.rev || 1) + 1 }); L.D.insert(S.db, 'list_lines', { id: 'TE:other', list_id: 'TE', seq: 9, kind: 'fit', part: 'Other PC row', qty: '1', material: HB }); } } catch (e) {} return route.fallback(); });
    await go(4500); await p.unroute('**/rpc/save_list_revision');
    const al2 = await lastAlert();
    rec('W1: TC archived on another PC → NOT added, named in the message; it stays archived with no new row', /NOT added[\s\S]*TC/.test(al2) && S.db.t.lists.find(l => l.id === 'TC').archived && !live(S, 'TC').some(x => x.part === 'Sink'), al2);
    rec('W2: TD renamed on another PC → Sink added and the new name kept', live(S, 'TD').some(x => x.part === 'Sink') && S.db.t.lists.find(l => l.id === 'TD').type_name === 'TD renamed', JSON.stringify([S.db.t.lists.find(l => l.id === 'TD').type_name, live(S, 'TD').map(x => x.part)]));
    rec('W3: TE saved on another PC between the re-read and the save → the other PC\'s row is kept, and the person is told TE was NOT added (or it was added on top)', live(S, 'TE').some(x => x.part === 'Other PC row') && (live(S, 'TE').some(x => x.part === 'Sink') || /NOT added[\s\S]*TE/.test(al2)), JSON.stringify([live(S, 'TE').map(x => x.part), al2]));
    rec('(info, LOW wording) W4: the "NOT added" reason is in plain words (no "stale: list … version …")', !/stale|version|editor had/i.test(al2), al2);

    // ---------- 3. failed saves ----------
    const revOf = id => +(S.db.t.lists.find(l => l.id === id) || {}).rev || 1;
    let r0 = revOf('TB');
    S.fail3 = true; await run({ 'ta-item': 'Down', 'ta-qty': '1', 'ta-mat': HB }, ['TB']); S.fail3 = false;
    const al3 = await lastAlert();
    rec('F1: database down → "NOT added to: TB" said; nothing changed', /NOT added[\s\S]*TB/.test(al3) && !live(S, 'TB').some(x => x.part === 'Down') && revOf('TB') === r0, al3);
    await p.evaluate(() => { window.__alerts = []; window.__toasts = []; if (!window.__tw) { window.__tw = 1; const T0 = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return T0.apply(this, arguments); }; } });
    S.dropReply = 1; await run({ 'ta-item': 'Lost reply', 'ta-qty': '1', 'ta-mat': HB }, ['TB']); S.dropReply = 0;
    const al4 = await lastAlert(), to4 = await p.evaluate(() => window.__toasts.slice()), landed = live(S, 'TB').some(x => x.part === 'Lost reply');
    rec('F2: the save LANDED but its reply was lost → no "NOT added" alert; told "✓ Added to 1: TB subs"', landed && !al4 && to4.some(m => /✓ Added to 1: TB subs/.test(m)), JSON.stringify([landed, al4, to4]));
    await run({ 'ta-item': 'Lost reply', 'ta-qty': '1', 'ta-mat': HB }, ['TB']);
    rec('F3: …pressing again says "Already there" and does not add it twice', /Already there[\s\S]*TB/.test(await lastAlert()) && live(S, 'TB').filter(x => x.part === 'Lost reply').length === 1, await lastAlert());
    // no reply at all
    let release; S.hold3 = new Promise(r => { release = r; });
    await open(); await fill({ 'ta-item': 'Hang', 'ta-qty': '1', 'ta-mat': HB }, ['TB']); await go(12000);
    const h1 = await p.evaluate(() => ({ btn: (document.getElementById('ta-go') || {}).textContent || '(dialog gone)', dis: !!(document.getElementById('ta-go') || {}).disabled, err: (document.getElementById('ta-err') || {}).textContent || '' }));
    rec('(info, LOW) H1: no reply for 12 s → the person is told something (not just a greyed "Adding…")', !/Adding/.test(h1.btn) || !!h1.err, JSON.stringify(h1));
    S.hold3 = null; release(); await sleep(3000);
    rec('H2: …reply comes → the row is added once', live(S, 'TB').filter(x => x.part === 'Hang').length === 1);
    await closeAll(p);

    // ---------- 4. the screen switched to the PM while the dialog is open ----------
    await open(); await fill({ 'ta-item': 'Switched', 'ta-qty': '1', 'ta-mat': HB }, ['TB']);
    await p.evaluate(() => { localStorage.setItem('wpfPin_pm', pins().pm || '9000'); ROLE = 'pm'; render(); }); await sleep(300);
    const still = await p.evaluate(() => !!document.getElementById('ta-go'));
    if (still) await go(3000);
    rec('(LOW) S1: screen switched to Project Managers with the dialog still open → the add is refused (the list window re-checks at Save)', !live(S, 'TB').some(x => x.part === 'Switched'), JSON.stringify([still, live(S, 'TB').some(x => x.part === 'Switched')]));
    await closeAll(p); await p.evaluate(() => { ROLE = 'design'; render(); }); await sleep(300);

    // ---------- 5. the grey background ----------
    await open(); await fill({ 'ta-item': 'Typed a lot here', 'ta-qty': '2', 'ta-head': 'Fittings' }, ['TA', 'TB']);
    const c = await p.evaluate(() => { const e = document.getElementById('ta-item'); const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x, 2, { steps: 5 }); await p.mouse.up(); await sleep(300);
    rec('(MEDIUM/LOW) G1: selecting the Item text by dragging and letting go on the grey → the dialog STAYS open (same fault as the 17 Nov list-window hotfix)', await p.evaluate(() => !!document.getElementById('ta-go')));
    await closeAll(p);

    // ---------- 6. roles really drawn; project with one live template ----------
    for (const [role, want] of [['prod', true], ['pm', false], ['office', false], ['saw', false], ['stores', false]]) {
      const w = await p.evaluate(async rl => { localStorage.setItem('wpfPin_' + rl, pins()[rl] || '9000'); ROLE = rl; tab = 'l'; prodTab = 'lists'; lpfSet(''); render(); await new Promise(r => setTimeout(r, 300)); return { ok: roleOk(rl), btn: !!document.querySelector('[data-lhtpladd="P1"]'), lists: !!document.querySelector('[data-lhtpl]') }; }, role);
      rec('R: ' + role + (want ? ' sees' : ' does NOT see') + ' "＋ Add to several templates" (screen really drawn' + (want ? '' : '') + ')', w.ok && w.btn === want && (want ? w.lists : true), JSON.stringify(w));
    }
    const dpm = await p.evaluate(async () => { ROLE = 'pm'; window.__alerts = []; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsTplAddDlg('P1'); return !!document.getElementById('ta-go'); });
    rec('R: called directly on the PM screen → refused (no dialog)', !dpm);
    await p.evaluate(() => { ROLE = 'design'; lpfSet(''); render(); }); await sleep(300);
    rec('R: project with 2 templates but one ARCHIVED → no button', !(await p.evaluate(() => !!document.querySelector('[data-lhtpladd="P2"]'))));

    // ---------- 7. phone 360 ----------
    await p.setViewportSize({ width: 360, height: 640 }); await open();
    const ph = await p.evaluate(() => { const ids = ['ta-item', 'ta-qty', 'ta-l', 'ta-w', 'ta-mat', 'ta-head', 'ta-go']; const o = {}; ids.forEach(id => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); o[id] = { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), vis: r.top >= 0 && r.bottom <= innerHeight }; });
      const cb = document.querySelector('[data-tat]'); const rc = cb.getBoundingClientRect(); o.tick = { l: Math.round(rc.left), r: Math.round(rc.right), h: Math.round(rc.height) }; o.sw = document.documentElement.scrollWidth; return o; });
    rec('P1: phone 360 — every box, the tick boxes and "＋ Add to the ticked templates" are on screen (reachable by scrolling), no sideways scroll', Object.entries(ph).filter(([k]) => k !== 'sw').every(([k, v]) => v.l >= 0 && v.r <= 360 && (v.vis === undefined || v.vis)) && ph.sw <= 362, JSON.stringify(ph));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
