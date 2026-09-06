# Updates ohne Android Studio – einmalige Einrichtung

Repository: https://github.com/wasserratte96-web/unser-reiseplaner

## Ziel
Nach dieser Einrichtung baut GitHub Actions jede freigegebene Version automatisch als signierte APK. Die Android-App kann das neueste GitHub-Release selbst erkennen, herunterladen und an den Android-Installer übergeben.

## 1. Permanenten Signaturschlüssel anlegen
In Android Studio: **Build → Generate Signed App Bundle or APK → APK → Create new**.

Empfehlung:
- Datei: `unser-reiseplaner-release.jks`
- Alias: `unserreiseplaner`
- Gültigkeit: 50 Jahre
- Datei außerhalb des Projektordners sichern

Die JKS-Datei und Passwörter niemals in GitHub hochladen. Zwei private Sicherungskopien anlegen.

## 2. JKS in Base64 umwandeln (Windows PowerShell)
```powershell
$bytes = [System.IO.File]::ReadAllBytes("C:\PFAD\unser-reiseplaner-release.jks")
[Convert]::ToBase64String($bytes) | Set-Content -NoNewline "$env:USERPROFILE\Desktop\keystore-base64.txt"
```

## 3. Vier GitHub Actions Secrets anlegen
Repository → **Settings → Secrets and variables → Actions → New repository secret**

Exakt diese Namen verwenden:
- `ANDROID_KEYSTORE_BASE64` = kompletter Inhalt von `keystore-base64.txt`
- `ANDROID_KEYSTORE_PASSWORD` = Passwort des Keystores
- `ANDROID_KEY_ALIAS` = z. B. `unserreiseplaner`
- `ANDROID_KEY_PASSWORD` = Passwort des Schlüssels

## 4. Projekt in das Repository bringen
Am einfachsten mit **GitHub Desktop**:
1. GitHub Desktop installieren und anmelden.
2. **File → Clone repository**.
3. `wasserratte96-web/unser-reiseplaner` auswählen.
4. Inhalt dieses Projektordners in den lokalen Repository-Ordner kopieren. Die versteckte `.git`-Struktur des geklonten Ordners nicht löschen.
5. In GitHub Desktop: Summary `Unser Reiseplaner 1.1.0` → **Commit to main** → **Push origin**.

Nach dem Push läuft unter **Actions → Projekt prüfen** automatisch ein Debug-Build.

## 5. Erste signierte Release-APK erzeugen
GitHub → Repository → **Actions → Build & Release Unser Reiseplaner → Run workflow**.

Eintragen:
- `version_name`: `1.1.0`
- `release_notes`: z. B. `Update-System und automatische APK-Updates eingerichtet.`

Nach erfolgreichem Lauf erscheint rechts auf der Repository-Seite unter **Releases** die APK `Unser_Reiseplaner-1.1.0.apk`.

## 6. Einmaliger Wechsel von Debug auf Release
Die bisherige Android-Studio-Debug-App ist anders signiert. Daher:
1. In der bisherigen App JSON-Backup exportieren.
2. Debug-App deinstallieren.
3. `Unser_Reiseplaner-1.1.0.apk` mit dem Handy aus GitHub Releases laden.
4. APK installieren.
5. Backup wieder importieren, falls nötig.

Ab jetzt bleibt die Signatur gleich und spätere Releases können als normales Update installiert werden.

## 7. Spätere Updates
1. Neue Projektversion in denselben lokalen GitHub-Desktop-Ordner kopieren.
2. GitHub Desktop → Commit → Push origin.
3. GitHub → Actions → **Build & Release Unser Reiseplaner → Run workflow**.
4. Neue Versionsnummer eingeben, z. B. `1.2.0`.
5. Auf dem Handy meldet die App die neue Version automatisch (höchstens einmal pro 24 h) oder unter **Mehr → App-Updates → Nach Updates suchen**.
6. **Update installieren** antippen. Beim ersten Mal Android-Berechtigung „Aus dieser Quelle zulassen“ für Unser Reiseplaner aktivieren.
7. Android-Installationsdialog bestätigen.

Vor jedem In-App-Update erstellt die App automatisch ein JSON-Backup unter `Downloads/Unser Reiseplaner`.
