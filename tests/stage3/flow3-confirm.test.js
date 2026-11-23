// Cutting-list flow, step 3: the "Cutting lists to issue" panel and confirmList (fixed list id WO:<wo>).
// Nothing is made until someone confirms; ✓ Confirm, change template, "No list needed", "Paper list issued",
// "Confirm all green" with a result per row and Retry; two PCs confirming the same WO at once make ONE list.
// Fake Supabase only. Run: node tests/stage3/flow3-confirm.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2';
function server(on, extra) {
  const o = (wo, title, x) => H.order(Object.assign({ wo, title, customer: CH, step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [
    o('WO-1', 'HOUSE 14 - TYPE B KITCHEN', { floor: '', unit: '14' }), o('WO-2', 'HOUSE 15 TYPE B KITCHEN', { step: '6. JOB CUT COMPLETE' }), o('WO-3', 'HOUSE 9 TYPE B'),
    o('WO-4', 'HOUSE 40 TYPE D KITCHEN'), o('WO-5', 'HOUSE 2 KITCHEN', { customer: 'RIVERSIDE DEVELOPMENTS - RIVERSIDE' }), o('WO-6', 'HOUSE 16 TYPE B KITCHEN'),
    o('WO-7', 'HOUSE 17 TYPE B KITCHEN', { procAt: '2026-10-14' }), // late
  ].concat(extra || []);
  if (!on) { delete row.settings.listStore; delete row.settings.listStoreAt; }
  const S = F.makeServer(row);
  D.insert(S.db, 'projects', { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes' });
  D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' }); D.insert(S.db, 'project_materials', { id: 'M2', project_id: 'P1', name: 'Blum hinge', kind: 'other' });
  F.seedList(S, 'T1', { name: 'Type B kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed' } });
  F.seedList(S, 'T2', { name: 'Type B wardrobes', wos: [], list: { is_template: true, list_type: 'room', type_name: 'Type B robes' }, lines: [['saw', 'Robe side', '2', 2200, 600, 'MFC White', '', '']] });
  return S;
}
const panel = p => p.evaluate(() => { const e = document.getElementById('lti'); if (!e) return null;
  return { t: e.innerText, rows: [...e.querySelectorAll('[data-ltirow]')].map(r => r.dataset.ltirow + ':' + (r.querySelector('[data-ltilvl]') || {}).dataset.ltilvl), all: (document.getElementById('lti-all') || {}).textContent || '' }; });
const made = (S, wo) => S.db.t.lists.filter(l => (l.wos || []).includes(wo) && !l.is_template);
(async () => {
  const browser = await H.chromium.launch();
  {
    const S = server(true);
    const t = await F.dev(browser, S, 'office');
    await t.page.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 200)); });
    let p = await panel(t.page);
    rec('office Lists tab: "Cutting lists to issue — 7" on top', p && /Cutting lists to issue — 7/.test(p.t), p && p.t.slice(0, 120));
    rec('green WO-1, WO-2, WO-6, WO-7; amber WO-3 (type B — kitchen or wardrobes?); grey WO-4 (no Type D) and WO-5 (no project)', p && ['WO-1:strong', 'WO-2:strong', 'WO-6:strong', 'WO-7:strong', 'WO-3:weak', 'WO-4:none', 'WO-5:none'].every(x => p.rows.includes(x)), JSON.stringify(p && p.rows));
    rec('late WO-7 first, shown LATE', p && p.rows[0] === 'WO-7:strong' && /WO-7[\s\S]*LATE/.test(p.t), JSON.stringify(p && p.rows));
    rec('"Confirm all green (4)"', p && /Confirm all green \(4\)/.test(p.all), p && p.all);
    rec('nothing is made before anyone confirms', S.db.t.lists.filter(l => !l.is_template).length === 0);
    rec('the old "Cutting lists needed" tools are still there, folded away', await t.page.evaluate(() => !!document.querySelector('details.lti-other [data-natt="WO-1"]')));
    // ✓ Confirm one row
    await t.page.evaluate(() => document.querySelector('[data-lticonf="WO-1"]').click());
    await F.sleep(700);
    const l1 = D.find(S.db, 'lists', 'WO:WO-1'), ll1 = S.db.t.list_lines.filter(x => x.list_id === 'WO:WO-1');
    rec('✓ Confirm WO-1: list WO:WO-1 made from Type B kitchen rev 1, attached to WO-1, named after the template type (Part 4, Garry 10 Nov — was the house "14"), lines copied', l1 && l1.wos.join() === 'WO-1' && l1.template_id === 'T1' && l1.source === 'template' && l1.name === 'Type B 3-bed' && ll1.length === 4 && l1.created_by === 'Ann', JSON.stringify(l1 && { w: l1.wos, n: l1.name, by: l1.created_by }));
    p = await panel(t.page);
    rec('WO-1 leaves the panel; the result line says so', p && !p.rows.some(r => r.startsWith('WO-1:')) && /✓ WO-1 — "Type B 3-bed" from Type B 3-bed/.test(p.t), p && p.t.slice(0, 300));
    // change the template on the amber row
    await t.page.evaluate(() => document.querySelector('[data-ltichg="WO-3"]').click());
    await t.page.evaluate(() => { const s = document.querySelector('[data-ltisel="WO-3"]'); s.value = 'T2'; s.onchange(); });
    p = await panel(t.page);
    rec('change template (3 taps): WO-3 now "Chosen: Type B robes"', p && p.rows.includes('WO-3:pick') && /Chosen: Type B robes/.test(p.t), JSON.stringify(p && p.rows));
    await t.page.evaluate(() => document.querySelector('[data-lticonf="WO-3"]').click()); await F.sleep(700);
    rec('WO-3 confirmed with the chosen template (wardrobes)', (D.find(S.db, 'lists', 'WO:WO-3') || {}).template_id === 'T2');
    // Confirm all green, one row failing → per-row result + Retry
    const orig = D.RPC.save_list_revision;
    D.RPC.save_list_revision = (d, a) => { if (a.p_list && a.p_list.id === 'WO:WO-6') throw new D.DbError('connection to the database was lost'); return orig(d, a); };
    await t.page.evaluate(() => document.getElementById('lti-all').click()); await F.sleep(1500);
    p = await panel(t.page);
    rec('Confirm all green: WO-2 and WO-7 made, WO-6 failed and stays with "Not saved" + Retry', made(S, 'WO-2').length === 1 && made(S, 'WO-7').length === 1 && !made(S, 'WO-6').length && /WO-6[\s\S]*Not saved — connection to the database was lost/.test(p.t) && await t.page.evaluate(() => !!document.querySelector('[data-ltiretry="WO-6"]')), p && p.t.slice(0, 600));
    rec('Confirm all never touches amber/grey rows', !made(S, 'WO-4').length && !made(S, 'WO-5').length);
    D.RPC.save_list_revision = orig;
    await t.page.evaluate(() => document.querySelector('[data-ltiretry="WO-6"]').click()); await F.sleep(700);
    rec('Retry: WO-6 made', made(S, 'WO-6').length === 1 && D.find(S.db, 'lists', 'WO:WO-6'));
    // No list needed / Paper list issued / Undo
    await t.page.evaluate(() => document.querySelector('[data-ltina="WO-4|none"]').click());
    rec('no "Paper list issued" button any more (Garry, 4 Nov) — "No list needed" only', await t.page.evaluate(() => !document.querySelector('[data-ltina$="|paper"]') && !/Paper list issued/.test(document.body.innerText) && !!document.querySelector('[data-ltina="WO-5|none"]')));
    await t.page.evaluate(() => document.querySelector('[data-ltina="WO-5|none"]').click());
    await t.page.evaluate(async () => { await saveDB(); });
    const na = o => (S.row.orders.find(x => x.wo === o) || {}).listNA || {};
    rec('"No list needed" is saved on the WO (with who) and the rows go', na('WO-4').k === 'none' && na('WO-5').k === 'none' && na('WO-4').by === 'Ann' && (await panel(t.page)).rows.length === 0, JSON.stringify([na('WO-4'), na('WO-5')]));
    rec('…and recorded in the WO history', await t.page.evaluate(() => (DB.orders.find(o => o.wo === 'WO-4').log || []).some(l => /no list needed/.test(l.what))));
    await t.page.evaluate(() => { document.getElementById('lti-na').click(); document.querySelector('[data-ltiundo="WO-4"]').click(); });
    rec('Undo brings WO-4 back to the panel', (await panel(t.page)).rows.includes('WO-4:none'));
    rec('only one list per confirmed WO, nothing for the cleared ones', ['WO-1', 'WO-2', 'WO-3', 'WO-6', 'WO-7'].every(w => made(S, w).length === 1) && !made(S, 'WO-4').length && !made(S, 'WO-5').length);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    // other screens
    const pr = await F.dev(browser, S, 'prod');
    await pr.page.evaluate(async () => { document.querySelector('[data-prodtab="lists"]').click(); await new Promise(r => setTimeout(r, 200)); });
    rec('Production Manager → Lists: the panel is on top', !!(await panel(pr.page)) && await pr.page.evaluate(() => document.getElementById('lti').compareDocumentPosition(document.getElementById('lh')) & 4));
    const des = await F.dev(browser, S, 'office');
    await des.page.evaluate(async () => { localStorage.setItem('wpfPin_design', '8888'); setRole('design'); await new Promise(r => setTimeout(r, 200)); });
    rec('Drawing office home: the panel is on top', !!(await panel(des.page)) && /Drawing office/.test(await des.page.evaluate(() => document.body.innerText)));
    await t.close(); await pr.close(); await des.close();
  }
  // ---- after an import's Apply
  {
    const S = server(true);
    const t = await F.dev(browser, S, 'office');
    const r = await t.page.evaluate(async () => {
      setWho('Ann'); showTab('i');
      IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-26-11', step: '5. WORK ORDER PROCESSED', value: 4000, dueDate: '2026-12-15', title: 'HOUSE 11 TYPE B KITCHEN', customer: 'CAIRN HOMES - CHERRYWOOD PHASE 2' }]), 'file');
      renderImportPreview(IMPPLAN); const pre = (document.getElementById('imp-proc') || {}).textContent || '';
      await document.getElementById('imp-apply').onclick();
      return { pre, after: document.getElementById('iprev').innerText };
    });
    rec('import preview: "1 work order newly processed with no cutting list"', /1 work order newly processed with no cutting list/.test(r.pre), r.pre);
    rec('after Apply: the panel shows under the import result, with the new WO', /Import applied/.test(r.after) && /Cutting lists to issue — 8/.test(r.after) && /WO-26-11/.test(r.after), r.after.slice(0, 300));
    await t.page.evaluate(() => document.querySelector('[data-lticonf="WO-26-11"]').click()); await F.sleep(700);
    const after = await t.page.evaluate(() => document.getElementById('iprev').innerText);
    rec('confirm from the import screen: list made, the import summary stays', !!D.find(S.db, 'lists', 'WO:WO-26-11') && /Import applied/.test(after) && /Cutting lists to issue — 7/.test(after), after.slice(0, 200));
    await t.page.evaluate(() => render());
    rec('a redraw of the import tab keeps the panel', /Cutting lists to issue/.test(await t.page.evaluate(() => document.getElementById('iprev').innerText)));
    await t.close();
  }
  // ---- two PCs confirm the same WO at the same moment → ONE list
  {
    const S = server(true);
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    let release; S.hold3 = new Promise(r => { release = r; });
    const pa = a.page.evaluate(() => confirmList('WO-7', 'T1', 'Ann').then(l => ({ id: l.id, al: !!l.already })).catch(e => ({ err: e.message })));
    const pb = b.page.evaluate(() => confirmList('WO-7', 'T2', 'Bob').then(l => ({ id: l.id, al: !!l.already })).catch(e => ({ err: e.message })));
    await F.sleep(400); S.hold3 = null; release();
    const [ra, rb] = await Promise.all([pa, pb]);
    const ls = made(S, 'WO-7');
    rec('two PCs at once: ONE list for WO-7, both screens end up on it, one told "already made"', ls.length === 1 && ra.id === 'WO:WO-7' && rb.id === 'WO:WO-7' && (ra.al !== rb.al), JSON.stringify([ra, rb, ls.map(l => l.id + '/' + l.template_id)]));
    rec('…the second screen did not overwrite or revise the first one\'s list (rev 1, one history entry, its own lines)', ls[0].rev === 1 && ls[0].log.length === 1 && !S.db.t.list_revisions.some(x => x.list_id === 'WO:WO-7') && S.db.t.list_lines.filter(x => x.list_id === 'WO:WO-7').length === (ls[0].template_id === 'T1' ? 4 : 1));
    // a screen that hasn't heard of the list yet (old cache) confirms later → no second list, no revision
    const rc = await b.page.evaluate(() => { LST.l.delete('WO:WO-7'); return confirmList('WO-7', 'T2', 'Bob').then(l => ({ id: l.id, al: !!l.already })); });
    rec('a later confirm from a screen that hadn\'t seen it: same list, "already", still rev 1', rc.id === 'WO:WO-7' && rc.al && made(S, 'WO-7').length === 1 && made(S, 'WO-7')[0].rev === 1, JSON.stringify(rc));
    // the real database answers a clash on the same id with 23505 duplicate key (HTTP 409): handled the same way
    const orig = D.RPC.save_list_revision;
    D.RPC.save_list_revision = (d, x) => { if (x.p_list && x.p_list.id === 'WO:WO-6') { orig(d, x); throw new D.DbError('duplicate key value violates unique constraint "lists_pkey"', '23505'); } return orig(d, x); };
    const rd = await a.page.evaluate(() => confirmList('WO-6', 'T1', 'Ann').then(l => ({ id: l.id, al: !!l.already })).catch(e => ({ err: e.message })));
    D.RPC.save_list_revision = orig;
    rec('duplicate key (409) from the database → the existing list, no error, no second list', rd.id === 'WO:WO-6' && rd.al && made(S, 'WO-6').length === 1, JSON.stringify(rd));
    // archived list for the WO → a new one gets WO:<wo>#2
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'WO:WO-6'), { archived: true });
    const re = await a.page.evaluate(async () => { await lsPoll(); return confirmList('WO-6', 'T1', 'Ann').then(l => ({ id: l.id, al: !!l.already })).catch(e => ({ err: e.message })); });
    rec('after the WO\'s list was archived, confirming again makes WO:WO-6#2', re.id === 'WO:WO-6#2' && !re.al, JSON.stringify(re));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  // ---- 360 px phone (Chrome): no sideways scrolling, buttons on screen
  {
    const S = server(true);
    const t = await F.dev(browser, S, 'prod', { viewport: { width: 360, height: 760 } });
    await t.page.evaluate(async () => { document.querySelector('[data-prodtab="lists"]').click(); await new Promise(r => setTimeout(r, 200)); });
    const w = await t.page.evaluate(() => { const r = s => [...document.querySelectorAll(s)].map(e => Math.round(e.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth, btn: r('#lti [data-lticonf],#lti [data-ltina],#lti [data-ltichg],#lti-all') }; });
    rec('360 px: the panel fits (no sideways scrolling), every button on screen', w.sw <= 360 && w.btn.length && w.btn.every(x => x > 0 && x <= 360), JSON.stringify(w));
    await t.close();
  }
  // ---- switch off: no panel anywhere
  {
    const S = server(false);
    const t = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const r = await t.page.evaluate(async () => { showTab('l'); await new Promise(r => setTimeout(r, 100)); return { lti: !!document.getElementById('lti'), html: listsToIssueHTML(), needed: /Cutting lists needed/.test(document.body.innerText), det: !!document.querySelector('details.lti-other') }; });
    rec('switch off: no panel, the Lists tab is as before (no folded section)', !r.lti && r.html === '' && !r.det, JSON.stringify(r));
    rec('switch off: no calls to the new tables', F.newTableCalls(S).length === 0, F.newTableCalls(S).join());
    await t.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
