# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0

param(
	[Parameter(Mandatory = $true)][string]$Url
)

$ErrorActionPreference = 'Stop'

$edge = @(
	"${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
	"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$chrome = @(
	"$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
	"${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
	"$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$userData = Join-Path $env:LOCALAPPDATA 'CalmStudio\browser-profile'
New-Item -ItemType Directory -Force -Path $userData | Out-Null

if ($edge) {
	Start-Process -FilePath $edge -ArgumentList @(
		"--user-data-dir=$userData",
		"--app=$Url",
		'--new-window'
	)
	return
}

if ($chrome) {
	Start-Process -FilePath $chrome -ArgumentList @(
		"--user-data-dir=$userData",
		"--app=$Url",
		'--new-window'
	)
	return
}

# Fallback: výchozí prohlížeč
Start-Process $Url
