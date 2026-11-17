// Garry 17 Nov: "a material/fittings can be added to multiple cutting list templates together". Lists page → project row →
// "＋ Add to several templates": one row into every template ticked, under a heading; new Rev each; already there = left alone;
// a × block never multiplies it by accident; other templates and lists untouched; PM / office don't get the button.
// Fake Supabase only. Run: node tests/list-window/g17-add-to-templates.test.js
const L = require('./lw.js');
const { X, sleep, rec, closeAll, asks } = L;
const M = 'MFC White', HB = 'Blum hinge';
const live = (S, id) => S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev == null).sort((a, b) => a.seq - b.seq);
(async () => {
  const browser = await X.H.chromium.launch(); let S;
  try {
    S = X.makeServer(X.v2Row());
    const T = (id, nm, lines) => X.F3.seedList(S, id, { wos: [], name: nm, list: { is_template: true, type_name: nm, list_type: 'kitchen' }, lines });
    T('T1', 'T1 RH', [['hdr', 'Worktops', null, null, null, null, '', ''], ['saw', 'Worktop', '1', 3600, 600, M, '', ''], ['hdr', 'Fittings', null, null, null, null, '', ''], ['fit', 'Tap', '1', null, null, HB, '', '']]);
    T('T2', 'T2 LH', [['hdr', 'Worktops', null, null, null, null, '', ''], ['saw', 'Worktop', '1', 1600, 600, M, '', '']]);
    T('T3', 'T3 LH', [['hdr', 'Fittings', null, null, null, null, '', ''], ['fit', 'Handle', '20', null, null, HB, '', '']]);
    T('TX', 'Floor ×4', [['hdr', 'Floor 2', '4', null, null, null, '', ''], ['fit', 'Leg', '32', null, null, HB, '', '', { unit_qty: '8' }]]);
    T('T4', 'Not ticked', [['fit', 'Glue', '1', null, null, HB, '', '']]);
    X.F3.seedList(S, 'LL', { wos: ['WO-1'], name: 'A house list' });
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); for (const id of ['T1', 'T2', 'T3', 'TX', 'T4']) await lsReloadList(id); window.__alerts = []; window.alert = m => window.__alerts.push(String(m)); lpfSet(''); render(); }); await sleep(600);
    const btn = await p.evaluate(() => !!document.querySelector('[data-lhtpladd="P1"]'));
    rec('Drawing office: "＋ Add to several templates" on the project row', btn);
    const before = { T4: JSON.stringify(live(S, 'T4')), LL: JSON.stringify(live(S, 'LL')) }, rev0 = S.db.t.lists.find(l => l.id === 'T1').rev || 1;
    const run = async (vals, ticks) => { await closeAll(p); await p.evaluate(() => lsTplAddDlg('P1')); await sleep(300);
      await p.evaluate(({ vals, ticks }) => { for (const [k, v] of Object.entries(vals)) { const e = document.getElementById(k); e.value = v; e.dispatchEvent(new Event('input')); } document.querySelectorAll('[data-tat]').forEach(c => { c.checked = ticks.includes(c.dataset.tat); }); window.__asked = []; document.getElementById('ta-go').click(); }, { vals, ticks }); await sleep(3500); };
    await run({ 'ta-item': 'Hinge', 'ta-qty': '8', 'ta-mat': HB, 'ta-head': 'Fittings' }, ['T1', 'T2', 'T3', 'TX']);
    const t1 = live(S, 'T1').map(x => x.part), t2 = live(S, 'T2').map(x => x.part + '|' + x.kind), t3 = live(S, 'T3').map(x => x.part);
    rec('T1: Hinge added at the end of its "Fittings" heading (after Tap)', JSON.stringify(t1) === JSON.stringify(['Worktops', 'Worktop', 'Fittings', 'Tap', 'Hinge']), JSON.stringify(t1));
    rec('T2 (no "Fittings" heading): a "Fittings" heading is made at the end with Hinge under it, Stores row', JSON.stringify(t2) === JSON.stringify(['Worktops|hdr', 'Worktop|saw', 'Fittings|hdr', 'Hinge|fit']), JSON.stringify(t2));
    rec('T3: Hinge under Fittings', JSON.stringify(t3) === JSON.stringify(['Fittings', 'Handle', 'Hinge']), JSON.stringify(t3));
    const tx = live(S, 'TX').map(x => x.part + ':' + x.qty + (x.unit_qty ? '/' + x.unit_qty : ''));
    rec('TX (a "Floor 2 × 4" block, no Fittings heading): the Hinge goes under its own heading, qty 8 — NOT × 4, the block\'s 32 unchanged', tx.includes('Leg:32/8') && tx.includes('Hinge:8') && tx.some(x => /^Fittings:/.test(x)), JSON.stringify(tx));
    rec('each ticked template got a new Rev with the reason', S.db.t.lists.filter(l => ['T1', 'T2', 'T3', 'TX'].includes(l.id)).every(l => (+l.rev || 1) === rev0 + 1), JSON.stringify(S.db.t.lists.filter(l => l.is_template).map(l => l.id + ':' + l.rev)));
    rec('the template NOT ticked and the house list are untouched', JSON.stringify(live(S, 'T4')) === before.T4 && JSON.stringify(live(S, 'LL')) === before.LL);
    // again → already there
    await run({ 'ta-item': 'hinge', 'ta-qty': '8', 'ta-mat': HB, 'ta-head': 'Fittings' }, ['T1', 'T3']);
    const al = await p.evaluate(() => window.__alerts.slice(-1)[0] || '');
    rec('the same item + material again → left alone and said so ("Already there")', /Already there/.test(al) && live(S, 'T1').filter(x => /hinge/i.test(x.part)).length === 1, al);
    // a saw part
    await run({ 'ta-item': 'Kicker', 'ta-qty': '2', 'ta-l': '2400', 'ta-w': '150', 'ta-mat': M, 'ta-head': '' }, ['T2']);
    const k = live(S, 'T2').find(x => x.part === 'Kicker');
    rec('a saw part (L × W) with no heading → added at the end as a saw row 2400 × 150', k && k.kind === 'saw' && +k.length_mm === 2400 && +k.width_mm === 150, JSON.stringify(k));
    // checks
    await run({ 'ta-item': 'Shelf', 'ta-qty': '1.5', 'ta-l': '500', 'ta-w': '300' }, ['T2']);
    const e1 = await p.evaluate(() => (document.getElementById('ta-err') || {}).textContent || '');
    rec('a saw part with qty 1.5 is refused in words (the saw can\'t cut half a part); nothing saved', /half/.test(e1) && !live(S, 'T2').some(x => x.part === 'Shelf'), e1);
    await run({ 'ta-item': 'Shelf', 'ta-qty': '1', 'ta-l': '500' }, ['T2']);
    rec('a length with no width is refused', /BOTH/.test(await p.evaluate(() => (document.getElementById('ta-err') || {}).textContent || '')));
    await run({ 'ta-item': 'Shelf', 'ta-qty': '1' }, []);
    rec('nothing ticked → "Tick at least one template"', /Tick at least one/.test(await p.evaluate(() => (document.getElementById('ta-err') || {}).textContent || '')));
    await closeAll(p);
    // another PC changed T3 a moment ago → that one is NOT added, and said so
    await p.evaluate(async () => { await lsReloadList('T3'); }); const v = S.db.t.lists.find(l => l.id === 'T3'); 
    await p.evaluate(() => lsTplAddDlg('P1')); await sleep(300);
    v.version = (+v.version || 1) + 5; // the database moved on (another PC) after this screen loaded it — the add reloads first, so it still goes in
    await p.evaluate(() => { const s = (id, x) => { document.getElementById(id).value = x; }; s('ta-item', 'Bin'); s('ta-qty', '1'); s('ta-mat', 'Blum hinge'); document.querySelectorAll('[data-tat]').forEach(c => c.checked = c.dataset.tat === 'T3'); document.getElementById('ta-go').click(); }); await sleep(3000);
    rec('a template changed on another PC since this screen loaded it: the add re-reads it first, so the Bin is added and their change kept', live(S, 'T3').some(x => x.part === 'Bin') && live(S, 'T3').some(x => x.part === 'Handle'));
    // roles
    for (const role of ['pm', 'office']) { await p.evaluate(rl => { ROLE = rl; render(); }, role); await sleep(300);
      rec(role + ': no "＋ Add to several templates" button', !(await p.evaluate(() => !!document.querySelector('[data-lhtpladd]')))); }
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
