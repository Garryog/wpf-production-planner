// TESTER ATTACK (Stage 2): Shipped tab, shipped jobs out of every total, weeks across clock changes, Week Summary caps.
// Supabase stubbed (tests/harness.js). Run: node tests/stage2/attack-shipped.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-19T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  let t;
  const orders = [
    H.order({ wo: 'WO-1', title: "O'Grady <script>alert(1)</script> kitchen with a very very very very long title that goes on", customer: 'Café 😀 "Quotes" & Co', plannedWeek: '2026-10-19', hours: 40, value: 10000, orderNo: '77', unit: '5', floor: '1', shippedAt: '2026-10-18T10:00:00Z', cienStep: '8. Job shipped' }),
    H.order({ wo: 'WO-2', plannedWeek: '2026-10-19', hours: 10, value: 3000, orderNo: '77', unit: '5', floor: '1' }),
    H.order({ wo: 'WO-3', plannedWeek: '2026-10-19', hours: 5, value: 1000, shippedAt: '2026-10-17T10:00:00Z', completeAt: '2026-10-18T10:00:00Z', completeBy: 'Pat' }),
  ];
  t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 4, orders, settings: { weekCaps: { '2026-10-19': 50 } } } });
  const x = await t.page.evaluate(() => {
    const r = {};
    r.hrs = wkHrs('2026-10-19'); r.val = wkVal('2026-10-19'); r.cnt = wkCnt('2026-10-19');
    showTab('b'); r.board = [...document.querySelectorAll('tr[data-wo]')].map(e => e.dataset.wo);
    r.boardTxt = document.getElementById('app').innerText;
    r.partLoad = partLoadGaps([DB.orders[1]]).map(g => g.wo);
    // Offline snapshot + Full Schedule export
    let snapHtml = ''; const ow = window.open; window.open = () => ({ document: { write(h) { snapHtml += h; }, close() {} }, focus() {}, print() {} });
    const oc = document.createElement; let blobTxt = '';
    const OB = window.Blob; window.Blob = function (parts, o) { blobTxt += parts.join(''); return new OB(parts, o); };
    try { exportSnapshot(); } catch (e) { r.snapErr = e.message; }
    window.Blob = OB; window.open = ow;
    const html = snapHtml || blobTxt;
    const m = html.match(/Wk \d+ · 19 Oct <span>([^<]*)<\/span>/);
    r.snapWeek = m ? m[1] : html ? '(week heading not found)' : '(no snapshot captured)';
    let summ; const o = XLSX.writeFile; XLSX.writeFile = wb => { summ = XLSX.utils.sheet_to_json(wb.Sheets['Week Summary'], { header: 1 }); }; showTab('x'); document.getElementById('btn-xfull').click(); XLSX.writeFile = o;
    r.summ = summ[1];
    showTab('h'); r.shTxt = document.getElementById('app').innerText; r.scripts = document.querySelectorAll('#app script').length;
    r.cards = document.querySelectorAll('.sh-card').length;
    return r;
  });
  rec('shipped job out of week hours/value/count', x.hrs === 10 && x.val === 3000 && x.cnt === 1, JSON.stringify([x.hrs, x.val, x.cnt]));
  rec('shipped job off the Capacity Board', x.board.join() === 'WO-2', x.board.join());
  rec('part-load guard ignores a shipped (not on a van) job of the same unit', !x.partLoad.includes('WO-1'), x.partLoad.join());
  rec('Week Summary: 10h of 50h cap (week cap used, shipped excluded)', x.summ && x.summ[3] === 10 && x.summ[4] === 50, JSON.stringify(x.summ));
  rec('Offline Snapshot week totals leave shipped jobs out like the board does', !/55h|3 jobs/.test(x.snapWeek) && !x.snapErr, x.snapErr || x.snapWeek);
  rec('Shipped tab: names with <script>, quotes, emoji, apostrophes render as text', x.scripts === 0 && x.shTxt.includes("O'Grady <script>") && x.shTxt.includes('Café 😀 "Quotes" & Co'), 'scripts=' + x.scripts);
  rec('Shipped tab hides completed by default (1 card)', x.cards === 1, String(x.cards));
  // search by customer, unit, floor; bring back of a completed job
  const s = await t.page.evaluate(() => {
    const q = v => { const i = document.getElementById('sh-q'); i.value = v; i.oninput.call(i); return document.querySelectorAll('.sh-card').length; };
    showTab('h'); const a = q('café'), b = q('WO-1'), c = q('xyz'); q('');
    document.getElementById('sh-done').click(); const all = document.querySelectorAll('.sh-card').length;
    document.querySelector('[data-shb="WO-3"]').click();
    const o3 = DB.orders.find(o => o.wo === 'WO-3');
    return { a, b, c, all, back: !isShipped(o3), compl: o3.completeAt || '', hrs: wkHrs('2026-10-19') };
  });
  rec('Shipped search: customer / WO / miss', s.a === 1 && s.b === 1 && s.c === 0, JSON.stringify(s));
  rec('Bring back a completed job: back on board, totals include it, complete cleared', s.back && !s.compl && s.hrs === 15, JSON.stringify(s));
  // phone 360px
  await t.page.setViewportSize({ width: 360, height: 740 });
  const ph = await t.page.evaluate(() => { showTab('h'); shDone = true; render(); const sw = document.documentElement.scrollWidth; const btns = [...document.querySelectorAll('.sh-card button')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.right), Math.round(r.height)]; }); const tab = document.getElementById('t-h'); const tr = tab.getBoundingClientRect(); return { sw, btns, tabVisible: tr.width > 0 && tr.height > 0, cardsW: [...document.querySelectorAll('.sh-card')].map(c => Math.round(c.getBoundingClientRect().right)) }; });
  rec('phone 360px: no sideways scroll on Shipped, buttons inside the screen and >= 32px tall', ph.sw <= 362 && ph.btns.every(b => b[0] <= 360 && b[1] >= 32) && ph.cardsW.every(r => r <= 360), JSON.stringify(ph));
  rec('phone 360px: Shipped tab button reachable', ph.tabVisible, JSON.stringify(ph));
  await t.close();

  // waiting line on a COMPLETED shipped job: does it come back into view?
  {
    const ROWS = [{ k: 'saw', item: 'Side', qty: 2, L: 2400, W: 600, mat: 'MFC', note: '' }];
    const row = { id: 'main', nid: 3, orders: [H.order({ wo: 'WO-6-1', plannedWeek: '2026-10-19', hours: 12, shippedAt: '2026-10-18T10:00:00Z', completeAt: '2026-10-18T12:00:00Z' })], settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'P', saw: 1, fit: 0, wos: ['WO-6-1'], up: NOW }], listWBs: { W1: { project: 'P', sheets: { H1: ROWS } } } } };
    t = await H.open({ browser, now: NOW, row });
    const w = await t.page.evaluate(() => { const l = lists()[0]; holdRows(l, [rowKey(listRows(l)[0])], 'saw', 'T'); showTab('b'); const onBoard = !!document.querySelector('tr[data-wo="WO-6-1"]'); showTab('h'); const onShipped = document.getElementById('app').innerText.includes('WO-6-1'); const badge = (document.getElementById('t-h').innerText.match(/\d+/) || [''])[0]; return { onBoard, onShipped, hrs: wkHrs('2026-10-19'), badge }; });
    rec('waiting line on an installation-complete shipped job brings it back into view somewhere', w.onBoard || w.onShipped, JSON.stringify(w));
    await t.close();
  }

  // Weeks: 8 distinct Mondays across Oct 2026 and March 2027 clock changes, Dublin and other zones, late Sunday evening
  for (const [now, tz] of [['2026-10-12T10:00:00Z', 'Europe/Dublin'], ['2026-10-25T00:30:00Z', 'Europe/Dublin'], ['2026-10-25T23:30:00Z', 'Europe/Dublin'], ['2027-03-08T10:00:00Z', 'Europe/Dublin'], ['2027-03-28T00:30:00Z', 'Europe/Dublin'], ['2027-03-28T22:59:00Z', 'Europe/Dublin'], ['2026-12-28T10:00:00Z', 'Europe/Dublin'], ['2027-03-08T10:00:00Z', 'America/New_York']]) {
    t = await H.open({ browser, now, tz });
    const w = await t.page.evaluate(() => ({ w: get8Wks(), lbl: get8Wks().map(wkLbl) }));
    const ok = new Set(w.w).size === 8 && w.w.every((k, i) => new Date(k + 'T00:00:00Z').getUTCDay() === 1 && (i === 0 || (new Date(k) - new Date(w.w[i - 1])) === 7 * 86400000));
    rec('8 distinct consecutive Mondays at ' + now + ' ' + tz, ok, w.w.join(' '));
    rec('week labels distinct at ' + now + ' ' + tz, new Set(w.lbl).size === 8, w.lbl.join(' | '));
    await t.close();
  }
  // Week Summary: per-week capacity for each of the 8 weeks
  t = await H.open({ browser, now: NOW, row: { id: 'main', nid: 2, settings: { wcap: 350, weekCaps: { '2026-10-26': 100, '2026-11-09': 0.5, '2026-12-07': 400 } }, orders: [H.order({ wo: 'WO-1', plannedWeek: '2026-10-26', hours: 100 })] } });
  const ws = await t.page.evaluate(() => { let c; const o = XLSX.writeFile; XLSX.writeFile = wb => { c = XLSX.utils.sheet_to_json(wb.Sheets['Week Summary'], { header: 1 }); }; showTab('x'); document.getElementById('btn-xfull').click(); XLSX.writeFile = o; return c.slice(1).map(r => r[1] + ':' + r[4] + ':' + r[5] + ':' + r[6]); });
  rec('Week Summary: each week uses its own capacity; 100h of 100h = OVER', ws[1] === '2026-10-26:100:100%:OVER' && ws[0].endsWith(':350:0%:OK') && ws[7] === '2026-12-07:400:0%:OK', ws.join(' '));
  await t.close();
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
