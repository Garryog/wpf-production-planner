// MERGE SEAM 3 + 4 (Tester, 25 Nov 2026): the cutting list window on the merged code and the new 🧱 Materials button in the PM's
// sequence window. Garry 25 Nov: Floor / Unit / Title / Customer READ-ONLY in the list window (1A); "✎ Project details" under
// More ▾ (2A); "PM should be able to add project materials in their window also".
// Fake Supabase only. Run: node tests/merge25/m3-list-window-materials.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const M = require('./m25lib.js');
const { X, H, sleep, rec, closeAll, asks, setid, click, save, donep, err, rows, liveFor, linesOf, fillSaw } = M;
const job = require('../list-window/lw.js').job; // the list window's own "what job is this" (m25lib.job reads a planner job)
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const jb = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s); return { ok: (q('#me-jbok') || {}).innerText || '', msg: (q('#me-jbm') || {}).innerText || '', wo: (q('#me-wo') || {}).value || '', picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick), mkp: !!q('#me-jmkp'), newwo: !!q('#me-ptitle') }; });
const fillJ = (p, f, u) => p.evaluate(({ f, u }) => { const s = (id, v) => { const e = document.getElementById(id); if (!e) return; e.value = v; e.dispatchEvent(new Event('input')); }; s('me-jf', f); s('me-ju', u); }, { f, u });
const find = async p => { await p.evaluate(() => document.getElementById('me-find').click()); await sleep(200); };
const matOpts = p => p.evaluate(() => { const s = document.querySelector('.me-ed select[data-mr$="|mat"]'); return s ? [...s.options].map(o => o.textContent) : []; });
(async () => {
  const browser = await H.chromium.launch(); const bag = [];
  try {
    const row = X.v2Row();
    row.orders.push(H.order({ wo: 'WO-8', customer: 'Aderrig Homes', floor: 'G', unit: '5', title: 'HOUSE TYPE A', dueDate: '2026-12-01', origDueDate: '2026-12-01' }));
    const S = X.makeServer(row);
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.F3.seedList(S, 'L2', { wos: ['WO-2'], name: 'House 14' });
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type C', list: { is_template: true, type_name: 'Type C', list_type: 'house' } });
    ['WO-3', 'WO-4', 'WO-1'].forEach((w, i) => X.seqRow(S, 'Q' + i, 'P1', { wo: w }));
    const t = await X.dev(browser, S, 'office'), p = t.page; M.watch(p, bag, 'OFFICE'); await asks(p);

    // ---------- 1. an existing list opened from the Lists page ----------
    await M.go(p, 'office', "tab='l'", 500);
    await p.evaluate(() => document.querySelector('[data-lhedit="L2"]').click()); await sleep(900);
    const info = await p.evaluate(() => { const w = document.getElementById('me-woinfo'); return { txt: w ? w.innerText.replace(/\s+/g, ' ') : '', boxes: w ? [...w.querySelectorAll('input,textarea,select')].filter(e => !e.disabled && !e.readOnly && e.type !== 'hidden').length : -1, woe: document.querySelectorAll('.me-ed [data-woe]').length }; });
    rec('1a list window on WO-2: Floor 1 · Unit 14 · title · customer shown as READ-ONLY text (no boxes to type in)', info.boxes === 0 && info.woe === 0 && /Floor 1/.test(info.txt) && /14/.test(info.txt) && /Aderrig Homes/.test(info.txt), JSON.stringify(info));
    const sp0 = await p.evaluate(() => { const b = document.getElementById('me-spec'), m = document.getElementById('me-more'); return { there: !!b, inMore: !!(b && m && m.contains(b)), moreOpen: !!(m && m.open) }; }); sp0.visible = await p.isVisible('#me-spec');
    rec('1b "✎ Project details" sits under More ▾ (not showing until More is opened)', sp0.there && sp0.inMore && !sp0.moreOpen && !sp0.visible, JSON.stringify(sp0));
    await p.evaluate(() => { document.querySelector('#me-more summary').click(); }); await sleep(150);
    const vis = await p.isVisible('#me-spec');
    await M.setv(p, '0|qty', '7'); // an unsaved change that must survive the detour
    await p.evaluate(() => document.getElementById('me-spec').click()); await sleep(700);
    const spd = await p.evaluate(() => { const b = document.getElementById('sp-body'); return { open: !!b, txt: b ? b.innerText.replace(/\s+/g, ' ').slice(0, 80) : '', ed: !!document.querySelector('.me-ed') }; });
    rec('1c More ▾ → ✎ Project details opens the spec sheet of Aderrig, the list window stays underneath', vis && spd.open && /Project details — Aderrig/.test(spd.txt) && spd.ed, JSON.stringify(spd));
    await p.evaluate(() => { const o = document.getElementById('sp-body').closest('.pod-ovl'); const x = o.querySelector('#pod-x,#sp-x,[data-spx]') || [...o.querySelectorAll('button')].find(b => /Close/.test(b.textContent)); if (x) x.click(); }); await sleep(400);
    const back = await p.evaluate(() => ({ spec: !!document.getElementById('sp-body'), ed: !!document.querySelector('.me-ed'), qty: (document.querySelector('.me-ed [data-mr="0|qty"]') || {}).value }));
    rec('1d closing the spec sheet goes back to the list with the unsaved change still there', !back.spec && back.ed && back.qty === '7', JSON.stringify(back));
    await save(p, 1600);
    let dn = await donep(p);
    rec('1e Save → "Saved ✓"', !!dn && /Saved/.test(dn.h), JSON.stringify(dn && [dn.h, dn.l]) + ' err:' + await err(p));
    await closeAll(p);

    // ---------- 2. a project with NO materials (Lucan): 🧱 Project materials adds one first time ----------
    await p.evaluate(() => openListEditor(null, 'WO-6')); await sleep(900);
    const j6 = await job(p);
    const noMat = await p.evaluate(() => /no materials yet/.test(document.querySelector('.me-ed').innerText));
    rec('2a new list from WO-6 (Lucan): window on WO-6, "This project has no materials yet" shown', j6.hwo === 'WO-6' && noMat, JSON.stringify([j6.hwo, j6.pjro, noMat]));
    await click(p, 'me-mats'); await sleep(500);
    await p.evaluate(() => { const n = document.getElementById('mt-new-n'); n.value = '18mm MFC Lucan Oak'; n.dispatchEvent(new Event('input')); document.getElementById('mt-add').click(); }); await sleep(900);
    const m1 = await p.evaluate(() => ({ msg: (document.getElementById('mt-msg') || {}).textContent || '', rows: [...document.querySelectorAll('[data-mtn]')].map(e => e.value) }));
    rec('2b 🧱 Project materials → ＋ Add: the material is added at the first press', m1.rows.includes('18mm MFC Lucan Oak') && !m1.msg && S.db.t.project_materials.filter(m => m.project_id === 'P2' && m.name === '18mm MFC Lucan Oak').length === 1, JSON.stringify(m1));
    await p.evaluate(() => { const o = document.getElementById('mt-body').closest('.pod-ovl'); (o.querySelector('#pod-x') || o.querySelector('#mt-x2')).click(); }); await sleep(500);
    let mo = await matOpts(p);
    rec('2c back in the list: the Material drop-down offers it', mo.some(x => /18mm MFC Lucan Oak/.test(x)), JSON.stringify(mo));
    await fillSaw(p, 0, 'Side', '2', '720', '560', '18mm MFC Lucan Oak');
    await save(p, 1800); dn = await donep(p);
    const l6 = liveFor(S, 'WO-6');
    rec('2d Save → "Saved ✓", one list on WO-6 under Lucan with the row', !!dn && /Saved/.test(dn.h) && l6.length === 1 && l6[0].project_id === 'P2' && linesOf(S, l6[0].id).some(x => x.part === 'Side' && /Lucan Oak/.test(x.material)), JSON.stringify([dn && dn.h, l6.map(l => l.project_id), await err(p)]));
    await closeAll(p);

    // ---------- 3. Start from… a template, then an Excel file ----------
    await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
    await p.evaluate(() => { const d = document.getElementById('me-start'); d.open = true; d.dispatchEvent(new Event('toggle')); document.getElementById('me-instpl').click(); }); await sleep(500);
    const tp = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const b = o.querySelector('[data-itt="T1"]'); if (!b) return 'no template T1 offered: ' + o.innerText.slice(0, 120); b.click(); return 'ok'; }); await sleep(900);
    await p.evaluate(() => { const hk = document.getElementById('it-hok'); if (hk) hk.click(); }); await sleep(400);
    let rs = (await rows(p)).filter(r => !r.hdr && r.item);
    rec('3a Start from… → 📐 A template… → Type C: its rows are in the window', tp === 'ok' && rs.length >= 4 && rs.some(r => r.item === 'Top'), tp + ' ' + JSON.stringify(rs.map(r => r.item)));
    await save(p, 1800); dn = await donep(p);
    rec('3b …Save → "Saved ✓" on WO-3', !!dn && /Saved/.test(dn.h) && liveFor(S, 'WO-3').length === 1, JSON.stringify([dn && dn.h, await err(p)]));
    await closeAll(p);
    await p.evaluate(() => openListEditor(null, 'WO-4')); await sleep(900);
    await p.evaluate(() => { const d = document.getElementById('me-start'); d.open = true; });
    await p.setInputFiles('#me-xlfile', { name: 'T09-13 utility.xlsx', mimeType: 'application/octet-stream', buffer: xlsx({ Utility: [['Project', 'Aderrig', null, 'Date', '12/11/2026'], ['Floor', 'T09', 'Unit', '13', 'WO', 'WO-4'], ['Title', 'HOUSE TYPE C UTILITY'], COLS, ['Side', 2, 720, 560, 'MFC White', '1mm ABS'], ['Shelf', 3, 864, 500, 'MFC White'], ['Hinge', 8]] }) }); await sleep(1400);
    await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); if (o && !o.querySelector('.me-ed')) { const b = [...o.querySelectorAll('button')].find(x => /Use|Import|OK|Continue/.test(x.textContent)); if (b) b.click(); } }); await sleep(400);
    rs = (await rows(p)).filter(r => !r.hdr && r.item); const j4 = await job(p);
    rec('3c Start from… → 📥 An Excel file (simple sheet, 3 parts): the rows land, the window stays on WO-4', rs.length === 3 && rs[0].item === 'Side' && rs[0].L === '720' && j4.hwo === 'WO-4', JSON.stringify([rs, j4.hwo, await err(p)]).slice(0, 300));
    await save(p, 1800); dn = await donep(p);
    rec('3d …Save → "Saved ✓" on WO-4', !!dn && /Saved/.test(dn.h) && liveFor(S, 'WO-4').length === 1, JSON.stringify([dn && dn.h, await err(p), (window => 0)()]));
    await closeAll(p);

    // ---------- 4. WO look-up by project + floor + unit ----------
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(600);
    await fillJ(p, 'G', '5'); await find(p); let s = await jb(p);
    rec('4a one match (Floor G · Unit 5) → WO-8 filled in, "✓ Matched"', s.wo === 'WO-8' && /Matched/.test(s.ok), JSON.stringify(s));
    await p.evaluate(() => { const b = document.getElementById('me-jnot'); if (b) b.click(); }); await sleep(200);
    await p.evaluate(() => { tab = 'l'; }); await closeAll(p);
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(600);
    await fillJ(p, 'T09', '14'); await find(p); s = await jb(p);
    rec('4b not sure (T09 · 14: the shipped job is left out, WO-2 is "Floor 1 · Unit 14") → nothing filled in blindly: a pick with "not sure" and "None of these — make a P-number…"', !s.wo && s.picks.join() === 'WO-2' && /not sure/.test(s.msg) && /None of these — make a P-number/.test(s.msg), JSON.stringify(s));
    await fillJ(p, 'Z9', '99'); await find(p); s = await jb(p);
    rec('4c none (Floor Z9 · Unit 99) → "No Cienapps work order found…" + "Make a P-number instead…"', !s.wo && /No Cienapps work order found/.test(s.msg) && s.mkp, JSON.stringify(s));
    await fillJ(p, 'T09', 'Mr Murphy'); await find(p); s = await jb(p);
    rec('4d odd Unit text ("Mr Murphy") → not stuck: a message and a "Make a P-number instead…" button', !s.wo && s.mkp && s.msg.length > 20, JSON.stringify(s));
    await click(p, 'me-jmkp'); await sleep(400); s = await jb(p);
    const pf = await p.evaluate(() => ({ t: (document.getElementById('me-ptitle') || {}).value, f: (document.getElementById('me-pfloor') || {}).value, u: (document.getElementById('me-punit') || {}).value, c: (document.getElementById('me-pcust') || {}).value }));
    rec('4e "Make a P-number instead…" → the new-job boxes open with the Floor and Unit already typed carried over', s.newwo && pf.f === 'T09' && pf.u === 'Mr Murphy', JSON.stringify(pf));
    await setid(p, 'me-ptitle', 'HOUSE FOR MR MURPHY'); await setid(p, 'me-pdue', '2026-12-04');
    await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White');
    const nm = await p.evaluate(() => { const n = document.getElementById('me-name'); if (n && !n.value) { n.value = 'Murphy house'; n.dispatchEvent(new Event('input')); } return n ? n.value : null; });
    await save(p, 2200); dn = await donep(p);
    const pj = await p.evaluate(() => DB.orders.filter(o => /^P-/.test(o.wo)).map(o => ({ wo: o.wo, f: o.floor, u: o.unit, t: o.title, due: o.dueDate, c: o.customer })));
    const pl = pj.length ? liveFor(S, pj[0].wo) : [];
    rec('4f Save → ONE P-number job for the house (floor, unit, title, due, customer) with its list', !!dn && /Saved/.test(dn.h) && pj.length === 1 && pj[0].f === 'T09' && pj[0].u === 'Mr Murphy' && pj[0].due === '2026-12-04' && pl.length === 1, JSON.stringify([dn && dn.h, pj, pl.length, await err(p), nm]));
    await closeAll(p);
    // the P-number job reaches the PM's sequence candidates and the Deliveries/board dates like any job
    await M.go(p, 'office', "tab='b'", 400);
    const pd = pj.length ? await M.dq(p, pj[0].wo) : [];
    rec('4g the P-number job is on the Capacity Board with its due date', pd.some(x => x.f === 'due' && x.v === '2026-12-04'), JSON.stringify(pd));
    // several matches → pick
    await p.evaluate(() => openListEditor(null, '', 'P1')); await sleep(600);
    await fillJ(p, 'T09', '13'); await find(p); s = await jb(p);
    rec('4h several (T09 · 13 → WO-3 and WO-4, both have a list now) → not filled blindly: a pick list or "already has a list"', !s.wo || s.picks.length > 0 || /list/.test(s.msg), JSON.stringify(s));
    await closeAll(p);
    rec('office: no JavaScript errors in the list window', !bag.length, JSON.stringify(bag).slice(0, 500));

    // ---------- 5. 🧱 Materials (n) in the sequence window, per role ----------
    const n0 = S.db.t.project_materials.filter(m => m.project_id === 'P1').length;
    for (const role of ['pm', 'office', 'prod', 'design', 'pre', 'dash']) {
      const b0 = bag.length;
      await p.evaluate(() => localStorage.setItem('wpfMe_pm', 'John Burke')); await M.go(p, role, role === 'pm' ? "pmTab='seq'" : '', 500);
      if (role !== 'pm') { await p.evaluate(() => seqOpen('P1')); await sleep(600); }
      const b = await p.evaluate(() => { const r = document.querySelector('.seq-ovl') || document.getElementById('seq-pg'); const x = r && r.querySelector('[data-matsopen]'); return { seq: !!r, btn: !!x, txt: x ? x.textContent : '', vis: !!(x && x.offsetParent) }; });
      const cnt = S.db.t.project_materials.filter(m => m.project_id === 'P1' && m.active !== false).length;
      rec('5 ' + role + ': the sequence window has "🧱 Materials (' + cnt + ')"', b.seq && b.btn && b.vis && new RegExp('Materials \\(' + cnt + '\\)').test(b.txt), JSON.stringify(b));
      if (b.btn) { await p.evaluate(() => (document.querySelector('.seq-ovl [data-matsopen]') || document.querySelector('#seq-pg [data-matsopen]')).click()); await sleep(600); }
      const name = 'Board from ' + role;
      const add = await p.evaluate(async name => { const n = document.getElementById('mt-new-n'); if (!n) return { err: 'Materials window did not open' }; n.value = name; n.dispatchEvent(new Event('input')); document.getElementById('mt-add').click(); await new Promise(r => setTimeout(r, 900)); return { msg: (document.getElementById('mt-msg') || {}).textContent || '', rows: [...document.querySelectorAll('[data-mtn]')].map(e => e.value), pin: !!document.querySelector('#rpin-role') }; }, name);
      rec('5 ' + role + ': button opens the Materials window and ＋ Add saves "' + name + '" (no PIN asked)', !add.err && !add.pin && (add.rows || []).includes(name) && S.db.t.project_materials.some(m => m.project_id === 'P1' && m.name === name), JSON.stringify(add).slice(0, 300));
      await p.evaluate(() => { const o = document.getElementById('mt-body') && document.getElementById('mt-body').closest('.pod-ovl'); if (o) (o.querySelector('#pod-x') || o.querySelector('#mt-x2')).click(); }); await sleep(600);
      const after = await p.evaluate(() => { const r = document.querySelector('.seq-ovl') || document.getElementById('seq-pg'); const x = r && r.querySelector('[data-matsopen]'); return { seq: !!r, rows: r ? r.querySelectorAll('tr[data-seqr]').length : 0, txt: x ? x.textContent : '' }; });
      rec('5 ' + role + ': after closing Materials the sequence is still there (3 rows), no error', after.seq && after.rows === 3 && bag.length === b0, JSON.stringify([after, bag.slice(b0)]));
      rec('5 ' + role + ': …and the button now reads "🧱 Materials (' + (cnt + 1) + ')"', new RegExp('\\(' + (cnt + 1) + '\\)').test(after.txt), after.txt);
      await closeAll(p);
    }
    for (const role of ['driver', 'floor', 'saw', 'stores']) {
      await M.go(p, role, '', 400);
      const r = await p.evaluate(async () => { const out = { any: document.querySelectorAll('#app [data-matsopen]').length }; try { seqOpen('P1'); } catch (e) { out.err = String(e); } await new Promise(r => setTimeout(r, 500));
        const w = document.querySelector('.seq-ovl') || document.getElementById('seq-pg'); out.seq = !!w; out.btn = w ? w.querySelectorAll('[data-matsopen]').length : 0;
        const f = document.createElement('button'); f.dataset.matsopen = 'P1'; document.body.appendChild(f); f.click(); await new Promise(r => setTimeout(r, 400)); f.remove(); out.forced = !!document.getElementById('mt-body'); out.toast = (document.getElementById('toast') || {}).textContent || ''; return out; });
      rec('5 ' + role + ': no 🧱 Materials button (screen or sequence window); a forced press is refused', r.any === 0 && r.btn === 0 && !r.forced && !r.err, JSON.stringify(r));
      await closeAll(p);
    }
    rec('5 nothing was added by the read-only roles', S.db.t.project_materials.filter(m => m.project_id === 'P1').length === n0 + 6, String(S.db.t.project_materials.filter(m => m.project_id === 'P1').length - n0));
    // a material the PM added shows in the list window's drop-down for that project
    await M.go(p, 'office', "tab='l'", 400);
    await p.evaluate(() => openListEditor(null, 'WO-1')); await sleep(300); await closeAll(p);
    await p.evaluate(() => document.querySelector('[data-lhedit="L1"]').click()); await sleep(900);
    mo = await matOpts(p);
    rec('5 the PM\'s material ("Board from pm") is in the list window\'s Material drop-down for Aderrig', mo.some(x => /Board from pm/.test(x)), JSON.stringify(mo).slice(0, 300));
    // …and on another PC that was already open (after its next poll)
    await closeAll(p);
    rec('no JavaScript errors anywhere in this file', !bag.length && !(S.errors || []).length, JSON.stringify(bag.concat(S.errors || [])).slice(0, 500));
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  finally { await browser.close(); }
  M.finish();
})();
