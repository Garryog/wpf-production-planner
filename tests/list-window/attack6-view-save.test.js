// Tester attack ROUND 6 (17 Nov) on Garry's "check the cutting list View button is working in all scenarios" — part 1:
// "👁 View the list" on the Saved ✓ panel (#me-dview → ov.remove(); lsViewDlg(l.id)) after every kind of save: a new list on a
// known WO, a WO found from Floor / Unit, a P-number, an edited list (Rev 2 must show the NEW rows), Ctrl+S, a × Multiply block
// with sub-headings (View = the saved TOTALS), stores-only, saw-only, Bought in, 80 rows, long names, a material not on the
// project, HTML in names, "Make new list from this", Save as template, waiting to be checked, archived meanwhile, the reply lost,
// offline; pressing View twice; Esc / outside / ✕; Print (pop-up allowed and blocked). Fake Supabase only.
// Run: node tests/list-window/attack6-view-save.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, asks, setv, setid, click, fillSaw, donep, err, rows, liveFor, linesOf } = L;
const PROC = '5. WORK ORDER PROCESSED';
const M = 'MFC White', HB = 'Blum hinge';
const EVIL = '<img src=x onerror="window.__xss=1">';
const LONG = 'Tall larder unit end panel — left hand, scribed to wall, with 2 × 32 mm system holes both edges and a 6 mm groove for the back panel (check drawing D-114 rev C)';
const ord = (wo, floor, unit, title, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
// what the top View window shows
const vinfo = p => p.evaluate(() => {
  const os = [...document.querySelectorAll('.pod-ovl')], o = os[os.length - 1]; if (!o) return { n: 0 };
  const b = o.querySelector('.pod-in') || o, tb = o.querySelector('table.wl-tbl');
  const rr = tb ? [...tb.querySelectorAll('tbody tr')].map(tr => tr.classList.contains('wl-sec') ? { h: tr.innerText.trim() } : { item: (tr.cells[0] || {}).innerText, qty: ((tr.cells[1] || {}).innerText || '').trim() }) : [];
  const rect = id => { const e = o.querySelector('#' + id); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
  return { n: os.length, isView: !!o.querySelector('#lv-print'), ed: !!document.querySelector('.me-ed'), head: (b.firstElementChild || {}).innerText || '', rows: rr, txt: o.innerText, print: !!o.querySelector('#lv-print'), chk: !!o.querySelector('[data-vchk="1"]'), unchk: !!o.querySelector('[data-vchk="0"]'),
    close: rect('pod-x'), pr: rect('lv-print'), side: b.scrollWidth - b.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, sh: b.scrollHeight, ch: b.clientHeight, xss: !!window.__xss, vw: innerWidth, vh: innerHeight };
});
const parts = v => (v.rows || []).filter(r => !r.h).map(r => String(r.item).replace(/^CHANGED\s+|^NEW\s+/, '') + ':' + r.qty);
const dbParts = (S, id) => linesOf(S, id).filter(x => x.kind !== 'hdr' && x.status !== 'na').map(x => x.part + ':' + (x.qty == null ? '' : x.qty));
const sameSet = (a, b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
const newOn = async (p, wo, pid) => { await closeAll(p); await p.evaluate(({ wo, pid }) => { window.__asked = []; window.__confirm = true; openListEditor(null, wo, pid || ''); }, { wo, pid }); await sleep(1100); };
const openL = async (p, id) => { await closeAll(p); await p.evaluate(id => { window.__asked = []; window.__confirm = true; openListEditor(id); }, id); await sleep(1200); };
const firstRow = async p => (await rows(p)).findIndex(r => !r.hdr);
const saveP = async (p, ms) => { await click(p, 'me-save'); await sleep(ms || 2600); };
const pressView = async p => { const r = await p.evaluate(() => { const b = document.getElementById('me-dview'); if (!b) return 'no View button'; b.click(); return 'ok'; }); await sleep(900); return r; };
const recToasts = p => p.evaluate(() => { window.__toasts = []; if (!window.__tw) { window.__tw = 1; const T = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return T.apply(this, arguments); }; } });
const printHtml = p => p.evaluate(() => { window.__doc = ''; const o = window.open; window.open = () => ({ document: { write: h => { window.__doc += h; }, close: () => {} } }); try { const b = document.getElementById('lv-print'); if (b) b.click(); } finally { window.open = o; } const d = document.createElement('div'); d.innerHTML = window.__doc.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<\/td>/g, ' </td>'); return d.textContent; });
const lastToast = p => p.evaluate(() => (window.__toasts || []).slice(-1)[0] || '');
// full check after a save: panel there → View → the list as saved
async function viewAfterSave(p, S, id, tag, extra) {
  const dn = await donep(p);
  const r = await pressView(p); const v = await vinfo(p);
  const want = id ? dbParts(S, id) : [];
  const ok = !!dn && r === 'ok' && v.n === 1 && v.isView && !v.ed && (!id || sameSet(parts(v), want));
  rec((extra || '') + tag + ' → Saved panel → 👁 View the list opens ONE View window with exactly the saved rows/quantities', ok,
    JSON.stringify([dn && dn.h, r, v.n, v.isView, parts(v).slice(0, 12), want.slice(0, 12)]));
  return { dn, v };
}

(async () => {
  const browser = await H.chromium.launch();
  try {
    const r = X.v2Row();
    r.orders.push(ord('WO-N1', '1', '10', 'APT 10 KITCHEN'), ord('WO-FU', '2', '20', 'APT 20 KITCHEN'), ord('WO-E1', '3', '30', 'APT 30 KITCHEN'), ord('WO-E2', '3', '31', 'APT 31 KITCHEN'), ord('WO-CS', '4', '40', 'APT 40 KITCHEN'),
      ord('WO-X1', '5', '50', 'HOUSE 50'), ord('WO-ST', '6', '60', 'APT 60'), ord('WO-SW', '6', '61', 'APT 61'), ord('WO-BI', '6', '62', 'APT 62'), ord('WO-80', '6', '63', 'APT 63'),
      ord('WO-LN', '6', '64', 'APT 64'), ord('WO-MT', '6', '65', 'APT 65'), ord('WO-EV', '6', '66', 'APT 66'), ord('WO-MN', '6', '67', 'APT 67'), ord('WO-TP', '6', '68', 'APT 68'),
      ord('WO-AR', '6', '69', 'APT 69'), ord('WO-RL', '6', '70', 'APT 70'), ord('WO-OF', '6', '71', 'APT 71'), ord('WO-2X', '6', '72', 'APT 72'), ord('WO-ES', '6', '73', 'APT 73'), ord('WO-PR', '6', '74', 'APT 74'));
    const S = X.makeServer(r);
    D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    D.insert(S.db, 'project_materials', { id: 'MK1', project_id: 'PK', name: M, kind: 'sheet' });
    D.insert(S.db, 'project_materials', { id: 'MK2', project_id: 'PK', name: HB, kind: 'other' });
    const pk = { list: { project_id: 'PK' } };
    X.F3.seedList(S, 'LE', Object.assign({ wos: ['WO-E1'], name: 'Edit me', lines: [['saw', 'Side', '2', 720, 560, M, '', ''], ['saw', 'Top', '1', 1200, 560, M, '', ''], ['fit', 'Hinge', '8', null, null, HB, '', '']] }, pk));
    X.F3.seedList(S, 'LE2', { wos: ['WO-E2'], name: 'Sent edit me', list: { project_id: 'PK', locked: true, sent_at: '2026-10-21T08:00:00Z' }, lines: [['saw', 'Side', '2', 720, 560, M, '', ''], ['saw', 'Top', '1', 1200, 560, M, '', ''], ['fit', 'Hinge', '8', null, null, HB, '', '']] });
    X.F3.seedList(S, 'LMX', { wos: ['WO-MT'], name: 'Odd material', list: { project_id: 'PK' }, lines: [['saw', 'Odd panel', '1', 700, 500, 'Egger Oak H1145 (not on project)', '', '']] });
    X.F3.seedList(S, 'LX', Object.assign({ wos: ['WO-X1'], name: 'Floors', lines: [['hdr', 'Floor 1', '2', null, null, null, '', ''], ['saw', 'Side', '4', 720, 560, M, '', '', { unit_qty: '2' }],
      ['hdr', 'Floor 2', '3', null, null, null, '', ''], ['saw', 'Top', '3', 1200, 560, M, '', '', { unit_qty: '1' }],
      ['hdr', 'Stores items', null, null, null, null, '', '', { section: 'Floor 2' }], ['fit', 'Hinge', '24', null, null, HB, '', '', { unit_qty: '8' }],
      ['hdr', 'Extras', null, null, null, null, '', ''], ['fit', 'Glue', '2', null, null, HB, '', '']] }, pk));
    X.F3.seedList(S, 'L80', Object.assign({ wos: ['WO-80'], name: 'Eighty rows', lines: Array.from({ length: 80 }, (_, i) => ['saw', 'Part ' + (i + 1), String(1 + (i % 4)), 300 + i, 200 + i, M, '', '']) }, pk));
    X.F3.seedList(S, 'LMO', Object.assign({ wos: ['WO-MN'], name: 'Old to copy', lines: [['saw', 'Old side', '2', 720, 560, M, '', ''], ['fit', 'Old hinge', '4', null, null, HB, '', '']] }, pk));
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p); await recToasts(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });

    // 1. a NEW list on a known WO
    try {
      await newOn(p, 'WO-N1', 'PK'); const i = await firstRow(p); await fillSaw(p, i, 'Base side', '2', '720', '560', M); await sleep(150);
      await saveP(p); const id = (liveFor(S, 'WO-N1')[0] || {}).id;
      const { v } = await viewAfterSave(p, S, id, 'S1 new list on WO-N1');
      rec('S1 …the View header names the list and says Rev 1', /Rev 1/.test(v.head) && /WO-N1|Base side/.test(v.txt), v.head);
      rec('S1 …🖨 Print and Close are there', v.print && !!v.close, JSON.stringify([v.print, v.close]));
    } catch (e) { rec('S1 ran', false, e.stack); }
    await closeAll(p);

    // 2. no WO: project + Floor / Unit → the WO found
    try {
      await newOn(p, '', 'PK'); await fillSaw(p, 0, 'Side', '2', '720', '560', M); await sleep(200);
      await p.click('#me-jf'); await p.keyboard.type('2'); await p.keyboard.press('Tab'); await p.keyboard.type('20');
      await p.click('#me-save'); await sleep(2600); if (!(await donep(p))) { await saveP(p); }
      const id = (liveFor(S, 'WO-FU')[0] || {}).id;
      rec('S2 set-up: list saved on WO-FU from Floor 2 · Unit 20', !!id, JSON.stringify([await err(p), liveFor(S, 'WO-FU').length]));
      await viewAfterSave(p, S, id, 'S2 WO found from Floor/Unit');
    } catch (e) { rec('S2 ran', false, e.stack); }
    await closeAll(p);

    // 3. a P-number list
    try {
      const pn = () => S.row.orders.filter(o => /^P-\d+$/.test(o.wo)).map(o => o.wo).concat(...[]);
      const before = await p.evaluate(() => DB.orders.filter(o => /^P-\d+$/.test(o.wo)).map(o => o.wo));
      await newOn(p, '', 'PK'); await setid(p, 'me-jf', '9'); await setid(p, 'me-ju', '99'); await setid(p, 'me-jt', 'APT 99 KITCHEN'); await click(p, 'me-find'); await sleep(600);
      if (await p.evaluate(() => !!document.getElementById('me-jmkp'))) await click(p, 'me-jmkp'); else await click(p, 'me-jnone'); await sleep(600);
      await setid(p, 'me-pdue', '2026-12-10'); await setid(p, 'me-pval', '1500'); await setid(p, 'me-phrs', '6');
      await fillSaw(p, 0, 'P side', '2', '720', '560', M); await sleep(200); await saveP(p, 3000);
      const after = await p.evaluate(() => DB.orders.filter(o => /^P-\d+$/.test(o.wo)).map(o => o.wo)); const pw = after.find(w => !before.includes(w));
      const id = pw ? (liveFor(S, pw)[0] || {}).id : null;
      rec('S3 set-up: P-number list saved (' + pw + ')', !!id, JSON.stringify([pw, await err(p)]));
      const { v } = await viewAfterSave(p, S, id, 'S3 P-number list');
      rec('S3 …View shows the P-number list name', !!pw && v.txt.includes(pw), v.head);
    } catch (e) { rec('S3 ran', false, e.stack); }
    await closeAll(p);

    // 4. an EXISTING list edited: Side 2 → 5, Top deleted, Shelf added → Rev 2 shows the NEW rows
    try {
      await openL(p, 'LE'); let rw = await rows(p);
      const si = rw.findIndex(x => x.item === 'Side'); await setv(p, si + '|qty', '5'); await sleep(150);
      const ti = (await rows(p)).findIndex(x => x.item === 'Top'); await p.evaluate(ti => document.querySelector('.me-ed [data-mrx="' + ti + '"]').click(), ti); await sleep(300);
      await click(p, 'me-addsaw'); await sleep(300); rw = await rows(p); const ni = rw.length - 1;
      await fillSaw(p, ni, 'Shelf', '3', '560', '500', M); await sleep(150);
      await saveP(p, 3000);
      const dn = await donep(p);
      rec('S4 set-up: edited (not yet sent, so still Rev ' + (S.db.t.lists.find(l => l.id === 'LE') || {}).rev + ') list saved', !!dn, JSON.stringify([dn && dn.h, dbParts(S, 'LE'), await err(p)]));
      const { v } = await viewAfterSave(p, S, 'LE', 'S4 edited list');
      rec('[HIGH] S4 …View shows Side 5, Shelf 3 and NO Top (the deleted row is not shown from the old copy)', /Rev 1/.test(v.head) && parts(v).includes('Side:5') && parts(v).includes('Shelf:3') && !parts(v).some(x => /^Top:/.test(x)) && !parts(v).includes('Side:2'), JSON.stringify([v.head, parts(v)]));
      await closeAll(p);
      // the same on a list already SENT (locked): the edit makes Rev 2
      await openL(p, 'LE2'); const s2 = (await rows(p)).findIndex(x => x.item === 'Side'); await setv(p, s2 + '|qty', '5'); await sleep(150);
      const t2 = (await rows(p)).findIndex(x => x.item === 'Top'); await p.evaluate(ti => document.querySelector('.me-ed [data-mrx="' + ti + '"]').click(), t2); await sleep(300);
      await saveP(p, 3000); const dn2 = await donep(p);
      rec('S4b set-up: a SENT list edited → panel says "Rev 2 is with the Saw & Stores"', !!dn2 && /Rev 2/.test(dn2.h), JSON.stringify([dn2 && dn2.h, await err(p)]));
      const { v: v2 } = await viewAfterSave(p, S, 'LE2', 'S4b sent list edited (Rev 2)');
      rec('[HIGH] S4b …View says Rev 2, Side 5, NO Top', /Rev 2/.test(v2.head) && parts(v2).includes('Side:5') && !parts(v2).some(x => /^Top:/.test(x)), JSON.stringify([v2.head, parts(v2)]));
    } catch (e) { rec('S4 ran', false, e.stack); }
    await closeAll(p);

    // 5. Save with Ctrl+S
    try {
      await newOn(p, 'WO-CS', 'PK'); const i = await firstRow(p); await fillSaw(p, i, 'Ctrl S side', '2', '720', '560', M); await sleep(150);
      await p.focus('.me-ed [data-mr="' + i + '|qty"]'); await p.keyboard.press('Control+s'); await sleep(2800);
      await viewAfterSave(p, S, (liveFor(S, 'WO-CS')[0] || {}).id, 'S5 saved with Ctrl+S');
    } catch (e) { rec('S5 ran', false, e.stack); }
    await closeAll(p);

    // 6. a × Multiply block with sub-headings: Floor 2 × 3 → × 4, View = TOTALS (Top 4, Hinge 32) as the saw sheet / stores see them
    try {
      await openL(p, 'LX'); await setv(p, '2|units', '4'); await sleep(250); await saveP(p, 3000);
      const { v } = await viewAfterSave(p, S, 'LX', 'S6 × Multiply list (Floor 2 × 3 → × 4)');
      rec('S6 …View shows the TOTALS: Side 4 (2 per × 2), Top 4 (1 × 4), Hinge 32 (8 × 4), Glue 2', ['Side:4', 'Top:4', 'Hinge:32', 'Glue:2'].every(x => parts(v).includes(x)), JSON.stringify(parts(v)));
      const hs = (v.rows || []).filter(x => x.h).map(x => x.h);
      rec('S6 …the headings show: "Floor 1 – 2 units", "Floor 2 – 4 units", the sub-heading "Stores items" and "Extras"', hs.some(h => /Floor 1.*2 units/.test(h)) && hs.some(h => /Floor 2.*4 units/.test(h)) && hs.some(h => /Stores items/.test(h)) && hs.some(h => /Extras/.test(h)), JSON.stringify(hs));
      const saw = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = listTableHTML(lsList('LX'), 'saw'); return [...d.querySelectorAll('tbody tr:not(.wl-sec)')].map(tr => tr.cells[0].innerText + ':' + tr.cells[1].innerText.trim()); });
      rec('S6 …the saw sheet for the same list shows the same saw totals as View (Side 4, Top 4)', saw.length === 2 && saw.some(x => /^Side.*:4$/.test(x)) && saw.some(x => /^Top.*:4$/.test(x)), JSON.stringify(saw));
    } catch (e) { rec('S6 ran', false, e.stack); }
    await closeAll(p);

    // 7. stores-only, saw-only, bought in
    try {
      await newOn(p, 'WO-ST', 'PK'); let i = await firstRow(p);
      await setv(p, i + '|item', 'Hinge pack'); await setv(p, i + '|qty', '6'); await setv(p, i + '|mat', HB); await sleep(150);
      await saveP(p, 3000); if (!(await donep(p))) { const e = await err(p); rec('(info) S7a stores-only first Save said: ' + e, true); await saveP(p, 3000); }
      await viewAfterSave(p, S, (liveFor(S, 'WO-ST')[0] || {}).id, 'S7a stores-only list');
      await closeAll(p);
      await newOn(p, 'WO-SW', 'PK'); i = await firstRow(p); await fillSaw(p, i, 'Saw only side', '2', '720', '560', M); await sleep(150);
      await saveP(p, 3000); if (!(await donep(p))) await saveP(p, 3000);
      await viewAfterSave(p, S, (liveFor(S, 'WO-SW')[0] || {}).id, 'S7b saw-only list');
      await closeAll(p);
      await newOn(p, 'WO-BI', 'PK'); i = await firstRow(p); await fillSaw(p, i, 'Saw part', '2', '720', '560', M);
      await click(p, 'me-addsaw'); await sleep(250); const j = (await rows(p)).length - 1;
      await setv(p, j + '|item', 'Worktop (bought in)'); await setv(p, j + '|qty', '1');
      await p.evaluate(j => { const e = document.querySelector('.me-ed [data-mbuy="' + j + '"]'); if (e) { e.checked = true; e.dispatchEvent(new Event('change')); } }, j); await sleep(200);
      await saveP(p, 3000);
      const id = (liveFor(S, 'WO-BI')[0] || {}).id; const dn = await donep(p); await pressView(p); const v = await vinfo(p);
      rec('S7c list with a Bought in row → View shows the Bought in row "Worktop (bought in)" and the saw part', !!dn && v.n === 1 && /Worktop \(bought in\)/.test(v.txt) && /Saw part/.test(v.txt), JSON.stringify([dn && dn.h, dbParts(S, id), parts(v)]));
      rec('(info) S7c Bought in row in View: ' + JSON.stringify((v.rows || []).find(x => /bought/.test(x.item || ''))), true);
    } catch (e) { rec('S7 ran', false, e.stack); }
    await closeAll(p);

    // 8. 80 rows: edit one, save, View → all 80 there, Close reachable by scrolling the window
    try {
      await openL(p, 'L80'); await setv(p, '79|qty', '9'); await sleep(150); await saveP(p, 3500);
      const { v } = await viewAfterSave(p, S, 'L80', 'S8 80-row list');
      rec('S8 …View shows all 80 rows (Part 80 = 9)', parts(v).length === 80 && parts(v).includes('Part 80:9'), String(parts(v).length));
      const reach = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(), b = o.querySelector('.pod-in'); b.scrollTop = b.scrollHeight; const x = o.querySelector('#pod-x').getBoundingClientRect(), pr = o.querySelector('#lv-print').getBoundingClientRect();
        const hx = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return { x: Math.round(x.bottom), pr: Math.round(pr.bottom), vh: innerHeight, hit: !!hx && hx.id === 'pod-x', scrolls: b.scrollHeight > b.clientHeight }; });
      rec('S8 …the window scrolls and, scrolled down, Close and 🖨 Print are on screen and clickable', reach.hit && reach.x <= reach.vh && reach.pr <= reach.vh, JSON.stringify(reach));
      rec('(info, [LOW]) S8 on an 80-row list Close / 🖨 Print are only at the BOTTOM (not pinned) — the person must scroll past 80 rows to find them', true, JSON.stringify({ before: v.close, vh: v.vh }));
    } catch (e) { rec('S8 ran', false, e.stack); }
    await closeAll(p);

    // 9. long names + a material not on the project's list + HTML in names
    try {
      await newOn(p, 'WO-LN', 'PK'); const i = await firstRow(p);
      await setid(p, 'me-name', 'Aderrig Phase 2 Block C Type B — House 22 — with a very long name typed by the office for the drawing reference A-114-C rev 4'); await sleep(100);
      await fillSaw(p, i, LONG, '2', '2400', '600', M); await setv(p, i + '|note', 'Fit after the worktop template is back from site — ask John before cutting, and check the 6 mm groove'); await sleep(150);
      await saveP(p, 3000); const id = (liveFor(S, 'WO-LN')[0] || {}).id;
      const { v } = await viewAfterSave(p, S, id, 'S9a long names');
      rec('S9a …no sideways scroll on the page (1280 px)', v.doc <= 0, JSON.stringify([v.side, v.doc]));
      await closeAll(p);
      await openL(p, 'LMX'); const k = (await rows(p)).findIndex(x => x.item === 'Odd panel'); await setv(p, k + '|qty', '2'); await sleep(250);
      await saveP(p, 3000); if (!(await donep(p))) { rec('(info) S9b a material not on the project: first Save said "' + (await err(p)) + '"', true); await saveP(p, 3000); }
      const id2 = (liveFor(S, 'WO-MT')[0] || {}).id; const dn = await donep(p); await pressView(p); const v2 = await vinfo(p);
      rec('S9b an old list whose material is not on the project list, qty changed → saved, View shows the row with that material', !!dn && v2.n === 1 && /Egger Oak H1145/.test(v2.txt) && /Odd panel\t2/.test(v2.txt), JSON.stringify([dn && dn.h, id2 && dbParts(S, id2), v2.txt && v2.txt.slice(0, 200)]));
      await closeAll(p);
      await newOn(p, 'WO-EV', 'PK'); const e0 = await firstRow(p);
      await setid(p, 'me-name', EVIL + " O'Grady \"x\" 🏠"); await fillSaw(p, e0, EVIL + ' <b>bold</b>', '1', '500', '400', M); await setv(p, e0 + '|note', '<script>window.__xss=2</script>'); await sleep(150);
      await saveP(p, 3000); const dn3 = await donep(p); await pressView(p); const v3 = await vinfo(p);
      rec('S9c HTML / quotes / emoji in the list name, item and note → View shows them as text, nothing runs', !!dn3 && v3.n === 1 && !v3.xss && /<img src=x/.test(v3.txt) && /O'Grady/.test(v3.txt) && /<script>/.test(v3.txt), JSON.stringify([dn3 && dn3.h, v3.xss, v3.txt && v3.txt.slice(0, 200)]));
    } catch (e) { rec('S9 ran', false, e.stack); }
    await closeAll(p);

    // 10. "Make new list from this" (old list LMO) → save → panel says the old list was archived → View shows the NEW list
    try {
      await p.evaluate(() => { window.__toasts = []; window.__asked = []; window.__confirm = true;
        openListEditor(null, 'WO-MN', 'PK', { rows: lsEditRows('LMO'), name: 'New from old', from: { id: 'LMO', name: lsList('LMO').name, sig: lsOldSig('LMO'), lines: lsOldLines('LMO') }, note: 'Copied' }); }); await sleep(1200);
      const i = (await rows(p)).findIndex(x => x.item === 'Old side'); await setv(p, i + '|qty', '6'); await sleep(150);
      await saveP(p, 3200); const dn = await donep(p);
      const nl = S.db.t.lists.find(l => l.name === 'New from old' && !l.archived);
      rec('S10 set-up: the new list saved, the old list archived, the panel mentions the old list', !!nl && !!dn && /Old to copy|old list|archived/i.test(dn.l), JSON.stringify([dn && dn.h, dn && dn.l, !!(S.db.t.lists.find(l => l.id === 'LMO') || {}).archived]));
      await pressView(p); const v = await vinfo(p);
      rec('S10 …👁 View shows the NEW list (New from old, Old side 6), not the archived old one', v.n === 1 && /New from old/.test(v.head) && parts(v).includes('Old side:6'), JSON.stringify([v.head, parts(v)]));
    } catch (e) { rec('S10 ran', false, e.stack); }
    await closeAll(p);

    // 11. 📐 Save as template from the list window, then Save the list → View
    try {
      await newOn(p, 'WO-TP', 'PK'); const i = await firstRow(p); await fillSaw(p, i, 'Tpl side', '2', '720', '560', M); await setid(p, 'me-name', 'House TP'); await sleep(150);
      const has = await p.evaluate(() => !!document.getElementById('me-astpl'));
      if (has) { await click(p, 'me-astpl'); await sleep(700); await p.evaluate(() => { const n = document.getElementById('at-name'); if (n) { n.value = 'Type TP'; n.dispatchEvent(new Event('input')); } const b = document.getElementById('at-ok'); if (b) b.click(); }); await sleep(1800); }
      const tpl = S.db.t.lists.find(l => l.is_template && l.type_name === 'Type TP');
      rec('S11 set-up: Drawing office "📐 Save as template" from the list window made template "Type TP"', has && !!tpl, JSON.stringify([has, !!tpl, await lastToast(p)]));
      const still = await p.evaluate(() => !!document.querySelector('.me-ed') && document.querySelectorAll('.pod-ovl').length);
      rec('S11 …the list window is still open (one window) after saving the template', still === 1, String(still));
      await saveP(p, 3000);
      const { v } = await viewAfterSave(p, S, (liveFor(S, 'WO-TP')[0] || {}).id, 'S11 list saved after Save as template');
      rec('S11 …View shows the LIST (House TP), not the template', /House TP/.test(v.head) && !/Type TP/.test(v.head), v.head);
      await closeAll(p);
      if (tpl) { await openL(p, tpl.id); await p.evaluate(() => { window.__prompt = 'qty change'; }); const j = await firstRow(p); await setv(p, j + '|qty', '7'); await sleep(150); await saveP(p, 3000); await p.evaluate(() => { window.__prompt = 'Op'; });
        const { v: tv } = await viewAfterSave(p, S, tpl.id, 'S11b the template edited');
        rec('S11b …View of the template shows Rev 2 and Tpl side 7', /Rev 2/.test(tv.head) && parts(tv).includes('Tpl side:7'), JSON.stringify([tv.head, parts(tv)])); }
    } catch (e) { rec('S11 ran', false, e.stack); }
    await closeAll(p);

    // 12. archived on another screen while open → warning panel → View
    try {
      X.F3.seedList(S, 'LAR', Object.assign({ wos: ['WO-AR'], name: 'Archived meanwhile', lines: [['saw', 'Side', '2', 720, 560, M, '', '']] }, pk));
      await p.evaluate(async () => { await lsPoll(); }); await openL(p, 'LAR');
      S.db.t.lists.find(l => l.id === 'LAR').archived = true;
      await setv(p, '0|qty', '3'); await sleep(150); await saveP(p, 3000);
      const { dn, v } = await viewAfterSave(p, S, 'LAR', 'S12 archived on another screen');
      rec('S12 …the panel warned "archived on another screen"', !!dn && /archived on another screen/.test(dn.h), dn && dn.h);
      rec('(info) S12 View of the archived list shows no ✓ Check / says nothing about being archived: ' + (/archiv/i.test(v.txt) ? 'says archived' : 'NO archived note in View'), true);
    } catch (e) { rec('S12 ran', false, e.stack); }
    await closeAll(p);

    // 13. the reply is lost (the save landed) → what the person sees; then View
    try {
      await newOn(p, 'WO-RL', 'PK'); const i = await firstRow(p); await fillSaw(p, i, 'Lost reply side', '2', '720', '560', M); await sleep(150);
      S.dropReply = 1; await saveP(p, 4000); S.dropReply = 0;
      let dn = await donep(p); const e1 = await err(p);
      rec('(info) S13 reply lost: after the first Save the person sees ' + JSON.stringify(dn ? dn.h : e1), true);
      if (!dn) { await saveP(p, 3000); dn = await donep(p); }
      rec('S13 …after Save again: still ONE list on WO-RL', liveFor(S, 'WO-RL').length === 1, String(liveFor(S, 'WO-RL').length));
      if (dn) await viewAfterSave(p, S, (liveFor(S, 'WO-RL')[0] || {}).id, 'S13 after a lost reply');
      else rec('S13 a Saved panel (with View) is reached after the lost reply', false, await err(p));
    } catch (e) { rec('S13 ran', false, e.stack); }
    await closeAll(p);

    // 14. offline → no panel (nothing to view) → online Save → View
    try {
      await newOn(p, 'WO-OF', 'PK'); const i = await firstRow(p); await fillSaw(p, i, 'Offline side', '2', '720', '560', M); await sleep(150);
      S.offline3 = true; await saveP(p, 3500); const dn0 = await donep(p), e0 = await err(p); S.offline3 = false;
      rec('S14 offline Save → no Saved panel (no View of a list that is not saved), the window says so', !dn0 && /not saved|could not|offline|connection|may have/i.test(e0), JSON.stringify([dn0 && dn0.h, e0]));
      await saveP(p, 3500); await viewAfterSave(p, S, (liveFor(S, 'WO-OF')[0] || {}).id, 'S14 back online');
    } catch (e) { rec('S14 ran', false, e.stack); }
    await closeAll(p);

    // 15. View pressed twice fast; then Esc / outside click / ✕ and the next list window
    try {
      await newOn(p, 'WO-2X', 'PK'); const i = await firstRow(p); await fillSaw(p, i, 'Twice side', '2', '720', '560', M); await sleep(150); await saveP(p, 3000);
      await p.dblclick('#me-dview'); await sleep(800);
      let v = await vinfo(p);
      rec('[LOW] S15 "👁 View the list" DOUBLE-clicked with the mouse → ONE View window stays open (the 2nd click must not close it or open a 2nd)', v.n === 1 && v.isView, JSON.stringify([v.n, v.isView]));
      if (v.n !== 1) { await closeAll(p); await openL(p, (liveFor(S, 'WO-2X')[0] || {}).id); await setv(p, '0|qty', '5'); await sleep(150); await saveP(p, 3000); await pressView(p); v = await vinfo(p); }
      await p.keyboard.press('Escape'); await sleep(400); v = await vinfo(p);
      rec('[LOW] S15 Esc closes the View window (opened from the Saved panel)', v.n === 0, String(v.n));
      await closeAll(p);
      // outside click
      await openL(p, (liveFor(S, 'WO-2X')[0] || {}).id); await setv(p, '0|qty', '3'); await sleep(150); await saveP(p, 3000); await pressView(p);
      await p.mouse.click(3, 3); await sleep(500); v = await vinfo(p);
      rec('S15 clicking the grey area outside the View window closes it, nothing left on screen', v.n === 0, String(v.n));
      // ✕ Close
      await openL(p, (liveFor(S, 'WO-2X')[0] || {}).id); await setv(p, '0|qty', '4'); await sleep(150); await saveP(p, 3000); await pressView(p);
      await p.evaluate(() => document.querySelector('.pod-ovl #pod-x').click()); await sleep(500); v = await vinfo(p);
      rec('S15 Close in the View window closes it, nothing left on screen', v.n === 0, String(v.n));
      // the app still works: the next list window opens and Esc closes it; no stray overlay; the Lists page is drawn
      await p.evaluate(() => { openListEditor(null, 'WO-ES', 'PK'); }); await sleep(1100);
      const ok = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), n: document.querySelectorAll('.pod-ovl').length }));
      await p.keyboard.press('Escape'); await sleep(400);
      const ok2 = await p.evaluate(() => document.querySelectorAll('.pod-ovl').length);
      rec('S15 …afterwards the next list window opens normally (one window) and Esc closes it', ok.ed && ok.n === 1 && ok2 === 0, JSON.stringify([ok, ok2]));
    } catch (e) { rec('S15 ran', false, e.stack); }
    await closeAll(p);

    // 16. Print from the View: pop-up allowed → the list in the new tab; pop-up blocked → toast
    try {
      await openL(p, (liveFor(S, 'WO-N1')[0] || {}).id); await setv(p, '0|qty', '3'); await sleep(150); await saveP(p, 3000); await pressView(p);
      const ptxt = await printHtml(p);
      rec('S16 🖨 Print (pop-ups allowed) → the print page has the list: WO-N1 and "Base side" qty 3', /WO-N1/.test(ptxt) && /Base side[\s\S]{0,40}?\b3\b/.test(ptxt), ptxt.slice(0, 300));
      const vv = await vinfo(p); rec('S16 …the View window is still there after Print', vv.n === 1 && vv.isView, String(vv.n));
      await p.evaluate(() => { window.__open0 = window.open; window.open = () => null; window.__toasts = []; document.getElementById('lv-print').click(); window.open = window.__open0; }); await sleep(300);
      rec('S16 pop-up blocked → the toast "Pop-up blocked — allow pop-ups…"', /Pop-up blocked/.test(await lastToast(p)), await lastToast(p));
    } catch (e) { rec('S16 ran', false, e.stack); }
    await closeAll(p);

    // 17. phone 360 px: save → View → Close and Print on screen, nothing off the side
    try {
      const tp = await X.dev(browser, S, 'design', { viewport: { width: 360, height: 640 } }), pp = tp.page; await asks(pp);
      await pp.evaluate(async () => { lsReset(); await lsLoad(); }); await openL(pp, 'L80'); await setv(pp, '0|qty', '2'); await sleep(150); await saveP(pp, 3500);
      await pressView(pp); let v = await vinfo(pp);
      rec('S17 360 px: View of the 80-row list opens from the Saved panel', v.n === 1 && parts(v).length === 80, String(parts(v).length));
      rec('S17 360 px: no sideways scroll on the page', v.doc <= 0, JSON.stringify([v.doc, v.side]));
      const reach = await pp.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(), b = o.querySelector('.pod-in'); b.scrollTop = b.scrollHeight; b.scrollLeft = 0;
        const f = id => { const e = o.querySelector('#' + id), r = e.getBoundingClientRect(), h = document.elementFromPoint(Math.min(r.left + r.width / 2, innerWidth - 2), r.top + r.height / 2); return { l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), hit: !!h && (h === e || e.contains(h)) }; };
        return { x: f('pod-x'), pr: f('lv-print'), inner: b.scrollWidth - b.clientWidth, w: innerWidth, h: innerHeight }; });
      rec('[MEDIUM] S17 360 px: scrolled to the bottom, Close and 🖨 Print are fully on screen and tappable (not off to the right)', reach.x.hit && reach.pr.hit && reach.x.r <= reach.w && reach.pr.l >= 0 && reach.x.b <= reach.h, JSON.stringify(reach));
      rec('(info) S17 360 px: the View table scrolls sideways inside the window by ' + reach.inner + ' px', true);
      await pp.evaluate(() => document.querySelector('.pod-ovl #pod-x').click()); await sleep(400);
      rec('S17 360 px: Close tapped → gone', (await vinfo(pp)).n === 0);
      await tp.ctx.close().catch(() => {});
    } catch (e) { rec('S17 ran', false, e.stack); }

    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }

  // 18. "waiting to be checked" (Settings switch on): panel → View → ✓ Check inside View works for the Drawing office
  try {
    const r2 = X.v2Row({ listChk: true }); r2.orders.push(ord('WO-CK', '1', '1', 'APT 1'), ord('WO-CK2', '1', '2', 'APT 2'));
    const S2 = X.makeServer(r2);
    for (const role of ['design', 'office', 'prod', 'admin']) {
      const t2 = await X.dev(browser, S2, role), p2 = t2.page; await asks(p2); await recToasts(p2);
      await p2.evaluate(async () => { try { setWho('Ann'); } catch (e) {} lsReset(); await lsLoad(); window.prompt = m => /PIN/i.test(m) ? '9000' : 'Op'; });
      const wo = role === 'design' ? 'WO-CK' : 'WO-CK2';
      S2.db.t.lists.filter(l => (l.wos || []).includes(wo)).forEach(l => { l.archived = true; }); await p2.evaluate(async () => { lsReset(); await lsLoad(); });
      await newOn(p2, wo, 'P1'); const i = await firstRow(p2); await fillSaw(p2, i, 'Check me ' + role, '2', '720', '560', M); await sleep(150);
      await saveP(p2, 3200); const dn = await donep(p2);
      if (!dn) { rec('C ' + role + ': Saved panel after Save (role ' + role + ')', false, await err(p2)); await t2.ctx.close(); continue; }
      rec('C ' + role + ': panel says "waiting to be checked"', /waiting to be checked/.test(dn.h), dn.h);
      await pressView(p2); const v = await vinfo(p2);
      rec('C ' + role + ': View opens and shows "Not checked / waiting" and a ✓ Check button', v.n === 1 && v.chk, JSON.stringify([v.n, v.chk, v.txt.slice(0, 120)]));
      if (v.chk) { await p2.evaluate(() => { window.confirm = () => true; document.querySelector('[data-vchk="1"]').click(); }); await sleep(2500);
        const lid = (liveFor(S2, wo)[0] || {}).id, row = S2.db.t.lists.find(l => l.id === lid) || {};
        const n = await p2.evaluate(() => document.querySelectorAll('.pod-ovl').length);
        rec('C ' + role + ': ✓ Check pressed inside View → the list is checked in the database' + (role === 'office' ? ' (office: asked for the PIN)' : ''), !!row.checked_at, JSON.stringify([row.checked_at, row.checked_by, n, await lastToast(p2)]));
        rec('(info) C ' + role + ': after ✓ Check the View window ' + (n ? 'is still open (' + n + ')' : 'closed — the person is not shown the checked list again'), true); }
      await t2.ctx.close().catch(() => {});
    }
    rec('no page errors (checked lists)', !(S2.errors || []).length, JSON.stringify(S2.errors));
  } catch (e) { rec('C ran', false, e.stack); }
  await browser.close();
  X.finish();
})();
