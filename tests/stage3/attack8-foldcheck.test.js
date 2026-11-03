// Tester round 8 (3 Nov 2026): the switch-back fold when the new save check (c584e01/4447f05) CANNOT read the database
// (signal still out after the lost reply), so the older "held change" logic (1b7189a) has to decide; and the lasting
// amber warning box (02d4465): stacking, 380-px phone, tap to close, does it block ticking underneath?
// Fake Supabase only (srv3.js). Run: node tests/stage3/attack8-foldcheck.test.js
const A = require('./atk.js');
const { F, S3, H, rec } = A;
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + String(d).slice(0, 400) : ''));
const PP = u => /production_planner/.test(String(u)) && !/select=ls/.test(String(u));
const SUPA = u => /supabase\.co/.test(String(u));
const oldKeys = S => Object.keys((S.row.settings.listRow || {}).L1 || {});
const has = (S, part) => oldKeys(S).some(k => k.split('|')[1] === part);
const old = S => 'old=' + oldKeys(S).map(k => k.split('|')[1]);
const idle = p => p.evaluate(async () => { for (let i = 0; i < 120 && (SAVING || saveT || LQ.folding); i++) { if (saveT && !SAVING) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } });
const devState = p => p.evaluate(() => ({ q: lqRead().length, failed: !!DB.saveFailed, unsure: UNSURE.length, err: LQ.err, msgs: LQ.msgs.slice(), box: (() => { const t = document.getElementById('toast'); return t.classList.contains('show') && t.classList.contains('stick') ? t.textContent : ''; })() }));
const pin = p => p.evaluate(() => { window.prompt = () => '9000'; window.confirm = () => true; });
async function settle(p) { for (let i = 0; i < 50 && await p.evaluate(() => !!(SAVING || saveT)); i++) await idle(p); }
async function held(browser, ids = ['L1:1', 'L1:3'], vp) {
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
  const off = await F.dev(browser, S, 'office'), saw = await F.dev(browser, S, 'saw', vp ? { viewport: vp } : {});
  S.offline = true;
  for (const id of ids) await F.tapRow(saw.page, 'data-rt', id);
  await saw.page.evaluate(async () => { await lqSend(); });
  S.offline = false;
  await settle(off.page); await pin(off.page);
  await off.page.evaluate(async () => { try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
  await settle(off.page);
  return { S, off, saw };
}
// The fold's save: reply lost (apply = it landed), then the tablet has no signal for `out` ms (the check can't read).
async function loseOut(saw, S, apply, out) {
  let lost = 0, until = 0;
  await saw.page.route(SUPA, async r => { const q = r.request();
    if (until && Date.now() < until) return r.abort('internetdisconnected');
    if (PP(q.url()) && q.method() === 'PATCH' && !lost) { const b = JSON.parse(q.postData() || '{}'); if (b.settings && b.settings.listRow && b.settings.listRow.L1) { lost = 1; until = Date.now() + out; if (apply) { Object.assign(S.row, b); S.row.version = (+S.row.version || 1) + 1; } return r.abort('connectionreset'); } }
    return r.fallback(); });
  saw.page.evaluate(async () => { await loadDB(); await lqSend(); }).catch(() => {});
  for (let i = 0; i < 60 && !lost; i++) await F.sleep(100); await F.sleep(600);
  return () => until;
}
const officeUntick = (off, lid) => off.page.evaluate(async lid => { await loadDB(); const l = DB.lists.find(x => x.id === 'L1'); const r = lsOldRows(l).find(x => x.lid === lid); setRowTick(l, v1Key(r), 'saw', 'Dee', false); clearTimeout(saveT); await saveDB(); }, lid);
const officeNote = (off, n) => off.page.evaluate(async n => { await loadDB(); DB.orders[0].notes = n; clearTimeout(saveT); await saveDB(); }, n);

(async () => {
  const browser = await H.chromium.launch();
  { // F1 landed, signal out 3 s (check fails), office unticks Side meanwhile, tablet retries: Side stays unticked, told
    const { S, off, saw } = await held(browser); await loseOut(saw, S, true, 3000);
    const mid = await devState(saw.page);
    await officeUntick(off, 'L1:1'); await settle(off.page);
    await F.sleep(3000);
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page); await F.sleep(500); await idle(saw.page);
    await saw.page.evaluate(async () => { clearTimeout(saveT); await saveDB(); }); await idle(saw.page);
    const st = await devState(saw.page);
    rec('F1 fold save landed, no signal for 3 s (check cannot read), office unticks Side: Side stays unticked, Top ticked, queue empty', !has(S, 'side') && has(S, 'top') && st.q === 0, old(S) + ' mid=' + JSON.stringify(mid) + ' end=' + JSON.stringify(st));
    rec('F1b the operator is told in the lasting box, naming Side', /"Side"/.test(st.box), JSON.stringify(st.box));
    await off.close(); await saw.close();
  }
  { // F2 never landed, signal out 3 s, 2 office saves meanwhile (the trade-off): ticks dropped? told?
    const { S, off, saw } = await held(browser); await loseOut(saw, S, false, 3000);
    await officeNote(off, 'a'); await settle(off.page); await officeNote(off, 'b'); await settle(off.page);
    await F.sleep(3000);
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page); await F.sleep(500); await idle(saw.page);
    const st = await devState(saw.page);
    const dropped = !has(S, 'side') && !has(S, 'top');
    rec('F2 (trade-off) fold save never landed, no signal 3 s, 2 office saves: ticks kept — or, if dropped, the lasting box names both', !dropped || (/"Side"/.test(st.box) && /"Top"/.test(st.box)), 'dropped=' + dropped + ' ' + old(S) + ' ' + JSON.stringify(st));
    info('F2 ticks dropped in the "signal out" trade-off', dropped);
    await off.close(); await saw.close();
  }
  { // F3 never landed, signal back within the check (0.1 s): check decides "not landed", ticks placed again, even with 2 office saves after
    const { S, off, saw } = await held(browser); await loseOut(saw, S, false, 100);
    await officeNote(off, 'a'); await settle(off.page); await officeNote(off, 'b'); await settle(off.page);
    await saw.page.evaluate(async () => { await lqSend(); }); await idle(saw.page);
    const st = await devState(saw.page);
    rec('F3 fold save never landed, signal back in 0.1 s: ticks placed, queue empty, no warning', has(S, 'side') && has(S, 'top') && st.q === 0 && !st.box, old(S) + ' ' + JSON.stringify(st));
    await off.close(); await saw.close();
  }
  // ===== the lasting warning box =====
  { const { S, off, saw } = await held(browser, ['L1:1', 'L1:3'], { width: 380, height: 740 });
    await saw.page.evaluate(async () => { await loadDB(); await lqSend(); }); await idle(saw.page);
    await saw.page.evaluate(() => { setRole('saw'); render(); });
    const long = 'Not changed — "' + 'Carcass side panel left hand with a very long description '.repeat(3) + '" was changed on another screen (already cut by Dee 10:00). Showing it as it is now.';
    const r = await saw.page.evaluate(async long => {
      for (let i = 1; i <= 4; i++) lqSay('W' + i + ' ' + long);
      const t = document.getElementById('toast'), b = t.getBoundingClientRect();
      const out = { n: (t.textContent.match(/W\d/g) || []).join(','), left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), h: Math.round(b.height), vw: innerWidth, vh: innerHeight };
      toast('Saved'); await new Promise(r => setTimeout(r, 2700)); out.afterShort = t.classList.contains('stick') && /W4/.test(t.textContent);
      // what is under the box? try tapping a tick button that sits under it
      const btns = [...document.querySelectorAll('button,[data-rt]')].filter(x => { const q = x.getBoundingClientRect(); return q.width && q.top < b.bottom && q.bottom > b.top && q.left < b.right && q.right > b.left; });
      out.underBox = btns.length;
      if (btns[0]) { const q = btns[0].getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); out.hitIsBox = hit === t || t.contains(hit); }
      t.click(); out.closed = !t.classList.contains('show');
      lqSay('W5 newline in a part "Side\nleft" was changed'); lqSay('W6 x'); lqSay('W7 y'); out.nl = t.textContent;
      return out; }, long);
    rec('W1 4 warnings: last 3 kept newest last, box fits a 380-px phone', r.n === 'W2,W3,W4' && r.left >= 0 && r.right <= r.vw && r.top >= 0, JSON.stringify(r));
    rec('W2 a short toast meanwhile does not wipe the warnings', r.afterShort, JSON.stringify(r));
    rec('W3 tapping the box closes it', r.closed, JSON.stringify(r));
    rec('W4 (Low) the box does not cover tick buttons (operator can keep ticking without closing it)', !r.hitIsBox, 'buttons under box=' + r.underBox + ' box height=' + r.h + '/' + r.vh + ' hitIsBox=' + r.hitIsBox);
    rec('W5 (Low) a part name with a line break (Alt+Enter in Excel) does not cut an older warning in half', /W5 newline in a part "Side\nleft" was changed/.test(r.nl), JSON.stringify(r.nl));
    const x = await saw.page.evaluate(() => { window.__x = 0; lqSay('<img src=x onerror="window.__x=1">'); return new Promise(r => setTimeout(() => r(window.__x), 300)); });
    rec('W6 HTML in a warning runs nothing', !x, 'x=' + x);
    await off.close(); await saw.close(); }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
