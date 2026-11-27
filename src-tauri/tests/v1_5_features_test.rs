use lynterminal_lib::commands::{
    calculate_liquidity_internal, create_invoice_internal, create_pre_update_backup_internal,
    get_settings_internal, parse_payment_liquidity, record_deposit_internal, record_payment_internal,
    transfer_cash_bank_internal,
};
use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::models::{DepositPayload, InvoicePayload, Payment};
use rusqlite::params;
use uuid::Uuid;

#[test]
fn test_custom_payment_methods_schema_and_defaults() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // 1. Verify default values from get_settings_internal
    let settings = get_settings_internal(&conn).expect("get_settings_internal must succeed");
    assert_eq!(settings.custom_payment_1_name, "UPI");
    assert_eq!(settings.custom_payment_1_enabled, false);
    assert_eq!(settings.custom_payment_2_name, "Bank Transfer");
    assert_eq!(settings.custom_payment_2_enabled, false);

    // 2. Update custom payment methods to custom user values (e.g. Google Pay and AliPay)
    conn.execute(
        "UPDATE settings SET
            custom_payment_1_name = 'Google Pay',
            custom_payment_1_enabled = 1,
            custom_payment_2_name = 'AliPay',
            custom_payment_2_enabled = 1
         WHERE id = 1",
        [],
    )
    .expect("Update custom payments in settings");

    // 3. Verify get_settings_internal reflects new values
    let updated = get_settings_internal(&conn).expect("Query updated settings");
    assert_eq!(updated.custom_payment_1_name, "Google Pay");
    assert_eq!(updated.custom_payment_1_enabled, true);
    assert_eq!(updated.custom_payment_2_name, "AliPay");
    assert_eq!(updated.custom_payment_2_enabled, true);
}

