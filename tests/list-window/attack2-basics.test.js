// Tester attack 2 (list window, 12 Nov evening): the small promises, attacked.
//  list name empty + searchable (Find old list, Lists page, templates) · WO drop-down (only the project's live jobs, earliest due
//  first, shipped / on hold / delivered out, "has a list") · "＋ New material…" first time · Qty placeholder · ✕ Close / unsaved
//  changes · <script> / quotes in customer / list names · lists switched OFF = the old screens exactly as on main.
// Fake Supabase only; main read with git show (read-only). Run: node tests/list-window/attack2-basics.test.js
const fs = require('fs'), path = require('path');
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const EV = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">', OG = "O'Grady \"Q\" & Sons";
const xss = p => p.evaluate(() => ({ x: window.__xss || 0, img: [...document.querySelectorAll('img')].filter(i => i.getAttribute('src') === 'x').length, scr: [...document.querySelectorAll('#app script, .pod-ovl script')].length }));
const closeQ = async p => { await p.evaluate(() => { window.__asked = []; window.__confirm = false; const b = document.getElementById('me-x0'); if (b) b.click(); }); await sleep(400); const r = await p.evaluate(() => ({ open: !!document.querySelector('.me-ed'), asked: window.__asked.slice() })); await p.evaluate(() => { window.__confirm = true; }); return r; };

