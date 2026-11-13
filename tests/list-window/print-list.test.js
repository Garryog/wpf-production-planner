// Garry 13 Nov: "could we have a print option in the cutting list view" — the View window of a list has 🖨 Print; it opens a
// print page with the list name, revision, work order + due date and every row. Fake Supabase only.
// Run: node tests/list-window/print-list.test.js
const F = require('../stage3/fix3.js'); const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  F.seedList(S, 'L1', { wos: ['WO-1'], name: 'House 18' });
  const t = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }); const p = t.page;
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.evaluate(async () => {
    setWho('Ann'); showTab('l'); render(); await new Promise(r => setTimeout(r, 150));
    window.__doc = ''; window.__closed = false;
    window.open = () => ({ document: { write: h => { window.__doc += h; }, close: () => { window.__closed = true; } } });
    document.querySelector('[data-lhview="L1"]').click(); await new Promise(r => setTimeout(r, 150));
  });
  const v = await p.evaluate(() => { const b = document.getElementById('lv-print'), x = document.getElementById('pod-x'); return { btn: !!b, txt: b && b.textContent, beforeClose: !!(b && x && b.nextElementSibling === x) }; });
  rec('the View window has a 🖨 Print button beside Close', v.btn && /Print/.test(v.txt) && v.beforeClose, JSON.stringify(v));
  await p.evaluate(() => document.getElementById('lv-print').click());
  const d = await p.evaluate(() => { const rows = listRows(lsList('L1')).filter(r => r.k !== 'hdr').map(r => r.item); return { doc: window.__doc, closed: window.__closed, rows, stillOpen: !!document.getElementById('lv-print') }; });
  rec('a print page is written and closed', d.doc.length > 500 && d.closed, String(d.doc.length));
  rec('it has the list name, revision and work order', d.doc.includes('House 18') && /Rev 1/.test(d.doc) && d.doc.includes('WO-1'), d.doc.slice(0, 300));
  rec('every row of the list is on it (' + d.rows.length + ')', d.rows.length > 0 && d.rows.every(x => d.doc.includes(String(x).replace(/&/g, '&amp;'))), JSON.stringify(d.rows));
  rec('no tick buttons on paper, and it asks the browser to print', !/data-rt=/.test(d.doc) && d.doc.includes('window.print()'));
  rec('the View window stays open behind it', d.stillOpen);
  await p.evaluate(() => { window.open = () => null; window.__toast = ''; const o = window.toast; window.toast = m => { window.__toast = m; o && o(m); }; document.getElementById('lv-print').click(); });
  rec('pop-ups blocked: a plain message, no error', /Pop-up blocked/.test(await p.evaluate(() => window.__toast)));
  rec('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close(); S.close && S.close();
  console.log(`\n${res.filter(Boolean).length} passed, ${res.filter(x => !x).length} failed`);
  process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
