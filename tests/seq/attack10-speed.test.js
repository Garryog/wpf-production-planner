// attack10 (Tester): the pre-production pool at size (~2,000 jobs / 300 lists / ~1,000 sequence rows), the drag guard getting
// stuck "armed", and a 360 px phone with very long names. Fake Supabase only. Run: node tests/seq/attack10-speed.test.js
// Expected FAILS at 29932fd (Tester findings): D2/D3 (no dragend → PREV.drag stuck, every merge redraw held off), P1/P2 (filter
// selects with long names → 1,689 px sideways scroll at 360 px), P3 ("Not you?" 21 px — pre-existing seqMeStrip). Parts: speed|drag|phone
const { X, NOW11, poolRow, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
const SECTION = process.argv[2] || '';
const want = s => !SECTION || SECTION === s;
const iso = d => new Date(Date.UTC(2026, 9, 1) + d * 864e5).toISOString().slice(0, 10);

(async () => {
  const browser = await H.chromium.launch();

  if (want('speed')) {
    const row = poolRow();
    const NP = 20;
    for (let i = 0; i < 2000; i++) {
      const p = i % NP, due = iso(20 + (i % 70)); // 21 Oct … 29 Dec
      row.orders.push(H.order({ wo: 'WO-' + (5000 + i), customer: 'Builder ' + p, dueDate: due, origDueDate: due, plannedWeek: '', floor: 'F' + (i % 9), unit: String(i), title: 'HOUSE TYPE ' + (i % 13) + ' KITCHEN', step: i % 7 === 0 ? '5. WORK ORDER PROCESSED' : '3. In production' }));
    }
    const S = makePool({ row });
    for (let p = 0; p < NP; p++) X.D.insert(S.db, 'projects', { id: 'PB' + p, name: 'Big ' + p, customer: 'Builder ' + p, cien_names: ['Builder ' + p], pms: ['PM ' + (p % 5)] });
    let pos = 0;
    for (let i = 0; i < 2000; i += 2) { X.seqRow(S, 'QB' + i, 'PB' + (i % NP), { wo: 'WO-' + (5000 + i) }); pos++; }
    for (let l = 0; l < 300; l++) {
      const wosL = [0, 1, 2, 3, 4, 5].map(k => 'WO-' + (5000 + l * 6 + k));
      X.D.insert(S.db, 'lists', { id: 'LB' + l, project_id: 'PB' + (l % NP), name: 'List ' + l, wos: wosL, n_saw: 3, n_fit: 1, created_at: '2026-10-20T08:00:00.000Z' });
      [['saw', 'Side', 'MFC White'], ['saw', 'Top', 'Oak ' + (l % 4)], ['saw', 'Back', 'HDF'], ['fit', 'Hinge', 'Blum']].forEach((x, i) =>
        X.D.insert(S.db, 'list_lines', { id: 'LB' + l + ':' + i, list_id: 'LB' + l, seq: i + 1, kind: x[0], part: x[1], qty: '2', length_mm: 700, width_mm: 500, material: x[2], status: l % 10 === 0 && i === 0 ? 'cut' : 'todo' }));
    }
    for (let i = 0; i < 400; i++) X.DS.preWrite(S.db, null, { seq_id: 'QB' + (i * 2), wo: 'WO-' + (5000 + i * 2), processed: i % 3 === 0, pre_key: i % 5 === 0 ? 20760 + i / 10 : null, updated_by: 'Johnny' });
    const a = await pre(browser, S);
    await sleep(1500);
    const t = await a.page.evaluate(() => {
      const m = f => { const t0 = performance.now(); f(); return Math.round(performance.now() - t0); };
      const out = { rows: preRows().length, shown: document.querySelectorAll('#pre-pool tr[data-prer]').length };
      out.render = [m(render), m(render), m(render)];
      PREV.proc = 'all'; out.renderAll = m(render);
      out.preRows = m(() => preRows());
      out.woCut2000 = m(() => DB.orders.forEach(o => woCut(o)));
      PREV.mat = 'mfc white'; out.matFilter = m(render); PREV.mat = '';
      out.cien = m(() => preCienRows());
      return out;
    });
    rec('S1 size: ~2,000 jobs / 300 lists / 1,000 seq rows loaded', t.rows > 500, JSON.stringify(t));
    rec('S2 pool redraw under 1 s (PC) with 2,000 jobs (worst of 3: ' + Math.max(...t.render) + ' ms; All: ' + t.renderAll + ' ms)', Math.max(...t.render, t.renderAll) < 1000, JSON.stringify(t));
    rec('S3 Material filter redraw under 1 s (' + t.matFilter + ' ms)', t.matFilter < 1000, JSON.stringify(t));
    // a tick at this size: time from click to redrawn
    const tk = await a.page.evaluate(async () => { PREV.proc = 'not'; render(); const b = document.querySelector('[data-pretick]'); const k = b.dataset.pretick; const t0 = performance.now(); await preTick(k); return { k, ms: Math.round(performance.now() - t0) }; });
    rec('S4 a tick round trip incl. redraw under 1.5 s (' + tk.ms + ' ms)', tk.ms < 1500, JSON.stringify(tk));
    // # Move to at this size: preRows() runs again for the prompt — fine — but the click must not hang
    const mv = await a.page.evaluate(async () => { const b = [...document.querySelectorAll('[data-preto]')][5]; window.prompt = () => '1'; const t0 = performance.now(); b.click(); await new Promise(r => setTimeout(r, 1500)); return Math.round(performance.now() - t0); });
    rec('S5 # Move to at this size: done (no hang)', mv < 4000, mv + ' ms');
    // the Export Changes screen at this size
    const off = await X.dev(browser, S, 'office', { now: NOW11 });
    const ex = await off.page.evaluate(() => { const t0 = performance.now(); showTab('x'); return { ms: Math.round(performance.now() - t0), n: (document.getElementById('pre-exp') || { innerText: '' }).innerText.split('\n').length }; });
    rec('S6 Export Changes with ~270 processed lines under 1.5 s (' + ex.ms + ' ms)', ex.ms < 1500, JSON.stringify(ex));
    rec('speed: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await off.close();
  }

  if (want('drag')) {
    const S = makePool();
    const a = await pre(browser, S);
    // real mouse drag (Chromium drag-and-drop through Playwright) of WO-10 dropped OUTSIDE the table
    const src = a.page.locator('#pre-pool tr[data-prer="W:WO-10"] td.seq-hd');
    await src.dragTo(a.page.locator('#pre-strip'));
    await sleep(300);
    const d1 = await a.page.evaluate(() => PREV.drag);
    rec('D1 real drag dropped outside the table: guard disarmed', d1 === '', JSON.stringify(d1));
    // real mouse: press on the handle, move, Escape, release
    const bb = await src.boundingBox();
    await a.page.mouse.move(bb.x + 5, bb.y + 5); await a.page.mouse.down(); await a.page.mouse.move(bb.x + 40, bb.y + 80, { steps: 5 });
    const mid = await a.page.evaluate(() => PREV.drag);
    await a.page.keyboard.press('Escape'); await a.page.mouse.up(); await sleep(300);
    const d1b = await a.page.evaluate(() => PREV.drag);
    rec('D1b real drag + Escape: guard disarmed afterwards', d1b === '', 'during=' + mid + ' after=' + d1b);
    await a.page.evaluate(() => render());
    // synthetic: dragstart, then Escape, with NO dragend (what a touch screen / a cancelled OS drag can leave behind)
    await a.page.evaluate(() => { const tr = document.querySelector('#pre-pool tr[data-prer="W:WO-10"]'); tr.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    await sleep(200);
    const armed = await a.page.evaluate(() => PREV.drag);
    // another PC changes something; the poll comes in — is the pool (and every other screen) frozen?
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { name: 'Aderrig RENAMED' });
    await a.page.evaluate(async () => { await lsPoll(); }); await sleep(400);
    const shows = await a.page.evaluate(() => /RENAMED/.test(document.getElementById('app').innerText));
    rec('D2 a drag start with no dragend (Escape / lost event): the guard does not freeze refreshes for good', armed === '' || shows, 'PREV.drag=' + armed + ' renamed shown=' + shows);
    // and after switching to the Cutting lists tab — still frozen?
    await a.page.evaluate(() => { document.querySelector('[data-pretab="lists"]').click(); }); await sleep(300);
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { name: 'Aderrig AGAIN' });
    await a.page.evaluate(async () => { await lsPoll(); }); await sleep(400);
    const shows2 = await a.page.evaluate(() => ({ drag: PREV.drag, again: /AGAIN/.test(document.getElementById('app').innerText) }));
    rec('D3 … on another tab (Cutting lists) the poll still redraws', shows2.drag === '' || shows2.again, JSON.stringify(shows2));
    rec('drag: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  }

  if (want('phone')) {
    const L = 'X'.repeat(140), W = 'Very long material name without any breaks '.repeat(5);
    const row = poolRow();
    row.orders.push(H.order({ wo: 'WO-2026-123456789-LONG-NUMBER', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24', plannedWeek: '', floor: 'FLOOR' + L, unit: 'UNIT' + L, title: L + ' ' + L, sheetsCien: 12345678901234 }));
    const S = makePool({ row });
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { name: 'Project' + L, pms: ['Firstname' + L, 'John Burke'] });
    X.seqRow(S, 'QL', 'P1', { wo: 'WO-2026-123456789-LONG-NUMBER' });
    X.F3.seedList(S, 'LL', { wos: ['WO-2026-123456789-LONG-NUMBER'], name: 'House L', lines: [['saw', 'Side', '2', 720, 560, W, '', ''], ['saw', 'Top', '2', 720, 560, 'M' + L, '', '']] });
    X.DS.preWrite(S.db, null, { seq_id: 'Q12', wo: 'WO-12', processed: true, pre_key: 1, updated_by: 'Johnny' + L, processed_by: 'Johnny' + L });
    const ph = await pre(browser, S, { viewport: { width: 360, height: 740 } });
    await ph.page.evaluate(() => { PREV.open = true; PREV.proc = 'all'; DB.orders.find(o => o.wo === 'WO-10').dueDate = '2026-11-30'; render(); }); await sleep(300);
    const m = await ph.page.evaluate(() => {
      const vis = [...document.querySelectorAll('#app button, #app select, #app summary')].filter(b => b.offsetParent && b.closest('#pre-pool, #pre-strip'));
      const small = vis.map(b => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.id).trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width), right: Math.round(r.right) }; }).filter(x => x.h < 36);
      const over = [...document.querySelectorAll('#pre-pool *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)).slice(0, 6);
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth, small, over };
    });
    rec('P1 360 px with 140-char names / long WO / long materials / long PM: no sideways scroll', m.sw <= m.cw && m.bw <= m.cw, JSON.stringify({ sw: m.sw, cw: m.cw, bw: m.bw }));
    rec('P2 360 px: nothing in the pool sticks out past the right edge', !m.over.length, JSON.stringify(m.over));
    rec('P3 360 px: EVERY pool button / select (tick, un-tick ↺, ▲▼, Move to, Not/Processed/All, Seen all, Back to due-date order, ↻ changed, filters) ≥ 36 px tall', !m.small.length, JSON.stringify(m.small));
    rec('phone: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await ph.close();
  }

  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
