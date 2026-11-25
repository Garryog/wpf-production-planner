// d24 (Garry 24 Nov: "it needs to be much clearer in the deliveries window that there is a list added or there is no need for a
// list"). Every Deliveries job card says in words where its cutting list stands: green "LIST ADDED" (tap opens it), grey
// "NO LIST NEEDED", red "NO LIST YET" (with ＋ List and "No list needed" for the people who make lists). PMs / drivers see the
// status only. Fake Supabase only. Run: node tests/deliveries/d24-list-badge.test.js
const L = require('../list-window/lw.js');
const { X, H, sleep, rec, closeAll, asks } = L;
const ord = (wo, unit, x) => H.order(Object.assign({ wo, customer: 'Kildare Homes', floor: '1', unit, title: 'HOUSE ' + unit, dueDate: '2026-10-23', origDueDate: '2026-10-23', step: '5. WORK ORDER PROCESSED', delv: true }, x || {}));
const badge = (p, wo) => p.evaluate(wo => { const c = document.querySelector('.dchip[data-dw="' + wo + '"]'); if (!c) return null; const b = c.querySelector('.dl-st');
  return { txt: b ? b.innerText.replace(/\s+/g, ' ').trim() : '', cls: b ? b.className : '', add: !!c.querySelector('[data-dladd]'), na: !!c.querySelector('[data-dlna]'), undo: !!c.querySelector('[data-dlnaundo]'), red: /rdy-red/.test(c.className), strip: /lst-ok/.test(c.className), w: b ? b.scrollWidth <= c.clientWidth : true }; }, wo);
