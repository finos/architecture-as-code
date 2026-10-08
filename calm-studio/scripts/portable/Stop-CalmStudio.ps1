# SPDX-FileCopyrightText: 2026 CalmStudio Contributors
# SPDX-License-Identifier: Apache-2.0

param(
	[int]$Port = 17890
)

$ErrorActionPreference = 'SilentlyContinue'
$PidFile = Join-Path $env:LOCALAPPDATA "CalmStudio\server-$Port.pid"

if (Test-Path $PidFile) {
	$pidValue = Get-Content $PidFile
	if ($pidValue) {
		Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
		Write-Host "Ukončen proces PID $pidValue"
	}
	Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
} else {
	Write-Host "PID soubor nenalezen ($PidFile). Zkouším ukončit podle názvu okna…"
}

Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
	Where-Object { $_.CommandLine -like '*serve-spa.ps1*' -and $_.CommandLine -like "*Port $Port*" } |
	ForEach-Object {
		Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
		Write-Host "Ukončen serve-spa PID $($_.ProcessId)"
	}

Write-Host "Hotovo."
