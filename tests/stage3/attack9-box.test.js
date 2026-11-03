// Tester round 9 (3 Nov 2026): attack the warning box after 5406bdb (taps pass through except the ✕, at most 25% of the
// screen high, each warning its own block, last 3 kept). Is the ✕ reachable at 360 px? Is any warning clipped or lost
// without the operator ever being able to read it? Fake Supabase only (srv3.js). Run: node tests/stage3/attack9-box.test.js
const A = require('./atk.js');
const { F, rec } = A;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + String(d).slice(0, 500) : ''));
const LONG = n => 'Not changed — "Carcass side panel left hand ' + n + '" was changed on another screen (already cut by Dee 10:00). Showing it as it is now. (+5 more: "Top ' + n + '" not waiting any more; "Shelf ' + n + '" changed on another screen; "Back panel ' + n + '" not waiting any more; "Plinth ' + n + '" changed on another screen; "Door ' + n + '" not waiting any more; and 14 other lines)';
const measure = p => p.evaluate(() => {
  const t = document.getElementById('toast'), b = t.getBoundingClientRect(), x = t.querySelector('.toast-x');
  const items = [...t.querySelectorAll('.toast-i')].map(d => { const r = d.getBoundingClientRect(); const vis = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)); return { txt: d.textContent.slice(0, 12), h: Math.round(r.height), visible: r.height ? Math.round(100 * vis / r.height) : 0, topClipped: r.top < b.top - 0.5 }; });
  let xr = null; if (x) { const r = x.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); xr = { w: Math.round(r.width), h: Math.round(r.height), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, hitIsX: hit === x }; }
  return { shown: t.classList.contains('show'), stick: t.classList.contains('stick'), box: { top: Math.round(b.top), h: Math.round(b.height), left: Math.round(b.left), right: Math.round(b.right) }, vw: innerWidth, vh: innerHeight, items, x: xr };
});
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
    rec('B3/' + tag + ' three long warnings: every one fully readable (none clipped)', three.items.length === 3 && three.items.every(i => i.visible === 100), JSON.stringify(three.items) + ' box h=' + three.box.h + '/' + three.vh);
    info('B3/' + tag + ' share of each warning visible (oldest first)', three.items.map(i => i.visible + '%').join(' / '));
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
    rec('B8/' + tag + ' a short "Saved" note meanwhile: the warnings come back after it', back.length === 3, JSON.stringify(back));
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
