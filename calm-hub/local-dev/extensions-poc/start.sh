#!/usr/bin/env bash
# Starts the extensions proof of concept. Ctrl-C stops all of it.
#   login proxy (nginx, :8088) -> Hub UI dev server (:5180) -> CALM Hub, proxy-auth (:8090) -> team-services (:8091)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
STATE="$HERE/.generated"
JAR="$REPO/calm-hub/target/quarkus-app/quarkus-run.jar"
mkdir -p "$STATE/hub-data" "$STATE/logs"

[ -f "$JAR" ] || { echo "Build Hub first (see README.md)"; exit 1; }
[ -f "$STATE/extension-identity.pem" ] || openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$STATE/extension-identity.pem" 2>/dev/null
if [ ! -f "$STATE/htpasswd" ]; then
    for user in alice bob zed; do printf '%s:%s\n' "$user" "$(openssl passwd -apr1 calm)" >> "$STATE/htpasswd"; done
fi

pids=()
cleanup() {
    kill "${pids[@]}" 2>/dev/null || true
    docker compose -f "$HERE/docker-compose.yml" down > /dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Hub trusts the Remote-User header, so it must listen on loopback only, behind the login proxy.
java -Dquarkus.profile=standalone,proxy-auth -Dquarkus.http.host=127.0.0.1 -Dquarkus.http.port=8090 \
    -Dcalm.hub.base-url=http://localhost:8090 \
    -Dcalm.standalone.data-directory="$STATE/hub-data" \
    -Dcalm.auth.allow-public-read=true \
    -Dcalm.ui.identity.enabled=true \
    -Dcalm.ui.environment.name=LOCAL \
    -Dcalm.extensions.dir="$HERE/extensions" \
    -Dcalm.extensions.identity.private-key-location="$STATE/extension-identity.pem" \
    -jar "$JAR" > "$STATE/logs/hub.log" 2>&1 &
pids+=($!)

node "$HERE/team-services/server.mjs" > "$STATE/logs/team-services.log" 2>&1 &
pids+=($!)

(cd "$REPO/calm-hub-ui" && npm run copy-public > /dev/null && CALM_HUB_URL=http://localhost:8090 exec npx vite --host 127.0.0.1 --port 5180 --strictPort) \
    > "$STATE/logs/vite.log" 2>&1 &
pids+=($!)

curl -s -o /dev/null --retry 90 --retry-all-errors --retry-delay 1 http://127.0.0.1:5180/
docker compose -f "$HERE/docker-compose.yml" up -d
curl -s -o /dev/null --retry 90 --retry-all-errors --retry-delay 1 -u alice:calm http://localhost:8088/api/calm/extensions
echo "Ready: open http://localhost:8088 and sign in as alice, bob or zed (password: calm). Logs are in $STATE/logs"
wait
