// Stores dockets D5: the "Items sent" report — per project and From/To dates: items on dockets (cancelled ones left out)
// plus, with the switch on, stores lines ticked "got out" on the bench. WO / Floor / Unit / Title apart, docket no., who,
// delivered yes/no. Print + Excel with the same rows. On Stores, the office Lists tab, PM and Production (switch on);
// Stores only with the switch off. Fake Supabase only. Run: node tests/stores-docket/d5-report.test.js
const fs = require('fs'), path = require('path');
const X = require('./fixd.js');
const { H, D } = X;
const XLSX = require(path.join(__dirname, '../../xlsx.full.min.js'));
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).slice(0, 300) : '')); };
const run = async (p, pid, from, to) => { await p.evaluate(({ pid, from, to }) => { const g = id => document.getElementById(id);
  g('dkr-from').value = from; g('dkr-from').onchange({ target: g('dkr-from') }); g('dkr-to').value = to; g('dkr-to').onchange({ target: g('dkr-to') });
  g('dkr-proj').value = pid; g('dkr-proj').onchange({ target: g('dkr-proj') }); }, { pid, from, to }); await X.sleep(700); };
const tbl = p => p.evaluate(() => [...document.querySelectorAll('#dk-rep-dlg .dk-tbl tbody tr')].map(tr => [...tr.children].map(td => td.innerText.trim())));
(async () => {
  const browser = await H.chromium.launch();
  const S = X.makeServer();
  S.row.orders.find(o => o.wo === 'WO-1').delDone = true; // WO-1 delivered with the job
  const a = await X.dev(browser, S, 'stores');
  const at = iso => { S.db.clock = () => new Date(iso); };
  at('2026-10-05T09:00:00Z'); await a.page.evaluate(() => dkMake({ project_id: 'P1' }, [{ item: 'Old item', qty: '1', wo: 'WO-1' }], 'Op'));
  at('2026-10-20T09:00:00Z'); const m1 = await a.page.evaluate(() => dkMake({ project_id: 'P1' }, [{ line_id: 'L1:2', qty: '10', wo: 'WO-1', floor: 'GF', unit: '12', title: 'HOUSE WO-1 TYPE B' }, { item: 'Spare handles', qty: '4', wo: 'WO-2', floor: '1', unit: '14' }], 'Mary'));
  at('2026-10-20T10:00:00Z'); const m2 = await a.page.evaluate(() => dkMake({ project_id: 'P1' }, [{ item: 'Wrong thing', qty: '9' }], 'Mary'));
  await a.page.evaluate(id => dkCancel(id, 'mistake', 'Mary', false), m2.id);
  at('2026-10-20T11:00:00Z'); await a.page.evaluate(() => dkMake({ project_name: 'Cherrywood' }, [{ item: 'Other project', qty: '1' }], 'Mary'));
  await a.page.evaluate(id => dkDelivered(id, 'Joe Site', '2026-10-21', '', 'Op'), m1.id);
  // the hinge line ticked got out on the bench (no docket)
  D.applyLineChanges(S.db, [{ id: 'L1:3', status: 'got-out', cid: 'h1', rev: 1 }], 'Sean');
  await a.page.evaluate(async () => { await lsPoll(); render(); });
  rec('Stores screen has "Items sent"', await a.page.evaluate(() => !!document.getElementById('dk-rep')));
  await a.page.evaluate(() => document.getElementById('dk-rep').click()); await X.sleep(200);
  await run(a.page, 'P1', '2026-10-10', '2026-12-31');
  const t = await tbl(a.page);
  const items = t.map(r => r[6]);
  rec('rows: the 10 taps + spare handles (D26-0002) and the hinges got out on the bench', items.join() === 'Tap,Spare handles,Hinge', JSON.stringify(t));
  rec('left out: the docket before From, the cancelled docket, another project', !items.includes('Old item') && !items.includes('Wrong thing') && !items.includes('Other project'));
  const tap = t[0];
  rec('tap row: Docket D26-0002 | WO-1 | GF | 12 | title | Tap | 10 | Chrome mixer | House 1 | Mary | Yes — received by Joe Site', tap[1] === 'D26-0002' && tap[2] === 'WO-1' && tap[3] === 'GF' && tap[4] === '12' && tap[5] === 'HOUSE WO-1 TYPE B' && tap[7] === '10' && tap[8] === 'Chrome mixer' && tap[9] === 'House 1' && tap[10] === 'Mary' && /^Yes — received by Joe Site/.test(tap[11]), JSON.stringify(tap));
  const hin = t[2];
  rec('bench got-out row: no docket, WO-1 | GF | 12, by Sean, delivered "Yes — with the job" (WO-1 delivered)', hin[1] === '—' && hin[2] === 'WO-1' && hin[3] === 'GF' && hin[4] === '12' && hin[7] === '8' && hin[10] === 'Sean' && /^Yes — with the job/.test(hin[11]), JSON.stringify(hin));
  // Excel = the same rows
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.evaluate(() => document.getElementById('dkr-xls').click())]);
  const fp = await dl.path(); const wb = XLSX.read(fs.readFileSync(fp)); const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  rec('Excel: header WO | Floor | Unit | Title separate, same 3 rows as the screen', aoa[0].join('|') === 'Date|Docket|WO|Floor|Unit|Title|Item|Qty|Spec|List|Sent / got out by|Delivered' && aoa.length === 4 && aoa.slice(1).map(r => r[6]).join() === 'Tap,Spare handles,Hinge' && aoa[1][3] === 'GF' && aoa[1][4] === '12', JSON.stringify(aoa));
  rec('Excel file name has the project and the dates', /WPF_Items_sent_Aderrig_2026-10-10_2026-12-31\.xlsx/.test(dl.suggestedFilename()), dl.suggestedFilename());
  await X.catchPrint(a.page);
  await a.page.evaluate(() => document.getElementById('dkr-print').click());
  const pr = (await X.printed(a.page))[0] || '';
  rec('Print: title with project and dates, the same rows', /Items sent — Aderrig/.test(pr) && /Spare handles/.test(pr) && /Hinge/.test(pr) && !/Wrong thing/.test(pr));
  // date range: To before From
  await run(a.page, 'P1', '2026-10-30', '2026-10-01');
  rec('From after To: says so', /From must be on or before To/.test(await a.page.evaluate(() => document.getElementById('dkr-body').innerText)));
  // elsewhere (switch on): office Lists tab, PM, Production
  const off = await X.dev(browser, S, 'office');
  await off.page.evaluate(() => { showTab('l'); }); await X.sleep(300);
  rec('office Lists tab has "Items sent"', await off.page.evaluate(() => !!document.getElementById('lh-sent')));
  const pm = await X.dev(browser, S, 'pm');
  rec('PM view has "Items sent"', await pm.page.evaluate(() => !!document.getElementById('pm-sent')));
  const pd = await X.dev(browser, S, 'prod');
  rec('Production view has "Items sent"', await pd.page.evaluate(() => !!document.getElementById('prod-sent')));
  await pd.page.evaluate(() => document.getElementById('prod-sent').click()); await X.sleep(200);
  await run(pd.page, 'P1', '2026-10-10', '2026-12-31');
  rec('Production: the same 3 rows', (await tbl(pd.page)).map(r => r[6]).join() === 'Tap,Spare handles,Hinge');
  // 360 px
  const n = await X.dev(browser, S, 'stores', { viewport: { width: 360, height: 760 } });
  await n.page.evaluate(() => document.getElementById('dk-rep').click()); await X.sleep(200);
  await run(n.page, 'P1', '2026-10-10', '2026-12-31');
  const w = await n.page.evaluate(() => { const d = document.querySelector('#dk-rep-dlg .pod-in'); return { doc: document.documentElement.scrollWidth, dlg: d.scrollWidth, dlgc: d.clientWidth }; });
  rec('360 px: the report fits (no sideways scroll)', w.doc <= 360 && w.dlg <= w.dlgc + 1, JSON.stringify(w));
  const pm360 = await X.dev(browser, S, 'pm', { viewport: { width: 360, height: 760 } });
  rec('360 px: the PM strip wraps (no sideways scroll)', await pm360.page.evaluate(() => document.documentElement.scrollWidth <= 360));
  // switch OFF: Stores report = dockets only; office / PM / Production unchanged (no button)
  const S1 = X.makeServer(X.v1Row());
  const o = await X.dev(browser, S1, 'stores');
  await o.page.evaluate(() => dkMake({ project_name: 'Aderrig Homes' }, [{ item: 'Taps', qty: '20', wo: 'WO-1', floor: 'GF', unit: '12' }], 'Op'));
  await o.page.evaluate(() => document.getElementById('dk-rep').click()); await X.sleep(200);
  await run(o.page, 'Aderrig Homes', '2026-01-01', '2026-12-31');
  rec('switch OFF: Stores report shows the typed docket', (await tbl(o.page)).map(r => r[6]).join() === 'Taps');
  rec('switch OFF: no calls to the cutting-list tables', !S1.log.some(x => /^\w+ \/(lists|list_lines|projects|list_events)/.test(x)));
  const o2 = await X.dev(browser, S1, 'pm');
  rec('switch OFF: PM view has no Items sent button (unchanged)', !(await o2.page.evaluate(() => !!document.getElementById('pm-sent'))));
  rec('no page errors', !(S.errors || []).length && !(S1.errors || []).length, JSON.stringify([S.errors, S1.errors]));
  await browser.close();
  const f = res.filter(x => !x).length; console.log(f + ' failed of ' + res.length); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
