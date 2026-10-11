#!/usr/bin/env bash
# Fails when osv-scanner JSON output has a finding at or above the CVSS threshold.
# A finding without a CVSS score counts as at the threshold when its GitHub advisory
# severity is MODERATE or higher. Unscored advisories (e.g. RUSTSEC "unmaintained")
# are reported but do not fail. The blocking rule lives in osv-findings.jq.
# Usage: osv-threshold.sh <osv-results.json> <cvss-threshold>
set -euo pipefail

RESULTS="$1"
THRESHOLD="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FINDINGS=$(jq --argjson threshold "$THRESHOLD" --arg root "$PWD/" -f "$SCRIPT_DIR/osv-findings.jq" "$RESULTS")

TOTAL=$(jq 'length' <<<"$FINDINGS")
BLOCKING=$(jq '[.[] | select(.blocking)] | length' <<<"$FINDINGS")

echo "Findings: $TOTAL total, $BLOCKING at or above CVSS $THRESHOLD."
jq -r '.[] | "\(if .blocking then "❌" else "ℹ️ " end) \(.package) [\(.source)] \(.ids) cvss=\(if .cvss == "" then "n/a" else .cvss end) \(.ghsa)"' <<<"$FINDINGS"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### OSV Scanner: $BLOCKING blocking of $TOTAL findings (threshold CVSS $THRESHOLD)"
    echo
    echo "| | Package | Source | Advisories | CVSS |"
    echo "|---|---|---|---|---|"
    jq -r '.[] | "| \(if .blocking then "❌" else "ℹ️" end) | `\(.package)` | \(.source) | \(.ids) | \(if .cvss == "" then "n/a" else .cvss end) |"' <<<"$FINDINGS"
  } >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$BLOCKING" -gt 0 ]; then
  echo "Fix these findings, or suppress one in osv-scanner.toml with a justification (see SECURITY.md)."
  exit 1
fi
