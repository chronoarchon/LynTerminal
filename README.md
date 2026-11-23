# LynTerminal

LynTerminal is an offline desktop business OS and point-of-sale (POS) terminal built for shops, retail counters, and wholesale businesses. It combines fast counter billing, inventory management, customer credit ledgers, and Indian GST tax invoicing in a single local application.

All data is stored locally in an embedded SQLite database on your computer. It requires no cloud connection, no recurring subscriptions, and sends zero telemetry.

Built with **Tauri v2**, **Rust**, **React 19**, and **SQLite (WAL mode)**.

---

## 📦 Installation

### 1-Line Universal Windows Installer (Windows 10 / 11)
Open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/chronoarchon/LynTerminal/main/install.ps1 | iex
```

Or download and double-click [`install.cmd`](install.cmd) from the repository.

---

### 1-Line Universal Linux Installer (Recommended)
Installs LynTerminal on any Linux distribution (Ubuntu, Debian, Fedora, Arch, Manjaro, openSUSE, etc.):

```bash
curl -fsSL https://lynterminal.wintershogun.tech/install.sh | bash
```

> **Fallback Mirrors:**
> ```bash
> # Global CDN Mirror
> curl -fsSL https://cdn.jsdelivr.net/gh/chronoarchon/LynTerminal@main/install.sh | bash
>
> # GitHub Direct Source
> curl -fsSL https://raw.githubusercontent.com/chronoarchon/LynTerminal/main/install.sh | bash
> ```

---

### Distribution Packages (v1.6.2)

| Distribution | Package | Direct Install Command |
| :--- | :--- | :--- |
| **Windows 10/11 Desktop (x64)** | [`lynterminal_1.6.2_x64-setup.exe`](https://github.com/chronoarchon/LynTerminal/releases/download/v1.6.2/lynterminal_1.6.2_x64-setup.exe) | Double-click installer or run `install.cmd` |
| **Ubuntu / Debian / Linux Mint** | [`lynterminal_1.6.2_amd64.deb`](https://github.com/chronoarchon/LynTerminal/releases/download/v1.6.2/lynterminal_1.6.2_amd64.deb) | `sudo apt install ./lynterminal_1.6.2_amd64.deb` |
| **Fedora / RHEL / openSUSE** | [`lynterminal-1.6.2-1.x86_64.rpm`](https://github.com/chronoarchon/LynTerminal/releases/download/v1.6.2/lynterminal-1.6.2-1.x86_64.rpm) | `sudo dnf install ./lynterminal-1.6.2-1.x86_64.rpm` |
| **Universal Linux Binary** | [`lynterminal.gz`](https://github.com/chronoarchon/LynTerminal/releases/download/v1.6.2/lynterminal.gz) | `gzip -dc lynterminal.gz > lynterminal && chmod +x lynterminal && ./lynterminal` |

---

### Local Installation (From Cloned Repo)
If you already have the repository on your machine:
```bash
./install.sh
```

---

### 🗑️ Uninstall Anytime

```bash
# 1-Line curl uninstaller:
curl -fsSL https://lynterminal.wintershogun.tech/uninstall.sh | bash

# To remove the application and purge all local databases:
curl -fsSL https://lynterminal.wintershogun.tech/uninstall.sh | bash -s -- --purge

# Or using the built-in system shortcut:
lynterminal-uninstall
# (or with data purge):
lynterminal-uninstall --purge
```

---

## Core Features

- **Fast POS Register**:
  - Quick barcode scanner support, product search, and hotkeys.
  - Cash tender calculator with instant change calculation.
  - Split tenders (Cash, Card, UPI, Bank Transfer).
  - Credit (Udhaar) sales with customer ledger linking.
  - Thermal slip (80mm) and standard A4 tax invoice formats.

- **Cash Drawer & Money Management**:
  - 1-click Contra Transfers (Cash to Bank, Bank to Cash).
  - Track drawer cash float, bank balances, and owner capital deposits.
  - Separate liquidity tracking for cash vs. bank payments.

- **Indian GST Billing (Rule 46 & 48)**:
  - Automatic tax calculation: Intra-state (CGST + SGST) and Inter-state (IGST).
  - Itemized HSN/SAC codes and GSTIN verification.
  - Multi-copy bill prints: Original for Recipient, Duplicate for Transporter, Triplicate for Supplier.
  - Statutory report generation for GSTR-1 and GSTR-3B.
  - XML voucher export for Statutory Accounting ERPs.

- **Customer & Supplier Ledgers (Parties)**:
  - Track receivables (Sundry Debtors) and payables (Sundry Creditors).
  - Bill-by-bill settlements with partial payment support.
  - Overdue aging breakdowns (0–30, 31–60, 61–90, 90+ days).

- **Inventory & Warehouse Tracking**:
  - Stock levels with godown/warehouse transfers.
  - Low stock alerts and automated purchase order drafts.
  - Printable shelf price tags with SKU barcodes.
  - Audit history for all stock movements.

- **Daily Reports & Shifts**:
  - Daybook for daily cash inflow and outflow.
  - End-of-shift Z-Report register reconciliation.
  - Real-time Profit & Loss (P&L) summary.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **F2** | Open POS Register |
| **F8** | Open GST Billing POS |
| **F1** | Open Accounting Hub |
| **F5** | Record Store Expense |
| **F6** | Customer Credit Ledger |
| **F9** | Invoices & Orders |
| **Ctrl + 1** | Dashboard |
| **Ctrl + 2** | Register |
| **Ctrl + 3** | Inventory |
| **Ctrl + 4** | Customers & Vendors |
| **Ctrl + 5** | Invoices |
| **Ctrl + 6** | Expenses |
| **Ctrl + 7** | Staff & Payroll |
| **Ctrl + 8** | Financial Reports |
| **Ctrl + 9** | Audit Log |
| **Ctrl + 0** | Settings |

---

## Building From Source

### Prerequisites
- **Rust**: 1.80+ (`rustup`)
- **Bun**: 1.2+ (or Node.js 20+)
- **Linux Packages**: `webkit2gtk-4.1`, `gtk3`, `base-devel`

### Build Steps
```bash
# Clone the repository
git clone https://github.com/chronoarchon/LynTerminal.git
cd LynTerminal

# Install dependencies
bun install

# Run in desktop development mode
bun run tauri dev

# Build release packages (.deb, .rpm)
bun run tauri build
```

Database files are stored locally at:
- **Linux**: `~/.local/share/com.lynterminal.app/lynterminal.db`
- **Windows**: `%APPDATA%\com.lynterminal.app\lynterminal.db`

---

## License

LynTerminal is licensed under the **LynTerminal Software License**:
- **Linux**: Free to use for personal, retail, and commercial business operations.
- **Windows**: Requires an official commercial license purchased from the author (`chronoarchon`).
- **Commercial Use & Redistribution**: You may not resell, sublicense, or distribute modified copies for commercial gain.
- **Contributions**: LynTerminal is maintained exclusively by `@chronoarchon`. External pull requests are not accepted.

See the [LICENSE](LICENSE) file for complete details.
