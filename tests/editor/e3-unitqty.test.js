// Editor step 3: unit_qty — a part in a unit block keeps its per-unit quantity; its qty stays the TOTAL to cut. A unit
// heading is a heading whose qty is the number of units. Fake Supabase only. Run: node tests/editor/e3-unitqty.test.js
const fs = require('fs'), path = require('path');
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
(async () => {
  // the SQL block: column, alter for test projects, save_list_revision update + insert + "changed?" compare
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_CHANGES.md'), 'utf8');
  rec('SQL: list_lines has unit_qty, plus "add column if not exists" for test projects', /qty text, unit_qty text, material text/.test(sql) && /alter table list_lines add column if not exists unit_qty text;/.test(sql));
  rec('SQL: save_list_revision writes unit_qty on update and insert, and counts it as a change', /unit_qty=e->>'unit_qty'/.test(sql) && /ex\.qty,ex\.unit_qty,/.test(sql) && /e->>'qty',e->>'unit_qty',e->>'material',coalesce/.test(sql) && /qty,unit_qty,material,material_other,edging,note,snag_id,src_line_id,added_rev/.test(sql));
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  const o = await F.dev(browser, S, 'office');
  await o.page.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : 'Tester'; window.confirm = () => true; });
  const rows = [{ k: 'hdr', item: '900 Single Rail + 2 shelves', units: '3', note: '' },
    { k: 'part', item: 'Side panel', qty: '2', L: 2380, W: 570, mat: 'MFC White', edging: 'L1LE 1mm', note: '' },
    { k: 'part', item: 'Shelves', qty: '3', L: 864, W: 570, mat: 'MFC White', edging: '', note: '' },
    { k: 'part', item: 'Hanging rail', qty: '1', L: '', W: '', mat: '', edging: '', note: '' },
    { k: 'hdr', item: 'Fillers & Kickers', note: '' },
    { k: 'part', item: 'Kicker', qty: '7', L: 2440, W: 125, mat: 'MFC White', edging: '', note: '' }];
  const r1 = await o.page.evaluate(async rows => { try { const l = await lsSaveManual({ wo: 'WO-2', name: 'House 2', pid: 'P1', rows }, 'Tester', null); return l.id; } catch (e) { return 'ERR ' + e.message; } }, rows);
  const ln = () => S.db.t.list_lines.filter(x => x.list_id === r1).sort((a, b) => a.seq - b.seq);
  const b = ln().map(x => [x.kind, x.part, x.qty, x.unit_qty, x.section].join('|'));
  rec('unit heading saved as a heading with qty = units', b[0] === 'hdr|900 Single Rail + 2 shelves|3||', b[0]);
  rec('parts in the block: qty = TOTAL, unit_qty = per unit, section = the unit', b[1] === 'saw|Side panel|6|2|900 Single Rail + 2 shelves' && b[2] === 'saw|Shelves|9|3|900 Single Rail + 2 shelves', b.slice(1, 3).join(' ; '));
  rec('a row with no length or width goes to Stores (fit)', b[3] === 'fit|Hanging rail|3|1|900 Single Rail + 2 shelves', b[3]);
  rec('a plain heading ends the unit block: Kicker is 7, no unit_qty', b[5] === 'saw|Kicker|7||Fillers & Kickers', b[5]);
  const v = await o.page.evaluate(id => { const r = listRows(lsList(id)); return r.map(x => x.k === 'hdr' ? 'h:' + x.item : x.item + ':' + x.qty).join(';'); }, r1);
  rec('the saw sees "… – 3 units" and the total on each line', v.startsWith('h:900 Single Rail + 2 shelves – 3 units;Side panel:6;Shelves:9') && v.includes('h:Fillers & Kickers;Kicker:7'), v);
  // the list is with the saw (sent) but nothing ticked yet — Units may still change (Garry, 3 Nov). 2 per unit × 3 → 1 × 6:
  // same total, so the line is NOT flagged CHANGED in the new revision; its unit_qty is updated.
  const side = ln()[1].id; D.update(S.db, 'lists', D.find(S.db, 'lists', r1), { locked: true });
  await o.page.evaluate(async () => { lsReset(); await lsLoad(); });
  const rows2 = rows.map(r => ({ ...r })); rows2[0].units = '6'; rows2[1].qty = '1'; rows2[2].qty = '3'; // Side: 1×6 = 6 (same total); Shelves 3×6 = 18
  const ids = ln().map(x => x.id); rows2.forEach((r, i) => { r.lid = ids[i]; });
  const r2 = await o.page.evaluate(async ({ id, rows }) => { try { await lsSaveManual({ wo: 'WO-2', name: 'House 2', pid: 'P1', rows }, 'Tester', lsList(id)); return 'ok'; } catch (e) { return 'ERR ' + e.message; } }, { id: r1, rows: rows2 });
  const s2 = D.find(S.db, 'list_lines', side), sh = ln()[2], rv = D.find(S.db, 'lists', r1).rev;
  rec('2 per unit × 3 → 1 per unit × 6 on a sent list: new revision, Side NOT changed (same total), unit_qty updated', r2 === 'ok' && rv === 2 && s2.qty === '6' && s2.unit_qty === '1' && !s2.changed_rev, JSON.stringify([r2, rv, s2.qty, s2.unit_qty, s2.changed_rev]));
  rec('a total that changes (9 → 18) is a CHANGED line', sh.qty === '18' && sh.unit_qty === '3' && sh.changed_rev === 2, JSON.stringify([sh.qty, sh.unit_qty, sh.changed_rev]));
  // only unit_qty differs → still saved (not "nothing changed")
  await o.page.evaluate(async () => { lsReset(); await lsLoad(); });
  const rows3 = rows2.map(r => ({ ...r })); rows3[0].units = '6';
  const before = S.rpcCalls.length;
  await o.page.evaluate(async ({ id, rows }) => { await lsSaveManual({ wo: 'WO-2', name: 'House 2', pid: 'P1', rows }, 'Tester', lsList(id)); }, { id: r1, rows: rows3 });
  rec('saving the same list again with nothing changed makes no save', S.rpcCalls.length === before, S.rpcCalls.length - before);
  // copying (template / copy dialog) keeps unit_qty and the heading's units
  const cp = await o.page.evaluate(async id => (await lsCopyLines(id)).map(x => [x.kind, x.qty, x.unit_qty].join('|')).join(';'), r1);
  rec('lsCopyLines keeps unit_qty and the units on the heading', cp.startsWith('hdr|6|;saw|6|1;saw|18|3'), cp);
  const sig = await o.page.evaluate(() => lsLineSig({ kind: 'saw', qty: '6', unit_qty: '1' }) !== lsLineSig({ kind: 'saw', qty: '6', unit_qty: '2' }));
  rec('lsLineSig tells per-unit splits apart (the edit merge sees the change)', sig);
  // switch back: the heading keeps its units in the old format
  const old = await o.page.evaluate(id => lsOldFrom([], lsLinesOf(id)).rows[0].item, r1);
  rec('switch back to the old lists: the unit heading keeps "– 6 units"', old === '900 Single Rail + 2 shelves – 6 units', old);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
