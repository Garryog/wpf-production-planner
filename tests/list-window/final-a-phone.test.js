// FINAL Tester round, file C (14 Nov): a phone, 360 px wide (Chrome), merged code. The list window, "Start from…", the Saved ✓
// panel, ✕ Close, the Work order drop-down, the Materials window, the template / old-list pickers — nothing off the side,
// nothing unreachable, the big Save always in reach. Real taps (Playwright click: fails when something covers the button).
// Fake Supabase only. Run: node tests/list-window/final-a-phone.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const LONG = 'Ballymakenny Road Residential Development Company (Phase 2B) Limited', OG = "O'Grady & Sons — \"Kitchens\" <b>x</b>";
const o = (wo, c, floor, unit, title, due, x) => H.order(Object.assign({ wo, customer: c, floor, unit, title, dueDate: due, origDueDate: due }, x || {}));
// everything visible inside `sel` that sticks out of the viewport sideways
const off = (p, sel) => p.evaluate(sel => { const W = document.documentElement.clientWidth, box = document.querySelector(sel); if (!box) return ['no ' + sel];
  return [...box.querySelectorAll('button,input,select,summary,a,label,td,th,b,span,div')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    let sc = e.parentElement; while (sc && sc !== box) { const c = getComputedStyle(sc); if (/(auto|scroll)/.test(c.overflowX) && sc.scrollWidth > sc.clientWidth + 1) return false; sc = sc.parentElement; } // inside its own sideways scroller: allowed
    return r.right > W + 1 || r.left < -1; }).slice(0, 8).map(e => e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 20) + ' "' + (e.innerText || e.value || '').slice(0, 25).replace(/\s+/g, ' ') + '" ' + Math.round(e.getBoundingClientRect().left) + '..' + Math.round(e.getBoundingClientRect().right)); }, sel);
const pageW = p => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, top: [...document.querySelectorAll('.pod-ovl')].map(o => o.scrollWidth - o.clientWidth) }));
const inView = (p, id) => p.evaluate(id => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
  return { in: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, hit: !!hit && (hit === e || e.contains(hit)), h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom) }; }, id);
