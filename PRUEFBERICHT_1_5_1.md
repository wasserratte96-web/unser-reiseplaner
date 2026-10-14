# Unser Reiseplaner – drei Prüf- und Verbesserungsdurchgänge

Stand: 13.10.2026. Ausgangsversion: **1.5.0**. Ergebnis: **1.5.1**.

## Ergebnis und Umfang

Die vollständigen Reiseabläufe wurden mit echten Klicks und Eingaben in Chromium ausgeführt. Die Prüfung kombiniert automatisierte Browserbedienung, Auswertung sichtbarer Inhalte, Screenshot-Kontrolle und gezielte Tests der Planungslogik. Sie ist keine unabhängige Nutzungsstudie und kein Test der installierten APK auf einem Pixel.

Der lokale Browser konnte in dieser Umgebung nicht installiert werden; der Cloud-Browser konnte den lokalen Testserver nicht erreichen. Die Browserläufe wurden deshalb über GitHub Actions ausgeführt. Alle Reisen, Orteingaben und Buchungsreferenzen in den Tests sind synthetische Testdaten.

- Ausgangspunkt: main-Commit `b1daea032153b434e361008869c3f6039438833b`; alle 70 Dateien mit dem bereitgestellten 1.5.0-Paket abgeglichen.
- Geprüfter endgültiger App-Code: `61411b6a6f4ef3a68087ee9a7dc5ac4e353f4f33`.
- Arbeitszweig: `codex/usability-1.5.1`; Entwurfs-PR: https://github.com/wasserratte96-web/unser-reiseplaner/pull/4
- Änderungen werden als eigenes Update 1.5.1 geliefert. main und der installierte App-Stand wurden durch diese Arbeit nicht aktualisiert.

## Durchgang 1 – vollständige Einstiegsabläufe

Browserlauf: https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/38408845992

Zehn Szenarien, 28 Prüfpunkte: **22 bestanden, 6 beanstandet**. Ein Fitz-Roy-Ablauf brach an der nicht übernommenen Vorlagenauswahl ab. Die ersten 58 Funktionstests waren weiterhin erfolgreich; allein hätten sie diese Bedienungsprobleme nicht entdeckt.

| Beobachtung / Reproduktion | Auswirkung | Korrektur |
| --- | --- | --- |
| Erststart ohne gespeicherte Daten | Ungefragt erschien eine vollständig ausgefüllte Australien-Beispielreise. | Neue Installationen starten mit Reise finden. Bereits gespeicherte Reisen bleiben erhalten. |
| Neue Reise → ÖPNV; Wunsch → Ausflugsvorlage, jeweils schnelle Auswahl | Formularaktionen waren erst nachträglich aktiv. Auswahl konnte vor der Registrierung der Ereignisse erfolgen; Extras bzw. Vorlage reagierten dann nicht. | Formulare sind unmittelbar nach dem Öffnen bedienbar. Vorlagenauswahl bleibt sichtbar. |
| Jahresplaner → Suchtext und Dauer eingeben → Suchrichtung wechseln | Die aktuellen Eingaben verschwanden. | Die aktuellen Formularwerte werden vor dem Richtungswechsel übernommen und gespeichert. |
| Jahresplaner → Nur ÖPNV | Bekanntermaßen unpassende Profile wurden weiterhin angezeigt. | Diese Profile werden ausgefiltert. Profile mit unbekanntem Zugang bleiben ausdrücklich als ungeprüft gekennzeichnet. |
| Eigenen Wunsch ohne Besuchsort anlegen → Route erzeugen | Der unbestimmte Wunsch erschien schon als zeitlich geplanter Besuch. | Erst Besuchsort oder Ausgangsort/Zugang ergänzen. Bis dahin bleibt der Wunsch mit einer konkreten Begründung offen. |

Zusätzlich bei der Bearbeitungsprüfung korrigiert: Das Umbenennen eines eigenen Wunsches behält dessen Ausgangsort, Hin-/Rückweg und Fotoangaben. Dieser Erhalt wurde im zweiten Lauf über die Oberfläche bestätigt.

## Durchgang 2 – Buchungen, Grenzen und Fehlerfälle

Browserlauf: https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/38409711845

16 Szenarien, 48 Prüfpunkte: **45 bestanden, 3 beanstandet**. Die Beanstandungen aus dem ersten Durchgang waren behoben.

