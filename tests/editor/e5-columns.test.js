// Editor step 5: the columns of WPF's sheets (Description | Qty | Length | Width | Colour | Edging | Note), no Saw/Fit
// column (a row with a length or width goes to the Saw, without to Stores), Colour dropdown of the project's materials with
// "+ Add new material…" (PIN rules; without the PIN: this row only, flagged), Edging suggestions, new rows take the colour
// of the row above, header carcass/door colour as an optional default. Fake Supabase only.
// Run: node tests/editor/e5-columns.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const S_ = (k, v) => `(()=>{const e=document.querySelector('.pod-ovl [data-mr="${k}"]');e.value=${JSON.stringify(v)};(e.tagName==='SELECT'?e.onchange:e.oninput)();})()`;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' }); // edging "1mm ABS" already used on the project
  D.insert(S.db, 'project_materials', { id: 'MW', project_id: 'P1', name: 'W/W', kind: 'sheet' });
  const o = await F.dev(browser, S, 'office');
  const pg = o.page;
  await pg.evaluate(() => { window.__prompts = []; window.__ans = []; window.prompt = (m, d) => { window.__prompts.push(m); return window.__ans.length ? window.__ans.shift() : 'Tester'; }; window.confirm = () => true; });
  const a = await pg.evaluate(() => { openListEditor(null, 'WO-1'); const ov = document.querySelector('.pod-ovl');
    return { th: [...ov.querySelectorAll('.me-grid thead th')].map(t => t.textContent).filter(Boolean).join('|'), k: ov.querySelectorAll('.me-k').length, fit: !!ov.querySelector('#me-addfit'),
      opts: [...ov.querySelector('[data-mr="0|mat"]').options].map(x => x.value).join('|'), groups: [...ov.querySelector('[data-mr="0|mat"]').querySelectorAll('optgroup')].map(g => g.label).join('|'),
      edg: [...ov.querySelectorAll('#me-edg option')].map(x => x.value).join('|'), list: ov.querySelector('[data-mr="0|edging"]').getAttribute('list') }; });
  rec('columns: Description | Qty | Length | Width | Colour | Edging 1 | Edging 2 | Note | Bought in (Bought in tick and the second edging column added 4 Nov)', a.th === 'Description|Qty|Length|Width|Colour|Edging 1|Edging 2|Note|Bought in', a.th);
  rec('no Saw / Fittings column and no "+ Fittings row" button', a.k === 0 && !a.fit);
  rec('Colour is a dropdown of the project\'s materials + "＋ Add new material…" (fittings offered on a row with no size)', a.opts === '|MFC White|W/W|Blum hinge|__add' && a.groups === 'Boards / colours|Fittings & hardware', a.opts + ' / ' + a.groups);
  rec('Edging offers L1LE 1mm, L2S1LE, L4S 1mm, L4S 2mm, No edge and codes used on the project; free text allowed', a.edg === 'L1LE 1mm|L2S1LE|L4S 1mm|L4S 2mm|No edge|1mm ABS' && a.list === 'me-edg', a.edg);
  // type a saw row and a stores row
  await pg.evaluate(S_('0|item', 'Side panel')); await pg.evaluate(S_('0|qty', '2')); await pg.evaluate(S_('0|L', '2380')); await pg.evaluate(S_('0|W', '570')); await pg.evaluate(S_('0|mat', 'W/W'));
  const t0 = await pg.evaluate(() => document.querySelector('[data-tag="0"]').hidden);
  rec('a row with a length/width has no Stores tag', t0 === true);
  await pg.evaluate(() => { document.querySelector('[data-mr="0|item"]').focus(); document.getElementById('me-addsaw').click(); });
  const b = await pg.evaluate(() => ({ mat: document.querySelector('[data-mr="1|mat"]').value, focus: document.activeElement && document.activeElement.dataset.mr }));
  rec('＋ Row adds a row under the current one with the colour of the row above, cursor in its Description', b.mat === 'W/W' && b.focus === '1|item', JSON.stringify(b));
  await pg.evaluate(S_('1|item', 'Hanging rail')); await pg.evaluate(S_('1|qty', '1'));
  const t1 = await pg.evaluate(() => document.querySelector('[data-tag="1"]').hidden);
  rec('a row with no length or width shows the grey "Stores" tag as you type', t1 === false);
  // header carcass colour: default for a new row when there is no row above with a colour
  const c = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); const cc = ov.querySelector('#me-carc'); cc.value = 'MFC White'; cc.onchange({ target: cc });
    const r = [...ov.querySelectorAll('#me-carc option')].map(x => x.value).join('|'); return r; });
  rec('header Carcass colour: a dropdown of the project\'s boards (optional)', c === '|MFC White|W/W', c);
  // + Add new material… with the PIN → on the project's list and picked
  await pg.evaluate(() => { window.__ans = ['UD96', '7777']; });
  await pg.evaluate(S_('0|mat', '__add'));
  await F.sleep(500);
  const d = await pg.evaluate(() => ({ v: document.querySelector('[data-mr="0|mat"]').value, prompts: window.__prompts.slice(-2) }));
  rec('＋ Add new material… with the PIN: added to the project\'s materials and selected', d.v === 'UD96' && S.db.t.project_materials.some(m => m.project_id === 'P1' && m.name === 'UD96' && m.kind === 'sheet'), JSON.stringify(d));
  rec('… the PIN question says what it is for, in plain English', /needs the Production Manager, Drawing office or Admin PIN/.test(d.prompts[1] || ''), d.prompts[1]);
  // without the PIN (Cancel) → this row only, flagged amber, saved flagged
  await pg.evaluate(() => { localStorage.removeItem('wpfEditPin'); window.__ans = ['Oak Mystery', null]; document.getElementById('toast').textContent = ''; });
  await pg.evaluate(S_('1|mat', '__add'));
  await F.sleep(300);
  const e = await pg.evaluate(() => { const s = document.querySelector('[data-mr="1|mat"]'); return { v: s.value, txt: s.options[s.selectedIndex].text, amber: /fff4d6/.test(s.getAttribute('style')), toast: document.getElementById('toast').textContent }; });
  rec('no PIN: the colour is used on this row only, amber, and the person is told it is flagged', e.v === 'Oak Mystery' && /⚠ Oak Mystery/.test(e.txt) && e.amber && /used on this row only and flagged/.test(e.toast) && !S.db.t.project_materials.some(m => m.name === 'Oak Mystery'), JSON.stringify(e));
  // an existing material typed again is just picked
  await pg.evaluate(() => { window.__ans = ['w/w']; });
  await pg.evaluate(S_('1|mat', '__add'));
  await F.sleep(200);
  const e2 = await pg.evaluate(() => document.querySelector('[data-mr="1|mat"]').value);
  rec('typing a material that is already on the list (any case) just picks it', e2 === 'W/W', e2);
  await pg.evaluate(() => { window.__ans = ['Oak Mystery', null]; }); await pg.evaluate(S_('1|mat', '__add')); await F.sleep(200);
  // a heading and an empty row (left out at save)
  await pg.evaluate(() => { document.querySelector('[data-mr="1|item"]').focus(); document.getElementById('me-addhdr').click(); });
  await pg.evaluate(S_('2|item', 'Road 1 No 1 extras'));
  await pg.evaluate(() => { document.getElementById('me-addsaw').click(); });
  await pg.evaluate(S_('3|item', 'Kicker')); await pg.evaluate(S_('3|qty', '7')); await pg.evaluate(S_('3|L', '2440')); await pg.evaluate(S_('3|W', '125'));
  await pg.evaluate(() => document.getElementById('me-addsaw').click()); // an empty row at the end
  const err0 = await pg.evaluate(() => { const r = document.querySelector('[data-mr="3|mat"]'); const v = r.value; return v; });
  rec('rows under a heading still take the colour of the last SAW row above (not the Stores row — Garry, 3 Nov)', err0 === 'UD96', err0);
  await pg.evaluate(() => { document.querySelector('#me-name').value = 'House 9'; document.getElementById('me-save').click(); });
  for (let i = 0; i < 30 && !S.db.t.lists.some(l => l.name === 'House 9'); i++) await F.sleep(100);
  const l = S.db.t.lists.find(x => x.name === 'House 9'), ln = l ? S.db.t.list_lines.filter(x => x.list_id === l.id).sort((x, y) => x.seq - y.seq) : [];
  const br = ln.map(x => [x.kind, x.part, x.qty, x.material, x.material_other ? 'FLAG' : '', x.section || ''].join('|'));
  rec('saved: length/width → Saw, none → Stores, heading kept, empty row left out', br.join(';') === 'saw|Side panel|2|UD96||;fit|Hanging rail|1|Oak Mystery|FLAG|;hdr|Road 1 No 1 extras||||;saw|Kicker|7|UD96||Road 1 No 1 extras', br.join(';'));
  // validation messages, plain English
  const v = await pg.evaluate(() => { openListEditor(null, 'WO-2'); const ov = document.querySelector('.pod-ovl'); const set = (k, v) => { const e = ov.querySelector('[data-mr="' + k + '"]'); e.value = v; (e.tagName === 'SELECT' ? e.onchange : e.oninput)(); };
    set('0|item', 'Gable'); set('0|qty', '2'); set('0|L', '900'); ov.querySelector('[data-mr="0|mat"]').value = ''; ov.querySelector('[data-mr="0|mat"]').onchange();
    document.getElementById('me-save').click(); const e1 = document.getElementById('me-err').textContent;
    const s2 = document.querySelector('.pod-ovl [data-mr="0|mat"]'); s2.value = 'MFC White'; s2.onchange(); const q = document.querySelector('.pod-ovl [data-mr="0|qty"]'); q.value = ''; q.oninput();
    document.getElementById('me-save').click(); const e2 = document.getElementById('me-err').textContent; document.querySelector('.pod-ovl').remove(); return [e1, e2]; });
  rec('a saw row with no colour: "Pick the colour for every saw row ("Gable" (row 1))"', /Pick the colour for every saw row \("Gable" \(row 1\)\)/.test(v[0]), v[0]);
  rec('a row with no quantity is refused in plain English', /needs a quantity/.test(v[1]), v[1]);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
