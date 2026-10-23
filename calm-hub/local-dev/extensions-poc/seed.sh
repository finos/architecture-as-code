#!/usr/bin/env bash
# Fills the demo database with the standard seed data. Run it one time, before start.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
STATE="$HERE/.generated"
JAR="$REPO/calm-hub/target/quarkus-app/quarkus-run.jar"
mkdir -p "$STATE/hub-data" "$STATE/logs"

[ -f "$JAR" ] || { echo "Build Hub first (see README.md)"; exit 1; }

# Seeding needs writes, so this run has no auth. It listens on loopback only.
java -Dquarkus.profile=standalone -Dquarkus.http.host=127.0.0.1 -Dquarkus.http.port=8090 \
    -Dcalm.hub.base-url=http://localhost:8090 \
    -Dcalm.standalone.data-directory="$STATE/hub-data" \
    -jar "$JAR" > "$STATE/logs/seed-hub.log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true' EXIT

curl -s -o /dev/null --retry 60 --retry-all-errors --retry-delay 1 http://localhost:8090/api/calm/auth/config
(cd "$REPO" && npm run calm-hub:copy-schemas > /dev/null)
(cd "$REPO/calm-hub" && bash nitrite/init-nitrite.sh -u http://localhost:8090)
