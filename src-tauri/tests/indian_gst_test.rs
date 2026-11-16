use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::gst::*;
use rusqlite::params;
use uuid::Uuid;

#[test]
fn test_gst_settings_defaults_and_update() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB failed");
    let conn = db.conn.lock().expect("Lock connection failed");

    // 1. Check default settings
    let settings = get_gst_settings_internal(&conn).expect("get_gst_settings failed");
    assert_eq!(settings.is_enabled, true);
    assert_eq!(settings.state_code, "27");
    assert_eq!(settings.state_name, "Maharashtra");
    assert_eq!(settings.gstin, "27AABCU9603R1ZN");
    assert_eq!(settings.bank_name, "HDFC Bank");

    // 2. Update settings for Karnataka business
    let updated = GstSettings {
        is_enabled: true,
        gstin: "29ABCDE1234F1ZW".into(),
        legal_name: "Bangalore Tech Sol Pvt Ltd".into(),
        trade_name: "Bangalore Tech Hub".into(),
        state_code: "29".into(),
        state_name: "Karnataka".into(),
        pan: "ABCDE1234F".into(),
        gst_composition: false,
        einvoice_enabled: true,
        eway_bill_threshold: 50000.0,
        lut_number: "LUT/2026-27/001".into(),
        bank_name: "State Bank of India".into(),
        bank_account_no: "110022334455".into(),
        bank_ifsc: "SBIN0001234".into(),
        bank_branch: "MG Road, Bengaluru".into(),
        upi_id: "bangaloretech@oksbi".into(),
    };

    let saved = save_gst_settings_internal(&conn, updated).expect("save_gst_settings failed");
    assert_eq!(saved.state_code, "29");
    assert_eq!(saved.state_name, "Karnataka");

    let re_fetched = get_gst_settings_internal(&conn).expect("re-fetch failed");
    assert_eq!(re_fetched.gstin, "29ABCDE1234F1ZW");
    assert_eq!(re_fetched.legal_name, "Bangalore Tech Sol Pvt Ltd");
    assert_eq!(re_fetched.bank_ifsc, "SBIN0001234");
}

#[test]
fn test_sundry_debtors_and_creditors_profiles() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB failed");
    let conn = db.conn.lock().expect("Lock connection failed");

    let customer_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Apex Infotech India', 'CUSTOMER', '9876543210', 'info@apex.in', 'Electronic City, Bengaluru', '', 0.0, 0.0, '2026-11-16')",
        params![customer_id],
    ).unwrap();

    // Save GST party profile with Credit Limit and Terms (Sundry Debtors)
    let profile = GstPartyProfile {
        party_id: customer_id.clone(),
        gstin: "29AABCA1111A1ZN".into(),
        state_code: "29".into(),
        state_name: "Karnataka".into(),
        pan: "AABCA1111A".into(),
        gst_type: "REGULAR".into(),
        credit_limit: 100000.0, // ₹1,00,000 credit limit
        credit_period_days: 30,  // 30 days credit period
        tally_ledger_group: "Sundry Debtors".into(),
    };

    save_party_gst_profile_internal(&conn, profile).unwrap();

    let fetched = get_party_gst_profile_internal(&conn, &customer_id).unwrap().expect("Profile must exist");
    assert_eq!(fetched.gstin, "29AABCA1111A1ZN");
    assert_eq!(fetched.credit_limit, 100000.0);
    assert_eq!(fetched.credit_period_days, 30);
    assert_eq!(fetched.tally_ledger_group, "Sundry Debtors");
}

