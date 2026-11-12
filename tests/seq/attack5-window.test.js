// Tester attack round 5 (Part 4, L5–L12: the cutting-list window after Garry's first live use, 10 Nov).
// Tries to BREAK: the project made from the WO's customer (two / three PCs at once, spellings, inactive, "contains"),
// ✕ / Close / Esc asking after changes the APP makes vs changes the PERSON makes, Esc with another window on top,
// the "Saved ✓" panel after a lost reply / P-number / revision / check, "＋ Add new material" asked once (PC + phone),
// the WO drop-down with ~650 jobs (speed, sort, odd dates, left-out jobs, chosen WO kept), list names, the storage
// messages (full / blocked, nothing ever removed), 360 px, and lists switched OFF.
// Fake Supabase only (tests/seq/srvs.js + the stage3 fake): nothing reaches the network. Run: node tests/seq/attack5-window.test.js
const X = require('../listwin/fixl.js');
const { H, D, rec, sleep } = X;

const closeAll = p => p.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
const ed = p => p.evaluate(() => !!document.querySelector('.me-ed'));
const asks = p => p.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return window.__confirm !== undefined ? window.__confirm : true; }; });
const askedN = p => p.evaluate(() => (window.__asked || []).filter(m => /Close without saving/.test(m)).length);
const esc = p => p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
const setv = (p, k, v) => p.evaluate(({ k, v }) => { const e = document.querySelector('.me-ed [data-mr="' + k + '"]'); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input')); }, { k, v });
const setid = (p, id, v, ev) => p.evaluate(({ id, v, ev }) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event(ev || (e.tagName === 'SELECT' ? 'change' : 'input'))); }, { id, v, ev });
const fillSaw = async (p, i, item, qty, L, W, mat) => { for (const [f, v] of [['item', item], ['qty', qty], ['L', L], ['W', W], ['mat', mat]]) await setv(p, i + '|' + f, v); };
const donep = p => p.evaluate(() => { const d = document.querySelector('.me-dov'); if (!d) return null; return { h: d.querySelector('#me-dok').textContent, l: d.querySelector('.me-dl').innerText }; });
const pst = p => p.evaluate(() => ({ pid: (e => e ? e.value : ((document.getElementById('me-ptxt') || { dataset: {} }).dataset.pid || ''))(document.getElementById('me-pid')), pm: (document.getElementById('me-pm') || {}).innerText || '', err: (document.getElementById('me-err') || {}).textContent || '', open: !!document.querySelector('.me-ed') }));
const projsNamed = (S, re) => S.db.t.projects.filter(x => re.test(String(x.name)));

