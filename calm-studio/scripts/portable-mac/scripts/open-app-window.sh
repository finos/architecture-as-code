#!/bin/bash
# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

URL="${1:?missing url}"
PROFILE="${HOME}/Library/Application Support/CalmStudio/browser-profile"
mkdir -p "$PROFILE"

CANDIDATES=(
	"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
	"${HOME}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
	"${HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)

for bin in "${CANDIDATES[@]}"; do
	if [[ -x "$bin" ]]; then
		"$bin" --user-data-dir="$PROFILE" --app="$URL" --new-window >/dev/null 2>&1 &
		exit 0
	fi
done

open "$URL"
