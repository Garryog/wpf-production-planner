// Tester attack ROUND 3 (list window, 13 Nov): phones — the big Save pinned at the bottom (480 px and narrower). It must never
// cover the last row, the field being typed in, a message the person needs, or the More ▾ / Start from… panels.
// 360 / 480 / 481 px, a 45-row list, the Saved ✓ panel, the old-list finder. Fake Supabase only.
// Run: node tests/list-window/attack3-phone.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, ed, asks, setv, click, save, donep, rows, liveFor } = L;
const LINES = n => Array.from({ length: n }, (_, i) => ['saw', 'Part ' + (i + 1), String(1 + (i % 4)), 300 + i, 200 + i, 'MFC White', '', '']);
const foot = p => p.evaluate(() => { const f = document.querySelector('.me-ed .me-foot'), s = document.getElementById('me-save'); if (!f || !s) return null; const r = f.getBoundingClientRect(), b = s.getBoundingClientRect(), cs = getComputedStyle(f);
  return { pos: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), sTop: Math.round(b.top), sBottom: Math.round(b.bottom), sW: Math.round(b.width), sL: Math.round(b.left), sR: Math.round(b.right), vw: innerWidth, vh: innerHeight }; });
// is the element really the thing under its own middle (not covered by the pinned Save bar or anything else)?
const hit = (p, sel) => p.evaluate(sel => { const e = typeof sel === 'string' ? document.querySelector(sel) : null; if (!e) return { none: true }; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y);
  return { y: Math.round(y), vh: innerHeight, on: y >= 0 && y <= innerHeight && x >= 0 && x <= innerWidth, self: !!t && (t === e || e.contains(t) || t.contains(e) && t.tagName === 'LABEL'), by: t ? (t.id || t.className || t.tagName).toString().slice(0, 30) : 'nothing' }; }, sel);
