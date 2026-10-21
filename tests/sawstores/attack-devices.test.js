// Tester attack: N/A box vs ticks across two devices, offline, Release all, Material not in, list undo. Stubbed Supabase only.
// Run: node tests/sawstores/attack-devices.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-21T09:00:00Z';
const ROWS = [
  { k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Top', qty: 2, L: 1200, W: 600, mat: 'MFC White', note: '' },
  { k: 'saw', item: 'Back', qty: 1, L: 900, W: 700, mat: 'Oak', note: '' },
];
const row = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: 3, fit: 0, wos: ['WO-1'], up: NOW }],
    listWBs: { W1: { project: 'Proj', sheets: { H1: ROWS } } } } });
const K = p => p.evaluate(() => listRows(lists()[0]).map(rowKey));
const tap = (p, attr, i) => p.evaluate(({ attr, i }) => { const k = listRows(lists()[0]).map(rowKey)[i]; const b = [...document.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr) === 'L1|' + k); if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; }, { attr, i });
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = p => p.evaluate(async () => { await loadDB(); render(); });
const state = (p, i) => p.evaluate(i => { const l = lists()[0], k = listRows(l).map(rowKey)[i]; return { held: heldRow(l, k), ticked: rowTicked('L1', k), rawHold: !!(holdsOf('L1')[k]), st: (holdsOf('L1')[k] || {}).st, side: sideState(l, 'saw'), waiting: allHolds(['saw'], 'hold').length, alerts: window.__alerts.slice() }; }, i);
const dev = async (browser, S, extra = {}) => { const t = await open(browser, S, Object.assign({ now: NOW, role: 'saw' }, extra)); await t.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); }); return t; };

