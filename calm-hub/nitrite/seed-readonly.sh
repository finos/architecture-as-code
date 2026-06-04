#!/bin/bash
# Seeding script for the read-only static calm-hub image.
#
# Starts calm-hub in standalone writable mode, runs init-nitrite.sh to populate
# the NitriteDB, then gracefully stops the app so the MVStore file is fully flushed.
#
# This script is executed inside the Docker seed stage (Stage 1) during the
# Dockerfile.readonly-static build.  It is not intended for direct use outside
# that context, but all paths and env-vars are configurable so it can be driven
# locally if needed.
#
# Environment variables:
#   DATA_DIR                - directory where the .db file will be written (default: /data)
#   CALM_HUB_URL            - base URL for readiness checks and seeder (default: http://localhost:8080)
#   CALM_SCHEMA_BASE_PATH   - path to the calm/ directory with release/ and draft/ (default: /calm)
#   CALM_CONTROLS_BASE_PATH - path to the controls/ directory (default: /controls)
#   READINESS_TIMEOUT       - seconds to wait for the app to become ready (default: 120)

set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
CALM_HUB_URL="${CALM_HUB_URL:-http://localhost:8080}"
CALM_SCHEMA_BASE_PATH="${CALM_SCHEMA_BASE_PATH:-/calm}"
CALM_CONTROLS_BASE_PATH="${CALM_CONTROLS_BASE_PATH:-/controls}"
READINESS_TIMEOUT="${READINESS_TIMEOUT:-120}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_NITRITE_SCRIPT="${SCRIPT_DIR}/init-nitrite.sh"

if [[ ! -f "${INIT_NITRITE_SCRIPT}" ]]; then
    echo "[seed] ERROR: init-nitrite.sh not found at ${INIT_NITRITE_SCRIPT}" >&2
    exit 1
fi

mkdir -p "${DATA_DIR}"

echo "[seed] Starting calm-hub in standalone writable mode (data dir: ${DATA_DIR})..."

QUARKUS_PROFILE=standalone \
CALM_STANDALONE_DATA_DIRECTORY="${DATA_DIR}" \
    java \
        -Dquarkus.http.host=0.0.0.0 \
        -Djava.util.logging.manager=org.jboss.logmanager.LogManager \
        -jar /deployments/quarkus-run.jar \
        > /var/log/calmhub-seed.log 2>&1 &
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

echo "[seed] Seeding complete. Stopping calm-hub gracefully (SIGTERM)..."
kill -TERM "${APP_PID}"
wait "${APP_PID}" || true

echo "[seed] calm-hub stopped. Seeded database:"
ls -lh "${DATA_DIR}/"
echo "[seed] Done."
