# Prüfbericht – Unser Reiseplaner 1.3.1

Stand: 10. September 2026. Ausgangspunkt ist GitHub-Commit `d07691e0537ab1414606609edfe5499d839f0243` mit Version 1.3.0. Alle 51 Dateien der lokalen Arbeitskopie stimmen anhand ihrer Git-Blob-Prüfsummen mit diesem Commit überein.

## Bestätigter Fehler und Korrektur

Der [fehlgeschlagene GitHub-Lauf 34498507782](https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/34498507782), Job `102943019495`, meldet im Schritt „Android-SDK vorbereiten“ exakt `sdkmanager: command not found` und Exit 127. Die späteren Android-Build- und APK-Schritte wurden nicht ausgeführt. Der erfolgreiche Quellcode-Push war kein erfolgreicher App-Build.

Beide Workflows installieren jetzt die SDK-Kommandozeilenwerkzeuge mit [android-actions/setup-android](https://github.com/android-actions/setup-android/tree/40fd30fb8d7440372e1316f5d1809ec01dcd3699), festgelegt auf Commit `40fd30fb8d7440372e1316f5d1809ec01dcd3699` (v4) und Tools-Build `14742923`. Die Action setzt die SDK-Umgebungsvariablen und den Suchpfad, nimmt die erforderlichen Lizenzen an und installiert Platform Tools, API 36 und Build Tools 36.0.0. Ein Folgeschritt prüft `sdkmanager`, `android.jar`, `apksigner` und `aapt`.

Die [Android-Dokumentation](https://developer.android.com/tools/sdkmanager) beschreibt `sdkmanager` als Bestandteil der Command-Line Tools und empfiehlt feste Werkzeugversionen in Skripten. Die App behält AGP 9.3.0, Gradle 9.5.0, Java-Quellkompatibilität 17 und CI-JDK 21.

Der erste Korrekturlauf [34499914732](https://github.com/wasserratte96-web/unser-reiseplaner/actions/runs/34499914732) bestätigte die SDK-Reparatur und baute die Debug-APK. Lint fand anschließend den bestehenden Fehler `GestureBackNavigation`: `Activity.onBackPressed()` verarbeitet moderne Zurück-Gesten nicht mehr zuverlässig. Dieser Fehler wurde nicht durch eine Lint-Ausnahme verdeckt. Die App verwendet jetzt `ComponentActivity` und `OnBackPressedDispatcher` aus AndroidX Activity 1.10.1. Der WebView-Callback ist nur bei vorhandener Browserhistorie aktiv; am Start übernimmt das System. Die Activity aktiviert Predictive Back ausdrücklich. Grundlage: [Android-Anleitung zur Zurück-Navigation](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture).

## Prüfungen

Lokale Prüfung: `bash tools/verify.sh`. Sie prüft Versionskonsistenz, Projektstruktur, JavaScript-Syntax, die bestehenden 31 Funktionstests sowie die Shell-Syntax der Werkzeuge.

Alle 31 Tests bestehen. Beide Workflow-YAML-Dateien und ihre 12 Shell-Schritte wurden zusätzlich auf Syntax geprüft. Das Einspielen von 1.3.0 auf 1.3.1 wurde in einem isolierten Linux-Git-Checkout erprobt: vollständige Dateiübernahme, Backup des bisherigen committeten Quellcodes und Erhalt eigener Zusatzdateien, lokaler SDK-Konfiguration sowie lokaler Signaturdateien bestanden. Dies war kein Probelauf auf einem physischen Termux-Gerät.

Die neue GitHub-Prüfung wird auf dem Korrekturzweig ausgeführt. Das endgültige Ergebnis wird nach Abschluss dokumentiert; ein ausstehender Lauf ist kein nachgewiesener Android-Build.

## Umfang und Grenzen

Die Reparatur betrifft die Build-Einrichtung, native Zurück-Navigation, Versionsmetadaten und die Wiederaufnahme des Smartphone-Updates von Quellstand 1.3.0. Die Planungslogik und Datenquellenverträge aus 1.3.0 werden unverändert übernommen; Reise-Datenschema 6 bleibt erhalten.

Ein signierter Release verwendet weiterhin die bestehenden Repository-Secrets und den fortlaufenden CI-Versionscode. Ein erfolgreicher Debug-Build bestätigt weder die Release-Signatur noch die Installation über die vorhandene APK. Dies prüft der Release-Ablauf separat.

Die Bedienung auf Pixel 6 Pro / Android 17 und Live-Abrufe aller externen Dienste sind hier weiterhin nicht auf einem Gerät geprüft. Nach Installation sind Start/Statusleisten, Reise-Backup, Bearbeiten/Abbrechen, Karte und Entdecken → Wunschliste → Route zu prüfen. Die in `PRUEFBERICHT_1_3_0.md` beschriebenen Produktgrenzen bleiben gültig.
