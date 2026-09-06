# Changelog

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
- Erste vollständige lokale Android-Version
