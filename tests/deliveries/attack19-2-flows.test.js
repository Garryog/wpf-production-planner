// attack19-2 (Tester, 19 Nov 2026): one PC, the d19 flows pushed at the edges.
//  1. Cienapps import after ↩ Back to Deliveries for steps 9 / 10 / 11 — re-shipped? duplicated? still on Deliveries?
//  2. 🚚 Book N with a delivered / loaded job among the ticked
//  3. typed WO with spaces / wrong case / Enter
//  4. Cancel at every step changes nothing and saves nothing (take off, clear status, back to deliveries)
//  5. bank holiday (Fri 25 Dec) from the bar; Sunday is never offered
// Fake Supabase only. Run: node tests/deliveries/attack19-2-flows.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '8. PALLETED', cienStep: '8. PALLETED', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
const S9 = '9. JOB SHIPPED', S10 = '10. INSTALLED TO BE INVOICE', S11 = '11. COMPLETED AND INVOICED';
const W = '2026-11-16';
(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', nid: 9, settings: {}, orders: [
    O('WO-2609-1', { step: S9, cienStep: S9, shippedAt: '2026-11-12T10:00:00Z', shippedStep: S9, delv: undefined, delDone: true }),
    O('WO-2610-1', { step: S10, cienStep: S10, shippedAt: '2026-11-12T10:00:00Z', shippedStep: S9, installedAt: '2026-11-13T10:00:00Z', delv: undefined, delDone: true }),
    O('WO-2611-1', { step: S11, cienStep: S11, shippedAt: '2026-11-12T10:00:00Z', shippedStep: S9, installedAt: '2026-11-13T10:00:00Z', completeAt: '2026-11-14T10:00:00Z', delv: undefined, delDone: true }),
    O('WO-P1'), O('WO-P2'),
    O('WO-DV', { delDone: true, delDelivAt: '2026-11-17T09:00:00Z', delivBy: 'Joe' }), // delivered, in the pool
    O('WO-LD', { delVeh: 'IVECO', delDay: 'Tue', delWk: W, delLoadedAt: '2026-11-17T07:00:00Z', ldBy: 'Joe' }),
    O('WO-T1'), O('WO-C1', { delVeh: 'VOLVO', delDay: 'Mon', delWk: W, delDelivAt: '2026-11-16T12:00:00Z', delDone: true, delivBy: 'Joe' })] };
  const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row }); const p = t.page;
  const name = async n => { if (await p.$('#pick-other')) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
  const ovl = () => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText.replace(/\s+/g, ' ') : ''; });
  const snap = () => p.evaluate(() => JSON.stringify({ o: DB.orders, x: DB.delx || [], a: DB.delArchive || {} }));
  const patches = () => t.server.patches.length;
  const settle = () => p.waitForTimeout(1600);
  try {
    // ---------- 1. Shipped → Back to Deliveries for 9 / 10 / 11, then imports
    await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 120)); const c = document.getElementById('sh-done'); if (c && !c.checked) { c.checked = true; c.onchange && c.onchange(); } await new Promise(r => setTimeout(r, 80)); });
    const btns = await p.evaluate(() => [...document.querySelectorAll('[data-shd]')].map(b => b.dataset.shd));
    rec('INFO Shipped cards offering ↩ Back to Deliveries', true, JSON.stringify(btns));
    for (const wo of ['WO-2609-1', 'WO-2610-1', 'WO-2611-1']) {
      const has = await p.evaluate(wo => { const b = document.querySelector('[data-shd="' + wo + '"]'); if (b) b.click(); return !!b; }, wo);
      if (!has) { rec(wo + ': has ↩ Back to Deliveries on Shipped', false); continue; }
      await p.waitForTimeout(80); await name('Mary'); await p.click('.pod-ovl [data-why="Damaged / returned — deliver again"]'); await p.waitForTimeout(150);
      await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 100)); });
    }
    const after = await p.evaluate(() => ['WO-2609-1', 'WO-2610-1', 'WO-2611-1'].map(w => { const o = DB.orders.find(x => x.wo === w); return { w, onDel: delOnPage(o), shipped: !!o.shippedAt, inst: !!o.installedAt, comp: !!o.completeAt, sb: o.shipBack ? o.shipBack.cs : '' }; }));
    after.forEach(a => rec(`${a.w} brought back: on Deliveries`, a.onDel, JSON.stringify(a)));
    after.filter(a => a.w !== 'WO-2609-1').forEach(a => rec(`${a.w} brought back: the job is not BOTH on the 📦 Shipped tab (installed/complete) AND in the Deliveries pool to rebook — or the dialog says so`, !(a.shipped && a.onDel), JSON.stringify(a)));
    const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
    const imp = async rows => { await H.importAoa(p, [HDR, ...rows]); return p.evaluate(async () => { const pl = IMPPLAN ? { sh: (IMPPLAN.shipped || []).map(s => s.wo), it: (IMPPLAN.inTransit || []).map(s => s.wo), n: DB.orders.length } : null; applyImport(IMPPLAN); await new Promise(r => setTimeout(r, 250)); return pl; }); };
    const nBefore = await p.evaluate(() => DB.orders.length);
    const i1 = await imp([['WO-2609-1', 'House', 'ASPECT', 46345, S9, 1000], ['WO-2610-1', 'House', 'ASPECT', 46345, S10, 1000], ['WO-2611-1', 'House', 'ASPECT', 46345, S11, 1000]]);
    const s1 = await p.evaluate(() => ['WO-2609-1', 'WO-2610-1', 'WO-2611-1'].map(w => { const os = DB.orders.filter(x => x.wo === w); const o = os[0]; return { w, n: os.length, onDel: delOnPage(o), shipped: !!o.shippedAt, comp: !!o.completeAt }; }));
    rec('import with the SAME steps: nothing re-shipped, no duplicate jobs', i1 && i1.n && !i1.sh.length && s1.every(x => x.n === 1) && (await p.evaluate(() => DB.orders.length)) === nBefore, JSON.stringify({ i1, s1 }));
    rec('import with the SAME steps: all three still on Deliveries', s1.every(x => x.onDel), JSON.stringify(s1));
    const i2 = await imp([['WO-2609-1', 'House', 'ASPECT', 46345, S10, 1000]]);
    const s2 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-2609-1'); return { onDel: delOnPage(o), shipped: !!o.shippedAt, inst: !!o.installedAt }; });
    rec('INFO WO-2609-1 brought back, then Cienapps moves to 10: shipped again while still in the Deliveries pool (flagged in transit?)', true, JSON.stringify({ i2, s2 }));

    // ---------- 2. Book N with delivered / loaded among the ticked
    await p.evaluate(async () => { showTab('d'); delTab = '0'; render(); await new Promise(r => setTimeout(r, 120)); });
    for (const wo of ['WO-P1', 'WO-DV', 'WO-LD']) await p.evaluate(wo => { const c = document.querySelector('.dchip[data-dw="' + wo + '"] .dtick'); c && c.click(); }, wo);
    await p.waitForTimeout(100);
    const bar = await p.evaluate(() => (document.getElementById('selcnt') || {}).textContent || '');
    rec('INFO bar counts ticked', true, bar);
    await p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return true; }; });
    await p.selectOption('#selveh', 'VOLVO').catch(() => {}); await p.selectOption('#selday', 'Fri').catch(() => {});
    await p.click('#selbook').catch(() => {}); await p.waitForTimeout(150);
    if (await p.$('.pod-ovl [data-why]')) { await p.click('.pod-ovl [data-why]'); await p.waitForTimeout(150); }
    const bk = await p.evaluate(() => ['WO-P1', 'WO-DV', 'WO-LD'].map(w => { const o = findDel(w); return w + ':' + (o.delVeh || '') + '|' + (o.delDay || '') + '|' + dStage(o); }));
    rec('Book 3: the plain job is booked on VOLVO Fri', bk[0] === 'WO-P1:VOLVO|Fri|', JSON.stringify(bk));
    rec('Book 3: a DELIVERED job is not booked onto a new van/day by the bar (it is delivered)', !/^WO-DV:VOLVO\|Fri/.test(bk[1]), JSON.stringify(bk));
    rec('Book 3: a LOADED job (physically on IVECO Tue) is not silently moved to VOLVO Fri by the bar', !/^WO-LD:VOLVO\|Fri/.test(bk[2]), JSON.stringify({ bk, asked: await p.evaluate(() => window.__asked) }));

    // ---------- 3. typed WO
    const toOpen = async wo => { await p.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('d'); delTab = '0'; render(); await new Promise(r => setTimeout(r, 80)); });
      await p.evaluate(wo => document.querySelector('[data-dx="' + wo + '"]').click(), wo); await p.waitForTimeout(60); await p.click('#tob-next'); await p.waitForTimeout(60); };
    await toOpen('WO-T1');
    for (const [typed, ok] of [['WO T1', false], ['WOT1', false], ['WO-T1-', false], ['WO‑T1', false], ['  wo-t1  ', true]]) {
      await p.fill('#tob-t', typed); await p.press('#tob-t', 'Enter'); await p.waitForTimeout(80);
      const r = await p.evaluate(() => ({ err: (document.getElementById('tob-err') || {}).textContent || '', who: !!document.getElementById('pick-other') }));
      rec(`typed ${JSON.stringify(typed)} → ${ok ? 'accepted (asks name)' : 'refused'}`, ok ? r.who : !r.who && !!r.err, JSON.stringify(r));
      if (ok) {
        // ---------- 4a. Cancel at the name step
        const s0 = await p.evaluate(() => JSON.stringify(findDel('WO-T1')));
        await p.click('.pod-ovl #pod-x'); await p.waitForTimeout(100); await settle();
        rec('take off: Cancel at the NAME step → WO-T1 unchanged, still on the board', (await p.evaluate(() => JSON.stringify(findDel('WO-T1')))) === s0, '');
      }
    }
    // 4b. Cancel at (a) by clicking outside
    { const s0 = await snap(); await p.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); render(); });
      await p.evaluate(() => document.querySelector('[data-dx="WO-T1"]').click()); await p.waitForTimeout(60);
      await p.evaluate(() => { const o = document.getElementById('tob-ov'); o.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      rec('take off: click outside at (a) → closed, nothing changed', !(await p.$('#tob-ov')) && (await snap()) === s0); }
    // 4c. Clear status: OK then cancel the name
    { await p.evaluate(() => { window.confirm = () => true; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); render(); });
      const s0 = await snap(), p0 = patches();
      await p.evaluate(() => document.querySelector('[data-dd="WO-C1"]').click()); await p.waitForTimeout(60);
      await p.click('.pod-ovl [data-st="clear"]'); await p.waitForTimeout(80);
      const asked = await p.$('#pick-other');
      if (asked) { await p.click('.pod-ovl #pod-x'); await p.waitForTimeout(80); }
      await settle();
      rec('clear status: confirm OK then Cancel at the name → still delivered, nothing saved', !!asked && (await snap()) === s0 && patches() === p0, ''); }
    // 4d. Back to Deliveries (Shipped tab) — Cancel at name, then Cancel at reason
    { await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-C1'); }); // nothing
      const S = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-P2'); o.step = '9. JOB SHIPPED'; o.cienStep = o.step; o.shippedAt = '2026-11-12T10:00:00Z'; o.delv = undefined; o.delDone = true; return 1; });
      await settle(); const s0 = await snap(), p0 = patches();
      await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-shd="WO-P2"]').click(); }); await p.waitForTimeout(80);
      await p.click('.pod-ovl #pod-x'); await p.waitForTimeout(80);
      await p.evaluate(() => document.querySelector('[data-shd="WO-P2"]').click()); await p.waitForTimeout(80); await name('Mary');
      await p.click('.pod-ovl #pod-x'); await p.waitForTimeout(80); await settle();
      rec('back to deliveries: Cancel at name, Cancel at reason → nothing changed, nothing saved', (await snap()) === s0 && patches() === p0, ''); }

    // ---------- 5. bank holiday / Sunday from the bar
    { await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 80)); });
      const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab + ':' + b.textContent.trim().slice(0, 20)));
      // the bar's week is the open tab; force Wk 52 (21 Dec) by booking through placeJobs as the bar does
      const days = await p.evaluate(() => { delSel.clear(); delSel.add('WO-T1'); render(); const s = document.getElementById('selday'); return s ? [...s.options].map(o => o.textContent) : []; });
      rec('the day picker never offers Sunday', !days.some(d => /Sun/.test(d)), JSON.stringify(days));
      await p.evaluate(() => { window.__asked = []; window.__ans = false; window.confirm = m => { window.__asked.push(m); return window.__ans; }; });
      const s0 = await snap();
      await p.evaluate(() => placeJobs([findDel('WO-T1')], 'VOLVO', 'Fri', '2026-12-21'));
      await p.waitForTimeout(80);
      const a = await p.evaluate(() => window.__asked);
      rec('Fri 25 Dec: asked "bank holiday — book anyway?", Cancel → nothing changed', a.length === 1 && /bank holiday/.test(a[0]) && (await snap()) === s0, JSON.stringify(a)); }
    rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  } catch (e) { rec('test ran', false, e.stack); }
  await t.close(); await browser.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})();
