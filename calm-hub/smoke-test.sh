#!/bin/bash
# Docker smoke test for calm-hub images.
#
# Usage: smoke-test.sh [BASE_URL] [MODE] [TIMEOUT]
#   BASE_URL  - base URL of the running container (default: http://localhost:8080)
#   MODE      - 'readonly' or 'readwrite' (default: readwrite)
#   TIMEOUT   - seconds to wait for readiness (default: 120)
#
# API surface tested
# ──────────────────
# Numeric-ID storage endpoints live under /api/calm/... (NamespaceResource,
# ArchitectureResource, PatternResource, etc.)
#
# User-facing name-based endpoints live under /calm/... (MappingControllerResource):
#   POST /calm/namespaces/{ns}/{type}/{name}/versions/{version}
#   GET  /calm/namespaces/{ns}/{type}/{name}/versions
#   GET  /calm/namespaces/{ns}/{type}/{name}/versions/{version}
#   GET  /calm/namespaces/{ns}/{type}
#   PUT  /calm  → 403 when allow.put.operations=false (default)
#
# Readonly mode assertions:
#   GET    /api/calm/namespaces                              -> 200  (reads work)
#   GET    /api/calm/namespaces/finos/architectures          -> 200  (seeded namespace)
#   GET    /api/calm/namespaces/finos/patterns               -> 200
#   GET    /api/calm/namespaces/traderx/architectures        -> 200
#   GET    /api/calm/namespaces/finos/architectures          body contains "name","description"
#   GET    /api/calm/namespaces/finos/patterns               body contains "name"
#   POST   /api/calm/namespaces                             -> 405  (blocked by ReadOnlyRequestFilter)
#   PUT    /api/calm/namespaces/smoke                       -> 405
#   DELETE /api/calm/namespaces/smoke                       -> 405
#   POST   /calm                                            -> 405  (user-facing API also blocked)
#   PUT    /calm                                            -> 405
#
# Readwrite mode assertions:
#   GET    /api/calm/namespaces                                          -> 200
#   POST   /api/calm/namespaces                                          -> 201  (create namespace)
#   GET    /api/calm/namespaces                                          -> 200
#   POST   /calm/namespaces/smoke-test/architectures/smoke-arch/versions/1.0.0  -> 201
#   GET    /calm/namespaces/smoke-test/architectures                     -> 200
#   GET    /calm/namespaces/smoke-test/architectures                     body contains "name"
#   GET    /calm/namespaces/smoke-test/architectures/smoke-arch/versions -> 200
#   GET    /calm/namespaces/smoke-test/architectures/smoke-arch/versions/1.0.0  -> 200
#   GET    /calm/namespaces/smoke-test/architectures/smoke-arch/versions/1.0.0  body contains "$id"
#   PUT    /calm                                                         -> 403  (allow.put.operations=false)
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

# assert_body_contains METHOD PATH SUBSTRING
# Fetches the response body and fails unless it contains SUBSTRING.  This guards
# against the native-image serialization regression where summary endpoints
# returned HTTP 200 but with empty objects (e.g. {"values":[{}]}) because DTOs
# returned via raw Response were not registered for reflection.
assert_body_contains() {
    local method="$1" path="$2" needle="$3"
    local body
    body=$(curl -s -X "${method}" "${BASE_URL}${path}")
    if [[ "${body}" == *"${needle}"* ]]; then
        echo "[smoke] OK   ${method} ${path} body contains '${needle}'"
    else
        echo "[smoke] FAIL ${method} ${path} body missing '${needle}' -> ${body}" >&2
        exit 1
    fi
}

# ── Assertions ────────────────────────────────────────────────────────────────
echo "[smoke] Running assertions (mode: ${MODE})..."

if [[ "${MODE}" == "readonly" ]]; then
    # Read access to pre-seeded namespaces (numeric-ID storage API)
    assert GET /api/calm/namespaces 200
    assert GET /api/calm/namespaces/finos/architectures 200
    assert GET /api/calm/namespaces/finos/patterns 200
    assert GET /api/calm/namespaces/traderx/architectures 200
    # Summary payloads must be populated, not empty objects (native serialization
    # regression guard): a seeded summary must carry name and description fields.
    assert_body_contains GET /api/calm/namespaces/finos/architectures '"name"'
    assert_body_contains GET /api/calm/namespaces/finos/architectures '"description"'
    assert_body_contains GET /api/calm/namespaces/finos/patterns '"name"'
    # All mutating methods must be blocked on both API surfaces
    assert POST   /api/calm/namespaces       405 -H 'Content-Type: application/json' -d '{"name":"smoke-test","description":"smoke test namespace"}'
    assert PUT    /api/calm/namespaces/smoke  405
    assert DELETE /api/calm/namespaces/smoke  405
    assert POST   /calm                      405 -H 'Content-Type: application/json' -d '{}'
    assert PUT    /calm                      405 -H 'Content-Type: application/json' -d '{}'
else
    # Reads work before any writes (numeric-ID storage API)
    assert GET /api/calm/namespaces 200
    # Create and verify namespace via numeric-ID API
    assert POST /api/calm/namespaces 201 -H 'Content-Type: application/json' -d '{"name":"smoke-test","description":"smoke test namespace"}'
    assert GET  /api/calm/namespaces 200

    # Create an architecture via the user-facing name-based API.
    # The $id must equal the canonical versioned URL:
    #   {BASE_URL}/calm/namespaces/{namespace}/{type}/{name}/versions/{version}
    # calm.hub.base-url defaults to http://localhost:8080, which matches BASE_URL
    # when the smoke container is accessed on localhost:8080.
    arch_id="${BASE_URL}/calm/namespaces/smoke-test/architectures/smoke-arch/versions/1.0.0"
    arch_body='{"$id":"'"${arch_id}"'","title":"Smoke Architecture","description":"smoke test architecture"}'
    assert POST /calm/namespaces/smoke-test/architectures/smoke-arch/versions/1.0.0 \
        201 -H 'Content-Type: application/json' -d "${arch_body}"

    # List and retrieve via the user-facing API
    assert GET /calm/namespaces/smoke-test/architectures 200
    # Summary payload must carry the resource name (customId field in ResourceMapping)
    assert_body_contains GET /calm/namespaces/smoke-test/architectures '"customId"'
    assert GET /calm/namespaces/smoke-test/architectures/smoke-arch/versions 200
    assert GET /calm/namespaces/smoke-test/architectures/smoke-arch/versions/1.0.0 200
    # The returned document must carry $id rewritten to the canonical versioned URL
    assert_body_contains GET /calm/namespaces/smoke-test/architectures/smoke-arch/versions/1.0.0 '"$id"'

    # PUT /calm must return 403 when allow.put.operations=false (the default)
    assert PUT /calm 403 -H 'Content-Type: application/json' -d '{}'
fi

echo "[smoke] All assertions passed (mode: ${MODE})."
