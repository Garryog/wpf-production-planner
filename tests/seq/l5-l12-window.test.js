// Part 4 (L5–L12, Garry's first live use of the list window, 10 Nov): the project fills itself from the WO's customer (L5),
// "＋ New material" always works and asks once (L6), Qty placeholder (L7), ✕ Close / Close / Esc and "Saved ✓" (L8),
// storage message + Settings panel (L10), WO drop-down = this project's jobs by due date (L11/L12), list name not pre-filled.
// Fake Supabase only. Run: node tests/seq/l5-l12-window.test.js
const X = require('../listwin/fixl.js');
const { H, D, rec, sleep } = X;
function row() {
  const r = X.v2Row();
  r.orders.push(
    H.order({ wo: 'WO-20', customer: 'Brand New Homes', floor: '7', unit: '231', title: 'APT TYPE 1', dueDate: '2026-11-14', origDueDate: '2026-11-14' }),
    H.order({ wo: 'WO-21', customer: 'Brand New Homes', floor: '7', unit: '232', title: 'APT TYPE 2', dueDate: '2026-11-12', origDueDate: '2026-11-12' }),
    H.order({ wo: 'WO-22', customer: '', floor: '1', unit: '1', title: 'NO CUSTOMER', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-23', customer: 'Twin Homes', floor: '1', unit: '2', title: 'TWO PROJECTS FIT', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-24', customer: 'Aderrig Homes', floor: 'T09', unit: '30', title: 'ON HOLD <b>x</b>', dueDate: '2026-11-05', origDueDate: '2026-11-05', cienHold: true }),
    H.order({ wo: 'WO-25', customer: 'Aderrig Homes', floor: 'T09', unit: '31', title: 'NO DUE', dueDate: '', origDueDate: '' }));
  return r;
}
const closeAll = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const ed = p => p.evaluate(() => !!document.querySelector('.me-ed'));
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    const t = await X.dev(browser, S, 'office'), p = t.page;

    // ---- L6: "＋ Add new material…" asks ONCE (a select fires input AND change)
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    const asked = await p.evaluate(async () => { window.__asked = []; const pr = window.prompt; window.prompt = m => { window.__asked.push(m); return /New material/.test(m) ? 'Walnut 18' : pr(m); };
      const s = document.querySelector('.me-ed [data-mr="0|mat"]'); s.value = '__add'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 900)); window.prompt = pr; return window.__asked.filter(m => /New material/.test(m)).length; });
    rec('L6: ＋ Add new material… asks for the name once (input + change both fire)', asked === 1, asked);
    await closeAll(p);

    // ---- L8: a click on the grey area outside the window does nothing
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    await p.evaluate(() => { const o = document.querySelector('.me-ed').closest('.pod-ovl'); o.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await sleep(100);
    rec('L8: click outside the window → the window stays open', await ed(p));
    await closeAll(p);

    // ---- L7: Qty shows "Qty" in the empty box like L and W; L6 wording
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    let w = await p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s); return { qty: q('[data-mr="0|qty"]').placeholder, L: q('[data-mr="0|L"]').placeholder, mats: q('#me-mats').textContent, dis: q('#me-mats').disabled }; });
    rec('L7: PC grid — the Qty box says "Qty" like "L" and "W"', w.qty === 'Qty' && w.L === 'L', JSON.stringify(w));
    rec('L6: "🧱 Project materials (add / edit)" beside the project, not greyed', /Project materials \(add \/ edit\)/.test(w.mats) && !w.dis, JSON.stringify(w));
    await closeAll(p);
    await p.evaluate(() => openListEditor(null, '', '')); await sleep(300);
    rec('L6: Project materials button not greyed with no project either', await p.evaluate(() => !document.getElementById('me-mats').disabled));
    await closeAll(p);
    await p.evaluate(() => { showTab('l'); }); await sleep(500);
    rec('L6: Lists home — the same "Project materials (add / edit)" wording', await p.evaluate(() => [...document.querySelectorAll('[data-lhmat]')].every(b => /Project materials \(add \/ edit\)/.test(b.textContent)) && document.querySelectorAll('[data-lhmat]').length > 0));
    // a project with no materials: "Set up project materials now" opens the materials window
    await p.evaluate(() => openListEditor(null, '', 'P2')); await sleep(300);
    rec('L6: no materials yet → "Set up project materials now" button', await p.evaluate(() => /This project has no materials yet/.test(document.querySelector('.me-ed').innerText) && !!document.getElementById('me-matsnow')));
    const nOv = await p.evaluate(() => document.querySelectorAll('.pod-ovl').length);
    await p.evaluate(() => document.getElementById('me-matsnow').click()); await sleep(300);
    rec('L6: the button opens the project materials window over the list', await p.evaluate(n => document.querySelectorAll('.pod-ovl').length === n + 1 && /Lucan/.test(document.querySelector('.pod-ovl:last-of-type').innerText), nOv));
    await closeAll(p);

    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
    // phone 360 px: the Qty card box has the placeholder too
    const ph = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
    await ph.page.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    rec('L7: phone card — the Qty box says "Qty"', await ph.page.evaluate(() => { const q = [...document.querySelectorAll('.me-ed .me-card [data-mr$="|qty"]')]; return q.length > 0 && q.every(e => e.placeholder === 'Qty'); }));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
