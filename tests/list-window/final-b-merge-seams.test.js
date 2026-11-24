// FINAL Tester round (14 Nov), area 6 — where the cutting-list window release meets the live Deliveries weeks release
// (merge 2de1d26). The Cutting Lists page has ONE project picker; the "Cutting lists to issue" search works inside the
// picked project; "Confirm all green" with a search on; template buttons by role with the project filter; no element id
// twice on any screen; a save keeps BOTH releases' settings (Deliveries marker / delivery-date numbers AND the P-number
// safety copies); the Capacity Board step box stamps the store time AND asks the ship question for steps 9–11.
// (Switch OFF = origin/main character for character is proved by tests/lists-filter/attack1-filter check 11.)
// Fake Supabase only. Run: node tests/list-window/final-b-merge-seams.test.js
const X = require('../lists-filter/fixl.js');
const { F, D, H } = X;
const res = []; const rec = (n, ok, d) => { res.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 420) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const j = JSON.stringify;
const dupIds = p => p.evaluate(() => { const m = {}; document.querySelectorAll('[id]').forEach(e => { m[e.id] = (m[e.id] || 0) + 1; }); return Object.keys(m).filter(k => m[k] > 1 && k); });
const pick = (p, v) => p.evaluate(async v => { const s = document.getElementById('lh-proj'); s.value = v; s.onchange(); await new Promise(r => setTimeout(r, 80)); }, v);
const st = p => p.evaluate(() => { const e = document.getElementById('lti') || document.body; const t = x => (x ? x.textContent.replace(/\s+/g, ' ').trim() : '');
  return { rows: [...e.querySelectorAll('[data-ltirow]')].map(r => r.dataset.ltirow), box: !!document.getElementById('lti-q'), q: (document.getElementById('lti-q') || {}).value, n: t(document.getElementById('lti-qn')), none: t(document.getElementById('lti-q0')), all: t(document.getElementById('lti-all')), of: t(document.getElementById('lti-of')),
    pickers: [...document.querySelectorAll('#app select')].filter(s => [...s.options].some(o => /^All projects/.test(o.textContent))).map(s => s.id || '(no id)'), sel: (document.getElementById('lh-proj') || {}).value, lpfn: t(document.getElementById('lpf-n')) }; });
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------------------------------------------------------------- 1. one picker + search inside the picked project
    { const S = X.server();
      const t = await F.dev(browser, S, 'office', { viewport: { width: 1280, height: 900 } }), p = t.page;
      await p.evaluate(async () => { setWho('Ann'); showTab('l'); render(); await new Promise(r => setTimeout(r, 300)); });
      let s = await st(p);
      rec('1a Cutting Lists page: exactly ONE project picker ("All projects ▾")', s.pickers.length === 1 && s.pickers[0] === 'lh-proj', j(s.pickers));
      rec('1b no element id is on the page twice (Lists tab, All projects)', (await dupIds(p)).length === 0, j(await dupIds(p)));
      rec('1c All projects: the search box is on "Cutting lists to issue" (' + s.rows.length + ' jobs)', s.box && s.rows.length >= 6, j([s.box, s.rows.length]));
      const allRows = s.rows.slice();
      await p.fill('#lti-q', 'cairn'); await sleep(250); s = await st(p);
      const cairnAll = s.rows.slice();
      rec('1d All projects + "cairn" → only CAIRN jobs', cairnAll.length > 0 && cairnAll.every(w => /WO-26-23/.test(w)), j(s.rows));
      // pick ELLIOTTS with the search still typed
      await pick(p, 'P1'); s = await st(p);
      rec('1e picking ELLIOTTS with "cairn" still typed: NO Cairn job shows (the search stays inside the picked project)', s.rows.every(w => /WO-26-14/.test(w)), j(s));
      rec('(info) [LOW] 1f … and the person is not left with an unexplained empty panel: it says the search found nothing HERE and that other projects are hidden (or the search is cleared)', s.q === '' || s.rows.length > 0 || /other project|All projects|ELLIOTTS/i.test(s.none), j({ q: s.q, none: s.none, n: s.n }));
      await p.evaluate(() => { const x = document.getElementById('lti-qx'); if (x) x.click(); }); await sleep(200); s = await st(p);
      const p1rows = s.rows.slice();
      rec('1g ✕ Clear → ELLIOTTS\'s own jobs to issue (' + p1rows.length + '), all WO-26-14xx', p1rows.length >= 3 && p1rows.every(w => /WO-26-14/.test(w)), j(s.rows));
      rec('(info) 1h with ' + p1rows.length + ' jobs in the picked project the search box is ' + (s.box ? 'shown' : 'NOT shown (it appears only above 5 jobs)'), true);
      if (!s.box) { await pick(p, ''); await p.fill('#lti-q', '1410'); await sleep(200); await pick(p, 'P1'); s = await st(p); }
      else { await p.fill('#lti-q', '1410'); await sleep(250); s = await st(p); }
      rec('1i ELLIOTTS + "1410" → WO-26-1410 only, counted "1 of ' + p1rows.length + '" (the picked project\'s jobs, not every project\'s)', j(s.rows) === '["WO-26-1410"]' && new RegExp('^1 of ' + p1rows.length + '$').test(s.n), j([s.rows, s.n]));
      // Confirm all green while a search is on
      const greenBtn = s.all, m = /\((\d+)\)/.exec(greenBtn || '');
      const lists0 = S.db.t.lists.filter(l => !l.is_template).length;
      if (m) { await p.evaluate(() => { window.confirm = () => true; document.getElementById('lti-all').click(); }); await sleep(2500);
        const made = S.db.t.lists.filter(l => !l.is_template).length - lists0;
        rec('(info, ask Garry) [LOW] 1j "✓ Confirm all green (' + m[1] + ')" pressed with a search on screen showing 1 job: it makes lists ONLY for what the button counted (' + m[1] + '), and the count is of the jobs ON SCREEN (1) — never jobs the person cannot see', made === +m[1] && +m[1] === 1, j({ button: greenBtn, listsMade: made, onScreen: 1 }));
      } else rec('(info) 1j no "Confirm all green" button with the search on', true, greenBtn);
      rec('1: no page errors', !(S.errors || []).length, j(S.errors)); await t.page.context().close(); }

    // ---------------------------------------------------------------- 2. template buttons by role, with the project filter
    for (const role of ['design', 'prod', 'office']) { const S = X.server();
      const t = await F.dev(browser, S, role, { viewport: { width: 1280, height: 900 } }), p = t.page;
      await p.evaluate(async role => { if (typeof setWho === 'function') setWho('Ann'); if (role === 'office') showTab('l'); if (role === 'prod') { prodTab = 'lists'; } render(); await new Promise(r => setTimeout(r, 300));
        LH.kind = 'tpl'; render(); await new Promise(r => setTimeout(r, 200)); }, role);
      const v = await p.evaluate(() => ({ kind: LH.kind, copy: (b => b ? (b.disabled ? 'disabled' : 'on') : 'none')(document.getElementById('lh-copy')), newT: !!document.getElementById('lh-newtpl') || [...document.querySelectorAll('#app button')].some(b => /New template/.test(b.textContent)), pickers: [...document.querySelectorAll('#app select')].filter(s => [...s.options].some(o => /^All projects/.test(o.textContent))).length }));
      const want = role !== 'office';
      rec('2 ' + role + ': Templates view — "⧉ Copy from another project" / "＋ New template" ' + (want ? 'shown (Copy waits for a project to be picked)' : 'NOT shown') + ', ONE project picker', v.pickers === 1 && (want ? v.copy === 'disabled' && v.newT : v.copy === 'none' && !v.newT), j(v));
      if (want) { await pick(p, 'P1'); const c2 = await p.evaluate(() => (b => b ? (b.disabled ? 'disabled' : 'on') : 'none')(document.getElementById('lh-copy'))); rec('2 ' + role + ': with ELLIOTTS picked the Copy button is live', c2 === 'on', c2); }
      rec('2 ' + role + ': no id twice, no page errors', (await dupIds(p)).length === 0 && !(S.errors || []).length, j([await dupIds(p), S.errors])); await t.page.context().close(); }

    // ---------------------------------------------------------------- 3. no id twice with the list window open over each page
    { const S = X.server();
      const t = await F.dev(browser, S, 'design', { viewport: { width: 1280, height: 900 } }), p = t.page;
      await p.evaluate(async () => { render(); openListEditor(null, 'WO-26-1410'); await new Promise(r => setTimeout(r, 1000)); });
      const d1 = await dupIds(p), due = await p.evaluate(() => { const e = document.getElementById('me-due'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
      rec('3a list window open from a job (Drawing office): no id twice', d1.length === 0, j(d1));
      rec('3b its due badge reads the job\'s due date with the week number the Deliveries release uses (Fri 20 Nov · Wk 47)', /20 Nov/.test(due || '') && /Wk 47/.test(due || ''), j(due));
      await p.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg('P1'); }); await sleep(400);
      rec('3c Materials window: no id twice', (await dupIds(p)).length === 0, j(await dupIds(p)));
      rec('3: no page errors', !(S.errors || []).length, j(S.errors)); await t.page.context().close(); }

    // ---------------------------------------------------------------- 4. a save keeps BOTH releases' settings
    { const S = X.server({ settings: { pMerged: [{ at: '2026-11-12T10:00:00Z', by: 'Ann', wo: 'P-1001', into: 'WO-26-1410', why: 'test', job: { wo: 'P-1001' } }], delLegacyWk: '2026-11-09', delLegacyAt: '2026-11-13T23:58:00Z', delivLead: 4, siteDays: 6, earlyDays: 15, listDelOnly: true, delNotes: { '2026-11-16|Mon': 'gate code 1234' } } });
      const t = await F.dev(browser, S, 'office', { viewport: { width: 1280, height: 900 } }), p = t.page;
      const n0 = S.patches.length;
      await p.evaluate(async () => { const o = DB.orders.find(x => x.wo === 'WO-26-1410'); o.notes = 'final-b seam save'; sched(); for (let i = 0; i < 60 && (typeof SAVING !== 'undefined' && SAVING || !DB.orders); i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 2500)); });
      const st2 = S.row.settings || {}, saved = S.patches.length > n0;
      rec('4a the planner saved', saved && (S.row.orders.find(o => o.wo === 'WO-26-1410') || {}).notes === 'final-b seam save', j([S.patches.length - n0]));
      rec('[HIGH] 4b after the save the P-number safety copies (list window) are still in settings', Array.isArray(st2.pMerged) && st2.pMerged.length === 1 && st2.pMerged[0].wo === 'P-1001', j(st2.pMerged));
      rec('[HIGH] 4c … and so are the Deliveries release\'s: old-bookings answer, delivery-date numbers 4 / 6 / 15, "only jobs ticked for delivery", the dated day note', st2.delLegacyWk === '2026-11-09' && st2.delLegacyAt === '2026-11-13T23:58:00Z' && st2.delivLead === 4 && st2.siteDays === 6 && st2.earlyDays === 15 && st2.listDelOnly === true && j(st2.delNotes) === j({ '2026-11-16|Mon': 'gate code 1234' }), j([st2.delLegacyWk, st2.delLegacyAt, st2.delivLead, st2.siteDays, st2.earlyDays, st2.listDelOnly, st2.delNotes]));
      rec('4d the lists switch and release marker are still there', st2.listStore === 'v2' && !!st2.appRel, j([st2.listStore, st2.appRel]));
      rec('4: no page errors', !(S.errors || []).length, j(S.errors)); await t.page.context().close(); }

    // ---------------------------------------------------------------- 5. Capacity Board step box: store stamp AND ship question (lists ON)
    { const S = X.server();
      const t = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }), p = t.page;
      await p.evaluate(async () => { setWho('Ann'); showTab('b'); render(); await new Promise(r => setTimeout(r, 300)); });
      const steps = await p.evaluate(() => { const s = document.querySelector('[data-stepsel="WO-26-1410"]'); return s ? [...s.options].map(o => o.value) : null; });
      rec('5a the board\'s step box for WO-26-1410 lists steps up to 9 / 10 / 11 (Shipped / Installed / Completed)', steps && steps.some(v => /^9\./.test(v)) && steps.some(v => /^10\./.test(v)) && steps.some(v => /^11\./.test(v)), j(steps));
      const s8 = steps && steps.find(v => /^8\./.test(v)), s9 = steps && steps.find(v => /^9\./.test(v));
      const r8 = await p.evaluate(async v => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return true; }; const s = document.querySelector('[data-stepsel="WO-26-1410"]'); s.value = v; s.onchange(); await new Promise(r => setTimeout(r, 500)); const o = DB.orders.find(x => x.wo === 'WO-26-1410'); return { step: o.step, keys: Object.keys(o).filter(k => /store|Store/.test(k)).map(k => k + '=' + o[k]), asked: window.__asked.length, ovl: document.querySelectorAll('.pod-ovl').length }; }, s8);
      rec('5b step 8 picked on the board: the job is at step 8 and the time it went into the store is stamped', r8.step === s8 && r8.keys.some(k => /=\d{4}-\d\d-\d\d/.test(k)), j(r8));
      const r9 = await p.evaluate(async v => { window.__asked = []; window.confirm = m => { window.__asked.push(String(m)); return false; }; const s = document.querySelector('[data-stepsel="WO-26-1410"]'); s.value = v; s.onchange(); await new Promise(r => setTimeout(r, 500)); const o = DB.orders.find(x => x.wo === 'WO-26-1410'); const q = window.__asked.join(' | ') + ' ' + [...document.querySelectorAll('.pod-ovl')].map(x => x.textContent).join(' '); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); return { step: o.step, shipped: !!o.shippedAt, q: q.replace(/\s+/g, ' ').slice(0, 200) }; }, s9);
      rec('5c step 9 (JOB SHIPPED) picked: the ship question is asked first; answered No → the job stays where it was, not shipped', /ship|Shipped|leave the board/i.test(r9.q) && !r9.shipped && r9.step === s8, j(r9));
      rec('5: no id twice on the board, no page errors', (await dupIds(p)).length === 0 && !(S.errors || []).length, j([await dupIds(p), S.errors])); await t.page.context().close(); }

    // ---------------------------------------------------------------- 6. Deliveries page (week tabs, pool cards): same with lists ON as OFF, nothing of the list window on it
    { const out = {};
      for (const off of [false, true]) { const S = X.server(off ? { off: true } : {});
        S.row.orders.forEach((o, i) => { if (i < 3) { o.step = '8. PALLETED'; o.delv = true; } if (i === 0) { o.delVeh = 'VOLVO'; o.delDay = 'Wed'; o.delWk = '2026-10-19'; } });
        const t = await F.dev(browser, S, 'office', { viewport: { width: 1400, height: 900 } }), p = t.page;
        out[off] = await p.evaluate(async () => { setWho('Ann'); showTab('d'); render(); await new Promise(r => setTimeout(r, 300)); const a = document.getElementById('app'); return { wkbar: !!document.getElementById('del-wkbar'), tabs: [...document.querySelectorAll('[data-deltab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), cards: a.querySelectorAll('.del-card,[data-delwo],[draggable="true"]').length, html: a.innerHTML.replace(/\s+/g, ' ') }; });
        out[off].dup = await dupIds(p); out[off].err = (S.errors || []).length; await t.page.context().close(); }
      rec('6a Deliveries page has the week bar and week tabs, lists ON and OFF', out[false].wkbar && out[true].wkbar && out[false].tabs.length > 0 && j(out[false].tabs) === j(out[true].tabs), j([out[false].tabs.slice(0, 4), out[true].tabs.slice(0, 4)]));
      rec('6b the same number of cards with lists ON as OFF (' + out[true].cards + ')', out[false].cards === out[true].cards && out[true].cards > 0, j([out[false].cards, out[true].cards]));
      rec('6c nothing of the list window on the Deliveries page (no "＋ Add cutting list", no list status) — item 8 is a later release', !/Add cutting list|pm-ls|me-ed/.test(out[false].html), '');
      rec('6: no id twice, no page errors', !out[false].dup.length && !out[true].dup.length && !out[false].err && !out[true].err, j([out[false].dup, out[true].dup])); }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})();
