// Tester round 2 (21 Nov): "✓ Confirm all green" with the new re-read of each template just before its list is made, in the app on
// the fake Supabase. Another PC (straight into the fake database, after this screen loaded) renames / archives / re-hands / edits
// templates; one template's re-read fails once; one template is shared by 10 rows; the ↻ Retry paths afterwards.
// Run: node tests/batch/attack2-confirm-app.test.js
const L = require('../list-window/lw.js');
const { X, H, D, sleep } = L;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const live = (S, wo) => S.db.t.lists.filter(x => !x.is_template && !x.archived && (x.wos || []).includes(wo));
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = X.v2Row();
    const U = [];
    for (let i = 1; i <= 10; i++) U.push(['WO-C' + i, 'HOUSE ' + (20 + i) + ' TYPE 3 KITCHEN']);
    U.push(['WO-D', 'HOUSE 4 TYPE 4 KITCHEN'], ['WO-E', 'HOUSE 5 TYPE 5 KITCHEN'], ['WO-F', 'HOUSE 6 TYPE 6 KITCHEN'], ['WO-G', 'HOUSE 7 TYPE 7 KITCHEN'], ['WO-H', 'HOUSE 8 TYPE 8 KITCHEN']);
    U.forEach(([wo, title], i) => row.orders.push(H.order({ wo, title, customer: 'Aderrig Homes', unit: String(i + 1), floor: 'GF', step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: '2026-12-10', origDueDate: '2026-12-10', plannedWeek: '' })));
    const S = X.makeServer(row);
    for (const [id, name] of [['T3', 'Type 3'], ['T4', 'Type 4'], ['T5', 'Type 5'], ['T6', 'Type 6'], ['T7', 'Type 7'], ['T8', 'Type 8']])
      X.F3.seedList(S, id, { wos: [], name, list: { is_template: true, type_name: name, list_type: 'kitchen' }, lines: [['saw', 'Side ' + name, '2', 720, 560, 'MFC White', '', '']] });
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await p.evaluate(async () => { lsReset(); await lsLoad(); setWho('Ann'); showTab('l'); render(); });
    const g0 = await p.evaluate(() => ltiRows().filter(r => r.lvl === 'strong').map(r => r.o.wo).sort().join(','));
    rec('set-up: all 15 rows green on this screen', g0.split(',').length === 15, g0);
    // another PC, after this screen loaded: T4 re-handed, T5 archived, T6 rows edited, T8 deleted from the table
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'T4'), { name: 'Type 4 LH', type_name: 'Type 4 LH' });
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'T5'), { archived: true });
    D.update(S.db, 'list_lines', S.db.t.list_lines.find(x => x.list_id === 'T6'), { part: 'Side EDITED' });
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'T6'), { rev: 2 });
    S.db.t.lists = S.db.t.lists.filter(x => x.id !== 'T8');
    // the re-read of T7 fails once
    let failT7 = 1, reads = {};
    await p.route(u => /\/lists\?select=\*&id=eq\./.test(String(u)), route => { const id = /id=eq\.([^&]+)/.exec(route.request().url())[1]; reads[id] = (reads[id] || 0) + 1;
      if (id === 'T7' && failT7-- > 0) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"down"}' }); return route.fallback(); });
    await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return true; }; document.getElementById('lti-all').click();
      for (let i = 0; i < 100; i++) { await new Promise(r => setTimeout(r, 200)); if (!LTI.busy.size) break; } });
    await sleep(500);
    const c = U.slice(0, 10).map(([w]) => live(S, w).length);
    rec('10 rows sharing "Type 3": one list each, none doubled', c.every(x => x === 1), c.join(','));
    console.log('INFO re-reads of each template during the run: ' + JSON.stringify(reads) + ' (T3 shared by 10 rows)');
    rec('T4 re-handed to "Type 4 LH" on another PC → WO-D (plain) skipped, no list', !live(S, 'WO-D').length, JSON.stringify(live(S, 'WO-D').map(x => x.template_id)));
    rec('T5 archived on another PC → WO-E no list', !live(S, 'WO-E').length, JSON.stringify(live(S, 'WO-E').map(x => x.template_id)));
    const f = live(S, 'WO-F')[0], fl = f ? S.db.t.list_lines.filter(x => x.list_id === f.id).map(x => x.part) : [];
    rec('T6 rows edited on another PC → WO-F gets a list with the EDITED rows (rev 2)', f && fl.includes('Side EDITED') && +f.template_rev === 2, JSON.stringify([f && f.template_rev, fl]));
    const hh = live(S, 'WO-H');
    rec('T8 deleted from the database (another PC) → WO-H is not given a list from a template that no longer exists', !hh.length, JSON.stringify(hh.map(x => x.template_id)));
    const msg = await p.evaluate(() => ({ g: (LTI.res['WO-G'] || {}).err || '', d: (LTI.res['WO-D'] || {}).err || '', e: (LTI.res['WO-E'] || {}).err || '', h: (LTI.res['WO-H'] || {}).err || '', retryG: !!document.querySelector('[data-ltiretry="WO-G"]'), toast: (document.getElementById('toast') || {}).textContent || '' }));
    rec('T7 re-read failed → WO-G "Not saved" with ↻ Retry, no list', !live(S, 'WO-G').length && msg.retryG && msg.g, JSON.stringify(msg));
    rec('the skipped rows say why ("no longer green")', /no longer green/.test(msg.d) && /no longer green/.test(msg.e), JSON.stringify(msg));
    rec('the toast counts the skipped rows', /skipped/.test(msg.toast), msg.toast);
    rec('no hand question asked during Confirm all green', !(await p.evaluate(() => window.__asked.length)), await p.evaluate(() => window.__asked.join(' | ')));
    // ↻ Retry on WO-G after T7 was re-handed meanwhile on another PC (this screen polls first)
    D.update(S.db, 'lists', D.find(S.db, 'lists', 'T7'), { name: 'Type 7 RH', type_name: 'Type 7 RH' });
    await p.evaluate(async () => { await lsPoll(); ltiAfter(); });
    const r1 = await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return false; };
      const b = document.querySelector('[data-ltiretry="WO-G"]'); if (!b) return 'no retry button'; b.click(); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 200)); if (!LTI.busy.size) break; } return window.__asked.join(' | '); });
    await sleep(400);
    rec('↻ Retry on WO-G after "Type 7" became "Type 7 RH" (now amber): asks about the hand or makes nothing — never a silent RH list on a plain unit', !live(S, 'WO-G').length || /use it anyway/.test(r1), 'asked=' + JSON.stringify(r1) + ' lists=' + JSON.stringify(live(S, 'WO-G').map(x => x.template_id)));
    // ↻ Retry on the skipped WO-D: asks about the hand (Cancel → nothing)
    const r2 = await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return false; };
      const b = document.querySelector('[data-ltiretry="WO-D"]'); if (!b) return 'no retry button'; b.click(); await new Promise(r => setTimeout(r, 1200)); return window.__asked.join(' | '); });
    rec('↻ Retry on skipped WO-D asks "Template is 4 LH, title says 4 …"; Cancel → no list', /Template is 4 LH/.test(r2) && !live(S, 'WO-D').length, r2);
    // single ✓ Confirm when one side has no type code
    X.F3.seedList(S, 'TK', { wos: [], name: 'Kitchen LH', list: { is_template: true, type_name: 'Kitchen LH', list_type: 'kitchen' } });
    await p.evaluate(async () => { await lsPoll(); });
    const r3 = await p.evaluate(async () => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return false; };
      LTI.pick['WO-E'] = 'TK'; ltiAfter(); const b = document.querySelector('[data-lticonf="WO-E"]'); if (!b) return 'no button'; b.click(); await new Promise(r => setTimeout(r, 800)); return window.__asked.join(' | '); });
    rec('single ✓ Confirm: "Kitchen LH" (no type code) on plain "TYPE 5" asks first', /use it anyway/.test(r3) && !live(S, 'WO-E').length, r3);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
