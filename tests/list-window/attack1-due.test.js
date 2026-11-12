// Tester attack (list window, 12 Nov): the due-date tag in the title bar (#me-due, class lw-due red|amber|grey).
// red = overdue, amber = due this week (Mon–Sun, Irish time), grey = later / no date. Year end, Sundays, clock change, garbage.
// Fake Supabase only. Run: node tests/list-window/attack1-due.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, job } = L;

// [today (UTC instant), label, [[dueDate, expected class, expected text regex, label]]]
const DAYS = [
  ['2026-10-21T09:00:00Z', 'Wed 21 Oct 2026', [
    ['2026-10-20', 'red', /^OVERDUE · Due Tue 20 Oct · Wk 43$/, 'yesterday'],
    ['2026-10-21', 'amber', /^Due Wed 21 Oct · Wk 43$/, 'today (not overdue yet)'],
    ['2026-10-25', 'amber', /^Due Sun 25 Oct · Wk 43$/, 'this Sunday'],
    ['2026-10-26', 'grey', /^Due Mon 26 Oct · Wk 44$/, 'next Monday'],
    ['2026-10-19', 'red', /OVERDUE · Due Mon 19 Oct · Wk 43/, 'Monday of this week, already past'],
    ['2025-10-21', 'red', /OVERDUE/, 'a year ago'],
    ['2027-10-21', 'grey', /Due Thu 21 Oct · Wk 42/, 'a year ahead (same week number must NOT be amber)'],
    ['', 'grey', /^no due date$/, 'blank'], [null, 'grey', /^no due date$/, 'null'], [undefined, 'grey', /^no due date$/, 'missing'],
    ['TBC', 'grey', /^no due date$|\?/, 'text "TBC"'], ['31/12/2026', 'grey', /^no due date$|\?/, 'Irish-style 31/12/2026'], ['2026-13-45', 'grey', /^no due date$|\?/, 'impossible month'],
    ['2026-02-30', 'grey', /^no due date$|\?/, '30 Feb (not a real date — the WO drop-down shows "due ?")'],
    [' 2026-10-22 ', 'amber', /Due Thu 22 Oct/, 'spaces round it'], ['2026-10-22T00:00:00.000Z', 'amber', /Due Thu 22 Oct/, 'with a time'],
    ['<img src=x onerror=window.__xss=1>', 'grey', /^no due date$|\?/, 'HTML in the date'],
  ]],
  ['2026-10-25T12:00:00Z', 'Sun 25 Oct 2026 (clocks go back today)', [
    ['2026-10-24', 'red', /OVERDUE · Due Sat 24 Oct/, 'yesterday (Saturday)'], ['2026-10-25', 'amber', /^Due Sun 25 Oct · Wk 43$/, 'today, Sunday'],
    ['2026-10-26', 'grey', /^Due Mon 26 Oct · Wk 44$/, 'tomorrow, Monday = NEXT week'], ['2026-10-19', 'red', /OVERDUE/, 'Monday of this week'],
  ]],
  ['2026-10-25T23:30:00Z', 'Sun 25 Oct 2026, 23:30 Irish time', [
    ['2026-10-25', 'amber', /Due Sun 25 Oct/, 'today'], ['2026-10-26', 'grey', /Due Mon 26 Oct/, 'tomorrow, Monday = next week'],
  ]],
  ['2026-05-31T23:30:00Z', 'Mon 1 Jun 2026, 00:30 Irish summer time', [
    ['2026-05-31', 'red', /OVERDUE · Due Sun 31 May/, 'yesterday (Sunday)'], ['2026-06-01', 'amber', /^Due Mon 1 Jun · Wk 23$/, 'today, Monday'],
    ['2026-06-07', 'amber', /Due Sun 7 Jun · Wk 23/, 'this Sunday'], ['2026-06-08', 'grey', /Due Mon 8 Jun · Wk 24/, 'next Monday'],
  ]],
  ['2026-12-31T10:00:00Z', 'Thu 31 Dec 2026 (ISO week 53)', [
    ['2026-12-30', 'red', /OVERDUE · Due Wed 30 Dec · Wk 53/, 'yesterday'], ['2026-12-31', 'amber', /^Due Thu 31 Dec · Wk 53$/, 'today'],
    ['2027-01-01', 'amber', /^Due Fri 1 Jan · Wk 53$/, 'New Year\'s Day — same week'], ['2027-01-03', 'amber', /^Due Sun 3 Jan · Wk 53$/, 'Sun 3 Jan — same week'],
    ['2027-01-04', 'grey', /^Due Mon 4 Jan · Wk 1$/, 'Mon 4 Jan — week 1'], ['2026-01-01', 'red', /OVERDUE/, '1 Jan of THIS year'],
  ]],
  ['2027-01-03T10:00:00Z', 'Sun 3 Jan 2027 (still week 53)', [
    ['2026-12-28', 'red', /OVERDUE · Due Mon 28 Dec · Wk 53/, 'Monday of this week (last year)'], ['2027-01-03', 'amber', /^Due Sun 3 Jan · Wk 53$/, 'today'],
    ['2027-01-04', 'grey', /^Due Mon 4 Jan · Wk 1$/, 'tomorrow = week 1'], ['2027-12-31', 'grey', /Due Fri 31 Dec · Wk 52/, 'end of next year'],
  ]],
  ['2027-01-04T00:10:00Z', 'Mon 4 Jan 2027, 00:10', [
    ['2027-01-03', 'red', /OVERDUE · Due Sun 3 Jan · Wk 53/, 'yesterday (week 53)'], ['2027-01-04', 'amber', /^Due Mon 4 Jan · Wk 1$/, 'today'], ['2027-01-10', 'amber', /Due Sun 10 Jan · Wk 1/, 'this Sunday'], ['2027-01-11', 'grey', /Wk 2/, 'next Monday'],
  ]],
];

