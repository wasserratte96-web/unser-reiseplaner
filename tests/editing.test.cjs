const test=require('node:test');
const assert=require('node:assert/strict');
const load=require('./app-harness.cjs');
function setup(){const h=load(),s=h.app.getState(),v={id:'v',startDate:'2027-04-10',endDate:'2027-04-12',days:[{id:'d',date:'2027-04-10',startTime:'08:00',endTime:'20:00',stops:[]}],flights:[],connections:[],transfers:[]};s.trips=[{id:'t',destination:'Australien',versions:[v],wishlist:[]}];s.activeTripId='t';return {...h,v};}
test('canceling connection mode edits leaves the saved connection unchanged',()=>{
  const h=setup(),connection={id:'c',mode:'flight',number:'QF9',from:'Sydney',to:'Perth',departDate:'2027-04-10',arriveDate:'2027-04-10'};
  h.v.connections=[connection];const snapshot=JSON.stringify(connection);
  h.app.connectionModal(connection);h.flushTimers();
  const mode=h.elements.get('#mConnMode');mode.value='car';mode.onchange();h.app.closeModal();
  assert.equal(JSON.stringify(connection),snapshot);
});
test('canceling transfer mode edits leaves the saved transfer unchanged',async()=>{
  const h=setup();h.v.connections=[{id:'c',mode:'flight',from:'Sydney',to:'Perth',arriveDate:'2027-04-10'}];h.v.days[0].stops=[{id:'h',type:'hotel',name:'Hotel',lat:-32,lng:115}];
  const transfer={id:'tr',mode:'transit',sourceRef:'connection:c',toStopId:'h',date:'2027-04-10',transferType:'to_lodging',provider:'Bus'};
  h.v.transfers=[transfer];const snapshot=JSON.stringify(transfer);
  await h.app.transferModal(transfer);h.flushTimers();const mode=h.elements.get('#mTransferMode');mode.value='taxi';mode.onchange();h.app.closeModal();
  assert.equal(JSON.stringify(transfer),snapshot);
});
test('an old detail response cannot attach controls to a newer dialog',async()=>{
  const h=setup();let resolve;
  h.app.Providers.verifiedPlaceDetails=()=>new Promise(r=>{resolve=r;});h.app.Providers.verifiedPhotosForItem=async()=>[];
  const request=h.app.openSuggestionDetail('poi',{name:'Museum',lat:-32,lng:115});
  h.app.showModal('A different dialog');resolve({title:'Museum',summary:'Old details',verified:true});await request;
  assert.equal(h.elements.get('#modalContent').innerHTML,'A different dialog');
  assert.equal(h.elements.get('#detailBody').innerHTML,'');
});
test('a false native save result is reported as an error',()=>{
  const h=setup();h.context.AndroidBridge={saveState:()=>false};h.app.persistSoon();h.flushTimers(250);
  assert.equal(h.elements.get('#syncState').textContent,'Speicherfehler');
});
test('editing a connection moves its associated transfer dates and invalidates changed terminals',()=>{
  const h=setup();h.v.transfers=[{id:'t',sourceRef:'connection:c',transferType:'to_lodging',date:'2027-04-10',fromLat:-32,fromLng:115,timeEstimated:false}];
  h.app.syncConnectionTransfers(h.v,{id:'c',mode:'train',to:'New terminal',arriveDate:'2027-04-12'},{mode:'flight',to:'Old terminal'});
  assert.equal(h.v.transfers[0].date,'2027-04-12');assert.equal(h.v.transfers[0].timeEstimated,true);assert.equal(h.v.transfers[0].fromLat,null);
});
test('recalculating stop routes does not double count an explicit automatic connection',async()=>{
  const h=setup(),day=h.v.days[0];day.stops=[{id:'a',wishlistKey:'a',lat:-32,lng:115},{id:'b',wishlistKey:'b',lat:-33,lng:116}];
  h.v.connections=[{id:'c',fromWishlistKey:'a',toWishlistKey:'b',departDate:day.date}];
  let called=false;h.app.Providers.route=async()=>{called=true;return {distanceKm:100,durationMin:100};};
  await h.app.refreshDayRoutes(day,false);assert.equal(called,false);assert.equal(day.stops[0].routeToNext,null);
});
