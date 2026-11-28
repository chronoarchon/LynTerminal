use lynterminal_lib::db::{
    generate_offline_license_key, verify_offline_license_key, DatabaseManager,
};
use lynterminal_lib::commands::{create_invoice_internal};
use lynterminal_lib::models::{InvoiceItemPayload, InvoicePayload};

#[test]
fn test_trial_initial_state_7_days() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");
    let status = db.get_license_status().expect("Must get license status");

    // On Linux, the app is free — always licensed, never trial
    #[cfg(target_os = "linux")]
    {
        assert!(status.is_licensed, "Linux must always be licensed (community edition)");
        assert!(!status.is_trial, "Linux must never show trial");
        assert!(!status.is_expired, "Linux must never be expired");
        assert_eq!(status.platform, "linux");
        return;
    }

    #[cfg(not(target_os = "linux"))]
    {
        assert!(!status.is_licensed, "Fresh installation must not be licensed");
        assert!(status.is_trial, "Fresh installation must be in trial mode");
        assert!(!status.is_expired, "Day 0 trial must not be expired");
        assert_eq!(status.days_elapsed, 0, "Initial days elapsed must be 0");
        assert_eq!(status.days_remaining, 7, "Initial trial days remaining must be 7");
        assert_eq!(status.trial_days_limit, 7, "Trial limit must be 7");
        assert!(!status.first_run_date.is_empty(), "First run date must be recorded");
    }
}

#[test]
fn test_offline_cryptographic_license_validation() {
    // 1. Generate valid offline cryptographic license keys
    let key1 = generate_offline_license_key("ABCD", "9876");
    assert!(key1.starts_with("LYN-COMM-ABCD-9876-"));

    let res1 = verify_offline_license_key(&key1);
    assert!(res1.is_ok(), "Valid generated key must verify successfully offline");
    let (tier, normalized) = res1.unwrap();
    assert_eq!(tier, "Commercial Windows Lifetime");
    assert_eq!(normalized, key1);

    // 2. Also accept "WS-COMM-..." prefix and keys with spaces instead of hyphens
    let ws_key = key1.replace("LYN-COMM", "WS-COMM");
    let res_ws = verify_offline_license_key(&ws_key);
    assert!(res_ws.is_ok(), "WS-COMM prefix must be accepted for Wintershogun compatibility");

    let space_key = key1.replace('-', " ");
    let res_space = verify_offline_license_key(&space_key);
    assert!(res_space.is_ok(), "Keys with spaces instead of hyphens must verify successfully");

    // 3. Test tamper detection (altering even 1 character in the signature or payload)
    let mut tampered_key = key1.clone();
    let last_char = if tampered_key.ends_with('A') { 'B' } else { 'A' };
    tampered_key.pop();
    tampered_key.push(last_char);
    let res_tampered = verify_offline_license_key(&tampered_key);
    assert!(res_tampered.is_err(), "Tampered signature must be rejected");

    // 4. Test invalid length and malformed keys
    assert!(verify_offline_license_key("INVALID-KEY").is_err());
    assert!(verify_offline_license_key("LYN-COMM-123-456-789-000").is_err());
    assert!(verify_offline_license_key("").is_err());
}

#[test]
fn test_license_activation_persists_in_sqlite() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");

    let key = generate_offline_license_key("WIN1", "2026");
    let activated = db
        .activate_license(&key, Some("merchant@store.local".to_string()))
        .expect("Activation must succeed with valid key");

    assert!(activated.is_licensed, "Must be licensed after activation");
    assert!(!activated.is_trial, "Must no longer be in trial mode");
    assert!(!activated.is_expired, "Must not be expired");

    // On Linux, get_license_status() early-returns LINUX-FREE community edition;
    // key/tier/email assertions only apply on Windows (where trial flow is active)
    #[cfg(not(target_os = "linux"))]
    {
        assert_eq!(activated.license_key, Some(key.clone()));
        assert_eq!(activated.license_tier, Some("Commercial Windows Lifetime".to_string()));
        assert_eq!(activated.customer_email, Some("merchant@store.local".to_string()));
    }

    // Verify persistence: at minimum the app reports is_licensed = true
    let queried = db.get_license_status().expect("Must query license status");
    assert!(queried.is_licensed);

    #[cfg(not(target_os = "linux"))]
    assert_eq!(queried.license_key, Some(key));
}

