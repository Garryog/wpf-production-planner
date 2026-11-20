// Part D (Garry 20 Nov): ⧉ Copy materials from another project (matCopyDlg). Fake Supabase only.
// Only ACTIVE materials the target hasn't got (by name or other spelling) can be ticked; nothing on the target is changed or
// retired; fixed id M:<pid>:<srcId> → twice / two PCs / a lost reply never make a duplicate.
// Run: node tests/batch/d-matcopy.test.js
const L = require('../list-window/lw.js');
const { X, D, sleep, rec } = L;
const mats = (S, pid) => S.db.t.project_materials.filter(m => m.project_id === pid);
const dlg = p => p.evaluate(() => { const b = document.getElementById('mc-body'); if (!b) return null;
  return { txt: b.innerText.replace(/\s+/g, ' '), rows: [...b.querySelectorAll('[data-mcp]')].map(x => ({ id: x.dataset.mcp, on: x.checked, dis: x.disabled, txt: x.closest('label').innerText.replace(/\s+/g, ' ') })),
    ok: (b.querySelector('#mc-ok') || {}).textContent || null, okDis: !!(b.querySelector('#mc-ok') || {}).disabled, msg: (b.querySelector('#mc-msg') || {}).textContent || '' }; });
const openCopy = async p => { await p.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg('P1'); }); await sleep(200);
  const r = await p.evaluate(() => { const b = document.getElementById('mt-copy'); if (!b) return 'no button'; b.click(); return 'ok'; }); await sleep(200); return r; };