(async () => {
  const browser = await H.chromium.launch();
  try {
    for (const [now, label, cases] of DAYS) {
      const r = X.v2Row();
      cases.forEach((c, i) => r.orders.push(H.order({ wo: 'WO-D' + i, customer: 'Aderrig Homes', floor: 'D', unit: String(i), title: 'DUE ' + i, dueDate: c[0], origDueDate: c[0] })));
      const S = X.makeServer(r);
      const t = await X.dev(browser, S, 'office', { now }), p = t.page;
      const today = await p.evaluate(() => todayLocal() + ' ' + new Date().toString().slice(0, 21));
      for (let i = 0; i < cases.length; i++) {
        const [due, cls, re, what] = cases[i];
        await p.evaluate(wo => openListEditor(null, wo), 'WO-D' + i); await sleep(450);
        const j = await job(p);
        const opt = await p.evaluate(wo => { const s = document.getElementById('me-wo'); const o = s && [...s.options].find(x => x.value === wo); return o ? o.textContent : null; }, 'WO-D' + i);
        const gotCls = (j.dueCls || '').replace('lw-due', '').trim();
        rec('today ' + label + ' · due ' + JSON.stringify(due === undefined ? 'missing' : due) + ' (' + what + ') → ' + cls + ' tag', j.open && gotCls === cls && re.test(j.due || ''), JSON.stringify({ tag: j.due, cls: gotCls, dropDown: opt, today }));
        if (/no due date|\?/.test(String(re)) && j.due && !/no due date/.test(j.due)) rec('…tag and WO drop-down agree about ' + JSON.stringify(due) + ' (drop-down: "' + opt + '")', /due \?/.test(j.due) === /due \?/.test(opt || ''), JSON.stringify({ tag: j.due, opt })); // (Coder fix 12 Nov) both say "due ?" for a date that can't be read
        await closeAll(p);
      }
      if (/^Wed 21 Oct/.test(label)) { const n = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = lwDueTag({ dueDate: 46317 }); return d.innerText; });
        rec('a due date stored as a NUMBER (Excel serial 46317) → "no due date" / "due ?" tag, no crash (the tag only — the Capacity Board itself crashes on a numeric due date, not part of this window)', /no due date|due \?/.test(n), n); }
      rec('today ' + label + ': HTML in a due date did not run', !(await p.evaluate(() => window.__xss)));
      rec('today ' + label + ': no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
    // the tag follows the plan: the due date moved on another PC while the window is open
    {
      const r = X.v2Row(); r.orders.push(H.order({ wo: 'WO-M', customer: 'Aderrig Homes', floor: 'M', unit: '1', title: 'MOVED', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
      const S = X.makeServer(r); const t = await X.dev(browser, S, 'office'), p = t.page;
      await p.evaluate(() => openListEditor(null, 'WO-M')); await sleep(600);
      S.row.orders.find(o => o.wo === 'WO-M').dueDate = '2026-10-19'; S.row.version = (S.row.version || 1) + 1;
      await p.evaluate(async () => { await loadDB(); }); await sleep(600);
      let j = await job(p);
      rec('(info) due date moved to 19 Oct on another PC, this screen reloaded the plan, window still open → the tag shows the new date at once', /19 Oct/.test(j.due || ''), j.due);
      await L.setv(p, '0|item', 'x'); await L.click(p, 'me-addsaw'); await sleep(300);
      j = await job(p);
      rec('…at the latest after the next thing the person does in the window (＋ Row)', /OVERDUE · Due Mon 19 Oct/.test(j.due || '') && /red/.test(j.dueCls), JSON.stringify([j.due, j.dueCls]));
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
