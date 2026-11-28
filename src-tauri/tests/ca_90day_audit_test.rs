use lynterminal_lib::commands::{calculate_liquidity_internal, get_daybook_internal};
use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::gst::*;
use rusqlite::params;
use uuid::Uuid;

fn setup_ca_audit_store(conn: &rusqlite::Connection) {
    conn.execute(
        "UPDATE settings SET currency_code = 'INR', currency_symbol = '₹', tax_mode = 'EXCLUSIVE', opening_cash = 10000.0, opening_bank = 50000.0 WHERE id = 1",
        [],
    )
    .unwrap();
    let settings = GstSettings {
        is_enabled: true,
        gstin: "29CCAPB5845A1Z1".into(),
        legal_name: "Sunrise Electro Systems".into(),
        trade_name: "Sunrise Electro Systems".into(),
        state_code: "29".into(),
        state_name: "Karnataka".into(),
        pan: "CCAPB5845A".into(),
        gst_composition: false,
        einvoice_enabled: false,
        eway_bill_threshold: 50000.0,
        lut_number: "".into(),
        bank_name: "SBI".into(),
        bank_account_no: "1234567890".into(),
        bank_ifsc: "SBIN0000123".into(),
        bank_branch: "Bengaluru".into(),
        upi_id: "sunrise@sbi".into(),
    };
    save_gst_settings_internal(conn, settings).unwrap();
}

