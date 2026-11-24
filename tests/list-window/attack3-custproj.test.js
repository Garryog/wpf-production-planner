// Tester attack ROUND 3 (list window, 13 Nov): customer → project. Linked by itself ONLY when it is the same customer once
// Ltd / Limited / PLC / The / & Co are ignored; single letters are never legal words; a hand-made project (no customer) links
// on its name. Odd punctuation, case, & / and, trailing spaces, empty, only-legal-words, numbers, HTML, O'Grady.
// Fake Supabase only. Run: node tests/list-window/attack3-custproj.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, asks, job } = L;
const o = (wo, c, x) => H.order(Object.assign({ wo, customer: c, floor: 'Q', unit: wo.replace(/\D/g, '') || '1', title: 'HOUSE', dueDate: '2026-11-30', origDueDate: '2026-11-30' }, x || {}));
const XSS = '<img src=x onerror="window.__xss=1"> Homes';
function row() { const r = X.v2Row();
  r.orders.push(o('WO-901', 'Aderrig Homes  '), o('WO-902', ''), o('WO-903', '   '), o('WO-904', XSS), o('WO-905', "O'Grady & Sons Ltd."), o('WO-906', 'The Ltd'), o('WO-907', 'ADERRIG HOMES LIMITED'), o('WO-908', 'Adamstown Phase 3 Ltd'), o('WO-909', '"Quoted" <b>Bold</b> Builders'));
  return r; }

