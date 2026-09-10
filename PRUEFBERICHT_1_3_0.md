# Prüfbericht – Unser Reiseplaner 1.3.0

Stand: 9. September 2026. Ausgangspunkt: vollständiges Quellcode-ZIP 1.2.0 vom 6. September 2026. Die acht vorhandenen Pakete 1.0.0 bis 1.2.0 wurden lokal verglichen. Der aktuelle Remote-Stand von GitHub konnte ohne verbundene GitHub-Anwendung nicht abgeglichen werden.

## Ergebnis und Grenzen

31 automatisierte JavaScript-Funktionstests bestanden. Struktur-/Versionsprüfungen, Shell-Syntax und die YAML-Struktur beider GitHub-Workflows einschließlich ihrer 12 Shell-Schritte wurden ebenfalls geprüft. Die lokalen Projektprüfungen sind reproduzierbar mit:

```bash
bash tools/verify.sh
```

Das Update-Skript wurde zusätzlich mit einer separaten, lokalen Git-Kopie des Quellstands 1.2.0 ausgeführt: vollständige Übernahme aller Projektdateien, Sicherung des bisherigen committeten Quellcodes, Erhalt eigener Zusatzdateien sowie lokaler SDK-/Signaturdateien bestanden. Checkouts mit ungesicherten Änderungen und bereits aktualisiertem Versionsstand wurden abgewiesen. Das war ein Linux-Probelauf des Smartphone-Skripts, kein Test auf einem physischen Termux-Gerät. Dabei wurden keine GitHub-Schreibaktionen ausgeführt.

Der Android-Build ist in dieser Umgebung **nicht nachgewiesen**. Bereits der unveränderte Ausgangsstand konnte Gradle nicht herunterladen (`UnknownHostException: services.gradle.org`); ein Android-SDK und ein Java-Compiler stehen lokal nicht bereit. Eine APK ist daher weder beigefügt noch veröffentlicht.

Auch die visuelle Browserprüfung konnte nicht ausgeführt werden: Der Cloud-Browser erreicht den lokalen Server nicht; die Browserregel sperrt den Zugriff auf die lokale Prüfdatei. Das wurde nicht umgangen. JavaScript-Tests ersetzen keine Android-Geräteprüfung.

