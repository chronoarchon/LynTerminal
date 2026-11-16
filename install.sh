#!/usr/bin/env bash
# =============================================================================
# LynTerminal — Modern Business OS & Point of Sale Universal Linux Installer
# Official Repository: https://github.com/chronoarchon/LynTerminal
# =============================================================================
set -e

REPO_RAW="https://raw.githubusercontent.com/chronoarchon/LynTerminal/main"
VERSION="1.5.0v"
ARCH="$(uname -m)"

# Terminal styling
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}"
echo "  _                 _____               _             _ "
echo " | |   _   _ _ __  |_   _|__ _ __ _ __ ___ (_)_ __   __ _| |"
echo " | |  | | | | '_ \   | |/ _ \ '__| '_ \` _ \| | '_ \ / _\` | |"
echo " | |__| |_| | | | |  | |  __/ |  | | | | | | | | | | (_| | |"
echo " |_____\__, |_| |_|  |_|\___|_|  |_| |_| |_|_|_| |_|\__,_|_|"
echo "       |___/  Modern Business OS v${VERSION}"
echo -e "${RESET}"

if [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}Error: LynTerminal provides precompiled desktop binaries for x86_64 Linux systems (detected: ${ARCH}).${RESET}"
    exit 1
fi

TEMP_DIR="$(mktemp -d -t lynterminal-install-XXXXXX)"
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo -e "${BLUE}==>${RESET} ${BOLD}Preparing LynTerminal installation...${RESET}"

# Determine whether running from local clone or remote curl
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
LOCAL_BIN="$SCRIPT_DIR/bin/lynterminal.gz"
LOCAL_RELEASE_BIN="$SCRIPT_DIR/src-tauri/target/release/lynterminal"

TARGET_BIN="$TEMP_DIR/lynterminal"

if [ -f "$LOCAL_RELEASE_BIN" ]; then
    echo -e "${GREEN}==>${RESET} Using freshly built local binary: $LOCAL_RELEASE_BIN"
    cp "$LOCAL_RELEASE_BIN" "$TARGET_BIN"
elif [ -f "$LOCAL_BIN" ]; then
    echo -e "${GREEN}==>${RESET} Decompressing local binary bundle: $LOCAL_BIN"
    gzip -dc "$LOCAL_BIN" > "$TARGET_BIN"
else
    echo -e "${BLUE}==>${RESET} Downloading standalone LynTerminal binary from GitHub..."
    curl -fSL "${REPO_RAW}/bin/lynterminal.gz" -o "$TEMP_DIR/lynterminal.gz"
    gzip -dc "$TEMP_DIR/lynterminal.gz" > "$TARGET_BIN"
fi

chmod +x "$TARGET_BIN"

# Check and resolve missing runtime libraries automatically
MISSING_LIBS=$(ldd "$TARGET_BIN" 2>&1 | grep "not found" || true)
if [ -n "$MISSING_LIBS" ]; then
    echo -e "${YELLOW}==>${RESET} Missing system runtime libraries detected. Installing dependencies automatically..."
    if command -v apt-get >/dev/null 2>&1; then
        echo -e "${BLUE}==>${RESET} Installing WebKit2GTK and GTK3 via apt-get..."
        if [ "$EUID" -eq 0 ]; then
            apt-get update && (apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0t64 2>/dev/null || apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0)
        elif command -v sudo >/dev/null 2>&1; then
            sudo apt-get update && (sudo apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0t64 2>/dev/null || sudo apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0)
        fi
    elif command -v dnf >/dev/null 2>&1; then
        echo -e "${BLUE}==>${RESET} Installing WebKit2GTK and GTK3 via dnf..."
        if [ "$EUID" -eq 0 ]; then
            dnf install -y webkit2gtk4.1 gtk3
        elif command -v sudo >/dev/null 2>&1; then
            sudo dnf install -y webkit2gtk4.1 gtk3
        fi
    elif command -v pacman >/dev/null 2>&1; then
        echo -e "${BLUE}==>${RESET} Installing WebKit2GTK and GTK3 via pacman..."
        if [ "$EUID" -eq 0 ]; then
            pacman -S --needed --noconfirm webkit2gtk-4.1 gtk3
        elif command -v sudo >/dev/null 2>&1; then
            sudo pacman -S --needed --noconfirm webkit2gtk-4.1 gtk3
        fi
    elif command -v zypper >/dev/null 2>&1; then
        echo -e "${BLUE}==>${RESET} Installing WebKit2GTK and GTK3 via zypper..."
        if [ "$EUID" -eq 0 ]; then
            zypper install -y webkit2gtk-4.1 gtk3
        elif command -v sudo >/dev/null 2>&1; then
            sudo zypper install -y webkit2gtk-4.1 gtk3
        fi
    fi
