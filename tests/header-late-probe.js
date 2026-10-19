// Probe: header row below row 12 -> mapping screen -> what gets imported if the user maps WO = column A?
const H=require('./harness');
(async()=>{const t=await H.open({now:'2026-10-19T10:00:00Z'});
const pre=Array.from({length:12},(_,i)=>['Report line '+i]);
const r=await H.importAoa(t.page,[...pre,['WO #','Title','Customer','Due Date','Step','Sub-Total'],['WO-2604-1','K','C',46331,'3. In production',5000]]);
const out=await t.page.evaluate(async()=>{document.querySelector('[data-mf="wo"]').value='0';document.querySelector('[data-mf="dueDate"]').value='3';document.getElementById('mapgo').click();await new Promise(r=>setTimeout(r,200));return IMPPLAN&&IMPPLAN.newOrders.map(o=>o.wo+' ('+o.hours+'h due='+o.dueDate+')');});
console.log(r.iprev.slice(0,200));console.log(out);await t.close();})();
