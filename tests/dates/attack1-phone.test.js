// Tester attack 1 — phones at 360 px: Change-dates dialog (single + group), Deliveries week tabs, In store panel, summary.
// Nothing may be cut off: every button fully on screen (or reachable by scrolling its own box), page itself never wider
// than the phone, buttons at least 44 px tall where the plan says so. Stubbed Supabase only.
// Run: node tests/dates/attack1-phone.test.js
const { H, recorder, w } = require('./attack1-lib');
const { rec, done } = recorder('attack1-phone');
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-18', origDueDate: '2026-11-18', plannedWeek: '2026-11-16', step: '8. PALLETED', delv: true, customer: 'CAIRN HOMES — Ballinasloe Phase 3 very long customer name', title: 'House type B2 — kitchen and utility, long title ' + wo, floor: 'Floor 1', unit: 'Unit 22' }, x));
  const orders = [O('WO-2604-7', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }), O('WO-2'), O('WO-3', { storeAt: '2026-10-01T10:00:00Z' }), O('WO-4', { dueDate: '2026-12-02' })];
  for (let i = 0; i < 30; i++) orders.push(O('WO-G' + i));
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', viewport: { width: 360, height: 740 }, row: { id: 'main', nid: 9, settings: {}, orders } });
  const p = t.page;
  const fit = sel => p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.value || '').trim().slice(0, 30), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height) }; }), sel);
  const pageW = () => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, vw: window.innerWidth }));

  // Deliveries tabs + In store
  await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 200)); });
  const tabs = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-deltab]')]; const box = b[0] && b[0].parentElement; const cs = box ? getComputedStyle(box) : {}; return { n: b.length, scroll: box ? box.scrollWidth > box.clientWidth : false, ox: cs.overflowX, rights: b.map(x => Math.round(x.getBoundingClientRect().right)), h: b.map(x => Math.round(x.getBoundingClientRect().height)) }; });
  rec('360 px: week tabs scroll sideways inside their own strip (not the page)', tabs.n >= 5 && (tabs.rights.every(r => r <= 360) || /auto|scroll/.test(tabs.ox)), JSON.stringify(tabs));
  rec('360 px: week tab buttons at least 36 px tall', tabs.h.every(h => h >= 36), JSON.stringify(tabs.h));
  const pw = await pageW();
  rec('360 px Deliveries: the page itself is not wider than the phone', pw.sw <= 362, JSON.stringify(pw));
  await p.evaluate(async () => { const b = [...document.querySelectorAll('button,summary')].find(x => /In store/.test(x.textContent)); if (b) b.click(); await new Promise(r => setTimeout(r, 150)); });
  const st = await p.evaluate(() => { const pn = document.getElementById('del-store'); if (!pn) return null; const r = pn.getBoundingClientRect(); const bs = [...pn.querySelectorAll('[data-storebook]')].map(b => { const q = b.getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right), h: Math.round(q.height) }; }); return { l: Math.round(r.left), r: Math.round(r.right), bs }; });
  rec('360 px In store panel: inside the screen, every ⤵ Book button fully visible', st && st.r <= 362 && st.bs.length >= 3 && st.bs.every(b => b.l >= 0 && b.r <= 360), JSON.stringify(st));

  // single dialog
  await p.evaluate(() => dateDlgOpen(['WO-2604-7'], 'Ann'));
  const d1 = await p.evaluate(() => { const dl = document.querySelector('#date-dlg .pod-in'); const r = dl.getBoundingClientRect(); const why = [...dl.querySelectorAll('[data-dmwhy]')].map(b => { const q = b.getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right), top: Math.round(q.top), h: Math.round(q.height) }; });
    const perRow = new Set(why.map(x => x.top)).size; const ok = dl.querySelector('#dm-ok').getBoundingClientRect(), cx = dl.querySelector('#pod-x').getBoundingClientRect(), dt = dl.querySelector('#dm-date').getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), vh: innerHeight, whyRows: perRow, why, ok: { r: Math.round(ok.right), b: Math.round(ok.bottom), h: Math.round(ok.height) }, cancel: { l: Math.round(cx.left), h: Math.round(cx.height) }, date: { l: Math.round(dt.left), r: Math.round(dt.right) }, ovScroll: getComputedStyle(document.getElementById('date-dlg')).overflowY, inScroll: getComputedStyle(dl).overflowY }; });
  rec('360 px dialog: fits the width (left ≥ 0, right ≤ 360)', d1.l >= 0 && d1.r <= 360, JSON.stringify(d1));
  rec('360 px dialog: reason buttons 2 per row (3 rows), none cut off', d1.whyRows === 3 && d1.why.every(b => b.l >= 0 && b.r <= 360), JSON.stringify(d1.why));
  rec('360 px dialog: Move / Cancel buttons 44 px tall and inside the screen width', d1.ok.h >= 44 && d1.cancel.h >= 44 && d1.ok.r <= 360 && d1.cancel.l >= 0, JSON.stringify([d1.ok, d1.cancel]));
  rec('360 px dialog: the date box is fully inside the screen', d1.date.l >= 0 && d1.date.r <= 360, JSON.stringify(d1.date));
  rec('360 px dialog: if taller than the screen it can be scrolled to the Move button', d1.h <= d1.vh || /auto|scroll/.test(d1.ovScroll + d1.inScroll), JSON.stringify({ h: d1.h, vh: d1.vh, ov: d1.ovScroll, inn: d1.inScroll }));
  await p.evaluate(() => document.getElementById('date-dlg').remove());

  // group dialog with 33 jobs
  await p.evaluate(() => { const wos = DB.orders.map(o => o.wo); dateDlgOpen(wos, 'Ann'); const dl = document.getElementById('date-dlg'); dl.querySelector('[name="dmm"][value="shift"]').click(); const n = dl.querySelector('#dm-n'); n.value = '1'; n.dispatchEvent(new Event('input')); dl.querySelector('[data-dmwhy="Production"]').click(); });
  const d2 = await p.evaluate(() => { const dl = document.querySelector('#date-dlg .pod-in'); const r = dl.getBoundingClientRect(); const sel = dl.querySelector('#dm-u').getBoundingClientRect(), num = dl.querySelector('#dm-n').getBoundingClientRect();
    document.getElementById('dm-ok').scrollIntoView(); const ok = document.getElementById('dm-ok').getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), sel: Math.round(sel.right), num: Math.round(num.right), okVisible: ok.bottom <= innerHeight + 1 && ok.top >= 0, sw: document.documentElement.scrollWidth }; });
  rec('360 px group dialog: "Move all by [n] [weeks]" fits, Move button reachable, page not wider', d2.l >= 0 && d2.r <= 360 && d2.sel <= 360 && d2.num <= 360 && d2.okVisible && d2.sw <= 362, JSON.stringify(d2));
  await p.evaluate(() => document.getElementById('dm-ok').click());
  const d3 = await p.evaluate(() => { const s = document.querySelector('#date-sum .pod-in'); if (!s) return null; const r = s.getBoundingClientRect(); const ok = document.querySelector('#date-sum #pod-x'); ok.scrollIntoView(); const q = ok.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), ok: q.bottom <= innerHeight + 1 && q.right <= 360, h: Math.round(q.height) }; });
  rec('360 px summary after a group move: fits, OK button reachable and 44 px', d3 && d3.l >= 0 && d3.r <= 360 && d3.ok && d3.h >= 44, JSON.stringify(d3));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
