// Garry 17 Nov: "we need to review every work order at drawing stage to decide whether or not to bring into planner".
// NEW work orders at drawing stage (or WO-D) are listed in the import preview with a tick each (unticked = left out, as before);
// ticked ones come in like any new job (flagged); left-out ones are listed again next import, marked "left out <date> by <name>".
// Stubbed Supabase only (tests/harness.js). Run: node tests/stage2/drawing-review.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Floor', 'Unit'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await H.chromium.launch(); let t;
  try {
    t = await H.open({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', orders: [H.order({ wo: 'WO-OLD-1', step: '1.DRAWING', dueDate: '2026-11-05' })], nid: 5, settings: {} } });
    const p = t.page;
    await p.evaluate(() => { sessionStorage.setItem('wpfWho', 'Garry'); window.confirm = () => true; });
    const FILE = [HDR, ['WO-3001-1', 'APT 1 KITCHEN', 'Clancy', 46340, '1.DRAWING', 8000, 'GF', '1'], ['WO-3001-2', 'APT 2 KITCHEN', 'Clancy', 46330, '1.DRAWING', 9000, 'GF', '2'],
      ['WO-D-3001', 'Drawings', 'Clancy', 46331, '3. READY FOR UPLOAD', 0, '', ''], ['WO-3002-1', 'HOUSE 5', 'Aspect', 46332, '4. READY FOR PRODUCTION', 7000, '', '5'], ['WO-OLD-1', 'Old', 'X', 46331, '1.DRAWING', 1000, '', '']];
    let r = await H.importAoa(p, FILE); await sleep(300);
    const v = await p.evaluate(() => ({ rows: [...document.querySelectorAll('[data-drq]')].map(c => [c.dataset.drq, c.checked]), txt: (document.getElementById('imp-draw') || {}).innerText || '' }));
    rec('preview lists the 3 NEW drawing-stage WOs (incl. WO-D), all UNticked, earliest due first', JSON.stringify(v.rows) === JSON.stringify([['WO-3001-2', false], ['WO-D-3001', false], ['WO-3001-1', false]]), JSON.stringify(v.rows));
    rec('…each line shows customer, floor · unit, title, due date, value and NEW', /Clancy/.test(v.txt) && /GF · 2/.test(v.txt) && /APT 2 KITCHEN/.test(v.txt) && /due/.test(v.txt) && /€9,000/.test(v.txt) && /NEW/.test(v.txt), v.txt.slice(0, 300));
    rec('a job already in the planner at drawing stage is not in the list (it is just updated, as before)', !v.rows.some(x => x[0] === 'WO-OLD-1'));
    // tick one and apply
    await p.evaluate(() => { document.querySelector('[data-drq="WO-3001-1"]').checked = true; document.getElementById('imp-apply').click(); }); await sleep(1500);
    const a = await p.evaluate(() => ({ wos: DB.orders.map(o => o.wo).sort(), seen: DB.drawSeen || {}, set: fullSettings().drawSeen || null }));
    rec('Apply: the ticked WO-3001-1 and the normal WO-3002-1 come in; WO-3001-2 and WO-D-3001 do not', JSON.stringify(a.wos) === JSON.stringify(['WO-3001-1', 'WO-3002-1', 'WO-OLD-1']), JSON.stringify(a.wos));
    rec('…the two left out are remembered (today, by Garry) and saved with the settings', a.seen['WO-3001-2'] && a.seen['WO-D-3001'] && a.seen['WO-3001-2'].by === 'Garry' && a.set && a.set['WO-3001-2'], JSON.stringify(a.seen));
    // next import: same file
    r = await H.importAoa(p, FILE); await sleep(300);
    const v2 = await p.evaluate(() => ({ rows: [...document.querySelectorAll('[data-drq]')].map(c => c.dataset.drq), txt: (document.getElementById('imp-draw') || {}).innerText || '' }));
    rec('next import: only the 2 left out are listed, marked "left out … by Garry", no NEW', JSON.stringify(v2.rows) === JSON.stringify(['WO-3001-2', 'WO-D-3001']) && /left out .* by Garry/.test(v2.txt) && !/NEW/.test(v2.txt), JSON.stringify(v2));
    await p.evaluate(() => { document.getElementById('drq-all').click(); document.getElementById('imp-apply').click(); }); await sleep(1500);
    const b = await p.evaluate(() => ({ n: DB.orders.length, seen: Object.keys(DB.drawSeen || {}), flag: (DB.orders.find(o => o.wo === 'WO-3001-2') || {}).wo }));
    rec('Tick all + Apply → both come in, nothing left marked', b.n === 5 && b.flag && !b.seen.length, JSON.stringify(b));
    // nothing ticked = exactly as before
    t.close && await t.close();
    t = await H.open({ browser, now: '2026-10-19T10:00:00Z', row: { id: 'main', orders: [], nid: 5, settings: {} } });
    await t.page.evaluate(() => { window.confirm = () => true; });
    await H.importAoa(t.page, [HDR, ['WO-4001-1', 'APT 1', 'C', 46340, '1.DRAWING', 1, '', '']]); await sleep(300);
    await t.page.evaluate(() => document.getElementById('imp-apply').click()); await sleep(1200);
    rec('nothing ticked → nothing at drawing stage is added (as before)', (await t.page.evaluate(() => DB.orders.length)) === 0);
  } catch (e) { rec('test ran to the end', false, e.stack); }
  if (t && t.close) await t.close();
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