#[test]
fn test_90day_ca_gst_and_accounting_reconciliation() {
    let db = DatabaseManager::in_memory().unwrap();
    let mut conn = db.conn.lock().unwrap();
    setup_ca_audit_store(&conn);

    // Parties: B2B Intra (KA 29), B2B Inter (MH 27), Reg Vendor KA (29), Reg Vendor MH (27), Unreg Vendor, Comp Vendor
    let b2b_ka = Uuid::new_v4().to_string();
    let b2b_mh = Uuid::new_v4().to_string();
    let reg_v_ka = Uuid::new_v4().to_string();
    let reg_v_mh = Uuid::new_v4().to_string();
    let unreg_v = Uuid::new_v4().to_string();
    let comp_v = Uuid::new_v4().to_string();

    for (id, name, ptype, gstin) in [
        (&b2b_ka, "KA B2B Buyer", "CUSTOMER", "29AABCU9603R1ZN"),
        (&b2b_mh, "MH B2B Buyer", "CUSTOMER", "27AABCU9603R1ZM"),
        (&reg_v_ka, "KA Reg Supplier", "VENDOR", "29AABCV1111V1Z5"),
        (&reg_v_mh, "MH Reg Supplier", "VENDOR", "27AABCV2222V1Z6"),
        (&unreg_v, "Local Unreg Vendor", "VENDOR", ""),
        (&comp_v, "Comp Dealer Vendor", "VENDOR", "29AABCC3333C1Z7"),
    ] {
        conn.execute(
            "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
             VALUES (?1, ?2, ?3, '9000000000', '', '', ?4, 0.0, 0.0, '2026-09-01')",
            params![id, name, ptype, gstin],
        )
        .unwrap();
    }

    save_party_gst_profile_internal(
        &conn,
        GstPartyProfile {
            party_id: comp_v.clone(),
            gstin: "29AABCC3333C1Z7".into(),
            state_code: "29".into(),
            state_name: "Karnataka".into(),
            pan: "AABCC3333C".into(),
            gst_type: "COMPOSITION".into(),
            credit_limit: 0.0,
            credit_period_days: 30,
            tally_ledger_group: "Sundry Creditors".into(),
        },
    )
    .unwrap();

    // DAY 5 (2026-09-05): B2B Intra-State Sale (20,000 @ 18% -> 1800 CGST + 1800 SGST)
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "SALE".into(),
            party_id: Some(b2b_ka.clone()),
            party_name: "KA B2B Buyer".into(),
            invoice_date: "2026-09-05".into(),
            due_date: "2026-09-05".into(),
            subtotal: 20000.0,
            discount_amount: 0.0,
            total_tax: 3600.0,
            cgst_amount: 1800.0,
            sgst_amount: 1800.0,
            igst_amount: 0.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 23600.0,
            paid_amount: 23600.0,
            payment_method: "UPI".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "29-Karnataka".into(),
            pos_state_code: "29".into(),
            pos_state_name: "Karnataka".into(),
            customer_gstin: "29AABCU9603R1ZN".into(),
            is_interstate: false,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
            bank_account_id: None,
            items: vec![CreateGstItemPayload {
                item_id: None,
                item_name: "LED Panel 40W".into(),
                hsn_code: "9405".into(),
                quantity: 20.0,
                unit: "PCS".into(),
                rate: 1000.0,
                discount_amount: 0.0,
                taxable_amount: 20000.0,
                tax_rate: 18.0,
                cgst_rate: 9.0,
                cgst_amount: 1800.0,
                sgst_rate: 9.0,
                sgst_amount: 1800.0,
                igst_rate: 0.0,
                igst_amount: 0.0,
                cess_rate: 0.0,
                cess_amount: 0.0,
                line_total: 23600.0,
            }],
        },
    )
    .unwrap();

    // DAY 15 (2026-09-15): B2B Inter-State Sale (10,000 @ 12% -> 1200 IGST)
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "SALE".into(),
            party_id: Some(b2b_mh.clone()),
            party_name: "MH B2B Buyer".into(),
            invoice_date: "2026-09-15".into(),
            due_date: "2026-09-15".into(),
            subtotal: 10000.0,
            discount_amount: 0.0,
            total_tax: 1200.0,
            cgst_amount: 0.0,
            sgst_amount: 0.0,
            igst_amount: 1200.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 11200.0,
            paid_amount: 11200.0,
            payment_method: "BANK".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "27-Maharashtra".into(),
            pos_state_code: "27".into(),
            pos_state_name: "Maharashtra".into(),
            customer_gstin: "27AABCU9603R1ZM".into(),
            is_interstate: true,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
            bank_account_id: None,
            items: vec![CreateGstItemPayload {
                item_id: None,
                item_name: "Copper Cable".into(),
                hsn_code: "8544".into(),
                quantity: 10.0,
                unit: "MTR".into(),
                rate: 1000.0,
                discount_amount: 0.0,
                taxable_amount: 10000.0,
                tax_rate: 12.0,
                cgst_rate: 0.0,
                cgst_amount: 0.0,
                sgst_rate: 0.0,
                sgst_amount: 0.0,
                igst_rate: 12.0,
                igst_amount: 1200.0,
                cess_rate: 0.0,
                cess_amount: 0.0,
                line_total: 11200.0,
            }],
        },
    )
    .unwrap();

    // DAY 20 (2026-09-20): Standard POS EXCLUSIVE invoice (unit_price 6000, tax 18%, line_total 7080.0)
    let std_inv_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_id, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at)
         VALUES (?1, 'INV-STD-90', 'SALE', NULL, 'Walk-in Cash', '2026-09-20', '2026-09-20', 6000.0, 0.0, 1080.0, 7080.0, 7080.0, 'PAID', 'Cash', '', '2026-09-20')",
        params![std_inv_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO invoice_items (id, invoice_id, item_id, item_name, quantity, unit, unit_price, discount_percent, tax_rate, line_total)
         VALUES (?1, ?2, NULL, 'Stabilizer', 1.0, 'PCS', 6000.0, 0.0, 18.0, 7080.0)",
        params![Uuid::new_v4().to_string(), std_inv_id],
    )
    .unwrap();

    // DAY 40 (2026-10-10): Reg Vendor Intra Purchase (15,000 @ 18% -> 1350 CGST + 1350 SGST) & Inter Purchase (20,000 @ 18% -> 3600 IGST)
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(reg_v_ka),
            party_name: "KA Reg Supplier".into(),
            invoice_date: "2026-10-10".into(),
            due_date: "2026-10-10".into(),
            subtotal: 15000.0,
            discount_amount: 0.0,
            total_tax: 2700.0,
            cgst_amount: 1350.0,
            sgst_amount: 1350.0,
            igst_amount: 0.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 17700.0,
            paid_amount: 17700.0,
            payment_method: "BANK".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "29-Karnataka".into(),
            pos_state_code: "29".into(),
            pos_state_name: "Karnataka".into(),
            customer_gstin: "29AABCV1111V1Z5".into(),
            is_interstate: false,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(reg_v_mh),
            party_name: "MH Reg Supplier".into(),
            invoice_date: "2026-10-12".into(),
            due_date: "2026-10-12".into(),
            subtotal: 20000.0,
            discount_amount: 0.0,
            total_tax: 3600.0,
            cgst_amount: 0.0,
            sgst_amount: 0.0,
            igst_amount: 3600.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 23600.0,
            paid_amount: 23600.0,
            payment_method: "BANK".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "27-Maharashtra".into(),
            pos_state_code: "27".into(),
            pos_state_name: "Maharashtra".into(),
            customer_gstin: "27AABCV2222V1Z6".into(),
            is_interstate: true,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    // DAY 45 (2026-10-15): Unregistered & Composition Purchases (MUST BE INELIGIBLE ITC)
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(unreg_v),
            party_name: "Local Unreg Vendor".into(),
            invoice_date: "2026-10-15".into(),
            due_date: "2026-10-15".into(),
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
            payment_method: "CASH".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "29-Karnataka".into(),
            pos_state_code: "29".into(),
            pos_state_name: "Karnataka".into(),
            customer_gstin: "".into(),
            is_interstate: false,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(comp_v),
            party_name: "Comp Dealer Vendor".into(),
            invoice_date: "2026-10-16".into(),
            due_date: "2026-10-16".into(),
            subtotal: 4000.0,
            discount_amount: 0.0,
            total_tax: 200.0,
            cgst_amount: 100.0,
            sgst_amount: 100.0,
            igst_amount: 0.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 4200.0,
            paid_amount: 4200.0,
            payment_method: "CASH".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "29-Karnataka".into(),
            pos_state_code: "29".into(),
            pos_state_name: "Karnataka".into(),
            customer_gstin: "29AABCC3333C1Z7".into(),
            is_interstate: false,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
            bank_account_id: None,
            items: vec![],
        },
    )
    .unwrap();

    // DAY 70 (2026-11-10): B2B Credit Note (-5,000 @ 18% -> -450 CGST -450 SGST) & Walk-in Cash Return (-1,000 @ 18% -> -1180 Cash)
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "RETURN".into(),
            party_id: Some(b2b_ka),
            party_name: "KA B2B Buyer".into(),
            invoice_date: "2026-11-10".into(),
            due_date: "2026-11-10".into(),
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
            payment_method: "BANK".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "29-Karnataka".into(),
            pos_state_code: "29".into(),
            pos_state_name: "Karnataka".into(),
            customer_gstin: "29AABCU9603R1ZN".into(),
            is_interstate: false,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "Agst Ref".into(),
            bank_account_id: None,
            items: vec![CreateGstItemPayload {
                item_id: None,
                item_name: "LED Panel 40W".into(),
                hsn_code: "9405".into(),
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
        },
    )
    .unwrap();

    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "RETURN".into(),
            party_id: None,
            party_name: "Walk-in Cash".into(),
            invoice_date: "2026-11-15".into(),
            due_date: "2026-11-15".into(),
            subtotal: 1000.0,
            discount_amount: 0.0,
            total_tax: 180.0,
            cgst_amount: 90.0,
            sgst_amount: 90.0,
            igst_amount: 0.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 1180.0,
            paid_amount: 1180.0,
            payment_method: "CASH".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "29-Karnataka".into(),
            pos_state_code: "29".into(),
            pos_state_name: "Karnataka".into(),
            customer_gstin: "".into(),
            is_interstate: false,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "Agst Ref".into(),
            bank_account_id: None,
            items: vec![CreateGstItemPayload {
                item_id: None,
                item_name: "Stabilizer".into(),
                hsn_code: "8471".into(),
                quantity: 1.0,
                unit: "PCS".into(),
                rate: 1000.0,
                discount_amount: 0.0,
                taxable_amount: 1000.0,
                tax_rate: 18.0,
                cgst_rate: 9.0,
                cgst_amount: 90.0,
                sgst_rate: 9.0,
                sgst_amount: 90.0,
                igst_rate: 0.0,
                igst_amount: 0.0,
                cess_rate: 0.0,
                cess_amount: 0.0,
                line_total: 1180.0,
            }],
        },
    )
    .unwrap();

    // =========================================================================
    // 90-DAY RECONCILIATION ASSERTIONS (2026-09-01 .. 2026-11-29)
    // =========================================================================
    let gstr1 = get_gstr1_report_internal(&conn, "2026-09-01", "2026-11-29").unwrap();
    let gstr3b = get_gstr3b_report_internal(&conn, "2026-09-01", "2026-11-29").unwrap();

    // Expected net outward taxable: 20000 + 10000 + 6000 - 5000 - 1000 = 30000
    assert!((gstr1.total_taxable - 30000.0).abs() < 0.05, "GSTR1 taxable expected 30000, got {}", gstr1.total_taxable);
    assert!((gstr3b.table31.outward_taxable_value - 30000.0).abs() < 0.05, "GSTR3B taxable expected 30000, got {}", gstr3b.table31.outward_taxable_value);

    // Expected taxes: IGST=1200, CGST=1800+540-450-90=1800, SGST=1800
    assert!((gstr1.total_igst - 1200.0).abs() < 0.05, "GSTR1 IGST expected 1200, got {}", gstr1.total_igst);
    assert!((gstr1.total_cgst - 1800.0).abs() < 0.05, "GSTR1 CGST expected 1800, got {}", gstr1.total_cgst);
    assert!((gstr1.total_sgst - 1800.0).abs() < 0.05, "GSTR1 SGST expected 1800, got {}", gstr1.total_sgst);
    assert!((gstr3b.table31.outward_igst - 1200.0).abs() < 0.05, "GSTR3B IGST expected 1200, got {}", gstr3b.table31.outward_igst);
    assert!((gstr3b.table31.outward_cgst - 1800.0).abs() < 0.05, "GSTR3B CGST expected 1800, got {}", gstr3b.table31.outward_cgst);
    assert!((gstr3b.table31.outward_sgst - 1800.0).abs() < 0.05, "GSTR3B SGST expected 1800, got {}", gstr3b.table31.outward_sgst);

    // B2CS net (6000 - 1000 = 5000 @ 18% -> 450 CGST + 450 SGST; NO double taxation!)
    let b2cs_taxable: f64 = gstr1.b2cs.iter().map(|b| b.taxable_value).sum();
    assert!((b2cs_taxable - 5000.0).abs() < 0.05, "B2CS taxable expected 5000, got {}", b2cs_taxable);

    // HSN net total taxable must match 30000
    let hsn_taxable: f64 = gstr1.hsn_summary.iter().map(|h| h.taxable_value).sum();
    assert!((hsn_taxable - 30000.0).abs() < 0.05, "HSN taxable expected 30000, got {}", hsn_taxable);

    // Eligible ITC: IGST 3600, CGST 1350, SGST 1350; Ineligible: 900 + 200 = 1100
    assert!((gstr3b.table4_itc.itc_igst - 3600.0).abs() < 0.05);
    assert!((gstr3b.table4_itc.itc_cgst - 1350.0).abs() < 0.05);
    assert!((gstr3b.table4_itc.itc_sgst - 1350.0).abs() < 0.05);
    assert!((gstr3b.table4_itc.itc_ineligible - 1100.0).abs() < 0.05);

    // Rule 88A set-off: IGST ITC 3600 covers IGST 1200 (rem 2400) -> CGST 1800 (rem 600) -> SGST 600; SGST ITC 1350 covers rem SGST 1200 -> 0 cash payable!
    assert!((gstr3b.net_cash_payable - 0.0).abs() < 0.05, "Expected 0 cash payable after Rule 88A set-off, got {}", gstr3b.net_cash_payable);

    // Cash & Bank Liquidity Reconciliation (including Walk-in Cash Return -1180!)
    // Cash: 10000 + 7080 (Walk-in Sale) - 5900 (Unreg Pur) - 4200 (Comp Pur) - 1180 (Walk-in Return) = 5800
    // Bank: 50000 + 23600 + 11200 - 17700 - 23600 - 5900 = 37600
    let (cash, bank) = calculate_liquidity_internal(&conn).unwrap();
    assert!((cash - 5800.0).abs() < 0.05, "Expected Cash 5800, got {}", cash);
    assert!((bank - 37600.0).abs() < 0.05, "Expected Bank 37600, got {}", bank);

    // Daybook on 2026-11-15 must record Walk-in Return as cash_out = 1180.0 (NOT cash_in)
    let daybook = get_daybook_internal(&conn, "2026-11-15").unwrap();
    let ret_row = daybook.iter().find(|d| d.entry_type == "RETURN").expect("Daybook must have RETURN entry");
    assert!((ret_row.cash_out - 1180.0).abs() < 0.05);
    assert!((ret_row.cash_in - 0.0).abs() < 0.05);
}
