// Editor step 11: on a phone (under 700 px) each row is a card with the same boxes, big enough to tap; no Excel
// shortcuts; nothing runs off the side. Saving works the same. Fake Supabase only. Run: node tests/editor/e11-phone.test.js
const F = require('../stage3/fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1', lines: [
    ['hdr', '900 Single Rail', '3', null, null, null, '', '', {}],
    ['saw', 'Side panel', '6', 2380, 570, 'MFC White', 'L1LE 1mm', '', { section: '900 Single Rail', unit_qty: '2' }],
    ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '', {}]] });
  const o = await F.dev(browser, S, 'office', { viewport: { width: 360, height: 780 } }), pg = o.page;
  await pg.evaluate(() => { window.prompt = () => 'Tester'; window.confirm = () => true; openListEditor('L1'); });
  const a = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'), pin = ov.querySelector('.pod-in');
    const small = [...ov.querySelectorAll('.me-card input, .me-card select')].filter(e => e.getBoundingClientRect().height < 40).length;
    return { cards: ov.querySelectorAll('.me-card').length, table: !!ov.querySelector('.me-grid'), over: pin.scrollWidth - pin.clientWidth, docOver: document.documentElement.scrollWidth - 360, small,
      u: (ov.querySelector('[data-mr="0|units"]') || {}).value, q: (ov.querySelector('[data-mr="1|qty"]') || {}).value, tot: (ov.querySelector('[data-tot="1"]') || {}).textContent, stores: !ov.querySelector('[data-tag="2"]').hidden,
      keys: getComputedStyle(ov.querySelector('.me-keys')).display, font: getComputedStyle(ov.querySelector('[data-mr="1|item"]')).fontSize }; });
  rec('phone: one card per row (no table)', a.cards === 3 && !a.table, JSON.stringify(a));
  rec('phone: nothing runs off the side of the screen', a.over <= 1 && a.docOver <= 1, JSON.stringify({ over: a.over, docOver: a.docOver }));
  rec('phone: every box is at least 40 px tall and 16 px text (no zoom-in on tap)', a.small === 0 && a.font === '16px', JSON.stringify({ small: a.small, font: a.font }));
  rec('phone: unit heading with Units, per-unit Qty with the total, the Stores tag', a.u === '3' && a.q === '2' && a.tot === '= 6' && a.stores, JSON.stringify(a));
  rec('phone: the keyboard-shortcut line is hidden', a.keys === 'none', a.keys);
  // typing + Enter does NOT jump rows on a phone (no Excel shortcuts)
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="1|qty"]').focus());
  await pg.keyboard.press('Control+d');
  await pg.keyboard.press('Enter');
  const k = await pg.evaluate(() => [document.activeElement.dataset.mr, document.querySelectorAll('.pod-ovl .me-card').length]);
  rec('phone: Enter / Ctrl+D do nothing special', k[0] === '1|qty' && k[1] === 3, JSON.stringify(k));
  // edit and save from the phone
  await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="1|qty"]'); e.value = '3'; e.oninput(); document.querySelector('.pod-ovl [data-mr="2|item"]').focus(); document.getElementById('me-addsaw').click(); });
  await pg.evaluate(() => { const s = (k, v) => { const e = document.querySelector('.pod-ovl [data-mr="' + k + '"]'); e.value = v; e.oninput(); }; s('3|item', 'Kicker'); s('3|qty', '2'); s('3|L', '2440'); s('3|W', '125'); });
  const add = await pg.evaluate(() => ({ n: document.querySelectorAll('.pod-ovl .me-card').length, mat: document.querySelector('.pod-ovl [data-mr="3|mat"]').value }));
  rec('phone: ＋ Row adds a card under the one you were on (colour from the SAW row above, not the Stores row — Garry, 3 Nov)', add.n === 4 && add.mat === 'MFC White', JSON.stringify(add));
  await pg.evaluate(() => { const s = document.querySelector('.pod-ovl [data-mr="3|mat"]'); s.value = 'MFC White'; s.onchange(); document.getElementById('me-save').click(); });
  for (let i = 0; i < 30 && S.db.t.list_lines.filter(x => x.list_id === 'L1').length < 4; i++) await F.sleep(100);
  const ln = S.db.t.list_lines.filter(x => x.list_id === 'L1' && x.removed_rev == null).sort((x, y) => x.seq - y.seq);
  rec('phone: saved like the desktop (Side 9 = 3 × 3; Hinge with no stored per-unit stays 8; Kicker 2 × 3 = 6)', ln.map(x => x.part + ':' + x.qty).join(',') === '900 Single Rail:3,Side panel:9,Hinge:8,Kicker:6', ln.map(x => x.part + ':' + x.qty).join(','));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
