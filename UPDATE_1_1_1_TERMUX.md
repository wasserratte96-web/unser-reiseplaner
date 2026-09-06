# Unser Reiseplaner 1.1.1 – Update nur mit Android/Termux

Voraussetzung: Version 1.1.0 ist bereits als dauerhaft signierte Release-App installiert, GitHub/Termux sind eingerichtet und das Repository liegt unter `~/unser-reiseplaner`.

## 1. ZIP herunterladen
Die neue Projekt-ZIP aus ChatGPT nach Android `Downloads` laden und in `reiseplaner-update.zip` umbenennen.

## 2. Projekt austauschen
In Termux:

```bash
rm -rf ~/reiseplaner-neu
mkdir -p ~/reiseplaner-neu
unzip -q ~/storage/downloads/reiseplaner-update.zip -d ~/reiseplaner-neu
SRC="$(find ~/reiseplaner-neu -mindepth 1 -maxdepth 1 -type d | head -n 1)"
rsync -a --delete --exclude='.git/' "$SRC"/ ~/unser-reiseplaner/
chmod +x ~/unser-reiseplaner/gradlew
cd ~/unser-reiseplaner
git status
```

## 3. Test + Release mit einem Befehl

```bash
cd ~/unser-reiseplaner
bash tools/publish-mobile.sh 1.1.1 "Fehlerbehebung für Inspiration, Wildlife und Android-Systemleisten."
```

Das Skript committet/pusht die Änderungen, wartet auf `Projekt prüfen`, startet den signierten Release-Build und wartet auf dessen Ergebnis.

## 4. App aktualisieren
In der bereits installierten App:

**Mehr → App-Updates → Nach Updates suchen → Version 1.1.1 installieren**

Die App muss nicht deinstalliert werden. Die lokale Reise-Datenbank bleibt beim regulären Update erhalten; zusätzlich erstellt die App vor dem Update ein JSON-Backup.
