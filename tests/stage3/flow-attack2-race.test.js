// Tester attack 2 on the "one live list per WO" fixes (a0806d2, 4fd0325, 5ef8a86). Browser, fake Supabase only.
//  R1 ✓ Confirm (PC A) racing "📥 ✓ Use <Excel list>" (PC B) for the same WO
//  R2 ✓ Confirm (PC A) racing the template dialog "Create & attach" (PC B)
//  R3 "✓ Use" of two DIFFERENT Excel lists for the same WO on two PCs
//  (a race = both PCs have asked the database "does this WO have a list yet?" before either has saved — two people
//   tapping within a second of each other. Done here by holding each PC just after its check.)
//  R4 lsLiveFor: the database question is written correctly for WO numbers with commas, spaces, quotes, braces
//  R5 Update template clash → ↻ Reload → Update again; and two Updates at the same moment
//  R6 360 px phone: the "From an Excel upload: ✓ Use …" buttons fit
// Run: node tests/stage3/flow-attack2-race.test.js
const F = require('./fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 600))); };
const wait = async (fn, ms = 6000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
const CH = 'CAIRN HOMES - CHERRYWOOD PHASE 2';
function server() {
  const o = (wo, title, x) => H.order(Object.assign({ wo, title, customer: CH, step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-15', origDueDate: '2026-12-15', plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [o('WO-1', 'HOUSE 14 - TYPE B KITCHEN', { unit: '14' }), o('WO-2', 'HOUSE 15 TYPE B KITCHEN', { unit: '15' })];
  const S = F.makeServer(row);
  D.insert(S.db, 'projects', { id: 'P1', name: 'Cherrywood Phase 2', customer: 'Cairn Homes' });
  D.insert(S.db, 'project_materials', { id: 'M1', project_id: 'P1', name: 'MFC White', kind: 'sheet' });
  F.seedList(S, 'T1', { name: 'Type B kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed', source: 'template' } });
  F.seedList(S, 'X14', { name: 'House 14', wos: [], list: { source: 'excel' } });
  F.seedList(S, 'X14b', { name: 'House 14 (revised)', wos: [], list: { source: 'excel' } });
  return S;
}
const made = (S, wo) => S.db.t.lists.filter(l => (l.wos || []).includes(wo) && !l.is_template && !l.archived);
const pinUp = p => p.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why|What changed/.test(m) ? 'edit' : 'Tester'; window.confirm = () => true; setWho('Tester'); });
// hold this PC just after its "does the WO have a list?" answer arrives
const gate = p => p.evaluate(() => { const orig = lsLiveFor; window.__got = 0; window.__gate = new Promise(r => { window.__open = r; }); lsLiveFor = async w => { const r = await orig(w); window.__got++; await window.__gate; return r; }; });
const both = async (a, b) => { await wait(async () => (await a.page.evaluate(() => window.__got)) > 0 && (await b.page.evaluate(() => window.__got)) > 0, 4000); await a.page.evaluate(() => window.__open()); await b.page.evaluate(() => window.__open()); };
const clickUse = (p, wo, lid) => p.evaluate(async ({ wo, lid }) => { showTab('l'); await lsPoll(); render(); await new Promise(r => setTimeout(r, 50)); const b = document.querySelector('[data-ltixl="' + wo + '|' + lid + '"]'); if (!b) return 'no button'; b.click(); return 'ok'; }, { wo, lid });
const settle = async (...ps) => { await F.sleep(800); for (const p of ps) await p.evaluate(async () => { for (let i = 0; i < 40 && LTI.busy.size; i++) await new Promise(r => setTimeout(r, 50)); await lqSend(); }); await F.sleep(300); };
(async () => {
  const browser = await H.chromium.launch();
  // ---- R1 Confirm vs Use
  {
    const S = server(); const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office'); await pinUp(a.page); await pinUp(b.page);
    const offered = await b.page.evaluate(async () => { showTab('l'); await lsPoll(); render(); return [...document.querySelectorAll('[data-ltixl]')].map(x => x.dataset.ltixl); });
    rec('R1 setup: the Excel list "House 14" is offered on WO-1 as "✓ Use"', offered.includes('WO-1|X14'), JSON.stringify(offered));
    await gate(a.page); await gate(b.page);
    await a.page.evaluate(() => { window.__r = confirmList('WO-1', 'T1', 'Ann').then(l => l.id + (l.already ? ' (already)' : '')).catch(e => 'ERR ' + e.message); });
    const cu = await clickUse(b.page, 'WO-1', 'X14');
    await both(a, b); await settle(a.page, b.page);
    const ra = await a.page.evaluate(() => window.__r);
    rec('R1 ✓ Confirm on PC A and "✓ Use House 14" on PC B at the same moment: still ONE live list for WO-1 (the saw would cut it twice)', made(S, 'WO-1').length === 1, JSON.stringify({ cu, ra, lists: made(S, 'WO-1').map(l => l.id + ':' + l.name) }));
    rec('no page errors (R1)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  // ---- R2 Confirm vs template dialog
  {
    const S = server(); const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office'); await pinUp(a.page); await pinUp(b.page);
    await gate(a.page); await gate(b.page);
    await a.page.evaluate(() => { window.__r = confirmList('WO-2', 'T1', 'Ann').then(l => l.id).catch(e => 'ERR ' + e.message); });
    await b.page.evaluate(async () => { await lsPoll(); lsTplDlg('T1', 'WO-2'); document.getElementById('tp-go').click(); });
    await both(a, b); await settle(a.page, b.page);
    const eb = await b.page.evaluate(() => (document.getElementById('tp-err') || {}).textContent || '(dialog closed)');
    rec('R2 ✓ Confirm on PC A and template dialog "Create & attach" on PC B at the same moment: ONE live list for WO-2', made(S, 'WO-2').length === 1, JSON.stringify({ ra: await a.page.evaluate(() => window.__r), eb, lists: made(S, 'WO-2').map(l => l.id) }));
    await a.close(); await b.close();
  }
  // ---- R3 two different Excel lists "used" for the same WO on two PCs
  {
    const S = server(); const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office'); await pinUp(a.page); await pinUp(b.page);
    const oa = await a.page.evaluate(async () => { showTab('l'); await lsPoll(); render(); return [...document.querySelectorAll('[data-ltixl]')].map(x => x.dataset.ltixl); });
    await gate(a.page); await gate(b.page);
    const ca = await clickUse(a.page, 'WO-1', 'X14'), cb = await clickUse(b.page, 'WO-1', 'X14b');
    await both(a, b); await settle(a.page, b.page);
    rec('R3 "✓ Use House 14" on PC A and "✓ Use House 14 (revised)" on PC B at the same moment: ONE live list for WO-1', made(S, 'WO-1').length === 1, JSON.stringify({ oa, ca, cb, lists: made(S, 'WO-1').map(l => l.id) }));
    // sequential (no race): second PC not refreshed taps Use on the other Excel list → refused
    const S2 = server(); const c = await F.dev(browser, S2, 'office'), d = await F.dev(browser, S2, 'office'); await pinUp(c.page); await pinUp(d.page);
    await d.page.evaluate(async () => { showTab('l'); await lsPoll(); render(); });
    await clickUse(c.page, 'WO-1', 'X14'); await settle(c.page);
    const db = await d.page.evaluate(async () => { const b = document.querySelector('[data-ltixl="WO-1|X14b"]'); if (!b) return 'no button'; b.click(); for (let i = 0; i < 40 && LTI.busy.size; i++) await new Promise(r => setTimeout(r, 50)); await lqSend(); return document.getElementById('toast').textContent; });
    rec('R3b PC not refreshed taps "✓ Use" on the other Excel list after PC A used one: refused, told which list WO-1 has', made(S2, 'WO-1').length === 1 && /already has a cutting list/.test(db), JSON.stringify({ db, lists: made(S2, 'WO-1').map(l => l.id) }));
    await a.close(); await b.close(); await c.close(); await d.close();
  }
  // ---- R4 lsLiveFor query for odd WO numbers (decoded and parsed as Postgres would read the array literal)
  {
    const S = server(); const a = await F.dev(browser, S, 'office');
    const out = await a.page.evaluate(async () => {
      const ids = ['WO-26-1234', 'WO 26 1234', 'WO-1,2', 'WO-"7"', "O'GRADY-1", 'WO-{9}', 'WO\\5', 'WO-26-1234 ', 'NULL', 'wo-é€'];
      const orig = lsGet, seen = []; lsGet = async q => { seen.push(q); return []; };
      for (const w of ids) await lsLiveFor(w);
      lsGet = orig;
      // a small Postgres array-literal reader: {a,"b c","d\"e"} → ['a','b c','d"e']; unquoted NULL → null
      const parse = s => { if (s[0] !== '{' || s[s.length - 1] !== '}') return ['BAD']; const o = []; let i = 1; while (i < s.length - 1) { let v = ''; if (s[i] === '"') { i++; while (s[i] !== '"') { if (s[i] === '\\') i++; v += s[i++]; } i++; o.push(v); } else { while (s[i] !== ',' && s[i] !== '}') v += s[i++]; o.push(/^null$/i.test(v.trim()) ? null : v.trim()); } if (s[i] === ',') i++; } return o; };
      return ids.map((w, k) => { const m = /wos=cs\.(.*)$/.exec(seen[k]); const lit = m ? decodeURIComponent(m[1]) : ''; const p = parse(lit); return { w, lit, ok: p.length === 1 && p[0] === w }; });
    });
    const bad = out.filter(x => !x.ok);
    rec('R4 the "does this WO have a list?" question names exactly that WO for commas, spaces, quotes, braces, backslash, apostrophe, trailing space, € (else the check finds nothing and a second list is made)', bad.filter(x => x.w !== 'NULL').length === 0, JSON.stringify(bad));
    rec('R4b a WO literally called "NULL" is quoted (Postgres reads unquoted NULL as no value) — information only, unlikely in Cienapps', !bad.some(x => x.w === 'NULL'), JSON.stringify(bad.filter(x => x.w === 'NULL')));
    await a.close();
  }
  // ---- R5 Update template: clash → Reload → Update; and two Updates at the same moment
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'TD', { name: 'Type B kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B kitchen' } });
    F.seedList(S, 'LD1', { name: 'House 1', wos: ['WO-1'], lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Plinth Ann', '1', 2400, 150, 'MFC White', '', '']] });
    F.seedList(S, 'LD2', { name: 'House 2', wos: ['WO-2'], lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Cornice Bob', '1', 2400, 80, 'MFC White', '', '']] });
    F.seedList(S, 'LD3', { name: 'House 3', wos: ['WO-3'], lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Pelmet Cat', '1', 2400, 60, 'MFC White', '', '']] });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office'), c = await F.dev(browser, S, 'office');
    for (const x of [a, b, c]) await pinUp(x.page);
    const open = (p, id) => p.evaluate(async id => { lsSaveAsTpl({ id }); await new Promise(r => setTimeout(r, 300)); const n = document.getElementById('at-name'); n.value = 'Type B kitchen'; n.oninput({ target: n }); return document.getElementById('at-ok').textContent; }, id);
    const parts = () => S.db.t.list_lines.filter(x => x.list_id === 'TD' && x.removed_rev == null).map(x => x.part);
    await open(a.page, 'LD1'); await open(b.page, 'LD2');
    await a.page.evaluate(() => document.getElementById('at-ok').click()); await wait(() => D.find(S.db, 'lists', 'TD').rev === 2);
    await b.page.evaluate(() => document.getElementById('at-ok').click()); await F.sleep(1000);
    const hasRl = await b.page.evaluate(() => !!document.getElementById('at-reload'));
    rec('R5 Bob (stale Rev 1) is stopped with a ↻ Reload button; Ann\'s Rev 2 untouched', hasRl && parts().includes('Plinth Ann') && D.find(S.db, 'lists', 'TD').rev === 2, JSON.stringify({ hasRl, parts: parts() }));
    await b.page.evaluate(() => document.getElementById('at-reload').click()); await F.sleep(300);
    const after = await b.page.evaluate(() => ({ ok: (document.getElementById('at-ok') || {}).textContent, txt: (document.querySelector('.pod-ovl') || {}).innerText || '' }));
    rec('R5 after ↻ Reload the dialog offers "Update template → Rev 3" (it now knows Rev 2)', /Rev 3/.test(after.ok || ''), JSON.stringify(after.ok));
    rec('R5 after ↻ Reload the dialog still shows what changed in Rev 2 (Ann\'s "Plinth Ann" — the Reload button says "show Rev 2, then decide")', /Plinth Ann/.test(after.txt), after.txt.slice(0, 400));
    // Cat updates to Rev 3 while Bob is deciding → Bob's second Update must be stopped again, not overwrite Cat
    await c.page.evaluate(async () => { await lsPoll(); }); await open(c.page, 'LD3'); await c.page.evaluate(() => document.getElementById('at-ok').click()); await wait(() => D.find(S.db, 'lists', 'TD').rev === 3);
    await b.page.evaluate(() => document.getElementById('at-ok').click()); await F.sleep(1000);
    const tb = await b.page.evaluate(() => (document.getElementById('at-err') || {}).textContent || '');
    rec('R5 Bob reloaded at Rev 2, Cat then made Rev 3: Bob\'s Update is stopped again (Cat\'s Pelmet kept)', parts().includes('Pelmet Cat') && /Rev 3|meanwhile|another/i.test(tb), JSON.stringify({ parts: parts(), rev: D.find(S.db, 'lists', 'TD').rev, tb }));
    // reload again and update for real → Rev 4 with Bob's rows (the person decided)
    await b.page.evaluate(() => { const r = document.getElementById('at-reload'); if (r) r.click(); }); await F.sleep(300);
    await b.page.evaluate(() => { const o = document.getElementById('at-ok'); if (o) o.click(); }); await wait(() => D.find(S.db, 'lists', 'TD').rev === 4);
    rec('R5 Bob reloads again and updates: Rev 4 is saved with his rows', D.find(S.db, 'lists', 'TD').rev === 4 && parts().includes('Cornice Bob'), JSON.stringify({ rev: D.find(S.db, 'lists', 'TD').rev, parts: parts() }));
    // two Updates at the very same moment (both dialogs fresh on Rev 4)
    await a.page.evaluate(async () => { await lsPoll(); }); await c.page.evaluate(async () => { await lsPoll(); });
    await open(a.page, 'LD1'); await open(c.page, 'LD3');
    S.hold3 = new Promise(r => { S.__rel = r; });
    await a.page.evaluate(() => document.getElementById('at-ok').click()); await c.page.evaluate(() => document.getElementById('at-ok').click());
    await F.sleep(300); S.__rel(); S.hold3 = null; await F.sleep(2000);
    const ea = await a.page.evaluate(() => (document.getElementById('at-err') || {}).textContent || 'closed'), ec = await c.page.evaluate(() => (document.getElementById('at-err') || {}).textContent || 'closed');
    const rv = D.find(S.db, 'lists', 'TD').rev, pp = parts();
    rec('R5 Ann and Cat press Update at the same moment (both on Rev 4): only one becomes Rev 5, the other is told — no silent overwrite', rv === 5 && ((pp.includes('Plinth Ann') && /meanwhile|another|Rev 5/i.test(ec)) || (pp.includes('Pelmet Cat') && /meanwhile|another|Rev 5/i.test(ea))), JSON.stringify({ rv, pp, ea, ec }));
    rec('no page errors (R5)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close(); await c.close();
  }
  // ---- R6 360 px phone: Excel "✓ Use" buttons with long names
  {
    const S = server();
    F.seedList(S, 'XL', { name: 'House 14 Cherrywood Phase 2 Block C Type B Kitchen REVISED drawing 0047 final FINAL', wos: [], list: { source: 'excel' } });
    const t = await F.open(browser, S, { now: F.NOW, role: 'office', viewport: { width: 360, height: 740 } });
    await t.page.setViewportSize({ width: 360, height: 740 });
    await t.page.evaluate(async () => { localStorage.setItem('wpfOpName', 'Op'); lsReset(); await lsLoad(); showTab('l'); render(); });
    await F.sleep(300);
    const m = await t.page.evaluate(() => { const bs = [...document.querySelectorAll('[data-ltixl]')]; return { n: bs.length, over: bs.filter(b => { const r = b.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).map(b => Math.round(b.getBoundingClientRect().right)), small: bs.filter(b => b.getBoundingClientRect().height < 30).length, docW: document.documentElement.scrollWidth }; });
    rec('R6 360 px: every "✓ Use …" button is on screen (no sideways scroll), at least 30 px tall to tap', m.n >= 3 && !m.over.length && m.docW <= 362 && !m.small, JSON.stringify(m));
    await t.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
})().catch(e => { console.error(e); process.exit(1); });
