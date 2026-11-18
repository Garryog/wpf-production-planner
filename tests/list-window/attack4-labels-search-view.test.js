// Tester attack ROUND 4 (16 Nov) on: (1) labels one per 101.6 × 63.5 mm Zebra label (printLabels) — 40 labels, long house /
// item / customer names, many WOs, HTML in names, the pack label's black frame when printed, page count = label count when
// printed to PDF (preferCSSPageSize); (2) "👁 View the list" on the Saved ✓ panel (#me-dview → lsViewDlg) for a list, a
// template and a list archived on another screen, on a PC and a phone; (3) the search box on "Cutting lists to issue"
// (#lti-q, ltiQMatch): typing fast, a refresh in the middle of typing, HTML / quotes / regex characters, few jobs;
// (4) the saw's default owner text and who may make templates (lsTplSaveOk). Fake Supabase only.
// Run: node tests/list-window/attack4-labels-search-view.test.js
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, asks, setv, fillSaw, donep, rows } = L;
const PROC = '5. WORK ORDER PROCESSED';
const LONG_ITEM = 'Tall larder unit end panel — left hand, scribed to wall, with 2 × 32 mm system holes both edges and a 6 mm groove for the back panel (check drawing D-114 rev C)';
const EVIL = '<img src=x onerror="window.__xss=1">';
const sawRows = (n, item) => Array.from({ length: n }, (_, i) => ['saw', (item || 'Part') + ' ' + (i + 1), String(1 + (i % 4)), 300 + i, 200 + i, 'MFC White', '', '']);
const labelsHtml = (p, ids, mode) => p.evaluate(({ ids, mode }) => { window.__opened = []; printLabels(ids.map(id => lists().find(l => l.id === id) || lsList(id)).filter(Boolean), mode); return window.__opened.slice(-1)[0] || ''; }, { ids, mode });
// render a label page and measure every label: what is cut off (clipped by the label edge) and what the house line shows
async function measure(browser, html, media) {
  const pg = await browser.newPage(); await pg.setContent(html.replace(/<script>[\s\S]*?<\/script>/, '')); if (media) await pg.emulateMedia({ media });
  const m = await pg.evaluate(() => [...document.querySelectorAll('.lb')].map(lb => { const b = lb.getBoundingClientRect(), cs = getComputedStyle(lb), pb = parseFloat(cs.paddingBottom) || 0;
    const cut = [...lb.children].filter(c => { const r = c.getBoundingClientRect(); return r.height > 0 && r.bottom > b.bottom - pb + 0.5; }).map(c => c.className);
    const hs = lb.querySelector('.lb-house');
    return { hd: lb.classList.contains('lb-hd'), cut, house: hs ? hs.textContent : '', houseCut: hs ? hs.scrollWidth > hs.clientWidth + 1 : false, bg: cs.backgroundColor, bw: cs.borderTopWidth, bc: cs.borderTopColor, w: Math.round(b.width), h: Math.round(b.height) }; }));
  const xss = await pg.evaluate(() => !!window.__xss);
  let pages = null;
  if (media === 'print' || !media) { const pdf = await pg.pdf({ preferCSSPageSize: true }); pages = [...pdf.toString('latin1').matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(x => [Math.round(+x[1] / 72 * 25.4 * 10) / 10, Math.round(+x[2] / 72 * 25.4 * 10) / 10]); }
  await pg.close(); return { m, xss, pages };
}

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    const o = (wo, c, floor, unit, title) => H.order({ wo, customer: c, floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC });
    r.orders.push(o('WO-L22', 'Aderrig Homes', 'T09', '22', 'HOUSE 22'), o('WO-L23', 'Aderrig Homes', 'T09', '23', 'HOUSE 23'),
      o('WO-OG1', "O'Grady & Sons (Ballinasloe) Ltd", 'G', '1', 'APT 1 KITCHEN'), o('WO-OG2', "O'Grady & Sons (Ballinasloe) Ltd", 'G', '2', 'APT 2 KITCHEN'),
      o('WO-EV', EVIL, 'X', '1', EVIL + ' "quoted" title'), o('WO-Q1', 'Lucan Homes', 'A1', '5', 'TYPE A KITCHEN'), o('WO-Q2', 'Lucan Homes', 'A1', '6', 'TYPE A KITCHEN'));
    const S = X.makeServer(r);
    X.F3.seedList(S, 'L40', { wos: ['WO-3'], name: 'House 40', lines: sawRows(39) });
    X.F3.seedList(S, 'LN22', { wos: ['WO-L22', 'WO-4', 'WO-6', 'WO-Q1', 'WO-Q2', 'WO-OG1'], name: 'Aderrig Phase 2 Block C Type B — House 22', lines: [['saw', LONG_ITEM, '2', 2400, 600, 'MFC White 18 mm Egger W1000 ST9 Premium White', '1mm ABS', 'Fit after the worktop template is back from site — ask John before cutting'], ['fit', LONG_ITEM, '4', null, null, 'Blum hinge', '', '']] });
    X.F3.seedList(S, 'LN23', { wos: ['WO-L23'], name: 'Aderrig Phase 2 Block C Type B — House 23', lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', '']] });
    X.F3.seedList(S, 'LEV', { wos: ['WO-EV'], name: EVIL + " O'Grady 🏠 \"x\"", lines: [['saw', EVIL + ' 🪚', '1', 500, 400, 'MFC White', '', EVIL]] });
    X.F3.seedList(S, 'LNONE', { wos: ['WO-Q2'], name: 'Fittings only', lines: [['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']] });
    const t = await X.dev(browser, S, 'saw'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); for (const id of ['L40', 'LN22', 'LN23', 'LEV', 'LNONE']) { try { await lsReloadList(id); } catch (e) {} } });

    // ---------- 1. labels ----------
    {
      const h = await labelsHtml(p, ['L40'], 'saw'); const r1 = await measure(browser, h, 'print');
      rec('L1 a 39-row list → 40 labels (pack + 39) and, printed to PDF, 40 pages each 101.6 × 63.5 mm', r1.m.length === 40 && r1.pages && r1.pages.length === 40 && r1.pages.every(s => Math.abs(s[0] - 101.6) < 0.6 && Math.abs(s[1] - 63.5) < 0.6), JSON.stringify([r1.m.length, r1.pages && r1.pages.length, r1.pages && r1.pages[0]]));
      rec('L1 …nothing cut off on any of the 40 labels', r1.m.every(x => !x.cut.length), JSON.stringify(r1.m.filter(x => x.cut.length).slice(0, 2)));
      const two = await labelsHtml(p, ['L40', 'LN22', 'LN23'], 'saw'); const r2 = await measure(browser, two, 'print');
      rec('L2 three lists at once (40 + 2 + 2 labels) → 44 printed pages', r2.pages && r2.pages.length === r2.m.length && r2.m.length === 44, JSON.stringify([r2.m.length, r2.pages && r2.pages.length]));
      const lg = await labelsHtml(p, ['LN22', 'LN23'], 'saw'); const r3 = await measure(browser, lg, 'print');
      const part = r3.m.filter(x => !x.hd);
      rec('[MEDIUM] L3 a 150-letter item name, long material and note → the label still shows the material and the WO / floor-unit line (nothing cut off the bottom of the label)', part.every(x => !x.cut.length), JSON.stringify(r3.m.map(x => x.cut)));
      rec('(info) L3 long house names are cut with "…" on one line: "Aderrig Phase 2 Block C Type B — House 22" / "— House 23" — the house number is ' + (r3.m.every(x => !x.houseCut) ? 'visible' : 'CUT OFF (the WO line below tells them apart)'), true, JSON.stringify(r3.m.map(x => x.houseCut)));
      const hd = r3.m.find(x => x.hd), bw = parseFloat(hd.bw);
      rec('L4 printed: the pack label is a white label with a thick black frame (about 1.2 mm), no dark fill', /rgba?\(255, 255, 255/.test(hd.bg) && bw >= 4 && bw <= 5.5 && /rgb\(0, 0, 0\)/.test(hd.bc), JSON.stringify(hd));
      const r3s = await measure(browser, lg, 'screen'); const hds = r3s.m.find(x => x.hd);
      rec('(info) L4 on screen (preview) the pack label is still the dark-blue block', true, hds.bg);
      rec('[MEDIUM] L5 six work orders on one list (pack label) → the WO line is not cut off', !hd.cut.includes('lb-wos'), JSON.stringify(hd.cut));
      const ev = await labelsHtml(p, ['LEV'], 'saw'); const r4 = await measure(browser, ev, 'print');
      rec('L6 HTML / quotes / emoji in the house, item and note → shown as text, nothing runs', !r4.xss && !/<img src=x/.test(ev) && /O&#39;Grady|O'Grady/.test(ev), JSON.stringify([r4.xss, r4.m.map(x => x.house)]));
      const ft = await labelsHtml(p, ['LN22'], 'fit'); const r5 = await measure(browser, ft, 'print');
      rec('L7 Stores labels (fittings) with a 150-letter item → one page per label, nothing cut off', r5.pages.length === r5.m.length && r5.m.every(x => !x.cut.length), JSON.stringify([r5.pages.length, r5.m.length, r5.m.map(x => x.cut)]));
      const nf = await labelsHtml(p, ['LNONE'], 'saw'); const r6 = await measure(browser, nf, 'print');
      rec('L8 a list with no saw rows → saw labels = the pack label only, 1 page', r6.m.length === 1 && r6.pages.length === 1, JSON.stringify([r6.m.length, r6.pages.length]));
    }
    await t.ctx.close().catch(() => {});

    // ---------- 2. 👁 View the list on the Saved ✓ panel ----------
    for (const vw of [{ width: 1280, height: 800 }, { width: 360, height: 640 }]) {
      const td = await X.dev(browser, S, 'design', { viewport: vw }), pd = td.page; await asks(pd);
      await pd.evaluate(async () => { lsReset(); await lsLoad(); });
      await pd.evaluate(() => openListEditor(null, 'WO-OG1')); await sleep(1100);
      const i = (await rows(pd)).findIndex(x => !x.hdr); await fillSaw(pd, i, EVIL + " O'Grady", '2', '720', '560', 'MFC White'); await sleep(150);
      await pd.evaluate(() => document.getElementById('me-save').click()); await sleep(2500);
      const dn = await donep(pd);
      rec('V1 ' + vw.width + ' px: Saved ✓ panel has 👁 View the list', !!dn && /View the list/.test(dn.html), JSON.stringify(dn && dn.h));
      await pd.evaluate(() => document.getElementById('me-dview').click()); await sleep(800);
      const v = await pd.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && (o.querySelector('.pod-in') || o); return { n: document.querySelectorAll('.pod-ovl').length, txt: o ? o.innerText : '', print: !!document.getElementById('lv-print'), side: b ? b.scrollWidth - b.clientWidth : 0, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, xss: !!window.__xss }; });
      rec('V1 ' + vw.width + ' px: View shows the list just saved (with the HTML name as text), 🖨 Print, nothing runs', v.n === 1 && /O'Grady/.test(v.txt) && /<img/.test(v.txt) && v.print && !v.xss, JSON.stringify([v.n, v.print, v.xss, v.txt.slice(0, 120)]));
      rec('V1 ' + vw.width + ' px: no sideways scroll on the page', v.doc <= 0, JSON.stringify([v.side, v.doc]));
      await pd.keyboard.press('Escape'); await sleep(300);
      rec('[LOW, already so on live for every View window] V1 ' + vw.width + ' px: Esc closes the view', !(await pd.evaluate(() => document.querySelectorAll('.pod-ovl').length)));
      if (vw.width === 1280) {
        // a template saved → panel → View
        X.F3.seedList(S, 'TV', { wos: [], name: 'Type V', list: { is_template: true, type_name: 'Type V', list_type: 'kitchen' } });
        await pd.evaluate(async () => { lsReset(); await lsLoad(); window.__prompt = 'qty'; openListEditor('TV'); }); await sleep(1200);
        const j = (await rows(pd)).findIndex(x => !x.hdr); await setv(pd, j + '|qty', '5'); await sleep(150);
        await pd.evaluate(() => document.getElementById('me-save').click()); await sleep(2500);
        const tdn = await donep(pd);
        await pd.evaluate(() => { const b = document.getElementById('me-dview'); if (b) b.click(); }); await sleep(800);
        const tv = await pd.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });
        rec('V2 template saved → 👁 View the list shows the template (Type V, the new quantity 5)', !!tdn && /Template saved/.test(tdn.h) && /Type V/.test(tv) && /\b5\b/.test(tv), JSON.stringify([tdn && tdn.h, tv.slice(0, 160)]));
        await closeAll(pd);
        // a list archived on another screen while it was open → the warning panel → View
        X.F3.seedList(S, 'LAR', { wos: ['WO-OG2'], name: 'Archived meanwhile', lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', '']] });
        await pd.evaluate(async () => { lsReset(); await lsLoad(); openListEditor('LAR'); }); await sleep(1200);
        S.db.t.lists.find(l => l.id === 'LAR').archived = true;
        const k = (await rows(pd)).findIndex(x => !x.hdr); await setv(pd, k + '|qty', '3'); await sleep(150);
        await pd.evaluate(() => document.getElementById('me-saveclose').click()); await sleep(2500);
        const adn = await donep(pd);
        rec('V3 a list archived on another screen, then ✓ Save & close → the warning panel still shows (not closed)', !!adn && /archived on another screen/.test(adn.h), JSON.stringify([adn && adn.h, await pd.evaluate(() => !!document.querySelector('.me-ed'))]));
        if (adn) { await pd.evaluate(() => document.getElementById('me-dview').click()); await sleep(800);
          const av = await pd.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o ? o.innerText : ''; });
          rec('V3 …👁 View the list on that warning panel opens the (archived) list without error', /Archived meanwhile/.test(av) && !(S.errors || []).length, JSON.stringify([av.slice(0, 100), S.errors])); }
        await closeAll(pd);
      }
      await td.ctx.close().catch(() => {});
    }

    // ---------- 3. search on "Cutting lists to issue" ----------
    const rq = X.v2Row();
    rq.orders.push(o('WO-OG1', "O'Grady & Sons (Ballinasloe) Ltd", 'G', '1', 'APT 1 KITCHEN'), o('WO-OG2', "O'Grady & Sons (Ballinasloe) Ltd", 'G', '2', 'APT 2 KITCHEN'),
      o('WO-EV', EVIL, 'X', '1', EVIL + ' "quoted" title'), o('WO-Q1', 'Lucan Homes', 'A1', '5', 'TYPE A KITCHEN'), o('WO-Q2', 'Lucan Homes', 'A1', '6', 'TYPE A KITCHEN'), o('WO-Q3', 'Kildare Homes', 'B', '7', 'TYPE B KITCHEN'), o('WO-Q4', 'Kildare Homes', 'B', '8', 'TYPE B KITCHEN'));
    const SQ = X.makeServer(rq);
    const to = await X.dev(browser, SQ, 'office'), po = to.page; await asks(po);
    await po.evaluate(async () => { setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); await new Promise(r => setTimeout(r, 400)); });
    const st = () => po.evaluate(() => { const e = document.getElementById('lti'); return { rows: e ? [...e.querySelectorAll('[data-ltirow]')].map(r => r.dataset.ltirow) : [], box: !!document.getElementById('lti-q'), q: (document.getElementById('lti-q') || {}).value, focus: (document.activeElement || {}).id || '', none: (document.getElementById('lti-q0') || {}).textContent || '', xss: !!window.__xss, html: e ? e.innerHTML.length : 0 }; });
    let s = await st();
    rec('Q0 set-up: the search box is on "Cutting lists to issue"', s.box, JSON.stringify([s.rows.length, s.box]));
    if (s.box) {
      await po.click('#lti-q'); await po.keyboard.type("o'grady", { delay: 0 }); await sleep(300); s = await st();
      rec('Q1 typed fast ("o\'grady", no pause) → every letter kept, cursor still in the box, the two O\'Grady jobs found', s.q === "o'grady" && s.focus === 'lti-q' && s.rows.length === 2 && s.rows.every(w => /WO-OG/.test(w)), JSON.stringify(s));
      await po.fill('#lti-q', ''); await po.click('#lti-q'); await po.keyboard.type('lu', { delay: 30 });
      await po.evaluate(async () => { try { await loadDB(); mergedRender(); await lsPoll(); lsRedraw(); } catch (e) {} }); // the background refresh / lists poll / another PC's save arrive in the middle of typing
      await po.keyboard.type('can', { delay: 30 }); await sleep(300); s = await st();
      rec('Q2 a background refresh + lists poll arrives in the middle of typing "lucan" → no letters lost, the cursor stays in the box', s.q === 'lucan' && s.focus === 'lti-q', JSON.stringify([s.q, s.focus]));
      for (const q of ['(', '*', '[a-', '\\', '$^', '.*']) { await po.fill('#lti-q', q); await sleep(150); }
      s = await st();
      rec('Q3 regex characters ( * [a- \\ $^ .* → no error, "No job … matches"', !(SQ.errors || []).length && (/No job waiting for a list/.test(s.none) || s.rows.length >= 0), JSON.stringify([SQ.errors, s.none.slice(0, 60)]));
      await po.fill('#lti-q', '"><img src=x onerror="window.__xss=2">'); await sleep(200); s = await st();
      rec('Q4 HTML and quotes typed in the search → shown as text, nothing runs, the box keeps exactly what was typed', !s.xss && s.q === '"><img src=x onerror="window.__xss=2">', JSON.stringify([s.xss, s.q]));
      await po.fill('#lti-q', 'onerror'); await sleep(200); s = await st();
      rec('Q4 a job whose customer / title holds HTML can be found as text', s.rows.includes('WO-EV') && !s.xss, JSON.stringify(s.rows));
      await po.fill('#lti-q', '  LUCAN   a1  '); await sleep(200); s = await st();
      rec('Q5 capitals and extra spaces ("  LUCAN   a1  ") → the Lucan A1 jobs', s.rows.length >= 1 && s.rows.every(w => /WO-Q|WO-6/.test(w)), JSON.stringify(s.rows));
      // few jobs: with 5 or fewer the box is only drawn while a search is on — clearing it with Backspace
      await po.fill('#lti-q', 'grady'); await sleep(200);
      await po.click('#lti-q'); await po.keyboard.press('End'); for (let i = 0; i < 5; i++) await po.keyboard.press('Backspace'); await sleep(300); s = await st();
      rec('Q6 Backspace the search to empty → the box is still there and the cursor in it (the list of jobs comes back)', s.box && s.focus === 'lti-q' && s.q === '', JSON.stringify([s.box, s.focus, s.q, s.rows.length]));
    }
    await to.ctx.close().catch(() => {});
    // few jobs on the panel (5 or fewer)
    {
      const r2 = X.v2Row(); const S2 = X.makeServer(r2);
      const tf = await X.dev(browser, S2, 'office'), pf = tf.page; await asks(pf);
      await pf.evaluate(async () => { setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); await new Promise(r => setTimeout(r, 400)); });
      const n = await pf.evaluate(() => ltiRows().length), box = await pf.evaluate(() => !!document.getElementById('lti-q'));
      rec('(info) Q7 with ' + n + ' jobs waiting the search box is ' + (box ? 'shown' : 'not shown (only from 6 jobs)'), true);
      await tf.ctx.close().catch(() => {});
    }
    // phone
    {
      const tp = await X.dev(browser, SQ, 'office', { viewport: { width: 360, height: 640 } }), pp = tp.page; await asks(pp);
      await pp.evaluate(async () => { setWho('Ann'); lsReset(); await lsLoad(); showTab('l'); await new Promise(r => setTimeout(r, 400)); });
      const ok = await pp.evaluate(() => { const b = document.getElementById('lti-q'); if (!b) return { none: true }; const r = b.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), side: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      rec('Q8 360 px: the search box fits the screen (no sideways scroll)', !ok.none && ok.l >= 0 && ok.r <= 360 && ok.side <= 0, JSON.stringify(ok));
      await tp.ctx.close().catch(() => {});
    }

    // ---------- 4. the saw's default owner text, who may make templates ----------
    {
      const tw = await X.dev(browser, S, 'saw'), pw = tw.page;
      const own = await pw.evaluate(() => [lsOwnerFor(DB.orders.find(o => o.wo === 'WO-OG1')), lsOwnerFor(null)]);
      rec('W1 the saw is told the default list owner "Production Manager, Garry and Drawing office" (no owner set on the project)', own.every(x => x === 'Production Manager, Garry and Drawing office'), JSON.stringify(own));
      const who = {};
      for (const role of ['prod', 'design', 'admin', 'office', 'pm', 'saw', 'stores']) who[role] = await pw.evaluate(r => { const was = ROLE; try { ROLE = r; return lsTplSaveOk(); } catch (e) { return 'err ' + e.message; } finally { ROLE = was; } }, role);
      rec('W2 templates: Production Manager, Drawing office and Admin yes; office, PM, saw, stores no', who.prod === true && who.design === true && who.admin === true && !who.office && !who.pm && !who.saw && !who.stores, JSON.stringify(who));
      await tw.ctx.close().catch(() => {});
    }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