#[test]
fn test_credit_bill_creation_and_partial_and_full_settlement() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let mut conn = db.conn.lock().expect("Failed to lock DB connection");

    // 1. Create a customer party in DB
    let customer_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Rajesh Patel', 'CUSTOMER', '9876543210', 'rajesh@example.com', 'Mumbai', 'GSTIN999', 0.0, 0.0, '2026-11-16')",
        params![customer_id],
    )
    .expect("Insert customer");

    // 2. Create full credit sale invoice using actual create_invoice_internal command
    let credit_payload = InvoicePayload {
        invoice_type: "SALE".to_string(),
        party_id: Some(customer_id.clone()),
        party_name: "Rajesh Patel".to_string(),
        invoice_date: "2026-11-16".to_string(),
        due_date: "2026-11-30".to_string(),
        subtotal: 1000.0,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: 1000.0,
        paid_amount: 0.0,
        payment_method: "Credit (Udhaar)".to_string(),
        notes: "Customer Credit / Udhaar Bill".to_string(),
        reference: None,
        bank_account_id: None,
        items: vec![],
    };

    let inv_detail = create_invoice_internal(&mut conn, credit_payload).expect("Create credit invoice");
    assert_eq!(inv_detail.invoice.status, "CREDIT");
    assert_eq!(inv_detail.invoice.paid_amount, 0.0);
    assert_eq!(inv_detail.invoice.total_amount, 1000.0);

    // Customer receivable balance must now be 1000.0
    let cust_bal: f64 = conn
        .query_row("SELECT current_balance FROM parties WHERE id = ?1", params![customer_id], |r| r.get(0))
        .expect("Query customer balance");
    assert_eq!(cust_bal, 1000.0);

    // 3. First payment: Customer pays $400 via real record_payment_internal (partial settlement via Google Pay)
    let pay1 = Payment {
        id: "".to_string(),
        invoice_id: Some(inv_detail.invoice.id.clone()),
        party_id: customer_id.clone(),
        party_name: "Rajesh Patel".to_string(),
        amount: 400.0,
        payment_type: "IN".to_string(),
        payment_method: "Google Pay".to_string(),
        payment_date: "2026-11-16".to_string(),
        reference: "CR-SETTLE-01".to_string(),
        notes: "Partial payment via Google Pay".to_string(),
        bank_account_id: None,
    };

    let recorded_pay1 = record_payment_internal(&mut conn, pay1).expect("Record payment 1");
    assert!(!recorded_pay1.id.is_empty());

    // Verify invoice status transitioned to PARTIAL and paid_amount is 400
    let (paid_amt, status): (f64, String) = conn
        .query_row("SELECT paid_amount, status FROM invoices WHERE id = ?1", params![inv_detail.invoice.id], |r| Ok((r.get(0)?, r.get(1)?)))
        .expect("Query invoice after pay 1");
    assert_eq!(paid_amt, 400.0);
    assert_eq!(status, "PARTIAL");

    // Customer balance must be reduced to 600.0
    let cust_bal2: f64 = conn
        .query_row("SELECT current_balance FROM parties WHERE id = ?1", params![customer_id], |r| r.get(0))
        .expect("Query balance after pay 1");
    assert_eq!(cust_bal2, 600.0);

    // Verify digital method liquidity routing for Google Pay
    let (c, b) = parse_payment_liquidity("Google Pay", 400.0);
    assert_eq!(c, 0.0);
    assert_eq!(b, 400.0);

    // 4. Second payment: Customer clears the remaining $600 via real record_payment_internal (Full settlement via Cash)
    let pay2 = Payment {
        id: "".to_string(),
        invoice_id: Some(inv_detail.invoice.id.clone()),
        party_id: customer_id.clone(),
        party_name: "Rajesh Patel".to_string(),
        amount: 600.0,
        payment_type: "IN".to_string(),
        payment_method: "CASH".to_string(),
        payment_date: "2026-11-16".to_string(),
        reference: "CR-SETTLE-02".to_string(),
        notes: "Final 100% settlement".to_string(),
        bank_account_id: None,
    };

    let recorded_pay2 = record_payment_internal(&mut conn, pay2).expect("Record payment 2");
    assert!(!recorded_pay2.id.is_empty());

    // Verify after final payment: Status is PAID, balance is 0
    let (final_paid, final_status): (f64, String) = conn
        .query_row("SELECT paid_amount, status FROM invoices WHERE id = ?1", params![inv_detail.invoice.id], |r| Ok((r.get(0)?, r.get(1)?)))
        .expect("Query invoice after pay 2");
    assert_eq!(final_paid, 1000.0);
    assert_eq!(final_status, "PAID");

    let cust_bal3: f64 = conn
        .query_row("SELECT current_balance FROM parties WHERE id = ?1", params![customer_id], |r| r.get(0))
        .expect("Query balance after pay 2");
    assert_eq!(cust_bal3, 0.0);

    // 5. Test Half Paid / Half Credit bill creation
    let half_credit_payload = InvoicePayload {
        invoice_type: "SALE".to_string(),
        party_id: Some(customer_id.clone()),
        party_name: "Rajesh Patel".to_string(),
        invoice_date: "2026-11-16".to_string(),
        due_date: "2026-11-30".to_string(),
        subtotal: 500.0,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: 500.0,
        paid_amount: 250.0,
        payment_method: "Partial Credit ($250.00 Cash + $250.00 Credit)".to_string(),
        notes: "Customer Credit / Udhaar Bill".to_string(),
        reference: None,
        bank_account_id: None,
        items: vec![],
    };

    let half_inv = create_invoice_internal(&mut conn, half_credit_payload).expect("Create half credit invoice");
    assert_eq!(half_inv.invoice.status, "PARTIAL");
    assert_eq!(half_inv.invoice.paid_amount, 250.0);
    assert_eq!(half_inv.invoice.total_amount, 500.0);

    // Customer balance must now be the unpaid 250.0
    let cust_bal4: f64 = conn
        .query_row("SELECT current_balance FROM parties WHERE id = ?1", params![customer_id], |r| r.get(0))
        .expect("Query customer balance after half credit");
    assert_eq!(cust_bal4, 250.0);

    // Check partial credit liquidity parsing
    let (split_c, split_b) = parse_payment_liquidity("Partial Credit ($250.00 Cash + $250.00 Credit)", 250.0);
    assert_eq!(split_c, 250.0);
    assert_eq!(split_b, 0.0);
}

#[test]
fn test_pre_update_backup_safe_vacuum_repeated_calls() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Calling create_pre_update_backup_internal twice in rapid succession must succeed
    // without "VACUUM INTO error: output file already exists"
    let backup1 = create_pre_update_backup_internal(&conn, "1.5.0").expect("Backup 1 must succeed");
    let backup2 = create_pre_update_backup_internal(&conn, "1.5.0").expect("Backup 2 must succeed");

    assert!(std::path::Path::new(&backup1).exists());
    assert!(std::path::Path::new(&backup2).exists());

    // Clean up temporary backup files
    let _ = std::fs::remove_file(backup1);
    let _ = std::fs::remove_file(backup2);
}