#[test]
fn test_gst_invoice_creation_intra_and_inter_state_split() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB failed");
    let mut conn = db.conn.lock().expect("Lock connection failed");

    // 1. Seed customer and item
    let cust_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Reliance Retail Local', 'CUSTOMER', '9988776655', 'rel@local.in', 'Dadar, Mumbai', '27AABCR9999R1ZL', 0.0, 0.0, '2026-11-16')",
        params![cust_id],
    ).unwrap();

    let item_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO items (id, name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, created_at)
         VALUES (?1, 'Enterprise Server Rack', 'RACK-01', '890123456', 'Hardware', 'PCS', 40000.0, 50000.0, 10.0, 2.0, 'Central Godown', '2026-11-16')",
        params![item_id],
    ).unwrap();

    // 2. Create Intra-State GST Tax Invoice (Maharashtra to Maharashtra: 27 to 27)
    // 50,000 taxable * 18% = 9,000 tax (split into CGST 4,500 + SGST 4,500)
    let intra_payload = CreateGstInvoicePayload {
        invoice_type: "SALE".into(),
        party_id: Some(cust_id.clone()),
        party_name: "Reliance Retail Local".into(),
        invoice_date: "2026-11-16".into(),
        due_date: "2026-12-16".into(),
        subtotal: 50000.0,
        discount_amount: 0.0,
        total_tax: 9000.0,
        cgst_amount: 4500.0,
        sgst_amount: 4500.0,
        igst_amount: 0.0,
        cess_amount: 0.0,
        round_off: 0.0,
        total_amount: 59000.0,
        paid_amount: 0.0, // 100% Credit Sale (on account)
        payment_method: "Credit Sale (30 Days)".into(),
        notes: "Rule 46 Compliant Intra-State Tax Invoice".into(),
        reference: Some("PO-LOCAL-101".into()),
        place_of_supply: "27-Maharashtra".into(),
        pos_state_code: "27".into(),
        pos_state_name: "Maharashtra".into(),
        customer_gstin: "27AABCR9999R1ZL".into(),
        is_interstate: false,
        is_reverse_charge: false,
        eway_bill_no: None,
        vehicle_no: None,
        transporter_name: None,
        bill_reference_type: "New Ref".into(),
        items: vec![CreateGstItemPayload {
            item_id: Some(item_id.clone()),
            item_name: "Enterprise Server Rack".into(),
            hsn_code: "847170".into(),
            quantity: 1.0,
            unit: "PCS".into(),
            rate: 50000.0,
            discount_amount: 0.0,
            taxable_amount: 50000.0,
            tax_rate: 18.0,
            cgst_rate: 9.0,
            cgst_amount: 4500.0,
            sgst_rate: 9.0,
            sgst_amount: 4500.0,
            igst_rate: 0.0,
            igst_amount: 0.0,
            cess_rate: 0.0,
            cess_amount: 0.0,
            line_total: 59000.0,
        }],
    };

    let created = create_gst_invoice_internal(&mut conn, intra_payload).expect("create_gst_invoice failed");
    assert_eq!(created.invoice.status, "UNPAID");
    assert_eq!(created.invoice.total_amount, 59000.0);
    assert_eq!(created.gst_info.is_interstate, false);
    assert_eq!(created.gst_info.cgst_amount, 4500.0);
    assert_eq!(created.gst_info.sgst_amount, 4500.0);
    assert_eq!(created.gst_info.igst_amount, 0.0);

    // 3. Verify Customer Balance updated by ₹59,000 for credit sale
    let cust_balance: f64 = conn.query_row(
        "SELECT current_balance FROM parties WHERE id = ?1",
        params![cust_id],
        |r| r.get(0),
    ).unwrap();
    assert_eq!(cust_balance, 59000.0, "Sundry Debtor balance must increase by ₹59,000");

    // 4. Verify Stock deducted
    let stock_qty: f64 = conn.query_row(
        "SELECT stock_quantity FROM items WHERE id = ?1",
        params![item_id],
        |r| r.get(0),
    ).unwrap();
    assert_eq!(stock_qty, 9.0, "Stock must decrement from 10 to 9");
}

