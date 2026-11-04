// Tester round 6 (4 Nov) — attack on docket cancel "Did these items leave stores?" (Coder acd8a22) and the hidden
// docket buttons. Browser + fake Supabase only (tests/stores-docket/srvd.js) — never live.
// Run: node tests/stores-docket/attack2-cancel.test.js
const X = require('./fixd.js');
const { H, D } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
const J = JSON.stringify;
const hook = p => p.evaluate(() => { window.__T = []; const t0 = window.toast; window.toast = function (m) { window.__T.push(String(m)); return t0.apply(this, arguments); }; });
const toasts = p => p.evaluate(() => { const r = (window.__T || []).join(' | '); window.__T = []; return r; });
const sent = (p, id) => p.evaluate(async id => { const m = await dkSentFor([id]); return m[id] ? m[id].n : 0; }, id);
const openList = async p => { await p.evaluate(() => { [...document.querySelectorAll('#dk-list-dlg')].forEach(e => e.remove()); document.getElementById('dk-list').click(); }); await X.sleep(600); };
const cancelFirst = async (p, yes, why = 'wrong van') => { await p.evaluate(({ yes, why }) => { window.prompt = () => why; document.querySelector('[data-dkcan]').click(); document.querySelector('#dk-left [data-dkleft="' + (yes ? 1 : 0) + '"]').click(); }, { yes, why }); await X.sleep(900); };
(async () => {
  const browser = await H.chromium.launch();
  const all = [];
  // 1. part-sent line (10 of 20 Taps): Yes-cancel keeps 10 counted as sent; the Send screen still says 10 of 20
  {
    const S = X.makeServer(); all.push(S); const p = await X.dev(browser, S, 'stores'); await hook(p.page);
    await p.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'Y1' }, [{ line_id: 'L1:2', qty: '10' }], 'Op'));
    await openList(p.page); await cancelFirst(p.page, true);
    const k = S.db.t.stores_dockets[0];
    rec('1 Yes-cancel: docket CANCELLED with cancel_left = true', k.status === 'cancelled' && k.cancel_left === true, J(k));
    rec('1 Yes-cancel: the 10 still count as sent', await sent(p.page, 'L1:2') === 10);
    const shown = await p.page.evaluate(() => document.getElementById('dk-list-dlg').innerText);
    rec('1 the docket list says "items left stores"', /items left stores/.test(shown), shown.slice(0, 300));
    // only 10 more can go on a new docket
    const r = await p.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'Y2' }, [{ line_id: 'L1:2', qty: '11' }], 'Op'));
    rec('1 after Yes-cancel only 10 more Taps can be sent (11 refused "too many")', r && r.ok === false && r.refused && r.refused[0].why === 'too-many' && r.refused[0].left === 10, J(r));
    // Items sent report includes the Yes-cancelled docket
    const rows = await p.page.evaluate(async () => { try { return await dkReportRows({ id: 'P1', name: 'Aderrig' }, '2026-10-01', '2026-11-30'); } catch (e) { return 'ERR ' + e.message; } });
    rec('1 Items sent report still lists the 10 Taps from the Yes-cancelled docket', /Tap|Chrome mixer/.test(J(rows)), J(rows).slice(0, 300));
  }
  // 2. No-cancel on a part-sent line returns the quantity
  {
    const S = X.makeServer(); all.push(S); const p = await X.dev(browser, S, 'stores');
    await p.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'N1' }, [{ line_id: 'L1:2', qty: '10' }], 'Op'));
    await openList(p.page); await cancelFirst(p.page, false);
    rec('2 No-cancel: cancel_left = false and the 10 are free again (0 sent)', S.db.t.stores_dockets[0].cancel_left === false && await sent(p.page, 'L1:2') === 0);
    const r = await p.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'N2' }, [{ line_id: 'L1:2', qty: '20' }], 'Op'));
    rec('2 after No-cancel all 20 can go on a new docket', r && r.ok, J(r));
  }
  // 3. two PCs cancel the same docket: PC1 says Yes (left), PC2 (list open from before) says No
  {
    const S = X.makeServer(); all.push(S);
    const a = await X.dev(browser, S, 'stores'), b = await X.dev(browser, S, 'stores'); await hook(a.page); await hook(b.page);
    await a.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'T1' }, [{ line_id: 'L1:2', qty: '10' }], 'Op'));
    await openList(a.page); await openList(b.page);
    await cancelFirst(a.page, true, 'PC1 reason'); await toasts(a.page);
    await cancelFirst(b.page, false, 'PC2 reason');
    const tb = await toasts(b.page), mb = await b.page.evaluate(() => (document.getElementById('dkl-msg') || {}).textContent || '');
    const k = S.db.t.stores_dockets[0];
    rec('3 the first answer stands in the database (cancel_left true, PC1 reason), 10 still sent', k.cancel_left === true && k.cancel_why === 'PC1 reason' && await sent(b.page, 'L1:2') === 10, J(k));
    rec('3 PC2 is NOT told "the items are back to to pick" (they are not — PC1 already said they left)', !/back to "to pick"/.test(tb), 'PC2 toast: ' + tb + ' | msg: ' + mb);
    rec('3 PC2 is told it was already cancelled on another screen', /already cancelled|another screen/i.test(tb + mb), 'PC2 toast: ' + tb + ' | msg: ' + mb);
  }
  // 4. cancel then delivered on another PC (stale): not marked delivered, plain message
  {
    const S = X.makeServer(); all.push(S);
    const a = await X.dev(browser, S, 'stores'), b = await X.dev(browser, S, 'stores');
    await a.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'C1' }, [{ line_id: 'L1:3', qty: '8' }], 'Op'));
    await openList(a.page); await openList(b.page);
    await cancelFirst(a.page, false);
    await b.page.evaluate(() => { document.querySelector('[data-dkdel]').click(); }); await X.sleep(200);
    await b.page.evaluate(() => { document.getElementById('dkv-by').value = 'Site Mgr'; document.querySelector('[data-dkvok]').click(); }); await X.sleep(900);
    const mb = await b.page.evaluate(() => document.getElementById('dkl-msg').textContent);
    rec('4 delivered on a stale PC after cancel: refused, told plainly', S.db.t.stores_dockets[0].status === 'cancelled' && /cancelled on another screen/.test(mb), mb);
  }
  // 5. the docket tables are not there: buttons hidden quietly, no technical message
  {
    const S = X.makeServer(); all.push(S); S.noDocketTables = true;
    const p = await X.dev(browser, S, 'stores'); await hook(p.page);
    await X.sleep(600); await p.page.evaluate(() => render()); await X.sleep(300);
    const v = await p.page.evaluate(() => [...document.querySelectorAll('.dk-gate')].map(b => b.id + ':' + (b.hidden || getComputedStyle(b).display === 'none' ? 'hidden' : 'shown')));
    const t = await toasts(p.page);
    rec('5 no docket tables: Send to site / Dockets / Items sent all hidden', v.length === 3 && v.every(x => /hidden/.test(x)), J(v));
    rec('5 …and no technical message on screen', !/PGRST|42P01|does not exist|SQL/.test(t + await p.page.evaluate(() => document.body.innerText)), t);
    const probes = S.log.filter(x => /stores_dockets/.test(x)).length; await p.page.evaluate(() => { render(); render(); render(); }); await X.sleep(300);
    rec('5 only one probe per page load (not one per screen refresh)', S.log.filter(x => /stores_dockets/.test(x)).length === probes, probes + ' → ' + S.log.filter(x => /stores_dockets/.test(x)).length);
  }
  // 6. offline when the page opens: design = buttons shown, the dialog says "no connection" (not hidden, no crash)
  {
    const S = X.makeServer(); all.push(S);
    const p = await X.dev(browser, S, 'stores');
    // reset the probe as if this page had just loaded with no signal
    S.offlineD = true; await p.page.evaluate(() => { DKP.st = ''; DKP.busy = false; render(); }); await X.sleep(600); await p.page.evaluate(() => render());
    const v = await p.page.evaluate(() => [...document.querySelectorAll('.dk-gate')].map(b => b.hidden ? 'hidden' : 'shown'));
    rec('6 offline: docket buttons stay visible (design: the dialogs explain)', v.length === 3 && v.every(x => x === 'shown'), J(v));
    await openList(p.page);
    const m = await p.page.evaluate(() => (document.getElementById('dk-list-dlg') || {}).innerText || '');
    rec('6 offline: Dockets says "No connection" in plain words', /No connection/.test(m), m.slice(0, 200));
    S.offlineD = false;
  }
  // 7. HTML in the cancel reason / who
  {
    const S = X.makeServer(); all.push(S); const p = await X.dev(browser, S, 'stores');
    await p.page.evaluate(() => dkMake({ project_id: 'P1', cid: 'H1' }, [{ line_id: 'L1:3', qty: '8' }], 'Op'));
    await openList(p.page); await cancelFirst(p.page, true, '<img src=x onerror="window.__pwn=1">O\'Grady 😀');
    await openList(p.page);
    const r = await p.page.evaluate(() => ({ pwn: window.__pwn || 0, t: document.getElementById('dk-list-dlg').innerText }));
    rec('7 HTML in the cancel reason is shown as text, never run', r.pwn === 0 && /O'Grady/.test(r.t), J(r).slice(0, 300));
  }
  rec('no page errors', !all.some(S => (S.errors || []).length), J(all.map(S => S.errors || [])));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
