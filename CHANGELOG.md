# Changelog

## 1.3.1 – 2026-09-10

- GitHub-Buildfehler `sdkmanager: command not found` (Exit 127) behoben: Prüf- und Release-Workflow richten die Android-Kommandozeilenwerkzeuge, Lizenzen, SDK-Pfade, API 36 und Build Tools 36.0.0 ausdrücklich ein.
- Android-Einrichtung auf einen geprüften Action-Commit und eine feste Command-Line-Tools-Version festgelegt; SDK, `apksigner` und `aapt` werden vor dem Build geprüft.
- Pull-Request-Prüfungen bauen den tatsächlichen Quellcode-Commit des Vorschlags.
- Termux-Update akzeptiert jetzt auch den bereits übertragenen Quellstand 1.3.0 und kann nach dessen fehlgeschlagenem Build fortgesetzt werden.
- Versionsanzeige, native User-Agents, Gradle, Paketmetadaten und Dokumentation auf 1.3.1 / lokalen Versionscode 10 angehoben. Reise-Datenschema bleibt 6.
- Alle Funktionsänderungen und Regressionstests aus 1.3.0 sind enthalten. Prüfstatus und Wiederaufnahme: `PRUEFBERICHT_1_3_1.md` und `UPDATE_1_3_1_TERMUX.md`.

## 1.3.0 – 2026-09-09

- Neuer separat prüfbarer Routenkern für Zeitbudgets, Besuchsdauer, Fahrten, Pausen, Transfers und Übernachtungen.
- Wunschliste direkt bearbeitbar: Priorität, Aufenthaltstage und Minuten je Aufenthaltstag; Start-/Endziel, Fahrzeug und tägliche Fahrzeitgrenze im Routendialog.
- Mehrtägige Straßenetappen; Flüge als abschaltbare Vorschläge; keine erfundenen Zugverbindungen aus Entfernungsgrenzen.
- Nicht passende Wünsche bleiben mit Begründung und Muss-Markierung sichtbar. Keine überzähligen Ziele auf dem letzten Tag.
- Wildlife-null/0,0-Fehler korrigiert und bekannte alte automatische Fehlkoordinaten zur erneuten Prüfung markiert.
- Verbindungssperren gelten nur für tatsächlich betroffene Tage; späte Fixzeiten und Zeitkonflikte werden angezeigt.
- Durchgehende Übernachtungsabdeckung mit exklusivem Check-out und zusammengefassten Nächten am selben Ort.
- Gebietsscharfe OSM-Städte, P17-geprüfte nationale Highlights, strengere Wikipedia-/Fotozuordnung und Wildlife mit Gebiets-/Taxon-IDs. Naturziele, Wahrzeichen, Welterbe und historische Stätten bleiben abgedeckt; einzelne ausgefallene Highlight-Suchabfragen verwerfen bestätigte Teilergebnisse nicht.
- Öffentlich lokalisierbare Wildlife-Anker aus tatsächlichen Beobachtungen; Gefangenschaft, verschleierte und zu ungenaue Orte ausgeschlossen.
- Dialogänderungen werden erst beim Speichern übernommen; Schätzzeiten bleiben bis zur ausdrücklichen Prüfung offen.
- Abhängige Transfers/Strecken werden nach Unterkunftsänderungen ungültig; fehlgeschlagene native Speicherung wird nicht als Erfolg angezeigt.
- Kartenfilter „Keine“ und eingeklappte Tagesabschnitte bleiben wirksam; Verbindungen zwischen Tagen sind in der Karte darstellbar.
- Asynchrone Detailantworten sind an den aktuell geöffneten Dialog gebunden.
- Backup-Import nutzt dieselbe Datenanpassung wie der Start; Schema 6, lokaler Versionscode 9, In-App-Version 1.3.0.
- Vollständige Tests, Projektprüfung, robusteres Termux-Einspielen, eindeutige CI-Anforderungen und Release des exakt geprüften Commits.
- Prüfstatus offen ausgewiesen: lokale Logik-/Strukturtests; Android-Build, Live-Dienste und visuelle Geräteprüfung hier nicht nachgewiesen.

