use lynterminal_lib::commands::{
    generate_native_invoice_pdf, seed_demo_data_conn, switch_currency_and_reset_data_internal,
};
use lynterminal_lib::db::DatabaseManager;
use lynterminal_lib::gst::*;
use lynterminal_lib::models::{Invoice, InvoiceDetail, InvoiceItem, SwitchCurrencyPayload};
use rusqlite::params;
use uuid::Uuid;

fn setup_gst_business(conn: &rusqlite::Connection, state_code: &str, state_name: &str) {
    let settings = GstSettings {
        is_enabled: true,
        gstin: format!("{}AABCU9603R1ZN", state_code),
        legal_name: "Audit Test Enterprises Pvt Ltd".into(),
        trade_name: "Audit Test Store".into(),
        state_code: state_code.into(),
        state_name: state_name.into(),
        pan: "AABCU9603R".into(),
        gst_composition: false,
        einvoice_enabled: false,
        eway_bill_threshold: 50000.0,
        lut_number: "".into(),
        bank_name: "HDFC Bank".into(),
        bank_account_no: "50200012345678".into(),
        bank_ifsc: "HDFC0000123".into(),
        bank_branch: "Main".into(),
        upi_id: "audit@hdfcbank".into(),
    };
    save_gst_settings_internal(conn, settings).unwrap();
}

#[test]
fn test_gstr3b_rule_88a_itc_setoff_and_cess_isolation() {
    let db = DatabaseManager::in_memory().unwrap();
    let mut conn = db.conn.lock().unwrap();
    setup_gst_business(&conn, "27", "Maharashtra");

    // Create a registered vendor (15-char GSTIN)
    let vendor_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Reg Vendor', 'VENDOR', '9000000001', '', '', '27AABCV1111V1Z5', 0.0, 0.0, '2026-11-01')",
        params![vendor_id],
    ).unwrap();

    // Purchase with CGST ITC = 500, SGST ITC = 100, IGST ITC = 200, Cess ITC = 50
    // Notice CGST ITC (500) > CGST Outward (100), SGST Outward = 300.
    // Rule 88A: Excess CGST ITC (400) CANNOT offset SGST Outward! It can only offset IGST Outward.
    // Cess ITC (50) can ONLY offset Cess Outward (30), leaving 0 Cess cash, and excess 20 Cess ITC CANNOT offset IGST/CGST/SGST.
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(vendor_id.clone()),
            party_name: "Reg Vendor".into(),
            invoice_date: "2026-11-05".into(),
            due_date: "2026-12-05".into(),
            subtotal: 5000.0,
            discount_amount: 0.0,
            total_tax: 850.0,
            cgst_amount: 500.0,
            sgst_amount: 100.0,
            igst_amount: 200.0,
            cess_amount: 50.0,
            round_off: 0.0,
            total_amount: 5850.0,
            paid_amount: 5850.0,
            payment_method: "BANK".into(),
            notes: "".into(),
            reference: None,
            place_of_supply: "27-Maharashtra".into(),
            pos_state_code: "27".into(),
            pos_state_name: "Maharashtra".into(),
            customer_gstin: "27AABCV1111V1Z5".into(),
            is_interstate: false,
            is_reverse_charge: false,
            eway_bill_no: None,
            vehicle_no: None,
            transporter_name: None,
            bill_reference_type: "New Ref".into(),
            bank_account_id: None,
            items: vec![],
        },
    ).unwrap();

    // Unregistered vendor purchase (NO GSTIN) -> MUST NOT grant ITC!
    let unreg_vendor_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
         VALUES (?1, 'Unreg Vendor', 'VENDOR', '9000000002', '', '', '', 0.0, 0.0, '2026-11-01')",
        params![unreg_vendor_id],
    ).unwrap();
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "PURCHASE".into(),
            party_id: Some(unreg_vendor_id),
            party_name: "Unreg Vendor".into(),
            invoice_date: "2026-11-06".into(),
            due_date: "2026-12-06".into(),
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
            bank_account_id: None,
            items: vec![],
        },
    ).unwrap();

    // Outward Sale: IGST = 300, CGST = 100, SGST = 300, Cess = 30
    create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "SALE".into(),
            party_id: None,
            party_name: "Walk-in".into(),
            invoice_date: "2026-11-10".into(),
            due_date: "2026-11-10".into(),
            subtotal: 4000.0,
            discount_amount: 0.0,
            total_tax: 730.0,
            cgst_amount: 100.0,
            sgst_amount: 300.0,
            igst_amount: 300.0,
            cess_amount: 30.0,
            round_off: 0.0,
            total_amount: 4730.0,
            paid_amount: 4730.0,
            payment_method: "CASH".into(),
            notes: "".into(),
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
            bank_account_id: None,
            items: vec![],
        },
    ).unwrap();

    let r = get_gstr3b_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
    // Unregistered vendor tax (180) must be ineligible, NOT in itc_cgst/sgst!
    assert!((r.table4_itc.itc_ineligible - 180.0).abs() < 0.01);
    assert!((r.table4_itc.itc_cgst - 500.0).abs() < 0.01);

    // Rule 88A trace:
    // 1. IGST ITC (200) -> IGST Outward (300) => rem IGST Outward = 100
    // 2. CGST ITC (500) -> CGST Outward (100), then 100 to rem IGST Outward => rem IGST Outward = 0, unused CGST ITC = 300
    // 3. SGST ITC (100) -> SGST Outward (300) => rem SGST Outward = 200 (cannot use unused CGST ITC!)
    // 4. Cess ITC (50) -> Cess Outward (30) => rem Cess Outward = 0
    assert!((r.net_igst_payable - 0.0).abs() < 0.01);
    assert!((r.net_cgst_payable - 0.0).abs() < 0.01);
    assert!((r.net_sgst_payable - 200.0).abs() < 0.01);
    assert!((r.net_cess_payable - 0.0).abs() < 0.01);
    assert!((r.net_cash_payable - 200.0).abs() < 0.01);

    // Table 6.1 reconciliation: Tax Payable - ITC Utilized == Cash Payable
    assert!((r.total_tax_payable - r.total_itc_utilized - r.net_cash_payable).abs() < 0.01);
    assert!((r.table31.outward_sgst - r.itc_utilized_sgst - r.net_sgst_payable).abs() < 0.01);
}

