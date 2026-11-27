// sn26 (Garry 26 Nov): "the sequence always starts at 1 upwards and that place in the sequence follows the work order throughout
// planner. when the job is shipped it falls off the sequence table". Shipped rows leave the table and the numbering (kept in the
// database, listed under "Show shipped"); the job's number shows as a "#n" badge beside the work order on the other pages; moving
// a row still works with shipped rows hidden. Fake Supabase only. Run: node tests/seq/sn26-seq-numbers.test.js
const X = require('./fixs.js'); const { H, rec, sleep } = X;
const assign = (S, pid, pm) => X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', pid), { pms: [pm] });
const rowsOf = p => p.evaluate(() => [...document.querySelectorAll('.seq-tbl tr.seq-r')].map(tr => { const n = tr.querySelector('.seq-n'), b = tr.querySelector('td[data-l="WO"] b'); return (n ? n.textContent.trim() : '?') + ':' + (b ? b.textContent.trim() : '-'); }).join(' '));
(async () => {
  const browser = await H.chromium.launch();
  try {
    const S = X.makeServer(); assign(S, 'P1', 'John Burke');
    const pm = await X.dev(browser, S, 'pm', { me: { pm: 'John Burke' } }), p = pm.page;
    await p.evaluate(() => { pmTab = 'seq'; render(); }); await sleep(300);
    await p.evaluate(() => document.getElementById('seq-start').click()); await sleep(800);
    let rs = await rowsOf(p);
    rec('set-up: four rows numbered 1 to 4', /^1:WO-1 2:WO-2 3:WO-4 4:WO-3$/.test(rs), rs);
    const nos0 = await p.evaluate(() => ['WO-1', 'WO-2', 'WO-4', 'WO-3'].map(w => w + '=' + seqNoOf(w)).join(' '));
    rec('each work order knows its number (1 to 4)', nos0 === 'WO-1=1 WO-2=2 WO-4=3 WO-3=4', nos0);
    // WO-1 ships
    const dbRows0 = S.db.t.project_seq.length;
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); o.step = '9. JOB SHIPPED'; o.shippedAt = nowISO(); seqMapsDrop(); render(); }); await sleep(400);
    rs = await rowsOf(p);
    rec('WO-1 shipped → it drops off the table and the rest renumber from 1', rs === '1:WO-2 2:WO-4 3:WO-3', rs);
    const nos1 = await p.evaluate(() => ['WO-1', 'WO-2', 'WO-4', 'WO-3'].map(w => w + '=' + seqNoOf(w)).join(' '));
    rec('the numbers that follow the jobs: WO-2 is now 1, the shipped job has none', nos1 === 'WO-1=0 WO-2=1 WO-4=2 WO-3=3', nos1);
    const shp = await p.evaluate(() => { const d = document.getElementById('seq-shp'); return d ? { open: d.open, sum: d.querySelector('summary').textContent, txt: d.textContent.replace(/\s+/g, ' ') } : null; });
    rec('"Show shipped (1)" link at the foot, closed, listing WO-1', !!shp && !shp.open && /Show shipped \(1\)/.test(shp.sum) && /WO-1/.test(shp.txt), JSON.stringify(shp));
    rec('nothing deleted: the database still has every row, none marked removed', S.db.t.project_seq.length === dbRows0 && S.db.t.project_seq.every(r => r.state !== 'removed'), S.db.t.project_seq.map(r => r.wo + ':' + r.state).join());
    // the badge on other pages
    const off = await X.dev(browser, S, 'office'), q = off.page;
    await q.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); o.step = '9. JOB SHIPPED'; o.shippedAt = nowISO(); ['WO-2', 'WO-4'].forEach(w => { DB.orders.find(x => x.wo === w).delv = true; }); seqMapsDrop(); tab = 'b'; render(); }); await sleep(400);
    const board = await q.evaluate(() => ['WO-2', 'WO-4', 'WO-3'].map(w => { const tr = document.querySelector('tr[data-wo="' + w + '"]'), b = tr && tr.querySelector('.seq-b'); return w + ':' + (b ? b.textContent : '-'); }).join(' '));
    rec('Capacity Board: #1 on WO-2, #2 on WO-4, #3 on WO-3', board === 'WO-2:#1 WO-4:#2 WO-3:#3', board);
    await q.evaluate(() => { tab = 'd'; render(); }); await sleep(400);
    const del = await q.evaluate(() => ['WO-2', 'WO-4'].map(w => { const c = document.querySelector('.dchip[data-dw="' + w + '"]'), b = c && c.querySelector('.seq-b'); return w + ':' + (b ? b.textContent : c ? '-' : 'no card'); }).join(' '));
    rec('Deliveries cards: the same numbers (a card in another week tab is not on screen)', /^WO-2:(#1|no card) WO-4:(#2|no card)$/.test(del) && /#/.test(del), del);
    await q.evaluate(() => lsNewStd('WO-3')); await sleep(900);
    const hd = await q.evaluate(() => ((document.getElementById('me-hseq') || {}).textContent || '') + '|' + document.querySelectorAll('.me-tb .seq-b').length);
    rec('cutting list window header: #3 beside WO-3, once', hd === '#3|1', hd);
    await q.evaluate(() => document.querySelectorAll('.pod-ovl').forEach(x => x.remove()));
    // another project's jobs: their own numbering; a job in no sequence: no badge
    const other = await q.evaluate(() => { const o = DB.orders.find(x => !seqWoRow(x.wo) && !isShipped(x)); return o ? o.wo + ':' + seqNoOf(o.wo) + ':' + seqBadge(o) : 'none'; });
    rec('a job that is in no sequence shows no badge', other === 'none' || /:0:$/.test(other), other);
    // moving with a shipped row hidden: "move to position 1" puts WO-3 first among the LIVE rows
    await q.evaluate(async () => { sessionStorage.setItem('wpfWho', 'Ann Office'); await lsPoll(); const id = seqRows('P1').find(r => r.wo === 'WO-3').id; seqMoveReq('P1', id, { to: 1 }, () => {}); }); await sleep(600);
    await q.evaluate(() => { const b = document.querySelector('.pod-ovl [data-why]'); if (b) b.click(); }); await sleep(1500);
    await p.evaluate(async () => { await lsPoll(); seqMapsDrop(); render(); }); await sleep(500);
    rs = await rowsOf(p);
    rec('move WO-3 to position 1 (shipped row hidden): 1:WO-3 2:WO-2 3:WO-4', rs === '1:WO-3 2:WO-2 3:WO-4', rs + ' | ' + await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].map(o => o.innerText.slice(0, 120)).join(' / ')));
    // the upload's duplicate check still sees the shipped house (it is not added again)
    const dup = await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); const L = { floor: fuF(o), unit: fuU(o), product: 'K8', name: o.title, descr: '', kind: seqKind(o.title), line_no: 2, children: [], warn: [] }; const v = seqClaimPreview('P1', [L]); return { add: v.add.length, skip: v.skip.length, unsure: v.unsure.length }; });
    rec('an upload line for the SHIPPED house is still recognised (not added as a new row)', dup.add === 0, JSON.stringify(dup));
    // the shipped job comes back (step put back): it returns to the table at its old place
    await p.evaluate(() => { const o = DB.orders.find(x => x.wo === 'WO-1'); o.step = '7. ASSEMBLY COMPLETE'; delete o.shippedAt; seqMapsDrop(); render(); }); await sleep(400);
    rs = await rowsOf(p);
    rec('a job that is un-shipped comes back into the table (4 rows, numbered 1 to 4)', /^1:\S+ 2:\S+ 3:\S+ 4:\S+$/.test(rs) && /WO-1/.test(rs), rs);
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  await browser.close(); X.finish ? X.finish() : 0;
})();
