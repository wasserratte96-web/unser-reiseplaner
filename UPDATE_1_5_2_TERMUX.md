# UX-Update 1.5.2

Das Update vereinfacht den ersten Einstieg, die Inspirationssuche und die Formulare für Fortbewegung und Ausflüge. Die App benötigt weiterhin dieselben grundlegenden Reiseangaben. Aktive Einschränkungen bleiben in kurzen Zusammenfassungen sichtbar.

## Prüfen

Der Quellstand liegt im Arbeitszweig `codex/ux-1.5.2`. Änderungen und Prüfnachweise stehen im zugehörigen Pull Request und in `docs/UX_1_5_2.md`. Die Debug-APK aus dem Build dient der Prüfung; das Update einer vorhandenen Release-App benötigt deren bisherigen Signaturschlüssel.

## Bestehenden Smartphone-Updateweg verwenden

Vor einer Installation in der App ein Backup exportieren. Wenn dieser Stand für die Auslieferung übernommen wird, kann der bestehende Termux-/GitHub-Weg mit Version `1.5.2` verwendet werden:

```bash
cd "$HOME/unser-reiseplaner"
bash tools/publish-mobile.sh 1.5.2
```

Dieser Befehl setzt voraus, dass der gewünschte Quellstand bereits in deinem vorhandenen Checkout übernommen wurde. Das Skript veröffentlicht nach seinen Prüfungen die APK mit dem bestehenden Release-Schlüssel. Ein Entwurfs-PR allein ändert den Checkout und die installierte App noch nicht.

Das mitgelieferte `tools/apply-update.sh` unterstützt die Übernahme eines separat entpackten vollständigen Projektstands in einen sauberen main-Checkout bis einschließlich Version 1.5.1. Es sichert den alten Quellcode und erhält lokale SDK-Einstellungen sowie Signaturdateien.

## Auf dem Smartphone prüfen

1. Bestehende Reise öffnen und den markierten Bereich „Meine Reisen“ prüfen.
2. Eine neue Reise anlegen; Fortbewegung wählen und die Zusammenfassung kontrollieren.
3. „Flüge, Transfers und Gehzeit anpassen“ öffnen, ändern und erneut aufrufen.
4. Einen Ausflug über eine Vorlage anlegen und seine Wegzeiten sowie Hinweise bearbeiten.
5. Größere Systemschrift, Bildschirmtastatur und Android-Zurückgeste ausprobieren.

Jede weitere UX-Optimierung beginnt erst mit einem neuen Go des Nutzers in diesem Chat.
