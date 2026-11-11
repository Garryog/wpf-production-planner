// Tester attack round 5 (11 Nov 2026): the 5 carried-over round-4 fixes on feature/dates-deliveries —
//   22b2b1d Production Manager 🚚 Deliveries button · c9aded6 Move ticked to week… counts / hidden on-hold / booked manual ·
//   29457dd sticky week bar = drop target (◀ Prev / label / Next ▶), past weeks never lit · 94d2396 one colour rule + "⚠ built after due" chip ·
//   74ca5f0 360 px wraps (group heading, Floor / Unit badges, customer 2 lines).
// Real mouse drags (Playwright dragTo / page.mouse), lists switch OFF and ON, Irish time edges (Sunday night, Monday 00:30, summer time,
// bank-holiday Mondays), two PCs, every role, 360 / 1366 px. Stubbed Supabase only (tests/harness.js + tests/stage1/srv.js).
// Run: node tests/dates/attack5-carryover.test.js
const H = require('../harness');
const { makeServer, open: openS } = require('../stage1/srv');
const { execSync } = require('child_process');
const path = require('path');
const res = [];
const rec = (n, ok, d) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 700) : '')); };
const NOW = '2026-11-10T10:00:00Z'; // Tue 10 Nov 2026, Wk 46
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));

const HELP = `(()=>{
  window.W=ms=>new Promise(r=>setTimeout(r,ms));
  window.__go=async t=>{const b=document.querySelector('[data-deltab="'+t+'"]');if(b)b.click();else{delTab=String(t);render();}await W(80);};
  window.__why=async k=>{const b=document.querySelector('.pod-ovl [data-why="'+(k||'Customer delay')+'"]');const s=b?b.closest('.pod-in').textContent:'';if(b)b.click();await W(100);return s;};
  window.__ovl=()=>[...document.querySelectorAll('.pod-ovl')].map(o=>(o.id||'')+':'+o.textContent.replace(/\\s+/g,' ').trim().slice(0,500));
  window.__closeAll=()=>document.querySelectorAll('.pod-ovl').forEach(o=>o.remove());
  window.__snap=()=>JSON.stringify({o:DB.orders,x:DB.delx||[]});
  window.__g=w=>DB.orders.find(o=>o.wo===w);
  window.__gx=w=>(DB.delx||[]).find(o=>o.wo===w);
  window.__after=()=>({body:document.body.className,lit:document.querySelectorAll('.dragover').length,dl:delDragList});
  window.__toast=()=>(document.getElementById('toast')||{}).textContent||'';
  window.__lbl=()=>delTab+'='+document.getElementById('wkb-lbl').textContent.replace(/\\s+/g,' ').trim();
  window.__layout=()=>{const bad=[];const R=e=>e.getBoundingClientRect();
    const vis=e=>e.offsetParent!==null&&getComputedStyle(e).visibility!=='hidden';
    document.querySelectorAll('.dchip').forEach(c=>{if(!vis(c))return;const r=R(c);
      const box=c.closest('.dcell')||c.closest('#dpool');if(box){const b=R(box);if(r.left<b.left-1||r.right>b.right+1)bad.push(c.dataset.dw+' card outside its '+(c.closest('.dcell')?'van cell':'pool')+' ('+Math.round(r.left)+'-'+Math.round(r.right)+' vs '+Math.round(b.left)+'-'+Math.round(b.right)+')');}
      c.querySelectorAll('*').forEach(e=>{if(e.classList.contains('dq-in')||!vis(e))return;const q=R(e);if(q.width&&(q.right>r.right+1||q.left<r.left-1))bad.push(c.dataset.dw+':'+(e.className||e.tagName)+' spills '+Math.round(q.right-r.right)+'px');
        if(q.height&&q.bottom>r.bottom+1)bad.push(c.dataset.dw+':'+(e.className||e.tagName)+' below card');});});
    const cs=[...document.querySelectorAll('.dchip')].filter(vis).map(c=>[c.dataset.dw,R(c)]);
    for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){const a=cs[i][1],b=cs[j][1];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)bad.push('overlap '+cs[i][0]+'/'+cs[j][0]);}
    return bad;};
  window.__lines=e=>{if(!e)return 0;const lh=parseFloat(getComputedStyle(e).lineHeight)||(parseFloat(getComputedStyle(e).fontSize)*1.2);return Math.round(e.getBoundingClientRect().height/lh);};
})()`;
const prep = async t => { await t.page.evaluate(HELP); return t.page; };
// hold a real drag over an element (mouse down on the card, move in steps), return what is lit, then let go
async function holdOver(p, srcSel, tgtSel, fn) {
  await p.locator(srcSel).scrollIntoViewIfNeeded();
  await p.locator(srcSel).hover(); await p.mouse.down();
  const b = await p.locator(tgtSel).boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await p.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2 + 1, { steps: 3 });
  const seen = fn ? await p.evaluate(fn) : null;
  await p.mouse.up(); await p.waitForTimeout(150);
  return seen;
}
const LIT = () => ({ prev: document.getElementById('wkb-prev').className, next: document.getElementById('wkb-next').className, lbl: document.getElementById('wkb-lbl').className,
  prevOutline: getComputedStyle(document.getElementById('wkb-prev')).outlineStyle, nextOutline: getComputedStyle(document.getElementById('wkb-next')).outlineStyle, lblOutline: getComputedStyle(document.getElementById('wkb-lbl')).outlineStyle,
  body: document.body.className, prevDis: document.getElementById('wkb-prev').disabled, nextDis: document.getElementById('wkb-next').disabled });

