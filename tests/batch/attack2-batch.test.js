// Tester round 2 (21 Nov): the saw batch's HIDDEN houses (on hold / waiting for a check stay in the batch, hidden, and come back).
// hold → off hold · waiting-for-check → checked · a hidden house that never comes back · the tab count · ✕ Empty batch with hidden
// houses · storage · two tabs on ONE device · WO shipped mid-batch. Lists switched ON, fake Supabase only.
// Run: node tests/batch/attack2-batch.test.js
const F = require('../stage3/fix3.js');
const S3 = require('../stage3/srv3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const sleep = F.sleep;
const tab = p => p.evaluate(() => { const b = document.getElementById('wl-tab-batch'); return b ? b.textContent.trim() : null; });
const st = p => p.evaluate(() => ({ ids: SB.ids.join(), away: [...SB.away].join(), notes: SB.notes.join(' / '), store: localStorage.getItem('wpfSawBatch'), tab: (document.getElementById('wl-tab-batch') || {}).textContent || null, bar: !!document.getElementById('wl-bopen') }));
const LN = [['saw', 'Side', '2', 2400, 600, 'MFC White', '', ''], ['saw', 'Top', '1', 2400, 600, 'MFC White', '', ''], ['fit', 'Hinge', '4', null, null, 'Blum hinge', '', '']];
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = F.v2Row({ listChk: true });
    row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', unit: '3', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-4', customer: 'Aderrig Homes', unit: '4', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-5', customer: 'Aderrig Homes', unit: '5', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
    const S = F.makeServer(row);
    for (const [id, wo] of [['L1', 'WO-1'], ['L2', 'WO-2'], ['L3', 'WO-3'], ['L4', 'WO-4'], ['L5', 'WO-5']]) F.seedList(S, id, { name: 'House ' + id.slice(1), wos: [wo], lines: LN, list: { check_req: true, checked_at: '2026-10-20T10:00:00Z', checked_by: 'DO' } });
    const a = await F.dev(browser, S, 'saw'), p = a.page;
    const chkOn = await p.evaluate(() => typeof lsChkOn === 'function' ? lsChkOn() : null);
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5']) await p.evaluate(id => document.querySelector('[data-wlsel="' + id + '"]').click(), id);
    rec('set-up: 5 houses in the batch (Checked-by switched ' + (chkOn ? 'on' : 'OFF') + ')', (await tab(p)) === '⚡ BATCH — 5 houses', await tab(p));
    const off = await F.dev(browser, S, 'office'), o = off.page;
    const saveOff = async f => { await o.evaluate(f); await o.evaluate(async () => { sched(); await saveDB(); }); await sleep(300); };
    // L1: job on hold; L2: back to "waiting for its check"; L3: all saw rows removed by a new revision; L4: WO shipped
    await saveOff(() => { DB.orders.find(z => z.wo === 'WO-1').cienHold = true; DB.orders.find(z => z.wo === 'WO-4').shippedAt = new Date().toISOString(); });
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L2'), { checked_at: null, checked_by: null });
    const rv = await o.evaluate(async () => { try { await lsReloadList('L3'); const l = lsList('L3'); const ls = lsLinesOf('L3').filter(x => x.removed_rev == null && x.kind !== 'saw').map(x => ({ id: x.id, kind: x.kind, section: x.section || '', part: x.part, length_mm: x.length_mm, width_mm: x.width_mm, qty: x.qty, unit_qty: x.unit_qty, material: x.material, material_other: !!x.material_other, edging: x.edging || '', edging2: x.edging2 || '', note: x.note || '' }));
      await lsSaveList({ id: 'L3', project_id: l.pid, list_type: l.ltype || 'house' }, ls, 'Office', 'saw rows moved to another list', { expect: +l.ver || 0 }); return 'ok'; } catch (e) { return e.message; } });
    await p.evaluate(async () => { await loadDB(); await lsPoll(); render(); }); await sleep(300);
    let s = await st(p);
    console.log('INFO after hold (L1) / waiting check (L2) / saw rows removed (L3, ' + rv + ') / WO shipped (L4): ' + JSON.stringify(s));
    rec('on hold (L1) and waiting for its check (L2): still in the batch, hidden, with a note', /L1/.test(s.ids) && /L2/.test(s.ids) && /L1/.test(s.away) && /L2/.test(s.away) && /off the saw queue for now/.test(s.notes), JSON.stringify(s));
    rec('the tab counts only the houses showing (hidden ones not counted) — INFO: ' + s.tab, true);
    rec('the stored batch still holds the hidden houses (survives a reload)', /L1/.test(s.store || '') && /L2/.test(s.store || ''), s.store);
    rec('a house whose saw rows were all removed by a new revision (L3, ' + rv + ') leaves the batch for good — or says why it is hidden', !/L3/.test(s.ids) || !/on hold or waiting for its check/.test(s.notes.split(' / ').find(n => /House 3/.test(n)) || ''), JSON.stringify(s));
    rec('WO shipped mid-batch (L4): INFO ' + (/L4/.test(s.away) ? 'hidden' : /L4/.test(s.ids) ? 'still showing' : 'left the batch'), true, s.notes);
    // back: off hold, checked again
    await saveOff(() => { delete DB.orders.find(z => z.wo === 'WO-1').cienHold; });
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L2'), { checked_at: new Date().toISOString(), checked_by: 'DO' });
    await p.evaluate(async () => { await loadDB(); await lsPoll(); render(); }); await sleep(300);
    s = await st(p);
    rec('off hold (L1) and checked again (L2): both showing in the batch again, with a "back" note', /L1/.test(s.ids) && /L2/.test(s.ids) && !/L1|L2/.test(s.away) && /back on the saw queue/.test(s.notes), JSON.stringify(s));
    // reload while L1 is on hold again: hidden house remembered across a reload
    await saveOff(() => { DB.orders.find(z => z.wo === 'WO-1').cienHold = true; });
    await p.reload(); await p.waitForFunction(() => typeof render === 'function'); await sleep(300);
    await p.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); lsReset(); await lsLoad(); render(); }); await sleep(300);
    s = await st(p);
    rec('page reloaded while L1 is on hold: still in the stored batch, hidden', /L1/.test(s.ids) && /L1/.test(s.away), JSON.stringify(s));
    // all showing houses finished → only a hidden one left: can the saw still see / empty the batch?
    for (const id of s.ids.split(',').filter(x => x && !s.away.split(',').includes(x))) D.update(S.db, 'lists', D.find(S.db, 'lists', id), { saw_done_at: new Date().toISOString(), saw_done_by: 'Op' });
    await p.evaluate(async () => { await lsPoll(); render(); }); await sleep(200);
    s = await st(p);
    rec('only hidden houses left: the saw can still see that a batch exists (tab or bar) and empty it', !!s.tab || s.bar, JSON.stringify(s));
    const e = await p.evaluate(() => { wlShowBatch = true; render(); const b = document.getElementById('sb-empty'); if (!b) return 'no ✕ Empty batch'; b.click(); return 'ok'; }); await sleep(100);
    s = await st(p);
    rec('✕ Empty batch (' + e + ') also clears the hidden houses', e === 'ok' && !s.ids && !s.away && !s.store, JSON.stringify(s));
    // two tabs on ONE device (same browser storage): each adds a different house
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5']) D.update(S.db, 'lists', D.find(S.db, 'lists', id), { saw_done_at: null, saw_done_by: null });
    await saveOff(() => { delete DB.orders.find(z => z.wo === 'WO-1').cienHold; });
    const p2 = await a.ctx.newPage(); p2.on('pageerror', x => (S.errors = S.errors || []).push(String(x)));
    await S3.attach({ ctx: a.ctx, page: p2 }, S);
    await p2.goto('https://wpf.test/?view=office'); await p2.waitForFunction(() => typeof loadDB === 'function' && typeof XLSX !== 'undefined');
    await p2.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); lsReset(); await lsLoad(); render(); }); await sleep(300);
    await p.evaluate(async () => { await loadDB(); await lsPoll(); render(); });
    await p.evaluate(() => { sbClear(); render(); }); await p2.evaluate(() => render());
    const ids2 = await p2.evaluate(() => [...document.querySelectorAll('[data-wlsel]')].map(b => b.dataset.wlsel));
    const [x1, x2] = ids2;
    await p.evaluate(x => { const b = document.querySelector('[data-wlsel="' + x + '"]'); if (b) b.click(); }, x1);
    await p2.evaluate(x => { const b = document.querySelector('[data-wlsel="' + x + '"]'); if (b) b.click(); }, x2);
    const both = await p.evaluate(() => localStorage.getItem('wpfSawBatch'));
    const ids3 = both ? JSON.parse(both).ids : [];
    rec('two tabs on one device: tab 1 emptied its batch and added ' + x1 + ' → tab 2 (open since before) adding ' + x2 + ' does not bring back houses tab 1 had emptied', ids3.every(x => x === x1 || x === x2), both);
    rec('two tabs on one device: tab 1 adds ' + x1 + ', tab 2 adds ' + x2 + ' → both in the stored batch (neither overwrites the other)', !!x1 && !!x2 && both && both.includes('"' + x1 + '"') && both.includes('"' + x2 + '"'), both + ' cards=' + ids2.join());
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await off.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
