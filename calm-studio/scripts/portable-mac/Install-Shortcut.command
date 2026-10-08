#!/bin/bash
# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0
# Vytvoří zástupce na ploše a ve složce Aplikace uživatele (bez admin práv).

set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [[ -L "$SOURCE" ]]; do
	DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
	SOURCE="$(readlink "$SOURCE")"
	[[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
ROOT="$(cd -P "$(dirname "$SOURCE")" && pwd)"

/bin/bash "$ROOT/scripts/install-shortcut.sh" "$ROOT"
echo
echo "Hotovo. Na ploše a v ~/Applications je CalmStudio."
echo "Stiskněte Enter…"
read -r _ || true
