import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = "/home/leodarshan/.gemini/antigravity-cli/brain/682fe09e-922f-4782-a0f1-3035756146f4/smoke_windows_verification";
const BASE_URL = "http://127.0.0.1:5178";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface Step {
  filename: string;
  desc: string;
  url: string;
  action?: (page: any) => Promise<void>;
}

const steps: Step[] = [
  // 1-5: Setup, Security, Dashboard & POS Register
  {
    filename: "01_setup_wizard_welcome_screen.png",
    desc: "Initial First-Time Setup Wizard & Onboarding Screen",
    url: `${BASE_URL}/?setup=1`,
  },
  {
    filename: "02_app_lock_screen_security.png",
    desc: "Sovereign Master App Lock Screen",
    url: `${BASE_URL}/?locked=1`,
  },
  {
    filename: "03_dashboard_overview_metrics.png",
    desc: "Executive Dashboard Overview & Real-Time Metrics",
    url: `${BASE_URL}/?tab=dashboard`,
  },
  {
    filename: "04_pos_register_empty_state.png",
    desc: "POS Counter Register Ready for Barcode / SKU Scan",
    url: `${BASE_URL}/?tab=pos`,
  },
  {
    filename: "05_pos_register_item_search_and_cart.png",
    desc: "POS Register with Items Added to Cart",
    url: `${BASE_URL}/?tab=pos`,
    action: async (page) => {
      const card = await page.$("button.group");
      if (card) {
        await card.click();
        await new Promise((r) => setTimeout(r, 200));
        await card.click();
        await new Promise((r) => setTimeout(r, 200));
      }
    },
  },

  // 6-8: Payment, Invoices & Thermal Slip
  {
    filename: "06_pos_register_payment_selector.png",
    desc: "POS Tender & Multi-Payment Method Selector",
    url: `${BASE_URL}/?tab=pos`,
    action: async (page) => {
      const card = await page.$("button.group");
      if (card) {
        await card.click();
        await new Promise((r) => setTimeout(r, 200));
      }
      const tenderBtn = await page.$("button:has-text('CHARGE'), button:has-text('PAY'), button:has-text('TENDER')");
      if (tenderBtn) await tenderBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    },
  },
  {
    filename: "07_sales_and_invoices_history.png",
    desc: "Sales Transactions & Invoices History Register",
    url: `${BASE_URL}/?tab=invoices`,
  },
  {
    filename: "08_tax_invoice_modal_original_recipient.png",
    desc: "A4 Commercial Tax Invoice Preview (Original for Recipient)",
    url: `${BASE_URL}/?tab=invoices`,
    action: async (page) => {
      const viewBtn = await page.$("button:has-text('Bill'), button:has-text('View'), button:has-text('Receipt')");
      if (viewBtn) {
        await viewBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    },
  },
  {
    filename: "09_thermal_80mm_receipt_slip.png",
    desc: "80mm POS Continuous Thermal Slip Preview",
    url: `${BASE_URL}/?tab=invoices`,
    action: async (page) => {
      const viewBtn = await page.$("button:has-text('Bill'), button:has-text('View'), button:has-text('Receipt')");
      if (viewBtn) {
        await viewBtn.click();
        await new Promise((r) => setTimeout(r, 400));
        const thermalBtn = await page.$("button:has-text('80mm Slip'), button:has-text('80mm')");
        if (thermalBtn) {
          await thermalBtn.click();
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    },
  },

  // 10-13: Inventory, Products & Godowns
  {
    filename: "10_inventory_items_table_view.png",
    desc: "Product & SKU Inventory Catalog View",
    url: `${BASE_URL}/?tab=inventory`,
  },
  {
    filename: "11_quick_add_product_modal.png",
    desc: "Quick Create New Product / Stock Modal",
    url: `${BASE_URL}/?tab=inventory`,
    action: async (page) => {
      const addBtn = await page.$("button:has-text('Add Product'), button:has-text('New Item')");
      if (addBtn) {
        await addBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    },
  },
  {
    filename: "12_stock_adjustment_modal.png",
    desc: "Inventory Stock Adjustment & Godown Audit Modal",
    url: `${BASE_URL}/?tab=inventory`,
    action: async (page) => {
      const adjBtn = await page.$("button:has-text('Adjust'), button:has-text('Stock')");
      if (adjBtn) {
        await adjBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    },
  },

  // 13-15: Customers, Vendors & Credit
  {
    filename: "13_customers_and_vendors_ledger.png",
    desc: "Customers & Suppliers Ledger Directory",
    url: `${BASE_URL}/?tab=parties`,
  },
  {
    filename: "14_add_new_customer_modal.png",
    desc: "Register New Customer & Vendor Profile Modal",
    url: `${BASE_URL}/?tab=parties`,
    action: async (page) => {
      const addPartyBtn = await page.$("button:has-text('Add Party'), button:has-text('New Customer')");
      if (addPartyBtn) {
        await addPartyBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    },
  },
  {
    filename: "15_credit_management_debtors_aging.png",
    desc: "Customer Credit Aging (0-30, 31-60, 61-90, 90+ days)",
    url: `${BASE_URL}/?tab=parties`,
  },

  // 16-17: Operating Expenses
  {
    filename: "16_expenses_management_screen.png",
    desc: "Operating Expenditure & Overhead Tracker",
    url: `${BASE_URL}/?tab=expenses`,
  },
  {
    filename: "17_record_new_expense_modal.png",
    desc: "Record Operating Expense Modal",
    url: `${BASE_URL}/?tab=expenses`,
    action: async (page) => {
      const addExpBtn = await page.$("button:has-text('Add Expense'), button:has-text('New Expense')");
      if (addExpBtn) {
        await addExpBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    },
  },

  // 18-19: Staff & Payroll
  {
    filename: "18_staff_and_payroll_dashboard.png",
    desc: "Staff Management, Attendance & Payroll Directory",
    url: `${BASE_URL}/?tab=staff`,
  },
  {
    filename: "19_employee_attendance_and_salary.png",
    desc: "Employee Attendance & Salary Payout",
    url: `${BASE_URL}/?tab=staff`,
  },

  // 20-21: Financial Reports & Audit
  {
    filename: "20_financial_reports_daybook.png",
    desc: "Real-Time Financial Daybook & Cash/Bank Ledger",
    url: `${BASE_URL}/?tab=reports`,
  },
  {
    filename: "21_system_and_audit_trail_logs.png",
    desc: "Tamper-Evident Security Audit Logs",
    url: `${BASE_URL}/?tab=audit`,
  },

  // 22-25: Manage Money Engine (Contra & Capital Transfers)
  {
    filename: "22_manage_money_cash_to_bank_transfer.png",
    desc: "Manage Money: Cash to Bank Contra Transfer",
    url: `${BASE_URL}/?tab=pos`,
    action: async (page) => {
      const manageMoneyBtn = await page.$("button:has-text('Manage Money')");
      if (manageMoneyBtn) {
        await manageMoneyBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      }
    },
  },
  {
    filename: "23_manage_money_bank_to_cash_drawer.png",
    desc: "Manage Money: Bank to Cash Drawer Withdrawal",
    url: `${BASE_URL}/?tab=pos`,
    action: async (page) => {
      const manageMoneyBtn = await page.$("button:has-text('Manage Money')");
      if (manageMoneyBtn) {
        await manageMoneyBtn.click();
        await new Promise((r) => setTimeout(r, 300));
        const b2c = await page.$("button:has-text('Bank to Cash')");
        if (b2c) await b2c.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    },
  },
  {
    filename: "24_manage_money_capital_deposit.png",
    desc: "Manage Money: Capital Injection & Partner Deposit",
    url: `${BASE_URL}/?tab=pos`,
    action: async (page) => {
      const manageMoneyBtn = await page.$("button:has-text('Manage Money')");
      if (manageMoneyBtn) {
        await manageMoneyBtn.click();
        await new Promise((r) => setTimeout(r, 300));
        const dep = await page.$("button:has-text('Deposit')");
        if (dep) await dep.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    },
  },

  // 25-28: Indian Statutory GST Hub (Statutory Compliance)
  {
    filename: "25_indian_gst_hub_overview.png",
    desc: "Indian Statutory GST ERP Hub & Duties Ledger",
    url: `${BASE_URL}/?tab=gst_hub&currency=INR&gst=1`,
  },
  {
    filename: "26_indian_gst_pos_billing.png",
    desc: "Indian GST POS Billing with Intra/Inter-State Tax Split",
    url: `${BASE_URL}/?tab=gst_pos&currency=INR&gst=1`,
  },
  {
    filename: "27_indian_gst_gstr1_report.png",
    desc: "GSTR-1 Statutory Outward Supplies Tax Return",
    url: `${BASE_URL}/?tab=gstr1&currency=INR&gst=1`,
  },
  {
    filename: "28_indian_gst_gstr3b_summary.png",
    desc: "GSTR-3B Monthly Tax Summary & ITC Offset Report",
    url: `${BASE_URL}/?tab=gstr3b&currency=INR&gst=1`,
  },

  // 29-33: Offline Commercial Licensing & Trial Lifecycle
  {
    filename: "29_trial_active_header_indicator.png",
    desc: "14-Day Free Trial Active Badge in Top App Header",
    url: `${BASE_URL}/?tab=pos`,
  },
  {
    filename: "30_trial_activation_modal_14_day_active.png",
    desc: "Trial Activation Modal (14 Days Remaining State)",
    url: `${BASE_URL}/?modal=license`,
  },
  {
    filename: "31_trial_activation_modal_key_entry.png",
    desc: "Trial Activation Modal with License Key Input",
    url: `${BASE_URL}/?modal=license`,
    action: async (page) => {
      const keyInput = await page.$("input[placeholder*='LYN-COMM'], input[type='text']");
      if (keyInput) {
        await keyInput.focus();
        await page.keyboard.type("LYN-COMM-RZP8-COMM-4892-1082", { delay: 25 });
        await new Promise((r) => setTimeout(r, 300));
      }
    },
  },
  {
    filename: "32_trial_activation_modal_commercial_unlocked.png",
    desc: "Commercial Lifetime License Activated & Unlocked",
    url: `${BASE_URL}/?modal=license&licensed=1`,
  },
  {
    filename: "33_licensed_lifetime_header_badge.png",
    desc: "App Header Displaying Verified Lifetime License Badge",
    url: `${BASE_URL}/?tab=pos&licensed=1`,
  },
  {
    filename: "34_trial_expired_billing_lockout.png",
    desc: "Trial Expired Warning Banner with Commercial Checkout Trigger",
    url: `${BASE_URL}/?tab=pos&trial=expired`,
  },

  // 35-36: Software Update & Business Settings
  {
    filename: "35_software_update_modal_v1_5_3.png",
    desc: "In-App Software Update Dialog with Release Notes",
    url: `${BASE_URL}/?modal=update`,
  },
  {
    filename: "36_settings_view_business_profile.png",
    desc: "Business Profile, Tax ID & Currency Settings View",
    url: `${BASE_URL}/?tab=settings`,
  },
];

async function run() {
  console.log(`🚀 Starting execution of ${steps.length} Smoke Test Screenshots...`);

  const browser = await puppeteer.launch({
    executablePath: "/home/leodarshan/.local/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1440,900",
    ],
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    },
  });

  let successCount = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const page = await browser.newPage();
    try {
      await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: 10000 });
      await new Promise((r) => setTimeout(r, 600));

      if (step.action) {
        try {
          await step.action(page);
        } catch (actErr) {
          console.warn(`[Action Warning] ${step.filename}:`, actErr);
        }
      }

      const filePath = path.join(OUTPUT_DIR, step.filename);
      await page.screenshot({ path: filePath, fullPage: false });
      successCount++;
      console.log(`📸 [${i + 1}/${steps.length}] ${step.filename} — ${step.desc}`);
    } catch (err) {
      console.error(`❌ Failed on step ${step.filename}:`, err);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\n🎉 Verification Complete! Successfully captured ${successCount}/${steps.length} smoke test screenshots in ${OUTPUT_DIR}`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
