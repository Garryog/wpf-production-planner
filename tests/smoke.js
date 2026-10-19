const H=require('./harness');
(async()=>{const t=await H.open({row:{id:'main',orders:[H.order({})],nid:2,settings:{}}});
const r=await t.page.evaluate(()=>({n:DB.orders.length,loaded:DB.loaded,wk:get8Wks()}));
console.log(r,t.server.other,t.server.errors);await t.close();})();
