#!/bin/bash
# Build script for the calm-hub native (MongoDB-backed) Docker image.
#
# Produces the native equivalent of the standard JVM image (Dockerfile.jvm):
# a GraalVM Mandrel native binary that connects to MongoDB at runtime.  Unlike
# build-readonly-native-image.sh, NO data is seeded or baked in — the image is
# the running application only and expects an external MongoDB.
#
# Encapsulates the two steps required to produce the native image:
#   1. Maven native build — compiles calm-hub to a Linux native binary via
#                           GraalVM Mandrel.  Quarkus automatically pulls and runs
#                           the Mandrel builder container (quarkus.native.container-build).
#   2. Docker build       — builds the single-stage Dockerfile.native image.
#
# Requirements:
#   • Docker running (used by the Mandrel container in step 1 and docker build in step 2)
#   • Docker allocated ≥8 GB RAM (GraalVM native compile is memory-intensive)
#
# Usage (from any directory):
#   bash calm-hub/build-native-image.sh [OPTIONS] [IMAGE_TAG]
#
# Options:
#   --no-docker    Run step 1 only; skip the docker build step.
#   --no-maven     Skip the Maven native build (assumes target/*-runner already exists).
#   --help         Show this message.
#
# IMAGE_TAG:
#   Optional Docker tag for the output image (default: calm-hub:native).
#
# Examples:
#   bash calm-hub/build-native-image.sh
#   bash calm-hub/build-native-image.sh calm-hub:0.7.6-native
#   bash calm-hub/build-native-image.sh --no-maven   # reuse existing binary
#   bash calm-hub/build-native-image.sh --no-docker  # build binary only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="calm-hub:native"
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

# ── Step 1: Maven native build ────────────────────────────────────────────────
if [[ "${RUN_MAVEN}" == true ]]; then
    echo "[build] Building calm-hub native binary with Maven..."
    echo "[build] Quarkus will pull and run the Mandrel builder container automatically."
    echo "[build] This step may take 5–15 minutes and requires ≥8 GB Docker memory."
    cd "${SCRIPT_DIR}"
    "${REPO_ROOT}/mvnw" package \
        -Dnative \
        -Dquarkus.native.container-build=true \
        -DskipITs \
        -DskipTests \
        -Ddependency-check.skip=true
    cd "${REPO_ROOT}"
fi

# ── Step 2: Docker build ───────────────────────────────────────────────────────
# Single-stage build: the native binary produced in step 1 is copied into a
# minimal UBI9 runtime image.  See Dockerfile.native.
if [[ "${RUN_DOCKER}" == true ]]; then
    echo "[build] Building Docker image: ${IMAGE_TAG}..."
    docker build \
        -f "${SCRIPT_DIR}/src/main/docker/Dockerfile.native" \
        -t "${IMAGE_TAG}" \
        "${SCRIPT_DIR}"
    echo ""
    echo "[build] Done. Run the image with:"
    echo "  docker run --rm -p 8080:8080 \\"
    echo "    -e QUARKUS_MONGODB_CONNECTION_STRING=mongodb://mongodb:27017 \\"
    echo "    ${IMAGE_TAG}"
fi
