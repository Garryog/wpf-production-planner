// HTML injection: hostile text in every user-editable field, rendered on every tab, every role, and every print window.
// Run: node tests/injection.test.js
const H = require('./harness');
const res = [];
const rec = (name, ok, detail) => { res.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  -> ' + detail : '')); };
const P = tag => `O'Grady "x" <img src=x onerror="(window.__xss=window.__xss||[]).push('${tag}')"> 😀`;

(async () => {
  const browser = await H.chromium.launch();
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date('2026-10-19T10:00:00Z').getDay()];
  const fields = ['wo', 'title', 'customer', 'notes', 'floor', 'unit', 'step', 'salesRep', 'orderNo', 'ref', 'delivBy', 'missWhy', 'delDay'];
  const o1 = H.order({ wo: 'WO-1-1', delv: true, delVeh: 'VOLVO', delDay: 'Mon', delLoadedAt: '2026-10-19T08:00:00Z' });
  fields.filter(f => f !== 'wo' && f !== 'delDay').forEach(f => o1[f] = P('order.' + f));
  o1.log = [{ at: '2026-10-19T08:00:00Z', by: P('log.by'), what: P('log.what'), why: P('log.why') }];
  o1.delMoves = [{ at: '2026-10-19T08:00:00Z', by: P('move.by'), why: P('move.why') }];
  const o2 = H.order({ wo: P('order.wo'), title: 'plain', grp: 'g1', delv: true, delVeh: 'IVECO', delDay: 'Mon' });
  const o3 = H.order({ wo: 'WO-1-3', grp: 'g1' });
  const row = {
    id: 'main', nid: 4, orders: [o1, o2, o3], settings: {
      grps: { g1: { title: P('group.title') } },
      staff: [{ id: 's1', n: P('staff.name'), r: ['driver', 'saw', 'office', 'stores', 'admin', 'prod'] }],
      delNotes: { Mon: P('delNote'), 'VOLVO|Mon': P('delNote.veh') },
      lists: [{ id: 'L1', name: P('list.name'), wos: ['WO-1-1'], manual: true, project: P('list.project'), day: today, saw: true, fit: true, due: '2026-10-19', rows: [{ k: 'r1', note: P('list.row') }] }],
      listHold: { L1: { r1: { note: P('hold.note'), by: P('hold.by'), at: '2026-10-19T08:00:00Z', st: 'hold' } } },
      holdLog: [{ at: '2026-10-19T08:00:00Z', by: P('holdlog.by'), note: P('holdlog.note'), wo: 'WO-1-1' }]
    }
  };
  const t = await H.open({ browser, now: '2026-10-19T10:00:00Z', row });
  const out = await t.page.evaluate(async () => {
    const seen = {};
    const roles = { office: '2468', floor: '2222', driver: '1111', saw: '3333', stores: '4444', dash: '5555', pm: '6666', prod: '7777' };
    for (const tb of ['b', 'd', 'l', 'i', 'x', 's']) { try { showTab(tb); } catch (e) { seen['tab ' + tb] = 'ERR ' + e.message; } await new Promise(r => setTimeout(r, 120)); }
    // expand group, open driver with van picked
    for (const r of Object.keys(roles)) { localStorage.setItem('wpfPin_' + r, roles[r]); try { localStorage.setItem('wpfDrvVeh', 'VOLVO'); setRole(r); } catch (e) { seen['role ' + r] = 'ERR ' + e.message; } await new Promise(r => setTimeout(r, 150)); }
    setRole('office');
    // print outputs
    for (const fn of ['printRunSheets']) { try { window[fn](); } catch (e) { seen[fn] = 'ERR ' + e.message; } }
    try { printLabels(DB.lists, 'saw'); } catch (e) { seen.printLabels = 'ERR ' + e.message; }
    try { printLabels(DB.lists, 'fit'); } catch (e) { seen.printLabelsFit = 'ERR ' + e.message; }
    await new Promise(r => setTimeout(r, 200));
    return { xss: window.__xss || [], errs: seen, opened: window.__opened.map(h => h.length), printed: window.__opened.filter(h => /<img src=x/.test(h)).map(h => (h.match(/<title>([^<]*)/) || [])[1] || h.slice(0, 60)) };
  });
  rec('No injected script runs on any tab or role view', out.xss.length === 0, 'executed from: ' + [...new Set(out.xss)].join(', ') + (Object.keys(out.errs).length ? ' errors: ' + JSON.stringify(out.errs) : ''));
  rec('Print windows (run sheets, labels) escape names/notes', out.printed.length === 0, 'unescaped <img> found in print docs: ' + JSON.stringify(out.printed) + ' (print docs opened: ' + out.opened.length + ')');
  rec('No page errors with apostrophes / emoji / quotes in data', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close();

  // Import preview: hostile title/wo in an import file
  const t2 = await H.open({ browser, now: '2026-10-19T10:00:00Z' });
  await H.importAoa(t2.page, [['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total'], ['WO-9-1', P('import.title'), P('import.cust'), 46331, P('import.step'), 5000], ['WO-9-2<img src=x onerror="(window.__xss=window.__xss||[]).push(1)">', 'x', 'y', 46331, '1. x', 5]]);
  const x2 = await t2.page.evaluate(async () => { applyImport(IMPPLAN); showTab('b'); showTab('x'); await new Promise(r => setTimeout(r, 200)); return window.__xss || []; });
  rec('Hostile text inside an import file does not execute', x2.length === 0, 'executed: ' + x2.join(','));
  await t2.close();

  await browser.close();
  console.log('\n' + res.filter(x => !x.ok).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
