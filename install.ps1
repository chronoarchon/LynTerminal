# =============================================================================
# LynTerminal — Modern Business OS & Point of Sale Universal Windows Installer
# Official Repository: https://github.com/chronoarchon/LynTerminal
# One-Line Install:
#   irm https://raw.githubusercontent.com/chronoarchon/LynTerminal/main/install.ps1 | iex
# =============================================================================

[CmdletBinding()]
param(
    [switch]$Silent,
    [switch]$NoRun
)

$ErrorActionPreference = "Stop"

# Enforce TLS 1.2 and TLS 1.3
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

function Write-Banner {
    Write-Host ""
    Write-Host " ==============================================================" -ForegroundColor Cyan
    Write-Host "    __                 ______                   _             _ " -ForegroundColor White
    Write-Host "   / /  __  _ __  _   /_  __/__  ______ _  ___ (_)__  ___ _  / / " -ForegroundColor White
    Write-Host "  / /__/ / / / / / /   / / / -_)/ __/  ' \/ -_) / _ \/ _ `/ / /  " -ForegroundColor White
    Write-Host " /____/\_./_/_/_/_/   /_/  \__//_/ /_/_/_/\__/_/_//_/\_,_/ /_/   " -ForegroundColor White
    Write-Host ""
    Write-Host "          LynTerminal — Modern Business OS & Point of Sale     " -ForegroundColor Green
    Write-Host "                 Universal Windows Setup Engine                " -ForegroundColor Gray
    Write-Host " ==============================================================" -ForegroundColor Cyan
    Write-Host ""
}

Write-Banner

# 1. Architecture Check
$is64Bit = [Environment]::Is64BitOperatingSystem
if (-not $is64Bit) {
    Write-Host "[!] LynTerminal requires a 64-bit operating system (x86_64)." -ForegroundColor Red
    return
}

# 2. Check for WebView2 Runtime
$wv2Installed = $false
$wv2Keys = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
)
foreach ($k in $wv2Keys) {
    if (Test-Path $k) {
        $props = Get-ItemProperty -Path $k -ErrorAction SilentlyContinue
        if ($props.pv -and $props.location) {
            $exePath = Join-Path $props.location "$($props.pv)\msedgewebview2.exe"
            if (Test-Path $exePath) {
                # Only treat HKLM or valid per-user EdgeWebView (not orphaned/preview missing WOW6432Node on HKLM) as verified
                if ($k -like "HKLM:*" -or (Test-Path "HKCU:\Software\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}")) {
                    $wv2Installed = $true
                    break
                }
            }
        }
    }
}

if ($wv2Installed) {
    Write-Host "[+] Microsoft Edge WebView2 Runtime: Detected" -ForegroundColor Green
} else {
    Write-Host "[*] Installing Microsoft Edge WebView2 Runtime (required for LynTerminal)..." -ForegroundColor Yellow
    try {
        $wv2Installer = Join-Path ([System.IO.Path]::GetTempPath()) "MicrosoftEdgeWebview2Setup.exe"
        $wcWv = New-Object System.Net.WebClient
        $wcWv.DownloadFile("https://go.microsoft.com/fwlink/p/?LinkId=2124703", $wv2Installer)
        Start-Process -FilePath $wv2Installer -ArgumentList "/silent /install" -Wait
        Write-Host "[+] Microsoft Edge WebView2 Runtime installed." -ForegroundColor Green
    } catch {
        Write-Host "[!] Auto-install WebView2 notice: $_. Continuing to LynTerminal setup..." -ForegroundColor Yellow
    }
}

# 3. Determine Download URL (Latest GitHub Release Asset)
$repo = "chronoarchon/LynTerminal"
$defaultUrl = "https://github.com/chronoarchon/LynTerminal/releases/download/v1.7.0/lynterminal_1.7.0_x64-setup.exe"
$downloadUrl = $defaultUrl

Write-Host "[*] Checking latest release metadata from GitHub..." -ForegroundColor Gray
try {
    $releaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "LynTerminal-Installer" } -TimeoutSec 10
    $exeAsset = $releaseInfo.assets | Where-Object { $_.name -like "*x64-setup.exe" -or $_.name -like "*setup.exe" } | Select-Object -First 1
    if ($exeAsset -and $exeAsset.browser_download_url) {
        $downloadUrl = $exeAsset.browser_download_url
        Write-Host "[+] Found release asset: $($exeAsset.name)" -ForegroundColor Green
    }
} catch {
    Write-Host "[*] Using direct fallback release URL (v1.7.0)" -ForegroundColor Gray
}

# 4. Download Binary
$tempDir = [System.IO.Path]::GetTempPath()
$installerPath = Join-Path $tempDir "lynterminal_setup.exe"

Write-Host "[*] Downloading installer to temporary directory..." -ForegroundColor Cyan
Write-Host "    Target: $installerPath" -ForegroundColor DarkGray

try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "LynTerminal-Installer")
    $wc.DownloadFile($downloadUrl, $installerPath)
    $fileSize = (Get-Item $installerPath).Length
    $fileSizeMb = [math]::Round($fileSize / 1MB, 2)
    Write-Host "[+] Download complete: $fileSizeMb MB verified." -ForegroundColor Green
} catch {
    Write-Host "[!] Failed to download installer package: $_" -ForegroundColor Red
    Write-Host "[*] Please download manually from: https://github.com/$repo/releases" -ForegroundColor Yellow
    return
}

# 5. Execute Setup
Write-Host "[*] Launching installer package..." -ForegroundColor Cyan
if ($Silent) {
    Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
    Write-Host "[+] LynTerminal installed silently." -ForegroundColor Green
} else {
    Start-Process -FilePath $installerPath
    Write-Host "[+] Installation wizard started. Complete the on-screen steps." -ForegroundColor Green
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host " [OK] Setup launched! Welcome to LynTerminal Business OS.      " -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""
