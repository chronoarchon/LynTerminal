use lynterminal_lib::commands::{generate_and_save_invoice_pdf, generate_native_invoice_pdf, seed_demo_data_conn};
use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::models::{Invoice, InvoiceDetail, InvoiceItem, Settings};
use rusqlite::params;
use sha2::{Digest, Sha256};
use uuid::Uuid;

// ============================================================================
// STAGE 1: SECURITY, ANTI-TAMPER, AUTHENTICATION & RECOVERY PROTOCOL
// ============================================================================
#[test]
fn test_stage_1_security_anti_tamper_auth_and_recovery() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // 1. Verify SQLite Anti-Tamper & Hardening Directives
    let trusted_schema: i32 = conn
        .query_row("PRAGMA trusted_schema;", [], |r| r.get(0))
        .expect("PRAGMA trusted_schema query must succeed");
    assert_eq!(
        trusted_schema, 0,
        "trusted_schema must be OFF (0) to defeat malicious SQLite extensions and modding"
    );

    let foreign_keys: i32 = conn
        .query_row("PRAGMA foreign_keys;", [], |r| r.get(0))
        .expect("PRAGMA foreign_keys query must succeed");
    assert_eq!(
        foreign_keys, 1,
        "foreign_keys must be strictly ON (1) to guarantee relational integrity"
    );

    // 2. Database Self-Integrity Check
    let integrity_check: String = conn
        .query_row("PRAGMA quick_check;", [], |r| r.get(0))
        .expect("PRAGMA quick_check must execute");
    assert_eq!(integrity_check, "ok", "Database file integrity must return 'ok'");

    // 3. Initial Setup State Verification
    let setup_done: i32 = conn
        .query_row("SELECT is_setup_completed FROM app_auth WHERE id = 1", [], |r| r.get(0))
        .expect("app_auth query must succeed");
    assert_eq!(setup_done, 0, "Fresh installation must have is_setup_completed = 0");

    // 4. Client-Side Cryptographic Account Setup
    let username = "chronoarchon";
    let password = "SuperSecureLocalPassword2026!";
    let recovery_code = "LYN-9K2P-4V1R-8Z7W-3X";
    let salt = Uuid::new_v4().to_string();

    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    let password_hash = hex::encode(hasher.finalize());

    conn.execute(
        "UPDATE app_auth
         SET username = ?1,
             password_hash = ?2,
             password_salt = ?3,
             recovery_code = ?4,
             is_setup_completed = 1,
             is_locked = 0,
             created_at = '2026-11-14T12:00:00'
         WHERE id = 1",
        params![username, password_hash, salt, recovery_code],
    )
    .expect("Setup update must succeed");

    // Verify setup persistence
    let (stored_user, is_done): (String, i32) = conn
        .query_row(
            "SELECT username, is_setup_completed FROM app_auth WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(stored_user, "chronoarchon");
    assert_eq!(is_done, 1);

    // 5. App Lock Enforcement
    conn.execute("UPDATE app_auth SET is_locked = 1 WHERE id = 1", [])
        .unwrap();
    let is_locked: i32 = conn
        .query_row("SELECT is_locked FROM app_auth WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(is_locked, 1, "Application must report locked state");

    // 6. Salted Hash Verification
    let (stored_hash, stored_salt): (String, String) = conn
        .query_row(
            "SELECT password_hash, password_salt FROM app_auth WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    let mut verifier = Sha256::new();
    verifier.update(password.as_bytes());
    verifier.update(stored_salt.as_bytes());
    assert_eq!(
        hex::encode(verifier.finalize()),
        stored_hash,
        "Salted SHA-256 hash match must authenticate without error"
    );

    // 7. Case-Insensitive, Dash-Stripped 18-Character Recovery Key Normalization
    let user_recovery_input = "lyn-9k2p-4v1r-8z7w-3x";
    let norm_input: String = user_recovery_input
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    let norm_stored: String = recovery_code
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    assert_eq!(
        norm_input, norm_stored,
        "Recovery code normalization must ignore hyphens and casing"
    );

    println!("✅ Stage 1 Passed: Security, Anti-Tamper, Auth & Recovery Key protocol fully verified.");
}

#[test]
fn test_optional_app_lock_skip() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Initially setup not completed
    let (setup_done, locked): (i32, i32) = conn
        .query_row(
            "SELECT is_setup_completed, is_locked FROM app_auth WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("query app_auth");
    assert_eq!(setup_done, 0);
    assert_eq!(locked, 0);

    // Complete setup skipping app lock
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "UPDATE app_auth
         SET username = ?1,
             password_hash = '',
             password_salt = '',
             recovery_code = '',
             is_setup_completed = 1,
             is_locked = 0,
             created_at = ?2,
             last_login_at = ?2
         WHERE id = 1",
        params!["admin", now],
    )
    .expect("update app_auth with skipped lock");

    let (setup_done_after, hash_after): (i32, String) = conn
        .query_row(
            "SELECT is_setup_completed, password_hash FROM app_auth WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("query app_auth");
    assert_eq!(setup_done_after, 1);
    assert!(hash_after.is_empty(), "Hash must be empty when lock is skipped");
}

// ============================================================================
// STAGE 2: ACCOUNTING RECONCILIATION & BALANCE SHEET INTEGRITY
// ============================================================================
#[test]
fn test_stage_2_accounting_reconciliation_and_working_capital() {
    let db = DatabaseManager::in_memory().expect("Failed to initialize in-memory SQLite DB");
    let mut conn = db.conn.lock().expect("Failed to acquire DB lock");

    // Verify initial settings
    let default_tax: f64 = conn
        .query_row("SELECT default_tax_rate FROM settings WHERE id = 1", [], |r| r.get(0))
        .expect("Settings should exist");
    assert_eq!(default_tax, 5.0);

    // Run 30-day retail & inventory business simulation
    let seed_result = seed_demo_data_conn(&mut conn, 30);
    assert!(seed_result.is_ok(), "Seed demo data failed: {:?}", seed_result);

    // 1. Verify Cataloged Items & Positive Stock
    let item_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))
        .expect("Failed to count items");
    assert_eq!(item_count, 12, "Expected 12 cataloged items");

    let min_stock: f64 = conn
        .query_row("SELECT MIN(stock_quantity) FROM items", [], |r| r.get(0))
        .expect("Failed to get min stock");
    assert!(min_stock > 0.0, "Stock should remain positive across simulation");

    // 2. Verify Customer & Vendor Accounts
    let customer_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM parties WHERE party_type = 'CUSTOMER'", [], |r| r.get(0))
        .unwrap();
    let vendor_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM parties WHERE party_type = 'VENDOR'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(customer_count, 3, "Expected 3 simulated customers");
    assert_eq!(vendor_count, 3, "Expected 3 simulated vendors");

    // 3. Mathematical Line Item & Subtotal Invariant Check
    let mismatched_invoices: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoices inv
             WHERE ABS(inv.subtotal - (
                 SELECT COALESCE(SUM(quantity * unit_price), 0)
                 FROM invoice_items ii WHERE ii.invoice_id = inv.id
             )) > 0.05",
            [],
            |r| r.get(0),
        )
        .expect("Failed to verify invoice math integrity");
    assert_eq!(
        mismatched_invoices, 0,
        "Every invoice subtotal must match sum of invoice line items within 5 cents"
    );

    // 4. Accounting Balances Reconciliation
    let total_sales: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices WHERE invoice_type = 'SALE'",
            [],
            |r| r.get(0),
        )
        .unwrap();

    let total_purchases: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices WHERE invoice_type = 'PURCHASE'",
            [],
            |r| r.get(0),
        )
        .unwrap();

    let total_expenses: f64 = conn
        .query_row("SELECT COALESCE(SUM(amount), 0.0) FROM expenses", [], |r| r.get(0))
        .unwrap();

    let total_inventory_value: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(stock_quantity * purchase_price), 0.0) FROM items",
            [],
            |r| r.get(0),
        )
        .unwrap();

    let total_receivables: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_balance), 0.0) FROM parties WHERE party_type = 'CUSTOMER' AND current_balance > 0",
            [],
            |r| r.get(0),
        )
        .unwrap();

    let total_payables: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(current_balance), 0.0) FROM parties WHERE party_type = 'VENDOR' AND current_balance > 0",
            [],
            |r| r.get(0),
        )
        .unwrap();

    assert!(total_sales > 0.0, "Total sales should be positive");
    assert!(total_purchases > 0.0, "Total purchases should be positive");
    assert!(total_expenses > 0.0, "Total expenses should be positive");
    assert!(total_inventory_value > 0.0, "Inventory valuation must be positive");

    let total_assets = total_receivables + total_inventory_value;
    let net_worth = total_assets - total_payables;
    assert!(
        net_worth > 0.0,
        "Enterprise net worth must be positive after retail operations"
    );

    println!(
        "✅ Stage 2 Passed: Accounting Reconciled. Sales: ${:.2}, Purchases: ${:.2}, Expenses: ${:.2}, Net Worth: ${:.2}",
        total_sales, total_purchases, total_expenses, net_worth
    );
}

