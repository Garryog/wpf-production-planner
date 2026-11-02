// Tester attack (2 Nov 2026) on the five Saw/Stores fixes d3a8f00 (odd qty in combined list), 7f195fa (ticked lines left
// out of combined list), c5de45b (waiting book grouping ignores case/spaces), 5af0656 (stale Release can't reopen finished
// work, relOpen), 652aa3b (phone wrapping). Stubbed Supabase only (tests/stage1/srv.js).
// Run: node tests/sawstores/attack-fixes.test.js
const { H, makeServer, open } = require('../stage1/srv');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const info = (n, d) => console.log('INFO ' + n + (d ? '  -> ' + d : ''));
const NOW = '2026-10-21T09:00:00Z';
const L = (id, sheet, name, n, wo, extra) => Object.assign({ id, wb: 'W1', sheet, name, project: 'Proj', saw: n, fit: 0, noFit: true, wos: [wo], up: NOW }, extra || {});
const mk = (sheets, lists, orders, extra) => ({ id: 'main', version: 1, nid: 5,
  orders: orders || lists.map(l => H.order({ wo: l.wos[0], dueDate: '2026-10-22', origDueDate: '2026-10-22' })),
  settings: Object.assign({ lists, listWBs: { W1: { project: 'Proj', sheets } } }, extra || {}) });
const save = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });
const reload = p => p.evaluate(async () => { await loadDB(); render(); });
const dev = async (browser, S, role, o) => { const t = await open(browser, S, Object.assign({ now: NOW, role: role || 'saw' }, o || {})); await t.page.evaluate(() => { localStorage.setItem('wpfOpName', 'Op'); render(); }); return t; };
const tapL = (p, attr, lid, i) => p.evaluate(({ attr, lid, i }) => { const l = lists().find(x => x.id === lid); const k = listRows(l).map(rowKey)[i]; const b = [...document.querySelectorAll('[' + attr + ']')].find(x => x.getAttribute(attr) === lid + '|' + k); if (!b) return 'missing'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; }, { attr, lid, i });
const st = (p, lid, i) => p.evaluate(({ lid, i }) => { const l = lists().find(x => x.id === lid), k = listRows(l).map(rowKey)[i]; return { held: heldRow(l, k), ticked: rowTicked(lid, k), raw: (holdsOf(lid)[k] || {}).st || '', done: !!listDone(lid).saw, side: sideState(l, 'saw'), relOpen: relOpen(l, 'saw') }; }, { lid, i });
const onQueue = (p, name) => p.evaluate(n => { wlShowDone = false; wlShowHold = false; wlShowUpcoming = true; render(); const r = [...document.querySelectorAll('.wl-card:not(.cdone)')].some(c => c.innerText.includes(n)); wlShowUpcoming = false; render(); return r; }, name);