#[test]
fn test_gstr1_mixed_rate_fractional_slabs_returns_and_cancelled() {
    let db = DatabaseManager::in_memory().unwrap();
    let mut conn = db.conn.lock().unwrap();
    setup_gst_business(&conn, "29", "Karnataka");

    let item_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO items (id, name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, created_at)
         VALUES (?1, 'Diamond Ring', 'DM-01', '123', 'Jewellery', 'PCS', 1000.0, 2000.0, 10.0, 1.0, 'Main', '2026-11-01')",
        params![item_id],
    ).unwrap();

    // Mixed-rate B2CS invoice: 0.25% item + 18% item
    let inv = create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "SALE".into(),
            party_id: None,
            party_name: "Walk-in".into(),
            invoice_date: "2026-11-10".into(),
            due_date: "2026-11-10".into(),
            subtotal: 11000.0,
            discount_amount: 0.0,
            total_tax: 205.0,
            cgst_amount: 102.5,
            sgst_amount: 102.5,
            igst_amount: 0.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 11205.0,
            paid_amount: 11205.0,
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
            items: vec![
                CreateGstItemPayload {
                    item_id: Some(item_id.clone()),
                    item_name: "Rough Diamond".into(),
                    hsn_code: "7102".into(),
                    quantity: 1.0,
                    unit: "PCS".into(),
                    rate: 10000.0,
                    discount_amount: 0.0,
                    taxable_amount: 10000.0,
                    tax_rate: 0.25,
                    cgst_rate: 0.125,
                    cgst_amount: 12.5,
                    sgst_rate: 0.125,
                    sgst_amount: 12.5,
                    igst_rate: 0.0,
                    igst_amount: 0.0,
                    cess_rate: 0.0,
                    cess_amount: 0.0,
                    line_total: 10025.0,
                },
                CreateGstItemPayload {
                    item_id: Some(item_id.clone()),
                    item_name: "Box".into(),
                    hsn_code: "4819".into(),
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
                },
            ],
        },
    ).unwrap();
    assert_eq!(inv.invoice.invoice_number, "INV-00001");

    // Also insert an INV-2026-001 style invoice to verify sequence does not break
    conn.execute(
        "INSERT INTO invoices (id, invoice_number, invoice_type, party_name, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, paid_amount, status, payment_method, notes, created_at)
         VALUES (?1, 'INV-2026-999', 'SALE', 'Cancelled Party', '2026-11-11', '2026-11-11', 500.0, 0.0, 90.0, 590.0, 0.0, 'CANCELLED', 'CASH', '', '2026-11-11')",
        params![Uuid::new_v4().to_string()],
    ).unwrap();

    // Next invoice should be INV-00002, NOT INV-02027!
    let inv2 = create_gst_invoice_internal(
        &mut conn,
        CreateGstInvoicePayload {
            invoice_type: "SALE".into(),
            party_id: None,
            party_name: "Zero Rate Buyer".into(),
            invoice_date: "2026-11-12".into(),
            due_date: "2026-11-12".into(),
            subtotal: 500.0,
            discount_amount: 0.0,
            total_tax: 0.0,
            cgst_amount: 0.0,
            sgst_amount: 0.0,
            igst_amount: 0.0,
            cess_amount: 0.0,
            round_off: 0.0,
            total_amount: 500.0,
            paid_amount: 500.0,
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
    ).unwrap();
    assert_eq!(inv2.invoice.invoice_number, "INV-00002");

    let gstr1 = get_gstr1_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
    // Cancelled invoice excluded from taxable, included in doc_summary cancelled_count
    assert!((gstr1.total_taxable - 11500.0).abs() < 0.01);
    assert_eq!(gstr1.doc_summary[0].total_count, 3);
    assert_eq!(gstr1.doc_summary[0].cancelled_count, 1);
    assert_eq!(gstr1.doc_summary[0].net_count, 2);

    // B2CS must have separate 0%, 0.25%, and 18% slabs (NO blended rate!)
    let has_025 = gstr1.b2cs.iter().any(|b| (b.tax_rate - 0.25).abs() < 0.001);
    let has_18 = gstr1.b2cs.iter().any(|b| (b.tax_rate - 18.0).abs() < 0.001);
    assert!(has_025, "0.25% fractional slab must be preserved in B2CS");
    assert!(has_18, "18% slab must be separate from 0.25% slab");

    // GSTR-3B nil_exempt_taxable must capture the 500 0% sale
    let gstr3b = get_gstr3b_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
    assert!((gstr3b.table31.nil_exempt_taxable - 500.0).abs() < 0.01);
    assert!((gstr3b.table31.outward_taxable_value - 11000.0).abs() < 0.01);
}

