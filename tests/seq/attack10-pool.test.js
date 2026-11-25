// attack10 (Tester): try to BREAK Johnny's pre-production pool (B9, docs/PLAN-project-details.md Part 5).
// Two screens racing on seq_pre, Johnny's order under new rows / tiny gaps, "changed since", horizon and cut-by edges,
// leaving the pool, Export Changes, the request log (no PM sequence / planner writes), escaping, lists OFF.
// Fake Supabase only (tests/seq/srvs.js). Run: node tests/seq/attack10-pool.test.js
// attack10 findings all fixed at a8e4b60 (re-run: 0 failed).
const { X, NOW11, poolRow, makePool, pre, pool, wos } = require('./b9fix.js');
const { H, rec, sleep } = X;
const toasts = p => p.evaluate(() => { window.__t = []; const T = window.toast; window.toast = (m, s) => { window.__t.push(String(m)); try { T(m, s); } catch (e) {} }; });
const lastToast = p => p.evaluate(() => (window.__t || []).slice(-1)[0] || '');
const allToasts = p => p.evaluate(() => (window.__t || []).join(' | '));
const seqSnap = S => JSON.stringify(S.db.t.project_seq.map(r => [r.id, r.pos, r.version, r.state, r.wo, r.req_date]));
const poll = p => p.evaluate(async () => { await lsPoll(); render(); });
const setAll = p => p.evaluate(() => { PREV.proc = 'all'; render(); });
const order = o => (H.order(Object.assign({ floor: 'T1', plannedWeek: '' }, o)));
const SECTION = process.argv[2] || '';
const want = s => !SECTION || SECTION === s;

