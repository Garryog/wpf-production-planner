// MERGE SEAM 2 (Tester, 25 Nov 2026): every role's screens draw with no JavaScript error — lists ON (all SQL run), lists ON with the
// PM sequence SQL not run, lists ON with neither the sequence nor the Project details SQL run, and lists OFF. Job B's pieces
// (🔢 Sequence, ✋ Requests, 📦 Shipped, spec chip, ✎ Project details) must hide quietly when their tables are missing.
// Then the Deliveries page with Job B on: tick-and-book bar, list badge buttons (office + Production Manager), pool order,
// 🔢 Sequence for every role. Fake Supabase only. Run: node tests/merge25/m2-roles-deliveries.test.js
const M = require('./m25lib.js');
const { X, H, sleep, rec } = M;
const SUBS = { office: ["tab='b'", "tab='l'", "tab='d'", "tab='h'", "tab='i'", "tab='x'", "tab='s'"], prod: ["prodTab='today'", "prodTab='req'", "prodTab='deliv'", "prodTab='lists'", "prodTab='snags'"], pm: ["pmTab=''", "pmTab='snags'", "pmTab='projects'", "pmTab='seq'", "pmTab='ship'"] };
const mkRow = v1 => { const r = v1 ? X.v1Row() : X.v2Row();
  Object.assign(r.orders.find(o => o.wo === 'WO-3'), { delv: true }); Object.assign(r.orders.find(o => o.wo === 'WO-4'), { delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19' });
  Object.assign(r.orders.find(o => o.wo === 'WO-1'), { delv: true, step: '8. PALLETED' }); Object.assign(r.orders.find(o => o.wo === 'WO-2'), { delv: true, step: '8. PALLETED' });
  r.orders.push(H.order({ wo: 'WO-M1', customer: 'Aderrig Homes', floor: '2', unit: '20', title: 'HOUSE 20', dueDate: '2026-10-23', origDueDate: '2026-10-23', delv: true, step: '5. WORK ORDER PROCESSED' }),
    H.order({ wo: 'WO-M0', customer: 'Aderrig Homes', floor: '2', unit: '21', title: 'HOUSE 21', dueDate: '2026-10-21', origDueDate: '2026-10-21', delv: true, step: '5. WORK ORDER PROCESSED' }));
  return r; };
const seed = S => { X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] }); ['WO-3', 'WO-4', 'WO-1', 'WO-2'].forEach((w, i) => X.seqRow(S, 'Q' + i, 'P1', { wo: w })); X.seqRow(S, 'QW', 'P1', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE TYPE E', req_date: '2026-11-30' }); };
(async () => {
  const browser = await H.chromium.launch();
  try {
    // ---------- 1. every role × every sub-tab, four database states ----------
    const CFG = [['lists ON, all SQL run', false, {}], ['lists ON, PM sequence SQL NOT run', false, { seq: 1 }], ['lists ON, sequence + Project details SQL NOT run', false, { seq: 1, spec: 1 }], ['lists OFF', true, {}]];
    for (const [name, v1, miss] of CFG) {
      const S = X.makeServer(mkRow(v1)); if (!v1 && !miss.seq) seed(S); if (miss.seq) S.noSeqTables = true; if (miss.spec) S.noSpecTables = true;
      const t = await X.dev(browser, S, 'office', { me: { pm: 'John Burke' } }), p = t.page; const bag = []; M.watch(p, bag); await M.asks(p);
      const st = await p.evaluate(() => ({ v2: V2(), seq: seqVis(), spec: specVis() }));
      rec('[' + name + '] switches read right (lists ' + (v1 ? 'off' : 'on') + ', sequence ' + (!v1 && !miss.seq ? 'on' : 'off') + ', project details ' + (!v1 && !miss.spec ? 'on' : 'off') + ')', st.v2 === !v1 && st.seq === (!v1 && !miss.seq) && st.spec === (!v1 && !miss.spec), JSON.stringify(st));
      for (const role of M.ROLES) {
        const before = bag.length; const seen = [];
        for (const set of (SUBS[role] || [''])) {
          await M.go(p, role, set, 350);
          const r = await p.evaluate(() => { const a = document.getElementById('app'); const vis = e => !!(e.offsetParent || e.getClientRects().length);
            return { len: a.innerText.trim().length, pin: !!document.querySelector('.pod-ovl #rpin-role,.pod-ovl [data-role]'), gate: [...document.querySelectorAll('.seq-gate,[data-seqopen],[data-seqpick],[data-prodtab="req"]')].filter(vis).length,
              pmseq: [...document.querySelectorAll('#pm-strip button')].filter(b => /Sequence|Shipped/.test(b.textContent)).length, spec: [...document.querySelectorAll('#lh-spec,.spec-chip,[data-specopen]')].filter(vis).length, undef: /undefined|\[object Object\]|NaN/.test(a.innerText) ? (a.innerText.match(/.{0,40}(undefined|\[object Object\]|NaN).{0,30}/) || [''])[0] : '' }; });
          seen.push(Object.assign({ set }, r));
        }
        const errs = bag.slice(before);
        rec('[' + name + '] ' + role + ': every screen draws, no JavaScript error', !errs.length && seen.every(s => s.len > 20 && !s.pin), JSON.stringify(errs.length ? errs : seen.filter(s => s.len <= 20 || s.pin)).slice(0, 400));
        const bad = seen.filter(s => s.undef);
        rec('[' + name + '] ' + role + ': no "undefined" / "NaN" / "[object Object]" printed on a screen', !bad.length, JSON.stringify(bad.map(b => b.set + ': ' + b.undef)).slice(0, 300));
        if (v1 || miss.seq) rec('[' + name + '] ' + role + ': no 🔢 Sequence / ✋ Requests / 📦 Shipped button showing', seen.every(s => s.gate === 0 && s.pmseq === 0), JSON.stringify(seen.filter(s => s.gate || s.pmseq)));
        if (v1 || miss.spec) rec('[' + name + '] ' + role + ': no Project details button / spec chip showing', seen.every(s => s.spec === 0), JSON.stringify(seen.filter(s => s.spec)));
      }
      if (!v1 && !miss.seq) { // Job B on: the 🔢 Sequence button on Deliveries / driver / stores opens the pick → the sequence, look-only where it should be
        for (const [role, set, canEdit] of [['office', "tab='d'", true], ['prod', "prodTab='deliv'", true], ['driver', '', false], ['stores', '', false]]) {
          const b0 = bag.length; await M.go(p, role, set, 400);
          const r = await p.evaluate(async () => { const vis = e => !!(e.offsetParent || e.getClientRects().length); const b = [...document.querySelectorAll('[data-seqpick]')].filter(vis)[0]; if (!b) return { err: 'no 🔢 button' }; b.click(); await new Promise(r => setTimeout(r, 250));
            const pk = document.querySelector('.pod-ovl [data-pp="P1"]'); if (!pk) return { err: 'no project picker: ' + [...document.querySelectorAll('.pod-ovl')].map(o => o.innerText.slice(0, 60)).join('/') }; pk.click(); await new Promise(r => setTimeout(r, 700));
            const o = document.querySelector('.seq-ovl') || document.getElementById('seq-pg'); return { open: !!o, rows: o ? o.querySelectorAll('tr[data-seqr]').length : 0, drag: o ? o.querySelectorAll('[data-sequp],[data-seqdate]').length : 0, mats: o ? o.querySelectorAll('[data-matsopen]').length : 0 }; });
          rec('[Job B on] ' + role + ': 🔢 Sequence → pick Aderrig → the table opens with 5 rows, ' + (canEdit ? 'with the move / date tools' : 'look-only (no move / date / Materials buttons)'), !r.err && r.open && r.rows === 5 && (canEdit ? r.drag > 0 : r.drag === 0 && r.mats === 0) && bag.length === b0, JSON.stringify([r, bag.slice(b0)]));
          await M.closeAll(p);
        }
      }
      rec('[' + name + '] nothing tried to DELETE and no error was thrown in the page', !(S.deniedS || 0) && !(S.errors || []).length, JSON.stringify([S.deniedS || 0, S.errors || []]).slice(0, 300));
      await t.close();
    }

    // ---------- 2. Deliveries with Job B on: office and Production Manager ----------
    for (const role of ['office', 'prod']) {
      const S = X.makeServer(mkRow(false)); seed(S); X.F3.seedList(S, 'LM2', { wos: ['WO-2'], name: 'House 14' });
      const t = await X.dev(browser, S, role), p = t.page; const bag = []; M.watch(p, bag); await M.asks(p);
      await p.evaluate(() => sessionStorage.setItem('wpfWho', 'Mary'));
      await M.go(p, role, role === 'prod' ? "prodTab='deliv';delTab='0'" : "tab='d';delTab='0'", 700);
      const pool = await p.evaluate(() => [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw));
      rec(role + ': pool this week, inside the customer, earliest due first (WO-M0 21 Oct, WO-1/WO-2 22 Oct, WO-M1 23 Oct)', pool.join() === 'WO-M0,WO-1,WO-2,WO-M1', pool.join());
      const bdg = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.dchip')].map(c => [c.dataset.dw, (c.querySelector('.dl-st') || {}).innerText || ''])));
      rec(role + ': badges — WO-1 and WO-2 "LIST ADDED", WO-M1 "NO LIST YET" with ＋ List + No list needed', /LIST ADDED/.test(bdg['WO-1']) && /LIST ADDED/.test(bdg['WO-2']) && /NO LIST YET/.test(bdg['WO-M1']) && await p.evaluate(() => !!document.querySelector('.dchip[data-dw="WO-M1"] [data-dladd]') && !!document.querySelector('.dchip[data-dw="WO-M1"] [data-dlna]')), JSON.stringify(bdg));
      // tick two and book
      await p.click('.dchip[data-dw="WO-1"] .dtick'); await p.click('.dchip[data-dw="WO-M1"] .dtick'); await sleep(200);
      const bar = await p.evaluate(() => { const b = document.getElementById('del-selbar'); if (!b) return null; const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return { pos: cs.position, bottomGap: Math.round(innerHeight - r.bottom), txt: b.innerText.replace(/\s+/g, ' '), strip: (() => { const s = document.getElementById('prod-strip') || document.querySelector('.tabs'); if (!s) return null; const q = s.getBoundingClientRect(); return !(q.bottom > r.top && q.top < r.bottom); })() }; });
      rec(role + ': ticking two cards → the booking bar is fixed at the bottom ("2 selected … 🚚 Book 2"), not over the tab strip', !!bar && bar.pos === 'fixed' && bar.bottomGap >= 0 && bar.bottomGap < 40 && /2 selected/.test(bar.txt) && /Book 2/.test(bar.txt) && bar.strip !== false, JSON.stringify(bar));
      await p.selectOption('#selveh', 'VOLVO'); await p.selectOption('#selday', 'Fri'); await p.click('#selbook'); await sleep(500);
      const bk = await p.evaluate(() => ['WO-1', 'WO-M1'].map(w => { const o = DB.orders.find(x => x.wo === w); return [o.delVeh, o.delDay, o.delWk, o.delPlacedBy].join('|'); }).concat(delSel.size, [...window.__asked].join(' / ').slice(0, 200)));
      rec(role + ': 🚚 Book 2 → both on Volvo Fri 23 Oct with the name, ticks cleared', bk[0] === 'VOLVO|Fri|2026-10-19|Mary' && bk[1] === 'VOLVO|Fri|2026-10-19|Mary' && bk[2] === 0, JSON.stringify(bk));
      // the sequence shows "on a van" for WO-1 at once
      await p.evaluate(() => seqOpen('P1')); await sleep(500);
      const pg = await p.evaluate(() => { const tr = [...document.querySelectorAll('.seq-ovl tr[data-seqr]')].find(x => /WO-1\b/.test(x.innerText)); return tr ? tr.querySelector('td[data-l="Progress"]').innerText.replace(/\s+/g, ' ') : ''; });
      rec(role + ': the sequence table shows WO-1 "on a van ✓" straight after the booking', /on a van ✓/.test(pg), pg);
      await M.closeAll(p);
      // list badge buttons
      await p.click('.dchip[data-dw="WO-M0"] [data-dlna]'); await sleep(400);
      let o = await M.job(p, 'WO-M0');
      rec(role + ': "No list needed" on WO-M0 → marked with the name', !!o.listNA && o.listNA.by === 'Mary' && /NO LIST NEEDED/.test(await p.evaluate(() => document.querySelector('.dchip[data-dw="WO-M0"] .dl-st').innerText)), JSON.stringify(o.listNA));
      await p.click('.dchip[data-dw="WO-M0"] [data-dlnaundo]'); await sleep(400);
      rec(role + ': undo → needs a list again', !(await M.job(p, 'WO-M0')).listNA);
      await p.click('.dchip[data-dw="WO-2"] [data-dlopen]'); await sleep(1400);
      const w1 = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), wo: (document.getElementById('me-hwo') || {}).textContent || '' }));
      rec(role + ': tap "LIST ADDED" on WO-2 → its list window opens', w1.ed && /WO-2/.test(w1.wo), JSON.stringify(w1));
      await M.closeAll(p); await M.go(p, role, role === 'prod' ? "prodTab='deliv';delTab='0'" : "tab='d';delTab='0'", 500);
      await p.click('.dchip[data-dw="WO-M0"] [data-dladd]'); await sleep(1300);
      const w2 = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), wo: (document.getElementById('me-hwo') || {}).textContent || '', ro: ['me-fl', 'me-un', 'me-ti', 'me-cu', 'me-floor', 'me-unit', 'me-title', 'me-cust'].filter(id => { const e = document.getElementById(id); return e && /INPUT|TEXTAREA/.test(e.tagName) && !e.readOnly && !e.disabled && !e.closest('[hidden]'); }) }));
      rec(role + ': ＋ List on WO-M0 → a new list window on WO-M0', w2.ed && /WO-M0/.test(w2.wo), JSON.stringify(w2));
      await M.closeAll(p);
      rec(role + ': no JavaScript errors on Deliveries', !bag.length && !(S.errors || []).length, JSON.stringify(bag.concat(S.errors || [])).slice(0, 400));
      await t.close();
    }
    // ---------- 3. Garry 25 Nov (4A): PMs see shipped jobs, cannot send them back; the office can ----------
    { const S = X.makeServer(mkRow(false)); seed(S); X.seqRow(S, 'Q5', 'P1', { wo: 'WO-5' });
      const t = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), p = t.page; const bag = []; M.watch(p, bag);
      await M.go(p, 'pm', "pmTab='ship'", 600);
      const pmS = await p.evaluate(() => ({ has: /WO-5/.test(document.getElementById('app').innerText), back: document.querySelectorAll('#app [data-shb], #app [data-shd]').length }));
      rec('PM → 📦 Shipped: WO-5 is listed, with NO "Bring back to board" / "Back to Deliveries" button', pmS.has && pmS.back === 0, JSON.stringify(pmS));
      const forced = await p.evaluate(async () => { const before = JSON.stringify(DB.orders.find(o => o.wo === 'WO-5')); const b = document.createElement('button'); b.dataset.shb = 'WO-5'; (document.querySelector('#app .exp-panel') || document.getElementById('app')).appendChild(b); b.click(); await new Promise(r => setTimeout(r, 300)); return before === JSON.stringify(DB.orders.find(o => o.wo === 'WO-5')); });
      rec('PM: a forced press changes nothing on the job', forced);
      await M.go(p, 'office', "tab='h'", 600);
      const ofS = await p.evaluate(() => ({ has: /WO-5/.test(document.getElementById('app').innerText), back: document.querySelectorAll('#app [data-shb]').length }));
      rec('office → Shipped tab: WO-5 with "↩ Bring back to board"', ofS.has && ofS.back >= 1, JSON.stringify(ofS));
      rec('shipped tab: no JavaScript errors', !bag.length, JSON.stringify(bag).slice(0, 300));
      await t.close(); }
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  finally { await browser.close(); }
  M.finish();
})();
