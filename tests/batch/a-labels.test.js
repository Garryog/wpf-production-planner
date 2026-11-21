// Manager 21 Nov: in the saw ⚡ BATCH tab every house is told apart by its PHYSICAL unit (Floor / Unit, else WO) with the list name
// after it — lists made by ✓ Confirm all share the template's name ("Type B kitchen"). The Stores pop-up / labels keep houseLabels.
// Fake Supabase only. Run: node tests/batch/a-labels.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const sleep = F.sleep;
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = F.v2Row();
    const o = (wo, floor, unit, cust) => H.order({ wo, customer: cust || 'Aderrig Homes', floor, unit, dueDate: '2026-10-22', origDueDate: '2026-10-22' });
    row.orders = [o('WO-1', 'GF', '12'), o('WO-2', '1', '14'), o('WO-3', '', ''), o('WO-4', 'GF', '12'), o('WO-5', '2', '<b>7</b>', 'Lucan Homes')];
    const S = F.makeServer(row);
    D.insert(S.db, 'projects', { id: 'P2', name: 'Lucan', customer: 'Lucan Homes' });
    const ln = [['saw', 'Side', '2', 2400, 600, 'MFC White', '', '']];
    F.seedList(S, 'L1', { name: 'Type B kitchen', wos: ['WO-1'], lines: ln });
    F.seedList(S, 'L2', { name: 'Type B kitchen', wos: ['WO-2'], lines: ln });
    F.seedList(S, 'L3', { name: 'Type B kitchen', wos: ['WO-3'], lines: ln });
    F.seedList(S, 'L4', { name: 'Type B kitchen', wos: ['WO-4'], lines: ln }); // the same Floor / Unit as L1 (two WOs for one unit)
    F.seedList(S, 'L5', { name: 'Type B kitchen', wos: [], lines: ln }); // no job
    const t = await F.dev(browser, S, 'saw'), p = t.page;
    await p.evaluate(() => { SB.read = true; SB.ids = ['L1', 'L2', 'L3', 'L4']; wlShowUpcoming = true; wlShowBatch = true; render(); }); await sleep(150);
    let b = await p.evaluate(() => ({ chips: [...document.querySelectorAll('.sb-chip')].map(c => c.innerText.replace(/\s+/g, ' ')), houses: [...document.querySelectorAll('.sb-hl .sb-hn b')].map(x => x.innerText.replace(/\s+/g, ' ')),
      apart: [...document.querySelectorAll('.sb-chip')].every(c => c.querySelectorAll('.sb-fu').length >= 1) }));
    rec('four lists all named "Type B kitchen": chips Floor / Unit (or WO), the list name after it', b.chips.join('|') === 'Floor GF Unit 12 Type B kitchen ×2|Floor 1 Unit 14 Type B kitchen ×2|WO-3 Type B kitchen ×2|Floor GF Unit 12 Type B kitchen (2) ×2', b.chips.join('|'));
    rec('Floor and Unit shown apart (own badges)', await p.evaluate(() => { const c = document.querySelector('.sb-chip'); return [...c.querySelectorAll('.sb-fu')].map(x => x.textContent).join('|') === 'Floor GF|Unit 12'; }));
    rec('"Houses in this batch" uses the same labels', b.houses.join('|') === 'Floor GF Unit 12 Type B kitchen|Floor 1 Unit 14 Type B kitchen|WO-3 Type B kitchen|Floor GF Unit 12 Type B kitchen (2)', b.houses.join('|'));
    // Stores pop-up / combineLists default output unchanged (houseLabels)
    const st = await p.evaluate(() => combineLists(lists().filter(l => ['L1', 'L2'].includes(l.id)), 'saw')[0].per);
    rec('combineLists without options keeps houseLabels ("Type B kitchen", "Type B kitchen (2)")', JSON.stringify(st) === '{"Type B kitchen":2,"Type B kitchen (2)":2}', JSON.stringify(st));
    // a list with no job, and a second project (escaped unit)
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L5'), { wos: ['WO-5'], project_id: 'P2' });
    await p.evaluate(async () => { lsReset(); await lsLoad(); SB.ids = ['L1', 'L5']; wlShowBatch = true; render(); }); await sleep(200);
    b = await p.evaluate(() => ({ chips: [...document.querySelectorAll('.sb-chip')].map(c => c.innerText.replace(/\s+/g, ' ')), bold: !!document.querySelector('.sb-chip b b') }));
    rec('two projects: project first; a unit with HTML is shown as text', b.chips.join('|') === 'Aderrig — Floor GF Unit 12 Type B kitchen ×2|Lucan — Floor 2 Unit <b>7</b> Type B kitchen ×2' && !b.bold, b.chips.join('|'));
    const lb = await p.evaluate(() => { const l = lsList('L1'); return sbUnitTxt(l) + ' / ' + sbUnitTxt({ name: 'Type B kitchen', wos: [] }); });
    rec('drop-out note text names the unit; a list with no job falls back to its name', lb === 'Floor GF Unit 12 ("Type B kitchen") / "Type B kitchen"', lb);
    const many = await p.evaluate(() => sbUnitTxt({ name: 'Type B kitchen', wos: ['WO-1', 'WO-2', 'WO-3', 'WO-5'] }) + ' / ' + sbUnitTxt({ name: 'Type B kitchen', wos: ['WO-1', 'WO-4', 'WO-2'] }));
    rec('a list on several WOs names each unit; more than 3 → the first two "+ N more"; the same unit once', many === 'Floor GF Unit 12 + Floor 1 Unit 14 + 2 more ("Type B kitchen") / Floor GF Unit 12 + Floor 1 Unit 14 ("Type B kitchen")', many);
    await p.setViewportSize({ width: 360, height: 740 }); await sleep(200);
    const sw = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, low: [...document.querySelectorAll('.sb-chip')].filter(c => c.getBoundingClientRect().height < 40).length }));
    rec('360 px: no sideways scroll, chips at least 40 px tall', sw.sw <= sw.vw && !sw.low, JSON.stringify(sw));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