(async () => {
  const browser = await H.chromium.launch();
  // 1. N/A on B saved FIRST, then A (stale screen) ticks → got-out wins and stays winning; then list "Undo" on A
  {
    const S = makeServer(row()); const A = await dev(browser, S), B = await dev(browser, S);
    await tap(B.page, 'data-rna', 0); await save(B.page);
    rec('A (stale) can still tick the line B just parked', (await tap(A.page, 'data-rt', 0)) === 'ok');
    await save(A.page); await reload(A.page); await reload(B.page);
    const a = await state(A.page, 0), b = await state(B.page, 0);
    rec('N/A-first clash: got-out wins on both screens', a.ticked && !a.held && b.ticked && !b.held, JSON.stringify({ a, b }));
    console.log('INFO clash leaves the hold record in saved data (by design, read-time rule): rawHold=' + a.rawHold + ' st=' + a.st);
    // A unticks by mistake (or office "Put back in queue") → the old N/A comes back from the dead?
    await tap(A.page, 'data-rt', 0);
    const u = await state(A.page, 0);
    rec('untick after clash: line goes back to open, NOT back to WAITING under B\'s old N/A', !u.held && u.waiting === 0, JSON.stringify(u));
    await A.close(); await B.close();
  }
  // 2. Undo N/A on B while A ticks (A loaded before the N/A)
  {
    const S = makeServer(row()); const B = await dev(browser, S);
    await tap(B.page, 'data-rna', 1); await save(B.page);
    const A = await dev(browser, S); // A sees it waiting → tick hidden
    rec('A sees parked line with no tick button', (await tap(A.page, 'data-rt', 1)) === 'missing');
    await tap(B.page, 'data-rna', 1); // B undoes
    await save(B.page); await reload(A.page);
    rec('A now gets the tick back after B\'s undo', (await tap(A.page, 'data-rt', 1)) === 'ok');
    await save(A.page); await reload(B.page);
    const b = await state(B.page, 1);
    rec('undo-N/A + tick: line done, nothing waiting', b.ticked && !b.held && !b.rawHold && b.waiting === 0, JSON.stringify(b));
    const log = S.row.settings.holdLog.map(x => x.act).join(',');
    rec('holds log has hold, unhold (both by Op)', log === 'hold,unhold', log);
    await A.close(); await B.close();
  }
  // 3. N/A offline then online
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    S.offline = true;
    await tap(A.page, 'data-rna', 2);
    await A.page.evaluate(async () => { clearTimeout(saveT); try { await saveDB(); } catch (e) {} });
    await A.page.waitForTimeout(500);
    const off = await A.page.evaluate(() => ({ bar: (document.getElementById('savebar') || document.body).innerText.match(/not saved|offline|unsaved|failed|couldn/i), pend: Object.keys(JSON.parse(localStorage.getItem('wpfPend') || '{}')).length, ls: Object.keys(localStorage) }));
    rec('offline: N/A kept on the device', await A.page.evaluate(() => heldRow(lists()[0], listRows(lists()[0]).map(rowKey)[2])), JSON.stringify(off));
    rec('offline: user told the save failed', !!off.bar, JSON.stringify(off.bar));
    S.offline = false; await save(A.page);
    rec('back online: N/A reaches the server', !!(S.row.settings.listHold && S.row.settings.listHold.L1 && Object.keys(S.row.settings.listHold.L1).length === 1));
    // reopen as a fresh device: sees waiting
    const C = await dev(browser, S); rec('another device sees the parked line', (await state(C.page, 2)).held);
    await A.close(); await C.close();
  }
  // 3b. N/A offline, tab closed before reconnect → reopened same device restores it
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    S.offline = true; await tap(A.page, 'data-rna', 0); await A.page.waitForTimeout(800);
    await A.page.evaluate(() => { try { writePend(); } catch (e) {} });
    const { reopen } = require('../stage1/srv');
    const A2 = await reopen(A, S); await A.page.close();
    S.offline = false; await A2.page.evaluate(async () => { await loadDB(); }); await A2.page.waitForTimeout(2500); await A2.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
    rec('offline N/A + tab closed → restored and saved on reopen', !!(S.row.settings.listHold && S.row.settings.listHold.L1), JSON.stringify(S.row.settings.listHold || null));
    await A2.ctx.close();
  }
  // 4. N/A then "Release all" by material (Stores), then saw ticks it
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 0); await tap(A.page, 'data-rna', 1); await tap(A.page, 'data-rna', 2);
    await A.page.evaluate(() => { localStorage.setItem('wpfPin_stores', '9000'); setRole('stores'); wlShowHold = true; render(); });
    const grp = await A.page.evaluate(() => [...document.querySelectorAll('[data-relg]')].map(b => b.dataset.relg));
    rec('WAITING book groups by material (MFC White, Oak)', JSON.stringify(grp) === '["MFC White","Oak"]', JSON.stringify(grp));
    await A.page.evaluate(() => document.querySelector('[data-relg="MFC White"]').click());
    await A.page.waitForTimeout(100);
    // whoFn may open a picker
    await A.page.evaluate(() => { const b = document.querySelector('[data-pick]'); if (b) b.click(); const ok = document.getElementById('pick-ok'); if (ok && document.getElementById('pick-other')) { document.getElementById('pick-other').value = 'Stores'; ok.click(); } });
    const s0 = await state(A.page, 0), s2 = await state(A.page, 2);
    rec('Release all MFC White: rows 0,1 released, Oak still waiting', s0.st === 'rel' && !s0.held && s2.held, JSON.stringify({ s0, s2 }));
    await A.page.evaluate(() => { wlShowHold = false; setRole('saw'); render(); });
    const txt = await A.page.evaluate(() => document.getElementById('app').innerText);
    rec('saw sees MATERIAL IN — DO NOW on released rows', (txt.match(/MATERIAL IN — DO NOW/g) || []).length === 2);
    rec('N/A on a released row parks it again', (await tap(A.page, 'data-rna', 0)) === 'ok' && (await state(A.page, 0)).held);
    await A.close();
  }
  // 5. N/A one line then whole-house "Material not in"
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 0); await tap(A.page, 'data-rt', 1);
    await A.page.evaluate(() => document.querySelector('[data-wlhold="L1"]').click());
    const pop = await A.page.evaluate(() => [...document.querySelectorAll('[data-hk]')].map(c => c.dataset.hk));
    const ks = await K(A.page);
    rec('Material-not-in pop-up offers only the line that is neither N/A\'d nor ticked', pop.length === 1 && pop[0] === ks[2], JSON.stringify(pop));
    await A.close();
  }
  // 6. Tick vs N/A at the same instant, both saves racing (no reload in between)
  {
    const S = makeServer(row()); const A = await dev(browser, S), B = await dev(browser, S);
    await tap(A.page, 'data-rt', 2); await tap(B.page, 'data-rna', 2);
    await Promise.all([save(A.page), save(B.page)]);
    for (let i = 0; i < 3; i++) { await save(A.page); await save(B.page); await reload(A.page); await reload(B.page); }
    const a = await state(A.page, 2), b = await state(B.page, 2);
    rec('race: both screens agree, got-out wins', a.ticked && b.ticked && !a.held && !b.held, JSON.stringify({ a, b }));
    const log = (S.row.settings.holdLog || []).map(x => x.act + ':' + x.by).join(',');
    rec('race: holds log records the N/A (audit trail kept)', /hold:Op/.test(log), log);
    await A.close(); await B.close();
  }
  // 7. Whole list "CUT COMPLETE" with a line N/A'd → list done but line still waiting; board / side state
  {
    const S = makeServer(row()); const A = await dev(browser, S);
    await tap(A.page, 'data-rna', 2); await tap(A.page, 'data-rt', 0);
    await tap(A.page, 'data-rt', 1); // ticks the last tickable → auto CUT COMPLETE
    const o = await A.page.evaluate(() => ({ done: !!listDone('L1').saw, side: sideState(lists()[0], 'saw'), wait: allHolds(['saw'], 'hold').length }));
    rec('all-but-N/A ticked → auto done, side shows hold (red on board), line still waiting', o.done && o.side === 'hold' && o.wait === 1, JSON.stringify(o));
    await A.close();
  }
  // 8. Duplicate identical lines in one list (same item/size/material in two sections)
  {
    const r = row(); r.settings.listWBs.W1.sheets.H1 = [{ k: 'hdr', item: 'Kitchen' }, ROWS[0], { k: 'hdr', item: 'Utility' }, { ...ROWS[0] }]; r.settings.lists[0].saw = 2;
    const S = makeServer(r); const A = await dev(browser, S);
    const n = await A.page.evaluate(() => { const b = document.querySelector('[data-rna]'); b.click(); return document.querySelectorAll('.hold-b').length; });
    rec('N/A on one of two identical lines parks only that one', n === 1, n + ' lines show WAITING');
    await A.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
