#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-Update von Unser Reiseplaner}"
if [ -z "$VERSION" ]; then
  echo "Aufruf: bash tools/publish-mobile.sh 1.2.0 \"Beschreibung\""
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"

echo "==> Änderungen vorbereiten"
git add -A
if git diff --cached --quiet; then
  echo "Keine neuen Änderungen zum Committen. Bestehender main-Stand wird verwendet."
else
  git commit -m "Unser Reiseplaner ${VERSION}"
fi

echo "==> Zu GitHub übertragen"
git push

SHA="$(git rev-parse HEAD)"
wait_for_run() {
  local workflow="$1"
  local run_id=""
  for _ in $(seq 1 25); do
    run_id="$(gh run list --workflow "$workflow" --branch main --limit 10 --json databaseId,headSha --jq '.[] | select(.headSha=="'"$SHA"'") | .databaseId' 2>/dev/null | head -n 1 || true)"
    if [ -n "$run_id" ]; then
      echo "$run_id"
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "==> Test-Build abwarten"
sleep 3
CHECK_ID="$(wait_for_run build-check.yml)" || { echo "Test-Build für Commit $SHA wurde nicht gefunden."; exit 1; }
gh run watch "$CHECK_ID" --exit-status

echo "==> Signierten Release-Build ${VERSION} starten"
gh workflow run build-release.yml -f version_name="$VERSION" -f release_notes="$NOTES"
sleep 3
RELEASE_ID="$(wait_for_run build-release.yml)" || { echo "Release-Build wurde nicht gefunden."; exit 1; }
gh run watch "$RELEASE_ID" --exit-status

echo "==> Release prüfen"
gh release view "v${VERSION}" --json name,tagName,url --jq '"✓ " + .name + " (" + .tagName + ")\n" + .url'
echo "Fertig. Öffne in Unser Reiseplaner: Mehr → App-Updates → Nach Updates suchen."
