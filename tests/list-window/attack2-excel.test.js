// Tester attack ROUND 2 (list window, 12 Nov): Excel through "Start from… → 📥 An Excel file…", focused on the JOB.
// The WPF template can carry Floor / Unit / WO cells. What happens when those cells disagree with the job the window was
// opened from (the Drawing office picked the wrong house's file)? And with no job yet, can the file pull in a job from
// ANOTHER project? Plus the real filled template fixture (tests/fixtures/xl-template-filled.xlsx).
// Fake Supabase only. Run: node tests/list-window/attack2-excel.test.js
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const XLSX = require(path.join(ROOT, 'xlsx.full.min.js'));
const L = require('./lw.js');
const { X, H, sleep, rec, closeAll, ed, asks, setid, click, save, donep, err, job, rows, liveFor, linesOf } = L;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
const feed = async (p, name, buf) => { await p.setInputFiles('#me-xlfile', { name, mimeType: 'application/octet-stream', buffer: buf }); await sleep(1100); };
const sheet = (job, parts) => [['Project', job.project || 'Aderrig', null, 'Date', '12/11/2026']].concat(job.floor != null || job.wo != null ? [['Floor', job.floor || '', 'Unit', job.unit || '', 'WO', job.wo || '']] : [], [['Title', job.title || '']], [COLS], parts);
const PARTS = [['Side', 2, 720, 560, 'MFC White', '1mm ABS', '', ''], ['Shelf', 3, 864, 500, 'MFC White'], ['Hinge', 8]];
const said = p => p.evaluate(() => ({ asked: (window.__asked || []).slice(), err: (document.getElementById('me-err') || {}).textContent || '', jb: (document.getElementById('me-jbm') || {}).innerText || '', ok: (document.getElementById('me-jbok') || {}).innerText || '',
  toast: [...document.querySelectorAll('.toast,#toast,.toasts *')].map(x => x.innerText).filter(x => !/^Imported \d+ row/.test(x)).join(' | ') }));

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    const openStart = () => p.evaluate(() => { const d = document.getElementById('me-start'); if (d) d.open = true; });

    // ---- E1: opened from WO-3 (Aderrig · T09 · 13); the file says WO-6 (Lucan · A1 · 4) ----
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-3'); }); await sleep(900); await openStart();
    await feed(p, 'Lucan A1-4.xlsx', xlsx({ 'A1 Unit 4': sheet({ project: 'Lucan', floor: 'A1', unit: '4', wo: 'WO-6', title: 'TYPE A KITCHEN' }, PARTS) }));
    let j = await job(p), s = await said(p), rs = await rows(p);
    rec('E1 set-up: the 3 rows of the file landed in the window', rs.filter(r => !r.hdr).length === 3, JSON.stringify(rs.map(r => r.item)));
    rec('E1: the window is still on WO-3 (never switched by the file)', j.hwo === 'WO-3' && j.wo === 'WO-3', JSON.stringify([j.hwo, j.wo]));
    const told = /WO-6|A1|Lucan|another (job|house)|file says|doesn.?t match|different/i.test(s.asked.join(' ') + ' ' + s.err + ' ' + s.toast + ' ' + s.jb);
    rec('[HIGH] E1: the file\'s cells say Lucan · Floor A1 · Unit 4 · WO-6 but the list is for WO-3 (Aderrig · T09 · 13) → the person is TOLD before saving (wrong house\'s file)', told, JSON.stringify(s).slice(0, 300));
    const nm = await p.evaluate(() => document.getElementById('me-name').value);
    await save(p, 2000);
    const l3 = liveFor(S, 'WO-3');
    rec('(info) E1: …Save anyway → saved on WO-3 under Aderrig with the Lucan file\'s rows, list name "' + nm + '" taken from the sheet', l3.length === 1 && l3[0].project_id === 'P1', JSON.stringify([l3.map(l => [l.name, l.project_id]), await err(p)]));
    rec('E1: nothing was put on WO-6 (the job named in the file)', liveFor(S, 'WO-6').length === 0);
    await closeAll(p);

    // ---- E2: same job in the file (control — must stay quiet) ----
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-4'); }); await sleep(900); await openStart();
    await feed(p, 'T09-13 utility.xlsx', xlsx({ 'Utility': sheet({ floor: 'T09', unit: '13', wo: 'WO-4', title: 'HOUSE TYPE C UTILITY' }, PARTS) }));
    s = await said(p);
    rec('E2: file cells agree with the job (WO-4 · T09 · 13) → no question, no red message', !s.asked.length && !/⚠|doesn.?t match|another/i.test(s.err), JSON.stringify(s).slice(0, 200));
    await closeAll(p);

    // ---- E3: same project, file has a different UNIT and no WO ----
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-3'); }); await sleep(900);
    await p.evaluate(() => { window.__confirm = false; }); // if it asks "rows already typed?" etc.
    await closeAll(p); await p.evaluate(() => { window.__confirm = true; window.__asked = []; openListEditor(null, 'WO-5'); }); await sleep(900);
    j = await job(p);
    if (!j.open) { await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-2'); }); await sleep(900); j = await job(p); }
    const curWo = j.hwo;
    await openStart();
    await feed(p, 'T09-99.xlsx', xlsx({ 'Unit 99': sheet({ floor: 'T09', unit: '99', wo: '', title: 'HOUSE TYPE Z' }, PARTS) }));
    s = await said(p);
    rec('[MEDIUM] E3: opened from ' + curWo + '; the file says Floor T09 · Unit 99 (another house on the same site) → the person is told', /99|another (job|house)|file says|doesn.?t match|different/i.test(s.asked.join(' ') + s.err + s.toast + s.jb), JSON.stringify(s).slice(0, 300));
    await closeAll(p);

    // ---- E4: NO job yet (Lists page ＋ New list on project Aderrig); the file names Lucan's WO-6 ----
    await p.evaluate(() => { window.__asked = []; openListEditor(null, '', 'P1'); }); await sleep(800); await openStart();
    await feed(p, 'Lucan A1-4.xlsx', xlsx({ 'A1 Unit 4': sheet({ project: 'Lucan', floor: 'A1', unit: '4', wo: 'WO-6', title: 'TYPE A KITCHEN' }, PARTS) }));
    await sleep(500);
    j = await job(p); s = await said(p);
    const pid4 = await p.evaluate(() => (document.getElementById('me-pid') || {}).value);
    rec('E4: a new list on project Aderrig; the file says Lucan\'s WO-6 → never silently WO-6 under Aderrig (either WO-6 with project Lucan, or not filled, or asked)', !(j.wo === 'WO-6' && pid4 === 'P1') || s.asked.length > 0, JSON.stringify({ wo: j.wo, pid: pid4, s }).slice(0, 400));
    if (await ed(p)) { await save(p, 2000); }
    const l6 = liveFor(S, 'WO-6');
    rec('[LOW] E4: …after OK to "WO-6 belongs to project Lucan — use it anyway?" the list is filed under project ADERRIG while its WO is Lucan\'s (the question does not say so)', l6.every(l => l.project_id !== 'P1'), JSON.stringify(l6.map(l => [l.id, l.project_id])));
    await closeAll(p);

    // ---- E4b: the same, answering Cancel → WO-6 not used ----
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; openListEditor(null, '', 'P1'); }); await sleep(800); await openStart();
    await feed(p, 'Lucan A1-4.xlsx', xlsx({ 'A1 Unit 4': sheet({ project: 'Lucan', floor: 'A1', unit: '4', wo: 'WO-6', title: 'TYPE A KITCHEN' }, PARTS) }));
    await sleep(500); j = await job(p);
    rec('E4b: …answering Cancel → WO-6 is not used, the rows stay', j.wo !== 'WO-6' && (await rows(p)).filter(r => !r.hdr).length === 3, JSON.stringify([j.wo, await p.evaluate(() => window.__asked)]));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---- E5: no job yet; the file names a WO that does not exist ----
    const nP = () => S.row.orders.filter(o => /^P-\d+$/.test(o.wo)).length;
    const p0 = nP();
    await p.evaluate(() => { window.__asked = []; openListEditor(null, '', 'P1'); }); await sleep(800); await openStart();
    await feed(p, 'mystery.xlsx', xlsx({ 'Mystery': sheet({ floor: 'T77', unit: '7', wo: 'WO-99999', title: 'HOUSE 7' }, PARTS) }));
    await sleep(500); j = await job(p); s = await said(p);
    rec('E5: file says WO-99999 (not in the planner) → no WO filled in, no P-number made by itself, the person is told', !j.wo && nP() === p0 && /No Cienapps|not found|isn.?t|no work order|WO-99999/i.test(s.jb + s.err + s.toast + s.asked.join(' ')), JSON.stringify({ wo: j.wo, s }).slice(0, 300));
    await closeAll(p);

    // ---- E6: the real filled WPF template (4 sheets: READ ME, House 1, House 18, Edging) ----
    const buf = fs.readFileSync(path.join(ROOT, 'tests/fixtures/xl-template-filled.xlsx'));
    const want = await p.evaluate(b64 => { const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const wb = XLSX.read(u8, { type: 'array', cellDates: true, sheetStubs: true });
      return wb.SheetNames.filter(sn => !lsSkipSheet(sn)).map(sn => { const g = lsSheetAoa(wb.Sheets[sn]), q = lsParseGrid(g.v, { formulas: g.f, sheet: sn }); return { sn, parts: q.rows.filter(r => r.k === 'part' && !r.info).length, all: q.rows.filter(r => !r.info).length, meta: q.meta }; }).filter(x => x.parts); }, buf.toString('base64'));
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-4'); }); await sleep(900); await openStart();
    await feed(p, 'xl-template-filled.xlsx', buf);
    const which = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return o && /Which sheet/.test(o.innerText) ? [...o.querySelectorAll('[data-ixs]')].map(b => b.innerText) : null; });
    rec('E6: the filled template → ' + (want.length > 1 ? '"Which sheet?" lists exactly the sheets with parts' : 'only ONE sheet has parts (' + want.map(w => w.sn) + ') so it goes straight in') + ', never READ ME / Edging', want.length > 1 ? !!which && which.length === want.length && !which.some(x => /READ ME|Edging/i.test(x)) : !which, JSON.stringify([which, want.map(w => w.sn)]));
    const pick = want.length > 1 ? want.findIndex(w => /18/.test(w.sn)) : 0;
    if (which && pick >= 0) { await p.evaluate(i => document.querySelector('[data-ixs="' + i + '"]').click(), pick); await sleep(700); }
    rs = await rows(p); j = await job(p);
    rec('E6: picked "' + (want[pick] || {}).sn + '" → its ' + (want[pick] || {}).all + ' rows in the window, WO-4 kept', pick >= 0 && rs.length === want[pick].all && j.hwo === 'WO-4', JSON.stringify([rs.length, j.hwo, want[pick] && want[pick].meta]));
    await save(p, 2200);
    const l4 = liveFor(S, 'WO-4');
    rec('E6: Save → one list on WO-4 with all ' + (want[pick] || {}).all + ' rows (headings included)', l4.length === 1 && linesOf(S, l4[0].id).length === (want[pick] || {}).all, JSON.stringify([l4.length, l4[0] && linesOf(S, l4[0].id).length, await err(p)]));
    await closeAll(p);
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
