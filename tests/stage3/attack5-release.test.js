// ATTACK 5 — release carries the line version (7cd57a8): several stale releases in one batch, from two devices, mixed
// with a good one; a release whose reply is lost then resent; a release of a line cut meanwhile. Fake Supabase only.
// Run: node tests/stage3/attack5-release.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const L = F.line;
const park = (t, id, by) => t.page.evaluate(({ id, by }) => lqLine(id, 'waiting', by), { id, by });
const rel = (t, id, by) => t.page.evaluate(({ id, by }) => lqLine(id, 'release', by), { id, by });
const sendPoll = t => t.page.evaluate(async () => { await lqSend(); await lsPoll(); render(); });
async function device(browser, S, role, name) {
  const t = await F.dev(browser, S, role); t.off = false;
  await t.page.evaluate(n => localStorage.setItem('wpfOpName', n), name);
  await t.page.route('**/*', r => (t.off && r.request().url().includes('supabase.co')) ? r.abort('internetdisconnected') : r.fallback());
  return t;
}
(async () => {
  const browser = await H.chromium.launch();
  // ---- R1: lines 1,2,3 waiting. Aine (offline) releases all three. Meanwhile Brian releases + re-parks 1, does it twice on 2,
  //          leaves 3, and Ciara (also offline) releases 1 and 2 too. Both reconnect.
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await device(browser, S, 'saw', 'Aine'), b = await device(browser, S, 'saw', 'Brian'), c = await device(browser, S, 'saw', 'Ciara');
    for (const id of ['L1:1', 'L1:2', 'L1:3']) await park(b, id, 'Brian'); await sendPoll(b);
    for (const t of [a, c]) await t.page.evaluate(async () => { await lsPoll(); render(); });
    a.off = true; c.off = true;
    for (const id of ['L1:1', 'L1:2', 'L1:3']) await rel(a, id, 'Aine');
    for (const id of ['L1:1', 'L1:2']) await rel(c, id, 'Ciara');
    await a.page.evaluate(async () => { await lqSend(); }); await c.page.evaluate(async () => { await lqSend(); });
    for (const [id, n] of [['L1:1', 1], ['L1:2', 2]]) for (let i = 0; i < n; i++) { await rel(b, id, 'Brian'); await sendPoll(b); await park(b, id, 'Brian'); await sendPoll(b); }
    const before = ['L1:1', 'L1:2', 'L1:3'].map(id => L(S, id).status + '/v' + L(S, id).version);
    a.off = false; await sendPoll(a); c.off = false; await sendPoll(c);
    const st = ['L1:1', 'L1:2', 'L1:3'].map(id => L(S, id).status);
    const ma = await a.page.evaluate(() => ({ q: LQ.q.length, msgs: LQ.msgs.slice(), shown: ['L1:1', 'L1:2', 'L1:3'].map(id => lnSt(LST.ln.get(id))) }));
    const mc = await c.page.evaluate(() => ({ q: LQ.q.length, msgs: LQ.msgs.slice() }));
    rec('R1 stale releases (2 from Aine, 2 from Ciara) refused; Aine\'s good release of line 3 goes through', st[0] === 'waiting' && st[1] === 'waiting' && st[2] === 'todo', 'before=' + before + ' after=' + st);
    rec('R1b both devices empty their queue and Aine\'s screen shows the true state (1,2 waiting, 3 todo)', ma.q === 0 && mc.q === 0 && ma.shown.join() === 'waiting,waiting,todo', JSON.stringify({ a: ma.shown, qa: ma.q, qc: mc.q }));
    rec('R1c Aine and Ciara are told their releases were not made', ma.msgs.length >= 1 && mc.msgs.length >= 1, 'Aine: ' + ma.msgs.join(' | ').slice(0, 200) + ' — Ciara: ' + mc.msgs.join(' | ').slice(0, 200));
    const evs = S.db.t.list_events.filter(e => e.act === 'release' || /release/.test(e.act || '') || e.to === 'todo').length;
    rec('R1d no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300) + ' release events=' + evs);
    for (const t of [a, b, c]) await t.close();
  }
  // ---- R2: a release lands but its reply is lost; the resend must count once and NOT tell the operator "no longer waiting"
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await device(browser, S, 'saw', 'Aine');
    await park(a, 'L1:3', 'Aine'); await sendPoll(a);
    await rel(a, 'L1:3', 'Aine');
    S.dropReply = 1; await a.page.evaluate(async () => { await lqSend(); });
    const mid = L(S, 'L1:3').status;
    await sendPoll(a);
    const m = await a.page.evaluate(() => ({ q: LQ.q.length, msgs: LQ.msgs.slice(), shown: lnSt(LST.ln.get('L1:3')) }));
    rec('R2 release reply lost then resent: line todo, queue empty, no "not waiting / not changed" complaint', L(S, 'L1:3').status === 'todo' && m.q === 0 && !m.msgs.some(x => /no longer waiting|Not changed|Not parked/.test(x)),
      'mid=' + mid + ' db=' + L(S, 'L1:3').status + ' ' + JSON.stringify(m));
    await a.close();
  }
  // ---- R3: Aine offline releases a line which Brian then CUTS: release is a no-op, line stays cut, no scary message
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await device(browser, S, 'saw', 'Aine'), b = await device(browser, S, 'saw', 'Brian');
    await park(b, 'L1:1', 'Brian'); await sendPoll(b); await a.page.evaluate(async () => { await lsPoll(); render(); });
    a.off = true; await rel(a, 'L1:1', 'Aine'); await a.page.evaluate(async () => { await lqSend(); });
    const tap = await F.tapRow(b.page, 'data-rt', 'L1:1'); await sendPoll(b);
    if (L(S, 'L1:1').status !== 'cut') { await b.page.evaluate(() => lqLine('L1:1', 'cut', 'Brian')); await sendPoll(b); } // the tap on a parked row does not cut it — cut it the queue way
    const mid = L(S, 'L1:1').status;
    a.off = false; await sendPoll(a);
    const m = await a.page.evaluate(() => ({ q: LQ.q.length, msgs: LQ.msgs.slice() }));
    rec('R3 late release of a line cut since: stays cut, Aine\'s queue empties', mid === 'cut' && L(S, 'L1:1').status === 'cut' && m.q === 0, 'tap=' + tap + ' mid=' + mid + ' final=' + L(S, 'L1:1').status + ' ' + JSON.stringify(m));
    for (const t of [a, b]) await t.close();
  }
  // ---- R4: an old queue entry (saved by the previous app version, no "v" on the release) still works
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const a = await device(browser, S, 'saw', 'Aine');
    await park(a, 'L1:2', 'Aine'); await sendPoll(a);
    await a.page.evaluate(() => { lqLine('L1:2', 'release', 'Aine'); lqMut(q => q.forEach(e => { delete e.v; })); });
    await sendPoll(a);
    rec('R4 a release queued without a version (older code) still releases', L(S, 'L1:2').status === 'todo', L(S, 'L1:2').status);
    await a.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
