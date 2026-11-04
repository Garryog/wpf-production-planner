// Stores dockets D4: the Dockets list on the Stores screen — newest first, filter by project, open, reprint, "Delivered —
// received by", cancel with a reason (kept, marked CANCELLED, items sendable again), "+ New docket" with typed items, in
// both switch positions; 360 px fits. Fake Supabase only. Run: node tests/stores-docket/d4-list.test.js
const X = require('./fixd.js');
const { H } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const openList = async p => { await p.evaluate(() => document.getElementById('dk-list').click()); await X.sleep(500); };
const cards = p => p.evaluate(() => [...document.querySelectorAll('[data-dkcard]')].map(c => ({ id: c.dataset.dkcard, t: c.innerText.replace(/\s+/g, ' ') })));
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  const a = await X.dev(browser, S, 'stores');
  await X.catchPrint(a.page);
  const m1 = await a.page.evaluate(() => dkMake({ project_id: 'P1', site_address: 'Site 4' }, [{ line_id: 'L1:2', qty: '10', wo: 'WO-1', floor: 'GF', unit: '12' }], 'Op'));
  const m2 = await a.page.evaluate(() => dkMake({ project_name: 'Cherrywood', customer: 'Cairn' }, [{ item: 'Spare hinges', qty: '6', wo: 'WO-5' }], 'Op'));
  const m3 = await a.page.evaluate(() => dkMake({ project_id: 'P1' }, [{ line_id: 'L1:2', qty: '10' }], 'Op'));
  rec('three dockets made', m1.ok && m2.ok && m3.ok && X.line(S, 'L1:2').status === 'got-out');
  rec('Stores screen has a "Dockets" button', await a.page.evaluate(() => !!document.getElementById('dk-list')));
  await openList(a.page);
  let c = await cards(a.page);
  rec('newest first: D26-0003, D26-0002, D26-0001', c.map(x => /D26-\d+/.exec(x.t)[0]).join() === 'D26-0003,D26-0002,D26-0001', c.map(x => x.t.slice(0, 40)).join(' | '));
  rec('each says "Sent — not signed back yet"', c.every(x => /not signed back yet/.test(x.t)));
  await a.page.evaluate(() => { const s = document.getElementById('dkl-proj'); s.value = 'Cherrywood'; s.onchange({ target: s }); });
  c = await cards(a.page);
  rec('filter by project: Cherrywood → just D26-0002', c.length === 1 && /D26-0002/.test(c[0].t));
  await a.page.evaluate(() => { const s = document.getElementById('dkl-proj'); s.value = ''; s.onchange({ target: s }); });
  // open + reprint
  await a.page.evaluate(id => document.querySelector('[data-dkopen="' + id + '"]').click(), m1.id);
  const open1 = await a.page.evaluate(id => document.querySelector('[data-dkcard="' + id + '"]').innerText, m1.id);
  rec('open shows the items (WO-1, GF, 12, Tap, 10) and the site address', /WO-1/.test(open1) && /GF/.test(open1) && /Tap/.test(open1) && /Site 4/.test(open1), open1);
  await a.page.evaluate(id => document.querySelector('[data-dkprint="' + id + '"]').click(), m1.id);
  const pr = await X.printed(a.page);
  rec('reprint opens the docket print page', pr.length === 1 && /D26-0001/.test(pr[0]) && /Received by \(print name\)/.test(pr[0]));
  // delivered
  await a.page.evaluate(id => document.querySelector('[data-dkdel="' + id + '"]').click(), m1.id);
  await a.page.evaluate(id => document.querySelector('[data-dkvok="' + id + '"]').click(), m1.id);
  rec('delivered needs a print name (says so, nothing saved)', /print name/.test(await a.page.evaluate(() => document.getElementById('dkl-msg').textContent)) && S.db.t.stores_dockets[0].status === 'made');
  await a.page.evaluate(id => { document.getElementById('dkv-by').value = 'Joe <b>Site</b>'; document.getElementById('dkv-at').value = '2026-10-22'; document.querySelector('[data-dkvok="' + id + '"]').click(); }, m1.id);
  await X.sleep(500);
  const k1 = S.db.t.stores_dockets.find(d => d.id === m1.id);
  rec('delivered saved: received by, date, marked by Op', k1.status === 'delivered' && k1.received_by === 'Joe <b>Site</b>' && k1.received_at === '2026-10-22' && k1.delivered_by === 'Op', JSON.stringify(k1));
  const t1 = await a.page.evaluate(id => document.querySelector('[data-dkcard="' + id + '"]').innerHTML, m1.id);
  rec('list shows "✓ DELIVERED received by Joe <b>Site</b>" (escaped), no cancel button any more', /DELIVERED/.test(t1) && /Joe &lt;b&gt;Site/.test(t1) && !/data-dkcan/.test(t1));
  // cancel with a reason
  await a.page.evaluate(() => { window.__prompt = ''; });
  await a.page.evaluate(id => document.querySelector('[data-dkcan="' + id + '"]').click(), m3.id);
  rec('cancel without a reason: not cancelled', S.db.t.stores_dockets.find(d => d.id === m3.id).status === 'made');
  await a.page.evaluate(() => { window.__prompt = 'Sent twice by mistake'; });
  await a.page.evaluate(id => document.querySelector('[data-dkcan="' + id + '"]').click(), m3.id);
  await X.sleep(600);
  const k3 = S.db.t.stores_dockets.find(d => d.id === m3.id);
  rec('cancel: kept, CANCELLED with the reason; the taps line back to to-pick (10 free again)', k3.status === 'cancelled' && k3.cancel_why === 'Sent twice by mistake' && X.line(S, 'L1:2').status === 'todo' && S.db.t.stores_dockets.length === 3);
  const t3 = await a.page.evaluate(id => document.querySelector('[data-dkcard="' + id + '"]').innerText, m3.id);
  rec('list shows CANCELLED and the reason', /CANCELLED/.test(t3) && /Sent twice by mistake/.test(t3));
  rec('nothing deleted, no direct writes to the docket tables', !S.deniedD && !S.log.some(x => /^(POST|PATCH|DELETE) \/stores_/.test(x)));
  await a.page.screenshot({ path: '/dev/null' }).catch(() => {});
  // "+ New docket" opens Send to site
  await a.page.evaluate(() => document.getElementById('dkl-new').click()); await X.sleep(300);
  rec('"+ New docket" opens Send to site', await a.page.evaluate(() => !!document.getElementById('dk-send-dlg') && !document.getElementById('dk-list-dlg')));
  // 360 px
  const n = await X.dev(browser, S, 'stores', { viewport: { width: 360, height: 760 } });
  await openList(n.page);
  await n.page.evaluate(id => document.querySelector('[data-dkopen="' + id + '"]').click(), m1.id);
  const w = await n.page.evaluate(() => { const d = document.querySelector('#dk-list-dlg .pod-in'); return { doc: document.documentElement.scrollWidth, dlg: d.scrollWidth, dlgc: d.clientWidth }; });
  rec('360 px: the Dockets list fits (no sideways scroll)', w.doc <= 360 && w.dlg <= w.dlgc + 1, JSON.stringify(w));
  // switch OFF: the list works (typed dockets)
  const S1 = X.makeServer(X.v1Row());
  const o = await X.dev(browser, S1, 'stores');
  await o.page.evaluate(() => dkMake({ project_name: 'Aderrig Homes' }, [{ item: 'Taps', qty: '20' }], 'Op'));
  await openList(o.page);
  rec('switch OFF: Dockets list shows the typed docket', (await cards(o.page)).length === 1);
  // SQL not run: a plain message
  const S2 = X.makeServer(X.v1Row()); S2.noDocketTables = true;
  const q = await X.dev(browser, S2, 'stores');
  await openList(q.page);
  rec('docket SQL not run yet: the list says so in plain English', /aren't set up/.test(await q.page.evaluate(() => document.getElementById('dkl-msg').textContent)));
  rec('no page errors', !(S.errors || []).length && !(S1.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S1.errors, S2.errors]));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
