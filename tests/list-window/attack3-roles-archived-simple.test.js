// Tester attack ROUND 3 (list window, 13 Nov):
//  A. templates are Drawing office / Admin only EVERYWHERE — ＋ New template, edit, archive, ⧉ Copy from another project —
//     (UPDATED for Garry 13 Nov, question 12 answer B: the Production Manager too — his screen, or his PIN typed when asked;
//     a PIN only remembered on the PC still never opens templates)
//     every role, hidden buttons and the last guard (a direct call, as any other button would make), typed PINs;
//  B. Save when the list was archived on another screen meanwhile;
//  C. the SIMPLICITY count: what a person sees in the window opened from a job (1280 px and 360 px).
// Fake Supabase only. Run: node tests/list-window/attack3-roles-archived-simple.test.js
const L = require('./lw.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, click, save, donep, err, rows, liveFor, linesOf, snap } = L;
const tpls = S => S.db.t.lists.filter(l => l.is_template);
const tsnap = S => JSON.stringify([tpls(S), S.db.t.list_lines.filter(x => tpls(S).some(t => t.id === x.list_id))]);
const seed = S => { X.F3.seedList(S, 'T1', { wos: [], name: 'Type B', list: { is_template: true, type_name: 'Type B', list_type: 'kitchen', rev: 1 } });
  D.insert(S.db, 'project_materials', { id: 'M9', project_id: 'P2', name: 'MFC White', kind: 'sheet' });
  X.F3.seedList(S, 'T2', { wos: [], name: 'Lucan A', list: { is_template: true, type_name: 'Lucan A', list_type: 'kitchen', rev: 1, project_id: 'P2' } }); };
const NAME = { office: 'Office', pm: 'PM', prod: 'Production Manager', saw: 'Saw', stores: 'Stores', floor: 'Floor', dash: 'Management', design: 'Drawing office' };

(async () => {
  const browser = await H.chromium.launch();
  try {
    // ===================== A. templates by role =====================
    for (const role of ['office', 'pm', 'prod', 'saw', 'stores', 'dash', 'design']) {
      const S = X.makeServer(X.v2Row()); seed(S);
      const t = await X.dev(browser, S, role), p = t.page; await asks(p);
      const allow = role === 'design' || role === 'prod', R = NAME[role], before = tsnap(S);
      // the buttons on the Cutting Lists page, Templates view, project picked
      const home = await p.evaluate(() => { try { LH.kind = 'tpl'; LH.proj = 'P1'; LH.state = ''; const d = document.createElement('div'); d.innerHTML = lsHomeHTML(); const row = d.querySelector('[data-lhrow="T1"]');
        return { newtpl: !!d.querySelector('#lh-newtpl'), copy: !!d.querySelector('#lh-copy'), row: !!row, edit: !!(row && row.querySelector('[data-lhedit]')), arc: !!(row && row.querySelector('[data-lharc]')), astpl: !!d.querySelector('[data-lhastpl]'), view: !!(row && row.querySelector('[data-lhview]')) }; } catch (e) { return { err: e.message }; } });
      rec('A1 ' + R + ': Templates page shows ＋ New template / ⧉ Copy from another project / ✎ Edit / Archive / 📐 Save as template ' + (allow ? '— ALL there' : '— NONE of them (View stays)'),
        !home.err && home.row && (allow ? home.newtpl && home.copy && home.edit && home.arc : !home.newtpl && !home.copy && !home.edit && !home.arc && !home.astpl && home.view), JSON.stringify(home));
      // the last guard: each way in, called straight, with each answer to the PIN question
      const tryIt = async (label, fn, answer) => { await closeAll(p); await p.evaluate(({ fn, answer }) => { window.__prompted = []; window.__prompt = answer; try { (0, eval)(fn); } catch (e) { window.__perr = String(e); } }, { fn, answer }); await sleep(900);
        const r = await p.evaluate(() => ({ open: !!document.querySelector('.pod-ovl'), txt: ((document.querySelector('.pod-ovl') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 60), asked: window.__prompted.filter(m => /PIN/.test(m)).length, pin: localStorage.getItem('wpfEditPin') })); await closeAll(p); return r; };
      const ways = [['＋ New template', "openListEditor(null,'','P1',{tpl:true})"], ['✎ Edit a template', "openListEditor('T1')"], ['⧉ Copy from another project', "lsCopyDlg('P1')"]];
      for (const [label, fn] of ways) {
        if (allow) { const r = await tryIt(label, fn, null); rec('A2 ' + R + ': ' + label + ' → opens, no PIN asked', r.open && r.asked === 0, JSON.stringify(r)); continue; }
        let r = await tryIt(label, fn, null);
        rec('A2 ' + R + ': ' + label + ' (called straight) → PIN asked; Cancel → nothing opens', !r.open && r.asked === 1, JSON.stringify(r));
        for (const [who, pin] of [['the PM PIN 6666', '6666'], ['the Office PIN 2468', '2468'], ['this screen\'s own PIN / blank', ''], ['" 8888x"', ' 8888x']]) { r = await tryIt(label, fn, pin);
          rec('A2 ' + R + ': ' + label + ' with ' + who + ' → refused', !r.open && r.asked === 1, JSON.stringify(r)); }
        r = await tryIt(label, fn, ' 8888 ');
        rec('A2 ' + R + ': ' + label + ' with the Drawing office PIN (spaces round it) → opens', r.open && r.asked === 1, JSON.stringify(r));
        rec('A2 ' + R + ': …that PIN is NOT remembered on the PC', !r.pin, String(r.pin));
        r = await tryIt(label, fn, null);
        rec('A2 ' + R + ': …the very next ' + label + ' asks for the PIN again', !r.open && r.asked === 1, JSON.stringify(r));
        // Garry 13 Nov: the Production Manager PIN typed when asked opens it too — for this one action, not remembered
        r = await tryIt(label, fn, '7777');
        rec('A2 ' + R + ': ' + label + ' with the Production Manager PIN 7777 typed → opens (Garry 13 Nov)', r.open && r.asked === 1, JSON.stringify(r));
        rec('A2 ' + R + ': …the Production Manager PIN is NOT remembered on the PC', !r.pin, String(r.pin));
        r = await tryIt(label, fn, null);
        rec('A2 ' + R + ': …the very next ' + label + ' asks for the PIN again (after the Production Manager PIN)', !r.open && r.asked === 1, JSON.stringify(r));
      }
      if (!allow) {
        // a list that IS a template opened through the ordinary "Edit it again" / openListEditor2 route
        const r2 = await p.evaluate(() => { window.__prompted = []; window.__prompt = null; try { openListEditor2('T1'); } catch (e) { return 'ERR ' + e.message; } return 'called'; }); await sleep(900);
        rec('A3 ' + R + ': openListEditor2 on a template (the window\'s own function) → nothing opens without the PIN', !(await ed(p)), r2);
        await closeAll(p);
        // Admin PIN typed ONCE for something else (a project / material edit — lsEditOk remembers it): does it open templates for good?
        await p.evaluate(() => { window.__prompt = '9000'; window.__prompted = []; lsEditOk(); });
        const rem = await p.evaluate(() => ({ pin: localStorage.getItem('wpfEditPin'), ok: lsTplSaveOk() }));
        if (role === 'office') rec('[LOW] A4 ' + R + ': the Admin PIN typed once for a project / material edit does not leave every template button open on this PC for whoever sits down next (lsEditOk() remembers it in wpfEditPin; lsTplSaveOk() reads that) — plan question 6', !rem.ok, JSON.stringify(rem));
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
        // the Production Manager PIN remembered the old way must NOT open templates
        await p.evaluate(() => localStorage.setItem('wpfEditPin', '7777'));
        const r3 = await tryIt('✎ Edit a template', "openListEditor('T1')", null);
        rec('A5 ' + R + ': a remembered Production Manager PIN (from before this release) does not open a template', !r3.open && r3.asked === 1, JSON.stringify(r3));
        await p.evaluate(() => localStorage.removeItem('wpfEditPin'));
      }
      rec('A6 ' + R + ': after all of that the templates in the database are untouched', tsnap(S) === before);
      if ((S.errors || []).length) rec('A ' + R + ': no page errors', false, S.errors.join(' | ').slice(0, 200));
      await t.ctx.close().catch(() => {});
    }
    // Admin: there is no "admin" screen — does the Admin PIN on the Office screen count ("the Admin view counts")?
    {
      const S = X.makeServer(X.v2Row()); seed(S); const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
      const a = await p.evaluate(() => ({ role: ROLE, pin: localStorage.getItem('wpfPin_office'), admin: pins().admin, ok: lsTplSaveOk(), roles: (() => { try { setRole('admin'); const r = ROLE; setRole('office'); return r; } catch (e) { return 'ERR'; } })() }));
      rec('(info) A7: Office screen unlocked WITH THE ADMIN PIN ("Admin only" per Garry Q3): template buttons shown without a second PIN. Today: ' + (a.ok ? 'shown' : 'hidden — the code tests ROLE===\'admin\', and no screen ever has that role (the role picker has no Admin screen), so Admin always types the PIN again'), a.ok, JSON.stringify(a));
      await t.ctx.close().catch(() => {});
    }

    // ===================== B. archived on another screen meanwhile =====================
    {
      const S = X.makeServer(X.v2Row()); seed(S); X.F3.seedList(S, 'L9', { wos: ['WO-3'], name: 'House 9' });
      const t = await X.dev(browser, S, 'office'), p = t.page; await asks(p);
      await p.evaluate(() => { window.__confirm = true; openListEditor('L9'); }); await sleep(1100);
      const i = (await rows(p)).findIndex(r => !r.hdr && r.item === 'Side');
      await setv(p, i + '|qty', '5');
      const row = S.db.t.lists.find(l => l.id === 'L9'); row.archived = true; row.archived_at = '2026-10-21T09:00:00.000Z'; row.archived_by = 'Other PC';
      await save(p, 2500); let d = await donep(p);
      rec('B1: list archived on another PC while the window is open, then Save → NOT "Saved ✓ — list is with the Saw & Stores"', !!d && !/is with the Saw/.test(d.h), JSON.stringify(d && [d.h, d.l]) + ' ' + await err(p));
      rec('B1: …it says the list was archived, the saw will not see it, and how to get it back', !!d && /archived/i.test(d.h) && /saw will not see/i.test(d.h) && /Archived/.test(d.l) && /Copy/.test(d.l), JSON.stringify(d && [d.h, d.l]));
      const after = S.db.t.lists.find(l => l.id === 'L9');
      rec('B1: …the list is STILL archived in the database (Save did not quietly bring it back to the saw)', after.archived === true, JSON.stringify({ archived: after.archived, rev: after.rev }));
      rec('(info) B1: …what was typed (qty 5) ' + (linesOf(S, 'L9').some(x => x.part === 'Side' && String(x.qty) === '5') ? 'WAS written onto the archived list' : 'was NOT written — the panel still says "Saved"'), linesOf(S, 'L9').some(x => x.part === 'Side' && String(x.qty) === '5'), JSON.stringify(linesOf(S, 'L9').filter(x => x.part === 'Side').map(x => x.qty)));
      const saw = await X.dev(browser, S, 'saw'); await sleep(700);
      const st = await saw.page.evaluate(() => document.body.innerText.includes('House 9'));
      rec('B1: …and the saw screen does not show it', !st);
      await saw.ctx.close().catch(() => {});
      await closeAll(p);
      // a NEW list typed while the WO's only list… n/a. A TEMPLATE archived meanwhile:
      await p.evaluate(() => { window.__prompt = '8888'; window.__confirm = true; openListEditor('T1'); }); await sleep(1100);
      const opened = await ed(p);
      if (opened) { const k = (await rows(p)).findIndex(r => !r.hdr); await setv(p, k + '|qty', '7');
        const tr = S.db.t.lists.find(l => l.id === 'T1'); tr.archived = true;
        await p.evaluate(() => { window.__prompt = 'why'; }); await save(p, 2500); d = await donep(p);
        rec('[LOW] B2: a TEMPLATE archived on another PC meanwhile, then Save → the panel does not say plain "Template saved ✓" (nobody can pick an archived template)', !!d && !/^Template saved ✓$/.test(d.h.trim()), JSON.stringify(d && [d.h, d.l]) + ' ' + await err(p)); }
      else rec('B2 set-up: template opens with the Drawing office PIN', false);
      await t.ctx.close().catch(() => {});
    }

    // ===================== C. simplicity: what is on the screen =====================
    const seen = p => p.evaluate(() => { const w = document.querySelector('.me-ed'); if (!w) return null; const vis = e => e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
      const lab = e => (e.textContent || e.value || e.title || e.id || '').replace(/\s+/g, ' ').trim().slice(0, 28);
      const rowsEl = w.querySelector('#me-grid');
      const btn = [...w.querySelectorAll('button,summary,a[href]')].filter(vis), out = btn.filter(e => !rowsEl || !rowsEl.contains(e)), inr = btn.filter(e => rowsEl && rowsEl.contains(e));
      const boxes = [...w.querySelectorAll('input,select,textarea')].filter(e => vis(e) && e.type !== 'hidden' && e.type !== 'file' && (!rowsEl || !rowsEl.contains(e)));
      const close = out.filter(e => /close/i.test(e.textContent)).length, saves = out.filter(e => /^save/i.test(e.textContent.trim())).length;
      return { buttons: out.map(lab), nBtn: out.length, perRow: inr.length, boxes: boxes.map(e => e.id || e.placeholder || e.type), close, saves, text: w.innerText.replace(/\s+/g, ' ') }; });
    for (const role of ['prod', 'office', 'design']) {
      const S = X.makeServer(X.v2Row()); seed(S);
      const t = await X.dev(browser, S, role, { viewport: { width: 1280, height: 800 } }), p = t.page; await asks(p);
      for (const w of [1280, 360]) {
        await p.setViewportSize({ width: w, height: w === 360 ? 640 : 800 }); await closeAll(p);
        await p.evaluate(() => openListEditor(null, 'WO-3')); await sleep(1200);
        const v = await seen(p);
        if (!v) { rec('C ' + NAME[role] + ' ' + w + ' px: the window opens from the job', false); continue; }
        rec('C1 ' + NAME[role] + ' @ ' + w + ' px: opened from the job — ' + v.nBtn + ' buttons outside the rows: ' + v.buttons.join(' | '), true);
        rec('(info) C2 ' + NAME[role] + ' @ ' + w + ' px: no more than 8 buttons outside the rows (one obvious path: rows → one big Save)', v.nBtn <= 8, v.nBtn + ' buttons');
        rec('C3 ' + NAME[role] + ' @ ' + w + ' px: exactly ONE Close and ONE Save on the screen', v.close === 1 && v.saves === 1, JSON.stringify([v.close, v.saves]));
        rec('(info) C4 ' + NAME[role] + ' @ ' + w + ' px: no typing box outside the rows except the optional List name', v.boxes.length <= 1, JSON.stringify(v.boxes));
        const tplOk = role === 'design' || role === 'prod'; // Garry 13 Nov: the Production Manager too
        rec('C5 ' + NAME[role] + ' @ ' + w + ' px: "Save as template" ' + (tplOk ? 'is there' : 'is NOT there'), /Save as template/.test(v.buttons.join('|')) === tplOk, v.buttons.join(' | '));
        const jar = (v.text.match(/Cienapps|P-number|TBC|Rev \d|undefined|null|NaN|\[object/g) || []);
        rec('(info) C6 ' + NAME[role] + ' @ ' + w + ' px: no office jargon / broken text in a plain window from a job', !jar.length, jar.join(','));
      }
      await t.ctx.close().catch(() => {});
    }
  } catch (e) { rec('test ran to the end', false, e.stack || e.message); }
  await browser.close(); X.finish();
})();
