pub mod db;
pub mod models;
pub mod commands;
pub mod gst;
pub mod printer;

use db::DatabaseManager;
use commands::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = DatabaseManager::new().expect("Failed to initialize LynTerminal database");
    let state = Mutex::new(AppState { db });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Instantly reveal and focus the window upon launch without artificial delay
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.unminimize();
                let _ = main_win.show();
                let _ = main_win.set_focus();
            }
            Ok(())
        })
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::show_main_window,
            commands::record_deposit,
            commands::get_settings,
            commands::save_settings,
            commands::list_items,
            commands::save_item,
            commands::delete_item,
            commands::adjust_stock,
            commands::get_stock_movements,
            commands::list_parties,
            commands::save_party,
            commands::delete_party,
            commands::create_invoice,
            commands::list_invoices,
            commands::get_invoice,
            commands::delete_invoice,
            commands::void_or_delete_invoice,
            commands::export_invoice_pdf,
            commands::save_invoice_pdf_file,
            commands::open_invoice_pdf,
            commands::quick_create_product,
            commands::create_database_backup,
            commands::list_database_backups,
            commands::restore_database_backup,
            commands::generate_low_stock_po,
            commands::list_purchase_orders,
            commands::record_cash_closing,
            commands::list_cash_closings,
            commands::transfer_godown_stock,
            commands::create_estimate,
            commands::list_estimates,
            commands::get_estimate,
            commands::convert_estimate_to_invoice,
            commands::get_customer_aging_analysis,
            commands::create_purchase_return,
            commands::list_purchase_returns,
            commands::list_bank_accounts,
            commands::save_bank_account,
            commands::transfer_cash_bank,
            commands::list_business_loans,
            commands::save_business_loan,
            commands::record_loan_transaction,
            commands::pay_supplier_bill,
            commands::record_payment,
            commands::list_payments,
            commands::list_expenses,
            commands::save_expense,
            commands::delete_expense,
            commands::get_dashboard_summary,
            commands::get_daybook,
            commands::get_audit_logs,
            commands::seed_demo_data,
            commands::list_recurring_bills,
            commands::save_recurring_bill,
            commands::delete_recurring_bill,
            commands::pay_recurring_bill,
            commands::list_employees,
            commands::save_employee,
            commands::delete_employee,
            commands::record_attendance,
            commands::list_attendance,
            commands::pay_salary,
            commands::list_salary_payments,
            commands::get_staff_stats,
            commands::update_opening_capital,
            commands::switch_currency_and_reset_data,
            commands::clear_all_data,
            commands::get_auth_state,
            commands::complete_setup,
            commands::verify_unlock_password,
            commands::set_app_locked,
            commands::reset_password_with_recovery_code,
            commands::change_password,
            commands::disable_password,
            commands::get_recovery_code,
            commands::restart_app,
            commands::create_pre_update_backup,
            commands::download_update_binary,
            commands::verify_update_binary,
            commands::apply_update_and_restart,
            commands::check_app_update,
            commands::apply_app_update,
            commands::get_license_status,
            commands::activate_license,
            // Indian GST & Statutory Accounting commands
            gst::get_gst_settings,
            gst::save_gst_settings,
            gst::get_party_gst_profile,
            gst::save_party_gst_profile,
            gst::get_item_gst_profile,
            gst::save_item_gst_profile,
            gst::create_gst_invoice,
            gst::get_gst_invoice,
            gst::list_gst_invoices,
            gst::get_sundry_debtors_aging,
            gst::get_sundry_creditors_aging,
            gst::get_party_pending_bills,
            gst::settle_bill_by_bill,
            gst::get_gstr1_report,
            gst::get_gstr3b_report,
            // Hardware Thermal Printer & Cash Drawer Engine
            printer::list_printers,
            printer::print_raw_escpos,
            printer::test_print_receipt,
            printer::open_cash_drawer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LynTerminal application");
}

