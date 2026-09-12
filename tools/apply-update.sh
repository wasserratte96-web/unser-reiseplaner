#!/usr/bin/env bash
set -euo pipefail
urp_source="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
urp_target="${1:-${HOME}/unser-reiseplaner}"
[[ -d "$urp_target/.git" ]] || { echo 'Der Zielordner muss dein vorhandener Git-Checkout sein.'; exit 1; }
urp_target="$(cd -- "$urp_target" && pwd)"
[[ "$urp_target" != "$urp_source" ]] || { echo 'ZIP zunächst in einen separaten Ordner entpacken.'; exit 1; }
[[ "$(git -C "$urp_target" branch --show-current)" == main ]] || { echo 'Bitte den main-Checkout verwenden.'; exit 1; }
[[ -z "$(git -C "$urp_target" status --porcelain)" ]] || { echo 'Im Checkout liegen eigene Änderungen. Erst sichern/committen, dann das Update erneut anwenden.'; exit 1; }
[[ -f "$urp_target/app/build.gradle" ]] || { echo 'Im Checkout fehlt das bisherige Android-Projekt.'; exit 1; }
urp_current="$(sed -n "s/.*ciVersionName.*?: '\([^']*\)'.*/\1/p" "$urp_target/app/build.gradle")"
case "$urp_current" in
  1.0.0|1.1.0|1.1.1|1.1.2|1.1.3|1.1.4|1.1.5|1.2.0|1.3.0) ;;
  *) echo "Unbekannter oder neuerer Ausgangsstand ($urp_current). Kein automatisches Überschreiben."; exit 1 ;;
esac
bash "$urp_source/tools/verify.sh"
urp_backup="$(dirname -- "$urp_target")/reiseplaner-quellcode-backup-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}"
mkdir -p "$urp_backup"
git -C "$urp_target" archive HEAD | tar -x -C "$urp_backup"
# All source files are present. Keep unrelated files and local signing material.
rsync -a --exclude='.git/' --exclude='.gradle/' --exclude='build/' --exclude='.idea/' \
  --exclude='local.properties' --exclude='*.jks' --exclude='*.keystore' \
  --exclude='keystore-base64.txt' --exclude='release-signing.properties' \
  "$urp_source/" "$urp_target/"
chmod +x "$urp_target/gradlew" "$urp_target/tools/"*.sh
printf 'Update eingespielt. Vorheriger Quellcode: %s\n' "$urp_backup"
printf 'Weiter im Checkout: bash tools/publish-mobile.sh 1.3.1\n'
