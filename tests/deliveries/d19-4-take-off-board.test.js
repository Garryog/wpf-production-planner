// d19-4 (Garry 19 Nov): × on a card still to plan = "Take off board", two steps: (a) a dialog saying what will happen;
// (b) type the WO number (or DELETE for a job added by hand) + pick a name; logged. Loaded / dispatched / delivered refused.
// A job added by hand is archived in 📚 Past weeks, never erased. A booked card's × still goes back to the pool (who / why).
// Fake Supabase only. Run: node tests/deliveries/d19-4-take-off-board.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '8. PALLETED', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-M1', title: 'Spare <b>doors</b>', customer: 'Cairn', value: 450, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
    O('WO-P1'), O('WO-L1', { delLoadedAt: '2026-11-17T08:00:00Z' }), O('WO-B1', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-16' })] };
  const t = await H.open({ browser, now: '2026-11-17T10:00:00Z', row }); const p = t.page;
  const ovl = () => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText.replace(/\s+/g, ' ') : ''; });
  const dx = wo => p.evaluate(wo => document.querySelector('[data-dx="' + wo + '"]').click(), wo);
  await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 200)); });
  const ttl = await p.evaluate(() => document.querySelector('[data-dx="WO-P1"]').title);
  rec('× on a card still to plan is "Take off board"', ttl === 'Take off board', ttl);
  // (a) what will happen — Cancel changes nothing
  await dx('WO-P1'); await p.waitForTimeout(100);
  const a = await ovl();
  rec('step (a): says exactly what happens (leaves Deliveries, stays on the Capacity Board / Cienapps, recorded)', /Take WO-P1 off the board\?/.test(a) && /stays on the Capacity Board and in Cienapps/.test(a) && /Recorded in its history/.test(a), a);
  await p.click('#pod-x'); await p.waitForTimeout(100);
  rec('Cancel at (a) → nothing changed', await p.evaluate(() => DB.orders.find(o => o.wo === 'WO-P1').delv === true && !document.querySelector('.pod-ovl')));
  // (b) typed WO
  await dx('WO-P1'); await p.waitForTimeout(100); await p.click('#tob-next'); await p.waitForTimeout(100);
  const b = await ovl();
  rec('step (b): asks to type the work order number', /type the work order number WO-P1/.test(b), b);
  await p.fill('#tob-t', 'WO-P2'); await p.click('#tob-go'); await p.waitForTimeout(100);
  const e1 = await p.evaluate(() => ({ err: (document.getElementById('tob-err') || {}).textContent || '', on: DB.orders.find(o => o.wo === 'WO-P1').delv }));
  rec('a wrong number → told, nothing changes', /not WO-P1/.test(e1.err) && e1.on === true, JSON.stringify(e1));
  await p.fill('#tob-t', 'wo-p1'); await p.click('#tob-go'); await p.waitForTimeout(150);
  const nm = await ovl();
  rec('right number → the name is asked (even with a name already on this PC)', /Who is making changes/.test(nm), nm);
  await p.fill('#pick-other', 'Mary'); await p.click('#pick-ok'); await p.waitForTimeout(150);
  const r1 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-P1'); return { delv: o.delv, on: !!document.querySelector('.dchip[data-dw="WO-P1"]'), log: (o.log || []).slice(-1)[0], still: !!DB.orders.find(x => x.wo === 'WO-P1') }; });
  rec('WO-P1 off the board, still on the planner, logged "Taken off the Deliveries board" by Mary', r1.delv === false && !r1.on && r1.still && r1.log && /Taken off the Deliveries board/.test(r1.log.what) && r1.log.by === 'Mary', JSON.stringify(r1));
  // loaded → refused
  await dx('WO-L1'); await p.waitForTimeout(100);
  const l = await p.evaluate(() => ({ ov: !!document.querySelector('.pod-ovl'), delv: DB.orders.find(o => o.wo === 'WO-L1').delv, toast: (document.getElementById('toast') || {}).textContent || '' }));
  rec('a LOADED job → refused ("clear its status first"), no dialog, nothing changes', !l.ov && l.delv === true && /clear its status first/.test(l.toast), JSON.stringify(l));
  // manual job → DELETE, archived
  await dx('JOB-M1'); await p.waitForTimeout(100);
  const m = await ovl();
  rec('job added by hand: (a) says it is archived in 📚 Past weeks, never erased', /archived in 📚 Past weeks/.test(m) && /never erased/.test(m) && !/<b>doors/.test(await p.evaluate(() => document.querySelector('.pod-ovl').innerHTML)), m);
  await p.click('#tob-next'); await p.waitForTimeout(100);
  await p.fill('#tob-t', 'JOB-M1'); await p.click('#tob-go'); await p.waitForTimeout(100);
  const e2 = await p.evaluate(() => ({ err: (document.getElementById('tob-err') || {}).textContent || '', n: (DB.delx || []).length }));
  rec('typing the job ref instead of DELETE → told, nothing changes', /Type DELETE/.test(e2.err) && e2.n === 1, JSON.stringify(e2));
  await p.fill('#tob-t', 'delete'); await p.click('#tob-go'); await p.waitForTimeout(150);
  await p.click('.pod-ovl [data-pick="Mary"]').catch(async () => { await p.fill('#pick-other', 'Mary'); await p.click('#pick-ok'); }); await p.waitForTimeout(150);
  const r2 = await p.evaluate(() => { const ar = DB.delArchive || {}; const ks = Object.keys(ar).filter(k => ar[k].off); const a = ks.length ? ar[ks[0]] : null;
    return { delx: (DB.delx || []).map(x => x.wo), n: ks.length, by: a && a.by, job: a && a.jobs[0] && { wo: a.jobs[0].wo, m: a.jobs[0].m, xt: a.jobs[0].x && a.jobs[0].x.title } }; });
  rec('JOB-M1 left the board and is archived (full copy kept, by Mary)', r2.delx.length === 0 && r2.n === 1 && r2.by === 'Mary' && r2.job && r2.job.wo === 'JOB-M1' && r2.job.m === 1 && r2.job.xt === 'Spare <b>doors</b>', JSON.stringify(r2));
  // saved to the (fake) database
  await p.waitForTimeout(1800);
  const sv = t.server.row.settings || {};
  rec('saved: the archive entry is in settings.delArchive, JOB-M1 not in settings.delx', Object.values(sv.delArchive || {}).some(a => a.off && a.jobs[0].wo === 'JOB-M1') && !(sv.delx || []).some(x => x.wo === 'JOB-M1'), JSON.stringify(Object.keys(sv.delArchive || {})));
  // Past weeks shows it
  await p.evaluate(() => openDelArchive()); await p.waitForTimeout(100);
  const pw = await ovl();
  rec('📚 Past weeks lists "🗄 Taken off the board … JOB-M1 · by Mary"', /Taken off the board/.test(pw) && /JOB-M1 · by Mary/.test(pw), pw.slice(0, 300));
  await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // booked card × → back to the pool (the who / why flow), not the new dialog
  await dx('WO-B1'); await p.waitForTimeout(150);
  const bk = await ovl();
  rec('booked card × → still "back to the pool" with the reason picker (not Take off board)', /Why is WO-B1 moving\?/.test(bk) && !/Take WO-B1 off/.test(bk), bk.slice(0, 200));
  // Manager 20 Nov: the "taken off" record is only cleared for the SAME job (its hidden id), never by a reused reference
  const T = await p.evaluate(() => {
    const mk = (k, wo, jid) => { DB.delArchive[k] = { at: '2026-11-10T10:00:00Z', w: '', by: 'Ann', off: true, why: 'Taken off the board', notes: {}, pod: {}, jobs: [{ wo, t: 'old', c: 'x', m: 1, x: Object.assign({ wo, title: 'old', manual: true }, jid ? { jid } : {}) }] }; };
    DB.delArchive = DB.delArchive || {};
    mk('~off.t1', 'Remedial', 'J-old'); mk('~off.t2', 'Remedial2', ''); mk('~off.t3', 'Same', 'J-same');
    DB.delx = (DB.delx || []).concat([{ wo: 'Remedial', title: 'new job, same ref', manual: true, jid: 'J-new' }, { wo: 'Remedial2', title: 'new, no id', manual: true }, { wo: 'Same', title: 'same job', manual: true, jid: 'J-same' }]);
    const n = delOffTidy();
    return { n, t1: !!DB.delArchive['~off.t1'], t2: !!DB.delArchive['~off.t2'], t3: !!DB.delArchive['~off.t3'] };
  });
  rec('a reused reference ("Remedial", another job) never clears the old "taken off" record', T.t1, JSON.stringify(T));
  rec('a job with no id (added before this release) never clears a record either', T.t2, JSON.stringify(T));
  rec('the SAME job (same hidden id) live on the board → its stale "taken off" record is cleared', !T.t3 && T.n === 1, JSON.stringify(T));
  const jid = await p.evaluate(() => { document.getElementById('aj-title').value = 'Remedial work'; document.getElementById('aj-wo').value = 'Remedial-9'; document.getElementById('aj-add').click(); const x = DB.delx.find(z => z.wo === 'Remedial-9'); return x && x.jid; });
  rec('＋ Add Job gives the job its hidden id', /^J/.test(jid || ''), jid);
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
})();
