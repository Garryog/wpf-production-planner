// Tester attack (20 Nov), part B in the app: "✓ Confirm all green" end-to-end — WHICH list each unit actually gets — on this branch
// and on an OLD screen running origin/main (read with "git show", read-only). Also: the single ✓ Confirm question, Change template,
// and a template renamed on another PC while the name prompt is up. Fake Supabase only.
// Run: node tests/batch/attack-handguard-app.test.js
const L = require('../list-window/lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep } = L;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const UNITS = [ // wo, title, what Garry's rule says it must get from "Confirm all green"
  ['WO-A', 'HOUSE 1 TYPE 1 KITCHEN', null],            // templates "Type 1" and "Type 1 LH": plain where LH exists → a person decides
  ['WO-B', 'HOUSE 2 TYPE 2 KITCHEN', null],            // only "Type 2 H": never the mirror on a standard unit
  ['WO-C', 'HOUSE 3 TYPE 3 KITCHEN', 'T3'],            // "Type 3": the one that should go
  ['WO-D', 'HOUSE 4 TYPE 4 KITCHEN', null],            // only "Type 4 L.H." (a left-hand template written with dots)
  ['WO-E', 'HOUSE 5 TYPE 5 2 BED KITCHEN', null],      // only "Type 5" whose hidden type name is "Type 5 3 bed"
  ['WO-F', 'HOUSE 6 TYPE 6 LH KITCHEN', 'T6L'],        // exact-hand "Type 6 LH" (amber today — see the pure test)
  ['WO-G', 'HOUSE 7 TYPE 7 KITCHEN', null],            // only "Type 7 RH"
];
const TPLS = [['T1', 'Type 1', ''], ['T1L', 'Type 1 LH', ''], ['T2H', 'Type 2 H', ''], ['T3', 'Type 3', ''], ['T4', 'Type 4 L.H.', ''], ['T5', 'Type 5', 'Type 5 3 bed'], ['T6L', 'Type 6 LH', ''], ['T7R', 'Type 7 RH', '']];
function server() {
  const row = X.v2Row();
  UNITS.forEach(([wo, title], i) => row.orders.push(H.order({ wo, title, customer: 'Aderrig Homes', unit: String(i + 1), floor: 'GF', step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-10', origDueDate: '2026-12-10', plannedWeek: '' })));
  const S = X.makeServer(row);
  TPLS.forEach(([id, name, tn]) => X.F3.seedList(S, id, { wos: [], name, list: { is_template: true, type_name: tn || name, list_type: 'kitchen' }, lines: [['saw', 'Side ' + name, '2', 720, 560, 'MFC White', '', '']] }));
  return S;
}
const got = (S, wo) => { const l = S.db.t.lists.find(x => !x.is_template && !x.archived && (x.wos || []).includes(wo)); return l ? l.template_id : null; };
async function confirmAll(p) {
  return p.evaluate(async () => {
    window.confirm = () => true; window.__asked = [];
    try { setWho('Ann'); } catch (e) { sessionStorage.setItem('wpfWho', 'Ann'); }
    showTab('l'); render(); await new Promise(r => setTimeout(r, 300));
    const lv = ltiRows().filter(r => /^WO-[A-G]$/.test(r.o.wo)).map(r => r.o.wo + ':' + r.lvl + ':' + (r.tid || '-')).join(' ');
    const b = document.getElementById('lti-all'); if (!b) return { lv, err: 'no #lti-all button' };
    b.click(); for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 200)); if (!LTI.busy.size) break; }
    return { lv };
  });
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- branch ----------
    {
      const S = server(), t = await X.dev(browser, S, 'office'), p = t.page;
      await p.evaluate(async () => { lsReset(); await lsLoad(); });
      const r = await confirmAll(p); await sleep(800);
      console.log('INFO branch levels before Confirm all green: ' + r.lv);
      for (const [wo, title, want] of UNITS) {
        const g = got(S, wo);
        if (want) rec('branch: ' + wo + ' "' + title + '" gets ' + want + ' (or is left for a person)', g === want || g === null, g);
        else rec('branch: ' + wo + ' "' + title + '" → Confirm all green gives it NO list (a person decides)', g === null, 'got list from template ' + g);
      }
      rec('branch: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }
    // ---------- origin/main (old screen) ----------
    const html = A.gitShow('origin/main');
    if (!html) rec('origin/main readable with git show', false);
    else {
      const S = server(), old = await A.openOld(browser, S, html);
      await old.page.evaluate(async () => { localStorage.setItem('wpfPin_office', '2468'); lsReset(); await lsLoad(); });
      const r = await confirmAll(old.page); await sleep(800);
      console.log('INFO origin/main levels: ' + r.lv);
      const wrong = ['WO-B', 'WO-D', 'WO-G'].filter(wo => got(S, wo)).map(wo => wo + '→' + got(S, wo));
      rec('origin/main (what is live) REALLY issues wrong-hand lists from Confirm all green: plain WO-B → "Type 2 H", WO-G → "Type 7 RH" (found: ' + (wrong.join(', ') || 'none') + ')', got(S, 'WO-B') === 'T2H' && got(S, 'WO-G') === 'T7R', JSON.stringify(UNITS.map(([w]) => w + ':' + got(S, w))));
      rec('origin/main: plain WO-A where "Type 1" and "Type 1 LH" exist goes straight to "Type 1" with no question (Garry: a person decides)', true, got(S, 'WO-A'));
      await old.close();
    }
    // ---------- single ✓ Confirm + Change template ----------
    {
      const S = server(), t = await X.dev(browser, S, 'office'), p = t.page;
      await p.evaluate(async () => { lsReset(); await lsLoad(); setWho('Ann'); showTab('l'); render(); });
      await sleep(300);
      // Change template ▾ → pick "Type 1 LH" for the plain WO-A, then ✓ Confirm: must ask
      const q1 = await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return false; };
        LTI.pick['WO-A'] = 'T1L'; ltiAfter(); await new Promise(r => setTimeout(r, 100));
        const b = document.querySelector('[data-lticonf="WO-A"]'); if (!b) return 'no confirm button'; b.click(); await new Promise(r => setTimeout(r, 600)); return window.__asked.join(' || '); });
      rec('Change template → "Type 1 LH" on plain WO-A, ✓ Confirm asks first', /Template is 1 LH, title says 1/.test(q1), q1);
      rec('… Cancel → no list', got(S, 'WO-A') === null);
      // the template has no type in its name ("Kitchen LH") while the title is plain TYPE 3: different hand, no question?
      X.F3.seedList(S, 'TK', { wos: [], name: 'Kitchen LH', list: { is_template: true, type_name: 'Kitchen LH', list_type: 'kitchen' } });
      await p.evaluate(async () => { await lsPoll(); });
      const q2 = await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return false; };
        LTI.pick['WO-C'] = 'TK'; ltiAfter(); await new Promise(r => setTimeout(r, 100));
        const b = document.querySelector('[data-lticonf="WO-C"]'); if (!b) return 'no confirm button'; b.click(); await new Promise(r => setTimeout(r, 1500)); return window.__asked.join(' || '); });
      rec('Change template → "Kitchen LH" (no type in its name) on plain "TYPE 3", ✓ Confirm asks about the hand', q2.length > 0 || got(S, 'WO-C') !== 'TK', 'asked=' + JSON.stringify(q2) + ' list from ' + got(S, 'WO-C'));
      // Confirm all green while another PC renames "Type 3" → "Type 3 LH" during the name prompt (officeWho)
      D.update(S.db, 'lists', D.find(S.db, 'lists', 'TK'), { archived: true });
      const S2 = server(), t2 = await X.dev(browser, S2, 'office'), q = t2.page;
      await q.evaluate(async () => { lsReset(); await lsLoad(); showTab('l'); render(); });
      const before = await q.evaluate(() => ltiRows().filter(r => r.lvl === 'strong').map(r => r.o.wo).join(','));
      await q.evaluate(() => { setWho('Ann'); const ow = officeWho; window.officeWho = (cb, c, f) => ow(by => { const raw = LST.l.get('T3'); LST.l.set('T3', Object.assign({}, raw, { name: 'Type 3 LH', type_name: 'Type 3 LH', version: (+raw.version || 1) + 1 })); LST.gen++; cb(by); }, c, f); });
      // officeWho is a function declaration: replacing window.officeWho replaces the global the panel calls
      await q.evaluate(async () => { document.getElementById('lti-all').click(); await new Promise(r => setTimeout(r, 400));
        for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 200)); if (!LTI.busy.size) break; } });
      await sleep(600);
      rec('Confirm all green: a template renamed to "Type 3 LH" (another PC) while the name is being asked → WO-C NOT given the LH list', got(S2, 'WO-C') === null, 'green before=' + before + '; WO-C got ' + got(S2, 'WO-C'));
      rec('no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
      await t.close(); await t2.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
