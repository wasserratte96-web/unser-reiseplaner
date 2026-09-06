(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const DAY_COLORS = ['#d62828','#1565c0','#2e7d32','#6a1b9a','#ef6c00','#00838f','#ad1457','#5d4037','#7b8f00','#00796b','#4527a0','#c2410c','#2563eb','#111827','#b45309','#0e7490','#7c3aed','#166534','#be123c','#334155'];
const INTERESTS = ['Wildlife','Natur','Landschaft','Städte & Architektur','Fotografie','Geschichte','Museen','Essen','Strand','Wandern','Nachtleben'];
const MODES = {car:'🚗 Auto',camper:'🚐 Camper',rentalcar:'🚗 Mietwagen',rideshare:'🚕 Uber/Rideshare',taxi:'🚕 Taxi',walk:'🚶 Zu Fuß',transit:'🚌 ÖPNV',ferry:'⛴ Fähre',train:'🚆 Zug',flight:'✈ Flug'};
const STOP_ICONS = {sight:'★',wildlife:'🐾',city:'🏙',nature:'🌿',food:'🍴',hotel:'🛏',hike:'🥾',viewpoint:'◉',beach:'🏖',transit:'⇄',other:'•'};

const UPDATE_REPOSITORY = 'wasserratte96-web/unser-reiseplaner';
const UPDATE_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
let installedAppVersion = {versionName:'1.1.3',versionCode:5,repository:UPDATE_REPOSITORY};
let availableUpdate = null;

let state = null;
let map = null;
let mapReady = false;
let mapStopLayer = null;
let mapRouteLayer = null;
let mapDayVisible = new Set();
let saveTimer = null;
let currentView = 'trips';
const discoverVisible = {cities:5,attractions:5,wildlife:5};

const NativeHttp = window.NativeHttp = {
  pending:new Map(),
  request(url){
    if(window.AndroidBridge && AndroidBridge.request){
      return new Promise((resolve,reject)=>{
        const id=uid('req');
        this.pending.set(id,{resolve,reject});
        AndroidBridge.request(id,url);
        setTimeout(()=>{ if(this.pending.has(id)){this.pending.delete(id); reject(new Error('Zeitüberschreitung'));}},25000);
      });
    }
    return fetch(url,{headers:{'Accept':'application/json'}}).then(r=>{if(!r.ok) throw new Error(`HTTP ${r.status}`);return r.text();});
  },
  __resolve(id,body,error){
    const p=this.pending.get(id); if(!p) return;
    this.pending.delete(id);
    if(error) p.reject(new Error(error)); else p.resolve(body);
  }
};

async function apiJson(url){
  const text = await NativeHttp.request(url);
  try{return JSON.parse(text);}catch(e){throw new Error('Ungültige Antwort der Datenquelle.');}
}

function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),2600);
  if(window.AndroidBridge?.toast && msg.length<120){ /* Native toast intentionally not duplicated */ }
}
function fmtDate(iso){ if(!iso) return '–'; const d=new Date(`${iso}T12:00:00`); return d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtShortDate(iso){ if(!iso) return '–'; const d=new Date(`${iso}T12:00:00`); return d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}); }
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function daysBetween(a,b){ if(!a||!b)return 0; return Math.floor((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)+1; }
function timeToMin(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function minToTime(m){if(m==null||!Number.isFinite(m))return'–';m=((Math.round(m)%1440)+1440)%1440;return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function durText(min){min=Math.max(0,Math.round(min||0));const h=Math.floor(min/60),m=min%60;return h?`${h} h ${m?m+' min':''}`.trim():`${m} min`}
function kmText(km){return km==null?'–':`${Number(km).toLocaleString('de-DE',{maximumFractionDigits:0})} km`}
function haversine(a,b){const R=6371,rad=x=>x*Math.PI/180;const dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng);const q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function normalizeName(x){return String(x||'').trim().toLowerCase();}

function defaultSettings(){return {defaultStart:'08:00',defaultEnd:'20:00',arrivalBuffer:60,departureBuffer:120};}
function emptyState(){return {schema:2,activeTripId:null,settings:defaultSettings(),trips:[],cache:{places:{},cities:{},wikidata:{},wildlife:{},photos:{}}};}

function sampleTrip(){
  const start='2027-04-10';
  const trip={id:uid('trip'),title:'Australien 2027',destination:'Australien',country:'Australien',interests:['Wildlife','Natur','Landschaft','Städte & Architektur','Fotografie'],dateWindows:[{id:uid('win'),start:'2027-04-03',end:'2027-04-17'},{id:uid('win'),start:'2027-04-10',end:'2027-04-24'}],selectedVersionId:null,versions:[]};
  const v={id:uid('ver'),name:'Nordroute – Ausgangsplanung',startDate:start,endDate:addDays(start,13),days:[],flights:[],transfers:[],createdAt:Date.now()};
  for(let i=0;i<14;i++)v.days.push({id:uid('day'),date:addDays(start,i),startTime:'08:00',endTime:'20:00',stops:[]});
  const S=(d,name,lat,lng,type='sight',dur=60,priority='high',note='',mode='car')=>v.days[d-1].stops.push({id:uid('stop'),name,lat,lng,type,priority,durationMin:dur,durationWish:dur,notes:note,openingHours:'',fixedStart:'',images:[],tags:[],wildlife:[],modeToNext:mode,routeToNext:null});
  S(1,'The Rocks',-33.8599,151.2090,'city',60,'high','Sydney Sightseeing','walk'); S(1,'Sydney Opera House',-33.8568,151.2153,'sight',60,'must','','walk'); S(1,'Royal Botanic Garden',-33.8642,151.2166,'nature',90,'high','','walk');
  S(2,'Federation Square',-37.8180,144.9691,'city',45,'high','','walk'); S(2,'Hosier Lane',-37.8166,144.9692,'sight',30,'normal','','walk'); S(2,'Queen Victoria Market',-37.8076,144.9568,'sight',90,'normal','','walk');
  S(3,'Anglesea Golf Club',-38.4059,144.1893,'wildlife',90,'must','Kängurus','car'); S(3,'Kennett River',-38.6658,143.8577,'wildlife',120,'must','Koalas','car'); S(3,'Apollo Bay',-38.7594,143.6720,'hotel',30,'high','','car');
  S(4,'Cape Otway',-38.8290,143.5160,'wildlife',120,'must','Koalas','car'); S(4,'Twelve Apostles',-38.6621,143.1051,'viewpoint',90,'must','','car'); S(4,'Loch Ard Gorge',-38.6466,143.0706,'viewpoint',60,'high','','car'); S(4,'Port Campbell',-38.6194,142.9953,'hotel',30,'high','','car');
  S(5,'Tower Hill Wildlife Reserve',-38.3268,142.3605,'wildlife',150,'must','Koalas, Kängurus, Emus','car'); S(5,'Halls Gap',-37.1403,142.5186,'wildlife',120,'must','Kängurus am Abend','car');
  S(6,'Halls Gap – Morgensichtung',-37.1365,142.5210,'wildlife',75,'must','Kängurus','car'); S(6,'Melbourne Airport',-37.6690,144.8410,'transit',30,'high','','car'); S(6,'Fremantle',-32.0569,115.7439,'city',90,'normal','','walk');
  S(7,'Rottnest Island',-32.0061,115.5125,'wildlife',420,'must','Quokkas','walk');
  S(8,'Yanchep National Park',-31.5470,115.6850,'wildlife',120,'high','Kängurus; Koala Viewing Area','car'); S(8,'Pinnacles Desert',-30.6032,115.1600,'nature',120,'must','','car'); S(8,'Cervantes',-30.5001,115.0685,'hotel',30,'normal','','car');
  S(9,'Hutt Lagoon',-28.1850,114.2360,'viewpoint',90,'must','','car'); S(9,'Kalbarri',-27.7106,114.1652,'hotel',30,'high','','car');
  S(10,"Nature's Window",-27.5524,114.4707,'viewpoint',90,'must','','car'); S(10,'Kalbarri Skywalk',-27.5488,114.4408,'viewpoint',60,'high','','car'); S(10,'Z Bend',-27.5850,114.4610,'viewpoint',60,'high','','car'); S(10,"Hawk's Head",-27.7310,114.5200,'wildlife',90,'high','Black-flanked Rock Wallaby','car'); S(10,'Red Bluff',-27.7405,114.1495,'viewpoint',60,'normal','','car');
  S(11,'Shell Beach',-26.2220,113.6820,'beach',90,'must','','car'); S(11,'Denham',-25.9283,113.5332,'hotel',30,'high','','car');
  S(12,'Peron Heritage Precinct',-25.8620,113.5550,'nature',120,'high','Emus/Reptilien möglich','car'); S(12,'Eagle Bluff',-26.0980,113.6070,'viewpoint',60,'normal','','car');
  S(13,'Geraldton',-28.7774,114.6148,'hotel',60,'normal','','car');
  S(14,'Elizabeth Quay',-31.9571,115.8570,'city',45,'high','','walk'); S(14,'London Court',-31.9548,115.8590,'sight',30,'normal','','walk'); S(14,'WA Museum Boola Bardip',-31.9498,115.8604,'sight',60,'normal','','walk'); S(14,'Kings Park',-31.9600,115.8425,'nature',120,'high','','transit');
  v.flights.push({id:uid('flight'),number:'',airline:'',from:'Sydney (SYD)',to:'Melbourne (MEL)',departDate:addDays(start,1),departTime:'06:30',arriveDate:addDays(start,1),arriveTime:'08:05',arrivalBuffer:60,departureBuffer:120,notes:'Beispiel – echte Buchungsdaten später ersetzen.'});
  v.flights.push({id:uid('flight'),number:'',airline:'',from:'Melbourne (MEL)',to:'Perth (PER)',departDate:addDays(start,5),departTime:'14:30',arriveDate:addDays(start,5),arriveTime:'16:40',arrivalBuffer:60,departureBuffer:120,notes:'Beispiel – echte Buchungsdaten später ersetzen.'});
  trip.versions.push(v); trip.selectedVersionId=v.id; return trip;
}

function loadState(){
  let raw='';
  try{ if(window.AndroidBridge?.loadState) raw=AndroidBridge.loadState(); else raw=localStorage.getItem('urp_state')||''; }catch(e){}
  if(raw){ try{state=JSON.parse(raw);}catch(e){state=null;} }
  if(!state||!state.trips){state=emptyState(); const t=sampleTrip(); state.trips.push(t); state.activeTripId=t.id;}
  state.settings={...defaultSettings(),...(state.settings||{})}; state.cache=state.cache||{};state.cache.places=state.cache.places||{};state.cache.cities=state.cache.cities||{};state.cache.wikidata=state.cache.wikidata||{};state.cache.wildlife=state.cache.wildlife||{};state.cache.photos=state.cache.photos||{};for(const t of state.trips||[])for(const v of t.versions||[])v.transfers=v.transfers||[];state.schema=2;
}
function persistSoon(){
  $('#syncState').textContent='speichert …'; clearTimeout(saveTimer); saveTimer=setTimeout(()=>{
    try{const raw=JSON.stringify(state); if(window.AndroidBridge?.saveState) AndroidBridge.saveState(raw); else localStorage.setItem('urp_state',raw); $('#syncState').textContent='lokal gespeichert';}catch(e){$('#syncState').textContent='Speicherfehler';}
  },250);
}
function activeTrip(){return state.trips.find(t=>t.id===state.activeTripId)||state.trips[0]||null}
function activeVersion(){const t=activeTrip(); return t?.versions.find(v=>v.id===t.selectedVersionId)||t?.versions[0]||null}
function ensureActive(){if(!activeTrip()&&state.trips.length)state.activeTripId=state.trips[0].id;const t=activeTrip();if(t&&!t.selectedVersionId&&t.versions[0])t.selectedVersionId=t.versions[0].id;}

function cloneVersion(v,newName){const c=JSON.parse(JSON.stringify(v));c.id=uid('ver');c.name=newName||`${v.name} – Kopie`;c.createdAt=Date.now();const stopMap=new Map(),flightMap=new Map();c.days.forEach(d=>{d.id=uid('day');d.stops.forEach(s=>{const old=s.id;s.id=uid('stop');stopMap.set(old,s.id)});});c.flights.forEach(f=>{const old=f.id;f.id=uid('flight');flightMap.set(old,f.id)});c.transfers=(c.transfers||[]).map(x=>({...x,id:uid('transfer'),flightId:flightMap.get(x.flightId)||x.flightId,toStopId:stopMap.get(x.toStopId)||x.toStopId}));return c}

function showModal(html,onReady){$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden');if(onReady)setTimeout(onReady,0)}
function closeModal(){$('#modal').classList.add('hidden');$('#modalContent').innerHTML=''}

// ------------------------- Free data providers -------------------------
const Providers={
  async geocode(q,limit=8){
    const key=normalizeName(q); if(state.cache.places[key])return state.cache.places[key];
    const u=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&namedetails=1&limit=${limit}&q=${encodeURIComponent(q)}`;
    const j=await apiJson(u); const out=j.map(x=>({name:x.namedetails?.name||x.display_name.split(',')[0],display:x.display_name,lat:+x.lat,lng:+x.lon,type:x.type,category:x.category,address:x.address||{},extratags:x.extratags||{},bbox:x.boundingbox?.map(Number)}));
    state.cache.places[key]=out;persistSoon();return out;
  },
  async cities(destination){
    const key=`cities:${normalizeName(destination)}`,cached=state.cache.cities[key];if(Array.isArray(cached)&&cached.length)return cached;
    let out=[],lastError=null;
    try{
      const geo=await this.geocode(destination,3),g=geo[0];
      if(g?.bbox?.length===4){
        const [south,north,west,east]=g.bbox;
        const q=`[out:json][timeout:25];node[place=city][name](${south},${west},${north},${east});out tags 120;`;
        const u=`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
        const j=await apiJson(u);
        out=(j.elements||[]).map(e=>{const t=e.tags||{};return{name:t['name:de']||t.name||'',lat:+e.lat,lng:+e.lon,population:+String(t.population||'0').replace(/[^0-9]/g,''),capital:t.capital||'',country:destination};}).filter(x=>x.name&&Number.isFinite(x.lat)&&Number.isFinite(x.lng));
        out.sort((a,b)=>(b.population||0)-(a.population||0)||Number(Boolean(b.capital))-Number(Boolean(a.capital)));
      }
    }catch(e){lastError=e;}
    if(out.length<5){
      try{
        const terms=[`${destination} Hauptstadt`,`${destination} Großstadt`,`${destination} Stadt`],seen=new Set(out.map(x=>normalizeName(x.name)));
        for(const term of terms){
          const u=`https://de.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=0&gsrlimit=30&prop=coordinates|info&inprop=url&format=json&formatversion=2&origin=*`;
          const j=await apiJson(u);
          for(const p of j.query?.pages||[]){const c=p.coordinates?.[0],name=p.title||'';if(!c||!name||seen.has(normalizeName(name))||/Liste|Geschichte|Geographie|Tourismus/i.test(name))continue;seen.add(normalizeName(name));out.push({name,lat:+c.lat,lng:+c.lon,population:0,country:destination,wiki:p.fullurl||''});}
          if(out.length>=30)break;
        }
      }catch(e){lastError=e;}
    }
    const uniq=new Map();out.forEach(x=>{if(!uniq.has(normalizeName(x.name)))uniq.set(normalizeName(x.name),x)});out=[...uniq.values()].slice(0,30);
    if(!out.length)throw new Error(`Städte konnten nicht geladen werden${lastError?`: ${lastError.message}`:''}`);
    state.cache.cities[key]=out;persistSoon();return out;
  },
  async countryQid(country){
    const k=`qid:${normalizeName(country)}`;if(state.cache.wikidata[k])return state.cache.wikidata[k];
    const u=`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(country)}&language=de&uselang=de&type=item&limit=8&format=json&origin=*`;
    const j=await apiJson(u); const item=(j.search||[]).find(x=>/Land|country|Staat/i.test(`${x.description||''}`))||(j.search||[])[0];
    const q=item?.id||'';state.cache.wikidata[k]=q;persistSoon();return q;
  },
  async attractions(destination){
    // V1.1.3: eigener Cache-Key, damit alte, stadtlastige Treffer aus V1.1.2 nicht weiterverwendet werden.
    const cacheKey=`attr:v3:${normalizeName(destination)}`,cached=state.cache.wikidata[cacheKey];if(Array.isArray(cached)&&cached.length)return cached;
    const cityKey=`cities:${normalizeName(destination)}`;
    let cities=state.cache.cities[cityKey]||[];
    if(!cities.length){try{cities=await this.cities(destination)}catch(e){cities=[]}}
    const cityNames=new Set(cities.map(x=>normalizeName(x.name)));
    const searches=[
      {q:`${destination} Wahrzeichen`,weight:34,label:'Wahrzeichen'},
      {q:`${destination} UNESCO Welterbe`,weight:38,label:'UNESCO / Welterbe'},
      {q:`${destination} Nationalpark`,weight:34,label:'Nationalpark'},
      {q:`${destination} Naturwunder`,weight:32,label:'Naturhighlight'},
      {q:`${destination} Sehenswürdigkeit`,weight:24,label:'Sehenswürdigkeit'},
      {q:`${destination} Denkmal`,weight:22,label:'Denkmal'},
      {q:`${destination} historische Stätte`,weight:22,label:'Historische Stätte'}
    ];
    const seen=new Set(), out=[];let lastError=null;
    const settlementRx=/(?:^|:|\s)(?:Stadt in|Ort in|Gemeinde in|Großstadt|Millionenstadt|Kleinstadt|Hauptstadt|Vorort|Stadtteil|Stadtbezirk|Siedlung|City in|Cities in|Town in|Towns in|Village in|Villages in|Suburb)/i;
    const adminRx=/(?:Bundesstaat|Provinz|Territorium|Verwaltungseinheit|Region von|Region in|County|District|State of)/i;
    const usefulRx=/(?:Welterbe|World Heritage|Nationalpark|National Park|Wahrzeichen|Landmark|Naturdenkmal|Naturwunder|Denkmal|Monument|Museum|Bauwerk|Gebäude|Kirche|Kathedrale|Tempel|Schloss|Burg|Brücke|Straße|Küste|Riff|Insel|Berg|Fels|Schlucht|Wasserfall|Höhle|Park|Garten|Historic|Tourist|Sehenswürdigkeit)/i;
    for(const spec of searches){
      try{
        const u=`https://de.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(spec.q)}&gsrnamespace=0&gsrlimit=18&prop=coordinates|pageimages|info|categories|extracts&piprop=thumbnail&pithumbsize=480&inprop=url&cllimit=max&exintro=1&explaintext=1&exchars=420&format=json&formatversion=2&origin=*`;
        const j=await apiJson(u);
        let rank=0;
        for(const page of j.query?.pages||[]){
          rank++;
          const name=page.title||'',norm=normalizeName(name);if(!name||seen.has(norm)||norm===normalizeName(destination))continue;
          const c=page.coordinates?.[0];if(!c||!Number.isFinite(+c.lat)||!Number.isFinite(+c.lon))continue;
          if(cityNames.has(norm))continue;
          if(/^(Liste|Tourismus in|Geographie von|Geschichte von|Verwaltungsgliederung|Demografie|Politik von)\b/i.test(name))continue;
          const cats=(page.categories||[]).map(x=>x.title||'').join(' · '), extract=page.extract||'';
          // Konkrete Städte, Gemeinden und reine Verwaltungseinheiten dürfen nie als nationales Highlight erscheinen.
          if(settlementRx.test(cats)||adminRx.test(cats))continue;
          // Zusätzlicher Sicherheitsfilter für typische Stadtartikel, falls Kategorien unvollständig sind.
          if(/\b(?:ist die Hauptstadt|ist eine Stadt|ist eine Gemeinde|city and capital|city in)\b/i.test(extract))continue;
          let score=spec.weight+(20-rank);
          if(/Welterbe|World Heritage/i.test(cats+extract))score+=30;
          if(/Nationalpark|National Park/i.test(cats+name))score+=25;
          if(/Wahrzeichen|Landmark|Naturwunder|Naturdenkmal/i.test(cats+extract))score+=20;
          if(usefulRx.test(cats+extract+name))score+=10;
          if(page.thumbnail?.source)score+=4;
          seen.add(norm);
          out.push({name,lat:+c.lat,lng:+c.lon,wiki:page.fullurl||'',photo:page.thumbnail?.source||'',score,highlightType:spec.label,summary:extract.slice(0,260)});
        }
      }catch(e){lastError=e;}
    }
    // Dubletten zusammenführen; ein Treffer aus mehreren Suchkategorien behält den höchsten Score.
    const uniq=new Map();
    for(const x of out){const k=normalizeName(x.name),old=uniq.get(k);if(!old||x.score>old.score)uniq.set(k,x)}
    const result=[...uniq.values()].sort((a,b)=>b.score-a.score).slice(0,40);
    if(!result.length)throw new Error(`Konkrete nationale Sehenswürdigkeiten konnten nicht geladen werden${lastError?`: ${lastError.message}`:''}`);
    state.cache.wikidata[cacheKey]=result;persistSoon();return result;
  },
  async iNatPlace(destination){
    const u=`https://api.inaturalist.org/v1/places/autocomplete?q=${encodeURIComponent(destination)}&per_page=10`;
    const j=await apiJson(u);return (j.results||[])[0]||null;
  },
  async wildlife(destination,month){
    const key=`wild:${normalizeName(destination)}:${month||0}`,cached=state.cache.wildlife[key];if(Array.isArray(cached)&&cached.length)return cached;
    let j=null,lastError=null;
    try{
      const geo=await this.geocode(destination,3),g=geo[0];
      if(g?.bbox?.length===4){
        const [south,north,west,east]=g.bbox;
        let u=`https://api.inaturalist.org/v1/observations/species_counts?taxon_id=40151&quality_grade=research,needs_id&per_page=50&locale=de&swlat=${south}&swlng=${west}&nelat=${north}&nelng=${east}`;
        if(month)u+=`&month=${month}`;j=await apiJson(u);
      }
    }catch(e){lastError=e;}
    if(!j){
      try{
        const place=await this.iNatPlace(destination);if(!place)throw new Error('Gebiet wurde bei iNaturalist nicht gefunden.');
        let u=`https://api.inaturalist.org/v1/observations/species_counts?place_id=${place.id}&taxon_id=40151&quality_grade=research,needs_id&per_page=50&locale=de`;
        if(month)u+=`&month=${month}`;j=await apiJson(u);
      }catch(e){lastError=e;}
    }
    if(!j)throw new Error(`Wildlife konnte nicht geladen werden${lastError?`: ${lastError.message}`:''}`);
    const out=(j.results||[]).map(x=>({taxonId:x.taxon?.id,name:x.taxon?.preferred_common_name||x.taxon?.english_common_name||x.taxon?.name||'Unbekannt',scientific:x.taxon?.name||'',count:x.count||0,photo:x.taxon?.default_photo?.medium_url||x.taxon?.default_photo?.square_url||'',iconic:x.taxon?.iconic_taxon_name||''}));
    if(!out.length)throw new Error('Für dieses Ziel und den gewählten Reisemonat wurden keine passenden Säugetier-Beobachtungen gefunden.');
    state.cache.wildlife[key]=out;persistSoon();return out;
  },
  async wildlifeObservations(taxonId,lat,lng,radius=80,month=0){
    let u=`https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&lat=${lat}&lng=${lng}&radius=${radius}&quality_grade=research,needs_id&geo=true&per_page=100&order=desc&order_by=observed_on`;
    if(month)u+=`&month=${month}`; const j=await apiJson(u);return j.results||[];
  },
  async commonsPhotos(query){
    const k=`photo:${normalizeName(query)}`;if(state.cache.photos[k])return state.cache.photos[k];
    const u=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&formatversion=2&origin=*`;
    const j=await apiJson(u);const out=(j.query?.pages||[]).flatMap(p=>{const i=p.imageinfo?.[0];if(!i||i.mime==='image/svg+xml')return[];return[{url:i.thumburl||i.url,full:i.url,title:(p.title||'').replace(/^File:/,''),page:i.descriptionurl||`https://commons.wikimedia.org/?curid=${p.pageid}`}]}).slice(0,3);
    state.cache.photos[k]=out;persistSoon();return out;
  },
  async openingHours(lat,lng){
    const q=`[out:json][timeout:12];nwr(around:80,${lat},${lng})[opening_hours];out tags center 8;`;
    const u=`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`; const j=await apiJson(u); const el=(j.elements||[])[0]; return el?.tags?.opening_hours||'';
  },
  async route(a,b,mode='car'){
    if(!a||!b)return null;
    if(mode==='flight')return {distanceKm:haversine(a,b),durationMin:0,geometry:[[a.lat,a.lng],[b.lat,b.lng]],approx:true};
    if(['walk','transit','train','ferry'].includes(mode)){
      const km=haversine(a,b)*(mode==='walk'?1.25:1.1);const speed=mode==='walk'?4.5:mode==='transit'?25:mode==='train'?80:30;return {distanceKm:km,durationMin:km/speed*60,geometry:[[a.lat,a.lng],[b.lat,b.lng]],approx:true};
    }
    const u=`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    try{const j=await apiJson(u);const r=j.routes?.[0];if(!r)throw new Error('keine Route');return {distanceKm:r.distance/1000,durationMin:r.duration/60,geometry:r.geometry.coordinates.map(c=>[c[1],c[0]]),approx:false};}
    catch(e){const km=haversine(a,b)*1.25;return {distanceKm:km,durationMin:km/75*60,geometry:[[a.lat,a.lng],[b.lat,b.lng]],approx:true};}
  },
  async cityPois(lat,lng,radius=4500){
    const q=`[out:json][timeout:20];(nwr(around:${radius},${lat},${lng})[tourism~"attraction|museum|viewpoint"];nwr(around:${radius},${lat},${lng})[historic];nwr(around:${radius},${lat},${lng})[leisure="park"][name];);out tags center 80;`;
    const u=`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;const j=await apiJson(u);const arr=[];
    for(const e of j.elements||[]){const t=e.tags||{};if(!t.name)continue;const la=e.lat??e.center?.lat,lo=e.lon??e.center?.lon;if(la==null||lo==null)continue;let score=0;if(t.wikipedia)score+=40;if(t.wikidata)score+=30;if(t.tourism==='attraction')score+=18;if(t.tourism==='museum')score+=14;if(t.historic)score+=10;if(t.website)score+=4;arr.push({name:t.name,lat:la,lng:lo,type:t.tourism==='museum'?'sight':t.leisure==='park'?'nature':t.tourism==='viewpoint'?'viewpoint':'sight',openingHours:t.opening_hours||'',score,tags:t});}
    const uniq=new Map();arr.sort((a,b)=>b.score-a.score).forEach(x=>{if(!uniq.has(normalizeName(x.name)))uniq.set(normalizeName(x.name),x)});return [...uniq.values()].slice(0,40);
  },
  async flightRoute(number){
    const clean=String(number||'').replace(/\s+/g,'').toUpperCase();if(!clean)throw new Error('Flugnummer fehlt.');
    const u=`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(clean)}`;const j=await apiJson(u);return j.response?.flightroute||j.response||null;
  }
};

// ------------------------- Rendering -------------------------
function renderAll(){
  ensureActive(); renderContext(); renderTrips(); renderDiscover(); renderPlanner(); renderCompare(); renderSettings(); if(currentView==='map') renderMap();
}
function renderContext(){
  const ts=$('#tripSelect'),vs=$('#versionSelect');ts.innerHTML='';
  if(!state.trips.length){ts.innerHTML='<option>Keine Reise</option>';vs.innerHTML='<option>Keine Version</option>';return;}
  state.trips.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.title;o.selected=t.id===state.activeTripId;ts.appendChild(o)});
  const t=activeTrip();vs.innerHTML='';(t?.versions||[]).forEach(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.name;o.selected=v.id===t.selectedVersionId;vs.appendChild(o)});
}
function versionMetrics(v){
  if(!v)return{days:0,stops:0,km:0,travel:0,visit:0,must:0,wild:0};let km=0,travel=0,visit=0,stops=0,must=0,wild=0;
  for(const d of v.days||[]){for(const s of d.stops||[]){stops++;visit+=+(s.durationWish||s.durationMin||0);if(s.priority==='must')must++;if(s.type==='wildlife'||(s.wildlife||[]).length)wild++;if(s.routeToNext){km+=s.routeToNext.distanceKm||0;travel+=s.routeToNext.durationMin||0;}}}
  for(const x of v.transfers||[]){km+=+x.distanceKm||0;travel+=+x.durationMin||0;}
  return{days:(v.days||[]).length,stops,km,travel,visit,must,wild};
}
function renderTrips(){
  const box=$('#tripCards');box.innerHTML='';
  if(!state.trips.length){box.innerHTML='<div class="card"><b>Noch keine Reise.</b><p>Lege deine erste Reise an.</p></div>';return;}
  for(const t of state.trips){const v=t.versions.find(x=>x.id===t.selectedVersionId)||t.versions[0],m=versionMetrics(v);const el=document.createElement('div');el.className=`tripcard ${t.id===state.activeTripId?'active':''}`;el.innerHTML=`
    <div class="triptitle"><div><h3>${esc(t.title)}</h3><div class="tripmeta">${esc(t.destination||'Kein Ziel')} · ${t.versions.length} Version${t.versions.length===1?'':'en'}</div></div><button data-trip-menu="${t.id}">•••</button></div>
    <div class="tripstats"><div class="metric"><b>${m.days}</b><small>Tage</small></div><div class="metric"><b>${m.stops}</b><small>Stopps</small></div><div class="metric"><b>${Math.round(m.km)}</b><small>km geplant</small></div></div>
    <div class="actions" style="margin-top:10px"><button data-open-trip="${t.id}">Öffnen</button><button data-new-version="${t.id}">Version duplizieren</button></div>`;box.appendChild(el);}
}
function renderDiscover(){
  const t=activeTrip(),v=activeVersion();$('#discoverDestination').textContent=t?.destination||'Kein Reiseziel';$('#discoverDates').textContent=v?`${fmtDate(v.startDate)} – ${fmtDate(v.endDate)}`:'Noch keine Version';
  const chips=$('#interestChips');chips.innerHTML='';INTERESTS.forEach(i=>{const b=document.createElement('button');b.className=`chip ${(t?.interests||[]).includes(i)?'on':''}`;b.textContent=i;b.onclick=()=>{if(!t)return;const a=t.interests||[];const p=a.indexOf(i);p>=0?a.splice(p,1):a.push(i);persistSoon();renderDiscover();};chips.appendChild(b)});
  renderSuggestionBoxes();
}
function suggestionFooter(kind,total,shown){
  if(!total||total<=5)return'';
  const more=shown<total;
  return `<div class="suggestionfooter"><span>${Math.min(shown,total)} von ${total}</span><div>${shown>5?`<button data-suggestions-less="${kind}">Weniger</button>`:''}${more?`<button class="primary mini" data-suggestions-more="${kind}">Weitere laden</button>`:''}</div></div>`;
}
function renderCitySuggestions(cities){
  const p=$('#citySuggestions'),limit=discoverVisible.cities;if(cities?.length){const shown=cities.slice(0,limit);p.className=`suggestions ${limit>5?'scrollsuggestions expanded':''}`;p.innerHTML=shown.map((x,i)=>`<div class="suggestion citysuggestion"><div class="thumb">🏙</div><div><h4>${esc(x.name)}</h4><p>${x.population?`${Number(x.population).toLocaleString('de-DE')} Einwohner · `:''}Stadt-Vorschlag ${i+1}</p></div><div class="suggestionactions"><button data-city-inspire='${esc(JSON.stringify(x))}'>Entdecken</button><button data-add-city='${esc(JSON.stringify(x))}'>+</button></div></div>`).join('')+suggestionFooter('cities',cities.length,shown.length);}else{p.className='suggestions empty';p.textContent='Noch nicht geladen.'}
}
function renderAttractionSuggestions(attr){
  const p=$('#poiSuggestions'),limit=discoverVisible.attractions;if(attr?.length){const shown=attr.slice(0,limit);p.className=`suggestions ${limit>5?'scrollsuggestions expanded':''}`;p.innerHTML=shown.map((x,i)=>`<div class="suggestion">${x.photo?`<img class="thumb" src="${esc(x.photo)}">`:`<div class="thumb sightthumb">★</div>`}<div><h4>${esc(x.name)}</h4><p>${esc(x.highlightType||'Sehenswürdigkeit')}${x.summary?` · ${esc(x.summary.slice(0,90))}${x.summary.length>90?'…':''}`:''}</p></div><button data-add-suggestion='${esc(JSON.stringify({kind:'poi',...x}))}'>+</button></div>`).join('')+suggestionFooter('attractions',attr.length,shown.length);}else{p.className='suggestions empty';p.textContent='Noch nicht geladen.'}
}
function renderWildlifeSuggestions(wild){
  const w=$('#wildSuggestions'),limit=discoverVisible.wildlife;if(wild?.length){const shown=wild.slice(0,limit);w.className=`suggestions ${limit>5?'scrollsuggestions expanded':''}`;w.innerHTML=shown.map(x=>`<div class="suggestion">${x.photo?`<img class="thumb" src="${esc(x.photo)}">`:'<div class="thumb sightthumb">🐾</div>'}<div><h4>${esc(x.name)}</h4><p><i>${esc(x.scientific)}</i> · ${x.count} Beobachtungen</p></div><button data-target-species='${esc(JSON.stringify(x))}'>Ziel</button></div>`).join('')+suggestionFooter('wildlife',wild.length,shown.length);}else{w.className='suggestions empty';w.textContent='Noch nicht geladen.'}
}
function suggestionData(kind){
  const t=activeTrip();if(!t)return[];
  if(kind==='cities')return state.cache.cities[`cities:${normalizeName(t.country||t.destination)}`]||[];
  if(kind==='attractions')return state.cache.wikidata[`attr:v3:${normalizeName(t.country||t.destination)}`]||[];
  if(kind==='wildlife'){const month=activeVersion()?.startDate?new Date(`${activeVersion().startDate}T12:00:00`).getMonth()+1:0;return state.cache.wildlife[`wild:${normalizeName(t.destination)}:${month}`]||[];}
  return[];
}
function changeSuggestionLimit(kind,more){
  const data=suggestionData(kind),key=kind;if(!data.length)return;
  discoverVisible[key]=more?Math.min(data.length,(discoverVisible[key]||5)+5):5;
  renderSuggestionBoxes();
}
function renderSuggestionBoxes(){
  const t=activeTrip();if(!t)return;
  const cities=suggestionData('cities'),attr=suggestionData('attractions'),wild=suggestionData('wildlife');
  renderCitySuggestions(cities);renderAttractionSuggestions(attr);renderWildlifeSuggestions(wild);
}
function dayConstraints(v,day){
  let start=timeToMin(day.startTime||state.settings.defaultStart),end=timeToMin(day.endTime||state.settings.defaultEnd),notes=[];
  for(const f of v.flights||[]){if(f.arriveDate===day.date){const x=timeToMin(f.arriveTime);if(x!=null){const tr=(v.transfers||[]).find(t=>t.flightId===f.id&&t.date===day.date),transferMin=+tr?.durationMin||0;const z=x+(+f.arrivalBuffer||state.settings.arrivalBuffer)+transferMin;if(z>start){start=z;notes.push(`nach Ankunft ${esc(f.number||f.to)}${tr?` + ${durText(transferMin)} Transfer zur Unterkunft`:''} ab ${minToTime(z)}`)}}}if(f.departDate===day.date){const x=timeToMin(f.departTime);if(x!=null){const z=x-(+f.departureBuffer||state.settings.departureBuffer);if(z<end){end=z;notes.push(`vor Abflug ${esc(f.number||f.from)} bis ${minToTime(z)}`)}}}}
  return{start,end,notes};
}
function computeDay(v,day){
  const c=dayConstraints(v,day);let cur=c.start,km=0,travel=0,visit=0;const rows=[];
  for(let i=0;i<day.stops.length;i++){const s=day.stops[i];if(s.fixedStart!=null&&s.fixedStart!==''){const f=timeToMin(s.fixedStart);if(f>cur)cur=f;}const arr=cur,dur=+(s.durationWish||s.durationMin||0),dep=arr+dur;visit+=dur;rows.push({stop:s,arrival:arr,departure:dep});cur=dep;if(s.routeToNext&&i<day.stops.length-1){travel+=s.routeToNext.durationMin||0;km+=s.routeToNext.distanceKm||0;cur+=s.routeToNext.durationMin||0;}}
  return{...c,rows,finish:cur,km,travel,visit,buffer:c.end-cur,available:c.end-c.start};
}
function renderPlanner(){
  const t=activeTrip(),v=activeVersion(),sum=$('#planSummary'),box=$('#daysTimeline');if(!t||!v){sum.innerHTML='';box.innerHTML='<div class="card">Keine Reiseversion ausgewählt.</div>';return;}
  const m=versionMetrics(v);sum.innerHTML=`<div class="summarybox"><b>${v.days.length}</b><small>Tage</small></div><div class="summarybox"><b>${m.stops}</b><small>Stopps</small></div><div class="summarybox"><b>${Math.round(m.km)}</b><small>km</small></div><div class="summarybox"><b>${durText(m.travel)}</b><small>Fahrt</small></div>`;
  box.innerHTML='';v.days.forEach((day,di)=>{const comp=computeDay(v,day),el=document.createElement('div');el.className='daycard';const flights=(v.flights||[]).filter(f=>f.departDate===day.date||f.arriveDate===day.date),transfers=(v.transfers||[]).filter(x=>x.date===day.date);el.innerHTML=`
    <div class="dayhead"><div class="daydate"><span class="daycolor" style="background:${DAY_COLORS[di%DAY_COLORS.length]}"></span><div><h3>Tag ${di+1} · ${fmtShortDate(day.date)}</h3><p>${minToTime(comp.start)}–${minToTime(comp.end)} verfügbar · ${comp.buffer>=0?`${durText(comp.buffer)} Puffer`:`${durText(-comp.buffer)} überplant`}</p></div></div><button data-day-toggle="${day.id}">⌄</button></div>
    <div class="daybody" id="body_${day.id}"><div class="daytools"><button data-day-time="${day.id}">⏱ Tageszeit</button><button data-day-add="${day.id}">+ Stopp</button><button data-day-accommodation="${day.id}">🛏 Unterkunft</button><button data-city-tour="${day.id}">🏙 Stadttour</button><button data-route-day="${day.id}">↻ Strecken</button></div>
      ${comp.notes.length?`<div class="warnline">✈ ${comp.notes.join(' · ')}</div>`:''}
      ${flights.map(f=>flightHtml(f)).join('')}
      ${transfers.map(x=>transferHtml(x)).join('')}
      <div>${comp.rows.map((r,i)=>stopHtml(day,r,i,comp.rows.length,di)).join('')}</div>
      <div class="${comp.buffer<0?'warnline errorline':'warnline goodline'}">${comp.buffer<0?`⚠ Tag ist um ${durText(-comp.buffer)} überplant.`:`✓ Verbleibender Puffer: ${durText(comp.buffer)}.`} · ${kmText(comp.km)} · ${durText(comp.travel)} Transfer · ${durText(comp.visit)} Stopps</div>
    </div>`;box.appendChild(el);});
}
function flightHtml(f){return `<div class="stop flightcard"><div class="stoprow"><div class="stopicon">✈</div><div><h4>${esc(f.number||'Flug')} · ${esc(f.from)} → ${esc(f.to)}</h4><div class="stopmeta">${fmtShortDate(f.departDate)} ${esc(f.departTime)} → ${fmtShortDate(f.arriveDate)} ${esc(f.arriveTime)}${f.notes?`<br>${esc(f.notes)}`:''}</div></div><div class="stopactions"><button data-flight-transfer="${f.id}" title="Transfer zur Unterkunft">↔</button><button data-edit-flight="${f.id}">✎</button></div></div></div>`}
function transferHtml(x){return `<div class="stop transfercard"><div class="stoprow"><div class="stopicon">↔</div><div><h4>Flughafentransfer · ${esc(x.fromName||'Flughafen')} → ${esc(x.toName||'Unterkunft')}</h4><div class="stopmeta">${MODES[x.mode]||esc(x.mode)} · ${kmText(x.distanceKm)} · ${durText(x.durationMin)}${x.approx?' · ca.':''}${x.notes?`<br>${esc(x.notes)}`:''}</div></div><button data-edit-transfer="${x.id}">✎</button></div></div>`}
function stopHtml(day,r,i,count,di){const s=r.stop,leg=s.routeToNext&&i<count-1?s.routeToNext:null,a=s.accommodation;return `<div class="stop ${a?'accommodationcard':''}" data-stop="${s.id}"><div class="stoprow"><div class="stopicon">${STOP_ICONS[s.type]||'•'}</div><div><h4>${minToTime(r.arrival)}–${minToTime(r.departure)} · ${esc(s.name)}</h4><div class="stopmeta"><span class="priority ${s.priority}">${priorityText(s.priority)}</span>${durText(s.durationWish||s.durationMin)}${s.openingHours?` · geöffnet: ${esc(s.openingHours)}`:''}${a?`<span class="lodgingmeta">${esc(a.kind||'Unterkunft')} · Check-in ${fmtShortDate(a.checkInDate)}${a.checkInTime?` ${esc(a.checkInTime)}`:''} · Check-out ${fmtShortDate(a.checkOutDate)}${a.checkOutTime?` ${esc(a.checkOutTime)}`:''}${a.address?`<br>${esc(a.address)}`:''}</span>`:''}${s.notes?`<br>${esc(s.notes)}`:''}</div></div><div class="stopactions"><button data-move-stop="${s.id}" data-dir="-1">↑</button><button data-move-stop="${s.id}" data-dir="1">↓</button><button data-edit-stop="${s.id}">✎</button><button data-delete-stop="${s.id}">×</button></div></div></div>${leg?`<div class="leg"><div class="legline"></div><div>${MODES[s.modeToNext]||s.modeToNext} · ${kmText(leg.distanceKm)} · ${durText(leg.durationMin)}${leg.approx?' · ca.':''}</div></div>`:''}`}
function priorityText(p){return p==='must'?'MUSS':p==='high'?'HOCH':p==='optional'?'OPTIONAL':'NORMAL'}
function renderCompare(){
  const t=activeTrip(),a=$('#compareA'),b=$('#compareB');a.innerHTML=b.innerHTML='';if(!t)return;(t.versions||[]).forEach((v,i)=>{for(const sel of[a,b]){const o=document.createElement('option');o.value=v.id;o.textContent=v.name;sel.appendChild(o)}if(i===0)a.value=v.id;if(i===1)b.value=v.id});if(t.versions.length===1)b.value=t.versions[0].id;renderCompareResult();
}
function renderCompareResult(){const t=activeTrip();if(!t)return;const va=t.versions.find(v=>v.id===$('#compareA').value),vb=t.versions.find(v=>v.id===$('#compareB').value),box=$('#compareResult');if(!va||!vb){box.innerHTML='<div class="card">Mindestens eine Version fehlt.</div>';return}const A=versionMetrics(va),B=versionMetrics(vb);const rows=[['Reisetage',A.days,B.days,''],['Stopps',A.stops,B.stops,''],['Pflichtstopps',A.must,B.must,''],['Wildlife-Stopps',A.wild,B.wild,''],['Strecke',Math.round(A.km),Math.round(B.km),' km'],['Transferzeit',Math.round(A.travel),Math.round(B.travel),' min'],['Aufenthaltszeit',Math.round(A.visit),Math.round(B.visit),' min']];const namesA=new Set(va.days.flatMap(d=>d.stops.map(s=>s.name))),namesB=new Set(vb.days.flatMap(d=>d.stops.map(s=>s.name)));const added=[...namesB].filter(x=>!namesA.has(x)),removed=[...namesA].filter(x=>!namesB.has(x));box.innerHTML=`<div class="card"><div class="compgrid"><div class="head">Kennzahl</div><div class="head">${esc(va.name)}</div><div class="head">${esc(vb.name)}</div>${rows.map(r=>`<div>${r[0]}</div><div>${r[1]}${r[3]}</div><div>${r[2]}${r[3]} ${r[2]!==r[1]?`<span class="${r[2]>r[1]?'deltaPlus':'deltaMinus'}">(${r[2]>r[1]?'+':''}${r[2]-r[1]}${r[3]})</span>`:''}</div>`).join('')}</div></div><div class="card"><div class="sectiontitle">Geänderte Stopps</div><p><b>Hinzugefügt:</b> ${added.length?added.map(esc).join(', '):'keine'}</p><p><b>Entfernt:</b> ${removed.length?removed.map(esc).join(', '):'keine'}</p></div>`}
function renderSettings(){const s=state.settings;$('#defaultStart').value=s.defaultStart;$('#defaultEnd').value=s.defaultEnd;$('#arrivalBuffer').value=s.arrivalBuffer;$('#departureBuffer').value=s.departureBuffer}

