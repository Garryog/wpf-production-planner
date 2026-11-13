// Tester attack (list window, 12 Nov): an EXISTING list opened for edit straight after the page loads.
// The planner does not load the rows of "finished" lists at start-up (job shipped / delivered, job no longer in the plan,
// archived lists, and every TEMPLATE) — they are fetched when someone opens them. Does ✎ Edit wait for them?
// Driven through the real buttons on the Cutting Lists page. Fake Supabase only. Run: node tests/list-window/attack1-unloaded.test.js
const L = require('./lw.js');
const A = require('../stage3/atk.js');
const { X, H, D, sleep, rec, closeAll, ed, asks, setv, fillSaw, save, donep, err, job, rows, linesOf } = L;
function mk() {
  const r = X.v2Row(); r.orders.push(H.order({ wo: 'WO-SH', customer: 'Aderrig Homes', floor: 'S', unit: '1', title: 'SHIPPED HOUSE', dueDate: '2026-10-10', origDueDate: '2026-10-10', shippedAt: '2026-10-12T10:00:00Z' }));
  const S = X.makeServer(r);
  X.F3.seedList(S, 'SHIP', { wos: ['WO-SH'], name: 'Shipped house list' });
  X.F3.seedList(S, 'GONE', { wos: ['WO-GONE'], name: 'Job no longer in the plan' });
  X.F3.seedList(S, 'ARCH', { wos: ['WO-3'], name: 'Archived list', list: { archived: true } });
  X.F3.seedList(S, 'TPL', { wos: [], name: 'Type A', list: { is_template: true, type_name: 'Type A', list_type: 'kitchen' } });
  return S;
}
const CASES = [['SHIP', 'a list whose job has SHIPPED', { kind: 'live', state: '' }], ['GONE', 'a list whose job is no longer in the plan', { kind: 'live', state: '' }], ['ARCH', 'an ARCHIVED list', { kind: 'live', state: 'archived' }], ['TPL', 'a TEMPLATE', { kind: 'tpl', state: '' }]];
const editBtn = (p, id, f) => p.evaluate(({ id, f }) => { Object.assign(LH, { q: '', proj: '', type: '', rev: '' }, f); showTab('l'); render(); const b = document.querySelector('[data-lhedit="' + id + '"]'); if (!b) return 'no ✎ Edit button for ' + id + ' on the Cutting Lists page'; b.click(); return 'ok'; }, { id, f });

(async () => {
  const browser = await H.chromium.launch();
  try {
    for (const [id, what, f] of CASES) {
      const S = mk();
      const t = await X.dev(browser, S, 'design') /* Drawing office screen: a remembered PIN no longer shows the template buttons on other screens (plan question 12) */, p = t.page; await asks(p);
      await p.evaluate(() => { (o => { window.prompt = (m, d) => /Enter the Drawing office or Admin PIN/.test(m) ? pins().design : o(m, d); })(window.prompt); /* a remembered PIN no longer opens templates (plan question 12): the PIN is typed when asked */ window.__prompt = 'tidy up'; });
      const n = linesOf(S, id).length;
      const b = await editBtn(p, id, f); await sleep(1500);
      let rs = await rows(p);
      rec(what + ': Cutting Lists page → ✎ Edit (first thing after the page loads) → the window shows its ' + n + ' rows', b === 'ok' && rs.length === n, JSON.stringify({ button: b, rowsShown: rs.length, rowsInDatabase: n, text: await p.evaluate(() => ((document.querySelector('.me-ed #me-grid') || {}).innerText || '').slice(0, 60)) }));
      if (b === 'ok' && rs.length === 0) {
        // what the person sees is an empty list ("No rows yet"). They add what they came to add and press Save.
        await L.click(p, 'me-addsaw'); await sleep(300);
        await fillSaw(p, 0, 'The one extra row I came to add', '1', '500', '300', 'MFC White'); await save(p, 3000);
        const dn = await donep(p), live = linesOf(S, id).map(x => x.part), gone = S.db.t.list_lines.filter(x => x.list_id === id && x.removed_rev != null).map(x => x.part);
        rec('[CRITICAL] ' + what + ': …one row added in that empty-looking window + Save → the ' + n + ' rows that were on the list are STILL on it', live.length === n + 1, JSON.stringify({ saidOnScreen: dn ? dn.h + ' / ' + dn.l.replace(/\n/g, ' ') : await err(p), rowsNow: live, takenOff: gone }));
        rec(what + ': …the person was warned before the old rows were taken off (a question, or a refusal)', (await p.evaluate(() => window.__asked.filter(m => /rows?|remove|taken off|missing/i.test(m)).length)) > 0 || !dn, JSON.stringify(await p.evaluate(() => window.__asked)));
        const rev = S.db.t.list_revisions.filter(x => x.list_id === id);
        rec('(info) ' + what + ': the taken-off rows are still in the database history (not destroyed) — they can be got back by hand', gone.length === 0 || rev.length > 0 || gone.length === n, JSON.stringify({ revisions: rev.length, keptAsRemoved: gone.length }));
      }
      await closeAll(p);
      // the same list after "View" was pressed first (which loads its rows): Edit is then right
      const S2 = mk(); const t2 = await X.dev(browser, S2, 'design'), p2 = t2.page; await asks(p2);
      await p2.evaluate(() => { (o => { window.prompt = (m, d) => /Enter the Drawing office or Admin PIN/.test(m) ? pins().design : o(m, d); })(window.prompt); /* a remembered PIN no longer opens templates (plan question 12): the PIN is typed when asked */ });
      await p2.evaluate(({ id, f }) => { Object.assign(LH, { q: '', proj: '', type: '', rev: '' }, f); showTab('l'); render(); const v = document.querySelector('[data-lhview="' + id + '"]'); if (v) v.click(); }, { id, f }); await sleep(1500);
      await closeAll(p2); await editBtn(p2, id, f); await sleep(1200);
      rs = await rows(p2);
      rec('(control) ' + what + ': View first, then ✎ Edit → the ' + n + ' rows are there', rs.length === n, String(rs.length));
      rec(what + ': no page errors', !(S.errors || []).length && !(S2.errors || []).length, JSON.stringify([S.errors, S2.errors]));
      await t.close(); await t2.close();
    }
    // is this new on this branch, or already in the version on main?
    for (const ref of ['main', 'HEAD~1']) {
      const html = A.gitShow(ref); if (!html) { rec('(info) older code "' + ref + '" could be read', false); continue; }
      const S = mk(); const old = await A.openOld(browser, S, html);
      const o = await old.page.evaluate(async () => { const o = {}; try { (o => { window.prompt = (m, d) => /Enter the Drawing office or Admin PIN/.test(m) ? pins().design : o(m, d); })(window.prompt); /* a remembered PIN no longer opens templates (plan question 12): the PIN is typed when asked */ if (typeof lsReset === 'function') lsReset(); await lsLoad();
        for (const id of ['SHIP', 'TPL']) { openListEditor(id); await new Promise(r => setTimeout(r, 1200)); o[id] = document.querySelectorAll('.me-ed [data-row]').length; document.querySelectorAll('.pod-ovl').forEach(x => x.remove()); } } catch (e) { o.err = e.message; } return o; });
      rec('(info) the SAME thing on the older code "' + ref + '" (not new in this layout if this FAILS too): shipped-job list and template open with their 4 rows', o.SHIP === 4 && o.TPL === 4, JSON.stringify(o));
      await old.close();
    }
  } catch (e) { rec('test ran to the end', false, e.stack); }
  finally { await browser.close(); }
  X.finish();
})();
