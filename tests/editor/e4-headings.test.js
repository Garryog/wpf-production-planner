// Editor step 4: headings are kept when a list is edited (the old editor dropped them, so an imported list lost its
// headings on the saw after any edit). Fake Supabase only. Run: node tests/editor/e4-headings.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  // an imported list: unit heading (3 units), parts with unit_qty, a per-house heading and extras
  F.seedList(S, 'L1', { name: 'House 1', lines: [
    ['hdr', '900 Single Rail', '3', null, null, null, '', '', {}],
    ['saw', 'Side panel', '6', 2380, 570, 'MFC White', 'L1LE 1mm', '', { section: '900 Single Rail', unit_qty: '2' }],
    ['saw', 'Shelves', '9', 864, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '3' }],
    ['hdr', 'Road 1 No 1', null, null, null, null, '', '', {}],
    ['saw', 'Kicker', '7', 2440, 125, 'MFC White', '', '', { section: 'Road 1 No 1' }]] });
  const o = await F.dev(browser, S, 'office');
  await o.page.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : 'Tester'; window.confirm = () => true; });
  const rows = await o.page.evaluate(() => lsEditRows('L1').map(r => [r.k, r.item, r.units == null ? '' : r.units, r.qty == null ? '' : r.qty].join('|')));
  rec('lsEditRows keeps the headings, with the units on the unit heading', rows[0] === 'hdr|900 Single Rail|3|' && rows[3] === 'hdr|Road 1 No 1||', rows.join(' ; '));
  rec('inside the unit block the editor shows the PER-UNIT quantity; outside it the total', rows[1] === 'saw|Side panel||2' && rows[2] === 'saw|Shelves||3' && rows[4] === 'saw|Kicker||7', rows.join(' ; '));
  // save a small edit (Kicker 7 → 8) through the editor: headings must still be there for the saw
  const r = await o.page.evaluate(async () => { const rows = lsEditRows('L1'); rows[4].qty = 8; try { await lsSaveManual({ wo: 'WO-1', name: 'House 1', pid: 'P1', rows }, 'Tester', lsList('L1')); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
  const live = S.db.t.list_lines.filter(x => x.list_id === 'L1' && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
  rec('after an edit the headings are still on the list (not removed)', r === 'ok' && live.filter(x => x.kind === 'hdr').length === 2 && D.find(S.db, 'list_lines', 'L1:1').removed_rev == null && D.find(S.db, 'list_lines', 'L1:4').removed_rev == null, r + ' ' + JSON.stringify(live.map(x => x.kind + ':' + x.part)));
  rec('unit totals unchanged by the edit (6 and 9), Kicker now 8', D.find(S.db, 'list_lines', 'L1:2').qty === '6' && D.find(S.db, 'list_lines', 'L1:3').qty === '9' && D.find(S.db, 'list_lines', 'L1:5').qty === '8');
  const saw = await o.page.evaluate(async () => { lsReset(); await lsLoad(); return listRows(lsList('L1')).filter(x => x.k === 'hdr').map(x => x.item).join('|'); });
  rec('the saw still sees both headings', saw === '900 Single Rail – 3 units|Road 1 No 1', saw);
  // the editor shows heading rows
  const ev = await o.page.evaluate(() => { openListEditor('L1'); const ov = document.querySelector('.pod-ovl'); const v = [...ov.querySelectorAll('input')].map(i => i.value); ov.remove(); return v; });
  rec('the editor has the heading names in its rows', ev.includes('900 Single Rail') && ev.includes('Road 1 No 1'), ev.join('|').slice(0, 300));
  // edit merge: another screen renamed a heading meanwhile; my untouched copy of it keeps theirs
  const merge = await o.page.evaluate(async () => {
    lsReset(); await lsLoad(); const rows = lsEditRows('L1');
    return rows.length;
  });
  D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'L1:4'), { part: 'Road 1 No 1 (extras)', updated_at: '2026-10-21T10:00:00.000Z' });
  const m2 = await o.page.evaluate(async () => {
    const rows = window.__rows || lsEditRows('L1'); rows[4].qty = 9; // I only change Kicker
    await lsReloadList('L1');
    try { await lsSaveManual({ wo: 'WO-1', name: 'House 1', pid: 'P1', rows }, 'Tester', lsList('L1')); return 'ok'; } catch (e) { return 'ERR ' + e.message; }
  });
  rec('edit merge: a heading renamed on another screen is kept when I save my own change', merge === 5 && m2 === 'ok' && D.find(S.db, 'list_lines', 'L1:4').part === 'Road 1 No 1 (extras)' && D.find(S.db, 'list_lines', 'L1:5').qty === '9', JSON.stringify([merge, m2, D.find(S.db, 'list_lines', 'L1:4').part]));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
