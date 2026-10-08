#!/bin/bash
# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

ROOT="${1:?missing package root}"
ROOT="$(cd "$ROOT" && pwd)"
APP="$ROOT/CalmStudio.app"
DESKTOP="${HOME}/Desktop"
APPLICATIONS="${HOME}/Applications"

mkdir -p "$DESKTOP" "$APPLICATIONS"
ln -sfn "$APP" "$DESKTOP/CalmStudio.app"
ln -sfn "$APP" "$APPLICATIONS/CalmStudio.app"

echo "Plocha: $DESKTOP/CalmStudio.app"
echo "Aplikace uživatele: $APPLICATIONS/CalmStudio.app"
