// List-window release (plan docs/PLAN-list-window.md, build steps 6–8): the cutting-list window opened from a job shows the WO
// and the project as TEXT (no drop-downs, never "Pick the project"); the drop-downs only in a window opened with no WO; ONE
// "Start from…" choice on a new list (Standard blank list / A template… / An Excel file… / An old list…), asked first when rows
// were typed; Insert from template / Excel rows under More ▾; "Save as template" and History only for the Drawing office and
// Admin. Acceptance checks 1–10 as far as this release builds them (L9 / DD1 badge come later). Fake Supabase only — never the
// network. Run: node tests/listwin/lw1-window.test.js
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', 'xlsx.full.min.js'));
const X = require('./fixl.js');
const { H, D, rec, sleep } = X;
const COLS = ['Description', 'Qty', 'Length', 'Width', 'Material', 'Edging 1', 'Edging 2', 'Note'];
const xlsx = sheets => { const wb = XLSX.utils.book_new(); Object.entries(sheets).forEach(([n, a]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n)); return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })); };
function row() {
  const r = X.v2Row();
  r.orders.push(
    H.order({ wo: 'WO-30', customer: 'Aderrig Homes', floor: '2', unit: '30', title: 'HOUSE TYPE B', dueDate: '2026-11-13', origDueDate: '2026-11-13' }),
    H.order({ wo: 'WO-31', customer: 'Aderrig Homes', floor: '2', unit: '31', title: 'HOUSE TYPE B', dueDate: '', origDueDate: '' }),
    H.order({ wo: 'WO-32', customer: 'Aderrig Homes', floor: '2', unit: '32', title: 'ON HOLD ONE', dueDate: '2026-11-01', origDueDate: '2026-11-01', cienHold: true }),
    H.order({ wo: 'WO-33', customer: 'Aderrig Homes', floor: '2', unit: '33', title: 'HOUSE TYPE B', dueDate: '2026-10-22', origDueDate: '2026-10-22' }),
    H.order({ wo: 'WO-40', customer: 'Fresh Homes', floor: '1', unit: '5', title: 'KITCHEN', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-41', customer: 'Fresh Homes', floor: '1', unit: '6', title: 'KITCHEN', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-42', customer: 'Bad <img src=x onerror="window.__x=1"> Homes', floor: '1', unit: '7', title: 'KITCHEN <b>B</b>', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-43', customer: '', floor: '1', unit: '8', title: 'NO CUSTOMER', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  return r;
}
const closeAll = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const asks = p => p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return window.__confirm !== undefined ? window.__confirm : true; }; });
const setv = (p, k, v) => p.evaluate(({ k, v }) => { const e = document.querySelector('.me-ed [data-mr="' + k + '"]'); if (e.tagName === 'SELECT' && ![...e.options].some(o => o.value === v)) e.add(new Option(v, v)); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); }, { k, v });
const items = p => p.evaluate(() => [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].map(e => e.value));
const head = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { wol: (q('#me-wol') || {}).innerText || '', ptxt: (q('#me-ptxt') || {}).textContent || '', pid: (q('#me-ptxt') || { dataset: {} }).dataset.pid || '', dd: !!q('#me-pid'), wodd: !!q('#me-wo'),
    pm: (q('#me-pm') || {}).innerText || '', from: !!q('#me-from'), name: (q('#me-name') || {}).value, newp: !!q('#me-new'), text: (q('.me-top') || {}).innerText || '' }; });
