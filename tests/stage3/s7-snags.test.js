// Stage 3 S7: snags with a free-text location — raised (PM or Production Manager), cancelled (kept), ticked and turned into
// cutting lists (one per project, deliver_by set) that reach the saw the day before; cutting the line moves the snag to
// "cut"; two people transferring the same snags make one list. Hub acceptance 6, 7, 8 (fake), 9. Fake Supabase only.
// Run: node tests/stage3/s7-snags.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { wos: ['WO-1'] });
  D.insert(S.db, 'projects', { id: 'P2', name: 'Crown' });
  // ---- PM raises a snag from the phone
  const pm = await F.dev(browser, S, 'pm', { viewport: { width: 380, height: 800 } });
  await pm.page.evaluate(() => document.querySelector('[data-pmtab="snags"]').click());
  const add = (p, f) => p.evaluate(f => { document.getElementById('sn-new').click();
    const g = id => document.getElementById(id), set = (id, v) => { const e = g(id); e.value = v; if (e.onchange) e.onchange({ target: e }); };
    if (f.pid) set('sn-pid', f.pid);
    if (f.kind) document.querySelector('[data-snk="' + f.kind + '"]').click();
    Object.entries(f.v).forEach(([id, v]) => { g(id).value = v; });
    g('sn-save').click(); return (g('sn-err') || {}).textContent || ''; }, f);
  const e0 = await add(pm.page, { v: { 'sn-where': 'Blk C · Apt 31', 'sn-item': 'Door', 'sn-qty': '1', 'sn-L': '720', 'sn-W': '' } });
  rec('PM: a saw snag needs its material (project has sheet materials)', /Pick the material/.test(e0), e0);
  await pm.page.evaluate(() => { document.getElementById('sn-mat').value = 'M1'; document.getElementById('sn-save').click(); });
  await F.sleep(400);
  const s1 = S.db.t.snags[0];
  rec('PM: snag saved — project, free-text where, saw, material from the project list, who raised it', s1 && s1.project_id === 'P1' && s1.where_text === 'Blk C · Apt 31' && s1.kind === 'saw' && s1.material_id === 'M1' && s1.length_mm === 720 && s1.status === 'raised' && s1.raised_by, JSON.stringify(s1));
  rec('PM: the location is remembered for the next snag', (await pm.page.evaluate(() => { document.getElementById('sn-new').click(); return document.getElementById('sn-where').value; })) === 'Blk C · Apt 31');
  await pm.page.evaluate(() => document.getElementById('sn-cancel').click());
  await add(pm.page, { kind: 'fit', v: { 'sn-item': '<b>Hinge</b>', 'sn-qty': '4', 'sn-mat': '__other', 'sn-mtext': 'Blum 110°' } });
  await F.sleep(400);
  rec('PM: a fittings snag with an "Other…" spec', S.db.t.snags.some(s => s.kind === 'fit' && s.material_text === 'Blum 110°' && !s.material_id));
  rec('PM: no tick boxes / transfer on the PM view (the Production Manager transfers)', !(await pm.page.evaluate(() => !!document.querySelector('[data-sn]'))));
  rec('snag text is escaped', /&lt;b&gt;Hinge/.test(await pm.page.evaluate(() => document.querySelector('.pg').innerHTML)));
  // ---- Production Manager: another project, cancel one, tick all, create the lists
  const pr = await F.dev(browser, S, 'prod');
  await pr.page.evaluate(() => document.querySelector('[data-prodtab="snags"]').click());
  await add(pr.page, { pid: 'P2', v: { 'sn-where': 'Unit 4', 'sn-item': 'Shelf', 'sn-qty': '2', 'sn-L': '560', 'sn-W': '300' } });
  await add(pr.page, { pid: 'P2', v: { 'sn-item': 'Spare', 'sn-qty': '1', 'sn-L': '100', 'sn-W': '100' } });
  await F.sleep(400);
  const spare = S.db.t.snags.find(s => s.item === 'Spare');
  await pr.page.evaluate(id => { document.querySelector('[data-sncan="' + id + '"]').click(); }, spare.id);
  await F.sleep(300);
  rec('cancel: kept on record as cancelled, not deleted', D.find(S.db, 'snags', spare.id).status === 'cancelled' && !S.deletes3);
  await pr.page.evaluate(() => { document.querySelectorAll('[data-snall]').forEach(b => b.click()); });
  const ticked = await pr.page.evaluate(() => SN.sel.size);
  // a second Production Manager screen ticks the same snags
  const pr2 = await F.dev(browser, S, 'prod');
  await pr2.page.evaluate(() => { document.querySelector('[data-prodtab="snags"]').click(); document.querySelectorAll('[data-snall]').forEach(b => b.click()); });
  await pr.page.evaluate(() => { window.prompt = () => '2026-10-23'; document.getElementById('sn-tolist').click(); });
  await F.sleep(600);
  await pr2.page.evaluate(() => { window.prompt = () => '2026-10-23'; document.getElementById('sn-tolist').click(); });
  await F.sleep(600);
  const sl = S.db.t.lists.filter(l => l.list_type === 'snag');
  rec('Tick all for project → 3 raised snags (2 projects) ticked; Create cutting list → 2 lists, deliver_by 23 Oct', ticked === 3 && sl.length === 2 && sl.every(l => l.deliver_by === '2026-10-23'), JSON.stringify(sl.map(l => l.name)));
  rec('two people transferring the same snags: only one set of lists, the second is told', sl.length === 2 && /already moved by someone else/.test(await pr2.page.evaluate(() => document.getElementById('toast').textContent)));
  rec('snags show "On a list" with the list name', /On a list[\s\S]*Snags Aderrig/.test(await pr.page.evaluate(() => document.querySelector('.pg').innerText)));
  // ---- saw: the snag list arrives the day before delivery, cutting it moves the snag to "cut"
  const saw = await F.dev(browser, S, 'saw');
  await saw.page.evaluate(() => { wlShowUpcoming = true; render(); });
  const sid = sl.find(l => l.project_id === 'P1').id;
  const on = await saw.page.evaluate(id => { const l = lists().find(x => x.id === id); return { due: listDueKey(l), cut: listDeadline(l), shown: !!document.querySelector('[data-wldone="' + id + '"]') }; }, sid);
  rec('saw: the snag list (no work order) is on the saw, cut by the day before deliver_by', on.due === '2026-10-23' && on.cut === '2026-10-22' && on.shown, JSON.stringify(on));
  await F.tapRow(saw.page, 'data-rt', sid + ':1'); await F.send(saw.page);
  await pr.page.evaluate(async () => { await lsPoll(); render(); });
  rec('cutting the snag line moves the snag to "cut" on the Production Manager\'s screen after a poll', D.find(S.db, 'snags', s1.id).status === 'cut' && /Cut \/ got out/.test(await pr.page.evaluate(id => (document.querySelector('[data-snrow="' + id + '"]') || {}).innerText || '', s1.id)));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await pm.close(); await pr.close(); await pr2.close(); await saw.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
