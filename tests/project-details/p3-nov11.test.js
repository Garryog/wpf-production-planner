// Project details P3 (Coder): Garry's 11 Nov answers — several specs per project, red until every spec is signed off,
// sign-off by Project Managers only, Management edits, Customer change is Admin only, the spec's materials come first in
// the cutting-list Material drop-down. Fake Supabase only. Run: node tests/project-details/p3-nov11.test.js
const X = require('./fixp.js');
const { H, D, DP, rec, sleep } = X;
const ev = (t, f, a) => t.page.evaluate(f, a);
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const pm = await X.dev(browser, S, 'pm');
  await ev(pm, () => { sessionStorage.setItem('wpfWho', 'Mary PM'); lsSpecDlg('P1'); }); await sleep(300);
  const t0 = await ev(pm, () => ({ tabs: [...document.querySelectorAll('[data-sptab]')].map(b => b.textContent.trim()), add: !!document.getElementById('sp-newspec'), rows: S0 = document.querySelectorAll('.spec-tbl tr.spec-r').length }));
  rec('a project with no spec yet: one default "Kitchens" sheet (22 items) and ＋ Add spec', t0.tabs.length === 1 && /^Kitchens 0\/21/.test(t0.tabs[0]) && t0.add && t0.rows === 22, JSON.stringify(t0));
  rec('nothing is written until something is saved', S.db.t.project_specs.length === 0);
  // first save creates the default spec with the fixed id
  await ev(pm, () => { const i = specItems('P1').findIndex(e => e.item === 'Hinges'); const b = document.querySelector('[data-spv="' + i + '"]'); b.value = 'Hettich Stock'; b.onchange(); }); await sleep(500);
  rec('first save makes the default spec (fixed id) and the item on it', S.db.t.project_specs.length === 1 && S.db.t.project_specs[0].id === 'SPD:P1' && S.db.t.project_spec_items[0].spec_id === 'SPD:P1', JSON.stringify(S.db.t.project_specs));
  // add a Robes spec
  await ev(pm, () => document.getElementById('sp-newspec').click()); await sleep(100);
  await ev(pm, () => { document.getElementById('sp-nsn').value = 'Robes'; document.getElementById('sp-nst').value = 'robes'; document.getElementById('sp-nsok').click(); }); await sleep(500);
  const t1 = await ev(pm, () => ({ tabs: [...document.querySelectorAll('[data-sptab]')].map(b => b.textContent.trim()), on: document.querySelector('.spec-tab.on').textContent.trim(), items: [...document.querySelectorAll('.spec-tbl tr.spec-r td:first-child b')].map(b => b.textContent) }));
  rec('＋ Add spec "Robes": second tab, opened, with the Robes checklist', t1.tabs.length === 2 && /^Robes/.test(t1.on) && t1.items.includes('Sliding Door System') && !t1.items.includes('Worktop Colour'), JSON.stringify(t1).slice(0, 300));
  await ev(pm, () => document.getElementById('sp-newspec').click()); await sleep(100);
  await ev(pm, () => { document.getElementById('sp-nsn').value = ' robes '; document.getElementById('sp-nsok').click(); }); await sleep(300);
  rec('a second spec with the same name is refused', S.db.t.project_specs.length === 2 && /already has a spec/.test(await ev(pm, () => document.getElementById('sp-msg').textContent)));
  // the same item name on both specs
  await ev(pm, () => { const sid = document.querySelector('.spec-tab.on').dataset.sptab; const i = specItems('P1', sid).findIndex(e => e.item === 'Hinges'); const b = document.querySelector('[data-spv="' + i + '"]'); b.value = 'Blum'; b.onchange(); }); await sleep(500);
  rec('Hinges saved on Robes without touching Kitchens', S.db.t.project_spec_items.filter(r => r.item === 'Hinges').map(r => r.value).sort().join() === 'Blum,Hettich Stock');
  const open = await ev(pm, () => specOpen('P1'));
  rec('red chip counts every spec, with the spec name in front', open.some(x => x === 'Kitchens: Hinges') && open.some(x => x === 'Robes: Hinges') && open.length === 21 + 21, open.length + ' ' + open.slice(0, 2));
  // sign off everything on Kitchens only → still red (Robes)
  const kit = S.db.t.project_specs.find(s => s.id === 'SPD:P1'), rob = S.db.t.project_specs.find(s => s.name === 'Robes');
  const fill = async sid => { const items = await ev(pm, sid => specItems('P1', sid).map(e => e.item), sid); items.forEach((it, i) => { if (/^other info/i.test(it)) return; const r = S.db.t.project_spec_items.find(x => x.spec_id === sid && x.item === it); if (r) DP.update(S.db, r, { status: 'signed-off', signed_by: 'T' }); else DP.insert(S.db, { id: sid + ':' + i, project_id: 'P1', spec_id: sid, item: it, value: 'Y', status: 'signed-off', signed_by: 'T' }); }); };
  await fill(kit.id); await ev(pm, async () => { await lsPoll(); }); await sleep(200);
  const o2 = await ev(pm, () => ({ open: specOpen('P1'), chip: !!specChip('P1') }));
  rec('Kitchens fully signed off, Robes not: the project stays red', o2.chip && o2.open.length === 21 && o2.open.every(x => /^Robes: /.test(x)), o2.open.length + ' ' + o2.open[0]);
  // retire Robes → green
  await ev(pm, () => { SPEC_DLG.draw(); }); await sleep(100);
  await ev(pm, () => { [...document.querySelectorAll('[data-sptab]')].find(b => /^Robes/.test(b.textContent)).click(); }); await sleep(100);
  await ev(pm, () => document.getElementById('sp-ret').click()); await sleep(500);
  rec('"Not used any more": the spec is kept in the database, hidden, and no longer counts', rob.active === false && S.db.t.project_specs.length === 2 && (await ev(pm, () => specOpen('P1').length === 0 && document.querySelectorAll('[data-sptab]').length === 1)));
  rec('the last spec can\'t be retired', await ev(pm, async () => { document.getElementById('sp-ret').click(); await new Promise(r => setTimeout(r, 200)); return /at least one spec/.test(document.getElementById('sp-msg').textContent); }) && kit.active === true);
  // print: one block per spec
  DP.updateSpec(S.db, rob, { active: true }); await ev(pm, async () => { await lsPoll(); }); await X.catchPrint(pm.page);
  await ev(pm, () => specPrint('P1')); await sleep(100);
  const pr = (await X.printed(pm.page))[0] || '';
  rec('print: one block per spec', /PROJECT DETAILS — Aderrig — Kitchens/.test(pr) && /PROJECT DETAILS — Aderrig — Robes/.test(pr));
  await pm.close();

  // ---- sign-off: Project Managers only
  const S2 = X.makeServer(); X.spec(S2, 'SP-1', 'Hinges', 'Blum');
  for (const role of ['office', 'dash', 'prod', 'design']) {
    const t = await X.dev(browser, S2, role);
    const r = await ev(t, () => { localStorage.removeItem('wpfSignPin'); localStorage.setItem('wpfEditPin', '7777'); let n = 0, txt = ''; window.prompt = m => { n++; txt = m; return null; }; return { edit: specEditOk(), sign: specSignOk(), n, txt }; });
    rec(role + ': edits values without a PIN; sign-off asks for the Project Manager PIN', r.edit && !r.sign && r.n === 1 && /Only Project Managers/.test(r.txt), JSON.stringify(r).slice(0, 200));
    if (role === 'office') {
      const r2 = await ev(t, () => { window.prompt = () => '7777'; const a = specSignOk(); window.prompt = () => '8888'; const b = specSignOk(); window.prompt = () => '6666'; const c = specSignOk(); let n = 0; window.prompt = () => { n++; return null; }; const d = specSignOk(); return { a, b, c, d, n }; });
      rec('office: Production Manager / Drawing office PINs refused, the PM PIN accepted — and asked again next time (never remembered off the PM screen)', !r2.a && !r2.b && r2.c && !r2.d && r2.n === 1, JSON.stringify(r2));
    }
    await t.close();
  }
  for (const role of ['saw', 'stores', 'driver', 'floor']) { const t = await X.dev(browser, S2, role); const r = await ev(t, () => { let n = 0; window.prompt = () => { n++; return '9000'; }; return { e: specEditOk(), s: specSignOk(), m: lsMatEditOk(), n }; }); rec(role + ': read-only, never asked for a PIN', !r.e && !r.s && !r.m && r.n === 0, JSON.stringify(r)); await t.close(); }
  // retiring a spec that still has open items needs a Project Manager (it would turn the project green without a sign-off)
  { X.sheet(S2, 'SSR', 'Robes', 'robes'); const t = await X.dev(browser, S2, 'office');
    await ev(t, () => lsSpecDlg('P1', 'SSR')); await sleep(300);
    const r = await ev(t, async () => { let n = 0; window.prompt = () => { n++; return null; }; window.confirm = () => true; document.getElementById('sp-ret').click(); await new Promise(r => setTimeout(r, 300)); return n; });
    rec('office: "Not used any more" on a spec with open items asks for the Project Manager PIN; cancelled = still in use', r === 1 && S2.db.t.project_specs.find(s => s.id === 'SSR').active === true);
    const r2 = await ev(t, async () => { const a = ['6666', 'Mary PM']; window.prompt = () => a.shift(); document.getElementById('sp-ret').click(); await new Promise(r => setTimeout(r, 400)); return 1; });
    rec('with the PM PIN it is retired, and the history says who', S2.db.t.project_specs.find(s => s.id === 'SSR').active === false && S2.db.t.project_events.some(e => e.entity === 'spec-sheet' && e.entity_id === 'SSR' && e.act === 'retire'), JSON.stringify(S2.db.t.project_events.filter(e => e.entity === 'spec-sheet')));
    await t.close(); }
  // Management adds a material and fills in a value
  const dash = await X.dev(browser, S2, 'dash');
  await ev(dash, () => { let n = 0; window.prompt = () => { n++; return null; }; window.__n = () => n; lsMaterialsDlg('P1'); }); await sleep(200);
  await ev(dash, () => { document.getElementById('mt-new-n').value = 'Egger H1146'; document.getElementById('mt-add').click(); }); await sleep(500);
  rec('Management adds a material, no PIN', S2.db.t.project_materials.some(m => m.name === 'Egger H1146') && (await ev(dash, () => window.__n())) === 0);
  await dash.close();

  // ---- Customer: Admin only; Floor / Unit / Title as before
  const of = await X.dev(browser, S2, 'office');
  await ev(of, () => showTab('l')); await sleep(300);
  await ev(of, () => document.querySelector('[data-lhedit="L1"]').click()); await sleep(500);
  const c1 = await ev(of, () => { let n = 0; window.prompt = () => { n++; return '2468'; }; const i = document.querySelector('[data-woe="customer"]'); i.value = 'Cairn Homes'; i.onchange(); return { n, cust: DB.orders.find(x => x.wo === 'WO-1').customer }; });
  rec('Customer: the Office PIN is refused, nothing changed', c1.n === 1 && c1.cust === 'Aderrig Homes', JSON.stringify(c1));
  const c2 = await ev(of, () => { let n = 0; window.prompt = () => { n++; return '9000'; }; window.confirm = () => true; const i = document.querySelector('[data-woe="customer"]'); i.value = 'Cairn Homes'; i.onchange(); const o = DB.orders.find(x => x.wo === 'WO-1'); return { n, cust: o.customer, pov: o.pov }; });
  rec('Customer: the Admin PIN changes it (override kept for Export Changes)', c2.n === 1 && c2.cust === 'Cairn Homes' && c2.pov && c2.pov.customer.cien === 'Aderrig Homes', JSON.stringify(c2));
  const c3 = await ev(of, () => { let n = 0; window.prompt = () => { n++; return null; }; const i = document.querySelector('[data-woe="customer"]'); i.value = 'Other'; i.onchange(); const a = n; const j = document.querySelector('[data-woe="title"]'); j.value = 'NEW TITLE'; j.onchange(); return { a, n, t: DB.orders.find(x => x.wo === 'WO-1').title, cust: DB.orders.find(x => x.wo === 'WO-1').customer }; });
  rec('the Admin PIN is asked every time (not remembered); Title needs no PIN', c3.a === 1 && c3.n === 1 && c3.t === 'NEW TITLE' && c3.cust === 'Cairn Homes', JSON.stringify(c3));
  // ---- the spec's materials come first in the cutting-list Material drop-down
  X.spec(S2, 'SP-2', 'Carcass Material', 'MFC White', { material_id: 'M1' });
  await ev(of, async () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); await lsPoll(); document.querySelector('[data-lhedit="L1"]').click(); }); await sleep(600);
  const g = await ev(of, () => { const s = [...document.querySelectorAll('.me-ed select[data-mr$="|mat"]')].find(x => x.querySelector('optgroup')); return s ? [...s.querySelectorAll('optgroup')].map(o => o.label + ': ' + [...o.querySelectorAll('option')].map(x => x.value).join(',')) : []; });
  rec('list window Material drop-down: "From the project details (spec)" first, the rest after', /^From the project details \(spec\): MFC White/.test(g[0] || '') && /^Other project materials: /.test(g[1] || '') && !/MFC White/.test(g[1]), JSON.stringify(g));
  rec('no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
