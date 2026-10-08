# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0

param(
	[Parameter(Mandatory = $true)][string]$PackageRoot,
	[int]$Port = 17890
)

$ErrorActionPreference = 'Stop'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'CalmStudio.lnk'
$startPs1 = Join-Path $PackageRoot 'Start-CalmStudio.ps1'
$icon = Join-Path $PackageRoot 'CalmStudio.ico'

$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut($lnkPath)
$s.TargetPath = 'powershell.exe'
$s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startPs1`" -Port $Port"
$s.WorkingDirectory = $PackageRoot
$s.WindowStyle = 7
$s.Description = 'CalmStudio (přenosná instalace)'
if (Test-Path $icon) { $s.IconLocation = "$icon,0" }
$s.Save()

# Zástupce i do nabídky Start (uživatelský profil — bez admin)
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
$startLnk = Join-Path $startMenu 'CalmStudio.lnk'
Copy-Item -Force $lnkPath $startLnk

Write-Host "Plocha: $lnkPath"
Write-Host "Nabídka Start: $startLnk"