// ------------------------- Modals / editors -------------------------
function newTripModal(){
  showModal(`<h2>Neue Reise</h2><p class="lead">Lege das Reiseziel und einen ersten möglichen Zeitraum fest.</p><div class="formgrid one"><label>Name der Reise<input id="mTripTitle" placeholder="z. B. Japan 2028"></label><label>Reiseziel / Land<input id="mTripDest" placeholder="z. B. Japan"></label><label>Möglicher Zeitraum – von<input id="mWinStart" type="date"></label><label>bis<input id="mWinEnd" type="date"></label><label>Name der ersten Version<input id="mVersionName" value="Ausgangsplanung"></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button class="primary" id="createTripConfirm">Reise anlegen</button></div>`,()=>{
    $('#createTripConfirm').onclick=()=>{const title=$('#mTripTitle').value.trim(),dest=$('#mTripDest').value.trim(),a=$('#mWinStart').value,b=$('#mWinEnd').value;if(!title||!dest||!a||!b||b<a){toast('Bitte gültige Angaben eintragen.');return}const t={id:uid('trip'),title,destination:dest,country:dest,interests:['Natur','Landschaft'],dateWindows:[{id:uid('win'),start:a,end:b}],versions:[],selectedVersionId:null};const v={id:uid('ver'),name:$('#mVersionName').value.trim()||'Ausgangsplanung',startDate:a,endDate:b,days:[],flights:[],transfers:[],createdAt:Date.now()};const n=daysBetween(a,b);for(let i=0;i<n;i++)v.days.push({id:uid('day'),date:addDays(a,i),startTime:state.settings.defaultStart,endTime:state.settings.defaultEnd,stops:[]});t.versions.push(v);t.selectedVersionId=v.id;state.trips.push(t);state.activeTripId=t.id;persistSoon();closeModal();renderAll();toast('Reise angelegt.');};
  });
}
function tripMenuModal(t){
  showModal(`<h2>${esc(t.title)}</h2><p class="lead">Reise und Zeiträume verwalten.</p><div class="formgrid one"><label>Reisename<input id="mEditTripTitle" value="${esc(t.title)}"></label><label>Reiseziel / Land<input id="mEditTripDest" value="${esc(t.destination||'')}"></label></div><div class="sectiontitle" style="margin-top:14px">Mögliche Zeiträume</div><div id="windowList">${(t.dateWindows||[]).map(w=>`<div class="actions" style="margin-bottom:7px"><input type="date" data-win-start="${w.id}" value="${w.start}" style="flex:1"><input type="date" data-win-end="${w.id}" value="${w.end}" style="flex:1"><button class="danger" data-remove-window="${w.id}">×</button></div>`).join('')}</div><button id="addWindowBtn">+ Zeitraum</button><div class="actions"><button data-close-modal>Schließen</button><button id="saveTripMeta" class="primary">Speichern</button><button id="deleteTrip" class="danger">Reise löschen</button></div>`,()=>{
    $('#addWindowBtn').onclick=()=>{t.dateWindows=t.dateWindows||[];t.dateWindows.push({id:uid('win'),start:activeVersion()?.startDate||'',end:activeVersion()?.endDate||''});persistSoon();closeModal();tripMenuModal(t)};
    $$('[data-remove-window]').forEach(b=>b.onclick=()=>{t.dateWindows=t.dateWindows.filter(w=>w.id!==b.dataset.removeWindow);persistSoon();closeModal();tripMenuModal(t)});
    $('#saveTripMeta').onclick=()=>{t.title=$('#mEditTripTitle').value.trim()||t.title;t.destination=$('#mEditTripDest').value.trim()||t.destination;t.country=t.destination;for(const w of t.dateWindows){const a=$(`[data-win-start="${w.id}"]`),b=$(`[data-win-end="${w.id}"]`);if(a&&b){w.start=a.value;w.end=b.value}}persistSoon();closeModal();renderAll()};
    $('#deleteTrip').onclick=()=>{if(!confirm(`Reise „${t.title}“ wirklich löschen?`))return;state.trips=state.trips.filter(x=>x.id!==t.id);state.activeTripId=state.trips[0]?.id||null;persistSoon();closeModal();renderAll()};
  });
}
function versionModal(t){const v=activeVersion();showModal(`<h2>Versionen</h2><p class="lead">Varianten bleiben unabhängig voneinander und können verglichen werden.</p>${t.versions.map(x=>`<div class="card" style="box-shadow:none"><b>${esc(x.name)}</b><div class="tiny">${fmtDate(x.startDate)} – ${fmtDate(x.endDate)}</div><div class="actions" style="margin-top:8px"><button data-select-ver="${x.id}">Öffnen</button><button data-copy-ver="${x.id}">Duplizieren</button>${t.versions.length>1?`<button class="danger" data-del-ver="${x.id}">Löschen</button>`:''}</div></div>`).join('')}<div class="actions"><button data-close-modal>Schließen</button><button id="renameCurrentVersion">Aktuelle umbenennen</button></div>`,()=>{
  $$('[data-select-ver]').forEach(b=>b.onclick=()=>{t.selectedVersionId=b.dataset.selectVer;persistSoon();closeModal();renderAll()});$$('[data-copy-ver]').forEach(b=>b.onclick=()=>{const x=t.versions.find(z=>z.id===b.dataset.copyVer);const name=prompt('Name der neuen Version:',`${x.name} – Variante`);if(!name)return;const c=cloneVersion(x,name);t.versions.push(c);t.selectedVersionId=c.id;persistSoon();closeModal();renderAll()});$$('[data-del-ver]').forEach(b=>b.onclick=()=>{if(!confirm('Version wirklich löschen?'))return;t.versions=t.versions.filter(x=>x.id!==b.dataset.delVer);if(t.selectedVersionId===b.dataset.delVer)t.selectedVersionId=t.versions[0]?.id;persistSoon();closeModal();renderAll()});$('#renameCurrentVersion').onclick=()=>{const x=activeVersion(),n=prompt('Neuer Versionsname:',x.name);if(n){x.name=n.trim();persistSoon();closeModal();renderAll()}};
});}

