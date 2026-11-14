// Tester attack 1 — an OLD-version screen (origin/feature/list-excel-template) still open after week tabs go live.
// Clock Tue 10 Nov 2026 (Wk 46). The office answered the one-time "bookings from before week tabs" question LAST week
// (delLegacyWk = Mon 2 Nov). Then the old screen: (1) saves an unrelated edit — are delWk / dueHist / delRebook / dueKeep /
// delLegacyWk / dated notes kept? (2) books a pool job (no week) — where does the new screen show it? (3) books a
// "rebook" job — is the flag left behind? (4) presses its "Clear Week — Start Fresh" — does it untag every week?
// Stubbed Supabase only.  Run: node tests/dates/attack1-oldversion.test.js
const { H, makeServer, open, openOld, recorder, save, reload, w } = require('./attack1-lib');
const { rec, done } = recorder('attack1-oldversion');
const NOW = '2026-11-10T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-13', origDueDate: '2026-11-13', plannedWeek: '2026-11-09', step: '8. PALLETED', delv: true, customer: 'CAIRN', title: 'House ' + wo }, x));
  const hist = [{ at: '2026-11-05T10:00:00Z', by: 'Ann', f: 'due', from: '2026-11-06', to: '2026-11-13', why: 'Site not ready', note: '', src: 'planner' }];
  const row = () => ({ id: 'main', version: 1, nid: 9, settings: { delLegacyWk: '2026-11-02', delNotes: { '2026-11-10': 'this tue', '2026-11-17': 'next tue — crane booked' } }, orders: [
    O('WO-A', { delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-16', dueDate: '2026-11-18', dueKeep: '2026-11-13', dueHist: hist }),
    O('WO-B', { delRebook: { at: '2026-11-09T10:00:00Z', by: 'Ann', why: 'Site not ready', was: 'VOLVO|Fri|2026-11-09' } }),
    O('WO-C'),
    O('WO-D', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }),
  ] });

  // (1) unrelated edit from the old screen
  {
    const S = makeServer(row());
    const N = await open(browser, S, { now: NOW });
    const OL = await openOld(browser, S, { now: NOW });
    await OL.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-C'); o.notes = 'old screen note'; sched(); });
    await save(OL.page);
    const a = S.row.orders.find(o => o.wo === 'WO-A'), b = S.row.orders.find(o => o.wo === 'WO-B');
    rec('old screen save keeps delWk / dueHist / dueKeep on jobs', a.delWk === '2026-11-16' && (a.dueHist || []).length === 1 && a.dueKeep === '2026-11-13', JSON.stringify({ wk: a.delWk, h: (a.dueHist || []).length, k: a.dueKeep }));
    rec('old screen save keeps delRebook on a pool job', !!b.delRebook, JSON.stringify(b.delRebook));
    rec('old screen save keeps the dated day notes', S.row.settings.delNotes && S.row.settings.delNotes['2026-11-17'] === 'next tue — crane booked', JSON.stringify(S.row.settings.delNotes));
    rec('old screen save keeps settings.delLegacyWk (the answer to the one-time week question)', S.row.settings.delLegacyWk === '2026-11-02', 'delLegacyWk after old save = ' + JSON.stringify(S.row.settings.delLegacyWk));
    // (a PC opened in this gap reads the row without delLegacyWk; whether it sees one depends on whether a new screen has
    //  saved since — timing-dependent, so only the row itself is checked above)
    await reload(N.page);
    const n = await N.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); return { leg: DB.delLegacyWk || '', ask: /before week tabs|which week/i.test(document.getElementById('app').innerText) }; });
    rec('new screen after the old save: the legacy-week answer is still there (no second question)', n.leg === '2026-11-02' && !n.ask, JSON.stringify(n));
    // the new screen still holds the answer in memory — does its next save put it back, and does a PC opened afterwards agree?
    await N.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D'); o.notes = 'new screen edit'; sched(); });
    await save(N.page);
    const N2 = await open(browser, S, { now: NOW });
    const n2 = await N2.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); return { leg: DB.delLegacyWk || '', ask: /before week tabs|which week/i.test(document.getElementById('app').innerText) }; });
    rec('after old save + a new-screen save, a PC opened later still knows the legacy week (all PCs agree where old bookings sit)', S.row.settings.delLegacyWk === '2026-11-02' && n2.leg === '2026-11-02' && !n2.ask, 'row=' + JSON.stringify(S.row.settings.delLegacyWk) + ' fresh PC=' + JSON.stringify(n2));
    await N2.close();
    await N.close(); await OL.close();
  }

  // (2)(3) old screen books jobs (no week)
  {
    const S = makeServer(row());
    const N = await open(browser, S, { now: NOW });
    const OL = await openOld(browser, S, { now: NOW });
    await OL.page.evaluate(async () => {
      placeJobs([findDel('WO-C')], 'VOLVO', 'Thu'); await new Promise(r => setTimeout(r, 100));
      document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      placeJobs([findDel('WO-B')], 'DAF', 'Fri'); await new Promise(r => setTimeout(r, 100));
      document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    });
    await save(OL.page); await reload(N.page);
    const r = await N.page.evaluate(async () => {
      const g = w => DB.orders.find(o => o.wo === w), out = {};
      out.c = { day: g('WO-C').delDay, wk: g('WO-C').delWk || '', slotWk: slotWk(g('WO-C')), slotDate: slotDate(g('WO-C')) };
      out.b = { day: g('WO-B').delDay, rb: !!g('WO-B').delRebook };
      out.missed = missedJobs().map(o => o.wo);
      showTab('d'); await new Promise(r => setTimeout(r, 150));
      out.tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
      out.grid0 = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw + '@' + c.closest('[data-cell]').dataset.cell);
      const card = [...document.querySelectorAll('.dchip')].find(c => c.dataset.dw === 'WO-B');
      out.bCard = card ? card.textContent.replace(/\s+/g, ' ').slice(0, 160) : '';
      // driver screen on Thu 12 Nov would look for this week's Thursday
      out.floorThuThisWk = slotIn(g('WO-C'), thisWk(), 'Thu');
      return out;
    });
    rec('a job booked on the old screen shows in THIS week (what the old-screen user meant), not last week',
      r.c.slotWk === '2026-11-09' && !r.missed.includes('WO-C') && r.grid0.some(x => x.startsWith('WO-C@')), JSON.stringify(r));
    rec('a "rebook" job booked on the old screen loses its "rebook" flag (it is on a van now)', r.b.day === 'Fri' && !r.b.rb && !/rebook/i.test(r.bCard), JSON.stringify(r.b) + ' card: ' + r.bCard);
    await N.close(); await OL.close();
  }

  // (4) old screen's "Clear Week — Start Fresh"
  {
    const S = makeServer(row());
    const N = await open(browser, S, { now: NOW });
    const OL = await openOld(browser, S, { now: NOW });
    await OL.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); document.getElementById('btn-delreset').click(); await new Promise(r => setTimeout(r, 900)); });
    await save(OL.page); await reload(N.page);
    const r = await N.page.evaluate(() => { const g = w => DB.orders.find(o => o.wo === w); return { a: { veh: g('WO-A').delVeh || '', day: g('WO-A').delDay || '', wk: g('WO-A').delWk || '' }, notes: DB.delNotes, nArch: Object.keys(DB.delArchive || {}).length }; });
    rec('old screen Clear Week leaves NEXT week\'s bookings alone', r.a.day === 'Tue' && r.a.veh === 'VOLVO', JSON.stringify(r.a) + ' (archived entries: ' + r.nArch + ')');
    rec('old screen Clear Week leaves next week\'s dated notes alone', r.notes && r.notes['2026-11-17'] === 'next tue — crane booked', JSON.stringify(r.notes));
    // a job left with delWk but no day — the plan says that is "not booked"; check the new screen puts it in the pool, not a grid cell
    const p = await N.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 120));
      return { grid: [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw), pool: [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw) }; });
    rec('after the old Clear Week a job with delWk but no day is in a pool, never a van cell', !p.grid.includes('WO-A'), JSON.stringify(p));
    rec('no page errors (old-version screens)', !(S.errors || []).filter(e => !/^OLD:/.test(e)).length, (S.errors || []).join(' | '));
    await N.close(); await OL.close();
  }
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
