// Tester helpers for the Stage 3 attack tests. Fake Supabase only (srv3.js) — nothing reaches the live project.
const path = require('path'), fs = require('fs'), cp = require('child_process');
const F = require('./fix3.js');
const S3 = require('./srv3.js');
const { H, D } = F;
const ROOT = path.join(__dirname, '../..');
const gitShow = ref => { try { return cp.execSync('git -C ' + ROOT + ' show ' + ref + ':index.html', { maxBuffer: 1 << 27 }).toString(); } catch (e) { return null; } };
// A tab still running OLD code (e.g. what is live on GitHub Pages today), against the same fake database.
async function openOld(browser, S, html, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Dublin' });
  if (!opts.ctx) await ctx.addInitScript(() => {
    localStorage.setItem('wpfRole', 'office'); localStorage.setItem('wpfPin_office', '2468');
    localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); sessionStorage.setItem('wpfWho', 'OldTab');
    window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'OldTab';
    window.open = () => ({ document: { write() {}, close() {} }, focus() {}, print() {}, close() {} });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => (S.oldErrors = S.oldErrors || []).push(String(e)));
  const t = { ctx, page, close: () => ctx.close() };
  await S3.attach(t, S);
  await page.route(u => String(u).startsWith('https://wpf.test/'), route => {
    const m = route.request().method(), url = route.request().url();
    if (m === 'HEAD' || url.includes('?v=')) return route.fulfill({ status: 200, body: '' });
    return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });
  await page.goto('https://wpf.test/?view=office');
  await page.waitForFunction(() => typeof loadDB === 'function' && typeof XLSX !== 'undefined');
  await page.waitForTimeout(500);
  return t;
}
const k = r => [r.k, String(r.item || '').trim(), r.L, r.W, String(r.mat || '').trim(), String(r.note || '').trim()].join('|').toLowerCase();
let pass = 0, fail = 0; const fails = [];
function rec(n, ok, d) { if (ok) pass++; else { fail++; fails.push(n); } console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); }
function done() { console.log(fail + ' failed of ' + (pass + fail)); }
async function waitFor(p, fn, ms = 6000) { for (let i = 0; i < ms / 100; i++) { const r = await p.evaluate(fn); if (r) return r; await F.sleep(100); } return null; }
module.exports = { F, S3, H, D, gitShow, openOld, k, rec, done, waitFor };
