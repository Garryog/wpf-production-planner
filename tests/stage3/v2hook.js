// Preload (node -r tests/stage3/v2hook.js <test>) that runs an existing test file with the lists switch ON:
// every require of tests/stage1/srv.js gets the Stage 3 fake (srv3.js); the first page that opens a fixture migrates it
// with the app's own "Migrate lists" (lsMigrate, count check included), and saveDB / loadDB also send the line queue /
// poll the lists tables — so a test's "save" and "reload" mean the same thing in both modes. Fake Supabase only.
const Module = require('module'), path = require('path');
const SRV1 = path.join(__dirname, '../stage1/srv.js');
const S3 = require('./srv3.js'), S1 = require(SRV1);
const PATCH = `(()=>{const go=()=>{if(typeof saveDB!=='function'||window.__v2wrap)return;window.__v2wrap=1;
  const s0=saveDB,l0=loadDB;
  saveDB=async function(){if(V2())await lqSend();return s0.apply(this,arguments);};
  loadDB=async function(){const r=await l0.apply(this,arguments);if(V2()){if(!LST.loaded)await lsLoad();else await lsPoll();}return r;};};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();})();`;
async function migrate(t, S) {
  await t.page.evaluate(PATCH);
  if (!(S.row && S.row.settings && S.row.settings.listStore === 'v2') && S.row && S.row.settings && (S.row.settings.lists || []).length) {
    const r = await t.page.evaluate(async () => { try { const x = await lsMigrate('v2-wrapper'); return { ok: x.ok, bad: x.check.bad }; } catch (e) { return { ok: false, err: e.message }; } });
    if (!r.ok) console.log('WRAPPER migration failed: ' + JSON.stringify(r));
    S.migrated = (S.migrated || 0) + 1;
  }
  await t.page.evaluate(async () => { await loadDB(); if (V2()) { lsReset(); await lsLoad(); } });
}
async function open(browser, S, opts = {}) {
  const t = await S1.H.open({ browser, now: opts.now, row: S.row || { id: 'main', orders: [], nid: 1, settings: {} }, viewport: opts.viewport });
  t.page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await t.ctx.addInitScript(PATCH);
  await S3.attach(t, S);
  await t.page.evaluate(() => loadDB());
  await migrate(t, S);
  if (opts.role) await t.page.evaluate(r => { localStorage.setItem('wpfPin_' + r, '9000'); setRole(r); }, opts.role);
  return t;
}
async function reopen(t, S) {
  const page = await t.ctx.newPage(); const n = { ...t, page };
  page.on('pageerror', e => (S.errors = S.errors || []).push(String(e)));
  await S3.attach(n, S);
  await page.goto('https://wpf.test/?view=office');
  await page.waitForFunction(() => typeof analyzeImport === 'function'); await page.waitForTimeout(400);
  await page.evaluate(async () => { if (V2()) { await lsLoad(); render(); } });
  return n;
}
const wrapped = { ...S1, makeServer: S3.makeServer, attach: S3.attach, open, reopen };
const load0 = Module._load;
Module._load = function (req, parent, isMain) {
  if (parent && /^\.\.?\//.test(req) && path.resolve(path.dirname(parent.filename), req).replace(/\.js$/, '') === SRV1.replace(/\.js$/, '')) return wrapped;
  return load0.apply(this, arguments);
};
console.log('INFO running with the lists switch ON (v2) — fixtures migrated by lsMigrate');
