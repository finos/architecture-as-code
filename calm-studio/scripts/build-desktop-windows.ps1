# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Build CalmStudio as a local Windows desktop app (Tauri).
# Run from Developer PowerShell / normal terminal (not required to be admin):
#   powershell -ExecutionPolicy Bypass -File calm-studio/scripts/build-desktop-windows.ps1
#
# Prerequisites: Rust (MSVC), Visual Studio 2022 Build Tools with C++ workload, Node 26.

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$StudioApp = Join-Path $RepoRoot 'calm-studio\apps\studio'
$VcVars = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat'
$Log = Join-Path $env:LOCALAPPDATA 'calmstudio-tauri-build.log'
$Target = Join-Path $env:LOCALAPPDATA 'calmstudio-tauri-target'

function Write-Log([string]$Message) {
	$line = "$(Get-Date -Format o) $Message"
	Add-Content -Path $Log -Value $line
	Write-Host $line
}

Write-Log "repo=$RepoRoot"
Write-Log "log=$Log"

if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
	throw 'rustc not found. Install Rustlang.Rust.MSVC via winget.'
}
if (-not (Test-Path $VcVars)) {
	throw "MSVC vcvars not found: $VcVars"
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Set-Location $RepoRoot

Write-Log 'Building npm workspaces (calm-models, calm-core)…'
npm run build --workspace=calm-models
npm run build --workspace=@calmstudio/calm-core

$env:CARGO_TARGET_DIR = $Target
Write-Log "CARGO_TARGET_DIR=$Target"

$inner = @"
call "$VcVars" || exit /b 1
cd /d "$StudioApp" || exit /b 1
set CARGO_TARGET_DIR=$Target
npm run tauri -- build
exit /b %ERRORLEVEL%
"@
$bat = Join-Path $env:TEMP 'calmstudio-tauri-build.bat'
Set-Content -Path $bat -Value $inner -Encoding ASCII
Write-Log "Running $bat"
cmd /c $bat
$code = $LASTEXITCODE
Write-Log "tauri build exit=$code"

$bundle = Join-Path $StudioApp 'src-tauri\target\release\bundle'
$altBundle = Join-Path $Target 'release\bundle'
Write-Log "bundle_default=$bundle exists=$(Test-Path $bundle)"
Write-Log "bundle_alt=$altBundle exists=$(Test-Path $altBundle)"
if (Test-Path $altBundle) {
	Get-ChildItem $altBundle -Recurse -Include *.msi,*.exe | ForEach-Object { Write-Log "artifact=$($_.FullName)" }
}
exit $code
