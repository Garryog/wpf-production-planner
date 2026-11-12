// Coder checks for Garry's 4 Nov request "work order is too long. title needs to be separated" (switch ON, fake Supabase only):
//  - list editor: the Work order drop-down shows only "WO-3 — Unit 31"; read-only Floor | Unit | Title | Customer boxes beside it
//    fill in from the chosen WO (and change when another WO is picked); they wrap on a 360 px phone
//  - "Cutting lists to issue": WO | Floor | Unit | Title | Customer as separate cells, title cut short with the full text on hover
//  - Lists home: its own Title column; template dialog: the same separate cells; saw card: WO chip, Floor, Unit, then the title
//  - a title with HTML in it is shown as text
// Screenshots (1400 and 360 wide) go to $SHOTS when it is set. Run: node tests/stage3/coder-wo-cols.test.js
const F = require('./fix3.js');
const { H, D } = F;
const SHOTS = process.env.SHOTS || '';
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 600))); };
const LONG = 'Job – Kitchen and utility fit-out, Type B 3-bed end of terrace with island <b>x</b>';
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row();
  Object.assign(row.orders[0], { floor: '1', unit: '22', title: 'HOUSE 22 TYPE B', delv: true, delVeh: 'VOLVO', delDay: 'Thu' });
  row.orders.push(H.order({ wo: 'WO-3', customer: 'Aderrig Homes', title: LONG, floor: '2', unit: '31', step: '5. WORK ORDER PROCESSED', dueDate: '2026-10-28', origDueDate: '2026-10-28' }));
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { name: '22', wos: ['WO-1'] });
  F.seedList(S, 'T1', { name: 'Type B', wos: [], list: { is_template: true, type_name: 'Type B', list_type: 'house' } });

  // ---- saw card
  const saw = await F.dev(browser, S, 'saw', { viewport: { width: 1400, height: 900 } });
  const card = await saw.page.evaluate(() => { const c = document.querySelector('.wl-card'); if (!c) return null;
    return { chips: [...c.querySelectorAll('.wl-h .lst-chip')].map(x => x.textContent.trim()), t: (c.querySelector('.wl-wt') || {}).textContent }; });
  rec('saw card: WO, Floor, Unit chips, then the title on its own line', card && card.chips.join('|') === 'WO-1|Floor 1|Unit 22' && card.t === 'HOUSE 22 TYPE B', JSON.stringify(card));
  await saw.close();

  const off = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } });
  const p = off.page;
  // ---- editor
  const ed = await p.evaluate(async () => { showTab('l'); openListEditor(null, '', 'P1'); await new Promise(r => setTimeout(r, 120));
    { const w = document.getElementById('me-wo'); w.value = 'WO-3'; w.onchange(); } // list-window release: the Work order drop-down is only in a window opened with no WO
    const s = document.getElementById('me-wo'), f = () => Object.fromEntries([...document.querySelectorAll('#me-woinfo [data-woi]')].map(e => [e.dataset.woi, e.textContent.trim()]));
    const r = { sel: s.options[s.selectedIndex].textContent, opts: [...s.options].map(o => o.textContent), info: f(), tt: document.querySelector('[data-woi="Title"]').title };
    s.value = 'WO-1'; s.onchange(); r.info2 = f(); s.value = 'WO-3'; s.onchange(); return r; });
  rec('editor: the picked WO shows "WO-3 · Fl 2 · Unit 31 · due 28 Oct" — no title (Part 4 L12, Garry 10 Nov: due date on every line; was "WO-3 — Unit 31")', ed.sel === 'WO-3 · Fl 2 · Unit 31 · due 28 Oct', JSON.stringify(ed.sel));
  rec('editor: no drop-down option carries the title or customer', ed.opts.every(o => !/Aderrig|HOUSE 22|Kitchen/.test(o)), JSON.stringify(ed.opts));
  rec('editor: read-only Floor | Unit | Title | Customer filled from WO-3 (title shown as text, full title on hover)',
    ed.info.Floor === '2' && ed.info.Unit === '31' && ed.info.Title === LONG && ed.info.Customer === 'Aderrig Homes' && ed.tt === LONG, JSON.stringify(ed.info));
  rec('editor: picking WO-1 changes the boxes to 1 / 22 / HOUSE 22 TYPE B', ed.info2.Floor === '1' && ed.info2.Unit === '22' && ed.info2.Title === 'HOUSE 22 TYPE B', JSON.stringify(ed.info2));
  if (SHOTS) { const r = await p.evaluate(() => { const b = document.querySelector('.me-ed').getBoundingClientRect(); return { x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10), width: Math.min(1400, b.width + 20), height: 260 }; }); await p.screenshot({ path: SHOTS + '/editor-header-1400.png', clip: r }); }
  await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); if (o) o.remove(); });
  await p.setViewportSize({ width: 360, height: 800 }); await p.evaluate(async () => { openListEditor(null, 'WO-3', 'P1'); await new Promise(r => setTimeout(r, 150)); });
  const ph = await p.evaluate(() => { const ov = document.querySelector('.pod-ovl'), b = document.getElementById('me-woinfo').getBoundingClientRect();
    const wide = [...document.querySelectorAll('#me-woinfo *, #me-wo, #me-wol, #me-wol *')].filter(e => e.getBoundingClientRect().right > 362).map(e => e.className || e.id);
    return { right: Math.round(b.right), wide }; });
  rec('editor at 360 px: the Floor/Unit/Title/Customer boxes wrap inside the screen', ph.right <= 362 && !ph.wide.length, JSON.stringify(ph));
  if (SHOTS) await p.screenshot({ path: SHOTS + '/editor-header-360.png' });
  await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); if (o) o.remove(); });
  await p.setViewportSize({ width: 1400, height: 900 });

  // ---- Cutting lists to issue
  const lti = await p.evaluate(async () => { showTab('l'); render(); await new Promise(r => setTimeout(r, 100)); const r = document.querySelector('[data-ltirow="WO-3"]'); if (!r) return null;
    const c = r.querySelector('.wo-cols'), t = c.querySelector('.wc-t'), cs = getComputedStyle(t);
    return { cells: [...c.children].map(x => x.textContent.trim()), hover: t.title, cut: cs.whiteSpace === 'nowrap' && cs.textOverflow === 'ellipsis' }; });
  rec('lists to issue: WO | Floor | Unit | Title | Customer as separate cells', lti && lti.cells.join('|') === 'WO-3|Floor 2|Unit 31|' + LONG + '|Aderrig Homes', JSON.stringify(lti));
  rec('lists to issue: the title is cut short with the full text on hover', lti && lti.cut && lti.hover === LONG, JSON.stringify(lti));
  if (SHOTS) { await p.evaluate(() => document.querySelector('[data-ltirow="WO-3"]').scrollIntoView({ block: 'center' })); await p.screenshot({ path: SHOTS + '/lists-to-issue-row-1400.png' });
    await p.setViewportSize({ width: 360, height: 800 }); await p.evaluate(() => render()); await p.waitForTimeout(150);
    const w = await p.evaluate(() => { const r = document.querySelector('[data-ltirow="WO-3"]'); r.scrollIntoView({ block: 'center' }); return Math.round(r.getBoundingClientRect().right); });
    rec('lists to issue at 360 px: the row fits the screen', w <= 362, String(w));
    await p.screenshot({ path: SHOTS + '/lists-to-issue-row-360.png' });
    await p.setViewportSize({ width: 1400, height: 900 }); await p.evaluate(() => render()); }

  // ---- Lists home Title column
  const lh = await p.evaluate(() => { LH.proj = ''; render(); const r = document.querySelector('[data-lhrow="L1"]'); const th = [...r.closest('table').querySelectorAll('th')].map(x => x.textContent.trim());
    return { th, cells: [...r.children].map(x => x.textContent.trim()) }; });
  const ti = lh.th.indexOf('Title');
  rec('Lists home: Work orders | Floor | Unit | Title as separate columns', ti > 0 && lh.th.slice(ti - 3, ti + 1).join('|') === 'Work orders|Floor|Unit|Title' && lh.cells[ti] === 'HOUSE 22 TYPE B' && lh.cells[ti - 3] === 'WO-1', JSON.stringify(lh));

  // ---- template dialog
  const td = await p.evaluate(async () => { lsTplDlg('T1', 'WO-3'); await new Promise(r => setTimeout(r, 80)); const o = document.querySelector('.pod-ovl'); if (!o) return null;
    const c = o.querySelector('[data-tpwo="WO-3"]').closest('label').querySelector('.wo-cols'); const r = { cells: [...c.children].map(x => x.textContent.trim()), b: !!c.querySelector('b b') }; o.remove(); return r; });
  rec('template dialog: WO | Floor | Unit | Title | Customer as separate cells, HTML in a title shown as text', td && td.cells.join('|') === 'WO-3|Floor 2|Unit 31|' + LONG + '|Aderrig Homes' && !td.b, JSON.stringify(td));

  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await off.close();
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
