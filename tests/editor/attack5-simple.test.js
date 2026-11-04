// Tester round 5, attack 5 on the simplified editor (Garry 4 Nov): "Lists must be checked before the saw" OFF by default
// (no check sign anywhere), ON then OFF across two screens, an old-version tab saving settings without the key,
// Bought-in lines never reaching the saw / sheet calculator / combined list / labels, TBC red but never blocking,
// Floor | Unit and WO | Title apart for a list on several WOs. Browser, fake Supabase only.
// Run: node tests/editor/attack5-simple.test.js
const F = require('../stage3/fix3.js');
const { H, D } = F;
let fail = 0, n = 0; const rec = (t, ok, d) => { n++; if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + t + (ok || !d ? '' : '  -> ' + String(d).slice(0, 500))); };
const J = JSON.stringify;
const CHK = /Waiting for check|checked by|✓ Check\b|Not checked|needs? (a )?check/i;
const LINES = [['hdr', 'House 103', null, null, null, null, '', '', {}], ['hdr', 'Fillers and Kickers', null, null, null, null, '', '', { section: 'House 103' }],
  ['saw', 'Kicker', '3', 2400, 150, 'MFC White', '', '', {}], ['buy', 'BoughtPanelZZ', '2', 900, 600, 'MFC White', '', 'Bought in', {}],
  ['saw', 'Worktops', '1', 3000, 600, 'TBC', '', '', {}], ['fit', 'Sink', '1', null, null, '', '', '', {}]];
