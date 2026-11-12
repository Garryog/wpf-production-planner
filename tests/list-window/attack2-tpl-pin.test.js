// Tester attack ROUND 2 (list window, 12 Nov): "Save as template" — Drawing office / Admin only, everywhere (Garry Q3).
// Every role, every way in (Lists page row button, the window, calling lsSaveAsTpl directly as any other button would),
// remembered and typed PINs. A refused attempt must leave the existing templates exactly as they were.
// Fake Supabase only. Run: node tests/list-window/attack2-tpl-pin.test.js
const L = require('./lw.js');
const { X, D, sleep, rec, closeAll, asks } = L;
const tpls = S => S.db.t.lists.filter(l => l.is_template);
const tplSnap = S => JSON.stringify([tpls(S), S.db.t.list_lines.filter(x => tpls(S).some(t => t.id === x.list_id))]);
const dlgOpen = p => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return !!o && /Save as template/.test(o.innerText) && !!o.querySelector('#at-name'); });
const seedTpl = S => {
  X.F3.seedList(S, 'T1', { wos: [], name: 'Type B', list: { is_template: true, type_name: 'Type B', list_type: 'kitchen', rev: 1 } });
  X.F3.seedList(S, 'L2', { wos: ['WO-3'], name: 'Type B' }); // a live list with the SAME name as the template → the dialog would offer "Update template"
};
// call lsSaveAsTpl straight (as any button would) with a typed answer to the PIN question; then press the dialog's Save if it opened
const attempt = async (p, src, answer, press) => {
  await p.evaluate(({ src, answer }) => { window.__prompted = []; window.__prompt = answer; try { lsSaveAsTpl(src); } catch (e) { window.__perr = String(e); } }, { src, answer });
  await sleep(900);
  const open = await dlgOpen(p), asked = await p.evaluate(() => window.__prompted.filter(m => /PIN/.test(m)).length);
  if (open && press) { await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const r = o.querySelector('[name="at-mode"][value="upd"]'); if (r) { r.checked = true; r.dispatchEvent(new Event('change')); } }); await sleep(200);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('#at-ok').click(); }); await sleep(1800); }
  await closeAll(p);
  return { open, asked };
};

