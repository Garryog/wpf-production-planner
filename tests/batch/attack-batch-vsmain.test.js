// Tester attack (20 Nov), part A against origin/main (old code read with "git show", read-only): the same fake database, the same
// clock, the branch page and an origin/main page side by side.
//  - Stores page: the same HTML on both (byte for byte, after the build stamp)  - sheets panel (today / next working day): same figures
//  - lists switched OFF (old-style lists): the batch works and adds no call to the list tables
//  - an OLD saw screen on the same device while the new one keeps a batch in browser storage: nothing wiped, nothing confused
// Run: node tests/batch/attack-batch-vsmain.test.js
const F = require('../stage3/fix3.js');
const A = require('../stage3/atk.js');
const S3 = require('../stage3/srv3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const sleep = F.sleep;
const OLD = A.gitShow('origin/main');
// an origin/main page with the same frozen clock as F.dev (NOW) and the same role set-up
async function openOldAt(browser, S, role, ctx0) {
  const ctx = ctx0 || await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Dublin' });
  if (!ctx0) {
    await ctx.addInitScript(`(()=>{const T=${+new Date(F.NOW)};const R=Date;const off=T-R.now();class D extends R{constructor(...a){if(a.length===0){super(R.now()+off);}else super(...a);}static now(){return R.now()+off;}}D.UTC=R.UTC;D.parse=R.parse;window.Date=D;})();`);
    await ctx.addInitScript(() => { localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); sessionStorage.setItem('wpfWho', 'Op'); localStorage.setItem('wpfOpName', 'Op');
      window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'Op'; window.open = () => ({ document: { write() {}, close() {} }, focus() {}, print() {}, close() {} }); });
  }
  const t = await A.openOld(browser, S, OLD, { ctx });
  await t.page.evaluate(async r => { localStorage.setItem('wpfPin_' + r, '9000'); setRole(r); if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } render(); }, role);
  await sleep(300);
  return t;
}
const norm = h => String(h).replace(/v\d{8}[-\w]*/g, 'V').replace(/\s+/g, ' ');
const seed = S => {
  const LN = [['saw', 'Side', '2', 2400, 600, 'MFC White', '1mm ABS', ''], ['saw', 'Top', '1', 2400, 600, 'MFC White', '', ''], ['saw', 'Back', '1', 900, 700, 'Oak', '', ''], ['saw', 'Shelf', '2x2', 560, 500, 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''], ['fit', 'Handle', '4', null, null, 'Bar handle', '', '']];
  F.seedList(S, 'L1', { name: 'House 1', wos: ['WO-1'], lines: LN }); F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'], lines: LN });
  F.seedList(S, 'L3', { name: 'House 3', wos: ['WO-3'], lines: LN }); F.seedList(S, 'L4', { name: 'House 4', wos: ['WO-4'], lines: LN });
};
const row0 = () => { const r = F.v2Row(); r.orders.push(H.order({ wo: 'WO-3', customer: 'Lucan Homes', unit: '3', dueDate: '2026-10-23', origDueDate: '2026-10-23' }), H.order({ wo: 'WO-4', customer: 'Aderrig Homes', unit: '4', dueDate: '2026-10-26', origDueDate: '2026-10-26' })); return r; };
(async () => {
  const browser = await H.chromium.launch();
  try {
    if (!OLD) { rec('origin/main readable with git show', false); throw new Error('no old code'); }
    // ============ 1. Stores page + sheets panel, branch vs origin/main ============
    {
      const S = F.makeServer(row0()); seed(S);
      const nw = await F.dev(browser, S, 'saw'), p = nw.page;
      // some state: ticks today, a hold, a release after sign-off
      await F.tapRow(p, 'data-rt', 'L1:1'); await F.tapRow(p, 'data-rna', 'L2:3'); await F.send(p);
      await p.evaluate(async () => { lsReset(); await lsLoad(); render(); });
      const old = await openOldAt(browser, S, 'saw'), q = old.page;
      const sp = async pg => pg.evaluate(() => sheetNeedHTML());
      const a1 = norm(await sp(p)), b1 = norm(await sp(q));
      rec('sheets panel (today + next working day) HTML: branch = origin/main', a1 === b1, a1 === b1 ? '' : 'branch: ' + a1.slice(0, 300) + ' || main: ' + b1.slice(0, 300));
      // the same with a house in the branch's batch (the batch must not change the panel)
      await p.evaluate(() => { sbToggle('L1'); sbToggle('L3'); wlShowBatch = false; render(); });
      rec('sheets panel unchanged with 2 houses in the batch', norm(await sp(p)) === b1);
      // the panel's numbers computed the old way for other date windows (sheetNeed without the new options)
      const f1 = await p.evaluate(() => JSON.stringify([sheetNeed(lists(), '', '2026-10-30', {}), sheetNeed(lists(), '2026-10-22', '2026-10-26', { cutSince: '2026-10-21' })]));
      const f2 = await q.evaluate(() => JSON.stringify([sheetNeed(lists(), '', '2026-10-30', {}), sheetNeed(lists(), '2026-10-22', '2026-10-26', { cutSince: '2026-10-21' })]));
      rec('sheetNeed() without the new options: identical numbers on branch and origin/main (2 windows)', f1 === f2, f1.slice(0, 200) + ' vs ' + f2.slice(0, 200));
      const c1 = await p.evaluate(() => JSON.stringify(combineLists(lists(), 'saw'))), c2 = await q.evaluate(() => JSON.stringify(combineLists(lists(), 'saw')));
      rec('combineLists() without the new option: identical on branch and origin/main (the Stores combined window)', c1 === c2, c1.slice(0, 200) + ' vs ' + c2.slice(0, 200));
      // Stores page HTML
      const st1 = await F.dev(browser, S, 'stores'), st2 = await openOldAt(browser, S, 'stores');
      const html = pg => pg.evaluate(() => { wlSel.clear(); render(); return document.querySelector('.wl').outerHTML; });
      const h1 = norm(await html(st1.page)), h2 = norm(await html(st2.page));
      let at = 0; while (at < h1.length && h1[at] === h2[at]) at++;
      rec('Stores page: branch HTML = origin/main HTML (byte for byte after whitespace)', h1 === h2, h1 === h2 ? '' : 'first difference at ' + at + ': branch "' + h1.slice(at - 60, at + 120) + '" main "' + h2.slice(at - 60, at + 120) + '"');
      // Stores: tick 2 boxes → the combined fittings window on both
      const comb = pg => pg.evaluate(() => { [...document.querySelectorAll('[data-wlsel]')].slice(0, 2).forEach(b => b.click()); const c = document.getElementById('wl-comb'); if (!c) return 'no #wl-comb'; c.click(); const o = document.querySelector('.pod-ovl,.cmb-ovl,#cmb'); return o ? o.innerText.replace(/\s+/g, ' ') : document.body.innerText.slice(-400); });
      const k1 = norm(await comb(st1.page)), k2 = norm(await comb(st2.page));
      rec('Stores combined fittings window: same text on branch and origin/main', k1 === k2, k1 === k2 ? '' : k1.slice(0, 200) + ' || ' + k2.slice(0, 200));
      rec('no page errors', !(S.errors || []).length && !(S.oldErrors || []).length, JSON.stringify([S.errors, S.oldErrors]));
      await nw.close(); await old.close(); await st1.close(); await st2.close();
    }
    // ============ 2. lists switched OFF (old-style lists in the planner record) ============
    {
      const r = F.v2Row(); delete r.settings.listStore; delete r.settings.listStoreAt;
      r.settings.lists = [{ id: 'OL1', wb: 'W1', sheet: 'H1', name: 'Old house 1', project: 'Old', saw: 2, fit: 0, wos: ['WO-1'], up: F.NOW }, { id: 'OL2', wb: 'W1', sheet: 'H2', name: 'Old house 2', project: 'Old', saw: 1, fit: 0, wos: ['WO-2'], up: F.NOW }];
      r.settings.listWBs = { W1: { project: 'Old', sheets: { H1: [{ k: 'saw', item: 'Side', qty: 2, L: 2400, W: 600, mat: 'MFC White', note: '' }, { k: 'saw', item: 'Back', qty: 1, L: 900, W: 700, mat: 'Oak', note: '' }], H2: [{ k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' }] } } };
      const S = F.makeServer(r);
      const t = await F.dev(browser, S, 'saw'), p = t.page;
      const n0 = S3.newTableCalls(S).length;
      const v = await p.evaluate(() => ({ v2: V2(), btn: [...document.querySelectorAll('[data-wlsel]')].map(b => b.textContent).join('|') }));
      await p.evaluate(() => { document.querySelector('[data-wlsel="OL1"]').click(); document.querySelector('[data-wlsel="OL2"]').click(); document.getElementById('wl-bopen').click(); });
      await sleep(150);
      const b = await p.evaluate(() => ({ boards: [...document.querySelectorAll('.sb-bh')].map(x => x.innerText.replace(/\s+/g, ' ')), side: ([...document.querySelectorAll('.sb-row')].find(x => /^Side/.test(x.innerText)) || {}).innerText || '' }));
      rec('lists OFF: saw cards say "＋ Add to batch" and the batch opens with old-style lists', !v.v2 && /Add to batch/.test(v.btn) && b.boards.length === 2 && /TOTAL\s*6/.test(b.side), JSON.stringify([v, b]));
      await p.evaluate(() => { wlShowBatch = false; render(); }); await sleep(50);
      // tick a line on Old house 1 (old-style tick) → the batch shows it
      const tk = await p.evaluate(() => { const x = document.querySelector('[data-rt^="OL1|"]'); if (!x) return 'no tick'; x.click(); return 'ok'; }); await sleep(150);
      await p.evaluate(() => { wlShowBatch = true; render(); }); await sleep(100);
      const chip = await p.evaluate(() => [...document.querySelectorAll('.sb-chip')].map(c => c.innerText + (c.classList.contains('sb-cut') ? '[cut]' : '')).join(' | '));
      rec('lists OFF: an old-style tick on Old house 1 shows ✓ in the batch (' + tk + ')', /cut/.test(chip), chip);
      await sleep(1500);
      rec('lists OFF: no call to the new list tables was added', S3.newTableCalls(S).length === n0, S3.newTableCalls(S).slice(n0).join(', '));
      rec('lists OFF: nothing about the batch in the planner record', !JSON.stringify(S.row).includes('wpfSawBatch'));
      rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
    // ============ 3. an OLD saw screen on the SAME device (same browser storage) while the new one keeps a batch ============
    {
      const S = F.makeServer(row0()); seed(S);
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Dublin' });
      await ctx.addInitScript(`(()=>{const T=${+new Date(F.NOW)};const R=Date;const off=T-R.now();class D extends R{constructor(...a){if(a.length===0){super(R.now()+off);}else super(...a);}static now(){return R.now()+off;}}D.UTC=R.UTC;D.parse=R.parse;window.Date=D;})();`);
      await ctx.addInitScript(() => { localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); sessionStorage.setItem('wpfWho', 'Op'); localStorage.setItem('wpfOpName', 'Op'); localStorage.setItem('wpfSawBatch', JSON.stringify({ ids: ['L1', 'L2', 'L3'], at: '2026-10-21T08:00:00Z' }));
        window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'Op'; window.open = () => ({ document: { write() {}, close() {} }, focus() {}, print() {}, close() {} }); });
      const old = await openOldAt(browser, S, 'saw', ctx), q = old.page;
      const o1 = await q.evaluate(() => ({ cards: document.querySelectorAll('[data-wlsel]').length, sb: localStorage.getItem('wpfSawBatch') }));
      rec('old saw screen with a batch in this device\'s storage: draws normally and leaves wpfSawBatch alone', o1.cards >= 2 && /L1/.test(o1.sb || ''), JSON.stringify(o1));
      // old screen: tick 2 boxes → its Combined cutting table → MARK ALL CUT COMPLETE (still exists on main)
      const mk = await q.evaluate(async () => { [...document.querySelectorAll('[data-wlsel]')].slice(0, 2).forEach(b => b.click()); const c = document.getElementById('wl-comb'); if (!c) return 'no comb'; c.click(); await new Promise(r => setTimeout(r, 100)); const d = document.getElementById('cmb-done'); if (!d) return 'no cmb-done'; d.click(); await new Promise(r => setTimeout(r, 300)); if (typeof lqSend === 'function') await lqSend(); return 'ok'; });
      await sleep(400);
      const doneIds = S.db.t.lists.filter(l => l.saw_done_at).map(l => l.id);
      rec('old screen\'s MARK ALL CUT COMPLETE still works next to the new code (' + mk + '): ' + doneIds.join(','), mk === 'ok' && doneIds.length === 2, JSON.stringify(doneIds));
      // the new saw page in the same browser: the two finished houses leave its batch with a note, the third stays
      const nwp = await ctx.newPage(); nwp.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
      await S3.attach({ ctx, page: nwp }, S);
      await nwp.goto('https://wpf.test/?view=office'); await nwp.waitForFunction(() => typeof loadDB === 'function' && typeof XLSX !== 'undefined');
      // (round 3) the page's own start-up lsLoad() may still be running here: a lsReset() under it marks the lists loaded with an
      // EMPTY cache (tests/batch/attack3-loaded.test.js, check A) and the batch is dropped. Wait for that load to finish — no timing.
      await nwp.evaluate(async () => { await loadDB(); localStorage.setItem('wpfPin_saw', '9000'); setRole('saw'); while (LST.loading) await LST.loading; if (!LST.loaded) await lsLoad(); render(); });
      const nb = await nwp.evaluate(() => ({ tab: (document.getElementById('wl-tab-batch') || {}).textContent || null, ids: SB.ids.join(), notes: SB.notes.join(' / ') }));
      const left = ['L1', 'L2', 'L3'].filter(id => !doneIds.includes(id));
      rec('new saw page (same device): houses finished by the old screen left the batch with a note; ' + left.join(',') + ' stays', nb.ids === left.join() && /cut complete/.test(nb.notes), JSON.stringify(nb));
      rec('no page errors (old + new on one device)', !(S.errors || []).length && !(S.oldErrors || []).length, JSON.stringify([S.errors, S.oldErrors]));
      await ctx.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
