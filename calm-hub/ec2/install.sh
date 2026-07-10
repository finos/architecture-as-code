#!/usr/bin/env bash
#
# install - bootstrap a fresh Amazon Linux 2023 EC2 host and start CALM Hub.
#
# Installs Docker + the Compose v2 plugin, then brings up the stack defined in
# docker-compose.yml (calm-hub + watchtower). Safe to re-run: each step is
# idempotent.
#
# Usage: ./install.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ── Step 1: Docker engine ──────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  sudo yum update -y
  sudo yum install -y docker
else
  echo "==> Docker already installed"
fi

sudo systemctl enable --now docker

# Add the invoking user to the docker group so future sessions don't need sudo.
# (Does not take effect in this shell until re-login; install continues via sudo.)
if ! groups "$(whoami)" | grep -qw docker; then
  echo "==> Adding $(whoami) to the docker group (takes effect on next login)"
  sudo usermod -aG docker "$(whoami)"
fi

# ── Step 2: Docker Compose v2 plugin ───────────────────────────────────────
# Amazon Linux 2023's docker package ships the engine but not the compose
# plugin, so `docker compose` is unavailable until installed manually.
if ! sudo docker compose version >/dev/null 2>&1; then
  echo "==> Installing Docker Compose plugin"
  COMPOSE_VERSION="v2.32.4"
  ARCH="$(uname -m)"
  ASSET="docker-compose-linux-${ARCH}"
  RELEASE_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}"

  # Checksums vendored from the release's published .sha256 assets. Fetching
  # the checksum from the same host as the binary at install time only proves
  # the download wasn't corrupted; a vendored hash also detects a tampered
  # release. When bumping COMPOSE_VERSION, update both hashes from the new
  # release's .sha256 files.
  case "${ARCH}" in
    x86_64)  EXPECTED_SHA="ed1917fb54db184192ea9d0717bcd59e3662ea79db48bff36d3475516c480a6b" ;;
    aarch64) EXPECTED_SHA="0c4591cf3b1ed039adcd803dbbeddf757375fc08c11245b0154135f838495a2f" ;;
    *)
      echo "!! No vendored Docker Compose checksum for architecture '${ARCH}' — aborting" >&2
      exit 1
      ;;
  esac

  TMP_COMPOSE="$(mktemp)"
  curl -fsSL "${RELEASE_URL}/${ASSET}" -o "${TMP_COMPOSE}"

  # Verify against the vendored checksum before installing a root-owned
  # binary — protects against a corrupted or tampered download.
  ACTUAL_SHA="$(sha256sum "${TMP_COMPOSE}" | awk '{print $1}')"
  if [ "${EXPECTED_SHA}" != "${ACTUAL_SHA}" ]; then
    echo "!! Docker Compose checksum mismatch (expected ${EXPECTED_SHA}, got ${ACTUAL_SHA}) — aborting" >&2
    rm -f "${TMP_COMPOSE}"
    exit 1
  fi

  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo install -m 0755 "${TMP_COMPOSE}" /usr/local/lib/docker/cli-plugins/docker-compose
  rm -f "${TMP_COMPOSE}"
else
  echo "==> Docker Compose plugin already installed"
fi

# ── Step 3: Pull images first ───────────────────────────────────────────────
# Pull before touching any running container (see Step 4) so a failed/rate
# -limited pull leaves whatever was already running untouched instead of
# tearing it down and then having nothing to start.
echo "==> Pulling latest images"
sudo docker compose pull

# ── Step 4: Cut over from a manually-run calm-hub container ────────────────
# Hosts migrating from the old hand-run setup (`docker run --name calm-hub
# -p 80:8080 ...` via the previous restart.sh) already have a container named
# "calm-hub" holding port 80. That collides with the compose-managed container
# this script creates below (same name, same port). Remove it only if it has
# no compose-project label at all (i.e. it looks like the old hand-run
# container, not one already managed by some compose stack), so re-running
# install.sh is still a no-op once the migration is done.
if sudo docker inspect calm-hub >/dev/null 2>&1; then
  COMPOSE_PROJECT="$(sudo docker inspect calm-hub --format '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null || true)"
  if [ -z "${COMPOSE_PROJECT}" ]; then
    echo "==> Found a pre-existing manually-run 'calm-hub' container — removing it to make way for the compose-managed one"
    sudo docker rm -f calm-hub || true
  fi
fi

# ── Step 5: Start the stack ─────────────────────────────────────────────────
# sudo is required here even after usermod: the docker group membership added
# above isn't active in this shell until the user re-logs in. The image was
# already pulled in Step 3, so this doesn't need network access to come up.
echo "==> Starting calm-hub + watchtower"
sudo docker compose up -d

# ── Step 6: Health check ────────────────────────────────────────────────────
# The read-only-native image is distroless (no shell/curl inside the
# container), so readiness is probed from the host. calm-hub has no
# /q/health endpoint (smallrye-health isn't a dependency); /q/swagger-ui is
# always enabled and becomes available as soon as Quarkus finishes booting.
# --max-time caps each probe so one stalled connection can't blow past the
# overall ~15s budget.
echo "==> Waiting for CALM Hub to respond on port 80"
for i in $(seq 1 15); do
  if curl -sf --max-time 2 "http://localhost/q/swagger-ui" >/dev/null 2>&1; then
    echo "==> Up and responding after ${i}s"
    sudo docker compose ps
    exit 0
  fi
  sleep 1
done

echo "!! No response on port 80 after 15s. Recent logs:"
sudo docker compose logs --tail 30 calm-hub
exit 1
