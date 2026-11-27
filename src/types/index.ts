export interface Settings {
  id: number;
  business_name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  currency_symbol: string;
  currency_code: string;
  tax_name: string;
  default_tax_rate: number;
  invoice_prefix: string;
  enable_godowns: boolean;
  terms_and_conditions: string;
  tax_mode: "EXCLUSIVE" | "INCLUSIVE";
  tax_preset: "US_SALES_TAX" | "EU_UK_VAT" | "JAPAN_JCT" | "INDIA_GST" | "NO_TAX" | "CUSTOM";
  preview_after_sale: boolean;
  auto_print: boolean;
  opening_cash?: number;
  opening_bank?: number;
  opening_balance_mode?: "CASH" | "BANK" | "SPLIT";
  capital_cash?: number;
  capital_bank?: number;
  capital_mode?: "CASH" | "BANK" | "SPLIT";
  custom_payment_1_name?: string;
  custom_payment_1_enabled?: boolean;
  custom_payment_2_name?: string;
  custom_payment_2_enabled?: boolean;
  printer_type?: "BROWSER_DIALOG" | "OS_SPOOLER" | "NETWORK_9100" | "SERIAL" | "USB_RAW";
  printer_target?: string;
  paper_width?: "58mm" | "80mm" | "A4";
  auto_cut?: boolean;
  open_cash_drawer?: boolean;
}

export interface PrinterDeviceInfo {
  name: string;
  printer_type: "BROWSER_DIALOG" | "OS_SPOOLER" | "NETWORK_9100" | "SERIAL" | "USB_RAW";
  target: string;
  is_default: boolean;
  platform: string;
}

export interface ReceiptPrintLine {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate?: number | null;
}

export interface ReceiptPrintPayload {
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  party_name: string;
  payment_method: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  round_off: number;
  total_amount: number;
  paid_amount: number;
  items: ReceiptPrintLine[];
  gstin?: string | null;
  notes?: string | null;
  paper_width?: string | null;
  open_drawer?: boolean | null;
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  godown: string;
  created_at: string;
  size?: string | null;
  brand?: string | null;
  tax_rate?: number | null;
}

export interface Party {
  id: string;
  name: string;
  party_type: "CUSTOMER" | "VENDOR";
  phone: string;
  email: string;
  address: string;
  tax_number: string;
  opening_balance: number;
  current_balance: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: "SALE" | "PURCHASE" | "RETURN" | "ESTIMATE";
  party_id: string | null;
  party_name: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: "PAID" | "PARTIAL" | "UNPAID" | "RETURNED" | "CANCELLED" | "CREDIT";
  payment_method: string;
  notes: string;
  created_at: string;
  reference?: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
}

export interface InvoiceItemPayload {
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
}

export interface InvoicePayload {
  invoice_type: "SALE" | "PURCHASE" | "RETURN" | "ESTIMATE";
  party_id: string | null;
  party_name: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  notes: string;
  items: InvoiceItemPayload[];
  reference?: string | null;
  bank_account_id?: string | null;
}

export interface InvoiceDetail {
  invoice: Invoice;
  items: InvoiceItem[];
}

export interface Payment {
  id: string;
  invoice_id: string | null;
  party_id: string;
  party_name: string;
  amount: number;
  payment_type: "IN" | "OUT";
  payment_method: string;
  payment_date: string;
  reference: string;
  notes: string;
  bank_account_id?: string | null;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  notes: string;
}

export interface StockMovement {
  id: string;
  item_id: string;
  item_name: string;
  change_quantity: number;
  quantity_after: number;
  movement_type: string;
  reference_id: string;
  timestamp: string;
  notes: string;
}

export interface AuditLog {
  id: number;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  timestamp: string;
}

export interface DashboardSummary {
  total_sales: number;
  total_purchases: number;
  cogs?: number;
  total_receivables: number;
  total_payables: number;
  total_expenses: number;
  net_profit: number;
  total_stock_value: number;
  sales_count: number;
  low_stock_count: number;
  recent_invoices: Invoice[];
  low_stock_items: Item[];
  cash_in_hand: number;
  cash_in_bank: number;
  total_assets: number;
  active_loans: number;
  total_liabilities: number;
  net_worth: number;
  working_capital: number;
  opening_balance?: number;
  opening_cash?: number;
  opening_bank?: number;
  capital?: number;
  capital_cash?: number;
  capital_bank?: number;
}

