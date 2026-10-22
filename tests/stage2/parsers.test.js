// Stage 2 step 1: the cell parsers on their own (woKey, parseNum, parseDateIE, parseHours). Stubbed Supabase only.
// Run: node tests/stage2/parsers.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const t = await H.open({ now: '2026-10-19T10:00:00Z' });
  const r = await t.page.evaluate(() => ({
    keys: [woKey(1234), woKey(' 1234 '), woKey('wo-2604-1'), woKey(null)],
    nums: [parseNum('€12,500.00'), parseNum('12,500'), parseNum(12500), parseNum(''), parseNum('  '), String(parseNum('abc')), parseNum('€ 1 200,00'.replace(',00', ''))],
    dates: ['04/10/2026', '4/10/26', '04-10-2026', '04.10.2026', '04 Oct 2026', 'Oct 4, 2026', '2026-10-04', '4 October 2026', '31/02/2026', '29/02/2027', '29/02/2028', 'rubbish', '', 46299].map(v => [v, parseDateIE(v)]),
    hrs: [8, '8h', ' 8 hrs', -5, 0, 99999, '', 'abc', 500, 500.5].map(v => [v, parseHours(v)])
  }));
  rec('AC4 woKey: 1234 = "1234", lowercase = uppercase', JSON.stringify(r.keys) === JSON.stringify(['1234', '1234', 'WO-2604-1', '']), JSON.stringify(r.keys));
  rec('AC6 parseNum: "€12,500.00" and "12,500" → 12500, blank → null, junk → NaN', r.nums[0] === 12500 && r.nums[1] === 12500 && r.nums[2] === 12500 && r.nums[3] === null && r.nums[4] === null && r.nums[5] === 'NaN', JSON.stringify(r.nums));
  const d = Object.fromEntries(r.dates.map(x => [String(x[0]), x[1]]));
  const good = ['04/10/2026', '4/10/26', '04-10-2026', '04.10.2026', '04 Oct 2026', 'Oct 4, 2026', '2026-10-04', '4 October 2026'].every(k => d[k] === '2026-10-04');
  rec('AC8 parseDateIE: all 7 formats (+ long month) → 2026-10-04', good, JSON.stringify(r.dates.slice(0, 8)));
  rec('AC8 parseDateIE: 31/02/2026 and 29/02/2027 rejected, 29/02/2028 kept', d['31/02/2026'] === null && d['29/02/2027'] === null && d['29/02/2028'] === '2028-02-29', JSON.stringify([d['31/02/2026'], d['29/02/2027'], d['29/02/2028']]));
  rec('parseDateIE: blank → "" (not supplied), junk → null, Excel serial 46299 → 2026-10-04', d[''] === '' && d['rubbish'] === null && d['46299'] === '2026-10-04', JSON.stringify([d[''], d['rubbish'], d['46299']]));
  const h = Object.fromEntries(r.hrs.map(x => [String(x[0]), x[1]]));
  rec('AC15 parseHours: "8h" → 8, " 8 hrs" → 8, 500 ok', h['8h'].h === 8 && h[' 8 hrs'].h === 8 && h['8'].h === 8 && h['500'].h === 500, JSON.stringify(r.hrs));
  rec('AC15 parseHours: -5, 0, 99999, 500.5, "abc" are bad; blank is "not supplied"', ['-5', '0', '99999', '500.5', 'abc'].every(k => h[k] && h[k].bad) && h[''] === null, JSON.stringify(r.hrs));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
