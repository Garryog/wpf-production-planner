// Stage 2 step 3: normaliseRow (blank = not supplied) and combineRows (duplicates, A/C fold). Stubbed Supabase only.
// Run: node tests/stage2/combine.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const t = await H.open({ now: '2026-10-19T10:00:00Z' });
  const r = await t.page.evaluate(() => {
    const n = normaliseRow({ wo: ' wo-1-1 ', title: '', customer: 'Acme ', step: '3. In production ', value: '€1,000', hours: '', dueDate: '', ref: '2604-1-2-14', sheets: '7' });
    const skip = [normaliseRow({ wo: '' }), normaliseRow({ wo: 'Total' }), normaliseRow({ wo: 'nan' })].map(x => x.skip);
    const bad = normaliseRow({ wo: 'WO-1-2', hours: 99999, dueDate: '31/02/2026', value: 'abc' });
    const dup = combineRows([normaliseRow({ wo: 'WO-5-1', title: 'A', dueDate: '2026-11-20', value: '' }), normaliseRow({ wo: 'wo-5-1', title: 'B', dueDate: '2026-11-13', value: 5000 })]);
    const board = new Map([['WO-9-1', { wo: 'WO-9-1' }], ['WO-9-2B', { wo: 'WO-9-2B' }]]);
    const ac = combineRows(['WO-2604-7', 'WO-2604-7A', 'WO-2604-7-C', '2557_01A', '2557_01', 'WO-9-1A', 'WO-9-2B', 'WO-8-3A'].map((w, i) => normaliseRow({ wo: w, value: 1000 * (i + 1) })), board);
    return { n, skip, bad, dup, ac };
  });
  const n = r.n;
  rec('normaliseRow: trims, keys, value parsed, floor/unit from Reference, sheets kept', n.key === 'WO-1-1' && n.customer === 'Acme' && n.step === '3. In production' && n.value === 1000 && n.floor === '2' && n.unit === '14' && n.sheets === 7, JSON.stringify(n));
  rec('normaliseRow: blank title/hours/due are "not supplied"', !n.has.title && !n.has.hours && !n.has.dueDate && n.has.value && n.has.step, JSON.stringify(n.has));
  rec('normaliseRow: no-WO and totals rows skipped', JSON.stringify(r.skip) === '["noWo","totals","noWo"]', JSON.stringify(r.skip));
  rec('normaliseRow: bad hours / impossible date / junk value flagged, not supplied', r.bad.hoursBad && r.bad.dueBad && !r.bad.has.value && !r.bad.has.dueDate && r.bad.flags.length === 3, JSON.stringify(r.bad.flags));
  const d = r.dup.recs;
  rec('AC3 combineRows: same WO twice → one record, filled cells win, earliest due, flagged', d.length === 1 && d[0].title === 'A' && d[0].value === 5000 && d[0].dueDate === '2026-11-13' && /duplicate in file/.test(d[0].flags[0]), JSON.stringify(d));
  const keys = r.ac.recs.map(x => x.key + (x.adds ? '{' + Object.keys(x.adds).join('+') + '}' : '') + (x.synth ? '*' : ''));
  rec('AC25 combineRows: A and -C fold into WO-2604-7; 2557_01A into 2557_01', keys.includes('WO-2604-7{WO-2604-7A+WO-2604-7-C}') && keys.includes('2557_01{2557_01A}'), keys.join(' '));
  rec('AC25 base only on the board → addition record; already-on-board A line stays; base not found stays + flagged', keys.includes('WO-9-1{WO-9-1A}*') && keys.includes('WO-9-2B') && keys.includes('WO-8-3A') && r.ac.recs.find(x => x.key === 'WO-8-3A').flags.some(f => /base WO-8-3 not found/.test(f)), keys.join(' '));
  rec('folds listed for the preview', r.ac.folds.length === 4 && r.ac.folds.every(f => f.base && f.letter), JSON.stringify(r.ac.folds.map(f => f.wo + '>' + f.base)));
  await t.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
