// Tester attack round 4 (10 Nov 2026): Deliveries usability D1–D4 + DD1 (commits 7b71bd6..acddf20).
// Real mouse drags (Playwright dragTo / page.mouse) onto week tabs and van cells; cancel at every step; Irish bank holidays and the
// clock change; cut / no-date / manual / booked / loaded / on-hold jobs; two PCs; Prev / Next across past weeks to +12 and Later;
// card layout at 360 and 1366 px; sticky week bar; roles; lists switch ON; old saved data; the board red/amber rule; injection.
// Stubbed Supabase only (tests/harness.js + tests/stage1/srv.js) — nothing reaches the live database.
// Run: node tests/dates/attack4-usability.test.js
const H = require('../harness');
const { makeServer, open: openS } = require('../stage1/srv');
const res = [];
const rec = (n, ok, d) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 600) : '')); };
const NOW = '2026-11-10T10:00:00Z'; // Tue 10 Nov 2026, Wk 46
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));

// helpers installed in every page
const HELP = `(()=>{
  window.W=ms=>new Promise(r=>setTimeout(r,ms));
  window.__go=async t=>{const b=document.querySelector('[data-deltab="'+t+'"]');if(b)b.click();else{delTab=String(t);render();}await W(80);};
  window.__why=async k=>{const b=document.querySelector('.pod-ovl [data-why="'+(k||'Customer delay')+'"]');const s=b?b.closest('.pod-in').textContent:'';if(b)b.click();await W(100);return s;};
  window.__ovl=()=>[...document.querySelectorAll('.pod-ovl')].map(o=>(o.id||'')+':'+o.textContent.replace(/\\s+/g,' ').trim().slice(0,400));
  window.__closeAll=()=>document.querySelectorAll('.pod-ovl').forEach(o=>o.remove());
  window.__snap=()=>JSON.stringify({o:DB.orders,x:DB.delx||[]});
  window.__g=w=>DB.orders.find(o=>o.wo===w);
  window.__gx=w=>(DB.delx||[]).find(o=>o.wo===w);
  window.__pool=()=>[...document.querySelectorAll('#dpool .dchip')].map(c=>c.dataset.dw);
  window.__toast=()=>(document.getElementById('toast')||{}).textContent||'';
  window.__layout=()=>{const bad=[];const R=e=>e.getBoundingClientRect();
    const vis=e=>e.offsetParent!==null&&getComputedStyle(e).visibility!=='hidden';
    document.querySelectorAll('.dchip').forEach(c=>{if(!vis(c))return;const r=R(c);
      const box=c.closest('.dcell')||c.closest('#dpool');if(box){const b=R(box);if(r.left<b.left-1||r.right>b.right+1)bad.push(c.dataset.dw+' card outside its '+(c.closest('.dcell')?'van cell':'pool')+' ('+Math.round(r.left)+'-'+Math.round(r.right)+' vs '+Math.round(b.left)+'-'+Math.round(b.right)+')');}
      c.querySelectorAll('*').forEach(e=>{if(e.classList.contains('dq-in')||!vis(e))return;const q=R(e);if(q.width&&(q.right>r.right+1||q.left<r.left-1))bad.push(c.dataset.dw+':'+(e.className||e.tagName)+' spills '+Math.round(q.right-r.right)+'px');
        if(q.height&&q.bottom>r.bottom+1)bad.push(c.dataset.dw+':'+(e.className||e.tagName)+' below card');});});
    const cs=[...document.querySelectorAll('.dchip')].filter(vis).map(c=>[c.dataset.dw,R(c)]);
    for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){const a=cs[i][1],b=cs[j][1];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)bad.push('overlap '+cs[i][0]+'/'+cs[j][0]);}
    return bad;};
})()`;
const prep = async t => { await t.page.evaluate(HELP); return t.page; };

