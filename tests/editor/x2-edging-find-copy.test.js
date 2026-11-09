// Garry 9 Nov: (1) Edging 1 / Edging 2 are drop-downs of the codes on WPF's own lists (+ codes used on the project, + Other…);
// (2) 🔍 Find old list searches every list (any project, done / archived too); (3) ⧉ Copy to new list opens its rows in a NEW
// list — no work order, no ticks — and never changes the old list. Fake Supabase only. Run: node tests/editor/x2-edging-find-copy.test.js
const F = require('../stage3/fix3.js'); const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const J = JSON.stringify;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { wos: ['WO-1'], name: 'House 18' });
  F.seedList(S, 'L2', { wos: [], name: 'House 7 Type B', list: { archived: true, created_at: '2026-09-01T08:00:00.000Z' } });
  D.insert(S.db, 'projects', { id: 'P2', name: 'Cairn Oranmore' });
  F.seedList(S, 'L3', { wos: [], name: 'Science lab', list: { project_id: 'P2', created_at: '2026-10-25T08:00:00.000Z' } });
  const t = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }); const p = t.page;
  await p.evaluate(() => { window.__ans = []; window.prompt = (m, d) => window.__ans.length ? window.__ans.shift() : null; window.confirm = () => true; });
  // ---- 1. edging drop-downs
  await p.evaluate(async () => { setWho('Ann'); showTab('l'); LH.proj = 'P1'; render(); await new Promise(r => setTimeout(r, 100)); document.getElementById('lh-blank').click(); await new Promise(r => setTimeout(r, 200)); });
  const e = await p.evaluate(() => { const a = document.querySelector('[data-mr="0|edging"]'), b = document.querySelector('[data-mr="0|edging2"]'); return { a: a.tagName, b: b.tagName, opts: [...a.options].map(o => o.value) }; });
  rec('Edging 1 and Edging 2 are drop-downs', e.a === 'SELECT' && e.b === 'SELECT', J(e));
  rec('codes from WPF\'s lists are offered, plus the project\'s own (1mm ABS) and Other…', ['L1LE 1mm', 'L2LE 1mm', 'L2S1LE', 'L1L2SE 1mm', 'L4S 1mm', 'L4S 2mm', 'L4S 2mm R', 'No edge', 'No Cap', '1mm ABS', '__other'].every(x => e.opts.includes(x)), J(e.opts));
  await p.evaluate(() => { const a = document.querySelector('[data-mr="0|edging"]'); a.value = 'L4S 2mm'; a.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(() => { window.__ans = ['L2LE 1mm Blue']; const b = document.querySelector('[data-mr="0|edging2"]'); b.value = '__other'; b.dispatchEvent(new Event('change', { bubbles: true })); });
  await F.sleep(100);
  const e2 = await p.evaluate(() => ({ a: document.querySelector('[data-mr="0|edging"]').value, b: document.querySelector('[data-mr="0|edging2"]').value, row1: [...document.querySelector('[data-mr="0|edging"]').options].map(o => o.value).includes('L2LE 1mm Blue') }));
  rec('picking a code sets Edging 1; Other… asks and keeps the typed code (and offers it on other rows)', e2.a === 'L4S 2mm' && e2.b === 'L2LE 1mm Blue' && e2.row1, J(e2));
  await p.evaluate(() => { window.__ans = [null]; const b = document.querySelector('[data-mr="0|edging2"]'); b.value = '__other'; b.dispatchEvent(new Event('change', { bubbles: true })); });
  rec('Other… then Cancel leaves the value as it was', await p.evaluate(() => document.querySelector('[data-mr="0|edging2"]').value) === 'L2LE 1mm Blue');
  await p.evaluate(() => { [...document.querySelectorAll('.pod-ovl')].forEach(x => x.remove()); });
  // an existing list keeps its odd code
  await p.evaluate(async () => { openListEditor2('L1'); await new Promise(r => setTimeout(r, 150)); });
  rec('an existing list shows its saved code selected', await p.evaluate(() => document.querySelector('[data-mr="0|edging"]').value) === '1mm ABS');
  await p.evaluate(() => { [...document.querySelectorAll('.pod-ovl')].forEach(x => x.remove()); });
  // ---- 2. Find old list
  await p.evaluate(async () => { render(); await new Promise(r => setTimeout(r, 100)); document.getElementById('lh-find').click(); await new Promise(r => setTimeout(r, 100)); });
  const names = () => p.evaluate(() => [...document.querySelectorAll('[data-foc]')].map(b => b.closest('tr').querySelector('b').textContent));
  let n = await names();
  rec('Find old list (project Aderrig): its lists, archived ones too, newest first', J(n) === J(['House 18', 'House 7 Type B']), J(n));
  await p.evaluate(() => { const q = document.getElementById('fo-q'); q.value = 'type b'; q.oninput(); }); n = await names();
  rec('the search box keeps focus while typing', await p.evaluate(() => document.activeElement && document.activeElement.id === 'fo-q'));
  rec('typing narrows it ("type b")', J(n) === J(['House 7 Type B']), J(n));
  await p.evaluate(() => { const q = document.getElementById('fo-q'); q.value = 'lab'; q.oninput(); });
  const none = await p.evaluate(() => document.querySelector('.pod-ovl #fo-body').innerText);
  rec('a list on another project is not found until "All projects" is ticked — and it says so', /tick All projects/.test(none), none.slice(0, 200));
  await p.evaluate(() => { const a = document.getElementById('fo-all'); a.checked = true; a.onchange(); }); n = await names();
  rec('All projects: finds "Science lab" on Cairn Oranmore', J(n) === J(['Science lab']), J(n));
  // ---- 3. Copy to new list (archived list from Aderrig)
  await p.evaluate(() => { const q = document.getElementById('fo-q'); q.value = 'house 7'; q.oninput(); });
  await p.evaluate(() => document.querySelector('[data-foc]').click()); await F.sleep(400);
  const ed = await p.evaluate(() => { const ov = document.querySelector('.me-ed') ? document.querySelector('.pod-ovl:last-of-type') : null; const t = document.body.innerText;
    return { open: !!document.querySelector('.me-ed'), name: (document.getElementById('me-name') || {}).value, wo: (document.getElementById('me-wo') || {}).value || '', pid: (document.getElementById('me-pid') || {}).value,
      rows: [...document.querySelectorAll('.me-grid tbody tr')].map(r => (r.querySelector('[data-mr$="|item"]') || {}).value), note: /Copied from "House 7 Type B"/.test(t) && /is not changed/.test(t) }; });
  rec('Copy to new list opens a NEW list: name "(copy)", no work order, project Aderrig, the old rows', ed.open && ed.name === 'House 7 Type B (copy)' && !ed.wo && ed.pid === 'P1' && J(ed.rows) === J(['Side', 'Side', 'Top', 'Hinge']), J(ed));
  rec('it says where it came from and that the old list is not changed', ed.note, J(ed));
  const before = J(D.find(S.db, 'lists', 'L2'));
  // pick WO-2 and save
  await p.evaluate(async () => { const w = document.getElementById('me-wo'); w.value = 'WO-2'; w.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 100)); });
  await p.evaluate(async () => { const b = [...document.querySelectorAll('.pod-ovl button')].find(x => /Save list/.test(x.textContent)); b.click(); await new Promise(r => setTimeout(r, 800)); });
  await F.send(p).catch(() => {}); await F.sleep(400);
  const nw = S.db.t.lists.find(l => l.name === 'House 7 Type B (copy)');
  const nl = nw ? S.db.t.list_lines.filter(x => x.list_id === nw.id) : [];
  if (!nw) console.log('  editor says:', await p.evaluate(() => (document.getElementById('me-err') || {}).textContent));
  rec('saved: a new list for WO-2 with the 4 rows (fresh, no ticks)', nw && J(nw.wos) === J(['WO-2']) && nl.length === 4 && nl.every(x => (x.status || 'todo') === 'todo'), J({ nw, nl: nl.length }));
  rec('the old (archived) list is untouched', J(D.find(S.db, 'lists', 'L2')) === before);
  // ---- Lists home: ⧉ Copy on rows, "Any state" filter
  await p.evaluate(async () => { [...document.querySelectorAll('.pod-ovl')].forEach(x => x.remove()); LH.state = 'any'; render(); await new Promise(r => setTimeout(r, 100)); });
  const rows = await p.evaluate(() => [...document.querySelectorAll('[data-lhrow]')].map(r => ({ n: r.querySelector('b').textContent, c: !!r.querySelector('[data-lhcopy]') })));
  rec('Lists home "Any state (incl. archived)" shows the archived list; every row has ⧉ Copy', rows.some(r => r.n === 'House 7 Type B') && rows.every(r => r.c), J(rows));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await t.close();
  const t2 = await F.dev(browser, S, 'office', { viewport: { width: 360, height: 760 } });
  const ph = await t2.page.evaluate(async () => { setWho('Ann'); showTab('l'); LH.proj = 'P1'; render(); await new Promise(r => setTimeout(r, 100)); document.getElementById('lh-find').click(); await new Promise(r => setTimeout(r, 100)); return document.documentElement.scrollWidth; });
  rec('360 px phone: Find old list does not scroll the page sideways', ph <= 362, ph);
  await t2.close(); await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
