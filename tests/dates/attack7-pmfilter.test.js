// Tester attack 7: Project Managers page filters (A13) — try to break them. Stubbed Supabase only (tests/harness.js).
// Run: node tests/dates/attack7-pmfilter.test.js
const H = require('../harness');
const res = []; const rec = (n, ok, d) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? '  -> ' + String(d).replace(/\s+/g, ' ').slice(0, 400) : '')); };
const O = (wo, x) => H.order(Object.assign({ wo, dueDate: '2026-11-20', origDueDate: '2026-11-20', plannedWeek: '2026-11-16', step: '4. Ready', delv: false, customer: 'ASPECT', title: 'Kitchen Type 2R', floor: 'T09', unit: '1', value: 1000 }, x));
const VAN = { delv: true, delVeh: 'VOLVO', delDay: 'Fri', delWk: '2026-11-09' }; // Fri 13 Nov = tomorrow → site check due
const ARC = (wo, c, f, u, t, vAt) => ({ wo, c, f, u, t, vAt: vAt === undefined ? '2026-11-05T10:00:00Z' : vAt, vBy: 'Pat' });

const PRE = `const w=ms=>new Promise(r=>setTimeout(r,ms));
  const wos=()=>[...document.querySelectorAll('.dsh-row b')].map(b=>b.textContent).sort();
  const opts=id=>[...document.querySelectorAll('#'+id+' option')].map(o=>o.value+'='+o.textContent);
  const pick=async(id,v)=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('change'));await w(100);};
  const typ=async(v,ms)=>{const q=document.getElementById('pm-q');q.focus();q.value=v;q.dispatchEvent(new Event('input'));await w(ms==null?400:ms);};
  const pm=async(f)=>{localStorage.setItem('wpfPmF',JSON.stringify(f||{}));localStorage.setItem('wpfPin_pm','9000');ROLE='pm';renderPM._qv=null;renderPM._qf=0;render();await w(120);};`;

