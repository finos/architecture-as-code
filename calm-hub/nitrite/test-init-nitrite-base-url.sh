#!/usr/bin/env bash
# Regression for init-nitrite.sh: -u must reach the name-based seed $id.
# Sources the script and stops before main, so no Hub is required.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT="${ROOT}/init-nitrite.sh"
PATTERN_ID="http://localhost:18091/calm/namespaces/finos.agentic-sdlc/patterns/governed-service/versions/1.0.0"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

# Print url, base, and the canonical $id after argument parsing.
# $1 is optional shell that sets environment variables. Remaining args are flags.
resolve() {
    local env_script="$1"
    shift
    bash -c '
        set -e
        unset CALM_HUB_URL CALM_HUB_BASE_URL
        eval "$1"
        # shellcheck disable=SC1090
        source "$2"
        parse_args "${@:3}"
        resolve_calm_hub_base_url
        printf "url=%s\n" "$CALM_HUB_URL"
        printf "base=%s\n" "$CALM_HUB_BASE_URL"
        printf "id=%s\n" "$(named_document_canonical_id finos.agentic-sdlc patterns governed-service 1.0.0)"
    ' _ "$env_script" "$INIT" "$@"
}

expect() {
    local label="$1"
    local expected_url="$2"
    local expected_base="$3"
    local env_script="$4"
    shift 4
    local output url base id
    output="$(resolve "$env_script" "$@")"
    url="$(sed -n 's/^url=//p' <<<"$output")"
    base="$(sed -n 's/^base=//p' <<<"$output")"
    id="$(sed -n 's/^id=//p' <<<"$output")"
    [[ "$url" == "$expected_url" ]] || fail "$label url: expected $expected_url, got $url"
    [[ "$base" == "$expected_base" ]] || fail "$label base: expected $expected_base, got $base"
    [[ "$id" == "${expected_base}/calm/namespaces/finos.agentic-sdlc/patterns/governed-service/versions/1.0.0" ]] \
        || fail "$label id: got $id"
    echo "PASS: $label"
    echo "  id=$id"
}

expect "default" \
    "http://localhost:8080" "http://localhost:8080" ""

expect "-u flag" \
    "http://localhost:18091" "http://localhost:18091" "" \
    -u http://localhost:18091

[[ "$(resolve "" -u http://localhost:18091 | sed -n 's/^id=//p')" == "$PATTERN_ID" ]] \
    || fail "-u canonical id did not match the name-based pattern id"
echo "PASS: -u canonical id is ${PATTERN_ID}"

expect "--url flag" \
    "http://localhost:18091" "http://localhost:18091" "" \
    --url http://localhost:18091

expect "CALM_HUB_URL environment" \
    "http://localhost:18091" "http://localhost:18091" \
    "CALM_HUB_URL=http://localhost:18091"

expect "explicit CALM_HUB_BASE_URL wins over -u" \
    "http://localhost:18091" "http://ids.example" \
    "CALM_HUB_BASE_URL=http://ids.example" \
    -u http://localhost:18091

expect "--base-url wins over -u" \
    "http://localhost:18091" "http://ids.example" "" \
    -u http://localhost:18091 -b http://ids.example

expect "--base-url alone" \
    "http://localhost:8080" "http://ids.example" "" \
    --base-url http://ids.example

help_text="$(bash "$INIT" -h)"
grep -q 'calm.hub.base-url' <<<"$help_text" || fail "help does not mention calm.hub.base-url"
grep -q -- '--base-url' <<<"$help_text" || fail "help does not mention --base-url"
echo "PASS: help documents calm.hub.base-url"

# Executed path: main resolves the base before it contacts the hub.
if exec_output="$(bash "$INIT" -u http://localhost:18091 2>&1)"; then
    fail "expected init-nitrite.sh to stop when the hub is down"
fi
grep -q 'Target URL: http://localhost:18091' <<<"$exec_output" \
    || fail "executed -u did not set the target URL: $exec_output"
grep -q 'id base: http://localhost:18091' <<<"$exec_output" \
    || fail "executed -u did not set the seed base: $exec_output"
echo "PASS: executed -u prints the flag as the seed base"

if exec_output="$(CALM_HUB_BASE_URL=http://ids.example bash "$INIT" -u http://localhost:18091 2>&1)"; then
    fail "expected init-nitrite.sh to stop when the hub is down"
fi
grep -q 'Target URL: http://localhost:18091' <<<"$exec_output" \
    || fail "explicit base changed the target URL: $exec_output"
grep -q 'id base: http://ids.example' <<<"$exec_output" \
    || fail "explicit CALM_HUB_BASE_URL did not win: $exec_output"
echo "PASS: executed -u keeps an explicit CALM_HUB_BASE_URL"

echo "All init-nitrite base URL checks passed."
