// Tester attack ROUND 2 (list window, 12 Nov): an OLD live screen (origin/main = what is in use today) left open while the
// new window works. Round 1 covered a plain list + a P-number job surviving the old screen's plan save. This round:
//  1. the record of dropped P-number twins (settings.pMerged — new in this release, unknown to the old code) after the old
//     screen saves the plan;
//  2. a RICH list made in the new window (heading, unit block, stores row, edging 2, notes, list name, type) opened, changed in
//     one place and saved by the old screen — is anything else on it lost or changed?
//  3. the old screen, loaded before, makes a second list on the same WO (it never asks) → the new Lists page flags it.
// Fake Supabase only; old code read with "git show origin/main:index.html". Run: node tests/list-window/attack2-oldscreen.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, save, donep, err, job, rows, liveFor, linesOf, snap } = L;
const waitSave = p => p.evaluate(async () => { for (let i = 0; i < 60 && typeof SAVING !== 'undefined' && SAVING; i++) await new Promise(r => setTimeout(r, 100)); });

(async () => {
  const browser = await H.chromium.launch();
  try {
    const html = A.gitShow('origin/main') || A.gitShow('main');
    if (!html) { rec('old code readable with git show', false); X.finish(); return; }
    const S = X.makeServer(X.v2Row());
    // a dropped P-number twin, as "Keep one…" records it on the new screen
    S.row.settings.pMerged = [{ at: '2026-10-21T09:00:00.000Z', by: 'Op', wo: 'P-1002', into: 'P-1001', why: 'two P-numbers for one house', job: H.order({ wo: 'P-1002', customer: 'Aderrig Homes', floor: 'T50', unit: '1', title: 'HOUSE 1' }) }];
    const old = await A.openOld(browser, S, html);
    await old.page.evaluate(async () => { try { if (typeof lsReset === 'function') lsReset(); if (typeof lsLoad === 'function') await lsLoad(); } catch (e) {} });
    const nw = await X.dev(browser, S, 'office'), p = nw.page; await asks(p);

    // ---- 1. pMerged after the old screen saves ----
    const sv = await old.page.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-2'); o.notes = 'old screen note'; try { sched(); } catch (e) {} await saveDB(); await new Promise(r => setTimeout(r, 1500)); return !!DB.saveFailed; });
    await sleep(600);
    rec('1 set-up: the old screen\'s plan save went through', (S.row.orders.find(o => o.wo === 'WO-2') || {}).notes === 'old screen note', JSON.stringify(sv));
    rec('[MEDIUM] 1: the kept copy of a dropped P-number (settings.pMerged — "a full copy is kept in the planner\'s settings") survives the OLD screen\'s save', Array.isArray(S.row.settings.pMerged) && S.row.settings.pMerged.length === 1, JSON.stringify(S.row.settings.pMerged || null).slice(0, 160));
    // …and once the new screen saves again, is it back (from its own memory)?
    await p.evaluate(async () => { await loadDB(); const o = DB.orders.find(x => x.wo === 'WO-4'); o.notes = 'new screen note'; sched(); await saveDB(); }); await sleep(1200); await waitSave(p);
    rec('(info) 1: …after the NEW screen reloads and saves, settings.pMerged is ' + (Array.isArray(S.row.settings.pMerged) && S.row.settings.pMerged.length ? 'there' : 'still gone'), Array.isArray(S.row.settings.pMerged) && S.row.settings.pMerged.length === 1);

    // ---- 2. a rich list from the new window, edited by the old screen ----
    await p.evaluate(() => { window.__confirm = true; openListEditor(null, 'WO-3'); }); await sleep(900);
    await setid(p, 'me-name', 'Rich list — O\'Grady "B"');
    await p.evaluate(() => { const m = document.getElementById('me-more'); m.open = true; const s = document.getElementById('me-type'); s.value = 'kitchen'; s.dispatchEvent(new Event('change')); });
    // the rows come in through Start from… → An Excel file (heading, saw rows with Edging 2 + notes, a stores row)
    const XLSX = require(require('path').join(__dirname, '..', '..', 'xlsx.full.min.js'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'],
      ['Carcass'], ['Side', 2, 720, 560, 'MFC White', '1mm ABS', '', 'grain ↑'], ['Fillers & kickers'], ['Filler', 3, 720, 100, 'MFC White', '1mm ABS', '2mm ABS', 'scribe 10mm'], ['Blum hinge 110°', 8]]), 'Rich');
    await p.setInputFiles('#me-xlfile', { name: 'rich.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })) }); await sleep(1000);
    await setid(p, 'me-name', 'Rich list — O\'Grady "B"');
    await save(p, 2200); await closeAll(p); await waitSave(p);
    const lid = (liveFor(S, 'WO-3')[0] || {}).id;
    const before = lid ? linesOf(S, lid).map(x => ({ ...x })) : [];
    const lBefore = lid ? { ...S.db.t.lists.find(l => l.id === lid) } : null;
    rec('2 set-up: the new window saved a list on WO-3 with a heading, 2 saw rows (one with Edging 2 + note) and a stores row', !!lid && before.length >= 4 && before.some(x => x.kind === 'hdr') && before.some(x => x.edging2 === '2mm ABS'), JSON.stringify(before.map(x => [x.kind, x.part, x.qty, x.edging, x.edging2, x.note].join('|'))));
    // the OLD screen opens it and changes ONE quantity (the Side 2 → 4), saves
    const oe = await old.page.evaluate(async id => { try { if (typeof lsReset === 'function') { lsReset(); await lsLoad(); } openListEditor(id); await new Promise(r => setTimeout(r, 1000));
      const q = [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].find(e => e.value === 'Side'); if (!q) return 'no Side row on the old screen';
      const i = q.dataset.mr.split('|')[0], e = document.querySelector('.me-ed [data-mr="' + i + '|qty"]'); e.value = '4'; e.dispatchEvent(new Event('input'));
      document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2500)); return 'ok ' + ((document.getElementById('me-err') || {}).textContent || ''); } catch (e) { return 'error ' + e.message; } }, lid);
    const after = lid ? linesOf(S, lid) : [], lAfter = lid ? S.db.t.lists.find(l => l.id === lid) : null;
    const side = after.find(x => x.part === 'Side');
    rec('2: the OLD screen opened the new list, changed Side 2 → 4 and saved', /^ok/.test(oe) && side && String(side.qty) === '4', JSON.stringify([oe, side && side.qty]));
    const fields = ['kind', 'part', 'length_mm', 'width_mm', 'material', 'edging', 'edging2', 'note', 'section', 'unit_qty'];
    const lost = [];
    before.forEach(b => { const a = after.find(x => x.part === b.part && x.kind === b.kind); if (!a) { lost.push(b.part + ': GONE'); return; } fields.forEach(f => { const v1 = b[f] == null ? '' : String(b[f]), v2 = a[f] == null ? '' : String(a[f]); if (v1 !== v2) lost.push(b.part + '.' + f + ': ' + JSON.stringify(v1) + ' → ' + JSON.stringify(v2)); });
      if (b.part !== 'Side' && String(a.qty) !== String(b.qty)) lost.push(b.part + '.qty ' + b.qty + ' → ' + a.qty); });
    rec('[HIGH] 2: …every OTHER row keeps its kind, size, material, both edgings and note (nothing lost by the old screen)', !lost.length && after.length === before.length, JSON.stringify(lost.concat(after.length !== before.length ? ['rows ' + before.length + ' → ' + after.length] : [])));
    const lf = ['name', 'list_type', 'project_id', 'wos', 'no_cut', 'no_fit'].filter(f => JSON.stringify(lBefore && lBefore[f]) !== JSON.stringify(lAfter && lAfter[f]));
    rec('2: …the list keeps its name (with O\'Grady "B"), type, project, work order', !lf.length, JSON.stringify(lf.map(f => f + ': ' + JSON.stringify(lBefore[f]) + ' → ' + JSON.stringify(lAfter[f]))));
    await p.evaluate(async id => { lsReset(); await lsLoad(); openListEditor(id); }, lid); await sleep(1000);
    const j = await job(p), rr = await rows(p);
    rec('2: the new window opens it again: WO-3, the heading still a heading, Side qty 4', j.hwo === 'WO-3' && rr.some(r => r.hdr) && rr.some(r => r.item === 'Side' && r.qty === '4'), JSON.stringify([j.hwo, rr.map(r => (r.hdr ? '#' : '') + r.item + ':' + r.qty)]));
    await closeAll(p);

    // ---- 3. the old screen (loaded earlier) makes a second list on WO-3 ----
    const o3 = await old.page.evaluate(async () => { try { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); openListEditor(null, 'WO-3'); await new Promise(r => setTimeout(r, 900));
      const set = (k, v) => { const e = document.querySelector('.me-ed [data-mr="' + k + '"]'); if (!e) return false; e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); return true; };
      set('0|item', 'Old screen part'); set('0|qty', '1'); set('0|L', '500'); set('0|W', '300'); set('0|mat', 'MFC White');
      const w = document.getElementById('me-wo'); if (w && !w.value) { w.value = 'WO-3'; w.dispatchEvent(new Event('change')); }
      document.getElementById('me-save').click(); await new Promise(r => setTimeout(r, 2500)); return 'ok ' + ((document.getElementById('me-err') || {}).textContent || ''); } catch (e) { return 'error ' + e.message; } });
    const two = liveFor(S, 'WO-3');
    rec('3 set-up: the OLD screen saved a second list on WO-3 without asking (it has no such question) — ' + two.length + ' live lists', two.length === 2, JSON.stringify([o3, two.map(l => l.name)]));
    await p.evaluate(async () => { lsReset(); await lsLoad(); showTab('l'); }); await sleep(800);
    const tg = await p.evaluate(() => [...document.querySelectorAll('.lh-two')].map(x => x.textContent));
    if (two.length === 2) rec('3: the new Cutting Lists page flags it on both rows: "⚠ 2 lists on WO-3"', tg.filter(x => /2 lists on WO-3/.test(x)).length === 2, JSON.stringify(tg));
    rec('no page errors on the new screen', !(S.errors || []).length, JSON.stringify(S.errors));
    rec('(info) page errors on the old screen: ' + (S.oldErrors || []).length, !(S.oldErrors || []).length, JSON.stringify(S.oldErrors));
    await old.close(); await nw.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
