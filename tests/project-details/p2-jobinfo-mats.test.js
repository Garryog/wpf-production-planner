// Project details P2 (Coder): Floor / Unit / Title / Customer edited in the cutting-list window (planner overrides kept
// through imports, logged, on Export Changes) and who may edit materials. Fake Supabase only.
// Run: node tests/project-details/p2-jobinfo-mats.test.js
const X = require('./fixp.js');
const { H, D, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const of = await X.dev(browser, S, 'office');
  await of.page.evaluate(() => { showTab('l'); }); await sleep(300);
  await of.page.evaluate(() => document.querySelector('[data-lhedit="L1"]').click()); await sleep(500);
  const before = await of.page.evaluate(() => [...document.querySelectorAll('#me-woinfo [data-woe]')].map(i => i.dataset.woe + '=' + i.value + (i.disabled || i.readOnly ? '(ro)' : '')));
  rec('list window: Floor, Unit, Title, Customer are editable boxes', before.length === 4 && before.every(x => !/\(ro\)/.test(x)), before.join(' | '));
  await of.page.evaluate(() => { const i = document.querySelector('[data-woe="title"]'); i.value = 'HOUSE 1 TYPE B — CORRECTED'; i.onchange(); }); await sleep(200);
  await of.page.evaluate(() => { const i = document.querySelector('[data-woe="unit"]'); i.value = '12A'; i.onchange(); }); await sleep(200);
  let o = await of.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); return JSON.parse(JSON.stringify(o)); });
  rec('title and unit changed on the job, Cienapps values remembered', o.title === 'HOUSE 1 TYPE B — CORRECTED' && o.unit === '12A' && o.pov && o.pov.title.cien === 'HOUSE WO-1 TYPE B' && o.pov.unit.cien === '12', JSON.stringify(o.pov));
  rec('logged on the job: who, old, new', (o.log || []).some(l => /Title changed in the planner: "HOUSE WO-1 TYPE B" → "HOUSE 1 TYPE B — CORRECTED"/.test(l.what) && l.by), JSON.stringify((o.log || []).slice(-2)));
  rec('the box shows amber with the Cienapps value and ↺', await of.page.evaluate(() => document.querySelector('[data-woe="title"]').classList.contains('wo-ov') && /Cienapps: HOUSE WO-1 TYPE B/.test(document.getElementById('me-woinfo').innerText)));
  await sleep(1500);
  rec('saved to the database', ((S.row.orders || []).find(x => x.wo === 'WO-1') || {}).title === 'HOUSE 1 TYPE B — CORRECTED');
  // shown everywhere: the saw card
  const saw = await X.dev(browser, S, 'saw');
  rec('the saw card shows the planner title and unit', await saw.page.evaluate(() => /HOUSE 1 TYPE B — CORRECTED/.test(document.body.innerText) && /12A/.test(document.body.innerText)));
  await saw.close();
  // Export Changes
  await of.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('x'); }); await sleep(300);
  const ex = await of.page.evaluate(() => { const p = document.getElementById('pov-panel'); return p ? p.innerText : ''; });
  rec('Export Changes lists the two job-detail changes for Cienapps', /enter these in Cienapps \(2\)/.test(ex) && /HOUSE WO-1 TYPE B/.test(ex) && /12A/.test(ex), ex.slice(0, 300));
  // import with Cienapps' old value: planner value kept, preview says so
  const imp1 = await of.page.evaluate(() => { const p = analyzeImport(prepImport([{ wo: 'WO-1', title: 'HOUSE WO-1 TYPE B', unit: '12', customer: 'Aderrig Homes', step: '3. In production', dueDate: '2026-10-22' }]), 'file'); const fl = JSON.stringify(p.flagged); applyImport(p); const o = DB.orders.find(x => x.wo === 'WO-1'); return { fl, title: o.title, unit: o.unit, pov: o.pov }; });
  rec('re-import with the old Cienapps value: planner value kept, preview flags it', imp1.title === 'HOUSE 1 TYPE B — CORRECTED' && imp1.unit === '12A' && /planner value kept/.test(imp1.fl) && imp1.pov && imp1.pov.title, JSON.stringify(imp1).slice(0, 400));
  // Cienapps has a different value again → remembered
  const imp2 = await of.page.evaluate(() => { const p = analyzeImport(prepImport([{ wo: 'WO-1', title: 'HOUSE 1 TYPE B (REV)', step: '3. In production', dueDate: '2026-10-22' }]), 'file'); applyImport(p); const o = DB.orders.find(x => x.wo === 'WO-1'); return { title: o.title, cien: o.pov && o.pov.title && o.pov.title.cien }; });
  rec('Cienapps changes its value: the planner keeps its own, the new Cienapps value is remembered', imp2.title === 'HOUSE 1 TYPE B — CORRECTED' && imp2.cien === 'HOUSE 1 TYPE B (REV)', JSON.stringify(imp2));
  // Cienapps catches up → override clears itself
  const imp3 = await of.page.evaluate(() => { const p = analyzeImport(prepImport([{ wo: 'WO-1', title: 'HOUSE 1 TYPE B — CORRECTED', unit: '12A', step: '3. In production', dueDate: '2026-10-22' }]), 'file'); applyImport(p); const o = DB.orders.find(x => x.wo === 'WO-1'); return { pov: o.pov || null, n: povList().length, log: (o.log || []).slice(-2).map(l => l.what) }; });
  rec('Cienapps catches up: the override clears itself and drops off Export Changes', imp3.pov === null && imp3.n === 0 && imp3.log.some(w => /no longer on Export Changes/.test(w)), JSON.stringify(imp3));
  // ↺ back to Cienapps value
  await of.page.evaluate(() => { showTab('l'); }); await sleep(300);
  await of.page.evaluate(() => document.querySelector('[data-lhedit="L1"]').click()); await sleep(500);
  await of.page.evaluate(() => { const i = document.querySelector('[data-woe="floor"]'); i.value = '1st'; i.onchange(); }); await sleep(100);
  await of.page.evaluate(() => document.querySelector('[data-woundo="floor"]').click()); await sleep(100);
  o = await of.page.evaluate(() => JSON.parse(JSON.stringify(DB.orders.find(x => x.wo === 'WO-1'))));
  rec('↺ puts the Cienapps value back and the override goes', o.floor === 'GF' && !o.pov, JSON.stringify({ f: o.floor, pov: o.pov }));
  // blank title refused
  await of.page.evaluate(() => { const i = document.querySelector('[data-woe="title"]'); i.value = '  '; i.onchange(); }); await sleep(100);
  rec('a blank title is refused', await of.page.evaluate(() => DB.orders.find(x => x.wo === 'WO-1').title === 'HOUSE 1 TYPE B — CORRECTED'));
  // escaping
  await of.page.evaluate(() => { const i = document.querySelector('[data-woe="title"]'); i.value = '<img src=x onerror=window.__x=1> O\'Grady "A"'; i.onchange(); }); await sleep(200);
  await of.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('x'); }); await sleep(300);
  rec('typed HTML is shown as text, never run', await of.page.evaluate(() => !window.__x && /O'Grady "A"/.test(document.getElementById('pov-panel').innerText)));
  await of.close();

  // ---- materials rights
  for (const [role, ok] of [['pm', true], ['office', true], ['dash', true], ['prod', true], ['design', true], ['floor', false], ['saw', false], ['stores', false], ['driver', false]]) {
    const t = await X.dev(browser, S, role);
    const r = await t.page.evaluate(() => { let asked = 0; window.prompt = () => { asked++; return null; }; const v = lsMatEditOk(); return { v, asked }; });
    rec('materials: ' + role + (ok ? ' edits without a PIN' : ' is read-only'), r.v === ok && r.asked === 0, JSON.stringify(r));
    await t.close();
  }
  // PM adds a material from the Projects tab
  const pm = await X.dev(browser, S, 'pm');
  await pm.page.evaluate(() => { pmTab = 'projects'; render(); }); await sleep(200);
  await pm.page.evaluate(() => document.querySelector('[data-pjhm="P1"]').click()); await sleep(200);
  await pm.page.evaluate(() => { let asked = 0; window.prompt = () => { asked++; return null; }; window.__asked = () => asked; document.getElementById('mt-new-n').value = '18mm MFC Grey'; document.getElementById('mt-add').click(); }); await sleep(500);
  rec('PM adds a material from the Projects tab, no PIN', S.db.t.project_materials.some(m => m.name === '18mm MFC Grey' && m.project_id === 'P1') && (await pm.page.evaluate(() => window.__asked())) === 0);
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