#[test]
fn test_bill_by_bill_tracking_and_settlement() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB failed");
    let mut conn = db.conn.lock().expect("Lock connection failed");

    let cust_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Tata Consultancy Services', 'CUSTOMER', '9123456780', 'tcs@tata.in', 'Nariman Point, Mumbai', '27AAACT2727A1ZT', 0.0, 0.0, '2026-11-16')",
        params![cust_id],
    ).unwrap();

    // Create 2 credit invoices
    let inv1 = create_gst_invoice_internal(&mut conn, CreateGstInvoicePayload {
        invoice_type: "SALE".into(),
        party_id: Some(cust_id.clone()),
        party_name: "Tata Consultancy Services".into(),
        invoice_date: "2026-10-01".into(),
        due_date: "2026-10-31".into(), // Overdue
        subtotal: 10000.0,
        discount_amount: 0.0,
        total_tax: 1800.0,
        cgst_amount: 900.0,
        sgst_amount: 900.0,
        igst_amount: 0.0,
        cess_amount: 0.0,
        round_off: 0.0,
        total_amount: 11800.0,
        paid_amount: 0.0,
        payment_method: "Credit".into(),
        notes: "Bill 1".into(),
        reference: Some("REF-1".into()),
        place_of_supply: "27-Maharashtra".into(),
        pos_state_code: "27".into(),
        pos_state_name: "Maharashtra".into(),
        customer_gstin: "27AAACT2727A1ZT".into(),
        is_interstate: false,
        is_reverse_charge: false,
        eway_bill_no: None,
        vehicle_no: None,
        transporter_name: None,
        bill_reference_type: "New Ref".into(),
        items: vec![],
    }).unwrap();

    let inv2 = create_gst_invoice_internal(&mut conn, CreateGstInvoicePayload {
        invoice_type: "SALE".into(),
        party_id: Some(cust_id.clone()),
        party_name: "Tata Consultancy Services".into(),
        invoice_date: "2026-11-10".into(),
        due_date: "2026-12-10".into(), // Current (not overdue)
        subtotal: 20000.0,
        discount_amount: 0.0,
        total_tax: 3600.0,
        cgst_amount: 1800.0,
        sgst_amount: 1800.0,
        igst_amount: 0.0,
        cess_amount: 0.0,
        round_off: 0.0,
        total_amount: 23600.0,
        paid_amount: 0.0,
        payment_method: "Credit".into(),
        notes: "Bill 2".into(),
        reference: Some("REF-2".into()),
        place_of_supply: "27-Maharashtra".into(),
        pos_state_code: "27".into(),
        pos_state_name: "Maharashtra".into(),
        customer_gstin: "27AAACT2727A1ZT".into(),
        is_interstate: false,
        is_reverse_charge: false,
        eway_bill_no: None,
        vehicle_no: None,
        transporter_name: None,
        bill_reference_type: "New Ref".into(),
        items: vec![],
    }).unwrap();

    // 1. Check pending bills list
    let pending = get_party_pending_bills_internal(&conn, &cust_id).unwrap();
    assert_eq!(pending.len(), 2);
    assert_eq!(pending[0].balance_due, 11800.0);
    assert_eq!(pending[1].balance_due, 23600.0);

    // 2. Check Sundry Debtors aging analysis
    let aging = get_sundry_debtors_aging_internal(&conn).unwrap();
    let debtor = aging.iter().find(|d| d.party_id == cust_id).expect("Debtor must be present");
    assert_eq!(debtor.total_outstanding, 35400.0);
    assert_eq!(debtor.pending_bills_count, 2);

    // 3. Settle Bill 1 in full (₹11,800) and Bill 2 partially (₹10,000) using Receipt Voucher
    let settlement_payload = BillSettlementPayload {
        party_id: cust_id.clone(),
        party_name: "Tata Consultancy Services".into(),
        total_amount: 21800.0,
        payment_type: "IN".into(),
        payment_method: "Bank NEFT".into(),
        payment_date: "2026-11-16".into(),
        reference: "NEFT-UTR-998811".into(),
        notes: "Settled against Bill 1 in full and Bill 2 part".into(),
        allocations: vec![
            BillAllocationPayload {
                invoice_id: inv1.invoice.id.clone(),
                amount: 11800.0,
            },
            BillAllocationPayload {
                invoice_id: inv2.invoice.id.clone(),
                amount: 10000.0,
            },
        ],
    };

    let settled = settle_bill_by_bill_internal(&mut conn, settlement_payload).unwrap();
    assert!(settled);

    // 4. Verify updated statuses
    let bill1_refetched = get_gst_invoice_internal(&conn, &inv1.invoice.id).unwrap();
    assert_eq!(bill1_refetched.invoice.status, "PAID");
    assert_eq!(bill1_refetched.invoice.paid_amount, 11800.0);

    let bill2_refetched = get_gst_invoice_internal(&conn, &inv2.invoice.id).unwrap();
    assert_eq!(bill2_refetched.invoice.status, "PARTIAL");
    assert_eq!(bill2_refetched.invoice.paid_amount, 10000.0);

    // 5. Verify remaining customer balance: 35,400 - 21,800 = 13,600
    let remaining_bal: f64 = conn.query_row(
        "SELECT current_balance FROM parties WHERE id = ?1",
        params![cust_id],
        |r| r.get(0),
    ).unwrap();
    assert_eq!(remaining_bal, 13600.0, "Debtor remaining balance must be ₹13,600");
}

