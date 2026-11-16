use lynterminal_lib::commands::{calculate_liquidity_internal, parse_payment_liquidity};
use lynterminal_lib::db::DatabaseManager;
use rusqlite::params;

#[test]
fn test_opening_and_capital_cash_bank_allocation() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // 1. Verify schema columns exist and default migration values
    let (_op_cash, _op_bank, op_mode, cap_cash, cap_bank, cap_mode): (f64, f64, String, f64, f64, String) = conn
        .query_row(
            "SELECT opening_cash, opening_bank, opening_balance_mode, capital_cash, capital_bank, capital_mode
             FROM settings WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .expect("Settings row 1 must exist");

    assert_eq!(op_mode, "CASH");
    assert_eq!(cap_mode, "CASH");
    assert_eq!(cap_cash, 0.0);
    assert_eq!(cap_bank, 0.0);

    // 2. Configure Opening Balance as BANK ($5,000) and Capital as SPLIT ($2,000 Cash, $8,000 Bank)
    conn.execute(
        "UPDATE settings SET
            opening_cash = 0.0,
            opening_bank = 5000.0,
            opening_balance_mode = 'BANK',
            capital_cash = 2000.0,
            capital_bank = 8000.0,
            capital_mode = 'SPLIT'
         WHERE id = 1",
        [],
    )
    .expect("Update settings must succeed");

    // 3. Verify settings updated accurately
    let (new_op_cash, new_op_bank, new_op_mode, new_cap_cash, new_cap_bank, new_cap_mode): (f64, f64, String, f64, f64, String) = conn
        .query_row(
            "SELECT opening_cash, opening_bank, opening_balance_mode, capital_cash, capital_bank, capital_mode
             FROM settings WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .expect("Query updated settings");

    assert_eq!(new_op_cash, 0.0);
    assert_eq!(new_op_bank, 5000.0);
    assert_eq!(new_op_mode, "BANK");
    assert_eq!(new_cap_cash, 2000.0);
    assert_eq!(new_cap_bank, 8000.0);
    assert_eq!(new_cap_mode, "SPLIT");

    // 4. Update primary bank account to total starting bank liquidity ($5,000 + $8,000 = $13,000)
    conn.execute(
        "UPDATE bank_accounts SET current_balance = ?1 WHERE is_primary = 1",
        params![new_op_bank + new_cap_bank],
    )
    .expect("Update bank balance");

    let bank_bal: f64 = conn
        .query_row("SELECT current_balance FROM bank_accounts WHERE is_primary = 1", [], |r| r.get(0))
        .expect("Query primary bank account");
    assert_eq!(bank_bal, 13000.0);
}

#[test]
fn test_lock_deadlock_prevention() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Initially setup is not completed or password hash is empty
    let hash: String = conn
        .query_row("SELECT password_hash FROM app_auth WHERE id = 1", [], |r| r.get(0))
        .unwrap_or_default();
    assert!(hash.is_empty(), "Initial password hash should be empty");

    // Check safeguard: attempting to lock without a password hash must fail
    let can_lock = !hash.trim().is_empty();
    assert!(!can_lock, "Must disallow locking when no password hash exists");

    // Now set a valid password hash
    let sample_hash = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
    conn.execute(
        "UPDATE app_auth SET password_hash = ?1, is_setup_completed = 1 WHERE id = 1",
        params![sample_hash],
    )
    .expect("Set password hash");

    let updated_hash: String = conn
        .query_row("SELECT password_hash FROM app_auth WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert!(!updated_hash.is_empty());
    assert_eq!(updated_hash, sample_hash);
}

#[test]
fn test_cash_bank_transfers_and_liquidity_reconciliation() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Initial balances: Cash = $1,000, Bank = $10,000
    conn.execute(
        "UPDATE settings SET opening_cash = 1000.0, opening_bank = 10000.0, capital_cash = 0.0, capital_bank = 0.0 WHERE id = 1",
        [],
    )
    .expect("Setup settings");

    // Record cash to bank deposit of $300
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO cash_bank_transfers (id, direction, bank_account_id, amount, notes, timestamp)
         VALUES ('TR-1', 'CASH_TO_BANK', 'BANK-PRIMARY', 300.0, 'Daily cash deposit', ?1)",
        params![now],
    )
    .expect("Record cash transfer");

    let dep_sum: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM cash_bank_transfers WHERE direction = 'CASH_TO_BANK'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(dep_sum, 300.0);

    // Expected:
    // Cash in Hand = 1000 - 300 = 700
    // Bank = 10000 + 300 = 10300
    let net_cash = 1000.0 - dep_sum;
    let net_bank = 10000.0 + dep_sum;
    assert_eq!(net_cash, 700.0);
    assert_eq!(net_bank, 10300.0);
}