export interface DaybookEntry {
  date: string;
  reference: string;
  title: string;
  entry_type: "SALE" | "PURCHASE" | "PAYMENT_IN" | "PAYMENT_OUT" | "EXPENSE" | "SALARY" | "TRANSFER" | "LOAN_DRAWDOWN" | "LOAN_REPAYMENT";
  cash_in: number;
  cash_out: number;
  bank_in?: number;
  bank_out?: number;
  payment_channel?: string;
  balance: number;
}

export interface BackupInfo {
  filename: string;
  filepath: string;
  size_bytes: number;
  created_at: string;
}

export interface CashClosing {
  id: string;
  shift_date: string;
  opening_cash: number;
  sales_cash: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  notes: string;
  closed_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  total_cost: number;
  status: string;
  items_count: number;
  created_at: string;
}

export interface StockTransferPayload {
  item_id: string;
  from_godown: string;
  to_godown: string;
  quantity: number;
  notes: string;
}

export interface QuickProductPayload {
  name: string;
  size?: string | null;
  brand?: string | null;
  sale_price: number;
  purchase_price?: number | null;
  category: string;
  tax_rate?: number | null;
  stock_quantity: number;
  unit: string;
  barcode?: string | null;
}

// ----------------------------------------------------------------------------
// FEATURE 2: ESTIMATES & QUOTATIONS
// ----------------------------------------------------------------------------

export interface Estimate {
  id: string;
  estimate_number: string;
  party_id?: string | null;
  party_name: string;
  estimate_date: string;
  expiry_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "CONVERTED" | "EXPIRED";
  notes: string;
  created_at: string;
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  item_id?: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
}

export interface EstimatePayload {
  party_id?: string | null;
  party_name: string;
  estimate_date: string;
  expiry_date: string;
  items: InvoiceItemPayload[];
  notes: string;
}

export interface EstimateDetail {
  estimate: Estimate;
  items: EstimateItem[];
}

// ----------------------------------------------------------------------------
// FEATURE 4: CUSTOMER CREDIT AGING ANALYSIS
// ----------------------------------------------------------------------------

export interface CustomerAging {
  party_id: string;
  party_name: string;
  phone: string;
  email: string;
  current_30: number;
  days_60: number;
  days_90: number;
  over_90: number;
  total_due: number;
  overdue_invoices_count: number;
}

// ----------------------------------------------------------------------------
// FEATURE 14: PURCHASE RETURNS & DEBIT NOTES
// ----------------------------------------------------------------------------

export interface PurchaseReturn {
  id: string;
  return_number: string;
  party_id?: string | null;
  party_name: string;
  return_date: string;
  total_amount: number;
  reason: string;
  notes: string;
  created_at: string;
}

