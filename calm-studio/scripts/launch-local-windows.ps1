# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Launch CalmStudio as a local desktop window (Edge app mode) against the
# Docker SPA on http://localhost:5173.
#
#   powershell -ExecutionPolicy Bypass -File calm-studio/scripts/launch-local-windows.ps1
#   powershell -ExecutionPolicy Bypass -File calm-studio/scripts/launch-local-windows.ps1 -InstallShortcut
#

param(
	[switch]$InstallShortcut,
	[string]$Url = 'http://localhost:5173'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ComposeFile = Join-Path $RepoRoot 'calm-studio\docker-compose.yml'

$edge = @(
	"${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
	"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edge) {
	throw 'Microsoft Edge not found. Install Edge or open $Url in a browser.'
}

function Ensure-StudioRunning {
	Push-Location $RepoRoot
	try {
		$status = docker compose -f $ComposeFile ps --status running --format '{{.Name}}' 2>$null
		if (-not $status) {
			Write-Host 'Starting Calm Studio Docker container…'
			docker compose -f $ComposeFile up -d --build
		}
	} finally {
		Pop-Location
	}

	$deadline = (Get-Date).AddSeconds(60)
	do {
		try {
			$r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
			if ($r.StatusCode -eq 200) { return }
		} catch {
			Start-Sleep -Seconds 2
		}
	} while ((Get-Date) -lt $deadline)
	throw "Calm Studio did not become ready at $Url"
}

function Install-DesktopShortcut {
	$desktop = [Environment]::GetFolderPath('Desktop')
	$lnkPath = Join-Path $desktop 'CalmStudio.lnk'
	$launchPs1 = Join-Path $PSScriptRoot 'launch-local-windows.ps1'
	$icon = Join-Path $RepoRoot 'calm-studio\apps\studio\src-tauri\icons\icon.ico'
	$w = New-Object -ComObject WScript.Shell
	$s = $w.CreateShortcut($lnkPath)
	$s.TargetPath = 'powershell.exe'
	$s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launchPs1`""
	$s.WorkingDirectory = $RepoRoot
	$s.WindowStyle = 7
	$s.Description = 'CalmStudio (local)'
	if (Test-Path $icon) { $s.IconLocation = "$icon,0" }
	$s.Save()
	Write-Host "Desktop shortcut: $lnkPath"
}

Ensure-StudioRunning

$userData = Join-Path $env:LOCALAPPDATA 'CalmStudio\edge-app-profile'
New-Item -ItemType Directory -Force -Path $userData | Out-Null

Start-Process -FilePath $edge -ArgumentList @(
	"--user-data-dir=$userData",
	"--app=$Url",
	'--new-window'
)

if ($InstallShortcut) {
	Install-DesktopShortcut
}
