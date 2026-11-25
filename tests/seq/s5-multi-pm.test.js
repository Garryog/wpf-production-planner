// PM sequence B5 change (Garry, 10 Nov): a project can have TWO OR THREE PMs. They all share it (each sees it as his,
// each can change the one sequence); a PM not on it is read-only; removing one keeps the others; "Unassigned" = no PM at
// all; only the office / Production Manager add or remove PMs; two PCs editing the PM list at once → the second is told
// and shown the first's choice; names with apostrophes; 360 px phone. Fake Supabase only. Run: node tests/seq/s5-multi-pm.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const STAFF = [{ id: 'S1', n: 'John Burke', r: ['pm'] }, { id: 'S2', n: "Mary O'Neill", r: ['pm'] }, { id: 'S5', n: 'Tom Kelly', r: ['pm'] }, { id: 'S3', n: 'Johnny', r: ['pre'] }, { id: 'S4', n: 'Ann Office', r: ['office'] }];
const toastOf = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer(X.v2Row({ staff: STAFF }));
  ['QA', 'QB', 'QC'].forEach((id, i) => X.seqRow(S, id, 'P1', { floor: 'T60', unit: String(i + 1), product: 'K1', name: 'HOUSE ' + id }));
  // ---- office ticks two PMs (one with an apostrophe)
  const of = await X.dev(browser, S, 'office');
  await of.page.evaluate(() => { sessionStorage.setItem('wpfWho', 'Ann Office'); lsProjectsDlg(); }); await sleep(300);
  rec('office: three PMs offered', JSON.stringify(await X.pmOpts(of.page, 'P1')) === JSON.stringify(['John Burke', "Mary O'Neill", 'Tom Kelly']));
  await X.tickPMs(of.page, 'P1', ['John Burke', "Mary O'Neill"]); await sleep(500);
  rec('saved: John Burke + Mary O\'Neill (apostrophe kept)', JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms) === JSON.stringify(['John Burke', "Mary O'Neill"]));
  const un = await of.page.evaluate(() => ({ t: (document.querySelector('#pj-body .seq-un') || {}).innerText || '', w: document.getElementById('pj-body').innerText }));
  rec('Unassigned (1) = only Lucan (no PM at all); window shows both names', /Unassigned \(1\)/.test(un.t) && /PMs John Burke · Mary O'Neill/.test(un.w), un.t);
  // ---- both PMs see it as theirs and can move rows; the third is read-only
  const jb = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
  const mo = await X.dev(browser, S, 'pm', { me: { pm: "Mary O'Neill" } });
  const tk = await X.dev(browser, S, 'pm', { me: { pm: 'Tom Kelly' } });
  for (const t of [jb, mo, tk]) { await t.page.evaluate(() => { pmTab = 'seq'; render(); }); } await sleep(300);
  const st = async t => t.page.evaluate(() => ({ mine: pmMine('P1'), can: seqCanEdit('P1'), up: document.querySelectorAll('[data-sequp]').length, h: (document.querySelector('.seq-top') || {}).innerText || '', pick: [...document.querySelectorAll('#seq-proj option')].map(o => o.textContent) }));
  const a = await st(jb), b = await st(mo), c = await st(tk);
  rec('John: Aderrig is his, move buttons, title "PMs John Burke · Mary O\'Neill"', a.mine && a.can && a.up === 3 && /PMs John Burke · Mary O'Neill/.test(a.h), JSON.stringify(a));
  rec('Mary O\'Neill: Aderrig is hers too, move buttons', b.mine && b.can && b.up === 3, JSON.stringify(b));
  rec('Tom Kelly (not on it): not his, no move buttons; with no projects of his own he sees all, read-only', !c.mine && !c.can && c.up === 0 && c.pick.includes('Aderrig (read-only)'), JSON.stringify(c));
  await jb.page.evaluate(() => document.querySelector('[data-seqdn="QA"]').click()); await sleep(600);
  rec('John moves A down', X.order(S, 'P1').join() === 'QB,QA,QC', X.order(S, 'P1').join());
  await mo.page.evaluate(async () => { await seqFresh('P1'); render(); }); await sleep(200);
  await mo.page.evaluate(() => document.querySelector('[data-seqdn="QA"]').click()); await sleep(600);
  rec('Mary moves A down again (same sequence, one table)', X.order(S, 'P1').join() === 'QB,QC,QA', X.order(S, 'P1').join());
  const n0 = (S.rpcCalls || []).filter(x => x.fn === 'seq_move').length;
  await tk.page.evaluate(() => seqMoveReq('P1', 'QA', { up: 1 })); await sleep(300);
  rec('Tom cannot move it even by calling the move directly', (S.rpcCalls || []).filter(x => x.fn === 'seq_move').length === n0);
  // Deliveries filter: both PMs see Aderrig Homes
  const dl = async t => { await t.page.evaluate(() => { pmTab = ''; render(); }); await sleep(150); return t.page.evaluate(() => [...document.querySelectorAll('#pm-cust option')].map(o => o.value)); };
  const dj = await dl(jb), dm = await dl(mo);
  rec('Deliveries: both PMs get Aderrig Homes, not Lucan', dj.includes('Aderrig Homes') && dm.includes('Aderrig Homes') && !dj.includes('Lucan Homes') && !dm.includes('Lucan Homes'), JSON.stringify([dj, dm]));
  // ---- removing John keeps Mary
  await of.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsProjectsDlg(); }); await sleep(200);
  await X.tickPMs(of.page, 'P1', ["Mary O'Neill"]); await sleep(500);
  for (const t of [jb, mo]) { await t.page.evaluate(async () => { await lsPoll(); pmTab = 'seq'; SEQV.pid = 'P1'; render(); }); } await sleep(300);
  const a2 = await st(jb), b2 = await st(mo);
  rec('John removed: Mary keeps it (hers, can move); John now read-only', b2.mine && b2.can && !a2.mine && !a2.can && a2.up === 0, JSON.stringify([a2.mine, a2.can, b2.mine, b2.can]));
  const ev = S.db.t.project_events.filter(e => e.act === 'pm');
  rec('history: two PM changes, last old [John, Mary] → new [Mary]', ev.length === 2 && JSON.stringify(ev[1].new.pms) === JSON.stringify(["Mary O'Neill"]) && ev[1].old.pms.length === 2 && ev[1].by === 'Ann Office', JSON.stringify(ev[1]));
  // ---- two PCs editing the PM list at once
  const pr = await X.dev(browser, S, 'prod');
  await pr.page.evaluate(() => { sessionStorage.setItem('wpfWho', 'Prod Pat'); lsProjectsDlg(); }); await sleep(200);
  await of.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsProjectsDlg(); }); await sleep(200);
  await X.tickPMs(of.page, 'P1', ["Mary O'Neill", 'Tom Kelly']); await sleep(500);
  await X.tickPMs(pr.page, 'P1', ["Mary O'Neill", 'John Burke']); await sleep(600);
  const tp = await toastOf(pr.page), tickedNow = await X.pmTicked(pr.page, 'P1');
  rec('two PCs: the second is refused, the first\'s choice kept (Mary + Tom)', JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms) === JSON.stringify(["Mary O'Neill", 'Tom Kelly']), JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms));
  rec('… the second PC is told and shown the first\'s choice', /someone else changed the PMs/.test(tp) && /Mary O'Neill · Tom Kelly/.test(tp) && JSON.stringify(tickedNow) === JSON.stringify(["Mary O'Neill", 'Tom Kelly']), tp + ' | ' + JSON.stringify(tickedNow));
  // ---- no PMs at all = Unassigned; a saved list with no change sends nothing
  const nPatch = S.log.filter(x => /^PATCH \/projects/.test(x)).length;
  await X.tickPMs(pr.page, 'P1', ["Mary O'Neill", 'Tom Kelly']); await sleep(300);
  rec('Save PMs with nothing changed sends nothing', S.log.filter(x => /^PATCH \/projects/.test(x)).length === nPatch);
  await X.tickPMs(pr.page, 'P1', []); await sleep(500);
  rec('all PMs removed: pms empty, Aderrig counted Unassigned (2)', JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms) === '[]' && await pr.page.evaluate(() => /Unassigned \(2\)/.test(document.getElementById('pj-body').innerText)));
  // ---- a project row with no pms field (e.g. read before the column existed) = no PM, nothing breaks
  rec('a project without the pms field reads as no PM', await pr.page.evaluate(() => { const p = { ...LST.p.get('P2') }; delete p.pms; return seqPMs(p).length === 0 && seqPM(p) === ''; }));
  // ---- phone 360 px: the office tick list fits
  const ph = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
  await ph.page.evaluate(() => { lsProjectsDlg(); document.querySelector('[data-seqpmd="P1"]').open = true; }); await sleep(200);
  const box = await ph.page.evaluate(() => { const b = document.querySelector('[data-seqpmd="P1"] .seq-pmbox').getBoundingClientRect(); return { r: b.right, w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }; });
  const pmph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: "Mary O'Neill" } });
  await pmph.page.evaluate(() => { PMALL = true; pmTab = 'projects'; render(); }); await sleep(200);
  const sc = await X.noScroll(pmph.page);
  rec('phone 360 px: PM view has no sideways scroll; the office tick list is reachable', sc.sw <= sc.cw + 1 && box.w === 360 && box.r <= 360 && box.sw <= 361, JSON.stringify([sc, box]));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
