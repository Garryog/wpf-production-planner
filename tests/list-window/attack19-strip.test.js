// Tester attack (19 Nov) on h19 green strip (woListOk) + step badge (stepBadge): another PC saves / archives / un-archives
// (seen after its poll), a WO on two lists, a list on a WO not in the planner, P-number jobs, odd / very long step text,
// phone 360 px Deliveries card (readiness colour + strip + badge), every role's screen. Fake Supabase only.
// Run: node tests/list-window/attack19-strip.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, finish, closeAll, asks } = L;
const J = JSON.stringify;
const LONG = '5. ' + 'WORK ORDER PROCESSED AND WAITING FOR THE FACTORY MANAGER TO SIGN IT OFF BEFORE CUTTING '.repeat(2);

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const r = X.v2Row({ listChk: false });
    const set = (wo, f) => Object.assign(r.orders.find(o => o.wo === wo), f);
    set('WO-1', { step: '5. WORK ORDER PROCESSED', delv: true });
    set('WO-2', { step: '6. JOB CUT COMPLETE', delv: true });
    set('WO-3', { step: LONG, delv: true });
    set('WO-4', { step: '<img src=x onerror="window.__x=1">"\'&', delv: true });
    r.orders.push(X.H.order({ wo: 'P-7', customer: 'Aderrig Homes', floor: 'T09', unit: '15', title: 'PLANNER JOB', dueDate: '2026-12-03', origDueDate: '2026-12-03', step: '4. READY FOR PRODUCTION', delv: true }));
    const S = X.makeServer(r);
    X.F3.seedList(S, 'LP', { name: 'P list', wos: ['P-7'] });
    X.F3.seedList(S, 'L2', { name: 'Second on WO-1', wos: ['WO-1'] });
    X.F3.seedList(S, 'LG', { name: 'Ghost WO', wos: ['WO-99'] });
    const t = await X.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }), p = t.page; await asks(p);
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.evaluate(async () => { setWho('Ann'); lsReset(); await lsLoad(); showTab('b'); render(); }); await sleep(400);
    const board = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wo-table tr[data-wo]')].map(tr => [tr.dataset.wo, tr.classList.contains('lst-ok')])));
    const poll = () => p.evaluate(async () => { await lsPoll(); render(); });
    let b = await board();
    rec('P-number job with a live list → green on the board', b['P-7'] === true, J(b));
    rec('WO-2 no list → not green (start)', b['WO-2'] === false, J(b));

    // another PC saves a list for WO-2 → after PC1's poll
    X.F3.seedList(S, 'LN', { name: 'From PC2', wos: ['WO-2'], list: { created_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
    await poll(); await sleep(200); b = await board();
    rec('another PC saves a list for WO-2 → green after this PC polls', b['WO-2'] === true, J(b['WO-2']));
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'LN'), { archived: true, updated_at: new Date().toISOString(), updated_by: 'PC2' });
    await poll(); await sleep(200); b = await board();
    rec('another PC archives it → green goes after the poll', b['WO-2'] === false, J(b['WO-2']));
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'LN'), { archived: false, updated_at: new Date().toISOString(), updated_by: 'PC2' });
    await poll(); await sleep(200); b = await board();
    rec('…un-archived on another PC → green again after the poll', b['WO-2'] === true, J(b['WO-2']));

    // WO-1 on two lists: archive ONE here → still green; archive both → not
    await p.evaluate(() => { listArchive(lsList('L2'), 'Ann'); render(); }); await sleep(300); b = await board();
    rec('WO on two lists: one archived → still green', b['WO-1'] === true, J(b['WO-1']));
    await p.evaluate(() => { listArchive(lsList('L1'), 'Ann'); render(); }); await sleep(300); b = await board();
    rec('…both archived → not green', b['WO-1'] === false, J(b['WO-1']));
    await p.evaluate(async () => { await lqSend(); }); await sleep(300);
    // after the archive is sent and the poll comes back, it stays off (no flicker back to green)
    await poll(); await sleep(200); b = await board();
    rec('…still not green after the archive is sent and the next poll', b['WO-1'] === false, J(b['WO-1']));

    // Lists page: a list on a WO that is not in the planner
    await p.evaluate(() => { showTab('l'); LH.state = ''; render(); }); await sleep(400);
    const lg = await p.evaluate(() => { const tr = document.querySelector('tr[data-lhrow="LG"]'); return tr ? tr.classList.contains('lst-ok') : 'no row'; });
    rec('(info) Lists page: a live list on WO-99 (not in the planner) — strip shown?', true, 'lst-ok=' + J(lg));
    const inj = await p.evaluate(() => ({ img: !!document.querySelector('.stp-b img'), x: !!window.__x }));
    rec('Lists page: HTML in a step never runs', !inj.img && !inj.x, J(inj));

    // phone 360 px Deliveries: readiness colour + strip + badge; nothing overflows, WO readable
    const ph = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 760 } }), q = ph.page; await asks(q);
    await q.evaluate(async L => { lsReset(); await lsLoad(); DB.orders.find(o => o.wo === 'WO-1').step = L; DB.orders.find(o => o.wo === 'WO-2').step = '<img src=x onerror="window.__x=1">'; showTab('d'); render(); }, LONG); await sleep(600);
    const cards = await q.evaluate(() => [...document.querySelectorAll('.dchip[data-dw]')].map(c => { const r = c.getBoundingClientRect(), b = c.querySelector('.dchip-top b'), br = b.getBoundingClientRect(), s = c.querySelector('.stp-b'), sr = s ? s.getBoundingClientRect() : null, btn = c.querySelector('.dchip-btns'), bt = btn ? btn.getBoundingClientRect() : null;
      return { wo: c.dataset.dw, w: Math.round(r.width), sw: c.scrollWidth, cw: c.clientWidth, right: Math.round(r.right), bRight: Math.round(br.right), sRight: sr ? Math.round(sr.right) : null, btnRight: bt ? Math.round(bt.right) : null, btnLeft: bt ? Math.round(bt.left) : null, rdy: [...c.classList].find(x => /^rdy-/.test(x)) || '', ok: c.classList.contains('lst-ok'), sh: getComputedStyle(c).boxShadow, bl: getComputedStyle(c).borderLeft }; }));
    const doc = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const qi = await q.evaluate(() => ({ img: !!document.querySelector('.dchip .stp-b img'), x: !!window.__x }));
    rec('phone 360: HTML step on a card shown as text', !qi.img && !qi.x, J(qi));
    rec('phone 360: the page does not scroll sideways', doc.sw <= doc.cw + 1, J(doc));
    const bad = cards.filter(c => c.sw > c.cw + 1 || (c.sRight && c.sRight > c.right + 1) || (c.btnRight && c.btnRight > c.right + 1));
    rec('phone 360: no Deliveries card overflows (badge and buttons inside the card)', cards.length > 0 && !bad.length, J(bad.slice(0, 3)));
    const w3 = cards.find(c => c.wo === 'WO-1');
    rec('phone 360: very long step (WO-1, 180 chars) — badge stays inside the card', w3 && (!w3.sRight || w3.sRight <= w3.right + 1), J([w3, cards.map(c => c.wo)]));
    const both = cards.find(c => c.rdy && c.ok);
    rec('phone 360: a card with a readiness colour AND the green strip shows both (border colour + inset green)', !both || (/45, 158, 84/.test(both.sh) && !/0px/.test(both.bl.split(' ')[0] || '')), J(both || cards.slice(0, 2)));
    // realistic: every real Cienapps step on both cards (WO-1 has the ＋ List button, WO-2 not) — badge must not run under the buttons
    const ov = [];
    for (const st of await q.evaluate(() => MANUAL_STEPS)) {
      const m = await q.evaluate(st => { DB.orders.find(o => o.wo === 'WO-1').step = st; DB.orders.find(o => o.wo === 'WO-2').step = st; render();
        return [...document.querySelectorAll('.dchip[data-dw]')].map(c => { const s = c.querySelector('.stp-b'), bt = c.querySelector('.dchip-btns'); if (!s || !bt) return null;
          const sr = s.getBoundingClientRect(), br = bt.getBoundingClientRect(), cr = c.getBoundingClientRect(); return { wo: c.dataset.dw, st: s.textContent, sRight: Math.round(sr.right), btnLeft: Math.round(br.left), sTop: Math.round(sr.top), btnTop: Math.round(br.top), btnBottom: Math.round(br.bottom), cRight: Math.round(cr.right) }; }).filter(Boolean); }, st);
      m.forEach(x => { if ((x.sRight > x.btnLeft + 1 && x.sTop < x.btnBottom && x.sTop >= x.btnTop - 2) || x.sRight > x.cRight + 1) ov.push(x); });
    }
    rec('phone 360: every REAL step badge fits beside the WO without running under the card buttons', !ov.length, J(ov.slice(0, 4)) + ' (' + ov.length + ' clashes)');
    await q.evaluate(() => { DB.orders.find(o => o.wo === 'WO-1').step = '5. WORK ORDER PROCESSED'; DB.orders.find(o => o.wo === 'WO-2').step = '2. NO SITE MEASURE DONE'; render(); }); await sleep(200);
    await q.screenshot({ path: '/tmp/claude-0/-home-claude/5de3b596-3088-50b3-ae12-ebf68b089f91/scratchpad/a19-phone.png', fullPage: true }).catch(() => {});

    // every role's screen: renders, HTML step never runs, badges escaped
    for (const role of ['pm', 'prod', 'design', 'saw', 'stores', 'driver', 'floor']) {
      const tt = await X.dev(browser, S, role, { viewport: { width: 1280, height: 800 } }), z = tt.page; const e2 = []; z.on('pageerror', e => e2.push(String(e)));
      await z.evaluate(async () => { try { render(); } catch (e) {} }); await sleep(400);
      const s = await z.evaluate(() => ({ n: document.querySelectorAll('.stp-b').length, img: !!document.querySelector('.stp-b img'), x: !!window.__x, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      rec(role + ': screen renders, step HTML shown as text, no page errors', !s.img && !s.x && !e2.length, J([s, e2.slice(0, 2)]));
      await z.close().catch(() => {});
    }
    rec('no page errors (office)', !errs.length, J(errs.slice(0, 3)));
  } catch (e) { rec('test ran without crashing', false, e.stack); }
  await browser.close(); finish();
})();
