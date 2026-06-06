#!/bin/bash
# Docker smoke test for calm-hub images.
#
# Usage: smoke-test.sh [BASE_URL] [MODE] [TIMEOUT]
#   BASE_URL  - base URL of the running container (default: http://localhost:8080)
#   MODE      - 'readonly' or 'readwrite' (default: readwrite)
#   TIMEOUT   - seconds to wait for readiness (default: 120)
#
# Readonly mode assertions:
#   GET    /calm/namespaces        -> 200  (reads work)
#   POST   /calm/namespaces        -> 405  (writes blocked by ReadOnlyRequestFilter)
#   PUT    /calm/namespaces/smoke  -> 405
#   DELETE /calm/namespaces/smoke  -> 405
#
# Readwrite mode assertions:
#   GET    /calm/namespaces        -> 200  (reads work)
#   POST   /calm/namespaces        -> 201  (writes allowed; namespace created)
#
# Readiness polling uses /q/swagger-ui rather than /q/health/ready because the
# MongoDB health check is disabled in standalone profile, causing /q/health/ready
# to return 404.  The /q/swagger-ui endpoint becomes available as soon as Quarkus
# has finished starting, which is the signal we need.  This matches the idiom
# used in seed-readonly.sh.

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
MODE="${2:-readwrite}"
TIMEOUT="${3:-120}"

# ── Readiness poll ────────────────────────────────────────────────────────────
echo "[smoke] Waiting for ${BASE_URL} to become ready (timeout: ${TIMEOUT}s)..."
elapsed=0
interval=3
until curl -sf "${BASE_URL}/q/swagger-ui" > /dev/null 2>&1; do
    sleep "${interval}"
    elapsed=$((elapsed + interval))
    if [[ "${elapsed}" -ge "${TIMEOUT}" ]]; then
        echo "[smoke] ERROR: Timed out waiting for ${BASE_URL} after ${TIMEOUT}s." >&2
        exit 1
    fi
    echo "[smoke]   still waiting... ${elapsed}s / ${TIMEOUT}s"
done
echo "[smoke] Ready."

# ── Assertion helper ──────────────────────────────────────────────────────────
# assert METHOD PATH EXPECTED_CODE [extra curl args...]
assert() {
    local method="$1" path="$2" expected="$3"
    shift 3
    local actual
    actual=$(curl -s -o /dev/null -w '%{http_code}' -X "${method}" "${BASE_URL}${path}" "$@")
    if [[ "${actual}" == "${expected}" ]]; then
        echo "[smoke] OK   ${method} ${path} -> ${actual}"
    else
        echo "[smoke] FAIL ${method} ${path} -> ${actual} (expected ${expected})" >&2
        exit 1
    fi
}

# ── Assertions ────────────────────────────────────────────────────────────────
echo "[smoke] Running assertions (mode: ${MODE})..."

assert GET /calm/namespaces 200

if [[ "${MODE}" == "readonly" ]]; then
    assert POST   /calm/namespaces       405 -H 'Content-Type: application/json' -d '{"name":"smoke-test","description":"smoke test namespace"}'
    assert PUT    /calm/namespaces/smoke  405
    assert DELETE /calm/namespaces/smoke  405
else
    assert POST /calm/namespaces 201 -H 'Content-Type: application/json' -d '{"name":"smoke-test","description":"smoke test namespace"}'
fi

echo "[smoke] All assertions passed (mode: ${MODE})."
