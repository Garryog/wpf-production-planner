// Tester attack 12b — attacks on the attack12 fixes (c400f0e..0008f9e): a no-house WO next to a genuine possible double;
// Reference with fewer than 4 parts / junk / an extra dash; "KITCHEN ISLAND" names; revised line ❓ → Add anyway toggled, saved,
// uploaded again; Put back when the WO has since got another live row; Use <date> on Sat 26 Dec / Sun 27 Dec 2026 / 17 Mar 2027;
// ⏳ across the 25 Oct 2026 clock change; LGF / level 0 / T12 in the cutting-list Find-the-WO lookup (must ask, never pick);
// 360 px with every panel open. Fake Supabase only. Run: node tests/seq/attack12b-fixes.test.js
const X = require('./fixs.js'), B = require('./b10fix.js');
const { H, D, rec, sleep } = X;
const C = 'Aderrig Homes';
const J = (wo, f, u, t, x) => H.order(Object.assign({ wo, customer: C, floor: f, unit: u, title: t, dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '', step: '4. READY FOR PRODUCTION' }, x || {}));
const rowOf = (S, id) => D.find(S.db, 'project_seq', id);
const woRows = (S, wo) => S.db.t.project_seq.filter(r => r.wo === wo && r.state !== 'removed');
const tap = async (p, sel, ms) => { const ok = await p.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel); await sleep(ms || 900); return ok; };
const toastTxt = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const U = (S, id, f, u, p, n, kind, x) => X.seqRow(S, id, 'P1', Object.assign({ floor: f, unit: u, product: p, name: n, kind, src: 'upload', upload_id: 'UP1', why: 'Cienapps upload: a.xlsx' }, x || {}));
function srv(jobs, rows, row0) { const row = row0 || X.v2Row(); row.orders.push(...jobs); const S = X.makeServer(row); D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] }); (rows || []).forEach(r => U(S, ...r)); return S; }
const plan = p => p.evaluate(() => { const pl = seqWOPlan('P1'); return { confirm: pl.confirm.map(j => j.o.wo + ':' + j.c.map(x => x.r.id + '/' + x.m + (x.sug ? '*' : '')).join('+')), none: pl.none.map(j => j.o.wo), auto: pl.auto.map(j => j.o.wo + '>' + j.auto.id), dbl: seqDoubles(pl).map(d => d.n.wo + '>' + d.w.id) }; });
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ===== 1: no-house WO + a genuine possible double + a certain pair, all in one project
    const S1 = srv([J('WO-901', '', '', 'HOUSE TYPE A', { ref: '2796-15-2-APT 51' }), J('WO-902', 'T12', '52', 'HOUSE TYPE A'), J('WO-903', 'T12', '53', 'HOUSE TYPE A')],
      [['R51', '2', 'Apt 51', 'K8', 'HOUSE TYPE A', 'kitchen'], ['R52', 'T12', '52', 'K8', 'HOUSE TYPE A', 'kitchen'], ['R53', '0', '53', 'K8', 'HOUSE TYPE A', 'kitchen']]);
    X.seqRow(S1, 'N53', 'P1', { wo: 'WO-903', floor: 'T12', unit: '53', descr: 'HOUSE TYPE A', kind: 'kitchen', src: 'import', is_new: true });
    const a = await X.dev(browser, S1, 'office');
    await a.page.evaluate(async () => { await seqFresh('P1'); return seqReconcile(['P1'], new Set(['WO-901', 'WO-902'].map(woKey))); });
    let pl = await plan(a.page);
    rec('F1 no-house WO-901 never blocks: WO-902 → R52 automatic', rowOf(S1, 'R52').wo === 'WO-902', JSON.stringify(pl));
    rec('F2 WO-901 not matched, offered R51 as a Reference suggestion (not sure), never a 🆕 row', !rowOf(S1, 'R51').wo && !woRows(S1, 'WO-901').length && pl.confirm.some(c => /^WO-901:R51\/unsure\*/.test(c)), JSON.stringify(pl.confirm));
    rec('F3 the genuine double (🆕 WO-903 row vs waiting "0 / 53") is still flagged', pl.dbl.includes('WO-903>R53'), JSON.stringify(pl.dbl));
    // Reference shapes
    const rf = await a.page.evaluate(() => ['2796-15', '2604-WO-50', 'junk', '---', 'A-B-C-D', '2796-15-0-', 'WPF-2796-15-2-APT 51', '2796-15-T12-APT-51'].map(r => { const h = seqRefHouse({ ref: r }); return r + '=>' + (h ? h.floor + '|' + h.unit : 'null'); }));
    rec('F4 Reference with < 4 parts / "junk" / "---" / an empty unit → no suggestion', /2796-15=>null/.test(rf) && /2604-WO-50=>null/.test(rf) && /junk=>null/.test(rf) && /---=>null/.test(rf) && /2796-15-0-=>null/.test(rf), JSON.stringify(rf));
    rec('F5 "2796-15-T12-APT-51" → floor T12, unit APT-51', rf.includes('2796-15-T12-APT-51=>T12|APT-51'), JSON.stringify(rf));
    rec('F6 [Low] a Reference with a prefix ("WPF-2796-15-2-APT 51") is not misread as floor 15 / unit "2-APT 51"', !rf.includes('WPF-2796-15-2-APT 51=>15|2-APT 51'), JSON.stringify(rf));
    // a junk Reference must never create a "same" or an automatic match
    await a.page.evaluate(() => { DB.orders.push({ ...DB.orders.find(o => o.wo === 'WO-901'), wo: 'WO-904', ref: 'X-Y-T12-52', floor: '', unit: '' }); seqMapsDrop(); });
    pl = await plan(a.page);
    rec('F7 junk-ish Reference "X-Y-T12-52": only ever a suggestion, never automatic', !pl.auto.some(x => /WO-904/.test(x)) && pl.confirm.every(c => !/^WO-904:./.test(c) || c.split(':')[1].split('+').every(x => /\/unsure/.test(x))) && !woRows(S1, 'WO-904').length, JSON.stringify(pl));
    await a.close();

    // ===== 2: KITCHEN ISLAND names
    const kd = await (async () => { const t = await X.dev(browser, X.makeServer(), 'office'); const r = await t.page.evaluate(() => {
      const up = (n, d) => seqReadUpload([['Qty', 'Floor', 'Unit', 'Product', 'Name', 'Description'], [1, 'T12', '80', 'K9', n, d]], 0).lines[0].kind;
      return { kiName: up('HOUSE TYPE B KITCHEN ISLAND', ''), kiWO: seqKind('HOUSE TYPE B KITCHEN ISLAND'), isName: up('HOUSE TYPE B ISLAND', 'KITCHEN ISLAND 2400'), isWO: seqKind('HOUSE TYPE B ISLAND'), k: up('HOUSE TYPE B', 'KITCHEN TYPE 1'), kWO: seqKind('HOUSE TYPE B') }; }); await t.close(); return r; })();
    rec('F8 the same text gives the same kind for an upload line and a WO ("KITCHEN ISLAND", "ISLAND", plain)', kd.kiName === kd.kiWO && kd.isName === kd.isWO && kd.k === kd.kWO, JSON.stringify(kd));
    rec('F9 "HOUSE TYPE B KITCHEN ISLAND" (line) is not the same kind as the house kitchen — an island never takes the kitchen\'s place', kd.kiName !== kd.k, JSON.stringify(kd));
    const S2 = srv([J('WO-951', 'T12', '80', 'HOUSE TYPE B'), J('WO-952', 'T12', '80', 'HOUSE TYPE B KITCHEN ISLAND')],
      [['K', 'T12', '80', 'K8', 'HOUSE TYPE B', 'kitchen'], ['I', 'T12', '80', 'K9', 'HOUSE TYPE B KITCHEN ISLAND', kd.kiName]]);
    const a2 = await X.dev(browser, S2, 'office');
    await a2.page.evaluate(async () => { await seqFresh('P1'); return seqReconcile(['P1'], new Set(['WO-951', 'WO-952'].map(woKey))); });
    pl = await plan(a2.page);
    rec('F10 kitchen WO-951 → K and island WO-952 → I, each automatic or asked — never crossed, never a 🆕 extra row', rowOf(S2, 'K').wo !== 'WO-952' && rowOf(S2, 'I').wo !== 'WO-951' && !woRows(S2, 'WO-951').some(r => r.is_new) && !woRows(S2, 'WO-952').some(r => r.is_new), JSON.stringify({ K: rowOf(S2, 'K').wo, I: rowOf(S2, 'I').wo, pl }));
    rec('F11 [usability] the kitchen WO is matched automatically (its name equals one row only)', rowOf(S2, 'K').wo === 'WO-951', JSON.stringify(pl));
    await a2.close();

    // ===== 3: revised line ❓ → Add anyway toggled, saved, then the same revised file again
    const S3 = srv([], [['L1', 'T09', '12', 'K8', 'HOUSE TYPE B LH', 'kitchen']]);
    const pm = await X.dev(browser, S3, 'pm', { me: { pm: 'John Burke' } }), p = pm.page;
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(800);
    const REV = [B.HDR, B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B RH', 'KITCHEN TYPE 1 RH', 3950])];
    await B.upload(p, REV, 'rev.xlsx');
    let v = await B.preview(p);
    rec('F12 revised line shown ❓ "revised line?", Save 0', v.uns === 1 && /revised line/.test(v.t) && v.dis, JSON.stringify([v.add, v.uns, v.ok]));
    for (let i = 0; i < 3; i++) { await p.evaluate(() => { const b = document.querySelector('[data-squf]'); b.checked = !b.checked; b.dispatchEvent(new Event('change')); }); await sleep(120); }
    v = await B.preview(p);
    rec('F13 Add anyway ticked / unticked / ticked: Save 1 row', /Save 1 row/.test(v.ok) && !v.dis, v.ok);
    await p.evaluate(() => document.getElementById('squ-ok').click()); await sleep(900);
    rec('F14 saved: 2 kitchen rows for T09 / 12 (the old and the revised), not 3', X.DS.liveOf(S3.db, 'P1').length === 2, X.DS.liveOf(S3.db, 'P1').map(r => r.name).join());
    await B.upload(p, REV, 'rev.xlsx');
    v = await B.preview(p);
    rec('F15 the same revised file again: Skipped 1, nothing to add, nothing ❓', v.skip === 1 && !v.add && !v.uns, JSON.stringify([v.add, v.skip, v.uns]));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    rec('F16 PM: no page errors', !(S3.errors || []).length, JSON.stringify(S3.errors));
    await pm.close();

    // ===== 4: Put back when the WO has since got another live row
    const S4 = srv([J('WO-960', 'T12', '60', 'HOUSE TYPE A')], []);
    X.seqRow(S4, 'G1', 'P1', { wo: 'WO-960', floor: 'T12', unit: '60', descr: 'HOUSE TYPE A', kind: 'kitchen', src: 'import' });
    X.DS.RPC.seq_remove(S4.db, { p_id: 'G1', p_by: 'John Burke', p_why: 'Wrong project' });
    X.seqRow(S4, 'KEEP', 'P1', { floor: 'T12', unit: '61', product: 'K8', name: 'HOUSE TYPE A', kind: 'kitchen', src: 'upload' });
    const pm4 = await X.dev(browser, S4, 'pm', { me: { pm: 'John Burke' } }), q = pm4.page;
    await q.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const cf = await q.evaluate(() => ((document.getElementById('seq-cf') || {}).innerText || '').replace(/\s+/g, ' '));
    rec('F17 the hand-removed WO-960 shows as "taken out by John Burke … [Put back]"', /WO-960/.test(cf) && /taken out/i.test(cf) && /Put back/.test(cf), cf.slice(0, 300));
    // another PC gives WO-960 a live row meanwhile (stale screen), then the PM taps Put back
    X.seqRow(S4, 'G2', 'P1', { wo: 'WO-960', floor: 'T12', unit: '60', descr: 'HOUSE TYPE A', kind: 'kitchen', src: 'manual', is_new: true });
    const pbSel = await q.evaluate(() => { const b = [...document.querySelectorAll('#seq-cf button')].find(x => /Put back/.test(x.textContent)); if (!b) return null; b.setAttribute('data-t12b', '1'); return '[data-t12b]'; });
    if (pbSel) await tap(q, pbSel, 1200);
    const t4 = await toastTxt(q);
    rec('F18 Put back when WO-960 has another live row: refused / told, still ONE live row for WO-960, G1 stays removed', !!pbSel && woRows(S4, 'WO-960').length === 1 && rowOf(S4, 'G1').state === 'removed' && /already|another screen|look again|Not/i.test(t4), JSON.stringify({ t4, rows: woRows(S4, 'WO-960').map(r => r.id) }));
    await q.evaluate(() => render()); await sleep(400);
    rec('F19 after that the "taken out … Put back" line for WO-960 is gone (it has a live row)', await q.evaluate(() => !/WO-960[^]*Put back/.test(((document.getElementById('seq-cf') || {}).innerText || ''))));
    rec('F20 PM: no page errors', !(S4.errors || []).length, JSON.stringify(S4.errors));
    await pm4.close();

    // ===== 5: Use <date> on Sat 26 Dec (bank holiday), Sun 27 Dec 2026, Wed 17 Mar 2027
    const S5 = srv([J('WO-971', 'T09', '71', 'HOUSE TYPE A', { dueDate: '2026-12-15', origDueDate: '2026-12-15', delivDate: '2026-12-18' }), J('WO-972', 'T09', '72', 'HOUSE TYPE A', { dueDate: '2026-12-15', origDueDate: '2026-12-15', delivDate: '2026-12-18' }),
      J('WO-973', 'T09', '73', 'HOUSE TYPE A', { dueDate: '2027-03-01', origDueDate: '2027-03-01', delivDate: '2027-03-04' })], []);
    X.seqRow(S5, 'S26', 'P1', { wo: 'WO-971', floor: 'T09', unit: '71', req_date: '2026-12-26', src: 'upload' });
    X.seqRow(S5, 'S27', 'P1', { wo: 'WO-972', floor: 'T09', unit: '72', req_date: '2026-12-27', src: 'upload' });
    X.seqRow(S5, 'P17', 'P1', { wo: 'WO-973', floor: 'T09', unit: '73', req_date: '2027-03-17', src: 'upload' });
    const pm5 = await X.dev(browser, S5, 'pm', { me: { pm: 'John Burke' } }), r = pm5.page;
    await r.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const ag = await r.evaluate(() => ((document.getElementById('seq-agree') || {}).innerText || '').replace(/\s+/g, ' '));
    const toasts = [];
    for (const id of ['S26', 'S27', 'P17']) { await tap(r, '[data-sequse="' + id + '"]', 1400); toasts.push(await toastTxt(r)); await r.evaluate(() => { document.querySelectorAll('.seq-res,.pod-ovl').forEach(x => x.remove()); render(); }); await sleep(300); }
    const dd = await r.evaluate(() => ['WO-971', 'WO-972', 'WO-973'].map(w => { const o = DB.orders.find(x => x.wo === w); return { w, d: o.delivDate, due: o.dueDate, dv: isDelivDay(o.delivDate), uw: isWorkDay(o.dueDate) }; }));
    rec('F21 Sat 26 Dec 2026 (St Stephen\'s Day) → next delivery day Tue 29 Dec (27 Sun, 28 bank holiday), said so', dd[0].d === '2026-12-29' && dd[0].uw && /26 Dec/.test(toasts[0]), JSON.stringify([dd[0], toasts[0]]));
    rec('F22 Sun 27 Dec 2026 → Tue 29 Dec, said so', dd[1].d === '2026-12-29' && dd[1].uw && /27 Dec/.test(toasts[1]), JSON.stringify([dd[1], toasts[1]]));
    rec('F23 Wed 17 Mar 2027 → Thu 18 Mar, build date a working day', dd[2].d === '2027-03-18' && dd[2].uw, JSON.stringify([dd[2], toasts[2]]));
    rec('F24 [Low] the Dates to agree BUTTON already says the day it will really use (not "Use 26 Dec" for a 29 Dec move)', !/Use 26 Dec/.test(ag) || /29 Dec/.test(ag), ag.slice(0, 300));
    rec('F25 the rows\' own dates cleared after Use', ['S26', 'S27', 'P17'].every(id => rowOf(S5, id).req_date === null));
    rec('F26 PM: no page errors', !(S5.errors || []).length, JSON.stringify(S5.errors));
    await pm5.close();

    // ===== 6: ⏳ across the 25 Oct 2026 clock change (today Sun 15 Nov 2026; 3 weeks back = 25 Oct)
    const S6 = srv([], []);
    const at = (id, iso) => { const w = U(S6, id, 'T09', id.slice(1), 'K8', 'HOUSE TYPE B', 'kitchen'); w.created_at = iso; };
    at('A1', '2026-10-24T23:30:00.000Z'); // 00:30 Sun 25 Oct (IST) → exactly 21 days: no ⏳
    at('B2', '2026-10-24T22:30:00.000Z'); // 23:30 Sat 24 Oct (IST) → 22 days: ⏳
    at('C3', '2026-10-25T00:30:00.000Z'); // 01:30 IST — the hour before the clocks go back → 25 Oct: no ⏳
    at('D4', '2026-10-25T01:30:00.000Z'); // 01:30 GMT after the change → 25 Oct: no ⏳
    at('E5', '2026-10-25T23:30:00.000Z'); // 23:30 GMT 25 Oct → no ⏳
    const pm6 = await X.dev(browser, S6, 'pm', { now: '2026-11-15T10:00:00Z', me: { pm: 'John Burke' } }), s = pm6.page;
    await s.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1200);
    const fl = await s.evaluate(() => [...document.querySelectorAll('[data-seqold]')].map(b => b.dataset.seqold).sort().join());
    rec('F27 ⏳ across the clock change: only B2 (24 Oct local) flagged; 25 Oct rows (IST and GMT sides) not', fl === 'B2', fl);
    const nud = await s.evaluate(() => { pmTab = ''; render(); return seqNudges().waitOld; });
    rec('F28 the PM nudge counts the same (1 waiting longer than 3 weeks)', nud === 1, nud);
    await pm6.close();

    // ===== 7: cutting-list Find-the-WO: LGF vs level 0 vs T12 — must ask, never pick
    const S7 = srv([J('WO-981', 'LGF', '5', 'HOUSE TYPE A'), J('WO-982', '0', '6', 'HOUSE TYPE A'), J('WO-983', 'T12', '7', 'HOUSE TYPE A'), J('WO-984', 'LGF', '8', 'HOUSE TYPE A')], []);
    const a7 = await X.dev(browser, S7, 'office');
    const kf = await a7.page.evaluate(() => { const f = (fl, u) => { const r = keyFind('P1', fl, u); return r.st + ':' + r.same.map(x => x.o.wo).join('/') + ':' + r.unsure.map(x => x.o.wo).join('/'); };
      return { t12_5: f('T12', '5'), zero_5: f('0', '5'), gf_8: f('GF', '8'), lgf_6: f('LGF', '6'), lgf_7: f('LGF', '7'), lgf_5: f('LGF', '5'), t12_7: f('T12', '7') }; });
    rec('F29 boxes T12 / 5 vs a WO at LGF / 5: asked ("pick"), never filled on its own', /^pick:/.test(kf.t12_5) && /WO-981/.test(kf.t12_5), JSON.stringify(kf));
    rec('F30 boxes 0 / 5 and GF / 8 vs LGF WOs: asked, never filled', /^pick:/.test(kf.zero_5) && /^pick:/.test(kf.gf_8), JSON.stringify(kf));
    rec('F31 boxes LGF / 6 vs level 0 / 6 and LGF / 7 vs T12 / 7: asked', /^pick:/.test(kf.lgf_6) && /^pick:/.test(kf.lgf_7), JSON.stringify(kf));
    rec('F32 LGF / 5 vs LGF / 5: one, filled; T12 / 7 vs T12 / 7: one', /^one:WO-981:$/.test(kf.lgf_5) && /^one:WO-983:$/.test(kf.t12_7), JSON.stringify(kf));
    await a7.close();

    // ===== 8: 360 px with every panel open: preview (Not read + revised ❓ + Qty warning) over a page with confirm / taken-out / dates / ⏳
    const row8 = X.v2Row(); row8.orders.push(J('WO-990', '', '', 'HOUSE TYPE A VERY LONG NAME FOR A PHONE SCREEN WITH NO SPACES_AT_ALL_XXXXXXXXXXXXXXXX', { ref: '2796-15-2-APT 51' }), J('WO-991', 'T12', '91', 'HOUSE TYPE A'), J('WO-992', 'T12', '92', 'HOUSE TYPE A', { delivDate: '2026-12-18' }));
    const S8 = srv([], [['R51', '2', 'Apt 51', 'K8', 'HOUSE TYPE A', 'kitchen'], ['OLD', 'T09', '12', 'K8', 'HOUSE TYPE B LH', 'kitchen']], row8);
    D.find(S8.db, 'project_seq', 'OLD').created_at = '2026-09-01T09:00:00.000Z';
    X.seqRow(S8, 'G9', 'P1', { wo: 'WO-991', floor: 'T12', unit: '91', kind: 'kitchen', src: 'import' }); X.DS.RPC.seq_remove(S8.db, { p_id: 'G9', p_by: 'John Burke', p_why: 'Wrong project' });
    X.seqRow(S8, 'DA', 'P1', { wo: 'WO-992', floor: 'T12', unit: '92', kind: 'kitchen', req_date: '2026-12-11', src: 'upload' });
    const ph = await X.dev(browser, S8, 'pm', { viewport: { width: 360, height: 740 }, me: { pm: 'John Burke' } }), f = ph.page;
    await f.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(1500);
    const pan = await f.evaluate(() => ({ cf: !!document.getElementById('seq-cf'), ag: !!document.getElementById('seq-agree'), old: !!document.querySelector('[data-seqold]'), pb: /Put back/.test((document.getElementById('seq-cf') || {}).innerText || '') }));
    let sc = await X.noScroll(f);
    const small = await f.evaluate(() => [...document.querySelectorAll('#seq-pg button, #seq-cf button, #seq-agree button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 36).map(b => b.textContent.trim().slice(0, 30) + ' ' + Math.round(b.getBoundingClientRect().height)));
    rec('F33 360 px page with To place / confirm (long name, suggestion, Put back), Dates to agree, ⏳: all shown, no sideways scroll', pan.cf && pan.ag && pan.old && pan.pb && sc.sw <= sc.cw + 1, JSON.stringify([pan, sc]));
    rec('F34 360 px: no visible button under 36 px on those panels', !small.length, JSON.stringify(small));
    const BIG = [B.HDR, B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B RH', 'KITCHEN TYPE 1 RH', 3950]), B.pad([3, 'T09', '13', 'K8', 'HOUSE_TYPE_B_WITH_A_VERY_LONG_UNBROKEN_NAME_XXXXXXXXXXXXXXXXXXXX', '', 1]), B.pad([5, '', '', '', 'GRAND TOTAL', '', 9999])];
    await B.upload(f, BIG, 'a-very-long-file-name-for-a-phone-screen-with-no-spaces_XXXXXXXXXXXXXXXX.xlsx');
    v = await B.preview(f);
    sc = await X.noScroll(f);
    const pb = await f.evaluate(() => { const o = document.querySelector('.squ-dlg .pod-in').getBoundingClientRect(); return { r: Math.round(o.right), w: Math.round(o.width), sw: document.querySelector('.squ-dlg .pod-in').scrollWidth, cw: document.querySelector('.squ-dlg .pod-in').clientWidth, btn: [...document.querySelectorAll('.squ-dlg button')].map(b => Math.round(b.getBoundingClientRect().height)) }; });
    rec('F35 360 px preview with Not read + ❓ revised + Qty warning + long names: no sideways scroll (page or window), buttons ≥ 36 px', v && /Not read/.test(v.t) && /revised line/.test(v.t) && sc.sw <= sc.cw + 1 && pb.r <= 361 && pb.sw <= pb.cw + 1 && Math.min(...pb.btn) >= 36, JSON.stringify([sc, pb, v && [v.add, v.uns]]));
    rec('no page errors (all)', ![S1, S2, S3, S4, S5, S6, S7, S8].some(x => (x.errors || []).length), JSON.stringify([S1, S2, S3, S4, S5, S6, S7, S8].map(x => x.errors || [])));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
