#!/usr/bin/env bash
# Validate the Multi-Agent Reference Architecture CALM document series.
#
# Patterns are validated against the CALM meta-schema; architectures are
# validated against their declared pattern (resolved via url-mapping.json, which
# maps the canonical $schema URLs to the local pattern files). The tier links
# (node.details.detailed-architecture / required-pattern) are convention-only —
# no CALM tool walks them — so each document is validated independently here.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$DIR" rev-parse --show-toplevel)"
CLI=(node "$ROOT/cli/dist/index.js" validate)
MAP="$DIR/url-mapping.json"
fail=0

for p in "$DIR"/*.pattern.json; do
  if "${CLI[@]}" -p "$p" -f json >/dev/null 2>&1; then
    echo "ok   pattern  $(basename "$p")"
  else
    echo "FAIL pattern  $(basename "$p")"; fail=1
  fi
done

for a in "$DIR"/*.arch.json "$DIR"/loan/*.arch.json; do
  if "${CLI[@]}" -a "$a" -u "$MAP" -f json >/dev/null 2>&1; then
    echo "ok   arch     ${a#"$DIR"/}"
  else
    echo "FAIL arch     ${a#"$DIR"/}"; fail=1
  fi
done

[ "$fail" -eq 0 ] && echo "All documents valid." || echo "Validation failed."
exit "$fail"