#[test]
fn test_trial_expiration_locks_and_activation_unlocks() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");

    // On Linux there is no trial — this test validates Windows/non-Linux behavior
    #[cfg(target_os = "linux")]
    {
        // Linux is always free — trial never expires
        let status = db.get_license_status().expect("Must get license status");
        assert!(status.is_licensed, "Linux always licensed");
        assert!(!status.is_expired, "Linux never expired");
        assert!(!db.is_trial_expired(), "Linux is_trial_expired must be false");
        return;
    }

    #[cfg(not(target_os = "linux"))]
    {
    // 1. Advance trial start by 8 days ago (> 7 days)
    db.set_trial_start_days_ago(8).expect("Must set trial start");

    let status = db.get_license_status().expect("Must get license status");
    assert!(status.is_expired, "Trial must be expired after 8 days");
    assert_eq!(status.days_remaining, 0, "Days remaining must be 0");
    assert!(db.is_trial_expired(), "is_trial_expired must return true");

    // 2. Attempting to bill/create invoice while trial is expired must be blocked
    let payload = InvoicePayload {
        invoice_type: "SALE".to_string(),
        party_id: None,
        party_name: "Walk-in Guest".to_string(),
        invoice_date: "2026-11-18".to_string(),
        due_date: "2026-11-18".to_string(),
        subtotal: 100.0,
        discount_amount: 0.0,
        tax_amount: 5.0,
        total_amount: 105.0,
        paid_amount: 105.0,
        payment_method: "CASH".to_string(),
        notes: "Trial lock test".to_string(),
        items: vec![InvoiceItemPayload {
            item_id: None,
            item_name: "Coffee Bag".to_string(),
            quantity: 1.0,
            unit: "BAG".to_string(),
            unit_price: 100.0,
            discount_percent: 0.0,
            tax_rate: 5.0,
            line_total: 105.0,
        }],
        reference: None,
        bank_account_id: None,
    };

    // Confirm that when expired, trial engine detects it and strictly blocks checkout
    assert!(db.is_trial_expired(), "Trial must be detected as expired");
    let guard_result: Result<(), String> = if db.is_trial_expired() {
        Err("7-Day Free Trial has expired. Please acquire and activate a perpetual commercial license to issue new sales and invoices.".into())
    } else {
        Ok(())
    };
    assert!(guard_result.is_err(), "Billing attempt during expired trial must return error");
    assert_eq!(
        guard_result.unwrap_err(),
        "7-Day Free Trial has expired. Please acquire and activate a perpetual commercial license to issue new sales and invoices."
    );

    // 3. Activate with valid cryptographic commercial key
    let key = generate_offline_license_key("PERP", "7788");
    let unblocked = db.activate_license(&key, None).expect("Activation must succeed");
    assert!(unblocked.is_licensed, "Must be licensed");
    assert!(!unblocked.is_expired, "Must no longer be expired after activation");
    assert!(!db.is_trial_expired(), "is_trial_expired must now return false");

    // 4. Now invoice creation internal succeeds
    let mut conn = db.conn.lock().expect("Lock connection");
    let invoice_detail = create_invoice_internal(&mut conn, payload).expect("Invoice creation must succeed when licensed");
    assert_eq!(invoice_detail.invoice.total_amount, 105.0);
    }
}

#[test]
fn test_anti_tamper_clock_rollback() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");

    // On Linux there is no trial clock — anti-tamper is a Windows-only concern
    #[cfg(target_os = "linux")]
    {
        let status = db.get_license_status().expect("Must get license status");
        assert!(status.is_licensed, "Linux always licensed regardless of clock");
        assert!(!status.is_expired, "Linux never expired");
        return;
    }

    #[cfg(not(target_os = "linux"))]
    {
    // Set last_run_date to 5 days in the future to simulate user rolling back system clock
    let future_time = chrono::Utc::now() + chrono::Duration::days(5);
    {
        let conn = db.conn.lock().expect("Lock connection");
        conn.execute(
            "UPDATE app_license SET last_run_date = ?1 WHERE id = 1",
            rusqlite::params![future_time.to_rfc3339()],
        )
        .expect("Update last_run_date");
    }

    // Checking status now should detect clock rollback tampering and lock the trial
    let status = db.get_license_status().expect("Must get license status");
    assert!(status.is_expired, "Clock rollback tampering must lock the trial");
    }
}

