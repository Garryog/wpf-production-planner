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
// round 4: retiring a spec with open items off the PM screen asks the PM / Admin PIN (then the PM's name)
const pmOK = t => ev(t, () => { const q = ['6666', 'Mary PM']; window.prompt = () => (q.length ? q.shift() : null); window.confirm = () => true; });
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
  // ---------- 3. retire races and retired specs (round 3: the database keeps one spec in use; "Bring back")
  {
    const S = X.makeServer();
    X.sheet(S, 'SPD:P1', 'Kitchens'); X.sheet(S, 'SR', 'Robes', 'robes');
    const a = await X.dev(browser, S, 'pm'), b = await X.dev(browser, S, 'office');
    await open(a); await open(b); await tab(a, 'Kitchens'); await tab(b, 'Robes');
    const go = hold(S);
    await pmOK(b); // (round 4 rule) the office answers the PM PIN + name
    await ev(a, () => document.getElementById('sp-ret').click()); await ev(b, () => document.getElementById('sp-ret').click()); await sleep(300); go(); await sleep(900);
    const act = S.db.t.project_specs.filter(s => s.active !== false).length, ma = await msg(a), mb = await msg(b);
    rec('3a two PCs each retire a different spec at once: one is refused and that person is told, one spec stays in use', act === 1 && (/at least one spec/.test(ma) || /at least one spec/.test(mb)), 'active=' + act + ' | ' + ma + ' | ' + mb);
    const saw = await X.dev(browser, S, 'saw');
    const r = await ev(saw, () => ({ open: specOpen('P1').length, chip: !!document.querySelector('.spec-chip'), btn: specBtn('P1').replace(/<[^>]+>/g, '') }));
    rec('3b ...and with nothing signed off the project is still RED on the saw', r.open === 21 && r.chip && !/0\/0/.test(r.btn), JSON.stringify(r));
    await saw.close();
    // the retired one is listed with "Bring back"; the refusal for its name points there
    await open(b);
    const v = await ev(b, () => ({ tabs: [...document.querySelectorAll('[data-sptab]')].map(x => x.textContent.trim()), back: [...document.querySelectorAll('[data-spback]')].map(x => x.closest('.lst-chip').textContent.trim()) }));
    rec('3c the retired spec is listed under "Not used any more" with Bring back; the other stays a tab', v.tabs.length === 1 && v.back.length === 1, JSON.stringify(v));
    const retName = S.db.t.project_specs.find(s => !s.active).name; await addSpec(b, retName.toUpperCase(), 'kitchens'); await sleep(300);
    rec('3d adding a spec with the retired one\'s name (other case) points to Bring back', /Bring back/.test(await msg(b)) && S.db.t.project_specs.length === 2, await msg(b));
    // Bring back on two PCs at once
    await open(a); await open(b);
    const go2 = hold(S);
    await ev(a, () => document.querySelector('[data-spback]').click()); await ev(b, () => document.querySelector('[data-spback]').click()); await sleep(300); go2(); await sleep(900);
    const mA = await msg(a), mB = await msg(b);
    rec('3e Bring back on two PCs at once: the spec is in use once, both screens show it as a tab', S.db.t.project_specs.every(s => s.active) && (await tabs(a)).length === 2 && (await tabs(b)).length === 2, JSON.stringify([await tabs(a), await tabs(b)]) + ' msgs: ' + mA + ' | ' + mB);
    rec('3f ...and the second person is not told an alarming "Not changed" for something that is now done', !/Not changed/.test(mA + mB), mA + ' | ' + mB);
    // retire, then a stale screen (it still shows the spec in use) brings back while another PC adds a new spec of the same name
    await open(a); await tab(a, 'Robes'); await ev(a, () => document.getElementById('sp-ret').click()); await sleep(500);
    await open(b); const go3 = hold(S);
    await ev(b, () => { const x = document.querySelector('[data-spback]'); if (x) x.click(); }); await addSpec(a, 'Robes', 'robes'); await sleep(300); go3(); await sleep(900);
    rec('3g Bring back vs a new spec of the same name at once: one "Robes", in use', S.db.t.project_specs.filter(s => /robes/i.test(s.name)).length === 1 && S.db.t.project_specs.find(s => s.id === 'SR').active === true, JSON.stringify(S.db.t.project_specs.map(s => s.name + ':' + s.active)) + ' ' + (await msg(a)));
    // the only spec in use can't be retired by a raw database call either
    let e1 = ''; try { DP.updateSpec(S.db, S.db.t.project_specs.find(s => s.id === 'SR'), { active: false }); DP.updateSpec(S.db, S.db.t.project_specs.find(s => s.id === 'SPD:P1'), { active: false }); } catch (x) { e1 = x.message; }
    rec('3h fake database: the last spec in use can\'t be retired', /at least one spec/.test(e1) && S.db.t.project_specs.some(s => s.active), e1);
    await a.close(); await b.close();
  }
  // ---------- 4. retire on one PC while another edits / signs off an item on that spec; rename vs edit; rename vs rename
  {
    const S = X.makeServer();
    X.sheet(S, 'SPD:P1', 'Kitchens'); X.sheet(S, 'SR', 'Robes', 'robes'); X.spec(S, 'R-H', 'Handles', 'Bar', { spec_id: 'SR' });
    const a = await X.dev(browser, S, 'office'), b = await X.dev(browser, S, 'pm');
    await open(a); await open(b); await tab(a, 'Robes'); await tab(b, 'Robes');
    await pmOK(a); // (round 4 rule) the office answers the PM PIN + name
    await ev(a, () => document.getElementById('sp-ret').click()); await sleep(500);
    await setVal(b, 'Hinges', 'Blum'); await sleep(500);
    const mb = await msg(b), onRet = S.db.t.project_spec_items.find(r => r.spec_id === 'SR' && r.item === 'Hinges');
    rec('4a an item saved on a spec that another PC has just retired: refused and the person told', !onRet && /not used any more/.test(mb), 'saved on the retired spec: ' + JSON.stringify(onRet && onRet.value) + ' msg=' + mb);
    await ev(b, () => { const on = document.querySelector('.spec-tab.on'); const i = specItems('P1', on && on.dataset.sptab).findIndex(e => e.item === 'Handles'); const s = document.querySelector('[data-sps="' + i + '"]'); if (s) s.click(); }); await sleep(500);
    const h = S.db.t.project_spec_items.find(r => r.id === 'R-H');
    const mb2 = await msg(b); rec('4b a sign-off on the spec retired on another screen: refused and told', h.status !== 'signed-off' && /not used any more/.test(mb2), 'Handles on retired Robes: ' + h.status + ' msg=' + mb2);
    rec('4b2 ...and the sheet refreshes (the retired spec is no longer a tab)', !(await tabs(b)).some(x => /^Robes/.test(x)), JSON.stringify(await tabs(b)));
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
    S2.db.t.project_specs.forEach(s => { s.active = false; }); // a state the database now refuses (attack2-pg 4): forced here to check the screen's fallback
    const sw = await X.dev(browser, S2, 'saw');
    const r2 = await ev(sw, () => ({ open: specOpen('P1').length, btn: specBtn('P1').replace(/<[^>]+>/g, '').trim() }));
    rec('5i a project whose only specs are all retired (nothing ever signed): still red, not "Details 0/0"', r2.open > 0 && !/0\/0/.test(r2.btn), JSON.stringify(r2));
    const o5 = await X.dev(browser, S2, 'office'); await open(o5); await setVal(o5, 'Hinges', 'Blum'); await sleep(500);
    const v5 = await ev(o5, () => ({ back: document.querySelectorAll('[data-spback]').length, msg: document.getElementById('sp-msg').textContent }));
    rec('5j (info, forced state the database now refuses) every spec retired: saving is refused and there is no Bring back — a dead end if it ever happened', true, JSON.stringify(v5));
    await o5.close();
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
    // round 3: off the PM screen the PM/Admin PIN is asked EVERY time and the Project Manager's own name is asked and recorded
    const of = await X.dev(browser, S, 'office');
    const r = await ev(of, () => { let n = 0; window.prompt = () => { n++; return ' 9000 '; }; const a = specSignOk(); const b = specSignOk(); DB.pins = Object.assign({}, DB.pins, { admin: '4321' }); window.prompt = () => { n++; return '9000'; }; const c = specSignOk(); DB.pins = Object.assign({}, DB.pins, { admin: '' }); return { a, b, c, n, rem: localStorage.getItem('wpfSignPin') }; });
    rec('6b office: the Admin PIN (with spaces) signs off, asked every time (never remembered); an old Admin PIN refused after a change', r.a && r.b && !r.c && r.n === 3 && !r.rem, JSON.stringify(r));
    const sign = (t, item, answers) => ev(t, ([item, ans]) => { window.__pp = []; window.prompt = m => { window.__pp.push(m.split('\n')[0]); return ans.length ? ans.shift() : null; }; window.confirm = () => true;
      const i = specItems('P1').findIndex(e => e.item === item); const b = document.querySelector('[data-sps="' + i + '"]'); if (b) b.click(); return !!b; }, [item, answers]);
    await ev(of, () => { sessionStorage.setItem('wpfWho', 'Olive (office)'); }); await open(of);
    await sign(of, 'Hinges', ['6666', 'Mary PM']); await sleep(400);
    const h = S.db.t.project_spec_items.find(x => x.id === 'SP-1'), pp = await ev(of, () => window.__pp);
    rec('6c office signs off with the PM PIN: the Project Manager\'s own name is asked and recorded', h.status === 'signed-off' && h.signed_by === 'Mary PM' && pp.length === 2 && /Project Manager/.test(pp[1]), 'signed_by=' + h.signed_by + ' prompts=' + JSON.stringify(pp));
    X.spec(S, 'SP-2', 'Handles', 'Bar'); X.spec(S, 'SP-3', 'Cornice', 'None'); X.spec(S, 'SP-4', 'Kicker type', 'PVC'); X.spec(S, 'SP-5', 'Sink Type', 'Belfast'); X.spec(S, 'SP-6', 'Tap Type', 'Mixer');
    await ev(of, async () => { await lsPoll(); }); await open(of);
    await sign(of, 'Handles', []); await sleep(400);
    rec('6d the next sign-off on the office PC asks the PIN again (Cancel = not signed)', S.db.t.project_spec_items.find(x => x.id === 'SP-2').status !== 'signed-off' && (await ev(of, () => window.__pp.length)) === 1, JSON.stringify(await ev(of, () => window.__pp)));
    await open(of); await sign(of, 'Handles', ['6666']); await sleep(400);
    rec('6d2 right PIN, name prompt cancelled: not signed off', S.db.t.project_spec_items.find(x => x.id === 'SP-2').status !== 'signed-off', JSON.stringify(await ev(of, () => window.__pp)));
    await open(of); await sign(of, 'Handles', ['6666', '   ', '\u200B', null]); await sleep(400);
    const h2 = S.db.t.project_spec_items.find(x => x.id === 'SP-2');
    rec('6d3 blank name then an invisible-character "name": neither is recorded as a signer', h2.status !== 'signed-off' || !/^[\s\u200B]*$/.test(h2.signed_by), 'status=' + h2.status + ' by=' + JSON.stringify(h2.signed_by) + ' prompts=' + JSON.stringify(await ev(of, () => window.__pp)));
    await open(of); await sign(of, 'Cornice', ['1234']); await sleep(400);
    rec('6d4 wrong PIN: no name asked, not signed', S.db.t.project_spec_items.find(x => x.id === 'SP-3').status !== 'signed-off' && (await ev(of, () => window.__pp.length)) === 1);
    for (const role of ['dash', 'prod', 'design']) {
      const t = await X.dev(browser, S, role); await open(t);
      await sign(t, role === 'dash' ? 'Kicker type' : role === 'prod' ? 'Sink Type' : 'Cornice', ['6666', 'PM ' + role]); await sleep(400);
      const it = S.db.t.project_spec_items.find(x => x.id === (role === 'dash' ? 'SP-4' : role === 'prod' ? 'SP-5' : 'SP-3'));
      rec('6e ' + role + ': PIN then the PM\'s name, recorded', it.status === 'signed-off' && it.signed_by === 'PM ' + role, it.status + ' by ' + it.signed_by + ' ' + JSON.stringify(await ev(t, () => window.__pp)));
      await t.close();
    }
    // the PM screen itself: no PIN, no name prompt (the signed-in name)
    const pmt = await X.dev(browser, S, 'pm'); await ev(pmt, () => sessionStorage.setItem('wpfWho', 'Mary PM')); await open(pmt);
    await sign(pmt, 'Tap Type', []); await sleep(400);
    rec('6f PM screen: signs off with no prompts, under the signed-in name', S.db.t.project_spec_items.find(x => x.id === 'SP-6').signed_by === 'Mary PM' && (await ev(pmt, () => window.__pp.length)) === 0, JSON.stringify(S.db.t.project_spec_items.find(x => x.id === 'SP-6')));
    await pmt.close();
    // straight to the database from an office screen (PINs are only on the screen)
    const d = await ev(of, async () => { const r = [...LST.ps.values()].find(x => x.item === 'Handles'); const res = await fetch(SUPA_URL + '/project_spec_items?id=eq.' + encodeURIComponent(r.id), { method: 'PATCH', headers: { ...SUPA_HDR, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'proposed' }) }); const r2 = [...LST.ps.values()].find(x => x.item === 'Hinges'); const res2 = await fetch(SUPA_URL + '/project_spec_items?id=eq.' + encodeURIComponent(r2.id), { method: 'PATCH', headers: { ...SUPA_HDR, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'proposed' }) }); return res.status + '/' + res2.status; });
    DP.update(S.db, S.db.t.project_spec_items.find(x => x.id === 'SP-1'), { status: 'signed-off', signed_by: 'Fake PM', updated_by: 'office PC' });
    rec('6g (info) a non-PM can sign off / un-sign by calling the database directly — PINs are screen-level only', true, 'PATCH ' + d + '; sign-off under any name: ' + S.db.t.project_spec_items.find(x => x.id === 'SP-1').signed_by);
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
  // ---------- 8. round 4: retiring a spec with open items needs a Project Manager; history of the specs themselves
  {
    const S = X.makeServer();
    X.sheet(S, 'SPD:P1', 'Kitchens');
    const mk = (id, name) => X.sheet(S, id, name, 'robes');
    const retire = (t, sid, answers) => ev(t, async ([sid, ans]) => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsSpecDlg('P1', sid); await new Promise(r => setTimeout(r, 300));
      window.__pp = []; window.prompt = m => { window.__pp.push(m.split('\n')[0]); return ans.length ? ans.shift() : null; }; window.confirm = () => true;
      document.getElementById('sp-ret').click(); await new Promise(r => setTimeout(r, 400)); return { pp: window.__pp, msg: document.getElementById('sp-msg').textContent }; }, [sid, answers]);
    const act = id => S.db.t.project_specs.find(x => x.id === id).active;
    let k = 0;
    for (const role of ['office', 'dash', 'prod', 'design']) {
      const t = await X.dev(browser, S, role); await ev(t, () => sessionStorage.setItem('wpfWho', 'Olive (office)'));
      const ids = ['c', 'w', 'r', 'n'].map(x => { const id = 'R' + (++k) + x; mk(id, 'Robes ' + id); return id; }); await ev(t, async () => { await lsPoll(); });
      const c = await retire(t, ids[0], []), w = await retire(t, ids[1], ['1234']), r = await retire(t, ids[2], ['6666', 'Mary PM']), n = await retire(t, ids[3], ['6666']);
      rec('8a ' + role + ': open items — PIN cancelled / wrong PIN: not retired, no name asked', act(ids[0]) && act(ids[1]) && c.pp.length === 1 && w.pp.length === 1, JSON.stringify([c.pp, w.pp]));
      rec('8b ' + role + ': right PM PIN → retired; the PM\'s name is asked', act(ids[2]) === false && r.pp.length === 2 && /name/i.test(r.pp[1] || ''), JSON.stringify(r.pp));
      const ev1 = S.db.t.project_events.find(e => e.entity === 'spec-sheet' && e.entity_id === ids[2] && e.act === 'retire');
      rec('8c ' + role + ': the history of that retire names the Project Manager, not the person at the screen', ev1 && /Mary PM/.test(ev1.by), JSON.stringify(ev1 && ev1.by));
      rec('8d ' + role + ': right PIN but the PM\'s name cancelled: not retired', act(ids[3]) !== false, JSON.stringify(n.pp));
      await t.close();
    }
    // saw etc.: no Not-used button at all (read-only)
    const sw = await X.dev(browser, S, 'saw'); await ev(sw, () => lsSpecDlg('P1')); await sleep(300);
    rec('8e saw: no "Not used any more" / Bring back / Rename', await ev(sw, () => !document.getElementById('sp-ret') && !document.getElementById('sp-ren') && !document.querySelector('[data-spback]')));
    await sw.close();
    // PM screen: no prompt
    const pm = await X.dev(browser, S, 'pm'); mk('RPM', 'Robes PM'); await ev(pm, async () => { await lsPoll(); });
    const p1 = await retire(pm, 'RPM', []);
    rec('8f PM screen: retires a spec with open items with no PIN', act('RPM') === false && !p1.pp.length, JSON.stringify(p1));
    await pm.close();
    // a fully signed-off spec: the office retires it with no PIN
    const of = await X.dev(browser, S, 'office'); mk('RS', 'Robes signed');
    const items = await ev(of, async () => { await lsPoll(); return specItems('P1', 'RS').map(e => e.item); }); signAll(S, 'RS', items);
    await ev(of, async () => { await lsPoll(); });
    const f1 = await retire(of, 'RS', []);
    rec('8g office: a fully signed-off spec is retired with no PIN', act('RS') === false && !f1.pp.length, JSON.stringify(f1));
    // stale screen: the office sees RS2 all signed, another PC un-signs an item, then the office retires it with no PIN
    mk('RS2', 'Robes stale'); signAll(S, 'RS2', items); await ev(of, async () => { await lsPoll(); });
    DP.update(S.db, S.db.t.project_spec_items.find(x => x.spec_id === 'RS2' && x.item === 'Hinges'), { status: 'proposed', updated_by: 'PC2' });
    const f2 = await ev(of, async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); window.__pp = []; window.prompt = m => { window.__pp.push(m); return null; }; window.confirm = () => true;
      const save = lsPoll; window.lsPoll = async () => {}; lsSpecDlg('P1', 'RS2'); window.lsPoll = save; /* sheet drawn from this screen's copy */ await new Promise(r => setTimeout(r, 0)); document.getElementById('sp-ret').click(); await new Promise(r => setTimeout(r, 400)); return window.__pp.length; });
    rec('8h stale screen: a spec un-signed on another PC a moment ago is not retired without a PM', act('RS2') !== false || f2 > 0, 'retired=' + !act('RS2') + ' prompts=' + f2);
    // Bring back by a non-PM: allowed, no PIN; rename: no PIN
    const b1 = await ev(of, async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsSpecDlg('P1'); await new Promise(r => setTimeout(r, 300)); window.__pp = []; window.prompt = m => { window.__pp.push(m); return null; };
      const b = document.querySelector('[data-spback="RPM"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 400)); return { btn: !!b, pp: window.__pp.length }; });
    rec('8i office: Bring back with no PIN', b1.btn && act('RPM') === true && b1.pp === 0, JSON.stringify(b1));
    const r1 = await ev(of, async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsSpecDlg('P1', 'RPM'); await new Promise(r => setTimeout(r, 300)); window.__pp = []; window.prompt = m => { window.__pp.push(m); return 'Robes Block <b>X</b>'; };
      document.getElementById('sp-ren').click(); await new Promise(r => setTimeout(r, 400)); return window.__pp.length; });
    rec('8j office: Rename with no PIN (only the name asked)', S.db.t.project_specs.find(x => x.id === 'RPM').name === 'Robes Block <b>X</b>' && r1 === 1, 'prompts=' + r1);
    // history rows for the spec itself
    const H8 = S.db.t.project_events.filter(e => e.entity === 'spec-sheet' && e.entity_id === 'RPM').map(e => e.act + ':' + (e.old && e.old.name || '') + '→' + e.new.name + ':' + e.by);
    rec('8k history of a spec: add, retire, bring back, rename (old → new name), each with who', H8.length === 4 && /^add:/.test(H8[0]) && /^retire:/.test(H8[1]) && /^bring-back:/.test(H8[2]) && /^rename:Robes PM→Robes Block <b>X<\/b>:/.test(H8[3]), JSON.stringify(H8));
    const shown = await ev(of, async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsSpecDlg('P1', 'RPM'); await new Promise(r => setTimeout(r, 300)); return /retire|brought back|renamed|Not used any more by|added by/i.test(document.querySelector('.pod-ovl:last-of-type').innerText) && !document.querySelector('.pod-ovl:last-of-type b b'); });
    rec('8l (info) the spec history (who retired / renamed) is shown somewhere in the window', true, 'shown=' + shown);
    const w = await ev(of, async () => { const h = { ...SUPA_HDR, 'Content-Type': 'application/json' }; const a = await fetch(SUPA_URL + '/project_events', { method: 'POST', headers: h, body: JSON.stringify({ project_id: 'P1', entity: 'spec-sheet', entity_id: 'RPM', act: 'retire', by: 'evil' }) }); const d = await fetch(SUPA_URL + '/project_events?entity_id=eq.RPM', { method: 'DELETE', headers: h }); const u = await fetch(SUPA_URL + '/project_events?entity_id=eq.RPM', { method: 'PATCH', headers: h, body: '{"by":"evil"}' }); return [a.status, d.status, u.status]; });
    rec('8m the app can\'t write, change or delete the history (fake database)', w.every(x => x >= 400) && !S.db.t.project_events.some(e => e.by === 'evil'), JSON.stringify(w));
    rec('no page errors (8)', !(S.errors || []).length, JSON.stringify(S.errors));
    await of.close();
  }
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
