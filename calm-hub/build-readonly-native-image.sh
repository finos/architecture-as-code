#!/bin/bash
# Build script for the calm-hub read-only NATIVE Docker image.
#
# Encapsulates all three steps required to produce the native image:
#   1. Maven native build — compiles calm-hub to a Linux/amd64 native binary via
#                           GraalVM Mandrel.  Quarkus automatically pulls and runs
#                           the Mandrel builder container (quarkus.native.container-build).
#   2. Stage content      — copies calm/ schemas and controls/ into the Docker build
#                           context (target/readonly-seed/) which is gitignored.
#   3. Docker build       — builds the two-stage Dockerfile.readonly-native image.
#
# Requirements:
#   • Docker running (used by the Mandrel container in step 1 and docker build in step 3)
#   • Docker allocated ≥8 GB RAM (GraalVM native compile is memory-intensive)
#
# Usage (from any directory):
#   bash calm-hub/build-readonly-native-image.sh [OPTIONS] [IMAGE_TAG]
#
# Options:
#   --no-docker    Run steps 1 and 2 only; skip the docker build step.
#   --no-maven     Skip the Maven native build (assumes target/*-runner already exists).
#   --help         Show this message.
#
# IMAGE_TAG:
#   Optional Docker tag for the output image (default: calm-hub:read-only-native).
#
# Examples:
#   bash calm-hub/build-readonly-native-image.sh
#   bash calm-hub/build-readonly-native-image.sh calm-hub:0.7.6-read-only-native
#   bash calm-hub/build-readonly-native-image.sh --no-maven   # reuse existing binary
#   bash calm-hub/build-readonly-native-image.sh --no-docker  # build binary + stage only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="calm-hub:read-only-native"
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

# ── Step 1: Maven builds (JVM fast-jar + native binary) ───────────────────────
# Two artefacts are required by Dockerfile.readonly-native:
#   • target/quarkus-app/  — JVM fast-jar, used by the seed stage (seeding runs on
#                            the JVM because the native binary cannot WRITE NitriteDB).
#   • target/*-runner      — native binary, used by the final read-only stage.
# The native profile disables the jar (quarkus.package.jar.enabled=false), so the
# fast-jar must be produced by a separate, non-native build.  The native build runs
# WITHOUT `clean` so the quarkus-app from step 1a is preserved.
if [[ "${RUN_MAVEN}" == true ]]; then
    echo "[build] Building calm-hub JVM fast-jar (target/quarkus-app, for the seed stage)..."
    cd "${SCRIPT_DIR}"
    "${REPO_ROOT}/mvnw" package \
        -DskipITs \
        -DskipTests \
        -Ddependency-check.skip=true

    echo "[build] Building calm-hub native binary with Maven..."
    echo "[build] Quarkus will pull and run the Mandrel builder container automatically."
    echo "[build] This step may take 5–15 minutes and requires ≥8 GB Docker memory."
    "${REPO_ROOT}/mvnw" package \
        -Dnative \
        -Dquarkus.native.container-build=true \
        -DskipITs \
        -DskipTests \
        -Ddependency-check.skip=true
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
# Two-stage build: a JVM seed stage populates the NitriteDB (the native binary
# only supports the read path, so seeding is done with the JVM), and the final
# native stage bakes in the resulting database. See Dockerfile.readonly-native.
if [[ "${RUN_DOCKER}" == true ]]; then
    echo "[build] Building Docker image: ${IMAGE_TAG}..."
    docker build \
        -f "${SCRIPT_DIR}/src/main/docker/Dockerfile.readonly-native" \
        -t "${IMAGE_TAG}" \
        "${SCRIPT_DIR}"
    echo ""
    echo "[build] Done. Run the image with:"
    echo "  docker run --rm -p 8080:8080 ${IMAGE_TAG}"
fi
