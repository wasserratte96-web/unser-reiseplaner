# Unser Reiseplaner 1.5.2 – Auslieferung und Prüfnachweise

Stand: 21.10.2026

## Inhalt des Updates

Dieses Paket enthält das UI-Update aus [PR #5](https://github.com/wasserratte96-web/unser-reiseplaner/pull/5): klarer Einstieg mit „Neue Reise planen“ und „Reiseidee finden“, aufklappbare Zusatzfilter, kompaktere Formulare und bessere Orientierung. Die vollständige Beschreibung steht in `docs/UX_1_5_2.md`.

Ausgangsversion: **1.5.1**, Hauptzweig-Commit `18559e155ffe95d349be18a5ed483d0904ddc971`.
Übernommener UX-Quellstand: `48ef75eed96d90ebca5f3ee20799e883287d3410`.
Geprüfter App-Code: `6cc1c4d707a07419868de26396cc7c173b7827ca`.

Alle App-Dateien, Build-Einstellungen und Browserabläufe entsprechen unverändert dem geprüften App-Code. Für dieses Paket wurden die vollständige Termux-Anleitung, dieser Prüfbericht und Paketnachweise ergänzt. Im Veröffentlichungsskript wurden ausschließlich die vorgegebene Änderungsbeschreibung und der Beispielaufruf auf 1.5.2 berichtigt; der Ablauf blieb unverändert.

## Bereits durchgeführte UI- und Android-Prüfungen

- **63 Funktionstests** erfolgreich.
- **24 Browser-Szenarien mit 88 erfolgreichen Prüfpunkten**, ohne aufgefangene JavaScript-Laufzeitausnahme: [Browserlauf](https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/39640169839).
- **Android-Debug- und Release-Build sowie lintDebug und lintRelease** erfolgreich: [Android-Lauf](https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/39640169849).
- Visuelle Kontrolle ausgewählter Smartphone-Ansichten, einschließlich 360 und 412 CSS-Pixel Breite und vergrößerter Root-Schrift. Umfang und Grenzen sind in `docs/UX_1_5_2.md` dokumentiert.

Diese Läufe wurden am 21.10.2026 für den oben genannten App-Commit durchgeführt. Ihr erfolgreicher Status wurde für die Auslieferung erneut auf GitHub kontrolliert. Der unveränderte App-Code benötigt für die ergänzten Unterlagen keinen erneuten identischen Android-Build. Der spätere Termux-Veröffentlichungsschritt prüft und baut den tatsächlich hochgeladenen Commit erneut.

## Zusätzliche Auslieferungsprüfungen

- Projektstruktur, Versionsangaben, JavaScript- und Shell-Syntax überprüft.
- Die **63 Funktionstests erneut lokal bestanden**, auch nach der Übernahme in eine isolierte Kopie von 1.5.1. Ergebnisprotokoll: `TESTERGEBNIS_1_5_2.txt`.
- Update von einem sauberen main-Checkout der aktuellen 1.5.1 mit `tools/apply-update.sh` erfolgreich.
- Alle übernommenen Paketdateien mit dem Auslieferungsstand verglichen.
- Quellcode-Backup mit allen **83 Dateien** des Ausgangscommits abgeglichen.
- Lokale SDK-Einstellungen, künstlicher Testschlüssel, lokale Signaturkonfiguration und eine zusätzliche lokale Datei erhalten.
- Ungesicherte Änderungen führten vor der Übernahme zum Abbruch; die Änderungen blieben erhalten.
- Paket enthält ein SHA-256-Inhaltsverzeichnis in `PAKETINHALT_SHA256.json`. Das Inhaltsverzeichnis erfasst alle Paketdateien außer sich selbst.

Der Update-Probelauf verwendet künstliche lokale Einstellungen und einen eindeutig künstlichen Schlüssel. Er liest oder verwendet keine echten Signaturdateien des Nutzers.

## Installation und Grenzen

Die vollständige Schritt-für-Schritt-Anleitung steht in **UPDATE_1_5_2_TERMUX.md**.

Das ZIP enthält Quellcode, keine bereits signierte Installations-APK. Die APK wird über den vorhandenen Termux-/GitHub-Veröffentlichungsweg mit dem bisherigen Release-Schlüssel gebaut und anschließend über die App installiert. Die bestehende App bleibt installiert. Vorher ein Reise-Backup exportieren.

Bei Bereitstellung dieses Pakets wurde noch keine signierte 1.5.2-APK veröffentlicht; main und der Entwurfs-PR wurden durch die Paketvorbereitung nicht verändert. Erst der vom Nutzer ausgeführte Veröffentlichungsschritt überträgt den Paketstand nach main und veröffentlicht die APK.

Die Browserprüfung verwendet festgelegte Testdaten. Live-Datenqualität, native Bedienung auf dem Pixel, Bildschirmtastatur, Systemleisten, Zurückgeste sowie Tests mit unabhängigen Personen bleiben offen. Die kurze Pixel-Checkliste steht in der Installationsanleitung.
