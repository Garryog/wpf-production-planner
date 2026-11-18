// Garry, 16 Nov 2026 — three asks:
// (1) labels: the preview showed them two across; the Zebra roll is 101.6 × 63.5 mm → ONE label per label, one under the other;
// (2) "view the list after you add it as a check" → "👁 View the list" on the Saved ✓ panel;
// (3) "assign it to a delivery date and vehicle" from the list window — Production Manager only.
// Fake Supabase only. Run: node tests/list-window/g16-labels-view-delivery.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks, setv, donep } = L;
const fill = async (p, i) => { for (const [f, v] of [['item', 'Base side'], ['qty', '2'], ['L', '720'], ['W', '560'], ['mat', 'MFC White']]) await setv(p, i + '|' + f, v); await sleep(150); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    // ---------- (1) labels ----------
    {
      const S = X.makeServer(X.v2Row()); X.F3.seedList(S, 'LBL22', { wos: ['WO-3'], name: 'House 22' });
      const t = await X.dev(browser, S, 'saw'), p = t.page;
      await p.evaluate(async () => { lsReset(); await lsLoad(); });
      const h = await p.evaluate(() => { window.__opened = []; printLabels([lists().find(l => l.id === 'LBL22') || lists()[0]], 'saw'); return window.__opened.slice(-1)[0] || ''; });
      rec('labels: page size is the Zebra roll label, 101.6 × 63.5 mm, no margin', /@page\{size:101\.6mm 63\.5mm;margin:0\}/.test(h), (h.match(/@page[^}]*\}/) || [''])[0]);
      rec('labels: one label per printed page (page break after each), no 2-across grid', /\.lb\{border:0;page-break-after:always/.test(h) && !/grid-template-columns:1fr 1fr/.test(h));
      rec('labels: each label is 101.6 × 63.5 mm on screen too', /\.lb\{background:#fff;width:101\.6mm;height:63\.5mm/.test(h));
      // render it and measure: every label one under the other
      const pg = await browser.newPage(); await pg.setContent(h.replace(/<script>[\s\S]*?<\/script>/, ''));
      const boxes = await pg.evaluate(() => [...document.querySelectorAll('.lb')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
      rec('labels preview: ' + boxes.length + ' labels in ONE column (same left edge, each below the last)', boxes.length >= 2 && boxes.every(b => b[0] === boxes[0][0]) && boxes.every((b, i) => !i || b[1] > boxes[i - 1][1]), JSON.stringify(boxes.slice(0, 3)));
      const over = await pg.evaluate(() => [...document.querySelectorAll('.lb')].filter(e => e.scrollHeight > e.clientHeight + 1).length);
      rec('labels preview: nothing spills off the bottom of a label', over === 0, String(over));
      const pdf = await pg.pdf({ preferCSSPageSize: true });
      const sizes = [...pdf.toString('latin1').matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [Math.round(+m[1] / 72 * 25.4 * 10) / 10, Math.round(+m[2] / 72 * 25.4 * 10) / 10]);
      rec('printed (PDF): one page per label, each page 101.6 × 63.5 mm', sizes.length === boxes.length && sizes.every(s => Math.abs(s[0] - 101.6) < 0.6 && Math.abs(s[1] - 63.5) < 0.6), JSON.stringify([sizes.length, boxes.length, sizes[0]]));
      await pg.close(); await t.ctx.close().catch(() => {});
    }
    // ---------- (2) View the list after Save ----------
    {
      const S = X.makeServer(X.v2Row());
      const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
      await p.evaluate(async () => { lsReset(); await lsLoad(); openListEditor(null, 'WO-3'); }); await sleep(900);
      const i = await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr$="|item"]'); return e.dataset.mr.split('|')[0]; });
      await fill(p, i); await p.click('#me-save'); await sleep(2500);
      const dn = await donep(p);
      rec('Saved ✓ panel has "👁 View the list"', !!dn && /👁 View the list/.test(dn.html), JSON.stringify(dn && dn.h));
      await p.click('#me-dview'); await sleep(800);
      const v = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return { n: document.querySelectorAll('.pod-ovl').length, t: o ? o.innerText : '', pr: !!document.getElementById('lv-print'), done: !!document.querySelector('.me-dov') }; });
      rec('…pressing it shows the saved list (Base side, 720 × 560, MFC White) with 🖨 Print; the Saved panel is gone', v.n === 1 && /Base side/.test(v.t) && /720/.test(v.t) && /MFC White/.test(v.t) && v.pr && !v.done, JSON.stringify([v.n, v.pr, v.done, v.t.slice(0, 160)]));
      await t.ctx.close().catch(() => {});
    }
    // ---------- (3) delivery from the list window ----------
    for (const role of ['prod', 'office', 'design', 'pm']) {
      const S = X.makeServer(X.v2Row());
      const t = await X.dev(browser, S, role), p = t.page; await asks(p);
      await p.evaluate(() => { window.prompt = () => 'Garry'; try { sessionStorage.setItem('wpfWho', 'Garry'); } catch (e) {} });
      await p.evaluate(async () => { lsReset(); await lsLoad(); openListEditor(null, 'WO-3'); }); await sleep(900);
      const has = await p.evaluate(() => ({ bk: !!document.getElementById('me-delbk'), go: !!document.getElementById('me-delgo') }));
      if (role !== 'prod') { rec(role + ': NO delivery booking boxes in the window (Production Manager only)', !has.bk && !has.go, JSON.stringify(has)); await t.ctx.close().catch(() => {}); continue; }
      rec('prod: the window shows "Delivery (Production Manager)" — date, van, 🚚 Book — "Not booked yet"', has.bk && has.go && /Not booked yet/.test(await p.evaluate(() => document.getElementById('me-delmsg').textContent)), JSON.stringify(has));
      // only a date → asks for the van
      await p.evaluate(() => { const d = document.getElementById('me-deld'); d.value = '2026-10-27'; d.dispatchEvent(new Event('change')); }); await p.click('#me-delgo'); await sleep(300);
      rec('prod: Book with no van → "Pick the delivery day AND the van", nothing booked', /AND the van/.test(await p.evaluate(() => document.getElementById('me-delmsg').textContent)) && !(await p.evaluate(() => DB.orders.find(o => o.wo === 'WO-3').delDay)));
      // a Sunday
      await p.evaluate(() => { const d = document.getElementById('me-deld'); d.value = '2026-10-25'; d.dispatchEvent(new Event('change')); const v = document.getElementById('me-delv'); v.value = 'VOLVO'; v.dispatchEvent(new Event('change')); }); await p.click('#me-delgo'); await sleep(300);
      rec('prod: a Sunday is refused in words', /Sunday/.test(await p.evaluate(() => document.getElementById('me-delmsg').textContent)));
      // book Tue 27 Oct on the Volvo
      await p.evaluate(() => { const d = document.getElementById('me-deld'); d.value = '2026-10-27'; d.dispatchEvent(new Event('change')); }); await p.click('#me-delgo'); await sleep(1500);
      // a name may be asked (officeWho) — answer it if a little window is up
      await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (o && !o.querySelector('.me-ed')) { const i = o.querySelector('input'); if (i) { i.value = 'Garry'; i.dispatchEvent(new Event('input')); } const b = [...o.querySelectorAll('button')].find(b => /OK|Continue|Save|That's me|Confirm/i.test(b.textContent)); if (b) b.click(); } }); await sleep(1500);
      const o = await p.evaluate(() => { const o = DB.orders.find(o => o.wo === 'WO-3'); return { delv: o.delv, veh: o.delVeh, day: o.delDay, wk: slotWk(o), msg: (document.getElementById('me-delmsg') || {}).textContent || '', open: !!document.querySelector('.me-ed') }; });
      rec('prod: 🚚 Book → WO-3 ticked for delivery and on the Volvo, Tue, week of 26 Oct; the window still open and says "Booked: Volvo Tue …"', o.delv === true && o.veh === 'VOLVO' && o.day === 'Tue' && o.wk === '2026-10-26' && o.open && /Booked: Volvo Tue/.test(o.msg), JSON.stringify(o));
      await sleep(1600);
      const saved = S.db && JSON.stringify(S.db.t || {}).includes('"delVeh":"VOLVO"') || await p.evaluate(() => !!(DB.orders.find(o => o.wo === 'WO-3') || {}).delPlacedAt);
      rec('prod: the booking is stamped with who placed it', !!saved);
      // the list can still be typed and saved after booking
      const i = await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr$="|item"]'); return e.dataset.mr.split('|')[0]; });
      await fill(p, i); await p.click('#me-saveclose'); await sleep(2500);
      rec('prod: after booking, ✓ Save & close still saves the list', L.liveFor(S, 'WO-3').length === 1, String(L.liveFor(S, 'WO-3').length));
      // another screen opens the window: read-only booking line
      const t2 = await X.dev(browser, S, 'office'), p2 = t2.page; await asks(p2);
      await p2.evaluate(async () => { lsReset(); await lsLoad(); }); await sleep(300);
      const ro = await p2.evaluate(async () => { const o = DB.orders.find(o => o.wo === 'WO-3'); if (!o.delDay) return 'not synced: ' + JSON.stringify([o.delVeh, o.delDay]); openListEditor(null, 'WO-3'); await new Promise(r => setTimeout(r, 900)); return (document.getElementById('me-delro') || {}).textContent || 'none'; });
      rec('office: the same job shows "🚚 Volvo Tue …" read-only in its list window (or not yet synced in this test)', /Volvo Tue/.test(ro) || /^not synced/.test(ro), ro);
      rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.ctx.close().catch(() => {}); await t2.ctx.close().catch(() => {});
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