function addStopModal(dayId=null,prefill=null){
  const v=activeVersion();if(!v)return;const day=dayId?v.days.find(d=>d.id===dayId):v.days[0];
  showModal(`<h2>Stopp hinzufügen</h2><p class="lead">Suche einen Ort oder trage Koordinaten manuell ein.</p><div class="formgrid one"><label>Ort / Sehenswürdigkeit<input id="mSearchPlace" value="${esc(prefill?.name||'')}"></label></div><div class="actions"><button id="searchPlaceBtn" class="primary">Suchen</button><button id="manualStopBtn">Manuell</button><button data-close-modal>Abbrechen</button></div><div id="placeResults" class="searchresults"></div>`,()=>{
    $('#searchPlaceBtn').onclick=async()=>{const q=$('#mSearchPlace').value.trim();if(!q)return;const box=$('#placeResults');box.innerHTML='<div class="searchitem">Suche …</div>';try{const r=await Providers.geocode(q);box.innerHTML=r.map((x,i)=>`<div class="searchitem"><b>${esc(x.name)}</b><p>${esc(x.display)}</p><button data-pick-place="${i}">Auswählen</button></div>`).join('')||'<div class="searchitem">Nichts gefunden.</div>';$$('[data-pick-place]').forEach(b=>b.onclick=()=>{const x=r[+b.dataset.pickPlace];closeModal();editStopModal(day,{id:uid('stop'),name:x.name,lat:x.lat,lng:x.lng,type:guessStopType(x),priority:'normal',durationMin:60,durationWish:90,notes:'',openingHours:x.extratags?.opening_hours||'',fixedStart:'',images:[],tags:[],wildlife:[],modeToNext:'car',routeToNext:null},true)});}catch(e){box.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}};
    $('#manualStopBtn').onclick=()=>{closeModal();editStopModal(day,{id:uid('stop'),name:$('#mSearchPlace')?.value||'',lat:null,lng:null,type:'other',priority:'normal',durationMin:60,durationWish:60,notes:'',openingHours:'',fixedStart:'',images:[],tags:[],wildlife:[],modeToNext:'car',routeToNext:null},true)};
  });
}
function guessStopType(x){const t=`${x.category||''} ${x.type||''}`;if(/hotel|hostel|motel/.test(t))return'hotel';if(/park|nature|forest/.test(t))return'nature';if(/viewpoint/.test(t))return'viewpoint';if(/beach/.test(t))return'beach';if(/restaurant|cafe/.test(t))return'food';if(/city|town/.test(t))return'city';return'sight'}
function editStopModal(day,stop,isNew=false){
  const v=activeVersion();showModal(`<h2>${isNew?'Stopp hinzufügen':'Stopp bearbeiten'}</h2><p class="lead">Zeit, Priorität und Planungsdetails festlegen.</p><div class="formgrid"><label>Name<input id="mStopName" value="${esc(stop.name)}"></label><label>Typ<select id="mStopType">${Object.keys(STOP_ICONS).map(k=>`<option value="${k}" ${stop.type===k?'selected':''}>${STOP_ICONS[k]} ${k}</option>`).join('')}</select></label><label>Reisetag<select id="mStopDay">${v.days.map((d,i)=>`<option value="${d.id}" ${d.id===day.id?'selected':''}>Tag ${i+1} · ${fmtShortDate(d.date)}</option>`).join('')}</select></label><label>Priorität<select id="mStopPriority"><option value="must">Muss</option><option value="high">Hoch</option><option value="normal">Normal</option><option value="optional">Optional</option></select></label><label>Mindestdauer (min)<input id="mStopMin" type="number" min="0" value="${stop.durationMin||0}"></label><label>Wunschdauer (min)<input id="mStopWish" type="number" min="0" value="${stop.durationWish||stop.durationMin||0}"></label><label>Fixe Startzeit<input id="mStopFixed" type="time" value="${esc(stop.fixedStart||'')}"></label><label>Weiterreise<select id="mStopMode">${Object.entries(MODES).filter(([k])=>k!=='flight').map(([k,n])=>`<option value="${k}" ${stop.modeToNext===k?'selected':''}>${n}</option>`).join('')}</select></label><label>Breitengrad<input id="mStopLat" type="number" step="any" value="${stop.lat??''}"></label><label>Längengrad<input id="mStopLng" type="number" step="any" value="${stop.lng??''}"></label></div><div class="formgrid one"><label>Öffnungszeiten<input id="mStopOpen" value="${esc(stop.openingHours||'')}" placeholder="z. B. Mo-Su 09:00-18:00"></label><label>Notizen<textarea id="mStopNotes">${esc(stop.notes||'')}</textarea></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="lookupHoursBtn">Öffnungszeiten suchen</button><button id="lookupPhotosBtn">Fotos laden</button><button id="saveStopBtn" class="primary">Speichern</button></div><div id="stopLookupStatus" class="tiny" style="margin-top:8px"></div>`,()=>{
    $('#mStopPriority').value=stop.priority||'normal';
    $('#lookupHoursBtn').onclick=async()=>{const lat=+$('#mStopLat').value,lng=+$('#mStopLng').value;if(!Number.isFinite(lat)||!Number.isFinite(lng)){toast('Koordinaten fehlen.');return}$('#stopLookupStatus').textContent='Öffnungszeiten werden gesucht …';try{const h=await Providers.openingHours(lat,lng);if(h){$('#mStopOpen').value=h;$('#stopLookupStatus').textContent=`Gefunden: ${h}`}else $('#stopLookupStatus').textContent='Keine Öffnungszeiten in OpenStreetMap gefunden.'}catch(e){$('#stopLookupStatus').textContent=e.message}};
    $('#lookupPhotosBtn').onclick=async()=>{$('#stopLookupStatus').textContent='Fotos werden gesucht …';try{stop.images=await Providers.commonsPhotos($('#mStopName').value.trim());$('#stopLookupStatus').textContent=`${stop.images.length} Foto(s) gefunden und beim Stopp gespeichert.`}catch(e){$('#stopLookupStatus').textContent=e.message}};
    $('#saveStopBtn').onclick=()=>{const target=v.days.find(d=>d.id===$('#mStopDay').value);Object.assign(stop,{name:$('#mStopName').value.trim()||'Unbenannter Stopp',type:$('#mStopType').value,priority:$('#mStopPriority').value,durationMin:+$('#mStopMin').value||0,durationWish:+$('#mStopWish').value||0,fixedStart:$('#mStopFixed').value,modeToNext:$('#mStopMode').value,lat:$('#mStopLat').value===''?null:+$('#mStopLat').value,lng:$('#mStopLng').value===''?null:+$('#mStopLng').value,openingHours:$('#mStopOpen').value.trim(),notes:$('#mStopNotes').value.trim(),routeToNext:null});if(isNew){target.stops.push(stop)}else if(target.id!==day.id){day.stops=day.stops.filter(s=>s.id!==stop.id);target.stops.push(stop)}persistSoon();closeModal();renderAll();};
  });
}
function dayTimeModal(day){showModal(`<h2>Tageszeit</h2><p class="lead">Die effektive verfügbare Zeit wird zusätzlich durch Flüge begrenzt.</p><div class="formgrid"><label>Start<input id="mDayStart" type="time" value="${day.startTime}"></label><label>Ende<input id="mDayEnd" type="time" value="${day.endTime}"></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="saveDayTime" class="primary">Speichern</button></div>`,()=>{$('#saveDayTime').onclick=()=>{day.startTime=$('#mDayStart').value;day.endTime=$('#mDayEnd').value;persistSoon();closeModal();renderPlanner()}})}
function flightModal(flight=null){
  const v=activeVersion();if(!v)return;const f=flight||{id:uid('flight'),number:'',airline:'',from:'',to:'',departDate:v.startDate,departTime:'',arriveDate:v.startDate,arriveTime:'',arrivalBuffer:state.settings.arrivalBuffer,departureBuffer:state.settings.departureBuffer,notes:''};
  showModal(`<h2>${flight?'Flug bearbeiten':'Flug hinzufügen'}</h2><p class="lead">Flugnummer kann kostenlos zur Erkennung der Route genutzt werden. Die konkreten zukünftigen Zeiten werden manuell eingetragen.</p><div class="formgrid"><label>Flugnummer<input id="mFlightNo" value="${esc(f.number)}" placeholder="z. B. QF9"></label><label>Airline<input id="mAirline" value="${esc(f.airline||'')}"></label></div><button id="lookupFlightBtn">Flugroute erkennen</button><div class="formgrid"><label>Von<input id="mFlightFrom" value="${esc(f.from)}"></label><label>Nach<input id="mFlightTo" value="${esc(f.to)}"></label><label>Abflugdatum<input id="mFlightDepartDate" type="date" value="${f.departDate}"></label><label>Abflugzeit lokal<input id="mFlightDepartTime" type="time" value="${f.departTime}"></label><label>Ankunftsdatum<input id="mFlightArriveDate" type="date" value="${f.arriveDate}"></label><label>Ankunftszeit lokal<input id="mFlightArriveTime" type="time" value="${f.arriveTime}"></label><label>Puffer nach Ankunft (min)<input id="mArrBuffer" type="number" value="${f.arrivalBuffer}"></label><label>Puffer vor Abflug (min)<input id="mDepBuffer" type="number" value="${f.departureBuffer}"></label></div><div class="formgrid one"><label>Notiz<textarea id="mFlightNotes">${esc(f.notes||'')}</textarea></label></div><div id="flightLookupStatus" class="tiny"></div><div class="actions"><button data-close-modal>Abbrechen</button>${flight?'<button id="deleteFlightBtn" class="danger">Löschen</button>':''}<button id="saveFlightBtn" class="primary">Speichern</button></div>`,()=>{
    $('#lookupFlightBtn').onclick=async()=>{const n=$('#mFlightNo').value.trim();if(!n)return;$('#flightLookupStatus').textContent='Suche Route …';try{const r=await Providers.flightRoute(n);const route=r?.origin&&r?.destination?r:null;if(route){const orig=route.origin?.iata_code||route.origin?.icao_code||route.origin?.name||'',dest=route.destination?.iata_code||route.destination?.icao_code||route.destination?.name||'';if(orig)$('#mFlightFrom').value=route.origin?.municipality?`${route.origin.municipality} (${orig})`:orig;if(dest)$('#mFlightTo').value=route.destination?.municipality?`${route.destination.municipality} (${dest})`:dest;$('#flightLookupStatus').textContent='Route erkannt. Zeiten bitte anhand deiner Buchung ergänzen.';}else $('#flightLookupStatus').textContent='Keine eindeutige Route gefunden.'}catch(e){$('#flightLookupStatus').textContent=e.message}};
    $('#saveFlightBtn').onclick=()=>{Object.assign(f,{number:$('#mFlightNo').value.trim().toUpperCase(),airline:$('#mAirline').value.trim(),from:$('#mFlightFrom').value.trim(),to:$('#mFlightTo').value.trim(),departDate:$('#mFlightDepartDate').value,departTime:$('#mFlightDepartTime').value,arriveDate:$('#mFlightArriveDate').value,arriveTime:$('#mFlightArriveTime').value,arrivalBuffer:+$('#mArrBuffer').value||0,departureBuffer:+$('#mDepBuffer').value||0,notes:$('#mFlightNotes').value.trim()});if(!flight)v.flights.push(f);persistSoon();closeModal();renderPlanner()};if(flight)$('#deleteFlightBtn').onclick=()=>{v.flights=v.flights.filter(x=>x.id!==f.id);persistSoon();closeModal();renderPlanner()};
  });
}
async function discoverAll(){
  const t=activeTrip(),v=activeVersion();if(!t||!v)return;
  const btn=$('#discoverBtn'),old=btn.textContent;btn.classList.add('loading');btn.disabled=true;btn.textContent='Lädt …';
  try{
    // Städte zuerst laden: die Highlight-Suche nutzt die Stadtliste als Negativfilter.
    const cityOk=await loadCities();
    const rest=await Promise.all([loadAttractions(),loadWildlife()]);const results=[cityOk,...rest],ok=results.filter(Boolean).length;
    toast(ok===3?'Inspiration erfolgreich geladen.':ok>0?`${ok} von 3 Bereichen wurden geladen.`:'Inspiration konnte nicht geladen werden.');
  }finally{btn.classList.remove('loading');btn.disabled=false;btn.textContent=old}
}
async function loadCities(){
  const t=activeTrip();if(!t)return false;const box=$('#citySuggestions');box.className='suggestions scrollsuggestions';box.innerHTML='<div class="suggestion">Städte werden geladen …</div>';
  try{const data=await Providers.cities(t.country||t.destination);renderCitySuggestions(data);return true;}catch(e){box.innerHTML=`<div class="warnline errorline"><b>Städte:</b> ${esc(e.message)}</div>`;return false}
}
async function loadAttractions(){
  const t=activeTrip();if(!t)return false;const box=$('#poiSuggestions');box.className='suggestions';box.innerHTML='<div class="suggestion">Sehenswürdigkeiten werden geladen …</div>';
  try{const data=await Providers.attractions(t.country||t.destination);renderAttractionSuggestions(data);return true;}catch(e){box.innerHTML=`<div class="warnline errorline"><b>Sehenswürdigkeiten:</b> ${esc(e.message)}</div>`;return false}
}
async function loadWildlife(){
  const t=activeTrip(),v=activeVersion();if(!t)return false;const box=$('#wildSuggestions');box.className='suggestions';box.innerHTML='<div class="suggestion">Wildlife wird geladen …</div>';const month=v?.startDate?new Date(`${v.startDate}T12:00:00`).getMonth()+1:0;
  try{const data=await Providers.wildlife(t.destination,month);renderWildlifeSuggestions(data);return true;}catch(e){box.innerHTML=`<div class="warnline errorline"><b>Wildlife:</b> ${esc(e.message)}</div>`;return false}
}
function addSuggestion(payload){const v=activeVersion();if(!v)return;if(payload.kind==='poi'){const day=v.days[0];const stop={id:uid('stop'),name:payload.name,lat:payload.lat,lng:payload.lng,type:'sight',priority:'high',durationMin:45,durationWish:90,notes:'Automatisch vorgeschlagenes Highlight',openingHours:'',fixedStart:'',images:[],tags:['highlight'],wildlife:[],modeToNext:'car',routeToNext:null};closeModal();editStopModal(day,stop,true)}}
function chooseTargetSpecies(x){
  const t=activeTrip();t.targetSpecies=t.targetSpecies||[];if(!t.targetSpecies.some(y=>y.taxonId===x.taxonId))t.targetSpecies.push(x);persistSoon();
  showModal(`<h2>${esc(x.name)}</h2>${x.photo?`<img src="${esc(x.photo)}" style="width:100%;max-height:220px;object-fit:cover;border-radius:16px">`:''}<p class="lead"><i>${esc(x.scientific)}</i><br>${x.count} Beobachtungen im ausgewerteten Gebiet/Zeitraum.</p><p>Die App kann aktuelle bzw. historische iNaturalist-Beobachtungen um einen gewählten Punkt clustern und daraus Kandidaten für Wildlife-Stopps erzeugen.</p><div class="actions"><button data-close-modal>Schließen</button><button id="speciesHotspotBtn" class="primary">Hotspots finden</button></div>`,()=>{$('#speciesHotspotBtn').onclick=()=>wildlifeHotspotModal(x)});
}
async function wildlifeHotspotModal(species){
  const t=activeTrip(),v=activeVersion();closeModal();showModal(`<h2>${esc(species.name)} – Hotspots</h2><p class="lead">Wähle zunächst einen Ort entlang der geplanten Reise als Suchzentrum.</p><div class="formgrid one"><label>Ort<input id="mWildCenter" value="${esc(t.destination)}"></label><label>Radius (km)<input id="mWildRadius" type="number" min="5" max="200" value="80"></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="searchWildCenter" class="primary">Beobachtungen suchen</button></div><div id="wildHotResults" class="searchresults"></div>`,()=>{
    $('#searchWildCenter').onclick=async()=>{const box=$('#wildHotResults');box.innerHTML='Suche …';try{const g=await Providers.geocode($('#mWildCenter').value.trim(),3);if(!g.length)throw new Error('Ort nicht gefunden.');const month=v.startDate?new Date(`${v.startDate}T12:00:00`).getMonth()+1:0;const obs=await Providers.wildlifeObservations(species.taxonId,g[0].lat,g[0].lng,+$('#mWildRadius').value||80,month);const pts=obs.map(o=>({lat:o.geojson?.coordinates?.[1],lng:o.geojson?.coordinates?.[0],date:o.observed_on,place:o.place_guess})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));const clusters=clusterPoints(pts,15).slice(0,5);box.innerHTML=clusters.length?clusters.map((c,i)=>`<div class="searchitem"><b>Hotspot ${i+1} · ${c.points.length} Beobachtungen</b><p>${c.points[0]?.place?esc(c.points[0].place):`${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}</p><button data-add-wildcluster="${i}">Als Wildlife-Stopp</button></div>`).join(''):'Keine passenden Beobachtungen gefunden.';$$('[data-add-wildcluster]').forEach(b=>b.onclick=()=>{const c=clusters[+b.dataset.addWildcluster];closeModal();const day=v.days[0],s={id:uid('stop'),name:`${species.name} – Beobachtungshotspot`,lat:c.lat,lng:c.lng,type:'wildlife',priority:'high',durationMin:60,durationWish:120,notes:`iNaturalist-Cluster: ${c.points.length} Beobachtungen. Sichtung nicht garantiert.`,openingHours:'',fixedStart:'',images:species.photo?[{url:species.photo,full:species.photo,title:species.name,page:'https://www.inaturalist.org'}]:[],tags:['wildlife'],wildlife:[species.name],modeToNext:'car',routeToNext:null};editStopModal(day,s,true)});}catch(e){box.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}};
  });
}
function clusterPoints(points,radiusKm=15){const remaining=[...points],clusters=[];while(remaining.length){const seed=remaining.shift(),group=[seed];for(let i=remaining.length-1;i>=0;i--){if(haversine(seed,remaining[i])<=radiusKm)group.push(remaining.splice(i,1)[0]);}const lat=group.reduce((a,p)=>a+p.lat,0)/group.length,lng=group.reduce((a,p)=>a+p.lng,0)/group.length;clusters.push({lat,lng,points:group});}return clusters.sort((a,b)=>b.points.length-a.points.length)}


function addCitySuggestion(city){
  const v=activeVersion();if(!v)return;const day=v.days[0],s={id:uid('stop'),name:city.name,lat:+city.lat,lng:+city.lng,type:'city',priority:'high',durationMin:30,durationWish:30,notes:'Stadt als Basis aus den Reise-Inspirationen hinzugefügt.',openingHours:'',fixedStart:'',images:[],tags:['city-base'],wildlife:[],modeToNext:'walk',routeToNext:null};editStopModal(day,s,true);
}
async function cityInspirationModal(city){
  const v=activeVersion();if(!v)return;showModal(`<h2>🏙 ${esc(city.name)}</h2><p class="lead">Konkrete Sehenswürdigkeiten dieser Stadt auswählen und direkt als Sightseeing-Tour einem Reisetag zuordnen.</p><div class="formgrid"><label>Reisetag<select id="mCityDay">${v.days.map((d,i)=>`<option value="${d.id}">Tag ${i+1} · ${fmtShortDate(d.date)}</option>`).join('')}</select></label><label>Suchradius (m)<input id="mCityDetailRadius" type="number" min="1000" max="12000" step="500" value="5000"></label></div><div class="actions"><button data-close-modal>Schließen</button><button id="loadCityDetails" class="primary">Sehenswürdigkeiten laden</button></div><div id="cityDetailResults" class="city-poi-list"><div class="searchitem">Noch nicht geladen.</div></div>`,()=>{
    $('#loadCityDetails').onclick=async()=>{const box=$('#cityDetailResults');box.innerHTML='<div class="searchitem">Stadt-Sehenswürdigkeiten werden geladen …</div>';try{const pois=await Providers.cityPois(+city.lat,+city.lng,+$('#mCityDetailRadius').value||5000);const shown=pois.slice(0,15);box.innerHTML=shown.map((p,i)=>`<div class="searchitem"><b>${i+1}. ${esc(p.name)}</b><p>${p.openingHours?`Öffnungszeiten: ${esc(p.openingHours)}`:'Keine Öffnungszeiten in OpenStreetMap hinterlegt.'}</p><label><input type="checkbox" data-city-detail-pick="${i}" ${i<7?'checked':''}> für Tour auswählen</label></div>`).join('')||'<div class="searchitem">Keine geeigneten Sehenswürdigkeiten gefunden.</div>';if(shown.length)box.insertAdjacentHTML('beforeend','<button id="addCityDetailTour" class="primary" style="width:100%;margin-top:10px">Auswahl als Sightseeing-Tour hinzufügen</button>');$('#addCityDetailTour')?.addEventListener('click',async()=>{const day=v.days.find(d=>d.id===$('#mCityDay').value),picks=$$('[data-city-detail-pick]:checked').map(c=>shown[+c.dataset.cityDetailPick]);if(!day)return;let base=day.stops.find(s=>s.type==='city'&&normalizeName(s.name)===normalizeName(city.name));if(!base){base={id:uid('stop'),name:city.name,lat:+city.lat,lng:+city.lng,type:'city',priority:'high',durationMin:20,durationWish:20,notes:'Stadtbasis für Sightseeing-Tour',openingHours:'',fixedStart:'',images:[],tags:['city-base'],wildlife:[],modeToNext:'walk',routeToNext:null};day.stops.push(base);}const ordered=nearestOrder(base,picks);for(const p of ordered)day.stops.push({id:uid('stop'),name:p.name,lat:p.lat,lng:p.lng,type:p.type,priority:'normal',durationMin:30,durationWish:p.type==='sight'?60:45,notes:'Aus Stadt-Inspiration übernommen',openingHours:p.openingHours||'',fixedStart:'',images:[],tags:['city-tour'],wildlife:[],modeToNext:'walk',routeToNext:null});persistSoon();closeModal();renderPlanner();await refreshDayRoutes(day,false);toast(`${ordered.length} Sehenswürdigkeiten zu Tag ${v.days.indexOf(day)+1} hinzugefügt.`);});}catch(e){box.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}};
  });
}
function accommodations(v=activeVersion()){return (v?.days||[]).flatMap(d=>d.stops.filter(s=>s.type==='hotel'||s.accommodation).map(s=>({day:d,stop:s})));}
function accommodationsForDate(v,date){return accommodations(v).filter(({stop:s})=>{const a=s.accommodation;if(!a)return true;return (!a.checkInDate||a.checkInDate<=date)&&(!a.checkOutDate||a.checkOutDate>=date);});}
function accommodationModal(dayId=null){
  const v=activeVersion();if(!v)return;const day=dayId?v.days.find(d=>d.id===dayId):v.days[0];
  showModal(`<h2>🛏 Unterkunft hinzufügen</h2><p class="lead">Hotel, Airbnb/Ferienwohnung, Hostel oder Campingplatz als feste Basis der Reise speichern.</p><div class="formgrid one"><label>Name oder Adresse<input id="mLodgingSearch" placeholder="z. B. Hotelname oder vollständige Adresse"></label></div><div class="actions"><button id="searchLodgingBtn" class="primary">Suchen</button><button id="manualLodgingBtn">Manuell eintragen</button><button data-close-modal>Abbrechen</button></div><div id="lodgingResults" class="searchresults"></div>`,()=>{
    const openDetails=(place=null)=>{closeModal();const s={id:uid('stop'),name:place?.name||'',lat:place?.lat??null,lng:place?.lng??null,type:'hotel',priority:'high',durationMin:20,durationWish:20,notes:'',openingHours:'',fixedStart:'',images:[],tags:['accommodation'],wildlife:[],modeToNext:'walk',routeToNext:null,accommodation:{kind:'Hotel',checkInDate:day.date,checkInTime:'15:00',checkOutDate:day.date,checkOutTime:'10:00',address:place?.display||'',bookingRef:''}};accommodationDetailsModal(day,s,true);};
    $('#searchLodgingBtn').onclick=async()=>{const q=$('#mLodgingSearch').value.trim();if(!q)return;const box=$('#lodgingResults');box.innerHTML='Suche …';try{const r=await Providers.geocode(q,8);box.innerHTML=r.map((x,i)=>`<div class="searchitem"><b>${esc(x.name)}</b><p>${esc(x.display)}</p><button data-pick-lodging="${i}">Auswählen</button></div>`).join('')||'Nichts gefunden.';$$('[data-pick-lodging]').forEach(b=>b.onclick=()=>openDetails(r[+b.dataset.pickLodging]));}catch(e){box.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}};
    $('#manualLodgingBtn').onclick=()=>openDetails(null);
  });
}
function accommodationDetailsModal(day,stop,isNew){
  const v=activeVersion(),a=stop.accommodation||{};showModal(`<h2>🛏 Unterkunft</h2><p class="lead">Die Unterkunft kann später als Ziel eines Flughafentransfers und als Startpunkt für Stadtrundgänge verwendet werden.</p><div class="formgrid"><label>Name<input id="mLodgingName" value="${esc(stop.name)}"></label><label>Art<select id="mLodgingKind">${['Hotel','Airbnb / Ferienwohnung','Hostel','Campingplatz','Sonstige Unterkunft'].map(x=>`<option ${a.kind===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Anreisetag<select id="mLodgingDay">${v.days.map((d,i)=>`<option value="${d.id}" ${d.id===day.id?'selected':''}>Tag ${i+1} · ${fmtShortDate(d.date)}</option>`).join('')}</select></label><label>Check-in<input id="mCheckInTime" type="time" value="${esc(a.checkInTime||'15:00')}"></label><label>Check-out-Datum<input id="mCheckOutDate" type="date" value="${esc(a.checkOutDate||day.date)}"></label><label>Check-out-Zeit<input id="mCheckOutTime" type="time" value="${esc(a.checkOutTime||'10:00')}"></label><label>Breitengrad<input id="mLodgingLat" type="number" step="any" value="${stop.lat??''}"></label><label>Längengrad<input id="mLodgingLng" type="number" step="any" value="${stop.lng??''}"></label></div><div class="formgrid one"><label>Adresse<input id="mLodgingAddress" value="${esc(a.address||'')}"></label><label>Buchungs-/Reservierungsnummer<input id="mLodgingRef" value="${esc(a.bookingRef||'')}"></label><label>Notizen<textarea id="mLodgingNotes">${esc(stop.notes||'')}</textarea></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="saveLodgingBtn" class="primary">Unterkunft speichern</button></div>`,()=>{
    $('#saveLodgingBtn').onclick=()=>{const target=v.days.find(d=>d.id===$('#mLodgingDay').value);Object.assign(stop,{name:$('#mLodgingName').value.trim()||'Unterkunft',lat:$('#mLodgingLat').value===''?null:+$('#mLodgingLat').value,lng:$('#mLodgingLng').value===''?null:+$('#mLodgingLng').value,type:'hotel',notes:$('#mLodgingNotes').value.trim(),accommodation:{kind:$('#mLodgingKind').value,checkInDate:target.date,checkInTime:$('#mCheckInTime').value,checkOutDate:$('#mCheckOutDate').value||target.date,checkOutTime:$('#mCheckOutTime').value,address:$('#mLodgingAddress').value.trim(),bookingRef:$('#mLodgingRef').value.trim()}});if(isNew)target.stops.push(stop);else if(target.id!==day.id){day.stops=day.stops.filter(x=>x.id!==stop.id);target.stops.push(stop)}persistSoon();closeModal();renderAll();toast('Unterkunft gespeichert.');};
  });
}
function airportSearchTerm(to){const text=String(to||'').trim(),m=text.match(/\(([A-Z]{3})\)/i);return `${text.replace(/\([A-Z]{3}\)/i,'').trim()} ${m?m[1]+' ':''}Airport`.trim();}
async function transferModal(transfer=null,preselectedFlightId=null){
  const v=activeVersion();if(!v)return;v.transfers=v.transfers||[];const flights=(v.flights||[]).filter(f=>f.arriveDate),lodgings=accommodations(v);if(!flights.length){toast('Füge zuerst einen Flug mit Ankunftsdaten hinzu.');return}if(!lodgings.length){toast('Füge zuerst eine Unterkunft hinzu.');accommodationModal();return}
  const x=transfer||{id:uid('transfer'),flightId:preselectedFlightId||flights[0].id,toStopId:lodgings[0].stop.id,date:'',fromName:'',fromLat:null,fromLng:null,toName:'',toLat:null,toLng:null,mode:'transit',distanceKm:0,durationMin:0,approx:true,notes:''};
  const selectedFlight=flights.find(f=>f.id===x.flightId)||flights[0];if(!x.date)x.date=selectedFlight.arriveDate;
  showModal(`<h2>↔ Flughafentransfer</h2><p class="lead">Verknüpft eine Flugankunft mit der Unterkunft und reduziert automatisch die danach verfügbare Sightseeing-Zeit.</p><div class="formgrid"><label>Ankunftsflug<select id="mTransferFlight">${flights.map(f=>`<option value="${f.id}" ${f.id===x.flightId?'selected':''}>${esc(f.number||'Flug')} · ${esc(f.to)} · ${fmtShortDate(f.arriveDate)} ${esc(f.arriveTime)}</option>`).join('')}</select></label><label>Unterkunft<select id="mTransferLodging">${lodgings.map(({stop:s})=>`<option value="${s.id}" ${s.id===x.toStopId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Verkehrsmittel<select id="mTransferMode">${['transit','rentalcar','rideshare','taxi','car'].map(k=>`<option value="${k}" ${x.mode===k?'selected':''}>${MODES[k]}</option>`).join('')}</select></label><label>Dauer (min)<input id="mTransferDuration" type="number" min="0" value="${x.durationMin||0}"></label><label>Entfernung (km)<input id="mTransferDistance" type="number" min="0" step="0.1" value="${x.distanceKm||0}"></label><label>Datum<input id="mTransferDate" type="date" value="${esc(x.date||selectedFlight.arriveDate)}"></label></div><div class="formgrid one"><label>Notizen<textarea id="mTransferNotes">${esc(x.notes||'')}</textarea></label></div><p class="transfer-mode-note">ÖPNV wird in dieser kostenlosen Version als realistische Näherung geschätzt; Mietwagen, Taxi und Uber/Rideshare verwenden die Straßenroute. Dauer und Entfernung können jederzeit manuell korrigiert werden.</p><div id="transferStatus" class="tiny"></div><div class="actions"><button data-close-modal>Abbrechen</button>${transfer?'<button id="deleteTransferBtn" class="danger">Löschen</button>':''}<button id="calcTransferBtn">Route berechnen</button><button id="saveTransferBtn" class="primary">Speichern</button></div>`,()=>{
    $('#mTransferFlight').onchange=()=>{const f=flights.find(z=>z.id===$('#mTransferFlight').value);if(f)$('#mTransferDate').value=f.arriveDate||''};
    $('#calcTransferBtn').onclick=async()=>{const f=flights.find(z=>z.id===$('#mTransferFlight').value),lod=lodgings.find(z=>z.stop.id===$('#mTransferLodging').value)?.stop;if(!f||!lod||!Number.isFinite(lod.lat)||!Number.isFinite(lod.lng)){toast('Flug oder Unterkunft mit Koordinaten fehlt.');return}const status=$('#transferStatus');status.textContent='Flughafen und Route werden gesucht …';try{const g=await Providers.geocode(airportSearchTerm(f.to),5);const airport=g.find(z=>/aeroway|airport|aerodrome/i.test(`${z.category} ${z.type} ${z.display}`))||g[0];if(!airport)throw new Error('Ankunftsflughafen konnte nicht geocodiert werden.');const mode=$('#mTransferMode').value,routeMode=['rentalcar','rideshare','taxi','car'].includes(mode)?'car':'transit',r=await Providers.route({lat:airport.lat,lng:airport.lng},{lat:lod.lat,lng:lod.lng},routeMode);x.fromName=airport.name||f.to;x.fromLat=airport.lat;x.fromLng=airport.lng;x.toName=lod.name;x.toLat=lod.lat;x.toLng=lod.lng;x.approx=routeMode==='transit'||r.approx;$('#mTransferDuration').value=Math.round(r.durationMin||0);$('#mTransferDistance').value=(r.distanceKm||0).toFixed(1);status.textContent=`Route: ${kmText(r.distanceKm)} · ${durText(r.durationMin)}${x.approx?' (ca.)':''}`;}catch(e){status.textContent=e.message}};
    $('#saveTransferBtn').onclick=()=>{const f=flights.find(z=>z.id===$('#mTransferFlight').value),lod=lodgings.find(z=>z.stop.id===$('#mTransferLodging').value)?.stop;if(!f||!lod){toast('Flug und Unterkunft auswählen.');return}Object.assign(x,{flightId:f.id,toStopId:lod.id,date:$('#mTransferDate').value||f.arriveDate,toName:lod.name,toLat:lod.lat,toLng:lod.lng,mode:$('#mTransferMode').value,durationMin:+$('#mTransferDuration').value||0,distanceKm:+$('#mTransferDistance').value||0,notes:$('#mTransferNotes').value.trim()});if(!x.fromName)x.fromName=f.to;if(!transfer)v.transfers.push(x);persistSoon();closeModal();renderPlanner();toast('Flughafentransfer gespeichert.');};
    if(transfer)$('#deleteTransferBtn').onclick=()=>{v.transfers=v.transfers.filter(z=>z.id!==x.id);persistSoon();closeModal();renderPlanner()};
  });
}
async function cityTour(day){
  const v=activeVersion(),candidates=[...day.stops.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)),...accommodationsForDate(v,day.date).map(x=>x.stop).filter(s=>!day.stops.some(d=>d.id===s.id)&&Number.isFinite(s.lat)&&Number.isFinite(s.lng))];if(!candidates.length){toast('Füge zuerst eine Stadt oder Unterkunft mit Koordinaten hinzu.');return}const anchor=candidates.find(s=>s.type==='city')||candidates.find(s=>s.accommodation)||candidates[0];
  showModal(`<h2>Stadtrundgang erzeugen</h2><p class="lead">Die App sucht kostenlose OpenStreetMap-POIs rund um ${esc(anchor.name)} und schlägt einen kompakten Rundgang vor.</p><div class="formgrid"><label>Startpunkt<select id="mCityAnchor">${candidates.map(s=>`<option value="${s.id}" ${s.id===anchor.id?'selected':''}>${esc(s.name)}${s.accommodation?' · Unterkunft':''}</option>`).join('')}</select></label><label>Max. neue Stopps<input id="mCityCount" type="number" min="2" max="12" value="7"></label><label>Suchradius (m)<input id="mCityRadius" type="number" min="1000" max="12000" step="500" value="4500"></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="runCityTour" class="primary">Vorschläge suchen</button></div><div id="cityTourResults" class="searchresults"></div>`,()=>{
    $('#runCityTour').onclick=async()=>{const box=$('#cityTourResults');box.innerHTML='Suche Sehenswürdigkeiten …';try{const selectedAnchor=candidates.find(s=>s.id===$('#mCityAnchor').value)||anchor;const pois=await Providers.cityPois(selectedAnchor.lat,selectedAnchor.lng,+$('#mCityRadius').value||4500),count=clamp(+$('#mCityCount').value||7,2,12);const chosen=nearestOrder(selectedAnchor,pois.slice(0,Math.max(count*2,12))).slice(0,count);box.innerHTML=chosen.map((p,i)=>`<div class="searchitem"><b>${i+1}. ${esc(p.name)}</b><p>${p.openingHours?`Öffnungszeiten: ${esc(p.openingHours)}`:'Keine Öffnungszeiten hinterlegt'}</p><label><input type="checkbox" data-city-pick="${i}" checked> hinzufügen</label></div>`).join('')||'Keine geeigneten POIs gefunden.';if(chosen.length)box.insertAdjacentHTML('beforeend','<button id="addCityPicks" class="primary" style="margin-top:10px;width:100%">Ausgewählte Stopps hinzufügen</button>');$('#addCityPicks')?.addEventListener('click',()=>{const picks=$$('[data-city-pick]:checked').map(c=>chosen[+c.dataset.cityPick]);for(const p of picks)day.stops.push({id:uid('stop'),name:p.name,lat:p.lat,lng:p.lng,type:p.type,priority:'normal',durationMin:30,durationWish:p.type==='sight'?60:45,notes:'Automatisch vorgeschlagener Stadtrundgang',openingHours:p.openingHours||'',fixedStart:'',images:[],tags:['city-tour'],wildlife:[],modeToNext:'walk',routeToNext:null});persistSoon();closeModal();renderPlanner();toast(`${picks.length} Stopps hinzugefügt.`)});}catch(e){box.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}};
  });
}
function nearestOrder(anchor,pois){const rem=[...pois],out=[];let cur=anchor;while(rem.length){let bi=0,bd=Infinity;for(let i=0;i<rem.length;i++){const d=haversine(cur,rem[i]);if(d<bd){bd=d;bi=i}}const p=rem.splice(bi,1)[0];out.push(p);cur=p;}return out}

async function refreshDayRoutes(day,announce=true){
  if(day.stops.length<2){if(announce)toast('Mindestens zwei Stopps nötig.');return}
  for(let i=0;i<day.stops.length-1;i++){const a=day.stops[i],b=day.stops[i+1];if(!Number.isFinite(a.lat)||!Number.isFinite(a.lng)||!Number.isFinite(b.lat)||!Number.isFinite(b.lng)){a.routeToNext=null;continue}try{a.routeToNext=await Providers.route(a,b,a.modeToNext||'car');renderPlanner();}catch(e){a.routeToNext=null}}
  day.stops[day.stops.length-1].routeToNext=null;persistSoon();renderPlanner();if(currentView==='map')renderMap();if(announce)toast('Strecken aktualisiert.');
}
async function refreshAllRoutes(){const v=activeVersion();if(!v)return;$('#refreshBtn').classList.add('loading');try{for(const d of v.days)await refreshDayRoutes(d,false);toast('Alle Strecken aktualisiert.');}finally{$('#refreshBtn').classList.remove('loading')}}

// ------------------------- Map -------------------------
function initMap(){
  if(mapReady)return;
  if(typeof L==='undefined'){const hint=$('#mapHint');hint.textContent='Kartenskript konnte nicht geladen werden. Internetverbindung prüfen.';return;}
  map=L.map('map',{zoomControl:true}).setView([20,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  mapStopLayer=L.layerGroup().addTo(map);mapRouteLayer=L.layerGroup().addTo(map);mapReady=true;$('#mapHint').classList.add('hidden');
}
function renderMap(){
  initMap();if(!mapReady)return;const v=activeVersion();if(!v){mapStopLayer.clearLayers();mapRouteLayer.clearLayers();return}
  if(!mapDayVisible.size)v.days.forEach((_,i)=>mapDayVisible.add(i));
  const chips=$('#mapDayChips');chips.innerHTML='';v.days.forEach((d,i)=>{const b=document.createElement('button');b.textContent=`Tag ${i+1}`;b.style.borderColor=DAY_COLORS[i%DAY_COLORS.length];b.style.color=DAY_COLORS[i%DAY_COLORS.length];if(!mapDayVisible.has(i))b.classList.add('off');b.onclick=()=>{mapDayVisible.has(i)?mapDayVisible.delete(i):mapDayVisible.add(i);renderMap()};chips.appendChild(b)});
  mapStopLayer.clearLayers();mapRouteLayer.clearLayers();const bounds=[];
  v.days.forEach((d,di)=>{if(!mapDayVisible.has(di))return;const color=DAY_COLORS[di%DAY_COLORS.length];d.stops.forEach((s,i)=>{if(!Number.isFinite(s.lat)||!Number.isFinite(s.lng))return;bounds.push([s.lat,s.lng]);const marker=L.circleMarker([s.lat,s.lng],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(mapStopLayer);marker.bindTooltip(`Tag ${di+1}: ${s.name}`);marker.bindPopup(mapPopup(s,di));marker.on('popupopen',async()=>{if(!(s.images||[]).length){try{s.images=await Providers.commonsPhotos(`${s.name} ${activeTrip()?.destination||''}`);persistSoon();marker.setPopupContent(mapPopup(s,di));}catch(e){}}});if(i<d.stops.length-1){const r=s.routeToNext;if(r?.geometry?.length){L.polyline(r.geometry,{color,weight:5,opacity:.78}).addTo(mapRouteLayer);}else{const n=d.stops[i+1];if(Number.isFinite(n.lat)&&Number.isFinite(n.lng))L.polyline([[s.lat,s.lng],[n.lat,n.lng]],{color,weight:3,opacity:.45,dashArray:'5 7'}).addTo(mapRouteLayer);}}});for(const tr of (v.transfers||[]).filter(x=>x.date===d.date)){if(Number.isFinite(tr.fromLat)&&Number.isFinite(tr.fromLng)&&Number.isFinite(tr.toLat)&&Number.isFinite(tr.toLng)){bounds.push([tr.fromLat,tr.fromLng],[tr.toLat,tr.toLng]);L.polyline([[tr.fromLat,tr.fromLng],[tr.toLat,tr.toLng]],{color,weight:4,opacity:.75,dashArray:'8 7'}).bindTooltip(`Tag ${di+1}: Flughafentransfer · ${MODES[tr.mode]||tr.mode}`).addTo(mapRouteLayer);}}});
  if(bounds.length){if(!map._hasFitOnce){map.fitBounds(bounds,{padding:[30,30]});map._hasFitOnce=true}}
  setTimeout(()=>map.invalidateSize(),80);
}
function mapPopup(s,di){return `<div class="mappopup"><h3><span style="color:${DAY_COLORS[di%DAY_COLORS.length]}">Tag ${di+1}</span> · ${esc(s.name)}</h3><p>${STOP_ICONS[s.type]||'•'} ${priorityText(s.priority)} · ${durText(s.durationWish||s.durationMin)}</p>${s.openingHours?`<p><b>Öffnungszeiten:</b> ${esc(s.openingHours)}</p>`:''}${s.notes?`<p>${esc(s.notes)}</p>`:''}${(s.images||[]).length?`<div class="popphotos">${s.images.slice(0,3).map(x=>`<a href="${esc(x.page||x.full||x.url)}" target="_blank"><img src="${esc(x.url)}"></a>`).join('')}</div>`:'<p>Bilder werden beim ersten Öffnen gesucht …</p>'}</div>`}
function fitMap(){if(!mapReady)return;const v=activeVersion(),pts=v?.days.flatMap(d=>d.stops).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)).map(s=>[s.lat,s.lng])||[];for(const tr of v?.transfers||[]){if(Number.isFinite(tr.fromLat)&&Number.isFinite(tr.fromLng))pts.push([tr.fromLat,tr.fromLng]);if(Number.isFinite(tr.toLat)&&Number.isFinite(tr.toLng))pts.push([tr.toLat,tr.toLng]);}if(pts.length)map.fitBounds(pts,{padding:[25,25]})}
function mapFilterModal(){const v=activeVersion();if(!v)return;showModal(`<h2>Kartenfilter</h2><p class="lead">Zeige nur ausgewählte Reisetage.</p><div class="chips">${v.days.map((d,i)=>`<button class="chip ${mapDayVisible.has(i)?'on':''}" data-map-day="${i}">Tag ${i+1}<br><small>${fmtShortDate(d.date)}</small></button>`).join('')}</div><div class="actions"><button id="mapAllDays">Alle</button><button id="mapNoDays">Keine</button><button data-close-modal class="primary">Fertig</button></div>`,()=>{$$('[data-map-day]').forEach(b=>b.onclick=()=>{const i=+b.dataset.mapDay;mapDayVisible.has(i)?mapDayVisible.delete(i):mapDayVisible.add(i);b.classList.toggle('on');renderMap()});$('#mapAllDays').onclick=()=>{v.days.forEach((_,i)=>mapDayVisible.add(i));closeModal();renderMap()};$('#mapNoDays').onclick=()=>{mapDayVisible.clear();closeModal();renderMap()}})}


// ------------------------- App updates -------------------------
function parseVersion(v){
  const parts=String(v||'0').replace(/^v/i,'').split(/[.+-]/).slice(0,3).map(x=>parseInt(x,10)||0);
  while(parts.length<3)parts.push(0); return parts;
}
function isNewerVersion(candidate,current){
  const a=parseVersion(candidate),b=parseVersion(current);
  for(let i=0;i<3;i++){if(a[i]>b[i])return true;if(a[i]<b[i])return false;}return false;
}
function renderUpdateUi(){
  const badge=$('#installedVersion'),status=$('#updateStatus'),btn=$('#installUpdateBtn'),notes=$('#updateNotes'),info=$('#versionInfo');
  if(!badge)return;
  badge.textContent=`v${installedAppVersion.versionName||'?'}`;
  if(info)info.textContent=`Version ${installedAppVersion.versionName||'–'} · lokale Android-App · Repository: ${UPDATE_REPOSITORY}`;
  if(availableUpdate){
    status.innerHTML=`<b>Version ${esc(availableUpdate.versionName)} ist verfügbar.</b>`;
    notes.textContent=availableUpdate.notes||'Für dieses Release wurden keine zusätzlichen Hinweise hinterlegt.';
    notes.classList.remove('hidden');
    btn.textContent=`Version ${availableUpdate.versionName} installieren`;
    btn.classList.remove('hidden');
  }else{
    notes.classList.add('hidden'); btn.classList.add('hidden');
  }
}
function readInstalledVersion(){
  try{
    if(window.AndroidBridge?.getAppVersion){
      const raw=AndroidBridge.getAppVersion(); const parsed=JSON.parse(raw||'{}');
      if(parsed.versionName)installedAppVersion={...installedAppVersion,...parsed};
    }
  }catch(e){}
  renderUpdateUi();
}
async function checkForUpdates({silent=false}={}){
  const status=$('#updateStatus'),check=$('#checkUpdateBtn');
  if(check){check.disabled=true;check.textContent='Prüfe …'}
  if(status&&!silent)status.textContent='GitHub wird nach der neuesten Version gefragt …';
  try{
    const rel=await apiJson(UPDATE_API);
    const versionName=String(rel.tag_name||rel.name||'').replace(/^v/i,'');
    const apk=(rel.assets||[]).find(a=>/\.apk$/i.test(a.name||''));
    if(!versionName||!apk?.browser_download_url)throw new Error('Im neuesten GitHub-Release wurde keine APK gefunden.');
    if(isNewerVersion(versionName,installedAppVersion.versionName)){
      availableUpdate={versionName,downloadUrl:apk.browser_download_url,notes:rel.body||'',publishedAt:rel.published_at||''};
      renderUpdateUi(); if(silent)toast(`Update ${versionName} verfügbar.`);
    }else{
      availableUpdate=null;renderUpdateUi();
      if(status)status.textContent=`Du verwendest bereits die aktuelle Version ${installedAppVersion.versionName}.`;
      if(!silent)toast('Kein Update verfügbar.');
    }
    localStorage.setItem('urp_last_update_check',String(Date.now()));
  }catch(e){
    if(status)status.textContent=`Update-Prüfung nicht möglich: ${e.message}`;
    if(!silent)toast('Update-Prüfung fehlgeschlagen.');
  }finally{
    if(check){check.disabled=false;check.textContent='Nach Updates suchen'}
  }
}
function installAvailableUpdate(){
  if(!availableUpdate)return;
  if(!window.AndroidBridge?.downloadAndInstallApk){toast('APK-Updates sind nur in der Android-App verfügbar.');return}
  try{
    const raw=JSON.stringify(state,null,2);
    const safe=`Backup_v${installedAppVersion.versionName}_vor_Update_${new Date().toISOString().slice(0,10)}.json`;
    const msg=AndroidBridge.exportBackup(raw,safe);
    if(msg)toast(msg);
  }catch(e){toast('Backup vor Update konnte nicht erstellt werden.');return}
  const btn=$('#installUpdateBtn'); if(btn){btn.disabled=true;btn.textContent='Update wird vorbereitet …'}
  $('#updateStatus').textContent='Update wird vorbereitet …';
  AndroidBridge.downloadAndInstallApk(availableUpdate.downloadUrl,`v${availableUpdate.versionName}`);
}
function maybeAutoCheckUpdate(){
  if(!window.AndroidBridge?.getAppVersion)return;
  const last=+(localStorage.getItem('urp_last_update_check')||0);
  if(Date.now()-last>24*60*60*1000)setTimeout(()=>checkForUpdates({silent:true}),1800);
}
window.AppUpdater={
  __status(status,message){
    const el=$('#updateStatus'),btn=$('#installUpdateBtn'); if(el)el.textContent=message||status;
    if(status==='error'||status==='permission_required'){if(btn){btn.disabled=false;btn.textContent=availableUpdate?`Version ${availableUpdate.versionName} installieren`:'Update installieren'}}
    if(status==='installing'&&btn){btn.disabled=true;btn.textContent='Android-Installer wird geöffnet …'}
  }
};

// ------------------------- Events -------------------------
function switchView(name){currentView=name;$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.bottomnav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='map')setTimeout(renderMap,20)}
function locateStop(id){const v=activeVersion();if(!v)return null;for(const d of v.days){const s=d.stops.find(x=>x.id===id);if(s)return{day:d,stop:s}}return null}
function bindEvents(){
  $$('.bottomnav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $('#tripSelect').onchange=e=>{state.activeTripId=e.target.value;ensureActive();discoverVisible.cities=discoverVisible.attractions=discoverVisible.wildlife=5;mapDayVisible.clear();persistSoon();renderAll()};
  $('#versionSelect').onchange=e=>{const t=activeTrip();if(t)t.selectedVersionId=e.target.value;mapDayVisible.clear();persistSoon();renderAll()};
  $('#newTripBtn').onclick=newTripModal; $('#refreshBtn').onclick=refreshAllRoutes; $('#discoverBtn').onclick=discoverAll;$('#reloadCitiesBtn').onclick=loadCities;$('#reloadPoiBtn').onclick=loadAttractions;$('#reloadWildBtn').onclick=loadWildlife;$('#addStopBtn').onclick=()=>addStopModal();$('#addFlightBtn').onclick=()=>flightModal();$('#addAccommodationBtn').onclick=()=>accommodationModal();$('#addTransferBtn').onclick=()=>transferModal();$('#fitMapBtn').onclick=fitMap;$('#mapFilterBtn').onclick=mapFilterModal;
  $('#compareA').onchange=renderCompareResult;$('#compareB').onchange=renderCompareResult;
  $('#saveSettingsBtn').onclick=()=>{state.settings={defaultStart:$('#defaultStart').value||'08:00',defaultEnd:$('#defaultEnd').value||'20:00',arrivalBuffer:+$('#arrivalBuffer').value||0,departureBuffer:+$('#departureBuffer').value||0};persistSoon();toast('Einstellungen gespeichert.')};
  $('#checkUpdateBtn').onclick=()=>checkForUpdates({silent:false}); $('#installUpdateBtn').onclick=installAvailableUpdate;
  $('#exportBtn').onclick=()=>{const t=activeTrip();const name=`Unser_Reiseplaner_${(t?.title||'Backup').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g,'_')}.json`;const raw=JSON.stringify(state,null,2);if(window.AndroidBridge?.exportBackup){const msg=AndroidBridge.exportBackup(raw,name);toast(msg)}else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}};
  $('#importFile').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.trips)throw new Error('Ungültiges Backup');if(confirm('Aktuelle lokale Daten durch dieses Backup ersetzen?')){state=x;state.settings={...defaultSettings(),...(state.settings||{})};persistSoon();renderAll();toast('Backup importiert.')}}catch(err){toast('Backup konnte nicht gelesen werden.')}};r.readAsText(f)};
  $('#modal').addEventListener('click',e=>{if(e.target.dataset.close==='1'||e.target.hasAttribute('data-close-modal'))closeModal()});
  document.addEventListener('click',e=>{
    const d=e.target.dataset;
    if(d.openTrip){state.activeTripId=d.openTrip;persistSoon();renderAll();switchView('plan')}
    if(d.tripMenu){const t=state.trips.find(x=>x.id===d.tripMenu);if(t)tripMenuModal(t)}
    if(d.newVersion){const t=state.trips.find(x=>x.id===d.newVersion);state.activeTripId=t.id;const v=t.versions.find(x=>x.id===t.selectedVersionId)||t.versions[0],n=prompt('Name der neuen Version:',`${v.name} – Variante`);if(n){const c=cloneVersion(v,n);t.versions.push(c);t.selectedVersionId=c.id;persistSoon();renderAll()}}
    if(d.dayToggle){const body=$(`#body_${d.dayToggle}`);if(body)body.classList.toggle('hidden')}
    if(d.dayTime){const day=activeVersion()?.days.find(x=>x.id===d.dayTime);if(day)dayTimeModal(day)}
    if(d.dayAdd)addStopModal(d.dayAdd);
    if(d.dayAccommodation)accommodationModal(d.dayAccommodation);
    if(d.cityTour){const day=activeVersion()?.days.find(x=>x.id===d.cityTour);if(day)cityTour(day)}
    if(d.routeDay){const day=activeVersion()?.days.find(x=>x.id===d.routeDay);if(day)refreshDayRoutes(day)}
    if(d.editStop){const x=locateStop(d.editStop);if(x)(x.stop.accommodation?accommodationDetailsModal(x.day,x.stop,false):editStopModal(x.day,x.stop,false))}
    if(d.deleteStop){const x=locateStop(d.deleteStop);if(x&&confirm(`„${x.stop.name}“ entfernen?`)){x.day.stops=x.day.stops.filter(s=>s.id!==x.stop.id);persistSoon();renderPlanner();if(currentView==='map')renderMap()}}
    if(d.moveStop){const x=locateStop(d.moveStop);if(x){const i=x.day.stops.findIndex(s=>s.id===x.stop.id),j=i+(+d.dir);if(j>=0&&j<x.day.stops.length){[x.day.stops[i],x.day.stops[j]]=[x.day.stops[j],x.day.stops[i]];x.day.stops.forEach(s=>s.routeToNext=null);persistSoon();renderPlanner()}}}
    if(d.editFlight){const f=activeVersion()?.flights.find(x=>x.id===d.editFlight);if(f)flightModal(f)}
    if(d.flightTransfer)transferModal(null,d.flightTransfer);
    if(d.editTransfer){const x=activeVersion()?.transfers?.find(z=>z.id===d.editTransfer);if(x)transferModal(x)}
    if(d.cityInspire){try{cityInspirationModal(JSON.parse(d.cityInspire))}catch(err){}}
    if(d.addCity){try{addCitySuggestion(JSON.parse(d.addCity))}catch(err){}}
    if(d.addSuggestion){try{addSuggestion(JSON.parse(d.addSuggestion))}catch(err){}}
    if(d.targetSpecies){try{chooseTargetSpecies(JSON.parse(d.targetSpecies))}catch(err){}}
    if(d.suggestionsMore)changeSuggestionLimit(d.suggestionsMore,true);
    if(d.suggestionsLess)changeSuggestionLimit(d.suggestionsLess,false);
  });
  $('#versionSelect').addEventListener('contextmenu',e=>{e.preventDefault();const t=activeTrip();if(t)versionModal(t)});
  $('#versionSelect').addEventListener('dblclick',()=>{const t=activeTrip();if(t)versionModal(t)});
}

function boot(){loadState();bindEvents();readInstalledVersion();renderAll();switchView('trips');maybeAutoCheckUpdate();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

})();
