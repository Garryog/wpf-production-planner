// d19-5 (Garry 19 Nov): "↩ Clear status" asks to confirm + a name (logged). "↩ Back to Deliveries" on the 📦 Shipped card and on
// each job row in 📚 Past weeks: name + reason; old delivered stamps into the history; stamps cleared; delv = true; pool card
// "↩ brought back — rebook". A step-9 job also gets shipBack (the next import still saying 9 does not ship it again). A job added
// by hand, delivered and removed at week close, is rebuilt from its Past weeks row. Fake Supabase only.
// Run: node tests/deliveries/d19-5-clear-and-back.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '8. PALLETED', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
const S9 = '9. JOB SHIPPED';
(async () => {
  const browser = await H.chromium.launch();
  const AK = '2026-11-14.abc';
  const row = { id: 'main', nid: 9, settings: { delx: [], delArchive: { [AK]: { at: '2026-11-14T16:00:00Z', w: '2026-11-09', by: 'Pat', notes: {}, pod: {}, jobs: [
    { wo: 'WO-D1', t: 'House D1', c: 'ASPECT', f: '', u: '', v: 'VOLVO', d: 'Tue', dt: '2026-11-10', val: 900, lAt: '', dAt: '', vAt: '2026-11-10T12:00:00Z', lBy: '', vBy: 'Joe', mv: [], fd: '', mw: null },
    { wo: 'JOB-M9', t: 'Old spare doors', c: 'Cairn', f: '', u: '', v: 'IVECO', d: 'Wed', dt: '2026-11-11', val: 120, lAt: '', dAt: '', vAt: '2026-11-11T12:00:00Z', lBy: '', vBy: 'Joe', mv: [], fd: '', mw: null },
    { wo: 'JOB-M8', t: 'Worktop <b>offcut</b>', c: 'Kildare', f: '', u: '', v: 'IVECO', d: 'Wed', dt: '2026-11-11', val: 80, lAt: '', dAt: '', vAt: '2026-11-11T12:00:00Z', lBy: '', vBy: 'Joe', mv: [], fd: '', mw: null, m: 1, x: { wo: 'JOB-M8', title: 'Worktop <b>offcut</b>', customer: 'Kildare', value: 80, manual: true, delVeh: 'IVECO', delDay: 'Wed', delWk: '2026-11-09', delDone: true, delDelivAt: '2026-11-11T12:00:00Z', delivBy: 'Joe' } }] } } }, orders: [
    O('WO-C1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-16', delLoadedAt: '2026-11-17T07:00:00Z', delDispAt: '2026-11-17T08:00:00Z', delDelivAt: '2026-11-17T09:30:00Z', delivBy: 'Joe', delDone: true }),
    O('WO-S9', { step: S9, cienStep: S9, shippedAt: '2026-11-12T10:00:00Z', shippedStep: S9, delv: undefined, delDone: true }),
    O('WO-D1', { step: S9, cienStep: S9, delv: undefined, delDone: true })] };
  const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row }); const p = t.page;
  const ovl = () => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText.replace(/\s+/g, ' ') : ''; });
  const name = async n => { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); };
  const why = async w => { await p.click('.pod-ovl [data-why="' + w + '"]'); await p.waitForTimeout(200); };
  await p.evaluate(() => { window.__asked = []; window.__ans = false; window.confirm = m => { window.__asked.push(String(m)); return window.__ans; }; });
  // ---- 1. Clear status: confirm + name
  await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); document.querySelector('[data-dd="WO-C1"]').click(); });
  await p.click('.pod-ovl [data-st="clear"]'); await p.waitForTimeout(100);
  const c0 = await p.evaluate(() => ({ asked: window.__asked.slice(), st: dStage(DB.orders.find(o => o.wo === 'WO-C1')) }));
  rec('↩ Clear status asks first; Cancel → still DELIVERED', c0.asked.length === 1 && /Clear the DELIVERED status of WO-C1\?/.test(c0.asked[0]) && c0.st === 'deliv', JSON.stringify(c0));
  await p.evaluate(() => { window.__ans = true; document.querySelector('[data-dd="WO-C1"]').click(); }); await p.click('.pod-ovl [data-st="clear"]'); await p.waitForTimeout(100);
  rec('…OK → the name is asked', /Who is making changes/.test(await ovl()));
  await name('Mary');
  const c1 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-C1'); return { st: dStage(o), day: o.delVeh + '|' + o.delDay, by: o.delivBy || '', log: (o.log || []).slice(-1)[0] }; });
  rec('status cleared (still on its van and day), logged with the name and the old stamps', c1.st === '' && c1.day === 'VOLVO|Tue' && !c1.by && c1.log && c1.log.by === 'Mary' && /Delivery status cleared \(was DELIVERED · loaded .* · delivered 17 Nov .* by Joe/.test(c1.log.what), JSON.stringify(c1));
  // ---- 2. Shipped tab: ↩ Back to Deliveries on a step-9 job
  await p.evaluate(async () => { showTab('h'); await new Promise(r => setTimeout(r, 150)); });
  rec('📦 Shipped card has "↩ Back to Deliveries"', await p.evaluate(() => !!document.querySelector('[data-shd="WO-S9"]')));
  await p.click('[data-shd="WO-S9"]'); await p.waitForTimeout(100); await name('Mary');
  const rs = await ovl();
  rec('…asks why (reason list) and says it comes back to the Capacity Board too', /Why is WO-S9 coming back to Deliveries\?/.test(rs) && /Capacity Board/.test(rs), rs.slice(0, 300));
  await why('Damaged / returned — deliver again');
  const s1 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-S9'); return { delv: o.delv, done: o.delDone, sh: !!o.shippedAt, sb: o.shipBack && o.shipBack.cs, rb: o.delRebook, log: (o.log || []).map(l => l.what + ' [' + l.by + '|' + (l.why || '') + ']') }; });
  rec('WO-S9: back on Deliveries (delv, not delivered), off Shipped with shipBack (cs = 9), marked brought back', s1.delv === true && s1.done === false && !s1.sh && s1.sb === S9 && s1.rb && s1.rb.back && s1.rb.by === 'Mary', JSON.stringify(s1));
  rec('…the old delivered stamp went into its history with name + reason', s1.log.some(l => /Brought back to Deliveries — was · delivered \(no time\)/.test(l) && /Mary\|Damaged/.test(l)), JSON.stringify(s1.log));
  await p.evaluate(async () => { showTab('d'); delTab = '0'; render(); await new Promise(r => setTimeout(r, 100)); });
  const pc = await p.evaluate(() => { const c = document.querySelector('.dchip[data-dw="WO-S9"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
  rec('pool card says "↩ brought back — rebook"', /↩ brought back — rebook/.test(pc), pc);
  // the next import still saying 9 does not ship it again
  await H.importAoa(p, [['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'], ['WO-S9', 'House WO-S9', 'ASPECT', 46345, S9, 1000], ['WO-C1', 'House WO-C1', 'ASPECT', 46345, '8. PALLETED', 1000], ['WO-D1', 'House WO-D1', 'ASPECT', 46345, S9, 1000]]);
  await p.evaluate(() => applyImport(IMPPLAN)); await p.waitForTimeout(300);
  const s2 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-S9'); return { sh: !!o.shippedAt, delv: o.delv }; });
  rec('import still saying 9 → WO-S9 NOT shipped again, still on Deliveries', !s2.sh && s2.delv === true, JSON.stringify(s2));
  // ---- 3. Past weeks rows
  await p.evaluate(() => openDelArchive('2026-11-14.abc')); await p.waitForTimeout(100);
  const pw = await p.evaluate(() => [...document.querySelectorAll('[data-arcb]')].map(b => b.closest('tr').children[2].textContent));
  rec('📚 Past weeks: "↩ Back to Deliveries" on WO-D1 (Cienapps job), JOB-M9 (old row) and JOB-M8 (job added by hand)', ['WO-D1', 'JOB-M9', 'JOB-M8'].every(w => pw.includes(w)), JSON.stringify(pw));
  await p.evaluate(() => [...document.querySelectorAll('[data-arcb]')].find(b => b.closest('tr').children[2].textContent === 'JOB-M8').click()); await p.waitForTimeout(100);
  await name('Mary'); await why('Not delivered after all');
  const m8 = await p.evaluate(() => { const x = (DB.delx || []).find(j => j.wo === 'JOB-M8'); const j = DB.delArchive['2026-11-14.abc'].jobs[2]; return { x: x && { t: x.title, m: x.manual, day: x.delDay, done: x.delDone, dv: x.delDelivAt || '', rb: !!(x.delRebook && x.delRebook.back) }, back: j.back && j.back.by, kept: DB.delArchive['2026-11-14.abc'].jobs.length }; });
  rec('JOB-M8 rebuilt from its Past weeks row (title, hand job, not booked, not delivered, brought back); row kept + marked', m8.x && m8.x.t === 'Worktop <b>offcut</b>' && m8.x.m && !m8.x.day && m8.x.done === false && !m8.x.dv && m8.x.rb && m8.back === 'Mary' && m8.kept === 3, JSON.stringify(m8));
  await p.evaluate(() => openDelArchive('2026-11-14.abc')); await p.waitForTimeout(100);
  const pw2 = await p.evaluate(() => ({ btn: [...document.querySelectorAll('[data-arcb]')].map(b => b.closest('tr').children[2].textContent), html: document.querySelector('.pod-ovl').innerHTML }));
  rec('…its row now says "↩ brought back · Mary" (no second button); title HTML stays text', !pw2.btn.includes('JOB-M8') && /↩ brought back 17 Nov · Mary/.test(pw2.html) && !/<b>offcut/.test(pw2.html), JSON.stringify(pw2.btn));
  await p.evaluate(() => [...document.querySelectorAll('[data-arcb]')].find(b => b.closest('tr').children[2].textContent === 'JOB-M9').click()); await p.waitForTimeout(100);
  await name('Mary'); await why('Not delivered after all');
  const m9 = await p.evaluate(() => { const x = (DB.delx || []).find(j => j.wo === 'JOB-M9'); return x && { t: x.title, c: x.customer, v: x.value, m: x.manual }; });
  rec('JOB-M9 (old row, no full copy) rebuilt from the row: title, customer, value', m9 && m9.t === 'Old spare doors' && m9.c === 'Cairn' && m9.v === 120 && m9.m, JSON.stringify(m9));
  await p.evaluate(() => openDelArchive('2026-11-14.abc')); await p.waitForTimeout(100);
  await p.evaluate(() => [...document.querySelectorAll('[data-arcb]')].find(b => b.closest('tr').children[2].textContent === 'WO-D1').click()); await p.waitForTimeout(100);
  await name('Mary'); await why('Marked delivered by mistake');
  const d1 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D1'); return { delv: o.delv, done: o.delDone, rb: !!(o.delRebook && o.delRebook.back), on: delOnPage(o) }; });
  rec('WO-D1 (Cienapps job) back on Deliveries from Past weeks', d1.delv && d1.done === false && d1.rb && d1.on, JSON.stringify(d1));
  await H.importAoa(p, [['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'], ['WO-S9', 'House WO-S9', 'ASPECT', 46345, S9, 1000], ['WO-C1', 'House WO-C1', 'ASPECT', 46345, '8. PALLETED', 1000], ['WO-D1', 'House WO-D1', 'ASPECT', 46345, S9, 1000]]);
  await p.evaluate(() => applyImport(IMPPLAN)); await p.waitForTimeout(300);
  const d2 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D1'); return { sh: !!o.shippedAt, sb: o.shipBack && o.shipBack.cs, delv: o.delv }; });
  rec('WO-D1 (Cienapps 9, not on the Shipped tab) got shipBack too → the next import still saying 9 does not ship it', !d2.sh && d2.sb === S9 && d2.delv === true, JSON.stringify(d2));
  await p.waitForTimeout(1800);
  const sv = t.server.row;
  rec('saved to the (fake) database: JOB-M8 / JOB-M9 in settings.delx, WO-D1 tagged', (sv.settings.delx || []).some(x => x.wo === 'JOB-M8') && (sv.settings.delx || []).some(x => x.wo === 'JOB-M9') && sv.orders.find(o => o.wo === 'WO-D1').delv === true);
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})();
