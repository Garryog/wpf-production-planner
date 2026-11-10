// Tester attack: phone widths — tick vs N/A hit areas, fat-finger overlap, horizontal overflow. Stubbed Supabase only.
// Run: node tests/sawstores/attack-phone.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NOW = '2026-10-21T09:00:00Z';
const LONG = 'Tall larder end panel left hand with scribe — O\'Grady 🙂 special';
const rows = [{ k: 'hdr', item: 'Kitchen' }];
for (let i = 0; i < 12; i++) rows.push({ k: 'saw', item: i === 0 ? LONG : 'Part ' + i, qty: 2, L: 2400, W: 600, mat: i === 1 ? 'MFC Super Matt Graphite Grey 18mm Egger U961 ST2' : 'MFC White', note: i === 2 ? 'ABS 1mm all round, 2mm front' : '' });
rows.push({ k: 'fit', item: 'Hinge', qty: 10, mat: 'Blum', note: '' });
// Second data set: 12 sections × 3 lines, long material names incl. one with NO spaces (cannot wrap), long section names.
const rows12 = [];
const MATS = ['MFC Super Matt Graphite Grey 18mm Egger U961 ST2 (customer supplied, check grain direction)', 'EGGER_H1145_ST10_NATURAL_BARDOLINO_OAK_18MM_MFC_2800x2070', 'MFC White'];
for (let s = 0; s < 12; s++) { rows12.push({ k: 'hdr', item: 'Section ' + (s + 1) + ' — Apartment block C, floor ' + s + ', utility + boot room + hot press', note: 'O\'Grady <b>note</b>' });
  for (let i = 0; i < 3; i++) rows12.push({ k: 'saw', item: (i === 0 ? LONG : 'Part ' + s + '-' + i), qty: 2, L: 2400 - s, W: 600 - i, mat: MATS[i], note: i === 1 ? 'ABS 1mm all round, 2mm front, PUR glue, no edging on back edge' : '' }); }
const DATA = { short: rows, twelve: rows12 };
let cur = rows;
const row = () => ({ id: 'main', version: 1, nid: 5, orders: [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22', customer: 'Cairn Homes' })],
  settings: { lists: [{ id: 'L1', wb: 'W1', sheet: 'H1', name: 'House 1', project: 'Proj', saw: cur.filter(r => r.k === 'saw').length, fit: 1, wos: ['WO-1'], up: NOW }], listWBs: { W1: { project: 'Proj', sheets: { H1: cur } } } } });
(async () => {
  const browser = await H.chromium.launch();
  for (const [ds, data] of Object.entries(DATA)) { cur = data;
  for (const [w, h] of [[360, 740], [380, 800], [412, 915]]) {
    const tag = w + 'px/' + ds;
    const S = makeServer(row());
    const A = await open(browser, S, { now: NOW, role: 'saw', viewport: { width: w, height: h } });
    await A.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); });
    const m = await A.page.evaluate(() => {
      const out = [];
      document.querySelectorAll('tr').forEach(tr => {
        const t = tr.querySelector('[data-rt]'), n = tr.querySelector('[data-rna]'); if (!t || !n) return;
        const a = t.getBoundingClientRect(), b = n.getBoundingClientRect();
        out.push({ tW: a.width, tH: a.height, nW: b.width, nH: b.height, gap: b.left - a.right, tR: a.right, nL: b.left, nR: b.right });
      });
      const de = document.documentElement;
      const tbl = document.querySelector('.wl-tbl'); const tb = tbl && tbl.getBoundingClientRect();
      const panel = document.querySelector('.sn-wrap'); const pb = panel && panel.getBoundingClientRect();
      // what does a 9 mm fingertip (~34 CSS px) centred on the gap hit?
      const r0 = out[0]; const midX = (r0.tR + r0.nL) / 2;
      const tr = document.querySelector('[data-rna]').closest('tr').getBoundingClientRect();
      const y = (tr.top + tr.bottom) / 2;
      const hits = new Set(); for (let dx = -17; dx <= 17; dx += 1) { const e = document.elementFromPoint(midX + dx, y); if (e) { if (e.closest('[data-rt]')) hits.add('tick'); if (e.closest('[data-rna]')) hits.add('na'); } }
      let over = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === 'hidden') return; let p = e.parentElement, clipped = false; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { clipped = true; break; } p = p.parentElement; } if (r.right > innerWidth + 1) over.push((clipped ? 'CLIPPED ' : '') + e.tagName + '.' + (e.className || '') + ':' + Math.round(r.right) + ':' + (e.textContent || '').trim().slice(0, 30)); });
      const nT = document.querySelectorAll('.wl-tbl tr').length, nSec = document.querySelectorAll('.wl-sec').length;
      const snR = Math.max(0, ...[...document.querySelectorAll('.sn-box, .sn-box *')].map(e => e.getBoundingClientRect().right));
      return { over: over.slice(0, 6), nOver: over.length, nT, nSec, snR, rows: out.slice(0, 3), docW: de.scrollWidth, vw: innerWidth, tblR: tb && tb.right, tblW: tb && tb.width, panelW: pb && pb.width, gapHits: [...hits], wrapScroll: tbl && tbl.parentElement && getComputedStyle(tbl.parentElement).overflowX };
    });
    const r = m.rows[0];
    console.log(tag, JSON.stringify(m));
    rec(tag + ': tick ≥ 36 px and N/A ≥ 36 px tall', r.tH >= 36 && r.nH >= 36, JSON.stringify(r));
    rec(tag + ': gap between tick and N/A ≥ 16 px (≈ 4 mm)', r.gap >= 16, 'gap=' + r.gap.toFixed(1));
    console.log('INFO ' + tag + ': 34px (~5 mm) contact centred in the gap overlaps: ' + JSON.stringify(m.gapHits) + ' (Chrome picks one target; risk = mis-tap, not double tap)');
    rec(tag + ': page does not scroll sideways', m.docW <= m.vw + 1, 'scrollWidth=' + m.docW + ' vw=' + m.vw + ' table right=' + (m.tblR || 0).toFixed(0) + ' wrapper overflow-x=' + m.wrapScroll);
    rec(tag + ': whole cutting table visible (Material + Edging/Note not clipped by the card)', m.tblR <= w, 'table right edge=' + Math.round(m.tblR) + ' screen=' + w);
    rec(tag + ': sheets panel fits screen', m.panelW <= w, 'panel=' + m.panelW);
    rec(tag + ': sheets panel contents (long material names) inside the screen', m.snR <= w + 1, 'rightmost=' + Math.round(m.snR));
    rec(tag + ': no element sticks out past the screen edge (incl. clipped inside scroll boxes)', m.nOver === 0, m.nOver + ' e.g. ' + JSON.stringify(m.over));
    if (ds === 'twelve') rec(tag + ': all 12 sections rendered', m.nSec >= 12, 'sections=' + m.nSec + ' rows=' + m.nT);
    await A.page.screenshot({ path: (process.env.SHOT_DIR || require('os').tmpdir()) + '/sawstores-' + w + '-' + ds + '.png', fullPage: ds === 'twelve' }).catch(() => {});
    await A.close();
  }
  }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
