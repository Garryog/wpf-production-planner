// Coder regression (17 Nov, Manager finding): a template inserted with the cursor on a row in the MIDDLE of a × block (before
// its sub-heading) goes in AFTER the whole block — the rows under the block's sub-heading keep their totals. Fake Supabase only.
// Run: node tests/list-window/c17-template-mid-xblock.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks } = L;
const M = 'MFC White', HB = 'Blum hinge';
const XL = [['hdr', 'Floor 2', '4', null, null, null, '', ''], ['saw', 'Top', '4', 1200, 560, M, '', '', { unit_qty: '1' }],
  ['hdr', 'Fillers', null, null, null, null, '', '', { section: 'Floor 2' }], ['saw', 'Filler', '8', 2100, 100, M, '', '', { unit_qty: '2' }],
  ['hdr', 'Stores items', null, null, null, null, '', '', { section: 'Floor 2' }], ['fit', 'Hinge', '32', null, null, HB, '', '', { unit_qty: '8' }]];
const tots = p => p.evaluate(() => [...document.querySelectorAll('.me-ed [data-row]')].map(tr => { const it = tr.querySelector('[data-mr$="|item"]'), t = tr.querySelector('[data-tot]'); return (it ? it.value : '') + (t ? ' ' + t.textContent.replace(/fixed/, '').trim() : ''); }));
(async () => {
  const browser = await X.H.chromium.launch();
  let S;
  try {
    const r = X.v2Row(); r.orders.push(X.H.order({ wo: 'WO-30', customer: 'Aderrig Homes', floor: 'F1', unit: '1', title: 'HOUSE 1', dueDate: '2026-12-03', origDueDate: '2026-12-03' }));
    S = X.makeServer(r);
    X.F3.seedList(S, 'A1', { wos: ['WO-30'], name: 'MX', lines: XL });
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' }, lines: [['hdr', 'Kitchen', null, null, null, null, '', ''], ['saw', 'Side', '2', 720, 560, M, '', '']] });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    for (const [hn, nm] of [['1', ''], ['3', 'Floor 3']]) {
      await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor('A1'); }); await sleep(1100);
      const b0 = await tots(p);
      await p.click('.me-ed [data-row="1"] [data-mr$="|item"]'); await sleep(150); // the cursor on "Top", the first row of the × block
      await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
      await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o && o.querySelector('[data-itt="T1"]'); if (b) b.click(); }); await sleep(900);
      await p.evaluate(({ hn, nm }) => { const a = document.getElementById('it-hn'), b = document.getElementById('it-hname'); if (a) a.value = hn; if (b) b.value = nm; const k = document.getElementById('it-hok'); if (k) k.click(); }, { hn, nm }); await sleep(500);
      const a = await tots(p), keep = ['Top = 4', 'Filler = 8', 'Hinge = 32'];
      rec('[HIGH] template (How many ' + hn + (nm ? ', ' + nm : '') + ') inserted with the cursor on Top in "Floor 2 × 4" → Top, Filler and Hinge keep their totals 4 / 8 / 32', keep.every(k => a.includes(k)), JSON.stringify([b0, a]));
      rec('…and the template rows come AFTER the whole × block (after Hinge)', a.indexOf('Hinge = 32') >= 0 && a.findIndex(x => /^Side/.test(x)) > a.indexOf('Hinge = 32'), JSON.stringify(a));
    }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
