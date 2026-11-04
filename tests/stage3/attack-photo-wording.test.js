// Tester round 6 (4 Nov) — "Material" wording everywhere (Coder 90f5067), the single "＋ New list" (15f65fd) and the
// photo-list panel at phone width. Scans what people SEE (text, button titles, placeholders, column headings) for a
// leftover "Colour". Fake Supabase only. Run: node tests/stage3/attack-photo-wording.test.js
const F = require('./fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 400) : '')); };
// visible words: text + title + placeholder + aria-label + option labels of every open overlay and the app
const seen = p => p.evaluate(() => { const out = [document.body.innerText];
  document.querySelectorAll('[title],[placeholder],[aria-label]').forEach(e => out.push(e.getAttribute('title') || '', e.getAttribute('placeholder') || '', e.getAttribute('aria-label') || ''));
  return out.join('\n'); });
const colour = s => (String(s).match(/.{0,40}\bcolou?rs?\b.{0,40}/gi) || []);
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { wos: ['WO-1'] });
  const hits = {};
  for (const vw of [{ width: 1400, height: 900 }, { width: 360, height: 760 }]) {
    const t = await F.dev(browser, S, 'office', { viewport: vw }); const p = t.page;
    await p.evaluate(async () => { setWho('Ann'); showTab('l'); LH.proj = 'P1'; render(); await new Promise(r => setTimeout(r, 150)); });
    hits[vw.width + ' lists home'] = colour(await seen(p));
    // the single New list → standard layout editor
    await p.evaluate(() => document.getElementById('lh-new').click()); await F.sleep(250);
    hits[vw.width + ' new list editor'] = colour(await seen(p));
    const hdr = await p.evaluate(() => { const th = [...document.querySelectorAll('.me-grid thead th')].filter(x => x.offsetParent !== null).map(x => x.textContent.trim()); return th.length ? th : [...document.querySelectorAll('.me-grid [data-l], .me-ed label')].map(x => x.getAttribute('data-l') || x.textContent.trim()); });
    rec(vw.width + ': editor column says "Material", not "Colour"', hdr.some(x => /Material/.test(x)) && !hdr.some(x => /Colou?r/i.test(x)), JSON.stringify(hdr));
    await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
    // More ▾ → Blank list at this width
    const bl = await p.evaluate(async () => { const m = document.getElementById('lh-more'); if (!m) return 'no More'; m.querySelector('summary').click(); await new Promise(r => setTimeout(r, 50));
      const b = document.getElementById('lh-blank'); if (!b || b.offsetParent === null) return 'Blank list not visible'; const r = b.getBoundingClientRect(); if (r.right > innerWidth + 1) return 'off screen ' + r.right; b.click(); await new Promise(r => setTimeout(r, 200)); return document.querySelector('.me-ed') ? 'ok' : 'no editor'; });
    rec(vw.width + ': More ▾ → "Blank list" is on screen and opens an editor', bl === 'ok', bl);
    hits[vw.width + ' blank editor'] = colour(await seen(p));
    await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
    // existing list: view / preview and edit
    await p.evaluate(async () => { const b = document.querySelector('[data-lhview="L1"]'); if (b) b.click(); else lsViewDlg('L1'); await new Promise(r => setTimeout(r, 300)); });
    hits[vw.width + ' list view'] = colour(await seen(p));
    await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
    await p.evaluate(async () => { openListEditor('L1'); await new Promise(r => setTimeout(r, 300)); });
    hits[vw.width + ' edit list'] = colour(await seen(p));
    await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()));
    // the "Cutting lists to issue" panel (photo + No list needed), and its phone fit
    await p.evaluate(async () => { LH.proj = ''; render(); await new Promise(r => setTimeout(r, 150)); });
    hits[vw.width + ' lists panel'] = colour(await seen(p));
    if (vw.width === 360) {
      const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, btns: [...document.querySelectorAll('[data-ltiph]')].map(b => Math.round(b.getBoundingClientRect().right)) }));
      rec('360: the lists panel does not scroll sideways and every "Attach photo" button is on screen', w.sw <= 362 && w.btns.every(r => r <= 360), JSON.stringify(w));
    }
    await t.close();
    // saw and stores phone cards
    for (const role of ['saw', 'stores']) {
      const d = await F.dev(browser, S, role, { viewport: vw });
      await d.page.evaluate(async () => { await loadDB(); render(); await new Promise(r => setTimeout(r, 150)); });
      hits[vw.width + ' ' + role] = colour(await seen(d.page));
      await d.close();
    }
  }
  const bad = Object.entries(hits).filter(([k, v]) => v.length);
  rec('no "Colour" anywhere people look (lists home, editor, blank, view, edit, panel, saw, stores — desktop and 360 px)', !bad.length, JSON.stringify(bad));
  rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
  await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