(async () => {
  const browser = await H.chromium.launch();
  const row = { id: 'main', nid: 9, settings: { delArchive: {
    '2026-11-02': { jobs: [
      ARC('WO-OLD1', 'ASPECT', 'GF', '3', 'Kitchen Type 2R'),
      ARC('WO-OLD2', 'ASPECT ', ' t09 ', '4', 'Kitchen Type 2R   '),        // trailing spaces on customer, floor, title
      ARC('WO-OLD3', 'ASPECT', 'B2', '8', 'Robe W2', null),                  // archived with no vAt
      ARC('WO-OLD4', 'Ó Súilleabháin Construction', 'Ground Floor Block C', '1', 'Kitchen (Type 2) [L] *.'),
    ] } } }, orders: [
    O('WO-A1', Object.assign({ floor: 'T09' }, VAN)),
    O('WO-A2', Object.assign({ floor: 'B2', unit: '2' }, VAN)),
    O('WO-A3', Object.assign({ floor: 'B2', unit: '3', title: 'Robe W2' }, VAN)),
    O('WO-A4', { floor: 'G/F', unit: '5' }),
    O('WO-A5', { floor: '1st', unit: '6', title: 'Kitchen Type 1L' }),
    O('WO-A6', { floor: 'Gnd Flr', unit: '7' }),
    O('WO-A7', { floor: 'T09 ', unit: '8', title: 'kitchen type 2r ' }),
    O('WO-OVER', { floor: 'Z9', unit: '1', title: 'Overdue Only Title', dueDate: '2026-11-01' }),  // overdue, not on a van
    O('WO-B1', { customer: 'BALLYMORE HOMES', floor: 'B2', unit: '7', title: 'Robe W2' }),
  ] };

  const t = await H.open({ browser, now: '2026-11-12T10:00:00Z', row, viewport: { width: 1366, height: 900 } });
  const p = t.page;
  const ev = f => p.evaluate(`(async()=>{${PRE}\n${f}})()`);

  // 1. Site ready for all N with a filter on: does it confirm only what is shown?
  const S = await ev(`await pm({fl:'T09'});
    const b=document.querySelector('[data-sitecust]');const lbl=b?b.textContent:'(no button)';
    let msg='';const rc=window.confirm;window.confirm=m=>{msg=m;return true;};
    if(b)b.click();await w(200);window.confirm=rc;
    const ok=DB.orders.filter(o=>o.siteOk).map(o=>o.wo).sort();
    DB.orders.forEach(o=>delete o.siteOk);return {lbl,msg,ok,shown:wos()};`);
  rec('Site ready for all N: button count matches what is shown (T09 filter)', /all 1\b/.test(S.lbl), S.lbl);
  rec('Site ready for all N: only the shown job is confirmed, not hidden B2 jobs of the same customer', JSON.stringify(S.ok) === '["WO-A1"]', 'confirmed ' + JSON.stringify(S.ok) + ' · dialog "' + S.msg + '"');

  // 2. Archive jobs ({c,f,u,t}) vs live
  const A = await ev(`await pm({});const r={all:wos(),k:opts('pm-cust'),f:opts('pm-floor'),t:opts('pm-title')};
    await pick('pm-cust','c:aspect');r.asp=wos();r.heads=[...document.querySelectorAll('.dsh-ph')].map(h=>h.textContent.split(' — ')[0]);
    await pm({ti:'KITCHEN TYPE 2R'});r.ti=wos();
    await pm({fl:'B2'});r.b2=wos();r.b2opt=opts('pm-floor').find(x=>x.startsWith('B2='));return r;`);
  rec('archive job with trailing spaces in title merges into one title entry', A.t.filter(x => x.startsWith('KITCHEN TYPE 2R=')).length === 1, JSON.stringify(A.t));
  rec('archive job with trailing-space customer "ASPECT " is in the ASPECT pick', A.asp.includes('WO-OLD2'), JSON.stringify(A.asp));
  rec('ASPECT pick shows ONE customer heading (not "ASPECT" and "ASPECT " twice)', A.heads.length === 1, JSON.stringify(A.heads));
  rec('archive " t09 " and live "T09 " are the T09 floor', A.f.filter(x => /^T09=/.test(x)).length === 1, JSON.stringify(A.f));
  rec('dropdown count = rows shown (B2: archived job with no delivery time)', A.b2opt && +(A.b2opt.match(/\((\d+)\)$/) || [])[1] === A.b2.length, A.b2opt + ' vs shown ' + JSON.stringify(A.b2));

  // 3. Floor spellings
  const fl = A.f.map(x => x.split('=')[0]);
  rec('"G/F" counts as Ground', !fl.includes('G/F'), JSON.stringify(fl));
  rec('"Gnd Flr" counts as Ground', !fl.includes('GND FLR'), JSON.stringify(fl));
  rec('"Ground Floor Block C" is its own block entry (not merged into Ground)', fl.includes('GROUND FLOOR BLOCK C'), JSON.stringify(fl));
  rec('"1st" offered as a floor', fl.includes('1ST'), JSON.stringify(fl));

  // 4. Search: regex characters, fadas, case, multi-word, the joiner
  const Q = await ev(`await pm({});const r={};
    for(const s of ['(type 2)','[l]','*','.','SÚIL','súil','suil','kitchen  TYPE   1l','t09 kitchen','|','wo-a1 '])
      {await typ(s);r[s]=wos();}
    return r;`);
  rec('search "(type 2)" (regex chars) finds the archive job', JSON.stringify(Q['(type 2)']) === '["WO-OLD4"]', JSON.stringify(Q['(type 2)']));
  rec('search "[l]" literal', JSON.stringify(Q['[l]']) === '["WO-OLD4"]', JSON.stringify(Q['[l]']));
  rec('search "*" literal', JSON.stringify(Q['*']) === '["WO-OLD4"]', JSON.stringify(Q['*']));
  rec('search "SÚIL" (fada, upper case) finds Ó Súilleabháin', JSON.stringify(Q['SÚIL']) === '["WO-OLD4"]', JSON.stringify(Q['SÚIL']));
  rec('search "suil" (no fada) finds Ó Súilleabháin', JSON.stringify(Q['suil']) === '["WO-OLD4"]', JSON.stringify(Q['suil']));
  rec('search ignores case and extra spaces', JSON.stringify(Q['kitchen  TYPE   1l']) === '["WO-A5"]', JSON.stringify(Q['kitchen  TYPE   1l']));
  rec('search with two words from different fields ("t09 kitchen")', Q['t09 kitchen'].length > 0, JSON.stringify(Q['t09 kitchen']));
  rec('search "|" does not match every job', Q['|'].length === 0, Q['|'].length + ' jobs');
  rec('search trailing space "wo-a1 "', JSON.stringify(Q['wo-a1 ']) === '["WO-A1"]', JSON.stringify(Q['wo-a1 ']));

  // 5. Floor then a project with no such floor (kept "(0)" entries), and a title that leads nowhere
  const K = await ev(`await pm({k:'c:ballymore homes',kl:'BALLYMORE HOMES',fl:'GROUND',ti:'KITCHEN TYPE 1L'});
    const r={none:(document.querySelector('.flr-none')||{}).textContent||'',f:opts('pm-floor').find(x=>x.startsWith('GROUND=')),t:opts('pm-title').find(x=>x.startsWith('KITCHEN TYPE 1L='))};
    await pick('pm-floor','');r.after=wos();
    // a title picked from the drop-down, then the data / project changes so it matches nothing: label keeps its real case
    await pm({});await pick('pm-title','KITCHEN TYPE 1L');{const f=JSON.parse(localStorage.getItem('wpfPmF'));f.k='c:ballymore homes';f.kl='BALLYMORE HOMES';localStorage.setItem('wpfPmF',JSON.stringify(f));render();await w(120);}
    r.t=opts('pm-title').find(x=>x.startsWith('KITCHEN TYPE 1L='));
    await pm({});r.ot=opts('pm-title').find(x=>x.startsWith('OVERDUE'));await pick('pm-title','OVERDUE ONLY TITLE');r.over=(document.querySelector('.flr-none')||{}).textContent||wos().join(',');
    await pm({});await typ('WO-OVER');r.overS=(document.querySelector('.flr-none')||{}).textContent||wos().join(',');
    await pm({});return r;`);
  rec('impossible saved combination → "Nothing matches" with Clear', /Nothing matches/.test(K.none), K.none);
  rec('kept floor entry keeps its friendly name "Ground (GF / 0) (0)"', /^GROUND=Ground \(GF \/ 0\) \(0\)$/.test(K.f || ''), K.f);
  rec('kept title entry keeps its real case "Kitchen Type 1L (0)"', /^KITCHEN TYPE 1L=Kitchen Type 1L \(0\)$/.test(K.t || ''), K.t);
  rec('a title only on jobs this page can\'t list (overdue, not on a van) is not offered', !K.ot, 'offered "' + K.ot + '"');
  rec('searching an overdue unbooked WO says it matches but is not on this page', /1 job matches but is not on this page/.test(K.overS) && /Capacity Board/.test(K.overS), K.overS);

  // 6. Typing + refresh races
  const T = await ev(`await pm({});const r={};const q=()=>document.getElementById('pm-q');
    q().focus();q().value='w';q().dispatchEvent(new Event('input'));await w(100);render();await w(10);
    q().value=q().value+'o-a';q().dispatchEvent(new Event('input'));await w(100);render();await w(10);
    q().value=q().value+'1';q().dispatchEvent(new Event('input'));await w(450);r.typed=q().value;r.rows=wos();r.foc=document.activeElement.id;
    // clear the box
    q().value='';q().dispatchEvent(new Event('input'));await w(400);r.clr=wos().length;r.clrSaved=JSON.parse(localStorage.getItem('wpfPmF')).q;
    // cursor in the middle of the text, then a refresh
    q().focus();q().value='WO-A1';q().dispatchEvent(new Event('input'));q().setSelectionRange(2,2);render();await w(10);r.caret=q().selectionStart;
    // type then leave the box within the 0.25 s pause: does it steal focus back?
    await pm({});q().focus();q().value='b2';q().dispatchEvent(new Event('input'));await w(60);document.getElementById('pm-floor').focus();await w(400);r.steal=document.activeElement.id;
    // type then press ✕ Clear filters within the pause
    await pm({fl:'T09'});q().focus();q().value='zz';q().dispatchEvent(new Event('input'));await w(60);document.getElementById('pm-clear').click();await w(400);
    r.afterClear=JSON.parse(localStorage.getItem('wpfPmF')).q;r.afterClearBox=q().value;
    // focus kept → the 2-minute auto-refresh skips while a box has focus
    // the viewTimer rule (~line 1534): skip if a box has focus, except an idle #pm-q (no pending 0.25 s search)
    const skip=()=>{const ae=document.activeElement;return !!(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)&&!(ae.id==='pm-q'&&!renderPM._qt));};
    await pm({});q().focus();q().value='asp';q().dispatchEvent(new Event('input'));await w(60);r.skipPending=skip();
    await w(400);r.autoSkip=skip();q().setSelectionRange(1,2);render();await w(10);r.idleRedraw=q().value+':'+q().selectionStart+'-'+q().selectionEnd+':'+document.activeElement.id;
    // leave the page within the pause, come back: focus should not jump into the box
    await pm({});q().focus();q().value='x';q().dispatchEvent(new Event('input'));await w(60);ROLE='office';render();await w(400);
    ROLE='pm';render();await w(100);r.back=document.activeElement&&document.activeElement.id;
    await pm({});return r;`);
  rec('type / refresh / type more: text and result right', T.typed === 'wo-a1' && JSON.stringify(T.rows) === '["WO-A1"]' && T.foc === 'pm-q', JSON.stringify(T));
  rec('clearing the box shows everything and forgets the search', T.clr === 11 && T.clrSaved === '', T.clr + ' rows, saved q=' + JSON.stringify(T.clrSaved));
  rec('a refresh keeps the cursor where it was (middle of the text)', T.caret === 2, 'caret ' + T.caret);
  rec('leaving the box within 0.25 s: focus is NOT pulled back into it', T.steal === 'pm-floor', 'focus on ' + T.steal);
  rec('✕ Clear filters pressed within 0.25 s of typing really clears the search', !T.afterClear && !T.afterClearBox, 'saved q=' + JSON.stringify(T.afterClear) + ' box=' + JSON.stringify(T.afterClearBox));
  rec('auto-refresh: skipped while a search is pending, runs once the box is idle, and the redraw keeps text + selection', T.skipPending && !T.autoSkip && T.idleRedraw === 'asp:1-2:pm-q', JSON.stringify({ p: T.skipPending, s: T.autoSkip, r: T.idleRedraw }));
  rec('leaving the page mid-typing and coming back: focus not forced into the search box', T.back !== 'pm-q', 'focus on ' + T.back);

  // 7. Old / odd archive data
  const D = await ev(`const keep=JSON.stringify(DB.delArchive);const r={};
    DB.delArchive['2026-10-26']={at:'x'};try{await pm({});r.noJobs=document.querySelectorAll('.dsh-row').length;}catch(e){r.noJobs='ERR '+e.message;}
    DB.delArchive['2026-10-19']=null;try{await pm({});r.nul=document.querySelectorAll('.dsh-row').length;}catch(e){r.nul='ERR '+e.message;}
    DB.delArchive=JSON.parse(keep);DB.delArchive['2026-10-12']={jobs:[{wo:'WO-N',c:'ASPECT',f:0,u:12,t:null,vAt:'2026-10-14T09:00:00Z'}]};
    try{await pm({fl:'GROUND'});r.num=wos();}catch(e){r.num='ERR '+e.message;}
    DB.delArchive=JSON.parse(keep);await pm({});return r;`);
  rec('archive week with no jobs list (old data) does not break the page', typeof D.noJobs === 'number' && D.noJobs > 0, D.noJobs);
  rec('archive week that is null does not break the page', typeof D.nul === 'number' && D.nul > 0, D.nul);
  rec('archive floor stored as number 0 = Ground, unit as number', Array.isArray(D.num) && D.num.includes('WO-N'), JSON.stringify(D.num));
  await t.close();

  // 8. Phone 360 px with long names
  const longRow = JSON.parse(JSON.stringify(row));
  longRow.orders.push(O('WO-LONG', { customer: 'AVERYLONGCUSTOMERNAMEWITHNOSPACESATALL_DEVELOPMENTS_LIMITED_PHASE_TWO_BLOCK_C', floor: 'GROUNDFLOORBLOCKCPHASE2NORTHWINGEXTENSION', title: 'Kitchen Type 2R with island and extra tall larder units handed left and right' }));
  const t2 = await H.open({ browser, now: '2026-11-12T10:00:00Z', row: longRow, viewport: { width: 360, height: 780 } });
  const P = await t2.page.evaluate(`(async()=>{${PRE}\nawait pm({});const r={};r.ov0=document.documentElement.scrollWidth;
    await pm({fl:'GROUNDFLOORBLOCKCPHASE2NORTHWINGEXTENSION'});r.ov1=document.documentElement.scrollWidth;
    const bar=document.getElementById('pmf').getBoundingClientRect();r.bar=Math.round(bar.right);
    r.q=Math.round(document.getElementById('pm-q').getBoundingClientRect().width);r.iw=innerWidth;return r;})()`);
  rec('360 px: no sideways scroll, no filter', P.ov0 <= P.iw + 1, JSON.stringify(P));
  rec('360 px: no sideways scroll, long floor picked', P.ov1 <= P.iw + 1 && P.bar <= P.iw, JSON.stringify(P));
  await t2.close();

  // 9. 1,000 live jobs + 2,000 archived: redraw time per keystroke
  const big = { id: 'main', nid: 9, settings: { delArchive: {} }, orders: [] };
  const custs = Array.from({ length: 80 }, (_, i) => 'Customer ' + i + (i % 7 ? '' : ' Ó Dálaigh'));
  for (let i = 0; i < 1000; i++) big.orders.push(O('WO-' + (10000 + i), Object.assign({ customer: custs[i % 80], floor: ['GF', 'T0' + (i % 9), 'B' + (i % 5), '1st'][i % 4], unit: String(i % 60), title: 'Kitchen Type ' + (i % 30), dueDate: '2026-11-' + String(13 + (i % 15)).padStart(2, '0') }, i % 5 ? {} : VAN)));
  for (let wk = 0; wk < 26; wk++) { const k = 'W' + String(wk).padStart(2, '0'); big.settings.delArchive[k] = { jobs: [] };
    for (let j = 0; j < 77; j++) { const n = wk * 77 + j; big.settings.delArchive[k].jobs.push(ARC('WO-' + (50000 + n), custs[n % 80], 'T0' + (n % 9), String(n % 60), 'Kitchen Type ' + (n % 30), '2026-0' + (1 + (wk % 9)) + '-10T10:00:00Z')); } }
  const t3 = await H.open({ browser, now: '2026-11-12T10:00:00Z', row: big, viewport: { width: 1366, height: 900 } });
  const B = await t3.page.evaluate(`(async()=>{${PRE}\nawait pm({});const app=document.getElementById('app');const tm=f=>{const a=performance.now();f();return Math.round(performance.now()-a);};
    const r={arc:Object.values(DB.delArchive).reduce((s,a)=>s+a.jobs.length,0),live:DB.orders.length};
    r.none=Math.max(tm(()=>renderPM(app)),tm(()=>renderPM(app)));
    const seq=['k','ki','kit','kitchen type 1'];r.keys=[];
    for(const s of seq){const f=JSON.parse(localStorage.getItem('wpfPmF')||'{}');f.q=s;localStorage.setItem('wpfPmF',JSON.stringify(f));r.keys.push(tm(()=>renderPM(app)));}
    localStorage.setItem('wpfPmF','{"fl":"T03"}');r.floor=tm(()=>renderPM(app));
    r.rows=document.querySelectorAll('.dsh-row').length;localStorage.removeItem('wpfPmF');return r;})()`);
  const worst = Math.max(B.none, ...B.keys, B.floor);
  rec('1,000 live + 2,000 archived: each redraw under 500 ms (busy 2-CPU test box)', worst < 500, JSON.stringify(B));
  rec('no page errors', ![t, t2, t3].some(x => (x.server.errors || []).length), [t, t2, t3].flatMap(x => x.server.errors || []).join(' | '));
  rec('nothing about the filters saved to the database', ![t, t2, t3].some(x => x.server.patches.some(b => JSON.stringify(b).includes('wpfPmF'))));
  await t3.close();
  await browser.close();
  const f = res.filter(x => !x).length;
  console.log('\n' + (res.length - f) + '/' + res.length + ' passed');
  process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
