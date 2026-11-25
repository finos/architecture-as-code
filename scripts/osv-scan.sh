#!/usr/bin/env bash
# Scans every dependency tree in the repository and writes the osv-scanner JSON output.
# The OSV Scanner and OSV Fix workflows both use it, so the fix is judged on the same
# sources as the osv-scanner check. Vulnerabilities do not fail it: osv-threshold.sh
# gives the verdict.
# Usage: osv-scan.sh <output-file>   (OSV_SCANNER overrides the ./osv-scanner binary)
set -uo pipefail

OUTPUT="$1"

"${OSV_SCANNER:-./osv-scanner}" scan source \
  --config osv-scanner.toml \
  --lockfile package-lock.json \
  --lockfile calm-hub/pom.xml \
  --lockfile calm-models/pom.xml \
  --format json \
  --output-file "$OUTPUT"
STATUS=$?

# 0 = nothing found, 1 = vulnerabilities found; anything else is a scan error.
if [ "$STATUS" -gt 1 ]; then
  echo "❌ osv-scanner failed with exit code $STATUS."
  exit "$STATUS"
fi
