// ATTACK 3 — working-day edge cases (7289a39: Christmas / New Year / Easter Monday 2027), snag lists fittings-only and
// all-not-needed (f654e5c), material rename / alias collisions (f3f9723), template archive PIN (b7b9db1).
// Fake Supabase only (srv3.js). Run: node tests/stage3/attack3-misc.test.js
const A = require('./atk.js');
const { F, H, D, rec } = A;
async function at(browser, now, dues) {
  const row = F.v2Row(); row.orders = dues.map(([wo, due]) => H.order({ wo, customer: 'Aderrig Homes', dueDate: due, origDueDate: due }));
  const S = F.makeServer(row);
  dues.forEach(([wo, due, withList]) => { if (withList) F.seedList(S, 'L' + wo, { wos: [wo] }); });
  const t = await F.dev(browser, S, 'saw', { now });
  await t.page.evaluate(() => { sawWaitOpen = true; render(); }); // 3 Nov flow: the amber "waiting for a list" line opens on a tap
  return { S, t };
}
const info = (p, wos) => p.evaluate(wos => wos.map(w => {
  const l = lists().find(x => (x.wos || []).includes(w)), row = document.querySelector('[data-waitwo="' + w + '"]');
  return { wo: w, today: todayLocal(), cutBy: listDeadline({ wos: [w] }), locked: l ? lsLocked(l) : null, onSawToday: l ? dueToday(l, todayLocal()) : null,
    strip: row ? row.innerText.replace(/\s+/g, ' ') : null, late: row ? /OVERDUE/.test(row.innerText) : null };
}), wos);
(async () => {
  const browser = await H.chromium.launch();
  // ---- Christmas Eve 2026 (Thu 24 Dec). 25 + 28 Dec holidays. Wed 30 delivery → cut Tue 29 = next working day → locked
  {
    const { t } = await at(browser, '2026-12-24T09:00:00Z', [['W30', '2026-12-30', true], ['T31', '2026-12-31', true], ['N30', '2026-12-30', false], ['N04', '2027-01-04', false], ['N05', '2027-01-05', false]]);
    const [w30, t31, n30, n04, n05] = await info(t.page, ['W30', 'T31', 'N30', 'N04', 'N05']);
    rec('X1 24 Dec: 30 Dec delivery (cut Tue 29, next working day) locked; 31 Dec delivery not', w30.locked === true && t31.locked === false, JSON.stringify([w30, t31]));
    rec('X2 24 Dec: 30 Dec job with no list — due by 24 Dec, not overdue', !!n30.strip && /list due by 24 Dec 26/.test(n30.strip) && !n30.late, JSON.stringify(n30));
    rec('X3 24 Dec: 4 Jan job (cut Sun 3 → Thu 31 Dec) on the strip, list due by Wed 30 Dec', !!n04.strip && /list due by 30 Dec 26/.test(n04.strip), JSON.stringify(n04));
    rec('X4 24 Dec: 5 Jan job (lead = 5 working days → 29,30,31,4,5) is on the strip, due by Thu 31 Dec', !!n05.strip && /list due by 31 Dec 26/.test(n05.strip), JSON.stringify(n05));
    await t.close();
  }
  // ---- New Year's Eve 2026 (Thu 31 Dec): Mon 4 Jan delivery → saw cuts TODAY → locked; no-list job is overdue
  {
    const { t } = await at(browser, '2026-12-31T09:00:00Z', [['M04', '2027-01-04', true], ['S02', '2027-01-02', true], ['NM04', '2027-01-04', false]]);
    const [m04, s02, nm04] = await info(t.page, ['M04', 'S02', 'NM04']);
    rec('Y1 31 Dec: Mon 4 Jan delivery is on today\'s saw and locked; Sat 2 Jan delivery (cut Fri 1 Jan holiday) also today', m04.locked && m04.onSawToday && s02.locked && s02.onSawToday, JSON.stringify([m04, s02]));
    rec('Y2 31 Dec: 4 Jan job with no list is OVERDUE (list was due 30 Dec)', !!nm04.strip && nm04.late === true && /list due by 30 Dec 26/.test(nm04.strip), JSON.stringify(nm04));
    await t.close();
  }
  // ---- Easter 2027: Mon 29 Mar is a holiday. Thursday 25 Mar.
  {
    const { t } = await at(browser, '2027-03-25T09:00:00Z', [['E30', '2027-03-30', true], ['E31', '2027-03-31', true], ['NE30', '2027-03-30', false], ['NE31', '2027-03-31', false]]);
    const [e30, e31, ne30, ne31] = await info(t.page, ['E30', 'E31', 'NE30', 'NE31']);
    rec('Z1 Thu 25 Mar 2027: Tue 30 Mar delivery (cut-by Easter Monday → Fri 26) locked; Wed 31 delivery (cut Tue 30) not', e30.locked === true && e31.locked === false, JSON.stringify([e30, e31]));
    rec('Z2 Thu 25 Mar: 30 Mar no-list job due by 25 Mar (today, not overdue); 31 Mar job due by Fri 26 Mar', !!ne30.strip && /list due by 25 Mar 27/.test(ne30.strip) && !ne30.late && !!ne31.strip && /list due by 26 Mar 27/.test(ne31.strip), JSON.stringify([ne30, ne31]));
    await t.close();
  }
  // ---- Easter Tuesday 2027 (Tue 30 Mar): 31 Mar delivery cut today; Fri 26 strip item now overdue
  {
    const { t } = await at(browser, '2027-03-30T08:30:00Z', [['E31', '2027-03-31', true], ['NE31', '2027-03-31', false], ['NA01', '2027-04-01', false]]);
    const [e31, ne31, na01] = await info(t.page, ['E31', 'NE31', 'NA01']);
    rec('Z3 Tue 30 Mar: 31 Mar list on today\'s saw; no-list 31 Mar job overdue (was due Fri 26); 1 Apr job due today', e31.onSawToday && e31.locked && ne31.late === true && !!na01.strip && /list due by 30 Mar 27/.test(na01.strip) && !na01.late, JSON.stringify([e31, ne31, na01]));
    await t.close();
  }
  // ---- strip order: jobs listed by "list due by" (the .sort in waitListHTML sits inside a // comment since 7289a39)
  {
    const { t } = await at(browser, '2026-10-21T09:00:00Z', [['LATE', '2026-10-27', false], ['SOON', '2026-10-23', false]]);
    const ord = await t.page.evaluate(() => [...document.querySelectorAll('[data-waitwo]')].map(e => e.dataset.waitwo).join(','));
    rec('O1 waiting strip is in "list due by" order', ord === 'SOON,LATE', ord + ' (works only because listsNeeded already sorts by delivery date)');
    await t.close();
  }
  // ---- snag lists: fittings-only, mixed with only stores signed, all lines not-needed, No-fittings ticked on a fittings-only list
  {
    const S = F.makeServer(F.v2Row());
    const SNAG = { list_type: 'snag', source: 'manual', deliver_by: '2026-10-23' };
    F.seedList(S, 'SF', { wos: [], lines: [['fit', 'Hinge', '2', null, null, 'Blum hinge']], list: Object.assign({ fit_done_at: '2026-10-21T10:00:00Z', fit_done_by: 'Cara' }, SNAG) });
    F.seedList(S, 'SM', { wos: [], lines: [['saw', 'Door', '1', 700, 400, 'MFC White'], ['fit', 'Hinge', '2', null, null, 'Blum hinge']], list: Object.assign({ fit_done_at: '2026-10-21T10:00:00Z' }, SNAG) });
    F.seedList(S, 'SN', { wos: [], lines: [['saw', 'Door', '1', 700, 400, 'MFC White', '', '', { status: 'na' }]], list: SNAG });
    F.seedList(S, 'SX', { wos: [], lines: [['fit', 'Hinge', '2', null, null, 'Blum hinge']], list: Object.assign({ no_fit: true }, SNAG) });
    const pr = await F.dev(browser, S, 'prod');
    const st = await pr.page.evaluate(() => ['SF', 'SM', 'SN', 'SX'].map(id => { const l = lsList(id); return id + ':' + lsState(l) + ':' + listFinished(l); }));
    rec('S1 fittings-only snag list signed off by stores counts as Done', /SF:done:true/.test(st[0]), st.join(' '));
    rec('S2 saw+fittings snag list with only stores signed is NOT done', /SM:\w+:false/.test(st[1]) && !/SM:done/.test(st[1]), st[1]);
    rec('S3 (info) snag list whose only line is "not needed": finished?', true, st[2] + (/false/.test(st[2]) ? ' — never counts done, stays on lists home as live/draft' : ''));
    rec('S4 (info) fittings-only snag list with "No fittings" ticked: finished?', true, st[3] + (/false/.test(st[3]) ? ' — never counts done' : ''));
    // on the saw: a fittings-only snag list must not appear in the saw queue
    const saw = await F.dev(browser, S, 'saw');
    const onSaw = await saw.page.evaluate(() => { wlShowUpcoming = true; render(); return ['SF', 'SX'].filter(id => !!document.querySelector('[data-wldone="' + id + '"]')); });
    rec('S5 fittings-only snag lists are not on the saw queue', !onSaw.length, JSON.stringify(onSaw));
    await pr.close(); await saw.close();
  }
  // ---- materials: rename keeps old name as alias; then "Add" a NEW material with the old name; editor view of old lines
  {
    const S = F.makeServer(F.v2Row()); F.seedList(S, 'L1', { list: { source: 'manual' } });
    D.insert(S.db, 'project_materials', { id: 'M3', project_id: 'P1', name: 'Egger W980', kind: 'sheet', aliases: ['White board'] });
    const pr = await F.dev(browser, S, 'prod');
    const ren = async (id, name, aliases) => pr.page.evaluate(async ({ id, name, aliases }) => {
      document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsMaterialsDlg('P1');
      const n = document.querySelector('[data-mtn="' + id + '"]'); n.value = name; if (aliases != null) document.querySelector('[data-mta="' + id + '"]').value = aliases;
      document.querySelector('[data-mts="' + id + '"]').click(); await new Promise(r => setTimeout(r, 500));
      return (document.getElementById('mt-msg') || {}).textContent || '';
    }, { id, name, aliases });
    const m1 = await ren('M1', 'MFC White 18mm');
    const r1 = D.find(S.db, 'project_materials', 'M1');
    rec('A1 rename MFC White → MFC White 18mm keeps "MFC White" as an alias', r1.name === 'MFC White 18mm' && (r1.aliases || []).includes('MFC White'), m1 + ' ' + JSON.stringify(r1.aliases));
    const add = await pr.page.evaluate(async () => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); lsMaterialsDlg('P1'); document.getElementById('mt-new-n').value = 'MFC White'; document.getElementById('mt-add').click(); await new Promise(r => setTimeout(r, 500)); return (document.getElementById('mt-msg') || {}).textContent || ''; });
    const both = S.db.t.project_materials.filter(m => m.project_id === 'P1' && (m.name === 'MFC White' || (m.aliases || []).includes('MFC White'))).map(m => m.id + ':' + m.name);
    rec('A2 a NEW material named "MFC White" (already an alias of the renamed board) is refused or flagged', both.length === 1, 'msg=' + JSON.stringify(add) + ' materials answering to "MFC White": ' + both.join(', ') + ' (lsMaterialsDlg dup() checks names only, not aliases)');
    const m2 = await ren('M1', 'White board');
    const r2 = D.find(S.db, 'project_materials', 'M1');
    rec('A3 rename to another material\'s alias ("White board" is an alias of Egger W980) is refused', r2.name !== 'White board', 'msg=' + JSON.stringify(m2) + ' M1 now=' + r2.name);
    // editor: existing lines still say "MFC White" (alias) — shown as a proper match or as "not on the project list"?
    const ed = await pr.page.evaluate(() => { document.querySelectorAll('.pod-ovl').forEach(o => o.remove()); openListEditor('L1'); const s = document.querySelector('[data-mr="0|mat"]'); return s ? s.options[s.selectedIndex].text : null; });
    rec('A4 (info) editor on a line whose board was renamed: what the material box shows', true, JSON.stringify(ed) + (/not on the project list/.test(ed || '') ? ' — shown as ⚠ not on the project list though the alias matches' : ''));
    await pr.close();
  }
  await browser.close(); A.done();
})().catch(e => { console.error(e); process.exit(1); });