(async () => {
  const browser = await H.chromium.launch();

  // =====================================================================================================================
  // A. Week bar drops with REAL mouse drags (lists switch OFF, then ON) at 1366 × 900
  // =====================================================================================================================
  for (const listsOn of [false, true]) {
    const tag = listsOn ? ' [lists ON]' : ' [lists OFF]';
    const settings = listsOn ? { listStore: 'v2', listStoreAt: '2026-10-20T08:00:00Z' } : {};
    const row = { id: 'main', nid: 9, settings, orders: [
      O('WO-P1'), O('WO-P2', { dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16' }), O('WO-P3'),
      O('WO-X', { dueDate: '2026-11-03', origDueDate: '2026-11-03', plannedWeek: '2026-11-02', delVeh: 'RENAULT', delDay: 'Tue', delWk: '2026-11-02' }), // keeps Wk 45 open (a past week)
      O('WO-LATE', { dueDate: '2026-12-16', origDueDate: '2026-12-16', plannedWeek: '' }),
      O('WO-LATE2', { dueDate: '2026-12-17', origDueDate: '2026-12-17', plannedWeek: '' }),
      O('WO-FAR', { dueDate: '2027-03-02', origDueDate: '2027-03-02', plannedWeek: '', delVeh: 'VOLVO', delDay: 'Tue', delWk: '2027-03-01' }), // +16
      O('WO-FAR2', { dueDate: '2027-03-30', origDueDate: '2027-03-30', plannedWeek: '', delVeh: 'VOLVO', delDay: 'Tue', delWk: '2027-03-29' }), // +20
    ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    await p.evaluate(async () => { showTab('d'); await W(150); });
    // A1 This week: pool card onto Next ▶ (lit while over it) → Wk 47
    const l1 = await holdOver(p, '.dchip[data-dw="WO-P1"] .dchip-t', '#wkb-next', LIT);
    const a1 = await p.evaluate(async () => { const ov = __ovl(); const s = await __why('Customer delay'); __closeAll(); const o = __g('WO-P1'); return { ov: ov.join().slice(0, 200), due: o.dueDate, wk: o.plannedWeek, h: (o.dueHist || []).length, ...__after(), tab: delTab }; });
    rec('A1' + tag + ' real drag onto Next ▶ (This week) → asks why → Thu 12 → Thu 19 Nov, build week Wk 47; Next lit while over it', a1.due === '2026-11-19' && a1.wk === '2026-11-16' && a1.h === 1 && /dragover/.test(l1.next) && l1.nextOutline !== 'none', JSON.stringify({ l1, a1 }));
    rec('A1b' + tag + ' after a drop on the week bar nothing stays lit (no del-dragging, no .dragover, drag list empty)', !/del-dragging/.test(a1.body) && !a1.lit && a1.dl === null, JSON.stringify(a1));
    // A2 This week: Prev = Wk 45 (open past week) — not outlined, not lit, drop refused with a toast, nothing changes
    const s2 = await p.evaluate(() => __snap());
    const l2 = await holdOver(p, '.dchip[data-dw="WO-P3"] .dchip-t', '#wkb-prev', LIT);
    const a2 = await p.evaluate(() => ({ same: __snap(), ov: __ovl(), toast: __toast(), ...__after() }));
    rec('A2' + tag + ' Prev (= past Wk 45) while dragging: not outlined, not lit', !/dragover/.test(l2.prev) && l2.prevOutline === 'none' && /nodrop/.test(l2.prev), JSON.stringify(l2));
    rec('A2b' + tag + ' drop on Prev (past Wk 45) is refused with a message, nothing changes, nothing left lit', a2.same === s2 && !a2.ov.length && /has gone/.test(a2.toast) && !/del-dragging/.test(a2.body) && !a2.lit, JSON.stringify({ toast: a2.toast, ov: a2.ov, body: a2.body, lit: a2.lit }));
    // A3 Wk 47 shown: Prev = This week → P2 Thu 19 → Thu 12
    await p.evaluate(async () => { await __go('1'); __closeAll(); });
    await p.locator('.dchip[data-dw="WO-P2"] .dchip-t').dragTo(p.locator('#wkb-prev'));
    await p.waitForTimeout(150);
    const a3 = await p.evaluate(async () => { await __why('Production'); __closeAll(); const o = __g('WO-P2'); return { due: o.dueDate, wk: o.plannedWeek, tab: delTab }; });
    rec('A3' + tag + ' Wk 47 shown: drop on ◀ Prev → This week (Thu 19 → Thu 12 Nov)', a3.due === '2026-11-12' && a3.wk === '2026-11-09', JSON.stringify(a3));
    // A4 label = shown week: tick P2 (now This week), show Wk 47, drag P1 (on Wk 47, ticked too) onto the label → P2 comes to Wk 47, P1 "already"
    await p.evaluate(async () => { delSel.clear(); delSel.add('WO-P2'); delSel.add('WO-P1'); await __go('1'); });
    await p.locator('.dchip[data-dw="WO-P1"] .dchip-t').dragTo(p.locator('#wkb-lbl'));
    await p.waitForTimeout(150);
    const a4 = await p.evaluate(async () => { const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); const s = await __why('Materials'); const sum = __ovl().join(); __closeAll(); return { s: s.slice(0, 160), sum: sum.slice(0, 300), p1: __g('WO-P1').dueDate, p2: __g('WO-P2').dueDate }; });
    rec('A4' + tag + ' drop on the week LABEL (Wk 47 shown) = the shown week: the ticked card from This week comes to Wk 47, the one already there stays', a4.p2 === '2026-11-19' && a4.p1 === '2026-11-19', JSON.stringify(a4));
    // A5 Later: label → picker at +4; Next greyed and a drop on it does nothing; Prev = +12
    await p.evaluate(async () => { delSel.clear(); await __go('later'); });
    const st5 = await p.evaluate(() => ({ lbl: __lbl(), nextDis: document.getElementById('wkb-next').disabled }));
    await p.locator('.dchip[data-dw="WO-LATE"] .dchip-t').dragTo(p.locator('#wkb-lbl'));
    await p.waitForTimeout(150);
    const a5 = await p.evaluate(() => { const pre = document.querySelector('#wkpick-dlg .rbtn.pre'); const r = { open: !!document.getElementById('wkpick-dlg'), pre: pre ? pre.dataset.wkp : null, title: ((document.querySelector('#wkpick-dlg .pod-in > div') || {}).textContent || '') }; __closeAll(); return r; });
    rec('A5' + tag + ' Later: drop on the label → week picker with This week +4 (Wk 50 · Mon 7 Dec) chosen', a5.open && a5.pre === '2026-12-07', JSON.stringify({ st5, a5 }));
    const s5 = await p.evaluate(() => __snap());
    const l5 = await holdOver(p, '.dchip[data-dw="WO-LATE"] .dchip-t', '#wkb-next', LIT);
    const a5b = await p.evaluate(() => ({ same: __snap(), ov: __ovl(), ...__after() }));
    rec('A5b' + tag + ' Later: Next ▶ is greyed, not lit while dragging, a drop on it does nothing', st5.nextDis && !/dragover/.test(l5.next) && l5.nextOutline === 'none' && a5b.same === s5 && !a5b.ov.length && !/del-dragging/.test(a5b.body), JSON.stringify({ l5, a5b: { ov: a5b.ov, body: a5b.body, same: a5b.same === s5 } }));
    await p.locator('.dchip[data-dw="WO-LATE2"] .dchip-t').dragTo(p.locator('#wkb-prev'));
    await p.waitForTimeout(150);
    const a5c = await p.evaluate(async () => { const ov = __ovl().join(); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); __closeAll(); const o = __g('WO-LATE2'); return { ov: ov.slice(0, 200), due: o.dueDate }; });
    rec('A5c' + tag + ' Later: drop on ◀ Prev (= +12, Wk 6 2027) → Thu 17 Dec → Thu 4 Feb 2027', a5c.due === '2027-02-04', JSON.stringify(a5c));
    // A6 a booked week beyond +12: tab +16 (WO-FAR), Prev = +12, Next = the next booked far week (+20); from +20 Next = Later
    await p.evaluate(async () => { await __go('16'); });
    const st6 = await p.evaluate(() => ({ lbl: __lbl(), cards: [...document.querySelectorAll('.dcell .dchip')].map(c => c.dataset.dw) }));
    // label drop of a ticked This-week card while showing +16
    await p.evaluate(async () => { delSel.clear(); delSel.add('WO-P3'); delSel.add('WO-FAR'); render(); await W(60); });
    await p.locator('.dcell .dchip[data-dw="WO-FAR"] .dchip-t').dragTo(p.locator('#wkb-lbl'));
    await p.waitForTimeout(150);
    const a6 = await p.evaluate(async () => { const ov = __ovl().join(); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); const sum = __ovl().join(); __closeAll(); return { ov: ov.slice(0, 300), sum: sum.slice(0, 300), p3: __g('WO-P3').dueDate, far: __g('WO-FAR').dueDate, farDay: __g('WO-FAR').delDay, tab: delTab }; });
    rec('A6' + tag + ' showing booked Wk 9 2027 (+16): label drop brings a ticked This-week card to that week (Thu 12 Nov → Thu 4 Mar 2027); the booked card stays on its van', a6.p3 === '2027-03-04' && a6.far === '2027-03-02' && a6.farDay === 'Tue', JSON.stringify({ st6, a6 }));
    // from +20: Next = Later → a drop there opens the picker preset to +4 (Wk 50) — EARLIER than where the card is
    await p.evaluate(async () => { delSel.clear(); await __go('20'); });
    const st6b = await p.evaluate(() => ({ lbl: __lbl(), nextDis: document.getElementById('wkb-next').disabled }));
    await p.locator('.dcell .dchip[data-dw="WO-FAR2"] .dchip-t').dragTo(p.locator('#wkb-next'));
    await p.waitForTimeout(150);
    const a6b = await p.evaluate(() => { const pre = document.querySelector('#wkpick-dlg .rbtn.pre'); const r = { open: !!document.getElementById('wkpick-dlg'), pre: pre ? pre.dataset.wkp : null }; __closeAll(); return r; });
    rec('A6b' + tag + ' showing booked Wk 13 2027 (+20): a drop on Next ▶ (= Later) does not pre-pick a week 16 weeks EARLIER than the card (Wk 50) as if it were "the week after"', !(a6b.open && a6b.pre && a6b.pre < '2027-03-29'), JSON.stringify({ st6b, a6b }) + ' — Next ▶ means "the week after", but the drop opens the Later picker with Wk 50 (7 Dec) already chosen; the picker only lists This week … +12, so "the week after Wk 13 2027" is not offered at all');
    // A7 drag onto Prev on a far tab = +12
    await p.evaluate(async () => { await __go('20'); });
    await p.locator('.dcell .dchip[data-dw="WO-FAR2"] .dchip-t').dragTo(p.locator('#wkb-prev'));
    await p.waitForTimeout(150);
    const a7 = await p.evaluate(async () => { const pv = (document.getElementById('wkprev-dlg') || {}).textContent || ''; const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); __closeAll(); const o = __g('WO-FAR2'); return { pv: pv.replace(/\s+/g, ' ').slice(0, 200), due: o.dueDate, day: o.delDay || '', rb: !!o.delRebook }; });
    rec('A7' + tag + ' showing +20: drop on ◀ Prev = the booked week before it (+16, Wk 9 2027) → off its van, Tue 2 Mar, rebook', a7.due === '2027-03-02' && a7.day === '' && a7.rb, JSON.stringify(a7));
    // A8 a cancelled drag over the bar (released outside the window area: back on the card's own spot) — nothing lit, nothing armed
    await p.evaluate(async () => { delSel.clear(); await __go('1'); });
    {
      await p.locator('.dchip .dchip-t').first().hover(); await p.mouse.down();
      const nb = await p.locator('#wkb-next').boundingBox(); await p.mouse.move(nb.x + 5, nb.y + 5, { steps: 6 });
      const hd = await p.locator('#del-wkh').boundingBox(); await p.mouse.move(hd.x + 20, hd.y + 4, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(120);
    }
    const a8 = await p.evaluate(() => ({ ...__after(), ov: __ovl() }));
    rec('A8' + tag + ' drag over Next ▶ then let go elsewhere: Next stops glowing, nothing in hand, nothing opens', !a8.lit && a8.dl === null && !/del-dragging/.test(a8.body) && !a8.ov.length, JSON.stringify(a8));
    rec('A' + tag + ': no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // A9. 1366 × 768: a booked card low in the van grid (Smart Movers, last row) → Next ▶ on the sticky bar without scrolling up
  {
    const orders = [O('WO-LOW', { delVeh: 'SMART', delDay: 'Fri', delWk: '2026-11-09', dueDate: '2026-11-13', origDueDate: '2026-11-13' })];
    for (let i = 0; i < 14; i++) orders.push(O('WO-F' + i, { dueDate: '2026-11-1' + (2 + (i % 2)) }));
    const t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 9, settings: {}, orders }, viewport: { width: 1366, height: 768 } });
    const p = await prep(t);
    await p.evaluate(async () => { showTab('d'); await W(150); });
    await p.locator('.dcell .dchip[data-dw="WO-LOW"]').scrollIntoViewIfNeeded();
    const pos = await p.evaluate(() => { const c = document.querySelector('.dcell .dchip[data-dw="WO-LOW"]').getBoundingClientRect(), b = document.getElementById('del-wkbar').getBoundingClientRect(); const tabs = [...document.querySelectorAll('[data-deltab]')].some(x => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }); return { card: [Math.round(c.top), Math.round(c.bottom)], bar: [Math.round(b.top), Math.round(b.bottom)], sy: Math.round(scrollY), tabsOnScreen: tabs }; });
    const l9 = await holdOver(p, '.dcell .dchip[data-dw="WO-LOW"] .dchip-t', '#wkb-next', LIT);
    const a9 = await p.evaluate(async () => { const pv = (document.getElementById('wkprev-dlg') || {}).textContent || ''; const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Site not ready'); __closeAll(); const o = __g('WO-LOW'); return { pv: pv.replace(/\s+/g, ' ').slice(0, 200), due: o.dueDate, day: o.delDay || '', veh: o.delVeh || '', rb: !!o.delRebook, ...__after() }; });
    rec('A9 1366×768: booked Smart Movers Fri card low in the grid, scrolled down (tabs off screen), dragged onto the sticky Next ▶ → off its van, Fri 20 Nov, rebook', pos.bar[0] >= 0 && pos.card[1] <= 768 && /dragover/.test(l9.next) && a9.due === '2026-11-20' && a9.day === '' && a9.rb, JSON.stringify({ pos, l9: l9.next, a9 }));
    rec('A9b the preview says the job comes off its van before it moves', /Comes off Smart Movers Fri/i.test(a9.pv), a9.pv);
    rec('A9: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }

  // =====================================================================================================================
  // B. Production Manager 🚚 Deliveries button (lists OFF and ON); every other role unchanged vs the code before the carry-over
  // =====================================================================================================================
  for (const listsOn of [false, true]) {
    const tag = listsOn ? ' [lists ON]' : ' [lists OFF]';
    const settings = listsOn ? { listStore: 'v2', listStoreAt: '2026-10-20T08:00:00Z' } : {};
    const row = { id: 'main', nid: 9, settings, orders: [O('WO-R1'), O('WO-R2'), O('WO-R3', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' })] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const B = await p.evaluate(async () => {
      const out = {};
      ls.set('wpfPin_prod', pins().prod); ROLE = 'prod'; prodTab = 'today'; render(); await W(120);
      const strip = () => [...document.querySelectorAll('#prod-strip [data-prodtab]')].map(b => b.dataset.prodtab + (b.style.background.includes('20, 51, 92') || /14335c/i.test(b.getAttribute('style')) && /background:#14335c/i.test(b.getAttribute('style')) ? '*' : ''));
      out.home = { strip: strip(), wkbar: !!document.getElementById('del-wkbar'), h1: (document.querySelector('#app h1') || {}).textContent || '', nStrip: document.querySelectorAll('#prod-strip').length };
      document.querySelector('[data-prodtab="deliv"]').click(); await W(150);
      out.del = { strip: strip(), wkbar: !!document.getElementById('del-wkbar'), dqb: document.querySelectorAll('#app [data-dqb]').length, wkn: document.querySelectorAll('#app [data-wknext]').length, nStrip: document.querySelectorAll('#prod-strip').length, stripFirst: document.getElementById('app').firstElementChild.id };
      // → Wk 47 on a card
      document.querySelector('[data-wknext="WO-R1"]').click(); await W(80); await __why('Production'); __closeAll();
      out.r1 = __g('WO-R1').dueDate; out.r1by = ((__g('WO-R1').dueHist || [])[0] || {}).by;
      // quick date edit
      const i = document.querySelector('.dq-in[data-dq="WO-R2"][data-f="due"]'); i.value = '2026-11-20'; i.dispatchEvent(new Event('change')); await W(80); await __why('Production'); __closeAll();
      out.r2 = __g('WO-R2').dueDate;
      out.stillDeliv = prodTab + '/' + !!document.getElementById('del-wkbar');
      // a refresh from the cloud (poll) while he is on Deliveries
      await loadDB(); await W(120); out.afterPoll = prodTab + '/' + !!document.getElementById('del-wkbar') + '/' + document.querySelectorAll('#prod-strip').length;
      // Prev / Next work for him
      document.getElementById('wkb-next').click(); await W(80); out.next = __lbl();
      document.getElementById('wkb-today').click(); await W(80);
      return out;
    });
    // real drag: book a van as the Production Manager, and drop on the week bar
    await p.locator('.dchip[data-dw="WO-R2"] .dchip-t').count().then(async n => { if (!n) await p.evaluate(async () => { await __go('1'); }); });
    await p.locator('.dchip[data-dw="WO-R2"] .dchip-t').dragTo(p.locator('.dcell[data-cell^="IVECO|Thu|"]'));
    await p.waitForTimeout(150);
    const B2 = await p.evaluate(async () => { const ov = __ovl().join(); if (document.querySelector('.pod-ovl [data-why]')) await __why('Production'); __closeAll(); const o = __g('WO-R2'); return { ov: ov.slice(0, 200), veh: o.delVeh, day: o.delDay, wk: o.delWk }; });
    await p.evaluate(async () => { await __go('0'); });
    const pdrag = await p.locator('.dcell .dchip[data-dw="WO-R3"] .dchip-t').count();
    if (pdrag) { await p.locator('.dcell .dchip[data-dw="WO-R3"] .dchip-t').dragTo(p.locator('#wkb-next')); await p.waitForTimeout(150); }
    const B3 = await p.evaluate(async () => { const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); __closeAll(); const o = __g('WO-R3'); const r = { due: o.dueDate, day: o.delDay || '', rb: !!o.delRebook }; document.querySelector('[data-prodtab="today"]').click(); await W(120); r.back = { wkbar: !!document.getElementById('del-wkbar'), prodTab, h1: (document.querySelector('#app h1') || {}).textContent || '' }; ROLE = 'office'; render(); return r; });
    const expStrip = listsOn ? ['today', 'deliv', 'lists', 'snags'] : ['today', 'deliv'];
    rec('B1' + tag + ' Production Manager home is still 🧭 Today; strip = ' + expStrip.join(' · ') + '; no week bar on his home', !B.home.wkbar && B.home.strip.map(x => x.replace('*', '')).join() === expStrip.join() && /^today\*/.test(B.home.strip[0]) && B.home.nStrip === 1, JSON.stringify(B.home));
    rec('B2' + tag + ' 🚚 Deliveries: full page (week bar, date tags, → Wk buttons), the strip shown once at the top with Deliveries selected', B.del.wkbar && B.del.dqb > 0 && B.del.wkn > 0 && B.del.nStrip === 1 && B.del.stripFirst === 'prod-strip' && /^deliv\*/.test(B.del.strip[1]), JSON.stringify(B.del));
    rec('B3' + tag + ' he can move dates (→ Wk 47 and the quick date edit), recorded with his name', B.r1 === '2026-11-19' && B.r2 === '2026-11-20' && B.r1by === 'Tester', JSON.stringify([B.r1, B.r1by, B.r2]));
    rec('B4' + tag + ' a cloud refresh while he is on Deliveries keeps him there (one strip, week bar)', B.afterPoll === 'deliv/true/1', B.afterPoll);
    rec('B5' + tag + ' he can book a van by dragging a card onto a van cell (real drag)', B2.veh === 'IVECO' && B2.day === 'Thu', JSON.stringify(B2));
    rec('B6' + tag + ' a real drag of a booked card onto Next ▶ works for him too (off the van, rebook)', pdrag && B3.due === '2026-11-19' && B3.day === '' && B3.rb, JSON.stringify(B3));
    rec('B7' + tag + ' 🧭 Today takes him back to his dashboard', !B3.back.wkbar && B3.back.prodTab === 'today', JSON.stringify(B3.back));
    rec('B' + tag + ': no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  // B8 every other role: the screen text is the same as on the code before the carry-over (ea990d4), lists OFF and ON
  {
    const ROOT = path.resolve(__dirname, '..', '..');
    let oldHtml = '';
    try { oldHtml = execSync('git show ea990d4:index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (e) { oldHtml = ''; }
    const roles = ['pm', 'dash', 'design', 'saw', 'stores', 'driver', 'floor', 'prod'];
    const grab = async (html, settings) => {
      const row = { id: 'main', nid: 9, settings, orders: [O('WO-R1'), O('WO-R2', { step: '6. CUT' }), O('WO-R3', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09', step: '8. PALLETED' })] };
      const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
      if (html) {
        await t.page.unroute('**/*');
        await t.page.route('**/*', route => { const u = route.request().url(), m = route.request().method();
          if (u.startsWith('https://wpf.test/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
          if (u.includes('xlsx.full.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: require('fs').readFileSync(path.join(ROOT, 'xlsx.full.min.js'), 'utf8') });
          if (u.includes('supabase.co')) { if (m === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('id=eq.main') ? [row] : []) }); return route.fulfill({ status: 204, body: '' }); }
          return route.fulfill({ status: 404, body: '' }); });
        await t.page.reload(); await t.page.waitForFunction(() => typeof analyzeImport === 'function'); await t.page.waitForTimeout(300);
      }
      const out = await t.page.evaluate(async roles => { const W = ms => new Promise(r => setTimeout(r, ms)); const o = {};
        for (const r of roles) { ls.set('wpfPin_' + r, pins()[r]); ROLE = r; render(); await W(100); o[r] = document.getElementById('app').innerText.replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'hh:mm').replace(/📦 Items sent/g, '').replace(/\s+/g, ' ').trim(); }
        ROLE = 'office'; render(); return o; }, roles);
      await t.close(); return out;
    };
    for (const listsOn of [false, true]) {
      const settings = listsOn ? { listStore: 'v2', listStoreAt: '2026-10-20T08:00:00Z' } : {};
      const tag = listsOn ? ' [lists ON]' : ' [lists OFF]';
      if (!oldHtml) { rec('B8' + tag + ' roles unchanged (could not read ea990d4:index.html)', false); continue; }
      const now_ = await grab(null, settings), old = await grab(oldHtml, settings);
      const diff = roles.filter(r => r !== 'prod' && now_[r] !== old[r]);
      rec('B8' + tag + ' PM / management / drawing office / saw / stores / driver / floor screens identical to before the carry-over', !diff.length, diff.map(r => r + ': OLD "' + old[r].slice(0, 120) + '" NEW "' + now_[r].slice(0, 120) + '"').join(' || '));
      const pOld = old.prod, pNew = now_.prod, pre = listsOn ? '' : '🧭 Today 🚚 Deliveries ';
      const strip = listsOn ? pNew.replace('🧭 Today 🚚 Deliveries 📋 Lists', '🧭 Today 📋 Lists') : pNew;
      rec('B9' + tag + ' Production Manager Today screen = the old one + only the "🧭 Today 🚚 Deliveries" buttons', listsOn ? strip === pOld : pNew === pre + pOld, 'OLD "' + pOld.slice(0, 160) + '" NEW "' + pNew.slice(0, 160) + '"');
    }
  }

  // =====================================================================================================================
  // C. "⚠ built after due" chip + one colour rule: board row vs delivery card at Irish time edges
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-MV', { dueDate: '2026-11-18', origDueDate: '2026-11-11', plannedWeek: '2026-11-23', delivDate: '2026-11-20', dueHist: [{ at: '2026-11-09T10:00:00Z', by: 'Ann', f: 'due', from: '2026-11-11', to: '2026-11-18', why: 'Customer delay' }] }),
      O('WO-FRI', { dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16' }), // Fri of its own build week: not "after"
      O('WO-OK', { dueDate: '2026-11-26', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', dueHist: [{ at: '2026-11-09T10:00:00Z', by: 'Ann', f: 'due', from: '2026-11-19', to: '2026-11-26', why: 'x' }] }),
    ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const C = await p.evaluate(async () => {
      showTab('b'); await W(200); const out = {};
      const cell = wo => { const tr = document.querySelector('tr[data-wo="' + wo + '"]'); if (!tr) return null; const td = tr.querySelector('.due-tag').closest('td'); const tg = td.querySelector('.due-tag');
        const chips = [...td.querySelectorAll('.dm-chip')].map(c => c.textContent); const r = td.getBoundingClientRect();
        const spill = [...td.querySelectorAll('*')].filter(e => e.offsetParent && !e.classList.contains('dq-in')).some(e => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); });
        return { cls: tg.className.replace('due-tag', '').trim(), txt: tg.textContent, chips, late: /built after due/.test(td.textContent), orig: (td.querySelector('.due-orig') || {}).textContent || '', deliv: [...td.querySelectorAll('.due-tag')].map(x => x.textContent).filter(x => /🚚/.test(x)), spill, lateTitle: ([...td.querySelectorAll('.dm-chip')].find(c => /built after due/.test(c.textContent)) || {}).title || '' }; };
      out.mv = cell('WO-MV'); out.fri = cell('WO-FRI'); out.ok = cell('WO-OK');
      showTab('d'); await W(150); await __go('1');
      const card = wo => { const c = document.querySelector('.dchip[data-dw="' + wo + '"]'); if (!c) return null; const tg = c.querySelector('.due-tag'); return { cls: tg.className.replace('due-tag', '').trim(), txt: tg.textContent, late: /built after due/.test(c.textContent), deliv: [...c.querySelectorAll('.due-tag')].map(x => x.textContent).filter(x => /🚚/.test(x)) }; };
      out.cmv = card('WO-MV'); out.cfri = card('WO-FRI');
      await __go('2'); out.cok = card('WO-OK');
      return out;
    });
    rec('C1 moved job planned after its due date: board row shows "⚠ built after due" + "(orig 11 Nov Wk 46)" + the 🚚 delivery tag, nothing spills out of the cell', C.mv && C.mv.late && /orig 11 Nov Wk 46/.test(C.mv.orig) && C.mv.deliv.length === 1 && /Fri 20 Nov/.test(C.mv.deliv[0]) && !C.mv.spill, JSON.stringify(C.mv));
    rec('C2 the chip explains itself (tooltip names the planned week and the due date)', C.mv && /Wk 48/.test(C.mv.lateTitle) && /18/.test(C.mv.lateTitle), C.mv && C.mv.lateTitle);
    rec('C3 board row and delivery card: same tag text and colour for the moved job (grey, next week) — chip only on the board', C.mv && C.cmv && C.mv.cls === C.cmv.cls && C.mv.cls === 'grey' && C.mv.txt === C.cmv.txt && C.mv.deliv[0] === C.cmv.deliv[0], JSON.stringify([C.mv && C.mv.cls, C.cmv]));
    rec('C4 due on the Friday of its own build week: no "built after due"; job planned before its due week: no chip', C.fri && !C.fri.late && C.ok && !C.ok.late && C.fri.cls === (C.cfri || {}).cls && C.ok.cls === (C.cok || {}).cls, JSON.stringify([C.fri, C.cfri, C.ok, C.cok]));
    rec('C: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  // C5. Colour at the week edge, Irish time: Sunday 23:30 vs Monday 00:30 (winter and summer), bank-holiday Mondays (1 Jun, 26 Oct)
  {
    const isoAdd = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const monOf = iso => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
    const cases = [
      { name: 'Sun 15 Nov 23:30 (winter)', now: '2026-11-15T23:30:00Z', today: '2026-11-15' },
      { name: 'Mon 16 Nov 00:30 (winter)', now: '2026-11-16T00:30:00Z', today: '2026-11-16' },
      { name: 'Sun 31 May 23:30 IST (summer)', now: '2026-05-31T22:30:00Z', today: '2026-05-31' },
      { name: 'Mon 1 Jun 00:30 IST — June bank holiday', now: '2026-05-31T23:30:00Z', today: '2026-06-01' },
      { name: 'Mon 26 Oct 00:30 — October bank holiday, day after clocks went back', now: '2026-10-26T00:30:00Z', today: '2026-10-26' },
    ];
    for (const c of cases) {
      const dues = []; for (let k = -2; k <= 8; k++) dues.push(isoAdd(c.today, k));
      const orders = dues.map((d, i) => O('WO-C' + i, { dueDate: d, origDueDate: d, plannedWeek: monOf(d) }));
      const exp = dues.map(d => d < c.today ? 'red' : monOf(d) === monOf(c.today) ? 'amber' : 'grey');
      const t = await H.open({ browser, now: c.now, row: { id: 'main', nid: 9, settings: {}, orders }, viewport: { width: 1366, height: 900 } });
      const p = await prep(t);
      const r = await p.evaluate(async n => {
        const out = { today: todayLocal(), wk: thisWk(), board: {}, card: {} };
        showTab('b'); await W(200);
        for (let i = 0; i < n; i++) { const b = document.querySelector('tr[data-wo="WO-C' + i + '"] .due-tag'); out.board[i] = b ? b.className.replace('due-tag', '').trim() : 'missing'; }
        showTab('d'); await W(150);
        for (const tb of ['0', '1', '2', '3', 'later']) { await __go(tb); for (let i = 0; i < n; i++) { const b = document.querySelector('.dchip[data-dw="WO-C' + i + '"] .due-tag'); if (b && !out.card[i]) out.card[i] = b.className.replace('due-tag', '').trim(); } }
        return out;
      }, dues.length);
      const bad = dues.map((d, i) => (r.board[i] !== exp[i] || r.card[i] !== exp[i]) ? d + ' exp ' + exp[i] + ' board ' + r.board[i] + ' card ' + r.card[i] : '').filter(Boolean);
      rec('C5 ' + c.name + ': today=' + c.today + ', due dates −2…+8 days — board row and delivery card both red before today / amber this week (Mon–Sun) / grey later', r.today === c.today && !bad.length, 'app today ' + r.today + ' this week ' + r.wk + ' · ' + bad.join(' | '));
      rec('C5 ' + c.name + ': no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
      await t.close();
    }
  }

  // =====================================================================================================================
  // D. "Move ticked to week…" with a mix of job states; two PCs moving the same ticked set
  // =====================================================================================================================
  {
    const row = { id: 'main', nid: 9, settings: { delx: [
      { wo: 'JOB-MB', title: 'Booked manual', customer: 'ASPECT', value: 70, manual: true, delVeh: 'IVECO', delDay: 'Fri', delWk: '2026-11-09', delDone: false },
      { wo: 'JOB-M', title: 'Pool manual', customer: 'ASPECT', value: 50, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
      O('WO-PL'), O('WO-BK', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }),
      O('WO-LD', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z' }),
      O('WO-HL', { cienHold: true, delVeh: 'RENAULT', delDay: 'Thu', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z' }), // on hold but loaded: visible
      O('WO-HP', { cienHold: true }), // on hold, not loaded: hidden
      O('WO-DLV', { delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-11-09', delDone: true, delDelivAt: '2026-11-09T15:00:00Z' }),
      O('WO-DSP', { delVeh: 'CRAFTER', delDay: 'Tue', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z', delDispAt: '2026-11-10T08:00:00Z' }), // on the road
      O('WO-SHP', { shippedAt: '2026-11-09T12:00:00Z', step: '8. PALLETED' }), // shipped in Cienapps, still tagged
      O('WO-UNT', { delv: false }), // ticked earlier, then untagged for delivery (not on Deliveries any more)
    ] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const D = await p.evaluate(async () => {
      showTab('d'); await W(150); const out = {};
      const set = ['WO-PL', 'WO-BK', 'WO-LD', 'WO-HL', 'WO-HP', 'WO-DLV', 'WO-DSP', 'WO-SHP', 'WO-UNT', 'JOB-MB', 'JOB-M'];
      delSel.clear(); set.forEach(x => delSel.add(x)); render(); await W(60);
      out.visible = set.filter(x => document.querySelector('.dchip[data-dw="' + x + '"]'));
      out.selbar = ((document.querySelector('.selbar') || {}).textContent || '').replace(/\s+/g, ' ');
      out.btn = +((out.selbar.match(/Move ticked to week… \((\d+)\)/) || [])[1] || -1);
      document.getElementById('selwk').click(); await W(60);
      out.pickTitle = (document.querySelector('#wkpick-dlg .pod-in > div') || {}).textContent || '';
      document.querySelector('#wkpick-dlg [data-wkp="2026-11-23"]').click(); await W(60);
      out.prev = ((document.getElementById('wkprev-dlg') || {}).textContent || '').replace(/\s+/g, ' ');
      const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60);
      out.reasonTitle = ((document.querySelector('.pod-ovl .pod-in') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 300);
      await __why('Customer delay');
      out.sum = ((document.getElementById('date-sum') || {}).textContent || '').replace(/\s+/g, ' ');
      __closeAll();
      out.after = Object.fromEntries(set.map(w => { const o = findDel(w); return [w, (o.manual ? (o.planWk || '-') : o.dueDate) + '/' + (o.delDay || '-') + (o.dueMv ? '/mv' : '') + (o.delRebook ? '/rb' : '')]; }));
      return out;
    });
    const changed = Object.entries(D.after).filter(([w, v]) => /2026-11-2[3-7]/.test(v)).map(([w]) => w);
    const nMoved = +((D.sum.match(/(\d+) moved/) || [])[1] || -1);
    rec('D1 button count = the number of ticked cards on screen that can move (plain, booked, loaded, on-hold-loaded, on the road?, pool manual)', D.btn >= 5 && D.btn <= 6, 'button (' + D.btn + '); visible ticked cards: ' + D.visible.join(','));
    rec('D2 the number on the button = the number in the picker title = the number the summary says moved = the jobs whose dates changed', +((D.pickTitle.match(/Move (\d+) jobs/) || [])[1]) === D.btn && nMoved === D.btn && changed.length === D.btn, JSON.stringify({ btn: D.btn, pick: D.pickTitle, reason: D.reasonTitle.slice(0, 120), sum: D.sum.slice(0, 300), changed }));
    rec('D3 the reason dialog\'s "Move N jobs" agrees with the button', new RegExp('Move ' + D.btn + ' jobs').test(D.reasonTitle), D.reasonTitle.slice(0, 160));
    rec('D4 hidden on-hold job (WO-HP) is not moved; delivered (WO-DLV) not moved', /^2026-11-12/.test(D.after['WO-HP']) && /^2026-11-12\/Mon/.test(D.after['WO-DLV']), JSON.stringify([D.after['WO-HP'], D.after['WO-DLV']]));
    rec('D5 a job no longer tagged for delivery (WO-UNT, not on Deliveries) is NOT moved just because it was still ticked', /^2026-11-12/.test(D.after['WO-UNT']), 'WO-UNT ' + D.after['WO-UNT'] + ' — it is not on the Deliveries page (delv off) but stayed in the selection; Move ticked moved its Cienapps due date');
    rec('D6 a job already shipped in Cienapps (WO-SHP) is not moved by Move ticked (its own card has no week buttons)', /^2026-11-12/.test(D.after['WO-SHP']), 'WO-SHP ' + D.after['WO-SHP']);
    rec('D7 summary: the booked manual job is listed "not moved — on a van"', /JOB-MB/.test(D.sum) && /on a van/.test(D.sum), D.sum.slice(0, 400));
    rec('D8 booked → off its van (rebook); loaded, on-hold-loaded and on-the-road stay on their vans, flagged; pool manual planned Wk 48', /\/-\/rb$/.test(D.after['WO-BK']) && /^2026-11-26\/Thu\/mv/.test(D.after['WO-LD']) && /^2026-11-26\/Thu\/mv/.test(D.after['WO-HL']) && /\/Tue/.test(D.after['WO-DSP']) && D.after['JOB-M'] === '2026-11-23/-' && D.after['JOB-MB'] === '-/Fri', JSON.stringify(D.after));
    rec('D: no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  // D9 only booked manual jobs (and a hidden on-hold) ticked: no "Move ticked" button at all, and no "(0)"
  {
    const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-MB', title: 'Booked manual', manual: true, delVeh: 'IVECO', delDay: 'Fri', delWk: '2026-11-09', delDone: false }] }, orders: [O('WO-HP', { cienHold: true }), O('WO-A')] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
    const p = await prep(t);
    const r = await p.evaluate(async () => { showTab('d'); await W(150); delSel.clear(); delSel.add('JOB-MB'); delSel.add('WO-HP'); render(); await W(60); const a = { btn: !!document.getElementById('selwk'), bar: ((document.querySelector('.selbar') || {}).textContent || '').replace(/\s+/g, ' ') };
      // one movable + one booked manual: picker title wording
      delSel.add('WO-A'); render(); await W(60); document.getElementById('selwk').click(); await W(60); a.title = (document.querySelector('#wkpick-dlg .pod-in > div') || {}).textContent || ''; __closeAll(); return a; });
    rec('D9 only a booked manual job + a hidden on-hold job ticked → no Move ticked button (nothing can move)', !r.btn, JSON.stringify(r));
    rec('D10 picker title for 1 movable job + 1 booked manual reads naturally (not "Move 1 jobs")', !/Move 1 jobs/.test(r.title), r.title);
    await t.close();
  }
  // D11 drag a ticked set that includes a hidden on-hold job onto a van cell — the hidden job must not be booked
  {
    const row = { id: 'main', nid: 9, settings: {}, orders: [O('WO-A'), O('WO-B'), O('WO-HP', { cienHold: true })] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 1400 } });
    const p = await prep(t);
    await p.evaluate(async () => { showTab('d'); await W(150); delSel.clear(); ['WO-A', 'WO-B', 'WO-HP'].forEach(w => delSel.add(w)); render(); await W(60); });
    await p.locator('.dchip[data-dw="WO-A"] .dchip-t').dragTo(p.locator('.dcell[data-cell="IVECO|Wed|2026-11-09"]'));
    await p.waitForTimeout(150);
    const r = await p.evaluate(async () => { if (document.querySelector('.pod-ovl [data-why]')) await __why('Production'); __closeAll(); return ['WO-A', 'WO-B', 'WO-HP'].map(w => w + ':' + (__g(w).delVeh || '-') + '|' + (__g(w).delDay || '-')); });
    rec('D11 dragging ticked cards onto a van books the visible ones, not a ticked job that is on hold and hidden', /WO-A:IVECO/.test(r[0]) && /WO-B:IVECO/.test(r[1]) && /WO-HP:-\|-/.test(r[2]), r.join(' '));
    // the same set onto Next ▶: hidden job reported not moved; reason title count
    await p.evaluate(async () => { delSel.clear(); ['WO-A', 'WO-B', 'WO-HP'].forEach(w => delSel.add(w)); __g('WO-A').delVeh = ''; __g('WO-A').delDay = ''; __g('WO-B').delVeh = ''; __g('WO-B').delDay = ''; render(); await W(60); });
    await p.locator('.dchip[data-dw="WO-A"] .dchip-t').dragTo(p.locator('#wkb-next'));
    await p.waitForTimeout(150);
    const r2 = await p.evaluate(async () => { const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); const s = ((document.querySelector('.pod-ovl .pod-in') || {}).textContent || '').replace(/\s+/g, ' '); await __why('Production'); const sum = ((document.getElementById('date-sum') || {}).textContent || '').replace(/\s+/g, ' '); __closeAll(); return { s: s.slice(0, 200), sum: sum.slice(0, 300), d: ['WO-A', 'WO-B', 'WO-HP'].map(w => __g(w).dueDate) }; });
    rec('D12 ticked set incl. a hidden on-hold job dropped on Next ▶: 2 move, hidden one untouched, reason says "Move 2 jobs"', r2.d[0] === '2026-11-19' && r2.d[1] === '2026-11-19' && r2.d[2] === '2026-11-12' && /Move 2 jobs/.test(r2.s), JSON.stringify(r2));
    rec('D: no page errors (drag set)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  // D13 two PCs move the same ticked set to different weeks at the same time
  {
    const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
    const reload = p => p.evaluate(async () => { await loadDB(); });
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: { delx: [{ wo: 'JOB-M', title: 'M', customer: 'C', value: 10, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
      O('WO-T1'), O('WO-T2', { delivDate: '2026-11-13' }), O('WO-T3', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }), O('WO-T4', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z' })] });
    const A = await openS(browser, S, { now: NOW }), B = await openS(browser, S, { now: '2026-11-10T10:02:00Z' });
    await prep(A); await prep(B);
    const mvT = (p, W, why) => p.evaluate(async ({ W, why }) => { showTab('d'); await new Promise(r => setTimeout(r, 80)); delSel.clear(); ['WO-T1', 'WO-T2', 'WO-T3', 'WO-T4', 'JOB-M'].forEach(w => delSel.add(w)); render(); await new Promise(r => setTimeout(r, 60));
      const n = +(((document.querySelector('.selbar') || {}).textContent || '').match(/Move ticked to week… \((\d+)\)/) || [])[1];
      document.getElementById('selwk').click(); await new Promise(r => setTimeout(r, 60)); document.querySelector('#wkpick-dlg [data-wkp="' + W + '"]').click(); await new Promise(r => setTimeout(r, 60));
      const go = document.getElementById('wkp-go'); if (go) go.click(); await new Promise(r => setTimeout(r, 60)); await __why(why); __closeAll(); return n; }, { W, why });
    const nA = await mvT(A.page, '2026-11-23', 'Customer delay');
    const nB = await mvT(B.page, '2026-11-30', 'Site not ready');
    await save(A.page); await save(B.page); await reload(A.page); await reload(B.page); await save(A.page); await reload(B.page);
    const get = p => p.evaluate(() => { const r = {}; ['WO-T1', 'WO-T2', 'WO-T3', 'WO-T4'].forEach(w => { const o = __g(w); r[w] = { due: o.dueDate, deliv: o.delivDate || '', wk: o.plannedWeek, keep: o.dueKeep, day: o.delDay || '', rb: !!o.delRebook, mv: !!o.dueMv, h: (o.dueHist || []).filter(h => h.f !== 'deliv').map(h => h.to + ':' + h.by + ':' + h.why) }; }); const m = __gx('JOB-M'); r['JOB-M'] = { planWk: m.planWk, log: (m.log || []).length }; return r; });
    const ra = await get(A.page), rb = await get(B.page);
    rec('D13 two PCs move the same 5 ticked jobs (A → Wk 48, B → Wk 49, B newer): both PCs end up with the same data', JSON.stringify(ra) === JSON.stringify(rb), JSON.stringify({ ra, rb }).slice(0, 700));
    const ok = ['WO-T1', 'WO-T2', 'WO-T3', 'WO-T4'].every(w => { const x = ra[w]; return x.due && wkOfTest(x.due) === '2026-11-30' && x.h.length === 2; });
    rec('D14 B\'s newer move wins for every job as a unit (due in Wk 49), both moves in each job\'s history; T2 delivery date moved with it (gap kept)', ok && ra['WO-T2'].deliv === '2026-12-04' && ra['WO-T1'].wk === '2026-11-30', JSON.stringify(ra));
    rec('D15 the booked job is consistent (off its van + rebook), the loaded job still on its van + flagged', !ra['WO-T3'].day && ra['WO-T3'].rb && ra['WO-T4'].day === 'Thu' && ra['WO-T4'].mv, JSON.stringify([ra['WO-T3'], ra['WO-T4']]));
    rec('D16 both PCs\' buttons counted the same 5 movable jobs', nA === 5 && nB === 5, nA + ' / ' + nB);
    rec('D: no page errors (two PCs)', ![...(A.server.errors || []), ...(B.server.errors || [])].length, [...(A.server.errors || []), ...(B.server.errors || [])].join(' | '));
    await A.close(); await B.close();
  }
  // D17 PC B untags a ticked job (delv off) and saves; PC A refreshes and presses Move ticked
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [O('WO-U1'), O('WO-U2'), O('WO-U3')] });
    const A = await openS(browser, S, { now: NOW }), B = await openS(browser, S, { now: NOW });
    await prep(A); await prep(B);
    await A.page.evaluate(async () => { showTab('d'); await W(100); delSel.clear(); ['WO-U1', 'WO-U2', 'WO-U3'].forEach(w => delSel.add(w)); render(); await W(60); });
    await B.page.evaluate(async () => { __g('WO-U2').delv = false; __g('WO-U3').cienHold = true; clearTimeout(saveT); await saveDB(); });
    const r = await A.page.evaluate(async () => { await loadDB(); await W(150); render(); await W(80); const seen = { u2delv: __g('WO-U2').delv, u3hold: !!__g('WO-U3').cienHold }; const vis = ['WO-U1', 'WO-U2', 'WO-U3'].filter(w => document.querySelector('.dchip[data-dw="' + w + '"]'));
      const bar = ((document.querySelector('.selbar') || {}).textContent || '').replace(/\s+/g, ' '); const n = +((bar.match(/Move ticked to week… \((\d+)\)/) || [])[1] || -1);
      const b = document.getElementById('selwk'); if (b) { b.click(); await W(60); document.querySelector('#wkpick-dlg [data-wkp="2026-11-23"]').click(); await W(60); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(60); await __why('Production'); __closeAll(); }
      return { seen, vis, n, bar: bar.slice(0, 160), d: ['WO-U1', 'WO-U2', 'WO-U3'].map(w => __g(w).dueDate) }; });
    rec('D17a this PC received the other PC\'s changes (WO-U2 untagged, WO-U3 on hold) and they left the screen', r.seen.u2delv === false && r.seen.u3hold && r.vis.join() === 'WO-U1', JSON.stringify(r));
    rec('D17 after another PC untags WO-U2 and puts WO-U3 on hold, "Move ticked" on this PC counts and moves only the card still on screen', r.n === 1 && r.d[0] === '2026-11-26' && r.d[1] === '2026-11-12' && r.d[2] === '2026-11-12', JSON.stringify(r));
    await A.close(); await B.close();
  }

  // =====================================================================================================================
  // E. 360 px and 1366 px with very long Floor / Unit / customer / title — pool and van grid
  // =====================================================================================================================
  {
    const long = (wo, x) => O(wo, Object.assign({ floor: 'BLOCK T09 FLOOR 12 (NORTH CORE, LEVEL 12 MEZZANINE)', unit: 'APARTMENT 1204B (REAR, DUPLEX UPPER) — PLOT 77 / 78', customer: 'ASPECTATHENRYDEVELOPMENTSLIMITEDPHASE2OGRADYCONSTRUCTIONANDPARTNERS', title: 'Type B kitchen — handleless, Fenix NTM worktop, full-height larder with integrated appliances and a very long description that keeps going and going' }, x));
    const orders = [
      long('WO-261799-1234-1', { dueDate: '2026-12-16', origDueDate: '2026-12-16', plannedWeek: '' }), // Later (customer shown)
      long('WO-261799-1234-2', { dueDate: '2026-12-17', origDueDate: '2026-12-10', plannedWeek: '', delivDate: '2026-12-18', dueHist: [{ at: '2026-11-01T10:00:00Z', by: 'X', f: 'due', from: '2026-12-10', to: '2026-12-17', why: 'x' }] }),
      long('WO-POOL-1'), long('WO-POOL-2', { title: 'Y'.repeat(120), floor: 'F'.repeat(60), unit: 'U'.repeat(60) }),
      long('WO-G1', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }), long('WO-G2', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z', dueMv: { loaded: true, at: '2026-11-10T07:00:00Z' } }),
      long('WO-G3-VERY-LONG-WORK-ORDER-NUMBER-REV-B', { delVeh: 'SMART', delDay: 'Sat', delWk: '2026-11-09', title: 'Z'.repeat(150) }),
      long('WO-RB', { delRebook: { at: '2026-11-10T08:00:00Z', by: 'Ann', why: 'x', was: 'VOLVO|Mon' } }),
    ];
    const row = { id: 'main', nid: 9, settings: {}, orders };
    for (const vw of [{ width: 360, height: 740 }, { width: 1366, height: 768 }]) {
      const t = await H.open({ browser, now: NOW, row, viewport: vw });
      const p = await prep(t);
      const G = await p.evaluate(async () => {
        showTab('d'); await W(200); const out = { tabs: {} };
        for (const tb of ['0', 'later']) {
          await __go(tb);
          const t = {};
          t.bad = __layout();
          t.docW = document.documentElement.scrollWidth;
          t.titles = [...document.querySelectorAll('.dchip .dchip-t')].filter(e => e.offsetParent).map(e => [e.closest('.dchip').dataset.dw, __lines(e)]).filter(x => x[1] > 2);
          t.cust = [...document.querySelectorAll('.dchip .dchip-c')].filter(e => e.offsetParent).map(e => [e.closest('.dchip').dataset.dw, __lines(e), !!e.title]).filter(x => x[1] > 2 || !x[2]);
          t.custN = document.querySelectorAll('.dchip .dchip-c').length;
          t.grpH = [...document.querySelectorAll('.dgrp-h')].map(h => { const r = h.getBoundingClientRect(); return r.right > innerWidth + 1 ? h.textContent.slice(0, 30) + ' ' + Math.round(r.right) : ''; }).filter(Boolean);
          // van grid cells: card inside the cell, and cards in one cell don't overlap each other or the next cell
          t.cells = [...document.querySelectorAll('.dcell')].map(c => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('.dchip')].filter(x => x.offsetParent).map(x => { const q = x.getBoundingClientRect(); return (q.right > r.right + 1 || q.bottom > r.bottom + 1) ? x.dataset.dw + ' outside cell' : ''; }).filter(Boolean); }).flat();
          t.badges = [...document.querySelectorAll('.dchip .dfu')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.closest('.dchip').dataset.dw + ':' + e.textContent.slice(0, 15));
          out.tabs[tb] = t;
        }
        return out;
      });
      const W_ = vw.width + ' px';
      for (const tb of ['0', 'later']) {
        const x = G.tabs[tb], nm = tb === '0' ? 'This week' : 'Later';
        rec('E ' + W_ + ' ' + nm + ': no sideways scroll (document ' + x.docW + ' px)', x.docW <= vw.width, 'document ' + x.docW + ' px wide; group headings past the edge: ' + x.grpH.join(' | '));
        rec('E ' + W_ + ' ' + nm + ': no card overlaps / spills, none outside its van cell', !x.bad.length && !x.cells.length, x.bad.concat(x.cells).slice(0, 10).join(' | '));
        rec('E ' + W_ + ' ' + nm + ': title at most 2 lines on every card', !x.titles.length, JSON.stringify(x.titles));
        if (x.custN) rec('E ' + W_ + ' ' + nm + ': customer at most 2 lines with the full name as a tooltip', !x.cust.length, JSON.stringify(x.cust));
        rec('E ' + W_ + ' ' + nm + ': Floor / Unit badges not cut off (they wrap)', !x.badges.length, x.badges.join(' | '));
      }
      rec('E ' + W_ + ': no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
      await t.close();
    }
    // E: the Production Manager's strip at 360 px with Deliveries open — no sideways scroll
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 360, height: 740 } });
    const p = await prep(t);
    const r = await p.evaluate(async () => { ls.set('wpfPin_prod', pins().prod); ROLE = 'prod'; prodTab = 'deliv'; render(); await W(200); const o = { docW: document.documentElement.scrollWidth, bar: !!document.getElementById('del-wkbar'), bad: __layout() }; ROLE = 'office'; render(); return o; });
    rec('E 360 px Production Manager on 🚚 Deliveries: no sideways scroll, cards fit', r.bar && r.docW <= 360 && !r.bad.length, JSON.stringify(r).slice(0, 400));
    await t.close();
  }

  // =====================================================================================================================
  // F. An old screen open: (1) a job ticked on PC A, put on hold by PC B, A refreshes and drags its ticked set onto a van;
  //    (2) PC A's screen is stale (no refresh), B moved a job a week, A presses → Wk on the old card, both save
  // =====================================================================================================================
  {
    const S = makeServer({ id: 'main', version: 1, nid: 5, settings: {}, orders: [O('WO-A'), O('WO-H'), O('WO-S')] });
    const A = await openS(browser, S, { now: NOW, viewport: { width: 1366, height: 1400 } }), B = await openS(browser, S, { now: NOW });
    await prep(A); await prep(B);
    await A.page.evaluate(async () => { showTab('d'); await W(100); delSel.clear(); document.querySelector('.dchip[data-dw="WO-A"]').click(); await W(40); document.querySelector('.dchip[data-dw="WO-H"]').click(); await W(40); });
    await B.page.evaluate(async () => { __g('WO-H').cienHold = true; clearTimeout(saveT); await saveDB(); });
    await A.page.evaluate(async () => { await loadDB(); await W(150); render(); await W(80); });
    const f1v = await A.page.evaluate(() => ({ vis: [...document.querySelectorAll('.dchip')].map(c => c.dataset.dw), sel: [...delSel], bar: ((document.querySelector('.selbar') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 120) }));
    await A.page.locator('.dchip[data-dw="WO-A"] .dchip-t').dragTo(A.page.locator('.dcell[data-cell="IVECO|Wed|2026-11-09"]'));
    await A.page.waitForTimeout(150);
    const f1 = await A.page.evaluate(async () => { if (document.querySelector('.pod-ovl [data-why]')) await __why('Production'); __closeAll(); return ['WO-A', 'WO-H'].map(w => w + ':' + (__g(w).delVeh || '-') + '|' + (__g(w).delDay || '-')); });
    rec('F1 real use: job ticked, then put on hold by another PC (leaves the screen) — dragging the rest of the ticked cards onto a van does NOT book the hidden on-hold job', /WO-A:IVECO/.test(f1[0]) && /WO-H:-\|-/.test(f1[1]), f1.join(' ') + ' · after refresh on screen: ' + f1v.vis.join(',') + ' · still ticked: ' + f1v.sel.join(',') + ' · bar "' + f1v.bar + '"');
    rec('F1b the selection bar does not count a ticked job that has left the screen', !/2 selected/.test(f1v.bar), f1v.bar);
    // (2) stale screen
    await A.page.evaluate(async () => { delSel.clear(); clearTimeout(saveT); await saveDB(); await loadDB(); render(); await W(80); });
    await B.page.evaluate(async () => { await loadDB(); showTab('d'); await W(100); document.querySelector('[data-wknext="WO-S"]').click(); await W(80); await __why('Customer delay'); __closeAll(); clearTimeout(saveT); await saveDB(); });
    const f2pre = await A.page.evaluate(() => ({ due: __g('WO-S').dueDate, btn: !!document.querySelector('[data-wknext="WO-S"]') }));
    const f2a = await A.page.evaluate(async () => { const b = document.querySelector('[data-wknext="WO-S"]'); if (!b) return 'no button'; const wk = b.dataset.wk; b.click(); await W(80); const t = await __why('Production'); __closeAll(); clearTimeout(saveT); await saveDB(); await loadDB(); return { wk, t: t.replace(/\s+/g, ' ').slice(0, 160) }; });
    await B.page.evaluate(async () => { await loadDB(); });
    const g2 = p => p.evaluate(() => { const o = __g('WO-S'); return { due: o.dueDate, wk: o.plannedWeek, h: (o.dueHist || []).filter(h => h.f !== 'deliv').map(h => h.from + '>' + h.to + ':' + h.why) }; });
    const fa = await g2(A.page), fb = await g2(B.page);
    // Coder 11 Nov (intended change, lead's LOW 7): A's stale move repeats B's exactly (12 Nov → 19 Nov) — it changed nothing, so the
    // merge keeps B's move (the first) and records no second identical entry. Was: 2 entries, both reasons.
    rec('F2 stale screen: B moved WO-S a week and saved; A (no refresh) presses → Wk on its old card: both PCs end up the same, B\'s move is in the history once and A\'s identical repeat is not recorded', JSON.stringify(fa) === JSON.stringify(fb) && fa.h.length === 1 && /Customer delay/.test(fa.h[0]) && fa.due === '2026-11-19', JSON.stringify({ f2pre, f2a, fa, fb }));
    rec('F2b the final due date follows the history (last entry\'s "to" = due date; not two moves both from 12 Nov)', fa.h.length && fa.h[fa.h.length - 1].split('>')[1].split(':')[0] === fa.due && !(fa.h.length === 2 && fa.h[0].split('>')[0] === fa.h[1].split('>')[0]), JSON.stringify(fa));
    rec('F: no page errors', ![...(A.server.errors || []), ...(B.server.errors || [])].length, [...(A.server.errors || []), ...(B.server.errors || [])].join(' | '));
    await A.close(); await B.close();
  }

  await browser.close();
  const f = res.filter(x => !x.ok);
  console.log('\nattack5-carryover: ' + (res.length - f.length) + ' passed, ' + f.length + ' failed');
  process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

function wkOfTest(iso) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
