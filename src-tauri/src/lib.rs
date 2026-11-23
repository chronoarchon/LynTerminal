pub mod db;
pub mod models;
pub mod commands;
pub mod gst;

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
            // Indian GST & Tally-Compliant Accounting commands
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running LynTerminal application");
}
