use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use sha2::{Digest, Sha256};
use crate::models::LicenseStatus;

pub const LICENSE_SECRET_SALT: &str = "WINTERSHOGUN_LYNTERMINAL_SOVEREIGN_OFFLINE_SECRET_2026";

pub fn verify_offline_license_key(key: &str) -> std::result::Result<(String, String), String> {
    let cleaned = key.trim().to_uppercase().replace(' ', "-");
    let parts: Vec<&str> = cleaned.split('-').collect();

    // Supports:
    // 1) LYN-COMM-XXXX-XXXX-XXXX-XXXX (6 parts)
    // 2) WS-COMM-XXXX-XXXX-XXXX-XXXX  (6 parts)
    // 3) COMM-XXXX-XXXX-XXXX-XXXX     (5 parts)
    let (_prefix, p1, p2, s1, s2) = if parts.len() == 6 && (parts[0] == "LYN" || parts[0] == "WS") && parts[1] == "COMM" {
        (format!("{}-{}", parts[0], parts[1]), parts[2], parts[3], parts[4], parts[5])
    } else if parts.len() == 5 && parts[0] == "COMM" {
        ("LYN-COMM".to_string(), parts[1], parts[2], parts[3], parts[4])
    } else {
        return Err("Invalid license key format. Expected format: LYN-COMM-XXXX-XXXX-XXXX-XXXX".to_string());
    };

    if p1.len() != 4 || p2.len() != 4 || s1.len() != 4 || s2.len() != 4 {
        return Err("Invalid license key segment lengths.".to_string());
    }

    if !p1.chars().all(|c| c.is_ascii_alphanumeric()) || !p2.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("License key payload contains invalid characters.".to_string());
    }

    let payload = format!("{}{}", p1, p2);
    let sign_data = format!("{}:{}:{}", LICENSE_SECRET_SALT, "LYN-COMM", payload);
    let mut hasher = Sha256::new();
    hasher.update(sign_data.as_bytes());
    let hash_result = hasher.finalize();
    let hash_hex = hex::encode(hash_result).to_uppercase();

    let expected_s1 = &hash_hex[0..4];
    let expected_s2 = &hash_hex[4..8];

    if s1 != expected_s1 || s2 != expected_s2 {
        return Err("Cryptographic signature verification failed. Invalid license key.".to_string());
    }

    Ok(("Commercial Windows Lifetime".to_string(), cleaned))
}

pub fn generate_offline_license_key(p1: &str, p2: &str) -> String {
    let p1_clean = p1.trim().to_uppercase();
    let p2_clean = p2.trim().to_uppercase();
    let payload = format!("{}{}", p1_clean, p2_clean);
    let sign_data = format!("{}:{}:{}", LICENSE_SECRET_SALT, "LYN-COMM", payload);
    let mut hasher = Sha256::new();
    hasher.update(sign_data.as_bytes());
    let hash_result = hasher.finalize();
    let hash_hex = hex::encode(hash_result).to_uppercase();
    let s1 = &hash_hex[0..4];
    let s2 = &hash_hex[4..8];
    format!("LYN-COMM-{}-{}-{}-{}", p1_clean, p2_clean, s1, s2)
}

pub struct DatabaseManager {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
}

