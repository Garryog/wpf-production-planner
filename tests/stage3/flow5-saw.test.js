// Cutting-list flow, step 5: saw strips (RED "ON DELIVERY – NO CUTTING LIST" for WOs on a van AND a day; AMBER one line
// for every other job waiting, opens on a tap), the board's "📋 no list" chip (red once late), the Production Manager's
// "Lists late" / "Lists to issue" tiles, the management tiles, and the "List due N working days" setting.
// Switch off: none of it. Fake Supabase only. Run: node tests/stage3/flow5-saw.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const far = '2026-12-15';
function server(on) {
  const o = (wo, step, x) => H.order(Object.assign({ wo, step, title: 'House ' + wo, customer: 'Aderrig Homes', dueDate: far, origDueDate: far, plannedWeek: '2026-12-14' }, x || {}));
  const row = F.v2Row(); row.orders = [
    o('WO-RED', '7. ASSEMBLY COMPLETE', { procAt: '2026-10-20', delv: true, delVeh: 'VOLVO', delDay: 'Thu', dueDate: '2026-10-22', origDueDate: '2026-10-22' }),
    o('WO-POOL', '7. ASSEMBLY COMPLETE', { procAt: '2026-10-21', delv: true }),               // undated pool / automatic step 7 tag
    o('WO-DAY', '6. JOB CUT COMPLETE', { procAt: '2026-10-21', delv: true, delDay: 'Fri' }),   // a day but no van
    o('WO-LATE', '5. WORK ORDER PROCESSED', { procAt: '2026-10-16' }),                          // due Tue 20 → late
    o('WO-NEW', '6. JOB CUT COMPLETE', { procAt: '2026-10-21' }),                               // due Fri 23
    o('WO-LIST', '5. WORK ORDER PROCESSED', { procAt: '2026-10-21' }),                          // has a list
    o('WO-S3', '3. READY FOR UPLOAD'),
  ];
  if (!on) { delete row.settings.listStore; delete row.settings.listStoreAt; }
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { wos: ['WO-LIST'] });
  return S;
}
(async () => {
  const browser = await H.chromium.launch();
  {
    const S = server(true);
    // ---- saw
    const saw = await F.dev(browser, S, 'saw');
    let w = await saw.page.evaluate(() => { const g = id => document.getElementById(id); return { red: g('wait-red') ? g('wait-red').innerText : null, redRows: g('wait-red') ? [...g('wait-red').querySelectorAll('[data-waitwo]')].map(r => r.dataset.waitwo) : [], amb: g('wait-amber') ? g('wait-amber').innerText : null, ambRows: g('wait-amber') ? g('wait-amber').querySelectorAll('[data-waitwo]').length : -1, order: document.body.innerText.indexOf('ON DELIVERY') < document.body.innerText.indexOf('waiting for a cutting list') }; });
    rec('saw RED: "ON DELIVERY – NO CUTTING LIST" with only the WO on a van AND a day, showing van and day', w.red && /ON DELIVERY – NO CUTTING LIST — 1 job/.test(w.red) && w.redRows.join() === 'WO-RED' && /Volvo Thu/.test(w.red), JSON.stringify(w));
    rec('saw RED: the undated pool, the automatic step 7 tag and a day with no van do NOT count for red', !/WO-POOL|WO-DAY/.test(w.red || ''), w.red);
    rec('saw AMBER: one line "4 jobs waiting for a cutting list · 1 late", closed', w.amb && /4 jobs waiting for a cutting list · 1 late/.test(w.amb) && w.ambRows === 0 && w.order, JSON.stringify(w));
    await saw.page.evaluate(() => document.getElementById('wait-tog').click());
    w = await saw.page.evaluate(() => ({ rows: [...document.querySelectorAll('#wait-amber [data-waitwo]')].map(r => r.dataset.waitwo + (r.style.background ? ':late' : '')), t: document.getElementById('wait-amber').innerText }));
    rec('saw AMBER: a tap opens it — the four jobs, the late one red', ['WO-LATE:late', 'WO-POOL', 'WO-DAY', 'WO-NEW'].every(x => w.rows.includes(x)) && w.rows.length === 4, JSON.stringify(w.rows));
    rec('saw: rows say list due by (2 working days after processed) and owner', /WO-NEW[\s\S]*list due by 23 Oct 26[\s\S]*owner Drawing office/.test(w.t), w.t.slice(0, 400));
    await saw.page.evaluate(() => document.getElementById('wait-tog').click());
    rec('saw AMBER: a second tap closes it', (await saw.page.evaluate(() => document.querySelectorAll('#wait-amber [data-waitwo]').length)) === 0);
    // ---- board chip
    const off = await F.dev(browser, S, 'office');
    const chips = await off.page.evaluate(() => { showTab('b'); return [...document.querySelectorAll('tr[data-wo]')].map(tr => { const c = tr.querySelector('.ls-nochip'); return c ? tr.dataset.wo + (c.classList.contains('late') ? ':late' : '') : null; }).filter(Boolean); });
    rec('board: "📋 no list" chip on step 5+ jobs with no list, red once late; none on the listed job or step 3', ['WO-LATE:late', 'WO-NEW', 'WO-POOL', 'WO-DAY'].every(x => chips.includes(x)) && !chips.some(x => /WO-LIST|WO-S3/.test(x)), JSON.stringify(chips));
    rec('board: the chip says when the list is due', await off.page.evaluate(() => /due by 23 Oct/.test(document.querySelector('tr[data-wo="WO-NEW"] .ls-nochip').title)));
    // ---- Production Manager tiles
    const pr = await F.dev(browser, S, 'prod');
    const pm = await pr.page.evaluate(() => { const t = [...document.querySelectorAll('.dsh-tile')].map(e => e.innerText.replace(/\s+/g, ' ')); return { t, body: document.body.innerText }; });
    rec('Production Manager Today: "Lists late" 2 (WO-LATE, and WO-RED whose saw day has passed) and "Lists to issue" 3', pm.t.some(x => /^2 LISTS LATE/.test(x)) && pm.t.some(x => /^3 LISTS TO ISSUE/.test(x)), JSON.stringify(pm.t));
    rec('Production Manager Today: rows with owner and due-by', /WO-LATE[\s\S]*LATE · was due 20 Oct 26 · owner Drawing office/.test(pm.body), pm.body.slice(pm.body.indexOf('CUTTING LISTS'), pm.body.indexOf('CUTTING LISTS') + 300));
    await pr.page.evaluate(() => document.querySelector('[data-pmlists="late"]').click());
    rec('tapping a tile opens the Lists tab with the panel', await pr.page.evaluate(() => prodTab === 'lists' && !!document.getElementById('lti')));
    // ---- management dashboard
    const ds = await F.dev(browser, S, 'dash');
    const dt = await ds.page.evaluate(() => [...document.querySelectorAll('.dsh-tile')].map(e => e.innerText.replace(/\s+/g, ' ')));
    rec('management: the lists tile is split into "Lists late" and "Lists to issue"', dt.some(x => /^2 LISTS LATE/.test(x)) && dt.some(x => /^3 LISTS TO ISSUE/.test(x)) && !dt.some(x => /LISTS MISSING/.test(x)), JSON.stringify(dt));
    // ---- setting
    await off.page.evaluate(() => { showTab('l'); document.getElementById('lst-due').value = '4'; document.getElementById('lst-due-save').click(); });
    await off.page.evaluate(async () => { await saveDB(); });
    rec('setting "List due N working days after the WO is processed" saved', S.row.settings.listDue === 4, JSON.stringify(S.row.settings.listDue));
    await off.page.evaluate(() => { document.getElementById('lst-due').value = '0'; document.getElementById('lst-due-save').click(); });
    rec('setting: 0 refused', await off.page.evaluate(() => listDueDays() === 4));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | '));
    // ---- 360 px
    const ph = await F.dev(browser, S, 'saw', { viewport: { width: 360, height: 760 } });
    await ph.page.evaluate(() => { sawWaitOpen = true; render(); });
    const pw = await ph.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, red: Math.round(document.getElementById('wait-red').getBoundingClientRect().right), tog: Math.round(document.getElementById('wait-tog').getBoundingClientRect().right) }));
    rec('360 px saw: both strips fit, no sideways scrolling', pw.sw <= 360 && pw.red <= 360 && pw.tog <= 360, JSON.stringify(pw));
    const pp = await F.dev(browser, S, 'prod', { viewport: { width: 360, height: 760 } });
    rec('360 px Production Manager Today: no sideways scrolling', (await pp.page.evaluate(() => document.documentElement.scrollWidth)) <= 360);
    await saw.close(); await off.close(); await pr.close(); await ds.close(); await ph.close(); await pp.close();
  }
  // ---- switch off: no strips, no chip, no new tiles, no setting
  {
    const S = server(false);
    const saw = await F.open(browser, S, { now: F.NOW, role: 'saw' });
    const off = await F.open(browser, S, { now: F.NOW, role: 'office' });
    const pr = await F.open(browser, S, { now: F.NOW, role: 'prod' });
    const ds = await F.open(browser, S, { now: F.NOW, role: 'dash' });
    const a = await saw.page.evaluate(() => !!document.getElementById('wait-list'));
    const b = await off.page.evaluate(() => { showTab('b'); const c = document.querySelectorAll('.ls-nochip').length; showTab('l'); return { c, due: !!document.getElementById('lst-due') }; });
    const c = await pr.page.evaluate(() => /LISTS LATE|LISTS TO ISSUE/.test(document.body.innerText));
    const d = await ds.page.evaluate(() => [...document.querySelectorAll('.dsh-tile')].map(e => e.innerText.replace(/\s+/g, ' ')).filter(x => /LISTS (MISSING|LATE|TO ISSUE)/.test(x)));
    rec('switch off: no saw strip, no board chip, no due setting, no new PM tiles; management keeps "Lists missing"', !a && b.c === 0 && !b.due && !c && d.length === 1 && /LISTS MISSING/.test(d[0]), JSON.stringify({ a, b, c, d }));
    rec('switch off: no calls to the new tables', F.newTableCalls(S).length === 0, F.newTableCalls(S).join());
    await saw.close(); await off.close(); await pr.close(); await ds.close();
  }
  await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
