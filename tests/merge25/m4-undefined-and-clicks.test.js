// MERGE SEAM 5 (Tester, 25 Nov 2026): 92 hand-resolved conflicts — is anything CALLED that no longer EXISTS?
// (a) every name the app's own script calls as a function / reads as an element id handler is looked up in the loaded page;
// (b) each role: every button on every screen is pressed once (confirm → Cancel, prompt → Cancel, no file pickers, nothing
//     saved to a real database) while page errors and console errors are collected.
// Fake Supabase only. Run: node tests/merge25/m4-undefined-and-clicks.test.js
const fs = require('fs'), path = require('path');
const M = require('./m25lib.js');
const { X, H, sleep, rec } = M;
const SUBS = { office: ["tab='b'", "tab='l'", "tab='d'", "tab='h'", "tab='i'", "tab='x'", "tab='s'"], prod: ["prodTab='today'", "prodTab='req'", "prodTab='deliv'", "prodTab='lists'", "prodTab='snags'"], pm: ["pmTab=''", "pmTab='snags'", "pmTab='projects'", "pmTab='seq'", "pmTab='ship'"] };
(async () => {
  const browser = await H.chromium.launch();
  try {
    const row = X.v2Row();
    Object.assign(row.orders.find(o => o.wo === 'WO-3'), { delv: true }); Object.assign(row.orders.find(o => o.wo === 'WO-4'), { delv: true, delVeh: 'VOLVO', delDay: 'Thu', delWk: '2026-10-19' });
    Object.assign(row.orders.find(o => o.wo === 'WO-2'), { delv: true, step: '5. WORK ORDER PROCESSED' });
    const S = X.makeServer(row);
    X.D.update(S.db, 'projects', X.D.find(S.db, 'projects', 'P1'), { pms: ['John Burke'] });
    X.F3.seedList(S, 'L3', { wos: ['WO-3'], name: 'House 13' }); X.F3.seedList(S, 'T1', { wos: [], name: 'Type C', list: { is_template: true, type_name: 'Type C', list_type: 'house' } });
    ['WO-3', 'WO-4', 'WO-1', 'WO-2'].forEach((w, i) => X.seqRow(S, 'Q' + i, 'P1', { wo: w })); X.seqRow(S, 'QW', 'P1', { floor: 'T09', unit: '15', product: 'K8', name: 'HOUSE TYPE E', req_date: '2026-11-30' });
    const t = await X.dev(browser, S, 'office', { me: { pm: 'John Burke' } }), p = t.page; const bag = []; M.watch(p, bag);

    // ---------- (a) static: names called but never defined ----------
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
    const js = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    const bare = js.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ');
    // code only: what sits inside '…' "…" and the text parts of `…` is words for people, not calls (${…} parts are kept)
    const code = (() => { let out = '', i = 0; const st = []; const n = bare.length;
      while (i < n) { const c = bare[i], top = st[st.length - 1];
        if (top === 'T') { if (c === '\\') { i += 2; continue; } if (c === '`') { st.pop(); i++; continue; } if (c === '$' && bare[i + 1] === '{') { st.push('E'); out += ' ('; i += 2; continue; } i++; continue; }
        if (c === "'" || c === '"') { let j = i + 1; while (j < n && bare[j] !== c && bare[j] !== '\n') { if (bare[j] === '\\') j++; j++; } out += ' 0 '; i = j + 1; continue; }
        if (c === '`') { st.push('T'); out += ' 0 '; i++; continue; }
        if (c === '/' && /[=(,:;!&|?{}\[\n]\s*$/.test(out.slice(-12))) { let j = i + 1, cls = false; while (j < n && bare[j] !== '\n' && (cls || bare[j] !== '/')) { if (bare[j] === '\\') j++; else if (bare[j] === '[') cls = true; else if (bare[j] === ']') cls = false; j++; } out += ' 0 '; i = j + 1; continue; }
        if (top === 'E') { if (c === '{') st.push('B'); else if (c === '}') { st.pop(); out += ') '; i++; continue; } }
        else if (top === 'B' && c === '}') st.pop(); else if (c === '{' && st.length) st.push('B');
        out += c; i++; }
      return out; })();
    const called = new Set(); for (const m of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\(/g)) called.add(m[2]);
    const KW = new Set('if for while switch catch function return typeof new await async do else try var let const of in delete void throw case super import constructor get set static class extends yield with'.split(' '));
    const cand = await p.evaluate(names => names.filter(n => { try { return (0, eval)('typeof ' + n) === 'undefined'; } catch (e) { return true; } }), [...called].filter(n => !KW.has(n)));
    const esc = s => s.replace(/[$]/g, '\\$');
    const local = n => new RegExp('(function\\s+' + esc(n) + '\\b)|((const|let|var)\\s[^;\\n]{0,600}?[\\s,{\\[]' + esc(n) + '\\s*[=,;}\\]])|((const|let|var)\\s+' + esc(n) + '\\b)|([(,{\\[]\\s*' + esc(n) + '\\s*(=[^=>][^,)]*)?[,)}\\]])|(\\b' + esc(n) + '\\s*=>)|(\\b' + esc(n) + '\\s*\\([^)]*\\)\\s*\\{)|(\\b' + esc(n) + '\\s*:)').test(code);
    const NOT_CODE = new Set(['BED', 'copy', 'child', 'repeat']); // looked at by hand: CSS (nth-child(, repeat() and regular-expression text inside the script, not calls
    const local2 = n => new RegExp('[\\s,;{(]' + esc(n) + '\\s*=[^=]').test(bare);
    const missing = cand.filter(n => !local(n) && !local2(n) && !NOT_CODE.has(n));
    rec('(a) every function the script calls exists (global, or declared somewhere in the file) — ' + called.size + ' names looked up, ' + cand.length + ' not global', missing.length === 0, missing.slice(0, 40).join(', '));

    // ---------- (b) press everything ----------
    const DANGER = /sign out|log ?out|switch (the )?(lists )?(on|off)|migrat|print|🖨|download|export|⬇|backup|upload|⬆|excel|photo|camera|📷/i; // file pickers / downloads / the lists switch only — the database is a fake, so the rest is safe to press
    for (const role of M.ROLES) {
      const b0 = bag.length; let pressed = 0, screens = 0, inDlg = 0; const where = [];
      for (const set of (SUBS[role] || [''])) {
        await M.go(p, role, set, 350); screens++;
        const n = await p.evaluate(() => document.querySelectorAll('#app button, #app summary, #app [role="checkbox"], #app select').length);
        for (let i = 0; i < Math.min(n, 220); i++) {
          const before = bag.length;
          const lbl = await p.evaluate(async ({ i, danger }) => {
            window.confirm = () => false; window.prompt = () => null; window.alert = () => {}; window.print = () => {}; window.open = () => ({ document: { write() {}, close() {} }, focus() {}, print() {}, close() {} });
            const els = [...document.querySelectorAll('#app button, #app summary, #app [role="checkbox"], #app select')]; const e = els[i]; if (!e) return null;
            const txt = ((e.textContent || '') + ' #' + (e.id || '')).replace(/\s+/g, ' ').trim().slice(0, 60);
            if (e.disabled || !(e.offsetParent || e.getClientRects().length) || new RegExp(danger, 'i').test(txt) || e.type === 'file' || e.dataset.prodtab || e.dataset.role || /^(role-sw|who-sw)$/.test(e.id)) return '';
            try { if (e.tagName === 'SELECT') { if (e.options.length > 1) { e.selectedIndex = e.selectedIndex === 0 ? 1 : 0; e.dispatchEvent(new Event('change', { bubbles: true })); } } else e.click(); } catch (err) { return 'THROW ' + txt + ': ' + err; }
            await new Promise(r => setTimeout(r, 60));
            // press the first harmless thing inside any dialog that opened too, then shut every dialog
            const top = () => [...document.querySelectorAll('.pod-ovl')].pop();
            let dlgN = 0; const d0 = top();
            if (d0) { const inner = o => [...o.querySelectorAll('button, summary, select')].filter(b => !b.disabled && (b.offsetParent || b.getClientRects().length) && !new RegExp(danger, 'i').test(b.textContent || '') && b.type !== 'file');
              const m = Math.min(inner(d0).length, 14);
              for (let j = 0; j < m; j++) { let o = top();
                if (!o) { document.querySelectorAll('.pod-ovl,.me-dov').forEach(x => x.remove()); try { render(); } catch (e3) { return 'THROW render after [' + txt + ']: ' + e3; } const e2 = [...document.querySelectorAll('#app button, #app summary, #app [role="checkbox"], #app select')][i]; if (!e2 || e2.tagName === 'SELECT') break; e2.click(); await new Promise(r => setTimeout(r, 60)); o = top(); if (!o) break; }
                const b = inner(o)[j]; if (!b) break; window.__last = txt + ' › ' + (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
                try { if (b.tagName === 'SELECT') { if (b.options.length > 1) { b.selectedIndex = b.selectedIndex === 0 ? 1 : 0; b.dispatchEvent(new Event('change', { bubbles: true })); } } else b.click(); } catch (e4) { return 'THROW ' + window.__last + ': ' + e4; }
                dlgN++; await new Promise(r => setTimeout(r, 50));
                [...document.querySelectorAll('.pod-ovl')].slice(1).forEach(x => { if (x !== o) x.remove(); }); // a dialog on top of the dialog: shut it, keep going
              } }
            await new Promise(r => setTimeout(r, 30));
            document.querySelectorAll('.pod-ovl,.me-dov').forEach(o => o.remove());
            return (txt || '(no label)') + (dlgN ? ' +' + dlgN : '');
          }, { i, danger: DANGER.source });
          if (lbl === null) break; if (lbl) { pressed++; const dm = / \+(\d+)$/.exec(lbl); if (dm) inDlg += +dm[1]; }
          if (/^THROW/.test(lbl || '')) bag.push(lbl);
          if (bag.length > before) where.push((set || role) + ' → [' + lbl + '] last: ' + (await p.evaluate(() => window.__last || '')) + ' ' + bag.slice(before).join(' ; ').slice(0, 200));
          if (lbl) await M.go(p, role, set, 60); // put the screen back the way it was
        }
      }
      rec('(b) ' + role + ': ' + screens + ' screen(s), ' + pressed + ' buttons pressed + ' + inDlg + ' inside the windows they opened — no JavaScript error', bag.length === b0, where.slice(0, 5).join(' || ').slice(0, 900));
    }
    rec('(b) nothing was deleted from the fake database and no request left the machine', !(S.deniedS || 0), String(S.deniedS || 0));
  } catch (e) { rec('test ran without an error', false, String(e && e.stack || e)); }
  finally { await browser.close(); }
  M.finish();
})();
