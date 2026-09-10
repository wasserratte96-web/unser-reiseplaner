#!/usr/bin/env bash
set -euo pipefail
urp_version="${1:-}"
urp_notes="${2:-Unser Reiseplaner: Prioritäten, Tagesplanung und Datenzuordnung verbessert.}"
urp_repo='wasserratte96-web/unser-reiseplaner'
[[ "$urp_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Aufruf: bash tools/publish-mobile.sh 1.3.0 "Beschreibung"'; exit 2; }
cd "$(git rev-parse --show-toplevel)"
[[ "$(git branch --show-current)" == main ]] || { echo 'Bitte im vorgesehenen main-Checkout ausführen.'; exit 1; }
urp_remote="$(git remote get-url origin)"
case "$urp_remote" in
  "https://github.com/$urp_repo"|"https://github.com/$urp_repo.git"|"git@github.com:$urp_repo.git") ;;
  *) echo 'origin verweist nicht auf das vorgesehene Reiseplaner-Repository.'; exit 1 ;;
esac
[[ "$(node -p "require('./VERSION.json').versionName")" == "$urp_version" ]] || { echo 'Versionsnummer passt nicht zum Projekt.'; exit 1; }
gh auth status >/dev/null
bash tools/verify.sh
if gh release view "v$urp_version" --repo "$urp_repo" >/dev/null 2>&1; then
  echo 'Diese Release-Version existiert bereits. Sie wird nicht überschrieben.'; exit 1
fi
git add -A
if ! git diff --cached --quiet; then git commit -m "Unser Reiseplaner $urp_version"; fi
git push origin main
urp_sha="$(git rev-parse --verify HEAD)"
urp_remote_sha="$(git ls-remote origin refs/heads/main | cut -f1)"
[[ "$urp_sha" == "$urp_remote_sha" ]] || { echo 'Der übertragene Commit stimmt nicht mit main überein.'; exit 1; }
urp_request="urp-${urp_version}-$(date -u +%Y%m%dT%H%M%SZ)-${RANDOM}"
urp_wait_for_run() {
  local workflow="$1" request="$2" run=''
  for ((attempt=0; attempt<40; attempt++)); do
    run="$(gh run list --repo "$urp_repo" --workflow "$workflow" --branch main --event workflow_dispatch --limit 30 --json databaseId,headSha,displayTitle | URP_SHA="$urp_sha" URP_REQUEST="$request" node -e 'let input="";process.stdin.on("data",x=>input+=x).on("end",()=>{const run=JSON.parse(input).find(x=>x.headSha===process.env.URP_SHA&&x.displayTitle===process.env.URP_REQUEST);if(run)process.stdout.write(String(run.databaseId));});')"
    if [[ -n "$run" ]]; then printf '%s\n' "$run"; return 0; fi
    sleep 2
  done
  echo 'Der neu angeforderte Build wurde nicht gefunden.' >&2; return 1
}
echo 'Prüfung des übertragenen Quellcodes starten …'
gh workflow run build-check.yml --repo "$urp_repo" --ref main -f source_sha="$urp_sha" -f request_id="$urp_request-check"
urp_check="$(urp_wait_for_run build-check.yml "$urp_request-check")"
gh run watch "$urp_check" --repo "$urp_repo" --exit-status
echo 'Geprüften Commit bauen und signieren …'
gh workflow run build-release.yml --repo "$urp_repo" --ref main -f source_sha="$urp_sha" -f request_id="$urp_request-release" -f version_name="$urp_version" -f release_notes="$urp_notes"
urp_release="$(urp_wait_for_run build-release.yml "$urp_request-release")"
gh run watch "$urp_release" --repo "$urp_repo" --exit-status
gh release view "v$urp_version" --repo "$urp_repo" --json name,url --jq '.name + "\n" + .url'
echo 'Fertig. In der App: Mehr → App-Updates → Nach Updates suchen.'
