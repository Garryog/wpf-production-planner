// Editor: anything typed or imported (descriptions, colours, sheet names, unit names, template names, notes) is shown as
// text in the new screens — import preview, editor grid and cards, Save as template, History, Insert unit — never run as
// HTML. Fake Supabase only. Run: node tests/editor/e12-escaping.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const wait = async (fn, ms = 4000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
const X = n => '<img src=x onerror="window.__x=(window.__x||[]).concat(\'' + n + '\')">"\'&';
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  D.insert(S.db, 'project_materials', { id: 'MX', project_id: 'P1', name: X('mat'), kind: 'sheet' });
  F.seedList(S, 'T1', { name: X('tname'), wos: [], list: { is_template: true, list_type: 'kitchen', type_name: X('ttype'), project_id: 'P1' }, lines: [
    ['hdr', X('unit'), '2', null, null, null, X('hnote'), '', {}], ['saw', X('part'), '4', 700, 560, X('colour'), X('edge'), X('note'), { section: 'u', unit_qty: '2' }]] });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.prompt = (m) => /PIN/.test(m) ? '7777' : 'Tester'; window.confirm = () => true; });
  const imgs = () => pg.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === 'x').length);
  // import preview
  const b64b = await pg.evaluate(src => { const X = eval(src); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Project', X('proj')], [X('uhead')], [null, 2, 'total nr of units'], [X('desc'), 4, 700, 560, X('col'), X('edg')], [X('hinge'), 8, null, null, X('spec'), X('fnote')], [X('room'), null, null, 6]]), 'Sheet <b>1'); return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }); }, '(' + X.toString() + ')');
  await pg.evaluate(() => { showTab('l'); lhImpPid = 'P1'; });
  await pg.setInputFiles(await pg.evaluate(() => document.getElementById('lh-file') ? '#lh-file' : '#lst-file'), { name: '<i>evil</i>.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(b64b, 'base64') });
  await wait(() => pg.evaluate(() => !!document.getElementById('ip-ok')));
  const pv = await pg.evaluate(() => document.querySelector('.pod-ovl').innerText);
  rec('import preview shows the text as typed, runs nothing', (await imgs()) === 0 && /<img src=x/.test(pv) && /Sheet <b>1/.test(pv) && /<i>evil<\/i>\.xlsx/.test(pv), pv.slice(0, 200));
  await pg.evaluate(() => document.getElementById('ip-ok').click());
  await wait(() => pg.evaluate(() => !!document.getElementById('mm-ok') || /imported/.test(document.getElementById('toast').textContent)));
  rec('material matching shows the names as text', (await imgs()) === 0);
  await pg.evaluate(() => { const b = document.getElementById('mm-ok'); if (b) b.click(); });
  await wait(() => S.db.t.lists.some(l => /Sheet/.test(l.name)));
  // editor (desktop) on the imported list, and on the template
  const lid = S.db.t.lists.find(l => /Sheet/.test(l.name)).id;
  await pg.evaluate(async id => { await lsPoll(); openListEditor(id); }, lid);
  const ed = await pg.evaluate(() => [...document.querySelectorAll('.pod-ovl [data-mr]')].map(e => e.value).join('|'));
  rec('editor: values shown exactly as typed', (await imgs()) === 0 && ed.includes('<img src=x onerror="window.__x=(window.__x||[]).concat(\'desc\')">"\'&'), ed.slice(0, 160));
  await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  await pg.evaluate(() => { openListEditor('T1'); });
  rec('editor on a template with nasty names: nothing runs', (await imgs()) === 0);
  await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  // Save as template, History, Insert unit
  await pg.evaluate(id => { lsSaveAsTpl({ id }); }, lid);
  await wait(() => pg.evaluate(() => !!document.getElementById('at-ok')));
  rec('Save as template dialog: nothing runs', (await imgs()) === 0);
  await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  await pg.evaluate(() => lsTplHistory('T1'));
  await wait(() => pg.evaluate(() => !!document.querySelector('[data-threv]')));
  await pg.evaluate(() => document.querySelector('[data-threv="0"]').click());
  rec('History and its read-only view: nothing runs', (await imgs()) === 0);
  await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  await pg.evaluate(() => { openListEditor(null, 'WO-1', 'P1'); document.getElementById('me-instpl').click(); });
  await pg.evaluate(() => { const b = document.querySelector('[data-itt="T1"]'); if (b) b.click(); });
  await wait(() => pg.evaluate(() => !!document.getElementById('it-ok')));
  await pg.evaluate(() => document.getElementById('it-ok').click());
  rec('Insert unit from template: nothing runs, the unit name is copied as text', (await imgs()) === 0 && (await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="0|item"]').value)).startsWith('<img src=x'));
  // phone cards
  await pg.setViewportSize({ width: 360, height: 780 });
  await pg.evaluate(id => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); openListEditor(id); }, lid);
  rec('phone cards: nothing runs', (await imgs()) === 0);
  rec('no script from any name ever ran', !(await pg.evaluate(() => window.__x)), JSON.stringify(await pg.evaluate(() => window.__x)));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
