// Garry 4 Nov (fix 7): docket cancel asks "Did these items leave stores?" (Yes = only the docket is voided, the items stay
// got out and still count as sent, "Items sent" still lists them; No = back to to-pick); dockets are for FITTINGS (Send to
// site offers stores + bought-in lines only, never saw lines; the wording says fittings); the Send to site / Dockets / Items
// sent buttons are hidden quietly when the docket tables don't exist yet (one cached probe).
// Fake Supabase only. Run: node tests/stores-docket/coder-fix7.test.js
const X = require('./fixd.js');
const { H } = X;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
(async () => {
  const browser = await H.chromium.launch();
  // ---- cancel: Yes, they left
  {
    const S = X.makeServer(); const a = await X.dev(browser, S, 'stores');
    const m1 = await a.page.evaluate(() => dkMake({ project_id: 'P1' }, [{ line_id: 'L1:2', qty: '20', wo: 'WO-1' }], 'Op'));
    const m2 = await a.page.evaluate(() => dkMake({ project_id: 'P1' }, [{ line_id: 'L1:3', qty: '3', wo: 'WO-1' }], 'Op'));
    rec('set-up: taps (20 of 20) got out; hinges 3 of 8 sent', m1.ok && m2.ok && X.line(S, 'L1:2').status === 'got-out' && X.line(S, 'L1:3').status === 'todo');
    rec('dkCancel without the answer is refused in the app (nothing sent)', await a.page.evaluate(id => dkCancel(id, 'x', 'Op').then(() => false, e => /left stores/.test(e.message)), m1.id) && S.db.t.stores_dockets[0].status === 'made');
    await a.page.evaluate(() => document.getElementById('dk-list').click()); await X.sleep(500);
    await a.page.evaluate(id => { window.__prompt = 'Wrong docket book'; document.querySelector('[data-dkcan="' + id + '"]').click(); }, m1.id);
    rec('the question shows', await a.page.evaluate(() => /Did these items leave stores\?/.test((document.getElementById('dk-left') || {}).innerText || '')));
    await a.page.evaluate(() => document.querySelector('#dk-left [data-dkleft="1"]').click()); await X.sleep(700);
    const k1 = S.db.t.stores_dockets.find(d => d.id === m1.id);
    rec('Yes: docket CANCELLED (cancel_left), the taps stay got out', k1.status === 'cancelled' && k1.cancel_left === true && X.line(S, 'L1:2').status === 'got-out', JSON.stringify(k1));
    rec('Yes: the items still count as sent (the taps can\'t be sent again)', S.db.t.stores_docket_items.filter(i => i.docket_id === m1.id).every(i => i.active));
    const t1 = await a.page.evaluate(id => document.querySelector('[data-dkcard="' + id + '"]').innerText, m1.id);
    rec('Dockets list: CANCELLED · reason · "items left stores"', /CANCELLED/.test(t1) && /Wrong docket book/.test(t1) && /items left stores/.test(t1), t1);
    // No on the partial hinges docket: 3 free again
    await a.page.evaluate(id => { window.__prompt = 'Not sent'; document.querySelector('[data-dkcan="' + id + '"]').click(); document.querySelector('#dk-left [data-dkleft="0"]').click(); }, m2.id); await X.sleep(700);
    const k2 = S.db.t.stores_dockets.find(d => d.id === m2.id);
    rec('No: CANCELLED (cancel_left false), the 3 hinges free again (0 of 8 sent)', k2.status === 'cancelled' && k2.cancel_left === false && (await a.page.evaluate(() => dkSentFor(['L1:3']))).L1 === undefined && S.db.t.stores_docket_items.filter(i => i.docket_id === m2.id).every(i => !i.active));
    // Items sent report: the Yes docket's taps are still listed
    const rows = await a.page.evaluate(async () => (await dkReportRows({ id: 'P1', name: 'Aderrig', customer: 'Aderrig Homes' }, '2026-01-01', '2026-12-31')).map(r => r.docket + '|' + r.item + '|' + r.deliv));
    rec('Items sent: the taps from the cancelled-but-left docket are listed ("docket cancelled (items left stores)"); the No docket is not', rows.some(r => /^D26-0001\|Tap\|No — docket D26-0001 cancelled \(items left stores\)/.test(r)) && !rows.some(r => /^D26-0002/.test(r)), JSON.stringify(rows));
    rec('no page errors (cancel)', !(S.errors || []).length, (S.errors || []).join(' | '));
    // ---- fittings only
    await a.page.evaluate(async () => { [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()); render(); });
    const bar = await a.page.evaluate(() => document.querySelector('.dk-bar').innerText.replace(/\s+/g, ' ').trim());
    rec('Stores bar: "🚚 Send fittings to site · 📄 Dockets · 📦 Items sent" (tables there → shown)', bar === '🚚 Send fittings to site 📄 Dockets 📦 Items sent', bar);
    await a.page.evaluate(() => document.getElementById('dk-send').click()); await X.sleep(300);
    await a.page.evaluate(() => { const s = document.querySelector('#dk-send-dlg select'); s.value = 'P1'; s.dispatchEvent(new Event('change')); if (s.onchange) s.onchange({ target: s }); }); await X.sleep(600);
    const sd = await a.page.evaluate(() => { const d = document.getElementById('dk-send-dlg'); return { t: d.innerText, h: d.innerHTML }; });
    rec('Send to site says dockets are for fittings (stores and bought-in items)', /Dockets are for fittings/i.test(sd.t) && /Fittings not yet got out/.test(sd.t), sd.t.slice(0, 400));
    rec('Send to site offers fittings and bought-in lines only — never the saw line (Side)', /Hinge/.test(sd.t) && /Worktop/.test(sd.t) && !/\bSide\b/.test(sd.t), sd.t.slice(0, 600));
    await a.close();
  }
  // ---- buttons hidden quietly when the docket tables don't exist
  {
    const S = X.makeServer(); S.noDocketTables = true;
    const a = await X.dev(browser, S, 'stores'); await X.sleep(400);
    const v = await a.page.evaluate(() => ({ ids: ['dk-send', 'dk-list', 'dk-rep'].map(id => { const b = document.getElementById(id); return b ? b.hidden && b.offsetParent === null : 'missing'; }), msg: document.body.innerText }));
    rec('tables missing: Send to site / Dockets / Items sent are hidden, no technical message on the screen', v.ids.every(x => x === true) && !/aren't set up|SUPABASE_CHANGES/.test(v.msg), JSON.stringify(v.ids));
    const n0 = S.log.filter(x => /^GET \/stores_dockets/.test(x)).length;
    await a.page.evaluate(async () => { for (let i = 0; i < 4; i++) { render(); await new Promise(r => setTimeout(r, 50)); } }); await X.sleep(300);
    const n1 = S.log.filter(x => /^GET \/stores_dockets/.test(x)).length;
    rec('one cached probe: re-drawing the screen asks the database no more', n0 === 1 && n1 === 1, n0 + ' / ' + n1);
    await a.page.evaluate(async () => { localStorage.setItem('wpfPin_prod', '9000'); setRole('prod'); render(); await new Promise(r => setTimeout(r, 100)); });
    rec('tables missing: the Production "Items sent" button is hidden too', await a.page.evaluate(() => { const b = document.getElementById('prod-sent'); return !b || b.hidden; }));
    await a.close();
    // tables there: a fresh page shows them after its probe
    const S2 = X.makeServer(); const b = await X.dev(browser, S2, 'stores'); await X.sleep(400);
    rec('tables there: the buttons show', await b.page.evaluate(() => ['dk-send', 'dk-list', 'dk-rep'].every(id => !document.getElementById(id).hidden)));
    await b.close();
  }
  await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
