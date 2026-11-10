// Tester attack round 1 on Part 2 step 4 (B6b reorder) and step 3 (fixed 🔒 badge): the day-14/15 edge (calendar days,
// overdue, delivery date, local midnight), a free row put ABOVE fixed rows (plan rule 6: needs a request / a reason), a
// stale anchor (another PC moved a row this screen's ▲ / Move to / drag is measured against), a lost reply after the
// database moved the row, Whole house with the house's rows apart, junk in "Move to…", a poll redraw in the middle of a
// drag, and a stray drop after a cancelled drag. Fake Supabase only (tests/seq/srvs.js). Run: node tests/seq/attack1-move.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const toastOf = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const view = p => p.evaluate(() => [...document.querySelectorAll('tr.seq-r')].map(tr => tr.dataset.seqr).join(','));
const moves = S => (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length;
function extraOrders(row) {
  row.orders.push(
    H.order({ wo: 'WO-E14', customer: 'Aderrig Homes', floor: 'T01', unit: '1', title: 'DAY 14', dueDate: '2026-11-04', origDueDate: '2026-11-04', plannedWeek: '' }),
    H.order({ wo: 'WO-E15', customer: 'Aderrig Homes', floor: 'T01', unit: '2', title: 'DAY 15', dueDate: '2026-11-05', origDueDate: '2026-11-05', plannedWeek: '' }),
    H.order({ wo: 'WO-OD', customer: 'Aderrig Homes', floor: 'T01', unit: '3', title: 'OVERDUE', dueDate: '2026-10-10', origDueDate: '2026-10-10', plannedWeek: '' }),
    H.order({ wo: 'WO-DV', customer: 'Aderrig Homes', floor: 'T01', unit: '4', title: 'DELIVERY IN WINDOW', dueDate: '2026-11-20', origDueDate: '2026-11-20', delivDate: '2026-11-04', plannedWeek: '' }),
    H.order({ wo: 'WO-DV15', customer: 'Aderrig Homes', floor: 'T01', unit: '5', title: 'DELIVERY DAY 15', dueDate: '2026-11-25', origDueDate: '2026-11-25', delivDate: '2026-11-05', plannedWeek: '' }));
  return row;
}
(async () => {
  const browser = await H.chromium.launch();

  // ================= A. the 🔒 fixed edge (today Wed 21 Oct 2026: 4 Nov fixed, 5 Nov free)
  {
    const S = X.makeServer(extraOrders(X.v2Row()));
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pm: 'John Burke' });
    [['F14', 'WO-E14'], ['F15', 'WO-E15'], ['FOD', 'WO-OD'], ['FDV', 'WO-DV'], ['FDV15', 'WO-DV15']].forEach(([id, wo]) => X.seqRow(S, id, 'P1', { wo }));
    X.seqRow(S, 'FW', 'P1', { floor: 'T01', unit: '9', product: 'K1', name: 'WAITING SOON', req_date: '2026-10-22' });
    const fx = async t => t.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('tr.seq-r')].map(tr => [tr.dataset.seqr, tr.classList.contains('seq-fixed') && /🔒/.test(tr.innerText)])));
    const o = await X.dev(browser, S, 'office');
    await o.page.evaluate(() => seqOpen('P1')); await sleep(500);
    const f = await fx(o);
    rec('A1 build date = today + 14 (Wed 4 Nov) is 🔒 fixed', f.F14 === true, JSON.stringify(f));
    rec('A2 build date = today + 15 (Thu 5 Nov) is free', f.F15 === false, JSON.stringify(f));
    rec('A3 overdue job (due 10 Oct, not shipped) is 🔒 fixed', f.FOD === true, JSON.stringify(f));
    rec('A4 build 20 Nov but DELIVERY 4 Nov (day 14) is 🔒 fixed (either date counts)', f.FDV === true, JSON.stringify(f));
    rec('A5 build 25 Nov, delivery 5 Nov (day 15) is free', f.FDV15 === false, JSON.stringify(f));
    rec('A6 a waiting row (no WO) is never fixed, even dated tomorrow', f.FW === false, JSON.stringify(f));
    await o.close();
    // 00:30 Irish summer time on Thu 22 Oct (= 23:30 UTC Wed): "today" is the 22nd, so 5 Nov is now day 14 → fixed
    const late = await X.dev(browser, S, 'office', { now: '2026-10-21T23:30:00Z' });
    await late.page.evaluate(() => seqOpen('P1')); await sleep(500);
    const f2 = await fx(late);
    rec('A7 just after local midnight (00:30 Thu 22 Oct, UTC still Wed): 5 Nov is day 14 → fixed (local date, not UTC)', f2.F15 === true && f2.F14 === true, JSON.stringify(f2));
    await late.close();
    // the window is a Settings number: 7 → 4 Nov is free
    S.row.settings.seqFixedDays = 7;
    const s7 = await X.dev(browser, S, 'office');
    await s7.page.evaluate(() => seqOpen('P1')); await sleep(500);
    const f3 = await fx(s7);
    rec('A8 Settings fixed window 7 days: 4 Nov (day 14) free, 28 Oct-ish rows still fixed, overdue still fixed', f3.F14 === false && f3.FOD === true && f3.FDV === false, JSON.stringify(f3));
    rec('A9 footer says "next 7 days"', /next 7 days/.test(await s7.page.evaluate(() => document.querySelector('.seq-ft').innerText)));
    await s7.close();
    rec('A no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  }

  // ================= B. a FREE row put ABOVE fixed rows (plan "How a sequence-row date edit flows" step 6)
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pm: 'John Burke' });
    // WO-1 / WO-2 due tomorrow (fixed), WO-3 due 3 Dec (free)
    X.seqRow(S, 'QA', 'P1', { wo: 'WO-1' }); X.seqRow(S, 'QB', 'P1', { wo: 'WO-2' }); X.seqRow(S, 'QC', 'P1', { wo: 'WO-3' });
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    const n0 = moves(S);
    await pm.page.evaluate(() => { window.__prompt = '1'; document.querySelector('[data-seqto="QC"]').click(); }); await sleep(600);
    const t = await toastOf(pm.page);
    rec('B1 PM: Move a FREE row to #1, above two 🔒 fixed rows → must go to the Production Manager as a request (plan rule 6), not straight through',
      moves(S) === n0 && X.order(S, 'P1').join() === 'QA,QB,QC', 'order now ' + X.order(S, 'P1').join() + ' toast: ' + t);
    // the same with ▲ (one place up, above fixed WO-2)
    X.DS.RPC.seq_move(S.db, { p_ids: ['QC'], p_after: 'QB', p_by: 'reset' });
    await pm.page.evaluate(async () => { await seqFresh('P1'); render(); }); await sleep(200);
    const n1 = moves(S);
    await pm.page.evaluate(() => document.querySelector('[data-sequp="QC"]').click()); await sleep(600);
    rec('B2 PM: ▲ on a free row puts it above a 🔒 fixed row → should be refused / a request', moves(S) === n1, 'order now ' + X.order(S, 'P1').join());
    await pm.close();
    // office: same move should ask for a reason (like moving a fixed row)
    X.DS.RPC.seq_move(S.db, { p_ids: ['QA', 'QB'], p_after: null, p_by: 'reset' });
    const of = await X.dev(browser, S, 'office');
    await of.page.evaluate(() => seqOpen('P1')); await sleep(500);
    const n2 = moves(S);
    await of.page.evaluate(() => { window.__prompt = '1'; document.querySelector('.seq-ovl [data-seqto="QC"]').click(); }); await sleep(400);
    const why = await of.page.evaluate(() => [...document.querySelectorAll('[data-why]')].length);
    rec('B3 office: putting a free row above 🔒 fixed rows asks for a reason first (logged like a fixed move)', why > 0 && moves(S) === n2, 'reason buttons: ' + why + ', seq_move calls ' + n2 + ' → ' + moves(S) + ', order ' + X.order(S, 'P1').join());
    await of.close();
    rec('B no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  }

  // ================= C. stale ANCHOR: another PC moves a row; this screen's ▲ / Move to / drag measured against its old view
  {
    const mk = () => {
      const S = X.makeServer();
      X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pm: 'John Burke' });
      'ABCDEFG'.split('').forEach((c, i) => X.seqRow(S, 'Q' + c, 'P1', { floor: 'T20', unit: String(i + 1), product: 'K1', name: 'HOUSE ' + c }));
      return S;
    };
    // C1: ▲ on G (wants G just above F). Meanwhile the other PC moved E up under A (rows B, C, D, E renumbered; F, G untouched).
    let S = mk();
    let pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    X.DS.RPC.seq_move(S.db, { p_ids: ['QE'], p_after: 'QA', p_by: 'Other PC' }); // A,E,B,C,D,F,G in the database; this screen still shows A..G
    await pm.page.evaluate(() => document.querySelector('[data-sequp="QG"]').click()); await sleep(700);
    let got = X.order(S, 'P1').join(), t = await toastOf(pm.page);
    rec('C1 stale view, ▲ on G: G ends just above F (or the move is refused as stale) — not dropped somewhere else',
      got === 'QA,QE,QB,QC,QD,QG,QF' || (got === 'QA,QE,QB,QC,QD,QF,QG' && /someone else/i.test(t)), got + ' | toast: ' + t);
    await pm.close();
    // C2: "Move to 3" on G — the other PC moved B to the bottom meanwhile (C..G renumbered, but not... G's version changes too) → use a move that leaves G alone
    S = mk();
    pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    X.DS.RPC.seq_move(S.db, { p_ids: ['QC'], p_after: 'QE', p_by: 'Other PC' }); // A,B,D,E,C,F,G — G and A/B untouched
    await pm.page.evaluate(() => { window.__prompt = '3'; document.querySelector('[data-seqto="QG"]').click(); }); await sleep(700);
    got = X.order(S, 'P1').join(); t = await toastOf(pm.page);
    const gAt = X.order(S, 'P1').indexOf('QG') + 1;
    rec('C2 stale view, "Move to 3" on G: G lands at #3 as the toast says (or refused as stale)', (gAt === 3 && /#3/.test(t)) || /someone else/i.test(t), 'G at #' + gAt + ' (' + got + ') | toast: ' + t);
    await pm.close();
    // C3: drag G onto C (wants G where C is). The other PC moved C to the top meanwhile (A, B renumbered; G untouched).
    S = mk();
    pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    X.DS.RPC.seq_move(S.db, { p_ids: ['QC'], p_after: null, p_by: 'Other PC' }); // C,A,B,D,E,F,G
    await pm.page.dragAndDrop('tr[data-seqr="QG"] .seq-hd', 'tr[data-seqr="QC"]'); await sleep(700);
    got = X.order(S, 'P1').join(); t = await toastOf(pm.page);
    rec('C3 stale view, drag G onto C: G ends right above C (or refused as stale)', /QG,QC/.test(got) || /someone else/i.test(t), got + ' | toast: ' + t);
    rec('C no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }

  // ================= D. lost reply: the database moved the row but the answer never arrived
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pm: 'John Burke' });
    'ABCD'.split('').forEach((c, i) => X.seqRow(S, 'Q' + c, 'P1', { floor: 'T30', unit: String(i + 1), product: 'K1', name: 'HOUSE ' + c }));
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    S.dropReplyS = 1;
    await pm.page.evaluate(() => document.querySelector('[data-seqdn="QA"]').click()); await sleep(800);
    const t = await toastOf(pm.page), v = await view(pm.page);
    rec('D1 reply lost after the database moved A: the screen shows the database order', v === X.order(S, 'P1').join() && v === 'QB,QA,QC,QD', v + ' db ' + X.order(S, 'P1').join());
    rec('D2 … and does NOT tell the user "Not moved" when it did move (he would press ▼ again and move it twice)', !/^Not moved/.test(t), t);
    await pm.close();
  }

  // ================= E. Whole house with the house's rows NOT next to each other; junk in "Move to…"
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pm: 'John Burke' });
    [['H1', 'T40', '1', 'KITCHEN'], ['QX', 'T40', '2', 'KITCHEN'], ['QY', 'T40', '3', 'KITCHEN'], ['H2', 'T40', '1', 'UTILITY'], ['QZ', 'T40', '4', 'KITCHEN']]
      .forEach(([id, f, u, n]) => X.seqRow(S, id, 'P1', { floor: f, unit: u, product: 'K1', name: n }));
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    await pm.page.evaluate(() => { const w = document.getElementById('seq-house'); w.checked = true; w.onchange(); });
    const n0 = moves(S);
    await pm.page.evaluate(() => document.querySelector('[data-sequp="H2"]').click()); await sleep(600);
    const t1 = await toastOf(pm.page);
    rec('E1 Whole house ▲ on row 4 whose house-mate is row 1: not "Already at the top" (row 4 is not at the top)', !/Already at the top/.test(t1), 'toast: ' + t1 + ' | moves ' + (moves(S) - n0) + ' order ' + X.order(S, 'P1').join());
    const before = X.order(S, 'P1').join();
    await pm.page.evaluate(async () => { await seqFresh('P1'); render(); const w = document.getElementById('seq-house'); w.checked = true; w.onchange(); });
    await pm.page.evaluate(() => document.querySelector('[data-seqdn="H1"]').click()); await sleep(600);
    const after = X.order(S, 'P1'), h1 = after.indexOf('H1') + 1;
    rec('E2 Whole house ▼ on row 1 (mate at row 4): the house moves down ONE place, not to the bottom (#' + h1 + ')', h1 <= 3, before + ' → ' + after.join());
    await pm.page.evaluate(() => { const w = document.getElementById('seq-house'); w.checked = false; w.onchange(); });
    // Move to… junk
    const n1 = moves(S), o1 = X.order(S, 'P1').join();
    for (const junk of ['abc', '0', '-2', '1.5', '']) {
      await pm.page.evaluate(j => { window.__prompt = j; document.querySelector('[data-seqto="QZ"]').click(); }, junk); await sleep(250);
    }
    rec('E3 Move to… "abc" / "0" / "-2" / "1.5" / blank: nothing moves, plain message', moves(S) === n1 && X.order(S, 'P1').join() === o1 && /Type a position number/.test(await toastOf(pm.page)), (moves(S) - n1) + ' moves, ' + X.order(S, 'P1').join());
    await pm.page.evaluate(() => { window.__prompt = ' 999 '; document.querySelector('[data-seqto="QX"]').click(); }); await sleep(600);
    rec('E4 Move to " 999 " → bottom', X.order(S, 'P1').slice(-1)[0] === 'QX', X.order(S, 'P1').join());
    rec('E no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }

  // ================= F. drag interrupted by the poll redraw; then a stray drop (text dragged from elsewhere)
  {
    const S = X.makeServer();
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pm: 'John Burke' });
    'ABCD'.split('').forEach((c, i) => X.seqRow(S, 'Q' + c, 'P1', { floor: 'T50', unit: String(i + 1), product: 'K1', name: 'HOUSE ' + c }));
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } });
    await pm.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(400);
    // another PC adds a row; the 10 s poll redraws the page while B is being dragged
    await pm.page.evaluate(() => { const tr = document.querySelector('tr[data-seqr="QB"]'); tr.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() })); });
    X.seqRow(S, 'QE', 'P1', { floor: 'T50', unit: '5', product: 'K1', name: 'HOUSE E' });
    await pm.page.evaluate(async () => { await lsPoll(); }); await sleep(300);
    const redrawn = await pm.page.evaluate(() => document.querySelectorAll('tr.seq-r').length);
    rec('F1 the poll redraw happened during the drag (5 rows now)', redrawn === 5, String(redrawn));
    // the user lets go outside the table (drag cancelled) — dragend never reaches the old (removed) row
    const n0 = moves(S);
    // later, a piece of text dragged from another window is dropped on row D
    await pm.page.evaluate(() => { const tr = document.querySelector('tr[data-seqr="QD"]'); const dt = new DataTransfer(); dt.setData('text/plain', 'hello'); tr.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); tr.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); });
    await sleep(600);
    rec('F2 a stray drop (text from elsewhere) after a cancelled drag does not move the row dragged earlier', moves(S) === n0, 'seq_move calls ' + (moves(S) - n0) + ', order ' + X.order(S, 'P1').join());
    // a drag that ends normally outside any row also leaves no "armed" row
    await pm.page.evaluate(async () => { await seqFresh('P1'); render(); }); await sleep(200);
    await pm.page.evaluate(() => { const tr = document.querySelector('tr[data-seqr="QA"]'); tr.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() })); tr.dispatchEvent(new DragEvent('dragend', { bubbles: true })); });
    rec('F3 after a drag cancelled with Esc / dropped outside (dragend), nothing is left armed', await pm.page.evaluate(() => !SEQV.drag), await pm.page.evaluate(() => 'SEQV.drag=' + SEQV.drag));
    rec('F no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await pm.close();
  }
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