## 1.2.0
- **Entdecken grundlegend neu aufgebaut:** Vorschläge werden nicht mehr direkt als Reisetags-Stopp gespeichert, sondern zunächst in einer reiseweiten Wunschliste gesammelt.
- Städte, nationale Highlights und Wildlife lassen sich mit **Muss / Hoch / Mittel / Optional** priorisieren.
- Bereits ausgewählte Vorschläge sind direkt mit einem **Häkchen** markiert.
- Neue Übersicht **„Meine Auswahl für die Route“** mit allen ausgewählten Zielen.
- Neue Funktion **„Routenvorschlag erstellen“**: legt aus Auswahl, Prioritäten, Reisedauer und geografischer Nähe automatisch eine neue Reiseversion an.
- Der automatische Entwurf erzeugt die notwendigen Planungsbausteine: Highlight-/Stadt-/Wildlife-Stopps, Unterkunfts-Platzhalter, Langstrecken-Verbindungen, Transfers und erste zeitliche Schätzungen.
- Konkrete Buchungsdaten bleiben bewusst offen: Flug-/Zugnummern, Betreiber, Unterkunftsadressen, Buchungsreferenzen und noch unbestimmte Verkehrsmittel können später ergänzt werden.
- Offene oder nur geschätzte Angaben werden im Planer mit **gelbem ⚠-Hinweis** dargestellt; die Kopfzeile zeigt die Gesamtzahl offener Punkte.
- Wildlife-Ziele werden für den Routenvorschlag nach Möglichkeit automatisch mit einem iNaturalist-Beobachtungscluster im Reiseland verknüpft.
- Wenn die Auswahl für den Zeitraum zu groß ist, werden niedrig priorisierte bzw. geografisch nicht auflösbare Ziele sichtbar als **„nicht eingeplant“** geführt und nicht aus der Wunschliste gelöscht.
- Alte in 1.1.x gespeicherte Wildlife-Zielarten werden beim ersten Start soweit möglich in die neue Wunschliste übernommen.

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
- Detail-Pop-ups für Städte, nationale Sehenswürdigkeiten und Wildlife mit kurzen, prägnanten Informationen und 3–4 Bildern.
- Stadt-Sehenswürdigkeiten laden direkt in der Auswahlliste passende Vorschaubilder nach; Commons dient als Fallback, falls Wikipedia kein Bild liefert.
- Detailansicht optisch überarbeitet: großes Titelbild, Bildleiste, Fakten-Chips und feste Aktionsleiste.
- Langstreckenplanung ist jetzt verkehrsmittelunabhängig: Flug, Zug, Fernbus, Auto/Mietwagen, Camper, Fähre, ÖPNV oder sonstige Verbindung.
- Eingabefelder und Puffertexte passen sich dem Verkehrsmittel an (z. B. Sicherheitskontrolle/Gepäck beim Flug, Bahnhofspuffer beim Zug, Fahrzeugübernahme beim Mietwagen).
- Transfer als eigener Baustein mit Dropdown für ÖPNV, Zug, Bus, Mietwagen, Uber/Rideshare, Taxi, Auto oder Fußweg.
- Transfer speichert reine Fahrzeit plus separaten Zusatzpuffer, Anbieter/Referenz und berücksichtigt beides in der Tagesplanung.
- Tagesplanung unterstützt mehrere freie Zeitfenster an einem Tag, z. B. Sightseeing vor und nach einer Langstreckenverbindung.
- Systemleisten-Fix erneut verschärft: WebView erhält unter Android 15/16 echte native Layout-Abstände für Statusleiste, Navigationsleiste und Display-Cutout; Insets werden beim Start, Fokuswechsel und Resume erneut angewendet.

