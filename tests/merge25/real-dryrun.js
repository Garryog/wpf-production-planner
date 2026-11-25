// Dry run of REAL Cienapps upload files through the sequence upload reader and its add / skip / not-sure preview (nothing saved).
// Usage: node tests/merge25/real-dryrun.js <file.xlsx> [...]   Fake Supabase only. The files themselves are not kept in the repo.
const fs = require('fs'), path = require('path'); const X = require('../seq/fixs.js'); const { H, sleep } = X;
(async () => {
  const browser = await H.chromium.launch(); const S = X.makeServer(); const a = await X.dev(browser, S, 'office'), p = a.page;
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const pid = await p.evaluate(() => (lsProjects()[0] || {}).id);
  let carried = [];
  for (const f of process.argv.slice(2)) {
    const b64 = fs.readFileSync(f).toString('base64');
    const r = await p.evaluate(({ b64, pid, carried, name }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const r = seqUpBook(u.buffer); if (r.err) return { err: r.err };
      const c1 = seqClaimPreview(pid, r.lines, carried), rows = seqUpRows(r.lines, name, 'U1'), c2 = seqClaimPreview(pid, r.lines, carried.concat(rows));
      const cnt = a => a.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
      return { hdr: r.hdr, n: r.lines.length, kinds: cnt(r.lines.map(l => l.kind)), prods: cnt(r.lines.map(l => l.product)), floors: cnt(r.lines.map(l => l.floor)), units: [...new Set(r.lines.map(l => l.unit))].length,
        qty: cnt(r.lines.map(l => String(l.qty))), warn: r.warn, lineWarn: r.lines.filter(l => l.warn && l.warn.length).map(l => l.line_no + ': ' + l.warn.join('; ')).slice(0, 12), multi: r.lines.filter(l => l.multi).length,
        kids: cnt(r.lines.map(l => String((l.children || []).length))), sample: r.lines.slice(0, 3).map(l => [l.line_no, l.floor, l.unit, l.product, l.name, l.descr, l.kind, l.price].join(' | ')),
        odd: r.lines.filter(l => l.kind === 'other' || !l.floor || !l.unit).map(l => [l.line_no, l.floor, l.unit, l.product, l.name, l.kind].join(' | ')).slice(0, 10),
        first: { add: c1.add.length, skip: c1.skip.length, unsure: c1.unsure.length, why: c1.unsure.slice(0, 6).map(x => x.L.line_no + ': ' + x.why) },
        again: { add: c2.add.length, skip: c2.skip.length, unsure: c2.unsure.length, why: c2.unsure.slice(0, 6).map(x => x.L.line_no + ': ' + x.why) }, rows }; }, { b64, pid, carried, name: path.basename(f) });
    console.log('\n===== ' + path.basename(f)); if (r.err) { console.log('REFUSED: ' + r.err); continue; }
    carried = carried.concat(r.rows); delete r.rows; console.log(JSON.stringify(r, null, 1));
  }
  console.log('\npage errors:', JSON.stringify(errs)); await browser.close(); process.exit(0);
})();
