# LynTerminal — Modern Business Operating System & Indian GST Accounting Terminal

<div align="center">

![LynTerminal Version](https://img.shields.io/badge/version-1.5.1v-0071E3?style=for-the-badge&logo=linux&logoColor=white)
![Architecture](https://img.shields.io/badge/arch-x86__64-34C759?style=for-the-badge)
![Security](https://img.shields.io/badge/security-100%25%20Offline%20%7C%20Zero%20Telemetry-1D1D1F?style=for-the-badge)
![License](https://img.shields.io/badge/license-Commercial-86868B?style=for-the-badge)

<p align="center">
  <strong>Fast, Minimalist, 100% Offline-First, Zero-Telemetry Business OS & Indian GST Accounting Terminal for Retail Stores, Boutiques, Showrooms, Warehouses & Modern Enterprises.</strong>
</p>

</div>

Built with **Tauri v2**, **Rust**, **SQLite (WAL Mode)**, **React 19**, and **Tailwind CSS v4** — inspired by Apple's Human Interface Guidelines and Tally Prime commercial accounting standards.

---

## 📦 Official Release Downloads & Quick Installation (v1.5.1v)

| Platform / Distribution | Package Format | Direct Installation Command |
| :--- | :--- | :--- |
| **Universal Linux (Any Distro)** | **Standalone Binary Bundle** | `curl -fsSL https://raw.githubusercontent.com/chronoarchon/LynTerminal/main/install.sh \| bash` |
| **Arch Linux / Manjaro / EndeavourOS** | [**`lynterminal-1.5.1v-1-x86_64.pkg.tar.zst`**](release/lynterminal-1.5.1v-1-x86_64.pkg.tar.zst) | `sudo pacman -U release/lynterminal-1.5.1v-1-x86_64.pkg.tar.zst` |
| **Debian / Ubuntu / Linux Mint** | [**`lynterminal_1.5.1_amd64.deb`**](release/lynterminal_1.5.1_amd64.deb) | `sudo apt install ./release/lynterminal_1.5.1_amd64.deb` |
| **Fedora / RHEL / openSUSE** | [**`lynterminal-1.5.1-1.x86_64.rpm`**](release/lynterminal-1.5.1-1.x86_64.rpm) | `sudo dnf install ./release/lynterminal-1.5.1-1.x86_64.rpm` |

---

### 1. Instant 1-Line Universal Installer (Recommended)
Works seamlessly on any Linux distribution without manual dependencies:

```bash
curl -fsSL https://raw.githubusercontent.com/chronoarchon/LynTerminal/main/install.sh | bash
```

### 2. Manual Distribution Package Installation (Automatic Dependencies)

Modern package managers (`apt`, `dnf`, `pacman`) automatically resolve, download, and install all required libraries (WebKit2GTK 4.1, GTK3) in a single step:

- **Arch Linux / Manjaro / EndeavourOS**:
  ```bash
  sudo pacman -U ./release/lynterminal-1.5.1v-1-x86_64.pkg.tar.zst
  ```
- **Debian / Ubuntu / Linux Mint**:
  ```bash
  sudo apt install ./release/lynterminal_1.5.1_amd64.deb
  ```
- **Fedora / RHEL / openSUSE**:
  ```bash
  sudo dnf install ./release/lynterminal-1.5.1-1.x86_64.rpm
  ```

### 🗑️ Uninstall Anytime

```bash
# Using installed command:
lynterminal-uninstall

# Or via 1-line curl:
curl -fsSL https://raw.githubusercontent.com/chronoarchon/LynTerminal/main/uninstall.sh | bash
```

To purge local databases alongside uninstallation: 
```bash
lynterminal-uninstall --purge
# or via curl:
curl -fsSL https://raw.githubusercontent.com/chronoarchon/LynTerminal/main/uninstall.sh | bash -s -- --purge
```

---

## 🌟 Philosophy & Core Principles

- **Human-Crafted & Grounded**: Commercial vocabulary tailored to real shopkeepers and store managers — zero corporate AI buzzwords. Register tickets, drawer floats, stock inward, debit notes, and Z-report shift closings.
- **Apple Luxury Minimalist Aesthetic**: Off-white `#F5F5F7` canvas, elevated white cards, hairline borders (`border-black/[0.07]`), SF Pro / Inter typography, tabular figures, and tactile interactive micro-transitions.
- **Native Handheld & Mobile Support**: Responsive across smartphones, tablets, and wide multi-monitor POS counters. Includes an iOS-style bottom TabBar, quick checkout ticket sheet, and built-in Desktop/Tablet/Mobile preview simulator.
- **Zero Telemetry & 100% Offline**: No remote servers, cloud sync delays, or third-party analytics trackers. Every sales receipt, customer balance, and payroll voucher is stored locally on your SSD.
- **Embedded SQLite in WAL Mode**: Concurrency-safe SQLite engine operating in Write-Ahead Logging mode for instant ACID transactions with zero database lock contention.
- **Multi-Jurisdiction Ready**: Built-in tax presets (US State Sales Tax, EU/UK VAT, Japan JCT, India GST, or Custom Tax) and multi-currency selector with safe catalog preservation.

---

## ⚡ What's New in v1.5.1 (v1.5.1v)

- **OKLab/OKLCh PDF Rendering**: Integrated `html2canvas-pro` across regular invoices and GST POS tax modals, resolving CSS modern color function parsing errors and delivering pristine PDF downloads.
- **Rule 48 CGST Multi-Copy Bill Prints**: Full statutory multi-copy printing support (Original for Recipient, Duplicate for Transporter, Triplicate for Supplier) with real-time copy selection and document badges.
- **POS & GST POS Responsive Layout Pinning**: Pinned the register checkout button to the bottom while providing scrollable payment controls and totals, eliminating button clipping when credit and partial-pay options are toggled.
- **Compact Uniform Credit Tender**: Streamlined payment tender button to "Credit" with a compact `min-w-[70px]` footprint uniform with cash, card, and custom tenders.
- **Strict Cash & Bank Liquidity Routing**: Hardened liquidity engine to route cash payments to the cash drawer, digital/bank/card/UPI payments strictly to bank balances, and pure credit to 0 cash/bank liquidity.

---

## ⚡ What's New in v1.5.0 (v1.5.0v)

- **Custom Payment Methods**: Cash and Card are set as clean defaults, with up to 2 extra user-configurable payment methods in Settings (e.g., UPI, Google Pay, Alipay, PayPay, Bank Draft) appearing directly on POS checkout and settlement dialogs.
- **POS Credit & Udhaar Billing**: Native support for **100% Full Credit** and **Half Paid / Half Credit** billing at the register. POS automatically prompts for and enforces customer ledger linking.
- **1-Click Transaction Record Settlement**: Invoices view renders outstanding due balances and a dedicated **"Pay"** button directly beside **"Receipt"**. Settle bills in full or partial amounts with custom money entry, quick **100%** & **50%** buttons, and method selection (Cash, Card, Bank, Custom).
- **Executive Dashboard Credit Reminders & Dual Rankings**:
  - **Credit Reminder Alert**: Real-time counter of total debtor accounts and aggregate outstanding balance.
  - **Ranked by Credit Amount**: Debtor accounts ranked chronologically from largest credit balance to smallest (#1 to endless).
  - **Ranked by Age**: Unsettled invoices ordered from oldest to newest with age badges and instant in-place payment settlement.
- **Conditional Indian GST Engine**: Statutory GST features activate exclusively when **INR** currency is selected, backed by one-click toggle switches on both Dashboard and Settings for seamless switching between standard commercial and tax compliance billing.
- **Failsafe Step-by-Step Upgrades**: Beautifully formatted Markdown changelogs and millisecond-accurate SQLite safety backups preventing `VACUUM INTO` collisions with 4-step live progress feedback.

---

## 🇮🇳 Indian Commercial & Full GST Edition (Tally ERP Compatible)

LynTerminal v1.4.0v introduces a native statutory accounting engine designed for Indian retail, wholesale, and enterprise distribution:

- **Rule 46 CGST Act Compliant Invoices**: Generates legally binding GST Tax Invoices featuring itemized HSN/SAC codes, state of supply, Place of Supply (POS), E-Way Bill numbers, Vehicle numbers, and Reverse Charge Mechanism (RCM) tracking.
- **Automated Tax Splits**:
  - **Intra-State Supplies**: Automatically splits tax into **CGST (50%) + SGST (50%)** when Place of Supply matches the store's state.
  - **Inter-State Supplies**: Automatically applies **IGST (100%)** for interstate transactions.
- **Statutory Mod-36 Luhn GSTIN Validation**: Validates all 15-character party and vendor GSTINs against the official mathematical Mod-36 Luhn checksum algorithm with automatic State Code and PAN extraction.
- **Indian Numbering System Currency Words**: Automatically transcribes invoice totals into words following the Indian numbering system (*Rupees ... Lakhs ... Crores ... Paise Only*).
- **Tally ERP Gateway & Voucher Hotkeys**: Instant navigation using standard industry hotkeys:
  - **F1**: Gateway of LynTerminal Hub
  - **F2 / F8**: Standard POS & GST POS Invoicing
  - **F4**: Contra Voucher
  - **F5**: Payment Voucher
  - **F6**: Receipt / Customer Credit Settlement
  - **F9**: Purchase Voucher
- **Customer & Supplier Credit Management (Sundry Debtors & Creditors)**:
  - Bill-by-bill FIFO allocation and partial settlements.
  - Overdue aging analysis: **0–30 Days**, **31–60 Days**, **61–90 Days**, and **90+ Days**.
  - Dynamic credit limit verification warning prior to billing.
- **Statutory Return Filing & Audits**:
  - **GSTR-1**: Complete outward supplies preparation including **Table 4 (B2B)** grouped by recipient CTIN, **Table 5 (B2CL)** large interstate sales, **Table 7 (B2CS)** retail consumer sales, and **HSN Summary**. 1-click export to official **GSTN Portal JSON** and **CA Audit CSV**.
  - **GSTR-3B**: Monthly summary return showing outward taxable supplies, integrated tax, central tax, state tax, and eligible Input Tax Credit (ITC).

---

## 🚀 Commercial Modules

### 1. Point of Sale (Register)
- **High-Velocity Counter Checkout**: Instant product lookup by name, SKU, or hardware barcode scanner.
- **Interactive Handheld Mode**: Slide-up ticket sheet for mobile checkout on phones and tablets.
- **Cash Tender Calculator**: Quick cash denominations ($10, $20, $50, $100, Exact) with real-time change calculation.
- **Split Tenders**: Support for Cash, Card, Bank Wire, and Store Credit Ledger.
- **Dual Document Format**: Switch seamlessly between 80mm thermal receipt roll and standard A4 tax invoice printouts.
- **Keyboard Accelerators**: Press **F2** anytime to immediately focus the register search.

### 2. Inventory & Multi-Godown Storage
- **Catalog Management**: Real-time stock levels with category and warehouse/godown filters.
- **Godown Stock Transfers**: Shift inventory between primary warehouse storage and sales floor shelves with full audit trails.
- **Low-Stock Replenishment**: Automated purchase order generation for items reaching their reorder threshold.
- **Printable Shelf Price Tags**: Formatted price tag sheets with SKU, brand, and retail prices ready for shelf display.
- **Stock Movement Ledger**: Audit timeline tracking every incoming shipment, counter sale, return, and inventory adjustment.

### 3. Customer & Supplier Ledgers (Parties)
- **Unified Credit Accounting**: Separate customer receivables and vendor payables with running balances.
- **Aging Analysis**: 30-day, 60-day, 90-day, and 90+ day overdue credit aging buckets.
- **Payment Collection & Disbursement**: Record customer settlements or disburse vendor payments directly from cash float or bank reserves.
- **Account Statements**: Export and print detailed chronological account statements for any contact.

### 4. Sales, Invoices & Commercial Orders
- **Multi-Document Log**: Unified management for Sales Invoices, Purchase Orders, Price Quotations, and Debit Notes.
- **Quotations / Estimates**: Issue formal price estimates that convert into live sales tickets with one click.
- **Debit Note Returns**: Record vendor purchase returns for damaged or returned goods with automatic payable deduction.
- **Full Void & Return Flow**: Refund individual tickets back to stock with audit reasons.

### 5. Operating Expenses & Recurring Bills
- **Store Expenses Ledger**: Track store premise rent, utilities, packaging supplies, freight, and general overhead.
- **Monthly Scheduled Bills**: Schedule recurring rent and utility obligations with due-date tracking and status badges.
- **Direct Bill Settlement**: Pay monthly recurring bills directly from the cash register drawer or bank account.

### 6. Staff Roster & Payroll
- **Daily Attendance Check-In**: One-tap daily attendance marking (Present, Half-Day, Absent, On Leave).
- **Employee Directory**: Track roles, contact details, joining dates, and monthly base salaries.
- **Salary Disbursement**: Issue formal payroll vouchers with automatic bonus and deduction calculations.

### 7. Financial Reports & Shift Closing
- **Daily Cash Daybook**: Accounting journal of all cash inflows, outflows, and running drawer balances.
- **Profit & Loss Statement (P&L)**: Real-time calculation of Gross Sales, Cost of Goods Sold (COGS), Gross Profit %, Operating Expenses, and Net Operating Margin.
- **Catalog Stock Valuation**: Complete breakdown of units on hand, asset cost value, retail potential, and unrealized markup.
- **Z-Report Shift Closing**: End-of-day register reconciliation comparing opening float, cash sales, and counted drawer cash.

### 8. System Audit & Safety Snapshots
- **Tamper-Evident Audit Journal**: Automatic audit recording for every critical mutation.
- **Full Database Snapshots**: 1-click local backup and restore covering all 20 relational tables with foreign-key safety.
- **30-Day QA Simulation Engine**: Realistic retail data generator for immediate testing and accounting reconciliation.

---

## ⌨️ Keyboard Shortcuts

| Key | Destination |
| :--- | :--- |
| **F2** | Jump immediately to **Register (POS)** |
| **Ctrl + 1** | Switch to **Dashboard** |
| **Ctrl + 2** | Switch to **Register** |
| **Ctrl + 3** | Switch to **Inventory & Stock** |
| **Ctrl + 4** | Switch to **Contacts & Ledgers** |
| **Ctrl + 5** | Switch to **Sales & Orders** |
| **Ctrl + 6** | Switch to **Operating Expenses** |
| **Ctrl + 7** | Switch to **Staff & Payroll** |
| **Ctrl + 8** | Switch to **Reports & Daybook** |
| **Ctrl + 9** | Switch to **Audit Trail** |
| **Ctrl + 0** | Switch to **Store Settings** |

---

## 🛠️ Architecture & Tech Stack

```text
lynterminal/
├── src-tauri/                     # Rust Desktop Engine (Tauri v2)
│   ├── Cargo.toml                 # rusqlite (bundled SQLite), serde, chrono, uuid
│   ├── tauri.conf.json            # Desktop window configuration (min 360x540 for mobile testing)
│   └── src/
│       ├── main.rs                # Entry binary
│       ├── lib.rs                 # Tauri IPC command registry
│       ├── db.rs                  # Cross-platform SQLite path & migrations (WAL mode)
│       ├── models.rs              # Rust structs for all 20 business entities
│       └── commands.rs            # Concurrency-safe database handlers & business logic
├── src/                           # Frontend (React 19 + TypeScript + Tailwind CSS v4)
│   ├── components/
│   │   ├── Header.tsx             # Top navigation with device viewport switcher
│   │   ├── Sidebar.tsx            # macOS-style sidebar with keyboard shortcuts
│   │   ├── MobileNavBar.tsx       # iOS-style bottom TabBar and drawer sheet
│   │   ├── POSBilling.tsx         # Responsive register with mobile ticket sheet
│   │   ├── DashboardView.tsx      # Real-time balance sheet & working capital KPIs
│   │   ├── InventoryView.tsx      # Catalog, godown transfers, POs & shelf tags
│   │   ├── PartiesView.tsx        # Customer & vendor ledgers with credit aging
│   │   ├── InvoicesView.tsx       # Sales, quotations, debit notes & returns
│   │   ├── InvoiceDocModal.tsx    # Dual format preview (80mm thermal vs A4 tax invoice)
│   │   ├── ExpensesView.tsx       # Operating expenses & monthly recurring bills
│   │   ├── StaffView.tsx          # Employee roster, daily attendance & salary vouchers
│   │   ├── ReportsView.tsx        # Cash daybook, P&L, stock valuation & Z-reports
│   │   ├── AuditLogView.tsx       # Tamper-evident journal & 30-day simulator
│   │   └── SettingsView.tsx       # Store profile, tax presets, currency & backups
│   ├── services/
│   │   └── api.ts                 # Strongly-typed Tauri IPC client bridge
│   ├── types/
│   │   └── index.ts               # Complete TypeScript domain interfaces
│   ├── index.css                  # Apple design tokens, SF typography & print styles
│   ├── App.tsx                    # Shell layout with viewport simulator & hotkeys
│   └── main.tsx                   # React root entry
├── package.json
└── vite.config.ts
```

---

## 💻 Development & Build Instructions

### Prerequisites
- **Rust**: 1.80+ (`rustup`)
- **Bun**: 1.2+ (or Node 20+)
- **System packages (Linux)**: `webkit2gtk-4.1`, `base-devel`, `libayatana-appindicator`

### Quick Start
```bash
# Navigate to directory
cd ~/Projects/lynterminal

# Install dependencies
bun install

# Verify TypeScript and build frontend
bun run build

# Run in desktop development mode (with hot reload)
bun run tauri dev
```

### Production Build
```bash
# Build desktop package for Linux (deb / rpm)
bun run tauri build
```

The database is stored locally in SQLite WAL format:
- **Linux**: `~/.local/share/com.lynterminal.app/lynterminal.db`
- **macOS**: `~/Library/Application Support/com.lynterminal.app/lynterminal.db`
- **Windows**: `%APPDATA%\com.lynterminal.app\lynterminal.db`
