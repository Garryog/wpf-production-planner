// Dates & deliveries (Job A): the Change-dates dialog, clicked like a user would. Board due badge → dialog →
// date + reason → Move date; Other needs a note; bank holiday "Use 24 Dec" button; board selection bar group move +
// summary; delivery card due date opens the same dialog; a group row's due date moves every member; floor/saw roles
// can't move dates. Stubbed Supabase only.  Run: node tests/dates/c2-dialog.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '3. In production', customer: 'CAIRN', title: 'House ' + wo }, x));
  const row = { id: 'main', nid: 5, settings: { grps: { g1: { title: 'Block A' } } }, orders: [
    O('WO-1'), O('WO-2', { delv: true, delVeh: 'VOLVO', delDay: 'Thu' }), O('WO-3'), O('WO-4'),
    O('WO-5', { grp: 'g1' }), O('WO-6', { grp: 'g1', dueDate: '2026-11-19', origDueDate: '2026-11-19' }),
    O('WO-<b>7', { title: '<img src=x onerror=window.__xss=1>' })
  ] };
  const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row });
  const p = t.page;
  await p.evaluate(() => showTab('b')); await w(200);
  // 1. single job from the board
  await p.click('[data-duedlg="WO-1"]'); await w(150);
  const open1 = await p.evaluate(() => { const d = document.getElementById('date-dlg'); return d ? { txt: d.innerText, ok: d.querySelector('#dm-ok').disabled } : null; });
  rec('tapping the due badge opens "Change dates" with the job', !!open1 && /Change dates — WO-1/.test(open1.txt) && open1.ok, open1 && open1.txt.slice(0, 120));
  await p.fill('#dm-date', '2026-11-27'); await w(50);
  const noWhy = await p.evaluate(() => document.getElementById('dm-ok').disabled);
  rec('Move date stays disabled until a reason is picked', noWhy);
  await p.click('[data-dmwhy="Other"]'); await w(50);
  const otherNoNote = await p.evaluate(() => document.getElementById('dm-ok').disabled);
  rec('"Other" needs a note', otherNoNote);
  await p.click('[data-dmwhy="Customer delay"]'); await w(50);
  const prevTxt = await p.evaluate(() => document.getElementById('dm-prev').innerText);
  rec('preview shows the week change', /Wk 47.*→.*Wk 48/s.test(prevTxt), prevTxt.replace(/\n/g, ' '));
  await p.click('#dm-ok'); await w(200);
  const a = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); return { due: o.dueDate, wk: o.plannedWeek, hist: o.dueHist, by: o.dueHist && o.dueHist[0].by, dlg: !!document.getElementById('date-dlg'), chip: !!document.querySelector('[data-duehist="WO-1"]') }; });
  rec('Move date writes the job (Tester = person at this PC) and shows "moved 1×"', a.due === '2026-11-27' && a.wk === '2026-11-23' && a.by === 'Tester' && !a.dlg && a.chip, JSON.stringify(a));
  // 2. bank holiday → "Use 24 Dec"
  await p.click('[data-duedlg="WO-3"]'); await w(100);
  await p.fill('#dm-date', '2026-12-25'); await w(50);
  const bh = await p.evaluate(() => document.getElementById('dm-prev').innerText);
  rec('25 Dec warns "bank holiday"', /bank holiday/.test(bh), bh.replace(/\n/g, ' '));
  await p.click('#dm-prevwd'); await w(50);
  const v = await p.evaluate(() => document.getElementById('dm-date').value);
  rec('"Use 24 Dec" puts in the working day before', v === '2026-12-24', v);
  await p.click('#pod-x'); await w(50);
  const unchanged = await p.evaluate(() => DB.orders.find(x => x.wo === 'WO-3').dueDate);
  rec('Cancel changes nothing', unchanged === '2026-11-20', unchanged);
  // 3. selection bar group move +2 weeks
  await p.evaluate(() => { grpSel.add('WO-3'); grpSel.add('WO-4'); grpSel.add('WO-2'); render(); }); await w(100);
  await p.click('#btn-gdates'); await w(100);
  await p.check('[name="dmm"][value="shift"]'); await p.fill('#dm-n', '2'); await p.click('[data-dmwhy="Materials"]'); await w(50);
  const gp = await p.evaluate(() => document.getElementById('dm-prev').innerText);
  await p.click('#dm-ok'); await w(200);
  const g = await p.evaluate(() => ({ d: ['WO-2', 'WO-3', 'WO-4'].map(w => DB.orders.find(x => x.wo === w).dueDate), van: DB.orders.find(x => x.wo === 'WO-2').delDay, sum: (document.getElementById('date-sum') || {}).innerText || '' }));
  rec('group preview lists each job, van pull shown', /WO-2/.test(gp) && /WO-4/.test(gp) && /rebook/.test(gp), gp.replace(/\n/g, ' ').slice(0, 300));
  rec('group +2 weeks moved all three; booked one off the van', g.d.every(x => x === '2026-12-04') && !g.van, JSON.stringify(g.d) + ' van=' + g.van);
  rec('summary: "3 moved · … 1 taken off vans"', /3 moved/.test(g.sum) && /1 taken off vans/.test(g.sum), g.sum.replace(/\n/g, ' '));
  await p.click('#date-sum #pod-x'); await w(50);
  // 4. group row's due date → all members
  await p.evaluate(() => { grpSel.clear(); render(); }); await w(100);
  await p.click('[data-gduedlg="g1"]'); await w(100);
  await p.fill('#dm-date', '2026-12-01'); await p.click('[data-dmwhy="Site not ready"]'); await w(50); await p.click('#dm-ok'); await w(200);
  const gr = await p.evaluate(() => ['WO-5', 'WO-6'].map(w => DB.orders.find(x => x.wo === w).dueDate));
  rec('group row due date moves every member', gr.every(x => x === '2026-12-01'), JSON.stringify(gr));
  await p.click('#date-sum #pod-x').catch(() => {}); await w(50);
  // 5. delivery card due date
  // (Tester, 10 Nov — week tabs, Garry 9 Nov: a "rebook" job sits in the pool of its DUE week's tab, so open that tab first)
  await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150));
    const wk = delPoolWk(DB.orders.find(o => o.wo === 'WO-2')), t = ['0', '1', '2', '3'].find(x => delTabWk(x) === wk) || 'later';
    const b = document.querySelector('[data-deltab="' + t + '"]'); if (b) b.click(); }); await w(200);
  const card = await p.evaluate(() => { const c = document.querySelector('.dchip[data-dw="WO-2"]'); return c ? c.innerText : ''; });
  rec('delivery card shows "date moved — rebook" and its due date', /rebook/.test(card) && /Due Fri 4 Dec · Wk 49/.test(card) /*v-deliv: due tag text (was "due 4 Dec")*/, card.replace(/\n/g, ' '));
  await p.click('.dchip[data-dw="WO-2"] [data-duedlg]'); await w(100);
  const dd = await p.evaluate(() => !!document.getElementById('date-dlg') && !delSel.has('WO-2'));
  rec('tapping the due date on a delivery card opens the dialog (does not select the card)', dd);
  await p.click('#pod-x'); await w(50);
  // 6. escaping
  await p.evaluate(() => showTab('b')); await w(150);
  await p.click('[data-duedlg="WO-<b>7"]'); await w(100);
  const x = await p.evaluate(() => ({ xss: !!window.__xss, img: !!document.querySelector('#date-dlg img'), head: document.querySelector('#date-dlg').innerText.slice(0, 60) }));
  rec('WO / title are escaped in the dialog', !x.xss && !x.img && /WO-<b>7/.test(x.head), JSON.stringify(x));
  await p.click('#pod-x'); await w(50);
  // 7. floor role can't move dates
  const fl = await p.evaluate(() => { ROLE = 'floor'; const n = document.querySelectorAll('.pod-ovl').length; dateDlg(['WO-1']); const m = document.querySelectorAll('.pod-ovl').length; ROLE = 'office'; return m === n; });
  rec('floor / saw / driver screens cannot open the date dialog', fl);
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
