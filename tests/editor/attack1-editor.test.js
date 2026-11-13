// Tester attack 1 on the list editor (browser, fake Supabase only):
//  A. edit merge across two screens with unit blocks — a part added inside a block on screen B, an edit on screen A
//  B. Units lock: a Units change made on ANOTHER screen + a tick, then this screen saves an unrelated edit
//  C. "Make new list from this" on two screens at once from the same old list
//  D. "Update template" by two people at once
//  E. editing a template never changes the live lists made from it
//  F. Stores colour: the default colour shown on a Stores row vs what is saved
// Run: node tests/editor/attack1-editor.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
let pass = 0, fail = 0; const rec = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + String(d).slice(0, 600))); };
const set = (k, v) => `(()=>{const e=document.querySelector('.pod-ovl [data-mr="${k}"]');e.value=${JSON.stringify(v)};(e.tagName==='SELECT'?e.onchange:e.oninput)();})()`;
const wait = async (fn, ms = 5000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
const BLOCKS = [
  ['hdr', 'U1 900 Single Rail', '3', null, null, null, '', '', {}],
  ['saw', 'Side panel', '6', 2380, 570, 'MFC White', '', '', { section: 'U1 900 Single Rail', unit_qty: '2' }],
  ['hdr', 'U2 500 Robe', '2', null, null, null, '', '', {}],
  ['saw', 'Shelf', '4', 464, 570, 'MFC White', '', '', { section: 'U2 500 Robe', unit_qty: '2' }]];
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
const pinUp = p => p.evaluate(() => { window.__conf = []; window.prompt = (m, d) => /PIN/.test(m) ? '7777' : /Why|What changed/.test(m) ? 'edit' : 'Tester'; window.confirm = m => { window.__conf.push(m); return true; }; });
(async () => {
  const browser = await H.chromium.launch();
  // ---- A. merge with unit blocks across two screens
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'LA', { name: 'House A', lines: BLOCKS, wos: ['WO-2'] });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    await pinUp(a.page); await pinUp(b.page);
    await a.page.evaluate(() => { window.__rowsA = lsEditRows('LA'); });
    // screen B adds "Back" (1 per unit) inside the U1 block, right after Side panel
    await b.page.evaluate(async () => { const l = lsList('LA'); const rows = lsEditRows('LA'); rows.splice(2, 0, { k: 'part', item: 'Back', qty: '1', L: 2380, W: 880, mat: 'MFC White', edging: '', note: '' }); await lsSaveManual({ wo: 'WO-2', name: 'House A', pid: l.pid, rows }, 'Bob', l); });
    const afterB = live(S, 'LA').map(x => x.part + ':' + x.qty);
    // screen A (opened before) changes Shelf per-unit 2 → 3 and saves
    const ra = await a.page.evaluate(async () => { const l = lsList('LA'); const rows = window.__rowsA; rows[3].qty = 3; try { await lsSaveManual({ wo: 'WO-2', name: 'House A', pid: l.pid, rows }, 'Ann', l); return 'ok'; } catch (e) { return e.message; } });
    const L = live(S, 'LA'), seq = L.map(x => (x.kind === 'hdr' ? '#' : '') + x.part + ':' + x.qty);
    rec('merge: B\'s "Back" (U1, 3 to cut) and A\'s Shelf change (6) both kept', ra === 'ok' && L.some(x => x.part === 'Back' && x.qty === '3') && L.some(x => x.part === 'Shelf' && x.qty === '6'), JSON.stringify({ ra, afterB, seq }));
    const iB = L.findIndex(x => x.part === 'Back'), iU2 = L.findIndex(x => x.part === 'U2 500 Robe');
    rec('merge: "Back" is still INSIDE the U1 block on the saw (before the U2 heading), not moved under U2', iB >= 0 && iU2 >= 0 && iB < iU2, JSON.stringify(seq));
    // reopen on A and save an unrelated edit: Back must still be 3 to cut
    await a.page.evaluate(async () => { await lsPoll(); const l = lsList('LA'); const rows = lsEditRows('LA'); const s = rows.find(r => r.item === 'Side panel'); s.note = 'grain vertical'; await lsSaveManual({ wo: 'WO-2', name: 'House A', pid: l.pid, rows }, 'Ann', l); });
    const back = live(S, 'LA').find(x => x.part === 'Back');
    rec('…and a later unrelated save does not change Back\'s total (still 3, 1 per unit × 3 units)', back && back.qty === '3', JSON.stringify(live(S, 'LA').map(x => [x.part, x.qty, x.unit_qty, x.section])));
    rec('no page errors (A)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  // ---- B. Units lock: Units changed on ANOTHER screen, then a tick; this screen only edits a note
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'LB', { name: 'House B', lines: BLOCKS, wos: ['WO-2'] });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    await pinUp(a.page); await pinUp(b.page);
    await a.page.evaluate(() => { window.__rowsA = lsEditRows('LB'); });
    await b.page.evaluate(async () => { const l = lsList('LB'); const rows = lsEditRows('LB'); rows[0].units = '4'; await lsSaveManual({ wo: 'WO-2', name: 'House B', pid: l.pid, rows }, 'Bob', l); });
    D.applyLineChanges(S.db, [{ id: 'LB:2', status: 'cut', cid: 'c1', rev: D.find(S.db, 'lists', 'LB').rev }], 'Sean');
    const r = await a.page.evaluate(async () => { const l = lsList('LB'); const rows = window.__rowsA; rows[3].note = 'check grain'; try { await lsSaveManual({ wo: 'WO-2', name: 'House B', pid: l.pid, rows }, 'Ann', l); return 'ok'; } catch (e) { return e.message; } });
    const L = live(S, 'LB');
    rec('A did not touch Units (B changed 3 → 4, then the saw ticked): A\'s note edit is saved, not refused with "Saw has started"', r === 'ok' && L.some(x => x.part === 'Shelf' && x.note === 'check grain'), r);
    rec('…and B\'s Units 4 is kept (Side 8)', L[0].qty === '4' && L[1].qty === '8', JSON.stringify(L.map(x => [x.part, x.qty])));
    await a.close(); await b.close();
  }
  // ---- C. "Make new list from this" on two screens at once
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'LC', { name: 'House C', lines: BLOCKS, wos: ['WO-2'] });
    D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'LC:2'), { status: 'cut', status_by: 'Sean', status_at: '2026-10-21T08:00:00Z' });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    await pinUp(a.page); await pinUp(b.page);
    const copy = p => p.evaluate(async () => { await lsPoll(); openListEditor('LC'); document.querySelector('.pod-ovl [data-mecopy]').click(); });
    await copy(a.page); await copy(b.page);
    await a.page.evaluate(() => { document.querySelector('#me-name').value = 'House C new (Ann)'; document.getElementById('me-save').click(); });
    await wait(() => S.db.t.lists.some(l => l.name === 'House C new (Ann)')); await F.sleep(500); await F.send(a.page);
    await wait(() => D.find(S.db, 'lists', 'LC').archived);
    await b.page.evaluate(() => { document.querySelector('#me-name').value = 'House C new (Bob)'; document.getElementById('me-save').click(); });
    await wait(() => S.db.t.lists.some(l => l.name === 'House C new (Bob)')); await F.sleep(800); await F.send(b.page);
    const lv = S.db.t.lists.filter(l => (l.wos || []).includes('WO-2') && !l.archived && !l.is_template).map(l => l.name);
    const tb = await b.page.evaluate(() => document.getElementById('toast').textContent);
    rec('two screens "Make new list from this" on the same list: WO-2 ends with ONE live list, or the second person is warned a replacement already exists', lv.length === 1 || /already (been )?replaced|new list .* already|another new list/i.test(tb), JSON.stringify({ live: lv, toastB: tb }));
    rec('no page errors (C)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await a.close(); await b.close();
  }
  // ---- D. Update template by two people at once (both dialogs open on Rev 1)
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'TD', { name: 'Type B kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type B kitchen' } });
    F.seedList(S, 'LD1', { name: 'House 1', wos: ['WO-1'], lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Plinth Ann', '1', 2400, 150, 'MFC White', '', '']] });
    F.seedList(S, 'LD2', { name: 'House 2', wos: ['WO-2'], lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['saw', 'Cornice Bob', '1', 2400, 80, 'MFC White', '', '']] });
    const a = await F.dev(browser, S, 'office'), b = await F.dev(browser, S, 'office');
    await pinUp(a.page); await pinUp(b.page);
    // (12 Nov, list-window Q3) Save as template needs the Drawing office / Admin PIN — the Production Manager PIN (7777) no longer opens it
    const open = (p, id) => p.evaluate(async id => { (o => { window.prompt = (m, d) => /Enter the Drawing office or Admin PIN/.test(m) ? pins().design : o(m, d); })(window.prompt); /* a remembered PIN no longer opens templates (plan question 12): the PIN is typed when asked */ lsSaveAsTpl({ id }); await new Promise(r => setTimeout(r, 300)); const n = document.getElementById('at-name'); n.value = 'Type B kitchen'; n.oninput({ target: n }); return document.getElementById('at-ok').textContent; }, id);
    const ta = await open(a.page, 'LD1'), tb0 = await open(b.page, 'LD2');
    await a.page.evaluate(() => document.getElementById('at-ok').click()); await wait(() => D.find(S.db, 'lists', 'TD').rev === 2);
    await b.page.evaluate(() => document.getElementById('at-ok').click()); await F.sleep(1200);
    const tb = await b.page.evaluate(() => (document.getElementById('toast').textContent || '') + ' | ' + ((document.getElementById('at-err') || {}).textContent || ''));
    const parts = live(S, 'TD').map(x => x.part);
    rec('both dialogs offered "Update template → Rev 2"', /Rev 2/.test(ta) && /Rev 2/.test(tb0), ta + ' / ' + tb0);
    rec('second "Update template" on a stale Rev 1: Bob is told Ann updated it first (not a silent overwrite of Ann\'s Rev 2)', parts.includes('Plinth Ann') || /already|another|meanwhile|Ann/i.test(tb), JSON.stringify({ parts, rev: D.find(S.db, 'lists', 'TD').rev, tb }));
    await a.close(); await b.close();
  }
  // ---- E. template edit never changes live copies; F. Stores default colour
  {
    const S = F.makeServer(F.v2Row());
    F.seedList(S, 'TE', { name: 'Type C kitchen', wos: [], list: { is_template: true, list_type: 'kitchen', type_name: 'Type C kitchen' } });
    const o = await F.dev(browser, S, 'office'), pg = o.page; await pinUp(pg);
    const l = await pg.evaluate(() => lsCreateFromTpl('TE', ['WO-2'], 'House 2', 'Ann').then(x => x.id));
    const before = JSON.stringify(live(S, l).map(x => [x.part, x.qty, x.length_mm]));
    await pg.evaluate(async () => { await lsPoll(); (o => { window.prompt = (m, d) => /Enter the Drawing office or Admin PIN/.test(m) ? pins().design : o(m, d); })(window.prompt); /* a remembered PIN no longer opens templates (plan question 12): the PIN is typed when asked */ openListEditor('TE'); }); // (attack2 F5, Garry Q3) editing a template: Drawing office / Admin only — the Production Manager PIN no longer opens it
    await pg.evaluate(set('0|qty', '9')); await pg.evaluate(set('2|L', '1500'));
    await pg.evaluate(() => document.getElementById('me-save').click());
    await wait(() => D.find(S.db, 'lists', 'TE').rev === 2);
    const after = JSON.stringify(live(S, l).map(x => [x.part, x.qty, x.length_mm]));
    rec('template edited to Rev 2: the live list made from Rev 1 is unchanged', D.find(S.db, 'lists', 'TE').rev === 2 && before === after, before + ' vs ' + after);
    // F: Stores row with the default (copied) colour showing
    await pg.evaluate(() => openListEditor(null, 'WO-2'));
    await pg.evaluate(set('0|item', 'Side')); await pg.evaluate(set('0|qty', '2')); await pg.evaluate(set('0|L', '720')); await pg.evaluate(set('0|W', '560')); await pg.evaluate(set('0|mat', 'MFC White'));
    await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="0|item"]').focus(); document.getElementById('me-addsaw').click(); });
    await pg.evaluate(set('1|item', 'Hanging rail')); await pg.evaluate(set('1|qty', '1'));
    const shown = await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="1|mat"]'); return { v: e.value, cls: e.className, style: e.getAttribute('style') || '', title: e.title || '' }; });
    // the person sees "MFC White" and is happy with it — in Chrome, picking the option that is already selected fires no change event
    await pg.evaluate(() => { document.querySelector('#me-name').value = 'Stores colour'; document.getElementById('me-save').click(); });
    await wait(() => S.db.t.lists.some(x => x.name === 'Stores colour'));
    const sl = S.db.t.lists.find(x => x.name === 'Stores colour'), saved = sl ? live(S, sl.id).map(x => x.part + ':' + (x.material || '')) : [];
    rec('Stores row: what the editor SHOWS as its colour is what is SAVED (shows "' + shown.v + '", saved ' + JSON.stringify(saved[1]) + ')', (shown.v === '' && saved[1] === 'Hanging rail:') || (shown.v === 'MFC White' && saved[1] === 'Hanging rail:MFC White') || /default|auto|not saved/i.test(shown.title + shown.cls), JSON.stringify({ shown, saved }));
    rec('no page errors (E/F)', !(S.errors || []).length, (S.errors || []).join(' | '));
    await o.close();
  }
  await browser.close();
  console.log(fail + ' failed of ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
