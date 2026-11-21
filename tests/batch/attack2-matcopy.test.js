// Tester round 2 (21 Nov): ⧉ Copy materials with the new re-read of BOTH projects at Copy, and "not closed mid-copy".
// Source renamed / made inactive / all its ticked materials retired while the window is open · Copy pressed twice fast ·
// ✕, the grey background and Esc while copying (slow database) · the result still reaches the person. Fake Supabase only.
// Run: node tests/batch/attack2-matcopy.test.js
const L = require('../list-window/lw.js');
const { X, D, sleep } = L;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && d !== '' ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const mats = (S, pid) => S.db.t.project_materials.filter(m => m.project_id === pid);
const dlg = p => p.evaluate(() => { const b = document.getElementById('mc-body'); if (!b) return null; return { txt: b.innerText.replace(/\s+/g, ' '), ok: (b.querySelector('#mc-ok') || {}).textContent || null, msg: (b.querySelector('#mc-msg') || {}).textContent || '' }; });
const openCopy = async p => { await p.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg('P1'); }); await sleep(200);
  return p.evaluate(() => { const b = document.getElementById('mt-copy'); if (!b) return 'no button'; b.click(); return 'ok'; }); };
const pickFrom = async (p, pid) => { await p.evaluate(pid => document.querySelector('[data-mcf="' + pid + '"]').click(), pid); await sleep(600); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    const m = (pid, id, name, kind, x) => D.insert(S.db, 'project_materials', Object.assign({ id, project_id: pid, name, kind }, x || {}));
    for (let i = 0; i < 12; i++) m('P2', 'A' + i, 'Board A' + i, 'sheet');
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    // ---- source renamed and made inactive while the window is open ----
    await openCopy(p); await pickFrom(p, 'P2');
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P2'), { name: 'Lucan (closed)', active: false });
    // slow writes: 250 ms per material
    await p.route(u => /\/project_materials(\?|$)/.test(String(u)), async route => { if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, 250)); return route.fallback(); });
    // press Copy twice fast, then try ✕, the background and Esc while it runs
    const tries = await p.evaluate(async () => { const ok = document.getElementById('mc-ok'); ok.click(); ok.click(); await new Promise(r => setTimeout(r, 400));
      const ov = document.getElementById('mc-body').closest('.pod-ovl'), out = [];
      const x = ov.querySelector('#pod-x'); if (x) x.click(); out.push('x:' + document.body.contains(ov));
      ov.dispatchEvent(new MouseEvent('click', { bubbles: true })); out.push('bg:' + document.body.contains(ov));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); out.push('esc:' + document.body.contains(ov));
      return out.join(' '); });
    rec('while copying: ✕, the grey background and Esc do not close the window', !/false/.test(tries), tries);
    for (let i = 0; i < 60; i++) { const d = await dlg(p); if (d && !/Copying/.test(d.ok || '')) break; await sleep(250); }
    let d = await dlg(p);
    const cp = mats(S, 'P1').filter(x => /^M:P1:A/.test(x.id));
    rec('Copy pressed twice fast: each of the 12 copied once, "✓ 12 added"', cp.length === 12 && new Set(cp.map(x => x.name)).size === 12 && /✓ 12 added/.test((d && d.msg) || ''), cp.length + ' ' + (d && d.msg));
    console.log('INFO source renamed to "Lucan (closed)" and made inactive mid-window → the copy still ran (its materials are active): ' + (d && d.msg));
    rec('after the copy the window can be closed', await p.evaluate(() => { const ov = document.getElementById('mc-body').closest('.pod-ovl'); ov.querySelector('#pod-x').click(); return !document.body.contains(ov); }));
    // ---- every ticked material retired on the source while the window is open ----
    D.update(S.db, 'projects', D.find(S.db, 'projects', 'P2'), { name: 'Lucan', active: true });
    for (let i = 0; i < 3; i++) m('P2', 'B' + i, 'Board B' + i, 'sheet');
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await openCopy(p); await pickFrom(p, 'P2');
    for (let i = 0; i < 3; i++) D.update(S.db, 'project_materials', D.find(S.db, 'project_materials', 'B' + i), { active: false });
    await p.evaluate(() => document.getElementById('mc-ok').click()); await sleep(1500);
    d = await dlg(p);
    rec('all ticked materials retired on the source meanwhile: nothing copied, the message says so', !mats(S, 'P1').some(x => /^M:P1:B/.test(x.id)) && /3 no longer in use/.test((d && d.msg) || ''), d && d.msg);
    // ---- source project's row removed from the database while the window is open ----
    for (let i = 0; i < 2; i++) m('P2', 'C' + i, 'Board C' + i, 'sheet');
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    await openCopy(p); await pickFrom(p, 'P2');
    S.db.t.projects = S.db.t.projects.filter(x => x.id !== 'P2');
    await p.evaluate(() => document.getElementById('mc-ok').click()); await sleep(1500);
    d = await dlg(p);
    console.log('INFO source project row gone mid-window: ' + JSON.stringify(d && { ok: d.ok, msg: d.msg }) + ' copied=' + mats(S, 'P1').filter(x => /^M:P1:C/.test(x.id)).length);
    rec('source project removed mid-window: no error page, a clear message', !(S.errors || []).length && !!(d && d.msg), JSON.stringify(d));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
    await t.close();
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
