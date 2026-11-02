// Stage 3 C2 + C3: the V2 in-memory store (load, "changed since" polling, version skip, no redraw while typing) and the
// read adapters (lists/listRows/rowKey/rowTicks/holdsOf/listDone/knownMaterials in today's shapes). Fake Supabase only.
// Run: node tests/stage3/c2c3-store.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
(async () => {
  const browser = await H.chromium.launch();
  // ---- loading + shapes
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'L1');
    F.seedList(S, 'L2', { name: 'House 2', wos: ['WO-2'], lines: [['hdr', 'KITCHEN', null, null, null, null], ['saw', 'Plinth', '2x2', 2400, 150, 'MFC White', '', ''], ['saw', 'Old part', '1', 500, 500, 'MFC White', '', '', { removed_rev: 2 }], ['saw', 'Spare', '1', 500, 500, 'MFC White', '', '', { status: 'na' }]] });
    // a finished list: both sides signed off, no WO → its lines are not loaded at start-up
    F.seedList(S, 'L3', { name: 'Done house', wos: [], list: { saw_done_at: '2026-10-19T10:00:00Z', saw_done_by: 'Sean', fit_done_at: '2026-10-19T11:00:00Z', fit_done_by: 'Mary' } });
    F.seedList(S, 'T1', { name: 'Type B template', wos: [], list: { is_template: true } });
    F.seedList(S, 'SN1', { name: 'Snags Aderrig', wos: [], list: { list_type: 'snag', deliver_by: '2026-10-22' }, lines: [['saw', 'Door', '1', 700, 400, 'MFC White', '', 'Apt 3']] });
    const saw = await F.dev(browser, S, 'saw');
    const r = await saw.page.evaluate(() => {
      const ls = lists(), l1 = ls.find(l => l.id === 'L1'), l2 = ls.find(l => l.id === 'L2');
      return { ids: ls.map(l => l.id), l1: { name: l1.name, project: l1.project, saw: l1.saw, fit: l1.fit, wos: l1.wos }, rows1: listRows(l1), rows2: listRows(l2), keys: listRows(l1).map(rowKey),
        full: [...LST.full].sort(), done3: listDone('L3'), sn: listDueKey(ls.find(l => l.id === 'SN1')), mats: knownMaterials(), ms: LST.ms };
    });
    rec('lists(): live lists only (no template), in the old shape with the project name', r.ids.join() === 'L1,L2,L3,SN1' && r.l1.project === 'Aderrig' && r.l1.saw === 3 && r.l1.fit === 1 && r.l1.wos.join() === 'WO-1', JSON.stringify(r.ids) + JSON.stringify(r.l1));
    const s0 = r.rows1[0];
    rec('listRows(): {k,item,qty,L,W,mat,note,id}, note = edging · note (note e)', s0.k === 'saw' && s0.item === 'Side' && s0.qty === 2 && s0.L === 720 && s0.W === 560 && s0.mat === 'MFC White' && s0.note === '1mm ABS' && s0.id === 'L1:1' && r.rows1[2].note === 'scribe', JSON.stringify(r.rows1.slice(0, 3)));
    rec('fittings row has no L/W; qty kept as typed when not a number ("2x2")', !('L' in r.rows1[3]) && r.rows1[3].k === 'fit' && r.rows2[1].qty === '2x2', JSON.stringify([r.rows1[3], r.rows2[1]]));
    rec('header row kept as k:hdr; removed and not-needed lines left out', r.rows2.length === 2 && r.rows2[0].k === 'hdr' && r.rows2[0].item === 'KITCHEN', JSON.stringify(r.rows2));
    rec('rowKey(r) = the permanent line id', r.keys.join() === 'L1:1,L1:2,L1:3,L1:4');
    rec('lines loaded only for unfinished lists (not the finished one, not the template)', r.full.join() === 'L1,L2,SN1', r.full.join());
    rec('listDone() of a finished list from the table columns', r.done3.saw && r.done3.saw.by === 'Sean' && r.done3.fit.by === 'Mary');
    rec('snag list with no WO: listDueKey uses deliver_by (hub change 2)', r.sn === '2026-10-22', r.sn);
    rec('knownMaterials() = project sheet materials only', r.mats.join() === 'MFC White', r.mats.join());
    rec('saw polls every 10 s', r.ms === 10000, r.ms);
    // the saw screen draws the V2 lists: tick buttons keyed by line id
    const h = await saw.page.evaluate(() => [...document.querySelectorAll('[data-rt]')].map(b => b.getAttribute('data-rt')).join(','));
    rec('saw screen shows L1 and the snag list with line-id tick buttons', /L1\|L1:1/.test(h) && /L1\|L1:2/.test(h) && /SN1\|SN1:1/.test(h), h);
    // opening a finished list fetches its lines then
    const before = S.log.filter(x => /list_lines\?.*L3/.test(decodeURIComponent(x))).length;
    await saw.page.evaluate(async () => { listRows(lists().find(l => l.id === 'L3')); await new Promise(r => setTimeout(r, 300)); });
    const after = await saw.page.evaluate(() => listRows(lists().find(l => l.id === 'L3')).length);
    rec('a finished list\'s lines load when it is opened', before === 0 && after === 4, before + '/' + after);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    // the old frozen copy stays untouched by anything above
    rec('planner record list data untouched (frozen copy)', JSON.stringify(S.row.settings.lists) === JSON.stringify(F.v2Row().settings.lists) && !S.row.settings.listRow);
    await saw.close();
  }
  // ---- polling
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1');
    const saw = await F.dev(browser, S, 'saw');
    const off = await F.dev(browser, S, 'office');
    rec('office board polls every 60 s; the Lists tab every 10 s', (await off.page.evaluate(() => LST.ms)) === 60000 && (await off.page.evaluate(() => { showTab('l'); return LST.ms; })) === 10000);
    await F.sleep(50);
    D.applyLineChanges(S.db, [{ id: 'L1:3', status: 'cut', cid: 'x1', rev: 1 }], 'Other saw');
    S.log.length = 0;
    await saw.page.evaluate(async () => { await lsPoll(); });
    const q = S.log.filter(x => /\/list_lines\?/.test(x)).map(decodeURIComponent);
    const since = await saw.page.evaluate(() => LST.since.list_lines);
    const r = await saw.page.evaluate(() => ({ t: rowTicked('L1', 'L1:3'), by: rowTicks('L1')['L1:3'] && rowTicks('L1')['L1:3'].by, h: !!document.querySelector('[data-rt="L1|L1:3"].on') }));
    rec('poll asks only for rows changed since (newest database time minus 30 s)', q.length === 1 && /updated_at=gt\./.test(q[0]), q.join(' '));
    rec('another screen\'s tick shows after a poll, with who did it, and the screen redraws', r.t && r.by === 'Other saw' && r.h, JSON.stringify(r));
    rec('"since" is the database\'s updated_at (not the device clock, which is set to 21 Oct)', since === line0(S, 'L1:3').updated_at, since);
    // version skip: an older copy of a line never overwrites a newer one
    const v = await saw.page.evaluate(() => { const x = LST.ln.get('L1:3'); const n = lsPut('list_lines', [{ ...x, status: 'todo', version: x.version - 1 }]); return { n, st: LST.ln.get('L1:3').status }; });
    rec('version skip: an older row is ignored', v.n === 0 && v.st === 'cut', JSON.stringify(v));
    const v2 = await saw.page.evaluate(() => { const x = LST.ln.get('L1:3'); return lsPut('list_lines', [{ ...x }]); });
    rec('version skip: the same version again (30-second overlap) is ignored', v2 === 0);
    // no redraw while typing
    D.applyLineChanges(S.db, [{ id: 'L1:1', status: 'cut', cid: 'x2', rev: 1 }], 'Other saw');
    const t = await saw.page.evaluate(async () => {
      const app = document.getElementById('app'); app.setAttribute('data-mark', '1');
      const i = document.createElement('input'); app.prepend(i); i.focus();
      await lsPoll();
      const kept = app.querySelector('input') === i && app.getAttribute('data-mark') === '1' && !document.querySelector('[data-rt="L1|L1:1"].on');
      i.blur(); render();
      return { kept, data: rowTicked('L1', 'L1:1'), after: !!document.querySelector('[data-rt="L1|L1:1"].on') };
    });
    rec('a poll never redraws while someone is typing; the data is there for the next draw', t.kept && t.data && t.after, JSON.stringify(t));
    // a dialog open → no redraw
    D.applyLineChanges(S.db, [{ id: 'L1:2', status: 'cut', cid: 'x3', rev: 1 }], 'Other saw');
    const dl = await saw.page.evaluate(async () => { const ov = document.createElement('div'); ov.className = 'pod-ovl'; document.body.appendChild(ov); await lsPoll(); const on = !!document.querySelector('[data-rt="L1|L1:2"].on'); ov.remove(); return on; });
    rec('a poll never redraws over an open dialog', dl === false);
    // list changes come through too (another office attached a WO)
    D.listAttach(S.db, 'L1', 'WO-2', true, 'Office B');
    await off.page.evaluate(async () => { await lsPoll(); });
    rec('office sees a WO attached on another PC after a poll', (await off.page.evaluate(() => lists()[0].wos.join())) === 'WO-1,WO-2');
    // a list sent back for a re-cut on another PC (was finished, lines not loaded) gets its lines on the next poll
    F.seedList(S, 'L9', { name: 'Finished', wos: [], list: { saw_done_at: '2026-10-19T10:00:00Z', fit_done_at: '2026-10-19T10:00:00Z' } });
    await saw.page.evaluate(async () => { await lsPoll(); });
    const f0 = await saw.page.evaluate(() => LST.full.has('L9'));
    D.listSetDone(S.db, 'L9', 'saw', false, 'Office', 'damaged');
    await saw.page.evaluate(async () => { await lsPoll(); });
    const f1 = await saw.page.evaluate(() => LST.full.has('L9') && listRows(lists().find(l => l.id === 'L9')).length === 4);
    rec('a finished list sent back on another PC: its lines load on the next poll', !f0 && f1, f0 + '/' + f1);
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await saw.close(); await off.close();
  }
  // ---- database down at start-up: the app still opens, says nothing breaks, loads on the next poll
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1'); S.fail3 = true;
    const saw = await F.dev(browser, S, 'saw');
    const a = await saw.page.evaluate(() => ({ n: lists().length, err: LST.err, loaded: LST.loaded }));
    S.fail3 = false;
    await saw.page.evaluate(async () => { await lsPoll(); });
    const b = await saw.page.evaluate(() => ({ n: lists().length, loaded: LST.loaded }));
    rec('lists tables unreachable at start-up: no crash, error kept, loads on the next poll', a.n === 0 && !a.loaded && /503/.test(a.err) && b.loaded && b.n === 1, JSON.stringify([a, b]));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await saw.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
function line0(S, id) { return F.D.find(S.db, 'list_lines', id); }
