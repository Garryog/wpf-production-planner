// Tester round 9 (3 Nov 2026); B3/B8 updated round 10 for 91753d3 (▲/▼, up to 6 kept): attack the warning box after 5406bdb (taps pass through except the ✕, at most 25% of the
// screen high, each warning its own block, last 3 kept). Is the ✕ reachable at 360 px? Is any warning clipped or lost
// without the operator ever being able to read it? Fake Supabase only (srv3.js). Run: node tests/stage3/attack9-box.test.js
const A = require('./atk.js');
const { F, rec } = A;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + String(d).slice(0, 500) : ''));
const LONG = n => 'Not changed — "Carcass side panel left hand ' + n + '" was changed on another screen (already cut by Dee 10:00). Showing it as it is now. (+5 more: "Top ' + n + '" not waiting any more; "Shelf ' + n + '" changed on another screen; "Back panel ' + n + '" not waiting any more; "Plinth ' + n + '" changed on another screen; "Door ' + n + '" not waiting any more; and 14 other lines)';
const measure = p => p.evaluate(() => {
  const t = document.getElementById('toast'), b = t.getBoundingClientRect(), x = t.querySelector('.toast-x'), l = t.querySelector('.toast-l'), lb = (l || t).getBoundingClientRect();
  const items = [...t.querySelectorAll('.toast-i')].map(d => { const r = d.getBoundingClientRect(); const vis = Math.max(0, Math.min(r.bottom, lb.bottom, b.bottom) - Math.max(r.top, lb.top, b.top)); return { txt: d.textContent.slice(0, 12), h: Math.round(r.height), visible: r.height ? Math.round(100 * vis / r.height) : 0, topClipped: r.top < lb.top - 0.5 }; });
  let xr = null; if (x) { const r = x.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); xr = { w: Math.round(r.width), h: Math.round(r.height), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, hitIsX: hit === x }; }
  return { shown: t.classList.contains('show'), stick: t.classList.contains('stick'), box: { top: Math.round(b.top), h: Math.round(b.height), left: Math.round(b.left), right: Math.round(b.right) }, vw: innerWidth, vh: innerHeight, items, x: xr };
});
// Round 10 (91753d3): step through the box with the ▲/▼ buttons, tapping them like a finger would (mouse click at their
// centre). Records, for every warning, which parts of it were on view at some point. Every warning must be seen in full.
async function stepAll(p) {
  const seenOf = () => p.evaluate(() => {
    const t = document.getElementById('toast'), l = t.querySelector('.toast-l'), lb = l.getBoundingClientRect(), b = t.getBoundingClientRect();
    const top = Math.max(lb.top, b.top), bot = Math.min(lb.bottom, b.bottom), x = t.querySelector('.toast-x').getBoundingClientRect();
    const hx = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2);
    return { xOk: hx === t.querySelector('.toast-x'), parts: [...l.querySelectorAll('.toast-i')].map(d => { const r = d.getBoundingClientRect(); return [Math.max(0, top - r.top), Math.min(r.height, bot - r.top), r.height]; }) };
  });
  const btn = cls => p.evaluate(c => { const e = document.querySelector('#toast .' + c); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height), hitOk: hit === e }; }, cls);
  const cover = []; let xAlways = true, taps = 0; const sizes = {};
  const add = s => { if (!s.xOk) xAlways = false; s.parts.forEach(([a, z, h], i) => { (cover[i] = cover[i] || { h, segs: [] }).segs.push([a, z]); }); };
  add(await seenOf());
  for (const [cls, n] of [['toast-up', 20], ['toast-dn', 20]]) for (let i = 0; i < n; i++) {
    const b = await btn(cls); if (!b) break; sizes[cls] = b;
    if (!b.hitOk) { sizes[cls + 'Blocked'] = true; break; }
    const before = await p.evaluate(() => document.querySelector('#toast .toast-l').scrollTop);
    await p.mouse.click(b.x, b.y); taps++; await new Promise(r => setTimeout(r, 30));
    add(await seenOf());
    const after = await p.evaluate(() => document.querySelector('#toast .toast-l').scrollTop);
    if (after === before) break;
  }
  const full = cover.map(c => { const s = c.segs.filter(([a, z]) => z > a).sort((x, y) => x[0] - y[0]); let reach = 0; for (const [a, z] of s) { if (a > reach + 1) break; reach = Math.max(reach, z); } return reach >= c.h - 1 ? 100 : Math.round(100 * reach / c.h); }); // within 1 px = fully seen (sub-pixel rounding)
  return { full, xAlways, taps, sizes };
}
(async () => {
  const browser = await F.H.chromium.launch();
  for (const vp of [{ width: 360, height: 640 }, { width: 380, height: 740 }, { width: 1400, height: 900 }]) {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const P = await F.dev(browser, S, 'saw', { viewport: vp }); const tag = vp.width + 'px';
    await P.page.evaluate(() => { setRole('saw'); render(); });
    // one long Release-all warning
    await P.page.evaluate(m => lqSay(m), LONG(1)); const one = await measure(P.page);
    rec('B1/' + tag + ' one long warning: box inside the screen, ✕ inside the screen and tappable', one.box.left >= 0 && one.box.right <= one.vw && one.x && one.x.inView && one.x.hitIsX && one.x.w >= 24 && one.x.h >= 24, JSON.stringify(one));
    rec('B2/' + tag + ' one long warning: all of it can be read (not cut off at the top)', one.items.length === 1 && one.items[0].visible === 100, JSON.stringify(one.items) + ' box h=' + one.box.h + '/' + one.vh);
    // three long warnings
    await P.page.evaluate(m => { lqSay(m[0]); lqSay(m[1]); }, [LONG(2), LONG(3)]); const three = await measure(P.page);
    // B3 rewritten round 10: three long warnings can't all be on view at once in a quarter-screen box; each must be
    // fully readable by stepping with ▲/▼ (and the ✕ must stay tappable at every step)
    const walk = await stepAll(P.page);
    rec('B3/' + tag + ' three long warnings: every one fully readable by stepping with ▲/▼, ✕ tappable throughout', three.items.length === 3 && walk.full.length === 3 && walk.full.every(v => v === 100) && walk.xAlways, 'seen %=' + walk.full.join('/') + ' xAlways=' + walk.xAlways + ' taps=' + walk.taps + ' box h=' + three.box.h + '/' + three.vh + ' buttons=' + JSON.stringify(walk.sizes));
    info('B3/' + tag + ' share of each warning visible at first (oldest first)', three.items.map(i => i.visible + '%').join(' / '));
    rec('B3b/' + tag + ' newest warning on view first (start of it, at least 1 line)', three.items[2] && !three.items[2].topClipped && three.items[2].visible > 0, JSON.stringify(three.items));
    if (vp.width <= 380) { const u = walk.sizes['toast-up'], d = walk.sizes['toast-dn'];
      rec('B3c/' + tag + ' ▲/▼ are at least ~32 px tap targets on a phone', !!u && !!d && u.w >= 32 && u.h >= 32 && d.w >= 32 && d.h >= 32, 'up=' + JSON.stringify(u) + ' down=' + JSON.stringify(d)); }
    rec('B4/' + tag + ' box never more than a quarter of the screen high', three.box.h <= Math.ceil(three.vh * 0.25) + 1, three.box.h + ' of ' + three.vh);
    // tap-through: a tick button under the box gets the tap
    const tt = await P.page.evaluate(() => { const t = document.getElementById('toast'), b = t.getBoundingClientRect(); const btn = [...document.querySelectorAll('button')].find(x => { if (t.contains(x)) return false; const q = x.getBoundingClientRect(); return q.width && q.top < b.bottom && q.bottom > b.top && q.left < b.right - 40 && q.right > b.left; }); if (!btn) return { none: true }; const q = btn.getBoundingClientRect(); const cx = Math.max(q.left, b.left) + 5, cy = Math.max(q.top, b.top) + 5; const hit = document.elementFromPoint(cx, cy); return { under: btn.textContent.trim().slice(0, 20), hitIsBtn: hit === btn || btn.contains(hit) }; });
    rec('B5/' + tag + ' a button under the box still gets the tap', tt.none || tt.hitIsBtn, JSON.stringify(tt));
    // four at once: the first is dropped before it is ever painted
    await P.page.evaluate(() => { const t = document.getElementById('toast'); t.querySelector('.toast-x').click(); });
    const closed = await measure(P.page);
    rec('B6/' + tag + ' ✕ closes the box', !closed.shown, JSON.stringify({ shown: closed.shown }));
    await P.page.evaluate(() => { for (let i = 1; i <= 4; i++) lqSay('Burst ' + i + ' — "Part ' + i + '" was changed on another screen.'); });
    const four = await P.page.evaluate(() => [...document.querySelectorAll('#toast .toast-i')].map(d => d.textContent.slice(0, 7)));
    const kept = await P.page.evaluate(() => LQ.msgs.filter(m => /^Burst/.test(m)).length);
    rec('B7/' + tag + ' (Low) 4 warnings at once: the operator can still see or reach all 4 somewhere', four.length === 4 || four.includes('Burst 1'), 'box shows ' + JSON.stringify(four) + '; LQ.msgs has ' + kept + ' (not shown anywhere on screen)');
    // a short toast meanwhile then back: still the same 3
    await P.page.evaluate(() => toast('Saved')); await F.sleep(2700);
    const back = await P.page.evaluate(() => [...document.querySelectorAll('#toast .toast-i')].map(d => d.textContent.slice(0, 7)));
    rec('B8/' + tag + ' a short "Saved" note meanwhile: the same warnings come back after it (all 4 — up to 6 kept)', back.length === four.length && back.length === 4 && back.join() === four.join(), JSON.stringify(back) + ' before=' + JSON.stringify(four));
    // B8b: more than 6 → only the oldest beyond 6 drop, newest last
    await P.page.evaluate(() => { for (let i = 5; i <= 8; i++) lqSay('Burst ' + i + ' — x'); });
    const eight = await P.page.evaluate(() => [...document.querySelectorAll('#toast .toast-i')].map(d => d.textContent.slice(0, 7)));
    rec('B8b/' + tag + ' 8 warnings: the newest 6 kept in order (Burst 3..8)', eight.join() === ['Burst 3', 'Burst 4', 'Burst 5', 'Burst 6', 'Burst 7', 'Burst 8'].join(), JSON.stringify(eight));
    const w6 = await stepAll(P.page);
    rec('B8c/' + tag + ' 6 warnings: every one reachable with ▲/▼', w6.full.length === 6 && w6.full.every(v => v === 100), 'seen %=' + w6.full.join('/'));
    // a line break inside one warning
    await P.page.evaluate(() => { document.querySelector('#toast .toast-x').click(); lqSay('A "Side\nleft" was changed'); lqSay('B'); });
    const nl = await P.page.evaluate(() => [...document.querySelectorAll('#toast .toast-i')].map(d => d.textContent));
    rec('B9/' + tag + ' a warning with a line break stays one whole warning', nl.length === 2 && /Side\s?left/.test(nl[0]), JSON.stringify(nl));
    const x = await P.page.evaluate(() => { window.__x = 0; lqSay('<img src=x onerror="window.__x=1">'); return new Promise(r => setTimeout(() => r(window.__x), 300)); });
    rec('B10/' + tag + ' HTML in a warning runs nothing', !x, 'x=' + x);
    await P.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
