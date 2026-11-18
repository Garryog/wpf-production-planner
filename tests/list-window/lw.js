// Shared helpers for the Tester's list-window attack tests (12 Nov, simple layout). Fake Supabase only — tests/seq/fixs.js.
const X = require('../seq/fixs.js');
const { H, D, sleep } = X;
const closeAll = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const ed = p => p.evaluate(() => !!document.querySelector('.me-ed'));
// record every confirm / prompt; answers: window.__confirm (default true), window.__prompt (default 'Op')
const asks = p => p.evaluate(() => { window.__asked = []; window.__prompted = [];
  window.confirm = m => { window.__asked.push(String(m)); return typeof window.__confirm === 'function' ? window.__confirm(String(m)) : window.__confirm !== undefined ? window.__confirm : true; };
  window.prompt = (m, d) => { window.__prompted.push(String(m)); return typeof window.__prompt === 'function' ? window.__prompt(String(m)) : window.__prompt !== undefined ? window.__prompt : 'Op'; }; });
const setv = (p, k, v) => p.evaluate(({ k, v }) => { const e = document.querySelector('.me-ed [data-mr="' + k + '"]'); if (!e) return 'no ' + k; e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); return 'ok'; }, { k, v });
const setid = (p, id, v, ev) => p.evaluate(({ id, v, ev }) => { const e = document.getElementById(id); if (!e) return 'no #' + id; e.value = v; e.dispatchEvent(new Event(ev || (e.tagName === 'SELECT' ? 'change' : 'input'))); return 'ok'; }, { id, v, ev });
const click = (p, id) => p.evaluate(id => { const e = document.getElementById(id); if (!e) return 'no #' + id; e.click(); return 'ok'; }, id);
const fillSaw = async (p, i, item, qty, L, W, mat) => { for (const [f, v] of [['item', item], ['qty', qty], ['L', L], ['W', W], ['mat', mat]]) await setv(p, i + '|' + f, v); };
const save = async (p, ms) => { await click(p, 'me-save'); await sleep(ms || 1500); };
const donep = p => p.evaluate(() => { const d = document.querySelector('.me-dov'); if (!d) return null; return { h: d.querySelector('#me-dok').textContent, l: d.querySelector('.me-dl').innerText, html: d.innerHTML }; });
const err = p => p.evaluate(() => (document.getElementById('me-err') || {}).textContent || '');
// what the window shows about its job
const job = p => p.evaluate(() => { const g = id => document.getElementById(id), w = g('me-wo'), pd = g('me-pid');
  const hid = e => !e ? null : !!(e.closest('[hidden]'));
  return { open: !!document.querySelector('.me-ed'), hwo: g('me-hwo') ? g('me-hwo').textContent : null, due: g('me-due') ? g('me-due').textContent : null, dueCls: g('me-due') ? g('me-due').className : null,
    wo: w ? w.value : null, woHidden: hid(w), pid: pd ? pd.value : null, pidHidden: hid(pd), tog: !!g('me-jobtog'), pjro: g('me-pjro') ? g('me-pjro').textContent : null,
    pm: (g('me-pm') || {}).innerText || '', err: (g('me-err') || {}).textContent || '', info: (g('me-woinfo') || {}).innerText || '', title: (document.querySelector('.me-tb') || {}).innerText || '' }; });
const rows = p => p.evaluate(() => [...document.querySelectorAll('.me-ed [data-row]')].map(tr => { const q = f => { const e = tr.querySelector('[data-mr$="|' + f + '"]'); return e ? e.value : undefined; }; return { hdr: /me-h|me-ch/.test(tr.className), item: q('item'), qty: q('qty'), L: q('L'), W: q('W'), mat: q('mat'), units: q('units') }; }));
const liveFor = (S, wo) => S.db.t.lists.filter(l => !l.archived && !l.is_template && (l.wos || []).includes(wo));
const linesOf = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null);
const snap = (S, id) => JSON.stringify([S.db.t.lists.find(l => l.id === id), S.db.t.list_lines.filter(x => x.list_id === id)]);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast,#toast,.toasts *')].map(x => x.innerText).join(' | '));
module.exports = { X, H, D, sleep, rec: X.rec, finish: X.finish, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf, snap, toasts };
