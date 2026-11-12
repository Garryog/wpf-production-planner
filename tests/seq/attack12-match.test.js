// Tester attack 12 (B10 matching / B0 key with real-looking Cienapps shapes): seqReconcile after an import. "Apt 7" vs "APT07"
// vs "7" vs "Unit 007"; Floor "T12" vs "0" / "GF" / "LGF" / "G" / "FF" / blank; "Multiple"; T09 vs T10; title-only floor/unit;
// Reference "2796-15-2-APT 51" with Floor / Unit blank; a waiting row with no house at all (a TOTAL line); one BED 1 row vs a
// BED 2 WO; an island line whose Description says KITCHEN; P-numbers never take a row; one WO / two identical rows.
// Fake Supabase only. Run: node tests/seq/attack12-match.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
const C = 'Aderrig Homes';
const J = (wo, f, u, t, x) => H.order(Object.assign({ wo, customer: C, floor: f, unit: u, title: t, dueDate: '2026-12-03', origDueDate: '2026-12-03', plannedWeek: '', step: '4. READY FOR PRODUCTION' }, x || {}));
function server(rows, jobs) {
  const row = X.v2Row(); row.orders.push(...jobs);
  const S = X.makeServer(row);
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  rows.forEach(([id, f, u, p, n, kind, descr]) => X.seqRow(S, id, 'P1', { floor: f, unit: u, product: p, name: n, descr: descr || null, kind, src: 'upload', upload_id: 'UP1', why: 'Cienapps upload: a.xlsx' }));
  return S;
}
const rowOf = (S, id) => D.find(S.db, 'project_seq', id);
const woRows = (S, wo) => S.db.t.project_seq.filter(r => r.wo === wo && r.state !== 'removed');
async function run(browser, S, wos) {
  const a = await X.dev(browser, S, 'office');
  const R = await a.page.evaluate(async w => { await seqFresh('P1'); return seqReconcile(['P1'], new Set(w.map(woKey))); }, wos);
  const pl = await a.page.evaluate(() => { const p = seqWOPlan('P1'); return { confirm: p.confirm.map(j => j.o.wo + ':' + j.c.map(x => x.r.id + '/' + x.m).join('+')), none: p.none.map(j => j.o.wo), dbl: seqDoubles(p).map(d => d.n.wo + '>' + d.w.id) }; });
  return { a, R, pl };
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1: unit spellings and floor spellings
    const rows1 = [['A1', 'T12', 'Apt 7', 'K8', 'HOUSE TYPE A', 'kitchen'], ['A2', 'T12', '8', 'K8', 'HOUSE TYPE A', 'kitchen'], ['A3', 'T12', 'Unit 009', 'K8', 'HOUSE TYPE A', 'kitchen'],
      ['F0', 'T12', '20', 'K8', 'HOUSE TYPE A', 'kitchen'], ['F1', 'T12', '21', 'K8', 'HOUSE TYPE A', 'kitchen'], ['F2', 'T12', '22', 'K8', 'HOUSE TYPE A', 'kitchen'],
      ['F3', 'T12', '23', 'K8', 'HOUSE TYPE A', 'kitchen'], ['F4', 'T12', '24', 'K8', 'HOUSE TYPE A', 'kitchen'], ['F5', 'T12', '25', 'K8', 'HOUSE TYPE A', 'kitchen'],
      ['M1', 'T12', '26', 'K8', 'HOUSE TYPE A', 'kitchen'], ['T1', 'T09', '27', 'K8', 'HOUSE TYPE A', 'kitchen'], ['TT', 'T12', '28', 'K8', 'HOUSE TYPE A', 'kitchen']];
    const jobs1 = [J('WO-101', 'T12', 'APT07', 'HOUSE TYPE A'), J('WO-102', 'T12', 'Unit 008', 'HOUSE TYPE A'), J('WO-103', 'T12', '9', 'HOUSE TYPE A'),
      J('WO-110', '0', '20', 'HOUSE TYPE A'), J('WO-111', 'GF', '21', 'HOUSE TYPE A'), J('WO-112', 'LGF', '22', 'HOUSE TYPE A'), J('WO-113', 'G', '23', 'HOUSE TYPE A'),
      J('WO-114', '', '24', 'HOUSE TYPE A'), J('WO-115', 'FF', '25', 'HOUSE TYPE A'), J('WO-116', 'Multiple', '26', 'HOUSE TYPE A'), J('WO-117', 'T10', '27', 'HOUSE TYPE A'),
      J('WO-118', '', '', 'BLOCK T12 APT 28 HOUSE TYPE A')];
    const S1 = server(rows1, jobs1);
    let { a, R, pl } = await run(browser, S1, jobs1.map(o => o.wo));
    rec('K1 "Apt 7" row = WO "APT07"; "8" = "Unit 008"; "Unit 009" = "9": automatic', rowOf(S1, 'A1').wo === 'WO-101' && rowOf(S1, 'A2').wo === 'WO-102' && rowOf(S1, 'A3').wo === 'WO-103', JSON.stringify([rowOf(S1, 'A1').wo, rowOf(S1, 'A2').wo, rowOf(S1, 'A3').wo, R]));
    rec('K2 Floor "0" vs "T12": not automatic, listed to confirm', !rowOf(S1, 'F0').wo && pl.confirm.some(c => /^WO-110:F0\/unsure$/.test(c)), JSON.stringify(pl.confirm));
    rec('K3 Floor "GF" vs "T12": not automatic, listed to confirm', !rowOf(S1, 'F1').wo && pl.confirm.some(c => /^WO-111:F1\//.test(c)));
    rec('K4 Floor "G" vs "T12": not automatic, listed to confirm', !rowOf(S1, 'F3').wo && pl.confirm.some(c => /^WO-113:F3\//.test(c)));
    rec('K5 Floor blank vs "T12": not automatic, listed to confirm', !rowOf(S1, 'F4').wo && pl.confirm.some(c => /^WO-114:F4\//.test(c)));
    rec('K6 Floor "Multiple" vs "T12": not automatic, listed to confirm', !rowOf(S1, 'M1').wo && pl.confirm.some(c => /^WO-116:M1\//.test(c)));
    rec('K7 same unit 27 in T09 (row) and T10 (WO): never matched, WO-117 gets its own 🆕 row', !rowOf(S1, 'T1').wo && woRows(S1, 'WO-117').length === 1 && woRows(S1, 'WO-117')[0].id !== 'T1');
    rec('K8 floor / unit only in the WO title ("BLOCK T12 APT 28"): not automatic, offered to confirm', !rowOf(S1, 'TT').wo && pl.confirm.some(c => /^WO-118:TT\//.test(c)), JSON.stringify(pl.confirm.filter(c => /118/.test(c))));
    // the Irish level codes Cienapps / sites use: LGF (lower ground), FF (first floor) — against a block code: must be "not sure"
    rec('K10 Floor "LGF" (lower ground floor) vs "T12": a person is asked (not silently "different" → a 2nd row for the house)', !rowOf(S1, 'F2').wo && pl.confirm.some(c => /^WO-112:F2\//.test(c)) && !woRows(S1, 'WO-112').length,
      JSON.stringify({ confirm: pl.confirm.filter(c => /112/.test(c)), rows: woRows(S1, 'WO-112').map(r => r.id + (r.is_new ? '🆕' : '')), dbl: pl.dbl }));
    rec('K11 Floor "FF" (first floor) vs "T12": a person is asked (not silently "different" → a 2nd row for the house)', !rowOf(S1, 'F5').wo && pl.confirm.some(c => /^WO-115:F5\//.test(c)) && !woRows(S1, 'WO-115').length,
      JSON.stringify({ confirm: pl.confirm.filter(c => /115/.test(c)), rows: woRows(S1, 'WO-115').map(r => r.id + (r.is_new ? '🆕' : '')), dbl: pl.dbl }));
    rec('K12 if a 🆕 row was added for LGF / FF, it is at least flagged as a possible double of the waiting row', !woRows(S1, 'WO-112').length || pl.dbl.includes('WO-112>F2'), JSON.stringify(pl.dbl));
    rec('K13 every WO on at most one live row', (() => { const m = {}; S1.db.t.project_seq.filter(r => r.state !== 'removed' && r.wo).forEach(r => { m[r.wo] = (m[r.wo] || 0) + 1; }); return Object.values(m).every(n => n === 1); })());
    await a.close();

    // ---------- 2: Reference "2796-15-2-APT 51" with Floor / Unit blank (the WO's house only in the Reference)
    const rows2 = [['RF', 'T12', '51', 'K8', 'HOUSE TYPE A', 'kitchen'], ['OK1', 'T12', '52', 'K8', 'HOUSE TYPE A', 'kitchen'], ['OK2', 'T12', '53', 'K8', 'HOUSE TYPE A', 'kitchen']];
    const jobs2 = [J('WO-201', '', '', 'HOUSE TYPE A', { ref: '2796-15-2-APT 51' }), J('WO-202', 'T12', '52', 'HOUSE TYPE A'), J('WO-203', 'T12', '53', 'HOUSE TYPE A')];
    const S2 = server(rows2, jobs2);
    ({ a, R, pl } = await run(browser, S2, jobs2.map(o => o.wo)));
    rec('K14 WO with Floor / Unit blank (house only in the Reference): never automatic', !rowOf(S2, 'RF').wo && !woRows(S2, 'WO-201').length, JSON.stringify(pl.confirm));
    rec('K15 …and it does NOT block the certain ones in the same project (WO-202 → OK1, WO-203 → OK2 automatic)', rowOf(S2, 'OK1').wo === 'WO-202' && rowOf(S2, 'OK2').wo === 'WO-203', JSON.stringify({ R, confirm: pl.confirm }));
    const cand201 = (pl.confirm.find(c => /^WO-201:/.test(c)) || '').split(':')[1] || '';
    rec('K16 the WO with no house is offered a sensible short list (not every kitchen row of the project)', cand201.split('+').filter(Boolean).length <= 1 || pl.confirm.length < 3, cand201);
    await a.close();
    // 2b: a WO with Floor T12 and a BLANK Unit
    const S2b = server(rows2.slice(1).concat([['UB', 'T12', '29', 'K8', 'HOUSE TYPE A', 'kitchen']]), [J('WO-119', 'T12', '', 'HOUSE TYPE A'), J('WO-202', 'T12', '52', 'HOUSE TYPE A'), J('WO-203', 'T12', '53', 'HOUSE TYPE A')]);
    ({ a, R, pl } = await run(browser, S2b, ['WO-119', 'WO-202', 'WO-203']));
    rec('K9 WO with a blank Unit (Floor T12): not automatic', !rowOf(S2b, 'UB').wo && !woRows(S2b, 'WO-119').length);
    rec('K9b …and it does NOT block the certain ones (WO-202 → OK1, WO-203 → OK2)', rowOf(S2b, 'OK1').wo === 'WO-202' && rowOf(S2b, 'OK2').wo === 'WO-203', JSON.stringify({ R, confirm: pl.confirm }));
    await a.close();

    // ---------- 3: a waiting row with NO house at all (e.g. a TOTAL / note line saved from the upload) — does it block matching?
    const rows3 = [['TOT', '', '', '', 'TOTAL', 'kitchen'], ['H1', 'T12', '61', 'K8', 'HOUSE TYPE A', 'kitchen'], ['H2', 'T12', '62', 'K8', 'HOUSE TYPE A', 'kitchen']];
    const jobs3 = [J('WO-301', 'T12', '61', 'HOUSE TYPE A'), J('WO-302', 'T12', '62', 'HOUSE TYPE A')];
    const S3 = server(rows3, jobs3);
    ({ a, R, pl } = await run(browser, S3, jobs3.map(o => o.wo)));
    rec('K17 a no-house waiting row ("TOTAL") does not stop certain WOs matching their own rows', rowOf(S3, 'H1').wo === 'WO-301' && rowOf(S3, 'H2').wo === 'WO-302', JSON.stringify({ R, confirm: pl.confirm }));
    rec('K18 the "TOTAL" row never takes a WO', !rowOf(S3, 'TOT').wo);
    await a.close();

    // ---------- 4: one BED 1 robe row waiting, a BED 2 WO arrives (BED 1's WO not made yet)
    const rows4 = [['RB1', 'T12', '70', 'W2', 'HOUSE TYPE B BED 1', 'robes']];
    const jobs4 = [J('WO-401', 'T12', '70', 'HOUSE TYPE B BED 2')];
    const S4 = server(rows4, jobs4);
    ({ a, R, pl } = await run(browser, S4, jobs4.map(o => o.wo)));
    rec('K19 a "BED 2" WO never takes the only waiting robe row when that row is named "BED 1" (asked instead)', !rowOf(S4, 'RB1').wo, JSON.stringify({ wo: rowOf(S4, 'RB1').wo, how: rowOf(S4, 'RB1').match_how }));
    await a.close();

    // ---------- 5: island line whose Description says KITCHEN; the kitchen and island WOs
    const rows5 = [['K', 'T12', '80', 'K8', 'HOUSE TYPE B', 'kitchen', 'KITCHEN TYPE 1'], ['IS', 'T12', '80', 'K9', 'HOUSE TYPE B ISLAND', null, 'KITCHEN ISLAND 2400']];
    const kd = await (async () => { const t = await X.dev(browser, X.makeServer(), 'office'); const k = await t.page.evaluate(() => seqKind('HOUSE TYPE B ISLAND KITCHEN ISLAND 2400') + '/' + seqKind('HOUSE TYPE B ISLAND')); await t.close(); return k; })();
    rows5[1][5] = kd.split('/')[0];
    const jobs5 = [J('WO-501', 'T12', '80', 'HOUSE TYPE B'), J('WO-502', 'T12', '80', 'HOUSE TYPE B ISLAND')];
    const S5 = server(rows5, jobs5);
    ({ a, R, pl } = await run(browser, S5, jobs5.map(o => o.wo)));
    rec('K20 island line (Description "KITCHEN ISLAND") and island WO get the same kind', kd.split('/')[0] === kd.split('/')[1], kd);
    rec('K21 the island WO takes / is offered the island row (no 🆕 second island row)', rowOf(S5, 'IS').wo === 'WO-502' || pl.confirm.some(c => /^WO-502:.*IS\//.test(c)), JSON.stringify({ is: rowOf(S5, 'IS').wo, k: rowOf(S5, 'K').wo, new502: woRows(S5, 'WO-502').map(r => r.id), confirm: pl.confirm }));
    await a.close();

    // ---------- 6: P-number never takes a waiting row; one WO / two identical rows → first by position
    const rows6 = [['W6', 'T12', '90', 'K8', 'HOUSE TYPE C', 'kitchen'], ['D1', 'T12', '91', 'W2', 'HOUSE TYPE C BED 2', 'robes'], ['D2', 'T12', '91', 'W2', 'HOUSE TYPE C BED 2', 'robes']];
    const jobs6 = [H.order({ wo: 'P-1020', pid: 'P1', customer: C, floor: 'T12', unit: '90', title: 'HOUSE TYPE C', step: 'Planner WO', value: 0, plannedWeek: '', dueDate: '2026-12-10', origDueDate: '2026-12-10', log: [] }),
      J('WO-601', 'T12', '91', 'HOUSE TYPE C BED 2')];
    const S6 = server(rows6, jobs6);
    ({ a, R, pl } = await run(browser, S6, ['P-1020', 'WO-601']));
    rec('K22 a P-number never takes the waiting row, and gets no 🆕 row', !rowOf(S6, 'W6').wo && !woRows(S6, 'P-1020').length);
    rec('K23 one WO / two identical BED 2 rows: automatic, the first by position (D1)', rowOf(S6, 'D1').wo === 'WO-601' && !rowOf(S6, 'D2').wo, JSON.stringify([rowOf(S6, 'D1').wo, rowOf(S6, 'D2').wo]));
    rec('no page errors', ![S1, S2, S3, S4, S5, S6].some(s => (s.errors || []).length), JSON.stringify([S1, S2, S3, S4, S5, S6].map(s => s.errors || [])));
    await a.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
