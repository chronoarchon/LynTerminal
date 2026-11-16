use lynterminal_lib::commands::{
    create_pre_update_backup_internal, get_settings_internal,
};
use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::models::Payment;
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

    // 1. Create a customer party
    let customer_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Rajesh Patel', 'CUSTOMER', '9876543210', 'rajesh@example.com', 'Mumbai', 'GSTIN999', 0.0, 0.0, '2026-11-16')",
        params![customer_id],
    )
    .expect("Insert customer");

    // 2. Insert a credit sale invoice (Total $1,000, Paid $0, Status 'CREDIT')
    let invoice_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date,
                              subtotal, discount_amount, tax_amount, total_amount, paid_amount,
                              status, payment_method, notes, created_at)
         VALUES (?1, 'INV-CR-001', 'SALE', ?2, 'Rajesh Patel', '2026-11-16', '2026-11-30',
                 1000.0, 0.0, 0.0, 1000.0, 0.0, 'CREDIT', 'CREDIT', 'Half credit sale', '2026-11-16 10:00:00')",
        params![invoice_id, customer_id],
    )
    .expect("Insert credit invoice");

    // Customer balance reflects unpaid portion
    conn.execute(
        "UPDATE parties SET current_balance = current_balance + 1000.0 WHERE id = ?1",
        params![customer_id],
    )
    .expect("Update customer receivable balance");

    let cust_bal: f64 = conn
        .query_row("SELECT current_balance FROM parties WHERE id = ?1", params![customer_id], |r| r.get(0))
        .expect("Query customer balance");
    assert_eq!(cust_bal, 1000.0);

    // 3. First payment: Customer pays $400 (partial settlement via Google Pay)
    {
        let tx = conn.transaction().expect("Start tx");
        let pay1 = Payment {
            id: Uuid::new_v4().to_string(),
            invoice_id: Some(invoice_id.clone()),
            party_id: customer_id.clone(),
            party_name: "Rajesh Patel".to_string(),
            amount: 400.0,
            payment_type: "IN".to_string(),
            payment_method: "Google Pay".to_string(),
            payment_date: "2026-11-16".to_string(),
            reference: "CR-SETTLE-01".to_string(),
            notes: "Partial payment".to_string(),
        };

        // Record payment row
        tx.execute(
            "INSERT INTO payments (id, invoice_id, party_id, party_name, amount, payment_type, payment_method, payment_date, reference, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![pay1.id, pay1.invoice_id, pay1.party_id, pay1.party_name, pay1.amount, pay1.payment_type, pay1.payment_method, pay1.payment_date, pay1.reference, pay1.notes],
        ).expect("Insert payment 1");

        // Reduce party balance
        tx.execute("UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2", params![pay1.amount, pay1.party_id]).expect("Reduce party balance");

        // Update invoice paid & status
        let (total, paid): (f64, f64) = tx.query_row(
            "SELECT total_amount, paid_amount FROM invoices WHERE id = ?1",
            params![invoice_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).expect("Query inv");
        let new_paid = paid + pay1.amount;
        let new_status = if new_paid >= total - 0.001 { "PAID" } else if new_paid > 0.0 { "PARTIAL" } else { "UNPAID" };
        tx.execute("UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3", params![new_paid, new_status, invoice_id]).expect("Update invoice");

        tx.commit().expect("Commit tx 1");
    }

    // Verify after partial payment
    let (paid_amt, status): (f64, String) = conn
        .query_row("SELECT paid_amount, status FROM invoices WHERE id = ?1", params![invoice_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .expect("Query invoice after pay 1");
    assert_eq!(paid_amt, 400.0);
    assert_eq!(status, "PARTIAL");

    let cust_bal2: f64 = conn
        .query_row("SELECT current_balance FROM parties WHERE id = ?1", params![customer_id], |r| r.get(0))
        .expect("Query balance after pay 1");
    assert_eq!(cust_bal2, 600.0);

    // 4. Second payment: Customer clears the remaining $600 (Full settlement via Cash)
    {
        let tx = conn.transaction().expect("Start tx");
        let pay2 = Payment {
            id: Uuid::new_v4().to_string(),
            invoice_id: Some(invoice_id.clone()),
            party_id: customer_id.clone(),
            party_name: "Rajesh Patel".to_string(),
            amount: 600.0,
            payment_type: "IN".to_string(),
            payment_method: "CASH".to_string(),
            payment_date: "2026-11-16".to_string(),
            reference: "CR-SETTLE-02".to_string(),
            notes: "Final 100% settlement".to_string(),
        };

        tx.execute(
            "INSERT INTO payments (id, invoice_id, party_id, party_name, amount, payment_type, payment_method, payment_date, reference, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![pay2.id, pay2.invoice_id, pay2.party_id, pay2.party_name, pay2.amount, pay2.payment_type, pay2.payment_method, pay2.payment_date, pay2.reference, pay2.notes],
        ).expect("Insert payment 2");

        tx.execute("UPDATE parties SET current_balance = current_balance - ?1 WHERE id = ?2", params![pay2.amount, pay2.party_id]).expect("Reduce party balance");

        let (total, paid): (f64, f64) = tx.query_row(
            "SELECT total_amount, paid_amount FROM invoices WHERE id = ?1",
            params![invoice_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).expect("Query inv");
        let new_paid = paid + pay2.amount;
        let new_status = if new_paid >= total - 0.001 { "PAID" } else if new_paid > 0.0 { "PARTIAL" } else { "UNPAID" };
        tx.execute("UPDATE invoices SET paid_amount = ?1, status = ?2 WHERE id = ?3", params![new_paid, new_status, invoice_id]).expect("Update invoice");

        tx.commit().expect("Commit tx 2");
    }

    // Verify after final payment: Status is PAID, balance is 0
    let (final_paid, final_status): (f64, String) = conn
        .query_row("SELECT paid_amount, status FROM invoices WHERE id = ?1", params![invoice_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .expect("Query invoice after pay 2");
    assert_eq!(final_paid, 1000.0);
    assert_eq!(final_status, "PAID");

    let cust_bal3: f64 = conn
        .query_row("SELECT current_balance FROM parties WHERE id = ?1", params![customer_id], |r| r.get(0))
        .expect("Query balance after pay 2");
    assert_eq!(cust_bal3, 0.0);
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
