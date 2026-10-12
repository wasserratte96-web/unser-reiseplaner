# Technischer Prüfbericht 1.5.0

Stand: 2026-10-12. Basis: 1.4.0, main-Commit e1611d74f9d20e4edb8eb32016c136774b243db3.

## Lokal bestanden

58 automatisierte Funktionstests: die 48 vorhandenen Regressionen sowie zehn zusätzliche Prüfungen. Abgedeckt sind Datenmigration, unabhängige Variantenkopien, Erhalt bestehender Buchungen/Übernachtungen, ÖPNV- und Flugfreigaben, Hin-/Rückweg und Gehzeit, Fotozeitfenster im tatsächlichen Tagesmodell, unbekannte Zugangsdauer, Rückreise-Reservierung, Kartenpunkte am Ankunftstag und Aktualisierung verknüpfter Transfers nach Terminaländerung.

`bash tools/verify.sh` prüft zusätzlich Dateivollständigkeit, JavaScript-Syntax, Versionskonsistenz und Shell-Syntax. Ergebnis: erfolgreich.

## Android-Build

Erfolgreich am 12.10.2026 über den bestehenden GitHub-Workflow geprüft: `assembleDebug`, `lintDebug`, `assembleRelease`, `lintRelease` sowie die 58 Funktionstests und Projektprüfung.

- Geprüfter Commit: `95816a636fb39a2590f79d5c5f566d736598be93`.
- Prüfzweig: `codex/journey-planner-1.5.0`, Entwurfs-PR #3.
- Build: https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/38302714023
- Geprüfte App-Version: 1.5.0, lokaler Versionscode 12.

App-Code, Tests und Build-Konfiguration im ZIP entsprechen diesem geprüften Commit. Nach dem Prüflauf wurden nur dieser Bericht, die Ergebniszusammenfassung und das Paketmanifest ergänzt. Die ZIP-Datei enthält alle 70 Projektdateien; jede Datei ist über das Manifest bzw. den ZIP-Abgleich geprüft.

Kein signierter Release wurde durch diese Arbeit veröffentlicht. Die APK zum Aktualisieren der bestehenden Installation wird über `tools/publish-mobile.sh 1.5.0` mit den bisherigen GitHub-Secrets gebaut und signiert. Der Workflow vergibt dabei den fortlaufenden Release-Versionscode. Die Debug-APK ist nicht als Update der vorhandenen Release-App geeignet.

## Termux-Updateweg

Der vorhandene 1.4.0-Ausgangsstand wurde anhand aller 62 Dateien mit GitHub-main abgeglichen. Ein isolierter Probelauf des Update-Skripts auf diesem Stand hat alle 70 Projektdateien übernommen, den bisherigen committeten Quellcode gesichert und lokale SDK-Einstellungen, ein Test-Schlüsselmaterial und lokale Builddateien erhalten. Eigene uncommittete Änderungen führten vor jeder Übernahme zum Abbruch. Dafür wurden keine echten Signaturschlüssel benötigt. Das ist ein Shell-Probelauf im Entwicklungscontainer, kein Test auf dem Smartphone.

## Grenzen

Keine iterative Anwenderprüfung, keine Browser-Nutzungsdurchgänge und kein Pixel-/Android-17-Gerätetest durchgeführt. Diese Prüfung beginnt erst nach Freigabe des Nutzers für eine konkrete Version. Automatisierte Tests sind kein Nachweis für gute Bedienbarkeit.

Der Katalog enthält 20 redaktionelle Regionsprofile und vier Flughafenhinweise. Er ist keine weltweite Reise- oder Verkehrsdatenbank. Ein vorläufiger Reisetag bestätigt nicht, dass eine konkrete Verbindung an diesem Tag existiert. Öffnungszeiten, Tickets, Sperrungen, Wetter und Tierbeobachtungen sind vor der Reise zu prüfen. Frei eingegebene Buchungszeiten werden nicht über Zeitzonen umgerechnet.

Die ursprüngliche Variante bleibt beim neuen Entwurf erhalten. Vor dem Update ein JSON-Backup exportieren. Einzelne Rückgängig-Aktionen sind sitzungsgebunden und werden bei nachfolgenden anderen Änderungen verworfen.
