// Tester attack 4 on "Make new list from this" and one-id-per-editor (f0e3fe7, 07f8fd3).
//  R1 save reply lost, then rows edited in the still-open editor, Save again: one new list WITH the edit, old archived
//  R2 old list changed on another screen, person presses Cancel ("leave it with the saw"): old stays live, ONE new list
//  R3 R2 and then the second save's reply is lost, Save again: still one new list, old still live, honest message
//  R4 a typed new list whose reply is lost; person closes the editor and types it again: one list or two?
//  R5 two editors for new lists open at once: two different lists, each on its own WO
// Browser, fake Supabase only. Run: node tests/stage3/flow-attack4-newlist.test.js
const F = require('./fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 800))); };
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2';
function server() {
  const o = (wo, title, x) => H.order(Object.assign({ wo, title, customer: CH, step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [o('WO-1', 'HOUSE 14 TYPE B KITCHEN', { unit: '14' }), o('WO-2', 'HOUSE 15 TYPE B KITCHEN', { unit: '15' }), o('WO-3', 'HOUSE 16 TYPE B KITCHEN', { unit: '16' })];
  const S = F.makeServer(row);
  D.insert(S.db, 'projects', { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes' });
  D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' });
  F.seedList(S, 'OLD', { name: 'House 16', wos: ['WO-3'], lines: [['hdr', '900 Single Rail', '3', null, null, null, '', '', {}],
    ['saw', 'Side panel', '6', 2380, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '2' }],
    ['saw', 'Back', '3', 2380, 880, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '1' }],
    ['saw', 'Odd shelf', '2', 864, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: 'fixed' }]] });
  D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'OLD:2'), { status: 'cut', status_by: 'Sean', status_at: '2026-10-21T08:00:00Z' });
  return S;
}
const liveFor = (S, wo) => S.db.t.lists.filter(l => (l.wos || []).includes(wo) && !l.is_template && !l.archived);
const repl = S => S.db.t.lists.filter(l => (l.log || []).some(e => e && e.replaces === 'OLD'));
const lines = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq).map(x => x.part + ':' + x.qty + '(' + (x.unit_qty || '') + ')');
const pinUp = (p, cancelChanged) => p.evaluate(c => { window.__conf = []; window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why|What changed/.test(m) ? 'edit' : 'Tester';
  window.confirm = m => { window.__conf.push(m); return !(c && /changed on another screen after you copied/.test(m)); }; setWho('Tester'); }, !!cancelChanged);