#[test]
fn test_gstr1_and_gstr3b_statutory_reports() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB failed");
    let mut conn = db.conn.lock().expect("Lock connection failed");

    let b2b_cust_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Infosys Technologies', 'CUSTOMER', '9000000001', 'info@infosys.com', 'Bengaluru', '29AAACI1111I1ZZ', 0.0, 0.0, '2026-11-01')",
        params![b2b_cust_id],
    ).unwrap();

    let vendor_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Dell India Suppliers', 'VENDOR', '9000000002', 'dell@supplier.in', 'Gurgaon', '06AACCD2222D1ZF', 0.0, 0.0, '2026-11-01')",
        params![vendor_id],
    ).unwrap();

    // 1. Create B2B Inter-State Sale (Maharashtra to Karnataka: 27 to 29)
    create_gst_invoice_internal(&mut conn, CreateGstInvoicePayload {
        invoice_type: "SALE".into(),
        party_id: Some(b2b_cust_id.clone()),
        party_name: "Infosys Technologies".into(),
        invoice_date: "2026-11-05".into(),
        due_date: "2026-11-20".into(),
        subtotal: 100000.0,
        discount_amount: 0.0,
        total_tax: 18000.0,
        cgst_amount: 0.0,
        sgst_amount: 0.0,
        igst_amount: 18000.0, // Inter-state IGST
        cess_amount: 0.0,
        round_off: 0.0,
        total_amount: 118000.0,
        paid_amount: 118000.0,
        payment_method: "RTGS".into(),
        notes: "Interstate B2B Sale".into(),
        reference: Some("PO-INFY-01".into()),
        place_of_supply: "29-Karnataka".into(),
        pos_state_code: "29".into(),
        pos_state_name: "Karnataka".into(),
        customer_gstin: "29AAACI1111I1ZZ".into(),
        is_interstate: true,
        is_reverse_charge: false,
        eway_bill_no: Some("EWB-9988776655".into()),
        vehicle_no: Some("MH01AB1234".into()),
        transporter_name: Some("VRL Logistics".into()),
        bill_reference_type: "New Ref".into(),
        items: vec![CreateGstItemPayload {
            item_id: None,
            item_name: "Cloud Server Blades".into(),
            hsn_code: "847150".into(),
            quantity: 2.0,
            unit: "NOS".into(),
            rate: 50000.0,
            discount_amount: 0.0,
            taxable_amount: 100000.0,
            tax_rate: 18.0,
            cgst_rate: 0.0,
            cgst_amount: 0.0,
            sgst_rate: 0.0,
            sgst_amount: 0.0,
            igst_rate: 18.0,
            igst_amount: 18000.0,
            cess_rate: 0.0,
            cess_amount: 0.0,
            line_total: 118000.0,
        }],
    }).unwrap();

    // 2. Create B2CS Intra-State Sale (Walk-in consumer, unregistered)
    create_gst_invoice_internal(&mut conn, CreateGstInvoicePayload {
        invoice_type: "SALE".into(),
        party_id: None,
        party_name: "Walk-in Retail Shopper".into(),
        invoice_date: "2026-11-12".into(),
        due_date: "2026-11-12".into(),
        subtotal: 5000.0,
        discount_amount: 0.0,
        total_tax: 900.0,
        cgst_amount: 450.0,
        sgst_amount: 450.0,
        igst_amount: 0.0,
        cess_amount: 0.0,
        round_off: 0.0,
        total_amount: 5900.0,
        paid_amount: 5900.0,
        payment_method: "UPI".into(),
        notes: "Consumer POS sale".into(),
        reference: None,
        place_of_supply: "27-Maharashtra".into(),
        pos_state_code: "27".into(),
        pos_state_name: "Maharashtra".into(),
        customer_gstin: "".into(),
        is_interstate: false,
        is_reverse_charge: false,
        eway_bill_no: None,
        vehicle_no: None,
        transporter_name: None,
        bill_reference_type: "New Ref".into(),
        items: vec![CreateGstItemPayload {
            item_id: None,
            item_name: "Wireless Optical Mouse".into(),
            hsn_code: "847160".into(),
            quantity: 5.0,
            unit: "PCS".into(),
            rate: 1000.0,
            discount_amount: 0.0,
            taxable_amount: 5000.0,
            tax_rate: 18.0,
            cgst_rate: 9.0,
            cgst_amount: 450.0,
            sgst_rate: 9.0,
            sgst_amount: 450.0,
            igst_rate: 0.0,
            igst_amount: 0.0,
            cess_rate: 0.0,
            cess_amount: 0.0,
            line_total: 5900.0,
        }],
    }).unwrap();

    // 3. Create B2B Purchase (Inward supply for Input Tax Credit - ITC)
    create_gst_invoice_internal(&mut conn, CreateGstInvoicePayload {
        invoice_type: "PURCHASE".into(),
        party_id: Some(vendor_id.clone()),
        party_name: "Dell India Suppliers".into(),
        invoice_date: "2026-11-02".into(),
        due_date: "2026-11-30".into(),
        subtotal: 40000.0,
        discount_amount: 0.0,
        total_tax: 7200.0,
        cgst_amount: 0.0,
        sgst_amount: 0.0,
        igst_amount: 7200.0, // Eligible ITC from Inter-state purchase
        cess_amount: 0.0,
        round_off: 0.0,
        total_amount: 47200.0,
        paid_amount: 47200.0,
        payment_method: "Bank Transfer".into(),
        notes: "Inward stock supply with ITC".into(),
        reference: Some("DELL-BILL-9941".into()),
        place_of_supply: "27-Maharashtra".into(),
        pos_state_code: "27".into(),
        pos_state_name: "Maharashtra".into(),
        customer_gstin: "06AACCD2222D1ZF".into(),
        is_interstate: true,
        is_reverse_charge: false,
        eway_bill_no: None,
        vehicle_no: None,
        transporter_name: None,
        bill_reference_type: "New Ref".into(),
        items: vec![],
    }).unwrap();

    // 4. Test GSTR-1 Report for November 2026
    let gstr1 = get_gstr1_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
    assert_eq!(gstr1.total_turnover, 123900.0); // 118,000 + 5,900
    assert_eq!(gstr1.total_taxable, 105000.0);  // 100,000 + 5,000
    assert_eq!(gstr1.total_igst, 18000.0);
    assert_eq!(gstr1.total_cgst, 450.0);
    assert_eq!(gstr1.total_sgst, 450.0);

    // Verify Table 4 B2B has 1 invoice
    assert_eq!(gstr1.b2b.len(), 1);
    assert_eq!(gstr1.b2b[0].customer_gstin, "29AAACI1111I1ZZ");
    assert_eq!(gstr1.b2b[0].taxable_value, 100000.0);
    assert_eq!(gstr1.b2b[0].igst_amount, 18000.0);

    // Verify Table 7 B2CS has 1 summary
    assert_eq!(gstr1.b2cs.len(), 1);
    assert_eq!(gstr1.b2cs[0].taxable_value, 5000.0);
    assert_eq!(gstr1.b2cs[0].cgst_amount, 450.0);
    assert_eq!(gstr1.b2cs[0].sgst_amount, 450.0);

    // Verify Table 12 HSN Summary has 2 HSNs: 847150 and 847160
    assert_eq!(gstr1.hsn_summary.len(), 2);

    // 5. Test GSTR-3B Report for November 2026
    let gstr3b = get_gstr3b_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
    assert_eq!(gstr3b.table31.outward_taxable_value, 105000.0);
    assert_eq!(gstr3b.table31.outward_igst, 18000.0);
    assert_eq!(gstr3b.table31.outward_cgst, 450.0);
    assert_eq!(gstr3b.table31.outward_sgst, 450.0);

    // Table 4 Eligible ITC from purchase: ₹7,200 IGST
    assert_eq!(gstr3b.table4_itc.itc_igst, 7200.0);

    // Net tax payable:
    // Net IGST = 18,000 - 7,200 ITC = ₹10,800
    // Net CGST = ₹450
    // Net SGST = ₹450
    // Net Cash Payable = (18,000 + 450 + 450) - 7,200 = 18,900 - 7,200 = ₹11,700
    assert_eq!(gstr3b.net_igst_payable, 10800.0);
    assert_eq!(gstr3b.net_cgst_payable, 450.0);
    assert_eq!(gstr3b.net_sgst_payable, 450.0);
    assert_eq!(gstr3b.net_cash_payable, 11700.0);
}

