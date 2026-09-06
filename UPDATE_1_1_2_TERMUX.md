# Update 1.1.2 komplett auf Android/Termux

1. ZIP in Android Downloads als `reiseplaner-update.zip` speichern.
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
bash tools/publish-mobile.sh 1.1.2 "Städte-Inspiration, Sightseeing-Touren, Unterkünfte, Flughafentransfers und Statusleisten-Fix."
```

4. Danach in der installierten App: **Mehr → App-Updates → Nach Updates suchen**.
