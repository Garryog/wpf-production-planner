// Tester attack round 1, Part 2 step 2: a screen still running the PREVIOUS version (Part 1 code, commit eaa74a0 — no
// sequence settings) saves an unrelated edit after this version is live. Are settings.seqFixedDays / preWks / seqWaitWks,
// the Pre-production PIN and the Staff "pre" tick kept? Stubbed Supabase only (tests/stage1/srv.js via
// tests/dates/attack1-lib.js). Run: node tests/seq/attack1-oldtab.test.js
const { H, makeServer, open, openOld, recorder, save, reload } = require('../dates/attack1-lib');
const { rec, done } = recorder('seq attack1-oldtab');
const NOW = '2026-11-10T10:00:00Z';
const REF = 'eaa74a0';
(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', version: 1, nid: 5, settings: { seqFixedDays: 21, preWks: 4, seqWaitWks: 2, pins: { pre: '4242' }, staff: [{ id: 'S3', n: 'Johnny', r: ['pre'] }, { id: 'S1', n: 'John Burke', r: ['pm'] }] },
    orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes' }), H.order({ wo: 'WO-2', customer: 'Aderrig Homes' })] };
  const S = makeServer(row);
  const N = await open(browser, S, { now: NOW });
  rec('new screen reads 21 / 4 / 2', JSON.stringify(await N.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()])) === '[21,4,2]');
  const OL = await openOld(browser, S, { now: NOW, ref: REF });
  await OL.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-2'); o.notes = 'old screen note'; sched(); });
  await save(OL.page);
  const st = S.row.settings || {};
  rec('old screen saved its note', (S.row.orders.find(o => o.wo === 'WO-2') || {}).notes === 'old screen note');
  rec('old screen save keeps settings.seqFixedDays / preWks / seqWaitWks (21 / 4 / 2)', st.seqFixedDays === 21 && st.preWks === 4 && st.seqWaitWks === 2, JSON.stringify([st.seqFixedDays, st.preWks, st.seqWaitWks]));
  rec('old screen save keeps the Pre-production PIN', (st.pins || {}).pre === '4242', JSON.stringify(st.pins));
  rec('old screen save keeps Johnny\'s Staff "pre" tick', (st.staff || []).some(s => s.n === 'Johnny' && (s.r || []).includes('pre')), JSON.stringify(st.staff));
  await reload(N.page);
  rec('the new screen still uses 21 / 4 / 2 after the old save', JSON.stringify(await N.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()])) === '[21,4,2]', JSON.stringify(await N.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()])));
  const F = await open(browser, S, { now: NOW });
  rec('a screen opened AFTER the old save uses 21 / 4 / 2', JSON.stringify(await F.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()])) === '[21,4,2]', JSON.stringify(await F.page.evaluate(() => [seqFixedDays(), preWks(), seqWaitWks()])));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
