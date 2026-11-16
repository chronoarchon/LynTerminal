use serde::{Deserialize, Serialize};

fn default_tax_mode() -> String { "EXCLUSIVE".into() }
fn default_tax_preset() -> String { "CUSTOM".into() }
fn default_opening_cash() -> f64 { 0.0 }
fn default_opening_bank() -> f64 { 0.0 }
fn default_opening_balance_mode() -> String { "CASH".into() }
fn default_capital_mode() -> String { "CASH".into() }
fn default_custom_payment_1_name() -> String { "UPI".into() }
fn default_custom_payment_2_name() -> String { "Bank Transfer".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub id: i32,
    pub business_name: String,
    pub tagline: String,
    pub address: String,
    pub phone: String,
    pub email: String,
    pub tax_id: String,
    pub currency_symbol: String,
    pub currency_code: String,
    pub tax_name: String,
    #[serde(default)]
    pub default_tax_rate: f64,
    pub invoice_prefix: String,
    #[serde(default)]
    pub enable_godowns: bool,
    pub terms_and_conditions: String,
    #[serde(default = "default_tax_mode")]
    pub tax_mode: String,       // "EXCLUSIVE" | "INCLUSIVE"
    #[serde(default = "default_tax_preset")]
    pub tax_preset: String,     // "US_SALES_TAX" | "EU_UK_VAT" | "JAPAN_JCT" | "INDIA_GST" | "NO_TAX" | "CUSTOM"
    #[serde(default)]
    pub preview_after_sale: bool,
    #[serde(default)]
    pub auto_print: bool,
    #[serde(default = "default_opening_cash")]
    pub opening_cash: f64,
    #[serde(default = "default_opening_bank")]
    pub opening_bank: f64,
    #[serde(default = "default_opening_balance_mode")]
    pub opening_balance_mode: String, // "CASH" | "BANK" | "SPLIT"
    #[serde(default)]
    pub capital_cash: f64,
    #[serde(default)]
    pub capital_bank: f64,
    #[serde(default = "default_capital_mode")]
    pub capital_mode: String,         // "CASH" | "BANK" | "SPLIT"
    #[serde(default = "default_custom_payment_1_name")]
    pub custom_payment_1_name: String,
    #[serde(default)]
    pub custom_payment_1_enabled: bool,
    #[serde(default = "default_custom_payment_2_name")]
    pub custom_payment_2_name: String,
    #[serde(default)]
    pub custom_payment_2_enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            id: 1,
            business_name: "LynTerminal Merchant".into(),
            tagline: "Point of Sale & Enterprise Hub".into(),
            address: "100 Market Street, Suite 400".into(),
            phone: "+1 (555) 019-2834".into(),
            email: "contact@lynterminal.store".into(),
            tax_id: "TAX-US-992014".into(),
            currency_symbol: "$".into(),
            currency_code: "USD".into(),
            tax_name: "Sales Tax".into(),
            default_tax_rate: 5.0,
            invoice_prefix: "INV-".into(),
            enable_godowns: true,
            terms_and_conditions: "Thank you for your business. Returns accepted within 14 days.".into(),
            tax_mode: "EXCLUSIVE".into(),
            tax_preset: "CUSTOM".into(),
            preview_after_sale: false,
            auto_print: false,
            opening_cash: 0.0,
            opening_bank: 0.0,
            opening_balance_mode: "CASH".into(),
            capital_cash: 0.0,
            capital_bank: 0.0,
            capital_mode: "CASH".into(),
            custom_payment_1_name: "UPI".into(),
            custom_payment_1_enabled: false,
            custom_payment_2_name: "Bank Transfer".into(),
            custom_payment_2_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub sku: String,
    pub barcode: String,
    pub category: String,
    pub unit: String,
    pub purchase_price: f64,
    pub sale_price: f64,
    pub stock_quantity: f64,
    pub min_stock_alert: f64,
    pub godown: String,
    pub created_at: String,
    pub size: Option<String>,
    pub brand: Option<String>,
    pub tax_rate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Party {
    pub id: String,
    pub name: String,
    pub party_type: String, // "CUSTOMER" | "VENDOR"
    pub phone: String,
    pub email: String,
    pub address: String,
    pub tax_number: String,
    pub opening_balance: f64,
    pub current_balance: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: String,
    pub invoice_number: String,
    pub invoice_type: String, // "SALE" | "PURCHASE" | "RETURN" | "ESTIMATE"
    pub party_id: Option<String>,
    pub party_name: String,
    pub invoice_date: String,
    pub due_date: String,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub status: String, // "PAID" | "PARTIAL" | "UNPAID" | "RETURNED"
    pub payment_method: String,
    pub notes: String,
    pub created_at: String,
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItem {
    pub id: String,
    pub invoice_id: String,
    pub item_id: Option<String>,
    pub item_name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_price: f64,
    pub discount_percent: f64,
    pub tax_rate: f64,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoicePayload {
    pub invoice_type: String,
    pub party_id: Option<String>,
    pub party_name: String,
    pub invoice_date: String,
    pub due_date: String,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub payment_method: String,
    pub notes: String,
    pub items: Vec<InvoiceItemPayload>,
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItemPayload {
    pub item_id: Option<String>,
    pub item_name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_price: f64,
    pub discount_percent: f64,
    pub tax_rate: f64,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDetail {
    pub invoice: Invoice,
    pub items: Vec<InvoiceItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub invoice_id: Option<String>,
    pub party_id: String,
    pub party_name: String,
    pub amount: f64,
    pub payment_type: String, // "IN" | "OUT"
    pub payment_method: String,
    pub payment_date: String,
    pub reference: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub id: String,
    pub title: String,
    pub category: String,
    pub amount: f64,
    pub expense_date: String,
    pub payment_method: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovement {
    pub id: String,
    pub item_id: String,
    pub item_name: String,
    pub change_quantity: f64,
    pub quantity_after: f64,
    pub movement_type: String,
    pub reference_id: String,
    pub timestamp: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: i64,
    pub action: String,
    pub entity: String,
    pub entity_id: String,
    pub details: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_sales: f64,
    pub total_purchases: f64,
    pub total_receivables: f64,
    pub total_payables: f64,
    pub total_expenses: f64,
    pub net_profit: f64,
    pub total_stock_value: f64,
    pub sales_count: i64,
    pub low_stock_count: i64,
    pub recent_invoices: Vec<Invoice>,
    pub low_stock_items: Vec<Item>,
    pub cash_in_hand: f64,
    pub cash_in_bank: f64,
    pub total_assets: f64,
    pub active_loans: f64,
    pub total_liabilities: f64,
    pub net_worth: f64,
    pub working_capital: f64,
    #[serde(default)]
    pub opening_balance: f64,
    #[serde(default)]
    pub opening_cash: f64,
    #[serde(default)]
    pub opening_bank: f64,
    #[serde(default)]
    pub capital: f64,
    #[serde(default)]
    pub capital_cash: f64,
    #[serde(default)]
    pub capital_bank: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaybookEntry {
    pub date: String,
    pub reference: String,
    pub title: String,
    pub entry_type: String, // "SALE" | "PURCHASE" | "PAYMENT_IN" | "PAYMENT_OUT" | "EXPENSE"
    pub cash_in: f64,
    pub cash_out: f64,
    pub balance: f64,
}

// ----------------------------------------------------------------------------
// EXTENDED BUSINESS MODELS
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub filepath: String,
    pub size_bytes: u64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashClosing {
    pub id: String,
    pub shift_date: String,
    pub opening_cash: f64,
    pub sales_cash: f64,
    pub expected_cash: f64,
    pub actual_cash: f64,
    pub variance: f64,
    pub notes: String,
    pub closed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrder {
    pub id: String,
    pub po_number: String,
    pub vendor_name: String,
    pub total_cost: f64,
    pub status: String,
    pub items_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockTransferPayload {
    pub item_id: String,
    pub from_godown: String,
    pub to_godown: String,
    pub quantity: f64,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickProductPayload {
    pub name: String,
    pub size: Option<String>,
    pub brand: Option<String>,
    pub sale_price: f64,
    pub purchase_price: Option<f64>,
    pub category: String,
    pub tax_rate: Option<f64>,
    pub stock_quantity: f64,
    pub unit: String,
}

// ----------------------------------------------------------------------------
// FEATURE 2: ESTIMATES & QUOTATIONS
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Estimate {
    pub id: String,
    pub estimate_number: String,
    pub party_id: Option<String>,
    pub party_name: String,
    pub estimate_date: String,
    pub expiry_date: String,
    pub subtotal: f64,
    pub tax_amount: f64,
    pub total_amount: f64,
    pub status: String, // "DRAFT" | "SENT" | "ACCEPTED" | "CONVERTED" | "EXPIRED"
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimateItem {
    pub id: String,
    pub estimate_id: String,
    pub item_id: Option<String>,
    pub item_name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_price: f64,
    pub discount_percent: f64,
    pub tax_rate: f64,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatePayload {
    pub party_id: Option<String>,
    pub party_name: String,
    pub estimate_date: String,
    pub expiry_date: String,
    pub items: Vec<InvoiceItemPayload>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimateDetail {
    pub estimate: Estimate,
    pub items: Vec<EstimateItem>,
}

// ----------------------------------------------------------------------------
// FEATURE 4: CUSTOMER CREDIT AGING ANALYSIS
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerAging {
    pub party_id: String,
    pub party_name: String,
    pub phone: String,
    pub email: String,
    pub current_30: f64,
    pub days_60: f64,
    pub days_90: f64,
    pub over_90: f64,
    pub total_due: f64,
    pub overdue_invoices_count: i64,
}

// ----------------------------------------------------------------------------
// FEATURE 14: PURCHASE RETURNS & DEBIT NOTES
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturn {
    pub id: String,
    pub return_number: String,
    pub party_id: Option<String>,
    pub party_name: String,
    pub return_date: String,
    pub total_amount: f64,
    pub reason: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturnItem {
    pub id: String,
    pub return_id: String,
    pub item_id: Option<String>,
    pub item_name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_price: f64,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturnPayload {
    pub party_id: Option<String>,
    pub party_name: String,
    pub return_date: String,
    pub items: Vec<InvoiceItemPayload>,
    pub reason: String,
    pub notes: String,
}

// ----------------------------------------------------------------------------
// BANKING & BUSINESS LOANS (CASH IN HAND, CASH AT BANK, LIABILITIES)
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankAccount {
    pub id: String,
    pub account_name: String,
    pub bank_name: String,
    pub account_number: String,
    pub current_balance: f64,
    pub is_primary: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessLoan {
    pub id: String,
    pub loan_name: String,
    pub lender_name: String,
    pub principal_amount: f64,
    pub interest_rate: f64,
    pub current_balance: f64,
    pub monthly_emi: f64,
    pub disbursed_date: String,
    pub due_date: String,
    pub status: String, // "ACTIVE" | "PAID_OFF"
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoanTransactionPayload {
    pub loan_id: String,
    pub transaction_type: String, // "DRAWDOWN" (capital in) | "REPAYMENT" (pay debt)
    pub amount: f64,
    pub account_type: String,     // "BANK" | "CASH"
    pub bank_account_id: Option<String>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierPaymentPayload {
    pub invoice_id: Option<String>,
    pub party_id: String,
    pub party_name: String,
    pub amount: f64,
    pub payment_method: String, // "CASH" | "BANK"
    pub bank_account_id: Option<String>,
    pub reference: String,
    pub notes: String,
}

// ----------------------------------------------------------------------------
// MONTHLY RECURRING BILLS (RENT, LOAN INTEREST, ELECTRICITY, SUBSCRIPTIONS)
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringBill {
    pub id: String,
    pub title: String,
    pub category: String, // "RENT" | "LOAN_INTEREST" | "ELECTRICITY" | "INTERNET" | "SUBSCRIPTION" | "MAINTENANCE" | "OTHER"
    pub due_day: i32,      // day of month (1-31)
    pub estimated_amount: Option<f64>,
    pub status: String,   // "DUE" | "PAID"
    pub last_paid_date: Option<String>,
    pub last_paid_amount: Option<f64>,
    pub payment_method: Option<String>, // "CASH" | "BANK"
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringBillPayload {
    pub id: Option<String>,
    pub title: String,
    pub category: String,
    pub due_day: i32,
    pub estimated_amount: Option<f64>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayRecurringBillPayload {
    pub bill_id: String,
    pub amount: f64,
    pub payment_source: String, // "CASH" | "BANK"
    pub bank_account_id: Option<String>,
    pub payment_date: String,
    pub reference: String,
    pub notes: String,
}

// ----------------------------------------------------------------------------
// OWNER MODE: EMPLOYEE ATTENDANCE, WORK, SALARY & STATS
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Employee {
    pub id: String,
    pub name: String,
    pub role: String, // "CASHIER" | "BARISTA" | "STORE_MANAGER" | "KITCHEN" | "DELIVERY" | "OTHER"
    pub phone: String,
    pub email: String,
    pub monthly_salary: f64,
    pub salary_type: String, // "MONTHLY" | "DAILY" | "HOURLY"
    pub status: String,      // "ACTIVE" | "INACTIVE"
    pub joining_date: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeePayload {
    pub id: Option<String>,
    pub name: String,
    pub role: String,
    pub phone: String,
    pub email: String,
    pub monthly_salary: f64,
    pub salary_type: String,
    pub status: String,
    pub joining_date: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeeAttendance {
    pub id: String,
    pub employee_id: String,
    pub employee_name: String,
    pub attendance_date: String, // YYYY-MM-DD
    pub status: String,          // "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE"
    pub check_in: Option<String>,
    pub check_out: Option<String>,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordAttendancePayload {
    pub employee_id: String,
    pub attendance_date: String,
    pub status: String,
    pub check_in: Option<String>,
    pub check_out: Option<String>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalaryPayment {
    pub id: String,
    pub voucher_number: String,
    pub employee_id: String,
    pub employee_name: String,
    pub amount: f64,
    pub payment_date: String,
    pub payment_source: String, // "CASH" | "BANK"
    pub for_month: String,       // e.g. "2026-11"
    pub days_present: i32,
    pub bonus: f64,
    pub deductions: f64,
    pub reference: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaySalaryPayload {
    pub employee_id: String,
    pub amount: f64,
    pub payment_source: String,
    pub bank_account_id: Option<String>,
    pub payment_date: String,
    pub for_month: String,
    pub days_present: i32,
    pub bonus: f64,
    pub deductions: f64,
    pub reference: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffSummaryStats {
    pub total_active_employees: i32,
    pub present_today: i32,
    pub total_monthly_payroll_due: f64,
    pub total_payroll_paid_this_month: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningCapitalPayload {
    pub opening_cash: f64,
    pub opening_bank: f64,
    #[serde(default)]
    pub capital_cash: f64,
    #[serde(default)]
    pub capital_bank: f64,
    #[serde(default = "default_opening_balance_mode")]
    pub opening_balance_mode: String,
    #[serde(default = "default_capital_mode")]
    pub capital_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_notes: String,
    pub published_at: String,
    pub html_url: String,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchCurrencyPayload {
    pub new_currency_code: String,
    pub new_currency_symbol: String,
    pub preserve_catalog: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthState {
    pub is_setup_completed: bool,
    pub is_locked: bool,
    pub username: String,
    pub has_account: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupPayload {
    pub username: String,
    pub password: String,
    pub recovery_code: String,
    pub business_name: String,
    pub tagline: Option<String>,
    pub currency_symbol: Option<String>,
    pub currency_code: Option<String>,
}


