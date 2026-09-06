# Update auf 1.1.4 vollständig per Android/Termux

1. `Unser_Reiseplaner_V1_1_4_Update.zip` als `reiseplaner-update.zip` in Downloads speichern.
2. In Termux:

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
bash tools/publish-mobile.sh 1.1.4 "Detail-Popups mit Bildern, flexible Verbindungen und Transfers sowie robuster Android-Safe-Area-Fix."
```

4. Danach in der App: **Mehr → App-Updates → Nach Updates suchen**.
