// Coder check (F1 gap, 12 Nov): Floor + Unit typed, the person goes on into the Title box — the WO is NOT filled in yet; it is
// looked up when they leave the Title box, so "BLOCK B" in the Title stops Block A's job (same floor + unit) being filled in.
// Fake Supabase only. Run: node tests/list-window/coder-f1-title-after.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, asks, setid } = L;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { wo: (q('#me-wo') || {}).value || '', ok: (q('#me-jbok') || {}).innerText || '', picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick) }; });
const typeAndLeave = async (p, title) => {
  await closeAll(p); await p.evaluate(() => openListEditor(null, '', 'PK')); await sleep(600);
  await setid(p, 'me-jf', '1'); await setid(p, 'me-ju', '12');
  await p.evaluate(() => { document.getElementById('me-ju').focus(); document.getElementById('me-jt').focus(); }); await sleep(250); // Unit → Title (Tab)
  const mid = await st(p);
  await setid(p, 'me-jt', title); await p.evaluate(() => document.getElementById('me-jt').blur()); await sleep(400);
  return { mid, end: await st(p) };
};
(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(H.order({ wo: 'WO-TA', customer: 'Kildare Homes', floor: '1', unit: '12', title: 'BLOCK A APT 12 KITCHEN', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
    const S = X.makeServer(r);
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    let s = await typeAndLeave(p, 'BLOCK B APT 12 KITCHEN');
    rec('Floor 1 · Unit 12, then on into the Title box → nothing filled in yet', !s.mid.wo, JSON.stringify(s.mid));
    rec('…Title "BLOCK B APT 12" typed and left → Block A\'s WO-TA is NOT filled in; it is offered in the pick list (not sure)', s.end.wo !== 'WO-TA' && s.end.picks.includes('WO-TA'), JSON.stringify(s.end));
    s = await typeAndLeave(p, 'BLOCK A APT 12 KITCHEN');
    rec('…Title "BLOCK A APT 12" (same block) → WO-TA filled in by itself as before', s.end.wo === 'WO-TA' && /Matched WO-TA/.test(s.end.ok), JSON.stringify(s.end));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
