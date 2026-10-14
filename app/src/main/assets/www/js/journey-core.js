/* Journey preferences, access chains and season discovery. No timetable service. */
(function(root){
  'use strict';
  const P=root.URPPlanner||(typeof require==='function'?require('./planner-core.js'):null);
  const labels={public:'Öffentliche Verkehrsmittel',assisted:'Ohne Mietwagen · mit Transfers',motor:'Auto oder Camper'};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function policy(input={}){
    return {mode:labels[input.mode]?input.mode:'public',allowFlights:input.allowFlights===true,allowTaxi:input.allowTaxi===true,allowTours:input.allowTours===true,allowShuttle:input.allowShuttle===true,maxWalkMin:Math.max(0,Math.min(900,Number.isFinite(+input.maxWalkMin)?+input.maxWalkMin:240))};
  }
  function allowed(mode,p){
    p=policy(p);if(mode==='flight')return p.allowFlights;
    if(['walk','transit','train','bus','ferry'].includes(mode))return true;
    if(['car','camper','rentalcar'].includes(mode))return p.mode==='motor';
    if(['taxi','rideshare'].includes(mode))return p.mode!=='public'&&p.allowTaxi;
    if(mode==='tour')return p.mode!=='public'&&p.allowTours;
    if(mode==='shuttle')return p.mode!=='public'&&p.allowShuttle;
    return false;
  }
  function access(input){
    if(!input)return null;
    const baseName=String(input.baseName||'').trim();if(!baseName)throw new Error('Ausgangsort angeben.');
    const lat=P.coordinate(input.baseLat,90),lng=P.coordinate(input.baseLng,180);
    if((lat===null)!==(lng===null)||([input.baseLat,input.baseLng].some(v=>v!=null&&String(v).trim()!=='')&&(lat===null||lng===null)))throw new Error('Koordinaten des Ausgangsorts vollständig eingeben.');
    const out={...input,baseName,baseLat:lat,baseLng:lng,mode:input.mode||'walk'};
    for(const k of ['outboundMin','returnMin','walkMin']){
      const v=input[k];out[k]=v==null||String(v).trim()===''?null:Number(v);
      if(out[k]!==null&&(!Number.isFinite(out[k])||out[k]<0||out[k]>1440))throw new Error('Wegzeiten zwischen 0 und 1440 Minuten eingeben.');
    }
    if(out.mode==='walk'&&out.outboundMin!==null&&out.returnMin!==null)out.walkMin=Math.max(out.walkMin||0,out.outboundMin+out.returnMin);
    return out;
  }
  function directions(from,to,mode='transit'){
    const point=p=>typeof p==='string'?p:P.hasLocation(p)?`${p.lat},${p.lng}`:p?.name||'';
    const u=new URL('https://www.google.com/maps/dir/');u.searchParams.set('api','1');
    if(point(from))u.searchParams.set('origin',point(from));u.searchParams.set('destination',point(to));
    u.searchParams.set('travelmode',mode==='walk'?'walking':['car','rentalcar','camper','taxi'].includes(mode)?'driving':'transit');return u.href;
  }
  function placeLink(point){const u=new URL('https://www.google.com/maps/search/');u.searchParams.set('api','1');u.searchParams.set('query',typeof point==='string'?point:P.hasLocation(point)?`${point.lat},${point.lng}`:point?.name||'');return u.href;}
  function endpoint(c,side){
    const e=c[side+'Endpoint'];
    if(e&&P.hasLocation(e))return {...e,side};
    const old={name:c[side],lat:c[side+'Lat'],lng:c[side+'Lng'],kind:'unknown',legacy:true};
    return P.hasLocation(old)?{...old,side}:null;
  }
  function mapConnections(connections,dates){
    const selected=new Set(dates);
    return connections.filter(c=>selected.has(c.departDate)||selected.has(c.arriveDate)).map(c=>({connection:c,from:endpoint(c,'from'),to:endpoint(c,'to')}));
  }
  function seasonMonths(profiles,ids){
    const selected=profiles.filter(p=>ids.includes(p.id));
    return Array.from({length:12},(_,i)=>({month:i+1,matched:selected.filter(p=>p.months.includes(i+1)),missing:selected.filter(p=>!p.months.includes(i+1)),total:selected.length})).sort((a,b)=>b.matched.length-a.matched.length||a.month-b.month);
  }
  function matchProfiles(profiles,{month,query='',interest='all',days=14,mobility}={}){
    const q=norm(query);return profiles.filter(p=>(!month||p.months.includes(+month))&&(!q||norm([p.name,p.base,...Object.values(p.discover)].join(' ')).includes(q))&&(interest==='all'||p.focus.includes(interest))).map(p=>{
      const transit=p.access==='public'?'ÖPNV und Fußwege grundsätzlich nutzbar':p.access==='assisted'?'Für Naturziele Transfer oder Tour prüfen':'Zugang je Ziel noch prüfen';
      const compatible=!mobility||policy(mobility).mode!=='public'||p.access!=='assisted';
      return {...p,compatible,enoughDays:Number(days)>=p.minDays,transit};
    }).filter(p=>p.compatible).sort((a,b)=>Number(b.compatible)-Number(a.compatible)||Number(b.enoughDays)-Number(a.enoughDays)||a.name.localeCompare(b.name,'de'));
  }
  function draft(wishes,{days,mobility,dayStart='08:00',dayEnd='20:00',dayBudgets={},lodgings={},occupied=[],existingKeys=[],origin=''}={}){
    const p=policy(mobility),reserved=new Set(occupied),existing=new Set(existingKeys),result=days.map(d=>({date:d,events:[],reserved:reserved.has(d)}));
    const returnDay=origin?result.findLast(d=>!d.reserved):null;if(returnDay)returnDay.reserved=true;
    const deferred=[],included=[],defaultStart=P.minutes(dayStart),defaultEnd=P.minutes(dayEnd);let start=defaultStart,end=defaultEnd;
    if(start===null||end===null||end<=start)throw new Error('Tageszeiten prüfen.');
    let index=0,cursor=start,lastBase='',lastNode=null;
    const budget=()=>{const b=dayBudgets[result[index]?.date];start=P.minutes(b?.start)??defaultStart;end=P.minutes(b?.end)??defaultEnd;};
    const seek=()=>{budget();while(index<result.length&&(result[index].reserved||cursor>=end)){index++;budget();cursor=start;}cursor=Math.max(cursor,start);return index<result.length;};
    const next=()=>{index++;budget();cursor=start;return seek();};
    for(const wish of wishes){
      if(existing.has(wish.key)){included.push(wish.key);continue;}
      const snapshot={index,cursor,lastBase,lastNode,events:result.map(d=>d.events.length)};
      let reason='';let a;
      try{a=access(wish.access);}catch(e){deferred.push({...wish,reason:e.message});continue;}
      if(!a&&!P.hasLocation(wish)){deferred.push({...wish,reason:wish.kind==='wildlife'?'Zuerst einen konkreten Beobachtungsort oder Ausgangsort für diesen Tierwunsch auswählen.':'Zuerst den Standort suchen oder einen Ausgangsort und Zugang ergänzen.'});continue;}
      if(a&&!allowed(a.mode,p))reason='Der Zugang braucht ein nicht erlaubtes Verkehrsmittel.';
      if(a&&a.walkMin!==null&&a.walkMin>p.maxWalkMin)reason='Der Fußweg überschreitet deine gewählte Gehzeit.';
      const base=a?{name:a.baseName,lat:a.baseLat,lng:a.baseLng}:wish;
      const lodgingMatches=()=>!(lodgings[result[index]?.date]||[]).length||(lodgings[result[index]?.date]||[]).some(h=>P.hasLocation(base)&&P.hasLocation(h)?P.distance(base,h)<=30:norm(h.name).includes(norm(base.name)));
      const walkingUsed=()=>result[index].events.filter(e=>e.type==='visit').reduce((n,e)=>n+(e.access?.walkMin||0),0);
      const baseKey=norm(base.name)+'|'+(P.hasLocation(base)?`${base.lat},${base.lng}`:'');
      const visit=P.duration(wish),known=!a||(a.outboundMin!==null&&a.returnMin!==null),total=known?visit+(a?.outboundMin||0)+(a?.returnMin||0):null;
      if(known&&total>Math.max(defaultEnd-defaultStart,...Object.values(dayBudgets).map(b=>(P.minutes(b.end)||defaultEnd)-(P.minutes(b.start)||defaultStart))))reason='Hinweg, Aufenthalt und Rückweg passen nicht in einen Tag.';
      const photo=wish.photography||{};let photoStart=null,photoEnd=null;
      if(photo.windowStart||photo.windowEnd){photoStart=P.minutes(photo.windowStart);photoEnd=P.minutes(photo.windowEnd);if(photoStart===null||photoEnd===null||photoEnd-photoStart<visit)reason='Das Fotozeitfenster ist zu kurz oder unvollständig.';if(!known)reason='Für das Fotozeitfenster zuerst Hin- und Rückweg ergänzen.';}
      if(reason){deferred.push({...wish,reason});continue;}
      if(!seek())reason='Keine freien Tage im vorhandenen Plan.';
      if(!reason&&lastBase&&lastBase!==baseKey){
        if(result[index].events.length&&!next())reason='Kein Tag für den Ortswechsel verfügbar.';
        if(!reason){result[index].events.push({type:'travel',from:lastNode,to:base,mode:p.mode==='motor'?'car':'other'});if(!next())reason='Nach dem Ortswechsel fehlt ein Aufenthaltstag.';}
      }
      if(!reason&&!lastBase&&origin){result[index].events.push({type:'arrival',from:{name:origin},to:base,mode:'other'});if(!next())reason='Nach der Anreise fehlt ein Aufenthaltstag.';}
      for(let n=0;!reason&&n<Math.max(1,Math.min(30,+wish.stayDays||1));n++){
        if(n>0&&!next()){reason='Für die Aufenthaltsdauer fehlen freie Tage.';break;}
        while(!lodgingMatches()||walkingUsed()+(a?.walkMin||0)>p.maxWalkMin){const lodgingBlocked=!lodgingMatches();if(!next()){reason=lodgingBlocked?'Kein freier Tag passt zum Ausgangsort und zur gebuchten Unterkunft.':'Für die tägliche Gehzeitgrenze fehlt ein weiterer freier Tag.';break;}}
        if(reason)break;
        let when=cursor;
        if(photoStart!==null)when=Math.max(when,photoStart-(a?.outboundMin||0));
        if(known&&(when+total>end||(photoEnd!==null&&when+(a?.outboundMin||0)+visit>photoEnd))){
          if(!next()){reason='Kein freier Tag für diesen Wunsch.';break;}
          while(!lodgingMatches()){if(!next()){reason='Kein freier Tag passt zum Ausgangsort und zur gebuchten Unterkunft.';break;}}
          if(reason)break;
          when=photoStart!==null?Math.max(start,photoStart-(a?.outboundMin||0)):start;
        }
        if(known&&(when+total>end||(photoEnd!==null&&when+(a?.outboundMin||0)+visit>photoEnd))){reason='Fotozeitfenster und Zugang passen nicht in die Tageszeiten.';break;}
        result[index].events.push({type:'visit',wish,base,access:a,start:known?when:null,end:known?when+total:null,visitStart:known?when+(a?.outboundMin||0):null,visitMin:visit,part:n+1});
        cursor=known?when+total:end;
      }
      if(reason){for(let i=0;i<result.length;i++)result[i].events.length=snapshot.events[i];({index,cursor,lastBase,lastNode}=snapshot);budget();deferred.push({...wish,reason});continue;}
      lastBase=baseKey;lastNode=base;included.push(wish.key);
    }
    if(returnDay){returnDay.reserved=false;if(lastNode)returnDay.events.push({type:'departure',from:lastNode,to:{name:origin},mode:'other'});}
    return {days:result,deferred,includedKeys:included,missingMust:deferred.filter(w=>w.priority==='must'),status:'draft'};
  }
  const api={labels,policy,allowed,access,directions,placeLink,endpoint,mapConnections,seasonMonths,matchProfiles,draft};
  root.URPJourney=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
