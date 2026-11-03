// Cutting-list flow, step 4: a WO whose Cienapps customer heading isn't linked to a project — "Link to project ▾" (adds the
// heading to the project's cien_names) or "+ New project" (one tap). Every WO with that heading follows.
// Fake Supabase only. Run: node tests/stage3/flow4-link.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const RIV = 'RIVERSIDE DEVELOPMENTS - RIVERSIDE', BAL = 'GLENVEAGH HOMES - BALLYMASTONE PH2';
function server() {
  const o = (wo, title, customer, x) => H.order(Object.assign({ wo, title, customer, step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [o('WO-5', 'HOUSE 2 TYPE B KITCHEN', RIV), o('WO-6', 'HOUSE 3 TYPE B KITCHEN', RIV + ' '), o('WO-8', 'HOUSE 1 KITCHEN', BAL), o('WO-9', 'HOUSE 9 KITCHEN', ''), o('WO-10', 'HOUSE 10 KITCHEN', 'CROWN - OLD SITE')];
  const S = F.makeServer(row);
  D.insert(S.db, 'projects', { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes' });
  D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' }); D.insert(S.db, 'project_materials', { id: 'M2', project_id: 'P1', name: 'Blum hinge', kind: 'other' });
  D.insert(S.db, 'projects', { id: 'P9', name: 'crown - old site', active: false });
  F.seedList(S, 'T1', { name: 'Type B kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed' } });
  return S;
}
const rows = p => p.evaluate(() => [...document.querySelectorAll('[data-ltirow]')].map(r => r.dataset.ltirow + ':' + r.querySelector('[data-ltilvl]').dataset.ltilvl + (r.querySelector('[data-ltilink]') ? ':link' : '') + (r.querySelector('[data-ltitype]') ? ':type' : '')));
(async () => {
  const browser = await H.chromium.launch();
  const S = server();
  const t = await F.dev(browser, S, 'office');
  await t.page.evaluate(async () => { setWho('Ann'); window.__pin = '7777'; window.prompt = m => /PIN/.test(m) ? window.__pin : 'x'; showTab('l'); await new Promise(r => setTimeout(r, 200)); });
  let r = await rows(t.page);
  rec('unlinked customers: grey with "Link to project ▾" and "+ New project"; no customer: "Type a list"', ['WO-5:none:link', 'WO-6:none:link', 'WO-8:none:link', 'WO-9:none:type'].every(x => r.includes(x)), JSON.stringify(r));
  rec('the New project button names the customer heading', await t.page.evaluate(h => (document.querySelector('[data-ltinewp="WO-8"]') || {}).textContent.includes('New project "' + h + '"'), BAL));
  // Garry (3 Nov, answer 9): anyone in the office links a customer to a project — NO PIN is asked
  await t.page.evaluate(() => { window.__asked = []; window.__pin = '0000'; window.prompt = m => { window.__asked.push(m); return /PIN/.test(m) ? window.__pin : 'x'; }; const s = document.querySelector('[data-ltilink="WO-5"]'); s.value = 'P1'; s.onchange(); });
  await F.sleep(600);
  rec('Link to project asks for NO PIN (Garry, answer 9)', await t.page.evaluate(() => !window.__asked.some(m => /PIN/.test(m))), await t.page.evaluate(() => JSON.stringify(window.__asked)));
  r = await rows(t.page);
  rec('Link WO-5 to Cherrywood: the heading is added to the project\'s Cienapps names', (D.find(S.db, 'projects', 'P1').cien_names || []).join() === RIV, JSON.stringify(D.find(S.db, 'projects', 'P1').cien_names));
  rec('…WO-5 and WO-6 (same heading, trailing space) now get the Type B kitchen suggestion (green)', r.includes('WO-5:strong') && r.includes('WO-6:strong'), JSON.stringify(r));
  // + New project
  await t.page.evaluate(() => document.querySelector('[data-ltinewp="WO-8"]').click());
  await F.sleep(600);
  const np = S.db.t.projects.find(p => p.name === BAL);
  r = await rows(t.page);
  rec('+ New project: a project named after the heading, with it as its Cienapps name', np && (np.cien_names || []).join() === BAL && np.customer === BAL, JSON.stringify(np));
  rec('…WO-8 is linked (grey: the new project has no templates yet) and can type a list', r.includes('WO-8:none') && /no templates yet/.test(await t.page.evaluate(() => document.querySelector('[data-ltirow="WO-8"]').innerText)), JSON.stringify(r));
  await t.page.evaluate(() => document.querySelector('[data-ltichg="WO-8"]').click());
  rec('…its "Change template" offers "Type a list instead"', await t.page.evaluate(() => [...document.querySelector('[data-ltisel="WO-8"]').options].some(o => o.value === '__type')));
  // an existing (inactive) project with that name: linked and made active, not a second project
  await t.page.evaluate(() => document.querySelector('[data-ltinewp="WO-10"]').click());
  await F.sleep(600);
  const p9 = D.find(S.db, 'projects', 'P9');
  rec('+ New project when a project of that name already exists (inactive): linked to it and made active, no duplicate', p9.active === true && (p9.cien_names || []).join() === 'CROWN - OLD SITE' && S.db.t.projects.filter(p => /old site/i.test(p.name)).length === 1, JSON.stringify(p9));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  // 360 px
  const ph = await F.dev(browser, server(), 'prod', { viewport: { width: 360, height: 760 } });
  await ph.page.evaluate(async () => { document.querySelector('[data-prodtab="lists"]').click(); await new Promise(r => setTimeout(r, 200)); });
  const w = await ph.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, r: [...document.querySelectorAll('#lti [data-ltilink],#lti [data-ltinewp]')].map(e => Math.round(e.getBoundingClientRect().right)) }));
  rec('360 px: link controls on screen, no sideways scrolling', w.sw <= 360 && w.r.length && w.r.every(x => x > 0 && x <= 360), JSON.stringify(w));
  await t.close(); await ph.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
