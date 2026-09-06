# Update auf 1.1.3 vollständig per Android/Termux

1. `Unser_Reiseplaner_V1_1_3_Update.zip` als `reiseplaner-update.zip` in Downloads speichern.
2. In Termux:

```bash
rm -rf ~/reiseplaner-neu
mkdir -p ~/reiseplaner-neu
unzip -q ~/storage/downloads/reiseplaner-update.zip -d ~/reiseplaner-neu
SRC="$(find ~/reiseplaner-neu -mindepth 1 -maxdepth 1 -type d | head -n 1)"
rsync -a --delete --exclude='.git/' "$SRC"/ ~/unser-reiseplaner/
chmod +x ~/unser-reiseplaner/gradlew
cd ~/unser-reiseplaner
bash tools/publish-mobile.sh 1.1.3 "Konkrete nationale Highlights, erweiterbare Inspirationslisten und Statusleisten-Fix."
```

3. Danach in der installierten App: **Mehr → App-Updates → Nach Updates suchen**.
