import { invoke } from "@tauri-apps/api/core";
import type {
  Settings,
  Item,
  Party,
  Invoice,
  InvoicePayload,
  InvoiceDetail,
  Payment,
  Expense,
  StockMovement,
  AuditLog,
  DashboardSummary,
  DaybookEntry,
  BackupInfo,
  CashClosing,
  PurchaseOrder,
  StockTransferPayload,
  QuickProductPayload,
  Estimate,
  EstimatePayload,
  EstimateDetail,
  CustomerAging,
  PurchaseReturn,
  PurchaseReturnPayload,
  BankAccount,
  BusinessLoan,
  LoanTransactionPayload,
  SupplierPaymentPayload,
  RecurringBill,
  RecurringBillPayload,
  PayRecurringBillPayload,
  Employee,
  EmployeePayload,
  EmployeeAttendance,
  RecordAttendancePayload,
  SalaryPayment,
  PaySalaryPayload,
  StaffSummaryStats,
  OpeningCapitalPayload,
  DepositPayload,
  SwitchCurrencyPayload,
  AuthState,
  SetupPayload,
  AppUpdateInfo,
  LicenseStatus,
  LicenseActivationPayload,
} from "../types";

export const api = {
  // Settings
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<Settings>("save_settings", { settings }),

  // Items / Inventory
  listItems: (search?: string, category?: string, godown?: string) =>
    invoke<Item[]>("list_items", { search, category, godown }),
  saveItem: (item: Item) => invoke<Item>("save_item", { item }),
  deleteItem: (id: string) => invoke<boolean>("delete_item", { id }),
  adjustStock: (itemId: string, adjustment: number, reason: string) =>
    invoke<Item>("adjust_stock", { itemId, adjustment, reason }),
  getStockMovements: (itemId?: string) =>
    invoke<StockMovement[]>("get_stock_movements", { itemId }),
  quickCreateProduct: (payload: QuickProductPayload) =>
    invoke<Item>("quick_create_product", { payload }),

  // Parties
  listParties: (partyType?: string, search?: string) =>
    invoke<Party[]>("list_parties", { partyType, search }),
  saveParty: (party: Party) => invoke<Party>("save_party", { party }),
  deleteParty: (id: string) => invoke<boolean>("delete_party", { id }),

  // Invoices & Billing
  createInvoice: (payload: InvoicePayload) =>
    invoke<InvoiceDetail>("create_invoice", { payload }),
  listInvoices: (invoiceType?: string, status?: string, search?: string) =>
    invoke<Invoice[]>("list_invoices", { invoiceType, status, search }),
  getInvoice: (id: string) => invoke<InvoiceDetail>("get_invoice", { id }),
  deleteInvoice: (id: string) => invoke<boolean>("delete_invoice", { id }),
  voidOrDeleteInvoice: (invoiceId: string, action: "RETURN" | "CANCEL", reason: string) =>
    invoke<boolean>("void_or_delete_invoice", { invoiceId, action, reason }),
  exportInvoicePdf: (invoiceId: string) =>
    invoke<string>("export_invoice_pdf", { invoiceId }),
  saveInvoicePdfFile: (invoiceNumber: string, bytes: number[] | Uint8Array) =>
    invoke<string>("save_invoice_pdf_file", {
      invoiceNumber,
      bytes: Array.from(bytes),
    }),
  openInvoicePdf: (invoiceNumber: string) =>
    invoke<boolean>("open_invoice_pdf", { invoiceNumber }),

  // Payments
  recordPayment: (payment: Payment) =>
    invoke<Payment>("record_payment", { payment }),
  listPayments: (partyId?: string) =>
    invoke<Payment[]>("list_payments", { partyId }),

  // Expenses
  listExpenses: (category?: string) =>
    invoke<Expense[]>("list_expenses", { category }),
  saveExpense: (expense: Expense) =>
    invoke<Expense>("save_expense", { expense }),
  deleteExpense: (id: string) => invoke<boolean>("delete_expense", { id }),

  // Dashboard & Reports
  getDashboardSummary: () => invoke<DashboardSummary>("get_dashboard_summary"),
  getDaybook: (date: string) => invoke<DaybookEntry[]>("get_daybook", { date }),

  // Extended Business OS Features
  // Feature 1: Low-Stock Purchase Order Generator
  generateLowStockPO: () => invoke<PurchaseOrder>("generate_low_stock_po"),
  listPurchaseOrders: () => invoke<PurchaseOrder[]>("list_purchase_orders"),

  // Feature 4: Shift Closing & Z-Report
  recordCashClosing: (closing: CashClosing) =>
    invoke<CashClosing>("record_cash_closing", { closing }),
  listCashClosings: () => invoke<CashClosing[]>("list_cash_closings"),

  // Feature 5: Multi-Godown Stock Transfer
  transferGodownStock: (payload: StockTransferPayload) =>
    invoke<boolean>("transfer_godown_stock", { payload }),

  // Feature 2: Estimates & Quotations
  createEstimate: (payload: EstimatePayload) =>
    invoke<Estimate>("create_estimate", { payload }),
  listEstimates: () => invoke<Estimate[]>("list_estimates"),
  getEstimate: (estimateId: string) =>
    invoke<EstimateDetail>("get_estimate", { estimateId }),
  convertEstimateToInvoice: (estimateId: string, paymentMethod: string) =>
    invoke<Invoice>("convert_estimate_to_invoice", { estimateId, paymentMethod }),

  // Feature 4: Customer Credit Aging
  getCustomerAgingAnalysis: () =>
    invoke<CustomerAging[]>("get_customer_aging_analysis"),

  // Feature 14: Purchase Returns & Debit Notes
  createPurchaseReturn: (payload: PurchaseReturnPayload) =>
    invoke<PurchaseReturn>("create_purchase_return", { payload }),
  listPurchaseReturns: () =>
    invoke<PurchaseReturn[]>("list_purchase_returns"),

  // Banking & Multi-Account Liquidity
  listBankAccounts: () => invoke<BankAccount[]>("list_bank_accounts"),
  saveBankAccount: (account: BankAccount) =>
    invoke<BankAccount>("save_bank_account", { account }),
  transferCashBank: (direction: "CASH_TO_BANK" | "BANK_TO_CASH", bankAccountId: string, amount: number, notes: string) =>
    invoke<boolean>("transfer_cash_bank", { direction, bankAccountId, amount, notes }),
  recordDeposit: (payload: DepositPayload) =>
    invoke<[number, number]>("record_deposit", { payload }),
  showMainWindow: () => invoke<boolean>("show_main_window"),

  // Business Loans & Startup Liabilities
  listBusinessLoans: () => invoke<BusinessLoan[]>("list_business_loans"),
  saveBusinessLoan: (loan: BusinessLoan) =>
    invoke<BusinessLoan>("save_business_loan", { loan }),
  recordLoanTransaction: (payload: LoanTransactionPayload) =>
    invoke<boolean>("record_loan_transaction", { payload }),

  // Pay Supplier / Settle Vendor Bill
  paySupplierBill: (payload: SupplierPaymentPayload) =>
    invoke<boolean>("pay_supplier_bill", { payload }),

  // Monthly Recurring Bills (Rent, Utilities, Loan Interest)
  listRecurringBills: () => invoke<RecurringBill[]>("list_recurring_bills"),
  saveRecurringBill: (bill: RecurringBillPayload) =>
    invoke<RecurringBill>("save_recurring_bill", { bill }),
  deleteRecurringBill: (id: string) =>
    invoke<boolean>("delete_recurring_bill", { id }),
  payRecurringBill: (payload: PayRecurringBillPayload) =>
    invoke<RecurringBill>("pay_recurring_bill", { payload }),

  // Owner Mode: Staff Attendance & Payroll
  listEmployees: (includeInactive?: boolean) =>
    invoke<Employee[]>("list_employees", { includeInactive }),
  saveEmployee: (employee: EmployeePayload) =>
    invoke<Employee>("save_employee", { employee }),
  deleteEmployee: (id: string) =>
    invoke<boolean>("delete_employee", { id }),
  recordAttendance: (payload: RecordAttendancePayload) =>
    invoke<EmployeeAttendance>("record_attendance", { payload }),
  listAttendance: (date?: string) =>
    invoke<EmployeeAttendance[]>("list_attendance", { date }),
  paySalary: (payload: PaySalaryPayload) =>
    invoke<SalaryPayment>("pay_salary", { payload }),
  listSalaryPayments: (employeeId?: string) =>
    invoke<SalaryPayment[]>("list_salary_payments", { employeeId }),
  getStaffStats: () => invoke<StaffSummaryStats>("get_staff_stats"),

  // Opening Capital & Currency Switch Reset
  updateOpeningCapital: (payload: OpeningCapitalPayload) =>
    invoke<Settings>("update_opening_capital", { payload }),
  switchCurrencyAndResetData: (payload: SwitchCurrencyPayload) =>
    invoke<Settings>("switch_currency_and_reset_data", { payload }),

  // Safe Vault & Automated Backups
  createBackup: () => invoke<string>("create_database_backup"),
  listBackups: () => invoke<BackupInfo[]>("list_database_backups"),
  restoreBackup: (backupPath: string) =>
    invoke<boolean>("restore_database_backup", { backupPath }),

  // System & Audit
  getAuditLogs: (limit?: number) => invoke<AuditLog[]>("get_audit_logs", { limit }),
  seedDemoData: (days: number = 30) => invoke<string>("seed_demo_data", { days }),
  clearAllData: () => invoke<boolean>("clear_all_data"),

  // Authentication, Onboarding & Security
  getAuthState: () => invoke<AuthState>("get_auth_state"),
  completeSetup: (payload: SetupPayload) => invoke<boolean>("complete_setup", { payload }),
  verifyUnlockPassword: (password: string) => invoke<boolean>("verify_unlock_password", { password }),
  setAppLocked: (locked: boolean) => invoke<boolean>("set_app_locked", { locked }),
  resetPasswordWithRecoveryCode: (recoveryCode: string, newPassword: string) =>
    invoke<boolean>("reset_password_with_recovery_code", { recoveryCode, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    invoke<boolean>("change_password", { currentPassword, newPassword }),
  disablePassword: (currentPassword: string) =>
    invoke<boolean>("disable_password", { currentPassword }),
  getRecoveryCode: () => invoke<string>("get_recovery_code"),

  // App lifecycle & update compatibility (final release, no updates)
  checkAppUpdate: () => invoke<AppUpdateInfo>("check_app_update"),
  restartApp: () => invoke<void>("restart_app"),

  // Hardware Thermal Printer & Cash Drawer Engine
  listPrinters: () => invoke<import("../types").PrinterDeviceInfo[]>("list_printers"),
  printRawEscpos: (payload: import("../types").ReceiptPrintPayload) =>
    invoke<string>("print_raw_escpos", { payload }),
  testPrintReceipt: (params?: {
    printerType?: string;
    printerTarget?: string;
    paperWidth?: string;
    autoCut?: boolean;
    openCashDrawerFlag?: boolean;
  }) =>
    invoke<string>("test_print_receipt", {
      printerType: params?.printerType ?? null,
      printerTarget: params?.printerTarget ?? null,
      paperWidth: params?.paperWidth ?? null,
      autoCut: params?.autoCut ?? null,
      openCashDrawerFlag: params?.openCashDrawerFlag ?? null,
    }),
  openCashDrawer: (params?: { printerType?: string; printerTarget?: string }) =>
    invoke<string>("open_cash_drawer", {
      printerType: params?.printerType ?? null,
      printerTarget: params?.printerTarget ?? null,
    }),

  // Commercial Licensing & 7-Day Trial Engine
  getLicenseStatus: () => invoke<LicenseStatus>("get_license_status"),
  activateLicense: (licenseKey: string, customerEmail?: string) =>
    invoke<LicenseStatus>("activate_license", {
      payload: {
        license_key: licenseKey,
        customer_email: customerEmail || null,
      } as LicenseActivationPayload,
    }),
};

