// gm27 (Garry 27 Nov: "need a way of group selecting a number of work orders in the project sequence so they can be moved
// together"). Two or more TICKED rows move as one block, in their current order: "🔢 Move ticked to…", ▲ / ▼ or a drag on any
// ticked row. Rows not next to each other land together. One ticked row, or an unticked row, moves on its own as before. The
// fixed-window rules apply to the whole group. Fake Supabase only. Run: node tests/seq/gm27-group-move.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const toastOf = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const moves = S => (S.rpcCalls || []).filter(c => c.fn === 'seq_move').length;
const ord = S => X.order(S, 'P1').join('').replace(/Q/g, '');
const mk = () => { const S = X.makeServer(); X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  'ABCDEFGH'.split('').forEach((c, i) => X.seqRow(S, 'Q' + c, 'P1', { floor: 'T20', unit: String(i + 1), product: 'K1', name: 'HOUSE ' + c })); return S; };
const tick = (p, ids) => p.evaluate(ids => { ids.forEach(id => { const b = document.querySelector('[data-seqtick="' + id + '"]'); if (b && !b.checked) b.click(); }); }, ids);
const open = async (browser, S, role) => { const t = await X.dev(browser, S, role || 'pm', role ? {} : { me: { pm: 'John Burke' } }); if (role) await t.page.evaluate(() => seqOpen('P1')); else await t.page.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(450); return t; };
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1. the button
    let S = mk(), t = await open(browser, S), p = t.page;
    rec('1a no "Move ticked to…" button with nothing ticked', !(await p.$('#seq-grpto')));
    await tick(p, ['QC']); await sleep(150);
    rec('1b …nor with ONE row ticked (its own Move to… does that)', !(await p.$('#seq-grpto')));
    await tick(p, ['QG', 'QE']); await sleep(150);
    rec('1c three ticked (C, E, G — not next to each other): the button is there', !!(await p.$('#seq-grpto')));
    await p.evaluate(() => { window.__prompt = '1'; document.getElementById('seq-grpto').click(); }); await sleep(700);
    rec('1d moved to #1: they land TOGETHER at the top in their own order, the rest keep theirs (CEG ABDFH)', ord(S) === 'CEGABDFH', ord(S) + ' · ' + await toastOf(p));
    rec('1e ONE database move for the whole group', moves(S) === 1, moves(S));
    rec('1f the rows stay ticked (to nudge again)', await p.evaluate(() => [...document.querySelectorAll('[data-seqtick]:checked')].map(b => b.dataset.seqtick).sort().join()) === 'QC,QE,QG');
    await p.evaluate(() => { window.__prompt = '99'; document.getElementById('seq-grpto').click(); }); await sleep(700);
    rec('1g a number past the end = the bottom (ABDFH CEG)', ord(S) === 'ABDFHCEG', ord(S));
    await p.evaluate(() => { window.__prompt = '3'; document.getElementById('seq-grpto').click(); }); await sleep(700);
    rec('1h to #3: the first ticked row IS #3 (AB CEG DFH)', ord(S) === 'ABCEGDFH', ord(S));
    const n1 = moves(S);
    for (const junk of ['abc', '0', '-2', '']) { await p.evaluate(j => { window.__prompt = j; document.getElementById('seq-grpto').click(); }, junk); await sleep(250); }
    await p.evaluate(() => { window.__prompt = null; document.getElementById('seq-grpto').click(); }); await sleep(250);
    rec('1i junk or Cancel in the box moves nothing', moves(S) === n1 && ord(S) === 'ABCEGDFH', ord(S));
    await p.evaluate(() => { window.__prompt = '3'; document.getElementById('seq-grpto').click(); }); await sleep(400);
    rec('1j already there → says so, no database call', moves(S) === n1 && /Already there/.test(await toastOf(p)), await toastOf(p));

    // ---------- 2. ▲ ▼ on a ticked row moves them all; on an unticked row only that row
    await p.evaluate(() => document.querySelector('[data-seqdn="QE"]').click()); await sleep(700);
    rec('2a ▼ on a ticked row: the block goes one place down (AB D CEG FH)', ord(S) === 'ABDCEGFH', ord(S));
    await p.evaluate(() => document.querySelector('[data-sequp="QC"]').click()); await sleep(700);
    rec('2b ▲ on a ticked row: back up one (AB CEG D FH)', ord(S) === 'ABCEGDFH', ord(S));
    await p.evaluate(() => document.querySelector('[data-seqdn="QA"]').click()); await sleep(700);
    rec('2c ▼ on an UNTICKED row moves only that row (B A CEG DFH)', ord(S) === 'BACEGDFH', ord(S));
    await p.evaluate(() => { window.__prompt = '8'; document.querySelector('[data-seqto="QB"]').click(); }); await sleep(700);
    rec('2d Move to… on an unticked row moves only that row', ord(S) === 'ACEGDFHB', ord(S));

    // ---------- 3. drag: a ticked row dragged onto another row takes the group; onto one of its own does nothing
    const drag = (from, to) => p.evaluate(([from, to]) => { const dt = new DataTransfer(), a = document.querySelector('tr[data-seqr="' + from + '"]'), b = document.querySelector('tr[data-seqr="' + to + '"]');
      a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); b.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); b.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); a.isConnected && a.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); }, [from, to]);
    await drag('QE', 'QH'); await sleep(700);
    rec('3a drag ticked E onto H (below): C, E, G go together to just after H (A DF H CEG B)', ord(S) === 'ADFHCEGB', ord(S));
    const n3 = moves(S); await drag('QE', 'QG'); await sleep(400);
    rec('3b dropped on another ticked row: nothing moves', moves(S) === n3 && ord(S) === 'ADFHCEGB', ord(S));
    await drag('QD', 'QA'); await sleep(700);
    rec('3c dragging an UNTICKED row moves only it (D A F H CEG B)', ord(S) === 'DAFHCEGB', ord(S));
    // ---------- 4. Whole house ticked + group: the ticked rows win, the house's other rows stay
    await p.evaluate(() => { const h = document.getElementById('seq-house'); if (!h.checked) h.click(); }); await sleep(100);
    await p.evaluate(() => { window.__prompt = '1'; document.getElementById('seq-grpto').click(); }); await sleep(700);
    rec('4 with "Whole house" on, a group move still moves exactly the ticked rows', ord(S) === 'CEGDAFHB', ord(S));
    // ---------- 5. clear → one row moves alone again; a ticked row removed elsewhere is not counted
    await p.evaluate(() => { document.getElementById('seq-house').click(); document.querySelector('[data-seqtk="clear"]').click(); }); await sleep(200);
    await p.evaluate(() => document.querySelector('[data-seqdn="QC"]').click()); await sleep(700);
    rec('5 after ✕ Clear, ▼ on C moves only C', ord(S) === 'ECGDAFHB', ord(S));
    rec('page errors: none', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();

    // ---------- 6. two PCs: the other one changed the list → the group move is refused whole (never half a group)
    S = mk(); t = await open(browser, S); p = t.page;
    await tick(p, ['QB', 'QD']); await sleep(150);
    X.DS.RPC.seq_move(S.db, { p_ids: ['QD'], p_after: 'QG', p_by: 'Other PC' }); // ABCEFGDH in the database
    await p.evaluate(() => { window.__prompt = '6'; document.getElementById('seq-grpto').click(); }); await sleep(900);
    rec('6 the other PC moved one of the ticked rows meanwhile → "someone else changed this list", nothing half-moved', ord(S) === 'ABCEFGDH' && /Someone else/.test(await toastOf(p)), ord(S) + ' · ' + await toastOf(p));
    await t.close();

    // ---------- 7. fixed window: a PM's group with a 🔒 row goes to the Production Manager as ONE request; the office gives a reason
    S = X.makeServer(X.v2Row()); X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.seqRow(S, 'QA', 'P1', { wo: 'WO-1' }); X.seqRow(S, 'QB', 'P1', { wo: 'WO-2' }); X.seqRow(S, 'QC', 'P1', { wo: 'WO-3' });
    'DE'.split('').forEach((c, i) => X.seqRow(S, 'Q' + c, 'P1', { floor: 'T20', unit: String(i + 1), product: 'K1', name: 'HOUSE ' + c }));
    t = await open(browser, S); p = t.page;
    const fixed = await p.evaluate(() => [...document.querySelectorAll('tr.seq-fixed')].map(x => x.dataset.seqr).join());
    await tick(p, ['QA', 'QD']); await sleep(150);
    const n7 = moves(S);
    await p.evaluate(() => { window.__prompt = '4'; document.getElementById('seq-grpto').click(); }); await sleep(500);
    const asks = await p.evaluate(() => [...document.querySelectorAll('[data-why]')].length);
    rec('7a PM: a group holding a 🔒 fixed row (' + fixed + ') is NOT moved — he is asked why, for a request', /QA/.test(fixed) && moves(S) === n7 && asks > 0 && ord(S) === 'ABCDE', 'fixed ' + fixed + ' asks ' + asks + ' ' + ord(S));
    await p.evaluate(() => document.querySelector('[data-why]').click()); await sleep(900);
    const rq = (S.db.t.seq_requests || []).filter(q => q.status === 'open');
    rec('7b ONE change request for the whole group, nothing moved yet', rq.length === 1 && rq[0].kind === 'move' && (rq[0].change.ids || []).join() === 'QA,QD' && ord(S) === 'ABCDE', JSON.stringify(rq.map(q => [q.kind, q.change])).slice(0, 200));
    await t.close();
    t = await open(browser, S, 'office'); p = t.page;
    await p.evaluate(() => { ['QB', 'QE'].forEach(id => document.querySelector('.seq-ovl [data-seqtick="' + id + '"]').click()); }); await sleep(200);
    await p.evaluate(() => { window.__prompt = '4'; document.querySelector('.seq-ovl #seq-grpto').click(); }); await sleep(500);
    const asks2 = await p.evaluate(() => [...document.querySelectorAll('[data-why]')].length), n8 = moves(S);
    rec('7c office: a group with a 🔒 row asks for a reason first', asks2 > 0 && ord(S) === 'ABCDE', asks2 + ' ' + ord(S));
    await p.evaluate(() => document.querySelector('[data-why]').click()); await sleep(900);
    rec('7d …then moves the group in one go (A C D BE)', moves(S) === n8 + 1 && ord(S) === 'ACDBE', ord(S));
    rec('page errors: none (7)', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();

    // ---------- 8. read-only (a PM on someone else's project) has no tick boxes and no button; phone 360 px: the button fits
    S = mk(); X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['Someone Else'] });
    t = await open(browser, S); p = t.page;
    await p.evaluate(() => { try { SEQV.pid = 'P1'; pmAll = true; render(); } catch (e) {} }); await sleep(300);
    rec('8a read-only: no tick boxes, no group button', !(await p.$('[data-seqtick]')) && !(await p.$('#seq-grpto')));
    await t.close();
    S = mk(); t = await open(browser, S); p = t.page; await p.setViewportSize({ width: 360, height: 740 }); await tick(p, ['QA', 'QB']); await sleep(250);
    const box = await p.evaluate(() => { const b = document.getElementById('seq-grpto'); if (!b) return null; const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height, sw: document.documentElement.scrollWidth, w: innerWidth }; });
    rec('8b phone 360 px: the button is on the screen, at least 36 px tall, and the page does not scroll sideways', !!box && box.l >= 0 && box.r <= 360.5 && box.h >= 36 && box.sw <= box.w + 1, JSON.stringify(box));
    await p.evaluate(() => { window.__prompt = '5'; document.getElementById('seq-grpto').click(); }); await sleep(700);
    rec('8c …and it works there (CDEF AB GH)', ord(S) === 'CDEFABGH', ord(S));
    await t.close();
  } catch (e) { rec('test ran without an error', false, e && e.stack || e); }
  await browser.close();
  X.finish();
})();