#[cfg(test)]
mod v170_unit_tests {
    use super::db::DatabaseManager;
    use super::{commands, gst, models};
    use rusqlite::{params, Connection};

    fn insert_party(
        conn: &Connection,
        id: &str,
        name: &str,
        party_type: &str,
        tax_number: &str,
        opening_balance: f64,
        current_balance: f64,
    ) {
        conn.execute(
            "INSERT INTO parties (id, name, party_type, phone, email, address, tax_number, opening_balance, current_balance, created_at)
             VALUES (?1, ?2, ?3, '9999999999', '', '', ?4, ?5, ?6, '2026-11-01T00:00:00Z')",
            params![id, name, party_type, tax_number, opening_balance, current_balance],
        )
        .unwrap();
    }

    fn insert_item(
        conn: &Connection,
        id: &str,
        name: &str,
        purchase_price: f64,
        sale_price: f64,
        tax_rate: f64,
    ) {
        conn.execute(
            "INSERT INTO items (id, name, sku, barcode, category, unit, purchase_price, sale_price, stock_quantity, min_stock_alert, godown, tax_rate, created_at)
             VALUES (?1, ?2, ?1, ?1, 'General', 'kg', ?3, ?4, 20.0, 5.0, 'Main Store', ?5, '2026-11-01T00:00:00Z')",
            params![id, name, purchase_price, sale_price, tax_rate],
        )
        .unwrap();
    }

    #[test]
    fn test_gst_invoice_synthesis_exclusive_and_interstate_fallback() {
        let db = DatabaseManager::in_memory().expect("in_memory db");
        let mut conn = db.conn.lock().unwrap();

        // Set supplier state 27 (Maharashtra) and EXCLUSIVE tax mode
        conn.execute(
            "UPDATE settings SET tax_mode = 'EXCLUSIVE', default_tax_rate = 18.0 WHERE id = 1",
            [],
        )
        .unwrap();
        gst::save_gst_settings_internal(
            &conn,
            gst::GstSettings {
                is_enabled: true,
                gstin: "27AABCU9603R1ZN".into(),
                legal_name: "Test Store".into(),
                trade_name: "Test Store".into(),
                state_code: "27".into(),
                state_name: "Maharashtra".into(),
                pan: "AABCU9603R".into(),
                gst_composition: false,
                einvoice_enabled: false,
                eway_bill_threshold: 50000.0,
                lut_number: "".into(),
                bank_name: "".into(),
                bank_account_no: "".into(),
                bank_ifsc: "".into(),
                bank_branch: "".into(),
                upi_id: "".into(),
            },
        )
        .unwrap();

        // Create interstate customer (state 29 - Karnataka)
        let party_id = "party-ka-1".to_string();
        insert_party(&conn, &party_id, "Karnataka Buyer", "CUSTOMER", "29AABCU9603R1ZK", 0.0, 0.0);
        gst::save_party_gst_profile_internal(
            &conn,
            gst::GstPartyProfile {
                party_id: party_id.clone(),
                gstin: "29AABCU9603R1ZK".into(),
                state_code: "29".into(),
                state_name: "Karnataka".into(),
                pan: "AABCU9603R".into(),
                gst_type: "REGULAR".into(),
                credit_limit: 0.0,
                credit_period_days: 30,
                tally_ledger_group: "Sundry Debtors".into(),
            },
        )
        .unwrap();

        // Create standard POS invoice with 10% line discount in EXCLUSIVE mode
        let inv = commands::create_invoice_internal(
            &mut conn,
            models::InvoicePayload {
                invoice_type: "SALE".into(),
                party_id: Some(party_id.clone()),
                party_name: "Karnataka Buyer".into(),
                invoice_date: "2026-11-27".into(),
                due_date: "2026-11-27".into(),
                subtotal: 900.0,
                discount_amount: 0.0,
                tax_amount: 162.0,
                total_amount: 1062.0,
                paid_amount: 1062.0,
                payment_method: "Cash".into(),
                notes: "POS Sale".into(),
                reference: None,
                bank_account_id: None,
                items: vec![models::InvoiceItemPayload {
                    item_id: None,
                    item_name: "Router".into(),
                    quantity: 1.0,
                    unit: "pcs".into(),
                    unit_price: 1000.0,
                    discount_percent: 10.0,
                    tax_rate: 18.0,
                    line_total: 900.0,
                }],
            },
        )
        .unwrap();

        let full = gst::get_gst_invoice_internal(&conn, &inv.invoice.id).unwrap();
        assert!(full.gst_info.is_interstate, "Should detect interstate from gst_parties.state_code");
        assert!((full.gst_info.igst_amount - 162.0).abs() < 0.01);
        assert!((full.gst_info.cgst_amount - 0.0).abs() < 0.01);
        assert_eq!(full.gst_items.len(), 1);
        assert!((full.gst_items[0].taxable_amount - 900.0).abs() < 0.01);
        assert!((full.gst_items[0].discount_amount - 100.0).abs() < 0.01);
        assert!((full.gst_items[0].igst_amount - 162.0).abs() < 0.01);
    }

