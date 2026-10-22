# Unser Reiseplaner – Update auf 1.5.2

Stand: 21.10.2026

Dieses vollständige Updatepaket enthält den UI-Stand aus dem Entwurfs-PR #5: einen klareren Einstieg, kompaktere Formulare, eine übersichtlichere Inspirationssuche und bessere Orientierung. Die App-Dateien entsprechen dem bereits geprüften Stand. Einzelheiten stehen in `docs/UX_1_5_2.md` und `PRUEFBERICHT_1_5_2.md`.

Das ZIP enthält den Quellcode und den Updateweg. Die signierte APK entsteht anschließend über deinen vorhandenen Termux-/GitHub-Ablauf mit dem bisherigen Signaturschlüssel.

## 1. Vorbereiten

1. In der bisherigen App über **Zahnrad beziehungsweise Mehr → Backup exportieren** eine Sicherung der Reisen speichern.
2. Die Datei **Unser_Reiseplaner_V1_5_2_Update.zip** unter genau diesem Namen in **Downloads** speichern.
3. Die bestehende App installiert lassen. Termux und die vorhandene GitHub-Einrichtung weiterverwenden.

Falls Termux noch keinen Zugriff auf Downloads hat, einmal ausführen und den Zugriff erlauben:

```bash
termux-setup-storage
```

## 2. Update übernehmen und APK veröffentlichen

Diesen vollständigen Block in Termux einfügen:

```bash
pkg install -y git gh unzip rsync nodejs tar

bash <<'URP_UPDATE'
set -euo pipefail
gh auth status
cd "$HOME/unser-reiseplaner"

if [[ "$(git branch --show-current)" != main ]]; then
  echo "Abbruch: Bitte den main-Checkout verwenden."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Abbruch: Im Projekt liegen eigene Änderungen."
  git status --short
  exit 1
fi

git pull --ff-only origin main

URP_UPDATE_DIR="$(mktemp -d "$HOME/reiseplaner-update-1.5.2.XXXXXX")"
unzip -q \
  "$HOME/storage/downloads/Unser_Reiseplaner_V1_5_2_Update.zip" \
  -d "$URP_UPDATE_DIR"

bash \
  "$URP_UPDATE_DIR/Unser_Reiseplaner_V1_5_2_Update/tools/apply-update.sh" \
  "$HOME/unser-reiseplaner"

bash tools/publish-mobile.sh 1.5.2
URP_UPDATE
```

Das Skript übernimmt den vollständigen Quellstand in deinen bestehenden main-Checkout, sichert den vorherigen Quellcode und erhält lokale SDK-Einstellungen sowie Signaturdateien. Ungesicherte Änderungen und unbekannte oder neuere Ausgangsversionen führen zum Abbruch.

Der Veröffentlichungsschritt überträgt den aktualisierten Quellstand zu GitHub, prüft ihn und baut die signierte APK mit dem vorhandenen Release-Schlüssel. Erst danach wird Version 1.5.2 veröffentlicht. Es ist kein manueller Wechsel in den Entwurfszweig erforderlich.

Die GitHub-Anmeldung und die bereits eingerichteten Android-Signatur-Secrets müssen weiterhin gültig sein. Falls Termux einen Fehler meldet, die vollständige Meldung weitergeben. Kein Zurücksetzen des Checkouts oder Löschen der App durchführen, um eine Fehlermeldung zu umgehen.

## 3. Auf dem Smartphone installieren

Sobald Termux **„Fertig“** meldet:

**App → Zahnrad beziehungsweise Mehr → App-Updates → Nach Updates suchen → 1.5.2 installieren.**

Die bestehende App bleibt installiert; das Update verwendet denselben Paketnamen und den bisherigen Signaturschlüssel.

## 4. Kurz auf dem Pixel prüfen

1. Eine bestehende Reise öffnen und gespeicherte Wünsche sowie den Tagesplan kontrollieren.
2. Eine neue Reise anlegen; Fortbewegung wählen und die Zusammenfassung prüfen.
3. „Flüge, Transfers und Gehzeit anpassen“ öffnen, ändern und erneut aufrufen.
4. Einen Ausflug über eine Vorlage anlegen; Hinweg, Rückweg und eigene Angaben kontrollieren.
5. Größere Systemschrift, Bildschirmtastatur und Android-Zurückgeste ausprobieren.

Browser- und Android-Build-Prüfungen sind bereits erfolgreich. Die praktische Bedienung auf dem Pixel sowie die Qualität der Live-Daten wurden damit nicht geprüft.
