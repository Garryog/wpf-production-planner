// Tester attack 1 (Project details): 360 px phones — Project details window, PM Projects tab, cutting-list window header
// (Floor/Unit/Title/Customer boxes + the two buttons); Export Changes Job details panel + Excel sheet. Fake Supabase only.
// Run: node tests/project-details/attack1-phone.test.js
const X = require('./fixp.js');
const { H, rec, sleep } = X;
const ev = (t, fn, a) => t.page.evaluate(fn, a);
const VP = { viewport: { width: 360, height: 740 } };
// every visible element wider than the screen / sticking out of its scroller, and small tap targets
const measure = (t, sel) => ev(t, sel => {
  const root = document.querySelector(sel); if (!root) return { missing: sel };
  const W = document.documentElement.clientWidth, out = [], small = [];
  root.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width) return;
    if (r.right > W + 1 || r.left < -1) out.push((e.id || e.className || e.tagName) + ':' + Math.round(r.left) + '..' + Math.round(r.right));
    if (/^(BUTTON|SELECT|INPUT|TEXTAREA)$/.test(e.tagName) && r.height < 30) small.push((e.id || e.dataset.woundo || e.textContent || e.tagName).toString().trim().slice(0, 20) + ' h' + Math.round(r.height)); });
  const sc = []; root.querySelectorAll('*').forEach(e => { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible') sc.push((e.id || e.className || e.tagName) + ' ' + e.scrollWidth + '/' + e.clientWidth); });
  return { doc: document.documentElement.scrollWidth, W, out: out.slice(0, 8), nOut: out.length, small: small.slice(0, 10), sc: sc.slice(0, 5) };
}, sel);
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  X.spec(S, 'SP-1', 'Hinges', 'Hettich Sensys 110° soft-close full overlay with integrated damping (long value)');
  X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { name: 'Aderrig Phase 2 Block C — Apartments Kitchens Long Project Name' });
  // PM Projects tab
  const pm = await X.dev(browser, S, 'pm', VP);
  await ev(pm, () => { pmTab = 'projects'; render(); }); await sleep(300);
  const m1 = await measure(pm, '#pjh');
  rec('360px PM Projects tab: no sideways scroll', m1.doc <= 360 && !m1.nOut, JSON.stringify(m1));
  rec('360px PM Projects tab: buttons tappable (>=30px)', !(m1.small || []).length, JSON.stringify(m1.small));
  // Project details window
  await ev(pm, () => lsSpecDlg('P1')); await sleep(400);
  const m2 = await measure(pm, '.pod-ovl:last-of-type .pod-in');
  rec('360px Project details: no sideways scroll', m2.doc <= 360 && !m2.nOut, JSON.stringify(m2));
  rec('360px Project details: boxes/buttons tappable (>=30px)', !(m2.small || []).length, JSON.stringify(m2.small));
  await pm.close();
  // cutting-list window on a phone (office / drawing office)
  const of = await X.dev(browser, S, 'design', VP);
  await ev(of, () => openListEditor2('L1')); await sleep(600);
  const has = await ev(of, () => !!document.getElementById('me-woinfo'));
  if (!has) { await ev(of, () => { const b = document.querySelector('[data-lhedit="L1"]'); if (b) b.click(); }); await sleep(600); }
  await ev(of, () => { const i = document.querySelector('[data-woe="title"]'); i.value = 'A VERY LONG CORRECTED TITLE FOR HOUSE 1 TYPE B WITH EXTRAS'; i.onchange(); }); await sleep(300);
  const m3 = await measure(of, '.me-top');
  rec('360px list window header: no sideways scroll (Floor/Unit/Title/Customer + Materials + Project details)', m3.doc <= 360 && !m3.nOut, JSON.stringify(m3));
  rec('360px list window header: boxes, ↺ and the two buttons tappable (>=30px)', !(m3.small || []).length, JSON.stringify(m3.small));
  await of.close();
  // Export Changes Job details panel + Excel sheet escaping
  const o = await X.dev(browser, S, 'office');
  const bad = '<img src=x onerror="window.__x=1"> O\'Grady "B" 🙂';
  await ev(o, b => { const j = DB.orders.find(x => x.wo === 'WO-1'); jobInfoSet(j, 'title', b); jobInfoSet(j, 'customer', b); showTab('x'); }, bad); await sleep(400);
  const r = await ev(o, () => ({ x: window.__x || 0, t: (document.getElementById('pov-panel') || {}).innerText || '' }));
  rec('Export Changes Job details: HTML shown as text', !r.x && r.t.includes('O\'Grady "B"'), r.t.slice(0, 200));
  const sh = await ev(o, () => { const ws = povSheet(); const a = XLSX.utils.sheet_to_json(ws, { header: 1 }); return a; });
  rec('Excel Job details sheet: one row per changed field, values raw', sh.length === 3 && sh.some(r => r[3] === '<img src=x onerror="window.__x=1"> O\'Grady "B" 🙂'), JSON.stringify(sh).slice(0, 300));
  // the Changes workbook really carries the sheet
  const names = await ev(o, () => { const w2 = DB.orders.find(x => x.wo === 'WO-2'); w2.plannedWeek = '2026-12-07'; showTab('x'); const got = []; const orig = XLSX.writeFile; XLSX.writeFile = (w, f) => { got.push(f + ':' + w.SheetNames.join('+')); }; ['btn-xchg', 'btn-xpov'].forEach(id => { const b = document.getElementById(id); if (b) b.click(); else got.push('no ' + id); }); XLSX.writeFile = orig; return got; });
  rec('Changes Excel has a "Job details" sheet', names.some(n => /Changes.*Job details/.test(n)) && names.some(n => /Job_details.*:Job details/.test(n)), JSON.stringify(names));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await o.close(); await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
