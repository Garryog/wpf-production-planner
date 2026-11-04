// Tester round 6 (4 Nov) — attack on "Photo of a list" (Coder 52f733f) and the paper-mark removal (ea9a04d).
// The Storage upload and the pictures are FAKED here (never the live bucket), like tests/stage3/photo-list.test.js.
// Run: node tests/stage3/attack-photo.test.js
const F = require('./fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const far = '2026-12-15';
function server() {
  const o = (wo, x) => H.order(Object.assign({ wo, step: '6. JOB CUT COMPLETE', title: 'House ' + wo, customer: 'Aderrig Homes', procAt: '2026-10-20', dueDate: far, origDueDate: far, plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [
    o('WO-A'), o('WO-B'), o('WO-C'), o('WO-D'),
    o('WO-X', { title: '<img src=x onerror="window.__pwn=1">O\'Grady 😀', customer: '<b>Cust</b>' }),
    o('WO-1', { dueDate: '2026-10-22', origDueDate: '2026-10-22' }), // has a typed list (seedList below)
    o('WO-TD', { dueDate: '2026-10-22', origDueDate: '2026-10-22', delv: true, delVeh: 'VOLVO', delDay: 'Thu' }), // due today-ish, photo only
    o('WO-P1', { listNA: { k: 'paper', at: '2026-10-01T09:00:00Z', by: 'Ann' } }),
  ];
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { wos: ['WO-1'] });
  return S;
}
async function fakeStore(page, st) {
  await page.route(/supabase\.co\/storage\/v1\/object\//, route => {
    const r = route.request(), u = r.url();
    if (r.method() === 'POST') {
      st.posts.push(u);
      if (st.offline) return route.abort('internetdisconnected');
      if (st.failAfter !== undefined && st.posts.length > st.failAfter) return route.abort('internetdisconnected');
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"x"}' });
    }
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
}
async function attach(page, wo, files) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(w => phPick(w), wo)]);
  await fc.setFiles(files);
  await F.sleep(1200);
}
const hook = p => p.evaluate(() => { if (window.__T) return; window.__T = []; const t0 = window.toast; window.toast = function (m, s) { window.__T.push(String(m)); return t0.apply(this, arguments); }; });
const toasts = p => p.evaluate(() => { const r = (window.__T || []).join(' | '); window.__T = []; return r; });
const ord = (p, wo) => p.evaluate(w => JSON.parse(JSON.stringify(DB.orders.find(x => x.wo === w) || null)), wo);
(async () => {
  const browser = await H.chromium.launch();
  const S = server(), st = { posts: [] };
  const A = await F.dev(browser, S, 'office'); await fakeStore(A.page, st);
  const B = await F.dev(browser, S, 'office'); await fakeStore(B.page, st);
  await A.page.evaluate(() => { setWho('Ann'); }); await B.page.evaluate(() => { setWho('Bob'); }); await hook(A.page);
  // let both offices' start-up saves (paper-mark clear) land
  await F.sleep(2500);
  await A.page.evaluate(async () => { await loadDB(); }); await B.page.evaluate(async () => { await loadDB(); });

  // ---- P1: old paper mark cleared exactly once, even with two office PCs open
  const p1 = S.row.orders.find(o => o.wo === 'WO-P1');
  const pl = (p1.log || []).filter(l => /Paper list issued" option was removed/.test(l.what)).length;
  rec('P1 old "paper" mark: gone and exactly ONE history line with two office PCs loading', !p1.listNA && pl === 1, 'listNA=' + JSON.stringify(p1.listNA) + ' lines=' + pl);

  // ---- P2: two PCs attach to the same job at the same moment — both photos kept
  await Promise.all([attach(A.page, 'WO-A', [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }]), attach(B.page, 'WO-A', [{ name: 'b.png', mimeType: 'image/png', buffer: PNG }])]);
  await Promise.all([A.page.evaluate(async () => { await saveDB(); }), B.page.evaluate(async () => { await saveDB(); })]);
  await F.sleep(1500);
  await A.page.evaluate(async () => { await saveDB(); await loadDB(); }); await B.page.evaluate(async () => { await saveDB(); await loadDB(); });
  const srvA = S.row.orders.find(o => o.wo === 'WO-A');
  const byS = (srvA.listPhotos || []).map(p => p.by).sort().join(',');
  rec('P2 two PCs attach one photo each to WO-A at once → the database keeps BOTH', byS === 'Ann,Bob', 'by=' + byS + ' n=' + (srvA.listPhotos || []).length);
  const clash = (srvA.log || []).filter(l => /two screens at once/.test(l.what)).map(l => l.what);
  rec('P2b no false "Edited on two screens at once" clash line for two attaches', !clash.length, clash.join(' / '));

  // ---- P3: upload offline → plain message, nothing half-saved
  await toasts(A.page); st.offline = true;
  await attach(A.page, 'WO-B', [{ name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
  let t = await toasts(A.page), ob = await ord(A.page, 'WO-B');
  rec('P3 offline upload: nothing attached', !ob.listPhotos, JSON.stringify(ob.listPhotos));
  rec('P3b offline upload: plain-English message (not "Failed to fetch")', /NOT attached/.test(t) && !/Failed to fetch|TypeError|NetworkError/i.test(t), t);
  st.offline = false;
  // two photos, the second fails (signal drops half way)
  st.failAfter = st.posts.length + 1;
  await attach(A.page, 'WO-C', [{ name: 'c1.png', mimeType: 'image/png', buffer: PNG }, { name: 'c2.png', mimeType: 'image/png', buffer: PNG }]);
  t = await toasts(A.page); const oc = await ord(A.page, 'WO-C');
  const half = (oc.listPhotos || []).length;
  rec('P3c 2 photos, signal drops on the 2nd: the screen must not say "NOT attached" while silently keeping the 1st (no history line)', !(half === 1 && /NOT attached/.test(t) && !(oc.log || []).some(l => /photo/.test(l.what))), 'kept=' + half + ' toast=' + t + ' log=' + JSON.stringify((oc.log || []).map(l => l.what)));
  delete st.failAfter;

  // ---- P4: big file
  const n0 = st.posts.length; await toasts(A.page);
  await attach(A.page, 'WO-D', [{ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(16 * 1024 * 1024, 1) }]);
  t = await toasts(A.page); const od = await ord(A.page, 'WO-D');
  rec('P4 a 16 MB file is refused with a plain message, nothing uploaded', !od.listPhotos && st.posts.length === n0 && /too big/.test(t), t);
  // wrong type
  await attach(A.page, 'WO-D', [{ name: 'list.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK') }]);
  t = await toasts(A.page);
  rec('P4b a spreadsheet is refused with a plain message', /only photos/.test(t), t);

  // ---- P5: HTML / quotes / emoji in names, and a hostile stored URL
  await A.page.evaluate(() => { setWho('<img src=x onerror="window.__pwn=2">'); });
  await attach(A.page, 'WO-X', [{ name: 'x.png', mimeType: 'image/png', buffer: PNG }]);
  await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-X'); o.listPhotos.push({ url: 'https://evil.example/a.png"><img src=x onerror="window.__pwn=3">', at: '2026-10-21T08:00:00Z', by: 'x' }); o.listPhotos.push({ url: 'javascript:window.__pwn=4', at: '2026-10-21T08:00:00Z', by: 'x' }); });
  await A.page.evaluate(() => { phDlg('WO-X'); showTab('l'); LTI.showPh = true; render(); });
  await F.sleep(400);
  const pw = await A.page.evaluate(() => window.__pwn || 0);
  const dlgN = await A.page.evaluate(() => { const ov = [...document.querySelectorAll('.pod-ovl')].pop(); return ov ? ov.querySelectorAll('img').length : -1; });
  rec('P5 HTML in title / customer / name / stored URL never runs (office dialog + panel)', pw === 0, '__pwn=' + pw);
  rec('P5b a javascript: URL is dropped (only https photos show)', dlgN === 2, 'imgs=' + dlgN);
  await A.page.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
  await A.page.evaluate(() => setWho('Ann'));

  // ---- P6: photo + typed list on the same job; and a photo-only job due today
  await attach(A.page, 'WO-1', [{ name: 'p.png', mimeType: 'image/png', buffer: PNG }]);
  await attach(A.page, 'WO-TD', [{ name: 'p.png', mimeType: 'image/png', buffer: PNG }]);
  await A.page.evaluate(async () => { await saveDB(); });
  const saw = await F.dev(browser, S, 'saw'); await fakeStore(saw.page, st);
  const saw2 = await F.dev(browser, S, 'saw', { viewport: { width: 360, height: 740 } }); await fakeStore(saw2.page, st);
  await saw.page.evaluate(async () => { await loadDB(); render(); }); await saw2.page.evaluate(async () => { await loadDB(); render(); });
  await saw.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-X'); });
  const sv = await saw.page.evaluate(() => ({ todo: document.getElementById('wl-tab-todo').innerText, cards: [...document.querySelectorAll('[data-phcard]')].map(c => c.dataset.phcard), both: (document.querySelector('[data-phcard="WO-1"]') || {}).innerText || '', red: (document.getElementById('wait-red') || {}).innerText || '', amb: (document.getElementById('wait-amber') || {}).innerText || '', pwn: window.__pwn || 0 }));
  rec('P6 saw: job with a photo AND a typed list gets the "also has a typed list" warning', /also has a typed list/.test(sv.both), sv.both.slice(0, 200));
  rec('P6b saw red/amber: photo jobs are not "waiting for a list"', !/WO-TD|WO-A\b/.test(sv.red + sv.amb), sv.red + ' || ' + sv.amb);
  rec('P6c saw: HTML in the job title never runs on the saw screen', sv.pwn === 0, 'pwn=' + sv.pwn);
  const nPh = sv.cards.length, m = /TO DO — (\d+) today/.exec(sv.todo), todo = m ? +m[1] : -1;
  rec('P7 saw "TO DO — N today" counts the photo-list jobs it shows (' + nPh + ' photo cards on screen)', todo >= nPh + 1, 'tab="' + sv.todo + '" photo cards=' + sv.cards.join(','));
  // Print today
  const pr = await saw.page.evaluate(() => { let html = ''; const ow = window.open; window.open = () => ({ document: { write: h => { html += h; }, close() {} } }); printWorkList('saw', 1); window.open = ow; return { html, t: [...document.querySelectorAll('.toast,#toast')].map(e => e.innerText).join(' | ') }; });
  rec('P8 saw "Print today" includes the photo-list job due today (WO-TD) — the paper fallback must show everything to cut', /WO-TD/.test(pr.html), 'printed WO-TD? ' + /WO-TD/.test(pr.html) + ' toast=' + pr.t.slice(-120));
  // ---- P9: 360 px full-screen viewer
  await saw2.page.evaluate(() => document.querySelector('[data-phcard="WO-TD"] [data-phview]').click());
  const v = await saw2.page.evaluate(() => { const ov = document.querySelector('.ph-ovl'), bar = ov.querySelector('.ph-bar'), x = document.getElementById('ph-x').getBoundingClientRect(), r = ov.getBoundingClientRect();
    const btns = [...bar.querySelectorAll('button,a')].map(b => b.getBoundingClientRect()); return { w: r.width, h: r.height, xr: x.right, xb: x.bottom, off: btns.filter(b => b.right > innerWidth + 1 || b.width < 40).length, sw: document.documentElement.scrollWidth, ta: getComputedStyle(ov.querySelector('.ph-scr')).touchAction, vp: document.querySelector('meta[name=viewport]').content }; });
  rec('P9 360 px: viewer fills the screen, every bar button on screen and ≥ 40 px, Close reachable', v.w === 360 && v.h === 740 && v.off === 0 && v.xr <= 360 && v.xb < 200, JSON.stringify(v));
  rec('P9b pinch zoom not blocked (touch-action allows pinch, viewport not user-scalable=no)', /pinch-zoom|auto|manipulation/.test(v.ta) && !/user-scalable=no|maximum-scale=1\b/.test(v.vp), JSON.stringify(v));
  for (let i = 0; i < 6; i++) await saw2.page.evaluate(() => document.querySelector('.ph-ovl [data-phz="1"]').click());
  const zw = await saw2.page.evaluate(() => document.querySelector('.ph-ovl img').style.width);
  for (let i = 0; i < 9; i++) await saw2.page.evaluate(() => document.querySelector('.ph-ovl [data-phz="-1"]').click());
  const zw2 = await saw2.page.evaluate(() => document.querySelector('.ph-ovl img').style.width);
  rec('P9c zoom is capped (≤ 500%) and never smaller than the screen (100%)', zw === '500%' && zw2 === '100%', zw + ' / ' + zw2);
  await saw2.page.evaluate(() => document.getElementById('ph-x').click());

  // ---- P10: CUT COMPLETE on saw 1, Undo on saw 2 — the undo must stick everywhere
  saw.page.on('dialog', d => d.accept()); saw2.page.on('dialog', d => d.accept());
  await saw.page.evaluate(() => document.querySelector('[data-phdone="WO-TD"]').click()); await F.sleep(150);
  await saw.page.evaluate(() => { const b = [...document.querySelectorAll('.pod-ovl [data-pick]')][0]; if (b) b.click(); });
  await saw.page.evaluate(async () => { await saveDB(); });
  await saw2.page.evaluate(async () => { await loadDB(); wlShowDone = true; render(); });
  const und = await saw2.page.evaluate(() => { const b = document.querySelector('[data-phundo="WO-TD"]'); if (!b) return false; b.click(); return true; });
  await saw2.page.evaluate(async () => { wlShowDone = false; render(); await saveDB(); });
  await saw.page.evaluate(async () => { await loadDB(); render(); });
  const u1 = await saw.page.evaluate(() => ({ pd: (DB.orders.find(x => x.wo === 'WO-TD') || {}).photoDone, card: !!document.querySelector('[data-phcard="WO-TD"]') }));
  rec('P10 cut on saw 1, Undo on saw 2 → saw 1 shows the card back and no "cut complete" (database too)', und && !u1.pd && u1.card && !(S.row.orders.find(o => o.wo === 'WO-TD').photoDone), JSON.stringify(u1));
  // both saws tick the same job at once (neither refreshed)
  await saw.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-TD'); o.photoDone = { saw: { at: nowISO(), by: 'S1' } }; });
  await saw2.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-TD'); o.photoDone = { saw: { at: new Date(Date.now() + 5000).toISOString(), by: 'S2' } }; });
  await Promise.all([saw.page.evaluate(async () => { await saveDB(); }), saw2.page.evaluate(async () => { await saveDB(); })]);
  await F.sleep(800); await saw.page.evaluate(async () => { await saveDB(); });
  rec('P10b both saws tick at once → still ticked once in the database', !!(S.row.orders.find(o => o.wo === 'WO-TD').photoDone || {}).saw);

  // ---- P11: office removes the LAST photo while the saw ticks CUT COMPLETE at the same time; then a new photo is attached
  await A.page.evaluate(async () => { await loadDB(); }); await saw.page.evaluate(async () => { await loadDB(); render(); });
  await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-B'); }); // (WO-B has no photo — use WO-D: attach one first)
  await attach(A.page, 'WO-D', [{ name: 'd.png', mimeType: 'image/png', buffer: PNG }]);
  await A.page.evaluate(async () => { await saveDB(); }); await saw.page.evaluate(async () => { await loadDB(); render(); });
  await A.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D'); phRemove('WO-D', o.listPhotos[0].url, 'Ann'); });
  await saw.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-D'); o.photoDone = { saw: { at: nowISO(), by: 'Saw' } }; logEdit(o, 'Photo list: cut complete', 'Saw'); });
  await Promise.all([A.page.evaluate(async () => { await saveDB(); }), saw.page.evaluate(async () => { await saveDB(); })]);
  await F.sleep(800); await A.page.evaluate(async () => { await saveDB(); await loadDB(); });
  const d1 = S.row.orders.find(o => o.wo === 'WO-D');
  await attach(A.page, 'WO-D', [{ name: 'new.png', mimeType: 'image/png', buffer: PNG }]);
  await A.page.evaluate(async () => { await saveDB(); }); await saw.page.evaluate(async () => { await loadDB(); render(); });
  const d2 = await saw.page.evaluate(() => ({ card: !!document.querySelector('[data-phcard="WO-D"]'), pd: (DB.orders.find(x => x.wo === 'WO-D') || {}).photoDone }));
  rec('P11 last photo removed while the saw ticked it; a NEW photo attached later must start uncut (card on the saw)', d2.card && !d2.pd, 'after clash: listPhotos=' + JSON.stringify(d1.listPhotos) + ' photoDone=' + JSON.stringify(d1.photoDone) + ' | after new photo: ' + JSON.stringify(d2));

  // ---- P12: switch OFF hides attach but keeps photos, and phPick refuses
  await A.page.evaluate(() => { DB.photoLists = false; });
  const off = await A.page.evaluate(() => { let opened = false; const ce = document.createElement.bind(document); phPick('WO-B'); return { input: !!document.getElementById('ph-file'), photos: DB.orders.filter(o => phHas(o)).length }; });
  rec('P12 switch OFF: attaching is refused, existing photos kept', !off.input && off.photos > 0, JSON.stringify(off));
  await A.page.evaluate(() => { DB.photoLists = true; });

  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
