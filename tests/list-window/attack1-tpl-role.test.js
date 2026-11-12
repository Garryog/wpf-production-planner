// Tester attack (list window, 12 Nov): "Save as template" only for the Drawing office / Admin (Garry 10–12 Nov).
// Is the button absent for everyone else — and can a template still be made another way without that PIN?
// Fake Supabase only. Run: node tests/list-window/attack1-tpl-role.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows } = L;
const tpls = S => S.db.t.lists.filter(l => l.is_template);
const topTxt = p => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });

(async () => {
  const browser = await H.chromium.launch();
  try {
    for (const role of ['office', 'pm', 'prod', 'saw', 'stores', 'dash', 'design']) {
      const S = X.makeServer(X.v2Row());
      const t = await X.dev(browser, S, role), p = t.page;
      await asks(p);
      await p.evaluate(() => { localStorage.removeItem('wpfEditPin'); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
      const n0 = tpls(S).length;
      // (1) the window, new list from a job and an existing list
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
      const a = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), btn: !!document.getElementById('me-astpl'), save: !!document.getElementById('me-save') }));
      await closeAll(p);
      await p.evaluate(() => openListEditor('L1')); await sleep(800);
      const b = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), btn: !!document.getElementById('me-astpl') }));
      await closeAll(p);
      const want = role === 'design';
      rec(role + ': list window (new + existing) — "Save as template" ' + (want ? 'SHOWN' : 'absent'), a.btn === want && b.btn === want, JSON.stringify({ new: a, existing: b }));
      // (2) the Cutting Lists page: is there another "Save as template" there, and does it work with no PIN / the wrong PIN?
      const lp = await p.evaluate(async () => { try { showTab('l'); } catch (e) {} await new Promise(r => setTimeout(r, 500)); const bs = [...document.querySelectorAll('[data-lhastpl]')]; return { n: bs.length, vis: bs.filter(x => x.getBoundingClientRect().width > 0).length }; });
      if (!want) rec(role + ': Cutting Lists page — no "📐 Save as template" button on show either (fewest buttons; only Drawing office / Admin)', lp.vis === 0, JSON.stringify(lp));
      if (lp.n) {
        await p.evaluate(() => { window.__prompted = []; window.__prompt = '0000'; document.querySelector('[data-lhastpl]').click(); }); await sleep(900);
        let tx = await topTxt(p); const asked = await p.evaluate(() => window.__prompted.filter(m => /PIN/.test(m)).length);
        const dlg = /Save as template/.test(tx) && /Template name/.test(tx);
        if (!want) rec(role + ': Lists page "Save as template" with NO PIN remembered → asks for a PIN; a wrong PIN gets nowhere', role === 'prod' ? true : asked >= 1 && !dlg, JSON.stringify({ asked, dlg }));
        if (role === 'prod') rec('prod (Production Manager): Lists page "Save as template" → NOT let through without the Drawing office / Admin PIN (the window hides the button from him)', !dlg, JSON.stringify({ asked, dlg, tx: tx.slice(0, 80) }));
        await closeAll(p);
        if (role === 'office') {
          // the Production Manager PIN (not Drawing office, not Admin) typed at the Lists page
          await p.evaluate(() => { window.__prompted = []; window.__prompt = pins().prod; document.querySelector('[data-lhastpl]').click(); }); await sleep(900);
          tx = await topTxt(p);
          const d2 = /Save as template/.test(tx) && /Template name/.test(tx);
          rec('office + the PRODUCTION MANAGER PIN at the Lists page → "Save as template" still refused (only Drawing office / Admin)', !d2, tx.slice(0, 100));
          if (d2) { await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const n = o.querySelector('#at-name'); n.value = 'Sneaked in'; n.dispatchEvent(new Event('input')); o.querySelector('#at-ok').click(); }); await sleep(1500);
            rec('…and no template lands in the database that way', tpls(S).length === n0, JSON.stringify(tpls(S).map(l => l.name))); }
          await closeAll(p);
          // that PIN is now remembered on the PC: the window must still not show the button
          await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
          rec('office PC with the Production Manager PIN remembered → the window still has no "Save as template"', !(await p.evaluate(() => !!document.getElementById('me-astpl'))), await p.evaluate(() => localStorage.getItem('wpfEditPin')));
          await closeAll(p);
          // a NEW template from scratch (Lists page → new template) with the Production Manager PIN
          const n1 = tpls(S).length;
          await p.evaluate(() => { localStorage.setItem('wpfEditPin', pins().prod); openListEditor(null, '', 'P1', { tpl: true }); }); await sleep(700);
          const te = await ed(p);
          if (te) { await setid(p, 'me-name', 'PM made this'); await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White'); await save(p, 1800); }
          rec('(info) office PC with the Production Manager PIN remembered: a brand-new TEMPLATE can be typed and saved (Templates are "Production Manager, Drawing office or Admin" elsewhere in the app)', tpls(S).length === n1, JSON.stringify({ opened: te, templates: tpls(S).map(l => l.name) }));
          await closeAll(p);
          // Admin PIN remembered → button shows (allowed)
          await p.evaluate(() => { localStorage.setItem('wpfEditPin', pins().admin); openListEditor(null, 'WO-3'); }); await sleep(800);
          rec('office PC with the ADMIN PIN remembered → "Save as template" shown (allowed)', await p.evaluate(() => !!document.getElementById('me-astpl')));
          // …and it stays for whoever sits at that PC next (sign-in name changed)
          await closeAll(p);
          await p.evaluate(() => { sessionStorage.setItem('wpfWho', 'Someone else'); localStorage.setItem('wpfOpName', 'Someone else'); openListEditor(null, 'WO-3'); }); await sleep(800);
          rec('(info) …the Admin PIN stays remembered for the NEXT person at that PC (a different name signed in) — the button is still there', !(await p.evaluate(() => !!document.getElementById('me-astpl'))), 'wpfEditPin kept in this browser until cleared');
          await closeAll(p); await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
          // wording inside "Start from → A template…" when the project has none
          await p.evaluate(() => openListEditor(null, 'WO-6')); await sleep(900);
          await p.evaluate(() => document.getElementById('me-instpl').click()); await sleep(500);
          tx = await topTxt(p);
          rec('wording: "A template…" with no templates yet does not send the office to a button they don\'t have ("Save as template on any list")', !/Save as template<\/b> on any list|Save as template on any list/.test(tx) || !/Production Manager/.test(tx), tx.slice(0, 260));
          await closeAll(p);
        }
      }
      if (want) { // the Drawing office: the button works from the window
        await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
        await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await setid(p, 'me-name', 'Type DO');
        await click(p, 'me-astpl'); await sleep(700);
        const tx = await topTxt(p);
        rec('design (Drawing office): "Save as template" opens the template box with NO PIN asked', /Template name/.test(tx) && !(await p.evaluate(() => window.__prompted.some(m => /PIN/.test(m)))), tx.slice(0, 120));
        await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('#at-ok').click(); }); await sleep(1500);
        rec('design: the template is saved; the list window is still open with its row and NOTHING saved as a list', tpls(S).length === n0 + 1 && await ed(p) && (await rows(p))[0].item === 'Side' && !L.liveFor(S, 'WO-3').length, JSON.stringify([tpls(S).map(l => l.name), await ed(p)]));
        await closeAll(p);
      }
      rec(role + ': no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
