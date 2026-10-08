#!/usr/bin/env bash
# Updates package-lock.json for every blocking npm finding in osv-scanner JSON output.
# Only `npm update <package> --package-lock-only` is tried, so a package whose patched
# version is outside the range the manifests allow is left for a maintainer.
# Usage: osv-fix-npm.sh <osv-results.json> <cvss-threshold>
set -euo pipefail

RESULTS="$1"
THRESHOLD="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PACKAGES=()
while IFS= read -r name; do
  PACKAGES+=("$name")
done < <(
  jq --argjson threshold "$THRESHOLD" --arg root "$PWD/" -f "$SCRIPT_DIR/osv-findings.jq" "$RESULTS" \
    | jq -r '[.[] | select(.blocking and .ecosystem == "npm" and .source == "package-lock.json") | .name] | unique | .[]'
)

if [ "${#PACKAGES[@]}" -eq 0 ]; then
  echo "No blocking npm finding in package-lock.json."
  exit 0
fi

echo "Updating within the allowed ranges: ${PACKAGES[*]}"
npm update "${PACKAGES[@]}" --package-lock-only --no-audit --no-fund
