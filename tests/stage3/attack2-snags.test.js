// ATTACK 2 — snags: saw-only snag lists and when they count finished, overlapping transfers, cancel races, bad
// deliver-by dates, nasty text, quantities, phone width 360px. Fake Supabase only (srv3.js) — nothing reaches the live project.
// Run: node tests/stage3/attack2-snags.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
const pidOf = s => s.id;
async function addSnag(p, f) {
  return p.evaluate(f => {
    if (!document.getElementById('sn-form')) document.getElementById('sn-new').click();
    const g = id => document.getElementById(id), set = (id, v) => { const e = g(id); e.value = v; if (e.onchange) e.onchange({ target: e }); };
    if (f.pid) set('sn-pid', f.pid);
    if (f.kind) document.querySelector('[data-snk="' + f.kind + '"]').click();
    Object.entries(f.v).forEach(([id, v]) => { if (g(id)) g(id).value = v; });
    g('sn-save').click(); return (g('sn-err') || {}).textContent || '';
  }, f);
}
const snagTab = (p, role) => p.evaluate(r => document.querySelector(r === 'pm' ? '[data-pmtab="snags"]' : '[data-prodtab="snags"]').click(), role);
async function transfer(p, ids, date) {
  return p.evaluate(({ ids, date }) => { SN.sel = new Set(ids); render(); window.prompt = () => date; const b = document.getElementById('sn-tolist'); if (!b) return 'no button'; b.click(); return 'ok'; }, { ids, date });
}
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { wos: ['WO-1'] });
  const pr = await F.dev(browser, S, 'prod');
  await snagTab(pr.page, 'prod');
  // nasty text everywhere
  const NASTY = { item: `O'Grady <img src=x onerror="window.__x=1"> "door" 😀`, where: `Blk "C" & <script>window.__x=2</script> Apt 3½`, note: `it's <b>bold</b> 🚪`, edge: `1mm <i>ABS</i>` };
  const e1 = await addSnag(pr.page, { v: { 'sn-where': NASTY.where, 'sn-item': NASTY.item, 'sn-qty': '2', 'sn-L': '720', 'sn-W': '400', 'sn-mat': 'M1', 'sn-edge': NASTY.edge, 'sn-note': NASTY.note } });
  await F.sleep(300);
  const s1 = S.db.t.snags.find(s => s.item === NASTY.item);
  rec('N1 snag with HTML / quotes / apostrophe / emoji is saved exactly as typed', !!s1 && s1.where_text === NASTY.where && s1.note === NASTY.note && s1.edging === NASTY.edge, e1 + ' ' + JSON.stringify(s1));
  const shown = await pr.page.evaluate(() => ({ x: window.__x || 0, txt: document.querySelector('.pg').innerText }));
  rec('N2 snags screen shows the text, runs nothing', shown.x === 0 && shown.txt.includes(`O'Grady <img`) && shown.txt.includes('😀') && shown.txt.includes('Apt 3½'), 'x=' + shown.x);
  // quantities
  const eNeg = await addSnag(pr.page, { v: { 'sn-item': 'Neg', 'sn-qty': '-2', 'sn-L': '100', 'sn-W': '100', 'sn-mat': 'M1' } });
  const eZero = await addSnag(pr.page, { v: { 'sn-item': 'Zero', 'sn-qty': '0', 'sn-L': '100', 'sn-W': '100', 'sn-mat': 'M1' } });
  rec('Q1 snag quantity 0 or negative is refused', /quantity/i.test(eNeg) && /quantity/i.test(eZero) && !S.db.t.snags.some(s => ['Neg', 'Zero'].includes(s.item)), eNeg + ' | ' + eZero);
  await pr.page.evaluate(() => { SN.form = false; render(); });
  const eHalf = await addSnag(pr.page, { v: { 'sn-item': 'Half', 'sn-qty': '1.5', 'sn-L': '100', 'sn-W': '-50', 'sn-mat': 'M1' } });
  await F.sleep(300);
  const half = S.db.t.snags.find(s => s.item === 'Half');
  rec('Q2 (info) qty 1.5 and a negative width: what is stored', true, 'err=' + JSON.stringify(eHalf) + ' stored=' + JSON.stringify(half && { qty: half.qty, W: half.width_mm }));
  // a snag on a project with NO sheet materials: saved with no material — free typing impossible either way
  D.insert(S.db, 'projects', { id: 'P2', name: 'Crown' });
  await pr.page.evaluate(async () => { await lsPoll(); SN.form = false; render(); });
  const fe = await pr.page.evaluate(() => { document.getElementById('sn-new').click(); const s = document.getElementById('sn-pid'); s.value = 'P2'; s.onchange({ target: s }); const m = document.getElementById('sn-mat'); return { tag: m && m.tagName, opts: m ? m.options.length : -1 }; });
  rec('F1 snag material is a dropdown (no free typing) — on a project with no sheet materials it has only the blank choice', fe.tag === 'SELECT' && fe.opts === 1, JSON.stringify(fe));
  await pr.page.evaluate(() => { SN.form = false; SN.pid = 'P1'; render(); });
  // ---- saw-only snag list: when does it count finished?
  await pr.page.evaluate(async () => { await lsPoll(); render(); });
  const r1 = await transfer(pr.page, [s1.id], '2026-10-23');
  await F.sleep(700);
  const sl = S.db.t.lists.find(l => l.list_type === 'snag');
  rec('T0 transfer made a snag list', r1 === 'ok' && !!sl, r1);
  const saw = await F.dev(browser, S, 'saw');
  await saw.page.evaluate(() => { wlShowUpcoming = true; render(); });
  const sawTxt = await saw.page.evaluate(() => ({ x: window.__x || 0, t: document.body.innerText }));
  rec('N3 saw card shows the snag text (part, where — note), runs nothing', sawTxt.x === 0 && sawTxt.t.includes(`O'Grady <img`) && sawTxt.t.includes('Apt 3½'), sawTxt.t.slice(0, 0));
  await F.tapRow(saw.page, 'data-rt', sl.id + ':1'); await F.send(saw.page);
  await saw.page.evaluate(() => { window.confirm = () => true; window.prompt = () => 'Op'; });
  await saw.page.evaluate(id => { const b = document.querySelector('[data-wldone="' + id + '"]'); if (b) b.click(); }, sl.id);
  await F.sleep(300); await F.send(saw.page);
  const fin = await pr.page.evaluate(async id => { await lsPoll(); const l = lsList(id); return { saw: !!listDone(id).saw, fit: !!listDone(id).fit, state: lsState(l), finished: listFinished(l), nfit: l.fit }; }, sl.id);
  rec('T1 saw-only snag list: cut + CUT COMPLETE → counts as Done (no fittings to pick, stores never sees it)', fin.saw && fin.state === 'done', JSON.stringify(fin));
  const stores = await F.dev(browser, S, 'stores');
  const onStores = await stores.page.evaluate(id => { wlShowUpcoming = true; render(); return !!document.querySelector('[data-wldone="' + id + '"]'); }, sl.id);
  rec('T2 (info) the saw-only snag list is not on the stores queue', !onStores);
  rec('T3 the snag moved to "cut"', D.find(S.db, 'snags', s1.id).status === 'cut');
  // untick the snag line after it was cut: snag status?
  await saw.page.evaluate(async id => { await lsPoll(); }, sl.id);
  // ---- overlapping transfers: A ticks a,b; B ticks b,c
  await pr.page.evaluate(() => { SN.form = false; render(); });
  for (const it of ['SA', 'SB', 'SC']) { const e = await addSnag(pr.page, { v: { 'sn-item': it, 'sn-qty': '1', 'sn-L': '300', 'sn-W': '200', 'sn-mat': 'M1' } }); if (e) console.log('add ' + it + ': ' + e); await F.sleep(250); }
  await F.sleep(400);
  const [sa, sb, sc] = ['SA', 'SB', 'SC'].map(n => S.db.t.snags.find(s => s.item === n).id);
  const pr2 = await F.dev(browser, S, 'prod'); await snagTab(pr2.page, 'prod');
  await transfer(pr.page, [sa, sb], '2026-10-27'); await F.sleep(600);
  await transfer(pr2.page, [sb, sc], '2026-10-27'); await F.sleep(600);
  const st = [sa, sb, sc].map(id => D.find(S.db, 'snags', id).status);
  const t2 = await pr2.page.evaluate(() => document.getElementById('toast').textContent);
  rec('O1 overlapping transfers: B is refused as a whole and told; SC is still raised, nothing doubled', st.join() === 'on-list,on-list,raised' && /already moved/.test(t2), st.join() + ' toast=' + t2);
  await transfer(pr2.page, [sc], '2026-10-27'); await F.sleep(600);
  rec('O2 B can then transfer SC on its own', D.find(S.db, 'snags', sc).status === 'on-list');
  const sl27 = S.db.t.lists.filter(l => l.list_type === 'snag' && l.deliver_by === '2026-10-27');
  rec('O3 (info) two snag lists for the same project and day exist after A then B (separate lists, same name)', true, sl27.map(l => l.name).join(' | '));
  // ---- PM cancels while Production Manager transfers (PM's screen fresh, prod's screen stale)
  await addSnag(pr.page, { v: { 'sn-item': 'SD', 'sn-qty': '1', 'sn-L': '300', 'sn-W': '200', 'sn-mat': 'M1' } }); await F.sleep(400);
  const sd = S.db.t.snags.find(s => s.item === 'SD').id;
  const pm = await F.dev(browser, S, 'pm'); await snagTab(pm.page, 'pm');
  await pr.page.evaluate(async () => { await lsPoll(); render(); });
  await pm.page.evaluate(id => { window.confirm = () => true; document.querySelector('[data-sncan="' + id + '"]').click(); }, sd); await F.sleep(400);
  await transfer(pr.page, [sd], '2026-10-27'); await F.sleep(600);
  rec('X1 cancelled by the PM a moment before the transfer → transfer refused, snag stays cancelled, no list line', D.find(S.db, 'snags', sd).status === 'cancelled' && !S.db.t.list_lines.some(x => x.snag_id === sd));
  // stale PM screen cancels a snag already transferred
  await addSnag(pr.page, { v: { 'sn-item': 'SE', 'sn-qty': '1', 'sn-L': '300', 'sn-W': '200', 'sn-mat': 'M1' } }); await F.sleep(400);
  const se = S.db.t.snags.find(s => s.item === 'SE').id;
  await pm.page.evaluate(async () => { await lsPoll(); render(); });
  await transfer(pr.page, [se], '2026-10-27'); await F.sleep(600);
  await pm.page.evaluate(id => { window.confirm = () => true; const b = document.querySelector('[data-sncan="' + id + '"]'); if (b) b.click(); }, se); await F.sleep(400);
  rec('X2 a stale PM screen cannot cancel a snag that is already on a list', D.find(S.db, 'snags', se).status === 'on-list', D.find(S.db, 'snags', se).status);
  // ---- deliver-by typed wrong
  await addSnag(pr.page, { v: { 'sn-item': 'SF', 'sn-qty': '1', 'sn-L': '300', 'sn-W': '200', 'sn-mat': 'M1' } }); await F.sleep(400);
  const sf = S.db.t.snags.find(s => s.item === 'SF').id;
  const nL = S.db.t.lists.length;
  await transfer(pr.page, [sf], '2026-13-45'); await F.sleep(600);
  rec('D1 deliver-by "2026-13-45" (impossible date): nothing made, snag still raised', S.db.t.lists.length === nL && D.find(S.db, 'snags', sf).status === 'raised', 'toast=' + await pr.page.evaluate(() => document.getElementById('toast').textContent));
  await transfer(pr.page, [sf], '2025-10-23'); await F.sleep(600);
  rec('D2 deliver-by a year in the past (typo 2025): app should question it — it makes an instantly-overdue list silently', D.find(S.db, 'snags', sf).status === 'raised', 'snag=' + D.find(S.db, 'snags', sf).status);
  // ---- untick the snag line after it was cut: does the snag go back to on-list?
  const snl = S.db.t.list_lines.find(x => x.snag_id === sa);
  await saw.page.evaluate(async () => { await lsPoll(); wlShowUpcoming = true; render(); });
  await F.tapRow(saw.page, 'data-rt', snl.id); await F.send(saw.page);
  const afterCut = D.find(S.db, 'snags', sa).status;
  await saw.page.evaluate(async () => { await lsPoll(); render(); });
  await F.tapRow(saw.page, 'data-rt', snl.id); await F.send(saw.page);
  rec('U1 snag line cut then unticked (mis-tap): snag should go back to "on a list", not stay "cut"', afterCut === 'cut' && D.find(S.db, 'snags', sa).status === 'on-list', 'after cut=' + afterCut + ' after untick=' + D.find(S.db, 'snags', sa).status + ' line=' + D.find(S.db, 'list_lines', snl.id).status);
  // ---- phone width 360px: Snags form on the PM view
  const ph = await F.dev(browser, S, 'pm', { viewport: { width: 360, height: 760 } });
  await snagTab(ph.page, 'pm');
  const wd = await ph.page.evaluate(() => { document.getElementById('sn-new').click(); const r = id => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().right) : -1; };
    return { sw: document.documentElement.scrollWidth, save: r('sn-save'), where: r('sn-where'), item: r('sn-item'), mat: r('sn-mat'), strip: document.getElementById('pm-strip').scrollWidth,
      wide: [...document.querySelectorAll('.pg *')].filter(e => e.getBoundingClientRect().right > 362).map(e => e.tagName + '.' + String(e.className).slice(0, 12) + ':' + (e.textContent || '').slice(0, 30)).slice(0, 3) }; });
  rec('W1 360px PM Snags form: no sideways scrolling, Save and every field on screen', wd.sw <= 360 && [wd.save, wd.where, wd.item, wd.mat].every(x => x > 0 && x <= 360), JSON.stringify(wd));
  // 360px: saw "Waiting for a list" strip and Lists home (Production Manager → Lists)
  const sw = await F.dev(browser, S, 'saw', { viewport: { width: 360, height: 760 } });
  const ws = await sw.page.evaluate(() => { const w = document.getElementById('wait-list'); return { has: !!w, sw: document.documentElement.scrollWidth, strip: w ? Math.round(w.getBoundingClientRect().right) : -1, txt: w ? [...w.querySelectorAll('.dsh-x')].map(e => Math.round(e.getBoundingClientRect().right)).join() : '' }; });
  rec('W2 360px saw: "Waiting for a list" strip fits the screen (no sideways scrolling)', ws.has && ws.sw <= 360, JSON.stringify(ws));
  const lh = await F.dev(browser, S, 'prod', { viewport: { width: 360, height: 760 } });
  await lh.page.evaluate(() => document.querySelector('[data-prodtab="lists"]').click()); await F.sleep(200);
  const lw = await lh.page.evaluate(() => { const t = document.querySelector('#lh .lst-tbl'); const e = document.querySelector('[data-lhedit]'); return { sw: document.documentElement.scrollWidth, tbl: t ? Math.round(t.getBoundingClientRect().right) : -1, edit: e ? Math.round(e.getBoundingClientRect().right) : -1 }; });
  rec('W3 360px Lists home: the list table fits or scrolls inside its box; Edit button reachable without the page scrolling sideways', lw.sw <= 360 && lw.edit > 0 && lw.edit <= 360, JSON.stringify(lw));
  await sw.close(); await lh.close();
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  await pr.close(); await pr2.close(); await saw.close(); await stores.close(); await pm.close(); await ph.close();
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
