// attack19-3 (Tester, 19 Nov 2026): the OLD screen (origin/main — still open on PCs on release day) vs the d19 changes.
//  a. new PC takes a hand job off the board (archived); a stale old screen saves an unrelated change → does the job come back / vanish?
//  b. stale old screen books that same hand job → where does it end up?
//  c. old screen × on a hand job → erased (no archive) — the old behaviour still in use during rollout
//  d. old screen Close week with 26 closed weeks + a "taken off the board" entry → is the archived hand job erased by the old trim?
//  e. new screen brings back a hand job from Past weeks; old screen saves → kept?
// Fake Supabase only. Run: node tests/deliveries/attack19-3-oldscreen.test.js
const M = require('../ship/merge-lib');
const { H, makeServer, openRef, oldHtml, recorder, save, reload, w, O, W0 } = M;
const { rec, done } = recorder('attack19-3-oldscreen');
const OLD = 'origin/main';
const NAME = async (p, n) => { if (await p.$('#pick-other')) { await p.fill('#pick-other', n); await p.click('#pick-ok'); await p.waitForTimeout(120); } };
const MAN = (wo, x) => Object.assign({ wo, title: 'Spare doors ' + wo, customer: 'Cairn', value: 450, manual: true, delVeh: '', delDay: '', delDone: false }, x);
async function takeOffNew(p, wo) {
  await p.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 120)); });
  await p.evaluate(wo => document.querySelector('[data-dx="' + wo + '"]').click(), wo); await p.waitForTimeout(60);
  await p.click('#tob-next'); await p.fill('#tob-t', 'DELETE'); await p.click('#tob-go'); await p.waitForTimeout(80); await NAME(p, 'Ann');
}
const where = (p, wo) => p.evaluate(wo => ({ delx: (DB.delx || []).filter(x => x.wo === wo).map(x => (x.delVeh || '') + '|' + (x.delDay || '')), arch: Object.entries(DB.delArchive || {}).filter(([k, a]) => (a.jobs || []).some(j => j.wo === wo)).map(([k, a]) => k + (a.off ? ' OFF' : '')) }), wo);
(async () => {
  const browser = await H.chromium.launch();
  try {
    if (!oldHtml(OLD)) { rec('origin/main available', false); return done(); }
    // a + b
    for (const oldDoes of ['unrelated', 'books-it']) {
      const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [O('WO-2601-1')], settings: { delx: [MAN('JOB-M1', { jid: 'Jtest1', addedAt: '2026-11-10T09:00:00Z' })] } });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, OLD);
      await takeOffNew(A.page, 'JOB-M1'); await save(A.page);
      if (oldDoes === 'unrelated') await B.page.evaluate(() => { DB.orders[0].notes = 'old screen note'; sched(); });
      else await B.page.evaluate(W0 => { window.confirm = () => true; placeJobs([findDel('JOB-M1')], 'IVECO', 'Fri', W0); }, W0);
      await save(B.page); await reload(A.page); await reload(B.page);
      const a = await where(A.page, 'JOB-M1'), b = await where(B.page, 'JOB-M1');
      if (oldDoes === 'unrelated') rec('a: old screen saves something else → JOB-M1 stays off the board and stays archived', !a.delx.length && a.arch.length === 1, JSON.stringify(a));
      else rec('b: old screen books the hand job the new screen archived → it is in ONE place only', !(a.delx.length && a.arch.length), JSON.stringify(a));
      rec(`(${oldDoes}) both screens agree`, JSON.stringify(a) === JSON.stringify(b), JSON.stringify({ a, b }));
      rec(`(${oldDoes}) no page errors`, !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
    // c: old screen × on a hand job
    {
      const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [], settings: { delx: [MAN('JOB-M2')] } });
      const B = await openRef(browser, S, OLD);
      await B.page.evaluate(async () => { window.confirm = () => true; showTab('d'); await new Promise(r => setTimeout(r, 120)); const b = document.querySelector('[data-dx="JOB-M2"]'); b && b.click(); });
      await save(B.page);
      const r = { delx: (S.row.settings.delx || []).map(x => x.wo), arch: Object.keys(S.row.settings.delArchive || {}).length };
      rec('c (rollout risk): × on the OLD screen erases a hand job with no archive and no confirm — new rule "never erased" only holds once every PC has the new file', r.delx.includes('JOB-M2') || r.arch > 0, JSON.stringify(r));
      await B.close();
    }
    // d: old screen trim
    {
      const ar = {};
      for (let i = 0; i < 26; i++) { const d = new Date(Date.UTC(2026, 4, 11) + i * 7 * 864e5).toISOString().slice(0, 10); ar[d + '.k' + i] = { at: d + 'T16:00:00Z', w: d, by: 'Pat', notes: {}, pod: {}, jobs: [{ wo: 'WO-26' + String(i).padStart(2, '0') + '-1', t: 'x', c: 'c', v: 'VOLVO', d: 'Tue', vAt: d + 'T12:00:00Z' }] }; }
      ar['~off.2026-05-01.zz'] = { at: '2026-05-01T10:00:00Z', w: '', by: 'Ann', off: true, why: 'Taken off the board', notes: {}, pod: {}, jobs: [{ wo: 'JOB-OFF', t: 'Taken off hand job', c: 'Cairn', m: 1, x: MAN('JOB-OFF') }] };
      for (const who of ['new', 'old']) {
        const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [O('WO-2699-1', { delVeh: 'VOLVO', delDay: 'Tue', delWk: W0, delDelivAt: '2026-11-10T12:00:00Z', delDone: true })], settings: { delArchive: JSON.parse(JSON.stringify(ar)) } });
        const B = await openRef(browser, S, who === 'old' ? OLD : '');
        await B.page.evaluate(async W0 => { window.confirm = () => true; closeWeek(W0); await new Promise(r => setTimeout(r, 150)); }, W0); await NAME(B.page, 'Bob'); await B.page.waitForTimeout(900);
        await save(B.page);
        const ks = Object.keys(S.row.settings.delArchive || {});
        rec(`d (${who} screen closes a week with 26 weeks + 1 "taken off" entry): the archived hand job JOB-OFF is NOT erased`, ks.includes('~off.2026-05-01.zz'), JSON.stringify({ n: ks.length, first: ks.sort()[0] }));
        await B.close();
      }
    }
    // e: new screen brings a hand job back from Past weeks; stale old screen saves
    {
      const AK = '2026-11-07.zz';
      const S = makeServer({ id: 'main', version: 1, nid: 9, orders: [O('WO-2601-1')], settings: { delx: [], delArchive: { [AK]: { at: '2026-11-07T16:00:00Z', w: '2026-11-02', by: 'Pat', notes: {}, pod: {}, jobs: [{ wo: 'JOB-M8', t: 'Worktop', c: 'Kildare', v: 'IVECO', d: 'Wed', vAt: '2026-11-04T12:00:00Z', m: 1, x: MAN('JOB-M8', { delDone: true }) }] } } } });
      const A = await openRef(browser, S, ''), B = await openRef(browser, S, OLD);
      await A.page.evaluate(() => openDelArchive('2026-11-07.zz')); await A.page.waitForTimeout(80);
      await A.page.evaluate(() => document.querySelector('[data-arcb]').click()); await A.page.waitForTimeout(80); await NAME(A.page, 'Ann');
      await A.page.click('.pod-ovl [data-why="Not delivered after all"]'); await A.page.waitForTimeout(120); await save(A.page);
      await B.page.evaluate(() => { DB.orders[0].notes = 'old'; sched(); }); await save(B.page); await reload(B.page);
      const b = await B.page.evaluate(() => ({ x: (DB.delx || []).filter(x => x.wo === 'JOB-M8').length, back: !!DB.delArchive['2026-11-07.zz'].jobs[0].back, onPage: !!document }));
      rec('e: hand job brought back on the new screen survives an old-screen save (in delx once, row marked back)', b.x === 1 && b.back, JSON.stringify(b));
      // old screen shows it — what label?
      const lbl = await B.page.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 120)); const c = document.querySelector('.dchip[data-dw="JOB-M8"]'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
      rec('INFO e: how the old screen shows the brought-back card', true, lbl);
      rec('e no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
      await A.close(); await B.close();
    }
  } catch (e) { rec('test ran', false, e.stack); }
  await browser.close(); done();
})();
