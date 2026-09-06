# Unser Reiseplaner

Private Android-App zur Planung von Roadtrips und Reisen weltweit.

## Aktueller Stand
Version 1.1.0 ergänzt eine vollständige Update-Infrastruktur für das öffentliche Repository:

https://github.com/wasserratte96-web/unser-reiseplaner

Enthalten sind:
- Reise- und Versionsverwaltung
- Tagesplanung, Stopps, Flüge und Zeitbilanz
- Karten- und Routingfunktionen
- Sehenswürdigkeiten- und Wildlife-Discovery über kostenlose Datenquellen
- lokale SQLite-Speicherung und JSON-Backups
- GitHub-Actions-Builds
- dauerhaft signierbare Release-APKs
- In-App-Prüfung auf GitHub Releases
- In-App-Download und Übergabe an den Android-Installer

## Wichtig
Keystore-Dateien (`*.jks`, `*.keystore`) und Passwörter dürfen niemals in dieses Repository committed werden. Die `.gitignore` blockiert die üblichen Dateinamen zusätzlich.

Die einmalige Update-Einrichtung ist in `UPDATE_EINRICHTUNG_GITHUB.md` beschrieben.