function row() {
  const r = X.v2Row(), o = (wo, due, x) => H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor: 'T50', unit: wo.slice(3), title: 'HOUSE ' + wo, dueDate: due, origDueDate: due }, x || {}));
  r.orders.push(o('WO-D1', '2026-12-20'), o('WO-D2', '2026-11-02'), o('WO-D3', ''), o('WO-D4', 'TBC'), o('WO-D5', '2026-11-15'),
    o('WO-SH', '2026-11-01', { shippedAt: '2026-10-20T10:00:00Z' }), o('WO-HO', '2026-11-01', { cienHold: true }), o('WO-DL', '2026-11-01', { delDelivAt: '2026-10-20T10:00:00Z' }),
    o('WO-HL', '2026-11-05'),
    H.order({ wo: 'WO-X9', customer: EV + ' ' + OG, floor: EV, unit: OG, title: EV, dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-NP', customer: 'No Project Yet Ltd', floor: '1', unit: '1', title: 'K', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    X.F3.seedList(S, 'HL', { wos: ['WO-HL'], name: 'Has list' });
    for (let i = 0; i < 8; i++) X.F3.seedList(S, 'TP' + i, { wos: [], name: 'Template ' + i, list: { is_template: true, type_name: 'Type ' + i } });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);

    // ---- list name empty on open; Qty placeholder
    await p.evaluate(() => openListEditor(null, 'WO-D1')); await sleep(1000);
    const o1 = await p.evaluate(() => ({ name: document.getElementById('me-name').value, ph: (document.querySelector('.me-ed [data-mr="0|qty"]') || {}).placeholder, phName: document.getElementById('me-name').placeholder }));
    rec('list name EMPTY on open from a job (not the WO / title)', o1.name === '', JSON.stringify(o1));
    rec('empty Qty box shows "Qty"', o1.ph === 'Qty', JSON.stringify(o1));
    let c = await closeQ(p);
    rec('✕ Close with nothing typed (project set up by itself) → closes at once, nothing asked', !c.open && !c.asked.length, JSON.stringify(c));
    // typed then deleted back to empty → nothing to lose
    await p.evaluate(() => openListEditor(null, 'WO-D1')); await sleep(1000);
    await setv(p, '0|item', 'x'); await setv(p, '0|item', '');
    c = await closeQ(p);
    rec('typed one letter then deleted it → ✕ Close asks nothing (nothing to lose)', !c.open && !c.asked.length, JSON.stringify(c));
    // only the list name typed → asks
    await p.evaluate(() => openListEditor(null, 'WO-D1')); await sleep(1000);
    await setid(p, 'me-name', 'Kitchen — Type B');
    c = await closeQ(p);
    rec('only the List name typed → ✕ Close asks first; Cancel keeps it', c.open && c.asked.some(m => /Close without saving/.test(m)), JSON.stringify(c));
    // the list name typed is saved as typed and found by Find old list, the Lists page search and (as a template) the template search
    await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White'); await save(p, 2200);
    const lD1 = liveFor(S, 'WO-D1')[0];
    rec('typed list name saved exactly ("Kitchen — Type B")', lD1 && lD1.name === 'Kitchen — Type B', JSON.stringify(lD1 && lD1.name));
    await closeAll(p);
    await p.evaluate(() => { lsFindDlg('P1'); }); await sleep(600);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const q = o.querySelector('#fo-q'); q.value = 'type b'; q.dispatchEvent(new Event('input')); }); await sleep(400);
    let tx = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().innerText);
    rec('Find old list: "type b" finds "Kitchen — Type B"', /Kitchen — Type B/.test(tx), tx.replace(/\s+/g, ' ').slice(0, 200));
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const q = o.querySelector('#fo-q'); q.value = 'kitchen - type b'; q.dispatchEvent(new Event('input')); }); await sleep(400);
    tx = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().innerText);
    rec('[LOW] Find old list: typed with a plain hyphen "kitchen - type b" still finds "Kitchen — Type B" (long dash in the name)', /Kitchen — Type B/.test(tx), tx.replace(/\s+/g, ' ').slice(0, 200));
    await closeAll(p);
    // Save as template from the window with a typed name → found in "A template…" search
    await p.evaluate(() => openListEditor(null, 'WO-D2')); await sleep(1000);
    await fillSaw(p, 0, 'Robe side', '2', '2100', '560', 'MFC White'); await setid(p, 'me-name', 'Robe 900 single — <b>bold</b>');
    await click(p, 'me-astpl'); await sleep(700);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o.querySelector('#at-ok'); if (b) b.click(); }); await sleep(1800);
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
    await p.evaluate(() => openListEditor(null, 'WO-D5')); await sleep(1000);
    await p.evaluate(() => { const d = document.getElementById('me-start'); d.open = true; document.getElementById('me-instpl').click(); }); await sleep(700);
    const hasQ = await p.evaluate(() => !!document.getElementById('it-q'));
    if (hasQ) await p.evaluate(() => { const q = document.getElementById('it-q'); q.value = 'robe 900'; q.dispatchEvent(new Event('input')); }); await sleep(300);
    const vis = await p.evaluate(() => [...document.querySelectorAll('[data-itq]')].filter(r => r.style.display !== 'none').map(r => r.querySelector('b').textContent));
    rec('"A template…" (9 templates → search box): "robe 900" finds the template saved from the window, by its typed name', hasQ && vis.length >= 1 && vis.some(v => /Robe 900|robe/i.test(v)), JSON.stringify([hasQ, vis]));
    rec('…its name with <b>HTML</b> is shown as text', !(await p.evaluate(() => document.querySelectorAll('[data-itq] b b').length)));
    await closeAll(p);

    // ---- WO drop-down (no-WO path)
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(800);
    const opts = await p.evaluate(() => [...document.getElementById('me-wo').options].map(o => ({ v: o.value, t: o.textContent })).filter(o => o.v));
    const vs = opts.map(o => o.v);
    rec('WO drop-down: only Aderrig jobs (no Lucan WO-6, no other customers)', !vs.includes('WO-6') && !vs.includes('WO-X9') && !vs.includes('WO-NP'), JSON.stringify(vs));
    rec('WO drop-down: shipped, on hold and delivered jobs left out', !vs.includes('WO-SH') && !vs.includes('WO-HO') && !vs.includes('WO-DL'), JSON.stringify(vs));
    const iD2 = vs.indexOf('WO-D2'), iD5 = vs.indexOf('WO-D5'), iD1 = vs.indexOf('WO-D1'), iD3 = vs.indexOf('WO-D3'), iD4 = vs.indexOf('WO-D4');
    rec('WO drop-down: earliest due first (D2 2 Nov → D5 15 Nov → D1 20 Dec), no date / "TBC" last', iD2 >= 0 && iD2 < iD5 && iD5 < iD1 && iD3 > iD1 && iD4 > iD1, JSON.stringify(opts.map(o => o.t)));
    rec('WO drop-down: "has a list" on WO-HL (and WO-D1 / WO-D2 saved above), not on WO-D5', /has a list/.test((opts.find(o => o.v === 'WO-HL') || {}).t || '') && !/has a list/.test((opts.find(o => o.v === 'WO-D5') || {}).t || ''), JSON.stringify(opts.filter(o => /HL|D5|D1/.test(o.v)).map(o => o.t)));
    rec('WO drop-down: "TBC" due shows "due ?" (not "Invalid Date" / "NaN")', !opts.some(o => /Invalid|NaN|undefined/.test(o.t)), JSON.stringify(opts.filter(o => /D3|D4/.test(o.v)).map(o => o.t)));
    await closeAll(p);

    // ---- ＋ New material… first time: with a project (WO known) and with NO project yet (customer with no project)
    for (const [wo, lbl] of [['WO-D5', 'project known'], ['WO-NP', 'customer with no project yet']]) {
      await p.evaluate(wo => { window.__prompted = []; window.__prompt = m => /New material/.test(m) ? 'Egger W1100 ' + wo : 'Op'; openListEditor(null, wo); }, wo); await sleep(1500);
      await setv(p, '0|item', 'Door'); await setv(p, '0|qty', '1'); await setv(p, '0|L', '700'); await setv(p, '0|W', '400');
      const nmv = await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); const o = [...s.options].find(o => /new material/i.test(o.textContent)); return o ? o.value : null; });
      await setv(p, '0|mat', nmv); await sleep(1500);
      const r0 = (await rows(p))[0], asked = await p.evaluate(() => window.__prompted.filter(m => /New material/.test(m)).length);
      rec('"＋ New material…" first time (' + lbl + '): asked ONCE, the row gets "Egger W1100 ' + wo + '"', asked === 1 && r0.mat === 'Egger W1100 ' + wo, JSON.stringify({ asked, mat: r0.mat, nmv, msgs: await p.evaluate(() => window.__prompted) }));
      const pid = (await job(p)).pid;
      rec('…and it is in that project\'s materials in the database', S.db.t.project_materials.some(m => m.project_id === pid && m.name === 'Egger W1100 ' + wo), JSON.stringify([pid, S.db.t.project_materials.filter(m => /Egger/.test(m.name)).map(m => m.project_id + ':' + m.name)]));
      await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);
    }

    // ---- <script> / quotes everywhere
    await p.evaluate(() => { window.__xss = 0; openListEditor(null, 'WO-X9'); }); await sleep(2000);
    let x = await xss(p);
    const jx = await job(p);
    rec('WO whose customer / floor / title is <script> + <img onerror> + O\'Grady "Q": window opens, nothing runs', jx.open && !x.x && !x.img && !x.scr, JSON.stringify([x, jx.pm]));
    await fillSaw(p, 0, EV, '1', '500', '300', ''); await setid(p, 'me-name', EV + OG); await save(p, 2500);
    x = await xss(p);
    rec('…saved with that list name: Saved panel shows it as text, nothing runs', !!(await donep(p)) && !x.x && !x.img, JSON.stringify([x, (await donep(p) || {}).l]));
    await closeAll(p);
    await p.evaluate(() => render()); await sleep(800);
    x = await xss(p);
    rec('…Drawing office page (Lists table, flags, Cutting lists to issue) with those names: nothing runs', !x.x && !x.img && !x.scr, JSON.stringify(x));
    await p.evaluate(() => { const q = document.getElementById('lh-q'); if (q) { q.value = 'script'; q.dispatchEvent(new Event('input')); } }); await sleep(600);
    x = await xss(p);
    rec('…Lists page search "script" (finds it) — nothing runs', !x.x && !x.img && /<script>/.test(await p.evaluate(() => document.body.innerText)), JSON.stringify(x));
    const pm = await X.dev(browser, S, 'pm'); await sleep(800);
    x = await xss(pm.page);
    rec('…PM screen (customer section + list status text) with that customer: nothing runs', !x.x && !x.img && !x.scr, JSON.stringify(x));
    await pm.close();
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }

  // ---- lists switched OFF: every screen the same as main
  try {
    const mainHtml = A.gitShow('origin/main'), brHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
    const norm = s => s.replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'hh:mm').replace(/\d+ ?(s|sec|seconds?|min|minutes?) ago/g, 'n ago').replace(/\s+/g, ' ').trim();
    const shot = async (html, role, tabs) => {
      const S = X.makeServer(X.v1Row());
      const t = await A.openOld(browser, S, html), p = t.page;
      await p.evaluate(r => { localStorage.setItem('wpfPin_' + r, '9000'); localStorage.setItem('wpfOpName', 'Op'); sessionStorage.setItem('wpfWho', 'Op'); setRole(r); }, role); await sleep(700);
      const out = {};
      for (const tb of tabs) { if (tb) await p.evaluate(tb => showTab(tb), tb); await sleep(600); out[tb || '-'] = norm(await p.evaluate(() => document.getElementById('app').innerText)); }
      if (role === 'office') { await p.evaluate(() => { try { openListEditor(null, 'WO-3'); } catch (e) {} }); await sleep(800); out.editor = norm(await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); return o ? o.innerText : '(none)'; })); }
      out.errors = (S.oldErrors || []).length;
      await t.close(); return out;
    };
    for (const [role, tabs] of [['office', ['b', 'l', 'd', 'h', 'i', 'x', 's']], ['pm', ['']], ['prod', ['']], ['saw', ['']], ['stores', ['']], ['design', ['']], ['dash', ['']], ['floor', ['']], ['driver', ['']]]) {
      const a = await shot(mainHtml, role, tabs), b = await shot(brHtml, role, tabs);
      for (const k of Object.keys(a)) {
        if (k === 'errors') continue;
        const same = a[k] === b[k];
        let at = 0; if (!same) { while (at < a[k].length && a[k][at] === b[k][at]) at++; }
        const l10 = !same && k === 's' && /Storage on this device/.test(b[k]) && !/Storage on this device/.test(a[k]); // L10: Settings → 💾 Storage on this device (intended, plan L10)
        rec((l10 ? '(info, intended L10 storage panel) ' : '') + 'lists switched OFF: ' + role + (k !== '-' ? ' / ' + k : '') + ' screen text identical to main', same || l10, same ? '' : 'main: …' + a[k].slice(Math.max(0, at - 40), at + 120) + '  ||  branch: …' + b[k].slice(Math.max(0, at - 40), at + 120));
      }
      rec('lists switched OFF: ' + role + ' — no page errors on the branch', b.errors === 0, String(b.errors));
    }
  } catch (e) { rec('lists OFF: test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
