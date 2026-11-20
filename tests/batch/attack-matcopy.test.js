// Tester attack (20 Nov), part D: ⧉ Copy materials from another project — beyond the Coder's checks. Fake Supabase only.
//  200 materials · an alias of the source = a name here · the same board from two DIFFERENT projects on two PCs at once ·
//  a source material retired / renamed on another PC after the window was opened · HTML in project names · ✕ while copying ·
//  stores role · lists switched off.
// Run: node tests/batch/attack-matcopy.test.js
const L = require('../list-window/lw.js');
const { X, D, sleep } = L;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const mats = (S, pid) => S.db.t.project_materials.filter(m => m.project_id === pid);
const dlg = p => p.evaluate(() => { const b = document.getElementById('mc-body'); if (!b) return null;
  return { txt: b.innerText.replace(/\s+/g, ' '), rows: [...b.querySelectorAll('[data-mcp]')].map(x => ({ id: x.dataset.mcp, on: x.checked, dis: x.disabled, txt: x.closest('label').innerText.replace(/\s+/g, ' ') })),
    ok: (b.querySelector('#mc-ok') || {}).textContent || null, okDis: !!(b.querySelector('#mc-ok') || {}).disabled, msg: (b.querySelector('#mc-msg') || {}).textContent || '' }; });
const openCopy = async (p, pid) => { await p.evaluate(pid => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg(pid); }, pid || 'P1'); await sleep(200);
  return p.evaluate(() => { const b = document.getElementById('mt-copy'); if (!b) return 'no button'; b.click(); return 'ok'; }); };
