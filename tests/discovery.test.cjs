const test=require('node:test');
const assert=require('node:assert/strict');
const loadApp=require('./app-harness.cjs');
const Planner=require('../app/src/main/assets/www/js/planner-core.js');
const Discovery=require('../app/src/main/assets/www/js/discovery-core.js');
function setup(days=4){
  const harness=loadApp(),{app}=harness;
  const v={id:'v',name:'Original',startDate:'2027-06-01',endDate:app.addDays('2027-06-01',days-1),days:Array.from({length:days},(_,i)=>({id:'d'+i,date:app.addDays('2027-06-01',i),startTime:'08:00',endTime:'20:00',stops:[]})),flights:[],connections:[],transfers:[]};
  const t={id:'t',title:'Europa',country:'Deutschland',countries:[{code:'DE',name:'Deutschland'},{code:'AT',name:'Österreich'}],wishlist:[],versions:[v],selectedVersionId:'v'};
  Object.assign(app.getState(),{trips:[t],activeTripId:t.id});return {...harness,t,v};
}
test('country migration preserves old trips and deduplicates localized multi-country entries',()=>{
  assert.deepEqual(Discovery.countriesForTrip({country:'Australia'}),[{code:'AU',name:'Australien'}]);
  assert.deepEqual(Discovery.countriesForTrip({countries:['DE','Germany','Österreich']}),[{code:'DE',name:'Deutschland'},{code:'AT',name:'Österreich'}]);
  assert.deepEqual(Discovery.validCountryCodes(['DE','de','AT','bogus']),['at','de']);
  const {app}=setup(),raw={schema:6,trips:[{id:'old',country:'Australien',wishlist:[],versions:[]}]};
  const before=JSON.stringify(raw),out=app.normalizeLoadedState(raw);assert.equal(out.schema,7);assert.equal(out.trips[0].countries[0].code,'AU');assert.equal(JSON.stringify(raw),before);
});
test('own places retain missing locations, reject incomplete coordinates and accept the equator',()=>{
  const input={name:'Mein Motiv',durationMin:60,kind:'highlight',countryCode:'DE'};
  const point=Discovery.customPoint(input,()=> 'custom1');assert.equal(point.lat,null);assert.equal(point.lng,null);
  assert.throws(()=>Discovery.customPoint({...input,lat:'51.1'},()=> 'x'),/vollständig/);
  assert.throws(()=>Discovery.customPoint({...input,lat:91,lng:10},()=> 'x'),/gültig/);
  const zero=Discovery.customPoint({...input,lat:0,lng:0},()=> 'x');assert.equal(zero.lat,0);assert.equal(zero.lng,0);
  assert.throws(()=>Discovery.customPoint({...input,name:' '},()=> 'x'),/Namen/);
});
test('manual search passes all trip country codes and can explicitly search worldwide',async()=>{
  const {app,t}=setup(),calls=[];app.Providers.geocode=async(q,limit,options)=>{calls.push({q,options});return [{name:'Salzburg',type:'city',lat:47.8,lng:13,countryCode:'AT'}];};
  app.Providers.searchTaxa=async()=>[{kind:'wildlife',taxonId:123,name:'Tier',lat:null,lng:null}];
  const local=await app.searchPoints('Salzburg',{trip:t});assert.equal(local.items.length,2);assert.deepEqual(Array.from(calls[0].options.countryCodes),['DE','AT']);
  await app.searchPoints('Venice',{kind:'city',scope:'world',trip:t});assert.equal(calls[1].options.countryCodes.length,0);
  await assert.rejects(()=>app.searchPoints('x',{trip:t}),/zwei/);
});
test('partial provider failure leaves usable search results and an explicit error',async()=>{
  const {app}=setup();app.Providers.geocode=async()=>{throw new Error('Orte offline');};app.Providers.searchTaxa=async()=>[{kind:'wildlife',taxonId:1,name:'Tier'}];
  const result=await app.searchPoints('Koala');assert.equal(result.items.length,1);assert.equal(result.errors[0],'Orte offline');
});
test('an older search response cannot replace newer results',async()=>{
  const {app,elements,context}=setup();app.resetDiscoverySearch();
  const releases={};app.Providers.geocode=q=>new Promise(resolve=>releases[q]=resolve);
  context.document.querySelector('#poiKind').value='city';context.document.querySelector('#poiScope').value='world';context.document.querySelector('#poiQuery').value='Erste';const older=app.submitPoiSearch();
  context.document.querySelector('#poiQuery').value='Zweite';const newer=app.submitPoiSearch();
  releases.Zweite([{name:'Zweite',type:'city',lat:1,lng:1}]);await newer;
  releases.Erste([{name:'Erste',type:'city',lat:2,lng:2}]);await older;
  assert.match(elements.get('#poiSearchResults').innerHTML,/Zweite/);assert.doesNotMatch(elements.get('#poiSearchResults').innerHTML,/Erste/);
});
test('result identities preserve distinct namesakes and merge repeated source entities',()=>{
  const items=[{name:'See',lat:1,lng:2},{name:'See',lat:4,lng:5},{name:'See',lat:1,lng:2},{name:'X',wikidata:'Q1'},{name:'Y',wikidata:'Q1'}];
  assert.equal(Discovery.dedupeResults(items).length,3);assert.equal(Discovery.safeUrl('javascript:alert(1)'), '');
});
test('a global custom place extends the trip countries without replacing existing countries',()=>{
  const {app,t}=setup();app.addCountryForItem({countryCode:'IT'});app.addCountryForItem({countryCode:'IT'});
  assert.deepEqual(Array.from(t.countries,c=>c.code),['DE','AT','IT']);assert.equal(t.country,'Deutschland');
});
test('wildlife wishes use every trip country and select a real candidate near the itinerary',async()=>{
  const {app}=setup(),countries=[];
  app.Providers.wildlifeBestHotspot=async(id,country)=>{countries.push(country);return country==='Deutschland'?{lat:54,lng:9,count:9}:{lat:47.8,lng:13,count:2};};
  const nodes=await app.resolveWishlistNodes([{name:'Salzburg',kind:'city',key:'a',lat:47.8,lng:13},{name:'Tier',kind:'wildlife',key:'t',lat:null,lng:null,item:{taxonId:123}}]);
  assert.deepEqual(countries,['Deutschland','Österreich']);assert.equal(nodes[1].countryCode,'AT');assert.equal(nodes[1].lat,47.8);
});
test('custom editing preserves photographic preferences and stay days',()=>{
  const {app,t,elements,flushTimers,context}=setup();
  const item={customId:'x',name:'Motiv',kind:'highlight',countryCode:'DE',lat:50,lng:10};app.setWishlistSelection('highlight',item);
  const wish=t.wishlist[0];wish.stayDays=2;wish.photography={genres:['landscape'],windowStart:'16:00',windowEnd:'18:00',notes:'Stativ'};
  app.customWishModal({...wish.item,...wish});flushTimers();
  for(const [id,value] of Object.entries({mCustomName:'Neues Motiv',mCustomKind:'highlight',mCustomCountry:'DE',mCustomLat:'50',mCustomLng:'10',mCustomDuration:'60',mCustomNotes:'Ufer',mCustomPriority:'must'}))context.document.querySelector('#'+id).value=value;
  elements.get('#saveCustomWish').onclick();assert.equal(t.wishlist.length,1);assert.equal(t.wishlist[0].name,'Neues Motiv');assert.equal(t.wishlist[0].stayDays,2);assert.equal(t.wishlist[0].photography.notes,'Stativ');
});
test('cross-border generation preserves the original and produces a conflict-free plan',async()=>{
  const {app,t,v:base}=setup();t.wishlist=[{key:'a',name:'Passau',kind:'city',priority:'must',durationMin:60,lat:48.57,lng:13.46,countryCode:'DE',country:'Deutschland'},{key:'b',name:'Linz',kind:'city',priority:'high',durationMin:60,lat:48.30,lng:14.29,countryCode:'AT',country:'Österreich'}];
  app.Providers.route=async()=>({durationMin:90,distanceKm:100,approx:false});const before=JSON.stringify(base);
  const next=await app.buildAutomaticRoute({allowFlights:false});assert.equal(JSON.stringify(base),before);assert.equal(next.countries.length,2);
  const crossing=next.connections.find(c=>c.borderCrossing);assert.ok(crossing);assert.match(app.objectOpenIssues(crossing,'connection').join(' '),/Länderwechsel/);
  for(const day of next.days)assert.equal(app.computeDay(next,day).conflicts.length,0);
});
const opts={startDate:'2027-06-01',endDate:'2027-06-03',arrivalTime:'08:00',departureTime:'20:00',dayStart:'06:00',dayEnd:'22:00',allowFlights:false,maxVisitMin:240,orderMode:'wishlist'};
const node=(key,lng=10)=>({key,name:key,kind:'highlight',lat:50,lng,priority:'high',durationMin:60});
test('manual route order survives priorities and geographic temptation',()=>{
  const nodes=[node('z'),{...node('x',10.1),priority:'must'},node('a',10.01)];
  const result=Planner.plan(nodes,opts);assert.deepEqual(result.ordered.map(n=>n.key),['z','x','a']);
});
test('daily activity budgets distribute visits without changing requested duration',()=>{
  const nodes=Array.from({length:6},(_,i)=>({...node(String(i)),durationMin:90}));
  const result=Planner.plan(nodes,opts);assert.equal(result.includedKeys.length,6);for(const day of result.days)assert.ok(day.visitMin<=240);
});
test('photo windows reserve arrival time and defer impossible shoots with a reason',()=>{
  const photo={...node('sunset'),photography:{windowStart:'17:00',windowEnd:'18:30',genres:['landscape']}};
  const result=Planner.plan([photo],opts),event=result.days[0].events.find(e=>e.type==='activity');assert.equal(event.start,17*60);
  const impossible=Planner.plan([{...photo,durationMin:120}],opts);assert.equal(impossible.includedKeys.length,0);assert.match(impossible.deferred[0].reason,/Fotozeitfenster/);
  assert.throws(()=>Discovery.photoPlan({windowStart:'22:00',windowEnd:'02:00'}),/selben Tag/);
});
test('photo time windows reach the real day renderer and survive copying a route',async()=>{
  const {app,t}=setup();t.wishlist=[{...node('Abendlicht'),photography:{genres:['street'],windowStart:'17:00',windowEnd:'18:30',notes:'Blick nach Westen'}}];
  const v=await app.buildAutomaticRoute({dayStart:'06:00',dayEnd:'22:00'}),stop=v.days[0].stops.find(s=>s.wishlistKey);
  assert.equal(stop.fixedStart,'17:00');assert.equal(stop.photography.notes,'Blick nach Westen');assert.equal(app.computeDay(v,v.days[0]).conflicts.length,0);
  const copy=app.cloneVersion(v,'Alternative');copy.days[0].stops[0].photography.notes='Andere Idee';assert.equal(stop.photography.notes,'Blick nach Westen');
});
test('day edits keep photo windows effective and reveal conflicts after a time change',async()=>{
  const {app,t}=setup();t.wishlist=[{...node('Abendmotiv'),photography:{genres:['street'],windowStart:'17:00',windowEnd:'18:30'}}];
  const v=await app.buildAutomaticRoute({dayStart:'06:00',dayEnd:'22:00'}),day=v.days[0],stop=day.stops.find(s=>s.wishlistKey);
  stop.fixedStart='16:00';
  let computed=app.computeDay(v,day);assert.match(computed.conflicts.join(' '),/Fotozeitfenster/);assert.ok(computed.buffer<0);
  stop.fixedStart='';
  computed=app.computeDay(v,day);const row=computed.rows.find(r=>r.stop===stop);assert.equal(row.arrival,17*60);assert.equal(computed.conflicts.length,0);
  stop.durationWish=120;
  computed=app.computeDay(v,day);assert.match(computed.conflicts.join(' '),/Fotozeitfenster/);
});
test('geocoding serializes repeated calls, scopes the request and uses a scoped cache',async()=>{
  const {app,context}=setup(),urls=[];
  context.NativeHttp.request=async url=>{urls.push(url);return JSON.stringify([{lat:'47.8',lon:'13',display_name:'Salzburg, Österreich',osm_type:'relation',osm_id:1,addresstype:'city',address:{country:'Österreich',country_code:'at'}}]);};
  const values=await Promise.all([app.Providers.geocode('Salzburg',8,{countryCodes:['DE','AT']}),app.Providers.geocode('Salzburg',8,{countryCodes:['AT','DE']})]);
  assert.equal(urls.length,1);assert.equal(new URL(urls[0]).searchParams.get('countrycodes'),'at,de');assert.equal(values[0][0].countryCode,'AT');assert.equal(values[1][0].sourceId,'relation/1');
});
test('animal-name search preserves taxonomic identity and never invents an observation',async()=>{
  const {app,context}=setup();context.NativeHttp.request=async()=>JSON.stringify({results:[{id:420,preferred_common_name:'Koala',name:'Phascolarctos cinereus',is_active:true,iconic_taxon_name:'Mammalia',default_photo:{medium_url:'https://example.org/koala.jpg',attribution:'Author',license_code:'cc-by'}},{id:500,name:'Tree',is_active:true,iconic_taxon_name:'Plantae'}]});
  const results=await app.Providers.searchTaxa('Koala');assert.equal(results.length,1);assert.equal(results[0].taxonId,420);assert.equal(results[0].lat,null);assert.equal(results[0].photoAttribution,'Author');assert.equal(results[0].countryCode,undefined);
});
