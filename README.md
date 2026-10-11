# Unser Reiseplaner – Version 1.4.0

Android-App für individuelle Reisen mit Prioritäten, Natur- und Fotomotiven. Grundlage ist der geprüfte GitHub-Stand 1.3.1 (`646f92b607ecc81b3cbc640878367c55cb485121`).

## Bedienung

**Reisen → Entdecken → Wünsche → Plan → Karte.** Einstellungen, Datensicherung und App-Updates erreichst du über das Zahnrad oben rechts.

Lege eine Reise mit einem oder mehreren Ländern und einem Zeitraum an. Suche gezielt nach einem Ort, einer Sehenswürdigkeit oder Tierart. Suchgebiet: alle Reiseländer, einzelnes Land oder weltweit. Speichere Treffer über Plus in der Wunschliste. Fehlt dein Wunsch, nutze „Eigener Ort“. Koordinaten dürfen zunächst offen bleiben.

Unter „Priorität, Zeit & Foto“ legst du fest, was wichtig ist, wie lange du bleiben möchtest und welche Fotomotive du planst. Ein selbst eingegebenes Aufnahmefenster begrenzt die gesamte Besuchszeit; es ist keine berechnete Goldene Stunde. Aufnahmehinweise bleiben am Wunsch und am erzeugten Stopp erhalten.

Die Route entsteht als neue Variante. Wähle geografische Reihenfolge oder die Reihenfolge deiner Wunschliste sowie Fahr- und Aktivitätenbudget. Nicht passende Wünsche bleiben mit Gründen sichtbar. Prüfe anschließend die konkreten Verbindungen, Unterkünfte und offenen Angaben. Bestehende Buchungen werden in der neuen automatischen Variante nicht übernommen.

## Bauen und installieren

- Smartphone/Termux: `UPDATE_1_4_0_TERMUX.md`.
- Android Studio: `INSTALLATION_ANDROID_STUDIO.md`.
- Lokale Struktur- und Funktionstests: `bash tools/verify.sh`.
- Android-Build und Lint: `bash tools/verify.sh --android` (JDK 21 und Android-SDK erforderlich).
- Prüfnachweise und Einschränkungen: `PRUEFBERICHT_1_4_0.md`.
- Marktvergleich, Fotografie-Positionierung und Roadmap: `docs/MARKTRECHERCHE_1_4_0.md`.

## Technische Grundlage

Native Android-Hülle mit WebView und SQLite, statische HTML/CSS/JavaScript-Oberfläche. Keine Anmeldung in der Reise-App nötig. Geodaten von OpenStreetMap/Nominatim/Overpass, Straßenrouten von OSRM, Ortsinformationen und Bilder von Wikimedia, Tierarten und historische Beobachtungen von iNaturalist. Jeder Dienst hat eigene Verfügbarkeit, Nutzungsbedingungen und Abdeckung. Suchbegriffe und benötigte Koordinaten werden zur jeweiligen Abfrage an den Dienst gesendet.

Für den privaten Bestand bleibt der bisherige Nominatim-Dienst vorkonfiguriert. Vor breiter Verteilung ist ein gemeinsam begrenzter Suchproxy oder eigener/vertraglicher Suchdienst erforderlich. Ein Nominatim-kompatibler HTTPS-Endpunkt ist in Einstellungen ohne neue APK umstellbar. Offline bleiben gespeicherte Reiseinformationen verfügbar; externe Karten, Fotos und neue Abfragen benötigen Verbindung.

Versionen, Tagesplanung, Kartenfilter, Stadtführungen, Verbindungen, Unterkünfte, Transfers, Backups und der signierte GitHub-Updateweg aus 1.3.1 sind enthalten. Die App ersetzt keine Buchungsbestätigung oder Navigationsfreigabe für ein bestimmtes Fahrzeug.
