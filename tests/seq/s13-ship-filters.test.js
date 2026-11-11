// S2 (Job B part 3, Garry 10 Nov): Shipped tab Project filter and PM filter (PM from the project's PM assignment), on both
// lists (shipped + on hold), remembered on the device, the PM filter starting on this device's PM, phone-first (360 px),
// names escaped. Hidden with the lists switched off or the PM sequence tables not installed (then every job shows, as today).
// The PM view gets its own 📦 Shipped tab (no "Bring back to board" there). Fake Supabase only.
// Run: node tests/seq/s13-ship-filters.test.js
const X = require('./fixs.js');
const { H, D, rec, sleep } = X;
function rowWith() {
  const row = X.v2Row();
  const sh = '2026-10-19T10:00:00Z';
  row.orders.find(o => o.wo === 'WO-6').shippedAt = sh; // Lucan (P2)
  row.orders.find(o => o.wo === 'WO-3').shippedAt = sh; // Aderrig (P1)
  row.orders.push(H.order({ wo: 'WO-20', customer: 'Nobody Ltd', title: 'NO PROJECT JOB', shippedAt: sh }),
    H.order({ wo: 'WO-21', customer: 'Bad Homes', title: 'ESCAPE JOB', shippedAt: sh }),
    H.order({ wo: 'WO-22', customer: 'Lucan Homes', title: 'LUCAN ON HOLD', cienHold: true, holdAt: sh }),
    H.order({ wo: 'WO-23', customer: 'Aderrig Homes', title: 'ADERRIG ON HOLD', cienHold: true, holdAt: sh }));
  return row;
}
function server(opt) {
  const S = X.makeServer(rowWith(), opt);
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
  D.update(S.db, 'projects', D.find(S.db, 'projects', 'P2'), { pms: ['Mary Kelly'] });
  D.insert(S.db, 'projects', { id: 'P3', name: 'Proj <b>X</b>', customer: 'Bad Homes', cien_names: ['Bad Homes'], pms: ['<i>Eve</i>'] });
  return S;
}
const shown = p => p.evaluate(() => [...document.querySelectorAll('.sh-card .wo-num')].map(e => e.textContent).sort());
const setSel = (p, id, v) => p.evaluate(({ id, v }) => { const s = document.getElementById(id); if (!s) return 'no ' + id; s.value = v; s.onchange(); return 'ok'; }, { id, v });
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- office, sequence tables installed
    const S = server();
    let t = await X.dev(browser, S, 'office'), p = t.page;
    await p.evaluate(() => { localStorage.removeItem('wpfShProj'); localStorage.removeItem('wpfShPM'); showTab('h'); }); await sleep(300);
    const f0 = await p.evaluate(() => ({ pj: !!document.getElementById('sh-proj'), pm: !!document.getElementById('sh-pm'),
      po: [...(document.getElementById('sh-proj') || { options: [] }).options].map(o => o.value + '=' + o.textContent),
      mo: [...(document.getElementById('sh-pm') || { options: [] }).options].map(o => o.value + '=' + o.textContent) }));
    rec('office Shipped tab: Project and PM filters, both on "all" to start (office has no PM of its own)', f0.pj && f0.pm && f0.po[0] === '*=Project: all' && f0.mo[0] === '*=PM: all', JSON.stringify(f0));
    rec('Project list = the projects of the shipped / on-hold jobs + "No project linked"', f0.po.join('|') === '*=Project: all|P1=Aderrig|P2=Lucan|P3=Proj <b>X</b>|-=No project linked', JSON.stringify(f0.po));
    rec('PM list = Settings → Staff PMs + names on projects + "none assigned"', ['John Burke', 'Mary Kelly', '<i>Eve</i>'].every(n => f0.mo.includes(n + '=PM: ' + n)) && f0.mo[f0.mo.length - 1] === '-=PM: none assigned', JSON.stringify(f0.mo));
    const esc = await p.evaluate(() => ({ b: !!document.querySelector('#sh-proj b'), i: !!document.querySelector('#sh-pm i') }));
    rec('project / PM names with HTML are shown as text (escaped)', !esc.b && !esc.i, JSON.stringify(esc));
    let s = await shown(p);
    rec('all: every shipped job and every on-hold job', ['WO-20', 'WO-21', 'WO-22', 'WO-23', 'WO-3', 'WO-5', 'WO-6'].every(w => s.includes(w)), JSON.stringify(s));
    await setSel(p, 'sh-proj', 'P1'); await sleep(200); s = await shown(p);
    rec('Project = Aderrig: WO-3 + WO-5 shipped, WO-23 on hold — nothing else', s.join() === ['WO-23', 'WO-3', 'WO-5'].sort().join(), JSON.stringify(s));
    const cnt = await p.evaluate(() => document.getElementById('sh-hcnt').textContent);
    rec('on-hold count says "1 of 2" when filtered', /1 of 2/.test(cnt), cnt);
    await setSel(p, 'sh-proj', '-'); await sleep(200); s = await shown(p);
    rec('Project = No project linked: WO-20 only', s.join() === 'WO-20', JSON.stringify(s));
    await setSel(p, 'sh-proj', '*'); await setSel(p, 'sh-pm', 'Mary Kelly'); await sleep(200); s = await shown(p);
    rec('PM = Mary Kelly (Lucan\'s PM): WO-6 shipped + WO-22 on hold', s.join() === ['WO-22', 'WO-6'].sort().join(), JSON.stringify(s));
    await setSel(p, 'sh-pm', '-'); await sleep(200); s = await shown(p);
    rec('PM = none assigned: the job with no project (WO-20)', s.join() === 'WO-20', JSON.stringify(s));
    await setSel(p, 'sh-pm', 'John Burke'); await setSel(p, 'sh-proj', 'P2'); await sleep(200); s = await shown(p);
    const emp = await p.evaluate(() => document.body.innerText);
    rec('Project Lucan + PM John Burke: nothing, with "No shipped jobs match."', !s.length && /No shipped jobs match\./.test(emp), JSON.stringify(s));
    // search still works with the filters
    await setSel(p, 'sh-proj', 'P1'); await p.evaluate(() => { const q = document.getElementById('sh-q'); q.value = 'type d'; q.oninput.call(q); }); await sleep(200); s = await shown(p);
    rec('search inside the filter (Aderrig + John Burke + "type d"): WO-5 (shipped list) + WO-23 stays in on-hold (its own search)', s.includes('WO-5') && !s.includes('WO-3'), JSON.stringify(s));
    await p.evaluate(() => { const q = document.getElementById('sh-q'); q.value = ''; q.oninput.call(q); });
    // remembered on the device
    await p.reload(); await p.waitForFunction(() => typeof renderShipped === 'function'); await sleep(800);
    await p.evaluate(async () => { localStorage.setItem('wpfOpName', 'Op'); sessionStorage.setItem('wpfWho', 'Op'); lsReset(); await lsLoad(); showTab('h'); }); await sleep(400);
    const rem = await p.evaluate(() => ({ pj: (document.getElementById('sh-proj') || {}).value, pm: (document.getElementById('sh-pm') || {}).value }));
    rec('after a reload the filters are remembered on this device (Aderrig + John Burke)', rem.pj === 'P1' && rem.pm === 'John Burke', JSON.stringify(rem));
    // phone
    await p.setViewportSize({ width: 360, height: 740 }); await sleep(300);
    const ph = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, pj: r('sh-proj').width, pjh: r('sh-proj').height, pm: r('sh-pm').width, fs: getComputedStyle(document.getElementById('sh-pm')).fontSize }; });
    rec('360 px: filters full width, ≥ 40 px tall, 16 px text, no sideways scroll', ph.sw <= ph.cw + 1 && ph.pj > 300 && ph.pm > 300 && ph.pjh >= 40 && ph.fs === '16px', JSON.stringify(ph));
    await t.close();
    // ---------- PM view: own Shipped tab, filter starts on this device's PM, no Bring back
    t = await X.dev(browser, S, 'pm', { me: { pm: 'Mary Kelly' } }); p = t.page;
    await p.evaluate(() => { localStorage.removeItem('wpfShProj'); localStorage.removeItem('wpfShPM'); }); await sleep(100);
    const tab = await p.evaluate(() => { const b = document.querySelector('[data-pmtab="ship"]'); if (!b) return false; b.click(); return true; }); await sleep(400);
    s = await shown(p);
    const pmv = await p.evaluate(() => ({ pm: (document.getElementById('sh-pm') || {}).value, back: document.querySelectorAll('[data-shb]').length, done: document.querySelectorAll('[data-shc]').length }));
    rec('PM view: a 📦 Shipped tab; the PM filter starts on this device\'s PM (Mary Kelly) → her jobs only', tab && pmv.pm === 'Mary Kelly' && s.join() === ['WO-22', 'WO-6'].sort().join(), JSON.stringify({ tab, pmv, s }));
    rec('PM view: no "Bring back to board" (office only); "Installation complete" still there', pmv.back === 0 && pmv.done >= 1, JSON.stringify(pmv));
    await setSel(p, 'sh-pm', '*'); await sleep(200); s = await shown(p);
    rec('PM can switch to "PM: all" and it is remembered', s.length >= 7 && (await p.evaluate(() => localStorage.getItem('wpfShPM'))) === '*', JSON.stringify(s));
    await p.setViewportSize({ width: 360, height: 740 }); await sleep(300);
    const ns = await X.noScroll(p);
    rec('PM Shipped tab at 360 px: no sideways scroll', ns.sw <= ns.cw + 1, JSON.stringify(ns));
    rec('no page errors (sequence installed)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
    // ---------- sequence tables NOT installed: no filters, no PM Shipped tab, everything listed
    const S2 = server({ noSeq: true });
    t = await X.dev(browser, S2, 'office'); p = t.page;
    await p.evaluate(() => { localStorage.setItem('wpfShProj', 'P1'); localStorage.setItem('wpfShPM', 'John Burke'); showTab('h'); }); await sleep(300);
    s = await shown(p);
    const hid = await p.evaluate(() => !document.getElementById('sh-proj') && !document.getElementById('sh-pm'));
    rec('sequence tables not installed: no filters, and a remembered filter is NOT applied (every job shows)', hid && s.length >= 7, JSON.stringify(s));
    await t.close();
    t = await X.dev(browser, S2, 'pm', { me: { pm: 'Mary Kelly' } }); p = t.page;
    rec('sequence tables not installed: no 📦 Shipped tab on the PM view', !(await p.evaluate(() => !!document.querySelector('[data-pmtab="ship"]'))));
    await t.close();
    // ---------- lists switched off (V1): today's Shipped tab, no filters
    const S3 = X.makeServer(Object.assign(rowWith(), {}));
    const r1 = X.v1Row(); S3.row.settings = r1.settings; S3.db.listStore = 'v1';
    t = await X.dev(browser, S3, 'office'); p = t.page;
    await p.evaluate(() => { localStorage.setItem('wpfShProj', 'P1'); showTab('h'); }); await sleep(300);
    s = await shown(p);
    rec('lists switched off: no filters, every shipped job shows', !(await p.evaluate(() => !!document.getElementById('sh-proj'))) && s.length >= 7, JSON.stringify(s));
    rec('no page errors (off / not installed)', !(S2.errors || []).length && !(S3.errors || []).length, (S2.errors || []).concat(S3.errors || []).join(' | '));
    await t.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
