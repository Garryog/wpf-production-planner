// Tester attack 1 on the cutting-list flow (browser): confirm racing other ways a WO gets a list, two PCs clearing the
// same WO, saw red/amber rules, due-date maths over a bank holiday and with no procAt, 360 px with long names.
// Fake Supabase only (srv3.js). Run: node tests/stage3/flow-attack1-confirm.test.js
const F = require('./fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 500))); };
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2';
function server(extra, opt) {
  opt = opt || {};
  const o = (wo, title, x) => H.order(Object.assign({ wo, title, customer: CH, step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [
    o('WO-1', 'HOUSE 14 - TYPE B KITCHEN', { unit: '14' }), o('WO-2', 'HOUSE 15 TYPE B KITCHEN', { unit: '15' }),
    o('WO-4', 'HOUSE 40 TYPE D KITCHEN', { unit: '40' }), o('WO-6', 'HOUSE 16 TYPE B KITCHEN', { unit: '16' }),
  ].concat((extra || []).map(x => o(x.wo, x.title || 'HOUSE TYPE B KITCHEN', x)));
  const S = F.makeServer(row);
  D.insert(S.db, 'projects', { id: 'P1', name: opt.pname || 'Cherrywood Phase 2', customer: 'Cairn Homes' });
  D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' });
  F.seedList(S, 'T1', { name: opt.tname || 'Type B kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: opt.tname || 'Type B 3-bed' } });
  return S;
}
const made = (S, wo) => S.db.t.lists.filter(l => (l.wos || []).includes(wo) && !l.is_template && !l.archived);
(async () => {
  const browser = await H.chromium.launch();
  // ---- 1. a WO given a list another way on another PC (template dialog / typed list) and then ✓ Confirmed on a PC
  //         that hasn't polled yet → must not make a SECOND live list for the same WO (the saw would cut it twice)
  {
    const S = server();
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    await a.page.evaluate(() => lsCreateFromTpl('T1', ['WO-1'], '14', 'Ann'));
    const rb = await b.page.evaluate(() => confirmList('WO-1', 'T1', 'Bob').then(l => ({ id: l.id, al: !!l.already })).catch(e => ({ err: e.message })));
    rec('WO already given a list on another PC (template dialog), then ✓ Confirm on a PC that has not refreshed: still ONE live list for WO-1', made(S, 'WO-1').length === 1, JSON.stringify({ rb, lists: made(S, 'WO-1').map(l => l.id) }));
    // ---- 2. Excel workbook uploaded after the WO's list was confirmed: auto-tag puts a second list on the same WO
    await a.page.evaluate(() => confirmList('WO-2', 'T1', 'Ann'));
    await a.page.evaluate(() => lsImportWB({ project: '', sheets: {} }, [{ sheet: 'House 15', lines: [{ kind: 'saw', part: 'Side', qty: '2', length_mm: 720, width_mm: 560, material: 'MFC White' }] }], 'Cherrywood.xlsx', 'Ann', { pid: 'P1' }));
    rec('Excel upload with a "House 15" sheet after WO-2\'s list was confirmed: WO-2 does not get a second live list (auto-tag)', made(S, 'WO-2').length === 1, JSON.stringify(made(S, 'WO-2').map(l => l.id + ':' + l.name)));
    rec('no page errors (1-2)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  // ---- 3. o.listNA: two PCs clear the same WO differently / a stale PC saves another edit to the WO
  {
    const S = server();
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    await a.page.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-ltina="WO-4|none"]').click(); await saveDB(); });
    await b.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-4'); o.notes = 'Site says hold the doors'; await saveDB(); });
    const o4 = S.row.orders.find(x => x.wo === 'WO-4');
    rec('PC A "No list needed" on WO-4; PC B (not refreshed) edits WO-4 notes and saves → both kept', o4.listNA && o4.listNA.k === 'none' && o4.notes === 'Site says hold the doors', JSON.stringify({ na: o4.listNA, n: o4.notes }));
    await a.page.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-ltina="WO-6|none"]').click(); await saveDB(); });
    await b.page.evaluate(async () => { setWho('Bob'); showTab('l'); await new Promise(r => setTimeout(r, 100)); const btn = document.querySelector('[data-ltina="WO-6|none"]'); if (btn) btn.click(); await saveDB(); });
    const o6 = S.row.orders.find(x => x.wo === 'WO-6'), na = o6.listNA || {};
    rec('A and B (not refreshed) both "No list needed" on WO-6 at once ("Paper list issued" removed, Garry 4 Nov) → one consistent record', na.k === 'none' && (na.by === 'Ann' || na.by === 'Bob'), JSON.stringify(na));
    // Undo on A while B (stale) still shows WO-6 cleared and saves something else
    await a.page.evaluate(async () => { await loadDB(); showTab('l'); LTI.showNA = true; render(); await new Promise(r => setTimeout(r, 100)); const u = document.querySelector('[data-ltiundo="WO-6"]'); if (u) u.click(); await saveDB(); });
    await b.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-6'); o.notes = 'later'; await saveDB(); });
    rec('Undo on A survives a stale save from B (WO-6 back in the panel)', !S.row.orders.find(x => x.wo === 'WO-6').listNA, JSON.stringify(S.row.orders.find(x => x.wo === 'WO-6').listNA));
    rec('no page errors (3)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  // ---- 4. saw red / amber, due-date maths
  {
    const S = server([
      { wo: 'D-VANDAY', delv: true, delVeh: 'VOLVO', delDay: 'Thu' },
      { wo: 'D-POOL', delv: true },
      { wo: 'D-VANONLY', delv: true, delVeh: 'VOLVO' },
      { wo: 'D-STEP4', step: '4. READY FOR PRODUCTION', delv: true, delVeh: 'VOLVO', delDay: 'Fri', procAt: undefined },
      { wo: 'D-PAPER', delv: true, delVeh: 'VOLVO', delDay: 'Thu', listNA: { k: 'paper', by: 'Ann', at: '2026-10-20T09:00:00Z' } },
      { wo: 'D-HOLD', delv: true, delVeh: 'VOLVO', delDay: 'Thu', cienHold: true },
      { wo: 'BH-1', procAt: '2026-10-22' },             // Thu + 2 working days, Mon 26 Oct is a bank holiday → Tue 27
      { wo: 'BH-SAT', procAt: '2026-10-24' },           // processed on a Saturday → Tue 27 is day 1, Wed 28 day 2
      { wo: 'NP-1', procAt: '', dueDate: '2026-10-28', origDueDate: '2026-10-28' }, // no procAt: cut-by Tue 27 → list due the working day before = Fri 23
      { wo: 'NP-2', procAt: '', dueDate: '', origDueDate: '' },
    ]);
    S.row.orders.forEach(o => { if (o.procAt === undefined || o.procAt === '') delete o.procAt; });
    const saw = await F.dev(browser, S, 'saw');
    const w = await saw.page.evaluate(() => { const g = id => document.getElementById(id); sawWaitOpen = true; render(); return { red: g('wait-red') ? [...g('wait-red').querySelectorAll('[data-waitwo]')].map(r => r.dataset.waitwo) : [], amb: g('wait-amber') ? [...g('wait-amber').querySelectorAll('[data-waitwo]')].map(r => r.dataset.waitwo) : [] }; });
    rec('RED only for WOs with a van AND a day (D-VANDAY, D-STEP4; an old "Paper list issued" mark D-PAPER needs a list again, Garry 4 Nov)', w.red.sort().join() === 'D-PAPER,D-STEP4,D-VANDAY', JSON.stringify(w));
    rec('pool / van-without-day only AMBER', w.amb.includes('D-POOL') && w.amb.includes('D-VANONLY') && !w.red.includes('D-POOL') && !w.red.includes('D-VANONLY'), JSON.stringify(w));
    rec('on-hold jobs on a van are not shown at all', !w.red.concat(w.amb).some(x => /D-HOLD/.test(x)), JSON.stringify(w));
    const due = await saw.page.evaluate(() => Object.fromEntries(['BH-1', 'BH-SAT', 'NP-1', 'NP-2'].map(wo => { const n = lsNeedInfo(DB.orders.find(o => o.wo === wo), '2026-10-21'); return [wo, n.due + (n.late ? ':late' : '')]; })));
    rec('due: processed Thu 22 Oct, 2 working days over the October bank holiday → Tue 27 Oct', due['BH-1'] === '2026-10-27', JSON.stringify(due));
    rec('due: processed on Saturday 24 Oct → Wed 28 Oct', due['BH-SAT'] === '2026-10-28', JSON.stringify(due));
    rec('due: no procAt, delivery Wed 28 → cut-by Tue 27 → list due Fri 23 (the working day before, over the bank holiday)', due['NP-1'] === '2026-10-23', JSON.stringify(due));
    rec('due: no procAt and no due date → no due date, not late, no crash', due['NP-2'] === '', JSON.stringify(due));
    rec('no page errors (4)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await saw.close();
  }
  // ---- 5. many rows: "Confirm all green" button count = rows the person can see? 60 green rows, 40 shown
  {
    const extra = []; for (let i = 0; i < 60; i++) extra.push({ wo: 'M-' + String(i).padStart(2, '0'), title: 'HOUSE ' + (100 + i) + ' TYPE B KITCHEN', unit: String(100 + i) });
    const S = server(extra);
    const t = await F.dev(browser, S, 'office');
    const p = await t.page.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 200)); return { shown: document.querySelectorAll('#lti [data-ltirow]').length, all: (document.getElementById('lti-all') || {}).textContent || '', more: /Show all \d+/.test((document.getElementById('lti-more') || {}).textContent || '') }; });
    const n = +((/\((\d+)\)/.exec(p.all) || [])[1] || 0);
    rec('63 green rows, 40 shown: "Confirm all green (63)" comes with a "Show all" button, so the person can see what the count covers', n <= p.shown || p.more, JSON.stringify(p));
    const t0 = Date.now();
    await t.page.evaluate(() => document.getElementById('lti-all').click());
    for (let i = 0; i < 200 && S.db.t.lists.filter(l => !l.is_template).length < 63; i++) await F.sleep(100);
    const ms = Date.now() - t0, nl = S.db.t.lists.filter(l => !l.is_template).length;
    rec('Confirm all green on 63 rows: 63 lists, one per WO, within 20 s', nl === 63 && extra.every(x => made(S, x.wo).length === 1) && ms < 20000, nl + ' lists in ' + ms + ' ms');
    rec('no page errors (5)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  }
  // ---- 6. offline half-way through Confirm all: per-row result, nothing half made, Retry after
  {
    const extra = []; for (let i = 0; i < 6; i++) extra.push({ wo: 'O-' + i, title: 'HOUSE ' + (200 + i) + ' TYPE B KITCHEN', unit: String(200 + i) });
    const S = server(extra);
    const t = await F.dev(browser, S, 'office');
    await t.page.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 200)); });
    let calls = 0; const orig = D.RPC.save_list_revision;
    D.RPC.save_list_revision = (d, a) => { calls++; if (calls === 4) S.offline3 = true; return orig(d, a); };
    await t.page.evaluate(() => document.getElementById('lti-all').click());
    await F.sleep(4000);
    D.RPC.save_list_revision = orig; S.offline3 = false;
    const r = await t.page.evaluate(() => ({ retry: document.querySelectorAll('[data-ltiretry]').length, busy: LTI.busy.size, toast: document.getElementById('toast').textContent }));
    const nl = S.db.t.lists.filter(l => !l.is_template).length;
    rec('signal lost after 4 of 9: those made stay made, the rest show "Not saved" + Retry, nothing stuck on "Saving…"', nl === 4 && r.retry === 5 && r.busy === 0 && /NOT saved/.test(r.toast), JSON.stringify({ nl, r }));
    const lines = S.db.t.list_lines.filter(x => S.db.t.lists.some(l => l.id === x.list_id && !l.is_template));
    rec('every list made has all its lines (no half-made list)', S.db.t.lists.filter(l => !l.is_template).every(l => lines.filter(x => x.list_id === l.id).length === 4));
    await t.close();
  }
  // ---- 7. 360 px Chrome: long customer heading / title / project / template names in the confirm panel
  {
    const longC = 'CAIRNHOMESPROPERTIESLIMITEDCHERRYWOODPHASETWOBLOCKABCDEFGHIJ - SOMEWHERE';
    const S = server([{ wo: 'WO-LONG-0000000001', title: 'HOUSE 14 - TYPE B KITCHEN WITH ISLAND AND UTILITYROOMEXTENSIONANDPANTRYUNITS', customer: longC },
      { wo: 'WO-L2', title: 'HOUSE 15 TYPE B KITCHEN' }], { pname: 'Cherrywood Phase 2 — Block A, B and C apartments and duplexes', tname: 'Type B kitchen with island and handed utility and boot room' });
    const t = await F.dev(browser, S, 'prod', { viewport: { width: 360, height: 760 } });
    await t.page.evaluate(async () => { document.querySelector('[data-prodtab="lists"]').click(); await new Promise(r => setTimeout(r, 200)); const c = document.querySelector('[data-ltichg]'); if (c) c.click(); await new Promise(r => setTimeout(r, 100)); });
    const w = await t.page.evaluate(() => { const r = s => [...document.querySelectorAll(s)].map(e => Math.round(e.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth, els: r('#lti [data-ltirow], #lti button, #lti select, #lti .lti-chip'), wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 362).slice(0, 3).map(e => e.tagName + ' ' + (e.id || '') + ' "' + (e.textContent || '').slice(0, 30) + '" right=' + Math.round(e.getBoundingClientRect().right)) }; });
    rec('360 px: confirm panel with long names (incl. Change template and Link to project) — every row / button / select on screen', w.els.length && w.els.every(x => x <= 360), JSON.stringify({ max: Math.max(...w.els) }));
    rec('360 px: the Production Manager Lists tab as a whole has no sideways scroll with a long project name', w.sw <= 360, JSON.stringify(w.wide) + ' scrollWidth ' + w.sw);
    await t.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
