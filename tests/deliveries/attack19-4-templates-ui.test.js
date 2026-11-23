// attack19-4 (Tester, 19 Nov 2026): the d19-6 template chooser and the d19-3 bar at the edges.
//  - project with 1 template / 12 templates (search box) / a template whose name is <img onerror> or has quotes
//  - a template whose every line is N/A (×) → told, not an empty list
//  - a template with unit (×) blocks inserted over the blank layout after a colour was picked
//  - 360 px phone: the chooser and the Deliveries selection bar (🚚 Book N reachable, no sideways scroll)
// Fake Supabase only. Run: node tests/deliveries/attack19-4-templates-ui.test.js
const L = require('../list-window/lw.js');
const { X, sleep, rec, closeAll, asks, setv, rows } = L;
const BLOCKS = [
  ['hdr', 'U1 900 Single Rail', '3', null, null, null, '', '', {}],
  ['saw', 'Side panel', '6', 2380, 570, 'MFC White', '', '', { section: 'U1 900 Single Rail', unit_qty: '2' }],
  ['saw', 'Base', '3', 864, 570, 'MFC White', '', '', { section: 'U1 900 Single Rail', unit_qty: '1' }],
  ['hdr', 'U2 500 Robe', '2', null, null, null, '', '', {}],
  ['saw', 'Shelf', '4', 464, 570, 'MFC White', '', '', { section: 'U2 500 Robe', unit_qty: '2' }]];