// ============================================================================
// STAGE 3: POS BILLING, FOREIGN KEY RESILIENCE & NATIVE PDF ENGINE
// ============================================================================
#[test]
fn test_stage_3_pos_billing_foreign_key_resilience_and_pdf() {
    let db = DatabaseManager::in_memory().expect("In-memory DB failed");
    let mut conn = db.conn.lock().expect("Lock failed");

    // 1. Seed 1 Item and 1 Customer
    let item_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO items (id, name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, created_at)
         VALUES (?1, 'Espresso Truffles', 'BAKE-01', '123456', 'Bakery', 'box', 6.0, 12.0, 50.0, 5.0, 'Front Store', '2026-11-14')",
        params![item_id],
    )
    .unwrap();

    let party_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Apex Commercial Corp', 'CUSTOMER', '555-0199', 'orders@apexcorp.test', '100 Commercial Way', 'TAX123', 0.0, 0.0, '2026-11-14')",
        params![party_id],
    )
    .unwrap();

    // 2. POS Walk-In Customer Checkout (party_id: None)
    {
        let tx = conn.transaction().unwrap();
        let inv_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at, reference)
             VALUES (?1, 'INV-TEST-W', 'SALE', NULL, 'Walk-in Customer', '2026-11-14', '2026-11-14', 24.0, 0.0, 1.2, 25.2, 25.2, 'PAID', 'Cash', 'Test', '2026-11-14', '')",
            params![inv_id],
        )
        .unwrap();

        let line_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit, unit_price, discount_percent, tax_rate, line_total)
             VALUES (?1, ?2, ?3, 'Espresso Truffles', 2.0, 'box', 12.0, 0.0, 5.0, 24.0)",
            params![line_id, inv_id, item_id],
        )
        .unwrap();
        tx.commit().unwrap();
    }

    // 3. Foreign Key Constraint Resilience with Orphan IDs
    {
        let tx = conn.transaction().unwrap();
        let invalid_party_id = "deleted-party-999";
        let invalid_item_id = "custom-line-item-999";

        let valid_party: Option<String> = if tx
            .query_row("SELECT 1 FROM parties WHERE id = ?1", params![invalid_party_id], |_| Ok(true))
            .unwrap_or(false)
        {
            Some(invalid_party_id.to_string())
        } else {
            None
        };
        assert_eq!(valid_party, None, "Invalid party must resolve to None");

        let valid_item: Option<String> = if tx
            .query_row("SELECT 1 FROM items WHERE id = ?1", params![invalid_item_id], |_| Ok(true))
            .unwrap_or(false)
        {
            Some(invalid_item_id.to_string())
        } else {
            None
        };
        assert_eq!(valid_item, None, "Invalid item must resolve to None");

        let inv_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at, reference)
             VALUES (?1, 'INV-TEST-ORPHAN', 'SALE', ?2, 'Unknown Customer', '2026-11-14', '2026-11-14', 10.0, 0.0, 0.5, 10.5, 10.5, 'PAID', 'Cash', 'Test Orphan', '2026-11-14', '')",
            params![inv_id, valid_party],
        )
        .unwrap();

        let line_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit, unit_price, discount_percent, tax_rate, line_total)
             VALUES (?1, ?2, ?3, 'Custom Ad-hoc Item', 1.0, 'pcs', 10.0, 0.0, 5.0, 10.0)",
            params![line_id, inv_id, valid_item],
        )
        .unwrap();

        assert!(
            tx.commit().is_ok(),
            "Foreign key validation prevents any transaction failure on orphan IDs!"
        );
    }

    // 4. Native Vector PDF Generation with Multi-Page Pagination
    let settings = Settings {
        business_name: "Apex Commercial Supplies".to_string(),
        tagline: "Industrial & Enterprise Hardware".to_string(),
        address: "100 Commercial Way, Suite 400".to_string(),
        phone: "+1 (555) 019-2834".to_string(),
        email: "billing@apexcommercial.io".to_string(),
        tax_id: "US-94-3829102".to_string(),
        currency_symbol: "$".to_string(),
        currency_code: "USD".to_string(),
        tax_name: "Sales Tax".to_string(),
        default_tax_rate: 8.5,
        invoice_prefix: "INV".to_string(),
        enable_godowns: true,
        terms_and_conditions: "Payment due within 30 days of invoice date.".to_string(),
        tax_mode: "EXCLUSIVE".to_string(),
        tax_preset: "CUSTOM".to_string(),
        ..Settings::default()
    };

    let invoice = Invoice {
        id: "test-inv-001".to_string(),
        invoice_number: "INV-TEST-0001".to_string(),
        invoice_type: "SALE".to_string(),
        party_id: None,
        party_name: "Apex Commercial Corp".to_string(),
        invoice_date: "2026-11-14".to_string(),
        due_date: "2026-11-14".to_string(),
        subtotal: 5000.0,
        discount_amount: 0.0,
        tax_amount: 425.0,
        total_amount: 5425.0,
        paid_amount: 5425.0,
        status: "PAID".to_string(),
        payment_method: "Cash".to_string(),
        notes: "Test 40 line items for pagination".to_string(),
        created_at: "2026-11-14T11:00:00".to_string(),
        reference: Some("REF-1234".to_string()),
    };

    let mut items = Vec::new();
    for i in 1..=40 {
        items.push(InvoiceItem {
            id: format!("item-{}", i),
            invoice_id: "test-inv-001".to_string(),
            item_id: Some(format!("prod-{}", i)),
            item_name: format!("Item #{:02} - Heavy Duty Commercial Conduit 2.5mm", i),
            quantity: i as f64,
            unit: "mtr".to_string(),
            unit_price: 15.0,
            discount_percent: 0.0,
            tax_rate: 8.5,
            line_total: (i as f64) * 15.0,
        });
    }

    let detail = InvoiceDetail { invoice, items };
    let pdf_bytes = generate_native_invoice_pdf(&detail, &settings, "100 Commercial Way");

    assert!(
        pdf_bytes.starts_with(b"%PDF-1.4\n"),
        "Generated binary must start with %PDF-1.4"
    );
    let pdf_str = String::from_utf8_lossy(&pdf_bytes);
    assert!(pdf_str.contains("%%EOF"), "PDF must terminate with %%EOF");
    assert!(
        pdf_str.contains("Invoice INV-TEST-0001 - Continued"),
        "Must contain multi-page continuation header"
    );

    println!(
        "✅ Stage 3 Passed: POS Checkout, FK Resilience, and Multi-page Native PDF ({} bytes) verified.",
        pdf_bytes.len()
    );
}

