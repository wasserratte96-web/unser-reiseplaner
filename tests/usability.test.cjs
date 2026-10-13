const test=require('node:test'),assert=require('node:assert/strict');
const J=require('../app/src/main/assets/www/js/journey-core.js');
const load=require('./app-harness.cjs');
const days=['2027-02-01','2027-02-02','2027-02-03','2027-02-04'];
const excursion=(key)=>({key,name:key,kind:'highlight',durationMin:45,priority:'high',access:{baseName:'El Chaltén',mode:'walk',outboundMin:120,returnMin:120,walkMin:240}});
test('daily walking allowance applies to the sum of excursions, including an inferred walking duration',()=>{
 const a=excursion('A'),b=excursion('B');delete b.access.walkMin;
 const r=J.draft([a,b],{days,mobility:{mode:'public',maxWalkMin:300}});
 assert.equal(r.includedKeys.length,2);
 assert.ok(r.days.every(d=>d.events.filter(e=>e.type==='visit').reduce((n,e)=>n+(e.access.walkMin??e.access.outboundMin+e.access.returnMin),0)<=300));
});
test('unknown places and taxon-only wildlife wishes are deferred before travel days are created',()=>{
 const r=J.draft([{key:'p',name:'Pinguine',kind:'wildlife',durationMin:60}],{days,origin:'Prag'});
 assert.equal(r.includedKeys.length,0);assert.equal(r.days.flatMap(d=>d.events).length,0);assert.match(r.deferred[0].reason,/Beobachtungsort/);
});
test('a confirmed nightly booking allows an excursion from its base, but not from another base',()=>{
 const lodging={name:'Hotel El Chaltén',lat:-49.33,lng:-72.89};
 const r=J.draft([excursion('A')],{days,lodgings:Object.fromEntries(days.map(d=>[d,[lodging]])),mobility:{mode:'public',maxWalkMin:300}});
 assert.equal(r.includedKeys.length,1);
 const different={...excursion('B'),access:{...excursion('B').access,baseName:'Ushuaia',baseLat:-54.8,baseLng:-68.3}};
 const b=J.draft([different],{days,lodgings:Object.fromEntries(days.map(d=>[d,[lodging]]))});
 assert.equal(b.includedKeys.length,0);assert.match(b.deferred[0].reason,/Unterkunft/);
});
test('an unknown public-transport leg makes later automatic times visibly unresolved',()=>{
 const h=load(),v={id:'v',days:[],connections:[],flights:[],transfers:[]},day={id:'d',date:days[0],startTime:'08:00',endTime:'20:00',stops:[{id:'a',name:'A',lat:50,lng:14},{id:'b',name:'B',lat:51,lng:15}].map(s=>({...s,durationMin:60,durationWish:60,modeToNext:'transit'}))};v.days=[day];
 const r=h.app.computeDay(v,day);assert.equal(r.rows[1].timeUnknown,true);assert.ok(r.notices.some(s=>/Wegzeit/.test(s)));
});
