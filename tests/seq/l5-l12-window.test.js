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
    H.order({ wo: 'WO-25', customer: 'Aderrig Homes', floor: 'T09', unit: '31', title: 'NO DUE', dueDate: '', origDueDate: '' }),
    H.order({ wo: 'WO-26', customer: 'Race Homes', floor: '2', unit: '9', title: 'TWO PCS', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  return r;
}
const closeAll = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const ed = p => p.evaluate(() => !!document.querySelector('.me-ed'));
const asks = p => p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return window.__confirm !== undefined ? window.__confirm : true; }; });
const setv = (p, k, v) => p.evaluate(({ k, v }) => { const e = document.querySelector('.me-ed [data-mr="' + k + '"]'); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); }, { k, v });
const fillSaw = async (p, i, item, qty, L, W, mat) => { for (const [f, v] of [['item', item], ['qty', qty], ['L', L], ['W', W], ['mat', mat]]) await setv(p, i + '|' + f, v); };
const donep = p => p.evaluate(() => { const d = document.querySelector('.me-dov'); if (!d) return null;
  return { h: d.querySelector('#me-dok').textContent, l: d.querySelector('.me-dl').innerText, focus: (document.activeElement || {}).id, again: !!d.querySelector('#me-dagain'), editor: !!document.querySelector('.me-ed') }; });
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    D.insert(S.db, 'projects', { id: 'P3', name: 'Twin North', customer: 'Twin Homes', cien_names: [] });
    D.insert(S.db, 'projects', { id: 'P4', name: 'Twin South', customer: 'Twin Homes', cien_names: [] });
    const t = await X.dev(browser, S, 'office'), p = t.page;
    let w;

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
    // ✕ Close at the top right, inside a sticky bar; the bottom button says Close (not Cancel)
    w = await p.evaluate(() => { const x = document.getElementById('me-x0'), b = x && x.closest('.me-tb'), r = x && x.getBoundingClientRect(), o = document.querySelector('.me-ed').getBoundingClientRect();
      return { x: !!x, txt: x && x.textContent, sticky: b && getComputedStyle(b).position, right: r && o.right - r.right < 40, bottom: document.getElementById('pod-x').textContent }; });
    rec('L8: "✕ Close" top right in a sticky bar; the bottom button says "Close"', w.x && /✕ Close/.test(w.txt) && w.sticky === 'sticky' && w.right && w.bottom === 'Close', JSON.stringify(w));
    // nothing typed: ✕ closes without asking
    await asks(p);
    await p.evaluate(() => document.getElementById('me-x0').click()); await sleep(100);
    rec('L8: ✕ Close with nothing typed → closes, no question', !(await ed(p)) && !(await p.evaluate(() => window.__asked.length)), JSON.stringify(await p.evaluate(() => window.__asked)));
    // typed something: asked; Cancel → stays; OK → closes
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    await setv(p, '0|item', 'Side');
    await p.evaluate(() => { window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(100);
    rec('L8: ✕ Close after typing → "Close without saving?"; Cancel → stays open, row kept', await ed(p) && await p.evaluate(() => /Close without saving\?[\s\S]*What you typed in this list is lost/.test(window.__asked.pop() || '') && document.querySelector('[data-mr="0|item"]').value === 'Side'));
    await p.evaluate(() => { window.__confirm = false; document.getElementById('pod-x').click(); }); await sleep(100);
    rec('L8: bottom Close after typing → asked too; Cancel → stays', await ed(p) && await p.evaluate(() => /Close without saving/.test(window.__asked.pop() || '')));
    await p.evaluate(() => { window.__confirm = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(100);
    rec('L8: Esc after typing → asked; Cancel → stays', await ed(p) && await p.evaluate(() => /Close without saving/.test(window.__asked.pop() || '')));
    await p.evaluate(() => { window.__confirm = true; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(100);
    rec('L8: Esc, OK → closed', !(await ed(p)));
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    await p.evaluate(() => { window.__asked = []; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(100);
    rec('L8: Esc with nothing typed → closes, no question', !(await ed(p)) && await p.evaluate(() => !window.__asked.length));
    // another window over the list (materials): Esc is not the list's
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    await setv(p, '0|item', 'Side');
    await p.evaluate(() => { document.getElementById('me-mats').click(); }); await sleep(300);
    await p.evaluate(() => { window.__asked = []; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(100);
    rec('L8: Esc with the materials window on top → the list is not asked about or closed', await ed(p) && await p.evaluate(() => !window.__asked.length));
    await closeAll(p);
    await p.evaluate(() => { window.__confirm = undefined; });

    // ---- L8: the finish panel — four messages
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White');
    await p.evaluate(() => document.getElementById('me-save').click()); await sleep(900);
    w = await donep(p);
    rec('L8: saved → "Saved ✓ — list is with the Saw & Stores" + rows + WO, [Close] focused, [Edit it again]', w && /^Saved ✓ — list is with the Saw & Stores$/.test(w.h) && /1 saw row · no Stores · WO-2/.test(w.l) && w.focus === 'me-dclose' && w.again && !w.editor, JSON.stringify(w));
    await p.evaluate(() => document.getElementById('me-dagain').click()); await sleep(500);
    rec('L8: [Edit it again] opens the saved list in the editor', await p.evaluate(() => /Edit cutting list/.test((document.querySelector('.me-ed') || {}).innerText || '') && !document.querySelector('.me-dov')));
    await p.evaluate(() => document.getElementById('me-x0').click()); await sleep(100);
    rec('L8: …and ✕ closes it (nothing changed, no question)', !(await ed(p)));
    // the saw already has the WO-2 list (WO-2 due tomorrow): saving makes Rev 2
    await p.evaluate(() => openListEditor(lsCache().all.find(l => !l.tpl && !l.archived && (l.wos || []).includes('WO-2')).id)); await sleep(500);
    await setv(p, '0|note', 'changed');
    await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1200);
    w = await donep(p);
    rec('L8: revision → "Saved ✓ — Rev 2 is with the Saw & Stores"', w && /^Saved ✓ — Rev 2 is with the Saw & Stores$/.test(w.h), JSON.stringify(w) + (w ? '' : await p.evaluate(() => (document.getElementById('me-err') || {}).textContent)));
    await p.evaluate(() => document.getElementById('me-dclose').click()); await sleep(100);
    rec('L8: [Close] closes the panel', await p.evaluate(() => !document.querySelector('.pod-ovl')));
    // lists must be checked: waiting
    await p.evaluate(() => { DB.listChk = true; openListEditor(null, 'WO-3'); }); await sleep(400);
    await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White');
    await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1000);
    w = await donep(p);
    rec('L8: checking on → "Saved ✓ — waiting to be checked before the saw sees it"', w && /^Saved ✓ — waiting to be checked before the saw sees it$/.test(w.h), JSON.stringify(w));
    await p.evaluate(() => { DB.listChk = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(100);
    rec('L8: Esc closes the finish panel', await p.evaluate(() => !document.querySelector('.pod-ovl')));
    // a template
    await p.evaluate(() => { localStorage.setItem('wpfEditPin', pins().prod || pins().admin); openListEditor(null, '', 'P1', { tpl: true }); }); await sleep(400);
    await p.evaluate(() => { const n = document.getElementById('me-name'); n.value = 'Type Z'; n.dispatchEvent(new Event('input')); });
    await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White');
    await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1000);
    w = await donep(p);
    rec('L8: template → "Template saved ✓"', w && /^Template saved ✓$/.test(w.h), JSON.stringify(w));
    // a finish panel left open goes when another list window opens
    await p.evaluate(() => openListEditor(null, 'WO-25')); await sleep(300);
    rec('L8: opening another list window removes a finish panel left open', await p.evaluate(() => !document.querySelector('.me-dov') && document.querySelectorAll('.pod-ovl').length === 1));
    await closeAll(p);

    // ---- L7: Qty shows "Qty" in the empty box like L and W; L6 wording
    await p.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    w = await p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s); return { qty: q('[data-mr="0|qty"]').placeholder, L: q('[data-mr="0|L"]').placeholder, mats: q('#me-mats').textContent, dis: q('#me-mats').disabled }; });
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

    // ---- L5: the project fills itself from the WO's customer
    const projs = n => S.db.t.projects.filter(x => String(x.name).toLowerCase() === n.toLowerCase());
    const pst = () => p.evaluate(() => ({ pid: (document.getElementById('me-pid') || {}).value, pm: (document.getElementById('me-pm') || {}).innerText || '', open: !!document.querySelector('.me-ed') }));
    await asks(p);
    await p.evaluate(() => openListEditor(null, 'WO-20')); await sleep(900);
    w = await pst();
    const bn = projs('Brand New Homes');
    rec('L5: WO-20 (customer "Brand New Homes", no project) → project made at once, picked, grey "from the WO\'s customer"', bn.length === 1 && w.pid === bn[0].id && /Project: Brand New Homes — from the WO's customer/.test(w.pm) && JSON.stringify(bn[0].cien_names) === '["Brand New Homes"]' && bn[0].customer === 'Brand New Homes', JSON.stringify([w, bn]));
    rec('L5: no PIN asked to make it', await p.evaluate(() => !window.__asked.length));
    await p.evaluate(() => document.getElementById('me-x0').click()); await sleep(100);
    rec('L5: the project set by the app is not "typed" — ✕ closes with no question', !(await ed(p)) && await p.evaluate(() => !window.__asked.length));
    await p.evaluate(() => openListEditor(null, 'WO-21')); await sleep(900);
    w = await pst();
    rec('L5: WO-21 (same customer) → the same project, not a second one', projs('Brand New Homes').length === 1 && w.pid === bn[0].id, JSON.stringify(w));
    await closeAll(p);
    // two projects fit the customer → the person picks
    const n0 = S.db.t.projects.length;
    await p.evaluate(() => openListEditor(null, 'WO-23')); await sleep(900);
    w = await pst();
    rec('L5: customer fits two projects → "\'Twin Homes\' fits more than one project — pick one", nothing made', !w.pid && /'Twin Homes' fits more than one project — pick one/.test(w.pm) && S.db.t.projects.length === n0 && await p.evaluate(() => [...document.querySelectorAll('[data-mepp]')].map(b => b.dataset.mepp).sort().join() === 'P3,P4'), JSON.stringify(w));
    await p.evaluate(() => document.querySelector('[data-mepp="P4"]').click()); await sleep(200);
    w = await pst();
    rec('L5: tapping "Twin South" picks it', w.pid === 'P4' && !/fits more than one/.test(w.pm), JSON.stringify(w));
    await closeAll(p);
    // a WO with no customer
    await p.evaluate(() => openListEditor(null, 'WO-22')); await sleep(600);
    w = await pst();
    rec('L5: WO with no customer → "This WO has no customer in Cienapps — pick the project, or ＋ New project…"', !w.pid && /This WO has no customer in Cienapps — pick the project, or ＋ New project… at the bottom of the list/.test(w.pm) && S.db.t.projects.length === n0, JSON.stringify(w));
    await closeAll(p);
    // no WO: the picker, said plainly; Save says what to do
    await p.evaluate(() => openListEditor(null, '', '')); await sleep(400);
    w = await pst();
    rec('L5: list with no WO → "Pick the project — or ＋ New project… at the bottom of the list"', !w.pid && /Pick the project — or ＋ New project… at the bottom of the list/.test(w.pm), JSON.stringify(w));
    await fillSaw(p, 0, 'Side', '1', '700', '500', '');
    await p.evaluate(() => { const n = document.getElementById('me-name'); n.value = 'x'; n.dispatchEvent(new Event('input')); document.getElementById('me-save').click(); }); await sleep(200);
    rec('L5: Save with no project → "Pick the project — or ＋ New project… at the bottom of the list."', await p.evaluate(() => /Pick the project — or ＋ New project… at the bottom of the list\./.test(document.getElementById('me-err').textContent)));
    // ＋ New project… in the window: no PIN, the name asked once
    await p.evaluate(() => { localStorage.removeItem('wpfEditPin'); window.__pq = []; window.__pr0 = window.prompt; window.prompt = (m, d) => { window.__pq.push(m); return /New project name/.test(m) ? 'Fresh Site' : null; };
      const s = document.getElementById('me-pid'); s.value = '__new'; s.dispatchEvent(new Event('change')); }); await sleep(600);
    w = await pst();
    const fs = projs('Fresh Site');
    rec('L5: ＋ New project… in the window → no PIN, project made and picked', fs.length === 1 && w.pid === fs[0].id && await p.evaluate(() => window.__pq.length === 1 && !window.__pq.some(m => /PIN/.test(m))), JSON.stringify([w, await p.evaluate(() => window.__pq)]));
    await p.evaluate(() => { window.prompt = window.__pr0; });
    await closeAll(p);

    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
    // two PCs open a list for WO-26 (customer "Race Homes", no project) at the same moment → one project
    const [a1, a2] = await Promise.all([X.dev(browser, S, 'office'), X.dev(browser, S, 'office')]);
    await Promise.all([a1.page.evaluate(() => openListEditor(null, 'WO-26')), a2.page.evaluate(() => openListEditor(null, 'WO-26'))]); await sleep(1500);
    const rh = S.db.t.projects.filter(x => /^race homes$/i.test(x.name));
    const pids = await Promise.all([a1, a2].map(a => a.page.evaluate(() => (document.getElementById('me-pid') || {}).value)));
    rec('L5: two PCs at once → ONE project "Race Homes", both windows on it', rh.length === 1 && pids.every(x => x === rh[0].id), JSON.stringify([rh.map(x => x.id), pids]));
    await a1.close(); await a2.close();
    // phone 360 px: the Qty card box has the placeholder too
    const ph = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
    await ph.page.evaluate(() => openListEditor(null, 'WO-2')); await sleep(300);
    rec('L7: phone card — the Qty box says "Qty"', await ph.page.evaluate(() => { const q = [...document.querySelectorAll('.me-ed .me-card [data-mr$="|qty"]')]; return q.length > 0 && q.every(e => e.placeholder === 'Qty'); }));
    await ph.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
