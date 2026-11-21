export const mockSettings = {
  id: 1,
  business_name: "LynTerminal Flagship Store",
  tagline: "Autonomous Retail & Specialty Cafe POS",
  address: "742 Commercial District, Suite 100",
  phone: "+1 (555) 234-5678",
  email: "counter@lynterminal.store",
  tax_id: "US-TAX-8829104",
  currency_symbol: "$",
  currency_code: "USD",
  tax_name: "Sales Tax",
  default_tax_rate: 8.5,
  invoice_prefix: "INV-2026-",
  enable_godowns: true,
  terms_and_conditions: "All sales final. Goods covered under 100% offline guarantee.",
  tax_mode: "EXCLUSIVE" as const,
  tax_preset: "CUSTOM" as const,
  preview_after_sale: false,
  auto_print: false,
  opening_cash: 500.0,
  opening_bank: 12000.0,
  capital_cash: 500.0,
  capital_bank: 12000.0,
  capital_mode: "SPLIT" as const,
  opening_balance_mode: "SPLIT" as const,
};

export const mockItems = [
  {
    id: "it-1",
    name: "Ethiopian Yirgacheffe Beans (500g)",
    sku: "COF-001",
    barcode: "8901001",
    category: "Specialty Coffee",
    unit: "pack",
    purchase_price: 11.5,
    sale_price: 22.0,
    stock_quantity: 48,
    min_stock_alert: 10,
    godown: "Front Display",
    created_at: "2026-11-01",
  },
  {
    id: "it-2",
    name: "Cold Brew Concentrate (1L)",
    sku: "COF-002",
    barcode: "8901002",
    category: "Specialty Coffee",
    unit: "bottle",
    purchase_price: 7.8,
    sale_price: 16.0,
    stock_quantity: 24,
    min_stock_alert: 8,
    godown: "Cold Storage",
    created_at: "2026-11-01",
  },
  {
    id: "it-3",
    name: "Ceremonial Grade Uji Matcha Jar",
    sku: "TEA-001",
    barcode: "8901003",
    category: "Artisan Tea",
    unit: "jar",
    purchase_price: 14.0,
    sale_price: 28.0,
    stock_quantity: 18,
    min_stock_alert: 5,
    godown: "Front Display",
    created_at: "2026-11-02",
  },
  {
    id: "it-4",
    name: "Artisan Almond Croissant",
    sku: "BAK-001",
    barcode: "8901004",
    category: "Bakery",
    unit: "pcs",
    purchase_price: 1.8,
    sale_price: 4.75,
    stock_quantity: 42,
    min_stock_alert: 12,
    godown: "Bakery Case",
    created_at: "2026-11-03",
  },
  {
    id: "it-5",
    name: "Sourdough Country Loaf",
    sku: "BAK-002",
    barcode: "8901005",
    category: "Bakery",
    unit: "loaf",
    purchase_price: 2.8,
    sale_price: 7.5,
    stock_quantity: 26,
    min_stock_alert: 6,
    godown: "Bakery Case",
    created_at: "2026-11-03",
  },
  {
    id: "it-6",
    name: "Dark Chocolate Espresso Truffles",
    sku: "BAK-003",
    barcode: "8901006",
    category: "Bakery",
    unit: "box",
    purchase_price: 5.5,
    sale_price: 12.0,
    stock_quantity: 16,
    min_stock_alert: 8,
    godown: "Front Display",
    created_at: "2026-11-04",
  },
  {
    id: "it-7",
    name: "Matte Charcoal Ceramic Mug (12oz)",
    sku: "MRC-001",
    barcode: "8901007",
    category: "Merchandise",
    unit: "pcs",
    purchase_price: 5.2,
    sale_price: 16.0,
    stock_quantity: 35,
    min_stock_alert: 8,
    godown: "Warehouse A",
    created_at: "2026-11-05",
  },
  {
    id: "it-8",
    name: "Stainless Insulated Tumbler 16oz",
    sku: "MRC-002",
    barcode: "8901008",
    category: "Merchandise",
    unit: "pcs",
    purchase_price: 9.0,
    sale_price: 24.5,
    stock_quantity: 30,
    min_stock_alert: 6,
    godown: "Warehouse A",
    created_at: "2026-11-05",
  },
  {
    id: "it-9",
    name: "Hand Drip Glass Carafe & Filter Set",
    sku: "MRC-003",
    barcode: "8901009",
    category: "Merchandise",
    unit: "set",
    purchase_price: 17.5,
    sale_price: 38.0,
    stock_quantity: 12,
    min_stock_alert: 4,
    godown: "Warehouse B",
    created_at: "2026-11-06",
  },
  {
    id: "it-10",
    name: "Oat Milk Barista Blend (6x1L Box)",
    sku: "SUP-001",
    barcode: "8901010",
    category: "Supplies",
    unit: "box",
    purchase_price: 13.0,
    sale_price: 21.0,
    stock_quantity: 28,
    min_stock_alert: 8,
    godown: "Cold Storage",
    created_at: "2026-11-07",
  },
];

