# Entscheidungen für 1.5.0

Die vorangegangene Marktrecherche (`MARKTRECHERCHE_1_4_0.md`) liefert die Ausgangshypothesen. Die folgenden Produktentscheidungen setzen die anschließend freigegebenen Punkte 1–4 um. Sie sind noch nicht durch eine neue Anwenderstudie bestätigt.

| Erkenntnis / Bedarf | Umsetzung | Grenze der ersten Version |
| --- | --- | --- |
| Zu viele gleichzeitige Entscheidungen erschweren den Einstieg | Zwei Hauptbereiche, dreistufige Reiseanlage, aufklappbare Tagespläne, Varianten im Menü | Bedienungsprüfung durch den Nutzer steht aus |
| Naturmotive sind nicht gleich Aufenthaltsorte | Basis und Ausflug getrennt; Hinweg + Besuch + Rückweg | Basen/Zugänge werden eingegeben bzw. aus zwei Fitz-Roy-Vorlagen übernommen; keine automatische weltweite Basensuche |
| Verkehrsmittel beeinflussen schon die Zielwahl | Mobilität von Anfang an; Flüge und Extras separat | Unbekannte Zugänge bleiben zur Prüfung sichtbar |
| Jahreszeit und Motive gehören zusammen | Ziel → Monate und Monat → Regionen; vier Entdeckerkategorien | 20 redaktionelle Profile, keine Wetter- oder Sichtungsprognosen |
| Langstrecken brauchen konkrete Start-/Zielknoten | Suchbare und bestätigte Kartenpunkte für Flughäfen/Bahnhöfe/Busstationen | Keine automatische Annahme, dass der erste Suchtreffer richtig ist |
| Fahrpläne sind außerhalb der App besser aufgehoben | Externe Karten-/Betreiberlinks; Buchungszeiten manuell | Kein Fahrplanimport, keine Live-Abfahrten oder Ticketbuchung |

## Datenstrategie

Ein kleiner belegter Katalog ist der erste Datenbestand. Jedes Regionsprofil und jeder Flughafenhinweis enthält Quelle und Prüftag. Redaktionelle Einschätzungen zu Aufenthaltsdauer und Reisezeit sind als solche gekennzeichnet. Fehlende Informationen werden nicht als Erreichbarkeit ausgegeben. Im ÖPNV-Filter bleiben Regionen mit unklaren oder zusätzlichen Zugängen als solche markiert; eine Trefferliste bedeutet keine bestätigte ÖPNV-Rundreise.

Priorität für spätere Erweiterungen nach Rückmeldung: Regionen/Flughäfen der tatsächlich geplanten Reisen, genauere Motivsaisons, weitere Zugangsvorlagen und eine bequemere Übernahme mehrerer Jahresplaner-Ziele. Eine weltweite Echtzeit-Verbindungsdatenbank ist nicht geplant.

## Spätere iterative Bedienungsprüfung

Erst nach Freigabe von Version und Zeitpunkt: realistische Aufgaben durchführen, Sackgassen und unnötige Schritte protokollieren, eine kleine Gruppe von Änderungen umsetzen und dieselben Aufgaben erneut prüfen. Drei bis fünf Durchgänge wären ein sinnvoller erster Umfang. Browserprüfungen der Weboberfläche sind möglich; native Installation, Android-Berechtigungen und Verhalten auf dem konkreten Pixel brauchen zusätzlich ein geeignetes Gerät oder einen Emulator. Diese Version wurde nicht eigenständig in solchen Nutzungsdurchgängen optimiert.