const startFrom = (p, v) => p.evaluate(v => { const s = document.getElementById('me-from'); s.value = v; s.dispatchEvent(new Event('change')); }, v);
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    X.F3.seedList(S, 'T1', { name: 'Type B template', wos: [], lines: [['hdr', 'Kitchen', ''], ['saw', 'Gable', '2', 900, 560, 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B 3-bed' } });
    X.F3.seedList(S, 'OLDX', { wos: ['WO-2'], name: 'Kitchen Zebra Oak', lines: [['saw', 'Zebra side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Zebra top', '1', 1200, 560, 'MFC White', '', '']] });
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await asks(p);

    // ---- 1. from a job: WO, project, floor/unit/title shown; no drop-downs; rows; Save; "Saved ✓"; the saw sees it
    await p.evaluate(() => openListEditor(null, 'WO-33')); await sleep(500);
    let h = await head(p);
    rec('1: opened from a job — WO line "WO-33 · Aderrig Homes" with the due date (bold, plain text) "Due Thu 22 Oct · Wk 43"', /^WO-33 · Aderrig Homes\s+Due Thu 22 Oct · Wk 43$/.test(h.wol.trim()) && await p.evaluate(() => !!document.querySelector('#me-wol b.me-wodue')), JSON.stringify(h.wol));
    rec('1: the project is text ("Aderrig", from the WO\'s customer) — no Project drop-down, no Work order drop-down, no ＋ New P-number', h.ptxt === 'Aderrig' && h.pid === 'P1' && !h.dd && !h.wodd && !h.newp && /from the WO's customer/.test(h.pm), JSON.stringify(h));
    rec('1: never "Pick the project" with a WO known', !/Pick the project/i.test(await p.evaluate(() => document.querySelector('.me-ed').innerText)));
    const info = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#me-woinfo [data-woi]')].map(e => [e.dataset.woi, e.textContent.trim()])));
    rec('1: Floor / Unit / Title / Customer filled from the job (read-only)', info.Floor === '2' && info.Unit === '33' && info.Title === 'HOUSE TYPE B' && info.Customer === 'Aderrig Homes', JSON.stringify(info));
    rec('6: the list name is empty on open (not the unit number)', h.name === '', JSON.stringify(h.name));
    rec('6: an empty Qty box shows "Qty"', await p.evaluate(() => document.querySelector('.me-ed [data-mr="0|qty"]').placeholder === 'Qty'));
    await setv(p, '0|item', 'Side'); await setv(p, '0|qty', '2'); await setv(p, '0|L', '720'); await setv(p, '0|W', '560'); await setv(p, '0|mat', 'MFC White');
    await p.evaluate(() => { const n = document.getElementById('me-name'); n.value = 'Kitchen Quokka Walnut'; n.dispatchEvent(new Event('input')); });
    await p.evaluate(() => document.getElementById('me-save').click()); await sleep(900);
    const dn = await p.evaluate(() => { const d = document.querySelector('.me-dov'); return d ? { h: d.querySelector('#me-dok').textContent, ed: !!document.querySelector('.me-ed') } : null; });
    rec('1: Save → "Saved ✓ — list is with the Saw & Stores"', dn && /^Saved ✓ — list is with the Saw & Stores$/.test(dn.h) && !dn.ed, JSON.stringify(dn));
    const saved = S.db.t.lists.find(l => l.name === 'Kitchen Quokka Walnut');
    rec('1: saved on WO-33 in project Aderrig', saved && saved.wos.join() === 'WO-33' && saved.project_id === 'P1', JSON.stringify(saved && { w: saved.wos, p: saved.project_id }));
    await p.evaluate(() => document.getElementById('me-dclose').click()); await sleep(100);
    rec('1: Close shuts the "Saved ✓" panel', await p.evaluate(() => !document.querySelector('.pod-ovl')));
    {
      const sv = await X.dev(browser, S, 'saw'); await sleep(300);
      rec('1: the saw sees the new list', await sv.page.evaluate(() => /Kitchen Quokka Walnut/.test(document.body.innerText)), await sv.page.evaluate(() => document.body.innerText.slice(0, 300)));
      await sv.close();
    }

    // ---- 2. customer with no project → made once, from the customer; the second list for the same customer reuses it
    await p.evaluate(() => openListEditor(null, 'WO-40')); await sleep(900);
    h = await head(p);
    const fresh = S.db.t.projects.filter(x => x.name === 'Fresh Homes');
    rec('2: WO-40 (customer "Fresh Homes", no project) → project made from the customer, shown as text', fresh.length === 1 && h.pid === fresh[0].id && h.ptxt === 'Fresh Homes' && !h.dd, JSON.stringify([h, fresh.length]));
    await closeAll(p);
    await p.evaluate(() => openListEditor(null, 'WO-41')); await sleep(900);
    h = await head(p);
    rec('2: WO-41 (same customer) → the same project, not a second one', S.db.t.projects.filter(x => x.name === 'Fresh Homes').length === 1 && h.pid === fresh[0].id, JSON.stringify(h));
    await closeAll(p);
    // escaping: a customer / title with HTML in it
    await p.evaluate(() => openListEditor(null, 'WO-42')); await sleep(900);
    rec('WO line and project text escape the customer (no <img> injected)', await p.evaluate(() => !window.__x && !document.querySelector('.me-ed img') && /Bad <img/.test(document.getElementById('me-wol').innerText)));
    await closeAll(p);
    // fallback: a WO with no customer → the Project drop-down shows with a plain message (never "Pick the project")
    await p.evaluate(() => openListEditor(null, 'WO-43')); await sleep(600);
    h = await head(p);
    rec('fallback: WO with no customer → Project drop-down shown, "choose its project here" (not "Pick the project")', h.dd && !h.wodd && /no customer in Cienapps — choose its project here/.test(h.pm) && !/Pick the project/.test(h.pm), JSON.stringify(h));
    await p.evaluate(() => document.getElementById('me-save').click()); await sleep(100);
    rec('fallback: Save with no project says "Choose the project above"', await p.evaluate(() => /^Choose the project above/.test(document.getElementById('me-err').textContent)), await p.evaluate(() => document.getElementById('me-err').textContent));
    await closeAll(p);

    // ---- 3. no WO (＋ New list): Project ▾ first, then Work order ▾ of that project only, due order, shipped / on hold out, has a list
    await p.evaluate(() => { showTab('l'); render(); document.getElementById('lh-new').click(); }); await sleep(400);
    h = await head(p);
    rec('3: ＋ New list (no WO) → Project drop-down and Work order drop-down, no WO line', h.dd && h.wodd && !h.wol, JSON.stringify(h));
    await p.evaluate(() => { const s = document.getElementById('me-pid'); s.value = 'P1'; s.dispatchEvent(new Event('change')); }); await sleep(200);
    const opts = await p.evaluate(() => [...document.getElementById('me-wo').options].filter(o => o.value).map(o => o.textContent));
    const wos = opts.map(o => o.split(' · ')[0]);
    rec('3: only Aderrig\'s live jobs (no Lucan / Fresh Homes, no shipped WO-5, no on-hold WO-32)', wos.length && !wos.some(w => ['WO-6', 'WO-40', 'WO-41', 'WO-5', 'WO-32'].includes(w)) && wos.includes('WO-30'), JSON.stringify(opts));
    rec('3: earliest due first, no due date last', wos[0] === 'WO-1' || wos[0] === 'WO-2', JSON.stringify(wos));
    rec('3: …WO-31 (no due date) is last', wos[wos.length - 1] === 'WO-31' && /no due date/.test(opts[opts.length - 1]), JSON.stringify(opts.slice(-2)));
    rec('3: jobs with a list are marked "has a list" (WO-1, WO-2, WO-33)', opts.filter(o => /has a list/.test(o)).map(o => o.split(' · ')[0]).sort().join() === 'WO-1,WO-2,WO-33', JSON.stringify(opts));
    rec('4: no WO yet → the Floor / Unit / Title boxes and "Find the Cienapps WO" are there', await p.evaluate(() => !!document.querySelector('.me-ed #me-jb #me-find')));
    rec('9: a NEW list shows ONE "Start from" choice: Standard blank list / A template… / An Excel file… / An old list…', await p.evaluate(() => [...document.getElementById('me-from').options].map(o => o.textContent).join('|') === 'Standard blank list|A template…|An Excel file…|An old list…' && document.getElementById('me-from').value === 'std'));
    await closeAll(p);

    // ---- 9. Start from… fills the rows; after typing it asks first
    await p.evaluate(() => openListEditor(null, 'WO-30')); await sleep(500);
    rec('9: opened from a job: Start from shows "Empty list" first', await p.evaluate(() => document.getElementById('me-from').value === 'blank'));
    rec('7 (item 1): no "Insert from template" / "Import from Excel" buttons in the main bar — both under More ▾', await p.evaluate(() => {
      const bar = document.querySelector('.me-ed .me-bar'), more = document.getElementById('me-more');
      return !!more.querySelector('#me-instpl') && !!more.querySelector('#me-impxl') && ![...bar.querySelectorAll(':scope > button')].some(b => /template|Excel/i.test(b.textContent)); }));
    // A template… (nothing typed → not asked)
    await p.evaluate(() => { window.__asked = []; }); await startFrom(p, 'tpl'); await sleep(200);
    rec('9: A template… opens the project\'s templates', await p.evaluate(() => /Type B 3-bed/.test((document.querySelectorAll('.pod-ovl')[1] || {}).innerText || '')));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl')[1].querySelector('[data-itt="T1"]').click()); await sleep(500);
    let it = await items(p);
    rec('9: …its rows fill the list (heading + Gable + Hinge), nothing asked', it.join('|') === 'Kitchen|Gable|Hinge' && await p.evaluate(() => !window.__asked.length && document.getElementById('me-from').value === 'tpl'), JSON.stringify(it));
    // typed → An old list… asks first; Cancel keeps the rows
    await setv(p, '1|item', 'Gable typed');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await startFrom(p, 'old'); await sleep(200);
    it = await items(p);
    rec('9: rows typed → changing Start from asks first; Cancel keeps them (and no Find window)', await p.evaluate(() => window.__asked.length === 1 && /rows you typed are replaced/.test(window.__asked[0]) && document.querySelectorAll('.pod-ovl').length === 1) && it[1] === 'Gable typed' && await p.evaluate(() => document.getElementById('me-from').value === 'tpl'), JSON.stringify(it));
    // OK → Find old list: search by the free name, Use these rows
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await startFrom(p, 'old'); await sleep(200);
    const fo = await p.evaluate(() => { const d = document.querySelectorAll('.pod-ovl')[1]; const q = d.querySelector('#fo-q'); q.value = 'zebra oak'; q.oninput(); return [...d.querySelectorAll('[data-foc]')].map(b => b.dataset.foc + ':' + b.textContent); });
    rec('6: Find old list finds a list by its free name ("zebra oak"); the button says "Use these rows"', fo.length === 1 && /^OLDX:⧉ Use these rows$/.test(fo[0]), JSON.stringify(fo));
    await p.evaluate(() => document.querySelectorAll('.pod-ovl')[1].querySelector('[data-foc="OLDX"]').click()); await sleep(600);
    it = await items(p);
    rec('9: OK → An old list… — its rows replace this list\'s rows, in THIS window (still WO-30)', it.join('|') === 'Zebra side|Zebra top' && await p.evaluate(() => document.querySelectorAll('.me-ed').length === 1 && /^WO-30/.test(document.getElementById('me-wol').innerText) && document.getElementById('me-from').value === 'old'), JSON.stringify(it));
    rec('9: the old list is not changed', S.db.t.lists.find(l => l.id === 'OLDX').wos.join() === 'WO-2' && S.db.t.list_lines.filter(x => x.list_id === 'OLDX').length === 2);
    await p.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }); document.querySelector('.me-ed [data-mr="0|item"]').dispatchEvent(e); }); await sleep(150);
    rec('9: Ctrl+Z puts the typed rows back', (await items(p))[1] === 'Gable typed', JSON.stringify(await items(p)));
    // An Excel file… (asked first, then the sheet replaces the rows)
    await p.evaluate(() => { window.__asked = []; window.__confirm = true; });
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), startFrom(p, 'xl')]);
    await fc.setFiles({ name: 'house.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx({ 'House 30': [['Project', 'Aderrig'], COLS, ['Xl side', 2, 720, 560, 'MFC White'], ['Xl shelf', 3, 500, 300, 'MFC White']] }) });
    await sleep(700);
    it = await items(p);
    rec('9: An Excel file… — asked first, then the sheet\'s rows replace the list\'s rows', it.join('|') === 'Xl side|Xl shelf' && await p.evaluate(() => window.__asked.length === 1 && document.getElementById('me-from').value === 'xl'), JSON.stringify(it));
    // Standard blank list (asked: rows typed)
    await p.evaluate(() => { window.__asked = []; }); await startFrom(p, 'std'); await sleep(150);
    it = await items(p);
    rec('9: Standard blank list → the standard layout (house heading + Fillers and Kickers / Worktops / Stores items)', it[0] === 'House 30' && it.includes('Fillers and Kickers') && it.includes('Stores items') && await p.evaluate(() => window.__asked.length === 1), JSON.stringify(it));
    // More ▾ → 📥 Add rows from Excel… still ADDS at the bottom (a list in progress)
    await setv(p, '2|item', 'Kicker'); await setv(p, '2|qty', '1'); await setv(p, '2|L', '2400'); await setv(p, '2|W', '150'); await setv(p, '2|mat', 'MFC White');
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.getElementById('me-impxl').click())]);
    await fc2.setFiles({ name: 'more.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx({ S: [COLS, ['Added row', 1, 300, 300, 'MFC White']] }) });
    await sleep(600);
    it = await items(p);
    rec('More ▾ → Add rows from Excel… adds at the bottom, typed rows kept', it.includes('Kicker') && it[it.length - 1] === 'Added row', JSON.stringify(it));
    await closeAll(p);
    // Start from is not on an existing list, a template, or a copy
    await p.evaluate(() => openListEditor('L1')); await sleep(300);
    rec('9: an existing list has no Start from', await p.evaluate(() => !document.getElementById('me-from')));
    await p.evaluate(() => document.querySelector('[data-mecopy]') ? null : null); await closeAll(p);
    await p.evaluate(() => openListEditor('T1')); await sleep(300);
    rec('9: a template has no Start from (and no WO line)', await p.evaluate(() => !document.getElementById('me-from') && !document.getElementById('me-wol')));
    await closeAll(p);
    await p.evaluate(() => lsCopyToNew('OLDX', 'P1')); await sleep(500);
    rec('9: a list opened as a copy (Find old list → Copy to new list) has no Start from', await p.evaluate(() => !!document.querySelector('.me-ed') && !document.getElementById('me-from')));
    await closeAll(p);

    // ---- 6. a typed name is found in the template list (the find box shows with more than 6 templates)
    for (let i = 2; i <= 8; i++) X.F3.seedList(S, 'T' + i, { name: 'Tpl ' + i, wos: [], lines: [['saw', 'Part', '1', 500, 500, 'MFC White', '', '']], list: { is_template: true, list_type: 'kitchen', type_name: i === 5 ? 'Penguin Corner' : 'Type ' + i } });
    await p.evaluate(async () => { await lsPoll(); openListEditor(null, 'WO-30'); }); await sleep(400);
    await startFrom(p, 'tpl'); await sleep(200);
    const tf = await p.evaluate(() => { const d = document.querySelectorAll('.pod-ovl')[1], q = d.querySelector('#it-q'); if (!q) return 'no find box'; q.value = 'penguin'; q.oninput(); return [...d.querySelectorAll('[data-itq]')].filter(r => r.style.display !== 'none').map(r => r.querySelector('b').textContent); });
    rec('6: the template list finds a template by its name ("penguin")', JSON.stringify(tf) === '["Penguin Corner"]', JSON.stringify(tf));
    await closeAll(p);

    // ---- 7. ✕ Close: nothing typed → closes at once; typed → asks; a click outside does nothing
    await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-31'); }); await sleep(400);
    await p.evaluate(() => { const ov = document.querySelector('.pod-ovl'); ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); if (ov.onclick) ov.onclick({ target: ov }); }); await sleep(100);
    rec('7: a click on the grey area outside does nothing', await p.evaluate(() => !!document.querySelector('.me-ed')));
    await p.evaluate(() => document.getElementById('me-x0').click()); await sleep(100);
    rec('7: ✕ Close with nothing typed closes at once (nothing asked — the project set by the app is not "typed")', await p.evaluate(() => !document.querySelector('.me-ed') && !window.__asked.length), await p.evaluate(() => JSON.stringify(window.__asked)));
    await p.evaluate(() => openListEditor(null, 'WO-31')); await sleep(400);
    await setv(p, '0|item', 'Typed');
    await p.evaluate(() => { window.__asked = []; window.__confirm = false; document.getElementById('me-x0').click(); }); await sleep(100);
    rec('7: with a typed row ✕ Close asks; Cancel stays', await p.evaluate(() => !!document.querySelector('.me-ed') && window.__asked.length === 1 && /Close without saving/.test(window.__asked[0])));
    await p.evaluate(() => { window.__confirm = true; }); await closeAll(p);

    // ---- 8. "Save as template" / History: Drawing office and Admin only
    const tplBtns = async (role, admin) => {
      const d = await X.dev(browser, S, role);
      await d.page.evaluate(({ role, admin }) => { if (!admin) { localStorage.setItem('wpfPin_' + role, pins()[role]); localStorage.removeItem('wpfEditPin'); } else localStorage.setItem('wpfEditPin', pins().admin); /* an office screen opens a template only with the edit PIN (as today) */ }, { role, admin });
      await d.page.evaluate(() => openListEditor(null, 'WO-30')); await sleep(300);
      const a = await d.page.evaluate(() => !!document.getElementById('me-astpl'));
      await d.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); openListEditor('T1'); }); await sleep(300);
      const b = await d.page.evaluate(() => !!document.getElementById('me-hist'));
      await d.close(); return { a, b };
    };
    for (const role of ['saw', 'stores', 'pm', 'office', 'prod']) {
      const r = await tplBtns(role, false);
      rec('8: ' + role + ' (own PIN) never sees "Save as template" or 🕘 History', !r.a && !r.b, JSON.stringify(r));
    }
    {
      const r = await tplBtns('design', false);
      rec('8: Drawing office sees "Save as template" and 🕘 History', r.a && r.b, JSON.stringify(r));
      const r2 = await tplBtns('office', true);
      rec('8: a screen opened with the Admin PIN sees them', r2.a && r2.b, JSON.stringify(r2));
    }
    {
      const d = await X.dev(browser, S, 'office');
      await d.page.evaluate(() => { localStorage.setItem('wpfPin_office', pins().office); localStorage.setItem('wpfEditPin', pins().admin); openListEditor(null, 'WO-30'); }); await sleep(300);
      rec('8: an office screen that entered the Admin PIN for editing sees "Save as template"', await d.page.evaluate(() => !!document.getElementById('me-astpl')));
      await d.close();
    }

    // ---- 10. storage blocked / full: the bar says how to fix it; Settings shows device storage; nothing deleted
    {
      const d = await X.dev(browser, S, 'office');
      const s10 = await d.page.evaluate(() => { localStorage.setItem('wpf_quotes_backup', 'x'.repeat(2000)); DB.pendFail = true; DB.pendWhy = 'full';
        return { msg: pendWhyMsg(), html: devStoreHTML(), kept: localStorage.getItem('wpf_quotes_backup').length }; });
      rec('10: storage full → "Fix: Settings → Storage on this device"; Settings panel lists the old Quoting-tool copies; nothing removed', /Fix: Settings → Storage on this device/.test(s10.msg) && /Storage on this device/.test(s10.html) && /wpf_quotes_backup/.test(s10.html) && s10.kept === 2000, s10.msg);
      await d.close();
    }

    // ---- 360 px phone: WO line / project text / Start from fit; Save in reach
    {
      const d = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
      await d.page.evaluate(() => openListEditor(null, 'WO-30')); await sleep(400);
      const w = await d.page.evaluate(() => { const r = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().right) : -1; };
        return { wol: r('#me-wol'), pt: r('#me-ptxt'), from: r('#me-from'), sw: document.documentElement.scrollWidth, save: !!document.getElementById('me-save') }; });
      rec('360 px: WO line, project text and Start from fit on the screen; no sideways scroll', w.wol > 0 && w.wol <= 362 && w.pt <= 362 && w.from > 0 && w.from <= 362 && w.sw <= 362 && w.save, JSON.stringify(w));
      await d.close();
    }

    // ---- lists switched OFF: the old editor, as today (no WO line, no Start from)
    {
      const S0 = X.makeServer(X.v1Row());
      const d = await X.dev(browser, S0, 'office');
      await d.page.evaluate(() => openListEditor(null, 'WO-1')); await sleep(200);
      rec('lists OFF: the old editor — no WO line, no project text, no Start from', await d.page.evaluate(() => !!document.querySelector('.pod-ovl') && !document.getElementById('me-wol') && !document.getElementById('me-ptxt') && !document.getElementById('me-from') && !!document.getElementById('me-proj')));
      await d.close();
    }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
