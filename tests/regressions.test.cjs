const test = require('node:test');
const assert = require('node:assert/strict');
const loadApp = require('./app-harness.cjs');

function trip(app,days=3) {
  const v={id:'v',name:'Original',startDate:'2027-04-10',endDate:app.addDays('2027-04-10',days-1),days:[],flights:[],connections:[],transfers:[]};
  for(let i=0;i<days;i++)v.days.push({id:'d'+i,date:app.addDays(v.startDate,i),startTime:'08:00',endTime:'20:00',stops:[]});
  const t={id:'t',title:'Test',destination:'Australien',country:'Australien',wishlist:[],versions:[v],selectedVersionId:'v'};
  const s=app.getState();s.trips=[t];s.activeTripId=t.id;return {t,v};
}
test('missing wildlife coordinates invoke the taxon hotspot lookup',async()=>{
  const {app}=loadApp(process.env.URP_BASELINE);trip(app);
  let called=0;app.Providers.wildlifeBestHotspot=async()=>{called++;return {lat:-32,lng:115.5,count:8};};
  const [node]=await app.resolveWishlistNodes([{key:'wildlife:123',name:'Quokka',kind:'wildlife',lat:null,lng:null,item:{taxonId:123}}]);
  assert.equal(called,1);assert.equal(node.lat,-32);assert.equal(node.lng,115.5);
});
test('choosing a wish never turns absent coordinates into Null Island',()=>{
  const {app}=loadApp(process.env.URP_BASELINE);const {t}=trip(app);
  app.setWishlistSelection('wildlife',{name:'Quokka',taxonId:123,lat:null,lng:null});
  assert.equal(t.wishlist[0].lat,null);assert.equal(t.wishlist[0].lng,null);
});
test('a fully blocked day cannot report positive buffer for an unscheduled visit',()=>{
  const {app}=loadApp(process.env.URP_BASELINE);const {v}=trip(app,1),day=v.days[0];
  day.stops=[{id:'s',name:'Museum',durationWish:90,fixedStart:'19:00'}];
  const result=app.computeDay(v,day);
  assert.ok(result.buffer<0);assert.ok(result.rows[0].overflow);
});
test('check-out date is excluded when choosing a night at an accommodation',()=>{
  const {app}=loadApp(process.env.URP_BASELINE);const {v}=trip(app);
  v.days[0].stops.push({id:'h',type:'hotel',accommodation:{checkInDate:'2027-04-10',checkOutDate:'2027-04-11'}});
  assert.equal(app.accommodationsForDate(v,'2027-04-11').length,0);
});
test('a copied route remaps connection and lodging references independently',()=>{
  const {app}=loadApp();const {v}=trip(app);
  v.days[0].stops=[{id:'h',type:'hotel',name:'Hotel'}];
  v.connections=[{id:'c',mode:'train'}];v.transfers=[{id:'tr',sourceRef:'connection:c',toStopId:'h'}];
  const copy=app.cloneVersion(v,'Kopie');
  assert.equal(copy.transfers[0].sourceRef,'connection:'+copy.connections[0].id);
  assert.equal(copy.transfers[0].toStopId,copy.days[0].stops[0].id);
  copy.days[0].stops[0].name='Changed';assert.equal(v.days[0].stops[0].name,'Hotel');
});

test('a connection only blocks days it actually crosses',()=>{
  const {app}=loadApp(process.env.URP_BASELINE);const {v}=trip(app,3);
  v.connections=[{id:'c',mode:'train',departDate:'2027-04-11',departTime:'10:00',arriveDate:'2027-04-11',arriveTime:'12:00',departureBuffer:0,arrivalBuffer:0}];
  assert.equal(app.dayConstraints(v,v.days[0]).available,720);
  assert.equal(app.dayConstraints(v,v.days[1]).available,600);
  assert.equal(app.dayConstraints(v,v.days[2]).available,720);
});

test('the generated model is feasible in the actual day renderer and preserves its base',async()=>{
  const {app}=loadApp();const {t,v:base}=trip(app,14);
  t.wishlist=[{key:'Sydney',name:'Sydney',lat:-33.86,lng:151.2,kind:'city',priority:'must'},{key:'Perth',name:'Perth',lat:-31.95,lng:115.86,kind:'city',priority:'must'}];
  const before=JSON.stringify(base);const v=await app.buildAutomaticRoute({includeOptional:true});
  assert.equal(JSON.stringify(base),before);assert.equal(t.versions.length,2);
  for(const d of v.days){assert.deepEqual(Array.from(app.computeDay(v,d).conflicts),[],d.date);}
  for(const d of v.days.slice(0,-1))assert.equal(app.accommodationsForDate(v,d.date).length,1);
  assert.equal(app.accommodationsForDate(v,v.endDate).length,0);
});

module.exports={trip};