const tap = async (p, sel) => { try { await p.click(sel, { timeout: 2500 }); return 'ok'; } catch (e) { return 'CANNOT TAP ' + sel + ': ' + String(e.message).split('\n')[0].slice(0, 120); } };

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(o('WO-2617-4', 'Aderrig Homes', '7', '231', 'KITCHEN TYPE B — ' + OG, '2026-11-14'), o('WO-LONG-123456789', LONG, 'Block Charlie East Wing', 'Apartment 1234A', 'KITCHEN AND UTILITY AND WARDROBES TYPE B HANDED ' + OG, '2026-11-20'));
    for (let i = 0; i < 14; i++) r.orders.push(o('WO-PH' + i, 'Aderrig Homes', 'PH', String(i + 1), 'PH KITCHEN TYPE ' + i + ' WITH A LONG TITLE THAT GOES ON', '2026-12-' + String(i + 1).padStart(2, '0')));
    const S = X.makeServer(r);
    for (let i = 0; i < 9; i++) X.F3.seedList(S, 'TP' + i, { wos: [], name: 'Template number ' + i + ' with a long name — ' + OG, list: { is_template: true, type_name: 'Type ' + i + ' handed LH long name', list_type: 'kitchen' } });
    X.F3.seedList(S, 'OLDL', { wos: ['WO-PH3'], name: 'Old list with a very long name for the finder — ' + OG });
    for (let i = 0; i < 12; i++) D.insert(S.db, 'project_materials', { id: 'MX' + i, project_id: 'P1', name: 'Egger H1180 ST37 Natural Halifax Oak 18mm long board name ' + i, kind: i % 3 ? 'sheet' : 'other' });
    for (const role of ['design', 'prod']) {
      const t = await X.dev(browser, S, role, { viewport: { width: 360, height: 640 } }), p = t.page; await asks(p);
      const T = '[' + role + ' 360] ';
      // ---- from a job
      await p.evaluate(() => openListEditor(null, 'WO-2617-4')); await sleep(1300);
      let j = await job(p);
      rec(T + 'opened from a job: WO number on screen, no project question', j.hwo === 'WO-2617-4' && j.pidHidden && !/Pick the project/.test(j.err), JSON.stringify([j.hwo, j.pidHidden, j.err]));
      rec(T + 'window: nothing sticks out sideways', (await off(p, '.me-ed')).length === 0, JSON.stringify(await off(p, '.me-ed')));
      let w = await pageW(p); rec(T + 'window: the page does not scroll sideways', w.sw <= w.cw + 1, JSON.stringify(w));
      let v = await inView(p, 'me-x0'); rec(T + '✕ Close in view at the top, tap-sized (≥ 40 px)', v && v.in && v.hit && v.h >= 40 && v.w >= 40, JSON.stringify(v));
      v = await inView(p, 'me-save'); rec(T + 'big Save in view with nothing typed, nearly full width (≥ 300 px), ≥ 44 px high', v && v.in && v.hit && v.w >= 300 && v.h >= 44, JSON.stringify(v));
      v = await inView(p, 'me-hwo'); rec(T + 'WO number in view', v && v.in, JSON.stringify(v));
      // ---- Start from…
      rec(T + 'Start from… can be tapped', (await tap(p, '#me-start summary')) === 'ok');
      await sleep(300);
      const sf = await p.evaluate(() => ['me-instpl', 'me-impxl', 'me-findold'].map(id => { const e = document.getElementById(id), r = e && e.getBoundingClientRect(); return e ? { id, t: e.innerText.trim(), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), vis: r.width > 0 } : { id, missing: true }; }));
      rec(T + 'Start from…: template / Excel / old list all shown, inside the screen, tap-sized (≥ 36 px)', sf.every(x => x.vis && x.l >= 0 && x.r <= 361 && x.h >= 36), JSON.stringify(sf));
      rec(T + 'Start from… open: nothing sticks out sideways', (await off(p, '.me-ed')).length === 0, JSON.stringify(await off(p, '.me-ed')));
      // A template…
      rec(T + '"A template…" can be tapped', (await tap(p, '#me-instpl')) === 'ok'); await sleep(700);
      let dl = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return { ed: !!o.querySelector('.me-ed'), sw: o.scrollWidth, cw: o.clientWidth, in: (o.querySelector('.pod-in') || o).getBoundingClientRect().right, n: o.querySelectorAll('[data-itq]').length, q: !!o.querySelector('#it-q') }; });
      rec(T + 'template picker: fits the screen (no sideways scroll), search box there, 9 templates', !dl.ed && dl.sw <= dl.cw + 1 && dl.in <= 361 && dl.q && dl.n === 9, JSON.stringify(dl));
      const pk = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const W = innerWidth; return [...o.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map(b => b.innerText.slice(0, 20)); });
      rec(T + 'template picker: every button inside the screen', pk.length === 0, JSON.stringify(pk));
      await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = [...o.querySelectorAll('[data-itq] button, [data-ituse], [data-itq]')].find(x => x.tagName === 'BUTTON') || o.querySelector('[data-itq]'); if (b) b.click(); }); await sleep(900);
      const tr = await rows(p);
      rec(T + 'template picked → its rows are in the window (replacing the blank layout)', tr.some(x => x.item === 'Side') && tr.some(x => x.item === 'Top'), JSON.stringify(tr.map(x => x.item)));
      await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].filter(o => !o.querySelector('.me-ed')).forEach(o => o.remove()));
      rec(T + 'with template rows in: nothing sticks out sideways', (await off(p, '.me-ed')).length === 0, JSON.stringify(await off(p, '.me-ed')));
      // long list: add rows, Save and Close still in reach at top, middle and bottom
      for (let i = 0; i < 25; i++) await p.evaluate(() => document.getElementById('me-addsaw').click()); await sleep(400);
      const n = (await rows(p)).length; await fillSaw(p, n - 1, 'Last row ' + OG, '3', '2400', '600', 'MFC White'); await setv(p, (n - 1) + '|note', 'a long note typed on a phone that goes on and on and on ' + OG);
      const reach = [];
      for (const pos of [0, 0.5, 1]) { await p.evaluate(f => { const e = document.querySelector('.me-ed'); e.scrollTop = (e.scrollHeight - e.clientHeight) * f; }, pos); await sleep(250); const s = await inView(p, 'me-save'), x = await inView(p, 'me-x0'); reach.push({ pos, save: s && s.in && s.hit, x: x && x.in && x.hit }); }
      rec(T + n + ' rows: Save AND ✕ Close in view and on top at the top, the middle and the bottom of the list', reach.every(x => x.save && x.x), JSON.stringify(reach));
      rec(T + n + ' rows: nothing sticks out sideways; page does not scroll sideways', (await off(p, '.me-ed')).length === 0 && (w = await pageW(p)).sw <= w.cw + 1, JSON.stringify([await off(p, '.me-ed'), w]));
      const lastVis = await p.evaluate(i => { const e = document.querySelector('.me-ed [data-mr="' + i + '|note"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), s = document.getElementById('me-save').getBoundingClientRect(), tb = document.querySelector('.me-tb').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, saveTop: s.top, tbBottom: tb.bottom }; }, n - 1);
      rec(T + 'the last row\'s Note box can be scrolled clear of the pinned Save bar and the top bar', lastVis.bottom <= lastVis.saveTop + 1 && lastVis.top >= lastVis.tbBottom - 1, JSON.stringify(lastVis));
      // More ▾
      await p.evaluate(() => { const e = document.querySelector('.me-ed'); e.scrollTop = e.scrollHeight; }); await sleep(200);
      rec(T + 'More ▾ can be tapped', (await tap(p, '#me-more summary')) === 'ok'); await sleep(300);
      rec(T + 'More ▾ open: nothing sticks out sideways', (await off(p, '.me-ed')).length === 0, JSON.stringify(await off(p, '.me-ed')));
      v = await inView(p, 'me-save'); rec(T + 'More ▾ open: Save still in view and on top', v && v.in && v.hit, JSON.stringify(v));
      // ✕ with unsaved rows asks; Cancel keeps
      await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
      rec(T + '✕ Close can be tapped with rows typed', (await tap(p, '#me-x0')) === 'ok'); await sleep(400);
      const cq = await p.evaluate(() => ({ open: !!document.querySelector('.me-ed'), asked: window.__asked.slice() }));
      rec(T + '…it asks first (unsaved rows); Cancel keeps the window and the rows', cq.open && cq.asked.length === 1 && (await rows(p)).some(x => /^Last row/.test(x.item)), JSON.stringify(cq));
      await p.evaluate(() => { window.__confirm = true; });
      // Save with a real tap
      await setid(p, 'me-name', 'Phone list ' + role + ' — ' + OG);
      rec(T + 'big Save can be tapped (real tap)', (await tap(p, '#me-save')) === 'ok'); await sleep(2800);
      let dn = await donep(p);
      rec(T + 'Saved ✓ — list is with the Saw & Stores', !!dn && /^Saved ✓ — list is with the Saw & Stores/.test(dn.h) && liveFor(S, 'WO-2617-4').filter(l => !l.archived).length >= 1, JSON.stringify([dn && dn.h, await err(p)]));
      const sp = await p.evaluate(() => { const d = document.querySelector('.me-dov'); if (!d) return null; const i = d.querySelector('.pod-in').getBoundingClientRect(), c = d.querySelector('#me-dclose').getBoundingClientRect(), W = innerWidth, H = innerHeight; return { l: Math.round(i.left), r: Math.round(i.right), cl: Math.round(c.left), cr: Math.round(c.right), ct: Math.round(c.top), cb: Math.round(c.bottom), ch: Math.round(c.height), W, H, sw: d.scrollWidth, cw: d.clientWidth, b: d.querySelectorAll('.me-dl b b').length, img: d.querySelectorAll('img').length }; });
      rec(T + 'Saved ✓ panel fits the screen; its Close is in view and tap-sized', sp && sp.l >= 0 && sp.r <= sp.W + 1 && sp.cl >= 0 && sp.cr <= sp.W + 1 && sp.ct >= 0 && sp.cb <= sp.H + 1 && sp.ch >= 40 && sp.sw <= sp.cw + 1, JSON.stringify(sp));
      rec(T + 'Saved ✓ panel shows the list name as text (<b> not rendered)', sp && sp.b === 0 && sp.img === 0 && dn.l.includes('<b>x</b>'), dn && dn.l);
      rec(T + 'Saved ✓ panel Close can be tapped; the window is gone', (await tap(p, '#me-dclose')) === 'ok' && !(await p.evaluate(() => !!document.querySelector('.me-ed, .me-dov'))));
      S.db.t.lists.filter(l => (l.wos || []).includes('WO-2617-4')).forEach(l => { l.archived = true; }); await p.evaluate(async () => { lsReset(); await lsLoad(); });

      // ---- long customer / floor / unit / title
      await p.evaluate(() => openListEditor(null, 'WO-LONG-123456789')); await sleep(1600);
      j = await job(p);
      rec(T + 'long names: window opens with the WO in the title bar', j.hwo === 'WO-LONG-123456789', JSON.stringify([j.hwo, j.pm]));
      rec(T + 'long names (68-letter customer, long floor / unit / title): nothing sticks out sideways', (await off(p, '.me-ed')).length === 0, JSON.stringify(await off(p, '.me-ed')));
      v = await inView(p, 'me-x0'); const v2 = await inView(p, 'me-save');
      rec(T + 'long names: ✕ Close and Save in view and on top', v && v.in && v.hit && v2 && v2.in && v2.hit, JSON.stringify([v, v2]));
      const tbh = await p.evaluate(() => Math.round(document.querySelector('.me-tb').getBoundingClientRect().height));
      rec(T + 'long names: the pinned top bar takes no more than a quarter of the screen (≤ 160 px)', tbh <= 160, String(tbh));
      await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

      // ---- no-WO path: Project ▾ then Work order ▾
      await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(900);
      const sel = await p.evaluate(() => ['me-pid', 'me-wo'].map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), hidden: !!e.closest('[hidden]'), n: e.options.length }; }));
      rec(T + 'no-WO path: Project ▾ and Work order ▾ shown and inside the screen', sel.every(x => !x.hidden && x.l >= 0 && x.r <= 361), JSON.stringify(sel));
      rec('[LOW] ' + T + 'no-WO path: Project ▾ and Work order ▾ are both tap-sized (≥ 36 px high) — Project ▾ is 32 px, Work order ▾ 40', sel.every(x => x.h >= 36), JSON.stringify(sel.map(x => [x.id, x.h])));
      rec(T + 'no-WO path: nothing sticks out sideways', (await off(p, '.me-ed')).length === 0, JSON.stringify(await off(p, '.me-ed')));
      const sr = await p.selectOption('#me-wo', 'WO-PH5').then(() => 'ok').catch(e => 'ERR ' + String(e.message).split('\n')[0]); await sleep(600);
      j = await job(p);
      rec(T + 'no-WO path: a work order picked with a real tap → WO number in the title bar', sr === 'ok' && j.hwo === 'WO-PH5', JSON.stringify([sr, j.hwo]));
      // Find old list from Start from…
      await p.evaluate(() => { document.getElementById('me-start').open = true; document.getElementById('me-findold').click(); }); await sleep(700);
      dl = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const W = innerWidth; return { ed: !!o.querySelector('.me-ed'), sw: o.scrollWidth, cw: o.clientWidth, out: [...o.querySelectorAll('button,input,select')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map(b => (b.innerText || b.id).slice(0, 20)), txt: o.innerText.slice(0, 80) }; });
      rec(T + 'Find old list: fits the screen, every button / box inside it', !dl.ed && dl.sw <= dl.cw + 1 && dl.out.length === 0, JSON.stringify(dl));
      await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].filter(o => !o.querySelector('.me-ed')).forEach(o => o.remove()));
      // Materials window
      rec(T + '🧱 Project materials can be tapped', (await tap(p, '#me-mats')) === 'ok'); await sleep(800);
      dl = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const W = innerWidth, H = innerHeight; const els = [...o.querySelectorAll('button,input,select')].filter(b => b.getBoundingClientRect().width);
        const x = o.querySelector('#pod-x') || [...o.querySelectorAll('button')].find(b => /close|✕/i.test(b.textContent)); const xr = x && x.getBoundingClientRect();
        let scOk = true; const out = els.filter(b => { const r = b.getBoundingClientRect(); let sc = b.parentElement, own = false; while (sc && sc !== o) { const c = getComputedStyle(sc); if (/(auto|scroll)/.test(c.overflowX) && sc.scrollWidth > sc.clientWidth + 1) { own = true; break; } sc = sc.parentElement; } return !own && (r.right > W + 1 || r.left < -1); }).map(b => (b.innerText || b.value || b.id).slice(0, 24) + ' ' + Math.round(b.getBoundingClientRect().right));
        return { ed: !!o.querySelector('.me-ed'), sw: o.scrollWidth, cw: o.clientWidth, out: out.slice(0, 6), n: els.length, close: xr ? { t: Math.round(xr.top), b: Math.round(xr.bottom), l: Math.round(xr.left), r: Math.round(xr.right), h: Math.round(xr.height) } : null, small: els.filter(b => b.tagName === 'BUTTON' && b.getBoundingClientRect().height < 32).map(b => b.innerText.slice(0, 14) + ' ' + Math.round(b.getBoundingClientRect().height)).slice(0, 6) }; });
      rec(T + 'Materials window (14 materials, long names): no sideways scroll of the screen, every button / box inside it', !dl.ed && dl.sw <= dl.cw + 1 && dl.out.length === 0, JSON.stringify(dl));
      rec(T + 'Materials window: its Close is inside the screen sideways', dl.close && dl.close.l >= 0 && dl.close.r <= 361, JSON.stringify(dl.close));
      rec('[MEDIUM] ' + T + 'Materials window with 14 materials: Close (and ＋ Add) can be reached within two screens of scrolling (≤ 1280 px down) — the only Close is at the very BOTTOM, ' + (dl.close ? dl.close.t : '?') + ' px down (about 140 px per material; no ✕ at the top) — lsMaterialsDlg()', dl.close && dl.close.t <= 1280, JSON.stringify(dl.close));
      rec('[LOW] ' + T + 'Materials window: no button under 32 px high (each row\'s Save is 23 px, ＋ Add 25 px — small for a thumb)', dl.small.length === 0, JSON.stringify(dl.small));
      await p.evaluate(() => { window.__confirm = true; [...document.querySelectorAll('.pod-ovl')].filter(o => !o.querySelector('.me-ed')).forEach(o => o.remove()); });
      // ＋ New material… from the row on a phone
      await p.evaluate(() => { window.__prompted = []; window.__prompt = m => /material/i.test(m) ? 'Phone board 18mm' : 'Op'; });
      await setv(p, '0|item', 'Phone side'); await setv(p, '0|qty', '2'); await setv(p, '0|L', '700'); await setv(p, '0|W', '500');
      const addv = await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); const op = [...s.options].find(o => /New material|Add new material/.test(o.textContent)); if (!op) return 'no option'; s.value = op.value; s.dispatchEvent(new Event('change')); return 'ok'; }); await sleep(1800);
      const r0 = (await rows(p))[0];
      rec(T + '"＋ Add new material…" first time on a phone → the row has the new material, asked once', addv === 'ok' && r0.mat === 'Phone board 18mm' && (await p.evaluate(() => window.__prompted.filter(m => /material/i.test(m)).length)) === 1, JSON.stringify([addv, r0.mat, await err(p)]));
      S.db.t.project_materials = S.db.t.project_materials.filter(m => m.name !== 'Phone board 18mm');
      await p.evaluate(() => { window.__confirm = true; window.__prompt = 'Op'; }); await closeAll(p);
      rec(T + 'no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300)); S.errors = [];
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
