// Tester attack ROUND 2 (list window, 12 Nov) on the newest Coder commits:
//  F. phone finder "Use these rows": second press after Ctrl+Z, after a DIFFERENT old list, Cancel; 360 px with very long names
//  P. PM screen read-only list status: archived, finished, photo-only, no cutting / no fittings, a list on two WOs, escaping,
//     360 px with long titles, nothing on the PM screen opens a list
//  T. "⚠ 2 lists on WO-…" tag on the Cutting Lists page: archived, templates, Make-new-list-from-this pairs, one list carrying
//     the same WO twice — no false flags; a real pair IS flagged
//  O. lists switched OFF: the office and PM screens are the same text as origin/main (spot check)
// Fake Supabase only. Run: node tests/list-window/attack2-finder-pm-tag.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, setid, click, save, rows, liveFor } = L;
const LONG = 'Kitchen for the corner apartment with the extra-wide island and the larder unit beside the utility door — Phase 2 revision';
const EVIL = 'APT <img src=x onerror="window.__x=1"> O\'Grady "quoted" & co';
const seed = (S, id, wos, f, lines) => X.F3.seedList(S, id, Object.assign({ wos, name: (f && f.name) || ('List ' + id), list: f || {} }, lines ? { lines } : {}));

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ================= F. finder =================
    {
      const S = X.makeServer(X.v2Row());
      seed(S, 'LA', ['WO-2'], { name: LONG + ' A' }); seed(S, 'LB', ['WO-4'], { name: LONG + ' B' });
      for (const vp of [{ width: 1300, height: 900 }, { width: 360, height: 740 }]) {
        const t = await X.dev(browser, S, 'office', { viewport: vp }), p = t.page; await asks(p);
        await p.evaluate(async () => { lsReset(); await lsLoad(); window.__asked = []; window.__confirm = true; openListEditor(null, 'WO-3'); }); await sleep(900);
        const openF = async () => { await p.evaluate(() => { document.getElementById('me-start').open = true; document.getElementById('me-findold').click(); }); await sleep(600);
          await p.evaluate(() => { const c = document.getElementById('fo-all'); if (c && !c.checked) c.click(); }); await sleep(300); };
        const use = id => p.evaluate(id => { const b = document.querySelector('[data-foc="' + id + '"]'); if (!b) return 'no button'; b.click(); return 'ok'; }, id);
        await openF();
        if (vp.width === 360) {
          const g = await p.evaluate(() => [...document.querySelectorAll('[data-foc]')].slice(0, 3).map(b => { const r = b.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), t: Math.round(r.top), vis: r.top < innerHeight }; }));
          rec('F 360px: with 120-letter list names every "Use these rows" button is fully on screen (no sideways scroll needed) and ≥40 px tall', g.length > 0 && g.every(x => x.l >= 0 && x.r <= 360 && x.h >= 40), JSON.stringify(g));
          const pg = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          rec('F 360px: the page itself does not scroll sideways with the finder open', pg.sw <= pg.cw + 1, JSON.stringify(pg));
        }
        let r = await use('LA'); await sleep(500);
        const n1 = (await rows(p)).length;
        await p.evaluate(() => { const m = document.getElementById('me-more'); if (m) m.open = true; const u = document.getElementById('me-undo'); if (u) u.click(); }); await sleep(300); // ↶ Undo (phones have no Ctrl+Z)
        const n2 = (await rows(p)).filter(x => x.item).length;
        await openF(); await p.evaluate(() => { window.__asked = []; }); r = await use('LA'); await sleep(500);
        let a = await p.evaluate(() => window.__asked.slice());
        rec('[LOW] F (' + vp.width + 'px): Use these rows (list A), Undo (rows gone: ' + n2 + ' left), Use these rows (A) again → NOT asked "already in this list" (they are not)', n2 === 0 && !a.some(m => /already in this list/.test(m)), JSON.stringify({ n1, n2, a }));
        await closeAll(p);
        await p.evaluate(() => { window.__asked = []; window.__confirm = true; openListEditor(null, 'WO-3'); }); await sleep(900);
        await openF(); await use('LA'); await sleep(400); await openF(); await p.evaluate(() => { window.__asked = []; }); await use('LB'); await sleep(400);
        a = await p.evaluate(() => window.__asked.slice());
        rec('F (' + vp.width + 'px): A then a DIFFERENT old list B → no "already in" question; both lists\' rows in', !a.some(m => /already in this list/.test(m)) && (await rows(p)).length === 8, JSON.stringify([a, (await rows(p)).length]));
        await openF(); await p.evaluate(() => { window.__asked = []; window.__confirm = false; }); await use('LA'); await sleep(400);
        a = await p.evaluate(() => window.__asked.slice());
        rec('F (' + vp.width + 'px): A pressed a second time → asked; Cancel adds nothing (still 8 rows)', a.some(m => /already in this list/.test(m)) && (await rows(p)).length === 8, JSON.stringify([a, (await rows(p)).length]));
        const fin = await p.evaluate(() => [...document.querySelectorAll('.pod-ovl')].length);
        rec('(info) F (' + vp.width + 'px): after Cancel the finder is ' + (fin > 1 ? 'still open (pick another)' : 'closed'), true);
        await closeAll(p);
        rec('F (' + vp.width + 'px): no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
        await t.close();
      }
    }

    // ================= P. PM screen =================
    {
      const r = X.v2Row(), C = 'Kelly Builders';
      const o = (wo, title, extra) => H.order(Object.assign({ wo, customer: C, floor: 'F1', unit: wo.slice(-1), title, dueDate: '2026-11-25', origDueDate: '2026-11-25', plannedWeek: '' }, extra || {}));
      r.orders.push(o('WO-P1', 'ARCHIVED ONLY'), o('WO-P2', 'FINISHED'), o('WO-P3', 'PHOTO ONLY', { listPhotos: [{ url: 'https://example.invalid/a.jpg', at: '2026-10-20T10:00:00Z' }] }), o('WO-P4', 'NO CUTTING'),
        o('WO-P5', 'TWO WOS A'), o('WO-P6', 'TWO WOS B'), o('WO-P7', EVIL + ' ' + LONG), o('WO-P8', 'NO FITTINGS'));
      const S = X.makeServer(r);
      seed(S, 'PA', ['WO-P1'], { archived: true });
      seed(S, 'PB', ['WO-P2'], { saw_done_at: '2026-10-20T10:00:00.000Z', saw_done_by: 'Saw', fit_done_at: '2026-10-20T11:00:00.000Z', fit_done_by: 'Stores' });
      seed(S, 'PC', ['WO-P4'], { no_cut: true, n_saw: 0 }, [['fit', 'Hinge', '8', null, null, 'Blum hinge', '', '']]);
      seed(S, 'PD', ['WO-P5', 'WO-P6']);
      seed(S, 'PE', ['WO-P8'], { no_fit: true, n_fit: 0 }, [['saw', 'Side', '2', 720, 560, 'MFC White', '', '']]);
      seed(S, 'PF', ['WO-P1'], { is_template: true, wos: ['WO-P1'] }); // an old template that still carries a WO
      for (const vp of [{ width: 1300, height: 900 }, { width: 360, height: 740 }]) {
        const t = await X.dev(browser, S, 'pm', { viewport: vp }), p = t.page; await sleep(700);
        const tx = await p.evaluate(() => { const m = {}; document.querySelectorAll('.dsh-row').forEach(r => { const b = r.querySelector('b'); if (b && /^WO-P/.test(b.textContent)) m[b.textContent] = (r.querySelector('.pm-ls') || {}).textContent || '(no status)'; }); return m; });
        if (vp.width > 400) {
          rec('P: WO-P1 has only an ARCHIVED list (and an old template carrying it) → "no cutting list yet"', /no cutting list yet/.test(tx['WO-P1'] || ''), tx['WO-P1']);
          rec('P: WO-P2 list cut and picked → "cut ✓ · picked ✓"', /cut ✓/.test(tx['WO-P2'] || '') && /picked ✓/.test(tx['WO-P2'] || ''), tx['WO-P2']);
          rec('(info) P: WO-P3 has a PHOTO list only → says "' + tx['WO-P3'] + '" (a photo list, not a typed list — does "cutting list made" read right to a PM?)', !/cutting list made/.test(tx['WO-P3'] || '') || /photo/i.test(tx['WO-P3'] || ''), tx['WO-P3']);
          rec('P: WO-P4 list marked "no cutting" → never "not cut yet"', !/not cut yet/.test(tx['WO-P4'] || ''), tx['WO-P4']);
          rec('P: WO-P8 list marked "no fittings" → never "not picked yet"', !/not picked yet/.test(tx['WO-P8'] || ''), tx['WO-P8']);
          rec('P: one list on WO-P5 + WO-P6 → BOTH show "cutting list made"', /cutting list made/.test(tx['WO-P5'] || '') && /cutting list made/.test(tx['WO-P6'] || ''), JSON.stringify([tx['WO-P5'], tx['WO-P6']]));
        }
        const inj = await p.evaluate(() => ({ x: window.__x, img: !!document.querySelector('.dsh-row img'), raw: [...document.querySelectorAll('.dsh-row')].some(r => /<img src=x/.test(r.textContent)) }));
        rec('P (' + vp.width + 'px): a job title with <img onerror> and O\'Grady shows as text — nothing runs, no image element', !inj.x && !inj.img && inj.raw, JSON.stringify(inj));
        const ui = await p.evaluate(() => ({ btn: [...document.querySelectorAll('.dsh-row button, .dsh-row a, .pm-ls [onclick], .dsh-row [data-lhedit]')].length,
          click: (() => { const s = document.querySelector('.pm-ls'); if (!s) return 'none'; s.click(); return document.querySelector('.me-ed') ? 'OPENED A LIST' : 'nothing'; })(),
          tabs: [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(x => /list/i.test(x)) }));
        rec('P (' + vp.width + 'px): the PM cannot reach any list edit from the screen (no button/link on the rows; tapping the status does nothing)', !ui.btn && ui.click !== 'OPENED A LIST', JSON.stringify(ui));
        if (vp.width === 360) {
          const g = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over: [...document.querySelectorAll('.pm-ls')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => { const r = e.getBoundingClientRect(), row = e.closest('.dsh-row'), rr = row.getBoundingClientRect(); return { wo: (row.querySelector('b') || {}).textContent, l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), rowR: Math.round(rr.right), rowSW: row.scrollWidth, ov: getComputedStyle(row).overflow }; }) }));
          rec('[MEDIUM] P 360px: on a phone every job\'s list status is on screen (scheduled-this-week rows push it off the right edge, where it can\'t be scrolled to)', g.sw <= g.cw + 1 && !g.over.length, JSON.stringify(g));
        }
        rec('P (' + vp.width + 'px): no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
        await t.close();
      }
    }

    // ================= T. "⚠ 2 lists" tag =================
    {
      const r = X.v2Row(), o = wo => H.order({ wo, customer: 'Aderrig Homes', floor: 'T', unit: wo.slice(-1), title: 'HOUSE ' + wo, dueDate: '2026-11-28' });
      r.orders.push(o('WO-T1'), o('WO-T2'), o('WO-T3'), o('WO-T4'), o('WO-T5'), o('WO-T6'), o('WO-T7'));
      const S = X.makeServer(r);
      seed(S, 'TA', ['WO-T1']); seed(S, 'TB', ['WO-T1'], { archived: true, name: 'Archived one' });             // live + archived
      seed(S, 'TC', ['WO-T2']); seed(S, 'TD', ['WO-T2'], { is_template: true, name: 'Tpl with WO' });         // live + template carrying the WO
      seed(S, 'TE', ['WO-T3', 'WO-T3']);                                                                    // the same WO twice on ONE list
      seed(S, 'TF', ['WO-T4'], { archived: true, name: 'Old (replaced)' });
      seed(S, 'TG', ['WO-T4'], { name: 'New (replaces)', log: [{ what: 'List created', why: 'Made with "Make new list from this" from "Old (replaced)" — replaces list TF', by: 'Op', at: '2026-10-21T08:00:00Z' }] });
      seed(S, 'TH', ['WO-T5']); seed(S, 'TI', ['WO-T5'], { name: 'Second <b>live</b> one' });               // a REAL pair
      seed(S, 'TJ', ['WO-T6']); seed(S, 'TK', ['wo-t6 '], { name: 'Odd spelling of the same WO' });          // same WO, other case + space
      seed(S, 'TL', ['WO-T7', 'WO-T5']);                                                                     // a list on two WOs, one of them the pair's
      const t = await X.dev(browser, S, 'office'), p = t.page;
      await p.evaluate(async () => { lsReset(); await lsLoad(); LH.kind = 'all'; showTab('l'); }); await sleep(800);
      const tags = await p.evaluate(() => { const m = {}; document.querySelectorAll('[data-lhrow]').forEach(tr => { m[tr.dataset.lhrow] = [...tr.querySelectorAll('.lh-two')].map(x => x.textContent); }); return m; });
      const tagOf = id => tags[id] || [];
      const shown = Object.keys(tags);
      rec('T set-up: the Lists page shows the rows (' + shown.length + ')', shown.length >= 8, JSON.stringify(shown));
      rec('T: a live list + an ARCHIVED list on WO-T1 → no "2 lists" tag', !tagOf('TA').length && !tagOf('TB').length, JSON.stringify([tagOf('TA'), tagOf('TB')]));
      rec('T: a live list + a TEMPLATE that still carries WO-T2 → no tag', !tagOf('TC').length && !tagOf('TD').length, JSON.stringify([tagOf('TC'), tagOf('TD')]));
      rec('T: ONE list carrying WO-T3 twice → no tag', !tagOf('TE').length, JSON.stringify(tagOf('TE')));
      rec('T: "Make new list from this" pair (old archived) on WO-T4 → no tag', !tagOf('TF').length && !tagOf('TG').length, JSON.stringify([tagOf('TF'), tagOf('TG')]));
      rec('T: two LIVE lists on WO-T5 (plus a third list on WO-T7 + WO-T5) → each of the three rows says "⚠ 3 lists on WO-T5"', ['TH', 'TI', 'TL'].every(id => tagOf(id).some(x => /3 lists on WO-T5/.test(x))), JSON.stringify([tagOf('TH'), tagOf('TI'), tagOf('TL')]));
      rec('T: …the list on WO-T7 + WO-T5 is tagged for WO-T5 only, not WO-T7', !tagOf('TL').some(x => /WO-T7/.test(x)), JSON.stringify(tagOf('TL')));
      rec('(info) T: "WO-T6" and "wo-t6 " (same WO, other case / trailing space, e.g. typed by hand on an old list) → flagged too', tagOf('TJ').length > 0, JSON.stringify([tagOf('TJ'), tagOf('TK')]));
      const inj = await p.evaluate(() => !document.querySelector('[data-lhrow] .lh-two b'));
      rec('T: tag text is plain (a list name with <b> does not leak into it)', inj);
      rec('T: no page errors', !(S.errors || []).length, JSON.stringify(S.errors));
      await t.close();
    }

    // ================= O. lists switched OFF: same as origin/main =================
    {
      const html = A.gitShow('origin/main') || A.gitShow('main');
      if (!html) rec('O: origin/main could be read with git show', false);
      else {
        const norm = s => s.replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'HH:MM').replace(/\s+/g, ' ').trim();
        const S1 = X.makeServer(X.v1Row()), S2 = X.makeServer(X.v1Row());
        const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Dublin' });
        await ctx.addInitScript(`(()=>{const T=${+new Date(X.NOW)};const R=Date;const off=T-R.now();class D extends R{constructor(...a){if(a.length===0){super(R.now()+off);}else super(...a);}static now(){return R.now()+off;}}D.UTC=R.UTC;D.parse=R.parse;window.Date=D;})();`);
        await ctx.addInitScript(() => { localStorage.setItem('wpfRole', 'office'); localStorage.setItem('wpfPin_office', '2468'); localStorage.setItem('wpfBakDay', new Date().toISOString().slice(0, 10)); sessionStorage.setItem('wpfWho', 'OldTab'); localStorage.setItem('wpfOpName', 'Op');
          window.alert = () => {}; window.confirm = () => true; window.prompt = () => 'OldTab'; });
        const old = await A.openOld(browser, S1, html, { ctx });
        const nw = await X.dev(browser, S2, 'office');
        await nw.page.evaluate(() => { sessionStorage.setItem('wpfWho', 'OldTab'); render(); }); await sleep(400);
        const grab = async pg => pg.evaluate(async () => { const out = {}; for (const k of ['b', 'd', 'l', 's']) { try { showTab(k); } catch (e) { out[k] = 'no tab'; continue; } await new Promise(r => setTimeout(r, 300)); out[k] = (document.getElementById('app') || document.body).innerText; } return out; });
        const a = await grab(old.page), b = await grab(nw.page);
        for (const k of Object.keys(a)) {
          const x = norm(a[k]), y = norm(b[k] || '');
          let i = 0; while (i < x.length && x[i] === y[i]) i++;
          rec((k === 's' ? '(info) ' : '') + 'O: lists OFF — office tab "' + k + '" reads the same as origin/main', x === y, x === y ? '' : 'first difference at ' + i + ': main "' + x.slice(Math.max(0, i - 40), i + 80) + '" | branch "' + y.slice(Math.max(0, i - 40), i + 80) + '"');
        }
        rec('O: no page errors (branch)', !(S2.errors || []).length, JSON.stringify(S2.errors));
        await old.close(); await nw.close();
      }
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