const sc = p => p.evaluate(() => { const i = document.querySelector('.me-ed'); const s = i.closest('.pod-in') || i; return { top: Math.round(s.scrollTop), max: s.scrollHeight - s.clientHeight, side: s.scrollWidth - s.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
const scrollTo = (p, y) => p.evaluate(y => { const i = document.querySelector('.me-ed'); const s = i.closest('.pod-in') || i; s.scrollTop = y === 'end' ? s.scrollHeight : y; }, y);

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'BIG', { wos: ['WO-3'], name: 'Big list', lines: LINES(45) });
    const t = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 640 } }), p = t.page, kb = p.keyboard; await asks(p);
    const open = async (wo, id) => { await closeAll(p); await p.evaluate(({ wo, id }) => { window.__asked = []; window.__confirm = true; openListEditor(id || null, wo); }, { wo, id }); await sleep(1300); };
    const size = async (w, h) => { await p.setViewportSize({ width: w, height: h }); await sleep(250); };

    // ---------- the edges: 360, 480 pinned · 481 not ----------
    for (const [w, pin] of [[360, true], [480, true], [481, false], [320, true]]) {
      await size(w, 640); await open('WO-4');
      const f = await foot(p), s = await sc(p);
      rec('P1 ' + w + ' px: the Save bar is ' + (pin ? 'pinned (sticky)' : 'NOT pinned — it sits at the end of the window as on a PC'), !!f && (f.pos === 'sticky') === pin, JSON.stringify(f));
      rec('P1 ' + w + ' px: the big Save is fully on the screen, not cut off at a side, no sideways scroll', !!f && f.sL >= 0 && f.sR <= w + 0.5 && s.doc <= 0 && (!pin || (f.sBottom <= 640 && f.sTop > 0)), JSON.stringify([f, s]));
      if (pin) rec('P1 ' + w + ' px: the big Save is a full-width thumb target (≥ 44 px tall, ≥ 80% of the window)', f.sBottom - f.sTop >= 44 && f.sW >= w * 0.7, JSON.stringify(f));
    }

    // ---------- a long list at 360 px ----------
    await size(360, 640); await open('', 'BIG');
    const n = (await rows(p)).length;
    rec('P2 set-up: the 45-row list is open on the phone', n === 45, 'rows ' + n);
    let f = await foot(p);
    rec('P2: at the TOP of a long list the big Save is on the screen (pinned)', f.sBottom <= 640 && f.sTop >= 320, JSON.stringify(f));
    rec('P2: the pinned bar takes no more than a quarter of the phone screen', f.h <= 160, 'bar ' + f.h + ' px of 640');
    // every row's Description box, focused the way a keyboard / tap does (scrolled into view by the browser): never under the bar
    const cov = [];
    for (let i = 0; i < n; i += 1) { await p.evaluate(i => { const e = document.querySelector('.me-ed [data-mr="' + i + '|item"]'); e.focus(); }, i); const h = await hit(p, '.me-ed [data-mr="' + i + '|item"]'); if (!h.on || !h.self) cov.push(i + ':' + h.by + '@' + h.y); }
    rec('[MEDIUM] P3: each of the 45 rows, when its Description box takes the cursor, is in view and NOT under the pinned Save bar', !cov.length, cov.length + ' covered: ' + cov.slice(0, 6).join(' '));
    // the same with real Tab presses down the first 6 rows (every field)
    await p.evaluate(() => { document.querySelector('.me-ed [data-mr="0|item"]').focus(); });
    const cov2 = [];
    for (let i = 0; i < 60; i++) { await kb.press('Tab'); const k = await p.evaluate(() => (document.activeElement.dataset || {}).mr || document.activeElement.id); if (!/\|/.test(k)) break; const h = await hit(p, '.me-ed [data-mr="' + k + '"]'); if (!h.on || !h.self) cov2.push(k + ':' + h.by + '@' + h.y); }
    rec('[MEDIUM] P3b: Tab through the fields of the first rows: the field with the cursor is always in view, never under the pinned bar', !cov2.length, cov2.length + ' covered: ' + cov2.slice(0, 6).join(' '));
    // scrolled to the very end: the last row and the buttons under the grid are all clear of the bar
    await scrollTo(p, 'end'); await sleep(200);
    f = await foot(p);
    const last = await p.evaluate(() => { const rs = [...document.querySelectorAll('.me-ed [data-row]')], r = rs[rs.length - 1].getBoundingClientRect(), b = document.querySelector('.me-ed .me-bar').getBoundingClientRect(), e = document.getElementById('me-err').getBoundingClientRect(); return { rowB: Math.round(r.bottom), barB: Math.round(b.bottom), errB: Math.round(e.bottom) }; });
    rec('P4: scrolled to the end, the LAST row, the ＋ Row / More bar and the message line are all above the Save bar', last.rowB <= f.top + 1 && last.barB <= f.top + 1 && last.errB <= f.top + 1, JSON.stringify([last, f]));
    for (const id of ['me-addhdr', 'me-addsaw', 'me-mats', 'me-help']) { await p.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'nearest' }), id); const h = await hit(p, '#' + id); rec('P4: ' + id + ' can be tapped (nothing over it) once scrolled to', h.on && h.self, JSON.stringify(h)); }
    // More ▾ opened at the bottom: every switch in it can be tapped
    await scrollTo(p, 'end'); await p.click('#me-more summary'); await sleep(250);
    const more = [];
    for (const sel of ['#me-nofit', '#me-units', '#me-more a[download]', '#me-carc', '#me-door']) { await p.evaluate(sel => { const e = document.querySelector(sel); if (e) e.scrollIntoView({ block: 'nearest' }); }, sel); await sleep(60); const h = await hit(p, sel); if (h.none) continue; if (!h.on || !h.self) more.push(sel + ':' + h.by + '@' + h.y); }
    rec('[LOW] P5: More ▾ on the phone: each thing in its panel can be tapped as soon as it is scrolled to — none sits UNDER the pinned Save bar', !more.length, more.join(' '));
    // …and with the window scrolled as far down as it goes: can the covered ones be reached at all?
    await scrollTo(p, 'end'); await sleep(150); const more2 = [];
    for (const sel of ['#me-nofit', '#me-units', '#me-more a[download]', '#me-carc', '#me-door']) { const h = await hit(p, sel); if (h.none) continue; if (!h.on || !h.self) more2.push(sel + ':' + h.by + '@' + h.y); }
    rec('[MEDIUM] P5b: More ▾ on the phone, scrolled right to the end: everything in its panel is clear of the pinned Save bar (else it can never be tapped)', !more2.length, more2.join(' '));
    const side = await sc(p);
    rec('P5: More ▾ open at 360 px: no sideways scroll', side.side <= 1 && side.doc <= 0, JSON.stringify(side));
    await p.evaluate(() => { document.getElementById('me-more').open = false; });
    // Start from… at 360
    await scrollTo(p, 0); await p.click('#me-start summary'); await sleep(250);
    const st = [];
    for (const id of ['me-instpl', 'me-impxl', 'me-findold']) { const h = await hit(p, '#' + id); if (!h.on || !h.self) st.push(id + ':' + h.by + '@' + h.y); }
    rec('P6: Start from… at 360 px: its three choices are on the screen and can be tapped', !st.length, st.join(' '));
    // the old-list finder at 360
    await p.click('#me-findold'); await sleep(800);
    const fo = await p.evaluate(() => { const os = [...document.querySelectorAll('.pod-ovl')], o = os[os.length - 1], i = o.querySelector('.pod-in') || o, q = o.querySelector('input'); const r = i.getBoundingClientRect();
      return { n: os.length, l: Math.round(r.left), r: Math.round(r.right), side: i.scrollWidth - i.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, q: !!q, saveUnder: (() => { const s = document.getElementById('me-save'); if (!s) return false; const b = s.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && (t === s || s.contains(t)); })() }; });
    rec('P7: the old-list finder at 360 px fits the screen (no sideways scroll)', fo.n === 2 && fo.l >= 0 && fo.r <= 360.5 && fo.side <= 1 && fo.doc <= 0, JSON.stringify(fo));
    rec('P7: …and the pinned Save of the window underneath does NOT show through / stay tappable over the finder', !fo.saveUnder, JSON.stringify(fo));
    await kb.press('Escape'); await sleep(300);

    // ---------- Save pressed mid-list with a mistake: is the person TOLD? ----------
    await setv(p, '0|qty', ''); await scrollTo(p, 0); await sleep(100);
    await p.click('#me-save'); await sleep(900);
    const e = await p.evaluate(() => { const x = document.getElementById('me-err'); if (!x) return null; const r = x.getBoundingClientRect(), f = document.querySelector('.me-foot').getBoundingClientRect(); return { txt: x.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), footTop: Math.round(f.top), seen: !!x.textContent && r.top >= 0 && r.bottom <= f.top + 1, toast: [...document.querySelectorAll('.toast,#toast')].map(t => t.innerText).join(' ') }; });
    rec('P8 set-up: Save with a missing quantity is refused with a message', !!e && e.txt.length > 0 && !(await donep(p)), JSON.stringify(e));
    rec('[HIGH] P8: phone, top of a long list, pinned Save pressed with a mistake → the reason is ON THE SCREEN (the red line is at the bottom of the list, out of sight: Save looks dead)', !!e && (e.seen || e.toast.length > 0), JSON.stringify(e));
    // the same on a SHORT list (fits the screen): fine?
    await open('WO-4'); await setv(p, '0|item', 'Side'); await p.click('#me-save'); await sleep(700);
    const e2 = await p.evaluate(() => { const x = document.getElementById('me-err'), r = x.getBoundingClientRect(), f = document.querySelector('.me-foot').getBoundingClientRect(); return { txt: x.textContent, seen: !!x.textContent && r.top >= 0 && r.bottom <= f.top + 1, top: Math.round(r.top), footTop: Math.round(f.top) }; });
    rec('P8b: short list on the phone: the reason Save was refused is on the screen, above the Save bar', e2.seen, JSON.stringify(e2));

    // ---------- keyboard up (short screen 360 × 330) ----------
    await size(360, 330); await open('', 'BIG');
    f = await foot(p);
    rec('(info) P9: phone keyboard up (360 × 330 left): the pinned bar takes ' + (f ? f.h : '?') + ' px — at least 60% of the height is left for rows', !!f && f.h <= 330 * 0.4, JSON.stringify(f));
    const cov3 = [];
    for (const i of [0, 10, 22, 44]) { await p.evaluate(i => document.querySelector('.me-ed [data-mr="' + i + '|qty"]').focus(), i); const h = await hit(p, '.me-ed [data-mr="' + i + '|qty"]'); if (!h.on || !h.self) cov3.push(i + ':' + h.by + '@' + h.y); }
    rec('[MEDIUM] P9b: keyboard up: the Qty box with the cursor (rows 1, 11, 23, 45) is in view, not under the pinned bar', !cov3.length, cov3.join(' '));

    // ---------- Drawing office on the phone: Save as template shares the pinned bar ----------
    await t.ctx.close().catch(() => {});
    const t2 = await X.dev(browser, S, 'design', { viewport: { width: 360, height: 640 } }), q = t2.page; await asks(q);
    await q.evaluate(() => openListEditor('BIG')); await sleep(1300);
    const fd = await foot(q), btns = await q.evaluate(() => [...document.querySelectorAll('.me-foot button')].map(b => b.textContent.trim()));
    rec('(info) P10: Drawing office phone: the pinned bar holds ' + JSON.stringify(btns) + ' and is ' + (fd ? fd.h : '?') + ' px tall (≤ 110 px wanted: one row for Save, the rarely used button not pinned)', !!fd && fd.h <= 110, JSON.stringify(fd));

    // ---------- Saved ✓ on the phone ----------
    await q.evaluate(() => { window.__confirm = true; }); await setv(q, '0|qty', '9'); await q.click('#me-save'); await sleep(2500);
    const d = await donep(q);
    const dp = await q.evaluate(() => { const o = document.querySelector('.me-dov .pod-in'); if (!o) return null; const r = o.getBoundingClientRect(), c = document.getElementById('me-dclose').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), cT: Math.round(c.top), cB: Math.round(c.bottom), cH: Math.round(c.height), doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, foot: !!document.querySelector('.me-foot') }; });
    rec('P11: Saved ✓ panel at 360 px: fits the screen, its Close is ≥ 44 px and in view, the pinned bar is gone', !!d && !!dp && dp.l >= 0 && dp.r <= 360.5 && dp.cH >= 44 && dp.cB <= 640 && dp.doc <= 0 && !dp.foot, JSON.stringify([d && d.h, dp]));
    await t2.ctx.close().catch(() => {});
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
