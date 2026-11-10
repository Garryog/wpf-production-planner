// Garry 10 Nov: Johnny (Pre-production, role 'pre') adds / edits project materials WITHOUT a PIN and does cutting lists —
// the same rights as the Drawing office. He reaches the Lists page from his own view. The Saw still can't change materials.
// Fake Supabase only. Run: node tests/seq/s6-pre-lists.test.js
const X = require('./fixs.js');
const { H, rec, sleep } = X;
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const pre = await X.dev(browser, S, 'pre', { me: { pre: 'Johnny' } });
  await pre.page.evaluate(() => { window.__pins = 0; const P = window.prompt; window.prompt = (m, d) => { if (/PIN/.test(m)) { window.__pins++; return null; } return P(m, d); }; });
  const r = await pre.page.evaluate(() => ({ ed: lsEditOk(), mat: lsMatEditOk(), can: lsMatCan(), spec: specEditOk(), sign: specSignOk(), pin: lsPinOk('Checking'), pins: window.__pins }));
  rec('pre has the Drawing office rights (lists, materials, project details, check) with no PIN question', r.ed && r.mat && r.can && r.spec && r.sign && r.pin && r.pins === 0, JSON.stringify(r));
  // his view: a Cutting lists tab = the Lists page
  const t = await pre.page.evaluate(() => ({ tabs: [...document.querySelectorAll('[data-pretab]')].map(b => b.textContent) }));
  await pre.page.evaluate(() => document.querySelector('[data-pretab="lists"]').click()); await sleep(300);
  const lh = await pre.page.evaluate(() => ({ lh: !!document.getElementById('lh'), l1: !!document.querySelector('[data-lhedit="L1"]'), mats: !!document.getElementById('lh-mats'), me: !!document.querySelector('.seq-me') }));
  rec('Pre-production view: "📋 Cutting lists" tab opens the Lists page (L1 with Edit, Materials), name strip kept', t.tabs.some(x => /Cutting lists/.test(x)) && lh.lh && lh.l1 && lh.mats && lh.me, JSON.stringify([t, lh]));
  // add a material in the Materials window: no PIN
  await pre.page.evaluate(() => { lsMaterialsDlg('P1'); document.getElementById('mt-new-n').value = "Egger W980 O'Brien"; document.getElementById('mt-add').click(); }); await sleep(600);
  const m = S.db.t.project_materials.find(x => x.name === "Egger W980 O'Brien");
  rec('Materials window: Johnny adds a material, 0 PIN questions, saved with his name', !!m && m.updated_by === 'Johnny' && await pre.page.evaluate(() => window.__pins) === 0, JSON.stringify(m));
  await pre.page.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
  // the list editor: "+ Add new material…" goes on the project list with no PIN, then Save
  await pre.page.evaluate(() => { openListEditor('L1'); }); await sleep(300);
  const before = (S.rpcCalls || []).filter(c => c.fn === 'save_list_revision').length;
  const addRes = await pre.page.evaluate(async () => { const o = document.querySelector('.pod-ovl'); const sel = [...o.querySelectorAll('[data-mr$="|mat"]')].find(e => { const i = e.dataset.mr.split('|')[0], L = o.querySelector('[data-mr="' + i + '|L"]'); return e.tagName === 'SELECT' && [...e.options].some(x => x.value === '__add') && L && String(L.value).trim(); }); // a saw row
    if (!sel) return 'no add option on a saw row'; window.prompt = (m, d) => { if (/PIN/.test(m)) { window.__pins++; return null; } return 'UD96 Oak'; };
    sel.value = '__add'; sel.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 800)); return 'ok'; });
  const ud = S.db.t.project_materials.find(x => x.name === 'UD96 Oak');
  rec('list editor "+ Add new material…": on the project list, 0 PIN questions', addRes === 'ok' && !!ud && await pre.page.evaluate(() => window.__pins) === 0, addRes + ' ' + JSON.stringify(ud));
  await pre.page.evaluate(() => { window.prompt = () => 'Johnny edit'; const o = document.querySelector('.pod-ovl'); const q = [...o.querySelectorAll('[data-mr$="|qty"]')].find(e => /^\d+$/.test(String(e.value).trim())); q.value = '9'; o.querySelectorAll('[data-mr$="|qty"]').forEach(e => { if (!/^\d+$/.test(String(e.value).trim())) { e.value = '4'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); } }); q.dispatchEvent(new Event('input')); q.dispatchEvent(new Event('change')); o.querySelector('#me-save').click(); }); await sleep(1200);
  const after = (S.rpcCalls || []).filter(c => c.fn === 'save_list_revision');
  const err = await pre.page.evaluate(() => { const e = document.getElementById('me-err'); return e ? e.textContent : '(closed)'; });
  rec('Johnny saves the cutting list (save_list_revision, by Johnny)', after.length === before + 1 && /Johnny/.test(JSON.stringify(after[after.length - 1].args)), err + ' ' + JSON.stringify(after.slice(-1)).slice(0, 200));
  rec('pre: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
  await pre.close();
  // the Saw still can't
  const saw = await X.dev(browser, S, 'saw');
  const s = await saw.page.evaluate(() => { let n = 0; window.prompt = () => { n++; return null; }; return { mat: lsMatEditOk(), can: lsMatCan(), spec: specEditOk(), n }; });
  rec('Saw: materials / project details still read-only', !s.mat && !s.can && !s.spec, JSON.stringify(s));
  await saw.close();
  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
