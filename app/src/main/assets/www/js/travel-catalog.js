/* Small editorial starter collection. Seasons are guidance, never a forecast. */
(function(root){
  'use strict';
  const checkedAt='2026-10-12';
  const sources={
    chalten:'https://argentina.travel/en/activities/el-chalten',
    glaciers:'https://argentina.travel/en/news/southern-patagonia-in-summer-glaciers-lakes-and-scenic-routes-in-santa-cruz-and-tierra-del-fuego',
    valdes:'https://www.argentina.travel/en/activities/peninsula-valdes',
    iguazu:'https://www.argentina.travel/en/news/where-to-see-native-wildlife-in-argentina-best-destinations-and-seasons-for-animal-watching',
    buenos:'https://argentina.travel/en/about-argentina',
    atacama:'https://chile.travel/en/attractions/los-flamencos-national-reserve/',
    torres:'https://chile.travel/en/destinations/torres-del-paine/',
    australia:'https://www.australia.com/en/facts-and-planning/when-to-go/australias-seasons.html',
    gor:'https://visitgreatoceanroad.org.au/plan-your-trip/frequently-asked-questions/',
    tarangire:'https://www.tanzaniaparks.go.tz/tarangire/about',
    serengeti:'https://tanzaniaparks.go.tz/serengeti',
    kruger:'https://www.sanparks.org/parks/kruger/explore/climate',
    cape:'https://www.sanparks.org/parks/table-mountain/explore/climate',
    kyoto:'https://www.japan.travel/en/destinations/kansai/kyoto/',
    tokyo:'https://www.japan.travel/en/destinations/kanto/tokyo/',
    banff:'https://www.banfflakelouise.com/blog/plan-your-trip-best-time-to-visit-banff-lake-louise',
    island:'https://vancouverisland.travel/pages/travel-by-season',
    costa:'https://www.visitcostarica.com/planning-your-trip/climate'
  };
  const rows=[
    ['chalten','El Chaltén · Fitz Roy','AR','El Chaltén',[10,11,12,1,2,3],3,'public',['nature','photo'],'Kondore als mögliches Nebenmotiv','Fitz Roy, Laguna Capri, Bergpanoramen','Kleiner Ausgangsort','Morgenlicht und Berglandschaft','Wegzustand und Wetter bestimmen die konkrete Wanderung.','chalten'],
    ['calafate','El Calafate · Gletscher','AR','El Calafate',[11,12,1,2,3],2,'unknown',['nature','photo'],'Wildlife ist hier ein ergänzendes Interesse','Perito Moreno und Seen','El Calafate als Unterkunftsort','Eisstrukturen und Gletscherfront','Zugang zum Gletscher mit Bus oder Ausflug separat prüfen.','glaciers'],
    ['valdes','Puerto Madryn · Península Valdés','AR','Puerto Madryn',[9,10,11],3,'assisted',['wildlife','photo'],'Pinguine und weitere Küstentiere; artspezifische Saison prüfen','Patagonische Küste','Puerto Madryn','Tierbeobachtung mit Abstand','Ein Fahrzeug oder organisierter Ausflug ist für viele Beobachtungsorte nötig.','valdes'],
    ['iguazu','Iguazú · Wasserfälle und Wald','AR','Puerto Iguazú',[5,6,7,8,9],3,'unknown',['nature','wildlife','photo'],'Vögel und weitere Tiere des subtropischen Waldes','Wasserfälle und Regenwald','Puerto Iguazú als Basis','Wasser, Gischt und Waldmotive','Ganzjährig interessant; Regen und Wasserstand verändern das Erlebnis. Brasilianische Seite separat ergänzen.','iguazu'],
    ['buenos','Buenos Aires','AR','Buenos Aires',[3,4,5,9,10,11],3,'public',['city','photo'],'Stadtvögel; kein Wildlife-Schwerpunkt','Parks als Ergänzung','Viertel, Märkte und Architektur','Street-Photography und Stadtdetails','Frühling und Herbst als redaktioneller Schwerpunkt; Veranstaltungen separat datieren.','buenos'],
    ['atacama','San Pedro · Atacama','CL','San Pedro de Atacama',[3,4,5,9,10,11],4,'assisted',['nature','wildlife','photo'],'Flamingos, Vikunjas und Füchse in Schutzgebieten','Salzseen und Wüstenlandschaften','San Pedro als Basis','Weite Landschaften und Nachtmotive','Monatsauswahl ist eine redaktionelle Orientierung. Höhenlage, Zugang und lokale Wetterlage prüfen.','atacama'],
    ['torres','Puerto Natales · Torres del Paine','CL','Puerto Natales',[11,12,1,2,3],4,'unknown',['nature','wildlife','photo'],'Guanakos als Motiv; Zugang gesondert prüfen','Berge, Seen und Wanderungen','Puerto Natales als Basis','Patagonische Landschaft','Sommerprofil als Orientierung; Parkzugang und Unterkunftslage vor der Route festlegen.','torres'],
    ['sydney','Sydney','AU','Sydney',[3,4,5,9,10,11],3,'public',['city','photo'],'Vögel in Stadtparks; Wildlife-Ausflüge separat','Hafen und Küstenwege','Sydney','Street-Photography und Hafenarchitektur','Frühling und Herbst als Schwerpunkt; keine datierte Blüte- oder Wettergarantie.','australia'],
    ['melbourne','Melbourne · Great Ocean Road','AU','Melbourne',[11,12,1,2,3,4],5,'assisted',['nature','city','photo'],'Koalas als zusätzlicher Suchwunsch','Küstenlandschaft','Melbourne','Küste und Street-Photography','Stadt und Küste brauchen unterschiedliche Zugänge; für Küstenausflüge Transfer oder Fahrzeug prüfen.','gor'],
    ['perth','Perth · Rottnest Island','AU','Perth',[9,10,11,3,4,5],4,'unknown',['nature','wildlife','photo'],'Quokkas als Inselwunsch','Küste und saisonale Blüten','Perth und Fremantle','Insel- und Stadtmotive','Fährverbindung und Inselausflug separat ergänzen; Blüten hängen vom Saisonverlauf ab.','australia'],
    ['darwin','Darwin · Top End','AU','Darwin',[5,6,7,8,9],5,'assisted',['nature','wildlife','photo'],'Wildlife in passenden Schutzgebieten','Tropische Landschaften','Darwin als Ausgangsort','Landschaft und Naturdetails','Trockenzeit als Schwerpunkt; Ausflüge und Straßenzugänge gesondert prüfen.','australia'],
    ['tarangire','Tarangire','TZ','Arusha',[6,7,8,9,10],3,'assisted',['wildlife','photo'],'Elefanten und Tiere am Tarangire-Fluss','Flusslandschaft und Savanne','Arusha als Anreisebasis','Tierfotografie','Für den Parkbesuch Safari-Fahrzeug oder Tour erforderlich; keine ÖPNV-Safari.','tarangire'],
    ['serengeti','Serengeti','TZ','Arusha',[1,2,6,7,8,9,10],5,'assisted',['wildlife','photo'],'Tierwanderung; Januar/Februar als Kälberzeit-Schwerpunkt','Savannenlandschaft','Arusha als Anreisepunkt','Wildlife und weite Landschaft','Der passende Parksektor verändert sich mit Saison und Niederschlag; Safari-Zugang organisieren.','serengeti'],
    ['kruger','Kruger-Nationalpark','ZA','Mbombela',[5,6,7,8,9],4,'assisted',['wildlife','photo'],'Wildbeobachtung an Wasserstellen','Buschlandschaft','Unterkunft im oder am Park wählen','Tierfotografie','Winterprofil; Parkbesuch per Fahrzeug oder geführter Aktivität.','kruger'],
    ['cape','Kapstadt · Kap-Halbinsel','ZA','Cape Town',[11,12,1,2,3],4,'unknown',['nature','city','photo'],'Wildlife-Orte als eigene Wünsche ergänzen','Tafelberg und Küstenlandschaft','Kapstadt','Architektur und Landschaft','Trockener Sommer als Schwerpunkt; Wind und Bergzugang prüfen.','cape'],
    ['kyoto','Kyoto','JP','Kyoto',[3,4,5,10,11],4,'public',['city','photo'],'Kein Wildlife-Schwerpunkt','Gärten und Herbstlaub','Tempel und Stadtviertel','Architektur und Street-Photography','Blüte und Laubfärbung schwanken jährlich; Besuchsregeln einzelner Viertel beachten.','kyoto'],
    ['tokyo','Tokyo','JP','Tokyo',[3,4,5,10,11],4,'public',['city','photo'],'Kein Wildlife-Schwerpunkt','Gärten und Ausflüge ins Umland','Viertel und urbane Architektur','Street-Photography und Nachtmotive','Frühling/Herbst als Schwerpunkt; einzelne Ereignisse brauchen konkrete Termine.','tokyo'],
    ['banff','Banff · Lake Louise','CA','Banff',[7,8,9],5,'unknown',['nature','wildlife','photo'],'Wildtiere als Beobachtungswunsch; Abstand halten','Berge und Seen','Banff als Basis','Seen, Berglandschaft und Herbstfarben','Zugang zu Seen teils mit reservierbarem Shuttle; Strecke und Saison vorher prüfen.','banff'],
    ['vancouver-island','Vancouver Island','CA','Victoria',[6,7,8,9],7,'assisted',['nature','wildlife','photo'],'Bärenbeobachtung über geeignete Anbieter prüfen','Regenwald und Küste','Victoria','Wald, Küste und Tiermotive','Viele Naturziele brauchen eigene Transfers. Inselweite Route benötigt zusätzliche Reisezeit.','island'],
    ['manuel-antonio','Manuel Antonio · Pazifikküste','CR','Quepos',[12,1,2,3,4],3,'unknown',['nature','wildlife','photo'],'Waldtiere als Suchwünsche ergänzen','Tropischer Wald und Küste','Quepos als Basis','Wald- und Naturmotive','Pazifische Trockenzeit als Schwerpunkt; Parkzugang und Eintritt separat prüfen.','costa']
  ];
  const profiles=rows.map(([id,name,countryCode,base,months,minDays,access,focus,wildlife,nature,city,photo,note,source])=>({id,name,countryCode,base,months,minDays,access,focus,discover:{wildlife,nature,city,photo},note,source:sources[source],checkedAt,assessment:'Redaktionelle Saisonorientierung; Aufenthaltsdauer ohne internationale Anreise'}));
  const airportHints=[
    {code:'PRG',name:'Václav Havel Airport Prag',options:[{mode:'transit',text:'Linie 59 zur Metro A oder Linie 100 zur Metro B.'},{mode:'bus',text:'Airport Express zum Hauptbahnhof.'}],url:'https://www.prg.aero/en/how-can-i-travel-city-centre'},
    {code:'PER',name:'Perth Airport',options:[{mode:'train',text:'T1/T2: Airport Central und Airport Line.'},{mode:'transit',text:'T3/T4: Bus 292 zur Station Redcliffe; Terminal prüfen.'}],url:'https://www.perthairport.com.au/to-and-from-the-airport/transport-options/public-transport'},
    {code:'FTE',name:'El Calafate Airport',options:[{mode:'shuttle',text:'VES Patagonia Airport Shuttle; Zieladresse und Reservierung beim Anbieter prüfen.'}],url:'https://www.aeropuertoelcalafate.com/en/services.php'},
    {code:'CJC',name:'Calama · El Loa',options:[{mode:'shuttle',text:'Transvip bietet Transfers nach San Pedro de Atacama. Reservierung und Abholort prüfen.'}],url:'https://transvip.cl/localidades/transvip-calama'}
  ].map(x=>({...x,checkedAt}));
  const excursions=[
    {id:'capri',name:'Fitz Roy · Laguna Capri',countryCode:'AR',baseName:'El Chaltén',baseLat:null,baseLng:null,mode:'walk',outboundMin:120,returnMin:120,walkMin:240,visitMin:45,note:'Planungsbudget mit Fotopause. Wegzustand vor Ort prüfen; Ausgangsort auf der Karte auswählen.',source:'https://elchalten.com/v4/en/laguna-capri-trek-el-chalten.php'},
    {id:'tres',name:'Fitz Roy · Laguna de los Tres',countryCode:'AR',baseName:'El Chaltén',baseLat:null,baseLng:null,mode:'walk',outboundMin:300,returnMin:240,walkMin:540,visitMin:60,note:'Anspruchsvoller langer Wandertag. Konservatives eigenes Zeitbudget; Wegzustand und Tageslicht prüfen.',source:'https://elchalten.com/v4/en/laguna-de-los-tres-trek-el-chalten.php'}
  ].map(x=>({...x,checkedAt}));
  const api={profiles,airportHints,excursions,checkedAt};root.URPCatalog=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
