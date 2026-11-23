// Tester attack ROUND 4 (16 Nov) on Garry's "✓ Save & close" (#me-saveclose, st.closeAfter): pressed twice fast, while a save or
// a material add is on its way, after Ctrl+S, when the save is refused (closeAfter must never leak into a later plain Save),
// from the Floor / Unit box of the work-order look-up (no WO yet), when the reply is lost / the save fails, with "Make new list
// from this" (the old-list warning must still reach the person), and on a phone at 360 px (pinned bar, both buttons ≥ 44 px).
// Real mouse where it matters (blur fires as on a PC). Fake Supabase only. Run: node tests/list-window/attack4-saveclose.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, asks, setv, setid, click, fillSaw, donep, err, rows, liveFor, linesOf } = L;
const PROC = '5. WORK ORDER PROCESSED';
const ord = (wo, floor, unit, title, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
const state = p => p.evaluate(() => { const sb = document.getElementById('me-save'), sc = document.getElementById('me-saveclose');
  return { open: !!document.querySelector('.me-ed'), panel: !!document.querySelector('.me-dov'), panelTxt: (document.querySelector('.me-dov') || {}).innerText || '', err: (document.getElementById('me-err') || {}).textContent || '',
    sDis: sb ? sb.disabled : null, scDis: sc ? sc.disabled : null, toasts: (window.__toasts || []).slice(), last: (window.__toasts || []).slice(-1)[0] || '', asked: (window.__asked || []).slice() }; });
const recToasts = p => p.evaluate(() => { window.__toasts = []; if (!window.__tw) { window.__tw = 1; const T = window.toast; window.toast = function (m, s) { window.__toasts.push(String(m)); return T.apply(this, arguments); }; } });
const firstRow = async p => (await rows(p)).findIndex(r => !r.hdr);
const newOn = async (p, wo, pid) => { await closeAll(p); await p.evaluate(({ wo, pid }) => { window.__asked = []; window.__confirm = true; window.__toasts = []; openListEditor(null, wo, pid || ''); }, { wo, pid }); await sleep(1000); };
const fill1 = async (p, item) => { const i = await firstRow(p); await fillSaw(p, i, item || 'Base side', '2', '720', '560', 'MFC White'); await sleep(150); return i; };
const hold = S => { S.hold3 = new Promise(r => { S.rel = () => { S.hold3 = null; r(); }; }); };
const box = (p, id) => p.evaluate(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, id);
const realPress = async (p, id, ms) => { const b = await box(p, id); if (!b) return 'no #' + id; await p.mouse.move(b.x, b.y); await p.mouse.down(); await sleep(ms || 90); await p.mouse.up(); return 'ok'; };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(ord('WO-ONE', '5', '50', 'APT 50 KITCHEN'), ord('WO-TWO', '6', '60', 'APT 60 KITCHEN'), ord('WO-K7', '7', '70', 'APT 70 KITCHEN'), ord('WO-K8', '8', '80', 'APT 80 KITCHEN'));
    const S = X.makeServer(r);
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    D.insert(S.db, 'project_materials', { id: 'MK1', project_id: 'PK', name: 'MFC White', kind: 'sheet' });
    const t = await X.dev(browser, S, 'design'), p = t.page, kb = p.keyboard; await asks(p); await recToasts(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });

    // ---------- A. pressed twice fast ----------
    await newOn(p, 'WO-3'); await fill1(p);
    await p.evaluate(() => { const b = document.getElementById('me-saveclose'); b.click(); b.click(); }); await sleep(2500);
    let s = await state(p);
    rec('A1 Save & close clicked twice in the same instant → ONE list on WO-3, the window closed, no Saved panel', liveFor(S, 'WO-3').length === 1 && !s.open && !s.panel, JSON.stringify([liveFor(S, 'WO-3').length, s.open, s.panel]));
    rec('A1 …and the second press did NOT ask "WO-3 already has a cutting list — save a second?"', !s.asked.some(a => /ALREADY HAS/.test(a)), JSON.stringify(s.asked));
    rec('A1 …and it says "Saved ✓ — list is with the Saw & Stores"', /Saved ✓ — list is with the Saw & Stores/.test(s.last), s.last);
    await newOn(p, 'WO-4'); await fill1(p);
    await p.dblclick('#me-saveclose'); await sleep(2500); s = await state(p);
    rec('A2 Save & close double-clicked with the real mouse → ONE list on WO-4, closed, nothing asked', liveFor(S, 'WO-4').length === 1 && !s.open && !s.panel && !s.asked.some(a => /ALREADY HAS/.test(a)), JSON.stringify([liveFor(S, 'WO-4').length, s.open, s.panel, s.asked]));

    // ---------- B. plain Save first, then Save & close while "Saving…" ----------
    await newOn(p, 'WO-TWO', 'PK'); await fill1(p);
    hold(S); await click(p, 'me-save'); await sleep(400);
    s = await state(p);
    rec('B1 set-up: plain Save pressed, the database is slow → "Checking… / Saving…" on screen, Save greyed', /Checking|Saving/.test(s.err) && s.sDis === true, JSON.stringify(s));
    rec('(info, simplicity) B1 while it saves, "✓ Save & close" still LOOKS pressable (it is not greyed like Save)', s.scDis === true, 'Save & close disabled=' + s.scDis);
    await click(p, 'me-saveclose'); await sleep(200); S.rel(); await sleep(2500); s = await state(p);
    rec('B1 …Save & close pressed meanwhile → still ONE list on WO-TWO', liveFor(S, 'WO-TWO').length === 1, String(liveFor(S, 'WO-TWO').length));
    rec('B1 …and the person sees a clear end: the Saved ✓ panel (from the first press) or the window closed with "Saved ✓"', (s.panel && /Saved ✓/.test(s.panelTxt)) || (!s.open && /Saved ✓/.test(s.last)), JSON.stringify([s.open, s.panel, s.last]));
    await closeAll(p);

    // ---------- C. Save & close, then the person presses the (greyed) plain Save with the mouse while it saves ----------
    await newOn(p, 'WO-K7', 'PK'); await fill1(p);
    hold(S); await click(p, 'me-saveclose'); await sleep(400);
    await realPress(p, 'me-save', 80); await sleep(200); S.rel(); await sleep(2500); s = await state(p);
    rec('[LOW] C1 Save & close, then a press on the GREYED Save while it is saving → the press is ignored: the window still closes (the person asked to close)', liveFor(S, 'WO-K7').length === 1 && !s.open && !s.panel, JSON.stringify([liveFor(S, 'WO-K7').length, s.open, s.panel]));
    await closeAll(p);

    // C2: Save & close, then Ctrl+S while it is saving (a PC)
    S.row.orders.push(ord('WO-C2', '12', '1', 'APT C2 KITCHEN')); await p.evaluate(async () => { await loadDB(); render(); }); await sleep(500);
    await newOn(p, 'WO-C2', 'PK'); const iC2 = await fill1(p);
    hold(S); await click(p, 'me-saveclose'); await sleep(300);
    await p.focus('.me-ed [data-mr="' + iC2 + '|qty"]').catch(() => {}); await kb.press('Control+s'); await sleep(200); S.rel(); await sleep(2500); s = await state(p);
    rec('C2 Save & close, then Ctrl+S while it is saving → ONE list, the window closes (Ctrl+S during the save does nothing)', liveFor(S, 'WO-C2').length === 1 && !s.open && !s.panel, JSON.stringify([liveFor(S, 'WO-C2').length, s.open, s.panel]));
    await closeAll(p);

    // ---------- D. a box changed WHILE Save & close is saving ----------
    await newOn(p, 'WO-K8', 'PK'); const iD = await fill1(p, 'Original');
    hold(S); await click(p, 'me-saveclose'); await sleep(400);
    await setv(p, iD + '|item', 'Changed while saving'); await sleep(100); S.rel(); await sleep(3000); s = await state(p);
    const savedItem = (linesOf(S, (liveFor(S, 'WO-K8')[0] || {}).id).find(x => x.kind === 'saw') || {}).part;
    const onScreen = s.open ? (await rows(p)).map(r0 => r0.item) : [];
    rec('[HIGH] D1 a row changed while Save & close was saving → NEVER closed silently with that change lost: the list is open again and the person is warned', s.open && s.toasts.some(m => /NOT saved/.test(m)), JSON.stringify([savedItem, s.open, s.last.slice(0, 150)]));
    rec('D1 …the database has the rows as they were when Save & close was pressed ("Original"), once', savedItem === 'Original' && liveFor(S, 'WO-K8').length === 1, JSON.stringify([savedItem, liveFor(S, 'WO-K8').length]));
    rec('(info) D1 what the reopened window shows', true, JSON.stringify(onScreen.slice(0, 3)));
    await closeAll(p);

    // ---------- E. Save & close while a NEW material is being added to the project ----------
    // a job with no list yet in PK
    S.row.orders.push(ord('WO-K9', '9', '90', 'APT 90 KITCHEN')); await p.evaluate(async () => { await loadDB(); render(); }); await sleep(600);
    await newOn(p, 'WO-K9', 'PK'); const iE = await fill1(p);
    hold(S); await p.evaluate(() => { window.__prompt = 'Kronospan Oak 18'; });
    await setv(p, iE + '|mat', '__add'); await sleep(300);
    s = await state(p);
    rec('E1 set-up: a new material is being added (the database is slow) → Save is greyed', s.sDis === true, JSON.stringify([s.sDis, s.err]));
    await click(p, 'me-saveclose'); await sleep(300); s = await state(p);
    rec('[LOW] E1 Save & close pressed during the material add → nothing saved yet AND the person is told why (not a dead button)', liveFor(S, 'WO-K9').length === 0 && (/material|Wait/i.test(s.err) || s.scDis === true), JSON.stringify([liveFor(S, 'WO-K9').length, s.err, s.scDis]));
    S.rel(); await sleep(1500); await p.evaluate(() => { window.__prompt = 'Op'; });
    s = await state(p);
    rec('E2 …the material add finished → nothing was saved by itself (no hidden Save & close went off)', liveFor(S, 'WO-K9').length === 0 && s.open && !s.panel, JSON.stringify([liveFor(S, 'WO-K9').length, s.open, s.panel]));
    await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('E3 …then the plain Save → saved and the Saved ✓ panel shows (no leak from the Save & close press)', liveFor(S, 'WO-K9').length === 1 && s.panel, JSON.stringify([liveFor(S, 'WO-K9').length, s.open, s.panel]));
    await closeAll(p);

    // ---------- F. refused, then a plain Save / Ctrl+S: closeAfter must not leak ----------
    // F1: refused by the "WO already has a list" question (Cancel), then Save → OK
    await newOn(p, 'WO-3'); await fill1(p, 'Second try');
    await p.evaluate(() => { window.__confirm = false; }); await click(p, 'me-saveclose'); await sleep(1500); s = await state(p);
    rec('F1 set-up: Save & close on WO-3 (has a list) → asked, Cancel → NOT saved, window open, says why', s.open && /NOT saved/.test(s.err) && liveFor(S, 'WO-3').length === 1, JSON.stringify([s.err, liveFor(S, 'WO-3').length]));
    await p.evaluate(() => { window.__confirm = true; }); await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('F1 …then the plain Save (OK to a second list) → the Saved ✓ panel, not closed', s.panel && liveFor(S, 'WO-3').length === 2, JSON.stringify([s.open, s.panel, liveFor(S, 'WO-3').length]));
    await closeAll(p);
    // F2: refused (no quantity), then Ctrl+S on a PC
    await newOn(p, 'WO-ONE', 'PK'); let iF = await firstRow(p); await setv(p, iF + '|item', 'No qty yet'); await sleep(150);
    await click(p, 'me-saveclose'); await sleep(800); s = await state(p);
    rec('F2 set-up: Save & close with a row with no quantity → refused, window open', s.open && s.err.length > 0 && !liveFor(S, 'WO-ONE').length, s.err);
    await fillSaw(p, iF, 'No qty yet', '1', '500', '400', 'MFC White'); await sleep(150);
    await p.focus('.me-ed [data-mr="' + iF + '|qty"]'); await kb.press('Control+s'); await sleep(2500); s = await state(p);
    rec('F2 …then Ctrl+S → saved and the Saved ✓ panel shows (Ctrl+S = the plain Save, no leak)', liveFor(S, 'WO-ONE').length === 1 && s.panel, JSON.stringify([liveFor(S, 'WO-ONE').length, s.open, s.panel, s.err, await rows(p)]));
    if (!s.panel) { await click(p, 'me-save'); await sleep(2500); s = await state(p); }
    // F3: from the panel, "Edit it again", change a row, Save & close → closes
    await p.evaluate(() => document.getElementById('me-dagain').click()); await sleep(1200);
    const iF3 = await firstRow(p); await setv(p, iF3 + '|qty', '3'); await sleep(150);
    await click(p, 'me-saveclose'); await sleep(2500); s = await state(p);
    const lF = liveFor(S, 'WO-ONE')[0];
    rec('F3 Saved panel → Edit it again → change a quantity → Save & close → the new quantity is saved, window closed, "Saved ✓"', !!lF && linesOf(S, lF.id).some(x => x.qty === '3') && !s.open && !s.panel && /Saved ✓/.test(s.last), JSON.stringify([lF && lF.rev, s.open, s.panel, s.last]));
    // F4: an existing list opened, nothing changed, Save & close
    await p.evaluate(id => { window.__toasts = []; openListEditor(id); }, lF.id); await sleep(1200);
    const rev0 = +lF.rev; await click(p, 'me-saveclose'); await sleep(2000); s = await state(p);
    rec('F4 an existing list, nothing changed, Save & close → closes, writes nothing (still Rev ' + rev0 + ')', !s.open && !s.panel && +liveFor(S, 'WO-ONE')[0].rev === rev0, JSON.stringify([s.open, s.panel, liveFor(S, 'WO-ONE')[0].rev, s.last]));
    await closeAll(p);
    // F5: refused because the template "what changed" prompt was cancelled, then plain Save
    X.F3.seedList(S, 'TK', { wos: [], name: 'Type K', list: { is_template: true, type_name: 'Type K', list_type: 'kitchen', project_id: 'PK' } });
    await p.evaluate(async () => { lsReset(); await lsLoad(); }); await p.evaluate(() => { window.__toasts = []; openListEditor('TK'); }); await sleep(1200);
    const iT = await firstRow(p); await setv(p, iT + '|qty', '9'); await sleep(150);
    await p.evaluate(() => { window.__prompt = null; }); await click(p, 'me-saveclose'); await sleep(1000); s = await state(p);
    const tRev0 = +(S.db.t.lists.find(l => l.id === 'TK') || {}).rev || 1;
    rec('F5 set-up: a template, Save & close → "What changed?" → Cancel → nothing saved, window open', s.open && tRev0 === 1, JSON.stringify([s.open, tRev0]));
    await p.evaluate(() => { window.__prompt = 'qty'; }); await click(p, 'me-save'); await sleep(2500); s = await state(p);
    rec('F5 …then the plain Save → "Template saved ✓" panel (not closed by the earlier Save & close)', s.panel && /Template saved/.test(s.panelTxt), JSON.stringify([s.open, s.panel, s.panelTxt.slice(0, 80)]));
    await p.evaluate(() => { window.__prompt = 'Op'; }); await closeAll(p);

    // ---------- G. the work-order look-up path: Floor + Unit typed, no WO yet, Save & close straight from the box ----------
    // G0 (control): the same with the plain Save button — fixed in round 3 (attack3 W5): one press is enough
    S.row.orders.push(ord('WO-G0', '13', '30', 'APT 30 KITCHEN')); await p.evaluate(async () => { await loadDB(); render(); }); await sleep(500);
    await newOn(p, '', 'PK'); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
    await p.click('#me-jf'); await kb.type('13'); await kb.press('Tab'); await kb.type('30');
    { const b = await box(p, 'me-save'); await p.mouse.click(b.x, b.y); } await sleep(2500); s = await state(p);
    rec('G0 (control) the PLAIN Save pressed straight from the Unit box → one press saves on WO-G0 (Saved ✓ panel)', liveFor(S, 'WO-G0').length === 1 && s.panel, JSON.stringify([liveFor(S, 'WO-G0').length, s.open, s.panel, s.err]));
    await closeAll(p);
    for (const [lbl, ms, from] of [['quick click', 0, 'unit'], ['a human press (120 ms)', 120, 'unit'], ['quick click', 0, 'title']]) {
      S.db.t.lists.filter(l => (l.wos || []).includes('WO-TWO')).forEach(l => { l.archived = true; }); await p.evaluate(async () => { lsReset(); await lsLoad(); });
      await newOn(p, '', 'PK'); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
      await p.click('#me-jf'); await kb.type('6'); await kb.press('Tab'); await kb.type('60'); if (from === 'title') { await kb.press('Tab'); await kb.type('APT 60'); }
      const b = await box(p, 'me-saveclose');
      if (ms) { await p.mouse.move(b.x, b.y); await p.mouse.down(); await sleep(ms); await p.mouse.up(); } else await p.mouse.click(b.x, b.y);
      await sleep(2500); s = await state(p);
      const ok1 = liveFor(S, 'WO-TWO').length === 1 && !s.open;
      rec('[MEDIUM] G1 rows typed, Floor 6 · Unit 60' + (from === 'title' ? ' · Title' : '') + ' typed, Save & close pressed straight from the ' + from + ' box (' + lbl + ') → ONE press saves on WO-TWO and closes — or the window says why not',
        ok1 || (s.open && s.err.trim().length > 0 && !/^(Saving|Checking)/.test(s.err)), JSON.stringify([liveFor(S, 'WO-TWO').length, s.open, s.panel, s.err, await p.evaluate(() => (document.getElementById('me-wo') || {}).value || (document.getElementById('me-hwo') || {}).textContent || '')]));
      if (!ok1 && s.open) { await click(p, 'me-saveclose'); await sleep(2500); s = await state(p); }
      rec('G1 …(' + from + ', ' + lbl + ') at the latest a second press saves it on WO-TWO and closes; never a P-number, never two lists', liveFor(S, 'WO-TWO').length === 1 && !s.open && !S.row.orders.some(o => /^P-\d+$/.test(o.wo)), JSON.stringify([liveFor(S, 'WO-TWO').length, s.open, s.err]));
      await closeAll(p);
    }

    // ---------- H. the reply is lost / the save fails ----------
    S.row.orders.push(ord('WO-H1', '11', '1', 'APT 1 KITCHEN'), ord('WO-H2', '11', '2', 'APT 2 KITCHEN')); await p.evaluate(async () => { await loadDB(); render(); }); await sleep(600);
    await newOn(p, 'WO-H1', 'PK'); await fill1(p);
    S.dropReply = 1; await click(p, 'me-saveclose'); await sleep(3500); s = await state(p);
    rec('H1 Save & close, the reply is LOST (it did land) → the window does not vanish without a word: it stays open and says it saved / may have saved', s.open && /saved/i.test(s.err), JSON.stringify([s.open, s.panel, s.err, s.last]));
    await click(p, 'me-saveclose'); await sleep(2500); s = await state(p);
    rec('H1 …Save & close again → still ONE list on WO-H1 (never a second), and the window closes', liveFor(S, 'WO-H1').length === 1 && !s.open, JSON.stringify([liveFor(S, 'WO-H1').length, s.open, s.err, s.last]));
    await closeAll(p);
    await newOn(p, 'WO-H2', 'PK'); await fill1(p);
    S.offline3 = true; await click(p, 'me-saveclose'); await sleep(3500); s = await state(p);
    const rowsKept = s.open ? (await rows(p)).some(x => x.item === 'Base side') : false;
    rec('H2 Save & close while OFFLINE → window stays open, "Not saved / may have saved" in words, the rows still on screen', s.open && /not saved|may have saved|could not|offline|connection/i.test(s.err) && rowsKept, JSON.stringify([s.open, s.err, rowsKept]));
    S.offline3 = false; await click(p, 'me-save'); await sleep(3500); s = await state(p);
    rec('H2 …back online, the plain Save → ONE list and the Saved ✓ panel (not closed — no leak from the failed Save & close)', liveFor(S, 'WO-H2').length === 1 && (s.panel || (s.open && /saved/i.test(s.err))), JSON.stringify([liveFor(S, 'WO-H2').length, s.open, s.panel, s.err]));
    await closeAll(p);

    // ---------- I. "Make new list from this" + Save & close: the warning about the OLD list must reach the person ----------
    {
      const old = liveFor(S, 'WO-H2')[0];
      await p.evaluate(({ id, wo }) => { window.__toasts = []; window.__asked = []; window.__confirm = true;
        openListEditor(null, wo, 'PK', { rows: lsEditRows(id), name: 'New from old', from: { id, name: lsList(id).name, sig: lsOldSig(id), lines: lsOldLines(id) }, note: 'Copied' }); }, { id: old.id, wo: 'WO-H2' }); await sleep(1200);
      // another screen changes the old list after it was copied
      const ln = linesOf(S, old.id).find(x => x.kind === 'saw'); ln.qty = '7';
      await p.evaluate(() => { window.__confirm = m => !/changed on another screen/.test(m); }); // "Archive it anyway?" → Cancel (leave it with the saw)
      await click(p, 'me-saveclose'); await sleep(3000); s = await state(p);
      const oldArch = !!(S.db.t.lists.find(l => l.id === old.id) || {}).archived;
      const seen = s.open ? s.panelTxt + ' ' + s.err : s.last; // what is ON SCREEN after the press (the last toast if the window closed)
      rec('I1 set-up: the new list saved; the old list (changed on another screen) left with the saw as chosen', !oldArch && S.db.t.lists.some(l => l.name === 'New from old' && !l.archived), JSON.stringify([oldArch, s.open, s.asked.slice(-1)]));
      rec('[MEDIUM] I1 Save & close → the warning "the old list was changed on another screen — left with the saw: check it and archive it" is what the person is LEFT seeing (not overwritten by a plain "Saved ✓")', /left with the saw|still with the saw|check it and archive/.test(seen), JSON.stringify([s.open, s.panel, seen.slice(0, 220), s.toasts.map(x => x.slice(0, 80))]));
      await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
    }

    // ---------- J. phone, 360 px ----------
    for (const role of ['office', 'prod', 'design']) {
      const tp = await X.dev(browser, S, role, { viewport: { width: 360, height: 640 } }), pp = tp.page; await asks(pp); await recToasts(pp);
      await pp.evaluate(async () => { lsReset(); await lsLoad(); lsNewStd('WO-6'); }); await sleep(1300);
      const f = await pp.evaluate(() => { const g = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, h = document.elementFromPoint(x, y);
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right), hit: !!h && (h === e || e.contains(h)) }; };
        const ft = document.querySelector('.me-ed .me-foot'); return { pos: ft ? getComputedStyle(ft).position : '', fh: ft ? Math.round(ft.getBoundingClientRect().height) : 0, save: g('me-save'), sc: g('me-saveclose'), side: document.documentElement.scrollWidth - document.documentElement.clientWidth, vh: innerHeight }; });
      rec('J1 ' + role + ' 360 px: the bottom bar is pinned and BOTH "Save list" and "✓ Save & close" are on the screen, tappable (not covered)', f.pos === 'sticky' && f.save && f.sc && f.save.hit && f.sc.hit && f.save.bottom <= f.vh && f.sc.bottom <= f.vh && f.side <= 0, JSON.stringify(f));
      rec('J1 ' + role + ' 360 px: both are thumb-sized (≥ 44 px tall); Save & close is the wide one', f.save && f.sc && f.save.h >= 44 && f.sc.h >= 44 && f.sc.w >= 360 * 0.7, JSON.stringify([f.save, f.sc]));
      rec('(info) [LOW] ' + role + ' 360 px: pinned bar height ' + f.fh + ' px of 640', f.fh <= 160, String(f.fh));
      // scrolled to the middle of the list: still both reachable
      await pp.evaluate(() => { const i = document.querySelector('.me-ed'), s0 = i.closest('.pod-in') || i; s0.scrollTop = s0.scrollHeight / 2; }); await sleep(200);
      const f2 = await pp.evaluate(() => ['me-save', 'me-saveclose'].map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === e || e.contains(h)) && r.bottom <= innerHeight; }));
      rec('J2 ' + role + ' 360 px, scrolled half way down the list: both buttons still on screen and tappable', f2.every(Boolean), JSON.stringify(f2));
      if (role === 'office') {
        const i = (await rows(pp)).findIndex(r0 => !r0.hdr); await fillSaw(pp, i, 'Phone row', '1', '600', '500', 'MFC White'); await sleep(150);
        await pp.click('#me-saveclose'); await sleep(2500); const sp = await state(pp);
        rec('J3 office 360 px: Save & close tapped → saved, window gone, "Saved ✓" shown', liveFor(S, 'WO-6').length === 1 && !sp.open && !sp.panel && /Saved ✓/.test(sp.last), JSON.stringify([liveFor(S, 'WO-6').length, sp.open, sp.last]));
      }
      await tp.ctx.close().catch(() => {});
    }
    rec('no page errors', !(S.errors || []).length && !(t.errors || []).length, JSON.stringify([S.errors, t.errors]));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
