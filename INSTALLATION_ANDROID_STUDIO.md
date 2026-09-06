# Unser Reiseplaner als APK erstellen – Schritt für Schritt

Diese Anleitung ist für Nutzer ohne Android-Entwicklungserfahrung geschrieben.

## 1. Projekt entpacken

Lade `Unser_Reiseplaner_V1.zip` auf deinen Windows-PC herunter.

Rechtsklick auf die ZIP-Datei → **Alle extrahieren**.

Danach sollte der entpackte Ordner ungefähr so aussehen:

```
Unser_Reiseplaner_V1
├─ app
├─ gradle
├─ build.gradle
├─ settings.gradle
├─ gradlew
└─ gradlew.bat
```

Wichtig: Öffne später **diesen obersten Ordner**, nicht nur den Unterordner `app`.

## 2. Android Studio installieren

1. Öffne die offizielle Android-Studio-Webseite: https://developer.android.com/studio
2. Lade die aktuelle stabile Version für Windows herunter.
3. Starte die Installation.
4. Lasse **Android Studio**, **Android SDK** und die vorgeschlagenen Standardkomponenten aktiviert.
5. Beim ersten Start darf Android Studio weitere SDK-Komponenten herunterladen.

## 3. Projekt öffnen

1. Starte Android Studio.
2. Wähle **Open**.
3. Wähle den entpackten Ordner `Unser_Reiseplaner_V1`.
4. Bestätige **Trust Project**, falls Android Studio danach fragt.
5. Warte auf **Gradle Sync**.

Beim ersten Start lädt das Projekt Gradle 9.5.0 und die Android-Build-Komponenten aus dem Internet. Das kann einige Minuten dauern.

## 4. Falls Android SDK 36 fehlt

Android Studio kann oben eine Meldung wie `SDK Platform 36 not found` anzeigen.

Dann:

1. Klick auf den angebotenen Link **Install missing SDK package(s)**
2. Lizenz akzeptieren
3. Installation abwarten
4. Danach **Sync Project with Gradle Files** ausführen

Alternativ:

**Tools → SDK Manager → SDK Platforms → Android API 36** aktivieren → **Apply**.

## 5. Debug-APK erzeugen

Wenn unten keine roten Build-Fehler mehr stehen:

1. Menü **Build** öffnen
2. **Build App Bundle(s) / APK(s)** auswählen
3. **Build APK(s)** anklicken

Je nach Android-Studio-Version kann der Menüpunkt leicht anders heißen, z. B. direkt **Build APK(s)**.

Nach erfolgreichem Build erscheint eine Meldung `APK(s) generated successfully`.

Klicke dort auf **Locate**.

Die Datei liegt normalerweise hier:

```
app\build\outputs\apk\debug\app-debug.apk
```

Du kannst sie in `Unser-Reiseplaner.apk` umbenennen.

## 6. APK auf das Android-Handy übertragen

Einfachste Varianten:

- **Quick Share**
- USB-Kabel
- Google Drive
- E-Mail an dich selbst, wenn dein Anbieter APK-Anhänge nicht blockiert

## 7. Installation auf Android

1. Öffne die APK auf dem Handy.
2. Android meldet wahrscheinlich, dass die Installation aus dieser Quelle noch nicht erlaubt ist.
3. Tippe auf **Einstellungen**.
4. Aktiviere **Aus dieser Quelle zulassen** für die App, aus der du die APK öffnest (z. B. Dateien, Chrome oder Drive).
5. Zurück zur APK.
6. **Installieren**.

Danach erscheint **Unser Reiseplaner** in deiner App-Übersicht.

## 8. Bei einer neuen Version

Wenn später eine neue APK mit derselben `applicationId` und einer höheren `versionCode` gebaut wird, kannst du sie über die bestehende App installieren. Die lokale SQLite-Datenbank bleibt normalerweise erhalten.

Trotzdem vor größeren Updates immer zuerst in der App:

**Mehr → Backup exportieren**.

## Fehlerbehebung

### "Gradle JDK" / falsche Java-Version

Das Projekt ist für JDK 17 vorgesehen.

In Android Studio:

**File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**

Wähle **Embedded JDK 17** oder eine installierte JDK-17-Version.

### Gradle kann nicht heruntergeladen werden

Prüfe die Internetverbindung und ob Firewall/Virenscanner Zugriffe auf `services.gradle.org`, `google.com` bzw. `maven.google.com` und `mavenCentral` blockieren.

### Karte bleibt leer

Die Karte und Kartenkacheln benötigen Internetzugang. Prüfe außerdem, ob Android System WebView aktuell ist.

### Externe Suche funktioniert zeitweise nicht

Die App verwendet kostenlose öffentliche Dienste. Nominatim, Overpass, OSRM, Wikidata, iNaturalist oder Wikimedia können zeitweise langsam oder nicht erreichbar sein. Reisepläne selbst bleiben lokal gespeichert.

### App-Daten sichern

In der App:

**Mehr → Backup exportieren**

Die JSON-Datei landet unter:

`Downloads/Unser Reiseplaner/`
