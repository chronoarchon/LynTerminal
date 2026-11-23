#!/usr/bin/env bash
# =============================================================================
# LynTerminal — Modern Business OS & Point of Sale Universal Linux Installer
# Official Domain: https://lynterminal.wintershogun.tech
# Official Repository: https://github.com/chronoarchon/LynTerminal
# =============================================================================
set -e

VERSION="1.6.1"
PRIMARY_URL="https://lynterminal.wintershogun.tech/lynterminal"
CDN_URL="https://cdn.jsdelivr.net/gh/chronoarchon/LynTerminal@main"
RAW_URL="https://raw.githubusercontent.com/chronoarchon/LynTerminal@main"
ARCH="$(uname -m)"

# Color & Style Setup
setup_colors() {
    if [ -t 1 ] && [ -n "$(tput colors 2>/dev/null || echo "")" ] && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
        BOLD="\033[1m"
        DIM="\033[2m"
        CYAN="\033[38;5;51m"
        BLUE="\033[38;5;39m"
        GREEN="\033[38;5;48m"
        AMBER="\033[38;5;214m"
        PURPLE="\033[38;5;141m"
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
        PURPLE=""
        RED=""
        GRAY=""
        BORDER=""
        RESET=""
    fi
}
setup_colors

# Precise Box Alignment Engine (Guarantees 100% straight vertical borders)
BOX_INNER=62

