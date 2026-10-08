#!/bin/bash
# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

PORT=17890
while [[ $# -gt 0 ]]; do
	case "$1" in
		--port)
			PORT="${2:?missing port}"
			shift 2
			;;
		*)
			echo "Neznámý argument: $1" >&2
			exit 1
			;;
	esac
done

PID_FILE="${HOME}/Library/Application Support/CalmStudio/server-${PORT}.pid"

if [[ -f "$PID_FILE" ]]; then
	PID_VALUE="$(tr -d '[:space:]' < "$PID_FILE" || true)"
	if [[ -n "$PID_VALUE" ]]; then
		kill "$PID_VALUE" 2>/dev/null || true
		echo "Ukončen proces PID $PID_VALUE"
	fi
	rm -f "$PID_FILE"
else
	echo "PID soubor nenalezen ($PID_FILE). Zkouším ukončit podle příkazové řádky…"
fi

pgrep -fl "serve-spa.py" | while read -r PID_VALUE _; do
	COMMAND="$(ps -p "$PID_VALUE" -o command= 2>/dev/null || true)"
	if [[ "$COMMAND" == *"serve-spa.py"* && "$COMMAND" == *"--port $PORT"* ]]; then
		kill "$PID_VALUE" 2>/dev/null || true
		echo "Ukončen serve-spa PID $PID_VALUE"
	fi
done || true

echo "Hotovo."