(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(row());
    const ins = (id, name, customer, cn) => D.insert(S.db, 'projects', Object.assign({ id, name }, customer ? { customer, cien_names: cn || [customer] } : {}));
    ins('PA', 'Builder A', 'Builder A Homes'); ins('PT', 'Builder T', 'Builder T Homes');
    ins('PH', 'Glenveagh'); // made by hand: no customer recorded
    ins('PO', "O'Grady & Sons", "O'Grady & Sons Ltd");
    ins('PM', 'Murphy', 'Murphy & Sons'); ins('P2A', 'Adamstown Phase 2', 'Adamstown Phase 2 Ltd');
    ins('PKH', 'Kildare Homes', 'Kildare Homes');
    const t = await X.dev(browser, S, 'design'), p = t.page; await asks(p);
    const auto = c => p.evaluate(c => { try { const r = lsProjAuto(c); return r.p ? 'p:' + r.p.id : r.ask ? 'ask:' + r.ask.id : r.many ? 'many:' + r.many.map(x => x.id).sort().join(',') : 'none'; } catch (e) { return 'ERR ' + e.message; } }, c);
    const is = async (c, want, why, sev) => { const g = await auto(c); rec((sev ? sev + ' ' : '') + 'M: customer ' + JSON.stringify(c) + ' → ' + (Array.isArray(want) ? want.join(' or ') : want) + (why ? ' (' + why + ')' : ''), Array.isArray(want) ? want.includes(g) : g === want, g); return g; };
    const not = async (c, bad, why, sev) => { const g = await auto(c); rec((sev ? sev + ' ' : '') + 'M: customer ' + JSON.stringify(c) + ' is NOT linked by itself to ' + bad + (why ? ' (' + why + ')' : ''), g !== 'p:' + bad && !/^ERR/.test(g), g); return g; };

    // ---- the same customer, written differently → linked by itself ----
    for (const c of ['ADERRIG HOMES LTD.', 'Aderrig Homes Limited ', ' aderrig  homes ', 'The Aderrig Homes PLC', 'Aderrig Homes & Co', 'Aderrig Homes and Co.', 'Aderrig Homes, Ltd', 'ADERRIG HOMES LTD\t', 'Aderrig Homes (Ireland) Ltd', 'Aderrig Homes Ltd']) await is(c, 'p:P1');
    await is('Aderrig-Homes Ltd', 'p:P1', 'a hyphen for a space', '(info)');
    await is('Murphy and Sons', 'p:PM', '"&" in Cienapps one day, "and" the next');
    await is('Murphy & Sons Limited', 'p:PM');
    await is("O'Grady and Sons", 'p:PO', 'apostrophe + and');
    await is('O’Grady & Sons Ltd', 'p:PO', 'curly apostrophe from Word / Outlook', '(info)');
    await is('OGrady & Sons', 'p:PO', 'apostrophe left out', '(info)');
    // ---- single letters ----
    await is('Builder A Homes', 'p:PA'); await is('Builder T Homes', 'p:PT'); await is('BUILDER A HOMES LTD', 'p:PA'); await is('builder t homes limited.', 'p:PT');
    await not('Builder Homes', 'PA', 'no letter at all'); await not('Builder Homes', 'PT');
    await not('Builder B Homes', 'PA', 'another letter'); await not('Builder B Homes', 'PT');
    // ---- numbers are part of the name ----
    await not('Adamstown Phase 3 Ltd', 'P2A', 'Phase 3 is not Phase 2', '[MEDIUM]');
    await is('Adamstown Phase 2 Limited', 'p:P2A');
    // ---- another trading word = another company until a person says so ----
    for (const c of ['Aderrig Developments Ltd', 'The Aderrig Group', 'Aderrig Park Homes', 'Aderrig Living', 'Lucan Developments Ltd']) await not(c, /Lucan/.test(c) ? 'P2' : 'P1');
    await is('Aderrig Living', ['ask:P1'], 'renamed in Cienapps: asked "Is this project Aderrig?", never a silent second project');
    await is('Aderig Homes', ['ask:P1'], 'one letter out (question 4, recommended answer A)', '(info)');
    // ---- a hand-made project (no customer recorded) links on its name ----
    await is('Glenveagh Homes Ltd', 'p:PH'); await is('GLENVEAGH', 'p:PH'); await is('The Glenveagh Homes PLC ', 'p:PH');
    await not('Glen Homes', 'PH', 'only part of the word');
    // ---- nothing to go on ----
    for (const c of ['', '   ', null, undefined, 'Ltd', 'The Ltd', '& Co', 'The Company Limited', 'Homes', 'Homes Ltd', '.', '---', 'A', '&']) { const g = await auto(c); rec('M: customer ' + JSON.stringify(c === undefined ? '(undefined)' : c) + ' (nothing but company words / empty) links to NO project and breaks nothing', g === 'none' || /^(ask|many)/.test(g) && false || g === 'none', g); }
    // ---- "Co" as County ----
    await not('Co. Kildare Homes', 'PKH', '"Co." here is County, a different name — or it is asked', '(info)');
    // ---- HTML / quotes never break it ----
    for (const c of [XSS, '"Quoted" <b>Bold</b> Builders', "'; drop table projects;--", '<script>window.__xss=2</script>']) { const g = await auto(c); rec('M: customer ' + JSON.stringify(c).slice(0, 50) + ' → no error', !/^ERR/.test(g), g); }

    // ================= through the window =================
    const n0 = () => S.db.t.projects.length;
    const openWo = async wo => { await closeAll(p); await p.evaluate(wo => { window.__asked = []; window.__confirm = true; openListEditor(null, wo); }, wo); await sleep(1900); return job(p); };
    let n = n0(), j = await openWo('WO-901');
    rec('V1: job whose customer has trailing spaces ("Aderrig Homes  ") → project Aderrig, no new project', j.pid === 'P1' && n0() === n, JSON.stringify([j.pid, n0() - n, j.pm]));
    j = await openWo('WO-907');
    rec('V1: "ADERRIG HOMES LIMITED" → project Aderrig, no new project, no question', j.pid === 'P1' && n0() === n && !/Is this project/.test(j.pm), JSON.stringify([j.pid, j.pm]));
    j = await openWo('WO-902');
    rec('V2: job with NO customer → said plainly ("no customer in Cienapps"), no project made', !j.pid && n0() === n && /no customer/i.test(j.pm), JSON.stringify([j.pid, j.pm]));
    j = await openWo('WO-903');
    rec('V2: customer of spaces only → the same: no project made, no project called "   "', !j.pid && n0() === n && !S.db.t.projects.some(x => !String(x.name || '').trim()), JSON.stringify([j.pid, j.pm, n0() - n]));
    j = await openWo('WO-906');
    rec('V3: customer "The Ltd" → not linked to any existing project (a new project of that name, or a question, is fine)', !['P1', 'P2', 'PA', 'PT', 'PH', 'PO', 'PM', 'P2A', 'PKH'].includes(j.pid), JSON.stringify([j.pid, j.pm, S.db.t.projects.slice(-1)[0].name]));
    j = await openWo('WO-905');
    rec('V4: "O\'Grady & Sons Ltd." → the O\'Grady & Sons project, no second one', j.pid === 'PO', JSON.stringify([j.pid, j.pm]));
    n = n0(); j = await openWo('WO-908');
    rec('[MEDIUM] V5: "Adamstown Phase 3 Ltd" opened from its job is NOT filed under project "Adamstown Phase 2" without a question', j.pid !== 'P2A' || /Is this project/.test(j.pm), JSON.stringify([j.pid, j.pm]));
    // HTML in the customer
    n = n0(); j = await openWo('WO-904'); await sleep(600);
    const x1 = await p.evaluate(() => ({ xss: window.__xss, img: document.querySelectorAll('img[src="x"]').length, b: document.querySelectorAll('.me-ed b').length, txt: (document.querySelector('.me-ed') || {}).innerText.replace(/\s+/g, ' ').slice(0, 300), toast: [...document.querySelectorAll('.toast,#toast')].map(t => t.innerHTML).join(' ').slice(0, 200) }));
    rec('X1: customer "<img onerror> Homes": nothing runs, no <img> is put on the page — the name shows as plain text', x1.xss === undefined && x1.img === 0, JSON.stringify(x1));
    const np = S.db.t.projects.slice(n).map(x => x.name);
    rec('(info) X1: …the project set up from it is called ' + JSON.stringify(np), true, JSON.stringify(j.pm));
    await closeAll(p); await p.evaluate(async () => { lsReset(); await lsLoad(); render(); }); await sleep(900);
    const x2 = await p.evaluate(() => ({ xss: window.__xss, img: document.querySelectorAll('img[src="x"]').length }));
    rec('X1: …and the Drawing office page with that project on it runs nothing either', x2.xss === undefined && x2.img === 0, JSON.stringify(x2));
    j = await openWo('WO-909'); const x3 = await p.evaluate(() => ({ bold: [...document.querySelectorAll('.me-ed b')].some(b => b.textContent === 'Bold'), xss: window.__xss }));
    rec('X2: customer \'"Quoted" <b>Bold</b> Builders\': shown as typed (no real bold), window opens', j.open && !x3.bold && x3.xss === undefined, JSON.stringify([j.pid, j.pm, x3]));
    // the question "Is this project …?" — No makes ONE new project, asked once
    S.row.orders.push(o('WO-910', 'Aderrig Living'), o('WO-911', 'Aderrig Living'));
    await p.evaluate(async () => { await loadDB(); lsReset(); await lsLoad(); }); n = n0();
    j = await openWo('WO-910');
    rec('V6: customer renamed in Cienapps ("Aderrig Living"): the window ASKS "Is this project \'Aderrig\'?" and makes no project by itself', /Is this project/.test(j.pm) && n0() === n, JSON.stringify([j.pid, j.pm]));
    await p.evaluate(() => { const b = document.getElementById('me-pyes'); if (b) b.click(); }); await sleep(1800); j = await job(p);
    rec('V6: …Yes → the list is on project Aderrig; no new project', j.pid === 'P1' && n0() === n, JSON.stringify([j.pid, j.pm]));
    j = await openWo('WO-911');
    rec('V6: …the next "Aderrig Living" job is linked to Aderrig WITHOUT being asked again (the answer was remembered)', j.pid === 'P1' && !/Is this project/.test(j.pm) && n0() === n, JSON.stringify([j.pid, j.pm, (S.db.t.projects.find(x => x.id === 'P1') || {}).cien_names]));
    rec('no page errors', !(S.errors || []).length, (S.errors || []).join(' | ').slice(0, 300));
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
