# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Spustí CalmStudio lokálně bez admin práv.
#   .\Start-CalmStudio.ps1
#   .\Start-CalmStudio.ps1 -Port 18000
#   .\Start-CalmStudio.ps1 -NoBrowser
#

param(
	[int]$Port = 17890,
	[switch]$NoBrowser,
	[switch]$InstallShortcut
)

$ErrorActionPreference = 'Stop'
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
# When invoked as ...\CalmStudio-portable\Start-CalmStudio.ps1 the package root is this folder.
$PackageRoot = (Resolve-Path $PackageRoot).Path
if ((Split-Path -Leaf $PackageRoot) -eq 'scripts') {
	$PackageRoot = (Resolve-Path (Split-Path -Parent $PackageRoot)).Path
} else {
	# "%~dp0." from CMD may leave a trailing "\." — normalize
	$PackageRoot = $PackageRoot.TrimEnd('\', '.')
	$PackageRoot = (Resolve-Path $PackageRoot).Path
}

$AppRoot = Join-Path $PackageRoot 'app'
$ServeScript = Join-Path $PackageRoot 'scripts\serve-spa.ps1'
$PidFile = Join-Path $env:LOCALAPPDATA "CalmStudio\server-$Port.pid"
$Url = "http://127.0.0.1:$Port/"

if (-not (Test-Path (Join-Path $AppRoot 'index.html'))) {
	throw "Chybí app\index.html. Balíček je neúplný: $AppRoot"
}

New-Item -ItemType Directory -Force -Path (Split-Path $PidFile) | Out-Null

# Pokud už server běží, jen otevři okno
if (Test-Path $PidFile) {
	$existing = Get-Content $PidFile -ErrorAction SilentlyContinue
	if ($existing -and (Get-Process -Id $existing -ErrorAction SilentlyContinue)) {
		Write-Host "CalmStudio už běží (PID $existing) → $Url"
		if (-not $NoBrowser) {
			& (Join-Path $PackageRoot 'scripts\open-app-window.ps1') -Url $Url
		}
		if ($InstallShortcut) {
			& (Join-Path $PackageRoot 'scripts\install-shortcut.ps1') -PackageRoot $PackageRoot
		}
		return
	}
}

# Rychlá kontrola, zda port poslouchá
try {
	$tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue
	if ($tcp.TcpTestSucceeded) {
		Write-Host "Port $Port je obsazený. Zvolte jiný: .\Start-CalmStudio.ps1 -Port 18000"
		exit 1
	}
} catch {}

$serverArgs = @(
	'-NoProfile',
	'-ExecutionPolicy', 'Bypass',
	'-WindowStyle', 'Minimized',
	'-File', $ServeScript,
	'-Root', $AppRoot,
	'-Port', "$Port",
	'-PidFile', $PidFile
)
Start-Process -FilePath 'powershell.exe' -ArgumentList $serverArgs -WindowStyle Minimized | Out-Null

$deadline = (Get-Date).AddSeconds(20)
do {
	try {
		$r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
		if ($r.StatusCode -eq 200) { break }
	} catch {
		Start-Sleep -Milliseconds 400
	}
} while ((Get-Date) -lt $deadline)

try {
	$null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
} catch {
	throw "Server se nespustil na $Url. Podívejte se do minimalizovaného okna PowerShell."
}

Write-Host "CalmStudio běží na $Url"
Write-Host "Zastavení: .\Stop-CalmStudio.cmd"

if (-not $NoBrowser) {
	& (Join-Path $PackageRoot 'scripts\open-app-window.ps1') -Url $Url
}

if ($InstallShortcut) {
	& (Join-Path $PackageRoot 'scripts\install-shortcut.ps1') -PackageRoot $PackageRoot -Port $Port
}
