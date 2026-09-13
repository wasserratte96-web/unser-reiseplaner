# Prüfbericht 1.4.0

## Grundlage und Status

Grundlage ist GitHub main `646f92b607ecc81b3cbc640878367c55cb485121` (1.3.1). Alle 55 Quelldateien dieses Stands einschließlich `app/lint.xml` wurden abgeglichen. Die Entwicklung erfolgt separat; das Update verändert bestehende Reisen nicht automatisch.

48 automatisierte Funktionstests bestehen. Dazu gehören sämtliche 31 bisherigen Tests. Neue Prüfungen behandeln Migration, Länderfilter, eigene Orte, Schutz vor verspäteten Suchantworten, Teilausfälle, Tieridentitäten, Mehrländer-Routen, manuelle Reihenfolge, Aktivitätenbudget und Fotozeitfenster einschließlich späterer Änderungen im tatsächlichen Tagesplaner. Versions- und Strukturprüfung sowie Shell-Syntax werden durch `tools/verify.sh` geprüft.

Android-Prüflauf erfolgreich: https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/34757929864

Geprüfter Commit: `d9b74a78bebd28865f7431b5d18ee42c022bf202`, Vorschlag: https://github.com/wasserratte96-web/unser-reiseplaner/pull/2 . Der Workflow führt Struktur-/Versionsprüfung, alle 48 Funktionstests sowie `assembleDebug`, `lintDebug`, `assembleRelease` und `lintRelease` aus. Die installierbare Veröffentlichung mit dem bisherigen Release-Schlüssel erfolgt erst über den mitgelieferten Termux-Weg. Eine Debug-Prüf-APK ist kein signiertes Update der installierten Release-App.

Nach dem geprüften Commit werden ausschließlich Prüfdokumentation und Paketprüfsummen ergänzt. App-Code, Tests, Gradle und Workflows des ZIPs werden mit dem geprüften Commit abgeglichen.

## ZIP und Update-Probelauf

Das vollständige Paket enthält 62 Dateien. Aus einem separat entpackten ZIP bestehen alle 48 Tests; Dateiprüfsummen sind geprüft. Ein Probelauf mit einem separaten 1.3.1-Checkout bestätigt den Quellcode-Backup, die Übernahme aller Update-Dateien und den Erhalt lokaler SDK-Konfiguration, Schlüsseldateien und Build-Zusatzdateien. Bei eigenen Änderungen wurde das Einspielen wie vorgesehen abgebrochen. Dabei wurden keine Commits zum Hauptzweig übertragen und kein Release veröffentlicht.

## Grenzen

Die automatische Freigabeprüfung hat den Browserzugriff auf die lokale Test-App abgelehnt. Eine visuelle Browser- oder Android-Geräteprüfung konnte hier deshalb nicht durchgeführt werden. Automatisierte Logiktests bestätigen keine Bedienbarkeit oder Bildqualität auf einem realen Gerät. Es wurde kein alternativer Browserzugang zur Umgehung verwendet.

Öffentliche externe Datenquellen werden mit kontrollierten Testantworten geprüft. Die tatsächliche Live-Abdeckung jedes Landes oder Tieres ist damit nicht bestätigt. Ein Tierartentreffer belegt kein lokales Vorkommen; historische Beobachtungszahlen sind keine Sichtungswahrscheinlichkeit.

Länder sind im Datenmodell und der Suche kombinierbar. Der Generator rechnet innerhalb seiner eingegebenen Tageszeiten. Er berechnet keine Zeitzonenwechsel, Einreisebedingungen, Fahrberechtigungen oder reale Flug-/Fährfahrpläne. Länderwechsel und geschätzte Verbindungen bleiben als offene Angaben gekennzeichnet. Fotozeitfenster werden manuell eingegeben; Sonnenstand, Geländeabschattung und Wetter sind noch nicht integriert. Die Tier-Inspiration startet mit Säugetieren, während die manuelle Suche weitere Tiergruppen unterstützt. Der Beobachtungsmonat wird bisher vom Reisebeginn abgeleitet; bei Monatswechseln ist eine genauere Zuordnung zum tatsächlichen Besuch nötig.

## Geräteprüfung: Pixel 6 Pro / Android 17

1. In der bisherigen App ein JSON-Backup exportieren; signiertes 1.4.0-Update über die bestehende Installation installieren.
2. Alte Reisen öffnen: Daten, Varianten, Flüge, Unterkünfte, Transfers und Kartenfilter vergleichen.
3. Neue Reise Deutschland + Österreich anlegen. „Salzburg“ suchen, Treffer zuordnen, Muss-Priorität und Aufenthalt setzen. Weltweit „Venedig“ hinzufügen: Italien ergänzt die Reiseländer.
4. Eigenen Ort ohne Koordinaten speichern: Standort bleibt offen. Nachträglich Koordinaten ergänzen, Route neu erzeugen. Ungültige Koordinaten werden abgewiesen.
5. Tier über deutschen und wissenschaftlichen Namen suchen. Ohne Nachweis darf keine erfundene Position entstehen. Quellen-/Netzfehler sind sichtbar.
6. Wunschliste ordnen; neue Route in dieser Reihenfolge erzeugen. Ursprüngliche Variante unverändert öffnen. Länderwechsel und offene Buchungsdaten prüfen.
7. Einen Fotowunsch mit 60 Minuten Aufenthalt und Fenster 17:00–18:30 anlegen. Tagesplan muss innerhalb dieses Fensters bleiben. Zu kurzes Fenster wird abgewiesen oder mit Begründung nicht eingeplant.
8. Entdecken/Plan im Hoch- und Querformat, große Android-Schrift, geöffnete Tastatur und TalkBack prüfen. Hauptaktionen müssen erreichbar sein; Status- und Navigationsleiste dürfen Inhalte nicht überlagern.
9. Flugmodus: gespeicherte Reise bearbeiten; fehlende externe Daten dürfen nicht zum Datenverlust führen. Backup exportieren/importieren und eine Variante unabhängig ändern.

Diese Geräteprüfung steht aus. Ergebnisse zusammen mit App-Version und konkreten Schritten dokumentieren.
