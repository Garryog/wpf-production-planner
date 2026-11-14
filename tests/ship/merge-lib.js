// Shared helpers for tests/ship/merge-*.test.js (Tester, 13 Nov 2026): attack the places where the "Shipped steps" release
// (main, S1) and the "Deliveries weeks" release meet on release/deliveries-weeks after the merge fd71fc8.
// Fake Supabase only (tests/stage1/srv.js through tests/dates/attack1-lib.js) — the harness network guard blocks anything else.
// openRef(browser, S, ref) runs another version of index.html (origin/main, origin/release/deliveries-weeks) on the same fake DB.
const L = require('../dates/attack1-lib');
const { H, makeServer, open, openOld, oldHtml, recorder, save, reload, w } = L;
const NOW = '2026-11-12T10:00:00Z';           // Thu 12 Nov 2026, Wk 46
const W0 = '2026-11-09', WP = '2026-11-02', W1 = '2026-11-16', W2 = '2026-11-23';
const HDR = ['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'];
const O = (wo, x) => H.order(Object.assign({ wo, customer: 'CAIRN', title: 'House ' + wo, dueDate: '2026-11-13', origDueDate: '2026-11-13', plannedWeek: W0, step: '8. PALLETED', cienStep: '8. PALLETED', hours: 5, value: 1000, delv: true }, x));

async function openRef(browser, S, ref, opts = {}) {
  if (!ref) return open(browser, S, Object.assign({ now: NOW }, opts));
  return openOld(browser, S, Object.assign({ now: NOW, ref }, opts));
}
// pick a step on the Capacity Board's step box (the real onchange), answering the ship question with ok
const pick = (p, wo, v, ok = true) => p.evaluate(async ({ wo, v, ok }) => {
  sessionStorage.setItem('wpfWho', 'Op');
  if (typeof showTab === 'function' && (typeof tab === 'undefined' || tab !== 'b')) showTab('b');
  window.__asked = []; window.confirm = m => { window.__asked.push(m); return ok; };
  const s = document.querySelector('[data-stepsel="' + wo + '"]'); if (!s) return 'no select';
  if (![...s.options].some(o => o.value === v)) return 'no option ' + v;
  s.value = v; s.onchange(); await new Promise(r => setTimeout(r, 150));
  const s2 = document.querySelector('[data-stepsel="' + wo + '"]');
  return { asked: window.__asked, selNow: s2 ? s2.value : null };
}, { wo, v, ok });
const bringBack = (p, wo) => p.evaluate(async wo => {
  sessionStorage.setItem('wpfWho', 'Op'); showTab('h'); await new Promise(r => setTimeout(r, 80));
  const c = document.getElementById('sh-done'); if (c && !c.checked) { c.checked = true; c.onchange(); await new Promise(r => setTimeout(r, 60)); }
  window.confirm = () => true; const b = document.querySelector('[data-shb="' + wo + '"]'); if (!b) return 'no button'; b.click();
  await new Promise(r => setTimeout(r, 150)); return 'ok';
}, wo);
// one job, everything that matters on the board / Deliveries / Shipped tab
const job = (p, wo) => p.evaluate(wo => {
  const o = DB.orders.find(x => x.wo === wo); if (!o) return null;
  const has = n => typeof window[n] === 'function' || (function () { try { return typeof eval(n) === 'function'; } catch (e) { return false; } })();
  return { step: o.step, cien: o.cienStep || '', sh: !!o.shippedAt, shs: o.shippedStep || '', inst: !!o.installedAt, hand: o.stepHand || null, back: o.shipBack || null,
    delv: !!o.delv, veh: o.delVeh || '', day: o.delDay || '', wk: o.delWk || '', ovr: o.delvOverride || '', storeAt: o.storeAt || '', dueMv: o.dueMv || null,
    delivDate: o.delivDate || '', dueDate: o.dueDate || '', rb: o.delRebook ? o.delRebook.why : '', done: !!o.delDone,
    onBoard: boardOrders().includes(o), inPlan: planOrders().includes(o), onDel: delAll().filter(x => x === o).length,
    slotWk: has('slotWk') && o.delDay ? slotWk(o) : '', missed: has('missedJobs') ? missedJobs().filter(x => x === o).length : null,
    inStore: has('inStoreJobs') ? inStoreJobs().some(x => x.o === o) : null, logs: (o.log || []).map(l => l.what) };
}, wo);
// sweep every Deliveries week tab in the DOM: where each chip shows (grid cell / pool) and the tab counts
const delSweep = p => p.evaluate(async () => {
  showTab('d'); await new Promise(r => setTimeout(r, 120));
  const out = { tabs: {}, grid: {}, pool: {}, missTxt: '' };
  const ids = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab);
  for (const t of ids) {
    const b = document.querySelector('[data-deltab="' + t + '"]'); if (!b) continue; b.click(); await new Promise(r => setTimeout(r, 80));
    out.tabs[t] = (document.querySelector('[data-deltab="' + t + '"] .n') || {}).textContent || '';
    out.grid[t] = [...document.querySelectorAll('.del-grid [data-cell] .dchip')].map(c => c.dataset.dw + '@' + c.closest('[data-cell]').dataset.cell);
    out.pool[t] = [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw);
    if (t === '0') out.missTxt = ((document.querySelector('.pg') || {}).textContent || '').match(/Missed deliveries need a reason — \d+ jobs?/)?.[0] || '';
  }
  const b0 = document.querySelector('[data-deltab="0"]'); if (b0) b0.click();
  out.badge = (document.getElementById('delcnt') || {}).textContent || '';
  return out;
});
const countIn = (sw, wo) => { let g = 0, pl = 0; const where = [];
  Object.entries(sw.grid).forEach(([t, a]) => a.forEach(x => { if (x.split('@')[0] === wo) { g++; where.push('grid' + t + ':' + x.split('@')[1]); } }));
  Object.entries(sw.pool).forEach(([t, a]) => a.forEach(x => { if (x === wo) { pl++; where.push('pool' + t); } }));
  return { g, pl, where }; };
const importRows = async (p, rows) => { await H.importAoa(p, [HDR, ...rows]); return p.evaluate(async () => { const pl = JSON.parse(JSON.stringify(IMPPLAN)); applyImport(IMPPLAN); await new Promise(r => setTimeout(r, 250)); return pl; }); };
const XD = L.XD;
module.exports = { H, makeServer, open, openRef, oldHtml, recorder, save, reload, w, NOW, W0, WP, W1, W2, HDR, O, pick, bringBack, job, delSweep, countIn, importRows, XD };
