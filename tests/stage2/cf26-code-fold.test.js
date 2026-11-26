// cf26 (Garry 26 Nov: "you are duplicating work orders on import. the BI and other codes after the WO- need to be ignored").
// WO-BI- / WO-PF- / WO-E- lines are folded into their main work order when it is in the file or live on the board; a coded line
// with no main work order stays its own job; a coded JOB already on the board is folded after the import (lists, booking moved,
// full copy kept, nothing deleted). WO-D- is not folded. Fake Supabase only. Run: node tests/stage2/cf26-code-fold.test.js
const L = require('../list-window/lw.js'); const { X, H, sleep, asks, liveFor } = L;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 320) : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference'];
const row = (wo, title, step, val, cust) => [wo, title, cust || 'Kildare Homes', '2026-12-10', step, val == null ? 3945 : val, ''];
const ord = (wo, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor: 'T09', unit: '77', title: 'PART 5 NO 77', dueDate: '2026-12-10', origDueDate: '2026-12-10', step: '7. ASSEMBLY COMPLETE', value: 3945 }, x || {}));
const apply = async p => { await p.evaluate(() => { window.CODEFOLD_RUN0 = CODEFOLD_RUN; document.getElementById('imp-apply').click(); }); for (let i = 0; i < 80; i++) { const d = await p.evaluate(() => !IMPPLAN && CODEFOLD_RUN && CODEFOLD_RUN !== window.CODEFOLD_RUN0); if (d) break; await sleep(100); } return p.evaluate(async () => { try { return await CODEFOLD_RUN; } catch (e) { return String(e); } }); };
const jobs = p => p.evaluate(() => DB.orders.map(o => o.wo).sort().join());
const get = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o ? JSON.parse(JSON.stringify(o)) : null; }, wo);
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1. new jobs: main + BI in one file
    const r1 = X.v2Row(); r1.orders = [];
    const S = X.makeServer(r1); const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); sessionStorage.setItem('wpfWho', 'Ann'); });
    let r = await H.importAoa(p, [HDR, row('WO-2542-17', 'PART 5 NO 77', '7. ASSEMBLY COMPLETE'), row('WO-BI-2542-17', 'PART 5 NO 77 BOUGHT IN', '1. DRAWING'), row('WO-BI-2369-116', 'PART 5 78 KIT BOUGHT IN', '3. IN PRODUCTION', 500), row('WO-PF-2713-1', '2713-1', '3. IN PRODUCTION', 200), row('WO-2713-1', 'WORKTOPS JOB', '3. IN PRODUCTION', 200), row('WO-E-2742-1', 'EXTRA OVERS', '3. IN PRODUCTION', 90), row('WO-2742-1', 'OUGHTERARD', '9. SHIPPED', 90), row('WO-D-2763-1', 'DRAWING KILLIMOR', '3. IN PRODUCTION', 10), row('WO-2763-1', 'KILLIMOR GAA', '3. IN PRODUCTION', 10)]);
    const nw = (r.plan.newOrders || []).map(o => o.wo).sort().join(), fd = (r.plan.folds || []).filter(f => f.code).map(f => f.wo + '>' + f.base).sort().join();
    rec('preview: BI and PF lines whose main WO is in the file are folded (not new jobs)', fd === 'WO-BI-2542-17>WO-2542-17,WO-PF-2713-1>WO-2713-1', fd);
    rec('…a BI line with no main WO (WO-BI-2369-116) is still its own job', /WO-BI-2369-116/.test(nw), nw);
    rec('…WO-E- whose main WO is SHIPPED in the file is not folded (kept as its own job)', /WO-E-2742-1/.test(nw) && !/WO-E-2742-1>/.test(fd), nw);
    rec('…WO-D- is never folded (drawing rule unchanged)', !/WO-D-2763-1>/.test(fd), fd);
    const txt = await p.evaluate(() => document.getElementById('iprev') ? document.getElementById('iprev').innerText : document.body.innerText);
    rec('the preview says so in words ("folded into the main WO", its own section)', /BI \/ PF \/ E lines? folded into the main WO/.test(txt) && /Same job twice/.test(txt), txt.slice(0, 200));
    await apply(p);
    let o = await get(p, 'WO-2542-17'), js = await jobs(p);
    rec('after Apply: ONE job for the house, value counted once (€3,945), with the note of what was folded', !!o && o.value === 3945 && o.codes && !!o.codes['WO-BI-2542-17'] && !/WO-BI-2542-17/.test(js), JSON.stringify([o && o.value, o && o.codes, js]));
    const badge = await p.evaluate(() => { tab = 'b'; render(); const tr = document.querySelector('tr[data-wo="WO-2542-17"]'); return tr ? tr.innerText.replace(/\s+/g, ' ').slice(0, 120) : ''; });
    rec('Capacity Board: the main job shows a small ＋BI note', /＋BI/.test(badge), badge);
    // same file again → nothing new
    r = await H.importAoa(p, [HDR, row('WO-2542-17', 'PART 5 NO 77', '7. ASSEMBLY COMPLETE'), row('WO-BI-2542-17', 'PART 5 NO 77 BOUGHT IN', '1. DRAWING')]);
    rec('the same file again: nothing added, nothing updated', !(r.plan.newOrders || []).length && !(r.plan.updates || []).length, JSON.stringify([(r.plan.newOrders || []).length, (r.plan.updates || []).map(u => u.wo)]));
    await p.evaluate(() => { try { IMPPLAN = null; } catch (e) { } });
    // the main WO arrives later for the stand-alone BI job → folded then
    r = await H.importAoa(p, [HDR, row('WO-2369-116', 'PART 5 78 KIT', '5. WORK ORDER PROCESSED', 500), row('WO-BI-2369-116', 'PART 5 78 KIT BOUGHT IN', '3. IN PRODUCTION', 500)]);
    let out = await apply(p); js = await jobs(p); o = await get(p, 'WO-2369-116');
    rec('main WO arrives later: the stand-alone BI job is folded into it (one job), a full copy kept on the main job', !/WO-BI-2369-116/.test(js) && /WO-2369-116/.test(js) && o && (o.pFrom || []).some(x => x.wo === 'WO-BI-2369-116' && x.job && x.job.wo === 'WO-BI-2369-116') && o.value === 500, JSON.stringify([js, out, o && o.value]));
    rec('…the main job keeps its OWN step (the BI line\'s step is not taken)', o && /^5\./.test(o.step), o && o.step);
    await t.close ? t.close() : 0;
    // ---------- 2. both ALREADY on the board (as on live): list and delivery booking of the BI job move across
    const r2 = X.v2Row(); r2.orders = [ord('WO-2542-17'), ord('WO-BI-2542-17', { title: 'PART 5 NO 77 BOUGHT IN', step: '1. DRAWING', delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-12-07' }), ord('WO-2600-1', { unit: '80' }), ord('WO-BI-2600-1', { unit: '80', title: 'NO 80 BOUGHT IN' }), ord('WO-BI-2700-9', { unit: '90', delLoadedAt: '2026-12-01T09:00:00Z', delv: true, delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-30' }), ord('WO-2700-9', { unit: '90' })];
    const S2 = X.makeServer(r2);
    L.D.insert(S2.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    X.F3.seedList(S2, 'LB1', { wos: ['WO-BI-2542-17'], name: 'Bought-in 77' });
    X.F3.seedList(S2, 'LA', { wos: ['WO-2600-1'], name: 'House 80' }); X.F3.seedList(S2, 'LB', { wos: ['WO-BI-2600-1'], name: 'House 80 BI' });
    const t2 = await X.dev(browser, S2, 'office'), q = t2.page; await asks(q);
    await q.evaluate(async () => { lsReset(); await lsLoad(); sessionStorage.setItem('wpfWho', 'Ann'); });
    await H.importAoa(q, [HDR, row('WO-2542-17', 'PART 5 NO 77', '7. ASSEMBLY COMPLETE'), row('WO-BI-2542-17', 'PART 5 NO 77 BOUGHT IN', '1. DRAWING'), row('WO-2600-1', 'NO 80', '7. ASSEMBLY COMPLETE'), row('WO-BI-2600-1', 'NO 80 BOUGHT IN', '7. ASSEMBLY COMPLETE'), row('WO-2700-9', 'NO 90', '7. ASSEMBLY COMPLETE'), row('WO-BI-2700-9', 'NO 90 BI', '7. ASSEMBLY COMPLETE')]);
    out = await apply(q); js = await jobs(q); o = await get(q, 'WO-2542-17'); await sleep(800);
    rec('both on the board: WO-BI-2542-17 is gone from the job list, WO-2542-17 stays — one job', !/WO-BI-2542-17/.test(js) && /WO-2542-17/.test(js), js + ' ' + JSON.stringify(out).slice(0, 200));
    rec('…its delivery booking moved onto the main job (Volvo Thu)', o && o.delVeh === 'VOLVO' && o.delDay === 'Thu' && o.delv === true, JSON.stringify(o && [o.delVeh, o.delDay, o.delv]));
    for (let i = 0; i < 40 && !(liveFor(S2, 'WO-2542-17').length === 1 && liveFor(S2, 'WO-BI-2542-17').length === 0); i++) await sleep(250); // the list change goes through the list queue
    rec('…its cutting list now belongs to the main job (one live list on WO-2542-17, none on the BI number)', liveFor(S2, 'WO-2542-17').length === 1 && liveFor(S2, 'WO-BI-2542-17').length === 0, liveFor(S2, 'WO-2542-17').length + '/' + liveFor(S2, 'WO-BI-2542-17').length);
    rec('…a full copy of the BI job is kept on the main job, and its history says so; value still €3,945', o && (o.pFrom || []).some(x => x.wo === 'WO-BI-2542-17' && x.code) && (o.log || []).some(x => /folded into/.test(x.what || '')) && o.value === 3945 && /^7\./.test(o.step), JSON.stringify(o && [(o.pFrom || []).length, o.value, o.step]));
    rec('both have a live cutting list (WO-2600-1 and its BI): NOT folded, both stay, the reason is given', /WO-BI-2600-1/.test(js) && (out || []).some(x => x.p === 'WO-BI-2600-1' && !x.ok && /both have a live cutting list/.test(x.why || '')), JSON.stringify((out || []).filter(x => x.p === 'WO-BI-2600-1')));
    rec('a BI job already LOADED on a van is left alone', /WO-BI-2700-9/.test(js) && !(out || []).some(x => x.p === 'WO-BI-2700-9'), js);
    rec('saved to the (fake) database: the BI job is not in the saved record, the main job is', await (async () => { await sleep(2500); const ws = S2.row.orders.map(x => x.wo); return !ws.includes('WO-BI-2542-17') && ws.includes('WO-2542-17'); })(), S2.row.orders.map(x => x.wo).join());
    // import again → nothing folded twice, one copy kept
    await H.importAoa(q, [HDR, row('WO-2542-17', 'PART 5 NO 77', '7. ASSEMBLY COMPLETE'), row('WO-BI-2542-17', 'PART 5 NO 77 BOUGHT IN', '1. DRAWING')]);
    const has = await q.evaluate(() => !!document.getElementById('imp-apply')); if (has) await apply(q);
    o = await get(q, 'WO-2542-17'); js = await jobs(q);
    rec('next import: the BI line is not brought back, and only ONE kept copy', !/WO-BI-2542-17/.test(js) && (o.pFrom || []).filter(x => x.wo === 'WO-BI-2542-17').length === 1, js);
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
