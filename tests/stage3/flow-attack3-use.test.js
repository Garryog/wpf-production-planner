// Tester attack 3 on the round-2 fixes for "✓ Use", one list per WO and "Make new list from this" (29c6ef0, c2a1365).
//  U1 "✓ Use <Excel list>" while offline → ✗ Not saved + ↻ Retry; back online, Retry must attach THAT Excel list
//  U2 "✓ Use" whose reply is lost (it landed) → Retry / Use again: no second list
//  M1 "Make new list from this" on two PCs at the same moment: one replacement, old list archived once
//  M2 "Make new list from this" whose save reply is lost → Save again: one new list AND the old list archived
//  O1 one-list-per-WO: Confirm / Use / Create & attach refused once a WO has a list; a deliberate second list (editor, + WO) allowed
// Browser, fake Supabase only. Run: node tests/stage3/flow-attack3-use.test.js
const F = require('./fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 700))); };
const wait = async (fn, ms = 6000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2';
function server() {
  const o = (wo, title, x) => H.order(Object.assign({ wo, title, customer: CH, step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [o('WO-1', 'HOUSE 14 - TYPE B KITCHEN', { unit: '14' }), o('WO-2', 'HOUSE 15 TYPE B KITCHEN', { unit: '15' }), o('WO-3', 'HOUSE 16 TYPE B KITCHEN', { unit: '16' })];
  const S = F.makeServer(row);
  D.insert(S.db, 'projects', { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes' });
  D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' });
  F.seedList(S, 'T1', { name: 'Type B kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed', source: 'template' } });
  F.seedList(S, 'X14', { name: 'House 14 Excel', wos: [], list: { source: 'excel' } });
  F.seedList(S, 'X15', { name: 'House 15 Excel', wos: [], list: { source: 'excel' } });
  return S;
}
// the old list: a unit block with a line already cut (so the editor offers "Make new list from this")
const seedOld = S => { F.seedList(S, 'OLD', { name: 'House 16', wos: ['WO-3'], lines: [['hdr', '900 Single Rail', '3', null, null, null, '', '', {}], ['saw', 'Side panel', '6', 2380, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '2' }], ['saw', 'Back', '3', 2380, 880, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '1' }]] });
  D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'OLD:2'), { status: 'cut', status_by: 'Sean', status_at: '2026-10-21T08:00:00Z' }); };
const made = (S, wo) => S.db.t.lists.filter(l => (l.wos || []).includes(wo) && !l.is_template && !l.archived);
const pinUp = p => p.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why|What changed/.test(m) ? 'edit' : 'Tester'; window.confirm = () => true; setWho('Tester'); });
const settle = async p => { await F.sleep(500); await p.evaluate(async () => { for (let i = 0; i < 60 && LTI.busy.size; i++) await new Promise(r => setTimeout(r, 50)); await lqSend(); }); await F.sleep(300); };
const panel = p => p.evaluate(async () => { showTab('l'); try { await lsPoll(); } catch (e) {} render(); await new Promise(r => setTimeout(r, 50)); return { xl: [...document.querySelectorAll('[data-ltixl]')].map(b => b.dataset.ltixl), retry: [...document.querySelectorAll('[data-ltiretry]')].map(b => b.dataset.ltiretry), msg: [...document.querySelectorAll('.lti-msg')].map(e => e.textContent.trim()) }; });
const click = (p, sel) => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) return 'missing'; b.click(); return 'ok'; }, sel);
const toast = p => p.evaluate(() => document.getElementById('toast').textContent);
(async () => {
  const browser = await H.chromium.launch();
  // ---- U1 Use offline → Retry
  {
    const S = server(); const a = await F.dev(browser, S, 'office'); await pinUp(a.page);
    await panel(a.page);
    S.offline3 = true;
    await click(a.page, '[data-ltixl="WO-1|X14"]'); await settle(a.page);
    const p1 = await a.page.evaluate(() => ({ retry: [...document.querySelectorAll('[data-ltiretry]')].map(b => b.dataset.ltiretry), msg: [...document.querySelectorAll('.lti-msg')].map(e => e.textContent.trim()) }));
    rec('U1 offline "✓ Use House 14 Excel": told "Not saved" with ↻ Retry, nothing made', p1.retry.includes('WO-1') && made(S, 'WO-1').length === 0, JSON.stringify(p1));
    S.offline3 = false;
    await click(a.page, '[data-ltiretry="WO-1"]'); await settle(a.page);
    const m = made(S, 'WO-1').map(l => l.id + ':' + l.name);
    rec('U1 back online, ↻ Retry attaches the Excel list the person chose ("House 14 Excel") — not a list from the template', m.length === 1 && m[0] === 'X14:House 14 Excel', JSON.stringify({ m, toast: await toast(a.page) }));
    await a.close();
  }
  // ---- U1b same, on a WO with no template suggestion (Retry has nothing to "confirm")
  {
    const S = server(); D.update(S.db, 'lists', D.find(S.db, 'lists', 'T1'), { archived: true });
    const a = await F.dev(browser, S, 'office'); await pinUp(a.page); await panel(a.page);
    S.offline3 = true; await click(a.page, '[data-ltixl="WO-2|X15"]'); await settle(a.page); S.offline3 = false;
    const r1 = await click(a.page, '[data-ltiretry="WO-2"]'); await settle(a.page);
    const after = await a.page.evaluate(() => ({ retry: [...document.querySelectorAll('[data-ltiretry]')].length, toast: document.getElementById('toast').textContent }));
    rec('U1b no template for WO-2: ↻ Retry after an offline "✓ Use" still attaches the Excel list (not a dead button)', made(S, 'WO-2').map(l => l.id).join() === 'X15', JSON.stringify({ r1, after, m: made(S, 'WO-2').map(l => l.id) }));
    await a.close();
  }
  // ---- U2 Use, reply lost (it landed) → Retry and Use again
  {
    const S = server(); const a = await F.dev(browser, S, 'office'); await pinUp(a.page); await panel(a.page);
    S.dropReply = 1; // list_attach lands, the reply is lost
    const orig = S.dropReply;
    await a.page.evaluate(() => { const r = lsRpc; window.lsRpc = lsRpc; });
    await click(a.page, '[data-ltixl="WO-1|X14"]'); await settle(a.page);
    const p1 = await a.page.evaluate(() => ({ retry: [...document.querySelectorAll('[data-ltiretry]')].map(b => b.dataset.ltiretry), t: document.getElementById('toast').textContent }));
    await click(a.page, '[data-ltiretry="WO-1"]'); await settle(a.page);
    const m = made(S, 'WO-1').map(l => l.id);
    rec('U2 "✓ Use" landed but the reply was lost, then ↻ Retry: still ONE live list for WO-1 (the Excel one)', m.length === 1 && m[0] === 'X14', JSON.stringify({ orig, p1, m, toast: await toast(a.page) }));
    await a.close();
  }
  // ---- M1 Make new list from this on two PCs at once
  {
    const S = server(); seedOld(S);
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office'); await pinUp(a.page); await pinUp(b.page);
    const copy = p => p.evaluate(async () => { await lsPoll(); openListEditor('OLD'); document.querySelector('.pod-ovl [data-mecopy]').click(); await new Promise(r => setTimeout(r, 100)); const n = document.querySelector('.pod-ovl #me-name'); return !!document.querySelector('.pod-ovl #me-save'); });
    const ca = await copy(a.page), cb = await copy(b.page);
    S.hold3 = new Promise(r => { S.__rel = r; });
    await a.page.evaluate(() => document.querySelector('.pod-ovl #me-save').click()); await b.page.evaluate(() => document.querySelector('.pod-ovl #me-save').click());
    await F.sleep(300); S.__rel(); S.hold3 = null; await F.sleep(2500);
    const repl = S.db.t.lists.filter(l => (l.log || []).some(e => e.replaces === 'OLD') && !l.archived);
    const arch = S.db.t.list_events.filter(e => e.list_id === 'OLD' && e.act === 'archive-on').length;
    rec('M1 two PCs "Make new list from this" + Save at the same moment: ONE replacement, old list archived once', ca && cb && repl.length === 1 && arch === 1 && D.find(S.db, 'lists', 'OLD').archived, JSON.stringify({ repl: repl.map(l => l.id), arch, live: made(S, 'WO-3').map(l => l.id), ta: await toast(a.page), tb: await toast(b.page) }));
    await a.close(); await b.close();
  }
  // ---- M2 Make new list from this, save reply lost → Save again
  {
    const S = server(); seedOld(S);
    const a = await F.dev(browser, S, 'office'); await pinUp(a.page);
    await a.page.evaluate(async () => { await lsPoll(); openListEditor('OLD'); document.querySelector('.pod-ovl [data-mecopy]').click(); });
    S.dropReply = 1; S.dropOnly = 'save_list_revision';
    // only the save's reply is lost: count down only on that RPC
    const before = S.rpcCalls.length;
    await a.page.evaluate(() => document.querySelector('.pod-ovl #me-save').click()); await F.sleep(1500);
    const e1 = await a.page.evaluate(() => (document.querySelector('.pod-ovl #me-err') || {}).textContent || '(closed)');
    await a.page.evaluate(() => { const b = document.querySelector('.pod-ovl #me-save'); if (b) b.click(); }); await F.sleep(1500);
    const e2 = await a.page.evaluate(() => (document.querySelector('.pod-ovl #me-err') || {}).textContent || '(closed)');
    const live = made(S, 'WO-3').map(l => l.id + ':' + l.name);
    rec('M2 the new list\'s save reply is lost, Save pressed again: ONE live list for WO-3 and the old "House 16" is archived (not both on the saw)', live.length === 1 && D.find(S.db, 'lists', 'OLD').archived, JSON.stringify({ e1, e2, live, calls: S.rpcCalls.slice(before).map(c => c.fn), t: await toast(a.page) }));
    await a.close();
  }
  // ---- M3 a plain new list typed in the editor, save reply lost → Save again
  {
    const S = server(); const a = await F.dev(browser, S, 'office'); await pinUp(a.page);
    S.dropReply = 1;
    const r = await a.page.evaluate(async () => { const d = { wo: 'WO-2', name: 'House 15 wardrobes', pid: 'P1', ltype: 'room', rows: [{ k: 'part', item: 'Side', qty: '2', L: 2380, W: 570, mat: 'MFC White', edging: '', note: '' }] }; const out = []; for (let i = 0; i < 2; i++) { try { await lsSaveManual(JSON.parse(JSON.stringify(d)), 'Ann', null); out.push('ok'); break; } catch (e) { out.push(e.message); } } return out; });
    rec('M3 a typed list whose save reply was lost, saved again: one "House 15 wardrobes", not two (the saw would cut it twice)', S.db.t.lists.filter(l => l.name === 'House 15 wardrobes' && !l.archived).length === 1, JSON.stringify({ r, n: S.db.t.lists.filter(l => l.name === 'House 15 wardrobes').map(l => l.id) }));
    await a.close();
  }
  // ---- O1 one-list-per-WO matrix
  {
    const S = server(); const a = await F.dev(browser, S, 'office'); await pinUp(a.page);
    const c1 = await a.page.evaluate(() => confirmList('WO-1', 'T1', 'Ann').then(l => l.id).catch(e => 'ERR ' + e.message));
    rec('O1 ✓ Confirm WO-1 from the template: one list', made(S, 'WO-1').length === 1, JSON.stringify({ c1 }));
    const w = await a.page.evaluate(async () => { try { await lsSaveManual({ wo: 'WO-1', name: 'House 14 wardrobes', pid: 'P1', ltype: 'room', rows: [{ k: 'part', item: 'Robe side', qty: '2', L: 2380, W: 570, mat: 'MFC White', edging: '', note: '' }] }, 'Ann', null); return 'ok'; } catch (e) { return e.message; } });
    rec('O1 a deliberate second list (wardrobes, typed in the editor for WO-1) is still allowed', w === 'ok' && made(S, 'WO-1').length === 2, JSON.stringify({ w, m: made(S, 'WO-1').map(l => l.name) }));
    const pw = await a.page.evaluate(async () => { try { await lsRpc('list_attach', { p_list: 'X15', p_wo: 'WO-1', p_on: true, p_by: 'Ann', p_cid: lqId() }); return 'ok'; } catch (e) { return e.message; } });
    rec('O1 "+ WO" (no one-list rule) can still put a third list on WO-1', pw === 'ok', pw);
    await a.page.evaluate(async () => { await lsRpc('list_attach', { p_list: 'X15', p_wo: 'WO-1', p_on: false, p_by: 'Ann', p_cid: lqId() }); });
    await panel(a.page);
    const u = await click(a.page, '[data-ltixl="WO-1|X14"]'); await settle(a.page);
    rec('O1 "✓ Use" on WO-1 (already has lists) is refused or not offered', made(S, 'WO-1').length === 2, JSON.stringify({ u, m: made(S, 'WO-1').map(l => l.name), t: await toast(a.page) }));
    const ta = await a.page.evaluate(async () => { try { const l = await lsCreateFromTpl('T1', ['WO-1'], 'House 14 again', 'Ann', {}); return 'made ' + l.id; } catch (e) { return e.message; } });
    rec('O1 template "Create & attach" for WO-1 is refused with a plain message', made(S, 'WO-1').length === 2 && /already/.test(ta), ta);
    const tb = await a.page.evaluate(async () => { try { const l = await lsCreateFromTpl('T1', ['WO-2', 'WO-1'], 'Houses 15+14', 'Ann', {}); return 'made ' + l.id; } catch (e) { return e.message; } });
    rec('O1 template "Create & attach" for WO-2 + WO-1 (WO-1 taken): nothing made for WO-2 either, and the message names WO-1', made(S, 'WO-2').length === 0 && /WO-1/.test(tb), JSON.stringify({ tb, wo2: made(S, 'WO-2').map(l => l.id) }));
    rec('no page errors (O1)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
