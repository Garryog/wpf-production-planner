// Stage 3 S5 + S6: templates, copy from another project, make a live list from a template and attach it, and the
// missing-part check (Plan B acceptance 7 and 8). Fake Supabase only. Run: node tests/stage3/s5s6-templates.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const lines = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row(); row.orders[0].unit = '1'; row.orders[0].floor = 'GF';
  const S = F.makeServer(row);
  F.seedList(S, 'T1', { name: 'Kitchen B', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed' } });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { customer: 'Aderrig Homes' });
  D.insert(S.db, 'projects', { id: 'P2', name: 'Crown' }); D.insert(S.db, 'project_materials', { id: 'M9', project_id: 'P2', name: 'Oak veneer', kind: 'sheet' });
  F.seedList(S, 'T2', { name: 'Robe A', wos: [], list: { project_id: 'P2', is_template: true, list_type: 'room', type_name: 'Robe A' }, lines: [['saw', 'Robe side', '2', 2200, 600, 'Oak veneer', '1mm', ''], ['saw', 'Robe shelf', '3', 900, 560, 'MFC White', '', '']] });
  const off = await F.dev(browser, S, 'office');
  await off.page.evaluate(() => { window.__conf = []; window.confirm = m => { window.__conf.push(m); return window.__confAns !== false; }; window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why are these/.test(m) ? 'drawing has no top' : 'Tester'; showTab('l'); });
  // ---- S6: from "Cutting lists needed": Attach → template → Create & attach (name filled in)
  await off.page.evaluate(() => document.querySelector('[data-natt="WO-1"]').click());
  const btn = await off.page.evaluate(() => { const b = document.querySelector('[data-tplatt^="T1|WO-1"]'); return b ? b.textContent : ''; });
  rec('Attach on WO-1 offers the project\'s templates as buttons (project found from the customer)', /Type B 3-bed · Rev 1/.test(btn), btn);
  await off.page.evaluate(() => document.querySelector('[data-tplatt^="T1|WO-1"]').click());
  await F.sleep(400);
  const dlg = await off.page.evaluate(() => { const o = document.querySelector('.pod-ovl'); return o ? { name: o.querySelector('#tp-name').value, wos: [...o.querySelectorAll('[data-tpwo]')].map(c => c.dataset.tpwo + (c.checked ? '+' : '')).join(','), rows: o.querySelectorAll('.wl-tbl tbody tr').length } : null; });
  rec('preview: WO-1 ticked, WO-2 (same project, no list) offered, name filled in with the template type (Part 4, Garry 10 Nov — was the unit "1"), template lines shown', dlg && dlg.wos === 'WO-1+,WO-2' && dlg.name === 'Type B 3-bed' && dlg.rows === 4, JSON.stringify(dlg));
  await off.page.evaluate(() => document.getElementById('tp-go').click());
  await F.sleep(600);
  const live = S.db.t.lists.find(l => l.template_id === 'T1');
  const ll = live ? lines(S, live.id) : [];
  rec('Create & attach: a live list (4 taps) with its own line ids, linked to template rev 1, attached to WO-1', live && live.wos.join() === 'WO-1' && live.template_rev === 1 && live.source === 'template' && ll.length === 4 && ll.every(x => x.id.startsWith(live.id + ':') && /^T1:/.test(x.src_line_id)) && live.list_type === 'kitchen', JSON.stringify(live && { w: live.wos, r: live.template_rev }));
  rec('WO-1 no longer needs a list', !(await off.page.evaluate(() => listsNeeded().some(o => o.wo === 'WO-1'))));
  // ---- acceptance 7: editing the template leaves the live list unchanged
  await off.page.evaluate(() => { openListEditor('T1'); const o = document.querySelector('.pod-ovl'); const e = o.querySelector('[data-mr="2|qty"]'); e.value = '5'; e.oninput(); o.querySelector('#me-save').click(); });
  await F.sleep(600);
  rec('A7: template saved as rev 2 (every template save is a revision)', D.find(S.db, 'lists', 'T1').rev === 2 && F.line(S, 'T1:3').qty === '5');
  rec('A7: the live list made from it is unchanged', lines(S, live.id).map(x => x.qty).join() === '2,2,1,8' && D.find(S.db, 'lists', live.id).rev === 1);
  await off.page.evaluate(async () => { await lsPoll(); render(); });
  const info = await off.page.evaluate(() => document.getElementById('lh').innerText);
  rec('A7: Lists home says "template is now rev 2 (this copy rev 1)"', /is now rev 2 \(this copy rev 1\)/.test(info), info.slice(0, 300));
  // ---- acceptance 8: leaving out 2 template lines warns, listing both; "Save anyway" needs a reason
  const edit = async ans => off.page.evaluate(async ans => { window.__confAns = ans; window.__conf = []; const l = lists().find(x => x.templateId === 'T1'); openListEditor(l.id); const o = document.querySelector('.pod-ovl');
    o.querySelectorAll('[data-mrx]')[2].click(); const o2 = document.querySelector('.pod-ovl'); o2.querySelectorAll('[data-mrx]')[2].click(); // take out Top and Hinge
    const q = o2.querySelector('[data-mr="1|qty"]'); q.value = '1'; q.oninput(); // and one Side short
    o2.querySelector('#me-save').click(); await new Promise(r => setTimeout(r, 600)); const err = (o2.querySelector('#me-err') || {}).textContent; const open = !!document.querySelector('.me-ed'); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); /* Part 4 L8: the "Saved ✓" panel is not the editor */ return { conf: window.__conf.join('|'), err, open }; }, ans);
  const n0 = lines(S, live.id).length;
  const a1 = await edit(false);
  rec('A8: the warning lists both left-out parts (and the short one); "no" saves nothing', /Top \(left out\)/.test(a1.conf) && /Hinge \(left out\)/.test(a1.conf) && /Side \(3 of 4\)/.test(a1.conf) && a1.open && /missing/.test(a1.err) && lines(S, live.id).length === n0, JSON.stringify(a1));
  const a2 = await edit(true);
  const lg = D.find(S.db, 'lists', live.id).log.slice(-1)[0];
  rec('A8: "Save anyway" with a reason saves, and the reason + parts go in the list history', !a2.open && lines(S, live.id).length === 2 && /Template parts left out: .*Top \(left out\).*Hinge \(left out\).* — drawing has no top/.test(lg.why || ''), JSON.stringify(lg));
  rec('A8: compared with the template as it was when the copy was made (rev 1), not the edited rev 2', /Top \(left out\)/.test(a2.conf) && !/of 5/.test(a2.conf), a2.conf);
  // ---- S5: new template, copy from another project
  await off.page.evaluate(() => { LH.proj = 'P1'; LH.kind = 'tpl'; render(); document.getElementById('lh-newtpl').click(); const o = document.querySelector('.pod-ovl');
    const s = (k, v) => { const e = o.querySelector('[data-mr="' + k + '"]'); e.value = v; (e.oninput || e.onchange)(); };
    s('0|item', 'Plinth'); s('0|qty', '2'); s('0|L', '2400'); s('0|W', '150'); s('0|mat', 'MFC White'); o.querySelector('#me-name').value = 'Plinth kit'; o.querySelector('#me-tname').value = 'Plinths'; o.querySelector('#me-save').click(); });
  await F.sleep(600);
  const nt = S.db.t.lists.find(l => l.name === 'Plinth kit');
  rec('+ New template: saved as a template in the project, no work order', nt && nt.is_template && nt.project_id === 'P1' && !nt.wos.length && nt.type_name === 'Plinths');
  await off.page.evaluate(() => { render(); document.getElementById('lh-copy').click(); document.querySelector('[data-cpp="P2"]').click(); });
  await F.sleep(200);
  await off.page.evaluate(() => document.querySelector('[data-cpl="T2"]').click());
  await F.sleep(500);
  const mm = await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl tbody b')].map(b => b.textContent).join('|'));
  await off.page.evaluate(() => document.getElementById('mm-ok').click());
  const blocked = await off.page.evaluate(() => !!document.getElementById('mm-ok') && document.getElementById('toast').textContent);
  await off.page.evaluate(() => { document.querySelector('[data-mm="0"]').value = '__add'; document.getElementById('mm-ok').click(); });
  await F.sleep(700);
  const ct = S.db.t.lists.find(l => l.project_id === 'P1' && l.name === 'Robe A' && l.is_template);
  const cl = ct ? lines(S, ct.id) : [];
  rec('copy from another project: boards not on this project\'s list must be matched or added (no "keep as typed")', mm === 'Oak veneer' && /Match or add every material/.test(blocked), mm + ' / ' + blocked);
  rec('copy: a template in this project with new line ids, the board added to this project\'s materials', ct && cl.length === 2 && cl.every(x => x.id.startsWith(ct.id + ':') && /^T2:/.test(x.src_line_id)) && S.db.t.project_materials.some(m => m.project_id === 'P1' && m.name === 'Oak veneer') && D.find(S.db, 'lists', 'T2').project_id === 'P2', JSON.stringify(cl.map(x => x.id)));
  // ---- the office PIN can't make templates
  const o2 = await F.dev(browser, S, 'office');
  await o2.page.evaluate(() => { window.prompt = () => '2468'; openListEditor(null, '', 'P1', { tpl: true }); });
  rec('a new template needs the Production Manager / Design office / Admin PIN', !(await o2.page.evaluate(() => !!document.querySelector('.pod-ovl'))));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await off.close(); await o2.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