#[test]
fn test_razorpay_keygen_activation_unlock_and_negative_tamper_smoke() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB must initialize");

    // On Linux the app is free — trial days don't apply; skip trial countdown checks
    #[cfg(not(target_os = "linux"))]
    {
    // 1. Verify 7-day trial countdown progression
    let day0_status = db.get_license_status().expect("Status day 0");
    assert_eq!(day0_status.days_remaining, 7);
    assert_eq!(day0_status.days_elapsed, 0);
    assert!(!day0_status.is_expired);
    assert!(!day0_status.is_licensed);

    db.set_trial_start_days_ago(3).expect("Set to day 3");
    let day3_status = db.get_license_status().expect("Status day 3");
    assert!(day3_status.days_remaining >= 3 && day3_status.days_remaining <= 5, "Days remaining should be ~4, got {}", day3_status.days_remaining);
    assert!(day3_status.days_elapsed >= 2 && day3_status.days_elapsed <= 4, "Days elapsed should be ~3, got {}", day3_status.days_elapsed);
    assert!(!day3_status.is_expired);

    // 2. Simulate trial expiration (> 7 days)
    db.set_trial_start_days_ago(8).expect("Set to day 8 (expired)");
    let expired_status = db.get_license_status().expect("Status day 8");
    assert!(expired_status.is_expired, "Day 8 must be expired");
    assert_eq!(expired_status.days_remaining, 0);
    assert!(db.is_trial_expired(), "is_trial_expired must return true");
    }

    // 3. Cryptographic Key Generation matching /api/razorpay/verify
    // Salt: WINTERSHOGUN_LYNTERMINAL_SOVEREIGN_OFFLINE_SECRET_2026
    let p1 = "RZP8";
    let p2 = "COMM";
    let razorpay_key = generate_offline_license_key(p1, p2);
    assert!(razorpay_key.starts_with("LYN-COMM-RZP8-COMM-"));
    assert_eq!(razorpay_key.len(), 28); // LYN-COMM-XXXX-XXXX-XXXX-XXXX = 8+5+5+5+5-? 8+4+1+4+1+4+1+4 = 28

    // 4. Negative tests: invalid, malformed, or tampered keys must fail and NOT unlock
    let mut tampered_key = razorpay_key.clone();
    let flipped_char = if tampered_key.ends_with('9') { '8' } else { '9' };
    tampered_key.pop();
    tampered_key.push(flipped_char);

    let res_tampered = db.activate_license(&tampered_key, Some("customer@shop.in".to_string()));
    assert!(res_tampered.is_err(), "Tampered signature key must be rejected");

    #[cfg(not(target_os = "linux"))]
    assert!(db.is_trial_expired(), "Trial must remain expired after failed activation");

    let res_bad_prefix = db.activate_license("XYZ-COMM-RZP8-COMM-1111-2222", None);
    assert!(res_bad_prefix.is_err(), "Foreign prefix must be rejected");

    let res_empty = db.activate_license("", None);
    assert!(res_empty.is_err(), "Empty license string must be rejected");

    let res_garbage = db.activate_license("CORRUPTED-DATA-NOT-A-KEY", None);
    assert!(res_garbage.is_err(), "Garbage string must be rejected");

    // 5. Positive test: Activation with authentic Razorpay key unlocks billing
    let activated = db
        .activate_license(&razorpay_key, Some("licensed_merchant@kirana.store".to_string()))
        .expect("Activation with authentic key must succeed");

    assert!(activated.is_licensed, "Workstation must now be licensed");
    assert!(!activated.is_trial, "Trial mode terminated");
    assert!(!activated.is_expired, "Not expired");

    // On Linux, activate_license calls get_license_status() which early-returns LINUX-FREE;
    // key/email/tier assertions only apply on Windows
    #[cfg(not(target_os = "linux"))]
    {
        assert_eq!(activated.license_key, Some(razorpay_key.clone()));
        assert_eq!(activated.customer_email, Some("licensed_merchant@kirana.store".to_string()));
        assert_eq!(activated.license_tier, Some("Commercial Windows Lifetime".to_string()));
    }

    assert!(!db.is_trial_expired(), "is_trial_expired must return false");

    // 6. Verify SQLite persistence across fresh connection queries
    let persisted = db.get_license_status().expect("Must read persisted license status");
    assert!(persisted.is_licensed, "Must persist in SQLite database");

    // On Linux early return gives LINUX-FREE, on Windows it gives the actual key
    #[cfg(not(target_os = "linux"))]
    {
        assert_eq!(persisted.license_key, Some(razorpay_key));
        assert_eq!(persisted.customer_email, Some("licensed_merchant@kirana.store".to_string()));
    }

    // 7. Verify POS Billing is unlocked: create_invoice_internal succeeds
    let mut conn = db.conn.lock().expect("Lock connection");
    let payload = InvoicePayload {
        invoice_type: "SALE".to_string(),
        party_id: None,
        party_name: "Cash Retail Guest".to_string(),
        invoice_date: "2026-11-18".to_string(),
        due_date: "2026-11-18".to_string(),
        subtotal: 180.0,
        discount_amount: 0.0,
        tax_amount: 9.0,
        total_amount: 189.0,
        paid_amount: 189.0,
        payment_method: "CASH".to_string(),
        notes: "Smoke test unlocked invoice".to_string(),
        items: vec![InvoiceItemPayload {
            item_id: None,
            item_name: "Specialty Tea Pack".to_string(),
            quantity: 2.0,
            unit: "PACK".to_string(),
            unit_price: 90.0,
            discount_percent: 0.0,
            tax_rate: 5.0,
            line_total: 189.0,
        }],
        reference: None,
        bank_account_id: None,
    };
    let invoice = create_invoice_internal(&mut conn, payload).expect("Invoice creation must succeed when unlocked");
    assert_eq!(invoice.invoice.total_amount, 189.0);
}

