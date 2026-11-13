// Tester attack ROUND 3b (list window, 13 Nov): re-attack of the Coder's round-3 fixes —
//  4. phones 320 / 360 / 480 px: the red reason above the pinned Save, More ▾ in the page flow, the box with the cursor never
//     under the Save bar or the title bar; 481 / 1280 px unchanged;
//     (UPDATED for Garry 13 Nov, question 12 answer B: the Production Manager screen shows them too, and his PIN typed when
//     asked opens them once — a REMEMBERED PIN, his included, still never does)
//  5. templates and a remembered PIN: only the Drawing office screen shows the template buttons; a PIN remembered from a
//     material / ✓ Check / project edit never opens templates; nothing else asks for a PIN more often than before.
// Fake Supabase only. Run: node tests/list-window/attack3b-phone-tplpin.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, click, save, donep, err, rows, liveFor } = L;
const LINES = n => Array.from({ length: n }, (_, i) => ['saw', 'Part ' + (i + 1), String(1 + (i % 4)), 300 + i, 200 + i, 'MFC White', '', '']);
const tpls = S => S.db.t.lists.filter(l => l.is_template);
const tsnap = S => JSON.stringify([tpls(S), S.db.t.list_lines.filter(x => tpls(S).some(t => t.id === x.list_id))]);
const box = (p, sel) => p.evaluate(sel => { const e = typeof sel === 'string' ? document.querySelector(sel) : null; if (!e) return null; const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y), cs = getComputedStyle(e);
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), pos: cs.position, self: !!t && (t === e || e.contains(t) || t.contains(e) && /LABEL|SUMMARY/.test(t.tagName)), by: t ? (t.id || t.className || t.tagName).toString().slice(0, 30) : 'nothing', txt: (e.innerText || '').slice(0, 90) }; }, sel);
const bars = p => p.evaluate(() => { const f = document.querySelector('.me-ed .me-foot').getBoundingClientRect(), t = document.querySelector('.me-ed .me-tb').getBoundingClientRect(), s = document.getElementById('me-save').getBoundingClientRect();
  return { footTop: Math.round(f.top), tbBottom: Math.round(t.bottom), sTop: Math.round(s.top), sBottom: Math.round(s.bottom), vh: innerHeight, vw: innerWidth, side: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ===================== 4. phones =====================
    {
      const S = X.makeServer(X.v2Row());
      X.F3.seedList(S, 'BIG', { wos: ['WO-3'], name: 'Big list', lines: LINES(45) });
      const t = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 640 } }), p = t.page, kb = p.keyboard; await asks(p);
      const open = async (wo, id) => { await closeAll(p); await p.evaluate(({ wo, id }) => { window.__asked = []; window.__confirm = true; openListEditor(id || null, wo); }, { wo, id }); await sleep(1300); };
      const size = async (w, h) => { await p.setViewportSize({ width: w, height: h || 640 }); await sleep(250); };
      const top = () => p.evaluate(() => { const i = document.querySelector('.me-ed'); (i.closest('.pod-in') || i).scrollTop = 0; });
      for (const w of [320, 360, 480]) {
        await size(w); await open('', 'BIG');
        // row 30: no quantity, and a very long description (the reason quotes nothing of it — the reason itself is the long text below)
        await setv(p, '29|qty', ''); await top(); await sleep(150); await click(p, 'me-save'); await sleep(900);
        let e = await box(p, '#me-err'), b = await bars(p);
        rec('PH1 ' + w + ' px: Save refused (row 30 has no quantity) → the red reason is ON the screen, right above the pinned Save, not covered', !!e && e.txt.length > 0 && e.top >= b.tbBottom - 1 && e.bottom <= b.footTop + 2 && e.self && e.left >= 0 && e.right <= w + 1, JSON.stringify([e, b]));
        let c = await p.evaluate(() => { const a = document.activeElement; return a && a.dataset ? a.dataset.mr || a.id : ''; }), cb = await box(p, '.me-ed [data-mr="29|qty"]');
        rec('PH2 ' + w + ' px: …the cursor is in row 30\'s quantity and that box is in view — not under the reason, the Save bar or the title bar', c === '29|qty' && !!cb && cb.self && cb.top >= b.tbBottom - 1 && cb.bottom <= e.top + 1, JSON.stringify([c, cb, e.top, b.tbBottom]));
        // the LONG reason: a Bought in row with a 160-letter description and no quantity
        const long = 'Solid oak worktop upstand with a very long description that the drawing office pasted in from the supplier quote ' + 'W'.repeat(60);
        await setv(p, '29|qty', '2'); await setv(p, '44|item', long); await setv(p, '44|qty', ''); await p.evaluate(() => { const k = document.querySelector('.me-ed [data-mbuy="44"]'); if (k && !k.checked) k.click(); }); await sleep(300);
        await top(); await click(p, 'me-save'); await sleep(900); e = await box(p, '#me-err'); b = await bars(p);
        rec('PH3 ' + w + ' px: a LONG reason (Bought in row, 170-letter description) wraps inside the screen: no sideways scroll, nothing cut off at the right', !!e && e.txt.length > 0 && e.right <= w + 1 && e.left >= 0 && b.side <= 0, JSON.stringify([e, b.side]));
        rec('PH3 ' + w + ' px: …it leaves room to work: reason + Save bar take no more than half the screen, Save still fully on the screen', !!e && (b.vh - e.top) <= b.vh / 2 && b.sBottom <= b.vh && b.sTop > 0, JSON.stringify([e && e.h, b]));
        // the row being fixed: put the cursor in the last row's quantity (the one the reason is about)
        await p.evaluate(() => { const x = document.querySelector('.me-ed [data-mr="44|qty"]'); if (x) x.focus(); }); await sleep(350); cb = await box(p, '.me-ed [data-mr="44|qty"]'); e = await box(p, '#me-err'); b = await bars(p);
        rec('[MEDIUM] PH4 ' + w + ' px: …the LAST row\'s quantity box (the one to fix), cursor in it → in view above the red reason — not hidden behind it', !!cb && cb.self && cb.bottom <= e.top + 1 && cb.top >= b.tbBottom - 1, JSON.stringify([cb, e && e.top, b]));
        await setv(p, '44|qty', '3'); await sleep(200);
        const e2 = await box(p, '#me-err');
        rec('(info) PH5 ' + w + ' px: after the quantity is typed the old reason is ' + (e2 && e2.txt ? 'still shown until Save: "' + e2.txt.slice(0, 40) + '…"' : 'gone'), true, '');
        await click(p, 'me-save'); await sleep(2300); const d = await donep(p);
        rec('PH5 ' + w + ' px: fixed, Save → saved; no red reason left over', !!d && /Saved/.test(d.h) && !(await p.evaluate(() => !!document.querySelector('#me-err:not(:empty)'))), JSON.stringify([d && d.h, await err(p)]));

        // More ▾ in the page flow
        await open('WO-4'); await p.evaluate(() => document.querySelector('#me-more summary').click()); await sleep(300);
        const mp = await box(p, '#me-more .me-morep'); b = await bars(p);
        rec('PH6 ' + w + ' px: More ▾ opens in the page (not floating), inside the screen width', !!mp && mp.pos === 'static' && mp.left >= 0 && mp.right <= w + 1 && b.side <= 0, JSON.stringify([mp, b.side]));
        rec('PH6 ' + w + ' px: …the big Save is still pinned, fully on the screen', b.sBottom <= b.vh && b.sTop > 0, JSON.stringify(b));
        const items = await p.evaluate(() => [...document.querySelectorAll('#me-more .me-morep button, #me-more .me-morep input, #me-more .me-morep select')].filter(x => x.getClientRects().length && !x.disabled).map((x, i) => { x.setAttribute('data-t3b', i); return (x.id || x.textContent || x.type).trim().slice(0, 24); }));
        const bad = [];
        for (let i = 0; i < items.length; i++) { await p.evaluate(i => document.querySelector('[data-t3b="' + i + '"]').scrollIntoView({ block: 'center' }), i); await sleep(60);
          const h = await box(p, '[data-t3b="' + i + '"]'), bb = await bars(p); if (!h || !h.self || h.bottom > bb.footTop + 1 || h.top < bb.tbBottom - 1 || h.left < 0 || h.right > w + 1) bad.push(items[i] + ' ' + JSON.stringify(h && [h.top, h.bottom, h.left, h.right, h.by])); }
        rec('PH7 ' + w + ' px: every item in More ▾ (' + items.length + ') can be scrolled to and tapped — none under the Save bar / title bar or off the side', items.length > 0 && !bad.length, bad.slice(0, 3).join(' | '));
        // a real tap on "No fittings on this job" (or the first tick box)
        const tick = await p.evaluate(() => { const x = document.querySelector('#me-more #me-nofit') || document.querySelector('#me-more .me-morep input[type=checkbox]'); if (!x) return null; x.scrollIntoView({ block: 'center' }); x.setAttribute('data-t3bt', '1'); return { id: x.id, was: x.checked }; });
        if (tick) { await sleep(100); let ok = true; try { await p.click('[data-t3bt="1"]', { timeout: 2500 }); } catch (x) { ok = false; } await sleep(300);
          const now = await p.evaluate(() => { const x = document.querySelector('#me-more #me-nofit') || document.querySelector('#me-more .me-morep input[type=checkbox]'); return x ? x.checked : null; });
          rec('PH8 ' + w + ' px: a real tap on the "' + (tick.id || 'first') + '" tick box in More ▾ ticks it', ok && now === !tick.was, JSON.stringify([tick, now, ok])); }
        await p.evaluate(() => { const m = document.getElementById('me-more'); if (m && !m.open) m.open = true; document.querySelector('#me-more summary').scrollIntoView({ block: 'center' }); }); await sleep(150);
        let okc = true; try { await p.click('#me-more summary', { timeout: 2500 }); } catch (x) { okc = false; } await sleep(250);
        rec('PH9 ' + w + ' px: a tap on More ▾ again closes the panel', okc && !(await p.evaluate(() => document.getElementById('me-more').open)), 'tap ok ' + okc);

        // the box with the cursor: Tab through a long list
        await open('', 'BIG'); await p.click('.me-ed [data-mr="0|item"]'); const hid = [];
        for (let i = 0; i < 70; i++) { await kb.press('Tab'); await sleep(25); const a = await p.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(), f = document.querySelector('.me-ed .me-foot').getBoundingClientRect(), t = document.querySelector('.me-ed .me-tb').getBoundingClientRect();
          return { k: (a.dataset && a.dataset.mr) || a.id || a.tagName, under: r.bottom > f.top + 1 && !f.top.toFixed && false || (r.bottom > f.top + 1 && !document.querySelector('.me-ed .me-foot').contains(a)), over: r.top < t.bottom - 1 && !document.querySelector('.me-ed .me-tb').contains(a) }; });
          if (a.under || a.over) hid.push(a.k + (a.under ? ' under Save' : ' under the title bar')); }
        rec('PH10 ' + w + ' px: 70 Tabs down a 45-row list: the box with the cursor is never under the pinned Save bar or the title bar', !hid.length, hid.slice(0, 4).join(' | '));
        const hid2 = []; for (let i = 0; i < 40; i++) { await kb.press('Shift+Tab'); await sleep(25); const a = await p.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(), f = document.querySelector('.me-ed .me-foot'), t = document.querySelector('.me-ed .me-tb');
          return { k: (a.dataset && a.dataset.mr) || a.id || a.tagName, bad: (r.bottom > f.getBoundingClientRect().top + 1 && !f.contains(a)) || (r.top < t.getBoundingClientRect().bottom - 1 && !t.contains(a)) }; }); if (a.bad) hid2.push(a.k); }
        rec('PH11 ' + w + ' px: 40 Shift+Tabs back up: never under the title bar or the Save bar', !hid2.length, hid2.slice(0, 4).join(' | '));
        await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
        S.db.t.lists.filter(l => l.id !== 'BIG' && !l.is_template && l.id !== 'L1').forEach(l => { l.archived = true; });
        const big = S.db.t.list_lines.filter(x => x.list_id === 'BIG'); await p.evaluate(async () => { lsReset(); await lsLoad(); });
      }
      // desktop unchanged
      for (const w of [481, 1280]) { await size(w, 800); await open('WO-4'); await click(p, 'me-save'); await sleep(600);
        const st = await p.evaluate(() => { const g = s => document.querySelector(s); g('#me-more').open = true; return { foot: getComputedStyle(g('.me-ed .me-foot')).position, err: getComputedStyle(g('#me-err')).position, more: getComputedStyle(g('#me-more .me-morep')).position, errTxt: g('#me-err').textContent.slice(0, 50), pad: getComputedStyle(g('.me-ed')).scrollPaddingBottom }; });
        rec('PH12 ' + w + ' px (not a phone): Save bar not pinned, the red reason in its usual place, More ▾ floats as before', st.foot !== 'sticky' && st.err !== 'sticky' && st.more === 'absolute' && st.errTxt.length > 0, JSON.stringify(st)); }
      await t.ctx.close().catch(() => {});
    }

    // ===================== 5. templates and a remembered PIN =====================
    {
      const mk = () => { const S = X.makeServer(X.v2Row()); X.F3.seedList(S, 'T1', { wos: [], name: 'Type B', list: { is_template: true, type_name: 'Type B', list_type: 'kitchen', rev: 1 } }); return S; };
      const pinAsks = p => p.evaluate(() => window.__prompted.filter(m => /PIN/.test(m)).length);
      const home = p => p.evaluate(() => { try { LH.kind = 'tpl'; LH.proj = 'P1'; LH.state = ''; const d = document.createElement('div'); d.innerHTML = lsHomeHTML(); const row = d.querySelector('[data-lhrow="T1"]');
        return { newtpl: !!d.querySelector('#lh-newtpl'), copy: !!d.querySelector('#lh-copy'), edit: !!(row && row.querySelector('[data-lhedit]')), arc: !!(row && row.querySelector('[data-lharc]')), astpl: !!d.querySelector('[data-lhastpl]') }; } catch (e) { return { err: e.message }; } });
      const none = h => !h.err && !h.newtpl && !h.copy && !h.edit && !h.arc && !h.astpl;
      // ---- every other screen, with each PIN remembered the way the app itself remembers it ----
      for (const role of ['office', 'pm', 'saw', 'stores']) {
        const S = mk(), t = await X.dev(browser, S, role), p = t.page; await asks(p);
        for (const [how, fn, pin] of [['✓ Check with the Drawing office PIN', "lsPinOk('✓ Check')", '8888'], ['a project / material edit with the Admin PIN', 'lsEditOk()', '9000'], ['a project edit with the Drawing office PIN', 'lsEditOk()', ' 8888 ']]) {
          await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
          const set = await p.evaluate(({ fn, pin }) => { window.__prompted = []; window.__prompt = pin; const ok = (0, eval)(fn); return { ok, pin: localStorage.getItem('wpfEditPin') }; }, { fn, pin });
          rec('T1 ' + role + ' set-up: ' + how + ' → accepted and remembered on this PC (as before)', set.ok === true && set.pin === pin.trim(), JSON.stringify(set));
          const h = await home(p);
          rec('T2 ' + role + ': …with that PIN remembered the Templates page shows NO ＋ New template / ⧉ Copy / ✎ Edit / Archive / 📐 Save as template', none(h), JSON.stringify(h));
          await closeAll(p); await p.evaluate(() => { window.__prompted = []; window.__prompt = null; openListEditor(null, 'WO-3'); }); await sleep(900);
          rec('T3 ' + role + ': …and the list window has no 📐 Save as template', await ed(p) && !(await p.evaluate(() => !!document.getElementById('me-astpl'))), '');
          await closeAll(p);
          const before = tsnap(S);
          for (const [lbl, call] of [['✎ Edit a template', "openListEditor('T1')"], ['＋ New template', "openListEditor(null,'','P1',{tpl:true})"], ['⧉ Copy from another project', "lsCopyDlg('P1')"], ['📐 Save as template', "lsSaveAsTpl({id:'L1'})"]])
            for (const [ans, a] of [['Cancel', null], ['an empty PIN', ''], ['a wrong PIN', '1234'], ['the PM PIN', '6666'], ['the Office PIN', '2468']]) {
              await closeAll(p); await p.evaluate(({ call, a }) => { window.__prompted = []; window.__prompt = a; try { (0, eval)(call); } catch (e) { window.__perr = String(e); } }, { call, a }); await sleep(500);
              const r = { open: await p.evaluate(() => !!document.querySelector('.pod-ovl')), asked: await pinAsks(p) };
              if (r.open || r.asked !== 1 || tsnap(S) !== before) rec('T4 ' + role + ' (' + how + ' remembered): ' + lbl + ' with ' + ans + ' → refused, template untouched', false, JSON.stringify(r)); }
          rec('T4 ' + role + ' (' + how + ' remembered): Edit / New / Copy / Save as template, each with Cancel · empty · wrong · PM · Office PIN → PIN asked every time, nothing opens, templates untouched', tsnap(S) === before, '');
          // Garry 13 Nov: the Production Manager PIN typed AT THAT MOMENT opens each of them (nothing saved here → template untouched)
          for (const [lbl, call] of [['✎ Edit a template', "openListEditor('T1')"], ['＋ New template', "openListEditor(null,'','P1',{tpl:true})"], ['⧉ Copy from another project', "lsCopyDlg('P1')"], ['📐 Save as template', "lsSaveAsTpl({id:'L1'})"]]) {
            await closeAll(p); await p.evaluate(({ call }) => { window.__prompted = []; window.__prompt = '7777'; try { (0, eval)(call); } catch (e) { window.__perr = String(e); } }, { call }); await sleep(500);
            const r = { open: await p.evaluate(() => !!document.querySelector('.pod-ovl')), asked: await pinAsks(p) };
            await closeAll(p);
            rec('T4 ' + role + ' (' + how + ' remembered): ' + lbl + ' with the Production Manager PIN typed → asked once and opens (Garry 13 Nov); closed without Save → template untouched', r.open && r.asked === 1 && tsnap(S) === before, JSON.stringify(r)); }
          rec('T5 ' + role + ': …and the remembered PIN is still remembered (a refused template PIN does not wipe it)', (await p.evaluate(() => localStorage.getItem('wpfEditPin'))) === pin.trim(), '');
          // regression: the things that used the remembered PIN do not ask again
          const again = await p.evaluate(() => { window.__prompted = []; window.__prompt = null; const a = lsEditOk(), b = lsPinOk('✓ Check'), c = lsHasEditPin(); return { a, b, c, asked: window.__prompted.filter(m => /PIN/.test(m)).length }; });
          rec('T6 ' + role + ': …project / material edits and ✓ Check still go straight through on the remembered PIN — not asked again', again.a === true && again.b === true && again.c === true && again.asked === 0, JSON.stringify(again));
        }
        // archive a template from this screen (button hidden — the handler's own guard), PIN remembered, Cancel
        await p.evaluate(() => { localStorage.setItem('wpfEditPin', '8888'); window.__prompted = []; window.__prompt = null; const b = document.createElement('button'); b.dataset.lharc = 'T1'; b.id = 't3b-arc'; document.body.appendChild(b); if (typeof lsHomeBind === 'function') lsHomeBind(); });
        const b4 = tsnap(S);
        // the typed-at-that-moment PIN: opens once, is NOT remembered in place of the old one, the next one asks again
        await p.evaluate(() => { localStorage.setItem('wpfEditPin', '7777'); window.__prompted = []; window.__prompt = '8888'; openListEditor('T1'); }); await sleep(800);
        const one = { open: await ed(p), asked: await pinAsks(p), pin: await p.evaluate(() => localStorage.getItem('wpfEditPin')) };
        rec('T7 ' + role + ': the Drawing office PIN typed AT THAT MOMENT opens the template once; the PC still remembers only the old PIN (7777)', one.open && one.asked === 1 && one.pin === '7777', JSON.stringify(one));
        await closeAll(p); await p.evaluate(() => { window.__prompted = []; window.__prompt = null; openListEditor('T1'); }); await sleep(500);
        rec('T7 ' + role + ': …the next ✎ Edit asks again', !(await ed(p)) && (await pinAsks(p)) === 1 && tsnap(S) === b4, '');
        await t.ctx.close().catch(() => {});
      }
      // ---- the Production Manager screen: was "its own screen is not enough"; Garry 13 Nov — his screen opens templates ----
      { const S = mk(), t = await X.dev(browser, S, 'prod'), p = t.page; await asks(p);
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
        const h = await home(p);
        rec('T8 Production Manager screen: the Templates page shows ＋ New template, ⧉ Copy from another project, ✎ Edit and Archive (Garry 13 Nov)', !h.err && h.newtpl && h.copy && h.edit && h.arc, JSON.stringify(h));
        await p.evaluate(() => { window.__prompted = []; window.__prompt = null; openListEditor('T1'); }); await sleep(900);
        const e8 = await ed(p), a8 = await pinAsks(p); await closeAll(p);
        rec('T8 Production Manager screen: ✎ Edit a template opens with no PIN question, and nothing is remembered as a PIN', e8 && a8 === 0 && !(await p.evaluate(() => localStorage.getItem('wpfEditPin'))), JSON.stringify([e8, a8]));
        const again = await p.evaluate(() => { window.__prompted = []; window.__prompt = null; const a = lsEditOk(), b = lsPinOk('✓ Check'); return { a, b, asked: window.__prompted.length }; });
        rec('T8 Production Manager screen: project / material edits and ✓ Check need no PIN there (as before)', again.a && again.b && again.asked === 0, JSON.stringify(again));
        await t.ctx.close().catch(() => {}); }
      // ---- the Drawing office: a whole day's work, not one PIN question ----
      { const S = mk(); D.insert(S.db, 'projects', { id: 'P9', name: 'Other', customer: 'Other Homes', cien_names: ['Other Homes'] });
        X.F3.seedList(S, 'T9', { wos: [], name: 'Other A', list: { is_template: true, type_name: 'Other A', list_type: 'kitchen', rev: 1, project_id: 'P9' } });
        const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
        await p.evaluate(() => { localStorage.removeItem('wpfEditPin'); window.__prompted = []; window.__prompt = 'Drawing office A'; });
        const h = await home(p);
        rec('T9 Drawing office: the Templates page shows ＋ New template, ⧉ Copy from another project, ✎ Edit and Archive', !h.err && h.newtpl && h.copy && h.edit && h.arc, JSON.stringify(h));
        // edit a template and save it
        await p.evaluate(() => openListEditor('T1')); await sleep(900); const e1 = await ed(p);
        await setv(p, '0|item', 'Changed by DO'); await save(p, 2200); let d = await donep(p);
        rec('T10 Drawing office: ✎ Edit a template, change a row, Save → "Template saved ✓"', e1 && !!d && /Template saved/.test(d.h), JSON.stringify([e1, d && d.h, await err(p)]));
        await closeAll(p);
        // ＋ New template
        await p.evaluate(() => openListEditor(null, '', 'P1', { tpl: true })); await sleep(900); const e2 = await ed(p); await closeAll(p);
        rec('T11 Drawing office: ＋ New template opens', e2, '');
        // Save as template from a list
        await p.evaluate(() => openListEditor('L1')); await sleep(1000); const has = await p.evaluate(() => !!document.getElementById('me-astpl')); const n0 = tpls(S).length;
        if (has) { await click(p, 'me-astpl'); await sleep(1500); await p.evaluate(() => { const b = [...document.querySelectorAll('.pod-ovl button')].find(x => /save|make|ok|create/i.test(x.textContent) && !/template$/i.test(x.id || '') && x.id !== 'me-save' && x.id !== 'me-astpl' && x.closest('.pod-ovl') !== document.querySelector('.me-ed').closest('.pod-ovl')); if (b) b.click(); }); await sleep(1500); }
        rec('T12 Drawing office: the list window has 📐 Save as template and pressing it starts without a PIN question', has && (await pinAsks(p)) === 0, 'new templates ' + (tpls(S).length - n0));
        await closeAll(p);
        // Copy from another project
        await p.evaluate(() => lsCopyDlg('P1')); await sleep(600); const cp = await p.evaluate(() => !!document.querySelector('.pod-ovl')); await closeAll(p);
        rec('T13 Drawing office: ⧉ Copy from another project opens', cp, '');
        // Archive a template through the real button
        const arc = await p.evaluate(async () => { showTab && 0; LH.kind = 'tpl'; LH.proj = 'P1'; LH.state = ''; const host = document.createElement('div'); host.innerHTML = lsHomeHTML(); document.body.appendChild(host); const fn = ['lsHomeBind', 'lhBind', 'lsBindHome'].find(n => typeof window[n] === 'function'); if (fn) window[fn](); const b = host.querySelector('[data-lharc="T1"]'); if (!b) return 'no button'; if (!b.onclick) return 'not bound (' + fn + ')'; b.click(); await new Promise(r => setTimeout(r, 900)); host.remove(); return 'clicked'; });
        const t1 = S.db.t.lists.find(l => l.id === 'T1');
        rec('(info) T14 Drawing office: Archive on a template through its button: ' + arc + (arc === 'clicked' ? ' → archived ' + !!t1.archived : ' — could not be driven from the test'), true, '');
        rec('T15 Drawing office: all of that (edit + save, new, Save as template, copy, archive) → NOT ONE PIN question', (await pinAsks(p)) === 0, 'PIN questions: ' + await pinAsks(p) + ' · ' + JSON.stringify(await p.evaluate(() => window.__prompted.map(m => m.slice(0, 40)))));
        rec('T16 Drawing office: nothing was remembered as a PIN on the PC', !(await p.evaluate(() => localStorage.getItem('wpfEditPin'))), '');
        rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
        await t.ctx.close().catch(() => {}); }
    }
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
