// Garry, 13 Nov 2026 (plan question 12, answer B): the Production Manager may make and change templates too — with the Drawing
// office and Admin. Everyone else is still refused, and a PIN REMEMBERED on a shared PC still never opens templates.
// This file is the rule as it stands; older attack files that expect the Production Manager to be refused are out of date
// (listed on docs/ACCEPTED-FAILURES.md). Fake Supabase only.  Run: node tests/list-window/g13-prod-templates.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, ed, asks, setid, fillSaw, save } = L;
const tpls = S => S.db.t.lists.filter(l => l.is_template && !l.archived);
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    for (const role of ['prod', 'design', 'office', 'pm', 'saw']) {
      const r = X.v2Row(); const S = X.makeServer(r);
      X.F3.seedList(S, 'T1', { wos: [], name: 'Type B', list: { is_template: true, type_name: 'Type B', list_type: 'kitchen' } });
      const t = await X.dev(browser, S, role), p = t.page; await asks(p);
      await p.evaluate(async () => { localStorage.removeItem('wpfEditPin'); lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); });
      const PIN = await p.evaluate(() => pins());
      const may = role === 'prod' || role === 'design';
      rec(role + ': lsTplSaveOk() is ' + may, (await p.evaluate(() => lsTplSaveOk())) === may);
      // new template, straight from this screen
      const tryNew = async (ans, name) => { const n0 = tpls(S).length;
        await p.evaluate(a => { window.__prompt = a; window.__prompted = []; openListEditor(null, '', 'P1', { tpl: true }); }, ans); await sleep(700);
        const open = await ed(p), asked = await p.evaluate(() => window.__prompted.filter(m => /PIN/.test(m)).length);
        if (open) { await setid(p, 'me-name', name); await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White'); await save(p, 1800); }
        await closeAll(p); return { open, asked, made: tpls(S).length - n0 }; };
      if (may) {
        const a = await tryNew('0000', 'Made by ' + role);
        rec(role + ' screen: ＋ New template opens with NO PIN asked and saves a template', a.open && a.asked === 0 && a.made === 1, JSON.stringify(a));
      } else {
        const wrong = await tryNew('0000', 'x');
        rec(role + ' screen: ＋ New template with a wrong PIN → asked, refused, nothing made', !wrong.open && wrong.asked === 1 && wrong.made === 0, JSON.stringify(wrong));
        for (const [who, pin, ok] of [['Production Manager', PIN.prod, true], ['Drawing office', PIN.design, true], ['Admin', PIN.admin, true], ['Office', PIN.office, false], ['PM (site)', PIN.pm, false], ['Saw', PIN.saw, false]]) {
          const a = await tryNew(pin, 'Typed ' + who + ' on ' + role);
          rec(role + ' screen: the ' + who + ' PIN typed when asked → ' + (ok ? 'opens and saves' : 'refused'), a.asked === 1 && (ok ? a.open && a.made === 1 : !a.open && a.made === 0), JSON.stringify(a));
        }
        // a remembered PIN (even the Production Manager's) never opens templates by itself: the PIN is still asked
        await p.evaluate(P => localStorage.setItem('wpfEditPin', P.prod), PIN);
        const rem = await tryNew(null, 'x');
        rec(role + ' screen: Production Manager PIN REMEMBERED on the PC → still asked; Cancel → nothing opens', !rem.open && rem.asked === 1 && rem.made === 0, JSON.stringify(rem));
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
      }
      // the window from a job: the Save as template button
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(800);
      const btn = await p.evaluate(() => !!document.getElementById('me-astpl')); await closeAll(p);
      rec(role + ': list window from a job — "Save as template" ' + (may ? 'shown' : 'not shown'), btn === may, String(btn));
      rec(role + ': no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.ctx.close().catch(() => {});
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
