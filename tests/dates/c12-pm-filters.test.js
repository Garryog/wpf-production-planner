// Project Managers page: Project, Location (floor / block), Title filters + search (Garry, 12 Nov 2026).
// Stubbed Supabase only. Run: node tests/dates/c12-pm-filters.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ') : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '4. Ready', delv: false, customer: 'ASPECT', title: 'Kitchen Type 2R', floor: 'T09', unit: '1', value: 1000 }, x));
  const row = { id: 'main', nid: 9, settings: { delArchive: { '2026-11-02': { jobs: [
    { wo: 'WO-OLD1', t: 'Kitchen Type 2R', c: 'ASPECT', f: 'GF', u: '3', vAt: '2026-11-05T10:00:00Z', vBy: 'Pat' },
    { wo: 'WO-OLD2', t: 'Robe W2', c: 'BALLYMORE HOMES', f: 'B2', u: '7', vAt: '2026-11-05T10:00:00Z' }] } } }, orders: [
    O('WO-A1'), O('WO-A2', { unit: '2', title: 'Kitchen Type 1L' }), O('WO-A3', { floor: 'Ground', unit: '5', title: 'kitchen  type 2r' }),
    O('WO-A4', { floor: '0', unit: '6', title: 'Utility K2', delv: true, delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-16' }),
    O('WO-B1', { customer: 'BALLYMORE HOMES', floor: 'B2', unit: '7', title: 'Robe W2' }),
    O('WO-B2', { customer: 'BALLYMORE HOMES', floor: 'B2', unit: '14', title: 'Kitchen Type 2R' }),
    O('WO-X', { customer: 'O\'Brien & Sons "<b>"', floor: '<i>F</i>', unit: '9', title: '<img src=x onerror=window.__xss=1>' }),
  ] };
  for (const vp of [{ width: 1366, height: 900 }, { width: 360, height: 780 }]) {
    const t = await H.open({ browser, now: '2026-11-12T10:00:00Z', row, viewport: vp });
    const R = await t.page.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      const wos = () => [...document.querySelectorAll('.dsh-row b')].map(b => b.textContent).sort();
      const opts = id => [...document.querySelectorAll('#' + id + ' option')].map(o => o.value + '=' + o.textContent);
      const pick = async (id, v) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event('change')); await w(100); };
      localStorage.removeItem('wpfPmF'); localStorage.setItem('wpfPin_pm', '9000'); ROLE = 'pm'; render(); await w(150);
      out.all = wos(); out.kO = opts('pm-cust'); out.fO = opts('pm-floor'); out.tO = opts('pm-title');
      await pick('pm-cust', 'c:aspect'); out.k = wos(); out.fO2 = opts('pm-floor');
      await pick('pm-floor', 'GROUND'); out.kf = wos();
      await pick('pm-title', 'KITCHEN TYPE 2R'); out.kft = wos();
      out.saved = JSON.parse(localStorage.getItem('wpfPmF'));
      document.getElementById('pm-clear').click(); await w(100); out.cleared = wos().length; out.savedC = JSON.parse(localStorage.getItem('wpfPmF'));
      // search: type, keeps focus and text through the redraw, and through a data refresh in the middle of typing
      const q = document.getElementById('pm-q'); q.focus(); q.value = 'b2'; q.dispatchEvent(new Event('input')); await w(50);
      render(); await w(20); out.midVal = document.getElementById('pm-q').value; out.midFocus = document.activeElement && document.activeElement.id;
      await w(400); out.q = wos(); out.qFocus = document.activeElement && document.activeElement.id; out.qVal = document.getElementById('pm-q').value;
      const q2 = document.getElementById('pm-q'); q2.value = 'WO-A2'; q2.dispatchEvent(new Event('input')); await w(400); out.q2 = wos();
      q2.value = 'zzz'; q2.dispatchEvent(new Event('input')); await w(400); out.none = document.querySelector('.flr-none') ? document.querySelector('.flr-none').textContent : '';
      document.getElementById('pm-clear2').click(); await w(100); out.back = wos().length;
      out.xss = !!window.__xss; out.imgs = document.querySelectorAll('.dsh img,#pmf img').length;
      // remembered after leaving and coming back
      await pick('pm-floor', 'B2'); ROLE = 'office'; render(); await w(80); ROLE = 'pm'; render(); await w(100); out.keep = document.getElementById('pm-floor').value + ':' + wos().join(',');
      // a project linked to ASPECT: one 🏗 entry
      const rv = V2; window.V2 = () => true; LST.loaded = true; LST.p.set('P1', { id: 'P1', name: 'Aspect Athenry', customer: 'ASPECT', cien_names: ['ASPECT'], active: true });
      localStorage.removeItem('wpfPmF'); window.V2 = rv; // renderPM is the non-V2 page; projects still known
      const realOk = dcfProjOk; window.dcfProjOk = () => true; render(); await w(100);
      out.pO = opts('pm-cust'); await pick('pm-cust', 'p:P1'); out.p = wos(); window.dcfProjOk = realOk;
      // storage blocked
      localStorage.removeItem('wpfPmF'); const si = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('quota'); };
      render(); await w(50); await pick('pm-floor', 'T09'); out.blocked = wos(); Storage.prototype.setItem = si;
      out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      localStorage.removeItem('wpfPmF');
      return out;
    });
    const L = vp.width + 'px: ';
    rec(L + 'all jobs shown with no filter (live + archive)', R.all.length === 9, JSON.stringify(R.all));
    rec(L + 'project list: customers with counts', R.kO.includes('c:aspect=ASPECT (5)') && R.kO.includes('c:ballymore homes=BALLYMORE HOMES (3)'), JSON.stringify(R.kO));
    rec(L + 'location list: GF / 0 / Ground are ONE "Ground" entry', R.fO.filter(x => x.startsWith('GROUND=')).length === 1 && R.fO.includes('GROUND=Ground (GF / 0) (3)'), JSON.stringify(R.fO));
    rec(L + 'title list: case / spaces merged', R.tO.includes('KITCHEN TYPE 2R=Kitchen Type 2R (4)'), JSON.stringify(R.tO));
    rec(L + 'project ASPECT: only ASPECT jobs', JSON.stringify(R.k) === JSON.stringify(['WO-A1', 'WO-A2', 'WO-A3', 'WO-A4', 'WO-OLD1']), JSON.stringify(R.k));
    rec(L + 'location list narrows to the picked project (no B2)', !R.fO2.some(x => x.startsWith('B2=')), JSON.stringify(R.fO2));
    rec(L + 'project + Ground', JSON.stringify(R.kf) === JSON.stringify(['WO-A3', 'WO-A4', 'WO-OLD1']), JSON.stringify(R.kf));
    rec(L + 'project + Ground + title', JSON.stringify(R.kft) === JSON.stringify(['WO-A3', 'WO-OLD1']), JSON.stringify(R.kft));
    rec(L + 'remembered on this device', R.saved.k === 'c:aspect' && R.saved.fl === 'GROUND' && R.saved.ti === 'KITCHEN TYPE 2R', JSON.stringify(R.saved));
    rec(L + '✕ Clear filters', R.cleared === 9 && !R.savedC.k && !R.savedC.fl && !R.savedC.ti && !R.savedC.q, JSON.stringify(R.savedC));
    rec(L + 'search keeps the typed text and focus through a refresh mid-typing', R.midVal === 'b2' && R.midFocus === 'pm-q', R.midVal + ' ' + R.midFocus);
    rec(L + 'search "b2" finds floor B2 jobs (live + archive), focus kept', JSON.stringify(R.q) === JSON.stringify(['WO-B1', 'WO-B2', 'WO-OLD2']) && R.qFocus === 'pm-q' && R.qVal === 'b2', JSON.stringify(R.q) + ' ' + R.qFocus);
    rec(L + 'search by WO', JSON.stringify(R.q2) === '["WO-A2"]', JSON.stringify(R.q2));
    rec(L + 'nothing matches → says so, with Clear', /Nothing matches/.test(R.none) && R.back === 9, R.none);
    rec(L + 'names shown as text, never as HTML', !R.xss && R.imgs === 0);
    rec(L + 'remembered across leaving the page', R.keep === 'B2:WO-B1,WO-B2,WO-OLD2', R.keep);
    rec(L + 'linked project: one 🏗 entry, picks all its jobs', R.pO.some(x => x.startsWith('p:P1=🏗 Aspect Athenry (5)')) && JSON.stringify(R.p) === JSON.stringify(['WO-A1', 'WO-A2', 'WO-A3', 'WO-A4', 'WO-OLD1']), JSON.stringify(R.pO) + ' ' + JSON.stringify(R.p));
    rec(L + 'works when the browser won\'t store it', JSON.stringify(R.blocked) === JSON.stringify(['WO-A1', 'WO-A2', 'WO-B1', 'WO-B2']) || R.blocked.every(x => ['WO-A1', 'WO-A2'].includes(x)), JSON.stringify(R.blocked));
    rec(L + 'no sideways scroll', !R.overflow);
    rec(L + 'nothing saved to the database by filtering', !t.server.patches.some(b => JSON.stringify(b).includes('wpfPmF')));
    rec(L + 'no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + '/' + res.length + ' passed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