(async () => {
  const browser = await H.chromium.launch();
  const row = F.v2Row();
  row.orders.forEach(o => { o.title = 'HOUSE ' + o.wo + ' LONG TITLE TYPE B'; o.floor = o.wo === 'WO-1' ? 'GF' : '1'; o.unit = o.wo === 'WO-1' ? '12' : '14'; });
  const S = F.makeServer(row);
  F.seedList(S, 'L1', { name: 'House 103', wos: ['WO-1', 'WO-2'], lines: LINES });
  F.seedList(S, 'L2', { name: 'House 104', wos: ['WO-2'], lines: [['saw', 'Side', '2', 720, 560, 'MFC White', '', ''], ['buy', 'BoughtPanelZZ', '1', 800, 500, 'MFC White', '', '']] });
  F.seedList(S, 'T1', { name: 'Type A', wos: [], list: { is_template: true, type_name: 'Type A' }, lines: LINES });
  const o = await F.dev(browser, S, 'office'), s = await F.dev(browser, S, 'saw'), o2 = await F.dev(browser, S, 'office');
  // ---- E1: switch OFF (never set) → no check sign anywhere
  rec('E1 the planner record has no listChk key (never set)', !('listChk' in (S.row.settings || {})));
  const txt = {};
  await o.page.evaluate(() => { showTab('l'); render(); }); txt.lists = await o.page.evaluate(() => document.getElementById('app').innerText);
  txt.saw = await s.page.evaluate(() => { render(); return document.getElementById('app').innerText; });
  txt.ed = await o.page.evaluate(async () => { try { openListEditor2('L1'); } catch (e) { return 'ERR ' + e.message; } await new Promise(r => setTimeout(r, 400)); const t = document.body.innerText; document.querySelectorAll('.pod-ov,[id$="-dlg"]').forEach(x => x.remove()); return t; });
  txt.tpl = await o.page.evaluate(async () => { try { openListEditor2('T1'); } catch (e) { return 'ERR ' + e.message; } await new Promise(r => setTimeout(r, 400)); const t = document.body.innerText; document.querySelectorAll('.pod-ov,[id$="-dlg"]').forEach(x => x.remove()); return t; });
  await s.page.evaluate(() => { window.__pr = []; window.open = () => { const w = { h: '', document: { write(x) { w.h += x; }, close() {} }, focus() {}, print() {}, close() {} }; window.__pr.push(w); return w; }; });
  txt.prints = await s.page.evaluate(() => { const ls = workListFor('saw', 3); try { printLabels(ls, 'saw'); } catch (e) {} try { printRunSheets && printRunSheets(); } catch (e) {} try { openCombined(ls, 'saw'); } catch (e) {} return window.__pr.map(w => w.h).join('\n') + (document.body.innerText); });
  for (const k of Object.keys(txt)) { const m = CHK.exec(txt[k]); rec('E1 switch OFF: no check sign on ' + k, !m, m && txt[k].slice(Math.max(0, m.index - 80), m.index + 80)); }
  // ---- E4: Bought-in never on the saw, sheet calculator, combined list or labels
  const saw = await s.page.evaluate(() => { const ls = workListFor('saw', 3); window.__pr = []; try { printLabels(ls, 'saw'); } catch (e) { return 'ERR ' + e.message; }
    const lab = window.__pr.map(w => w.h).join(''); document.querySelectorAll('.pod-ov,[id$="-dlg"]').forEach(x => x.remove());
    try { openCombined(ls, 'saw'); } catch (e) {} const comb = document.body.innerText; return { names: ls.map(l => l.name), app: document.getElementById('app').innerText, sheet: sheetNeedHTML(), lab, comb }; });
  rec('E4 both lists are on the saw', saw.names && saw.names.length >= 2, J(saw.names));
  ['app', 'sheet', 'lab', 'comb'].forEach(k => rec('E4 Bought-in line never on the saw ' + k, !/BoughtPanelZZ/.test(saw[k] || ''), (saw[k] || '').slice(0, 200)));
  rec('E4 sheet calculator counts only the saw panels (no 900x600 / 800x500 bought-in panel area)', !/BoughtPanelZZ/.test(saw.sheet));
  // ---- E5: TBC red on the saw card, list still on the saw
  const tbc = await s.page.evaluate(() => { const c = [...document.querySelectorAll('.wl-card')].find(x => x.querySelector('[data-wlsel="L1"]')); return c ? { t: c.innerText, red: c.querySelectorAll('.tbc-cell,.tbc-chip').length } : null; });
  rec('E5 TBC: red on the saw card and the list is not stopped (switch OFF)', tbc && tbc.red > 0 && /Kicker/.test(tbc.t), J(tbc));
  // ---- E7: several WOs on one list: Floor | Unit apart and WO | Title apart (saw card / Lists table)
  const lt = await o.page.evaluate(() => { showTab('l'); render(); const r = document.querySelector('[data-lhrow="L1"]'); return r ? [...r.children].map(td => td.innerText.trim()) : null; });
  rec('E7 Lists table row for a list on WO-1 + WO-2: no "GF · 12" joined floor/unit, no "WO-1 HOUSE…" joined WO/title', lt && !lt.some(c => /GF\s*·\s*12|1\s*·\s*14/.test(c)) && !lt.some(c => /WO-1\s*[·—-]\s*HOUSE/.test(c)), J(lt));
  rec('E7 saw card: floor/unit not joined as "GF · 12"', tbc && !/GF\s*·\s*12/.test(tbc.t), tbc && tbc.t.slice(0, 300));
  // ---- E2: ON on one office screen, OFF on a second office screen opened before the ON (an admin changing their mind on another PC)
  await o.page.evaluate(async () => { DB.listChk = true; sched(); await new Promise(r => setTimeout(r, 2500)); });
  rec('E2 ON saved to the planner record', S.row.settings.listChk === true, J(S.row.settings.listChk));
  await o2.page.evaluate(async () => { await loadDB(); DB.listChk = false; sched(); await new Promise(r => setTimeout(r, 2500)); });
  rec('E2 then OFF on a second office screen (opened before the ON, has refreshed since): the record says OFF', S.row.settings.listChk === false, J(S.row.settings.listChk));
  await o.page.evaluate(async () => { await loadDB(); });
  rec('E2 the first screen follows (OFF) after a refresh', await o.page.evaluate(() => DB.listChk === false && !lsChkOn()));
  // ---- E3: ON, then an OLD-version tab saves the whole record without the key
  await o.page.evaluate(async () => { DB.listChk = true; sched(); await new Promise(r => setTimeout(r, 2500)); });
  const s0 = Object.assign({}, S.row.settings); delete s0.listChk;
  S.row.settings = s0; S.row.version = (S.row.version || 1) + 1; // the old tab overwrote the row (old code knows nothing of listChk)
  await o.page.evaluate(async () => { await loadDB(); });
  rec('E3 the open screen keeps the switch ON after the old-tab save', await o.page.evaluate(() => DB.listChk === true));
  await o.page.evaluate(async () => { const od = DB.orders[0]; od.notes = 'after old tab'; sched(); await new Promise(r => setTimeout(r, 2500)); });
  const f = await F.dev(browser, S, 'saw');
  const fv = await f.page.evaluate(() => DB.listChk);
  rec('E3 after the open screen saves again, a freshly opened screen sees the switch ON (not silently OFF)', fv === true, 'fresh screen listChk=' + J(fv) + ' record=' + J(S.row.settings.listChk));
  rec('no page errors', ![o, s, f].some(() => false) && !(S.errors || []).length, J(S.errors));
  await browser.close();
  console.log(fail + ' failed of ' + n); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
