// Tester attack 8 (11 Nov 2026), part A — re-attack on the Job A → Job B merge (de0d4dc) on feature/project-details-v2 (f4a7719).
//  A1  the four attack5 edits (tests/dates/attack5-carryover B1/B2/B8/B9 now compare with 404262a, not ea990d4): every role's screen
//      text is grabbed on HEAD, 404262a (Job B just before the merge), ba6ecd8 (Job A as merged) and ea990d4 (Job A before the
//      carry-over), lists OFF / lists ON with the sequence tables / lists ON with the sequence SQL not run. Confirms:
//      - lists OFF: this branch = Job A exactly (ba6ecd8), every role — so the old ea990d4 check is not lost when the switch is off;
//      - lists ON: non-Production-Manager roles = 404262a (what B8 now checks), with AND without the sequence tables;
//      - Production Manager, lists ON = 404262a + only the 🚚 Deliveries button (B9), with and without the tables;
//      - what differs from ea990d4 with lists ON is Job B's screens only (listed, information).
//  A2  Job A's Deliveries on this branch, for the Production Manager and the office, in three set-ups (lists OFF; lists ON + sequence
//      tables; lists ON, sequence SQL not run): 🚚 Deliveries button, week tabs, quick due-date edit on a pool card, Move ticked to
//      week…, a van booking comes off when the date moves, a cut job keeps its planned week.
//  A3  attack5 F2 on this branch: a stale screen repeating the same move → recorded once, both PCs agree (the three set-ups).
// Fake Supabase only (tests/seq/srvs.js / tests/harness.js). Run: node tests/seq/attack8-merge.test.js   (PARTS=1,2,3)
const X = require('./fixs.js');
const { H, rec, sleep } = X;
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const PARTS = String(process.env.PARTS || '1,2,3').split(',');
const P = n => console.log('\n--- ' + n);
const ROOT = path.resolve(__dirname, '..', '..');
const HELP = `(()=>{window.W=ms=>new Promise(r=>setTimeout(r,ms));
  window.__why=async k=>{const b=document.querySelector('.pod-ovl [data-why="'+(k||'Customer delay')+'"]');const s=b?b.closest('.pod-in').textContent:'';if(b)b.click();await W(120);return s;};
  window.__closeAll=()=>document.querySelectorAll('.pod-ovl').forEach(o=>o.remove());
  window.__g=w=>DB.orders.find(o=>o.wo===w);})()`;

