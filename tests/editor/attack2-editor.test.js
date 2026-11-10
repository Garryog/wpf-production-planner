// Tester attack 2 on the list editor fixes (round 2, after 9d59c22…62d4116). Browser, fake Supabase only.
//  A. edit merge across two screens: several parts added in DIFFERENT unit blocks on screen B, while screen A (opened
//     earlier) adds its own part, removes one, or changes a block's Units — every part must stay in its own block and
//     every total must be per-unit × units of the block it sits in
//  B. import preview: a ⚠ quantity box INSIDE a unit block — the number typed is per unit, the saw cuts per-unit × units
// Run: node tests/editor/attack2-editor.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const XLSX = require('../../xlsx.full.min.js');
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0, window_hint = ''; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 700))); };
const wait = async (fn, ms = 5000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
const BLOCKS = [
  ['hdr', 'U1 900 Single Rail', '3', null, null, null, '', '', {}],
  ['saw', 'Side panel', '6', 2380, 570, 'MFC White', '', '', { section: 'U1 900 Single Rail', unit_qty: '2' }],
  ['saw', 'Base', '3', 864, 570, 'MFC White', '', '', { section: 'U1 900 Single Rail', unit_qty: '1' }],
  ['hdr', 'U2 500 Robe', '2', null, null, null, '', '', {}],
  ['saw', 'Shelf', '4', 464, 570, 'MFC White', '', '', { section: 'U2 500 Robe', unit_qty: '2' }],
  ['saw', 'Top', '2', 500, 570, 'MFC White', '', '', { section: 'U2 500 Robe', unit_qty: '1' }]];
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const pinUp = p => p.evaluate(() => { window.__conf = []; window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why|What changed/.test(m) ? 'edit' : 'Tester'; window.confirm = m => { window.__conf.push(m); return true; }; });
// which block each part sits in on the saw, and whether its total = per unit × that block's units
function blocks(L) {
  let blk = '', u = null; const out = {}, bad = [];
  L.forEach(x => {
    if (x.kind === 'hdr') { blk = x.part; u = x.qty == null || x.qty === '' ? null : +x.qty; return; }
    out[x.part] = blk;
    if (u != null && String(+x.unit_qty * u) !== String(+x.qty)) bad.push(x.part + ' qty ' + x.qty + ' ≠ ' + x.unit_qty + ' × ' + u + ' (' + blk + ')');
  });
  return { out, bad };
}
const show = L => L.map(x => (x.kind === 'hdr' ? '#' + x.part + '×' + x.qty : x.part + ':' + x.qty + '(' + x.unit_qty + ')')).join(' | ');
const saveRows = (p, id, who, fn) => p.evaluate(async ({ id, who, fn }) => { const l = lsList(id); const rows = window.__rows || lsEditRows(id); new Function('rows', fn)(rows); try { await lsSaveManual({ wo: (l.wos || [])[0] || '', name: l.name, pid: l.pid, rows }, who, l); return 'ok'; } catch (e) { return e.message; } finally { window.__rows = null; } }, { id, who, fn });
(async () => {
  const browser = await H.chromium.launch();
  const two = async (id) => {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, id, { name: 'House ' + id, lines: BLOCKS, wos: ['WO-2'] });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    await pinUp(a.page); await pinUp(b.page);
    await a.page.evaluate(id => { window.__rows = lsEditRows(id); }, id); // A opens the editor first
    return { S, a, b };
  };
  // ---- A1. B adds 4 parts in different blocks (end of U1, two right under the U2 heading, end of U2); A adds its own
  //          part at the end of U1 and changes Shelf
  {
    const { S, a, b } = await two('LA');
    const rb = await saveRows(b.page, 'LA', 'Bob', `
      const P=(item,q)=>({k:'part',item,qty:q,L:700,W:500,mat:'MFC White',edging:'',note:''});
      rows.splice(3,0,P('B-U1-end','1'));                 // after Base (end of U1)
      const h=rows.findIndex(r=>r.item==='U2 500 Robe');
      rows.splice(h+1,0,P('B-U2-first','3'),P('B-U2-second','1')); // right under the U2 heading
      rows.push(P('B-U2-last','2'));`);
    const ra = await saveRows(a.page, 'LA', 'Ann', `
      rows.splice(3,0,{k:'part',item:'A-U1-end',qty:'4',L:300,W:300,mat:'MFC White',edging:'',note:''});
      rows.find(r=>r.item==='Shelf').qty=3;`);
    const L = live(S, 'LA'), bk = blocks(L);
    const want = { 'Side panel': 'U1 900 Single Rail', Base: 'U1 900 Single Rail', 'B-U1-end': 'U1 900 Single Rail', 'A-U1-end': 'U1 900 Single Rail', Shelf: 'U2 500 Robe', Top: 'U2 500 Robe', 'B-U2-first': 'U2 500 Robe', 'B-U2-second': 'U2 500 Robe', 'B-U2-last': 'U2 500 Robe' };
    rec('A1 both saves land (B then A, A opened earlier)', rb === 'ok' && ra === 'ok', JSON.stringify({ rb, ra }));
    rec('A1 every part (4 from B in two blocks, 1 from A) is in its own unit block on the saw', Object.keys(want).every(k => bk.out[k] === want[k]), JSON.stringify(bk.out) + ' :: ' + show(L));
    rec('A1 every total = per unit × units of its block (B-U2-first 6, B-U2-last 4, A-U1-end 12, Shelf 6)', !bk.bad.length && (L.find(x => x.part === 'Shelf') || {}).qty === '6', bk.bad.join('; ') + ' :: ' + show(L));
    rec('A1 B\'s two parts under the U2 heading keep their order', L.findIndex(x => x.part === 'B-U2-first') < L.findIndex(x => x.part === 'B-U2-second'), show(L));
    rec('A1 no duplicate lines', L.length === new Set(L.map(x => x.part)).size && L.length === 11, show(L));
    await a.close(); await b.close();
  }
  // ---- A2. B adds a part in U1; A (opened earlier, saw not started) changes U1 Units 3 → 4
  {
    const { S, a, b } = await two('LB');
    const rb = await saveRows(b.page, 'LB', 'Bob', `rows.splice(2,0,{k:'part',item:'Back',qty:'1',L:2380,W:880,mat:'MFC White',edging:'',note:''});`);
    const ra = await saveRows(a.page, 'LB', 'Ann', `rows[0].units='4';`);
    const L = live(S, 'LB'), bk = blocks(L), back = L.find(x => x.part === 'Back') || {};
    rec('A2 B adds "Back" (1 per unit) to U1, A changes U1 Units 3 → 4: Back is kept', rb === 'ok' && ra === 'ok' && !!back.part, JSON.stringify({ rb, ra }) + ' :: ' + show(L));
    rec('A2 …and Back\'s total follows the block\'s Units (1 × 4 = 4, not the 3 it had on B\'s screen) — the saw must not cut short', back.qty === '4' && !bk.bad.length, bk.bad.join('; ') + ' :: ' + show(L));
    await a.close(); await b.close();
  }
  // ---- A3. B adds two parts at the very end of U2; A deletes Top (the last part of U2) and Shelf
  {
    const { S, a, b } = await two('LC');
    const rb = await saveRows(b.page, 'LC', 'Bob', `const P=i=>({k:'part',item:i,qty:'1',L:600,W:400,mat:'MFC White',edging:'',note:''});rows.push(P('Kick 1'),P('Kick 2'));`);
    const ra = await saveRows(a.page, 'LC', 'Ann', `for(let i=rows.length-1;i>=0;i--)if(rows[i].item==='Top'||rows[i].item==='Shelf')rows.splice(i,1);`);
    const L = live(S, 'LC'), bk = blocks(L);
    rec('A3 B\'s two parts added after Top stay in U2 when A deletes Top and Shelf (they follow the U2 heading)', ra === 'ok' && bk.out['Kick 1'] === 'U2 500 Robe' && bk.out['Kick 2'] === 'U2 500 Robe' && !bk.bad.length, JSON.stringify({ rb, ra }) + ' :: ' + show(L));
    await a.close(); await b.close();
  }
  // ---- A4. B adds a whole new unit block U3 (heading + 2 parts) between U1 and U2; A edits a note in U2
  {
    const { S, a, b } = await two('LD');
    const rb = await saveRows(b.page, 'LD', 'Bob', `const h=rows.findIndex(r=>r.item==='U2 500 Robe');rows.splice(h,0,{k:'hdr',item:'U3 Tall',units:'5',note:''},{k:'part',item:'Tall side',qty:'2',L:2100,W:570,mat:'MFC White',edging:'',note:''},{k:'part',item:'Tall shelf',qty:'4',L:560,W:550,mat:'MFC White',edging:'',note:''});`);
    const ra = await saveRows(a.page, 'LD', 'Ann', `rows.find(r=>r.item==='Shelf').note='grain';`);
    const L = live(S, 'LD'), bk = blocks(L);
    rec('A4 B\'s new U3 block (heading + 2 parts) survives A\'s save, parts under U3 with totals 10 and 20', ra === 'ok' && bk.out['Tall side'] === 'U3 Tall' && bk.out['Tall shelf'] === 'U3 Tall' && !bk.bad.length && (L.find(x => x.part === 'Tall shelf') || {}).qty === '20', JSON.stringify({ rb, ra }) + ' :: ' + show(L));
    rec('A4 Shelf/Top still in U2 (not swallowed by U3)', bk.out.Shelf === 'U2 500 Robe' && bk.out.Top === 'U2 500 Robe', show(L));
    rec('no page errors (A)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  // ---- B. import preview: ⚠ quantity box inside a unit block (units readable = 3, part qty is a formula with no saved value)
  {
    const wb = XLSX.utils.book_new();
    const s = XLSX.utils.aoa_to_sheet([['Project', 'Aderrig'], ['Description', 'Qty', 'Length', 'Width', 'Colour', 'Edging'], ['900 Single Rail'], [null, 3, 'total nr of units'],
      ['Side Panel', null, 2380, 570, 'MFC White', ''], ['Shelves', 2, 864, 570, 'MFC White', ''], ['Plinth', -1, 864, 100, 'MFC White', '']]);
    s['B5'] = { t: 'n', f: 'X!Q99' }; // per-unit formula with no saved value
    XLSX.utils.book_append_sheet(wb, s, 'House 7');
    const file = path.join(__dirname, '..', 'fixtures', 'attack2-preview-unitqty.xlsx'); fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { name: 'House 1' });
    const o = await F.dev(browser, S, 'office'); await pinUp(o.page);
    await o.page.evaluate(() => { showTab('l'); lhImpPid = 'P1'; });
    const sel = await o.page.evaluate(() => document.getElementById('lh-file') ? '#lh-file' : '#lst-file');
    await o.page.setInputFiles(sel, file);
    await wait(() => o.page.evaluate(() => !!document.getElementById('ip-ok')));
    const boxes = await o.page.evaluate(() => [...document.querySelectorAll('.pod-ovl [data-ipq]')].map(c => c.closest('tr').innerText.replace(/\s+/g, ' ').trim()));
    rec('B preview: a ⚠ quantity box for Side Panel (formula) and Plinth (negative) inside the unit block', boxes.length === 2 && /Side Panel/.test(boxes[0]) && /Plinth/.test(boxes[1]), JSON.stringify(boxes));
    window_hint = await o.page.evaluate(() => { const c = document.querySelector('.pod-ovl [data-ipq]'); return c ? (c.title + ' / ' + c.placeholder) : ''; });
    // type 2 for Side Panel (per unit, like the Shelves row beside it which shows 2 / total 6) and 1 for Plinth
    await o.page.evaluate(() => { const bx = [...document.querySelectorAll('.pod-ovl [data-ipq]')]; bx[0].value = '2'; bx[0].oninput(); if (bx[1]) { bx[1].value = '1'; bx[1].oninput(); } });
    const shown = await o.page.evaluate(() => [...document.querySelectorAll('.pod-ovl tr')].filter(t => /Side Panel|Shelves|Plinth/.test(t.innerText)).map(t => t.innerText.replace(/\s+/g, ' ').trim()));
    await o.page.evaluate(() => { document.getElementById('toast').textContent = ''; document.getElementById('ip-ok').click(); });
    await wait(() => o.page.evaluate(() => /imported/.test(document.getElementById('toast').textContent) || !!document.getElementById('mm-ok')));
    if (await o.page.evaluate(() => !!document.getElementById('mm-ok'))) { await o.page.evaluate(() => document.getElementById('mm-ok').click()); await wait(() => o.page.evaluate(() => /imported/.test(document.getElementById('toast').textContent))); }
    await F.sleep(300);
    const l = S.db.t.lists.find(x => x.name === 'House 7'), L = l ? live(S, l.id) : [];
    const g = n => L.find(x => x.part === n) || {};
    rec('B saved: Side Panel typed 2 in the box inside a 3-unit block → saved consistently (6 to cut, 2 per unit)', g('Side Panel').qty === '6' && g('Side Panel').unit_qty === '2', show(L) + ' | preview rows: ' + JSON.stringify(shown));
    rec('B a plain number 2 on "Shelves" inside a 3-unit block (not divisible by 3) is still 2 to cut — never 2.000001', g('Shelves').qty === '2', show(L));
    rec('B the ⚠ box inside a unit block says whether to type PER UNIT or the TOTAL (it says "type the number to cut" but the number is multiplied by the units)', /per unit/i.test(window_hint), window_hint);
    rec('B saved: Plinth (was -1) typed 1 → 3 to cut (1 per unit), never negative', g('Plinth').qty === '3' && g('Plinth').unit_qty === '1', show(L));
    rec('B the preview shows the per-unit × units total next to a typed box (what you see = what the saw cuts)', shown.some(t => /Side Panel/.test(t) && /\b6\b/.test(t)), JSON.stringify(shown));
    rec('no page errors (B)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await o.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
})().catch(e => { console.error(e); process.exit(1); });