export const mockParties = [
  {
    id: "pa-1",
    name: "Alexander Wright",
    party_type: "CUSTOMER" as const,
    phone: "+1 (555) 0121",
    email: "alexander.w@studio.design",
    address: "142 Beverly Blvd",
    tax_number: "CUST-901",
    opening_balance: 0,
    current_balance: 0,
    created_at: "2026-11-01",
  },
  {
    id: "pa-2",
    name: "Sophia Lin & Partners",
    party_type: "CUSTOMER" as const,
    phone: "+1 (555) 0134",
    email: "sophia@linarchitects.com",
    address: "88 Design District Ave",
    tax_number: "CUST-902",
    opening_balance: 0,
    current_balance: 145.0,
    created_at: "2026-11-02",
  },
  {
    id: "pa-3",
    name: "Marcus Vance",
    party_type: "CUSTOMER" as const,
    phone: "+1 (555) 0145",
    email: "marcus.v@acme.org",
    address: "45 Wall Street",
    tax_number: "CUST-903",
    opening_balance: 0,
    current_balance: 0,
    created_at: "2026-11-02",
  },
  {
    id: "pa-4",
    name: "Bella Terra Roasters",
    party_type: "VENDOR" as const,
    phone: "+1 (555) 0188",
    email: "orders@bellaterra.coffee",
    address: "400 Harbor Pier",
    tax_number: "VEN-401",
    opening_balance: 0,
    current_balance: -380.0,
    created_at: "2026-11-01",
  },
  {
    id: "pa-5",
    name: "Alpine Artisan Flour Mills",
    party_type: "VENDOR" as const,
    phone: "+1 (555) 0192",
    email: "sales@alpineflour.io",
    address: "12 Mill Road",
    tax_number: "VEN-402",
    opening_balance: 0,
    current_balance: 0,
    created_at: "2026-11-01",
  },
];

export const mockInvoices = [
  {
    id: "inv-1",
    invoice_number: "INV-2026-0045",
    invoice_type: "SALE" as const,
    party_id: "pa-1",
    party_name: "Alexander Wright",
    invoice_date: "2026-11-17",
    due_date: "2026-11-17",
    subtotal: 58.75,
    discount_amount: 0.0,
    tax_amount: 4.99,
    total_amount: 63.74,
    paid_amount: 63.74,
    status: "PAID",
    payment_method: "CARD",
    notes: "Counter register receipt",
    created_at: "2026-11-17T14:32:00",
  },
  {
    id: "inv-2",
    invoice_number: "INV-2026-0044",
    invoice_type: "SALE" as const,
    party_id: "pa-2",
    party_name: "Sophia Lin & Partners",
    invoice_date: "2026-11-17",
    due_date: "2026-11-24",
    subtotal: 133.64,
    discount_amount: 0.0,
    tax_amount: 11.36,
    total_amount: 145.0,
    paid_amount: 0.0,
    status: "UNPAID",
    payment_method: "TRANSFER",
    notes: "Office catering & weekly roast beans",
    created_at: "2026-11-17T11:15:00",
  },
  {
    id: "inv-3",
    invoice_number: "INV-2026-0043",
    invoice_type: "SALE" as const,
    party_id: "pa-3",
    party_name: "Marcus Vance",
    invoice_date: "2026-11-16",
    due_date: "2026-11-16",
    subtotal: 26.73,
    discount_amount: 0.0,
    tax_amount: 2.27,
    total_amount: 29.0,
    paid_amount: 29.0,
    status: "PAID",
    payment_method: "CASH",
    notes: "Express counter pickup",
    created_at: "2026-11-16T16:45:00",
  },
];

