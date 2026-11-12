// B10 step 2 (Job B part 6): seqClaimPreview — the seq_insert claim rule in the browser. Its counts (Will be added / Skipped —
// already there) equal what the fake database's seq_insert then does, in every case: Start-the-sequence rows not yet saved
// (the "Start first" tick) are claimed by house + kind; the same file twice adds 0; two identical "W2 BED 2" lines add 2 and
// again 0 (three → 1 more); "0" / "T09" for the same unit is ❓ (not sure), never claimed and never silently added. The preview
// writes nothing. Fake Supabase only. Run: node tests/seq/b10b-preview.test.js
const X = require('./fixs.js'), B = require('./b10fix.js');
const { H, D, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer();
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    const a = await X.dev(browser, S, 'office'), p = a.page;
    const FILE = [B.HDR, ...B.houseC('T09', '13', 'RH'), ...B.houseB('T09', '20', 'LH'), B.pad([1, 'T09', '12', 'K8', 'HOUSE TYPE B LH', 'KITCHEN TYPE 1 LH', 3950])];
    await p.evaluate(f => { window.__L = seqReadUpload(f, 0).lines; }, FILE);
    const n0 = S.log.length;
    // A: no sequence yet; "Start first" → the 4 live WOs of the project become rows (not saved yet) and the file is previewed against them
    const pv = await p.evaluate(() => { const ex = seqStartRows(seqJobsToStart('P1')); window.__ex = ex; const v = seqClaimPreview('P1', window.__L, ex);
      return { n: ex.length, add: v.add.map(l => l.line_no), skip: v.skip.map(s => s.L.line_no + ':' + s.row.wo + ':' + s.by), uns: v.unsure.map(s => s.L.line_no + ':' + s.row.wo + ':' + s.why) }; });
    rec('Start first: 4 start rows; K8 claims WO-3 and K2 claims WO-4 by house; 8 to add', pv.n === 4 && JSON.stringify(pv.skip) === '["2:WO-3:house","3:WO-4:house"]' && pv.add.length === 8, JSON.stringify(pv));
    rec('"T09" / 12 against WO-1 (floor GF / 12): ❓ not sure — level or block?', pv.uns.length === 1 && /^12:WO-1:.*level or block/.test(pv.uns[0]), JSON.stringify(pv.uns));
    rec('the preview wrote nothing', S.log.slice(n0).filter(x => /^(POST|PATCH) /.test(x)).length === 0);
    // the database: start rows, then the 10 lines that aren't ❓ → the same counts
    const db = await p.evaluate(async () => {
      const s = await lsRpc('seq_insert', { p_project: 'P1', p_rows: window.__ex, p_after: null, p_by: 'Ann' });
      const sure = window.__L.filter(l => l.line_no !== 12);
      const r = await lsRpc('seq_insert', { p_project: 'P1', p_rows: seqUpRows(sure, 'f.xlsx', 'U1'), p_after: null, p_by: 'Ann' });
      await seqFresh('P1'); return { s: s.added.length, add: r.added.length, skip: r.skipped.map(x => x.by).join() };
    });
    rec('database: 4 start rows, then 8 added and 2 skipped (by house) — same as the preview', db.s === 4 && db.add === 8 && db.skip === 'house,house', JSON.stringify(db));
    rec('upload rows: waiting, src upload, upload_id, line_no, why "Cienapps upload: f.xlsx", children kept', (() => { const r = S.db.t.project_seq.find(x => x.line_no === 5 && x.src === 'upload'); return r && r.state === 'waiting' && r.upload_id === 'U1' && r.why === 'Cienapps upload: f.xlsx' && !r.wo; })()
      && (() => { const k = S.db.t.project_seq.find(x => x.src === 'upload' && x.product === 'K8'); return k && k.children.length === 2 && k.children[0].product === 'AA_KIT_T1'; })());
    // "Add anyway" for the ❓ line: the database adds it (it can't know "not sure")
    const db2 = await p.evaluate(async () => { const r = await lsRpc('seq_insert', { p_project: 'P1', p_rows: seqUpRows(window.__L.filter(l => l.line_no === 12), 'f.xlsx', 'U1'), p_after: null, p_by: 'Ann' }); await seqFresh('P1'); return r.added.length; });
    rec('❓ line added anyway: 1 row', db2 === 1);
    // B: the same file again → all skipped, in the preview and in the database
    const again = await p.evaluate(async () => { const v = seqClaimPreview('P1', window.__L); const r = await lsRpc('seq_insert', { p_project: 'P1', p_rows: seqUpRows(window.__L, 'f.xlsx', 'U2'), p_after: null, p_by: 'Ann' }); await seqFresh('P1');
      return { pa: v.add.length, pu: v.unsure.length, ps: v.skip.length, da: r.added.length, ds: r.skipped.length }; });
    rec('same file again: preview 0 to add / 11 skipped; database adds 0, skips 11', again.pa === 0 && again.pu === 0 && again.ps === 11 && again.da === 0 && again.ds === 11, JSON.stringify(again));
    // C: two identical "W2 BED 2" lines in one house → 2 rows; again → 0; three → 1 more
    const two = [B.HDR, B.pad([1, 'T09', '30', 'W2', 'HOUSE TYPE C BED 2', 'TYPE 1 RH (LH EXP)', 700]), B.pad([1, 'T09', '30', 'W2', 'HOUSE TYPE C BED 2', 'TYPE 1 RH (LH EXP)', 700])];
    const three = two.concat([two[1]]);
    const c = await p.evaluate(async ({ two, three }) => { const out = [];
      for (const f of [two, two, three]) { const L = seqReadUpload(f, 0).lines, v = seqClaimPreview('P1', L); const r = await lsRpc('seq_insert', { p_project: 'P1', p_rows: seqUpRows(L, 'b.xlsx', 'U3'), p_after: null, p_by: 'Ann' }); await seqFresh('P1');
        out.push([v.add.length + v.unsure.length, r.added.length, v.skip.length, r.skipped.length].join('/')); }
      return out; }, { two, three });
    rec('two identical W2 BED 2 lines: 2 added (preview = database); again 0; a file with three adds 1', JSON.stringify(c) === '["2/2/0/0","0/0/2/2","1/1/2/2"]', JSON.stringify(c));
    // D: a project with no rows and no Start: everything to add
    const lu = await p.evaluate(() => { const v = seqClaimPreview('P2', window.__L); return [v.add.length, v.skip.length, v.unsure.length].join('/'); });
    rec('another project with no sequence: 11 to add, nothing skipped', lu === '11/0/0', lu);
    // E: an island line never claims a kitchen Start row; a line with a blank floor is ❓ against a row of the same kind and unit
    const e = await p.evaluate(() => { const ex = [{ id: 'x1', wo: 'WO-X', floor: 'T09', unit: '40', descr: 'HOUSE TYPE B', kind: 'kitchen' }];
      const L = [{ line_no: 1, floor: 'T09', unit: '40', product: 'K9', name: 'HOUSE TYPE B ISLAND', descr: '', kind: 'kitchen' }, { line_no: 2, floor: '', unit: '40', product: 'K8', name: 'HOUSE TYPE B', descr: '', kind: 'kitchen' }];
      const v = seqClaimPreview('P2', L, ex); return { add: v.add.map(l => l.line_no), uns: v.unsure.map(s => s.L.line_no + ':' + s.why) }; });
    rec('an island line never claims a kitchen Start row (added); a blank floor is ❓ "floor blank"', JSON.stringify(e.add) === '[1]' && e.uns.length === 1 && /^2:.*floor blank/.test(e.uns[0]), JSON.stringify(e));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  } finally { await browser.close(); }
  X.finish();
})();
