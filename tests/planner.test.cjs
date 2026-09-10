const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../app/src/main/assets/www/js/planner-core.js');
const opts={startDate:'2027-04-10',endDate:'2027-04-23',dayStart:'08:00',dayEnd:'20:00',arrivalTime:'10:00',departureTime:'18:00',maxDriveMin:360};
const node=(key,lat,lng,priority='must',kind='highlight')=>({key,name:key,lat,lng,priority,kind});
function validPlan(result,options=opts){
  assert.ok(result.fits);assert.equal(result.days.length,P.dayCount(options.startDate,options.endDate));
  for(const day of result.days){let end=-1;assert.ok(day.drivingMin<=(options.maxDriveMin||360));
    for(const e of day.events){const start=e.blockStart??e.start;assert.ok(start>=end,JSON.stringify(day));assert.ok(e.end<=1200,JSON.stringify(day));end=e.blockEnd??e.end;}
  }
}
test('calendar days are stable across DST, leap days and invalid dates',()=>{
  assert.equal(P.dayCount('2027-03-27','2027-03-29'),3);
  assert.equal(P.addDays('2028-02-28',1),'2028-02-29');
  assert.ok(Number.isNaN(P.dayCount('2027-02-29','2027-03-01')));
  assert.throws(()=>P.plan([],{...opts,endDate:'2027-04-09'}));
});
test('coordinate validation preserves real zero and rejects empty/out of range values',()=>{
  for(const value of [null,undefined,'',true,'bad',Infinity,91])assert.equal(P.coordinate(value,90),null);
  assert.equal(P.coordinate('0',90),0);assert.equal(P.coordinate(-89.9,90),-89.9);
});
test('nearby mandatory wishes cannot overflow the final day',()=>{
  const wishes=Array.from({length:12},(_,i)=>node('n'+i,-31.9+i*.001,115.8));
  const options={...opts,endDate:opts.startDate};const result=P.plan(wishes,options);
  validPlan(result,options);assert.ok(result.deferred.length>0);assert.ok(result.missingMust.length>0);
  assert.equal(new Set([...result.includedKeys,...result.deferred.map(n=>n.key)]).size,12);
});
test('a road journey across Australia is split into driving days, never silently flown',()=>{
  const result=P.plan([node('Sydney',-33.86,151.2),node('Perth',-31.95,115.86)],{...opts,allowFlights:false,roadMode:'camper'});
  validPlan(result);assert.equal(result.deferred.length,0);
  const legs=result.days.flatMap(d=>d.events).filter(e=>e.type==='connection');
  assert.ok(legs.length>3);assert.ok(legs.every(e=>e.leg.mode==='camper'));
  assert.ok(result.days.some(d=>d.location?.kind==='transit'));
});
test('priority is honored before optional detours and start/end anchors are retained',()=>{
  const wishes=[node('Optional',-25,130,'optional'),node('Start',-31.95,115.86),node('End',-31.96,115.87)];
  const options={...opts,endDate:'2027-04-11',startKey:'Start',endKey:'End'};
  const result=P.plan(wishes,options);validPlan(result,options);
  assert.equal(result.ordered[0].key,'Start');assert.equal(result.ordered.at(-1).key,'End');
  assert.ok(result.deferred.some(n=>n.key==='Optional'));
});
test('requested city stay days are respected without duplicating unrequested city days',()=>{
  const city={...node('Melbourne',-37.81,144.96,'must','city'),stayDays:1};
  const one=P.plan([city],opts);assert.equal(one.days.flatMap(d=>d.events).filter(e=>e.type==='activity').length,1);
  const three=P.plan([{...city,stayDays:3}],opts);validPlan(three);
  assert.equal(three.days.filter(d=>d.events.some(e=>e.type==='activity')).length,3);
});
test('verified road estimates determine feasibility and disconnected routes stay deferred',()=>{
  const a=node('A',0,0),b=node('B',0,1),options={...opts,endDate:'2027-04-11',legs:{'A|B':{mode:'car',durationMin:5000,distanceKm:100,source:'OSRM',approx:false}}};
  assert.ok(P.plan([a,b],options).deferred.some(n=>n.key==='B'));
  options.legs['A|B'].unreachable=true;
  assert.match(P.plan([a,b],options).deferred[0].reason,/Straßenroute/);
});
test('flight transfers and buffers form a single chronological reservation',()=>{
  const result=P.plan([node('Sydney',-33.86,151.2),node('Perth',-31.95,115.86)],opts);
  validPlan(result);const flight=result.days.flatMap(d=>d.events).find(e=>e.leg?.mode==='flight');
  assert.ok(flight);assert.equal(flight.start-flight.blockStart,175);assert.equal(flight.blockEnd-flight.end,115);
});
