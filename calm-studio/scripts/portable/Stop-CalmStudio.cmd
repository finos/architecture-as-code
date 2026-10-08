@echo off
REM Zastavi CalmStudio
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-CalmStudio.ps1" %*
pause
