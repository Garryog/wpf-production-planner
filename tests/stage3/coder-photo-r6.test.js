// Coder (Tester round 6 fixes, 4 Nov): photo-list jobs on the saw / stores follow the typed lists' rules — the date rule
// (due now on TO DO, later behind "Work ahead"), the TO DO count, the Customer filter and the paper "Print today" /
// "Next 3 days"; an honest message when only some photos upload; a new first photo starts uncut.
// Storage is FAKED (never the live bucket). Run: node tests/stage3/coder-photo-r6.test.js
const F = require('./fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const U = 'https://x.supabase.co/storage/v1/object/public/list-photos/';
const ph = (wo, pdf) => [{ url: U + wo + '/1.' + (pdf ? 'pdf' : 'jpg'), at: '2026-10-20T08:00:00Z', by: 'Ann', ...(pdf ? { pdf: true } : {}) }];
function server() {
  const o = (wo, x) => H.order(Object.assign({ wo, step: '6. JOB CUT COMPLETE', title: 'House ' + wo, customer: 'Aderrig Homes', procAt: '2026-10-20', plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [
    o('WO-1', { dueDate: '2026-10-22', origDueDate: '2026-10-22' }),                                                // typed list L1, due now
    o('WO-NOW', { dueDate: '2026-10-22', origDueDate: '2026-10-22', floor: '2', unit: '7B', listPhotos: ph('WO-NOW') }), // due now
    o('WO-OD', { dueDate: '2026-10-19', origDueDate: '2026-10-19', customer: 'Cairn <b>Homes</b>', listPhotos: ph('WO-OD', true) }), // overdue, PDF
    o('WO-23', { dueDate: '2026-10-23', origDueDate: '2026-10-23', listPhotos: ph('WO-23') }),                       // cut by Thu 22 → Next 3 days
    o('WO-FAR', { dueDate: '2026-12-15', origDueDate: '2026-12-15', listPhotos: ph('WO-FAR') }),                     // later
    o('WO-ND', { dueDate: '', origDueDate: '', listPhotos: ph('WO-ND') }),                                           // undated
    o('WO-STALE', { dueDate: '2026-10-22', origDueDate: '2026-10-22', photoDone: { saw: { at: '2026-10-20T10:00:00Z', by: 'Old' } } }),
    o('WO-TWO', { dueDate: '2026-12-15', origDueDate: '2026-12-15' }),
  ];
  const S = F.makeServer(row); F.seedList(S, 'L1', { wos: ['WO-1'] });
  return S;
}
async function fakeStore(page, st) {
  await page.route(/supabase\.co\/storage\/v1\/object\//, route => {
    const r = route.request();
    if (r.method() === 'POST') { st.posts.push(r.url()); if (st.failAfter !== undefined && st.posts.length > st.failAfter) return route.abort('internetdisconnected'); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"x"}' }); }
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
}
const view = p => p.evaluate(() => ({ todo: document.getElementById('wl-tab-todo').innerText, cards: [...document.querySelectorAll('[data-phcard]')].map(c => c.dataset.phcard),
  upc: (document.getElementById('wl-upc') || {}).innerText || '', cust: [...document.querySelectorAll('[data-wlc]')].map(b => b.innerText), od: (document.querySelector('[data-phcard="WO-OD"] .wl-due') || {}).innerText || '' }));
const printed = (p, mode, days) => p.evaluate(({ mode, days }) => { let html = ''; const ow = window.open; window.open = () => ({ document: { write: h => { html += h; }, close() {} } }); printWorkList(mode, days); window.open = ow; return html; }, { mode, days });
(async () => {
  const browser = await H.chromium.launch();
  const S = server(), st = { posts: [] };
  for (const role of ['saw', 'stores']) {
    const t = await F.dev(browser, S, role); await fakeStore(t.page, st);
    await t.page.evaluate(async () => { await loadDB(); wlShowUpcoming = false; wlCust = ''; render(); });
    let v = await view(t.page);
    const n = 3; // typed list L1 (it has saw and fittings lines) + WO-NOW + WO-OD
    rec(role + ': TO DO shows only the photo jobs due now (WO-NOW, WO-OD overdue)', v.cards.sort().join() === 'WO-NOW,WO-OD', v.cards.join());
    rec(role + ': "TO DO — ' + n + ' today (1 overdue)" counts them', new RegExp('TO DO — ' + n + ' today').test(v.todo) && /1 overdue/.test(v.todo), v.todo);
    rec(role + ': an overdue photo card says OVERDUE', /OVERDUE/.test(v.od), v.od);
    rec(role + ': "Work ahead" offers the later / undated photo jobs (3 of them)', /show 3 list/.test(v.upc), v.upc);
    await t.page.evaluate(() => document.getElementById('wl-upc').click());
    v = await view(t.page);
    rec(role + ': Work ahead shows WO-23, WO-FAR, WO-ND too', ['WO-23', 'WO-FAR', 'WO-ND'].every(w => v.cards.includes(w)), v.cards.join());
    rec(role + ': Customer filter lists the photo jobs\' customers with counts', v.cust.some(c => /Cairn <b>Homes<\/b> · 1/.test(c)), v.cust.join(' | '));
    await t.page.evaluate(() => document.querySelector('[data-wlc="Cairn <b>Homes</b>"]').click());
    v = await view(t.page);
    rec(role + ': choosing a customer shows only that customer\'s photo jobs', v.cards.join() === 'WO-OD', v.cards.join());
    await t.page.evaluate(() => { wlCust = ''; wlShowUpcoming = false; render(); });
    // paper
    const h1 = await printed(t.page, role === 'saw' ? 'saw' : 'fit', 1), h3 = await printed(t.page, role === 'saw' ? 'saw' : 'fit', 3);
    rec(role + ': Print today has WO-NOW and WO-OD, not WO-23 / WO-FAR', /WO-NOW/.test(h1) && /WO-OD/.test(h1) && !/WO-23/.test(h1) && !/WO-FAR/.test(h1), '');
    rec(role + ': the photo prints as an image with WO / Floor / Unit / title', /<img src="https:\/\/x\.supabase\.co[^"]*WO-NOW\/1\.jpg"/.test(h1) && /Floor <b>2<\/b>/.test(h1) && /Unit <b>7B<\/b>/.test(h1) && /House WO-NOW/.test(h1), '');
    rec(role + ': a PDF list prints its link (not an image) and the customer is escaped', /PDF list 1[^<]*WO-OD\/1\.pdf/.test(h1) && !/<img[^>]*WO-OD/.test(h1) && !/Cairn <b>/.test(h1) && /Cairn &lt;b>Homes/.test(h1), (h1.match(/.{0,120}WO-OD.{0,200}/g) || []).join(' ### '));
    rec(role + ': Next 3 days adds WO-23', /WO-23/.test(h3) && !/WO-FAR/.test(h3), '');
    await t.close();
  }
  // nothing typed, only a photo job due: Print today still prints (no "Nothing to print")
  {
    const S2 = server(); S2.row.orders = S2.row.orders.filter(o => o.wo === 'WO-NOW');
    const t = await F.dev(browser, S2, 'stores'); await t.page.evaluate(async () => { await loadDB(); render(); });
    const h = await printed(t.page, 'fit', 1);
    rec('stores with only a photo job due: Print today prints it', /WO-NOW/.test(h), h.slice(0, 80));
    await t.close();
  }
  // office: half-failed upload, and an old tick cleared by a new first photo
  const A = await F.dev(browser, S, 'office'); await fakeStore(A.page, st);
  await A.page.evaluate(() => { setWho('Ann'); window.__T = []; const t0 = window.toast; window.toast = function (m) { window.__T.push(String(m)); return t0.apply(this, arguments); }; });
  const attach = async (wo, files) => { const [fc] = await Promise.all([A.page.waitForEvent('filechooser'), A.page.evaluate(w => phPick(w), wo)]); await fc.setFiles(files); await F.sleep(1200); };
  st.failAfter = st.posts.length + 1;
  await attach('WO-TWO', [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
  delete st.failAfter;
  let r = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-TWO'); const t = window.__T.join(' | '); window.__T = []; return { n: (o.listPhotos || []).length, log: (o.log || []).map(l => l.what), t }; });
  rec('2 photos, 2nd fails: the 1st is kept', r.n === 1, JSON.stringify(r));
  rec('…with a history line saying 1 of 2', r.log.some(l => /a photo of the list attached \(1 of 2/.test(l)), JSON.stringify(r.log));
  rec('…and an honest message "only 1 of 2 photos attached … NOT attached (no connection …)"', /only 1 of 2 photos attached/.test(r.t) && /NOT attached \(no connection/.test(r.t) && !/Failed to fetch/.test(r.t), r.t);
  await attach('WO-STALE', [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }]);
  r = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-STALE'); return { pd: o.photoDone || null, n: (o.listPhotos || []).length }; });
  rec('a first photo on a job with an old CUT COMPLETE tick starts uncut', r.n === 1 && !r.pd, JSON.stringify(r));
  await attach('WO-STALE', [{ name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
  await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-STALE'); o.photoDone = { saw: { at: nowISO(), by: 'Saw' } }; });
  await attach('WO-STALE', [{ name: 'c.png', mimeType: 'image/png', buffer: PNG }]);
  r = await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-STALE'); return { pd: o.photoDone || null, n: (o.listPhotos || []).length }; });
  rec('…but adding a photo to a job that already has photos keeps its tick', r.n === 3 && r.pd && r.pd.saw, JSON.stringify(r));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
