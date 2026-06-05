#!/bin/bash
# Build script for the calm-hub read-only static Docker image.
#
# Encapsulates all three steps required to produce the image so the process is
# identical locally and in CI:
#   1. Maven package  — compiles calm-hub and runs unit tests.
#   2. Stage content  — copies calm/ schemas and controls/ into the Docker build
#                       context (target/readonly-seed/) which is gitignored.
#   3. Docker build   — builds the two-stage Dockerfile.readonly-static image.
#
# Usage (from any directory):
#   bash calm-hub/build-readonly-image.sh [OPTIONS] [IMAGE_TAG]
#
# Options:
#   --no-docker    Run steps 1 and 2 only; skip the docker build step.
#                  CI uses this flag and performs its own multi-arch buildx push.
#   --no-maven     Skip the Maven build (assumes target/quarkus-app/ already exists).
#   --help         Show this message.
#
# IMAGE_TAG:
#   Optional Docker tag for the output image (default: calm-hub:read-only-static).
#
# Examples:
#   bash calm-hub/build-readonly-image.sh
#   bash calm-hub/build-readonly-image.sh calm-hub:0.7.6-read-only-static
#   bash calm-hub/build-readonly-image.sh --no-docker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="calm-hub:read-only-static"
RUN_DOCKER=true
RUN_MAVEN=true

for arg in "$@"; do
    case "${arg}" in
        --no-docker) RUN_DOCKER=false ;;
        --no-maven)  RUN_MAVEN=false  ;;
        --help)
            sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | grep '^#' | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        --*) echo "[build] Unknown option: ${arg}" >&2; exit 1 ;;
        *)   IMAGE_TAG="${arg}" ;;
    esac
done

# ── Step 1: Maven build ────────────────────────────────────────────────────────
if [[ "${RUN_MAVEN}" == true ]]; then
    echo "[build] Building calm-hub with Maven..."
    cd "${SCRIPT_DIR}"
    "${REPO_ROOT}/mvnw" package -DskipITs -Ddependency-check.skip=true
    cd "${REPO_ROOT}"
fi

# ── Step 2: Stage seed content into the Docker build context ──────────────────
echo "[build] Staging calm/ schemas and controls into target/readonly-seed/..."
mkdir -p "${SCRIPT_DIR}/target/readonly-seed/calm"
mkdir -p "${SCRIPT_DIR}/target/readonly-seed/controls"
cp -r "${REPO_ROOT}/calm/." "${SCRIPT_DIR}/target/readonly-seed/calm/"
cp -r "${SCRIPT_DIR}/mongo/controls/." "${SCRIPT_DIR}/target/readonly-seed/controls/"
echo "[build] Staged:"
ls "${SCRIPT_DIR}/target/readonly-seed/"

# ── Step 3: Docker build ───────────────────────────────────────────────────────
if [[ "${RUN_DOCKER}" == true ]]; then
    echo "[build] Building Docker image: ${IMAGE_TAG}..."
    docker build \
        -f "${SCRIPT_DIR}/src/main/docker/Dockerfile.readonly-static" \
        -t "${IMAGE_TAG}" \
        "${SCRIPT_DIR}"
    echo ""
    echo "[build] Done. Run the image with:"
    echo "  docker run --rm -p 8080:8080 ${IMAGE_TAG}"
fi
