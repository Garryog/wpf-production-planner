// Tester attack 4 on the 'fixed' marker and the half-quantity rule (bca0740, Garry answer 10), and on lists saved before
// 3 Nov (unit_qty blank) after a reload. Browser, fake Supabase only. Run: node tests/editor/attack4-fixed.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 700))); };
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const ln = (S, id, part) => live(S, id).find(x => x.part === part) || {};
const pinUp = p => p.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why|What changed/.test(m) ? 'edit' : 'Tester'; window.confirm = () => true; setWho('Tester'); });
const saveRows = (p, id, fn) => p.evaluate(async ({ id, fn }) => { await lsReloadList(id); const l = lsList(id); const rows = lsEditRows(id); new Function('rows', fn)(rows); try { await lsSaveManual({ wo: (l.wos || [])[0] || '', name: l.name, pid: l.pid, rows }, 'Tester', l); return 'ok'; } catch (e) { return e.message; } }, { id, fn });
const rowsOf = (p, id) => p.evaluate(async id => { await lsReloadList(id); return lsEditRows(id).map(r => ({ k: r.k, item: r.item, qty: r.qty, units: r.units, fixed: !!r.fixed })); }, id);
const hdr = u => ['hdr', 'U1 Robe', String(u), null, null, null, '', '', {}];
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  const o = await F.dev(browser, S, 'office'), pg = o.page; await pinUp(pg);
  // ---- half-quantity rule
  F.seedList(S, 'H1', { name: 'House H1', wos: ['WO-1'], lines: [['saw', 'Top', '1', 1200, 560, 'MFC White', '', '']] });
  let s = await saveRows(pg, 'H1', `rows.push({k:'part',item:'Half top',qty:'1.5',L:600,W:560,mat:'MFC White',edging:'',note:''});`);
  rec('H1 a saw row NOT in a unit block with qty 1.5: refused (the saw can\'t cut half a part)', s !== 'ok' && !ln(S, 'H1', 'Half top').qty, JSON.stringify({ s, q: ln(S, 'H1', 'Half top').qty }));
  F.seedList(S, 'H2', { name: 'House H2', wos: ['WO-1'], lines: [hdr(3), ['saw', 'Side', '6', 2380, 570, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '2' }]] });
  s = await saveRows(pg, 'H2', `rows.push({k:'part',item:'Odd',qty:'2.5',L:600,W:560,mat:'MFC White',edging:'',note:'',fixed:true});`);
  rec('H2 a FIXED total of 2.5 in a unit block: refused (fixed rows skip the whole-number check)', s !== 'ok' && !ln(S, 'H2', 'Odd').qty, JSON.stringify({ s, line: ln(S, 'H2', 'Odd') }));
  F.seedList(S, 'H3', { name: 'House H3', wos: ['WO-1'], lines: [hdr(4), ['saw', 'Side', '8', 2380, 570, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '2' }]] });
  s = await saveRows(pg, 'H3', `rows.push({k:'part',item:'Third',qty:'0.3333',L:600,W:560,mat:'MFC White',edging:'',note:''});`);
  rec('H3 per unit 0.3333 × 4 units: the saw is never asked to cut 1.333 parts', !/\./.test(String(ln(S, 'H3', 'Third').qty || '')), JSON.stringify({ s, line: ln(S, 'H3', 'Third') }));
  F.seedList(S, 'H4', { name: 'House H4', wos: ['WO-1'], lines: [hdr(3), ['saw', 'Side', '6', 2380, 570, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '2' }]] });
  s = await saveRows(pg, 'H4', `rows.push({k:'part',item:'Glue (litres)',qty:'0.5',L:'',W:'',mat:'',edging:'',note:''});`);
  rec('H4 Stores 0.5 per unit × 3 = 1.5 is allowed (Stores can hand out half)', s === 'ok' && ln(S, 'H4', 'Glue (litres)').qty === '1.5', JSON.stringify({ s, line: ln(S, 'H4', 'Glue (litres)') }));
  F.seedList(S, 'H5', { name: 'House H5', wos: ['WO-1'], lines: [hdr(2), ['saw', 'Side', '4', 2380, 570, 'MFC White', '', '', { section: 'U1 Robe', unit_qty: '2' }]] });
  s = await saveRows(pg, 'H5', `rows.push({k:'part',item:'Shelf',qty:'1.5',L:600,W:560,mat:'MFC White',edging:'',note:''});`);
  rec('H5 saw 1.5 per unit × 2 = 3 allowed, saved as 3 (1.5 per unit)', s === 'ok' && ln(S, 'H5', 'Shelf').qty === '3' && ln(S, 'H5', 'Shelf').unit_qty === '1.5', JSON.stringify({ s, line: ln(S, 'H5', 'Shelf') }));
  s = await saveRows(pg, 'H5', `rows[0].units='3';`);
  rec('H5b then Units 2 → 3 (4.5 to cut) is refused with a message naming "Shelf", nothing changed', /Shelf/.test(s) && /whole/.test(s) && ln(S, 'H5', 'Shelf').qty === '3', JSON.stringify({ s, line: ln(S, 'H5', 'Shelf') }));
  // ---- lists saved before 3 Nov: unit_qty blank
  F.seedList(S, 'B1', { name: 'House B1', wos: ['WO-2'], lines: [hdr(3),
    ['saw', 'Side', '6', 2380, 570, 'MFC White', '', '', { section: 'U1 Robe' }],
    ['saw', 'Shelf', '4', 864, 570, 'MFC White', '', '', { section: 'U1 Robe' }],
    ['saw', 'Rail', '6.0', 864, 30, 'MFC White', '', '', { section: 'U1 Robe' }],
    ['fit', 'Hinge', '0', null, null, '', '', '', { section: 'U1 Robe' }]] });
  let r = await rowsOf(pg, 'B1');
  rec('B1 older list reloaded: Side 6 in 3 units → 2 per unit; Shelf 4 → fixed 4; "6.0" → 2 per unit', r.some(x => x.item === 'Side' && !x.fixed && String(x.qty) === '2') && r.some(x => x.item === 'Shelf' && x.fixed && String(x.qty) === '4') && r.some(x => x.item === 'Rail' && !x.fixed && String(x.qty) === '2'), JSON.stringify(r));
  s = await saveRows(pg, 'B1', `rows[0].units='6';`);
  rec('B1b Units 3 → 6: Side 12, Shelf stays 4, Rail 12', s === 'ok' && ln(S, 'B1', 'Side').qty === '12' && ln(S, 'B1', 'Shelf').qty === '4' && ln(S, 'B1', 'Rail').qty === '12', JSON.stringify({ s, l: live(S, 'B1').map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')') }));
  r = await rowsOf(pg, 'B1');
  rec('B1c reopened: Shelf still FIXED (now saved as "fixed", not guessed again)', r.some(x => x.item === 'Shelf' && x.fixed) && ln(S, 'B1', 'Shelf').unit_qty === 'fixed', JSON.stringify(live(S, 'B1').map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')')));
  // an older list where the heading's units is blank / not a number
  F.seedList(S, 'B2', { name: 'House B2', wos: ['WO-2'], lines: [['hdr', 'Kitchen', 'two', null, null, null, '', '', {}], ['saw', 'Side', '4', 2380, 570, 'MFC White', '', '', { section: 'Kitchen' }]] });
  r = await rowsOf(pg, 'B2'); s = await saveRows(pg, 'B2', `rows.find(x=>x.item==='Side').note='n';`);
  rec('B2 older heading with units "two": opens and saves without changing Side 4', s === 'ok' && ln(S, 'B2', 'Side').qty === '4', JSON.stringify({ r, s, l: live(S, 'B2').map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')') }));
  // ---- 'fixed' through Save as template (lsTplCopy) and back in with Insert unit
  const t = await pg.evaluate(() => lsTplCopy([{ kind: 'saw', part: 'Odd', qty: '2', unit_qty: 'fixed', section: 'U' }, { kind: 'saw', part: 'Old', qty: '4', unit_qty: null, section: 'U' }]).map(x => x.part + ':' + x.qty + '(' + x.unit_qty + ')'));
  rec('T1 Save as template keeps "fixed" on a fixed row', t[0] === 'Odd:2(fixed)', JSON.stringify(t));
  const pu = await pg.evaluate(() => [lsPerUnit({ qty: '2', unit_qty: 'FIXED' }, 3), lsPerUnit({ qty: '2', unit_qty: ' fixed ' }, 3), lsPerUnit({ qty: '6', unit_qty: '' }, '3 '), lsPerUnit({ qty: '6', unit_qty: '' }, 0)]);
  rec('T2 lsPerUnit: "FIXED" / " fixed " read as fixed; Units "3 " with 6 → 2 per unit; Units 0 → fixed', pu[0].fixed && pu[1].fixed && pu[2].qty === '2' && !pu[2].fixed && pu[3].fixed, JSON.stringify(pu));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