#[test]
fn test_liquidity_routing_cash_bank_credit_and_partial() {
    // 1. Pure Cash goes strictly to cash drawer
    assert_eq!(parse_payment_liquidity("Cash", 1500.0), (1500.0, 0.0));
    assert_eq!(parse_payment_liquidity("CASH", 500.0), (500.0, 0.0));
    assert_eq!(parse_payment_liquidity("cash drawer", 250.0), (250.0, 0.0));

    // 2. Pure Bank / Electronic tenders go strictly to bank
    assert_eq!(parse_payment_liquidity("UPI", 1000.0), (0.0, 1000.0));
    assert_eq!(parse_payment_liquidity("Card", 2000.0), (0.0, 2000.0));
    assert_eq!(parse_payment_liquidity("Credit Card", 3000.0), (0.0, 3000.0));
    assert_eq!(parse_payment_liquidity("Debit Card", 1200.0), (0.0, 1200.0));
    assert_eq!(parse_payment_liquidity("Bank Transfer", 4500.0), (0.0, 4500.0));
    assert_eq!(parse_payment_liquidity("NEFT", 8000.0), (0.0, 8000.0));
    assert_eq!(parse_payment_liquidity("RTGS", 250000.0), (0.0, 250000.0));
    assert_eq!(parse_payment_liquidity("IMPS", 5000.0), (0.0, 5000.0));
    assert_eq!(parse_payment_liquidity("QR Code", 750.0), (0.0, 750.0));
    assert_eq!(parse_payment_liquidity("NetBanking", 6200.0), (0.0, 6200.0));
    assert_eq!(parse_payment_liquidity("Digital Wallet", 350.0), (0.0, 350.0));
    assert_eq!(parse_payment_liquidity("Google Pay", 900.0), (0.0, 900.0));
    assert_eq!(parse_payment_liquidity("PhonePe", 1100.0), (0.0, 1100.0));
    assert_eq!(parse_payment_liquidity("Paytm", 450.0), (0.0, 450.0));

    // 3. Pure Credit / Udhaar provides strictly 0 cash and 0 bank
    assert_eq!(parse_payment_liquidity("Credit", 5000.0), (0.0, 0.0));
    assert_eq!(parse_payment_liquidity("CREDIT", 5000.0), (0.0, 0.0));
    assert_eq!(parse_payment_liquidity("Credit (Udhaar)", 5000.0), (0.0, 0.0));
    assert_eq!(parse_payment_liquidity("Credit (30 Days)", 5000.0), (0.0, 0.0));
    assert_eq!(parse_payment_liquidity("Credit (15 Days)", 2500.0), (0.0, 0.0));
    assert_eq!(parse_payment_liquidity("Udhaar", 1200.0), (0.0, 0.0));
    assert_eq!(parse_payment_liquidity("Customer Credit", 3400.0), (0.0, 0.0));

    // 4. Partial Credit (Paid tender enters cash/bank, credit portion contributes 0)
    // UPI + Credit partial tender with Rupee symbol
    assert_eq!(
        parse_payment_liquidity("Partial Credit (₹4307.00 UPI + ₹4307.00 Credit)", 4307.0),
        (0.0, 4307.0)
    );
    // Cash + Credit partial tender with Rupee symbol
    assert_eq!(
        parse_payment_liquidity("Partial Credit (₹4307.00 Cash + ₹4307.00 Credit)", 4307.0),
        (4307.0, 0.0)
    );
    // Dollar partial credit
    assert_eq!(
        parse_payment_liquidity("Partial Credit ($250.00 Cash + $250.00 Credit)", 250.0),
        (250.0, 0.0)
    );
    assert_eq!(
        parse_payment_liquidity("Partial Credit ($100.00 Card + $400.00 Credit)", 100.0),
        (0.0, 100.0)
    );

    // 5. Standard split between cash and bank
    assert_eq!(
        parse_payment_liquidity("Split ($25.00 Cash + $75.00 Card)", 100.0),
        (25.0, 75.0)
    );
}

