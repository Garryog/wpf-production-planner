// Coder checks for the attack12 fixes the Tester's files don't press on: the preview's "🚫 Not read (N)" list (H4), the ❓
// "revised line?" reason (M6), the grey "taken out by … [Put back]" line (M5: seq_restore, a hand-removed WO is not offered as
// "Not in the sequence yet"), a WO with no floor / unit and no Reference shown with only "➕ Add at the bottom" (H1).
// Fake Supabase only. Run: node tests/seq/b10g-fixes.test.js
const X = require('./fixs.js'), B = require('./b10fix.js');
const { H, D, rec, sleep } = X;
const C = 'Aderrig Homes';
const J = (wo, f, u, t, x) => H.order(Object.assign({ wo, customer: C, floor: f, unit: u, title: t, dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '', step: '4. READY FOR PRODUCTION' }, x || {}));
const rowOf = (S, id) => D.find(S.db, 'project_seq', id);
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = X.v2Row(); row.orders.push(J('WO-91', 'T09', '91', 'HOUSE TYPE K'), J('WO-92', '', '', 'HOUSE TYPE K'));
    const S = X.makeServer(row); D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.seqRow(S, 'K1', 'P1', { floor: 'T09', unit: '12', product: 'K8', name: 'HOUSE TYPE B LH', kind: 'kitchen', src: 'upload' });
    const rm = X.seqRow(S, 'RM', 'P1', { wo: 'WO-91', floor: 'T09', unit: '91', descr: 'HOUSE TYPE K', kind: 'kitchen', src: 'import' });
    X.DS.RPC.seq_remove(Object.assign(S.db, { listStore: 'v2' }), { p_id: 'RM', p_by: 'Mary Kelly', p_why: 'Not ordered / cancelled' });
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), p = pm.page;
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const cf = await p.evaluate(() => ((document.getElementById('seq-cf') || {}).innerText || '').replace(/\s+/g, ' '));
    rec('M5 a WO taken out by hand: not "Not in the sequence yet", a grey line "WO-91 taken out by Mary Kelly … [Put back]"', !/Not in the sequence yet[^]*WO-91 HOUSE/.test(cf) && /WO-91 taken out by Mary Kelly/.test(cf) && await p.evaluate(() => !document.querySelector('[data-seqcfnew="WO-91"]') && !!document.querySelector('[data-seqput="RM"]')), cf.slice(0, 400));
    rec('H1 WO-92 (no floor / unit, no Reference): "no floor / unit to go by" with only ➕ Add at the bottom, never on a row', /WO-92 HOUSE TYPE K — no floor \/ unit to go by/.test(cf) && await p.evaluate(() => !document.querySelector('[data-seqcfwo="WO-92"]') && /Add at the bottom/.test(document.querySelector('[data-seqcfnew="WO-92"]').textContent)) && !rowOf(S, 'K1').wo, cf.slice(0, 400));
    await p.evaluate(() => document.querySelector('[data-seqput="RM"]').click()); await sleep(900);
    rec('M5 Put back: the row is live again (seq_restore), WO-91 back in the sequence, History "restore"', rowOf(S, 'RM').state === 'matched' && S.db.t.project_events.some(e => e.entity_id === 'RM' && e.act === 'restore') && await p.evaluate(() => !document.querySelector('[data-seqput="RM"]')));
    // the preview: Not read + revised line
    const F = [B.HDR, B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B RH', 'KITCHEN TYPE 1 RH', 3950]), B.pad([1, 'T09', '13', 'K1', 'HOUSE TYPE C QUARTZ', '', 1580]),
      B.pad([2, '', '', '', 'SUBTOTAL', '', 5530]), B.pad(['', '', '', '', '', 'Deliver before 10 <b>am</b>', ''])];
    await B.upload(p, F, 'rev.xlsx');
    const v = await B.preview(p);
    const t = v.t.replace(/\s+/g, ' ');
    rec('H4 preview "🚫 Not read (2)": row 4 SUBTOTAL (a total), row 5 the note (no floor, unit or product) — names escaped', /Not read \(2\)/.test(t) && /row 4 SUBTOTAL — a total/.test(t) && /row 5 Deliver before 10 <b>am<\/b> — no floor, unit or product/.test(t) && await p.evaluate(() => !document.querySelector('.squ-dlg b b')), t.slice(0, 500));
    rec('M6 LH row + RH line for T09 / 12: ❓ "revised line? — this house already has "HOUSE TYPE B LH"", 1 to add (the quartz)', v.uns === 1 && v.add === 1 && /revised line\? — this house already has "HOUSE TYPE B LH" \(kitchen\)/.test(t), JSON.stringify([v.add, v.uns]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  } finally { await browser.close(); }
  X.finish();
})();
