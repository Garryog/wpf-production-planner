// d19-6 (Garry 19 Nov). (A) Garry's case first: a template put into a list left blank lines — the standard layout's empty rows
// and empty sub-headings stayed when (1) the house heading had been re-titled by picking the WO, or (2) a colour was picked on
// an empty row. Rule now: whenever a template goes into a list, untouched empty rows and empty standard sub-headings are
// removed; anything typed stays. (B) ＋ List / ＋ Add cutting list when the project has templates: "Start this list from:
// [Type A] [Type B] … or [Blank standard layout]" first; a template opens the window with ONLY its rows (+ the WO filled).
// Fake Supabase only. Run: node tests/deliveries/d19-6-template-first.test.js
const L = require('../list-window/lw.js');
const { X, sleep, rec, closeAll, asks, setv, setid, rows } = L;
const insert = async (p, tid) => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
  await p.evaluate(tid => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-itt="' + tid + '"]').click(); }, tid); await sleep(900); await p.evaluate(() => { const hk = document.getElementById('it-hok'); if (hk) hk.click(); }); await sleep(300); };
const blankRows = rs => rs.filter(r => !r.hdr && !r.item && !r.qty && !r.L && !r.W).length;
const STD = ['Fillers and Kickers', 'Worktops', 'Stores items'];
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type A', list: { is_template: true, type_name: 'Type A', list_type: 'house' } });
    X.F3.seedList(S, 'T2', { wos: [], name: 'Type B', list: { is_template: true, type_name: 'Type B', list_type: 'house' } });
    const tl = S.db.t.list_lines.filter(x => x.list_id === 'T1' && x.removed_rev == null);
    const tItems = tl.filter(x => x.kind !== 'hdr').map(x => x.part);
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // ---------- (A1) Garry's case: blank standard layout, the WO picked afterwards (heading re-titled), then a template
    await p.evaluate(() => openListEditor(null, '', 'P1', { std: true, rows: lsStdRows(null), note: 'x' })); await sleep(900);
    const j0 = await p.evaluate(() => { const t = document.getElementById('me-jobtog'); if (t) t.click(); return !!document.getElementById('me-wo'); }); await sleep(300);
    await setid(p, 'me-wo', 'WO-3'); await sleep(400);
    const r0 = await rows(p);
    rec('set-up A1: the house heading followed the WO ("House 13")', j0 && r0[0] && r0[0].hdr && r0[0].item === 'House 13', JSON.stringify(r0.slice(0, 2)));
    await insert(p, 'T1');
    const r1 = await rows(p);
    rec('A1: template in → no blank rows left', blankRows(r1) === 0, JSON.stringify(r1.map(r => (r.hdr ? '#' : '') + (r.item || '∅'))));
    rec('A1: …and no empty standard sub-headings left', !r1.some(r => r.hdr && STD.includes(r.item)), JSON.stringify(r1.filter(r => r.hdr).map(r => r.item)));
    rec('A1: every template row is in', tItems.every(i => r1.some(r => r.item === i)), JSON.stringify(tItems));
    await closeAll(p);
    // ---------- (A2) a colour picked on an empty row, then a template
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const j = (await rows(p)).findIndex(r => !r.hdr);
    const picked = await p.evaluate(j => { const s = document.querySelector('.me-ed [data-mr="' + j + '|mat"]'); const o = [...s.options].find(x => x.value && x.value !== '__add'); if (!o) return false; s.value = o.value; s.dispatchEvent(new Event('change')); return true; }, j); await sleep(200);
    await insert(p, 'T1');
    const r2 = await rows(p);
    rec('A2: colour picked on an empty row + template → no blank rows, no empty standard sub-headings', picked && blankRows(r2) === 0 && !r2.some(r => r.hdr && STD.includes(r.item)), JSON.stringify([picked, r2.map(r => (r.hdr ? '#' : '') + (r.item || '∅'))]));
    await closeAll(p);
    // ---------- (A3) something typed under Worktops stays (with its heading); the other empty rows / sub-headings go
    await p.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const r3a = await rows(p); const wi = r3a.findIndex(r => r.hdr && r.item === 'Worktops') + 1;
    await setv(p, wi + '|item', 'My worktop'); await setv(p, wi + '|qty', '1'); await sleep(200);
    await insert(p, 'T1');
    const r3 = await rows(p);
    rec('A3: the typed row and its "Worktops" heading stay; the house heading stays', r3.some(r => r.item === 'My worktop') && r3.some(r => r.hdr && r.item === 'Worktops') && r3[0].hdr && r3[0].item === 'House 13', JSON.stringify(r3.map(r => (r.hdr ? '#' : '') + (r.item || '∅'))));
    rec('A3: no blank rows; "Fillers and Kickers" / "Stores items" (empty) gone; the template is in', blankRows(r3) === 0 && !r3.some(r => r.hdr && (r.item === 'Fillers and Kickers' || r.item === 'Stores items')) && tItems.every(i => r3.some(r => r.item === i)), JSON.stringify(r3.map(r => (r.hdr ? '#' : '') + (r.item || '∅'))));
    await p.keyboard.press('Control+z'); await sleep(300);
    const r3u = await rows(p);
    rec('A3: Undo puts the layout back as it was', r3u.length === r3a.length && r3u.some(r => r.item === 'My worktop'), JSON.stringify([r3u.length, r3a.length]));
    await closeAll(p);
    // ---------- (B) ＋ List with templates → "Start this list from:" first (lsNewChoose = the Deliveries card ＋ List / ⓘ ＋ Add cutting list)
    await p.evaluate(() => lsNewChoose('WO-3')); await sleep(900);
    const b0 = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return { ed: !!document.querySelector('.me-ed'), txt: o ? o.innerText.replace(/\s+/g, ' ') : '', btns: [...document.querySelectorAll('[data-sfl]')].map(b => b.textContent.trim()) }; });
    rec('B: project with templates → "Start this list from:" Type A, Type B or Blank standard layout (window not open yet)', !b0.ed && /Start this list from/.test(b0.txt) && b0.btns.some(x => /Type A/.test(x)) && b0.btns.some(x => /Type B/.test(x)) && b0.btns.some(x => /Blank standard layout/.test(x)), JSON.stringify(b0));
    await p.evaluate(() => [...document.querySelectorAll('[data-sfl]')].find(b => /Type A/.test(b.textContent)).click()); await sleep(1500);
    const b1 = await rows(p); const bj = await L.job(p);
    rec('B: Type A → the window opens with ONLY the template rows (no blank lines, no standard sub-headings)', b1.length > 0 && blankRows(b1) === 0 && !b1.some(r => r.hdr && STD.includes(r.item)) && tItems.every(i => b1.some(r => r.item === i)), JSON.stringify(b1.map(r => (r.hdr ? '#' : '') + (r.item || '∅'))));
    rec('B: …on WO-3 (the WO is filled in)', /WO-3/.test(bj.hwo || '') || bj.wo === 'WO-3', JSON.stringify(bj));
    await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2500);
    const sv = L.liveFor(S, 'WO-3'); const tln = S.db.t.list_lines.filter(x => x.list_id === 'T1' && x.removed_rev == null).length;
    rec('B: Save → one list on WO-3 with the template\'s ' + tln + ' lines; the template itself unchanged', sv.length === 1 && L.linesOf(S, sv[0].id).length === tln && S.db.t.list_lines.filter(x => x.list_id === 'T1' && x.removed_rev == null).length === tl.length, JSON.stringify([sv.length, sv[0] && L.linesOf(S, sv[0].id).length, tln, await L.err(p)]));
    await closeAll(p);
    // the other WO for the rest (WO-3 has a list now)
    await p.evaluate(() => lsNewChoose('WO-4')); await sleep(900);
    await p.evaluate(() => [...document.querySelectorAll('[data-sfl]')].find(b => /Blank standard layout/.test(b.textContent)).click()); await sleep(900);
    const b2 = await rows(p);
    rec('B: Blank standard layout → the standard layout as before', b2.some(r => r.hdr && r.item === 'Worktops') && blankRows(b2) >= 6, JSON.stringify(b2.length));
    await closeAll(p);
    await p.evaluate(() => lsNewChoose('WO-4')); await sleep(900);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const x = o && o.querySelector('#pod-x'); if (x) x.click(); }); await sleep(300);
    rec('B: Cancel on the chooser → no window, nothing saved', await p.evaluate(() => !document.querySelector('.me-ed') && !document.querySelector('.pod-ovl')));
    // a project with no templates (Lucan, WO-6) → straight into the blank layout as before
    await p.evaluate(() => lsNewChoose('WO-6')); await sleep(900);
    const b3 = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), ch: !!document.querySelector('[data-sfl]') }));
    rec('B: project without templates → the window opens straight away (no chooser)', b3.ed && !b3.ch, JSON.stringify(b3));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