fi

# Check sudo access without blocking
USE_SUDO=false
if [ "$EUID" -eq 0 ]; then
    USE_SUDO=true
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    USE_SUDO=true
fi

# 1. Install executable binary
echo -e "${BLUE}==>${RESET} Deploying binary..."
mkdir -p "$HOME/.local/bin"
install -Dm755 "$TARGET_BIN" "$HOME/.local/bin/lynterminal"
# Remove legacy binary if exists
rm -f "$HOME/.local/bin/lyndesk" 2>/dev/null || true

if [ "$USE_SUDO" = true ]; then
    if [ "$EUID" -eq 0 ]; then
        install -Dm755 "$TARGET_BIN" /usr/local/bin/lynterminal 2>/dev/null || true
        rm -f /usr/local/bin/lyndesk /usr/bin/lyndesk 2>/dev/null || true
    else
        sudo install -Dm755 "$TARGET_BIN" /usr/local/bin/lynterminal 2>/dev/null || true
        sudo rm -f /usr/local/bin/lyndesk /usr/bin/lyndesk 2>/dev/null || true
    fi
fi

# 2. Fetch/Prepare Desktop Launcher
DESKTOP_SRC="$TEMP_DIR/lynterminal.desktop"
if [ -f "$SCRIPT_DIR/public/lynterminal.desktop" ]; then
    cp "$SCRIPT_DIR/public/lynterminal.desktop" "$DESKTOP_SRC"
else
    curl -fsSL "${REPO_RAW}/public/lynterminal.desktop" -o "$DESKTOP_SRC"
fi

echo -e "${BLUE}==>${RESET} Registering desktop application entry..."
mkdir -p "$HOME/.local/share/applications"

# For user installations, point Exec and Icon to explicit absolute paths to avoid conflicts with old system packages
sed -e "s|^Icon=.*|Icon=$HOME/.local/share/icons/hicolor/512x512/apps/lynterminal.png|" \
    -e "s|^Exec=.*|Exec=$HOME/.local/bin/lynterminal|" "$DESKTOP_SRC" > "$HOME/.local/share/applications/lynterminal.desktop"
chmod 644 "$HOME/.local/share/applications/lynterminal.desktop"
rm -f "$HOME/.local/share/applications/lyndesk.desktop" 2>/dev/null || true

if [ "$USE_SUDO" = true ]; then
    if [ "$EUID" -eq 0 ]; then
        install -Dm644 "$DESKTOP_SRC" /usr/share/applications/lynterminal.desktop 2>/dev/null || true
        rm -f /usr/share/applications/lyndesk.desktop 2>/dev/null || true
    else
        sudo install -Dm644 "$DESKTOP_SRC" /usr/share/applications/lynterminal.desktop 2>/dev/null || true
        sudo rm -f /usr/share/applications/lyndesk.desktop 2>/dev/null || true
    fi
fi

# 3. Install High-Resolution Icons Across All Standard Linux Dimensions
echo -e "${BLUE}==>${RESET} Installing high-resolution desktop icons (16px to 512px + SVG)..."
SIZES=("16x16" "32x32" "48x48" "64x64" "128x128" "256x256" "512x512")

