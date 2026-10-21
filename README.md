# UX-Überarbeitung 1.5.2

Basis: main 1.5.1. Änderungen: CHANGELOG.md. Updateweg: UPDATE_1_5_2_TERMUX.md. UX-Prüfung und Grenzen: docs/UX_1_5_2.md.

Browserabläufe: `npm install --prefix tests/browser --ignore-scripts`, anschließend `tests/browser/node_modules/.bin/playwright install chromium` und `node tests/browser/walkthrough.cjs`. Die getrennten Browserabhängigkeiten sind für den normalen Termux-Updateweg nicht erforderlich.

# Unser Reiseplaner – Version 1.5.2

Android-App für individuelle Natur-, Wildlife-, Städte- und Fotoreisen. Grundlage ist GitHub-Version 1.5.1 (`18559e155ffe95d349be18a5ed483d0904ddc971`).

## Einstieg

Beim ersten Start führen „Neue Reise planen“ und „Reiseidee finden“ direkt zur gewünschten Aufgabe. Zusätzliche Filter und Formulareinstellungen werden passend zum Bedarf aufgeklappt.

**Reise finden** zeigt passende Regionen für einen Reisemonat oder vergleicht die Jahreszeiten mehrerer Wunschziele. Die Startsammlung umfasst 20 Regionsprofile mit Quellen. Eine Empfehlung ist eine redaktionelle Orientierung; Wetter, Tierbeobachtungen, Tickets und tatsächliche Erreichbarkeit müssen separat geprüft werden.

**Meine Reisen** enthält die gespeicherten Reisen. Eine neue Reise entsteht in drei Schritten: Zeitraum und optionaler Abreiseort, Fortbewegung, Länder. Innerhalb einer Reise gibt es **Wünsche**, **Tagesplan**, **Karte** und **Entdecken**. Varianten stehen im Auswahlmenü oben; Einstellungen und Backup am Zahnrad.

## Wunschziele und Zugang

Jeder Wunsch kann unter „Ausgangsort / Zugang“ eine Basis, Wegart, Hin-/Rückweg, Gehzeit, Quelle und Notizen bekommen. Beispiel Fitz Roy: El Chaltén ist die Basis; Laguna Capri und Laguna de los Tres sind unterschiedliche Ausflüge. Die Vorlagen enthalten eigene konservative Zeitbudgets, keine aktuellen Wegzustände. Ausgangsort und Ziel müssen bei Bedarf auf der Karte gewählt werden. Eine Vorlage setzt keinen Kartenpunkt auf einen vermeintlich erreichbaren Berggipfel.

Der Entwurf reserviert Zeit für Hinweg, Aufenthalt und Rückweg. Fotozeitfenster beziehen sich auf den Aufenthalt. Unbekannte Zugangszeiten bleiben offen. Ein Ortswechsel belegt vorläufig einen Reisetag; bei angegebenem Abreiseort werden An- und Rückreise ebenfalls reserviert. Lange Verbindungen können zusätzliche Tage benötigen. Die App hat keine weltweite Verbindungsdatenbank und bestätigt keine durchführbare Gesamtreise.

Die ursprüngliche Variante bleibt erhalten. Bereits belegte Tage, Übernachtungen und Buchungen werden in die Kopie übernommen. Freie Tage werden ergänzt. Nicht unterzubringende Wünsche bleiben mit Gründen sichtbar. Ändere zur Überarbeitung eines eingeplanten Wunsches dessen Stopp oder erstelle eine frische Variante.

## Verkehrsmittel und Karte

„Öffentliche Verkehrsmittel“ erlaubt Bus, Bahn, Fähre und Fußwege. Flüge sind separat wählbar. Taxi, Shuttle und Tour benötigen den Modus ohne Mietwagen oder Auto sowie ihre jeweilige Freigabe. Bei einer geänderten Fortbewegung werden unpassende bestehende Verbindungen gemeldet; sie werden nicht gelöscht.

Langstrecken-Verbindungen haben Abfahrts- und Ankunftspunkte. Suche den konkreten Flughafen, Bahnhof oder Busbahnhof und wähle den Treffer selbst aus. Die Karte zeigt diese Punkte auch am Ankunftstag. Gestrichelte Linien zeigen eine schematische Verbindung. Für PRG, PER, FTE und CJC gibt es erste Quellenhinweise zu ÖPNV/Shuttles; an anderen Knoten sind eigene Hinweise möglich.

Google Maps öffnet sich extern. Fahrpläne, Verfügbarkeiten und Tickets bleiben bei den jeweiligen Anbietern. Es werden keine ÖPNV-Reisezeiten aus Luftlinien geschätzt. Vorhandene Buchungszeiten können manuell eingetragen werden. OSRM bleibt für Autostrecken verfügbar.

## Update und Prüfung

- Smartphone/Termux: `UPDATE_1_5_0_TERMUX.md`.
- Android Studio: `INSTALLATION_ANDROID_STUDIO.md`.
- Technische Tests: `bash tools/verify.sh`.
- Android-Build und Lint: `bash tools/verify.sh --android` (JDK 21/SDK benötigt).
- Nachweise und Einschränkungen: `PRUEFBERICHT_1_5_0.md`.
- Produktentscheidungen aus der Marktrecherche: `docs/ENTSCHEIDUNGEN_1_5_0.md`.

Die iterative Anwenderprüfung startet erst nach deiner Freigabe einer konkreten Version. Hier liegt kein Test auf deinem Pixel 6 Pro / Android 17 vor.

## Daten und Speicherung

Native Android-Hülle mit WebView und lokaler SQLite-Speicherung, keine Anmeldung und kein Tracking. Externe Karten, Fotos und neue Abfragen benötigen Internet. Recherchequellen: OpenStreetMap/Nominatim/Overpass, Wikimedia und iNaturalist; Saison-/Zugangshinweise zusätzlich von offiziellen Tourismus-, Flughafen- und Betreiberseiten. Quellen stehen bei den Profilen und in `DATENQUELLEN.md`.

Für breitere Verteilung ist ein gemeinsam begrenzter oder eigener Suchdienst erforderlich. Ein Nominatim-kompatibler HTTPS-Endpunkt bleibt in Einstellungen konfigurierbar. Exportiere vor dem Update ein JSON-Backup. Die Debug-APK kann die installierte Release-App nicht als Update ersetzen; dafür bleibt der bisherige signierte GitHub-Releaseweg bestehen.
