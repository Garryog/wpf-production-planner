// Photo of a list (Garry, 4 Nov) — the stop-gap that replaces "Paper list issued".
// "📷 Attach photo of list" on a "Cutting lists to issue" row (phone camera or a file), several photos, stored in the
// Storage bucket 'list-photos' (FAKED here — the upload and the picture are answered by this test, never the live bucket);
// o.listPhotos on the job; a WO with a photo counts as "has a list" (panel, saw red/amber, board chip); the saw's
// "Photo list" card with a full-screen viewer and ONE "✓ CUT COMPLETE" tick; Stores "✓ FITTINGS PICKED"; the office
// removes a photo (history); Settings "Photo lists allowed" OFF hides the attach buttons (photos still show).
// Run: node tests/stage3/photo-list.test.js
const F = require('./fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const far = '2026-12-15';
function server() {
  const o = (wo, x) => H.order(Object.assign({ wo, step: '6. JOB CUT COMPLETE', title: 'House ' + wo, customer: 'Aderrig Homes', procAt: '2026-10-20', dueDate: far, origDueDate: far, plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [
    o('WO-PH', { title: 'House <b>7</b> "kitchen"', delv: true, delVeh: 'VOLVO', delDay: 'Thu' }),
    o('WO-B'),
    o('WO-OLD', { listPhotos: 'garbage', photoDone: 7 }), // damaged / old-shape fields must not crash anything
  ];
  return F.makeServer(row);
}
// the fake Storage: uploads to list-photos are recorded and answered 200; the public picture is a 1-pixel PNG
async function fakeStore(page, st) {
  await page.route(/supabase\.co\/storage\/v1\/object\//, route => {
    const r = route.request(), u = r.url();
    if (r.method() === 'POST') {
      st.posts.push(u);
      if (st.fail) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"x"}' });
    }
    st.gets.push(u);
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
}
async function attach(page, wo, files) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(w => document.querySelector('[data-ltiph="' + w + '"]').click(), wo)]);
  await fc.setFiles(files);
  await page.waitForFunction(w => { const o = DB.orders.find(x => x.wo === w); return o && Array.isArray(o.listPhotos) && o.listPhotos.length > 0; }, wo, { timeout: 8000 }).catch(() => {});
  await F.sleep(200);
}
(async () => {
  const browser = await H.chromium.launch();
  const S = server(), st = { posts: [], gets: [], fail: false };
  // ---- office: attach
  const off = await F.dev(browser, S, 'office'); await fakeStore(off.page, st);
  await off.page.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 200)); });
  let p = await off.page.evaluate(() => ({ btn: !!document.querySelector('[data-ltiph="WO-PH"]'), paper: /Paper list issued/.test(document.body.innerText), rows: [...document.querySelectorAll('[data-ltirow]')].map(r => r.dataset.ltirow) }));
  rec('panel row: "📷 Attach photo of list" next to "No list needed" (no "Paper list issued")', p.btn && !p.paper && p.rows.includes('WO-PH'), JSON.stringify(p));
  rec('old / damaged listPhotos and photoDone load without a crash and count as no photo', !(S.errors || []).length && p.rows.includes('WO-OLD'), (S.errors || []).join(' | '));
  // upload failure (bucket not there yet): nothing saved, plain message
  st.fail = true;
  await attach(off.page, 'WO-B', [{ name: 'list.png', mimeType: 'image/png', buffer: PNG }]);
  const fl = await off.page.evaluate(() => ({ ph: DB.orders.find(o => o.wo === 'WO-B').listPhotos, t: [...document.querySelectorAll('.toast,#toast')].map(e => e.innerText).join(' ') }));
  rec('upload refused (bucket not set up) → nothing attached, the job still needs a list', !fl.ph && st.posts.length === 1, JSON.stringify(fl));
  st.fail = false;
  await attach(off.page, 'WO-PH', [{ name: 'p1.jpg', mimeType: 'image/png', buffer: PNG }, { name: 'p2.png', mimeType: 'image/png', buffer: PNG }]);
  let o = await off.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-PH'); return { ph: o.listPhotos, log: (o.log || []).map(l => l.what), need: listsNeeded().map(x => x.wo), rows: [...document.querySelectorAll('[data-ltirow]')].map(r => r.dataset.ltirow) }; });
  rec('two photos attached in one go, stored in the list-photos bucket under the WO, with who and when', o.ph && o.ph.length === 2 && o.ph.every(x => /\/storage\/v1\/object\/public\/list-photos\/WO-PH\/\d+-\d+\.jpg$/.test(x.url) && x.by === 'Ann' && x.at) && st.posts.slice(1).every(u => /\/storage\/v1\/object\/list-photos\/WO-PH\//.test(u)), JSON.stringify(o.ph));
  rec('history: "2 photos of the list attached"', o.log.some(l => /2 photos of the list attached/.test(l)), JSON.stringify(o.log));
  rec('a WO with photos counts as having a list: off the panel and listsNeeded', !o.need.includes('WO-PH') && !o.rows.includes('WO-PH'), JSON.stringify(o));
  // a PDF is kept as it is (opens in the phone's PDF viewer)
  await attach(off.page, 'WO-OLD', [{ name: 'list.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }]);
  o = await off.page.evaluate(() => DB.orders.find(x => x.wo === 'WO-OLD').listPhotos);
  rec('a PDF is attached as a PDF (.pdf, marked pdf)', o && o.length === 1 && o[0].pdf === true && /list-photos\/WO-OLD\/\d+-\d+\.pdf$/.test(o[0].url), JSON.stringify(o));
  await off.page.evaluate(async () => { await saveDB(); });
  const sv = S.row.orders.find(x => x.wo === 'WO-PH');
  rec('saved in the planner record (o.listPhotos), no new table', sv && Array.isArray(sv.listPhotos) && sv.listPhotos.length === 2);
  // a second attach adds to the list
  await off.page.evaluate(async () => { LTI.showPh = true; ltiAfter(); });
  p = await off.page.evaluate(() => { const e = document.getElementById('lti'); return e ? e.innerText : ''; });
  rec('panel: "📷 Photo lists (2)" shows WO-PH with its photo count and an Open button', /Photo lists \(2\)/.test(p) && /WO-PH[\s\S]*2 photos/.test(p), p.slice(-300));
  // board chip
  const bd = await off.page.evaluate(async () => { showTab('b'); await new Promise(r => setTimeout(r, 200)); const tr = document.querySelector('tr[data-wo="WO-PH"]'), tb = document.querySelector('tr[data-wo="WO-B"]'); return { ph: tr ? tr.innerText : '', b: tb ? tb.innerText : '', chip: !!(tr && tr.querySelector('[data-phwo="WO-PH"]')) }; });
  rec('board: WO-PH shows "📷 photo list", not "📋 no list"; WO-B still "📋 no list"', bd.chip && /photo list/.test(bd.ph) && !/no list/.test(bd.ph) && /no list/.test(bd.b), JSON.stringify(bd));
  await off.page.evaluate(() => document.querySelector('[data-phwo="WO-PH"]').click());
  const dl = await off.page.evaluate(() => { const ov = [...document.querySelectorAll('.pod-ovl')].pop(); return ov ? { t: ov.innerText, h: ov.innerHTML, imgs: ov.querySelectorAll('img').length, rm: ov.querySelectorAll('[data-phrm]').length, add: !!ov.querySelector('#ph-add') } : null; });
  rec('board chip opens the WO\'s photos: 2 thumbnails, Remove on each, Attach more', dl && dl.imgs === 2 && dl.rm === 2 && dl.add, JSON.stringify(dl && { t: dl.t.slice(0, 200), imgs: dl.imgs, rm: dl.rm }));
  rec('the job title is escaped in the dialog', dl && !/<b>7<\/b>/.test(dl.h) && /&lt;b&gt;7/.test(dl.h));
  await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
  // ---- saw
  const saw = await F.dev(browser, S, 'saw'); await fakeStore(saw.page, st);
  await saw.page.evaluate(async () => { await loadDB(); render(); });
  let s = await saw.page.evaluate(() => { const c = document.querySelector('[data-phcard="WO-PH"]'); const r = document.getElementById('wait-red');
    return c ? { t: c.innerText, th: c.querySelectorAll('[data-phview]').length, rt: c.querySelectorAll('[data-rt],[data-rna]').length, done: (c.querySelector('[data-phdone]') || {}).textContent, red: r ? r.innerText : '' } : null; });
  rec('saw: a "Photo list" card for WO-PH with 2 tappable thumbnails', s && /Photo list/.test(s.t) && s.th === 2, JSON.stringify(s));
  rec('saw: ONE "✓ CUT COMPLETE" tick for the job, no per-line ticks', s && s.done === '✓ CUT COMPLETE' && s.rt === 0, JSON.stringify(s));
  rec('saw: WO-PH (on a van and a day) is not in the red "NO CUTTING LIST" warning', s && !/WO-PH/.test(s.red), s && s.red);
  await saw.page.evaluate(() => document.querySelector('[data-phcard="WO-PH"] [data-phview]').click());
  const fv = await saw.page.evaluate(() => { const ov = document.querySelector('.ph-ovl'); const img = ov && ov.querySelector('img'); return ov ? { t: ov.innerText, src: img && img.src, w: img && img.style.width, fs: ov.getBoundingClientRect().width === innerWidth } : null; });
  rec('tap the thumbnail → full-screen photo (zoom buttons, arrows for the 2nd photo, Close)', fv && fv.fs && /photo 1 of 2/.test(fv.t) && /list-photos\/WO-PH/.test(fv.src) && /Close/.test(fv.t), JSON.stringify(fv));
  await saw.page.evaluate(() => document.querySelector('.ph-ovl [data-phz="1"]').click());
  rec('＋ zooms the photo in', (await saw.page.evaluate(() => document.querySelector('.ph-ovl img').style.width)) === '150%');
  await saw.page.evaluate(() => document.querySelector('.ph-ovl [data-phgo="1"]').click());
  rec('▶ goes to photo 2', /photo 2 of 2/.test(await saw.page.evaluate(() => document.querySelector('.ph-ovl').innerText)));
  await saw.page.evaluate(() => document.getElementById('ph-x').click());
  rec('Close shuts the viewer', await saw.page.evaluate(() => !document.querySelector('.ph-ovl')));
  await saw.page.evaluate(() => document.querySelector('[data-phdone="WO-PH"]').click());
  await F.sleep(150);
  await saw.page.evaluate(() => { const b = [...document.querySelectorAll('.pod-ovl [data-pick]')][0]; if (b) b.click(); });
  s = await saw.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-PH'); return { pd: o.photoDone, card: !!document.querySelector('[data-phcard="WO-PH"]'), rdy: woReady('WO-PH'), log: (o.log || []).map(l => l.what) }; });
  rec('✓ CUT COMPLETE: recorded on the job with who/when, card leaves the queue, history line', s.pd && s.pd.saw && s.pd.saw.at && !s.card && s.log.some(l => /Photo list: cut complete/.test(l)), JSON.stringify(s));
  rec('board readiness: cut but not picked → amber (photo list)', s.rdy.lvl === 'amber' && s.rdy.saw === 'done' && s.rdy.fit === 'open' && /photo list/.test(s.rdy.why.join()), JSON.stringify(s.rdy));
  await saw.page.evaluate(async () => { wlShowDone = true; render(); });
  const dn = await saw.page.evaluate(() => document.querySelector('.wl').innerText);
  rec('saw DONE tab lists the photo list with an Undo', /PHOTO LISTS[\s\S]*WO-PH/.test(dn), dn.slice(0, 300));
  await saw.page.evaluate(async () => { wlShowDone = false; render(); await saveDB(); });
  // ---- stores
  const sto = await F.dev(browser, S, 'stores'); await fakeStore(sto.page, st);
  await sto.page.evaluate(async () => { await loadDB(); render(); });
  s = await sto.page.evaluate(() => { const c = document.querySelector('[data-phcard="WO-PH"]'); return c ? { done: (c.querySelector('[data-phdone]') || {}).textContent, th: c.querySelectorAll('[data-phview]').length } : null; });
  rec('stores: the same Photo list card with ONE "✓ FITTINGS PICKED"', s && s.done === '✓ FITTINGS PICKED' && s.th === 2, JSON.stringify(s));
  // ---- settings switch OFF
  await off.page.evaluate(async () => { await loadDB(); DB.photoLists = false; showTab('l'); render(); await new Promise(r => setTimeout(r, 100)); });
  p = await off.page.evaluate(() => ({ btn: document.querySelectorAll('[data-ltiph]').length, row: !!document.querySelector('[data-ltirow="WO-B"]') }));
  rec('Settings "Photo lists allowed" OFF: no attach button on the panel rows', p.btn === 0 && p.row, JSON.stringify(p));
  await off.page.evaluate(() => phDlg('WO-PH'));
  p = await off.page.evaluate(() => { const ov = [...document.querySelectorAll('.pod-ovl')].pop(); return { add: !!ov.querySelector('#ph-add'), imgs: ov.querySelectorAll('img').length }; });
  rec('…and none in the WO\'s photo dialog, but the photos already attached still show', !p.add && p.imgs === 2, JSON.stringify(p));
  await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
  const so = await off.page.evaluate(() => fullSettings().photoLists);
  rec('the switch is saved in the settings (photoLists:false)', so === false);
  // the saw still sees the photos with the switch off
  await sto.page.evaluate(() => { DB.photoLists = false; render(); });
  rec('switch OFF: stores still sees the Photo list card', await sto.page.evaluate(() => !!document.querySelector('[data-phcard="WO-PH"] [data-phview]')));
  await off.page.evaluate(() => { DB.photoLists = true; render(); });
  // settings panel has the switch
  const sp = await off.page.evaluate(async () => { showTab('s'); await new Promise(r => setTimeout(r, 100)); const c = document.getElementById('ls-photo'); return c ? { on: c.checked, t: c.parentNode.innerText } : null; });
  rec('Settings shows "Photo lists allowed" (ticked = on, the default)', sp && sp.on && /Photo lists allowed/.test(sp.t), JSON.stringify(sp));
  // ---- office removes a photo
  off.page.on('dialog', d => d.accept());
  await off.page.evaluate(async () => { showTab('l'); phDlg('WO-PH'); });
  await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().querySelector('[data-phrm="0"]').click());
  await F.sleep(150);
  o = await off.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-PH'); return { n: (o.listPhotos || []).length, log: (o.log || []).map(l => l.what) }; });
  rec('office removes one photo: 1 left, history "a photo of the list removed (1 left)"', o.n === 1 && o.log.some(l => /photo of the list removed \(1 left\)/.test(l)), JSON.stringify(o));
  await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl')].pop().querySelector('[data-phrm="0"]').click());
  await F.sleep(150);
  o = await off.page.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-PH'); return { ph: o.listPhotos, pd: o.photoDone, log: (o.log || []).map(l => l.what), need: listsNeeded().map(x => x.wo) }; });
  rec('last photo removed: the job needs a list again (back in listsNeeded), history says so; its "cut complete" goes too', !o.ph && !o.pd && o.need.includes('WO-PH') && o.log.some(l => /no photo left, the job needs a list again/.test(l)), JSON.stringify(o));
  await off.page.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
  // a saw / stores device never gets Remove or Attach in the dialog
  await sto.page.evaluate(() => phDlg('WO-B'));
  rec('stores: the WO dialog has no Remove / Attach', await sto.page.evaluate(() => { const ov = [...document.querySelectorAll('.pod-ovl')].pop(); return !ov.querySelector('#ph-add') && !ov.querySelector('[data-phrm]'); }));
  // phone 360: the panel row's attach button fits
  const ph = await F.dev(browser, S, 'office', { viewport: { width: 360, height: 760 } }); await fakeStore(ph.page, st);
  const w = await ph.page.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector('[data-ltiph="WO-B"]'); const r = b && b.getBoundingClientRect(); return { ok: !!b, right: r && r.right, sw: document.documentElement.scrollWidth }; });
  rec('360 px phone: the attach button is on screen and the page does not scroll sideways', w.ok && w.right <= 360 && w.sw <= 362, JSON.stringify(w));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  rec('only the faked storage was called (bucket list-photos)', st.posts.every(u => /object\/list-photos\//.test(u)) && st.gets.every(u => /object\/public\/list-photos\//.test(u)), JSON.stringify(st.posts.slice(0, 3)));
  await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
