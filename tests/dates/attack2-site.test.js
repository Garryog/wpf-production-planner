// Tester attack 2 — A10 "site ready" + multi-PC + phones + escaping.
// Within siteDays (5) working days: day 5 / day 6, over Christmas (clock Mon 21 Dec 2026: Wed 30 Dec = 5, Thu 31 Dec = 6).
// Confirm, then move the booking → "confirm again". "Site ready for all" for one customer (PM view). Roles: saw / stores /
// driver / floor cannot confirm. Two PCs: confirm vs move booking, both confirm. Three PCs: driver loads, office moves
// the delivery date, another PC re-books — loaded is never pulled, both date moves kept. 360 px: delivery row in the
// dialog, site / hold chips on cards. Escaping in delivery notes, site confirmer names, customer names (Dates list).
// Stubbed Supabase only.  Run: node tests/dates/attack2-site.test.js
const { H, makeServer, open, recorder, save, reload, w } = require('./attack1-lib');
const { rec, done } = recorder('attack2-site');
const NOW = '2026-11-10T10:00:00Z';
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-13', origDueDate: '2026-11-13', plannedWeek: '2026-11-09', step: '8. PALLETED', delv: true, customer: 'GLEN', title: 'House ' + wo }, x));
  const B = (d, wk = '2026-11-16', v = 'VOLVO') => ({ delVeh: v, delDay: d, delWk: wk });

  // ---- edges + confirm/move + confirm-all + roles (Tue 10 Nov) ----
  {
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      O('S-5', B('Tue')), O('S-6', B('Wed')), O('S-TODAY', B('Tue', '2026-11-09')), O('S-SAT', B('Sat', '2026-11-09')),
      O('S-FAR', B('Fri', '2026-11-30')), O('S-DONE', { ...B('Mon', '2026-11-09'), delDelivAt: '2026-11-09T12:00:00Z', delDone: true }),
      O('S-OTHER', { ...B('Thu', '2026-11-09'), customer: 'CAIRN' }), O('S-POOL')] };
    const t = await H.open({ browser, now: NOW, row });
    const r = await t.page.evaluate(async () => {
      const g = w => DB.orders.find(o => o.wo === w), st = w => { const s = siteState(g(w)); return s ? s.k : 'none'; }, out = {};
      out.edge = { s5: st('S-5'), s6: st('S-6'), today: st('S-TODAY'), sat: st('S-SAT'), far: st('S-FAR'), done: st('S-DONE'), pool: st('S-POOL') };
      siteOkDo(['S-5']); await new Promise(r => setTimeout(r, 50)); out.ok5 = { st: st('S-5'), by: (g('S-5').siteOk || {}).by, for: (g('S-5').siteOk || {}).for, log: (g('S-5').log || []).slice(-1)[0] };
      // move the booking to another van, same day → still confirmed?; then another day → confirm again
      placeJobs([g('S-5')], 'IVECO', 'Tue', '2026-11-16'); await new Promise(r => setTimeout(r, 100)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      out.sameDay = st('S-5');
      placeJobs([g('S-5')], 'IVECO', 'Mon', '2026-11-16'); await new Promise(r => setTimeout(r, 100));
      const why = document.querySelector('.pod-ovl [data-why]'); if (why) why.click(); await new Promise(r => setTimeout(r, 100)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      out.moved = { st: st('S-5'), day: g('S-5').delDay };
      showTab('d'); await new Promise(r => setTimeout(r, 120)); document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 100));
      out.chip5 = (document.querySelector('[data-siteok="S-5"]') || {}).textContent || '';
      // roles
      out.roles = {};
      for (const role of ['saw', 'stores', 'driver', 'floor', 'pm', 'prod']) { ROLE = role; const before = JSON.stringify(g('S-6').siteOk || null); siteOkDo(['S-6']); await new Promise(r => setTimeout(r, 30)); out.roles[role] = JSON.stringify(g('S-6').siteOk || null) !== before; delete g('S-6').siteOk; }
      ROLE = 'office';
      // PM view "Site ready for all" for GLEN
      localStorage.setItem('wpfPin_pm', '9000'); ROLE = 'pm'; render(); await new Promise(r => setTimeout(r, 120));
      const b = document.querySelector('[data-sitecust="GLEN"]'); out.allBtn = b ? b.textContent : '';
      if (b) b.click(); await new Promise(r => setTimeout(r, 80));
      out.after = { s6: st('S-6'), far: st('S-FAR'), today: st('S-TODAY'), other: st('S-OTHER'), done: !!g('S-DONE').siteOk };
      ROLE = 'office'; render();
      return out;
    });
    rec('A10: day 5 (Tue 17 Nov) asks for site ready; day 6 (Wed 18 Nov) not yet', r.edge.s5 === 'need' && r.edge.s6 === 'none', JSON.stringify(r.edge));
    rec('A10: delivery today and this Saturday ask; far-off / delivered / pool do not', r.edge.today === 'need' && r.edge.sat === 'need' && r.edge.far === 'none' && r.edge.done === 'none' && r.edge.pool === 'none', JSON.stringify(r.edge));
    rec('A10: confirm logs who and for which date', r.ok5.st === 'ok' && r.ok5.by === 'Tester' && r.ok5.for === '2026-11-17' && /Site ready confirmed/.test(r.ok5.log.what), JSON.stringify(r.ok5));
    rec('A10: moved to another van the same day — still confirmed (same date)', r.sameDay === 'ok', r.sameDay);
    rec('A10: booking moved to another day → "confirm again" chip', r.moved.st === 'again' && r.moved.day === 'Mon' && /confirm again/.test(r.chip5), JSON.stringify(r.moved) + ' chip=' + r.chip5);
    rec('A10 roles: saw / stores / driver / floor cannot confirm; PM and Production Manager can', !r.roles.saw && !r.roles.stores && !r.roles.driver && !r.roles.floor && r.roles.pm && r.roles.prod, JSON.stringify(r.roles));
    rec('A10 "Site ready for all" (PM, GLEN): every booked unconfirmed GLEN delivery confirmed, not CAIRN, not delivered', /Site ready for all/.test(r.allBtn) && r.after.s6 === 'ok' && r.after.today === 'ok' && r.after.far === 'ok' && r.after.other !== 'ok' && !r.after.done, JSON.stringify(r) .slice(0, 400));
    rec('no page errors (site edges)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  // ---- over Christmas (Mon 21 Dec 2026) ----
  {
    const t = await H.open({ browser, now: '2026-12-21T10:00:00Z', row: { id: 'main', nid: 9, settings: {}, orders: [O('X-30', B('Wed', '2026-12-28')), O('X-31', B('Thu', '2026-12-28')), O('X-28', B('Mon', '2026-12-28'))] } });
    const r = await t.page.evaluate(() => ['X-30', 'X-31', 'X-28'].map(w => { const s = siteState(DB.orders.find(o => o.wo === w)); return w + ':' + (s ? s.k : 'none') + ':' + wdUntil(slotDate(DB.orders.find(o => o.wo === w))); }));
    rec('A10 over Christmas: Wed 30 Dec = 5 working days (asks), Thu 31 Dec = 6 (not yet)', /X-30:need:5/.test(r[0]) && /X-31:none:6/.test(r[1]), JSON.stringify(r));
    await t.close();
  }

  // ---- two PCs: confirm vs move booking; both confirm ----
  for (const order of ['confirm-first', 'move-first']) {
    const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('T-1', B('Tue')), O('T-2', B('Wed'))] });
    const A = await open(browser, S, { now: NOW }), Bp = await open(browser, S, { now: '2026-11-10T10:01:00Z' });
    const conf = () => A.page.evaluate(async () => { siteOkDo(['T-1', 'T-2']); await new Promise(r => setTimeout(r, 50)); });
    const mv = () => Bp.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'T-1'); placeJobs([o], 'VOLVO', 'Fri', '2026-11-16'); await new Promise(r => setTimeout(r, 100)); const why = document.querySelector('.pod-ovl [data-why]'); if (why) why.click(); await new Promise(r => setTimeout(r, 80)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); siteOkDo(['T-2']); await new Promise(r => setTimeout(r, 50)); });
    if (order === 'confirm-first') { await conf(); await save(A.page); await mv(); await save(Bp.page); } else { await mv(); await save(Bp.page); await conf(); await save(A.page); }
    await reload(A.page);
    const r = await A.page.evaluate(() => { const g = w => DB.orders.find(o => o.wo === w); return { t1: { day: g('T-1').delDay, st: (siteState(g('T-1')) || {}).k, for: (g('T-1').siteOk || {}).for }, t2: { st: (siteState(g('T-2')) || {}).k, by: (g('T-2').siteOk || {}).by } }; });
    rec(`two PCs (${order}): T-1 confirmed for Tue then moved to Fri → shows "confirm again", never "ready" for Fri`, r.t1.day === 'Fri' && r.t1.st !== 'ok', JSON.stringify(r));
    rec(`two PCs (${order}): both confirm T-2 → one confirmation, still "ready"`, r.t2.st === 'ok', JSON.stringify(r));
    rec(`no page errors (${order})`, !(S.errors || []).length, (S.errors || []).join(' | '));
    await A.close(); await Bp.close();
  }

  // ---- three PCs: driver loads, office moves the delivery date (pull), third PC re-books ----
  {
    const S = makeServer({ id: 'main', version: 1, nid: 9, settings: {}, orders: [O('L-1', { ...B('Thu'), delivDate: '2026-11-19' })] });
    const P1 = await open(browser, S, { now: NOW }), P2 = await open(browser, S, { now: '2026-11-10T10:01:00Z' }), P3 = await open(browser, S, { now: '2026-11-10T10:02:00Z' });
    await P2.page.evaluate(() => moveDates(['L-1'], { deliv: '2026-11-26' }, { why: 'Site not ready' }, 'Ann').apply()); await save(P2.page);
    await P3.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'L-1'); placeJobs([o], 'IVECO', 'Fri', '2026-11-16'); await new Promise(r => setTimeout(r, 100)); const why = document.querySelector('.pod-ovl [data-why]'); if (why) why.click(); await new Promise(r => setTimeout(r, 80)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); }); await save(P3.page);
    await P1.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'L-1'); o.delLoadedAt = new Date().toISOString(); o.ldBy = 'Dan'; sched(); }); await save(P1.page);
    for (const P of [P1, P2, P3]) await reload(P.page);
    const rs = await Promise.all([P1, P2, P3].map(P => P.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'L-1'); return { veh: o.delVeh || '', day: o.delDay || '', wk: o.delWk || '', ld: !!o.delLoadedAt, rb: !!o.delRebook, deliv: o.delivDate, hist: (o.dueHist || []).length }; })));
    const r = rs[0];
    rec('three PCs: the loaded job is on a van (with its week), loaded, not flagged "rebook"', r.ld && r.veh && r.day && r.wk && !r.rb, JSON.stringify(r));
    rec('three PCs: the delivery-date move survives (26 Nov, in history)', r.deliv === '2026-11-26' && r.hist >= 1, JSON.stringify(r));
    rec('three PCs: all three screens agree after reloading', JSON.stringify(rs[1]) === JSON.stringify(r) && JSON.stringify(rs[2]) === JSON.stringify(r), JSON.stringify(rs));
    rec('no page errors (three PCs)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await P1.close(); await P2.close(); await P3.close();
  }

  // ---- 360 px + escaping ----
  {
    const evil = '<img src=x onerror="window.__pwn=1">O\'Grady & "Sons"';
    const row = { id: 'main', nid: 9, settings: {}, orders: [
      O('WO-ESC1', { ...B('Tue'), customer: evil, title: 'Very long kitchen title that goes on and on for a phone ' + evil, delivDate: '2026-11-17' }),
      O('WO-H', { step: '3. In production', delv: false, dueDate: '2026-11-17', plannedWeek: '2026-11-16', customer: evil })] };
    const t = await H.open({ browser, now: NOW, row, viewport: { width: 360, height: 740 } });
    await t.page.evaluate(() => sessionStorage.setItem('wpfWho', `<script>window.__pwn=2</script>O'Grady`));
    const r = await t.page.evaluate(async () => {
      window.__pwn = 0; const out = {}; const g = w => DB.orders.find(o => o.wo === w);
      showTab('b'); await new Promise(r => setTimeout(r, 120)); out.sw0 = document.documentElement.scrollWidth;
      const evN = `<img src=x onerror="window.__pwn=3"> site's "gate"`;
      dateDlgOpen(['WO-ESC1'], `O'Grady <b>Ann</b>`); const dl = document.getElementById('date-dlg');
      const dv = dl.querySelector('#dm-deliv'), dd = dl.querySelector('#dm-date'), q = e => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right) }; };
      out.box = { deliv: q(dv), due: q(dd), pod: q(dl.querySelector('.pod-in')) };
      dv.value = '2026-11-24'; dv.dispatchEvent(new Event('input')); out.sug = q(dl.querySelector('#dm-sug')); out.sugTxt = dl.querySelector('#dm-sug').textContent;
      dl.querySelector('[data-dmwhy="Other"]').click(); const nt = dl.querySelector('#dm-note'); nt.value = evN; nt.dispatchEvent(new Event('input'));
      out.sw1 = document.documentElement.scrollWidth;
      dl.querySelector('#dm-ok').click(); await new Promise(r => setTimeout(r, 60));
      // book it again within 5 days, confirm site (name with <script>), then look at the card on 360 px
      placeJobs([g('WO-ESC1')], 'VOLVO', 'Tue', '2026-11-16'); await new Promise(r => setTimeout(r, 80)); document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      siteOkDo(['WO-ESC1']); await new Promise(r => setTimeout(r, 60));
      moveDates(['WO-H'], { due: '2026-12-11' }, { why: 'Other', note: evN }, `O'Grady <b>Ann</b>`).apply();
      showTab('d'); await new Promise(r => setTimeout(r, 150)); document.querySelector('[data-deltab="1"]').click(); await new Promise(r => setTimeout(r, 120));
      const card = document.querySelector('.dchip[data-dw="WO-ESC1"]'); const cr = card ? card.getBoundingClientRect() : null;
      out.card = card ? { l: Math.round(cr.left), r: Math.round(cr.right), kids: [...card.querySelectorAll('*')].filter(e => e.offsetParent && e.getBoundingClientRect().right > cr.right + 1).map(e => e.className + ':' + e.textContent.slice(0, 30)), txt: card.innerText.replace(/\s+/g, ' ') } : null;
      out.siteTitle = card ? card.innerText : '';
      showTab('b'); await new Promise(r => setTimeout(r, 150));
      const hc = document.querySelector('[data-dhold="WO-H"]'); out.hold = hc ? (() => { const b = hc.getBoundingClientRect(); return { r: Math.round(b.right), t: hc.textContent }; })() : null;
      out.banner = movedBanner(g('WO-H'));
      dmHistDlg('WO-ESC1'); out.hist = [...document.querySelectorAll('.pod-ovl')].pop().innerText; document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
      showTab('x'); await new Promise(r => setTimeout(r, 150)); out.exp = ((document.getElementById('exp-dates') || {}).innerText || '').replace(/\s+/g, ' ');
      let wb = null; const wf = XLSX.writeFile; XLSX.writeFile = b => { wb = XLSX.utils.sheet_to_json(b.Sheets.Dates, { header: 1 }); }; const bx = document.getElementById('btn-xchg2'); if (bx) bx.click(); XLSX.writeFile = wf; out.xl = wb ? wb.filter(r => r[0] === 'WO-ESC1') : null;
      await new Promise(r => setTimeout(r, 200));
      out.pwn = window.__pwn; out.imgs = document.querySelectorAll('img[src="x"]').length;
      return out;
    });
    rec('360 px dialog: due + delivery date boxes inside the dialog and the screen', r.box.deliv.l >= 0 && r.box.deliv.r <= 360 && r.box.due.r <= 360 && r.box.pod.r <= 360, JSON.stringify(r.box));
    rec('360 px dialog: the "Build date suggested" line wraps inside the screen', r.sug.r <= 360 && /suggested/.test(r.sugTxt), JSON.stringify(r.sug) + ' ' + r.sugTxt);
    rec('360 px: the dialog does not make the page wider than it already is', r.sw1 <= Math.max(362, r.sw0), 'with dialog ' + r.sw1 + ' px, board alone ' + r.sw0 + ' px');
    rec('360 px delivery card: site chip and dates inside the card (the card sits in the sideways-scrolling grid)', r.card && !r.card.kids.length, JSON.stringify(r.card));
    rec('360 px board: "⏳ moved out — don\'t cut early" chip inside the screen', r.hold && r.hold.r <= 362, JSON.stringify(r.hold));
    rec('escaping: nothing injected ran (delivery note, site confirmer, customer, hold banner, Dates list)', r.pwn === 0 && r.imgs === 0, JSON.stringify({ pwn: r.pwn, imgs: r.imgs }));
    rec('escaping: site-ready label shows the confirmer name as typed', /<script>window.__pwn=2<\/script>O'Grady/.test(r.siteTitle), r.siteTitle);
    rec('escaping: history shows the delivery note as typed', /<img src=x onerror="window.__pwn=3"> site's "gate"/.test(r.hist), r.hist.slice(0, 300));
    rec('escaping: hold banner is escaped HTML', !/<img src=x/.test(r.banner) && !/<script>/.test(r.banner), r.banner.slice(0, 300));
    rec('escaping: Export Changes Delivery (L) row + Excel Dates row carry the raw customer / note', /Delivery \(L\)/.test(r.exp) && /O'Grady & "Sons"/.test(r.exp) && r.xl && r.xl.length >= 1 && r.xl.some(x => x.includes(`<img src=x onerror="window.__pwn=1">O'Grady & "Sons"`)), JSON.stringify(r.xl) + ' | ' + r.exp.slice(0, 200));
    rec('no page errors (360 / escaping)', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