export const mockSummary = {
  total_sales: 3240.5,
  total_purchases: 1850.0,
  total_receivables: 145.0,
  total_payables: 380.0,
  total_expenses: 1600.0,
  net_profit: 1420.0,
  total_stock_value: 4890.0,
  sales_count: 38,
  low_stock_count: 2,
  recent_invoices: mockInvoices,
  low_stock_items: [mockItems[2], mockItems[8]],
  cash_in_hand: 850.0,
  cash_in_bank: 14500.0,
  total_assets: 20240.0,
  active_loans: 0,
  total_liabilities: 380.0,
  net_worth: 19860.0,
  working_capital: 15350.0,
  today_revenue: 1485.5,
  month_revenue: 34820.0,
  today_orders: 38,
  month_orders: 812,
};

export const mockExpenses = [
  {
    id: "exp-1",
    title: "Prime Location Retail Store Lease",
    category: "Store Lease",
    amount: 1400.0,
    payment_method: "BANK",
    notes: "Prime counter location lease (November)",
    expense_date: "2026-11-01",
    created_at: "2026-11-01T09:00:00",
  },
  {
    id: "exp-2",
    title: "Commercial Gigabit Dedicated Fiber",
    category: "Utilities & Fiber",
    amount: 115.0,
    payment_method: "BANK",
    notes: "Commercial gigabit fiber line",
    expense_date: "2026-11-04",
    created_at: "2026-11-04T10:30:00",
  },
  {
    id: "exp-3",
    title: "80mm Thermal Receipt Rolls (Box of 50)",
    category: "Store Supplies",
    amount: 85.0,
    payment_method: "CASH",
    notes: "Receipt paper rolls 80mm & bags",
    expense_date: "2026-11-10",
    created_at: "2026-11-10T14:15:00",
  },
];

export const mockEmployees = [
  {
    id: "emp-1",
    name: "Elena Rostova",
    role: "Store Manager",
    phone: "+1 (555) 0110",
    email: "elena@lynterminal.store",
    hourly_rate: 28.0,
    status: "ACTIVE",
    created_at: "2026-10-01",
  },
  {
    id: "emp-2",
    name: "Julian Hayes",
    role: "Lead Barista / Cashier",
    phone: "+1 (555) 0114",
    email: "julian@lynterminal.store",
    hourly_rate: 19.5,
    status: "ACTIVE",
    created_at: "2026-10-15",
  },
  {
    id: "emp-3",
    name: "Maya Patel",
    role: "Inventory Lead",
    phone: "+1 (555) 0118",
    email: "maya@lynterminal.store",
    hourly_rate: 22.0,
    status: "ACTIVE",
    created_at: "2026-10-20",
  },
];

export const mockAuditLogs = [
  {
    id: "aud-1",
    action: "SQLITE_WAL_CHECKPOINT",
    details: "Air-gapped database committed 48 transactions in 0.28ms",
    ip_address: "127.0.0.1",
    timestamp: "2026-11-17 14:32:05",
  },
  {
    id: "aud-2",
    action: "THERMAL_RECEIPT_EMITTED",
    details: "Raw ESC/POS raster print to USB-HID /dev/usb/lp0 (58ms)",
    ip_address: "127.0.0.1",
    timestamp: "2026-11-17 14:32:02",
  },
  {
    id: "aud-3",
    action: "VAULT_BACKUP_SNAPSHOT",
    details: "Cryptographic hash verified: /vault/lynterminal_20261117.db",
    ip_address: "127.0.0.1",
    timestamp: "2026-11-17 12:00:00",
  },
  {
    id: "aud-4",
    action: "COUNTER_DRAWER_OPENED",
    details: "RJ11 24V solenoid pulse dispatched via printer pin 2",
    ip_address: "127.0.0.1",
    timestamp: "2026-11-17 11:15:02",
  },
];

