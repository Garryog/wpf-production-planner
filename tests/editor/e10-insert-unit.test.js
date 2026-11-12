// Editor step 10: "Insert unit from template…" — pick a template of the project, one of its unit blocks (or the whole
// template as one unit), how many units; the parts go in with the per-unit quantity and the total follows Units.
// Fake Supabase only. Run: node tests/editor/e10-insert-unit.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const wait = async (fn, ms = 4000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
const grid = pg => pg.evaluate(() => [...document.querySelectorAll('.pod-ovl .me-grid tbody tr')].map(tr => { const v = f => { const e = tr.querySelector('[data-mr$="|' + f + '"]'); return e ? e.value : null; };
  return tr.classList.contains('me-h') ? 'h:' + v('item') + (v('units') != null ? '×' + v('units') : '') : [v('item'), v('qty'), v('L'), v('W'), v('mat')].join('|'); }));
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  // the customer's unit library as a template (like the Blank sheet): two units, N = 1 each, plus an old template with no units
  F.seedList(S, 'T1', { name: 'Standard units', wos: [], list: { is_template: true, list_type: 'other', type_name: 'Standard units' }, lines: [
    ['hdr', '450 Robe fully shelved', '1', null, null, null, '', '', {}],
    ['saw', 'Side panel', '2', 2380, 570, 'MFC White', 'L1LE 1mm', '', { section: '450 Robe fully shelved', unit_qty: '2' }],
    ['saw', 'Shelves', '3', 414, 570, 'MFC White', 'L1LE 1mm', '', { section: '450 Robe fully shelved', unit_qty: '3' }],
    ['hdr', '900 Single Rail + 2 shelves', '2', null, null, null, '', '', {}],
    ['saw', 'Side Panel', '4', 2380, 570, 'MFC White', 'L1LE 1mm', '', { section: '900 Single Rail + 2 shelves' }], // old line: no unit_qty → 4 ÷ 2
    ['fit', 'Hanging rail', '2', null, null, '', '', '', { section: '900 Single Rail + 2 shelves', unit_qty: '1' }]] });
  F.seedList(S, 'T2', { name: 'Type B', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B' }, lines: [['saw', 'Gable', '2', 900, 560, 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']] });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.prompt = () => 'Tester'; window.confirm = () => true; openListEditor(null, 'WO-1'); document.getElementById('me-instpl').click(); });
  const l1 = await pg.evaluate(() => [...document.querySelectorAll('[data-itt]')].map(b => b.closest('.wl-drow').querySelector('b').textContent).join('|'));
  rec('the project\'s templates are offered', l1 === 'Standard units|Type B', l1);
  await pg.evaluate(() => document.querySelector('[data-itt="T1"]').click());
  await wait(() => pg.evaluate(() => !!document.getElementById('it-ok')));
  const ch = await pg.evaluate(() => [...document.querySelectorAll('[name="it-u"]')].map(r => r.closest('label').textContent.trim()));
  rec('its unit blocks are offered, plus the whole template as one unit', ch.length === 3 && /^450 Robe fully shelved \(2 parts\)/.test(ch[0]) && /^900 Single Rail \+ 2 shelves \(2 parts\)/.test(ch[1]) && /whole template as one unit/.test(ch[2]), ch.join(' | '));
  await pg.evaluate(() => { document.querySelector('[name="it-u"][value="1"]').checked = true; const n = document.getElementById('it-n'); n.value = '0'; document.getElementById('it-ok').click(); });
  const e0 = await pg.evaluate(() => document.getElementById('it-err').textContent);
  rec('"How many units?" must be a whole number, 1 or more', /whole number, 1 or more/.test(e0), e0);
  await pg.evaluate(() => { document.getElementById('it-n').value = '3'; document.getElementById('it-ok').click(); });
  const g1 = await grid(pg);
  rec('inserted: unit heading × 3 and its parts with the quantity for ONE unit (old line 4 ÷ 2 = 2); the empty first row is replaced', g1.join(';') === 'h:900 Single Rail + 2 shelves×3;Side Panel|2|2380|570|MFC White;Hanging rail|1|||', g1.join(';'));
  const tot = await pg.evaluate(() => [document.querySelector('[data-tot="1"]').textContent, document.querySelector('[data-tot="2"]').textContent, document.activeElement.dataset.mr]);
  rec('totals shown (6 and 3) and the cursor is on Units so it can be changed', tot[0] === '= 6' && tot[1] === '= 3' && tot[2] === '0|units', JSON.stringify(tot));
  // a template without unit headings, as one unit of 2
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="2|item"]').focus(); document.getElementById('me-instpl').click(); document.querySelector('[data-itt="T2"]').click(); });
  await wait(() => pg.evaluate(() => !!document.getElementById('it-ok')));
  await pg.evaluate(() => { document.getElementById('it-n').value = '2'; document.getElementById('it-ok').click(); });
  const g2 = await grid(pg);
  rec('a template with no unit blocks goes in as one unit named after it, after the current block', g2.slice(3).join(';') === 'h:Type B×2;Gable|2|900|560|MFC White;Hinge|8|||Blum hinge', g2.join(';'));
  // save: totals stored, nothing linked to the template
  await pg.evaluate(() => { document.querySelector('#me-name').value = 'House 5'; document.getElementById('me-save').click(); });
  await wait(() => S.db.t.lists.some(l => l.name === 'House 5'));
  const l = S.db.t.lists.find(x => x.name === 'House 5'), ln = S.db.t.list_lines.filter(x => x.list_id === l.id).sort((a, b) => a.seq - b.seq);
  rec('saved: Side Panel 6 to cut (2 × 3), Gable 4 (2 × 2), Hinge 16; not linked to the templates', ln.map(x => x.qty).join(',') === '3,6,3,2,4,16' && !l.template_id && ln.every(x => !x.src_line_id), ln.map(x => x.part + ':' + x.qty).join(','));
  // a project with no templates
  await pg.evaluate(() => { openListEditor(null, 'WO-1'); const p = document.querySelector('.pod-ovl #me-pid'); if (p) { p.value = ''; p.onchange({ target: p }); } }); // list-window release: no project drop-down when opened for a WO
  D.insert(S.db, 'projects', { id: 'P9', name: 'Empty project' });
  await pg.evaluate(async () => { await lsPoll(); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); openListEditor(null, '', 'P9'); document.getElementById('me-instpl').click(); });
  const none = await pg.evaluate(() => document.querySelectorAll('.pod-ovl')[1].innerText);
  rec('no templates in the project: says how to make one', /has no templates yet/.test(none) && /Save as template/.test(none), none.slice(0, 200));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