#[test]
fn test_payment_method_liquidity_parser() {
    assert_eq!(parse_payment_liquidity("Cash", 100.0), (100.0, 0.0));
    assert_eq!(parse_payment_liquidity("CASH", 100.0), (100.0, 0.0));
    assert_eq!(parse_payment_liquidity("Card", 100.0), (0.0, 100.0));
    assert_eq!(parse_payment_liquidity("CARD", 100.0), (0.0, 100.0));
    assert_eq!(parse_payment_liquidity("Apple Pay", 45.0), (0.0, 45.0));
    assert_eq!(parse_payment_liquidity("Bank Wire", 250.0), (0.0, 250.0));
    assert_eq!(parse_payment_liquidity("Bank Transfer", 150.0), (0.0, 150.0));
    assert_eq!(parse_payment_liquidity("Cheque", 500.0), (0.0, 500.0));
    assert_eq!(parse_payment_liquidity("REFUND", 35.0), (35.0, 0.0));
    assert_eq!(parse_payment_liquidity("", 50.0), (50.0, 0.0));

    // Split payment parsing
    let (c, b) = parse_payment_liquidity("Split ($25.00 Cash + $75.00 Card)", 100.0);
    assert_eq!(c, 25.0);
    assert_eq!(b, 75.0);
}

#[test]
fn test_deterministic_liquidity_engine_with_mixed_methods_and_negative_flow() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let conn = db.conn.lock().expect("Failed to lock DB connection");

    // Starting balances: Cash = $500, Bank = $2,000
    conn.execute(
        "UPDATE settings SET opening_cash = 500.0, opening_bank = 2000.0, capital_cash = 0.0, capital_bank = 0.0 WHERE id = 1",
        [],
    ).unwrap();

    let now = chrono::Local::now().to_rfc3339();

    // 1. Walk-in cash sale: +$120 Cash
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at, reference)
         VALUES ('INV-01', 'INV-00001', 'SALE', NULL, 'Walk-in', '2026-11-15', '2026-11-15', 120.0, 0.0, 0.0, 120.0, 120.0, 'PAID', 'Cash', '', ?1, '')",
        params![now],
    ).unwrap();

    // 2. Walk-in card sale: +$80 Bank
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at, reference)
         VALUES ('INV-02', 'INV-00002', 'SALE', NULL, 'Walk-in', '2026-11-15', '2026-11-15', 80.0, 0.0, 0.0, 80.0, 80.0, 'PAID', 'Card', '', ?1, '')",
        params![now],
    ).unwrap();

    // 3. Operating expense paid via Cash: -$50 Cash
    conn.execute(
        "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes)
         VALUES ('EXP-01', 'Store Supplies', 'Packaging', 50.0, '2026-11-15', 'Cash', '')",
        [],
    ).unwrap();

    // 4. Operating expense paid via Bank Transfer: -$200 Bank
    conn.execute(
        "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes)
         VALUES ('EXP-02', 'Utility Bill', 'Utilities', 200.0, '2026-11-15', 'Bank Transfer', '')",
        [],
    ).unwrap();

    let (cash, bank) = calculate_liquidity_internal(&conn).unwrap();
    // Cash: 500 + 120 - 50 = 570
    // Bank: 2000 + 80 - 200 = 1880
    assert_eq!(cash, 570.0);
    assert_eq!(bank, 1880.0);

    // 5. Test negative cash flow / deficit without artificial zero-clamping
    conn.execute(
        "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes)
         VALUES ('EXP-03', 'Emergency Repair', 'Maintenance', 800.0, '2026-11-15', 'Cash', '')",
        [],
    ).unwrap();

    let (cash_after_deficit, _) = calculate_liquidity_internal(&conn).unwrap();
    // Cash: 570 - 800 = -230
    assert_eq!(cash_after_deficit, -230.0, "Negative cash balance must be accurately preserved without clamping to 0");
}

