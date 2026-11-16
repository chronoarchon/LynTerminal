#!/usr/bin/env bash
# =============================================================================
# LynTerminal — Uninstaller Script
# =============================================================================
set -e

VERSION="1.3.1v"

BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}"
echo "  LynTerminal Uninstaller v${VERSION}"
echo -e "${RESET}"

# Terminate running instances
pkill -f "lynterminal" 2>/dev/null || true
pkill -f "lyndesk" 2>/dev/null || true

USE_SUDO=false
if [ "$EUID" -eq 0 ]; then
    USE_SUDO=true
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    USE_SUDO=true
fi

echo -e "${BLUE}==>${RESET} Removing application binaries..."
if [ "$USE_SUDO" = true ]; then
    if [ "$EUID" -eq 0 ]; then
        rm -f /usr/local/bin/lynterminal /usr/bin/lynterminal /usr/local/bin/lynterminal-uninstall /usr/local/bin/lyndesk /usr/bin/lyndesk /usr/local/bin/lyndesk-uninstall 2>/dev/null || true
    else
        sudo rm -f /usr/local/bin/lynterminal /usr/bin/lynterminal /usr/local/bin/lynterminal-uninstall /usr/local/bin/lyndesk /usr/bin/lyndesk /usr/local/bin/lyndesk-uninstall 2>/dev/null || true
    fi
fi
rm -f "$HOME/.local/bin/lynterminal" "$HOME/.local/bin/lynterminal-uninstall" "$HOME/.local/bin/lyndesk" "$HOME/.local/bin/lyndesk-uninstall"

echo -e "${BLUE}==>${RESET} Removing desktop application entries..."
if [ "$USE_SUDO" = true ]; then
    if [ "$EUID" -eq 0 ]; then
        rm -f /usr/share/applications/lynterminal.desktop /usr/share/applications/lyndesk.desktop 2>/dev/null || true
    else
        sudo rm -f /usr/share/applications/lynterminal.desktop /usr/share/applications/lyndesk.desktop 2>/dev/null || true
    fi
fi
rm -f "$HOME/.local/share/applications/lynterminal.desktop" "$HOME/.local/share/applications/lyndesk.desktop"

echo -e "${BLUE}==>${RESET} Cleaning application icons and pixmaps..."
SIZES=("16x16" "32x32" "48x48" "64x64" "128x128" "256x256" "512x512" "scalable")
for size in "${SIZES[@]}"; do
    if [ "$USE_SUDO" = true ]; then
        if [ "$EUID" -eq 0 ]; then
            rm -f "/usr/share/icons/hicolor/$size/apps/lynterminal.png" "/usr/share/icons/hicolor/$size/apps/lynterminal.svg" "/usr/share/icons/hicolor/$size/apps/lyndesk.png" "/usr/share/icons/hicolor/$size/apps/lyndesk.svg" 2>/dev/null || true
        else
            sudo rm -f "/usr/share/icons/hicolor/$size/apps/lynterminal.png" "/usr/share/icons/hicolor/$size/apps/lynterminal.svg" "/usr/share/icons/hicolor/$size/apps/lyndesk.png" "/usr/share/icons/hicolor/$size/apps/lyndesk.svg" 2>/dev/null || true
        fi
    fi
    rm -f "$HOME/.local/share/icons/hicolor/$size/apps/lynterminal.png" "$HOME/.local/share/icons/hicolor/$size/apps/lynterminal.svg" "$HOME/.local/share/icons/hicolor/$size/apps/lyndesk.png" "$HOME/.local/share/icons/hicolor/$size/apps/lyndesk.svg" 2>/dev/null || true
done

if [ "$USE_SUDO" = true ]; then
    if [ "$EUID" -eq 0 ]; then
        rm -f /usr/share/pixmaps/lynterminal.png /usr/share/pixmaps/lynterminal.svg /usr/share/pixmaps/lyndesk.png /usr/share/pixmaps/lyndesk.svg 2>/dev/null || true
    else
        sudo rm -f /usr/share/pixmaps/lynterminal.png /usr/share/pixmaps/lynterminal.svg /usr/share/pixmaps/lyndesk.png /usr/share/pixmaps/lyndesk.svg 2>/dev/null || true
    fi
fi
rm -f "$HOME/.local/share/pixmaps/lynterminal.png" "$HOME/.local/share/pixmaps/lynterminal.svg" "$HOME/.local/share/pixmaps/lyndesk.png" "$HOME/.local/share/pixmaps/lyndesk.svg" 2>/dev/null || true

# Purge any stale cache
rm -f "$HOME/.local/share/icons/hicolor/icon-theme.cache" 2>/dev/null || true

# Refresh caches
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    if [ "$USE_SUDO" = true ]; then
        if [ "$EUID" -eq 0 ]; then
            gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
        else
            sudo gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
        fi
    fi
    gtk-update-icon-cache -f "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    if [ "$USE_SUDO" = true ]; then
        if [ "$EUID" -eq 0 ]; then
            update-desktop-database /usr/share/applications 2>/dev/null || true
        else
            sudo update-desktop-database /usr/share/applications 2>/dev/null || true
        fi
    fi
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

# Optional database purge
PURGE_DATA=false
for arg in "$@"; do
    if [ "$arg" = "--purge" ] || [ "$arg" = "-p" ]; then
        PURGE_DATA=true
        break
    fi
done

if [ "$PURGE_DATA" = false ]; then
    if [ -t 0 ]; then
        read -p "Do you also want to remove local business database data (~/.local/share/com.lynterminal.app)? [y/N]: " choice
        case "$choice" in
            y|Y|yes|YES) PURGE_DATA=true ;;
            *) PURGE_DATA=false ;;
        esac
    fi
fi

if [ "$PURGE_DATA" = true ]; then
    echo -e "${YELLOW}==>${RESET} Purging local database and backups..."
    rm -rf "$HOME/.local/share/com.lynterminal.app"
    rm -rf "$HOME/.config/lynterminal"
    rm -rf "$HOME/.local/share/com.lyndesk.app"
    rm -rf "$HOME/.config/lyndesk"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ LynTerminal has been completely removed from your system.${RESET}"
