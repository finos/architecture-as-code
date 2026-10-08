@echo off
REM Vytvori zastupce na plose a v nabidce Start (bez admin prav)
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-shortcut.ps1" -PackageRoot "%CD%"
echo.
echo Hotovo. Na plose a v nabidce Start je CalmStudio.
pause
