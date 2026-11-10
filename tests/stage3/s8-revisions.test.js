// Stage 3 S8: locking and revisions on screen — Plan B acceptance 6 end to end (change 1, add 1, remove 1 already cut):
// ticks kept, CHANGED / NEW badges, "REV 2 — 1 changed, 1 added, 1 removed", keep-aside, Rev on prints and labels;
// Send to saw locks a draft; the cut-by date rule. Fake Supabase only. Run: node tests/stage3/s8-revisions.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row(); row.orders.push(H.order({ wo: 'WO-8', customer: 'Aderrig Homes', dueDate: '2026-10-30', origDueDate: '2026-10-30' }));
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '1mm', ''], ['saw', 'Gable', '2', 900, 560, 'MFC White', '', ''], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']] });
  F.seedList(S, 'L8', { name: 'House 8', wos: ['WO-8'], list: { source: 'manual' } });
  const saw = await F.dev(browser, S, 'saw'), off = await F.dev(browser, S, 'office');
  await off.page.evaluate(() => { window.__p = []; window.prompt = (m, d) => { window.__p.push(m); return /PIN/.test(m) ? '7777' : 'drawing changed'; }; });
  // the saw cuts Side and Top
  await F.tapRow(saw.page, 'data-rt', 'L1:1'); await F.tapRow(saw.page, 'data-rt', 'L1:3'); await F.send(saw.page);
  // office revises: Gable 2 → 3 (changed), Top taken out (already cut), Shelf added
  await off.page.evaluate(async () => { await lsPoll(); openListEditor('L1'); const o = document.querySelector('.pod-ovl');
    const s = (k, v) => { const e = o.querySelector('[data-mr="' + k + '"]'); e.value = v; (e.oninput || e.onchange)(); };
    s('1|qty', '3'); o.querySelectorAll('[data-mrx]')[2].click();
    const o2 = document.querySelector('.pod-ovl'); o2.querySelector('#me-addsaw').click();
    const s2 = (k, v) => { const e = document.querySelector('.pod-ovl [data-mr="' + k + '"]'); e.value = v; (e.oninput || e.onchange)(); };
    s2('3|item', 'Shelf'); s2('3|qty', '2'); s2('3|L', '560'); s2('3|W', '500'); s2('3|mat', 'MFC White');
    document.querySelector('.pod-ovl #me-save').click(); });
  await F.sleep(700);
  const L = D.find(S.db, 'lists', 'L1');
  rec('A6: saving a locked list asks why, makes rev 2 with the reason', L.rev === 2 && (await off.page.evaluate(() => window.__p.some(m => /revision 2/.test(m) && /drawing changed \/ site measure \/ error \/ other/.test(m)))) && S.db.t.list_revisions.some(r => r.list_id === 'L1' && r.reason === 'drawing changed'), L.rev);
  await saw.page.evaluate(async () => { await lsPoll(); render(); });
  const card = await saw.page.evaluate(() => { const b = document.querySelector('[data-wldone="L1"]').closest('.wl-card'); return { t: b.innerText, h: b.innerHTML }; });
  rec('A6: saw card says "REV 2 — 1 changed, 1 added, 1 removed"', /REV 2 — 1 changed, 1 added, 1 removed/.test(card.t), card.t.slice(0, 300));
  const st = await saw.page.evaluate(() => ({ side: rowTicked('L1', 'L1:1'), gable: rowTicked('L1', 'L1:2'), top: listRows(lists().find(l => l.id === 'L1')).some(r => r.id === 'L1:3') }));
  rec('A6: the unchanged cut line keeps its tick; the changed one is back to do; the removed one is off the bench list', st.side && !st.gable && !st.top, JSON.stringify(st));
  rec('A6: CHANGED badge on Gable, NEW on Shelf', /CHANGED<\/span>\s*(<span[^>]*><\/span>)?[^<]*Gable|CHANGED<\/span> Gable/.test(card.h) && /NEW<\/span>\s*Shelf/.test(card.h), card.h.match(/rev-b[^<]*<\/span>[^<]{0,20}/g));
  rec('A6: the removed part that was already cut shows greyed: "REMOVED — part already cut, keep aside"', /Top ×1[\s\S]*REMOVED — part already cut, keep aside/.test(card.t));
  await saw.page.evaluate(() => { window.__opened = []; printWorkList('saw', 1); printLabels([lists().find(l => l.id === 'L1')], 'saw'); });
  const pr = await saw.page.evaluate(() => window.__opened.join('\n'));
  rec('A6: Rev 2 on the printed list and on the labels', /House 1 · Rev 2/.test(pr) && /WESTERN POSTFORM · REV 2/.test(pr), (pr.match(/Rev 2|REV 2/g) || []).length);
  // a tick sent from a screen still on rev 1 for the changed line is refused (database) — covered in c4; here the screen is current
  await F.tapRow(saw.page, 'data-rt', 'L1:2'); await F.send(saw.page);
  rec('the saw ticks the changed line on the current revision', F.line(S, 'L1:2').status === 'cut');
  // ---- Send to saw locks a draft (cut-by is a week away)
  await off.page.evaluate(async () => { await lsPoll(); showTab('l'); });
  const st8 = await off.page.evaluate(() => [...document.querySelectorAll('[data-lhrow="L8"] td')].map(t => t.innerText).join('|'));
  await off.page.evaluate(() => document.querySelector('[data-lhsend="L8"]').click()); await F.send(off.page);
  rec('Send to saw: a draft becomes live (locked, sent time, history)', /Draft/.test(st8) && D.find(S.db, 'lists', 'L8').locked && !!D.find(S.db, 'lists', 'L8').sent_at && D.find(S.db, 'lists', 'L8').log.some(x => x.what === 'Sent to the saw'), st8);
  await off.page.evaluate(async () => { window.__p = []; await lsPoll(); openListEditor('L8'); const o = document.querySelector('.pod-ovl'); const e = o.querySelector('[data-mr="0|qty"]'); e.value = '9'; e.oninput(); o.querySelector('#me-save').click(); });
  await F.sleep(600);
  rec('editing it after Send to saw asks why and makes rev 2', D.find(S.db, 'lists', 'L8').rev === 2 && (await off.page.evaluate(() => window.__p.length)) === 1);
  // ---- switch off: no Rev on prints or labels, no badges (old HTML unchanged)
  const r0 = F.v2Row(); delete r0.settings.listStore; delete r0.settings.listStoreAt;
  r0.settings.lists.push({ id: 'X1', wb: 'W1', sheet: 'Old', name: 'Old house 2', project: 'Old', saw: 1, fit: 0, wos: ['WO-1'], up: F.NOW });
  const S0 = F.makeServer(r0); const v1 = await F.open(browser, S0, { now: F.NOW, role: 'saw' });
  const p0 = await v1.page.evaluate(() => { window.__opened = []; printWorkList('saw', 1); printLabels([lists()[1]], 'saw'); return window.__opened.join('\n') + document.getElementById('app').innerHTML; });
  rec('switch off: no Rev / REV on prints, labels or the saw card', !/Rev \d|REV \d|rev-b|rev-note/.test(p0));
  rec('no page errors', !(S.errors || []).length && !(S0.errors || []).length, (S.errors || []).concat(S0.errors || []).join(' | '));
  await saw.close(); await off.close(); await v1.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
