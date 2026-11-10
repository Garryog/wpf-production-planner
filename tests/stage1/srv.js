// Version-aware fake Supabase shared by several pages. Never touches the network.
const H = require('../harness.js');
function makeServer(row, opts = {}) {
  return { row: JSON.parse(JSON.stringify(row)), backups: [], nextId: 1, patches: [], log: [], offline: false, versioned: opts.versioned !== false, broken: null, lastMod: opts.lastMod || null };
}
async function attach(t, S) {
  await t.page.unroute('**/*');
  await t.page.route('**/*', async route => {
    const req = route.request(), url = req.url(), m = req.method();
    if (url.startsWith('https://wpf.test/')) {
      if (m === 'HEAD' || url.includes('?v=')) return route.fulfill({ status: 200, headers: S.lastMod ? { 'last-modified': S.lastMod } : {}, body: '' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: require('fs').readFileSync(require('path').join(__dirname,'../../index.html'), 'utf8') });
    }
    if (url.includes('xlsx.full.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: require('fs').readFileSync(require('path').join(__dirname,'../../xlsx.full.min.js'), 'utf8') });
    if (!url.includes('supabase.co')) return route.fulfill({ status: 404, body: '' });
    S.log.push(m + ' ' + url.replace(/^.*rest\/v1/, ''));
    if (S.offline) return route.abort('internetdisconnected');
    if (url.includes('/planner_backups')) {
      if (S.noBackupTable) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"42P01","message":"relation \\"planner_backups\\" does not exist"}' });
      if (m === 'POST') { const b = JSON.parse(req.postData()); const r = { id: S.nextId++, taken_at: S.takenAt || new Date().toISOString(), ...b }; S.backups.push(r); return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([r]) }); }
      if (m === 'GET') {
        let rows = S.backups.slice();
        const id = url.match(/id=eq\.(\d+)/); if (id) rows = rows.filter(r => r.id === +id[1]);
        if (/order=taken_at\.desc/.test(url)) rows.sort((a, b) => b.taken_at < a.taken_at ? -1 : 1);
        if (/limit=1/.test(url)) rows = rows.slice(0, 1);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
      }
      if (m === 'DELETE') { const lt = decodeURIComponent((url.match(/taken_at=lt\.([^&]+)/) || [])[1] || ''); S.deleted = (S.deleted || []).concat(S.backups.filter(r => lt && r.taken_at < lt).map(r => r.id)); S.backups = S.backups.filter(r => !(lt && r.taken_at < lt)); return route.fulfill({ status: 204, body: '' }); }
    }
    if (url.includes('/production_planner')) {
      if (m === 'GET') { if (S.broken !== null) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(S.broken) }); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(S.row ? [S.row] : []) }); }
      if (m === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}'); S.patches.push(body);
        if (S.failSaves) return route.fulfill({ status: 500, body: 'err' });
        if (!S.versioned) {
          if ('version' in body || 'updated_by' in body) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"PGRST204","message":"Could not find the \'version\' column of \'production_planner\' in the schema cache"}' });
          Object.assign(S.row, body); return route.fulfill({ status: 204, body: '' });
        }
        const v = url.match(/version=eq\.(\d+)/);
        if (v && +v[1] !== S.row.version) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        const before = S.row.version; Object.assign(S.row, body);
        if (S.trigger !== false) { S.row.version = (+before || 1) + 1; S.row.updated_at = new Date().toISOString(); } // Stage 1 SQL trigger: version := old.version + 1
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([S.row]) });
      }
    }
    return route.fulfill({ status: 404, body: '' });
  });
}
async function open(browser, S, opts = {}) {
  const t = await H.open({ browser, now: opts.now, row: S.row || { id: 'main', orders: [], nid: 1, settings: {} }, viewport: opts.viewport });
  await attach(t, S);
  await t.page.evaluate(() => loadDB());
  if (opts.role) await t.page.evaluate(r => { localStorage.setItem('wpfPin_' + r, '9000'); setRole(r); }, opts.role);
  return t;
}
async function reopen(t, S) { // same device (same localStorage), fresh tab
  const page = await t.ctx.newPage(); const n = { ...t, page };
  page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await attach(n, S);
  await page.goto('https://wpf.test/?view=office');
  await page.waitForFunction(() => typeof analyzeImport === 'function'); await page.waitForTimeout(400);
  return n;
}
module.exports = { reopen, H, makeServer, attach, open };
