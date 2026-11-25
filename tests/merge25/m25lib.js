// Shared helpers for the Tester's merge-seam tests (25 Nov 2026 — Job B brought up to date with live).
// Fake Supabase only (tests/seq/fixs.js through tests/list-window/lw.js). Nothing here touches the app or the network.
const L = require('../list-window/lw.js');
const { X, H, sleep } = L;
const ROLES = ['office', 'prod', 'pm', 'driver', 'floor', 'design', 'pre', 'saw', 'stores', 'dash'];
// every date box the page draws for this job: [{f:'due'|'deliv', v:'YYYY-MM-DD', txt}]
const dq = (p, wo, root) => p.evaluate(({ wo, root }) => [...(document.querySelector(root || '#app') || document).querySelectorAll('[data-dq]')].filter(i => i.dataset.dq === wo).map(i => ({ f: i.dataset.f, v: i.value, txt: (i.closest('.dq-w') || i).innerText.replace(/\s+/g, ' ').trim() })), { wo, root });
// the text of the smallest row / card that names this job
const rowTxt = (p, wo, root) => p.evaluate(({ wo, root }) => { const out = []; const base = document.querySelector(root || '#app'); if (!base) return out; const w = document.createTreeWalker(base, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (n.textContent.trim() !== wo) continue; let e = n.parentElement; for (let i = 0; i < 8 && e && e !== base && e.innerText.replace(/\s+/g, ' ').trim().length < 40; i++) e = e.parentElement; out.push((e || n.parentElement).innerText.replace(/\s+/g, ' ').trim()); } return out; }, { wo, root });
const go = async (p, role, set, ms) => { await p.evaluate(({ role, set }) => { localStorage.setItem('wpfPin_' + role, pins()[role]); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); ROLE = role; if (set) (0, eval)(set); render(); }, { role, set }); await sleep(ms || 450); };
const job = (p, wo) => p.evaluate(wo => { const o = DB.orders.find(x => x.wo === wo); return o ? JSON.parse(JSON.stringify(o)) : null; }, wo);
const srvJob = (S, wo) => (S.row.orders || []).find(o => o.wo === wo);
const why = async (p, k) => { const r = await p.evaluate(k => { const b = [...document.querySelectorAll('.pod-ovl [data-why]')].find(x => x.dataset.why === k); if (!b) return 'no reason picker: ' + [...document.querySelectorAll('.pod-ovl')].map(o => o.innerText.slice(0, 80)).join(' / '); b.click(); return 'ok'; }, k || 'Customer delay'); await sleep(350); return r; };
// catch every JavaScript error and console error on a page
const watch = (p, bag, tag) => { p.on('pageerror', e => bag.push((tag || '') + ' pageerror: ' + String(e).slice(0, 220))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|blockedbyclient/i.test(m.text())) bag.push((tag || '') + ' console: ' + m.text().slice(0, 220)); }); };
const toast = p => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
module.exports = Object.assign({}, L, { ROLES, dq, rowTxt, go, job, srvJob, why, watch, toast });
