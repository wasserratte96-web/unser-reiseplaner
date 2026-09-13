/* Country and POI identities, independent of UI and network. */
(function(root){
  'use strict';
  const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const names=new Intl.DisplayNames(['de'],{type:'region'}),english=new Intl.DisplayNames(['en'],{type:'region'});
  const countries=codes.map(code=>({code,name:names.of(code)})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const aliases={england:'GB',grossbritannien:'GB',uk:'GB',usa:'US',tschechien:'CZ',czechia:'CZ',sudkorea:'KR',nordkorea:'KP',turkei:'TR'};
  function country(value){
    const n=normalize(typeof value==='object'?value?.code||value?.name:value);
    const match=countries.find(c=>c.code.toLowerCase()===n||normalize(c.name)===n||normalize(english.of(c.code))===n||c.code===aliases[n]);
    return match?{...match}:null;
  }
  function countriesForTrip(trip){
    if(!trip)return[];
    const values=Array.isArray(trip.countries)&&trip.countries.length?trip.countries:[trip.country||trip.destination].filter(Boolean);
    const result=[];
    for(const v of values){const c=country(v)||{code:'',name:String(typeof v==='object'?v.name||'':v).trim()};if(c.name&&!result.some(x=>c.code?x.code===c.code:normalize(x.name)===normalize(c.name)))result.push(c);}
    return result;
  }
  function validCountryCodes(values){return [...new Set(values.map(v=>String(v).toUpperCase()).filter(c=>codes.includes(c)))].sort().map(c=>c.toLowerCase());}
  function safeUrl(value){try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:'';}catch{return'';}}
  function crossesBorder(a,b){const ac=a.countryCode||a.item?.countryCode,bc=b.countryCode||b.item?.countryCode;return Boolean(ac&&bc&&ac!==bc);}
  function pointKind(item){if(item.kind)return item.kind;return ['city','town','village','hamlet'].includes(item.addressType||item.type)?'city':'highlight';}
  function resultIdentity(item){return item.taxonId?`taxon:${item.taxonId}`:item.wikidata?`wd:${item.wikidata}`:item.sourceId?`osm:${item.sourceId}`:`geo:${normalize(item.name)}:${Number(item.lat).toFixed(4)}:${Number(item.lng).toFixed(4)}`;}
  function dedupeResults(items){const seen=new Set();return items.filter(item=>{const id=resultIdentity(item);if(seen.has(id))return false;seen.add(id);return true;});}
  function customPoint(input,makeId){
    const name=String(input.name||'').trim();if(!name)throw new Error('Bitte einen Namen eingeben.');
    const lat=root.URPPlanner.coordinate(input.lat,90),lng=root.URPPlanner.coordinate(input.lng,180);
    const supplied=x=>x!=null&&String(x).trim()!=='';
    if((supplied(input.lat)||supplied(input.lng))&&(lat===null||lng===null))throw new Error('Breiten- und Längengrad vollständig und gültig eingeben.');
    const durationMin=Number(input.durationMin);if(!Number.isFinite(durationMin)||durationMin<15||durationMin>720)throw new Error('Aufenthalt zwischen 15 und 720 Minuten wählen.');
    const c=country(input.countryCode);
    return {customId:input.customId||makeId(),name,kind:['city','highlight','wildlife'].includes(input.kind)?input.kind:'highlight',lat,lng,countryCode:c?.code||'',country:c?.name||'',durationMin,notes:String(input.notes||'').trim(),source:'Eigener Ort',photo:'',retrievedAt:Date.now(),isWildlifeLocation:input.kind==='wildlife'&&lat!==null};
  }
  const photoGenres={landscape:'Landschaft',wildlife:'Tierfotografie',street:'Street-Photography',architecture:'Architektur',night:'Nachtfotografie'};
  function photoPlan(input){
    const start=String(input.windowStart||''),end=String(input.windowEnd||'');
    if(start||end){const a=root.URPPlanner.minutes(start),b=root.URPPlanner.minutes(end);if(a===null||b===null||b<=a)throw new Error('Fotozeitfenster vollständig eingeben; das Ende muss am selben Tag nach dem Start liegen.');}
    return {genres:(input.genres||[]).filter((g,i,a)=>photoGenres[g]&&a.indexOf(g)===i),windowStart:start,windowEnd:end,notes:String(input.notes||'').trim()};
  }
  function searchEndpoint(value){
    const raw=String(value||'').trim();if(!raw)return 'https://nominatim.openstreetmap.org/search';
    let url;try{url=new URL(raw);}catch{throw new Error('Gültige HTTPS-Adresse des Suchdienstes eingeben.');}
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Suchdienst als HTTPS-Adresse ohne Zugangsdaten, Suchparameter oder Fragment eingeben.');
    return url.href;
  }
  const api={searchEndpoint,countries,country,countriesForTrip,validCountryCodes,safeUrl,crossesBorder,pointKind,resultIdentity,dedupeResults,customPoint,photoGenres,photoPlan};
  root.URPDiscovery=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
