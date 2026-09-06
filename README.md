# Unser Reiseplaner – Version 1.1.5

Version 1.1.5 konzentriert sich auf die **inhaltliche Konsistenz externer Datenquellen**.

## Wichtigste Regel
Ein externer Text oder ein Bild wird nur noch angezeigt, wenn die App den Inhalt ausreichend sicher dem angezeigten Ort, der Sehenswürdigkeit oder der Tierart zuordnen kann. Ist die Zuordnung nicht sicher, bleibt das Feld leer bzw. wird als nicht eindeutig verifiziert gekennzeichnet.

## Zuordnungslogik
- **Städte:** OpenStreetMap `place=city`; Wikipedia/Wikidata-IDs aus OSM werden bevorzugt.
- **Sehenswürdigkeiten einer Stadt:** OpenStreetMap-Radiusabfrage plus Distanzprüfung; Detailtext über exakte Wikipedia/Wikidata-ID oder strenge Geo-/Namensprüfung.
- **Bilder:** zunächst Bilder des verifizierten Wikipedia-Artikels, danach streng namensgefilterte Wikimedia-Commons-Dateien.
- **Wildlife:** iNaturalist-Taxon-ID für Artenliste und Bilder.
- **Nationale Highlights:** Wikipedia-Treffer müssen innerhalb der geografischen Grenzen des Ziellandes liegen.
- **Overpass:** mehrere öffentliche Endpunkte werden nacheinander probiert, wenn einer überlastet ist.

Die bestehende lokale Reiseplanung wird beim Update nicht gelöscht.
