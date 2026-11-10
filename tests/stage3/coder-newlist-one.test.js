// Garry 4 Nov: two "New list" buttons side by side confused people. Lists home has ONE "＋ New list" that opens the
// standard layout (house heading + Fillers and Kickers / Worktops / Stores items); an empty list is under More ▾ → Blank list.
// The per-project "＋ New list" opens the standard layout too. Fake Supabase only. Run: node tests/stage3/coder-newlist-one.test.js
const F = require('./fix3.js');
const { H } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const rows = p => p.evaluate(() => [...document.querySelectorAll('.me-grid tbody tr')].map(r => { const i = r.querySelector('[data-mr$="|item"]'); return (r.classList.contains('me-h') ? (r.classList.contains('me-hs') ? 'SUB:' : 'HDR:') : 'ROW:') + (i ? i.value : ''); }).filter(x => x !== 'ROW:' || true));
const closeEd = p => p.evaluate(() => { [...document.querySelectorAll('.pod-ovl')].forEach(e => e.remove()); });
(async () => {
  const browser = await H.chromium.launch();
  const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { wos: ['WO-1'] });
  for (const vw of [{ width: 1400, height: 900 }, { width: 360, height: 760 }]) {
    const t = await F.dev(browser, S, 'office', { viewport: vw });
    const b = await t.page.evaluate(async () => { setWho('Ann'); showTab('l'); LH.proj = 'P1'; render(); await new Promise(r => setTimeout(r, 100));
      const bar = document.getElementById('lh-new').parentNode; const btns = [...bar.querySelectorAll(':scope > button')].map(x => x.textContent.trim());
      return { btns, std: !!document.getElementById('lh-std'), more: !!document.querySelector('#lh-more #lh-blank'), sw: document.documentElement.scrollWidth }; });
    rec(vw.width + ': one "＋ New list" in the Lists home bar, no "standard layout" twin; "Blank list" under More ▾', b.btns.filter(x => /New list/.test(x)).length === 1 && !b.std && b.more && !b.btns.some(x => /standard layout|Blank list/.test(x)), JSON.stringify(b));
    if (vw.width === 360) { rec('360: the page does not scroll sideways', b.sw <= 362, b.sw); await t.close(); continue; }
    await t.page.evaluate(() => document.getElementById('lh-new').click()); await F.sleep(150);
    let r = await rows(t.page);
    rec('"＋ New list" opens the standard layout', r.join(',') === 'HDR:,SUB:Fillers and Kickers,ROW:,ROW:,SUB:Worktops,ROW:,ROW:,SUB:Stores items,ROW:,ROW:', JSON.stringify(r));
    await closeEd(t.page);
    await t.page.evaluate(() => { document.querySelector('#lh-more summary').click(); }); await F.sleep(50);
    rec('More ▾ opens and shows "Blank list"', await t.page.evaluate(() => document.getElementById('lh-more').open && document.getElementById('lh-blank').offsetParent !== null));
    await t.page.evaluate(() => document.getElementById('lh-blank').click()); await F.sleep(150);
    r = await rows(t.page);
    rec('"Blank list" opens an empty editor (no headings)', !!(await t.page.evaluate(() => document.querySelector('.me-ed'))) && !r.some(x => /^(HDR|SUB):/.test(x)), JSON.stringify(r));
    await closeEd(t.page);
    await t.page.evaluate(async () => { LH.proj = ''; render(); await new Promise(r => setTimeout(r, 50)); document.querySelector('[data-lhnew="P1"]').click(); }); await F.sleep(150);
    r = await rows(t.page);
    rec('the project\'s own "＋ New list" opens the standard layout too', r[1] === 'SUB:Fillers and Kickers', JSON.stringify(r));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    await t.close();
  }
  await browser.close();
  const nf = res.filter(x => !x).length; console.log(nf + ' failed of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
