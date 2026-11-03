// Cutting-list flow, step 7 (Garry, answer 1): the saw sees a full-width "NEW LIST ISSUED – Rev 2 replaces Rev 1
// (x changed / y added / z removed)" when a list on the saw was reissued since this saw PC last looked, and
// "replaces <old list>" for a list made with "Make new list from this". ✓ Seen clears it on that PC only.
// Lists home: an archived list that was replaced shows "Superseded (view only)" with no Edit button.
// Fake Supabase only. Run: node tests/stage3/flow7-newlist.test.js
const F = require('./fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 600))); };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  // L1: a plain Rev 1 list (no banner). L2: Rev 2 — Top changed, Back added, Shelf removed. L3 replaced OLD (archived).
  F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'] });
  F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'], list: { rev: 2, locked: true }, lines: [
    ['saw', 'Side', '2', 720, 560, 'MFC White', '', '', { added_rev: 1 }],
    ['saw', 'Top', '1', 1300, 560, 'MFC White', '', '', { added_rev: 1, changed_rev: 2 }],
    ['saw', 'Back', '1', 700, 500, 'MFC White', '', '', { added_rev: 2 }],
    ['saw', 'Shelf', '2', 500, 300, 'MFC White', '', '', { added_rev: 1, removed_rev: 2 }]] });
  F.seedList(S, 'OLD', { name: 'House 3', wos: ['WO-1'], list: { archived: true } });
  F.seedList(S, 'L3', { name: 'House 3 (new)', wos: ['WO-1'], list: { log: [{ at: '2026-10-21T08:00:00Z', by: 'Ann', what: 'List created', why: 'Made with "Make new list from this" from "House 3" — replaces list OLD', replaces: 'OLD' }] } });
  const saw = await F.dev(browser, S, 'saw');
  const ban = () => saw.page.evaluate(() => { const b = document.getElementById('saw-newlist'); return b ? { t: b.innerText, rows: b.querySelectorAll('.snl-row').length, w: Math.round(b.getBoundingClientRect().width), vw: document.querySelector('.wl') ? Math.round(document.querySelector('.wl').getBoundingClientRect().width) : 0 } : null; });
  let b = await ban();
  rec('saw: "NEW LIST ISSUED – House 2: Rev 2 replaces Rev 1 (1 changed / 1 added / 1 removed)"', b && /NEW LIST ISSUED – House 2: Rev 2 replaces Rev 1 \(1 changed \/ 1 added \/ 1 removed\)/.test(b.t), JSON.stringify(b));
  rec('saw: the replacement says which list it replaces ("House 3 (new)" replaces "House 3")', b && /NEW LIST ISSUED – House 3 \(new\): replaces "House 3"/.test(b.t), JSON.stringify(b));
  rec('saw: no banner for a plain Rev 1 list (House 1)', b && !/House 1\b/.test(b.t), JSON.stringify(b));
  rec('saw: the banner is full width', b && b.w > 0 && b.vw - b.w < 60, JSON.stringify(b));
  await saw.page.evaluate(() => document.querySelector('[data-sawseen="L2"]').click());
  b = await ban();
  rec('✓ Seen on House 2: its line goes, the other stays', b && b.rows === 1 && !/House 2/.test(b.t) && /House 3/.test(b.t), JSON.stringify(b));
  await saw.page.evaluate(() => document.querySelector('[data-sawseen="L3"]').click());
  rec('✓ Seen on both: no banner', !(await ban()));
  // Rev 3 later: the banner comes back for it
  D.update(S.db, 'lists', D.find(S.db, 'lists', 'L2'), { rev: 3 });
  await saw.page.evaluate(async () => { await lsReloadList('L2'); render(); });
  b = await ban();
  rec('House 2 reissued as Rev 3: "Rev 3 replaces Rev 2" shows again', b && /House 2: Rev 3 replaces Rev 2/.test(b.t), JSON.stringify(b));
  // escaping: a list name with HTML is shown as text
  D.update(S.db, 'lists', D.find(S.db, 'lists', 'L2'), { name: '<img src=x onerror=window.__x=1>' });
  await saw.page.evaluate(async () => { await lsReloadList('L2'); render(); });
  rec('a list name with HTML is shown as text', await saw.page.evaluate(() => !window.__x && !document.querySelector('#saw-newlist img')));
  await saw.close();
  // ---- Lists home: superseded
  const off = await F.dev(browser, S, 'office');
  const h = await off.page.evaluate(() => { showTab('l'); LH.state = 'archived'; render(); const r = document.querySelector('[data-lhrow="OLD"]'); return r ? { t: r.innerText, edit: !!r.querySelector('[data-lhedit]'), view: !!r.querySelector('[data-lhview]') } : null; });
  rec('Lists home (Archived): the replaced list says "Superseded (view only)" and "replaced by House 3 (new)"; View, no Edit', h && /Superseded \(view only\)/.test(h.t) && /replaced by "House 3 \(new\)"/.test(h.t) && !h.edit && h.view, JSON.stringify(h));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await off.close();
  // ---- switch off: no banner
  {
    const row = F.v2Row(); delete row.settings.listStore; delete row.settings.listStoreAt;
    const S0 = F.makeServer(row); const s0 = await F.open(browser, S0, { now: F.NOW, role: 'saw' });
    rec('switch off: no NEW LIST ISSUED banner', await s0.page.evaluate(() => !document.getElementById('saw-newlist')));
    await s0.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
