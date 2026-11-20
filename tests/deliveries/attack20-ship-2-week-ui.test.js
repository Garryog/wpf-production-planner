// attack20-ship-2 (Tester, 20 Nov 2026): Garry's d20 rule "shipped = off 🚚 Deliveries" — closing weeks, on hold, bring back, exports,
// dashboards, 360 px and odd text.
//  E. close the week twice (same PC; two PCs at once) — no double archive of a shipped booking
//  F. shipped + ON HOLD (12) booked job: where does it go, is it archived, what happens when the hold lifts
//  G. a week closed with a shipped job, then "↩ Bring back to board" (Cienapps never said 9 — hand mistake) and tagged again
//  H. ↩ Back to Deliveries → rebook → import 10: Shipped card shows the NEW booking
//  I. scorecard / dashboard tiles "incl. 📦 N shipped"; past weeks' counts the same as origin/main; Past-weeks Excel export
//  J. Shipped card at 360 px with odd text (<img onerror>, O'Grady, emoji) in title / customer / loaded-by
// Fake Supabase only. Run: node tests/deliveries/attack20-ship-2-week-ui.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, recorder, save, reload, O, W0, WP, job, importRows, XD, pick, bringBack } = M;
const { rec, done } = recorder('attack20-ship-2');
const S9 = '9. JOB SHIPPED', S10 = '10. INSTALLED TO BE INVOICE', S8 = '8. PALLETED', S12 = '12. ON HOLD / DELETE';
const row = (wo, step) => [wo, 'House ' + wo, 'CAIRN', XD('2026-11-13'), step, 1000];
const NAME = async (p, n) => { const has = await p.$('#pick-other'); if (has) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
const close = async (p, wk) => { await p.evaluate(async wk => { sessionStorage.setItem('wpfWho', 'Pat'); window.confirm = m => { window.__cw = m; return true; }; closeWeek(wk); await new Promise(r => setTimeout(r, 150)); }, wk); await NAME(p, 'Pat'); await p.waitForTimeout(1500); };
const arcFor = (p, wk) => p.evaluate(wk => Object.keys(DB.delArchive || {}).filter(k => DB.delArchive[k].w === wk).map(k => DB.delArchive[k].jobs.map(j => j.wo + (j.sh ? ':sh' : '')).join(',')), wk);
const shipCard = (p, wo) => p.evaluate(async wo => { showTab('h'); await new Promise(r => setTimeout(r, 120));
  const c = document.getElementById('sh-done'); if (c && !c.checked) { c.checked = true; c.onchange(); await new Promise(r => setTimeout(r, 60)); }
  const k = [...document.querySelectorAll('.sh-card')].filter(x => (x.querySelector('.wo-num') || {}).textContent === wo); return { n: k.length, t: k.length ? k[0].innerText.replace(/\s+/g, ' ') : '' }; }, wo);

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- E. close twice: same PC, then two PCs at the same moment
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3101-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delLoadedAt: '2026-11-10T07:00:00Z' }), O('WO-3102-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delDelivAt: '2026-11-10T11:00:00Z', delDone: true, delivBy: 'Joe' })] });
      const A = await openRef(browser, S, '');
      await importRows(A.page, [row('WO-3101-1', S9), row('WO-3102-1', S8)]);
      await close(A.page, W0); await close(A.page, W0); await save(A.page);
      const a = await arcFor(A.page, W0);
      rec('E1 same PC closes Wk 46 twice: one archive, shipped job in it once', a.length === 1 && a[0].split(',').filter(x => x.startsWith('WO-3101-1')).length === 1, JSON.stringify(a));
      await A.close();
    }
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3111-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delLoadedAt: '2026-11-10T07:00:00Z' }), O('WO-3112-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, delDelivAt: '2026-11-10T11:00:00Z', delDone: true, delivBy: 'Joe' })] });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, '');
      await importRows(A.page, [row('WO-3111-1', S9), row('WO-3112-1', S8)]); await save(A.page); await reload(B.page);
      await Promise.all([close(A.page, W0), close(B.page, W0)]); await save(A.page); await save(B.page); await reload(A.page);
      const a = await arcFor(A.page, W0);
      const all = a.join(',').split(',');
      rec('E2 FINDING-CHECK (race older than d20) two PCs close Wk 46 at the same moment: the shipped job is archived once (no double archive)', all.filter(x => x.startsWith('WO-3111-1')).length === 1, JSON.stringify(a));
      rec('E2 INFO (compare): the delivered job WO-3112-1 archived ' + all.filter(x => x.startsWith('WO-3112-1')).length + ' time(s) — same race existed before d20', true, JSON.stringify(a));
      const sc = await A.page.evaluate(() => scorecardHTML(8));
      rec('E2 INFO scorecard rows for Wk 46', true, (sc.match(/Wk 46[^<]*/g) || []).join(' | '));
      await A.close(); await B.close();
    }
    // ---------- F. shipped + on hold
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3201-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0 }), O('WO-3202-1', { delVeh: 'IVECO', delDay: 'Wed', delWk: W0, delLoadedAt: '2026-11-11T07:00:00Z' })] });
      const A = await openRef(browser, S, ''), p = A.page;
      await importRows(p, [row('WO-3201-1', S9), row('WO-3202-1', S9)]);
      await importRows(p, [row('WO-3201-1', S12), row('WO-3202-1', S12)]);
      const f = await p.evaluate(() => ['WO-3201-1', 'WO-3202-1'].map(w => { const o = DB.orders.find(x => x.wo === w); return { w, sh: !!o.shippedAt, hold: !!o.cienHold, onPage: delOnPage(o), badge: (document.getElementById('delcnt') || {}).textContent }; }));
      rec('F1 shipped then on hold: off Deliveries, badge 0', f.every(x => !x.onPage), JSON.stringify(f));
      const c = await shipCard(p, 'WO-3201-1');
      rec('F1 listed once on the Shipped tab (not twice: shipped list + on-hold list)', c.n <= 1, JSON.stringify(c));
      await close(p, W0);
      const a = await arcFor(p, W0);
      rec('F2 FINDING-CHECK closing Wk 46: the shipped + on-hold booked jobs are archived as shipped (the week\'s record is whole)', a.join(',').includes('WO-3201-1:sh') && a.join(',').includes('WO-3202-1:sh'), JSON.stringify(a));
      // hold lifted (Cienapps back to 9): does the stale Wk 46 booking come back anywhere / get archived again?
      await importRows(p, [row('WO-3201-1', S9), row('WO-3202-1', S9)]);
      await close(p, W0);
      const a2 = await arcFor(p, W0), all = a2.join(',').split(',');
      rec('F3 hold lifted then Wk 46 closed again: each job archived for Wk 46 at most once', all.filter(x => x.startsWith('WO-3201-1')).length <= 1 && all.filter(x => x.startsWith('WO-3202-1')).length <= 1, JSON.stringify(a2));
      rec('F no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close();
    }
    // ---------- G. hand-shipped by mistake, week closed, then Bring back to board and tagged again
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3301-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16' })] });
      const A = await openRef(browser, S, ''), p = A.page;
      await pick(p, 'WO-3301-1', S9);
      await close(p, W0);
      await bringBack(p, 'WO-3301-1');
      const g1 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-3301-1'); return { step: o.step, sh: !!o.shippedAt, delv: !!o.delv, done: !!o.delDone, stage: dStage(o) }; });
      rec('G1 brought back to the board (step 8, not shipped)', g1.step === S8 && !g1.sh, JSON.stringify(g1));
      // tag it for delivery again from the board (the 🚚 toggle)
      const g2 = await p.evaluate(async () => { showTab('b'); await new Promise(r => setTimeout(r, 120)); const b = document.querySelector('[data-dv="WO-3301-1"]'); if (!b) return 'no toggle';
        const o = DB.orders.find(x => x.wo === 'WO-3301-1'); if (!o.delv) b.click(); await new Promise(r => setTimeout(r, 100));
        return { delv: !!o.delv, done: !!o.delDone, stage: dStage(o), onPage: delOnPage(o), ip: delAll().includes(o) }; });
      rec('G2 FINDING-CHECK re-tagged for delivery after the shipped week was closed: NOT shown as already delivered (delDone left true by Close week)', g2 !== 'no toggle' && g2.stage !== 'deliv', JSON.stringify(g2));
      rec('G no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close();
    }
    // ---------- H. ↩ Back to Deliveries → rebook → import 10
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('WO-3401-1', { delVeh: 'IVECO', delDay: 'Tue', delWk: W0 })] });
      const A = await openRef(browser, S, ''), p = A.page;
      await importRows(p, [row('WO-3401-1', S9)]);
      await p.evaluate(async () => { sessionStorage.setItem('wpfWho', 'Mary'); showTab('h'); await new Promise(r => setTimeout(r, 100)); document.querySelector('[data-shd="WO-3401-1"]').click(); });
      await p.waitForTimeout(100); await NAME(p, 'Mary'); await p.click('.pod-ovl [data-why="Not delivered after all"]'); await p.waitForTimeout(200);
      await p.evaluate(() => { window.confirm = () => true; placeJobs([findDel('WO-3401-1')], 'VOLVO', 'Sat', thisWk()); }); await p.waitForTimeout(200);
      await importRows(p, [row('WO-3401-1', S10)]);
      const j = await job(p, 'WO-3401-1'), c = await shipCard(p, 'WO-3401-1');
      rec('H1 brought back, rebooked Volvo Sat, Cienapps 10: shipped, off Deliveries, card shows the NEW booking (Volvo Sat)', j.sh && j.onDel === 0 && j.veh === 'VOLVO' && /Volvo Sat/.test(c.t), JSON.stringify({ sh: j.sh, onDel: j.onDel, veh: j.veh, c: c.t.slice(0, 250) }));
      rec('H2 no ↩ Back to Deliveries offered at 10 (Garry 20 Nov)', !/Back to Deliveries/.test(c.t), c.t.slice(0, 250));
      await A.close();
    }
    // ---------- I. scorecard / dashboards / past weeks vs origin/main / Excel
    {
      const oldJobs = [{ wo: 'WO-2600-1', t: 'House', c: 'CAIRN', f: '', u: '', v: 'VOLVO', d: 'Tue', dt: '2026-11-03', val: 900, lAt: '', dAt: '', vAt: '2026-11-03T12:00:00Z', lBy: '', vBy: 'Joe', mv: [], fd: '', mw: null },
        { wo: 'WO-2601-1', t: 'House', c: 'CAIRN', f: '', u: '', v: 'VOLVO', d: 'Tue', dt: '2026-11-03', val: 900, lAt: '2026-11-03T07:00:00Z', dAt: '', vAt: '', lBy: '', vBy: '', mv: [], fd: '', mw: null },
        { wo: 'WO-2602-1', t: 'House', c: 'CAIRN', f: '', u: '', v: 'IVECO', d: 'Mon', dt: '2026-11-02', val: 500, lAt: '', dAt: '', vAt: '', lBy: '', vBy: '', mv: [{ at: '2026-11-01T10:00:00Z', why: 'Site not ready' }], fd: '', mw: { why: 'Customer' } }];
      const arc = { '2026-11-07.old': { at: '2026-11-07T16:00:00Z', w: WP, by: 'Pat', notes: {}, pod: {}, jobs: oldJobs }, '2026-10-31.old': { at: '2026-10-31T16:00:00Z', w: '2026-10-26', by: 'Pat', notes: {}, pod: {}, jobs: oldJobs.slice(0, 2) } };
      const mk = () => makeServer({ id: 'main', version: 1, nid: 9, settings: { delArchive: JSON.parse(JSON.stringify(arc)) }, orders: [
        O('WO-3501-1', { delVeh: 'IVECO', delDay: 'Mon', delWk: W0, title: '<img src=x onerror="window.__x=1">O\'Grady "Kitchen" 🏠 ' + 'very long house name '.repeat(6), customer: 'O\'Brien & Sons <b>bold</b> 🚚', delLoadedAt: '2026-11-09T07:00:00Z', ldBy: '<i>Joe</i> O\'Neill 🙂' }),
        O('WO-3502-1', { delVeh: 'IVECO', delDay: 'Mon', delWk: W0, delDelivAt: '2026-11-09T12:00:00Z', delDone: true, delivBy: 'Joe' })] });
      const S = mk(), A = await openRef(browser, S, ''), p = A.page;
      const S2 = mk(), Old = await openRef(browser, S2, 'origin/main');
      const pastRows = pg => pg.evaluate(() => (scorecardHTML(8).match(/<tr>[\s\S]*?<\/tr>/g) || []).filter(r => /closed/.test(r)).join('\n'));
      const n0 = await pastRows(p), o0 = await pastRows(Old.page);
      rec('I1 closed past weeks: scorecard rows identical to origin/main (counts unchanged)', n0 === o0 && n0.length > 0, n0.slice(0, 300) + ' ||| ' + o0.slice(0, 300));
      await importRows(p, [row('WO-3501-1', S9), row('WO-3502-1', S8)]);
      const sc = await p.evaluate(() => scorecardHTML(8));
      rec('I2 live week: "incl. 📦 1 shipped" on the scorecard', /incl\. 📦 1 shipped/.test(sc));
      const dash = await p.evaluate(async () => { localStorage.setItem('wpfPin_dash', '9000'); setRole('dash'); await new Promise(r => setTimeout(r, 250)); const a = document.getElementById('app').innerText;
        localStorage.setItem('wpfPin_prod', '9000'); setRole('prod'); await new Promise(r => setTimeout(r, 250)); const b = document.getElementById('app').innerText; setRole('office'); return { a: (a.match(/ON TIME THIS WEEK[^\n]*\n?[^\n]*/i) || [''])[0], b: (b.match(/ON TIME THIS WEEK[^\n]*\n?[^\n]*/i) || [''])[0], ha: /incl\. 1 shipped/.test(a), hb: /incl\. 1 shipped/.test(b) }; });
      rec('I3 management dashboard and Production Manager tiles say "incl. 1 shipped, not marked delivered"', dash.ha && dash.hb, JSON.stringify(dash));
      await close(p, W0);
      const n1 = await pastRows(p);
      rec('I4 after closing Wk 46 the two older closed weeks\' rows are unchanged', n1.includes(n0.split('\n')[0]) && n1.includes(n0.split('\n')[1] || ''), n1.slice(0, 500));
      // Past-weeks Excel export of the week just closed
      const xl = await p.evaluate(async () => { const k = Object.keys(DB.delArchive).find(k => DB.delArchive[k].w === thisWk()); let rows = null;
        const wf = XLSX.writeFile; XLSX.writeFile = (wb) => { rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }); }; openDelArchive(k); await new Promise(r => setTimeout(r, 100));
        const b = [...document.querySelectorAll('[data-arcx]')].find(b => b.dataset.arcx === k); b.click(); XLSX.writeFile = wf; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); return rows; });
      const shRow = (xl || []).find(r => r.includes('WO-3501-1')) || [];
      rec('I5 FINDING-CHECK Past-weeks Excel: the shipped job\'s row says it was shipped (otherwise it reads as "not delivered")', /ship/i.test(JSON.stringify(shRow)) || /ship/i.test(JSON.stringify((xl || [])[0])), JSON.stringify({ head: (xl || [])[0], shRow }));
      // J. Shipped card at 360 px with odd text
      await p.setViewportSize({ width: 360, height: 740 });
      const j = await p.evaluate(async () => { setRole('office'); showTab('h'); await new Promise(r => setTimeout(r, 200));
        const c = [...document.querySelectorAll('.sh-card')].find(x => (x.querySelector('.wo-num') || {}).textContent === 'WO-3501-1');
        const r = c ? c.getBoundingClientRect() : {}; return { x: !!window.__x, img: c ? !!c.querySelector('img,b,i') : null, t: c ? c.innerText.replace(/\s+/g, ' ') : '', right: r.right, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
      rec('J1 odd text on the Shipped card (loaded-by "<i>Joe</i> O\'Neill 🙂"; the import replaced the title): no HTML injected, shown as typed', !j.x && j.img === false && /O'Neill 🙂/.test(j.t) && /<i>Joe<\/i>/.test(j.t), j.t.slice(0, 400));
      rec('J2 360 px: Shipped card and page fit (no sideways scroll)', j.sw <= j.cw + 1 && j.right <= j.cw + 1, JSON.stringify({ sw: j.sw, cw: j.cw, right: j.right }));
      const pw = await p.evaluate(async () => { const k = Object.keys(DB.delArchive).find(k => DB.delArchive[k].w === thisWk()); openDelArchive(k); await new Promise(r => setTimeout(r, 100));
        const o = [...document.querySelectorAll('.pod-ovl')].pop(); return { x: !!window.__x, t: o.innerText.replace(/\s+/g, ' ').slice(0, 300), inj: !!o.querySelector('td img, td b, td i') }; });
      rec('J3 📚 Past weeks with the odd-text shipped row: no HTML injected', !pw.x && !pw.inj, pw.t);
      rec('I/J no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await Old.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
