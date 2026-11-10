// Garry's answer 4 (3 Nov): "Make new list from this" — once the NEW list is SAVED the old list is archived (off the saw).
// Lines already ticked cut on the old list show on the new list (editor and saw) as "already cut on old list (n)",
// matched by description + length + width + colour; information only, no tick carried. A failed save archives nothing;
// an old list archived or changed meanwhile on another screen is not archived twice / not without asking.
// Garry's answer 5: Stores rows (no length/width) start with no colour. Fake Supabase only.
// Run: node tests/editor/e13-newlist-archive.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  -> ' + d)); };
const set = (k, v) => `(()=>{const e=document.querySelector('.pod-ovl [data-mr="${k}"]');e.value=${JSON.stringify(v)};(e.tagName==='SELECT'?e.onchange:e.oninput)();})()`;
const wait = async (fn, ms = 5000) => { for (let i = 0; i < ms / 100; i++) { if (await fn()) return true; await F.sleep(100); } return false; };
const LINES = [
  ['hdr', '900 Single Rail', '3', null, null, null, '', '', {}],
  ['saw', 'Side panel', '6', 2380, 570, 'MFC White', 'L1LE 1mm', '', { section: '900 Single Rail', unit_qty: '2' }],
  ['saw', 'Shelves', '9', 864, 570, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '3' }],
  ['saw', 'Back', '3', 2380, 880, 'MFC White', '', '', { section: '900 Single Rail', unit_qty: '1' }],
  ['fit', 'Hanging rail', '3', null, null, '', '', '', { section: '900 Single Rail', unit_qty: '1' }]];
