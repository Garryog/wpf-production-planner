// FINAL-2 Tester round (15 Nov) — attack on 574ae16 (Find the Cienapps WO leaves out on-hold jobs), c1895c7 / c672416
// (template Save asks for permission again when the screen was switched), 5a2c13e (Save while "Is this project …? Yes / No" is
// unanswered), a64bd30 ("Confirm all green" with a search on) and f94bd39 / 2049911 (phone 360 px: Materials window).
// Fake Supabase only. Run: node tests/list-window/final2-hold-roles-phone.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, fillSaw, save, donep, err, job, rows, liveFor, linesOf } = L;
const st = p => p.evaluate(() => { const q = s => document.querySelector('.me-ed ' + s);
  return { msg: ((q('#me-jbm') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 260), wo: (q('#me-wo') || {}).value || '', hwo: (q('#me-hwo') || {}).innerText || '', mkp: !!q('#me-jmkp'), newp: !!q('#me-ptitle'),
    picks: [...document.querySelectorAll('.me-ed [data-jpick]')].map(b => b.dataset.jpick), opts: [...((q('#me-wo') || {}).options || [])].map(o => o.value).filter(Boolean), err: (q('#me-err') || {}).textContent || '' }; });
const PROC = '5. WORK ORDER PROCESSED';
const o = (wo, floor, unit, title, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor, unit, title, dueDate: '2026-11-30', origDueDate: '2026-11-30', step: PROC }, x || {}));
const EVIL = '<img src=x onerror="window.__xss=1">';
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ================= A. Find the Cienapps WO and on-hold / shipped jobs =================
    { const r = X.v2Row();
      r.orders.push(o('WO-HOLD', '1', '12', 'APT 12 KITCHEN', { cienHold: true }), o('WO-SHIP', '2', '20', 'APT 20 KITCHEN', { shippedAt: '2026-10-20T10:00:00Z' }), o('WO-LATER', '3', '30', 'APT 30 KITCHEN'),
        o('WO-H2', '4', '40', 'APT 40 KITCHEN', { cienHold: true }), o('WO-OK2', '4', '40', 'APT 40 KITCHEN'), o('WO-PICKED', '5', '50', 'APT 50 KITCHEN'),
        o('WO-HX', '6', '60', EVIL + " O'Grady APT 60", { cienHold: true }));
      const S = X.makeServer(r); D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
      const t = await X.dev(browser, S, 'design'), p = t.page, kb = p.keyboard; await asks(p);
      const open = async () => { await closeAll(p); await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, '', 'PK'); }); await sleep(800); };
      const look = async (f, u, ttl) => { await p.click('#me-jf'); await kb.type(f); await kb.press('Tab'); await kb.type(u); await kb.press('Tab'); if (ttl) await kb.type(ttl); await kb.press('Tab'); await sleep(600); return st(p); };
      const pn = () => S.row.orders.filter(x => /^P-\d+$/.test(x.wo)).map(x => x.wo);
      // 1. the only match is on hold
      await open(); let s = await look('1', '12', 'APT 12 KITCHEN');
      rec('[HIGH] A1 the only job for Floor 1 · Unit 12 is ON HOLD: it is NOT filled in and not in the Work order drop-down', s.wo !== 'WO-HOLD' && s.hwo !== 'WO-HOLD' && !s.opts.includes('WO-HOLD') && !s.picks.includes('WO-HOLD'), JSON.stringify(s));
      rec('[MEDIUM] A2 … and the person is TOLD the job exists but is on hold (not just "No Cienapps work order found … Make a P-number instead")', /on hold|WO-HOLD/i.test(s.msg), s.msg);
      // press "Make a P-number instead…" → what happens? never a silent second job for the house
      const p0 = pn().length, asked0 = await p.evaluate(() => { window.__asked = []; const b = document.querySelector('.me-ed #me-jmkp'); if (!b) return 'no button'; b.click(); return 'ok'; }); await sleep(500);
      const a1 = await p.evaluate(() => window.__asked.slice()); const s2 = await st(p);
      rec('(info) A3 "Make a P-number instead…" pressed for that house (' + asked0 + '): asked', true, JSON.stringify(a1.map(x => x.replace(/\s+/g, ' ').slice(0, 200))));
      if (s2.newp) { await setid(p, 'me-pdue', '2026-12-01', 'change'); const i = (await rows(p)).findIndex(x => !x.hdr); await fillSaw(p, i, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
        await p.evaluate(() => { window.__asked = []; window.__confirm = m => /WO-HOLD/.test(m) ? false : true; }); await click(p, 'me-save'); await sleep(2500);
        const a2 = await p.evaluate(() => window.__asked.slice()), e2 = await err(p), made = pn().length - p0;
        rec('[HIGH] A4 Save of a list on a NEW P-number for the house whose Cienapps job is on hold: NO second job is made silently — the person is stopped / asked and WO-HOLD is named', made === 0 && /WO-HOLD/.test(a2.join('|') + e2), JSON.stringify({ made, asked: a2.map(x => x.replace(/\s+/g, ' ').slice(0, 160)), err: e2 }));
        rec('[MEDIUM] A5 … and that message says WO-HOLD is ON HOLD (else the person is told "use it" for a job the drop-down hides, right after being told there is none)', /on hold/i.test(a2.join('|') + e2), JSON.stringify({ asked: a2.map(x => x.replace(/\s+/g, ' ').slice(0, 200)), err: e2 }));
        // answer OK = use it → does the list go on the on-hold job?
        await p.evaluate(() => { window.__asked = []; window.__confirm = true; }); await click(p, 'me-save'); await sleep(2500); if (!(await donep(p))) { await click(p, 'me-save'); await sleep(2500); }
        const onHold = liveFor(S, 'WO-HOLD').length;
        rec('(info, ask Garry) A6 answering OK ("use WO-HOLD"): a cutting list is now saved ON the on-hold job (the saw could cut a job that is on hold in Cienapps)?', onHold === 0, JSON.stringify({ listsOnHoldJob: onHold, pnumbers: pn(), err: await err(p), done: (await donep(p) || {}).l }));
      } else rec('(info) A4-A6 the P-number boxes did not open', true, JSON.stringify(s2));
      // 2. on hold + a live one for the same house → the live one is filled in, the on-hold one never offered
      await open(); s = await look('4', '40', 'APT 40 KITCHEN');
      rec('[HIGH] A7 two jobs for one house, one on hold: the live one (WO-OK2) is filled in by itself; WO-H2 is not offered', (s.wo === 'WO-OK2' || s.hwo === 'WO-OK2') && !s.picks.includes('WO-H2'), JSON.stringify(s));
      // 3. shipped
      await open(); s = await look('2', '20', 'APT 20 KITCHEN');
      rec('A8 the only job is SHIPPED: not filled in, not offered', s.wo !== 'WO-SHIP' && s.hwo !== 'WO-SHIP' && !s.picks.includes('WO-SHIP'), JSON.stringify(s));
      // 4. put on hold AFTER the window opened (an import on this PC / a refresh), before the look-up
      await open(); await p.evaluate(() => { DB.orders.find(x => x.wo === 'WO-LATER').cienHold = true; });
      s = await look('3', '30', 'APT 30 KITCHEN');
      rec('[HIGH] A9 job put on hold AFTER the window opened, then Floor / Unit typed: NOT filled in (the window does not use a stale copy of the jobs)', s.wo !== 'WO-LATER' && s.hwo !== 'WO-LATER', JSON.stringify(s));
      // 5. found and filled in, THEN it goes on hold, then Save
      await open(); s = await look('5', '50', 'APT 50 KITCHEN');
      rec('A10 set-up: WO-PICKED found and filled in', s.wo === 'WO-PICKED' || s.hwo === 'WO-PICKED', JSON.stringify(s));
      const i5 = (await rows(p)).findIndex(x => !x.hdr); await fillSaw(p, i5, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
      await p.evaluate(() => { DB.orders.find(x => x.wo === 'WO-PICKED').cienHold = true; window.__asked = []; }); await click(p, 'me-save'); await sleep(2500);
      const a5 = await p.evaluate(() => window.__asked.slice()), e5 = await err(p), d5 = await donep(p);
      rec('(info, already on live?) [LOW] A11 the picked job goes ON HOLD while the window is open, then Save: the person is told / asked (not a plain "Saved ✓ — with the Saw")', !d5 || /hold/i.test(a5.join('|') + e5 + (d5.l || '') + (d5.h || '')), JSON.stringify({ saved: !!d5, asked: a5.length, err: e5, done: d5 && d5.h }));
      // 6. the WO number TYPED by hand for an on-hold job
      await open(); await p.evaluate(() => { window.__asked = []; }); await p.click('#me-jwo').catch(() => {}); await kb.type('WO-HOLD'); await kb.press('Tab'); await sleep(600); s = await st(p);
      const a6 = await p.evaluate(() => window.__asked.slice());
      rec('(info — NOT proved: this test could not get its typing into the WO box; by reading jbFind, a typed on-hold WO is checked for shipped / delivered only) A12 the on-hold job\'s number TYPED into the WO box: not accepted silently', !(s.wo === 'WO-HOLD' || s.hwo === 'WO-HOLD') || /hold/i.test(a6.join('|') + s.msg + s.err), JSON.stringify({ s, asked: a6.map(x => x.slice(0, 120)) }));
      // 7. nasty title on an on-hold job never shows / runs
      await open(); s = await look('6', '60', 'x');
      rec('A13 on-hold job with <img onerror> in its title: nothing runs', !(await p.evaluate(() => window.__xss || 0)) && s.wo !== 'WO-HX', JSON.stringify(s.msg));
      rec('A: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ================= B. template Save re-checks permission when the screen was switched =================
    { const S = X.makeServer(X.v2Row(), { lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']] });
      X.F3.seedList(S, 'T1', { wos: [], name: 'Type 2', list: { is_template: true, type_name: 'Type 2', list_type: 'house' } });
      const tpl = () => S.db.t.lists.find(l => l.id === 'T1'); const q = () => (linesOf(S, 'T1').find(x => x.part === 'Hinge') || {}).qty;
      const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
      const openT = async () => { await closeAll(p); await p.evaluate(async () => { lsReset(); await lsLoad(); window.__asked = []; window.__prompted = []; window.__confirm = true; window.__prompt = 'Op'; openListEditor('T1'); }); await sleep(900); };
      const sw = async role => { await p.evaluate(r => { ROLE = r; localStorage.setItem('wpfRole', r); }, role); }; // the screen changes under the open window (another tab of the same PC, the role picker)
      const touch = async v => { const r = await rows(p), i = r.findIndex(x => x.item === 'Hinge'); await setv(p, i + '|qty', String(v)); await sleep(150); };
      let n = 20;
      for (const role of ['office', 'pm', 'saw', 'stores', 'floor', 'driver', 'dash', '']) { await sw('design'); await openT(); await touch(++n); await sw(role);
        await p.evaluate(() => { window.__prompted = []; window.__prompt = null; }); // PIN question answered Cancel
        await click(p, 'me-save'); await sleep(1500);
        const e = await err(p), pr = await p.evaluate(() => window.__prompted.slice()), open = await ed(p), box = ((await rows(p)).find(x => x.item === 'Hinge') || {}).qty;
        rec('[HIGH] B1 template window opened on Drawing office, screen switched to "' + (role || '(none)') + '", Save (PIN question cancelled): NOT saved, told why, the typed rows stay', q() !== String(n) && /Not saved/.test(e) && /Drawing office, Production Manager or Admin/.test(e) && open && box === String(n), JSON.stringify({ db: q(), e, prompted: pr.map(x => x.slice(0, 60)), open, box })); }
      // wrong PIN, a remembered PIN, the right PIN
      await sw('design'); await openT(); await touch(++n); await sw('office');
      await p.evaluate(() => { localStorage.setItem('wpfPin_design', '8888'); localStorage.setItem('wpfPin_admin', '9000'); localStorage.setItem('wpfPin_prod', '7777'); sessionStorage.setItem('wpfPin_design', '8888'); window.__prompted = []; window.__prompt = '2468'; });
      await click(p, 'me-save'); await sleep(1500);
      let pr = await p.evaluate(() => window.__prompted.slice());
      rec('[HIGH] B2 switched to Office with the Drawing office PIN REMEMBERED on the PC, the office PIN typed at the question: NOT saved (a remembered PIN never opens templates; the office PIN is not good for them)', q() !== String(n) && pr.some(x => /PIN/.test(x)), JSON.stringify({ db: q(), err: await err(p), prompted: pr.map(x => x.slice(0, 70)) }));
      await p.evaluate(() => { window.__prompted = []; window.__prompt = m => /PIN/.test(m) ? '8888' : 'Op'; }); await click(p, 'me-save'); await sleep(2200);
      rec('B3 … Save again, the Drawing office PIN typed at the question: saved', q() === String(n), JSON.stringify({ db: q(), err: await err(p) }));
      // Production Manager is allowed (Garry 13 Nov), Admin too; switched away and BACK = no question
      for (const role of ['prod', 'admin']) { await sw('design'); await openT(); await touch(++n); await sw(role); await p.evaluate(() => { window.__prompted = []; window.__prompt = m => /PIN/.test(m) ? null : 'Op'; }); await click(p, 'me-save'); await sleep(2200);
        pr = await p.evaluate(() => window.__prompted.slice());
        rec('[HIGH] B4 switched to "' + role + '" (allowed — Garry 13 Nov): Save works with NO PIN question', q() === String(n) && !pr.some(x => /PIN/.test(x)), JSON.stringify({ db: q(), err: await err(p), prompted: pr.map(x => x.slice(0, 60)) })); }
      await sw('design'); await openT(); await touch(++n); await sw('office'); await sw('design'); await p.evaluate(() => { window.__prompted = []; window.__prompt = m => /PIN/.test(m) ? null : 'Op'; }); await click(p, 'me-save'); await sleep(2200);
      rec('B5 switched to Office and BACK to Drawing office before Save: saved, no PIN question', q() === String(n) && !(await p.evaluate(() => window.__prompted.some(x => /PIN/.test(x)))), JSON.stringify({ db: q(), err: await err(p) }));
      // an ORDINARY list is never caught by the template check
      await sw('design'); await closeAll(p); await p.evaluate(async () => { lsReset(); await lsLoad(); window.__prompt = 'Op'; openListEditor('L1'); }); await sleep(900);
      { const r = await rows(p), i = r.findIndex(x => x.item === 'Hinge'); await setv(p, i + '|qty', '33'); } await sw('office'); await p.evaluate(() => { window.__prompted = []; }); await click(p, 'me-save'); await sleep(2200);
      rec('[HIGH] B6 an ORDINARY list, screen switched Drawing office → Office before Save: saved as always, no PIN question', (linesOf(S, 'L1').find(x => x.part === 'Hinge') || {}).qty === '33' && !(await p.evaluate(() => window.__prompted.some(x => /PIN/.test(x)))), JSON.stringify(await err(p)));
      rec('B: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ================= C. Save while "Is this project …? Yes / No" is unanswered =================
    { const r = X.v2Row(); const NAME = "Aderrig Park <b>Homes</b> O'Grady";
      r.orders.push(H.order({ wo: 'WO-ASK', customer: 'Aderrig Park Homes', floor: 'T1', unit: '1', title: 'HOUSE 1', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
      const S = X.makeServer(r); const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
      await closeAll(p); await p.evaluate(() => { window.__asked = []; openListEditor(null, 'WO-ASK'); }); await sleep(900);
      let j = await job(p);
      rec('C0 set-up: "Is this project \'Aderrig\'?" is on screen, no project picked', /Is this project 'Aderrig'/.test(j.pm) && !j.pid, JSON.stringify([j.pid, j.pm]));
      const i = (await rows(p)).findIndex(x => !x.hdr); await fillSaw(p, i, 'Side', '2', '720', '560', 'MFC White'); await sleep(200);
      const n0 = S.db.t.lists.length, pj0 = S.db.t.projects.length;
      await click(p, 'me-save'); await sleep(1200); await p.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); }); await sleep(800);
      const e = await err(p);
      rec('[MEDIUM] C1 Save (and Ctrl+S) with the question unanswered: nothing saved, no project made, the message points at the question ("Answer the question above first … Yes or No")', S.db.t.lists.length === n0 && S.db.t.projects.length === pj0 && /Answer the question above first/.test(e) && /Aderrig/.test(e) && /Yes or No/.test(e), e);
      rec('C2 the question and the typed row are still there', /Is this project/.test((await job(p)).pm) && (await rows(p)).some(x => x.item === 'Side'));
      await p.evaluate(() => document.getElementById('me-pyes').click()); await sleep(900); await setv(p, (await rows(p)).findIndex(x => x.item === 'Side') + '|mat', 'MFC White'); await sleep(200); await click(p, 'me-save'); await sleep(2500);
      const d = await donep(p);
      rec('C3 answer Yes, Save: ONE list on WO-ASK in project Aderrig', !!d && liveFor(S, 'WO-ASK').length === 1 && liveFor(S, 'WO-ASK')[0].project_id === 'P1', JSON.stringify([d && d.l, await err(p), liveFor(S, 'WO-ASK').map(l => l.project_id)]));
      // the project's name in the message: HTML / apostrophe safe
      D.update(S.db, 'projects', D.find(S.db, 'projects', 'P2'), { name: "Lucan <img src=x onerror=\"window.__xss=1\"> O'Grady" });
      S.row.orders.push(H.order({ wo: 'WO-ASK2', customer: 'Lucan Homes Developments', floor: 'T1', unit: '2', title: 'HOUSE 2', dueDate: '2026-11-30', origDueDate: '2026-11-30' }));
      await closeAll(p); await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); window.__xss = 0; openListEditor(null, 'WO-ASK2'); }); await sleep(900);
      j = await job(p);
      if (/Is this project/.test(j.pm)) { const k = (await rows(p)).findIndex(x => !x.hdr); await fillSaw(p, k, 'Side', '2', '720', '560', 'MFC White'); await click(p, 'me-save'); await sleep(1000);
        const e2 = await err(p), x = await p.evaluate(() => ({ xss: window.__xss || 0, img: document.querySelectorAll('.me-ed img').length }));
        rec('[HIGH] C4 project name with <img onerror> and O\'Grady in the new "Answer the question above first" message: plain text, nothing runs', !x.xss && !x.img && /O'Grady/.test(e2) && /<img/.test(e2), JSON.stringify([e2, x])); }
      else rec('(info) C4 the question did not come up for the renamed project (not tested)', true, JSON.stringify(j.pm));
      rec('C: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }

    // ================= D. phone 360 px: Materials window =================
    { const S = X.makeServer(X.v2Row());
      for (let i = 0; i < 40; i++) D.insert(S.db, 'project_materials', { id: 'MX' + i, project_id: 'P1', name: (i === 3 ? 'A very long material name that goes on and on 18mm MFC Egger W980 ST9 Platinum White both sides ' : 'Board ') + i, kind: i % 3 ? 'sheet' : 'other', aliases: i === 5 ? ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight spellings'] : [] });
      const t = await X.dev(browser, S, 'prod', { viewport: { width: 360, height: 640 } }), p = t.page; await asks(p);
      await p.evaluate(async () => { lsReset(); await lsLoad(); document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); lsMaterialsDlg('P1'); }); await sleep(600);
      const geo = () => p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(), inn = o.querySelector('.pod-in'), x = o.querySelector('#pod-x'), vw = innerWidth, vh = innerHeight;
        const r = x.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), ir = inn.getBoundingClientRect();
        const small = [...o.querySelectorAll('button')].filter(b => b.offsetParent).map(b => [b.id || b.textContent.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height)]).filter(b => b[1] < 40);
        return { x: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], inView: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw, hit: hit === x || x.contains(hit), inn: [Math.round(ir.left), Math.round(ir.right)], vw, pageSide: document.documentElement.scrollWidth > vw + 1, innerSide: inn.scrollWidth - inn.clientWidth, small: small.slice(0, 6), nSmall: small.length, st: inn.scrollTop, sh: inn.scrollHeight }; });
      let g = await geo();
      rec('[HIGH] D1 phone 360: Materials window with 42 materials — ✕ Close is on screen and tappable at the top', g.inView && g.hit, JSON.stringify(g));
      rec('[MEDIUM] D2 … the window is inside the screen and the page does not scroll sideways', g.inn[0] >= 0 && g.inn[1] <= g.vw && !g.pageSide, JSON.stringify(g));
      rec('[MEDIUM] D3 … every button in it is at least 40 px tall', g.nSmall === 0, JSON.stringify(g.small));
      for (const where of ['middle', 'bottom']) { await p.evaluate(w => { const inn = [...document.querySelectorAll('.pod-ovl')].pop().querySelector('.pod-in'); inn.scrollTop = w === 'bottom' ? inn.scrollHeight : inn.scrollHeight / 2; }, where); await sleep(200); g = await geo();
        rec('[HIGH] D4 scrolled to the ' + where + ' of the list: ✕ Close is STILL on screen and tappable (not covered by a row)', g.inView && g.hit && g.st > 0, JSON.stringify({ x: g.x, inView: g.inView, hit: g.hit, st: g.st })); }
      // scrolled sideways inside the window (wide table): is ✕ still reachable?
      await p.evaluate(() => { const inn = [...document.querySelectorAll('.pod-ovl')].pop().querySelector('.pod-in'); inn.scrollLeft = inn.scrollWidth; }); await sleep(200); g = await geo();
      rec('[MEDIUM] D5 the table is wider than the phone (' + g.innerSide + ' px to scroll inside the window): scrolled fully to the right, ✕ Close is still on screen', g.innerSide <= 0 || (g.inView && g.hit), JSON.stringify({ x: g.x, inView: g.inView, hit: g.hit, innerSide: g.innerSide }));
      // typed but not saved → ✕ asks; Cancel stays; the bottom Close does the same; Esc
      await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); const e = o.querySelector('#mt-new-n'); e.value = 'Typed not saved'; e.dispatchEvent(new Event('input')); window.__asked = []; window.__confirm = false; });
      const tapX = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); o.querySelector('.pod-in').scrollLeft = 0; o.querySelector('#pod-x').click(); return { open: !!document.getElementById('mt-body'), asked: window.__asked.slice() }; });
      rec('[HIGH] D6 a new material typed but not saved, top ✕ tapped: asks "Close without saving?" naming it; Cancel keeps the window and the text', tapX.open && /Typed not saved/.test(tapX.asked.join('|')) && (await p.evaluate(() => document.getElementById('mt-new-n').value)) === 'Typed not saved', JSON.stringify(tapX));
      const tap2 = await p.evaluate(() => { window.__asked = []; const b = document.getElementById('mt-x2'); if (!b) return { no: true }; b.click(); return { open: !!document.getElementById('mt-body'), asked: window.__asked.length }; });
      rec('D7 the bottom Close does the same (asks; Cancel stays)', tap2.no || (tap2.open && tap2.asked === 1), JSON.stringify(tap2));
      const esc = await p.evaluate(() => { window.__asked = []; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return { open: !!document.getElementById('mt-body'), asked: window.__asked.length }; });
      rec('D8 Esc with text typed but not saved: never closes with the text thrown away silently (asks, or does nothing)', esc.open, JSON.stringify(esc));
      rec('(info) [LOW] D8b Esc on the Materials window when it is opened on its own (no list window under it) presses its ✕ Close, as the code note says', esc.asked === 1, JSON.stringify(esc) + ' — Esc is only listened for while a list window is open');
      const ok = await p.evaluate(() => { window.__confirm = true; document.querySelector('.pod-ovl #pod-x').click(); return { open: !!document.getElementById('mt-body'), ovl: document.querySelectorAll('.pod-ovl').length }; });
      rec('D9 OK closes it — nothing left on screen', !ok.open && ok.ovl === 0, JSON.stringify(ok));
      // exactly one #pod-x while the Materials window sits OVER the list window
      await p.evaluate(() => { openListEditor('L1'); }); await sleep(900);
      const two = await p.evaluate(() => { lsMaterialsDlg('P1'); const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; }); const top = [...document.querySelectorAll('.pod-ovl')].pop(); return { dup: Object.keys(ids).filter(k => ids[k] > 1), podx: top.querySelectorAll('#pod-x').length }; });
      rec('D10 Materials window opened over the list window: its own ✕ is the only #pod-x inside it', two.podx === 1, JSON.stringify(two));
      await p.evaluate(() => { window.__asked = []; window.__confirm = true; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }); await sleep(300);
      rec('[MEDIUM] D11 Esc closes ONLY the Materials window on top — the list window underneath stays open', (await ed(p)) && !(await p.evaluate(() => !!document.getElementById('mt-body'))), JSON.stringify(await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), mt: !!document.getElementById('mt-body') }))));
      const pidH = await p.evaluate(() => { const e = document.querySelector('.me-ed #me-pid'); return e && e.offsetParent ? Math.round(e.getBoundingClientRect().height) : null; });
      rec('(info) D12 phone: height of the Project drop-down in the list window (null = folded away)', pidH === null || pidH >= 40, String(pidH));
      rec('D: no page errors', !(S.errors || []).length, JSON.stringify(S.errors)); await t.close(); }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  await browser.close();
  X.finish();
})();
