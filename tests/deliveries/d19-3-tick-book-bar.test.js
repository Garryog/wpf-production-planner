// d19-3 (Garry 19 Nov): a visible ☐ tick on every Deliveries card; the selection bar reads
// "[N selected · €value] Put on: [van ▾] [day ▾] [🚚 Book N] 📅 Move ticked to week… 📅 Move dates clear" and 🚚 Book N books
// the ticked jobs through placeJobs (name asked, slot warning). Usable at 360 px. Fake Supabase only.
// Run: node tests/deliveries/d19-3-tick-book-bar.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '8. PALLETED', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1250 }, x));
(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', nid: 9, settings: {}, orders: [O('WO-1'), O('WO-2', { value: 2000 }), O('WO-3'), O('WO-9', { delVeh: 'IVECO', delDay: 'Thu', delWk: '2026-11-16' })] };
  for (const vw of [{ width: 1400, height: 900 }, { width: 360, height: 740 }]) {
    const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row, viewport: vw }); const p = t.page; const tag = ' (' + vw.width + ' px)';
    await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 200)); });
    const t0 = await p.evaluate(() => [...document.querySelectorAll('.dchip')].map(c => { const k = c.querySelector('.dtick'); return k ? k.textContent : 'none'; }));
    rec('every card has a visible ☐ tick' + tag, t0.length === 4 && t0.every(x => x === '☐'), JSON.stringify(t0));
    // tap the tick of WO-1 and WO-2 (real clicks)
    await p.click('.dchip[data-dw="WO-1"] .dtick'); await p.click('.dchip[data-dw="WO-2"] .dtick'); await p.waitForTimeout(150);
    const B = await p.evaluate(() => { const b = document.getElementById('del-selbar'); const r = b && b.getBoundingClientRect();
      const box = id => { const e = document.getElementById(id); if (!e) return null; const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), right: Math.round(q.right) }; };
      return { txt: b ? b.textContent.replace(/\s+/g, ' ') : '', ticks: [...document.querySelectorAll('.dchip.sel .dtick')].map(x => x.textContent), veh: box('selveh'), day: box('selday'), book: box('selbook'), right: r && Math.round(r.right), docW: document.documentElement.scrollWidth,
        days: [...document.querySelectorAll('#selday option')].map(o => o.textContent), vans: [...document.querySelectorAll('#selveh option')].length }; });
    rec('ticked cards show ☑' + tag, B.ticks.length === 2 && B.ticks.every(x => x === '☑'), JSON.stringify(B.ticks));
    rec('bar: "2 selected · €3,250" · Put on: van / day · 🚚 Book 2 · Move ticked to week… · Move dates · clear' + tag, /2 selected · €3,250/.test(B.txt) && /Put on:/.test(B.txt) && /🚚 Book 2/.test(B.txt) && /Move ticked to week… \(2\)/.test(B.txt) && /Move dates \(2\)/.test(B.txt) && /clear/.test(B.txt), B.txt);
    rec('day picker lists Mon–Sat of the shown week with dates' + tag, B.days.length === 7 && /Mon 16 Nov/.test(B.days[1]) && /Sat 21 Nov/.test(B.days[6]), JSON.stringify(B.days));
    rec('phone-usable: pickers and Book at least 34 px high, nothing past the screen edge' + tag, B.veh && B.veh.h >= 34 && B.day.h >= 34 && B.book.h >= 34 && B.book.right <= vw.width && B.docW <= vw.width + 2, JSON.stringify(B));
    // Book with no van picked → told, nothing booked
    await p.click('#selbook'); await p.waitForTimeout(100);
    const n0 = await p.evaluate(() => DB.orders.filter(o => o.delDay && o.wo !== 'WO-9').length);
    rec('🚚 Book with no van/day picked → nothing booked' + tag, n0 === 0, n0);
    // pick Iveco + Thu (WO-9 already there → asked) and book
    await p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return true; }; });
    await p.selectOption('#selveh', 'IVECO'); await p.selectOption('#selday', 'Thu'); await p.click('#selbook'); await p.waitForTimeout(300);
    const A = await p.evaluate(() => ({ asked: window.__asked, b: ['WO-1', 'WO-2', 'WO-3'].map(w => { const o = DB.orders.find(x => x.wo === w); return w + ':' + (o.delVeh || '') + '|' + (o.delDay || '') + '|' + (o.delWk || '') + '|' + (o.delPlacedBy || ''); }), sel: delSel.size }));
    rec('🚚 Book 2 → WO-1 and WO-2 on Iveco Thu Wk 47, with the name; WO-3 untouched; ticks cleared' + tag, A.b[0] === 'WO-1:IVECO|Thu|2026-11-16|Tester' && A.b[1] === 'WO-2:IVECO|Thu|2026-11-16|Tester' && A.b[2] === 'WO-3:||' + '|' && A.sel === 0, JSON.stringify(A));
    rec('…and the slot warning was asked (WO-9 already on Iveco Thu)' + tag, A.asked.some(m => /Iveco Thu 19 Nov already has 1 job: WO-9/.test(m)), JSON.stringify(A.asked));
    if (vw.width === 360) await p.screenshot({ path: '/tmp/claude-0/-home-claude/5de3b596-3088-50b3-ae12-ebf68b089f91/scratchpad/deliv/d19-3-bar-360.png' }).catch(() => {});
    rec('no page errors' + tag, !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  await browser.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})();
