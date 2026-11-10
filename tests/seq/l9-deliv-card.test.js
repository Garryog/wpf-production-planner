// Part 4 step 7 (L9): from a delivery card, start or open the WO's cutting list. ⓘ on every non-manual card (lists switch ON +
// office / Production Manager / Drawing office / Pre-production); the readiness window shows "NO LIST YET [＋ Add cutting list]"
// or "[📂 Open list]". Tapping the card still selects it. Switch OFF = today's app. 360 px and 1366 px. Escaped.
// Fake Supabase only. Run: node tests/seq/l9-deliv-card.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep, finish } = X;
const XSS = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const SHOTS = process.env.L9_SHOTS || '';
function tagRows(r) {
  const tag = (wo, x) => { const o = r.orders.find(o => o.wo === wo); Object.assign(o, { delv: true }, x || {}); };
  tag('WO-1'); tag('WO-3', { dueDate: '2026-10-23', origDueDate: '2026-10-23' }); tag('WO-4', { dueDate: '2026-10-21', delivDate: '', delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-10-19', delLoadedAt: '2026-10-21T08:00:00Z' });
  r.orders.push(H.order({ wo: 'WO-9', customer: 'Aderrig Homes', floor: 'T09', unit: '99', title: 'XSS ' + XSS, dueDate: '2026-10-23', origDueDate: '2026-10-23', delv: true }));
  r.settings.delx = [{ wo: 'MAN-1', title: 'Manual skip', customer: 'X', value: 0, manual: true, delVeh: '', delDay: '', delDone: false }];
  return r;
}
const cards = p => p.evaluate(() => [...document.querySelectorAll('.dchip')].map(c => ({ wo: c.dataset.dw, i: !!c.querySelector('[data-dinfo]'),
  t: (c.querySelector('[data-dinfo]') || {}).title || '', ov: c.scrollWidth > c.clientWidth + 1 })));
const dlg = p => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (!o) return null;
  const r = o.querySelector('.pod-in').getBoundingClientRect();
  return { txt: o.innerText, add: [...o.querySelectorAll('[data-l9add]')].map(b => b.dataset.l9add), open: [...o.querySelectorAll('[data-l9open]')].map(b => b.dataset.l9open),
    btnH: [...o.querySelectorAll('.l9-btn')].map(b => Math.round(b.getBoundingClientRect().height)),
    fits: r.left >= 0 && r.right <= innerWidth + 1, btnIn: [...o.querySelectorAll('.l9-btn')].every(b => { const q = b.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth + 1; }) }; });