(async () => {
  const browser = await H.chromium.launch();

  // ================================================================================================================ A1
  if (PARTS.includes('1')) {
    P('A1 the attack5 B1/B2/B8/B9 edits: screens on HEAD vs 404262a / ba6ecd8 / ea990d4');
    const NOW = '2026-11-10T10:00:00Z';
    const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-12', origDueDate: '2026-11-12', plannedWeek: '2026-11-09', step: '4. Ready', delv: true, customer: 'ASPECT', title: 'House ' + wo, value: 1000 }, x));
    const show = c => { try { return execSync('git show ' + c + ':index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (e) { return ''; } };
    const HTML = { HEAD: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), '404262a': show('404262a'), ba6ecd8: show('ba6ecd8'), ea990d4: show('ea990d4') };
    const XL = fs.readFileSync(path.join(ROOT, 'xlsx.full.min.js'), 'utf8');
    const roles = ['pm', 'dash', 'design', 'saw', 'stores', 'driver', 'floor', 'office', 'prod'];
    const grab = async (html, settings, noSeq) => {
      const row = { id: 'main', nid: 9, settings, orders: [O('WO-R1'), O('WO-R2', { step: '6. CUT' }), O('WO-R3', { delVeh: 'VOLVO', delDay: 'Wed', delWk: '2026-11-09', step: '8. PALLETED' })] };
      const t = await H.open({ browser, now: NOW, row, viewport: { width: 1366, height: 900 } });
      await t.page.unroute('**/*');
      await t.page.route('**/*', route => { const u = route.request().url(), m = route.request().method();
        if (u.startsWith('https://wpf.test/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
        if (u.includes('xlsx.full.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: XL });
        if (u.includes('supabase.co')) {
          if (noSeq && /rest\/v1\/(project_seq|seq_requests|seq_pre|rpc\/seq_)/.test(u)) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation does not exist' }) });
          if (m === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('id=eq.main') ? [row] : []) });
          return route.fulfill({ status: 204, body: '' }); }
        return route.fulfill({ status: 404, body: '' }); });
      await t.page.reload(); await t.page.waitForFunction(() => typeof analyzeImport === 'function'); await t.page.waitForTimeout(500);
      const out = await t.page.evaluate(async roles => { const W = ms => new Promise(r => setTimeout(r, ms)); const o = {};
        for (const r of roles) { ls.set('wpfPin_' + r, pins()[r]); ROLE = r; if (typeof prodTab !== 'undefined') prodTab = 'today'; render(); await W(150); o[r] = document.getElementById('app').innerText.replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'hh:mm').replace(/📦 Items sent/g, '').replace(/\s+/g, ' ')
          // intended after this test's baselines (11 Nov, S1 / S2): the board step drop-down gains JOB SHIPPED / INSTALLED / COMPLETED after
          // PALLETED, and the PM view gains a 📦 Shipped tab after 🔢 Sequence — exactly those two are ignored, nothing else
          .replace(/PALLETED JOB SHIPPED INSTALLED COMPLETED /g, 'PALLETED ').replace(/🔢 Sequence 📦 Shipped/g, '🔢 Sequence').trim(); }
        ROLE = 'office'; render(); return o; }, roles);
      await t.close(); return out;
    };
    const diffs = (a, b, skip) => roles.filter(r => !(skip || []).includes(r) && a[r] !== b[r]);
    const show2 = (a, b, rs) => rs.map(r => { let i = 0; while (i < a[r].length && a[r][i] === b[r][i]) i++; return r + ' @' + i + ': A "' + a[r].slice(Math.max(0, i - 30), i + 90) + '" B "' + b[r].slice(Math.max(0, i - 30), i + 90) + '"'; }).join(' || ');
    if (!HTML['404262a'] || !HTML.ba6ecd8 || !HTML.ea990d4) rec('A1 could read 404262a / ba6ecd8 / ea990d4 from git', false);
    else {
      const OFF = {}, ON = { listStore: 'v2', listStoreAt: '2026-10-20T08:00:00Z' };
      const off = { head: await grab(HTML.HEAD, OFF), jobA: await grab(HTML.ba6ecd8, OFF), pre: await grab(HTML['404262a'], OFF) };
      const d1 = diffs(off.head, off.jobA);
      rec('A1a lists OFF: every role (incl. office and Production Manager) on this branch = Job A as merged (ba6ecd8)', !d1.length, show2(off.head, off.jobA, d1));
      const d1b = diffs(off.head, off.pre, ['prod', 'office']);
      rec('A1b lists OFF: non-Production-Manager roles (office apart) = Job B before the merge (404262a) — the merge changed only his screen', !d1b.length, show2(off.head, off.pre, d1b));
      // the office board gained Job A's carry-over "⚠ built after due" chip (94d2396) — intended; nothing else may differ
      const noChip = t => t.replace(/ ⚠ built after due/g, '');
      rec('A1b2 lists OFF: the office screen = 404262a + only Job A\'s "⚠ built after due" chip (carry-over 94d2396)', noChip(off.head.office) === off.pre.office && off.head.office !== off.pre.office, show2({ office: noChip(off.head.office) }, { office: off.pre.office }, ['office']));
      rec('A1c lists OFF: Production Manager = 404262a\'s Today + only "🧭 Today 🚚 Deliveries" on top (attack5 B9 lists OFF, now vs 404262a)', off.head.prod === '🧭 Today 🚚 Deliveries ' + off.pre.prod || off.head.prod.replace(/^🧭 Today 🚚 Deliveries /, '') === off.pre.prod, 'OLD "' + off.pre.prod.slice(0, 120) + '" NEW "' + off.head.prod.slice(0, 120) + '"');
      for (const noSeq of [false, true]) {
        const tag = noSeq ? ' [lists ON, sequence SQL not run]' : ' [lists ON + sequence tables]';
        const on = { head: await grab(HTML.HEAD, ON, noSeq), pre: await grab(HTML['404262a'], ON, noSeq), old: await grab(HTML.ea990d4, ON, noSeq) };
        const d2 = diffs(on.head, on.pre, ['prod', 'office']);
        rec('A1d' + tag + ' every role except the Production Manager = 404262a (attack5 B8 as edited)', !d2.length, show2(on.head, on.pre, d2));
        rec('A1d2' + tag + ' office screen = 404262a + only the "⚠ built after due" chip', on.head.office.replace(/ ⚠ built after due/g, '') === on.pre.office, show2({ office: on.head.office.replace(/ ⚠ built after due/g, '') }, { office: on.pre.office }, ['office']));
        const strip = on.head.prod.replace(/^(🧭 Today (?:✋ Requests \(\d+\) )?)🚚 Deliveries (?=📋 Lists)/u, '$1');
        rec('A1e' + tag + ' Production Manager = 404262a + only the 🚚 Deliveries button, placed after ' + (noSeq ? '🧭 Today' : '✋ Requests') + ' (attack5 B9 as edited)', strip === on.pre.prod && strip !== on.head.prod && (noSeq ? !/Requests/.test(on.head.prod) : /^🧭 Today ✋ Requests \(\d+\) 🚚 Deliveries 📋 Lists/u.test(on.head.prod)), 'OLD "' + on.pre.prod.slice(0, 140) + '" NEW "' + on.head.prod.slice(0, 140) + '"');
        const d3 = diffs(on.head, on.old);
        rec('A1f [info]' + tag + ' roles that differ from Job A before the carry-over (ea990d4) — expected: only Job B screens (PM sequence tabs, projects, requests)', true, d3.join(', ') + ' || ' + show2(on.head, on.old, d3.slice(0, 3)).slice(0, 600));
      }
    }
  }

  // ================================================================================================================ A2 / A3
  const SETUPS = [['lists OFF', { off: true }], ['lists ON + sequence tables', {}], ['lists ON, sequence SQL not run', { noSeq: true }]];
  const mk = o => {
    const r = X.v2Row();
    if (o.off) { delete r.settings.listStore; delete r.settings.listStoreAt; }
    const add = (wo, x) => r.orders.push(H.order(Object.assign({ wo, customer: 'Aderrig Homes', floor: 'T40', unit: wo.slice(3), title: 'HOUSE ' + wo, delv: true, plannedWeek: '2026-10-19' }, x)));
    add('WO-P1', { dueDate: '2026-10-23', origDueDate: '2026-10-23' });                                                 // pool card, this week
    add('WO-P2', { dueDate: '2026-10-23', origDueDate: '2026-10-23' });
    add('WO-VN', { dueDate: '2026-10-22', origDueDate: '2026-10-22', delVeh: 'IVECO', delDay: 'Thu', delWk: '2026-10-19' }); // on a van
    add('WO-CT', { dueDate: '2026-10-23', origDueDate: '2026-10-23', step: '6. CUT' });                                 // cut
    add('WO-ST', { dueDate: '2026-10-23', origDueDate: '2026-10-23' });                                                 // for F2
    const S = X.makeServer(r, { noSeq: o.noSeq });
    if (!o.noSeq) { X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] }); X.seqRow(S, 'QP', 'P1', { wo: 'WO-P1', floor: 'T40', unit: 'P1' }); }
    return S;
  };
  const dev = async (S, role, who) => { const t = await X.dev(browser, S, role, { viewport: { width: 1366, height: 1000 } }); await t.page.evaluate(n => sessionStorage.setItem('wpfWho', n), who); await t.page.evaluate(HELP); return t; };
  const job = (S, wo) => S.row.orders.find(o => o.wo === wo);
  const qd = (p, wo, d) => p.evaluate(async ({ wo, d }) => { const i = document.querySelector('.dq-in[data-dq="' + wo + '"][data-f="due"]'); if (!i) return 'no quick date on ' + wo; i.value = d; i.dispatchEvent(new Event('change')); await W(150); await __why('Customer delay'); __closeAll(); return 'ok'; }, { wo, d });
  const flush = p => p.evaluate(async () => { clearTimeout(saveT); await saveDB(); });

  if (PARTS.includes('2')) {
    for (const [lbl, o] of SETUPS) {
      P('A2 Deliveries on this branch — ' + lbl);
      for (const role of ['prod', 'office']) {
        const S = mk(o), tg = ' [' + lbl + ', ' + (role === 'prod' ? 'Production Manager' : 'office') + ']';
        const t = await dev(S, role, role === 'prod' ? 'Pat Prod' : 'Ann Office'), p = t.page;
        const nav = await p.evaluate(async role => {
          if (role === 'prod') { prodTab = 'today'; render(); await W(150); const b = document.querySelector('#prod-strip [data-prodtab="deliv"]'); if (!b) return { err: 'no 🚚 Deliveries button' }; b.click(); }
          else { showTab('d'); }
          await W(250); delTab = '0'; render(); await W(150);
          const tabs = [...document.querySelectorAll('[data-deltab]')].map(b => b.dataset.deltab);
          return { wkbar: !!document.getElementById('del-wkbar'), tabs, lbl: (document.getElementById('wkb-lbl') || {}).textContent || '', cards: [...document.querySelectorAll('.dchip[data-dw]')].map(c => c.dataset.dw) };
        }, role);
        rec('A2a' + tg + (role === 'prod' ? ' 🚚 Deliveries button opens the full page' : ' Deliveries tab') + ': week bar, week tabs (this week + next weeks), the jobs as cards', !nav.err && nav.wkbar && nav.tabs.length >= 3 && ['WO-P1', 'WO-VN', 'WO-CT'].every(w => nav.cards.includes(w)), JSON.stringify(nav));
        const tabsW = await p.evaluate(async () => { const b = document.querySelector('[data-deltab="1"]'); if (b) b.click(); await W(150); const l1 = (document.getElementById('wkb-lbl') || {}).textContent; const n = document.getElementById('wkb-next'); if (n) n.click(); await W(150); const l2 = (document.getElementById('wkb-lbl') || {}).textContent; delTab = '0'; render(); await W(120); return { l1, l2, back: (document.getElementById('wkb-lbl') || {}).textContent }; });
        rec('A2b' + tg + ' week tabs and Next ▶ change the week shown, and back', /44/.test(tabsW.l1) && /45/.test(tabsW.l2) && /43/.test(tabsW.back), JSON.stringify(tabsW));
        const q1 = await qd(p, 'WO-P1', '2026-10-26');
        const p1 = await p.evaluate(() => { const o = __g('WO-P1'); return { due: o.dueDate, wk: o.plannedWeek, by: ((o.dueHist || []).slice(-1)[0] || {}).by }; });
        // 26 Oct is the bank holiday — the quick date takes it (with Job A's warning) or moves it; either way the history has who
        rec('A2c' + tg + ' quick due-date edit on a pool card: WO-P1 23 Oct → 26/27 Oct, week follows, history by name', q1 === 'ok' && /2026-10-2[67]/.test(p1.due) && p1.wk === '2026-10-26' && p1.by === (role === 'prod' ? 'Pat Prod' : 'Ann Office'), q1 + ' ' + JSON.stringify(p1));
        const mt = await p.evaluate(async () => {
          delTab = '0'; delSel.clear(); delSel.add('WO-P2'); render(); await W(100);
          const b = document.getElementById('selwk'); if (!b) return { err: 'no Move ticked button' };
          b.click(); await W(100); const pk = document.querySelector('#wkpick-dlg [data-wkp="2026-11-09"]'); if (!pk) return { err: 'no Wk 46 in the picker' };
          pk.click(); await W(80); const go = document.getElementById('wkp-go'); if (go) go.click(); await W(100); await __why('Customer delay'); __closeAll();
          const o = __g('WO-P2'); return { due: o.dueDate, wk: o.plannedWeek };
        });
        rec('A2d' + tg + ' Move ticked to week… → Wk 46: WO-P2 due in Wk 46, planned week Wk 46', !mt.err && /2026-11-(09|1[0-3])/.test(mt.due) && mt.wk === '2026-11-09', JSON.stringify(mt));
        const q2 = await qd(p, 'WO-VN', '2026-10-29');
        const v = await p.evaluate(() => { const o = __g('WO-VN'); return { due: o.dueDate, veh: o.delVeh || '', day: o.delDay || '', reb: !!o.delRebook }; });
        rec('A2e' + tg + ' WO-VN on IVECO Thu: due date moved to 29 Oct → taken off the van, marked "rebook"', q2 === 'ok' && v.due === '2026-10-29' && !v.veh && !v.day && v.reb, q2 + ' ' + JSON.stringify(v));
        const q3 = await qd(p, 'WO-CT', '2026-10-30');
        const c = await p.evaluate(() => { const o = __g('WO-CT'); return { due: o.dueDate, wk: o.plannedWeek, mv: !!o.dueMv }; });
        rec('A2f' + tg + ' cut job WO-CT (step 6): due 23 → 30 Oct, planned week KEPT (Wk 43), "check week" mark', q3 === 'ok' && c.due === '2026-10-30' && c.wk === '2026-10-19' && c.mv, q3 + ' ' + JSON.stringify(c));
        await flush(p);
        rec('A2g' + tg + ' all four changes reached the database', job(S, 'WO-P1').dueDate === p1.due && job(S, 'WO-P2').plannedWeek === '2026-11-09' && !job(S, 'WO-VN').delVeh && job(S, 'WO-CT').plannedWeek === '2026-10-19', JSON.stringify(['WO-P1', 'WO-P2', 'WO-VN', 'WO-CT'].map(w => [w, job(S, w).dueDate, job(S, w).plannedWeek, job(S, w).delVeh || ''])));
        if (o.noSeq) {
          const calls = S.log.filter(x => /^\w+ \/(project_seq|seq_requests|seq_pre|rpc\/seq_)/.test(x));
          rec('A2h' + tg + ' sequence SQL not run: no ✋ Requests, nothing written to the missing tables (reads only)', !(await p.evaluate(() => !!document.querySelector('[data-prodtab="req"]'))) && calls.every(x => /^GET /.test(x)), JSON.stringify(calls.slice(0, 8)));
        }
        rec('A2' + tg + ' no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
        await t.close();
      }
    }
  }

  if (PARTS.includes('3')) {
    for (const [lbl, o] of SETUPS) {
      P('A3 attack5 F2 on this branch — ' + lbl);
      const S = mk(o);
      const a = await dev(S, 'prod', 'Pat Prod'), b = await dev(S, 'office', 'Ann Office');
      await a.page.evaluate(async () => { prodTab = 'deliv'; render(); await W(200); delTab = '0'; render(); await W(150); });
      await b.page.evaluate(async () => { showTab('d'); await W(200); delTab = '0'; render(); await W(150); });
      const qb = await qd(b.page, 'WO-ST', '2026-10-30'); await flush(b.page);
      const qa = await qd(a.page, 'WO-ST', '2026-10-30'); await flush(a.page); await sleep(300);
      await a.page.evaluate(async () => { await loadDB(); render(); }); await b.page.evaluate(async () => { await loadDB(); render(); });
      const ga = await a.page.evaluate(() => { const o = __g('WO-ST'); return { due: o.dueDate, h: (o.dueHist || []).filter(h => h.f !== 'deliv').map(h => h.from + '>' + h.to + ' ' + h.by) }; });
      const gb = await b.page.evaluate(() => { const o = __g('WO-ST'); return { due: o.dueDate, h: (o.dueHist || []).filter(h => h.f !== 'deliv').map(h => h.from + '>' + h.to + ' ' + h.by) }; });
      const db = (job(S, 'WO-ST').dueHist || []).filter(h => h.f !== 'deliv').map(h => h.from + '>' + h.to + ' ' + h.by);
      rec('A3 [' + lbl + '] B (office) moved WO-ST 23 → 30 Oct and saved; A (stale Production Manager screen) makes the identical move: recorded ONCE (Ann Office), both PCs and the database agree', qa === 'ok' && qb === 'ok' && ga.due === '2026-10-30' && gb.due === '2026-10-30' && db.length === 1 && /Ann Office/.test(db[0]) && JSON.stringify(ga) === JSON.stringify(gb), JSON.stringify({ qa, qb, ga, gb, db }));
      rec('A3 [' + lbl + '] no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await a.close(); await b.close();
    }
  }

  await browser.close();
  X.finish();
})().catch(e => { console.error(e); process.exit(1); });