const pickFrom = async (p, pid) => { await p.evaluate(pid => document.querySelector('[data-mcf="' + pid + '"]').click(), pid); await sleep(600); };
const press = async (p, ms) => { await p.evaluate(() => document.getElementById('mc-ok').click()); await sleep(ms || 900); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    D.insert(S.db, 'projects', { id: 'P3', name: '<img src=x onerror=window.__x=1> Site', customer: 'X Homes' });
    D.insert(S.db, 'projects', { id: 'P4', name: 'Big', customer: 'Big Homes' });
    const m = (pid, id, name, kind, x) => D.insert(S.db, 'project_materials', Object.assign({ id, project_id: pid, name, kind }, x || {}));
    m('P1', 'T1', 'Oak', 'sheet');                                   // here: "Oak"
    m('P2', 'A1', 'Oak 18mm', 'sheet', { aliases: ['Oak'] });        // source alias = a name here
    m('P2', 'A2', 'Beech', 'sheet'); m('P2', 'A3', 'Cherry', 'sheet'); m('P2', 'A4', 'Maple', 'sheet');
    m('P3', 'B2', 'beech ', 'sheet');                                // the same board on another project, different spelling
    m('P3', 'B3', '"><script>window.__x=2</script>', 'other');
    for (let i = 0; i < 200; i++) m('P4', 'G' + i, 'Board ' + String(i).padStart(3, '0'), i % 3 ? 'sheet' : 'other');
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // HTML project names
    await openCopy(p);
    rec('a project name with HTML in "Copy from:" is shown as text', await p.evaluate(() => !window.__x && !document.querySelector('#mc-body img,#mc-body script')));
    // alias clash
    await pickFrom(p, 'P2'); let d = await dlg(p);
    const a1 = d.rows.find(r => r.id === 'A1') || {};
    rec('"Oak 18mm" (also called Oak) where "Oak" is here → already here as "Oak", cannot tick', a1.dis && /already here as "Oak"/.test(a1.txt), JSON.stringify(a1));
    // a source material retired on another PC after the window opened: is it still copied?
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'A3'), { active: false });
    // a source material renamed on another PC after the window opened
    D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'A4'), { name: 'Maple 25mm' });
    await press(p); d = await dlg(p);
    const got = mats(S, 'P1').map(x => x.id + '=' + x.name);
    rec('a material RETIRED on the source after the window opened is NOT copied', !got.some(x => /A3/.test(x)), got.join(', ') + ' | ' + d.msg);
    rec('a material RENAMED on the source after the window opened is copied with its NEW name', got.some(x => x === 'M:P1:A4=Maple 25mm'), got.join(', '));
    // the same board from two different projects on two PCs at the same time: one Beech, never two
    S.db.t.project_materials = S.db.t.project_materials.filter(x => x.id !== 'M:P1:A2'); // start without Beech here
    const t2 = await X.dev(browser, S, 'design'), p2 = t2.page;
    for (const q of [p, p2]) await q.evaluate(async () => { lsReset(); await lsLoad(); });
    await openCopy(p); await pickFrom(p, 'P2'); await openCopy(p2); await pickFrom(p2, 'P3');
    await p.evaluate(() => document.querySelectorAll('[data-mcp]').forEach(x => { if (!x.disabled && x.dataset.mcp !== 'A2' && x.checked) { x.checked = false; x.dispatchEvent(new Event('change')); } }));
    await p2.evaluate(() => document.querySelectorAll('[data-mcp]').forEach(x => { if (!x.disabled && x.dataset.mcp !== 'B2' && x.checked) { x.checked = false; x.dispatchEvent(new Event('change')); } }));
    await Promise.all([press(p), press(p2)]);
    const bs = mats(S, 'P1').filter(x => /^beech$/i.test(String(x.name).trim()));
    const ds = [await dlg(p), await dlg(p2)];
    rec('two PCs copy "Beech" (from Lucan) and "beech " (from another project) at once → ONE beech here', bs.length === 1, bs.map(x => x.id + ':' + JSON.stringify(x.name)).join(', '));
    rec('… the other PC is told "already here", not an error', ds.every(x => !/Stopped/.test(x.msg)) && ds.some(x => /already here/.test(x.msg)), ds.map(x => x.msg).join(' | '));
    await t2.close();
    // 200 materials
    await openCopy(p); await pickFrom(p, 'P4'); d = await dlg(p);
    rec('200 materials offered and ticked: "Copy 200 materials"', d.ok === 'Copy 200 materials' && d.rows.length === 200, d.ok + ' rows=' + d.rows.length);
    const t0 = Date.now(); await press(p, 200);
    for (let i = 0; i < 150 && !(await p.evaluate(() => !/Copying/.test((document.getElementById('mc-ok') || {}).textContent || ''))); i++) await sleep(200);
    d = await dlg(p);
    const p1 = mats(S, 'P1').filter(x => /^M:P1:G/.test(x.id));
    rec('200 copied, each once, "✓ 200 added" (' + Math.round((Date.now() - t0) / 1000) + ' s on the fake database)', p1.length === 200 && new Set(p1.map(x => x.name)).size === 200 && /✓ 200 added/.test(d.msg), p1.length + ' ' + d.msg);
    const sorts = p1.map(x => x.sort);
    rec('… each gets its own sort position (no 200-way tie)', new Set(sorts).size === 200, 'distinct sorts=' + new Set(sorts).size);
    // ✕ Close while copying: does the rest carry on silently, and is anything doubled?
    for (let i = 200; i < 230; i++) m('P4', 'G' + i, 'Board ' + i, 'sheet');
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await openCopy(p); await pickFrom(p, 'P4');
    await p.evaluate(() => { document.getElementById('mc-ok').click(); setTimeout(() => { const x = [...document.querySelectorAll('.pod-ovl')].pop(); const c = x && x.querySelector('#pod-x'); if (c) c.click(); else if (x) x.remove(); }, 30); });
    await sleep(3000);
    const p2c = mats(S, 'P1').filter(x => /^M:P1:G2[0-2]\d$/.test(x.id));
    console.log('INFO ✕ pressed 30 ms into a 30-material copy: ' + p2c.length + ' of 30 landed after the window was closed (no message left on screen)');
    rec('✕ while copying: no duplicates whatever landed', new Set(p2c.map(x => x.name)).size === p2c.length);
    // stores (not a MAT_ED role): no button, and calling the dialog directly refuses
    const t3 = await X.dev(browser, S, 'stores'), p3 = t3.page;
    await p3.evaluate(async () => { lsReset(); await lsLoad(); lsMaterialsDlg('P1'); }); await sleep(200);
    const st = await p3.evaluate(() => { const b = !!document.getElementById('mt-copy'); matCopyDlg('P1'); return { b, dlg: !!document.getElementById('mc-body') }; });
    rec('stores: no Copy button; matCopyDlg() opened directly refuses', !st.b && !st.dlg, JSON.stringify(st));
    await t3.close();
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
    // lists switched off: the Materials window (and so the Copy button) is not reachable from the screens
    const r = X.v2Row(); delete r.settings.listStore; delete r.settings.listStoreAt;
    const S2 = X.makeServer(r), t4 = await X.dev(browser, S2, 'office'), p4 = t4.page;
    const off = await p4.evaluate(() => { showTab('l'); render(); return { v2: V2(), copy: !!document.getElementById('mt-copy'), mbtn: [...document.querySelectorAll('button')].filter(b => /Materials|Copy from another project/.test(b.textContent)).length }; });
    rec('lists OFF: no Materials / Copy button on the lists screen', !off.v2 && !off.copy && !off.mbtn, JSON.stringify(off));
    await t4.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