impl DatabaseManager {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path();
        Self::open_path(db_path)
    }

    pub fn open_path(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&db_path)?;
        
        // Optimizations & safety pragmas
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;
             PRAGMA trusted_schema = OFF;"
        )?;

        // Startup integrity verification
        let integrity: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0)).unwrap_or_else(|_| "ok".into());
        if integrity != "ok" {
            eprintln!("[LynTerminal Security] Database integrity check notice: {}", integrity);
        }

        let mgr = Self {
            conn: Mutex::new(conn),
            db_path,
        };

        mgr.init_schema()?;
        Ok(mgr)
    }

    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA trusted_schema = OFF;"
        )?;

        let mgr = Self {
            conn: Mutex::new(conn),
            db_path: PathBuf::from(":memory:"),
        };

        mgr.init_schema()?;
        Ok(mgr)
    }

    fn get_db_path() -> PathBuf {
        let (target_db, old_db) = if let Ok(app_data) = std::env::var("APPDATA") {
            // Windows AppData
            (
                PathBuf::from(&app_data).join("lynterminal").join("lynterminal.db"),
                PathBuf::from(&app_data).join("lyndesk").join("lyndesk.db"),
            )
        } else if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            // Linux XDG standard
            (
                PathBuf::from(&xdg).join("com.lynterminal.app").join("lynterminal.db"),
                PathBuf::from(&xdg).join("com.lyndesk.app").join("lyndesk.db"),
            )
        } else if let Ok(home) = std::env::var("HOME") {
            // Unix / macOS / Linux default
            (
                PathBuf::from(&home)
                    .join(".local")
                    .join("share")
                    .join("com.lynterminal.app")
                    .join("lynterminal.db"),
                PathBuf::from(&home)
                    .join(".local")
                    .join("share")
                    .join("com.lyndesk.app")
                    .join("lyndesk.db"),
            )
        } else {
            // Portable / Fallback
            (
                PathBuf::from("lynterminal.db"),
                PathBuf::from("lyndesk.db"),
            )
        };

        // Non-destructive automated data migration:
        // If legacy Lyndesk database exists and new LynTerminal database does not, copy it over.
        if !target_db.exists() && old_db.exists() {
            if let Some(parent) = target_db.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if let Err(e) = std::fs::copy(&old_db, &target_db) {
                eprintln!("[LynTerminal Migration] Notice: Failed to migrate legacy lyndesk.db: {}", e);
            } else {
                eprintln!("[LynTerminal Migration] Successfully migrated legacy Lyndesk database to LynTerminal at {:?}", target_db);
            }
        }

        target_db
    }

    pub fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                business_name TEXT NOT NULL,
                tagline TEXT NOT NULL,
                address TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                tax_id TEXT NOT NULL,
                currency_symbol TEXT NOT NULL,
                currency_code TEXT NOT NULL,
                tax_name TEXT NOT NULL,
                default_tax_rate REAL NOT NULL,
                invoice_prefix TEXT NOT NULL,
                enable_godowns INTEGER NOT NULL,
                terms_and_conditions TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_auth (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                username TEXT NOT NULL DEFAULT 'admin',
                password_hash TEXT NOT NULL DEFAULT '',
                password_salt TEXT NOT NULL DEFAULT '',
                recovery_code TEXT NOT NULL DEFAULT '',
                is_setup_completed INTEGER NOT NULL DEFAULT 0,
                is_locked INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT '',
                last_login_at TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sku TEXT NOT NULL,
                barcode TEXT NOT NULL,
                category TEXT NOT NULL,
                unit TEXT NOT NULL,
                purchase_price REAL NOT NULL,
                sale_price REAL NOT NULL,
                stock_quantity REAL NOT NULL,
                min_stock_alert REAL NOT NULL,
                godown TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
            CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
            CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

            CREATE TABLE IF NOT EXISTS parties (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                party_type TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                address TEXT NOT NULL,
                tax_number TEXT NOT NULL,
                opening_balance REAL NOT NULL,
                current_balance REAL NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
            CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);

            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                invoice_number TEXT NOT NULL UNIQUE,
                invoice_type TEXT NOT NULL,
                party_id TEXT,
                party_name TEXT NOT NULL,
                invoice_date TEXT NOT NULL,
                due_date TEXT NOT NULL,
                subtotal REAL NOT NULL,
                discount_amount REAL NOT NULL,
                tax_amount REAL NOT NULL,
                total_amount REAL NOT NULL,
                paid_amount REAL NOT NULL,
                status TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                notes TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
            CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
            CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices(party_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
            CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
            CREATE INDEX IF NOT EXISTS idx_invoices_status_type_date ON invoices(status, invoice_type, invoice_date);
            CREATE INDEX IF NOT EXISTS idx_invoices_party_date ON invoices(party_id, invoice_date);

            CREATE TABLE IF NOT EXISTS invoice_items (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL,
                item_id TEXT,
                item_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                unit_price REAL NOT NULL,
                discount_percent REAL NOT NULL,
                tax_rate REAL NOT NULL,
                line_total REAL NOT NULL,
                FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_inv_items_invoice ON invoice_items(invoice_id);

            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                invoice_id TEXT,
                party_id TEXT NOT NULL,
                party_name TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_type TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                payment_date TEXT NOT NULL,
                reference TEXT NOT NULL,
                notes TEXT NOT NULL,
                FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
            CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_id);
            CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
            CREATE INDEX IF NOT EXISTS idx_payments_party_date ON payments(party_id, payment_date);

            CREATE TABLE IF NOT EXISTS expenses (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                expense_date TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                notes TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
            CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
            CREATE INDEX IF NOT EXISTS idx_expenses_date_cat ON expenses(expense_date, category);

            CREATE TABLE IF NOT EXISTS stock_movements (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                change_quantity REAL NOT NULL,
                quantity_after REAL NOT NULL,
                movement_type TEXT NOT NULL,
                reference_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                notes TEXT NOT NULL,
                FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_stock_mov_item ON stock_movements(item_id);

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                entity TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                details TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

            CREATE TABLE IF NOT EXISTS cash_closings (
                id TEXT PRIMARY KEY,
                shift_date TEXT NOT NULL,
                opening_cash REAL NOT NULL,
                sales_cash REAL NOT NULL,
                expected_cash REAL NOT NULL,
                actual_cash REAL NOT NULL,
                variance REAL NOT NULL,
                notes TEXT NOT NULL,
                closed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS purchase_orders (
                id TEXT PRIMARY KEY,
                po_number TEXT NOT NULL UNIQUE,
                vendor_name TEXT NOT NULL,
                total_cost REAL NOT NULL,
                status TEXT NOT NULL,
                items_count INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS estimates (
                id TEXT PRIMARY KEY,
                estimate_number TEXT NOT NULL UNIQUE,
                party_id TEXT,
                party_name TEXT NOT NULL,
                estimate_date TEXT NOT NULL,
                expiry_date TEXT NOT NULL,
                subtotal REAL NOT NULL,
                tax_amount REAL NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT NOT NULL,
                notes TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS estimate_items (
                id TEXT PRIMARY KEY,
                estimate_id TEXT NOT NULL,
                item_id TEXT,
                item_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                unit_price REAL NOT NULL,
                discount_percent REAL NOT NULL,
                tax_rate REAL NOT NULL,
                line_total REAL NOT NULL,
                FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
                FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS purchase_returns (
                id TEXT PRIMARY KEY,
                return_number TEXT NOT NULL UNIQUE,
                party_id TEXT,
                party_name TEXT NOT NULL,
                return_date TEXT NOT NULL,
                total_amount REAL NOT NULL,
                reason TEXT NOT NULL,
                notes TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS purchase_return_items (
                id TEXT PRIMARY KEY,
                return_id TEXT NOT NULL,
                item_id TEXT,
                item_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                unit_price REAL NOT NULL,
                line_total REAL NOT NULL,
                FOREIGN KEY(return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
                FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS bank_accounts (
                id TEXT PRIMARY KEY,
                account_name TEXT NOT NULL,
                bank_name TEXT NOT NULL,
                account_number TEXT NOT NULL,
                current_balance REAL NOT NULL,
                is_primary INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS business_loans (
                id TEXT PRIMARY KEY,
                loan_name TEXT NOT NULL,
                lender_name TEXT NOT NULL,
                principal_amount REAL NOT NULL,
                interest_rate REAL NOT NULL,
                current_balance REAL NOT NULL,
                monthly_emi REAL NOT NULL,
                disbursed_date TEXT NOT NULL,
                due_date TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recurring_bills (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                due_day INTEGER NOT NULL,
                estimated_amount REAL,
                status TEXT NOT NULL DEFAULT 'DUE',
                last_paid_date TEXT,
                last_paid_amount REAL,
                payment_method TEXT,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS employees (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                monthly_salary REAL NOT NULL,
                salary_type TEXT NOT NULL DEFAULT 'MONTHLY',
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                joining_date TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS employee_attendance (
                id TEXT PRIMARY KEY,
                employee_id TEXT NOT NULL,
                attendance_date TEXT NOT NULL,
                status TEXT NOT NULL,
                check_in TEXT,
                check_out TEXT,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_att ON employee_attendance(employee_id, attendance_date);

            CREATE TABLE IF NOT EXISTS salary_payments (
                id TEXT PRIMARY KEY,
                voucher_number TEXT NOT NULL UNIQUE,
                employee_id TEXT NOT NULL,
                employee_name TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_date TEXT NOT NULL,
                payment_source TEXT NOT NULL,
                for_month TEXT NOT NULL,
                days_present INTEGER NOT NULL,
                bonus REAL NOT NULL DEFAULT 0.0,
                deductions REAL NOT NULL DEFAULT 0.0,
                reference TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS gst_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                is_enabled INTEGER NOT NULL DEFAULT 1,
                gstin TEXT NOT NULL DEFAULT '',
                legal_name TEXT NOT NULL DEFAULT '',
                trade_name TEXT NOT NULL DEFAULT '',
                state_code TEXT NOT NULL DEFAULT '27',
                state_name TEXT NOT NULL DEFAULT 'Maharashtra',
                pan TEXT NOT NULL DEFAULT '',
                gst_composition INTEGER NOT NULL DEFAULT 0,
                einvoice_enabled INTEGER NOT NULL DEFAULT 0,
                eway_bill_threshold REAL NOT NULL DEFAULT 50000.0,
                lut_number TEXT NOT NULL DEFAULT '',
                bank_name TEXT NOT NULL DEFAULT '',
                bank_account_no TEXT NOT NULL DEFAULT '',
                bank_ifsc TEXT NOT NULL DEFAULT '',
                bank_branch TEXT NOT NULL DEFAULT '',
                upi_id TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS gst_parties (
                party_id TEXT PRIMARY KEY,
                gstin TEXT NOT NULL DEFAULT '',
                state_code TEXT NOT NULL DEFAULT '27',
                state_name TEXT NOT NULL DEFAULT 'Maharashtra',
                pan TEXT NOT NULL DEFAULT '',
                gst_type TEXT NOT NULL DEFAULT 'UNREGISTERED',
                credit_limit REAL NOT NULL DEFAULT 0.0,
                credit_period_days INTEGER NOT NULL DEFAULT 30,
                tally_ledger_group TEXT NOT NULL DEFAULT 'Sundry Debtors',
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS gst_items (
                item_id TEXT PRIMARY KEY,
                hsn_code TEXT NOT NULL DEFAULT '8471',
                description TEXT NOT NULL DEFAULT '',
                is_service INTEGER NOT NULL DEFAULT 0,
                cess_rate REAL NOT NULL DEFAULT 0.0,
                FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS gst_invoices (
                invoice_id TEXT PRIMARY KEY,
                place_of_supply TEXT NOT NULL DEFAULT '27-Maharashtra',
                pos_state_code TEXT NOT NULL DEFAULT '27',
                pos_state_name TEXT NOT NULL DEFAULT 'Maharashtra',
                supplier_gstin TEXT NOT NULL DEFAULT '',
                customer_gstin TEXT NOT NULL DEFAULT '',
                is_interstate INTEGER NOT NULL DEFAULT 0,
                is_reverse_charge INTEGER NOT NULL DEFAULT 0,
                cgst_amount REAL NOT NULL DEFAULT 0.0,
                sgst_amount REAL NOT NULL DEFAULT 0.0,
                igst_amount REAL NOT NULL DEFAULT 0.0,
                cess_amount REAL NOT NULL DEFAULT 0.0,
                round_off REAL NOT NULL DEFAULT 0.0,
                eway_bill_no TEXT DEFAULT '',
                vehicle_no TEXT DEFAULT '',
                transporter_name TEXT DEFAULT '',
                bill_reference_type TEXT DEFAULT 'New Ref',
                FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS gst_invoice_items (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL,
                item_id TEXT,
                hsn_code TEXT NOT NULL DEFAULT '',
                quantity REAL NOT NULL DEFAULT 1.0,
                unit TEXT NOT NULL DEFAULT 'PCS',
                rate REAL NOT NULL DEFAULT 0.0,
                discount_amount REAL NOT NULL DEFAULT 0.0,
                taxable_amount REAL NOT NULL DEFAULT 0.0,
                tax_rate REAL NOT NULL DEFAULT 18.0,
                cgst_rate REAL NOT NULL DEFAULT 0.0,
                cgst_amount REAL NOT NULL DEFAULT 0.0,
                sgst_rate REAL NOT NULL DEFAULT 0.0,
                sgst_amount REAL NOT NULL DEFAULT 0.0,
                igst_rate REAL NOT NULL DEFAULT 0.0,
                igst_amount REAL NOT NULL DEFAULT 0.0,
                cess_rate REAL NOT NULL DEFAULT 0.0,
                cess_amount REAL NOT NULL DEFAULT 0.0,
                line_total REAL NOT NULL DEFAULT 0.0,
                FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS bill_settlements (
                id TEXT PRIMARY KEY,
                payment_id TEXT NOT NULL,
                invoice_id TEXT NOT NULL,
                party_id TEXT NOT NULL,
                settled_amount REAL NOT NULL,
                settlement_date TEXT NOT NULL,
                notes TEXT DEFAULT '',
                FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE CASCADE,
                FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_license (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                first_run_date TEXT NOT NULL,
                last_run_date TEXT NOT NULL,
                is_licensed INTEGER NOT NULL DEFAULT 0,
                license_key TEXT NOT NULL DEFAULT '',
                license_tier TEXT NOT NULL DEFAULT '',
                customer_email TEXT NOT NULL DEFAULT '',
                activated_at TEXT NOT NULL DEFAULT '',
                trial_days_limit INTEGER NOT NULL DEFAULT 14,
                anti_tamper_hash TEXT NOT NULL DEFAULT ''
            );

            "
        )?;

        // Safe column additions for existing installations
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN tax_mode TEXT DEFAULT 'EXCLUSIVE'", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN tax_preset TEXT DEFAULT 'CUSTOM'", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN preview_after_sale INTEGER DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN auto_print INTEGER DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN opening_cash REAL DEFAULT 500.0", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN opening_bank REAL DEFAULT 10000.0", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN opening_balance_mode TEXT DEFAULT 'CASH'", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN capital_cash REAL DEFAULT 0.0", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN capital_bank REAL DEFAULT 0.0", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN capital_mode TEXT DEFAULT 'CASH'", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN custom_payment_1_name TEXT DEFAULT 'UPI'", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN custom_payment_1_enabled INTEGER DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN custom_payment_2_name TEXT DEFAULT 'Bank Transfer'", []);
        let _ = conn.execute("ALTER TABLE settings ADD COLUMN custom_payment_2_enabled INTEGER DEFAULT 0", []);

        // Safe backward-compatible mode backfill for existing databases
        let _ = conn.execute(
            "UPDATE settings SET opening_balance_mode = CASE
                WHEN (opening_cash > 0 AND opening_bank > 0) THEN 'SPLIT'
                WHEN (opening_bank > 0 AND (opening_cash IS NULL OR opening_cash = 0)) THEN 'BANK'
                ELSE 'CASH'
             END
             WHERE opening_balance_mode IS NULL OR opening_balance_mode = ''",
            [],
        );
        let _ = conn.execute(
            "UPDATE settings SET capital_mode = CASE
                WHEN (capital_cash > 0 AND capital_bank > 0) THEN 'SPLIT'
                WHEN (capital_bank > 0 AND (capital_cash IS NULL OR capital_cash = 0)) THEN 'BANK'
                ELSE 'CASH'
             END
             WHERE capital_mode IS NULL OR capital_mode = ''",
            [],
        );

        let _ = conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS cash_bank_transfers (
                id TEXT PRIMARY KEY,
                direction TEXT NOT NULL,
                bank_account_id TEXT NOT NULL,
                amount REAL NOT NULL,
                notes TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_transfers_ts ON cash_bank_transfers(timestamp);

            CREATE TABLE IF NOT EXISTS loan_transactions (
                id TEXT PRIMARY KEY,
                loan_id TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                account_type TEXT NOT NULL,
                bank_account_id TEXT,
                amount REAL NOT NULL,
                notes TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_loan_tx_ts ON loan_transactions(timestamp);
            "
        );

        let _ = conn.execute("ALTER TABLE items ADD COLUMN size TEXT DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE items ADD COLUMN brand TEXT DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE items ADD COLUMN tax_rate REAL DEFAULT NULL", []);

        let _ = conn.execute("ALTER TABLE invoices ADD COLUMN reference TEXT DEFAULT ''", []);

        // Ensure default recurring bills exist
        let bill_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM recurring_bills",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        if bill_count == 0 {
            let now = chrono::Local::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT INTO recurring_bills (id, title, category, due_day, estimated_amount, status, notes, created_at)
                 VALUES ('REC-01', 'Store / Shop Rent', 'RENT', 1, 1200.00, 'DUE', 'Monthly shop premises lease', ?1)",
                params![now],
            );
            let _ = conn.execute(
                "INSERT INTO recurring_bills (id, title, category, due_day, estimated_amount, status, notes, created_at)
                 VALUES ('REC-02', 'Commercial Electricity & Power', 'ELECTRICITY', 10, NULL, 'DUE', 'Monthly utility variable bill', ?1)",
                params![now],
            );
            let _ = conn.execute(
                "INSERT INTO recurring_bills (id, title, category, due_day, estimated_amount, status, notes, created_at)
                 VALUES ('REC-03', 'Fiber Internet & POS Network', 'INTERNET', 15, 65.00, 'DUE', 'Store Wi-Fi and terminal connection', ?1)",
                params![now],
            );
            let _ = conn.execute(
                "INSERT INTO recurring_bills (id, title, category, due_day, estimated_amount, status, notes, created_at)
                 VALUES ('REC-04', 'Store Sanitation & Maintenance', 'MAINTENANCE', 20, 150.00, 'DUE', 'Monthly deep clean & HVAC service', ?1)",
                params![now],
            );
        }

        // Ensure default primary bank account exists
        let bank_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM bank_accounts",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        if bank_count == 0 {
            let now = chrono::Local::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
                 VALUES ('BANK-PRIMARY', 'Primary Operating Account', 'Commercial Bank', '0001', 0.0, 1, ?1)",
                params![now],
            );
        }

        // Ensure default settings exist with clean zero opening balances
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM settings WHERE id = 1",
            [],
            |r| r.get(0),
        )?;

        if count == 0 {
            conn.execute(
                "INSERT INTO settings (
                    id, business_name, tagline, address, phone, email, tax_id,
                    currency_symbol, currency_code, tax_name, default_tax_rate,
                    invoice_prefix, enable_godowns, terms_and_conditions,
                    tax_mode, tax_preset, preview_after_sale, auto_print,
                    opening_cash, opening_bank, opening_balance_mode,
                    capital_cash, capital_bank, capital_mode
                ) VALUES (
                    1, 'LynTerminal Store', 'Point of Sale & Business OS',
                    '', '', '', '',
                    '$', 'USD', 'Sales Tax', 5.0, 'INV-', 1,
                    'Thank you for your business!',
                    'EXCLUSIVE', 'CUSTOM', 0, 0,
                    0.0, 0.0, 'CASH',
                    0.0, 0.0, 'CASH'
                )",
                [],
            )?;
        }

        let auth_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM app_auth WHERE id = 1",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        if auth_count == 0 {
            conn.execute(
                "INSERT INTO app_auth (id, username, password_hash, password_salt, recovery_code, is_setup_completed, is_locked, created_at, last_login_at)
                 VALUES (1, 'admin', '', '', '', 0, 0, '', '')",
                [],
            )?;
        }

        let gst_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM gst_settings WHERE id = 1",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        if gst_count == 0 {
            let now = chrono::Local::now().to_rfc3339();
            let _ = conn.execute(
                "INSERT INTO gst_settings (
                    id, is_enabled, gstin, legal_name, trade_name, state_code, state_name,
                    pan, gst_composition, einvoice_enabled, eway_bill_threshold,
                    lut_number, bank_name, bank_account_no, bank_ifsc, bank_branch, upi_id, updated_at
                ) VALUES (
                    1, 1, '27AABCU9603R1ZN', 'LynTerminal India Enterprises Pvt Ltd',
                    'LynTerminal Store', '27', 'Maharashtra', 'AABCU9603R',
                    0, 0, 50000.0, '', 'HDFC Bank', '50200012345678', 'HDFC0000123',
                    'Fort, Mumbai', 'lynterminal@okhdfcbank', ?1
                )",
                params![now],
            );
        }

        let lic_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM app_license WHERE id = 1",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        if lic_count == 0 {
            let now = chrono::Utc::now().to_rfc3339();
            #[cfg(target_os = "linux")]
            let (is_lic_init, key_init, tier_init) = (1, "LINUX-FREE", "community");
            #[cfg(not(target_os = "linux"))]
            let (is_lic_init, key_init, tier_init) = (0, "", "");

            let _ = conn.execute(
                "INSERT INTO app_license (
                    id, first_run_date, last_run_date, is_licensed,
                    license_key, license_tier, customer_email, activated_at,
                    trial_days_limit, anti_tamper_hash
                ) VALUES (
                    1, ?1, ?1, ?2,
                    ?3, ?4, '', '',
                    14, ''
                )",
                params![now, is_lic_init, key_init, tier_init],
            );
        }

        // On Linux, ensure existing installations are permanently unlocked community edition
        #[cfg(target_os = "linux")]
        {
            let _ = conn.execute(
                "UPDATE app_license SET is_licensed = 1, license_key = 'LINUX-FREE', license_tier = 'community' WHERE id = 1 AND is_licensed = 0",
                [],
            );
        }

        Ok(())
    }

    pub fn get_license_status(&self) -> std::result::Result<LicenseStatus, String> {
        let conn = self.conn.lock().unwrap();
        let row = conn.query_row(
            "SELECT first_run_date, last_run_date, is_licensed, license_key, license_tier, customer_email, activated_at, trial_days_limit
             FROM app_license WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, i64>(7)?,
                ))
            },
        ).map_err(|e| e.to_string())?;

        let (first_run_str, last_run_str, is_lic_num, key_str, tier_str, email_str, act_at_str, trial_limit) = row;
        
        let now = chrono::Utc::now();
        let parse_dt = |s: &str| -> Option<chrono::DateTime<chrono::Utc>> {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .ok()
                .or_else(|| {
                    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                        .ok()
                        .map(|dt| chrono::DateTime::from_naive_utc_and_offset(dt, chrono::Utc))
                })
        };
        let first_run = parse_dt(&first_run_str).unwrap_or(now);
        let last_run = parse_dt(&last_run_str).unwrap_or(first_run);

        // Anti-tamper clock rollback check: if system clock is moved backwards by more than 24 hours
        let is_clock_tampered = now < (last_run - chrono::Duration::hours(24));

        // Monotonic forward clock update
        if now > last_run {
            let _ = conn.execute(
                "UPDATE app_license SET last_run_date = ?1 WHERE id = 1",
                params![now.to_rfc3339()],
            );
        }

        let is_licensed = if is_lic_num == 1 && !key_str.is_empty() {
            verify_offline_license_key(&key_str).is_ok()
        } else {
            false
        };

        let trial_deadline = first_run + chrono::Duration::days(trial_limit);
        let days_elapsed = if now <= first_run {
            0
        } else {
            let elapsed_diff = now - first_run;
            ((elapsed_diff.num_seconds() + 43200) / 86400).max(0).min(trial_limit + 30)
        };
        let days_remaining = if now >= trial_deadline {
            0
        } else {
            let diff = trial_deadline - now;
            let rem = (diff.num_seconds() + 86399) / 86400;
            rem.clamp(0, trial_limit)
        };
        let is_expired = !is_licensed && (now >= trial_deadline || is_clock_tampered);

        let platform = if cfg!(target_os = "windows") || std::env::consts::OS == "windows" {
            "windows".to_string()
        } else if cfg!(target_os = "macos") || std::env::consts::OS == "macos" {
            "macos".to_string()
        } else {
            "linux".to_string()
        };

        // ── Linux Community Edition ─────────────────────────────────────────
        // Linux is FREE. No trial enforcement, no license UI, no expiry.
        // Windows keeps the full commercial trial / license flow.
        #[cfg(target_os = "linux")]
        {
            return Ok(LicenseStatus {
                is_licensed: true,
                is_trial: false,
                is_expired: false,
                days_elapsed: 0,
                days_remaining: 9999,
                trial_days_limit: 9999,
                first_run_date: first_run_str,
                license_key: Some("LINUX-FREE".to_string()),
                license_tier: Some("community".to_string()),
                customer_email: None,
                activated_at: None,
                platform: "linux".to_string(),
            });
        }

        #[allow(unreachable_code)]
        Ok(LicenseStatus {
            is_licensed,
            is_trial: !is_licensed,
            is_expired,
            days_elapsed,
            days_remaining,
            trial_days_limit: trial_limit,
            first_run_date: first_run_str,
            license_key: if is_licensed { Some(key_str) } else { None },
            license_tier: if is_licensed { Some(tier_str) } else { None },
            customer_email: if !email_str.is_empty() { Some(email_str) } else { None },
            activated_at: if !act_at_str.is_empty() { Some(act_at_str) } else { None },
            platform,
        })
    }

    pub fn activate_license(&self, key: &str, email: Option<String>) -> std::result::Result<LicenseStatus, String> {
        let (tier, valid_key) = verify_offline_license_key(key)?;
        let now_str = chrono::Utc::now().to_rfc3339();
        let customer_email = email.unwrap_or_default();

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE app_license SET is_licensed = 1, license_key = ?1, license_tier = ?2, customer_email = ?3, activated_at = ?4 WHERE id = 1",
            params![valid_key, tier, customer_email, now_str],
        ).map_err(|e| format!("Failed to record license in local database: {}", e))?;

        let _ = conn.execute(
            "INSERT INTO audit_logs (action, entity, entity_id, details, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                "LICENSE_ACTIVATED",
                "LICENSE",
                "1",
                format!("Commercial license activated offline: {}", valid_key),
                now_str
            ],
        );

        drop(conn);
        self.get_license_status()
    }

    pub fn is_trial_expired(&self) -> bool {
        match self.get_license_status() {
            Ok(status) => status.is_expired,
            Err(_) => false,
        }
    }

    pub fn set_trial_start_days_ago(&self, days_ago: i64) -> std::result::Result<(), String> {
        let target = chrono::Utc::now() - chrono::Duration::days(days_ago) - chrono::Duration::seconds(5);
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE app_license SET first_run_date = ?1, last_run_date = ?1 WHERE id = 1",
            params![target.to_rfc3339()],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }


    pub fn log_audit(
        conn: &Connection,
        action: &str,
        entity: &str,
        entity_id: &str,
        details: &str,
    ) -> Result<()> {
        let now = chrono::Local::now().to_rfc3339();
        conn.execute(
            "INSERT INTO audit_logs (action, entity, entity_id, details, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![action, entity, entity_id, details, now],
        )?;
        Ok(())
    }
}