(async () => {
  const browser = await H.chromium.launch(); let S;
  try {
    const r = X.v2Row(); r.orders.push(ord('WO-D1', '11'), ord('WO-D2', '12'), ord('WO-D3', '13', { delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19' }), ord('WO-D4', '14', { listNA: { k: 'none', by: 'Mary', at: '2026-10-01T09:00:00Z' } }), ord('WO-<i>5', '15'));
    S = X.makeServer(r);
    L.D.insert(S.db, 'projects', { id: 'PK', name: 'Kildare Homes', customer: 'Kildare Homes', cien_names: ['Kildare Homes'] });
    X.F3.seedList(S, 'LD2', { wos: ['WO-D2'], name: 'House 12' });
    const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
    await p.evaluate(async () => { lsReset(); await lsLoad(); ROLE = 'office'; tab = 'd'; render(); }); await sleep(800);
    let b1 = await badge(p, 'WO-D1'), b2 = await badge(p, 'WO-D2'), b3 = await badge(p, 'WO-D3'), b4 = await badge(p, 'WO-D4');
    rec('no list: red "NO LIST YET" with ＋ List and No list needed', /NO LIST YET/.test(b1.txt) && / no/.test(b1.cls) && b1.add && b1.na && !b1.strip, JSON.stringify(b1));
    rec('booked job with no list: the same red badge', /NO LIST YET/.test(b3.txt) && b3.add && b3.na, JSON.stringify(b3));
    rec('has a list: green "LIST ADDED ✓", no ＋ List', /LIST ADDED/.test(b2.txt) && / ok/.test(b2.cls) && !b2.add && !b2.na && b2.strip, JSON.stringify(b2));
    rec('marked earlier: grey "NO LIST NEEDED" with undo, card not red / NOT READY', /NO LIST NEEDED/.test(b4.txt) && / na/.test(b4.cls) && b4.undo && !b4.add && !b4.red && b4.strip, JSON.stringify(b4));
    rec('the badge fits inside the card', [b1, b2, b3, b4].every(b => b.w));
    const inj = await p.evaluate(() => ({ i: document.querySelectorAll('.dchip i').length, b: !!document.querySelector('.dchip[data-dw="WO-<i>5"] .dl-st') }));
    rec('a WO with < > in it is shown as text', inj.i === 0 && inj.b, JSON.stringify(inj));
    // answer 3A: inside a customer group the pool is in due-date order (earliest first, no date last), WO number breaking ties
    const ordr = await p.evaluate(() => { const keep = DB.orders.slice(); const mk = (wo, d) => Object.assign({}, keep.find(o => o.wo === 'WO-D1'), { wo, dueDate: d, origDueDate: d, customer: 'Zed Homes' });
      const wk = keep.find(o => o.wo === 'WO-D1').dueDate; const plus = n => { const x = new Date(wk + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
      const mon = (() => { const x = new Date(wk + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); })(); const at = n => { const x = new Date(mon + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
      DB.orders.push(mk('WO-Z1', at(4)), mk('WO-Z2', at(1)), mk('WO-Z3', at(3)), mk('WO-Z0', at(3))); render();
      const got = [...document.querySelectorAll('#dpool .dchip')].map(c => c.dataset.dw).filter(w => /^WO-Z/.test(w)); DB.orders = keep; render(); return got; });
    rec('pool: inside a customer the earliest due date comes first, WO number breaking ties', ordr.join() === 'WO-Z2,WO-Z0,WO-Z3,WO-Z1', ordr.join());
    // mark from the card
    await p.evaluate(() => sessionStorage.setItem('wpfWho', 'Mary'));
    await p.click('.dchip[data-dw="WO-D1"] [data-dlna]'); await sleep(500);
    b1 = await badge(p, 'WO-D1');
    const o1 = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D1'); return { na: o.listNA, sel: document.querySelectorAll('.dchip.sel').length, log: JSON.stringify(o.edits || o.log || '') }; });
    rec('"No list needed" on the card → grey badge, who + when stored, card not selected', /NO LIST NEEDED/.test(b1.txt) && o1.na && o1.na.k === 'none' && o1.na.by === 'Mary' && !!o1.na.at && o1.sel === 0, JSON.stringify([b1, o1.na]));
    rec('…and the job is no longer red', !b1.red && b1.strip, JSON.stringify(b1));
    await p.click('.dchip[data-dw="WO-D1"] [data-dlnaundo]'); await sleep(500);
    b1 = await badge(p, 'WO-D1');
    rec('undo → red "NO LIST YET" again, mark gone', /NO LIST YET/.test(b1.txt) && !(await p.evaluate(() => DB.orders.find(x => x.wo === 'WO-D1').listNA)), JSON.stringify(b1));
    // tap the green badge
    await p.click('.dchip[data-dw="WO-D2"] [data-dlopen]'); await sleep(1500);
    const w = await p.evaluate(() => ({ ed: !!document.querySelector('.me-ed'), rows: [...document.querySelectorAll('.me-ed [data-mr$="|item"]')].map(e => e.value).filter(Boolean).length, sel: document.querySelectorAll('.dchip.sel').length }));
    rec('tap "LIST ADDED" → the list window opens with its rows', w.ed && w.rows > 0 && w.sel === 0, JSON.stringify(w));
    await closeAll(p);
    // ＋ List still opens the window
    await p.evaluate(() => { tab = 'd'; render(); }); await sleep(300);
    await p.click('.dchip[data-dw="WO-D3"] [data-dladd]'); await sleep(1200);
    rec('＋ List in the red badge → the cutting list window on WO-D3', await p.evaluate(() => /WO-D3/.test((document.getElementById('me-hwo') || {}).textContent || '')));
    await closeAll(p);
    // the ⓘ check window
    await p.evaluate(() => showReadiness(['WO-D3', 'WO-D4'], 'test', true)); await sleep(300);
    const rd = await p.evaluate(() => { const o = [...document.querySelectorAll('.pod-ovl')].pop(); return { txt: o.innerText, na: !!o.querySelector('[data-dlna="WO-D3"]'), add: !!o.querySelector('[data-rdadd="WO-D3"]'), undo: !!o.querySelector('[data-dlnaundo="WO-D4"]'), add4: !!o.querySelector('[data-rdadd="WO-D4"]') }; });
    rec('ⓘ window: WO-D3 "NO LIST YET" + both buttons; WO-D4 "NO LIST NEEDED" + undo, no ＋ Add', /NO LIST YET/.test(rd.txt) && /NO LIST NEEDED/.test(rd.txt) && rd.na && rd.add && rd.undo && !rd.add4, JSON.stringify(rd));
    await p.click('.pod-ovl [data-dlna="WO-D3"]'); await sleep(500);
    b3 = await badge(p, 'WO-D3');
    rec('ⓘ window "No list needed" → window closes, the card is grey', /NO LIST NEEDED/.test(b3.txt) && (await p.evaluate(() => document.querySelectorAll('.pod-ovl').length)) === 0, JSON.stringify(b3));
    // saved to the (fake) database inside the orders, nothing else
    await sleep(2500);
    rec('saved in the job itself (orders) — no new column', (S.row.orders || []).some(o => o.wo === 'WO-D3' && o.listNA && o.listNA.k === 'none' && o.listNA.by === 'Mary'), Object.keys(S.row).join(','));
    // a list added on another screen meanwhile: "No list needed" does not mark it
    await p.evaluate(() => { tab = 'd'; render(); }); await sleep(300);
    const race = await p.evaluate(() => { const b = document.querySelector('.dchip[data-dw="WO-D1"] [data-dlna]'); lsCache().all.push({ id: 'ZZ', name: 'House 11', wos: ['WO-D1'] }); delete lsCache().woSet; b.click(); return !!DB.orders.find(x => x.wo === 'WO-D1').listNA; }); await sleep(400);
    b1 = await badge(p, 'WO-D1');
    rec('a list arrived meanwhile → not marked "no list needed"; card shows LIST ADDED', !race && /LIST ADDED/.test(b1.txt), JSON.stringify([race, b1]));
    // other roles: status only
    for (const role of ['pm', 'driver', 'prod']) {
      const drawn = await p.evaluate(rl => { localStorage.setItem('wpfPin_' + rl, pins()[rl]); ROLE = rl; tab = 'd'; if (rl === 'prod') prodTab = 'deliv'; render(); return roleOk(rl); }, role); await sleep(500);
      const n = await p.evaluate(() => ({ st: document.querySelectorAll('.dchip .dl-st').length, btn: document.querySelectorAll('.dchip [data-dladd],.dchip [data-dlna],.dchip [data-dlnaundo]').length, cards: document.querySelectorAll('.dchip').length }));
      rec(role + ': ' + (role === 'prod' ? 'badges and buttons' : 'no list buttons'), drawn && (role === 'prod' ? n.st > 0 && n.btn > 0 : n.btn === 0 && (n.cards === 0 || n.st > 0)), JSON.stringify([drawn, n]));
    }
    // phone 360 px
    await p.evaluate(() => { ROLE = 'office'; tab = 'd'; render(); }); await p.setViewportSize({ width: 360, height: 740 }); await sleep(400);
    const ph = await p.evaluate(() => [...document.querySelectorAll('.dchip')].every(c => { const b = c.querySelector('.dl-st'); return !b || b.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1; }));
    rec('phone 360 px: every badge stays inside its card', ph);
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  finally { await browser.close(); if (S && S.close) S.close(); }
  L.finish();
})();
