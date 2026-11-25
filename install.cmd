@echo off
setlocal EnableDelayedExpansion

title LynTerminal Installer
color 0F

echo.
echo  ==============================================================
echo     __                 ______                   _             _ 
echo    / /  __  _ __  _   /_  __/__  ______ _  ___ (_)__  ___ _  / / 
echo   / /__/ / / / / / /   / / / -_)/ __/  ' \/ -_) / _ \/ _ `/ / /  
echo  /____/\_./_/_/_/_/   /_/  \__//_/ /_/_/_/\__/_/_//_/\_,_/ /_/   
echo.
echo           LynTerminal - Modern Business OS & Point of Sale
echo                    Universal Windows Installer
echo  ==============================================================
echo.

:: 1. Architecture Check
if "%PROCESSOR_ARCHITECTURE%" neq "AMD64" (
    if "%PROCESSOR_ARCHITEW6432%" neq "AMD64" (
        echo [ERROR] 32-bit Windows is not supported. LynTerminal requires 64-bit Windows.
        pause
        exit /b 1
    )
)

echo [*] Target Platform: Windows 64-bit (x86_64)
echo [*] Fetching latest release binary from GitHub Releases...

:: 2. Download Installer using PowerShell with TLS 1.2+
set "INSTALLER_URL=https://github.com/chronoarchon/LynTerminal/releases/download/v1.6.5/lynterminal_1.6.5_x64-setup.exe"
set "DEST_FILE=%TEMP%\lynterminal_1.6.5_setup.exe"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13; " ^
    "$wc = New-Object System.Net.WebClient; " ^
    "$wc.Headers.Add('User-Agent', 'LynTerminal-Installer'); " ^
    "Write-Host '[*] Downloading LynTerminal v1.6.5...'; " ^
    "$wc.DownloadFile('%INSTALLER_URL%', '%DEST_FILE%'); " ^
    "if (Test-Path '%DEST_FILE%') { Write-Host '[+] Download complete (' + (Get-Item '%DEST_FILE%').Length + ' bytes).' } else { exit 1 }"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to download installer package from GitHub.
    echo Please check your internet connection or download manually from:
    echo https://github.com/chronoarchon/LynTerminal/releases/latest
    echo.
    pause
    exit /b 1
)

:: 3. Launch the Installer
echo.
echo [*] Launching LynTerminal Setup Wizard...
start "" "%DEST_FILE%"

echo [+] Installation initialized successfully!
echo.
timeout /t 5 >nul
exit /b 0
