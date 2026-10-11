(() => {
'use strict';
const Planner = window.URPPlanner;
const Discovery = window.URPDiscovery;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const DAY_COLORS = ['#d62828','#1565c0','#2e7d32','#6a1b9a','#ef6c00','#00838f','#ad1457','#5d4037','#7b8f00','#00796b','#4527a0','#c2410c','#2563eb','#111827','#b45309','#0e7490','#7c3aed','#166534','#be123c','#334155'];
const INTERESTS = ['Wildlife','Natur','Landschaft','Städte & Architektur','Fotografie','Geschichte','Museen','Essen','Strand','Wandern','Nachtleben'];
const MODES = {car:'🚗 Auto',camper:'🚐 Camper',rentalcar:'🚗 Mietwagen',rideshare:'🚕 Uber/Rideshare',taxi:'🚕 Taxi',walk:'🚶 Zu Fuß',transit:'🚌 ÖPNV',bus:'🚌 Bus',ferry:'⛴ Fähre',train:'🚆 Zug',flight:'✈ Flug',other:'• Sonstige Verbindung'};
const STOP_ICONS = {sight:'★',wildlife:'🐾',city:'🏙',nature:'🌿',food:'🍴',hotel:'🛏',hike:'🥾',viewpoint:'◉',beach:'🏖',transit:'⇄',other:'•'};
const WISH_PRIORITIES={must:{label:'Muss',weight:4},high:{label:'Hoch',weight:3},normal:{label:'Mittel',weight:2},optional:{label:'Optional',weight:1}};

const UPDATE_REPOSITORY = 'wasserratte96-web/unser-reiseplaner';
const UPDATE_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
let installedAppVersion = {versionName:'1.4.0',versionCode:11,repository:UPDATE_REPOSITORY};
let availableUpdate = null;

let state = null;
let map = null;
let mapReady = false;
let mapStopLayer = null;
let mapRouteLayer = null;
let mapDayVisible = new Set();
let mapVersionId=null;
let saveTimer = null;
let currentView = 'trips';
let modalGeneration=0;
const discoverVisible = {cities:5,attractions:5,wildlife:5};
const verifiedEnrichmentPending=new Set();

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
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);return fetch(url,{headers:{'Accept':'application/json'},signal:controller.signal}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}).finally(()=>clearTimeout(timer));
  },
  __resolve(id,body,error){
    const p=this.pending.get(id); if(!p) return;
    this.pending.delete(id);
    if(error) p.reject(new Error(error)); else p.resolve(body);
  }
};

const jsonRequests=new Map();
let geocodeQueue=Promise.resolve(),nextGeocodeAt=0;

async function apiJson(url) {
  if(jsonRequests.has(url))return jsonRequests.get(url);
  const task=(async()=>{
    let hostname='Datenquelle';try{hostname=new URL(url).hostname;}catch(e){}
    try {
      const text=await NativeHttp.request(url);let data;
      try{data=JSON.parse(text);}catch(e){throw new Error('Ungültige Antwort der Datenquelle.');}
      if(state?.cache){state.cache.sourceStatus=state.cache.sourceStatus||{};state.cache.sourceStatus[hostname]={status:'ok',checkedAt:Date.now()};}
      return data;
    }catch(e){if(state?.cache){state.cache.sourceStatus=state.cache.sourceStatus||{};state.cache.sourceStatus[hostname]={status:'error',checkedAt:Date.now(),message:e.message};}throw e;}
  })();
  jsonRequests.set(url,task);try{return await task;}finally{jsonRequests.delete(url);}
}