#[test]
fn test_90_day_data_reconciliation_and_no_truncation() {
    let db = DatabaseManager::in_memory().unwrap();
    let mut conn = db.conn.lock().unwrap();
    setup_gst_business(&conn, "27", "Maharashtra");

    seed_demo_data_conn(&mut conn, 90).expect("90-day demo seed must succeed");

    // Verify list_gst_invoices_internal does NOT truncate at 100
    let all_sales = list_gst_invoices_internal(&conn, Some("SALE".into()), None, None).unwrap();
    assert!(
        all_sales.len() > 100,
        "90-day seed must return >100 invoices without LIMIT 100 truncation, got {}",
        all_sales.len()
    );

    let gstr1 = get_gstr1_report_internal(&conn, "2000-01-01", "2099-12-31").unwrap();
    let gstr3b = get_gstr3b_report_internal(&conn, "2000-01-01", "2099-12-31").unwrap();

    // HSN summary taxable must reconcile with GSTR-1 total_taxable!
    let hsn_taxable_sum: f64 = gstr1.hsn_summary.iter().map(|h| h.taxable_value).sum();
    assert!(
        (hsn_taxable_sum - gstr1.total_taxable).abs() < 1.0,
        "HSN taxable ({}) must reconcile with GSTR-1 total_taxable ({})",
        hsn_taxable_sum,
        gstr1.total_taxable
    );

    // GSTR-1 outward taxable must reconcile with GSTR-3B outward + nil/exempt + zero-rated
    let gstr3b_total_outward = gstr3b.table31.outward_taxable_value
        + gstr3b.table31.nil_exempt_taxable
        + gstr3b.table31.zero_rated_taxable;
    assert!(
        (gstr1.total_taxable - gstr3b_total_outward).abs() < 1.0,
        "GSTR-1 taxable ({}) must reconcile with GSTR-3B outward ({})",
        gstr1.total_taxable,
        gstr3b_total_outward
    );

    // GSTR-1 B2B + B2CL + B2CS taxable must reconcile with GSTR-1 total_taxable
    let table_taxable_sum: f64 = gstr1.b2b.iter().map(|b| b.taxable_value).sum::<f64>()
        + gstr1.b2cl.iter().map(|b| b.taxable_value).sum::<f64>()
        + gstr1.b2cs.iter().map(|b| b.taxable_value).sum::<f64>();
    assert!(
        (table_taxable_sum - gstr1.total_taxable).abs() < 1.0,
        "B2B+B2CL+B2CS taxable ({}) must reconcile with GSTR-1 total_taxable ({})",
        table_taxable_sum,
        gstr1.total_taxable
    );
}

