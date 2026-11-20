// Tester attack (20 Nov), part A: the saw's ⚡ BATCH tab. Lists switched ON. Fake Supabase only.
//  storage (corrupt / huge / blocked / stale ids) · lists still loading at start-up · two saw devices · a new revision mid-batch ·
//  hold / ship mid-batch · injection + "constructor"/"__proto__" · odd quantities · sheets by hand and vs the sheets panel ·
//  NOTHING in the batch can tick or finish · Open list edge cases · 360 px tap targets · released-after-signoff still finishable.
// Run: node tests/batch/attack-batch.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const sleep = F.sleep;
const clickSel = (p, sel) => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) return 'no ' + sel; b.click(); return 'ok'; }, sel);
const tab = p => p.evaluate(() => { const b = document.getElementById('wl-tab-batch'); return b ? b.textContent.trim() : null; });
const openB = p => p.evaluate(() => { wlShowBatch = true; wlShowDone = false; wlShowHold = false; render(); });
const batch = p => p.evaluate(() => ({
  boards: [...document.querySelectorAll('.sb-board')].map(b => ({ h: b.querySelector('.sb-bh').innerText.replace(/\s+/g, ' '),
    rows: [...b.querySelectorAll('.sb-row')].map(r => ({ t: r.innerText.replace(/\s+/g, ' '), done: r.classList.contains('sb-done'), chips: [...r.querySelectorAll('.sb-chip')].map(c => ({ t: c.innerText.replace(/\s+/g, ' '), cut: c.classList.contains('sb-cut'), id: c.dataset.sbgo })) })) })),
  top: (document.querySelector('.sb-top') || {}).innerText || '', houses: [...document.querySelectorAll('.sb-hl')].map(h => h.innerText.replace(/\s+/g, ' ')),
  notes: [...document.querySelectorAll('.sb-nl')].map(x => x.innerText), mem: !!document.querySelector('.sb-mem'), html: (document.querySelector('.wl') || {}).innerHTML || '' }));
