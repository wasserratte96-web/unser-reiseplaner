# Update auf 1.3.1 per Smartphone / Termux

Version 1.3.1 enthält das vollständige Projekt einschließlich aller Verbesserungen aus 1.3.0. Sie behebt den Abbruch `sdkmanager: command not found` im GitHub-Build. Der Quellcode 1.3.0 wurde bereits erfolgreich übertragen; die installierte App bleibt nach dem fehlgeschlagenen Build auf ihrer bisherigen Version.

## 1. Backup und Download

In der App unter **Mehr → Backup exportieren** eine aktuelle Reisesicherung erstellen. **Unser_Reiseplaner_V1_3_1_Update.zip** aus der Chat-Antwort in **Downloads** speichern. Die bestehende App für das Update installiert lassen.

## 2. Korrektur einspielen und signierte APK bauen

Termux, Speicherzugriff und GitHub sind nach deinem erfolgreichen Upload bereits eingerichtet. Falls eines der benötigten Programme fehlt, vorher `pkg install -y git gh unzip rsync nodejs tar` ausführen. Nur bei fehlendem Zugriff auf Downloads separat `termux-setup-storage` ausführen und die Android-Freigabe bestätigen.

Den folgenden Block vollständig in Termux einfügen. Er läuft in einer eigenen Bash und stoppt beim ersten Fehler. Deine vorhandene GitHub-Anmeldung und die vier Android-Signatur-Secrets werden weiterverwendet.

```bash
bash <<'URP_UPDATE'
set -euo pipefail
gh auth status
cd "$HOME/unser-reiseplaner"
test -z "$(git status --porcelain)" || {
  echo 'Eigene Quellcodeänderungen zuerst sichern/committen.'
  exit 1
}
git pull --ff-only origin main
URP_UPDATE_DIR="$(mktemp -d "$HOME/reiseplaner-update-1.3.1.XXXXXX")"
unzip -q "$HOME/storage/downloads/Unser_Reiseplaner_V1_3_1_Update.zip" -d "$URP_UPDATE_DIR"
bash "$URP_UPDATE_DIR/Unser_Reiseplaner_V1_3_1_Update/tools/apply-update.sh" "$HOME/unser-reiseplaner"
cd "$HOME/unser-reiseplaner"
bash tools/publish-mobile.sh 1.3.1
URP_UPDATE
```

Meldet `gh auth status` eine fehlende Anmeldung, einmal `gh auth login` und `gh auth setup-git` ausführen und den Block erneut starten.

Das Einspielen unterstützt die bekannten Quellstände 1.0.0 bis 1.3.0. Vor dem Kopieren werden Projektstruktur und Funktionstests geprüft und der bisherige committete Quellcode neben dem Checkout gesichert. Eigene Zusatzdateien, lokale SDK-Konfiguration, Git-Verzeichnis und lokale Schlüssel bleiben erhalten. Diese Quellcodesicherung ergänzt das separate Reise-Backup.

Anschließend werden die Änderungen übertragen, genau dieser Commit geprüft und nach erfolgreicher Prüfung mit dem vorhandenen Schlüssel gebaut. SDK-Einrichtung, Android-Build, Lint, APK-Signatur, Paketkennung und Version müssen erfolgreich sein, bevor ein Release mit APK, Quellcode-ZIP und SHA-256-Prüfsummen veröffentlicht wird.

## 3. Auf dem Smartphone installieren

Wenn Termux **„Fertig“** ausgibt:

**Unser Reiseplaner → Mehr → App-Updates → Nach Updates suchen → 1.3.1 installieren.**

Android kann die Freigabe zur Installation aus dieser App verlangen. Bei einer Signaturabweichung die bestehende App installiert lassen und den bisherigen Release-Schlüssel prüfen. Die Debug-Prüf-APK ist kein Ersatz für das signierte Update.

## Wiederaufnahme

Wenn 1.3.1 bereits im Checkout steht und nur der Build erneut ausgeführt werden muss:

```bash
cd "$HOME/unser-reiseplaner"
bash tools/publish-mobile.sh 1.3.1
```

Das ZIP in diesem Fall nicht nochmals einspielen. Existiert Release `v1.3.1` schon, direkt den In-App-Updater verwenden; vorhandene Releases werden nicht überschrieben.

Für einen neuen Buildfehler die aktuelle Run-ID aus Termux verwenden:

```bash
gh run list --repo wasserratte96-web/unser-reiseplaner --limit 5
gh run view RUN_ID --repo wasserratte96-web/unser-reiseplaner --log-failed
```

`RUN_ID` durch die Nummer des fehlgeschlagenen Laufs ersetzen. Der alte Lauf `34498507782` baut weiterhin den alten Quellcode; sein erneuter Start übernimmt die Korrektur nicht.

Prüfnachweise und noch offene Geräteprüfung: `PRUEFBERICHT_1_3_1.md`.
