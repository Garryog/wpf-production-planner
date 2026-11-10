// Tester attack 1 — the date engine and dialog on awkward jobs.
// Vans: booked / LOADED / DISPATCHED / DELIVERED when the date moves. Cut: step 6, one saw tick, photo-list cut keep their
// week (+chip); step 5 follows with the red "programmed" chip. Group move of 60 jobs through the dialog incl. shipped,
// on hold, P- planner WOs, delivered, no date. "Other" needs a note. Escaping (<script>, O'Grady, <img onerror>) in the
// dialog, summary, history, saw banner, Dates list and the Changes Excel. Stubbed Supabase only.
// Run: node tests/dates/attack1-engine.test.js
const { H, recorder, w } = require('./attack1-lib');
const { rec, done } = recorder('attack1-engine');
const NOW = '2026-11-10T10:00:00Z', W = '2026-11-16', W2 = '2026-11-23';
(async () => {
  const browser = await H.chromium.launch();
  const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-18', origDueDate: '2026-11-18', plannedWeek: W, step: '3. In production', customer: 'CAIRN', title: 'House ' + wo }, x));
  const B8 = { step: '8. PALLETED', delv: true };
  const orders = [
    O('V-BOOK', { ...B8, delVeh: 'VOLVO', delDay: 'Wed', delWk: W }),
    O('V-LOAD', { ...B8, delVeh: 'VOLVO', delDay: 'Wed', delWk: W, delLoadedAt: '2026-11-10T07:00:00Z' }),
    O('V-DISP', { ...B8, delVeh: 'VOLVO', delDay: 'Tue', delWk: '2026-11-09', delLoadedAt: '2026-11-10T07:00:00Z', delDispAt: '2026-11-10T08:00:00Z' }),
    O('V-DONE', { ...B8, delVeh: 'VOLVO', delDay: 'Mon', delWk: '2026-11-09', delDelivAt: '2026-11-09T12:00:00Z', delDone: true }),
    O('C-STEP6', { step: '6. Cut' }),
    O('C-TICK', { step: '4. Drawings' }),
    O('C-PHOTO', { step: '4. Drawings', photoDone: { saw: { at: '2026-11-09T10:00:00Z', by: 'Saw' } } }),
    O('C-PROG', { step: '5. Programmed' }),
    O('C-NONE', { step: '4. Drawings' }),
    O('X-ESC', { customer: '<script>window.__pwn=1</script>O\'Grady & "Sons"', title: '<img src=x onerror="window.__pwn=2">Kitchen', floor: 'F1', unit: '<b>U1</b>' }),
  ];
  // group: 60 jobs
  for (let i = 1; i <= 50; i++) orders.push(O('G-' + i, { dueDate: '2026-11-1' + (i % 7 + 1), customer: 'GROUP' }));
  orders.push(O('G-SHIP', { customer: 'GROUP', shippedAt: '2026-11-09T10:00:00Z' }), O('G-HOLD', { customer: 'GROUP', cienHold: true }), O('P-0001', { customer: 'GROUP' }), O('P-0002', { customer: 'GROUP' }),
    O('G-DELIV', { customer: 'GROUP', ...B8, delDelivAt: '2026-11-09T12:00:00Z', delDone: true }), O('G-NODATE', { customer: 'GROUP', dueDate: '', origDueDate: '' }),
    O('G-LOAD', { customer: 'GROUP', ...B8, delVeh: 'DAF', delDay: 'Thu', delWk: W, delLoadedAt: '2026-11-10T07:00:00Z' }), O('G-BOOK', { customer: 'GROUP', ...B8, delVeh: 'DAF', delDay: 'Fri', delWk: W }),
    O('G-CUT', { customer: 'GROUP', step: '6. Cut' }), O('G-PROG', { customer: 'GROUP', step: '5. Programmed' }));
  const row = { id: 'main', nid: 9, settings: { listChk: false, lists: [{ id: 'LT', wb: 'W1', sheet: 'S', name: 'Tick list', project: 'P', saw: 1, fit: 0, noFit: true, wos: ['C-TICK'], up: '2026-11-01T09:00:00Z' }], listWBs: { W1: { project: 'P', sheets: { S: [{ k: 'saw', item: 'Side', qty: 2, L: 2400, W: 600, mat: 'MFC', note: '' }] } } }, listRow: { LT: { 'r0': { m: 'saw', at: '2026-11-09T10:00:00Z', by: 'Saw' } } } }, orders };
  const t = await H.open({ browser, now: NOW, row });
  const p = t.page;

  // ---- vans + cut ----
  const r = await p.evaluate(() => {
    const g = w => DB.orders.find(o => o.wo === w);
    const res = moveDates(['V-BOOK', 'V-LOAD', 'V-DISP', 'V-DONE', 'C-STEP6', 'C-TICK', 'C-PHOTO', 'C-PROG', 'C-NONE'], { due: '2026-11-25' }, { why: 'Site not ready' }, 'Ann').apply();
    const pk = w => { const o = g(w); return { due: o.dueDate, wk: o.plannedWeek, veh: o.delVeh || '', day: o.delDay || '', delWk: o.delWk || '', rb: !!o.delRebook, mv: o.dueMv ? (o.dueMv.prog ? 'prog' : o.dueMv.loaded ? 'loaded' : 'cut') : '' }; };
    const out = {}; ['V-BOOK', 'V-LOAD', 'V-DISP', 'V-DONE', 'C-STEP6', 'C-TICK', 'C-PHOTO', 'C-PROG', 'C-NONE'].forEach(w => out[w] = pk(w));
    out.skipped = res.skipped; out.cutFn = ['C-STEP6', 'C-TICK', 'C-PHOTO', 'C-PROG', 'C-NONE'].map(w => w + ':' + woCut(g(w)));
    showTab('b'); out.chips = [...document.querySelectorAll('[data-duemv]')].map(b => b.dataset.duemv + '=' + b.textContent.trim());
    return out;
  });
  rec('booked V-BOOK comes off the van into To plan "rebook" (built, so its week is kept + chip)', r['V-BOOK'].day === '' && r['V-BOOK'].rb && r['V-BOOK'].delWk === '' && r['V-BOOK'].wk === W && r['V-BOOK'].mv === 'cut', JSON.stringify(r['V-BOOK']));
  rec('LOADED V-LOAD stays on its van + "date moved after loading" chip', r['V-LOAD'].day === 'Wed' && r['V-LOAD'].delWk === W && r['V-LOAD'].mv === 'loaded' && !r['V-LOAD'].rb, JSON.stringify(r['V-LOAD']));
  rec('DISPATCHED V-DISP stays on its van + flag', r['V-DISP'].day === 'Tue' && r['V-DISP'].mv === 'loaded', JSON.stringify(r['V-DISP']));
  rec('DELIVERED V-DONE not moved (skipped "already delivered")', r['V-DONE'].due === '2026-11-18' && r.skipped.some(s => s.wo === 'V-DONE' && /delivered/.test(s.why)), JSON.stringify(r.skipped));
  rec('woCut: step 6 / saw tick / photo cut = cut; step 5 / step 4 = not cut', r.cutFn.join() === 'C-STEP6:true,C-TICK:true,C-PHOTO:true,C-PROG:false,C-NONE:false', r.cutFn.join());
  rec('cut jobs (step 6, saw tick, photo cut) keep their week + amber "due moved — check week"', ['C-STEP6', 'C-TICK', 'C-PHOTO'].every(w => r[w].wk === W && r[w].mv === 'cut' && r[w].due === '2026-11-25'), JSON.stringify([r['C-STEP6'], r['C-TICK'], r['C-PHOTO']]));
  rec('step 5 C-PROG: week follows + red "programmed — take it out of the nest" chip', r['C-PROG'].wk === W2 && r['C-PROG'].mv === 'prog' && r.chips.some(c => /^C-PROG=.*programmed/.test(c)), JSON.stringify(r['C-PROG']) + ' ' + r.chips.join(' | '));
  rec('not cut C-NONE: week follows, no chip', r['C-NONE'].wk === W2 && !r['C-NONE'].mv, JSON.stringify(r['C-NONE']));

  // ---- group of 60 through the dialog ----
  const G = await p.evaluate(async () => {
    const wos = DB.orders.filter(o => o.customer === 'GROUP').map(o => o.wo), out = { n: wos.length };
    const before = Object.fromEntries(wos.map(w => [w, DB.orders.find(o => o.wo === w).dueDate]));
    const t0 = performance.now();
    dateDlgOpen(wos, 'Ann'); const dl = document.getElementById('date-dlg');
    out.openMs = Math.round(performance.now() - t0);
    dl.querySelector('[name="dmm"][value="shift"]').click(); const n = dl.querySelector('#dm-n'); n.value = '1'; n.dispatchEvent(new Event('input'));
    dl.querySelector('[data-dmwhy="Other"]').click();
    out.okOtherNoNote = !dl.querySelector('#dm-ok').disabled;
    const note = dl.querySelector('#dm-note'); note.value = '   '; note.dispatchEvent(new Event('input')); out.okSpaces = !dl.querySelector('#dm-ok').disabled;
    note.value = 'Developer phasing'; note.dispatchEvent(new Event('input')); out.okNote = !dl.querySelector('#dm-ok').disabled;
    out.holdPrev = ([...dl.querySelectorAll('#dm-prev > div')].find(d => /G-HOLD/.test(d.textContent)) || {}).textContent || '(G-HOLD not in the first 50 preview rows)';
    out.holdFlag = moveDates(['G-HOLD'], { shift: { n: 1, unit: 'wk' } }, {}, 'Ann').rows[0].flags;
    const pv = dl.querySelector('#dm-prev'); out.rows = pv.querySelectorAll(':scope > div').length; out.more = (pv.innerText.match(/…and \d+ more/) || [''])[0]; out.notMoved = (pv.innerText.match(/Not moved:[^\n]*/) || [''])[0];
    out.btn = dl.querySelector('#dm-ok').textContent;
    const t1 = performance.now(); dl.querySelector('#dm-ok').click(); out.applyMs = Math.round(performance.now() - t1);
    const sum = document.getElementById('date-sum'); out.sum = sum ? sum.innerText.replace(/\s+/g, ' ') : '';
    const g = w => DB.orders.find(o => o.wo === w);
    out.p1 = { due: g('P-0001').dueDate, keep: g('P-0001').dueKeep || '' };
    out.hold = { due: g('G-HOLD').dueDate, was: before['G-HOLD'] };
    out.ship = g('G-SHIP').dueDate; out.deliv = g('G-DELIV').dueDate; out.nod = g('G-NODATE').dueDate;
    out.moved = wos.filter(w => g(w).dueDate !== before[w]).length;
    out.hist = g('G-1').dueHist.slice(-1)[0];
    out.dates = datesToCien().map(o => o.wo).filter(w => /^P-/.test(w));
    if (sum) sum.remove();
    return out;
  });
  rec('group of 60: dialog opens fast (< 1 s)', G.openMs < 1000, G.openMs + ' ms');
  rec('"Other" with no note (or only spaces) cannot be saved; with a note it can', !G.okOtherNoNote && !G.okSpaces && G.okNote, JSON.stringify([G.okOtherNoNote, G.okSpaces, G.okNote]));
  rec('preview capped at 50 rows + "…and N more"; skipped listed with reasons', G.rows <= 52 && /…and \d+ more/.test(G.more) && /G-SHIP \(already shipped\)/.test(G.notMoved) && /G-DELIV \(already delivered\)/.test(G.notMoved) && /G-NODATE \(no due date/.test(G.notMoved), JSON.stringify({ rows: G.rows, more: G.more, nm: G.notMoved }));
  rec('group apply: shipped / delivered / no-date not moved; the rest moved; summary adds up', G.ship === '2026-11-18' && G.deliv === '2026-11-18' && G.nod === '' && G.moved === G.n - 3 && new RegExp('^Dates moved ' + (G.n - 3) + ' moved').test(G.sum) && /3 not moved/.test(G.sum), JSON.stringify({ moved: G.moved, n: G.n, sum: G.sum.slice(0, 300) }));
  rec('group apply: summary counts "1 taken off vans" (G-BOOK) and lists G-LOAD / G-CUT / G-PROG to check', /1 taken off vans/.test(G.sum) && /G-LOAD/.test(G.sum) && /G-CUT/.test(G.sum) && /G-PROG/.test(G.sum), G.sum.slice(0, 600));
  rec('group apply: "Other" note kept in history (why Other, note, src group)', G.hist && G.hist.why === 'Other' && G.hist.note === 'Developer phasing' && G.hist.src === 'group', JSON.stringify(G.hist));
  rec('P- planner WOs move but never get a dueKeep / never on "Dates to change in Cienapps"', G.p1.due === '2026-11-25' && !G.p1.keep && !G.dates.length, JSON.stringify(G.p1));
  // (Tester round 2 — ASSUMED rule from 517f23b: an on-hold job is flagged "on hold" in the preview and still moved)
  rec('on-hold job in a group move: flagged "on hold" in the preview, and moved', G.hold.due !== G.hold.was && G.hold.due === '2026-11-25' && G.holdFlag.includes('on-hold') && (/on hold/i.test(G.holdPrev) || /not in the first 50/.test(G.holdPrev)) && /G-HOLD[^—]*— on hold/i.test(G.sum), JSON.stringify({ hold: G.hold, flags: G.holdFlag, prev: G.holdPrev, sum: (G.sum.match(/G-HOLD[^G]*/) || [''])[0] }));
  rec('group apply time for 60 jobs < 2 s', G.applyMs < 2000, G.applyMs + ' ms');

  // ---- escaping ----
  const E = await p.evaluate(async () => {
    window.__pwn = 0; const out = {};
    dateDlgOpen(['X-ESC'], "O'Grady <b>Ann</b>"); const dl = document.getElementById('date-dlg');
    out.head = dl.querySelector('.pod-in > div').textContent;
    const i = dl.querySelector('#dm-date'); i.value = '2026-11-27'; i.dispatchEvent(new Event('input'));
    dl.querySelector('[data-dmwhy="Other"]').click();
    const nt = dl.querySelector('#dm-note'); nt.value = `<script>window.__pwn=3</script><img src=x onerror="window.__pwn=4"> O'Grady's "site"`; nt.dispatchEvent(new Event('input'));
    dl.querySelector('#dm-ok').click(); await new Promise(r => setTimeout(r, 50));
    // history dialog, summary, saw banner, export list
    dmHistDlg('X-ESC'); out.hist = [...document.querySelectorAll('.pod-ovl')].pop().innerText; document.querySelectorAll('.pod-ovl').forEach(o => o.remove());
    dateSummaryDlg({ moved: 1, rows: [{ wo: 'X-ESC', from: '2026-11-18', to: '2026-11-27', flags: ['<img src=x onerror="window.__pwn=5">'], vanPulled: true, slot: '<img src=x onerror="window.__pwn=6">' }], skipped: [{ wo: '<img src=x onerror="window.__pwn=7">', why: '<b>x</b>' }] });
    out.sum = document.getElementById('date-sum').innerText; document.getElementById('date-sum').remove();
    out.banner = movedBanner(DB.orders.find(o => o.wo === 'X-ESC'));
    showTab('x'); await new Promise(r => setTimeout(r, 150)); out.exp = (document.getElementById('exp-dates') || {}).innerText || '';
    let wb = null; const wf = XLSX.writeFile; XLSX.writeFile = (b) => { wb = XLSX.utils.sheet_to_json(b.Sheets.Dates, { header: 1 }); }; const bx = document.getElementById('btn-xchg2'); if (bx) bx.click(); XLSX.writeFile = wf;
    out.xl = wb ? wb.find(r => r[0] === 'X-ESC') : null;
    showTab('b'); await new Promise(r => setTimeout(r, 150));
    out.board = [...document.querySelectorAll('[data-duehist="X-ESC"]')].length;
    await new Promise(r => setTimeout(r, 200));
    out.pwn = window.__pwn; out.imgs = document.querySelectorAll('img[src="x"]').length; out.scripts = [...document.querySelectorAll('script')].filter(s => /__pwn/.test(s.textContent)).length;
    return out;
  });
  rec('escaping: no injected script / img ran anywhere (dialog, history, summary, banner, Export Changes, board)', E.pwn === 0 && E.imgs === 0 && E.scripts === 0, JSON.stringify({ pwn: E.pwn, imgs: E.imgs, scripts: E.scripts }));
  rec('escaping: dialog title shows the raw text (<img …>Kitchen, <b>U1</b>)', /<img src=x onerror="window.__pwn=2">Kitchen/.test(E.head) && /<b>U1<\/b>/.test(E.head), E.head);
  rec('escaping: history shows the note exactly as typed (O\'Grady\'s "site", <script>)', /<script>window.__pwn=3<\/script>/.test(E.hist) && /O'Grady's "site"/.test(E.hist) && /O'Grady <b>Ann<\/b>/.test(E.hist), E.hist.slice(0, 300));
  rec('escaping: summary shows raw text', /<img src=x/.test(E.sum) && /<b>x<\/b>/.test(E.sum), E.sum.slice(0, 300));
  rec('escaping: saw/stores banner has the text escaped', !/<img src=x/.test(E.banner) && /&lt;|Other/.test(E.banner), E.banner);
  rec('escaping: Export Changes Dates list + Excel "Dates" sheet carry the raw customer / note text', /<script>window.__pwn=1<\/script>O'Grady & "Sons"/.test(E.exp) || (E.xl && E.xl.includes('<script>window.__pwn=1</script>O\'Grady & "Sons"')), JSON.stringify(E.xl) + ' | ' + E.exp.slice(0, 200));
  rec('escaping: Excel Dates row has the note exactly as typed', E.xl && E.xl.some(c => String(c).includes(`O'Grady's "site"`)) && E.xl.some(c => String(c).includes('<script>window.__pwn=3</script>')), JSON.stringify(E.xl));
  rec('no page errors', !(t.server.errors || []).length, (t.server.errors || []).join(' | '));
  await t.close(); await browser.close();
  done();
})().catch(e => { console.error(e); process.exit(1); });
