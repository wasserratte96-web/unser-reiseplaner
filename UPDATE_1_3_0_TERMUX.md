# Update auf 1.3.0 per Smartphone / Termux

Dieses ZIP enthält das vollständige Android-Projekt. Die APK wird wie bisher von GitHub Actions mit deinem vorhandenen Signaturschlüssel gebaut. Ein lokaler Android-Build direkt in Termux ist nicht vorgesehen.

## 1. Vorbereitung

In der App unter **Mehr → Backup exportieren** eine aktuelle Datensicherung erstellen. Die App installiert das Update später über die bestehende Installation; nicht deinstallieren.

Die Datei **Unser_Reiseplaner_V1_3_0_Update.zip** in **Downloads** speichern. In Termux:

```bash
pkg install git gh unzip rsync nodejs tar
termux-setup-storage
gh auth status
```

GitHub wurde laut bisherigem Projektverlauf bereits in Termux eingerichtet. Falls `gh auth status` eine fehlende Anmeldung meldet, `gh auth login` und anschließend `gh auth setup-git` verwenden. Die bestehenden vier Android-Signatur-Secrets im Repository weiterverwenden; keinen neuen Schlüssel erzeugen.

## 2. Bisherigen Checkout aktualisieren und ZIP getrennt entpacken

```bash
cd ~/unser-reiseplaner
git status --short
git pull --ff-only origin main

URP_UPDATE_DIR="$(mktemp -d "$HOME/reiseplaner-update-1.3.0.XXXXXX")"
unzip -q ~/storage/downloads/Unser_Reiseplaner_V1_3_0_Update.zip -d "$URP_UPDATE_DIR"
bash "$URP_UPDATE_DIR/Unser_Reiseplaner_V1_3_0_Update/tools/apply-update.sh" "$HOME/unser-reiseplaner"
```

Das Skript prüft zuerst Struktur und Tests. Es verweigert das Überschreiben eines Checkouts mit eigenen ungesicherten Änderungen oder einem unbekannten/neuen Versionsstand. In diesem Fall die Meldung beheben und nur den letzten Befehl erneut ausführen. Keine Dateien mit `git reset --hard` oder `git clean` entfernen.

Vor dem Einspielen wird der bisherige **committete Quellcode** neben dem Checkout gesichert. Signaturschlüssel, Git-Verzeichnis, lokale SDK-Konfiguration und eigene zusätzliche Dateien bleiben erhalten. Diese Sicherung ersetzt nicht das JSON-Backup der Reisen.

## 3. Prüfen, bauen und veröffentlichen

```bash
cd ~/unser-reiseplaner
bash tools/publish-mobile.sh 1.3.0 \
  "Prioritäten mit Aufenthaltsdauer, zeitlich geprüfte Routen, konsistente Wildlife- und Ortsdaten sowie Fehlerkorrekturen."
```

Das Skript führt die lokalen Tests aus, überträgt den Commit, startet eine neue Prüfung genau dieses Commits und wartet auf deren Ergebnis. Erst danach startet es einen signierten Release-Build desselben Quellcodes. Die eindeutige Anforderungskennung verhindert, dass ein älterer Build versehentlich ausgewählt wird. Fehlgeschlagene Builds brechen den Ablauf ab; vorhandene Releases werden nicht überschrieben.

GitHub Actions prüft zusätzlich Android-Build/Lint, Signatur, Paketnamen und Version. Der Release enthält APK, Quellcode-ZIP und SHA-256-Prüfsummen. Ein Quellcode-Commit allein bedeutet noch nicht, dass eine installierbare APK veröffentlicht wurde.

## 4. APK installieren

Nach erfolgreichem Release:

**Unser Reiseplaner → Mehr → App-Updates → Nach Updates suchen → 1.3.0 installieren.**

Die bereits vorhandene In-App-Sicherung vor dem APK-Download bleibt aktiv. Android kann einmalig die Freigabe zum Installieren von Updates aus dieser App verlangen.

Falls Android eine abweichende Signatur meldet: nicht deinstallieren. Der Build muss mit dem Schlüssel der bereits installierten App signiert werden. Ein Debug-Build aus Android Studio und ein Release-Build können verschiedene Signaturen haben.

## Fehler und Wiederaufnahme

- `node` fehlt: `pkg install nodejs`.
- Eigene Quellcodeänderungen: mit `git diff` ansehen und bewusst sichern/committen, bevor das ZIP eingespielt wird.
- `git push` wird abgelehnt: `git status` prüfen und Änderungen regulär abgleichen; kein Force-Push.
- Ein CI-Build schlägt fehl: `gh run list` und `gh run view RUN_ID --log-failed`. Die App bleibt in der bisherigen Version installiert.
- Die Version existiert bereits: den vorhandenen Release in der App abrufen; keine zweite Veröffentlichung derselben Versionsnummer erzwingen.
- Der Ausgangsstand ist neuer als 1.2.0: erst die Änderungen abgleichen. Das Update-Skript stoppt absichtlich vor dem Überschreiben.

Prüfstatus dieser Lieferung: siehe `PRUEFBERICHT_1_3_0.md`. In der Entwicklungsumgebung wurde keine APK gebaut oder veröffentlicht.