const cut = (S, id, st = 'cut') => D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', id), { status: st, status_by: 'Sean', status_at: '2026-10-21T08:00:00Z' });
const archEv = (S, id) => (S.db.t.list_events || []).filter(e => e.list_id === id && e.act === 'archive-on').length;
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row());
  ['L1', 'L2', 'L3', 'L4'].forEach(id => F.seedList(S, id, { name: 'House ' + id.slice(1), lines: LINES }));
  ['L1', 'L2', 'L3', 'L4'].forEach(id => { cut(S, id + ':2'); cut(S, id + ':5', 'got-out'); });
  const o = await F.dev(browser, S, 'office'), pg = o.page;
  await pg.evaluate(() => { window.__conf = []; window.__confAns = []; window.prompt = (m, d) => /PIN/.test(m) ? '7777' : 'Tester'; window.confirm = m => { window.__conf.push(m); return window.__confAns.length ? window.__confAns.shift() : true; }; });
  const copy = id => pg.evaluate(async id => { await lsPoll(); openListEditor(id); document.querySelector('.pod-ovl [data-mecopy]').click(); }, id);
  const toast = () => pg.evaluate(() => document.getElementById('toast').textContent);
  const newOf = name => S.db.t.lists.find(l => l.name === name);

  // ---- A. the copy: the confirm says what will happen; the editor shows the "already cut" notes
  await copy('L1');
  const c0 = await pg.evaluate(() => window.__conf.slice(-1)[0] || '');
  rec('"Make new list from this" says the old list is archived when the new one is SAVED', /When you SAVE the new list, this one is archived/.test(c0), c0);
  const ed = await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); return { notes: [...ov.querySelectorAll('.pc-b')].map(e => e.closest('[data-row]').dataset.row + ':' + e.textContent), note: ov.innerText.includes('Saving archives "House 1"') }; });
  rec('editor: "already cut on old list (6)" on Side panel only (the got-out Stores line and uncut lines get none)', ed.notes.join(',') === '1:already cut on old list (6)' && ed.note, JSON.stringify(ed));
  await pg.evaluate(set('0|units', '4'));
  await pg.evaluate(set('3|W', '600')); // Back is now a different size → no match (it wasn't cut anyway)
  await pg.evaluate(set('2|W', '600')); await pg.evaluate(set('2|W', '570')); // Shelves: changed and back
  await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); ov.querySelector('[data-mr="1|item"]').focus(); document.getElementById('me-addsaw').click(); });
  const ed2 = await pg.evaluate(() => [...document.querySelectorAll('.pod-ovl .pc-b')].map(e => e.closest('[data-row]').dataset.row).join(','));
  rec('editor: the note follows the row (still on Side panel after Units changed and a row was added)', ed2 === '1', ed2);
  await pg.evaluate(() => { const ov = document.querySelector('.pod-ovl'); ov.querySelector('[data-mrx="2"]').click(); }); // remove the empty row again
  // a tick landing on the old list meanwhile (the saw keeps cutting) is not a "change": no question, and it is shown
  D.applyLineChanges(S.db, [{ id: 'L1:3', status: 'cut', cid: 'cA', rev: 1 }], 'Sean');
  await pg.evaluate(() => { window.__conf = []; document.getElementById('me-save').click(); });
  await wait(() => !!newOf('House 1 (new)'));
  await wait(async () => /archived/.test(await toast()));
  const nl = newOf('House 1 (new)'), t1 = await toast(), q1 = await pg.evaluate(() => window.__conf.length);
  await F.send(pg); await wait(() => D.find(S.db, 'lists', 'L1').archived);
  rec('saved: the new list is made and the old list is ARCHIVED (Lists-home archive path, list_events archive-on)', !!nl && D.find(S.db, 'lists', 'L1').archived === true && archEv(S, 'L1') === 1, JSON.stringify({ arch: D.find(S.db, 'lists', 'L1').archived, ev: archEv(S, 'L1') }));
  rec('… the person is told in plain English, and was not asked (only ticks landed meanwhile)', /The old list "House 1" is archived \(off the saw\)/.test(t1) && q1 === 0, t1 + ' / confirms ' + q1);
  const nln = nl ? S.db.t.list_lines.filter(x => x.list_id === nl.id).sort((a, b) => a.seq - b.seq) : [];
  rec('the new list: no ticks carried, 4 units (Side 8), old ticks untouched', nln.every(x => x.status === 'todo') && nln[1].qty === '8' && D.find(S.db, 'list_lines', 'L1:2').status === 'cut', JSON.stringify(nln.map(x => [x.part, x.qty, x.status])));
  rec('the new list\'s history says which list it replaces', nl && /replaces list L1$/.test(String((nl.log || [])[0] && nl.log[0].why)), JSON.stringify(nl && nl.log));
  rec('the old list stays readable (Archived filter), nothing deleted', !S.deletes3 && S.db.t.list_lines.filter(x => x.list_id === 'L1').length === 5);

  // ---- B. the saw (a fresh device: the archived list's lines are not loaded at start-up — fetched for the note)
  const sw = await F.dev(browser, S, 'saw'), sp = sw.page;
  const html = id => sp.evaluate(id => listTableHTML(lsList(id), 'saw', { tick: true }), id);
  await html(nl.id); await wait(async () => /already cut on old list/.test(await html(nl.id)));
  const sv = await sp.evaluate(id => { const d = document.createElement('div'); d.innerHTML = listTableHTML(lsList(id), 'saw', { tick: true }); return [...d.querySelectorAll('tr')].filter(tr => tr.querySelector('.pc-b')).map(tr => tr.cells[2].childNodes[0].textContent.trim() + ':' + tr.querySelector('.pc-b').textContent); }, nl.id);
  rec('saw view: amber "already cut on old list (6)" on Side panel and (9) on Shelves (cut meanwhile); none on the resized Back', sv.join(',') === 'Side panel:already cut on old list (6),Shelves:already cut on old list (9)', JSON.stringify(sv));
  const tk = await sp.evaluate(id => Object.keys(lsView(id).ticks).length, nl.id);
  rec('saw: the note is information only — the new list has no ticks', tk === 0, String(tk));
  rec('saw: the old (archived) list is no longer on the saw', await sp.evaluate(() => !lists().some(l => l.id === 'L1')));
  await sw.close();
  // editor reopened on the saved new list still shows the note
  const ed3 = await pg.evaluate(async id => { await lsPoll(); openListEditor(id); const r = [...document.querySelectorAll('.pod-ovl .pc-b')].map(e => e.closest('[data-row]').dataset.row + ':' + e.textContent); document.querySelector('.pod-ovl').remove(); return r; }, nl.id);
  rec('editor on the saved new list: the notes are still shown', ed3.join(',') === '1:already cut on old list (6),2:already cut on old list (9)', JSON.stringify(ed3));

  // ---- C. a failed save archives nothing
  await copy('L2');
  S.fail3 = true;
  await pg.evaluate(() => document.getElementById('me-save').click());
  await wait(async () => /Not saved/.test(await pg.evaluate(() => (document.getElementById('me-err') || {}).textContent || '')));
  const e1 = await pg.evaluate(() => document.getElementById('me-err').textContent);
  S.fail3 = false;
  await F.send(pg); await F.sleep(300);
  rec('save fails → the editor stays open with "Not saved", the old list is NOT archived', /Not saved/.test(e1) && !D.find(S.db, 'lists', 'L2').archived && archEv(S, 'L2') === 0 && !newOf('House 2 (new)') && await pg.evaluate(() => !LQ.q.some(e => e.t === 'archive')), e1);
  // trying again once the signal is back saves and archives
  await pg.evaluate(() => document.getElementById('me-save').click());
  await wait(() => !!newOf('House 2 (new)')); await wait(async () => /archived/.test(await toast())); await F.send(pg);
  await wait(() => D.find(S.db, 'lists', 'L2').archived);
  rec('… saving again works and only then is the old list archived (once)', !!newOf('House 2 (new)') && D.find(S.db, 'lists', 'L2').archived && archEv(S, 'L2') === 1);

  // ---- D. archived meanwhile on another screen: not archived twice, said plainly
  await copy('L3');
  D.RPC.list_set_done(S.db, { p_list: 'L3', p_mode: 'archive', p_on: true, p_by: 'Mary', p_why: null, p_cid: 'other1' });
  await pg.evaluate(() => { window.__conf = []; document.getElementById('me-save').click(); });
  await wait(() => !!newOf('House 3 (new)')); await wait(async () => /already archived/.test(await toast()));
  const t3 = await toast(); await F.send(pg); await F.sleep(300);
  rec('old list archived meanwhile: "was already archived on another screen — left as it is"; no second archive', /The old list "House 3" was already archived on another screen — left as it is/.test(t3) && archEv(S, 'L3') === 1 && !!newOf('House 3 (new)'), t3 + ' / ev ' + archEv(S, 'L3'));

  // ---- E. changed meanwhile (content, not ticks): asked first; Cancel leaves it with the saw
  await copy('L4');
  D.update(S.db, 'list_lines', D.find(S.db, 'list_lines', 'L4:3'), { qty: '12', unit_qty: '4' });
  await pg.evaluate(() => { window.__conf = []; window.__confAns = [false]; document.getElementById('me-save').click(); });
  await wait(() => !!newOf('House 4 (new)')); await wait(async () => /changed on another screen/.test(await toast()));
  const t4 = await toast(), c4 = await pg.evaluate(() => window.__conf.slice(-1)[0] || ''); await F.send(pg); await F.sleep(300);
  rec('old list changed meanwhile: the person is asked ("changed on another screen after you copied it")', /was changed on another screen after you copied it/.test(c4), c4);
  rec('… Cancel: the new list is saved, the old one is left with the saw, and the person is told', !!newOf('House 4 (new)') && !D.find(S.db, 'lists', 'L4').archived && /left with the saw/.test(t4), t4);

  // ---- F. Garry's answer 5: Stores rows start with no colour
  await pg.evaluate(() => openListEditor(null, 'WO-2'));
  await pg.evaluate(set('0|item', 'Side')); await pg.evaluate(set('0|qty', '2')); await pg.evaluate(set('0|L', '720')); await pg.evaluate(set('0|W', '560')); await pg.evaluate(set('0|mat', 'MFC White'));
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="0|item"]').focus(); document.getElementById('me-addsaw').click(); });
  const m1 = await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="1|mat"]').value);
  rec('a new row copies the colour of the saw row above (a default)', m1 === 'MFC White', m1);
  await pg.evaluate(set('1|item', 'Hanging rail')); await pg.evaluate(set('1|qty', '1')); // no length / width → Stores, colour only the default
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="1|item"]').focus(); document.getElementById('me-addsaw').click(); });
  await pg.evaluate(set('2|item', 'Hinge')); await pg.evaluate(set('2|qty', '8')); await pg.evaluate(set('2|mat', 'Blum hinge')); // Stores, colour picked
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="2|item"]').focus(); document.getElementById('me-addsaw').click(); });
  const m3 = await pg.evaluate(() => document.querySelector('.pod-ovl [data-mr="3|mat"]').value);
  rec('a row after a Stores row copies the last SAW row\'s colour, not the Stores row\'s', m3 === 'MFC White', m3);
  await pg.evaluate(set('3|item', 'Top')); await pg.evaluate(set('3|qty', '1')); await pg.evaluate(set('3|L', '1200')); await pg.evaluate(set('3|W', '560')); // saw row keeps the default
  // Enter at the bottom: a new row, also Stores, also only the default
  await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="3|note"]'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
  await pg.evaluate(set('4|item', 'Screws')); await pg.evaluate(set('4|qty', '20'));
  // Ctrl+D on a Stores row's colour = picked by the person
  await pg.evaluate(() => { document.querySelector('.pod-ovl #me-addsaw').click(); });
  await pg.evaluate(set('5|item', 'Cam')); await pg.evaluate(set('5|qty', '4'));
  await pg.evaluate(() => { const e = document.querySelector('.pod-ovl [data-mr="5|mat"]'); e.focus(); e.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true })); });
  await pg.evaluate(() => { document.querySelector('#me-name').value = 'Colour test'; document.getElementById('me-save').click(); });
  await wait(() => !!newOf('Colour test'));
  const cl = newOf('Colour test'), cln = cl ? S.db.t.list_lines.filter(x => x.list_id === cl.id).sort((a, b) => a.seq - b.seq).map(x => [x.kind, x.part, x.material || ''].join('|')) : [];
  rec('saved: Stores rows with only the copied colour → no colour; picked colours (dropdown, Ctrl+D) kept; saw rows keep theirs',
    cln.join(';') === 'saw|Side|MFC White;fit|Hanging rail|;fit|Hinge|Blum hinge;saw|Top|MFC White;fit|Screws|;fit|Cam|MFC White', cln.join(';'));
  // an existing Stores line with a colour keeps it when the list is edited again
  await pg.evaluate(async id => { await lsPoll(); openListEditor(id); }, cl.id);
  await pg.evaluate(set('0|qty', '3')); await pg.evaluate(() => document.getElementById('me-save').click());
  await wait(() => S.db.t.list_lines.some(x => x.list_id === cl.id && x.part === 'Side' && x.qty === '3'));
  const cl2 = S.db.t.list_lines.filter(x => x.list_id === cl.id && x.removed_rev == null).sort((a, b) => a.seq - b.seq).map(x => x.material || '').join('|');
  rec('re-saving the list keeps the Stores colours that were saved', cl2 === 'MFC White||Blum hinge|MFC White||MFC White', cl2);
  // a row that was Stores, then gets a size: becomes a saw row and keeps the default colour
  await pg.evaluate(() => openListEditor(null, 'WO-2'));
  await pg.evaluate(set('0|item', 'Gable')); await pg.evaluate(set('0|qty', '2')); await pg.evaluate(set('0|L', '900')); await pg.evaluate(set('0|W', '560')); await pg.evaluate(set('0|mat', 'MFC White'));
  await pg.evaluate(() => { document.querySelector('.pod-ovl [data-mr="0|item"]').focus(); document.getElementById('me-addsaw').click(); });
  await pg.evaluate(set('1|item', 'Plinth')); await pg.evaluate(set('1|qty', '1')); await pg.evaluate(set('1|L', '2400')); await pg.evaluate(set('1|W', '150'));
  await pg.evaluate(() => { document.querySelector('#me-name').value = 'Colour test 2'; document.getElementById('me-save').click(); });
  await wait(() => !!newOf('Colour test 2'));
  const c2 = S.db.t.list_lines.filter(x => x.list_id === newOf('Colour test 2').id).map(x => x.kind + '|' + (x.material || '')).join(';');
  rec('a new row that becomes a saw row keeps the copied colour', c2 === 'saw|MFC White;saw|MFC White', c2);
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await o.close(); await browser.close();
  const pass = res.filter(Boolean).length;
  console.log('\n' + pass + ' passed, ' + (res.length - pass) + ' failed');
  process.exit(res.length - pass ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
