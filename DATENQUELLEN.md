# Datenquellen – Unser Reiseplaner V1

Die erste Version verwendet ausschließlich kostenlose, öffentlich erreichbare Datenquellen ohne verpflichtenden kostenpflichtigen API-Key.

## OpenStreetMap
Kartenkacheln und Grunddaten.

## Nominatim
Manuelle Ortssuche. Die App sendet nur nutzerinitiierte Suchanfragen und verwendet keinen Autocomplete-Mechanismus.

## OSRM Demo Server
Autostrecken, Entfernungen und Fahrzeiten. Für private geringe Nutzung geeignet; nicht als garantierter Produktionsdienst zu verstehen.

## Wikidata / Wikipedia
Bekannte Sehenswürdigkeiten und touristisch relevante Orte. Die App verwendet Wikidata-SPARQL und sortiert Kandidaten nach Verknüpfungs-/Bekanntheitsindikatoren.

## iNaturalist
Häufig beobachtete Säugetiere eines Reiseziels sowie historische Beobachtungen für Wildlife-Hotspots. Beobachtungszahlen sind **keine Sichtungsgarantie**.

## Overpass API / OpenStreetMap
Öffnungszeiten, touristische POIs und automatische Stadt-Sightseeing-Vorschläge, soweit entsprechende OSM-Tags vorhanden sind.

## Wikimedia Commons
Bis zu drei Bilder je Stopp. Die App speichert nur Bild-URLs, Dateiseite und Metadaten des ausgewählten Ergebnisses. Ein Tipp auf ein Foto kann zur Commons-Dateiseite führen.

## ADSBDB
Kostenlose Flugrouten-Erkennung per Flugnummer/Callsign, soweit ein passender Datensatz existiert. Keine verlässlichen zukünftigen Flugplanzeiten.

## Datenschutz
Es gibt in V1 kein Benutzerkonto und keinen eigenen Server. Reisepläne werden lokal auf dem Android-Gerät gespeichert. Suchbegriffe und Koordinaten werden nur an die jeweils benötigten öffentlichen Datenquellen geschickt.


## V1.1.3 – nationale Highlights
Die Highlight-Suche nutzt Wikipedia-Suchergebnisse mit Koordinaten, Kategorien, Kurzbeschreibung und Vorschaubild. Stadt-, Gemeinde- und Verwaltungsartikel werden anhand bekannter Stadtlisten, Wikipedia-Kategorien und Artikeltext-Heuristiken herausgefiltert. Suchkategorien wie Wahrzeichen, UNESCO-Welterbe, Nationalparks, Naturwunder, Denkmäler und historische Stätten werden unterschiedlich gewichtet.
