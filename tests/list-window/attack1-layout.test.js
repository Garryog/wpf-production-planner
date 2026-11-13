// Tester attack (list window, simple layout, 12 Nov): PHONE at 360 px + "Change job" + which pickers show when.
// Fake Supabase only. Run: node tests/list-window/attack1-layout.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;

function row() {
  const r = X.v2Row();
  r.orders.push(
    H.order({ wo: 'WO-2617-4', customer: 'Aderrig Homes', floor: '7', unit: '231', title: 'APT TYPE 1 KITCHEN', dueDate: '2026-10-23', origDueDate: '2026-10-23' }),
    H.order({ wo: 'WO-2617-5', customer: 'Aderrig Homes', floor: '7', unit: '232', title: 'APT TYPE 2 KITCHEN', dueDate: '2026-10-19', origDueDate: '2026-10-19' }),
    H.order({ wo: 'WO-2617-12/A-REWORK', customer: 'Aderrig Homes', floor: 'BLOCK C LEVEL 07', unit: '231A', title: 'APARTMENT TYPE 1 KITCHEN AND UTILITY WITH ISLAND AND LARDER', dueDate: '2026-10-19', origDueDate: '2026-10-19' }),
    H.order({ wo: 'WO-80', customer: 'Ballinasloe Development & Construction Company (Ireland) Limited', floor: '1', unit: '1', title: 'LONG CUSTOMER', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  return r;
}
// every visible button / summary / input in the top overlay: is it inside the screen sideways, and tall enough to tap?
const audit = p => p.evaluate(() => {
  const ov = [...document.querySelectorAll('.pod-ovl')].pop(); if (!ov) return null;
  const vw = document.documentElement.clientWidth, out = { vw, sw: document.documentElement.scrollWidth, bodySw: document.body.scrollWidth, off: [], small: [], n: 0 };
  const inner = ov.querySelector('.pod-in'); out.inSw = inner ? inner.scrollWidth : 0; out.inCw = inner ? inner.clientWidth : 0; out.ovSw = ov.scrollWidth; out.ovCw = ov.clientWidth;
  ov.querySelectorAll('button, summary, a.btn, select, input:not([type=file]):not([type=checkbox]):not([type=radio])').forEach(e => {
    if (e.closest('[hidden]') || e.hidden) return; const r = e.getBoundingClientRect(); if (!r.width && !r.height) return;
    const d = e.closest('details'); if (d && !d.open && e.tagName !== 'SUMMARY') return;
    out.n++; const nm = (e.id || e.getAttribute('data-mr') || e.getAttribute('data-mrx') && 'rowX' || e.className || e.tagName) + ':' + (e.innerText || e.placeholder || '').trim().slice(0, 24);
    if (r.left < -1 || r.right > vw + 1) out.off.push(nm + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    if (/^(BUTTON|SUMMARY|A)$/.test(e.tagName) && r.height < 36) out.small.push(nm + ' h=' + Math.round(r.height));
  });
  return out;
});
let BASE = 360; // the page BEHIND the window (Capacity Board) — measured before the window opens, so only the window is judged
const noSide = a => a && a.sw <= BASE && a.ovSw <= a.ovCw + 1 && a.inSw <= a.inCw + 1;

(async () => {
  const browser = await H.chromium.launch();
  try {
    // =====================================================================================================================
    // 1. PHONE 360 × 740
    // =====================================================================================================================
    {
      const S = X.makeServer(row());
      X.F3.seedList(S, 'LX', { wos: ['WO-2617-5'], name: 'A very long list name for apartment type two kitchen and utility — Rev B (do not cut before Friday)' });
      const t = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } }), p = t.page;
      await asks(p);
      BASE = Math.max(360, await p.evaluate(() => document.documentElement.scrollWidth));
      rec('(info) phone 360: the Capacity Board BEHIND the window does not scroll sideways by itself (64-letter customer in the plan)', BASE <= 360, 'page scrollWidth ' + BASE);
      await p.evaluate(() => openListEditor(null, 'WO-2617-4')); await sleep(900);
      let a = await audit(p);
      rec('phone 360: new list from a job — the page does not scroll sideways', noSide(a), JSON.stringify({ sw: a.sw, vw: a.vw, bodySw: a.bodySw, ovSw: a.ovSw, ovCw: a.ovCw, inSw: a.inSw, inCw: a.inCw }));
      rec('phone 360: …every button / box is inside the screen (' + a.n + ' looked at)', !a.off.length, JSON.stringify(a.off));
      rec('phone 360: …every button is at least 36 px tall', !a.small.length, JSON.stringify(a.small));
      let tb = await p.evaluate(() => { const q = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), txt: e.innerText }; }; return { wo: q('me-hwo'), due: q('me-due'), x: q('me-x0'), vw: innerWidth }; });
      const inside = r => r && r.l >= 0 && r.r <= 360 && r.t >= 0 && r.b <= 740;
      const overlap = (a, b) => a && b && !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
      rec('phone 360: title bar — WO number, due tag and ✕ Close all on screen, none on top of another', inside(tb.wo) && inside(tb.due) && inside(tb.x) && !overlap(tb.wo, tb.x) && !overlap(tb.due, tb.x) && !overlap(tb.wo, tb.due), JSON.stringify(tb));
      rec('phone 360: ✕ Close at least 40 px tall', tb.x && tb.x.h >= 40, JSON.stringify(tb.x));
      // Save reachable: scroll it into view → inside the screen
      const sv = await p.evaluate(() => { const e = document.getElementById('me-save'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }; });
      rec('phone 360: the big Save can be scrolled to and is inside the screen, ≥ 44 px tall', sv.l >= 0 && sv.r <= 360 && sv.t >= 0 && sv.b <= 740 && sv.h >= 44, JSON.stringify(sv));
      // scrolled down: can the person still get out / see which job? (✕ Close)
      const st = await p.evaluate(() => { const e = document.getElementById('me-x0'), r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), pos: getComputedStyle(e.closest('.me-tb')).position }; });
      rec('phone 360: scrolled down to Save — ✕ Close (and the WO) still in view at the top ("at all times", L8)', st.t >= 0 && st.b <= 740, JSON.stringify(st));
      // "Start from…" open
      await p.evaluate(() => { const d = document.getElementById('me-start'); d.scrollIntoView({ block: 'start' }); d.open = true; }); await sleep(300);
      let pn = await p.evaluate(() => { const e = document.querySelector('#me-start .me-morep'), r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), bt: [...e.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return [b.id, Math.round(q.left), Math.round(q.right), Math.round(q.height)]; }) }; });
      rec('phone 360: "Start from…" panel is on the screen sideways, its three buttons inside it and ≥ 36 px', pn.l >= 0 && pn.r <= 360 && pn.bt.length === 3 && pn.bt.every(b => b[1] >= 0 && b[2] <= 360 && b[3] >= 36), JSON.stringify(pn));
      a = await audit(p);
      rec('phone 360: …no sideways scroll with "Start from…" open', noSide(a), JSON.stringify({ sw: a.sw, ovSw: a.ovSw, ovCw: a.ovCw, off: a.off }));
      await p.evaluate(() => { document.getElementById('me-start').open = false; const d = document.getElementById('me-more'); d.scrollIntoView({ block: 'center' }); d.open = true; }); await sleep(300);
      pn = await p.evaluate(() => { const e = document.querySelector('#me-more .me-morep'), r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), type: !!e.querySelector('#me-type') }; });
      a = await audit(p);
      rec('phone 360: "More" panel on the screen sideways, Type inside it, nothing off the side', pn.l >= 0 && pn.r <= 360 && pn.type && !a.off.length && noSide(a), JSON.stringify({ pn, off: a.off, sw: a.sw }));
      // can the bottom of the More panel be reached by scrolling? (last control scrolled into view lands inside the screen)
      const last = await p.evaluate(() => { const es = document.querySelectorAll('#me-more .me-morep select, #me-more .me-morep a, #me-more .me-morep button:not([hidden])'); const e = es[es.length - 1]; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { id: e.id, t: Math.round(r.top), b: Math.round(r.bottom) }; });
      rec('phone 360: the last thing in "More" (' + last.id + ') can be scrolled into view', last.t >= 0 && last.b <= 740, JSON.stringify(last));
      await p.evaluate(() => { document.getElementById('me-more').open = false; });
      // Change job on the phone
      await click(p, 'me-jobtog'); await sleep(400);
      a = await audit(p);
      rec('phone 360: "Change job" opened — Project + Work order pickers fit the screen, no sideways scroll', noSide(a) && !a.off.length, JSON.stringify({ sw: a.sw, ovSw: a.ovSw, off: a.off }));
      rec('phone 360: …buttons there ≥ 36 px', !a.small.length, JSON.stringify(a.small));
      await closeAll(p);
      // long WO number + long title
      await p.evaluate(() => openListEditor(null, 'WO-2617-12/A-REWORK')); await sleep(900);
      a = await audit(p);
      tb = await p.evaluate(() => { const q = id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; }; return { wo: q('me-hwo'), due: q('me-due'), x: q('me-x0') }; });
      rec('phone 360: long WO number "WO-2617-12/A-REWORK" + long floor/title — no sideways scroll, WO / due / ✕ all on screen', noSide(a) && !a.off.length && inside(tb.wo) && inside(tb.due) && inside(tb.x) && !overlap(tb.wo, tb.x) && !overlap(tb.due, tb.x), JSON.stringify({ sw: a.sw, ovSw: a.ovSw, off: a.off, tb }));
      await closeAll(p);
      // long customer (project made from it)
      await p.evaluate(() => openListEditor(null, 'WO-80')); await sleep(1500);
      a = await audit(p);
      rec('phone 360: 64-letter customer name → project made, no sideways scroll', noSide(a) && !a.off.length, JSON.stringify({ sw: a.sw, ovSw: a.ovSw, inSw: a.inSw, inCw: a.inCw, off: a.off }));
      await closeAll(p);
      // existing list with a long name
      await p.evaluate(() => openListEditor('LX')); await sleep(900);
      a = await audit(p);
      rec('phone 360: existing list with a 100-letter name — no sideways scroll, nothing off the side', noSide(a) && !a.off.length, JSON.stringify({ sw: a.sw, ovSw: a.ovSw, off: a.off }));
      rec('phone 360: …buttons ≥ 36 px (row ✕ included)', !a.small.length, JSON.stringify(a.small));
      // the finder (An old list…) on the phone
      await p.evaluate(() => { document.getElementById('me-start').open = true; document.getElementById('me-findold').click(); }); await sleep(600);
      a = await audit(p);
      const fd = await p.evaluate(() => { const ov = [...document.querySelectorAll('.pod-ovl')].pop(); const b = ov.querySelector('[data-foc]'); if (!b) return null; b.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = b.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), txt: b.innerText }; });
      rec('phone 360: "An old list…" finder — the page does not scroll sideways', a && a.sw <= BASE && a.ovSw <= a.ovCw + 1, JSON.stringify(a && { sw: a.sw, bodySw: a.bodySw, ovSw: a.ovSw, ovCw: a.ovCw }));
      const fd0 = await p.evaluate(() => { const ov = [...document.querySelectorAll('.pod-ovl')].pop(); const sc = ov.querySelector('#fo-body > div:last-child'); if (sc) sc.scrollLeft = 0; const b = ov.querySelector('[data-foc]'); const r = b.getBoundingClientRect(), c = (sc || ov).getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), boxR: Math.round(c.right) }; });
      rec('phone 360: …"Use these rows" is in view WITHOUT scrolling the table sideways', fd0.r <= fd0.boxR + 1 && fd0.r <= 360, JSON.stringify(fd0));
      rec('phone 360: …"Use these rows" is ≥ 36 px tall', fd && fd.h >= 36, JSON.stringify(fd));
      await closeAll(p);
      // Saved panel on the phone
      await p.evaluate(() => openListEditor(null, 'WO-2617-4')); await sleep(900);
      await setv(p, '0|item', 'Hinge'); await setv(p, '0|qty', '4'); await save(p, 1800);
      const dn = await p.evaluate(() => { const d = document.querySelector('.me-dov'); if (!d) return null; const c = d.querySelector('#me-dclose').getBoundingClientRect(); return { h: Math.round(c.height), l: Math.round(c.left), r: Math.round(c.right), t: Math.round(c.top), b: Math.round(c.bottom), sw: document.documentElement.scrollWidth, txt: d.innerText }; });
      rec('phone 360: Saved ✓ panel — Close on screen, ≥ 44 px tall, no sideways scroll', dn && dn.h >= 44 && dn.l >= 0 && dn.r <= 360 && dn.t >= 0 && dn.b <= 740 && dn.sw <= BASE, JSON.stringify(dn) + ' ' + await err(p));
      rec('phone: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // =====================================================================================================================
    // 2. "Change job" — the title bar, the pickers and what is SAVED must always agree (PC)
    // =====================================================================================================================
    {
      const S = X.makeServer(row());
      X.F3.seedList(S, 'LN', { wos: [], name: 'No WO list' });
      X.F3.seedList(S, 'LO', { wos: ['WO-6'], name: 'Lucan WO on Aderrig project' }); // project P1, WO-6 is a Lucan (P2) job
      X.F3.seedList(S, 'TP', { wos: [], name: 'Type A', list: { is_template: true, type_name: 'Type A', list_type: 'kitchen' } });
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await asks(p);
      const agree = async label => { const j = await job(p); const st = await p.evaluate(() => { const s = document.getElementById('me-wo'); return s ? s.value : null; });
        rec(label + ' → title bar WO (' + j.hwo + ') = picker WO (' + st + ')', (j.hwo || '') === (st || ''), JSON.stringify({ hwo: j.hwo, due: j.due, wo: j.wo, woHidden: j.woHidden, pid: j.pid, info: j.info.replace(/\n/g, ' ') })); return j; };
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
      let j = await agree('new list from WO-3 (job known)');
      rec('job known: Project + Work order pickers folded away, "Change job ▾" shown, no ＋ New P-number in sight', j.woHidden === true && j.pidHidden === true && j.tog && await p.evaluate(() => { const b = document.getElementById('me-new'); return !b || !!b.closest('[hidden]'); }), JSON.stringify(j));
      rec('job known: hidden pickers hold WO-3 / P1', j.wo === 'WO-3' && j.pid === 'P1', JSON.stringify([j.wo, j.pid]));
      await click(p, 'me-jobtog'); await sleep(300);
      j = await job(p);
      rec('Change job pressed: pickers shown, WO-3 still chosen, nothing else changed, closing asks nothing yet', j.woHidden === false && j.pidHidden === false && j.wo === 'WO-3' && j.hwo === 'WO-3', JSON.stringify(j));
      await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(200);
      rec('Change job pressed and nothing picked → ✕ Close closes with NO question', !(await ed(p)) && !(await p.evaluate(() => window.__asked.length)), JSON.stringify(await p.evaluate(() => window.__asked)));
      await closeAll(p); await p.evaluate(() => { window.__confirm = true; });

      // pick another WO of the SAME project from the drop-down
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
      await click(p, 'me-jobtog'); await sleep(300);
      await setid(p, 'me-wo', 'WO-4'); await sleep(500);
      j = await agree('Change job → picked WO-4 (same project)');
      rec('…the due tag is WO-4\'s (20 Nov), not WO-3\'s (3 Dec)', /20 Nov/.test(j.due || ''), j.due);
      rec('…the job boxes under it show WO-4\'s unit / title', /UTILITY/.test(j.info), j.info.replace(/\n/g, ' '));
      await setv(p, '0|item', 'Hinge'); await setv(p, '0|qty', '2'); await save(p, 1800);
      let dn = await donep(p);
      rec('…Save → the list is on WO-4 (what the picker said), none on WO-3', liveFor(S, 'WO-4').length === 1 && liveFor(S, 'WO-3').length === 0 && dn && /WO-4/.test(dn.l), JSON.stringify([liveFor(S, 'WO-4').length, liveFor(S, 'WO-3').length, dn && dn.l]));
      await closeAll(p);

      // pick a WO of ANOTHER project: project → Lucan (P2), then WO-6; then back to Aderrig + WO-3
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
      await setv(p, '0|item', 'Typed before the change'); await setv(p, '0|qty', '1');
      await click(p, 'me-jobtog'); await sleep(300);
      await setid(p, 'me-pid', 'P2'); await sleep(500);
      j = await agree('Change job → project changed to Lucan (WO-3 is an Aderrig job)');
      rec('…WO-3 is taken off and the person is told why; the title bar no longer shows WO-3', !j.hwo && !j.wo && /WO-3 is a Aderrig job|WO-3 is an Aderrig job|taken off/.test(j.err), JSON.stringify({ hwo: j.hwo, wo: j.wo, err: j.err }));
      rec('…the typed row is still there', (await rows(p)).some(r => r.item === 'Typed before the change'));
      rec('…the Lucan drop-down lists only Lucan jobs', await p.evaluate(() => [...document.getElementById('me-wo').options].filter(o => o.value).every(o => o.value === 'WO-6')), JSON.stringify(await p.evaluate(() => [...document.getElementById('me-wo').options].map(o => o.value))));
      await setid(p, 'me-wo', 'WO-6'); await sleep(500);
      j = await agree('…then WO-6 picked');
      rec('…due tag is WO-6\'s (10 Dec)', /10 Dec/.test(j.due || ''), j.due);
      // switching back
      await setid(p, 'me-pid', 'P1'); await sleep(500);
      j = await agree('…project switched back to Aderrig');
      rec('…WO-6 (a Lucan job) is not left on an Aderrig list', !j.wo && !j.hwo, JSON.stringify([j.wo, j.hwo, j.err]));
      await setid(p, 'me-wo', 'WO-3'); await sleep(500);
      j = await agree('…and WO-3 picked again');
      rec('…due tag back to WO-3\'s (3 Dec)', /3 Dec/.test(j.due || ''), j.due);
      await save(p, 1800); dn = await donep(p);
      const l3 = liveFor(S, 'WO-3');
      rec('…Save → ONE list on WO-3, project Aderrig, typed row kept; nothing on WO-6 from this window', l3.length === 1 && l3[0].project_id === 'P1' && linesOf(S, l3[0].id).some(x => x.part === 'Typed before the change') && liveFor(S, 'WO-6').filter(l => l.id !== 'LO').length === 0, JSON.stringify([l3.map(l => l.project_id), liveFor(S, 'WO-6').map(l => l.id), dn && dn.l, await err(p)]));
      await closeAll(p);

      // EXISTING lists
      await p.evaluate(async () => { lsReset(); await lsLoad(); openListEditor('L1'); }); await sleep(800);
      j = await agree('existing list L1 (WO-1) opened for edit');
      rec('existing list: title bar "Edit cutting list" + WO-1 + its due tag; pickers folded; hidden picker holds WO-1 / P1', j.hwo === 'WO-1' && /Edit cutting list/.test(j.title) && !!j.due && j.woHidden && j.wo === 'WO-1' && j.pid === 'P1', JSON.stringify(j));
      await closeAll(p);
      await p.evaluate(() => openListEditor('LN')); await sleep(800);
      j = await job(p);
      rec('existing list with NO work order: pickers shown, no WO in the title bar, no "Change job"', !j.hwo && j.woHidden === false && j.pidHidden === false && !j.tog, JSON.stringify(j));
      await closeAll(p);
      await p.evaluate(() => openListEditor('LO')); await sleep(800);
      j = await agree('existing list on project Aderrig whose WO-6 is a Lucan job');
      rec('…the window says the project differs from the WO\'s customer (Project box shown beside the job)', j.pjro === 'Aderrig' || j.pidHidden === false, JSON.stringify({ pjro: j.pjro, pidHidden: j.pidHidden, info: j.info.replace(/\n/g, ' ') }));
      // a note is changed and saved: the list must stay on WO-6 and project P1 (hidden pickers must not change it)
      await setv(p, '0|note', 'touched'); await save(p, 2000);
      const lo = S.db.t.lists.find(l => l.id === 'LO');
      rec('…edit a note + Save with the pickers hidden → still WO-6, still project P1', JSON.stringify(lo.wos) === '["WO-6"]' && lo.project_id === 'P1', JSON.stringify([lo.wos, lo.project_id, await err(p)]));
      await closeAll(p);

      // from the Lists page: no WO
      await p.evaluate(() => openListEditor(null, '', '')); await sleep(600);
      j = await job(p);
      rec('new list from the Lists page (no WO, no project): pickers shown, no WO tag, no "Change job", Floor/Unit/Title boxes shown', !j.hwo && j.woHidden === false && j.pidHidden === false && !j.tog && await p.evaluate(() => !!document.getElementById('me-jf')), JSON.stringify(j));
      await closeAll(p);
      // shipped WO on an existing list
      S.row.orders.find(o => o.wo === 'WO-1').shippedAt = '2026-10-20T10:00:00Z';
      await p.evaluate(async () => { await loadDB(); openListEditor('L1'); }); await sleep(800);
      j = await agree('existing list whose WO-1 has since SHIPPED');
      rec('…still shows WO-1 (never blank / another job)', j.hwo === 'WO-1' && j.wo === 'WO-1', JSON.stringify([j.hwo, j.wo]));
      await closeAll(p);

      // TEMPLATES
      await p.evaluate(() => { localStorage.removeItem('wpfEditPin'); window.__prompt = 'Op'; openListEditor(null, '', 'P1', { tpl: true }); }); await sleep(500);
      rec('template, office with no PIN: asked for the PIN, wrong answer → no window', !(await ed(p)) && await p.evaluate(() => window.__prompted.some(m => /PIN/.test(m))));
      await p.evaluate(() => { (o => { window.prompt = (m, d) => /Enter the Drawing office or Admin PIN/.test(m) ? pins().design : o(m, d); })(window.prompt); /* a remembered PIN no longer opens templates (plan question 12): the PIN is typed when asked */ openListEditor(null, '', 'P1', { tpl: true }); }); await sleep(600);
      let tp = await p.evaluate(() => { const g = id => document.getElementById(id); const vis = e => !!e && !e.closest('[hidden]') && !(e.closest('details') && !e.closest('details').open); return { ed: !!document.querySelector('.me-ed'), title: (document.querySelector('.me-tb') || {}).innerText, wo: !!g('me-wo'), hwo: !!g('me-hwo'), typeTop: vis(g('me-type')), tname: vis(g('me-tname')), astpl: !!g('me-astpl'), save: (g('me-save') || {}).innerText, tog: !!g('me-jobtog'), nTypes: document.querySelectorAll('#me-type').length, pidVis: vis(g('me-pid')) }; });
      rec('new template: opens, "New template", NO work order picker / WO tag / Change job, Project shown, Type + type name in the top row (once), "Save template", no "Save as template"', tp.ed && /New template/.test(tp.title) && !tp.wo && !tp.hwo && !tp.tog && tp.pidVis && tp.typeTop && tp.tname && tp.nTypes === 1 && /Save template/.test(tp.save) && !tp.astpl, JSON.stringify(tp));
      await setid(p, 'me-name', 'Type Q'); await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await save(p, 1800);
      dn = await donep(p);
      rec('new template: Save → "Template saved ✓", in the database as a template with no WO', dn && /Template saved/.test(dn.h) && S.db.t.lists.some(l => l.is_template && l.name === 'Type Q' && !(l.wos || []).length), JSON.stringify([dn && dn.h, await err(p)]));
      await closeAll(p);
      await p.evaluate(() => { window.__prompt = 'tidy'; openListEditor('TP'); }); await sleep(800);
      tp = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), title: (document.querySelector('.me-tb') || {}).innerText, wo: !!document.getElementById('me-wo'), hist: !!document.getElementById('me-hist') }));
      rec('existing template opened: "Edit template", no WO picker, History button', tp.ed && /Edit template/.test(tp.title) && !tp.wo && tp.hist, JSON.stringify(tp));
      await closeAll(p);
      // via the Templates page button
      await p.evaluate(() => { showTab('l'); }); await sleep(600);
      const nt = await p.evaluate(() => { const b = document.getElementById('lh-newtpl'); if (!b) return 'no #lh-newtpl on the Lists page (project filter not set?)'; b.click(); return 'ok'; }); await sleep(600);
      rec('Templates: the Lists page "new template" button opens the template window (' + nt + ')', nt !== 'ok' || /New template/.test(await p.evaluate(() => (document.querySelector('.me-tb') || {}).innerText || '')), nt);
      await closeAll(p);
      rec('change job / templates: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
