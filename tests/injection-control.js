// Positive control for injection.test.js: proves the payload fires when NOT escaped, and that fields really were rendered.
const H=require('./harness');
(async()=>{const t=await H.open({now:'2026-10-19T10:00:00Z',row:{id:'main',nid:2,orders:[H.order({title:"O'Grady <b>T</b>",notes:'N<i>x</i>'})],settings:{}}});
const r=await t.page.evaluate(async()=>{const d=document.createElement('div');document.body.appendChild(d);d.innerHTML=`<img src=x onerror="(window.__xss=window.__xss||[]).push('ctl')">`;await new Promise(r=>setTimeout(r,200));showTab('b');return {xss:window.__xss,boardHasTitle:document.body.innerText.includes("O'Grady <b>T</b>")};});
console.log(JSON.stringify(r));await t.close();})();
