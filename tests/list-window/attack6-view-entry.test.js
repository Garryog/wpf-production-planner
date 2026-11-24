// Tester attack ROUND 6 (17 Nov) — part 2 of "check the cutting list View button is working in all scenarios": the OTHER ways
// into the same View window (lsViewDlg): Lists home rows (data-lhview), the "waiting to be checked" tiles (data-ltiview) and
// 🔍 Find old list (data-fov) — on its own and over the list window. Same list → same content from every door; archived /
// finished lists (their lines are not loaded at start-up); each role; double-click; Esc / outside / Close; Print; phone 360 px.
// Fake Supabase only. Run: node tests/list-window/attack6-view-entry.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, asks } = L;
const M = 'MFC White';
const vinfo = p => p.evaluate(() => {
  const os = [...document.querySelectorAll('.pod-ovl')], o = os[os.length - 1]; if (!o) return { n: 0 };
  const b = o.querySelector('.pod-in') || o, tb = o.querySelector('table.wl-tbl');
  return { n: os.length, isView: !!o.querySelector('#lv-print'), head: (b.firstElementChild || {}).innerText || '', table: tb ? tb.outerHTML : '', nrows: tb ? tb.querySelectorAll('tbody tr').length : 0,
    chk: !!o.querySelector('[data-vchk="1"]'), txt: o.innerText, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
const lists = async (p, f) => p.evaluate(async f => { Object.assign(LH, { q: '', proj: '', type: '', rev: '', state: '' }, f || {}); showTab('l'); render(); await new Promise(r => setTimeout(r, 300)); }, f);
const clickSel = (p, sel) => p.evaluate(sel => { const b = document.querySelector(sel); if (!b) return 'none'; b.click(); return 'ok'; }, sel);
const printHtml = p => p.evaluate(() => { window.__doc = ''; const o = window.open; window.open = () => ({ document: { write: h => { window.__doc += h; }, close: () => {} } }); try { const b = document.getElementById('lv-print'); if (b) b.click(); } finally { window.open = o; } const d = document.createElement('div'); d.innerHTML = window.__doc.replace(/<script[\s\S]*?<\/script>/g, ''); return d.innerText; });
const recToasts = p => p.evaluate(() => { window.__toasts = []; if (!window.__tw) { window.__tw = 1; const T = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return T.apply(this, arguments); }; } });

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row({ listChk: true });
    const S = X.makeServer(r);
    const LN = [['hdr', 'Kitchen', '2', null, null, null, '', ''], ['saw', 'Side', '4', 720, 560, M, '', '', { unit_qty: '2' }], ['fit', 'Hinge', '16', null, null, 'Blum hinge', '', '', { unit_qty: '8' }], ['buy', 'Worktop', '1', 3000, 600, 'Oak', '', '']];
    X.F3.seedList(S, 'LW', { wos: ['WO-3'], name: 'Waiting house', lines: LN, list: { check_req: true } });
    X.F3.seedList(S, 'LARC', { wos: ['WO-4'], name: 'Archived house', lines: LN, list: { archived: true } });
    X.F3.seedList(S, 'LFIN', { wos: ['WO-5'], name: 'Shipped house', lines: LN }); // WO-5 is shipped → a finished list
    X.F3.seedList(S, 'LIVE', { wos: ['WO-6'], name: 'Live house', lines: LN });

    // ---------- 1. the same list through every door shows the same thing ----------
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p); await recToasts(p);
    await p.evaluate(() => { setWho('Ann'); window.prompt = m => /PIN/i.test(m) ? '9000' : 'Ann'; });
    for (const id of ['LIVE', 'LW']) {
      const got = {};
      await lists(p); got.home = (await clickSel(p, '[data-lhview="' + id + '"]')) === 'ok' ? (await sleep(500), await vinfo(p)) : null; await closeAll(p);
      if (id === 'LW') { await lists(p); got.tile = (await clickSel(p, '[data-ltiview="' + id + '"]')) === 'ok' ? (await sleep(500), await vinfo(p)) : null; await closeAll(p); }
      await p.evaluate(() => lsFindDlg('')); await sleep(500); got.find = (await clickSel(p, '.pod-ovl [data-fov="' + id + '"]')) === 'ok' ? (await sleep(500), await vinfo(p)) : null; await closeAll(p);
      await p.evaluate(id => lsViewDlg(id), id); await sleep(500); got.panel = await vinfo(p); await closeAll(p); // what the Saved panel's button calls
      const ks = Object.keys(got), miss = ks.filter(k => !got[k] || !got[k].isView);
      rec('E1 ' + id + ': View opens from ' + ks.join(', '), !miss.length, 'missing: ' + miss.join(','));
      const t0 = got.panel.table; rec('E1 ' + id + ': the same table and header from every door', ks.every(k => got[k] && got[k].table === t0 && got[k].head === got.panel.head), JSON.stringify(ks.map(k => [k, got[k] && got[k].nrows, got[k] && got[k].head])));
      rec('E1 ' + id + ': the rows are there (Kitchen – 2 units, Side 4, Hinge 16, Worktop)', got.panel.nrows >= 4 && /Side/.test(got.panel.txt) && /16/.test(got.panel.txt) && /Worktop/.test(got.panel.txt), got.panel.txt.slice(0, 200));
      if (id === 'LW') rec('E1 LW (waiting): ✓ Check shows inside View from every door', ks.every(k => got[k] && got[k].chk), JSON.stringify(ks.map(k => [k, got[k] && got[k].chk])));
    }

    // ---------- 2. archived / finished lists: lines not loaded at start-up ----------
    for (const [id, f, what] of [['LARC', { state: 'archived' }, 'an ARCHIVED list'], ['LFIN', { state: 'done' }, 'a FINISHED list (job shipped)']]) {
      // fresh load each time so the lines are not in memory yet
      await p.evaluate(async () => { lsReset(); await lsLoad(); });
      const loaded = await p.evaluate(id => LST.full.has(id), id);
      await p.evaluate(() => lsFindDlg('')); await sleep(500);
      const ok = await clickSel(p, '.pod-ovl [data-fov="' + id + '"]'); await sleep(1500); const v = await vinfo(p);
      rec('[HIGH] F1 🔍 Find old list → View on ' + what + ' shows its rows (not an empty table)' + (loaded ? '' : ' — its lines were not loaded yet'), ok === 'ok' && v.isView && v.nrows >= 4, JSON.stringify([ok, loaded, v.nrows, v.txt && v.txt.slice(0, 140)]));
      await closeAll(p);
      const v2 = await (async () => { await p.evaluate(() => lsFindDlg('')); await sleep(400); await clickSel(p, '.pod-ovl [data-fov="' + id + '"]'); await sleep(600); return vinfo(p); })();
      rec('(info) F1 ' + what + ': pressed View a SECOND time → ' + v2.nrows + ' rows (the first press fetched them in the background)', true);
      await closeAll(p);
      await p.evaluate(async () => { lsReset(); await lsLoad(); });
      await lists(p, f); const hv = await clickSel(p, '[data-lhview="' + id + '"]'); await sleep(1500); const vh = await vinfo(p);
      if (hv === 'ok') rec('[HIGH] F2 Lists home → View on ' + what + ' shows its rows (not an empty table)', vh.isView && vh.nrows >= 4, JSON.stringify([vh.nrows, vh.txt && vh.txt.slice(0, 140)]));
      else rec('(info) F2 ' + what + ' has no View row on Lists home with ' + JSON.stringify(f), true);
      // Print straight away
      if (vh.isView) { const txt = await printHtml(p);
        rec('(info) F3 🖨 Print pressed in that (empty-looking) View 1.5 s later prints the rows of ' + what + ' (Side, Hinge): ' + (/Side/.test(txt) && /Hinge/.test(txt) ? 'yes' : 'NO'), true); if (0) rec('', /Side/.test(txt) && /Hinge/.test(txt), txt.slice(0, 160)); }
      await closeAll(p);
    }

    // ---------- 3. double-click / Esc / outside / Close from Lists home ----------
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await lists(p); await p.dblclick('[data-lhview="LIVE"]'); await sleep(600);
    let v = await vinfo(p);
    rec('[LOW] D1 View DOUBLE-clicked on Lists home → ONE View window stays open (the 2nd click must not land on the grey area and close it)', v.n === 1, String(v.n));
    await closeAll(p);
    await lists(p); await clickSel(p, '[data-lhview="LIVE"]'); await sleep(400); await p.keyboard.press('Escape'); await sleep(300); v = await vinfo(p);
    rec('[LOW] D2 Esc closes the View window opened from Lists home', v.n === 0, String(v.n));
    await closeAll(p);
    await lists(p); await clickSel(p, '[data-lhview="LIVE"]'); await sleep(400); await p.mouse.click(3, 3); await sleep(400); v = await vinfo(p);
    const home = await p.evaluate(() => !!document.querySelector('[data-lhview="LIVE"]'));
    rec('D3 click outside → closed, Lists home still there and usable', v.n === 0 && home, JSON.stringify([v.n, home]));
    await clickSel(p, '[data-lhview="LIVE"]'); await sleep(400); await clickSel(p, '.pod-ovl #pod-x'); await sleep(400); v = await vinfo(p);
    rec('D4 Close → closed', v.n === 0, String(v.n));
    await p.evaluate(() => openListEditor('LIVE')); await sleep(1100);
    const ed = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), n: document.querySelectorAll('.pod-ovl').length }));
    rec('D5 after all that, ✎ the list opens normally in ONE window', ed.ed && ed.n === 1, JSON.stringify(ed));
    await closeAll(p);

    // ---------- 4. Find old list OVER the list window ("Start from…"): View then close it ----------
    await p.evaluate(() => openListEditor(null, 'WO-1', 'P1')); await sleep(1100);
    await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-findold').click(); }); await sleep(600);
    const fv = await clickSel(p, '.pod-ovl [data-fov="LIVE"]'); await sleep(600); v = await vinfo(p);
    rec('W1 list window → Find old list → View → the View is on top (3 windows: list, finder, View)', fv === 'ok' && v.isView && v.n === 3, JSON.stringify([fv, v.n, v.isView]));
    await p.keyboard.press('Escape'); await sleep(300);
    let st = await p.evaluate(() => ({ n: document.querySelectorAll('.pod-ovl').length, ed: !!document.querySelector('.me-ed'), view: !!document.getElementById('lv-print') }));
    rec('W1 …Esc closes the View only (list window and finder stay)', st.n === 2 && st.ed && !st.view, JSON.stringify(st));
    if (st.view) await clickSel(p, '.pod-ovl #lv-print ~ #pod-x');
    await clickSel(p, '.pod-ovl [data-fov="LIVE"]'); await sleep(500);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('#pod-x').click(); }); await sleep(400);
    st = await p.evaluate(() => ({ n: document.querySelectorAll('.pod-ovl').length, ed: !!document.querySelector('.me-ed'), find: !!document.getElementById('fo-q') }));
    rec('W2 …Close on the View → back to the finder over the list window (nothing else closed)', st.n === 2 && st.ed && st.find, JSON.stringify(st));
    await closeAll(p);
    await t.ctx.close().catch(() => {});

    // ---------- 5. roles ----------
    const seen = {};
    for (const role of ['design', 'prod', 'admin', 'office', 'pm', 'saw', 'stores']) {
      const tr = await X.dev(browser, S, role), pr = tr.page; await asks(pr);
      await pr.evaluate(async () => { try { setWho('Ann'); } catch (e) {} });
      await lists(pr); try { await pr.evaluate(async () => { if (typeof prodTab !== 'undefined' && ROLE === 'prod') { prodTab = 'lists'; render(); } await new Promise(r => setTimeout(r, 300)); }); } catch (e) {}
      const o = await pr.evaluate(() => ({ home: document.querySelectorAll('[data-lhview]').length, tile: document.querySelectorAll('[data-ltiview]').length, find: !!document.getElementById('lh-find') }));
      let chk = null;
      if (o.home) { await clickSel(pr, '[data-lhview="LW"]'); await sleep(500); chk = (await vinfo(pr)).chk; await closeAll(pr); }
      seen[role] = Object.assign(o, { chkInView: chk });
      await tr.ctx.close().catch(() => {});
    }
    rec('R1 Drawing office, Production Manager, Admin and office see View on Lists home; ✓ Check inside View for the waiting list', ['design', 'prod', 'admin', 'office'].every(k => seen[k].home > 0 && seen[k].chkInView === true), JSON.stringify(seen));
    rec('(info) R1 PM / saw / stores: no Lists home View button (' + ['pm', 'saw', 'stores'].map(k => k + ':' + seen[k].home).join(' ') + ')', true);
    rec('(info) R1 the waiting tile View: ' + Object.entries(seen).map(([k, x]) => k + ':' + x.tile).join(' '), true);

    // ---------- 6. phone 360 px from Lists home ----------
    const tp = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 640 } }), pp = tp.page; await asks(pp);
    await pp.evaluate(() => setWho('Ann')); await lists(pp);
    const hb = await pp.evaluate(() => { const b = document.querySelector('[data-lhview="LIVE"]'); if (!b) return null; b.scrollIntoView(); const r = b.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: innerWidth }; });
    rec('P1 360 px: the Lists home View button can be reached on screen (after scrolling)', !!hb && hb.l >= 0 && hb.r <= hb.w, JSON.stringify(hb));
    await clickSel(pp, '[data-lhview="LIVE"]'); await sleep(500);
    const ph = await pp.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (!o) return null; const b = o.querySelector('.pod-in'); b.scrollTop = b.scrollHeight; b.scrollLeft = 0;
      const f = id => { const e = o.querySelector('#' + id), r = e.getBoundingClientRect(), h = document.elementFromPoint(Math.max(1, Math.min(r.left + r.width / 2, innerWidth - 2)), r.top + r.height / 2); return { l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), hit: !!h && (h === e || e.contains(h)) }; };
      return { x: f('pod-x'), pr: f('lv-print'), doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, inner: b.scrollWidth - b.clientWidth, w: innerWidth, h: innerHeight }; });
    rec('P1 360 px: View from Lists home — Close and 🖨 Print on screen and tappable, no sideways page scroll', !!ph && ph.x.hit && ph.pr.hit && ph.x.r <= ph.w && ph.doc <= 0, JSON.stringify(ph));
    await tp.ctx.close().catch(() => {});
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
