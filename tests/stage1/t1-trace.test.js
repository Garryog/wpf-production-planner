// TRACE copy of t1-soak (Tester, round 3): same soak, plus a server-side log of every write of job notes and
// the office page's console, printed only when a notes edit is lost. Used to chase an intermittent lost note.
// ATTACK 1: 5 devices (office, saw, stores, driver, pm) editing in overlapping bursts with random
// network latency, 503s, lost replies (write landed, reply lost), offline periods and tab close/reopen.
// Each device only touches "its own" things, so there are NO true clashes: every single change must
// survive, nothing may be duplicated, and every device must end with the identical plan.
// A tab reopened with no signal that has never loaded the plan shows only a blocking "can't reach the database"
// screen with no controls (proved in t6-neverloaded), so no user can make an edit there: ops are skipped on such tabs.
// The fake DB simulates the Stage 1 version-bump trigger.
// Run: node tests/stage1/t1-soak.test.js [seed] [rounds]
const { H, makeServer, device, sleep } = require('./tsrv');
let seed = +(process.argv[2] || 7); const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ROUNDS = +(process.argv[3] || 25);
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + d : '')); };
const NAMES = ['office', 'saw', 'stores', 'driver', 'pm'];
(async () => {
  const browser = await H.chromium.launch();
  const orders = []; for (let i = 0; i < 20; i++) orders.push(H.order({ wo: 'WO-' + i, notes: '' }));
  const S = makeServer({ id: 'main', version: 1, orders, nid: 50, settings: { listRow: { L: {} }, weekCaps: {} } });
  const TR = []; { let _o = S.row.orders; Object.defineProperty(S.row, 'orders', { enumerable: true, configurable: true, get() { return _o; }, set(v) { const pick = (v || []).filter(o => /^WO-\d+$/.test(o.wo)).map(o => o.wo + '=' + o.notes).join(','); TR.push(new Date().toISOString().slice(17, 23) + ' v' + S.row.version + '→ by ' + S._who + ' :: ' + pick); _o = v; } }); }
  const CON = [];
  const devs = [];
  for (const n of NAMES) { const dev = { name: n, latency: [20, 400], failRate: 0, dropReply: 0 }; devs.push(await device(browser, S, dev, { role: n === 'pm' ? 'pm' : n })); devs[devs.length - 1].page.on('console', m => CON.push(new Date().toISOString().slice(17, 23) + ' ' + n + ': ' + m.text().slice(0, 300))); }
  // expected state
  const exp = { notes: {}, ticks: new Set(), unticked: new Set(), added: new Set(), deleted: new Set(), caps: {} };
  const own = (d, i) => i % 5 === d;
  let k = 0, skipped = 0;
  const op = async (di) => {
    const D = devs[di], n = NAMES[di]; k++;
    const r = rnd();
    const blocked = await D.page.evaluate(() => !DB.loaded || !!DB.loadFailed).catch(() => true);
    if (blocked) { skipped++; return; } // the UI offers nothing to edit on a never-loaded screen
    const mine = []; for (let i = 0; i < 20; i++) if (own(di, i) && !exp.deleted.has('WO-' + i)) mine.push('WO-' + i);
    let js;
    if (r < 0.35 && mine.length) { const wo = mine[Math.floor(rnd() * mine.length)]; const tok = n + ':' + k; exp.notes[wo] = tok; js = `{const o=DB.orders.find(x=>x.wo===${JSON.stringify(wo)});o.notes=${JSON.stringify(tok)};}`; }
    else if (r < 0.6) { const key = n + '-' + k; exp.ticks.add(key); js = `{DB.listRow=DB.listRow||{};DB.listRow.L=DB.listRow.L||{};DB.listRow.L[${JSON.stringify(key)}]={m:'saw',by:${JSON.stringify(n)}};}`; }
    else if (r < 0.7) { const mt = [...exp.ticks].filter(t => t.startsWith(n + '-') && !exp.unticked.has(t)); if (!mt.length) return; const t = mt[0]; exp.unticked.add(t); exp.ticks.delete(t); js = `{if(DB.listRow&&DB.listRow.L)delete DB.listRow.L[${JSON.stringify(t)}];}`; }
    else if (r < 0.82) { const wo = 'NEW-' + n + '-' + k; exp.added.add(wo); js = `{DB.orders.push(Object.assign(JSON.parse(JSON.stringify(DB.orders[0]||{})),{wo:${JSON.stringify(wo)},notes:'',log:[]}));}`; }
    else if (r < 0.86 && mine.length > 1) { const wo = mine[mine.length - 1]; exp.deleted.add(wo); delete exp.notes[wo]; js = `{DB.orders=DB.orders.filter(x=>x.wo!==${JSON.stringify(wo)});}`; }
    else if (r < 0.93) { const wk = n + 'wk' + k; exp.caps[wk] = k; js = `{DB.weekCaps=DB.weekCaps||{};DB.weekCaps[${JSON.stringify(wk)}]=${k};}`; }
    else { js = `{}`; await D.page.evaluate(() => loadDB().then(() => render())).catch(() => {}); return; } // auto-refresh tick
    await D.page.evaluate(`(()=>{if(!window.__tr){window.__tr=1;window.__lost=[];const ap=window.applyPlan;window.applyPlan=function(p){const before=Object.keys((DB.listRow||{}).L||{});const st=new Error().stack.split('\\n').slice(2,5).map(x=>x.trim()).join(' < ');const info={saving:SAVING,ver:VER,saveT:!!saveT,baseHas:null};ap.apply(this,arguments);const after=Object.keys((DB.listRow||{}).L||{});before.filter(k=>!after.includes(k)).forEach(k=>{info.baseHas=!!(BASE&&BASE.settings&&BASE.settings.listRow&&BASE.settings.listRow.L&&BASE.settings.listRow.L[k]);window.__lost.push(k+' @ '+st+' '+JSON.stringify(info));});};}${js};sched();})()`).catch(e => console.log('op err', e.message));
  };
  for (let round = 0; round < ROUNDS; round++) {
    // network weather for this round
    devs.forEach((D, i) => { const a = rnd(), b = rnd(), c = rnd(); D.dev.offline = !process.env.NOOFF && i > 0 && a < 0.2; D.dev.failRate = !process.env.NOFAIL && b < 0.3 ? 0.4 : 0; D.dev.dropReply = !process.env.NODROP && c < 0.2 ? 0.3 : 0; });
    const bursts = devs.map(async (D, i) => { const nops = 1 + Math.floor(rnd() * 3); for (let j = 0; j < nops; j++) { await op(i); await sleep(50 + rnd() * 500); } });
    await Promise.all(bursts);
    // sometimes a phone closes its tab and reopens (same device storage)
    if (rnd() < 0.3 && !process.env.NOREOPEN) {
      const i = 1 + Math.floor(rnd() * 4), D = devs[i];
      await D.page.evaluate(() => { if (typeof writePend === 'function') writePend(); }).catch(() => {});
      await D.page.close({ runBeforeUnload: false });
      const p = await D.ctx.newPage(); p.on('pageerror', e => D.dev.errors.push(String(e)));
      await require('./tsrv').attach(p, S, D.dev);
      await p.goto('https://wpf.test/?view=' + NAMES[i]).catch(() => {});
      await p.waitForFunction(() => typeof loadDB === 'function', null, { timeout: 10000 }).catch(() => {});
      D.page = p;
    }
    await sleep(800 + rnd() * 1500);
  }
  // settle: everyone online, retry until all saved
  devs.forEach(D => { D.dev.offline = false; D.dev.failRate = 0; D.dev.dropReply = 0; D.dev.latency = [5, 50]; });
  for (let pass = 0; pass < 6; pass++) {
    for (const D of devs) await D.page.evaluate(async () => { if (!DB.loaded) await loadDB(); await saveDB(); }).catch(() => {});
    for (const D of devs) await D.page.evaluate(() => loadDB()).catch(() => {});
  }
  const views = [];
  for (const D of devs) views.push(await D.page.evaluate(() => ({ unsaved: !same(snap(), BASE), failed: !!DB.saveFailed, loaded: DB.loaded, plan: JSON.stringify(noWB(snap())), wos: DB.orders.map(o => o.wo), notes: Object.fromEntries(DB.orders.map(o => [o.wo, o.notes])), ticks: Object.keys((DB.listRow || {}).L || {}), caps: DB.weekCaps || {} })));
  const srv = { wos: S.row.orders.map(o => o.wo), notes: Object.fromEntries(S.row.orders.map(o => [o.wo, o.notes])), ticks: Object.keys(S.row.settings.listRow.L || {}), caps: S.row.settings.weekCaps || {} };
  views.forEach((v, i) => rec(NAMES[i] + ' settled (loaded, nothing unsaved)', v.loaded && !v.unsaved && !v.failed, JSON.stringify({ l: v.loaded, u: v.unsaved, f: v.failed })));
  rec('every device has the identical plan', views.every(v => v.plan === views[0].plan), views.map(v => v.plan.length).join(','));
  const dup = srv.wos.filter((w, i) => srv.wos.indexOf(w) !== i);
  rec('no duplicated jobs', !dup.length, dup.join(','));
  const lostNotes = Object.entries(exp.notes).filter(([wo, t]) => srv.notes[wo] !== t).map(([wo, t]) => wo + ' want ' + t + ' got ' + srv.notes[wo]);
  rec('every notes edit survived (last per job)', !lostNotes.length, lostNotes.join('; '));
  if (lostNotes.length) { const ws = lostNotes.map(x => x.split(' ')[0]); console.log('--- TRACE (server writes, lost WOs only)'); TR.forEach(l => { const parts = l.split(' :: '); console.log(parts[0] + ' :: ' + parts[1].split(',').filter(p => ws.includes(p.split('=')[0])).join(',')); }); console.log('--- office console'); CON.filter(c => / office: /.test(c)).forEach(c => console.log(c)); }
  const lostTicks = [...exp.ticks].filter(t => !srv.ticks.includes(t)); rec('every tick survived', !lostTicks.length, lostTicks.join(','));
  const zombie = [...exp.unticked].filter(t => srv.ticks.includes(t)); rec('every untick survived', !zombie.length, zombie.join(','));
  const lostAdd = [...exp.added].filter(w => !srv.wos.includes(w)); rec('every added job present', !lostAdd.length, lostAdd.join(','));
  const zDel = [...exp.deleted].filter(w => srv.wos.includes(w)); rec('every deleted job gone', !zDel.length, zDel.join(','));
  const lostCap = Object.keys(exp.caps).filter(c => srv.caps[c] !== exp.caps[c]); rec('every settings edit survived', !lostCap.length, lostCap.join(','));
  const errs = devs.flatMap(D => D.dev.errors); rec('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  for (const t of lostTicks) { const h = S.hist; for (let i = 1; i < h.length; i++) if (h[i - 1].ticks.includes(t) && !h[i].ticks.includes(t)) console.log('  tick ' + t + ' removed by ' + h[i].who + ' writing v' + h[i].v + ' (' + h[i].url + ')'); }
  for (const t of zombie) { const h = S.hist; let st = false; const tl = []; h.forEach((x, i) => { const has = x.ticks.includes(t); if (has !== st) { tl.push((has ? '+' : '-') + ' by ' + x.who + ' v' + x.v); st = has; } }); console.log('  zombie ' + t + ' timeline: ' + tl.join(' | ')); }
  for (const t of Object.keys(exp.caps).filter(c => srv.caps[c] !== exp.caps[c])) { const h = S.hist; const first = h.findIndex(x => x.caps.includes(t)); console.log('  cap ' + t + ' first on server at idx ' + first); for (let i = 1; i < h.length; i++) if (h[i - 1].caps.includes(t) && !h[i].caps.includes(t)) console.log('  cap ' + t + ' removed by ' + h[i].who + ' v' + h[i].v); }
  for (const D of devs) { const l = await D.page.evaluate(() => window.__lost || []).catch(() => []); l.filter(x => lostTicks.some(t => x.startsWith(t + ' '))).forEach(x => console.log('  ' + D.dev.name + ' local drop: ' + x)); }
  console.log('ops skipped on never-loaded (blocked) tabs: ' + skipped);
  console.log('server: patches=' + S.patches + ' ok=' + S.okSaves + ' conflicts=' + S.conflicts + ' version=' + S.row.version + ' ops=' + k);
  for (const D of devs) await D.close(); await browser.close();
  console.log(res.filter(x => !x).length + ' failed of ' + res.length);
})().catch(e => { console.error(e); process.exit(1); });
