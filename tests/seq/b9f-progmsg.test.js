// Manager B9 note 3 (Coder): a job Johnny ticked processed while Cienapps is still below step 5 is "programmed" for the date
// engine — the preview flag now says "processed by pre-production — take it out of the nest" (not "programmed (step 5)"); a
// real Cienapps step-5 job keeps the old words. Same for the "due date moved" check window. Fake Supabase only.
// Run: node tests/seq/b9f-progmsg.test.js
const { X, makePool, pre } = require('./b9fix.js');
const { H, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = makePool();
    const a = await pre(browser, S);
    await a.page.evaluate(() => document.querySelector('[data-pretick="W:WO-12"]').click()); await sleep(700);
    const r = await a.page.evaluate(() => {
      const o = w => DB.orders.find(x => x.wo === w), far = w => addDayISO(o(w).dueDate, 21);
      const t = w => { const rw = moveDates([o(w)], { due: far(w) }, { why: 'Production' }, 'Op', { src: 'planner' }).rows[0]; return { f: rw.flags, txt: rw.flags.map(f => dmFlagTxt(f, rw)) }; };
      const s16 = o('WO-16').step;
      return { tick: t('WO-12'), step5: t('WO-16'), s16, s12: o('WO-12').step };
    });
    rec('Johnny\'s tick (Cienapps below 5): "processed by pre-production — take it out of the nest"', r.tick.f.includes('programmed') && r.tick.txt.includes('processed by pre-production — take it out of the nest') && !r.tick.txt.some(x => /step 5/.test(x)), JSON.stringify(r));
    rec('Cienapps step 5: still "programmed (step 5) — take it out of the nest"', r.step5.f.includes('programmed') && r.step5.txt.includes('programmed (step 5) — take it out of the nest'), JSON.stringify(r.step5));
    const d = await a.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-12'); o.dueMv = { at: new Date().toISOString(), by: 'Op', from: o.dueDate, to: o.dueDate, prog: true };
      const ff = DB.orders.find(x => x.wo === 'WO-16'); ff.dueMv = { at: new Date().toISOString(), by: 'Op', from: ff.dueDate, to: ff.dueDate, prog: true };
      window.dateCanMove = () => true; const out = [];
      for (const w of ['WO-12', 'WO-16']) { dmCheckDlg(w); const ov = [...document.querySelectorAll('.pod-ovl')].pop(); out.push(ov ? ov.innerText : ''); if (ov) ov.remove(); }
      return out; });
    rec('the "due date moved" window says "processed by pre-production" for the ticked job, "programmed (step 5)" for the step-5 job', /already processed by pre-production — take it out of the nest/.test(d[0]) && /already programmed \(step 5\) — take it out of the nest/.test(d[1]), JSON.stringify(d.map(x => x.slice(0, 200))));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  } finally { await browser.close(); }
  X.finish();
})();
