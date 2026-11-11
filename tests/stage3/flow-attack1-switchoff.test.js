// Tester attack 1: with the cutting-lists switch OFF, this branch must look and save exactly like feature/stage2-imports
// (the go-live branch). Same fake planner record, both versions side by side: screen text on each role/tab, and the
// record each one saves after the same edit. Fake Supabase only. Run: node tests/stage3/flow-attack1-switchoff.test.js
const fs = require('fs'), path = require('path');
const A = require('./atk.js');
const { F, H, rec, done, gitShow } = A;
const ROOT = path.join(__dirname, '../..');
// Always the pushed branch (origin/...), never the local copy, which can be behind (run `git fetch` first)
const OLD = gitShow('origin/feature/stage2-imports');
const NEW = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function row() {
  const o = (wo, step, x) => H.order(Object.assign({ wo, step, title: 'HOUSE ' + wo + ' TYPE B KITCHEN', customer: 'CAIRN HOMES - CHERRYWOOD PHASE 2', dueDate: '2026-10-28', origDueDate: '2026-10-28', plannedWeek: '2026-10-26' }, x || {}));
  const r = F.v2Row(); delete r.settings.listStore; delete r.settings.listStoreAt;
  r.orders = [o('WO-1', '5. WORK ORDER PROCESSED', { delv: true, delVeh: 'VOLVO', delDay: 'Thu' }), o('WO-2', '6. JOB CUT COMPLETE'), o('WO-3', '3. READY FOR UPLOAD'), o('WO-4', '7. ASSEMBLY COMPLETE', { delv: true })];
  return r;
}
const norm = s => String(s).replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'HH:MM').replace(/\s+/g, ' ').trim();
// ALLOWED DIFFERENCE (Tester, 10 Nov — dates & deliveries, Garry 9 Nov): van bookings now belong to a real week, so a
// booking label carries its date ("Volvo Thu 12 Nov", the board's "(Volvo Thu 12 Nov)" for stage2's "(Thu)"), and the
// dashboard's missed count reads "planned for a day already gone" (missed = by real date, any open week) for stage2's
// "planned earlier this week", and the scorecard note says weeks are stored "when a week is closed" (Close week). Only these exact shapes are folded back, on both sides; everything else must still match.
const DAYS = '(Mon|Tue|Wed|Thu|Fri|Sat)', MON = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', VANS = '(?:Artic|Volvo|Renault|Iveco|Crafter|Smart Movers)';
// ALLOWED DIFFERENCE (Coder, round-4 carry-over 11 Nov — Production Manager buy-in, ASSUMED, Garry to confirm): the Production Manager
// screen starts with its own two buttons "🧭 Today 🚚 Deliveries" (the way to the Deliveries page). Only that exact leading pair is taken off.
const normDates = s => norm(s).replace(/^🧭 Today 🚚 Deliveries /, '').replace(new RegExp('\\b' + DAYS + ' \\d{1,2} ' + MON + '\\b', 'g'), '$1')
  .replace(new RegExp('\\(' + VANS + ' ' + DAYS + '\\)', 'g'), '($1)')
  .replace(/planned for a day already gone, not delivered|planned earlier this week, not delivered/g, '«missed»')
  .replace(/Weeks are stored when (?:a week is closed|the board is cleared) \(/g, 'Weeks are stored «close week» (')
  // ALLOWED DIFFERENCE (Coder, 10 Nov evening — Deliveries usability DD1, Garry 10 Nov): the board's due cell is the one due tag
  // "Due Wed 28 Oct · Wk 44" (+ "🚚 <delivery date>" tag, "(orig 21 Oct Wk 43)", the ⋯ full-dialog button) for stage2's
  // "[OVERDUE ]28 Oct 26 Wk44[ (orig: 21 Oct 26 Wk43)]". Only these shapes are folded back to «due», on both sides.
  .replace(new RegExp('Due ' + DAYS + '(?: \\d{4})? · Wk \\d+(?: 🚚 ' + DAYS + '(?: \\d{4})? · Wk \\d+)?(?: \\(orig \\d{1,2} ' + MON + ' Wk \\d+\\))?(?: ⋯)?', 'g'), '«due»')
  .replace(new RegExp('(?:OVERDUE )?\\d{1,2} ' + MON + ' \\d{2} Wk\\d+(?: \\(orig: \\d{1,2} ' + MON + ' \\d{2} Wk\\d+\\))?', 'g'), '«due»');
(async () => {
  if (!OLD) { rec('origin/feature/stage2-imports index.html readable from git (run git fetch)', false); done(); process.exit(1); }
  const browser = await H.chromium.launch();
  const views = [['office', 'b'], ['office', 'l'], ['office', 'i'], ['saw', null], ['stores', null], ['prod', null], ['dash', null]];
  // ALLOWED DIFFERENCE (feature/stores-dockets, Garry 4 Nov): the Stores screen has one extra row of buttons — "Send to site",
  // "Dockets", "Items sent" (free-typed dockets work with the switch off). That row (.dk-bar) is taken out before comparing and
  // checked on its own below; everything else on every screen must still match feature/stage2-imports exactly.
  const DK_BAR = '🚚 Send fittings to site 📄 Dockets 📦 Items sent'; // (4 Nov) hidden quietly (empty) while the docket tables don't exist
  const shot = async html => {
    const S = F.makeServer(row());
    const t = await A.openOld(browser, S, html);
    const out = {};
    for (const [role, tab] of views) {
      const got = await t.page.evaluate(async ({ role, tab }) => { localStorage.setItem('wpfPin_' + role, '9000'); setRole(role); if (tab) showTab(tab); await new Promise(r => setTimeout(r, 150));
        const app = document.getElementById('app'), bar = app ? [...app.querySelectorAll('.dk-bar')] : [];
        const barText = bar.map(b => b.innerText).join(' '); bar.forEach(b => { b.dataset.dkHide = b.style.display; b.style.display = 'none'; });
        const txt = app ? app.innerText : document.body.innerText; bar.forEach(b => { b.style.display = b.dataset.dkHide; });
        return { txt, bar: barText, nbar: bar.length }; }, { role, tab });
      out[role + '/' + (tab || '-')] = got.txt;
      (out.__bars = out.__bars || {})[role + '/' + (tab || '-')] = { bar: got.bar, n: got.nbar };
    }
    // the same edit on both: a note on WO-2, then save
    await t.page.evaluate(async () => { localStorage.setItem('wpfPin_office', '9000'); setRole('office'); const o = DB.orders.find(x => x.wo === 'WO-2'); o.notes = 'same edit'; await saveDB(); });
    // the same Cienapps import on both: one new job at step 5, WO-3 moves to step 5
    out['import preview + apply'] = await t.page.evaluate(async () => { showTab('i');
      IMPPLAN = analyzeImport(prepImport([{ wo: 'WO-9', step: '5. WORK ORDER PROCESSED', value: 4000, dueDate: '2026-12-15', title: 'HOUSE 9 TYPE B KITCHEN', customer: 'CAIRN HOMES - CHERRYWOOD PHASE 2' }, { wo: 'WO-3', step: '5. WORK ORDER PROCESSED', value: 4000, dueDate: '2026-10-28', title: 'HOUSE WO-3 TYPE B KITCHEN', customer: 'CAIRN HOMES - CHERRYWOOD PHASE 2' }]), 'file');
      renderImportPreview(IMPPLAN); const pre = document.getElementById('iprev').innerText; await document.getElementById('imp-apply').onclick(); await saveDB(); return pre + ' || ' + document.getElementById('iprev').innerText; });
    const saved = JSON.parse(JSON.stringify(S.row)); saved.orders.forEach(o => { delete o.log; }); delete saved.version; if (saved.settings) { delete saved.settings.saveIds; }
    const calls = F.newTableCalls(S).length, errs = (S.oldErrors || []).slice();
    await t.close();
    return { out, saved, calls, errs };
  };
  const a = await shot(OLD), b = await shot(NEW);
  const bars = b.out.__bars; delete a.out.__bars; delete b.out.__bars;
  rec('switch off — the only extra: one docket button row, on the Stores screen only, reading exactly "' + DK_BAR + '"',
    Object.entries(bars).every(([k, v]) => k === 'stores/-' ? v.n === 1 && (norm(v.bar) === DK_BAR || norm(v.bar) === '') : v.n === 0), JSON.stringify(bars));
  for (const k of Object.keys(a.out)) {
    const x = normDates(a.out[k]), y = normDates(b.out[k]);
    let i = 0; while (i < x.length && x[i] === y[i]) i++;
    rec('switch off — ' + k + ': same screen as feature/stage2-imports', x === y, 'first difference at ' + i + ': stage2 "' + x.slice(Math.max(0, i - 40), i + 80) + '" vs this branch "' + y.slice(Math.max(0, i - 40), i + 80) + '"');
  }
  const ko = o => Object.keys(o).sort().join(',');
  const extraKeys = b.saved.orders.map((o, i) => ({ wo: o.wo, extra: Object.keys(o).filter(k => !(k in a.saved.orders[i])) })).filter(x => x.extra.length);
  rec('switch off: the saved jobs carry no new fields (e.g. procAt) that stage2 would not write', !extraKeys.length, JSON.stringify(extraKeys));
  // ALLOWED DIFFERENCE (Tester round 3, 10 Nov — old-screen guard v2, e510864): this branch writes ONE new settings key,
  // appRel = 2, on every save (the database guard uses it to refuse older screens). Nothing else may be added or dropped.
  const bKeys = Object.keys(b.saved.settings || {}).filter(k => k !== 'appRel').sort().join(',');
  rec('switch off: saved settings have the same keys (plus only appRel = 2)', ko(a.saved.settings || {}) === bKeys && (b.saved.settings || {}).appRel === 2, ko(a.saved.settings || {}) + ' vs ' + ko(b.saved.settings || {}));
  rec('switch off: no calls to the new tables, no page errors', b.calls === 0 && !b.errs.length, JSON.stringify({ calls: b.calls, errs: b.errs }));
  await browser.close();
  done();
  process.exit(A.fails && A.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
