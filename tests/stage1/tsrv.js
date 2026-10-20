// Tester's attack server: version-aware fake Supabase with per-device latency, failures and offline.
// Never touches the network — every request is fulfilled locally.
const fs = require('fs'), path = require('path');
const H = require('../harness.js');
const HTML = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const OLD_HTML = (() => { try { return require('child_process').execSync('git -C ' + path.join(__dirname, '../..') + ' show main:index.html', { maxBuffer: 1 << 26 }).toString(); } catch (e) { return null; } })();
const XLSXJS = fs.readFileSync(path.join(__dirname, '../../xlsx.full.min.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function makeServer(row, o = {}) {
  return { row: JSON.parse(JSON.stringify(row)), versioned: o.versioned !== false, bumpOnAnyUpdate: !!o.trigger, backups: [], nextId: 1, log: [], patches: 0, conflicts: 0, okSaves: 0 };
}
// dev: {name, offline, failRate, latency:[min,max], getDelay}
async function attach(page, S, dev) {
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url(), m = req.method();
    if (url.startsWith('https://wpf.test/')) {
      if (m === 'HEAD' || url.includes('?v=')) return route.fulfill({ status: 200, body: '' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: dev.old ? OLD_HTML : HTML });
    }
    if (url.includes('xlsx.full.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: XLSXJS });
    if (!url.includes('supabase.co')) return route.fulfill({ status: 404, body: '' });
    const lat = dev.latency ? dev.latency[0] + Math.random() * (dev.latency[1] - dev.latency[0]) : 0;
    S.log.push(dev.name + ' ' + m + ' ' + url.replace(/^.*rest\/v1/, ''));
    if (dev.offline) return route.abort('internetdisconnected');
    if (url.includes('/planner_backups')) {
      if (S.noBackupTable) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"42P01","message":"relation \\"planner_backups\\" does not exist"}' });
      if (m === 'POST') { const b = JSON.parse(req.postData()); const r = { id: S.nextId++, taken_at: new Date().toISOString(), ...b }; S.backups.push(r); if (S.bakReadBack) S.bakReadBackFn = r; return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{ id: r.id, taken_at: r.taken_at }]) }); }
      if (m === 'GET') {
        let rows = S.backups.slice(); const id = url.match(/id=eq\.(\d+)/); if (id) rows = rows.filter(r => r.id === +id[1]);
        if (/order=taken_at\.desc/.test(url)) rows.sort((a, b) => b.taken_at < a.taken_at ? -1 : 1);
        if (/limit=1/.test(url)) rows = rows.slice(0, 1);
        if (S.bakTamper) rows = rows.map(S.bakTamper);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
      }
      if (m === 'DELETE') { S.bakDeletes = (S.bakDeletes || []).concat(url); const lt = decodeURIComponent((url.match(/taken_at=lt\.([^&]+)/) || [])[1] || ''); S.backups = S.backups.filter(r => !(lt && r.taken_at < lt)); return route.fulfill({ status: 204, body: '' }); }
    }
    if (url.includes('/production_planner')) {
      if (m === 'DELETE') { S.mainDeletes = (S.mainDeletes || 0) + 1; return route.fulfill({ status: 204, body: '' }); }
      if (m === 'GET') { const body = JSON.stringify([S.row]); /* read happens first, reply arrives late */ await sleep(lat + (dev.getDelay || 0)); return route.fulfill({ status: 200, contentType: 'application/json', body }); }
      if (m === 'PATCH') {
        await sleep(lat / 2);
        const body = JSON.parse(req.postData() || '{}'); S.patches++;
        if (dev.failRate && Math.random() < dev.failRate) { await sleep(lat / 2); return route.fulfill({ status: 503, body: 'upstream' }); }
        if (dev.dropReply && Math.random() < dev.dropReply) { // the write LANDS but the reply is lost (phone loses signal mid-request)
          S._who = dev.name + '(reply lost)'; applyPatch(S, url, body); await sleep(lat / 2); return route.abort('connectionreset');
        }
        S._who = dev.name; const r = applyPatch(S, url, body); await sleep(lat / 2);
        if (r === 'nocol') return route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"42703","message":"column production_planner.version does not exist"}' });
        if (r === 'conflict') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        if (/return=representation/.test(req.headers()['prefer'] || '')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([S.row]) });
        return route.fulfill({ status: 204, body: '' });
      }
    }
    return route.fulfill({ status: 404, body: '' });
  });
}
function applyPatch(S, url, body) {
  if (!S.versioned) { if ('version' in body || /version=eq/.test(url)) return 'nocol'; Object.assign(S.row, body); S.okSaves++; return 'ok'; }
  const v = url.match(/version=eq\.(\d+)/);
  if (v && +v[1] !== S.row.version) { S.conflicts++; return 'conflict'; }
  const before = S.row.version;
  Object.assign(S.row, JSON.parse(JSON.stringify(body)));
  if (S.bumpOnAnyUpdate && S.row.version === before) S.row.version = before + 1; // what a DB trigger would do
  S.okSaves++; (S.hist = S.hist || []).push({ who: S._who, v: S.row.version, url: url.replace(/^.*\?/, ''), ticks: Object.keys(((S.row.settings || {}).listRow || {}).L || {}), caps: Object.keys((S.row.settings || {}).weekCaps || {}) }); return 'ok';
}
async function device(browser, S, dev, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: opts.viewport || { width: 1300, height: 900 }, timezoneId: 'Europe/Dublin' });
  if (!opts.ctx) await ctx.addInitScript(({ role }) => {
    if (!sessionStorage.getItem('__init')) {
      sessionStorage.setItem('__init', '1');
      if (!localStorage.getItem('wpfRole')) { localStorage.setItem('wpfRole', role); localStorage.setItem('wpfPin_' + role, '9000'); localStorage.setItem('wpfPin_office', '2468'); localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); }
      sessionStorage.setItem('wpfWho', 'T');
    }
    window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'T';
  }, { role: opts.role || 'office' });
  const page = await ctx.newPage();
  dev.errors = [];
  page.on('pageerror', e => dev.errors.push(String(e)));
  await attach(page, S, dev);
  await page.goto('https://wpf.test/?view=' + (opts.role || 'office'));
  await page.waitForFunction(() => typeof loadDB === 'function' && typeof DB !== 'undefined' && DB.loaded, null, { timeout: 15000 }).catch(() => {});
  return { ctx, page, dev, close: () => ctx.close() };
}
module.exports = { H, makeServer, attach, device, sleep, OLD_HTML };
