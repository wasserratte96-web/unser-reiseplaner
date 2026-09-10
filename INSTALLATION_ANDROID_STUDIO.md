# Bauen mit Android Studio – 1.3.1

1. `Unser_Reiseplaner_V1_3_1_Update.zip` vollständig entpacken.
2. In Android Studio **Open** wählen und den Ordner `Unser_Reiseplaner_V1_3_1_Update` öffnen, in dem `settings.gradle` liegt.
3. Als Gradle-JDK **21** einstellen. Im SDK Manager **Android API 36** und **Build Tools 36.0.0** installieren. Die Java-Quellkompatibilität der App bleibt 17.
4. Gradle-Synchronisierung abschließen. Die erste Einrichtung lädt Gradle 9.5.0 und AGP 9.3.0 aus den in `settings.gradle` angegebenen offiziellen Repositories; Internetzugriff ist erforderlich.
5. Für die Projekt- und JavaScript-Prüfung Node.js 22 oder neuer installieren und im Projektterminal `bash tools/verify.sh` ausführen. Die App selbst hat keine Node.js-Laufzeitabhängigkeit.
6. Mit `./gradlew assembleDebug lintDebug` bauen (unter Windows `gradlew.bat assembleDebug lintDebug`). Die Debug-APK liegt anschließend unter `app/build/outputs/apk/debug/app-debug.apk`.
7. Für den regulären Smartphone-Updateweg die vorhandenen GitHub-Actions-Signatur-Secrets weiterverwenden; Anleitung in `UPDATE_1_3_1_TERMUX.md`.

Die Paketkennung bleibt `de.unserreiseplaner.app`; Standard-Versionsname ist 1.3.1, lokaler Versionscode 10. Der bestehende Release-Workflow verwendet weiterhin einen fortlaufenden höheren CI-Versionscode (`100000 + Run-Nummer`) und denselben Signaturschlüssel. Ein lokal gebautes APK mit niedrigerem Code oder abweichender Signatur kann eine vorhandene Release-Installation nicht ersetzen. In diesem Fall den regulären signierten Release-Weg verwenden; die App nicht deinstallieren.

Die Verzeichnisstruktur und Skripte sind Bestandteil dieses vollständigen ZIPs. Der aktuelle Prüfstatus steht in `PRUEFBERICHT_1_3_1.md`.