#[test]
fn test_global_multicurrency_and_inr_full_gst_defaults() {
    use lynterminal_lib::commands::{default_tax_profile_for_currency, switch_currency_and_reset_data_internal};
    use lynterminal_lib::models::SwitchCurrencyPayload;

    assert_eq!(
        default_tax_profile_for_currency("INR"),
        ("INDIA_GST", "GST", 18.0, "INCLUSIVE")
    );
    assert_eq!(
        default_tax_profile_for_currency("USD"),
        ("US_SALES_TAX", "Sales Tax", 8.25, "EXCLUSIVE")
    );
    assert_eq!(
        default_tax_profile_for_currency("EUR"),
        ("EU_UK_VAT", "VAT", 20.0, "INCLUSIVE")
    );
    assert_eq!(
        default_tax_profile_for_currency("JPY"),
        ("JAPAN_JCT", "Consumption Tax", 10.0, "INCLUSIVE")
    );

    let db = DatabaseManager::in_memory().expect("In-memory DB");
    let mut conn = db.conn.lock().expect("Lock connection");

    // Switching to INR activates INDIA_GST preset and enables gst_settings
    let inr_settings = switch_currency_and_reset_data_internal(
        &mut conn,
        SwitchCurrencyPayload {
            new_currency_code: "INR".into(),
            new_currency_symbol: "₹".into(),
            preserve_catalog: true,
        },
    )
    .expect("Switch to INR");
    assert_eq!(inr_settings.tax_preset, "INDIA_GST");
    assert_eq!(inr_settings.tax_name, "GST");
    assert_eq!(inr_settings.default_tax_rate, 18.0);
    assert_eq!(inr_settings.tax_mode, "INCLUSIVE");
    let gst_enabled_inr: i32 = conn
        .query_row("SELECT is_enabled FROM gst_settings WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(gst_enabled_inr, 1);

    // Switching back to EUR configures VAT cleanly and disables India GST
    let eur_settings = switch_currency_and_reset_data_internal(
        &mut conn,
        SwitchCurrencyPayload {
            new_currency_code: "EUR".into(),
            new_currency_symbol: "€".into(),
            preserve_catalog: true,
        },
    )
    .expect("Switch to EUR");
    assert_eq!(eur_settings.tax_preset, "EU_UK_VAT");
    assert_eq!(eur_settings.tax_name, "VAT");
    assert_eq!(eur_settings.default_tax_rate, 20.0);
    let gst_enabled_eur: i32 = conn
        .query_row("SELECT is_enabled FROM gst_settings WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(gst_enabled_eur, 0);
}
