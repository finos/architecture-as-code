#!/usr/bin/env bash
#
# redeploy - manually pull the latest image and recreate the calm-hub stack.
#
# Watchtower already does this automatically (see docker-compose.yml), so you
# shouldn't normally need this script. It's here for an on-demand redeploy —
# e.g. right after a release, or to force-apply a change to CALM_HUB_IMAGE in
# .env (a pin/rollback) without waiting for the next Watchtower poll.
#
# Usage: ./redeploy.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "==> Pulling latest images"
sudo docker compose pull

echo "==> Recreating stack"
sudo docker compose up -d

# Reclaim the image layers just superseded. Watchtower's own --cleanup only
# prunes images IT swaps; a manual redeploy needs its own cleanup or repeated
# runs accumulate dangling images indefinitely.
echo "==> Cleaning up dangling images"
sudo docker image prune -f >/dev/null

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
