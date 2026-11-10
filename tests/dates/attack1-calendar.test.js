// Tester attack 1 — calendar edges: year end (clock Mon 21 Dec and Mon 28 Dec 2026, ISO Wk 53 → Wk 1), Irish bank holidays
// (25/26/28 Dec 2026, 17 Mar 2027, Easter Monday 29 Mar 2027) in the date dialog and the van grid, summer-time change
// (Monday 00:30 local after the last Sunday of March / in summer, last Sunday of October), Saturday / Sunday floor and
// driver screens, In store days across the clock change + the history fallback. Stubbed Supabase only.
// Run: node tests/dates/attack1-calendar.test.js
const { H, recorder, w } = require('./attack1-lib');
const { rec, done } = recorder('attack1-calendar');
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-12-23', origDueDate: '2026-12-23', plannedWeek: '2026-12-21', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo }, x));

  // ---- Mon 28 Dec 2026 (Wk 53, a bank holiday) ----
  {
    const t = await H.open({ browser, now: '2026-12-28T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [O('WO-1', { dueDate: '2027-01-01', plannedWeek: '2026-12-28' }), O('WO-2', { dueDate: '2027-01-05', plannedWeek: '2027-01-04', step: '8. PALLETED', delv: true }), O('WO-3', { dueDate: '2026-12-24', plannedWeek: '2026-12-21', step: '8. PALLETED', delv: true })] } });
    const r = await t.page.evaluate(async () => {
      const out = {};
      out.tw = thisWk(); out.g8 = get8Wks().slice(0, 3); out.nums = [0, 1, 2, 3].map(i => wkNum(wkPlus(thisWk(), i)));
      out.dw = [dueWeekFor('2027-01-01'), dueWeekFor('2027-01-03'), dueWeekFor('2027-01-04'), dueWeekFor('2026-12-24')];
      showTab('d'); await new Promise(r => setTimeout(r, 150));
      out.tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      out.pool = [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw);
      out.hol = [...document.querySelectorAll('.del-grid thead th')].map(th => th.className + ':' + th.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
      showTab('b'); await new Promise(r => setTimeout(r, 150));
      out.boardHas53 = /Wk\s*53/.test(document.getElementById('app').innerText);
      return out;
    });
    rec('28 Dec: this week = Mon 28 Dec (Wk 53); tabs Wk 53 · 1 · 2 · 3', r.tw === '2026-12-28' && r.g8[0] === '2026-12-28' && r.nums.join() === '53,1,2,3' && /This week · Wk 53/.test(r.tabs.join('|')) && /Next week · Wk 1/.test(r.tabs.join('|')), JSON.stringify(r));
    rec('28 Dec: due Fri 1 Jan 2027 / Sun 3 Jan → build Wk 53; Mon 4 Jan → Wk 1; overdue 24 Dec → this week', r.dw.join() === '2026-12-28,2026-12-28,2027-01-04,2026-12-28', JSON.stringify(r.dw));
    rec('28 Dec: Mon 28 Dec (bank holiday) and Fri 1 Jan (New Year) columns shaded', /hol:Mon 28 Dec/.test(r.hol) && /hol:Fri 1 Jan/.test(r.hol), r.hol);
    rec('28 Dec: overdue WO-3 (due 24 Dec) in This week\'s pool, WO-2 (due 5 Jan) not', r.pool.includes('WO-3') && !r.pool.includes('WO-2'), JSON.stringify(r.pool));
    rec('28 Dec: board shows Wk 53', r.boardHas53, '');
    rec('no page errors (28 Dec)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---- bank holidays in the engine and the dialog (clock 10 Nov 2026) ----
  {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [O('WO-1'), O('WO-2', { dueDate: '2026-12-23' }), O('WO-3', { dueDate: '2027-03-12', plannedWeek: '' }), O('WO-4', { step: '8. PALLETED', delv: true })] } });
    const r = await t.page.evaluate(async () => {
      const out = {};
      const f = d => { const r = moveDates(['WO-1'], { due: d }, { why: 'Production' }, 'T').rows[0]; return d + ':' + (r.flags.includes('bank-hol') ? 'HOL ' + dmFlagTxt('bank-hol', r) : 'ok'); };
      out.d = ['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-28', '2026-12-29', '2027-03-17', '2027-03-29', '2027-03-26', '2027-02-01'].map(f);
      out.wd = [moveDates(['WO-2'], { shift: { n: 2, unit: 'wd' } }, {}, 'T').rows[0].to, moveDates(['WO-2'], { shift: { n: 1, unit: 'wd' } }, {}, 'T').rows[0].to, moveDates(['WO-3'], { shift: { n: 3, unit: 'wd' } }, {}, 'T').rows[0].to, moveDates(['WO-3'], { shift: { n: 12, unit: 'wd' } }, {}, 'T').rows[0].to];
      // dialog: pick 25 Dec → warning + "Use Thu 24 Dec" button
      dateDlgOpen(['WO-1'], 'Tester');
      const dl = document.getElementById('date-dlg'); const inp = dl.querySelector('#dm-date'); inp.value = '2026-12-25'; inp.dispatchEvent(new Event('input'));
      dl.querySelector('[data-dmwhy="Production"]').click();
      out.warn = dl.querySelector('#dm-prev').innerText; const b = dl.querySelector('#dm-prevwd'); out.btn = b ? b.textContent : '';
      if (b) b.click(); out.after = dl.querySelector('#dm-date').value; out.ok = !dl.querySelector('#dm-ok').disabled;
      dl.remove();
      // booking a van on Christmas Day: does anything warn?
      showTab('d'); await new Promise(r => setTimeout(r, 120));
      const tabs = [...document.querySelectorAll('[data-deltab]')].map(x => x.dataset.deltab);
      // 25 Dec 2026 is in Wk 52 = +6 weeks from Wk 46 → not a tab: book through placeJobs with that week
      const seen = []; window.confirm = m => { seen.push(m); return true; }; const al = window.__alerts.length;
      placeJobs([findDel('WO-4')], 'VOLVO', 'Fri', '2026-12-21'); await new Promise(r => setTimeout(r, 120)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      out.xmasBooked = slotDate(findDel('WO-4')); out.xmasWarned = seen.length + window.__alerts.length - al > 0 || /holiday/i.test((document.getElementById('toast') || {}).textContent || '');
      out.tabs = tabs;
      return out;
    });
    rec('bank-holiday flag: 25 Dec, 26 Dec (Sat), 28 Dec, 17 Mar 2027, 29 Mar 2027 (Easter Mon), 1 Feb 2027; 24 Dec / 29 Dec / 26 Mar ok', /12-24:ok/.test(r.d[0]) && /12-25:HOL/.test(r.d[1]) && /12-26:HOL/.test(r.d[2]) && /12-28:HOL/.test(r.d[3]) && /12-29:ok/.test(r.d[4]) && /03-17:HOL/.test(r.d[5]) && /03-29:HOL/.test(r.d[6]) && /03-26:ok/.test(r.d[7]) && /02-01:HOL/.test(r.d[8]), r.d.join(' | '));
    rec('"working day before": 25 Dec → Thu 24 Dec, 26 Dec → 24 Dec ("a Saturday"), 28 Dec → 24 Dec, 29 Mar 2027 → Fri 26 Mar', /24 Dec/.test(r.d[1]) && /Saturday.*24 Dec/.test(r.d[2]) && /24 Dec/.test(r.d[3]) && /26 Mar/.test(r.d[6]), r.d.join(' | '));
    rec('working-day shift over Christmas: 23 Dec +2 → 29 Dec, +1 → 24 Dec; 12 Mar 2027 +3 → 18 Mar (skips 17 Mar)', r.wd[0] === '2026-12-29' && r.wd[1] === '2026-12-24' && r.wd[2] === '2027-03-18', JSON.stringify(r.wd));
    rec('working-day shift over Easter 2027: 12 Mar +12 → Thu 1 Apr (skips 17 Mar and Easter Monday)', r.wd[3] === '2027-04-01', JSON.stringify(r.wd));
    rec('dialog on 25 Dec: warning + "Use Thu 24 Dec" fills 24 Dec, still movable', /bank holiday/.test(r.warn) && /24 Dec/.test(r.btn) && r.after === '2026-12-24' && r.ok, JSON.stringify(r));
    rec('booking a van on Christmas Day (Fri 25 Dec) warns that it is a bank holiday', r.xmasWarned, 'booked ' + r.xmasBooked + ' with no warning (columns are only shaded)');
    rec('no page errors (bank holidays)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // ---- summer time: Monday 00:30 Irish time ----
  for (const [label, nowUtc, wk, sun] of [
    ['Mon 29 Mar 2027 00:30 IST (first Monday after the clocks go forward, Easter Mon)', '2027-03-28T23:30:00Z', '2027-03-29', '2027-03-28'],
    ['Mon 5 Apr 2027 00:30 IST', '2027-04-04T23:30:00Z', '2027-04-05', '2027-04-04'],
    ['Mon 26 Oct 2026 00:30 GMT (day after the clocks go back)', '2026-10-26T00:30:00Z', '2026-10-26', '2026-10-25'],
    ['Sun 25 Oct 2026 01:30 (the repeated hour)', '2026-10-25T00:30:00Z', '2026-10-19', ''],
  ]) {
    const t = await H.open({ browser, now: nowUtc, row: { id: 'main', nid: 9, settings: {}, orders: [O('WO-M', { dueDate: wk, plannedWeek: '', step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Mon', delWk: wk }), O('WO-S', { dueDate: sun || wk, plannedWeek: '', step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Sat', delWk: wkPlusJs(wk, -7) })] } });
    const r = await t.page.evaluate(async () => {
      const out = { today: todayLocal(), tw: thisWk(), g8: get8Wks()[0], fl: floorSlots().map(s => s.date) };
      ls.set('wpfPin_floor', '9000'); ROLE = 'floor'; render(); out.floor = document.getElementById('app').textContent.replace(/\s+/g, ' ').slice(0, 200);
      ls.set('wpfDrvVeh', 'VOLVO'); ls.set('wpfDrvName', 'Dan'); ls.set('wpfDrvDay', '');
      ls.set('wpfPin_driver', '9000'); ROLE = 'driver'; render(); out.drv = document.getElementById('app').textContent.replace(/\s+/g, ' ').split('(next week)').pop().slice(0, 300);
      out.miss = missedJobs().map(o => o.wo);
      return out;
    });
    if (wk === '2026-10-19') rec(label + ': still Wk 43 (Sunday), floor shows Mon 26 Oct first', r.tw === '2026-10-19' && r.fl[0] === '2026-10-26', JSON.stringify(r));
    else rec(label + ': this week, board week and floor "today" agree on Monday ' + wk, r.tw === wk && r.g8 === wk && r.fl[0] === wk && /WO-M/.test(r.floor) && /WO-M/.test(r.drv) && !r.miss.includes('WO-M'), JSON.stringify(r));
    await t.close();
  }

  // ---- Saturday / Sunday floor and driver screens (14 / 15 Nov 2026) ----
  {
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      O('SAT-1', { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Sat', delWk: '2026-11-09' }),
      O('MON-1', { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-11-16' }),
      O('MON-0', { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-11-09', delDelivAt: '2026-11-09T12:00:00Z', delDone: true }),
      O('TUE-1', { step: '8. PALLETED', delv: true, delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-16' })] };
    for (const [label, now, want, not] of [['Sat 14 Nov 2026', '2026-11-14T08:00:00Z', ['SAT-1', 'MON-1'], ['MON-0', 'TUE-1']], ['Sun 15 Nov 2026', '2026-11-15T09:00:00Z', ['MON-1', 'TUE-1'], ['MON-0', 'SAT-1']]]) {
      const t = await H.open({ browser, now, row });
      const r = await t.page.evaluate(async () => {
        ls.set('wpfPin_floor', '9000'); ROLE = 'floor'; render(); const floor = document.getElementById('app').textContent;
        ls.set('wpfDrvVeh', 'VOLVO'); ls.set('wpfDrvName', 'Dan'); ls.set('wpfDrvDay', '');
        ls.set('wpfPin_driver', '9000'); ROLE = 'driver'; render(); const drv = document.getElementById('app').textContent;
        const opts = [...document.querySelectorAll('#drv-day option')].map(o => o.textContent);
        return { floor: floor.replace(/\s+/g, ' ').slice(0, 300), drv: drv.replace(/\s+/g, ' ').split('(next week)').pop().slice(0, 300), opts };
      });
      rec(label + ' floor screen: ' + want.join(' + ') + ' shown, not ' + not.join(' / '), want.every(x => r.floor.includes(x)) && !not.some(x => r.floor.includes(x)), r.floor);
      rec(label + ' driver screen opens on the next delivery day with its jobs', label.startsWith('Sun') ? r.drv.includes('MON-1') && !r.drv.includes('MON-0') : r.drv.includes('SAT-1'), r.drv + ' | ' + r.opts.slice(0, 3).join(','));
      await t.close();
    }
  }

  // ---- In store days across the clock change + history fallback (clock Tue 27 Oct 2026) ----
  {
    const t = await H.open({ browser, now: '2026-10-27T09:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [
      O('IS-1', { step: '8. PALLETED', delv: true, storeAt: '2026-10-24T23:30:00Z' }),                  // 00:30 Sun 25 Oct Irish time → 2 days
      O('IS-2', { step: '8. PALLETED', delv: true, storeAt: '2026-10-11T22:30:00Z' }),                  // 23:30 Sun 11 Oct IST → 16 days (amber)
      O('IS-3', { step: '7. ASSEMBLY COMPLETE', delv: true, log: [{ at: '2026-10-20T09:00:00Z', by: 'x', what: 'Step 6. Cut → 7. ASSEMBLY COMPLETE' }] }), // history fallback → 7
      O('IS-4', { step: '8. PALLETED', delv: true }),                                                   // unknown
      O('IS-5', { step: '8. PALLETED', delv: true, storeAt: '2026-10-30T10:00:00Z' }),                  // another PC's clock ahead → 0, not negative
      O('IS-6', { step: '8. PALLETED', delv: true, cienHold: true, storeAt: '2026-10-01T10:00:00Z' }),   // on hold — not in store list
    ] } });
    const r = await t.page.evaluate(async () => {
      const out = Object.fromEntries(inStoreJobs().map(x => [x.o.wo, x.n]));
      out.order = inStoreJobs().map(x => x.o.wo);
      showTab('d'); await new Promise(r => setTimeout(r, 120));
      const b = [...document.querySelectorAll('button,summary,a')].find(x => /In store/.test(x.textContent)); if (b) b.click(); await new Promise(r => setTimeout(r, 120));
      const p = document.getElementById('del-store'); out.panel = p ? p.innerText.replace(/\s+/g, ' ').slice(0, 400) : 'NO PANEL';
      out.amber = p ? [...p.querySelectorAll('.dsh-row')].filter(x => /fff3d6|255, 243, 214/.test(x.getAttribute('style') || '')).map(x => x.querySelector('b').textContent) : [];
      return out;
    });
    rec('In store across the clock change: 00:30 Sun 25 Oct → 2 days on Tue 27 Oct; 23:30 Sun 11 Oct IST → 16 days', r['IS-1'] === 2 && r['IS-2'] === 16, JSON.stringify(r));
    rec('In store history fallback (no storeAt): from the "→ 7. ASSEMBLY COMPLETE" log line → 7 days; none → date unknown, last', r['IS-3'] === 7 && r['IS-4'] === null && r.order[r.order.length - 1] === 'IS-4', JSON.stringify(r));
    rec('In store: a storeAt in the future (other PC\'s clock) shows 0, not negative; on-hold job not listed', r['IS-5'] === 0 && !('IS-6' in r), JSON.stringify(r));
    rec('In store panel: amber only for > 14 days (IS-2)', JSON.stringify(r.amber) === '["IS-2"]', JSON.stringify(r.amber) + ' ' + r.panel);
    await t.close();
  }
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
function wkPlusJs(wk, d) { const x = new Date(wk + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); }
