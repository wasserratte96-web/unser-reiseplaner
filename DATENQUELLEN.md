# Datenquellen und Konsistenzprüfung – 1.1.5

## OpenStreetMap / Overpass
- Stadtlisten verwenden ausschließlich OSM-Objekte mit `place=city`.
- Stadt-Sehenswürdigkeiten werden innerhalb eines festen Radius gesucht und anschließend nochmals per Distanz geprüft.
- Bei Serverfehlern wird nicht parallel, sondern sequenziell auf weitere öffentliche Overpass-Endpunkte ausgewichen.

## Wikipedia / Wikidata
Priorität der Zuordnung:
1. exakter `wikipedia`-Tag aus OpenStreetMap,
2. exakter `wikidata`-QID aus OpenStreetMap und dessen Wikipedia-Sitelink,
3. nur falls keine ID vorhanden ist: Wikipedia-Geosuche nahe den OSM-Koordinaten plus strenge Namensübereinstimmung.

Ein beliebiges erstes Wikipedia-Suchergebnis wird nicht mehr verwendet.

## Wikimedia Commons
- Bilder aus einer eindeutig zugeordneten Wikipedia-Seite werden bevorzugt.
- Commons-Fallbacks müssen starke Namensübereinstimmung mit der Sehenswürdigkeit besitzen.
- Unpassende Logos, Karten, Symbole und SVGs werden herausgefiltert.
- Wenn die Zuordnung nicht sicher ist, wird kein Bild gezeigt.

## iNaturalist
- Arten werden über numerische Taxon-IDs gespeichert.
- Bilder im Wildlife-Detail werden mit derselben Taxon-ID abgefragt.
- Dadurch hängt die Bildzuordnung nicht von mehrdeutigen Trivialnamen ab.

## Nominatim / OSRM / ADSBDB
Diese Quellen liefern primär Koordinaten, Routing bzw. Flugrouten. Sie werden nicht als freie Quelle für Kurzbeschreibungen oder Fotos verwendet.

## V1.2.0 – automatische Routenplanung

Die automatische Routenplanung verwendet **keine vermeintlich exakten Buchungsdaten**, wenn diese nicht aus einer belastbaren kostenlosen Quelle verfügbar sind. Geografische Punkte stammen aus den bereits verifizierten Entdecken-Daten. Wildlife-Hotspots werden aus iNaturalist-Beobachtungen abgeleitet. Straßenentfernungen bzw. grobe Verkehrsmittelentscheidungen dienen nur als Planungsheuristik.

Automatisch erzeugte Verbindungen, Transfers und Unterkünfte werden deshalb als **Platzhalter** gekennzeichnet. Unbekannte Flug-/Zugnummern, Betreiber, Adressen und Buchungsdaten bleiben leer und erscheinen als gelber offener Punkt, bis der Nutzer sie später konkretisiert.
