// Tester attack 2 (Project details, 11 Nov): 360 px phone — Project details with 3 specs (tabs wrap, a long spec name,
// the Add spec form open, Rename / Not used any more), the Materials window (not tested in round 1), the list window header
// with the Customer box. Fake Supabase only. Run: node tests/project-details/attack2-phone.test.js
const X = require('./fixp.js');
const { H, D, rec, sleep } = X;
const ev = (t, fn, a) => t.page.evaluate(fn, a);
const VP = { viewport: { width: 360, height: 740 } };
const measure = (t, sel) => ev(t, sel => {
  const root = document.querySelector(sel); if (!root) return { missing: sel };
  const W = document.documentElement.clientWidth, out = [], small = [];
  root.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width) return;
    if (r.right > W + 1 || r.left < -1) out.push((e.id || e.className || e.tagName) + ':' + Math.round(r.left) + '..' + Math.round(r.right));
    if (/^(BUTTON|SELECT|INPUT|TEXTAREA)$/.test(e.tagName) && e.type !== 'checkbox' && r.height < 30) small.push((e.id || e.dataset.mts || e.dataset.woundo || e.textContent || e.tagName).toString().trim().slice(0, 20) + ' h' + Math.round(r.height));
    if (e.type === 'checkbox' && (r.height < 20 || r.width < 20)) small.push('checkbox ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  const sc = []; root.querySelectorAll('*').forEach(e => { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible') sc.push((e.id || e.className || e.tagName) + ' ' + e.scrollWidth + '/' + e.clientWidth); });
  return { doc: document.documentElement.scrollWidth, W, out: out.slice(0, 8), nOut: out.length, small: [...new Set(small)].slice(0, 12), sc: sc.slice(0, 5) };
}, sel);
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  X.sheet(S, 'SPD:P1', 'Kitchens'); X.sheet(S, 'SR', 'Robes', 'robes');
  X.sheet(S, 'SL', 'Kitchen Type B — 3-bed semi-detached houses with utility room and island', 'kitchens');
  for (let i = 0; i < 6; i++) D.insert(S.db, 'project_materials', { id: 'MX' + i, project_id: 'P1', name: 'Egger H' + (3000 + i) + ' ST' + i + ' Natural Halifax Oak long material name', kind: i % 2 ? 'other' : 'sheet', aliases: ['alias one ' + i, 'alias two ' + i] });
  const pm = await X.dev(browser, S, 'pm', VP);
  await ev(pm, () => lsSpecDlg('P1')); await sleep(400);
  const m1 = await measure(pm, '.pod-ovl:last-of-type .pod-in');
  const tb = await ev(pm, () => { const b = [...document.querySelectorAll('.spec-tab')]; return b.map(x => Math.round(x.getBoundingClientRect().top)); });
  rec('360px Project details, 3 specs + long name: no sideways scroll, tabs wrap', m1.doc <= 360 && !m1.nOut && new Set(tb).size > 1, JSON.stringify(m1) + ' tab rows=' + JSON.stringify(tb));
  await ev(pm, () => { [...document.querySelectorAll('[data-sptab]')][1].click(); }); await sleep(200);
  const m2 = await measure(pm, '.pod-ovl:last-of-type .spec-sub');
  rec('360px: Rename / Not used any more tappable (>=30px)', !m2.missing && !(m2.small || []).length, JSON.stringify(m2.small || m2));
  await ev(pm, () => document.getElementById('sp-newspec').click()); await sleep(200);
  const m3 = await measure(pm, '#sp-addform');
  rec('360px: the Add spec form fits, its boxes and buttons tappable', m3.doc <= 360 && !m3.nOut && !(m3.small || []).length, JSON.stringify(m3));
  // the Materials window on a phone
  await ev(pm, () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsMaterialsDlg('P1'); }); await sleep(300);
  const m4 = await measure(pm, '.pod-ovl:last-of-type .pod-in');
  rec('360px Materials window: no sideways scroll of the page', m4.doc <= 360 && !m4.nOut, JSON.stringify({ doc: m4.doc, out: m4.out, n: m4.nOut, sc: m4.sc }));
  rec('360px Materials window: name / kind / also-called / Save / ＋ Add tappable', !(m4.small || []).length, JSON.stringify(m4.small));
  const nm = await ev(pm, () => { const i = document.querySelector('[data-mtn="MX0"]'); const r = i.getBoundingClientRect(); return { w: Math.round(r.width), vis: r.right <= document.documentElement.clientWidth }; });
  rec('360px Materials window: a material name box is wide enough to read (>=120px) and on screen', nm.w >= 120 && nm.vis, JSON.stringify(nm));
  await pm.close();
  // the list window header on a phone (office): Floor / Unit / Title / Customer with an override
  const of = await X.dev(browser, S, 'office', VP);
  await ev(of, () => { const o = DB.orders.find(x => x.wo === 'WO-1'); jobInfoSet(o, 'customer', 'Cairn Homes Properties Limited (Adamstown Phase 2)'); jobInfoSet(o, 'title', 'HOUSE 1 TYPE B — CORRECTED LONG TITLE FOR PHONE'); openListEditor('L1'); }); await sleep(600);
  const m5 = await measure(of, '.me-top');
  rec('360px list window header with Customer / Title overrides: no sideways scroll, ↺ tappable', m5.doc <= 360 && !m5.nOut && !(m5.small || []).length, JSON.stringify(m5));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await of.close(); await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