    #[test]
    fn test_gstr3b_rcm_composition_and_debit_note_itc() {
        let db = DatabaseManager::in_memory().expect("in_memory db");
        let mut conn = db.conn.lock().unwrap();

        gst::save_gst_settings_internal(
            &conn,
            gst::GstSettings {
                is_enabled: true,
                gstin: "27AABCU9603R1ZN".into(),
                legal_name: "Test Store".into(),
                trade_name: "Test Store".into(),
                state_code: "27".into(),
                state_name: "Maharashtra".into(),
                pan: "AABCU9603R".into(),
                gst_composition: false,
                einvoice_enabled: false,
                eway_bill_threshold: 50000.0,
                lut_number: "".into(),
                bank_name: "".into(),
                bank_account_no: "".into(),
                bank_ifsc: "".into(),
                bank_branch: "".into(),
                upi_id: "".into(),
            },
        )
        .unwrap();

        let item_id = "item-coffee-1".to_string();
        insert_item(&conn, &item_id, "Coffee Beans", 500.0, 800.0, 18.0);

        // Registered regular vendor
        let reg_vendor_id = "vendor-reg-1".to_string();
        insert_party(&conn, &reg_vendor_id, "Reg Vendor", "VENDOR", "27AABCV1234A1Z5", 0.0, 0.0);
        gst::save_party_gst_profile_internal(
            &conn,
            gst::GstPartyProfile {
                party_id: reg_vendor_id.clone(),
                gstin: "27AABCV1234A1Z5".into(),
                state_code: "27".into(),
                state_name: "Maharashtra".into(),
                pan: "AABCV1234A".into(),
                gst_type: "REGULAR".into(),
                credit_limit: 0.0,
                credit_period_days: 30,
                tally_ledger_group: "Sundry Creditors".into(),
            },
        )
        .unwrap();

        // Composition vendor
        let comp_vendor_id = "vendor-comp-1".to_string();
        insert_party(&conn, &comp_vendor_id, "Comp Vendor", "VENDOR", "27AABCC1234A1Z5", 0.0, 0.0);
        gst::save_party_gst_profile_internal(
            &conn,
            gst::GstPartyProfile {
                party_id: comp_vendor_id.clone(),
                gstin: "27AABCC1234A1Z5".into(),
                state_code: "27".into(),
                state_name: "Maharashtra".into(),
                pan: "AABCC1234A".into(),
                gst_type: "COMPOSITION".into(),
                credit_limit: 0.0,
                credit_period_days: 30,
                tally_ledger_group: "Sundry Creditors".into(),
            },
        )
        .unwrap();

        // 1) Regular Purchase: 1000 taxable, 90 CGST + 90 SGST
        gst::create_gst_invoice_internal(
            &mut conn,
            gst::CreateGstInvoicePayload {
                invoice_type: "PURCHASE".into(),
                party_id: Some(reg_vendor_id.clone()),
                party_name: "Reg Vendor".into(),
                invoice_date: "2026-11-10".into(),
                due_date: "2026-11-10".into(),
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
                payment_method: "Cash".into(),
                notes: "Reg Purchase".into(),
                reference: None,
                place_of_supply: "27-Maharashtra".into(),
                pos_state_code: "27".into(),
                pos_state_name: "Maharashtra".into(),
                customer_gstin: "27AABCV1234A1Z5".into(),
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

        // 2) RCM Purchase from unregistered vendor: 500 taxable, 45 CGST + 45 SGST
        gst::create_gst_invoice_internal(
            &mut conn,
            gst::CreateGstInvoicePayload {
                invoice_type: "PURCHASE".into(),
                party_id: None,
                party_name: "Unregistered GTA".into(),
                invoice_date: "2026-11-12".into(),
                due_date: "2026-11-12".into(),
                subtotal: 500.0,
                discount_amount: 0.0,
                total_tax: 90.0,
                cgst_amount: 45.0,
                sgst_amount: 45.0,
                igst_amount: 0.0,
                cess_amount: 0.0,
                round_off: 0.0,
                total_amount: 500.0,
                paid_amount: 500.0,
                payment_method: "Cash".into(),
                notes: "RCM Freight".into(),
                reference: None,
                place_of_supply: "27-Maharashtra".into(),
                pos_state_code: "27".into(),
                pos_state_name: "Maharashtra".into(),
                customer_gstin: "".into(),
                is_interstate: false,
                is_reverse_charge: true,
                eway_bill_no: None,
                vehicle_no: None,
                transporter_name: None,
                bill_reference_type: "New Ref".into(),
                bank_account_id: None,
                items: vec![],
            },
        )
        .unwrap();

        // 3) Composition Vendor Purchase: 200 taxable, 18+18 (must be INELIGIBLE ITC)
        gst::create_gst_invoice_internal(
            &mut conn,
            gst::CreateGstInvoicePayload {
                invoice_type: "PURCHASE".into(),
                party_id: Some(comp_vendor_id.clone()),
                party_name: "Comp Vendor".into(),
                invoice_date: "2026-11-15".into(),
                due_date: "2026-11-15".into(),
                subtotal: 200.0,
                discount_amount: 0.0,
                total_tax: 36.0,
                cgst_amount: 18.0,
                sgst_amount: 18.0,
                igst_amount: 0.0,
                cess_amount: 0.0,
                round_off: 0.0,
                total_amount: 236.0,
                paid_amount: 236.0,
                payment_method: "Cash".into(),
                notes: "Comp Purchase".into(),
                reference: None,
                place_of_supply: "27-Maharashtra".into(),
                pos_state_code: "27".into(),
                pos_state_name: "Maharashtra".into(),
                customer_gstin: "27AABCC1234A1Z5".into(),
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

        // 4) Purchase Return Debit Note against Reg Vendor: 500 + 18% GST = 590 (90 tax reversal)
        commands::create_purchase_return_internal(
            &mut conn,
            models::PurchaseReturnPayload {
                party_id: Some(reg_vendor_id.clone()),
                party_name: "Reg Vendor".into(),
                return_date: "2026-11-18".into(),
                reason: "Damaged".into(),
                notes: "DN".into(),
                items: vec![models::InvoiceItemPayload {
                    item_id: Some(item_id.clone()),
                    item_name: "Coffee Beans".into(),
                    quantity: 1.0,
                    unit: "kg".into(),
                    unit_price: 500.0,
                    discount_percent: 0.0,
                    tax_rate: 18.0,
                    line_total: 590.0,
                }],
            },
        )
        .unwrap();

        let r3b = gst::get_gstr3b_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
        // RCM 3.1(d): 500 taxable, 45 CGST, 45 SGST
        assert!((r3b.table31.reverse_charge_taxable - 500.0).abs() < 0.01);
        assert!((r3b.table31.reverse_charge_cgst - 45.0).abs() < 0.01);
        assert!((r3b.table31.reverse_charge_sgst - 45.0).abs() < 0.01);
        // RCM must be paid in cash
        assert!((r3b.net_cash_payable - 90.0).abs() < 0.01);
        // Eligible ITC: Reg (90+90) + RCM (45+45) - DN (45+45) = 90 CGST + 90 SGST = 180 total
        assert!((r3b.table4_itc.itc_cgst - 90.0).abs() < 0.01);
        assert!((r3b.table4_itc.itc_sgst - 90.0).abs() < 0.01);
        assert!((r3b.table4_itc.itc_ineligible - 36.0).abs() < 0.01);
    }

    #[test]
    fn test_gstr1_doc_summary_credit_notes_and_aging_opening_balance() {
        let db = DatabaseManager::in_memory().expect("in_memory db");
        let mut conn = db.conn.lock().unwrap();

        let cust_id = "cust-aging-1".to_string();
        insert_party(&conn, &cust_id, "Aging Customer", "CUSTOMER", "", 500.0, 500.0);

        // Create 1 unpaid credit invoice in the past (overdue)
        gst::create_gst_invoice_internal(
            &mut conn,
            gst::CreateGstInvoicePayload {
                invoice_type: "SALE".into(),
                party_id: Some(cust_id.clone()),
                party_name: "Aging Customer".into(),
                invoice_date: "2026-10-01".into(),
                due_date: "2026-10-15".into(),
                subtotal: 1000.0,
                discount_amount: 0.0,
                total_tax: 0.0,
                cgst_amount: 0.0,
                sgst_amount: 0.0,
                igst_amount: 0.0,
                cess_amount: 0.0,
                round_off: 0.0,
                total_amount: 1000.0,
                paid_amount: 0.0,
                payment_method: "Credit".into(),
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
        )
        .unwrap();

        // Create 1 RETURN credit note in Nov
        gst::create_gst_invoice_internal(
            &mut conn,
            gst::CreateGstInvoicePayload {
                invoice_type: "RETURN".into(),
                party_id: Some(cust_id.clone()),
                party_name: "Aging Customer".into(),
                invoice_date: "2026-11-20".into(),
                due_date: "2026-11-20".into(),
                subtotal: 200.0,
                discount_amount: 0.0,
                total_tax: 0.0,
                cgst_amount: 0.0,
                sgst_amount: 0.0,
                igst_amount: 0.0,
                cess_amount: 0.0,
                round_off: 0.0,
                total_amount: 200.0,
                paid_amount: 200.0,
                payment_method: "Cash".into(),
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
        )
        .unwrap();

        // Reset party balance to 1500 (500 opening + 1000 bill) to verify unbilled opening balance inclusion
        conn.execute(
            "UPDATE parties SET current_balance = 1500.0 WHERE id = ?1",
            params![cust_id],
        )
        .unwrap();

        let aging = gst::get_sundry_debtors_aging_internal(&conn).unwrap();
        let c_aging = aging.iter().find(|a| a.party_id == cust_id).unwrap();
        assert_eq!(c_aging.pending_bills_count, 1);
        assert_eq!(c_aging.overdue_count, 1);
        let bucket_sum = c_aging.current_30 + c_aging.days_60 + c_aging.days_90 + c_aging.over_90;
        assert!((bucket_sum - 1500.0).abs() < 0.01, "Bucket sum {bucket_sum} must include unbilled opening balance");

        let gstr1 = gst::get_gstr1_report_internal(&conn, "2026-11-01", "2026-11-30").unwrap();
        assert!(
            gstr1.doc_summary.iter().any(|d| d.doc_type == "Credit Note" && d.total_count == 1),
            "GSTR-1 doc_summary must include Credit Note"
        );
    }
}