#[test]
fn test_multicurrency_switch_reset_and_pdf_winansi() {
    let db = DatabaseManager::in_memory().unwrap();
    let mut conn = db.conn.lock().unwrap();

    // Insert data into bank_accounts, business_loans, and gst_invoices
    conn.execute(
        "INSERT INTO bank_accounts (id, account_name, bank_name, account_number, current_balance, created_at)
         VALUES ('b1', 'Main', 'HDFC', '123', 5000.0, '2026-11-01')",
        [],
    ).unwrap();
    conn.execute(
        "UPDATE settings SET opening_cash = 1000.0, opening_bank = 5000.0, capital_cash = 2000.0 WHERE id = 1",
        [],
    ).unwrap();

    let updated = switch_currency_and_reset_data_internal(
        &mut conn,
        SwitchCurrencyPayload {
            new_currency_code: "JPY".into(),
            new_currency_symbol: "¥".into(),
            preserve_catalog: true,
        },
    ).unwrap();

    assert_eq!(updated.currency_code, "JPY");
    assert_eq!(updated.opening_cash, 0.0);
    assert_eq!(updated.opening_bank, 0.0);
    assert_eq!(updated.capital_cash, 0.0);

    let bank_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM bank_accounts", [], |r| r.get(0))
        .unwrap();
    assert_eq!(bank_count, 0, "bank_accounts must be cleared on currency switch");

    let gst_enabled: i32 = conn
        .query_row("SELECT is_enabled FROM gst_settings WHERE id = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(gst_enabled, 0, "gst_settings must be disabled when switching to JPY");

    // Verify native PDF with ₹ replaces ₹ with Rs. (WinAnsi safe)
    let mut inr_settings = updated;
    inr_settings.currency_symbol = "₹".into();
    inr_settings.currency_code = "INR".into();
    let detail = InvoiceDetail {
        invoice: Invoice {
            id: "1".into(),
            invoice_number: "INV-00001".into(),
            invoice_type: "SALE".into(),
            party_id: None,
            party_name: "Test".into(),
            invoice_date: "2026-11-26".into(),
            due_date: "2026-11-26".into(),
            subtotal: 100.0,
            discount_amount: 0.0,
            tax_amount: 18.0,
            total_amount: 118.0,
            paid_amount: 118.0,
            status: "PAID".into(),
            payment_method: "CASH".into(),
            notes: "".into(),
            created_at: "2026-11-26".into(),
            reference: None,
        },
        items: vec![InvoiceItem {
            id: "i1".into(),
            invoice_id: "1".into(),
            item_id: None,
            item_name: "Item".into(),
            quantity: 1.0,
            unit: "PCS".into(),
            unit_price: 100.0,
            discount_percent: 0.0,
            tax_rate: 18.0,
            line_total: 100.0,
        }],
    };
    let pdf_bytes = generate_native_invoice_pdf(&detail, &inr_settings, "");
    let pdf_str = String::from_utf8_lossy(&pdf_bytes);
    assert!(pdf_str.starts_with("%PDF-1.4"));
    assert!(pdf_str.contains("Rs.118.00"), "PDF must use ASCII 'Rs.' instead of non-WinAnsi '₹'");
}
