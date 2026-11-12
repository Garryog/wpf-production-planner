// Screenshots of the cutting-list window on the FAKE database (nothing real is read or written).
// Run: node tests/list-window/shots.js [outDir]   → list-window-pc.png, list-window-phone.png, list-window-saved.png
const X = require('../seq/fixs.js');
const { H, D, sleep } = X;
const out = process.argv[2] || '/tmp/wpf-shots';
require('fs').mkdirSync(out, { recursive: true });
function row() {
  const r = X.v2Row();
  r.orders.push(
    H.order({ wo: 'WO-2617-4', customer: 'Aderrig Homes', floor: '7', unit: '231', title: 'APT TYPE 1 KITCHEN', dueDate: '2026-10-23', origDueDate: '2026-10-23' }),
    H.order({ wo: 'WO-2617-5', customer: 'Aderrig Homes', floor: '7', unit: '232', title: 'APT TYPE 2 KITCHEN', dueDate: '2026-10-19', origDueDate: '2026-10-19' }),
    H.order({ wo: 'WO-2617-6', customer: 'Aderrig Homes', floor: '8', unit: '240', title: 'APT TYPE 1 KITCHEN', dueDate: '2026-11-12', origDueDate: '2026-11-12' }));
  return r;
}
(async () => {
  const browser = await H.chromium.launch();
  try {
    for (const [name, vp] of [['pc', { width: 1366, height: 800 }], ['phone', { width: 360, height: 740 }]]) {
      const S = X.makeServer(row());
      const t = await X.dev(browser, S, process.env.ROLE || 'office', { viewport: vp });
      const p = t.page;
      await p.evaluate(() => openListEditor(null, 'WO-2617-4')); await sleep(900);
      await p.screenshot({ path: out + '/list-window-' + name + '.png' });
      if (name === 'pc') {
        const setv = (k, v) => p.evaluate(({ k, v }) => { const e = document.querySelector('.me-ed [data-mr="' + k + '"]'); if (!e) return; e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); }, { k, v });
        await setv('0|item', 'Base end'); await setv('0|qty', '2'); await setv('0|L', '720'); await setv('0|W', '560');
        const m = await p.evaluate(() => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); const o = [...s.options].find(x => x.value && x.value !== '__add'); if (o) { s.value = o.value; s.dispatchEvent(new Event('change')); } return o && o.value; });
        await sleep(200); await p.screenshot({ path: out + '/list-window-filled.png' });
        await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500);
        await p.screenshot({ path: out + '/list-window-saved.png' });
      }
      await t.close();
    }
  } finally { await browser.close(); }
  console.log('shots in ' + out);
})();
