// MERGE SEAM 1 (Tester, 25 Nov 2026) — Garry: "make sure that all due dates on the PM table follow to the WOs and delivery page
// on all the other pages in the planner". A Required date changed in a project's SEQUENCE table (PM, reason asked) must show on
// the Capacity Board, Deliveries (tags + week tab), the PM page, the cutting list window, lists-needed rows, the Pre-production
// pool, the Production Manager's Today screen and the date history — and the other way round (board / Deliveries → sequence).
// Today = Wed 21 Oct 2026; fixed window to Wed 4 Nov. Fake Supabase only. Run: node tests/merge25/m1-due-follow.test.js
const M = require('./m25lib.js');
const { X, H, sleep, rec } = M;
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = async p => { await p.evaluate(async () => { await loadDB(); if (typeof seqFresh === 'function') { try { await seqFresh('P1'); } catch (e) {} } render(); }); await sleep(300); };
const seqCell = (p, id, root) => p.evaluate(({ id, root }) => { const tr = document.querySelector((root || '') + ' tr[data-seqr="' + id + '"]'); if (!tr) return null; const c = l => { const td = tr.querySelector('td[data-l="' + l + '"]'); return td ? td.innerText.replace(/\s+/g, ' ').replace('📅', '').trim() : null; }; return { req: c('Required'), build: c('Build'), moved: c('Moved'), fixed: /seq-fixed/.test(tr.className) }; }, { id, root });
(async () => {
  const browser = await H.chromium.launch(); const bag = [];
  try {
    const row = X.v2Row();
    Object.assign(row.orders.find(o => o.wo === 'WO-3'), { delv: true });
    Object.assign(row.orders.find(o => o.wo === 'WO-4'), { delv: true, delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-23' });
    row.orders.push(H.order({ wo: 'WO-7', customer: 'Aderrig Homes', floor: 'T09', unit: '16', title: 'HOUSE TYPE F', dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', delv: true }),
      H.order({ wo: 'WO-8', customer: 'Aderrig Homes', floor: 'T09', unit: '17', title: 'HOUSE TYPE G', dueDate: '2026-11-19', origDueDate: '2026-11-19', delivDate: '2026-11-24', plannedWeek: '2026-11-16', delv: true }),
      H.order({ wo: 'WO-9', customer: 'Aderrig Homes', floor: 'T09', unit: '18', title: 'HOUSE TYPE H', dueDate: '2026-11-26', origDueDate: '2026-11-26', plannedWeek: '2026-11-23', delv: true }));
    const S = X.makeServer(row);
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.F3.seedList(S, 'L3', { wos: ['WO-3'], name: 'House 13' });
    const ids = { 'WO-3': 'Q3', 'WO-4': 'Q4', 'WO-1': 'Q1', 'WO-2': 'Q2', 'WO-7': 'Q7', 'WO-8': 'Q8', 'WO-9': 'Q9' };
    Object.entries(ids).forEach(([w, id]) => X.seqRow(S, id, 'P1', { wo: w }));
    const pmT = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), pm = pmT.page; M.watch(pm, bag, 'PM');
    const ofT = await X.dev(browser, S, 'office'), of = ofT.page; M.watch(of, bag, 'OFFICE'); await M.asks(of);
    await of.evaluate(() => { sessionStorage.setItem('wpfWho', 'Ann Office'); localStorage.setItem('wpfMe_pm', 'John Burke'); });

    // ================= A. PM changes the Required date of WO-3 in the sequence table (3 Dec → Thu 10 Dec) =================
    await pm.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    await X.dtOpen(pm, '[data-seqdate="Q3"]'); await sleep(200);
    await X.dtFill(pm, { 'sd-date': '2026-12-10' }); const pv = await X.dtWhy(pm, 'Site not ready'); await X.dtSave(pm);
    rec('A0 PM: the sequence date tool asked for a reason and saved', pv.ok && /10 Dec/.test(pv.prev), pv.prev);
    let c = await seqCell(pm, 'Q3');
    rec('A1 sequence table: Required 10 Dec, Build 7 Dec', c && /^10 Dec/.test(c.req) && /^7 Dec/.test(c.build), JSON.stringify(c));
    await pm.evaluate(() => { pmTab = ''; render(); }); await sleep(300);
    let t = (await M.rowTxt(pm, 'WO-3')).join(' | ');
    rec('A2 PM page (coming up row): shows the Required date the PM just set (10 Dec)', /10 Dec/.test(t), t);
    rec('A2b PM page: the build date shown is the new one (7 Dec), not the old 3 Dec', /7 Dec/.test(t) && !/3 Dec/.test(t), t);
    await save(pm); await sleep(300);
    const sj = M.srvJob(S, 'WO-3');
    rec('A3 saved: WO-3 delivery 10 Dec, build 7 Dec, build week 7 Dec', sj.delivDate === '2026-12-10' && sj.dueDate === '2026-12-07' && sj.plannedWeek === '2026-12-07', JSON.stringify([sj.delivDate, sj.dueDate, sj.plannedWeek]));
    const h = (sj.dueHist || []).slice(-2);
    rec('A4 date history: who (John Burke), why (Site not ready), from the PM sequence', h.length === 2 && h.every(x => x.by === 'John Burke' && x.why === 'Site not ready' && x.src === 'pmseq'), JSON.stringify(h));
    // --- the office PC picks it up
    await reload(of);
    await M.go(of, 'office', "tab='b'");
    let d = await M.dq(of, 'WO-3');
    rec('A5 Capacity Board row: due box holds 7 Dec (Wk 50)', d.some(x => x.f === 'due' && x.v === '2026-12-07' && /Wk 50/.test(x.txt)), JSON.stringify(d));
    t = (await M.rowTxt(of, 'WO-3')).join(' | ');
    const bt = await of.evaluate(() => { const i = [...document.querySelectorAll('#app [data-dq]')].find(x => x.dataset.dq === 'WO-3'); const tr = i && i.closest('tr'); return tr ? tr.innerHTML : ''; });
    rec('A5b Capacity Board row: the delivery (Required) date 10 Dec can be seen on the row (text or tooltip)', /10 Dec/.test(bt), 'row text: ' + t.slice(0, 120));
    await M.go(of, 'office', "tab='d';delTab='later'");
    d = await M.dq(of, 'WO-3');
    rec('A6 Deliveries card (Later tab): due tag 7 Dec + delivery tag 10 Dec', d.some(x => x.f === 'due' && x.v === '2026-12-07') && d.some(x => x.f === 'deliv' && x.v === '2026-12-10' && /10 Dec/.test(x.txt)), JSON.stringify(d));
    const tabs = await of.evaluate(() => ({ wk: delPoolWk(DB.orders.find(o => o.wo === 'WO-3')), far: [...document.querySelectorAll('[data-deltab]')].map(b => b.innerText.replace(/\s+/g, ' ')).join(' | ') }));
    rec('A6b Deliveries: the card sits in the week of the delivery date (Wk 50)', tabs.wk === '2026-12-07', JSON.stringify(tabs));
    await of.evaluate(() => dlOpen('WO-3')); await sleep(1300);
    let j = await M.job(of, 'WO-3'); const hd = await of.evaluate(() => ({ due: (document.getElementById('me-due') || {}).textContent || '', wo: (document.getElementById('me-hwo') || {}).textContent || '' }));
    rec('A7 cutting list window header: due badge "Due Mon 7 Dec · Wk 50"', /WO-3/.test(hd.wo) && /Mon 7 Dec/.test(hd.due) && /Wk 50/.test(hd.due), JSON.stringify(hd));
    await M.closeAll(of);
    await M.go(of, 'office', "tab='b'");
    await of.evaluate(() => { const b = [...document.querySelectorAll('[data-duehist]')].find(x => x.dataset.duehist === 'WO-3'); if (b) b.click(); }); await sleep(300);
    const ht = await of.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText.replace(/\s+/g, ' ') : ''; });
    rec('A8 "🔁 moved" chip on the board → history window names John Burke and "Site not ready"', /John Burke/.test(ht) && /Site not ready/.test(ht) && /10 Dec/.test(ht), ht.slice(0, 260));
    await M.closeAll(of);

    // ================= B. office (in the sequence window) pulls WO-7 INSIDE the fixed window: required Fri 30 Oct =================
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    await X.dtOpen(of, '.seq-ovl [data-seqdate="Q7"]'); await sleep(200);
    await X.dtFill(of, { 'sd-date': '2026-10-30' }); const pvB = await X.dtWhy(of, 'Customer delay'); await X.dtSave(of);
    j = await M.job(of, 'WO-7');
    rec('B1 office, sequence window: WO-7 required 30 Oct → build Tue 27 Oct, logged as a fixed-window change', j.delivDate === '2026-10-30' && j.dueDate === '2026-10-27' && (j.dueHist || []).slice(-1)[0].fx === 1 && (j.dueHist || []).slice(-1)[0].by === 'Ann Office', JSON.stringify([j.delivDate, j.dueDate, (j.dueHist || []).slice(-1)[0], pvB.prev.slice(0, 100)]));
    c = await seqCell(of, 'Q7', '.seq-ovl');
    rec('B2 sequence window redrawn: Required 30 Oct 🔒, Build 27 Oct', c && /^30 Oct/.test(c.req) && /^27 Oct/.test(c.build) && c.fixed, JSON.stringify(c));
    await M.closeAll(of);
    await M.go(of, 'office', "tab='d';delTab='1'");
    d = await M.dq(of, 'WO-7');
    rec('B3 Deliveries: WO-7 now under "Next week · Wk 44" with due 27 Oct + delivery 30 Oct', d.some(x => x.f === 'due' && x.v === '2026-10-27') && d.some(x => x.f === 'deliv' && x.v === '2026-10-30'), JSON.stringify(d));
    await M.go(of, 'office', "tab='d';delTab='3'");
    rec('B3b …and no longer under its old week (Wk 46)', (await M.dq(of, 'WO-7')).length === 0);
    await M.go(of, 'office', "tab='l'");
    t = (await M.rowTxt(of, 'WO-7')).join(' | ');
    const need = await of.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-7'); const i = lsNeedInfo(o); return { inList: listsNeeded().includes(o), due: i.due, cut: i.cut || i.cutBy || '', by: i.by || i.dueBy || '', keys: Object.keys(i).join() }; });
    rec('B4 Cutting Lists page: WO-7 is now in "Cutting lists to issue" (due inside the lead time)', need.inList && /WO-7/.test(await of.evaluate(() => document.getElementById('app').innerText)), JSON.stringify(need) + ' ' + t.slice(0, 200));
    await M.go(of, 'prod', "prodTab='today'", 600);
    t = (await M.rowTxt(of, 'WO-7')).join(' | ');
    rec('B5 Production Manager Today: WO-7 listed with the new build date 27 Oct (not 12 Nov)', /27 Oct/.test(t) && !/12 Nov/.test(t), t.slice(0, 300));
    await M.go(of, 'pre', '', 600);
    t = (await M.rowTxt(of, 'WO-7')).join(' | ');
    rec('B6 Pre-production pool: WO-7 has come into the pool, "Due Tue 27 Oct · Wk 44", 🔁 moved shown', /Tue 27 Oct/.test(t) && /Wk 44/.test(t) && /🔁/.test(t), t.slice(0, 260));
    await M.go(of, 'saw', '', 600);
    t = await of.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
    rec('B7 Saw screen: no trace of the old date for WO-7 (12 Nov) ', !/WO-7[^🚚]{0,160}12 Nov/.test(t), (t.match(/WO-7.{0,160}/) || ['(WO-7 not on the saw screen)'])[0]);
    await M.go(of, 'dash', '', 600);
    t = (await M.rowTxt(of, 'WO-7')).join(' | ');
    rec('B8 Management screen: WO-7 with 27 Oct (if listed)', !t || /27 Oct/.test(t), t.slice(0, 200) || '(not listed)');
    await M.go(of, 'office', "tab='b'"); await save(of); await sleep(200);
    // PM PC follows
    await reload(pm); await pm.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    c = await seqCell(pm, 'Q7');
    rec('B9 PM PC after its next load: sequence shows Required 30 Oct 🔒, Build 27 Oct, moved 1×', c && /^30 Oct/.test(c.req) && /^27 Oct/.test(c.build) && c.fixed && /🔁/.test(c.moved || ''), JSON.stringify(c));

    // ================= C. the other way: Capacity Board date dialog moves WO-3's delivery → Thu 17 Dec =================
    await M.go(of, 'office', "tab='b'");
    await of.evaluate(() => { const b = [...document.querySelectorAll('#app [data-duedlg]')].find(x => x.dataset.duedlg === 'WO-3'); if (b) b.click(); else dateDlg(['WO-3']); }); await sleep(300);
    const dd = await of.evaluate(() => { const o = document.getElementById('date-dlg'); if (!o) return 'no dialog'; const s = (id, v) => { const e = o.querySelector(id); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); };
      s('#dm-deliv', '2026-12-17'); const sug = o.querySelector('#dm-date').value; o.querySelector('[data-dmwhy="Customer delay"]').click(); const ok = !o.querySelector('#dm-ok').disabled; o.querySelector('#dm-ok').click(); return { sug, ok }; }); await sleep(500);
    j = await M.job(of, 'WO-3');
    rec('C1 board date dialog: delivery 17 Dec, build suggested and saved 14 Dec', dd.ok && dd.sug === '2026-12-14' && j.delivDate === '2026-12-17' && j.dueDate === '2026-12-14', JSON.stringify([dd, j.delivDate, j.dueDate]));
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    c = await seqCell(of, 'Q3', '.seq-ovl');
    rec('C2 sequence window (office): Required follows → 17 Dec, Build 14 Dec', c && /^17 Dec/.test(c.req) && /^14 Dec/.test(c.build), JSON.stringify(c));
    await M.closeAll(of); await save(of); await reload(pm); await pm.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    c = await seqCell(pm, 'Q3');
    rec('C3 PM PC: sequence Required follows the board → 17 Dec, Build 14 Dec', c && /^17 Dec/.test(c.req) && /^14 Dec/.test(c.build), JSON.stringify(c));
    // board: build date ONLY on a job with no delivery date (WO-9: 26 Nov → 3 Dec)
    await of.evaluate(() => dateDlg(['WO-9'])); await sleep(300);
    await of.evaluate(() => { const o = document.getElementById('date-dlg'); const e = o.querySelector('#dm-date'); e.value = '2026-12-03'; e.dispatchEvent(new Event('input')); o.querySelector('[data-dmwhy="Production"]').click(); o.querySelector('#dm-ok').click(); }); await sleep(400);
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    c = await seqCell(of, 'Q9', '.seq-ovl');
    rec('C4 board moves a build date (no delivery date): sequence Required and Build both show 3 Dec', c && /^3 Dec/.test(c.req) && /^3 Dec/.test(c.build), JSON.stringify(c));
    await M.closeAll(of);

    // ================= D. Deliveries "→ Wk" and "Move to week…" → the sequence follows =================
    await M.go(of, 'office', "tab='d';delTab='5'"); // WO-8: build 19 Nov, delivery Tue 24 Nov (Wk 48)
    const nb = await of.evaluate(() => { const b = [...document.querySelectorAll('[data-wknext]')].find(x => x.dataset.wknext === 'WO-8'); if (!b) return 'no → Wk button: ' + [...document.querySelectorAll('.dchip')].map(x => x.dataset.dw).join(); const t = b.textContent; b.click(); return t; }); await sleep(300);
    let w = await M.why(of, 'Site not ready');
    j = await M.job(of, 'WO-8');
    rec('D1 Deliveries "→ Wk 49" on WO-8: delivery Tue 1 Dec, build Thu 26 Nov (gap kept), reason asked', /Wk 49/.test(nb) && w === 'ok' && j.delivDate === '2026-12-01' && j.dueDate === '2026-11-26', JSON.stringify([nb, w, j.delivDate, j.dueDate]));
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    c = await seqCell(of, 'Q8', '.seq-ovl');
    rec('D2 sequence: WO-8 Required 1 Dec, Build 26 Nov', c && /^1 Dec/.test(c.req) && /^26 Nov/.test(c.build), JSON.stringify(c));
    await M.closeAll(of);
    await M.go(of, 'office', "tab='d';delTab='later'");
    const pk = await of.evaluate(() => { const b = [...document.querySelectorAll('[data-wkpick]')].find(x => x.dataset.wkpick === 'WO-9'); if (!b) return 'no Move to week… on WO-9'; b.click(); const o = document.getElementById('wkpick-dlg'); const k = o && o.querySelector('[data-wkp="2026-12-14"]'); if (!k) return 'no Wk 51 in the picker'; k.click(); return 'ok'; }); await sleep(300);
    const chk = await of.evaluate(() => { const g = document.querySelector('#wkprev-dlg #wkp-go'); if (!g) return ''; const t2 = document.getElementById('wkprev-dlg').innerText.replace(/\s+/g, ' '); g.click(); return t2; }); await sleep(300); // "check first" comes up when something needs a look
    w = await M.why(of, 'Customer delay');
    j = await M.job(of, 'WO-9');
    rec('D3 Deliveries "Move to week…" Wk 51 on WO-9: build Thu 17 Dec', pk === 'ok' && w === 'ok' && j.dueDate === '2026-12-17' && !j.delivDate, JSON.stringify([pk, chk.slice(0, 200), w, j.dueDate, j.delivDate]));
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    c = await seqCell(of, 'Q9', '.seq-ovl');
    rec('D4 sequence: WO-9 Required 17 Dec, moved 2×', c && /^17 Dec/.test(c.req) && /2×/.test(c.moved || ''), JSON.stringify(c));
    await M.closeAll(of);

    // ================= E. a BOOKED delivery: same result whichever screen moves the date =================
    // E1 from the sequence (office): WO-4 on Volvo Wed 25 Nov, required 25 Nov → Wed 2 Dec
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    await X.dtOpen(of, '.seq-ovl [data-seqdate="Q4"]'); await sleep(200);
    await X.dtFill(of, { 'sd-date': '2026-12-02' }); const pvE = await X.dtWhy(of, 'Site not ready'); await X.dtSave(of);
    j = await M.job(of, 'WO-4');
    rec('E1 sequence move of a booked job: preview says it comes off the van; job off the van, flagged rebook', /off .*rebook/i.test(pvE.prev) && !j.delDay && !j.delVeh && !!j.delRebook && /VOLVO\|Wed/.test(j.delRebook.was || ''), JSON.stringify([pvE.prev.slice(0, 140), j.delDay, j.delRebook]));
    await M.closeAll(of); await M.go(of, 'office', "tab='d';delTab='later'");
    let card = await of.evaluate(() => { const c2 = [...document.querySelectorAll('#dpool .dchip')].find(x => x.dataset.dw === 'WO-4'); return c2 ? c2.innerText.replace(/\s+/g, ' ') : ''; });
    rec('E2 Deliveries: WO-4 back in To plan (Later / Wk 49) with "date moved — rebook" and delivery 2 Dec', /date moved — rebook/.test(card) && /2 Dec/.test(card), card.slice(0, 220));
    // E3 the same job booked again, then moved from the BOARD dialog (delivery 2 Dec → 9 Dec)
    await of.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-4'); o.delVeh = 'VOLVO'; o.delDay = 'Wed'; o.delWk = '2026-11-30'; delete o.delRebook; render(); });
    await of.evaluate(() => dateDlg(['WO-4'])); await sleep(300);
    const prevE = await of.evaluate(() => { const o = document.getElementById('date-dlg'); const e = o.querySelector('#dm-deliv'); e.value = '2026-12-09'; e.dispatchEvent(new Event('input')); o.querySelector('[data-dmwhy="Site not ready"]').click(); const t2 = o.querySelector('#dm-prev').innerText; o.querySelector('#dm-ok').click(); return t2; }); await sleep(400);
    j = await M.job(of, 'WO-4');
    rec('E3 board move of the same booked job: also off the van + rebook (same rule both ways)', /rebook/i.test(prevE) && !j.delDay && !!j.delRebook && j.delivDate === '2026-12-09', JSON.stringify([prevE.slice(0, 160), j.delDay, !!j.delRebook, j.delivDate]));
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    c = await seqCell(of, 'Q4', '.seq-ovl');
    const prog = await of.evaluate(() => { const tr = document.querySelector('.seq-ovl tr[data-seqr="Q4"] td[data-l="Progress"]'); return tr ? tr.innerText.replace(/\s+/g, ' ') : ''; });
    rec('E4 sequence: WO-4 Required 9 Dec and "on a van" no longer ticked', c && /^9 Dec/.test(c.req) && !/on a van ✓/.test(prog), JSON.stringify([c, prog]));
    await M.closeAll(of); await save(of); await sleep(200);

    // ================= F. a PM inside the fixed window: a request, nothing moves anywhere until approved =================
    await reload(pm); await pm.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    await X.dtOpen(pm, '[data-seqdate="Q2"]'); await sleep(200); // WO-2 due tomorrow
    await X.dtFill(pm, { 'sd-date': '2026-11-12' }); const pvF = await X.dtWhy(pm, 'Customer delay'); await X.dtSave(pm); await sleep(600);
    j = await M.job(pm, 'WO-2'); const rq = S.db.t.seq_requests.filter(q => q.status === 'open');
    rec('F1 PM, job due tomorrow: sent as ONE request, WO-2 not changed', /ONE change request/.test(pvF.prev) && j.dueDate === '2026-10-22' && !j.delivDate && rq.length === 1, JSON.stringify([pvF.prev.slice(0, 120), j.dueDate, rq.length]));
    await reload(of); await M.go(of, 'prod', "prodTab='req'", 700); await M.asks(of);
    const cardF = await of.evaluate(() => { const b = document.querySelector('[data-srok]'); return b ? { t: (b.closest('[data-srcard]') || b.parentElement.parentElement).innerText.replace(/\s+/g, ' ').slice(0, 300), id: b.dataset.srok } : null; });
    rec('F2 Production Manager → ✋ Requests: the PM\'s request is there with WO-2, the date and the reason', !!cardF && /WO-2/.test(cardF.t) && /12 Nov/.test(cardF.t) && /Customer delay/.test(cardF.t), JSON.stringify(cardF));
    if (cardF) { await of.evaluate(id => document.querySelector('[data-srok="' + id + '"]').click(), cardF.id); await sleep(1800); }
    j = await M.job(of, 'WO-2');
    const hF = (j.dueHist || []).slice(-1)[0] || {};
    rec('F3 approved: WO-2 delivery 12 Nov, build 9 Nov; history has the request, PM\'s reason and fixed-window mark', j.delivDate === '2026-11-12' && j.dueDate === '2026-11-09' && hF.fx === 1 && !!hF.rq && /Customer delay/.test(hF.why || ''), JSON.stringify([j.delivDate, j.dueDate, hF, await M.toast(of)]));
    await M.go(of, 'prod', "prodTab='today'", 600);
    t = (await M.rowTxt(of, 'WO-2')).join(' | ');
    rec('F4 Today screen after the approval: WO-2 no longer shown as due 22 Oct', !/due 22 Oct/.test(t), t.slice(0, 260) || '(not listed)');
    await M.go(of, 'office', "tab='b'"); d = await M.dq(of, 'WO-2');
    rec('F5 Capacity Board: WO-2 due box 9 Nov (Wk 46)', d.some(x => x.f === 'due' && x.v === '2026-11-09' && /Wk 46/.test(x.txt)), JSON.stringify(d));
    await save(of); await sleep(200); await reload(pm); await pm.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    c = await seqCell(pm, 'Q2');
    rec('F6 PM PC: sequence Required 12 Nov, Build 9 Nov, the 🔒 gone', c && /^12 Nov/.test(c.req) && /^9 Nov/.test(c.build) && !c.fixed, JSON.stringify(c));

    // ================= H. the fixed window from the OTHER screens: is a direct change counted and marked the same way? =================
    const direct0 = S.db.t.seq_requests.filter(q => q.status === 'direct').length;
    rec('H0 the office\'s change inside the fixed window made in the SEQUENCE window (B1) was recorded as a "direct" late change', direct0 === 1, JSON.stringify(S.db.t.seq_requests.map(q => [q.status, q.kind, (q.wos || []).join()])));
    await M.go(of, 'office', "tab='b'"); await of.evaluate(() => dateDlg(['WO-1'])); await sleep(300); // WO-1: due tomorrow (22 Oct), in the same sequence
    await of.evaluate(() => { const o = document.getElementById('date-dlg'); const e = o.querySelector('#dm-date'); e.value = '2026-11-18'; e.dispatchEvent(new Event('input')); o.querySelector('[data-dmwhy="Customer delay"]').click(); window.__prevH = o.querySelector('#dm-prev').innerText; o.querySelector('#dm-ok').click(); }); await sleep(900);
    j = await M.job(of, 'WO-1'); const hH = (j.dueHist || []).slice(-1)[0] || {};
    rec('H1 same kind of change from the Capacity Board (WO-1, due tomorrow → 18 Nov): the date moves', j.dueDate === '2026-11-18', JSON.stringify([j.dueDate, hH]));
    rec('H2 …and the history marks it as a fixed-window change, as the sequence window does (fx)', hH.fx === 1, JSON.stringify(hH));
    rec('H3 …and it is counted in the scorecard\'s "Late changes" as a direct change (2 now)', S.db.t.seq_requests.filter(q => q.status === 'direct').length === direct0 + 1, String(S.db.t.seq_requests.filter(q => q.status === 'direct').length) + ' direct · preview said: ' + String(await of.evaluate(() => window.__prevH)).replace(/\s+/g, ' ').slice(0, 160));
    await save(of); await sleep(200);

    // ================= G. two PCs: PM moves WO-1… no — WO-9 in the sequence (office window), the other on the board, both save =================
    const o2T = await X.dev(browser, S, 'office', { now: new Date(+new Date(X.NOW) + 180000).toISOString() }), o2 = o2T.page; M.watch(o2, bag, 'OFFICE2');
    await o2.evaluate(() => sessionStorage.setItem('wpfWho', 'Bob Board'));
    await reload(of); await M.go(of, 'office', "tab='b'");
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    await X.dtOpen(of, '.seq-ovl [data-seqdate="Q9"]'); await sleep(200);
    await X.dtFill(of, { 'sd-date': '2027-01-14' }); await X.dtWhy(of, 'Site not ready'); await X.dtSave(of); await M.closeAll(of);
    await o2.evaluate(() => dateDlg(['WO-9'])); await sleep(300);
    await o2.evaluate(() => { const o = document.getElementById('date-dlg'); const e = o.querySelector('#dm-date'); e.value = '2026-12-22'; e.dispatchEvent(new Event('input')); o.querySelector('[data-dmwhy="Production"]').click(); o.querySelector('#dm-ok').click(); }); await sleep(400);
    await save(o2); await sleep(60); await save(of); await reload(of); await reload(o2); // the OLDER (sequence) move saves last
    const ja = await M.job(of, 'WO-9'), jb = await M.job(o2, 'WO-9'), js = M.srvJob(S, 'WO-9');
    const dueWk22 = await o2.evaluate(() => dueWeekFor('2026-12-22'));
    const unit = x => [x.dueDate, x.delivDate || '', x.plannedWeek || ''].join('/');
    rec('G1 two PCs (sequence vs board, same job): both screens and the database end on the SAME dates', unit(ja) === unit(jb) && unit(ja) === unit(js), JSON.stringify([unit(ja), unit(jb), unit(js)]));
    rec('G2 …the newer build-date move (Bob, on the board: 22 Dec) wins with ITS build week; the delivery date Bob never touched stays as the sequence set it (14 Jan)', js.dueDate === '2026-12-22' && js.delivDate === '2027-01-14' && (js.plannedWeek || '') === (dueWk22 || ''), JSON.stringify([js.dueDate, js.delivDate, js.plannedWeek, (js.dueHist || []).map(x => x.by + ':' + x.f + ':' + x.to)]));
    rec('G3 …both moves are in the history', (js.dueHist || []).some(x => x.by === 'Ann Office' && x.to === '2027-01-14') && (js.dueHist || []).some(x => x.by === 'Bob Board' && x.to === '2026-12-22'), JSON.stringify((js.dueHist || []).map(x => x.by + ':' + x.f + ':' + x.to)));
    await of.evaluate(() => seqOpen('P1')); await sleep(500);
    c = await seqCell(of, 'Q9', '.seq-ovl');
    const want = await of.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-9'); return dShort(o.delivDate || o.dueDate); });
    rec('G4 sequence window after the sync shows the date the job really has', c && c.req.indexOf(want) === 0, JSON.stringify([c, want]));
    await M.closeAll(of);
    rec('no JavaScript errors on any of the three screens', !bag.length && !(S.errors || []).length, JSON.stringify(bag.concat(S.errors || [])).slice(0, 600));
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  finally { await browser.close(); }
  M.finish();
})();
