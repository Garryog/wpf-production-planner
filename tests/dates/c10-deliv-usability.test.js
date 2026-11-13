// Deliveries usability D1–D4 + DD1 (plan addendum, 10 Nov 2026 evening): acceptance checks 1–12.
// Quick due-date edit on the cards, week moves (→ Wk N / Move to week… / Move ticked / drag onto a tab), the week bar,
// the one due-date tag (dueTag) on cards / board / In store, cards that never overlap, group totals. Stubbed Supabase only.
// Run: node tests/dates/c10-deliv-usability.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ') : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));

  // ---------- E. the week-move engine (wkMoveTo / moveDates {toWk}) — checks 2, 3, 4 ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-E1'), O('WO-E2', { dueDate: '2026-11-04', origDueDate: '2026-11-04' }), O('WO-E3', { delivDate: '2026-11-16' }), O('WO-E4', { dueDate: '', origDueDate: '' }),
      O('WO-E5', { dueDate: '2026-11-12', step: '6. CUT' }), O('WO-E6', { dueDate: '2026-11-13' }),
    ] } });
    const E = await t.page.evaluate(async () => {
      const f = (due, deliv, W) => wkMoveTo({ dueDate: due, delivDate: deliv }, W);
      const out = {};
      out.a = f('2026-11-12', '', '2026-11-16'); out.ov = f('2026-11-04', '', '2026-11-16'); out.dv = f('2026-11-12', '2026-11-16', '2026-11-23');
      out.x1 = f('2026-12-18', '', '2026-12-21'); out.x2 = f('2026-12-21', '', '2026-12-28'); out.x3 = f('2026-12-31', '', '2027-01-04');
      out.nod = f('', '', '2026-11-16'); out.thisWkPast = f('2026-11-09', '', '2026-11-09'); out.past = f('2026-11-04', '', '2026-11-02');
      out.wed = f('2026-11-20', '', '2026-11-09');
      const g = w => DB.orders.find(o => o.wo === w);
      moveDates(['WO-E3'], { toWk: '2026-11-23' }, { why: 'Site not ready' }, 'Tester', {}).apply(); // its anchor (delivery 16 Nov) is in Wk 47
      const r = moveDates(['WO-E1', 'WO-E2', 'WO-E4', 'WO-E5'], { toWk: '2026-11-16' }, { why: 'Customer delay' }, 'Tester', { src: 'group' }).apply();
      out.res = { moved: r.moved, kept: r.weeksKept, sk: r.skipped };
      out.o = ['WO-E1', 'WO-E2', 'WO-E3', 'WO-E4', 'WO-E5'].map(w => ({ wo: w, due: g(w).dueDate, dv: g(w).delivDate || '', wk: g(w).plannedWeek, h: (g(w).dueHist || []).length, keep: g(w).dueKeep || '', mv: !!g(w).dueMv }));
      const r2 = moveDates(['WO-E6'], { toWk: '2026-11-09' }, { why: 'Production' }, 'Tester', {}).rows[0];
      out.same = r2.skipped;
      return out;
    });
    rec('2: → Next week keeps the weekday: Thu 12 Nov → Thu 19 Nov', E.a.due === '2026-11-19' && !E.a.err, JSON.stringify(E.a));
    rec('2: overdue Wed 4 Nov on This week → Next week (Wk 47) = Wed 18 Nov (whole weeks from its own week)', E.ov.due === '2026-11-18', JSON.stringify(E.ov));
    rec('2: with a delivery date both move by the same weeks (gap kept): due 12→19 Nov, delivery 16→23 Nov', E.dv.due === '2026-11-19' && E.dv.deliv === '2026-11-23', JSON.stringify(E.dv));
    rec('3: Fri 18 Dec +1 → Thu 24 Dec (Christmas Fri → the working day before)', E.x1.due === '2026-12-24', JSON.stringify(E.x1));
    rec('3: Mon 21 Dec +1 → Tue 29 Dec, Wk 53 (Mon 28 Dec bank holiday → the day after)', E.x2.due === '2026-12-29', JSON.stringify(E.x2));
    rec('3: Thu 31 Dec +1 → Thu 7 Jan 2027', E.x3.due === '2027-01-07', JSON.stringify(E.x3));
    rec('4: no due date (Cienapps job) → last working day of the week (Fri 20 Nov)', E.nod.due === '2026-11-20', JSON.stringify(E.nod));
    rec('earlier than today in this week → today (Tue 10 Nov)', E.thisWkPast.due === '2026-11-10', JSON.stringify(E.thisWkPast));
    rec('a week already gone → "No working days left in Wk 45 — pick Next week" (nothing moves)', /No working days left in Wk 45 — pick Next week/.test(E.past.err), JSON.stringify(E.past));
    rec('moving back to this week keeps the weekday (Fri 20 → Fri 13 Nov)', E.wed.due === '2026-11-13', JSON.stringify(E.wed));
    const o = k => E.o.find(x => x.wo === k);
    rec('moveDates {toWk}: due moved, history + Cienapps "keep" date written, build week follows', o('WO-E1').due === '2026-11-19' && o('WO-E1').h === 1 && o('WO-E1').keep === '2026-11-12' && o('WO-E1').wk === '2026-11-16', JSON.stringify(o('WO-E1')));
    rec('moveDates {toWk}: delivery-date job to Wk 48 — anchored on delivery (16 → 23 Nov), due 12 → 19 Nov', o('WO-E3').due === '2026-11-19' && o('WO-E3').dv === '2026-11-23' && o('WO-E3').h === 2, JSON.stringify(o('WO-E3')));
    rec('moveDates {toWk}: no-date job gets Fri 20 Nov', o('WO-E4').due === '2026-11-20', JSON.stringify(o('WO-E4')));
    rec('5: cut job — due moved, build week kept, "due moved — check week"', o('WO-E5').due === '2026-11-19' && o('WO-E5').wk === '2026-11-09' && o('WO-E5').mv && E.res.kept === 1, JSON.stringify(o('WO-E5')));
    rec('same week again = skipped ("already due …")', /already due/.test(E.same || ''), E.same);
    rec('no page errors (E)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  {
    const t = await H.open({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [] } });
    const E = await t.page.evaluate(() => wkMoveTo({ dueDate: '2026-10-19' }, '2026-10-26'));
    rec('3: October bank holiday — Mon 19 Oct +1 → Tue 27 Oct (Mon 26 Oct is a bank holiday)', E.due === '2026-10-27', JSON.stringify(E));
    await t.close();
  }

  // ---------- A. the Deliveries page at 1366 px, clock Tue 10 Nov 2026 — checks 1, 2, 4–11 ----------
  const LONG = { wo: 'WO-261799-1234-EXTRA', floor: 'Ground Floor Block C North', unit: 'Apartment 1004B-EXTENDED-REAR', title: 'Type B kitchen — handleless, Fenix NTM worktop, full-height larder with integrated appliances and a very long description', customer: 'ASPECT ATHENRY DEVELOPMENTS LIMITED (PHASE 2)' };
  const rowA = { id: 'main', nid: 9, settings: { delx: [
    { wo: 'JOB-M1', title: 'Spare doors', customer: 'ASPECT', value: 450, manual: true, delVeh: '', delDay: '', delDone: false },
    { wo: 'JOB-M2', title: 'Site <b>office</b> kit', customer: 'ASPECT', value: 50, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
    O('WO-1'), O('WO-2', { dueDate: '2026-11-04', origDueDate: '2026-11-04' }), O('WO-3', { delivDate: '2026-11-16' }), O('WO-4', { dueDate: '', origDueDate: '' }),
    O('WO-5', { step: '6. CUT' }), O('WO-6', { dueDate: '2026-11-11', delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }),
    O('WO-7', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09', delLoadedAt: '2026-11-10T08:00:00Z' }),
    O(LONG.wo, Object.assign({}, LONG, { value: 48200 })),
    O('WO-9', { dueDate: '2026-11-09', origDueDate: '2026-11-09' }), O('WO-10', { dueDate: '2026-11-13', origDueDate: '2026-11-13' }),
    O('WO-11', { dueDate: '2026-11-18', origDueDate: '2026-11-18', plannedWeek: '2026-11-16' }),
    O('WO-12', { dueDate: '2026-11-17', origDueDate: '2026-11-11', plannedWeek: '2026-11-23', delv: false }),
    O('WO-13', { step: '6. CUT', dueDate: '2026-11-13', origDueDate: '2026-11-13' }),
    O('WO-14', { dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16' }), O('WO-15', { dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16' }),
    O('WO-16', { dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16' }), O('WO-17', { dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16' }),
    O('WO-18', { dueDate: '2026-11-25', origDueDate: '2026-11-25', plannedWeek: '2026-11-16', delv: false }),
    O('WO-S', { step: '7. ASSEMBLY COMPLETE', delv: false, dueDate: '2026-11-09', origDueDate: '2026-11-09' }),
  ] };
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: rowA, viewport: { width: 1366, height: 900 } });
    const p = t.page;
    const A = await p.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), out = {}, g = x => DB.orders.find(o => o.wo === x), gx = x => DB.delx.find(o => o.wo === x);
      const go = async t => { document.querySelector('[data-deltab="' + t + '"]').click(); await w(100); };
      const pool = () => [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw);
      const why = async (k) => { const b = document.querySelector('.pod-ovl [data-why="' + (k || 'Customer delay') + '"]'); const s = b ? b.closest('.pod-in').textContent : ''; if (b) b.click(); await w(120); return s; };
      const toastTxt = () => (document.getElementById('toast') || {}).textContent || '';
      const closeAll = () => document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      showTab('d'); await w(150);
      // 9: week bar, labels, current week marked, Prev disabled (no open past week)
      out.bar = document.getElementById('wkb-lbl').textContent; out.prevDis = document.getElementById('wkb-prev').disabled; out.todayDis = document.getElementById('wkb-today').disabled;
      out.tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab + '=' + b.textContent.replace(/\s+/g, ' ').trim() + (b.classList.contains('cur') ? ' [cur]' : '') + (b.classList.contains('on') ? ' [on]' : ''));
      out.close0 = !!document.getElementById('btn-delreset');
      // 11: colours on the cards
      const tagOf = (wo, f) => { const b = document.querySelector('.dchip[data-dw="' + wo + '"] .due-tag' + (f ? '[data-f="' + f + '"]' : '')); return b ? b.className.replace('due-tag', '').trim() + ':' + b.textContent : ''; };
      out.c9 = tagOf('WO-9'); out.c10 = tagOf('WO-10'); out.cM = tagOf('JOB-M1');
      // 10: no € on cards, group footer total, nothing spills out of a card, no two cards overlap
      out.euroCards = [...document.querySelectorAll('.dchip')].filter(c => /€/.test(c.textContent)).map(c => c.dataset.dw);
      out.euroHdr = [...document.querySelectorAll('.dgrp-h')].filter(h => /€/.test(h.textContent)).length;
      out.foot = [...document.querySelectorAll('#dpool .dgrp')].map(gp => { const wos = [...gp.querySelectorAll('.dchip')].map(c => c.dataset.dw); const sum = wos.reduce((a, x) => a + (+(findDel(x) || {}).value || 0), 0); const f = (gp.querySelector('.dgrp-f') || {}).textContent || ''; return { f, ok: f === wos.length + ' job' + (wos.length !== 1 ? 's' : '') + ' · €' + Math.round(sum).toLocaleString() }; });
      out.spill = window.__spill = () => { const bad = []; document.querySelectorAll('.dchip').forEach(c => { const r = c.getBoundingClientRect(); if (c.offsetParent === null) return; c.querySelectorAll('*').forEach(e => { if (e.classList.contains('dq-in') || e.offsetParent === null) return; const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) bad.push(c.dataset.dw + ':' + (e.className || e.tagName)); }); });
        const cs = [...document.querySelectorAll('#dpool .dchip')].map(c => [c.dataset.dw, c.getBoundingClientRect()]); for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i][1], b = cs[j][1]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push('overlap ' + cs[i][0] + '/' + cs[j][0]); } return bad; };
      out.spill0 = window.__spill();
      out.longCard = (document.querySelector('.dchip[data-dw="WO-261799-1234-EXTRA"]') || {}).textContent || '';
      // 1: quick edit on WO-1 — cancel first, then Fri 20 Nov + reason
      const qi = (wo, f) => document.querySelector('.dq-in[data-dq="' + wo + '"][data-f="' + (f || 'due') + '"]');
      out.btn1 = !!document.querySelector('.dchip[data-dw="WO-1"] button.due-tag[data-dqb="WO-1"]');
      let i = qi('WO-1'); i.value = '2026-11-20'; i.dispatchEvent(new Event('change')); await w(80);
      out.cancelAsk = !!document.querySelector('.pod-ovl [data-why]'); document.querySelector('.pod-ovl #pod-x').click(); await w(80);
      out.afterCancel = { due: g('WO-1').dueDate, h: (g('WO-1').dueHist || []).length, inp: qi('WO-1').value };
      i = qi('WO-1'); i.value = '2026-11-20'; i.dispatchEvent(new Event('change')); await w(80);
      out.sub1 = await why('Customer delay');
      out.toast1 = toastTxt();
      out.m1 = { due: g('WO-1').dueDate, h: g('WO-1').dueHist, keep: g('WO-1').dueKeep, wk: g('WO-1').plannedWeek, pool: delPoolWk(g('WO-1')) };
      out.pool0a = pool();
      await go('1'); out.pool1a = pool(); out.mv1 = (document.querySelector('.dchip[data-dw="WO-1"] [data-duehist]') || {}).textContent || '';
      // 2: → Next week on the overdue job (shown on This week)
      await go('0');
      const nb = document.querySelector('[data-wknext="WO-2"]'); out.nb2 = nb ? nb.textContent : ''; nb.click(); await w(80);
      out.prev2 = !!document.getElementById('wkprev-dlg'); out.sub2 = await why('Production'); out.m2 = g('WO-2').dueDate;
      // 2: delivery-date job on Next week → Wk 48: both move
      await go('1'); out.nb3 = (document.querySelector('[data-wknext="WO-3"]') || {}).textContent; document.querySelector('[data-wknext="WO-3"]').click(); await w(80); await why('Site not ready');
      out.m3 = { due: g('WO-3').dueDate, dv: g('WO-3').delivDate };
      // 4: no-date Cienapps job → Move to week… → Wk 48 = Fri 27 Nov; manual job → Wk 49 (planWk), reason logged
      await go('0');
      document.querySelector('[data-wkpick="WO-4"]').click(); await w(80);
      out.pick = [...document.querySelectorAll('#wkpick-dlg [data-wkp]')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      document.querySelector('#wkpick-dlg [data-wkp="2026-11-23"]').click(); await w(80); await why('Materials');
      out.m4 = g('WO-4').dueDate;
      document.querySelector('[data-wkpick="JOB-M1"]').click(); await w(80); document.querySelector('#wkpick-dlg [data-wkp="2026-11-30"]').click(); await w(80);
      out.manAsk = await why('Customer delay');
      out.mM = { pw: gx('JOB-M1').planWk, log: (gx('JOB-M1').log || []).slice(-1)[0], due: gx('JOB-M1').dueDate };
      await go('3'); out.pool3 = pool(); out.tagM = tagOf('JOB-M1');
      // 5: cut job → preview first (week kept), then reason
      await go('0'); document.querySelector('[data-wknext="WO-5"]').click(); await w(80);
      out.prev5 = (document.getElementById('wkprev-dlg') || {}).textContent || ''; const c5 = document.getElementById('wkp-go'); if (c5) c5.click(); await w(80); await why('Production');
      out.m5 = { due: g('WO-5').dueDate, wk: g('WO-5').plannedWeek, mv: g('WO-5').dueMv };
      closeAll();
      // 6 + 7: tick 5 (cut WO-13, manual JOB-M2, booked WO-6, loaded WO-7, plain WO-9) → Move ticked to week… → Wk 48
      delSel.clear(); ['WO-13', 'JOB-M2', 'WO-6', 'WO-7', 'WO-9'].forEach(x => delSel.add(x)); render(); await w(80);
      out.selbar = (document.querySelector('.selbar') || {}).textContent || '';
      document.getElementById('selwk').click(); await w(80);
      document.querySelector('#wkpick-dlg [data-wkp="2026-11-23"]').click(); await w(80);
      out.prev7 = (document.getElementById('wkprev-dlg') || {}).textContent || '';
      document.getElementById('wkp-go').click(); await w(80); out.sub7 = await why('Customer delay');
      out.sum7 = (document.getElementById('date-sum') || {}).textContent || ''; closeAll();
      out.m7 = { w13: [g('WO-13').dueDate, g('WO-13').plannedWeek, !!g('WO-13').dueMv], m2: gx('JOB-M2').planWk, w6: [g('WO-6').dueDate, g('WO-6').delDay, !!g('WO-6').delRebook], w7: [g('WO-7').dueDate, g('WO-7').delDay, !!(g('WO-7').dueMv && g('WO-7').dueMv.loaded)], w9: g('WO-9').dueDate, sel: delSel.size };
      // 8: drag onto a tab (PC) — one card, then three; Later → picker at +4; a van cell = booking only
      const drop = async (wos, sel) => { delDragList = wos; const el = document.querySelector(sel); const ov = new Event('dragover', { cancelable: true }); el.dispatchEvent(ov); const hi = el.classList.contains('dragover'); el.dispatchEvent(new Event('drop', { cancelable: true })); await w(80); return hi; };
      await go('0');
      out.hi8 = await drop(['WO-10'], '[data-deltab="3"]'); out.prev8 = (document.getElementById('wkprev-dlg') || {}).textContent || ''; if (document.getElementById('wkp-go')) document.getElementById('wkp-go').click(); await w(60); out.ask8 = await why('Customer delay'); out.m8a = g('WO-10').dueDate;
      out.m8b0 = ['WO-14', 'WO-15', 'WO-16'].map(x => g(x).dueDate);
      await drop(['WO-14', 'WO-15', 'WO-16'], '[data-deltab="2"]'); await why('Site not ready'); out.sum8 = !!document.getElementById('date-sum'); closeAll();
      out.m8b = ['WO-14', 'WO-15', 'WO-16'].map(x => g(x).dueDate);
      await drop(['WO-17'], '[data-deltab="later"]'); out.pre8 = ((document.querySelector('#wkpick-dlg .rbtn.pre') || {}).dataset || {}).wkp; closeAll();
      const d17 = g('WO-17').dueDate;
      await go('1'); await drop(['WO-17'], '.dcell[data-cell="IVECO|Tue|2026-11-16"]'); closeAll();
      out.m8c = { due: g('WO-17').dueDate, was: d17, day: g('WO-17').delDay, wk: g('WO-17').delWk, h: (g('WO-17').dueHist || []).length };
      // 9: Next walks to +5 (a temporary tab), This week returns
      await go('0');
      for (let k = 0; k < 5; k++) { document.getElementById('wkb-next').click(); await w(60); }
      out.walk = { tab: delTab, lbl: document.getElementById('wkb-lbl').textContent, tmp: !!document.querySelector('[data-deltab="5"]') };
      document.getElementById('wkb-today').click(); await w(60); out.back = delTab;
      // 9: sticky — scroll down, the week bar stays under the main tabs
      window.scrollTo(0, 900); await w(100);
      const tb = document.querySelector('.tabs').getBoundingClientRect(), wb = document.getElementById('del-wkbar').getBoundingClientRect();
      out.sticky = { tabsBottom: Math.round(tb.bottom), barTop: Math.round(wb.top), h: Math.round(wb.height), btnH: Math.round(document.getElementById('wkb-next').getBoundingClientRect().height) };
      window.scrollTo(0, 0);
      // 11: In store uses the same tag; board row: red when planned week ends after the due date
      document.getElementById('btn-instore').click(); await w(80);
      out.store = (document.querySelector('#del-store .due-tag') || {}).className + ':' + (document.querySelector('#del-store .due-tag') || {}).textContent;
      showTab('b'); await w(150);
      const bt = wo => { const b = document.querySelector('tr[data-wo="' + wo + '"] .due-tag'); return b ? b.className.replace('due-tag', '').trim() + ':' + b.textContent : ''; };
      out.b12 = bt('WO-12'); out.b12late = ((document.querySelector('tr[data-wo="WO-12"]') || {}).textContent || '').includes('built after due'); out.b18late = ((document.querySelector('tr[data-wo="WO-18"]') || {}).textContent || '').includes('built after due'); out.b12orig = (document.querySelector('tr[data-wo="WO-12"] .due-orig') || {}).textContent || '';
      out.b11 = bt('WO-11'); out.b18 = bt('WO-18'); out.bMore = !!document.querySelector('tr[data-wo="WO-11"] [data-duedlg="WO-11"]');
      // 1: the board quick edit works too
      const bi = document.querySelector('tr[data-wo="WO-11"] .dq-in[data-f="due"]'); bi.value = '2026-11-26'; bi.dispatchEvent(new Event('change')); await w(80); await why('Materials');
      out.b11m = g('WO-11').dueDate;
      // 1: Dates to change in Cienapps has WO-1, never the manual job
      showTab('x'); await w(150); out.cien = (document.getElementById('exp-dates') || {}).textContent || '';
      // 12: roles — saw / stores / driver / floor see the tag but cannot open the picker
      out.roles = ['saw', 'stores', 'driver', 'floor', 'pm', 'office', 'prod'].map(r => { const was = ROLE; ROLE = r; const h = dueTag(g('WO-11')); const b = wkBtnsOk(g('WO-14')); ROLE = was; return r + ':' + (/data-dqb/.test(h) ? 'edit' : 'view') + (/due-tag/.test(h) ? '+tag' : '') + (b ? '+wk' : ''); });
      await w(1700);
      return out;
    });
    rec('9: week bar "Wk 46 · Mon 9 Nov – Sat 14 Nov ● this week"; Prev off (no open past week); This week off', /Wk 46 · Mon 9 Nov – Sat 14 Nov/.test(A.bar) && /this week/.test(A.bar) && A.prevDis && A.todayDis, A.bar);
    rec('9: tab labels "This week · Wk 46 · 9 Nov (n)", "Next week · Wk 47 · 16 Nov (n)"; current week marked, selected = on', /^0=● ?This week · Wk 46 · 9 Nov ?\(\d+\) \[cur\] \[on\]$/.test(A.tabs[0].replace('●', '● ').replace('●  ', '● ')) || /^0=This week · Wk 46 · 9 Nov ?\(\d+\) \[cur\] \[on\]$/.test(A.tabs[0]), A.tabs.join(' | '));
    rec('9: Close Wk 46 shown (this week has bookings)', A.close0, '');
    rec('11: card colours — yesterday red, Fri this week amber; manual "manual — no date"', /^red:Due Mon 9 Nov · Wk 46$/.test(A.c9) && /^amber:Due Fri 13 Nov · Wk 46$/.test(A.c10) && /manual — no date/.test(A.cM), [A.c9, A.c10, A.cM].join(' | '));
    rec('10: no € on any card or group header', !A.euroCards.length && !A.euroHdr, JSON.stringify(A.euroCards));
    rec('10: every group has a footer "N jobs · €total" that adds up', A.foot.length >= 2 && A.foot.every(f => f.ok), JSON.stringify(A.foot));
    rec('10: 1366 px — nothing spills out of a card, no cards overlap (longest WO + Floor + Unit + title)', !A.spill0.length && /Floor Ground Floor Block C North/.test(A.longCard) && /Unit Apartment 1004B/.test(A.longCard), A.spill0.join(', '));
    rec('1: due tag is a button for the office', A.btn1, '');
    rec('1: cancel = no change (date, history, input back)', A.cancelAsk && A.afterCancel.due === '2026-11-12' && A.afterCancel.h === 0 && A.afterCancel.inp === '2026-11-12', JSON.stringify(A.afterCancel));
    rec('1: reason step shows what will happen (Thu 12 Nov → Fri 20 Nov, build week Wk 46 → Wk 47)', /Due Thu 12 Nov · Wk 46 → Fri 20 Nov · Wk 47/.test(A.sub1) && /build week Wk 46 → Wk 47/.test(A.sub1), A.sub1.slice(0, 200));
    rec('1: moved — history (why + who), Cienapps keep date, build week Wk 47', A.m1.due === '2026-11-20' && A.m1.h.length === 1 && A.m1.h[0].why === 'Customer delay' && A.m1.h[0].by === 'Tester' && A.m1.keep === '2026-11-12' && A.m1.wk === '2026-11-16', JSON.stringify(A.m1).slice(0, 250));
    rec('1: toast "Due now Fri 20 Nov · Wk 47 — card is on the Wk 47 tab"; card left This week, is on Wk 47 with "🔁 moved 1×"', /Due now Fri 20 Nov · Wk 47 — card is on the Wk 47 tab/.test(A.toast1) && !A.pool0a.includes('WO-1') && A.pool1a.includes('WO-1') && /moved 1×/.test(A.mv1), A.toast1);
    rec('2: overdue Wed 4 Nov on This week: "→ Wk 47" → Wed 18 Nov, straight to the reason (no preview)', A.nb2 === '→ Wk 47' && !A.prev2 && A.m2 === '2026-11-18', JSON.stringify([A.nb2, A.prev2, A.m2]));
    rec('2: with a delivery date both move, gap kept (due 12→19 Nov, delivery 16→23 Nov)', A.nb3 === '→ Wk 48' && A.m3.due === '2026-11-19' && A.m3.dv === '2026-11-23', JSON.stringify([A.nb3, A.m3]));
    rec('4: week picker lists This week … +12 with Monday date and job count', A.pick.length === 13 && /^This week · Wk 46 · Mon 9 Nov/.test(A.pick[0]) && /\d+ jobs?$/.test(A.pick[0]) && /Wk 51 · Mon 14 Dec/.test(A.pick[5]), A.pick.slice(0, 3).join(' | '));
    rec('4: no-date Cienapps job → Wk 48 = Fri 27 Nov', A.m4 === '2026-11-27', A.m4);
    rec('4: manual job → Wk 49: planWk set, reason logged, no due date; in the Wk 49 pool as "planned Wk 49"', A.mM.pw === '2026-11-30' && A.mM.log && A.mM.log.why === 'Customer delay' && /Planned for Wk 49/.test(A.mM.log.what) && !A.mM.due && A.pool3.includes('JOB-M1') && /planned Wk 49/.test(A.tagM), JSON.stringify(A.mM) + ' ' + A.tagM);
    rec('5: cut job — preview first ("build week stays … already cut"), due moved, build week kept, "due moved — check week"', /already cut/.test(A.prev5) && A.m5.due === '2026-11-19' && A.m5.wk === '2026-11-09' && A.m5.mv, A.prev5.slice(0, 160));
    rec('7: selection bar "📅 Move ticked to week… (5)"', /Move ticked to week… \(5\)/.test(A.selbar), A.selbar);
    rec('6: preview says the booked job comes off its van → rebook, the loaded one stays', /WO-6[^]*Comes off Volvo Wed 11 Nov → To Plan/.test(A.prev7) && /WO-7[^]*Stays on its van/.test(A.prev7) && /JOB-M2[^]*planned for/.test(A.prev7), A.prev7.slice(0, 400));
    rec('7: one reason for all five; summary dialog', /5 jobs → Wk 48/.test(A.sub7) && /5 moved/.test(A.sum7) && /1 taken off vans/.test(A.sum7), A.sub7.slice(0, 120) + ' / ' + A.sum7.slice(0, 160));
    rec('6/7: booked → off the van, rebook; loaded stays + flagged; cut keeps week; manual planWk; plain moved; selection cleared',
      A.m7.w6[0] === '2026-11-25' && A.m7.w6[1] === '' && A.m7.w6[2] && A.m7.w7[0] === '2026-11-26' && A.m7.w7[1] === 'Thu' && A.m7.w7[2] && A.m7.w13[0] === '2026-11-27' && A.m7.w13[1] === '2026-11-09' && A.m7.w13[2] && A.m7.m2 === '2026-11-23' && A.m7.w9 === '2026-11-23' && A.m7.sel === 0, JSON.stringify(A.m7));
    rec('8: drag one card onto the Wk 49 tab — tab lights up, preview (moved out 21 days — don\'t cut early), asks why, Fri 13 → Fri 4 Dec', A.hi8 && /moved out 21 days/.test(A.prev8) && /Move WO-10 to Wk 49/.test(A.ask8) && A.m8a === '2026-12-04', JSON.stringify([A.hi8, A.m8a, A.prev8.slice(0, 120)]));
    rec('8: drag three onto Wk 48 — one reason, all moved', A.m8b.every(d => d === '2026-11-26') && A.sum8, JSON.stringify(A.m8b));
    rec('8: drop on Later → week picker with Wk +4 (7 Dec) chosen', A.pre8 === '2026-12-07', A.pre8);
    rec('8: drop on a van cell = booking only (due date unchanged)', A.m8c.due === A.m8c.was && A.m8c.day === 'Tue' && A.m8c.wk === '2026-11-16' && A.m8c.h === 0, JSON.stringify(A.m8c));
    rec('9: Next ▶ ×5 → Wk 51 (temporary tab); This week returns to 0', A.walk.tab === '5' && /Wk 51 · Mon 14 Dec/.test(A.walk.lbl) && A.walk.tmp && A.back === '0', JSON.stringify(A.walk));
    rec('9: week bar sticks under the main tabs when scrolled; buttons ≥ 44 px', Math.abs(A.sticky.barTop - A.sticky.tabsBottom) <= 2 && A.sticky.btnH >= 44, JSON.stringify(A.sticky));
    rec('11: In store row has the same tag (yesterday = red)', /^due-tag red:Due Mon 9 Nov · Wk 46$/.test(A.store) || /red:Due Mon 9 Nov/.test(A.store), A.store);
    rec('11: board row — same tag, same colour as the cards (Tue 17 Nov next week = grey) + "⚠ built after due" chip when the planned week (Wk 48) ends after the due date; "(orig …)" kept', /^grey:Due Tue 17 Nov · Wk 47$/.test(A.b12) && A.b12late && /orig 11 Nov Wk 46/.test(A.b12orig), A.b12 + ' ' + A.b12orig + ' late chip ' + A.b12late);
    rec('11: board row — due Wed 18 Nov (next week) = grey like the card; due Wk 48 planned Wk 47 = grey, no "built after due"; ⋯ opens the full dialog', /^grey:Due Wed 18 Nov · Wk 47$/.test(A.b11) && /^grey:Due Wed 25 Nov · Wk 48$/.test(A.b18) && !A.b18late && A.bMore, A.b11 + ' | ' + A.b18);
    rec('1: quick edit from the board row', A.b11m === '2026-11-26', A.b11m);
    rec('1/4: Dates to change in Cienapps lists the moved job, never the manual one', /WO-1\b/.test(A.cien) && !/JOB-M/.test(A.cien), A.cien.slice(0, 160));
    rec('12: saw / stores / driver / floor / PM see the tag but cannot edit or move weeks; office + Production Manager can', A.roles.join() === 'saw:view+tag,stores:view+tag,driver:view+tag,floor:view+tag,pm:view+tag,office:edit+tag+wk,prod:edit+tag+wk', A.roles.join());
    const saved = t.server.row;
    rec('saved: planWk inside settings.delx, dates inside orders, no new top-level key', ((saved.settings || {}).delx || []).some(x => x.wo === 'JOB-M1' && x.planWk === '2026-11-30') && (saved.orders || []).some(o => o.wo === 'WO-1' && o.dueDate === '2026-11-20') && t.server.patches.every(b => Object.keys(b).every(k => ['orders', 'settings', 'nid'].includes(k))), [...new Set(t.server.patches.flatMap(b => Object.keys(b)))].join());
    rec('no page errors (A)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---------- B. 360 px phone — check 10 ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: rowA, viewport: { width: 360, height: 740 } });
    const B = await t.page.evaluate(async () => {
      showTab('d'); await new Promise(r => setTimeout(r, 150));
      const out = { spill: [] };
      document.querySelectorAll('.dchip').forEach(c => { const r = c.getBoundingClientRect(); if (c.closest('#dpool') && r.right > 361) out.spill.push(c.dataset.dw + ' card ' + Math.round(r.right)); c.querySelectorAll('*').forEach(e => { if (e.classList.contains('dq-in') || e.offsetParent === null) return; const q = e.getBoundingClientRect(); if (q.width && q.right > r.right + 1) out.spill.push(c.dataset.dw + ':' + (e.className || e.tagName)); }); });
      out.docW = document.documentElement.scrollWidth;
      const bar = document.getElementById('del-wkbar').getBoundingClientRect(); out.bar = { r: Math.round(bar.right), h: Math.round(bar.height) };
      out.btns = [...document.querySelectorAll('#del-wkbar .wkb-btn')].map(b => Math.round(b.getBoundingClientRect().height));
      out.wkBtnH = Math.round(document.querySelector('.dwk-btn').getBoundingClientRect().height);
      out.euro = [...document.querySelectorAll('.dchip')].some(c => /€/.test(c.textContent));
      return out;
    });
    rec('10: 360 px — nothing spills out of any card (pool or van grid), pool cards fit the screen, no € on cards', !B.spill.length && !B.euro, B.spill.join(', '));
    rec('9/10: 360 px — week bar fits on screen, every button ≥ 44 px; week buttons ≥ 36 px', B.bar.r <= 360 && B.btns.every(h => h >= 44) && B.wkBtnH >= 36, JSON.stringify(B));
    rec('no page errors (B)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---------- C. year end — check 3 (Prev/Next walk Wk 52 → 53 → 1) and 9 (Close hidden on a past week with nothing to close) ----------
  {
    const t = await H.open({ browser, now: '2026-12-21T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-Y1', { dueDate: '2026-12-22', origDueDate: '2026-12-22', plannedWeek: '2026-12-21' }),
      O('WO-Y2', { dueDate: '2026-12-16', delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-12-14', delLoadedAt: '2026-12-16T07:00:00Z', delDispAt: '2026-12-16T08:00:00Z' }),
    ] } });
    const C = await t.page.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      showTab('d'); await w(150);
      out.l0 = document.getElementById('wkb-lbl').textContent; out.prevOn = !document.getElementById('wkb-prev').disabled;
      document.getElementById('wkb-next').click(); await w(60); out.l1 = document.getElementById('wkb-lbl').textContent;
      document.getElementById('wkb-next').click(); await w(60); out.l2 = document.getElementById('wkb-lbl').textContent;
      document.getElementById('wkb-today').click(); await w(60);
      document.getElementById('wkb-prev').click(); await w(60); out.lp = document.getElementById('wkb-lbl').textContent; out.tp = delTab;
      out.closeP = !!document.getElementById('btn-delreset');
      out.prevP = document.getElementById('wkb-prev').disabled;
      // → Wk 53 on a Tue 22 Dec job lands on Tue 29 Dec
      document.getElementById('wkb-today').click(); await w(60);
      out.nb = (document.querySelector('[data-wknext="WO-Y1"]') || {}).textContent;
      return out;
    });
    rec('3: Prev / Next walk Wk 52 → Wk 53 → Wk 1 (4 Jan 2027)', /Wk 52 · Mon 21 Dec/.test(C.l0) && /Wk 53 · Mon 28 Dec/.test(C.l1) && /Wk 1 · Mon 4 Jan/.test(C.l2), [C.l0, C.l1, C.l2].join(' | '));
    rec('9: Prev reaches the open past week Wk 51 (dispatched job still on its van) — Close hidden (nothing to close), Prev stops there', C.prevOn && C.tp === '-1' && /Wk 51/.test(C.lp) && !C.closeP && C.prevP, JSON.stringify(C));
    rec('3: card button on Wk 52 says "→ Wk 53"', C.nb === '→ Wk 53', C.nb);
    rec('no page errors (C)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---------- D. old saved data: manual jobs without planWk, a bad planWk, orders with odd dates — page renders ----------
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 9, settings: { delx: [{ wo: 'J1', title: 'old', manual: true }, { wo: 'J2', title: 'bad', manual: true, planWk: 'not-a-date' }, { wo: 'J3', title: 'past', manual: true, planWk: '2026-10-05' }] }, orders: [
      O('WO-D1', { dueDate: 'garbage' }), O('WO-D2', { dueDate: null, delivDate: 'x' }), O('WO-D3', { dueDate: '2026-11-12', dueHist: null }),
    ] } });
    const D = await t.page.evaluate(async () => {
      showTab('d'); await new Promise(r => setTimeout(r, 150));
      return { pool: [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw).sort(), j3: (document.querySelector('.dchip[data-dw="J3"] .due-tag') || {}).textContent, d1: (document.querySelector('.dchip[data-dw="WO-D1"] .due-tag') || {}).textContent };
    });
    rec('old data loads: manual jobs without / with a bad / with a past planWk sit in This week; a bad due date shows "no due date"', ['J1', 'J2', 'J3', 'WO-D1', 'WO-D2', 'WO-D3'].every(x => D.pool.includes(x)) && D.j3 === 'manual — no date' && D.d1 === 'no due date', JSON.stringify(D));
    rec('no page errors (D)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  await browser.close();
  console.log('\n' + res.filter(x => x).length + ' passed, ' + res.filter(x => !x).length + ' failed');
})().catch(e => { console.error(e); process.exit(1); });
