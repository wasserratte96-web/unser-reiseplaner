# Datenquellen und Zuordnung – 1.3.0

## Ortsdaten, Highlights und Bilder

- **OpenStreetMap / Nominatim:** Ortssuche mit Koordinaten, OSM-ID, Gebietsart und benannten Alternativen. Wiederholte identische Anfragen werden zusammengefasst; Ergebnisse bleiben im lokalen Cache. Neue Nominatim-Anfragen werden seriell mit mindestens 1,1 Sekunden Abstand gestartet. Die [Nominatim-Nutzungsregeln](https://operations.osmfoundation.org/policies/nominatim/) verlangen eine identifizierbare Anwendung und begrenzte Abfragerate; der vorhandene native User-Agent bleibt aktiv.
- **Overpass:** Städte werden innerhalb der ermittelten OSM-Fläche gesucht, damit Nachbarländer in einer Bounding Box nicht als eigenes Reiseland erscheinen. Die bisherigen alternativen Overpass-Endpunkte bleiben erhalten.
- **Wikipedia / Wikidata:** Nationale Highlights umfassen Naturziele, Wahrzeichen, Welterbe, Denkmäler und historische Stätten. Sie brauchen passende Inhaltsmerkmale, Koordinaten und eine explizite P17-Länderzuordnung. Städte und Verwaltungseinheiten werden ausgesondert. Die aktuelle Suchsprache ist Deutsch; unvollständige Einträge können deshalb fehlen. Bei Ausfall einzelner Suchabfragen bleiben unabhängig bestätigte Ergebnisse verfügbar; nicht prüfbare Länderzuordnungen werden nicht übernommen.
- **Detailseiten:** Titel/ID und geografische Nähe müssen zusammenpassen. Eine Wikipedia-Seite ohne belastbaren Standort wird nicht ungeprüft als Ortsbeschreibung übernommen. Stadt-Sehenswürdigkeiten bleiben an der abgefragten Stadt und ihren Koordinaten orientiert.
- **Bilder:** Erst die zugeordnete Seite, dann zusätzliche passende Dateien. Commons-Fallbacks benötigen Namens- und Kontextübereinstimmung. Fehlgeschlagene Bildabrufe zeigen einen sichtbaren Ersatzhinweis. Es werden keine erfundenen Bilder eingesetzt. Je nach Quellenbestand können weniger als drei oder vier passende Fotos verfügbar sein.

Quellen: [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page), [Wikidata P17](https://www.wikidata.org/wiki/Property:P17).

## Verbindungen und Transfers

**OSRM** liefert Straßenentfernung, Fahrdauer und Geometrie für Auto/Mietwagen/Camper. Ein explizites `NoRoute`/`NoSegment` wird als fehlende Straßenverbindung behandelt. Bei einer zeitweisen technischen Störung kann eine klar als solche markierte Luftlinien-Schätzung entstehen. Ein solcher Entwurf bestätigt weder Befahrbarkeit noch eine Fährverbindung.

Fußwege, ÖPNV, Zug, Bus und Fähre nutzen weiterhin editierbare Schätzwerte, keine verbindlichen Fahrpläne. Automatisch vorgeschlagene Flüge bestätigen keine Verfügbarkeit. **ADSBDB** liefert wie bisher eine mögliche Route zur Flugnummer, keine verlässliche zukünftige Buchung oder Abflugzeit. Die tatsächlichen Daten werden manuell ergänzt.

Der Routenkern berücksichtigt Fahrzeitgrenze, Pausen, Verbindungs- und Transferpuffer sowie Besuchsdauer. Große Straßenetappen können mehrere Tage beanspruchen. Konkrete Zwischenübernachtungsorte müssen dann ergänzt werden. Zeitzonen und tatsächliche Ortszeiten von Flügen sind offen; die generierten Zeiten sind ausdrücklich Entwurfswerte.

Quellen: [OSRM HTTP API](https://project-osrm.org/docs/v5.24.0/api/), [ADSBDB](https://www.adsbdb.com/).

## Wildlife

**iNaturalist:** Säugetier-Inspiration nutzt Taxon 40151, eine eindeutig zugeordnete iNaturalist-Gebiets-ID und den Startmonat der Reise. Es werden als wildlebend erfasste Beobachtungen mit Research-Grade-Abgleich angefragt. Art, Bilder und Hotspot-Abfragen verwenden dieselbe Taxon-ID.

Für konkrete Hotspot-Anker werden gefangene/kultivierte, verschleierte/private und bekannte zu ungenaue Koordinaten ausgeschlossen. Ein Anker stammt aus einer tatsächlichen öffentlichen Beobachtung nahe dem Clustermittelpunkt. Das Mittel selbst wird nicht als exakter Besuchsort ausgegeben. Abrufdatum, Beispiel-Beobachtungsdatum, Gebiets-ID und Quellenlink werden gespeichert; Wildlife-Fotos übernehmen vorhandene Urheber-/Lizenzmetadaten.

Cluster und Beobachtungszahlen sind keine Sichtungswahrscheinlichkeit. Sie bestätigen weder öffentlichen Zugang noch einen sicheren Besuchsweg. Der Nutzer muss konkrete Zugänglichkeit, Tageszeit und aktuelle Meldungen prüfen. Es werden nur die abgefragten Beobachtungsstichproben ausgewertet, keine vollständige historische Vollerhebung.

Quellen: [iNaturalist API](https://api.inaturalist.org/v1/docs/), [offizieller API-Einstieg](https://www.inaturalist.org/pages/api+reference), [Geoprivacy-Hilfe](https://www.inaturalist.org/pages/archived+help).

## Caches und Fehler

Neue Cache-Kennungen trennen die geänderten Länder-/Quellenregeln von älteren Daten. „Neu laden“ verwirft den passenden Inspirationscache. Ein Ausfall darf als Fehler angezeigt werden und erzeugt keine fremden Ersatzinhalte. Standort- und Hoteländerungen machen davon abhängige Strecken-/Transferwerte erneut prüfpflichtig. Die grundlegende SQLite-Datenbank wird nicht ersetzt; alte Daten werden beim Laden beziehungsweise Import angepasst.

Die automatisierten Provider-Tests nutzen kontrollierte Antworten. Die Live-Verfügbarkeit sämtlicher Dienste und der Android-Netzwerkweg wurden in dieser Umgebung nicht bestätigt.
