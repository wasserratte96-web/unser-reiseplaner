# Changelog

## 1.2.0
- **Entdecken grundlegend neu aufgebaut:** Vorschläge werden nicht mehr direkt als Reisetags-Stopp gespeichert, sondern zunächst in einer reiseweiten Wunschliste gesammelt.
- Städte, nationale Highlights und Wildlife lassen sich mit **Muss / Hoch / Mittel / Optional** priorisieren.
- Bereits ausgewählte Vorschläge sind direkt mit einem **Häkchen** markiert.
- Neue Übersicht **„Meine Auswahl für die Route“** mit allen ausgewählten Zielen.
- Neue Funktion **„Routenvorschlag erstellen“**: legt aus Auswahl, Prioritäten, Reisedauer und geografischer Nähe automatisch eine neue Reiseversion an.
- Der automatische Entwurf erzeugt die notwendigen Planungsbausteine: Highlight-/Stadt-/Wildlife-Stopps, Unterkunfts-Platzhalter, Langstrecken-Verbindungen, Transfers und erste zeitliche Schätzungen.
- Konkrete Buchungsdaten bleiben bewusst offen: Flug-/Zugnummern, Betreiber, Unterkunftsadressen, Buchungsreferenzen und noch unbestimmte Verkehrsmittel können später ergänzt werden.
- Offene oder nur geschätzte Angaben werden im Planer mit **gelbem ⚠-Hinweis** dargestellt; die Kopfzeile zeigt die Gesamtzahl offener Punkte.
- Wildlife-Ziele werden für den Routenvorschlag nach Möglichkeit automatisch mit einem iNaturalist-Beobachtungscluster im Reiseland verknüpft.
- Wenn die Auswahl für den Zeitraum zu groß ist, werden niedrig priorisierte bzw. geografisch nicht auflösbare Ziele sichtbar als **„nicht eingeplant“** geführt und nicht aus der Wunschliste gelöscht.
- Alte in 1.1.x gespeicherte Wildlife-Zielarten werden beim ersten Start soweit möglich in die neue Wunschliste übernommen.

## 1.1.5
- Externe Inhalte werden strenger auf Name, Geografie und IDs geprüft.
- Stadt- und Sehenswürdigkeitsbilder werden nur bei belastbarer Zuordnung angezeigt.
- Overpass-Anfragen nutzen mehrere öffentliche Endpunkte als Fallback.