const info = (p, wo) => p.evaluate(wo => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); const b = document.querySelector('.dchip [data-dinfo="' + wo + '"]'); if (!b) return false; b.click(); return true; }, wo);
const closeAll = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
(async () => {
  const browser = await H.chromium.launch();
  try {
    for (const vw of [{ width: 1366, height: 900, n: '1366' }, { width: 360, height: 760, n: '360' }]) {
      const S = X.makeServer(tagRows(X.v2Row()));
      const t = await X.dev(browser, S, 'office', { viewport: { width: vw.width, height: vw.height } }), p = t.page;
      await p.evaluate(() => showTab('d')); await sleep(400);
      let c = await cards(p);
      const by = wo => c.find(x => x.wo === wo) || {};
      rec(`[${vw.n}] ⓘ on every non-manual card (WO-1 list, WO-3 none, WO-4 loaded, WO-9), none on the manual job`,
        ['WO-1', 'WO-3', 'WO-4', 'WO-9'].every(w => by(w).i) && by('MAN-1').wo === 'MAN-1' && !by('MAN-1').i, JSON.stringify(c.map(x => [x.wo, x.i])));
      rec(`[${vw.n}] tooltip starts "Cutting list / readiness"`, ['WO-1', 'WO-3', 'WO-4'].every(w => /^Cutting list \/ readiness/.test(by(w).t)) && /— tap for detail$/.test(by('WO-4').t), JSON.stringify(c.map(x => x.t)));
      rec(`[${vw.n}] nothing spills out of any card`, c.every(x => !x.ov), JSON.stringify(c.filter(x => x.ov)));

      // no list → NO LIST YET + ＋ Add cutting list
      await info(p, 'WO-3'); await sleep(100);
      let d = await dlg(p);
      rec(`[${vw.n}] WO-3 (no list): "NO LIST YET" + one ＋ Add cutting list, no Open`, d && /NO LIST YET/.test(d.txt) && !/NO LIST ISSUED/.test(d.txt) && d.add.join() === 'WO-3' && !d.open.length, JSON.stringify(d));
      rec(`[${vw.n}] window and buttons fit the screen; buttons ≥ ${vw.width < 600 ? 44 : 36} px tall`, d && d.fits && d.btnIn && d.btnH.every(h => h >= (vw.width < 600 ? 44 : 36)), JSON.stringify(d && [d.fits, d.btnIn, d.btnH]));
      if (vw.n === '1366' && SHOTS) {
        await closeAll(p);
        const el = await p.$('.dchip[data-dw="WO-3"]'); await el.scrollIntoViewIfNeeded();
        await p.evaluate(() => { const b = document.querySelector('.dchip[data-dw="WO-3"] [data-dinfo]'); b.style.outline = '3px solid #d97706'; });
        await (await p.$('.dpool-chips')).screenshot({ path: SHOTS + '/l9-pool-card-1366.png' });
        await info(p, 'WO-3'); await sleep(150);
        await p.screenshot({ path: SHOTS + '/l9-readiness-add-1366.png' });
        await info(p, 'WO-1'); await sleep(150);
        await p.screenshot({ path: SHOTS + '/l9-readiness-open-1366.png' });
        await info(p, 'WO-3'); await sleep(100);
      }
      await p.evaluate(() => document.querySelector('[data-l9add="WO-3"]').click()); await sleep(500);
      let w = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), wo: (document.getElementById('me-wo') || {}).value, pid: (document.getElementById('me-pid') || {}).value,
        rd: [...document.querySelectorAll('.pod-ovl')].some(o => /Cutting &amp; fittings check|Cutting & fittings check/.test(o.innerHTML)),
        hdr: [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].map(e => e.value)[0] }));
      rec(`[${vw.n}] ＋ Add cutting list → the list window for WO-3, project Aderrig, readiness window gone, standard layout (House 13 heading)`, w.ed && w.wo === 'WO-3' && w.pid === 'P1' && !w.rd && w.hdr === 'House 13', JSON.stringify(w));
      if (vw.n === '360') { const ns = await X.noScroll(p); rec('[360] list window from the card: no sideways scroll', ns.sw <= ns.cw + 1, JSON.stringify(ns)); }
      await closeAll(p);

      // live list → 📂 Open list
      await info(p, 'WO-1'); await sleep(100);
      d = await dlg(p);
      rec(`[${vw.n}] WO-1 (live list L1): 📂 Open list, no Add`, d && d.open.join() === 'L1' && !d.add.length, JSON.stringify(d));
      await p.evaluate(() => document.querySelector('[data-l9open="L1"]').click()); await sleep(500);
      w = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), wo: (document.getElementById('me-wo') || {}).value, name: (document.getElementById('me-name') || {}).value }));
      rec(`[${vw.n}] Open list → the list window on L1 (WO-1, "House 1")`, w.ed && w.wo === 'WO-1' && w.name === 'House 1', JSON.stringify(w));
      await closeAll(p);

      // tapping the card still selects it
      w = await p.evaluate(() => { const c = document.querySelector('.dchip[data-dw="WO-3"] .dchip-t'); c.click(); return { sel: delSel.has('WO-3'), dlg: !!document.querySelector('.pod-ovl') }; });
      rec(`[${vw.n}] tapping the card selects it (no window)`, w.sel && !w.dlg, JSON.stringify(w));
      await p.evaluate(() => { delSel.clear(); render(); });

      // escaped: the XSS title in the card and the readiness window
      await info(p, 'WO-9'); await sleep(200);
      d = await dlg(p);
      const xss = await p.evaluate(() => ({ x: window.__xss || 0, img: !!document.querySelector('.pod-ovl img, .dchip img') }));
      rec(`[${vw.n}] escaped: a title with <img onerror> shows as text, never runs`, d && d.txt.includes('<img src=x') && !xss.x && !xss.img && d.add.join() === 'WO-9', JSON.stringify(xss));
      await closeAll(p);
      rec(`[${vw.n}] no page errors`, !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // another PC made the list while the readiness window was open → ＋ Add opens that list instead of a second one
    {
      const S = X.makeServer(tagRows(X.v2Row()));
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await p.evaluate(() => showTab('d')); await sleep(300);
      await info(p, 'WO-3'); await sleep(100);
      X.F3.seedList(S, 'L3', { wos: ['WO-3'], name: 'Other PC list' });
      await p.evaluate(async () => { lsReset(); await lsLoad(); }); await sleep(200);
      await p.evaluate(() => document.querySelector('[data-l9add="WO-3"]').click()); await sleep(500);
      const w = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), name: (document.getElementById('me-name') || {}).value, toast: (document.getElementById('toast') || {}).textContent }));
      rec('two PCs: list made elsewhere meanwhile → ＋ Add opens it ("already has a cutting list")', w.ed && w.name === 'Other PC list' && /already has a cutting list/.test(w.toast || ''), JSON.stringify(w));
      await t.close();
    }

    // roles: Production Manager / Drawing office / Pre-production allowed; driver / stores / saw / floor / dash / pm not
    {
      const S = X.makeServer(tagRows(X.v2Row()));
      const out = {};
      for (const r of ['prod', 'design', 'pre', 'driver', 'stores', 'saw', 'floor', 'dash', 'pm']) {
        const t = await X.dev(browser, S, r); out[r] = await t.page.evaluate(() => ({ ok: l9Ok(), btn: document.querySelectorAll('[data-l9add],[data-l9open]').length })); await t.close();
      }
      rec('roles: l9Ok for prod / design / pre only', out.prod.ok && out.design.ok && out.pre.ok && ['driver', 'stores', 'saw', 'floor', 'dash', 'pm'].every(r => !out[r].ok), JSON.stringify(out));
      rec('roles: driver / stores screens show no list buttons', !out.driver.btn && !out.stores.btn, JSON.stringify(out));
    }

    // lists switch OFF: today's app — ⓘ only on cards with a readiness colour, old tooltip, old "NO LIST ISSUED" text, no buttons
    {
      const S = X.makeServer(tagRows(X.v1Row()));
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await p.evaluate(() => showTab('d')); await sleep(300);
      const c = await cards(p), by = wo => c.find(x => x.wo === wo) || {};
      rec('switch OFF: l9Ok false; no ⓘ on the loaded card (no colour) or the manual job', !(await p.evaluate(() => l9Ok())) && !by('WO-4').i && !by('MAN-1').i && by('WO-3').i, JSON.stringify(c.map(x => [x.wo, x.i])));
      rec('switch OFF: tooltip unchanged (no "Cutting list / readiness")', c.every(x => !/Cutting list \/ readiness/.test(x.t)), JSON.stringify(c.map(x => x.t)));
      await info(p, 'WO-3'); await sleep(100);
      const d = await dlg(p);
      rec('switch OFF: readiness window unchanged — "NO LIST ISSUED — upload/attach…", no Add / Open buttons', d && /NO LIST ISSUED — upload\/attach one/.test(d.txt) && !d.add.length && !d.open.length, JSON.stringify(d));
      await t.close();
    }
  } catch (e) { rec('test ran without crashing', false, e.stack); }
  await browser.close();
  finish();
})();
