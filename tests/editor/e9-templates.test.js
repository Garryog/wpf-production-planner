// Editor step 9: Save as template (from the editor — unsaved rows included — or a library row), Update template
// (Rev n+1, "what changed"), editing a template asks what changed, History lists every revision read-only; lists made from
// a template never change. Needs the PM / Drawing office / Admin PIN. Fake Supabase only.
// Run: node tests/editor/e9-templates.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const wait = async (fn, ms = 4000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1', lines: [
    ['hdr', '900 Single Rail', '3', null, null, null, '', '', {}],
    ['saw', 'Side panel', '6', 2380, 570, 'MFC White', 'L1LE 1mm', '', { section: '900 Single Rail', unit_qty: '2' }],
    ['saw', 'Shelves', '9', 864, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '3' }],
    ['fit', 'Hanging rail', '3', null, null, '', '', '', { section: '900 Single Rail', unit_qty: '1' }]] });
  D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'L1:2'), { status: 'cut', status_by: 'Sean', status_at: '2026-10-21T08:00:00Z' }); // ticked on the saw
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.__pr = []; window.__ans = []; window.prompt = (m, d) => { window.__pr.push(m); return window.__ans.length ? window.__ans.shift() : /PIN/.test(m) ? '7777' : 'Tester'; }; window.confirm = () => true; localStorage.removeItem('wpfEditPin'); });
  // ---- from the editor, with an unsaved extra row
  await pg.evaluate(() => { openListEditor('L1'); document.querySelector('.pod-ovl [data-mr="3|item"]').focus(); document.getElementById('me-addsaw').click();
    const s = (k, v) => { const e = document.querySelector('.pod-ovl [data-mr="' + k + '"]'); e.value = v; e.oninput(); }; s('4|item', 'Batten'); s('4|qty', '1'); s('4|L', '864'); s('4|W', '70'); });
  // (12 Nov, Garry) "Save as template" in the list window: Drawing office screen or the Drawing office / Admin PIN only
  const noPin = await pg.evaluate(() => ({ btn: !!document.getElementById('me-astpl') }));
  rec('office, no PIN: the list window has no "Save as template" button (Drawing office / Admin only)', !noPin.btn, JSON.stringify(noPin));
  await pg.evaluate(() => { localStorage.setItem('wpfEditPin', pins().admin); document.getElementById('me-help').click(); document.getElementById('me-astpl').click(); });
  await wait(() => pg.evaluate(() => !!document.getElementById('at-ok')));
  const d1 = await pg.evaluate(() => { const b = document.getElementById('at-body'); return { txt: b.innerText, name: b.querySelector('#at-name').value, radios: b.querySelectorAll('[name="at-mode"]').length }; });
  rec('the dialog says what is copied (ticks never) and offers type + name (default: the list name)', /4 parts, 1 unit block/.test(d1.txt) && /ticks never are/.test(d1.txt) && d1.name === 'House 1' && d1.radios === 0, JSON.stringify(d1));
  await pg.evaluate(() => { const n = document.getElementById('at-name'); n.value = 'Robe 900'; n.oninput({ target: n }); document.getElementById('at-type').value = 'room'; document.getElementById('at-type').onchange({ target: document.getElementById('at-type') }); document.getElementById('at-ok').click(); });
  await wait(() => S.db.t.lists.some(l => l.is_template && l.type_name === 'Robe 900'));
  const t = S.db.t.lists.find(l => l.is_template && l.type_name === 'Robe 900'), tl = () => S.db.t.list_lines.filter(x => x.list_id === t.id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
  const b1 = tl().map(x => [x.kind, x.part, x.qty, x.unit_qty || '', x.status].join('|'));
  rec('template saved: heading with units, per-unit quantities, the unsaved Batten row, no ticks', b1.join(';') === 'hdr|900 Single Rail|3||todo;saw|Side panel|6|2|todo;saw|Shelves|9|3|todo;fit|Hanging rail|3|1|todo;saw|Batten|3|1|todo', b1.join(';'));
  rec('template: type Room, project P1, no work orders; the source list is not linked and keeps its tick', t.list_type === 'room' && t.project_id === 'P1' && !t.wos.length && !D.find(S.db, 'lists', 'L1').template_id && D.find(S.db, 'list_lines', 'L1:2').status === 'cut' && tl().every(x => !x.src_line_id));
  rec('the editor is still open with your unsaved rows', await pg.evaluate(() => !!document.querySelector('.pod-ovl #me-save') && document.querySelector('.pod-ovl [data-mr="4|item"]').value === 'Batten'));
  await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
  // a live list made from the template now (rev 1)
  const made = await pg.evaluate(async id => { await lsPoll(); const l = await lsCreateFromTpl(id, ['WO-2'], 'House 2', 'Tester'); return l.id; }, t.id);
  // ---- the same name again from a library row → "Update template (Rev 2)" offered first
  await pg.evaluate(() => { showTab('l'); });
  await pg.evaluate(() => { const b = document.querySelector('[data-lhastpl="L1"]'); b.click(); });
  await wait(() => pg.evaluate(() => !!document.getElementById('at-ok')));
  await pg.evaluate(() => { const n = document.getElementById('at-name'); n.value = 'robe 900'; n.oninput({ target: n }); });
  const d2 = await pg.evaluate(() => { const b = document.getElementById('at-body'); return { txt: b.innerText, mode: (b.querySelector('[name="at-mode"]:checked') || {}).value, ok: b.querySelector('#at-ok').textContent }; });
  rec('same name (any case): "Update template — it becomes Rev 2" is offered first, or "New template"', d2.mode === 'upd' && /Update template — it becomes Rev 2/.test(d2.txt) && /New template/.test(d2.txt) && d2.ok === 'Update template → Rev 2', JSON.stringify(d2));
  await pg.evaluate(() => { const w = document.getElementById('at-why'); w.value = 'no Batten on this one'; w.oninput({ target: w }); document.getElementById('at-ok').click(); });
  await wait(() => D.find(S.db, 'lists', t.id).rev === 2);
  const b2 = tl().map(x => x.part).join('|');
  rec('Update template: Rev 2 with the rows of the library list (Batten gone), reason recorded', D.find(S.db, 'lists', t.id).rev === 2 && b2 === '900 Single Rail|Side panel|Shelves|Hanging rail' && S.db.t.list_revisions.some(r => r.list_id === t.id && r.rev === 1 && r.reason === 'no Batten on this one'), b2);
  rec('the list made from Rev 1 is unchanged and says "template is now rev 2 (this copy rev 1)"', S.db.t.list_lines.filter(x => x.list_id === made && x.removed_rev == null).length === 5 && /template "Robe 900" is now rev 2 \(this copy rev 1\)/.test(await pg.evaluate(async id => { await lsPoll(); return lsTplInfo(lsList(id)); }, made)), await pg.evaluate(id => lsTplInfo(lsList(id)), made));
  // "New template" with the same name is still possible
  await pg.evaluate(() => { document.querySelector('[data-lhastpl="L1"]').click(); });
  await wait(() => pg.evaluate(() => !!document.getElementById('at-ok')));
  await pg.evaluate(() => { const n = document.getElementById('at-name'); n.value = 'Robe 900 short'; n.oninput({ target: n }); document.getElementById('at-ok').click(); });
  await wait(() => S.db.t.lists.some(l => l.type_name === 'Robe 900 short'));
  rec('a different name makes a new template', S.db.t.lists.filter(l => l.is_template).length === 2);
  // ---- editing a template asks "what changed" → Rev 3
  await pg.evaluate(async id => { await lsPoll(); window.__ans = ['shelves 3 → 4 per unit']; openListEditor(id); const e = document.querySelector('.pod-ovl [data-mr="2|qty"]'); e.value = '4'; e.oninput(); document.getElementById('me-save').click(); }, t.id);
  await wait(() => D.find(S.db, 'lists', t.id).rev === 3);
  const q = await pg.evaluate(() => window.__pr.filter(m => /What changed in this template/.test(m)).length);
  rec('editing a template asks "What changed?" and saves Rev 3', D.find(S.db, 'lists', t.id).rev === 3 && q === 1 && tl()[2].qty === '12', JSON.stringify({ rev: D.find(S.db, 'lists', t.id).rev, q, qty: tl()[2].qty }));
  // ---- History
  await pg.evaluate(async id => { await lsPoll(); render(); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); const b = document.querySelector('[data-lhhist="' + id + '"]'); if (b) b.click(); else lsTplHistory(id); }, t.id);
  await wait(() => pg.evaluate(() => !!document.querySelector('[data-threv]')));
  const h = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return [...ov.querySelectorAll('tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()); });
  rec('History: Rev 3 (current), Rev 2, Rev 1 — who, when and what changed', h.length === 3 && /^Rev 3 current .*shelves 3 → 4 per unit/.test(h[0]) && /^Rev 2 .*no Batten on this one/.test(h[1]) && /^Rev 1 .*Saved as a template from "House 1"/.test(h[2]), h.join(' || '));
  await pg.evaluate(() => document.querySelector('[data-threv="2"]').click());
  const v1 = await pg.evaluate(() => document.getElementById('th-view').innerText);
  rec('each revision can be viewed read-only (Rev 1 still has the Batten)', /Rev 1 — read only/.test(v1) && /Batten/.test(v1) , v1.slice(0, 200));
  const ro = await pg.evaluate(() => document.querySelectorAll('#th-view input, #th-view select').length);
  rec('… with no boxes to type in', ro === 0);
  rec('the library shows History on templates only', await pg.evaluate(() => !document.querySelector('[data-lhhist="L1"]')));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