const blankRows = rs => rs.filter(r => !r.hdr && !r.item && !r.qty && !r.L && !r.W).length;
const ODD = '<img src=x onerror="window.__x=1">';
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const names = ['Type A', 'Type B', ODD, "O'Grady \"Special\" & Co", 'Type E', 'Type F', 'Type G', 'Type H', 'Type I', 'Type J', 'Type K', 'Blocks wardrobe'];
    names.forEach((n, i) => X.F3.seedList(S, 'T' + (i + 1), { wos: [], name: n, lines: n === 'Blocks wardrobe' ? BLOCKS : undefined, list: { is_template: true, type_name: n, list_type: 'house' } }));
    // Lucan (P2): exactly one template, and every line of it is N/A
    X.F3.seedList(S, 'TL', { wos: [], name: 'Lucan only', lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', '', { status: 'na' }], ['saw', 'Top', '1', 700, 560, 'MFC White', '', '', { status: 'na' }]], list: { is_template: true, type_name: 'Lucan only', list_type: 'house', project_id: 'P2' } });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // ---- 12 templates
    await p.evaluate(() => lsNewChoose('WO-3')); await sleep(800);
    const c12 = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return { q: !!document.getElementById('sfl-q'), n: document.querySelectorAll('[data-sfl]').length, btns: [...document.querySelectorAll('[data-sfl]')].map(b => b.textContent.trim()), x: !!window.__x, img: !!o.querySelector('img') }; });
    rec('12 templates: all 12 + Blank shown, with a search box', c12.q && c12.n === 13, JSON.stringify(c12.btns));
    rec('a template named <img onerror> shows as text (no element, no script)', !c12.x && !c12.img && c12.btns.some(b => b.includes('<img')), JSON.stringify(c12));
    rec("a template named O'Grady \"Special\" & Co shows its full name", c12.btns.some(b => b.includes("O'Grady \"Special\" & Co")), '');
    await p.fill('#sfl-q', 'grady'); await sleep(100);
    const vis = await p.evaluate(() => [...document.querySelectorAll('[data-sflq]')].filter(b => b.style.display !== 'none').map(b => b.textContent.trim()));
    rec('search "grady" finds the apostrophe template only', vis.length === 1 && /Grady/.test(vis[0]), JSON.stringify(vis));
    const blankVis = await p.evaluate(() => { const b = [...document.querySelectorAll('[data-sfl]')].find(x => !x.dataset.sfl); return b && b.style.display !== 'none'; });
    rec('…and "Blank standard layout" stays visible while searching', blankVis, '');
    await p.fill('#sfl-q', ''); await sleep(50);
    await p.evaluate(() => [...document.querySelectorAll('[data-sfl]')].find(b => /Grady/.test(b.textContent)).click()); await sleep(1500);
    const r1 = await rows(p);
    rec("picking the O'Grady template opens the window with its rows", r1.length > 0 && blankRows(r1) === 0, JSON.stringify(r1.map(r => r.item)));
    await closeAll(p);
    // ---- the template with unit blocks from the chooser
    await p.evaluate(() => lsNewChoose('WO-4')); await sleep(800);
    await p.evaluate(() => [...document.querySelectorAll('[data-sfl]')].find(b => /Blocks wardrobe/.test(b.textContent)).click()); await sleep(1500);
    const r2 = await rows(p);
    rec('a template with × unit blocks opens with both blocks and all parts, no blank rows', ['Side panel', 'Base', 'Shelf'].every(i => r2.some(r => r.item === i)) && r2.filter(r => r.hdr).length >= 2 && blankRows(r2) === 0, JSON.stringify(r2.map(r => (r.hdr ? '#' : '') + (r.item || '∅') + (r.qty ? ':' + r.qty : ''))));
    await closeAll(p);
    // ---- blank layout, a colour picked on an empty row, then insert the × block template (unit 1, × 2)
    await p.evaluate(() => lsNewStd('WO-4')); await sleep(900);
    const r3a = await rows(p); const j = r3a.findIndex(r => !r.hdr);
    const picked = await p.evaluate(j => { const s = document.querySelector('.me-ed [data-mr="' + j + '|mat"]'); const o = s && [...s.options].find(x => x.value && x.value !== '__add'); if (!o) return false; s.value = o.value; s.dispatchEvent(new Event('change')); s.focus(); return o.value; }, j); await sleep(200);
    await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); [...o.querySelectorAll('[data-itt]')].find(b => /Blocks wardrobe/.test(b.closest('.wl-drow').textContent)).click(); }); await sleep(900);
    const dlg = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o.innerText.replace(/\s+/g, ' ').slice(0, 300); });
    await p.evaluate(() => { const n = document.getElementById('it-n'); if (n) n.value = '2'; const ok = document.getElementById('it-ok'); if (ok) ok.click(); else { const hk = document.getElementById('it-hok'); hk && hk.click(); } }); await sleep(400);
    const r3 = await rows(p);
    rec('× block over the blank layout after a colour was picked: no blank rows, no empty standard sub-headings left', !!picked && blankRows(r3) === 0 && !r3.some(r => r.hdr && ['Fillers and Kickers', 'Worktops', 'Stores items'].includes(r.item)), JSON.stringify({ picked, dlg, r: r3.map(r => (r.hdr ? '#' : '') + (r.item || '∅') + (r.qty ? ':' + r.qty : '')) }));
    rec('…the block went in (U1 × 2 with its parts)', r3.some(r => r.hdr && /U1 900/.test(r.item)) && r3.some(r => r.item === 'Side panel'), JSON.stringify(r3.map(r => r.item)));
    await p.keyboard.press('Control+z'); await sleep(300);
    const r3u = await rows(p);
    rec('…Ctrl+Z gives back the blank layout WITH the colour that was picked', r3u.length === r3a.length && await p.evaluate(({ j, picked }) => { const s = document.querySelector('.me-ed [data-mr="' + j + '|mat"]'); return !!s && s.value === picked; }, { j, picked }), JSON.stringify([r3u.length, r3a.length]));
    await closeAll(p);
    // ---- Lucan: exactly one template, all N/A
    await p.evaluate(() => lsNewChoose('WO-6')); await sleep(800);
    const c1 = await p.evaluate(() => ({ ch: [...document.querySelectorAll('[data-sfl]')].map(b => b.textContent.trim()), ed: !!document.querySelector('.me-ed') }));
    rec('1 template: the chooser still asks (Lucan only / Blank)', c1.ch.length === 2 && !c1.ed, JSON.stringify(c1));
    if (c1.ch.length === 2) {
      await p.evaluate(() => [...document.querySelectorAll('[data-sfl]')].find(b => b.dataset.sfl).click()); await sleep(1500);
      const e = await p.evaluate(() => ({ err: (document.getElementById('sfl-err') || {}).textContent || '', ed: !!document.querySelector('.me-ed') }));
      rec('a template with every line N/A → "That template has no rows", no empty window', /no rows/.test(e.err) && !e.ed, JSON.stringify(e));
    }
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    // ---- 360 px phone
    const t2 = await X.dev(browser, S, 'design', { viewport: { width: 360, height: 740 } }), q = t2.page;
    await q.evaluate(async () => { lsReset(); await lsLoad(); lsNewChoose('WO-3'); }); await sleep(900);
    const ph = await q.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = [...document.querySelectorAll('[data-sfl]')]; return { sw: document.documentElement.scrollWidth, maxR: Math.max(...b.map(x => x.getBoundingClientRect().right)), any: !!o }; });
    rec('360 px: chooser buttons all fit on screen (no sideways scroll)', ph.any && ph.maxR <= 360 && ph.sw <= 362, JSON.stringify(ph));
    await closeAll(q);
    await t2.close();
    const t3 = await X.H.open({ browser, now: '2026-11-17T10:00:00Z', viewport: { width: 360, height: 740 }, row: { id: 'main', nid: 9, settings: {}, orders: [X.H.order({ wo: 'WO-2650-1', customer: 'A very long customer name Developments Ltd', title: 'House 1', dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16', step: '8. PALLETED', delv: true, value: 1000 })] } });
    const q3 = t3.page;
    await q3.evaluate(async () => { showTab('d'); await new Promise(r => setTimeout(r, 150)); });
    const chips = await q3.evaluate(() => [...document.querySelectorAll('.dchip')].map(c => c.dataset.dw));
    if (chips.length) {
      await q3.evaluate(w => { const c = document.querySelector('.dchip[data-dw="' + w + '"] .dtick'); c && c.click(); }, chips[0]); await sleep(150);
      const bar = await q3.evaluate(() => { const b = document.getElementById('selbook'), bar = document.getElementById('del-selbar'); if (!b) return null; const r = b.getBoundingClientRect(); return { r: r.right, w: r.width, h: r.height, sw: document.documentElement.scrollWidth, barR: bar.getBoundingClientRect().right, veh: !!document.getElementById('selveh'), day: !!document.getElementById('selday') }; });
      rec('360 px: the selection bar shows van, day and 🚚 Book inside the screen, tappable (≥ 34 px)', bar && bar.veh && bar.day && bar.r <= 360 && bar.h >= 34 && bar.sw <= 362, JSON.stringify(bar));
      const tick = await q3.evaluate(w => { const r = document.querySelector('.dchip[data-dw="' + w + '"] .dtick').getBoundingClientRect(); return { w: r.width, h: r.height }; }, chips[0]);
      rec('360 px: the ☐ tick is a usable tap target (≥ 24 px)', tick.w >= 24 && tick.h >= 24, JSON.stringify(tick));
    } else rec('360 px: a Deliveries card to tick', false, 'no chips');
    await t3.close();
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  L.finish();
})();
