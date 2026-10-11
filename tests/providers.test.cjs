const test=require('node:test');
const assert=require('node:assert/strict');
const load=require('./app-harness.cjs');

test('NoRoute is distinct from a temporary OSRM outage',async()=>{
  const {app,context}=load(),a={lat:0,lng:0},b={lat:0,lng:1};
  context.NativeHttp.request=async()=>JSON.stringify({code:'NoRoute'});
  assert.equal((await app.Providers.route(a,b)).unreachable,true);
  context.NativeHttp.request=async()=>{throw new Error('Offline');};
  const estimated=await app.Providers.route(a,b);
  assert.equal(estimated.approx,true);assert.equal(estimated.unreachable,undefined);assert.ok(estimated.durationMin>0);
});
test('public wildlife anchors exclude captive, obscured and inaccurate observations',()=>{
  const {app}=load(),point={geojson:{coordinates:[115.5,-32]},id:7};
  assert.equal(app.publicWildObservation(point),true);
  for(const extra of [{captive:true},{captive_cultivated:true},{obscured:true},{geoprivacy:'private'},{taxon_geoprivacy:'obscured'},{positional_accuracy:2000},{geojson:null}])assert.equal(app.publicWildObservation({...point,...extra}),false);
});
test('hotspots use the country place ID and an actual observation, never a synthetic centre',async()=>{
  const {app,context}=load();app.Providers.iNatPlace=async()=>({id:6744});let requested;
  const observations=[{id:1,observed_on:'2025-04-12',geojson:{coordinates:[115.50,-32]}},{id:2,observed_on:'2024-04-12',geojson:{coordinates:[115.51,-32.01]}},{id:3,captive:true,geojson:{coordinates:[149,-27]}}];
  context.NativeHttp.request=async url=>{requested=new URL(url);return JSON.stringify({results:observations});};
  const hotspot=await app.Providers.wildlifeBestHotspot(123,'Australien',4);
  assert.equal(requested.searchParams.get('place_id'),'6744');assert.equal(requested.searchParams.get('taxon_id'),'123');assert.equal(requested.searchParams.get('month'),'4');
  assert.equal(hotspot.count,2);assert.ok(observations.some(o=>o.geojson.coordinates[0]===hotspot.lng&&o.geojson.coordinates[1]===hotspot.lat));
});
test('city search uses the OSM area identity instead of the country bounding rectangle',async()=>{
  const {app}=load();let query;
  app.Providers.geocode=async()=>[{osmType:'relation',osmId:123,bbox:[-40,-10,110,160]}];
  app.Providers.overpassJson=async q=>{query=q;return {elements:[{id:5,type:'node',lat:-32,lon:115,tags:{place:'city',name:'Perth'}}]};};
  const cities=await app.Providers.cities('Australien');assert.match(query,/area\(3600000123\)/);assert.match(query,/nwr\(area.region\)/);assert.equal(cities[0].sourceId,'node/5');
});
test('nature discovery rejects a foreign country and an ordinary city',async()=>{
  const {app,context}=load();app.Providers.geocode=async()=>[{bbox:[-50,0,100,180],extratags:{wikidata:'Q408'}}];
  const page=(id,title,country)=>({title,coordinates:[{lat:-35,lon:140}],pageprops:{wikibase_item:id},categories:[{title:country}],extract:'Naturgebiet',fullurl:'https://de.wikipedia.org/wiki/'+title});
  context.NativeHttp.request=async url=>{
    if(url.includes('wbgetentities'))return JSON.stringify({entities:{Q1:{claims:{P17:[{mainsnak:{datavalue:{value:{id:'Q408'}}}}]}},Q2:{claims:{P17:[{mainsnak:{datavalue:{value:{id:'Q664'}}}}]}},Q3:{claims:{P17:[{mainsnak:{datavalue:{value:{id:'Q408'}}}}]}},Q4:{claims:{P17:[{mainsnak:{datavalue:{value:{id:'Q408'}}}}]}}}});
    return JSON.stringify({query:{pages:[page('Q1','Test Nationalpark','Kategorie:Nationalpark'),page('Q2','Fremder Nationalpark','Kategorie:Nationalpark'),page('Q3','Stadt am Nationalpark','Kategorie:Stadt in Australien'),page('Q4','Inselterritorium','Kategorie:Territorium in Australien')]}});
  };
  const result=await app.Providers.attractions('Australien');assert.equal(result.length,1);assert.equal(result[0].wikidata,'Q1');
});
test('wrongly linked Wikipedia text without a geographic identity is not accepted',async()=>{
  const {app}=load();app.Providers.wikiPageExact=async()=>({title:'Prince',summary:'Singer',lat:null,lng:null,verified:true});
  const result=await app.Providers.verifiedPlaceDetails({name:'Feuerwehrmuseum',lat:-37.81,lng:144.96,wikiTag:'en:Prince'},'Melbourne');
  assert.equal(result.verified,false);assert.equal(result.summary,'');
});
test('a failed highlight subquery preserves cultural landmarks from successful queries',async()=>{
  const {app,context}=load();app.Providers.geocode=async()=>[{bbox:[-50,0,100,180],extratags:{wikidata:'Q408'}}];
  const queries=[];
  context.NativeHttp.request=async url=>{
    const u=new URL(url);
    if(u.searchParams.get('action')==='wbgetentities')return JSON.stringify({entities:{Q9001:{claims:{P17:[{mainsnak:{datavalue:{value:{id:'Q408'}}}}]}}}});
    const query=u.searchParams.get('gsrsearch');queries.push(query);
    if(query.endsWith('Wahrzeichen'))throw new Error('Temporary Wikipedia error');
    if(!query.endsWith('UNESCO Welterbe'))return JSON.stringify({query:{pages:[]}});
    return JSON.stringify({query:{pages:[{title:'Historisches Opernhaus',coordinates:[{lat:-33.8,lon:151.2}],pageprops:{wikibase_item:'Q9001'},categories:[{title:'Kategorie:Welterbe in Australien'},{title:'Kategorie:Bauwerk'}],extract:'Ein historisches Opernhaus.'}]}});
  };
  const result=await app.Providers.attractions('Australien');
  assert.equal(queries.length,7);assert.equal(result.length,1);assert.equal(result[0].name,'Historisches Opernhaus');assert.equal(result[0].highlightType,'UNESCO Welterbe');
});
test('migration and import preserve legacy flights and target species without sharing objects',()=>{
  const {app}=load();const old={schema:4,trips:[{id:'t',targetSpecies:[{taxonId:123,name:'Quokka'}],versions:[{id:'v',flights:[{id:'f',number:'QF9'}],days:[{id:'d',stops:[]}]}]}]};
  const normalized=app.normalizeLoadedState(old);
  assert.equal(normalized.schema,7);assert.equal(normalized.trips[0].wishlist[0].item.taxonId,123);assert.equal(normalized.trips[0].versions[0].flights[0].number,'QF9');
  assert.equal(old.schema,4);assert.equal(old.trips[0].wishlist,undefined);
  assert.throws(()=>app.normalizeLoadedState({trips:[{versions:[]} ,{versions:[{days:[{}]}]}]}));
});
test('moving lodging invalidates associated route measurements and transfer certainty',()=>{
  const {app}=load();const hotel={id:'h',name:'Neue Unterkunft',lat:50,lng:14},prior={id:'s',routeToNext:{durationMin:10}},v={days:[{stops:[prior,hotel]}],transfers:[{toStopId:'h',transferType:'to_lodging',toLat:49,toLng:13,distanceKm:8,timeEstimated:false}]};
  app.invalidateStopRoutes(v,hotel);assert.equal(prior.routeToNext,null);assert.equal(v.transfers[0].timeEstimated,true);assert.equal(v.transfers[0].toName,hotel.name);assert.equal(v.transfers[0].distanceKm,0);
});
test('the same city name at different coordinates creates distinct wishes',()=>{
  const {app}=load();assert.notEqual(app.wishlistKey('city',{name:'Springfield',lat:1,lng:2}),app.wishlistKey('city',{name:'Springfield',lat:4,lng:5}));
});