| Reproduktion | Befund | Korrektur |
| --- | --- | --- |
| Unterkunft für die ganze Reise buchen → Fitz-Roy-Ausflug ergänzen | Jede gebuchte Nacht sperrte den gesamten Tag; kein Ausflug passte mehr hinein. | Nächte allein sperren die Ausflugstage nicht mehr. Bestehende Aktivitäten und Verbindungstage bleiben geschützt. Der Ausgangsort muss zur Unterkunft passen. |
| Zwei Ausflüge mit je 240 Minuten Gehzeit; Tagesgrenze 300 Minuten | Beide passten auf denselben Tag, weil die Grenze nur pro Ausflug galt. | Die Summe aller geplanten Ausflugswege wird pro Tag begrenzt. Bei reinen Fußwegen zählt mindestens Hinweg plus Rückweg. |
| Zwei Aktivitäten an verschiedenen Orten, kein gespeicherter Verbindungsweg | Die zweite Aktivität erschien direkt anschließend mit scheinbar gesicherter Uhrzeit. | Fehlende Wegzeiten sind sichtbar. Daraus abhängige automatische Zeiten bleiben offen; manuell festgelegte Termine behalten ihre Zeit. |

Screenshot-Kontrolle führte zu weiteren konkreten Verbesserungen: Wunschaktionen können auf kleinen Displays umbrechen; der Ausgangsort steht bereits in der Wunschkarte; Rückgängig und Toast-Rückmeldungen überlagern sich nicht mehr. Koordinaten im Ausflugsformular sind aufklappbar. Eigene Orte lassen sich über gewählte Suchtreffer verorten.

## Durchgang 3 – Abnahme und gezielte Anschlussprüfungen

Der erste Abschlusslauf umfasste 18 Szenarien und **54 erfolgreiche Prüfpunkte**:
https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/38410713795

Die anschließende Kontrolle des durchgängigen Jahresplaner-Ablaufs zeigte noch eine Lücke: Ein aus einem Regionsprofil übernommener, zunächst unverorteter Ausgangsort musste ebenfalls bearbeitbar sein. Das wurde ergänzt. Außerdem wurde gezielt abgesichert, dass eine unbekannte Wegzeit keine manuell festgelegte Terminzeit verdeckt. Daher enthält dieser dritte Durchgang mehrere Prüfläufe; es sind nicht nur drei einzelne CI-Ausführungen.

**Endgültiger Abschlussstand:** 19 vollständig durchlaufene Browser-Szenarien, **57 von 57 Prüfpunkten bestanden**, keine abgefangene JavaScript-Laufzeitausnahme. Zusätzlich **63 von 63 Funktionstests bestanden**; Android-Debug- und Release-Build sowie lintDebug und lintRelease erfolgreich.

- Browser-Abschluss: https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/38411517866
- Android-Abschluss: https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/38411518075
- Beide Läufe prüften den oben genannten endgültigen App-Code. Alle 75 versionierten Dateien wurden mit dessen Git-Objekthashes verglichen; zum Zeitpunkt des Abgleichs wich nur die inzwischen ergänzte Termux-Anleitung ab. Anschließend wurden Abschlussdokumentation und Paketnachweise ergänzt sowie das unten beschriebene Update-Skript korrigiert. Der eigentliche App-Code blieb unverändert.
- Maschinenlesbare Ergebnisse: `docs/qa-1.5.1/round3-final.json`; ausgewählte Buildnachweise: `docs/qa-1.5.1/build-final-extract.txt`.

Die 57 Browser-Prüfpunkte enthalten auch Laufzeit- und Breitenkontrollen; sie sind keine 57 unabhängigen Reisen. Durchgang 1 und 2 dienten ausdrücklich dem Auffinden und Beheben von Problemen.

### Abgedeckte Abläufe

1. Erststart ohne Beispielreise; Navigation außerhalb einer konkreten Reise.
2. Reiseanlage mit Zeitraum, Abreiseort, ÖPNV und zwei Ländern; erneutes Öffnen.
3. Fitz Roy → Laguna Capri → El Chaltén als Ausgangsort → 120 Minuten Hinweg, 45 Minuten Aufenthalt, 120 Minuten Rückweg.
4. Jahresplaner in beiden Suchrichtungen; Eingaben erhalten und Monatsvergleich erklären.
5. Manuelle Suche und Übernahme eines Ortes in die Wunschliste.
6. Fehlgeschlagene Suche: erneuter Versuch und eigener Ort bleiben erreichbar.
7. Wunsch ohne Besuchsort bleibt offen.
8. Entfernten Wunsch rückgängig machen.
9. Ausflugsformular: Bildschirmbreite und Schließen per Escape.
10. Nur-ÖPNV-Filter des Jahresplaners.
11. Gebuchte Nächte erhalten und dennoch einen passenden Ausflug planen.
12. Tägliche Gehzeit über mehrere Ausflüge begrenzen.
13. Langstreckenverbindung anlegen; zwei Kartenpunkte ausdrücklich auswählen; Flughafenhinweise, Kartenmarker und Speicherung prüfen.
14. Fotozeitfenster einschließlich Hin- und Rückweg einhalten.
15. Fehlende Wege zwischen Aktivitäten sichtbar machen.
16. Backup exportieren und wieder importieren.
17. Eigenen Ort ohne Abtippen von Koordinaten über einen Suchtreffer verorten.
18. Wunschkarte und Ausflugsformular bei 360 Pixel Bildschirmbreite bedienen.
19. Jahresplaner → Reiseanlage → Ausgangsort suchen → Tagesplan erstellen.

