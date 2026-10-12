# Technischer Prüfbericht 1.5.0

Stand: 2026-10-12. Basis: 1.4.0, main-Commit e1611d74f9d20e4edb8eb32016c136774b243db3.

## Lokal bestanden

58 automatisierte Funktionstests: die 48 vorhandenen Regressionen sowie zehn zusätzliche Prüfungen. Abgedeckt sind Datenmigration, unabhängige Variantenkopien, Erhalt bestehender Buchungen/Übernachtungen, ÖPNV- und Flugfreigaben, Hin-/Rückweg und Gehzeit, Fotozeitfenster im tatsächlichen Tagesmodell, unbekannte Zugangsdauer, Rückreise-Reservierung, Kartenpunkte am Ankunftstag und Aktualisierung verknüpfter Transfers nach Terminaländerung.

`bash tools/verify.sh` prüft zusätzlich Dateivollständigkeit, JavaScript-Syntax, Versionskonsistenz und Shell-Syntax. Ergebnis: erfolgreich.

## Android-Build

Der Android-Build mit Debug/Release und Lint wird separat über den bestehenden GitHub-Workflow geprüft. Der endgültige Nachweis wird im ausgelieferten Updatepaket ergänzt. Kein signierter Release wurde durch diese Arbeit veröffentlicht; der vorhandene Termux-Releaseweg bleibt unverändert.

## Grenzen

Keine iterative Anwenderprüfung, keine Browser-Nutzungsdurchgänge und kein Pixel-/Android-17-Gerätetest durchgeführt. Diese Prüfung beginnt erst nach Freigabe des Nutzers für eine konkrete Version. Automatisierte Tests sind kein Nachweis für gute Bedienbarkeit.

Der Katalog enthält 20 redaktionelle Regionsprofile und vier Flughafenhinweise. Er ist keine weltweite Reise- oder Verkehrsdatenbank. Ein vorläufiger Reisetag bestätigt nicht, dass eine konkrete Verbindung an diesem Tag existiert. Öffnungszeiten, Tickets, Sperrungen, Wetter und Tierbeobachtungen sind vor der Reise zu prüfen. Frei eingegebene Buchungszeiten werden nicht über Zeitzonen umgerechnet.

Die ursprüngliche Variante bleibt beim neuen Entwurf erhalten. Vor dem Update ein JSON-Backup exportieren. Einzelne Rückgängig-Aktionen sind sitzungsgebunden und werden bei nachfolgenden anderen Änderungen verworfen.
