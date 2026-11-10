// Coder round 9 (3 Nov 2026): the warning box scrolls. At 360/380 px, three (and six) long warnings: the newest shows,
// and every older one can be read in full by tapping ▲ (and back with ▼). ✕ stays in view; taps elsewhere still pass
// through to buttons under the box. Fake Supabase only (srv3.js). Run: node tests/stage3/coder-r9-box.test.js
const A = require('./atk.js');
const { F, rec } = A;
const LONG = n => 'W' + n + ' Not changed — "Carcass side panel left hand ' + n + '" was changed on another screen (already cut by Dee 10:00). Showing it as it is now. (+5 more: "Top ' + n + '" not waiting any more; "Shelf ' + n + '" changed on another screen; "Back panel ' + n + '" not waiting any more; and 14 other lines)';
// Which warnings are (were) fully visible inside the box, tapping ▲ until the top, then ▼ until the bottom
const walk = p => p.evaluate(async () => {
  const t = document.getElementById('toast'), l = t.querySelector('.toast-l'), up = t.querySelector('.toast-up'), dn = t.querySelector('.toast-dn');
  const seen = new Set(), wait = () => new Promise(r => setTimeout(r, 50));
  const look = () => { const b = l.getBoundingClientRect(); l.querySelectorAll('.toast-i').forEach(d => { const r = d.getBoundingClientRect(); if (r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5) seen.add(d.textContent.slice(0, 2)); }); };
  const vis = x => !!x && getComputedStyle(x).display !== 'none';
  const tapAt = x => { const r = x.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (h !== x) return false; x.click(); return true; };
  const st = { arrows: vis(up) && vis(dn), newestFirst: null, tapsOk: true, n: l.querySelectorAll('.toast-i').length };
  look(); st.newestFirst = [...seen];
  for (let i = 0; i < 40 && l.scrollTop > 0; i++) { if (!tapAt(up)) st.tapsOk = false; await wait(); look(); }
  st.atTop = l.scrollTop === 0;
  for (let i = 0; i < 40 && l.scrollTop + l.clientHeight < l.scrollHeight - 1; i++) { if (!tapAt(dn)) st.tapsOk = false; await wait(); look(); }
  st.stillShown = t.classList.contains('show'); st.seen = [...seen].sort();
  const x = t.querySelector('.toast-x').getBoundingClientRect(), bx = t.getBoundingClientRect();
  st.xIn = x.top >= bx.top && x.bottom <= bx.bottom && x.right <= innerWidth; st.h = Math.round(bx.height); st.vh = innerHeight;
  return st;
});
(async () => {
  const browser = await F.H.chromium.launch();
  for (const vp of [{ width: 360, height: 640 }, { width: 380, height: 740 }]) {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const P = await F.dev(browser, S, 'saw', { viewport: vp }); const tag = vp.width + 'px';
    await P.page.evaluate(() => { setRole('saw'); render(); });
    await P.page.evaluate(m => m.forEach(x => lqSay(x)), [LONG(1), LONG(2), LONG(3)]);
    await P.page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    const a = await walk(P.page);
    rec('R1/' + tag + ' three long warnings: newest shown first, the others reachable with ▲/▼, each read in full', a.arrows && a.newestFirst.includes('W3') && a.seen.join() === 'W1,W2,W3' && a.atTop && a.tapsOk && a.stillShown, JSON.stringify(a));
    rec('R2/' + tag + ' box ≤ a quarter of the screen, ✕ in it', a.h <= Math.ceil(a.vh * 0.25) + 1 && a.xIn, JSON.stringify(a));
    await P.page.evaluate(m => m.forEach(x => lqSay(x)), [LONG(4), LONG(5), LONG(6), LONG(7)]);
    const b = await walk(P.page);
    rec('R3/' + tag + ' seven warnings: the newest six kept and all reachable', b.n === 6 && b.seen.join() === 'W2,W3,W4,W5,W6,W7', JSON.stringify(b));
    const tt = await P.page.evaluate(() => { const t = document.getElementById('toast'), b = t.getBoundingClientRect(); const btn = [...document.querySelectorAll('button')].find(x => { if (t.contains(x)) return false; const q = x.getBoundingClientRect(); return q.width && q.top < b.bottom && q.bottom > b.top && q.left < b.right - 40 && q.right > b.left; }); if (!btn) return { none: true }; const q = btn.getBoundingClientRect(); const hit = document.elementFromPoint(Math.max(q.left, b.left) + 5, Math.max(q.top, b.top) + 5); return { under: btn.textContent.trim().slice(0, 20), hitIsBtn: hit === btn || btn.contains(hit) }; });
    rec('R4/' + tag + ' a button under the box still gets the tap', tt.none || tt.hitIsBtn, JSON.stringify(tt));
    const one = await P.page.evaluate(() => { const t = document.getElementById('toast'); t.querySelector('.toast-x').click(); lqSay('short one'); const up = t.querySelector('.toast-up'); return getComputedStyle(up).display; });
    rec('R5/' + tag + ' one short warning: no ▲/▼ shown', one === 'none', one);
    await P.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
