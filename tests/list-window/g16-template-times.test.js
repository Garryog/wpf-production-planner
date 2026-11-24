// Garry, 16 Nov 2026: "multiply a template by a quantity and name it, for example Floor 2" — then: "the option for multiplying
// needs to be INSIDE the cutting list". So: (a) any heading in the list can be made "× Multiply" (the rows under it, and under its
// sub-headings, × a number that can be changed any time); (b) a template brought in with How many? / Name it becomes such a block.
// Fake Supabase only. Run: node tests/list-window/g16-template-times.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks, rows, setv } = L;
const TPL = [['hdr', 'Kitchen', null, null, null, null, '', ''], ['saw', 'Side', '2', 720, 560, 'MFC White', '1mm ABS', ''], ['saw', 'Top', '1', 1200, 560, 'MFC White', '', 'scribe'], ['hdr', 'Stores items', null, null, null, null, '', '', { section: 'Kitchen' }], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', ''], ['fit', 'Handle', 'as drawn', null, null, 'Blum hinge', '', '']];
const pick = async (p, tid) => { await p.evaluate(() => { const d = document.getElementById('me-start'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('me-instpl').click(); }); await sleep(500);
  await p.evaluate(tid => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('[data-itt="' + tid + '"]').click(); }, tid); await sleep(800); };
const fillIns = async (p, n, name, enter) => { await p.fill('#it-hn', String(n)); await p.fill('#it-hname', name); if (enter) await p.press('#it-hname', 'Enter'); else await p.click('#it-hok'); await sleep(500); };
const tots = p => p.evaluate(() => [...document.querySelectorAll('[data-tot]')].map(e => e.textContent.trim()).join('|'));
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' }, lines: TPL });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // 1. × 1, no name → exactly as before
    await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
    await pick(p, 'T1');
    const ask = await p.evaluate(() => ({ n: (document.getElementById('it-hn') || {}).value, name: !!document.getElementById('it-hname'), ins: !!document.getElementById('it-hok'), focus: document.activeElement && document.activeElement.id }));
    rec('picking a template asks "How many?" (1, cursor in it) and "Name it", with Insert', ask.n === '1' && ask.name && ask.ins && ask.focus === 'it-hn', JSON.stringify(ask));
    await p.click('#it-hok'); await sleep(500);
    let r = await rows(p);
    rec('× 1 with no name → the template rows exactly as they are, no × block', r.length === 6 && !r.some(x => x.units) && r.filter(x => !x.hdr).map(x => x.qty).join() === '2,1,8,as drawn', JSON.stringify(r.map(x => x.item + ':' + (x.qty || x.units || ''))));
    await closeAll(p);
    // 2. × 4 named "Floor 2" → a × block IN the list
    await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(900);
    await pick(p, 'T1'); await fillIns(p, 4, '  Floor   2 ', false);
    r = await rows(p);
    rec('× 4 named "Floor 2" → heading "Floor 2" × 4 first, the template\'s headings under it as sub-headings', r[0].hdr && r[0].item === 'Floor 2' && r[0].units === '4' && r.length === 7 && !r.slice(1).some(x => x.units), JSON.stringify(r.slice(0, 3)));
    rec('…the quantities stay as in the template (for ONE); the totals shown are × 4', r.filter(x => !x.hdr).map(x => x.qty).join() === '2,1,8,as drawn' && (await tots(p)) === '= 8|= 4|= 32|= as drawn', await tots(p));
    rec('…the "as drawn" row is flagged ⚠ ×4 — check qty', await p.evaluate(() => [...document.querySelectorAll('.me-ed [data-mr$="|note"]')].some(e => /⚠ ×4 — check qty/.test(e.value))));
    // 3. change the × in the list → every total follows (also under the sub-headings)
    await setv(p, '0|units', '6'); await sleep(300);
    rec('changing × 4 to × 6 IN the list → every total follows, under both sub-headings', (await tots(p)) === '= 12|= 6|= 48|= as drawn', await tots(p));
    // 4. save → totals to the saw, the number on the × heading only; reopen → same
    const hi = (await rows(p)).findIndex(x => x.qty === 'as drawn'); await setv(p, hi + '|qty', '2'); await sleep(150);
    await p.click('#me-saveclose'); await sleep(2500);
    const sv = L.liveFor(S, 'WO-3'), ln = sv.length ? L.linesOf(S, sv[0].id) : [];
    rec('saved: "Floor 2" carries 6; the sub-headings carry none; the saw gets the totals 12 / 6, stores 48 / 12', sv.length === 1 && ln.map(x => x.kind + ':' + x.part + ':' + (x.qty == null ? '' : x.qty)).join() === 'hdr:Floor 2:6,hdr:Kitchen:,saw:Side:12,saw:Top:6,hdr:Stores items:,fit:Hinge:48,fit:Handle:12', JSON.stringify(ln.map(x => x.kind + ':' + x.part + ':' + x.qty + ':' + (x.unit_qty || ''))));
    await p.evaluate(id => openListEditor(id), sv[0].id); await sleep(1000);
    r = await rows(p);
    rec('reopened: still Floor 2 × 6 with the per-one quantities and the same totals', r[0].units === '6' && !r.slice(1).some(x => x.units) && (await tots(p)) === '= 12|= 6|= 48|= 12', JSON.stringify([r[0], await tots(p)]));
    await closeAll(p);
    // 5. × Multiply on any heading in the list
    await p.evaluate(() => lsNewStd('WO-4')); await sleep(900);
    await setv(p, '2|item', 'Kicker'); await setv(p, '2|qty', '2'); await setv(p, '2|L', '2780'); await setv(p, '2|W', '145'); await setv(p, '2|mat', 'MFC White'); await sleep(150);
    const opts = await p.evaluate(() => [...document.querySelector('[data-mhs="0"]').options].map(o => o.textContent));
    rec('a heading\'s type list offers Heading / Sub-heading / × Multiply…', JSON.stringify(opts) === '["Heading","Sub-heading","× Multiply…"]', JSON.stringify(opts));
    await p.evaluate(() => { window.__prompt = '3'; const e = document.querySelector('[data-mhs="0"]'); e.value = 'mul'; e.dispatchEvent(new Event('change')); }); await sleep(400);
    r = await rows(p);
    rec('× Multiply… → asked how many (3): the heading is × 3, the Kicker under its sub-heading shows "= 6"', r[0].units === '3' && r[2].qty === '2' && (await tots(p)).startsWith('= 6'), JSON.stringify([r[0], await tots(p)]));
    for (const bad of ['0', 'abc', '2.5', '501']) { await p.evaluate(b => { window.__prompt = b; const e = document.querySelector('[data-mhs="0"]'); if (e) { e.value = ''; e.dispatchEvent(new Event('change')); } }, bad); break; }
    r = await rows(p);
    rec('back to "Heading (no ×)" → the × goes and the Kicker keeps its TOTAL (6)', !r[0].units && r[2].qty === '6', JSON.stringify([r[0], r[2]]));
    for (const bad of ['0', 'abc', '2.5', '501']) {
      await p.evaluate(b => { window.__prompt = b; const e = document.querySelector('[data-mhs="0"]'); e.value = 'mul'; e.dispatchEvent(new Event('change')); }, bad); await sleep(250);
    }
    r = await rows(p);
    rec('× Multiply with 0 / abc / 2.5 / 501 → not changed', !r[0].units && r[2].qty === '6', JSON.stringify(r[0]));
    await p.evaluate(() => { window.__prompt = null; const e = document.querySelector('[data-mhs="0"]'); e.value = 'mul'; e.dispatchEvent(new Event('change')); }); await sleep(250);
    rec('× Multiply then Cancel → not changed', !(await rows(p))[0].units);
    await p.keyboard.press('Control+z'); await sleep(250);
    rec('Ctrl+Z after turning × off brings the × 3 back', (await rows(p))[0].units === '3', JSON.stringify((await rows(p))[0]));
    await closeAll(p);
    // 6. bad How many / Enter / HTML in the name
    await p.evaluate(() => openListEditor(null, 'WO-5')); await sleep(900);
    await pick(p, 'T1');
    for (const bad of ['0', '-2', '2.5', 'abc', '', '501']) { await p.fill('#it-hn', bad); await p.click('#it-hok'); await sleep(150); }
    const still = await p.evaluate(() => ({ open: !!document.getElementById('it-hok'), err: (document.getElementById('it-err') || {}).textContent }));
    rec('How many 0 / -2 / 2.5 / abc / blank / 501 → refused in words', still.open && /whole number from 1 to 500/.test(still.err), JSON.stringify(still));
    await fillIns(p, 2, '<img src=x onerror="window.__x=1">', true);
    r = await rows(p);
    rec('Enter in "Name it" inserts; HTML in the name stays text and never runs', r[0].item === '<img src=x onerror="window.__x=1">' && r[0].units === '2' && !(await p.evaluate(() => window.__x)), JSON.stringify(r[0]));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
