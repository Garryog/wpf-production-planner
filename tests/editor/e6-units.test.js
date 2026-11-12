// Editor step 6: unit blocks — "+ Unit block", Qty per ONE unit with the total beside it, Units changeable freely until
// any line of the list is ticked; after that Units is locked ("Saw has started — make a new list …") with "Make new list
// from this" (copy, no ticks). Other edits keep the Rev rule. Fake Supabase only. Run: node tests/editor/e6-units.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const set = (k, v) => `(()=>{const e=document.querySelector('.pod-ovl [data-mr="${k}"]');e.value=${JSON.stringify(v)};(e.tagName==='SELECT'?e.onchange:e.oninput)();})()`;
const val = k => `(()=>{const e=document.querySelector('.pod-ovl [data-mr="${k}"]');return e?e.value:null;})()`;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why/.test(m) ? 'site measure' : 'Tester'; window.confirm = () => true; });
  await pg.evaluate(() => { openListEditor(null, 'WO-2'); document.getElementById('me-addunit').click(); });
  const a = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return { n: ov.querySelectorAll('.me-grid tbody tr').length, u: ov.querySelector('[data-mr="1|units"]').value, f: document.activeElement.dataset.mr, hint: ov.querySelector('.me-u').textContent }; });
  rec('＋ Unit block adds a unit heading (Units 1) and a part row; the cursor goes to the unit name', a.n === 3 && a.u === '1' && a.f === '1|item' && /Qty below is for ONE unit/.test(a.hint), JSON.stringify(a));
  await pg.evaluate(set('1|item', '900 Single Rail + 2 shelves')); await pg.evaluate(set('1|units', '3'));
  await pg.evaluate(set('2|item', 'Side panel')); await pg.evaluate(set('2|qty', '2')); await pg.evaluate(set('2|L', '2380')); await pg.evaluate(set('2|W', '570')); await pg.evaluate(set('2|mat', 'MFC White'));
  const t1 = await pg.evaluate(() => document.querySelector('[data-tot="2"]').textContent);
  await pg.evaluate(set('1|units', '4'));
  const t2 = await pg.evaluate(() => document.querySelector('[data-tot="2"]').textContent);
  rec('the total shows beside the per-unit Qty (2 × 3 = 6) and follows the Units box (× 4 = 8) as you type', t1 === '= 6' && t2 === '= 8', t1 + ' / ' + t2);
  // a heading added while in the block goes to the END of the block (never splits it)
  await pg.evaluate(() => { document.querySelector('[data-mr="2|item"]').focus(); document.getElementById('me-addsaw').click(); });
  await pg.evaluate(set('3|item', 'Shelves')); await pg.evaluate(set('3|qty', '3')); await pg.evaluate(set('3|L', '864')); await pg.evaluate(set('3|W', '570'));
  await pg.evaluate(() => { document.querySelector('[data-mr="2|item"]').focus(); document.getElementById('me-addhdr').click(); });
  const h = await pg.evaluate(() => [...document.querySelectorAll('.pod-ovl .me-grid tbody tr')].map(tr => tr.className.trim()).join(','));
  rec('＋ Heading from inside a unit block goes after the block, not into it', h === 'me-p,me-h me-u,me-p me-inu,me-p me-inu,me-h', h);
  await pg.evaluate(set('4|item', 'Road 1 No 1 extras')); await pg.evaluate(() => document.getElementById('me-addsaw').click());
  await pg.evaluate(set('5|item', 'Kicker')); await pg.evaluate(set('5|qty', '7')); await pg.evaluate(set('5|L', '2440')); await pg.evaluate(set('5|W', '125'));
  // validation of Units
  await pg.evaluate(set('1|units', '0'));
  const e0 = await pg.evaluate(() => { document.querySelector('#me-name').value = 'House 2'; document.getElementById('me-save').click(); return document.getElementById('me-err').textContent; });
  rec('Units must be a whole number above 0, said plainly', /Give the number of units for "900 Single Rail \+ 2 shelves" \(row 2\) — a whole number/.test(e0), e0);
  await pg.evaluate(set('1|units', '4'));
  await pg.evaluate(() => document.getElementById('me-save').click());
  for (let i = 0; i < 30 && !S.db.t.lists.some(l => l.name === 'House 2'); i++) await F.sleep(100);
  const l2 = S.db.t.lists.find(l => l.name === 'House 2'); const ln = () => S.db.t.list_lines.filter(x => x.list_id === l2.id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
  const b = ln().map(x => [x.kind, x.part, x.qty, x.unit_qty || ''].join('|'));
  rec('saved: unit heading qty 4; Side 8 to cut (2 per unit), Shelves 12 (3); Kicker 7 not in the block', b.join(';') === 'hdr|900 Single Rail + 2 shelves|4|;saw|Side panel|8|2;saw|Shelves|12|3;hdr|Road 1 No 1 extras||;saw|Kicker|7|', b.join(';'));
  // before the saw starts: Units can change freely
  await pg.evaluate(async () => { await lsPoll(); const l = lists().find(x => x.name === 'House 2'); openListEditor(l.id); });
  const r1 = await pg.evaluate(() => ({ u: document.querySelector('.pod-ovl [data-mr="0|units"]').value, q: document.querySelector('.pod-ovl [data-mr="1|qty"]').value, dis: document.querySelector('.pod-ovl [data-mr="0|units"]').disabled }));
  rec('reopened: Units 4 and the PER-UNIT quantity (2) in the editor; Units not locked before the saw starts', r1.u === '4' && r1.q === '2' && !r1.dis, JSON.stringify(r1));
  await pg.evaluate(set('0|units', '5')); await pg.evaluate(() => document.getElementById('me-save').click());
  for (let i = 0; i < 30 && ln()[1].qty !== '10'; i++) await F.sleep(100);
  rec('Units 4 → 5 before any tick: saved (Side 10, Shelves 15)', ln()[0].qty === '5' && ln()[1].qty === '10' && ln()[2].qty === '15', JSON.stringify(ln().map(x => x.qty)));
  const revBefore = D.find(S.db, 'lists', l2.id).rev; // WO-2 is cut today, so the list is already with the saw by the date rule
  // the saw ticks Side panel → Units locked
  D.applyLineChanges(S.db, [{ id: ln()[1].id, status: 'cut', cid: 'c1', rev: D.find(S.db, 'lists', l2.id).rev }], 'Sean');
  await pg.evaluate(async () => { await lsPoll(); const l = lists().find(x => x.name === 'House 2'); openListEditor(l.id); });
  const lk = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return { dis: ov.querySelector('[data-mr="0|units"]').disabled, msg: ov.querySelector('.me-lock') && ov.querySelector('.me-lock').textContent, btn: !!ov.querySelector('[data-mecopy]') }; });
  rec('after a tick: Units locked with "Saw has started — make a new list for a different number of units" and a "Make new list from this" button', lk.dis && /Saw has started — make a new list for a different number of units/.test(lk.msg) && lk.btn, JSON.stringify(lk));
  // other edits keep the Rev rule: Shelves 3 → 4 per unit
  await pg.evaluate(set('2|qty', '4')); await pg.evaluate(() => document.getElementById('me-save').click());
  for (let i = 0; i < 30 && ln()[2].qty !== '20'; i++) await F.sleep(100);
  const lst = D.find(S.db, 'lists', l2.id);
  rec('other edits after the saw started: allowed, new revision, the ticked line keeps its tick', ln()[2].qty === '20' && lst.rev === revBefore + 1 && D.find(S.db, 'list_lines', ln()[1].id).status === 'cut', JSON.stringify({ q: ln()[2].qty, rev: lst.rev, revBefore }));
  // a Units change that slips past the box (tick landed while the editor was open) is refused at save
  const race = await pg.evaluate(async () => { const l = lists().find(x => x.name === 'House 2'); const rows = lsEditRows(l.id); rows[0].units = '6'; try { await lsSaveManual({ wo: 'WO-2', name: 'House 2', pid: l.pid, rows }, 'Tester', l); return 'saved'; } catch (e) { return e.message; } });
  rec('Units changed after a tick is refused at save, with the same message', /Saw has started — make a new list/.test(race) && ln()[0].qty === '5', race);
  // Make new list from this: copy without ticks, nothing saved until Save, old list unchanged
  const before = S.db.t.lists.length;
  await pg.evaluate(async () => { await lsPoll(); const l = lists().find(x => x.name === 'House 2'); openListEditor(l.id); document.querySelector('[data-mecopy]').click(); });
  const cp = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return { title: ov.querySelector('div').textContent, name: ov.querySelector('#me-name').value, note: ov.innerText.includes('Copied from "House 2"'), u: ov.querySelector('[data-mr="0|units"]').value, dis: ov.querySelector('[data-mr="0|units"]').disabled, wo: (e => e ? e.value : (document.querySelector('#me-wol > b') || {}).textContent)(document.getElementById('me-wo')) }; });
  rec('"Make new list from this" opens a NEW list with the rows copied, Units unlocked, nothing saved yet', /New cutting list/.test(cp.title) && cp.name === 'House 2 (new)' && cp.note && cp.u === '5' && !cp.dis && cp.wo === 'WO-2' && S.db.t.lists.length === before, JSON.stringify(cp));
  await pg.evaluate(set('0|units', '6')); await pg.evaluate(() => document.getElementById('me-save').click());
  for (let i = 0; i < 30 && !S.db.t.lists.some(l => l.name === 'House 2 (new)'); i++) await F.sleep(100);
  const nl = S.db.t.lists.find(l => l.name === 'House 2 (new)'), nln = nl ? S.db.t.list_lines.filter(x => x.list_id === nl.id).sort((a, b) => a.seq - b.seq) : [];
  rec('the new list: 6 units, Side 12 to cut, no ticks; the old list still 5 units with its tick', nl && nln[0].qty === '6' && nln[1].qty === '12' && nln.every(x => x.status === 'todo') && ln()[0].qty === '5' && D.find(S.db, 'list_lines', ln()[1].id).status === 'cut', JSON.stringify(nln.map(x => [x.qty, x.status])));
  // deleting a unit heading keeps the parts' totals
  await pg.evaluate(() => { openListEditor(null, 'WO-2'); document.getElementById('me-addunit').click(); });
  await pg.evaluate(set('1|item', 'Unit X')); await pg.evaluate(set('1|units', '3')); await pg.evaluate(set('2|item', 'Side')); await pg.evaluate(set('2|qty', '2'));
  await pg.evaluate(() => document.querySelector('.pod-ovl [data-mrx="1"]').click());
  const dq = await pg.evaluate(() => { const r = [...document.querySelectorAll('.pod-ovl [data-mr$="|qty"]')].map(e => e.value); return { r, toast: document.getElementById('toast').textContent }; });
  rec('deleting a unit heading: its parts keep their totals (2 per unit × 3 → 6)', dq.r[1] === '6' && /keep their totals/.test(dq.toast), JSON.stringify(dq));
  await pg.evaluate(() => document.querySelector('.pod-ovl').remove());
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