(async () => {
  const browser = await H.chromium.launch();

  // =====================================================================================================================
  // A. REAL mouse drags (PC, 1366 px). Pool card → tab; booked grid card → tab (off van, rebook); loaded grid card → tab
  //    (stays + flagged); pool card → van cell (booking only); onto a past-week tab (refused); a cancelled drag.
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-M1', title: 'Spare doors', customer: 'ASPECT', value: 450, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
      O('WO-P1'), O('WO-P2'), O('WO-P3', { dueDate: '2026-11-13', origDueDate: '2026-11-13' }), O('WO-P4'),
      O('WO-B1', { dueDate: '2026-11-11', origDueDate: '2026-11-11', delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }),
      O('WO-L1', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09', delLoadedAt: '2026-11-10T08:00:00Z' }),
      O('WO-X', { dueDate: '2026-11-03', origDueDate: '2026-11-03', delVeh: 'RENAULT', delDay: 'Tue', delWk: '2026-11-02' }),
    ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 1700 } });
    const p = await prep(t);
    await p.evaluate(async () => { showTab('d'); await W(150); });
    // A1: pool card → Wk 47 tab (real drag)
    await p.locator('.dchip[data-dw="WO-P1"] .dchip-t').dragTo(p.locator('[data-deltab="1"]'));
    await p.waitForTimeout(150);
    const a1 = await p.evaluate(async () => { const ov = __ovl(); const s = await __why('Customer delay'); return { ov, s, due: __g('WO-P1').dueDate, wk: __g('WO-P1').plannedWeek, h: (__g('WO-P1').dueHist || []).length, cls: document.body.className, dl: delDragList }; });
    rec('A1 real drag: pool card onto the Wk 47 tab → asks why → Thu 12 → Thu 19 Nov, build week Wk 47, tabs stop glowing', a1.due === '2026-11-19' && a1.wk === '2026-11-16' && a1.h === 1 && !/del-dragging/.test(a1.cls) && a1.dl === null, JSON.stringify(a1));
    // A2: booked grid card (not loaded) → Wk 48 tab: preview "comes off its van", then why; off the van, rebook
    await p.evaluate(async () => { await __go('0'); });
    await p.locator('.dcell .dchip[data-dw="WO-B1"] .dchip-t').dragTo(p.locator('[data-deltab="2"]'));
    await p.waitForTimeout(150);
    const a2 = await p.evaluate(async () => { const prev = (document.getElementById('wkprev-dlg') || {}).textContent || ''; const go = document.getElementById('wkp-go'); if (go) go.click(); await W(80); const s = await __why('Site not ready'); const sum = (document.getElementById('date-sum') || {}).textContent || ''; __closeAll(); const o = __g('WO-B1'); return { prev: prev.replace(/\s+/g, ' ').slice(0, 300), s: s.slice(0, 200), sum: sum.slice(0, 200), due: o.dueDate, day: o.delDay, veh: o.delVeh, rb: !!o.delRebook, mv: (o.delMoves || []).length }; });
    rec('A2 real drag: booked grid card onto Wk 48 tab → preview "Comes off Volvo Wed" → why → off the van, "rebook", due Wed 25 Nov', /Comes off Volvo Wed/.test(a2.prev) && a2.due === '2026-11-25' && a2.day === '' && a2.veh === '' && a2.rb && a2.mv === 1, JSON.stringify(a2));
    // A3: loaded grid card → Wk 47 tab: stays on its van, flagged
    await p.locator('.dcell .dchip[data-dw="WO-L1"] .dchip-t').dragTo(p.locator('[data-deltab="1"]'));
    await p.waitForTimeout(150);
    const a3 = await p.evaluate(async () => { const prev = (document.getElementById('wkprev-dlg') || {}).textContent || ''; const go = document.getElementById('wkp-go'); if (go) go.click(); await W(80); await __why('Production'); __closeAll(); render(); await W(60); const o = __g('WO-L1'); const card = (document.querySelector('.dchip[data-dw="WO-L1"]') || {}).textContent || ''; return { prev: prev.replace(/\s+/g, ' ').slice(0, 300), due: o.dueDate, day: o.delDay, veh: o.delVeh, loaded: !!(o.dueMv && o.dueMv.loaded), card: card.replace(/\s+/g, ' ') }; });
    rec('A3 real drag: LOADED grid card onto Wk 47 tab → "Stays on its van" → due Thu 19 Nov, still Volvo Thu, flagged on the card', /Stays on its van/.test(a3.prev) && a3.due === '2026-11-19' && a3.day === 'Thu' && a3.veh === 'VOLVO' && a3.loaded && /date moved after loading/.test(a3.card), JSON.stringify(a3));
    // A4: pool card → van cell = booking only (due unchanged, no history)
    const b4 = await p.evaluate(() => __g('WO-P2').dueDate);
    await p.locator('.dchip[data-dw="WO-P2"] .dchip-t').dragTo(p.locator('.dcell[data-cell="IVECO|Tue|2026-11-09"]'));
    await p.waitForTimeout(150);
    const a4 = await p.evaluate(async () => { __closeAll(); await W(30); const o = __g('WO-P2'); return { due: o.dueDate, day: o.delDay, veh: o.delVeh, wk: o.delWk, h: (o.dueHist || []).length, cls: document.body.className, dl: delDragList }; });
    rec('A4 real drag: pool card onto a van cell = booking only (due date and history unchanged)', a4.due === b4 && a4.day === 'Tue' && a4.veh === 'IVECO' && a4.wk === '2026-11-09' && a4.h === 0, JSON.stringify(a4));
    rec('A4b after a drop on a van cell the week tabs stop glowing (body.del-dragging removed)', !/del-dragging/.test(a4.cls), 'body class = "' + a4.cls + '" — the drop re-renders the page before dragend reaches the (removed) card, so the dashed outline stays on every week tab');
    // A5: drag onto the past-week tab (Wk 45, open because WO-X is still booked there) → refused, nothing changes
    await p.evaluate(async () => { document.body.classList.remove('del-dragging'); await __go('0'); });
    const s5 = await p.evaluate(() => __snap());
    // during the drag: does the past tab light up as a target?
    await p.locator('.dchip[data-dw="WO-P3"] .dchip-t').hover(); await p.mouse.down();
    const tb = await p.locator('[data-deltab="-1"]').boundingBox();
    await p.mouse.move(tb.x + 10, tb.y + 5, { steps: 6 }); await p.mouse.move(tb.x + 14, tb.y + 8, { steps: 3 });
    const lit = await p.evaluate(() => document.querySelector('[data-deltab="-1"]').classList.contains('dragover'));
    await p.mouse.up(); await p.waitForTimeout(150);
    const a5 = await p.evaluate(() => ({ same: __snap(), ov: __ovl(), toast: __toast() }));
    rec('A5 real drag onto the past-week tab (Wk 45) → refused with a toast, nothing changed', a5.same === s5 && !a5.ov.length && /has gone/.test(a5.toast), a5.toast);
    rec('A5b the past-week tab does not light up as a drop target while dragging', !lit, 'Wk 45 (past) tab turns solid blue under the pointer (.dragover) although a drop there is refused');
    // A6: a cancelled drag (released over the page heading) leaves the drag list behind; a later drop of something else on a tab
    //     (a file / text dragged from outside) then moves the old card
    await p.evaluate(async () => { await __go('0'); });
    await p.locator('.dchip[data-dw="WO-P4"] .dchip-t').hover(); await p.mouse.down();
    const hd = await p.locator('#del-wkh').boundingBox();
    await p.mouse.move(hd.x + 30, hd.y + 5, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(100);
    const a6a = await p.evaluate(() => ({ dl: delDragList, cls: document.body.className, ov: __ovl().length }));
    const a6 = await p.evaluate(async () => {
      const tab = document.querySelector('[data-deltab="3"]'); const dt = new DataTransfer(); dt.items.add(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }));
      tab.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); tab.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); await W(100);
      const ov = __ovl(); __closeAll(); return { ov };
    });
    rec('A6 a cancelled card drag does not leave the card "armed": a file dropped on a week tab later must not open a move for WO-P4', a6a.dl === null && !a6.ov.some(x => /WO-P4/.test(x)), 'after the cancelled drag delDragList=' + JSON.stringify(a6a.dl) + '; file drop on Wk 49 tab opened: ' + JSON.stringify(a6.ov).slice(0, 200));
    // A7: selection — tick three cards, drag one of them (real drag) onto Wk 49 → all three move with one reason
    await p.evaluate(async () => { delDragList = null; delSel.clear(); render(); await W(60); });
    for (const w of ['WO-P3', 'WO-P4']) { await p.locator('.dchip[data-dw="' + w + '"] .dchip-t').click(); await p.waitForTimeout(80); }
    await p.locator('.dchip[data-dw="WO-P3"] .dchip-t').dragTo(p.locator('[data-deltab="3"]'));
    await p.waitForTimeout(150);
    const a7 = await p.evaluate(async () => { const go = document.getElementById('wkp-go'); if (go) go.click(); await W(80); const s = await __why('Materials'); const sum = (document.getElementById('date-sum') || {}).textContent || ''; __closeAll(); return { s: s.slice(0, 120), sum: sum.slice(0, 120), d3: __g('WO-P3').dueDate, d4: __g('WO-P4').dueDate, sel: delSel.size }; });
    rec('A7 real drag of one ticked card moves every ticked card (one reason, summary)', a7.d3 === '2026-12-04' && a7.d4 === '2026-12-03' && a7.sel === 0 && /2 moved/.test(a7.sum), JSON.stringify(a7));
    // A8: drag a booked card back onto the pool (unbook) still asks why; drop on the tab it is already on → nothing moves
    await p.locator('.dcell .dchip[data-dw="WO-P2"] .dchip-t').dragTo(p.locator('[data-deltab="0"]'));
    await p.waitForTimeout(150);
    const a8 = await p.evaluate(async () => { const ov = __ovl(), t = __toast(); __closeAll(); const o = __g('WO-P2'); return { ov, t, due: o.dueDate, day: o.delDay }; });
    rec('A8 booked card dropped on its own week tab → "Nothing moved", still on its van', a8.due === '2026-11-12' && a8.day === 'Tue' && !a8.ov.length && /Nothing moved/.test(a8.t), JSON.stringify(a8));
    rec('A: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // B. Cancel at each step changes nothing (quick date edit and week moves)
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-M1', title: 'Spare doors', customer: 'ASPECT', value: 450, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
      O('WO-1'), O('WO-2', { delivDate: '2026-11-13' }), O('WO-3', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }) ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const B = await p.evaluate(async () => {
      showTab('d'); await W(150);
      const out = {}, s0 = __snap();
      const qi = (wo, f) => document.querySelector('.dq-in[data-dq="' + wo + '"][data-f="' + (f || 'due') + '"]');
      const chg = async (wo, f, v) => { const i = qi(wo, f); i.value = v; i.dispatchEvent(new Event('change')); await W(80); };
      // 1 the name question (nobody signed in on this tab) → Cancel
      sessionStorage.removeItem('wpfWho');
      await chg('WO-1', 'due', '2026-11-20'); out.whoAsk = !!document.querySelector('.pod-ovl #pick-other');
      document.querySelector('.pod-ovl #pod-x').click(); await W(60);
      out.c1 = { same: __snap() === s0, inp: qi('WO-1').value, ov: __ovl().length };
      // 1b name question → click the dark backdrop
      await chg('WO-1', 'due', '2026-11-20'); const ov = document.querySelector('.pod-ovl'); ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); await W(60);
      out.c1b = { same: __snap() === s0, inp: qi('WO-1').value, ov: __ovl().length };
      sessionStorage.setItem('wpfWho', 'Tester');
      // 2 reason → Cancel; 2b reason → backdrop; 2c "Other" then prompt cancelled → still open → Cancel
      await chg('WO-1', 'due', '2026-11-20'); document.querySelector('.pod-ovl #pod-x').click(); await W(60);
      out.c2 = { same: __snap() === s0, inp: qi('WO-1').value };
      await chg('WO-1', 'due', '2026-11-20'); document.querySelector('.pod-ovl').dispatchEvent(new MouseEvent('click', { bubbles: true })); await W(60);
      out.c2b = { same: __snap() === s0, inp: qi('WO-1').value };
      const pr = window.prompt; window.prompt = () => null;
      await chg('WO-1', 'due', '2026-11-20'); document.querySelector('.pod-ovl [data-why="Other"]').click(); await W(60); out.otherOpen = __ovl().length;
      window.prompt = () => '   '; document.querySelector('.pod-ovl [data-why="Other"]').click(); await W(60); out.otherBlank = __ovl().length;
      window.prompt = pr; document.querySelector('.pod-ovl #pod-x').click(); await W(60);
      out.c2c = { same: __snap() === s0, inp: qi('WO-1').value };
      // 3 delivery date tag: cancel; cleared date box (Chrome "Clear") → full dialog, cancel
      await chg('WO-2', 'deliv', '2026-11-27'); document.querySelector('.pod-ovl #pod-x').click(); await W(60);
      out.c3 = { same: __snap() === s0, inp: qi('WO-2', 'deliv').value };
      await chg('WO-1', 'due', ''); out.c4 = { same: __snap() === s0, inp: qi('WO-1').value, ov: __ovl() };
      __closeAll();
      // 5 week moves: picker → Cancel; picker → backdrop; booked job preview → Cancel; reason → Cancel
      document.querySelector('[data-wkpick="WO-1"]').click(); await W(60); document.querySelector('#wkpick-dlg #pod-x').click(); await W(60); out.c5 = __snap() === s0;
      document.querySelector('[data-wkpick="JOB-M1"]').click(); await W(60); document.getElementById('wkpick-dlg').dispatchEvent(new MouseEvent('click', { bubbles: true })); await W(60); out.c5b = __snap() === s0;
      delSel.clear(); delSel.add('WO-3'); delSel.add('WO-1'); render(); await W(60);
      document.getElementById('selwk').click(); await W(60); document.querySelector('#wkpick-dlg [data-wkp="2026-11-23"]').click(); await W(60);
      out.prevShown = !!document.getElementById('wkprev-dlg');
      const px = document.querySelector('#wkprev-dlg #pod-x') || [...document.querySelectorAll('#wkprev-dlg button')].find(b => /Cancel/.test(b.textContent)); if (px) px.click(); await W(60);
      out.c6 = { same: __snap() === s0, ov: __ovl().length, sel: delSel.size };
      document.querySelector('[data-wknext="WO-1"]').click(); await W(60); document.querySelector('.pod-ovl #pod-x').click(); await W(60);
      out.c7 = __snap() === s0;
      document.querySelector('[data-wknext="JOB-M1"]').click(); await W(60); document.querySelector('.pod-ovl #pod-x').click(); await W(60);
      out.c8 = __snap() === s0;
      return out;
    });
    rec('B1 quick edit → "Who is making changes?" → Cancel: nothing changes, date box back to the old date', B.whoAsk && B.c1.same && B.c1.inp === '2026-11-12' && !B.c1.ov, JSON.stringify(B.c1));
    rec('B1b … → tap outside the name box: nothing changes', B.c1b.same && B.c1b.inp === '2026-11-12' && !B.c1b.ov, JSON.stringify(B.c1b));
    rec('B2 quick edit → reason → Cancel / tap outside: nothing changes, box reset', B.c2.same && B.c2.inp === '2026-11-12' && B.c2b.same && B.c2b.inp === '2026-11-12', JSON.stringify([B.c2, B.c2b]));
    rec('B2c "Other" with the words box cancelled or blank → reason box stays open; then Cancel = nothing changes', B.otherOpen === 1 && B.otherBlank === 1 && B.c2c.same && B.c2c.inp === '2026-11-12', JSON.stringify(B));
    rec('B3 delivery-date tag → Cancel: nothing changes', B.c3.same && B.c3.inp === '2026-11-13', JSON.stringify(B.c3));
    rec('B4 due-date box cleared (Chrome "Clear") → nothing changes, box shows the date again, no dialog', B.c4.same && B.c4.inp === '2026-11-12' && !B.c4.ov.length, JSON.stringify(B.c4));
    rec('B5 week picker → Cancel / tap outside: nothing changes', B.c5 && B.c5b, '');
    rec('B6 Move ticked (booked job in the mix) → preview → Cancel: nothing changes, selection kept', B.prevShown && B.c6.same && !B.c6.ov && B.c6.sel === 2, JSON.stringify(B.c6));
    rec('B7 → Wk N → reason Cancel (Cienapps job and manual job): nothing changes', B.c7 && B.c8, '');
    await p.waitForTimeout(1600);
    const keys = new Set(t.server.patches.flatMap(b => JSON.stringify(b).match(/"dueHist"|"planWk"/g) || []));
    rec('B: no save carried a date move or planWk after the cancels', !keys.size, [...keys].join());
    rec('B: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // C. Week moves across Irish bank holidays, year end (Wk 53), and the clock changes
  // =====================================================================================================================
  {
    const cases = [
      // [now, due, deliv, targetWk, expectDue, expectDeliv|null, label]
      ['2026-11-10T10:00:00Z', '2026-12-11', '', '2026-12-21', '2026-12-24', null, 'Fri 11 Dec → Wk 52: Fri 25 Dec Christmas → Thu 24 Dec'],
      ['2026-11-10T10:00:00Z', '2026-12-17', '', '2026-12-28', '2026-12-31', null, 'Thu 17 Dec → Wk 53 → Thu 31 Dec'],
      ['2026-11-10T10:00:00Z', '2026-12-18', '', '2026-12-28', '2026-12-31', null, 'Fri 18 Dec → Wk 53: Fri 1 Jan 2027 bank holiday → Thu 31 Dec'],
      ['2026-11-10T10:00:00Z', '2026-12-14', '', '2026-12-28', '2026-12-29', null, 'Mon 14 Dec → Wk 53: Mon 28 Dec (St Stephen\'s moved) → Tue 29 Dec'],
      ['2026-11-10T10:00:00Z', '2026-12-30', '', '2027-01-04', '2027-01-06', null, 'Wed 30 Dec (Wk 53) → Wk 1 2027 → Wed 6 Jan'],
      ['2026-11-10T10:00:00Z', '2026-12-23', '2026-12-30', '2027-01-04', '2026-12-30', '2027-01-06', 'due Wed 23 Dec + delivery Wed 30 Dec → Wk 1: delivery 6 Jan, due 30 Dec (gap kept across year end)'],
      ['2026-11-10T10:00:00Z', '', '', '2026-12-21', '2026-12-24', null, 'no due date → Wk 52 → last working day Thu 24 Dec'],
      ['2026-11-10T10:00:00Z', '', '', '2026-12-28', '2026-12-31', null, 'no due date → Wk 53 → Thu 31 Dec'],
      ['2027-03-02T10:00:00Z', '2027-03-10', '', '2027-03-15', '2027-03-16', null, 'Wed 10 Mar → Wk 11: Wed 17 Mar St Patrick\'s → Tue 16 Mar'],
      ['2027-03-02T10:00:00Z', '2027-03-22', '', '2027-03-29', '2027-03-30', null, 'Mon 22 Mar → Easter week: Mon 29 Mar Easter Monday → Tue 30 Mar'],
      ['2027-03-02T10:00:00Z', '2027-03-26', '', '2027-03-29', '2027-04-02', null, 'Fri 26 Mar → across the 28 Mar clock change → Fri 2 Apr'],
      ['2026-10-20T10:00:00Z', '2026-10-23', '', '2026-10-26', '2026-10-30', null, 'Fri 23 Oct → across the 25 Oct clock change → Fri 30 Oct'],
      ['2026-10-20T10:00:00Z', '2026-10-19', '', '2026-10-26', '2026-10-27', null, 'Mon 19 Oct → October bank holiday week → Tue 27 Oct'],
      ['2026-12-24T10:00:00Z', '2026-12-21', '', '2026-12-21', '2026-12-24', null, 'Thu 24 Dec: overdue Mon 21 Dec → This week → today Thu 24 Dec'],
    ];
    const byNow = {};
    cases.forEach(c => (byNow[c[0]] = byNow[c[0]] || []).push(c));
    for (const now of Object.keys(byNow)) {
      const t = await H.open({ browser, now, row: { id: 'main', nid: 9, settings: {}, orders: [] } });
      const out = await t.page.evaluate(cs => cs.map(c => wkMoveTo({ dueDate: c[1], delivDate: c[2] }, c[3])), byNow[now]);
      byNow[now].forEach((c, i) => { const r = out[i]; rec('C ' + c[6], r.due === c[4] && (c[5] === null || r.deliv === c[5]) && !r.err, JSON.stringify(r)); });
      await t.close();
    }
    // Sat 26 Dec (St Stephen's, a Saturday): This week has no working day left → refused; the tab button offers Wk 53
    {
      const t = await H.open({ browser, now: '2026-12-26T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [O('WO-S1', { dueDate: '2026-12-23', origDueDate: '2026-12-23', plannedWeek: '2026-12-21' })] } });
      const p = await prep(t);
      const r = await p.evaluate(async () => { showTab('d'); await W(150); const e = wkMoveTo({ dueDate: '2026-12-23' }, '2026-12-21'); const b = (document.querySelector('[data-wknext="WO-S1"]') || {}).textContent; document.querySelector('[data-wknext="WO-S1"]').click(); await W(60); await __why('Production'); return { e, b, due: __g('WO-S1').dueDate, bar: document.getElementById('wkb-lbl').textContent }; });
      rec('C Sat 26 Dec: moving to This week (Wk 52) is refused "No working days left"; card "→ Wk 53" → Wed 30 Dec', /No working days left in Wk 52/.test(r.e.err) && r.b === '→ Wk 53' && r.due === '2026-12-30', JSON.stringify(r));
      await t.close();
    }
    // Clock-change Mondays just after midnight: the week bar / tabs / due-tag colours must already be the new week
    for (const [now, wk, lbl] of [['2027-03-28T23:30:00Z', 'Wk 13', 'Mon 29 Mar 2027 00:30 (first Monday of summer time, Easter Monday)'], ['2026-10-26T00:30:00Z', 'Wk 44', 'Mon 26 Oct 2026 00:30 (first Monday of winter time, bank holiday)']]) {
      const due = now.startsWith('2027') ? '2027-03-29' : '2026-10-26';
      const t = await H.open({ browser, now, row: { id: 'main', nid: 9, settings: {}, orders: [O('WO-K', { dueDate: due, origDueDate: due, plannedWeek: '' })] } });
      const p = await prep(t);
      const r = await p.evaluate(async () => { showTab('d'); await W(150); return { bar: document.getElementById('wkb-lbl').textContent, tab0: document.querySelector('[data-deltab="0"]').textContent, pool: __pool(), tag: (document.querySelector('.dchip[data-dw="WO-K"] .due-tag') || {}).className, grid: [...document.querySelectorAll('.del-grid th.hol')].map(h => h.textContent) }; });
      rec('C ' + lbl + ': week bar ' + wk + ', job due today is on This week, amber, Monday shown as bank holiday', r.bar.includes(wk) && r.pool.includes('WO-K') && /amber/.test(r.tag) && r.grid.length === 1 && /^Mon/.test(r.grid[0]), JSON.stringify(r));
      await t.close();
    }
    // Year end: Wk 53 shows as its own tab label and the picker lists it once; Next walks 52 → 53 → 1 without skipping
    {
      const t = await H.open({ browser, now: '2026-12-15T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [O('WO-Y', { dueDate: '2026-12-16', origDueDate: '2026-12-16', plannedWeek: '2026-12-14' })] } });
      const p = await prep(t);
      const r = await p.evaluate(async () => { showTab('d'); await W(150); document.querySelector('[data-wkpick="WO-Y"]').click(); await W(60); const pk = [...document.querySelectorAll('#wkpick-dlg [data-wkp]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()); __closeAll();
        const tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()); return { pk: pk.slice(0, 6), tabs }; });
      rec('C year end: picker lists Wk 51, 52, 53, 1, 2 in order; tab "+2" is Wk 53 · 28 Dec', /Wk 51/.test(r.pk[0]) && /Wk 52/.test(r.pk[1]) && /Wk 53 · Mon 28 Dec/.test(r.pk[2]) && /Wk 1 · Mon 4 Jan/.test(r.pk[3]) && r.tabs.some(x => /Wk 53 · 28 Dec/.test(x)), JSON.stringify(r));
      await t.close();
    }
  }

  // =====================================================================================================================
  // D. Cut jobs (step 6+, saw tick on a photo list, saw tick on a typed list), no due date, group move with a mix
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: {
      delx: [{ wo: 'JOB-M2', title: 'Site office kit', customer: 'ASPECT', value: 50, manual: true, delVeh: '', delDay: '', delDone: false },
        { wo: 'JOB-MB', title: 'Booked manual', customer: 'ASPECT', value: 70, manual: true, delVeh: 'IVECO', delDay: 'Fri', delWk: '2026-11-09', delDone: false }],
      lists: [{ id: 'L1', wos: ['WO-LST'], title: 'List 1', rows: [{ d: 'Panel' }] }], listRow: { L1: { 0: { m: 'saw', at: '2026-11-09T09:00:00Z', by: 'Saw' } } } }, orders: [
      O('WO-C6', { step: '6. CUT' }), O('WO-PH', { step: '5. WORK ORDER PROCESSED', photoDone: { saw: { at: '2026-11-09T09:00:00Z', by: 'Saw' } } }),
      O('WO-LST', { step: '5. WORK ORDER PROCESSED' }), O('WO-ND', { dueDate: '', origDueDate: '' }),
      O('WO-BK', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }), O('WO-LD', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z' }),
      O('WO-HL', { cienHold: true, delVeh: 'RENAULT', delDay: 'Thu', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z' }),
      O('WO-HP', { cienHold: true }), O('WO-PL'), O('WO-DLV', { delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-11-09', delDone: true, delDelivAt: '2026-11-09T15:00:00Z' }),
    ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const D = await p.evaluate(async () => {
      showTab('d'); await W(150); const out = {};
      out.cut = ['WO-C6', 'WO-PH', 'WO-LST'].map(w => woCut(__g(w)));
      // each cut job: → Wk 47 from the card
      for (const w of ['WO-C6', 'WO-PH', 'WO-LST']) { const b = document.querySelector('[data-wknext="' + w + '"]'); if (!b) { out[w] = 'no button'; continue; } b.click(); await W(60); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); __closeAll(); }
      out.cutRes = ['WO-C6', 'WO-PH', 'WO-LST'].map(w => { const o = __g(w); return w + ':' + o.dueDate + '/' + o.plannedWeek + '/' + (o.dueMv ? 'mv' : '-'); });
      showTab('b'); await W(150); out.boardChip = ['WO-C6', 'WO-PH', 'WO-LST'].map(w => /due moved — check week/.test((document.querySelector('tr[data-wo="' + w + '"]') || {}).textContent || ''));
      showTab('d'); await W(100);
      // no due date: "→ Wk 47" → Fri 20 Nov
      document.querySelector('[data-wknext="WO-ND"]').click(); await W(60); await __why('Production'); __closeAll(); out.nd = __g('WO-ND').dueDate;
      out.ndHist = (__g('WO-ND').dueHist || []).map(h => h.from + '>' + h.to);
      // group: cut, manual, booked, loaded, loaded+on hold (on its van), booked manual, plain, delivered, on hold hidden (still in the selection)
      const set = ['WO-C6', 'JOB-M2', 'WO-BK', 'WO-LD', 'WO-HL', 'JOB-MB', 'WO-PL', 'WO-DLV', 'WO-HP'];
      delSel.clear(); set.forEach(x => delSel.add(x)); render(); await W(60);
      out.selbar = (document.querySelector('.selbar') || {}).textContent || '';
      out.visible = set.filter(x => document.querySelector('.dchip[data-dw="' + x + '"]'));
      document.getElementById('selwk').click(); await W(60);
      out.pickTitle = (document.querySelector('#wkpick-dlg .pod-in > div') || {}).textContent || '';
      document.querySelector('#wkpick-dlg [data-wkp="2026-11-23"]').click(); await W(60);
      out.prev = (document.getElementById('wkprev-dlg') || {}).textContent || '';
      const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60);
      out.sub = await __why('Customer delay');
      out.sum = ((document.getElementById('date-sum') || {}).textContent || '').replace(/\s+/g, ' ');
      __closeAll();
      out.after = set.map(w => { const o = findDel(w); return w + ':' + (o.manual ? (o.planWk || '-') : o.dueDate) + '/' + (o.delDay || '-') + (o.dueMv ? '/mv' : '') + (o.delRebook ? '/rb' : ''); });
      return out;
    });
    rec('D cut detection: step 6, saw tick on a photo list, saw tick on a typed list all count as cut', D.cut.every(Boolean), JSON.stringify(D.cut));
    rec('D cut jobs → Wk 47: due moved, build week Wk 46 kept, "due moved — check week" on the board row', D.cutRes.every(x => /2026-11-19\/2026-11-09\/mv$/.test(x)) && D.boardChip.every(Boolean), JSON.stringify([D.cutRes, D.boardChip]));
    rec('D no-date job "→ Wk 47" → Fri 20 Nov (history from "none")', D.nd === '2026-11-20' && D.ndHist.length === 1, JSON.stringify([D.nd, D.ndHist]));
    const n = (D.selbar.match(/Move ticked to week… \((\d+)\)/) || [])[1];
    rec('D group: the button count only counts ticked jobs that can actually move (not delivered, not a booked manual job, not a hidden on-hold job)', n === '5' || n === '6', 'button says (' + n + ') — selection had 9: cut, manual, booked, loaded, loaded+on hold, booked manual, plain, delivered, hidden on hold; visible cards: ' + D.visible.join(','));
    rec('D group: a job on hold in Cienapps that is hidden from Deliveries (not loaded) is NOT moved just because it was still ticked', /WO-HP:2026-11-12/.test(D.after.join()), D.after.join(' | '));
    rec('D group: the summary lists the booked manual job as "not moved" (it was ticked and silently skipped)', /not moved/.test(D.sum) && /JOB-MB/.test(D.sum), D.sum.slice(0, 400));
    rec('D group: booked → off van (rebook); loaded and loaded+on-hold stay on their vans + flagged; cut keeps week; manual planWk; plain moved',
      D.after.includes('WO-BK:2026-11-26/-/rb') && D.after.includes('WO-LD:2026-11-26/Thu/mv') && /WO-HL:2026-11-26\/Thu\/mv/.test(D.after.join()) && D.after.includes('WO-C6:2026-11-26/-/mv') && D.after.includes('JOB-M2:2026-11-23/-') && D.after.includes('WO-PL:2026-11-26/-') && D.after.includes('JOB-MB:-/Fri') && D.after.includes('WO-DLV:2026-11-12/Mon'), D.after.join(' | '));
    rec('D group: summary counts — taken off vans 1, 1 week kept (cut job), loaded jobs flagged', /1 taken off vans/.test(D.sum) && /1 week kept/.test(D.sum), D.sum.slice(0, 300));
    rec('D: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // E. Two PCs: manual planWk (different jobs / same job / move vs book), the same Cienapps job moved to two weeks
  // =====================================================================================================================
  {
    const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
    const reload = p => p.evaluate(async () => { await loadDB(); });
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { delx: [
      { wo: 'JOB-A', title: 'A', customer: 'C', value: 10, manual: true, delVeh: '', delDay: '', delDone: false },
      { wo: 'JOB-B', title: 'B', customer: 'C', value: 10, manual: true, delVeh: '', delDay: '', delDone: false },
      { wo: 'JOB-C', title: 'C', customer: 'C', value: 10, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
      O('WO-T1'), O('WO-T2', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }) ] });
    const A = await openS(browser, S, { now: NOW }), B = await openS(browser, S, { now: '2026-11-10T10:02:00Z' });
    await prep(A); await prep(B);
    const mv = (p, wos, W, why) => p.evaluate(async ({ wos, W, why }) => { showTab('d'); await W2(80); wkMoveDo(wos, W); await W2(60); const go = document.getElementById('wkp-go'); if (go) go.click(); await W2(60); await __why(why); __closeAll(); function W2(ms) { return new Promise(r => setTimeout(r, ms)); } }, { wos, W, why });
    await mv(A.page, ['JOB-A'], '2026-11-23', 'Customer delay');
    await mv(B.page, ['JOB-B'], '2026-11-30', 'Site not ready');
    await mv(A.page, ['JOB-C'], '2026-11-16', 'Production');
    await mv(B.page, ['JOB-C'], '2026-11-30', 'Materials'); // same manual job, two weeks
    await B.page.evaluate(() => { placeJobs([__gx('JOB-A')], 'IVECO', 'Tue', '2026-11-09'); }); await B.page.waitForTimeout(80); // B books JOB-A while A planned it
    await save(A.page); await save(B.page); await reload(A.page); await reload(B.page);
    const r = await A.page.evaluate(async () => { const g = __gx; showTab('x'); await W(120); return { a: [g('JOB-A').planWk, g('JOB-A').delDay], b: g('JOB-B').planWk, c: g('JOB-C').planWk, cLog: (g('JOB-C').log || []).map(l => l.by + ':' + l.what), cien: (document.getElementById('exp-dates') || {}).textContent || '' }; });
    rec('E two PCs plan DIFFERENT manual jobs for different weeks → both kept', r.b === '2026-11-30' && r.a[0] === '2026-11-23', JSON.stringify(r));
    rec('E two PCs plan the SAME manual job → one week wins, both moves in its log', ['2026-11-16', '2026-11-30'].includes(r.c) && r.cLog.filter(x => /Planned for Wk/.test(x)).length === 2, JSON.stringify([r.c, r.cLog]));
    rec('E PC A plans a manual job for Wk 48 while PC B books it on Iveco Tue → the booking survives (card on the van)', r.a[1] === 'Tue', JSON.stringify(r.a));
    rec('E manual jobs never appear in Dates to change in Cienapps', !/JOB-/.test(r.cien), r.cien.slice(0, 200));
    // same Cienapps job moved to two different weeks on two PCs (B's clock 2 minutes ahead = newer move)
    await mv(A.page, ['WO-T1'], '2026-11-16', 'Production');
    await mv(B.page, ['WO-T1'], '2026-11-23', 'Materials');
    await save(B.page); await save(A.page); await reload(A.page); await reload(B.page);
    const r2 = await A.page.evaluate(() => { const o = __g('WO-T1'); return { due: o.dueDate, wk: o.plannedWeek, keep: o.dueKeep, h: (o.dueHist || []).map(h => h.to) }; });
    rec('E same job moved to Wk 47 (PC A) and Wk 48 (PC B, newer) → Wk 48 wins as a unit (due + build week agree), both in history', r2.due === '2026-11-26' && r2.wk === '2026-11-23' && r2.keep === '2026-11-12' && r2.h.length === 2, JSON.stringify(r2));
    // booked job: PC A moves its week (comes off the van) while PC B moves it to another van day
    await mv(A.page, ['WO-T2'], '2026-11-16', 'Production');
    await B.page.evaluate(async () => { showTab('d'); await W(60); placeJobs([__g('WO-T2')], 'VOLVO', 'Fri', '2026-11-09'); await W(60); await __why('Production'); __closeAll(); });
    await save(A.page); await save(B.page); await reload(A.page); await reload(B.page);
    const r3 = await A.page.evaluate(() => { const o = __g('WO-T2'); return { due: o.dueDate, day: o.delDay || '', wk: o.delWk || '', rb: !!o.delRebook }; });
    rec('E booked job: A moves its week (off the van) while B rebooks Fri → consistent result (either on a van with no "rebook" flag, or in the pool flagged rebook)', (r3.day && !r3.rb) || (!r3.day && r3.rb), JSON.stringify(r3));
    rec('E: no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await B.close();
  }

  // =====================================================================================================================
  // F. Prev / Next across several open past weeks, up to +12, Later; temporary tabs past +3 (double counting?)
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-W44', { dueDate: '2026-10-27', origDueDate: '2026-10-27', delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-10-26' }),
      O('WO-W45', { dueDate: '2026-11-03', origDueDate: '2026-11-03', delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-02' }),
      O('WO-F5', { dueDate: '2026-12-16', origDueDate: '2026-12-16', plannedWeek: '', value: 5000 }),
      O('WO-F12', { dueDate: '2027-02-03', origDueDate: '2027-02-03', plannedWeek: '', value: 700 }),
      O('WO-0', { value: 300 }),
    ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const F = await p.evaluate(async () => {
      showTab('d'); await W(150); const out = { walk: [] };
      const lbl = () => delTab + '=' + document.getElementById('wkb-lbl').textContent.replace(/\s+/g, ' ').trim();
      for (let k = 0; k < 3; k++) { const b = document.getElementById('wkb-prev'); out.walk.push(lbl() + (b.disabled ? ' [prev off]' : '')); if (!b.disabled) { b.click(); await W(50); } }
      out.closeShown = !!document.getElementById('btn-delreset');
      document.getElementById('wkb-today').click(); await W(50);
      const fw = [];
      for (let k = 0; k < 15; k++) { fw.push(lbl()); document.getElementById('wkb-next').click(); await W(40); }
      out.fwd = fw;
      out.atLater = fw[13];
      // at +5: the temporary tab, its pool, and Later
      delTab = '5'; render(); await W(60);
      const tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab + '=' + b.textContent.replace(/\s+/g, ' ').trim());
      out.tabs5 = tabs; out.pool5 = __pool();
      out.foot5 = [...document.querySelectorAll('.dgrp-f')].map(f => f.textContent);
      delTab = 'later'; render(); await W(60); out.poolL = __pool(); out.footL = [...document.querySelectorAll('.dgrp-f')].map(f => f.textContent);
      out.tabsL = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab);
      const sumTabs = tabs.reduce((a, x) => a + +((x.match(/\((\d+)\)\s*$/) || [])[1] || 0), 0);
      out.sumTabs = sumTabs; out.tagged = delAll().length;
      // Next ▶ from Later
      document.getElementById('wkb-next').click(); await W(50); out.nextFromLater = lbl();
      return out;
    });
    rec('F Prev walks This week → Wk 45 → Wk 44 (both open past weeks), then stops', /^0=Wk 46/.test(F.walk[0]) && /^-1=Wk 45/.test(F.walk[1]) && /^-2=Wk 44.*\[prev off\]/.test(F.walk[2]), JSON.stringify(F.walk));
    rec('F Next walks This week … +12 (Wk 46 … Wk 5 2027) one week at a time, then Later', F.fwd.slice(0, 13).every((x, i) => x.startsWith(i + '=')) && /^later=/.test(F.atLater), JSON.stringify(F.fwd.slice(10)) + ' / ' + F.atLater);
    rec('F temporary +5 tab shows WO-F5; the same job is also counted under Later (shown twice: tab ' + (F.tabs5.find(x => x.startsWith('5=')) || '') + ' and Later)', F.pool5.includes('WO-F5') && F.poolL.includes('WO-F5'), 'information: tab counts add up to ' + F.sumTabs + ' for ' + F.tagged + ' tagged jobs — WO-F5 is counted on the Wk 51 tab AND on Later; group footers: +5 ' + JSON.stringify(F.foot5) + ' Later ' + JSON.stringify(F.footL));
    rec('F Next ▶ on Later does not jump BACK to +4', !/^4=/.test(F.nextFromLater), 'Next ▶ from Later went to ' + F.nextFromLater);
    rec('F: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // G. Layout at 360 and 1366 px with very long WO / title / customer / Floor "BLOCK T09 FLOOR 12" — pool AND van grid;
  //    sticky week bar after scrolling; no € on any card; group footers add up (odd values too)
  // =====================================================================================================================
  {
    const long = (wo, x) => O(wo, Object.assign({ floor: 'BLOCK T09 FLOOR 12', unit: 'APARTMENT 1204B (REAR, DUPLEX UPPER)', customer: 'ASPECT ATHENRY DEVELOPMENTS LIMITED (PHASE 2) — O\'GRADY CONSTRUCTION', title: 'Type B kitchen — handleless, Fenix NTM worktop, full-height larder with integrated appliances and a very long description that keeps going' }, x));
    const orders = [
      long('WO-261799-1234-1'), long('WO-261799-1234-2', { dueDate: '2026-11-04', origDueDate: '2026-11-04', delivDate: '2026-11-13', dueHist: [{ at: '2026-11-01T10:00:00Z', by: 'X', f: 'due', from: '2026-11-01', to: '2026-11-04', why: 'Production' }] }),
      long('WO-2617-4-REV-B-SUPPLEMENTARY-ORDER-0001'), long('WO-UNBROKEN', { title: 'X'.repeat(90), customer: 'C'.repeat(70), floor: 'F'.repeat(40), unit: 'U'.repeat(40) }),
      long('WO-G1', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }), long('WO-G2', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z', dueMv: { loaded: true, at: '2026-11-10T07:00:00Z' }, delMoves: [{ at: '2026-11-09T10:00:00Z', by: 'Ann', why: 'x' }] }),
      long('WO-G3-VERY-LONG-WORK-ORDER-NUMBER', { delVeh: 'SMART', delDay: 'Sat', delWk: '2026-11-09' }),
      long('WO-RB', { delRebook: { at: '2026-11-10T08:00:00Z', by: 'Ann', why: 'x', was: 'VOLVO|Mon' } }),
      O('WO-V1', { value: '1500' }), O('WO-V2', { value: null }), O('WO-V3', { value: 'abc' }), O('WO-V4', { value: 99.6 }),
    ];
    const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-LONG-MANUAL-ENTRY-FOR-SITE', title: 'Spare doors and panels for BLOCK T09 FLOOR 12', customer: 'ASPECT', value: 450, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders };
    for (const vw of [{ width: 360, height: 740 }, { width: 1366, height: 768 }]) {
      const t = await H.open({ browser, now: NOW, row, viewport: vw });
      const p = await prep(t);
      const G = await p.evaluate(async () => {
        showTab('d'); await W(200); const out = {};
        out.bad = __layout();
        out.docW = document.documentElement.scrollWidth;
        out.euro = [...document.querySelectorAll('.dchip')].filter(c => /€/.test(c.textContent)).map(c => c.dataset.dw);
        const vals = { 'WO-V1': 1500, 'WO-V2': 0, 'WO-V3': 0, 'WO-V4': 99.6 };
        out.foot = [...document.querySelectorAll('#dpool .dgrp')].map(g => { const ws = [...g.querySelectorAll('.dchip')].map(c => c.dataset.dw); const exp = ws.reduce((a, w) => a + (w in vals ? vals[w] : w.startsWith('JOB') ? 450 : 1000), 0); const f = (g.querySelector('.dgrp-f') || {}).textContent || ''; return { f, exp: ws.length + ' job' + (ws.length !== 1 ? 's' : '') + ' · €' + Math.round(exp).toLocaleString(), ws }; });
        // clipped text: WO / floor badge / title that are cut off (scrollWidth > clientWidth inside a card)
        out.clipped = [...document.querySelectorAll('.dchip *')].filter(e => e.offsetParent && e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && !e.classList.contains('dq-in')).map(e => e.closest('.dchip').dataset.dw + ':' + (e.className || e.tagName) + ':' + e.textContent.slice(0, 20));
        // sticky bar: scroll to the van grid and check the bar is on screen and not covered
        const grid = document.querySelector('.del-grid'); window.scrollTo(0, grid.getBoundingClientRect().top + window.scrollY - 50); await W(120);
        const wb = document.getElementById('del-wkbar').getBoundingClientRect();
        const nx = document.getElementById('wkb-next').getBoundingClientRect();
        const hit = document.elementFromPoint(nx.left + nx.width / 2, nx.top + nx.height / 2);
        out.sticky = { top: Math.round(wb.top), bottom: Math.round(wb.bottom), sy: Math.round(window.scrollY), nextHit: !!(hit && hit.closest('#wkb-next')), vis: wb.top >= 0 && wb.bottom <= innerHeight };
        out.tabOnScreen = [...document.querySelectorAll('[data-deltab]')].some(x => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
        delDragList = ['WO-G1']; const ev = new Event('dragover', { cancelable: true }); document.getElementById('wkb-next').dispatchEvent(ev); out.barDrop = ev.defaultPrevented; delDragList = null;
        const gc = document.querySelector('.dcell .dchip[data-dw="WO-G1"]').getBoundingClientRect(); out.gridCardOnScreen = gc.top >= 0 && gc.bottom <= innerHeight;
        document.getElementById('wkb-next').click(); await W(100);
        out.afterNext = { sy: Math.round(window.scrollY), lbl: document.getElementById('wkb-lbl').textContent.slice(0, 30) };
        return out;
      });
      const W_ = vw.width + ' px';
      rec('G ' + W_ + ': no card overlaps another, nothing spills out of a card, no card leaves the pool or its van cell', !G.bad.length, G.bad.slice(0, 12).join(' | '));
      rec('G ' + W_ + ': page does not scroll sideways (document width ≤ viewport), even with a 70-letter customer name with no spaces', G.docW <= vw.width, 'document ' + G.docW + ' px wide');
      rec('G ' + W_ + ': no € on any card', !G.euro.length, G.euro.join());
      rec('G ' + W_ + ': every group footer "N jobs · €total" adds up (string "1500", null and junk values)', G.foot.every(f => f.f === f.exp), JSON.stringify(G.foot.filter(f => f.f !== f.exp)));
      const realClip = G.clipped.filter(x => !/^WO-UNBROKEN/.test(x));
      rec('G ' + W_ + ': realistic data — WO number and "Floor BLOCK T09 FLOOR 12" never cut off on a card', !realClip.some(x => /:B:|fu-fl/.test(x)), 'clipped: ' + realClip.join(' | '));
      rec('G ' + W_ + ': realistic data — Unit badge and customer name not cut off (…) on a card', !realClip.length, 'cut off with …: ' + realClip.slice(0, 8).join(' | '));
      rec('G ' + W_ + ': week bar stays on screen and clickable after scrolling down to the van grid', G.sticky.vis && G.sticky.nextHit, JSON.stringify(G.sticky));
      if (vw.width > 1000) rec('G ' + W_ + ' × 768: with a booked van card on screen, a week drop target is on screen too (tabs scroll away; the sticky week bar is not a drop target)', !G.gridCardOnScreen || G.tabOnScreen || G.barDrop, JSON.stringify({ gridCard: G.gridCardOnScreen, tabOnScreen: G.tabOnScreen, weekBarAcceptsDrop: G.barDrop }));
      rec('G ' + W_ + ': pressing Next ▶ while scrolled keeps the bar usable (page does not jump to the top)', G.afterNext.sy > 0, JSON.stringify(G.afterNext));
      rec('G ' + W_ + ': no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
      await t.close();
    }
  }

  // =====================================================================================================================
  // H. Roles: saw / stores / driver / floor / PM can't edit dates or weeks — and where the Production Manager lands
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: {}, orders: [O('WO-R1'), O('WO-R2', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-09', step: '8. PALLETED' })] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const Hh = await p.evaluate(async () => {
      const out = {}; const s0 = __snap();
      for (const r of ['saw', 'stores', 'driver', 'floor', 'pm', 'dash', 'design']) {
        ROLE = r; tab = 'd'; render(); await W(80);
        const app = document.getElementById('app');
        const x = { dqb: app.querySelectorAll('[data-dqb]').length, wk: app.querySelectorAll('[data-wknext],[data-wkpick]').length, dueTags: app.querySelectorAll('.due-tag').length, wkbar: !!document.getElementById('del-wkbar') };
        // forced calls (a stale button / console) must be refused too
        wkMoveDo(['WO-R1'], '2026-11-16'); await W(40); x.ovMove = __ovl().length; __closeAll();
        dqChange('WO-R1', 'due', '2026-11-20', null); await W(40); x.ovQ = __ovl().length; __closeAll();
        wkPickDlg(['WO-R1']); await W(40); x.ovP = __ovl().length; __closeAll();
        out[r] = x;
      }
      out.same = __snap() === s0;
      ROLE = 'prod'; tab = 'd'; render(); await W(80);
      out.prod = { wkbar: !!document.getElementById('del-wkbar'), tabsBar: getComputedStyle(document.querySelector('.tabs')).display, h1: (document.querySelector('#app h1') || {}).textContent || '', dqb: document.querySelectorAll('#app [data-dqb]').length };
      ROLE = 'office'; render();
      return out;
    });
    const ro = ['saw', 'stores', 'driver', 'floor', 'pm', 'dash', 'design'];
    rec('H saw / stores / driver / floor / PM / management / drawing office: no date button, no week buttons, forced moves refused, nothing changed', ro.every(r => !Hh[r].dqb && !Hh[r].wk && !Hh[r].ovMove && !Hh[r].ovQ && !Hh[r].ovP) && Hh.same, JSON.stringify(ro.map(r => r + ':' + JSON.stringify(Hh[r]))));
    rec('H the Production Manager role ("prod") can reach the Deliveries page (week bar, quick date edit) — Garry\'s buy-in user', Hh.prod.wkbar, 'Production Manager screen: "' + Hh.prod.h1 + '", main tabs display=' + Hh.prod.tabsBar + ', week bar=' + Hh.prod.wkbar + ' — dateCanMove() allows "prod" but render() sends prod to renderProd (dashboard) with the tabs hidden, so D1–D3 are only usable signed in as Office');
    await t.close();
  }

  // =====================================================================================================================
  // I. Lists switch ON (listStore v2) — the page, a quick edit and a week move still work; cut detection via the tables
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: { listStore: 'v2', listStoreAt: '2026-10-20T08:00:00Z' }, orders: [O('WO-V2A'), O('WO-V2B', { step: '6. CUT' }), O('WO-V2C', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' })] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const I = await p.evaluate(async () => {
      showTab('d'); await W(200); const out = { v2: V2(), pool: __pool() };
      const i = document.querySelector('.dq-in[data-dq="WO-V2A"][data-f="due"]'); i.value = '2026-11-19'; i.dispatchEvent(new Event('change')); await W(80); await __why('Production'); __closeAll();
      out.a = __g('WO-V2A').dueDate;
      document.querySelector('[data-wknext="WO-V2B"]').click(); await W(60); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); __closeAll();
      out.b = [__g('WO-V2B').dueDate, __g('WO-V2B').plannedWeek, !!__g('WO-V2B').dueMv];
      out.bad = __layout();
      return out;
    });
    rec('I lists switch ON: Deliveries renders, quick edit and → Wk N work, cut job keeps its week', I.v2 && I.a === '2026-11-19' && I.b[0] === '2026-11-19' && I.b[1] === '2026-11-09' && I.b[2] && !I.bad.length, JSON.stringify(I));
    rec('I: no page errors (lists ON)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // J. Old saved data: legacy day-only bookings (no delWk), with and without the legacy-week answer, manual jobs with no planWk
  // =====================================================================================================================
  for (const legacy of [null, '2026-11-02']) {
    const settings = { delx: [{ wo: 'J-OLD', title: 'old manual', manual: true }] };
    if (legacy) { settings.delLegacyWk = legacy; settings.delLegacyAt = '2026-11-03T08:00:00Z'; }
    const row = { id: 'main', nid: 9, settings, orders: [
      { wo: 'WO-OLD1', title: 'Old', customer: 'C', hours: 3, dueDate: '2026-11-12', step: '8. PALLETED', plannedWeek: '2026-11-09', delv: true, delVeh: 'VOLVO', delDay: 'Wed', value: 100 },
      { wo: 'WO-OLD2', title: 'Old no date', customer: 'C', hours: 3, step: '8. PALLETED', delv: true, value: 100 }] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const J = await p.evaluate(async (legacy) => {
      showTab('d'); await W(150); const out = {};
      if (legacy) await __go('-1');
      out.tab = delTab; out.inGrid = !!document.querySelector('.dcell .dchip[data-dw="WO-OLD1"]'); out.legacyQ = !!document.getElementById('del-legacy');
      out.tags = [...document.querySelectorAll('.dchip .due-tag')].map(b => b.textContent);
      await __go('0'); out.pool = __pool();
      // move the legacy booking a week on (ticked → Move ticked to week…)
      delSel.clear(); delSel.add('WO-OLD1'); render(); await W(50); document.getElementById('selwk').click(); await W(50);
      document.querySelector('#wkpick-dlg [data-wkp="2026-11-16"]').click(); await W(50); out.prev = (document.getElementById('wkprev-dlg') || {}).textContent || '';
      const go = document.getElementById('wkp-go'); if (go) go.click(); await W(50); await __why('Production'); __closeAll();
      const o = __g('WO-OLD1'); out.o = { due: o.dueDate, day: o.delDay, rb: o.delRebook };
      return out;
    }, legacy);
    const L = legacy ? 'answered Wk 45' : 'not answered';
    rec('J old data (legacy question ' + L + '): booking shows on the van grid, tags render, manual job without planWk in This week', J.inGrid && J.tags.length >= 1 && J.pool.includes('J-OLD') && J.pool.includes('WO-OLD2') && (legacy ? true : J.legacyQ), JSON.stringify(J).slice(0, 400));
    rec('J old data (' + L + '): week move takes the legacy booking off its van with a readable "was" (no "undefined")', J.o.due === '2026-11-19' && !J.o.day && J.o.rb && !/undefined/.test(JSON.stringify(J.o.rb)) && !/undefined/.test(J.prev), JSON.stringify(J.o) + ' ' + J.prev.slice(0, 200));
    rec('J: no page errors (' + L + ')', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // K. Board red / amber rule: job due Wed in its own planned week
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: {}, orders: [O('WO-WED', { dueDate: '2026-11-11', origDueDate: '2026-11-11', plannedWeek: '2026-11-09' }), O('WO-FRI', { dueDate: '2026-11-13', origDueDate: '2026-11-13', plannedWeek: '2026-11-09' }), O('WO-NXT', { dueDate: '2026-11-18', origDueDate: '2026-11-18', plannedWeek: '2026-11-16' })] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const K = await p.evaluate(async () => {
      const tag = (sel) => { const b = document.querySelector(sel); return b ? b.className.replace('due-tag', '').trim() + ':' + b.textContent : ''; };
      showTab('b'); await W(150); const b = ['WO-WED', 'WO-FRI', 'WO-NXT'].map(w => tag('tr[data-wo="' + w + '"] .due-tag'));
      showTab('d'); await W(150); const d = ['WO-WED', 'WO-FRI'].map(w => tag('.dchip[data-dw="' + w + '"] .due-tag'));
      await __go('1'); d.push(tag('.dchip[data-dw="WO-NXT"] .due-tag'));
      return { b, d };
    });
    rec('K job due Wed 11 Nov built in its own week (Wk 46): board and Deliveries card show the SAME colour', K.b[0].split(':')[0] === K.d[0].split(':')[0], 'board ' + K.b.join(' | ') + ' vs cards ' + K.d.join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // L. Injection: WO / title / customer with markup, quotes and apostrophes through the new tag, buttons, picker, preview, toast
  // =====================================================================================================================
  {
    const evil = 'WO-"><img src=x onerror=window.__x1=1>';
    const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'J-<img src=x onerror=window.__x4=1>', title: '<svg onload=window.__x5=1>', customer: "O'Grady", value: 1, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
      O(evil, { title: '<img src=x onerror=window.__x2=1>', customer: "O'Grady & Sons <b>bold</b> 😀", floor: '<i>F</i>', unit: '"U"' }),
      O("WO-O'GRADY", { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09', title: 'Fitted kitchen — O\'Grady\'s "Type A"' }) ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const L = await p.evaluate(async (evil) => {
      showTab('d'); await W(150);
      const out = {};
      const cards = [...document.querySelectorAll('.dchip')].map(c => c.dataset.dw);
      out.cards = cards;
      const b = [...document.querySelectorAll('[data-wkpick]')].find(x => x.dataset.wkpick === evil); if (b) { b.click(); await W(60); document.querySelector('#wkpick-dlg [data-wkp="2026-11-16"]').click(); await W(60); await __why('Production'); __closeAll(); }
      out.moved = (__g(evil) || {}).dueDate;
      const q = [...document.querySelectorAll('.dq-in')].find(x => x.dataset.dq === "WO-O'GRADY"); if (q) { q.value = '2026-11-20'; q.dispatchEvent(new Event('change')); await W(60); out.sub = __ovl().join(); await __why('Production'); }
      out.sum = __ovl().join(); __closeAll();
      out.o = __g("WO-O'GRADY").dueDate;
      delSel.clear(); cards.forEach(c => delSel.add(c)); render(); await W(60); document.getElementById('selwk').click(); await W(60); document.querySelector('#wkpick-dlg [data-wkp="2026-11-30"]').click(); await W(60);
      const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); __closeAll();
      showTab('b'); await W(120); showTab('d'); await W(100);
      out.x = [window.__x1, window.__x2, window.__x3, window.__x4, window.__x5];
      return out;
    }, evil);
    rec('L markup / quotes / apostrophes / emoji in WO, title, customer, Floor, Unit: no script runs anywhere (cards, picker, preview, reason, summary, board)', L.x.every(v => v === undefined), JSON.stringify(L.x));
    rec('L the job with a quote and markup in its WO can be moved by its own button; O\'Grady quick edit works', L.moved === '2026-11-19' && L.o === '2026-11-20', JSON.stringify([L.moved, L.o]));
    rec('L: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  await browser.close();
  const f = res.filter(x => !x.ok);
  console.log('\nattack4-usability: ' + (res.length - f.length) + ' passed, ' + f.length + ' failed');
  process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