Die bisherige Kombination aus AGP 9.3.0, Gradle 9.5.0 und API 36 wird beibehalten. Die [offizielle AGP-Kompatibilitätstabelle](https://developer.android.com/build/releases/agp-9-3-0-release-notes) nennt Gradle 9.5.0, Build Tools 36.0.0 und JDK 17 als Mindeststand. Die vorhandene CI verwendet weiterhin JDK 21; damit wird auch die in den Release Notes beschriebene Lint-Problematik von AGP 9.3 unter JDK 17 vermieden.

## Reproduzierte Fehler des Ausgangsstands

1. `null`-Koordinaten wurden durch numerische Umwandlung als 0,0 behandelt; der Wildlife-Hotspot-Aufruf entfiel dadurch.
2. Eine späte Fixzeit konnte über das Tagesende hinauslaufen, während die Summenanzeige noch positiven Puffer meldete.
3. Unterkunftsfilter schlossen die Check-out-Nacht fälschlich ein.
4. Die zeitliche Sperre einer Verbindung konnte auf davor- oder danachliegende Reisetage ausgedehnt werden.
5. Der alte Generator startete mehrere Verbindungen zur selben Uhrzeit und klemmte überzählige Ziele auf den letzten Tag.
6. Änderungen im Verbindungs-/Transferdialog konnten das Original bereits vor „Speichern“ verändern.
7. „Keine“ im Kartenfilter wurde beim Rendern wieder zu „Alle“.

Die ursprüngliche unabhängige Kopie einer Reiseversion inklusive neuer Verbindungs- und Unterkunftsreferenzen blieb erhalten und wird weiterhin geprüft.

## Abdeckung

- Kalenderberechnung einschließlich Sommerzeitwechsel, Schaltjahr und ungültiger Daten.
- Leere, ungültige und gültige Nullkoordinaten; Migration des bekannten 1.2.0-Fehlers.
- Zeitbudget, Fahrzeitgrenze, Fahrtpausen, mehrtägige Fahrten, Flughafentransfers und Puffer.
- Muss-Ziele, optionale Umwege, Start-/Endziel und individuell gewünschte Aufenthaltsdauer.
- Jede erzeugte Nacht hat eine Unterkunft; Check-out ist exklusiv. Fortlaufende Nächte am selben Ort teilen denselben Unterkunftsbaustein.
- Der generierte Datenbestand wird zusätzlich durch den echten Tagesplaner ausgewertet, nicht nur durch den neuen Routenkern.
- Ausgangsversion und ältere Flüge bleiben unverändert; Backup-Migration kopiert Daten unabhängig.
- OSM-Gebietsgrenzen, Wikidata-Länderzuordnung und Highlight-Kategorien; Natur- und Kulturziele bleiben abgedeckt, auch bei einer ausgefallenen Teilabfrage. Verwerfen einer falsch verknüpften Wikipedia-Beschreibung.
- Wildlife-Abfragen mit Gebiets-/Taxon-ID; Ausschluss von Gefangenschaft, verschleierten und zu ungenauen Standorten; Anker aus einem tatsächlichen Nachweis.
- `NoRoute` wird von einem zeitweisen Ausfall des Routingdienstes unterschieden.
- Versionskonsistenz, vollständige Projektdateien, eingebundene lokale Assets und Shell-Syntax.

Die Datenquellentests verwenden kontrollierte Antworten. Ein erfolgreicher Live-Abruf aller öffentlichen Dienste auf Android wurde nicht behauptet.

## Verbindliche nächste Prüfung vor Nutzung als bestätigter Release

`bash tools/verify.sh --android` beziehungsweise die mitgelieferten GitHub-Workflows müssen erfolgreich abschließen. Der Release-Workflow prüft die signierte APK und veröffentlicht ausschließlich den angeforderten Commit.

Auf einem Android-Gerät müssen anschließend Start/Safe-Area, Bearbeiten und Abbrechen, JSON-Import/Export, Kartenfilter, Foto-Ladefehler, Entdecken → Wunschliste → Route sowie das signierte Update über eine vorhandene Installation geprüft werden. Insbesondere der native Statusleisten-Fix aus 1.2.0 wurde nicht umgebaut und konnte hier nicht auf einem Gerät bestätigt werden.

## Weiterhin offene Produktgrenzen

- Der Generator ist eine deterministische Heuristik, keine Garantie für die weltweit optimale Route.
- Bestehende Buchungen bleiben in der Ausgangsversion erhalten, werden aber nicht automatisch als Fixpunkte in den neuen Entwurf übernommen. Der Dialog weist darauf hin.
- Flüge sind Vorschläge ohne verfügbare Flüge oder Buchungen. Ortszeiten und Zeitzonen müssen anhand der tatsächlichen Verbindung geprüft werden.
- Mehrtägige Fahrten reservieren Zwischenübernachtungen; konkrete Rast-/Übernachtungsorte an langen Etappen müssen ergänzt werden.
- Noch nicht verplante Tage werden als freie Tage am letzten Standort ausgewiesen. Ein vollständiges konkretes Sightseeing-Programm wird nicht erfunden.
- Die nationale Highlight-Suche ist derzeit auf deutsche Wikipedia-Ergebnisse mit expliziter Wikidata-Länderzuordnung beschränkt; dadurch fehlen unter Umständen reale Ziele. Die Eingabe eigener Stopps bleibt verfügbar.
- Wildlife-Inspiration umfasst weiterhin Säugetiere. Beobachtungen belegen weder Zugang noch Sichtungswahrscheinlichkeit.
- Karten und neue externe Inhalte benötigen eine Internetverbindung; eine vollständige Offline-Kartenversorgung ist nicht Bestandteil dieses Updates.