const copy = p => p.evaluate(async () => { await lsPoll(); await lsReloadList('OLD'); openListEditor('OLD'); const b = document.querySelector('.pod-ovl [data-mecopy]'); if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 100)); return !!document.querySelector('.pod-ovl #me-save'); });
const setCell = (p, item, field, v) => p.evaluate(({ item, field, v }) => { const ov = document.querySelector('.pod-ovl'); const it = [...ov.querySelectorAll('[data-mr$="|item"]')].find(e => e.value === item); if (!it) return 'no row ' + item;
  const i = it.dataset.mr.split('|')[0]; const e = ov.querySelector('[data-mr="' + i + '|' + field + '"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; }, { item, field, v });
const clickSave = p => p.evaluate(() => { const b = document.querySelector('.pod-ovl #me-save'); if (!b) return 'closed'; b.click(); return 'ok'; });
const state = p => p.evaluate(() => ({ err: (document.querySelector('.pod-ovl #me-err') || {}).textContent || '(editor closed)', toast: document.getElementById('toast').textContent }));
const saveOld = (p, fn) => p.evaluate(async fn => { await lsReloadList('OLD'); const l = lsList('OLD'); const rows = lsEditRows('OLD'); new Function('rows', fn)(rows); try { await lsSaveManual({ wo: 'WO-3', name: l.name, pid: l.pid, rows }, 'Bob', l); return 'ok'; } catch (e) { return e.message; } }, fn);
(async () => {
  const browser = await H.chromium.launch();
  // ---- R1
  {
    const S = server(); const a = await F.dev(browser, S, 'office'); await pinUp(a.page);
    const ok = await copy(a.page);
    S.dropReply = 1; await clickSave(a.page); await F.sleep(1500);
    const s1 = await state(a.page);
    const e1 = await setCell(a.page, 'Back', 'qty', '2'); const e2 = await setCell(a.page, 'Side panel', 'note', 'grain vertical');
    await clickSave(a.page); await F.sleep(2000);
    const s2 = await state(a.page); const r = repl(S);
    rec('R1 reply lost, then Back changed 1 → 2 per unit before Save again: ONE new list, old archived', ok && r.length === 1 && liveFor(S, 'WO-3').length === 1 && D.find(S.db, 'lists', 'OLD').archived, JSON.stringify({ s1, s2, r: r.map(l => l.id), live: liveFor(S, 'WO-3').map(l => l.id) }));
    rec('R1b the edit made after the lost reply is saved (Back = 2 × 3 = 6), the fixed Odd shelf stays 2 fixed', r[0] && lines(S, r[0].id).includes('Back:6(2)') && lines(S, r[0].id).includes('Odd shelf:2(fixed)'), JSON.stringify(r[0] && lines(S, r[0].id)));
    rec('R1c after the second Save the person is told the old list is archived (not "still with the saw")', /archived \(off the saw\)/.test(s2.toast) && !/still with the saw|could not be checked/.test(s2.toast), JSON.stringify(s2));
    rec('R1d the first (lost) reply did not tell the person "Not saved" as if nothing happened', !/^Not saved/.test(s1.err) || /may|might|check|landed/i.test(s1.err), JSON.stringify(s1));
    await a.close();
  }
  // ---- R2 + R3
  {
    const S = server(); const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office'); await pinUp(a.page, true); await pinUp(b.page);
    await copy(a.page);
    const sb = await saveOld(b.page, `rows.find(r=>r.item==='Back').note='check grain';`);
    const n0 = S.rpcCalls.filter(c => c.fn === 'save_list_revision').length;
    await clickSave(a.page); await F.sleep(2000);
    const s = await state(a.page), conf = await a.page.evaluate(() => window.__conf);
    const r = repl(S), calls = S.rpcCalls.filter(c => c.fn === 'save_list_revision').slice(n0).map(c => c.args.p_list.id + (c.args.p_list.replaces_keep ? ' keep' : '') + (c.args.p_list.replaces_force ? ' force' : ''));
    rec('R2 old list changed on B, A presses Cancel: old list stays live (not archived)', sb === 'ok' && !D.find(S.db, 'lists', 'OLD').archived, JSON.stringify({ sb, conf, calls }));
    rec('R2b …and exactly ONE new list was saved (the refused try wrote nothing; the retry used the same id)', r.length === 1 && new Set(calls.map(c => c.split(' ')[0])).size === 1, JSON.stringify({ r: r.map(l => l.id), calls }));
    rec('R2c the person is told the old list was left with the saw', /left with the saw|still with the saw/.test(s.toast), JSON.stringify(s));
    // a third screen tries "Make new list from this" on the still-live old list: refused, names A's list
    const c = await F.dev(browser, S, 'office'); await pinUp(c.page); await copy(c.page); await clickSave(c.page); await F.sleep(1500);
    const sc = await state(c.page);
    rec('R2d a third screen\'s "Make new list from this" on the still-live old list is refused (no second replacement)', repl(S).length === 1, JSON.stringify({ sc, r: repl(S).map(l => l.id) }));
    // the saw: old list live + new list for the same WO. Is the saw told which to cut?
    const sw = await F.dev(browser, S, 'saw');
    const sawTxt = await sw.page.evaluate(async () => { await lsPoll(); showTab('saw'); render(); await new Promise(r => setTimeout(r, 200)); return (document.getElementById('saw-newlist') || {}).innerText || ''; });
    rec('R2e saw banner for the new list does not claim it replaces the old one while the old one is still live [info]', !/replaces "House 16"/.test(sawTxt) || /still|both|check/i.test(sawTxt), sawTxt.slice(0, 300));
    await c.close(); await sw.close(); await a.close(); await b.close();
  }
  {
    const S = server(); const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office'); await pinUp(a.page, true); await pinUp(b.page);
    await copy(a.page); await saveOld(b.page, `rows.find(r=>r.item==='Back').note='check grain';`);
    // first try refused (no write), the "leave it" retry lands but its reply is lost
    let n = 0; const orig = D.RPC.save_list_revision; D.RPC.save_list_revision = (d, x) => { n++; const out = orig(d, x); if (n === 2) S.dropReply = 1; return out; }; // 2nd call lands, its reply is lost
    await clickSave(a.page); await F.sleep(2000); const s1 = await state(a.page);
    D.RPC.save_list_revision = orig;
    await clickSave(a.page); await F.sleep(2000); const s2 = await state(a.page);
    const r = repl(S);
    rec('R3 Cancel ("leave it"), reply lost, Save again: ONE new list and the old list still live', r.length === 1 && !D.find(S.db, 'lists', 'OLD').archived, JSON.stringify({ s1, s2, r: r.map(l => l.id) }));
    rec('R3b the second Save does not silently archive the old list the person chose to keep', !D.find(S.db, 'lists', 'OLD').archived, '');
    rec('R3c the person is told the old list is still with the saw', /still with the saw|left with the saw/.test(s2.toast), JSON.stringify(s2));
    await a.close(); await b.close();
  }
  // ---- R4 typed list, lost reply, editor closed and opened again, same rows typed
  {
    const S = server(); const a = await F.dev(browser, S, 'office'); await pinUp(a.page);
    const type = () => a.page.evaluate(async () => { openListEditor(null, 'WO-1'); await new Promise(r => setTimeout(r, 100)); const ov = document.querySelector('.pod-ovl');
      ov.querySelector('#me-name').value = 'House 14 wardrobes'; const pid = ov.querySelector('#me-pid'); if (pid) { pid.value = 'P1'; pid.dispatchEvent(new Event('change', { bubbles: true })); }
      await new Promise(r => setTimeout(r, 50));
      const o2 = document.querySelector('.pod-ovl'); const set = (f, v) => { const e = o2.querySelector('[data-mr="0|' + f + '"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
      o2.querySelector('#me-name').value = 'House 14 wardrobes';
      set('item', 'Robe side'); set('qty', '2'); set('L', '2380'); set('W', '570'); set('mat', 'MFC White'); return 'ok'; });
    await type(); S.dropReply = 1; await clickSave(a.page); await F.sleep(1500); const s1 = await state(a.page);
    await a.page.evaluate(() => { const x = document.querySelector('.pod-ovl #pod-x'); if (x) x.click(); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); });
    await type(); await clickSave(a.page); await F.sleep(1500); const s2 = await state(a.page);
    const n = S.db.t.lists.filter(l => l.name === 'House 14 wardrobes' && !l.archived);
    rec('R4 typed list: reply lost, editor closed, same list typed again and saved: the saw gets ONE "House 14 wardrobes" (or is warned first)', n.length === 1 || /already|another/.test(s2.err + s2.toast), JSON.stringify({ s1, s2, n: n.map(l => l.id) }));
    await a.close();
  }
  // ---- R5 two editors for new lists at once
  {
    const S = server(); const a = await F.dev(browser, S, 'office'); await pinUp(a.page);
    const out = await a.page.evaluate(async () => { openListEditor(null, 'WO-1'); openListEditor(null, 'WO-2'); await new Promise(r => setTimeout(r, 100)); return document.querySelectorAll('.pod-ovl').length; });
    rec('R5 two "new list" editors opened together: at most one is on screen, or each saves its own list [info]', out >= 1, 'overlays ' + out);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