#[test]
fn test_bill_settlement_financial_integrity_validation() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB failed");
    let mut conn = db.conn.lock().expect("Lock connection failed");

    let party_a = Uuid::new_v4().to_string();
    let party_b = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Customer Alpha', 'CUSTOMER', '9111111111', 'a@alpha.in', 'Mumbai', '27AABCU9603R1ZN', 0.0, 0.0, '2026-11-16')",
        params![party_a],
    ).unwrap();

    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Customer Beta', 'CUSTOMER', '9222222222', 'b@beta.in', 'Pune', '27AABCU9603R1ZN', 0.0, 0.0, '2026-11-16')",
        params![party_b],
    ).unwrap();

    // Create bill for Party A (₹5,000)
    let inv_a = create_gst_invoice_internal(&mut conn, CreateGstInvoicePayload {
        invoice_type: "SALE".into(),
        party_id: Some(party_a.clone()),
        party_name: "Customer Alpha".into(),
        invoice_date: "2026-11-16".into(),
        due_date: "2026-12-16".into(),
        subtotal: 4237.29,
        discount_amount: 0.0,
        total_tax: 762.71,
        cgst_amount: 381.355,
        sgst_amount: 381.355,
        igst_amount: 0.0,
        cess_amount: 0.0,
        round_off: 0.0,
        total_amount: 5000.0,
        paid_amount: 0.0,
        payment_method: "Credit".into(),
        notes: "Party A Bill".into(),
        reference: None,
        place_of_supply: "27-Maharashtra".into(),
        pos_state_code: "27".into(),
        pos_state_name: "Maharashtra".into(),
        customer_gstin: "27AABCU9603R1ZN".into(),
        is_interstate: false,
        is_reverse_charge: false,
        eway_bill_no: None,
        vehicle_no: None,
        transporter_name: None,
        bill_reference_type: "New Ref".into(),
        items: vec![],
    }).unwrap();

    // 1. Validation: Zero or negative settlement amount must fail
    let err_neg = settle_bill_by_bill_internal(&mut conn, BillSettlementPayload {
        party_id: party_a.clone(),
        party_name: "Customer Alpha".into(),
        total_amount: -100.0,
        payment_type: "IN".into(),
        payment_method: "Cash".into(),
        payment_date: "2026-11-16".into(),
        reference: "VOUCHER-01".into(),
        notes: "".into(),
        allocations: vec![],
    });
    assert!(err_neg.is_err(), "Negative settlement amount must be rejected");

    // 2. Validation: Non-existent party must fail
    let err_party = settle_bill_by_bill_internal(&mut conn, BillSettlementPayload {
        party_id: "non-existent-uuid".into(),
        party_name: "Ghost".into(),
        total_amount: 1000.0,
        payment_type: "IN".into(),
        payment_method: "Cash".into(),
        payment_date: "2026-11-16".into(),
        reference: "VOUCHER-02".into(),
        notes: "".into(),
        allocations: vec![],
    });
    assert!(err_party.is_err(), "Non-existent party must be rejected");

    // 3. Validation: Allocating payment to another party's invoice must fail
    let err_cross_party = settle_bill_by_bill_internal(&mut conn, BillSettlementPayload {
        party_id: party_b.clone(), // Party B paying
        party_name: "Customer Beta".into(),
        total_amount: 5000.0,
        payment_type: "IN".into(),
        payment_method: "UPI".into(),
        payment_date: "2026-11-16".into(),
        reference: "VOUCHER-03".into(),
        notes: "Trying to clear Party A invoice with Party B payment".into(),
        allocations: vec![BillAllocationPayload {
            invoice_id: inv_a.invoice.id.clone(), // Belongs to Party A!
            amount: 5000.0,
        }],
    });
    assert!(err_cross_party.is_err(), "Cross-party invoice allocation must be rejected");

    // 4. Validation: Sum of allocations exceeding payment amount must fail
    let err_alloc_sum = settle_bill_by_bill_internal(&mut conn, BillSettlementPayload {
        party_id: party_a.clone(),
        party_name: "Customer Alpha".into(),
        total_amount: 2000.0, // Only paying 2000
        payment_type: "IN".into(),
        payment_method: "UPI".into(),
        payment_date: "2026-11-16".into(),
        reference: "VOUCHER-04".into(),
        notes: "".into(),
        allocations: vec![BillAllocationPayload {
            invoice_id: inv_a.invoice.id.clone(),
            amount: 5000.0, // Exceeds 2000 payment!
        }],
    });
    assert!(err_alloc_sum.is_err(), "Allocations exceeding payment amount must be rejected");

    // 5. Success: Valid partial settlement
    let success = settle_bill_by_bill_internal(&mut conn, BillSettlementPayload {
        party_id: party_a.clone(),
        party_name: "Customer Alpha".into(),
        total_amount: 3000.0,
        payment_type: "IN".into(),
        payment_method: "UPI".into(),
        payment_date: "2026-11-16".into(),
        reference: "VOUCHER-VALID".into(),
        notes: "Partial payment".into(),
        allocations: vec![BillAllocationPayload {
            invoice_id: inv_a.invoice.id.clone(),
            amount: 3000.0,
        }],
    }).expect("Valid settlement should succeed");
    assert!(success);

    // Verify invoice status updated to PARTIAL with paid_amount = 3000
    let updated_inv = get_gst_invoice_internal(&conn, &inv_a.invoice.id).unwrap();
    assert_eq!(updated_inv.invoice.status, "PARTIAL");
    assert_eq!(updated_inv.invoice.paid_amount, 3000.0);

    // Verify party balance decremented by 3000 (from 5000 to 2000)
    let bal: f64 = conn.query_row("SELECT current_balance FROM parties WHERE id = ?1", params![party_a], |r| r.get(0)).unwrap();
    assert_eq!(bal, 2000.0);
}

