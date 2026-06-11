#!/bin/bash
# Seeding script for the read-only static calm-hub image.
#
# Starts calm-hub in standalone writable mode, runs init-nitrite.sh to populate
# the NitriteDB, then gracefully stops the app so the MVStore file is fully flushed.
#
# This script is executed inside the Docker seed stage (Stage 1) during the
# Dockerfile.readonly-static and Dockerfile.readonly-native builds.  It is not
# intended for direct use outside
# that context, but all paths and env-vars are configurable so it can be driven
# locally if needed.
#
# Environment variables:
#   DATA_DIR                - directory where the .db file will be written (default: /data)
#   CALM_HUB_URL            - base URL for readiness checks and seeder (default: http://localhost:8080)
#   CALM_SCHEMA_BASE_PATH   - path to the calm/ directory with release/ and draft/ (default: /calm)
#   CALM_CONTROLS_BASE_PATH - path to the controls/ directory (default: /controls)
#   READINESS_TIMEOUT       - seconds to wait for the app to become ready (default: 120)
#   CALM_HUB_NATIVE_BINARY  - optional path to a native runner binary; when set, the
#                             native binary is launched instead of 'java -jar' JVM mode

set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
CALM_HUB_URL="${CALM_HUB_URL:-http://localhost:8080}"
CALM_SCHEMA_BASE_PATH="${CALM_SCHEMA_BASE_PATH:-/calm}"
CALM_CONTROLS_BASE_PATH="${CALM_CONTROLS_BASE_PATH:-/controls}"
READINESS_TIMEOUT="${READINESS_TIMEOUT:-120}"
CALM_HUB_NATIVE_BINARY="${CALM_HUB_NATIVE_BINARY:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_NITRITE_SCRIPT="${SCRIPT_DIR}/init-nitrite.sh"

if [[ ! -f "${INIT_NITRITE_SCRIPT}" ]]; then
    echo "[seed] ERROR: init-nitrite.sh not found at ${INIT_NITRITE_SCRIPT}" >&2
    exit 1
fi

mkdir -p "${DATA_DIR}"

echo "[seed] Starting calm-hub in standalone writable mode (data dir: ${DATA_DIR})..."

if [[ -n "${CALM_HUB_NATIVE_BINARY}" ]]; then
    echo "[seed] Launch mode: native (${CALM_HUB_NATIVE_BINARY})"
    QUARKUS_PROFILE=standalone \
    CALM_STANDALONE_DATA_DIRECTORY="${DATA_DIR}" \
        "${CALM_HUB_NATIVE_BINARY}" \
            -Dquarkus.http.host=0.0.0.0 \
            > /var/log/calmhub-seed.log 2>&1 &
else
    echo "[seed] Launch mode: JVM"
    QUARKUS_PROFILE=standalone \
    CALM_STANDALONE_DATA_DIRECTORY="${DATA_DIR}" \
        java \
            -Dquarkus.http.host=0.0.0.0 \
            -Djava.util.logging.manager=org.jboss.logmanager.LogManager \
            -jar /deployments/quarkus-run.jar \
            > /var/log/calmhub-seed.log 2>&1 &
fi
APP_PID=$!
echo "[seed] calm-hub started (PID ${APP_PID})"

echo "[seed] Waiting for calm-hub to become ready (timeout: ${READINESS_TIMEOUT}s)..."
elapsed=0
interval=3
until curl -sf "${CALM_HUB_URL}/q/swagger-ui" > /dev/null 2>&1; do
    sleep "${interval}"
    elapsed=$((elapsed + interval))
    if [ "${elapsed}" -ge "${READINESS_TIMEOUT}" ]; then
        echo "[seed] ERROR: Timed out after ${READINESS_TIMEOUT}s. Last log output:" >&2
        tail -50 /var/log/calmhub-seed.log >&2
        kill "${APP_PID}" 2>/dev/null || true
        exit 1
    fi
    echo "[seed]   still waiting... ${elapsed}s / ${READINESS_TIMEOUT}s"
done
echo "[seed] calm-hub is ready."

echo "[seed] Running init-nitrite.sh..."
CALM_HUB_URL="${CALM_HUB_URL}" \
CALM_SCHEMA_BASE_PATH="${CALM_SCHEMA_BASE_PATH}" \
CALM_CONTROLS_BASE_PATH="${CALM_CONTROLS_BASE_PATH}" \
    bash "${INIT_NITRITE_SCRIPT}"

# Verify the database was actually populated before baking it into the image.
# init-nitrite.sh intentionally tolerates per-request failures (it only prints
# warnings), so an empty database can otherwise pass the build undetected. Query
# the namespaces endpoint and fail loudly if nothing was persisted.
echo "[seed] Verifying seeded data..."
NAMESPACE_RESPONSE="$(curl -s "${CALM_HUB_URL}/calm/namespaces" || true)"
NAMESPACE_COUNT="$(echo "${NAMESPACE_RESPONSE}" | jq -r '.values | length' 2>/dev/null || echo 0)"
echo "[seed] Namespaces persisted: ${NAMESPACE_COUNT}"
if [[ -z "${NAMESPACE_COUNT}" || "${NAMESPACE_COUNT}" == "0" ]]; then
    echo "[seed] ERROR: Seeding produced an empty database (0 namespaces)." >&2
    echo "[seed] Namespaces endpoint returned: ${NAMESPACE_RESPONSE}" >&2
    echo "[seed] ===== calm-hub seed log =====" >&2
    cat /var/log/calmhub-seed.log >&2 || true
    echo "[seed] ===== end seed log =====" >&2
    kill -TERM "${APP_PID}" 2>/dev/null || true
    exit 1
fi

# Allow the NitriteDB MVStore auto-commit thread to flush the seeded data to
# disk before we stop the app. The writable store is opened with autoCommit(true),
# which persists periodically (~1-2s) while running. In a fast build the seed can
# otherwise complete and the app be stopped within a few milliseconds - faster
# than both the periodic flush and the shutdown-hook close() flush - leaving only
# the empty MVStore header (~8 KB) on disk and producing an empty image database.
SEED_SETTLE_SECONDS="${SEED_SETTLE_SECONDS:-5}"
echo "[seed] Letting NitriteDB flush to disk (settle: ${SEED_SETTLE_SECONDS}s)..."
sleep "${SEED_SETTLE_SECONDS}"
sync

echo "[seed] Stopping calm-hub gracefully (SIGTERM)..."
kill -TERM "${APP_PID}"
wait "${APP_PID}" || true
sync

echo "[seed] calm-hub stopped. Seeded database:"
ls -lh "${DATA_DIR}/"

# Final durability guard: the empty MVStore header is ~8 KB, so a database that
# was actually populated must be larger. Fail loudly if the on-disk file looks
# empty even though the in-memory verification above passed.
DB_FILE="${DATA_DIR}/calmSchemas.db"
DB_SIZE_BYTES="$(wc -c < "${DB_FILE}" 2>/dev/null || echo 0)"
echo "[seed] On-disk database size: ${DB_SIZE_BYTES} bytes"
if [[ "${DB_SIZE_BYTES}" -le 8192 ]]; then
    echo "[seed] ERROR: On-disk database (${DB_SIZE_BYTES} bytes) looks empty - the" >&2
    echo "[seed]        seeded data was not flushed to disk before shutdown." >&2
    echo "[seed] ===== calm-hub seed log =====" >&2
    cat /var/log/calmhub-seed.log >&2 || true
    echo "[seed] ===== end seed log =====" >&2
    exit 1
fi

echo "[seed] Done."
