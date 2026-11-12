// Simple lists (Garry, 4 Nov) items 1, 2, 3, 7, 8 in the list editor: "+ Heading" first; sub-headings; unit blocks hidden
// unless ticked under More (or the list has them); a "Bought in" tick per row; fewer buttons (the rest under More), help
// behind "?", bigger type; a Stores row's colour box reads "item / spec"; Insert from template puts a whole house type in.
// Fake Supabase only. Run: node tests/editor/s3-simple-editor.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const J = JSON.stringify;
const set = (k, v) => `(()=>{const e=document.querySelector('.pod-ovl [data-mr="${k}"]');e.focus();e.value=${JSON.stringify(v)};(e.tagName==='SELECT'?e.onchange:e.oninput)();})()`;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  // a robe list with a unit block, and an Aspect-style house-type template (no unit blocks)
  F.seedList(S, 'LU', { name: 'Robes', wos: ['WO-2'], lines: [['hdr', '900 Single Rail', '3', null, null, null, '', '', {}], ['saw', 'Side panel', '6', 2380, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '2' }]] });
  F.seedList(S, 'T1', { name: 'Type A', wos: [], list: { is_template: true, type_name: 'Type A' }, lines: [
    ['hdr', 'House', null, null, null, null, '', '', {}], ['hdr', 'Fillers and Kickers', null, null, null, null, '', '', { section: 'House' }],
    ['saw', 'Kicker', '3', 2400, 150, 'MFC White', 'L1LE 1mm', '', { section: 'Fillers and Kickers' }],
    ['buy', 'Panel Back', '1', 900, 1842, 'MFC White', '', '', { section: 'Fillers and Kickers' }],
    ['fit', 'Sink', '1', null, null, 'Hafele Calder', '', 'Talk to Ollie', { section: 'Fillers and Kickers' }]] });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why/.test(m) ? 'site measure' : 'Tester'; window.confirm = () => true; setWho('Ann'); });
  // ---- a new list: the bar
  const a = await pg.evaluate(() => { openListEditor(null, 'WO-2', 'P1'); const ov = document.querySelector('.pod-ovl'), bar = ov.querySelector('.me-bar');
    const vis = el => !!el && !el.hidden && !el.closest('details:not([open]) > div') && getComputedStyle(el).display !== 'none';
    return { startIds: [...ov.querySelectorAll('#me-start button')].map(b => b.id).join(), first: bar.querySelector('button').id, firstCls: bar.querySelector('button').className, barBtns: [...bar.querySelectorAll(':scope > button')].map(b => b.id),
      more: !!ov.querySelector('#me-more'), moreOpen: ov.querySelector('#me-more').open, unitVis: vis(ov.querySelector('#me-addunit')), unitInDom: !!ov.querySelector('#me-addunit'),
      keysHidden: ov.querySelector('.me-keys').hidden, carcInMore: !!ov.querySelector('#me-more #me-carc'), nocutInMore: !!ov.querySelector('#me-more #me-nocut'),
      units: ov.querySelector('#me-units').checked, font: getComputedStyle(ov.querySelector('[data-mr="0|item"]')).fontSize, longHelp: /Rows with a length or width go to the/.test(ov.querySelector('.pod-in').innerText) }; });
  rec('"＋ Heading" is the first button, and green', a.first === 'me-addhdr' && /btn-g/.test(a.firstCls), J(a));
  rec('the bar keeps only + Heading, + Row, Project materials and "?" (12 Nov: template / Excel / old list are under ONE "Start from…" at the top; everything else under More)', J(a.barBtns) === J(['me-addhdr', 'me-addsaw', 'me-mats', 'me-help']) && a.startIds === 'me-instpl,me-impxl,me-findold', J(a.barBtns));
  rec('More holds No cutting / No fittings, Unit blocks and the carcass / door colours; it starts closed', a.more && !a.moreOpen && a.carcInMore && a.nocutInMore, J(a));
  rec('unit blocks hidden by default on a new list (Unit blocks unticked, "+ Unit block" not shown)', !a.units && !a.unitVis && a.unitInDom, J(a));
  rec('help and keyboard hints are behind "?" (hidden until pressed); no long help text on screen', a.keysHidden && !a.longHelp, J(a));
  rec('bigger type in the grid (15px)', a.font === '15px', a.font);
  const hq = await pg.evaluate(() => { document.getElementById('me-help').click(); const v = !document.querySelector('.pod-ovl .me-keys').hidden; return v && /Ctrl\+D/.test(document.querySelector('.pod-ovl .me-keys').innerText); });
  rec('"?" shows the help and the keyboard', hq);
  // ---- headings: the first heading goes first; the next one is a sub-heading
  await pg.evaluate(() => document.getElementById('me-addhdr').click());
  const h1 = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return { r0: ov.querySelector('[data-row="0"]').className, f: document.activeElement.dataset.mr, n: ov.querySelectorAll('.me-grid tbody tr').length }; });
  rec('+ Heading on a new list puts the heading FIRST (above the empty row), cursor in it', /me-h/.test(h1.r0) && h1.f === '0|item' && h1.n === 2, J(h1));
  await pg.evaluate(set('0|item', 'House nr 103'));
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="1|item"]').focus(); document.getElementById('me-addhdr').click(); });
  const h2 = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'), r = ov.querySelector('[data-row="1"]'); return { cls: r.className, sel: r.querySelector('[data-mhs]').value, tag: r.querySelector('.me-ht').textContent, n: ov.querySelectorAll('[data-row]').length, last: ov.querySelector('[data-row="2"]').className }; });
  rec('a heading added under the house starts as a Sub-heading, ABOVE the empty row (which is now under it)', /me-hs/.test(h2.cls) && h2.sel === 'sub' && h2.tag === 'Sub' && h2.n === 3 && /me-p/.test(h2.last), J(h2));
  await pg.evaluate(set('1|item', 'Fillers and Kickers'));
  // rows: a saw row, a stores row, a bought-in row
  await pg.evaluate(set('2|item', 'Kicker')); await pg.evaluate(set('2|qty', '3')); await pg.evaluate(set('2|L', '2400')); await pg.evaluate(set('2|W', '150')); await pg.evaluate(set('2|mat', 'MFC White'));
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="2|item"]').focus(); document.getElementById('me-addsaw').click(); });
  await pg.evaluate(set('3|item', 'Sink')); await pg.evaluate(set('3|qty', '1'));
  const st = await pg.evaluate(() => { const s = document.querySelector('.pod-ovl [data-mr="3|mat"]'); s.value = ''; s.onchange && s.onchange(); return { tag: document.querySelector('.pod-ovl [data-tag="3"]').textContent };});
  await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); ov.querySelector('[data-mr="0|item"]').focus(); ov.querySelector('#me-help').click(); });
  const st2 = await pg.evaluate(() => { const s = document.querySelector('.pod-ovl [data-mr="3|mat"]'); return s.options[0].text; });
  rec('a Stores row (no size) is tagged "Stores" and its colour box reads "— item / spec —"', st.tag === 'Stores' && st2 === '— item / spec —', J([st, st2]));
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="3|item"]').focus(); document.getElementById('me-addsaw').click(); });
  await pg.evaluate(set('4|item', 'Panel Back')); await pg.evaluate(set('4|qty', '1')); await pg.evaluate(set('4|L', '900')); await pg.evaluate(set('4|W', '1842'));
  const bi = await pg.evaluate(() => { const c = document.querySelector('.pod-ovl [data-mbuy="4"]'); c.checked = true; c.onchange(); return { tag: document.querySelector('.pod-ovl [data-tag="4"]').textContent, cls: document.querySelector('.pod-ovl [data-row="4"]').className }; });
  rec('ticking Bought in tags the row "Bought in"', bi.tag === 'Bought in' && /me-buy/.test(bi.cls), J(bi));
  await pg.evaluate(() => { document.querySelector('#me-name').value = 'House nr 103'; document.getElementById('me-save').click(); });
  await F.sleep(800);
  const nl = S.db.t.lists.find(l => l.name === 'House nr 103');
  const ln = nl ? S.db.t.list_lines.filter(x => x.list_id === nl.id && x.removed_rev == null).sort((x, y) => x.seq - y.seq) : [];
  rec('saved (no colour needed on a bought-in panel): heading, sub-heading (section = house), saw, stores, BUY', ln.map(x => x.kind + ':' + x.part + ':' + (x.section || '')).join('|') === 'hdr:House nr 103:|hdr:Fillers and Kickers:House nr 103|saw:Kicker:Fillers and Kickers|fit:Sink:Fillers and Kickers|buy:Panel Back:Fillers and Kickers', J(ln.map(x => [x.kind, x.part, x.section])));
  rec('the bought-in line keeps its sizes; n_saw / n_fit leave it out', ln[4] && +ln[4].length_mm === 900 && +ln[4].width_mm === 1842 && nl.n_saw === 1 && nl.n_fit === 1, J([ln[4], nl && nl.n_saw, nl && nl.n_fit]));
  // reopen: the sub-heading and Bought in come back
  const re = await pg.evaluate(id => { openListEditor(id); const ov = document.querySelector('.pod-ovl'); const r = { sub: ov.querySelector('[data-mhs="1"]').value, buy: ov.querySelector('[data-mbuy="4"]').checked, units: ov.querySelector('#me-units').checked }; ov.remove(); return r; }, nl.id);
  rec('reopened: the sub-heading is still a sub-heading, Bought in still ticked, unit blocks still hidden', re.sub === 'sub' && re.buy && !re.units, J(re));
  // ---- a list that HAS unit blocks shows them (and the tick can't be taken off)
  const u = await pg.evaluate(() => { openListEditor('LU'); const ov = document.querySelector('.pod-ovl'); const r = { on: ov.querySelector('#me-units').checked, dis: ov.querySelector('#me-units').disabled, btn: !ov.querySelector('#me-addunit').hidden, units: ov.querySelector('[data-mr="0|units"]').value }; ov.remove(); return r; });
  rec('a list with unit blocks shows them (Unit blocks ticked and locked on, "+ Unit block" offered)', u.on && u.dis && u.btn && u.units === '3', J(u));
  // ticking Unit blocks under More shows "+ Unit block"
  const u2 = await pg.evaluate(() => { openListEditor(null, 'WO-2', 'P1'); const ov = document.querySelector('.pod-ovl'), c = ov.querySelector('#me-units'); c.checked = true; c.onchange(); const r = !document.querySelector('.pod-ovl #me-addunit').hidden; return r; });
  rec('ticking "Unit blocks (robe jobs)" shows "+ Unit block"', u2);
  await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // ---- Insert from template: a house-type template goes in whole (headings, sub-headings, bought in)
  await pg.evaluate(() => { openListEditor(null, 'WO-2', 'P1'); document.getElementById('me-instpl').click(); });
  await F.sleep(100);
  await pg.evaluate(() => document.querySelector('[data-itt="T1"]').click());
  await F.sleep(400);
  const ins = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return { n: document.querySelectorAll('.pod-ovl').length, rows: [...ov.querySelectorAll('[data-row]')].map(r => r.className.replace(/\s+/g, ' ') + ':' + (r.querySelector('[data-mr$="|item"]') || {}).value), buy: (ov.querySelector('[data-mbuy="3"]') || {}).checked, t: document.getElementById('toast').textContent }; });
  rec('Insert from template (house type): the whole template goes in, no "how many units" question', ins.n === 1 && ins.rows.length === 5 && /Added 5 rows from template Type A/.test(ins.t), J(ins));
  rec('…headings stay headings / sub-headings and Bought in stays ticked', /me-h/.test(ins.rows[0]) && /me-hs/.test(ins.rows[1]) && ins.buy === true, J(ins.rows));
  await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // ---- phone: Heading / Sub-heading box and the Bought in tick are on the cards
  const ph = await F.dev(browser, S, 'office', { viewport: { width: 360, height: 760 } });
  const pc = await ph.page.evaluate(id => { openListEditor(id); const ov = document.querySelector('.pod-ovl'); return { cards: ov.querySelectorAll('.me-card').length, sub: !!ov.querySelector('.me-card [data-mhs]'), buy: !!ov.querySelector('.me-card [data-mbuy]'), lab: [...ov.querySelectorAll('.me-card .me-cl > span')].map(s => s.textContent).includes('Item / spec') }; }, nl.id);
  rec('phone: cards have the Heading / Sub-heading box, the Bought in tick and "Item / spec" on a Stores row', pc.cards === 5 && pc.sub && pc.buy && pc.lab, J(pc));
  await ph.close();
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
