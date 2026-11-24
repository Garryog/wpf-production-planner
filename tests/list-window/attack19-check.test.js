// Tester attack (19 Nov) on h19 "✓ Check opens the list → ✓ Confirm checked": another PC archives / checks / ticks while
// the check view is open, the database slow or offline at Confirm, double-press, Close while Confirm is still waiting,
// wrong PIN after Confirm, every office-side role. Fake Supabase only.
// Run: node tests/list-window/attack19-check.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, finish, closeAll, asks } = L;
const J = JSON.stringify;

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const r = X.v2Row({ listChk: true });
    const S = X.makeServer(r);
    const seed = (id, wo, extra) => X.F3.seedList(S, id, { name: 'Chk ' + id, wos: [wo], list: Object.assign({ check_req: true }, extra || {}) });
    ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'K'].forEach((k, i) => seed('C' + k, 'WO-' + (1 + (i % 4))));
    const dbL = id => D.find(S.db, 'lists', id);
    const t = await X.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }), p = t.page; await asks(p);
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.evaluate(async () => { setWho('Ann'); localStorage.setItem('wpfEditPin', '9000'); lsReset(); await lsLoad(); showTab('l'); render(); }); await sleep(400);
    // the office PIN in this fake is 9000 for every role (srv.js) → remember it so no PIN box gets in the way unless a test wants one
    await p.evaluate(() => { window.prompt = m => (/PIN/.test(m) ? (window.__pin || '9000') : 'Ann'); });
    const openChk = async id => { await p.evaluate(id => lsViewDlg(id, { check: true }), id); await sleep(700); };
    const top = () => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? { t: o.innerText.slice(0, 300), ok: !!o.querySelector('#lv-chkok'), okTxt: (o.querySelector('#lv-chkok') || {}).textContent || '', dis: !!(o.querySelector('#lv-chkok') || {}).disabled, chg: !!o.querySelector('.lv-changed') } : null; });
    const toastT = () => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    const confirmBtn = () => p.evaluate(() => { const b = [...document.querySelectorAll('.pod-ovl')].pop(); const k = b && b.querySelector('#lv-chkok'); if (k) k.click(); return !!k; });
    const flush = () => p.evaluate(async () => { try { await lqSend(); } catch (e) {} });

    // A. archived on another PC while the check view is open
    await openChk('CA');
    D.update(S.db, 'lists', dbL('CA'), { archived: true, updated_by: 'PC2' });
    await confirmBtn(); await sleep(1500); await flush();
    const a = { checked: dbL('CA').checked_at, top: await top(), toast: await toastT() };
    rec('A archived on another PC while reading → Confirm does NOT check it (and says the list was archived)', !a.checked, J(a));
    rec('A …the user is told it was archived (not "the saw can see it now")', !/saw can see it now/.test(a.toast) && (/archiv/i.test(a.toast) || (a.top && /archiv/i.test(a.top.t))), J(a));
    await closeAll(p);

    // B. offline at Confirm → not checked, told, button usable again, view kept; back online → Confirm works
    await openChk('CB');
    S.offline = true;
    await confirmBtn(); await sleep(1500);
    const b = { checked: dbL('CB').checked_at, top: await top(), toast: await toastT() };
    rec('B offline at Confirm → not checked, view stays open, button usable again, told "Could not reach the database"', !b.checked && b.top && b.top.ok && !b.top.dis && /Could not reach/.test(b.toast), J(b));
    S.offline = false;
    await confirmBtn(); await sleep(1500); await flush();
    rec('B back online → Confirm again checks it', !!dbL('CB').checked_at, J(dbL('CB').checked_at));
    await closeAll(p);

    // C. slow database at Confirm: double-press, then the button shows it is working
    await openChk('CC');
    let rel; S.hold3 = new Promise(res => { rel = res; });
    await confirmBtn(); await sleep(150); await confirmBtn(); await sleep(150); await confirmBtn();
    const c1 = await top();
    rec('C slow DB: the button says it is working and is greyed while it re-reads', c1 && c1.dis && /Checking for changes/.test(c1.okTxt), J(c1));
    S.hold3 = null; rel(); await sleep(1500); await flush(); await sleep(300);
    const calls = S.rpcCalls.filter(x => x.fn === 'list_set_done' && x.args.p_list === 'CC').length;
    rec('C triple-press Confirm while slow → checked ONCE (one list_set_done)', !!dbL('CC').checked_at && calls === 1, J([dbL('CC').checked_at, calls]));
    await closeAll(p);

    // D. Close pressed while Confirm is still waiting for the database → "Close changes nothing" must hold
    await openChk('CE');
    S.hold3 = new Promise(res => { rel = res; });
    await confirmBtn(); await sleep(200);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const x = o && o.querySelector('#pod-x'); if (x) x.click(); });
    await sleep(200);
    S.hold3 = null; rel(); await sleep(1500); await flush();
    rec('D Confirm pressed, then Close while the DB is slow → (Close says "changes nothing") — was it checked anyway?', !dbL('CE').checked_at, 'checked_at=' + dbL('CE').checked_at + ' toast=' + (await toastT()));
    await closeAll(p);

    // E. a saw / stores tick saved on another PC while reading (not a change to the list itself)
    await openChk('CF');
    const ln = S.db.t.list_lines.find(x => x.list_id === 'CF' && x.kind === 'fit');
    D.update(S.db, 'list_lines', ln, { status: 'got-out', status_by: 'Stores', status_at: new Date().toISOString() });
    await confirmBtn(); await sleep(1500); await flush();
    const e = { checked: dbL('CF').checked_at, top: await top() };
    rec('E a stores tick on another PC while reading (rows not changed) → Confirm still checks, no false "changed" alarm', !!e.checked && !(e.top && e.top.chg), J(e));
    await closeAll(p);
    // E2. a SAW tick (status cut) on a saw row while reading
    await openChk('CK');
    const ln2 = S.db.t.list_lines.find(x => x.list_id === 'CK' && x.kind === 'saw');
    D.update(S.db, 'list_lines', ln2, { status: 'cut', status_by: 'Saw', status_at: new Date().toISOString() });
    await confirmBtn(); await sleep(1500); await flush();
    const e2 = { checked: dbL('CK').checked_at, top: await top() };
    rec('E2 a saw tick on another PC while reading → Confirm still checks, no false "changed" alarm', !!e2.checked && !(e2.top && e2.top.chg), J(e2));
    await closeAll(p);

    // F. checked on another PC while reading → Confirm must not overwrite who checked it
    await openChk('CG');
    D.update(S.db, 'lists', dbL('CG'), { checked_at: '2026-10-21T08:00:00.000Z', checked_by: 'Mary (PC2)' });
    await confirmBtn(); await sleep(1500); await flush();
    const f = { by: dbL('CG').checked_by, at: dbL('CG').checked_at, toast: await toastT() };
    rec('F already checked on another PC meanwhile → stays "checked by Mary (PC2)" (not re-stamped)', f.by === 'Mary (PC2)', J(f));
    await closeAll(p);

    // G. wrong PIN after Confirm (no remembered PIN) → not checked, said so; does the user lose the view?
    await p.evaluate(() => { localStorage.removeItem('wpfEditPin'); window.__pin = '1111'; });
    await openChk('CH');
    await confirmBtn(); await sleep(1500); await flush();
    const g = { checked: dbL('CH').checked_at, toast: await toastT(), view: await top() };
    rec('G wrong PIN after Confirm → not checked, "Wrong PIN — not checked"', !g.checked && /Wrong PIN/.test(g.toast), J(g));
    rec('G (UX) wrong PIN → the list view is still open to try again (was it thrown away?)', !!(g.view && g.view.ok), J(g.view));
    await closeAll(p);
    // PIN box cancelled
    await p.evaluate(() => { window.prompt = m => (/PIN/.test(m) ? null : 'Ann'); });
    await openChk('CH'); await confirmBtn(); await sleep(1500); await flush();
    rec('G PIN box cancelled → not checked', !dbL('CH').checked_at, J(dbL('CH').checked_at));
    await closeAll(p);
    // "who" box cancelled
    await p.evaluate(() => { localStorage.setItem('wpfEditPin', '9000'); sessionStorage.removeItem('wpfWho'); window.prompt = m => (/PIN/.test(m) ? '9000' : null); });
    await openChk('CH'); await confirmBtn(); await sleep(1500);
    await p.evaluate(() => { const w = [...document.querySelectorAll('.pod-ovl')].pop(); if (w && /who/i.test(w.innerText)) { const x = w.querySelector('#pod-x'); if (x) x.click(); } }); await sleep(300); await flush();
    rec('G "who" cancelled → not checked', !dbL('CH').checked_at, J(dbL('CH').checked_at));
    await closeAll(p);

    // H. a template opened with {check:true} by the office (template rights = Drawing office / PM / Admin)
    X.F3.seedList(S, 'CT', { name: 'Tpl check', wos: [], list: { is_template: true, check_req: true } });
    await p.evaluate(async () => { localStorage.removeItem('wpfEditPin'); window.prompt = m => (/PIN/.test(m) ? '1111' : 'Ann'); await lsReloadList('CT'); });
    await openChk('CT');
    const h = await top();
    await confirmBtn(); await sleep(1500); await flush();
    rec('H template check by office with a wrong PIN → not checked', !dbL('CT').checked_at, J([h && h.ok, dbL('CT').checked_at]));
    await closeAll(p);

    // I. every office-side role: the view opens with Confirm; prod / design check with no PIN, pm / office need the PIN
    for (const [role, id] of [['prod', 'CK2'], ['design', 'CA2'], ['pm', 'CA3'], ['office', 'CA4']]) {
      seed(id, 'WO-1');
      const tt = await X.dev(browser, S, role), q = tt.page; await asks(q);
      await q.evaluate(() => { localStorage.removeItem('wpfEditPin'); sessionStorage.setItem('wpfWho', 'Ann'); window.__p = []; window.prompt = m => { window.__p.push(String(m)); return /PIN/.test(m) ? '9000' : 'Ann'; }; });
      await q.evaluate(async id => { await lsReloadList(id); lsViewDlg(id, { check: true }); }, id); await sleep(700);
      const okb = await q.evaluate(() => !!document.querySelector('#lv-chkok'));
      await q.evaluate(() => { const k = document.querySelector('#lv-chkok'); if (k) k.click(); }); await sleep(1500);
      await q.evaluate(async () => { try { await lqSend(); } catch (e) {} });
      const pr = await q.evaluate(() => window.__p), qe = (S.errors || []).filter(x => !/favicon/.test(x));
      rec('I ' + role + ': Confirm checked → checked (PIN asked: ' + pr.some(m => /PIN/.test(m)) + ')', okb && !!dbL(id).checked_at, J([okb, dbL(id).checked_at, pr]));
      rec('I ' + role + ': PIN asked only where it should be (prod/design never)', ['prod', 'design'].includes(role) ? !pr.some(m => /PIN/.test(m)) : true, J(pr));
      await tt.page.close().catch(() => {});
    }
    rec('no page errors', !errs.length, J(errs.slice(0, 3)));
  } catch (e) { rec('test ran without crashing', false, e.stack); }
  await browser.close(); finish();
})();
