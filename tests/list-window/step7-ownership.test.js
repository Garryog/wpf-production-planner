// Coder check (list window, step 7 — Garry 10–12 Nov): cutting lists are owned by the Drawing office (Johnny), not PMs.
// The PM screen shows each job's list status as plain text — no "make a list" button, no count, no nag. The Drawing office
// (and the office / Production Manager, who make lists today) keep "Cutting lists to issue".
// Fake Supabase only. Run: node tests/list-window/step7-ownership.test.js
const L = require('./lw.js');
const { X, H, sleep, rec } = L;
const rowTxt = (p, wo) => p.evaluate(wo => { const r = [...document.querySelectorAll('.dsh-row')].find(x => (x.querySelector('b') || {}).textContent === wo); return r ? r.innerText.replace(/\s+/g, ' ') : null; }, wo);

(async () => {
  const browser = await H.chromium.launch();
  try {
    { // lists switched ON
      const S = X.makeServer(X.v2Row());
      const t = await X.dev(browser, S, 'pm'), p = t.page; await sleep(500);
      const w1 = await rowTxt(p, 'WO-1'), w3 = await rowTxt(p, 'WO-3');
      rec('PM: WO-1 (has list "House 1") shows "cutting list made" as text', !!w1 && /cutting list made/.test(w1), w1);
      rec('PM: WO-3 (no list) shows "no cutting list yet" as text', !!w3 && /no cutting list yet/.test(w3), w3);
      const ui = await p.evaluate(() => ({ btns: [...document.querySelectorAll('.dsh-row button, .pm-ls button, .pm-ls a')].length,
        lsBtns: [...document.querySelectorAll('button')].filter(b => /New list|Make list|Add cutting list|Confirm|Issue/i.test(b.innerText)).map(b => b.innerText),
        nag: /Cutting lists needed|Cutting lists to issue|LISTS MISSING|LISTS TO ISSUE|LISTS LATE|waiting for a cutting list/i.test(document.body.innerText) }));
      rec('PM: the list status is read-only — no button on the job rows, no list-making button, no "lists needed" count or banner', !ui.btns && !ui.lsBtns.length && !ui.nag, JSON.stringify(ui));
      rec('PM: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
      // the Drawing office still gets the action list
      const d = await X.dev(browser, S, 'design'), dp = d.page; await sleep(800);
      const dt = await dp.evaluate(() => document.body.innerText);
      rec('Drawing office: "Cutting lists to issue" (the action list) is still on its screen', /Cutting lists to issue/i.test(dt), dt.slice(0, 300));
      await d.close();
    }
    { // lists switched OFF: the PM screen is exactly as before (no list text)
      const S = X.makeServer(X.v1Row());
      const t = await X.dev(browser, S, 'pm'), p = t.page; await sleep(500);
      const n = await p.evaluate(() => document.querySelectorAll('.pm-ls').length);
      rec('lists switched OFF: the PM screen shows no list status (as before)', n === 0, String(n));
      await t.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  L.finish();
})();
