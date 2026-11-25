// B10 step 1 (Job B part 6): seqReadUpload — the Cienapps UPLOAD file read into lines. Header found by its words (trailing
// spaces, any of the first 10 rows), no header → the fixed 27-column layout (same result), CHILDREN kept on the line (K8 with its
// fitting kit + door kit = ONE line), blank rows dropped, row numbers kept, kind from Name + Description, Qty above 1 warned,
// "Multiple" floor / unit flagged, the work-order EXPORT and other files refused. Real .xlsx and .csv bytes through seqUpBook.
// Nothing is written anywhere. Fake Supabase only. Run: node tests/seq/b10a-read.test.js
const X = require('./fixs.js'), B = require('./b10fix.js');
const { H, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer();
    const a = await X.dev(browser, S, 'office'), p = a.page;
    const FILE = [B.HDR, ...B.houseB('T09', '12', 'LH'), [], ...B.houseC('T09', '13', 'RH')];
    const n0 = S.log.length;
    const r = await p.evaluate(f => seqReadUpload(f, 0), FILE);
    rec('header found (trailing spaces in "Qty " / "Unit " / "CHILDREN n PRODUCT "): 10 lines, no error', !r.err && r.hdr && r.lines.length === 10, JSON.stringify({ err: r.err, n: r.lines.length }));
    const k8 = r.lines[0];
    rec('K8 line: floor T09, unit 12, product K8, name / description / price read', k8.floor === 'T09' && k8.unit === '12' && k8.product === 'K8' && k8.name === 'HOUSE TYPE B LH' && k8.descr === 'KITCHEN TYPE 1 LH' && k8.price === 3950 && k8.qty === 1, JSON.stringify(k8));
    rec('K8 with children → ONE line carrying CHILDREN 1 (fitting kit) and 2 (door kit) as info', k8.children.length === 2 && k8.children[0].product === 'AA_KIT_T1' && k8.children[1].product === 'AA_DOOR KIT T1' && k8.children[1].qty === 1, JSON.stringify(k8.children));
    rec('trailing spaces trimmed: "HOUSE TYPE B QUARTZ " → "HOUSE TYPE B QUARTZ", "TYPE 2 ROBE 1800 " → "TYPE 2 ROBE 1800"', r.lines[2].name === 'HOUSE TYPE B QUARTZ' && r.lines[3].descr === 'TYPE 2 ROBE 1800');
    rec('kinds: kitchen, utility, quartz, robes, robes (both houses)', r.lines.map(l => l.kind).join() === 'kitchen,utility,quartz,robes,robes,kitchen,utility,quartz,robes,robes', r.lines.map(l => l.kind).join());
    rec('the blank row dropped; line_no = the row in Excel (header row 1, house C from row 8)', r.lines.map(l => l.line_no).join() === '2,3,4,5,6,8,9,10,11,12', r.lines.map(l => l.line_no).join());
    rec('no warnings on a clean file', !r.warn.length && r.lines.every(l => !l.warn.length && !l.multi), JSON.stringify(r.warn));
    // no header → the fixed 27-column layout, same lines
    const r2 = await p.evaluate(f => seqReadUpload(f, 0), FILE.slice(1));
    const strip = x => x.lines.map(l => JSON.stringify(Object.assign({}, l, { line_no: 0 })));
    rec('no header row: the fixed 27-column layout gives the SAME 10 lines', !r2.err && !r2.hdr && JSON.stringify(strip(r2)) === JSON.stringify(strip(r)), r2.err);
    // header lower down, under a title row
    const r3 = await p.evaluate(f => seqReadUpload(f, 0), [['Aspect phase 5 excel 2 houses'], [], B.HDR, ...B.houseB('T09', '12', 'LH')]);
    rec('header in row 3 under a title: found, 5 lines from row 4', !r3.err && r3.hdr && r3.lines.length === 5 && r3.lines[0].line_no === 4, JSON.stringify({ e: r3.err, n: r3.lines.length }));
    // columns in another order, header words in other case, no CHILDREN columns
    const r4 = await p.evaluate(() => seqReadUpload([['PRODUCT', 'name ', 'FLOOR', 'unit', 'QTY'], ['K8', 'HOUSE TYPE A', 'S05', '7', 2], ['W2', 'HOUSE TYPE A BED 1', 'Multiple', '7', 1]], 0));
    rec('header in any order / case: read by name', !r4.err && r4.lines.length === 2 && r4.lines[0].floor === 'S05' && r4.lines[0].product === 'K8' && r4.lines[0].qty === 2, JSON.stringify(r4));
    rec('Qty 2 → warned "Qty 2 — one row; check how Cienapps makes the WOs"', /Qty 2 — one row; check how Cienapps makes the WOs/.test(r4.lines[0].warn.join()), JSON.stringify(r4.lines[0].warn));
    rec('Floor "Multiple" → flagged multi (never automatic) and warned', r4.lines[1].multi && /not one house/.test(r4.lines[1].warn.join()) && !r4.lines[0].multi);
    // refused files
    const wo = [['WO #', 'Title', 'Customer', 'Due Date', 'Step', 'Sub-Total', 'Reference', 'Floor', 'Unit'], ['WO-40', 'HOUSE TYPE Q', 'Aderrig Homes', 46359, '4. READY FOR PRODUCTION', 5000, 'x', 'T09', '40']];
    const e1 = await p.evaluate(f => seqReadUpload(f, 0), wo);
    rec('the Cienapps WORK-ORDER export is refused, nothing loaded', /work-order export/.test(e1.err) && !e1.lines.length, e1.err);
    const e2 = await p.evaluate(() => seqReadUpload([['Name', 'Phone'], ['Ann', '087 123'], ['Bob', '086 999']], 0));
    rec('a file that is not an upload file: "This doesn\'t look like a Cienapps upload file — nothing loaded."', e2.err === "This doesn't look like a Cienapps upload file — nothing loaded." && !e2.lines.length, e2.err);
    const e3 = await p.evaluate(() => [seqReadUpload([], 0).err, seqReadUpload([[''], ['  ']], 0).err, seqReadUpload([['Qty', 'Floor', 'Unit', 'Product', 'Name']], 0).err]);
    rec('empty file / blank rows / header with no lines: refused with a plain message', /empty/.test(e3[0]) && /empty/.test(e3[1]) && /no lines/.test(e3[2]), JSON.stringify(e3));
    const e4 = await p.evaluate(() => seqReadUpload([[1, 'T09', '12', 'K8', 'A'], ['x', 'y', 'z', '', ''], ['x', 'y', 'z', '', ''], ['x', 'y', 'z', '', '']], 0));
    rec('no header and most rows NOT "number in A + product in D": refused', e4.err === "This doesn't look like a Cienapps upload file — nothing loaded.", e4.err);
    // real file bytes: .xlsx and .csv through seqUpBook
    await B.makeFile(p, FILE, 'Aspect phase 5 excel 2 houses.xlsx');
    const x1 = await p.evaluate(async () => { const b = await window.__upFile.arrayBuffer(); const r = seqUpBook(b); return { err: r.err, n: r.lines.length, nos: r.lines.map(l => l.line_no).join(), k: r.lines[0].children.length, q: r.lines[2].name }; });
    rec('.xlsx bytes: 10 lines, row numbers kept, children kept, trimmed', !x1.err && x1.n === 10 && x1.nos === '2,3,4,5,6,8,9,10,11,12' && x1.k === 2 && x1.q === 'HOUSE TYPE B QUARTZ', JSON.stringify(x1));
    await B.makeFile(p, FILE.slice(1), 'upload.csv', true);
    const x2 = await p.evaluate(async () => { const b = await window.__upFile.arrayBuffer(); const r = seqUpBook(b); return { err: r.err, n: r.lines.length, u: r.lines[0].unit, f: r.lines[0].floor }; });
    rec('.csv with no header: 10 lines', !x2.err && x2.n === 10 && x2.u === '12' && x2.f === 'T09', JSON.stringify(x2));
    const x3 = await p.evaluate(() => seqUpBook(new Uint8Array([1, 2, 3, 4, 5]).buffer).err);
    rec('rubbish bytes: refused with a message, no crash', /nothing loaded/.test(x3), x3);
    rec('reading a file sends nothing to the database', S.log.slice(n0).filter(x => /^(POST|PATCH) /.test(x)).length === 0, JSON.stringify(S.log.slice(n0)));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await a.close();
  } finally { await browser.close(); }
  X.finish();
})();
