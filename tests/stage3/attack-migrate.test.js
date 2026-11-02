// ATTACK: "Migrate lists" on realistic messy data, run twice, rolled-over holdLog, HTML/emoji names, a 2,500-line list,
// Supabase's 1,000-row API cap, switch back (acceptance 11) and migrate again. Fake Supabase only.
// Run: node tests/stage3/attack-migrate.test.js
const A = require('./atk.js');
const { F, S3, H, D, rec, k } = A;
const XSS = '<img src=x onerror="window.__xss=1">O\'Grady 🏠 "Unit 4"';
const S1 = { k: 'saw', item: 'Side', qty: 2, L: 720, W: 560, mat: 'MFC White', note: '1mm ABS' };
const TOP = { k: 'saw', item: 'Top', qty: 1, L: 1200, W: 560, mat: 'Oak', note: '' };
const BK = { k: 'saw', item: 'Back', qty: 1, L: 700, W: 600, mat: 'MFC White', note: '' };
const SH = { k: 'saw', item: 'Shelf ' + XSS, qty: 3, L: 560, W: 500, mat: 'MFC White', note: '' };
const HG = { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum', note: 'soft close' };
const HG2 = { k: 'fit', item: 'Hinge', qty: 8, mat: 'Blum', note: 'soft close' }; // identical fittings twin
const BIG = Array.from({ length: 2500 }, (_, i) => ({ k: 'saw', item: 'Part ' + i, qty: 1, L: 100 + i, W: 50, mat: 'MFC White', note: '' }));
function v1Row(holdN) {
  const T = '2026-10-20T09:00:00Z';
  const hl = Array.from({ length: holdN || 0 }, (_, i) => ({ at: new Date(Date.parse('2026-09-01T00:00:00Z') + i * 60000).toISOString(), act: 'hold', list: i % 3 ? 'House 1' : 'Gone list', proj: 'Aderrig', n: 1, m: 'saw', by: 'Sean' }));
  return { id: 'main', version: 1, nid: 5,
    orders: [H.order({ wo: 'WO-1', customer: 'Aderrig Homes', dueDate: '2026-10-22', origDueDate: '2026-10-22' }), H.order({ wo: 'WO-2', customer: 'Crown & Co', dueDate: '2026-10-22', origDueDate: '2026-10-22' })],
    settings: {
      lists: [{ id: 'L1', wb: 'W1', sheet: 'House 1', name: 'House 1', project: 'Aderrig', saw: 5, fit: 2, wos: ['WO-1'], up: '2026-10-01T08:00:00Z' },
        { id: 'L2', wb: 'W2', sheet: XSS, name: XSS, project: 'aderrig ', saw: 1, fit: 0, wos: [], up: '2026-10-01T09:00:00Z' },
        { id: 'L3', wb: 'MW3', sheet: 'Unit 3', name: 'Unit 3', project: '  MANUAL LISTS ', saw: 1, fit: 0, wos: ['WO-2'], manual: true, up: '2026-10-02T08:00:00Z' },
        { id: 'L4', wb: 'MW4', sheet: 'Spare', name: 'Spare', project: 'Manual lists', saw: 1, fit: 0, wos: [], manual: true, up: '2026-10-02T09:00:00Z' },
        { id: 'L5', wb: 'W5', sheet: 'Big', name: 'Big', project: 'Aderrig', saw: 2500, fit: 0, wos: ['WO-1'], up: '2026-10-03T08:00:00Z' }],
      listWBs: { W1: { project: 'Aderrig', sheets: { 'House 1': [{ k: 'hdr', item: 'BASE', note: '' }, S1, { ...S1 }, TOP, BK, SH, HG, HG2] } },
        W2: { project: 'aderrig ', sheets: { [XSS]: [{ ...SH }] } }, MW3: { project: 'Manual lists', manual: true, sheets: { 'Unit 3': [{ ...BK }] } },
        MW4: { project: 'Manual lists', manual: true, sheets: { Spare: [{ ...TOP }] } }, W5: { project: 'Aderrig', sheets: { Big: BIG } } },
      listRow: { L1: { [k(S1)]: { m: 'saw', at: T, by: 'Sean' }, [k(TOP)]: { m: 'saw', at: T, by: 'Sean' }, [k(HG)]: { m: 'fit', at: T, by: 'Mary' } }, L5: Object.fromEntries(BIG.slice(0, 900).map(r => [k(r), { m: 'saw', at: T, by: 'Sean' }])) },
      listHold: { L1: { [k(TOP)]: { m: 'saw', st: 'hold', at: T, by: 'P', item: 'Top' }, [k(BK)]: { m: 'saw', st: 'hold', at: T, by: 'P', item: 'Back' }, [k(SH)]: { m: 'saw', st: 'rel', at: T, by: 'P', relAt: T, relBy: 'Stores' } },
        L3: { [k(BK)]: { m: 'saw', st: 'rel', at: T, by: 'P', relAt: T, relBy: 'Stores' } } },
      listDone: { L1: { fit: { at: T, by: 'Mary' } } },
      holdLog: hl } };
}
const cnt = S => ({ p: S.db.t.projects.length, l: S.db.t.lists.length, ln: S.db.t.list_lines.length, ev: S.db.t.list_events.length });
async function capRows(t, S, max) { // Supabase API default "Max rows" = 1000 per request; the fake has no cap
  await t.page.route(u => String(u).includes('supabase.co/rest/v1/'), async route => {
    const req = route.request();
    if (req.method() !== 'GET' || !/rest\/v1\/(lists|list_lines|projects|project_materials|list_events)\b/.test(req.url())) return route.fallback();
    const proxy = { request: () => req, fallback: () => route.fallback(), abort: x => route.abort(x),
      fulfill: o => { try { const b = JSON.parse(o.body); if (Array.isArray(b) && b.length > max) { S.capped = (S.capped || 0) + 1; o = { ...o, body: JSON.stringify(b.slice(0, max)) }; } } catch (e) {} return route.fulfill(o); } };
    return S3.handle(S, proxy);
  });
}
const pattern = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.kind !== 'hdr' && x.removed_rev == null).sort((a, b) => a.seq - b.seq).map(x => ['cut', 'got-out'].includes(x.status) ? 'D' : x.status === 'waiting' ? 'W' : x.released_at ? 'R' : '-').join('');
(async () => {
  const browser = await H.chromium.launch();
  // ---- M1-M3 messy data, twice
  {
    const S = F.makeServer(v1Row(10));
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const t0 = Date.now();
    const r = await off.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok, bad: x.check.bad, lines: x.check.lines }; });
    rec('M1 messy data migrates, counts match (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)', r.ok, JSON.stringify(r).slice(0, 300));
    const pj = S.db.t.projects.map(p => p.name).sort();
    rec('M1 "Aderrig" and "aderrig " are ONE project; "  MANUAL LISTS " → WO customer; Manual lists with no WO → Unassigned', pj.join('|') === 'Aderrig|Crown & Co|Unassigned', pj.join('|'));
    rec('M1 identical saw twins both cut (as the old screen showed), identical fittings twins both got-out', L4 => true && D.find(S.db, 'list_lines', 'L1:2').status === 'cut' && D.find(S.db, 'list_lines', 'L1:3').status === 'cut' && D.find(S.db, 'list_lines', 'L1:7').status === 'got-out' && D.find(S.db, 'list_lines', 'L1:8').status === 'got-out');
    rec('M1 tick+hold → cut; hold → waiting; released → todo with released_at', D.find(S.db, 'list_lines', 'L1:4').status === 'cut' && D.find(S.db, 'list_lines', 'L1:5').status === 'waiting' && D.find(S.db, 'list_lines', 'L1:6').status === 'todo' && !!D.find(S.db, 'list_lines', 'L1:6').released_at, pattern(S, 'L1'));
    rec('M1 holdLog for a list that no longer exists kept with list_id null (not dropped)', S.db.t.list_events.filter(e => e.list_id == null).length === 4, S.db.t.list_events.filter(e => e.list_id == null).length);
    // HTML / emoji names on the screens
    const saw = await F.dev(browser, S, 'saw');
    await saw.page.evaluate(() => { showTab && render(); });
    await off.page.evaluate(() => { showTab('l'); });
    await F.sleep(300);
    const x = await saw.page.evaluate(() => ({ x: window.__xss, img: document.querySelectorAll('img[src="x"]').length, txt: /O'Grady 🏠/.test(document.body.innerText) }));
    const x2 = await off.page.evaluate(() => ({ x: window.__xss, img: document.querySelectorAll('img[src="x"]').length, txt: /O'Grady 🏠/.test(document.body.innerText) }));
    rec('M2 list / part names with HTML, apostrophe, emoji: shown as text on saw and Lists tab, never run', !x.x && !x.img && !x2.x && !x2.img && x2.txt, JSON.stringify([x, x2]));
    const c1 = cnt(S);
    const r2 = await off.page.evaluate(async () => { DB.listStore = ''; const x = await lsMigrate('Garry'); return { ok: x.ok }; });
    rec('M3 run twice: no duplicate projects / lists / lines / events', r2.ok && JSON.stringify(cnt(S)) === JSON.stringify(c1), JSON.stringify([c1, cnt(S)]));
    // ---- M6 switch back (A11) on the messy data, then compare line by line
    const before = ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => pattern(S, id));
    const b = await off.page.evaluate(async () => { for (let i = 0; i < 50 && (SAVING || saveT); i++) { if (saveT) { clearTimeout(saveT); saveT = null; await saveDB(); } await new Promise(r => setTimeout(r, 100)); } try { return await lsSwitchBack('Garry'); } catch (e) { return { err: e.message }; } });
    const after = await off.page.evaluate(() => ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => { const l = lists().find(x => x.id === id); if (!l) return 'missing'; return listRows(l).filter(r => r.k !== 'hdr').map(r => rowTicked(l.id, rowKey(r)) ? 'D' : (h => h && h.st === 'hold' ? 'W' : h && h.st === 'rel' ? 'R' : '-')(holdsOf(l.id)[rowKey(r)])).join(''); }));
    rec('M6 A11 switch back: every line shows the same done / waiting / released as the tables', JSON.stringify(before) === JSON.stringify(after), JSON.stringify(b) + ' tables ' + JSON.stringify(before.map(s => s.slice(0, 12))) + ' old ' + JSON.stringify(after.map(s => s.slice(0, 12))));
    const c3 = cnt(S);
    const r3 = await off.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok, bad: x.check.bad.length }; });
    rec('M7 migrate again after switching back: ok, no duplicates', r3.ok && cnt(S).ln === c3.ln && cnt(S).ev === c3.ev && cnt(S).p === c3.p, JSON.stringify([r3, c3, cnt(S)]));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
    await off.close(); await saw.close();
  }
  // ---- M4 holdLog at its 300 cap: first run stops on a count mismatch; the floor carries on (one more hold, oldest drops off);
  //      second run must not duplicate the waiting history
  {
    const S = F.makeServer(v1Row(300));
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    S.onPost = (t, rows) => t === 'list_lines' ? rows.filter(r => r.id !== 'L1:4') : rows;
    const r1 = await off.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok }; });
    S.onPost = null;
    const ev1 = S.db.t.list_events.length;
    await off.page.evaluate(() => { holdLog('hold', lists()[0], 1, 'saw', 'Sean'); });
    const r2 = await off.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok }; });
    const ev2 = S.db.t.list_events.length;
    rec('M4 re-run after the holdLog rolled over (300 cap): waiting history not duplicated', ev2 <= ev1 + 1, 'first run ok=' + r1.ok + ' events=' + ev1 + '; second run ok=' + r2.ok + ' events=' + ev2 + ' (cid uses the array index)');
    await off.close();
  }
  // ---- M5 Supabase returns at most 1,000 rows per request (API "Max rows" default). The fake has no cap.
  {
    const S = F.makeServer(v1Row(0));
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await capRows(off, S, 1000);
    const r = await off.page.evaluate(async () => { const x = await lsMigrate('Garry'); return { ok: x.ok, bad: x.check.bad.map(b => b.name + ' old ' + b.old.n + ' new ' + b.now.n) }; });
    rec('M5 with Supabase\'s 1,000-row cap, a 2,500-line list still migrates (reads are paged)', r.ok, JSON.stringify(r) + ' capped GETs=' + S.capped);
    // if switched on anyway (e.g. lists of 600 lines each, 60 per request), does the saw get every line?
    D.insert(S.db, 'projects', { id: 'PX', name: 'X' });
    for (let j = 0; j < 3; j++) { D.insert(S.db, 'lists', { id: 'Q' + j, project_id: 'PX', name: 'Q' + j, wos: ['WO-1'], n_saw: 600 }); for (let i = 0; i < 600; i++) D.insert(S.db, 'list_lines', { id: 'Q' + j + ':' + (i + 1), list_id: 'Q' + j, seq: i + 1, kind: 'saw', part: 'P' + i, qty: '1', length_mm: 100, width_mm: 50, material: 'M' }); }
    S.row.settings.listStore = 'v2'; S.row.settings.listStoreAt = new Date().toISOString(); S.row.version++;
    const saw = await F.dev(browser, S, 'saw'); await capRows(saw, S, 1000);
    const n = await saw.page.evaluate(async () => { lsReset(); await lsLoad(); return ['Q0', 'Q1', 'Q2'].map(id => listRows({ id }).filter(r => r.k === 'saw').length); });
    rec('M5b 3 lists × 600 lines: the saw screen gets all 1,800 lines', n.every(x => x === 600), JSON.stringify(n) + ' (lsLines asks for 60 lists per request, no paging)');
    await off.close(); await saw.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
