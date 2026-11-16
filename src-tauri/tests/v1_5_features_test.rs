use lynterminal_lib::commands::{
    create_invoice_internal, create_pre_update_backup_internal, get_settings_internal,
    parse_payment_liquidity, record_payment_internal,
};
use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::models::{InvoicePayload, Payment};
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
