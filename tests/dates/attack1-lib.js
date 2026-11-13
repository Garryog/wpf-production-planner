// Shared bits for tests/dates/attack1-*.test.js (Tester, 10 Nov 2026). Stubbed Supabase only — the fake database is
// tests/stage1/srv.js; the harness's network guard blocks anything else. openOld() runs the code from
// origin/feature/list-excel-template (the version still open on some screens on go-live day) against the same fake database.
const { execSync } = require('child_process');
const path = require('path');
const { H, makeServer, open, attach } = require('../stage1/srv');
const ROOT = path.resolve(__dirname, '../..');
const OLDS = {};
// ref: which old version to run (default the pre-week-tabs code; round 3 also uses origin/release/2026-11-10)
function oldHtml(ref) {
  ref = ref || 'origin/feature/list-excel-template';
  if (OLDS[ref] !== undefined) return OLDS[ref];
  try { OLDS[ref] = execSync('git show ' + ref + ':index.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString('utf8'); }
  catch (e) { OLDS[ref] = ''; }
  return OLDS[ref];
}
// Open the OLD code on a shared fake server S (same fake Supabase as srv.attach, but the page HTML is the old file).
async function openOld(browser, S, opts = {}) {
  if (!oldHtml(opts.ref)) throw new Error((opts.ref || 'origin/feature/list-excel-template') + ' not available');
  const t = await H.open({ browser, now: opts.now, row: S.row, viewport: opts.viewport });
  await attach2(t, S, opts.ref);
  await t.page.goto('https://wpf.test/?view=office');
  await t.page.waitForFunction(() => typeof analyzeImport === 'function'); await t.page.waitForTimeout(400);
  await t.page.evaluate(() => loadDB());
  t.page.on('pageerror', e => (S.errors = S.errors || []).push('OLD: ' + String(e)));
  return t;
}
// Playwright runs the LAST registered route first; register the old-HTML route last so it wins, supabase falls back to srv.
async function attach2(t, S, ref) {
  await t.page.unroute('**/*');
  await attach(t, S); // supabase + default html
  const html = oldHtml(ref), fs = require('fs'), XL = fs.readFileSync(path.join(ROOT, 'xlsx.full.min.js'), 'utf8');
  await t.page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (url.startsWith('https://wpf.test/')) {
      if (req.method() === 'HEAD' || url.includes('?v=')) return route.fulfill({ status: 200, body: '' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    }
    if (url.includes('xlsx.full.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: XL });
    return route.fallback();
  });
}
function recorder(label) {
  const res = [];
  const rec = (n, ok, d) => { res.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 700) : '')); };
  const done = () => { const f = res.filter(x => !x.ok).length; console.log('\n' + label + ': ' + (res.length - f) + ' passed, ' + f + ' failed'); process.exit(f ? 1 : 0); };
  return { rec, done, res };
}
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = p => p.evaluate(async () => { await loadDB(); });
const w = ms => new Promise(r => setTimeout(r, ms));
const XD = iso => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
module.exports = { H, makeServer, open, attach, attach2, openOld, oldHtml, recorder, save, reload, w, XD };