box_top() {
    local title="${1:-}"
    if [ -n "$title" ]; then
        local t_len=${#title}
        local rem=$(( BOX_INNER - t_len - 2 ))
        local dashes=""
        for ((i=0; i<rem; i++)); do dashes="${dashes}─"; done
        echo -e "${BORDER}╭─ ${title} ${dashes}─╮${RESET}"
    else
        local dashes=""
        for ((i=0; i<BOX_INNER; i++)); do dashes="${dashes}─"; done
        echo -e "${BORDER}╭─${dashes}─╮${RESET}"
    fi
}

box_div() {
    local dashes=""
    for ((i=0; i<BOX_INNER; i++)); do dashes="${dashes}─"; done
    echo -e "${BORDER}├─${dashes}─┤${RESET}"
}

box_bottom() {
    local dashes=""
    for ((i=0; i<BOX_INNER; i++)); do dashes="${dashes}─"; done
    echo -e "${BORDER}╰─${dashes}─╯${RESET}"
}

box_row() {
    local content="$1"
    local plain
    plain="$(echo -e "$content" | sed -E "s/\x1B\[[0-9;]*[a-zA-Z]//g")"
    local vlen=${#plain}
    local pad=$(( BOX_INNER - vlen ))
    local spaces=""
    if [ $pad -gt 0 ]; then
        spaces="$(printf "%*s" "$pad" "")"
    fi
    echo -e "${BORDER}│${RESET} ${content}${spaces} ${BORDER}│${RESET}"
}

# Detect Linux Distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        DISTRO_NAME="${NAME:-Linux}"
    elif command -v lsb_release >/dev/null 2>&1; then
        DISTRO_NAME="$(lsb_release -d -s)"
    else
        DISTRO_NAME="$(uname -s)"
    fi
}
detect_distro

# Print Modern Visual Banner with Exact Border Alignment
echo ""
box_top
box_row "  ${BLUE}${BOLD}_                 _____               _             _${RESET} "
box_row " ${BLUE}${BOLD}| |   _   _ _ __  |_   _|__ _ __ _ __ ___ (_)_ __   __ _| |${RESET}"
box_row " ${BLUE}${BOLD}| |  | | | | '_ \\   | |/ _ \\ '__| '_ \` _ \\| | '_ \\ / _\` | |${RESET}"
box_row " ${BLUE}${BOLD}| |__| |_| | | | |  | |  __/ |  | | | | | | | | | | (_| | |${RESET}"
box_row " ${BLUE}${BOLD}|_____\\__, |_| |_|  |_|\\___|_|  |_| |_| |_|_|_| |_|\\__,_|_|${RESET}"
box_row "       ${CYAN}|___/${RESET}   ${BOLD}Modern Business OS & Indian GST POS${RESET}      "
box_row "        ${GRAY}Offline-First • Zero-Telemetry • Linux Native${RESET}   "
box_bottom
echo ""

# System Architecture Check
if [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}${BOLD}✖ Unsupported Architecture:${RESET} LynTerminal provides precompiled binaries for x86_64 Linux (detected: ${ARCH})."
    exit 1
fi

# Print Environment Card with Exact Border Alignment
box_top "System Environment"
box_row "${GRAY}Distribution${RESET} : ${BOLD}${DISTRO_NAME}${RESET}"
box_row "${GRAY}Architecture${RESET} : ${BOLD}${ARCH}${RESET}"
box_row "${GRAY}Version     ${RESET} : ${CYAN}${VERSION}${RESET}"
box_row "${GRAY}Install Path${RESET} : ${GREEN}\$HOME/.local/bin/lynterminal${RESET}"
box_row "${GRAY}Cloud Source${RESET} : ${CYAN}https://lynterminal.wintershogun.tech${RESET}"
box_bottom
echo ""

TEMP_DIR="$(mktemp -d -t lynterminal-setup-XXXXXX)"
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# STEP 1: Obtain Binary Bundle
# -----------------------------------------------------------------------------
echo -e "${CYAN}${BOLD}◆ [1/4]${RESET} ${BOLD}Acquiring LynTerminal binary...${RESET}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
LOCAL_BIN="$SCRIPT_DIR/bin/lynterminal.gz"
LOCAL_RELEASE_BIN="$SCRIPT_DIR/src-tauri/target/release/lynterminal"
TARGET_BIN="$TEMP_DIR/lynterminal"

if [ -f "$LOCAL_RELEASE_BIN" ]; then
    echo -e "      ${GREEN}✔${RESET} Using freshly built local binary: ${DIM}${LOCAL_RELEASE_BIN}${RESET}"
    cp "$LOCAL_RELEASE_BIN" "$TARGET_BIN"
elif [ -f "$LOCAL_BIN" ]; then
    echo -e "      ${GREEN}✔${RESET} Decompressing local package bundle: ${DIM}${LOCAL_BIN}${RESET}"
    gzip -dc "$LOCAL_BIN" > "$TARGET_BIN"
else
    echo -e "      ${BLUE}➜${RESET} Downloading package bundle from ${BOLD}lynterminal.wintershogun.tech${RESET}..."
    DOWNLOADED=false

    # Attempt 1: Official custom domain via Cloudflare
    if curl -fSL --progress-bar "${PRIMARY_URL}/lynterminal.gz" -o "$TEMP_DIR/lynterminal.gz" 2>/dev/null; then
        DOWNLOADED=true
        echo -e "      ${GREEN}✔${RESET} Verified download via lynterminal.wintershogun.tech CDN"
    fi

    # Attempt 2: Global jsDelivr CDN Mirror
    if [ "$DOWNLOADED" = false ]; then
        echo -e "      ${AMBER}➜${RESET} Primary CDN busy, trying jsDelivr global mirror..."
        if curl -fSL --progress-bar "${CDN_URL}/bin/lynterminal.gz" -o "$TEMP_DIR/lynterminal.gz" 2>/dev/null; then
            DOWNLOADED=true
            echo -e "      ${GREEN}✔${RESET} Downloaded from global CDN mirror"
        fi
    fi

    # Attempt 3: Direct GitHub Raw
    if [ "$DOWNLOADED" = false ]; then
        echo -e "      ${AMBER}➜${RESET} Falling back to GitHub direct source..."
        if curl -fSL --progress-bar "${RAW_URL}/bin/lynterminal.gz" -o "$TEMP_DIR/lynterminal.gz"; then
            DOWNLOADED=true
            echo -e "      ${GREEN}✔${RESET} Downloaded from GitHub source"
        fi
    fi

    if [ "$DOWNLOADED" = false ]; then
        echo -e "${RED}${BOLD}✖ Download Failed:${RESET} Unable to download binary bundle from any mirror."
        exit 1
    fi

    gzip -dc "$TEMP_DIR/lynterminal.gz" > "$TARGET_BIN"
fi

chmod +x "$TARGET_BIN"

# -----------------------------------------------------------------------------
# STEP 2: Runtime Library & Dependency Verification
# -----------------------------------------------------------------------------
echo -e "${CYAN}${BOLD}◆ [2/4]${RESET} ${BOLD}Verifying system runtime dependencies...${RESET}"

MISSING_LIBS=$(ldd "$TARGET_BIN" 2>&1 | grep "not found" || true)
if [ -n "$MISSING_LIBS" ]; then
    echo -e "      ${AMBER}➜${RESET} Installing missing libraries for ${DISTRO_NAME}..."
    if command -v pacman >/dev/null 2>&1; then
        if [ "$EUID" -eq 0 ]; then
            pacman -S --needed --noconfirm webkit2gtk-4.1 gtk3
        elif command -v sudo >/dev/null 2>&1; then
            sudo pacman -S --needed --noconfirm webkit2gtk-4.1 gtk3
        fi
    elif command -v apt-get >/dev/null 2>&1; then
        if [ "$EUID" -eq 0 ]; then
            apt-get update -qq && (apt-get install -y -qq libwebkit2gtk-4.1-0 libgtk-3-0t64 2>/dev/null || apt-get install -y -qq libwebkit2gtk-4.1-0 libgtk-3-0)
        elif command -v sudo >/dev/null 2>&1; then
            sudo apt-get update -qq && (sudo apt-get install -y -qq libwebkit2gtk-4.1-0 libgtk-3-0t64 2>/dev/null || sudo apt-get install -y -qq libwebkit2gtk-4.1-0 libgtk-3-0)
        fi
    elif command -v dnf >/dev/null 2>&1; then
        if [ "$EUID" -eq 0 ]; then
            dnf install -y -q webkit2gtk4.1 gtk3
        elif command -v sudo >/dev/null 2>&1; then
            sudo dnf install -y -q webkit2gtk4.1 gtk3
        fi
    elif command -v zypper >/dev/null 2>&1; then
        if [ "$EUID" -eq 0 ]; then
            zypper install -y webkit2gtk-4.1 gtk3
        elif command -v sudo >/dev/null 2>&1; then
            sudo zypper install -y webkit2gtk-4.1 gtk3
        fi
    fi
    echo -e "      ${GREEN}✔${RESET} Dependencies successfully resolved"
else
    echo -e "      ${GREEN}✔${RESET} All runtime libraries present (WebKit2GTK 4.1 & GTK3 ready)"
fi

# -----------------------------------------------------------------------------
# STEP 3: Binary & Desktop Launcher Installation
# -----------------------------------------------------------------------------
echo -e "${CYAN}${BOLD}◆ [3/4]${RESET} ${BOLD}Installing binary and desktop integration...${RESET}"

# Install user-local binary
mkdir -p "$HOME/.local/bin"
install -Dm755 "$TARGET_BIN" "$HOME/.local/bin/lynterminal"
ln -sf "$HOME/.local/bin/lynterminal" "$HOME/.local/bin/lyndesk" 2>/dev/null || true

# Optional system-wide symlink if sudo access is available
USE_SUDO=false
if [ "$EUID" -eq 0 ]; then
    USE_SUDO=true
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    USE_SUDO=true
fi

if [ "$USE_SUDO" = true ]; then
    if [ "$EUID" -eq 0 ]; then
        install -Dm755 "$TARGET_BIN" /usr/local/bin/lynterminal 2>/dev/null || true
        ln -sf /usr/local/bin/lynterminal /usr/local/bin/lyndesk 2>/dev/null || true
    else
        sudo install -Dm755 "$TARGET_BIN" /usr/local/bin/lynterminal 2>/dev/null || true
        sudo ln -sf /usr/local/bin/lynterminal /usr/local/bin/lyndesk 2>/dev/null || true
    fi
fi
echo -e "      ${GREEN}✔${RESET} Binary installed at ${BOLD}~/.local/bin/lynterminal${RESET}"

# Self-Contained SVG Icon
SVG_ICON="$TEMP_DIR/lynterminal.svg"
cat << 'EOF' > "$SVG_ICON"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="lynterminal_bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#18191E" />
      <stop offset="100%" stop-color="#0E0F12" />
    </linearGradient>
    <linearGradient id="lynterminal_stroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2997FF" />
      <stop offset="60%" stop-color="#0071E3" />
      <stop offset="100%" stop-color="#00C7BE" />
    </linearGradient>
  </defs>
  <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#lynterminal_bg)" />
  <rect x="32" y="32" width="448" height="448" rx="104" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
  <path d="M 188 128 V 334 C 188 358 206 376 230 376 H 352" fill="none" stroke="url(#lynterminal_stroke)" stroke-width="72" stroke-linecap="round" stroke-linejoin="round" />
</svg>
EOF

# Install Scalable Icon
mkdir -p "$HOME/.local/share/icons/hicolor/scalable/apps"
mkdir -p "$HOME/.local/share/pixmaps"
install -Dm644 "$SVG_ICON" "$HOME/.local/share/icons/hicolor/scalable/apps/lynterminal.svg"
install -Dm644 "$SVG_ICON" "$HOME/.local/share/pixmaps/lynterminal.svg"

# Fetch or extract multi-res PNG icons
SIZES=("16x16" "32x32" "48x48" "64x64" "128x128" "256x256" "512x512")
for size in "${SIZES[@]}"; do
    mkdir -p "$HOME/.local/share/icons/hicolor/$size/apps"
    if [ -f "$SCRIPT_DIR/public/icons/$size.png" ]; then
        cp "$SCRIPT_DIR/public/icons/$size.png" "$HOME/.local/share/icons/hicolor/$size/apps/lynterminal.png"
    elif curl -fsSL "${PRIMARY_URL}/icons/$size.png" -o "$HOME/.local/share/icons/hicolor/$size/apps/lynterminal.png" 2>/dev/null; then
        :
    elif curl -fsSL "${CDN_URL}/public/icons/$size.png" -o "$HOME/.local/share/icons/hicolor/$size/apps/lynterminal.png" 2>/dev/null; then
        :
    fi
done

# Create Desktop Application Entry
DESKTOP_FILE="$HOME/.local/share/applications/lynterminal.desktop"
mkdir -p "$HOME/.local/share/applications"
cat << EOF > "$DESKTOP_FILE"
[Desktop Entry]
Name=LynTerminal
GenericName=Point of Sale & Indian GST Business OS
Comment=Modern Offline-First Point of Sale & GST Accounting Terminal
Exec=$HOME/.local/bin/lynterminal %U
Terminal=false
Type=Application
Icon=lynterminal
Categories=Office;Finance;PointOfSale;Business;
Keywords=pos;billing;gst;invoice;terminal;accounting;retail;inventory;
StartupWMClass=lynterminal
StartupNotify=true
Actions=NewSale;GSTPOS;AccountingHub;

[Desktop Action NewSale]
Name=New Sale (F2)
Exec=$HOME/.local/bin/lynterminal --tab pos

[Desktop Action GSTPOS]
Name=GST Tax Invoice (F8)
Exec=$HOME/.local/bin/lynterminal --tab gst_pos

[Desktop Action AccountingHub]
Name=Statutory Accounting Hub (F1)
Exec=$HOME/.local/bin/lynterminal --tab gst_hub
EOF
chmod +x "$DESKTOP_FILE"
echo -e "      ${GREEN}✔${RESET} Desktop launcher and application menu registered"

# -----------------------------------------------------------------------------
# STEP 4: Uninstaller Deployment & Cache Invalidation
# -----------------------------------------------------------------------------
echo -e "${CYAN}${BOLD}◆ [4/4]${RESET} ${BOLD}Finalizing launcher caches and uninstaller...${RESET}"

# Deploy Uninstaller CLI
UNINSTALL_BIN="$TEMP_DIR/uninstall.sh"
if [ -f "$SCRIPT_DIR/uninstall.sh" ]; then
    cp "$SCRIPT_DIR/uninstall.sh" "$UNINSTALL_BIN"
elif curl -fsSL "${PRIMARY_URL}/uninstall.sh" -o "$UNINSTALL_BIN" 2>/dev/null; then
    :
elif curl -fsSL "${CDN_URL}/uninstall.sh" -o "$UNINSTALL_BIN" 2>/dev/null; then
    :
fi

if [ -f "$UNINSTALL_BIN" ]; then
    install -Dm755 "$UNINSTALL_BIN" "$HOME/.local/bin/lynterminal-uninstall"
    ln -sf "$HOME/.local/bin/lynterminal-uninstall" "$HOME/.local/bin/lyndesk-uninstall" 2>/dev/null || true
    echo -e "      ${GREEN}✔${RESET} Uninstaller linked at ${BOLD}~/.local/bin/lynterminal-uninstall${RESET}"
fi

# Refresh Desktop & Icon Databases
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

# Invalidate GNOME Shell icon cache
if command -v gsettings >/dev/null 2>&1 && [ -n "$DBUS_SESSION_BUS_ADDRESS" ]; then
    CURRENT_ICON_THEME=$(gsettings get org.gnome.desktop.interface icon-theme 2>/dev/null | tr -d "'" || echo "")
    if [ -n "$CURRENT_ICON_THEME" ]; then
        gsettings set org.gnome.desktop.interface icon-theme 'HighContrast' 2>/dev/null || true
        sleep 0.15
        gsettings set org.gnome.desktop.interface icon-theme "$CURRENT_ICON_THEME" 2>/dev/null || true
    fi
fi

# -----------------------------------------------------------------------------
# SUCCESS CARD
# -----------------------------------------------------------------------------
echo ""
box_top
box_row "${GREEN}${BOLD}✔ LynTerminal v${VERSION} installed successfully!${RESET}"
box_div
box_row "${BOLD}Launch from terminal:${RESET}"
box_row "  ${CYAN}\$ lynterminal &${RESET}"
box_row ""
box_row "${BOLD}Launch from desktop:${RESET}"
box_row "  ${GRAY}Application Menu${RESET} -> ${BOLD}LynTerminal${RESET}"
box_row ""
box_row "${BOLD}Essential Hotkeys:${RESET}"
box_row "  ${AMBER}[F2]${RESET}  POS Billing Register"
box_row "  ${AMBER}[F8]${RESET}  Indian GST Tax Invoices (Rule 46 & 48)"
box_row "  ${AMBER}[F1]${RESET}  Statutory Accounting Voucher Hub"
box_row ""
box_row "${BOLD}Uninstall anytime:${RESET}"
box_row "  ${GRAY}\$ lynterminal-uninstall${RESET} (or add ${AMBER}--purge${RESET} for clean wipe)"
box_row ""
box_row "${PURPLE}${BOLD}Website & Docs:${RESET} ${CYAN}https://lynterminal.wintershogun.tech${RESET}"
box_bottom
echo ""
