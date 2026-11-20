// attack20-2 (Tester, 20 Nov 2026): re-attack the attack19 flow fixes.
//  1. 🚚 Book N skips loaded / delivered / on hold (a ticked job that goes on hold by import before Book) and says which
//  2. a reused hand-job reference ("Remedial") keeps the OLD job's "taken off" record in 📚 Past weeks (also after a reload)
//  3. a job brought back from Past weeks twice (same PC, two rows of two weeks, two PCs)
//  4. Close week with "~off." entries present: 26-week trim, scorecard rows, Past weeks order (newest first by date)
// Fake Supabase only. Run: node tests/deliveries/attack20-2-flows.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, recorder, save, reload, O, W0 } = M;
const { rec, done } = recorder('attack20-2-flows');
const NAME = async (p, n) => { if (await p.$('#pick-other')) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
const imp = async (p, rows) => { await H.importAoa(p, [HDR, ...rows]); return p.evaluate(async () => { const ok = !!IMPPLAN; applyImport(IMPPLAN); await new Promise(r => setTimeout(r, 250)); return ok; }); };
const toast = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
async function takeOff(p, wo, typed) {
  await p.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('d'); await new Promise(r => setTimeout(r, 120)); });
  const ok = await p.evaluate(wo => { const b = [...document.querySelectorAll('[data-dx]')].find(x => x.dataset.dx === wo); if (!b) return false; b.click(); return true; }, wo);
  if (!ok) return 'no × button';
  await p.waitForTimeout(80); await p.click('#tob-next'); await p.fill('#tob-t', typed); await p.click('#tob-go'); await p.waitForTimeout(100); await NAME(p, 'Ann'); return 'ok';
}
const addJob = (p, wo, title) => p.evaluate(async ({ wo, title }) => { showTab('d'); await new Promise(r => setTimeout(r, 100)); document.getElementById('aj-title').value = title; document.getElementById('aj-wo').value = wo; document.getElementById('aj-cust').value = 'Cairn'; document.getElementById('aj-val').value = '50'; document.getElementById('aj-add').click(); await new Promise(r => setTimeout(r, 100)); return (DB.delx || []).filter(x => x.wo === wo).map(x => x.jid); }, { wo, title });
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1. Book N skip
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-2711-1'), O('WO-2712-1', { delDone: true, delDelivAt: '2026-11-11T09:00:00Z' }),
        O('WO-2713-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delLoadedAt: '2026-11-10T07:00:00Z' }), O('WO-2714-1'), O('WO-2715-1', { delVeh: 'IVECO', delDay: 'Wed', delWk: W0, delDispAt: '2026-11-11T07:00:00Z' })] });
      const A = await openRef(browser, S, ''); const p = A.page;
      await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 120)); });
      for (const wo of ['WO-2711-1', 'WO-2712-1', 'WO-2713-1', 'WO-2714-1', 'WO-2715-1']) await p.evaluate(wo => { const c = document.querySelector('.dchip[data-dw="' + wo + '"] .dtick'); c && c.click(); }, wo);
      // WO-2714-1 goes on hold by an import while ticked
      await imp(p, [['WO-2714-1', 'House', 'CAIRN', 46339, '12. ON HOLD', 1000]]);
      await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 120)); window.confirm = () => true; });
      const cnt = await p.evaluate(() => (document.getElementById('selcnt') || {}).textContent || '');
      await p.selectOption('#selveh', 'VOLVO'); await p.selectOption('#selday', 'Fri'); await p.click('#selbook'); await p.waitForTimeout(150);
      if (await p.$('.pod-ovl [data-why]')) { await p.click('.pod-ovl [data-why]'); await p.waitForTimeout(150); }
      await p.waitForTimeout(150);
      const r = await p.evaluate(() => ['WO-2711-1', 'WO-2712-1', 'WO-2713-1', 'WO-2714-1', 'WO-2715-1'].map(w => { const o = findDel(w); return w + ':' + (o.delVeh || '') + '|' + (o.delDay || ''); }));
      const tt = await toast(p);
      rec('1: Book → only the plain job goes on VOLVO Fri; delivered / loaded / on the road / on hold stay where they are', r[0].endsWith('VOLVO|Fri') && !/VOLVO\|Fri/.test(r.slice(1).join(' ')), JSON.stringify(r));
      rec('1: …and it says which were not booked and why', /WO-2712-1/.test(tt) && /WO-2713-1/.test(tt) && /WO-2715-1/.test(tt), tt);
      rec('INFO 1: bar count with an on-hold job ticked', true, cnt);
      // all ticked skipped → nothing booked, told
      await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
      await p.evaluate(async () => { delSel.clear(); delSel.add('WO-2712-1'); delSel.add('WO-2713-1'); render(); await new Promise(r => setTimeout(r, 80)); });
      await p.selectOption('#selveh', 'VOLVO'); await p.selectOption('#selday', 'Sat'); await p.click('#selbook'); await p.waitForTimeout(150);
      const t2 = await toast(p), r2 = await p.evaluate(() => ['WO-2712-1', 'WO-2713-1'].map(w => findDel(w).delDay || ''));
      rec('1: only skipped jobs ticked → nothing booked, "nothing to book"', /nothing to book/.test(t2) && !r2.includes('Sat'), JSON.stringify({ t2, r2 }));
      rec('1: no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close();
    }
    // ---------- 2. reused reference
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, ''); const p = A.page;
      const j1 = await addJob(p, 'Remedial', 'Old remedial doors'); await save(p);
      await takeOff(p, 'Remedial', 'DELETE'); await save(p);
      const j2 = await addJob(p, 'Remedial', 'NEW remedial — different job'); await save(p);
      await reload(p); await reload(B.page);
      const s = await p.evaluate(() => ({ off: Object.entries(DB.delArchive || {}).filter(([k, a]) => a.off).map(([k, a]) => k + ':' + a.jobs[0].t), delx: (DB.delx || []).map(x => x.wo + ':' + x.title) }));
      rec('2: new "Remedial" got a different hidden id', j1.length === 1 && j2.length === 1 && j1[0] !== j2[0], JSON.stringify({ j1, j2 }));
      rec('2: the OLD Remedial\'s "taken off" record is still in 📚 Past weeks after reloads; the new one is on the board', s.off.length === 1 && /Old remedial/.test(s.off[0]) && s.delx.length === 1 && /NEW/.test(s.delx[0]), JSON.stringify(s));
      await B.page.evaluate(() => { DB.orders = DB.orders; const x = DB.delx.find(z => z.wo === 'Remedial'); x.value = 77; sched(); }); await save(B.page); await reload(p);
      const s2 = await p.evaluate(() => Object.values(DB.delArchive || {}).filter(a => a.off).length);
      rec('2: another PC editing the new Remedial does not clear the old record', s2 === 1, String(s2));
      // the old one's ↩ Back is not offered while the new Remedial is on the board — say so?
      await p.evaluate(() => { const k = Object.keys(DB.delArchive).find(k => DB.delArchive[k].off); openDelArchive(k); }); await p.waitForTimeout(100);
      const btn = await p.evaluate(() => !!document.querySelector('[data-arcb]'));
      rec('INFO 2: old Remedial row offers ↩ Back while the new Remedial is on the board?', true, String(btn));
      await A.close(); await B.close();
    }
    // ---------- 3. brought back twice
    {
      const row = (k1, k2) => ({ id: 'main', version: 1, nid: 9, orders: [], settings: { delx: [], delArchive: {
        [k1]: { at: '2026-11-07T16:00:00Z', w: '2026-11-02', by: 'Pat', notes: {}, pod: {}, jobs: [{ wo: 'JOB-B1', t: 'Worktop', c: 'Kildare', v: 'IVECO', d: 'Wed', vAt: '2026-11-04T12:00:00Z', m: 1, x: { wo: 'JOB-B1', title: 'Worktop', manual: true, jid: 'Jb1', delDone: true } }] },
        [k2]: { at: '2026-10-31T16:00:00Z', w: '2026-10-26', by: 'Pat', notes: {}, pod: {}, jobs: [{ wo: 'JOB-B1', t: 'Worktop (earlier)', c: 'Kildare', v: 'IVECO', d: 'Wed', vAt: '2026-10-28T12:00:00Z', m: 1, x: { wo: 'JOB-B1', title: 'Worktop (earlier)', manual: true, jid: 'Jb1', delDone: true } }] } } } });
      const S = makeServer(row('2026-11-07.a', '2026-10-31.b'));
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      const back = async (P, k) => { await P.page.evaluate(k => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); openDelArchive(k); }, k); await P.page.waitForTimeout(80);
        const n = await P.page.evaluate(() => { const b = document.querySelector('[data-arcb]'); if (!b) return 0; b.click(); return 1; }); await P.page.waitForTimeout(80);
        if (n) { await NAME(P.page, 'Ann'); await P.page.click('.pod-ovl [data-why="Not delivered after all"]').catch(() => {}); await P.page.waitForTimeout(150); } return n; };
      // two PCs at once, same row
      const na = await back(A, '2026-11-07.a'), nb = await back(B, '2026-11-07.a');
      await save(A.page); await save(B.page); await reload(A.page); await reload(B.page);
      const s = await A.page.evaluate(() => ({ n: (DB.delx || []).filter(x => x.wo === 'JOB-B1').length, logs: ((DB.delx || []).find(x => x.wo === 'JOB-B1') || {}).log || [] }));
      rec('3: two PCs bring the same hand job back at once → ONE job on the board', na && nb && s.n === 1, JSON.stringify({ na, nb, n: s.n, logs: s.logs.map(l => l.what + '|' + l.by) }));
      // same PC, the other week's row for the same job (it is on the board now)
      const nc = await back(A, '2026-10-31.b');
      const s3 = await A.page.evaluate(() => (DB.delx || []).filter(x => x.wo === 'JOB-B1').length);
      rec('3: the earlier week\'s row for the same job offers no second ↩ (or refuses) → still one job', s3 === 1, JSON.stringify({ offered: nc, n: s3 }));
      await A.close(); await B.close();
    }
    // ---------- 4. Close week with ~off entries
    {
      const ar = {};
      for (let i = 0; i < 26; i++) { const d = new Date(Date.UTC(2026, 4, 11) + i * 7 * 864e5).toISOString().slice(0, 10); ar[d + '.k' + i] = { at: d + 'T16:00:00Z', w: d, by: 'Pat', notes: {}, pod: {}, jobs: [{ wo: 'WO-26' + String(i).padStart(2, '0') + '-1', t: 'x', c: 'c', v: 'VOLVO', d: 'Tue', vAt: d + 'T12:00:00Z' }] }; }
      ['2026-05-01', '2026-08-20', '2026-11-11'].forEach((d, i) => { ar['~off.' + d + '.z' + i] = { at: d + 'T10:00:00Z', w: '', by: 'Ann', off: true, why: 'Taken off the board', notes: {}, pod: {}, jobs: [{ wo: 'JOB-OFF' + i, t: 'Hand job ' + i, c: 'Cairn', m: 1, x: { wo: 'JOB-OFF' + i, manual: true, jid: 'Jo' + i } }] }; });
      const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [O('WO-2799-1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: W0, delDelivAt: '2026-11-10T12:00:00Z', delDone: true })], settings: { delArchive: ar } });
      const A = await openRef(browser, S, ''); const p = A.page;
      await p.evaluate(async W0 => { window.confirm = () => true; closeWeek(W0); await new Promise(r => setTimeout(r, 150)); }, W0); await NAME(p, 'Bob'); await p.waitForTimeout(900); await save(p);
      const ks = Object.keys(S.row.settings.delArchive || {});
      const weeks = ks.filter(k => !S.row.settings.delArchive[k].off), offs = ks.filter(k => S.row.settings.delArchive[k].off);
      rec('4: 26 closed weeks kept (oldest dropped), all 3 "taken off" records kept', weeks.length === 26 && offs.length === 3 && !ks.includes('2026-05-11.k0'), JSON.stringify({ w: weeks.length, o: offs.length }));
      const sc = await p.evaluate(() => scorecardHTML(30));
      rec('4: scorecard shows weeks only — no "taken off" rows, no Invalid / NaN', !/JOB-OFF|Invalid|NaN/.test(sc) && (sc.match(/<tr/g) || []).length - 1 === 27, String((sc.match(/<tr/g) || []).length));
      await p.evaluate(() => openDelArchive()); await p.waitForTimeout(100);
      const order = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl [data-arcv]')].map(b => b.dataset.arcv));
      const ats = order.map(k => S2 => 0);
      const sorted = await p.evaluate(o => { const ar = DB.delArchive; return o.every((k, i) => i === 0 || String(ar[o[i - 1]].at) >= String(ar[k].at)); }, order);
      rec('4: Past weeks newest first by date, the "taken off" records sit by their date', sorted && order[0] !== undefined, JSON.stringify(order.slice(0, 5)));
      rec('4: no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
