// Editor step 2: the Excel import (switch ON) reads WPF's real layout through lsParseGrid, leaves out Blank / Index /
// Stock / Door Stock, and shows a preview before anything is saved. Switch OFF: today's import, unchanged.
// Fake Supabase only. Run: node tests/editor/e2-import.test.js
const path = require('path'), fs = require('fs');
const F = require('../stage3/fix3.js');
const { H, D } = F;
const FX = path.join(__dirname, '..', 'fixtures');
if (!fs.existsSync(path.join(FX, 'cutting-list-customer-a.xlsx'))) require(path.join(FX, 'make-fixtures.js'));
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const waitFor = async (p, fn, ms = 4000) => { for (let i = 0; i < ms / 100; i++) { if (await p.evaluate(fn)) return true; await F.sleep(100); } return false; };
(async () => {
  const browser = await H.chromium.launch();
  // ---- switch off: the old reader, no preview, no new-table calls
  {
    const row = F.v2Row(); delete row.settings.listStore; delete row.settings.listStoreAt;
    const S = F.makeServer(row);
    const t = await F.open(browser, S, { now: F.NOW, role: 'office' });
    await t.page.evaluate(() => showTab('l'));
    await t.page.setInputFiles('#lst-file', path.join(FX, 'cutting-list-customer-a.xlsx'));
    await F.sleep(800);
    const a = await t.page.evaluate(() => ({ preview: !!document.getElementById('ip-ok'), lists: (DB.lists || []).map(l => l.name).sort().join('|') }));
    rec('switch off: today\'s import — no preview, no new tables (Blank is still imported the old way)', !a.preview && /Blank/.test(a.lists) && F.newTableCalls(S).length === 0, JSON.stringify(a));
    await t.close();
  }
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { name: 'House 1' });
  D.insert(S.db, 'project_materials', { id: 'MW', project_id: 'P1', name: 'W/W', kind: 'sheet' });
  D.insert(S.db, 'project_materials', { id: 'MH', project_id: 'P1', name: 'WHB', kind: 'sheet' });
  D.insert(S.db, 'project_materials', { id: 'MV', project_id: 'P1', name: 'W/W Vinyl', kind: 'sheet' });
  const o = await F.dev(browser, S, 'office');
  await o.page.evaluate(() => { window.prompt = (m, d) => /PIN/.test(m) ? '7777' : 'Tester'; });
  const upload = async (file, pid) => {
    await o.page.evaluate(pid => { showTab('l'); lhImpPid = pid; }, pid || '');
    const sel = await o.page.evaluate(() => document.getElementById('lh-file') ? '#lh-file' : '#lst-file');
    await o.page.setInputFiles(sel, path.join(FX, file));
    return waitFor(o.page, () => !!document.getElementById('ip-ok'));
  };
  rec('switch on: the workbook opens a preview first', await upload('cutting-list-customer-a-nocache.xlsx', 'P1'));
  const pv = await o.page.evaluate(() => {
    const ov = document.querySelector('.pod-ovl');
    return { sheets: [...ov.querySelectorAll('[data-ips]')].map(c => c.closest('label').textContent.trim()), txt: ov.innerText, saved: 0 };
  });
  rec('preview lists the two house sheets only; Blank, Index, Stock, Door Stock are named as left out', pv.sheets.join('|') === 'Road 1 No 1,2,3|Road 2 No 4,5' && /Left out: Index, Blank, Stock, Door Stock/.test(pv.txt), pv.sheets.join('|') + ' / ' + (pv.txt.match(/Left out.*/) || [''])[0]);
  rec('preview shows unit blocks with their units and totals', /450 Robe fully shelved — 2 units/.test(pv.txt) && /1000 Double Rail — 3 units/.test(pv.txt), pv.txt.slice(0, 600));
  rec('nothing is saved while the preview is open', !S.db.t.lists.some(l => /Road/.test(l.name)));
  // untick the second sheet and the 500 unit block
  await o.page.evaluate(() => {
    const c = document.querySelector('[data-ips="1"]'); c.checked = false; c.onchange();
    const r = [...document.querySelectorAll('[data-ipr^="0|"]')].find(x => /500 Single Rail/.test(x.closest('tr').textContent)); r.checked = false; r.onchange();
  });
  const btn = await o.page.evaluate(() => document.getElementById('ip-ok').textContent);
  rec('the Save button counts the ticked sheets', btn === 'Save 1 list', btn);
  await o.page.evaluate(() => { document.getElementById('toast').textContent = ''; document.getElementById('ip-ok').click(); });
  await waitFor(o.page, () => /imported/.test(document.getElementById('toast').textContent));
  const l = S.db.t.lists.find(x => x.name === 'Road 1 No 1,2,3');
  const ln = l ? S.db.t.list_lines.filter(x => x.list_id === l.id).sort((a, b) => a.seq - b.seq) : [];
  const br = ln.map(x => x.kind === 'hdr' ? 'h:' + x.part + (x.qty ? '×' + x.qty : '') : x.kind + ':' + x.part + ':' + x.qty + ':' + (x.section || ''));
  rec('only the ticked sheet is saved', !!l && !S.db.t.lists.some(x => x.name === 'Road 2 No 4,5'), S.db.t.lists.map(x => x.name).join('|'));
  rec('unit headings saved as headings with the number of units', br[0] === 'h:450 Robe fully shelved×2' && br.includes('h:1000 Double Rail×3'), br.slice(0, 3).join(' ; '));
  rec('part lines carry the TOTAL to cut and their unit as section (works with no cached values)', br[1] === 'saw:Side panel:4:450 Robe fully shelved' && br.includes('saw:Shelves:9:1000 Double Rail'), br.slice(0, 6).join(' ; '));
  rec('the unticked unit block (heading and parts) is left out', !br.some(x => /500 Single Rail/.test(x)));
  rec('per-house extras: headings kept, parts under them', br.includes('h:Road 1 No 1') && br.includes('saw:Kicker:7:Road 1 No 1') && br.includes('saw:Kicker:5:Road 1 No 3'), br.slice(-12).join(' ; '));
  rec('no "Project / Title / Date / Description" or "total nr of units" lines', !ln.some(x => /^(Project|Title|Date|Description)$|total nr/i.test(x.part || '')));
  rec('colours on the project list are not flagged', ln.filter(x => x.kind === 'saw').every(x => !x.material_other), JSON.stringify(ln.filter(x => x.material_other).map(x => x.material)));
  // ---- school workbook: room breakdown unticked by default; ticking a Stores line off
  rec('school workbook opens its preview', await upload('cutting-list-school.xlsx', 'P1'));
  const sp = await o.page.evaluate(() => { const ov = document.querySelector('.pod-ovl'); const ib = [...ov.querySelectorAll('[data-ipr]')].filter(c => /not a part/.test(c.closest('tr').textContent)); return { n: ib.length, on: ib.filter(c => c.checked).length, txt: ov.innerText }; });
  rec('school: the room breakdown shows as "not a part", unticked', sp.n === 3 && sp.on === 0, JSON.stringify({ n: sp.n, on: sp.on }));
  await o.page.evaluate(() => { document.getElementById('toast').textContent = ''; document.getElementById('ip-ok').click(); });
  await waitFor(o.page, () => /imported/.test(document.getElementById('toast').textContent) || !!document.getElementById('mm-ok'));
  if (await o.page.evaluate(() => !!document.getElementById('mm-ok'))) await o.page.evaluate(() => document.getElementById('mm-ok').click()); // UD96 / BERMUDA aren't on the list: keep as typed
  await waitFor(o.page, () => /imported/.test(document.getElementById('toast').textContent));
  const sl = S.db.t.lists.find(x => x.name === '1200 Wall Units'), sln = sl ? S.db.t.list_lines.filter(x => x.list_id === sl.id).sort((a, b) => a.seq - b.seq) : [];
  rec('school: one unit block of 59, Side panel 118 to cut, no room-breakdown lines', sln[0] && sln[0].kind === 'hdr' && sln[0].qty === '59' && sln[1].qty === '118' && sln.length === 7, JSON.stringify(sln.map(x => [x.kind, x.part, x.qty])));
  // ---- cancel saves nothing
  const before = S.db.t.lists.length;
  await upload('cutting-list-customer-a.xlsx', 'P1');
  await o.page.evaluate(() => document.getElementById('ip-x').click());
  await F.sleep(300);
  const cmsg = await o.page.evaluate(() => (document.getElementById('lh-upmsg') || document.getElementById('lst-upmsg') || {}).textContent || '');
  rec('Cancel in the preview saves nothing and says so', S.db.t.lists.length === before && /nothing saved/.test(cmsg), cmsg);
  // ---- a workbook with nothing usable
  const b64 = await o.page.evaluate(() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Site', 'Road'], ['A', 'B']]), 'Index'); return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }); });
  await o.page.setInputFiles(await o.page.evaluate(() => document.getElementById('lh-file') ? '#lh-file' : '#lst-file'), { name: 'Empty.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(b64, 'base64') });
  await F.sleep(500);
  const em = await o.page.evaluate(() => (document.getElementById('lh-upmsg') || document.getElementById('lst-upmsg')).textContent);
  rec('no lists in the file: plain-English message with the right column names', /No cutting lists found in Empty\.xlsx — expected columns: Description \| Qty \| Length \| Width \| Material \(or Colour\) \| Edging/.test(em), em);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
