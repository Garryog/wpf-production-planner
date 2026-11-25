// attack11 (Tester): re-attack of the attack10 fixes on Johnny's pool (690065e, d7625ce, bf82ce6, b27642b).
// Same-prefix project names on one day, P-number merge carry (both ticked / both placed / only the P row ticked), a drag longer
// than the 30 s guard, the 1e-9 "no room" guard, a lost reply when another screen changed the row. Fake Supabase only.
// Run: node tests/seq/attack11-pool.test.js [prefix|carry|drag|room|lost]
// Expected FAILS at a8e4b60 (Tester findings): A1b (same 3-letter prefix projects interleave by PM position), L2 (drop after the 30 s
// guard expiry + a redraw is silently ignored), X1 (lost tick reply re-read as "saved" when ANOTHER screen ticked it).
const { X, NOW11, poolRow, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
const toasts = p => p.evaluate(() => { window.__t = []; const T = window.toast; window.toast = (m, s) => { window.__t.push(String(m)); try { T(m, s); } catch (e) {} }; });
const allToasts = p => p.evaluate(() => (window.__t || []).join(' | '));
const order = o => H.order(Object.assign({ floor: 'T1', plannedWeek: '' }, o));
const SECTION = process.argv[2] || '';
const want = s => !SECTION || SECTION === s;

(async () => {
  const browser = await H.chromium.launch();

  // ---- two projects sharing the first 3 letters, same due day
  if (want('prefix')) {
    const row = poolRow();
    const D = '2026-11-27';
    ['WO-71', 'WO-72', 'WO-73'].forEach(w => row.orders.push(order({ wo: w, customer: 'Aderrig Homes', dueDate: D, origDueDate: D })));
    ['WO-81', 'WO-82', 'WO-83'].forEach(w => row.orders.push(order({ wo: w, customer: 'Aderrig Park Ltd', dueDate: D, origDueDate: D })));
    const S = makePool({ row });
    X.D.insert(S.db, 'projects', { id: 'P3', name: 'Aderrig Park', customer: 'Aderrig Park Ltd', cien_names: ['Aderrig Park Ltd'], pms: ['Mary Kelly'] });
    X.seqRow(S, 'Q71', 'P1', { wo: 'WO-71' }); X.seqRow(S, 'Q72', 'P1', { wo: 'WO-72' }); X.seqRow(S, 'Q73', 'P1', { wo: 'WO-73' }); // Aderrig pos 6,7,8
    X.seqRow(S, 'Q81', 'P3', { wo: 'WO-81' }); X.seqRow(S, 'Q82', 'P3', { wo: 'WO-82' }); X.seqRow(S, 'Q83', 'P3', { wo: 'WO-83' }); // Aderrig Park pos 1,2,3
    const a = await pre(browser, S); await toasts(a.page);
    let r = (await pool(a.page)).filter(x => /WO-[78]\d/.test(x.wo));
    rec('A1 same day, "Aderrig" and "Aderrig Park": default order keeps each project together (due → project → PM position)', /^WO-71,WO-72,WO-73,WO-81,WO-82,WO-83$|^WO-81,WO-82,WO-83,WO-71,WO-72,WO-73$/.test(wos(r)), wos(r));
    // A1b: a third project "Aderrig North" with the SAME PM positions (1,2,3) as Aderrig Park
    X.D.insert(S.db, 'projects', { id: 'P4', name: 'Aderrig North', customer: 'Aderrig North Ltd', cien_names: ['Aderrig North Ltd'], pms: ['Mary Kelly'] });
    ['WO-61', 'WO-62', 'WO-63'].forEach(w => X.seqRow(S, 'Q' + w.slice(3), 'P4', { wo: w }));
    await a.page.evaluate(async () => { const b = DB.orders.find(o => o.wo === 'WO-71'); ['WO-61', 'WO-62', 'WO-63'].forEach(w => DB.orders.push(Object.assign({}, b, { wo: w, customer: 'Aderrig North Ltd' }))); await lsPoll(); render(); }); await sleep(300);
    const r1b = (await pool(a.page)).filter(x => /WO-[68]\d/.test(x.wo));
    // (Coder, attack11 fix) which of two same-day projects with the same first letters comes first is fixed but not alphabetical
    // (a stable hash of the whole name — one number per row can't hold the full name); the check is that each stays together
    rec('A1b "Aderrig North" and "Aderrig Park" both at PM positions 1-3 on one day: each project kept together, not interleaved', /^(WO-61,WO-62,WO-63,WO-81,WO-82,WO-83|WO-81,WO-82,WO-83,WO-61,WO-62,WO-63)$/.test(wos(r1b)), wos(r1b));
    await a.page.evaluate(async () => { DB.orders = DB.orders.filter(o => !/^WO-6\d$/.test(o.wo)); render(); });
    const oos = (await pool(a.page)).filter(x => /OUT OF STEP/.test(x.flags)).map(x => x.wo);
    rec('A2 default order never OUT OF STEP', !oos.length, oos.join());
    // Johnny puts WO-10 (2 Dec) between WO-72 and WO-73; new WOs for both projects arrive that day → still between them
    const all = await pool(a.page); const at = all.find(x => x.wo === 'WO-73').my;
    await a.page.evaluate(n => { window.prompt = () => String(n); document.querySelector('[data-preto="W:WO-10"]').click(); }, at); await sleep(700);
    r = await pool(a.page);
    rec('A3 WO-10 placed between WO-72 and WO-73', /WO-72,WO-10,WO-73/.test(wos(r)), wos(r));
    X.seqRow(S, 'Q84', 'P3', { wo: 'WO-84' }); X.seqRow(S, 'Q74', 'P1', { wo: 'WO-74' });
    await a.page.evaluate(async () => { const b = DB.orders.find(o => o.wo === 'WO-71'); DB.orders.push(Object.assign({}, b, { wo: 'WO-74' }), Object.assign({}, b, { wo: 'WO-84', customer: 'Aderrig Park Ltd' }), Object.assign({}, b, { wo: 'WO-90', customer: 'Nobody Ltd' }), Object.assign({}, b, { wo: 'WO-91', customer: 'Ader Ltd' })); await lsPoll(); render(); }); await sleep(300);
    r = await pool(a.page);
    rec('A4 new same-day WOs for both projects (+ no project, + an "Ader…" customer): WO-10 still between WO-72 and WO-73', /WO-72,WO-10,WO-73/.test(wos(r)), wos(r));
    // PM renames the project (first letters change) → never-moved rows move with it, the moved row stays put
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { name: 'Zed Aderrig' });
    await a.page.evaluate(async () => { await lsPoll(); render(); }); await sleep(300);
    r = await pool(a.page);
    rec('A5 project renamed "Zed …" (documenting): where WO-10 ends up relative to its old neighbours', true, wos(r).split(',').filter(w => /WO-[78]\d|WO-10/.test(w)).join(','));
    rec('prefix: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  }

  // ---- P-number merge carry
  if (want('carry')) {
    const cases = [
      { n: 'C1 both rows ticked (P older)', pOld: true, P: { processed: true, processed_by: 'Johnny' }, W: { processed: true, processed_by: 'Mary' }, expect: s => s.processed },
      { n: 'C2 both rows placed (P older): the WO row\'s place wins', pOld: true, P: { pre_key: 5 }, W: { pre_key: 1 }, expect: s => +s.pre_key === 1 },
      { n: 'C3 only the P row ticked + placed, WO row older (P row retired)', pOld: false, P: { processed: true, processed_by: 'Johnny', pre_key: 1 }, W: null, expect: s => s.processed && +s.pre_key === 1 },
      { n: 'C4 P row ticked, WO row placed only, WO older: tick AND WO place kept', pOld: false, P: { processed: true, processed_by: 'Johnny', pre_key: 7 }, W: { pre_key: 1 }, expect: s => s.processed && +s.pre_key === 1 },
      { n: 'C5 WO row un-ticked with a reason after the P row was ticked (P older, WO row retired): tick not resurrected? (documenting)', pOld: true, P: null, W: { processed: false, note: 'Files need redoing', pre_key: 2 }, expect: s => !s || !s.processed },
    ];
    for (const c of cases) {
      const row = poolRow(); row.orders.push(order({ wo: 'P-3003', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24' }), order({ wo: 'WO-55', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24' }));
      const S = makePool({ row });
      X.seqRow(S, 'QP3', 'P1', { wo: 'P-3003' }); X.seqRow(S, 'Q55', 'P1', { wo: 'WO-55' });
      S.db.t.project_seq.find(x => x.id === 'QP3').created_at = c.pOld ? '2026-11-01T10:00:00Z' : '2026-11-06T10:00:00Z';
      S.db.t.project_seq.find(x => x.id === 'Q55').created_at = c.pOld ? '2026-11-05T10:00:00Z' : '2026-11-02T10:00:00Z';
      if (c.P) X.DS.preWrite(S.db, null, Object.assign({ seq_id: 'QP3', wo: 'P-3003', updated_by: 'Johnny' }, c.P));
      if (c.W) X.DS.preWrite(S.db, null, Object.assign({ seq_id: 'Q55', wo: 'WO-55', updated_by: 'Johnny' }, c.W));
      const off = await X.dev(browser, S, 'office', { now: NOW11 });
      const out = await off.page.evaluate(async () => pMergeSeq('P-3003', 'WO-55', 'Office'));
      const kept = S.db.t.project_seq.find(x => x.wo === 'WO-55' && x.state !== 'removed');
      const sp = kept && S.db.t.seq_pre.find(x => x.seq_id === kept.id);
      rec(c.n, !!kept && c.expect(sp || {}), JSON.stringify(out) + ' kept=' + (kept && kept.id) + ' seq_pre=' + JSON.stringify(S.db.t.seq_pre.map(x => [x.seq_id, x.processed, x.processed_by, x.pre_key, x.note])));
      if (c.n.startsWith('C1')) rec('C1 the carried tick keeps "processed by" a real person', !!sp && /Johnny|Mary/.test(sp.processed_by || ''), JSON.stringify(sp));
      rec(c.n.slice(0, 2) + ' no page errors, no project_seq PATCH outside the seq RPCs', !(S.errors || []).length && !S.log.some(x => /^(POST|PATCH) \/project_seq/.test(x)), JSON.stringify(S.errors));
      await off.close();
    }
  }

  // ---- a drag longer than the 30 s guard
  if (want('drag')) {
    const S = makePool();
    const a = await pre(browser, S); await toasts(a.page);
    const res = await a.page.evaluate(async () => {
      const tr = document.querySelector('#pre-pool tr[data-prer="W:WO-10"]'), dt = new DataTransfer();
      tr.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      PREV.dragAt = Date.now() - 31000; // the drag has lasted 31 s
      const mark = document.getElementById('pre-pool'); mark.dataset.mark = '1';
      mergedRender(); // a poll / merge arrives
      const redrawn = !document.querySelector('#pre-pool[data-mark="1"]');
      const dst = document.querySelector('#pre-pool tr[data-prer]'); // the (new) top row
      dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise(r => setTimeout(r, 800));
      return { redrawn, drag: PREV.drag, first: document.querySelector('#pre-pool tr[data-prer]').dataset.prer };
    });
    const msg = await allToasts(a.page);
    rec('L1 drag > 30 s, a merge redraws mid-drag (documenting: redrawn=' + res.redrawn + ')', true, JSON.stringify(res));
    rec('L2 … the drop still moves WO-10 to the top, or Johnny is told to drag again (never silently lost)', res.first === 'W:WO-10' || /drag|again|try/i.test(msg), JSON.stringify(res) + ' toasts=' + msg);
    rec('L3 … nothing half-written (seq_pre only, at most one row)', S.db.t.seq_pre.length <= 1 && !S.log.some(x => /^(POST|PATCH) \/(project_seq|rpc)/.test(x)), JSON.stringify(S.db.t.seq_pre));
    rec('drag: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  }

  // ---- the 1e-9 no-room guard
  if (want('room')) {
    const S = makePool();
    const a = await pre(browser, S); await toasts(a.page);
    let n = 0, refused = false;
    for (; n < 120 && !refused; n++) {
      await a.page.evaluate(k => { window.__t = []; return preMove(k, { to: 2 }); }, n % 2 ? 'W:WO-1' : 'W:WO-12'); await sleep(40);
      const t = await allToasts(a.page); refused = /No room/.test(t);
      if (/Not moved/.test(t)) { rec('R0 unexpected write failure at move ' + n, false, t); break; }
    }
    const keys = S.db.t.seq_pre.filter(x => x.pre_key != null).map(x => x.pre_key);
    const r = await pool(a.page);
    rec('R1 repeated moves into one gap end in "No room" (n=' + n + ')', refused, 'moves=' + n);
    rec('R2 stored keys all distinct and the order on screen is the order the keys say', new Set(keys).size === keys.length && r.every((x, i) => i === 0 || x.my > r[i - 1].my), JSON.stringify(keys));
    // the last allowed move really put the row where he asked (no float collapse: midpoint strictly between neighbours)
    const k = await a.page.evaluate(() => { const L = preRows(); return L.slice(0, 4).map(x => [x.k, x.key]); });
    rec('R3 the top rows\' keys strictly increase (no two rows share a key after ' + n + ' moves)', k.every((x, i) => i === 0 || x[1] > k[i - 1][1]), JSON.stringify(k));
    // a never-moved neighbour pair: rows of one project on one day are ~1.6e-8 apart — how many moves fit between them?
    const row = poolRow(); ['WO-71', 'WO-72', 'WO-73', 'WO-74'].forEach(w => row.orders.push(order({ wo: w, customer: 'Aderrig Homes', dueDate: '2026-11-27', origDueDate: '2026-11-27' })));
    const S2 = makePool({ row }); ['71', '72', '73', '74'].forEach(w => X.seqRow(S2, 'Q' + w, 'P1', { wo: 'WO-' + w }));
    const b = await pre(browser, S2); await toasts(b.page);
    let m = 0, ref2 = false;
    for (; m < 60 && !ref2; m++) {
      const at = (await pool(b.page)).find(x => x.wo === 'WO-72').my + 1; // straight after WO-72
      await b.page.evaluate(({ k, at }) => { window.__t = []; return preMove(k, { to: at }); }, { k: m % 2 ? 'W:WO-73' : 'W:WO-10', at }); await sleep(40);
      ref2 = /No room/.test(await allToasts(b.page));
    }
    rec('R4 between two never-moved rows of one project on one day: at least 5 moves fit before "No room" (got ' + m + ')', m >= 5, 'moves=' + m);
    rec('room: no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
    await a.close(); await b.close();
  }

  // ---- lost reply when another screen changed the row meanwhile
  if (want('lost')) {
    const S = makePool();
    const a = await pre(browser, S), b = await pre(browser, S); await toasts(a.page); await toasts(b.page);
    // L-a: A's tick never reaches the database (connection dies on the way); meanwhile B ticks the same row
    await a.page.route('**/rest/v1/seq_pre*', async route => {
      if (route.request().method() === 'POST' && !a.__dropped) { a.__dropped = 1; X.DS.preWrite(S.db, null, { seq_id: 'Q12', wo: 'WO-12', processed: true, processed_by: 'Mary', updated_by: 'Mary' }); return route.abort('connectionreset'); }
      return route.fallback();
    });
    await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-12"]').click()); await sleep(900);
    const ta = await allToasts(a.page);
    rec('X1 A\'s tick never landed, B (Mary) ticked meanwhile: A is NOT told "✓ processed" as if his own tick saved', !/✓ WO-12 processed/.test(ta), ta + ' | db=' + JSON.stringify(S.db.t.seq_pre.map(x => [x.seq_id, x.processed_by, x.version])));
    // L-b: A un-ticks with a reason; the PATCH dies before landing; B un-ticked meanwhile with ANOTHER reason → must be "not saved"
    await a.page.unroute('**/rest/v1/seq_pre*');
    X.DS.preWrite(S.db, S.db.t.seq_pre.find(x => x.seq_id === 'Q12'), { processed: true, updated_by: 'Johnny' });
    await a.page.evaluate(async () => { await lsPoll(); PREV.proc = 'all'; render(); window.__t = []; }); await sleep(300);
    await a.page.route('**/rest/v1/seq_pre*', async route => {
      if (route.request().method() === 'PATCH') { X.DS.preWrite(S.db, S.db.t.seq_pre.find(x => x.seq_id === 'Q12'), { processed: false, note: 'Ticked by mistake', updated_by: 'Mary' }); return route.abort('connectionreset'); }
      return route.fallback();
    });
    await a.page.evaluate(() => { document.querySelector('[data-preuntick="W:WO-12"]').click(); document.querySelector('.pod-ovl [data-why="Files need redoing"]').click(); }); await sleep(900);
    const tb = await allToasts(a.page);
    rec('X2 A\'s un-tick ("Files need redoing") lost, B un-ticked meanwhile ("Ticked by mistake"): A told NOT saved', /Not saved/.test(tb) && !/un-ticked — Files/.test(tb), tb);
    // L-c: A moves (PATCH dies); B moved the same row meanwhile to a DIFFERENT place → not saved
    await a.page.unroute('**/rest/v1/seq_pre*');
    await a.page.evaluate(async () => { await lsPoll(); render(); window.__t = []; }); await sleep(300);
    await a.page.route('**/rest/v1/seq_pre*', async route => {
      if (route.request().method() === 'PATCH') { X.DS.preWrite(S.db, S.db.t.seq_pre.find(x => x.seq_id === 'Q12'), { pre_key: 99999, updated_by: 'Mary' }); return route.abort('connectionreset'); }
      return route.fallback();
    });
    await a.page.evaluate(() => preMove('W:WO-12', { to: 1 })); await sleep(900);
    const tc = await allToasts(a.page);
    rec('X3 A\'s move lost, B moved the row elsewhere meanwhile: A told "Not moved", screen shows B\'s place', /Not moved/.test(tc) && (await pool(a.page)).slice(-1)[0].wo === 'WO-12', tc + ' ' + wos(await pool(a.page)));
    rec('lost: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await b.close();
  }

  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
