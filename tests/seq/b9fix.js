// Shared set-up for the B9 pre-production pool tests (docs/PLAN-project-details.md Part 5). Fake Supabase only.
// Today = Wed 11 Nov 2026; preWks default 3 → "Due by Wed 2 Dec". Projects: P1 Aderrig (PM John Burke), P2 Lucan (no sequence).
// Aderrig sequence (positions): 1 WO-12, 2 WO-10, 3 WO-1, 4 waiting row W1 (required Mon 30 Nov → build ~Wed 25 Nov), 5 waiting W2 (no date).
const X = require('./fixs.js');
const { H } = X;
const NOW11 = '2026-11-11T10:00:00Z';
function poolRow(extra) {
  const r = X.v2Row(extra);
  r.orders = r.orders.filter(o => o.wo === 'WO-1' || o.wo === 'WO-2'); // WO-1 / WO-2 due 22 Oct: overdue, not cut
  const o = (wo, cust, due, f) => H.order(Object.assign({ wo, customer: cust, dueDate: due, origDueDate: due, plannedWeek: '', floor: 'T1', unit: wo.slice(3), title: 'HOUSE ' + wo }, f || {}));
  r.orders.push(
    o('WO-10', 'Aderrig Homes', '2026-12-02', { sheetsCien: 14 }),
    o('WO-11', 'Aderrig Homes', '2026-12-03'),
    o('WO-12', 'Aderrig Homes', '2026-11-01'),
    o('WO-13', 'Aderrig Homes', '2026-11-20', { step: '6. CUT' }),
    o('WO-14', 'Aderrig Homes', '2026-11-20', { cienHold: true }),
    o('WO-15', 'Aderrig Homes', '2026-11-20', { shippedAt: '2026-11-01T10:00:00Z' }),
    o('WO-16', 'Lucan Homes', '2026-11-25', { step: '5. WORK ORDER PROCESSED' }),
    o('WO-17', 'Nobody Ltd', '2026-11-26', { title: 'X <img src=x onerror="window.__xss=1">' }));
  return r;
}
function makePool(opt = {}) {
  const S = X.makeServer(opt.row || poolRow(opt.extra), opt);
  X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  if (!opt.noRows) {
    X.seqRow(S, 'Q12', 'P1', { wo: 'WO-12' }); X.seqRow(S, 'Q10', 'P1', { wo: 'WO-10' }); X.seqRow(S, 'Q1', 'P1', { wo: 'WO-1' });
    X.seqRow(S, 'W1', 'P1', { name: 'House 20', floor: 'T2', unit: '20', req_date: '2026-11-30' }); X.seqRow(S, 'W2', 'P1', { name: 'House 21' });
  }
  return S;
}
const pre = (browser, S, extra = {}) => X.dev(browser, S, 'pre', Object.assign({ now: NOW11, me: { pre: 'Johnny' } }, extra));
// the pool table as text: [{k, my, dn, wo, cls, cut, proc, flags}]
const pool = p => p.evaluate(() => [...document.querySelectorAll('#pre-pool tr[data-prer]')].map(tr => {
  const c = l => { const td = tr.querySelector('td[data-l="' + l + '"]'); return td ? td.innerText.replace(/\s+/g, ' ').trim() : null; };
  return { k: tr.dataset.prer, my: +c('My#'), dn: +c('Due#'), wo: c('WO'), cls: tr.className, cut: c('Cut-by'), due: c('Due'), proc: c('Processed'), flags: c('Flags'), mat: c('Material'), list: c('List'), sheets: c('Sheets'), spec: c('Spec'), pm: c('PM'), proj: c('Project') };
}));
const wos = rows => rows.map(r => r.wo).join(',');
module.exports = { X, NOW11, poolRow, makePool, pre, pool, wos };
