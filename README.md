# Unser Reiseplaner – Version 1.3.0

Vollständiges Android-Quellcodeprojekt auf Basis von Version 1.2.0. Schwerpunkt: aus Prioritäten eine zeitlich nachvollziehbare Route erzeugen und bekannte Fehler ohne Verlust der vorhandenen Funktionen beheben.

## Was sich ändert

- Wunschliste mit Muss/Hoch/Mittel/Optional sowie Aufenthaltstagen und Besuchsdauer je Ziel. Städte, nationale Highlights und Wildlife bleiben getrennt. Highlights umfassen Naturziele, Wahrzeichen, Welterbe und historische Stätten.
- Neuer Routenkern plant Aufenthalte, Fahrten, Pausen, Transfers und Übernachtungen gemeinsam. Start- und Endziel, Auto/Mietwagen/Camper und maximale tägliche Fahrzeit sind einstellbar.
- Lange Autofahrten können über mehrere Tage verteilt werden. Flüge für große Entfernungen lassen sich abschalten. Es werden keine Zugverbindungen allein aus einer Entfernung abgeleitet.
- Nicht passende Wünsche bleiben mit Begründung sichtbar; ausgelassene Muss-Ziele werden hervorgehoben. Zusätzliche freie Tage bleiben als solche erkennbar.
- Unterkunftsbausteine decken die Nächte ab. Fortlaufende Nächte am selben Ort teilen einen Baustein. Konkrete Hotels, Adressen und Buchungsdaten bleiben ergänzbar.
- Fehler bei Wildlife-Koordinaten 0,0, falschen Tagesblockierungen und positiven Puffern trotz Zeitkonflikt sind behoben.
- Datenquellen verwenden geprüfte Gebiete und IDs. Wildlife-Hotspots stammen aus echten öffentlichen Beobachtungsorten. Nicht belastbare Bilder/Inhalte werden nicht willkürlich ersetzt.
- Abbrechen verwirft Dialogentwürfe. Geschätzte Zeiten müssen ausdrücklich geprüft werden. „Keine“ im Kartenfilter bleibt leer; eingeklappte Tage bleiben eingeklappt.

Bestehende Reiseversionen, manuelle Verbindungen/Flüge, Stadttouren, Karten, SQLite-Speicherung, Backups, Vergleich und In-App-Updater bleiben erhalten. Der automatische Entwurf ist eine neue Version; bestehende Buchungen werden nicht automatisch in ihn übernommen.

## Prüfen und bauen

Ohne zusätzliche JavaScript-Pakete, mit Node.js ab Version 22:

```bash
bash tools/verify.sh
```

Mit Android SDK 36 / Build Tools 36.0.0 und JDK 21:

```bash
bash tools/verify.sh --android
```

Alternativ den entpackten Projektordner in Android Studio öffnen. `INSTALLATION_ANDROID_STUDIO.md` beschreibt den Build. `UPDATE_1_3_0_TERMUX.md` beschreibt den vollständigen Smartphone-Weg.

## Inhalt und Prüfstatus

- `CHANGELOG.md`: neue Änderungen und rekonstruierte Versionshistorie.
- `PROJEKTKONTEXT.md` / `QUELLSTAND.json`: verbindliche Anforderungen und Ausgangspakete.
- `DATENQUELLEN.md`: Zuordnung, Schätzungen und Grenzen der Anbieter.
- `PRUEFBERICHT_1_3_0.md`: durchgeführte Tests und noch offene Prüfungen.
- `tests/`: Regressionen und Datenquellenverträge; `tools/`: Prüfung und Smartphone-Update.
- Native App, Ressourcen, Web-Oberfläche, Gradle-Wrapper und beide GitHub-Workflows sind vollständig enthalten.

**Noch kein nachgewiesener APK-Build dieser Lieferung:** In der Entwicklungsumgebung war der Gradle-/SDK-Zugriff nicht möglich; die visuelle Browserprüfung war gesperrt. Es wurde keine APK gebaut oder veröffentlicht. Erst der erfolgreiche mitgelieferte CI-Ablauf plus Android-Geräteprüfung bestätigt die installierbare Version. Details und weiterhin offene Produktgrenzen stehen im Prüfbericht.
