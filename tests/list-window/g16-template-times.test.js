// Garry, 16 Nov 2026: "can I have an option to multiply a template by a quantity and be able to name it, for example Floor 2".
// Picking a house-type template now asks "How many?" (default 1) and "Name it" (optional). Fake Supabase only.
// Run: node tests/list-window/g16-template-times.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks, rows } = L;
const pick = async (p, tid) => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
  await p.evaluate(tid => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-itt="' + tid + '"]').click(); }, tid); await sleep(800); };
const fillIns = async (p, n, name, enter) => { await p.fill('#it-hn', String(n)); await p.fill('#it-hname', name); if (enter) await p.press('#it-hname', 'Enter'); else await p.click('#it-hok'); await sleep(500); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' }, lines: [['hdr', 'Kitchen', null, null, null, null, '', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', 'scribe'], ['hdr', 'Stores items', null, null, null, null, '', '', { section: 'Kitchen' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''], ['fit', 'Handle', 'as drawn', null, null, 'Blum hinge', '', '']] });
    const tl = S.db.t.list_lines.filter(x => x.list_id === 'T1' && x.removed_rev == null);
    const tparts = tl.filter(x => x.kind !== 'hdr'), thdr = tl.filter(x => x.kind === 'hdr');
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // 1. × 1, no name → exactly as before
    await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
    await pick(p, 'T1');
    const ask = await p.evaluate(() => ({ n: (document.getElementById('it-hn') || {}).value, name: !!document.getElementById('it-hname'), ins: !!document.getElementById('it-hok'), focus: document.activeElement && document.activeElement.id }));
    rec('picking a template asks "How many?" (1, cursor in it) and "Name it" with an Insert button', ask.n === '1' && ask.name && ask.ins && ask.focus === 'it-hn', JSON.stringify(ask));
    await p.click('#it-hok'); await sleep(500);
    let r = await rows(p);
    rec('× 1 with no name → the template rows exactly as they are (' + tl.length + ' rows, same quantities)', r.length === tl.length && r.filter(x => !x.hdr).map(x => x.qty).join() === '2,1,8,as drawn', JSON.stringify(r.map(x => x.item + ':' + x.qty)));
    await closeAll(p);
    // 2. × 4 named "Floor 2"
    await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
    await pick(p, 'T1'); await fillIns(p, 4, '  Floor   2 ', false);
    r = await rows(p);
    rec('× 4 named "Floor 2" → a heading "Floor 2" first, then the template', r[0].hdr && r[0].item === 'Floor 2' && r.length === tl.length + 1, JSON.stringify(r.slice(0, 3)));
    rec('…every number quantity is × 4; "as drawn" is left as typed', r.filter(x => !x.hdr).map(x => x.qty).join() === '8,4,32,as drawn', JSON.stringify([r.filter(x => !x.hdr).map(x => x.qty), tparts.map(x => x.qty)]));
    const subs = await p.evaluate(() => [...document.querySelectorAll('.me-ed [data-row]')].slice(1).filter(tr => tr.querySelector('[data-mr$="|item"]') && /me-h|me-ch/.test(tr.className)).map(tr => /Sub/.test(tr.textContent)));
    rec('…the template\'s own headings (Kitchen, Stores items) become sub-headings under "Floor 2"', subs.length === 2 && subs.every(Boolean), JSON.stringify(subs));
    rec('…the "as drawn" row is flagged ⚠ ×4 — check qty in its note', await p.evaluate(() => [...document.querySelectorAll('.me-ed [data-mr$="|note"]')].some(e => /⚠ ×4 — check qty/.test(e.value))));
    // 3. Save → the saw gets the totals
    for (let i = 0; i < r.length; i++) { if (!r[i].hdr && !r[i].mat) await L.setv(p, i + '|mat', 'MFC White'); if (r[i].qty === 'as drawn') await L.setv(p, i + '|qty', '8'); } // the person checks the flagged row
    await p.click('#me-saveclose'); await sleep(2500);
    const sv = L.liveFor(S, 'WO-3');
    const ln = sv.length ? L.linesOf(S, sv[0].id) : [];
    rec('saved: the list has "Floor 2" and the × 4 quantities', sv.length === 1 && ln.some(x => x.kind === 'hdr' && x.part === 'Floor 2') && ln.filter(x => x.kind !== 'hdr').map(x => String(x.qty)).join() === '8,4,32,8', JSON.stringify(ln.map(x => x.kind + ':' + x.part + ':' + x.qty)));
    // 4. bad numbers
    await p.evaluate(() => openListEditor(null, 'WO-4')); await sleep(900);
    await pick(p, 'T1');
    for (const bad of ['0', '-2', '2.5', 'abc', '', '501']) { await p.fill('#it-hn', bad); await p.click('#it-hok'); await sleep(200); }
    const still = await p.evaluate(() => ({ open: !!document.getElementById('it-hok'), err: (document.getElementById('it-err') || {}).textContent }));
    rec('How many 0 / -2 / 2.5 / abc / blank / 501 → refused in words, nothing inserted', still.open && /whole number from 1 to 500/.test(still.err), JSON.stringify(still));
    // 5. Enter in the name box inserts; HTML in the name is text
    await fillIns(p, 2, '<img src=x onerror="window.__x=1">', true);
    r = await rows(p);
    rec('Enter in "Name it" inserts; HTML in the name stays text and never runs', r[0].item === '<img src=x onerror="window.__x=1">' && !(await p.evaluate(() => window.__x)), JSON.stringify(r[0]));
    // 6. Undo takes it all out
    await p.keyboard.press('Control+z'); await sleep(300);
    r = await rows(p);
    rec('Ctrl+Z takes the whole insert back out', !r.some(x => x.item && /onerror/.test(x.item)), JSON.stringify(r.length));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