function row() {
  const r = X.v2Row();
  r.orders.push(
    H.order({ wo: 'WO-40', customer: 'Race Homes', floor: '2', unit: '1', title: 'RACE A', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-41', customer: 'Race Homes.', floor: '2', unit: '2', title: 'RACE B', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-42', customer: 'RACE HOMES', floor: '2', unit: '3', title: 'RACE C', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-43', customer: 'Triple Homes', floor: '1', unit: '1', title: 'T1', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-44', customer: 'Lost Reply Homes', floor: '1', unit: '1', title: 'LR', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-45', customer: 'Park Homes', floor: '1', unit: '1', title: 'OTHER BUILDER', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-46', customer: 'Sleepy Homes', floor: '1', unit: '1', title: 'INACTIVE', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-47', customer: 'Zed Homes', floor: '1', unit: '1', title: 'OLD SPELLING INACTIVE', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-48', customer: 'Offline Homes', floor: '1', unit: '1', title: 'OFF', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-49', customer: "O'Grady & Sons <b>Ltd</b>", floor: '1', unit: '1', title: 'QUOTE', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-50', customer: 'Esc Homes', floor: '1', unit: '1', title: 'ESC', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-51', customer: 'Aderrig Homes', floor: 'T09', unit: '51', title: 'HOUSE 51', dueDate: '2026-11-30', origDueDate: '2026-11-30' }),
    H.order({ wo: 'WO-52', customer: 'Aderrig Homes', floor: 'T09', unit: '52', title: 'HOUSE 52', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
  return r;
}

(async () => {
  const browser = await H.chromium.launch();
  try {
    // =====================================================================================================================
    // 1. L5 — the project made from the WO's customer: two / three PCs at once must end with ONE project (Garry: no duplicates)
    // =====================================================================================================================
    {
      const S = X.makeServer(row());
      D.insert(S.db, 'projects', { id: 'P7', name: 'Kilcock Park', customer: 'Kilcock Park Developments', cien_names: ['Kilcock Park Developments'] });
      D.insert(S.db, 'projects', { id: 'P8', name: 'Sleepy Homes', customer: 'Sleepy Homes', cien_names: ['Sleepy Homes'], active: false });
      D.insert(S.db, 'projects', { id: 'P9', name: 'Old Zed Site', customer: 'Zed Homes', cien_names: ['Zed Homes'], active: false });
      const pcs = await Promise.all([0, 1, 2].map(() => X.dev(browser, S, 'office')));
      // (a) three PCs, same customer, the same moment — hold the list-table traffic so all three read "no project" first
      let rel; S.hold3 = new Promise(r => { rel = r; });
      pcs.forEach(t => asks(t.page));
      await Promise.all(pcs.map(t => t.page.evaluate(() => openListEditor(null, 'WO-43'))));
      await sleep(400); rel(); S.hold3 = null; await sleep(2000);
      let th = projsNamed(S, /^triple homes$/i);
      let pids = await Promise.all(pcs.map(t => t.page.evaluate(() => (e => e ? e.value : ((document.getElementById('me-ptxt') || { dataset: {} }).dataset.pid || ''))(document.getElementById('me-pid')))));
      rec('L5 race: THREE PCs open a WO of customer "Triple Homes" at once → ONE project, all three windows on it', th.length === 1 && pids.every(x => th[0] && x === th[0].id), JSON.stringify([th.map(x => x.id), pids]));
      const errs = await Promise.all(pcs.map(t => pst(t.page)));
      rec('L5 race: …no window shows "could not be set up" (the refused duplicate is handled quietly)', errs.every(e => !/could not be set up/.test(e.pm)), JSON.stringify(errs.map(e => e.pm)));
      await Promise.all(pcs.map(t => closeAll(t.page)));

      // (b) the same customer spelled with a full stop / in capitals on two WOs, two PCs at once. The database's duplicate
      //     rule is lower(name) only: "Race Homes" and "Race Homes." are two names to it, the same customer to the app.
      S.hold3 = new Promise(r => { rel = r; });
      await Promise.all([pcs[0].page.evaluate(() => openListEditor(null, 'WO-40')), pcs[1].page.evaluate(() => openListEditor(null, 'WO-41')), pcs[2].page.evaluate(() => openListEditor(null, 'WO-42'))]);
      await sleep(400); rel(); S.hold3 = null; await sleep(2000);
      const rh = projsNamed(S, /^race homes\.?$/i);
      rec('[MEDIUM] L5 race: WOs for "Race Homes" / "Race Homes." / "RACE HOMES" opened on three PCs at once → ONE project (same customer to the app)', rh.length === 1, JSON.stringify(rh.map(x => x.name)));
      // afterwards: does the next WO of that customer still get a project by itself, or "fits more than one project" for ever?
      await Promise.all(pcs.map(t => closeAll(t.page)));
      await pcs[0].page.evaluate(async () => { lsReset(); await lsLoad(); openListEditor(null, 'WO-41'); }); await sleep(900);
      let w = await pst(pcs[0].page);
      rec('[MEDIUM] L5 race: …and afterwards a "Race Homes." WO still gets its project by itself (not "fits more than one project — pick one" every time)', !!w.pid && !/fits more than one/.test(w.pm), JSON.stringify(w));
      await closeAll(pcs[0].page);

      // (c) the reply to "make the project" is lost (it DID land): Save / reopen must not make a second one
      S.dropReply = 1;
      await pcs[0].page.evaluate(() => openListEditor(null, 'WO-44')); await sleep(1500);
      w = await pst(pcs[0].page);
      let lr = projsNamed(S, /^lost reply homes$/i);
      rec('L5 lost reply on "make the project": ONE project, the window on it (no error shown)', lr.length === 1 && w.pid === lr[0].id && !/could not/.test(w.pm), JSON.stringify([lr.map(x => x.id), w]));
      await closeAll(pcs[0].page);
      await pcs[1].page.evaluate(() => openListEditor(null, 'WO-44')); await sleep(900);
      lr = projsNamed(S, /^lost reply homes$/i);
      rec('L5 lost reply: …another PC opening the same WO later uses that project', lr.length === 1 && (await pst(pcs[1].page)).pid === lr[0].id);
      await closeAll(pcs[1].page);

      // (d) offline when the window opens: plain message, the window still works, nothing made; back online → can carry on
      S.offline3 = true;
      await pcs[0].page.evaluate(() => openListEditor(null, 'WO-48')); await sleep(900);
      w = await pst(pcs[0].page);
      rec('L5 offline: "No connection — the project couldn\'t be set up. Check the internet and try again; you can still type the list.", window still open, nothing made', w.open && /No connection — the project couldn't be set up\. Check the internet and try again; you can still type the list\./.test(w.pm) && !projsNamed(S, /offline homes/i).length, JSON.stringify(w));
      rec('[LOW] L5 offline: the reason shown is plain English (not "Failed to fetch" / "TypeError")', !/Failed to fetch|TypeError|NetworkError/i.test(w.pm), w.pm);
      S.offline3 = false;
      await closeAll(pcs[0].page);

      // (e) a customer contained in ANOTHER builder's project: "Park Homes" (a different builder) vs project "Kilcock Park"
      //     (customer "Kilcock Park Developments"). The builder-only rule takes any project whose customer has the word "park".
      await pcs[0].page.evaluate(() => openListEditor(null, 'WO-45')); await sleep(900);
      w = await pst(pcs[0].page);
      rec('[MEDIUM] L5 "contains": customer "Park Homes" is NOT put on project "Kilcock Park" (customer Kilcock Park Developments) by itself', w.pid !== 'P7', JSON.stringify(w));
      await closeAll(pcs[0].page);

      // (f) an inactive project with the customer's name: reused (made active again) rather than a second project
      await pcs[0].page.evaluate(() => openListEditor(null, 'WO-46')); await sleep(900);
      w = await pst(pcs[0].page);
      const sl = projsNamed(S, /^sleepy homes$/i);
      rec('L5 inactive: customer = an INACTIVE project\'s name → that project is used (no second "Sleepy Homes")', sl.length === 1 && w.pid === 'P8', JSON.stringify([sl.map(x => x.id + ':' + x.active), w]));
      rec('L5 inactive: …it was made active again — say so? (message shown: "' + w.pm + '")', sl[0] && sl[0].active === true);
      await closeAll(pcs[0].page);
      // (g) inactive project whose Cienapps spelling is the customer (different name): a SECOND project is made for that customer
      await pcs[0].page.evaluate(() => openListEditor(null, 'WO-47')); await sleep(900);
      w = await pst(pcs[0].page);
      const zed = S.db.t.projects.filter(x => (x.cien_names || []).some(n => /^zed homes$/i.test(n)));
      rec('[LOW] L5 inactive: customer "Zed Homes" is a Cienapps spelling of INACTIVE project "Old Zed Site" → no silent second project for the same customer', zed.length === 1, JSON.stringify(zed.map(x => x.name + ':' + x.active)));
      await closeAll(pcs[0].page);
      // (h) apostrophe / & / <b> in the customer: escaped in the window, the project name kept as typed in Cienapps
      await pcs[0].page.evaluate(() => openListEditor(null, 'WO-49')); await sleep(900);
      // (list-window release) the project name is now the text box #me-ptxt and the customer is in the WO line #me-wol — both escaped
      w = await pcs[0].page.evaluate(() => ({ b: !!document.querySelector('#me-ptxt b, #me-wol b b, #me-pm b'), html: ((document.getElementById('me-ptxt') || {}).innerHTML || '') + ' | ' + ((document.getElementById('me-wol') || {}).innerHTML || ''), pid: (e => e ? e.value : ((document.getElementById('me-ptxt') || { dataset: {} }).dataset.pid || ''))(document.getElementById('me-pid')) }));
      const og = S.db.t.projects.find(x => x.id === w.pid);
      rec('L5 O\'Grady & Sons <b>Ltd</b>: project made with that exact name, shown escaped (no HTML injected)', og && og.name === "O'Grady & Sons <b>Ltd</b>" && /&lt;b&gt;Ltd&lt;\/b&gt;.*\|.*&lt;b&gt;Ltd&lt;\/b&gt;/.test(w.html) && !w.b, JSON.stringify([og && og.name, w.html.slice(0, 200)]));
      await closeAll(pcs[0].page);
      rec('section 1: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      for (const t of pcs) await t.close();
    }

    // =====================================================================================================================
    // 2. L8 — ✕ / Close / Esc: asked only after a PERSON's change; never after a change the APP made
    // =====================================================================================================================
    {
      const S = X.makeServer(row());
      X.F3.seedList(S, 'T1', { wos: [], name: 'Type A', list: { is_template: true, type_name: 'Type A', list_type: 'kitchen' } });
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await asks(p);
      const escNoAsk = async (label, open) => {
        await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
        await p.evaluate(open); await sleep(900);
        await esc(p); await sleep(150);
        const n = await askedN(p), o = await ed(p);
        rec('L8 app-made only: ' + label + ' → Esc closes with NO question', n === 0 && !o, JSON.stringify({ asked: n, stillOpen: o }));
        await closeAll(p);
      };
      await escNoAsk('existing seeded list L1 opened, nothing touched', () => openListEditor('L1'));
      await escNoAsk('existing TEMPLATE opened, nothing touched', () => { localStorage.setItem('wpfEditPin', pins().prod || pins().admin); openListEditor('T1'); });
      await escNoAsk('new list, WO with a linked customer (project found at once)', () => openListEditor(null, 'WO-3'));
      await escNoAsk('new list, project MADE from the customer (async)', () => openListEditor(null, 'WO-50'));
      await escNoAsk('new list with no WO and no project', () => openListEditor(null, '', ''));
      await escNoAsk('new template (blank)', () => { localStorage.setItem('wpfEditPin', pins().prod || pins().admin); openListEditor(null, '', 'P1', { tpl: true }); });

      // another PC changes things while the window is open: the 30 s poll + the planner reload; then a redraw the person didn't cause
      await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = false; window.__e = openListEditor('L1'); }); await sleep(600);
      D.update(S.db, 'projects', D.find(S.db, 'projects', 'P1'), { name: 'Aderrig Renamed' });
      S.row.orders.push(H.order({ wo: 'WO-90', customer: 'Aderrig Homes', floor: 'T09', unit: '90', title: 'NEW FROM OTHER PC', dueDate: '2026-11-11', origDueDate: '2026-11-11' }));
      await p.evaluate(async () => { await lsPoll(); if (typeof loadDB === 'function') await loadDB(); window.__e.draw(); }); await sleep(600);
      await esc(p); await sleep(150);
      rec('L8 app-made only: another PC renamed the project + added a WO, the poll + redraw ran → Esc closes with NO question', (await askedN(p)) === 0 && !(await ed(p)), JSON.stringify(await p.evaluate(() => window.__asked)));
      await closeAll(p);

      // person-made changes MUST ask
      const mustAsk = async (label, open, act) => {
        await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = false; });
        await p.evaluate(open); await sleep(900);
        await act(); await sleep(300);
        await esc(p); await sleep(150);
        const n = await askedN(p), o = await ed(p);
        rec('L8 person-made: ' + label + ' → Esc ASKS, Cancel keeps the window', n === 1 && o, JSON.stringify({ asked: n, stillOpen: o }));
        await closeAll(p);
      };
      await mustAsk('only the list name typed', () => openListEditor(null, 'WO-3'), () => setid(p, 'me-name', 'Kitchen B'));
      await mustAsk('only the Type changed', () => openListEditor(null, 'WO-3'), () => p.evaluate(() => { const s = document.getElementById('me-type'); const o = [...s.options].find(x => x.value !== s.value); s.value = o.value; s.dispatchEvent(new Event('change')); }));
      await mustAsk('a WO picked from the drop-down', () => openListEditor(null, '', 'P1'), () => setid(p, 'me-wo', 'WO-3'));
      await mustAsk('Floor + Unit typed and 🔎 Find the WO pressed (app filled the WO)', () => openListEditor(null, '', 'P1'), async () => { await setid(p, 'me-jf', 'T09'); await setid(p, 'me-ju', '13'); await p.evaluate(() => document.getElementById('me-find').click()); });
      await mustAsk('rows pasted from Excel', () => openListEditor(null, 'WO-3'), () => p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="0|item"]'); e.focus(); const dt = new DataTransfer(); dt.setData('text/plain', 'Side\t2\t720\t560\nBase\t1\t560\t560'); e.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }));
      await mustAsk('a row deleted on an existing list', () => openListEditor('L1'), () => p.evaluate(() => { const b = document.querySelector('.me-ed [data-mrx="0"]'); b.click(); }));
      // typed then put back exactly → nothing changed → no question (nice to have)
      await closeAll(p); await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-3'); }); await sleep(600);
      await setv(p, '0|item', 'Side'); await setv(p, '0|item', ''); await esc(p); await sleep(150);
      rec('L8: typed then deleted again (nothing left) → no question', (await askedN(p)) === 0 && !(await ed(p)), JSON.stringify(await p.evaluate(() => window.__asked)));
      await closeAll(p);
      // "Not this one" after the app's own match: the person changed Floor/Unit, so asking is right; but the WO must be gone
      await p.evaluate(() => { window.__asked = []; openListEditor(null, '', 'P1'); }); await sleep(400);
      await setid(p, 'me-jf', 'T09'); await setid(p, 'me-ju', '14'); await p.evaluate(() => document.getElementById('me-find').click()); await sleep(400);
      const nt = await p.evaluate(() => { const b = document.getElementById('me-jnot'); if (b) b.click(); return !!b; }); await sleep(300);
      rec('L8 "Not this one" → the WO is taken off again', !nt || (await p.evaluate(() => !document.getElementById('me-wo').value)), JSON.stringify({ nt }));
      await closeAll(p);

      // ---- Esc with another window on top closes ONLY the top window (materials / template / which sheet)
      const topEsc = async (label, open) => {
        await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, 'WO-3'); }); await sleep(500);
        await setv(p, '0|item', 'Side');
        const n0 = await p.evaluate(() => document.querySelectorAll('.pod-ovl').length);
        await open(); await sleep(500);
        const n1 = await p.evaluate(() => document.querySelectorAll('.pod-ovl').length);
        await esc(p); await sleep(200);
        const s = await p.evaluate(() => ({ n: document.querySelectorAll('.pod-ovl').length, ed: !!document.querySelector('.me-ed'), item: (document.querySelector('.me-ed [data-mr="0|item"]') || {}).value, asked: (window.__asked || []).length }));
        rec('[LOW] Esc with the ' + label + ' window on top → that window closes, the list stays (row kept, nothing asked)', n1 === n0 + 1 && s.n === n0 && s.ed && s.item === 'Side' && !s.asked, JSON.stringify({ n0, n1, after: s }));
        await esc(p); await sleep(200);
        rec('[LOW] …a second Esc then asks about the list (something typed)', await p.evaluate(() => (window.__asked || []).some(m => /Close without saving/.test(m))));
        await closeAll(p);
      };
      await topEsc('🧱 project materials', () => p.evaluate(() => document.getElementById('me-mats').click()));
      await topEsc('📐 Insert from template', () => p.evaluate(() => document.getElementById('me-instpl').click()));
      await topEsc('📥 Which sheet? (Excel with two lists)', () => p.evaluate(async () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item', 'Qty', 'L', 'W', 'Material'], ['Side', 2, 720, 560, 'MFC White']]), 'Kitchen');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item', 'Qty', 'L', 'W', 'Material'], ['Shelf', 1, 500, 300, 'MFC White']]), 'Utility');
        const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }); const f = new File([u8], 'two.xlsx');
        const inp = document.querySelector('.me-ed input[type=file]'); if (!inp) return 'no file box';
        const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; }));
      rec('section 2: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // =====================================================================================================================
    // 3. "Saved ✓" panel: lost reply, P-number, revision, waiting for check; Add new material asked once (PC + phone)
    // =====================================================================================================================
    {
      const S = X.makeServer(row());
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await asks(p);
      // (a) the reply to Save is lost (the list DID land): the panel must still come, ONE list in the database
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(500);
      await fillSaw(p, 0, 'Side', '2', '720', '560', 'MFC White');
      S.dropReply = 1;
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(2500);
      let w = await donep(p);
      const l3 = S.db.t.lists.filter(l => !l.archived && !l.is_template && (l.wos || []).includes('WO-3'));
      const errTxt = await p.evaluate(() => (document.getElementById('me-err') || {}).textContent || '');
      rec('Saved ✓ after a LOST reply (it landed): ONE list on WO-3, and the person is told it is saved (panel or clear message)', l3.length === 1 && (!!(w && /^Saved ✓/.test(w.h)) || /saved|reached the database/i.test(errTxt)), JSON.stringify({ lists: l3.length, w, errTxt }));
      if (!w && await ed(p)) { await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500); }
      rec('…pressing Save again after the lost reply still gives ONE list', S.db.t.lists.filter(l => !l.archived && !l.is_template && (l.wos || []).includes('WO-3')).length === 1);
      await closeAll(p);
      // (b) the P-number path: blank name → the P-number; the panel names the P-number
      await p.evaluate(() => { window.__confirm = true; openListEditor(null, '', 'P1'); }); await sleep(400);
      await setid(p, 'me-jf', 'T09'); await setid(p, 'me-ju', '77'); await setid(p, 'me-jt', 'HOUSE TYPE Z');
      await p.evaluate(() => document.getElementById('me-find').click()); await sleep(400);
      await p.evaluate(() => { const b = document.getElementById('me-jmkp') || document.getElementById('me-jnone') || document.getElementById('me-new'); if (b) b.click(); }); await sleep(300);
      await p.evaluate(() => { const s = (sel, v) => { const e = document.querySelector('.me-ed ' + sel); if (e) { e.value = v; e.dispatchEvent(new Event('input')); } };
        s('[data-mr="0|item"]', 'Tap'); s('[data-mr="0|qty"]', '2'); const d = document.querySelector('.me-ed #me-pdue'); if (d && !d.value) s('#me-pdue', '2026-12-10'); });
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500);
      w = await donep(p);
      const pj = await p.evaluate(() => DB.orders.filter(o => /^P-\d+$/.test(o.wo) && o.unit === '77').map(o => o.wo));
      const pl = pj[0] ? S.db.t.lists.filter(l => (l.wos || []).includes(pj[0])) : [];
      rec('P-number, name left blank → the list is named the P-number', pj.length === 1 && pl.length === 1 && pl[0].name === pj[0], JSON.stringify({ pj, names: pl.map(l => l.name), err: (await pst(p)).err }));
      rec('P-number: the "Saved ✓" panel shows, and names the P-number (the WO the saw will see)', !!(w && /^Saved ✓/.test(w.h) && pj[0] && w.l.includes(pj[0])), JSON.stringify(w));
      await closeAll(p);
      // (c) a list name of only spaces → the WO number (not "   ")
      await p.evaluate(() => openListEditor(null, 'WO-4')); await sleep(500);
      await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White'); await setid(p, 'me-name', '   ');
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1200);
      const n4 = S.db.t.lists.filter(l => !l.archived && (l.wos || []).includes('WO-4')).map(l => l.name);
      rec('names: a list name of only spaces → saved as "WO-4"', n4.length === 1 && n4[0] === 'WO-4', JSON.stringify(n4));
      await closeAll(p);
      // (d) revision of an existing list, and the panel with checking on
      await p.evaluate(() => { DB.listChk = true; openListEditor(lsCache().all.find(l => !l.tpl && !l.archived && (l.wos || []).includes('WO-4')).id); }); await sleep(600); // (L1's seeded lines have a Stores row with no qty — Save refuses it)
      await setv(p, '0|note', 'changed by tester');
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500);
      w = await donep(p);
      rec('Saved ✓ for a REVISION while lists must be checked → says it is waiting for the check (not "is with the Saw")', !!(w && /waiting to be checked/.test(w.h)), JSON.stringify(w));
      await p.evaluate(() => { DB.listChk = false; }); await closeAll(p);
      // (e) Saved ✓ panel + Esc + Enter: Enter on the focused [Close] closes, it doesn't re-open the editor
      await p.evaluate(() => openListEditor(null, 'WO-51')); await sleep(500);
      await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White');
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1200);
      rec('setup: Saved ✓ panel up for WO-51', !!(await donep(p)));
      await p.keyboard.press('Enter'); await sleep(300);
      rec('Saved ✓ panel: Enter (on the focused Close) closes it — no editor left behind', await p.evaluate(() => !document.querySelector('.pod-ovl')));
      await closeAll(p);

      // (f) ＋ Add new material: cancelled once, then picked again on the same row → asked again (exactly once each time)
      await p.evaluate(() => { localStorage.setItem('wpfEditPin', pins().prod || pins().admin); openListEditor(null, 'WO-3'); }); await sleep(500);
      const ask2 = await p.evaluate(async () => { const q = []; const pr = window.prompt; let k = 0; window.prompt = m => { q.push(m); if (!/New material/.test(m)) return pr(m); return k++ === 0 ? null : 'Teak 18'; };
        const fire = () => { const s = document.querySelector('.me-ed [data-mr="0|mat"]'); s.value = '__add'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); };
        fire(); await new Promise(r => setTimeout(r, 500)); fire(); await new Promise(r => setTimeout(r, 1200));
        window.prompt = pr; return { n: q.filter(m => /New material/.test(m)).length, mat: document.querySelector('.me-ed [data-mr="0|mat"]').value }; });
      rec('＋ Add new material: Cancel, then pick it again → asked again (2 in total, once each), "Teak 18" picked', ask2.n === 2 && ask2.mat === 'Teak 18', JSON.stringify(ask2));
      await closeAll(p);
      rec('section 3 PC: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
      // phone 360 px: the card's material box asks once
      const ph = await X.dev(browser, S, 'office', { viewport: { width: 360, height: 740 } });
      await ph.page.evaluate(() => { localStorage.setItem('wpfEditPin', pins().prod || pins().admin); openListEditor(null, 'WO-3'); }); await sleep(500);
      const pa = await ph.page.evaluate(async () => { const q = []; const pr = window.prompt; window.prompt = m => { q.push(m); return /New material/.test(m) ? 'Phone Oak' : pr(m); };
        const all = [...document.querySelectorAll('.me-ed [data-mr="0|mat"]')], vis = all.filter(e => e.offsetParent !== null);
        const s = vis[0] || all[0]; if (!s) return { err: 'no mat box' };
        s.value = '__add'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 1200)); window.prompt = pr;
        return { boxes: all.length, visible: vis.length, n: q.filter(m => /New material/.test(m)).length, mat: ([...document.querySelectorAll('.me-ed [data-mr="0|mat"]')].find(e => e.offsetParent !== null) || {}).value }; });
      rec('phone 360 px: ＋ Add new material on the card asks the name ONCE and picks it', pa.n === 1 && pa.mat === 'Phone Oak', JSON.stringify(pa));
      // 360 px: long project / customer messages and the error line never push the window sideways
      await closeAll(ph.page);
      D.insert(S.db, 'projects', { id: 'PL1', name: 'Twin Oaks Residential Development Phase 2 Block C Apartments North', customer: 'Twinlong Homes', cien_names: ['Twinlong Homes'] });
      D.insert(S.db, 'projects', { id: 'PL2', name: 'Twin Oaks Residential Development Phase 2 Block D Duplex Houses South', customer: 'Twinlong Homes', cien_names: ['Twinlong Homes'] });
      await ph.page.evaluate(() => { DB.orders.push(Object.assign({}, DB.orders.find(o => o.wo === 'WO-3'), { wo: 'WO-2617-1234-99', customer: 'Twinlong Homes', pid: undefined })); });
      await ph.page.evaluate(() => openListEditor(null, 'WO-2617-1234-99')); await sleep(1200);
      const ov = await ph.page.evaluate(() => { const o = document.querySelector('.me-ed'), tb = document.querySelector('.me-ed .me-tb'), pm = document.getElementById('me-pm');
        const r = el => el ? Math.round(el.getBoundingClientRect().right) : null;
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ow: o.scrollWidth, oc: o.clientWidth, tbw: tb && tb.scrollWidth, tbc: tb && tb.clientWidth, pmR: r(pm), x: r(document.getElementById('me-x0')), pm: pm && pm.innerText.slice(0, 80),
          btnR: Math.max(...[...document.querySelectorAll('#me-pm button')].map(b => b.getBoundingClientRect().right)) }; });
      rec('phone 360 px: "fits more than one project" with two long (spaced) project names → no sideways scroll, buttons on screen', ov.sw <= ov.cw + 1 && ov.ow <= ov.oc + 1 && ov.pmR <= 360 && ov.btnR <= 360 && ov.x <= 360, JSON.stringify(ov));
      await ph.page.evaluate(() => { const b = document.querySelector('[data-mepp]'); if (b) b.click(); }); await sleep(300);
      await ph.page.evaluate(() => { const e = document.getElementById('me-err'); if (e) e.textContent = 'WO-2617-1234-99 is a Verylongprojectnamewithoutspaces job, not Anotherverylongprojectnamenospaces — it was taken off this list'; }); await sleep(100);
      const ov2 = await ph.page.evaluate(() => ({ ow: document.querySelector('.me-ed').scrollWidth, oc: document.querySelector('.me-ed').clientWidth, er: Math.round(document.getElementById('me-err').getBoundingClientRect().right) }));
      rec('phone 360 px: a long unbroken error message wraps (no sideways scroll)', ov2.ow <= ov2.oc + 1 && ov2.er <= 360, JSON.stringify(ov2));
      await ph.close();
    }

    // =====================================================================================================================
    // 4. L11/L12 — WO drop-down with ~650 jobs and 40 customers: speed, sort (odd dates), left-out jobs, chosen WO kept
    // =====================================================================================================================
    {
      const r = row();
      const CUST = Array.from({ length: 40 }, (_, i) => 'Builder ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? 'x' : '') + ' Homes');
      for (let i = 0; i < 650; i++) {
        const c = CUST[i % 40], d = new Date(Date.UTC(2026, 10, 1 + (i * 7) % 90)).toISOString().slice(0, 10);
        r.orders.push(H.order({ wo: 'WO-3' + String(i).padStart(3, '0'), customer: c, floor: String(i % 9), unit: String(i), title: 'JOB ' + i, dueDate: d, origDueDate: d,
          shippedAt: i % 31 === 5 ? '2026-10-20T10:00:00Z' : undefined, cienHold: i % 37 === 3 ? true : undefined, delDone: i % 41 === 7 ? true : undefined }));
      }
      // odd dates on customer "Builder A Homes" (P-BA)
      const odd = [['WO-ODD1', 'TBC'], ['WO-ODD2', '2026-02-30'], ['WO-ODD3', '10/11/2026'], ['WO-ODD4', null], ['WO-ODD5', '2026-11-05T00:00:00Z'], ['WO-ODD6', ' 2026-11-06']];
      odd.forEach(([wo, d]) => r.orders.push(H.order({ wo, customer: 'Builder A Homes', floor: '1', unit: wo, title: 'ODD', dueDate: d, origDueDate: d })));
      const S = X.makeServer(r);
      CUST.forEach((c, i) => D.insert(S.db, 'projects', { id: 'PB' + i, name: c.replace(' Homes', ' Site'), customer: c, cien_names: [c] }));
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await asks(p);
      // (test set-up: X.dev's lsReset() can land while the page's own first load is still in flight — that load's rows are then
      //  dropped as an older generation. Load again until the 40 projects are there.)
      for (let k = 0; k < 5 && !(await p.evaluate(() => lsProjects().length >= 40)); k++) await p.evaluate(async () => { await (LST.loading || null); lsReset(); await lsLoad(); });
      await p.evaluate(() => { window.__e = openListEditor(null, '', 'PB0'); }); await sleep(500);
      await p.waitForFunction(() => document.querySelectorAll('.me-ed #me-wo option').length > 5, null, { timeout: 10000 }).catch(() => {});
      const ms = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 10; i++) window.__e.draw(); return (performance.now() - t0) / 10; });
      rec('L11 speed: 680 jobs / 40 customers — one redraw of the window < 150 ms (' + ms.toFixed(1) + ' ms)', ms < 150, ms.toFixed(1) + ' ms');
      const ms2 = await p.evaluate(() => { const e = document.querySelector('.me-ed [data-mr="0|item"]'); const t0 = performance.now(); for (let i = 0; i < 20; i++) { e.value = 'S' + i; e.dispatchEvent(new Event('input')); } return (performance.now() - t0) / 20; });
      rec('L11 speed: typing in a cell (input event) < 30 ms each (' + ms2.toFixed(1) + ' ms)', ms2 < 30, ms2.toFixed(1) + ' ms');
      const os = await p.evaluate(() => [...document.querySelectorAll('.me-ed #me-wo option')].map(o => ({ v: o.value, t: o.textContent })).filter(o => o.v));
      const exp = r.orders.filter(o => o.customer === 'Builder A Homes' && !o.shippedAt && !o.cienHold && !o.delDone).map(o => o.wo);
      const dbg = await p.evaluate(() => ({ pid: (e => e ? e.value : ((document.getElementById('me-ptxt') || { dataset: {} }).dataset.pid || ''))(document.getElementById('me-pid')), st: window.__e && window.__e.st.pid, np: lsProjects().length, no: DB.orders.length, o0: [...document.querySelectorAll('.me-ed #me-wo option')].slice(0, 2).map(o => o.textContent), kp: (lsProjForCust('Builder A Homes') || {}).id, pm: (document.getElementById('me-pm') || {}).innerText }));
      rec('L11: drop-down for Builder A = exactly its live jobs (shipped / on hold / delivered left out)', os.length === exp.length && exp.every(w => os.some(o => o.v === w)), JSON.stringify({ got: os.length, exp: exp.length, extra: os.filter(o => !exp.includes(o.v)).map(o => o.v).slice(0, 5), dbg }));
      const iTBC = os.findIndex(o => o.v === 'WO-ODD1'), iNull = os.findIndex(o => o.v === 'WO-ODD4'), iSlash = os.findIndex(o => o.v === 'WO-ODD3'), iBad = os.findIndex(o => o.v === 'WO-ODD2');
      const firstReal = os.findIndex(o => /^WO-3/.test(o.v));
      rec('[LOW] L12 sort: odd dates ("TBC", "10/11/2026", "2026-02-30") are NOT put at the top, ahead of real due dates', [iTBC, iSlash, iBad].every(i => i > firstReal), JSON.stringify(os.slice(0, 4).map(o => o.t)));
      rec('L12 sort: no due date (null) is last', iNull === os.length - 1 || os.slice(iNull).every(o => /no due date|due\s*$/.test(o.t) || ['WO-ODD1', 'WO-ODD2', 'WO-ODD3'].includes(o.v)), JSON.stringify(os.slice(-4).map(o => o.t)));
      const badLines = os.filter(o => /due\s*(·|$)/.test(o.t) || /Invalid|NaN|undefined/.test(o.t)).map(o => o.t);
      rec('[LOW] L12 format: an odd due date never shows as "due " with nothing after it (or Invalid/NaN)', !badLines.length, JSON.stringify(badLines));
      const d5 = os.find(o => o.v === 'WO-ODD5');
      rec('L12 format: a due date with a time ("2026-11-05T00:00:00Z") shows "due 5 Nov"', d5 && /due 5 Nov/.test(d5.t), d5 && d5.t);
      // chosen WO never vanishes: pick a Builder A job, change project, redraw ×3, project back
      await setid(p, 'me-wo', exp[3]); await sleep(100);
      await p.evaluate(() => { const s = document.getElementById('me-pid'); s.value = 'PB1'; s.dispatchEvent(new Event('change')); }); await sleep(200);
      let w = await p.evaluate(() => ({ wo: document.getElementById('me-wo').value, err: document.getElementById('me-err').textContent }));
      rec('L11 new list: project changed → the other project\'s WO taken off, said why', !w.wo && /taken off this list/.test(w.err), JSON.stringify(w));
      await closeAll(p);
      // existing list: chosen WO kept through project changes and many redraws
      X.F3.seedList(S, 'LB', { wos: [exp[2]], name: 'Builder A list' }); await p.evaluate(async () => { lsReset(); await lsLoad(); });
      await p.evaluate(() => { window.__e = openListEditor('LB'); }); await sleep(500);
      // (list-window release) an existing list shows its WO and project as text — no drop-downs to change; redraws keep the WO
      for (let k = 0; k < 4; k++) { await p.evaluate(() => window.__e.draw()); await sleep(50); }
      w = await p.evaluate(() => ({ wo: (document.querySelector('#me-wol > b') || {}).textContent, dd: !!document.getElementById('me-pid') || !!document.getElementById('me-wo') }));
      rec('L11 existing list: shown as text (no project / WO drop-downs); 4 redraws → the WO is still there', w.wo === exp[2] && !w.dd, JSON.stringify(w));
      w = w.wo;
      await closeAll(p);
      // typed WO sets the project — in lower case / with spaces round it
      await p.evaluate(() => { openListEditor(null, '', ''); }); await sleep(400);
      await p.evaluate(wo => { const e = document.getElementById('me-jwo'); e.value = '  ' + wo.toLowerCase() + ' '; e.dispatchEvent(new Event('input')); document.getElementById('me-find').click(); }, exp[5]); await sleep(900);
      w = await pst(p);
      const wv = await p.evaluate(() => document.getElementById('me-wo').value);
      rec('L11: a typed WO in lower case with spaces ("  ' + exp[5].toLowerCase() + ' ") → found, its project (Builder A Site) set', wv === exp[5] && w.pid === 'PB0', JSON.stringify({ wv, w }));
      await closeAll(p);
      rec('section 4: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // =====================================================================================================================
    // 5. names: a typed name found in Find old list, Lists search, and the template search box (apostrophe, case)
    // =====================================================================================================================
    {
      const S = X.makeServer(row());
      ['Type A', 'Type B', 'Type C', 'Type D', 'Type E', 'Type F'].forEach((n, i) => X.F3.seedList(S, 'T' + (i + 1), { wos: [], name: n, list: { is_template: true, type_name: n, list_type: 'kitchen' } }));
      X.F3.seedList(S, 'T7', { wos: [], name: "O'Grady's Kitchen", list: { is_template: true, type_name: "O'Grady's Kitchen", list_type: 'kitchen' } });
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await asks(p);
      await p.evaluate(() => openListEditor(null, 'WO-52')); await sleep(500);
      await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White'); await setid(p, 'me-name', "Mary's Utility — Type B");
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1200); await closeAll(p);
      await p.evaluate(() => lsFindDlg('P1')); await sleep(300);
      await setid(p, 'fo-q', "MARY'S");
      rec('names: "Mary\'s Utility — Type B" found in Find old list by "MARY\'S" (case)', await p.evaluate(() => /Mary's Utility/.test(document.getElementById('fo-body').innerText)));
      await closeAll(p);
      await p.evaluate(() => { LH.q = "mary's utility"; showTab('l'); }); await sleep(400);
      rec('names: …and in the Lists search', await p.evaluate(() => /Mary's Utility/.test(document.body.innerText)));
      await p.evaluate(() => { LH.q = ''; });
      await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(500);
      await p.evaluate(() => document.getElementById('me-instpl').click()); await sleep(300);
      const tq = await p.evaluate(() => { const q = document.getElementById('it-q'); if (!q) return null; q.value = "o'grady"; q.dispatchEvent(new Event('input'));
        return [...document.querySelectorAll('[data-itq]')].filter(r => r.style.display !== 'none').map(r => r.querySelector('b').textContent); });
      rec('names: Insert from template (7 templates) find box: "o\'grady" → only "O\'Grady\'s Kitchen"', JSON.stringify(tq) === JSON.stringify(["O'Grady's Kitchen"]), JSON.stringify(tq));
      const tq2 = await p.evaluate(() => { const q = document.getElementById('it-q'); if (!q) return null; q.value = '  type   b '; q.dispatchEvent(new Event('input'));
        return [...document.querySelectorAll('[data-itq]')].filter(r => r.style.display !== 'none').map(r => r.querySelector('b').textContent); });
      rec('names: template find box with extra spaces "  type   b " → "Type B"', JSON.stringify(tq2) === '["Type B"]', JSON.stringify(tq2));
      await closeAll(p);
      rec('section 5: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // =====================================================================================================================
    // 6. L10 storage: full on EVERY write, blocked on read too; nothing ever removed (all keys + values before / after)
    // =====================================================================================================================
    {
      const S = X.makeServer(row());
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await p.evaluate(() => { localStorage.setItem('wpf_quotes_backup', 'q'.repeat(300000)); localStorage.setItem('wpf_crash_backup', 'c'.repeat(5000)); localStorage.setItem('wpf_ring_0', 'r'); localStorage.setItem('otherApp', 'o'); });
      const snap = () => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
      const before = await snap();
      // every setItem full (a real full device): the app keeps going, the message is the "full" one
      await p.evaluate(() => { const si = Storage.prototype.setItem; window.__si = si; window.__ri = Storage.prototype.removeItem; window.__cl = Storage.prototype.clear; window.__rm = [];
        Storage.prototype.setItem = function (k, v) { if (this === localStorage) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); return si.call(this, k, v); };
        Storage.prototype.removeItem = function (k) { window.__rm.push(k); return window.__ri.call(this, k); };
        Storage.prototype.clear = function () { window.__rm.push('*CLEAR*'); }; });
      await p.evaluate(() => { DB.orders.find(o => o.wo === 'WO-3').notes = 'full device'; writePend(); if (typeof sched === 'function') sched(); }); await sleep(400);
      let w = await p.evaluate(() => ({ why: DB.pendWhy, txt: document.body.innerText }));
      rec('L10 full on every write: "storage for the planner is full" said, with the fix', w.why === 'full' && /storage for the planner is full/.test(w.txt) && /Settings → Storage on this device/.test(w.txt), JSON.stringify({ why: w.why }));
      // the list window still opens and saves while storage is full
      await p.evaluate(() => openListEditor(null, 'WO-4')); await sleep(500);
      await fillSaw(p, 0, 'Side', '1', '700', '500', 'MFC White');
      await p.evaluate(() => document.getElementById('me-save').click()); await sleep(1500);
      rec('L10 full: a cutting list still saves to the database (Saved ✓) while this device\'s storage is full', !!(await donep(p)) && S.db.t.lists.some(l => !l.archived && (l.wos || []).includes('WO-4')), JSON.stringify(await pst(p)));
      await closeAll(p);
      await p.evaluate(() => showTab('s')); await sleep(600);
      const dl = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.evaluate(() => { const b = document.getElementById('btn-stg-dl'); if (b) b.click(); })]);
      const quota = await p.evaluate(() => (document.getElementById('set-store') || {}).innerText || '');
      rec('L10 full: Settings storage panel opens and the Download works', /Storage on this device/.test(quota) && !!dl[0], quota.slice(0, 120));
      const rm = await p.evaluate(() => window.__rm);
      await p.evaluate(() => { Storage.prototype.setItem = window.__si; Storage.prototype.removeItem = window.__ri; Storage.prototype.clear = window.__cl; });
      const after = await snap();
      const lost = Object.keys(before).filter(k => !(k in after) && !/^wpfPending:/.test(k)) /* the app's own pending-save copy goes once that save landed: intended */, changedOld = Object.keys(before).filter(k => /^wpf_|^otherApp$/.test(k) && after[k] !== before[k]);
      rec('L10: NOTHING removed — every key there before is there after (and the old Quoting-tool + other items unchanged)', !lost.length && !changedOld.length, JSON.stringify({ lost, changedOld }));
      rec('L10: the app never called removeItem / clear on an old Quoting-tool (wpf_…) or other app\'s item', !rm.some(k => /^wpf_|^otherApp$|\*CLEAR\*/.test(k)), JSON.stringify(rm.filter(k => /^wpf_|otherApp|CLEAR/.test(k))));
      rec('section 6 full: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await p.evaluate(() => ['wpf_quotes_backup', 'wpf_crash_backup', 'wpf_ring_0', 'otherApp'].forEach(k => localStorage.removeItem(k))); // the test's own items
      await t.close();

      // blocked: a browser where storage throws SecurityError on READ and WRITE (cookies blocked) — does the app still start?
      const S2 = X.makeServer(row());
      const t2 = await X.dev(browser, S2, 'office');
      await t2.page.evaluate(() => { const bad = () => { throw new DOMException('Access is denied for this document.', 'SecurityError'); };
        Storage.prototype.setItem = bad; Storage.prototype.getItem = bad; Storage.prototype.removeItem = bad; DB.orders.find(o => o.wo === 'WO-3').notes = 'blocked'; writePend(); }); await sleep(300);
      rec('L10 blocked (read and write throw): "This browser is blocking storage … use a normal Chrome window."', await t2.page.evaluate(() => DB.pendWhy === 'blocked' && /This browser is blocking storage/.test(document.body.innerText)));
      await t2.page.evaluate(() => showTab('s')); await sleep(500);
      const bl = await t2.page.evaluate(() => ({ tab, store: !!document.getElementById('set-store'), msg: /blocking storage/.test(document.body.innerText), picker: /Who's using this screen/.test(document.body.innerText) }));
      rec('L10 blocked: after Settings is pressed the "blocking storage — use a normal Chrome window" message is still on screen', bl.msg, JSON.stringify(bl));
      rec('[LOW] L10 blocked: Settings → 💾 Storage on this device can be reached (not thrown back to "Who\'s using this screen?")', bl.store && !bl.picker, JSON.stringify(bl));
      await t2.page.evaluate(() => openListEditor(null, 'WO-4')); await sleep(500);
      rec('L10 blocked: the list window still opens', await ed(t2.page), JSON.stringify(S2.errors));
      rec('section 6 blocked: no page errors', !(S2.errors || []).length, JSON.stringify(S2.errors));
      await t2.close();
    }

    // =====================================================================================================================
    // 7. lists switched OFF: the old window behaves as before (outside click / Esc / no project made / no ✕ bar)
    // =====================================================================================================================
    {
      const S0 = X.makeServer(X.v1Row());
      S0.row.orders.push(H.order({ wo: 'WO-60', customer: 'Off Homes', floor: '1', unit: '1', title: 'OFF', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
      const o0 = await X.dev(browser, S0, 'office'), p = o0.page;
      const np = S0.db.t.projects.length;
      await p.evaluate(() => openListEditor(null, 'WO-60')); await sleep(800);
      rec('switch OFF: opening a WO with an unlinked customer makes NO project', S0.db.t.projects.length === np && !S0.log.some(x => /^POST \/projects/.test(x)), JSON.stringify(S0.log.filter(x => /projects/.test(x))));
      const v1 = await p.evaluate(() => ({ name: (document.getElementById('me-name') || {}).value, wo: [...document.querySelectorAll('#me-wo option')].length, x: !!document.getElementById('me-x0') }));
      rec('switch OFF: old window — name pre-filled from the job as before, every live job in the WO list, no ✕ bar', v1.name === '1' && v1.wo > 5 && !v1.x, JSON.stringify(v1));
      await p.evaluate(() => { const o = document.querySelector('.pod-ovl'); o.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await sleep(150);
      const gone = await p.evaluate(() => !document.querySelector('.pod-ovl'));
      rec('switch OFF: outside click behaves as in today\'s app (closes the old window)', gone);
      rec('switch OFF: no page errors', !(S0.errors || []).length, JSON.stringify(S0.errors));
      await o0.close();
    }
  } finally { await browser.close(); }
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
