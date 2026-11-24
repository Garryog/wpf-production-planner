// Tester attack ROUND 3b (list window, 13 Nov): re-attack of the Coder's round-3 fixes —
//  2. (M1) Save pressed straight from the Floor / Unit / Title box: saved exactly ONCE, never on the wrong WO, never silently
//     when the look-up finds several or none; double-click; Ctrl+S; a press that was dragged off the button;
//  6. keys: Shift+Tab from the first cell and back, ✕ asks / does not ask;
//  7. Excel: empty WO / Floor / Unit labels are not headings — a real heading called "Floor" or "Unit 12" still is.
// Real typing and real mouse (so blur fires as on a PC). Fake Supabase only. Run: node tests/list-window/attack3b-save-keys-excel.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, rows, liveFor } = L;
const PROC = '5. WORK ORDER PROCESSED';
const o = (wo, floor, unit, title, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
const wait = async p => { await p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); }); await sleep(600); };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r0 = X.v2Row();
    r0.orders.push(o('WO-TA', '1', '12', 'BLOCK A APT 12 KITCHEN'), o('WO-DA', '3', '7', 'BLOCK A APT 7 KITCHEN'), o('WO-DB', '3', '7', 'BLOCK B APT 7 KITCHEN'),
      ...[50, 51, 52, 53, 54, 55, 56, 57].map(n => o('WO-N' + n, '5', String(n), 'APT ' + n + ' KITCHEN')));
    const S = X.makeServer(r0);
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    const t = await X.dev(browser, S, 'design'), p = t.page, kb = p.keyboard; await asks(p);
    const open = async () => { await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, '', 'PK'); }); await sleep(800); };
    const type = async (id, v) => { await p.click('#' + id); await kb.type(v); };
    const pnums = () => S.row.orders.filter(x => /^P-\d+$/.test(x.wo)).map(x => x.wo);
    const real = () => S.db.t.lists.filter(l => !l.is_template);
    const nowo = () => real().filter(l => !(l.wos || []).length && l.name !== 'House 1').length;
    const prep = async (f, u, ttl) => { await open(); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await sleep(200); await type('me-jf', f); await kb.press('Tab'); await kb.type(u); if (ttl != null) { await kb.press('Tab'); await kb.type(ttl); } };
    const after = async ms => { await sleep(ms || 2600); await wait(p); return { d: await donep(p), e: await err(p), asked: await p.evaluate(() => window.__asked.map(m => m.split('\n')[0].slice(0, 70))) }; };
    const p0 = pnums().length;

    // ---------- one match ----------
    let n0 = real().length; await prep('5', '50'); await p.click('#me-save'); let r = await after();
    rec('S1: Save pressed straight from the UNIT box (one WO fits) → saved on WO-N50, exactly ONE list', !!r.d && liveFor(S, 'WO-N50').length === 1 && real().length === n0 + 1, JSON.stringify([r.d && r.d.h, r.e, real().length - n0]));
    n0 = real().length; await prep('5', '51', 'APT 51'); await p.click('#me-save'); r = await after();
    rec('S2: Save pressed straight from the TITLE box → saved on WO-N51, exactly ONE list', !!r.d && liveFor(S, 'WO-N51').length === 1 && real().length === n0 + 1, JSON.stringify([r.d && r.d.h, r.e, real().length - n0]));
    n0 = real().length; await prep('5', '52'); await p.dblclick('#me-save'); r = await after(3200);
    rec('S3: DOUBLE-click on Save from the Unit box → ONE list on WO-N52, never two (and no "already has a list" question about its own first save)', liveFor(S, 'WO-N52').length === 1 && real().length === n0 + 1 && !r.asked.some(m => /ALREADY HAS/.test(m)), JSON.stringify([r.d && r.d.h, r.e, real().length - n0, r.asked]));
    n0 = real().length; await prep('5', '53', 'APT 53'); await p.click('#me-save', { clickCount: 3, delay: 40 }); r = await after(3200);
    rec('S3b: three quick clicks on Save from the Title box → ONE list on WO-N53', liveFor(S, 'WO-N53').length === 1 && real().length === n0 + 1, JSON.stringify([r.d && r.d.h, r.e, real().length - n0, r.asked]));
    // Floor box: Unit typed FIRST, then Floor, Save from the Floor box
    n0 = real().length; await open(); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await type('me-ju', '54'); await type('me-jf', '5'); await p.click('#me-save'); r = await after();
    const s4 = liveFor(S, 'WO-N54').length;
    rec('S4: Unit typed first, then Floor, Save pressed straight from the FLOOR box → one list on WO-N54, or a reason in words; never a list with no WO', (s4 === 1 && real().length === n0 + 1) || (real().length === n0 && r.e.length > 0), JSON.stringify([r.d && r.d.h, r.e, real().length - n0]));
    rec('(info) S4: …what happened: ' + (s4 ? 'saved on WO-N54 with the one press' : 'not saved — "' + r.e + '"'), true, '');
    // Ctrl+S
    n0 = real().length; await prep('5', '55'); await kb.press('Control+s'); r = await after();
    const s5 = liveFor(S, 'WO-N55').length;
    rec('S5: Ctrl+S from the Unit box → one list on WO-N55 or nothing at all; never two, never a list with no WO', (s5 === 1 && real().length === n0 + 1) || real().length === n0, JSON.stringify([r.d && r.d.h, r.e, real().length - n0]));
    rec('[LOW] S5: …Ctrl+S from the Unit box either saves or leaves a reason on the screen (not a silent nothing)', s5 === 1 || r.e.length > 0, JSON.stringify([r.d && r.d.h, r.e]));
    if (!s5) { await kb.press('Control+s'); r = await after(); rec('(info) S5: …a second Ctrl+S: ' + (liveFor(S, 'WO-N55').length ? 'saved' : 'still not saved — "' + r.e + '"'), true, ''); }
    n0 = real().length; await prep('5', '56', 'APT 56'); await kb.press('Control+s'); r = await after();
    rec('S5b: Ctrl+S from the Title box → never two lists, never one with no WO', real().length - n0 <= 1 && nowo() === 0, JSON.stringify([r.d && r.d.h, r.e, real().length - n0]));
    // the press was dragged OFF the button (the person changed their mind): mouse down on Save, moved away, let go
    n0 = real().length; await prep('5', '57');
    const bb = await p.evaluate(() => { const b = document.getElementById('me-save').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await p.mouse.move(bb.x, bb.y); await p.mouse.down(); await sleep(120); await p.mouse.move(bb.x - 500, bb.y - 300, { steps: 4 }); await p.mouse.up(); r = await after();
    rec('[LOW] S6: mouse pressed on Save from the Unit box, then dragged away and let go (no click — changed their mind) → nothing is saved', real().length === n0 && !r.d, JSON.stringify([r.d && r.d.h, r.e, real().length - n0]));

    // ---------- the one WO already has a list ----------
    n0 = real().length; await prep('5', '50'); await p.evaluate(() => { window.__confirm = m => !/already has/i.test(m); }); await p.click('#me-save'); r = await after();
    rec('S7: Save from the Unit box, the WO found (WO-N50) ALREADY has a list → the question is asked; Cancel → nothing saved', r.asked.some(m => /already has/i.test(m)) && real().length === n0 && !r.d, JSON.stringify([r.asked, r.e, real().length - n0]));
    await p.evaluate(() => { window.__confirm = true; });

    // ---------- several fit ----------
    n0 = real().length; await prep('3', '7'); await p.click('#me-save'); r = await after();
    let picks = await p.evaluate(() => [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick));
    rec('S8: two WOs fit Floor 3 · Unit 7, Save from the Unit box → NOTHING saved: no list, no list without a WO, no P-number', real().length === n0 && nowo() === 0 && pnums().length === p0 && !r.d, JSON.stringify([r.d && r.d.h, real().length - n0, pnums()]));
    rec('S8: …the window says to pick one of the work orders offered, and both are offered', /pick one of the work orders/i.test(r.e) && picks.includes('WO-DA') && picks.includes('WO-DB'), JSON.stringify([r.e, picks]));
    rec('S8: …and the rows typed are still there', (await rows(p))[0].item === 'Side');
    await p.click('.me-ed [data-jpick="WO-DB"]'); await sleep(500); await p.click('#me-save'); r = await after();
    rec('S8: …pick WO-DB, Save → one list on WO-DB, none on WO-DA', liveFor(S, 'WO-DB').length === 1 && liveFor(S, 'WO-DA').length === 0 && real().length === n0 + 1, JSON.stringify([r.d && r.d.h, r.e]));
    // the Title names BLOCK B, only BLOCK A's job has that floor + unit
    n0 = real().length; await prep('1', '12', 'BLOCK B APT 12'); await p.click('#me-save'); r = await after();
    rec('S9: Floor 1 · Unit 12 · Title "BLOCK B APT 12", Save from the Title box (only WO-TA = BLOCK A is there) → never saved on WO-TA, nothing saved at all, no P-number', liveFor(S, 'WO-TA').length === 0 && real().length === n0 && pnums().length === p0, JSON.stringify([r.d && r.d.h, r.e, r.asked]));
    rec('S9: …and a reason is on the screen', r.e.length > 0, r.e);

    // ---------- none fits ----------
    n0 = real().length; await prep('9', '99'); await p.click('#me-save'); r = await after();
    rec('S10: no WO for Floor 9 · Unit 99, Save from the Unit box → nothing saved, NO P-number made, no P-number question answered for the person', real().length === n0 && pnums().length === p0 && !r.d && !r.asked.some(m => /P-number/.test(m)), JSON.stringify([r.d && r.d.h, r.e, r.asked, pnums()]));
    rec('S10: …a reason is on the screen', r.e.length > 0, r.e);
    rec('[LOW] S10: …and the reason does not tell the person to do what they have just done ("type the Floor and the Unit, then press Find") — the look-up found nothing', !/type the Floor and the Unit/i.test(r.e), r.e);
    await p.dblclick('#me-save'); r = await after();
    rec('S10: …double-click Save again → still nothing saved, no P-number', real().length === n0 && pnums().length === p0, JSON.stringify([r.e, pnums()]));
    // no project picked
    await closeAll(p); await p.evaluate(() => { window.__asked = []; openListEditor(null, ''); }); await sleep(800);
    if (await p.evaluate(() => !!document.getElementById('me-jf'))) { n0 = real().length; await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await type('me-jf', '5'); await kb.press('Tab'); await kb.type('50'); await p.click('#me-save'); r = await after();
      rec('S11: no project picked, Floor / Unit typed, Save from the Unit box → nothing saved, a reason shown', real().length === n0 && nowo() === 0 && r.e.length > 0, JSON.stringify([r.d && r.d.h, r.e])); }
    else rec('(info) S11: with no project the Floor / Unit boxes are not shown', true, '');
    rec('S12: after all of it: not one list without a work order, not one P-number', nowo() === 0 && pnums().length === p0, JSON.stringify([nowo(), pnums()]));

    // ---------- 6. keys ----------
    const foc = () => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset && a.dataset.mr) || a.id || a.tagName + '.' + a.className : ''; });
    const inWin = () => p.evaluate(() => { const a = document.activeElement, w = document.querySelector('.me-ed'); if (!a || !w || !w.closest('.pod-ovl').contains(a)) return false; const b = a.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
    const openWo = async (wo, id) => { await closeAll(p); await p.evaluate(({ wo, id }) => { window.__asked = []; window.__confirm = true; openListEditor(id || null, wo); }, { wo, id }); await sleep(1100); };
    await openWo('WO-3'); await p.click('.me-ed [data-mr="0|item"]'); await kb.press('Shift+Tab'); await sleep(200);
    let f1 = await foc();
    rec('K1: Shift+Tab from the first cell → the focus is on something above the rows, visible, in the window (not Save, not ✕)', f1 !== '0|item' && await inWin() && !/me-save|me-x0/.test(f1), f1);
    await kb.press('Tab'); await sleep(200);
    rec('K1: …Tab comes back to the first cell', (await foc()) === '0|item', await foc());
    await kb.press('Shift+Tab'); await kb.press('Shift+Tab'); await sleep(150); const f2 = await foc(); await kb.press('Tab'); await kb.press('Tab'); await sleep(150);
    rec('K1b: two Shift+Tabs then two Tabs → back in the first cell (' + f2 + ' on the way)', (await foc()) === '0|item' && await inWin(), await foc());
    // the blank window (Floor / Unit / Title boxes above the rows)
    await open(); await p.click('.me-ed [data-mr="0|item"]'); await kb.press('Shift+Tab'); await sleep(250); f1 = await foc();
    rec('K2: blank window: Shift+Tab from the first cell → on a box above (the window is not redrawn under the cursor, focus not lost)', f1 !== '0|item' && await inWin(), f1);
    await kb.press('Tab'); await sleep(300);
    rec('K2: …Tab comes back to the first cell', (await foc()) === '0|item', await foc());
    // ✕
    const asked = () => p.evaluate(() => window.__asked.filter(m => /Close without saving/.test(m)).length);
    const x = async () => { await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await click(p, 'me-x0'); await sleep(300); };
    await openWo('WO-3'); await x();
    rec('X1: NEW list, nothing touched, ✕ → closes without asking', !(await ed(p)) && (await asked()) === 0, 'asked ' + await asked());
    await openWo('WO-3'); const mat = await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); const op = [...s.options].find(q => q.value && !/^__/.test(q.value)); if (!op) return ''; s.value = op.value; s.dispatchEvent(new Event('change')); return op.value; }); await sleep(300); await x();
    rec('X2: NEW list, only a material picked (' + mat + '), ✕ → asks; Cancel keeps the window', await ed(p) && (await asked()) === 1, 'asked ' + await asked());
    await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); s.value = ''; s.dispatchEvent(new Event('change')); }); await sleep(300); await x();
    rec('X2b: …the material taken out again, ✕ → nothing to lose: closes without asking', !(await ed(p)) && (await asked()) === 0, 'asked ' + await asked() + ' open ' + await ed(p));
    await openWo('WO-3'); await p.evaluate(() => document.querySelector('.me-ed [data-mbuy="0"]').click()); await sleep(300); await x();
    rec('X3: NEW list, only Bought in ticked, ✕ → asks', await ed(p) && (await asked()) === 1, 'asked ' + await asked());
    await p.evaluate(() => document.querySelector('.me-ed [data-mbuy="0"]').click()); await sleep(300); await x();
    rec('X3b: …un-ticked again, ✕ → closes without asking', !(await ed(p)) && (await asked()) === 0, 'asked ' + await asked() + ' open ' + await ed(p));
    // a saved list with a material, a Bought in row and an empty heading, only LOOKED at
    X.F3.seedList(S, 'LV', { wos: ['WO-4'], name: 'Viewed', lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Shelf', '4', 500, 300, 'MFC White', '', '']] });
    await p.evaluate(async () => { lsReset(); await lsLoad(); }); await openWo('', 'LV'); await sleep(300);
    await p.click('.me-ed [data-mr="0|item"]'); await kb.press('Tab'); await kb.press('Tab'); await kb.press('Shift+Tab'); await x();
    rec('X4: a SAVED list opened, only looked at (clicked and Tabbed through), ✕ → closes without asking', !(await ed(p)) && (await asked()) === 0, 'asked ' + await asked() + ' open ' + await ed(p));
    await openWo('', 'LV'); await p.evaluate(() => document.querySelector('.me-ed [data-mbuy="0"]').click()); await sleep(300); await x();
    rec('X5: a SAVED list, Bought in ticked on a row, ✕ → asks', await ed(p) && (await asked()) === 1, 'asked ' + await asked());
    await closeAll(p);

    // ---------- 7. Excel ----------
    const parse = aoa => p.evaluate(aoa => { try { const r = lsParseGrid(aoa); const rs = r.rows || r.lines || r; return { hd: rs.filter(x => x.k === 'hdr').map(x => String(x.item)), parts: rs.filter(x => x.k !== 'hdr').map(x => String(x.item)), order: rs.map(x => (x.k === 'hdr' ? '#' : '') + x.item), meta: r.meta || null }; } catch (e) { return { err: e.message }; } }, aoa);
    const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'], A = ['Side', 2, 720, 560, 'MFC White'], B = ['Shelf', 3, 500, 300, 'MFC White'];
    let g = await parse([['Project', 'Kildare'], ['WO', ''], ['Floor', ''], ['Unit', ''], [], COLS, A, B]);
    rec('E1: WO / Floor / Unit labels with EMPTY boxes → no headings called WO, Floor or Unit; both rows come in', !g.err && !g.hd.some(h => /^(wo|floor|unit)$/i.test(h)) && g.parts.length === 2, JSON.stringify(g));
    g = await parse([['Floor', ''], ['Unit', ''], [], COLS, A, B]);
    rec('E1b: only Floor / Unit labels, both empty → no junk headings', !g.err && !g.hd.length && g.parts.length === 2, JSON.stringify(g));
    g = await parse([['WO:', ''], ['Floor:', ''], ['Unit:', ''], COLS, A]);
    rec('E1c: "WO:" / "Floor:" / "Unit:" with a colon, empty → no junk headings', !g.err && !g.hd.length && g.parts.length === 1, JSON.stringify(g));
    g = await parse([['Unit', ''], ['Floor', ''], COLS, A]);
    rec('(info) E1d: the labels the other way round (Unit first, then Floor), both empty → headings: ' + JSON.stringify(g.hd), true, '');
    rec('[LOW] E1d: …no junk heading "Unit" when the empty Unit label comes BEFORE Floor', !g.err && !g.hd.some(h => /^unit$/i.test(h)), JSON.stringify(g.hd));
    // genuine headings typed by the drawing office, in among the rows
    g = await parse([COLS, ['Unit 12'], A, ['Unit 13'], B]);
    rec('E2: heading rows "Unit 12" / "Unit 13" among the rows → both come in as headings, in place', !g.err && JSON.stringify(g.order) === JSON.stringify(['#Unit 12', 'Side', '#Unit 13', 'Shelf']), JSON.stringify(g.order));
    g = await parse([COLS, ['Kitchen'], A, ['Unit'], B]);
    rec('E3: a heading row that says just "Unit" (a wall unit / base unit section) among the rows → still a heading', !g.err && g.hd.includes('Unit') && g.order.indexOf('#Unit') === 2, JSON.stringify(g.order));
    g = await parse([COLS, ['Kitchen'], A, ['Floor'], B]);
    rec('[MEDIUM] E4: a heading row that says just "Floor" among the rows (floor units / flooring section) → still comes in as a heading, in place — the rows under it must not slide under the heading above', !g.err && g.hd.includes('Floor') && g.order.indexOf('#Floor') === 2, JSON.stringify(g.order));
    g = await parse([['WO', '26114'], ['Floor', 'T10'], ['Unit', '2'], [], COLS, ['Floor'], A, ['Unit'], B]);
    rec('[MEDIUM] E4b: file with its job labels filled in, then headings "Floor" and "Unit" in the body → both headings kept; the job is still read (WO 26114 · T10 · 2)', !g.err && g.hd.includes('Floor') && g.hd.includes('Unit') && g.meta && g.meta.wo === '26114' && g.meta.floor === 'T10' && g.meta.unit === '2', JSON.stringify([g.order, g.meta]));
    g = await parse([COLS, ['Floor units'], A, ['FLOOR'], B, ['Works order'], A]);
    rec('(info) E5: headings "Floor units" / "FLOOR" / "Works order" in the body → ' + JSON.stringify(g.order), true, '');
    g = await parse([['Floor', ''], ['Unit', ''], COLS, ['Unit'], A]);
    rec('E6: empty Floor / Unit labels at the top, then a real "Unit" heading after the column row → that heading is kept', !g.err && g.hd.includes('Unit') && g.parts.length === 1, JSON.stringify(g.order));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
