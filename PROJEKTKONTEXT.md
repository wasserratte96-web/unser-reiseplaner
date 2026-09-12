# Verbindlicher Projektkontext

## Produkt und bisherige Entscheidungen

„Unser Reiseplaner“ ist eine universelle Android-App für Reise- und Roadtripplanung in beliebigen Ländern. Paketkennung `de.unserreiseplaner.app`; Repository `wasserratte96-web/unser-reiseplaner`. Der native Java-Rahmen mit WebView und lokaler SQLite-Speicherung bleibt erhalten. Ein installierbares lokales APK genügt; Updates sollen vollständig per Smartphone mit Termux/GitHub Actions und anschließend innerhalb der App möglich sein.

Entdecken ist der Einstieg für Menschen ohne fertige Route: zuerst Städte, Natur-/nationale Highlights und Wildlife kennenlernen, dann mit Häkchen in eine reiseweite Wunschliste übernehmen und mit Muss/Hoch/Mittel/Optional priorisieren. Eine Auswahl ist noch kein fest gebuchter oder tagesgebundener Stopp. Daraus entstehen eigenständig bearbeitbare Routenvarianten.

Reisezeitraum, Flugnummer oder manuelle Flugdaten, verschiedene Transportarten, sichtbare Entfernungen/Dauern, Unterkünfte, Transfers, Stoppreihenfolge, mehrere Reisen und Versionen, Vergleich, Kartenmarker mit Bildern/Kurzinfos, Tagesfilter, farbige Linien und einklappbare Tagesbereiche gehören zum vorhandenen Funktionsumfang und dürfen nicht durch einen Neuaufbau verlorengehen.

Automatische Entwürfe brauchen Tageszuordnung, Verbindungen, Unterkunfts- und Transferbausteine sowie Highlights/Wildlife. Fehlende Buchungsnummern, Adressen, Betreiber und unbestätigte Zeiten bleiben offen. Gelbe Warnhinweise zeigen an, was noch ergänzt oder geprüft werden muss. Unpassende Wünsche bleiben sichtbar und werden nicht still gelöscht.

## Fehlerbilder, die erhalten bleiben müssen

- Nicht oder endlos ladende Marker-/Städtebilder und wirkungslose Ladebuttons.
- Überlagerung durch Android-Statusleisten.
- Städte in der Kategorie nationale Highlights.
- Falsche geografische Zuordnung, etwa Melbourne-Auswahl mit Sydney-Inhalt.
- Titel-/Text-/Bild-Mischung, etwa Feuerwehrmuseum mit Prince-Inhalt.
- Unleserliche Karten, fehlende Tagesfilter und fehlende Einklappbarkeit.

Die Fehlerbeschreibungen stammen aus dem verfügbaren Projektverlauf. Die Originalscreenshots sämtlicher UI-Fehler waren nicht vorhanden. Die verfügbare Datei `Screenshot_20260906-130123.png` zeigt die damalige Termux/GitHub-Einrichtung; sie wurde geprüft, ist aber kein Screenshot der App-Oberfläche.

## Australien als Referenzreise, nicht als globale Einschränkung

Die bestehende Beispielreise und die Nutzervorgaben bleiben relevant: rund zwei Wochen im April, Sydney und Melbourne jeweils etwa ein Tag, Great Ocean Road wegen Koalas, Western Australia mit Camper, Quokkas, Kängurus und Wallabys. Gewählte WA-Nordroute mit Hutt Lagoon, Pinnacles, Kalbarri und Shell Beach. Uluru wurde aus dieser Planung gestrichen. Land-Wildlife steht im Vordergrund; Wasser-Wildlife ist für diese Referenzreise kein Schwerpunkt.

Diese Wünsche dürfen nicht als fest codierte Einschränkungen für sämtliche neuen Länder und Reisen übernommen werden. Der neue Generator liest die jeweilige Wunschliste und ihre Prioritäten.

## Quellenstand und Fortsetzung

Am 10. September 2026 wurde der verbundene GitHub-Stand geprüft: Commit `d07691e0537ab1414606609edfe5499d839f0243` enthält 1.3.0 und stimmt in allen 51 Dateien mit der gelieferten Arbeitskopie überein. Der anschließend fehlgeschlagene Build `34498507782` meldet `sdkmanager: command not found`. Version 1.3.1 korrigiert die SDK-Einrichtung und unterstützt das Fortsetzen des Smartphone-Updates von Quellstand 1.3.0. Gerät: Pixel 6 Pro, Android 17; installierte Ausgangsversion laut Nutzer 1.2.0. Die folgenden Absätze dokumentieren den früheren Kenntnisstand bei Erstellung von 1.3.0.

Alle acht verfügbaren Quellcodepakete wurden gegenübergestellt: 1.0.0, 1.1.0, 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.1.5, 1.2.0. Grundlage von 1.3.0 ist das vollständige 1.2.0-Paket, nicht die ältere eigenständige README-Datei 1.1.4. `QUELLSTAND.json` enthält die SHA-256-Prüfsummen der Ausgangspakete.

Der vollständige Wortlaut aller früheren Chats und der aktuelle Remote-Commit lagen nicht vor. Verfügbarer Gesprächskontext, Anforderungen, Versionen und Fehlerbeschreibungen wurden berücksichtigt; nicht belegbare frühere Entscheidungen wurden nicht erfunden. Eine belastbare Auswertung des App-Marktvergleichs vom 6. September lag ebenfalls nicht vor und wird nicht als bereits umgesetzter Backlog ausgegeben.

Bei jeder folgenden Version: vorhandene Funktionen zuerst prüfen, passende Regressionstests für konkrete Risiken ergänzen, Versionsnummern synchron anheben, historische Changelog-Einträge erhalten, vollständiges Projekt-ZIP inklusive Build-/Termux-Weg liefern und tatsächlich durchgeführte Prüfungen von noch offenen Geräte-/Buildprüfungen unterscheiden.
