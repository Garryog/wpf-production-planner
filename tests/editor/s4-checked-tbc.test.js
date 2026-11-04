// Simple lists (Garry, 4 Nov) items 5 and 6 on screen: "Checked by" before the saw, and the red "spec TBC" chips.
// - a new list waits for its check: never on the saw; shown "Waiting for check" in Cutting lists to issue (and counted),
//   on the Lists table, the nav badge and the PM tile
// - the check needs the Drawing office / PM / Admin PIN, records who and when; the saw then sees "Issued by X, checked by Y"
// - editing a checked list takes the check away; confirm-from-template is checked only if the template is checked
// - lists that don't need a check (migrated) stay on the saw as before
// - spec TBC: red chip on the list, the saw card and the board row — the saw is never stopped by it
// Fake Supabase only. Run: node tests/editor/s4-checked-tbc.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const J = JSON.stringify;
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row({ listChk: true }); // the Settings switch "Lists must be checked before the saw" is ON for this test
  row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', unit: '3', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
  row.orders.push(H.order({ wo: 'WO-4', customer: 'Aderrig Homes', unit: '4', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { name: 'Old house', wos: ['WO-4'] }); // made before checks (migrated): check_req false → the saw sees it as before
  F.seedList(S, 'T1', { name: 'Type A', wos: [], list: { is_template: true, type_name: 'Type A', check_req: true }, lines: [
    ['hdr', 'House', null, null, null, null, '', '', {}], ['saw', 'Kicker', '3', 2400, 150, 'MFC White', '', '', { section: 'House' }],
    ['saw', 'Worktops', '1', 3000, 600, 'None Chosen / TBC', '', '', { section: 'House' }], ['fit', 'Sink', '1', null, null, '', '', '', { section: 'House' }]] });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  let pin = '7777';
  await pg.evaluate(() => { window.confirm = () => true; setWho('Ann'); localStorage.removeItem('wpfEditPin'); });
  const setPin = async v => pg.evaluate(v => { window.prompt = (m) => /PIN/.test(m) ? v : 'Tester'; }, v);
  await setPin(pin);
  // ---- confirm WO-1 from the UNCHECKED template
  const c1 = await pg.evaluate(async () => { const l = await confirmList('WO-1', 'T1', 'Ann'); await lsReloadList(l.id); return l.id; });
  const l1 = D.find(S.db, 'lists', c1);
  rec('confirm from an UNCHECKED template: the list waits for its check', l1 && l1.check_req === true && l1.checked_at == null, J(l1 && [l1.check_req, l1.checked_at]));
  await pg.evaluate(() => { showTab('l'); render(); });
  const p1 = await pg.evaluate(() => { const t = document.querySelector('#lti') ? document.querySelector('#lti').innerText : ''; return { t, n: (/Cutting lists to issue — (\d+)/.exec(t) || [])[1], badge: (document.getElementById('listcnt') || {}).textContent }; });
  rec('Cutting lists to issue: the list shows "Waiting for check" with a ✓ Check button, and is counted', /Waiting for check/.test(p1.t) && /✓ Check/.test(p1.t) && /1 waiting for check/.test(p1.t), p1.t.slice(0, 400));
  rec('the Lists badge counts it', +p1.badge >= 1, J(p1.badge));
  const lh = await pg.evaluate(id => { const r = document.querySelector('[data-lhrow="' + id + '"]'); return r ? r.innerText : ''; }, c1);
  rec('Lists table: "Waiting for check" and spec TBC on the row', /Waiting for check/.test(lh) && /spec TBC: Worktops, Sink/.test(lh), lh);
  const s = await F.dev(browser, S, 'saw');
  const saw0 = await s.page.evaluate(() => ({ t: document.getElementById('app').innerText, q: workListFor('saw', 3).map(l => l.name), sheets: sheetNeedHTML() }));
  rec('saw: the unchecked list is not in the queue, not on the paper sheet; the old (migrated) list still is', !/WO-1 · |House 1\b/.test(saw0.t.replace('Old house', '')) && !saw0.q.includes(l1.name) && saw0.q.includes('Old house'), J(saw0.q));
  // ---- the check: wrong PIN refused
  await setPin('0000');
  await pg.evaluate(id => lsCheck(id, true), c1);
  await pg.evaluate(async () => { await lqSend(); });
  rec('a wrong PIN: not checked', D.find(S.db, 'lists', c1).checked_at == null);
  await setPin(pin);
  await pg.evaluate(id => document.querySelector('[data-ltichk="' + id + '"]').click(), c1);
  await pg.evaluate(async () => { await lqSend(); await lsPoll(); });
  const l1b = D.find(S.db, 'lists', c1);
  rec('✓ Check with the PIN: checked by Ann, with the time and a history line', l1b.checked_by === 'Ann' && !!l1b.checked_at && l1b.log.some(e => e.what === 'Checked'), J([l1b.checked_by, l1b.checked_at]));
  await s.page.evaluate(async () => { await lsPoll(); render(); });
  const saw1 = await s.page.evaluate(id => { const c = [...document.querySelectorAll('.wl-card')].find(x => x.querySelector('[data-wlsel="' + id + '"]')); return c ? c.innerText : ''; }, c1);
  rec('saw: now on the saw — "Issued by Ann, checked by Ann" and the red spec TBC chip (it is not stopped)', /Issued by Ann, checked by Ann/.test(saw1) && /spec TBC: Worktops, Sink/.test(saw1) && /Kicker/.test(saw1), saw1.slice(0, 500));
  const tbcCell = await s.page.evaluate(id => { const c = [...document.querySelectorAll('.wl-card')].find(x => x.querySelector('[data-wlsel="' + id + '"]')); return c ? c.querySelectorAll('.tbc-cell').length : 0; }, c1);
  rec('saw: the TBC worktop line is shown red', tbcCell >= 1, tbcCell);
  // ---- the board row: spec TBC chip
  await pg.evaluate(() => { showTab('b'); render(); });
  const brd = await pg.evaluate(() => { const r = [...document.querySelectorAll('tr')].find(t => /WO-1/.test(t.innerText) && t.querySelector('.tbc-chip')); return r ? r.querySelector('.tbc-chip').textContent : ''; });
  rec('board row: red "spec TBC: Worktops, Sink" chip on WO-1', /spec TBC: Worktops, Sink/.test(brd), brd);
  // ---- editing a checked list takes the check away (and the saw stops seeing it)
  const ed = await pg.evaluate(async id => { const rows = lsEditRows(id); rows[1].qty = 4; try { await lsSaveManual({ wo: 'WO-1', name: 'House 1', pid: 'P1', rows }, 'Bob', lsList(id)); return 'ok'; } catch (e) { return 'ERR ' + e.message; } }, c1);
  const l1c = D.find(S.db, 'lists', c1);
  rec('editing a checked list: saved, the check is taken away', ed === 'ok' && l1c.checked_at == null && l1c.check_req === true, J([ed, l1c.checked_by]));
  await s.page.evaluate(async () => { await lsPoll(); render(); });
  const saw2 = await s.page.evaluate(() => workListFor('saw', 3).map(l => l.name));
  rec('…and the saw no longer has it until it is checked again', !saw2.includes(l1c.name), J(saw2));
  // the editor warns about it
  await pg.evaluate(id => lsCheck(id, true), c1); await pg.evaluate(async () => { await lqSend(); await lsPoll(); });
  const warn = await pg.evaluate(id => { openListEditor(id); const ov = document.querySelector('.pod-ovl'); const t = ov.innerText; ov.remove(); return t; }, c1);
  rec('the editor of a checked list says saving a change takes the check away', /Checked by Ann — saving a change takes the check away/.test(warn), warn.slice(0, 300));
  // ---- check the TEMPLATE, then confirm WO-2: checked straight away
  await pg.evaluate(() => lsCheck('T1', true)); await pg.evaluate(async () => { await lqSend(); await lsPoll(); });
  rec('the template can be checked (PIN)', !!D.find(S.db, 'lists', 'T1').checked_at);
  const c2 = await pg.evaluate(async () => { const l = await confirmList('WO-2', 'T1', 'Bob'); return l.id; });
  const l2 = D.find(S.db, 'lists', c2);
  rec('confirm from a CHECKED template: the list is checked (by the template\'s checker)', l2 && l2.checked_by === 'Ann' && !!l2.checked_at, J(l2 && [l2.checked_by, l2.checked_at]));
  // a typed list (editor) is never pre-checked
  const c3 = await pg.evaluate(async () => { try { const l = await lsSaveManual({ wo: 'WO-3', name: 'House 3', pid: 'P1', rows: [{ k: 'part', item: 'Kicker', qty: '2', L: '2400', W: '150', mat: 'MFC White', edging: '', note: '' }] }, 'Bob', null); return l.id; } catch (e) { return 'ERR ' + e.message; } });
  rec('a list typed in the editor waits for its check', D.find(S.db, 'lists', c3) && D.find(S.db, 'lists', c3).check_req === true && D.find(S.db, 'lists', c3).checked_at == null, c3);
  // PM tile
  const pm = await F.dev(browser, S, 'prod');
  const tile = await pm.page.evaluate(() => { const t = document.querySelector('[data-pmlists="issue"]'); return t ? t.innerText : ''; });
  rec('PM: "LISTS TO ISSUE" tile counts the lists waiting for check', /waiting for check/.test(tile), tile);
  await pm.close();
  // the check can be taken away from the View dialog
  await pg.evaluate(id => { lsViewDlg(id); [...document.querySelectorAll('[data-vchk]')].pop().click(); }, c2);
  await pg.evaluate(async () => { await lqSend(); });
  rec('"Take check away" from the list view', D.find(S.db, 'lists', c2).checked_at == null && D.find(S.db, 'lists', c2).log.slice(-1)[0].what === 'Check taken away');
  // ---- switch it OFF on the Settings page (Admin PIN): every check sign goes, the waiting list is on the saw again
  const off = await pg.evaluate(async c3 => {
    window.prompt = () => pins().admin; showTab('s'); render();
    const cb = document.getElementById('ls-chk'); if (!cb || !cb.checked) return { err: 'no switch / not ticked' };
    cb.checked = false; cb.dispatchEvent(new Event('change')); await saveDB();
    showTab('l'); render();
    const lti = document.querySelector('#lti') ? document.querySelector('#lti').innerText : '';
    const row = document.querySelector('[data-lhrow="' + c3 + '"]');
    return { on: DB.listChk, wait: lsWaitCheckLists().length, lti, row: row ? row.innerText : '', btn: document.querySelectorAll('[data-lhchk],[data-ltichk]').length, saw: workListFor('saw', 3).map(l => l.name) };
  }, c3);
  rec('switch OFF (Admin PIN, Settings): no "Waiting for check", no ✓ Check buttons, nothing counted; the waiting list is back on the saw', off.on === false && off.wait === 0 && !/waiting for check/i.test(off.lti + off.row) && off.btn === 0 && off.saw.includes('House 3'), J(off));
  rec('the switch is saved in the planner settings', await F.sleep(300).then(() => pg.evaluate(() => fullSettings().listChk === false)));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await s.close(); await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
