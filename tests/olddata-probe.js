// Probe: which view throws with legacy orders (no step / hours), and where NaN shows.
const H=require('./harness');
(async()=>{const t=await H.open({now:'2026-10-19T10:00:00Z',row:{id:'main',nid:3,orders:[{wo:'WO-OLD-1',title:'Legacy',customer:'X',plannedWeek:'2026-10-26'}]}});
const r=await t.page.evaluate(async()=>{const out={};for(const tb of ['b','d','l','i','x','s']){try{showTab(tb);const txt=document.getElementById('app').innerText;const i=txt.indexOf('NaN');out[tb]=i>-1?'NaN: '+txt.slice(Math.max(0,i-60),i+10).replace(/\s+/g,' '):'ok';}catch(e){out[tb]='ERR '+e.stack.split('\n').slice(0,3).join(' / ');}}
const roles={floor:'2222',driver:'1111',saw:'3333',stores:'4444',dash:'5555',pm:'6666',prod:'7777'};for(const k in roles){localStorage.setItem('wpfPin_'+k,roles[k]);try{setRole(k);}catch(e){out[k]='ERR '+e.stack.split('\n').slice(0,3).join(' / ');}}return out;});
console.log(JSON.stringify(r,null,1),t.server.errors);await t.close();})();
