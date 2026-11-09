// Tester attack 1 (Project details): spec sheet races, TBC/blank rules, roles/PINs, switch off, escaping, typing vs redraw.
// Fake Supabase only. Run: node tests/project-details/attack1-spec.test.js
const X = require('./fixp.js');
const { H, DP, rec, sleep } = X;
const ev = (t, fn, a) => t.page.evaluate(fn, a);
const row = (S, item) => S.db.t.project_spec_items.find(r => r.item.toLowerCase() === item.toLowerCase());
const idx = (t, item) => ev(t, it => specItems('P1').findIndex(e => e.item === it), item);
async function setVal(t, item, v) { const i = await idx(t, item); await ev(t, ([i, v]) => { const s = document.querySelector('[data-spv="' + i + '"]'); s.value = v; s.onchange(); }, [i, v]); await sleep(400); }
async function openSheet(t) { await ev(t, () => lsSpecDlg('P1')); await sleep(400); }
(async () => {
  const browser = await H.chromium.launch();
  // ---- TBC / blank rules on the screen and in the fake database
  {
    const S = X.makeServer();
    const pm = await X.dev(browser, S, 'pm'); await openSheet(pm);
    for (const [v, want] of [[' TBC ', 'not-specified'], ['tbc', 'not-specified'], ['   ', null], ['Tbc', 'not-specified'], ['T.B.C.', 'not-specified'], ['TBA', 'not-specified'], ['To be confirmed', 'not-specified']]) {
      await setVal(pm, 'Hinges', v); const r = row(S, 'Hinges');
      rec('typed ' + JSON.stringify(v) + ' → ' + (want || 'no row / not specified'), want ? r && r.status === want : (!r || r.status === 'not-specified'), JSON.stringify(r && { v: r.value, s: r.status }));
    }
    // database refuses sign-off of TBC / blank whatever the screen sends
    const h = row(S, 'Hinges'); DP.update(S.db, h, { value: 'Blum', updated_by: 'x' });
    let err = ''; try { DP.update(S.db, row(S, 'Hinges'), { value: ' tbc ', status: 'signed-off', signed_by: 'x' }); } catch (e) { err = e.message; }
    rec('fake db: sign-off with " tbc " lands as not specified, never signed', row(S, 'Hinges').status === 'not-specified', err + ' ' + row(S, 'Hinges').status);
    // Other Information: never in the chip / count, even when "TBC"
    await setVal(pm, 'Other Information', 'TBC');
    const oi = await ev(pm, () => ({ open: specOpen('P1').some(x => /other/i.test(x)), n: specCount('P1').n }));
    rec('Other Information (TBC) not in the chip, not counted', !oi.open && oi.n === 21, JSON.stringify(oi));
    // sign-off race: PM has Hinges=Blum (proposed) on screen; another PC changes it to TBC; PM clicks Sign off
    await setVal(pm, 'Hinges', 'Grass'); DP.update(S.db, row(S, 'Hinges'), { value: 'TBC', updated_by: 'PC2' });
    const i = await idx(pm, 'Hinges');
    await ev(pm, i => { sessionStorage.setItem('wpfWho', 'Mary'); const b = document.querySelector('[data-sps="' + i + '"]'); if (b) b.click(); }, i); await sleep(500);
    rec('stale Sign off after another PC set TBC: refused, row stays not specified', row(S, 'Hinges').status === 'not-specified', JSON.stringify(row(S, 'Hinges')) + ' msg=' + await ev(pm, () => document.getElementById('sp-msg').textContent));
    // signed-off → change only the letter case → sign-off taken away (and confirm asked)
    await setVal(pm, 'Handles', 'Bar Handle'); const hi = await idx(pm, 'Handles');
    await ev(pm, i => document.querySelector('[data-sps="' + i + '"]').click(), hi); await sleep(400);
    await ev(pm, () => { window.__asked = 0; window.confirm = () => { window.__asked++; return true; }; });
    await setVal(pm, 'Handles', 'bar handle');
    const hr = row(S, 'Handles');
    rec('changing a signed-off value (case only) asks and drops it to Proposed', hr.status === 'proposed' && hr.signed_by == null && (await ev(pm, () => window.__asked)) === 1, JSON.stringify({ s: hr.status, by: hr.signed_by }));
    // two PCs sign off the same item at once: one wins, no double event, signer not renamed
    await ev(pm, i => document.querySelector('[data-sps="' + i + '"]').click(), hi); await sleep(400);
    const pm2 = await X.dev(browser, S, 'design'); await openSheet(pm2);
    const by0 = row(S, 'Handles').signed_by;
    await ev(pm2, i => { const b = document.querySelector('[data-spu="' + i + '"]'); if (b) b.click(); }, hi); await sleep(300);
    rec('a second screen can un-sign (design) — sign-off taken away, logged', row(S, 'Handles').status === 'proposed' && S.db.t.project_events.some(e => e.act === 'unsign'), by0 + ' ' + row(S, 'Handles').status);
    await pm2.close();
    // material item: a material renamed after sign-off
    await setVal(pm, 'Carcass Material', 'MFC White'); const ci = await idx(pm, 'Carcass Material');
    await ev(pm, i => document.querySelector('[data-sps="' + i + '"]').click(), ci); await sleep(400);
    const m1 = S.db.t.project_materials.find(m => m.id === 'M1'); X.D.update(S.db, 'project_materials', m1, { name: 'MFC White 18mm Egger W980' });
    await ev(pm, async () => { await lsPoll(); }); await sleep(200);
    const cm = await ev(pm, () => { const e = specItems('P1').find(x => x.item === 'Carcass Material'); return { v: e.row.value, st: e.row.status }; });
    rec('material renamed after sign-off: the signed-off spec still names the OLD material (info)', true, JSON.stringify(cm));
    await openSheet(pm);
    const warn = await ev(pm, () => /not on the project's materials/.test(document.getElementById('sp-body').innerHTML));
    rec('...and the sheet shows a signed-off Carcass Material as "not on the project\'s materials" after a rename', !warn, 'warn=' + warn + ' ' + JSON.stringify(cm));
    rec('no page errors (TBC part)', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }
  // ---- typing in one box while another box's save is still in flight
  {
    const S = X.makeServer();
    const pm = await X.dev(browser, S, 'pm'); await openSheet(pm);
    let rel; S.holdP = new Promise(r => { rel = r; });
    const a = await idx(pm, 'Hinges'), b = await idx(pm, 'Handles');
    await ev(pm, ([a, b]) => { const s = document.querySelector('[data-spv="' + a + '"]'); s.value = 'Blum'; s.onchange(); const t = document.querySelector('[data-spv="' + b + '"]'); t.focus(); t.value = 'Typed but not yet left'; }, [a, b]);
    await sleep(200); S.holdP = null; rel(); await sleep(600);
    const st = await ev(pm, b => { const t = document.querySelector('[data-spv="' + b + '"]'); return { v: t && t.value, focus: document.activeElement === t }; }, b);
    rec('slow save of one box does not wipe what is being typed in the next box', st.v === 'Typed but not yet left', JSON.stringify(st));
    // offline save → user is told, value not shown as saved
    S.offlineP = true; await setVal(pm, 'Hinges', 'Grass'); S.offlineP = false;
    const m = await ev(pm, () => document.getElementById('sp-msg').textContent);
    rec('offline spec save: told "Not saved"', /Not saved/.test(m) && row(S, 'Hinges').value === 'Blum', m);
    // a reply lost (saved, no answer): next try must not create a duplicate / should recover
    S.dropReplyP = 1; await setVal(pm, 'Kicker Height', '150mm'); await sleep(300);
    const kh = S.db.t.project_spec_items.filter(r => r.item === 'Kicker Height');
    const m2 = await ev(pm, () => document.getElementById('sp-msg').textContent);
    await setVal(pm, 'Kicker Height', '120mm');
    const kh2 = S.db.t.project_spec_items.filter(r => r.item === 'Kicker Height');
    rec('lost reply on a new item: retrying still works (one row, new value)', kh2.length === 1 && kh2[0].value === '120mm', JSON.stringify(kh2.map(r => r.value)) + ' msg1=' + m2 + ' msg2=' + await ev(pm, () => document.getElementById('sp-msg').textContent));
    await pm.close();
  }
  // ---- roles and PINs
  {
    const S = X.makeServer(); X.spec(S, 'SP-1', 'Hinges', 'Blum');
    for (const role of ['saw', 'stores', 'driver', 'floor']) {
      const t = await X.dev(browser, S, role);
      const r = await ev(t, () => ({ edit: specEditOk(), sign: specSignOk() }));
      rec(role + ': spec read-only', !r.edit && !r.sign, JSON.stringify(r)); await t.close();
    }
    const of = await X.dev(browser, S, 'office');
    const r1 = await ev(of, () => { localStorage.removeItem('wpfEditPin'); let n = 0; window.prompt = () => { n++; return '0000'; }; const e = specEditOk(); const s = specSignOk(); return { e, s, n }; });
    rec('office: edits without PIN, sign-off with a wrong PIN refused', r1.e && !r1.s && r1.n === 1, JSON.stringify(r1));
    const r2 = await ev(of, () => { localStorage.removeItem('wpfEditPin'); window.prompt = () => '6666'; return specSignOk(); });
    rec('office: a Project Manager PIN (6666) lets the office sign off (plan Q1: PM sign-off PIN)', r2 === true, 'accepted=' + r2);
    const r3 = await ev(of, () => { localStorage.removeItem('wpfEditPin'); window.prompt = () => '8888'; const a = specSignOk(); window.prompt = () => { throw new Error('asked again'); }; let b; try { b = specSignOk(); } catch (e) { b = e.message; } return { a, b }; });
    rec('office: a Drawing office PIN works, and is then remembered on the PC (info: anyone on that PC signs off afterwards)', r3.a === true, JSON.stringify(r3));
    await of.close();
    const dash = await X.dev(browser, S, 'dash');
    const r4 = await ev(dash, () => { localStorage.removeItem('wpfEditPin'); let n = 0; window.prompt = () => { n++; return null; }; return { e: specEditOk(), s: specSignOk(), n }; });
    rec('dash: edit and sign-off both need a PIN', !r4.e && !r4.s && r4.n === 2, JSON.stringify(r4));
    await dash.close();
  }
  // ---- lists switch OFF: nothing new visible, no calls to project_spec_items
  {
    const S = X.makeServer(X.v1Row());
    const of = await X.dev(browser, S, 'office');
    await ev(of, () => { showTab('l'); }); await sleep(400);
    await ev(of, () => { pmTab = 'projects'; });
    const pm = await X.dev(browser, S, 'pm'); await sleep(300);
    const r = await ev(of, () => ({ spec: !!document.querySelector('.spec-chip,.spec-btn,#lh-spec,#lh-projs,#me-spec'), v2: V2(), st: SPECP.st, woe: !!document.querySelector('[data-woe]') }));
    const p = await ev(pm, () => ({ txt: document.body.innerText, tabs: [...document.querySelectorAll('button')].map(b => b.textContent).filter(t => /Projects/.test(t)) }));
    rec('switch OFF: no spec buttons/chips, no Projects buttons on office', !r.spec && !r.v2, JSON.stringify(r));
    rec('switch OFF: PM view has no 🏗 Projects tab', !p.tabs.length, JSON.stringify(p.tabs));
    rec('switch OFF: no calls to project_spec_items', !S.log.some(x => /project_spec_items|project_events/.test(x)), S.log.filter(x => /project_spec/.test(x)).join(','));
    await of.close(); await pm.close();
  }
  // ---- escaping: item names / values with HTML in the sheet, chip, PM tab, print and history
  {
    const S = X.makeServer();
    const bad = '<img src=x onerror="window.__x=(window.__x||0)+1">O\'Grady "q" 🙂';
    X.spec(S, 'SP-B1', bad, 'TBC', { is_extra: true, sort: 1000 });
    X.spec(S, 'SP-B2', 'Hinges', '<script>window.__x=99</script>' + bad);
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { name: 'Aderrig <b>Ph2</b> O\'Grady' });
    const pm = await X.dev(browser, S, 'pm');
    await ev(pm, () => { pmTab = 'projects'; render(); }); await sleep(300);
    await openSheet(pm); await sleep(200);
    const i = await idx(pm, bad);
    await ev(pm, i => { const b = document.querySelector('[data-sph="' + i + '"]'); if (b) b.click(); }, i); await sleep(400);
    const r = await ev(pm, () => ({ x: window.__x || 0, chip: (document.querySelector('.spec-chip') || {}).textContent || '', body: document.getElementById('sp-body').innerText.includes("O'Grady \"q\"") }));
    rec('PM tab + sheet + history: HTML in item/value/project shown as text, never run', !r.x && r.body, JSON.stringify(r));
    await X.catchPrint(pm.page); await ev(pm, () => specPrint('P1')); await sleep(300);
    const pr = (await X.printed(pm.page))[0] || '';
    rec('printed Project details: escaped', !/<img src=x/.test(pr) && !/<script>window.__x/.test(pr) && /&lt;img/.test(pr), pr.slice(0, 200));
    const saw = await X.dev(browser, S, 'saw'); await X.catchPrint(saw.page);
    await ev(saw, () => printWorkList('saw', 3)); await sleep(300);
    const p2 = (await X.printed(saw.page))[0] || '';
    rec('printed saw sheet spec block: escaped', !/<img src=x/.test(p2) && !/<script>window.__x/.test(p2), (p2.match(/PROJECT DETAILS[^<]*/) || [''])[0]);
    rec('saw: nothing ran', !(await ev(saw, () => window.__x || 0)));
    rec('no page errors (escape part)', !(S.errors || []).length, JSON.stringify(S.errors));
    await saw.close(); await pm.close();
  }
  await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
