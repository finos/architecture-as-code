@echo off
REM Spusti CalmStudio (bez admin prav)
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-CalmStudio.ps1" %*