(async () => {
  const browser = await X.H.chromium.launch();
  try {
    for (const role of ['office', 'pm', 'prod', 'saw', 'stores', 'design']) {
      const S = X.makeServer(X.v2Row()); seedTpl(S);
      const t = await X.dev(browser, S, role), p = t.page; await asks(p);
      await p.evaluate(async () => { localStorage.removeItem('wpfEditPin'); lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
      const PIN = await p.evaluate(() => pins());
      const t0 = tplSnap(S), allowed = role === 'design';
      // Lists page, row buttons
      const lp = await p.evaluate(async () => { try { showTab('l'); } catch (e) { return { err: String(e) }; } await new Promise(r => setTimeout(r, 500));
        return { n: [...document.querySelectorAll('[data-lhastpl]')].filter(x => x.getBoundingClientRect().width > 0).length, rows: document.querySelectorAll('[data-lhrow]').length }; });
      rec(role + ': Cutting Lists page — "📐 Save as template" on show: ' + (allowed ? 'yes' : 'NO'), allowed ? lp.n > 0 : !lp.n, JSON.stringify(lp));
      if (!allowed) {
        const src = { id: 'L2' }, srcTyped = { pid: 'P1', name: 'Type B', tname: 'Type B', ltype: 'kitchen', lines: [{ k: 'part', item: 'SNEAKED Side', qty: '9', L: '999', W: '999', mat: 'MFC White' }] };
        for (const [what, ans] of [['Cancel', null], ['a wrong PIN "0000"', '0000'], ['an empty answer', ''], ['the Production Manager PIN', PIN.prod], ['the office PIN', PIN.office], ['the PM PIN', PIN.pm], ['this screen\'s own PIN (' + role + ')', PIN[role]], ['the saw PIN', PIN.saw]]) {
          const r = await attempt(p, src, ans, true);
          rec(role + ': lsSaveAsTpl (Lists page route) answered with ' + what + ' → asked for the PIN, NO dialog', r.asked === 1 && !r.open, JSON.stringify(r));
          const r2 = await attempt(p, srcTyped, ans, true);
          rec(role + ': lsSaveAsTpl (window route, rows that would UPDATE template "Type B") with ' + what + ' → NO dialog', !r2.open, JSON.stringify(r2));
        }
        rec(role + ': after all refused attempts the existing template "Type B" (T1) and its rows are byte-for-byte untouched, and no new template', tplSnap(S) === t0, JSON.stringify(tpls(S).map(x => x.name + ' rev ' + x.rev)));
        rec(role + ': a refused PIN is NOT remembered on this PC', await p.evaluate(P => { const v = localStorage.getItem('wpfEditPin'); return !v || ![P.design, P.admin].includes(v); }, PIN), await p.evaluate(() => localStorage.getItem('wpfEditPin')));
        // Production Manager PIN REMEMBERED (from materials, which still take it) → no way through
        await p.evaluate(P => localStorage.setItem('wpfEditPin', P.prod), PIN);
        const r3 = await attempt(p, src, PIN.prod, true);
        rec(role + ': Production Manager PIN remembered on the PC (it still opens materials) → Save as template still asks and refuses it', !r3.open && r3.asked === 1, JSON.stringify(r3));
        const lp2 = await p.evaluate(async () => { render(); await new Promise(r => setTimeout(r, 300)); return [...document.querySelectorAll('[data-lhastpl]')].filter(x => x.getBoundingClientRect().width > 0).length; });
        rec(role + ': …and the Lists page rows still have no "Save as template" button', lp2 === 0, String(lp2));
        rec(role + ': …template T1 still untouched', tplSnap(S) === t0);
        // Drawing office PIN typed → allowed (and the template is updated only when the dialog's Save is pressed)
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
        const r4 = await attempt(p, src, ' ' + PIN.design + ' ', false);
        rec(role + ': the Drawing office PIN typed (with spaces) → the Save as template box opens (allowed by PIN)', r4.open, JSON.stringify(r4));
        rec(role + ': …opened and closed without pressing Save → template T1 untouched', tplSnap(S) === t0);
        const rem = await p.evaluate(() => localStorage.getItem('wpfEditPin'));
        const lp3 = await p.evaluate(async () => { render(); await new Promise(r => setTimeout(r, 300)); return [...document.querySelectorAll('[data-lhastpl]')].filter(x => x.getBoundingClientRect().width > 0).length; });
        rec('(info) ' + role + ': once the Drawing office PIN is typed it stays remembered on this PC (' + JSON.stringify(rem) + ') — every later person at this ' + role + ' PC gets "Save as template" (' + lp3 + ' buttons) with no PIN', !rem, 'no sign-out / time-out for the remembered PIN');
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
        // Admin PIN
        const r5 = await attempt(p, src, PIN.admin, false);
        rec(role + ': the Admin PIN typed → allowed', r5.open, JSON.stringify(r5));
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
        // other ways to make a template with the Production Manager PIN (Garry Q3: "Drawing office / Admin only, everywhere")
        if (role === 'office') {
          const n1 = tpls(S).length;
          await p.evaluate(P => { window.__prompt = P.prod; window.__prompted = []; LH.proj = 'P1'; LH.kind = 'tpl'; render(); }, PIN); await sleep(400);
          const nb = await p.evaluate(() => { const b = document.getElementById('lh-newtpl'); if (!b) return 'no button'; b.click(); return 'ok'; }); await sleep(800);
          const opened = await L.ed(p);
          if (opened) { await L.setid(p, 'me-name', 'PM-PIN template'); await L.fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White'); await L.save(p, 2000); }
          rec('(info, ask Garry) office + the PRODUCTION MANAGER PIN: "＋ New template" on the Lists page still makes a brand-new template (Save as template refuses that PIN; this route does not)', tpls(S).length === n1, JSON.stringify({ nb, opened, tpls: tpls(S).map(x => x.name) }));
          await closeAll(p); await p.evaluate(() => { localStorage.removeItem('wpfEditPin'); LH.kind = 'live'; render(); });
        }
      } else {
        // the Drawing office: allowed, no PIN; Update template really updates and only then
        const r = await attempt(p, { id: 'L2' }, null, false);
        rec('design: lsSaveAsTpl with no PIN asked → the dialog opens', r.open && r.asked === 0, JSON.stringify(r));
        rec('design: opened and closed without Save → template untouched', tplSnap(S) === t0);
      }
      rec(role + ': no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
