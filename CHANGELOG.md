# Changelog

## 1.1.5
- Datenkonsistenz grundlegend überarbeitet: keine freie Wikipedia-/Commons-Trefferauswahl mehr nach "erstem Suchergebnis".
- Städte stammen nur noch aus OpenStreetMap-Objekten mit `place=city`; Bundesstaaten/Regionen wie Tasmania, New South Wales oder Victoria werden nicht mehr als Stadt ergänzt.
- Stadt-Thumbnails werden über OSM-Wikipedia/Wikidata-ID oder streng geprüfte Geo-/Namenszuordnung geladen.
- Stadt-Sehenswürdigkeiten bleiben durch eine Radiusprüfung an die gewählte Stadt gebunden; Distanz zum Stadtzentrum wird angezeigt.
- Wikipedia-Kurzinfos werden nur bei exakter OSM-Wikipedia/Wikidata-Verknüpfung oder bei gleichzeitig passender Geoposition und hoher Namensübereinstimmung übernommen.
- Wikimedia-Bilder werden nur aus der eindeutig zugeordneten Wikipedia-Seite oder aus streng namensgefilterten Commons-Treffern übernommen. Im Zweifel zeigt die App lieber kein Bild/keinen Fremdtext als einen falschen Inhalt.
- Wildlife-Fotos werden über dieselbe iNaturalist-Taxon-ID wie der Tiervorschlag geladen.
- Nationale Highlights werden zusätzlich gegen die geografische Bounding-Box des Ziellandes geprüft.
- Overpass-Abfragen besitzen jetzt sequenzielles Server-Failover (Private.coffee → overpass-api.de → VK Maps). Ein einzelner HTTP-504-Fehler beendet die Suche daher nicht mehr.
- HTML/XML-Fehlerseiten externer APIs werden nicht mehr vollständig in der Oberfläche angezeigt.
- Alte, potenziell falsch zugeordnete Inspirations-/Foto-Caches aus 1.1.4 werden beim Upgrade verworfen; Reise-, Tages-, Unterkunfts- und Transferdaten bleiben erhalten.

## 1.1.4
- Detail-Popups mit mehreren Bildern.
- Flexible Langstrecken-Verbindungen und Transfer-Bausteine.
- Verfeinerte Tagesplanung und Android-Safe-Area-Anpassungen.
