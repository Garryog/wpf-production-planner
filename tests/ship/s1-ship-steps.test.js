// Small release (Garry 12 Nov: "Need to be able to update on capacity board to shipped or installed or completed. The job drops
// off capacity board after shipping"): S1 lifted from the Job B branch onto the live version. Board step drop-down gains
// 9. JOB SHIPPED / 10. INSTALLED TO BE INVOICE / 11. COMPLETED AND INVOICED. Ported from tests/seq/s12-ship-steps.test.js
// (Job B) onto the plain harness. Fake Supabase only. Run: node tests/ship/s1-ship-steps.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
(async () => {
  const browser = await H.chromium.launch();
  try {
    const O = (wo, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor: 'T09', dueDate: '2026-11-27', origDueDate: '2026-11-27' }, x));
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-3', { unit: '3', title: 'HOUSE TYPE C', step: '8. PALLETED', plannedWeek: '2026-11-23', hours: 10, value: 5000 }),
      O('WO-6', { unit: '6', title: 'HOUSE TYPE D', step: '7. ASSEMBLY COMPLETE', plannedWeek: '2026-11-23', hours: 6, value: 3000 }),
      O('WO-8', { unit: '15', title: 'HOUSE TYPE E', step: '8. PALLETED', plannedWeek: '2026-11-23', hours: 4, value: 2000 }),
      O('WO-9', { unit: '16', title: 'HOUSE TYPE F', step: '6. JOB CUT COMPLETE', plannedWeek: '2026-11-23', hours: 3, value: 1500, delv: true })] };
    const t = await H.open({ browser, now: '2026-11-12T10:00:00Z', row }), p = t.page, S = t.server;
    await p.evaluate(() => { sessionStorage.setItem('wpfWho', 'Op'); });
    const n0 = await p.evaluate(() => DB.orders.length);
    await p.evaluate(() => { showTab('b'); });
    await sleep(200);
    // ---- the drop-down
    const dd = await p.evaluate(() => { const s = document.querySelector('[data-stepsel="WO-3"]'); return s ? [...s.options].map(o => o.value + '=' + o.textContent) : null; });
    rec('board step drop-down: 1–8 then 9. JOB SHIPPED / 10. INSTALLED TO BE INVOICE / 11. COMPLETED AND INVOICED (stored as Cienapps\' text, shown short)',
      dd && dd.length === 11 && dd[8] === '9. JOB SHIPPED=JOB SHIPPED' && dd[9] === '10. INSTALLED TO BE INVOICE=INSTALLED' && dd[10] === '11. COMPLETED AND INVOICED=COMPLETED' && dd[7] === '8. PALLETED=PALLETED', JSON.stringify(dd));
    const hrs0 = await p.evaluate(() => wkHrs('2026-11-23'));
    const pick = (wo, v, ok) => p.evaluate(({ wo, v, ok }) => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return ok; }; const s = document.querySelector('[data-stepsel="' + wo + '"]'); if (!s) return 'no select'; s.value = v; s.onchange(); return 'ok'; }, { wo, v, ok });
    const job = wo => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o && { step: o.step, sh: !!o.shippedAt, shs: o.shippedStep || '', inst: !!o.installedAt, done: !!o.completeAt, by: o.completeBy || '', hand: o.stepHand || null, log: (o.log || o.edits || []).map(x => x.what || x.w || JSON.stringify(x)), delv: !!o.delv, onBoard: !!document.querySelector('[data-stepsel="' + wo + '"]') }; }, wo);
    // ---- Cancel: nothing changes
    await pick('WO-3', '9. JOB SHIPPED', false); await sleep(200);
    let j = await job('WO-3'); let asked = await p.evaluate(() => window.__asked);
    rec('9. JOB SHIPPED asks first ("leaves the Capacity Board and the week totals"); Cancel = step and board unchanged',
      j.step === '8. PALLETED' && !j.sh && j.onBoard && asked.length === 1 && /Set WO-3 to "9\. JOB SHIPPED"[\s\S]*leaves the Capacity Board and the week totals[\s\S]*Export Changes/.test(asked[0]), JSON.stringify({ j, asked }));
    // ---- OK
    await pick('WO-3', '9. JOB SHIPPED', true); await sleep(300);
    j = await job('WO-3');
    const hrs1 = await p.evaluate(() => wkHrs('2026-11-23'));
    rec('OK: step = "9. JOB SHIPPED", shipped (shippedStep the same), off the board', j.step === '9. JOB SHIPPED' && j.sh && j.shs === '9. JOB SHIPPED' && !j.onBoard && !j.inst && !j.done, JSON.stringify(j));
    rec('OK: out of the week totals (week of 23 Nov loses its 10 h)', hrs0 - hrs1 === 10, hrs0 + ' → ' + hrs1);
    const hist = await p.evaluate(() => JSON.stringify(DB.orders.find(x => x.wo === 'WO-3')));
    rec('logged in the job\'s history: "Step 8. PALLETED → 9. JOB SHIPPED (set by hand)" with the person', /Step 8\. PALLETED → 9\. JOB SHIPPED \(set by hand\)/.test(hist) && /Op/.test(hist), hist.slice(0, 300));
    rec('stepHand remembers the step before (8. PALLETED)', j.hand && j.hand.from === '8. PALLETED' && j.hand.to === '9. JOB SHIPPED', JSON.stringify(j.hand));
    // ---- same as an imported shipped job: import WO-8 as 9. JOB SHIPPED
    await H.importAoa(p, [HDR, ['WO-8', 'HOUSE TYPE E', 'Aderrig Homes', 46353, '9. JOB SHIPPED', 2000]]);
    await p.evaluate(() => applyImport(IMPPLAN)); await sleep(300);
    const cmp = await p.evaluate(() => { const a = DB.orders.find(x => x.wo === 'WO-3'), b = DB.orders.find(x => x.wo === 'WO-8');
      const f = o => ({ sh: isShipped(o), plan: planOrders().includes(o), board: boardOrders().includes(o), del: delAll ? delAll().includes(o) : null, step: stepNo(o.step) });
      return { a: f(a), b: f(b), hrs: wkHrs('2026-11-23') }; });
    rec('a hand-set shipped job is treated exactly like an imported one (shipped, out of plan / board / totals)', JSON.stringify(cmp.a) === JSON.stringify(cmp.b) && cmp.a.sh && !cmp.a.plan && !cmp.a.board && cmp.hrs === hrs1 - 4, JSON.stringify(cmp));
    // ---- Shipped tab shows it
    await p.evaluate(() => { showTab('h'); }); await sleep(200);
    const shTxt = await p.evaluate(() => document.querySelector('#app, body').innerText);
    rec('Shipped tab lists WO-3 (set by hand) and WO-8 (imported)', /WO-3/.test(shTxt) && /WO-8/.test(shTxt), '');
    // ---- Export Changes
    await p.evaluate(() => { showTab('x'); }); await sleep(200);
    const ex = await p.evaluate(() => ({ chg: changes().map(o => o.wo), txt: document.body.innerText }));
    rec('Export Changes lists WO-3 (Cienapps is behind: was PALLETED, now JOB SHIPPED)', ex.chg.includes('WO-3') && /WO-3[\s\S]*PALLETED[\s\S]*JOB SHIPPED/.test(ex.txt), JSON.stringify(ex.chg));
    // ---- an import where Cienapps is still at 8: the hand-set step holds
    await H.importAoa(p, [HDR, ['WO-3', 'HOUSE TYPE C', 'Aderrig Homes', 46359, '8. PALLETED', 5000]]);
    const pl = await p.evaluate(() => ({ sd: (IMPPLAN.stepDiffs || []).filter(x => x.wo === 'WO-3').map(x => x.why), up: (IMPPLAN.updates || []).filter(x => x.wo === 'WO-3').map(x => x.what) }));
    await p.evaluate(() => applyImport(IMPPLAN)); await sleep(300);
    j = await job('WO-3');
    const chg2 = await p.evaluate(() => changes().map(o => o.wo));
    rec('Cienapps import still at 8. PALLETED: planner\'s 9 holds, still shipped, preview says planner is ahead', j.step === '9. JOB SHIPPED' && j.sh && pl.sd.some(w => /planner is ahead/.test(w)) && !pl.up.some(w => /step/.test(w)), JSON.stringify({ j, pl }));
    rec('… and it stays on Export Changes', chg2.includes('WO-3'), JSON.stringify(chg2));
    // ---- Cienapps moves on to 10: taken, installed, stepHand cleared (Cienapps' now)
    await H.importAoa(p, [HDR, ['WO-3', 'HOUSE TYPE C', 'Aderrig Homes', 46359, '10. INSTALLED TO BE INVOICE', 5000]]);
    await p.evaluate(() => applyImport(IMPPLAN)); await sleep(300);
    j = await job('WO-3');
    rec('Cienapps moves the job on (10. INSTALLED TO BE INVOICE): step taken, marked installed, the hand-set marker cleared', j.step === '10. INSTALLED TO BE INVOICE' && j.sh && j.inst && !j.hand, JSON.stringify(j));
    // ---- 11 by hand on a board job (WO-6): installed + complete in one go
    await p.evaluate(() => { showTab('b'); }); await sleep(200);
    await pick('WO-6', '11. COMPLETED AND INVOICED', true); await sleep(300);
    j = await job('WO-6'); asked = await p.evaluate(() => window.__asked);
    // (rule changed by Garry 11 Nov): 11 by hand does NOT tick "Installation complete" — that stays its own button
    rec('11. COMPLETED AND INVOICED by hand: shipped + installed, NOT "Installation complete" (Garry 11 Nov: kept separate)', j.step === '11. COMPLETED AND INVOICED' && j.sh && j.inst && !j.done && !/Installation complete/.test(asked[0] || ''), JSON.stringify({ j, asked }));
    // ---- a job on Deliveries (delv) set to 9 by hand stays on Deliveries until the driver confirms
    await pick('WO-9', '9. JOB SHIPPED', true); await sleep(300);
    j = await job('WO-9'); asked = await p.evaluate(() => window.__asked);
    const onDel = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-9'); return typeof delAll === 'function' ? delAll().includes(o) : null; });
    rec('a job ticked for delivery set to 9 by hand: shipped, still on Deliveries (confirm says so)', j.sh && j.delv && onDel !== false && /stays on 🚚 Deliveries/.test(asked[0] || ''), JSON.stringify({ j, onDel, asked }));
    // ---- Bring back to board: the old step comes back
    await p.evaluate(() => { showTab('h'); window.__shDone = true; }); await sleep(200);
    await p.evaluate(() => { const c = document.getElementById('sh-done'); if (c && !c.checked) { c.checked = true; c.onchange(); } }); await sleep(200);
    const bb = await p.evaluate(() => { window.confirm = () => true; const b = document.querySelector('[data-shb="WO-6"]'); if (!b) return 'no button'; b.click(); return 'ok'; }); await sleep(300);
    j = await job('WO-6');
    rec('↩ Bring back to board on a job set to 11 by hand: step back to 7. ASSEMBLY COMPLETE, not shipped, not installed / complete, on the board again',
      bb === 'ok' && j.step === '7. ASSEMBLY COMPLETE' && !j.sh && !j.inst && !j.done && !j.hand, JSON.stringify({ bb, j }));
    // ---- step only moves forward on a shipped job
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3'); document.getElementById('toast').textContent = ''; stepShipHand(o, '9. JOB SHIPPED'); }); await sleep(200);
    j = await job('WO-3'); const tst = await p.evaluate(() => document.getElementById('toast').textContent);
    rec('a shipped job at 10 cannot be set back to 9 by hand ("Steps only move forward")', j.step === '10. INSTALLED TO BE INVOICE' && /only move forward/.test(tst), tst);
    // ---- never deleted
    const n1 = await p.evaluate(() => DB.orders.length);
    rec('no job removed (shipped jobs are kept)', n1 === n0, n0 + ' → ' + n1);
    // ---- the database copy (fake Supabase) has the same after the save
    await sleep(1800);
    const saved = (S.row && S.row.orders || []).find(o => o.wo === 'WO-3');
    rec('saved to the (fake) database: WO-3 at 10, shipped', !S.row || (saved && saved.step === '10. INSTALLED TO BE INVOICE' && !!saved.shippedAt), JSON.stringify(saved && { step: saved.step, sh: saved.shippedAt }));
    await p.setViewportSize({ width: 360, height: 740 }); await p.evaluate(() => { showTab('h'); }); await sleep(300);
    const ns = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    rec('360 px: Shipped tab has no sideways scroll', ns.sw <= ns.cw + 1, JSON.stringify(ns));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  } finally { await browser.close(); }
  const f = res.filter(x => !x).length; console.log('\n' + (res.length - f) + '/' + res.length + ' passed'); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