const pickFrom = async (p, pid) => { await p.evaluate(pid => document.querySelector('[data-mcf="' + pid + '"]').click(), pid); await sleep(600); };
const press = async p => { await p.evaluate(() => document.getElementById('mc-ok').click()); await sleep(900); };
(async () => {
  const browser = await X.H.chromium.launch();
  try {
    const S = X.makeServer(X.v2Row());
    // P1 Aderrig: M1 MFC White (sheet), M2 Blum hinge (other) + a retired "Walnut" + "Grey" also called "Dust grey"
    D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Walnut', kind: 'sheet', active: false });
    D.insert(S.db, 'project_materials', { id: 'M4', project_id: 'P1', name: 'Grey', kind: 'sheet', aliases: ['Dust grey'] });
    // P2 Lucan
    const m2 = (id, name, kind, x) => D.insert(S.db, 'project_materials', Object.assign({ id, project_id: 'P2', name, kind }, x || {}));
    m2('N1', 'mfc white', 'sheet'); m2('N2', 'Oak 18mm', 'sheet', { aliases: ['Oak', 'OAK 18'] }); m2('N3', 'Bar handle', 'other');
    m2('N4', 'Old board', 'sheet', { active: false }); m2('N5', 'Walnut 18', 'sheet', { aliases: ['Walnut'] }); m2('N6', 'Dust grey', 'sheet'); m2('N7', '<img src=x onerror=window.__x=1>', 'other');
    const own0 = JSON.stringify(mats(S, 'P1'));
    const t = await X.dev(browser, S, 'office'), p = t.page;
    await p.evaluate(async () => { lsReset(); await lsLoad(); });
    rec('Materials window has "⧉ Copy from another project…"', (await openCopy(p)) === 'ok');
    let d = await dlg(p);
    rec('"Copy from:" lists Lucan with its active material count (6)', /Lucan \(6\)/.test(d.txt), d.txt);
    await pickFrom(p, 'P2'); d = await dlg(p);
    const by = id => d.rows.find(r => r.id === id) || {};
    rec('the retired "Old board" is not offered', !by('N4').id, JSON.stringify(d.rows));
    rec('"mfc white" (case) is already here — greyed, cannot tick', by('N1').dis && !by('N1').on && /already here/.test(by('N1').txt), JSON.stringify(by('N1')));
    rec('"Walnut 18" also called Walnut = retired here → already here (retired here), never brought back', by('N5').dis && /retired here/.test(by('N5').txt), JSON.stringify(by('N5')));
    rec('"Dust grey" is another spelling of Grey here → already here as "Grey"', by('N6').dis && /as "Grey"/.test(by('N6').txt), JSON.stringify(by('N6')));
    rec('new ones (Oak 18mm, Bar handle, the odd name) are ticked to start', by('N2').on && by('N3').on && by('N7').on && !by('N2').dis);
    rec('Oak shows "also called: Oak, OAK 18"', /also called: Oak, OAK 18/.test(by('N2').txt), by('N2').txt);
    rec('a name with HTML is shown as text (escaped)', await p.evaluate(() => !window.__x && !document.querySelector('#mc-body img')));
    rec('sections "Sheets (saw)" and "Fittings / other"', /Sheets \(saw\)/.test(d.txt) && /Fittings \/ other/.test(d.txt));
    rec('the note says nothing here is changed', /Nothing on this project is changed or removed/.test(d.txt));
    rec('button "Copy 3 materials"', d.ok === 'Copy 3 materials', d.ok);
    await p.evaluate(() => { const x = document.querySelector('[data-mcp="N7"]'); x.checked = false; x.dispatchEvent(new Event('change')); });
    d = await dlg(p); rec('untick one → "Copy 2 materials"', d.ok === 'Copy 2 materials', d.ok);
    await press(p); d = await dlg(p);
    const a1 = mats(S, 'P1').map(m => m.id).sort();
    rec('2 added with fixed ids M:P1:N2 / M:P1:N3', a1.includes('M:P1:N2') && a1.includes('M:P1:N3') && !a1.includes('M:P1:N7'), a1.join());
    const oak = mats(S, 'P1').find(m => m.id === 'M:P1:N2') || {};
    rec('the copy keeps kind and other spellings', oak.kind === 'sheet' && JSON.stringify(oak.aliases) === '["Oak","OAK 18"]' && (mats(S, 'P1').find(m => m.id === 'M:P1:N3') || {}).kind === 'other', JSON.stringify(oak));
    rec('message "✓ 2 added"', /✓ 2 added/.test(d.msg), d.msg);
    rec("the project's own materials are untouched", JSON.stringify(mats(S, 'P1').filter(m => !/^M:/.test(m.id))) === own0);
    rec('Lucan is untouched', mats(S, 'P2').length === 7 && !mats(S, 'P2').some(m => m.version > 1));
    rec('after the copy both show "already here"; only the unticked one is left', d.rows.filter(r => !r.dis).map(r => r.id).join() === 'N7', JSON.stringify(d.rows));
    rec('the Materials window behind shows Oak 18mm now', await p.evaluate(() => [...document.querySelectorAll('[data-mtn]')].some(e => e.value === 'Oak 18mm')));
    // twice: pick again → nothing new except N7; Copy N7 then again nothing
    await pickFrom(p, 'P2'); d = await dlg(p);
    rec('copy again: Oak / Bar handle cannot be ticked', d.rows.find(r => r.id === 'N2').dis && d.rows.find(r => r.id === 'N3').dis);
    // a lost reply: the insert lands, the reply is lost → message, then Copy again = already here, no twin
    S.dropReply = 1; await press(p); d = await dlg(p);
    rec('lost reply: "may have been added — press Copy again, nothing is added twice"', /press Copy again, nothing is added twice/.test(d.msg), d.msg);
    rec('… it did land once', mats(S, 'P1').filter(m => m.id === 'M:P1:N7').length === 1);
    await pickFrom(p, 'P2'); d = await dlg(p);
    rec('… after re-reading it shows already here (nothing to copy)', d.rows.every(r => r.dis) && d.okDis, JSON.stringify(d));
    rec('… still one copy', mats(S, 'P1').filter(m => /N7/.test(m.id)).length === 1);
    // two PCs at once: both ticked the same new material, both press
    m2('N8', 'Ash veneer', 'sheet');
    const t2 = await X.dev(browser, S, 'design'), p2 = t2.page;
    for (const q of [p, p2]) { await q.evaluate(async () => { lsReset(); await lsLoad(); }); await openCopy(q); await pickFrom(q, 'P2'); }
    await Promise.all([press(p), press(p2)]);
    const ds = [await dlg(p), await dlg(p2)];
    rec('two PCs: one "Ash veneer", never two', mats(S, 'P1').filter(m => m.name === 'Ash veneer').length === 1, mats(S, 'P1').map(m => m.name).join());
    rec('two PCs: one says added, the other "already here"', ds.some(x => /1 added/.test(x.msg)) && ds.some(x => /already here/.test(x.msg)), ds.map(x => x.msg).join(' | '));
    await t2.close();
    // read-only screen: no button
    const t3 = await X.dev(browser, S, 'saw'), p3 = t3.page;
    await p3.evaluate(async () => { lsReset(); await lsLoad(); lsMaterialsDlg('P1'); }); await sleep(200);
    rec('saw (read-only materials): no Copy button', await p3.evaluate(() => !document.getElementById('mt-copy')));
    await t3.close();
    // phone
    await p.setViewportSize({ width: 360, height: 640 }); await sleep(200);
    await openCopy(p); await pickFrom(p, 'P2');
    const sw = await p.evaluate(() => { const o = document.querySelector('#mc-body').closest('.pod-in'); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ow: o.scrollWidth, oc: o.clientWidth }; });
    rec('phone 360: no sideways scroll', sw.sw <= sw.cw && sw.ow <= sw.oc + 1, JSON.stringify(sw));
    rec('no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
