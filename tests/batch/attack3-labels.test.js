// Tester round 3 (21 Nov): the new house labels in the saw ⚡ BATCH tab (Floor + Unit, else WO, the list name small after it).
// 6 lists all named after one template; blank floor / unit / both; no job; job deleted mid-batch; the same floor/unit twice in one
// project and across two projects; a list on several WOs; a very long unit at 360 px; HTML in floor / unit / WO; lists switched off;
// and the Stores pop-up + printed labels byte-identical to origin/main (old code read with "git show", read-only). Fake Supabase only.
// Run: node tests/batch/attack3-labels.test.js
const F = require('../stage3/fix3.js');
const A = require('../stage3/atk.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 500) : '')); };
const sleep = F.sleep;
const OLD = A.gitShow('origin/main');
const view = p => p.evaluate(() => ({ chips: [...document.querySelectorAll('.sb-chip')].map(c => c.dataset.sbgo + '=' + c.innerText.replace(/\s+/g, ' ').replace(/ ×\d+.*$/, '')), houses: [...document.querySelectorAll('.sb-hl .sb-hn b')].map(x => x.innerText.replace(/\s+/g, ' ')),
  inj: document.querySelectorAll('.wl i, .wl img, .wl script, .sb-hn b b').length + (window.__x || 0) }));
const o = (wo, floor, unit, cust) => H.order({ wo, customer: cust || 'Aderrig Homes', floor, unit, dueDate: '2026-10-22', origDueDate: '2026-10-22' });
const LN = [['saw', 'Side', '2', 2400, 600, 'MFC White', '', ''], ['fit', 'Hinge', '4', null, null, 'Blum hinge', '', '']];
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = F.v2Row();
    row.orders = [o('WO-1', 'GF', '12'), o('WO-2', 'GF', ''), o('WO-3', '', '12'), o('WO-4', '', ''), o('WO-5', 'GF', '12'), o('WO-6', '1', '3'), o('WO-7', '2', '9'), o('WO-8', 'GF', '12', 'Lucan Homes'),
      o('WO-9', '<i>F</i>', '"><img src=x onerror=window.__x=1>'), o('WO-<b>10</b>', '', ''), o('WO-11', 'GF', 'BLOCK_C1.2_1ST_FLOOR_APARTMENT_31_PART_V_KITCHENS_AND_UTILITY_ROOM')];
    const S = F.makeServer(row);
    D.insert(S.db, 'projects', { id: 'P2', name: 'Lucan', customer: 'Lucan Homes' });
    const add = (id, wos, x) => F.seedList(S, id, Object.assign({ name: 'Type B kitchen', wos, lines: LN }, x || {}));
    add('L1', ['WO-1']); add('L2', ['WO-2']); add('L3', ['WO-3']); add('L4', ['WO-4']); add('L5', ['WO-5']); add('L6', [], { list: { deliver_by: '2026-10-22' } });
    add('L7', ['WO-6', 'WO-7']); add('L8', ['WO-8'], { list: { project_id: 'P2' } }); add('L9', ['WO-9']); add('L10', ['WO-<b>10</b>']); add('L11', ['WO-11']);
    const t = await F.dev(browser, S, 'saw'), p = t.page;
    await p.evaluate(() => { SB.read = true; SB.ids = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']; wlShowUpcoming = true; wlShowBatch = true; render(); }); await sleep(150);
    let v = await view(p);
    console.log('INFO 7 lists all "Type B kitchen" (one project): ' + v.houses.join(' | '));
    const H1 = id => (v.houses[['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'].indexOf(id)] || '');
    rec('blank unit → "Floor GF" only; blank floor → "Unit 12" only; both blank → the WO', /^Floor GF Type B kitchen$/.test(H1('L2')) && /^Unit 12 Type B kitchen$/.test(H1('L3')) && /^WO-4 Type B kitchen$/.test(H1('L4')), [H1('L2'), H1('L3'), H1('L4')].join(' | '));
    rec('the same Floor GF Unit 12 twice in one project → told apart with "(2)"', /^Floor GF Unit 12 Type B kitchen$/.test(H1('L1')) && /^Floor GF Unit 12 Type B kitchen \(2\)$/.test(H1('L5')), H1('L1') + ' | ' + H1('L5'));
    rec('a list with no job is shown by its name (and only one house shows just "Type B kitchen")', v.houses.filter(h => h === 'Type B kitchen').length === 1, v.houses.join(' | '));
    rec('a list on TWO work orders (WO-6 Floor 1 Unit 3 + WO-7 Floor 2 Unit 9): the label names both units', /3/.test(H1('L7')) && /9/.test(H1('L7')), H1('L7'));
    rec('every chip label = its house line label (same text in the table and the house list)', ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'].every((id, i) => v.chips.some(c => c === id + '=' + v.houses[i])), JSON.stringify(v.chips));
    // job deleted from the planner mid-batch
    await p.evaluate(() => { DB.orders = DB.orders.filter(x => x.wo !== 'WO-3'); render(); }); await sleep(100);
    v = await view(p);
    rec('job WO-3 deleted from the planner mid-batch: the house is still labelled (falls back to "WO-3") and the page does not break', v.houses.some(h => /^WO-3 Type B kitchen$/.test(h)), v.houses.join(' | '));
    // across two projects, the same Floor / Unit; HTML; long unit
    await p.evaluate(() => { SB.ids = ['L1', 'L8', 'L9', 'L10', 'L11']; wlShowBatch = true; render(); }); await sleep(150);
    v = await view(p);
    console.log('INFO two projects + odd values: ' + v.houses.join(' | '));
    rec('same Floor GF Unit 12 in two projects → the project first tells them apart (no "(2)")', v.houses.some(h => /^Aderrig — Floor GF Unit 12/.test(h)) && v.houses.some(h => /^Lucan — Floor GF Unit 12/.test(h)) && !v.houses.some(h => /\(2\)/.test(h)), v.houses.join(' | '));
    rec('HTML in floor / unit / WO is shown as text', !v.inj && v.houses.some(h => h.includes('<i>F</i>')) && v.houses.some(h => h.includes('WO-<b>10</b>')), JSON.stringify(v));
    await p.setViewportSize({ width: 360, height: 740 }); await sleep(200);
    const sw = await p.evaluate(() => { const over = [...document.querySelectorAll('.wl *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth, vw: innerWidth, over: over.slice(0, 4) }; });
    rec('360 px: a 70-character unit ("BLOCK_C1.2_1ST_FLOOR_…") does not push the page sideways', sw.sw <= sw.vw && !sw.over.length, JSON.stringify(sw));
    await p.setViewportSize({ width: 1400, height: 900 });
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    // ---------- Stores pop-up + printed labels: branch = origin/main ----------
    if (!OLD) rec('origin/main readable', false);
    else {
      const capture = async (pg, mode) => pg.evaluate(async mode => { const out = []; window.open = () => ({ document: { _h: '', write(h) { this._h += h; out.push(this._h); }, close() {} }, focus() {}, print() {}, close() {} });
        const ls = lists().filter(l => ['L1', 'L2', 'L5', 'L7', 'L9'].includes(l.id));
        printLabels(ls, mode); printLabels([ls[0]], mode);
        document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); openCombined(ls, mode); await new Promise(r => setTimeout(r, 100));
        const ov = [...document.querySelectorAll('.pod-ovl, [id^="cmb"]')].map(x => x.outerHTML).join(''); document.querySelectorAll('.pod-ovl').forEach(x => x.remove());
        return { labels: out.map(h => h.replace(/\s+/g, ' ')), comb: ov.replace(/\s+/g, ' ') }; }, mode);
      const nw = await F.dev(browser, S, 'stores');
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Dublin' });
      await ctx.addInitScript(`(()=>{const T=${+new Date(F.NOW)};const R=Date;const off=T-R.now();class D extends R{constructor(...a){if(a.length===0){super(R.now()+off);}else super(...a);}static now(){return R.now()+off;}}D.UTC=R.UTC;D.parse=R.parse;window.Date=D;})();`);
      await ctx.addInitScript(() => { localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); sessionStorage.setItem('wpfWho', 'Op'); localStorage.setItem('wpfOpName', 'Op'); window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'Op'; });
      const old = await A.openOld(browser, S, OLD, { ctx });
      await old.page.evaluate(async () => { localStorage.setItem('wpfPin_stores', '9000'); setRole('stores'); while (LST.loading) await LST.loading; if (!LST.loaded) await lsLoad(); render(); });
      for (const mode of ['fit', 'saw']) {
        const a = await capture(nw.page, mode), b = await capture(old.page, mode);
        rec('printed labels (' + mode + '): branch HTML = origin/main HTML', JSON.stringify(a.labels) === JSON.stringify(b.labels) && a.labels.length === 2, a.labels.length + ' vs ' + b.labels.length + ' ' + (a.labels[0] || '').slice(0, 120));
        rec('combined pop-up (' + mode + '): branch HTML = origin/main HTML', a.comb === b.comb && a.comb.length > 100, a.comb.length + ' vs ' + b.comb.length);
      }
      await nw.close(); await ctx.close();
    }
    // ---------- lists switched off ----------
    {
      const r = F.v2Row(); delete r.settings.listStore; delete r.settings.listStoreAt;
      r.orders = [o('WO-1', 'GF', '12'), o('WO-2', 'GF', '12')];
      r.settings.lists = [{ id: 'OL1', wb: 'W1', sheet: 'H1', name: 'Type B kitchen', project: 'Old', saw: 1, fit: 0, wos: ['WO-1'], up: F.NOW }, { id: 'OL2', wb: 'W1', sheet: 'H1', name: 'Type B kitchen', project: 'Old', saw: 1, fit: 0, wos: ['WO-2'], up: F.NOW }];
      r.settings.listWBs = { W1: { project: 'Old', sheets: { H1: [{ k: 'saw', item: 'Side', qty: 2, L: 2400, W: 600, mat: 'MFC White', note: '' }] } } };
      const S2 = F.makeServer(r), t2 = await F.dev(browser, S2, 'saw'), q = t2.page;
      await q.evaluate(() => { SB.read = true; SB.ids = ['OL1', 'OL2']; wlShowBatch = true; render(); }); await sleep(100);
      const v2 = await view(q);
      rec('lists OFF: old-style lists get the same labels (Floor GF Unit 12, then "(2)")', v2.houses.join('|') === 'Floor GF Unit 12 Type B kitchen|Floor GF Unit 12 Type B kitchen (2)', v2.houses.join(' | '));
      rec('lists OFF: no page errors', !(S2.errors || []).length, JSON.stringify(S2.errors));
      await t2.close();
    }
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
