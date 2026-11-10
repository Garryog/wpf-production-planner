// Tester attack 4 on the saw's "NEW LIST ISSUED" banner (1b7ca08) and Link to project without a PIN (416d5b9).
//  S1 phone width 360 px: the banner and its ✓ Seen button fit; tapping it clears it
//  S2 40 lists reissued at once: is the saw's TO DO list still reachable / is there a way to clear them all?
//  S3 localStorage blocked (private mode / policy): ✓ Seen must still clear the banner for this session
//  K1 Link to project with no PIN on this PC: links, no PIN asked
// Browser, fake Supabase only. Run: node tests/stage3/flow-attack4-sawbanner.test.js
const F = require('./fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 600))); };
function server(n) {
  const row = F.v2Row(); row.orders = [];
  for (let i = 1; i <= n; i++) row.orders.push(H.order({ wo: 'WO-' + i, customer: 'Aderrig Homes', unit: String(i), dueDate: '2026-10-22', origDueDate: '2026-10-22' }));
  const S = F.makeServer(row);
  for (let i = 1; i <= n; i++) F.seedList(S, 'L' + i, { name: 'House ' + i + ' Type B kitchen with a long name for the saw screen', wos: ['WO-' + i], list: { rev: 2, locked: true }, lines: [
    ['saw', 'Side', '2', 720, 560, 'MFC White', '', '', { added_rev: 1 }], ['saw', 'Top', '1', 1300, 560, 'MFC White', '', '', { added_rev: 1, changed_rev: 2 }]] });
  return S;
}
const ban = p => p.evaluate(() => { const b = document.getElementById('saw-newlist'); if (!b) return null; const r = b.getBoundingClientRect(); const btns = [...b.querySelectorAll('[data-sawseen]')].map(x => x.getBoundingClientRect());
  const firstJob = document.querySelector('.wl-card, .wl-row, [data-lt], .wl-list > *');
  return { rows: b.querySelectorAll('.snl-row').length, h: Math.round(r.height), w: Math.round(r.width), vw: innerWidth, vh: innerHeight, btnOut: btns.filter(x => x.right > innerWidth + 1 || x.width < 40 || x.height < 36).length,
    all: [...b.querySelectorAll('button')].filter(x => /all/i.test(x.textContent)).length, hscroll: document.documentElement.scrollWidth > innerWidth + 1, jobTop: firstJob ? Math.round(firstJob.getBoundingClientRect().top) : null }; });
(async () => {
  const browser = await H.chromium.launch();
  // ---- S1 phone
  {
    const S = server(2); const s = await F.dev(browser, S, 'saw', { viewport: { width: 360, height: 740 } });
    let b = await ban(s.page);
    rec('S1 360 px: banner shown for both, fits the width, ✓ Seen buttons on screen and ≥ 40×36', b && b.rows === 2 && b.w <= 360 && !b.btnOut && !b.hscroll, JSON.stringify(b));
    await s.page.evaluate(() => document.querySelector('[data-sawseen="L1"]').click());
    b = await ban(s.page);
    rec('S1b ✓ Seen on House 1 at 360 px clears only House 1', b && b.rows === 1, JSON.stringify(b));
    // Rev 3 after Rev 2 seen, on the phone, after a reload of the page
    await s.page.evaluate(() => document.querySelector('[data-sawseen="L2"]').click());
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'L2'), { rev: 3 });
    await s.page.evaluate(async () => { await lsReloadList('L2'); render(); }); await F.sleep(300);
    b = await ban(s.page);
    rec('S1c House 2 Rev 3 after Rev 2 was seen (page reloaded): banner back for House 2 only', b && b.rows === 1 && await s.page.evaluate(() => /House 2.*Rev 3 replaces Rev 2/.test(document.getElementById('saw-newlist').innerText)), JSON.stringify(b));
    await s.close();
  }
  // ---- S2 40 at once
  {
    const S = server(40); const s = await F.dev(browser, S, 'saw', { viewport: { width: 1280, height: 800 } });
    const b = await ban(s.page);
    rec('S2 40 lists reissued at once: banner is not taller than the screen (the TO DO list is still in view)', b && b.h < b.vh, JSON.stringify(b));
    rec('S2b …and there is a "✓ Seen all" (one tap, not 40)', b && b.all > 0, JSON.stringify(b));
    const t0 = Date.now(); for (let i = 1; i <= 40; i++) await s.page.evaluate(i => { const x = document.querySelector('[data-sawseen="L' + i + '"]'); if (x) x.click(); }, i);
    rec('S2c tapping ✓ Seen 40 times clears the banner (each tap re-draws the screen: ' + (Date.now() - t0) + ' ms)', !(await ban(s.page)), '');
    await s.close();
  }
  // ---- S3 localStorage blocked from page load (private mode / a policy): the person picks Saw, then taps ✓ Seen
  {
    const S = server(1);
    const s = await F.open(browser, S, { now: F.NOW });
    await s.page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = function () { throw new DOMException('blocked', 'SecurityError'); }; });
    await s.page.reload(); await F.sleep(1500);
    const st0 = await s.page.evaluate(async () => { window.roleOk = () => true; /* the saw PIN can't be remembered with storage blocked (pre-existing) — let the banner itself be tested */ try { setRole('saw'); } catch (e) { return 'setRole threw ' + e.message; } try { lsReset(); await lsLoad(); } catch (e) {} render(); return typeof ROLE !== 'undefined' ? ROLE : '?'; });
    const b0 = await ban(s.page);
    await s.page.evaluate(() => { const x = document.querySelector('[data-sawseen="L1"]'); if (x) x.click(); });
    const b1 = await ban(s.page);
    const dbg = await s.page.evaluate(() => document.body.innerText.slice(0, 160));
    rec('S3 storage blocked: the saw screen shows the banner (role ' + st0 + ')', !!b0, JSON.stringify({ b0, dbg }));
    rec('S3b storage blocked: ✓ Seen clears the banner at least until the page is reloaded', b0 && !b1, JSON.stringify({ b0, b1, dbg }));
    rec('no page errors (S3)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await s.close();
  }
  // ---- K1 Link to project, no PIN stored, PIN prompt cancelled
  {
    const row = F.v2Row(); row.orders = [H.order({ wo: 'WO-9', title: 'HOUSE 9 TYPE B KITCHEN', customer: 'MURPHY DEVELOPMENTS - ORCHARD VIEW', step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '2026-12-14' })];
    const S = F.makeServer(row); D.insert(S.db, 'projects', { id: 'P7', name: 'Seven Mills', customer: 'Glenveagh', cien_names: [] });
    const a = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await a.page.evaluate(async () => { ['wpfEditPin'].forEach(k => localStorage.removeItem(k)); window.__asked = []; window.prompt = m => { window.__asked.push(m); return null; }; lsReset(); await lsLoad(); showTab('l'); render(); });
    await F.sleep(300);
    const r = await a.page.evaluate(async () => { const sel = document.querySelector('[data-ltilink="WO-9"]'); if (!sel) return 'no Link to project box: ' + document.body.innerText.slice(0, 200); sel.value = 'P7'; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 1500)); return 'ok'; });
    const p = D.find(S.db, 'projects', 'P7');
    rec('K1 Link to project with no PIN on this PC: linked, no PIN asked', r === 'ok' && (p.cien_names || []).includes('MURPHY DEVELOPMENTS - ORCHARD VIEW') && !(await a.page.evaluate(() => window.__asked.filter(m => /PIN/.test(m)).length)), JSON.stringify({ r, names: p.cien_names, asked: await a.page.evaluate(() => window.__asked) }));
    await a.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