export function initBrowserMock() {
  if (typeof window === "undefined") return;
  if ((window as any).__TAURI_INTERNALS__) return;

  (window as any).__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, _args?: any) => {
      switch (cmd) {
        case "get_settings": {
          const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const isGst = urlParams?.get("tab")?.startsWith("gst") || urlParams?.get("currency") === "INR" || urlParams?.get("gst") === "1";
          if (isGst) {
            return {
              ...mockSettings,
              currency_code: "INR",
              currency_symbol: "₹",
              tax_name: "GST",
              default_tax_rate: 18.0,
              business_name: "LynTerminal India Flagship",
              address: "108 Brigade Road, Bengaluru, KA 560001",
              tax_id: "27AABCU9603R1ZM",
            };
          }
          return mockSettings;
        }
        case "get_auth_state": {
          const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const isSetup = urlParams?.get("setup") === "1" || urlParams?.get("onboarding") === "1";
          const isLocked = urlParams?.get("locked") === "1";
          if (isSetup) {
            return { has_account: false, is_setup_completed: false, is_locked: false };
          }
          return { has_account: true, is_setup_completed: true, is_locked: isLocked };
        }
        case "check_app_update": {
          const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const showUpdate = urlParams?.get("update") === "1" || urlParams?.get("modal") === "update";
          return {
            update_available: showUpdate,
            current_version: "1.5.4",
            latest_version: "1.5.4",
            download_url: "https://github.com/chronoarchon/LynTerminal/releases/download/v1.5.4/lynterminal_1.5.4_x64-setup.exe",
            release_notes: "### What's New in v1.5.4\n- **Offline Commercial Licensing**: Seamless Razorpay activation key verification\n- **Windows Native Build**: Robust NSIS installer and high-DPI font rendering\n- **Indian GST Hub**: Enhanced GSTR-1 and GSTR-3B statutory tax compliance reports\n- **Zero UI Latency**: Sub-10ms transaction commits and SQLite WAL concurrency",
            published_at: "2026-11-20T12:00:00Z",
            platform: "windows",
          };
        }
        case "get_gst_settings": {
          const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const enableGst = urlParams?.get("gst") === "1" || urlParams?.get("tab")?.startsWith("gst") || urlParams?.get("currency") === "INR" || true;
          return {
            is_enabled: enableGst,
            gstin: "27AABCU9603R1ZM",
            state_code: "27",
            composition_scheme: false,
            filing_frequency: "MONTHLY",
          };
        }
        case "list_items":
          return mockItems;
        case "list_parties":
          return mockParties;
        case "list_invoices":
          return mockInvoices;
        case "get_dashboard_summary":
          return mockSummary;
        case "list_expenses":
        case "get_expenses":
          return mockExpenses;
        case "list_employees":
          return mockEmployees;
        case "get_audit_logs":
          return mockAuditLogs;
        case "get_customer_aging_analysis":
          return [
            {
              party_id: "pa-2",
              party_name: "Sophia Lin & Partners",
              phone: "+1 (555) 0134",
              current_balance: 145.0,
              bucket_0_30: 145.0,
              bucket_31_60: 0,
              bucket_61_90: 0,
              bucket_90_plus: 0,
              last_invoice_date: "2026-11-17",
              overdue_days: 0,
            },
          ];
        case "get_staff_stats":
          return {
            total_employees: 3,
            active_today: 3,
            total_payroll_month: 4850.0,
            pending_payouts: 0,
          };
        case "list_attendance":
          return [
            { id: "att-1", employee_id: "emp-1", employee_name: "Elena Rostova", date: "2026-11-17", status: "PRESENT", check_in_time: "08:00", check_out_time: null, notes: "Morning register open" },
            { id: "att-2", employee_id: "emp-2", employee_name: "Julian Hayes", date: "2026-11-17", status: "PRESENT", check_in_time: "08:15", check_out_time: null, notes: "Counter billing" },
            { id: "att-3", employee_id: "emp-3", employee_name: "Maya Patel", date: "2026-11-17", status: "PRESENT", check_in_time: "09:00", check_out_time: null, notes: "Stock audit" },
          ];
        case "list_salary_payments":
          return [
            { id: "sal-1", employee_id: "emp-1", employee_name: "Elena Rostova", amount: 2400.0, payment_date: "2026-11-01", payment_method: "BANK", reference: "SAL-NOV-01", notes: "Monthly base" }
          ];
        case "getDaybook":
        case "get_daybook":
          return [
            { id: "db-1", entry_type: "SALE", reference: "INV-2026-0045", description: "Counter sale - Alexander Wright", cash_in: 0, bank_in: 63.74, cash_out: 0, bank_out: 0, balance: 63.74, timestamp: "2026-11-17 14:32:00" },
            { id: "db-2", entry_type: "SALE", reference: "INV-2026-0043", description: "Counter sale - Marcus Vance", cash_in: 29.0, bank_in: 0, cash_out: 0, bank_out: 0, balance: 92.74, timestamp: "2026-11-16 16:45:00" },
          ];
        case "listCashClosings":
        case "list_cash_closings":
          return [
            { id: "cc-1", closing_date: "2026-11-16", expected_cash: 620.0, actual_cash: 620.0, difference: 0.0, notes: "Day shift register balanced", closed_by: "Julian Hayes", created_at: "2026-11-16 21:00:00" }
          ];
        case "list_database_backups":
          return [
            { path: "/vault/backup_20261117.db", size_bytes: 482100, created_at: "2026-11-17 12:00:00" },
            { path: "/vault/backup_20261116.db", size_bytes: 478900, created_at: "2026-11-16 23:59:00" },
          ];
        case "list_bank_accounts":
          return [
            { id: "ba-1", bank_name: "Silicon Valley Commercial", account_number: "****4821", current_balance: 14800.0 },
          ];
        case "get_license_status": {
          const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const isExpired = urlParams?.get("trial") === "expired" || urlParams?.get("expired") === "1";
          const isLicensed = urlParams?.get("licensed") === "1" || urlParams?.get("activated") === "1";

          if (isLicensed) {
            return {
              is_licensed: true,
              is_trial: false,
              is_expired: false,
              days_elapsed: 2,
              days_remaining: 12,
              trial_days_limit: 14,
              first_run_date: new Date(Date.now() - 2 * 86400000).toISOString(),
              license_key: "LYN-COMM-RZP8-COMM-4892-1082",
              license_tier: "Commercial Windows Lifetime",
              customer_email: "support@wintershogun.tech",
              activated_at: new Date(Date.now() - 86400000).toISOString(),
              platform: "windows",
            };
          }
          if (isExpired) {
            return {
              is_licensed: false,
              is_trial: true,
              is_expired: true,
              days_elapsed: 15,
              days_remaining: 0,
              trial_days_limit: 14,
              first_run_date: new Date(Date.now() - 15 * 86400000).toISOString(),
              license_key: null,
              license_tier: null,
              customer_email: null,
              activated_at: null,
              platform: "windows",
            };
          }
          return {
            is_licensed: false,
            is_trial: true,
            is_expired: false,
            days_elapsed: 2,
            days_remaining: 12,
            trial_days_limit: 14,
            first_run_date: new Date(Date.now() - 2 * 86400000).toISOString(),
            license_key: null,
            license_tier: null,
            customer_email: null,
            activated_at: null,
            platform: "windows",
          };
        }
        case "activate_license": {
          const rawKey = (_args?.payload?.license_key || "").trim().toUpperCase();
          if (!rawKey.includes("COMM") || rawKey.length < 15) {
            throw new Error("Invalid license key format. Expected format: LYN-COMM-XXXX-XXXX-XXXX-XXXX");
          }
          return {
            is_licensed: true,
            is_trial: false,
            is_expired: false,
            days_elapsed: 2,
            days_remaining: 12,
            trial_days_limit: 14,
            first_run_date: new Date(Date.now() - 2 * 86400000).toISOString(),
            license_key: rawKey,
            license_tier: "Commercial Windows Lifetime",
            customer_email: _args?.payload?.customer_email || "user@store.local",
            activated_at: new Date().toISOString(),
            platform: "windows",
          };
        }
        case "show_main_window":
          return null;
        default:
          return [];
      }
    },
  };
}
