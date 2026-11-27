use lynterminal_lib::commands::{
    calculate_liquidity_internal, convert_estimate_to_invoice_internal, create_invoice_internal,
    create_purchase_return_internal, get_daybook_internal, get_settings_internal,
    next_sequence_number, pay_supplier_bill_internal, record_payment_internal,
    void_or_delete_invoice_internal,
};
use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::gst::{
    get_party_pending_bills_internal, get_sundry_creditors_aging_internal,
    settle_bill_by_bill_internal, BillAllocationPayload, BillSettlementPayload,
};
use lynterminal_lib::models::{
    InvoiceItemPayload, InvoicePayload, Payment, PurchaseReturnPayload, ReceiptPrintLine,
    ReceiptPrintPayload, Settings, SupplierPaymentPayload,
};
use lynterminal_lib::printer::{
    format_escpos_receipt, sanitize_escpos_text, ESC_DRAWER_PULSE, ESC_INIT, GS_CUT_PARTIAL,
};
use rusqlite::params;
use uuid::Uuid;

#[test]
fn test_v170_supplier_payment_fifo_bank_sync_and_credit_aging() {
    let db = DatabaseManager::in_memory().expect("In-memory DB failed");
    let mut conn = db.conn.lock().expect("Lock failed");

    // Configure starting liquidity: 5,000 Cash + 20,000 Bank
    conn.execute(
        "UPDATE settings SET opening_cash = 5000.0, opening_bank = 20000.0 WHERE id = 1",
        [],
    )
    .unwrap();
    conn.execute(
        "UPDATE bank_accounts SET current_balance = 20000.0 WHERE is_primary = 1",
        [],
    )
    .unwrap();

    // Create a VENDOR party
    let vendor_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Metro Wholesale Traders', 'VENDOR', '9800011122', 'billing@metro.test', 'Delhi', '07AABCM1234R1Z5', 0.0, 0.0, '2026-11-01')",
        params![vendor_id],
    )
    .unwrap();

    // Create two unpaid credit PURCHASE invoices: 3,000 and 2,000 (total payable = 5,000)
    let pur1 = create_invoice_internal(
        &mut conn,
        InvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(vendor_id.clone()),
            party_name: "Metro Wholesale Traders".into(),
            invoice_date: "2026-11-05".into(),
            due_date: "2026-11-20".into(),
            subtotal: 3000.0,
            discount_amount: 0.0,
            tax_amount: 0.0,
            total_amount: 3000.0,
            paid_amount: 0.0,
            payment_method: "Credit".into(),
            notes: "Purchase Bill 1".into(),
            reference: None,
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    let pur2 = create_invoice_internal(
        &mut conn,
        InvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(vendor_id.clone()),
            party_name: "Metro Wholesale Traders".into(),
            invoice_date: "2026-11-10".into(),
            due_date: "2026-11-25".into(),
            subtotal: 2000.0,
            discount_amount: 0.0,
            tax_amount: 0.0,
            total_amount: 2000.0,
            paid_amount: 0.0,
            payment_method: "Credit".into(),
            notes: "Purchase Bill 2".into(),
            reference: None,
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    // Vendor balance must be -5000.0
    let v_bal_initial: f64 = conn
        .query_row(
            "SELECT current_balance FROM parties WHERE id = ?1",
            params![vendor_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(v_bal_initial, -5000.0);

    // 1. Lump-sum pay_supplier_bill of 4,000 via UPI without bank_account_id -> must FIFO settle Bill 1 (3000 PAID) & Bill 2 (1000 PARTIAL),
    //    insert bill_settlements, reduce bank by 4,000, and reduce payable to -1,000!
    pay_supplier_bill_internal(
        &mut conn,
        SupplierPaymentPayload {
            invoice_id: None,
            party_id: vendor_id.clone(),
            party_name: "Metro Wholesale Traders".into(),
            amount: 4000.0,
            payment_method: "UPI".into(),
            bank_account_id: None,
            payment_date: Some("2026-11-15".into()),
            reference: "UTR-SUP-4000".into(),
            notes: "Lump sum supplier payment".into(),
        },
    )
    .expect("Lump-sum supplier payment must succeed");

    let (p1_paid, p1_status): (f64, String) = conn
        .query_row(
            "SELECT paid_amount, status FROM invoices WHERE id = ?1",
            params![pur1.invoice.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(p1_paid, 3000.0);
    assert_eq!(p1_status, "PAID");

    let (p2_paid, p2_status): (f64, String) = conn
        .query_row(
            "SELECT paid_amount, status FROM invoices WHERE id = ?1",
            params![pur2.invoice.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(p2_paid, 1000.0);
    assert_eq!(p2_status, "PARTIAL");

    let settlement_cnt: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM bill_settlements WHERE party_id = ?1",
            params![vendor_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(settlement_cnt, 2, "FIFO must create 2 bill_settlements rows");

    let (cash_bal, bank_bal) = calculate_liquidity_internal(&conn).unwrap();
    assert_eq!(cash_bal, 5000.0);
    assert_eq!(bank_bal, 16000.0);

    let pri_bank_bal: f64 = conn
        .query_row(
            "SELECT current_balance FROM bank_accounts WHERE is_primary = 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(pri_bank_bal, 16000.0);

    // 2. Pay remaining 1,000 + 500 advance via Cash record_payment_internal (invoice_id = None) -> vendor becomes +500 advance
    record_payment_internal(
        &mut conn,
        Payment {
            id: "".into(),
            invoice_id: None,
            party_id: vendor_id.clone(),
            party_name: "Metro Wholesale Traders".into(),
            amount: 1500.0,
            payment_type: "OUT".into(),
            payment_method: "CASH".into(),
            payment_date: "2026-11-16".into(),
            reference: "CASH-ADV".into(),
            notes: "Final settle + advance".into(),
            bank_account_id: None,
        },
    )
    .unwrap();

    let (p2_paid_after, p2_status_after): (f64, String) = conn
        .query_row(
            "SELECT paid_amount, status FROM invoices WHERE id = ?1",
            params![pur2.invoice.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(p2_paid_after, 2000.0);
    assert_eq!(p2_status_after, "PAID");

    let v_bal_adv: f64 = conn
        .query_row(
            "SELECT current_balance FROM parties WHERE id = ?1",
            params![vendor_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(v_bal_adv, 500.0, "Vendor should have +500 advance");

    // 3. Sundry creditors aging must report 0 payable for vendor with positive advance balance!
    let creditors = get_sundry_creditors_aging_internal(&conn).unwrap();
    let metro = creditors
        .iter()
        .find(|c| c.party_id == vendor_id)
        .expect("Vendor should appear in creditors list");
    assert_eq!(
        metro.total_outstanding, 0.0,
        "Vendor advance (> 0) must NOT be counted as payable debt"
    );

    let (cash2, bank2) = calculate_liquidity_internal(&conn).unwrap();
    assert_eq!(cash2, 3500.0);
    assert_eq!(bank2, 16000.0);

    // 4. Negative/zero payment validation
    assert!(pay_supplier_bill_internal(
        &mut conn,
        SupplierPaymentPayload {
            invoice_id: None,
            party_id: vendor_id.clone(),
            party_name: "Metro".into(),
            amount: 0.0,
            payment_method: "CASH".into(),
            bank_account_id: None,
            payment_date: None,
            reference: "".into(),
            notes: "".into(),
        }
    )
    .is_err());
}

#[test]
fn test_v170_daybook_salary_double_count_and_expenses_created_at() {
    let db = DatabaseManager::in_memory().expect("In-memory DB failed");
    let mut conn = db.conn.lock().expect("Lock failed");

    conn.execute(
        "UPDATE settings SET opening_cash = 10000.0, opening_bank = 30000.0 WHERE id = 1",
        [],
    )
    .unwrap();

    // Verify expenses.created_at column exists & accepts inserts
    let now = chrono::Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes, created_at)
         VALUES ('EXP-TEST-1', 'Office Supplies', 'Operations', 500.0, '2026-11-17', 'CASH', 'Paper rolls', ?1)",
        params![now],
    )
    .expect("expenses.created_at column must exist");

    // Mirrored salary expense + salary_payments row (just like pay_salary)
    let emp_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO employees (id, name, role, phone, email, monthly_salary, salary_type, status, joining_date, notes, created_at)
         VALUES (?1, 'Asha Cashier', 'Cashier', '9998887776', '', 12000.0, 'MONTHLY', 'ACTIVE', '2026-01-01', '', ?2)",
        params![emp_id, now],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO salary_payments (id, voucher_number, employee_id, employee_name, amount, payment_date, payment_source, for_month, days_present, bonus, deductions, reference, notes, created_at)
         VALUES ('SAL-ID-1', 'SAL-0001', ?1, 'Asha Cashier', 2000.0, '2026-11-17', 'CASH', '2026-11', 26, 0.0, 0.0, '', '', ?2)",
        params![emp_id, now],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, notes, created_at)
         VALUES ('EXP-SAL-1', 'Salary: Asha Cashier', 'Payroll', 2000.0, '2026-11-17', 'CASH', 'Mirror row', ?1)",
        params![now],
    )
    .unwrap();

    // Walk-in POS Sale (1500 Cash) & Walk-in POS UPI Sale (2500 UPI) on 2026-11-17
    create_invoice_internal(
        &mut conn,
        InvoicePayload {
            invoice_type: "SALE".into(),
            party_id: None,
            party_name: "Walk-in Cash".into(),
            invoice_date: "2026-11-17".into(),
            due_date: "2026-11-17".into(),
            subtotal: 1500.0,
            discount_amount: 0.0,
            tax_amount: 0.0,
            total_amount: 1500.0,
            paid_amount: 1500.0,
            payment_method: "Cash".into(),
            notes: "Walk-in Cash".into(),
            reference: None,
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();
    create_invoice_internal(
        &mut conn,
        InvoicePayload {
            invoice_type: "SALE".into(),
            party_id: None,
            party_name: "Walk-in UPI".into(),
            invoice_date: "2026-11-17".into(),
            due_date: "2026-11-17".into(),
            subtotal: 2500.0,
            discount_amount: 0.0,
            tax_amount: 0.0,
            total_amount: 2500.0,
            paid_amount: 2500.0,
            payment_method: "UPI".into(),
            notes: "Walk-in UPI".into(),
            reference: None,
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    // Contra transfer: Cash -> Bank 1000 on 2026-11-17
    conn.execute(
        "INSERT INTO cash_bank_transfers (id, direction, bank_account_id, amount, notes, timestamp)
         VALUES ('TR-1', 'CASH_TO_BANK', 'BANK-PRIMARY', 1000.0, 'Deposit', '2026-11-17T18:00:00+05:30')",
        [],
    )
    .unwrap();

    // Liquidity check: Cash = 10000 - 500 (exp) - 2000 (sal once!) + 1500 (sale) - 1000 (transfer) = 8000
    //                  Bank = 30000 + 2500 (UPI sale) + 1000 (transfer) = 33500
    let (cash_bal, bank_bal) = calculate_liquidity_internal(&conn).unwrap();
    assert_eq!(cash_bal, 8000.0, "Salary must NOT be double-counted");
    assert_eq!(bank_bal, 33500.0);

    // Daybook check: must include walk-in sales, expense, salary, transfer separated by Cash vs Bank
    let entries = get_daybook_internal(&conn, "2026-11-17").unwrap();
    let total_cash_in: f64 = entries.iter().map(|e| e.cash_in).sum();
    let total_cash_out: f64 = entries.iter().map(|e| e.cash_out).sum();
    let total_bank_in: f64 = entries.iter().map(|e| e.bank_in).sum();
    let total_bank_out: f64 = entries.iter().map(|e| e.bank_out).sum();

    assert_eq!(total_cash_in, 1500.0);
    assert_eq!(total_cash_out, 3500.0); // 500 exp + 2000 sal + 1000 contra
    assert_eq!(total_bank_in, 3500.0);  // 2500 UPI sale + 1000 contra
    assert_eq!(total_bank_out, 0.0);
}

#[test]
fn test_v170_purchase_return_tax_void_cancel_and_sequences() {
    let db = DatabaseManager::in_memory().expect("In-memory DB failed");
    let mut conn = db.conn.lock().expect("Lock failed");

    let vendor_id = Uuid::new_v4().to_string();
    let cust_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Supplier One', 'VENDOR', '111', '', '', '', 0.0, 0.0, '2026-11-01'),
                (?2, 'Customer One', 'CUSTOMER', '222', '', '', '', 0.0, 0.0, '2026-11-01')",
        params![vendor_id, cust_id],
    )
    .unwrap();

    // Credit purchase of 1000
    let pur = create_invoice_internal(
        &mut conn,
        InvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(vendor_id.clone()),
            party_name: "Supplier One".into(),
            invoice_date: "2026-11-10".into(),
            due_date: "2026-11-20".into(),
            subtotal: 1000.0,
            discount_amount: 0.0,
            tax_amount: 0.0,
            total_amount: 1000.0,
            paid_amount: 0.0,
            payment_method: "Credit".into(),
            notes: "".into(),
            reference: None,
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    // Purchase return with 10% discount and 18% GST: 2 * 500 = 1000, -10% = 900, +18% = 1062
    let pr = create_purchase_return_internal(
        &mut conn,
        PurchaseReturnPayload {
            party_id: Some(vendor_id.clone()),
            party_name: "Supplier One".into(),
            return_date: "2026-11-12".into(),
            reason: "Defective".into(),
            notes: "".into(),
            items: vec![InvoiceItemPayload {
                item_id: None,
                item_name: "Sensor".into(),
                quantity: 2.0,
                unit: "pcs".into(),
                unit_price: 500.0,
                discount_percent: 10.0,
                tax_rate: 18.0,
                line_total: 1062.0,
            }],
        },
    )
    .unwrap();
    assert_eq!(pr.total_amount, 1062.0);

    // Open purchase invoice should now be marked PAID (1000 settled against 1062 debit note)
    let pur_status: String = conn
        .query_row(
            "SELECT status FROM invoices WHERE id = ?1",
            params![pur.invoice.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(pur_status, "PAID");

    // Credit Sale of 2000 -> settle via settle_bill_by_bill_internal via UPI -> then CANCEL invoice
    let sale = create_invoice_internal(
        &mut conn,
        InvoicePayload {
            invoice_type: "SALE".into(),
            party_id: Some(cust_id.clone()),
            party_name: "Customer One".into(),
            invoice_date: "2026-11-15".into(),
            due_date: "2026-11-30".into(),
            subtotal: 2000.0,
            discount_amount: 0.0,
            tax_amount: 0.0,
            total_amount: 2000.0,
            paid_amount: 0.0,
            payment_method: "Credit".into(),
            notes: "".into(),
            reference: None,
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    // Pending bills filter must only return SALE for CUSTOMER
    let pending = get_party_pending_bills_internal(&conn, &cust_id).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].invoice_type, "SALE");

    settle_bill_by_bill_internal(
        &mut conn,
        BillSettlementPayload {
            party_id: cust_id.clone(),
            party_name: "Customer One".into(),
            total_amount: 1200.0,
            payment_type: "IN".into(),
            payment_method: "UPI".into(),
            payment_date: "2026-11-16".into(),
            reference: "UTR-CANCEL-TEST".into(),
            notes: "".into(),
            bank_account_id: None,
            allocations: vec![BillAllocationPayload {
                invoice_id: sale.invoice.id.clone(),
                amount: 1200.0,
            }],
        },
    )
    .unwrap();

    void_or_delete_invoice_internal(&mut conn, sale.invoice.id.clone(), "CANCEL".into(), "Order cancelled".into()).unwrap();

    let cust_bal_after_cancel: f64 = conn
        .query_row(
            "SELECT current_balance FROM parties WHERE id = ?1",
            params![cust_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(cust_bal_after_cancel, 0.0);

    let (_, bank_after_cancel) = calculate_liquidity_internal(&conn).unwrap();
    assert_eq!(
        bank_after_cancel, 0.0,
        "Cancelled invoice must reverse settle_bill_by_bill parent payment liquidity"
    );

    // Sequence parser must ignore non-numeric suffixes like INV-2026-001
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at)
         VALUES ('INV-LEGACY', 'INV-2026-001', 'SALE', NULL, 'Walk-in', '2026-11-01', '2026-11-01', 10.0, 0.0, 0.0, 10.0, 10.0, 'PAID', 'Cash', '', '2026-11-01')",
        [],
    )
    .unwrap();
    let next_seq = next_sequence_number(&conn, "invoices", "invoice_number", "INV-");
    assert!(next_seq < 2000, "Sequence parser should not jump to year 2026 prefix");

    // Quote conversion records payment + GST metadata when GST active
    conn.execute(
        "UPDATE settings SET currency_code = 'INR', currency_symbol = '₹' WHERE id = 1",
        [],
    )
    .unwrap();
    conn.execute(
        "UPDATE gst_settings SET is_enabled = 1, state_code = '27', state_name = 'Maharashtra' WHERE id = 1",
        [],
    )
    .unwrap();
    let est_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO estimates (id, estimate_number, party_id, party_name, estimate_date, expiry_date, subtotal, tax_amount, total_amount, status, notes, created_at)
         VALUES (?1, 'EST-00001', ?2, 'Customer One', '2026-11-16', '2026-11-30', 1000.0, 180.0, 1180.0, 'SENT', '', '2026-11-16')",
        params![est_id, cust_id],
    )
    .unwrap();
    let conv = convert_estimate_to_invoice_internal(&mut conn, est_id, "UPI".into()).unwrap();
    assert_eq!(conv.status, "PAID");
    let gst_meta_cnt: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM gst_invoices WHERE invoice_id = ?1",
            params![conv.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(gst_meta_cnt, 1, "Estimate conversion should create gst_invoices metadata when GST enabled");
}

#[test]
fn test_v170_escpos_58mm_80mm_and_settings_defaults() {
    let db = DatabaseManager::in_memory().expect("In-memory DB failed");
    let conn = db.conn.lock().expect("Lock failed");
    let mut settings: Settings = get_settings_internal(&conn).expect("Settings must load");
    assert_eq!(settings.printer_type, "BROWSER_DIALOG");
    assert_eq!(settings.paper_width, "80mm");
    assert!(settings.auto_cut);

    settings.currency_symbol = "₹".into();
    settings.currency_code = "INR".into();
    settings.auto_cut = true;
    settings.open_cash_drawer = true;

    let payload = ReceiptPrintPayload {
        invoice_number: "INV-00001".into(),
        invoice_date: "2026-11-27".into(),
        invoice_type: "SALE".into(),
        party_name: "Walk-in Buyer".into(),
        payment_method: "Cash".into(),
        subtotal: 100.0,
        discount_amount: 0.0,
        tax_amount: 18.0,
        round_off: 0.0,
        total_amount: 118.0,
        paid_amount: 118.0,
        items: vec![ReceiptPrintLine {
            name: "Arabica Coffee Beans".into(),
            quantity: 1.0,
            unit_price: 100.0,
            line_total: 100.0,
            tax_rate: Some(18.0),
        }],
        gstin: Some("27AABCU9603R1ZN".into()),
        notes: None,
        paper_width: Some("58mm".into()),
        open_drawer: Some(true),
    };

    let bytes_58 = format_escpos_receipt(&settings, &payload);
    assert!(bytes_58.starts_with(&ESC_INIT));
    assert!(bytes_58.windows(GS_CUT_PARTIAL.len()).any(|w| w == GS_CUT_PARTIAL));
    assert!(bytes_58.windows(ESC_DRAWER_PULSE.len()).any(|w| w == ESC_DRAWER_PULSE));
    let ascii = String::from_utf8_lossy(&bytes_58);
    assert!(ascii.contains("Rs.118.00"), "Rupee symbol must sanitize to Rs. for ESC/POS");
    assert_eq!(sanitize_escpos_text("₹500 — Paid"), "Rs.500 - Paid");
}
