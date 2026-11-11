// Tester attack 2 (Project details, Garry's 11 Nov answers): several specs per project — two PCs starting the default
// spec / adding the same spec / retiring / renaming at once, lost reply and offline on Add spec, the red rule across
// active and retired specs, counts on tabs / Lists page / PM tab / prints, sign-off by Project Managers only, escaping in
// spec names. Fake Supabase only. Run: node tests/project-details/attack2-spec.test.js
const X = require('./fixp.js');
const { H, DP, rec, sleep } = X;
const ev = (t, fn, a) => t.page.evaluate(fn, a);
const open = async t => { await ev(t, () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsSpecDlg('P1'); }); await sleep(400); };
const tabs = t => ev(t, () => [...document.querySelectorAll('[data-sptab]')].map(b => b.textContent.trim()));
const tab = (t, name) => ev(t, n => { const b = [...document.querySelectorAll('[data-sptab]')].find(b => b.textContent.trim().startsWith(n)); if (b) b.click(); return !!b; }, name);
const msg = t => ev(t, () => (document.getElementById('sp-msg') || {}).textContent || '');
const setVal = (t, item, v) => ev(t, ([it, v]) => { const on = document.querySelector('.spec-tab.on'); const i = specItems('P1', on && on.dataset.sptab).findIndex(e => e.item === it); const s = document.querySelector('[data-spv="' + i + '"]'); s.value = v; s.onchange(); }, [item, v]);
const addSpec = (t, n, ty) => ev(t, ([n, ty]) => { document.getElementById('sp-newspec').click(); document.getElementById('sp-nsn').value = n; if (ty) document.getElementById('sp-nst').value = ty; document.getElementById('sp-nsok').click(); }, [n, ty]);
const hold = S => { let rel; S.holdP = new Promise(r => { rel = r; }); return () => { S.holdP = null; rel(); }; };
// every checklist item of a spec signed off straight in the fake database
function signAll(S, sid, items) { items.forEach((it, i) => { if (/^other info/i.test(it)) return; const r = S.db.t.project_spec_items.find(x => x.spec_id === sid && x.item === it); if (r) DP.update(S.db, r, { value: r.value || 'Y', status: 'signed-off', signed_by: 'T' }); else DP.insert(S.db, { id: sid + ':' + it, project_id: 'P1', spec_id: sid, item: it, value: 'Y', status: 'signed-off', signed_by: 'T' }); }); }
(async () => {
  const browser = await H.chromium.launch();
  // ---------- 1. two PCs start the default spec at the same moment (fixed id SPD:P1)
  {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'pm'), b = await X.dev(browser, S, 'office');
    await open(a); await open(b);
    const go = hold(S);
    await setVal(a, 'Hinges', 'Blum'); await setVal(b, 'Handles', 'Bar'); await sleep(300); go(); await sleep(900);
    rec('1a two PCs start the default spec at once: ONE spec row, both items kept', S.db.t.project_specs.length === 1 && S.db.t.project_specs[0].id === 'SPD:P1' && S.db.t.project_spec_items.length === 2 && S.db.t.project_spec_items.every(r => r.spec_id === 'SPD:P1'), JSON.stringify([S.db.t.project_specs.map(s => s.id), S.db.t.project_spec_items.map(r => r.item + '=' + r.value)]));
    rec('1b ...and neither PC is told "Not saved"', !/Not saved/.test(await msg(a)) && !/Not saved/.test(await msg(b)), (await msg(a)) + ' | ' + (await msg(b)));
    // both add a spec with the same name at once
    await open(a); await open(b);
    const go2 = hold(S);
    await addSpec(a, 'Robes', 'robes'); await addSpec(b, 'robes ', 'robes'); await sleep(300); go2(); await sleep(900);
    const robes = S.db.t.project_specs.filter(s => /robes/i.test(s.name));
    const ma = await msg(a), mb = await msg(b);
    rec('1c two PCs add "Robes" at once: one spec, the other PC told it already exists', robes.length === 1 && (/already has a spec/.test(ma) || /already has a spec/.test(mb)), robes.length + ' | ' + ma + ' | ' + mb);
    rec('1d ...and the loser sees the Robes tab (shown as it is now)', (await tabs(a)).some(x => /^Robes/.test(x)) && (await tabs(b)).some(x => /^Robes/.test(x)), JSON.stringify([await tabs(a), await tabs(b)]));
    await a.close(); await b.close();
  }
  // ---------- 2. two PCs add DIFFERENT specs while the project still has only its (unsaved) default sheet
  {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'pm'), b = await X.dev(browser, S, 'dash');
    await open(a); await open(b);
    const go = hold(S);
    await addSpec(a, 'Robes', 'robes'); await addSpec(b, 'Utility', 'kitchens'); await sleep(300); go(); await sleep(1000);
    rec('2a both add a spec while the default is unsaved: default + Robes + Utility, no error', S.db.t.project_specs.map(s => s.name).sort().join() === 'Kitchens,Robes,Utility' && !/Not added/.test(await msg(a) + await msg(b)), JSON.stringify(S.db.t.project_specs.map(s => s.id + ':' + s.name)) + ' ' + (await msg(a)) + '|' + (await msg(b)));
    // ---- lost reply on Add spec (the spec landed, the answer never came back)
    S.dropReplyP = 1; await addSpec(a, 'Garage', 'kitchens'); await sleep(800);
    const m1 = await msg(a), n1 = S.db.t.project_specs.filter(s => s.name === 'Garage').length, t1 = await tabs(a);
    rec('2b lost reply on Add spec: one "Garage", its tab shown', n1 === 1 && t1.some(x => /^Garage/.test(x)), n1 + ' ' + JSON.stringify(t1));
    rec('2c lost reply on Add spec: the person is NOT told "Not added" for a spec that was added', !/Not added/.test(m1), m1);
    // ---- offline Add spec / offline first edit
    S.offlineP = true; await addSpec(a, 'Offline spec', 'kitchens'); await sleep(500); S.offlineP = false;
    const m2 = await msg(a);
    rec('2d offline Add spec: nothing added, person told', !S.db.t.project_specs.some(s => s.name === 'Offline spec') && /Not added/.test(m2), m2);
    await a.close(); await b.close();
    const S2 = X.makeServer(); const c = await X.dev(browser, S2, 'pm'); await open(c);
    S2.offlineP = true; await setVal(c, 'Hinges', 'Blum'); await sleep(500); S2.offlineP = false;
    const m3 = await msg(c);
    rec('2e offline first edit (default spec not yet made): told "Not saved", nothing half-made', /Not saved/.test(m3) && !S2.db.t.project_specs.length && !S2.db.t.project_spec_items.length, m3);
    await c.close();
  }
  // ---------- 3. retire races and retired specs
  {
    const S = X.makeServer();
    X.sheet(S, 'SPD:P1', 'Kitchens'); X.sheet(S, 'SR', 'Robes', 'robes');
    const a = await X.dev(browser, S, 'pm'), b = await X.dev(browser, S, 'office');
    await open(a); await open(b); await tab(a, 'Kitchens'); await tab(b, 'Robes');
    const go = hold(S);
    await ev(a, () => document.getElementById('sp-ret').click()); await ev(b, () => document.getElementById('sp-ret').click()); await sleep(300); go(); await sleep(900);
    const act = S.db.t.project_specs.filter(s => s.active !== false).length;
    rec('3a two PCs each retire a different spec at once: the project still keeps at least one active spec', act >= 1, 'active specs left: ' + act);
    const saw = await X.dev(browser, S, 'saw');
    const r = await ev(saw, () => ({ open: specOpen('P1').length, chip: !!document.querySelector('.spec-chip'), btn: specBtn('P1').replace(/<[^>]+>/g, '') }));
    rec('3b ...and with nothing signed off the project is still RED on the saw (not silently green)', r.open > 0 && r.chip, JSON.stringify(r));
    await saw.close();
    // what the office sees with every spec retired
    await open(b);
    const v = await ev(b, () => ({ tabs: document.querySelectorAll('[data-sptab]').length, rows: document.querySelectorAll('.spec-tbl tr.spec-r').length, txt: document.getElementById('sp-body').innerText.slice(0, 300) }));
    rec('3c every spec retired: the window still shows a sheet to fill in (or a way to bring one back)', v.tabs > 0 || /bring.*back|reinstate|use again/i.test(v.txt), JSON.stringify(v));
    // bring back a retired spec: the duplicate-name message tells you to "ask the office to bring it back" — is there a way?
    DP.updateSpec(S.db, S.db.t.project_specs.find(s => s.id === 'SPD:P1'), { active: true }); await ev(b, async () => { await lsPoll(); }); await open(b);
    await addSpec(b, 'Robes', 'robes'); await sleep(400);
    const m = await msg(b);
    const back = await ev(b, () => { const h = document.querySelector('.pod-ovl:last-of-type').innerHTML; return /bring (it )?back|reinstate|use again|retired|not used any more \(/i.test(h.replace(/ask the office to bring it back/g, '')) && !!document.querySelector('[data-spback],[data-sprestore],#sp-back,#sp-restore'); });
    rec('3d a retired spec can be brought back from the screen (the refusal says "ask the office to bring it back")', back, 'msg=' + m + ' (no control found on the office screen)');
    await a.close(); await b.close();
  }
  // ---------- 4. retire on one PC while another edits / signs off an item on that spec; rename vs edit; rename vs rename
  {
    const S = X.makeServer();
    X.sheet(S, 'SPD:P1', 'Kitchens'); X.sheet(S, 'SR', 'Robes', 'robes'); X.spec(S, 'R-H', 'Handles', 'Bar', { spec_id: 'SR' });
    const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'pm');
    await open(a); await open(b); await tab(a, 'Robes'); await tab(b, 'Robes');
    await ev(a, () => document.getElementById('sp-ret').click()); await sleep(500);
    await setVal(b, 'Hinges', 'Blum'); await sleep(500);
    const mb = await msg(b), onRet = S.db.t.project_spec_items.find(r => r.spec_id === 'SR' && r.item === 'Hinges');
    rec('4a an item saved on a spec that another PC has just retired: refused or the person is told it is no longer used', !onRet || /not used|retired|no longer/i.test(mb), 'saved on the retired spec: ' + JSON.stringify(onRet && onRet.value) + ' msg=' + mb);
    await ev(b, () => { const on = document.querySelector('.spec-tab.on'); const i = specItems('P1', on && on.dataset.sptab).findIndex(e => e.item === 'Handles'); const s = document.querySelector('[data-sps="' + i + '"]'); if (s) s.click(); }); await sleep(500);
    const h = S.db.t.project_spec_items.find(r => r.id === 'R-H');
    rec('4b (info) a sign-off on the retired spec from the stale screen', true, 'Handles on retired Robes: ' + h.status + ' msg=' + (await msg(b)));
    DP.updateSpec(S.db, S.db.t.project_specs.find(s => s.id === 'SR'), { active: true });
    await open(a); await open(b); await tab(a, 'Robes'); await tab(b, 'Robes');
    await ev(a, () => { window.prompt = () => 'Robes Block C'; document.getElementById('sp-ren').click(); }); await sleep(400);
    await setVal(b, 'Mirror', 'Yes'); await sleep(500);
    rec('4c rename on one PC while the other edits an item: both kept (item on the renamed spec)', S.db.t.project_specs.find(s => s.id === 'SR').name === 'Robes Block C' && S.db.t.project_spec_items.some(r => r.spec_id === 'SR' && r.item === 'Mirror' && r.value === 'Yes') && !/Not saved/.test(await msg(b)), await msg(b));
    await ev(b, () => { window.prompt = () => 'Robes Block D'; document.getElementById('sp-ren').click(); }); await sleep(500);
    rec('4d a stale rename (other PC renamed first) is refused, not overwritten', S.db.t.project_specs.find(s => s.id === 'SR').name === 'Robes Block C' && /another screen|Not renamed/.test(await msg(b)), S.db.t.project_specs.find(s => s.id === 'SR').name + ' msg=' + (await msg(b)));
    await ev(a, () => { window.prompt = () => 'kitchens'; document.getElementById('sp-ren').click(); }); await sleep(400);
    rec('4e rename to another spec\'s name (other case) refused', S.db.t.project_specs.find(s => s.id === 'SR').name === 'Robes Block C' && /already has a spec/.test(await msg(a)), await msg(a));
    await a.close(); await b.close();
  }
  // ---------- 5. the red rule, counts and prints with 2 active specs + 1 retired
  {
    const S = X.makeServer();
    X.sheet(S, 'SPD:P1', 'Kitchens'); X.sheet(S, 'SR', 'Robes', 'robes'); X.sheet(S, 'SO', 'Old Type', 'kitchens');
    DP.updateSpec(S.db, S.db.t.project_specs.find(s => s.id === 'SO'), { active: false });
    const pm = await X.dev(browser, S, 'pm');
    const kit = await ev(pm, () => specItems('P1', 'SPD:P1').map(e => e.item)), rob = await ev(pm, () => specItems('P1', 'SR').map(e => e.item));
    signAll(S, 'SPD:P1', kit); signAll(S, 'SR', rob.filter(x => x !== 'Mirror'));
    await ev(pm, async () => { await lsPoll(); }); await sleep(200);
    const o = await ev(pm, () => ({ open: specOpen('P1'), chip: specChip('P1').replace(/<[^>]+>/g, ''), btn: specBtn('P1').replace(/<[^>]+>/g, '').trim() }));
    rec('5a one item left on Robes, retired spec untouched: red, and only "Robes: Mirror"', o.open.length === 1 && o.open[0] === 'Robes: Mirror' && /SPEC NOT SIGNED OFF: Robes: Mirror/.test(o.chip), JSON.stringify(o));
    rec('5b Details count covers active specs only (42/42 minus Mirror = 41/42)', /Details 41\/42/.test(o.btn), o.btn);
    await open(pm);
    rec('5c tabs: Kitchens 21/21, Robes 20/21, retired spec not shown', JSON.stringify(await tabs(pm)) === JSON.stringify(['Kitchens 21/21', 'Robes 20/21']), JSON.stringify(await tabs(pm)));
    await ev(pm, () => { pmTab = 'projects'; document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); render(); }); await sleep(300);
    rec('5d PM Projects tab shows the same 41/42', await ev(pm, () => /Details 41\/42/.test((document.getElementById('pjh') || document.body).innerText)));
    await X.catchPrint(pm.page); await ev(pm, () => specPrint('P1')); await sleep(100);
    const pr = (await X.printed(pm.page))[0] || '';
    rec('5e print: one block per ACTIVE spec, retired one left out', (pr.match(/class="spec-pb"/g) || []).length === 2 && /Aderrig — Kitchens/.test(pr) && /Aderrig — Robes/.test(pr) && !/Old Type/.test(pr), (pr.match(/PROJECT DETAILS — [^<]*/g) || []).join(' | '));
    await pm.close();
    const saw = await X.dev(browser, S, 'saw');
    await X.catchPrint(saw.page); await ev(saw, () => printWorkList('saw', 3)); await sleep(200);
    const sp = (await X.printed(saw.page))[0] || '';
    rec('5f printed saw sheet: banner "Robes: Mirror" + one block per active spec', /SPEC NOT SIGNED OFF: Robes: Mirror/.test(sp) && (sp.match(/class="spec-pb"/g) || []).length === 2 && !/Old Type/.test(sp), (sp.match(/PROJECT DETAILS — [^<]*/g) || []).join(' | '));
    await saw.close();
    const st = await X.dev(browser, S, 'stores');
    await X.catchPrint(st.page); await ev(st, () => printWorkList('stores', 3)); await sleep(200);
    const pst = (await X.printed(st.page))[0] || '';
    rec('5g printed stores sheet: the same banner and blocks', /SPEC NOT SIGNED OFF: Robes: Mirror/.test(pst) && (pst.match(/class="spec-pb"/g) || []).length === 2, (pst.match(/PROJECT DETAILS — [^<]*/g) || []).join(' | ') + ' len=' + pst.length);
    // sign the last one: green everywhere, the retired spec (never filled in) does not count
    signAll(S, 'SR', ['Mirror']);
    await st.page.evaluate(async () => { await lsPoll(); render(); }); await sleep(200);
    rec('5h everything on the active specs signed off: green, the retired (empty) spec ignored', await ev(st, () => specOpen('P1').length === 0 && !document.querySelector('.spec-chip')));
    await st.close();
    // a project whose only specs are all retired
    const S2 = X.makeServer(); X.sheet(S2, 'SPD:P1', 'Kitchens'); X.sheet(S2, 'SR', 'Robes', 'robes');
    S2.db.t.project_specs.forEach(s => DP.updateSpec(S2.db, s, { active: false }));
    const sw = await X.dev(browser, S2, 'saw');
    const r2 = await ev(sw, () => ({ open: specOpen('P1').length, btn: specBtn('P1').replace(/<[^>]+>/g, '').trim() }));
    rec('5i a project whose only specs are all retired (nothing ever signed): still red, not "Details 0/0"', r2.open > 0 && !/0\/0/.test(r2.btn), JSON.stringify(r2));
    await sw.close();
  }
  // ---------- 6. sign-off: Project Managers only
  {
    const S = X.makeServer(); X.spec(S, 'SP-1', 'Hinges', 'Blum');
    for (const role of ['office', 'dash', 'prod', 'design']) {
      const t = await X.dev(browser, S, role);
      const r = await ev(t, () => { const out = {}; let n = 0; window.prompt = () => { n++; return null; };
        localStorage.setItem('wpfSignPin', '7777'); out.oldProdSignPin = specSignOk(); // what the 9 Nov version remembered for a Production Manager PIN
        localStorage.setItem('wpfSignPin', '8888'); out.oldDesignSignPin = specSignOk();
        localStorage.removeItem('wpfSignPin'); localStorage.setItem('wpfEditPin', '9000'); out.adminEditPin = specSignOk(); // old "edit" PIN, even the Admin one
        localStorage.removeItem('wpfEditPin'); out.n = n; return out; });
      rec('6a ' + role + ': an old remembered Production Manager / Drawing office sign PIN, or an old edit PIN, does not sign off', !r.oldProdSignPin && !r.oldDesignSignPin && !r.adminEditPin && r.n === 3, JSON.stringify(r));
      await t.close();
    }
    const of = await X.dev(browser, S, 'office');
    const r = await ev(of, () => { window.prompt = () => ' 9000 '; const a = specSignOk(); const rem = localStorage.getItem('wpfSignPin'); DB.pins = Object.assign({}, DB.pins, { admin: '4321' }); let n = 0; window.prompt = () => { n++; return null; }; const b = specSignOk(); return { a, rem, b, n }; });
    rec('6b office: the Admin PIN (with spaces) signs off; after the Admin PIN is changed in Settings the remembered one stops working', r.a && r.rem === '9000' && !r.b && r.n === 1, JSON.stringify(r));
    // who is recorded when the office signs off with the PM PIN?
    await ev(of, () => { localStorage.removeItem('wpfSignPin'); DB.pins = Object.assign({}, DB.pins, { admin: '' }); sessionStorage.setItem('wpfWho', 'Olive (office)'); window.prompt = m => /PIN/.test(m) ? '6666' : 'Olive (office)'; lsSpecDlg('P1'); }); await sleep(400);
    await ev(of, () => { const i = specItems('P1').findIndex(e => e.item === 'Hinges'); document.querySelector('[data-sps="' + i + '"]').click(); }); await sleep(400);
    const h = S.db.t.project_spec_items.find(x => x.id === 'SP-1');
    rec('6c office signs off with the PM PIN: the record should show a Project Manager, not the office person', h.status === 'signed-off' && !/Olive/.test(h.signed_by || ''), 'signed_by=' + h.signed_by);
    // the PM PIN is remembered: the next person on the office PC signs off with no PIN at all
    X.spec(S, 'SP-2', 'Handles', 'Bar'); await ev(of, async () => { await lsPoll(); }); await open(of);
    await ev(of, () => { sessionStorage.setItem('wpfWho', 'Temp (office)'); window.__n = 0; window.prompt = () => { window.__n++; return null; }; const i = specItems('P1').findIndex(e => e.item === 'Handles'); document.querySelector('[data-sps="' + i + '"]').click(); }); await sleep(400);
    const h2 = S.db.t.project_spec_items.find(x => x.id === 'SP-2');
    rec('6d after a PM typed the PIN once on the office PC, anyone there signs off later with no PIN (Garry: "Project Managers only")', !(h2.status === 'signed-off' && (await ev(of, () => window.__n)) === 0), 'Handles ' + h2.status + ' by ' + h2.signed_by + ', PIN prompts=' + (await ev(of, () => window.__n)));
    // straight to the database from an office screen (PINs are only on the screen)
    const d = await ev(of, async () => { const r = [...LST.ps.values()].find(x => x.item === 'Handles'); const res = await fetch(SUPA_URL + '/project_spec_items?id=eq.' + encodeURIComponent(r.id), { method: 'PATCH', headers: { ...SUPA_HDR, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'proposed' }) }); const r2 = [...LST.ps.values()].find(x => x.item === 'Hinges'); const res2 = await fetch(SUPA_URL + '/project_spec_items?id=eq.' + encodeURIComponent(r2.id), { method: 'PATCH', headers: { ...SUPA_HDR, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'proposed' }) }); return res.status + '/' + res2.status; });
    DP.update(S.db, S.db.t.project_spec_items.find(x => x.id === 'SP-1'), { status: 'signed-off', signed_by: 'Fake PM', updated_by: 'office PC' });
    rec('6e (info) a non-PM can sign off / un-sign by calling the database directly — PINs are screen-level only', true, 'PATCH ' + d + '; sign-off under any name: ' + S.db.t.project_spec_items.find(x => x.id === 'SP-1').signed_by);
    await of.close();
  }
  // ---------- 7. escaping in spec names (tabs, chip, prints, prompts)
  {
    const S = X.makeServer();
    const bad = '<img src=x onerror="window.__x=1"> O\'Grady "B" 🙂';
    const pm = await X.dev(browser, S, 'pm'); await open(pm);
    await ev(pm, () => { window.__x = 0; }); await addSpec(pm, bad, 'robes'); await sleep(600);
    const t = await ev(pm, () => ({ x: window.__x, tabs: [...document.querySelectorAll('[data-sptab]')].map(b => b.textContent.trim()), img: !!document.querySelector('.pod-ovl img') }));
    rec('7a spec name with HTML / quotes / emoji: shown as text on its tab, nothing runs', !t.x && !t.img && t.tabs.some(x => x.startsWith(bad)), JSON.stringify(t));
    const c = await ev(pm, () => { const d = document.createElement('div'); d.innerHTML = specChip('P1'); document.body.appendChild(d); const ch = d.querySelector('.spec-chip'); return { x: window.__x, img: !!d.querySelector('img'), title: ch ? ch.title.slice(-160) : '', txt: d.textContent.slice(0, 160) }; });
    rec('7b red chip (its full list on hover) with that spec name: text only', !c.x && !c.img && c.title.includes(bad + ': '), JSON.stringify(c));
    await X.catchPrint(pm.page); await ev(pm, () => specPrint('P1')); await sleep(100);
    const pr = (await X.printed(pm.page))[0] || '';
    rec('7c printed Project details: the name escaped', !/<img src=x/.test(pr) && /&lt;img src=x/.test(pr), (pr.match(/PROJECT DETAILS — [^<]*/g) || []).join(' | '));
    const rp = await ev(pm, () => { let p = ''; window.prompt = (m, d) => { p = d; return null; }; document.getElementById('sp-ren') && document.getElementById('sp-ren').click(); return p; });
    rec('7d rename prompt shows the name as typed (plain text)', rp === bad, JSON.stringify(rp));
    // Excel workbook upload / saw print with that spec open
    const saw = await X.dev(browser, S, 'saw'); await X.catchPrint(saw.page); await ev(saw, () => printWorkList('saw', 3)); await sleep(200);
    const sp = (await X.printed(saw.page))[0] || '';
    rec('7e printed saw sheet: banner and block escaped', !/<img src=x/.test(sp) && /&lt;img src=x/.test(sp), sp.length);
    // a spec name of only a zero-width space (the database accepts it — attack2-pg.sql 10)
    await addSpec(pm, '​', 'kitchens'); await sleep(400);
    rec('7f a spec "name" that is only an invisible character is refused', !S.db.t.project_specs.some(s => s.name === '​'), JSON.stringify(S.db.t.project_specs.map(s => s.name)));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close(); await saw.close();
  }
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