#[test]
fn test_legacy_or_standard_invoice_gst_synthesis() {
    let db = DatabaseManager::in_memory().expect("In-memory SQLite DB failed");
    let conn = db.conn.lock().expect("Lock connection failed");

    let cust_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Legacy Store Client', 'CUSTOMER', '9777777777', 'legacy@store.in', 'Pune', '27AABCU9603R1ZN', 0.0, 0.0, '2026-11-01')",
        params![cust_id],
    ).unwrap();

    let it_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO items (id, name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, created_at)
         VALUES (?1, 'Thermal Printer 80mm', 'PRN-80', '890999888', 'Printers', 'PCS', 4000.0, 6000.0, 50.0, 5.0, 'Main', '2026-11-01')",
        params![it_id],
    ).unwrap();

    // Map item profile with specific HSN
    save_item_gst_profile_internal(&conn, GstItemProfile {
        item_id: it_id.clone(),
        hsn_code: "844332".into(),
        description: "Thermal POS Printer".into(),
        is_service: false,
        cess_rate: 0.0,
    }).unwrap();

    // Create invoice via standard POS (writing ONLY to invoices and invoice_items, NOT gst_invoices or gst_invoice_items)
    let legacy_inv_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at)
         VALUES (?1, 'INV-LEGACY-001', 'SALE', ?2, 'Legacy Store Client', '2026-11-10', '2026-11-10', 6000.0, 0.0, 1080.0, 7080.0, 7080.0, 'PAID', 'Cash', 'Legacy POS bill', '2026-11-10')",
        params![legacy_inv_id, cust_id],
    ).unwrap();

    conn.execute(
        "INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit, unit_price, discount_percent, tax_rate, line_total)
         VALUES (?1, ?2, ?3, 'Thermal Printer 80mm', 1.0, 'PCS', 6000.0, 0.0, 18.0, 7080.0)",
        params![Uuid::new_v4().to_string(), legacy_inv_id, it_id],
    ).unwrap();

    // 1. Fetch via get_gst_invoice_internal: gst_items must be synthesized with HSN 844332 and 9% CGST + 9% SGST
    let gst_inv = get_gst_invoice_internal(&conn, &legacy_inv_id).expect("Should load legacy invoice as GST invoice");
    assert_eq!(gst_inv.items.len(), 1);
    assert_eq!(gst_inv.gst_items.len(), 1, "GST items must be synthesized from core items");
    assert_eq!(gst_inv.gst_items[0].hsn_code, "844332");
    assert_eq!(gst_inv.gst_items[0].cgst_rate, 9.0);
    assert_eq!(gst_inv.gst_items[0].sgst_rate, 9.0);
    assert_eq!(gst_inv.gst_items[0].line_total, 7080.0);

    // 2. Verify GSTR-3B includes this invoice in outward supplies and taxes
    let gstr3b = get_gstr3b_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
    assert!(gstr3b.table31.outward_taxable_value >= 6000.0);
    assert!(gstr3b.table31.outward_cgst >= 540.0);
    assert!(gstr3b.table31.outward_sgst >= 540.0);

    // 3. Verify GSTR-1 HSN summary includes the synthesized HSN 844332
    let gstr1 = get_gstr1_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
    let prn_hsn = gstr1.hsn_summary.iter().find(|h| h.hsn_code == "844332");
    assert!(prn_hsn.is_some(), "GSTR-1 HSN summary must include standard POS items");
    assert_eq!(prn_hsn.unwrap().total_quantity, 1.0);
}
