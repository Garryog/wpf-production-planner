// Tester attack 4 — Deliveries usability D1–D4 + DD1 (plan addendum 10 Nov 2026, evening). Tries to break: the week-move
// engine at bank holidays / Wk 53 / year end / clock change / Saturday deliveries; cancel paths; roles; XSS; layout with
// unbroken long text at 360 / 1366 px; Prev/Next walking; Close Wk N; stale drag; two PCs; L12 (WO drop-down by due date).
// Stubbed Supabase only (tests/harness.js + tests/stage1/srv.js). Run: node tests/dates/attack4-usability.test.js
const { H, makeServer, open, recorder, save, reload, w } = require('./attack1-lib');
const { rec, done } = recorder('attack4-usability');
const XSS = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
  const run = async (now, fn, arg) => { const t = await H.open({ browser, now, row: { id: 'main', nid: 9, settings: {}, orders: [] } }); const r = await t.page.evaluate(fn, arg); await t.close(); return r; };

  // ---------- E. engine: bank holidays, Wk 53, year end, clock change, Saturday, no working days left ----------
  {
    const E = await run('2026-11-10T10:00:00Z', () => {
      const f = (due, deliv, W) => wkMoveTo({ dueDate: due, delivDate: deliv }, W);
      return { sat: f('2026-11-12', '2026-11-14', '2026-11-16'), x1718: f('2026-12-17', '2026-12-18', '2026-12-21'), f18w53: f('2026-12-18', '', '2026-12-28'),
        m21w1: f('2026-12-21', '', '2027-01-04'), t29w1: f('2026-12-29', '', '2027-01-04'), satDue: f('2026-11-14', '', '2026-11-16'),
        lbl: [dTagTxt('2026-12-31'), dTagTxt('2027-01-01'), dTagTxt('2027-01-04')], wn: [wkNum('2026-12-28'), wkNum('2027-01-01'), wkNum('2027-01-04')],
        gap: f('2026-11-13', '2026-11-16', '2026-12-28') };
    });
    rec('E1: Saturday delivery (Sat 14 Nov) → next week keeps the weekday (Sat 21 Nov — vans deliver on Saturdays, the grid has a Sat column)', E.sat.deliv === '2026-11-21', JSON.stringify(E.sat));
    rec('E2: Christmas — due Thu 17 / delivery Fri 18 Dec → Wk 52: both Thu 24 Dec (Fri 25 is Christmas), due not after delivery', E.x1718.deliv === '2026-12-24' && E.x1718.due <= E.x1718.deliv, JSON.stringify(E.x1718));
    rec('E3: Fri 18 Dec → Wk 53 = Thu 31 Dec (Fri 1 Jan bank holiday)', E.f18w53.due === '2026-12-31', JSON.stringify(E.f18w53));
    rec('E4: Mon 21 Dec → Wk 1 2027 = Mon 4 Jan; Tue 29 Dec → Tue 5 Jan', E.m21w1.due === '2027-01-04' && E.t29w1.due === '2027-01-05', JSON.stringify([E.m21w1, E.t29w1]));
    rec('E5: Saturday due date → next week = Fri (working day before, same week)', E.satDue.due === '2026-11-20', JSON.stringify(E.satDue));
    rec('E6: year labels — "Thu 31 Dec · Wk 53", "Fri 1 Jan 2027 · Wk 53", "Mon 4 Jan 2027 · Wk 1"', E.lbl.join('|') === 'Thu 31 Dec · Wk 53|Fri 1 Jan 2027 · Wk 53|Mon 4 Jan 2027 · Wk 1' && E.wn.join() === '53,53,1', E.lbl.join('|'));
    rec('E7: due Fri 13 / delivery Mon 16 Nov → Wk 53: delivery Tue 29 Dec (Mon 28 bank hol), due Thu 24 Dec, due still before delivery', E.gap.deliv === '2026-12-29' && E.gap.due === '2026-12-24', JSON.stringify(E.gap));
    const X = await run('2026-12-25T10:00:00Z', () => ({ a: wkMoveTo({ dueDate: '2026-12-22' }, '2026-12-21'), b: wkMoveTo({}, '2026-12-21'), c: wkMoveTo({ dueDate: '2026-12-22' }, '2026-12-28') }));
    rec('E8: on Christmas Day, This week (Wk 52) has no working days left — nothing moves, says pick Next week; Wk 53 → Tue 29 Dec', /No working days left in Wk 52/.test(X.a.err) && /No working days left/.test(X.b.err) && X.c.due === '2026-12-29', JSON.stringify(X));
    const S = await run('2026-11-14T10:00:00Z', () => ({ a: wkMoveTo({ dueDate: '2026-11-12' }, '2026-11-09'), b: wkMoveTo({ dueDate: '2026-11-12', delivDate: '2026-11-19' }, '2026-11-09') }));
    rec('E9: Saturday — This week has no working days left (with and without a delivery date)', !!S.a.err && !!S.b.err && !S.a.due && !S.b.deliv, JSON.stringify(S));
    const C = await run('2026-10-26T00:30:00Z', () => ({ t: todayLocal(), wk: thisWk(), a: wkMoveTo({ dueDate: '2026-10-23' }, '2026-10-26'), b: wkMoveTo({}, '2026-10-26') }));
    rec('E10: clock change night (Mon 26 Oct 00:30, also bank holiday) — this week is Wk 44; overdue Fri 23 Oct → Fri 30 Oct; no date → Fri 30 Oct', C.wk === '2026-10-26' && C.a.due === '2026-10-30' && C.b.due === '2026-10-30', JSON.stringify(C));
    const C2 = await run('2026-10-25T23:30:00Z', () => ({ t: todayLocal(), wk: thisWk(), a: wkMoveTo({ dueDate: '2026-10-22' }, '2026-10-19') }));
    rec('E11: Sun 25 Oct 23:30 (after the clock went back) — still Wk 43, no working days left in it', C2.t === '2026-10-25' && C2.wk === '2026-10-19' && !!C2.a.err, JSON.stringify(C2));
    const C3 = await run('2027-03-28T23:30:00Z', () => ({ t: todayLocal(), wk: thisWk(), a: wkMoveTo({ dueDate: '2027-03-24' }, '2027-04-05') }));
    rec('E12: spring clock change (Mon 29 Mar 2027 00:30 local) — Wk 13; Wed 24 Mar → Wk 14 = Wed 7 Apr', C3.wk === '2027-03-29' && C3.a.due === '2027-04-07', JSON.stringify(C3));
  }

  // ---------- U. the Deliveries page at 1366 px ----------
  const LONGW = 'WO-26179999999999999-12345678', LONGF = 'GroundFloorBlockCNorthWingExtensionPhaseTwo', LONGU = 'Apartment1004B-EXTENDED-REAR-ANNEXE-UNIT-NUMBER';
  const LONGT = 'TypeBkitchen-handleless-FenixNTMworktop-fullheightlarder-integratedappliances-averylongdescriptionwithnospacesatall';
  const LONGC = 'ASPECTATHENRYDEVELOPMENTSLIMITEDPHASETWOANDTHREE';
  const rowU = () => ({ id: 'main', nid: 9, settings: { delx: [
    { wo: 'JOB-M1', title: 'Spare doors', customer: 'ASPECT', value: 450, manual: true, delVeh: '', delDay: '', delDone: false },
    { wo: 'JOB-X', title: XSS, customer: XSS, value: 10, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
    O('WO-1'), O('WO-2', { dueDate: '2026-11-04', origDueDate: '2026-11-04' }), O('WO-3', { dueDate: '2026-11-02', origDueDate: '2026-11-02' }),
    O(LONGW, { floor: LONGF, unit: LONGU, title: LONGT, customer: LONGC, value: 48200, dueDate: '2026-11-13', delivDate: '2026-11-13', dueHist: Array.from({ length: 12 }, (_, i) => ({ at: '2026-11-0' + (1 + i % 9) + 'T10:00:00Z', by: 'x', f: 'due', from: '2026-11-01', to: '2026-11-13', why: 'Production' })) }),
    O('WO-LB', { floor: LONGF, unit: LONGU, title: LONGT, customer: LONGC, delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09', dueDate: '2026-11-11', delivDate: '2027-01-04' }),
    O('WO-X', { title: XSS, customer: XSS, floor: XSS, unit: XSS, step: '7. ASSEMBLY COMPLETE', dueHist: [{ at: '2026-11-09T10:00:00Z', by: XSS, f: 'due', from: '2026-11-05', to: '2026-11-12', why: 'Other', note: XSS }], delRebook: { at: '2026-11-09T10:00:00Z', by: XSS, why: XSS, was: XSS + '|Tue' }, delMoves: [{ at: '2026-11-09T10:00:00Z', by: XSS, why: XSS, from: 'VOLVO|Tue', to: '' }] }),
    O('WO-D', { delVeh: 'DAF', delDay: 'Tue', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z', delDispAt: '2026-11-10T08:00:00Z' }),
    O('WO-DONE', { delVeh: 'DAF', delDay: 'Mon', delWk: '2026-11-09', delLoadedAt: '2026-11-09T07:00:00Z', delDelivAt: '2026-11-09T12:00:00Z', delDone: true }),
    O('WO-RB1', { delRebook: { at: '2026-11-09T10:00:00Z', by: 'A', why: 'x', was: 'VOLVO|Tue' }, value: 1234.6 }), O('WO-RB2', { delRebook: { at: '2026-11-09T10:00:00Z', by: 'A', why: 'x', was: 'VOLVO|Tue' }, value: 765.5 }),
    O('WO-L1', { dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '', value: 2000.4, customer: 'B' }), O('WO-L2', { dueDate: '2026-12-16', origDueDate: '2026-12-16', plannedWeek: '', value: 3000.4, customer: 'A' }),
    O('WO-L3', { dueDate: '2027-01-20', origDueDate: '2027-01-20', plannedWeek: '', value: 99 }),
    O('WO-B15', { delVeh: 'IVECO', delDay: 'Thu', delWk: '2027-02-22', dueDate: '2027-02-25', origDueDate: '2027-02-25', plannedWeek: '' }),
  ] });
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: rowU(), viewport: { width: 1366, height: 900 } });
    const p = t.page;
    const A = await p.evaluate(async ([LONGW]) => {
      const wt = ms => new Promise(r => setTimeout(r, ms)), out = {}, g = x => DB.orders.find(o => o.wo === x), gx = x => DB.delx.find(o => o.wo === x);
      const go = async t => { const b = document.querySelector('[data-deltab="' + t + '"]'); if (b) b.click(); else { delTab = t; render(); } await wt(80); };
      const snap = () => JSON.stringify({ o: DB.orders, x: DB.delx });
      const closeAll = () => document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      const xssCheck = lbl => { const n = document.querySelectorAll('img[src="x"]').length; if (n || window.__xss) (out.xss = out.xss || []).push(lbl + ':' + n + '/' + (window.__xss || 0)); };
      showTab('d'); await wt(150); xssCheck('pool');
      // ---- layout at 1366: spill / overlap with unbroken text, € and footers ----
      const spill = () => { const bad = []; document.querySelectorAll('.dchip').forEach(c => { if (c.offsetParent === null) return; const r = c.getBoundingClientRect(); c.querySelectorAll('*').forEach(e => { if (e.classList.contains('dq-in') || e.offsetParent === null) return; const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) bad.push(c.dataset.dw + ':' + (e.className || e.tagName) + ':' + Math.round(q.right - r.right)); }); });
        const cs = [...document.querySelectorAll('.dchip')].filter(c => c.offsetParent).map(c => [c.dataset.dw, c.getBoundingClientRect()]); for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i][1], b = cs[j][1]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push('overlap ' + cs[i][0] + '/' + cs[j][0]); } return bad; };
      // is the text cut off (clipped) so the user can't read it?
      const clipped = wo => { const c = document.querySelector('.dchip[data-dw="' + wo + '"]'); if (!c) return 'no card'; return [...c.querySelectorAll('b,.dfu,.dchip-t,.dchip-c,.due-tag')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => (e.className || e.tagName) + ' ' + e.scrollWidth + '>' + e.clientWidth); };
      out.spill0 = spill(); out.clip0 = clipped(LONGW); out.clipLB = clipped('WO-LB');
      // a cut-off badge / title must still be readable somewhere (tooltip on PC)
      const c0 = document.querySelector('.dchip[data-dw="' + LONGW + '"]');
      out.tips = [...c0.querySelectorAll('.dfu,.dchip-t')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => (e.className) + ' title=' + (e.getAttribute('title') || '') + ' card=' + (c0.getAttribute('title') || '').slice(0, 40));
      const foot = () => [...document.querySelectorAll('#dpool .dgrp')].map(gp => { const wos = [...gp.querySelectorAll('.dchip')].map(c => c.dataset.dw); const sum = wos.reduce((a, x) => a + (+(findDel(x) || {}).value || 0), 0); const f = (gp.querySelector('.dgrp-f') || {}).textContent || ''; const h = (gp.querySelector('.dgrp-h') || {}).textContent || ''; return { h: h.slice(0, 60), f, ok: f === wos.length + ' job' + (wos.length !== 1 ? 's' : '') + ' · €' + Math.round(sum).toLocaleString() }; });
      out.foot0 = foot(); out.euro0 = [...document.querySelectorAll('.dchip')].filter(c => /€/.test(c.textContent)).map(c => c.dataset.dw);
      // tabs
      out.tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab);
      // ---- cancel paths leave nothing changed (and nothing saved) ----
      const s0 = snap(), p0 = window.__patchN = 0;
      // (a) week picker → Cancel
      document.querySelector('[data-wkpick="WO-1"]').click(); await wt(60); document.querySelector('#wkpick-dlg #pod-x').click(); await wt(60);
      // (b) → Wk 47 → reason Cancel
      document.querySelector('[data-wknext="WO-1"]').click(); await wt(60); out.c_b = !!document.querySelector('.pod-ovl [data-why]'); document.querySelector('.pod-ovl #pod-x').click(); await wt(60);
      // (c) preview (moved out far) → Cancel
      document.querySelector('[data-wkpick="WO-1"]').click(); await wt(60); document.querySelector('#wkpick-dlg [data-wkp="2026-12-21"]').click(); await wt(60);
      out.c_c = !!document.getElementById('wkprev-dlg'); const px = document.querySelector('#wkprev-dlg #pod-x'); if (px) px.click(); await wt(60);
      // (d) Move ticked → picker → backdrop click
      delSel.clear(); delSel.add('WO-1'); delSel.add('WO-2'); render(); await wt(60); document.getElementById('selwk').click(); await wt(60);
      const ov = document.getElementById('wkpick-dlg'); ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wt(60);
      // (e) "who are you" Cancel (new tab, no name yet)
      sessionStorage.removeItem('wpfWho'); document.querySelector('[data-wknext="WO-1"]').click(); await wt(60);
      out.c_e = !!document.getElementById('pick-other'); const wx = document.querySelector('.pod-ovl #pod-x'); if (wx) wx.click(); await wt(60);
      // (f) quick edit, who Cancel → input reset
      const qi = document.querySelector('.dq-in[data-dq="WO-1"][data-f="due"]'); qi.value = '2026-11-27'; qi.dispatchEvent(new Event('change')); await wt(60);
      const wx2 = document.querySelector('.pod-ovl #pod-x'); if (wx2) wx2.click(); await wt(60); out.c_f = qi.value;
      sessionStorage.setItem('wpfWho', 'Tester');
      // (g) drop on a tab, then Cancel the reason
      delDragList = ['WO-1']; const tb = document.querySelector('[data-deltab="2"]'); tb.dispatchEvent(new Event('dragover', { cancelable: true })); tb.dispatchEvent(new Event('drop', { cancelable: true })); await wt(60);
      const rx = document.querySelector('.pod-ovl #pod-x'); if (rx) rx.click(); await wt(60);
      delSel.clear(); render(); await wt(60);
      out.cancelSame = snap() === s0; out.ovLeft = document.querySelectorAll('.pod-ovl').length;
      // ---- stale drag: a card drag that ended without a drop, then something else dragged over a week tab ----
      const card = document.querySelector('.dchip[data-dw="WO-1"]');
      const dt = new DataTransfer(); card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); await wt(40);
      out.staleList = JSON.stringify(delDragList);
      const tb2 = document.querySelector('[data-deltab="3"]'); const ev = new Event('dragover', { cancelable: true }); tb2.dispatchEvent(ev); out.staleAccept = ev.defaultPrevented;
      tb2.dispatchEvent(new Event('drop', { cancelable: true })); await wt(60); out.staleDlg = !!document.querySelector('.pod-ovl'); closeAll(); delDragList = null;
      // ---- XSS through the dialogs: pick, preview, reason (Other: typed text), summary, history ----
      window.prompt = () => '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
      document.querySelector('[data-wkpick="WO-X"]').click(); await wt(60); xssCheck('wkpick');
      document.querySelector('#wkpick-dlg [data-wkp="2026-12-21"]').click(); await wt(60); xssCheck('wkprev');
      const go2 = document.getElementById('wkp-go'); if (go2) go2.click(); await wt(60); xssCheck('reason');
      const oth = document.querySelector('.pod-ovl [data-why="Other"]'); if (oth) oth.click(); await wt(120); xssCheck('after-other');
      out.xNote = JSON.stringify((g('WO-X').dueHist || []).slice(-1)[0] || {}).slice(0, 200);
      closeAll(); render(); await wt(60); xssCheck('re-render');
      const hb = document.querySelector('.dchip[data-dw="WO-X"] [data-duehist]'); if (hb) { hb.click(); await wt(60); xssCheck('history'); } closeAll();
      // manual XSS job → move to Wk 48 → toast / summary
      document.querySelector('[data-wkpick="JOB-X"]') && document.querySelector('[data-wkpick="JOB-X"]').click(); await wt(60);
      const m48 = document.querySelector('#wkpick-dlg [data-wkp="2026-11-23"]'); if (m48) { m48.click(); await wt(60); const r = document.querySelector('.pod-ovl [data-why="Production"]'); if (r) r.click(); await wt(80); } xssCheck('manual'); closeAll();
      document.getElementById('btn-instore').click(); await wt(80); xssCheck('instore'); out.storeTag = !!document.querySelector('#del-store .due-tag');
      showTab('b'); await wt(150); xssCheck('board'); showTab('d'); await wt(100);
      // ---- overdue jobs on This week: "→ Wk 47" each; ticked together → both land in Wk 47 on their own weekday ----
      await go('0');
      out.ovBtn = [...document.querySelectorAll('[data-wknext="WO-2"],[data-wknext="WO-3"]')].map(b => b.textContent);
      delSel.clear(); delSel.add('WO-2'); delSel.add('WO-3'); render(); await wt(60);
      document.getElementById('selwk').click(); await wt(60); document.querySelector('#wkpick-dlg [data-wkp="2026-11-16"]').click(); await wt(60);
      if (document.getElementById('wkp-go')) document.getElementById('wkp-go').click(); await wt(60);
      const r2 = document.querySelector('.pod-ovl [data-why="Production"]'); if (r2) r2.click(); await wt(100); closeAll();
      out.ov = [g('WO-2').dueDate, g('WO-3').dueDate, g('WO-2').plannedWeek];
      // ---- ticked: dispatched job (on the road) + delivered job → count / result ----
      delSel.clear(); ['WO-D', 'WO-DONE', 'WO-1'].forEach(x => delSel.add(x)); render(); await wt(60);
      out.selTxt = (document.getElementById('selwk') || {}).textContent || '';
      document.getElementById('selwk').click(); await wt(60); document.querySelector('#wkpick-dlg [data-wkp="2026-11-30"]').click(); await wt(60);
      out.prevD = (document.getElementById('wkprev-dlg') || {}).textContent || '';
      if (document.getElementById('wkp-go')) document.getElementById('wkp-go').click(); await wt(60);
      const r3 = document.querySelector('.pod-ovl [data-why="Customer delay"]'); if (r3) r3.click(); await wt(100);
      out.sumD = (document.getElementById('date-sum') || {}).textContent || ''; closeAll();
      out.D = { due: g('WO-D').dueDate, day: g('WO-D').delDay, mv: !!(g('WO-D').dueMv && g('WO-D').dueMv.loaded) }; out.DONE = g('WO-DONE').dueDate;
      // ---- Prev / Next walking: 0 → +12 → Later → ? and back; booked week far ahead (+15) ----
      await go('0'); const lbls = [];
      for (let k = 0; k < 14; k++) { lbls.push(delTab); document.getElementById('wkb-next').click(); await wt(30); }
      lbls.push(delTab); out.walkN = lbls.join(',');
      const back = []; for (let k = 0; k < 4; k++) { document.getElementById('wkb-prev').click(); await wt(30); back.push(delTab); } out.walkP = back.join(',');
      const far = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab).find(x => +x > 12);
      out.far = far || '';
      if (far) { await go(far); out.farPrevDis = document.getElementById('wkb-prev').disabled; out.farLbl = document.getElementById('wkb-lbl').textContent; document.getElementById('wkb-next').click(); await wt(30); out.farNext = delTab; }
      // ---- Close Wk N: this week has bookings → shown; a future week → hidden ----
      await go('0'); out.close0 = !!document.getElementById('btn-delreset');
      await go('1'); out.close1 = !!document.getElementById('btn-delreset');
      // ---- footer totals in rebook + Later groups ----
      await go('0'); out.footRb = foot().filter(f => /not delivered/i.test(f.h));
      await go('later'); out.footL = foot();
      // ---- selected tab survives a sync from another PC (loadDB) ----
      await go('2'); await loadDB(); await wt(150); out.afterSync = delTab;
      await wt(1600);
      return out;
    }, [LONGW]);
    rec('U1: 1366 px, unbroken long WO / Floor / Unit / title / customer — nothing spills out of a card, no overlap', !A.spill0.length, A.spill0.join(', '));
    rec('U2: 1366 px — a Floor / Unit / title too long for the card is cut off with … (as planned) but the full text is in its tooltip', A.tips.every(x => /title=(Floor|Unit) \S{10,}/.test(x) || /dchip-t title=\S{10,}/.test(x)), JSON.stringify(A.tips));
    rec('U3: no € on any card; every pool group footer adds up', !A.euro0.length && A.foot0.every(f => f.ok), JSON.stringify(A.foot0));
    rec('U4: every cancel path (picker, reason, preview, backdrop, who-are-you, quick edit, tab drop) leaves the data unchanged, no dialog left', A.cancelSame && A.ovLeft === 0 && A.c_b && A.c_c && A.c_e && A.c_f === '2026-11-12', JSON.stringify({ same: A.cancelSame, left: A.ovLeft, b: A.c_b, c: A.c_c, e: A.c_e, f: A.c_f }));
    rec('U5: a card drag that ended without a drop does not leave the job "in hand" (a later drag of anything else over a week tab must not move it)', A.staleList === 'null' || (!A.staleAccept && !A.staleDlg), JSON.stringify({ list: A.staleList, accept: A.staleAccept, dlg: A.staleDlg }));
    rec('U6: XSS in title / customer / floor / unit / reason / history / rebook note / manual job — nothing runs anywhere (pool, dialogs, In store, board)', !A.xss, JSON.stringify(A.xss));
    rec('U7: In store shows the due tag', A.storeTag, '');
    rec('U8: overdue Wed 4 Nov + Mon 2 Nov on This week, ticked → Wk 47: Wed 18 Nov and Mon 16 Nov, build week Wk 47', A.ovBtn.every(x => x === '→ Wk 47') && A.ov[0] === '2026-11-18' && A.ov[1] === '2026-11-16' && A.ov[2] === '2026-11-16', JSON.stringify([A.ovBtn, A.ov]));
    rec('U9: dispatched (on the road) job ticked + moved → stays on its van, flagged; delivered job is not counted or moved', /\(2\)/.test(A.selTxt) && A.D.day === 'Tue' && A.D.mv && A.DONE === '2026-11-12', JSON.stringify({ sel: A.selTxt, D: A.D, DONE: A.DONE, prev: A.prevD.slice(0, 200) }));
    rec('U10: Next ▶ walks This week … +12, then Later, and STOPS (or is disabled) — it must not jump back to Wk +4', /^0,1,2,3,4,5,6,7,8,9,10,11,12,later,later$/.test(A.walkN) || /^0,1,2,3,4,5,6,7,8,9,10,11,12,later$/.test(A.walkN.split(',').slice(0, 14).join(',')) && A.walkN.split(',')[14] !== '4', A.walkN);
    rec('U11: Prev ◀ from Later goes back to the last week walked (+12), not +3', A.walkP.split(',')[0] === '12' || A.walkP.split(',')[0] === '11', A.walkP);
    // Coder 10 Nov (night): rule set by the lead — a booked week beyond +12 walks Prev to the booked week before it (or +12) and Next to the
    // booked week after it, or Later when it is the last one (here it is the only one, so Next = Later). Was: Next must not be Later.
    rec('U12: a week booked beyond +12 (Wk 9 2027) has a tab; on it Prev is not dead and Next goes on to Later (the last booked week)', !A.far || (!A.farPrevDis && A.farNext === 'later'), JSON.stringify({ far: A.far, prevDis: A.farPrevDis, next: A.farNext, lbl: A.farLbl }));
    rec('U13: Close Wk 46 shown (this week has bookings); hidden on Next week', A.close0 && !A.close1, JSON.stringify([A.close0, A.close1]));
    rec('U14: rebook group footer and Later group footers add up (rounded total of the group)', A.footRb.length === 1 && A.footRb.every(f => f.ok) && A.footL.length >= 1 && A.footL.every(f => f.ok), JSON.stringify([A.footRb, A.footL]));
    rec('U15: the selected week tab stays selected after a sync from another PC', A.afterSync === '2', A.afterSync);
    rec('no page errors (U)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---------- P. 360 px phone: long unbroken text, the week bar, buttons ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: rowU(), viewport: { width: 360, height: 740 } });
    const B = await t.page.evaluate(async () => {
      showTab('d'); await new Promise(r => setTimeout(r, 150));
      const out = { spill: [] };
      document.querySelectorAll('.dchip').forEach(c => { if (c.offsetParent === null) return; const r = c.getBoundingClientRect(); if (c.closest('#dpool') && r.right > 361) out.spill.push(c.dataset.dw + ' card ' + Math.round(r.right)); c.querySelectorAll('*').forEach(e => { if (e.classList.contains('dq-in') || e.offsetParent === null) return; const q = e.getBoundingClientRect(); if (q.width && q.right > r.right + 1) out.spill.push(c.dataset.dw + ':' + (e.className || e.tagName)); }); });
      out.docW = document.documentElement.scrollWidth;
      const bar = document.getElementById('del-wkbar').getBoundingClientRect(); out.bar = { r: Math.round(bar.right), l: Math.round(bar.left) };
      const lbl = document.getElementById('wkb-lbl'); out.lblClip = lbl.scrollWidth > lbl.clientWidth + 1; out.lbl = lbl.textContent;
      // the year-end label is the longest: walk to Wk 1 2027
      for (let k = 0; k < 8; k++) { document.getElementById('wkb-next').click(); await new Promise(r => setTimeout(r, 30)); }
      const l2 = document.getElementById('wkb-lbl'); out.lbl2 = l2.textContent; out.bar2 = Math.round(document.getElementById('del-wkbar').getBoundingClientRect().right);
      return out;
    });
    rec('P1: 360 px — unbroken long WO / Floor / Unit / title: nothing spills out of a card (pool or van grid)', !B.spill.length, B.spill.join(', '));
    rec('P2: 360 px — week bar fits on screen (This week and at Wk 1 2027)', B.bar.r <= 360 && B.bar2 <= 360, JSON.stringify(B));
    rec('no page errors (P)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---------- R. roles that can't move dates: rendered screens, direct calls, tab drop ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: rowU(), viewport: { width: 1366, height: 900 } });
    const R = await t.page.evaluate(async () => {
      const wt = ms => new Promise(r => setTimeout(r, ms)), out = {}, g = x => DB.orders.find(o => o.wo === x);
      const s0 = JSON.stringify(DB.orders);
      for (const r of ['saw', 'stores', 'driver', 'floor', 'pm', 'dash', 'design']) {
        localStorage.setItem('wpfPin_' + r, '9000'); try { setRole(r); } catch (e) { out[r] = 'err ' + e; continue; } await wt(120);
        const app = document.getElementById('app');
        out[r] = { btn: app.querySelectorAll('[data-dqb],[data-wknext],[data-wkpick],#selwk,.dq-in').length, tags: app.querySelectorAll('.due-tag').length };
        // direct calls must refuse
        dqChange('WO-1', 'due', '2026-11-27', null); wkMoveDo(['WO-1'], '2026-11-16'); wkPickDlg(['WO-1']); await wt(60);
        out[r].dlg = document.querySelectorAll('.pod-ovl').length; document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      }
      out.same = JSON.stringify(DB.orders) === s0;
      setRole('office'); await wt(100);
      return out;
    });
    const viewOnly = ['saw', 'stores', 'driver', 'floor', 'pm', 'dash', 'design'].every(r => R[r] && !R[r].btn && !R[r].dlg);
    rec('R1: saw / stores / driver / floor / PM / management / drawing office — no date picker, no week buttons, direct calls refused, nothing changed', viewOnly && R.same, JSON.stringify(R));
    const shown = ['saw', 'stores', 'driver', 'floor', 'pm'].filter(r => R[r] && !R[r].tags);
    rec('R2 (DD1 info, Job B): screens that show work orders but no due tag yet: ' + (shown.join(', ') || 'none'), true, JSON.stringify(R));
    rec('no page errors (R)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---------- T. two PCs: same job moved on both; manual planWk on both; manual planWk vs a new manual job ----------
  {
    const row = () => ({ id: 'main', version: 1, nid: 9, settings: { delx: [
      { wo: 'JOB-M1', title: 'Spare doors', customer: 'ASPECT', value: 450, manual: true, delVeh: '', delDay: '', delDone: false },
      { wo: 'JOB-M2', title: 'Site kit', customer: 'ASPECT', value: 50, manual: true, delVeh: '', delDay: '', delDone: false }] },
      orders: [O('WO-1'), O('WO-2', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09' })] });
    const S = makeServer(row());
    const A = await open(browser, S, { now: '2026-11-10T10:00:00Z' }), B = await open(browser, S, { now: '2026-11-10T10:00:00Z' });
    const mv = (p, wos, W, why) => p.evaluate(async ([wos, W, why]) => { showTab('d'); await new Promise(r => setTimeout(r, 80)); wkMoveDo(wos, W); await new Promise(r => setTimeout(r, 80));
      const go = document.getElementById('wkp-go'); if (go) { go.click(); await new Promise(r => setTimeout(r, 60)); }
      const b = document.querySelector('.pod-ovl [data-why="' + why + '"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 80)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); }, [wos, W, why]);
    // both open, A moves WO-1 to Wk 47, B (stale) moves WO-1 to Wk 49; A saves first
    await mv(A.page, ['WO-1'], '2026-11-16', 'Production');
    // the two fake clocks start a few seconds apart: wait until B's clock is past A's move, so B's move is genuinely the newer one
    const aAt = await A.page.evaluate(() => (DB.orders.find(x => x.wo === 'WO-1').dueHist || []).slice(-1)[0].at);
    for (let i = 0; i < 100 && (await B.page.evaluate(() => new Date().toISOString())) <= aAt; i++) await w(200);
    await w(1100);
    await mv(B.page, ['WO-1'], '2026-11-30', 'Customer delay');
    await save(A.page); await save(B.page); await w(300); await reload(A.page); await reload(B.page);
    const st = p => p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'), m1 = DB.delx.find(x => x.wo === 'JOB-M1'), m2 = DB.delx.find(x => x.wo === 'JOB-M2'), m3 = DB.delx.find(x => x.wo === 'JOB-M3');
      return { due: o.dueDate, wk: o.plannedWeek, keep: o.dueKeep, h: (o.dueHist || []).map(x => x.to + ':' + x.why), m1: m1 && m1.planWk, m1log: ((m1 && m1.log) || []).map(l => l.what), m2: m2 && m2.planWk, m3: !!m3 }; });
    const a1 = await st(A.page), b1 = await st(B.page);
    rec('T1: two PCs move the same job (A → Wk 47, then B → Wk 49, A saves first) — the newer move (B, Thu 3 Dec) wins, both PCs agree, build week matches, both moves in history', JSON.stringify(a1) === JSON.stringify(b1) && a1.due === '2026-12-03' && a1.wk === wkOfIso(a1.due) && a1.h.length === 2, JSON.stringify(a1));
    // manual planWk on both PCs: A → Wk 47, B → Wk 48 (different manual jobs) — both kept?
    await mv(A.page, ['JOB-M1'], '2026-11-16', 'Production'); await mv(B.page, ['JOB-M2'], '2026-11-23', 'Production');
    await save(A.page); await save(B.page); await w(300); await reload(A.page); await reload(B.page);
    const a2 = await st(A.page);
    rec('T2: two PCs plan DIFFERENT manual jobs (A: JOB-M1 → Wk 47, B: JOB-M2 → Wk 48) — both kept', a2.m1 === '2026-11-16' && a2.m2 === '2026-11-23', JSON.stringify(a2));
    // same manual job on both PCs: last save wins, and the history should show both
    await mv(A.page, ['JOB-M1'], '2026-11-30', 'Production'); await mv(B.page, ['JOB-M1'], '2026-12-07', 'Materials');
    await save(A.page); await save(B.page); await w(300); await reload(A.page); await reload(B.page);
    const a3 = await st(A.page), b3 = await st(B.page);
    rec('T3: same manual job planned on two PCs — both PCs agree on one week (last save wins)', a3.m1 === b3.m1 && ['2026-11-30', '2026-12-07'].includes(a3.m1), JSON.stringify([a3.m1, b3.m1, a3.m1log]));
    // A moves a manual job's week while B adds a new manual job (Add Job)
    await mv(A.page, ['JOB-M2'], '2026-12-14', 'Production');
    await B.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 80)); document.getElementById('aj-wo').value = 'JOB-M3'; document.getElementById('aj-title').value = 'New kit'; document.getElementById('aj-add').click(); await new Promise(r => setTimeout(r, 80)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); });
    await save(A.page); await save(B.page); await w(300); await reload(A.page); await reload(B.page);
    const a4 = await st(A.page);
    rec('T4: A plans a manual job for Wk 51 while B adds a new manual job — both kept', a4.m2 === '2026-12-14' && a4.m3, JSON.stringify(a4));
    rec('no page errors (T)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await B.close();
  }

  // ---------- Q. D1 quick edit on van-grid cards (booked / loaded) and to a weekend date ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', viewport: { width: 1366, height: 900 }, row: { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-BK', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09' }), O('WO-LD', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z' }), O('WO-WE')] } });
    const Q = await t.page.evaluate(async () => {
      const wt = ms => new Promise(r => setTimeout(r, ms)), out = {}, g = x => DB.orders.find(o => o.wo === x);
      showTab('d'); await wt(120);
      const qe = async (wo, v) => { const i = document.querySelector('.dq-in[data-dq="' + wo + '"][data-f="due"]'); if (!i) return 'no input'; i.value = v; i.dispatchEvent(new Event('change')); await wt(60);
        const sub = (document.querySelector('.pod-ovl .pod-in') || {}).textContent || ''; const b = document.querySelector('.pod-ovl [data-why="Production"]'); if (b) b.click(); await wt(100);
        const sum = (document.getElementById('date-sum') || {}).textContent || ''; document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); return { sub: sub.replace(/\s+/g, ' ').slice(0, 220), sum: sum.replace(/\s+/g, ' ').slice(0, 220), toast: (document.getElementById('toast') || {}).textContent || '' }; };
      out.bk = await qe('WO-BK', '2026-11-19'); out.bkS = { due: g('WO-BK').dueDate, day: g('WO-BK').delDay, rb: !!g('WO-BK').delRebook };
      out.ld = await qe('WO-LD', '2026-11-19'); out.ldS = { due: g('WO-LD').dueDate, day: g('WO-LD').delDay, mv: !!(g('WO-LD').dueMv && g('WO-LD').dueMv.loaded) };
      out.we = await qe('WO-WE', '2026-11-21'); out.weS = g('WO-WE').dueDate;
      return out;
    });
    rec('Q1: quick edit on a booked van card: reason step says it comes off the van; after — off the van, "rebook"', /Comes off/.test(Q.bk.sub) && Q.bkS.due === '2026-11-19' && Q.bkS.day === '' && Q.bkS.rb, JSON.stringify([Q.bk, Q.bkS]));
    rec('Q2: quick edit on a loaded card: stays on the van, flagged "date moved after loading"', /Stays on its van/.test(Q.ld.sub) && Q.ldS.day === 'Wed' && Q.ldS.mv, JSON.stringify([Q.ld, Q.ldS]));
    rec('Q3: quick edit to a Saturday: warned "not a working day" before the reason, and shown again after', /Saturday/.test(Q.we.sub) && /not a working day|Saturday/.test(Q.we.sum), JSON.stringify(Q.we));
    rec('no page errors (Q)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---------- L. L12: the Work order drop-down in the list window, sorted by due date, due shown ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-100', { dueDate: '2026-12-01' }), O('WO-200', { dueDate: '2026-11-14' }), O('WO-300', { dueDate: '' }), O('WO-050', { dueDate: '2026-11-20', floor: '7', unit: '231' })] } });
    const L = await t.page.evaluate(async () => {
      const out = {};
      try { showTab('l'); await new Promise(r => setTimeout(r, 120)); (typeof openListEditor2 === 'function' && V2() ? openListEditor2 : openListEditor)(null); await new Promise(r => setTimeout(r, 200)); } catch (e) { out.err = String(e); }
      const s = document.getElementById('me-wo');
      out.opts = s ? [...s.options].slice(1).map(o => o.textContent.replace(/\s+/g, ' ').trim()) : null;
      return out;
    });
    // (merge of Job A into Job B, 10 Nov night) L12 is part of the NEW list window (lists switch ON + a project picked) and is
    // tested there: tests/seq/l5-l12-window.test.js (sorted by due, "· due 22 Oct", "has a list"). This row has no lists
    // switch, so it gets the OLD window — which must stay exactly as it was (WO order, no due text).
    const order = (L.opts || []).map(x => (x.match(/WO-\d+/) || [''])[0]);
    rec('L12 (switch OFF): the old list window\'s WO drop-down is unchanged — WO order, no due text (L12 lives in the new window, tests/seq/l5-l12-window)', order.join() === 'WO-050,WO-100,WO-200,WO-300', JSON.stringify(L));
    rec('L12 (switch OFF): old window lines carry no "· due" text', (L.opts || []).length === 4 && L.opts.every(x => !/· due /.test(x)), JSON.stringify(L.opts));
    await t.close();
  }

  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
function wkOfIso(iso) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