## 1.1.3
- Nationale Highlights filtern Städte, Gemeinden und Verwaltungseinheiten konsequent heraus.
- Neue gewichtete Highlight-Suche für Wahrzeichen, UNESCO-Welterbe, Nationalparks, Naturwunder, Denkmäler und historische Stätten.
- Alte stadtlastige Highlight-Caches aus 1.1.2 werden automatisch ignoriert.
- Inspiration zeigt zunächst 5 Städte, 5 konkrete Highlights und 5 Tiere.
- „Weitere laden“ erweitert jede Liste in 5er-Schritten; „Weniger“ klappt wieder auf 5 Einträge zurück.
- Erweiterte Listen bleiben in einer scrollbar begrenzten Fläche.
- Städte: bis zu 30 Vorschläge; nationale Highlights: bis zu 40; Wildlife: bis zu 50 Arten.
- Erneuter Statusleisten-Fix mit Window-Insets auf Decor-Ebene plus OEM-Fallback.

## 1.1.2

- Android-Statusleisten-Überlappung erneut behoben: WebView wird nun über echte Systemleisten-Margins statt WebView-Padding positioniert.
- Entdecken trennt jetzt **sehenswerte Städte**, **nationale Highlights** und **Wildlife**.
- Vorschlagslisten wurden auf bis zu 12 Einträge erweitert und sind scrollbar.
- Städte können separat geöffnet werden; dort werden bis zu 15 konkrete Stadt-Sehenswürdigkeiten gesucht und als Sightseeing-Tour auf einen Reisetag übernommen.
- Stadtrundgänge können eine Unterkunft als Startpunkt verwenden und bis zu 12 Stopps enthalten.
- Eigene Unterkunftsverwaltung für Hotel, Airbnb/Ferienwohnung, Hostel, Campingplatz und sonstige Unterkünfte.
- Check-in/Check-out, Adresse, Buchungsreferenz und Koordinaten können gespeichert werden.
- Flughafentransfers können mit Ankunftsflug und Unterkunft verknüpft werden.
- Transfermodi: ÖPNV, Mietwagen, Uber/Rideshare, Taxi und Auto.
- Flughafentransfer wird bei der verfügbaren Sightseeing-Zeit nach Flugankunft berücksichtigt.
- Straßenmodi nutzen OSRM; ÖPNV bleibt in der kostenlosen Version als klar gekennzeichnete Näherung editierbar.

## 1.1.1
- Status- und Navigationsleisten-Inset für Android 15/16 korrigiert
- „Inspiration laden“ zeigt jetzt einen echten Ladezustand und sichtbare Teilerfolge/Fehler
- Sehenswürdigkeiten-Discovery auf robustere Wikipedia-Suche mit Koordinaten und geografischem Fallback umgestellt
- Wildlife-Discovery nutzt primär die OpenStreetMap-Bounding-Box; iNaturalist-Place-Suche bleibt als Fallback
- Wikimedia-Requests erhalten einen regelkonformen identifizierbaren User-Agent
- Netzwerkfehler zeigen Datenquelle, HTTP-Status und kurze Servermeldung
- GitHub Actions auf checkout@v5 und setup-java@v5 aktualisiert

## 1.1.0
- GitHub-Repository fest auf `wasserratte96-web/unser-reiseplaner` konfiguriert
- automatische Update-Prüfung über GitHub Releases
- Update-Bereich in den App-Einstellungen
- APK-Download direkt in der Android-App
- Weiterleitung an den Android-Paketinstaller
- automatische JSON-Sicherung vor jedem In-App-Update
- GitHub Actions für signierte Release-APKs
- automatischer Debug-Build bei Änderungen auf `main`
- dauerhafte Release-Signierung über GitHub Actions Secrets vorbereitet

## 1.0.0

Erste vollständige Projektversion:

- allgemeines Reise-Datenmodell
- mehrere Reisen und Versionen
- Reisezeiträume
- Tagesplaner mit Zeitbudget
- Stopps und Transportarten
- Routing
- Kartenansicht und Tagesfilter
- Sehenswürdigkeiten-Discovery
- Wildlife-Discovery und Hotspots
- Stadt-Rundgang-Vorschläge
- Öffnungszeiten
- Wikimedia-Fotos
- manuelle Flüge + kostenlose Routen-Erkennung
- SQLite-Speicherung
- Backup / Import
- Australien-Nordroute als Beispielreise
