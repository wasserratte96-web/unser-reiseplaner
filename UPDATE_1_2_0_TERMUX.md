# Update auf 1.2.0 vollständig per Android / Termux

1. Die ZIP `Unser_Reiseplaner_V1_2_0_Update.zip` als `reiseplaner-update.zip` in **Downloads** speichern.
2. In Termux synchronisieren:

```bash
rm -rf ~/reiseplaner-neu
mkdir -p ~/reiseplaner-neu
unzip -q ~/storage/downloads/reiseplaner-update.zip -d ~/reiseplaner-neu
SRC="$(find ~/reiseplaner-neu -mindepth 1 -maxdepth 1 -type d | head -n 1)"
rsync -a --delete --exclude='.git/' "$SRC"/ ~/unser-reiseplaner/
chmod +x ~/unser-reiseplaner/gradlew
cd ~/unser-reiseplaner
```

3. Veröffentlichen:

```bash
bash tools/publish-mobile.sh 1.2.0 \
  "Entdecken-Wunschliste, Prioritäten, automatischer Routenvorschlag und offene Planungsbausteine."
```

4. Nach erfolgreichem Release in der App:
**Mehr → App-Updates → Nach Updates suchen → Version 1.2.0 installieren**.
