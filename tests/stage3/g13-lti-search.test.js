// Garry, 13 Nov 2026: "where are all these jobs — not in cutting list to issue". They were there, but the panel shows the first
// 40 of several hundred. A search box on the panel now looks through EVERY job waiting for a list.
// Fake Supabase only. Run: node tests/stage3/g13-lti-search.test.js
const F = require('./fix3.js');
const { H, D } = F;
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EVIL = '<img src=x onerror="window.__xss=1">';
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row(); row.orders = [];
  const o = (wo, customer, floor, unit, title, due) => H.order({ wo, title, customer, floor, unit, step: '5. WORK ORDER PROCESSED', procAt: '2026-10-21', dueDate: due, origDueDate: due, plannedWeek: '2026-12-14' });
  for (let i = 1; i <= 60; i++) row.orders.push(o('WO-OLD-' + i, 'BACKLOG BUILDERS', 'B1', String(i), 'OLD HOUSE ' + i, '2026-10-' + String(1 + (i % 20)).padStart(2, '0')));
  row.orders.push(o('WO-2648-48', 'ASPECT ATHENRY', 'T13', '68', 'ASPECT KIT 68 TYPE 1', '2026-12-16'), o('WO-2779-9', 'ASPECT ATHENRY', 'T08', '83', 'ASPECT ATHENRY KIT T1LH 83', '2026-12-18'), o('WO-2648-55', 'ASPECT ATHENRY', 'T13', '71', 'ASPECT ROBES 71', '2026-12-18'), o('WO-EVIL', EVIL, 'X', '1', EVIL, '2026-12-19'));
  const S = F.makeServer(row);
  const t = await F.dev(browser, S, 'office'), p = t.page;
  await p.evaluate(async () => { setWho('Ann'); showTab('l'); await new Promise(r => setTimeout(r, 300)); });
  const st = () => p.evaluate(() => { const e = document.getElementById('lti'); return { rows: [...e.querySelectorAll('[data-ltirow]')].map(r => r.dataset.ltirow), box: !!document.getElementById('lti-q'), n: (document.getElementById('lti-qn') || {}).textContent || '', more: (document.getElementById('lti-more') || {}).textContent || '', none: (document.getElementById('lti-q0') || {}).textContent || '', head: e.innerText.slice(0, 60), focus: document.activeElement && document.activeElement.id }; });
  let s = await st();
  rec('set-up: 64 jobs to issue, the first 40 shown, the Aspect jobs are NOT among them, "Show all 64" offered', /— 64/.test(s.head) && s.rows.length === 40 && !s.rows.includes('WO-2648-48') && /Show all 64/.test(s.more), JSON.stringify([s.head, s.rows.length, s.more]));
  rec('the search box is on the panel', s.box);
  await p.click('#lti-q'); await p.keyboard.type('aspect', { delay: 20 }); await sleep(200);
  s = await st();
  rec('typing "aspect" → exactly the 3 Aspect jobs, "3 of 64", the cursor is still in the box, no "Show all"', JSON.stringify(s.rows.slice().sort()) === '["WO-2648-48","WO-2648-55","WO-2779-9"]' && /3 of 64/.test(s.n) && s.focus === 'lti-q' && !s.more, JSON.stringify(s));
  rec('…and the box still holds the whole word (no letters lost while the panel was drawn again)', (await p.inputValue('#lti-q')) === 'aspect');
  await p.keyboard.type(' 71', { delay: 20 }); await sleep(200); s = await st();
  rec('"aspect 71" (two words, any order of fields) → WO-2648-55 only', JSON.stringify(s.rows) === '["WO-2648-55"]', JSON.stringify(s.rows));
  await p.fill('#lti-q', 't08 83'); await sleep(200); s = await st();
  rec('floor + unit "t08 83" → WO-2779-9', JSON.stringify(s.rows) === '["WO-2779-9"]', JSON.stringify(s.rows));
  await p.fill('#lti-q', '2648-48'); await sleep(200); s = await st();
  rec('a WO number → that job', JSON.stringify(s.rows) === '["WO-2648-48"]', JSON.stringify(s.rows));
  await p.fill('#lti-q', 'zzz"<b>'); await sleep(200); s = await st();
  rec('nothing matches → says so in words, no rows, header count unchanged (64)', !s.rows.length && /No job waiting for a list matches/.test(s.none) && /— 64/.test(s.head), JSON.stringify(s));
  await p.fill('#lti-q', 'onerror'); await sleep(200); s = await st();
  rec('HTML in a customer / title never runs, and can be searched as text', JSON.stringify(s.rows) === '["WO-EVIL"]' && !(await p.evaluate(() => window.__xss)), JSON.stringify(s.rows));
  await p.click('#lti-qx'); await sleep(200); s = await st();
  rec('✕ Clear → back to the first 40 with "Show all 64"', s.rows.length === 40 && /Show all 64/.test(s.more) && !s.n, JSON.stringify([s.rows.length, s.more]));
  // a confirmed / dropped job leaves the results: "No list needed" on a searched row
  await p.fill('#lti-q', 'aspect'); await sleep(200);
  await p.evaluate(() => { window.confirm = () => true; window.prompt = () => 'test'; });
  const before = S.db.t.lists.length;
  rec('searching writes nothing to the database', S.db.t.lists.length === before);
  rec('no page errors', !(t.errors || []).length, JSON.stringify(t.errors || []));
  await t.close(); await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