export interface PurchaseReturnItem {
  id: string;
  return_id: string;
  item_id?: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface PurchaseReturnPayload {
  party_id?: string | null;
  party_name: string;
  return_date: string;
  items: InvoiceItemPayload[];
  reason: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// BANKING & BUSINESS LOANS
// ----------------------------------------------------------------------------

export interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
  is_primary: boolean;
  created_at: string;
}

export interface BusinessLoan {
  id: string;
  loan_name: string;
  lender_name: string;
  principal_amount: number;
  interest_rate: number;
  current_balance: number;
  monthly_emi: number;
  disbursed_date: string;
  due_date: string;
  status: "ACTIVE" | "PAID_OFF";
  notes: string;
  created_at: string;
}

export interface LoanTransactionPayload {
  loan_id: string;
  transaction_type: "DRAWDOWN" | "REPAYMENT";
  amount: number;
  account_type: "BANK" | "CASH";
  bank_account_id?: string | null;
  notes: string;
}

export interface SupplierPaymentPayload {
  invoice_id?: string | null;
  party_id: string;
  party_name: string;
  amount: number;
  payment_method: string;
  bank_account_id?: string | null;
  payment_date?: string | null;
  reference: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// MONTHLY RECURRING BILLS (RENT, LOAN INTEREST, ELECTRICITY, ETC.)
// ----------------------------------------------------------------------------

export interface RecurringBill {
  id: string;
  title: string;
  category: string;
  due_day: number;
  estimated_amount?: number | null;
  status: "DUE" | "PAID";
  last_paid_date?: string | null;
  last_paid_amount?: number | null;
  payment_method?: string | null;
  notes: string;
  created_at: string;
}

export interface RecurringBillPayload {
  id?: string | null;
  title: string;
  category: string;
  due_day: number;
  estimated_amount?: number | null;
  notes: string;
}

export interface PayRecurringBillPayload {
  bill_id: string;
  amount: number;
  payment_source: "CASH" | "BANK";
  bank_account_id?: string | null;
  payment_date: string;
  reference: string;
  notes: string;
}

// ----------------------------------------------------------------------------
// OWNER MODE: EMPLOYEE ATTENDANCE, WORK, SALARY & STATS
// ----------------------------------------------------------------------------

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  monthly_salary: number;
  salary_type: string;
  status: "ACTIVE" | "INACTIVE";
  joining_date: string;
  notes: string;
  created_at: string;
}

export interface EmployeePayload {
  id?: string | null;
  name: string;
  role: string;
  phone: string;
  email: string;
  monthly_salary: number;
  salary_type: string;
  status: "ACTIVE" | "INACTIVE";
  joining_date: string;
  notes: string;
}

export interface EmployeeAttendance {
  id: string;
  employee_id: string;
  employee_name: string;
  attendance_date: string;
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  check_in?: string | null;
  check_out?: string | null;
  notes: string;
  created_at: string;
}

export interface RecordAttendancePayload {
  employee_id: string;
  attendance_date: string;
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  check_in?: string | null;
  check_out?: string | null;
  notes: string;
}

export interface SalaryPayment {
  id: string;
  voucher_number: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  payment_date: string;
  payment_source: "CASH" | "BANK";
  for_month: string;
  days_present: number;
  bonus: number;
  deductions: number;
  reference: string;
  notes: string;
  created_at: string;
}

export interface PaySalaryPayload {
  employee_id: string;
  amount: number;
  payment_source: "CASH" | "BANK";
  bank_account_id?: string | null;
  payment_date: string;
  for_month: string;
  days_present: number;
  bonus: number;
  deductions: number;
  reference: string;
  notes: string;
}

export interface StaffSummaryStats {
  total_active_employees: number;
  present_today: number;
  total_monthly_payroll_due: number;
  total_payroll_paid_this_month: number;
}

export interface OpeningCapitalPayload {
  opening_cash: number;
  opening_bank: number;
  opening_balance_mode?: "CASH" | "BANK" | "SPLIT";
  capital_cash?: number;
  capital_bank?: number;
  capital_mode?: "CASH" | "BANK" | "SPLIT";
  custom_payment_1_name?: string;
  custom_payment_1_enabled?: boolean;
  custom_payment_2_name?: string;
  custom_payment_2_enabled?: boolean;
}

export interface AppUpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_notes: string;
  published_at: string;
  html_url: string;
  download_url: string;
}

export interface SwitchCurrencyPayload {
  new_currency_code: string;
  new_currency_symbol: string;
  preserve_catalog: boolean;
}

export interface AuthState {
  is_setup_completed: boolean;
  is_locked: boolean;
  username: string;
  has_account: boolean;
}

export interface SetupPayload {
  username: string;
  password: string;
  recovery_code: string;
  business_name: string;
  tagline?: string;
  currency_symbol?: string;
  currency_code?: string;
}

export interface DepositPayload {
  destination: "CASH" | "BANK" | "CAPITAL" | string;
  amount: number;
  source: string;
  reference: string;
  date: string;
  bank_account_id?: string | null;
  notes: string;
}

export interface LicenseStatus {
  is_licensed: boolean;
  is_trial: boolean;
  is_expired: boolean;
  days_elapsed: number;
  days_remaining: number;
  trial_days_limit: number;
  first_run_date: string;
  license_key?: string | null;
  license_tier?: string | null;
  customer_email?: string | null;
  activated_at?: string | null;
  platform: string;
}

export interface LicenseActivationPayload {
  license_key: string;
  customer_email?: string | null;
}



