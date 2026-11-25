// PM sequence step 2 (Coder, B5): the table probe (hidden before the SQL / with the switch off), PM assignment by the office
// and the Production Manager (history written by the database), "Unassigned (N)" first, the PM picks his name once,
// sees only his projects ("All projects" shows the rest), the Pre-production role + PIN + Staff column, and the three
// Settings numbers. Fake Supabase only. Run: node tests/seq/s2-pm-assign.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  // ---- before the SQL: nothing new shows, nothing breaks
  const S0 = X.makeServer(null, { noSeq: true });
  const o0 = await X.dev(browser, S0, 'office');
  await o0.page.evaluate(() => { showTab('l'); lsProjectsDlg(); }); await sleep(300);
  const r0 = await o0.page.evaluate(() => ({ st: SEQP.st, pmCol: /\bPM\b/.test(document.querySelector('#pj-body thead').innerText), sel: !!document.querySelector('[data-seqpmd],[data-seqpmc]'), un: !!document.querySelector('.seq-un') }));
  rec('before the SQL: probe says missing, no PM column / picker / Unassigned line', r0.st === 'missing' && !r0.pmCol && !r0.sel && !r0.un, JSON.stringify(r0));
  await o0.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('s'); }); await sleep(200);
  const s0 = await o0.page.evaluate(() => ({ seqSet: !!document.getElementById('set-seq'), prePin: !!document.getElementById('s-pin-pre'), preCol: [...document.querySelectorAll('.lst-tbl thead')].some(h => /Pre-prod/i.test(h.innerText)) }));
  rec('before the SQL: Settings has no sequence panel, no Pre-production PIN, no Staff column', !s0.seqSet && !s0.prePin && !s0.preCol, JSON.stringify(s0));
  const n0 = S0.log.filter(x => /project_seq|seq_/.test(x)).length;
  await o0.page.evaluate(async () => { await lsPoll(); await lsPoll(); }); await sleep(200);
  rec('before the SQL: the sequence tables are not asked again after the "not found"', n0 >= 1 && S0.log.filter(x => /project_seq|seq_/.test(x)).length === n0, n0 + ' → ' + S0.log.filter(x => /project_seq|seq_/.test(x)).length);
  await o0.page.evaluate(() => rolePicker()); await sleep(100);
  rec('before the SQL: no Pre-production button on the role picker', await o0.page.evaluate(() => { const b = document.querySelector('[data-role="pre"]'); return !b || b.hidden; }));
  rec('before the SQL: no page errors', !(S0.errors || []).length, JSON.stringify(S0.errors));
  await o0.close();

  // ---- lists switch off: the tables are never even asked
  const S1 = X.makeServer(X.v1Row());
  const o1 = await X.dev(browser, S1, 'office');
  await o1.page.evaluate(() => showTab('s')); await sleep(200);
  const r1 = await o1.page.evaluate(() => ({ st: SEQP.st, set: !!document.getElementById('set-seq'), pre: !!document.getElementById('s-pin-pre') }));
  rec('switch off: no sequence request at all, no sequence settings', X.SS.seqCalls(S1).length === 0 && r1.st === '' && !r1.set && !r1.pre, JSON.stringify(r1) + ' ' + X.SS.seqCalls(S1).join(','));
  const pm1 = await X.dev(browser, S1, 'pm', { me: { pm: 'John Burke' } });
  const t1 = await pm1.page.evaluate(() => ({ strip: document.getElementById('pm-strip') ? document.getElementById('pm-strip').innerText : '', me: !!document.querySelector('.seq-me'), dlg: !!document.querySelector('.pod-ovl') }));
  rec('switch off: PM view as today (no name strip, no name question)', !t1.me && !t1.dlg, JSON.stringify(t1));
  rec('switch off: no page errors', !(S1.errors || []).length, JSON.stringify(S1.errors));
  await o1.close(); await pm1.close();

  // ---- with the SQL
  const S = X.makeServer();
  const of = await X.dev(browser, S, 'office');
  rec('sequence tables found', await of.page.evaluate(() => SEQP.st === 'ok' && seqVis()));
  await of.page.evaluate(() => { showTab('l'); lsProjectsDlg(); }); await sleep(300);
  const d1 = await of.page.evaluate(() => ({ un: (document.querySelector('#pj-body .seq-un') || {}).innerText || '', sel: document.querySelectorAll('[data-seqpmd]').length }));
  const opts1 = await X.pmOpts(of.page, 'P1');
  rec('office Projects: "Unassigned (2)" and a PM tick list per project', /Unassigned \(2\)/.test(d1.un) && d1.sel === 2, JSON.stringify(d1));
  rec('PM tick list = only Staff ticked PM', JSON.stringify(opts1) === JSON.stringify(['John Burke', 'Mary Kelly']), JSON.stringify(opts1));
  await of.page.evaluate(() => sessionStorage.setItem('wpfWho', 'Ann Office'));
  rec('tick John Burke + Mary Kelly, Save PMs', await X.tickPMs(of.page, 'P1', ['John Burke', 'Mary Kelly']) === 'ok'); await sleep(500);
  const p1 = X.D.find(S.db, 'projects', 'P1');
  rec('both PMs saved on the project (pms), the old pm column untouched', JSON.stringify(p1.pms) === '["John Burke","Mary Kelly"]' && p1.pm == null, JSON.stringify([p1.pms, p1.pm]));
  rec('the window shows "PMs John Burke · Mary Kelly"', await of.page.evaluate(() => /PMs John Burke · Mary Kelly/.test(document.getElementById('pj-body').innerText)));
  const evs = S.db.t.project_events.filter(e => e.entity === 'project' && e.act === 'pm');
  rec('database history: who changed the PMs, old → new', evs.length === 1 && JSON.stringify(evs[0].old.pms) === '[]' && JSON.stringify(evs[0].new.pms) === '["John Burke","Mary Kelly"]' && evs[0].by === 'Ann Office', JSON.stringify(evs));
  // remove Mary: John kept
  rec('untick Mary Kelly, Save', await X.tickPMs(of.page, 'P1', ['John Burke']) === 'ok'); await sleep(500);
  const ev2 = S.db.t.project_events.filter(e => e.entity === 'project' && e.act === 'pm');
  rec('removing one PM keeps the other; history old [John, Mary] → new [John]', JSON.stringify(X.D.find(S.db, 'projects', 'P1').pms) === '["John Burke"]' && ev2.length === 2 && JSON.stringify(ev2[1].new.pms) === '["John Burke"]' && ev2[1].old.pms.length === 2, JSON.stringify(ev2[1]));
  const d2 = await of.page.evaluate(() => ({ un: (document.querySelector('#pj-body .seq-un') || {}).innerText || '', first: document.querySelector('#pj-body tbody tr input[data-pjn]').value }));
  rec('Unassigned now 1, the unassigned project listed first', /Unassigned \(1\)/.test(d2.un) && d2.first === 'Lucan', JSON.stringify(d2));
  // the Settings: three numbers, PIN, staff column
  await of.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); showTab('s'); }); await sleep(200);
  const s1 = await of.page.evaluate(() => ({ fx: document.getElementById('s-seqFixedDays').value, pw: document.getElementById('s-preWks').value, ww: document.getElementById('s-seqWaitWks').value, pin: document.getElementById('s-pin-pre') && document.getElementById('s-pin-pre').value, col: [...document.querySelectorAll('.lst-tbl thead')].some(h => /Admin/i.test(h.innerText) && /Pre-prod/i.test(h.innerText)), boxes: document.querySelectorAll('[data-str$="|pre"]').length }));
  rec('Settings: 14 / 3 / 3 defaults, Pre-production PIN 1010, Staff column "Pre-prod"', s1.fx === '14' && s1.pw === '3' && s1.ww === '3' && s1.pin === '1010' && s1.col && s1.boxes === 4, JSON.stringify(s1));
  await of.page.evaluate(() => { document.getElementById('s-seqFixedDays').value = '21'; document.getElementById('s-preWks').value = '2'; document.getElementById('s-seqWaitWks').value = '4.5'; document.getElementById('btn-save-seq').click(); }); await sleep(1800);
  const s2 = await of.page.evaluate(() => ({ fx: seqFixedDays(), pw: preWks(), ww: seqWaitWks(), fs: fullSettings() }));
  rec('Settings save: 21 kept; 2 weeks (below 3) and 4.5 refused → defaults', s2.fx === 21 && s2.pw === 3 && s2.ww === 3 && s2.fs.seqFixedDays === 21 && !('preWks' in s2.fs) && !('seqWaitWks' in s2.fs), JSON.stringify([s2.fx, s2.pw, s2.ww]));
  rec('saved in the planner settings (no new top-level key)', (S.row.settings || {}).seqFixedDays === 21 && Object.keys(S.patches[S.patches.length - 1] || {}).every(k => ['orders', 'nid', 'settings', 'version', 'updated_by'].includes(k)), JSON.stringify(Object.keys(S.patches[S.patches.length - 1] || {})));
  const s3 = await of.page.evaluate(() => { const a = settingsFrom({ seqFixedDays: 31, preWks: '5', seqWaitWks: 12 }, {}); applyPlan({ orders: DB.orders, nid: DB.nid, settings: { ...fullSettings(), seqFixedDays: 6 } }); return { a, fx: seqFixedDays() }; });
  rec('out-of-range / text values from the database fall back to the defaults', !('seqFixedDays' in s3.a) && !('preWks' in s3.a) && s3.a.seqWaitWks === 12 && s3.fx === 14, JSON.stringify(s3));
  // the Pre-production PIN change goes through Save PINs
  await of.page.evaluate(() => { window.prompt = () => '9000'; render(); document.getElementById('s-pin-pre').value = '4321'; document.getElementById('btn-save-pins').click(); }); await sleep(300);
  rec('Admin can change the Pre-production PIN', await of.page.evaluate(() => pins().pre === '4321'));
  await of.page.evaluate(() => { DB.pins.pre = '1010'; }); // back to the default for the rest

  // ---- the PM: name once, his projects only, All projects, can't assign
  const pm = await X.dev(browser, S, 'pm');
  const q1 = await pm.page.evaluate(() => ({ dlg: (document.querySelector('.pod-ovl') || {}).innerText || '', names: [...document.querySelectorAll('[data-meis]')].map(b => b.dataset.meis) }));
  rec('PM opens the view: asked which PM he is (Staff ticked PM only)', /Which Project Manager are you/.test(q1.dlg) && JSON.stringify(q1.names) === JSON.stringify(['John Burke', 'Mary Kelly']), JSON.stringify(q1));
  await pm.page.evaluate(() => document.querySelector('[data-meis="John Burke"]').click()); await sleep(300);
  const q2 = await pm.page.evaluate(() => ({ ls: localStorage.getItem('wpfMe_pm'), who: sessionStorage.getItem('wpfWho'), strip: document.getElementById('pm-strip').innerText }));
  rec('name remembered on this device, shown in the strip with "Not you?"', q2.ls === 'John Burke' && q2.who === 'John Burke' && /John Burke/.test(q2.strip) && /Not you\?/.test(q2.strip), JSON.stringify(q2));
  const dl = await pm.page.evaluate(() => [...document.querySelectorAll('#pm-cust option')].map(o => o.value));
  rec('Deliveries: only his project\'s customer', dl.includes('Aderrig Homes') && !dl.includes('Lucan Homes'), JSON.stringify(dl));
  await pm.page.evaluate(() => { pmTab = 'projects'; render(); }); await sleep(200);
  const q3 = await pm.page.evaluate(() => ({ t: document.getElementById('pjh').innerText, sel: !!document.querySelector('[data-seqpmd],[data-seqpmc],[data-seqpmsave]') }));
  rec('Projects tab: only Aderrig, PM shown, no PM tick list (a PM can\'t add himself)', /Aderrig/.test(q3.t) && !/Lucan/.test(q3.t) && /PM John Burke/.test(q3.t) && !q3.sel, JSON.stringify(q3));
  await pm.page.evaluate(() => { const a = document.getElementById('pm-all'); a.checked = true; a.onchange(); }); await sleep(200);
  const q4 = await pm.page.evaluate(() => ({ t: document.getElementById('pjh').innerText, mine1: pmMine('P1'), mine2: pmMine('P2'), ed1: seqCanEdit('P1'), ed2: seqCanEdit('P2') }));
  rec('"All projects": Lucan shows too, but only his own can be changed', /Lucan/.test(q4.t) && q4.mine1 && !q4.mine2 && q4.ed1 && !q4.ed2, JSON.stringify(q4));
  // Not you? → asks again, another name
  await pm.page.evaluate(() => document.getElementById('seq-me-x').click()); await sleep(200);
  await pm.page.evaluate(() => document.querySelector('[data-meis="Mary Kelly"]').click()); await sleep(300);
  const q5 = await pm.page.evaluate(() => ({ ls: localStorage.getItem('wpfMe_pm'), any: pmMineAny(), filt: pmFilterOn() }));
  rec('"Not you?" → Mary Kelly; she has no projects, so all are shown (with a note)', q5.ls === 'Mary Kelly' && !q5.any && !q5.filt, JSON.stringify(q5));
  rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await pm.close();

  // ---- a name removed from Staff is not trusted
  const pm2 = await X.dev(browser, S, 'pm', { me: { pm: 'Someone Gone' } });
  rec('a remembered name no longer ticked PM in Staff = asked again', await pm2.page.evaluate(() => { SEQ_ASKED.clear(); render(); return true; }) && await pm2.page.evaluate(() => seqMe('pm') === '' && /Which Project Manager/.test((document.querySelector('.pod-ovl') || {}).innerText || '')));
  await pm2.close();

  // ---- the Production Manager can assign too; Drawing office can't
  const pr = await X.dev(browser, S, 'prod');
  await pr.page.evaluate(() => lsProjectsDlg()); await sleep(200);
  await pr.page.evaluate(() => sessionStorage.setItem('wpfWho', 'Prod Pat')); await X.tickPMs(pr.page, 'P2', ['Mary Kelly']); await sleep(500);
  rec('Production Manager assigns Mary Kelly to Lucan', JSON.stringify(X.D.find(S.db, 'projects', 'P2').pms) === '["Mary Kelly"]');
  await pr.close();
  const de = await X.dev(browser, S, 'design');
  await de.page.evaluate(() => lsProjectsDlg()); await sleep(200);
  rec('Drawing office sees the PM but has no PM tick list', await de.page.evaluate(() => !document.querySelector('[data-seqpmd],[data-seqpmc]') && /PM John Burke/.test(document.getElementById('pj-body').innerText)));
  await de.close();

  // ---- Pre-production role
  const pre = await X.dev(browser, S, 'pre');
  const w1 = await pre.page.evaluate(() => ({ role: ROLE, lbl: ROLE_LBL.pre, pin: pins().pre, dlg: (document.querySelector('.pod-ovl') || {}).innerText || '' }));
  rec('Pre-production view: role, label, default PIN 1010, asks the name (Staff ticked Pre-production)', w1.role === 'pre' && w1.lbl === 'Pre-production' && w1.pin === '1010' && /Which Pre-production are you/.test(w1.dlg) && /Johnny/.test(w1.dlg), JSON.stringify(w1));
  await pre.page.evaluate(() => document.querySelector('[data-meis="Johnny"]').click()); await sleep(300);
  rec('Pre-production pool page (B9 — was the placeholder) with the name strip', await pre.page.evaluate(() => !!document.getElementById('pre-pool') && /Johnny/.test(document.querySelector('.seq-me').innerText) && localStorage.getItem('wpfMe_pre') === 'Johnny'));
  await pre.page.evaluate(() => { rolePicker(); }); await sleep(100);
  rec('role picker shows Pre-production once the tables are there', await pre.page.evaluate(() => { const b = document.querySelector('[data-role="pre"]'); return !!b && !b.hidden; }));
  await pre.close();
  // ?view=pre with the PIN 1010 opens it
  const pv = await X.dev(browser, S, '');
  const vp = await pv.page.evaluate(() => { localStorage.removeItem('wpfPin_pre'); ROLE = ''; rolePicker(); document.querySelector('[data-role="pre"]').click(); const i = document.getElementById('rpin-in'); i.value = '1010'; i.oninput(); return ROLE; });
  rec('PIN 1010 opens the Pre-production view', vp === 'pre');
  await pv.close();

  // ---- phone 360 px: PM view, no sideways scroll
  const ph = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } });
  await ph.page.evaluate(() => { pmTab = 'projects'; render(); }); await sleep(200);
  const sc = await X.noScroll(ph.page);
  rec('phone 360 px: PM Projects tab has no sideways scroll', sc.sw <= sc.cw + 1, JSON.stringify(sc));
  await ph.close();
  rec('no page errors anywhere', !(S.errors || []).length, JSON.stringify(S.errors));
  await of.close();
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
