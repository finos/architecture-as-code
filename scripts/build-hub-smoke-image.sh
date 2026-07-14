#!/usr/bin/env bash
# Build the local calm-hub:smoke JVM image used by the CLI/CalmHub smoke tests.
# Mirrors the image built by .github/workflows/docker-publish-calm-hub.yml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/calm-hub"

echo "[build-hub-smoke-image] Packaging calm-hub with Maven..."
../mvnw clean package -Ddependency-check.skip=true

echo "[build-hub-smoke-image] Building Docker image calm-hub:smoke..."
docker build -f src/main/docker/Dockerfile.jvm -t calm-hub:smoke .

echo "[build-hub-smoke-image] Done. Image: calm-hub:smoke"
