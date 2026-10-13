const test=require('node:test');
const assert=require('node:assert/strict');
const J=require('../app/src/main/assets/www/js/journey-core.js');
const C=require('../app/src/main/assets/www/js/travel-catalog.js');
const load=require('./app-harness.cjs');
const days=Array.from({length:9},(_,i)=>`2027-02-${String(i+1).padStart(2,'0')}`);
const wish=(key,extra={})=>({key,name:key,lat:-49.33,lng:-72.89,kind:'highlight',priority:'must',durationMin:60,...extra});
function setup(){const h=load(),v={id:'v',name:'Original',startDate:days[0],endDate:days.at(-1),days:days.map((date,i)=>({id:'d'+i,date,startTime:'08:00',endTime:'20:00',stops:[]})),connections:[],flights:[],transfers:[]};const t={id:'t',title:'Patagonien',countries:[{code:'AR',name:'Argentinien'}],country:'Argentinien',mobility:{mode:'public',maxWalkMin:600},wishlist:[],versions:[v],selectedVersionId:'v'};Object.assign(h.app.getState(),{trips:[t],activeTripId:'t'});return {...h,t,v};}
test('public-only policy rejects motorized extras and flights require a separate choice',()=>{
  for(const mode of ['car','rentalcar','camper','taxi','rideshare','shuttle','tour','flight'])assert.equal(J.allowed(mode,{mode:'public',allowTaxi:true,allowShuttle:true,allowTours:true}),false,mode);
  assert.equal(J.allowed('flight',{mode:'public',allowFlights:true}),true);
  assert.equal(J.allowed('shuttle',{mode:'assisted',allowShuttle:true}),true);
  assert.equal(J.allowed('taxi',{mode:'assisted'}),false);
});
test('base coordinates keep unknowns and zero distinct, and reject invalid pairs',()=>{
  assert.equal(J.access({baseName:'El Chaltén'}).baseLat,null);
  assert.equal(J.access({baseName:'Equator',baseLat:0,baseLng:0}).baseLat,0);
  for(const pair of [[91,181],['x','y'],[30,'']])assert.throws(()=>J.access({baseName:'X',baseLat:pair[0],baseLng:pair[1]}));
});
test('excursion budget includes both approaches and enforces the walking limit',()=>{
  const a=wish('Fitz Roy',{durationMin:45,access:C.excursions[0]});
  const r=J.draft([a],{days,mobility:{mode:'public',maxWalkMin:240}});const e=r.days[0].events[0];
  assert.equal(e.base.name,'El Chaltén');assert.equal(e.end-e.start,285);assert.equal(e.visitStart-e.start,120);
  const long=J.draft([wish('Tres',{access:C.excursions[1]})],{days,mobility:{mode:'public',maxWalkMin:240}});
  assert.equal(long.includedKeys.length,0);assert.match(long.deferred[0].reason,/Gehzeit/);
});
test('a rejected distant wish leaves no travel day and origin reserves arrival plus return',()=>{
  const r=J.draft([wish('A'),wish('B',{stayDays:8})],{days:days.slice(0,4),origin:'Prag',mobility:{mode:'public'}});
  assert.deepEqual(r.includedKeys,['A']);assert.equal(r.days[0].events[0].type,'arrival');assert.equal(r.days[3].events[0].type,'departure');assert.equal(r.days[3].events[0].from.name,'A');assert.equal(r.days.flatMap(d=>d.events).filter(e=>e.type==='travel').length,0);
});
test('unknown access stays untimed and photo windows require known approach budgets',()=>{
  const a=wish('A',{access:{baseName:'Base',mode:'bus'}});const r=J.draft([a],{days});assert.equal(r.days[0].events[0].start,null);
  const photo=J.draft([{...a,photography:{windowStart:'10:00',windowEnd:'12:00'}}],{days});assert.match(photo.deferred[0].reason,/Hin- und Rückweg/);
});
test('season comparison reports partial matches without inventing a common best month',()=>{
  const profiles=[{id:'a',months:[1,2]},{id:'b',months:[6,7]}],r=J.seasonMonths(profiles,['a','b']);assert.equal(r[0].matched.length,1);assert.equal(r[0].missing.length,1);assert.ok(r.every(m=>m.matched.length<2));
  assert.ok(J.matchProfiles(C.profiles,{month:2,query:'Fitz Roy'}).some(p=>p.id==='chalten'));
  assert.ok(J.matchProfiles(C.profiles,{month:7,query:'Fitz Roy'}).length===0);
});
test('a connection is present on its arrival day even with only one selected endpoint',()=>{
  const c={departDate:days[0],arriveDate:days[1],fromEndpoint:{name:'Station',lat:0,lng:0}};
  const r=J.mapConnections([c],[days[1]]);assert.equal(r.length,1);assert.equal(r[0].from.lat,0);assert.equal(r[0].to,null);assert.equal(J.mapConnections([c],[days[2]]).length,0);
});
test('new draft preserves booked nights and connections, clones independently, and retains photo windows',()=>{
  const {app,t,v}=setup();t.origin='Prag';v.days[0].stops.push({id:'h',name:'Hotel',type:'hotel',accommodation:{checkInDate:days[0],checkOutDate:days[2]}});
  v.connections.push({id:'booked',mode:'bus',from:'A',to:'B',departDate:days[1],arriveDate:days[1],departTime:'10:00',arriveTime:'11:00'});
  t.wishlist=[wish('Fitz Roy',{durationMin:45,access:{...C.excursions[0],baseLat:-49.33,baseLng:-72.89},photography:{windowStart:'11:00',windowEnd:'12:00'}})];
  const before=JSON.stringify(v),draft=app.buildJourneyDraft();assert.equal(JSON.stringify(v),before);assert.equal(t.versions.length,2);assert.equal(draft.connections.filter(c=>c.number===undefined&&c.from==='A').length,1);
  const day=draft.days.find(d=>d.stops.some(s=>s.wishlistKey));assert.ok(day.date>days[1]);const visit=day.stops.find(s=>s.wishlistKey);assert.equal(visit.modeToNext,'transit');assert.equal(visit.name,'Fitz Roy · Laguna Capri');assert.equal(visit.lat,null);assert.equal(visit.durationMin,285);assert.deepEqual(Array.from(app.computeDay(draft,day).conflicts),[]);
  assert.equal(draft.connections.at(-1).title,'Rückreise planen');assert.equal(draft.connections.at(-1).departTime,'');
});
test('legacy flight endpoints survive migration and changing a terminal invalidates its transfer',()=>{
  const h=setup(),f={id:'f',from:'PRG',to:'FTE',departDate:days[0],arriveDate:days[1],fromEndpoint:{name:'Prag',lat:50,lng:14,kind:'airport',iata:'PRG'}};h.v.flights.push(f);h.v.transfers.push({id:'tr',sourceRef:'flight:f',transferType:'to_airport',toLat:50,toLng:14,timeEstimated:false,durationMin:40});
  assert.equal(h.app.versionConnections(h.v)[0].fromEndpoint.iata,'PRG');h.app.endpointModal('f','from');h.flushTimers();
  for(const [id,value] of Object.entries({endpointName:'New airport',endpointLat:'51',endpointLng:'15',endpointKind:'airport',endpointCode:'PRG',endpointNote:'Terminal 2'}))h.context.document.querySelector('#'+id).value=value;
  h.elements.get('#endpointSave').onclick();assert.equal(f.fromEndpoint.lat,51);assert.equal(h.v.transfers[0].toLat,51);assert.equal(h.v.transfers[0].timeEstimated,true);assert.equal(h.v.transfers[0].durationMin,40);
});
test('public routes provide no invented travel time and flight maps open places',async()=>{
  const {app}=setup();const r=await app.Providers.route({lat:50,lng:14},{lat:51,lng:15},'train');assert.equal(r.durationUnknown,true);assert.equal(r.durationMin,0);
  const html=app.connectionLocationHtml({id:'c',mode:'flight',from:'Prag',to:'Perth'});assert.ok(html.includes('maps/search/'));assert.ok(!html.includes('maps/dir/'));
});
