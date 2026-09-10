#!/usr/bin/env bash
set -euo pipefail
urp_project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$urp_project_dir"
node tools/validate-project.cjs
node --test tests/*.test.cjs
for urp_script in tools/*.sh; do bash -n "$urp_script"; done
if [[ "${1:-}" == --android ]]; then
  bash gradlew --no-daemon assembleDebug lintDebug
fi