for size in "${SIZES[@]}"; do
    ICON_FILE="$TEMP_DIR/$size.png"
    if [ -f "$SCRIPT_DIR/public/icons/$size.png" ]; then
        cp "$SCRIPT_DIR/public/icons/$size.png" "$ICON_FILE"
    else
        curl -fsSL "${REPO_RAW}/public/icons/$size.png" -o "$ICON_FILE" 2>/dev/null || true
    fi

    if [ -f "$ICON_FILE" ]; then
        mkdir -p "$HOME/.local/share/icons/hicolor/$size/apps"
        install -Dm644 "$ICON_FILE" "$HOME/.local/share/icons/hicolor/$size/apps/lynterminal.png"
        rm -f "$HOME/.local/share/icons/hicolor/$size/apps/lyndesk.png" 2>/dev/null || true
        if [ "$USE_SUDO" = true ]; then
            if [ "$EUID" -eq 0 ]; then
                install -Dm644 "$ICON_FILE" "/usr/share/icons/hicolor/$size/apps/lynterminal.png" 2>/dev/null || true
                rm -f "/usr/share/icons/hicolor/$size/apps/lyndesk.png" 2>/dev/null || true
            else
                sudo install -Dm644 "$ICON_FILE" "/usr/share/icons/hicolor/$size/apps/lynterminal.png" 2>/dev/null || true
                sudo rm -f "/usr/share/icons/hicolor/$size/apps/lyndesk.png" 2>/dev/null || true
            fi
        fi
    fi
done

# Scalable SVG Icon (Essential for modern GNOME, COSMIC, KDE, and Wayland desktops)
SVG_ICON="$TEMP_DIR/lynterminal.svg"
if [ -f "$SCRIPT_DIR/public/icons/lynterminal.svg" ]; then
    cp "$SCRIPT_DIR/public/icons/lynterminal.svg" "$SVG_ICON"
else
    curl -fsSL "${REPO_RAW}/public/icons/lynterminal.svg" -o "$SVG_ICON" 2>/dev/null || true
fi

if [ -f "$SVG_ICON" ]; then
    mkdir -p "$HOME/.local/share/icons/hicolor/scalable/apps"
    mkdir -p "$HOME/.local/share/pixmaps"
    install -Dm644 "$SVG_ICON" "$HOME/.local/share/icons/hicolor/scalable/apps/lynterminal.svg"
    install -Dm644 "$SVG_ICON" "$HOME/.local/share/pixmaps/lynterminal.svg"
    rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/lyndesk.svg" "$HOME/.local/share/pixmaps/lyndesk.svg" 2>/dev/null || true
    if [ -f "$TEMP_DIR/256x256.png" ]; then
        install -Dm644 "$TEMP_DIR/256x256.png" "$HOME/.local/share/pixmaps/lynterminal.png"
    fi

    if [ "$USE_SUDO" = true ]; then
        if [ "$EUID" -eq 0 ]; then
            install -Dm644 "$SVG_ICON" "/usr/share/icons/hicolor/scalable/apps/lynterminal.svg" 2>/dev/null || true
            install -Dm644 "$SVG_ICON" "/usr/share/pixmaps/lynterminal.svg" 2>/dev/null || true
            install -Dm644 "$TEMP_DIR/256x256.png" "/usr/share/pixmaps/lynterminal.png" 2>/dev/null || true
            rm -f "/usr/share/icons/hicolor/scalable/apps/lyndesk.svg" "/usr/share/pixmaps/lyndesk.svg" "/usr/share/pixmaps/lyndesk.png" 2>/dev/null || true
        else
            sudo install -Dm644 "$SVG_ICON" "/usr/share/icons/hicolor/scalable/apps/lynterminal.svg" 2>/dev/null || true
            sudo install -Dm644 "$SVG_ICON" "/usr/share/pixmaps/lynterminal.svg" 2>/dev/null || true
            sudo install -Dm644 "$TEMP_DIR/256x256.png" "/usr/share/pixmaps/lynterminal.png" 2>/dev/null || true
            sudo rm -f "/usr/share/icons/hicolor/scalable/apps/lyndesk.svg" "/usr/share/pixmaps/lyndesk.svg" "/usr/share/pixmaps/lyndesk.png" 2>/dev/null || true
        fi
    fi
