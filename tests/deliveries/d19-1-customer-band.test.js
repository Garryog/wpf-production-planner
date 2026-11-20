// d19-1 (Garry 19 Nov): every Deliveries card shows the customer / project as a bold navy band at the TOP — in the pool,
// the van cells and Later (pool cards used to leave it out). The step badge stays. Fake Supabase only.
// Run: node tests/deliveries/d19-1-customer-band.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '8. PALLETED', delv: true, customer: 'ASPECT HOMES', title: 'House ' + wo, value: 1000 }, x));
(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-M1', title: 'Spare doors', customer: '', value: 50, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
    O('WO-P1', { customer: 'Kildare <b>Homes</b>' }), O('WO-B1', { customer: 'Cairn Homes', delVeh: 'IVECO', delDay: 'Tue', delWk: '2026-11-16' }),
    O('WO-L1', { customer: 'Glenveagh', dueDate: '2027-01-20', origDueDate: '2027-01-20', plannedWeek: '2027-01-18' })] };
  for (const vw of [{ width: 1400, height: 900 }, { width: 360, height: 740 }]) {
    const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row, viewport: vw }); const p = t.page;
    const R = await p.evaluate(async () => {
      const W = ms => new Promise(r => setTimeout(r, ms)); showTab('d'); await W(200);
      const card = wo => { const c = document.querySelector('.dchip[data-dw="' + wo + '"]'); if (!c) return null; const b = c.firstElementChild, cs = b && getComputedStyle(b);
        return { first: b && b.className, txt: b && (b.querySelector('.dchip-cn') || {}).textContent, tick: !!(b && b.querySelector('.dtick')), fs: cs && cs.fontSize, fw: cs && cs.fontWeight, bg: cs && cs.backgroundColor, step: !!c.querySelector('.stp-b'), inCard: b ? b.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1 : false, html: b && (b.querySelector('.dchip-cn') || {}).innerHTML }; };
      const out = { p1: card('WO-P1'), b1: card('WO-B1'), m1: card('JOB-M1') };
      delTab = 'later'; render(); await W(100); out.l1 = card('WO-L1'); out.docW = document.documentElement.scrollWidth;
      return out;
    });
    const tag = ' (' + vw.width + ' px)';
    const band = (c, txt) => c && /dchip-c/.test(c.first) && c.txt === txt && c.fs === '13px' && +c.fw >= 700 && c.bg === 'rgb(20, 51, 92)' && c.inCard;
    rec('pool card: customer band on top, bold 13 px, navy' + tag, band(R.p1, 'Kildare <b>Homes</b>'), JSON.stringify(R.p1));
    rec('pool card: a customer name with HTML shows as text (escaped)' + tag, R.p1 && !/<b>/.test(R.p1.html), R.p1 && R.p1.html);
    rec('van cell card: customer band on top' + tag, band(R.b1, 'Cairn Homes'), JSON.stringify(R.b1));
    rec('Later card: customer band on top' + tag, band(R.l1, 'Glenveagh'), JSON.stringify(R.l1));
    rec('step badge still on the cards' + tag, R.p1 && R.p1.step && R.b1.step && R.l1.step, JSON.stringify([R.p1 && R.p1.step, R.b1 && R.b1.step]));
    rec('manual job with no customer: a grey "(no customer)" band' + tag, R.m1 && /none/.test(R.m1.first) && R.m1.txt === '(no customer)', JSON.stringify(R.m1));
    if (vw.width === 360) rec('phone: no sideways scroll', R.docW <= 362, R.docW);
    rec('no page errors' + tag, !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  await browser.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})();
