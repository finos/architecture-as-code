#!/usr/bin/env bash
# Fails when osv-scanner JSON output has a finding at or above the CVSS threshold.
# A finding without a CVSS score counts as at the threshold when its GitHub advisory
# severity is MODERATE or higher. Unscored advisories (e.g. RUSTSEC "unmaintained")
# are reported but do not fail.
# Usage: osv-threshold.sh <osv-results.json> <cvss-threshold>
set -euo pipefail

RESULTS="$1"
THRESHOLD="$2"

FINDINGS=$(jq --argjson threshold "$THRESHOLD" --arg root "$PWD/" '
  [ .results[]? as $r
    | $r.packages[]? as $p
    | $p.groups[]? as $g
    | ([$p.vulnerabilities[]? | select(.id as $id | $g.ids | index($id)) | .database_specific.severity // empty]) as $ghsa
    | {
        source: ($r.source.path | ltrimstr($root)),
        package: "\($p.package.name)@\($p.package.version)",
        ids: ($g.ids | join(", ")),
        cvss: ($g.max_severity // ""),
        ghsa: ($ghsa | unique | join(","))
      }
    | .blocking = (
        if .cvss != "" then (.cvss | tonumber) >= $threshold
        else (.ghsa | test("MODERATE|HIGH|CRITICAL")) end
      )
  ]' "$RESULTS")

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