(async () => {
  const browser = await H.chromium.launch();

  // ---------- A. Combined list: odd quantities across 3 houses ----------
  {
    const s = (q1, q2, q3) => [{ k: 'saw', item: 'Side', qty: q1, L: 2400, W: 600, mat: 'MFC White', note: '' }, { k: 'saw', item: 'Top', qty: q2, L: 1200, W: 600, mat: 'MFC White', note: '' }, { k: 'saw', item: 'Shelf', qty: q3, L: 800, W: 300, mat: 'MFC White', note: '' }];
    const sheets = { H1: s('2x2', '1.5', 0), H2: s('', -2, null), H3: s(4, ' 3 ', '2') };
    const ls = [L('L1', 'H1', 'House 1', 3, 'WO-1'), L('L2', 'H2', 'House 2', 3, 'WO-2'), L('L3', 'H3', 'House 3', 3, 'WO-3')];
    const S = makeServer(mk(sheets, ls));
    const A = await dev(browser, S);
    const c = await A.page.evaluate(() => combineLists(lists(), 'saw').map(r => ({ i: r.item, q: r.qty, bad: r.bad, per: r.per })));
    const by = Object.fromEntries(c.map(r => [r.i, r]));
    rec('A Side: 4 counted, "2x2" and blank not added (bad=2)', by.Side.q === 4 && by.Side.bad === 2 && by.Side.per['House 1'] === '2x2' && by.Side.per['House 2'] === 'no qty', JSON.stringify(by.Side));
    rec('A Top: " 3 " counted as 3, "1.5" and -2 not added (bad=2)', by.Top.q === 3 && by.Top.bad === 2 && by.Top.per['House 1'] === '1.5' && by.Top.per['House 2'] === '-2', JSON.stringify(by.Top));
    rec('A Shelf: "2" counted, 0 and null flagged (bad=2)', by.Shelf.q === 2 && by.Shelf.bad === 2, JSON.stringify(by.Shelf));
    const html = await A.page.evaluate(() => { openCombined(lists(), 'saw'); const h = document.querySelector('.pod-ovl').innerHTML; document.querySelector('.pod-ovl').remove(); return h; });
    rec('A panel shows "2 not added — check quantity" on each line', (html.match(/\+ 2 not added — check quantity/g) || []).length === 3);
    rec('A per-house chip shows typed value with warning (×2x2, ×no qty, ×-2, ×1.5)', ['×2x2', '×no qty', '×-2', '×1.5'].every(t => html.includes(t)) && (html.match(/⚠ check quantity/g) || []).length === 6);
    // same house twice (identical line) with mixed good/bad qty; and injection in qty
    const S2 = makeServer(mk({ H1: [{ k: 'saw', item: 'Side', qty: 2, L: 1, W: 1, mat: 'M', note: '' }, { k: 'saw', item: 'Side ', qty: '2x2', L: 1, W: 1, mat: 'M', note: '' }, { k: 'saw', item: 'Plinth', qty: '<img src=x onerror=window.__x=1>', L: 1, W: 1, mat: 'M', note: '' }] }, [L('L1', 'H1', "O'Grady <b>1</b>", 3, 'WO-1')]));
    const B = await dev(browser, S2);
    const c2 = await B.page.evaluate(() => { openCombined(lists(), 'saw'); const h = document.querySelector('.pod-ovl').innerHTML; return { h, x: window.__x, rows: combineLists(lists(), 'saw').map(r => ({ i: r.item, q: r.qty, bad: r.bad, per: r.per })) }; });
    rec('A same house, identical line "2" + "2x2" → total 2, chip "2 + 2x2"', c2.rows[0].q === 2 && c2.rows[0].bad === 1 && Object.values(c2.rows[0].per)[0] === '2 + 2x2', JSON.stringify(c2.rows[0]));
    rec('A HTML in qty / house name is escaped, not run', c2.x === undefined && !/<img src=x/.test(c2.h) && !/<b>1<\/b>/.test(c2.h));
    await A.close(); await B.close();
  }

  // ---------- B. Combined list + Print today + readiness: ticked vs waiting vs released ----------
  {
    const rows = [{ k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' }, { k: 'saw', item: 'Top', qty: 2, L: 1200, W: 600, mat: 'MFC White', note: '' }, { k: 'saw', item: 'Back', qty: 1, L: 900, W: 700, mat: 'Oak', note: '' }];
    const ls = [L('L1', 'H1', 'House 1', 3, 'WO-1'), L('L2', 'H1', 'House 2', 3, 'WO-2'), L('L3', 'H1', 'House 3', 3, 'WO-3')];
    const S = makeServer(mk({ H1: rows }, ls));
    const A = await dev(browser, S);
    const r0 = await A.page.evaluate(() => ['WO-1', 'WO-2', 'WO-3'].map(w => woReady(w)));
    rec('B start: every WO red "Not cut yet"', r0.every(r => r.lvl === 'red' && r.saw === 'open' && r.why.includes('Not cut yet')), JSON.stringify(r0[0]));
    // House 1: Side ticked, Top N/A, Back open
    await tapL(A.page, 'data-rt', 'L1', 0); await tapL(A.page, 'data-rna', 'L1', 1);
    // House 2: Top N/A, Side+Back ticked -> list done; then Top released (not ticked)
    await tapL(A.page, 'data-rna', 'L2', 1); await tapL(A.page, 'data-rt', 'L2', 0); await tapL(A.page, 'data-rt', 'L2', 2);
    // House 3: Top N/A, Side+Back ticked -> done; Top released AND ticked (stale release merged in later)
    await tapL(A.page, 'data-rna', 'L3', 1); await tapL(A.page, 'data-rt', 'L3', 0); await tapL(A.page, 'data-rt', 'L3', 2);
    await A.page.evaluate(() => { const k = listRows(lists()[0]).map(rowKey)[1]; releaseHolds([{ l: lists()[1], k }], 'Prod');
      const h = holdsOf('L3')[k]; h.st = 'rel'; h.relAt = nowISO(); DB.listRow.L3[k] = { m: 'saw', at: nowISO(), by: 'Op' }; render(); });
    const s = { h1: await st(A.page, 'L1', 1), h2: await st(A.page, 'L2', 1), h3: await st(A.page, 'L3', 1) };
    rec('B setup: H2 done with released open row, H3 done with released+ticked row', s.h2.done && s.h2.raw === 'rel' && s.h2.relOpen && s.h3.done && s.h3.raw === 'rel' && s.h3.ticked && !s.h3.relOpen, JSON.stringify(s));
    const c = await A.page.evaluate(() => combineLists(lists(), 'saw').map(r => r.item + ':' + r.qty + '[' + Object.keys(r.per).join('/') + ']').join(', '));
    rec('B combined = H1 Back only + H2 Top only (ticked, waiting and finished H3 left out)', c === 'Back:1[House 1], Top:2[House 2]' || c === 'Top:2[House 2], Back:1[House 1]', c);
    const rd = await A.page.evaluate(() => ['WO-1', 'WO-2', 'WO-3'].map(w => woReady(w).lvl + '/' + woReady(w).saw).join(','));
    rec('B readiness: H1 amber/hold, H2 red/open (released row not cut), H3 green/done', rd === 'amber/hold,red/open,green/done', rd);
    rec('B queue: H2 on queue (MATERIAL HAS ARRIVED), H3 not on queue', (await onQueue(A.page, 'House 2')) && !(await onQueue(A.page, 'House 3')));
    const q = await A.page.evaluate(() => /MATERIAL HAS ARRIVED/.test(document.body.innerText));
    rec('B queue shows MATERIAL HAS ARRIVED note for H2', q);
    const pr = await A.page.evaluate(() => { window.__opened = []; printWorkList('saw', 1); return window.__opened.slice(-1)[0] || ''; });
    const blocks = pr.split('class="blk"').slice(1);
    const b1 = blocks.find(b => /House 1/.test(b)) || '', b2 = blocks.find(b => /House 2/.test(b)) || '';
    rec('B Print today: H3 (finished) not printed', !blocks.some(b => /House 3/.test(b)), blocks.length + ' blocks');
    rec('B Print today: H2 prints only the released Top line', /MATERIAL ARRIVED — these rows only/.test(b2) && /Top/.test(b2) && !/>Side</.test(b2) && !/>Back</.test(b2), (b2.match(/<td>[^<]*<\/td>/g) || []).slice(0, 4).join(''));
    rec('B Print today: H1 Top printed as WAITING', /WAITING ON MATERIAL<\/b> — Top/.test(b1));
    // H1 Side is already ticked cut. Combined list leaves it out ("don't cut twice"); does the paper sheet?
    const sideRow = (b1.match(/<tr[^>]*><td class="tk">[^<]*<\/td><td>Side<\/td>/) || [''])[0];
    rec('B Print today: H1 Side (already ticked cut) is not printed as an empty ☐ to cut again', !/☐<\/td><td>Side/.test(sideRow), sideRow || 'Side row not printed');
    // release on H2's row ticked -> list done again; relOpen false; readiness green
    await tapL(A.page, 'data-rt', 'L2', 1);
    const s2 = await st(A.page, 'L2', 1);
    rec('B ticking the released row closes H2 again (done, green)', s2.done && !s2.relOpen && s2.side === 'done' && (await A.page.evaluate(() => woReady('WO-2').lvl)) === 'green', JSON.stringify(s2));
    // untick a finished row on a done list via stale "rel" left in data (H3): does it reopen correctly as work?
    await A.page.evaluate(() => { const k = listRows(lists()[0]).map(rowKey)[1]; delete DB.listRow.L3[k]; render(); });
    const s3 = await st(A.page, 'L3', 1);
    info('B H3 after untick of released row (rel kept in data): ', JSON.stringify(s3) + ' onQueue=' + (await onQueue(A.page, 'House 3')));
    await A.close();
  }

  // ---------- C. Waiting book grouping: case / space / unicode variants ----------
  {
    const MATS = ['MFC White', 'mfc white ', ' MFC WHITE', ' MFC White ', 'MFC  White', 'MFC White', 'MFC White\t', 'Lamé Oak', 'Lamé Oak'];
    const rows = MATS.map((m, i) => ({ k: 'saw', item: 'P' + i, qty: 1, L: 100 + i, W: 100, mat: m, note: '' }));
    rows.push({ k: 'saw', item: 'NoMat', qty: 1, L: 1, W: 1, mat: '   ', note: '' });
    const S = makeServer(mk({ H1: rows }, [L('L1', 'H1', 'House 1', rows.length, 'WO-1')]));
    const A = await dev(browser, S);
    for (let i = 0; i < rows.length; i++) await tapL(A.page, 'data-rna', 'L1', i);
    await save(A.page);
    const P = await dev(browser, S, 'prod');
    const g = await P.page.evaluate(() => [...document.querySelectorAll('[data-relg]')].map(b => b.dataset.relg + ' (' + (b.closest('.hold-grp').querySelectorAll('.wl-drow').length) + ')'));
    console.log('     groups: ' + JSON.stringify(g));
    const white = g.filter(x => /mfc\s+white/i.test(x.replace(/ /g, ' ')));
    rec('C case/trailing-space/tab/edge-NBSP variants all in one "MFC White" group', white.some(x => /\((5)\)$/.test(x)), JSON.stringify(white));
    rec('C internal double space / NBSP inside the name ("MFC  White", "MFC\\u00a0White") also join the MFC White group', white.length === 1, white.length + ' MFC White groups: ' + JSON.stringify(white));
    rec('C "Lamé Oak" typed two ways (NFC vs NFD) is one group', g.filter(x => /Lam/.test(x)).length === 1, JSON.stringify(g.filter(x => /Lam/.test(x))));
    rec('C blank (spaces-only) material shows as "(material not named)"', g.some(x => /^\(material not named\)/.test(x)), JSON.stringify(g));
    // sheets panel must agree with the book (same board = same group in both)
    const sp = await A.page.evaluate(() => { const r = sheetNeed(lists(), '2000-01-01', '2100-01-01'); return JSON.stringify(r).slice(0, 600); });
    info('C sheets panel for same data', sp);
    // Release all on the first group: every variant in that group released
    await P.page.evaluate(() => { const b = [...document.querySelectorAll('[data-relg]')].find(b => /^mfc white$/i.test(b.dataset.relg.trim())); b.click(); });
    await P.page.waitForTimeout(100); await save(P.page); await reload(A.page);
    const rel = await A.page.evaluate(() => listRows(lists()[0]).map(r => (holdsOf('L1')[rowKey(r)] || {}).st || '-').join(','));
    rec('C Release all "MFC White" releases rows 0-3 and 6 (tab)', /^rel,rel,rel,rel,[^,]+,[^,]+,rel/.test(rel), rel);
    info('C rows 4/5 (internal double space / NBSP) after Release all', rel.split(',').slice(4, 6).join(','));
    await A.close(); await P.close();
  }

  // ---------- D. Stale Release all from another device ----------
  const ROWS2 = [{ k: 'saw', item: 'Side', qty: 4, L: 2400, W: 600, mat: 'MFC White', note: '' }, { k: 'saw', item: 'Top', qty: 2, L: 1200, W: 600, mat: 'MFC White', note: '' }];
  const relAll = async p => { const r = await p.evaluate(() => { const b = document.querySelector('[data-relg]'); if (!b) return 'none'; b.click(); return 'ok'; }); await p.waitForTimeout(100); return r; };
  // D1: P sees both waiting. A un-N/As both and cuts both (list done). P presses stale Release all.
  {
    const S = makeServer(mk({ H1: ROWS2 }, [L('L1', 'H1', 'House 1', 2, 'WO-1')]));
    const A = await dev(browser, S); await tapL(A.page, 'data-rna', 'L1', 0); await tapL(A.page, 'data-rna', 'L1', 1); await save(A.page);
    const P = await dev(browser, S, 'prod');
    await reload(A.page); await tapL(A.page, 'data-rna', 'L1', 0); await tapL(A.page, 'data-rna', 'L1', 1);
    await tapL(A.page, 'data-rt', 'L1', 0); await tapL(A.page, 'data-rt', 'L1', 1); await save(A.page);
    rec('D1 P stale Release all clicked', (await relAll(P.page)) === 'ok'); await save(P.page);
    await reload(A.page); await reload(P.page);
    const a = [await st(A.page, 'L1', 0), await st(A.page, 'L1', 1)];
    rec('D1 list stays done, both ticked, not on queue, green', a.every(x => x.done && x.ticked && x.side === 'done') && !(await onQueue(A.page, 'House 1')) && (await A.page.evaluate(() => woReady('WO-1').lvl)) === 'green', JSON.stringify(a));
    rec('D1 Production shows nothing waiting', (await P.page.evaluate(() => allHolds(['saw'], 'hold').length)) === 0);
    const pr = await A.page.evaluate(() => { window.__opened = []; printWorkList('saw', 1); return window.__opened.slice(-1)[0] || 'NOTHING'; });
    rec('D1 Print today has nothing for House 1', !/House 1/.test(pr));
    rec('D1 combined list empty for House 1', (await A.page.evaluate(() => combineLists(lists(), 'saw').length)) === 0);
    // A unticks Side afterwards (mistake): the line becomes real work again, list on queue
    await A.page.evaluate(() => { wlShowDone = true; render(); });
    await tapL(A.page, 'data-rt', 'L1', 0); await A.page.evaluate(() => { wlShowDone = false; render(); });
    const u = await st(A.page, 'L1', 0);
    info('D1 after untick of Side on done list (stale rel underneath)', JSON.stringify(u) + ' onQueue=' + (await onQueue(A.page, 'House 1')) + ' ready=' + (await A.page.evaluate(() => woReady('WO-1').lvl)));
    if (u.ticked) info('D1 untick from Done tab not reachable by this helper (button not found) — skipped'); else rec('D1 untick never leaves the bench with an untickable unfinished line', !(u.side !== 'done' && !u.ticked && (await A.page.evaluate(() => !tickableRows(lists()[0], 'saw').some(r => !rowTicked('L1', rowKey(r)))))), JSON.stringify(u));
    await A.close(); await P.close();
  }
  // D2: A ticks one, unticks it, ticks again while P presses stale Release all in between saves
  {
    const S = makeServer(mk({ H1: ROWS2 }, [L('L1', 'H1', 'House 1', 2, 'WO-1')]));
    const A = await dev(browser, S); await tapL(A.page, 'data-rna', 'L1', 0); await save(A.page);
    const P = await dev(browser, S, 'prod'); const P2 = await dev(browser, S, 'office');
    await reload(A.page); await tapL(A.page, 'data-rna', 'L1', 0); await tapL(A.page, 'data-rt', 'L1', 0); await save(A.page); // un-N/A + tick
    await relAll(P.page); await save(P.page);
    await reload(A.page); await tapL(A.page, 'data-rt', 'L1', 0); await save(A.page); // untick
    await P2.page.evaluate(() => { showTab('l'); }); const p2 = await P2.page.evaluate(() => { const b = document.querySelector('[data-relg]'); if (b) { b.click(); return 'clicked'; } return 'none'; });
    await P2.page.waitForTimeout(100); await P2.page.evaluate(() => { const b = document.querySelector('#pick-ok,.pod-ovl [data-pick]'); if (b) b.click(); }); await save(P2.page);
    await reload(A.page); await tapL(A.page, 'data-rt', 'L1', 1); await save(A.page);
    const a0 = await st(A.page, 'L1', 0), a1 = await st(A.page, 'L1', 1);
    info('D2 office stale Release (' + p2 + ') — Side after tick/rel/untick', JSON.stringify(a0));
    rec('D2 Side (unticked, not cut) is work: open/tickable, not hidden and not WAITING', !a0.ticked && !a0.held && (await A.page.evaluate(() => tickableRows(lists()[0], 'saw').some(r => r.item === 'Side'))), JSON.stringify(a0));
    rec('D2 list not marked done while Side uncut; readiness red/open', !a1.done || a0.relOpen, JSON.stringify({ a0, a1, rd: await A.page.evaluate(() => woReady('WO-1')) }));
    await tapL(A.page, 'data-rt', 'L1', 0); await save(A.page); await reload(A.page);
    const f = await st(A.page, 'L1', 0);
    rec('D2 after cutting Side: list done, green, off the queue', f.done && f.side === 'done' && !(await onQueue(A.page, 'House 1')), JSON.stringify(f));
    await A.close(); await P.close(); await P2.close();
  }
  // D3: Production offline presses Release all; meanwhile saw cuts everything; Production reconnects
  {
    const S = makeServer(mk({ H1: ROWS2 }, [L('L1', 'H1', 'House 1', 2, 'WO-1')]));
    const A = await dev(browser, S); await tapL(A.page, 'data-rna', 'L1', 0); await tapL(A.page, 'data-rna', 'L1', 1); await save(A.page);
    const P = await dev(browser, S, 'prod');
    S.offline = true; await relAll(P.page); await P.page.waitForTimeout(300); await save(P.page).catch(() => {});
    const told = await P.page.evaluate(() => /not saved|offline|unsaved|failed|couldn/i.test(document.body.innerText));
    rec('D3 Production told the release did not save (offline)', told);
    S.offline = false;
    await reload(A.page); await tapL(A.page, 'data-rna', 'L1', 0); await tapL(A.page, 'data-rna', 'L1', 1); await tapL(A.page, 'data-rt', 'L1', 0); await tapL(A.page, 'data-rt', 'L1', 1); await save(A.page);
    await P.page.evaluate(async () => { await loadDB(); }); await P.page.waitForTimeout(500); await save(P.page);
    await reload(A.page);
    const a = [await st(A.page, 'L1', 0), await st(A.page, 'L1', 1)];
    rec('D3 after reconnect: cuts survive, list done, not reopened', a.every(x => x.ticked && x.done && x.side === 'done') && !(await onQueue(A.page, 'House 1')), JSON.stringify(a));
    rec('D3 the offline release reached the server (saved, not lost)', JSON.stringify(S.row.settings.holdLog || []).includes('release'), JSON.stringify((S.row.settings.holdLog || []).map(x => x.act)));
    await A.close(); await P.close();
  }
  // D4: offline release, saw does NOT cut — release must land and show MATERIAL IN on the saw
  {
    const S = makeServer(mk({ H1: ROWS2 }, [L('L1', 'H1', 'House 1', 2, 'WO-1')]));
    const A = await dev(browser, S); await tapL(A.page, 'data-rna', 'L1', 0); await tapL(A.page, 'data-rt', 'L1', 1); await save(A.page);
    const P = await dev(browser, S, 'prod');
    S.offline = true; await relAll(P.page); await save(P.page).catch(() => {}); S.offline = false;
    await P.page.evaluate(async () => { await loadDB(); }); await P.page.waitForTimeout(500); await save(P.page);
    await reload(A.page);
    const a = await st(A.page, 'L1', 0);
    rec('D4 offline release lands after reconnect: Side released, list open, MATERIAL IN on saw', a.raw === 'rel' && a.relOpen && a.side === 'open' && (await A.page.evaluate(() => /MATERIAL IN — DO NOW/.test(document.body.innerText))), JSON.stringify(a));
    await A.close(); await P.close();
  }

  // ---------- E. Phone widths: Saw, Stores, Production ----------
  {
    const LONG = 'Tall larder end panel left hand with scribe — O\'Grady 🙂 special very long name indeed';
    const NOSP = 'EGGER_H1145_ST10_NATURAL_BARDOLINO_OAK_18MM_MFC_2800x2070';
    for (const [tag, nm, mat] of [['long', LONG, NOSP], ['short', 'P', 'Oak']]) {
      const rows = [{ k: 'saw', item: nm, qty: '2x2', L: 2400, W: 600, mat, note: 'ABS 1mm all round' }, { k: 'saw', item: 'Top', qty: 2, L: 1200, W: 600, mat: 'MFC White', note: '' }, { k: 'fit', item: nm, qty: 10, mat, note: '' }, { k: 'fit', item: 'Hinge', qty: 4, mat: 'Blum', note: '' }];
      const hn = tag === 'long' ? 'House 12 — Apartment block C, floor 3, utility + boot room' : 'H1';
      const ls = [L('L1', 'H1', hn, 2, 'WO-1', { fit: 2 }), L('L2', 'H1', hn + ' B', 2, 'WO-2', { fit: 2 })];
      for (const w of [320, 360, 380, 412]) {
        const S = makeServer(mk({ H1: rows }, ls, [H.order({ wo: 'WO-1', dueDate: '2026-10-22', origDueDate: '2026-10-22', customer: tag === 'long' ? 'Cairn Homes Properties Designated Activity Company' : 'C' }), H.order({ wo: 'WO-2', dueDate: '2026-10-22', origDueDate: '2026-10-22' })]));
        const seed = await dev(browser, S); await tapL(seed.page, 'data-rna', 'L1', 0); await save(seed.page); await seed.close();
        for (const role of ['saw', 'stores', 'prod']) {
          const T = await dev(browser, S, role, { viewport: { width: w, height: 800 } });
          const views = role === 'prod' ? [['main', () => {}]] : [['queue', () => { wlShowHold = false; render(); }], ['waiting', () => { wlShowHold = true; render(); }], ['combined', () => { wlShowHold = false; render(); openCombined(lists(), ROLE === 'saw' ? 'saw' : 'fit'); }]];
          for (const [vn, fn] of views) {
            const m = await T.page.evaluate(fs => { new Function(fs)(); const de = document.documentElement; const over = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width) return; let p = e.parentElement, cl = false; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox !== 'visible') { cl = true; break; } p = p.parentElement; } if (!cl && r.right > innerWidth + 1) over.push(e.tagName + '.' + e.className + ':' + Math.round(r.right) + ':' + (e.textContent || '').trim().slice(0, 25)); });
              const btn = [...document.querySelectorAll('[data-relg],[data-rel1]')].map(b => b.getBoundingClientRect()).filter(r => r.width && (r.right > innerWidth + 1 || r.left < -1)).length;
              const o = document.querySelector('.pod-ovl'); if (o) o.remove(); return { docW: de.scrollWidth, vw: innerWidth, over: over.slice(0, 3), n: over.length, btn }; }, `(${fn.toString()})()`);
            rec(`E ${w}px ${role}/${vn}/${tag}: no sideways scroll, nothing off-screen, release buttons on screen`, m.docW <= m.vw + 1 && m.n === 0 && m.btn === 0, JSON.stringify(m));
          }
          await T.close();
        }
      }
    }
  }

  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); if (f) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
