// Deliveries page: Customer / project filter (Garry, 12 Nov 2026 — "the deliveries page need a filter by customer/project option also").
// Garry's choices: goes out with the Deliveries weeks release; other customers' jobs already on a van stay visible but GREYED.
// Stubbed Supabase only. Run: node tests/dates/c11-deliv-custfilter.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ') : '')); };
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
  const row = { id: 'main', nid: 9, settings: { delx: [{ wo: 'JOB-M1', title: 'Spare doors', customer: ' aspect ', value: 50, manual: true, delVeh: '', delDay: '', delDone: false }] }, orders: [
    O('WO-A1'), O('WO-A2', { customer: 'ASPECT  ' }), O('WO-A3', { customer: 'Aspect', dueDate: '2026-11-19', origDueDate: '2026-11-19', plannedWeek: '2026-11-16' }),
    O('WO-B1', { customer: 'BALLYMORE HOMES' }), O('WO-B2', { customer: 'BALLYMORE HOMES', delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09' }),
    O('WO-A4', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-11-09' }),
    O('WO-C1', { customer: '', title: 'No customer job' }),
    O('WO-X<b>', { customer: '<img src=x onerror=window.__xss=1>' }),
    O('WO-S1', { customer: 'BALLYMORE HOMES', step: '7. ASSEMBLY COMPLETE', delv: false, dueDate: '2026-11-09', origDueDate: '2026-11-09' }),
  ] };
  for (const vp of [{ width: 1366, height: 900 }, { width: 360, height: 780 }]) {
    const t = await H.open({ browser, now: '2026-11-10T10:00:00Z', row, viewport: vp });
    const p = t.page;
    const R = await p.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms)), out = {};
      const pool = () => [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw).sort();
      const grid = () => [...document.querySelectorAll('.dcell .dchip')].map(c => c.dataset.dw + (c.classList.contains('dcf-off') ? ':off' : ':on')).sort();
      const tabN = t => { const b = document.querySelector('[data-deltab="' + t + '"] .n'); return b ? b.textContent : ''; };
      const opts = () => [...document.querySelectorAll('#dcf-sel option')].map(o => o.value + '=' + o.textContent);
      const pick = async v => { const s = document.getElementById('dcf-sel'); s.value = v; s.dispatchEvent(new Event('change')); await w(120); };
      localStorage.removeItem('wpfDelCF');
      showTab('d'); await w(150);
      out.opts0 = opts(); out.pool0 = pool(); out.grid0 = grid(); out.tab0 = tabN('0'); out.tab1 = tabN('1');
      out.barOff = document.getElementById('dcf').className;
      // select one Ballymore job first, then pick ASPECT: the hidden pool job must drop out of the selection
      delSel.add('WO-B1'); delSel.add('WO-B2');
      await pick('c:aspect');
      out.poolA = pool(); out.gridA = grid(); out.tabA0 = tabN('0'); out.tabA1 = tabN('1'); out.sel = [...delSel].sort();
      out.barA = document.getElementById('dcf').textContent.replace(/\s+/g, ' ');
      out.barOn = document.getElementById('dcf').className;
      out.saved = localStorage.getItem('wpfDelCF');
      // remembered after a redraw / tab change
      showTab('b'); await w(80); showTab('d'); await w(120);
      out.keep = document.getElementById('dcf-sel').value;
      // the text filter still works on top
      const ds = document.getElementById('dsrch'); ds.value = 'A2'; ds.dispatchEvent(new Event('input')); await w(50);
      out.txt = [...document.querySelectorAll('#dpool .dchip')].filter(c => c.style.display !== 'none').map(c => c.dataset.dw);
      ds.value = ''; ds.dispatchEvent(new Event('input')); delFilter = '';
      // In store: Ballymore only
      await pick('c:ballymore homes');
      delStoreOpen = true; render(); await w(80);
      out.store = (document.getElementById('del-store') || {}).textContent || '';
      delStoreOpen = false;
      // no customer
      await pick('c:'); out.poolC = pool();
      // escaping
      out.xss = !!window.__xss; out.imgTags = document.querySelectorAll('#dcf img').length;
      // Show all
      await pick('c:aspect'); document.getElementById('dcf-all').click(); await w(120);
      out.afterAll = { v: document.getElementById('dcf-sel').value, pool: pool().length, saved: localStorage.getItem('wpfDelCF') };
      // a customer that has left the page: kept with (0), not silently dropped
      localStorage.setItem('wpfDelCF', JSON.stringify({ k: 'c:gone ltd', lbl: 'GONE LTD' })); render(); await w(80);
      out.gone = { v: document.getElementById('dcf-sel').value, opt: opts().find(x => x.startsWith('c:gone ltd')), pool: pool().length };
      // damaged stored value → All
      localStorage.setItem('wpfDelCF', '{bad'); render(); await w(80);
      out.bad = document.getElementById('dcf-sel').value;
      // projects: ASPECT linked to a planner project → one "🏗" entry, picking it filters on the project
      const realV2 = V2; window.V2 = () => true; LST.loaded = true;
      LST.p.set('P1', { id: 'P1', name: 'Aspect Athenry', customer: 'ASPECT', cien_names: ['ASPECT'], active: true });
      localStorage.removeItem('wpfDelCF'); render(); await w(80);
      out.popts = opts();
      await pick('p:P1'); out.ppool = pool(); out.pgrid = grid();
      window.V2 = realV2;
      // page width check (phone)
      out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      out.barW = document.getElementById('dcf').getBoundingClientRect().right <= window.innerWidth + 1;
      localStorage.removeItem('wpfDelCF');
      return out;
    });
    const L = vp.width + 'px: ';
    rec(L + 'picker lists every customer once (case / spaces merged) with counts, plus All', R.opts0.includes('c:aspect=ASPECT (5)') && R.opts0.some(x => x.startsWith('c:ballymore homes=BALLYMORE HOMES (3)')) && R.opts0[0].startsWith('=All customers'), JSON.stringify(R.opts0));
    rec(L + 'no filter: bar is plain, pool shows everyone', R.barOff === 'dcf' && R.pool0.length === 6, JSON.stringify(R.pool0));
    rec(L + 'ASPECT picked: pool = ASPECT jobs due this week (incl. manual " aspect ")', JSON.stringify(R.poolA) === JSON.stringify(['JOB-M1', 'WO-A1', 'WO-A2']), JSON.stringify(R.poolA));
    rec(L + 'ASPECT picked: van grid keeps Ballymore greyed, ASPECT normal', JSON.stringify(R.gridA) === JSON.stringify(['WO-A4:on', 'WO-B2:off']), JSON.stringify(R.gridA));
    rec(L + 'week-tab counts follow the filter (This week 4 = 3 pool + 1 van; Next week 1)', /\(4\)/.test(R.tabA0) && /\(1\)/.test(R.tabA1), R.tab0 + ' ' + R.tab1 + ' → ' + R.tabA0 + ' ' + R.tabA1);
    rec(L + 'a ticked pool job that gets hidden is un-ticked; a ticked van job (still on screen, greyed) stays', JSON.stringify(R.sel) === JSON.stringify(['WO-B2']), JSON.stringify(R.sel));
    rec(L + 'bar says what is shown and that prints are the whole week', R.barOn.includes('dcf-on') && /Showing ASPECT only/.test(R.barA) && /whole week/.test(R.barA), R.barA);
    rec(L + 'remembered on this device across a tab change', R.keep === 'c:aspect' && /c:aspect/.test(R.saved || ''), R.keep);
    rec(L + 'text search still works on top of the filter', JSON.stringify(R.txt) === '["WO-A2"]', JSON.stringify(R.txt));
    rec(L + 'In store follows the filter', /WO-S1/.test(R.store) && !/WO-A/.test(R.store), R.store.slice(0, 160));
    rec(L + 'jobs with no customer have their own entry', JSON.stringify(R.poolC) === '["WO-C1"]', JSON.stringify(R.poolC));
    rec(L + 'a nasty customer name is shown as text', !R.xss && R.imgTags === 0);
    rec(L + '✕ Show all clears it', R.afterAll.v === '' && R.afterAll.pool === 6 && !R.afterAll.saved, JSON.stringify(R.afterAll));
    rec(L + 'a remembered customer with no jobs left stays picked with (0) — never switched off silently', R.gone.v === 'c:gone ltd' && R.gone.opt === 'c:gone ltd=GONE LTD (0)' && R.gone.pool === 0, JSON.stringify(R.gone));
    rec(L + 'a damaged remembered value falls back to All', R.bad === '', R.bad);
    rec(L + 'linked project: one 🏗 entry for its customers', R.popts.some(x => x.startsWith('p:P1=🏗 Aspect Athenry (5)')) && !R.popts.some(x => x.startsWith('c:aspect')), JSON.stringify(R.popts));
    rec(L + 'project picked: pool and grid follow the project', JSON.stringify(R.ppool) === JSON.stringify(['JOB-M1', 'WO-A1', 'WO-A2']) && JSON.stringify(R.pgrid) === JSON.stringify(['WO-A4:on', 'WO-B2:off']), JSON.stringify(R.ppool) + ' ' + JSON.stringify(R.pgrid));
    rec(L + 'no sideways scroll; bar fits the screen', !R.overflow && R.barW);
    rec(L + 'nothing saved to the database by filtering', !t.server.patches.some(b => JSON.stringify(b).includes('wpfDelCF')));
    rec(L + 'no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
    await t.close();
  }
  await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + '/' + res.length + ' passed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