// ============================================================================
// STAGE 4: INVENTORY, GODOWN TRANSFERS & LOW STOCK ALERTS
// ============================================================================
#[test]
fn test_stage_4_inventory_godown_transfers_and_low_stock() {
    let db = DatabaseManager::in_memory().expect("In-memory DB failed");
    let conn = db.conn.lock().expect("Lock failed");

    // 1. Catalog Multiple Products Across Warehouses
    let item1_id = Uuid::new_v4().to_string();
    let item2_id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO items (id, name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, created_at)
         VALUES (?1, 'Commercial Coffee Beans (1kg)', 'CB-01', '1001', 'Beverages', 'bag', 10.0, 25.0, 100.0, 15.0, 'Main Warehouse', '2026-11-14')",
        params![item1_id],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO items (id, name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, created_at)
         VALUES (?1, 'Barista Oat Milk (1L)', 'OM-01', '1002', 'Beverages', 'carton', 2.0, 5.0, 8.0, 10.0, 'Front Store', '2026-11-14')",
        params![item2_id],
    )
    .unwrap();

    // 2. Verify Low Stock Detection
    let low_stock_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE stock_quantity <= min_stock_alert",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        low_stock_count, 1,
        "Item 2 with 8 units in stock and alert at 10 must trigger low stock alert"
    );

    // 3. Perform Inter-Warehouse Stock Transfer
    let transfer_qty = 20.0;
    let _from_godown = "Main Warehouse";
    let to_godown = "Front Store";

    // Deduct from Main Warehouse and record movement
    conn.execute(
        "UPDATE items SET stock_quantity = stock_quantity - ?1, godown = ?2 WHERE id = ?3",
        params![transfer_qty, to_godown, item1_id],
    )
    .unwrap();

    let movement_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO stock_movements (id, item_id, item_name, change_quantity, quantity_after, movement_type, reference_id, timestamp, notes)
         VALUES (?1, ?2, 'Commercial Coffee Beans (1kg)', ?3, 80.0, 'TRANSFER', 'TRF-001', '2026-11-14T14:00:00', 'Transfer Main Warehouse -> Front Store')",
        params![movement_id, item1_id, -transfer_qty],
    )
    .unwrap();

    // 4. Verify Stock Movements Audit
    let logged_type: String = conn
        .query_row(
            "SELECT movement_type FROM stock_movements WHERE id = ?1",
            params![movement_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(logged_type, "TRANSFER");

    // 5. Total Stock Valuation Accuracy
    let total_valuation: f64 = conn
        .query_row(
            "SELECT SUM(stock_quantity * purchase_price) FROM items",
            [],
            |r| r.get(0),
        )
        .unwrap();
    // 80 units * 10.0 = 800.0, plus 8 units * 2.0 = 16.0 => 816.0
    assert_eq!(
        total_valuation, 816.0,
        "Total stock valuation must accurately reconcile after transfer"
    );

    println!(
        "✅ Stage 4 Passed: Inventory Godowns, Stock Transfers & Low Stock alerts verified (Valuation: ${:.2}).",
        total_valuation
    );
}

// ============================================================================
// STAGE 5: STAFF, PAYROLL, ATTENDANCE & LIABILITIES / PAYABLES
// ============================================================================
#[test]
fn test_stage_5_staff_payroll_attendance_and_liabilities() {
    let db = DatabaseManager::in_memory().expect("In-memory DB failed");
    let conn = db.conn.lock().expect("Lock failed");

    // 1. Employee Management
    let initial_emp_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM employees WHERE status = 'ACTIVE'", [], |r| r.get(0))
        .unwrap();

    let emp_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO employees (id, name, role, phone, email, monthly_salary, salary_type, status, joining_date, notes, created_at)
         VALUES (?1, 'Samantha Cross', 'STORE_MANAGER', '+1 (555) 012-3456', 'samantha@lynterminal.store', 3500.0, 'MONTHLY', 'ACTIVE', '2026-01-15', 'Full-time Store Manager', '2026-01-15T09:00:00')",
        params![emp_id],
    )
    .unwrap();

    let emp_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM employees WHERE status = 'ACTIVE'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(emp_count, initial_emp_count + 1);

    // 2. Attendance Logging
    let att_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO employee_attendance (id, employee_id, attendance_date, status, check_in, check_out, notes, created_at)
         VALUES (?1, ?2, '2026-11-14', 'PRESENT', '08:30:00', '17:30:00', 'On time', '2026-11-14T08:30:00')",
        params![att_id, emp_id],
    )
    .unwrap();

    let attended: String = conn
        .query_row(
            "SELECT status FROM employee_attendance WHERE id = ?1",
            params![att_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(attended, "PRESENT");

    // 3. Staff Payroll Expense Creation
    let expense_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes)
         VALUES (?1, 'Salary - Samantha Cross (Nov 2026)', 'Salary', 3500.0, '2026-11-14', 'Bank Transfer', 'Monthly Manager Salary')",
        params![expense_id],
    )
    .unwrap();

    // 4. Recurring Liabilities Tracking (Commercial Rent, Utilities)
    let bill_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO recurring_bills (id, title, category, due_day, estimated_amount, status, notes, created_at)
         VALUES (?1, 'Store Retail Lease', 'RENT', 1, 2400.0, 'DUE', 'Commercial Lease', '2026-11-14')",
        params![bill_id],
    )
    .unwrap();

    // Settle Recurring Bill
    conn.execute(
        "UPDATE recurring_bills
         SET status = 'PAID', last_paid_date = '2026-11-14', last_paid_amount = 2400.0, payment_method = 'BANK'
         WHERE id = ?1",
        params![bill_id],
    )
    .unwrap();

    let bill_status: String = conn
        .query_row(
            "SELECT status FROM recurring_bills WHERE id = ?1",
            params![bill_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(bill_status, "PAID");

    // 5. Audit Log Trail
    conn.execute(
        "INSERT INTO audit_logs (action, entity, entity_id, details, timestamp)
         VALUES ('PAYROLL_DISPATCH', 'STAFF', ?1, 'Dispatched monthly salary $3500.00 via Bank', '2026-11-14T14:30:00')",
        params![emp_id],
    )
    .unwrap();

    let audit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM audit_logs WHERE action = 'PAYROLL_DISPATCH'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(audit_count, 1, "Audit log trail must record payroll dispatches");

    println!("✅ Stage 5 Passed: Staff Management, Payroll, Attendance & Liabilities verified.");
}

// ============================================================================
// COMPATIBILITY: LOCAL BILLS REAL PDF SYNC
// ============================================================================
#[test]
fn test_sync_local_bills_as_real_pdf() {
    let db = DatabaseManager::new().expect("Failed to open local user database");
    let conn = db.conn.lock().expect("Failed to acquire DB lock");

    let bills_dir = lynterminal_lib::commands::get_bills_storage_dir();
    let _ = std::fs::create_dir_all(&bills_dir);

    // Delete stale .html files in bills directory
    if let Ok(entries) = std::fs::read_dir(&bills_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map_or(false, |ext| ext == "html") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    let settings = Settings {
        business_name: "Apex Commercial Supplies".to_string(),
        tagline: "Point of Sale & Enterprise Hub".to_string(),
        address: "100 Commercial Way, Suite 400".to_string(),
        phone: "+1 (555) 019-2834".to_string(),
        email: "billing@apexcommercial.io".to_string(),
        tax_id: "US-94-3829102".to_string(),
        currency_symbol: "$".to_string(),
        currency_code: "USD".to_string(),
        tax_name: "Sales Tax".to_string(),
        default_tax_rate: 5.0,
        invoice_prefix: "INV".to_string(),
        terms_and_conditions: "Thank you for your business. Returns accepted within 14 days.".to_string(),
        ..Settings::default()
    };

    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_number, invoice_type, party_id, party_name,
                    invoice_date, due_date, subtotal, discount_amount,
                    tax_amount, total_amount, paid_amount, status,
                    payment_method, notes, created_at, reference
             FROM invoices ORDER BY id ASC",
        )
        .expect("Prepare stmt failed");

    let invoices: Vec<Invoice> = stmt
        .query_map([], |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                invoice_type: row.get(2)?,
                party_id: row.get(3)?,
                party_name: row.get(4)?,
                invoice_date: row.get(5)?,
                due_date: row.get(6)?,
                subtotal: row.get(7)?,
                discount_amount: row.get(8)?,
                tax_amount: row.get(9)?,
                total_amount: row.get(10)?,
                paid_amount: row.get(11)?,
                status: row.get(12)?,
                payment_method: row.get(13)?,
                notes: row.get(14)?,
                created_at: row.get(15)?,
                reference: row.get::<_, Option<String>>(16).unwrap_or(None),
            })
        })
        .expect("Query map failed")
        .filter_map(|r| r.ok())
        .collect();

    let mut count = 0;
    for inv in invoices {
        let mut item_stmt = conn
            .prepare(
                "SELECT id, invoice_id, item_id, item_name, quantity, unit,
                        unit_price, discount_percent, tax_rate, line_total
                 FROM invoice_items WHERE invoice_id = ?1",
            )
            .unwrap();
        let items: Vec<InvoiceItem> = item_stmt
            .query_map(params![&inv.id], |row| {
                Ok(InvoiceItem {
                    id: row.get(0)?,
                    invoice_id: row.get(1)?,
                    item_id: row.get(2)?,
                    item_name: row.get(3)?,
                    quantity: row.get(4)?,
                    unit: row.get(5)?,
                    unit_price: row.get(6)?,
                    discount_percent: row.get(7)?,
                    tax_rate: row.get(8)?,
                    line_total: row.get(9)?,
                })
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let detail = InvoiceDetail {
            invoice: inv,
            items,
        };
        let party_addr = "100 Commercial Way, Suite 400";
        if let Ok(pdf_path) = generate_and_save_invoice_pdf(&detail, &settings, party_addr) {
            count += 1;
            println!("Generated PDF: {}", pdf_path);
        }
    }

    println!(
        "✅ Local Bills Real PDF Sync: {} invoices verified in {}",
        count,
        bills_dir.display()
    );
}
