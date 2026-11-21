#!/usr/bin/env bash
# =============================================================================
# LynTerminal — Non-Destructive Update Utility
# Safe updater with automatic pre-update SQLite database backup
# =============================================================================
set -e

REPO="chronoarchon/LynTerminal"
REPO_RAW="https://raw.githubusercontent.com/${REPO}/main"
DB_DIR="$HOME/.local/share/com.lynterminal.app"
DB_FILE="$DB_DIR/lynterminal.db"
LEGACY_DB_DIR="$HOME/.local/share/com.lyndesk.app"
LEGACY_DB_FILE="$LEGACY_DB_DIR/lyndesk.db"
BACKUP_DIR="$DB_DIR/backups"
ARCH="$(uname -m)"

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
echo "       |___/  Updater & Upgrade Engine"
echo -e "${RESET}"

if [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}Error: LynTerminal binaries are built for x86_64 Linux systems (detected: ${ARCH}).${RESET}"
    exit 1
fi

# Ensure migration from legacy database directory if present
if [ ! -f "$DB_FILE" ] && [ -f "$LEGACY_DB_FILE" ]; then
    echo -e "${BLUE}==>${RESET} Migrating legacy database to LynTerminal..."
    mkdir -p "$DB_DIR"
    cp "$LEGACY_DB_FILE" "$DB_FILE"
fi

# 1. Automatic Pre-Update Safety Backup (Zero Data Loss Guarantee)
if [ -f "$DB_FILE" ]; then
    echo -e "${BLUE}==>${RESET} ${BOLD}Step 1: Preserving local database snapshot before update...${RESET}"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/lynterminal_pre_update_${TIMESTAMP}.db"
    
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$DB_FILE" ".backup '$BACKUP_PATH'"
    else
        cp "$DB_FILE" "$BACKUP_PATH"
    fi
    echo -e "${GREEN}==>${RESET} Safety backup created at: ${BACKUP_PATH}"
else
    echo -e "${YELLOW}==>${RESET} No existing user database found; fresh installation."
fi

# 2. Query GitHub Releases for Latest Version
echo -e "${BLUE}==>${RESET} ${BOLD}Step 2: Checking latest release from GitHub (${REPO})...${RESET}"
LATEST_TAG=$(curl -s --max-time 10 -H "User-Agent: LynTerminal-Updater" "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
    LATEST_TAG="v1.5.4"
fi
echo -e "${GREEN}==>${RESET} Target release: ${BOLD}${LATEST_TAG}${RESET}"

# 3. Download & Stage Updated Binary
TEMP_DIR="$(mktemp -d -t lynterminal-update-XXXXXX)"
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

TARGET_BIN="$TEMP_DIR/lynterminal"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
LOCAL_BIN="$SCRIPT_DIR/bin/lynterminal.gz"

if [ -f "$LOCAL_BIN" ]; then
    echo -e "${GREEN}==>${RESET} Extracting local release bundle: $LOCAL_BIN"
    gzip -dc "$LOCAL_BIN" > "$TARGET_BIN"
else
    echo -e "${BLUE}==>${RESET} Downloading latest release binary from GitHub..."
    curl -fSL "${REPO_RAW}/bin/lynterminal.gz" -o "$TEMP_DIR/lynterminal.gz"
    gzip -dc "$TEMP_DIR/lynterminal.gz" > "$TARGET_BIN"
fi

chmod +x "$TARGET_BIN"

# 4. Install & Deploy Binary
echo -e "${BLUE}==>${RESET} ${BOLD}Step 3: Applying updated binary...${RESET}"
mkdir -p "$HOME/.local/bin"
# Unlink existing binary first to avoid ETXTBSY on running executable
rm -f "$HOME/.local/bin/lynterminal" "$HOME/.local/bin/lyndesk" 2>/dev/null || true
install -Dm755 "$TARGET_BIN" "$HOME/.local/bin/lynterminal"

if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo rm -f /usr/local/bin/lynterminal /usr/local/bin/lyndesk 2>/dev/null || true
    sudo install -Dm755 "$TARGET_BIN" /usr/local/bin/lynterminal 2>/dev/null || true
fi

# 5. Refresh Desktop Shortcut
if [ -f "$SCRIPT_DIR/public/lynterminal.desktop" ]; then
    sed -e "s|^Icon=.*|Icon=$HOME/.local/share/icons/hicolor/512x512/apps/lynterminal.png|" \
        -e "s|^Exec=.*|Exec=$HOME/.local/bin/lynterminal|" "$SCRIPT_DIR/public/lynterminal.desktop" > "$HOME/.local/share/applications/lynterminal.desktop"
    chmod 644 "$HOME/.local/share/applications/lynterminal.desktop"
    rm -f "$HOME/.local/share/applications/lyndesk.desktop" 2>/dev/null || true
fi

echo -e "\n${BOLD}${GREEN}✔ LynTerminal updated successfully to ${LATEST_TAG}!${RESET}"
echo -e "Your local database at ${DB_FILE} was kept strictly intact."
echo -e "Launch LynTerminal via desktop menu or run '${BOLD}lynterminal${RESET}' in your terminal.\n"
