// Garry 11 Nov: the sequence "Set date" tool — a date picked on a Sunday / bank holiday moves to the next delivery day (the build
// date follows on a working day) and the preview says it was moved. Fake Supabase only. Run: node tests/seq/s14-set-holiday.test.js
const X = require('./fixs.js');
const { H, rec } = X;
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer();
    const t = await X.dev(browser, S, 'office'), p = t.page;
    const calc = d => p.evaluate(d => { const ov = document.createElement('div'); ov.innerHTML = '<input id="sd-date"><div id="sd-sug"></div>'; ov.querySelector('#sd-date').value = d;
      const c = seqDtCalc('set', [], ov), r = c.dateOf ? c.dateOf({}, null) : {}; return { deliv: r.job && r.job.deliv, due: r.job && r.job.due, req: r.req, sug: ov.querySelector('#sd-sug').textContent, wd: r.job && isWorkDay(r.job.due) }; }, d);
    let c = await calc('2026-12-25');
    rec('Set to Fri 25 Dec 2026: delivery moves to Tue 29 Dec (26 Sat, 27 Sun, 28 Mon substitute all skipped); build on a working day; preview says moved', c.deliv === '2026-12-29' && c.req === '2026-12-29' && c.wd && /25 Dec[\s\S]*moved to[\s\S]*29 Dec/.test(c.sug), JSON.stringify(c));
    c = await calc('2026-10-26');
    rec('Set to Mon 26 Oct 2026 (October bank holiday): delivery Tue 27 Oct, preview says moved', c.deliv === '2026-10-27' && /moved to/.test(c.sug), JSON.stringify(c));
    c = await calc('2026-11-14');
    rec('Set to Sat 14 Nov (a delivery day): kept, nothing said about moving', c.deliv === '2026-11-14' && !/moved/.test(c.sug), JSON.stringify(c));
    c = await calc('2026-11-12');
    rec('Set to Thu 12 Nov: kept', c.deliv === '2026-11-12' && !/moved/.test(c.sug), JSON.stringify(c));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