#[test]
fn test_deposit_money_cash_bank_capital() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // 1. Initial zero balances
    let (c0, b0) = calculate_liquidity_internal(&conn).expect("Liquidity calculation");
    assert_eq!(c0, 0.0);
    assert_eq!(b0, 0.0);

    // 2. Deposit $500 to Cash Drawer
    let dep_cash = DepositPayload {
        destination: "CASH".to_string(),
        amount: 500.0,
        source: "Owner Investment".to_string(),
        reference: "DEP-001".to_string(),
        date: "2026-11-17".to_string(),
        bank_account_id: None,
        notes: "Starting cash drawer float".to_string(),
    };
    let (c1, b1) = record_deposit_internal(&conn, &dep_cash).expect("Deposit to cash must succeed");
    assert_eq!(c1, 500.0);
    assert_eq!(b1, 0.0);

    // 3. Deposit $2000 to Bank Account
    let dep_bank = DepositPayload {
        destination: "BANK".to_string(),
        amount: 2000.0,
        source: "Bank Transfer Inflow".to_string(),
        reference: "DEP-002".to_string(),
        date: "2026-11-17".to_string(),
        bank_account_id: None,
        notes: "Direct capital deposit to bank".to_string(),
    };
    let (c2, b2) = record_deposit_internal(&conn, &dep_bank).expect("Deposit to bank must succeed");
    assert_eq!(c2, 500.0);
    assert_eq!(b2, 2000.0);

    // 4. Deposit $1000 to Owner Capital
    let dep_cap = DepositPayload {
        destination: "CAPITAL".to_string(),
        amount: 1000.0,
        source: "Partner Equity".to_string(),
        reference: "DEP-003".to_string(),
        date: "2026-11-17".to_string(),
        bank_account_id: None,
        notes: "Equity addition".to_string(),
    };
    let (c3, b3) = record_deposit_internal(&conn, &dep_cap).expect("Deposit to capital must succeed");
    assert_eq!(c3, 1500.0);
    assert_eq!(b2, 2000.0);
    assert_eq!(b3, 2000.0);

    // 5. Verify audit logs recorded every deposit
    let audit_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM audit_logs WHERE action IN ('DEPOSIT', 'CAPITAL_INJECTION')",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(audit_count, 3);
}

#[test]
fn test_contra_transfer_cash_to_bank_and_bank_to_cash() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Initialize with Cash = $1000, Bank = $2000
    conn.execute(
        "UPDATE settings SET opening_cash = 1000.0, opening_bank = 2000.0 WHERE id = 1",
        [],
    )
    .expect("Setup settings");

    // 1. Transfer $400 from Cash Drawer to Bank Account
    let ok1 = transfer_cash_bank_internal(
        &conn,
        "CASH_TO_BANK",
        "BANK-PRIMARY",
        400.0,
        "Daily cash drop",
    )
    .expect("Contra transfer cash to bank");
    assert!(ok1);

    let (c1, b1) = calculate_liquidity_internal(&conn).unwrap();
    assert_eq!(c1, 600.0);
    assert_eq!(b1, 2400.0);

    // 2. Transfer $150 from Bank Account to Cash Drawer
    let ok2 = transfer_cash_bank_internal(
        &conn,
        "BANK_TO_CASH",
        "BANK-PRIMARY",
        150.0,
        "ATM drawer float withdrawal",
    )
    .expect("Contra transfer bank to cash");
    assert!(ok2);

    let (c2, b2) = calculate_liquidity_internal(&conn).unwrap();
    assert_eq!(c2, 750.0);
    assert_eq!(b2, 2250.0);

    // Total net liquidity is invariant during contra transfers: 750 + 2250 == 3000
    assert_eq!(c2 + b2, 3000.0);
}

#[test]
fn test_database_indexes_performance_and_query_plans() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Verify index on invoices (created_at, invoice_date, status, party_id)
    let inv_plan: String = conn
        .query_row(
            "EXPLAIN QUERY PLAN SELECT id FROM invoices WHERE status = 'PAID' AND invoice_date >= '2026-01-01'",
            [],
            |r| r.get(3),
        )
        .unwrap_or_default();
    assert!(inv_plan.contains("USING INDEX idx_invoices_status"));

    // Verify index on payments (payment_date, party_id)
    let pmt_plan: String = conn
        .query_row(
            "EXPLAIN QUERY PLAN SELECT id FROM payments WHERE payment_date >= '2026-01-01'",
            [],
            |r| r.get(3),
        )
        .unwrap_or_default();
    assert!(pmt_plan.contains("USING INDEX idx_payments_date"));

    // Verify index on expenses (expense_date)
    let exp_plan: String = conn
        .query_row(
            "EXPLAIN QUERY PLAN SELECT id FROM expenses WHERE expense_date >= '2026-01-01'",
            [],
            |r| r.get(3),
        )
        .unwrap_or_default();
    assert!(exp_plan.contains("USING INDEX idx_expenses_date"));
}