function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),2600);
  if(window.AndroidBridge?.toast && msg.length<120){ /* Native toast intentionally not duplicated */ }
}
function fmtDate(iso){ if(!iso) return '–'; const d=new Date(`${iso}T12:00:00`); return d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtShortDate(iso){ if(!iso) return '–'; const d=new Date(`${iso}T12:00:00`); return d.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}); }
function addDays(iso,n){return Planner.addDays(iso,n);}
function daysBetween(a,b){return Planner.dayCount(a,b);}
function timeToMin(t){return Planner.minutes(t);}
function minToTime(m){if(m==null||!Number.isFinite(m))return'–';m=((Math.round(m)%1440)+1440)%1440;return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function durText(min){min=Math.max(0,Math.round(min||0));const h=Math.floor(min/60),m=min%60;return h?`${h} h ${m?m+' min':''}`.trim():`${m} min`}
function kmText(km){return km==null?'–':`${Number(km).toLocaleString('de-DE',{maximumFractionDigits:0})} km`}
function haversine(a,b){const R=6371,rad=x=>x*Math.PI/180;const dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng);const q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function normalizeName(x){return String(x||'').trim().toLowerCase();}

function defaultSettings(){return {defaultStart:'08:00',defaultEnd:'20:00',arrivalBuffer:60,departureBuffer:120};}
function emptyState(){return {schema:7,activeTripId:null,settings:defaultSettings(),trips:[],cache:{places:{},cities:{},wikidata:{},wildlife:{},photos:{}}};}

function sampleTrip(){
  const start='2027-04-10';
  const trip={id:uid('trip'),title:'Australien 2027',destination:'Australien',country:'Australien',wishlist:[],interests:['Wildlife','Natur','Landschaft','Städte & Architektur','Fotografie'],dateWindows:[{id:uid('win'),start:'2027-04-03',end:'2027-04-17'},{id:uid('win'),start:'2027-04-10',end:'2027-04-24'}],selectedVersionId:null,versions:[]};
  const v={id:uid('ver'),name:'Nordroute – Ausgangsplanung',startDate:start,endDate:addDays(start,13),days:[],flights:[],connections:[],transfers:[],createdAt:Date.now()};
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
  state=normalizeLoadedState(state);
}
function normalizeLoadedState(candidate) {
  if(!candidate||!Array.isArray(candidate.trips))throw new Error('Ungültiges Backup: Reisen fehlen.');
  const state=JSON.parse(JSON.stringify(candidate));
  for(const trip of state.trips){
    if(!Array.isArray(trip.versions))throw new Error('Ungültiges Backup: Versionen fehlen.');
    for(const version of trip.versions){
      if(!Array.isArray(version.days)||version.days.some(day=>!Array.isArray(day.stops)))throw new Error('Ungültiges Backup: Tagesplan fehlt.');
      version.flights=version.flights||[];version.connections=version.connections||[];version.transfers=version.transfers||[];
    }
  }
  const oldSchema=+state.schema||0;
  state.settings={...defaultSettings(),...(state.settings||{})}; state.cache=state.cache||{};state.cache.places=state.cache.places||{};state.cache.cities=state.cache.cities||{};state.cache.wikidata=state.cache.wikidata||{};state.cache.wildlife=state.cache.wildlife||{};state.cache.photos=state.cache.photos||{};
  if(oldSchema<4){
    state.cache.photos={};
    for(const k of Object.keys(state.cache.cities))if(!k.startsWith('cities:v6:'))delete state.cache.cities[k];
    for(const k of Object.keys(state.cache.wikidata))if(k.startsWith('attr:v3:')||k.startsWith('place:'))delete state.cache.wikidata[k];
  }
  for(const t of state.trips||[]){t.wishlist=t.wishlist||[];if(oldSchema<5&&Array.isArray(t.targetSpecies)){for(const sp of t.targetSpecies){const key=`wildlife:${sp.taxonId||normalizeName(sp.name)}`;if(!t.wishlist.some(x=>x.key===key))t.wishlist.push({key,kind:'wildlife',priority:'high',name:sp.name||sp.scientific||'Wildlife',lat:null,lng:null,item:{...sp},selectedAt:Date.now()});}}for(const v of t.versions||[]){v.transfers=v.transfers||[];v.connections=v.connections||[];for(const tr of v.transfers){if(!tr.sourceRef&&tr.flightId)tr.sourceRef=`flight:${tr.flightId}`;}}}
  if(oldSchema<6) {
    // Repair only the known 1.2.0 automatic null-to-zero conversion.
    for(const t of state.trips) {
      for(const x of t.wishlist||[])if(x.kind==='wildlife'&&!Planner.hasLocation(x.item?.hotspot)&&!Planner.hasLocation(x.item)){x.lat=null;x.lng=null;}
      for(const v of t.versions||[])for(const day of v.days||[])for(const stop of day.stops||[]) {
        if(v.routeMeta?.source==='wishlist'&&stop.type==='wildlife'&&stop.lat===0&&stop.lng===0){stop.lat=null;stop.lng=null;stop.openIssues=[...(stop.openIssues||[]),'Standort aus Version 1.2.0 erneut prüfen'];}
      }
    }
    state.cache.wildlife={};
  }
  for(const trip of state.trips) {
    trip.countries=Discovery.countriesForTrip(trip);
    for(const wish of trip.wishlist||[]) {
      wish.countryCode=wish.countryCode||wish.item?.countryCode||'';
      wish.country=wish.country||wish.item?.country||'';
    }
  }
  state.schema=7;
  return state;
}

function persistSoon(){
  $('#syncState').textContent='speichert …'; clearTimeout(saveTimer); saveTimer=setTimeout(()=>{
    try{const raw=JSON.stringify(state); if(window.AndroidBridge?.saveState){if(AndroidBridge.saveState(raw)===false)throw new Error('Speichern fehlgeschlagen');}else localStorage.setItem('urp_state',raw); $('#syncState').textContent='lokal gespeichert';}catch(e){$('#syncState').textContent='Speicherfehler';}
  },250);
}
function activeTrip(){return state.trips.find(t=>t.id===state.activeTripId)||state.trips[0]||null}
function activeVersion(){const t=activeTrip(); return t?.versions.find(v=>v.id===t.selectedVersionId)||t?.versions[0]||null}
function ensureActive(){if(!activeTrip()&&state.trips.length)state.activeTripId=state.trips[0].id;const t=activeTrip();if(t&&!t.selectedVersionId&&t.versions[0])t.selectedVersionId=t.versions[0].id;}

function cloneVersion(v,newName){const c=JSON.parse(JSON.stringify(v));c.id=uid('ver');c.name=newName||`${v.name} – Kopie`;c.createdAt=Date.now();const stopMap=new Map(),flightMap=new Map(),connectionMap=new Map();c.days.forEach(d=>{d.id=uid('day');d.stops.forEach(s=>{const old=s.id;s.id=uid('stop');stopMap.set(old,s.id)});});(c.flights||[]).forEach(f=>{const old=f.id;f.id=uid('flight');flightMap.set(old,f.id)});(c.connections||[]).forEach(x=>{const old=x.id;x.id=uid('conn');connectionMap.set(old,x.id)});c.transfers=(c.transfers||[]).map(x=>({...x,id:uid('transfer'),flightId:flightMap.get(x.flightId)||x.flightId,sourceRef:(x.sourceRef|| (x.flightId?`flight:${x.flightId}`:'' )).replace(/^flight:(.+)$/,(m,id)=>`flight:${flightMap.get(id)||id}`).replace(/^connection:(.+)$/,(m,id)=>`connection:${connectionMap.get(id)||id}`),toStopId:stopMap.get(x.toStopId)||x.toStopId}));return c}

let modalReturnFocus=null;
function showModal(html,onReady){modalReturnFocus=document.activeElement;const generation=++modalGeneration;$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden');if(onReady)setTimeout(()=>{if(generation===modalGeneration){onReady();$('#modalContent input, #modalContent button')?.focus?.();}},0);}
function closeModal(){modalGeneration++;$('#modal').classList.add('hidden');$('#modalContent').innerHTML='';modalReturnFocus?.focus?.();}

// ------------------------- Free data providers -------------------------
const OVERPASS_ENDPOINTS=[
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const MATCH_STOPWORDS=new Set(['the','and','und','der','die','das','of','von','in','at','a','an','museum','museums','park','centre','center','building','house','memorial','gallery','national','royal','city','stadt','station']);
function matchNormalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function matchTokens(s){const all=matchNormalize(s).split(/\s+/).filter(x=>x.length>1),sig=all.filter(x=>!MATCH_STOPWORDS.has(x));return sig.length?sig:all}
function nameMatchScore(name,text){const n=matchNormalize(name),t=matchNormalize(text);if(!n||!t)return 0;if(t.includes(n))return 1;const toks=matchTokens(name);if(!toks.length)return 0;const hits=toks.filter(x=>t.includes(x)).length;return hits/toks.length}
function parseWikiRef(value){
  const v=String(value||'').trim();if(!v)return null;
  try{if(/^https?:\/\//i.test(v)){const u=new URL(v),m=u.hostname.match(/^([a-z-]+)\.wikipedia\.org$/i);if(m)return{lang:m[1],title:decodeURIComponent(u.pathname.replace(/^\/wiki\//,'').replace(/_/g,' '))};}}catch(e){}
  const m=v.match(/^([a-z-]+):(.+)$/i);return m?{lang:m[1].toLowerCase(),title:m[2].replace(/_/g,' ')}:null;
}
function inBBox(lat,lng,bbox,margin=.15){if(!bbox||bbox.length!==4)return true;const[s,n,w,e]=bbox,dy=(n-s)*margin,dx=(e-w)*margin;return lat>=s-dy&&lat<=n+dy&&lng>=w-dx&&lng<=e+dx}
function cleanWikiFileTitle(s){return String(s||'').replace(/^File:/i,'')}
function isUsefulPhotoTitle(s){return !/(?:logo|icon|pictogram|locator|location map|route map|map of|flag of|coat of arms|crest|seal|wordmark|wikidata|commons-logo|symbol|diagram|floor plan|site plan|\.svg$)/i.test(String(s||''))}


function publicWildObservation(observation) {
  const point={lat:observation.geojson?.coordinates?.[1],lng:observation.geojson?.coordinates?.[0]};
  return Planner.hasLocation(point)&&!observation.captive&&!observation.captive_cultivated&&!observation.obscured&&!['obscured','private'].includes(observation.geoprivacy)&&!['obscured','private'].includes(observation.taxon_geoprivacy)&&(!observation.positional_accuracy||observation.positional_accuracy<=1000);
}
const Providers={
  async geocode(q,limit=8,options={}) {
    const countryCodes=Discovery.validCountryCodes(options.countryCodes||[]).join(',');
    const endpoint=Discovery.searchEndpoint(state.settings.geocodeEndpoint);
    const key=`geo:v4:${endpoint}:${normalizeName(q)}:${limit}:${countryCodes}`;if(state.cache.places[key])return state.cache.places[key];
    const run=geocodeQueue.then(async()=>{
      if(state.cache.places[key])return state.cache.places[key];
      const delay=Math.max(0,nextGeocodeAt-Date.now());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      nextGeocodeAt=Date.now()+1100;
      const url=`${endpoint}?format=jsonv2&addressdetails=1&extratags=1&namedetails=1&accept-language=de,en&limit=${limit}&q=${encodeURIComponent(q)}${countryCodes?'&countrycodes='+countryCodes:''}`;
      const data=await apiJson(url);if(!Array.isArray(data))throw new Error('Ungültige Ortssuche.');
      const result=data.map(x=>({name:x.namedetails?.name||x.display_name?.split(',')[0]||'',names:x.namedetails||{},display:x.display_name||'',lat:Planner.coordinate(x.lat,90),lng:Planner.coordinate(x.lon,180),type:x.type,category:x.category,addressType:x.addresstype,address:x.address||{},extratags:x.extratags||{},osmId:x.osm_id,osmType:x.osm_type,bbox:x.boundingbox?.map(Number),countryCode:String(x.address?.country_code||'').toUpperCase(),country:x.address?.country||'',sourceId:`${x.osm_type}/${x.osm_id}`,wikiTag:x.extratags?.wikipedia||'',wikidata:x.extratags?.wikidata||'',source:'Nominatim',retrievedAt:Date.now()})).filter(Planner.hasLocation).filter(x=>!countryCodes||countryCodes.split(',').includes(x.countryCode.toLowerCase()));
      state.cache.places[key]=result;persistSoon();return result;
    });
    geocodeQueue=run.catch(()=>{});return run;
  },
  async overpassJson(query){
    const errors=[];
    for(const endpoint of OVERPASS_ENDPOINTS){
      try{return await apiJson(`${endpoint}?data=${encodeURIComponent(query)}`)}catch(e){errors.push(e.message)}
    }
    throw new Error(`OpenStreetMap/Overpass ist vorübergehend nicht erreichbar. ${errors.slice(-1)[0]||''}`.trim());
  },
  async cities(destination) {
    const key=`cities:v6:${normalizeName(destination)}`,cached=state.cache.cities[key];if(cached?.length)return cached;
    const [g]=await this.geocode(destination,3);
    const area=g?.osmType==='relation'?3600000000+Number(g.osmId):g?.osmType==='way'?2400000000+Number(g.osmId):null;
    if(!area)throw new Error('Für das Reiseziel wurde keine eindeutige Gebietsgrenze gefunden.');
    const query=`[out:json][timeout:20];area(${area})->.region;nwr(area.region)[place=city][name];out tags center 160;`;
    const j=await this.overpassJson(query),unique=new Map();
    for(const e of j.elements||[]) {
      const tags=e.tags||{},lat=Planner.coordinate(e.lat??e.center?.lat,90),lng=Planner.coordinate(e.lon??e.center?.lon,180),name=tags['name:de']||tags.name;
      if(!name||lat===null||lng===null)continue;
      const item={name,lat,lng,population:+String(tags.population||'0').replace(/[^0-9]/g,''),capital:tags.capital||'',country:destination,wikiTag:tags.wikipedia||'',wikidata:tags.wikidata||'',photo:'',summary:'',tags,source:'OpenStreetMap',sourceId:`${e.type}/${e.id}`,retrievedAt:Date.now()};
      const id=item.wikidata||`${name}:${lat.toFixed(3)}:${lng.toFixed(3)}`;if(!unique.has(id))unique.set(id,item);
    }
    const result=[...unique.values()].sort((a,b)=>b.population-a.population).slice(0,30);
    if(!result.length)throw new Error('Keine Städte innerhalb der gewählten Gebietsgrenze gefunden.');
    state.cache.cities[key]=result;persistSoon();return result;
  },
  async countryQid(country){
    const k=`qid:${normalizeName(country)}`;if(state.cache.wikidata[k])return state.cache.wikidata[k];
    const u=`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(country)}&language=de&uselang=de&type=item&limit=8&format=json&origin=*`;
    const j=await apiJson(u); const item=(j.search||[]).find(x=>/Land|country|Staat/i.test(`${x.description||''}`))||(j.search||[])[0];
    const q=item?.id||'';state.cache.wikidata[k]=q;persistSoon();return q;
  },
  async attractions(destination) {
    const key=`attr:v6:${normalizeName(destination)}`,cached=state.cache.wikidata[key];if(cached?.length)return cached;
    const [region]=await this.geocode(destination,3),countryId=region?.extratags?.wikidata;
    if(!/^Q\d+$/.test(countryId||''))throw new Error('Das Reiseland konnte nicht eindeutig einer Wissensdaten-ID zugeordnet werden.');
    const candidates=new Map(),highlight=/(nationalpark|national park|natur|natural|landschaft|landscape|riff|reef|insel|island|berg|mountain|fels|rock|schlucht|canyon|gorge|wasserfall|waterfall|höhle|cave|küste|coast|strand|beach|wüste|desert|see\b|lake|forest|wald|welterbe|world heritage|wahrzeichen|landmark|denkmal|monument|museum|bauwerk|gebäude|kirche|kathedrale|tempel|schloss|burg|brücke|straße|garten|historic|sehenswürdigkeit)/i;
    const searches=[['Wahrzeichen',34],['UNESCO Welterbe',38],['Nationalpark',34],['Naturwunder',32],['Sehenswürdigkeit',24],['Denkmal',22],['historische Stätte',22]];
    let lastError=null;
    for(const [topic,weight] of searches) {
      const lang='de',query=destination+' '+topic;
      const url=`https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=30&prop=coordinates|pageimages|info|categories|extracts|pageprops&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=600&inprop=url&cllimit=max&exintro=1&explaintext=1&exchars=420&format=json&formatversion=2&origin=*`;
      let j;try{j=await apiJson(url);}catch(e){lastError=e;continue;}
      let rank=0;
      for(const page of j.query?.pages||[]) {
        rank++;
        const coordinate=page.coordinates?.[0],qid=page.pageprops?.wikibase_item,name=page.title||'',cats=(page.categories||[]).map(x=>x.title||'').join(' '),summary=page.extract||'';
        if(!/^Q\d+$/.test(qid||'')||!Planner.hasLocation({lat:coordinate?.lat,lng:coordinate?.lon})||!highlight.test(name+' '+cats+' '+summary))continue;
        if(/^(Liste|Geographie|Geschichte|Tourismus|Verwaltungsgliederung|Demografie|Politik)\b/i.test(name)||/(?:Kategorie:)(?:Stadt|Gemeinde|Ort|Großstadt|Millionenstadt|Kleinstadt|Hauptstadt|Vorort|Stadtteil|Stadtbezirk|Siedlung|Bundesstaat|Provinz|Territorium|Verwaltungseinheit|Staat|County|District)\b/i.test(cats)||/\bist (?:eine?|die) (?:Stadt|Gemeinde|Hauptstadt|Bundesstaat|Provinz|Territorium)\b/i.test(summary))continue;
        if(!inBBox(+coordinate.lat,+coordinate.lon,region.bbox,0))continue;
        const text=name+' '+cats+' '+summary,score=weight+Math.max(0,30-rank)+(/welterbe|world heritage/i.test(text)?30:0)+(/nationalpark|national park/i.test(text)?25:0)+(/wahrzeichen|landmark|naturwunder|naturdenkmal/i.test(text)?20:0);
        if(candidates.has(qid)&&candidates.get(qid).score>=score)continue;
        candidates.set(qid,{name,lat:+coordinate.lat,lng:+coordinate.lon,wikidata:qid,wiki:page.fullurl||'',photo:page.thumbnail?.source||'',photoVerified:true,score,highlightType:topic,summary:summary.slice(0,260),source:'Wikipedia / Wikidata',retrievedAt:Date.now()});
      }
    }
    const entries=[...candidates.values()],result=[];
    for(let i=0;i<entries.length;i+=40) {
      const chunk=entries.slice(i,i+40);let j;
      try{j=await apiJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(chunk.map(x=>x.wikidata).join('|'))}&props=claims&format=json&origin=*`);}catch(e){lastError=e;continue;}
      for(const item of chunk) {
        const countries=(j.entities?.[item.wikidata]?.claims?.P17||[]).map(x=>x.mainsnak?.datavalue?.value?.id);
        if(countries.includes(countryId))result.push(item);
      }
    }
    result.sort((a,b)=>b.score-a.score);if(!result.length)throw new Error(`Keine eindeutig dem Reiseland zugeordneten nationalen Highlights gefunden.${lastError?' '+lastError.message:''}`);
    state.cache.wikidata[key]=result.slice(0,40);persistSoon();return state.cache.wikidata[key];
  },
  async iNatPlace(destination) {
    const key=`inatplace:v2:${normalizeName(destination)}`,cached=state.cache.places[key];if(cached)return cached;
    const [geo]=await this.geocode(destination,3);if(!geo)return null;
    const aliases=[destination,geo.name,geo.names?.['name:en'],geo.names?.['name:de'],geo.names?.name].filter(Boolean).map(matchNormalize);
    const name=geo.names?.['name:en']||geo.name||destination;
    const j=await apiJson(`https://api.inaturalist.org/v1/places/autocomplete?q=${encodeURIComponent(name)}&per_page=20`);
    const candidates=(j.results||[]).filter(x=>aliases.includes(matchNormalize(x.name))||aliases.includes(matchNormalize(x.display_name)));
    const item=geo.addressType==='country'?candidates.find(x=>x.place_type===12):candidates.length===1?candidates[0]:null;
    if(item){state.cache.places[key]=item;persistSoon();}return item||null;
  },
  async wildlife(destination,month) {
    const key=`wild:v3:${normalizeName(destination)}:${month||0}`,cached=state.cache.wildlife[key];if(cached?.length)return cached;
    const place=await this.iNatPlace(destination);if(!place)throw new Error('Das Reiseland konnte bei iNaturalist nicht eindeutig zugeordnet werden.');
    let url=`https://api.inaturalist.org/v1/observations/species_counts?place_id=${place.id}&taxon_id=40151&captive=false&quality_grade=research&per_page=50&locale=de`;
    if(month)url+=`&month=${month}`;
    const j=await apiJson(url),result=(j.results||[]).filter(x=>x.taxon?.id).map(x=>({taxonId:x.taxon.id,name:x.taxon.preferred_common_name||x.taxon.english_common_name||x.taxon.name,scientific:x.taxon.name||'',count:x.count||0,photo:x.taxon.default_photo?.medium_url||x.taxon.default_photo?.square_url||'',photoAttribution:x.taxon.default_photo?.attribution||'',photoLicense:x.taxon.default_photo?.license_code||'',photoVerified:true,iconic:x.taxon.iconic_taxon_name||'',source:'iNaturalist',placeId:place.id,retrievedAt:Date.now()}));
    if(!result.length)throw new Error('Keine passenden wildlebenden Säugetiere im Reiseland und Reisemonat gefunden.');
    state.cache.wildlife[key]=result;persistSoon();return result;
  },
  async wildlifeObservations(taxonId,lat,lng,radius=80,month=0) {
    let url=`https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&lat=${lat}&lng=${lng}&radius=${radius}&quality_grade=research&captive=false&geo=true&geoprivacy=open&taxon_geoprivacy=open&per_page=100&order=desc&order_by=observed_on`;
    if(month)url+=`&month=${month}`;const j=await apiJson(url);return (j.results||[]).filter(publicWildObservation);
  },
  async wildlifeBestHotspot(taxonId,destination,month=0) {
    const key=`wildhot:v2:${taxonId}:${normalizeName(destination)}:${month}`,cached=state.cache.wildlife[key];if(cached&&Date.now()-cached.retrievedAt<86400000)return cached;
    const place=await this.iNatPlace(destination);if(!place)throw new Error('Kein eindeutiges iNaturalist-Gebiet gefunden.');
    let url=`https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&place_id=${place.id}&quality_grade=research&captive=false&geo=true&geoprivacy=open&taxon_geoprivacy=open&per_page=200&order=desc&order_by=observed_on`;
    if(month)url+=`&month=${month}`;
    const j=await apiJson(url),pts=(j.results||[]).filter(publicWildObservation).map(o=>({lat:o.geojson.coordinates[1],lng:o.geojson.coordinates[0],place:o.place_guess||'',date:o.observed_on||'',observationId:o.id}));
    if(!pts.length)return null;
    const best=clusterPoints(pts,30)[0];
    // Use an actual public observation, not an average that could land offshore.
    const anchor=[...best.points].sort((a,b)=>haversine(a,best)-haversine(b,best))[0];
    const out={lat:anchor.lat,lng:anchor.lng,count:best.points.length,place:anchor.place,sampleDate:anchor.date,sourceUrl:`https://www.inaturalist.org/observations/${anchor.observationId}`,placeId:place.id,retrievedAt:Date.now()};
    state.cache.wildlife[key]=out;persistSoon();return out;
  },
  async wildlifeTaxonPhotos(item,destination,month=0) {
    const key=`inatphoto:v3:${item.taxonId}:${normalizeName(destination)}:${month}`,cached=state.cache.photos[key];if(cached?.length)return cached;
    const result=[],add=(url,attribution='',license='',page='')=>{if(url&&!result.some(p=>p.url===url))result.push({url,full:url,title:item.name,page:page||`https://www.inaturalist.org/taxa/${item.taxonId}`,attribution,license,verified:true});};
    add(item.photo,item.photoAttribution,item.photoLicense);
    try {
      const place=await this.iNatPlace(destination);if(!place)throw new Error('Kein eindeutig zugeordnetes Gebiet');
      let url=`https://api.inaturalist.org/v1/observations?taxon_id=${item.taxonId}&place_id=${place.id}&quality_grade=research&captive=false&has[]=photos&per_page=30&order_by=votes&order=desc`;
      if(month)url+=`&month=${month}`;
      const data=await apiJson(url);
      for(const observation of data.results||[])for(const photo of observation.photos||[]){add((photo.url||'').replace('/square.','/medium.'),photo.attribution||'',photo.license_code||'',`https://www.inaturalist.org/observations/${observation.id}`);if(result.length>=4)break;}
    }catch(e){}
    const output=result.slice(0,4);if(output.length){state.cache.photos[key]=output;persistSoon();}return output;
  },
  async wikiEntity(qid){
    const k=`wd:v2:${qid}`,cached=state.cache.wikidata[k];if(cached)return cached;
    const u=`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks|labels|descriptions&languages=de|en&format=json&origin=*`;const j=await apiJson(u),e=j.entities?.[qid];if(!e)return null;const sl=e.sitelinks||{},ref=sl.dewiki?{lang:'de',title:sl.dewiki.title}:sl.enwiki?{lang:'en',title:sl.enwiki.title}:null,out={ref,label:e.labels?.de?.value||e.labels?.en?.value||'',description:e.descriptions?.de?.value||e.descriptions?.en?.value||''};state.cache.wikidata[k]=out;persistSoon();return out;
  },
  async wikiPageExact(ref){
    if(!ref?.lang||!ref?.title)return null;const key=`wikipage:v2:${ref.lang}:${normalizeName(ref.title)}`,cached=state.cache.wikidata[key];if(cached)return cached;
    const api=`https://${ref.lang}.wikipedia.org/w/api.php`,u=`${api}?action=query&redirects=1&titles=${encodeURIComponent(ref.title)}&prop=coordinates|pageimages|info|extracts|images|pageprops&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=900&inprop=url&exintro=1&explaintext=1&exchars=650&imlimit=40&format=json&formatversion=2&origin=*`;
    const j=await apiJson(u),p=(j.query?.pages||[])[0];if(!p||p.missing)return null;const c=p.coordinates?.[0],out={title:p.title||ref.title,wikidata:p.pageprops?.wikibase_item||'',summary:(p.extract||'').trim(),photo:p.thumbnail?.source||'',wiki:p.fullurl||`https://${ref.lang}.wikipedia.org/wiki/${encodeURIComponent(p.title||ref.title)}`,lat:c?+c.lat:null,lng:c?+c.lon:null,ref:{lang:ref.lang,title:p.title||ref.title},imageTitles:(p.images||[]).map(x=>x.title).filter(Boolean),verified:true,source:'Wikipedia'};state.cache.wikidata[key]=out;persistSoon();return out;
  },
  async nearbyWikiPage(item,kind='poi'){
    if(!Number.isFinite(+item.lat)||!Number.isFinite(+item.lng)||!item.name)return null;const radius=kind==='city'?10000:1500;
    for(const lang of ['de','en']){
      try{const u=`https://${lang}.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${+item.lat}%7C${+item.lng}&ggsradius=${radius}&ggslimit=30&prop=coordinates|pageimages|info|extracts&piprop=thumbnail&pithumbsize=900&inprop=url&exintro=1&explaintext=1&exchars=650&format=json&formatversion=2&origin=*`,j=await apiJson(u);let best=null,bestScore=0;for(const p of j.query?.pages||[]){const c=p.coordinates?.[0];if(!c)continue;const dist=haversine({lat:+item.lat,lng:+item.lng},{lat:+c.lat,lng:+c.lon});if(dist>radius/1000*1.05)continue;const score=nameMatchScore(item.name,p.title||'');if(score>bestScore){bestScore=score;best=p}}if(best&&bestScore>=.78){return await this.wikiPageExact({lang,title:best.title})}}
      catch(e){}
    }return null;
  },
  async verifiedPlaceDetails(item,context='',kind='poi'){
    const name=item?.name||item?.title||'';if(!name)return null;const key=`verifiedplace:v4:${kind}:${normalizeName(name)}:${Number.isFinite(+item.lat)?(+item.lat).toFixed(3):''}:${Number.isFinite(+item.lng)?(+item.lng).toFixed(3):''}`,cached=state.cache.wikidata[key];if(cached)return cached;
    let detail=null,ref=parseWikiRef(item.wiki||item.wikiTag||item.tags?.wikipedia||'');
    if(ref)try{detail=await this.wikiPageExact(ref)}catch(e){}
    if(!detail){const qid=item.wikidata||item.tags?.wikidata||'';if(qid)try{const entity=await this.wikiEntity(qid);if(entity?.ref)detail=await this.wikiPageExact(entity.ref)}catch(e){}}
    if(!detail)detail=await this.nearbyWikiPage(item,kind);
    if(detail&&(!Planner.hasLocation(detail)||!Planner.hasLocation(item)||(nameMatchScore(name,detail.title)<.72&&!(item.wikidata&&item.wikidata===detail.wikidata))))detail=null;
    if(detail&&Planner.hasLocation(item)&&Planner.hasLocation(detail)){
      const maxKm=kind==='city'?35:3;if(haversine({lat:+item.lat,lng:+item.lng},{lat:+detail.lat,lng:+detail.lng})>maxKm)detail=null;
    }
    if(!detail){const osmSummary=item.summary||item.tags?.['description:de']||item.tags?.description||'';detail={title:name,summary:osmSummary,photo:'',wiki:'',lat:Planner.coordinate(item.lat,90),lng:Planner.coordinate(item.lng,180),ref:null,imageTitles:[],verified:false,source:'OpenStreetMap'};return detail;}
    state.cache.wikidata[key]=detail;persistSoon();return detail;
  },
  async wikiImageUrls(detail){
    if(!detail?.ref)return[];const titles=(detail.imageTitles||[]).filter(isUsefulPhotoTitle).slice(0,24),out=[];const add=(url,title,page)=>{if(!url||out.some(x=>x.url===url))return;out.push({url,full:url,title:cleanWikiFileTitle(title),page,verified:true})};if(detail.photo)add(detail.photo,detail.title,detail.wiki);
    if(titles.length){try{const api=`https://${detail.ref.lang}.wikipedia.org/w/api.php`,u=`${api}?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1000&format=json&formatversion=2&origin=*`,j=await apiJson(u);for(const p of j.query?.pages||[]){const i=p.imageinfo?.[0];if(!i||!/image\/(?:jpeg|png|webp)/i.test(i.mime||'')||!isUsefulPhotoTitle(p.title)||nameMatchScore(detail.title,p.title)<.72)continue;add(i.thumburl||i.url,p.title,i.descriptionurl||'');if(out.length>=4)break}}catch(e){}}
    return out.slice(0,4);
  },
  async verifiedCommonsPhotos(name,context=''){
    const k=`verifiedphoto:v4:${normalizeName(name)}:${normalizeName(context)}`,cached=state.cache.photos[k];if(Array.isArray(cached))return cached;
    const queries=[`intitle:"${String(name).replace(/"/g,'')}"`,`"${String(name).replace(/"/g,'')}" ${context||''}`.trim()],found=new Map();let anySuccess=false;
    for(const search of queries){
      if(found.size>=4)break;
      try{
        const u=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(search)}&gsrnamespace=6&gsrlimit=40&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1000&format=json&formatversion=2&origin=*`,j=await apiJson(u);anySuccess=true;
        for(const p of j.query?.pages||[]){
          const i=p.imageinfo?.[0];if(!i||!/image\/(?:jpeg|png|webp)/i.test(i.mime||'')||!isUsefulPhotoTitle(p.title))continue;
          const md=i.extmetadata||{},blob=[p.title,md.ObjectName?.value,md.ImageDescription?.value,md.Categories?.value,md.DepictedPeople?.value,md.Location?.value].join(' ').replace(/<[^>]+>/g,' '),score=nameMatchScore(name,blob),contextScore=context?nameMatchScore(context,blob):0;
          if(score<.72||(context&&contextScore<.5))continue;
          const url=i.thumburl||i.url;if(!url)continue;
          const candidate={url,full:i.url,title:cleanWikiFileTitle(p.title),page:i.descriptionurl||`https://commons.wikimedia.org/?curid=${p.pageid}`,verified:true,score:score+Math.min(.15,contextScore*.15)};
          const old=found.get(url);if(!old||candidate.score>old.score)found.set(url,candidate);
        }
      }catch(e){}
    }
    const out=[...found.values()].sort((a,b)=>b.score-a.score).slice(0,4);if(anySuccess){state.cache.photos[k]=out;persistSoon()}return out;
  },
  async verifiedPhotosForItem(item,context='',kind='poi',detail=null){
    if(kind==='wildlife'){const month=activeVersion()?.startDate?new Date(`${activeVersion().startDate}T12:00:00`).getMonth()+1:0;return this.wildlifeTaxonPhotos(item,item.country||context||Discovery.countriesForTrip(activeTrip())[0]?.name||'',month)}
    const d=detail||await this.verifiedPlaceDetails(item,context,kind),out=[];const add=x=>{if(!x?.url||out.some(y=>y.url===x.url))return;out.push(x)};
    if((item.photoVerified||item.source==='Wikipedia')&&item.photo)add({url:item.photo,full:item.photo,title:item.name,page:item.wiki||'',verified:true});
    for(const x of await this.wikiImageUrls(d))add(x);
    if(out.length<3)for(const x of await this.verifiedCommonsPhotos(item.name||item.title,context))add(x);
    return out.slice(0,4);
  },
  async openingHours(lat,lng){const q=`[out:json][timeout:10];nwr(around:80,${lat},${lng})[opening_hours];out tags center 8;`;const j=await this.overpassJson(q),el=(j.elements||[])[0];return el?.tags?.opening_hours||'';},
  async route(a,b,mode='car') {
    if(!Planner.hasLocation(a)||!Planner.hasLocation(b))throw new Error('Gültige Start- und Zielkoordinaten fehlen.');
    const direct=haversine(a,b),line=[[+a.lat,+a.lng],[+b.lat,+b.lng]];
    if(mode==='flight')return {distanceKm:direct,durationMin:0,geometry:line,approx:true,source:'Luftlinie'};
    if(['walk','transit','train','bus','ferry'].includes(mode)){const km=direct*(mode==='walk'?1.25:1.1),speed={walk:4.5,transit:25,train:80,bus:60,ferry:30}[mode];return {distanceKm:km,durationMin:km/speed*60,geometry:line,approx:true,source:'Entfernungsschätzung; kein Fahrplan'};}
    if(direct<.03)return {distanceKm:0,durationMin:0,geometry:line,approx:false,source:'Identischer Standort'};
    const url=`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    try {
      const j=await apiJson(url),r=j.routes?.[0];
      if(j.code==='NoRoute'||j.code==='NoSegment')return {distanceKm:direct,durationMin:0,geometry:[],approx:true,unreachable:true,source:'OSRM: keine Straßenverbindung'};
      if(!r||!Number.isFinite(r.duration)||!Number.isFinite(r.distance)||!Array.isArray(r.geometry?.coordinates)||r.duration<0||r.distance<0)throw new Error('Ungültige Straßenroute');
      return {distanceKm:r.distance/1000,durationMin:r.duration/60,geometry:r.geometry.coordinates.map(c=>[c[1],c[0]]),approx:false,source:'OSRM',retrievedAt:Date.now()};
    }catch(e){return {distanceKm:direct*1.25,durationMin:direct*1.25/65*60,geometry:line,approx:true,source:'Luftlinien-Schätzung; Straßendaten nicht erreichbar'};}
  },
  async cityPois(lat,lng,radius=4500){
    const q=`[out:json][timeout:13];(nwr(around:${radius},${lat},${lng})[tourism~"attraction|museum|viewpoint"][name];nwr(around:${radius},${lat},${lng})[historic][name];nwr(around:${radius},${lat},${lng})[leisure="park"][name];);out tags center 90;`,j=await this.overpassJson(q),arr=[];
    for(const e of j.elements||[]){const t=e.tags||{},la=e.lat??e.center?.lat,lo=e.lon??e.center?.lon;if(!t.name||la==null||lo==null||haversine({lat:+lat,lng:+lng},{lat:+la,lng:+lo})>radius/1000*1.08)continue;let score=0;if(t.wikipedia)score+=50;if(t.wikidata)score+=35;if(t.tourism==='attraction')score+=18;if(t.tourism==='museum')score+=16;if(t.historic)score+=10;if(t.website)score+=4;const distanceKm=haversine({lat:+lat,lng:+lng},{lat:+la,lng:+lo});arr.push({name:t['name:de']||t.name,lat:+la,lng:+lo,distanceKm,type:t.tourism==='museum'?'sight':t.leisure==='park'?'nature':t.tourism==='viewpoint'?'viewpoint':'sight',openingHours:t.opening_hours||'',score,wikiTag:t.wikipedia||'',wikidata:t.wikidata||'',website:t.website||'',summary:t['description:de']||t.description||'',photo:'',photoVerified:false,tags:t});}
    const uniq=new Map();arr.sort((a,b)=>b.score-a.score).forEach(x=>{if(!uniq.has(normalizeName(x.name)))uniq.set(normalizeName(x.name),x)});return [...uniq.values()].slice(0,40);
  },
  async flightRoute(number){const clean=String(number||'').replace(/\s+/g,'').toUpperCase();if(!clean)throw new Error('Flugnummer fehlt.');const u=`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(clean)}`;const j=await apiJson(u);return j.response?.flightroute||j.response||null;}
};

// ------------------------- Search and international trips -------------------------
let discoveryCountryCode='',discoverySearch={query:'',kind:'all',scope:'trip',items:[],error:'',searched:false,busy:false},searchGeneration=0;
let discoveryFilter='all';
function discoveryCountry(){const c=Discovery.countriesForTrip(activeTrip());return c.find(x=>(x.code||x.name)===discoveryCountryCode)||c[0]||null;}
function resetDiscoverySearch(){searchGeneration++;discoveryCountryCode='';discoverySearch={query:'',kind:'all',scope:'trip',items:[],error:'',searched:false,busy:false};if($('#poiQuery'))$('#poiQuery').value='';}
function countryLabel(trip=activeTrip()){return Discovery.countriesForTrip(trip).map(c=>c.name).join(' · ');}
function renderDiscoveryControls(){
  const trip=activeTrip(),countries=Discovery.countriesForTrip(trip),chosen=discoveryCountry();
  const picker=$('#discoverCountry');if(picker){picker.innerHTML=countries.map(c=>`<option value="${esc(c.code||c.name)}" ${(c.code||c.name)===(chosen?.code||chosen?.name)?'selected':''}>${esc(c.name)}</option>`).join('')||'<option>Länder hinzufügen</option>';}
  const scope=$('#poiScope');if(scope){scope.innerHTML='<option value="trip">Alle Reiseländer</option>'+countries.filter(c=>c.code).map(c=>`<option value="${c.code}">${esc(c.name)}</option>`).join('')+'<option value="world">Weltweit</option>';if([...scope.options||[]].some(x=>x.value===discoverySearch.scope))scope.value=discoverySearch.scope;}
  $('#discoverTripCountries').textContent=countryLabel()||'Lege zuerst eine Reise an.';
  $('#discoverSelectionCount').textContent=`${trip?.wishlist?.length||0} Wünsche`;
  const submit=$('#poiSearchBtn');if(submit)submit.disabled=!trip||discoverySearch.busy;
  const custom=$('#customPoiBtn');if(custom)custom.disabled=!trip;
  for(const node of $$('[data-discover-panel]'))node.hidden=discoveryFilter!=='all'&&node.dataset.discoverPanel!==discoveryFilter;
  for(const button of $$('[data-discover-filter]')){const selected=button.dataset.discoverFilter===discoveryFilter;button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));}
}
Providers.searchTaxa=async function(query){
  const key=`taxa:v1:${normalizeName(query)}`,cached=state.cache.wildlife[key];if(cached)return cached;
  const data=await apiJson(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&taxon_id=1&is_active=true&per_page=20&locale=de`);
  const animals=new Set(['Mammalia','Aves','Reptilia','Amphibia','Actinopterygii','Insecta','Arachnida','Mollusca','Animalia']);
  const result=(data.results||[]).filter(t=>t.id&&t.is_active!==false&&(animals.has(t.iconic_taxon_name)||(t.ancestor_ids||[]).includes(1))).map(t=>({kind:'wildlife',taxonId:t.id,name:t.preferred_common_name||t.name,scientific:t.name,rank:t.rank,lat:null,lng:null,photo:t.default_photo?.medium_url||t.default_photo?.square_url||'',photoAttribution:t.default_photo?.attribution||'',photoLicense:t.default_photo?.license_code||'',source:'iNaturalist',sourceUrl:`https://www.inaturalist.org/taxa/${t.id}`,retrievedAt:Date.now()}));
  state.cache.wildlife[key]=result;persistSoon();return result;
};
async function searchPoints(query,{kind='all',scope='trip',trip=activeTrip()}={}){
  const q=String(query||'').trim();if(q.length<2)throw new Error('Bitte mindestens zwei Zeichen eingeben.');
  const countries=Discovery.countriesForTrip(trip),countryCodes=scope==='world'?[]:scope==='trip'?countries.map(c=>c.code).filter(Boolean):[scope];
  const jobs=[];
  if(kind!=='wildlife')jobs.push(Providers.geocode(q,16,{countryCodes}).then(items=>items.map(x=>({...x,kind:Discovery.pointKind(x),photo:'',sourceUrl:x.osmId?`https://www.openstreetmap.org/${x.osmType}/${x.osmId}`:''})).filter(x=>kind!=='city'||x.kind==='city').filter(x=>kind!=='highlight'||x.kind==='highlight')));
  if(kind==='all'||kind==='wildlife')jobs.push(Providers.searchTaxa(q).then(items=>items.map(x=>({...x,countryCode:scope==='world'||scope==='trip'?'':scope,country:Discovery.country(scope)?.name||''}))));
  const results=await Promise.allSettled(jobs),items=Discovery.dedupeResults(results.filter(x=>x.status==='fulfilled').flatMap(x=>x.value));
  const errors=results.filter(x=>x.status==='rejected').map(x=>x.reason.message);
  return {items,errors};
}
async function submitPoiSearch(){
  const trip=activeTrip();if(!trip){newTripModal();return;}
  const query=$('#poiQuery').value.trim(),kind=$('#poiKind').value,scope=$('#poiScope').value;
  if(query.length<2){toast('Bitte mindestens zwei Zeichen eingeben.');return;}
  const generation=++searchGeneration;discoverySearch={query,kind,scope,items:[],error:'',searched:true,busy:true};renderSearchResults();
  try{const {items,errors}=await searchPoints(query,{kind,scope,trip});if(generation!==searchGeneration||activeTrip()?.id!==trip.id)return;discoverySearch.items=items;discoverySearch.error=errors.length?'Ein Teil der Suche war nicht erreichbar. '+errors.join(' '):'';}
  catch(error){if(generation===searchGeneration)discoverySearch.error=error.message;}
  finally{if(generation===searchGeneration){discoverySearch.busy=false;renderSearchResults();}}
}
function poiImage(item,kind,cls='poi-photo'){
  const photo=Discovery.safeUrl(item.photo);return photo?`<img class="${cls}" src="${esc(photo)}" alt="${esc(item.name)}" loading="lazy" decoding="async">`:`<div class="${cls} photo-placeholder" aria-label="Kein Foto"><span>${wishlistIcon(kind)}</span></div>`;
}
function renderSearchResults(){
  const box=$('#poiSearchResults');if(!box)return;box.hidden=!discoverySearch.searched;
  $('#poiSearchBtn').disabled=discoverySearch.busy||!activeTrip();$('#poiSearchBtn').textContent=discoverySearch.busy?'Sucht …':'Suchen';
  if(!discoverySearch.searched){box.innerHTML='';return;}
  if(discoverySearch.busy){box.innerHTML='<p role="status">Orte und Tierarten werden gesucht …</p>';return;}
  const {items,error}=discoverySearch;
  box.innerHTML=`<div class="sectiontitle"><h2>${items.length} Treffer</h2><button data-clear-search aria-label="Suchergebnisse schließen">×</button></div>${error?`<p class="warnline">${esc(error)}</p>`:''}${items.length?`<div class="search-result-list">${items.map((x,i)=>{
    const selected=getWishlistEntry(x.kind,x);return `<article class="search-result">${poiImage(x,x.kind,'result-photo')}<div class="result-info"><h3>${esc(x.name)}</h3><p>${esc(x.kind==='wildlife'?x.scientific||'Tierart':x.display||x.country)}</p><small>${esc(x.kind==='wildlife'?'Tierwunsch · Beobachtungsort folgt':wishlistKindLabel(x.kind))}</small></div><button data-search-select="${i}" aria-label="${esc(x.name)} ${selected?'aus Wunschliste entfernen':'zur Wunschliste hinzufügen'}" class="wishcheck ${selected?'on':''}">${selected?'✓':'+'}</button><button data-search-detail="${i}" class="textbtn result-details">Details</button></article>`;}).join('')}</div>`:'<div class="empty"><b>Dein Ziel ist nicht dabei?</b><p>Probiere den Ortsnamen mit Stadt oder Region. Tierarten findest du auch über ihren wissenschaftlichen Namen.</p></div>'}<button data-custom-search class="full-width">+ Eigenen Ort oder Tierwunsch anlegen</button><p class="tiny">Orte: © OpenStreetMap-Mitwirkende. Tierarten: iNaturalist. Ein Artentreffer belegt kein Vorkommen im Reiseland.</p>`;
}
function customWishModal(prefill={}){
  if(!activeTrip()){newTripModal();return;}
  const countries=Discovery.countriesForTrip(activeTrip()),code=prefill.countryCode||discoveryCountry()?.code||'';
  showModal(`<h2>${prefill.customId?'Eigenen Wunsch bearbeiten':'Dein eigener Wunsch'}</h2><p class="lead">Lieblingsort, kleiner Aussichtspunkt oder Tierart: Deine Auswahl ist nicht auf Vorschläge begrenzt.</p><div class="formgrid"><label class="span2">Name<input id="mCustomName" value="${esc(prefill.name||discoverySearch.query||'')}" placeholder="z. B. Aussichtspunkt am See"></label><label>Kategorie<select id="mCustomKind">${[['highlight','Natur & Sehenswürdigkeit'],['city','Stadt oder Ort'],['wildlife','Tier / Wildlife-Ort']].map(([k,l])=>`<option value="${k}" ${k===prefill.kind?'selected':''}>${l}</option>`).join('')}</select></label><label>Land<select id="mCustomCountry"><option value="">Noch offen</option>${Discovery.countries.map(c=>`<option value="${c.code}" ${c.code===code?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>Priorität<select id="mCustomPriority">${wishlistPriorityOptions(prefill.priority||'high')}</select></label><label>Aufenthalt (Minuten)<input id="mCustomDuration" type="number" min="15" max="720" value="${prefill.durationMin||90}"></label></div><details class="form-details" ${Planner.hasLocation(prefill)?'open':''}><summary>Standort und Notizen ergänzen</summary><p class="tiny">Koordinaten kannst du später ergänzen. Ohne Standort bleibt der Wunsch gespeichert, bis er eingeplant werden kann.</p><div class="formgrid"><label>Breitengrad<input id="mCustomLat" inputmode="decimal" value="${prefill.lat??''}" placeholder="z. B. 51.0504"></label><label>Längengrad<input id="mCustomLng" inputmode="decimal" value="${prefill.lng??''}" placeholder="z. B. 13.7373"></label><label class="span2">Notizen<textarea id="mCustomNotes">${esc(prefill.notes||'')}</textarea></label></div></details><p id="customError" class="form-error" role="alert"></p><div class="actions"><button data-close-modal>Abbrechen</button><button id="saveCustomWish" class="primary">In Wunschliste speichern</button></div>`,()=>{
    $('#saveCustomWish').onclick=()=>{try{
      const item=Discovery.customPoint({customId:prefill.customId,name:$('#mCustomName').value,kind:$('#mCustomKind').value,countryCode:$('#mCustomCountry').value,lat:$('#mCustomLat').value.replace(',','.'),lng:$('#mCustomLng').value.replace(',','.'),durationMin:$('#mCustomDuration').value,notes:$('#mCustomNotes').value},()=>uid('custom'));
      const priority=$('#mCustomPriority').value,trip=activeTrip(),oldIndex=trip.wishlist?.findIndex(x=>x.key===prefill.key)??-1;if(prefill.key)trip.wishlist=trip.wishlist.filter(x=>x.key!==prefill.key);
      addCountryForItem(item);setWishlistSelection(item.kind,item,true,priority);const wish=getWishlistEntry(item.kind,item);wish.durationMin=item.durationMin;wish.priority=priority;wish.stayDays=prefill.stayDays||1;wish.photography=prefill.photography?JSON.parse(JSON.stringify(prefill.photography)):null;if(oldIndex>=0){trip.wishlist.splice(trip.wishlist.indexOf(wish),1);trip.wishlist.splice(oldIndex,0,wish);}persistSoon();closeModal();renderAll();switchView('wishlist');toast('In deiner Wunschliste gespeichert.');
    }catch(error){$('#customError').textContent=error.message;}};
  });
}
function addCountryForItem(item){const trip=activeTrip(),c=Discovery.country(item.countryCode);if(!trip||!c)return;trip.countries=Discovery.countriesForTrip(trip);if(!trip.countries.some(x=>x.code===c.code))trip.countries.push(c);trip.destination=trip.countries.map(x=>x.name).join(' · ');trip.country=trip.countries[0]?.name||'';}
function bindCountryEditor(countries){
  const render=()=>{$('#countryEditorChips').innerHTML=countries.map((c,i)=>`<button class="chip on" data-remove-country="${i}" aria-label="${esc(c.name)} entfernen">${esc(c.name)} ×</button>`).join('')||'<p class="tiny">Wähle ein oder mehrere Länder.</p>';$$('[data-remove-country]').forEach(b=>b.onclick=()=>{countries.splice(+b.dataset.removeCountry,1);render();});};
  $('#addCountryBtn').onclick=()=>{const value=$('#countryEntry').value,c=Discovery.country(value);if(!c){$('#countryError').textContent='Bitte ein Land aus der Liste wählen.';return;}if(!countries.some(x=>x.code===c.code))countries.push(c);$('#countryEntry').value='';$('#countryError').textContent='';render();};
  $('#countryEntry').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#addCountryBtn').click();}};render();
}
function countryEditorHtml(){return `<div class="country-editor"><label for="countryEntry">Reiseländer</label><div class="searchbar"><input id="countryEntry" list="countryNames" placeholder="z. B. Deutschland, dann hinzufügen" autocomplete="off"><button id="addCountryBtn">Hinzufügen</button></div><datalist id="countryNames">${Discovery.countries.map(c=>`<option value="${esc(c.name)}">${c.code}</option>`).join('')}</datalist><div id="countryEditorChips" class="chips"></div><p id="countryError" class="form-error" role="alert"></p></div>`;}
function editTripCountries(trip=activeTrip()){if(!trip){newTripModal();return;}const countries=Discovery.countriesForTrip(trip);showModal(`<h2>Wohin geht deine Reise?</h2><p class="lead">Suche und Wunschliste verbinden alle Reiseländer. Die Reihenfolge der Route legst du später fest.</p>${countryEditorHtml()}<div class="actions"><button data-close-modal>Abbrechen</button><button id="saveTripCountries" class="primary">Länder übernehmen</button></div>`,()=>{bindCountryEditor(countries);$('#saveTripCountries').onclick=()=>{const typed=$('#countryEntry').value.trim();if(typed){const c=Discovery.country(typed);if(!c){$('#countryError').textContent='Bitte das eingegebene Land aus der Liste wählen.';return;}if(!countries.some(x=>x.code===c.code))countries.push(c);}if(!countries.length){$('#countryError').textContent='Mindestens ein Reiseland wählen.';return;}trip.countries=countries;trip.country=countries[0].name;trip.destination=countries.map(c=>c.name).join(' · ');resetDiscoverySearch();persistSoon();closeModal();renderAll();toast('Reiseländer gespeichert.');};});}
function bindDiscoveryEvents(){
  $('#toggleAllDays').onclick=()=>{const v=activeVersion();if(!v)return;const collapse=!v.days.every(d=>d.collapsed);v.days.forEach(d=>d.collapsed=collapse);persistSoon();renderPlanner();};
  $('#poiSearchForm').onsubmit=e=>{e.preventDefault();submitPoiSearch();};
  $('#customPoiBtn').onclick=()=>customWishModal();$('#wishAddCustom').onclick=()=>customWishModal();
  $('#discoverCountry').onchange=e=>{discoveryCountryCode=e.target.value;discoverVisible.cities=discoverVisible.attractions=discoverVisible.wildlife=5;renderDiscover();};
  $('#editCountriesBtn').onclick=()=>editTripCountries();$('#settingsNavBtn').onclick=()=>switchView('settings');
  $('#compareVersionsBtn').onclick=()=>switchView('compare');$('#manageVersionsBtn').onclick=()=>{const trip=activeTrip();if(trip)versionModal(trip);};
  document.addEventListener('click',event=>{const button=event.target.closest('button'),d=button?.dataset||{};
    if(d.goto) {switchView(d.goto);if(d.goto==='discover')$('#poiQuery')?.focus?.();}
    if(d.discoverFilter){discoveryFilter=d.discoverFilter;renderDiscoveryControls();}
    if(d.focusSearch!==undefined){switchView('discover');$('#poiQuery')?.focus?.();}
    if(d.clearSearch!==undefined){searchGeneration++;discoverySearch.searched=false;discoverySearch.busy=false;renderSearchResults();}
    if(d.customSearch!==undefined)customWishModal();
    if(d.searchSelect!==undefined){const item=discoverySearch.items[+d.searchSelect];if(item){const existing=getWishlistEntry(item.kind,item);if(!existing)addCountryForItem(item);setWishlistSelection(item.kind,item,!existing,existing?.priority||'high');toast(existing?'Aus Wunschliste entfernt.':'Zur Wunschliste hinzugefügt.');}}
    if(d.searchDetail!==undefined){const item=discoverySearch.items[+d.searchDetail];if(item)openSuggestionDetail(item.kind==='highlight'?'poi':item.kind,item,item.country||discoveryCountry()?.name||'');}
    if(d.wishMove){const trip=activeTrip(),i=trip?.wishlist?.findIndex(x=>x.key===d.wishMove),j=i+Number(d.direction);if(i>=0&&j>=0&&j<trip.wishlist.length){[trip.wishlist[i],trip.wishlist[j]]=[trip.wishlist[j],trip.wishlist[i]];persistSoon();renderWishlistSummary();}}
    if(d.editCustom){const wish=activeTrip()?.wishlist?.find(x=>x.key===d.editCustom);if(wish)customWishModal({...wish.item,...wish});}
    if(d.wishView){const wish=activeTrip()?.wishlist?.find(x=>x.key===d.wishView);if(wish)openSuggestionDetail(wish.kind==='highlight'?'poi':wish.kind,wish.item,wish.country);}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Tab'&&!$('#modal').classList.contains('hidden')){const focusable=[...$('#modalContent').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],summary')].filter(x=>x.getClientRects().length);if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}}});
}

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
  for(const x of v.connections||[]){if(x.distanceKm)km+=+x.distanceKm||0;if(x.durationMin)travel+=+x.durationMin||0;}
  return{days:(v.days||[]).length,stops,km,travel,visit,must,wild};
}
function renderTrips(){
  const box=$('#tripCards');box.innerHTML='';
  if(!state.trips.length){box.innerHTML='<div class="empty wish-empty"><h2>Wohin zieht es dich?</h2><p>Lege deine erste Reise an. Ein Land oder mehrere – alles passt in einen Plan.</p></div>';return;}
  for(const trip of state.trips){const v=trip.versions.find(x=>x.id===trip.selectedVersionId)||trip.versions[0],metrics=versionMetrics(v),photo=(trip.wishlist||[]).find(x=>Discovery.safeUrl(x.item?.photo))?.item?.photo;const el=document.createElement('article');el.className=`tripcard ${trip.id===state.activeTripId?'active':''}`;
    el.innerHTML=`${photo?`<img class="trip-cover" src="${esc(photo)}" alt="Reiseziel aus deiner Wunschliste" loading="lazy">`:''}<div class="triptitle"><div><span class="trip-kicker">${trip.id===state.activeTripId?'Aktuelle Reise':'Deine Reise'}</span><h2>${esc(trip.title)}</h2><div class="tripmeta">${esc(countryLabel(trip))}</div></div><button data-trip-menu="${trip.id}" aria-label="${esc(trip.title)} bearbeiten">•••</button></div><p class="trip-dates">${fmtShortDate(v?.startDate)} – ${fmtShortDate(v?.endDate)}</p><div class="tripstats"><div class="metric"><b>${metrics.days}</b><small>Tage</small></div><div class="metric"><b>${trip.wishlist?.length||0}</b><small>Wünsche</small></div><div class="metric"><b>${trip.versions.length}</b><small>Varianten</small></div></div><div class="actions trip-actions"><button class="primary" data-open-trip="${trip.id}">Reiseplan öffnen →</button><button data-new-version="${trip.id}">Variante erstellen</button></div>`;box.appendChild(el);
  }
}
function renderDiscover(){
  const t=activeTrip(),v=activeVersion();renderDiscoveryControls();$('#discoverDestination').textContent=discoveryCountry()?.name||'Reiseländer wählen';$('#discoverDates').textContent=v?`${fmtDate(v.startDate)} – ${fmtDate(v.endDate)}`:'Noch keine Version';
  const chips=$('#interestChips');chips.innerHTML='';INTERESTS.forEach(i=>{const b=document.createElement('button');b.className=`chip ${(t?.interests||[]).includes(i)?'on':''}`;b.textContent=i;b.onclick=()=>{if(!t)return;const a=t.interests||[];const p=a.indexOf(i);p>=0?a.splice(p,1):a.push(i);persistSoon();renderDiscover();};chips.appendChild(b)});
  renderSuggestionBoxes();renderWishlistSummary();
}
function wishlistKey(kind,item) {
  if(kind==='wildlife'&&!item.isWildlifeLocation&&!item.customId)return `wildlife:${item.taxonId||normalizeName(item.name)}`;
  if(item.customId)return `${kind}:custom:${item.customId}`;
  if(kind==='wildlife'&&item.isWildlifeLocation)return `wildlife-location:${item.taxonId||normalizeName(item.name)}:${Number(item.lat).toFixed(4)}:${Number(item.lng).toFixed(4)}`;
  const entity=item.wikidata||item.tags?.wikidata||item.wiki||item.wikiTag;
  return `${kind}:${entity||normalizeName(item.name)+(Planner.hasLocation(item)?`:${Number(item.lat).toFixed(4)}:${Number(item.lng).toFixed(4)}`:'')}`;
}
function getWishlistEntry(kind,item,t=activeTrip()) {
  if(!t)return null;const key=wishlistKey(kind,item);
  return (t.wishlist||[]).find(x=>x.key===key)|| (t.wishlist||[]).find(x=>x.kind===kind&&x.key===`${kind}:${normalizeName(item.name)}`&&(!Planner.hasLocation(x)||!Planner.hasLocation(item)||haversine(x,item)<5))||null;
}
function wishlistIcon(kind){return kind==='city'?'🏙':kind==='wildlife'?'🐾':'★';}
function wishlistKindLabel(kind){return kind==='city'?'Stadt':kind==='wildlife'?'Wildlife':'Highlight';}
function setWishlistSelection(kind,item,selected=true,priority='high') {
  const t=activeTrip();if(!t)return;t.wishlist=t.wishlist||[];
  const existing=getWishlistEntry(kind,item),key=existing?.key||wishlistKey(kind,item),idx=t.wishlist.findIndex(x=>x.key===key);
  if(!selected){if(idx>=0)t.wishlist.splice(idx,1);}
  else {
    const clean={...item};delete clean.kind;
    const entry={key,kind,countryCode:item.countryCode||'',country:item.country||'',priority:priority||'high',name:item.name||item.title||'Unbenannt',lat:Planner.coordinate(item.lat,90),lng:Planner.coordinate(item.lng,180),item:clean,selectedAt:Date.now(),stayDays:existing?.stayDays||1,durationMin:existing?.durationMin||Planner.duration({kind})};
    if(idx>=0)t.wishlist[idx]={...existing,...entry,priority:existing.priority||priority};else t.wishlist.push(entry);
  }
  persistSoon();renderDiscover();renderSearchResults();
}
function updateWishlistPriority(key,priority){const t=activeTrip(),x=t?.wishlist?.find(e=>e.key===key);if(!x||!WISH_PRIORITIES[priority])return;x.priority=priority;persistSoon();renderWishlistSummary();renderSuggestionBoxes();}
function wishlistPriorityOptions(value){return Object.entries(WISH_PRIORITIES).map(([k,v])=>`<option value="${k}" ${value===k?'selected':''}>${v.label}</option>`).join('');}
function wishlistControlHtml(kind,item){const x=getWishlistEntry(kind,item),key=wishlistKey(kind,item);return `<div class="wishcontrol ${x?'selected':''}"><button class="wishcheck ${x?'on':''}" data-wish-toggle="${esc(kind)}" data-wish-item='${esc(JSON.stringify(item))}' title="${x?'Aus Auswahl entfernen':'Für Route auswählen'}">${x?'✓':'＋'}</button>${x?`<select data-wish-priority="${esc(key)}">${wishlistPriorityOptions(x.priority)}</select>`:''}</div>`;}
function renderWishlistSummary() {
  const trip=activeTrip(),list=trip?.wishlist||[],version=activeVersion(),included=new Set(version?.routeMeta?.includedKeys||[]),deferred=new Map((version?.routeMeta?.deferred||[]).map(x=>[x.key,x.reason]));
  const box=$('#wishlistSummary');if(!box)return;
  $('#wishlistCount').textContent=`${list.length} Wünsche · ${list.filter(x=>x.priority==='must').length} Muss-Ziele`;
  $('#discoverSelectionCount').textContent=`${list.length} Wünsche`;$('#autoRouteBtn').disabled=!list.length;
  box.innerHTML=list.length?list.map((wish,i)=>{
    const status=included.has(wish.key)?'✓ In dieser Variante eingeplant':deferred.has(wish.key)?'⚠ '+deferred.get(wish.key):!Planner.hasLocation(wish)&&wish.kind!=='wildlife'?'⚠ Standort ergänzen':'Für die nächste Route vorgemerkt';
    return `<article class="wish-item">${poiImage(wish.item||{},wish.kind,'wish-photo')}<div class="wish-info"><button class="wish-title textbtn" data-wish-view="${esc(wish.key)}">${esc(wish.name)}</button><p>${esc(wish.country||'Alle Reiseländer')} · ${durText(wish.durationMin||Planner.duration(wish))}${(wish.stayDays||1)>1?` × ${wish.stayDays} Tage`:''}</p><span class="priority ${esc(wish.priority)}">${esc(WISH_PRIORITIES[wish.priority]?.label||'Mittel')}</span>${photographyHtml(wish.photography)}<p class="wish-status">${esc(status)}</p></div><div class="wish-item-actions"><button data-wish-config="${esc(wish.key)}">Priorität, Zeit & Foto</button>${wish.item?.customId?`<button data-edit-custom="${esc(wish.key)}">Ort bearbeiten</button>`:''}<button data-wish-move="${esc(wish.key)}" data-direction="-1" aria-label="${esc(wish.name)} nach oben" ${i===0?'disabled':''}>↑</button><button data-wish-move="${esc(wish.key)}" data-direction="1" aria-label="${esc(wish.name)} nach unten" ${i===list.length-1?'disabled':''}>↓</button><button data-wish-remove="${esc(wish.key)}" aria-label="${esc(wish.name)} entfernen">×</button></div></article>`;
  }).join(''):'<div class="empty wish-empty"><span aria-hidden="true">♡</span><h2>Platz für deine Reisewünsche</h2><p>Wähle Städte, Naturziele und Tiere. Lege fest, was du unbedingt erleben möchtest.</p><button class="primary" data-goto="discover">Wünsche entdecken</button></div>';
}
function photographyHtml(photo){
  if(!photo||(!photo.genres?.length&&!photo.windowStart&&!photo.notes))return'';
  return `<div class="photo-plan"><b>Fotografie</b> ${esc((photo.genres||[]).map(g=>Discovery.photoGenres[g]).filter(Boolean).join(' · '))}${photo.windowStart?`<br>Aufnahmefenster ${esc(photo.windowStart)}–${esc(photo.windowEnd)} · selbst festgelegt`:''}${photo.notes?`<details><summary>Aufnahmehinweise</summary><p>${esc(photo.notes)}</p></details>`:''}</div>`;
}
function wishSettingsModal(key) {
  const t=activeTrip(),wish=t?.wishlist?.find(x=>x.key===key);if(!wish)return;const photo=wish.photography||{};
  showModal(`<h2>${esc(wish.name)}</h2><p class="lead">Was ist dir wichtig, und wie viel Zeit möchtest du einplanen?</p><div class="formgrid"><label>Priorität<select id="mWishPriority">${wishlistPriorityOptions(wish.priority)}</select></label><label>Aufenthaltstage<input id="mWishDays" type="number" min="1" max="30" value="${wish.stayDays||1}"></label><label>Minuten je Aufenthaltstag<input id="mWishDuration" type="number" min="15" max="720" step="15" value="${wish.durationMin||Planner.duration(wish)}"></label></div><details class="form-details" ${photo.genres?.length||photo.windowStart||photo.notes?'open':''}><summary>Fotografie planen</summary><p>Welche Motive möchtest du aufnehmen?</p><div class="photo-genres">${Object.entries(Discovery.photoGenres).map(([k,label])=>`<label class="checkline"><input type="checkbox" data-photo-genre="${k}" ${(photo.genres||[]).includes(k)?'checked':''}>${label}</label>`).join('')}</div><div class="formgrid"><label>Aufnahmefenster ab<input id="mPhotoStart" type="time" value="${esc(photo.windowStart||'')}"></label><label>Aufnahmefenster bis<input id="mPhotoEnd" type="time" value="${esc(photo.windowEnd||'')}"></label><label class="span2">Motiv, Perspektive und Ausrüstung<textarea id="mPhotoNotes" placeholder="z. B. Spiegelung am See, Blick nach Osten, Stativ">${esc(photo.notes||'')}</textarea></label></div><p class="tiny">Optional: Trage ein geprüftes Zeitfenster in Ortszeit ein. Die gesamte Aufenthaltsdauer muss hineinpassen. Sonnenstand und Wetter werden noch nicht berechnet. Für Nachtaufnahmen über Mitternacht zwei Wünsche anlegen.</p></details><p id="wishError" class="form-error" role="alert"></p><div class="actions"><button data-close-modal>Abbrechen</button><button id="saveWishBtn" class="primary">Übernehmen</button></div>`,()=>{
    $('#saveWishBtn').onclick=()=>{
      const days=Number($('#mWishDays').value),duration=Number($('#mWishDuration').value);
      if(!Number.isInteger(days)||days<1||days>30||!Number.isFinite(duration)||duration<15||duration>720){$('#wishError').textContent='Gültige Aufenthaltsdauer wählen.';return;}
      try{
        const photography=Discovery.photoPlan({genres:$$('[data-photo-genre]:checked').map(x=>x.dataset.photoGenre),windowStart:$('#mPhotoStart').value,windowEnd:$('#mPhotoEnd').value,notes:$('#mPhotoNotes').value});
        if(photography.windowStart&&duration>Planner.minutes(photography.windowEnd)-Planner.minutes(photography.windowStart))throw new Error('Die Aufenthaltsdauer ist länger als das Aufnahmefenster.');
        Object.assign(wish,{priority:$('#mWishPriority').value,stayDays:days,durationMin:duration,photography});persistSoon();closeModal();renderDiscover();
      }catch(error){$('#wishError').textContent=error.message;}
    };
  });
}
function suggestionFooter(kind,total,shown){
  if(!total||total<=5)return'';
  const more=shown<total;
  return `<div class="suggestionfooter"><span>${Math.min(shown,total)} von ${total}</span><div>${shown>5?`<button data-suggestions-less="${kind}">Weniger</button>`:''}${more?`<button class="primary mini" data-suggestions-more="${kind}">Weitere laden</button>`:''}</div></div>`;
}
function inspirationCard(item,kind){
  const selected=getWishlistEntry(kind,item),meta=kind==='wildlife'?`${item.count??'–'} historische Beobachtungen`:item.highlightType||item.country||wishlistKindLabel(kind);
  const attr=kind==='city'?'data-city-overview':kind==='wildlife'?'data-wild-detail':'data-poi-detail';
  return `<article class="inspiration-card ${selected?'is-selected':''}"><button class="image-button" ${attr}='${esc(JSON.stringify(item))}' aria-label="Details zu ${esc(item.name)}">${poiImage(item,kind)}</button><div class="inspiration-body"><small>${esc(meta)}</small><h3>${esc(item.name)}</h3><p>${esc(kind==='wildlife'?item.scientific||'Sichtung nicht garantiert':item.summary?.slice(0,95)||'Öffne Details und entdecke den Ort.')}</p><div class="inspiration-actions"><button class="textbtn" ${attr}='${esc(JSON.stringify(item))}'>Details →</button>${wishlistControlHtml(kind,item)}</div></div></article>`;
}
function renderInspiration(kind,data,selector){
  const box=$(selector),key=kind==='city'?'cities':kind==='wildlife'?'wildlife':'attractions',limit=discoverVisible[key];
  box.className='suggestions inspiration-list';
  box.innerHTML=data?.length?data.slice(0,limit).map(item=>inspirationCard(item,kind)).join('')+suggestionFooter(key,data.length,limit):`<div class="inspiration-empty"><span aria-hidden="true">${wishlistIcon(kind)}</span><div><h3>${kind==='city'?'Neue Lieblingsorte':kind==='wildlife'?'Welches Tier möchtest du sehen?':'Große Natur. Besondere Orte.'}</h3><p>Ideen laden oder gezielt selbst suchen.</p></div><button data-focus-search>Suchen</button></div>`;
}
function renderCitySuggestions(cities){renderInspiration('city',cities,'#citySuggestions');if(currentView==='discover'&&cities?.length)setTimeout(()=>enrichCitySuggestionThumbs(cities.slice(0,discoverVisible.cities)),0);}
async function enrichCitySuggestionThumbs(cities){
  const context=discoveryCountry()?.name||'';
  for(const city of cities||[]){
    const k=`citythumb:${normalizeName(city.name)}:${(+city.lat||0).toFixed(3)}`;if(city.photo||city.photoChecked||verifiedEnrichmentPending.has(k))continue;verifiedEnrichmentPending.add(k);
    try{const detail=await Providers.verifiedPlaceDetails(city,city.country||context,'city'),photos=await Providers.verifiedPhotosForItem(city,city.country||context,'city',detail);if(detail?.summary)city.summary=detail.summary;if(detail?.wiki)city.wiki=detail.wiki;if(photos[0]?.url){city.photo=photos[0].url;city.photoVerified=true}city.photoChecked=true;persistSoon();renderCitySuggestions(suggestionData('cities'));}catch(e){city.photoChecked=true;}finally{verifiedEnrichmentPending.delete(k)}
  }
}
function renderAttractionSuggestions(items){renderInspiration('highlight',items,'#poiSuggestions');}
function renderWildlifeSuggestions(items){renderInspiration('wildlife',items,'#wildSuggestions');}
function suggestionData(kind){
  const t=activeTrip(),country=discoveryCountry();if(!t||!country)return[];const withCountry=items=>items.map(x=>Object.assign(x,{country:x.country||country.name,countryCode:x.countryCode||country.code}));
  if(kind==='cities')return withCountry(state.cache.cities[`cities:v6:${normalizeName(country.name)}`]||[]);
  if(kind==='attractions')return withCountry(state.cache.wikidata[`attr:v6:${normalizeName(country.name)}`]||[]);
  if(kind==='wildlife'){const month=activeVersion()?.startDate?new Date(`${activeVersion().startDate}T12:00:00`).getMonth()+1:0;return withCountry(state.cache.wildlife[`wild:v3:${normalizeName(country.name)}:${month}`]||[]);}
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

function activityDurationForWish(x){return x.kind==='city'?300:x.kind==='wildlife'?180:150;}
function autoLegMode(a,b,distanceKm){if(distanceKm<=550)return'rentalcar';if(distanceKm<=850&&a.kind==='city'&&b.kind==='city')return'train';return'flight';}
function autoLegDuration(distanceKm,mode){if(mode==='flight')return Math.max(60,Math.round(distanceKm/720*60));if(mode==='train')return Math.max(90,Math.round(distanceKm/105*60));return Math.max(30,Math.round(distanceKm/72*60));}
function minutesToClock(base,min){return minToTime(timeToMin(base)+Math.round(min||0));}
function autoRouteOrder(nodes){if(nodes.length<2)return nodes;const score=x=>(WISH_PRIORITIES[x.priority]?.weight||1)+(x.kind==='city'?0.4:0);let start=[...nodes].sort((a,b)=>score(b)-score(a)||(b.item?.population||0)-(a.item?.population||0))[0],rem=nodes.filter(x=>x!==start),out=[start],cur=start;while(rem.length){let bi=0,best=Infinity;for(let i=0;i<rem.length;i++){const d=haversine(cur,rem[i]),prio=WISH_PRIORITIES[rem[i].priority]?.weight||1,cost=d/(0.78+prio*.08);if(cost<best){best=cost;bi=i}}cur=rem.splice(bi,1)[0];out.push(cur)}return out;}
async function resolveWishlistNodes(list,onStatus=null,trip=activeTrip(),version=activeVersion()) {
  const month=Number(version?.startDate?.slice(5,7))||0,out=[],countries=Discovery.countriesForTrip(trip);
  const known=list.filter(Planner.hasLocation);
  for(let i=0;i<list.length;i++) {
    const x=list[i],node={...x,item:{...(x.item||{})},lat:Planner.coordinate(x.lat,90),lng:Planner.coordinate(x.lng,180)};
    if(x.kind==='wildlife'&&!Planner.hasLocation(node)) {
      onStatus?.(`Wildlife-Orte ${i+1}/${list.length}: ${x.name}`);
      try {
        if(!x.item?.taxonId)throw new Error('Tierart oder Beobachtungsort noch zuordnen.');
        const selected=x.countryCode||x.country?countries.filter(c=>c.code===x.countryCode&&c.code||c.name===x.country):countries;
        const candidates=[],errors=[];
        for(const country of selected.length?selected:countries) {
          try {const h=await Providers.wildlifeBestHotspot(x.item.taxonId,country.name,month);if(Planner.hasLocation(h))candidates.push({...h,country:country.name,countryCode:country.code});}catch(error){errors.push(error.message);}
        }
        candidates.sort((a,b)=>known.length?Math.min(...known.map(k=>haversine(a,k)))-Math.min(...known.map(k=>haversine(b,k))):(b.count||0)-(a.count||0));
        const h=candidates[0];
        if(h){node.lat=h.lat;node.lng=h.lng;node.hotspot=h;node.country=h.country;node.countryCode=h.countryCode;node.item.hotspot=h;node.item.country=h.country;node.item.countryCode=h.countryCode;}
        else node.resolveError=errors.length?'Wildlife-Daten nicht vollständig erreichbar; Ort bitte selbst auswählen':'Kein öffentlicher Nachweis in den gewählten Ländern und im Reisemonat gefunden';
      }catch(error){node.resolveError=error.message;}
    } else if(!Planner.hasLocation(node))node.resolveError='Eigener Wunsch gespeichert; Standort noch ergänzen';
    out.push(node);
  }
  return out;
}
function objectOpenIssues(obj,type='stop') {
  if(!obj)return[];const issues=[];
  const missing=value=>!String(value||'').trim()||/\boffen\b/i.test(value);
  if(type==='connection') {
    if(obj.borderCrossing)issues.push('Länderwechsel: Fahrzeugfreigabe, Grenzübertritt und Ortszeiten prüfen');
    if(obj.mode==='other')issues.push('Verkehrsmittel noch festlegen');
    if(missing(obj.from))issues.push('Startort noch konkretisieren');
    if(missing(obj.to))issues.push('Zielort noch konkretisieren');
    if(!obj.departDate||!obj.arriveDate||timeToMin(obj.departTime)===null||timeToMin(obj.arriveTime)===null)issues.push('Abfahrts- und Ankunftszeit noch ergänzen');
    if(obj.timeEstimated)issues.push('Zeitangaben sind geschätzt – anhand der Verbindung prüfen');
    if(['flight','train','bus','ferry'].includes(obj.mode)&&!obj.number)issues.push('Verbindungsnummer noch offen');
    if(['flight','train','bus','ferry','rentalcar'].includes(obj.mode)&&!obj.operator)issues.push('Anbieter/Betreiber noch offen');
    if(obj.mode==='flight'&&obj.timeEstimated)issues.push('Flugverfügbarkeit und lokale Zeitzonen noch prüfen');
  } else if(type==='transfer') {
    if(missing(obj.fromName)||missing(obj.toName))issues.push('Start und Ziel des Transfers konkretisieren');
    if(!obj.durationMin)issues.push('Transferdauer noch festlegen');
    if(obj.timeEstimated)issues.push('Transferdauer und Route sind zunächst geschätzt');
    if(!obj.provider&&!['car','walk'].includes(obj.mode))issues.push('Transfer-Anbieter noch offen');
  } else if(type==='accommodation') {
    const a=obj.accommodation||{};
    if(missing(obj.name)||!a.address)issues.push('Konkrete Unterkunft und Adresse noch offen');
    if(!a.checkInDate||!a.checkOutDate||a.checkOutDate<=a.checkInDate)issues.push('Check-out muss nach dem Check-in liegen');
    if(!Planner.hasLocation(obj))issues.push('Standort der Unterkunft noch festlegen');
    if(!a.bookingRef)issues.push('Buchungs-/Reservierungsdaten noch offen');
  } else {
    issues.push(...(obj.openIssues||[]));
    if(!Planner.hasLocation(obj))issues.push('Standort noch festlegen');
  }
  return [...new Set(issues.filter(Boolean))];
}
function planningReviewHtml(obj,type) {
  if(type==='stop')return obj.openIssues?.length?`<label class="checkline"><input id="mPlanningChecked" type="checkbox"> Standort, Öffnungszeiten und Besuchsdauer geprüft</label><p class="tiny">${obj.openIssues.map(esc).join(' · ')}</p>`:'';
  return `<label class="checkline"><input id="mPlanningChecked" type="checkbox" ${obj.timeEstimated?'':'checked'}> Zeiten und ${type==='connection'?'konkrete Verbindung':'Transferroute'} geprüft</label><p class="tiny">Eine automatisch geschätzte Zeit bleibt offen, bis du sie geprüft hast.</p>`;
}
function invalidateStopRoutes(v,stop) {
  for(const day of v.days)for(let i=0;i<day.stops.length;i++)if(day.stops[i].id===stop.id){day.stops[i].routeToNext=null;if(i)day.stops[i-1].routeToNext=null;}
  for(const connection of v.connections||[])for(const prefix of ['from','to'])if(stop.wishlistKey&&connection[prefix+'WishlistKey']===stop.wishlistKey){
    if(connection[prefix+'Lat']!==stop.lat||connection[prefix+'Lng']!==stop.lng){connection.geometry=null;connection.distanceKm=0;connection.durationMin=0;connection.approx=true;connection.timeEstimated=true;}
    connection[prefix]=stop.name;connection[prefix+'Lat']=stop.lat;connection[prefix+'Lng']=stop.lng;
  }
  for(const tr of v.transfers||[])if(tr.toStopId===stop.id) {
    const prefix=tr.transferType==='to_airport'?'from':'to';
    if(tr[prefix+'Lat']!==stop.lat||tr[prefix+'Lng']!==stop.lng){tr.distanceKm=0;tr.approx=true;tr.timeEstimated=true;}
    tr[prefix+'Name']=stop.name;tr[prefix+'Lat']=stop.lat;tr[prefix+'Lng']=stop.lng;
  }
}
function syncConnectionTransfers(v,connection,previous=null){
  for(const transfer of v.transfers||[])if(transfer.sourceRef===`connection:${connection.id}`){
    const departure=transfer.transferType==='to_airport';transfer.date=departure?connection.departDate:connection.arriveDate;
    const changed=previous&&(previous.mode!==connection.mode||(departure?previous.from!==connection.from:previous.to!==connection.to));
    if(changed){const prefix=departure?'to':'from';transfer[prefix+'Name']=departure?'Abfahrtsort (offen)':'Ankunftsort (offen)';transfer[prefix+'Lat']=null;transfer[prefix+'Lng']=null;transfer.distanceKm=0;transfer.approx=true;transfer.timeEstimated=true;}
  }
}
function issueBadgeHtml(issues){return issues?.length?`<div class="openissue"><b>⚠ ${issues.length} offen</b><span>${esc(issues[0])}${issues.length>1?` · +${issues.length-1}`:''}</span></div>`:'';}
function planningIssueCount(v){let n=0;for(const c of v.connections||[])if(objectOpenIssues(c,'connection').length)n++;for(const tr of v.transfers||[])if(objectOpenIssues(tr,'transfer').length)n++;for(const d of v.days||[])for(const s of d.stops||[])if(objectOpenIssues(s,s.accommodation?'accommodation':'stop').length)n++;n+=(v.routeMeta?.deferred||[]).length;return n;}
function makeAutoAccommodation(node,day,nextDate){return {id:uid('stop'),name:`Unterkunft ${node.kind==='city'?'in':'bei'} ${node.name} (offen)`,lat:node.lat,lng:node.lng,type:'hotel',priority:'high',durationMin:20,durationWish:20,notes:'Automatisch angelegter Unterkunfts-Platzhalter. Konkrete Unterkunft später auswählen.',openingHours:'',fixedStart:'18:00',images:[],tags:['auto-route','placeholder'],wildlife:[],modeToNext:'walk',routeToNext:null,planningPlaceholder:true,openIssues:['Konkrete Unterkunft auswählen'],accommodation:{kind:'Unterkunft offen',checkInDate:day.date,checkInTime:'15:00',checkOutDate:nextDate||day.date,checkOutTime:'10:00',address:'',bookingRef:'',planningPlaceholder:true}};}
function makeAutoStop(node,fixedStart='11:00'){const htxt=`${node.item?.highlightType||''} ${node.name||''}`;const type=node.kind==='city'?'city':node.kind==='wildlife'?'wildlife':/(Nationalpark|Natur|Riff|Insel|Berg|Fels|Schlucht|Wasserfall|Küste|Strand|Park)/i.test(htxt)?'nature':'sight',issues=[];if(node.kind==='city')issues.push('Konkrete Sehenswürdigkeiten für die Stadt noch auswählen');if(node.kind==='wildlife')issues.push(node.hotspot?'Wildlife-Hotspot vor der Reise anhand aktueller Meldungen prüfen':node.item?.isWildlifeLocation?'Eigenen Wildlife-Ort vor Ort prüfen':'Geeigneten Wildlife-Hotspot noch festlegen');if(node.kind==='highlight')issues.push('Öffnungszeiten und sinnvolle Besuchsdauer noch prüfen');return {id:uid('stop'),name:node.kind==='wildlife'&&!node.item?.isWildlifeLocation?`${node.name} – Wildlife-Ort`:node.name,lat:node.lat,lng:node.lng,type,priority:node.priority,durationMin:node.kind==='city'?180:90,durationWish:activityDurationForWish(node),notes:node.item?.notes|| (node.kind==='wildlife'&&node.hotspot?`Automatisch aus historischen iNaturalist-Beobachtungen abgeleiteter Hotspot (${node.hotspot.count} Beobachtungen im Cluster). Sichtung nicht garantiert.`:'Aus deiner Wunschliste in den Routenvorschlag übernommen.'),openingHours:'',fixedStart,images:node.item?.photo?[{url:node.item.photo,full:node.item.photo,title:node.name,page:''}]:[],tags:['auto-route',node.kind],wildlife:node.kind==='wildlife'?[node.name]:[],modeToNext:'car',routeToNext:null,planningPlaceholder:issues.length>0,openIssues:issues,wishlistKey:node.key,photography:node.photography?JSON.parse(JSON.stringify(node.photography)):null};}
function makeAutoConnection(a,b,date,startTime='08:00'){const km=haversine(a,b),mode=autoLegMode(a,b,km),dur=autoLegDuration(km,mode),defs=connectionModeDefaults(mode),issues=[mode==='rentalcar'?'Mietwagen/Fahrzeug und konkrete Route noch festlegen':mode==='train'?'Konkrete Zugverbindung noch auswählen':'Konkreten Flug noch auswählen','Zeitangaben sind zunächst nur eine Planungsschätzung'];return {id:uid('conn'),mode,title:'Automatische Weiterreise',operator:'',number:'',reference:'',from:a.name,to:b.name,departDate:date,departTime:startTime,arriveDate:date,arriveTime:minutesToClock(startTime,dur),departureBuffer:defs.departureBuffer,arrivalBuffer:defs.arrivalBuffer,durationMin:dur,distanceKm:km,notes:'Automatisch vorgeschlagener Verbindungsbaustein. Verkehrsmittel und Buchungsdaten können später geändert werden.',planningPlaceholder:true,timeEstimated:true,openIssues:issues,autoSuggestedMode:mode};}
function addAutoTransfers(v,conn,fromLodging,toLodging){if(!['flight','train','bus','ferry'].includes(conn.mode))return;const base=conn.mode==='flight'?45:20;if(fromLodging)v.transfers.push({id:uid('transfer'),sourceRef:`connection:${conn.id}`,toStopId:fromLodging.id,transferType:'to_airport',date:conn.departDate,fromName:fromLodging.name,toName:`${MODES[conn.mode]} Abfahrtsort (offen)`,fromLat:fromLodging.lat,fromLng:fromLodging.lng,toLat:null,toLng:null,mode:'transit',provider:'',reference:'',distanceKm:0,durationMin:base,extraBufferMin:10,approx:true,notes:'Automatischer Transfer-Platzhalter vor der Langstrecken-Verbindung.',planningPlaceholder:true,timeEstimated:true,openIssues:['Konkreten Abfahrtsort und Transferweg festlegen']});if(toLodging)v.transfers.push({id:uid('transfer'),sourceRef:`connection:${conn.id}`,toStopId:toLodging.id,transferType:'to_lodging',date:conn.arriveDate,fromName:`${MODES[conn.mode]} Ankunftsort (offen)`,toName:toLodging.name,fromLat:null,fromLng:null,toLat:toLodging.lat,toLng:toLodging.lng,mode:'transit',provider:'',reference:'',distanceKm:0,durationMin:base,extraBufferMin:10,approx:true,notes:'Automatischer Transfer-Platzhalter nach der Langstrecken-Verbindung.',planningPlaceholder:true,timeEstimated:true,openIssues:['Konkreten Ankunftsort und Transferweg festlegen']});}
async function buildAutomaticRoute(opts={}) {
  const t=activeTrip(),base=activeVersion();if(!t||!base)throw new Error('Keine aktive Reise.');
  const list=JSON.parse(JSON.stringify(t.wishlist||[]));if(!list.length)throw new Error('Wähle zuerst mindestens ein Ziel aus.');
  const options={dayStart:state.settings.defaultStart,dayEnd:state.settings.defaultEnd,...t.routePreferences,...opts,startDate:base.startDate,endDate:base.endDate,legs:{}};
  const nodes=await resolveWishlistNodes(list,opts.onStatus,t,base);
  let result=Planner.plan(nodes,options);
  // Re-evaluate feasibility using road routes for every accepted neighbouring pair.
  // Unavailable road data stays explicitly approximate; NoRoute is never a road.
  for(let pass=0;pass<nodes.length;pass++) {
    const missing=[];
    for(let i=1;i<result.ordered.length;i++) {
      const a=result.ordered[i-1],b=result.ordered[i],key=a.key+'|'+b.key;
      if(!options.legs[key])missing.push({a,b,key});
    }
    if(!missing.length)break;
    for(const {a,b,key} of missing) {
      opts.onStatus?.(`Verbindung prüfen: ${a.name} → ${b.name}`);
      const estimate=Planner.estimateLeg(a,b,options);
      if(estimate.mode==='flight')options.legs[key]=estimate;
      else {
        try {
          const route=await Providers.route(a,b,estimate.mode);
          options.legs[key]={...estimate,...route,mode:estimate.mode,durationMin:Math.ceil(route.durationMin),source:route.source||(route.approx?'Luftlinien-Schätzung':'OSRM')};
        } catch(e) {options.legs[key]={...estimate,source:'Schätzung: Datenquelle nicht erreichbar'};}
      }
    }
    result=Planner.plan(nodes,options);
  }
  if(!result.includedKeys.length)throw new Error(result.deferred[0]?.reason||'Kein Ziel passt in den Zeitraum.');
  if(!state.trips.includes(t)||!t.versions.includes(base))throw new Error('Die Ausgangsreise wurde während der Planung entfernt.');
  const v={id:uid('ver'),name:opts.name||'Auto-Route aus Wunschliste',startDate:base.startDate,endDate:base.endDate,countries:Discovery.countriesForTrip(t),days:[],flights:[],connections:[],transfers:[],createdAt:Date.now(),routeMeta:{source:'wishlist',generatorVersion:'1.4.0',sourceVersionId:base.id,sourceVersionName:base.name,generatedAt:Date.now(),wishlistKeys:list.map(x=>x.key),includedKeys:result.includedKeys,deferred:result.deferred.map(x=>({key:x.key,name:x.name,priority:x.priority,reason:x.reason})),missingMust:result.missingMust.map(x=>x.key),flexDays:result.days.filter(d=>!d.events.length).length,options:{...options,legs:undefined,onStatus:undefined}}};
  const lodgingByDay=new Map();let previousLodging=null,previousLodgingKey=null;
  for(let di=0;di<result.days.length;di++) {
    const planned=result.days[di],day={id:uid('day'),date:planned.date,startTime:options.dayStart,endTime:options.dayEnd,stops:[],planningNote:planned.events.length?'':'Freier Tag am letzten Aufenthaltsort – weitere Aktivitäten können ergänzt werden.'};
    for(const event of planned.events) {
      if(event.type==='activity') {
        const stop=makeAutoStop(event.node,Planner.clock(event.start));
        stop.durationWish=event.end-event.start;stop.durationMin=Math.min(stop.durationMin,stop.durationWish);
        if(event.part>1)stop.name+=` – Aufenthaltstag ${event.part}`;
        Object.assign(stop,{country:event.node.country||event.node.item?.country||'',countryCode:event.node.countryCode||event.node.item?.countryCode||'',wikidata:event.node.item?.wikidata||'',wiki:event.node.item?.wiki||event.node.item?.wikiTag||'',taxonId:event.node.item?.taxonId||null,sourceMeta:{source:event.node.item?.customId?'Eigener Ort':event.node.kind==='wildlife'?'iNaturalist':event.node.item?.source||'Entdecken',retrievedAt:event.node.hotspot?.retrievedAt||Date.now(),hotspot:event.node.hotspot||null},planningPlaceholder:true});
        day.stops.push(stop);
      } else {
        const e=event,l=e.leg;
        const c={id:uid('conn'),mode:l.mode,title:'Weiterreise',operator:'',number:'',reference:'',from:e.from.name,to:e.to.name,fromLat:e.from.lat,fromLng:e.from.lng,toLat:e.to.lat,toLng:e.to.lng,fromWishlistKey:e.from.key,toWishlistKey:e.to.key,fromCountry:l.fromCountry||e.from.country||e.from.item?.country||'',toCountry:l.toCountry||e.to.country||e.to.item?.country||'',borderCrossing:l.countryChange||Discovery.crossesBorder(e.from,e.to),departDate:day.date,arriveDate:day.date,departTime:Planner.clock(e.start),arriveTime:Planner.clock(e.end),departureBuffer:l.departureBuffer||0,arrivalBuffer:l.arrivalBuffer||0,durationMin:e.end-e.start,distanceKm:l.distanceKm,geometry:l.geometry||null,approx:!!l.approx,source:l.source,drivingMin:l.drivingMin||0,notes:`${l.countryChange||Discovery.crossesBorder(e.from,e.to)?'Länderwechsel: Grenzübertritt, Fahrzeugfreigabe und lokale Zeiten prüfen. ':''}${l.source||'Planungsschätzung'}. ${l.breakMin?`${l.breakMin} Minuten Fahrtpause enthalten. `:''}${l.mode==='flight'?'Vorgeschlagenes Verkehrsmittel; Flugverfügbarkeit, Flughäfen und lokale Zeiten prüfen.':'Fahrzeug und befahrbare Strecke prüfen.'}`,planningPlaceholder:true,timeEstimated:true,openIssues:[]};
        v.connections.push(c);
        if(l.mode==='flight')c.autoTransfers={before:l.transferBefore,after:l.transferAfter,dayIndex:di};
      }
    }
    if(di<result.days.length-1&&planned.location) {
      const sameLodging=previousLodging&&previousLodgingKey===planned.location.key;
      const hotel=sameLodging?previousLodging:makeAutoAccommodation(planned.location,day,addDays(day.date,1));
      hotel.accommodation.checkOutDate=addDays(day.date,1);
      const last=planned.events.at(-1),checkIn=Math.max(15*60,(last?.blockEnd??last?.end??15*60));
      if(!sameLodging){hotel.fixedStart=Planner.clock(Math.min(checkIn,timeToMin(day.endTime)-20));hotel.accommodation.checkInTime=hotel.fixedStart;hotel.openIssues=[];day.stops.push(hotel);}
      lodgingByDay.set(di,hotel);previousLodging=hotel;previousLodgingKey=planned.location.key;
    }
    v.days.push(day);
  }
  for(const c of v.connections)if(c.autoTransfers) {
    const di=c.autoTransfers.dayIndex;
    addAutoTransfers(v,c,lodgingByDay.get(di-1)||{id:'',name:c.from,lat:c.fromLat,lng:c.fromLng},lodgingByDay.get(di)||{id:'',name:c.to,lat:c.toLat,lng:c.toLng});
    delete c.autoTransfers;
  }
  const first=result.ordered[0],last=result.ordered.at(-1);
  const arrival={id:uid('conn'),mode:'other',title:'Anreise',from:'Startort (offen)',to:first.name,departDate:v.startDate,departTime:'',arriveDate:v.startDate,arriveTime:options.arrivalTime||'10:00',departureBuffer:0,arrivalBuffer:30,planningPlaceholder:true,timeEstimated:true,openIssues:[]};
  const departure={id:uid('conn'),mode:'other',title:'Abreise',from:last.name,to:'Zielort (offen)',departDate:v.endDate,departTime:options.departureTime||'18:00',arriveDate:v.endDate,arriveTime:'',departureBuffer:30,arrivalBuffer:0,planningPlaceholder:true,timeEstimated:true,openIssues:[]};
  v.connections.unshift(arrival);v.connections.push(departure);
  // Boundary transfers remain even on a day trip without an overnight stay.
  const boundaryTransfer=(c,direction,lodging,node)=>({id:uid('transfer'),sourceRef:`connection:${c.id}`,toStopId:lodging?.id||'',transferType:direction,date:direction==='to_lodging'?c.arriveDate:c.departDate,fromName:direction==='to_lodging'?'Ankunftspunkt (offen)':lodging?.name||node.name,toName:direction==='to_lodging'?lodging?.name||node.name:'Abfahrtsort (offen)',fromLat:direction==='to_airport'?node.lat:null,fromLng:direction==='to_airport'?node.lng:null,toLat:direction==='to_lodging'?node.lat:null,toLng:direction==='to_lodging'?node.lng:null,mode:'transit',durationMin:45,extraBufferMin:10,distanceKm:0,approx:true,planningPlaceholder:true,timeEstimated:true,openIssues:[]});
  v.transfers.push(boundaryTransfer(arrival,'to_lodging',lodgingByDay.get(0),first));
  v.transfers.push(boundaryTransfer(departure,'to_airport',lodgingByDay.get(result.days.length-2),last));
  const conflicts=v.days.flatMap(day=>computeDay(v,day).conflicts.map(message=>`${day.date}: ${message}`));
  if(conflicts.length)throw new Error(`Ankunft, Abfahrt oder Tageszeiten passen nicht zum Entwurf. Bitte Zeitfenster anpassen. ${conflicts[0]}`);
  t.routePreferences={dayStart:options.dayStart,dayEnd:options.dayEnd,startKey:options.startKey||'',endKey:options.endKey||'',roadMode:options.roadMode||'rentalcar',allowFlights:options.allowFlights!==false,orderMode:options.orderMode||'geographic',maxVisitMin:options.maxVisitMin||360,maxDriveMin:options.maxDriveMin||360,arrivalTime:options.arrivalTime||'10:00',departureTime:options.departureTime||'18:00'};
  t.versions.push(v);t.selectedVersionId=v.id;persistSoon();return v;
}
function autoRouteModal() {
  const t=activeTrip(),v=activeVersion(),list=t?.wishlist||[];if(!t||!v||!list.length){toast('Wähle zuerst Städte, Highlights oder Tiere aus.');return;}
  const pref=t.routePreferences||{},select=(selected)=>`<option value="">Automatisch</option>${list.filter(x=>x.kind!=='wildlife'||Planner.hasLocation(x)).map(x=>`<option value="${esc(x.key)}" ${x.key===selected?'selected':''}>${esc(x.name)}</option>`).join('')}`;
  showModal(`<h2>Deine Wünsche werden zur Route</h2><p class="lead">Aufenthalte, Fahrten, Pausen und Übernachtungen werden gemeinsam auf die verfügbaren Tage verteilt. Deine bisherige Version bleibt erhalten.</p><div class="formgrid"><label>Name der neuen Version<input id="mAutoRouteName" value="Auto-Route aus Wunschliste"></label><label>Startziel<select id="mAutoStart">${select(pref.startKey)}</select></label><label>Letztes Ziel<select id="mAutoEnd">${select(pref.endKey)}</select></label><label>Fahrzeug<select id="mAutoMode">${['rentalcar','camper','car'].map(k=>`<option value="${k}" ${(pref.roadMode||'rentalcar')===k?'selected':''}>${MODES[k]}</option>`).join('')}</select></label><label>Reihenfolge<select id="mAutoOrder"><option value="geographic" ${pref.orderMode!=='wishlist'?'selected':''}>Nach Nähe ordnen</option><option value="wishlist" ${pref.orderMode==='wishlist'?'selected':''}>Meine Wunschlisten-Reihenfolge</option></select></label><label>Aktivitäten pro Tag<select id="mAutoPace"><option value="240" ${pref.maxVisitMin===240?'selected':''}>Entspannt · bis 4 Stunden</option><option value="360" ${!pref.maxVisitMin||pref.maxVisitMin===360?'selected':''}>Ausgewogen · bis 6 Stunden</option><option value="480" ${pref.maxVisitMin===480?'selected':''}>Intensiv · bis 8 Stunden</option></select></label><label>Tag beginnt<input id="mAutoDayStart" type="time" value="${esc(pref.dayStart||state.settings.defaultStart)}"></label><label>Tag endet<input id="mAutoDayEnd" type="time" value="${esc(pref.dayEnd||state.settings.defaultEnd)}"></label><label>Höchstens Fahrstunden je Tag<input id="mAutoDrive" type="number" min="1" max="10" value="${(pref.maxDriveMin||360)/60}"></label><label>Ankunft am ersten Tag (Entwurf)<input id="mAutoArrival" type="time" value="${esc(pref.arrivalTime||'10:00')}"></label><label>Abfahrt am letzten Tag (Entwurf)<input id="mAutoDeparture" type="time" value="${esc(pref.departureTime||'18:00')}"></label></div><div class="formgrid one"><label class="checkline"><input id="mAutoFlights" type="checkbox" ${pref.allowFlights!==false?'checked':''}> Für große Entfernungen Flüge vorschlagen</label><label class="checkline"><input id="mAutoIncludeOptional" type="checkbox" checked> Optionale Ziele einplanen, soweit sie passen</label></div><p class="tiny">Flugverfügbarkeit und Ortszeiten sind offen. Bestehende Buchungen werden in dieser neuen Variante nicht übernommen; vergleiche die Variante anschließend mit „${esc(v.name)}“.</p><div class="warnline">⚠ Nicht passende Wünsche bleiben mit Begründung sichtbar. Fehlende Muss-Ziele werden gesondert markiert.</div><div id="autoRouteStatus" class="tiny"></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="buildAutoRouteBtn" class="primary">Routenvorschlag erstellen</button></div>`,()=>{
    $('#buildAutoRouteBtn').onclick=async()=>{
      const btn=$('#buildAutoRouteBtn'),status=$('#autoRouteStatus'),settings={dayStart:$('#mAutoDayStart').value,dayEnd:$('#mAutoDayEnd').value,name:$('#mAutoRouteName').value.trim()||'Auto-Route aus Wunschliste',startKey:$('#mAutoStart').value,endKey:$('#mAutoEnd').value,roadMode:$('#mAutoMode').value,orderMode:$('#mAutoOrder').value,maxVisitMin:+$('#mAutoPace').value,allowFlights:$('#mAutoFlights').checked,maxDriveMin:+$('#mAutoDrive').value*60,arrivalTime:$('#mAutoArrival').value,departureTime:$('#mAutoDeparture').value,includeOptional:$('#mAutoIncludeOptional').checked,onStatus:m=>{status.textContent=m;}};
      if(settings.startKey&&settings.startKey===settings.endKey){status.textContent='Für eine Rundreise zunächst verschiedene Start- und Endziele wählen und die Rückfahrt anschließend ergänzen.';return;}
      if(settings.maxDriveMin<60||settings.maxDriveMin>600||!settings.arrivalTime||!settings.departureTime){status.textContent='Bitte gültige Fahrstunden und Zeiten eintragen.';return;}
      btn.disabled=true;btn.textContent='Plant …';
      try {const nv=await buildAutomaticRoute(settings);closeModal();renderAll();switchView('plan');toast(nv.routeMeta.missingMust.length?'Entwurf erstellt; nicht passende Muss-Ziele prüfen.':'Routenvorschlag erstellt.');}
      catch(e){status.textContent=e.message;btn.disabled=false;btn.textContent='Routenvorschlag erstellen';}
    };
  });
}

function versionConnections(v=activeVersion()){
  const legacy=(v?.flights||[]).map(f=>({id:f.id,sourceRef:`flight:${f.id}`,mode:'flight',title:f.number||'Flug',operator:f.airline||'',number:f.number||'',from:f.from,to:f.to,departDate:f.departDate,departTime:f.departTime,arriveDate:f.arriveDate,arriveTime:f.arriveTime,departureBuffer:+(f.departureBuffer??state.settings.departureBuffer)||0,arrivalBuffer:+(f.arrivalBuffer??state.settings.arrivalBuffer)||0,notes:f.notes||'',legacyFlight:true}));
  const own=(v?.connections||[]).map(c=>({...c,sourceRef:`connection:${c.id}`,legacyFlight:false}));
  return [...legacy,...own].sort((a,b)=>`${a.departDate||''} ${a.departTime||''}`.localeCompare(`${b.departDate||''} ${b.departTime||''}`));
}
function connectionModeDefaults(mode){
  return ({flight:{departureBuffer:120,arrivalBuffer:60},train:{departureBuffer:20,arrivalBuffer:10},bus:{departureBuffer:20,arrivalBuffer:10},ferry:{departureBuffer:45,arrivalBuffer:20},transit:{departureBuffer:10,arrivalBuffer:5},car:{departureBuffer:0,arrivalBuffer:0},rentalcar:{departureBuffer:30,arrivalBuffer:15},camper:{departureBuffer:15,arrivalBuffer:10},rideshare:{departureBuffer:10,arrivalBuffer:5},taxi:{departureBuffer:5,arrivalBuffer:5},other:{departureBuffer:15,arrivalBuffer:10}}[mode]||{departureBuffer:15,arrivalBuffer:10});
}
function connectionLabel(c){
  return `${MODES[c.mode]||'•'} ${c.number?`${c.number} · `:''}${c.from||'?' } → ${c.to||'?'}`;
}
function transferLabel(x){
  return x.transferType==='to_lodging'?'Transfer zur Unterkunft':x.transferType==='to_airport'?'Transfer zum Abfahrtsort':'Transfer';
}
function pickPhotos(primary,arr){
  const seen=new Set(),out=[];
  const add=u=>{if(!u||seen.has(u))return;seen.add(u);out.push(u)};
  add(primary);
  (arr||[]).forEach(x=>add(x.url||x.full||x.photo));
  return out.slice(0,4);
}
function detailGalleryHtml(photos){
  const arr=(photos||[]).filter(Boolean).slice(0,4);if(!arr.length)return '<div class="detailimageplaceholder">Kein passendes Bild gefunden</div>';
  return `<div class="detailgallery"><a class="detailhero" href="${esc(arr[0])}" target="_blank" rel="noopener"><img src="${esc(arr[0])}" alt=""></a>${arr.length>1?`<div class="detailthumbstrip">${arr.slice(1).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt=""></a>`).join('')}</div>`:''}</div>`;
}
function transferExtraDefault(mode){return ({transit:10,train:10,bus:10,rentalcar:30,rideshare:10,taxi:5,car:0,walk:0}[mode]??10)}
function transferTotalMin(x){return (+x?.durationMin||0)+(+x?.extraBufferMin||0)}
function subtractBlock(windows,from,to){
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return windows;
  const out=[];for(const w of windows){if(to<=w.start||from>=w.end){out.push(w);continue}if(from>w.start)out.push({start:w.start,end:Math.min(from,w.end)});if(to<w.end)out.push({start:Math.max(to,w.start),end:w.end});}return out.filter(w=>w.end>w.start);
}
function fitWindow(windows,at,duration){
  for(const w of windows){const st=Math.max(at,w.start);if(st+duration<=w.end)return{start:st,end:st+duration};}
  const last=windows[windows.length-1];const st=Math.max(at,last?.end||at);return{start:st,end:st+duration,overflow:true};
}
function dayConstraints(v,day){
  const dayStart=timeToMin(day.startTime||state.settings.defaultStart),dayEnd=timeToMin(day.endTime||state.settings.defaultEnd);
  let windows=[{start:dayStart,end:dayEnd}],notes=[];
  const transfers=v.transfers||[];
  for(const c of versionConnections(v)){
    const firstDate=c.departDate||c.arriveDate,lastDate=c.arriveDate||c.departDate;
    if(!firstDate||!lastDate||day.date<firstDate||day.date>lastDate)continue;
    const src=c.sourceRef;
    const trArrival=transfers.find(t=>(t.sourceRef||(t.flightId?`flight:${t.flightId}`:''))===src&&t.transferType!=='to_airport'&&t.date===day.date);
    const trDeparture=transfers.find(t=>(t.sourceRef||(t.flightId?`flight:${t.flightId}`:''))===src&&t.transferType==='to_airport'&&t.date===day.date);
    const dep=timeToMin(c.departTime),arr=timeToMin(c.arriveTime);
    const depExtra=(+c.departureBuffer||0)+transferTotalMin(trDeparture),arrExtra=(+c.arrivalBuffer||0)+transferTotalMin(trArrival);
    const startsBefore=!!c.departDate&&c.departDate<day.date,endsAfter=!!c.arriveDate&&c.arriveDate>day.date;
    let blockStart=null,blockEnd=null;
    if(c.departDate===day.date&&dep!=null)blockStart=Math.max(dayStart,dep-depExtra);
    else if(startsBefore)blockStart=dayStart;
    if(c.arriveDate===day.date&&arr!=null)blockEnd=Math.min(dayEnd,arr+arrExtra);
    else if(endsAfter)blockEnd=dayEnd;
    if(blockStart!=null&&blockEnd==null)blockEnd=dayEnd;
    if(blockStart==null&&blockEnd!=null)blockStart=dayStart;
    if(blockStart!=null&&blockEnd!=null&&blockEnd>blockStart){
      windows=subtractBlock(windows,blockStart,blockEnd);
      const type=(MODES[c.mode]||'Verbindung').replace(/^[^ ]+\s*/,'');
      notes.push(`${type}${c.number?` ${esc(c.number)}`:''}: ${minToTime(blockStart)}–${minToTime(blockEnd)} geblockt`);
    }
  }
  windows=windows.sort((a,b)=>a.start-b.start);
  const available=windows.reduce((sum,w)=>sum+(w.end-w.start),0);
  return{start:windows[0]?.start??dayStart,end:windows[windows.length-1]?.end??dayStart,dayStart,dayEnd,windows,available,notes};
}
function computeDay(v,day) {
  const c=dayConstraints(v,day);let cur=c.windows[0]?.start??c.dayStart,km=0,travel=0,visit=0,overrun=0;const rows=[],conflicts=[];
  for(let i=0;i<day.stops.length;i++) {
    const s=day.stops[i],dur=Math.max(0,+(s.durationWish??s.durationMin??0)),fixed=timeToMin(s.fixedStart);
    const photo=s.photography||{},hasPhotoWindow=!!(photo.windowStart||photo.windowEnd);
    const photoStart=timeToMin(photo.windowStart),photoEnd=timeToMin(photo.windowEnd);
    const validPhotoWindow=photoStart!==null&&photoEnd!==null&&photoEnd>photoStart;
    const windows=hasPhotoWindow&&validPhotoWindow?c.windows.map(w=>({start:Math.max(w.start,photoStart),end:Math.min(w.end,photoEnd)})).filter(w=>w.end>w.start):c.windows;
    const slot=fixed===null?fitWindow(windows,cur,dur):{start:fixed,end:fixed+dur};
    const fits=c.windows.some(w=>slot.start>=w.start&&slot.end<=w.end),overlap=slot.start<cur;
    const photoConflict=hasPhotoWindow&&(!validPhotoWindow||slot.start<photoStart||slot.end>photoEnd);
    const overflow=!!slot.overflow||!fits||overlap||photoConflict;
    if(overflow){conflicts.push(`${s.name}: ${photoConflict?'Aufnahme liegt außerhalb des Fotozeitfensters':overlap?'Reihenfolge oder Fixzeit kollidiert':'kein passendes Zeitfenster'}`);overrun+=Math.max(1,slot.end-c.dayEnd,cur-slot.start,photoConflict&&validPhotoWindow?Math.max(photoStart-slot.start,slot.end-photoEnd):0);}
    rows.push({stop:s,arrival:slot.start,departure:slot.end,overflow});visit+=dur;cur=Math.max(cur,slot.end);
    if(s.routeToNext&&i<day.stops.length-1) {
      const legDur=Math.max(0,+s.routeToNext.durationMin||0),legSlot=fitWindow(c.windows,cur,legDur);travel+=legDur;km+=s.routeToNext.distanceKm||0;cur=legSlot.end;
      if(legSlot.overflow){conflicts.push(`Weiterreise nach ${s.name} passt nicht ins Zeitfenster`);overrun+=Math.max(1,cur-c.dayEnd);}
    }
  }
  const used=visit+travel,buffer=conflicts.length?-Math.max(overrun,used-c.available,1):c.available-used;
  return {...c,rows,finish:cur,km,travel,visit,buffer,used,conflicts};
}
function renderPlanner(){
  const t=activeTrip(),v=activeVersion(),sum=$('#planSummary'),box=$('#daysTimeline');if(!t||!v){sum.innerHTML='';box.innerHTML='<div class="card">Keine Reiseversion ausgewählt.</div>';return;}
  const m=versionMetrics(v),issues=planningIssueCount(v);$('#toggleAllDays').textContent=v.days.every(d=>d.collapsed)?'Tage ausklappen':'Tage einklappen';sum.innerHTML=`<div class="summarybox"><b>${v.days.length}</b><small>Tage</small></div><div class="summarybox"><b>${m.stops}</b><small>Stopps</small></div><div class="summarybox"><b>${Math.round(m.km)}</b><small>km</small></div><div class="summarybox"><b>${durText(m.travel)}</b><small>Fahrt</small></div><div class="summarybox ${issues?'issuesummary':''}"><b>${issues?'⚠ '+issues:'✓ 0'}</b><small>offene Punkte</small></div>`;
  box.innerHTML=v.routeMeta?.source==='wishlist'?`<div class="card autoroutecard"><div class="sectiontitle"><span>Deine Wünsche, als Route</span><span>${(v.routeMeta.includedKeys||[]).length} von ${(v.routeMeta.wishlistKeys||[]).length}</span></div><p class="tiny">Muss-Ziele werden zuerst berücksichtigt. Fahrten, Pausen und Aufenthalte teilen sich das Tagesbudget. Die Reihenfolge folgt deiner gewählten Einstellung.${v.routeMeta.flexDays?` ${v.routeMeta.flexDays} Reisetag${v.routeMeta.flexDays===1?' ist':'e sind'} bewusst noch flexibel.`:''}</p></div>`:'';if(v.routeMeta?.deferred?.length)box.insertAdjacentHTML('beforeend',`<div class="card routeissuescard"><div class="sectiontitle"><span>⚠ Nicht eingeplante Auswahl</span><span>${v.routeMeta.deferred.length}</span></div><p class="tiny">Diese Wünsche bleiben in deiner Auswahl, konnten aber im ersten automatischen Entwurf noch nicht sinnvoll untergebracht werden.</p>${v.routeMeta.deferred.map(x=>`<div class="deferreditem">${x.priority==='must'?'‼ Muss-Ziel: ':''}${esc(x.name)} <small>${esc(x.reason||'offen')}</small></div>`).join('')}</div>`);v.days.forEach((day,di)=>{const comp=computeDay(v,day),el=document.createElement('div');el.className='daycard';const connections=versionConnections(v).filter(f=>f.departDate===day.date||f.arriveDate===day.date),transfers=(v.transfers||[]).filter(x=>x.date===day.date);el.innerHTML=`
    <div class="dayhead"><div class="daydate"><span class="daycolor" style="background:${DAY_COLORS[di%DAY_COLORS.length]}"></span><div><h3>Tag ${di+1} · ${fmtShortDate(day.date)}</h3><p>${comp.windows.length?comp.windows.map(w=>`${minToTime(w.start)}–${minToTime(w.end)}`).join(' / '):'kein freies Zeitfenster'} · ${durText(comp.available)} frei · ${comp.buffer>=0?`${durText(comp.buffer)} Puffer`:`${durText(-comp.buffer)} überplant`}</p></div></div><button data-day-toggle="${day.id}" aria-label="Tag ${di+1} ein- oder ausklappen" aria-expanded="${!day.collapsed}">⌄</button></div>
    <div class="daybody" id="body_${day.id}" ${day.collapsed?'hidden':''}><div class="daytools"><button data-day-time="${day.id}">⏱ Tageszeit</button><button data-day-add="${day.id}">+ Stopp</button><button data-day-accommodation="${day.id}">🛏 Unterkunft</button><button data-city-tour="${day.id}">🏙 Stadttour</button><button data-route-day="${day.id}">↻ Strecken</button></div>
      ${comp.notes.length?`<div class="warnline">🧭 ${comp.notes.join(' · ')}</div>`:''}
      ${accommodationsForDate(v,day.date).length?`<p class="lodgingmeta">🛏 Übernachtung: ${accommodationsForDate(v,day.date).map(x=>esc(x.stop.name)).join(' / ')}</p>`:''}
      ${day.planningNote?`<p class="tiny">${esc(day.planningNote)}</p>`:''}
      ${comp.conflicts.length?`<div class="warnline errorline">⚠ ${comp.conflicts.map(esc).join(' · ')}</div>`:''}
      ${connections.map(c=>connectionHtml(c)).join('')}
      ${transfers.map(x=>transferHtml(x)).join('')}
      <div>${comp.rows.map((r,i)=>stopHtml(day,r,i,comp.rows.length,di)).join('')}</div>
      <div class="${comp.buffer<0?'warnline errorline':'warnline goodline'}">${comp.buffer<0?`⚠ Tag ist um ${durText(-comp.buffer)} überplant.`:`✓ Verbleibender Puffer: ${durText(comp.buffer)}.`} · ${kmText(comp.km)} · ${durText(comp.travel)} Transfer · ${durText(comp.visit)} Stopps</div>
    </div>`;box.appendChild(el);});
}
function connectionHtml(c){const issues=objectOpenIssues(c,'connection');return `<div class="stop flightcard ${issues.length?'hasissues':''}"><div class="stoprow"><div class="stopicon">${esc((MODES[c.mode]||'•').split(' ')[0])}</div><div><h4>${issues.length?'⚠ ':''}${esc(c.number||c.title||'Verbindung')} · ${esc(c.from)} → ${esc(c.to)}</h4><div class="stopmeta">${MODES[c.mode]||esc(c.mode)} · ${fmtShortDate(c.departDate)} ${esc(c.departTime)} → ${fmtShortDate(c.arriveDate)} ${esc(c.arriveTime)}${c.distanceKm?`<br>${kmText(c.distanceKm)} · ${durText(c.durationMin||0)}${c.approx?' · geschätzt':''}`:''}<br>Puffer: ${durText(c.departureBuffer||0)} vor Abfahrt · ${durText(c.arrivalBuffer||0)} nach Ankunft${c.notes?`<br>${esc(c.notes)}`:''}</div>${issueBadgeHtml(issues)}</div><div class="stopactions"><button data-connection-transfer="${esc(c.sourceRef)}" title="Transfer anlegen">↔</button><button ${c.legacyFlight?`data-edit-flight="${c.id}"`:`data-edit-connection="${c.id}"`}>✎</button></div></div></div>`}
function transferHtml(x){const extra=+x.extraBufferMin||0,total=transferTotalMin(x),issues=objectOpenIssues(x,'transfer');return `<div class="stop transfercard ${issues.length?'hasissues':''}"><div class="stoprow"><div class="stopicon">↔</div><div><h4>${issues.length?'⚠ ':''}${esc(transferLabel(x))} · ${esc(x.fromName||'Start')} → ${esc(x.toName||'Ziel')}</h4><div class="stopmeta">${MODES[x.mode]||esc(x.mode)} · ${kmText(x.distanceKm)} · ${durText(total)} gesamt${extra?` (${durText(x.durationMin)} Fahrt + ${durText(extra)} Zusatzpuffer)`:''}${x.approx?' · ca.':''}${x.provider?`<br>${esc(x.provider)}`:''}${x.notes?`<br>${esc(x.notes)}`:''}</div>${issueBadgeHtml(issues)}</div><button data-edit-transfer="${x.id}">✎</button></div></div>`}
function stopHtml(day,r,i,count,di){const s=r.stop,leg=s.routeToNext&&i<count-1?s.routeToNext:null,a=s.accommodation,issues=objectOpenIssues(s,a?'accommodation':'stop');return `<div class="stop ${a?'accommodationcard':''} ${issues.length?'hasissues':''}" data-stop="${s.id}"><div class="stoprow"><div class="stopicon">${STOP_ICONS[s.type]||'•'}</div><div><h4>${issues.length?'⚠ ':''}${r.overflow?'⚠ Zeitkonflikt · ':''}${minToTime(r.arrival)}–${minToTime(r.departure)}${r.departure>=1440?' (+Folgetag)':''} · ${esc(s.name)}</h4><div class="stopmeta"><span class="priority ${s.priority}">${priorityText(s.priority)}</span>${durText(s.durationWish||s.durationMin)}${s.openingHours?` · geöffnet: ${esc(s.openingHours)}`:''}${a?`<span class="lodgingmeta">${esc(a.kind||'Unterkunft')} · Check-in ${fmtShortDate(a.checkInDate)}${a.checkInTime?` ${esc(a.checkInTime)}`:''} · Check-out ${fmtShortDate(a.checkOutDate)}${a.checkOutTime?` ${esc(a.checkOutTime)}`:''}${a.address?`<br>${esc(a.address)}`:''}</span>`:''}${s.notes?`<details class="stop-notes"><summary>Notizen</summary><p>${esc(s.notes)}</p></details>`:''}${photographyHtml(s.photography)}</div>${issueBadgeHtml(issues)}</div><div class="stopactions"><button data-move-stop="${s.id}" data-dir="-1">↑</button><button data-move-stop="${s.id}" data-dir="1">↓</button><button data-edit-stop="${s.id}">✎</button><button data-delete-stop="${s.id}">×</button></div></div></div>${leg?`<div class="leg"><div class="legline"></div><div>${MODES[s.modeToNext]||s.modeToNext} · ${kmText(leg.distanceKm)} · ${durText(leg.durationMin)}${leg.approx?' · ca.':''}</div></div>`:''}`}
function priorityText(p){return p==='must'?'MUSS':p==='high'?'HOCH':p==='optional'?'OPTIONAL':'NORMAL'}
function renderCompare(){
  const t=activeTrip(),a=$('#compareA'),b=$('#compareB');a.innerHTML=b.innerHTML='';if(!t)return;(t.versions||[]).forEach((v,i)=>{for(const sel of[a,b]){const o=document.createElement('option');o.value=v.id;o.textContent=v.name;sel.appendChild(o)}if(i===0)a.value=v.id;if(i===1)b.value=v.id});if(t.versions.length===1)b.value=t.versions[0].id;renderCompareResult();
}
function renderCompareResult(){const t=activeTrip();if(!t)return;const va=t.versions.find(v=>v.id===$('#compareA').value),vb=t.versions.find(v=>v.id===$('#compareB').value),box=$('#compareResult');if(!va||!vb){box.innerHTML='<div class="card">Mindestens eine Version fehlt.</div>';return}const A=versionMetrics(va),B=versionMetrics(vb);const rows=[['Reisetage',A.days,B.days,''],['Stopps',A.stops,B.stops,''],['Pflichtstopps',A.must,B.must,''],['Wildlife-Stopps',A.wild,B.wild,''],['Strecke',Math.round(A.km),Math.round(B.km),' km'],['Transferzeit',Math.round(A.travel),Math.round(B.travel),' min'],['Aufenthaltszeit',Math.round(A.visit),Math.round(B.visit),' min']];const namesA=new Set(va.days.flatMap(d=>d.stops.map(s=>s.name))),namesB=new Set(vb.days.flatMap(d=>d.stops.map(s=>s.name)));const added=[...namesB].filter(x=>!namesA.has(x)),removed=[...namesA].filter(x=>!namesB.has(x));box.innerHTML=`<div class="card"><div class="compgrid"><div class="head">Kennzahl</div><div class="head">${esc(va.name)}</div><div class="head">${esc(vb.name)}</div>${rows.map(r=>`<div>${r[0]}</div><div>${r[1]}${r[3]}</div><div>${r[2]}${r[3]} ${r[2]!==r[1]?`<span class="${r[2]>r[1]?'deltaPlus':'deltaMinus'}">(${r[2]>r[1]?'+':''}${r[2]-r[1]}${r[3]})</span>`:''}</div>`).join('')}</div></div><div class="card"><div class="sectiontitle">Geänderte Stopps</div><p><b>Hinzugefügt:</b> ${added.length?added.map(esc).join(', '):'keine'}</p><p><b>Entfernt:</b> ${removed.length?removed.map(esc).join(', '):'keine'}</p></div>`}
function renderSettings(){const s=state.settings;$('#defaultStart').value=s.defaultStart;$('#defaultEnd').value=s.defaultEnd;$('#arrivalBuffer').value=s.arrivalBuffer;$('#departureBuffer').value=s.departureBuffer;$('#geocodeEndpoint').value=s.geocodeEndpoint||''}

// ------------------------- Modals / editors -------------------------
function newTripModal(){
  const countries=[];
  showModal(`<h2>Die nächste Reise beginnt hier</h2><div class="formgrid one"><label>Reisename<input id="mTripTitle" placeholder="z. B. Von Prag nach Venedig"></label></div>${countryEditorHtml()}<div class="formgrid"><label>Von<input id="mWinStart" type="date"></label><label>Bis<input id="mWinEnd" type="date"></label></div><p id="newTripError" class="form-error" role="alert"></p><div class="actions"><button data-close-modal>Abbrechen</button><button class="primary" id="createTripConfirm">Reise anlegen</button></div>`,()=>{
    bindCountryEditor(countries);
    $('#createTripConfirm').onclick=()=>{const title=$('#mTripTitle').value.trim(),a=$('#mWinStart').value,b=$('#mWinEnd').value,n=daysBetween(a,b);
      const typed=$('#countryEntry').value.trim();if(typed){const c=Discovery.country(typed);if(c&&!countries.some(x=>x.code===c.code))countries.push(c);else if(!c){$('#newTripError').textContent='Bitte das eingegebene Land aus der Liste wählen.';return;}}
      if(!title||!countries.length||!Number.isInteger(n)||n<1||n>366){$('#newTripError').textContent='Reisename, mindestens ein Land und einen Zeitraum von 1–366 Tagen wählen.';return;}
      const trip={id:uid('trip'),title,countries,destination:countries.map(c=>c.name).join(' · '),country:countries[0].name,wishlist:[],interests:['Natur','Landschaft'],dateWindows:[{id:uid('win'),start:a,end:b}],versions:[],selectedVersionId:null};
      const version={id:uid('ver'),name:'Meine Planung',startDate:a,endDate:b,days:Array.from({length:n},(_,i)=>({id:uid('day'),date:addDays(a,i),startTime:state.settings.defaultStart,endTime:state.settings.defaultEnd,stops:[]})),flights:[],connections:[],transfers:[],createdAt:Date.now()};
      trip.versions.push(version);trip.selectedVersionId=version.id;state.trips.push(trip);state.activeTripId=trip.id;resetDiscoverySearch();persistSoon();closeModal();renderAll();switchView('discover');toast('Reise angelegt. Jetzt Wünsche sammeln.');
    };
  });
}
function tripMenuModal(t){
  showModal(`<h2>${esc(t.title)}</h2><p class="lead">Reise und Zeiträume verwalten.</p><div class="formgrid one"><label>Reisename<input id="mEditTripTitle" value="${esc(t.title)}"></label><p class="tiny">${esc(countryLabel(t))}</p><button id="editTripCountriesFromMenu">Reiseländer ändern</button></div><div class="sectiontitle" style="margin-top:14px">Mögliche Zeiträume</div><div id="windowList">${(t.dateWindows||[]).map(w=>`<div class="actions" style="margin-bottom:7px"><input type="date" data-win-start="${w.id}" value="${w.start}" style="flex:1"><input type="date" data-win-end="${w.id}" value="${w.end}" style="flex:1"><button class="danger" data-remove-window="${w.id}">×</button></div>`).join('')}</div><button id="addWindowBtn">+ Zeitraum</button><div class="actions"><button data-close-modal>Schließen</button><button id="saveTripMeta" class="primary">Speichern</button><button id="deleteTrip" class="danger">Reise löschen</button></div>`,()=>{
    $('#editTripCountriesFromMenu').onclick=()=>{closeModal();editTripCountries(t);};
    $('#addWindowBtn').onclick=()=>{t.dateWindows=t.dateWindows||[];t.dateWindows.push({id:uid('win'),start:activeVersion()?.startDate||'',end:activeVersion()?.endDate||''});persistSoon();closeModal();tripMenuModal(t)};
    $$('[data-remove-window]').forEach(b=>b.onclick=()=>{t.dateWindows=t.dateWindows.filter(w=>w.id!==b.dataset.removeWindow);persistSoon();closeModal();tripMenuModal(t)});
    $('#saveTripMeta').onclick=()=>{t.title=$('#mEditTripTitle').value.trim()||t.title;for(const w of t.dateWindows){const a=$(`[data-win-start="${w.id}"]`),b=$(`[data-win-end="${w.id}"]`);if(a&&b){w.start=a.value;w.end=b.value}}persistSoon();closeModal();renderAll()};
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
    $('#manualStopBtn').onclick=()=>{const name=$('#mSearchPlace')?.value||'';closeModal();editStopModal(day,{id:uid('stop'),name,lat:null,lng:null,type:'other',priority:'normal',durationMin:60,durationWish:60,notes:'',openingHours:'',fixedStart:'',images:[],tags:[],wildlife:[],modeToNext:'car',routeToNext:null},true)};
  });
}
function guessStopType(x){const t=`${x.category||''} ${x.type||''}`;if(/hotel|hostel|motel/.test(t))return'hotel';if(/park|nature|forest/.test(t))return'nature';if(/viewpoint/.test(t))return'viewpoint';if(/beach/.test(t))return'beach';if(/restaurant|cafe/.test(t))return'food';if(/city|town/.test(t))return'city';return'sight'}
function editStopModal(day,stop,isNew=false){
  const savedStop=stop;stop=JSON.parse(JSON.stringify(stop));
  const v=activeVersion();showModal(`<h2>${isNew?'Stopp hinzufügen':'Stopp bearbeiten'}</h2><p class="lead">Zeit, Priorität und Planungsdetails festlegen.</p><div class="formgrid"><label>Name<input id="mStopName" value="${esc(stop.name)}"></label><label>Typ<select id="mStopType">${Object.keys(STOP_ICONS).map(k=>`<option value="${k}" ${stop.type===k?'selected':''}>${STOP_ICONS[k]} ${k}</option>`).join('')}</select></label><label>Reisetag<select id="mStopDay">${v.days.map((d,i)=>`<option value="${d.id}" ${d.id===day.id?'selected':''}>Tag ${i+1} · ${fmtShortDate(d.date)}</option>`).join('')}</select></label><label>Priorität<select id="mStopPriority"><option value="must">Muss</option><option value="high">Hoch</option><option value="normal">Normal</option><option value="optional">Optional</option></select></label><label>Mindestdauer (min)<input id="mStopMin" type="number" min="0" value="${stop.durationMin||0}"></label><label>Wunschdauer (min)<input id="mStopWish" type="number" min="0" value="${stop.durationWish||stop.durationMin||0}"></label><label>Fixe Startzeit<input id="mStopFixed" type="time" value="${esc(stop.fixedStart||'')}"></label><label>Weiterreise<select id="mStopMode">${Object.entries(MODES).filter(([k])=>k!=='flight').map(([k,n])=>`<option value="${k}" ${stop.modeToNext===k?'selected':''}>${n}</option>`).join('')}</select></label><label>Breitengrad<input id="mStopLat" type="number" step="any" value="${stop.lat??''}"></label><label>Längengrad<input id="mStopLng" type="number" step="any" value="${stop.lng??''}"></label></div><div class="formgrid one"><label>Öffnungszeiten<input id="mStopOpen" value="${esc(stop.openingHours||'')}" placeholder="z. B. Mo-Su 09:00-18:00"></label><label>Notizen<textarea id="mStopNotes">${esc(stop.notes||'')}</textarea></label></div>${planningReviewHtml(stop,'stop')}<div class="actions"><button data-close-modal>Abbrechen</button><button id="lookupHoursBtn">Öffnungszeiten suchen</button><button id="lookupPhotosBtn">Fotos laden</button><button id="saveStopBtn" class="primary">Speichern</button></div><div id="stopLookupStatus" class="tiny" style="margin-top:8px"></div>`,()=>{
    $('#mStopPriority').value=stop.priority||'normal';
    $('#lookupHoursBtn').onclick=async()=>{const lat=Planner.coordinate($('#mStopLat').value,90),lng=Planner.coordinate($('#mStopLng').value,180);if(lat===null||lng===null){toast('Koordinaten fehlen.');return}$('#stopLookupStatus').textContent='Öffnungszeiten werden gesucht …';try{const h=await Providers.openingHours(lat,lng);if(h){$('#mStopOpen').value=h;$('#stopLookupStatus').textContent=`Gefunden: ${h}`}else $('#stopLookupStatus').textContent='Keine Öffnungszeiten in OpenStreetMap gefunden.'}catch(e){$('#stopLookupStatus').textContent=e.message}};
    $('#lookupPhotosBtn').onclick=async()=>{$('#stopLookupStatus').textContent='Verifizierte Fotos werden gesucht …';try{stop.name=$('#mStopName').value.trim()||stop.name;const kind=stop.taxonId?'wildlife':stop.type==='city'?'city':'poi',detail=await Providers.verifiedPlaceDetails(stop,activeTrip()?.destination||'',kind);stop.images=await Providers.verifiedPhotosForItem(stop,activeTrip()?.destination||'',kind,detail);$('#stopLookupStatus').textContent=stop.images.length?`${stop.images.length} eindeutig zugeordnete(s) Foto(s) gefunden.`:'Kein ausreichend sicher zuordenbares Foto gefunden.'}catch(e){$('#stopLookupStatus').textContent=e.message}};
    $('#saveStopBtn').onclick=()=>{const target=v.days.find(d=>d.id===$('#mStopDay').value);if(!target||+$('#mStopMin').value<0||+$('#mStopWish').value<0){toast('Gültige Tages- und Zeitangaben wählen.');return;}Object.assign(stop,{name:$('#mStopName').value.trim()||'Unbenannter Stopp',type:$('#mStopType').value,priority:$('#mStopPriority').value,durationMin:+$('#mStopMin').value||0,durationWish:+$('#mStopWish').value||0,fixedStart:$('#mStopFixed').value,modeToNext:$('#mStopMode').value,lat:Planner.coordinate($('#mStopLat').value,90),lng:Planner.coordinate($('#mStopLng').value,180),openingHours:$('#mStopOpen').value.trim(),notes:$('#mStopNotes').value.trim(),routeToNext:null});if($('#mPlanningChecked')?.checked){stop.openIssues=[];stop.planningPlaceholder=false;}if(!isNew){Object.assign(savedStop,stop);stop=savedStop;}invalidateStopRoutes(v,stop);if(isNew){target.stops.push(stop)}else if(target.id!==day.id){day.stops=day.stops.filter(s=>s.id!==stop.id);target.stops.push(stop)}persistSoon();closeModal();renderAll();};
  });
}
function dayTimeModal(day){showModal(`<h2>Tageszeit</h2><p class="lead">Die effektive verfügbare Zeit wird zusätzlich durch Langstrecken-Verbindungen und Transfers begrenzt.</p><div class="formgrid"><label>Start<input id="mDayStart" type="time" value="${day.startTime}"></label><label>Ende<input id="mDayEnd" type="time" value="${day.endTime}"></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="saveDayTime" class="primary">Speichern</button></div>`,()=>{$('#saveDayTime').onclick=()=>{const start=timeToMin($('#mDayStart').value),end=timeToMin($('#mDayEnd').value);if(start===null||end===null||end<=start){toast('Das Tagesende muss nach dem Start liegen.');return;}day.startTime=$('#mDayStart').value;day.endTime=$('#mDayEnd').value;persistSoon();closeModal();renderPlanner()}})}
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
async function loadInspiration(kind,force=false) {
  const trip=activeTrip(),version=activeVersion(),country=discoveryCountry();if(!trip||!country)return false;
  const token=trip.id+'|'+country.name,month=Number(version?.startDate?.slice(5,7))||0;
  const spec={cities:{id:'citySuggestions',cache:'cities',key:`cities:v6:${normalizeName(country.name)}`,method:'cities',render:renderCitySuggestions},attractions:{id:'poiSuggestions',cache:'wikidata',key:`attr:v6:${normalizeName(country.name)}`,method:'attractions',render:renderAttractionSuggestions},wildlife:{id:'wildSuggestions',cache:'wildlife',key:`wild:v3:${normalizeName(country.name)}:${month}`,method:'wildlife',render:renderWildlifeSuggestions}}[kind];
  const current=()=>activeTrip()?.id+'|'+discoveryCountry()?.name===token&&(kind!=='wildlife'||activeVersion()?.id===version?.id);
  const box=$('#'+spec.id);box.className='suggestions';box.innerHTML='<div class="empty">Vorschläge werden geladen …</div>';
  if(force)delete state.cache[spec.cache][spec.key];
  try {
    const data=await Providers[spec.method](country.name,month);
    for(const item of data){item.country=country.name;item.countryCode=country.code;}
    persistSoon();if(current())spec.render(data);return true;
  } catch(error){if(current())box.innerHTML=`<div class="empty"><b>Gerade keine Vorschläge verfügbar</b><p>${esc(error.message)}</p><button data-focus-search>Stattdessen selbst suchen</button></div>`;return false;}
}
async function loadCities(force=false){return loadInspiration('cities',force);}
async function loadAttractions(force=false){return loadInspiration('attractions',force);}
async function loadWildlife(force=false){return loadInspiration('wildlife',force);}
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
async function openSuggestionDetail(kind,item,context=''){
  context=item.country||context||discoveryCountry()?.name||'';
  const icon=kind==='wildlife'?'🐾':kind==='city'?'🏙':'★';
  showModal(`<div class="detailtitle"><span class="detailtype">${icon} ${kind==='wildlife'?'Wildlife':kind==='city'?'Stadt':'Sehenswürdigkeit'}</span><h2>${esc(item.name||item.title||'Details')}</h2><p class="lead">Verifizierte Kurzinfo und Bilder werden geladen …</p></div><div id="detailBody"></div><div class="actions detailactions"><button data-close-modal>Schließen</button></div>`);
  const generation=modalGeneration,body=$('#detailBody'),actions=$('#modalContent .detailactions');
  try{
    if(kind==='wildlife'){
      const photos=(await Providers.verifiedPhotosForItem(item,context,'wildlife')).map(x=>x.url),wish=getWishlistEntry('wildlife',item);
      if(generation!==modalGeneration)return;
      body.innerHTML=`${detailGalleryHtml(photos)}<div class="detailfacts"><span>🧬 ${esc(item.scientific||'Art')}</span><span>📍 ${Number(item.count||0).toLocaleString('de-DE')} Beobachtungen</span><span>✓ Bilder exakt über iNaturalist-Taxon-ID ${esc(item.taxonId||'')}</span></div><div class="card detailcard"><h3>Was du wissen solltest</h3><p>Die Art und ihre Bilder werden über dieselbe iNaturalist-Taxon-ID verknüpft. Dadurch werden keine Bilder nur anhand eines ähnlich klingenden Tiernamens zugemischt.</p><p>Die Beobachtungszahl beschreibt die vorhandenen Meldungen im Reiseziel bzw. Reisemonat und ist keine garantierte Sichtungswahrscheinlichkeit.</p></div>`;
      actions.insertAdjacentHTML('beforeend',`<button id="detailWishBtn">${wish?'✓ In Auswahl':'Für Route auswählen'}</button><button id="detailHotspotBtn" class="primary">Hotspots ansehen</button>`);
      $('#detailWishBtn').onclick=()=>{const current=getWishlistEntry('wildlife',item);setWishlistSelection('wildlife',item,!current,current?.priority||'high');closeModal();openSuggestionDetail('wildlife',item,context)};
      $('#detailHotspotBtn').onclick=()=>{closeModal();wildlifeHotspotModal(item)};
      return;
    }
    const detail=await Providers.verifiedPlaceDetails(item,context,kind==='city'?'city':'poi'),photoObjs=await Providers.verifiedPhotosForItem(item,context,kind==='city'?'city':'poi',detail),photos=photoObjs.map(x=>x.url);
    const summary=detail?.summary||item.summary||'';
    const kindLabel=kind==='city'?'Stadt':(item.highlightType||'Sehenswürdigkeit');
    const sourceLabel=detail?.verified?'Wikipedia/Wikidata – eindeutig zugeordnet':(summary?'OpenStreetMap-Beschreibung':'Keine eindeutig zuordenbare Textquelle gefunden');
    if(generation!==modalGeneration)return;
      body.innerHTML=`${detailGalleryHtml(photos)}<div class="detailfacts"><span>📌 ${esc(kindLabel)}</span>${context?`<span>🌍 ${esc(context)}</span>`:''}${Number.isFinite(+item.lat)&&Number.isFinite(+item.lng)?`<span>⌖ ${(+item.lat).toFixed(3)}, ${(+item.lng).toFixed(3)}</span>`:''}<span>✓ ${esc(sourceLabel)}</span></div><div class="card detailcard"><h3>Kurzinfo</h3>${summary?`<p>${esc(summary)}</p>`:`<p>Für diesen Eintrag wurde keine Wikipedia-Seite gefunden, die anhand von OpenStreetMap-Wikipedia/Wikidata-ID oder räumlicher und namentlicher Übereinstimmung sicher zugeordnet werden konnte. Um falsche Inhalte zu vermeiden, wird deshalb keine fremde Kurzbeschreibung angezeigt.</p>`}${detail?.wiki?`<p class="detailsource">Quelle: Wikipedia · <a href="${esc(detail.wiki)}" target="_blank" rel="noopener">Artikel öffnen</a></p>`:''}${photos.length?`<p class="detailsource">Bilder: nur eindeutig zugeordnete Wikipedia-/Wikimedia-Dateien.</p>`:'<p class="detailsource">Kein ausreichend sicher zuordenbares Bild gefunden.</p>'}</div>`;
    if(kind==='city'){
      const wish=getWishlistEntry('city',item);actions.insertAdjacentHTML('beforeend',`<button id="detailCityOpen">Sehenswürdigkeiten ansehen</button><button id="detailWishBtn" class="primary">${wish?'✓ In Auswahl':'Für Route auswählen'}</button>`);
      $('#detailCityOpen').onclick=()=>{closeModal();cityInspirationModal(item)};$('#detailWishBtn').onclick=()=>{const current=getWishlistEntry('city',item);setWishlistSelection('city',item,!current,current?.priority||'high');closeModal();openSuggestionDetail('city',item,context)};
    }else{
      const wish=getWishlistEntry('highlight',item);actions.insertAdjacentHTML('beforeend',`<button id="detailWishBtn" class="primary">${wish?'✓ In Auswahl':'Für Route auswählen'}</button>`);$('#detailWishBtn').onclick=()=>{const current=getWishlistEntry('highlight',item);setWishlistSelection('highlight',item,!current,current?.priority||'high');closeModal();openSuggestionDetail('poi',item,context)};
    }
  }catch(e){body.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}
}
function renderCityPoiResults(city,shown,onAddTour=null){
  const box=$('#cityDetailResults');
  const prev=new Map($$('[data-city-detail-pick]').map(el=>[+el.dataset.cityDetailPick,el.checked]));
  box.innerHTML=shown.map((p,i)=>`<div class="searchitem citypoirow"><div class="citypoihead">${p.photo?`<img class="thumb" src="${esc(p.photo)}" alt="">`:`<div class="thumb ${p.photoChecked?'sightthumb':'imageloading'}">${p.photoChecked?'★':'Bild lädt …'}</div>`}<div><b>${i+1}. ${esc(p.name)}</b><p>${Number.isFinite(+p.distanceKm)?`${(+p.distanceKm).toFixed(1).replace('.',',')} km vom gewählten Stadtzentrum · `:''}${p.summary?esc(p.summary.slice(0,125))+(p.summary.length>125?'…':''):p.detailChecked?'Keine eindeutig zuordenbare Wikipedia-Kurzinfo.':p.openingHours?`Öffnungszeiten: ${esc(p.openingHours)}`:'Kurzinfo wird geprüft …'}</p></div></div><div class="wideactions"><button data-city-poi-detail='${esc(JSON.stringify({kind:'citypoi',...p,cityName:city.name}))}'>Entdecken</button><label><input type="checkbox" data-city-detail-pick="${i}" ${(prev.has(i)?prev.get(i):i<7)?'checked':''}> Tour</label></div></div>`).join('')||'<div class="searchitem">Keine geeigneten Sehenswürdigkeiten gefunden.</div>';
  if(shown.length){box.insertAdjacentHTML('beforeend','<button id="addCityDetailTour" class="primary" style="width:100%;margin-top:10px">Auswahl als Sightseeing-Tour hinzufügen</button>');if(onAddTour)$('#addCityDetailTour').onclick=onAddTour;}
}
async function enrichCityPois(city,shown,onProgress=null){
  for(const p of shown){
    try{
      const detail=await Providers.verifiedPlaceDetails(p,city.name,'poi');
      if(detail?.summary)p.summary=detail.summary;
      if(detail?.wiki)p.wiki=detail.wiki;
      p.detailVerified=!!detail?.verified;
      const pics=await Providers.verifiedPhotosForItem(p,city.name,'poi',detail);
      if(pics[0]?.url){p.photo=pics[0].url;p.photoVerified=true}
    }catch(e){}
    p.detailChecked=true;p.photoChecked=true;
    if(onProgress)onProgress();
  }
  return shown;
}
async function cityInspirationModal(city){
  const v=activeVersion();if(!v)return;showModal(`<h2>🏙 ${esc(city.name)}</h2><p class="lead">Konkrete Sehenswürdigkeiten dieser Stadt auswählen und direkt als Sightseeing-Tour einem Reisetag zuordnen.</p><div class="formgrid"><label>Reisetag<select id="mCityDay">${v.days.map((d,i)=>`<option value="${d.id}">Tag ${i+1} · ${fmtShortDate(d.date)}</option>`).join('')}</select></label><label>Suchradius (m)<input id="mCityDetailRadius" type="number" min="1000" max="12000" step="500" value="5000"></label></div><div class="actions"><button data-close-modal>Schließen</button><button id="openCityOverview">Stadt entdecken</button><button id="loadCityDetails" class="primary">Sehenswürdigkeiten laden</button></div><div id="cityDetailResults" class="city-poi-list"><div class="searchitem">Noch nicht geladen.</div></div>`,()=>{
    $('#openCityOverview').onclick=()=>openSuggestionDetail('city',city,activeTrip()?.destination||'');
    $('#loadCityDetails').onclick=async()=>{const generation=modalGeneration,box=$('#cityDetailResults');box.innerHTML='<div class="searchitem">Stadt-Sehenswürdigkeiten und Bilder werden geladen …</div>';try{
      const pois=await Providers.cityPois(+city.lat,+city.lng,+$('#mCityDetailRadius').value||5000),shown=pois.slice(0,15);
      const addTour=async()=>{const day=v.days.find(d=>d.id===$('#mCityDay').value),picks=$$('[data-city-detail-pick]:checked').map(c=>shown[+c.dataset.cityDetailPick]);if(!day)return;let base=day.stops.find(s=>s.type==='city'&&normalizeName(s.name)===normalizeName(city.name));if(!base){base={id:uid('stop'),name:city.name,lat:+city.lat,lng:+city.lng,type:'city',priority:'high',durationMin:20,durationWish:20,notes:'Stadtbasis für Sightseeing-Tour',openingHours:'',fixedStart:'',images:[],tags:['city-base'],wildlife:[],modeToNext:'walk',routeToNext:null};day.stops.push(base);}const ordered=nearestOrder(base,picks);for(const p of ordered)day.stops.push({id:uid('stop'),name:p.name,lat:p.lat,lng:p.lng,type:p.type,priority:'normal',durationMin:30,durationWish:p.type==='sight'?60:45,notes:'Aus Stadt-Inspiration übernommen',openingHours:p.openingHours||'',fixedStart:'',images:p.photo?[{url:p.photo,full:p.photo,title:p.name,page:''}]:[],tags:['city-tour'],wildlife:[],modeToNext:'walk',routeToNext:null});base.planningPlaceholder=false;base.openIssues=[];persistSoon();closeModal();renderPlanner();await refreshDayRoutes(day,false);toast(`${ordered.length} Sehenswürdigkeiten zu Tag ${v.days.indexOf(day)+1} hinzugefügt.`);};
      if(generation!==modalGeneration)return;renderCityPoiResults(city,shown,addTour);
      await enrichCityPois(city,shown,()=>{if(generation===modalGeneration)renderCityPoiResults(city,shown,addTour);});
      if(generation===modalGeneration)renderCityPoiResults(city,shown,addTour);
    }catch(e){box.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}};
  });
}
function accommodations(v=activeVersion()){return (v?.days||[]).flatMap(d=>d.stops.filter(s=>s.type==='hotel'||s.accommodation).map(s=>({day:d,stop:s})));}
function accommodationsForDate(v,date){return accommodations(v).filter(({stop:s})=>{const a=s.accommodation;if(!a)return true;return (!a.checkInDate||a.checkInDate<=date)&&(!a.checkOutDate||a.checkOutDate>date);});}
function accommodationModal(dayId=null){
  const v=activeVersion();if(!v)return;const day=dayId?v.days.find(d=>d.id===dayId):v.days[0];
  showModal(`<h2>🛏 Unterkunft hinzufügen</h2><p class="lead">Hotel, Airbnb/Ferienwohnung, Hostel oder Campingplatz als feste Basis der Reise speichern.</p><div class="formgrid one"><label>Name oder Adresse<input id="mLodgingSearch" placeholder="z. B. Hotelname oder vollständige Adresse"></label></div><div class="actions"><button id="searchLodgingBtn" class="primary">Suchen</button><button id="manualLodgingBtn">Manuell eintragen</button><button data-close-modal>Abbrechen</button></div><div id="lodgingResults" class="searchresults"></div>`,()=>{
    const openDetails=(place=null)=>{closeModal();const s={id:uid('stop'),name:place?.name||'',lat:place?.lat??null,lng:place?.lng??null,type:'hotel',priority:'high',durationMin:20,durationWish:20,notes:'',openingHours:'',fixedStart:'',images:[],tags:['accommodation'],wildlife:[],modeToNext:'walk',routeToNext:null,accommodation:{kind:'Hotel',checkInDate:day.date,checkInTime:'15:00',checkOutDate:addDays(day.date,1),checkOutTime:'10:00',address:place?.display||'',bookingRef:''}};accommodationDetailsModal(day,s,true);};
    $('#searchLodgingBtn').onclick=async()=>{const q=$('#mLodgingSearch').value.trim();if(!q)return;const box=$('#lodgingResults');box.innerHTML='Suche …';try{const r=await Providers.geocode(q,8);box.innerHTML=r.map((x,i)=>`<div class="searchitem"><b>${esc(x.name)}</b><p>${esc(x.display)}</p><button data-pick-lodging="${i}">Auswählen</button></div>`).join('')||'Nichts gefunden.';$$('[data-pick-lodging]').forEach(b=>b.onclick=()=>openDetails(r[+b.dataset.pickLodging]));}catch(e){box.innerHTML=`<div class="warnline errorline">${esc(e.message)}</div>`}};
    $('#manualLodgingBtn').onclick=()=>openDetails(null);
  });
}
function accommodationDetailsModal(day,stop,isNew){
  const v=activeVersion(),a=stop.accommodation||{};showModal(`<h2>🛏 Unterkunft</h2><p class="lead">Die Unterkunft kann später als Ziel eines Flughafentransfers und als Startpunkt für Stadtrundgänge verwendet werden.</p><div class="formgrid"><label>Name<input id="mLodgingName" value="${esc(stop.name)}"></label><label>Art<select id="mLodgingKind">${['Hotel','Airbnb / Ferienwohnung','Hostel','Campingplatz','Sonstige Unterkunft'].map(x=>`<option ${a.kind===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Anreisetag<select id="mLodgingDay">${v.days.map((d,i)=>`<option value="${d.id}" ${d.id===day.id?'selected':''}>Tag ${i+1} · ${fmtShortDate(d.date)}</option>`).join('')}</select></label><label>Check-in<input id="mCheckInTime" type="time" value="${esc(a.checkInTime||'15:00')}"></label><label>Check-out-Datum<input id="mCheckOutDate" type="date" value="${esc(a.checkOutDate||day.date)}"></label><label>Check-out-Zeit<input id="mCheckOutTime" type="time" value="${esc(a.checkOutTime||'10:00')}"></label><label>Breitengrad<input id="mLodgingLat" type="number" step="any" value="${stop.lat??''}"></label><label>Längengrad<input id="mLodgingLng" type="number" step="any" value="${stop.lng??''}"></label></div><div class="formgrid one"><label>Adresse<input id="mLodgingAddress" value="${esc(a.address||'')}"></label><label>Buchungs-/Reservierungsnummer<input id="mLodgingRef" value="${esc(a.bookingRef||'')}"></label><label>Notizen<textarea id="mLodgingNotes">${esc(stop.notes||'')}</textarea></label></div><div class="actions"><button data-close-modal>Abbrechen</button><button id="saveLodgingBtn" class="primary">Unterkunft speichern</button></div>`,()=>{
    $('#saveLodgingBtn').onclick=()=>{const target=v.days.find(d=>d.id===$('#mLodgingDay').value);if(!$('#mCheckOutDate').value||$('#mCheckOutDate').value<=target.date){toast('Check-out muss nach dem Check-in liegen.');return;}const address=$('#mLodgingAddress').value.trim(),kind=$('#mLodgingKind').value,name=$('#mLodgingName').value.trim()||'Unterkunft';const unresolved=[];if(!address)unresolved.push('Konkrete Unterkunft und Adresse noch offen');if(kind==='Unterkunft offen'||/\(offen\)/i.test(name))unresolved.push('Konkrete Unterkunft auswählen');Object.assign(stop,{name,lat:$('#mLodgingLat').value===''?null:+$('#mLodgingLat').value,lng:$('#mLodgingLng').value===''?null:+$('#mLodgingLng').value,type:'hotel',notes:$('#mLodgingNotes').value.trim(),planningPlaceholder:unresolved.length>0,openIssues:unresolved,accommodation:{kind,checkInDate:target.date,checkInTime:$('#mCheckInTime').value,checkOutDate:$('#mCheckOutDate').value||target.date,checkOutTime:$('#mCheckOutTime').value,address,bookingRef:$('#mLodgingRef').value.trim(),planningPlaceholder:unresolved.length>0}});invalidateStopRoutes(v,stop);if(isNew)target.stops.push(stop);else if(target.id!==day.id){day.stops=day.stops.filter(x=>x.id!==stop.id);target.stops.push(stop)}persistSoon();closeModal();renderAll();toast('Unterkunft gespeichert.');};
  });
}
function airportSearchTerm(to){const text=String(to||'').trim(),m=text.match(/\(([A-Z]{3})\)/i);return `${text.replace(/\([A-Z]{3}\)/i,'').trim()} ${m?m[1]+' ':''}Airport`.trim();}
function terminalSearchTerm(connection,role='arrival'){
  const raw=role==='arrival'?connection.to:connection.from;
  if(connection.mode==='flight')return airportSearchTerm(raw);
  if(connection.mode==='train')return `${raw} Bahnhof`;
  if(connection.mode==='bus')return `${raw} Busbahnhof`;
  if(connection.mode==='ferry')return `${raw} Fährterminal`;
  return raw;
}
function routeModeForConnection(mode){return ['car','rentalcar','camper','rideshare','taxi'].includes(mode)?'car':['train','bus','transit','walk','ferry'].includes(mode)?mode:'car'}
function connectionModal(connection=null){
  const v=activeVersion();if(!v)return;v.connections=v.connections||[];
  const baseMode=connection?.mode||'flight',defs=connectionModeDefaults(baseMode);
  const x=connection?JSON.parse(JSON.stringify(connection)):{id:uid('conn'),mode:baseMode,title:'',operator:'',number:'',reference:'',from:'',to:'',departDate:v.startDate,departTime:'',arriveDate:v.startDate,arriveTime:'',departureBuffer:defs.departureBuffer,arrivalBuffer:defs.arrivalBuffer,notes:'',distanceKm:0,durationMin:0};
  showModal(`<h2>${connection?'Verbindung bearbeiten':'Verbindung hinzufügen'}</h2><p class="lead">Wähle zuerst das Verkehrsmittel. Die Eingabefelder und Standardpuffer passen sich automatisch daran an und können anschließend individuell geändert werden.</p><div class="formgrid"><label>Verkehrsmittel<select id="mConnMode">${['flight','train','bus','rentalcar','car','camper','ferry','transit','other'].map(k=>`<option value="${k}" ${x.mode===k?'selected':''}>${MODES[k]}</option>`).join('')}</select></label><label>Titel / Label<input id="mConnTitle" value="${esc(x.title||'')}" placeholder="z. B. Nachtzug oder Mietwagenetappe"></label></div><div id="connModeHint" class="modehint"></div><div id="connDynamic" class="formgrid"></div><div class="formgrid"><label>Von<input id="mConnFrom" value="${esc(x.from||'')}"></label><label>Nach<input id="mConnTo" value="${esc(x.to||'')}"></label><label>Abfahrtsdatum<input id="mConnDepartDate" type="date" value="${esc(x.departDate||v.startDate)}"></label><label>Abfahrtszeit<input id="mConnDepartTime" type="time" value="${esc(x.departTime||'')}"></label><label>Ankunftsdatum<input id="mConnArriveDate" type="date" value="${esc(x.arriveDate||v.startDate)}"></label><label>Ankunftszeit<input id="mConnArriveTime" type="time" value="${esc(x.arriveTime||'')}"></label><label><span id="mConnDepLabel">Puffer vor Abfahrt</span><input id="mConnDepBuffer" type="number" min="0" value="${x.departureBuffer??defs.departureBuffer}"></label><label><span id="mConnArrLabel">Puffer nach Ankunft</span><input id="mConnArrBuffer" type="number" min="0" value="${x.arrivalBuffer??defs.arrivalBuffer}"></label><label>Reine Verbindungsdauer (min)<input id="mConnDuration" type="number" min="0" value="${x.durationMin||0}"></label><label>Entfernung (km)<input id="mConnDistance" type="number" min="0" step="0.1" value="${x.distanceKm||0}"></label></div><div class="formgrid one"><label>Notizen<textarea id="mConnNotes">${esc(x.notes||'')}</textarea></label></div>${planningReviewHtml(x,'connection')}<div id="connStatus" class="tiny"></div><div class="actions"><button data-close-modal>Abbrechen</button>${connection?'<button id="deleteConnBtn" class="danger">Löschen</button>':''}<button id="calcConnBtn">Route berechnen</button><button id="saveConnBtn" class="primary">Speichern</button></div>`,()=>{
    let firstRender=true;
    const renderDynamic=()=>{
      const mode=$('#mConnMode').value,dyn=$('#connDynamic'),hint=$('#connModeHint'),defs=connectionModeDefaults(mode);
      const configs={
        flight:{hint:'Flug: Puffer vor Abflug für Check-in/Sicherheitskontrolle, nach Ankunft für Gepäck/Immigration.',dep:'Check-in / Sicherheitskontrolle vor Abflug (min)',arr:'Gepäck / Immigration nach Ankunft (min)',fields:`<label>Flugnummer<input id="mConnNumber" value="${esc(x.number||'')}" placeholder="z. B. QF9"></label><label>Airline<input id="mConnOperator" value="${esc(x.operator||'')}" placeholder="z. B. Qantas"></label><label>Buchungsreferenz<input id="mConnReference" value="${esc(x.reference||'')}"></label><div class="wideactions"><button id="lookupConnFlightBtn">Route per Flugnummer erkennen</button></div>`},
        train:{hint:'Zug: kurzer Bahnhofspuffer vor Abfahrt sowie Ausstiegs-/Umstiegspuffer nach Ankunft.',dep:'Bahnhofspuffer vor Abfahrt (min)',arr:'Ausstieg / Umstieg nach Ankunft (min)',fields:`<label>Zugnummer<input id="mConnNumber" value="${esc(x.number||'')}" placeholder="z. B. ICE 621"></label><label>Betreiber<input id="mConnOperator" value="${esc(x.operator||'')}" placeholder="z. B. DB / Trenitalia"></label><label>Buchungsreferenz<input id="mConnReference" value="${esc(x.reference||'')}"></label>`},
        bus:{hint:'Fernbus: Terminal-/Boardingpuffer und ein kleiner Puffer nach Ankunft.',dep:'Terminal / Boarding vor Abfahrt (min)',arr:'Ausstieg / Gepäck nach Ankunft (min)',fields:`<label>Linie / Busnummer<input id="mConnNumber" value="${esc(x.number||'')}" placeholder="z. B. FlixBus 081"></label><label>Anbieter<input id="mConnOperator" value="${esc(x.operator||'')}" placeholder="z. B. FlixBus"></label><label>Buchungsreferenz<input id="mConnReference" value="${esc(x.reference||'')}"></label>`},
        rentalcar:{hint:'Mietwagen: Zeit vor Abfahrt kann für Fahrzeugübernahme/Papierkram genutzt werden; nach Ankunft für Parken oder Rückgabe.',dep:'Fahrzeugübernahme vor Abfahrt (min)',arr:'Parken / Rückgabe nach Ankunft (min)',fields:`<label>Vermieter<input id="mConnOperator" value="${esc(x.operator||'')}" placeholder="z. B. Sixt"></label><label>Reservierungsnummer<input id="mConnReference" value="${esc(x.reference||'')}"></label>`},
        car:{hint:'Auto: keine Buchungsdaten nötig. Puffer können für Vorbereitung, Tanken oder Parkplatzsuche verwendet werden.',dep:'Vorbereitung vor Abfahrt (min)',arr:'Parken / Tanken nach Ankunft (min)',fields:''},
        camper:{hint:'Camper: wie Auto, zusätzlich kann Zeit für Fahrzeug-/Campinglogistik eingeplant werden.',dep:'Vorbereitung vor Abfahrt (min)',arr:'Parken / Versorgung nach Ankunft (min)',fields:`<label>Fahrzeug / Vermieter<input id="mConnOperator" value="${esc(x.operator||'')}"></label><label>Reservierungsnummer<input id="mConnReference" value="${esc(x.reference||'')}"></label>`},
        ferry:{hint:'Fähre: Check-in/Boarding kann deutlich vor der Abfahrt erforderlich sein; danach Ausschiffung einplanen.',dep:'Check-in / Boarding vor Abfahrt (min)',arr:'Ausschiffung nach Ankunft (min)',fields:`<label>Fähre / Verbindung<input id="mConnNumber" value="${esc(x.number||'')}"></label><label>Reederei<input id="mConnOperator" value="${esc(x.operator||'')}"></label><label>Buchungsreferenz<input id="mConnReference" value="${esc(x.reference||'')}"></label>`},
        transit:{hint:'ÖPNV: für lokale oder regionale Verbindungen; Zeitwerte können als Näherung eingetragen werden.',dep:'Warte-/Umstiegspuffer vor Abfahrt (min)',arr:'Ausstieg / Umstieg nach Ankunft (min)',fields:`<label>Linie<input id="mConnNumber" value="${esc(x.number||'')}"></label><label>Betreiber<input id="mConnOperator" value="${esc(x.operator||'')}"></label>`},
        other:{hint:'Sonstige Verbindung: frei beschreibbar mit individuell einstellbaren Puffern.',dep:'Puffer vor Abfahrt (min)',arr:'Puffer nach Ankunft (min)',fields:`<label>Referenz / Nummer<input id="mConnNumber" value="${esc(x.number||'')}"></label><label>Anbieter<input id="mConnOperator" value="${esc(x.operator||'')}"></label><label>Buchungsreferenz<input id="mConnReference" value="${esc(x.reference||'')}"></label>`}
      };
      const cfg=configs[mode]||configs.other;hint.textContent=cfg.hint;dyn.innerHTML=cfg.fields;$('#mConnDepLabel').textContent=cfg.dep;$('#mConnArrLabel').textContent=cfg.arr;
      if(!connection&&!firstRender){$('#mConnDepBuffer').value=defs.departureBuffer;$('#mConnArrBuffer').value=defs.arrivalBuffer;}
      firstRender=false;
      $('#lookupConnFlightBtn')?.addEventListener('click',async()=>{const n=$('#mConnNumber').value.trim();if(!n)return;$('#connStatus').textContent='Flugroute wird gesucht …';try{const r=await Providers.flightRoute(n),route=r?.origin&&r?.destination?r:null;if(route){const orig=route.origin?.iata_code||route.origin?.icao_code||route.origin?.name||'',dest=route.destination?.iata_code||route.destination?.icao_code||route.destination?.name||'';if(orig)$('#mConnFrom').value=route.origin?.municipality?`${route.origin.municipality} (${orig})`:orig;if(dest)$('#mConnTo').value=route.destination?.municipality?`${route.destination.municipality} (${dest})`:dest;$('#connStatus').textContent='Route erkannt. Konkrete Zeiten bitte anhand deiner Buchung ergänzen.';}else $('#connStatus').textContent='Keine eindeutige Route gefunden.';}catch(e){$('#connStatus').textContent=e.message}});
    };
    renderDynamic();
    $('#mConnMode').onchange=()=>{x.number=$('#mConnNumber')?.value.trim()||x.number||'';x.operator=$('#mConnOperator')?.value.trim()||x.operator||'';x.reference=$('#mConnReference')?.value.trim()||x.reference||'';x.mode=$('#mConnMode').value;x.geometry=null;x.approx=true;$('#mPlanningChecked').checked=false;renderDynamic();};
    $('#calcConnBtn').onclick=async()=>{const from=$('#mConnFrom').value.trim(),to=$('#mConnTo').value.trim(),mode=$('#mConnMode').value;if(!from||!to){toast('Bitte Start und Ziel eintragen.');return}const status=$('#connStatus');status.textContent='Route wird gesucht …';try{if(mode==='flight'){const g1=await Providers.geocode(airportSearchTerm(from),3),g2=await Providers.geocode(airportSearchTerm(to),3);if(!g1[0]||!g2[0])throw new Error('Flughafen konnte nicht gefunden werden.');const r=await Providers.route({lat:g1[0].lat,lng:g1[0].lng},{lat:g2[0].lat,lng:g2[0].lng},'flight');$('#mConnDistance').value=(r.distanceKm||0).toFixed(1);status.textContent=`Luftlinie: ${kmText(r.distanceKm)}`;return}const g1=await Providers.geocode(from,3),g2=await Providers.geocode(to,3);if(!g1[0]||!g2[0])throw new Error('Start oder Ziel konnte nicht gefunden werden.');const routeMode=routeModeForConnection(mode),r=await Providers.route({lat:g1[0].lat,lng:g1[0].lng},{lat:g2[0].lat,lng:g2[0].lng},routeMode);if(r.unreachable)throw new Error('Keine Straßenroute gefunden.');$('#mConnDuration').value=Math.round(r.durationMin||0);$('#mConnDistance').value=(r.distanceKm||0).toFixed(1);status.textContent=`Route: ${kmText(r.distanceKm)} · ${durText(r.durationMin)}${r.approx?' (ca.)':''}`;}catch(e){status.textContent=e.message}};
    $('#saveConnBtn').onclick=()=>{const mode=$('#mConnMode').value,number=$('#mConnNumber')?.value.trim()||'',operator=$('#mConnOperator')?.value.trim()||'',from=$('#mConnFrom').value.trim(),to=$('#mConnTo').value.trim(),departTime=$('#mConnDepartTime').value,arriveTime=$('#mConnArriveTime').value,unresolved=[];if(mode==='other')unresolved.push('Verkehrsmittel noch festlegen');if(!from||/offen/i.test(from))unresolved.push('Startort noch konkretisieren');if(!to||/offen/i.test(to))unresolved.push('Zielort noch konkretisieren');if(!departTime||!arriveTime)unresolved.push('Abfahrts- und Ankunftszeit noch ergänzen');if(['flight','train','bus','ferry'].includes(mode)&&!number)unresolved.push('Verbindungsnummer noch offen');if($('#mConnArriveDate').value<$('#mConnDepartDate').value){toast('Ankunftsdatum vor Abfahrtsdatum: Reise-/Zeitzonenangaben prüfen.');return;}Object.assign(x,{mode,title:$('#mConnTitle').value.trim(),number,operator,reference:$('#mConnReference')?.value.trim()||'',from,to,departDate:$('#mConnDepartDate').value,departTime,arriveDate:$('#mConnArriveDate').value,arriveTime,departureBuffer:+$('#mConnDepBuffer').value||0,arrivalBuffer:+$('#mConnArrBuffer').value||0,durationMin:+$('#mConnDuration').value||0,distanceKm:+$('#mConnDistance').value||0,notes:$('#mConnNotes').value.trim(),planningPlaceholder:unresolved.length>0,timeEstimated:!$('#mPlanningChecked')?.checked,openIssues:unresolved});syncConnectionTransfers(v,x,connection);if(connection)Object.assign(connection,x);else v.connections.push(x);persistSoon();closeModal();renderPlanner();toast('Verbindung gespeichert.');};
    if(connection)$('#deleteConnBtn').onclick=()=>{v.connections=v.connections.filter(z=>z.id!==x.id);v.transfers=v.transfers.filter(z=>z.sourceRef!==`connection:${x.id}`);persistSoon();closeModal();renderPlanner()};
  });
}
async function transferModal(transfer=null,preselectedSourceRef=null){
  const v=activeVersion();if(!v)return;v.transfers=v.transfers||[];const sources=versionConnections(v).filter(c=>c.arriveDate||c.departDate),lodgings=accommodations(v).length?accommodations(v):v.days.flatMap(day=>day.stops.map(stop=>({day,stop})));if(!sources.length){toast('Füge zuerst mindestens eine Verbindung mit Zeiten hinzu.');return}if(!lodgings.length){toast('Füge zuerst eine Unterkunft hinzu.');accommodationModal();return}
  const x=transfer?JSON.parse(JSON.stringify(transfer)):{id:uid('transfer'),sourceRef:preselectedSourceRef||sources[0].sourceRef,toStopId:lodgings[0].stop.id,transferType:'to_lodging',date:'',fromName:'',fromLat:null,fromLng:null,toName:'',toLat:null,toLng:null,mode:'transit',provider:'',reference:'',extraBufferMin:10,distanceKm:0,durationMin:0,approx:true,notes:''};
  const source=sources.find(f=>f.sourceRef===(x.sourceRef||''))||sources[0];if(!x.date)x.date=source.arriveDate||source.departDate;
  showModal(`<h2>↔ Transfer</h2><p class="lead">Transfer ist ein eigener Baustein zwischen Verbindung und Unterkunft. Verkehrsmittel, Route und Zusatzzeiten lassen sich unabhängig einstellen.</p><div class="formgrid"><label>Verbindung<select id="mTransferSource">${sources.map(f=>`<option value="${esc(f.sourceRef)}" ${f.sourceRef===source.sourceRef?'selected':''}>${esc(connectionLabel(f))} · ${fmtShortDate(f.arriveDate||f.departDate)}</option>`).join('')}</select></label><label>Transfer-Typ<select id="mTransferType"><option value="to_lodging" ${x.transferType==='to_lodging'?'selected':''}>Ankunft → Unterkunft</option><option value="to_airport" ${x.transferType==='to_airport'?'selected':''}>Unterkunft → Abfahrtsort</option></select></label><label>Unterkunft / Aufenthaltsort<select id="mTransferLodging">${lodgings.map(({stop:s})=>`<option value="${s.id}" ${s.id===x.toStopId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Verkehrsmittel<select id="mTransferMode">${['transit','train','bus','rentalcar','rideshare','taxi','car','walk'].map(k=>`<option value="${k}" ${x.mode===k?'selected':''}>${MODES[k]}</option>`).join('')}</select></label></div><div id="transferDynamic" class="formgrid"></div><div class="formgrid"><label>Transfer von<input id="mTransferFrom" value="${esc(x.fromName||'')}"></label><label>Transfer nach<input id="mTransferTo" value="${esc(x.toName||'')}"></label></div><div class="formgrid"><label>Reine Fahr-/Transferzeit (min)<input id="mTransferDuration" type="number" min="0" value="${x.durationMin||0}"></label><label>Zusätzlicher Puffer (min)<input id="mTransferExtra" type="number" min="0" value="${x.extraBufferMin??transferExtraDefault(x.mode)}"></label><label>Entfernung (km)<input id="mTransferDistance" type="number" min="0" step="0.1" value="${x.distanceKm||0}"></label><label>Datum<input id="mTransferDate" type="date" value="${esc(x.date||source.arriveDate||source.departDate)}"></label></div><div class="formgrid one"><label>Notizen<textarea id="mTransferNotes">${esc(x.notes||'')}</textarea></label></div><div id="transferModeHint" class="modehint"></div>${planningReviewHtml(x,'transfer')}<div id="transferStatus" class="tiny"></div><div class="actions"><button data-close-modal>Abbrechen</button>${transfer?'<button id="deleteTransferBtn" class="danger">Löschen</button>':''}<button id="calcTransferBtn">Route berechnen</button><button id="saveTransferBtn" class="primary">Speichern</button></div>`,()=>{
    let first=true;
    const renderTransferDynamic=()=>{const mode=$('#mTransferMode').value,dyn=$('#transferDynamic'),hint=$('#transferModeHint');const cfg={transit:['Linie / Verbindung','Betreiber','Warte- und Umstiegszeit zusätzlich zur berechneten Fahrzeit.'],train:['Zug / Airport Express','Betreiber','Zusatzpuffer z. B. für Bahnsteig, Ticket oder Umstieg.'],bus:['Linie / Bus','Anbieter','Zusatzpuffer z. B. für Haltestellensuche und Boarding.'],rentalcar:['Reservierungsnummer','Vermieter','Zusatzpuffer für Schalter, Vertrag und Fahrzeugübernahme.'],rideshare:['Buchung / Referenz','Anbieter','Zusatzpuffer für Abholung und Wartezeit.'],taxi:['Referenz','Taxi-Anbieter','Kleiner Wartepuffer vor der Abfahrt.'],car:['Fahrzeug / Notiz','', 'Privater Pkw: Zusatzpuffer optional für Parken oder Gepäck.'],walk:['','', 'Fußweg: normalerweise kein Zusatzpuffer nötig.']}[mode]||['Referenz','Anbieter',''];hint.textContent=cfg[2];dyn.innerHTML=`${cfg[0]?`<label>${cfg[0]}<input id="mTransferRef" value="${esc(x.reference||'')}"></label>`:''}${cfg[1]?`<label>${cfg[1]}<input id="mTransferProvider" value="${esc(x.provider||'')}"></label>`:''}`;if(!transfer&&!first)$('#mTransferExtra').value=transferExtraDefault(mode);first=false;};
    renderTransferDynamic();
    const syncDate=()=>{const f=sources.find(z=>z.sourceRef===$('#mTransferSource').value),type=$('#mTransferType').value;if(f)$('#mTransferDate').value=(type==='to_airport'?(f.departDate||f.arriveDate):(f.arriveDate||f.departDate))||''};
    $('#mTransferSource').onchange=syncDate;$('#mTransferType').onchange=syncDate;$('#mTransferMode').onchange=()=>{x.reference=$('#mTransferRef')?.value.trim()||x.reference||'';x.provider=$('#mTransferProvider')?.value.trim()||x.provider||'';x.mode=$('#mTransferMode').value;renderTransferDynamic();};
    $('#calcTransferBtn').onclick=async()=>{const f=sources.find(z=>z.sourceRef===$('#mTransferSource').value),lod=lodgings.find(z=>z.stop.id===$('#mTransferLodging').value)?.stop;if(!f||!lod||!Number.isFinite(lod.lat)||!Number.isFinite(lod.lng)){toast('Verbindung oder Unterkunft mit Koordinaten fehlt.');return}const status=$('#transferStatus');status.textContent='Transfer wird berechnet …';try{const type=$('#mTransferType').value,mode=$('#mTransferMode').value,query=terminalSearchTerm(f,type==='to_airport'?'departure':'arrival'),g=await Providers.geocode(query,5),terminal=g[0];if(!terminal)throw new Error('Start- oder Zielterminal konnte nicht gefunden werden.');let from,to;if(type==='to_airport'){from={lat:lod.lat,lng:lod.lng};to={lat:terminal.lat,lng:terminal.lng};x.fromName=lod.name;x.toName=terminal.name||f.from;}else{from={lat:terminal.lat,lng:terminal.lng};to={lat:lod.lat,lng:lod.lng};x.fromName=terminal.name||f.to;x.toName=lod.name;}x.fromLat=from.lat;x.fromLng=from.lng;x.toLat=to.lat;x.toLng=to.lng;$('#mTransferFrom').value=x.fromName;$('#mTransferTo').value=x.toName;const routeMode=routeModeForConnection(mode),r=await Providers.route(from,to,routeMode);if(r.unreachable)throw new Error('Keine Straßenroute gefunden.');x.approx=(routeMode!=='car')||r.approx;$('#mTransferDuration').value=Math.round(r.durationMin||0);$('#mTransferDistance').value=(r.distanceKm||0).toFixed(1);status.textContent=`Route: ${kmText(r.distanceKm)} · ${durText(r.durationMin)} + ${durText(+$('#mTransferExtra').value||0)} Puffer = ${durText((r.durationMin||0)+(+$('#mTransferExtra').value||0))}`;}catch(e){status.textContent=e.message}};
    $('#saveTransferBtn').onclick=()=>{const f=sources.find(z=>z.sourceRef===$('#mTransferSource').value),lod=lodgings.find(z=>z.stop.id===$('#mTransferLodging').value)?.stop;if(!f||!lod){toast('Verbindung und Unterkunft auswählen.');return}if(x.sourceRef!==f.sourceRef||x.toStopId!==lod.id||x.transferType!==$('#mTransferType').value){x.fromLat=null;x.fromLng=null;x.toLat=null;x.toLng=null;x.approx=true;}const type=$('#mTransferType').value,duration=+$('#mTransferDuration').value||0,unresolved=[];if(!duration)unresolved.push('Transferdauer noch festlegen');Object.assign(x,{fromName:$('#mTransferFrom').value.trim(),toName:$('#mTransferTo').value.trim(),sourceRef:f.sourceRef,flightId:f.legacyFlight?f.id:'',toStopId:lod.id,transferType:type,date:$('#mTransferDate').value||(type==='to_airport'?(f.departDate||f.arriveDate):(f.arriveDate||f.departDate)),mode:$('#mTransferMode').value,provider:$('#mTransferProvider')?.value.trim()||'',reference:$('#mTransferRef')?.value.trim()||'',durationMin:duration,extraBufferMin:+$('#mTransferExtra').value||0,distanceKm:+$('#mTransferDistance').value||0,notes:$('#mTransferNotes').value.trim(),planningPlaceholder:unresolved.length>0,timeEstimated:!$('#mPlanningChecked')?.checked,openIssues:unresolved});if(!x.fromName)x.fromName=type==='to_airport'?lod.name:(f.to||'Terminal');if(!x.toName)x.toName=type==='to_airport'?(f.from||'Terminal'):lod.name;if(transfer)Object.assign(transfer,x);else v.transfers.push(x);persistSoon();closeModal();renderPlanner();toast('Transfer gespeichert.');};
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
  for(let i=0;i<day.stops.length-1;i++){const a=day.stops[i],b=day.stops[i+1];if(a.wishlistKey&&b.wishlistKey&&(activeVersion()?.connections||[]).some(c=>c.fromWishlistKey===a.wishlistKey&&c.toWishlistKey===b.wishlistKey&&c.departDate===day.date)){a.routeToNext=null;continue;}if(!Number.isFinite(a.lat)||!Number.isFinite(a.lng)||!Number.isFinite(b.lat)||!Number.isFinite(b.lng)){a.routeToNext=null;continue}try{const route=await Providers.route(a,b,a.modeToNext||'car');if(route.unreachable)throw new Error('Keine Straßenroute gefunden; Verbindung oder Fähre manuell ergänzen.');a.routeToNext=route;renderPlanner();}catch(e){a.routeToNext=null}}
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
  if(mapVersionId!==v.id){mapVersionId=v.id;mapDayVisible=new Set(v.days.map((_,i)=>i));map._hasFitOnce=false;}
  const chips=$('#mapDayChips');chips.innerHTML='';v.days.forEach((d,i)=>{const b=document.createElement('button');b.textContent=`Tag ${i+1}`;b.style.borderColor=DAY_COLORS[i%DAY_COLORS.length];b.style.color=DAY_COLORS[i%DAY_COLORS.length];if(!mapDayVisible.has(i))b.classList.add('off');b.onclick=()=>{mapDayVisible.has(i)?mapDayVisible.delete(i):mapDayVisible.add(i);renderMap()};chips.appendChild(b)});
  mapStopLayer.clearLayers();mapRouteLayer.clearLayers();const bounds=[];
  v.days.forEach((d,di)=>{if(!mapDayVisible.has(di))return;const color=DAY_COLORS[di%DAY_COLORS.length];d.stops.forEach((s,i)=>{if(!Number.isFinite(s.lat)||!Number.isFinite(s.lng))return;bounds.push([s.lat,s.lng]);const marker=L.circleMarker([s.lat,s.lng],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(mapStopLayer);marker.bindTooltip(`Tag ${di+1}: ${s.name}`);marker.bindPopup(mapPopup(s,di));marker.on('popupopen',async()=>{if(!(s.images||[]).length&&!s.photoChecked){try{const kind=s.taxonId?'wildlife':s.type==='city'?'city':'poi',detail=await Providers.verifiedPlaceDetails(s,activeTrip()?.destination||'',kind);s.images=await Providers.verifiedPhotosForItem(s,activeTrip()?.destination||'',kind,detail);s.photoChecked=true;persistSoon();marker.setPopupContent(mapPopup(s,di));}catch(e){s.photoChecked=true;marker.setPopupContent(mapPopup(s,di));}}});if(i<d.stops.length-1){const r=s.routeToNext;if(r?.geometry?.length){L.polyline(r.geometry,{color,weight:5,opacity:.78}).addTo(mapRouteLayer);}else{const n=d.stops[i+1];if(Number.isFinite(n.lat)&&Number.isFinite(n.lng))L.polyline([[s.lat,s.lng],[n.lat,n.lng]],{color,weight:3,opacity:.45,dashArray:'5 7'}).addTo(mapRouteLayer);}}});for(const tr of (v.transfers||[]).filter(x=>x.date===d.date)){if(Number.isFinite(tr.fromLat)&&Number.isFinite(tr.fromLng)&&Number.isFinite(tr.toLat)&&Number.isFinite(tr.toLng)){bounds.push([tr.fromLat,tr.fromLng],[tr.toLat,tr.toLng]);L.polyline([[tr.fromLat,tr.fromLng],[tr.toLat,tr.toLng]],{color,weight:4,opacity:.75,dashArray:'8 7'}).bindTooltip(`Tag ${di+1}: ${transferLabel(tr)} · ${MODES[tr.mode]||tr.mode}`).addTo(mapRouteLayer);}}});
  for(const c of v.connections||[]){const di=v.days.findIndex(d=>d.date===c.departDate);if(!mapDayVisible.has(di))continue;const points=c.geometry?.length?c.geometry:Planner.hasLocation({lat:c.fromLat,lng:c.fromLng})&&Planner.hasLocation({lat:c.toLat,lng:c.toLng})?[[c.fromLat,c.fromLng],[c.toLat,c.toLng]]:null;if(points)L.polyline(points,{color:DAY_COLORS[di%DAY_COLORS.length],weight:4,opacity:.7,dashArray:c.approx||c.mode==='flight'?'7 7':null}).bindTooltip(connectionLabel(c)).addTo(mapRouteLayer);}
  if(bounds.length){if(!map._hasFitOnce){map.fitBounds(bounds,{padding:[30,30]});map._hasFitOnce=true}}
  setTimeout(()=>map.invalidateSize(),80);
}
function mapPopup(s,di){return `<div class="mappopup"><h3><span style="color:${DAY_COLORS[di%DAY_COLORS.length]}">Tag ${di+1}</span> · ${esc(s.name)}</h3><p>${STOP_ICONS[s.type]||'•'} ${priorityText(s.priority)} · ${durText(s.durationWish||s.durationMin)}</p>${s.openingHours?`<p><b>Öffnungszeiten:</b> ${esc(s.openingHours)}</p>`:''}${s.notes?`<p>${esc(s.notes)}</p>`:''}${(s.images||[]).length?`<div class="popphotos">${s.images.slice(0,3).map(x=>`<a href="${esc(x.page||x.full||x.url)}" target="_blank"><img src="${esc(x.url)}"></a>`).join('')}</div>`:(s.photoChecked?'<p>Kein eindeutig zugeordnetes Bild verfügbar.</p>':'<p>Bilder werden beim ersten Öffnen gesucht …</p>')}</div>`}
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
function switchView(name){if(name!==currentView&&typeof window.scrollTo==='function')window.scrollTo(0,0);currentView=name;$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.bottomnav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='discover'){renderDiscover();renderSearchResults();}if(name==='wishlist')renderWishlistSummary();if(name==='map')setTimeout(renderMap,20)}
function locateStop(id){const v=activeVersion();if(!v)return null;for(const d of v.days){const s=d.stops.find(x=>x.id===id);if(s)return{day:d,stop:s}}return null}
function bindEvents(){
  bindDiscoveryEvents();
  document.addEventListener('error',event=>{const img=event.target;if(img?.tagName==='IMG'){const fallback=document.createElement('span');fallback.className=img.className+' imagefallback';fallback.textContent='Bild nicht verfügbar';img.replaceWith(fallback);}},true);
  $$('.bottomnav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $('#tripSelect').onchange=e=>{state.activeTripId=e.target.value;resetDiscoverySearch();ensureActive();discoverVisible.cities=discoverVisible.attractions=discoverVisible.wildlife=5;mapDayVisible.clear();persistSoon();renderAll()};
  $('#versionSelect').onchange=e=>{const t=activeTrip();if(t)t.selectedVersionId=e.target.value;mapDayVisible.clear();persistSoon();renderAll()};
  $('#newTripBtn').onclick=newTripModal; $('#refreshBtn').onclick=refreshAllRoutes; $('#discoverBtn').onclick=discoverAll;$('#reloadCitiesBtn').onclick=()=>loadCities(true);$('#reloadPoiBtn').onclick=()=>loadAttractions(true);$('#reloadWildBtn').onclick=()=>loadWildlife(true);$('#autoRouteBtn').onclick=autoRouteModal;$('#clearWishlistBtn').onclick=()=>{const t=activeTrip();if(t?.wishlist?.length&&confirm('Gesamte Auswahl für die Routenplanung leeren?')){t.wishlist=[];persistSoon();renderDiscover()}};$('#addStopBtn').onclick=()=>addStopModal();$('#addConnectionBtn').onclick=()=>connectionModal();$('#addAccommodationBtn').onclick=()=>accommodationModal();$('#addTransferBtn').onclick=()=>transferModal();$('#fitMapBtn').onclick=fitMap;$('#mapFilterBtn').onclick=mapFilterModal;
  $('#compareA').onchange=renderCompareResult;$('#compareB').onchange=renderCompareResult;
  $('#saveSettingsBtn').onclick=()=>{try{const a=$('#defaultStart').value,b=$('#defaultEnd').value;if(Planner.minutes(a)===null||Planner.minutes(b)===null||Planner.minutes(b)<=Planner.minutes(a))throw new Error('Gültigen Tagesstart und ein späteres Tagesende wählen.');const geocodeEndpoint=Discovery.searchEndpoint($('#geocodeEndpoint').value);state.settings={...state.settings,geocodeEndpoint,defaultStart:a,defaultEnd:b,arrivalBuffer:Math.max(0,+$('#arrivalBuffer').value||0),departureBuffer:Math.max(0,+$('#departureBuffer').value||0)};persistSoon();toast('Einstellungen gespeichert.');}catch(error){toast(error.message);}};
  $('#checkUpdateBtn').onclick=()=>checkForUpdates({silent:false}); $('#installUpdateBtn').onclick=installAvailableUpdate;
  $('#exportBtn').onclick=()=>{const t=activeTrip();const name=`Unser_Reiseplaner_${(t?.title||'Backup').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g,'_')}.json`;const raw=JSON.stringify(state,null,2);if(window.AndroidBridge?.exportBackup){const msg=AndroidBridge.exportBackup(raw,name);toast(msg)}else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.download=name;a.click();URL.revokeObjectURL(a.href)}};
  $('#importFile').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=normalizeLoadedState(JSON.parse(r.result));if(confirm('Aktuelle lokale Daten durch dieses Backup ersetzen?')){state=x;state.settings={...defaultSettings(),...(state.settings||{})};persistSoon();renderAll();toast('Backup importiert.')}}catch(err){toast('Backup konnte nicht gelesen werden.')}};r.readAsText(f)};
  $('#modal').addEventListener('click',e=>{if(e.target.dataset.close==='1'||e.target.hasAttribute('data-close-modal'))closeModal()});
  document.addEventListener('click',e=>{
    const d=(e.target.closest('button')||e.target).dataset;
    if(d.openTrip){state.activeTripId=d.openTrip;resetDiscoverySearch();persistSoon();renderAll();switchView('plan')}
    if(d.tripMenu){const t=state.trips.find(x=>x.id===d.tripMenu);if(t)tripMenuModal(t)}
    if(d.newVersion){const t=state.trips.find(x=>x.id===d.newVersion);state.activeTripId=t.id;const v=t.versions.find(x=>x.id===t.selectedVersionId)||t.versions[0],n=prompt('Name der neuen Version:',`${v.name} – Variante`);if(n){const c=cloneVersion(v,n);t.versions.push(c);t.selectedVersionId=c.id;persistSoon();renderAll()}}
    if(d.dayToggle){const day=activeVersion()?.days.find(x=>x.id===d.dayToggle),body=$(`#body_${d.dayToggle}`);if(day&&body){day.collapsed=!day.collapsed;body.hidden=day.collapsed;e.target.closest('button')?.setAttribute('aria-expanded',String(!day.collapsed));persistSoon();}}
    if(d.dayTime){const day=activeVersion()?.days.find(x=>x.id===d.dayTime);if(day)dayTimeModal(day)}
    if(d.dayAdd)addStopModal(d.dayAdd);
    if(d.dayAccommodation)accommodationModal(d.dayAccommodation);
    if(d.cityTour){const day=activeVersion()?.days.find(x=>x.id===d.cityTour);if(day)cityTour(day)}
    if(d.routeDay){const day=activeVersion()?.days.find(x=>x.id===d.routeDay);if(day)refreshDayRoutes(day)}
    if(d.editStop){const x=locateStop(d.editStop);if(x)(x.stop.accommodation?accommodationDetailsModal(x.day,x.stop,false):editStopModal(x.day,x.stop,false))}
    if(d.deleteStop){const x=locateStop(d.deleteStop);if(x&&confirm(`„${x.stop.name}“ entfernen?`)){x.day.stops=x.day.stops.filter(s=>s.id!==x.stop.id);persistSoon();renderPlanner();if(currentView==='map')renderMap()}}
    if(d.moveStop){const x=locateStop(d.moveStop);if(x){const i=x.day.stops.findIndex(s=>s.id===x.stop.id),j=i+(+d.dir);if(j>=0&&j<x.day.stops.length){[x.day.stops[i],x.day.stops[j]]=[x.day.stops[j],x.day.stops[i]];x.day.stops.forEach(s=>s.routeToNext=null);persistSoon();renderPlanner()}}}
    if(d.editFlight){const f=activeVersion()?.flights.find(x=>x.id===d.editFlight);if(f)flightModal(f)}
    if(d.editConnection){const c=activeVersion()?.connections?.find(x=>x.id===d.editConnection);if(c)connectionModal(c)}
    if(d.connectionTransfer)transferModal(null,d.connectionTransfer);
    if(d.editTransfer){const x=activeVersion()?.transfers?.find(z=>z.id===d.editTransfer);if(x)transferModal(x)}
    if(d.cityInspire){try{cityInspirationModal(JSON.parse(d.cityInspire))}catch(err){}}
    if(d.cityDetail){try{openSuggestionDetail('city',JSON.parse(d.cityDetail),activeTrip()?.destination||'')}catch(err){}}
    if(d.cityOverview){try{openSuggestionDetail('city',JSON.parse(d.cityOverview),activeTrip()?.destination||'')}catch(err){}}
    if(d.wishConfig)wishSettingsModal(d.wishConfig);
    if(d.wishToggle){try{const item=JSON.parse(d.wishItem),current=getWishlistEntry(d.wishToggle,item);setWishlistSelection(d.wishToggle,item,!current,current?.priority||'high')}catch(err){}}
    if(d.wishRemove){const t=activeTrip();if(t){t.wishlist=(t.wishlist||[]).filter(x=>x.key!==d.wishRemove);persistSoon();renderDiscover()}}
    if(d.addCity){try{addCitySuggestion(JSON.parse(d.addCity))}catch(err){}}
    if(d.addSuggestion){try{addSuggestion(JSON.parse(d.addSuggestion))}catch(err){}}
    if(d.poiDetail){try{openSuggestionDetail('poi',JSON.parse(d.poiDetail),activeTrip()?.destination||'')}catch(err){}}
    if(d.cityPoiDetail){try{const item=JSON.parse(d.cityPoiDetail);openSuggestionDetail('poi',item,item.cityName||activeTrip()?.destination||'')}catch(err){}}
    if(d.wildDetail){try{openSuggestionDetail('wildlife',JSON.parse(d.wildDetail),activeTrip()?.destination||'')}catch(err){}}
    if(d.targetSpecies){try{chooseTargetSpecies(JSON.parse(d.targetSpecies))}catch(err){}}
    if(d.suggestionsMore)changeSuggestionLimit(d.suggestionsMore,true);
    if(d.suggestionsLess)changeSuggestionLimit(d.suggestionsLess,false);
  });
  document.addEventListener('change',e=>{const d=e.target.dataset;if(d.wishPriority)updateWishlistPriority(d.wishPriority,e.target.value)});
  $('#versionSelect').addEventListener('contextmenu',e=>{e.preventDefault();const t=activeTrip();if(t)versionModal(t)});
  $('#versionSelect').addEventListener('dblclick',()=>{const t=activeTrip();if(t)versionModal(t)});
}

function boot(){loadState();bindEvents();readInstalledVersion();renderAll();switchView('trips');maybeAutoCheckUpdate();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

})();
