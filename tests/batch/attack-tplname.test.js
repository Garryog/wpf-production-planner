// Tester attack (20 Nov), part C: one name per template. A template "4C" whose hidden type name is "4B" (the Emmet Road case) on
// every screen that shows or searches templates; lists made from it; an OLD screen (origin/main, read with "git show") editing the
// same template before / after the new one. Fake Supabase only.
// Run: node tests/batch/attack-tplname.test.js
const L = require('../list-window/lw.js');
const A = require('../stage3/atk.js');
const { X, D, sleep, closeAll, asks, setv, rows, save } = L;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const tpl = (S, id) => S.db.t.lists.find(l => l.id === id);
const has4B = s => /\b4B\b/.test(s);
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const row = X.v2Row();
    row.orders.forEach(o => { if (o.wo === 'WO-3') Object.assign(o, { title: 'HOUSE 13 TYPE 4C KITCHEN', step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21' }); if (o.wo === 'WO-6') Object.assign(o, { title: 'HOUSE 4 TYPE 4B KITCHEN', customer: 'Aderrig Homes', step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21' }); });
    const S = X.makeServer(row);
    X.F3.seedList(S, 'T3', { wos: [], name: 'Type 4C', list: { is_template: true, type_name: 'Type 4B', list_type: 'kitchen' } });
    // a live list made from that template on main: it carries type_name "4B"
    X.F3.seedList(S, 'LOLD', { wos: ['WO-1'], name: 'House 1 old', list: { type_name: 'Type 4B', template_id: 'T3', template_rev: 1, source: 'template' } });
    const t = await X.dev(browser, S, 'office'), po = t.page; await asks(po);
    await po.evaluate(async () => { lsReset(); await lsLoad(); setWho('Ann'); });
    const screens = await po.evaluate(async () => {
      const out = {}; const txt = () => [...document.querySelectorAll('.pod-ovl')].map(x => x.innerText).join(' ');
      const shut = () => document.querySelectorAll('.pod-ovl').forEach(x => x.remove());
      showTab('l'); render(); out.issue = [...document.querySelectorAll('.lti-chip')].map(x => x.innerText).join(' | ');
      LTI.open = 'WO-3'; ltiAfter(); out.change = [...document.querySelectorAll('[data-ltisel] option')].map(o => o.textContent).join(' | '); LTI.open = '';
      lsNewChoose('WO-3', 'P1'); await new Promise(r => setTimeout(r, 200)); out.startFrom = txt(); out.startQ = [...document.querySelectorAll('[data-sflq]')].map(b => b.dataset.sflq).join('|'); shut();
      lsTplDlg('T3', 'WO-3'); await new Promise(r => setTimeout(r, 200)); out.attach = txt().split(' → ')[0] + ' name=' + ((document.getElementById('tp-name') || {}).value || ''); shut();
      try { lsTplHistory('T3'); await new Promise(r => setTimeout(r, 400)); out.hist = txt(); } catch (e) { out.hist = 'ERR ' + e.message; } shut();
      LH.kind = 'tpl'; LH.q = '4b'; render(); out.home4b = [...document.querySelectorAll('[data-lhrow]')].map(r => r.dataset.lhrow).join(','); LH.q = '4c'; render(); out.home4c = [...document.querySelectorAll('[data-lhrow]')].map(r => r.dataset.lhrow).join(','); LH.q = ''; LH.kind = 'live'; render();
      lstAttachOpen = 'WO-3'; try { renderLists(document.getElementById('app')); } catch (e) {} out.libAttach = [...document.querySelectorAll('[data-tplatt]')].map(b => b.textContent).join(' | '); lstAttachOpen = null;
      out.live = tplName(lsList('LOLD'));
      return out;
    });
    for (const k of ['issue', 'change', 'startFrom', 'attach', 'hist', 'libAttach']) rec('screen "' + k + '": shows "4C", never "4B"', /4C/.test(screens[k]) && !has4B(screens[k]), String(screens[k]).replace(/\s+/g, ' ').slice(0, 220));
    rec('"Start from" search text holds only the name (typing 4B finds nothing)', !/4b/.test(screens.startQ) && /4c/.test(screens.startQ), screens.startQ);
    rec('Lists home, templates, search "4b" does not find the 4C template; "4c" does', !/T3/.test(screens.home4b) && /T3/.test(screens.home4c), screens.home4b + ' / ' + screens.home4c);
    rec('INFO: a LIVE list made from it on main still says type "' + screens.live + '" (live lists keep their own type name)', true);
    // the title "TYPE 4B" no longer finds the 4C template (it used to, through the hidden type name)
    const lv = await po.evaluate(() => ltiRows().filter(r => ['WO-3', 'WO-6'].includes(r.o.wo)).map(r => r.o.wo + ':' + r.lvl + ':' + (r.tid || '-')).join(' '));
    rec('"TYPE 4C" title green on 4C; "TYPE 4B" title is NOT green on it', /WO-3:strong:T3/.test(lv) && !/WO-6:strong/.test(lv), lv);
    // single ✓ Confirm WO-3 → list name and type name
    await po.evaluate(async () => { window.confirm = () => true; showTab('l'); render(); const b = document.querySelector('[data-lticonf="WO-3"]'); if (b) b.click(); for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 200)); if (!LTI.busy.size) break; } });
    await sleep(500);
    const made = S.db.t.lists.find(l => !l.is_template && (l.wos || []).includes('WO-3'));
    rec('✓ Confirm: the new list is called "Type 4C" and carries type_name "Type 4C"', made && made.name === 'Type 4C' && made.type_name === 'Type 4C', JSON.stringify(made && [made.name, made.type_name]));
    const dz = await X.dev(browser, S, 'design'), p = dz.page; await asks(p);
    await p.evaluate(async () => { localStorage.setItem('wpfEditPin', '9000'); lsReset(); await lsLoad(); setWho('Dee'); });
    const s2 = await p.evaluate(async () => { const out = {}; const txt = () => [...document.querySelectorAll('.pod-ovl')].map(x => x.innerText).join(' '); const shut = () => document.querySelectorAll('.pod-ovl').forEach(x => x.remove());
      lsTplAddDlg('P1'); await new Promise(r => setTimeout(r, 200)); out.add = txt(); shut();
      lsCopyDlg('P2'); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector('[data-cpp="P1"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 200)); out.copy = txt(); shut(); return out; });
    rec('screen "copy" (drawing office): the TEMPLATE row is "Type 4C"', /Type 4C\s+Template/.test(s2.copy), s2.copy.replace(/\s+/g, ' ').slice(0, 200));
    rec('Low (also on main): "Copy into … as a template" offers a LIVE list made from 4C as "Type 4B" — the copied template would be NAMED "Type 4B"', !/Type 4B\s+Live list/.test(s2.copy), s2.copy.replace(/\s+/g, ' ').slice(0, 260));
    for (const k of ['add']) rec('screen "' + k + '" (drawing office): shows "4C", never "4B"', /4C/.test(s2[k]) && !has4B(s2[k]), String(s2[k]).replace(/\s+/g, ' ').slice(0, 220));
    // ---------- an OLD screen (origin/main) and the new one editing the same template ----------
    const html = A.gitShow('origin/main');
    if (!html) rec('origin/main readable', false);
    else {
      const old = await A.openOld(browser, S, html), q = old.page;
      await q.evaluate(async () => { localStorage.setItem('wpfPin_design', '9000'); localStorage.setItem('wpfEditPin', '9000'); setRole('design'); lsReset(); await lsLoad(); window.confirm = () => true; window.prompt = () => 'Old'; });
      // old screen shows ... and saves the template (a qty change) BEFORE the new one ever saved it
      const o1 = await q.evaluate(async () => { const x = lsList('T3'); return x ? (x.typeName || x.name) : null; });
      rec('INFO old screen shows the template as "' + o1 + '" (old rule typeName || name)', true);
      await q.evaluate(async () => { openListEditor('T3'); await new Promise(r => setTimeout(r, 900)); const e = document.querySelector('.me-ed [data-mr="0|note"]'); if (e) { e.value = 'old screen'; e.dispatchEvent(new Event('input')); } const s = document.getElementById('me-save'); if (s) s.click(); await new Promise(r => setTimeout(r, 2500)); });
      const a1 = tpl(S, 'T3');
      rec('old screen saves the template: name stays "4C" (type_name it wrote: "' + a1.type_name + '")', a1.name === 'Type 4C', JSON.stringify([a1.name, a1.type_name, a1.rev]));
      await p.evaluate(async () => { await lsPoll(); render(); });
      rec('… the new screen still shows "4C" whatever the old one wrote', await p.evaluate(() => tplName(lsList('T3')) === 'Type 4C'));
      // new screen renames it "4D"; the old screen then saves it again (it reloads first)
      await closeAll(p);
      await p.evaluate(async () => { openListEditor('T3'); await new Promise(r => setTimeout(r, 900)); const e = document.getElementById('me-name'); e.value = 'Type 4D'; e.dispatchEvent(new Event('input')); document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2500)); });
      await closeAll(p);
      const a2 = tpl(S, 'T3');
      rec('new screen renames to "4D": name and type_name "4D"', a2.name === 'Type 4D' && a2.type_name === 'Type 4D', JSON.stringify([a2.name, a2.type_name]));
      await q.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); await lsPoll(); openListEditor('T3'); await new Promise(r => setTimeout(r, 900)); const e = document.querySelector('.me-ed [data-mr="0|note"]'); if (e) { e.value = 'old again'; e.dispatchEvent(new Event('input')); } const s = document.getElementById('me-save'); if (s) s.click(); await new Promise(r => setTimeout(r, 2500)); });
      const a3 = tpl(S, 'T3');
      rec('old screen saves after the rename: the name "4D" is kept (not put back to 4C)', a3.name === 'Type 4D', JSON.stringify([a3.name, a3.type_name, a3.rev]));
      await p.evaluate(async () => { await lsPoll(); });
      rec('… new screen shows "4D"', await p.evaluate(() => tplName(lsList('T3')) === 'Type 4D'));
      await old.close();
    }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close(); await dz.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