#[test]
fn test_multi_bank_account_transfer_isolation() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Initialize with Cash = $1000, Bank = $1500
    conn.execute(
        "UPDATE settings SET opening_cash = 1000.0, opening_bank = 1500.0 WHERE id = 1",
        [],
    )
    .expect("Setup settings");

    // Configure primary bank account ($1000) and insert secondary bank account ($500)
    conn.execute(
        "UPDATE bank_accounts SET current_balance = 1000.0, is_primary = 1 WHERE id = 'BANK-PRIMARY'",
        [],
    )
    .expect("Update primary account");

    conn.execute(
        "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, is_primary, created_at)
         VALUES ('BANK-SECONDARY', 'Reserve Savings Account', 'Wells Fargo', '0002', 500.0, 0, '2026-11-17')",
        [],
    )
    .expect("Insert secondary account");

    // Transfer $200 from Cash Drawer specifically into BANK-SECONDARY
    let ok = transfer_cash_bank_internal(
        &conn,
        "CASH_TO_BANK",
        "BANK-SECONDARY",
        200.0,
        "Reserve funding",
    )
    .expect("Transfer to secondary account must succeed");
    assert!(ok);

    // Verify secondary account balance increased to 700.0
    let bal_sec: f64 = conn
        .query_row(
            "SELECT current_balance FROM bank_accounts WHERE id = 'BANK-SECONDARY'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(bal_sec, 700.0);

    // CRITICAL: Verify primary account was NOT touched (must remain 1000.0, NOT 1200.0)
    let bal_pri: f64 = conn
        .query_row(
            "SELECT current_balance FROM bank_accounts WHERE id = 'BANK-PRIMARY'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(bal_pri, 1000.0);

    // Now withdraw $150 from BANK-SECONDARY to Cash Drawer
    let ok2 = transfer_cash_bank_internal(
        &conn,
        "BANK_TO_CASH",
        "BANK-SECONDARY",
        150.0,
        "Withdraw reserve to float",
    )
    .expect("Withdrawal must succeed");
    assert!(ok2);

    let bal_sec2: f64 = conn
        .query_row(
            "SELECT current_balance FROM bank_accounts WHERE id = 'BANK-SECONDARY'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(bal_sec2, 550.0);

    // Primary account must STILL be completely untouched at 1000.0
    let bal_pri2: f64 = conn
        .query_row(
            "SELECT current_balance FROM bank_accounts WHERE id = 'BANK-PRIMARY'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(bal_pri2, 1000.0);
}

#[test]
fn test_deposit_validation_and_bank_capital_mode() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // 1. Negative amount must be rejected
    let bad_dep = DepositPayload {
        destination: "CASH".to_string(),
        amount: -50.0,
        source: "Invalid".to_string(),
        reference: "BAD-01".to_string(),
        date: "2026-11-17".to_string(),
        bank_account_id: None,
        notes: "Should fail".to_string(),
    };
    assert!(record_deposit_internal(&conn, &bad_dep).is_err());

    // 2. Zero amount must be rejected
    let zero_dep = DepositPayload {
        destination: "BANK".to_string(),
        amount: 0.0,
        source: "Zero".to_string(),
        reference: "ZERO-01".to_string(),
        date: "2026-11-17".to_string(),
        bank_account_id: None,
        notes: "Should fail".to_string(),
    };
    assert!(record_deposit_internal(&conn, &zero_dep).is_err());

    // 3. Capital deposit when capital_mode = 'BANK'
    conn.execute(
        "UPDATE settings SET capital_mode = 'BANK', capital_cash = 0.0, capital_bank = 0.0 WHERE id = 1",
        [],
    )
    .unwrap();

    let cap_dep = DepositPayload {
        destination: "CAPITAL".to_string(),
        amount: 750.0,
        source: "Bank Equity Wire".to_string(),
        reference: "WIRE-750".to_string(),
        date: "2026-11-17".to_string(),
        bank_account_id: None,
        notes: "Capital injection via wire".to_string(),
    };
    let (cash_bal, bank_bal) = record_deposit_internal(&conn, &cap_dep).expect("Deposit succeeds");
    assert_eq!(cash_bal, 0.0);
    assert_eq!(bank_bal, 750.0);

    let (cap_cash, cap_bank): (f64, f64) = conn
        .query_row(
            "SELECT capital_cash, capital_bank FROM settings WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(cap_cash, 0.0);
    assert_eq!(cap_bank, 750.0);
}
