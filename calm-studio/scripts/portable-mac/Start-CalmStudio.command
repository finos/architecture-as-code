#!/bin/bash
# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Spustí CalmStudio lokálně bez admin práv.
#   ./Start-CalmStudio.command
#   ./Start-CalmStudio.command --port 18000
#   ./Start-CalmStudio.command --no-browser
#   ./Start-CalmStudio.command --install-shortcut

set -euo pipefail

PORT=17890
NO_BROWSER=0
INSTALL_SHORTCUT=0

while [[ $# -gt 0 ]]; do
	case "$1" in
		--port)
			PORT="${2:?missing port}"
			shift 2
			;;
		--no-browser) NO_BROWSER=1; shift ;;
		--install-shortcut) INSTALL_SHORTCUT=1; shift ;;
		*)
			echo "Neznámý argument: $1" >&2
			exit 1
			;;
	esac
done

SOURCE="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE" ]]; do
	DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
	SOURCE="$(readlink "$SOURCE")"
	[[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
ROOT="$(cd -P "$(dirname "$SOURCE")" && pwd)"

APP="$ROOT/app"
PY_SCRIPT="$ROOT/scripts/serve-spa.py"
OPEN_SCRIPT="$ROOT/scripts/open-app-window.sh"
SHORTCUT_SCRIPT="$ROOT/scripts/install-shortcut.sh"
SUPPORT="${HOME}/Library/Application Support/CalmStudio"
PID_FILE="$SUPPORT/server-${PORT}.pid"
LOG_FILE="$SUPPORT/server-${PORT}.log"
URL="http://127.0.0.1:${PORT}/"

hold() {
	echo "$1" >&2
	echo "Stiskněte Enter…" >&2
	read -r _ || true
	exit 1
}

if [[ ! -f "$APP/index.html" ]]; then
	hold "Chybí app/index.html. Balíček je neúplný: $APP"
fi

if ! command -v python3 >/dev/null 2>&1; then
	osascript -e 'display alert "CalmStudio" message "Chybí python3. Nainstalujte Command Line Tools (xcode-select --install) nebo Python 3 z python.org."' >/dev/null 2>&1 || true
	hold "Chybí python3. Nainstalujte Command Line Tools: xcode-select --install"
fi

mkdir -p "$SUPPORT"

if [[ -f "$PID_FILE" ]]; then
	EXISTING="$(tr -d '[:space:]' < "$PID_FILE" || true)"
	if [[ -n "$EXISTING" ]] && kill -0 "$EXISTING" 2>/dev/null; then
		echo "CalmStudio už běží (PID $EXISTING) → $URL"
		if [[ "$NO_BROWSER" -eq 0 ]]; then
			/bin/bash "$OPEN_SCRIPT" "$URL" || true
		fi
		if [[ "$INSTALL_SHORTCUT" -eq 1 ]]; then
			/bin/bash "$SHORTCUT_SCRIPT" "$ROOT"
		fi
		exit 0
	fi
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
	hold "Port $PORT je obsazený. Zvolte jiný: ./Start-CalmStudio.command --port 18000"
fi

nohup python3 "$PY_SCRIPT" --root "$APP" --port "$PORT" --pid-file "$PID_FILE" >>"$LOG_FILE" 2>&1 &

READY=0
for _ in $(seq 1 50); do
	if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
		READY=1
		break
	fi
	sleep 0.2
done

if [[ "$READY" -ne 1 ]]; then
	echo "Server se nespustil na $URL." >&2
	echo "Log: $LOG_FILE" >&2
	tail -n 40 "$LOG_FILE" >&2 || true
	hold "Zkontrolujte, že python3 umí standardní knihovnu http.server."
fi

echo "CalmStudio běží na $URL"
echo "Zastavení: ./Stop-CalmStudio.command"

if [[ "$NO_BROWSER" -eq 0 ]]; then
	/bin/bash "$OPEN_SCRIPT" "$URL" || true
fi

if [[ "$INSTALL_SHORTCUT" -eq 1 ]]; then
	/bin/bash "$SHORTCUT_SCRIPT" "$ROOT"
fi
