// Test harness: loads index.html in headless Chromium with ALL network stubbed.
// Nothing ever reaches the live Supabase project — every request is intercepted.
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const XLSXJS = fs.readFileSync(path.join(ROOT, 'xlsx.full.min.js'), 'utf8');

// row: the production_planner 'main' row the fake server returns
async function open(opts = {}) {
  const row = opts.row || { id: 'main', orders: [], nid: 1, settings: {} };
  // opts.server: share one fake database between two pages ("two PCs").
  const server = opts.server || { row: JSON.parse(JSON.stringify(row)), patches: [], posts: [], deletes: [], other: [], failSaves: opts.failSaves || false, failLoad: opts.failLoad || false };
  const browser = opts.browser || await chromium.launch();
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1400, height: 900 }, timezoneId: opts.tz || 'Europe/Dublin', acceptDownloads: true });
  if (opts.now) await ctx.addInitScript(`(()=>{const T=${+new Date(opts.now)};const R=Date;const off=T-R.now();class D extends R{constructor(...a){if(a.length===0){super(R.now()+off);}else super(...a);}static now(){return R.now()+off;}}D.UTC=R.UTC;D.parse=R.parse;window.Date=D;})();`);
  await ctx.addInitScript(() => {
    localStorage.setItem('wpfRole', 'office');
    localStorage.setItem('wpfPin_office', '2468');
    localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); // skip daily backup POST
    sessionStorage.setItem('wpfWho', 'Tester');
    window.__alerts = [];
    window.alert = m => window.__alerts.push(String(m));
    window.confirm = () => true;
    window.prompt = () => 'Tester';
    window.__opened = [];
    window.open = () => { const w = { document: { _h: '', write(h) { this._h += h; window.__opened.push(this._h); }, close() {} }, focus() {}, print() {}, close() {} }; return w; };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => (server.errors = server.errors || []).push(String(e)));
  await page.route('**/*', async route => {
    const req = route.request();
    const url = req.url();
    if (url === 'https://wpf.test/' || url.startsWith('https://wpf.test/?')) return route.fulfill({ status: 200, contentType: 'text/html', body: HTML });
    if (url.includes('xlsx.full.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: XLSXJS });
    if (url.includes('supabase.co')) {
      const m = req.method();
      if (m === 'GET') {
        if (server.failLoad) return route.fulfill({ status: 503, body: '{"message":"down"}' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(url.includes('id=eq.main') ? [server.row] : []) });
      }
      if (m === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}');
        server.patches.push(body);
        if (server.failSaves) return route.fulfill({ status: 500, body: 'err' });
        // Row has a version column (Stage 1 SQL run): behave like PostgREST + the production_planner_bump trigger.
        if (server.row && server.row.version !== undefined) {
          const v = url.match(/version=eq\.(\d+)/);
          if (v && +v[1] !== +server.row.version) { server.conflicts = (server.conflicts || 0) + 1; return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); }
          const before = +server.row.version || 1;
          Object.assign(server.row, body);
          server.row.version = before + 1; server.row.updated_at = new Date().toISOString();
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([server.row]) });
        }
        Object.assign(server.row, body); // no version column: old plain overwrite
        return route.fulfill({ status: 204, body: '' });
      }
      if (m === 'POST') { server.posts.push(req.postData()); return route.fulfill({ status: 201, body: '' }); }
      if (m === 'DELETE') { server.deletes.push(url); return route.fulfill({ status: 204, body: '' }); }
    }
    server.other.push(url);
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('https://wpf.test/?view=office');
  await page.waitForFunction(() => typeof XLSX !== 'undefined' && typeof analyzeImport === 'function');
  await page.waitForTimeout(300);
  return { browser, ctx, page, server, close: async () => { await ctx.close(); if (!opts.browser) await browser.close(); } };
}

function order(o) {
  return Object.assign({ wo: 'WO-1000-1', ref: '', floor: '', unit: '', title: 'Job', customer: 'Cust', hours: 5, hoursEstimated: false, dueDate: '2026-11-02', origDueDate: '2026-11-02', step: '3. In production', salesRep: '', orderNo: '', value: 4000, plannedWeek: '2026-10-26', notes: '', colour: '' }, o);
}

// Build an xlsx (base64 binary string) from an array-of-arrays inside the page using the app's own SheetJS.
async function importAoa(page, aoa, opts = {}) {
  return page.evaluate(async ({ aoa, opts }) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: !!opts.cellDates });
    if (opts.merges) ws['!merges'] = opts.merges;
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const bin = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
    const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 255;
    const file = new File([u8], 'export.xlsx');
    showTab('i');
    doImport(file);
    await new Promise(r => setTimeout(r, 400));
    return { iprev: (document.getElementById('iprev') || {}).innerText || '', plan: IMPPLAN ? JSON.parse(JSON.stringify(IMPPLAN)) : null, pend: PEND ? { map: PEND.map, n: PEND.rows.length } : null };
  }, { aoa, opts });
}

module.exports = { open, order, importAoa, chromium };
