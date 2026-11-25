// B10 step 7: the 360 px pass over everything B10 added, all on screen at once — PM home nudge, the sequence page with
// 📌 To place / confirm (long names, a suggestion, a possible double, a "taken out" line), 📅 Dates to agree, ⏳ flags, the ⏳
// window, the upload preview (Not read / Will be added / Skipped / ❓ + position) and the refusal window; the office import line.
// Every one: no sideways scroll, nothing wider than the screen, buttons at least 36 px high. Fake Supabase only.
// Run: node tests/seq/b10h-360.test.js
const X = require('./fixs.js'), B = require('./b10fix.js');
const { H, D, rec, sleep } = X;
const C = 'Aderrig Homes';
const J = (wo, f, u, t, x) => H.order(Object.assign({ wo, customer: C, floor: f, unit: u, title: t, dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '', step: '4. READY FOR PRODUCTION' }, x || {}));
const LONG = 'HOUSE TYPE B2 SEMI-DETACHED WITH EXTENDED KITCHEN AND UTILITY PLUS ISLANDLESS LAYOUT REVISION 3';
function server() {
  const row = X.v2Row();
  row.orders.push(J('WO-501', 'T09', '43', LONG), J('WO-502', 'T09', '43', LONG), J('WO-503', '', '', 'HOUSE TYPE A', { ref: '2796-15-T09-APT 44' }), J('WO-504', 'T09', '50', 'HOUSE TYPE K'),
    J('WO-505', 'T09', '60', 'HOUSE TYPE K', { delivDate: '2026-12-21' }), J('WO-506', 'T09', '61', 'HOUSE TYPE Z'));
  const S = X.makeServer(row); D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  const U = (id, f, u, p, n, kind, x) => X.seqRow(S, id, 'P1', Object.assign({ floor: f, unit: u, product: p, name: n, kind, src: 'upload', why: 'Cienapps upload: a.xlsx' }, x || {}));
  U('U43', 'T09', '43', 'K8', LONG, 'kitchen'); U('U44', 'T09', '44', 'K8', 'HOUSE TYPE A', 'kitchen'); U('U50', '0', '50', 'K8', 'HOUSE TYPE K', 'kitchen');
  const w = U('OLD', 'T09', '70', 'K8', LONG, 'kitchen'); w.created_at = '2026-09-01T09:00:00.000Z';
  X.seqRow(S, 'N50', 'P1', { wo: 'WO-504', floor: 'T09', unit: '50', descr: 'HOUSE TYPE K', kind: 'kitchen', src: 'import', is_new: true });
  X.seqRow(S, 'A60', 'P1', { wo: 'WO-505', floor: 'T09', unit: '60', descr: 'HOUSE TYPE K', req_date: '2026-12-25', src: 'upload' });
  X.seqRow(S, 'RM', 'P1', { wo: 'WO-506', floor: 'T09', unit: '61', descr: 'HOUSE TYPE Z', kind: 'kitchen', src: 'import' });
  X.DS.RPC.seq_remove(Object.assign(S.db, { listStore: 'v2' }), { p_id: 'RM', p_by: 'Mary Kelly', p_why: 'Not ordered / cancelled' });
  return S;
}
const fit = p => p.evaluate(() => {
  const vw = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
  const wide = [...document.querySelectorAll('#seq-cf *, #seq-agree *, .squ-dlg *, .seq-nudge *, #seq-pg .seq-top *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 1; }).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right));
  const small = [...document.querySelectorAll('#seq-cf button, #seq-agree button, .squ-dlg button, .seq-old, .seq-nudge button, #seq-up')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 36).map(b => (b.id || b.className) + ' "' + b.textContent.trim().slice(0, 30) + '" ' + Math.round(b.getBoundingClientRect().height));
  return { sw, vw, wide: wide.slice(0, 5), small: small.slice(0, 8) };
});
const ok = f => f.sw <= f.vw + 1 && !f.wide.length && !f.small.length;
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = server();
    const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } }), p = ph.page;
    await p.evaluate(() => { pmTab = ''; render(); }); await sleep(400);
    let f = await fit(p);
    rec('PM home nudge bar (incl. "N to place / confirm"): fits, buttons ≥ 36 px', ok(f) && await p.evaluate(() => /to place \/ confirm/.test((document.querySelector('.seq-nudge') || {}).innerText || '')), JSON.stringify(f));
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1300);
    const on = await p.evaluate(() => ({ cf: !!document.getElementById('seq-cf'), ag: !!document.getElementById('seq-agree'), old: !!document.querySelector('[data-seqold]'), dbl: !!document.querySelector('[data-seqdbl]'), put: !!document.querySelector('[data-seqput]'), sug: /suggestion/.test((document.getElementById('seq-cf') || {}).innerText || '') }));
    rec('all B10 panels on screen (confirm, a suggestion, a double, taken out, Dates to agree, ⏳)', Object.values(on).every(Boolean), JSON.stringify(on));
    f = await fit(p);
    rec('360 px sequence page with every B10 panel: no sideways scroll, nothing past the edge, buttons ≥ 36 px', ok(f), JSON.stringify(f));
    await p.evaluate(() => document.querySelector('[data-seqold]').click()); await sleep(500);
    f = await fit(p);
    rec('360 px ⏳ window: fits, buttons ≥ 36 px', ok(f), JSON.stringify(f));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    await B.upload(p, [B.HDR, B.pad([1, 'T09', '43', 'K8', LONG + ' RH', 'KITCHEN', 1]), B.pad([2, 'T09', '80', 'K8', LONG, 'KITCHEN', 1]), B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B', '', 1]),
      B.pad([1, '', '', '', 'TOTAL', '', 1]), B.pad(['', '', '', '', '', 'A long note about delivery to the site office before ten in the morning please', ''])], 'A very long file name for phase five of the Aderrig development.xlsx');
    const v = await B.preview(p);
    f = await fit(p);
    rec('360 px upload preview (Not read, Will be added, ❓ revised / not sure, Qty warning, position): fits, buttons ≥ 36 px', v && /Not read \(2\)/.test(v.t) && v.uns >= 1 && ok(f), JSON.stringify([f, v && [v.add, v.uns]]));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    await B.upload(p, [['nothing here']], 'x.xlsx');
    f = await fit(p);
    rec('360 px refusal window: fits, Close ≥ 36 px', ok(f) && await p.evaluate(() => !!document.querySelector('.squ-err')), JSON.stringify(f));
    rec('phone: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})();
