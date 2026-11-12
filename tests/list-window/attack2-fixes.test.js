// Tester attack 2 (list window, 12 Nov evening): the five fixes made after attack 1, attacked directly.
//  c47fdea Save as template: Drawing office / Admin only EVERYWHERE (every route, every role, PINs, a remembered PIN, direct calls)
//  9c35fb5 phone: "Use these rows" first + 40 px; a second press for the same old list asks first
//  52805fd Esc closes "Start from…" / "More" first; Tab from an EMPTY last row goes to Save
//  4bee0ad PM screen: list status as plain text, no counts / warnings; Drawing office / office / Production Manager keep the action list
//  6789fc2 Cutting Lists page: red tag "⚠ 2 lists on WO-…"
// Fake Supabase only (tests/seq/fixs.js). Run: node tests/list-window/attack2-fixes.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const tpls = S => S.db.t.lists.filter(l => l.is_template);
const tplSig = S => JSON.stringify(tpls(S).map(l => [l.id, l.name, l.rev, l.version, S.db.t.list_lines.filter(x => x.list_id === l.id && x.removed_rev == null).map(x => x.part + ':' + x.qty)]));
const topTxt = p => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });
const nOv = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').length);
const key = (p, k, o) => p.evaluate(({ k, o }) => { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o || {}))); }, { k, o });
// put the browser's real focus on a cell, then press a real key (Playwright) so default actions happen too
const focusCell = (p, m) => p.evaluate(m => { const e = document.querySelector('.me-ed [data-mr="' + m + '"]'); if (!e) return 'no ' + m; e.focus(); return 'ok'; }, m);
const act = p => p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('data-mr') || a.tagName) : null; });
const openPanel = (p, id) => p.evaluate(id => { const d = document.getElementById(id); if (!d) return 'no ' + id; d.open = true; d.dispatchEvent(new Event('toggle')); const s = d.querySelector('summary'); if (s) s.focus(); return 'ok'; }, id);
const panelOpen = (p, id) => p.evaluate(id => { const d = document.getElementById(id); return d ? d.open : null; }, id);
const listsPage = async (p, role) => {
  if (role === 'office') await p.evaluate(() => showTab('l'));
  else if (role === 'prod') await p.evaluate(() => { const b = document.querySelector('[data-prodtab="lists"]'); if (b) b.click(); });
  else await p.evaluate(() => render());
  await sleep(900);
};

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ======================= 1. Save as template — every role, every route =======================
    for (const role of ['office', 'pm', 'prod', 'saw', 'stores', 'dash', 'design', 'admin']) {
      const S = X.makeServer(X.v2Row());
      X.F3.seedList(S, 'T1', { wos: [], name: 'Template A', list: { is_template: true, type_name: 'Type A' } });
      const t = await X.dev(browser, S, role), p = t.page; await asks(p);
      await p.evaluate(() => { localStorage.removeItem('wpfEditPin'); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
      const want = role === 'design' || role === 'admin';
      const s0 = tplSig(S), n0 = tpls(S).length;
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
      const w = await p.evaluate(() => !!document.getElementById('me-astpl'));
      rec(role + ': list window from a job — "Save as template" ' + (want ? 'SHOWN (Drawing office / Admin)' : 'not shown'), w === want, String(w));
      await closeAll(p);
      // Lists page rows (whoever can reach the page)
      await listsPage(p, role);
      const lp = await p.evaluate(() => ({ page: !!document.getElementById('lh'), btn: [...document.querySelectorAll('[data-lhastpl]')].filter(x => x.getBoundingClientRect().width > 0).length, newtpl: !!document.getElementById('lh-newtpl') }));
      if (lp.page) rec(role + ': Cutting Lists page rows — "📐 Save as template" ' + (want ? 'shown' : 'not shown'), want ? lp.btn > 0 : lp.btn === 0, JSON.stringify(lp));
      // direct call (console / a stale button): with no PIN remembered
      if (!want) {
        for (const [lbl, pin] of [['the Production Manager PIN 7777', '7777'], ['the PM PIN 6666', '6666'], ['the office PIN 2468', '2468'], ['a blank answer', ''], ['" 8888x"', ' 8888x']]) {
          await p.evaluate(pin => { window.__prompted = []; window.__prompt = pin; try { lsSaveAsTpl({ id: 'L1' }); } catch (e) { window.__e = String(e); } }, pin); await sleep(900);
          const tx = await topTxt(p), asked = await p.evaluate(() => window.__prompted.length);
          rec(role + ': lsSaveAsTpl() called directly + ' + lbl + ' → asked for a PIN and refused (no template box)', asked >= 1 && !/Template name/.test(tx), JSON.stringify({ asked, tx: tx.slice(0, 80) }));
          await closeAll(p);
        }
        rec(role + ': …no template written by any of those', tplSig(S) === s0, tplSig(S));
        rec(role + ': …and no wrong PIN was remembered on the PC', !(await p.evaluate(() => localStorage.getItem('wpfEditPin'))), await p.evaluate(() => localStorage.getItem('wpfEditPin')));
      }
      // OTHER routes that make or change a TEMPLATE (Garry Q3: "Drawing office and Admin only, everywhere")
      if (role === 'prod' || role === 'office') {
        // (a) ＋ New template (Lists page, Templates view) — what lh-newtpl runs
        await p.evaluate(() => { window.__prompted = []; window.__prompt = pins().prod; openListEditor(null, '', 'P1', { tpl: true }); }); await sleep(900);
        let te = await ed(p);
        if (te) { await setid(p, 'me-name', 'PM new template'); await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White'); await save(p, 2000); }
        const made = tpls(S).some(l => l.name === 'PM new template');
        rec('[Q3 "everywhere"] ' + role + (role === 'office' ? ' + Production Manager PIN' : ' (Production Manager screen)') + ': "＋ New template" (Lists → Templates) can NOT make a template', !made, JSON.stringify({ opened: te, asked: await p.evaluate(() => window.__prompted), templates: tpls(S).map(l => l.name) }));
        await closeAll(p);
        // (b) Edit an existing template and save it (changes what every future list starts from)
        const before = tplSig(S);
        await p.evaluate(() => { window.__prompt = (m) => /PIN/.test(m) ? pins().prod : 'changed by PM'; openListEditor('T1'); }); await sleep(1400);
        te = await ed(p);
        if (te) { await setv(p, '0|qty', '99'); await save(p, 2200); }
        rec('[Q3 "everywhere"] ' + role + (role === 'office' ? ' + Production Manager PIN' : '') + ': editing an existing TEMPLATE and saving it is refused', tplSig(S) === before || !te, JSON.stringify({ opened: te, after: tplSig(S).slice(0, 200) }));
        await closeAll(p);
        // (c) ⧉ Copy from another project (lsCopyDlg) — makes templates
        await p.evaluate(() => { window.__prompted = []; window.__prompt = pins().prod; try { lsCopyDlg('P2'); } catch (e) {} }); await sleep(900);
        const cp = (await topTxt(p));
        rec('[Q3 "everywhere"] ' + role + (role === 'office' ? ' + Production Manager PIN' : '') + ': "⧉ Copy from another project" (makes templates) does not open', !/Copy/i.test(cp) || /PIN|Drawing office/.test(cp) && !/From project|from another/i.test(cp), cp.slice(0, 160));
        await closeAll(p);
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
      }
      if (role === 'office') {
        // a Drawing office PIN typed ONCE at an office PC (to help someone) is remembered for good: the next person at that PC
        await p.evaluate(() => { window.__prompt = pins().design; lsSaveAsTpl({ id: 'L1' }); }); await sleep(900);
        const ok1 = /Template name/.test(await topTxt(p));
        rec('office + the Drawing office PIN typed at the guard → the template box opens (allowed)', ok1);
        await closeAll(p);
        await p.evaluate(() => { sessionStorage.setItem('wpfWho', 'Next person'); localStorage.setItem('wpfOpName', 'Next person'); openListEditor(null, 'WO-4'); }); await sleep(900);
        const still = await p.evaluate(() => !!document.getElementById('me-astpl'));
        rec('[LOW] office PC where the Drawing office PIN was typed once: the NEXT person at that PC does not get "Save as template" for ever (the PIN is remembered with no end)', !still, JSON.stringify({ still, pin: await p.evaluate(() => localStorage.getItem('wpfEditPin')) }));
        await closeAll(p);
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
      }
      if (role === 'admin') { // Admin works (role admin, nothing remembered) — and through the guard
        await p.evaluate(() => { window.__prompted = []; window.__prompt = null; lsSaveAsTpl({ id: 'L1' }); }); await sleep(900);
        rec('admin role (signed in with the Admin PIN, nothing remembered): the guard lets Admin straight through (no second PIN)', /Template name/.test(await topTxt(p)) && !(await p.evaluate(() => window.__prompted.length)), JSON.stringify(await p.evaluate(() => window.__prompted)));
        await closeAll(p);
      }
      rec(role + ': no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // ======================= 2. "Use these rows" on a phone + second press =======================
    {
      const S = X.makeServer(X.v2Row());
      X.F3.seedList(S, 'OLD1', { wos: ['WO-4'], name: 'Old house T09-13 utility' });
      X.F3.seedList(S, 'OLD2', { wos: ['WO-6'], name: 'Other old list' });
      const t = await X.dev(browser, S, 'design', { viewport: { width: 360, height: 740 } }), p = t.page; await asks(p);
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
      await openPanel(p, 'me-start'); await click(p, 'me-findold'); await sleep(700);
      const b = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const u = o && o.querySelector('[data-foc]'); if (!u) return null; const r = u.getBoundingClientRect(); const tr = u.closest('tr'); return { h: r.height, l: r.left, r: r.right, vw: innerWidth, first: tr && tr.firstElementChild.contains(u), txt: u.innerText, sw: document.documentElement.scrollWidth }; });
      rec('phone 360: "Use these rows" is the first thing on the row, inside the screen, ≥ 40 px tall', !!b && b.first && b.l >= 0 && b.r <= b.vw && b.h >= 40, JSON.stringify(b));
      rec('phone 360: the finder does not make the page scroll sideways', !!b && b.sw <= 362, JSON.stringify(b));
      // a list name long enough to push the row wide
      await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-foc]').click(); }); await sleep(800);
      const r1 = (await rows(p)).length;
      await openPanel(p, 'me-start'); await click(p, 'me-findold'); await sleep(700);
      await p.evaluate(() => { window.__asked = []; window.__confirm = false; const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-foc]').click(); }); await sleep(800);
      const a2 = await p.evaluate(() => window.__asked.slice());
      rec('second "Use these rows" for the SAME old list → asked first; Cancel → rows not added again', a2.some(m => /already in this list/.test(m)) && (await rows(p)).length === r1, JSON.stringify([a2, r1, (await rows(p)).length]));
      await closeAll(p); await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
      await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
      // undo the first use, then use it again: rows are NOT in any more — asking "already in this list" would be wrong
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
      await openPanel(p, 'me-start'); await click(p, 'me-findold'); await sleep(700);
      await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-foc="OLD1"]').click(); }); await sleep(800);
      await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="0|item"]'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); }); await sleep(400);
      const afterUndo = await rows(p);
      await openPanel(p, 'me-start'); await click(p, 'me-findold'); await sleep(700);
      await p.evaluate(() => { window.__asked = []; window.__confirm = true; const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-foc="OLD1"]').click(); }); await sleep(800);
      const a3 = await p.evaluate(() => window.__asked.slice());
      rec('[LOW] used, then taken out again with Ctrl+Z, then used again → NOT told "already in this list" (they are not)', !a3.some(m => /already in this list/.test(m)), JSON.stringify([afterUndo.length, a3]));
      // two DIFFERENT old lists → no question
      await openPanel(p, 'me-start'); await click(p, 'me-findold'); await sleep(700);
      await p.evaluate(() => { window.__asked = []; const o = [...document.querySelectorAll('.pod-ovl')].pop(); const c = o.querySelector('#fo-all'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } }); await sleep(300);
      await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o.querySelector('[data-foc="OLD2"]'); if (b) b.click(); }); await sleep(800);
      rec('a DIFFERENT old list after the first → no "already in" question', !(await p.evaluate(() => window.__asked.some(m => /already in this list/.test(m)))), JSON.stringify(await p.evaluate(() => window.__asked)));
      // a NEW window: the memory of what was used must not carry over
      await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
      await openPanel(p, 'me-start'); await click(p, 'me-findold'); await sleep(700);
      await p.evaluate(() => { window.__asked = []; const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-foc="OLD1"]').click(); }); await sleep(800);
      rec('a fresh list window: the first "Use these rows" asks nothing', !(await p.evaluate(() => window.__asked.some(m => /already in this list/.test(m)))));
      await closeAll(p);
      // the Lists page finder (not in a window) still has "⧉ Copy to new list" at the end, not "Use these rows"
      await p.evaluate(() => { lsFindDlg('P1'); }); await sleep(700);
      const lf = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return { use: o.querySelectorAll('[data-foc]').length ? o.querySelector('[data-foc]').innerText : '', sw: document.documentElement.scrollWidth }; });
      rec('Lists page "🔍 Find old list" (no window): still "⧉ Copy to new list" (unchanged)', /Copy to new list/.test(lf.use), JSON.stringify(lf));
      await closeAll(p);
      rec('phone finder: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // ======================= 3. Esc with panels open; Tab from an empty last row =======================
    {
      const S = X.makeServer(X.v2Row());
      const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
      // Esc with Start from… open and rows typed → panel closes, NO question, window + rows stay
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
      await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White');
      await openPanel(p, 'me-start');
      await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
      await p.keyboard.press('Escape'); await sleep(300);
      let s = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), asked: window.__asked.slice(), open: document.getElementById('me-start').open }));
      rec('typed row + "Start from…" open + Esc → only the panel closes; no "Close without saving?"', s.ed && !s.open && !s.asked.length, JSON.stringify(s));
      await p.keyboard.press('Escape'); await sleep(300);
      s = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), asked: window.__asked.slice() }));
      rec('…a second Esc asks "Close without saving?"; Cancel keeps the window and the row', s.ed && s.asked.some(m => /Close without saving/.test(m)) && (await rows(p))[0].item === 'Side', JSON.stringify(s));
      // Esc with More open, cursor in a box INSIDE More (Type)
      await openPanel(p, 'me-more');
      await p.evaluate(() => { window.__asked = []; const t = document.getElementById('me-type') || document.querySelector('#me-more select, #me-more input'); if (t) t.focus(); });
      await p.keyboard.press('Escape'); await sleep(300);
      s = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), asked: window.__asked.slice(), open: (document.getElementById('me-more') || {}).open, act: document.activeElement && (document.activeElement.id || document.activeElement.tagName) }));
      rec('"More" open, cursor in Type, Esc → More closes, no question; the cursor is not lost to the page', s.ed && !s.open && !s.asked.length && s.act !== 'BODY', JSON.stringify(s));
      // both open
      await openPanel(p, 'me-start'); await openPanel(p, 'me-more');
      await p.evaluate(() => { window.__asked = []; });
      await p.keyboard.press('Escape'); await sleep(250); await p.keyboard.press('Escape'); await sleep(250);
      s = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), asked: window.__asked.slice(), a: document.getElementById('me-start').open, b: (document.getElementById('me-more') || {}).open }));
      rec('"Start from…" AND "More" both open: two Esc close both panels, the list window stays, nothing asked', s.ed && !s.a && !s.b && !s.asked.length, JSON.stringify(s));
      // Esc with the old-list finder open over the window while Start from… is still open behind it
      await openPanel(p, 'me-start'); await click(p, 'me-findold'); await sleep(700);
      await p.evaluate(() => { window.__asked = []; });
      await p.keyboard.press('Escape'); await sleep(300);
      s = await p.evaluate(() => ({ n: document.querySelectorAll('.pod-ovl').length, ed: !!document.querySelector('.me-ed'), asked: window.__asked.slice() }));
      rec('finder open over the window + Esc → the finder closes, the window stays, nothing asked', s.n === 1 && s.ed && !s.asked.length, JSON.stringify(s));
      // Esc with a Saved ✓ panel: closes it
      await p.evaluate(() => { window.__confirm = true; });
      await save(p, 2000);
      const dn = await donep(p);
      await p.keyboard.press('Escape'); await sleep(300);
      rec('Saved ✓ panel + Esc → closes', !!dn && (await nOv(p)) === 0, JSON.stringify(dn && dn.h));
      // ---- Tab ----
      await p.evaluate(() => openListEditor(null, 'WO-4')); await sleep(900);
      await focusCell(p, '0|note');
      await p.keyboard.press('Tab'); await sleep(250);
      let a = await act(p);
      rec('NEW list, nothing typed, Tab from the last box of the only (empty) row → goes to the big Save (no new row)', a === 'me-save' && (await rows(p)).length === 1, JSON.stringify([a, (await rows(p)).length]));
      await p.keyboard.press('Enter'); await sleep(1500);
      const e0 = await err(p);
      rec('…Enter on Save with NOTHING typed → nothing saved, told plainly (no empty list for the saw)', !liveFor(S, 'WO-4').length && !(await donep(p)) && e0.length > 0, JSON.stringify([e0, liveFor(S, 'WO-4').length]));
      await fillSaw(p, 0, 'Shelf', '3', '500', '300', 'MFC White');
      await focusCell(p, '0|note'); await p.keyboard.press('Tab'); await sleep(250);
      rec('filled last row + Tab → a new row (cursor in its Description)', (await rows(p)).length === 2 && (await act(p)) === '1|item', JSON.stringify([(await rows(p)).length, await act(p)]));
      // the new empty row has the previous row's material (auto) — still counts as EMPTY
      await focusCell(p, '1|note'); await p.keyboard.press('Tab'); await sleep(250);
      a = await act(p);
      rec('the new row (auto material only, nothing typed) + Tab from its last box → Save, not a third row', a === 'me-save' && (await rows(p)).length === 2, JSON.stringify([a, (await rows(p)).length, (await rows(p))[1]]));
      // Shift+Tab from Save goes back
      await p.keyboard.press('Shift+Tab'); await sleep(250);
      a = await act(p);
      rec('Shift+Tab from Save goes back up (not lost)', a && a !== 'me-save' && a !== 'BODY', String(a));
      // a heading as the last row + Tab
      await click(p, 'me-addhdr'); await sleep(300);
      const rs = await rows(p), hi = rs.length - 1;
      const hcells = await p.evaluate(i => [...document.querySelectorAll('.me-ed [data-mr^="' + i + '|"]')].map(e => e.getAttribute('data-mr')), hi);
      if (hcells.length) { await focusCell(p, hcells[hcells.length - 1]); await p.keyboard.press('Tab'); await sleep(250); }
      rec('(info) EMPTY heading as the last row + Tab → where the cursor goes', true, JSON.stringify({ act: await act(p), rows: (await rows(p)).length, cells: hcells }));
      await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
      rec('keys: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // ======================= 4. Ownership: PM never nagged; Drawing office / office / Production Manager are =======================
    {
      const r = X.v2Row();
      // jobs due soon with NO list, one on the delivery board this week, one P-number, one with HTML in the title
      r.orders.push(H.order({ wo: 'WO-N1', customer: 'Aderrig Homes', floor: 'T10', unit: '1', title: 'NO LIST <b>bold</b> "q" O\'Grady', dueDate: '2026-10-23', origDueDate: '2026-10-23', step: '5. WORK ORDER PROCESSED', delDay: 'Thu', delVeh: 'V1', plannedWeek: '' }));
      r.orders.push(H.order({ wo: 'WO-N2', customer: 'Aderrig Homes', floor: 'T10', unit: '2', title: 'NO LIST 2', dueDate: '2026-10-26', origDueDate: '2026-10-26', step: '5. WORK ORDER PROCESSED' }));
      const S = X.makeServer(r);
      X.F3.seedList(S, 'LA', { wos: ['WO-6'], name: 'Archived one', list: { archived: true } });
      const roleTxt = {};
      for (const role of ['pm', 'design', 'office', 'prod', 'saw', 'dash']) {
        const t = await X.dev(browser, S, role), p = t.page; await sleep(900);
        if (role === 'office') { await p.evaluate(() => showTab('l')); await sleep(900); }
        if (role === 'prod') { await p.evaluate(() => { const b = document.querySelector('[data-prodtab="lists"]'); if (b) b.click(); }); await sleep(900); }
        let txt = await p.evaluate(() => document.body.innerText);
        if (role === 'pm') { // every PM tab
          await p.evaluate(() => { const b = document.querySelector('[data-pmtab="snags"]'); if (b) b.click(); }); await sleep(700);
          txt += '\n' + await p.evaluate(() => document.body.innerText);
          await p.evaluate(() => { const b = document.querySelector('[data-pmtab=""]'); if (b) b.click(); }); await sleep(500);
          const html = await p.evaluate(() => document.getElementById('app').innerHTML);
          rec('PM: no count of missing lists, no "to issue" / "needed" / "waiting for a cutting list" / "LISTS MISSING" anywhere on the PM screens', !/Cutting lists to issue|Cutting lists needed|LISTS MISSING|LISTS LATE|LISTS TO ISSUE|waiting for a cutting list|NO CUTTING LIST —|Tell the Production Manager/i.test(txt), txt.slice(0, 400));
          rec('PM: the list text is shown as plain text, not red / bold / a button (no "warning" look)', !/class="pm-ls"[^>]*>(?:<b|<button)/.test(html) && !/pm-ls[^"]*"[^>]*style="[^"]*(#c0392b|#a31515|red)/.test(html), (html.match(/<span class="dsh-x pm-ls"[^>]*>[^<]*<\/span>/g) || []).slice(0, 3).join(' '));
          const ls = await p.evaluate(() => [...document.querySelectorAll('.pm-ls')].map(e => e.closest('.dsh-row').querySelector('b').textContent + ' = ' + e.textContent));
          rec('(info) PM: what the PM reads per job', true, JSON.stringify(ls));
          const x = await p.evaluate(() => document.querySelectorAll('#app b b, #app .pm-ls b').length);
          rec('PM: a WO title with <b>HTML</b>, quotes and O\'Grady shows as text (or the job is not on the PM screen at all)', x === 0 && (txt.includes('NO LIST <b>bold</b>') || !txt.includes('WO-N1')), JSON.stringify([x, txt.includes('WO-N1')]));
          rec('PM: a job whose only list is ARCHIVED reads "no cutting list yet" (not "made")', !ls.some(s => /^WO-6 = .*made/.test(s)), JSON.stringify(ls.filter(s => /^WO-6/.test(s))));
        }
        roleTxt[role] = txt;
        rec(role + ': no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
        await t.close();
      }
      rec('Drawing office: "Cutting lists to issue" shown with WO-N1 / WO-N2 in it', /Cutting lists to issue/.test(roleTxt.design) && /WO-N1/.test(roleTxt.design), roleTxt.design.slice(0, 300));
      rec('office (Lists tab): "Cutting lists to issue" shown', /Cutting lists to issue/.test(roleTxt.office), roleTxt.office.slice(0, 200));
      rec('Production Manager (Lists tab): "Cutting lists to issue" shown', /Cutting lists to issue/.test(roleTxt.prod), roleTxt.prod.slice(0, 200));
      rec('[LOW, wording] saw screen: a job with no list does not say "Tell the Production Manager" (lists are the Drawing office\'s now)', !/Tell the Production Manager/.test(roleTxt.saw) && !/owner[^\n]*Production Manager/i.test(roleTxt.saw), (roleTxt.saw.match(/[^\n]*(Production Manager)[^\n]*/g) || []).slice(0, 3).join(' | '));
    }

    // ======================= 5. "⚠ 2 lists on WO-…" =======================
    {
      const r = X.v2Row();
      r.orders.push(H.order({ wo: 'WO-<i>7</i>', customer: 'Aderrig Homes', floor: 'T1', unit: '7', title: 'HTML WO', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
      const S = X.makeServer(r);
      X.F3.seedList(S, 'D1', { wos: ['WO-3'], name: 'Kitchen T09-13' });
      X.F3.seedList(S, 'D2', { wos: ['WO-3'], name: 'Wardrobes T09-13' });
      X.F3.seedList(S, 'D3', { wos: ['WO-4', 'WO-4'], name: 'Same WO twice in one list' });
      X.F3.seedList(S, 'D4', { wos: ['WO-6'], name: 'Lucan live' });
      X.F3.seedList(S, 'D5', { wos: ['WO-6'], name: 'Lucan archived', list: { archived: true } });
      X.F3.seedList(S, 'D6', { wos: ['WO-6'], name: 'Lucan template', list: { is_template: true } });
      X.F3.seedList(S, 'D7', { wos: ['WO-<i>7</i>'], name: 'H1' }); X.F3.seedList(S, 'D8', { wos: ['WO-<i>7</i>'], name: 'H2' });
      const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
      await p.evaluate(() => showTab('l')); await sleep(1000);
      const tags = await p.evaluate(() => [...document.querySelectorAll('[data-lhrow]')].map(r => ({ id: r.dataset.lhrow, tag: [...r.querySelectorAll('.lh-two')].map(x => x.textContent) })));
      const tg = id => (tags.find(x => x.id === id) || { tag: null }).tag;
      rec('WO-3 with two live lists: BOTH rows carry "⚠ 2 lists on WO-3"', JSON.stringify(tg('D1')) === '["⚠ 2 lists on WO-3"]' && JSON.stringify(tg('D2')) === '["⚠ 2 lists on WO-3"]', JSON.stringify(tags));
      rec('one list holding WO-4 twice (old data) is NOT flagged as two lists', !(tg('D3') || []).length, JSON.stringify(tg('D3')));
      rec('a live list + an ARCHIVED list + a TEMPLATE on WO-6 → not flagged', !(tg('D4') || []).length, JSON.stringify(tg('D4')));
      const xs = await p.evaluate(() => document.querySelectorAll('#lh i').length);
      rec('a WO number containing <i>HTML</i>: the tag shows it as text', xs === 0 && (tg('D7') || []).some(x => x.includes('WO-<i>7</i>')), JSON.stringify([xs, tg('D7')]));
      // archive one of the two → the tag goes
      await p.evaluate(() => { window.__confirm = true; const b = document.querySelector('[data-lharc="D2"]'); if (b) b.click(); }); await sleep(1500);
      await p.evaluate(() => render()); await sleep(600);
      const t2 = await p.evaluate(() => [...document.querySelectorAll('[data-lhrow="D1"] .lh-two')].length);
      rec('one of the two archived → the tag disappears from the other', t2 === 0, String(t2));
      // a second live list made on ANOTHER PC (database) shows up after a refresh
      X.F3.seedList(S, 'D9', { wos: ['WO-6'], name: 'Lucan from another PC' });
      await p.evaluate(async () => { lsReset(); await lsLoad(); render(); }); await sleep(900);
      const t3 = await p.evaluate(() => [...document.querySelectorAll('[data-lhrow="D4"] .lh-two')].map(x => x.textContent));
      rec('second live list made on another PC → tag on the first after a refresh', JSON.stringify(t3) === '["⚠ 2 lists on WO-6"]', JSON.stringify(t3));
      // phone: the tag does not push the page sideways
      await p.setViewportSize({ width: 360, height: 740 }); await sleep(500);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      rec('(info) phone 360: Cutting Lists page width with the tag', true, 'scrollWidth ' + sw);
      rec('2-lists tag: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