(async () => {
  const browser = await H.chromium.launch();

  // ===================== 1. two Johnny screens at once =====================
  if (want('race')) {
    const S = makePool();
    const a = await pre(browser, S), b = await pre(browser, S);
    await toasts(a.page); await toasts(b.page);
    // 1a. first-ever write on Q10 from both screens: A moves WO-10 (POST), B ticks WO-10 (POST) from its stale view
    await a.page.evaluate(() => document.querySelector('[data-preup="W:WO-10"]').click()); await sleep(600);
    await b.page.evaluate(() => document.querySelector('[data-pretick="W:WO-10"]').click()); await sleep(800);
    const q10 = S.db.t.seq_pre.filter(x => x.seq_id === 'Q10');
    rec('1a move (A) vs tick (B), both first writes: ONE seq_pre row, the move kept', q10.length === 1 && q10[0].pre_key != null, JSON.stringify(q10));
    rec('1a B told "changed on another screen" and reloaded (B now holds the row)', /changed on another screen/.test(await lastToast(b.page)) && await b.page.evaluate(() => !!LST.sp.get('Q10')), await allToasts(b.page));
    rec('1a B\'s tick NOT silently applied (still shows ✓ Processed button to try again)', !q10[0].processed && await b.page.evaluate(() => !!document.querySelector('[data-pretick="W:WO-10"]')));
    await b.page.evaluate(() => document.querySelector('[data-pretick="W:WO-10"]').click()); await sleep(700);
    const q10b = S.db.t.seq_pre.find(x => x.seq_id === 'Q10');
    rec('1a retry on B ticks it and keeps A\'s pre_key', q10b.processed && q10b.pre_key === q10[0].pre_key, JSON.stringify(q10b));
    // 1b. truly simultaneous inserts on Q12 (both requests held at the server, released together)
    let rel; S.holdS = new Promise(r => { rel = r; });
    await Promise.all([a.page.evaluate(() => { document.querySelector('[data-pretick="W:WO-12"]').click(); }), b.page.evaluate(() => { document.querySelector('[data-pretick="W:WO-12"]').click(); })]);
    await sleep(300); S.holdS = null; rel(); await sleep(1000);
    const q12 = S.db.t.seq_pre.filter(x => x.seq_id === 'Q12');
    const ta = await lastToast(a.page), tb = await lastToast(b.page);
    rec('1b two inserts racing: ONE row, ONE "processed" history line', q12.length === 1 && S.db.t.project_events.filter(e => e.entity === 'pre' && e.entity_id === 'Q12' && e.act === 'processed').length === 1, JSON.stringify(q12));
    rec('1b exactly one screen told "changed on another screen", both now show it processed', [ta, tb].filter(t => /changed on another screen/.test(t)).length === 1 && await a.page.evaluate(() => !!(LST.sp.get('Q12') || {}).processed) && await b.page.evaluate(() => !!(LST.sp.get('Q12') || {}).processed), ta + ' || ' + tb);
    // 1c. un-tick (A) vs move (B) on the same row (Q12, both at the same version)
    await a.page.evaluate(() => { PREV.proc = 'all'; render(); }); await b.page.evaluate(() => { PREV.proc = 'all'; render(); });
    await a.page.evaluate(() => { document.querySelector('[data-preuntick="W:WO-12"]').click(); document.querySelector('.pod-ovl [data-why="Ticked by mistake"]').click(); }); await sleep(600);
    await b.page.evaluate(() => preMove('W:WO-12', { to: 1 })); await sleep(700);
    let q = S.db.t.seq_pre.find(x => x.seq_id === 'Q12');
    rec('1c un-tick then a stale move: move refused, un-tick kept, B told', !q.processed && q.pre_key == null && /changed on another screen/.test(await lastToast(b.page)), JSON.stringify(q) + ' ' + await lastToast(b.page));
    await b.page.evaluate(() => preMove('W:WO-12', { to: 1 })); await sleep(700);
    q = S.db.t.seq_pre.find(x => x.seq_id === 'Q12');
    rec('1c B retries the move: lands, row stays un-ticked (no resurrected tick)', !q.processed && q.pre_key != null && (await pool(b.page))[0].wo === 'WO-12', JSON.stringify(q));
    // 1d. offline mid-tick: told, nothing pretends to be saved
    S.offline = true;
    await a.page.evaluate(() => { PREV.proc = 'not'; render(); });
    await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-1"]').click()); await sleep(700);
    S.offline = false;
    rec('1d offline tick: Johnny told "Not saved", the button is back (tap again)', /Not saved/.test(await lastToast(a.page)) && await a.page.evaluate(() => { const b = document.querySelector('[data-pretick="W:WO-1"]'); return !!b && !b.disabled; }), await lastToast(a.page));
    // 1e. the reply is lost but the POST landed (bad Wi-Fi): what does Johnny see, and what happens when he taps again?
    let drop = 1;
    await a.page.route('**/rest/v1/seq_pre*', async route => {
      const req = route.request();
      if (drop && req.method() === 'POST') { drop = 0; const body = JSON.parse(req.postData()); (Array.isArray(body) ? body : [body]).forEach(r => X.DS.preWrite(S.db, null, r)); return route.abort('connectionreset'); }
      return route.fallback();
    });
    await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-1"]').click()); await sleep(700);
    const t1 = await lastToast(a.page);
    const landed = S.db.t.seq_pre.some(x => x.seq_id === 'Q1' && x.processed);
    await a.page.evaluate(() => { const b = document.querySelector('[data-pretick="W:WO-1"]'); if (b) b.click(); }); await sleep(800);
    const t2 = await lastToast(a.page);
    rec('1e reply lost after the tick landed: Johnny is NOT told "Not saved" for a tick that is saved', !(landed && /Not saved/.test(t1)), 'landed=' + landed + ' first toast: ' + t1 + ' | second tap: ' + t2);
    rec('1e … and a second tap does not tell him "changed on another screen" (no other screen exists)', !/changed on another screen/.test(t2), t2);
    rec('race: still no project_seq / rpc writes', !S.log.some(x => /^(POST|PATCH) \/(project_seq|rpc)/.test(x)));
    rec('race: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await b.close();
  }

  // ===================== 2. woProgrammed in the Job A date engine =====================
  if (want('prog')) {
    const S = makePool();
    X.DS.preWrite(S.db, null, { seq_id: 'Q10', wo: 'WO-10', processed: true, processed_by: 'Johnny', updated_by: 'Johnny' });
    const a = await pre(browser, S);
    const r = await a.page.evaluate(() => {
      const o = DB.orders.find(x => x.wo === 'WO-10'); o.plannedWeek = '2026-11-30';
      const o2 = DB.orders.find(x => x.wo === 'WO-12'); o2.plannedWeek = '2026-11-02';
      const f = w => moveDates([w], { due: '2026-12-18' }, { why: 'Production' }, 'T').rows[0].flags;
      return { ticked: f('WO-10'), unticked: f('WO-12') };
    });
    rec('2a date engine: ticked WO-10 (step 3) moved to another week → "programmed" flag; un-ticked WO-12 → none', r.ticked.includes('programmed') && !r.unticked.includes('programmed'), JSON.stringify(r));
    await a.close();
    // lists OFF: exactly as before (step 5 only), even with the tick still in the database
    const row = poolRow(); delete row.settings.listStore; delete row.settings.listStoreAt;
    const S2 = makePool({ row });
    X.DS.preWrite(S2.db, null, { seq_id: 'Q10', wo: 'WO-10', processed: true, processed_by: 'Johnny', updated_by: 'Johnny' });
    const off = await X.dev(browser, S2, 'office', { now: NOW11 });
    const r2 = await off.page.evaluate(() => {
      const g = w => DB.orders.find(x => x.wo === w);
      g('WO-10').plannedWeek = '2026-11-30'; g('WO-16').plannedWeek = '2026-11-23';
      const f = w => moveDates([w], { due: '2026-12-18' }, { why: 'Production' }, 'T').rows[0].flags.includes('programmed');
      return { ticked: f('WO-10'), step5: f('WO-16'), wp: [woProgrammed(g('WO-10')), woProgrammed(g('WO-16')), woProgrammed(null), woProgrammed({ step: '5. WORK ORDER PROCESSED' })] };
    });
    rec('2b lists OFF: ticked WO-10 NOT programmed, step-5 WO-16 programmed (as before B9); null-safe', !r2.ticked && r2.step5 && JSON.stringify(r2.wp) === '[false,true,false,true]', JSON.stringify(r2));
    rec('2b lists OFF: no seq_pre / project_seq traffic at all', !S2.log.some(x => /seq_pre|project_seq/.test(x)), JSON.stringify(S2.log.filter(x => /seq/.test(x)).slice(0, 5)));
    rec('prog: no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
    await off.close();
  }

  // ===================== 3. Johnny's order under pressure =====================
  if (want('order')) {
    // two Aderrig rows due Fri 27 Nov (WO-20 pos 6, WO-21 pos 7)
    const row = poolRow();
    row.orders.push(order({ wo: 'WO-20', customer: 'Aderrig Homes', dueDate: '2026-11-27', origDueDate: '2026-11-27', unit: '20', title: 'H20' }),
      order({ wo: 'WO-21', customer: 'Aderrig Homes', dueDate: '2026-11-27', origDueDate: '2026-11-27', unit: '21', title: 'H21' }));
    const S = makePool({ row });
    X.seqRow(S, 'Q20', 'P1', { wo: 'WO-20' }); X.seqRow(S, 'Q21', 'P1', { wo: 'WO-21' });
    const seq0 = seqSnap(S);
    const a = await pre(browser, S); await toasts(a.page);
    let r = await pool(a.page);
    // 3a. Johnny puts WO-10 straight after WO-20 (between WO-20 and WO-21)
    const at = r.find(x => x.wo === 'WO-21').my;
    await a.page.evaluate(n => { window.prompt = () => String(n); document.querySelector('[data-preto="W:WO-10"]').click(); }, at); await sleep(700);
    r = await pool(a.page);
    rec('3a # Move to: WO-10 sits right after WO-20', /WO-20,WO-10,WO-21/.test(wos(r)), wos(r));
    // new WOs (no project → sort first that day) arrive due the same Friday — Johnny's placed row must not jump above WO-20
    await a.page.evaluate(() => { const b = DB.orders.find(o => o.wo === 'WO-17');
      ['WO-22', 'WO-23'].forEach(w => DB.orders.push(Object.assign({}, b, { wo: w, title: 'NEW ' + w, dueDate: '2026-11-27', origDueDate: '2026-11-27' }))); render(); }); await sleep(200);
    r = await pool(a.page);
    rec('3b two new WOs due the same day arrive: WO-10 STILL right after WO-20 (Johnny\'s order holds)', /WO-20,WO-10/.test(wos(r)), wos(r));
    // 3c. a row on that day leaves the pool (cut) — the moved row should not jump either
    await a.page.evaluate(() => { DB.orders = DB.orders.filter(o => !/^WO-2[23]$/.test(o.wo)); render(); }); await sleep(200);
    r = await pool(a.page);
    rec('3c (setup back) WO-20,WO-10,WO-21', /WO-20,WO-10,WO-21/.test(wos(r)), wos(r));
    await a.page.evaluate(() => { const b = DB.orders.find(o => o.wo === 'WO-17'); DB.orders.push(Object.assign({}, b, { wo: 'WO-24', title: 'NEW', customer: 'Zed Builders', dueDate: '2026-11-27', origDueDate: '2026-11-27' })); render(); }); await sleep(200);
    r = await pool(a.page);
    rec('3d a new WO sorting AFTER Aderrig that day: WO-10 still between WO-20 and WO-21', /WO-20,WO-10,WO-21/.test(wos(r)), wos(r));
    // 3e. repeated moves into the same gap until the 1e-6 guard: alternately put WO-12 and WO-1 at My# 2
    await a.page.evaluate(() => { DB.orders = DB.orders.filter(o => o.wo !== 'WO-24'); render(); });
    let n = 0, refused = false;
    for (; n < 80 && !refused; n++) {
      const k = n % 2 ? 'W:WO-1' : 'W:WO-12';
      await a.page.evaluate(k => { window.__t = []; return preMove(k, { to: 2 }); }, k); await sleep(60);
      refused = /No room/.test(await allToasts(a.page));
      const e = await allToasts(a.page); if (/Not moved/.test(e)) { rec('3e unexpected write failure at move ' + n, false, e); break; }
    }
    const keys = S.db.t.seq_pre.filter(x => x.pre_key != null).map(x => x.pre_key);
    rec('3e repeated moves into one gap end in "No room … Back to due-date order" (not silent, not a crash)', refused && n > 5, 'moves=' + n);
    rec('3e no two stored pre_keys equal (no ambiguous order)', new Set(keys).size === keys.length, JSON.stringify(keys));
    r = await pool(a.page);
    rec('3e after the refusal the list still in a sane order (My# 1..N, unique)', r.every((x, i) => i === 0 || x.my > r[i - 1].my), JSON.stringify(r.map(x => x.my)));
    // 3f. PM changes WO-21's date on another PC while Johnny reorders: no clash, WO-21 "↻ changed"
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), {});
    const pm = await X.dev(browser, S, 'office', { now: NOW11 });
    await pm.page.evaluate(() => { const m = moveDates(['WO-21'], { due: '2026-11-30' }, { why: 'Production' }, 'John Burke'); m.apply(); clearTimeout(saveT); return saveDB(); }); await sleep(800);
    await a.page.evaluate(() => preMove('W:WO-20', { to: 1 })); await sleep(700);
    await a.page.evaluate(async () => { await loadDB(); await lsPoll(); render(); }); await sleep(400);
    r = await pool(a.page);
    const w21 = r.find(x => x.wo === 'WO-21');
    rec('3f PM date change + Johnny move at once: move landed, no clash toast', r[0].wo === 'WO-20' && !/changed on another screen|Not moved/.test(await allToasts(a.page)), wos(r) + ' ' + await allToasts(a.page));
    rec('3f WO-21 shows "↻ changed" (new date 30 Nov)', !!w21 && /changed/.test(w21.flags), JSON.stringify(w21));
    // 3g. ▲ on a row whose neighbour is a no-sequence row (WO-2): passes it; # Move to with a filter on uses the whole pool's My#
    rec('3 the PMs\' sequences untouched by every move', seqSnap(S) === seq0 && !S.log.some(x => /^(POST|PATCH) \/(project_seq|rpc)/.test(x)));
    // 3h. Move to: junk input
    const n0 = S.log.filter(x => /^(POST|PATCH) \/seq_pre/.test(x)).length; let hints = 0;
    for (const v of ['0', '-3', 'abc', '2.5', '']) { await a.page.evaluate(v => { window.__t = []; window.prompt = () => v; document.querySelector('[data-preto]').click(); }, v); await sleep(150); if (/Type a number/.test(await allToasts(a.page))) hints++; }
    rec('3h # Move to with 0 / -3 / abc / 2.5 / empty: refused with a hint, nothing written', hints === 5 && S.log.filter(x => /^(POST|PATCH) \/seq_pre/.test(x)).length === n0, 'hints=' + hints);
    rec('order: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await pm.close();
  }

  // ===================== 4. "changed since" =====================
  if (want('changed')) {
    const row = poolRow(); row.orders.push(order({ wo: 'WO-30', customer: 'Aderrig Homes', dueDate: '2026-11-25', origDueDate: '2026-11-25', unit: '20', title: 'H20' }));
    const S = makePool({ row });
    const a = await pre(browser, S); await toasts(a.page); await setAll(a.page);
    let r = await pool(a.page);
    rec('4a first visit: nothing flagged', !r.some(x => /changed/.test(x.flags)));
    // Johnny moved the waiting row W1 to the top; then the PM matches it to WO-30
    await a.page.evaluate(() => preMove('R:W1', { to: 1 })); await sleep(600);
    X.DS.RPC.seq_match(S.db, { p_id: 'W1', p_wo: 'WO-30', p_expect: null, p_how: 'confirmed', p_by: 'John Burke' });
    await poll(a.page); await sleep(300);
    r = await pool(a.page);
    rec('4b waiting row gets its WO: Johnny\'s place kept (WO-30 on top), now tickable', r[0].wo === 'WO-30' && await a.page.evaluate(() => !!document.querySelector('[data-pretick="W:WO-30"]')), wos(r));
    rec('4b … flagged "↻ changed" (it changed under him)', /changed/.test(r[0].flags), JSON.stringify(r[0]));
    // Start the sequence for a job that had none (WO-2): count how many rows light up
    await a.page.evaluate(() => document.getElementById('pre-seenall') && document.getElementById('pre-seenall').click()); await sleep(200);
    X.seqRow(S, 'Q2', 'P1', { wo: 'WO-2' });
    await poll(a.page); await sleep(300);
    r = await pool(a.page);
    const lit = r.filter(x => /changed/.test(x.flags)).map(x => x.wo);
    rec('4c PM starts the sequence for WO-2: only WO-2 flagged (others unchanged)', lit.join() === 'WO-2', lit.join());
    // corrupted / blocked storage
    await a.page.evaluate(() => { localStorage.setItem('wpfSeen_pre_Johnny', '{not json'); render(); }); await sleep(200);
    r = await pool(a.page);
    rec('4d corrupted seen-JSON: treated as first visit (nothing flagged), no error', !r.some(x => /changed/.test(x.flags)) && !(S.errors || []).length, JSON.stringify(S.errors));
    await a.page.evaluate(() => { localStorage.setItem('wpfSeen_pre_Johnny', '"a string"'); render(); }); await sleep(200);
    await a.page.evaluate(() => { localStorage.setItem('wpfSeen_pre_Johnny', 'null'); render(); }); await sleep(200);
    rec('4d "a string" / null JSON: no errors', !(S.errors || []).length, JSON.stringify(S.errors));
    // storage full: getItem works, setItem throws → change shows, but "Seen all" can't clear it
    await a.page.evaluate(() => { DB.orders.find(o => o.wo === 'WO-10').dueDate = '2026-11-29'; render(); }); await sleep(200);
    const had = /changed/.test(((await pool(a.page)).find(x => x.wo === 'WO-10') || {}).flags);
    await a.page.evaluate(() => { const S0 = window.__S0 = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^wpfSeen_pre_/.test(k)) throw new DOMException('full', 'QuotaExceededError'); return S0.call(this, k, v); }; window.__t = []; const b = document.getElementById('pre-seenall'); if (b) b.click(); });
    await sleep(200);
    const still = /changed/.test(((await pool(a.page)).find(x => x.wo === 'WO-10') || {}).flags);
    rec('4e storage full: "✓ Seen all" either clears the badge or tells Johnny it could not', !(had && still) || /could not|full|storage/i.test(await allToasts(a.page)), 'had=' + had + ' still=' + still + ' toasts=' + await allToasts(a.page));
    await a.page.evaluate(() => { Storage.prototype.setItem = window.__S0; });
    // weeks pick: rows brought in only because he picked more weeks
    await a.page.evaluate(() => { localStorage.setItem('wpfSeen_pre_Johnny', 'x'); render(); localStorage.setItem('wpfPreWks', '5'); render(); }); await sleep(200);
    r = await pool(a.page);
    const nw = r.filter(x => /changed/.test(x.flags)).map(x => x.wo);
    rec('4f picking 5 weeks: the rows that just came into view are NOT all flagged "↻ changed" (nothing changed)', !nw.length, nw.join());
    rec('changed: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  }

  // ===================== 5. horizon / cut-by / calendar edges =====================
  if (want('horizon')) {
    const S = makePool();
    const a = await pre(browser, S);
    const cb = await a.page.evaluate(() => {
      const c = cncCutBy;
      return {
        xmas: [c('2027-01-01'), c('2027-01-02'), c('2027-01-04'), c('2027-01-05'), c('2027-01-02T00:00:00Z')],
        pat: c('2027-03-24'), m3jan28: c('2028-01-10'), bad: [c('2026-02-30'), c('31/12/2026'), c(null), c(undefined), c(20261208)],
        dst: [c('2026-11-01'), c('2027-04-04'), c('2027-03-28'), c('2026-10-25')],
      };
    });
    rec('5a cut-by over Christmas: due 1 Jan → 24 Dec; 2 Jan → 24 Dec; Mon 4 Jan → 24 Dec (28 Dec bank hol); 5 Jan → 29 Dec', JSON.stringify(cb.xmas.slice(0, 4)) === JSON.stringify(['2026-12-24', '2026-12-24', '2026-12-24', '2026-12-29']), JSON.stringify(cb.xmas));
    rec('5a timestamp-shaped due "2027-01-02T00:00:00Z" handled like the date', cb.xmas[4] === '2026-12-24', cb.xmas[4]);
    rec('5b St Patrick\'s: due 24 Mar 2027 → Tue 16 Mar; Mon 3 Jan 2028 hol: due 10 Jan 2028 → Fri 31 Dec 2027', cb.pat === '2027-03-16' && cb.m3jan28 === '2027-12-31', JSON.stringify([cb.pat, cb.m3jan28]));
    rec('5c junk dates → "" (no NaN-NaN, no crash)', cb.bad.every(x => x === '' || /^\d{4}-\d\d-\d\d$/.test(x)) && cb.bad[0] !== 'NaN-NaN-NaN', JSON.stringify(cb.bad));
    rec('5d clocks change (Dublin): due 1 Nov 2026 → Fri 23 Oct; Sun 4 Apr 2027 → Fri 26 Mar; 28 Mar 2027 → Fri 19 Mar; 25 Oct 2026 → Fri 16 Oct', JSON.stringify(cb.dst) === JSON.stringify(['2026-10-23', '2027-03-26', '2027-03-19', '2026-10-16']), JSON.stringify(cb.dst));
    await a.close();
    // same in New York / Auckland time zones (a PC set wrong must not shift a date)
    for (const tz of ['America/New_York', 'Pacific/Auckland']) {
      const t = await H.open({ browser, now: NOW11, row: S.row, tz }); t.page.on('pageerror', e => (S.errors = S.errors || []).push(String(e))); await X.SS.attach(t, S); await t.page.evaluate(() => loadDB());
      const d = await t.page.evaluate(() => [cncCutBy('2026-11-01'), cncCutBy('2027-04-04'), cncCutBy('2027-01-04')]);
      rec('5d ' + tz + ': same cut-by dates', JSON.stringify(d) === JSON.stringify(['2026-10-23', '2027-03-26', '2026-12-24']), JSON.stringify(d));
      await t.close();
    }
    // red starts the DAY AFTER cut-by: WO-10 due Wed 2 Dec → cut-by Wed 25 Nov. Late on 25 Nov: amber; just after midnight 26 Nov: red.
    for (const [now, want] of [['2026-11-25T23:50:00Z', 'amb'], ['2026-11-26T00:05:00Z', 'red']]) {
      const t = await pre(browser, S, { now });
      const w = (await pool(t.page)).find(x => x.wo === 'WO-10');
      rec('5e ' + now + ' (Dublin): WO-10 (cut-by 25 Nov) is ' + want, !!w && new RegExp('pre-' + want).test(w.cls), JSON.stringify(w));
      await t.close();
    }
    // summer time: 31 Mar 2027 23:30 UTC = 1 Apr 00:30 Dublin (IST). Due Wed 7 Apr → cut-by Wed 31 Mar → red on 1 Apr local.
    const row = poolRow(); row.orders.push(order({ wo: 'WO-40', customer: 'Aderrig Homes', dueDate: '2027-04-07', origDueDate: '2027-04-07' }));
    const S3 = makePool({ row });
    const t3 = await pre(browser, S3, { now: '2027-03-31T23:30:00Z' });
    const w40 = (await pool(t3.page)).find(x => x.wo === 'WO-40');
    rec('5f summer time: 00:30 Dublin on 1 Apr 2027 (23:30 UTC 31 Mar) — WO-40 cut-by 31 Mar is red', !!w40 && /pre-red/.test(w40.cls), JSON.stringify(w40));
    await t3.close();
    // horizon: due 2 Dec in / 3 Dec out at 23:59 on 11 Nov too; weeks junk in storage
    const t4 = await pre(browser, S, { now: '2026-11-11T23:59:00Z' });
    let r = await pool(t4.page); await setAll(t4.page); r = await pool(t4.page);
    rec('5g 23:59 Wed 11 Nov: 2 Dec in, 3 Dec out', /WO-10/.test(wos(r)) && !/WO-11/.test(wos(r)), wos(r));
    for (const v of ['13', '99', '-1', 'abc', '4.9', '1']) {
      await t4.page.evaluate(v => { localStorage.setItem('wpfPreWks', v); render(); }, v); await sleep(100);
      const h = await t4.page.evaluate(() => document.querySelector('#pre-pool .seq-h').innerText);
      const ok = v === '4.9' ? /\(4 wks\)/.test(h) : /\(3 wks\)/.test(h);
      rec('5h wpfPreWks "' + v + '" → sane weeks (' + h + ')', ok, h);
    }
    await t4.page.evaluate(() => { localStorage.removeItem('wpfPreWks'); DB.preWks = '4'; render(); });
    rec('5i Settings preWks as text "4" → 3 (seqNumOk wants an integer) — check the Settings box saves a number', await t4.page.evaluate(() => /\(3 wks\)|\(4 wks\)/.test(document.querySelector('#pre-pool .seq-h').innerText)));
    rec('horizon: no page errors', !(S.errors || []).length && !(S3.errors || []).length, JSON.stringify([S.errors, S3.errors]));
    await t4.close();
  }

  // ===================== 6. leaving the pool; P-numbers; no-sequence / waiting rows =====================
  if (want('leave')) {
    const row = poolRow();
    row.orders.push(order({ wo: 'P-1001', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24', title: 'P house' }),
      order({ wo: 'WO-41', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24', delDone: true }),
      order({ wo: 'WO-42', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24', delDelivAt: '2026-11-10T10:00:00Z' }),
      order({ wo: 'WO-43', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24', photoDone: { saw: { at: '2026-11-10T10:00:00Z', by: 'Saw' } } }),
      order({ wo: 'WO-44', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24', step: '12. ARCHIVED' }),
      order({ wo: 'wo-45 ', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24' }),
      order({ wo: 'WO-46', customer: 'Aderrig Homes', dueDate: '', origDueDate: '' }));
    const S = makePool({ row });
    X.seqRow(S, 'QP', 'P1', { wo: 'P-1001' }); X.seqRow(S, 'Q45', 'P1', { wo: 'WO-45' });
    X.F3.seedList(S, 'L46', { wos: ['WO-12'], name: 'House 12', lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', '', { status: 'cut' }]] });
    const a = await pre(browser, S); await toasts(a.page); await setAll(a.page);
    let r = await pool(a.page);
    rec('6a delivered (delDone / delDelivAt), photo-list cut, saw-cut line on its list → not in the pool', !/WO-41|WO-42|WO-43|WO-12/.test(wos(r)), wos(r));
    rec('6b P-number with a sequence row is in the pool and tickable', /P-1001/.test(wos(r)) && await a.page.evaluate(() => !!document.querySelector('[data-pretick="W:P-1001"]')), wos(r));
    rec('6c WO typed "wo-45 " (case / space) matches its sequence row WO-45: listed once, tickable', r.filter(x => /wo-45|WO-45/i.test(x.wo)).length === 1 && await a.page.evaluate(() => !!document.querySelector('[data-pretick="W:WO-45"]')), wos(r));
    rec('6d unknown step "12. ARCHIVED": listed? (documenting)', true, /WO-44/.test(wos(r)) ? 'WO-44 listed as not processed' : 'WO-44 not listed');
    rec('6e no due date → not listed, footer counts it', !/WO-46/.test(wos(r)) && await a.page.evaluate(() => /job(s)? with no due date not listed/.test(document.querySelector('#pre-pool .seq-ft').innerText)));
    await a.page.evaluate(() => document.querySelector('[data-pretick="W:P-1001"]').click()); await sleep(600);
    await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-45"]').click()); await sleep(600);
    const off = await X.dev(browser, S, 'office', { now: NOW11 });
    await off.page.evaluate(() => showTab('x')); await sleep(300);
    const ex = await off.page.evaluate(() => { const e = document.getElementById('pre-exp'); return e ? e.innerText : ''; });
    rec('7a Export Changes: P-1001 left out, WO-45 listed (as Cienapps knows it)', !/P-1001/.test(ex) && /WO-45/i.test(ex), ex.slice(0, 300));
    // 7b. shipped after the tick, on hold after the tick → drop off Export Changes
    await off.page.evaluate(() => { DB.orders.find(o => /wo-45/i.test(o.wo)).cienHold = true; render(); }); await sleep(200);
    rec('7b on hold after the tick: line drops off Export Changes', await off.page.evaluate(() => !document.getElementById('pre-exp')));
    await off.page.evaluate(() => { DB.orders.find(o => /wo-45/i.test(o.wo)).cienHold = false; render(); }); await sleep(200);
    // 7c. Export Changes on a screen with lists OFF must look exactly as before
    await off.close();
    // P-number merged into its WO when BOTH have a sequence row and Johnny ticked the WO's row → tick must survive
    const row2 = poolRow(); row2.orders.push(order({ wo: 'P-2002', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24' }), order({ wo: 'WO-50', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24' }));
    const S2 = makePool({ row: row2 });
    X.seqRow(S2, 'QP2', 'P1', { wo: 'P-2002' }); await sleep(20); X.seqRow(S2, 'Q50', 'P1', { wo: 'WO-50' });
    S2.db.t.project_seq.find(x => x.id === 'QP2').created_at = '2026-11-01T10:00:00Z'; S2.db.t.project_seq.find(x => x.id === 'Q50').created_at = '2026-11-05T10:00:00Z';
    X.DS.preWrite(S2.db, null, { seq_id: 'Q50', wo: 'WO-50', processed: true, processed_by: 'Johnny', updated_by: 'Johnny', pre_key: 1 });
    const b = await pre(browser, S2); await setAll(b.page);
    const m = await b.page.evaluate(async () => { const out = await pMergeSeq('P-2002', 'WO-50', 'Office'); DB.orders = DB.orders.filter(o => o.wo !== 'P-2002'); await lsPoll(); render(); return out; }); await sleep(300);
    r = await pool(b.page);
    const w50 = r.find(x => x.wo === 'WO-50');
    const tickBtn = await b.page.evaluate(() => !!document.querySelector('[data-pretick="W:WO-50"]'));
    rec('6f P-number (older row) merged into WO-50 that Johnny had ticked: WO-50 still processed and still at his place (top)', !!w50 && !tickBtn && r[0].wo === 'WO-50',
      'tick button back=' + tickBtn + ' order=' + wos(r) + ' seq rows=' + JSON.stringify(S2.db.t.project_seq.filter(x => /QP2|Q50/.test(x.id)).map(x => [x.id, x.wo, x.state])) + ' seq_pre=' + JSON.stringify(S2.db.t.seq_pre.map(x => [x.seq_id, x.wo, x.processed, x.pre_key])));
    const exOff = await X.dev(browser, S2, 'office', { now: NOW11 }); await exOff.page.evaluate(() => { DB.orders = DB.orders.filter(o => o.wo !== 'P-2002'); showTab('x'); }); await sleep(300);
    rec('6f … and WO-50 still listed in Export Changes (Cienapps still needs step 5)', await exOff.page.evaluate(() => /WO-50/.test((document.getElementById('pre-exp') || {}).innerText || '')));
    await exOff.close();
    // a waiting row with a junk date and one far in the past
    rec('leave: no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
    await a.close(); await b.close();
  }

  // ===================== 7b/8. un-tick paths; the request log; planner untouched =====================
  if (want('log')) {
    const S = makePool();
    const seq0 = seqSnap(S);
    const a = await pre(browser, S); await toasts(a.page);
    await sleep(2500); // the boot-time planner save (not the pool's) lands first
    const planner0 = await a.page.evaluate(() => JSON.stringify(DB.orders.map(o => [o.wo, o.dueDate, o.delivDate, o.plannedWeek, o.step, o.notes, JSON.stringify(o.dueHist || [])])));
    const saves0 = S.log.filter(x => /^(PATCH|POST) \/production_planner/.test(x)).length;
    // do everything Johnny can do
    await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-12"]').click()); await sleep(600);
    await a.page.evaluate(() => document.querySelector('[data-preup="W:WO-10"]').click()); await sleep(600);
    await a.page.evaluate(() => { window.prompt = () => '1'; document.querySelector('[data-preto="R:W1"]').click(); }); await sleep(600);
    await setAll(a.page);
    // un-tick, cancel the reason dialog → nothing written
    const v0 = JSON.stringify(S.db.t.seq_pre);
    await a.page.evaluate(() => { document.querySelector('[data-preuntick="W:WO-12"]').click(); const o = document.querySelector('.pod-ovl'); const c = [...o.querySelectorAll('button')].find(b => /cancel|close|✕/i.test(b.textContent)); if (c) c.click(); else o.remove(); }); await sleep(400);
    rec('7c un-tick then Cancel: nothing written', JSON.stringify(S.db.t.seq_pre) === v0);
    await a.page.evaluate(() => { document.querySelector('[data-preuntick="W:WO-12"]').click(); document.querySelector('.pod-ovl [data-why="Other"]').click(); }); await sleep(600);
    const q12 = S.db.t.seq_pre.find(x => x.seq_id === 'Q12');
    rec('7d un-tick "Other": logged "unprocessed"; note says more than just "Other"? (documenting)', !q12.processed && S.db.t.project_events.some(e => e.entity === 'pre' && e.act === 'unprocessed'), 'note=' + q12.note);
    await a.page.evaluate(() => { window.confirm = () => true; const b = document.getElementById('pre-reset'); if (b) b.click(); }); await sleep(1200);
    await a.page.evaluate(() => { const b = document.getElementById('pre-seenall'); if (b) b.click(); }); await sleep(1600);
    const planner1 = await a.page.evaluate(() => JSON.stringify(DB.orders.map(o => [o.wo, o.dueDate, o.delivDate, o.plannedWeek, o.step, o.notes, JSON.stringify(o.dueHist || [])])));
    const w = S.log.filter(x => /^(POST|PATCH)/.test(x));
    rec('8a every write was to seq_pre only (no project_seq, no rpc/seq_move / seq_insert)', w.length > 0 && w.every(x => /^(POST|PATCH) \/seq_pre/.test(x) || /production_planner/.test(x)), JSON.stringify(w));
    rec('8b the PMs\' sequence rows byte-identical', seqSnap(S) === seq0);
    rec('8c no planner-record save from the pool, DB.orders unchanged', S.log.filter(x => /^(PATCH|POST) \/production_planner/.test(x)).length === saves0 && planner0 === planner1, String(S.log.filter(x => /production_planner/.test(x)).length - saves0));
    rec('8d no DELETE ever', !S.log.some(x => /^DELETE/.test(x)));
    rec('log: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  }

  // ===================== 9. escaping: rows AND filter boxes AND strip =====================
  if (want('esc')) {
    const BAD = n => n + ' <img src=x onerror="window.__xss=(window.__xss||0)+1"> " \' O\'Grady 🍕';
    const row = poolRow();
    row.orders.push(order({ wo: 'WO-60', customer: 'Aderrig Homes', dueDate: '2026-11-24', origDueDate: '2026-11-24', title: BAD('T'), floor: BAD('F'), unit: BAD('U'), sheetsCien: BAD('S') }),
      order({ wo: 'WO-"><img src=x onerror=window.__xss=9>', customer: BAD('Cust'), dueDate: '2026-11-24', origDueDate: '2026-11-24', title: 'x' }));
    const S = makePool({ row });
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { name: BAD('Proj'), pms: [BAD('PM'), 'John Burke'] });
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P2'), { name: BAD('Proj2') });
    X.seqRow(S, 'Q60', 'P1', { wo: 'WO-60' });
    X.seqRow(S, 'W9', 'P1', { name: BAD('Wait'), floor: BAD('WF'), unit: BAD('WU'), req_date: '2026-11-27' });
    X.F3.seedList(S, 'L60', { wos: ['WO-60'], name: 'House 60', lines: [['saw', 'Side', '2', 720, 560, BAD('Mat'), '', '']] });
    const a = await pre(browser, S); await toasts(a.page); await setAll(a.page);
    await a.page.evaluate(() => { PREV.open = true; render(); }); await sleep(200);
    const x = await a.page.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('#app img').length, opts: [...document.querySelectorAll('#pre-fd option')].map(o => o.textContent).filter(t => /img/.test(t)).length, strip: (document.querySelector('.pre-ns') || {}).innerText || '' }));
    rec('9a injected names in rows, filters, strip: no element made, no script ran', !x.xss && !x.imgs, JSON.stringify(x));
    rec('9b the names show as text in the filter boxes (PM, Project, Material)', x.opts >= 3, JSON.stringify(x));
    // pick the injected filters → still safe
    for (const id of ['pre-fpm', 'pre-fpj', 'pre-fmt']) await a.page.evaluate(id => { const s = document.getElementById(id); const o = [...s.options].find(o => /img/.test(o.textContent)); if (o) { s.value = o.value; s.dispatchEvent(new Event('change')); } }, id);
    await sleep(300);
    const y = await a.page.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('#app img').length, rows: document.querySelectorAll('#pre-pool tr[data-prer]').length }));
    rec('9c all three injected filters picked: rows still shown (WO-60), nothing injected', !y.xss && !y.imgs && y.rows >= 1, JSON.stringify(y));
    // tick / un-tick / move the weird WO row and the injected one
    await a.page.evaluate(() => { PREV.pm = PREV.pid = PREV.mat = ''; render(); });
    await a.page.evaluate(() => { const b = document.querySelector('[data-pretick="W:WO-60"]'); if (b) b.click(); }); await sleep(600);
    await a.page.evaluate(() => { const b = [...document.querySelectorAll('[data-preuntick]')].find(x => /WO-60/.test(x.dataset.preuntick)); if (b) b.click(); }); await sleep(300);
    const dlg = await a.page.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('.pod-ovl img').length }));
    await a.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(o => o.remove()));
    rec('9d tick + un-tick dialog with odd names: nothing injected', !dlg.xss && !dlg.imgs && S.db.t.seq_pre.some(r => r.seq_id === 'Q60' && r.processed));
    const off = await X.dev(browser, S, 'office', { now: NOW11 });
    await off.page.evaluate(() => showTab('x')); await sleep(300);
    const z = await off.page.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('#pre-exp img').length, txt: (document.getElementById('pre-exp') || {}).innerText || '' }));
    rec('9e Export Changes panel with odd names: shown as text', !z.xss && !z.imgs && /O'Grady/.test(z.txt), JSON.stringify(z).slice(0, 200));
    rec('esc: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close(); await off.close();
  }

  // ===================== 11. lists OFF / tables missing / half-installed =====================
  if (want('off')) {
    for (const [name, mk] of [['seq tables missing', () => makePool({ noSeq: true, noRows: true })], ['lists OFF', () => { const r = poolRow(); delete r.settings.listStore; delete r.settings.listStoreAt; return makePool({ row: r, noRows: true }); }]]) {
      const S = mk();
      const msgs = [];
      const p = await pre(browser, S);
      p.page.on('console', m => { if (m.type() === 'error') msgs.push(m.text()); });
      await p.page.evaluate(() => render()); await sleep(300);
      const t = await p.page.evaluate(() => ({ pool: !!document.getElementById('pre-pool'), txt: document.getElementById('app').innerText.slice(0, 200), wp: woProgrammed(DB.orders.find(o => o.wo === 'WO-12')) }));
      const off = await X.dev(browser, S, 'office', { now: NOW11 });
      off.page.on('console', m => { if (m.type() === 'error') msgs.push(m.text()); });
      await off.page.evaluate(() => showTab('x')); await sleep(400);
      const e = await off.page.evaluate(() => ({ pre: !!document.getElementById('pre-exp'), xpre: !!document.getElementById('btn-xpre') }));
      rec('11 ' + name + ': old message, no pool, no Export panel, no console errors, woProgrammed false', !t.pool && /opens once/.test(t.txt) && !e.pre && !e.xpre && !msgs.length && !t.wp && !(S.errors || []).length, JSON.stringify({ t, e, msgs, err: S.errors }));
      await p.close(); await off.close();
    }
    // half-installed: project_seq there, seq_pre missing → pool shows; a tick must say clearly it wasn't saved
    const S = makePool();
    S.db.t.seq_pre_gone = true;
    const p = await pre(browser, S); await toasts(p.page);
    await p.page.route('**/rest/v1/seq_pre*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "public.seq_pre" does not exist' }) }));
    await p.page.evaluate(async () => { lsReset(); await lsLoad(); render(); }); await sleep(300);
    const pool1 = await p.page.evaluate(() => !!document.getElementById('pre-pool'));
    await p.page.evaluate(() => { const b = document.querySelector('[data-pretick]'); if (b) b.click(); }); await sleep(600);
    rec('11c seq_pre missing (half-installed SQL): pool shown, a tick says "Not saved"', pool1 && /Not saved/.test(await lastToast(p.page)), await lastToast(p.page));
    rec('off: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await p.close();
  }

  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