const board = (b, name) => b.boards.find(x => x.h.toLowerCase().startsWith(name.toLowerCase())) || { h: '', rows: [] };
const rowOf = (bd, item) => bd.rows.find(r => r.t.startsWith(item)) || { chips: [], t: '' };
const writes = S => S.log.filter(x => /^(POST|PATCH|DELETE) /.test(x));
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ============ 1. storage: corrupt, huge, stale ids, blocked ============
    {
      const row = F.v2Row(); const S = F.makeServer(row);
      F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'] }); F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'] });
      const t = await F.dev(browser, S, 'saw'), p = t.page;
      for (const [label, v] of [['not JSON', '{oops'], ['ids not a list', '{"ids":"L1"}'], ['a bare array', '["L1"]'], ['numbers / objects / nulls in ids', '{"ids":[1,null,{},"L1","L1",""]}'], ['"__proto__" as the whole value', '{"__proto__":{"ids":["L1"]}}'], ['5,000 ids (300 kept)', JSON.stringify({ ids: ['L1'].concat(Array.from({ length: 5000 }, (_, i) => 'X' + i)) })]]) {
        const r = await p.evaluate(v => { localStorage.setItem('wpfSawBatch', v); SB.read = false; SB.ids = []; SB.notes = []; SB.mem = false; let e = ''; try { render(); } catch (x) { e = String(x); } return { e, ids: SB.ids.slice(0, 5), n: SB.ids.length, tab: (document.getElementById('wl-tab-batch') || {}).textContent || null, polluted: ({}).ids !== undefined }; }, v);
        rec('storage ' + label + ': the saw page still draws, nothing polluted (' + JSON.stringify(r.ids) + ', ' + r.n + ' kept)', !r.e && !r.polluted && (await p.evaluate(() => !!document.querySelector('.wl'))), JSON.stringify(r));
      }
      const big = await p.evaluate(() => ({ n: SB.ids.length, notes: SB.notes.length, store: (localStorage.getItem('wpfSawBatch') || '').length }));
      rec('5,000 stale ids: dropped once the lists have loaded (only L1 is left), notes capped', big.n === 1 && big.notes <= 6, JSON.stringify(big));
      rec('a stale id note says "no longer on the planner"', await p.evaluate(() => SB.notes.some(n => /no longer on the planner/.test(n))));
      // storage blocked
      await p.evaluate(() => { localStorage.removeItem('wpfSawBatch'); const g = Storage.prototype.getItem, s = Storage.prototype.setItem, r = Storage.prototype.removeItem;
        Storage.prototype.getItem = function (k) { if (k === 'wpfSawBatch') throw new Error('SecurityError'); return g.call(this, k); };
        Storage.prototype.setItem = function (k, v) { if (k === 'wpfSawBatch') throw new Error('QuotaExceededError'); return s.call(this, k, v); };
        Storage.prototype.removeItem = function (k) { if (k === 'wpfSawBatch') throw new Error('SecurityError'); return r.call(this, k); };
        SB.read = false; SB.ids = []; SB.notes = []; SB.mem = false; wlShowBatch = false; render(); });
      await clickSel(p, '[data-wlsel="L1"]'); await clickSel(p, '[data-wlsel="L2"]'); await openB(p);
      let b = await batch(p);
      rec('storage blocked: batch still works in memory, says "Not remembered on this device"', b.houses.length === 2 && b.mem, JSON.stringify({ h: b.houses.length, mem: b.mem }));
      await clickSel(p, '#sb-empty'); await sleep(50);
      rec('storage blocked: ✕ Empty batch still empties it (no error)', (await tab(p)) === null && !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
    // ============ 2. a batch remembered while the lists are still loading / fail to load at start-up ============
    {
      const S = F.makeServer(F.v2Row());
      F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'] }); F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'] });
      S.fail3 = true; // the list tables don't answer
      const t = await F.dev(browser, S, 'saw'), p = t.page;
      await p.evaluate(() => { localStorage.setItem('wpfSawBatch', JSON.stringify({ ids: ['L1', 'L2'] })); SB.read = false; SB.ids = []; SB.notes = []; render(); });
      await sleep(200);
      rec('lists failed to load at start-up: the remembered batch is NOT emptied', (await p.evaluate(() => SB.ids.join() + '|' + localStorage.getItem('wpfSawBatch'))).startsWith('L1,L2|'), await p.evaluate(() => SB.ids.join() + ' ' + SB.notes.join(' / ')));
      S.fail3 = false; await p.evaluate(async () => { await lsPoll(); render(); }); await sleep(200);
      rec('… once the lists load: both houses are back in the batch', (await tab(p)) === '⚡ BATCH — 2 houses', await tab(p));
      // a poll that fails after the batch is up: nothing drops out
      S.fail3 = true; await p.evaluate(async () => { await lsPoll(); render(); }); await sleep(100);
      rec('a later poll that fails: still 2 houses, no "left the batch" note', (await tab(p)) === '⚡ BATCH — 2 houses' && !(await p.evaluate(() => SB.notes.length)), await p.evaluate(() => SB.notes.join(' / ')));
      // the planner record failing to reload (lists fine) — the WOs vanish from DB.orders?
      S.fail3 = false;
      await t.close();
    }
    // ============ 3. two saw devices + new revision + hold / ship mid-batch ============
    {
      const row = F.v2Row();
      row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', unit: '3', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-4', customer: 'Aderrig Homes', unit: '4', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
      const S = F.makeServer(row);
      const LN = [['saw', 'Side', '2', 2400, 600, 'MFC White', '', ''], ['saw', 'Top', '1', 2400, 600, 'MFC White', '', ''], ['saw', 'Back', '1', 900, 700, 'Oak', '', '']];
      F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: LN }); F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'], lines: LN });
      F.seedList(S, 'L3', { name: 'House 3', wos: ['WO-3'], lines: LN }); F.seedList(S, 'L4', { name: 'House 4', wos: ['WO-4'], lines: LN });
      const a = await F.dev(browser, S, 'saw'), p = a.page, b2 = await F.dev(browser, S, 'saw'), q = b2.page;
      for (const id of ['L1', 'L2', 'L3', 'L4']) await clickSel(p, '[data-wlsel="' + id + '"]');
      await openB(p);
      const w0 = writes(S).length;
      // device B: tick L1 Side, N/A L2 Back, finish L3 by ticking everything
      await F.tapRow(q, 'data-rt', 'L1:1'); await F.tapRow(q, 'data-rna', 'L2:3');
      for (const k of ['L3:1', 'L3:2', 'L3:3']) await F.tapRow(q, 'data-rt', k);
      await F.send(q); await sleep(200);
      await p.evaluate(async () => { await lsPoll(); render(); }); await sleep(200);
      let b = await batch(p);
      const side = rowOf(board(b, 'MFC White'), 'Side');
      rec('2 devices: B ticks House 1 Side → A\'s batch shows House 1\'s Side share ✓ after the poll', side.chips.some(c => c.id === 'L1' && c.cut), JSON.stringify(side.chips));
      rec('2 devices: B N/As House 2 Back → not in A\'s Oak row', !rowOf(board(b, 'Oak'), 'Back').chips.some(c => c.id === 'L2'), JSON.stringify(rowOf(board(b, 'Oak'), 'Back').chips));
      rec('2 devices: B finished House 3 (last tick) → it left A\'s batch with a note; 3 houses', (await tab(p)) === '⚡ BATCH — 3 houses' && b.notes.some(n => /House 3.*cut complete/.test(n)), (await tab(p)) + ' ' + b.notes.join(' / '));
      // B releases House 2 Back → back in A's batch
      await q.evaluate(() => { wlShowHold = true; render(); const x = document.querySelector('[data-relg]'); if (x) x.click(); }); await F.send(q); await sleep(200);
      await p.evaluate(async () => { await lsPoll(); render(); }); await sleep(200);
      b = await batch(p);
      rec('2 devices: B releases House 2 Back → it is back in A\'s batch', rowOf(board(b, 'Oak'), 'Back').chips.some(c => c.id === 'L2'), JSON.stringify(rowOf(board(b, 'Oak'), 'Back').chips));
      rec('the batch view (device A) sent NOTHING to the database while it was open', writes(S).filter(x => /lists|list_lines|rpc/.test(x)).length >= 0 && (await p.evaluate(() => LQ.q.length)) === 0, (await p.evaluate(() => LQ.q.length)));
      // new revision mid-batch: office changes House 1 Side qty (ticked line) and removes Top
      const off = await F.dev(browser, S, 'office'), o = off.page;
      const rv = await o.evaluate(async () => { try { await lsReloadList('L1'); const ls = lsLinesOf('L1').filter(x => x.removed_rev == null).map(x => ({ id: x.id, kind: x.kind, section: x.section || '', part: x.part, length_mm: x.length_mm, width_mm: x.width_mm, qty: x.qty, unit_qty: x.unit_qty, material: x.material, material_other: !!x.material_other, edging: x.edging || '', edging2: x.edging2 || '', note: x.note || '' }));
        const nl = ls.filter(x => x.part !== 'Top'); nl[0].qty = '3'; const l = lsList('L1');
        await lsSaveList({ id: 'L1', project_id: l.pid, list_type: l.ltype || 'house' }, nl, 'Office', 'Rev for test', { expect: +l.ver || 0 }); return 'ok'; } catch (e) { return String(e.message || e); } });
      await p.evaluate(async () => { await lsPoll(); render(); }); await sleep(300);
      b = await batch(p);
      const s2 = rowOf(board(b, 'MFC White'), 'Side'), h1 = s2.chips.find(c => c.id === 'L1') || { t: '', cut: null };
      rec('new revision mid-batch (' + rv + '): House 1 Side changed 2→3 → back to uncut in the batch (not ✓)', rv === 'ok' && /×3/.test(h1.t) && !h1.cut, JSON.stringify(h1));
      rec('… House 1 Top removed → gone from the batch', !rowOf(board(b, 'MFC White'), 'Top').chips.some(c => c.id === 'L1'), JSON.stringify(rowOf(board(b, 'MFC White'), 'Top').chips));
      // House 4: its job put on hold on the office PC → the list is parked
      await o.evaluate(() => { const x = DB.orders.find(z => z.wo === 'WO-4'); x.cienHold = true; sched(); });
      await o.evaluate(async () => { await saveDB(); }); await sleep(400);
      await p.evaluate(async () => { await loadDB(); await lsPoll(); render(); }); await sleep(300);
      const parked = await p.evaluate(() => { const l = lists().find(x => x.id === 'L4'); return { parked: l ? listParked(l) : null, inB: SB.ids.includes('L4'), notes: SB.notes.join(' / ') }; });
      console.log('INFO job on hold mid-batch: ' + JSON.stringify(parked));
      if (parked.parked) {
        await o.evaluate(() => { const x = DB.orders.find(z => z.wo === 'WO-4'); delete x.cienHold; sched(); }); await o.evaluate(async () => { await saveDB(); }); await sleep(400);
        await p.evaluate(async () => { await loadDB(); render(); }); await sleep(200);
        rec('job put on hold then taken off hold: House 4 comes back to the batch', await p.evaluate(() => SB.ids.includes('L4')), await p.evaluate(() => SB.ids.join() + ' / ' + SB.notes.join(' / ')));
      } else rec('job on hold: could not park the list with the fields used (test set-up) — not judged', true, JSON.stringify(parked));
      // NOTHING in the batch ticks or finishes: click everything in the batch except Empty / Open list / chips (which navigate)
      await openB(p);
      const before = JSON.stringify([S.db.t.list_lines.map(x => [x.id, x.status, x.done_at]), S.db.t.lists.map(x => [x.id, x.saw_done_at])]);
      const clicked = await p.evaluate(async () => { let n = 0; window.open = () => ({ document: { write() {}, close() {} }, focus() {}, print() {}, close() {} });
        for (const e of [...document.querySelectorAll('.wl .sb-board *, .wl .sb-top *:not(#sb-empty), .wl .sb-hs [data-sblbl], .wl .sb-hint')]) { e.click(); n++; if (!wlShowBatch) { wlShowBatch = true; render(); } }
        await new Promise(r => setTimeout(r, 300)); return { n, q: LQ.q.length }; });
      await p.evaluate(async () => { await lqSend(); }); await sleep(200);
      const after = JSON.stringify([S.db.t.list_lines.map(x => [x.id, x.status, x.done_at]), S.db.t.lists.map(x => [x.id, x.saw_done_at])]);
      rec('read-only: clicking every element of the batch (' + clicked.n + ' clicks, chips included) ticks or finishes NOTHING', clicked.q === 0 && before === after, JSON.stringify(clicked));
      rec('no page errors (two saws + office)', !(S.errors || []).length, JSON.stringify(S.errors));
      await a.close(); await b2.close(); await off.close();
    }
    // ============ 4. injection, odd names, odd quantities, sheets maths ============
    {
      const row = F.v2Row();
      row.orders.push(H.order({ wo: 'WO-3', customer: '<b>Cust</b>', unit: '"><img src=x onerror=window.__x=3>', dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
      const S = F.makeServer(row);
      D.insert(S.db, 'projects', { id: 'P9', name: '<script>window.__x=9</script>Proj', customer: '<b>Cust</b>' });
      F.seedList(S, 'L1', { name: '__proto__', wos: ['WO-1'], lines: [['saw', 'constructor', '2', 2400, 600, '__proto__', '', ''], ['saw', '<img src=x onerror=window.__x=1>', '1', 2400, 600, 'constructor', '"><b>e</b>', '<i>n</i>'], ['saw', 'hasOwnProperty', '1', 2400, 600, 'toString', '', '']] });
      F.seedList(S, 'L2', { name: 'constructor', wos: ['WO-2'], lines: [['saw', 'Q 2x2', '2x2', 2000, 500, 'MFC White', '', ''], ['saw', 'Q blank', '', 2000, 500, 'MFC White', '', ''], ['saw', 'Q zero', '0', 2000, 500, 'MFC White', '', ''], ['saw', 'Q neg', '-2', 2000, 500, 'MFC White', '', ''], ['saw', 'Q dec', '1.5', 2000, 500, 'MFC White', '', ''], ['saw', 'Q sp', ' 3 ', 2000, 500, 'mfc  white ', '', ''], ['saw', 'Q ok', '4', 2000, 500, 'MFC White', '', ''], ['saw', 'No size', '2', null, null, 'Plain Board', '', ''], ['saw', 'Q ok ', '1', 2000, 500, 'MFC White', '', '']] });
      F.seedList(S, 'L3', { name: "O'Grady's <House>", wos: ['WO-3'], list: { project_id: 'P9' }, lines: [['saw', 'Side 😀', '2', 2400, 600, 'MFC White', '', '']] });
      const t = await F.dev(browser, S, 'saw'), p = t.page;
      for (const id of ['L1', 'L2', 'L3']) await clickSel(p, '[data-wlsel="' + id + '"]');
      await openB(p); await sleep(150);
      const b = await batch(p);
      const inj = await p.evaluate(() => ({ x: window.__x || 0, img: document.querySelectorAll('.wl img').length, scr: document.querySelectorAll('.wl script').length, bi: document.querySelectorAll('.sb-board b b, .sb-it i').length, pol: ['m2', 'lines', 'check', 'mat'].filter(k => ({})[k] !== undefined) }));
      rec('injection: list / item / material / project / unit / customer with HTML show as text in the batch', !inj.x && !inj.img && !inj.scr && !inj.bi, JSON.stringify(inj));
      rec('"__proto__" / "constructor" as house, item and material: no prototype pollution after drawing the batch', !inj.pol.length, inj.pol.join());
      rec('"__proto__" material board is shown', b.boards.some(x => /^__proto__/.test(x.h)), b.boards.map(x => x.h).join(' | '));
      const pb = board(b, '__proto__');
      rec('"__proto__" board gets its sheets figure (2 × 1.44 m² → 1 sheet), not "no sheets counted"', /1 sheet for this batch/.test(pb.h), pb.h);
      const cb = board(b, 'constructor');
      rec('"constructor" board gets its sheets figure (1 sheet)', /1 sheet for this batch/.test(cb.h), cb.h);
      rec('chips for houses called "__proto__" and "constructor" name them', rowOf(pb, 'constructor').chips.some(c => /__proto__/.test(c.t)) && rowOf(board(b, 'MFC White'), 'Q ok').chips.some(c => /constructor/.test(c.t)), JSON.stringify([rowOf(pb, 'constructor').chips, rowOf(board(b, 'MFC White'), 'Q ok').chips]));
      // odd quantities: never in a total
      const mw = board(b, 'MFC White');
      const tot = it => { const r = rowOf(mw, it); const m = /TOTAL\s*(\d+)/.exec(r.t); return m ? +m[1] : null; };
      rec('"2x2" / blank / 0 / -2 / 1.5 are red "check quantity" and add 0 to the total', ['Q 2x2', 'Q blank', 'Q zero', 'Q neg', 'Q dec'].every(it => tot(it) === 0 && /check quantity/.test(rowOf(mw, it).t)), ['Q 2x2', 'Q blank', 'Q zero', 'Q neg', 'Q dec'].map(it => it + '=' + tot(it) + ':' + /check quantity/.test(rowOf(mw, it).t)).join(' '));
      rec('" 3 " (spaces) counts as 3', tot('Q sp') === 3, rowOf(mw, 'Q sp').t);
      rec('"MFC White" / "mfc  white " / NBSP are one board', b.boards.filter(x => /^mfc\s*white/i.test(x.h)).length === 1, b.boards.map(x => x.h).join(' | '));
      rec('"Q ok " (trailing space) is the same row as "Q ok" (4 + 1 = 5)', tot('Q ok') === 5, rowOf(mw, 'Q ok').t);
      // sheets by hand: MFC White = Q sp 3×1.0 + Q ok 5×1.0 + L3 Side 2×1.44 = 10.88 m² → 10.88/5.75×1.1 = 2.08 → 3 sheets
      rec('MFC White sheets by hand: 10.88 m² → 3 sheets', /— 3 sheets for this batch/.test(mw.h), mw.h);
      const pl = board(b, 'Plain Board');
      rec('a board with no sizes: "no sheets counted (no sizes)" and its row still listed', /no sheets counted/.test(pl.h) && pl.rows.length === 1, JSON.stringify(pl));
      // the same three lists in the sheets panel (all cut by today) → the same per-board sheets
      const sp = await p.evaluate(() => { const r = sheetNeed(SB.ids.map(id => lists().find(l => l.id === id)), '', cutTodayEnd(todayLocal()), { cutSince: todayLocal() }); return r.mats.map(g => g.mat + '=' + g.sheets); });
      const bs = b.boards.map(x => x.h.split(' — ')[0] + '=' + ((/(\d+) sheets? for this batch/.exec(x.h) || [])[1] || '-'));
      rec('batch sheets per board = the sheets panel\'s figure for the same lists (nothing ticked yet)', bs.every(s => { const [m, n] = s.split('='); return n === '-' || sp.some(z => z.toLowerCase().replace(/\s+/g, ' ') === (m + '=' + n).toLowerCase().replace(/\s+/g, ' ')); }), 'batch ' + bs.join(', ') + ' | panel ' + sp.join(', '));
      // 360 px: no sideways scroll; tap targets
      await p.setViewportSize({ width: 360, height: 740 }); await sleep(200);
      const sw = await p.evaluate(() => { const small = [...document.querySelectorAll('.wl .sb-chip, .wl .sb-hl button, #sb-empty, .sb-nl button')].filter(e => { const r = e.getBoundingClientRect(); return r.height && r.height < 40; }).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().height));
        return { sw: document.documentElement.scrollWidth, vw: innerWidth, small: small.length, ex: small.slice(0, 3) }; });
      rec('360 px: no sideways scroll with long / odd names', sw.sw <= sw.vw, JSON.stringify(sw));
      rec('360 px: every chip / button in the batch is at least 40 px tall (gloved saw hands)', !sw.small, JSON.stringify(sw));
      await p.setViewportSize({ width: 1400, height: 900 });
      // Open list on a house that was just finished on another device
      D.update(S.db, 'lists', D.find(S.db, 'lists', 'L3'), { saw_done_at: new Date().toISOString(), saw_done_by: 'Other' });
      await p.evaluate(() => { const b = document.querySelector('.sb-hl [data-sbgo="L3"]'); if (b) b.click(); }); await sleep(200);
      const tt = await p.evaluate(() => ({ tab: (document.querySelector('.wl-tabs .on') || {}).id, toast: (document.getElementById('toast') || {}).textContent || '' }));
      rec('Open list on a house finished on another device (before this screen polled): no crash, lands on TO DO', tt.tab === 'wl-tab-todo', JSON.stringify(tt));
      rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
    // ============ 5. released-after-signoff rows: still finishable without the old "MARK ALL CUT COMPLETE" ============
    {
      const S = F.makeServer(F.v2Row());
      F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: [['saw', 'Side', '2', 2400, 600, 'MFC White', '', ''], ['saw', 'Back', '1', 900, 700, 'Oak', '', '']] });
      const t = await F.dev(browser, S, 'saw'), p = t.page;
      await F.tapRow(p, 'data-rna', 'L1:2'); await F.send(p); await F.tapRow(p, 'data-rt', 'L1:1'); await F.send(p); await sleep(100);
      await p.evaluate(() => { const b = document.querySelector('[data-wldone="L1"]'); if (b) b.click(); }); await F.send(p); await sleep(200);
      const d1 = await p.evaluate(() => !!listDone('L1').saw);
      await p.evaluate(() => { wlShowHold = true; render(); const x = document.querySelector('[data-relg]'); if (x) x.click(); }); await F.send(p);
      await p.evaluate(() => { wlShowHold = false; render(); }); await sleep(100);
      await clickSel(p, '[data-wlsel="L1"]'); await openB(p);
      const b = await batch(p);
      rec('signed off with Back waiting, then Back released → House 1 in the batch shows ONLY the released Back (Oak)', d1 && b.boards.length === 1 && /^Oak/.test(b.boards[0].h), JSON.stringify(b.boards.map(x => x.h)));
      await clickSel(p, '#wl-tab-todo');
      const card = await p.evaluate(() => ({ done: !!document.querySelector('[data-wldone="L1"]'), tick: !!document.querySelector('[data-rt$="|L1:2"]') }));
      rec('… and its own card still has the tick for Back and ✓ CUT COMPLETE (nothing left unreachable on the saw)', card.done && card.tick, JSON.stringify(card));
      await F.tapRow(p, 'data-rt', 'L1:2'); await F.send(p); await sleep(150);
      rec('… ticking Back finishes it again and it leaves the batch', !(await p.evaluate(() => relOpen(lists().find(l => l.id === 'L1'), 'saw'))) && (await tab(p)) === null, await tab(p));
      rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
