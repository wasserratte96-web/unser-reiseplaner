# Update auf 1.4.0 per Smartphone / Termux

Das ZIP enthält das vollständige Projekt. Der folgende Ablauf überträgt den Quellcode, prüft ihn und veröffentlicht nach erfolgreichem Build die mit deinen bisherigen GitHub-Secrets signierte APK.

## 1. Reise-Backup und Download

In der bisherigen App unter **Mehr → Backup exportieren** sichern (in der neuen Oberfläche: Zahnrad → Datensicherung). Das ZIP **Unser_Reiseplaner_V1_4_0_Update.zip** aus der Chat-Antwort in **Downloads** speichern. Die bestehende App installiert lassen.

## 2. Termux vorbereiten

```bash
pkg install -y git gh unzip rsync nodejs tar
gh auth status
```

Nur bei fehlender Anmeldung: `gh auth login` und `gh auth setup-git`. Nur bei fehlendem Zugriff auf Downloads: `termux-setup-storage` und die Android-Speicherfreigabe bestätigen.

## 3. Einspielen, prüfen und veröffentlichen

Diesen gesamten Block in Termux einfügen:

```bash
bash <<'URP_UPDATE'
set -euo pipefail
gh auth status
cd "$HOME/unser-reiseplaner"
if [[ "$(git branch --show-current)" != main ]]; then
  echo 'Abbruch: Bitte den main-Checkout verwenden.'
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Abbruch: Eigene Änderungen zuerst mit git status und git diff prüfen.'
  exit 1
fi
git pull --ff-only origin main
URP_UPDATE_DIR="$(mktemp -d "$HOME/reiseplaner-update-1.4.0.XXXXXX")"
unzip -q "$HOME/storage/downloads/Unser_Reiseplaner_V1_4_0_Update.zip" -d "$URP_UPDATE_DIR"
bash "$URP_UPDATE_DIR/Unser_Reiseplaner_V1_4_0_Update/tools/apply-update.sh" "$HOME/unser-reiseplaner"
bash tools/publish-mobile.sh 1.4.0
URP_UPDATE
```

Unterstützte Ausgangsquellstände: 1.0.0 bis 1.3.1. Das Skript prüft zunächst das Update, sichert den committeten alten Quellcode neben dem Checkout und erhält lokale Schlüssel, SDK-Einstellungen und eigene Zusatzdateien. Bei eigenen uncommitteten Änderungen stoppt es. Der Pull Request mit diesem Update muss für diesen ZIP-Weg nicht vorher zusammengeführt werden.

`publish-mobile.sh` erzeugt einen Commit, überträgt ihn auf main, wartet auf genau den angeforderten Prüflauf und startet danach den signierten Release. Es veröffentlicht APK, Quellcode-ZIP und SHA-256-Prüfsummen. Bestehende Releases werden nicht überschrieben.

## 4. Installieren und prüfen

Nach „Fertig“: **bisherige App → Mehr → App-Updates → Nach Updates suchen → 1.4.0 installieren**. Falls bereits die neue Oberfläche installiert ist: Zahnrad → App-Updates. Android kann die Freigabe zur APK-Installation verlangen. Die Debug-APK aus dem Prüflauf hat eine andere Signatur und ist kein Update der vorhandenen Release-App.

Bei einer Signaturfehlermeldung die bestehende App installiert lassen. Verwende den bisherigen Release-Schlüssel; seine Werte nicht im Chat teilen.

Prüfe auf dem Pixel 6 Pro: alte Reisen/Varianten, Statusleiste, Suche „Salzburg“ mit Deutschland + Österreich, weltweite Suche „Venedig“, eigene Orte ohne Koordinaten und spätere Ergänzung, Tierwunsch, Route über zwei Länder und Fotozeitfenster. Prüfe danach Unterkunft, Transfer, Kartenfilter und Backup. Eine genaue Testfolge steht im Prüfbericht.

## Wiederaufnahme nach Buildfehler

Wenn der Quellcode bereits auf 1.4.0 steht, das ZIP nicht erneut einspielen:

```bash
cd "$HOME/unser-reiseplaner"
bash tools/publish-mobile.sh 1.4.0
```

Existiert Release `v1.4.0` bereits, direkt den App-Updater verwenden. Zum Prüfen eines neuen Fehlers:

```bash
gh run list --repo wasserratte96-web/unser-reiseplaner --limit 5
gh run view RUN_ID --repo wasserratte96-web/unser-reiseplaner --log-failed
```

`RUN_ID` durch die aktuelle Laufnummer ersetzen. Ein Neustart eines alten 1.3.0-Laufs baut weiterhin den alten Quellcode.
