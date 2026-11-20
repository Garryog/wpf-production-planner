// attack19-5 (Tester, 19 Nov 2026): odd names through every d19 screen — customer band, take off board (both steps), 📚 Past
// weeks row + ↩ Back to Deliveries, slot warning, Shipped card. <img onerror>, <svg onload>, quotes, apostrophes, emoji, a "|" in a WO.
// Fake Supabase only. Run: node tests/deliveries/attack19-5-names.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const BAD1 = '<img src=x onerror="window.__x=1">', BAD2 = '<svg onload="window.__x=2">';
const MW = `JOB-"O'G"|1`;
(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', nid: 9, settings: { delx: [{ wo: MW, title: `O'Grady's "kitchen" 🍀 ${BAD2}`, customer: BAD1, value: 10, manual: true, delVeh: 'IVECO', delDay: 'Wed', delWk: '2026-11-16', delDone: false }] }, orders: [
    H.order({ wo: 'WO-2670-1', customer: BAD2, title: BAD1, dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '8. PALLETED', delv: true, value: 1 }),
    H.order({ wo: 'WO-2671-1', customer: "O'Brien & Sons \"Ltd\"", title: 'x', dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '9. JOB SHIPPED', cienStep: '9. JOB SHIPPED', shippedAt: '2026-11-12T10:00:00Z', delDone: true })] };
  const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row }); const p = t.page;
  const name = async n => { if (await p.$('#pick-other')) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
  const bad = () => p.evaluate(() => ({ x: window.__x || 0, el: document.querySelectorAll('img[src="x"], svg[onload]').length }));
  try {
    await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); });
    const band = await p.evaluate(() => [...document.querySelectorAll('.dchip-cn')].map(e => e.textContent));
    rec('customer band: odd names show as text, nothing runs', band.includes('<img src=x onerror="window.__x=1">') && band.includes('<svg onload="window.__x=2">') && !(await bad()).x && !(await bad()).el, JSON.stringify(band));
    // slot warning: book the Cienapps job on IVECO Wed (the hand job is there)
    await p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return false; }; placeJobs([findDel('WO-2670-1')], 'IVECO', 'Wed', '2026-11-16'); });
    const a = await p.evaluate(() => window.__asked);
    rec('slot warning names the hand job with the odd WO and customer', a.length === 1 && a[0].includes(MW), JSON.stringify(a));
    // back to pool then take off the hand job (it is booked: × goes to the pool first)
    await p.evaluate(() => { window.confirm = () => true; placeJobs([findDel(`JOB-"O'G"|1`)], '', '', ''); }); await p.waitForTimeout(100);
    if (await p.$('.pod-ovl [data-why]')) { await p.click('.pod-ovl [data-why]'); await p.waitForTimeout(150); }
    await p.evaluate(() => { const b = [...document.querySelectorAll('[data-dx]')].find(x => x.dataset.dx === `JOB-"O'G"|1`); b.click(); }); await p.waitForTimeout(80);
    const s1 = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().innerText);
    rec('take off (a): the odd WO / title / customer as text', s1.includes(MW) && s1.includes('<svg onload') && !(await bad()).el, s1.slice(0, 200));
    await p.click('#tob-next'); await p.fill('#tob-t', 'DELETE'); await p.click('#tob-go'); await p.waitForTimeout(80); await name("Seán O'Grady");
    const ar = await p.evaluate(() => { const k = Object.keys(DB.delArchive || {}).find(k => DB.delArchive[k].off); return k; });
    rec('archived with the name "Seán O\'Grady"', !!ar && await p.evaluate(k => DB.delArchive[k].by === "Seán O'Grady", ar), ar);
    await p.evaluate(() => openDelArchive()); await p.waitForTimeout(80);
    await p.evaluate(k => document.querySelector('[data-arcv="' + k + '"]').click(), ar); await p.waitForTimeout(80);
    const pw = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().innerText);
    rec('📚 Past weeks: odd row shown as text, nothing runs', pw.includes(MW) && pw.includes("Seán O'Grady") && !(await bad()).x && !(await bad()).el, pw.slice(0, 300));
    await p.evaluate(() => document.querySelector('[data-arcb]').click()); await p.waitForTimeout(80); await name("Seán O'Grady");
    await p.click('.pod-ovl [data-why="Not delivered after all"]'); await p.waitForTimeout(150);
    const back = await p.evaluate(() => { const x = (DB.delx || []).find(j => j.wo === `JOB-"O'G"|1`); return x && { t: x.title, c: x.customer, rb: !!x.delRebook }; });
    rec('↩ Back to Deliveries with a "|" and quotes in the WO → the right job comes back, title/customer intact', back && back.c === '<img src=x onerror="window.__x=1">' && /🍀/.test(back.t) && back.rb, JSON.stringify(back));
    // Shipped card with apostrophe customer → back dialog
    await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-shd="WO-2671-1"]').click(); }); await p.waitForTimeout(80); await name("Seán O'Grady");
    const dl = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().innerText);
    rec('Shipped → Back dialog shows the name with apostrophe correctly (no &#39;)', dl.includes("Seán O'Grady") && !/&#39;|&amp;/.test(dl), dl.slice(0, 300));
    await p.click('.pod-ovl #pod-x');
    rec('nothing ran anywhere', !(await bad()).x, JSON.stringify(await bad()));
    rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  } catch (e) { rec('test ran', false, e.stack); }
  await t.close(); await browser.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})();
