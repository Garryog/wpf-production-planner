// Tester round 8 (18 Nov) — attack on the round-7 fixes to "＋ Add to several templates" (commit e728dbf): the 45 s give-up and a
// late reply (with and without a second press), a stale retry against a PC that keeps saving, the "(added)" heading on a second
// and third add, Close asks only when something is typed, the screen switched mid-dialog. Fake Supabase only.
// Run: node tests/list-window/attack8-tpladd.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks } = L;
const HB = 'Blum hinge';
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
(async () => {
  const browser = await X.H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row());
    const T = (id, nm, lines) => X.F3.seedList(S, id, { wos: [], name: nm, list: { is_template: true, type_name: nm, list_type: 'kitchen', version: 1, rev: 1 }, lines });
    const H_ = (n, units, sec) => ['hdr', n, units == null ? null : String(units), null, null, null, '', '', sec ? { section: sec } : {}];
    T('TA', 'TA', [['fit', 'Tap', '1', null, null, HB, '', '']]);
    T('TB', 'TB', [['fit', 'Tap', '1', null, null, HB, '', '']]);
    T('TK', 'TK busy', [['fit', 'Tap', '1', null, null, HB, '', '']]);
    T('TX', 'TX ×', [H_('Floor 2', 4), H_('Fittings', null, 'Floor 2'), ['fit', 'Leg', '32', null, null, HB, '', '', { unit_qty: '8', section: 'Fittings' }]]);
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); for (const id of ['TA', 'TB', 'TK', 'TX']) await lsReloadList(id); window.__alerts = []; window.alert = m => window.__alerts.push(String(m));
      window.__toasts = []; const T0 = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return T0.apply(this, arguments); }; lpfSet(''); render(); }); await sleep(500);
    const open = async () => { await closeAll(p); await p.evaluate(() => lsTplAddDlg('P1')); await sleep(300); };
    const fill = (vals, ticks) => p.evaluate(({ vals, ticks }) => { for (const [k, v] of Object.entries(vals)) { const e = document.getElementById(k); e.value = v; e.dispatchEvent(new Event('input')); } document.querySelectorAll('[data-tat]').forEach(c => { c.checked = ticks.includes(c.dataset.tat); }); window.__asked = []; window.__alerts = []; window.__toasts = []; }, { vals, ticks });
    const go = () => p.evaluate(() => document.getElementById('ta-go').click());
    const dlg = () => p.evaluate(() => ({ open: !!document.getElementById('ta-go'), btn: (document.getElementById('ta-go') || {}).textContent || '', dis: !!(document.getElementById('ta-go') || {}).disabled, err: (document.getElementById('ta-err') || {}).textContent || '', alerts: window.__alerts.slice(), toasts: window.__toasts.slice() }));
    const n = (id, part) => live(S, id).filter(x => x.part === part).length;
    // hold the next save_list_revision for one template until released
    const holdSave = async tid => { let rel; const gate = new Promise(r => { rel = r; }); let held = false;
      await p.route('**/rpc/save_list_revision', async route => { const a = JSON.parse(route.request().postData() || '{}'); if (!held && a.p_list && a.p_list.id === tid) { held = true; await gate; } return route.fallback(); });
      return async () => { rel(); await sleep(50); await p.unroute('**/rpc/save_list_revision'); }; };

    // ---------- 1. 45 s give-up, then the late reply arrives (no second press) ----------
    let release = await holdSave('TA');
    await open(); await fill({ 'ta-item': 'Late1', 'ta-qty': '1', 'ta-mat': HB }, ['TA']); await go(); await sleep(11000);
    const g10 = await dlg();
    rec('G1: no answer for 10 s → told "No answer from the database yet… it may still go through"', /No answer from the database yet/.test(g10.err) && g10.dis, JSON.stringify(g10));
    await sleep(35500); const g45 = await dlg();
    rec('G2: 45 s → the button is given back with "it may have been added. Press Add again…"', !g45.dis && /45 s/.test(g45.err), JSON.stringify(g45));
    await release(); await sleep(2500); const g1 = await dlg();
    rec('G3: the late reply arrives → ONE Late1 in TA, and the person is told it was added', n('TA', 'Late1') === 1 && (g1.toasts.some(m => /Added to 1/.test(m)) || g1.alerts.some(m => /Added/.test(m))), JSON.stringify([n('TA', 'Late1'), g1]));
    await closeAll(p);

    // ---------- 2. 45 s give-up, Add pressed AGAIN, then the first (late) save lands ----------
    release = await holdSave('TB');
    await open(); await fill({ 'ta-item': 'Late2', 'ta-qty': '1', 'ta-mat': HB }, ['TB']); await go(); await sleep(46000);
    await p.evaluate(() => { window.__alerts = []; window.__toasts = []; }); await go(); await sleep(3000);
    const g2a = await dlg();
    rec('G4: second press after the give-up → Late2 added once by that press', n('TB', 'Late2') === 1, JSON.stringify([n('TB', 'Late2'), g2a]));
    await release(); await sleep(3000); const g2b = await dlg();
    rec('[HIGH if it fails] G5: then the FIRST (held) save reaches the database → still ONE Late2 in TB (no double row, no extra Rev)', n('TB', 'Late2') === 1 && (+S.db.t.lists.find(l => l.id === 'TB').rev) === 2, JSON.stringify([live(S, 'TB').map(x => x.part), S.db.t.lists.find(l => l.id === 'TB').rev, g2b]));
    rec('G6: …and the person is not shown a scary second message for the first press', !g2b.alerts.some(m => /NOT added/.test(m)), JSON.stringify(g2b.alerts));
    await closeAll(p);

    // ---------- 3. a PC that keeps saving TK: every save from here is stale ----------
    let k = 0;
    await p.route('**/rpc/save_list_revision', async route => { const a = JSON.parse(route.request().postData() || '{}');
      if (a.p_list && a.p_list.id === 'TK') { const l = S.db.t.lists.find(x => x.id === 'TK'); k++; L.D.update(S.db, 'lists', l, { version: (+l.version || 1) + 1 }); L.D.insert(S.db, 'list_lines', { id: 'TK:o' + k, list_id: 'TK', seq: 10 + k, kind: 'fit', part: 'Other PC ' + k, qty: '1', material: HB }); }
      return route.fallback(); });
    await open(); await fill({ 'ta-item': 'Spin', 'ta-qty': '1', 'ta-mat': HB }, ['TK']); await go(); await sleep(5000); await p.unroute('**/rpc/save_list_revision');
    const g3 = await dlg();
    rec('K1: a PC saving TK every time → tried twice, then "NOT added to: TK busy (changed on another screen at the same moment — press Add again)"', k === 2 && n('TK', 'Spin') === 0 && g3.alerts.some(m => /NOT added to: TK busy \(changed on another screen at the same moment — press Add again\)/.test(m)), JSON.stringify([k, g3.alerts]));
    rec('K2: …the other PC\'s rows are all kept', n('TK', 'Other PC 1') === 1 && n('TK', 'Other PC 2') === 1);
    await closeAll(p);

    // ---------- 4. the "(added)" heading on a second and third add ----------
    for (const it of ['Add1', 'Add2', 'Add3']) { await open(); await fill({ 'ta-item': it, 'ta-qty': '2', 'ta-mat': HB, 'ta-head': 'Fittings' }, ['TX']); await go(); await sleep(3000); }
    const tx = live(S, 'TX').map(x => x.part + (x.kind === 'hdr' ? '[H' + (x.qty ? '×' + x.qty : '') + ']' : ':' + x.qty));
    rec('H1: first add under "Fittings" (only inside the × 4 block) → "Fittings (added)" at the end, qty 2', tx.includes('Fittings (added)[H]') && tx.includes('Add1:2'), JSON.stringify(tx));
    rec('(MEDIUM/LOW) H2: second and third adds go under the SAME "Fittings (added)" heading — not "Fittings (added 2)", "(added 3)"', tx.filter(x => /^Fittings \(added/.test(x)).length === 1 && tx.indexOf('Add3:2') === tx.length - 1, JSON.stringify(tx));
    rec('H3: none of them multiplied by the × 4 block', ['Add1:2', 'Add2:2', 'Add3:2'].every(x => tx.includes(x)), JSON.stringify(tx));
    await open(); await fill({ 'ta-item': 'Add4', 'ta-qty': '1', 'ta-mat': HB, 'ta-head': 'fittings (ADDED)' }, ['TX']); await go(); await sleep(3000);
    const tx2 = live(S, 'TX').map(x => x.part);
    rec('H4: typing "fittings (ADDED)" puts it under the existing "Fittings (added)" heading', tx2.filter(x => /^fittings \(added/i.test(x)).length === tx.filter(x => /^Fittings \(added/.test(x)).length && tx2.indexOf('Add4') > tx2.indexOf('Fittings (added)') && tx2.indexOf('Fittings (added)') >= 0, JSON.stringify(tx2));
    await closeAll(p);

    // ---------- 5. Close asks only when something is typed; the grey never closes ----------
    await open(); await p.evaluate(() => { window.__asked = []; document.getElementById('pod-x').click(); }); await sleep(200);
    let c = await p.evaluate(() => ({ open: !!document.getElementById('ta-go'), asked: window.__asked.slice() }));
    rec('C1: nothing typed → Close shuts it without asking', !c.open && !c.asked.length, JSON.stringify(c));
    await open(); await p.evaluate(() => document.querySelectorAll('[data-tat]').forEach(x => x.checked = true)); await p.evaluate(() => { window.__asked = []; document.getElementById('pod-x').click(); }); await sleep(200);
    c = await p.evaluate(() => ({ open: !!document.getElementById('ta-go'), asked: window.__asked.slice() }));
    rec('(info) C2: only templates ticked (nothing typed) → Close shuts without asking: ' + JSON.stringify(c), true);
    await open(); await fill({ 'ta-item': 'Typed' }, []); await p.evaluate(() => { window.__confirm = false; document.getElementById('pod-x').click(); }); await sleep(200);
    c = await p.evaluate(() => ({ open: !!document.getElementById('ta-go'), asked: window.__asked.slice() }));
    rec('C3: Item typed → Close asks "Close without saving?"; Cancel → stays open with the text', c.open && c.asked.some(m => /Close without saving/.test(m)) && await p.evaluate(() => document.getElementById('ta-item').value) === 'Typed', JSON.stringify(c));
    await p.mouse.click(3, 3); await sleep(200);
    rec('C4: …a click on the grey does not close it', await p.evaluate(() => !!document.getElementById('ta-go')));
    await p.keyboard.press('Escape'); await sleep(200);
    rec('(info) C5: Esc with text typed → still open (or asked)', await p.evaluate(() => !!document.getElementById('ta-go')) || (await p.evaluate(() => window.__asked.length)) > 1);
    await p.evaluate(() => { window.__confirm = true; document.getElementById('pod-x') && document.getElementById('pod-x').click(); }); await sleep(200);
    rec('C6: …OK → closed', !(await p.evaluate(() => !!document.getElementById('ta-go'))));

    // ---------- 6. the screen switched mid-dialog ----------
    await open(); await fill({ 'ta-item': 'Switch', 'ta-qty': '1', 'ta-mat': HB }, ['TA']);
    await p.evaluate(() => { localStorage.setItem('wpfPin_office', pins().office || '2468'); ROLE = 'office'; render(); }); await sleep(300);
    await go(); await sleep(1500); const s1 = await dlg();
    rec('S1: switched to Office with the dialog open → Add refused in words, nothing added, dialog still open with the text', n('TA', 'Switch') === 0 && s1.open && /switched to Office/.test(s1.err), JSON.stringify(s1));
    await p.evaluate(() => { ROLE = 'design'; render(); }); await sleep(300); await go(); await sleep(3000);
    rec('S2: switched back to the Drawing office → the same press adds it once', n('TA', 'Switch') === 1, JSON.stringify(await dlg()));
    await p.evaluate(() => { ROLE = 'prod'; render(); }); await sleep(200);
    await open(); await fill({ 'ta-item': 'ByProd', 'ta-qty': '1', 'ta-mat': HB }, ['TA']); await p.evaluate(() => { ROLE = 'pm'; }); await go(); await sleep(1500);
    rec('S3: Production Manager → ROLE changed to PM without a redraw → still refused', n('TA', 'ByProd') === 0, JSON.stringify(await dlg()));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
