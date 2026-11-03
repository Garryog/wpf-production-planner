// Tester attack 3 on the FIXED-total rows (b5b995a, 7fd7b97): a quantity in a unit block that doesn't divide by the units
// is kept as a fixed total, and Units must never scale it — after a reload, a Units change, a move, a paste, a template
// insert, or another screen's save. Then the saw view, sheet calculator (m² ÷ 5.75 + 10%) and labels with those rows.
// Browser, fake Supabase only. Run: node tests/editor/attack3-fixed.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 700))); };
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const q = (S, id, part) => (live(S, id).find(x => x.part === part) || {}).qty;
const pinUp = p => p.evaluate(() => { window.__conf = []; window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why|What changed/.test(m) ? 'edit' : 'Tester'; window.confirm = m => { window.__conf.push(m); return true; }; setWho('Tester'); });
const BLK = (u, extra) => [
  ['hdr', 'U1 Robe', String(u), null, null, null, '', '', {}],
  ['saw', 'Side', String(2 * u), 2380, 570, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '2' }],
  ...(extra || [])];
// save the list's rows after fn(rows) changes them (as the editor's Save does)
const saveRows = (p, id, fn) => p.evaluate(async ({ id, fn }) => { await lsReloadList(id); const l = lsList(id); const rows = lsEditRows(id); new Function('rows', fn)(rows); try { await lsSaveManual({ wo: (l.wos || [])[0] || '', name: l.name, pid: l.pid, rows }, 'Tester', l); return 'ok'; } catch (e) { return e.message; } }, { id, fn });
const rowsOf = (p, id) => p.evaluate(async id => { await lsReloadList(id); return lsEditRows(id).map(r => ({ k: r.k, item: r.item, qty: r.qty, units: r.units, fixed: !!r.fixed })); }, id);
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  // F1 list: 3-unit block, "Odd shelf" is a FIXED 2 (doesn't divide by 3), saved the way lsEdLines saves a fixed row
  F.seedList(S, 'LF', { name: 'House F', wos: ['WO-1'], lines: BLK(3, [['saw', 'Odd shelf', '2', 864, 570, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '' }]]) });
  // F5 list: 2-unit block with a FIXED 3 (as made by a move / paste into the block: 3 ÷ 2 isn't a whole number → fixed)
  F.seedList(S, 'LG', { name: 'House G', wos: ['WO-2'], lines: BLK(2, [['saw', 'Filler', '3', 700, 100, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '' }]]) });
  const o = await F.dev(browser, S, 'office'), pg = o.page; await pinUp(pg);
  // ---- F1..F4: reload and Units changes
  let r = await rowsOf(pg, 'LF');
  rec('F1 reload: "Odd shelf" 2 in a 3-unit block opens as a fixed total 2', r.some(x => x.item === 'Odd shelf' && x.fixed && String(x.qty) === '2'), JSON.stringify(r));
  let s = await saveRows(pg, 'LF', `rows[0].units='6';`);
  rec('F2 Units 3 → 6: Side 2 per unit → 12, Odd shelf stays 2 (fixed)', s === 'ok' && q(S, 'LF', 'Side') === '12' && q(S, 'LF', 'Odd shelf') === '2', JSON.stringify({ s, side: q(S, 'LF', 'Side'), odd: q(S, 'LF', 'Odd shelf') }));
  s = await saveRows(pg, 'LF', `rows[0].units='2';`);
  rec('F3 Units 6 → 2: Odd shelf still 2', s === 'ok' && q(S, 'LF', 'Odd shelf') === '2', JSON.stringify({ s, odd: q(S, 'LF', 'Odd shelf') }));
  r = await rowsOf(pg, 'LF');
  rec('F3b reopened after Units = 2: Odd shelf is still shown as a FIXED total (it was never "1 per unit")', r.some(x => x.item === 'Odd shelf' && x.fixed), JSON.stringify(r.filter(x => x.item === 'Odd shelf')));
  s = await saveRows(pg, 'LF', `rows[0].units='5';`);
  rec('F4 then Units 2 → 5: Odd shelf (fixed 2) must NOT scale to 5', q(S, 'LF', 'Odd shelf') === '2', JSON.stringify({ s, odd: q(S, 'LF', 'Odd shelf'), lines: live(S, 'LF').map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')') }));
  // ---- F5: a fixed 3 in a 2-unit block (made by a move/paste) reopened
  r = await rowsOf(pg, 'LG');
  rec('F5 a fixed 3 in a 2-unit block (made by a move or paste) reopens as fixed — not "1.5 per unit"', r.some(x => x.item === 'Filler' && x.fixed && String(x.qty) === '3'), JSON.stringify(r.filter(x => x.item === 'Filler')));
  s = await saveRows(pg, 'LG', `rows[0].units='3';`);
  rec('F5b …and Units 2 → 3 leaves it at 3 (not 4.5 — half a part to cut)', q(S, 'LG', 'Filler') === '3', JSON.stringify({ s, filler: q(S, 'LG', 'Filler') }));
  // ---- F6: the editor accepts a per-unit 1.5 in a 3-unit block → total 4.5 to cut?
  F.seedList(S, 'LH', { name: 'House H', wos: ['WO-1'], lines: BLK(3) });
  s = await saveRows(pg, 'LH', `rows.push({k:'part',item:'Half shelf',qty:'1.5',L:400,W:300,mat:'MFC White',edging:'',note:''});`);
  rec('F6 per-unit 1.5 × 3 units: the saw is never asked to cut 4.5 parts (refused, or kept whole)', !/\.\d/.test(String(q(S, 'LH', 'Half shelf') || '')), JSON.stringify({ s, half: q(S, 'LH', 'Half shelf') }));
  // ---- F7: two screens: A has the editor open (fixed row), B changes Units; A saves its own edit
  {
    F.seedList(S, 'LK', { name: 'House K', wos: ['WO-2'], lines: BLK(3, [['saw', 'Odd shelf', '2', 864, 570, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '' }]]) });
    const b = await F.dev(browser, S, 'office'); await pinUp(b.page);
    await pg.evaluate(async () => { await lsReloadList('LK'); window.__rowsA = lsEditRows('LK'); });
    const sb = await saveRows(b.page, 'LK', `rows[0].units='4';`);
    const sa = await pg.evaluate(async () => { const l = lsList('LK'); const rows = window.__rowsA; rows.push({ k: 'part', item: 'A extra', qty: '1', L: 300, W: 300, mat: 'MFC White', edging: '', note: '' }); try { await lsSaveManual({ wo: 'WO-2', name: l.name, pid: l.pid, rows }, 'Ann', l); return 'ok'; } catch (e) { return e.message; } });
    rec('F7 B changes Units 3 → 4 while A edits: Odd shelf stays 2, Side = 8, A\'s extra = 4', q(S, 'LK', 'Odd shelf') === '2' && q(S, 'LK', 'Side') === '8' && q(S, 'LK', 'A extra') === '4', JSON.stringify({ sb, sa, lines: live(S, 'LK').map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')') }));
    await b.close();
  }
  // ---- F8: editor UI — template insert with a fixed row, then Units typed in the editor, saved, reopened, Units again
  {
    F.seedList(S, 'TT', { name: 'Robe template', wos: [], list: { is_template: true, list_type: 'room', type_name: 'Robe' }, lines: [
      ['hdr', 'Robe unit', '3', null, null, null, '', '', {}],
      ['saw', 'Side', '6', 2380, 570, 'MFC White', '', '', { section: 'Robe unit', unit_qty: '2' }],
      ['saw', 'Odd shelf', '2', 864, 570, 'MFC White', '', '', { section: 'Robe unit', unit_qty: '' }]] });
    F.seedList(S, 'LI', { name: 'House I', wos: ['WO-1'], lines: [['saw', 'Top', '1', 1200, 560, 'MFC White', '', '']] });
    const out = await pg.evaluate(async () => {
      await lsPoll(); await lsReloadList('TT'); openListEditor('LI');
      const ov = document.querySelector('.pod-ovl');
      const ins = [...ov.querySelectorAll('button')].find(b => /template/i.test(b.textContent) && /unit|insert/i.test(b.textContent));
      if (!ins) return { err: 'no insert-from-template button: ' + [...ov.querySelectorAll('button')].map(b => b.textContent.trim()).join(' / ') };
      ins.click(); await new Promise(r => setTimeout(r, 200));
      const dl = [...document.querySelectorAll('.pod-ovl')].pop();
      const use = [...dl.querySelectorAll('button')].find(b => b.textContent.trim() === 'Use'); if (use) use.click();
      await new Promise(r => setTimeout(r, 200));
      const n = dl.querySelector('#it-n'); if (!n) return { err: 'no units box: ' + dl.innerText.slice(0, 300) };
      n.value = '2'; const go = [...dl.querySelectorAll('button')].find(b => /add|insert/i.test(b.textContent) && !/cancel/i.test(b.textContent)); go.click();
      await new Promise(r => setTimeout(r, 200));
      const tot = [...ov.querySelectorAll('[data-tot]')].map(e => e.closest('[data-row]').querySelector('[data-mr$="|item"]').value + ' ' + e.textContent);
      return { tot };
    });
    rec('F8 template insert ×2 units: Odd shelf shows "= 2 fixed", Side "= 4"', !out.err && out.tot.some(t => /Odd shelf = 2\s*fixed/.test(t)) && out.tot.some(t => /Side = 4/.test(t)), JSON.stringify(out));
    if (!out.err) {
      await pg.evaluate(() => { const b = document.querySelector('.pod-ovl #me-save'); b.click(); }); await F.sleep(1500);
      rec('F8b saved: Odd shelf 2 (fixed), Side 4', q(S, 'LI', 'Odd shelf') === '2' && q(S, 'LI', 'Side') === '4', JSON.stringify(live(S, 'LI').map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')')));
      s = await saveRows(pg, 'LI', `rows.find(r=>r.k==='hdr').units='3';`);
      rec('F8c reopened and Units 2 → 3: Odd shelf (fixed 2 from the template) stays 2', q(S, 'LI', 'Odd shelf') === '2' && q(S, 'LI', 'Side') === '6', JSON.stringify({ s, lines: live(S, 'LI').map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')') }));
    }
    await pg.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  }
  // ---- F9: saw view, sheet calculator and labels read the fixed totals and unit blocks
  {
    const S2 = F.makeServer(F.v2Row());
    F.seedList(S2, 'LS', { name: 'House S', wos: ['WO-1'], lines: [
      ['hdr', 'U1 Robe', '3', null, null, null, '', '', {}],
      ['saw', 'Side', '6', 2500, 1000, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '2' }], // 15 m²
      ['saw', 'Odd shelf', '2', 1000, 1000, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '' }], // 2 m² (fixed)
      ['fit', 'Rail', '3', null, null, '', '', '', { section: 'U1 Robe', unit_qty: '1' }]] });
    const t = await F.dev(browser, S2, 'office');
    const z = await t.page.evaluate(() => { const l = lsList('LS'); const rows = listRows(l); const sn = sheetNeed([l], '', ''); return { rows: rows.map(r => r.k + ':' + r.item + ':' + r.qty), sn }; });
    // 17 m² / 5.75 × 1.1 = 3.25 → 4 sheets
    rec('F9 sheet calculator: Side 6 × 2.5 m² + Odd shelf 2 × 1 m² = 17 m² → 4 sheets (unit heading not counted)', z.sn.sheets === 4 && Math.abs(z.sn.mats[0].m2 - 17) < 0.01 && !z.sn.badQty, JSON.stringify(z.sn));
    rec('F9b saw rows: Side 6, Odd shelf 2; the unit heading is not a part to cut', z.rows.includes('saw:Side:6') && z.rows.includes('saw:Odd shelf:2') && !z.rows.some(x => /U1 Robe/.test(x) && /^saw/.test(x)), JSON.stringify(z.rows));
    const lb = await t.page.evaluate(() => { let html = ''; const ow = window.open; window.open = () => ({ document: { write: h => { html += h; }, close() {} }, focus() {}, print() {} }); try { printLabels([lsList('LS')], 'saw'); } finally { window.open = ow; } return { qty: [...html.matchAll(/lb-qty">×([^<]*)</g)].map(m => m[1]), items: [...html.matchAll(/lb-item">([^<]*)</g)].map(m => m[1]) }; });
    rec('F9c labels: ×6 Side, ×2 Odd shelf, no label for the unit heading', JSON.stringify(lb.qty) === '["6","2"]' && !lb.items.includes('U1 Robe'), JSON.stringify(lb));
    rec('no page errors', !(S.errors || []).length && !(S2.errors || []).length, (S.errors || []).concat(S2.errors || []).join(' | '));
    await t.close();
  }
  await o.close(); await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
