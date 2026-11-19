// Garry 19 Nov (live), three small things — fewer things on screen, not more:
//  1. GREEN STRIP: a job's left edge turns green when its cutting list is sorted — a live list (not archived), a photo of the
//     list, or "No list needed". Capacity Board rows, Lists page rows, Deliveries cards. One helper (woListOk). A list saved
//     on this screen turns it green with no reload; archiving it takes the green away.
//  2. STEP BADGE: the job's Cienapps step (stepShort) as a small grey badge beside the WO number on every page (stepBadge),
//     escaped, follows a step change on the next redraw. The board keeps its step drop-down (no badge there).
//  3. ✓ CHECK OPENS THE LIST: the Drawing office "✓ Check" first opens the whole list read-only with "✓ Confirm checked" and
//     "Not right — edit" at the bottom. Only Confirm checks it (same PIN / who rules); Close changes nothing.
// Fake Supabase only. Run: node tests/list-window/h19-green-step-check.test.js   (SHOTS=<dir> also saves screenshots)
const L = require('./lw.js');
const { X, H, D, sleep, rec, finish, closeAll, asks, setv, rows, liveFor } = L;
const SHOTS = process.env.SHOTS || '';
const J = JSON.stringify;
const GREEN = 'rgb(45, 158, 84)';

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row({ listChk: true });
    const set = (wo, f) => Object.assign(r.orders.find(o => o.wo === wo), f);
    set('WO-1', { step: '5. WORK ORDER PROCESSED', delv: true });
    set('WO-2', { step: '6. JOB CUT COMPLETE', delv: true });
    set('WO-3', { step: '4. READY FOR PRODUCTION', listNA: { k: 'none', by: 'Ann', at: '2026-10-20T09:00:00Z' } }); // "No list needed"
    set('WO-4', { step: '5. WORK ORDER PROCESSED' }); // only an ARCHIVED list
    set('WO-6', { step: '7. ASSEMBLY COMPLETE', delv: true, dueDate: '2026-10-23', origDueDate: '2026-10-23', listPhotos: [{ url: 'https://example.invalid/p.jpg', at: '2026-10-20T09:00:00Z', by: 'Ann' }] });
    set('WO-5', { step: '9. JOB SHIPPED' });
    const S = X.makeServer(r);
    X.F3.seedList(S, 'LA', { name: 'Old WO-4 list', wos: ['WO-4'], list: { archived: true } });
    X.F3.seedList(S, 'LC', { name: 'Needs check', wos: ['WO-6'], list: { check_req: true } });
    const t = await X.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }), p = t.page; await asks(p);
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.evaluate(async () => { setWho('Ann'); lsReset(); await lsLoad(); showTab('b'); render(); }); await sleep(400);

    // ---------- 1. the green strip ----------
    const board = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wo-table tr[data-wo]')].map(tr =>
      [tr.dataset.wo, { ok: tr.classList.contains('lst-ok'), sh: getComputedStyle(tr.querySelector('td')).boxShadow }])));
    let b = await board();
    rec('1 board: WO-1 (a live list) has the green strip', b['WO-1'] && b['WO-1'].ok && b['WO-1'].sh.includes(GREEN), J(b['WO-1']));
    rec('1 board: WO-2 (no list) has NO green strip', b['WO-2'] && !b['WO-2'].ok && !b['WO-2'].sh.includes(GREEN), J(b['WO-2']));
    rec('1 board: WO-3 marked "No list needed" → green', b['WO-3'] && b['WO-3'].ok, J(b['WO-3']));
    rec('1 board: WO-4 with only an ARCHIVED list → not green', b['WO-4'] && !b['WO-4'].ok, J(b['WO-4']));
    rec('1 board: WO-6 with a photo of the list → green', b['WO-6'] && b['WO-6'].ok, J(b['WO-6']));
    rec('1 board: the step drop-down is still there, no extra step badge on the board rows', await p.evaluate(() => !!document.querySelector('[data-stepsel="WO-1"]') && !document.querySelector('.wo-table tr[data-wo] .stp-b')));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/h19-board.png', fullPage: false });

    // a list saved for WO-2 in the list window → green on the board with no reload
    await p.evaluate(() => { window.__confirm = true; openListEditor(null, 'WO-2', 'P1'); }); await sleep(900);
    const hs = await p.evaluate(() => { const e = document.getElementById('me-hstp'); return e ? e.textContent : null; });
    rec('2 list window header: the step badge beside the WO ("JOB CUT COMPLETE")', hs === 'JOB CUT COMPLETE', J(hs));
    const i = (await rows(p)).findIndex(x => !x.hdr);
    for (const [f, v] of [['item', 'Base side'], ['qty', '2'], ['L', '720'], ['W', '560'], ['mat', 'MFC White']]) await setv(p, i + '|' + f, v);
    await sleep(150); await p.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2500);
    const lid = (liveFor(S, 'WO-2')[0] || {}).id;
    b = await board();
    rec('1 a list saved for WO-2 → green on the board straight away (no reload)', !!lid && b['WO-2'] && b['WO-2'].ok, J([lid, b['WO-2']]));
    await p.evaluate(id => { listArchive(lsList(id), 'Ann'); render(); }, lid); await sleep(300);
    b = await board();
    rec('1 that list archived → WO-2 not green any more', b['WO-2'] && !b['WO-2'].ok, J(b['WO-2']));
    await p.evaluate(async () => { await lqSend(); await lsPoll(); render(); }); await sleep(300);

    // Deliveries cards
    await p.evaluate(() => { showTab('d'); render(); }); await sleep(400);
    const dc = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.dchip[data-dw]')].map(c => [c.dataset.dw,
      { ok: c.classList.contains('lst-ok'), sh: getComputedStyle(c).boxShadow, stp: (c.querySelector('.dchip-top .stp-b') || {}).textContent || '' }])));
    rec('1 Deliveries: WO-1 card has the green strip (inside its readiness colour bar)', dc['WO-1'] && dc['WO-1'].ok && dc['WO-1'].sh.includes(GREEN), J(dc['WO-1']));
    rec('1 Deliveries: WO-2 card (list archived) — no green strip', dc['WO-2'] && !dc['WO-2'].ok, J(dc['WO-2']));
    rec('1 Deliveries: WO-6 (photo list) card green', dc['WO-6'] && dc['WO-6'].ok, J(dc['WO-6']));
    rec('2 Deliveries card: step badge beside the WO ("WORK ORDER PROCESSED")', dc['WO-1'] && dc['WO-1'].stp === 'WORK ORDER PROCESSED', J(dc['WO-1']));
    await p.evaluate(() => document.querySelector('[data-dd="WO-1"]').click()); await sleep(200);
    const ddw = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? (o.querySelector('.stp-b') || {}).textContent || '' : null; });
    rec('2 Deliveries status (check) window: step badge in its header', ddw === 'WORK ORDER PROCESSED', J(ddw));
    await closeAll(p);
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); o.step = '7. ASSEMBLY COMPLETE'; render(); }); await sleep(200);
    const dc2 = await p.evaluate(() => (document.querySelector('.dchip[data-dw="WO-1"] .stp-b') || {}).textContent || '');
    rec('2 the step changes → the badge follows on the next redraw', dc2 === 'ASSEMBLY COMPLETE', J(dc2));
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-2'); o.step = '<img src=x onerror="window.__x=1">'; render(); }); await sleep(200);
    const inj = await p.evaluate(() => ({ img: !!document.querySelector('.dchip .stp-b img'), x: !!window.__x, t: (document.querySelector('.dchip[data-dw="WO-2"] .stp-b') || {}).textContent || '' }));
    rec('2 a step with HTML in it is shown as text, never run', !inj.img && !inj.x && /<img/.test(inj.t), J(inj));
    await p.evaluate(() => { DB.orders.find(x => x.wo === 'WO-2').step = '6. JOB CUT COMPLETE'; render(); });

    // Lists page
    await p.evaluate(() => { showTab('l'); render(); }); await sleep(500);
    const lh = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('tr[data-lhrow]')].map(tr => [tr.dataset.lhrow,
      { ok: tr.classList.contains('lst-ok'), sh: getComputedStyle(tr.querySelector('td')).boxShadow, stp: [...tr.querySelectorAll('.stp-b')].map(x => x.textContent) }])));
    rec('1 Lists page: the live list on WO-1 — green strip on its row', lh.L1 && lh.L1.ok && lh.L1.sh.includes(GREEN), J(lh.L1));
    rec('2 Lists page: step badge beside the WO on the row', lh.L1 && lh.L1.stp.includes('ASSEMBLY COMPLETE'), J(lh.L1));
    await p.evaluate(() => { LH.state = 'any'; render(); }); await sleep(300);
    const lha = await p.evaluate(() => { const tr = document.querySelector('tr[data-lhrow="LA"]'); return tr ? tr.classList.contains('lst-ok') : null; });
    rec('1 Lists page: the ARCHIVED list row — no green strip', lha === false, J(lha));
    await p.evaluate(() => { LH.state = ''; render(); }); await sleep(300);
    const lti = await p.evaluate(() => [...document.querySelectorAll('.lti-row:not(.lti-wc)')].map(r => ({ wo: r.dataset.ltirow, stp: (r.querySelector('.stp-b') || {}).textContent || '' })));
    rec('2 Cutting lists to issue: step badge beside each WO', lti.length > 0 && lti.every(x => x.stp), J(lti));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/h19-lists.png', fullPage: true });

    // ---------- 3. ✓ Check opens the list ----------
    const dbChk = () => { const l = D.find(S.db, 'lists', 'LC'); return [l.checked_at || null, l.checked_by || null]; };
    const ov = () => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? { t: o.innerText, ok: !!o.querySelector('#lv-chkok'), ed: !!o.querySelector('#lv-chked'), tbl: !!o.querySelector('table'), small: !!o.querySelector('[data-vchk]'), wo: (o.querySelector('.lv-wos .stp-b') || {}).textContent || '' } : null; });
    await p.evaluate(() => { window.__asked = []; window.__prompted = []; window.prompt = m => { window.__prompted.push(String(m)); return /PIN/.test(m) ? '8888' : 'Ann'; }; localStorage.removeItem('wpfEditPin'); });
    await p.evaluate(() => document.querySelector('[data-lhchk="LC"]').click()); await sleep(600);
    let o = await ov();
    rec('3 ✓ Check → the whole list opens read-only, with "✓ Confirm checked" and "Not right — edit" at the bottom', o && o.ok && o.ed && o.tbl && /Side/.test(o.t) && /Hinge/.test(o.t) && !o.small, J(o && { ok: o.ok, ed: o.ed, tbl: o.tbl, small: o.small, t: o.t.slice(0, 200) }));
    rec('3 …the list window shows the WO with its step', o && o.wo === 'ASSEMBLY COMPLETE', J(o && o.wo));
    await p.evaluate(async () => { await lqSend(); });
    rec('3 opening it checks nothing (no question asked yet)', dbChk()[0] === null && (await p.evaluate(() => window.__asked.length)) === 0, J(dbChk()));
    await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().querySelector('#pod-x').click()); await sleep(300);
    await p.evaluate(async () => { await lqSend(); });
    rec('3 Close → nothing changed (not checked)', dbChk()[0] === null && !(await p.evaluate(() => document.querySelector('.pod-ovl'))), J(dbChk()));
    await p.evaluate(() => document.querySelector('[data-lhchk="LC"]').click()); await sleep(600);
    await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().querySelector('#lv-chked').click()); await sleep(900);
    const ed = await p.evaluate(() => ({ open: !!document.querySelector('.me-ed'), t: (document.querySelector('.me-tb') || {}).innerText || '' }));
    await p.evaluate(async () => { await lqSend(); });
    rec('3 "Not right — edit" → the list window opens on that list; still not checked', ed.open && /Edit/.test(ed.t) && dbChk()[0] === null, J([ed, dbChk()]));
    await p.evaluate(() => { const x = document.getElementById('me-x0'); if (x) x.click(); }); await sleep(400); await closeAll(p);
    await p.evaluate(() => { render(); document.querySelector('[data-lhchk="LC"]').click(); }); await sleep(600);
    await p.evaluate(() => { window.__asked = []; [...document.querySelectorAll('.pod-ovl')].pop().querySelector('#lv-chkok').click(); }); await sleep(400);
    await p.evaluate(async () => { await lqSend(); await lsPoll(); }); await sleep(300);
    const c = dbChk(), pr = await p.evaluate(() => window.__prompted);
    rec('3 "✓ Confirm checked" → checked, by the person (Ann), with the PIN asked as today', !!c[0] && c[1] === 'Ann' && pr.some(m => /PIN/.test(m)), J([c, pr]));
    rec('3 …no OK/Cancel box on top (the list itself was the question)', (a => a.length === 0)(await p.evaluate(() => window.__asked)), J(await p.evaluate(() => window.__asked)));
    // the panel "Cutting lists to issue" ✓ Check does the same
    X.F3.seedList(S, 'LD', { name: 'Needs check 2', wos: ['WO-3'], list: { check_req: true } });
    await p.evaluate(async () => { lsReset(); await lsLoad(); render(); }); await sleep(400);
    const hasLti = await p.evaluate(() => !!document.querySelector('[data-ltichk="LD"]'));
    if (hasLti) {
      await p.evaluate(() => document.querySelector('[data-ltichk="LD"]').click()); await sleep(600); o = await ov();
      await p.evaluate(async () => { await lqSend(); });
      rec('3 "Cutting lists to issue" ✓ Check also opens the list first, nothing checked yet', o && o.ok && D.find(S.db, 'lists', 'LD').checked_at == null, J(o && o.ok));
      await closeAll(p);
    } else rec('3 set-up: LD waiting for check on Cutting lists to issue', false);

    // ---------- 2. step badge on the other pages ----------
    const saw = await X.dev(browser, S, 'saw'); await saw.page.evaluate(() => { render(); }); await sleep(400);
    const sb = await saw.page.evaluate(() => [...document.querySelectorAll('.wl-wo')].map(w => w.innerText));
    rec('2 Saw: the step badge beside the WO on the list card', sb.some(x => /WO-1/.test(x) && /ASSEMBLY COMPLETE|WORK ORDER PROCESSED/.test(x)), J(sb));
    const st = await X.dev(browser, S, 'stores'); await sleep(400);
    const stb = await st.page.evaluate(() => [...document.querySelectorAll('.wl-wo')].map(w => w.innerText));
    rec('2 Stores: the step badge beside the WO', stb.some(x => /WO-1/.test(x) && /PROCESSED|ASSEMBLY/.test(x)), J(stb));
    const pm = await X.dev(browser, S, 'pm'); await sleep(400);
    const pmb = await pm.page.evaluate(() => [...document.querySelectorAll('.stp-b')].map(x => x.textContent));
    rec('2 PM board: step badges beside the WOs', pmb.length > 0, J(pmb));
    await p.evaluate(() => { showTab('h'); render(); }); await sleep(400);
    const sh = await p.evaluate(() => [...document.querySelectorAll('.sh-card .sh-top')].map(x => x.innerText));
    rec('2 Shipped tab: WO-5 with "JOB SHIPPED" beside it', sh.some(x => /WO-5/.test(x) && /JOB SHIPPED/.test(x)), J(sh));
    const dr = await p.evaluate(() => drawHTML([{ o: { wo: 'WO-D9', customer: 'A', title: 'T', step: '1. DRAWING', dueDate: '' }, why: 'drawing', seen: null }]));
    rec('2 Drawing-stage review (import): step badge "DRAWING" beside the WO', /class="stp-b"[^>]*>DRAWING</.test(dr), dr.slice(0, 200));
    const wnoS = await p.evaluate(() => stepBadge({ wo: 'X', step: '' }) === '' && stepBadge('NOPE') === '');
    rec('2 a job with no step (or not on the planner) → no empty badge', wnoS);
    // the small "✓ Check" inside a plain View still asks as before (unchanged)
    await p.evaluate(() => { window.__asked = []; lsViewDlg('LD'); }); await sleep(600);
    const v2 = await ov();
    rec('3 a plain View (not from ✓ Check) is unchanged: its small ✓ Check button, no Confirm bar', v2 && v2.small && !v2.ok, J(v2 && { small: v2.small, ok: v2.ok }));
    await closeAll(p);
    rec('no page errors', !errs.length, J(errs.slice(0, 3)));
  } catch (e) { rec('test ran without crashing', false, e.stack); }
  await browser.close(); finish();
})();
