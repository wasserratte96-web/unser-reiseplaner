/* Calendar and route planning without UI, storage or network dependencies. */
(function(root) {
  'use strict';
  const weights = {must:4, high:3, normal:2, optional:1};
  function coordinate(value, limit) {
    if (value == null || typeof value === 'boolean' || !['string','number'].includes(typeof value) || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
  }
  function hasLocation(point) {
    return coordinate(point?.lat,90) !== null && coordinate(point?.lng,180) !== null;
  }
  function dateNumber(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
    const n = Date.parse(value+'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === value ? n / 86400000 : NaN;
  }
  function addDays(date, days) {
    const n=dateNumber(date);
    return Number.isFinite(n) ? new Date((n+days)*86400000).toISOString().slice(0,10) : '';
  }
  function dayCount(start,end) { return dateNumber(end)-dateNumber(start)+1; }
  function minutes(clock) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock || '')) return null;
    const [h,m]=clock.split(':').map(Number);return h*60+m;
  }
  function clock(value) {
    if (!Number.isFinite(value) || value<0 || value>=1440) return '';
    const n=Math.round(value);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  }
  function distance(a,b) {
    if (!hasLocation(a)||!hasLocation(b)) return Infinity;
    const rad=n=>n*Math.PI/180;
    const q=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
    return 12742*Math.asin(Math.sqrt(Math.min(1,q)));
  }
  function duration(node) {
    const n=Number(node.durationMin);
    return Number.isFinite(n)&&n>=15 ? n : node.kind==='city'?300:node.kind==='wildlife'?180:150;
  }
  function order(nodes,options={}) {
    if (!nodes.length) return [];
    let remaining=[...nodes];
    const start=remaining.find(n=>n.key===options.startKey)||(options.orderMode==='wishlist'?remaining[0]:[...remaining].sort((a,b)=>(weights[b.priority]||0)-(weights[a.priority]||0)||a.key.localeCompare(b.key))[0]);
    const result=[start];remaining=remaining.filter(n=>n!==start);
    const end=remaining.find(n=>n.key===options.endKey);
    if(end)remaining=remaining.filter(n=>n!==end);
    if(options.orderMode==='wishlist'){result.push(...remaining);if(end)result.push(end);return result;}
    while(remaining.length) {
      const last=result[result.length-1];
      remaining.sort((a,b)=>distance(last,a)-distance(last,b)||a.key.localeCompare(b.key));
      result.push(remaining.shift());
    }
    if(end)result.push(end);return result;
  }
  function estimateLeg(a,b,options={}) {
    const cached=options.legs?.[a.key+'|'+b.key];
    if(cached) return {...cached};
    const km=distance(a,b),roadMode=options.roadMode||'rentalcar';
    if(options.allowFlights!==false&&km>700) return {mode:'flight',distanceKm:km,durationMin:Math.max(75,Math.ceil(km/700*60)),departureBuffer:120,arrivalBuffer:60,transferBefore:55,transferAfter:55,approx:true,source:'Planungsschätzung'};
    return {mode:roadMode,distanceKm:km*1.25,durationMin:Math.max(0,Math.ceil(km*1.25/65*60)),departureBuffer:0,arrivalBuffer:0,transferBefore:0,transferAfter:0,approx:true,source:'Luftlinien-Schätzung'};
  }
  function schedule(nodes,options) {
    const count=dayCount(options.startDate,options.endDate),start=minutes(options.dayStart||'08:00'),end=minutes(options.dayEnd||'20:00');
    if(!Number.isInteger(count)||count<1||count>366||start===null||end===null||end<=start) throw new Error('Gültigen Reisezeitraum (1–366 Tage) und Tageszeiten wählen.');
    const arrival=minutes(options.arrivalTime||'10:00'),departure=minutes(options.departureTime||'18:00');
    if(arrival===null||departure===null)throw new Error('Ankunfts- und Abfahrtszeit fehlen.');
    const maxDrive=Math.max(60,Math.min(600,Number(options.maxDriveMin)||360));
    const days=Array.from({length:count},(_,i)=>({date:addDays(options.startDate,i),events:[],location:null,drivingMin:0,visitMin:0}));
    // Arrival/departure include 30 minutes terminal buffer and 55 minutes transfer.
    const windowStart=i=>Math.max(start,i===0?arrival+85:start);
    const windowEnd=i=>Math.min(end,i===count-1?departure-85:end)-(i<count-1?20:0)-30;
    let di=0,cursor=windowStart(0),location=nodes[0]||null;
    const fail=reason=>({fits:false,reason,days});
    const nextDay=()=>{
      days[di].location=location;di++;if(di>=count)return false;
      cursor=windowStart(di);return true;
    };
    let previous=null,flightArrivalDay=-1;
    for(const node of nodes) {
      if(previous) {
        const ac=previous.countryCode||previous.item?.countryCode,bc=node.countryCode||node.item?.countryCode;
        const leg={...estimateLeg(previous,node,options),fromCountry:previous.country||previous.item?.country||'',toCountry:node.country||node.item?.country||'',countryChange:!!(ac&&bc&&ac!==bc)};
        if(!Number.isFinite(leg.durationMin)||leg.durationMin<0) return fail('Keine belastbare Verbindungsdauer verfügbar');
        if(leg.unreachable)return fail('Keine befahrbare Straßenroute; Fähre oder andere Verbindung ergänzen');
        if(leg.mode==='flight') {
          // A flight day starts at the preceding night's location.
          if(days[di].events.length&&!nextDay())return fail('Kein weiterer Tag für die Flugverbindung');
          const overhead=leg.departureBuffer+leg.arrivalBuffer+leg.transferBefore+leg.transferAfter;
          const total=Math.ceil(leg.durationMin)+overhead;
          while(cursor+total>windowEnd(di))if(!nextDay())return fail('Flug, Transfers und Puffer passen nicht in den Zeitraum');
          const depart=cursor+leg.departureBuffer+leg.transferBefore;
          days[di].events.push({type:'connection',from:previous,to:node,leg,start:depart,end:depart+Math.ceil(leg.durationMin),blockStart:cursor,blockEnd:cursor+total});
          cursor+=total;flightArrivalDay=di;location=node;
        } else {
          if(flightArrivalDay===di&&!nextDay())return fail('Weiterreise nach dem Flug braucht einen weiteren Tag');
          let left=Math.ceil(leg.durationMin),completed=0,from=previous;
          while(left>0) {
            const available=windowEnd(di)-cursor;
            let drive=Math.min(left,maxDrive-days[di].drivingMin,Math.max(0,available-30));
            if(drive<Math.min(left,30)) { if(!nextDay())return fail('Fahrt und Pausen überschreiten das Tagesbudget'); continue; }
            const pause=drive>120?30:0;
            if(drive+pause>available)drive=Math.max(0,available-pause);
            if(drive===0){if(!nextDay())return fail('Kein Zeitfenster für die Fahrt');continue;}
            completed+=drive;left-=drive;
            const destination=left===0?node:{key:'transit:'+previous.key+':'+node.key+':'+di,name:'Unterwegs: '+previous.name+' → '+node.name,kind:'transit',lat:null,lng:null};
            const segment={...leg,durationMin:drive+pause,drivingMin:drive,breakMin:pause,distanceKm:leg.durationMin?leg.distanceKm*drive/leg.durationMin:0,geometry:left===0&&completed===leg.durationMin?leg.geometry:null};
            days[di].events.push({type:'connection',from,to:destination,leg:segment,start:cursor,end:cursor+drive+pause,blockStart:cursor,blockEnd:cursor+drive+pause});
            days[di].drivingMin+=drive;cursor+=drive+pause;location=destination;from=destination;
            if(left>0&&!nextDay())return fail('Für die lange Fahrt fehlen weitere Reisetage');
          }
          location=node;
        }
      }
      const stay=Math.max(1,Math.min(30,Math.floor(Number(node.stayDays)||1))),visit=duration(node);
      const visitLimit=Number(options.maxVisitMin)||Infinity;
      if(visit>visitLimit)return fail('Gewünschter Aufenthalt ist länger als das gewählte tägliche Aktivitätenbudget');
      const photo=node.photography||{},hasWindow=!!(photo.windowStart||photo.windowEnd);
      const photoStart=hasWindow?minutes(photo.windowStart):0,photoEnd=hasWindow?minutes(photo.windowEnd):1440;
      if(hasWindow&&(photoStart===null||photoEnd===null||photoEnd<=photoStart||visit>photoEnd-photoStart))return fail('Aufenthalt passt nicht in das festgelegte Fotozeitfenster');
      for(let i=0;i<stay;i++) {
        if(i>0&&!nextDay())return fail('Gewünschte Aufenthaltsdauer überschreitet den Zeitraum');
        while(Math.max(cursor,photoStart)+visit>Math.min(windowEnd(di),photoEnd)||days[di].visitMin+visit>visitLimit)if(!nextDay())return fail(hasWindow?'Fotozeitfenster, Anreise und Tagesbudget passen nicht zusammen':'Aufenthalt und Verbindungen passen nicht in die verfügbaren Tage');
        cursor=Math.max(cursor,photoStart);
        days[di].events.push({type:'activity',node,start:cursor,end:cursor+visit,part:i+1});cursor+=visit;days[di].visitMin+=visit;location=node;
      }
      previous=node;
    }
    days[di].location=location;
    for(let i=di+1;i<count;i++)days[i].location=location;
    return {fits:true,days,ordered:nodes};
  }
  function plan(nodes,options) {
    const valid=nodes.filter(hasLocation),deferred=nodes.filter(n=>!hasLocation(n)).map(n=>({...n,reason:n.resolveError||'Kein belastbarer Standort gefunden'}));
    let selected=[];
    const ranked=[...valid].sort((a,b)=>Number(b.key===options.startKey||b.key===options.endKey)-Number(a.key===options.startKey||a.key===options.endKey)||(weights[b.priority]||0)-(weights[a.priority]||0)||a.key.localeCompare(b.key));
    for(const node of ranked) {
      if(node.priority==='optional'&&options.includeOptional===false) {deferred.push({...node,reason:'Optionale Ziele deaktiviert'});continue;}
      const candidates=options.orderMode==='wishlist'?nodes.filter(n=>selected.includes(n)||n===node):[...selected,node];
      const attempt=schedule(order(candidates,options),options);
      if(attempt.fits)selected=candidates;else deferred.push({...node,reason:attempt.reason});
    }
    const result=schedule(order(selected,options),options);
    return {...result,deferred,includedKeys:selected.map(n=>n.key),missingMust:deferred.filter(n=>n.priority==='must')};
  }
  const api={coordinate,hasLocation,dateNumber,addDays,dayCount,minutes,clock,distance,duration,order,estimateLeg,schedule,plan};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.URPPlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this);
