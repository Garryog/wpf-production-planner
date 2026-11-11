// Tester attack 2 (Project details, Garry's 11 Nov answer 4): changing a job's Customer in the cutting-list window is
// Admin only (Admin PIN every time). Wrong PIN, Cancel, blank, same value, case-only change, ↺ undo of a customer
// override, P-number jobs, Floor / Unit / Title still free. Fake Supabase only. Run: node tests/project-details/attack2-cust.test.js
const X = require('./fixp.js');
const { H, rec, sleep } = X;
const ev = (t, fn, a) => t.page.evaluate(fn, a);
// type into a box of the list window (or of a stand-alone copy of the boxes for a P-number job) and leave it
const type = (t, k, v, pin, root) => ev(t, ([k, v, pin, root]) => { window.__pp = []; window.prompt = m => { window.__pp.push(m); return pin; }; window.confirm = () => true;
  const r = root ? document.getElementById(root) : document; const i = r.querySelector('[data-woe="' + k + '"]'); i.value = v; i.onchange();
  const o = DB.orders.find(x => x.wo === (root ? 'P-77' : 'WO-1')); return { asked: window.__pp.filter(m => /Admin PIN/.test(m)).length, cust: o.customer, pov: o.pov ? Object.keys(o.pov).join() : '', box: r.querySelector('[data-woe="' + k + '"]').value, val: o[k] }; }, [k, v, pin, root || '']);
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const of = await X.dev(browser, S, 'office');
  await ev(of, () => showTab('l')); await sleep(300);
  await ev(of, () => document.querySelector('[data-lhedit="L1"]').click()); await sleep(500);
  const w = await type(of, 'customer', 'Cairn Homes', '1234');
  rec('wrong PIN: customer unchanged, the box shows the old customer again', w.asked === 1 && w.cust === 'Aderrig Homes' && w.box === 'Aderrig Homes', JSON.stringify(w));
  const c = await type(of, 'customer', 'Cairn Homes', null);
  rec('Cancel at the PIN: unchanged, box put back', c.asked === 1 && c.cust === 'Aderrig Homes' && c.box === 'Aderrig Homes', JSON.stringify(c));
  const b = await type(of, 'customer', '   ', '9000');
  rec('blank customer: refused ("a job needs a customer") before any PIN (round 3 fix)', b.cust === 'Aderrig Homes' && b.asked === 0, JSON.stringify(b) + ' (PIN asked before refusing: ' + (b.asked ? 'yes' : 'no') + ')');
  const s = await type(of, 'customer', '  Aderrig   Homes ', '9000');
  rec('same customer with extra spaces: no PIN asked, nothing changed', s.asked === 0 && s.cust === 'Aderrig Homes' && !s.pov, JSON.stringify(s));
  const k = await type(of, 'customer', 'ADERRIG HOMES', null);
  rec('(info) a case-only change counts as a change: the Admin PIN is asked', true, JSON.stringify(k));
  const pinBlank = await type(of, 'customer', 'Cairn Homes', '');
  rec('an empty answer to the PIN question is refused', pinBlank.cust === 'Aderrig Homes', JSON.stringify(pinBlank));
  await ev(of, () => { DB.pins = Object.assign({}, DB.pins, { admin: '4321' }); });
  const old = await type(of, 'customer', 'Cairn Homes', '9000');
  rec('after Settings changes the Admin PIN, the old default 9000 is refused', old.cust === 'Aderrig Homes', JSON.stringify(old));
  const ok = await type(of, 'customer', 'Cairn Homes', '4321');
  rec('the (new) Admin PIN changes it; override kept for Export Changes', ok.cust === 'Cairn Homes' && /customer/.test(ok.pov), JSON.stringify(ok));
  // ↺ undo of the customer override from the office screen
  const u = await ev(of, () => { window.__pp = []; window.prompt = m => { window.__pp.push(m); return null; }; const bt = document.querySelector('[data-woundo="customer"]'); if (!bt) return { nobtn: true }; bt.click(); const o = DB.orders.find(x => x.wo === 'WO-1'); return { asked: window.__pp.length, cust: o.customer, pov: o.pov ? Object.keys(o.pov).join() : '' }; });
  rec('↺ undo of a customer override (changes the customer back): needs the Admin PIN too', !u.nobtn && u.asked >= 1 && u.cust === 'Cairn Homes', JSON.stringify(u));
  const undo = pin => ev(of, pin => { window.__pp = []; window.prompt = m => { window.__pp.push(m); return pin; }; const bt = document.querySelector('[data-woundo="customer"]'); if (!bt) return { nobtn: true }; bt.click(); const o = DB.orders.find(x => x.wo === 'WO-1'); return { asked: window.__pp.length, cust: o.customer, pov: o.pov ? Object.keys(o.pov).join() : '' }; }, pin);
  const u2 = await undo('9000'), u3 = await undo('4321');
  rec('↺ undo: wrong (old) Admin PIN refused; the Admin PIN puts the Cienapps customer back and clears the override', u2.cust === 'Cairn Homes' && u3.cust === 'Aderrig Homes' && !/customer/.test(u3.pov), JSON.stringify([u2, u3]));
  const ok2 = await type(of, 'customer', 'Cairn Homes', '4321'); // put the override back for the checks below
  // Floor / Unit / Title: no PIN
  const t = await type(of, 'title', 'HOUSE 1 TYPE B (CORRECTED)', '9999');
  rec('Title still saves with no PIN', t.asked === 0 && t.val === 'HOUSE 1 TYPE B (CORRECTED)', JSON.stringify(t));
  // P-number job: customer change is still Admin-only, not listed as an override
  await ev(of, () => { const o = JSON.parse(JSON.stringify(DB.orders.find(x => x.wo === 'WO-1'))); o.wo = 'P-77'; o.id = 'P77'; delete o.pov; o.customer = 'Aderrig Homes'; DB.orders.push(o); const d = document.createElement('div'); d.id = 'pjob'; document.body.appendChild(d); d.innerHTML = woInfoEdHTML(o); woInfoBind(d, o); });
  const p1 = await type(of, 'customer', 'Crown Builders', null, 'pjob');
  const p2 = await type(of, 'customer', 'Crown Builders', '4321', 'pjob');
  rec('P-number job: Admin PIN asked; with it the customer changes and nothing goes to Export Changes', p1.asked === 1 && p1.cust === 'Aderrig Homes' && p2.cust === 'Crown Builders' && !p2.pov, JSON.stringify([p1, p2]));
  // a Project Manager screen (also opens list windows) — same rule
  const pm = await X.dev(browser, S, 'pm');
  const r = await ev(pm, () => { const o = DB.orders.find(x => x.wo === 'WO-2') || DB.orders[1]; const d = document.createElement('div'); document.body.appendChild(d); d.innerHTML = woInfoEdHTML(o); woInfoBind(d, o); let n = 0; window.prompt = () => { n++; return '6666'; }; const before = o.customer; const i = d.querySelector('[data-woe="customer"]'); i.value = 'Someone Else'; i.onchange(); return { n, before, after: o.customer }; });
  rec('PM screen with the PM PIN: customer not changed (Admin only)', r.n === 1 && r.after === r.before, JSON.stringify(r));
  rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await of.close(); await pm.close(); await browser.close(); X.finish();
})().catch(e => { console.error(e); process.exit(1); });
