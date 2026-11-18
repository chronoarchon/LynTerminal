#!/usr/bin/env bash
# =============================================================================
# LynTerminal — Uninstaller Script
# Official Domain: https://wintershogun.tech
# Official Repository: https://github.com/chronoarchon/LynTerminal
# =============================================================================
set -e

VERSION="1.5.1v"

# Color & Style Setup
setup_colors() {
    if [ -t 1 ] && [ -n "$(tput colors 2>/dev/null || echo "")" ] && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
        BOLD="\033[1m"
        DIM="\033[2m"
        CYAN="\033[38;5;51m"
        BLUE="\033[38;5;39m"
        GREEN="\033[38;5;48m"
        AMBER="\033[38;5;214m"
        RED="\033[38;5;196m"
        GRAY="\033[38;5;244m"
        BORDER="\033[38;5;60m"
        RESET="\033[0m"
    else
        BOLD=""
        DIM=""
        CYAN=""
        BLUE=""
        GREEN=""
        AMBER=""
        RED=""
        GRAY=""
        BORDER=""
        RESET=""
    fi
}
setup_colors

echo ""
echo -e "${BORDER}╭────────────────────────────────────────────────────────────╮${RESET}"
echo -e "${BORDER}│${RESET}   ${AMBER}${BOLD}LynTerminal Uninstaller v${VERSION}${RESET}                       ${BORDER}│${RESET}"
echo -e "${BORDER}│${RESET}   ${GRAY}Clean removal of binaries, desktop entries & icons${RESET}       ${BORDER}│${RESET}"
echo -e "${BORDER}╰────────────────────────────────────────────────────────────╯${RESET}"
echo ""

# Parse arguments for purge mode
PURGE_DATA=false
for arg in "$@"; do
    if [ "$arg" = "--purge" ] || [ "$arg" = "-p" ]; then
        PURGE_DATA=true
        break
    fi
done

# Terminate running instances
echo -e "${CYAN}${BOLD}◆ [1/3]${RESET} ${BOLD}Closing active application processes...${RESET}"
pkill -f "lynterminal" 2>/dev/null || true
pkill -f "lyndesk" 2>/dev/null || true
echo -e "      ${GREEN}✔${RESET} Running processes stopped"

# Sudo detection for system directories
USE_SUDO=false
if [ "$EUID" -eq 0 ]; then
    USE_SUDO=true
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    USE_SUDO=true
fi

# Remove application binaries
echo -e "${CYAN}${BOLD}◆ [2/3]${RESET} ${BOLD}Removing application binaries and desktop launchers...${RESET}"
if [ "$USE_SUDO" = true ]; then
    if [ "$EUID" -eq 0 ]; then
        rm -f /usr/local/bin/lynterminal /usr/bin/lynterminal /usr/local/bin/lynterminal-uninstall /usr/local/bin/lyndesk /usr/bin/lyndesk /usr/local/bin/lyndesk-uninstall 2>/dev/null || true
        rm -f /usr/share/applications/lynterminal.desktop /usr/share/applications/lyndesk.desktop 2>/dev/null || true
    else
        sudo rm -f /usr/local/bin/lynterminal /usr/bin/lynterminal /usr/local/bin/lynterminal-uninstall /usr/local/bin/lyndesk /usr/bin/lyndesk /usr/local/bin/lyndesk-uninstall 2>/dev/null || true
        sudo rm -f /usr/share/applications/lynterminal.desktop /usr/share/applications/lyndesk.desktop 2>/dev/null || true
    fi
fi
rm -f "$HOME/.local/bin/lynterminal" "$HOME/.local/bin/lynterminal-uninstall" "$HOME/.local/bin/lyndesk" "$HOME/.local/bin/lyndesk-uninstall"
rm -f "$HOME/.local/share/applications/lynterminal.desktop" "$HOME/.local/share/applications/lyndesk.desktop"
echo -e "      ${GREEN}✔${RESET} Executables and .desktop entries removed"

# Cleaning icons & pixmaps
echo -e "${CYAN}${BOLD}◆ [3/3]${RESET} ${BOLD}Cleaning icon caches and pixmaps...${RESET}"
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

rm -f "$HOME/.local/share/pixmaps/lynterminal.png" "$HOME/.local/share/pixmaps/lynterminal.svg" "$HOME/.local/share/pixmaps/lyndesk.png" "$HOME/.local/share/pixmaps/lyndesk.svg" 2>/dev/null || true

# Refresh desktop & icon databases
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi
echo -e "      ${GREEN}✔${RESET} System desktop caches refreshed"

# Optional database purge
if [ "$PURGE_DATA" = false ]; then
    if [ -t 0 ]; then
        echo ""
        read -p "Do you also want to purge local business database data (~/.local/share/com.lynterminal.app)? [y/N]: " choice
        case "$choice" in
            y|Y|yes|YES) PURGE_DATA=true ;;
            *) PURGE_DATA=false ;;
        esac
    fi
fi

if [ "$PURGE_DATA" = true ]; then
    echo -e "      ${AMBER}➜${RESET} Purging local database and store configurations..."
    rm -rf "$HOME/.local/share/com.lynterminal.app"
    rm -rf "$HOME/.config/lynterminal"
    rm -rf "$HOME/.local/share/com.lyndesk.app"
    rm -rf "$HOME/.config/lyndesk"
    echo -e "      ${GREEN}✔${RESET} All local store databases successfully wiped"
fi

echo ""
echo -e "${BORDER}╭────────────────────────────────────────────────────────────╮${RESET}"
echo -e "${BORDER}│${RESET}  ${GREEN}${BOLD}✔ LynTerminal has been uninstalled.${RESET}                       ${BORDER}│${RESET}"
echo -e "${BORDER}├────────────────────────────────────────────────────────────┤${RESET}"
echo -e "${BORDER}│${RESET}  To reinstall anytime:                                     ${BORDER}│${RESET}"
echo -e "${BORDER}│${RESET}    ${CYAN}curl -fsSL https://wintershogun.tech/install.sh | bash${RESET}  ${BORDER}│${RESET}"
echo -e "${BORDER}╰────────────────────────────────────────────────────────────╯${RESET}"
echo ""
