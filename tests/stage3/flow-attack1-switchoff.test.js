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
(async () => {
  if (!OLD) { rec('origin/feature/stage2-imports index.html readable from git (run git fetch)', false); done(); process.exit(1); }
  const browser = await H.chromium.launch();
  const views = [['office', 'b'], ['office', 'l'], ['office', 'i'], ['saw', null], ['prod', null], ['dash', null]];
  const shot = async html => {
    const S = F.makeServer(row());
    const t = await A.openOld(browser, S, html);
    const out = {};
    for (const [role, tab] of views) {
      out[role + '/' + (tab || '-')] = await t.page.evaluate(async ({ role, tab }) => { localStorage.setItem('wpfPin_' + role, '9000'); setRole(role); if (tab) showTab(tab); await new Promise(r => setTimeout(r, 150)); return document.getElementById('app') ? document.getElementById('app').innerText : document.body.innerText; }, { role, tab });
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
  for (const k of Object.keys(a.out)) {
    const x = norm(a.out[k]), y = norm(b.out[k]);
    let i = 0; while (i < x.length && x[i] === y[i]) i++;
    rec('switch off — ' + k + ': same screen as feature/stage2-imports', x === y, 'first difference at ' + i + ': stage2 "' + x.slice(Math.max(0, i - 40), i + 80) + '" vs this branch "' + y.slice(Math.max(0, i - 40), i + 80) + '"');
  }
  const ko = o => Object.keys(o).sort().join(',');
  const extraKeys = b.saved.orders.map((o, i) => ({ wo: o.wo, extra: Object.keys(o).filter(k => !(k in a.saved.orders[i])) })).filter(x => x.extra.length);
  rec('switch off: the saved jobs carry no new fields (e.g. procAt) that stage2 would not write', !extraKeys.length, JSON.stringify(extraKeys));
  rec('switch off: saved settings have the same keys', ko(a.saved.settings || {}) === ko(b.saved.settings || {}), ko(a.saved.settings || {}) + ' vs ' + ko(b.saved.settings || {}));
  rec('switch off: no calls to the new tables, no page errors', b.calls === 0 && !b.errs.length, JSON.stringify({ calls: b.calls, errs: b.errs }));
  await browser.close();
  done();
  process.exit(A.fails && A.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