fi

# 4. Clean Stale Icon Caches and Refresh Desktop Databases
echo -e "${BLUE}==>${RESET} Rebuilding desktop launcher and icon cache..."

# Ensure hicolor theme index exists in user directory for gtk-update-icon-cache
if [ ! -f "$HOME/.local/share/icons/hicolor/index.theme" ]; then
    if [ -f "/usr/share/icons/hicolor/index.theme" ]; then
        cp "/usr/share/icons/hicolor/index.theme" "$HOME/.local/share/icons/hicolor/index.theme" 2>/dev/null || true
    fi
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
    if [ "$USE_SUDO" = true ]; then
        if [ "$EUID" -eq 0 ]; then
            gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
        else
            sudo gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
        fi
    fi
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    if [ "$USE_SUDO" = true ]; then
        if [ "$EUID" -eq 0 ]; then
            update-desktop-database /usr/share/applications 2>/dev/null || true
        else
            sudo update-desktop-database /usr/share/applications 2>/dev/null || true
        fi
    fi
fi

# Dynamically invalidate GNOME Shell icon texture cache so icons update without rebooting
if command -v gsettings >/dev/null 2>&1 && [ -n "$DBUS_SESSION_BUS_ADDRESS" ]; then
    CURRENT_ICON_THEME=$(gsettings get org.gnome.desktop.interface icon-theme 2>/dev/null | tr -d "'" || echo "")
    if [ -n "$CURRENT_ICON_THEME" ]; then
        gsettings set org.gnome.desktop.interface icon-theme 'HighContrast' 2>/dev/null || true
        sleep 0.2
        gsettings set org.gnome.desktop.interface icon-theme "$CURRENT_ICON_THEME" 2>/dev/null || true
    fi
fi

# 5. Deploy Uninstaller CLI
UNINSTALL_BIN="$TEMP_DIR/uninstall.sh"
if [ -f "$SCRIPT_DIR/uninstall.sh" ]; then
    cp "$SCRIPT_DIR/uninstall.sh" "$UNINSTALL_BIN"
else
    curl -fsSL "${REPO_RAW}/uninstall.sh" -o "$UNINSTALL_BIN" 2>/dev/null || true
fi

if [ -f "$UNINSTALL_BIN" ]; then
    install -Dm755 "$UNINSTALL_BIN" "$HOME/.local/bin/lynterminal-uninstall"
    ln -sf "$HOME/.local/bin/lynterminal-uninstall" "$HOME/.local/bin/lyndesk-uninstall" 2>/dev/null || true
    if [ "$USE_SUDO" = true ]; then
        if [ "$EUID" -eq 0 ]; then
            install -Dm755 "$UNINSTALL_BIN" /usr/local/bin/lynterminal-uninstall 2>/dev/null || true
            ln -sf /usr/local/bin/lynterminal-uninstall /usr/local/bin/lyndesk-uninstall 2>/dev/null || true
        else
            sudo install -Dm755 "$UNINSTALL_BIN" /usr/local/bin/lynterminal-uninstall 2>/dev/null || true
            sudo ln -sf /usr/local/bin/lynterminal-uninstall /usr/local/bin/lyndesk-uninstall 2>/dev/null || true
        fi
    fi
fi

echo ""
echo -e "${GREEN}${BOLD}✓ LynTerminal v${VERSION} has been successfully installed on your system!${RESET}"
echo ""
echo -e "You can launch LynTerminal anytime by:"
echo -e "  1. Typing ${BOLD}${GREEN}lynterminal${RESET} in any terminal"
echo -e "  2. Clicking ${BOLD}LynTerminal${RESET} in your desktop application grid"
echo ""
echo -e "To uninstall anytime: ${BOLD}lynterminal-uninstall${RESET} (or add ${BOLD}--purge${RESET} to remove local database)"