Browseransichten: überwiegend 412 × 892 CSS-Pixel, ergänzend 360 × 800. Das simuliert die Darstellung in einem mobilen Browser; es ist keine Pixel-Geräteemulation mit nativer Android-Tastatur.

## Updateweg

Der lokale Shell-Probelauf von 1.5.0 auf 1.5.1 war erfolgreich: Quellcode-Backup angelegt, lokale SDK-Einstellung und ein ausdrücklich künstlicher Testschlüssel erhalten, erneuter Aufruf mit ungesicherten Änderungen abgelehnt. Es wurde kein echter Schlüssel ausgelesen. Dies ist kein Termux-Test auf dem Smartphone.

Beim abschließenden Paket-Probelauf wurde zusätzlich ein Installationsfehler reproduziert: Dateien mit gleichem Änderungszeitpunkt und gleicher Größe konnten trotz geändertem Inhalt übersprungen werden. Das Update-Skript vergleicht die Inhalte jetzt per Prüfsumme. Der erneute Probelauf deckt ausdrücklich auch diesen Fall ab.

Das ZIP enthält den vollständigen Quellcode, diesen Bericht, Changelog, Termux-Anleitung, Prüfsummen und maschinenlesbare Ergebnisse unter `docs/qa-1.5.1/`. Das Manifest dient der Paketvollständigkeit, nicht als digitale Signatur.

## Was ausdrücklich offen bleibt

- **Native Android-Bedienung:** Installation über die vorhandene App, Signatur, native SQLite-Speicherung, Systemleisten, Bildschirmtastatur, Zurück-Geste, Berechtigungen und Android-Dateiauswahl. Build und Lint ersetzen diese Tests nicht.
- **Live-Datenqualität:** Geocoding und Artensuche verwenden in den Browsertests festgelegte Antworten; Fehlerfälle werden gezielt simuliert. Leaflet selbst wird in derselben Version 1.9.4 geladen, Kartenkacheln und externe Bilder werden in diesen Tests nicht aus dem Internet geladen. Die Tests bestätigen weder die aktuelle Erreichbarkeit aller Anbieter noch richtige Fotos, saisonale Daten oder reale Beobachtungschancen.
- **Reisemachbarkeit:** Hin-/Rückwegzeiten sind Planungsbudgets. Der Unterkunftsabgleich nutzt Namen oder eine Entfernung bis 30 km als groben Ortsabgleich. Das beweist keinen begehbaren Weg, keine ÖPNV-Anbindung und keine Zugänglichkeit über Geländegrenzen.
- **Konservative Planung:** Tage mit vorhandenen Aktivitäten, Verbindungen oder Transfers sowie der eingetragene Unterkunfts-Check-in bleiben geschützt. Die App füllt deren verbleibende Stunden nicht automatisch. Kein Fahrplandienst und keine automatische Zeitzonenumrechnung.
- **Wunschänderungen:** Die gespeicherte Variante wird nicht automatisch nachträglich umgeschrieben. Zeit-/Zugangseinstellungen eines Wunsches und bereits erzeugte Tagesaktivitäten sind weiterhin getrennte Angaben.
- **Undo:** Nur die unmittelbar vorherige unterstützte Änderung ist rückgängig; nach weiteren Änderungen kann diese Möglichkeit entfallen.

## Kurze Kontrolle auf deinem Pixel

1. Vor dem Update ein JSON-Backup exportieren; 1.5.1 über die bestehende App installieren.
2. Eine vorhandene Reise öffnen, Tagesansichten aus- und einklappen, Bildschirmtastatur in einem langen Formular öffnen und wieder schließen.
3. Einen eigenen Wunsch suchen/ändern, einen Ausflug öffnen und über die Android-Zurück-Geste zurückgehen.
4. Kartenpunkt und externen Google-Maps-Link öffnen; prüfen, ob Kopf-/Fußleisten und Bedienelemente frei liegen.
5. Backup über die Android-Dateiauswahl exportieren und App vollständig schließen/neu öffnen; Reise muss erhalten bleiben.

Bei einer Abweichung reichen Version, betroffener Schritt und eine kurze Bildschirmaufnahme. Die signierte Veröffentlichung bleibt beim bestehenden Termux-Verfahren.
